import { describe, expect, it } from "vite-plus/test";

import { brandName } from "./names.ts";

describe("brandName", () => {
  it.each([
    ["bestbuy.com", "Best Buy"],
    ["www.bestbuy.com", "Best Buy"],
    ["bestbuy.ca", "Best Buy"],
    ["in.bookmyshow.com", "BookMyShow"],
    ["currys.co.uk", "Currys"],
    ["ticketmaster.co.uk", "Ticketmaster"],
  ])("names %s as %s", (host, name) => {
    expect(brandName(host)).toBe(name);
  });

  it("reads a country subdomain of a known site as that site", () => {
    expect(brandName("uk.bookmyshow.com")).toBe("BookMyShow");
    expect(brandName("bookmyshow.com")).toBe("BookMyShow");
  });

  it("never shortens a two-letter domain to its ending", () => {
    expect(brandName("zz.com")).toBeNull();
  });

  it("knows nothing of a site outside the brand data", () => {
    expect(brandName("shop.test")).toBeNull();
  });
});
