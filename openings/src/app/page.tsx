import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Brand } from "@/components/Brand";
import { HeroMock } from "@/components/landing/HeroMock";
import { AgentPanel, BoardPanel, SearchPanel } from "@/components/landing/FeaturePanels";
import { Panel } from "@/components/landing/Panel";
import { SAMPLE_JOBS, VISA_LABEL } from "@/components/landing/samples";

const btnPrimary = "inline-flex items-center gap-2 bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";
const btnSecondary =
  "inline-flex items-center gap-2 border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-foreground/40";
const eyebrow = "font-mono text-[11px] uppercase tracking-[0.16em] text-muted";

const FEATURES = [
  {
    id: "search",
    tool: "TinyFish Search",
    title: "Finds the doors",
    body: "One plain query per city and level, pointed only at the job systems companies actually use. It surfaces postings from companies you'd never have thought to check — not a stale aggregator's reposts.",
    link: { href: "/onboarding", label: "Set up your search" },
    proof: "~38 live postings per scan, in about 3 seconds.",
    panel: <SearchPanel />,
  },
  {
    id: "fetch",
    tool: "TinyFish Fetch",
    title: "Reads every posting — and whole boards",
    body: "Postings are read ten at a time. For the companies you watch, Openings reads their entire job board in one call, then drops senior roles and wrong cities before spending a single read.",
    link: { href: "/onboarding", label: "Add companies to watch" },
    proof: "One scan skipped 30 postings before reading — and found 3 more matches with the freed-up reads.",
    panel: <BoardPanel />,
  },
  {
    id: "agent",
    tool: "TinyFish Agent",
    title: "Opens the sites that need a real browser",
    body: "Some careers portals only work in a browser — you type into a search box and wait. With deep search on, an agent does exactly that, and you can watch it work live from your dashboard.",
    link: { href: "/onboarding", label: "Turn on deep search" },
    proof: "Found Notion's internships on their Ashby board, which plain fetching can't list.",
    panel: <AgentPanel />,
  },
];

const PRINCIPLES = [
  { eyebrow: "Visa", title: "“Not stated” is not “no”", body: "Most postings never mention visas. Those stay on your radar — “won't sponsor” is only shown when a posting actually says it." },
  { eyebrow: "Filters", title: "Nothing disappears silently", body: "Every role taken off your list comes with the reason: wrong city, wrong level, or a graduation window you've already passed." },
  { eyebrow: "Ranking", title: "Every match explains itself", body: "A score out of 100 and the reasons behind it — title fits, in your city, wants your class year, on your watchlist." },
  { eyebrow: "Reliability", title: "Built not to fall over", body: "If a search comes back empty or a page won't render, Firecrawl steps in as a backup. If the AI step is down, tested rules still answer." },
];

const FAQ = [
  {
    q: "What is Openings?",
    a: "A job radar for students. You tell it once what you want — role, internship or new grad, where, your class year, whether you need a visa — and it checks live job boards, reads every posting, and ranks what fits.",
  },
  {
    q: "Where do the jobs come from?",
    a: "The live web, every time. Openings searches Greenhouse, Lever, Ashby and Workday boards with TinyFish Search, reads postings and whole company boards with TinyFish Fetch, and uses TinyFish Agent for portals that only work in a real browser. Nothing is hardcoded.",
  },
  {
    q: "How does it know if a company sponsors visas?",
    a: "It reads the posting. Tested rules look for explicit wording, and a language model double-checks. If the posting doesn't say, you'll see “not stated” — never a guess.",
  },
  {
    q: "What does deep search do?",
    a: "It sends an agent to careers sites that only work in a real browser, like many Workday and Ashby boards. It finds more roles but takes 1–3 minutes and uses paid credits, so it's off by default.",
  },
  {
    q: "Do I need an account?",
    a: "No. Your preferences and your last scan are saved in your own browser.",
  },
];

