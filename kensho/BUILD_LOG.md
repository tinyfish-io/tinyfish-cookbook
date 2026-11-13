# Kensho: Turning Research Papers into Manga You Can Actually Follow

*A build log by Nishant — built for TinyHacks with TinyFish Search, Fetch and Agent*

---

## 1. TL;DR

**What I built:** Kensho (見性, "seeing into the nature of things") is a web app that turns real research papers into short manga chapters. You type a question like *"How do neural networks learn?"*, Kensho finds actual papers on the web with TinyFish, reads the one you pick, and redraws it as a manga with recurring characters, diagrams and key terms. Every research claim in the story links back to a quote from the paper.

**Who it's for:** Curious people, mostly students, who want to understand a paper but get lost in the jargon, dense methods sections and missing background.

**What I'm proudest of:** The manga is grounded in the paper, not just inspired by it. Each claim the model extracts must carry a word-for-word quote, and Kensho checks that quote against the text TinyFish actually fetched. Matches get a red 検証 ("verified") stamp, and anything it can't match is labelled unverified instead of being presented as fact. In the papers I've processed so far, 30 of 33 extracted quotes were found in the source text (details and caveats in section 6).

---

## 2. The Problem

Research papers are written for other researchers. When I try to read a paper outside my comfort zone, I hit the same walls every time:

- **Finding the right paper is hard.** A plain search gives you blog posts, paywalled landing pages and duplicates of the same paper on three different sites.
- **Getting the actual text is harder.** Many publisher pages block automated access or only show an abstract. When I tested 16 publisher landing pages with a plain fetch, 12 of them came back blocked.
- **The paper assumes you already know things.** Terms appear without definitions, and the "why does this matter" part is buried in the introduction.
- **AI summaries are hard to trust.** A summary can sound confident and still invent a number or a finding, and you usually can't tell which sentence came from the paper.

I wanted something that made reading research feel less like homework, without losing the connection to what the paper actually says.

---

## 3. What I Built

Here's how it works from the user's side.

**1. Ask a question.** The home page is built around one search box. You can type plain English, such as *"Can AI detect diseases?"*, rather than keywords.

**2. Watch the search happen.** While TinyFish searches, the page shows each source finishing in real time, with how many papers it found, and then the merge step. It doesn't use a fake progress bar. The results show one best match and a readable list with authors, year, venue and citation count.

**3. See what's actually readable.** Each paper gets an honest access label. Before Kensho reads a paper it can only guess: *PDF link found*, *Likely abstract only*, or *Access unchecked*. After reading, the label is confirmed as *Full text read* or *Abstract only*.

**4. Open the paper and press one button.** The paper page shows the title, authors, abstract and a single **Read as manga** button. Difficulty and reading time only appear after Kensho has analysed the paper, so it never shows a made-up number.

**5. Watch it being drawn.** The reader shows the real pipeline stages (getting the paper, reading it, drawing chapters), including the live steps the TinyFish Agent takes when it's needed. Chapter one opens automatically as soon as it's ready, while later chapters are still being drawn.

**6. Read the manga.** Each paper becomes a short volume of chapters with:
- three recurring characters: **Prof. Hoshi**, who explains what the paper says; **Kai**, a student who asks the questions a newcomer would ask; and **Sumi**, a small ink-fish who "scouts" papers on the web
- different panel types: dialogue, narration, **"From the paper" panels** with the verbatim quote and a verified/unverified stamp, **key-term panels**, and **interactive diagrams** (flowcharts, layer stacks, step-by-step derivations, equations, comparisons, and a few more)
- **citation chips** on research lines that open the exact quote and paper section in a side drawer
- **analogies marked as analogies**, so you always know when you're reading a simplification
- page-by-page and vertical-scroll reading modes, chapter title cards, a contents sheet and a short quiz at the end

**7. Come back later.** Bookmarks, reading progress, saved terms and quiz scores are kept in your browser, so "Continue reading" picks up where you stopped.

The characters, backgrounds and panel layouts are reusable SVG artwork, not AI-generated images. That keeps the characters consistent from panel to panel and keeps the text crisp, because dialogue is rendered as real text instead of being baked into an image.

---

## 4. Where TinyFish Fit

Kensho uses three TinyFish endpoints, called directly over REST from a small server-side client (`src/server/tinyfish.ts`). Each one has a clear job.

### TinyFish Search — finding real papers
**Endpoint:** `GET https://api.search.tinyfish.ai`

For every question, Kensho runs **three searches in parallel**:

1. `domain_type=research_paper`, page 1
2. `domain_type=research_paper`, page 2
3. a normal web search restricted with `include_domains` to open repositories (arXiv, OpenReview, bioRxiv/medRxiv, ACL Anthology, NeurIPS and PMLR proceedings, PubMed Central, PLOS, IACR ePrint)

