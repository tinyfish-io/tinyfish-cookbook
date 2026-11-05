/** Calling codes by country, for the phone field of the sign-in panel. */
export const DIAL_CODES: Readonly<Record<string, string>> = {
  AE: "+971",
  AF: "+93",
  AL: "+355",
  AM: "+374",
  AR: "+54",
  AT: "+43",
  AU: "+61",
  AZ: "+994",
  BA: "+387",
  BD: "+880",
  BE: "+32",
  BG: "+359",
  BH: "+973",
  BO: "+591",
  BR: "+55",
  BY: "+375",
  CA: "+1",
  CH: "+41",
  CL: "+56",
  CN: "+86",
  CO: "+57",
  CR: "+506",
  CY: "+357",
  CZ: "+420",
  DE: "+49",
  DK: "+45",
  DO: "+1",
  DZ: "+213",
  EC: "+593",
  EE: "+372",
  EG: "+20",
  ES: "+34",
  ET: "+251",
  FI: "+358",
  FR: "+33",
  GB: "+44",
  GE: "+995",
  GH: "+233",
  GR: "+30",
  GT: "+502",
  HK: "+852",
  HR: "+385",
  HU: "+36",
  ID: "+62",
  IE: "+353",
  IL: "+972",
  IN: "+91",
  IQ: "+964",
  IR: "+98",
  IS: "+354",
  IT: "+39",
  JO: "+962",
  JP: "+81",
  KE: "+254",
  KH: "+855",
  KR: "+82",
  KW: "+965",
  KZ: "+7",
  LB: "+961",
  LK: "+94",
  LT: "+370",
  LU: "+352",
  LV: "+371",
  MA: "+212",
  MM: "+95",
  MT: "+356",
  MX: "+52",
  MY: "+60",
  NG: "+234",
  NL: "+31",
  NO: "+47",
  NP: "+977",
  NZ: "+64",
  OM: "+968",
  PA: "+507",
  PE: "+51",
  PH: "+63",
  PK: "+92",
  PL: "+48",
  PT: "+351",
  PY: "+595",
  QA: "+974",
  RO: "+40",
  RS: "+381",
  RU: "+7",
  SA: "+966",
  SE: "+46",
  SG: "+65",
  SI: "+386",
  SK: "+421",
  TH: "+66",
  TN: "+216",
  TR: "+90",
  TW: "+886",
  TZ: "+255",
  UA: "+380",
  UG: "+256",
  US: "+1",
  UY: "+598",
  UZ: "+998",
  VE: "+58",
  VN: "+84",
  ZA: "+27",
  ZW: "+263",
};

const FALLBACK = "+1";

export function visitorDialCode(country: string | null, languages: readonly string[]): string {
  const fromCountry = country ? DIAL_CODES[country] : undefined;
  if (fromCountry) return fromCountry;

  for (const language of languages) {
    const region = language.split("-")[1]?.toUpperCase();
    const code = region ? DIAL_CODES[region] : undefined;
    if (code) return code;
  }
  return FALLBACK;
}

export interface DialChoice {
  code: string;
  label: string;
}

export function dialChoices(): DialChoice[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return Object.entries(DIAL_CODES)
    .map(([country, code]) => ({ code, label: `${names.of(country) ?? country} ${code}` }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
}
