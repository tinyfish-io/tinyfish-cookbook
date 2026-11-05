import { describe, expect, it } from "vite-plus/test";

import { domainsIn, leadingName, namedBrands, unknownSiteIn } from "./brands.ts";
import { FALLBACK_SITES } from "./sites/fallback.ts";
import { IN_SITES } from "./sites/in.ts";

const names = (task: string) =>
  namedBrands(task, [...IN_SITES.brands, ...FALLBACK_SITES.brands]).map(({ name }) => name);

describe("namedBrands", () => {
  it("finds a brand in any case", () => {
    expect(names("buy a laptop on blinkit")).toEqual(["Blinkit"]);
    expect(names("Buy a laptop on BLINKIT")).toEqual(["Blinkit"]);
  });

  it("finds a brand from its product", () => {
    expect(names("Adobe Photoshop")).toEqual(["Adobe"]);
    expect(names("a Photoshop plan")).toEqual(["Adobe"]);
  });

  it("keeps the order of the task and every brand named", () => {
    expect(names("check Cleartrip, ixigo, EaseMyTrip and MakeMyTrip")).toEqual([
      "Cleartrip",
      "ixigo",
      "EaseMyTrip",
      "MakeMyTrip",
    ]);
  });

  it("prefers the longer name", () => {
    expect(names("Amazon Prime membership")).toEqual(["Amazon Prime"]);
    expect(names("Swiggy Instamart order")).toEqual(["Swiggy Instamart"]);
  });

  it("lists a brand once however many times it is named", () => {
    expect(names("blinkit gift, blinkit card")).toEqual(["Blinkit"]);
  });

  it("does not match inside a longer word", () => {
    expect(names("a cromatic scale book")).toEqual([]);
  });

  it.each([
    ["flipcart laptop", "Flipkart"],
    ["flpkart shoes", "Flipkart"],
    ["amzon headphones", "Amazon"],
    ["zomoto order", "Zomato"],
    ["swigy pizza", "Swiggy"],
    ["netflx", "Netflix"],
    ["bookmyshoww", "BookMyShow"],
    ["make my trip", "MakeMyTrip"],
  ])("reads the typo or nickname %s as %s", (task, name) => {
    expect(names(task)).toEqual([name]);
  });

  it("does not take a real word for a brand it looks like", () => {
    expect(names("a tomato plant")).toEqual([]);
    expect(names("a cosy abode")).toEqual([]);
    expect(names("a shine kit")).toEqual([]);
  });

  it("stops at an exact match, so a typo check cannot add a second brand", () => {
    expect(names("netflix on flipcart")).toEqual(["Netflix"]);
  });
});

describe("leadingName", () => {
  it.each([
    ["zee5 premium", "zee5"],
    ["sony liv subscription", "sony liv"],
    ["costco membership", "costco"],
    ["kogan tv", "kogan"],
    ["southwest flight to denver", "southwest"],
    ["buy a boat speaker", "boat"],
  ])("reads the name at the front of %s", (task, name) => {
    expect(leadingName(task)).toBe(name);
  });

  it.each([
    "a laptop",
    "cheap flights to goa",
    "movie tickets",
    "need a new phone charger",
    "2 tvs",
  ])("finds no name in %s", (task) => {
    expect(leadingName(task)).toBeNull();
  });
});

describe("domainsIn", () => {
  it("reads a site address from the task", () => {
    expect(domainsIn("buy a lamp on ikea.com/in please")).toEqual([
      { name: "ikea.com", url: "https://ikea.com/in" },
    ]);
    expect(domainsIn("https://www.shop.co.uk/lamps")).toEqual([
      { name: "shop.co.uk", url: "https://www.shop.co.uk/lamps" },
    ]);
  });

  it("reads the many country endings a pasted address can have", () => {
    expect(domainsIn("zalando.fr robe")[0]?.url).toBe("https://zalando.fr");
    expect(domainsIn("kabum.com.br placa")[0]?.url).toBe("https://kabum.com.br");
  });

  it("leaves an email address alone", () => {
    expect(domainsIn("mail me at sam@shop.com")).toEqual([]);
  });

  it("does not read decimals or sizes as addresses", () => {
    expect(domainsIn("buy a 1.5 m cable, e.g. braided")).toEqual([]);
  });
});

describe("unknownSiteIn", () => {
  it("reads a capitalised name after on, at or from", () => {
    expect(unknownSiteIn("buy shoes on Decathlon")).toBe("Decathlon");
    expect(unknownSiteIn("buy a pan at Pepperfry")).toBe("Pepperfry");
    expect(unknownSiteIn("buy tea from Blue Tokai")).toBe("Blue Tokai");
  });

  it("reads a lower-case name that ends the task after on", () => {
    expect(unknownSiteIn("buy shoes on decathlon")).toBe("decathlon");
  });

  it("leaves out ordinary phrases", () => {
    expect(unknownSiteIn("buy a laptop on sale")).toBeNull();
    expect(unknownSiteIn("buy a shirt on monday")).toBeNull();
    expect(unknownSiteIn("buy a phone on EMI")).toBeNull();
    expect(unknownSiteIn("buy earphones")).toBeNull();
  });

  it("leaves out places in a travel task", () => {
    expect(unknownSiteIn("flight from Mumbai to Delhi on 25 Nov")).toBeNull();
  });
});