I also pass the `purpose` parameter to describe what the results are for (foundational, well-cited, open-access papers suitable for a student).

The research-paper results were the most useful part. They come back with **authors, year, venue, citation count and often a direct PDF link**, which is almost everything the results page needs. Kensho then removes duplicates by arXiv ID, DOI and a normalised title, because the same paper often turns up from several places. For arXiv papers it also fetches the full abstract from the public arXiv API. That part is not TinyFish.

Search is also used for **related research** on each paper page: a `research_paper` search seeded with the paper's own title.

### TinyFish Fetch — getting the full text
**Endpoint:** `POST https://api.fetch.tinyfish.ai`

When you open a paper, Kensho builds a list of up to five candidate URLs (the arXiv HTML version, the arXiv PDF, any PDF link from Search, and the landing page) and sends them to Fetch **in a single call**. Fetch returns clean markdown for each, including PDFs.

Kensho then:
- skips any page that looks like an access wall (CAPTCHA, "subscribe to read" and so on)
- picks the longest result that looks like a real paper (long enough, with words like *introduction*, *method*, *results*)
- splits it into numbered sections, so every extracted claim can point to the section it came from

### TinyFish Agent — the fallback for hard pages
**Endpoint:** `POST https://agent.tinyfish.ai/v1/automation/run-sse`

If Fetch can't get the full text, Kensho sends a TinyFish Agent to the paper's landing page with a natural-language goal: find a link to an **openly accessible** full-text version (a PDF, a PubMed Central copy, a preprint or an author page). The goal also says what *not* to do: no logging in, no creating accounts, no solving CAPTCHAs, no getting around paywalls. If the paper is paywalled, the agent should stop and say so.

Kensho uses the streaming endpoint, so each step the agent takes appears in the reader's progress log while you wait. If the agent finds an open link, Kensho runs it back through **Fetch** to get the text. If it doesn't, Kensho switches to an **abstract-only mode** and says so clearly in the app.

The agent is metered, so it only runs when Fetch fails, and it can be switched off with an environment variable.

### Limitations I actually ran into
- **Many publisher pages block plain fetching.** That's exactly why the Agent fallback exists (numbers in section 6).
- **The agent sometimes finds copies I can't verify.** In one test it returned a PDF hosted on a third-party personal site rather than the publisher, a repository or the authors. Kensho doesn't yet check whether a host is trustworthy; that's on my list (section 7).
- **Some pages are walled for everyone.** On one Cloudflare-protected page the agent correctly stopped instead of trying to get around the check.
- **The agent's labels vary.** For the same situation it sometimes reported "blocked" and sometimes "paywalled", so I treat both as "no open copy".

---

## 5. What Worked

**1. Keeping the "understanding" separate from the "drawing."**
The language model (Gemini, through its structured JSON output) never draws anything. It writes a script: who says what, which diagram to use, how big a moment each panel should be. Kensho's own code then decides the page layout, the artwork and the lettering. That made the characters consistent, kept the dialogue readable, and let me change the reader's look without touching the pipeline.

**2. Making every claim carry its own evidence.**
Each claim must include a short verbatim quote and a section ID. Kensho searches the fetched text for that quote, using overlapping word windows because PDF text often has broken hyphenation, and stamps it verified or unverified. A few rules follow from that:
- research lines in the story cite claim IDs
- bar charts are only drawn if every number appears in a verified quote (anything else is dropped)
- analogies are visibly tagged as analogies

**3. Fetch first, Agent only when needed.**
Sending every candidate URL to Fetch in one call is fast and costs nothing. The Agent only runs when that fails. Being honest about the result, with an abstract-only mode and access labels, was better than pretending every paper was fully read.

**4. Saving progress after every stage.**
Each step (fetching, analysing, drawing each chapter) is saved as it finishes. Chapter one can be read while the rest are still being drawn, and if a chapter fails, Kensho only redraws that chapter instead of starting over. This became important once I hit the free-tier rate limits of the language model (section 7).

---

## 6. Measurable Outcome

I haven't run a formal evaluation yet, so these numbers are small and come from my own development runs. They're all taken from the project's database and an experiment log in the repo (`experiments/tinyfish-budget/LEDGER.md`), not estimated.

**End-to-end runs (5 papers):**

| What | Result |
|---|---|
| Papers turned into manga | 5 (4 from full text, 1 abstract-only) |
| Output | 18 chapters, 43 pages, 129 panels |
| Extracted quotes found in the fetched text | 30 of 33 |
| Uninterrupted processing time | 106 s (abstract-only paper, including an Agent run) and 186 s (full-text paper) |

