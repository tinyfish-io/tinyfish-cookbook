import type { Ats } from "./types";

const PATTERNS: { ats: Ats; re: RegExp }[] = [
  { ats: "greenhouse", re: /^(?:job-boards|boards)\.greenhouse\.io\/(?:embed\/job_app\?for=)?([^/?#]+)/ },
  { ats: "lever", re: /^jobs\.lever\.co\/([^/?#]+)/ },
  { ats: "ashby", re: /^jobs\.ashbyhq\.com\/([^/?#]+)/ },
  { ats: "workday", re: /^([^.]+)\.wd\d+\.myworkdayjobs\.com/ },
];

/** Identify which ATS hosts a URL and, when possible, the company's board slug. */
export function classifyUrl(raw: string): { ats: Ats; company: string | null } {
  let hostPath: string;
  try {
    const u = new URL(raw);
    hostPath = u.hostname.replace(/^www\./, "") + u.pathname + u.search;
  } catch {
    return { ats: "other", company: null };
  }
  for (const { ats, re } of PATTERNS) {
    const m = re.exec(hostPath);
    if (m) return { ats, company: m[1].toLowerCase() };
  }
  return { ats: "other", company: null };
}

/** Where to read a company's full list of openings, per ATS. */
export function boardUrl(ats: Ats, company: string): string | null {
  switch (ats) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`;
    case "lever":
      return `https://jobs.lever.co/${company}`;
    default:
      return null; // ashby/workday boards are JS apps -> Agent
  }
}
