import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGreenhouseFeed, parseLeverBoard } from "./boards";
import { titleMatches } from "./pipeline";
import type { Preferences } from "./types";

test("parseGreenhouseFeed strips the ``` fence Fetch adds", () => {
  const text = '```\n{"jobs":[{"absolute_url":"https://careers.roblox.com/jobs/1?gh_jid=1","title":"Software Engineer Intern","location":{"name":"San Mateo, CA"},"company_name":"Roblox"}]}\n```';
  const [job] = parseGreenhouseFeed(text, "roblox");
  assert.equal(job.title, "Software Engineer Intern");
  assert.equal(job.location, "San Mateo, CA");
  assert.equal(job.companyName, "Roblox");
  assert.equal(job.foundBy, "board");
  assert.deepEqual(parseGreenhouseFeed("not json", "x"), []);
});

test("parseGreenhouseFeed undoes markdown escapes Fetch sometimes adds", () => {
  const text = '{"jobs":[{"absolute\\_url":"https://boards.greenhouse.io/figma/jobs/1","title":"Software Engineer Intern","company\\_name":"Figma"}]}';
  const [job] = parseGreenhouseFeed(text, "figma");
  assert.equal(job.url, "https://boards.greenhouse.io/figma/jobs/1");
  assert.equal(job.companyName, "Figma");
});

test("parseLeverBoard reads title, location and workplace from .posting blocks", () => {
  const html =
    '<div class="posting" data-qa-posting-id="a"><a class="posting-title" href="https://jobs.lever.co/palantir/a"><h5 data-qa="posting-name">Software Engineer, Internship</h5><div class="posting-categories"><span class="display-inline-block small-category-label workplaceTypes" href="#">On-site — </span><span class="sort-by-location posting-category small-category-label location" href="#">New York, NY</span></div></a></div>';
  const [job] = parseLeverBoard(html, "palantir");
  assert.equal(job.url, "https://jobs.lever.co/palantir/a");
  assert.equal(job.title, "Software Engineer, Internship");
  assert.equal(job.location, "On-site · New York, NY");
});

test("titleMatches keeps relevant board roles only", () => {
  const prefs: Preferences = { role: "software engineer", locations: [], seniority: "internship", keywords: [], needsVisa: false, companies: [] };
  assert.equal(titleMatches("Software Engineering Intern", prefs), true);
  assert.equal(titleMatches("Senior Software Engineer", prefs), false);
  assert.equal(titleMatches("Marketing Intern", prefs), false);
  assert.equal(titleMatches("Marketing Intern", { ...prefs, role: "marketing" }), true);
});

test("pickToRead shares slots across companies and leaves room for search", async () => {
  const { pickToRead } = await import("./pipeline");
  const mk = (company: string, n: number, foundBy: "board" | "search") =>
    Array.from({ length: n }, (_, i) => ({ url: `https://x.io/${company}/${i}`, title: "t", snippet: "", ats: "other" as const, company, foundBy }));
  const picked = pickToRead([...mk("palantir", 30, "board"), ...mk("figma", 2, "board")], mk("s", 10, "search"), 10);
  assert.equal(picked.length, 10);
  assert.equal(picked.filter((c) => c.company === "figma").length, 2);
  assert.equal(picked.filter((c) => c.foundBy === "search").length, 5);
});
