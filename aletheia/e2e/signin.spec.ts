import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.use({ extraHTTPHeaders: { "CF-IPCountry": "IN" } });

const TASK = "sign up for the pro plan";

const SIZES = [
  { name: "laptop", viewport: { width: 1280, height: 800 } },
  { name: "phone", viewport: { width: 375, height: 812 } },
];

/** A guest report with a sign-in offer, which is the only way into the panel. */
async function openSignIn(page: Page, flow: string) {
  const site = `https://${flow}.test/`;
  await page.goto("/");
  const audit = await page.evaluate(
    async ({ task, url }) => {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, flow: "subscription", sites: [{ url }] }),
      });
      return (await response.json()) as { id: string };
    },
    { task: TASK, url: site },
  );
  await page.goto(`/audits/${audit.id}`);
  await page.getByRole("button", { name: "Sign in to check further" }).click();
  return page.getByRole("dialog");
}

async function answer(page: Page, value: string) {
  const dialog = page.getByRole("dialog");
  await dialog.locator("input").fill(value);
  await dialog.getByRole("button", { name: "Continue" }).click();
}

/** The signed-in check starts by itself, which is the end of a good sign-in. */
async function expectSignedIn(page: Page) {
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText("Signed in for one check")).toBeVisible({ timeout: 20_000 });
}

const NO_CONSOLE_FAILURES = (page: Page) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.name));
  return failures;
};

