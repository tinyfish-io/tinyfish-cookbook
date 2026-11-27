import type { Extracted } from "../job";

export interface RuleInput {
  title: string; // best title we have (search result or page title)
  text: string; // page text from Fetch
  company?: string | null; // from a board feed: authoritative
  companyHint?: string | null; // prettified URL slug: a weaker signal
  location?: string | null; // from board feed, if known
}

const INTERN_RE = /\b(intern|internship|co-?op|apprentice(ship)?)\b/i;
const NEW_GRAD_RE = /\b(new[\s-]grad(uate)?|university grad(uate)?|early[\s-]career|entry[\s-]level|graduate (program|engineer|software))\b/i;
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|lead|director|manager|head of|vp)\b/i;

/** Title explicitly says experienced ("Senior", "Staff", "Director"…) — safe to skip before reading. */
export function isClearlySenior(title: string): boolean {
  return SENIOR_RE.test(title) && !INTERN_RE.test(title) && !NEW_GRAD_RE.test(title);
}

export function seniorityOf(title: string, text = ""): Extracted["seniority"] {
  if (INTERN_RE.test(title)) return "internship";
  if (NEW_GRAD_RE.test(title)) return "new_grad";
  if (SENIOR_RE.test(title)) return "other";
  const head = text.slice(0, 1500);
  if (INTERN_RE.test(head)) return "internship";
  if (NEW_GRAD_RE.test(head)) return "new_grad";
  return "other";
}

// Order matters: explicit refusals are checked before offers.
const VISA_NO = [
  /\b(not|unable to|cannot|can't|won't|will not|does not|do not|is not able to)\s+(currently\s+)?(provide|offer|sponsor|support|consider)\b[^.]{0,60}\b(sponsor\w*|visa)/i,
  /\bwithout (the need for )?(current or future |now or in the future )?(employer[\s-])?(visa )?sponsorship/i,
  /\bsponsorship (is )?not (available|provided|offered)/i,
  /\bno (visa )?sponsorship\b/i,
];
const VISA_YES = [
  /\b(will|can|able to|do|does|we)\s+(provide|offer|sponsor)\b[^.]{0,40}\b(visa|sponsorship|h-?1b)/i,
  /\b(visa )?sponsorship (is )?(available|provided|offered)/i,
  /\bopen to sponsor/i,
];

export function visaOf(text: string): Extracted["visa"] {
  if (VISA_NO.some((re) => re.test(text))) return "no_sponsorship";
  if (VISA_YES.some((re) => re.test(text))) return "sponsors";
  return "unknown";
}

