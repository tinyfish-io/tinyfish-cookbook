import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { ApiError } from "../errors.ts";
import { readJson, writeJson } from "../store/jsonFile.ts";
import type { SetupSession } from "../tinyfish/client.ts";
import { TinyFishError } from "../tinyfish/client.ts";
import type { GuidedOptions } from "./guided.ts";
import { GuidedLogin } from "./guided.ts";
import type { Frame, LoginBrowser, OpenBrowser } from "./loginBrowser.ts";
import { countryName } from "../plan/country.ts";
import { brandName } from "../plan/names.ts";
import { isProxyFailure } from "./loginSteps.ts";
import { overrideFor } from "./overrides.ts";
import type { SignInAction, SignInState, SignInView, StepView } from "./views.ts";

export interface SignInClient {
  createProfile(name: string, proxyCountry: string | null): Promise<string>;
  deleteProfile(profileId: string): Promise<void>;
  startSetup(profileId: string, url: string): Promise<SetupSession>;
  saveSetup(profileId: string, sessionId: string, site: string): Promise<void>;
  cancelSetup(profileId: string, sessionId: string): Promise<void>;
}

/** What goes to disk, so a restart can still clean up. Never a step, input or a CDP url. */
interface SignInRecord {
  id: string;
  visitorId: string;
  profileId: string;
  sessionId: string;
  url: string;
  host: string;
  proxyCountry: string | null;
  state: SignInState;
  expiresAt: string;
  savedAt: number | null;
  /** Said once, when the sign-in had to leave the country's connection behind. */
  notice?: string | null;
}

export type SignInInput =
  | { kind: "click"; x: number; y: number }
  | { kind: "key"; key: string }
  | { kind: "text"; text: string }
  | { kind: "scroll"; dx: number; dy: number };

export interface SignInDeps {
  client: SignInClient;
  openBrowser: OpenBrowser;
  /** Runs a short agent with the profile that logs out of the site. True if it logged out. */
  runLogout: (profileId: string, url: string, proxyCountry: string | null) => Promise<boolean>;
  dataDir: string;
  now?: () => number;
  guided?: Pick<GuidedOptions, "wait" | "settlePolls">;
}

/** The parts of a sign-in that live only in memory, and go when it ends. */
interface LiveSignIn {
  browser: LoginBrowser | null;
  guided: GuidedLogin | null;
  step: StepView;
  opened: Promise<void>;
  /** The last action still running, so the next waits its turn. */
  queue: Promise<unknown>;
  busy: number;
}

const UNUSED_LIMIT_MS = 30 * 60 * 1000;
const OPENING: StepView = { id: 0, kind: "opening", error: null };
const FAILED: StepView = { id: 0, kind: "failed", error: null };

function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

function missing(): ApiError {
  return new ApiError("not_found", "That sign-in has ended.");
}

export class SignInService {
  readonly #deps: SignInDeps;
  readonly #now: () => number;
  readonly #path: string;
  readonly #records = new Map<string, SignInRecord>();
  readonly #live = new Map<string, LiveSignIn>();
  #stopCheck: (signInId: string) => Promise<void> = () => Promise.resolve();

  constructor(deps: SignInDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? Date.now;
    this.#path = join(deps.dataDir, "signins.json");
  }

  onSignOutDuringCheck(stopCheck: (signInId: string) => Promise<void>): void {
    this.#stopCheck = stopCheck;
  }

  /** Returns as soon as the session exists. The page takes longer, and the panel waits on it. */
  async start(
    visitorId: string,
    url: string,
    proxyCountry: string | null = null,
  ): Promise<SignInView> {
    const { client } = this.#deps;
    const host = hostOf(url);
    const profileId = await client.createProfile(`Aletheia one check ${host}`, proxyCountry);

    let session: SetupSession | undefined;
    try {
      session = await client.startSetup(profileId, url);
      const record: SignInRecord = {
        id: randomUUID(),
        visitorId,
        profileId,
        sessionId: session.sessionId,
        url,
        host,
        proxyCountry,
        state: "setting_up",
        expiresAt: session.expiresAt,
        savedAt: null,
      };
      this.#records.set(record.id, record);
      await this.#persist();

      const live: LiveSignIn = {
        browser: null,
        guided: null,
        step: OPENING,
        opened: Promise.resolve(),
        queue: Promise.resolve(),
        busy: 0,
      };
      this.#live.set(record.id, live);
      live.opened = this.#open(record, live, session.cdpUrl);
      return this.#view(record);
    } catch (error) {
      if (session) await client.cancelSetup(profileId, session.sessionId).catch(() => undefined);
      await client.deleteProfile(profileId).catch(() => undefined);
      throw error;
    }
  }

