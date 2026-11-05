import { describe, expect, it } from "vite-plus/test";

import { overrideFor } from "./overrides.ts";

describe("overrideFor", () => {
  it("sends a site with no login on its home page to a page that has one", () => {
    expect(overrideFor("zomato.com")?.loginUrl).toMatch(/^https:\/\/www\.zomato\.com\/.+/);
  });

  it("matches the site's subdomains too", () => {
    expect(overrideFor("www.zomato.com")).toBe(overrideFor("zomato.com"));
  });

  it("does not match a name that only ends the same way", () => {
    expect(overrideFor("notzomato.com")).toBeNull();
  });

  it("leaves every other site to the general rules", () => {
    expect(overrideFor("adobe.com")).toBeNull();
  });
});