export function workplaceOf(title: string, location: string | null, text: string): Extracted["workplace"] {
  const hay = `${title} ${location ?? ""}`;
  if (/\bhybrid\b/i.test(hay) || /#LI-Hybrid/i.test(text)) return "hybrid";
  if (/\bremote\b/i.test(hay) || /#LI-Remote/i.test(text)) return "remote";
  if (/#LI-Onsite/i.test(text) || /\b(on-?site|in[\s-]office|work (out of|from) our [\w\s,]*office)/i.test(text)) return "onsite";
  if (/\bvirtual[\s-]first\b|\bfully remote\b/i.test(text)) return "remote";
  return "unknown";
}

export function termOf(title: string, text: string): string | null {
  const re = /\b(summer|fall|autumn|winter|spring)\s*(?:\/\s*\w+\s*)?(20\d\d)\b/i;
  const m = re.exec(title) ?? re.exec(text.slice(0, 3000));
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}` : null;
}

export function gradYearsOf(text: string): number[] {
  const years = new Set<number>();
  for (const m of text.matchAll(/graduat\w*[^.]{0,100}/gi)) {
    for (const y of m[0].matchAll(/\b(20[2-3]\d)\b/g)) years.add(Number(y[1]));
  }
  return [...years].sort();
}

const MONEY = String.raw`\$\s?\d[\d,]*(?:\.\d+)?\s?[kK]?`;
const PAY_RE = new RegExp(
  String.raw`${MONEY}(?:\s*(?:-|–|—|to)\s*${MONEY})?(?:\s*(?:USD|CAD))?(?:\s*(?:\/|per|an?)\s*(?:hr|hour|year|yr|month|mo|annum|week))?`,
  "g",
);

export function payOf(text: string): string | null {
  const matches = [...text.matchAll(PAY_RE)].map((m) => m[0].trim());
  // Prefer amounts that carry a unit or are a range — bare "$5" mentions are usually noise.
  const good = matches.find((m) => /\/|per|hour|year|month|week|annum|–|—|-|to/i.test(m.replace(/^\$\s?\d[\d,]*/, "")));
  if (!good) return null;
  // Boards often emit a degenerate range ("$62—$62 USD"); show it as one amount.
  return good.replace(/\s+/g, " ").replace(/^(\$\s?[\d,.]+[kK]?)\s*(?:-|–|—|to)\s*\1(?![\d,.])/, "$1");
}

// "City, ST" / "City, Country" / "Remote - US" style lines near the top of the page.
const LOCATION_LINE =
  /^(?:[*\-•]\s*)?((?:Remote(?:\s*[-–—(]\s*[\w\s:]+\)?)?)|(?:[A-Z][\w .'-]+,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z ]+)(?:,\s*[A-Z][a-zA-Z ]+)?))\s*$/m;

export function locationOf(text: string): string | null {
  const m = LOCATION_LINE.exec(text.slice(0, 1500));
  return m ? m[1].trim() : null;
}

const ROLE_WORD = /engineer|developer|scientist|analyst|designer|intern|co-?op|manager|product|research/i;
// A dash-separated side that is really a location/term, not a company ("Remote - US", "San Francisco, CA").
const NOT_COMPANY = /remote|hybrid|summer|fall|winter|spring|20\d\d|,|\bUS\b/i;

/** Pull the company out of common ATS title formats and strip it from the title. */
export function splitTitle(raw: string): { title: string; company: string | null; via?: "at" | "dash" } {
  const t = raw
    .trim()
    .replace(/\s+-\s+Myworkdayjobs\.com$/i, "")
    .replace(/^\[(.+?)\]\s*/, "$1 ");
  let m: RegExpExecArray | null;
  if ((m = /^Job Application for (.+?) at (.+)$/i.exec(t))) return { title: m[1].trim(), company: m[2].trim(), via: "at" };
  if ((m = /^(.+?)\s+@\s+(.+)$/.exec(t))) return { title: m[1].trim(), company: m[2].trim(), via: "at" };

  // "Company - Title" (Lever) or "Title - Company": the side with a role word is the title.
  const parts = t.split(/\s+[-–—|]\s+/);
  if (parts.length === 2) {
    const [a, b] = parts.map((s) => s.trim());
    if (ROLE_WORD.test(a) && !ROLE_WORD.test(b) && !NOT_COMPANY.test(b)) return { title: a, company: b, via: "dash" };
    if (ROLE_WORD.test(b) && !ROLE_WORD.test(a) && !NOT_COMPANY.test(a)) return { title: b, company: a, via: "dash" };
  }
  return { title: t, company: null };
}

export function prettySlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Loose match between a title-derived name and a URL slug ("Palantir Technologies" ~ "palantir"). */
export function sameCompany(a: string, b: string): boolean {
  const x = squash(a);
  const y = squash(b);
  return x.length > 1 && y.length > 1 && (x.includes(y.slice(0, 4)) || y.includes(x.slice(0, 4)));
}

export function extractWithRules(input: RuleInput): Extracted {
  let split = splitTitle(input.title);
  // A dash-suffix is often a team or place ("…, Internship - Commercial", "… - TOR", "… - Team
  // Gringotts North"), not the company. Unless it matches the company we already know from the board
  // or URL, keep the title whole. "@ Company" / "at Company" titles are reliable and stay split.
  const known = input.company ?? input.companyHint;
  if (split.via === "dash" && known && !sameCompany(split.company!, known)) {
    split = { title: input.title.trim(), company: null };
  }
  const location = input.location ?? locationOf(input.text);
  return {
    title: split.title,
    company: input.company ?? split.company ?? input.companyHint ?? null,
    location,
    workplace: workplaceOf(split.title, location, input.text),
    seniority: seniorityOf(split.title, input.text),
    term: termOf(split.title, input.text),
    gradYears: gradYearsOf(input.text),
    pay: payOf(input.text),
    visa: visaOf(input.text),
    skills: [],
    summary: null,
  };
}
