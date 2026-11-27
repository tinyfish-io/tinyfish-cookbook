import { test } from "node:test";
import assert from "node:assert/strict";
import { portalRoot } from "./portals";

test("portalRoot finds the searchable root of JS-app portals", () => {
  assert.equal(portalRoot("https://jobs.ashbyhq.com/notion/3fba1c39-c5cb-47d7-9ad2-1cec4d7e9d0c"), "https://jobs.ashbyhq.com/notion");
  assert.equal(
    portalRoot("https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Intern_JR1?q=intern"),
    "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",
  );
  assert.equal(portalRoot("https://redhat.wd5.myworkdayjobs.com/jobs/job/Boston/Intern_R1"), "https://redhat.wd5.myworkdayjobs.com/jobs");
  assert.equal(portalRoot("https://job-boards.greenhouse.io/dropbox/jobs/1"), null);
  assert.equal(portalRoot("not a url"), null);
});
