import { describe, expect, it } from "vite-plus/test";

import { addSite, avatarTone, MAX_SITES, parseSite, siteName } from "./sites.ts";

describe("siteName", () => {
  it("takes the name from the host", () => {
    expect(siteName("blinkit.com")).toBe("Blinkit");
    expect(siteName("www.adobe.com")).toBe("Adobe");
    expect(siteName("shop.example.co.in")).toBe("Shop");
  });

  it("skips a country subdomain, which is not the site's name", () => {
    expect(siteName("in.bookmyshow.com")).toBe("Bookmyshow");
    expect(siteName("uk.example.com")).toBe("Example");
  });

  it("keeps a two-letter name that is the site itself", () => {
    expect(siteName("go.dev")).toBe("Go");
  });

  it("uses the brand's own name when the server knows it", () => {
    expect(siteName("in.bookmyshow.com", "BookMyShow")).toBe("BookMyShow");
    expect(siteName("bestbuy.ca", "Best Buy")).toBe("Best Buy");
    expect(siteName("bestbuy.ca", null)).toBe("Bestbuy");
  });
});

describe("avatarTone", () => {
  it("always gives a host the same tone", () => {
    expect(avatarTone("blinkit.com")).toBe(avatarTone("blinkit.com"));
  });

  it("stays inside the five tints", () => {
    for (const host of ["a.in", "blinkit.com", "zomato.com", "croma.com", "adobe.com"]) {
      expect(avatarTone(host)).toBeGreaterThanOrEqual(0);
      expect(avatarTone(host)).toBeLessThan(5);
    }
  });
});

describe("parseSite", () => {
  it("adds https to a bare domain", () => {
    expect(parseSite("blinkit.com")).toEqual({
      ok: true,
      url: "https://blinkit.com/",
      host: "blinkit.com",
    });
  });

  it("keeps a full address and drops www from the host", () => {
    expect(parseSite("  https://www.spotify.com/in-en/premium/ ")).toEqual({
      ok: true,
      url: "https://www.spotify.com/in-en/premium/",
      host: "spotify.com",
    });
  });

  it("rejects text that is not a site", () => {
    expect(parseSite("laptop")).toMatchObject({ ok: false });
    expect(parseSite("")).toMatchObject({ ok: false });
    expect(parseSite("ftp://files.test")).toMatchObject({ ok: false });
  });
});

describe("addSite", () => {
  const site = (url: string, host: string) => ({ url, host });

  it("appends a new site as a guest", () => {
    expect(addSite([], { url: "https://a.test/", host: "a.test" })).toEqual({
      ok: true,
      sites: [site("https://a.test/", "a.test")],
    });
  });

  it("refuses a second entry for the same site", () => {
    const result = addSite([site("https://a.test/", "a.test")], {
      url: "https://www.a.test/x",
      host: "a.test",
    });
    expect(result).toEqual({ ok: false, message: "a.test is already on the list." });
  });

  it("stops at the limit the server accepts", () => {
    const full = Array.from({ length: MAX_SITES }, (_, index) =>
      site(`https://${index}.test/`, `${index}.test`),
    );
    expect(addSite(full, { url: "https://b.test/", host: "b.test" })).toMatchObject({ ok: false });
  });
});