The abstract-only paper went to the Agent fallback, which confirmed the publisher requires a subscription and recovered the real abstract from PubMed.

**Discovery:** across 11 searches, TinyFish returned 273 paper results, which became 259 unique papers after de-duplication.

**Fetch vs. Agent on publisher pages (a separate test I ran):**
- Plain Fetch on 16 publisher landing pages: 3 fully readable, 1 partly readable, **12 blocked**.
- Kensho's Agent goal on 11 of the hard pages: **7 legitimate open copies found** (4 via PubMed Central or arXiv, 2 free on the publisher's own site, 1 author PDF), 1 unofficial mirror, 2 genuinely paywalled with no open copy, and 1 page unreachable behind Cloudflare.
- Those 11 Agent runs took 144 steps in total, about 13 per lookup, which at $0.016 per step is roughly **$0.21 per paper**.

**What these numbers do *not* show:**
- A verified quote only means the quote exists in the paper. It doesn't prove the explanation around it is correct. **I have not evaluated whether the explanations are scientifically accurate**, and I haven't measured whether readers actually understand papers better.
- I have no user numbers and no "time saved" figure.
- Five papers is a very small sample.

**What I plan to measure before calling anything a result:**
1. Pick 20 papers across fields: arXiv, PubMed Central and paywalled publishers.
2. For each, record whether the full text was retrieved and by which step (Fetch or Agent), the processing time, and how many quotes were verified.
3. Have someone who knows each field rate every chapter's claims as correct, oversimplified or wrong.
4. Ask a few non-expert readers to answer the quiz after reading the manga and after reading the abstract alone.

---

## 7. What I'd Do Differently

**Plan around content access from day one.** The judges at TinyHacks liked the creativity, the manga concept and the reader experience. They also suggested using Fetch or Agent to get more complete paper content for richer chapters. They were right. The abstract-only paper became a 2-chapter manga, while the full-text papers became 3 to 5 chapters. How good the manga is depends on how much of the paper Kensho can read, so retrieval deserves as much attention as the reader.

**Only trust known sources.** Since the agent once returned an unofficial mirror, I'd accept only known hosts (publishers' open-access pages, PubMed Central, arXiv and other preprint servers, university and author pages) and flag everything else.

**Expect rate limits.** On the free tier, the language model allowed only 20 requests per day per model, plus per-minute limits. A single paper uses one request for analysis and one per chapter, so I ran out quickly. I added retries, a fallback to other models, and drawing two chapters at a time instead of three. I should have planned for this from the start.

**PDF text is messy.** Turning a fetched PDF into clean sections took more work than I expected. Numbered list items looked like section headings, and quotes didn't match exactly because of broken hyphenation, so both needed extra handling.

**Measure earlier.** I built the features first and only started recording numbers late. Next time I'd set up the 20-paper evaluation (section 6) before adding more features.

**Where I'm taking it next (not built yet):** I'm exploring how Kensho could grow from a hackathon project into a proper research tool: helping people discover research, understand scientific concepts and interact with papers through AI tools, with the manga reader still at the centre. I plan to start small, building a minimal version first and testing it, rather than building everything at once. None of this exists yet; the sections above describe what's built today.

---

## 8. Advice for Other Builders

- **Use the `research_paper` search mode if you work with papers.** The structured fields (authors, year, venue, citations, PDF link) saved me from scraping result pages, and the `purpose` parameter is worth filling in.
- **Batch your Fetch calls.** One call can take several URLs. Try every candidate at once and pick the best result yourself.
- **Use Agent as a fallback, not a first step.** It's powerful for pages Fetch can't read, but it's metered and slower. Use it only when cheaper steps fail.
- **Write Agent goals like instructions for a careful intern.** Say exactly what to find, what to return (I ask for JSON), and what *not* to do. Then check the result yourself instead of trusting the run status, and verify where any link it returns actually points.
- **Stream progress to your users.** Search and the Agent's streaming endpoint both give you real events. Showing those made waiting feel shorter and was more honest than a spinner.
- **Make your AI show its evidence.** Asking for a quote with every claim, and checking that quote in code, was the single most useful thing I did for trust.

---

## 9. Try It

- **Live app:** https://kensho-nt.vercel.app/
- **GitHub:** https://github.com/NishantTyagi-git/Kensho
- **LinkedIn:** https://www.linkedin.com/in/nishanttyagi-dev/

To run it locally you need Node 22.5 or newer, a TinyFish API key and a Gemini API key. Setup steps are in the README.

*Thanks to the TinyHacks judges for the feedback, and to TinyFish for building the tools that made the "find and read the actual paper" part possible.*
