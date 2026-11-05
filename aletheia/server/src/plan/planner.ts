import { detectFlow } from "../audit/goals.ts";
import { domainsIn, leadingName, namedBrands, unknownSiteIn } from "./brands.ts";
import { inferCategory, isShopCategory, isSignUpCategory } from "./category.ts";
import { countryName, proxyCountry } from "./country.ts";
import { FALLBACK_SITES, REGIONAL_MARKETPLACES } from "./sites/fallback.ts";
import { brandsOf, sitesFor } from "./sites/index.ts";
import type {
  AuditPlan,
  Brand,
  Category,
  PlannedSite,
  PlanQuestion,
  PlanSource,
  Site,
} from "./types.ts";

export interface SearchHit {
  url: string;
  title: string;
}

/** Returns the hits for a query, aimed at a country when one is given. */
export type SiteSearch = (query: string, country: string | null) => Promise<SearchHit[]>;

/** True when something answers at this address. A site that turns bots away still counts. */
export type SiteProbe = (url: string) => Promise<boolean>;

const MIN_TASK_LENGTH = 3;
const MAX_NAMED_SITES = 4;
const MAX_SEARCHED_SITES = 3;
const MAX_CACHED_SEARCHES = 500;
const TOP_HITS = 2;

/** Lists, reviews and the like, which come back from a search ahead of the shops themselves. */
const NOT_A_SHOP_HOST =
  /(^|\.)(wikipedia\.org|reddit\.com|quora\.com|youtube\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|linkedin\.com|pinterest\.com|tiktok\.com|medium\.com|forbes\.com|trustpilot\.com|sitejabber\.com|yelp\.com|tripadvisor\.[a-z.]+|g2\.com|capterra\.com|nerdwallet\.com|techradar\.com|tomsguide\.com|cnet\.com|pcmag\.com|wired\.com|rtings\.com|wirecutter\.com|nytimes\.com|bbc\.[a-z.]+|cnn\.com|statista\.com|similarweb\.com|ecommercedb\.com|ecdb\.com|kayak\.[a-z.]+|skyscanner\.[a-z.]+|trivago\.[a-z.]+|pricerunner\.[a-z.]+|idealo\.[a-z.]+|gsmarena\.com|apps\.apple\.com|play\.google\.com|github\.com|substack\.com|wordpress\.com|blogspot\.com)$|^(blog|news|support|help|community|forum|forums|docs|developer|careers)\./i;
const NOT_A_SHOP_PATH =
  /\/(blog|blogs|wiki|news|articles?|guides?|reviews?|magazine|insights)\b|\/(best|top)[-_]/i;
const SHORT_TLD = /\.[a-z]{2}$/;
/** The middle of an ending such as .co.uk or .com.br, which is not the site's name. */
const COUNTRY_ENDINGS: ReadonlySet<string> = new Set(["co", "com", "org", "net", "ac", "gov"]);

/** A task with none of these is a greeting or a test, not something to look for. */
const NO_MEANING =
  /^(hi|hello|hey|test|testing|help|ok|okay|yes|no|please|thanks|something|anything|stuff|things?|asdf\w*|qwerty\w*|idk|what|why|how|there|me|i|my|want|need|buy|order|get|book|a|an|the|some|cheap|best|good|new|online|deal|deals)$/i;

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "").toLowerCase();

