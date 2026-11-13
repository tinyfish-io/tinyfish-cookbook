import "server-only";
import type { Acquisition, Paper, SourceSection } from "@/lib/types";
import { fetchContent, runAgent, type FetchedPage } from "./tinyfish";

// Paper → readable text. Order of attempts:
//   1. TinyFish Fetch on every known candidate (arXiv HTML, PDF, landing page) in one parallel call.
//   2. If none of them yields full text, a TinyFish Agent run opens the landing page in a real
//      browser and looks for a *legitimately open* full-text link (never logs in, never bypasses
//      paywalls or CAPTCHAs). Any link it finds goes back through Fetch.
//   3. Otherwise we fall back to the abstract and say so everywhere downstream.

const MAX_CHARS = 140_000;

function looksLikeFullText(text: string) {
  if (text.length < 9000) return false;
  const t = text.toLowerCase();
  const signals = ["introduction", "method", "result", "conclusion", "references", "experiment", "discussion", "related work"];
  return signals.filter((s) => t.includes(s)).length >= 3;
}

function looksBlocked(page: FetchedPage) {
  const t = `${page.title ?? ""} ${page.text.slice(0, 2000)}`.toLowerCase();
  return /access denied|captcha|are you a robot|verify you are human|subscribe to read|purchase this article|sign in to (read|access)/.test(t);
}

function candidates(paper: Paper): string[] {
  const out: string[] = [];
  if (paper.arxivId) out.push(`https://arxiv.org/html/${paper.arxivId}`, `https://arxiv.org/pdf/${paper.arxivId}`);
  if (paper.pdfUrl) out.push(paper.pdfUrl);
  out.push(paper.url);
  return [...new Set(out)].slice(0, 5);
}

/* ───────────── Sectioning ───────────── */

