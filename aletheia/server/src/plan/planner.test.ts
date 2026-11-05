import { describe, expect, it, vi } from "vite-plus/test";

import type { SearchHit } from "./planner.ts";
import { SitePlanner } from "./planner.ts";

const noSearch = () => Promise.resolve<SearchHit[]>([]);
const hit = (url: string) => ({ url, title: url });

function plan(task: string, country: string | null = "IN", search = noSearch) {
  return new SitePlanner(search).plan(task, country);
}

const hosts = async (result: ReturnType<typeof plan>) =>
  (await result).sites.map(({ host }) => host);

describe("SitePlanner", () => {
  it("picks ticket sites for a booking in India", async () => {
    const result = await plan("buy two movie tickets for Saturday");
    expect(result.flow).toBe("checkout");
    expect(result.category).toBe("movies_events");
    expect(result.source).toBe("category");
    expect(result.sites.map(({ host }) => host)).toEqual(["district.in", "in.bookmyshow.com"]);
  });

  it.each([
    [
      "Sign up for Adobe Creative Cloud and read the cancellation terms",
      "subscription",
      "adobe.com",
    ],
    ["Book a hotel room in Goa on MakeMyTrip and stop at payment", "checkout", "makemytrip.com"],
    ["Start a Spotify Premium trial", "subscription", "spotify.com"],
    ["Buy two movie tickets on BookMyShow", "checkout", "in.bookmyshow.com"],
    ["Choose a broadband plan on Airtel", "subscription", "airtel.in"],
  ])("plans the home page example %s", async (task, flow, host) => {
    const result = await plan(task);
    expect(result).toMatchObject({ flow, source: "named" });
    expect(result.sites.map((site) => site.host)).toEqual([host]);
  });

  it("keeps no shelf of everyday shops, so a task nothing places goes to a search", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://www.example-shop.in/toned")]));
    const result = await plan("a pack of ghee", "IN", search);
    expect(search).toHaveBeenCalled();
    expect(result.category).toBeNull();
    expect(result.source).toBe("search");
  });

  it("still audits BigBasket when the task names it", async () => {
    expect(await hosts(plan("buy a laptop on BigBasket"))).toEqual(["bigbasket.com"]);
  });

  it("picks each country's own sites for the same task", async () => {
    expect(await hosts(plan("buy a laptop", "US"))).toContain("bestbuy.com");
    expect(await hosts(plan("buy a laptop", "GB"))).toContain("currys.co.uk");
  });

  it("uses the brand named in the task, and its site for that country", async () => {
    const india = await plan("Adobe Photoshop");
    expect(india.source).toBe("named");
    expect(india.flow).toBe("subscription");
    expect(india.sites).toEqual([
      { name: "Adobe", url: "https://www.adobe.com/in/", host: "adobe.com" },
    ]);

    const us = await plan("Adobe Photoshop", "US");
    expect(us.sites[0]?.url).toBe("https://www.adobe.com/");
  });

  it("finds a global brand in a country with no data file", async () => {
    const result = await plan("subscribe to Spotify", "BR");
    expect(result.sites.map(({ name }) => name)).toEqual(["Spotify"]);
  });

  it("keeps a checkout when a shop that also sells plans is named", async () => {
    expect((await plan("buy a laptop on blinkit")).flow).toBe("checkout");
    expect((await plan("buy a lamp on Amazon")).flow).toBe("checkout");
  });

  it("caps a task naming too many sites at four", async () => {
    const task = "a gift on Blinkit, Zepto, BigBasket, Flipkart and Amazon";
    expect((await plan(task)).sites).toHaveLength(4);
  });

  it("reads a site address in the task", async () => {
    const result = await plan("buy a lamp on ikea.com");
    expect(result.source).toBe("named");
    expect(result.sites.map(({ host }) => host)).toEqual(["ikea.com"]);
  });

  it("looks up a site the data file does not know", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://www.snitch.co.in/shoes")]));
    const result = await plan("buy shoes on Snitch", "IN", search);

    expect(result.source).toBe("search");
    expect(result.sites).toEqual([
      { name: "Snitch", url: "https://www.snitch.co.in/", host: "snitch.co.in" },
    ]);
    expect(search).toHaveBeenCalledWith(expect.stringContaining("Snitch"), "IN");
  });

  it("takes a brand no data file knows when Search shows it is a real site", async () => {
    const search = vi.fn(() =>
      Promise.resolve([hit("https://www.zee5.com/plans"), hit("https://www.reddit.com/r/zee5")]),
    );
    const result = await plan("zee5 premium", "IN", search);

    expect(result.source).toBe("search");
    expect(result.flow).toBe("subscription");
    expect(result.sites.map(({ host }) => host)).toEqual(["zee5.com"]);
  });

  it("joins a two-word brand, and takes a brand's own store", async () => {
    const liv = vi.fn(() => Promise.resolve([hit("https://www.sonyliv.com/")]));
    const sony = vi.fn(() => Promise.resolve([hit("https://electronics.sony.com/audio")]));

    expect(await hosts(plan("sony liv subscription", "IN", liv))).toEqual(["sonyliv.com"]);
    expect(await hosts(plan("sony wh1000xm5", "US", sony))).toEqual(["electronics.sony.com"]);
  });

  it("does not take a word for a brand because it is a subdomain", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://music.amazon.in/")]));

    expect(await hosts(plan("a music streaming plan", "IN", search))).toContain("spotify.com");
  });

  it("reads a brand under a two-part country ending", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://www.kogan.com.au/tv")]));

    expect(await hosts(plan("kogan tv", "AU", search))).toEqual(["kogan.com.au"]);
  });

  it("does not take a place or a passing word for a brand", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://www.mumbaiairport.com/")]));

    expect((await plan("mumbai flight", "IN", search)).source).toBe("category");
  });

  it("falls back to the category when a named site cannot be found", async () => {
    const result = await plan("buy shoes on Snitch");
    expect(result.source).toBe("category");
    expect(result.sites[0]?.name).toBe("Myntra");
  });

  it("searches for a category the country has no data for, and drops what is not a shop", async () => {
    const search = vi.fn(() =>
      Promise.resolve([
        hit("https://www.reddit.com/r/fiji"),
        hit("https://www.tripadvisor.com/shops"),
        hit("https://www.techradar.com/best/earphones"),
        hit("https://www.vinod.com.fj/ofertas"),
        hit("https://blog.example.com/best-shops"),
        hit("https://shop.example.com/best-earphones"),
        hit("https://www.vinod.com.fj/outra"),
        hit("https://www.courts.com.fj/"),
      ]),
    );
    const result = await plan("buy earphones", "FJ", search);

    expect(result.source).toBe("search");
    expect(result.sites.map(({ host }) => host)).toEqual(["vinod.com.fj", "courts.com.fj"]);
    expect(search).toHaveBeenCalledWith(expect.stringContaining("Fiji"), "FJ");
  });

  it("puts the country's own domains first", async () => {
    const search = vi.fn(() =>
      Promise.resolve([hit("https://www.world-shop.com/"), hit("https://www.local-shop.fj/")]),
    );
    const result = await plan("buy earphones", "FJ", search);

    expect(result.sites[0]?.host).toBe("local-shop.fj");
  });

  it("leads with the region's big marketplace where there is one", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://www.corner-laptops.co.ke/")]));
    const result = await plan("buy a laptop", "KE", search);

    expect(result.sites[0]?.host).toBe("jumia.co.ke");
  });

  it("drops a search result that does not answer", async () => {
    const search = vi.fn(() =>
      Promise.resolve([hit("https://www.gone.com.fj/"), hit("https://www.alive.com.fj/")]),
    );
    const probe = vi.fn((url: string) => Promise.resolve(url.includes("alive")));
    const result = await new SitePlanner(search, probe).plan("buy earphones", "FJ");

    expect(result.sites.map(({ host }) => host)).toEqual(["alive.com.fj"]);
  });

  it("takes a brand's own site in the visitor's country", async () => {
    expect(await hosts(plan("laptop stand on amazon", "DE"))).toEqual(["amazon.de"]);
    expect(await hosts(plan("zalando sneaker", "FR"))).toEqual(["zalando.fr"]);
  });

  it("reads a typo in a brand", async () => {
    expect(await hosts(plan("flipcart laptop"))).toEqual(["flipkart.com"]);
  });

  it("treats cancelling as the subscription flow", async () => {
    expect(await plan("cancel my netflix")).toMatchObject({
      flow: "subscription",
      source: "named",
    });
  });

  it("does not read noise cancelling as cancelling", async () => {
    expect((await plan("noise cancelling headphones")).flow).toBe("checkout");
  });

  it("searches for a task the data file cannot place", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://www.gnomes.test/")]));
    const result = await plan("a garden gnome", "IN", search);
    expect(result.source).toBe("search");
    expect(result.category).toBeNull();
  });

  it("uses the generic sites when search finds nothing", async () => {
    const result = await plan("buy earphones", "FJ");
    expect(result.source).toBe("fallback");
    expect(result.sites.length).toBeGreaterThan(0);
  });

  it("asks one short question with suggestions when nothing can be picked", async () => {
    const search = vi.fn(() => Promise.reject(new Error("down")));
    const result = await plan("a garden gnome", "IN", search);

    expect(result.source).toBe("question");
    expect(result.sites).toEqual([]);
    expect(result.question?.text).toBe("Which site should Aletheia check?");
    expect(result.question?.suggestions[0]?.host).toBe("flipkart.com");
  });

  it("does not spend a search on words that mean nothing", async () => {
    const search = vi.fn(noSearch);
    const result = await plan("hello", "IN", search);

    expect(search).not.toHaveBeenCalled();
    expect(result.question).not.toBeNull();
  });

  it("asks search once for the same task and country", async () => {
    const search = vi.fn(() => Promise.resolve([hit("https://www.gnomes.test/")]));
    const planner = new SitePlanner(search);
    await planner.plan("a garden gnome", "IN");
    const searches = search.mock.calls.length;
    await planner.plan("A garden  gnome", "IN");
    expect(search).toHaveBeenCalledTimes(searches);
  });

  it("does not look for sites until there is a task", async () => {
    const search = vi.fn(noSearch);
    const result = await plan("  ", "IN", search);
    expect(result.sites).toEqual([]);
    expect(result.source).toBe("none");
    expect(search).not.toHaveBeenCalled();
  });

  it("works out the subscription flow from the category", async () => {
    const result = await plan("a music streaming plan");
    expect(result.flow).toBe("subscription");
    expect(result.category).toBe("music");
  });

  it("says where the country's name and browser stand", async () => {
    expect(await plan("buy a laptop", "IN")).toMatchObject({ countryName: "India", proxied: true });
    expect(await plan("buy a laptop", "FJ")).toMatchObject({
      countryName: "Fiji",
      proxied: true,
    });
    expect(await plan("buy a laptop", null)).toMatchObject({
      country: null,
      countryName: "Worldwide",
      proxied: false,
    });
  });
});