for (const { name, viewport } of SIZES) {
  test.describe(`guided sign-in on a ${name}`, () => {
    test.use({ viewport });

    test("email, then password", async ({ page }) => {
      const failures = NO_CONSOLE_FAILURES(page);
      const dialog = await openSignIn(page, "email-password");

      await expect(dialog).toContainText("Email-password wants your email");
      await expect(dialog).toContainText("Aletheia never keeps your password or codes");
      await expect(dialog.getByRole("textbox", { name: "Email" })).toHaveAttribute("type", "email");
      await answer(page, "me@mail.test");

      await expect(dialog).toContainText("Enter your Email-password password");
      const password = dialog.getByLabel("Password", { exact: true });
      await password.fill("right-password");
      await expect(password).toHaveAttribute("type", "password");
      await dialog.getByRole("button", { name: "Show password" }).click();
      await expect(password).toHaveAttribute("type", "text");
      await dialog.getByRole("button", { name: "Continue" }).click();

      await expectSignedIn(page);
      expect(failures).toEqual([]);
    });

    test("email and password on the same page, still one question at a time", async ({ page }) => {
      const dialog = await openSignIn(page, "email-password-together");

      await expect(dialog).toContainText("wants your email");
      await answer(page, "me@mail.test");
      await expect(dialog).toContainText("password");
      await answer(page, "anything");

      await expectSignedIn(page);
    });

    for (const [flow, code] of [
      ["phone-code-4", "1234"],
      ["phone-code-6", "123456"],
      ["phone-code-8", "12345678"],
    ] as const) {
      test(`phone, then a code of ${code.length}`, async ({ page }) => {
        const dialog = await openSignIn(page, flow);

        await expect(dialog).toContainText("wants your phone number");
        await expect(dialog.getByRole("textbox", { name: "Phone number" })).toHaveAttribute(
          "inputmode",
          "tel",
        );
        await expect(dialog.getByLabel("Country code")).toHaveValue("+91");
        await answer(page, "98765 44321");

        await expect(dialog).toContainText("sent to the number ending 21");
        const field = dialog.getByLabel("Code", { exact: true });
        await expect(field).toHaveAttribute("autocomplete", "one-time-code");
        await field.fill(code);
        await dialog.getByRole("button", { name: "Continue" }).click();

        await expectSignedIn(page);
      });
    }

    test("a row of split boxes takes one code field", async ({ page }) => {
      const dialog = await openSignIn(page, "split-boxes");

      await answer(page, "9876544321");
      await expect(dialog).toContainText("sent to the number ending 21");
      await expect(dialog).toContainText("Usually 4 characters.");
      await answer(page, "4821");

      await expectSignedIn(page);
    });

    test("a code with letters, pasted with stray spaces", async ({ page }) => {
      const dialog = await openSignIn(page, "letters-code");

      await answer(page, "me@mail.test");
      await expect(dialog).toContainText("sent to r***@mail.test");
      await expect(dialog.getByLabel("Code", { exact: true })).toHaveAttribute("inputmode", "text");
      await answer(page, " aB3dE9 ");

      await expectSignedIn(page);
    });

    test("a choice of method mirrors the site's buttons", async ({ page }) => {
      const dialog = await openSignIn(page, "method-choice");

      await answer(page, "me@mail.test");
      await expect(dialog).toContainText("How do you want to sign in");
      await dialog.getByRole("button", { name: "Email me" }).click();
      await expect(dialog).toContainText("Enter the code");
      await answer(page, "123456");

      await expectSignedIn(page);
    });

    test("an authenticator second factor", async ({ page }) => {
      const dialog = await openSignIn(page, "authenticator");

      await answer(page, "me@mail.test");
      await answer(page, "anything");
      await expect(dialog).toContainText("Enter the code from your authenticator app");
      await answer(page, "654321");

      await expectSignedIn(page);
    });

    test("a wrong code shows the site's error, and trying again works", async ({ page }) => {
      const dialog = await openSignIn(page, "phone-code-6");

      await answer(page, "9876544321");
      await answer(page, "000000");

      await expect(dialog.getByRole("alert")).toHaveText("Phone-code-6 says the code is wrong.");
      await expect(dialog.getByLabel("Code", { exact: true })).toHaveValue("");

      await answer(page, "123456");
      await expectSignedIn(page);
    });

    test("a wrong password shows the site's error", async ({ page }) => {
      const dialog = await openSignIn(page, "email-password");

      await answer(page, "me@mail.test");
      await answer(page, "wrong");

      await expect(dialog.getByRole("alert")).toHaveText(
        "Email-password says the password is wrong.",
      );
    });

    test("resend presses the site's own button", async ({ page }) => {
      const dialog = await openSignIn(page, "resend");

      await answer(page, "9876545521");
      await dialog.getByRole("button", { name: "Send the code again" }).click();
      await expect(dialog).toContainText("sent to the number ending 21");
      await answer(page, "222222");

      await expectSignedIn(page);
    });

    test("a captcha opens the live page, then returns to the form", async ({ page }) => {
      await openSignIn(page, "captcha");

      const screen = page.getByRole("dialog", { name: /check you are a person/ });
      await expect(screen).toBeVisible();
      await expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();

      const live = screen.getByRole("img", { name: "Live view of captcha.test" });
      await expect(live).toBeVisible({ timeout: 10_000 });

      const { width, height } = viewport;
      const box = await live.boundingBox();
      expect((box?.width ?? 0) <= width).toBe(true);
      expect((box?.height ?? 0) < height).toBe(true);

      await screen.getByRole("button", { name: "Done" }).click();
      await expect(screen).toBeVisible();

      await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + 40);
      await page.waitForTimeout(400);
      await screen.getByRole("button", { name: "Done" }).click();

      const dialog = page.getByRole("dialog", { name: /wants your email/ });
      await expect(dialog).toBeVisible();
      await answer(page, "me@mail.test");
      await expectSignedIn(page);
    });

    test("only a social button opens the live page, and Done finishes", async ({ page }) => {
      await openSignIn(page, "google");

      const screen = page.getByRole("dialog", { name: /Finish signing in/ });
      const live = screen.getByRole("img", { name: "Live view of google.test" });
      await expect(live).toBeVisible({ timeout: 10_000 });

      const box = await live.boundingBox();
      await page.mouse.click((box?.x ?? 0) + 60, (box?.y ?? 0) + 50);
      await page.waitForTimeout(400);
      await screen.getByRole("button", { name: "Done" }).click();

      await expectSignedIn(page);
    });

    test("cancelling keeps the guest report and leaves nothing behind", async ({ page }) => {
      const dialog = await openSignIn(page, "email-password");

      await expect(dialog).toContainText("wants your email");
      await dialog.getByRole("button", { name: "Back", exact: true }).click();

      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Sign in to check further" })).toBeVisible();
    });

    test("finds a login behind the site's own button, past the search box", async ({ page }) => {
      const dialog = await openSignIn(page, "behind-a-button");

      await expect(dialog).toContainText("wants your email");
    });

    test("moves past a page that blocks visitors to the usual login address", async ({ page }) => {
      const dialog = await openSignIn(page, "blocked-home");

      await expect(dialog).toContainText("wants your email");
    });

    test("follows a footer link into the account, past the follow links", async ({ page }) => {
      const dialog = await openSignIn(page, "footer-login");

      await expect(dialog).toContainText("wants your email");
    });

    test("a missing page with follow links is not a social sign-in", async ({ page }) => {
      const dialog = await openSignIn(page, "missing-page");

      await expect(dialog).toContainText("wants your email");
    });

    test("the panel fits the screen with no sideways scroll", async ({ page }) => {
      const dialog = await openSignIn(page, "phone-code-6");
      await expect(dialog).toContainText("wants your phone number");

      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(viewport.width);
    });
  });
}
