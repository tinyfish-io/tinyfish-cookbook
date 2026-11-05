import type { Brand, Category, Site } from "../types.ts";

/** Sites that work in most countries, and the brands any country's task may name. */
export interface GlobalSites {
  categories: Partial<Record<Category, readonly Site[]>>;
  brands: readonly Brand[];
}

const AMAZON_DOMAINS: Readonly<Record<string, string>> = {
  IN: "in",
  GB: "co.uk",
  DE: "de",
  FR: "fr",
  JP: "co.jp",
  CA: "ca",
  AU: "com.au",
  BR: "com.br",
  MX: "com.mx",
  ES: "es",
  IT: "it",
  NL: "nl",
  TR: "com.tr",
  SA: "sa",
  AE: "ae",
  SG: "sg",
  PL: "pl",
  SE: "se",
};

function perDomain(
  domains: Readonly<Record<string, string>>,
  url: (domain: string) => string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(domains).map(([country, domain]) => [country, url(domain)]),
  );
}

const SPOTIFY = (path: string) => `https://www.spotify.com/${path}/premium/`;
const ADOBE = (path: string) => `https://www.adobe.com/${path}/`;

const NAMES = { lazada: "Lazada", shopee: "Shopee" } as const;

const JUMIA_SITES: Readonly<Record<string, string>> = {
  KE: "co.ke",
  NG: "com.ng",
  EG: "com.eg",
  GH: "com.gh",
  MA: "ma",
  UG: "ug",
};

const MERCADO_LIBRE_SITES: Readonly<Record<string, string>> = {
  AR: "com.ar",
  CL: "cl",
  CO: "com.co",
  PE: "com.pe",
  UY: "com.uy",
};