function capitalised(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function planned({ name, url }: Site): PlannedSite {
  return { name, url, host: hostOf(url) };
}

function oneSitePerHost(sites: readonly PlannedSite[]): PlannedSite[] {
  return [...new Map(sites.map((site) => [site.host, site])).values()];
}

function siteName(host: string): string {
  const parts = host.split(".");
  return capitalised(parts.find((part) => part.length > 3) ?? parts[0] ?? host);
}

/** A country's own domains read as its main sites, so they go ahead of a shop abroad. */
function shopsIn(hits: readonly SearchHit[], country: string | null): PlannedSite[] {
  const shops = hits.flatMap(({ url }) => {
    if (!URL.canParse(url)) return [];
    const { origin, pathname, protocol } = new URL(url);
    const host = hostOf(url);
    if (protocol !== "https:" || NOT_A_SHOP_HOST.test(host) || NOT_A_SHOP_PATH.test(pathname)) {
      return [];
    }
    return [{ name: siteName(host), url: `${origin}/`, host }];
  });
  const code = country?.toLowerCase();
  const national = (site: PlannedSite) =>
    code !== undefined && SHORT_TLD.test(site.host) && site.host.endsWith(`.${code}`) ? 0 : 1;
  return oneSitePerHost(shops).toSorted((a, b) => national(a) - national(b));
}

/** The name a site goes by: "sony" in electronics.sony.com, "amazon" in music.amazon.in. */
function siteLabel(host: string): string {
  const parts = host.split(".");
  const secondLevel = parts.at(-2) ?? "";
  const isCountryEnding = parts.length > 2 && COUNTRY_ENDINGS.has(secondLevel);
  return (isCountryEnding ? parts.at(-3) : secondLevel) ?? "";
}

function isVague(task: string): boolean {
  const words = task.split(/[^\p{L}\d]+/u).filter(Boolean);
  return words.every((word) => NO_MEANING.test(word) || word.length < 2);
}

function forCountry(brand: Brand, country: string | null): Site {
  return { name: brand.name, url: (country && brand.urls?.[country]) || brand.url };
}

interface Picked {
  source: PlanSource;
  sites: PlannedSite[];
  question?: PlanQuestion;
}

export class SitePlanner {
  readonly #search: SiteSearch;
  readonly #probe: SiteProbe;
  readonly #cache = new Map<string, SearchHit[]>();

  constructor(search: SiteSearch, probe: SiteProbe = () => Promise.resolve(true)) {
    this.#search = search;
    this.#probe = probe;
  }

  async plan(task: string, country: string | null): Promise<AuditPlan> {
    const words = task.trim();
    const place = {
      country,
      countryName: countryName(country),
      proxied: proxyCountry(country) !== null,
    };
    if (words.length < MIN_TASK_LENGTH) {
      return {
        ...place,
        flow: "checkout",
        category: null,
        source: "none",
        sites: [],
        question: null,
      };
    }

    const brands: readonly Brand[] = brandsOf(country);
    const named = namedBrands(words, brands);
    const category = inferCategory(words);
    const flow =
      detectFlow(words) === "subscription" ||
      isSignUpCategory(category) ||
      named.some((brand) => brand.subscription)
        ? "subscription"
        : "checkout";

    const shelf = category ?? (flow === "subscription" ? "subscriptions" : null);
    const picked = await this.#pick(words, country, named, shelf);
    return { ...place, flow, category: shelf, question: null, ...picked };
  }

  async #pick(
    task: string,
    country: string | null,
    brands: readonly Brand[],
    category: Category | null,
  ): Promise<Picked> {
    const named = oneSitePerHost(
      [...domainsIn(task), ...brands.map((brand) => forCountry(brand, country))].map(planned),
    );
    if (named.length > 0) return { source: "named", sites: named.slice(0, MAX_NAMED_SITES) };

    const unknown = unknownSiteIn(task);
    if (unknown) {
      const site = await this.#officialSite(unknown, country);
      if (site) return { source: "search", sites: [site] };
    }

    const leading = isVague(task) ? null : leadingName(task);
    if (leading) {
      const site = await this.#brandSite(leading, country);
      if (site) return { source: "search", sites: [site] };
    }

    if (category) {
      const national = sitesFor(country)?.categories[category];
      if (national) return { source: "category", sites: national.map(planned) };
      const global = FALLBACK_SITES.categories[category];
      if (global && isSignUpCategory(category)) {
        return { source: "category", sites: this.#localised(global, country) };
      }
    }

    if (!isVague(task)) {
      const found = await this.#searchSites(this.#queryFor(task, category, country), country);
      const marketplace = country && isShopCategory(category) && REGIONAL_MARKETPLACES[country];
      const sites = oneSitePerHost([...(marketplace ? [planned(marketplace)] : []), ...found]);
      if (sites.length > 0) return { source: "search", sites: sites.slice(0, MAX_SEARCHED_SITES) };
    }

    const fallback = category ? FALLBACK_SITES.categories[category] : undefined;
    if (fallback) return { source: "fallback", sites: this.#localised(fallback, country) };
    return { source: "question", sites: [], question: this.#question(country) };
  }

  #localised(sites: readonly Site[], country: string | null): PlannedSite[] {
    const brands = brandsOf(country);
    return sites.map((site) => {
      const brand = brands.find(({ name }) => name === site.name);
      return planned(brand ? forCountry(brand, country) : site);
    });
  }

  #queryFor(task: string, category: Category | null, country: string | null): string {
    const place = countryName(country);
    return category === "telecom"
      ? `${task} ${place} prepaid data deals`
      : `${task} online ${place}`;
  }

  #question(country: string | null): PlanQuestion {
    const shelf = sitesFor(country)?.categories.general ?? FALLBACK_SITES.categories.general;
    return {
      text: "Which site should Aletheia check?",
      suggestions: this.#localised(shelf ?? [], country),
    };
  }

  /** Only a host carrying the name counts, so a page about the shop is not taken for the shop. */
  async #officialSite(name: string, country: string | null): Promise<PlannedSite | null> {
    const hits = await this.#searchSites(
      `${name} official website ${countryName(country)}`,
      country,
    );
    const wanted = name.toLowerCase().replaceAll(/[^a-z\d]/g, "");
    const site = hits.find(({ host }) => host.replaceAll("-", "").includes(wanted));
    return site ? { ...site, name: capitalised(name) } : null;
  }

  /** A guess at a name counts only if one of the top hits is that name's own domain. */
  async #brandSite(name: string, country: string | null): Promise<PlannedSite | null> {
    const hits = await this.#searchSites(
      `${name} official website ${countryName(country)}`,
      country,
    );
    const [firstWord = name] = name.split(" ");
    const owns = (host: string, label: string) => siteLabel(host) === label;
    const site = hits
      .slice(0, TOP_HITS)
      .find(({ host }) => owns(host, name.replaceAll(" ", "")) || owns(host, firstWord));
    return site ? { ...site, name: capitalised(name) } : null;
  }

  /** A failed search only means fewer picks, so it never fails the plan. */
  async #searchSites(query: string, country: string | null): Promise<PlannedSite[]> {
    const hits = await this.#cachedSearch(query, country);
    const shops = shopsIn(hits, country).slice(0, MAX_SEARCHED_SITES + 2);
    const answered = await Promise.all(
      shops.map((shop) => this.#probe(shop.url).catch(() => false)),
    );
    return shops.filter((_, index) => answered[index]);
  }

  async #cachedSearch(query: string, country: string | null): Promise<SearchHit[]> {
    const key = `${country}|${query.toLowerCase().replace(/\s+/g, " ")}`;
    const cached = this.#cache.get(key);
    if (cached) return cached;
    try {
      const hits = await this.#search(query, country);
      if (this.#cache.size >= MAX_CACHED_SEARCHES) this.#cache.clear();
      this.#cache.set(key, hits);
      return hits;
    } catch {
      return [];
    }
  }
}
