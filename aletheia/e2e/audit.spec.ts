import { expect, test } from "@playwright/test";

test.use({ extraHTTPHeaders: { "CF-IPCountry": "IN" } });

const TASK = "subscribe to a music streaming plan";

test("a visitor describes a task, audits the picked sites, compares, shares and deletes", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("dark patterns");
  await expect(page.getByRole("list", { name: "Examples" }).getByRole("button")).toHaveCount(3);
  await expect(page.getByText("Country")).toHaveCount(0);

  const prompt = page.getByLabel("What should Aletheia audit?");
  await prompt.fill(TASK);

  const picked = page.getByRole("list", { name: "Sites to audit" });
  await expect(picked).toContainText("spotify.com");
  await expect(picked).toContainText("youtube.com");
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);

  // Only Adobe and LinkedIn have saved runs here, so the visitor changes the picks.
  await page.getByRole("button", { name: "Remove spotify.com" }).click();
  await page.getByRole("button", { name: "Remove youtube.com" }).click();
  await page.getByRole("button", { name: "Remove apple.com" }).click();
  for (const site of ["adobe.com", "linkedin.com"]) {
    await page.getByRole("button", { name: "Add a site" }).click();
    await page.getByLabel("Site address").fill(site);
    await page.getByRole("button", { name: "Add site" }).click();
    await expect(picked).toContainText(site);
  }

  await page.getByRole("button", { name: "Run audit" }).click();
  await expect(page).toHaveURL(/\/audits\//);

  const comparison = page.getByRole("table").filter({ hasText: "Patterns found" });
  await expect(comparison).toBeVisible({ timeout: 30_000 });
  await expect(comparison.getByRole("row", { name: /Patterns found/ })).toContainText(
    "Cancellation fee",
  );

  // Neither run saw a price move, so prices stay out of the comparison and off the page.
  await expect(comparison).not.toContainText("Price change");
  await expect(comparison).not.toContainText("Lowest total");
  await expect(page.getByText(/different items, so compare the patterns/)).toBeVisible();

  await expect(page.getByText(/^Audited as a subscription sign-up on adobe\.com/)).toBeVisible();
  const findings = page.getByRole("list", { name: "Findings on adobe.com" });
  await expect(findings.getByRole("listitem").first()).toContainText("found");

  await page.getByRole("button", { name: "Share read-only link" }).click();
  const link = await page.getByRole("textbox", { name: /link/i }).inputValue();

  const stranger = await browser.newContext();
  const sharedPage = await stranger.newPage();
  await sharedPage.goto(link);
  await expect(sharedPage.getByRole("heading", { name: "Side by side" })).toBeVisible();
  await expect(sharedPage.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await stranger.close();

  await page.getByRole("link", { name: "Past audits" }).first().click();
  await expect(page).toHaveURL(/\/audits$/);
  const saved = page.getByRole("link", { name: TASK });
  await expect(saved).toBeVisible();
  await expect(page.getByText("Cancellation fee").first()).toBeVisible();

  await page.getByRole("button", { name: /^Delete:/ }).click();
  await page.getByRole("button", { name: "Delete audit" }).click();
  await expect(saved).toHaveCount(0);
});

test("the flow follows the words and stays off the home page, and old links still work", async ({
  page,
}) => {
  await page.goto("/new?task=Adobe%20Photoshop");
  await expect(page).toHaveURL(/\/\?task=Adobe%20Photoshop$/);

  await expect(page.getByRole("list", { name: "Sites to audit" })).toContainText("adobe.com");
  await expect(page.getByLabel("Flow")).toHaveCount(0);
  await expect(page.getByLabel("Country")).toHaveCount(0);
});

test("the live browser says it is connecting until the site draws", async ({ page }) => {
  await page.goto("/");
  const audit = await page.evaluate(async () => {
    const response = await fetch("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "Sign up for Adobe Creative Cloud",
        flow: "subscription",
        sites: [{ url: "https://www.adobe.com/" }],
      }),
    });
    return (await response.json()) as { id: string };
  });
  await page.goto(`/audits/${audit.id}`);

  const frame = page.getByRole("figure");
  await expect(frame.locator("iframe")).toHaveCount(1);
  await expect(frame).toContainText("Connecting to the live browser...");
});
