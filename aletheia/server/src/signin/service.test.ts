import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { ApiError } from "../errors.ts";
import { EMAIL_PAGE, fakeBrowser, scanPage, SIGNED_IN_PAGE } from "../testing/fakeBrowser.ts";
import { TinyFishError } from "../tinyfish/client.ts";
import type { Frame } from "./loginBrowser.ts";
import type { SignInClient } from "./service.ts";
import { SignInService } from "./service.ts";

const URL_LOGIN = "https://www.shop.test/login";
const SESSION = {
  sessionId: "sess_1",
  cdpUrl: "wss://cdp.test/1",
  expiresAt: "2026-11-01T00:15:00.000Z",
};

function fakeClient() {
  return {
    createProfile: vi.fn(() => Promise.resolve("prof_1")),
    deleteProfile: vi.fn(() => Promise.resolve()),
    startSetup: vi.fn(() => Promise.resolve(SESSION)),
    saveSetup: vi.fn(() => Promise.resolve()),
    cancelSetup: vi.fn(() => Promise.resolve()),
  } satisfies SignInClient;
}

describe("SignInService", () => {
  let dataDir: string;
  let client: ReturnType<typeof fakeClient>;
  let browser: ReturnType<typeof fakeBrowser>;
  let runLogout: ReturnType<
    typeof vi.fn<(profileId: string, url: string, country: string | null) => Promise<boolean>>
  >;
  let time: number;

  function service() {
    return new SignInService({
      client,
      openBrowser: () => Promise.resolve(browser),
      runLogout,
      dataDir,
      now: () => time,
      guided: { wait: () => Promise.resolve(), settlePolls: 2 },
    });
  }

  async function started(signIns: SignInService) {
    const { id } = await signIns.start("visitor", URL_LOGIN);
    await signIns.opened(id);
    return { id, step: signIns.view("visitor", id).step };
  }

  /** Answers the one question on the default page, which signs in and saves. */
  async function signedIn(signIns: SignInService) {
    const { id, step } = await started(signIns);
    await signIns.act("visitor", id, {
      kind: "answer",
      stepId: step?.id ?? 0,
      text: "me@mail.test",
    });
    return id;
  }

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "aletheia-signin-"));
    client = fakeClient();
    browser = fakeBrowser();
    runLogout = vi.fn(() => Promise.resolve(true));
    time = Date.parse("2026-11-01T00:00:00.000Z");
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("gives each sign-in its own profile and a setup session on the site", async () => {
    const view = await service().start("visitor", URL_LOGIN, "IN");

    expect(client.createProfile).toHaveBeenCalledWith("Aletheia one check shop.test", "IN");
    expect(client.startSetup).toHaveBeenCalledWith("prof_1", URL_LOGIN);
    expect(view).toMatchObject({
      host: "shop.test",
      state: "setting_up",
      expiresAt: SESSION.expiresAt,
      step: { kind: "opening" },
    });
  });

  it("names a known site the way the brand does", async () => {
    const known = await service().start("visitor", "https://www.bestbuy.com/", "US");
    const unknown = await service().start("visitor", URL_LOGIN, "IN");

    expect(known.name).toBe("Best Buy");
    expect(unknown.name).toBeNull();
  });

  describe("a site that will not load through the country's connection", () => {
    const TUNNEL = scanPage({
      url: "chrome-error://chromewebdata/",
      text: "This site can't be reached ERR_TUNNEL_CONNECTION_FAILED",
    });

    function signInsOpening(...browsers: ReturnType<typeof fakeBrowser>[]) {
      const queue = [...browsers];
      return new SignInService({
        client,
        openBrowser: () => Promise.resolve(queue.shift() ?? fakeBrowser()),
        runLogout,
        dataDir,
        now: () => time,
        guided: { wait: () => Promise.resolve(), settlePolls: 2 },
      });
    }

    it("tries once more with no country connection and says so in one line", async () => {
      const blocked = fakeBrowser([TUNNEL]);
      client.createProfile.mockResolvedValueOnce("prof_1").mockResolvedValueOnce("prof_2");
      client.startSetup
        .mockResolvedValueOnce(SESSION)
        .mockResolvedValueOnce({ ...SESSION, sessionId: "sess_2", cdpUrl: "wss://cdp.test/2" });
      const signIns = signInsOpening(blocked, fakeBrowser());

      const { id } = await signIns.start("visitor", URL_LOGIN, "IN");
      await signIns.opened(id);
      const view = signIns.view("visitor", id);

      expect(client.createProfile).toHaveBeenLastCalledWith("Aletheia one check shop.test", null);
      expect(client.cancelSetup).toHaveBeenCalledWith("prof_1", "sess_1");
      expect(client.deleteProfile).toHaveBeenCalledWith("prof_1");
      expect(blocked.close).toHaveBeenCalled();
      expect(view.step?.kind).toBe("identifier");
      expect(view.notice).toBe(
        "shop.test would not open from India, so this sign-in connects from another country.",
      );
    });

    it("does not try again when no country connection was used", async () => {
      const signIns = signInsOpening(fakeBrowser([TUNNEL]));

      const { id } = await signIns.start("visitor", URL_LOGIN);
      await signIns.opened(id);

      expect(client.createProfile).toHaveBeenCalledTimes(1);
      expect(signIns.view("visitor", id).notice).toBeNull();
    });
  });

  it("removes the profile when the setup browser cannot be opened", async () => {
    client.startSetup.mockRejectedValueOnce(new Error("no browser"));

    await expect(service().start("visitor", URL_LOGIN)).rejects.toThrow();

    expect(client.deleteProfile).toHaveBeenCalledWith("prof_1");
  });

  it("reads the login page once the browser is up", async () => {
    const signIns = service();
    const { step } = await started(signIns);

    expect(step).toMatchObject({ kind: "identifier", accepts: "email" });
  });

  it("says so when the browser cannot be reached", async () => {
    const signIns = new SignInService({
      client,
      openBrowser: () => Promise.reject(new Error("refused")),
      runLogout,
      dataDir,
    });
    const { id } = await signIns.start("visitor", URL_LOGIN);
    await signIns.opened(id);

    expect(signIns.view("visitor", id).step).toMatchObject({ kind: "failed" });
  });

  it("closes the browser when the visitor cancels while it is opening", async () => {
    const signIns = service();
    const { id } = await signIns.start("visitor", URL_LOGIN);

    await signIns.signOut("visitor", id);
    await signIns.opened(id);

    expect(browser.close).toHaveBeenCalled();
    expect(client.deleteProfile).toHaveBeenCalledWith("prof_1");
  });

  it("saves by itself as soon as the page shows the person is in", async () => {
    const signIns = service();

    const id = await signedIn(signIns);

    expect(client.saveSetup).toHaveBeenCalledWith("prof_1", "sess_1", "shop.test");
    expect(browser.close).toHaveBeenCalled();
    expect(signIns.view("visitor", id)).toMatchObject({ state: "ready", step: null });
    expect(signIns.claim("visitor", id)).toBe("prof_1");
  });

  it("keeps the session open when TinyFish has nothing to save yet", async () => {
    client.saveSetup.mockRejectedValueOnce(new TinyFishError("nothing captured", 409));
    const signIns = service();
    const { id, step } = await started(signIns);

    const error = await signIns
      .act("visitor", id, { kind: "answer", stepId: step?.id ?? 0, text: "me@mail.test" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("sign_in_not_ready");
    expect(browser.close).not.toHaveBeenCalled();
    expect(signIns.view("visitor", id).state).toBe("setting_up");
  });

  it("does one thing at a time, so two presses cannot type over each other", async () => {
    const signIns = service();
    const { id, step } = await started(signIns);
    const stepId = step?.id ?? 0;

    await Promise.all([
      signIns.act("visitor", id, { kind: "answer", stepId, text: "first@mail.test" }),
      signIns
        .act("visitor", id, { kind: "answer", stepId, text: "second@mail.test" })
        .catch(() => undefined),
    ]);

    expect(browser.enter).toHaveBeenCalledOnce();
  });

  it("answers a refresh at once while something else is running", async () => {
    const signIns = service();
    const { id } = await started(signIns);
    let release = () => undefined as void;
    browser.scan.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(EMAIL_PAGE);
        }),
    );

    const slow = signIns.act("visitor", id, { kind: "refresh" });
    const quick = await signIns.act("visitor", id, { kind: "refresh" });
    release();
    await slow;

    expect(quick.step?.kind).toBe("identifier");
  });

  it("opens the live page at the visitor's size and closes it on the way back", async () => {
    browser = fakeBrowser([scanPage({ captcha: true }), EMAIL_PAGE]);
    const signIns = service();
    const { id, step } = await started(signIns);
    expect(step).toMatchObject({ kind: "manual", reason: "captcha" });

    await signIns.act("visitor", id, { kind: "manual", width: 390, height: 780 });
    expect(browser.showScreen).toHaveBeenCalledWith({ width: 390, height: 780 });

    void browser.advance();
    const back = await signIns.act("visitor", id, { kind: "resume" });

    expect(back.step?.kind).toBe("identifier");
    expect(browser.hideScreen).toHaveBeenCalled();
  });

  it("keeps the live page up while the step is still not done", async () => {
    browser = fakeBrowser([scanPage({ captcha: true })]);
    const signIns = service();
    const { id } = await started(signIns);
    await signIns.act("visitor", id, { kind: "manual", width: 390, height: 780 });

    const still = await signIns.act("visitor", id, { kind: "resume" });

    expect(still.step?.kind).toBe("manual");
    expect(browser.hideScreen).not.toHaveBeenCalled();
  });

  it("saves when the person finishes on the live page", async () => {
    browser = fakeBrowser([scanPage({ captcha: true }), SIGNED_IN_PAGE]);
    const signIns = service();
    const { id } = await started(signIns);
    await signIns.act("visitor", id, { kind: "manual", width: 390, height: 780 });
    void browser.advance();

    const view = await signIns.act("visitor", id, { kind: "resume" });

    expect(view.state).toBe("ready");
    expect(client.saveSetup).toHaveBeenCalledOnce();
  });

  it("falls back to the live page when the site stops doing what it should", async () => {
    const signIns = service();
    const { id, step } = await started(signIns);
    browser.enter.mockRejectedValueOnce(new Error("detached"));

    const view = await signIns.act("visitor", id, {
      kind: "answer",
      stepId: step?.id ?? 0,
      text: "me@mail.test",
    });

    expect(view.step).toMatchObject({ kind: "manual", reason: "unreadable" });
  });

  it("streams the screen and relays taps and keys to the visitor's own session", async () => {
    browser = fakeBrowser([scanPage({ captcha: true })]);
    const signIns = service();
    const { id } = await started(signIns);
    const frames: Frame[] = [];

    signIns.watch("visitor", id, (frame) => frames.push(frame));
    browser.emit({ data: "abc", width: 390, height: 780 });
    await signIns.input("visitor", id, { kind: "click", x: 10, y: 20 });
    await signIns.input("visitor", id, { kind: "text", text: "98765" });
    await signIns.input("visitor", id, { kind: "key", key: "Enter" });
    await signIns.input("visitor", id, { kind: "scroll", dx: 0, dy: 100 });

    expect(frames).toHaveLength(1);
    expect(browser.tap).toHaveBeenCalledWith(10, 20);
    expect(browser.type).toHaveBeenCalledWith("98765");
    expect(browser.press).toHaveBeenCalledWith("Enter");
    expect(browser.scroll).toHaveBeenCalledWith(0, 100);
  });

  it("keeps one visitor out of another's sign-in", async () => {
    const signIns = service();
    const { id } = await started(signIns);

    await expect(signIns.act("stranger", id, { kind: "refresh" })).rejects.toBeInstanceOf(ApiError);
    await expect(
      signIns.input("stranger", id, { kind: "click", x: 1, y: 1 }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(() => signIns.view("stranger", id)).toThrow(ApiError);
  });

  it("lasts for one check only", async () => {
    const signIns = service();
    const id = await signedIn(signIns);
    signIns.claim("visitor", id);

    expect(() => signIns.claim("visitor", id)).toThrow(ApiError);
  });

  it("will not start a check before sign-in is finished", async () => {
    const signIns = service();
    const { id } = await started(signIns);

    expect(() => signIns.claim("visitor", id)).toThrow(ApiError);
  });

  it("logs out and then deletes the profile when the check ends", async () => {
    const signIns = service();
    const id = await signedIn(signIns);
    signIns.claim("visitor", id);

    const loggedOut = await signIns.release(id);

    expect(runLogout).toHaveBeenCalledWith("prof_1", URL_LOGIN, null);
    expect(loggedOut).toBe(true);
    expect(client.deleteProfile).toHaveBeenCalledWith("prof_1");
    expect(() => signIns.view("visitor", id)).toThrow(ApiError);
  });

  it("deletes the profile even if the logout fails", async () => {
    runLogout.mockRejectedValueOnce(new Error("logout run failed"));
    const signIns = service();
    const id = await signedIn(signIns);
    signIns.claim("visitor", id);

    expect(await signIns.release(id)).toBe(false);
    expect(client.deleteProfile).toHaveBeenCalledWith("prof_1");
  });

  it("releases only once, so one profile gets one logout run", async () => {
    const signIns = service();
    const id = await signedIn(signIns);
    signIns.claim("visitor", id);

    await Promise.all([signIns.release(id), signIns.release(id)]);

    expect(runLogout).toHaveBeenCalledOnce();
    expect(client.deleteProfile).toHaveBeenCalledOnce();
  });

  it("cancelling cancels the setup and needs no logout, as nothing was saved", async () => {
    const signIns = service();
    const { id } = await started(signIns);

    await signIns.signOut("visitor", id);

    expect(client.cancelSetup).toHaveBeenCalledWith("prof_1", "sess_1");
    expect(browser.close).toHaveBeenCalledOnce();
    expect(runLogout).not.toHaveBeenCalled();
    expect(client.deleteProfile).toHaveBeenCalledWith("prof_1");
  });

  it("signing out after saving logs out first", async () => {
    const signIns = service();
    const id = await signedIn(signIns);

    await signIns.signOut("visitor", id);

    expect(runLogout).toHaveBeenCalledOnce();
    expect(client.deleteProfile).toHaveBeenCalledOnce();
  });

  it("signing out during a check stops that check", async () => {
    const stopCheck = vi.fn(() => Promise.resolve());
    const signIns = service();
    signIns.onSignOutDuringCheck(stopCheck);
    const id = await signedIn(signIns);
    signIns.claim("visitor", id);

    await signIns.signOut("visitor", id);

    expect(stopCheck).toHaveBeenCalledWith(id);
  });

  it("closes a setup session left past its limit", async () => {
    const signIns = service();
    await started(signIns);
    time = Date.parse(SESSION.expiresAt) + 1;

    await signIns.sweep();

    expect(client.cancelSetup).toHaveBeenCalledOnce();
    expect(client.deleteProfile).toHaveBeenCalledOnce();
  });

  it("logs out of a saved sign-in nobody used", async () => {
    const signIns = service();
    const id = await signedIn(signIns);
    time += 31 * 60 * 1000;

    await signIns.sweep();

    expect(runLogout).toHaveBeenCalledOnce();
    expect(client.deleteProfile).toHaveBeenCalledOnce();
    expect(() => signIns.view("visitor", id)).toThrow(ApiError);
  });

  it("leaves a sign-in alone while its check is running", async () => {
    const signIns = service();
    const id = await signedIn(signIns);
    signIns.claim("visitor", id);
    time += 60 * 60 * 1000;

    await signIns.sweep();

    expect(client.deleteProfile).not.toHaveBeenCalled();
  });

  it("cleans up sign-ins left over from before a restart", async () => {
    const first = service();
    await signedIn(first);

    await service().recover();

    expect(runLogout).toHaveBeenCalledOnce();
    expect(client.deleteProfile).toHaveBeenCalledOnce();
  });

  it("writes only the profile id and site to disk, never what was typed", async () => {
    const signIns = service();
    const id = await signedIn(signIns);

    const saved = await readFile(join(dataDir, "signins.json"), "utf8");

    expect(id).toBeTruthy();
    expect(saved).not.toContain("me@mail.test");
    expect(saved).not.toContain(SESSION.cdpUrl);
    expect(saved).toContain("prof_1");
  });
});