/** The big shop where no data file exists, so a search does not lead with a corner store. */
export const REGIONAL_MARKETPLACES: Readonly<Partial<Record<string, Site>>> = {
  ...Object.fromEntries(
    Object.entries(JUMIA_SITES).map(([country, domain]) => [
      country,
      { name: "Jumia", url: `https://www.jumia.${domain}/` },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(MERCADO_LIBRE_SITES).map(([country, domain]) => [
      country,
      { name: "Mercado Libre", url: `https://www.mercadolibre.${domain}/` },
    ]),
  ),
  ZA: { name: "Takealot", url: "https://www.takealot.com/" },
};

export const FALLBACK_SITES: GlobalSites = {
  categories: {
    food_delivery: [{ name: "Uber Eats", url: "https://www.ubereats.com/" }],
    electronics: [
      { name: "Amazon", url: "https://www.amazon.com/" },
      { name: "eBay", url: "https://www.ebay.com/" },
    ],
    fashion: [
      { name: "ASOS", url: "https://www.asos.com/" },
      { name: "Amazon", url: "https://www.amazon.com/" },
    ],
    general: [
      { name: "Amazon", url: "https://www.amazon.com/" },
      { name: "eBay", url: "https://www.ebay.com/" },
    ],
    travel: [
      { name: "Booking.com", url: "https://www.booking.com/" },
      { name: "Expedia", url: "https://www.expedia.com/" },
    ],
    movies_events: [{ name: "Ticketmaster", url: "https://www.ticketmaster.com/" }],
    home: [{ name: "IKEA", url: "https://www.ikea.com/" }],
    subscriptions: [
      { name: "Netflix", url: "https://www.netflix.com/" },
      { name: "Spotify", url: "https://www.spotify.com/premium/" },
      { name: "Adobe", url: "https://www.adobe.com/" },
    ],
    streaming: [
      { name: "Netflix", url: "https://www.netflix.com/" },
      { name: "Disney+", url: "https://www.disneyplus.com/" },
      { name: "Amazon Prime", url: "https://www.amazon.com/amazonprime" },
    ],
    music: [
      { name: "Spotify", url: "https://www.spotify.com/premium/" },
      { name: "YouTube Premium", url: "https://www.youtube.com/premium" },
      { name: "Apple Music", url: "https://www.apple.com/apple-music/" },
    ],
    software: [
      { name: "Adobe", url: "https://www.adobe.com/" },
      { name: "Canva", url: "https://www.canva.com/pricing/" },
      { name: "Microsoft 365", url: "https://www.microsoft.com/microsoft-365" },
    ],
    security: [
      { name: "NordVPN", url: "https://nordvpn.com/" },
      { name: "Surfshark", url: "https://surfshark.com/" },
      { name: "Norton", url: "https://us.norton.com/" },
    ],
    cloud: [
      { name: "Dropbox", url: "https://www.dropbox.com/plans" },
      { name: "Google One", url: "https://one.google.com/" },
      { name: "iCloud", url: "https://www.apple.com/icloud/" },
    ],
    dating: [
      { name: "Tinder", url: "https://tinder.com/" },
      { name: "Bumble", url: "https://bumble.com/" },
    ],
    fitness: [{ name: "Peloton", url: "https://www.onepeloton.com/" }],
    gaming: [
      { name: "Xbox Game Pass", url: "https://www.xbox.com/xbox-game-pass" },
      { name: "PlayStation Plus", url: "https://www.playstation.com/ps-plus/" },
    ],
    learning: [
      { name: "Duolingo", url: "https://www.duolingo.com/super" },
      { name: "Babbel", url: "https://www.babbel.com/" },
    ],
    news: [
      { name: "The New York Times", url: "https://www.nytimes.com/subscription" },
      { name: "The Economist", url: "https://www.economist.com/" },
    ],
  },
  brands: [
    {
      name: "Amazon Prime",
      url: "https://www.amazon.com/amazonprime",
      aliases: ["amazon prime", "prime video", "prime membership", "prime subscription", "prime"],
      subscription: true,
      urls: perDomain(AMAZON_DOMAINS, (domain) => `https://www.amazon.${domain}/amazonprime`),
    },
    {
      name: "Amazon",
      url: "https://www.amazon.com/",
      aliases: ["amazon", "amzn"],
      urls: perDomain(AMAZON_DOMAINS, (domain) => `https://www.amazon.${domain}/`),
    },
    {
      name: "eBay",
      url: "https://www.ebay.com/",
      aliases: ["ebay"],
      urls: {
        GB: "https://www.ebay.co.uk/",
        DE: "https://www.ebay.de/",
        FR: "https://www.ebay.fr/",
        IT: "https://www.ebay.it/",
        ES: "https://www.ebay.es/",
        AU: "https://www.ebay.com.au/",
        CA: "https://www.ebay.ca/",
      },
    },
    { name: "IKEA", url: "https://www.ikea.com/", aliases: ["ikea"] },
    {
      name: "Shein",
      url: "https://www.shein.com/",
      aliases: ["shein"],
      urls: { GB: "https://www.shein.co.uk/" },
    },
    { name: "Temu", url: "https://www.temu.com/", aliases: ["temu"] },
    {
      name: "AliExpress",
      url: "https://www.aliexpress.com/",
      aliases: ["aliexpress", "ali express"],
    },
    {
      name: "Wayfair",
      url: "https://www.wayfair.com/",
      aliases: ["wayfair"],
      urls: { GB: "https://www.wayfair.co.uk/" },
    },
    { name: "Nike", url: "https://www.nike.com/", aliases: ["nike"] },
    {
      name: "Adidas",
      url: "https://www.adidas.com/",
      aliases: ["adidas", "addidas"],
      urls: {
        IN: "https://www.adidas.co.in/",
        GB: "https://www.adidas.co.uk/",
        DE: "https://www.adidas.de/",
        FR: "https://www.adidas.fr/",
      },
    },
    { name: "Zara", url: "https://www.zara.com/", aliases: ["zara"] },
    { name: "H&M", url: "https://www.hm.com/", aliases: ["h&m", "hm.com", "h and m"] },
    { name: "Uniqlo", url: "https://www.uniqlo.com/", aliases: ["uniqlo"] },
    { name: "ASOS", url: "https://www.asos.com/", aliases: ["asos"] },
    {
      name: "Zalando",
      url: "https://www.zalando.de/",
      aliases: ["zalando"],
      urls: {
        FR: "https://www.zalando.fr/",
        IT: "https://www.zalando.it/",
        ES: "https://www.zalando.es/",
        NL: "https://www.zalando.nl/",
        PL: "https://www.zalando.pl/",
        SE: "https://www.zalando.se/",
        GB: "https://www.zalando.co.uk/",
      },
    },
    {
      name: "Decathlon",
      url: "https://www.decathlon.com/",
      aliases: ["decathlon"],
      urls: {
        IN: "https://www.decathlon.in/",
        FR: "https://www.decathlon.fr/",
        DE: "https://www.decathlon.de/",
        GB: "https://www.decathlon.co.uk/",
        ES: "https://www.decathlon.es/",
        IT: "https://www.decathlon.it/",
      },
    },
    {
      name: "Best Buy",
      url: "https://www.bestbuy.com/",
      aliases: ["best buy", "bestbuy"],
      urls: { CA: "https://www.bestbuy.ca/" },
    },
    {
      name: "Mercado Libre",
      url: "https://www.mercadolibre.com/",
      aliases: ["mercado libre", "mercadolibre", "mercado livre", "mercadolivre"],
      urls: {
        MX: "https://www.mercadolibre.com.mx/",
        BR: "https://www.mercadolivre.com.br/",
      },
    },
    {
      name: NAMES.shopee,
      url: "https://shopee.com/",
      aliases: ["shopee"],
      urls: {
        ID: "https://shopee.co.id/",
        SG: "https://shopee.sg/",
        MY: "https://shopee.com.my/",
        TH: "https://shopee.co.th/",
        PH: "https://shopee.ph/",
        VN: "https://shopee.vn/",
        BR: "https://shopee.com.br/",
      },
    },
    {
      name: NAMES.lazada,
      url: "https://www.lazada.com/",
      aliases: ["lazada"],
      urls: {
        ID: "https://www.lazada.co.id/",
        SG: "https://www.lazada.sg/",
        MY: "https://www.lazada.com.my/",
        TH: "https://www.lazada.co.th/",
        PH: "https://www.lazada.com.ph/",
        VN: "https://www.lazada.vn/",
      },
    },
    { name: "Uber Eats", url: "https://www.ubereats.com/", aliases: ["uber eats", "ubereats"] },
    { name: "Uber", url: "https://www.uber.com/", aliases: ["uber"] },
    { name: "DoorDash", url: "https://www.doordash.com/", aliases: ["doordash", "door dash"] },
    {
      name: "Deliveroo",
      url: "https://deliveroo.co.uk/",
      aliases: ["deliveroo"],
      urls: {
        FR: "https://deliveroo.fr/",
        IT: "https://deliveroo.it/",
        AE: "https://deliveroo.ae/",
        SG: "https://deliveroo.com.sg/",
      },
    },
    {
      name: "Booking.com",
      url: "https://www.booking.com/",
      aliases: ["booking.com", "booking com", "bookingcom"],
    },
    {
      name: "Expedia",
      url: "https://www.expedia.com/",
      aliases: ["expedia"],
      urls: {
        GB: "https://www.expedia.co.uk/",
        DE: "https://www.expedia.de/",
        FR: "https://www.expedia.fr/",
        CA: "https://www.expedia.ca/",
        AU: "https://www.expedia.com.au/",
      },
    },
    { name: "Agoda", url: "https://www.agoda.com/", aliases: ["agoda"] },
    { name: "Airbnb", url: "https://www.airbnb.com/", aliases: ["airbnb", "air bnb"] },
    { name: "Ryanair", url: "https://www.ryanair.com/", aliases: ["ryanair", "ryan air"] },
    { name: "easyJet", url: "https://www.easyjet.com/", aliases: ["easyjet", "easy jet"] },
    { name: "Emirates", url: "https://www.emirates.com/", aliases: ["emirates"] },
    { name: "Qatar Airways", url: "https://www.qatarairways.com/", aliases: ["qatar airways"] },
    {
      name: "Ticketmaster",
      url: "https://www.ticketmaster.com/",
      aliases: ["ticketmaster", "ticket master"],
      urls: {
        GB: "https://www.ticketmaster.co.uk/",
        DE: "https://www.ticketmaster.de/",
        AU: "https://www.ticketmaster.com.au/",
        CA: "https://www.ticketmaster.ca/",
        FR: "https://www.ticketmaster.fr/",
        ES: "https://www.ticketmaster.es/",
        NL: "https://www.ticketmaster.nl/",
        MX: "https://www.ticketmaster.com.mx/",
      },
    },
    {
      name: "Adobe",
      url: "https://www.adobe.com/",
      aliases: ["adobe", "photoshop", "lightroom", "illustrator", "acrobat", "creative cloud"],
      subscription: true,
      urls: {
        IN: ADOBE("in"),
        GB: ADOBE("uk"),
        DE: ADOBE("de"),
        FR: ADOBE("fr"),
        JP: ADOBE("jp"),
        AU: ADOBE("au"),
        CA: ADOBE("ca"),
        BR: ADOBE("br"),
      },
    },
    {
      name: "Spotify",
      url: "https://www.spotify.com/premium/",
      aliases: ["spotify"],
      subscription: true,
      urls: {
        IN: SPOTIFY("in-en"),
        US: SPOTIFY("us"),
        GB: SPOTIFY("uk"),
        DE: SPOTIFY("de"),
        FR: SPOTIFY("fr"),
        BR: SPOTIFY("br-pt"),
        JP: SPOTIFY("jp"),
        AU: SPOTIFY("au"),
        CA: SPOTIFY("ca-en"),
      },
    },
    {
      name: "Netflix",
      url: "https://www.netflix.com/",
      aliases: ["netflix"],
      subscription: true,
      urls: { IN: "https://www.netflix.com/in/" },
    },
    {
      name: "Disney+",
      url: "https://www.disneyplus.com/",
      aliases: ["disney plus", "disney+", "disneyplus"],
      subscription: true,
    },
    { name: "Hulu", url: "https://www.hulu.com/", aliases: ["hulu"], subscription: true },
    {
      name: "HBO Max",
      url: "https://www.hbomax.com/",
      aliases: ["hbo max", "hbomax", "hbo"],
      subscription: true,
    },
    {
      name: "Paramount+",
      url: "https://www.paramountplus.com/",
      aliases: ["paramount plus", "paramount+"],
      subscription: true,
    },
    {
      name: "Apple TV+",
      url: "https://www.apple.com/apple-tv-plus/",
      aliases: ["apple tv plus", "apple tv+", "apple tv"],
      subscription: true,
    },
    {
      name: "Apple Music",
      url: "https://www.apple.com/apple-music/",
      aliases: ["apple music"],
      subscription: true,
    },
    {
      name: "iCloud",
      url: "https://www.apple.com/icloud/",
      aliases: ["icloud"],
      subscription: true,
    },
    {
      name: "YouTube Premium",
      url: "https://www.youtube.com/premium",
      aliases: ["youtube premium", "youtube music", "yt premium", "yt music", "youtube"],
      subscription: true,
    },
    {
      name: "Google One",
      url: "https://one.google.com/",
      aliases: ["google one", "google drive storage"],
      subscription: true,
    },
    {
      name: "Microsoft 365",
      url: "https://www.microsoft.com/microsoft-365",
      aliases: ["microsoft 365", "office 365", "ms office", "microsoft office"],
      subscription: true,
    },
    {
      name: "LinkedIn Premium",
      url: "https://www.linkedin.com/premium/",
      aliases: ["linkedin"],
      subscription: true,
    },
    {
      name: "Canva",
      url: "https://www.canva.com/pricing/",
      aliases: ["canva"],
      subscription: true,
    },
    {
      name: "Duolingo",
      url: "https://www.duolingo.com/super",
      aliases: ["duolingo"],
      subscription: true,
    },
    { name: "Babbel", url: "https://www.babbel.com/", aliases: ["babbel"], subscription: true },
    {
      name: "NordVPN",
      url: "https://nordvpn.com/",
      aliases: ["nordvpn", "nord vpn"],
      subscription: true,
    },
    {
      name: "ExpressVPN",
      url: "https://www.expressvpn.com/",
      aliases: ["expressvpn", "express vpn"],
      subscription: true,
    },
    {
      name: "Surfshark",
      url: "https://surfshark.com/",
      aliases: ["surfshark"],
      subscription: true,
    },
    {
      name: "Norton",
      url: "https://us.norton.com/",
      aliases: ["norton", "antivirus", "anti-virus"],
      subscription: true,
    },
    {
      name: "Dropbox",
      url: "https://www.dropbox.com/plans",
      aliases: ["dropbox"],
      subscription: true,
    },
    { name: "Tinder", url: "https://tinder.com/", aliases: ["tinder"], subscription: true },
    { name: "Bumble", url: "https://bumble.com/", aliases: ["bumble"], subscription: true },
    {
      name: "Audible",
      url: "https://www.audible.com/",
      aliases: ["audible"],
      subscription: true,
      urls: {
        GB: "https://www.audible.co.uk/",
        DE: "https://www.audible.de/",
        FR: "https://www.audible.fr/",
        IN: "https://www.audible.in/",
        AU: "https://www.audible.com.au/",
        CA: "https://www.audible.ca/",
        JP: "https://www.audible.co.jp/",
      },
    },
    {
      name: "Xbox Game Pass",
      url: "https://www.xbox.com/xbox-game-pass",
      aliases: ["xbox game pass", "game pass"],
      subscription: true,
    },
    {
      name: "PlayStation Plus",
      url: "https://www.playstation.com/ps-plus/",
      aliases: ["playstation plus", "ps plus"],
      subscription: true,
    },
    {
      name: "The New York Times",
      url: "https://www.nytimes.com/subscription",
      aliases: ["new york times", "nytimes", "nyt"],
      subscription: true,
    },
    {
      name: "Peloton",
      url: "https://www.onepeloton.com/",
      aliases: ["peloton"],
      subscription: true,
    },
  ],
};
