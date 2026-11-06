import { Link } from "react-router-dom";

const steps = [
  {
    title: "Break it down",
    text: "AI turns your claim into focused search queries covering the who, what, where and when.",
  },
  {
    title: "Search the web",
    text: "Those queries run against the live web to find pages that report on the claim.",
  },
  {
    title: "Read and rank sources",
    text: "Pages are split into passages and ranked by relevance and by how trustworthy the source is. Official sources come first.",
  },
  {
    title: "Judge and verify",
    text: "The AI weighs the evidence. Then plain code checks that every quote it cites really appears in the source page.",
  },
];

const features = [
  {
    title: "Evidence-first verdicts",
    text: "Supported, Refuted, Insufficient evidence or Unverified, with a consensus score and a plain-language explanation.",
  },
  {
    title: "Verified quotes",
    text: "Each quote is checked against the fetched page. If the text isn't in the source, it is thrown out.",
  },
  {
    title: "Claim breakdown",
    text: "See which parts of a claim hold up, which are misleading, and which are contradicted.",
  },
  {
    title: "Source tiers",
    text: "Official and established sources outrank unclassified or low-priority ones.",
  },
  {
    title: "English, हिंदी and Hinglish",
    text: "Claims are language-detected automatically, and every report can be read in English or Hindi.",
  },
  {
    title: "Community Fact-Checks",
    text: "Past analyses appear in a shared feed, so you can see what others are checking.",
  },
];

const uses = [
  {
    title: "Forwarded messages",
    text: "Paste a WhatsApp forward or a social media post before you share it.",
  },
  {
    title: "News headlines",
    text: "Compare a surprising headline with what reliable sources actually report.",
  },
  {
    title: "Research and journalism",
    text: "Get a quick, sourced starting point, with links to the original pages.",
  },
  {
    title: "Recycled hoaxes",
    text: "TruthLens flags claims that look like old news resurfacing as if it were new.",
  },
];

export default function About() {
  return (
    <div className="about">
      <section className="about-hero">
        <div className="eyebrow">CLARITY IN A WORLD OF CLAIMS</div>
        <h1>
          Separate the signal
          <br />
          from <span>the noise.</span>
        </h1>
        <p>
          TruthLens investigates a claim against real sources and shows the
          evidence behind every verdict, so you can check the reasoning
          yourself instead of just trusting an answer.
        </p>
        <div className="about-actions">
          <Link to="/analyze" className="primary-button">
            Analyze a claim ↗
          </Link>
          <Link to="/community" className="ghost-button">
            Browse community checks
          </Link>
        </div>
      </section>

      <section className="about-section">
        <div className="kicker">HOW IT WORKS</div>
        <h2>From a claim to a sourced verdict</h2>
        <ol className="about-steps">
          {steps.map((step, index) => (
            <li key={step.title} className="card">
              <span className="step-number mono">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="about-section">
        <div className="kicker">WHAT YOU GET</div>
        <h2>Built to show its work</h2>
        <div className="about-grid">
          {features.map((feature) => (
            <article key={feature.title} className="card">
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="kicker">HOW YOU CAN USE IT</div>
        <h2>Check before you believe or share</h2>
        <div className="about-grid two">
          {uses.map((use) => (
            <article key={use.title} className="card">
              <h3>{use.title}</h3>
              <p>{use.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-note">
        <div className="kicker accent">GOOD TO KNOW</div>
        <p>
          TruthLens is an aid, not a final judge. Results come from an AI model
          and the sources it can find, so they can be wrong, especially for
          breaking news or niche topics. The consensus score shows how much the
          verified evidence agrees. It is not the probability that a claim is
          true. Always open the original sources.
        </p>
        <Link to="/analyze" className="primary-button">
          Check a claim ↗
        </Link>
      </section>
    </div>
  );
}
