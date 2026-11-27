import { isTypoOf } from "./fuzzy.ts";
import type { Category, GlobalCategory, NationalCategory } from "./types.ts";

export const NATIONAL_CATEGORIES = [
  "food_delivery",
  "electronics",
  "fashion",
  "general",
  "travel",
  "movies_events",
  "telecom",
  "home",
] as const satisfies readonly NationalCategory[];

export const GLOBAL_CATEGORIES = [
  "subscriptions",
  "streaming",
  "music",
  "software",
  "security",
  "cloud",
  "dating",
  "fitness",
  "gaming",
  "learning",
  "news",
] as const satisfies readonly GlobalCategory[];

const SIGN_UP_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  ...GLOBAL_CATEGORIES,
  "telecom",
]);

const SHOP_CATEGORIES: ReadonlySet<Category | null> = new Set<Category | null>([
  null,
  "general",
  "electronics",
  "fashion",
  "home",
]);

export function isShopCategory(category: Category | null): boolean {
  return SHOP_CATEGORIES.has(category);
}

export function isSignUpCategory(category: Category | null): boolean {
  return category !== null && SIGN_UP_CATEGORIES.has(category);
}

interface Words {
  category: Category;
  /** Phrases, read as they are. */
  phrases: RegExp;
  /** Single words, which are also matched through small typos. */
  words: readonly string[];
}