const HEADING_MD = /^(#{1,4})\s+(.{2,120})$/;
const HEADING_NUM = /^(\d{1,2}(?:\.\d{1,2}){0,2}|[IVX]{1,4}(?=\.))\.?\s+([A-Z][A-Za-z0-9 ,:;&()'’\-–/]{2,80})$/;
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const HEADING_WORD = /^(abstract|introduction|background|related work|methods?|methodology|materials and methods|results|discussion|conclusions?|limitations|experiments?|evaluation)\s*$/i;
const END_MARKERS = /^(#{1,4}\s*)?(\d+\.?\s*)?(references|bibliography|acknowledg(e)?ments?)\s*$/i;

export function sectionize(text: string): SourceSection[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const raw: { heading: string; body: string[] }[] = [{ heading: "Front matter", body: [] }];
  let lastTop = 0;
  for (const line of lines) {
    const l = line.trim();
    if (END_MARKERS.test(l)) break; // references/acknowledgements are not part of the story
    const md = l.match(HEADING_MD);
    let num = !md && l.length < 100 ? l.match(HEADING_NUM) : null;
    if (num) {
      // Numbered list items look like headings in flattened PDFs; real section numbers only move forward.
      const top = ROMAN[num[1]] ?? Number(num[1].split(".")[0]);
      if (!top || top < lastTop || top > lastTop + 2 || num[2].split(" ").length > 12) num = null;
      else lastTop = top;
    }
    const word = !md && !num ? l.match(HEADING_WORD) : null;
    if (md || num || word) {
      const heading = (md ? md[2] : num ? `${num[1]} ${num[2]}` : word![1]).replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
      raw.push({ heading, body: [] });
    } else {
      raw[raw.length - 1].body.push(line);
    }
  }

  // Merge slivers into their predecessor so citations point at meaningful chunks.
  const merged: { heading: string; text: string }[] = [];
  for (const s of raw) {
    const body = s.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (merged.length && body.length < 400) {
      merged[merged.length - 1].text += `\n\n${s.heading}\n${body}`;
    } else {
      merged.push({ heading: s.heading, text: body });
    }
  }

  let sections = merged.filter((s) => s.text.length > 0);
  // No usable headings (common for flattened PDFs): fall back to fixed-size parts.
  if (sections.length < 3) {
    const flat = text.trim();
    const size = 5000;
    sections = [];
    for (let i = 0; i < flat.length; i += size) sections.push({ heading: `Part ${sections.length + 1}`, text: flat.slice(i, i + size) });
  }

  let budget = MAX_CHARS;
  const out: SourceSection[] = [];
  for (const s of sections) {
    if (budget <= 0) break;
    const t = s.text.slice(0, budget);
    budget -= t.length;
    out.push({ id: `S${out.length + 1}`, heading: s.heading.slice(0, 100), text: t });
  }
  return out;
}

/* ───────────── Acquisition ───────────── */

export async function acquire(paper: Paper, log: (text: string) => void): Promise<Acquisition> {
  const via: string[] = [];
  const notes: string[] = [];
  const urls = candidates(paper);

  log(`TinyFish Fetch → ${urls.length} candidate source${urls.length > 1 ? "s" : ""}`);
  via.push(`tinyfish·fetch(${urls.length})`);
  let pages: FetchedPage[] = [];
  try {
    const res = await fetchContent(urls, { purpose: `Read the full text of the research paper "${paper.title}"`, perUrlTimeoutMs: 75_000 });
    pages = res.results.filter((p) => !looksBlocked(p));
    for (const e of res.errors) notes.push(`Could not fetch ${e.url}: ${e.error.slice(0, 120)}`);
    const blocked = res.results.length - pages.length;
    if (blocked) notes.push(`${blocked} source(s) returned an access wall and were skipped.`);
  } catch (e) {
    notes.push(`TinyFish Fetch failed: ${(e as Error).message.slice(0, 160)}`);
  }

  let best: FetchedPage | undefined = pages.filter((p) => looksLikeFullText(p.text)).sort((a, b) => b.text.length - a.text.length)[0];
  const landing = pages.find((p) => p.url === paper.url);

  if (!best && process.env.TINYFISH_AGENT_FALLBACK !== "off") {
    log("No open full text yet — sending a TinyFish browser agent to the landing page");
    via.push("tinyfish·agent");
    try {
      const run = await runAgent(
        paper.url,
        [
          `You are on the landing page of the research paper titled "${paper.title}".`,
          "Find a link to the paper's FULL TEXT that is openly accessible without logging in or paying: a 'PDF', 'Download PDF', 'Full text', 'HTML', 'Open access', or preprint (arXiv / bioRxiv / PMC / author page) link.",
          "Do NOT log in, create accounts, accept purchase prompts, solve CAPTCHAs, or try to bypass any paywall. If the full text requires a subscription or payment, stop and report that.",
          "Also copy the paper's abstract text if it is shown on the page.",
          'Return JSON exactly like: {"full_text_url": string or null, "abstract": string or null, "access": "open" | "paywalled" | "unknown", "note": string}',
        ].join("\n"),
        (t) => log(`Agent: ${t}`),
      );
      const r = (run.result && typeof run.result === "object" ? ((run.result as Record<string, unknown>).result ?? run.result) : run.result) as
        | Record<string, unknown>
        | string
        | null;
      const obj = typeof r === "string" ? safeJson(r) : r;
      const link = typeof obj?.full_text_url === "string" && /^https?:\/\//.test(obj.full_text_url) ? obj.full_text_url : null;
      if (typeof obj?.abstract === "string" && obj.abstract.length > 200 && paper.abstractIsSnippet) {
        paper.abstract = obj.abstract;
        paper.abstractIsSnippet = false;
      }
      if (typeof obj?.note === "string") notes.push(`Agent: ${obj.note.slice(0, 200)}`);
      if (link) {
        log(`Agent found an open full-text link — fetching it`);
        via.push("tinyfish·fetch(agent link)");
        const res = await fetchContent([link], { purpose: `Read the full text of "${paper.title}"`, perUrlTimeoutMs: 75_000 });
        best = res.results.find((p) => looksLikeFullText(p.text) && !looksBlocked(p));
      } else if (obj?.access === "paywalled") {
        notes.push("The publisher requires a subscription for the full text; Kenshō respects that and works from the abstract.");
      }
    } catch (e) {
      notes.push(`TinyFish Agent could not complete: ${(e as Error).message.slice(0, 160)}`);
    }
  }

  if (best) {
    const sections = sectionize(best.text);
    const chars = sections.reduce((n, s) => n + s.text.length, 0);
    if (best.text.length > MAX_CHARS) notes.push(`Paper is long; the first ${Math.round(MAX_CHARS / 1000)}k characters were analysed.`);
    log(`Full text acquired: ${Math.round(best.text.length / 1000)}k chars in ${sections.length} sections`);
    return { mode: "full_text", sourceUrl: best.final_url ?? best.url, via, chars, sections, notes };
  }

  // Abstract-only mode.
  const abstract =
    (!paper.abstractIsSnippet && paper.abstract) ||
    (landing?.description && landing.description.length > 200 ? landing.description : null) ||
    paper.abstract;
  if (!abstract) throw new Error("Neither full text nor an abstract could be retrieved for this paper.");
  if (landing?.description && landing.description.length > (paper.abstract?.length ?? 0)) {
    paper.abstract = landing.description;
    paper.abstractIsSnippet = false;
  }
  log("Only the abstract is openly available — the manga will cover the abstract only");
  notes.push("Abstract-only: the full paper was not openly accessible, so chapters are limited to what the abstract states.");
  return {
    mode: "abstract_only",
    sourceUrl: paper.url,
    via,
    chars: abstract.length,
    sections: [{ id: "S1", heading: "Abstract", text: abstract }],
    notes,
  };
}

function safeJson(s: string): Record<string, unknown> | null {
  try {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}
