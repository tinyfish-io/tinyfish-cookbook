/** The countries with national site data, listed apart so the browser need not load that data. */
export const COVERED_COUNTRIES = [
  "AE",
  "AU",
  "BR",
  "CA",
  "CN",
  "DE",
  "ES",
  "FR",
  "GB",
  "ID",
  "IN",
  "IT",
  "JP",
  "KR",
  "MX",
  "MY",
  "NL",
  "PH",
  "PL",
  "SA",
  "SG",
  "TH",
  "TR",
  "US",
  "VN",
] as const;

export const WORLDWIDE = "ZZ";
const WORLDWIDE_NAME = "Worldwide";

const COUNTRY_CODE = /^[A-Z]{2}$/;
/** Cloudflare's codes for an unknown address and for Tor. */
const NOT_A_COUNTRY = new Set(["XX", "T1"]);

const TIME_ZONE_COUNTRY: readonly (readonly [RegExp, string])[] = [
  [/^Asia\/(Kolkata|Calcutta)$/, "IN"],
  [/^Europe\/(London|Belfast)$/, "GB"],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns)$/, "CA"],
  [
    /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise)|Pacific\/Honolulu)$/,
    "US",
  ],
  [/^Australia\//, "AU"],
  [/^Europe\/Berlin$/, "DE"],
  [/^Europe\/Paris$/, "FR"],
  [/^Europe\/Madrid$/, "ES"],
  [/^Europe\/Rome$/, "IT"],
  [/^Europe\/Amsterdam$/, "NL"],
  [/^Europe\/Warsaw$/, "PL"],
  [/^Europe\/Stockholm$/, "SE"],
  [/^Europe\/Istanbul$/, "TR"],
  [/^Asia\/Tokyo$/, "JP"],
  [/^Asia\/Seoul$/, "KR"],
  [/^Asia\/(Shanghai|Urumqi)$/, "CN"],
  [/^Asia\/Singapore$/, "SG"],
  [/^Asia\/(Jakarta|Makassar|Jayapura)$/, "ID"],
  [/^Asia\/Bangkok$/, "TH"],
  [/^Asia\/(Ho_Chi_Minh|Saigon)$/, "VN"],
  [/^Asia\/Manila$/, "PH"],
  [/^Asia\/Kuala_Lumpur$/, "MY"],
  [/^Asia\/Riyadh$/, "SA"],
  [/^Asia\/Dubai$/, "AE"],
  [/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Manaus)$/, "BR"],
  [/^America\/(Mexico_City|Cancun|Monterrey|Tijuana)$/, "MX"],
  [/^Africa\/Nairobi$/, "KE"],
  [/^Africa\/Lagos$/, "NG"],
  [/^Africa\/Johannesburg$/, "ZA"],
];

const NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export interface CountrySignals {
  /** What the visitor picked on the country pill. */
  choice?: string | undefined;
  /** The `CF-IPCountry` header. */
  cloudflare?: string | undefined;
  timeZone?: string | undefined;
  languages?: readonly string[] | undefined;
}

function countryFrom(value: string | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && COUNTRY_CODE.test(code) && !NOT_A_COUNTRY.has(code) ? code : null;
}

function countryOfTimeZone(timeZone: string | undefined): string | null {
  if (!timeZone) return null;
  return TIME_ZONE_COUNTRY.find(([zone]) => zone.test(timeZone))?.[1] ?? null;
}

function countryOfLanguages(languages: readonly string[] | undefined): string | null {
  for (const language of languages ?? []) {
    const region = countryFrom(language.split("-")[1]);
    if (region) return region;
  }
  return null;
}

/** The time zone comes before the language, since many browsers keep en-US whatever the place. */
export function resolveCountry({
  choice,
  cloudflare,
  timeZone,
  languages,
}: CountrySignals): string | null {
  const chosen = countryFrom(choice);
  if (chosen) return chosen === WORLDWIDE ? null : chosen;
  return (
    countryFrom(cloudflare) ?? countryOfTimeZone(timeZone) ?? countryOfLanguages(languages) ?? null
  );
}

/**
 * The code to hand TinyFish, or null to leave it out. Its docs list a few countries, but every
 * country tried on 2 Nov 2026 browsed from there, so a run only falls back if one will not start.
 */
export function proxyCountry(country: string | null): string | null {
  return country;
}

/** Headers can be forged where Cloudflare is not in front, and this text reaches the agent. */
const PLACE_NAME = /^[\p{L}\p{M} .'-]{2,60}$/u;

/** The visitor's city from Cloudflare's location headers, for a delivery or pickup location. */
export function resolveCity(city: string | undefined, region: string | undefined): string | null {
  const place = city?.trim();
  if (!place || !PLACE_NAME.test(place)) return null;
  const area = region?.trim();
  return area && area !== place && PLACE_NAME.test(area) ? `${place}, ${area}` : place;
}

export function countryName(country: string | null): string {
  return country === null ? WORLDWIDE_NAME : (NAMES.of(country) ?? country);
}