export default function Landing() {
  return (
    <div className="flex-1 overflow-x-clip">
      <SiteHeader />

      {/* ——— Hero ——— */}
      <section className="relative">
        <div className="grid-lines pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 pb-24 pt-20 text-center sm:px-6 lg:pt-28">
          <p className={`reveal ${eyebrow}`} style={{ "--i": 0 } as React.CSSProperties}>
            The job radar for students
          </p>
          <h1
            className="reveal mx-auto mt-6 max-w-4xl text-balance font-display text-[2.6rem] leading-[1.04] sm:text-6xl lg:text-[4.6rem]"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Stop refreshing <em>careers</em> pages.
          </h1>
          <p className="reveal mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl" style={{ "--i": 2 } as React.CSSProperties}>
            Openings checks live job boards for you, reads every posting, and shows the internships and new-grad roles
            that actually fit — with the term, the pay, your class year, and whether they sponsor visas.
          </p>
          <div className="reveal mt-9 flex flex-wrap justify-center gap-3" style={{ "--i": 3 } as React.CSSProperties}>
            <Link href="/onboarding" className={btnPrimary}>
              Get started for free
            </Link>
            <Link href="#how" className={btnSecondary}>
              See how it works
            </Link>
          </div>
          <div className="reveal mt-20" style={{ "--i": 4 } as React.CSSProperties}>
            <HeroMock />
          </div>
        </div>
      </section>

      {/* ——— Wordmark strip ——— */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-5 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
          <p className={eyebrow}>Reads the job systems companies actually use</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-display text-lg text-foreground/55">
            {["Greenhouse", "Lever", "Ashby", "Workday"].map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ——— How it works ——— */}
      <section id="how" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-4xl leading-[1.08] sm:text-5xl">
              Three tools, <em>one</em> radar
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">
              Each TinyFish tool does the one job the others can&apos;t. Search and Fetch are free and do the heavy lifting;
              the agent only runs where it&apos;s the only thing that works.
            </p>
          </div>

          <div className="mt-20 space-y-24 lg:space-y-32">
            {FEATURES.map((f, i) => (
              <div
                key={f.id}
                className={`grid grid-cols-1 items-center gap-10 lg:gap-16 ${i % 2 === 1 ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-[0.8fr_1.2fr]"}`}
              >
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <p className={eyebrow}>{f.tool}</p>
                  <h3 className="mt-4 font-display text-3xl leading-tight">{f.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-muted">{f.body}</p>
                  <Link href={f.link.href} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                    {f.link.label} <span aria-hidden>→</span>
                  </Link>
                  <p className="mt-8 border-l-2 border-data-violet pl-4 text-sm leading-relaxed text-foreground">
                    <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">From a real scan</span>
                    {f.proof}
                  </p>
                </div>
                <div className={i % 2 === 1 ? "lg:order-1" : ""}>{f.panel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— What it reads (evals-style table) ——— */}
      <section id="extract" className="scroll-mt-20 border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-24 sm:px-6 lg:py-32">
          <div className="max-w-2xl">
            <p className={eyebrow}>Every posting, read for you</p>
            <h2 className="mt-4 font-display text-4xl leading-[1.08] sm:text-5xl">
              The details you <em>scroll</em> for
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Tested rules read each page first and a language model checks the rest. These rows are real results from
              our scans — including one posting whose “sponsor Visa&apos;s if needed” typo the rules missed and the model caught.
            </p>
          </div>
          <Panel title="Extracted postings" right={<span className="font-mono text-[10px] text-muted">parsed · rules + LLM</span>} className="mt-12">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-sunken font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    {["Company", "Role", "Term", "Class of", "Pay", "Visa", "Found by"].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SAMPLE_JOBS.map((j) => (
                    <tr key={j.company + j.term}>
                      <td className="px-4 py-3 font-medium">{j.company}</td>
                      <td className="px-4 py-3">{j.title}</td>
                      <td className="px-4 py-3 text-muted">{j.term ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{j.classOf ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{j.pay ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-xs ${
                            j.visa === "sponsors" ? "bg-ok/10 text-ok" : j.visa === "no_sponsorship" ? "bg-danger/10 text-danger" : "bg-sunken text-muted"
                          }`}
                        >
                          {VISA_LABEL[j.visa]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{j.found}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>

      {/* ——— Principles (2×2) ——— */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-24 sm:px-6 lg:py-32">
          <h2 className="max-w-3xl font-display text-4xl leading-[1.08] sm:text-5xl">
            <em>Honest</em> by default
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[4px] border border-border bg-border sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="bg-surface p-8 sm:p-10">
                <p className={eyebrow}>{p.eyebrow}</p>
                <h3 className="mt-4 font-display text-xl">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— CTA ——— */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl">Setting up takes a minute.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">Four quick questions, then your first scan starts on its own.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/onboarding" className={btnPrimary}>
              Get started for free
            </Link>
            <Link href="/jobs" className={btnSecondary}>
              Open my radar
            </Link>
          </div>
        </div>
      </section>

      {/* ——— FAQ ——— */}
      <section id="faq" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6">
          <h2 className="text-center font-display text-4xl">FAQ</h2>
          <div className="mt-12 divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
                    ⌄
                  </span>
                </summary>
                <p className="pb-6 leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Footer ——— */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-4 max-w-xs text-sm text-muted">The job radar for students. Built for the TinyFish Job Portal bounty.</p>
          </div>
          {[
            { h: "Product", links: [["Set up my radar", "/onboarding"], ["My radar", "/jobs"], ["Build log", "/progress"]] },
            { h: "How it works", links: [["TinyFish Search", "/#how"], ["TinyFish Fetch", "/#how"], ["TinyFish Agent", "/#how"], ["What it reads", "/#extract"]] },
            { h: "Built with", links: [["TinyFish", "https://www.tinyfish.ai"], ["Firecrawl (fallback)", "https://www.firecrawl.dev"], ["Vercel AI Gateway", "https://vercel.com/ai-gateway"]] },
          ].map((col) => (
            <div key={col.h}>
              <p className={eyebrow}>{col.h}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-muted transition-colors hover:text-foreground">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <p className="mx-auto w-full max-w-[1240px] px-4 py-5 font-mono text-[11px] text-muted sm:px-6">
            Openings · Search · Fetch · Agent · Firecrawl fallback
          </p>
        </div>
      </footer>
    </div>
  );
}
