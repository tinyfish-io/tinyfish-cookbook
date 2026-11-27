// Shared contract between the research pipeline (src/server) and the manga renderer (src/components).
// The pipeline produces these shapes; the frontend only ever reads them.

/* ───────────── Discovery ───────────── */

export type Availability = "full_text" | "abstract_only" | "unknown";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  /** Abstract text, or the search snippet when `abstractIsSnippet` is true. */
  abstract: string | null;
  abstractIsSnippet: boolean;
  /** Original landing page, always preserved. */
  url: string;
  pdfUrl: string | null;
  siteName: string | null;
  citedBy: number | null;
  arxivId: string | null;
  doi: string | null;
  /** Best guess at discovery time; confirmed once the paper is processed. */
  availability: Availability;
  /** True once Kenshō has actually tried to read the paper, so `availability` is known, not guessed. */
  availabilityConfirmed?: boolean;
  /** Which TinyFish queries surfaced this paper, e.g. "tinyfish·research_paper". */
  discoveredVia: string[];
  discoveredAt: string;
}

export interface SearchResponse {
  query: string;
  papers: Paper[];
  /** One entry per TinyFish call, so the UI can be honest about partial failures. */
  sources: { label: string; ok: boolean; count: number; error?: string }[];
  dedupedFrom: number;
  cached: boolean;
}

/* ───────────── Acquisition (full text) ───────────── */

export interface SourceSection {
  id: string; // "S1", "S2" …
  heading: string;
  text: string;
}

export interface Acquisition {
  mode: "full_text" | "abstract_only";
  sourceUrl: string;
  via: string[]; // ordered log of TinyFish steps that were attempted
  chars: number;
  sections: SourceSection[];
  notes: string[];
}

/* ───────────── Analysis (grounded understanding) ───────────── */

export type Field =
  | "machine_learning"
  | "computer_science"
  | "security"
  | "mathematics"
  | "physics"
  | "chemistry"
  | "biology"
  | "medicine"
  | "economics"
  | "other";

export type ClaimKind = "problem" | "background" | "method" | "finding" | "limitation" | "conclusion";

export interface Claim {
  id: string; // "C1" …
  kind: ClaimKind;
  /** Plain-language restatement, faithful to the paper. */
  statement: string;
  /** Verbatim excerpt from the paper supporting the statement (short). */
  quote: string;
  sectionId: string;
  /** True when `quote` was found in the acquired text. */
  verified: boolean;
}

export interface Term {
  term: string;
  definition: string;
}

export interface Analysis {
  field: Field;
  oneLiner: string;
  problem: string;
  contribution: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisites: { concept: string; why: string }[];
  sections: {
    background: string;
    methodology: string;
    technicalDetails: string;
    experiments: string;
    results: string;
    limitations: string;
    conclusions: string;
  };
  claims: Claim[];
  glossary: Term[];
  chapterPlan: ChapterPlan[];
  quiz: QuizQuestion[];
}

export interface ChapterPlan {
  number: number;
  title: string;
  focus: string;
  claimIds: string[];
  sectionIds: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  claimId: string | null;
}

/* ───────────── Manga script ───────────── */

export type CharacterId = "hoshi" | "kai" | "sumi";
export type Expression =
  | "neutral"
  | "happy"
  | "excited"
  | "surprised"
  | "thinking"
  | "confused"
  | "serious"
  | "smug"
  | "worried";
export type Pose = "idle" | "point" | "explain" | "think" | "shock" | "cheer";
export type SceneId =
  | "classroom"
  | "lab"
  | "library"
  | "city"
  | "speed"
  | "focus"
  | "halftone"
  | "void"
  | "sparkle"
  | "storm"
  | "space"
  | "grid"
  | "cells"
  | "circuit";
export type PanelSize = "small" | "medium" | "wide" | "tall" | "splash";
export type LineBasis = "paper" | "analogy" | "question" | "aside";

export interface CastMember {
  character: CharacterId;
  expression: Expression;
  pose: Pose;
}

export interface Line {
  speaker: CharacterId;
  text: string;
  style: "speech" | "thought" | "shout" | "whisper";
  /** "paper" lines restate research; "analogy" lines are simplifications and are marked as such. */
  basis: LineBasis;
  refs: string[]; // claim ids
}

export type Diagram =
  | { type: "flow"; nodes: { id: string; label: string; sub?: string }[]; edges: { from: string; to: string; label?: string }[] }
  | { type: "layers"; title?: string; layers: { label: string; detail?: string }[] }
  | { type: "compare"; left: { title: string; points: string[] }; right: { title: string; points: string[] } }
  | { type: "steps"; steps: { label: string; math?: string; note?: string }[] }
  | { type: "bars"; unit?: string; claimId: string; bars: { label: string; value: number; highlight?: boolean }[] }
  | { type: "cycle"; nodes: { label: string; sub?: string }[] }
  | { type: "network"; layers: number[]; labels?: string[] }
  | { type: "equation"; expression: string; parts: { symbol: string; meaning: string }[] }
  | { type: "sequence"; actors: string[]; messages: { from: string; to: string; text: string }[] };

interface PanelBase {
  size: PanelSize;
  refs: string[];
}

export type Panel =
  | (PanelBase & { kind: "dialogue"; scene: SceneId; cast: CastMember[]; lines: Line[]; sfx?: string })
  | (PanelBase & { kind: "narration"; scene: SceneId; text: string; cast?: CastMember[] })
  | (PanelBase & { kind: "diagram"; diagram: Diagram; caption: string })
  | (PanelBase & { kind: "concept"; term: string; definition: string; analogy?: string })
  | (PanelBase & { kind: "claim"; claimId: string; reaction?: string });

export interface MangaPage {
  panels: Panel[];
}

export interface Chapter {
  number: number;
  title: string;
  kicker: string; // short JP-flavoured label, e.g. "第一話"
  summary: string;
  pages: MangaPage[];
}

export interface Story {
  chapters: (Chapter | null)[]; // null while a chapter is still being drawn
}

/* ───────────── Processing job ───────────── */

export type JobStage = "queued" | "acquiring" | "analyzing" | "drawing" | "done" | "error";

export interface Job {
  paperId: string;
  stage: JobStage;
  message: string;
  log: { at: string; text: string }[];
  chaptersDone: number;
  chaptersTotal: number;
  error: string | null;
  updatedAt: string;
}

export interface ProcessedPaper {
  paper: Paper;
  acquisition: Acquisition | null;
  analysis: Analysis | null;
  story: Story | null;
  job: Job | null;
  model: string | null;
}
