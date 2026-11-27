import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupe, hardFilter, matchLocation, rankJobs, scoreJob } from "./rank";
import type { Job } from "./job";
import type { Preferences } from "./types";

let n = 0;
function job(over: Partial<Job> = {}): Job {
  n++;
  return {
    id: `id${n}`,
    applyUrl: `https://jobs.example.com/${n}`,
    ats: "greenhouse",
    foundBy: "search",
    readBy: "fetch",
    extractedBy: "llm",
    fetchedAt: "2026-09-29T00:00:00Z",
    title: "Software Engineer Intern",
    company: "Acme",
    location: "New York, NY",
    workplace: "onsite",
    seniority: "internship",
    term: "Summer 2027",
    gradYears: [],
    pay: null,
    visa: "unknown",
    skills: [],
    summary: null,
    ...over,
  };
}

const prefs: Preferences = {
  role: "software engineer",
  locations: ["New York", "Remote"],
  seniority: "internship",
  keywords: [],
  needsVisa: false,
  companies: [],
};

test("matchLocation handles aliases, remote and unknown", () => {
  assert.equal(matchLocation({ location: "NYC", workplace: "onsite" }, ["New York"]), "match");
  assert.equal(matchLocation({ location: "Brooklyn, NY", workplace: "onsite" }, ["New York"]), "match");
  assert.equal(matchLocation({ location: "Remote - US", workplace: "unknown" }, ["Remote"]), "remote");
  assert.equal(matchLocation({ location: null, workplace: "unknown" }, ["New York"]), "unknown");
  assert.equal(matchLocation({ location: "London, England", workplace: "onsite" }, ["New York", "Remote"]), "mismatch");
  // Whole-word aliases: "NY" must not match Sunnyvale, "LA" must not match Atlanta.
  assert.equal(matchLocation({ location: "Sunnyvale, CA", workplace: "onsite" }, ["New York"]), "mismatch");
  assert.equal(matchLocation({ location: "Atlanta, GA", workplace: "onsite" }, ["Los Angeles"]), "mismatch");
  assert.equal(matchLocation({ location: "Anywhere", workplace: "onsite" }, []), "match");
});

test("hardFilter drops wrong level, wrong place, refusals and wrong grad year — with reasons", () => {
  assert.match(hardFilter(job({ seniority: "other", title: "Director, Tax" }), prefs)!, /experienced role/);
  assert.match(hardFilter(job({ location: "London, England" }), prefs)!, /London/);
  assert.equal(hardFilter(job({ visa: "no_sponsorship" }), prefs), null, "visa only matters when needed");
  assert.match(hardFilter(job({ visa: "no_sponsorship" }), { ...prefs, needsVisa: true })!, /won't sponsor/);
  assert.equal(hardFilter(job({ visa: "unknown" }), { ...prefs, needsVisa: true }), null, "not stated is not no");
  assert.match(hardFilter(job({ gradYears: [2026] }), { ...prefs, gradYear: 2027 })!, /2026/, "graduating after every listed year");
  assert.equal(hardFilter(job({ gradYears: [2028] }), { ...prefs, gradYear: 2027 }), null, "'graduate before 2028' fits a 2027 grad");
  assert.equal(hardFilter(job({ gradYears: [2027, 2028] }), { ...prefs, gradYear: 2027 }), null);
  assert.equal(hardFilter(job({ gradYears: [] }), { ...prefs, gradYear: 2027 }), null, "no grad year stated stays");
  assert.equal(hardFilter(job({ location: null }), prefs), null, "unknown location stays");
});

test("dedupe keeps the most complete copy and remembers the other URLs", () => {
  const thin = job({ pay: null, applyUrl: "https://a.example/1" });
  const full = job({ pay: "$50/hr", summary: "Build things", applyUrl: "https://b.example/1" });
  const other = job({ title: "Data Engineer Intern" });
  const winter = job({ term: "Winter 2027" }); // different term = different job
  const { unique, duplicatesOf } = dedupe([thin, full, other, winter]);
  assert.equal(unique.length, 3);
  assert.ok(unique.includes(full));
  assert.deepEqual(duplicatesOf.get(full.id), ["https://a.example/1"]);
});

test("scoreJob explains itself", () => {
  const { score, reasons } = scoreJob(job({ pay: "$50/hr", gradYears: [2027], visa: "sponsors", skills: ["Python"] }), {
    ...prefs,
    keywords: ["python"],
    needsVisa: true,
    gradYear: 2027,
  }, true);
  const text = reasons.map((r) => r.text);
  assert.ok(text.includes('Title matches "software engineer"'));
  assert.ok(text.includes("In New York, NY"));
  assert.ok(text.includes("Mentions python"));
  assert.ok(text.includes("Wants 2027 graduates"));
  assert.ok(text.includes("Sponsors visas"));
  assert.ok(text.includes("On your watchlist"));
  assert.equal(score, 35 + 20 + 5 + 10 + 10 + 5 + 3 + 2);
});

test("scoreJob marks down (but keeps) a job whose grad years may not fit", () => {
  const { reasons } = scoreJob(job({ gradYears: [2028] }), { ...prefs, gradYear: 2027 }, false);
  assert.ok(reasons.some((r) => r.kind === "minus" && /2028/.test(r.text)));
});

test("rankJobs sorts by score and reports what it filtered", () => {
  const remote = job({ location: "Remote - US", workplace: "remote", title: "Software Engineer Intern" });
  const partial = job({ title: "Data Engineer Intern" });
  const senior = job({ seniority: "other", title: "Senior Software Engineer" });
  const figma = job({ company: "Figma", applyUrl: "https://boards.greenhouse.io/figma/jobs/9" });
  const { jobs, filtered, counts } = rankJobs([partial, senior, remote, figma], prefs, new Set(["figma"]));
  assert.deepEqual(counts, { extracted: 4, unique: 4, filtered: 1, kept: 3 });
  assert.equal(filtered[0].title, "Senior Software Engineer");
  assert.equal(jobs[0].company, "Figma"); // full title match + location + watchlist
  assert.ok(jobs[0].onWatchlist);
  assert.equal(jobs.at(-1)!.title, "Data Engineer Intern");
});
