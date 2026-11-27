import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFirecrawlTitle } from "./firecrawl";

test("cleanFirecrawlTitle strips the site-name suffix Firecrawl appends", () => {
  assert.equal(cleanFirecrawlTitle("Software Engineer Intern (Winter 2027) @ Zip - Jobs"), "Software Engineer Intern (Winter 2027) @ Zip");
  assert.equal(cleanFirecrawlTitle("Job Application for Software Engineer Intern at Cresta - Greenhouse"), "Job Application for Software Engineer Intern at Cresta");
  assert.equal(cleanFirecrawlTitle("Software Engineer II, Full Stack, Toronto | Pinterest Careers"), "Software Engineer II, Full Stack, Toronto");
  // A dash that's part of the title stays.
  assert.equal(cleanFirecrawlTitle("Software Engineer, Intern (Summer 2027) - TOR"), "Software Engineer, Intern (Summer 2027) - TOR");
});
