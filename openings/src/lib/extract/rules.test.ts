import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWithRules, gradYearsOf, payOf, seniorityOf, splitTitle, termOf, visaOf, workplaceOf } from "./rules";

test("splitTitle handles the ATS title formats seen in Search results", () => {
  const split = (t: string) => {
    const { title, company } = splitTitle(t);
    return { title, company };
  };
  assert.deepEqual(split("Software Engineer Intern (Summer 2027) @ Notion"), {
    title: "Software Engineer Intern (Summer 2027)",
    company: "Notion",
  });
  assert.deepEqual(split("Job Application for Software Engineering Intern at Garner Health"), {
    title: "Software Engineering Intern",
    company: "Garner Health",
  });
  assert.deepEqual(split("Weekday - Software Engineer Intern"), { title: "Software Engineer Intern", company: "Weekday" });
  assert.deepEqual(split("Software Engineer, Internship - Palantir Technologies"), {
    title: "Software Engineer, Internship",
    company: "Palantir Technologies",
  });
  // Location/term suffixes are not companies.
  assert.equal(splitTitle("Software Engineering Intern (Summer 2027), Remote - US").company, null);
  assert.equal(splitTitle("Software Engineer Intern, Hybrid - San Francisco, CA").company, null);
  assert.equal(splitTitle("Software Engineering Intern - Myworkdayjobs.com").title, "Software Engineering Intern");
  assert.equal(splitTitle("[Summer 2027] Software Engineer Intern").title, "Summer 2027 Software Engineer Intern");
});

test("seniorityOf reads the title first", () => {
  assert.equal(seniorityOf("Software Engineering Co-op"), "internship");
  assert.equal(seniorityOf("Software Engineer - New Grad"), "new_grad");
  assert.equal(seniorityOf("Director, International Tax Planning"), "other");
  assert.equal(seniorityOf("Software Engineer", "This is an internship for students"), "internship");
});

test("visaOf distinguishes refusals from offers", () => {
  assert.equal(visaOf("We are unable to sponsor work visas for this role."), "no_sponsorship");
  assert.equal(visaOf("Candidates must be authorized to work without current or future visa sponsorship."), "no_sponsorship");
  assert.equal(visaOf("The company will not provide H-1B sponsorship for this position."), "no_sponsorship");
  assert.equal(visaOf("We will sponsor visas for eligible candidates."), "sponsors");
  assert.equal(visaOf("Visa sponsorship is available for this role."), "sponsors");
  assert.equal(visaOf("Python, Go, JavaScript"), "unknown");
});

test("workplaceOf uses title, location and LinkedIn tags", () => {
  assert.equal(workplaceOf("Intern", "Remote - US", ""), "remote");
  assert.equal(workplaceOf("Software Engineer Intern, Hybrid", null, ""), "hybrid");
  assert.equal(workplaceOf("Intern", "New York, NY", "... #LI-Onsite"), "onsite");
  assert.equal(workplaceOf("Intern", null, "you will need to be able to work out of our NY or SF office"), "onsite");
  assert.equal(workplaceOf("Intern", null, "nothing here"), "unknown");
});

test("termOf, gradYearsOf, payOf pull the student-relevant details", () => {
  assert.equal(termOf("Software Engineering Intern (Summer 2027)", ""), "Summer 2027");
  assert.equal(termOf("Intern", "starts in winter 2027"), "Winter 2027");
  assert.deepEqual(gradYearsOf("graduating in Fall/Winter 2027 or Spring 2028. This should be"), [2027, 2028]);
  assert.deepEqual(gradYearsOf("Must graduate before Summer 2028."), [2028]);
  assert.equal(payOf("the estimated hourly range for this role is $57/hr for Bachelors"), "$57/hr");
  assert.equal(payOf("US Pay Range\n\n$9,000—$10,000 USD"), "$9,000—$10,000 USD");
  assert.equal(payOf("The hourly pay range for this internship is $32–$46 per hour"), "$32–$46 per hour");
  assert.equal(payOf("We raised $5 at a bake sale"), null);
  assert.equal(payOf("Hourly Pay\n$62—$62 USD"), "$62 USD");
  assert.equal(payOf("$46 - $46 USD"), "$46 USD");
});

test("extractWithRules keeps team suffixes when the company is known", () => {
  const job = extractWithRules({ title: "Forward Deployed Software Engineer, Internship - Commercial", company: "Palantir", text: "" });
  assert.equal(job.company, "Palantir");
  assert.equal(job.title, "Forward Deployed Software Engineer, Internship - Commercial");
});

test("extractWithRules ignores dash-suffixes that aren't the company in the URL", () => {
  const tor = extractWithRules({ title: "Software Engineer, Intern (Summer 2027) - TOR", companyHint: "Wealthsimple", text: "" });
  assert.equal(tor.company, "Wealthsimple");
  assert.equal(tor.title, "Software Engineer, Intern (Summer 2027) - TOR");
  const team = extractWithRules({ title: "Intern, Mobile Software Engineer - Team Gringotts North", companyHint: "Capitalone", text: "" });
  assert.equal(team.company, "Capitalone");
  // Matching suffix is still split off.
  const pal = extractWithRules({ title: "Software Engineer, Internship - Palantir Technologies", companyHint: "Palantir", text: "" });
  assert.equal(pal.company, "Palantir Technologies");
  assert.equal(pal.title, "Software Engineer, Internship");
  // "@ Company" is trusted even without a hint.
  assert.equal(extractWithRules({ title: "Software Engineer Intern @ Zip", text: "" }).company, "Zip");
});

test("extractWithRules on a Dropbox-like posting", () => {
  const job = extractWithRules({
    title: "Software Engineering Intern (Summer 2027), Remote - US",
    company: "Dropbox",
    text: [
      "# Software Engineering Intern (Summer 2027)",
      "* Remote - US: All locations",
      "Currently pursuing a BS or MS in Computer Science, graduating in Fall/Winter 2027 or Spring 2028.",
      "US Pay Range",
      "$9,000—$10,000 USD",
    ].join("\n"),
  });
  assert.equal(job.company, "Dropbox");
  assert.equal(job.seniority, "internship");
  assert.equal(job.workplace, "remote");
  assert.equal(job.term, "Summer 2027");
  assert.deepEqual(job.gradYears, [2027, 2028]);
  assert.equal(job.pay, "$9,000—$10,000 USD");
  assert.equal(job.visa, "unknown");
});
