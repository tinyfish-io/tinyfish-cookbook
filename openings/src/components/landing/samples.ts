/**
 * Real results from Openings scans run during development (2026-09-29), used to illustrate the
 * landing page. Every value here was produced by the pipeline and spot-checked against the posting.
 */
export interface SampleJob {
  company: string;
  title: string;
  location: string;
  workplace: string;
  term: string | null;
  classOf: string | null;
  pay: string | null;
  visa: "sponsors" | "no_sponsorship" | "unknown";
  score: number;
  found: string;
  read: string;
  reasons: string[];
}

export const SAMPLE_JOBS: SampleJob[] = [
  {
    company: "Notion",
    title: "Software Engineer Intern",
    location: "San Francisco · New York",
    workplace: "Hybrid",
    term: "Winter 2027",
    classOf: "2027",
    pay: "$57/hr",
    visa: "unknown",
    score: 80,
    found: "TinyFish Agent",
    read: "TinyFish Fetch",
    reasons: ["Title matches", "Wants 2027 grads", "On your watchlist"],
  },
  {
    company: "Phoebe",
    title: "Software Engineering Intern",
    location: "New York City",
    workplace: "On-site",
    term: "Fall or Winter 2026",
    classOf: null,
    pay: null,
    visa: "sponsors",
    score: 75,
    found: "TinyFish Search",
    read: "TinyFish Fetch",
    reasons: ["Title matches", "Mentions python"],
  },
  {
    company: "Garner Health",
    title: "Software Engineering Intern",
    location: "New York City",
    workplace: "On-site",
    term: "Fall 2027",
    classOf: "2027/2028",
    pay: null,
    visa: "no_sponsorship",
    score: 72,
    found: "TinyFish Search",
    read: "TinyFish Fetch",
    reasons: ["Title matches", "Wants 2027 grads"],
  },
  {
    company: "Figma",
    title: "Software Engineer Intern",
    location: "San Francisco · New York",
    workplace: "On-site",
    term: "Summer 2027",
    classOf: null,
    pay: "$55/hr",
    visa: "unknown",
    score: 70,
    found: "Company board",
    read: "TinyFish Fetch",
    reasons: ["Title matches", "On your watchlist"],
  },
];

export const VISA_LABEL = {
  sponsors: "Sponsors",
  no_sponsorship: "No sponsorship",
  unknown: "Not stated",
} as const;