/** Checked in this order, so "phone plan" is a mobile plan before it is a phone. */
const VOCABULARY: readonly Words[] = [
  {
    category: "telecom",
    phrases:
      /\b(sim[- ]only|sim (card|plan)|(mobile|phone|cell|cellphone|data|internet|wifi|wi-fi|fib(er|re)) (plans?|contract|deal|tariff)|plano de (celular|internet)|tarif mobile|plan de (datos|celular)|paket data)\b/i,
    words: ["broadband", "postpaid", "prepaid", "fiber", "fibre", "handyvertrag", "forfait"],
  },
  {
    category: "music",
    phrases: /\b(music (streaming|subscription|plan|app)|audiobooks?)\b/i,
    words: [],
  },
  {
    category: "streaming",
    phrases: /\b(ott|tv streaming|movie streaming|streaming (service|subscription|plan|app))\b/i,
    words: ["streaming"],
  },
  {
    category: "security",
    phrases: /\bvpn\b/i,
    words: ["antivirus", "anti-virus", "vpn"],
  },
  {
    category: "cloud",
    phrases: /\b(cloud storage|online storage|storage plan|backup plan)\b/i,
    words: [],
  },
  {
    category: "dating",
    phrases: /\bdating\b/i,
    words: ["dating"],
  },
  {
    category: "fitness",
    phrases: /\b(gym|fitness) (membership|subscription|plan|app)\b/i,
    words: ["gym"],
  },
  {
    category: "gaming",
    phrases: /\b(game pass|games? subscription|gaming subscription)\b/i,
    words: [],
  },
  {
    category: "learning",
    phrases: /\b(language (learning|app)|online course|learning app)\b/i,
    words: [],
  },
  {
    category: "news",
    phrases: /\b(news(paper)? (subscription|plan)|digital subscription)\b/i,
    words: ["newspaper"],
  },
  {
    category: "software",
    phrases: /\b(photo editing|video editing|design software|note[- ]taking app)\b/i,
    words: ["software", "saas"],
  },
  {
    category: "travel",
    phrases:
      /\b(bus tickets?|train tickets?|holiday package|round trip|one[- ]way|car rental|rent a car|near me hotel|billet d'avion|passagens? aereas?|tiket pesawat)\b/i,
    words: [
      "flight",
      "flights",
      "flite",
      "fly",
      "airfare",
      "airline",
      "train",
      "trains",
      "hotel",
      "hotels",
      "hostel",
      "resort",
      "vacation",
      "holiday",
      "flug",
      "fluge",
      "vuelo",
      "vuelos",
      "voo",
      "voos",
      "vol",
      "vols",
      "hotal",
    ],
  },
  {
    category: "movies_events",
    phrases:
      /\b((movie|film|cinema|concert|gig|show|match|play|game|theat(er|re)|event|festival|football|stadium) tickets?|tickets? (for|to) (a |the )?(movie|film|concert|show|match|game|festival))\b/i,
    words: [
      "movie",
      "movies",
      "cinema",
      "concert",
      "concerts",
      "gig",
      "tickets",
      "konzertkarten",
      "ingressos",
      "entradas",
      "kinokarten",
    ],
  },
  {
    category: "food_delivery",
    phrases:
      /\b(order food|food delivery|takeaway|take-?out|lieferservice|essen bestellen|pesan makanan|delivery de comida|commander à manger)\b/i,
    words: [
      "pizza",
      "pizzas",
      "burger",
      "burgers",
      "biryani",
      "sushi",
      "lunch",
      "dinner",
      "restaurant",
      "noodles",
      "momos",
      "thali",
      "dosa",
      "shawarma",
    ],
  },
  {
    category: "electronics",
    phrases:
      /\b(ordinateur portable|charging cable|power ?banks?|washing machine|air fryer|55 inch|smart ?tv|game console)\b/i,
    words: [
      "earphones",
      "earbuds",
      "headphones",
      "headset",
      "headfones",
      "iphone",
      "airpods",
      "smartphone",
      "phone",
      "phones",
      "laptop",
      "laptops",
      "macbook",
      "tablet",
      "ipad",
      "charger",
      "speaker",
      "camera",
      "monitor",
      "keyboard",
      "router",
      "smartwatch",
      "printer",
      "television",
      "fridge",
      "refrigerator",
      "console",
      "playstation",
      "ps5",
      "xbox",
      "nintendo",
      "tv",
      "tvs",
      "samsung",
      "galaxy",
      "pixel",
      "fernseher",
      "celular",
      "portatil",
      "ponsel",
      "handy",
      "ordinateur",
      "smartfon",
      "telefon",
    ],
  },
  {
    category: "fashion",
    phrases: /\bt-?shirts?\b/i,
    words: [
      "tshirt",
      "shirt",
      "shirts",
      "jeans",
      "trousers",
      "shoes",
      "sneakers",
      "sneaker",
      "sandals",
      "boots",
      "dress",
      "dresses",
      "kurta",
      "kurti",
      "saree",
      "jacket",
      "coat",
      "hoodie",
      "sweater",
      "handbag",
      "socks",
      "sepatu",
      "ayakkabi",
      "zapatos",
      "schuhe",
      "chaussures",
      "robe",
    ],
  },
  {
    category: "home",
    phrases: /\b(office chair|dining table|coffee table|mattress topper)\b/i,
    words: [
      "sofa",
      "couch",
      "mattress",
      "wardrobe",
      "bookshelf",
      "bookcase",
      "furniture",
      "desk",
      "chair",
      "lamp",
      "curtains",
    ],
  },
];

function wordsOf(task: string): string[] {
  return task
    .toLowerCase()
    .split(/[^\p{L}\d-]+/u)
    .filter(Boolean);
}

function typedIn(words: readonly string[], vocabulary: readonly string[]): boolean {
  return words.some((word) => vocabulary.some((known) => word === known || isTypoOf(word, known)));
}

/** A word that says what is wanted, rather than who sells it. */
export function isCategoryWord(word: string): boolean {
  return (
    typedIn(
      [word],
      VOCABULARY.flatMap(({ words }) => words),
    ) || inferCategory(word) !== null
  );
}

export function inferCategory(task: string): Category | null {
  const words = wordsOf(task);
  const entry = VOCABULARY.find(
    ({ phrases, words: known }) => phrases.test(task) || typedIn(words, known),
  );
  return entry?.category ?? null;
}