  /** Settles when the page has been read, or could not be. */
  async opened(id: string): Promise<void> {
    await this.#live.get(id)?.opened;
  }

  view(visitorId: string, id: string): SignInView {
    return this.#view(this.#owned(visitorId, id));
  }

  watch(visitorId: string, id: string, listener: (frame: Frame) => void): () => void {
    this.#owned(visitorId, id);
    const browser = this.#live.get(id)?.browser;
    if (!browser) throw missing();
    return browser.onFrame(listener);
  }

  async input(visitorId: string, id: string, input: SignInInput): Promise<void> {
    this.#owned(visitorId, id);
    const browser = this.#live.get(id)?.browser;
    if (!browser) throw missing();

    switch (input.kind) {
      case "click":
        return browser.tap(input.x, input.y);
      case "key":
        return browser.press(input.key);
      case "text":
        return browser.type(input.text);
      case "scroll":
        return browser.scroll(input.dx, input.dy);
    }
  }

  /** One thing at a time on the page. A refresh never waits, as it only keeps the view current. */
  async act(visitorId: string, id: string, action: SignInAction): Promise<SignInView> {
    const record = this.#owned(visitorId, id);
    const live = this.#live.get(id);
    if (!live?.guided || !live.browser) return this.#view(record);
    if (action.kind === "refresh" && live.busy > 0) return this.#view(record);

    live.busy += 1;
    const turn = live.queue.then(() => this.#perform(record, live, action));
    live.queue = turn.catch(() => undefined);
    try {
      return await turn;
    } finally {
      live.busy -= 1;
    }
  }

  /** Hands the profile to one check. A sign-in lasts for one check only. */
  claim(visitorId: string, id: string): string {
    const record = this.#owned(visitorId, id);
    if (record.state !== "ready") {
      throw new ApiError("sign_in_not_ready", "Finish signing in before starting the check.");
    }
    record.state = "in_use";
    return record.profileId;
  }

  profileOf(id: string): string | null {
    return this.#records.get(id)?.profileId ?? null;
  }

  /** Ends a sign-in. Returns whether the site's session was logged out. */
  async release(id: string): Promise<boolean> {
    const record = this.#records.get(id);
    if (!record) return false;
    return this.#end(record);
  }

  async signOut(visitorId: string, id: string): Promise<void> {
    const record = this.#owned(visitorId, id);
    if (record.state === "in_use") {
      await this.#stopCheck(id);
      return;
    }
    await this.#end(record);
  }

  async sweep(): Promise<void> {
    const now = this.#now();
    const stale = [...this.#records.values()].filter((record) => {
      if (record.state === "setting_up") return now > Date.parse(record.expiresAt);
      return record.state === "ready" && now - (record.savedAt ?? 0) > UNUSED_LIMIT_MS;
    });
    await Promise.all(stale.map((record) => this.#end(record)));
  }

  /** A sign-in cannot outlive the server that was watching it. */
  async recover(): Promise<void> {
    const saved = (await readJson<SignInRecord[]>(this.#path)) ?? [];
    await Promise.all(saved.map((record) => this.#end(record)));
    await this.#persist();
  }

  async #open(record: SignInRecord, live: LiveSignIn, cdpUrl: string): Promise<void> {
    try {
      const browser = await this.#deps.openBrowser(cdpUrl);
      // The visitor may have cancelled while the browser was connecting.
      if (!this.#live.has(record.id)) {
        await browser.close();
        return;
      }
      const guided = new GuidedLogin(browser, {
        url: record.url,
        loginUrl: overrideFor(record.host)?.loginUrl ?? null,
        ...this.#deps.guided,
      });
      live.browser = browser;
      live.guided = guided;
      live.step = await guided.open();
      if (record.proxyCountry && isProxyFailure(await browser.scan())) {
        await this.#reopenWithoutProxy(record, live);
      }
    } catch {
      live.step = FAILED;
    }
  }

  /** Some sites will not load through a country's connection at all, so this tries once direct. */
  async #reopenWithoutProxy(record: SignInRecord, live: LiveSignIn): Promise<void> {
    const { client } = this.#deps;
    const country = record.proxyCountry;
    await live.browser?.close().catch(() => undefined);
    live.browser = null;
    live.guided = null;
    live.step = OPENING;
    await client.cancelSetup(record.profileId, record.sessionId).catch(() => undefined);
    await client.deleteProfile(record.profileId).catch(() => undefined);

    record.profileId = await client.createProfile(`Aletheia one check ${record.host}`, null);
    const session = await client.startSetup(record.profileId, record.url);
    record.sessionId = session.sessionId;
    record.expiresAt = session.expiresAt;
    record.proxyCountry = null;
    record.notice = `${brandName(record.host) ?? record.host} would not open from ${countryName(country)}, so this sign-in connects from another country.`;
    await this.#persist();
    await this.#open(record, live, session.cdpUrl);
  }

  async #perform(
    record: SignInRecord,
    live: LiveSignIn,
    action: SignInAction,
  ): Promise<SignInView> {
    const { guided, browser } = live;
    if (!guided || !browser) throw missing();

    try {
      live.step = await this.#stepAfter(guided, browser, action);
    } catch {
      // The page died or moved under the action. A person can still finish it by hand.
      live.step = guided.handOver("unreadable");
    }

    if (live.step.kind === "signed_in") await this.#save(record);
    return this.#view(record);
  }

  async #stepAfter(
    guided: GuidedLogin,
    browser: LoginBrowser,
    action: SignInAction,
  ): Promise<StepView> {
    switch (action.kind) {
      case "answer":
        return guided.answer(action.stepId, action);
      case "choose":
        return guided.choose(action.optionId);
      case "resend":
        return guided.resend();
      case "refresh":
        return guided.refresh();
      case "restart":
        await browser.hideScreen();
        return guided.restart();
      case "manual": {
        const view = guided.view();
        const shown = view.kind === "manual" ? view : guided.handOver();
        await browser.showScreen({ width: action.width, height: action.height });
        return shown;
      }
      case "resume": {
        const view = await guided.resume();
        if (view.kind !== "manual") await browser.hideScreen();
        return view;
      }
    }
  }

  async #save(record: SignInRecord): Promise<void> {
    try {
      await this.#deps.client.saveSetup(record.profileId, record.sessionId, record.host);
    } catch (error) {
      if (error instanceof TinyFishError && error.status === 409) {
        throw new ApiError("sign_in_not_ready", "That could not be saved yet. Please try again.");
      }
      throw error;
    }
    await this.#closeBrowser(record.id);
    record.state = "ready";
    record.savedAt = this.#now();
    await this.#persist();
  }

  #owned(visitorId: string, id: string): SignInRecord {
    const record = this.#records.get(id);
    if (record?.visitorId !== visitorId) throw missing();
    return record;
  }

  #view({ id, url, host, state, expiresAt, notice }: SignInRecord): SignInView {
    const step = this.#live.get(id)?.step ?? null;
    return { id, url, host, name: brandName(host), state, expiresAt, notice: notice ?? null, step };
  }

  async #closeBrowser(id: string): Promise<void> {
    const live = this.#live.get(id);
    this.#live.delete(id);
    await live?.browser?.close();
  }

  async #end(record: SignInRecord): Promise<boolean> {
    const { client, runLogout } = this.#deps;
    this.#records.delete(record.id);
    await this.#closeBrowser(record.id);

    let loggedOut = false;
    try {
      if (record.state === "setting_up") {
        await client.cancelSetup(record.profileId, record.sessionId).catch(() => undefined);
      } else {
        loggedOut = await runLogout(record.profileId, record.url, record.proxyCountry).catch(
          () => false,
        );
      }
    } finally {
      await client.deleteProfile(record.profileId).catch(() => undefined);
      await this.#persist();
    }
    return loggedOut;
  }

  async #persist(): Promise<void> {
    await writeJson(this.#path, [...this.#records.values()]);
  }
}
