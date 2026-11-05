import type { RunRecord } from "../tinyfish/types.ts";
import { buildBill } from "./bill.ts";
import type { Evidence } from "./evidence.ts";
import { parseEvidence } from "./evidence.ts";
import type { PageSignals } from "./pageSignals.ts";
import type { PageTerm } from "./pageTerms.ts";
import { MONEY } from "./pageWords.ts";
import type { PageCapture } from "./pageText.ts";
import { comparable, locateQuote } from "./pageText.ts";
import type { Draft } from "./patterns.ts";
import {
  dripPricingFromBill,
  judgePattern,
  OLDER_AUDIT,
  PATTERNS,
  UNCONFIRMED,
} from "./patterns.ts";
import { scanSafety } from "./safety.ts";
import { locateScreenshots, movesPage } from "./screenshots.ts";
import { resolveReach, resolveStop } from "./stop.ts";
import { summariseSubscription } from "./subscription.ts";
import type {
  Bill,
  Flow,
  PatternFinding,
  PriceLabel,
  Screenshot,
  SiteReport,
  StopPoint,
  Term,
  TermName,
} from "./types.ts";
import { TERM_NAMES } from "./types.ts";

/** Raised when the rules change, so reports saved under older ones are judged again. */
export const RULES_VERSION = 10;

export interface JudgeInput {
  flow: Flow;
  url: string;
  run: RunRecord;
  signedIn?: boolean;
  /** The pages saved during the run. A finding needs its words on one of them. */
  captures?: readonly PageCapture[];
}

const EMPTY_BILL: Bill = {
  currency: null,
  firstPrice: null,
  firstPriceStep: null,
  firstPriceSource: null,
  itemsTotal: null,
  charges: [],
  notInTotal: [],
  includedCharges: [],
  discounts: [],
  extras: [],
  total: null,
  addsUp: null,
  unexplained: null,
  linesOverTotal: null,
  increase: null,
  multiple: null,
};

const MONEY_IN_TEXT = new RegExp(MONEY, "gi");

/** Signals the pages answer on their own, so a page without them counts as looked at. */
const PAGE_READ_SIGNALS = [
  "pressure_messages",
  "decline_wording",
  "price_anchors",
  "cookie_banners",
  "pre_ticked_options",
];

const STOP_WORDS = /\b(add|one|the|to|cart|bag|basket|click|select|item|first)\b/gi;

/** An item the agent added itself is the agent's mistake, not the site's. */
function dropOwnAdds(evidence: Evidence, actions: readonly string[]): Evidence {
  const addActions = actions.filter((action) => /\badd\b/i.test(action));
  const added = evidence.added.filter((item) => {
    const name = item.name.replace(STOP_WORDS, " ").toLowerCase();
    const words = name.split(/\W+/).filter((word) => word.length > 2);
    const own = addActions.some((action) =>
      words.every((word) => action.toLowerCase().includes(word)),
    );
    return !own;
  });
  return { ...evidence, added };
}

/**
 * Adds what the saved pages say to what the agent wrote down, which can leave out lines that are
 * plainly there. These come off the page itself, so they go first and pass the same gate as the
 * agent's words, and a line the agent reworded cannot hide one that is really on the page.
 */
function withPageSignals(
  flow: Flow,
  evidence: Evidence,
  captures: readonly PageCapture[],
): Evidence {
  // Latest first: a home page's promotions matter less than the page being bought from.
  const read = captures.flatMap(({ signals }) => (signals ? [signals] : [])).toReversed();
  if (read.length === 0) return evidence;

  const refused = evidence.cookieBanners.some(({ reject }) => reject);
  const accept = refused ? null : read.find(({ cookieAccept }) => cookieAccept)?.cookieAccept;
  const split = read.flatMap(({ splitPrices }) => splitPrices)[0];
  const seenInRun = { seenAtStep: null };

  return {
    ...evidence,
    pressure: [
      ...read.flatMap(({ pressure }) =>
        pressure.map(({ kind, text }) => ({ text, kind, ...seenInRun })),
      ),
      ...evidence.pressure,
    ],
    declineWording: [
      ...read.flatMap(({ declines }) => declines.map((text) => ({ text, ...seenInRun }))),
      ...evidence.declineWording,
    ],
    priceAnchors: [
      ...read.flatMap(({ anchors }) => anchors.map((anchor) => ({ ...anchor, ...seenInRun }))),
      ...evidence.priceAnchors,
    ],
    preTicked: [
      ...read.flatMap(({ preticked }) =>
        preticked.map((label) => ({ label, cost: null, includedInTotal: null, ...seenInRun })),
      ),
      ...evidence.preTicked,
    ],
    cookieBanners: accept
      ? [...evidence.cookieBanners, { accept, reject: null, ...seenInRun }]
      : evidence.cookieBanners,
    checks: split
      ? {
          ...evidence.checks,
          partitioned_pricing: { status: "found", quote: split, note: null, ...seenInRun },
        }
      : evidence.checks,
    reported: new Set([...evidence.reported, ...PAGE_READ_SIGNALS]),
    ...(flow === "subscription" ? termsFromPages(evidence, read, captures) : {}),
  };
}

/** The page's own line for a term, plain wording first since that is what a shopper sees. */
function pageTerm(terms: readonly PageTerm[], name: TermName): PageTerm | null {
  const lines = terms.filter(({ term }) => term === name);
  return lines.find(({ place }) => place === null) ?? lines[0] ?? null;
}

/**
 * An agent can answer "not shown" for a line that is there, tidy a quote until it is no longer on
 * the page, and call small print the main page. The page's own markup settles all three.
 */
function termsFromPages(
  evidence: Evidence,
  read: readonly PageSignals[],
  captures: readonly PageCapture[],
): Pick<Evidence, "terms" | "introPrice" | "priceAfterIntro"> {
  const lines = read.flatMap(({ terms }) => terms);
  const merged = TERM_NAMES.flatMap((name): Term[] => {
    const told = evidence.terms.find(({ term, quote, shownWhere }) => {
      return term === name && quote !== null && shownWhere !== "not_shown";
    });
    const line = pageTerm(lines, name);
    const undersold = told?.shownWhere === "main_page" && line?.place;
    const onPage = told?.quote && locateQuote(told.quote, captures) !== null;
    if (told && onPage && !undersold) return [told];
    if (told && !line) return [told];
    if (!line) return evidence.terms.filter(({ term }) => term === name);
    return [
      { term: name, quote: line.quote, shownWhere: line.place ?? "main_page", seenAtStep: null },
    ];
  });

  const after = pageTerm(lines, "price_after_intro");
  const [first, then] = [...(after?.quote.matchAll(MONEY_IN_TEXT) ?? [])].map(([money]) =>
    Number(money.replace(/[^\d.]/g, "")),
  );
  const unknown = evidence.introPrice === null || evidence.priceAfterIntro === null;
  const offerShown = unknown && first !== undefined && then !== undefined;
  return {
    terms: merged,
    introPrice: offerShown ? first : evidence.introPrice,
    priceAfterIntro: offerShown ? then : evidence.priceAfterIntro,
  };
}

function priceLabel(stop: StopPoint, bill: Bill): PriceLabel {
  if (bill.total === null) return "none";
  if (stop === "payment_page") return "final";
  return stop === "login_wall" ? "price_before_sign_in" : "last_seen";
}

function describeMissing(
  run: RunRecord,
  stop: StopPoint,
  evidence: Evidence | null,
  bill: Bill,
  hidesFees: boolean,
): string[] {
  const missing: string[] = [];

  if (run.status === "CANCELLED") {
    missing.push("The run was stopped at our time limit before it finished.");
  }
  if (!evidence) {
    missing.push("The agent returned no results, so nothing from this run can be judged.");
    return missing;
  }
  if (stop !== "payment_page") {
    missing.push("The payment page was not reached, so anything added there is unknown.");
  }
  if (hidesFees) missing.push("The site shows no fees before sign-in.");
  if (evidence.pages.length === 0) {
    missing.push("The agent returned no list of pages, so no step can be shown.");
  }
  if (evidence.finalPrice !== null && bill.total === null) {
    missing.push(
      `The agent reported a final price of ${evidence.finalPrice}, but no bill backs it up, so it is not used.`,
    );
  }
  for (const fee of evidence.fees) {
    if (fee.amount === null) missing.push(`"${fee.name}" was listed with no amount.`);
  }
  for (const line of bill.notInTotal) {
    missing.push(`${line.name} of ${line.amount} was offered but is not in this total yet.`);
  }
  return missing;
}

/** A subscription whose terms were all seen by the login wall has nothing more to give. */
function termsSettled(flow: Flow, evidence: Evidence | null): boolean {
  if (flow !== "subscription" || !evidence) return false;
  return (["renewal", "cancellation"] as const).every((name) =>
    evidence.terms.some(
      ({ term, quote, shownWhere }) => term === name && quote && shownWhere !== "not_shown",
    ),
  );
}

function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

interface RunPages {
  steps: readonly RunRecord["steps"][number][];
  captures: readonly PageCapture[];
  shots: ReadonlyMap<number, Screenshot>;
}

type Confirmed = Draft & { screenshot: Screenshot | null };

/** What an older run kept of each step: the agent's own action and its notes on the page. */
function stepWords(
  steps: RunPages["steps"],
  pages: Evidence["pages"],
  shots: RunPages["shots"],
): PageCapture[] {
  const words = new Map(steps.map(({ id, action }) => [id, action ?? ""]));
  for (const { step, name, note } of pages) {
    const stepId = shots.get(step)?.stepId;
    if (stepId) words.set(stepId, `${words.get(stepId) ?? ""} ${name} ${note ?? ""}`);
  }
  return [...words].map(([stepId, text]) => ({ stepId, text: comparable(text) }));
}

function pageOfStep({ steps, shots }: RunPages, stepId: string): number | null {
  const position = (id: string) => steps.findIndex((step) => step.id === id);
  const at = position(stepId);
  let page: number | null = null;
  for (const [number, shot] of shots) {
    if (position(shot.stepId) <= at) page = number;
  }
  return page ?? shots.keys().next().value ?? null;
}

/**
 * The last word on what a reader may see. A claim whose words are not on a saved page with a
 * screenshot goes no further, and the page that holds the words picks the screenshot.
 */
function confirmed(draft: Draft, pages: RunPages, words: readonly PageCapture[]): Confirmed {
  const { steps, captures, shots } = pages;
  const older = captures.length === 0;
  const stepsWithShots = new Set(steps.filter(({ screenshot }) => screenshot).map(({ id }) => id));
  const pagesToRead = (older ? words : captures).filter(({ stepId }) => stepsWithShots.has(stepId));
  const moving = new Set(steps.filter(({ action }) => movesPage(action)).map(({ id }) => id));
  const settled = pagesToRead.filter(({ stepId }) => !moving.has(stepId));
  const named = draft.step === null ? null : (shots.get(draft.step)?.stepId ?? null);
  if (draft.status !== "found") {
    return { ...draft, screenshot: draft.step === null ? null : (shots.get(draft.step) ?? null) };
  }

  for (const anchor of draft.anchors) {
    const stepId = locateQuote(anchor, settled, named) ?? locateQuote(anchor, pagesToRead, named);
    const page = pagesToRead.find((capture) => capture.stepId === stepId);
    const step = steps.find((entry) => entry.id === stepId);
    if (!stepId || !page || !step?.screenshot) continue;
    if (draft.alongside.some((words) => locateQuote(words, [page]) === null)) continue;
    return {
      ...draft,
      step: stepId === named ? draft.step : (pageOfStep(pages, stepId) ?? draft.step),
      screenshot: { stepId, action: step.action },
    };
  }
  // A sum needs no words on a page, so an older run can still show it beside its screenshot.
  const shot = older && named !== null && draft.quote === null ? shots.get(draft.step ?? 0) : null;
  if (shot && draft.amounts.length > 0) return { ...draft, screenshot: shot };

  return {
    ...draft,
    status: "not_checked",
    quote: null,
    step: null,
    amounts: [],
    note: older ? OLDER_AUDIT : UNCONFIRMED,
    screenshot: null,
  };
}

export function judgeRun({
  flow,
  url,
  run,
  signedIn = false,
  captures = [],
}: JudgeInput): SiteReport {
  const actions = run.steps.map((step) => step.action ?? "");
  const parsed = parseEvidence(run.result);
  const evidence = parsed && withPageSignals(flow, dropOwnAdds(parsed, actions), captures);

  const stop = resolveStop(run, evidence);
  const bill = evidence ? buildBill(flow, evidence) : EMPTY_BILL;
  const reach = resolveReach(stop, evidence, evidence ? bill : null);
  const shots = locateScreenshots(evidence?.pages ?? [], run.steps);
  const screenshotFor = (step: number | null): Screenshot | null =>
    step === null ? null : (shots.get(step) ?? null);

  const context = { flow, evidence, bill, stop, reach, captures };
  const pages = { steps: run.steps, captures, shots };
  const words = stepWords(run.steps, evidence?.pages ?? [], shots);
  const patterns: PatternFinding[] = PATTERNS.map((definition) => {
    const { status, quote, step, amounts, note, screenshot } = confirmed(
      judgePattern(definition, context),
      pages,
      words,
    );
    return {
      id: definition.id,
      label: definition.label,
      group: definition.group,
      severity: definition.severity,
      status,
      quote,
      step,
      amounts,
      note,
      soFar: status === "not_found" && stop !== "payment_page",
      screenshot,
    };
  });

  const wall = stop === "login_wall";
  const hidesFees = wall && bill.total === null;

  return {
    rules: RULES_VERSION,
    older: captures.length === 0,
    url,
    host: hostOf(url),
    flow,
    signedIn,
    runId: run.run_id,
    item: evidence?.itemName ?? evidence?.planName ?? null,
    origin: evidence?.origin ?? null,
    destination: evidence?.destination ?? null,
    stop: {
      at: stop,
      claimed: evidence?.stoppedAt ?? null,
      note: evidence?.stopNote ?? run.error?.message ?? null,
      reach,
    },
    priceLabel: priceLabel(stop, bill),
    bill,
    subscription: flow === "subscription" && evidence ? summariseSubscription(evidence) : null,
    patterns,
    pages: (evidence?.pages ?? []).map((page) => ({
      ...page,
      screenshot: screenshotFor(page.step),
    })),
    flags: scanSafety(run.steps, evidence, captures),
    missing: describeMissing(run, stop, evidence, bill, hidesFees),
    login: {
      wallAt: wall ? (evidence?.loginWallAt ?? null) : null,
      hidesFees,
      offerSignIn: wall && !signedIn && !termsSettled(flow, evidence),
    },
  };
}

/**
 * For a saved report whose run can no longer be read. The bill was checked when it was saved, so
 * its sum still stands; every other claim rested on words that cannot be read again.
 */
export function judgeSavedReport(saved: SiteReport): SiteReport {
  const lastStep = saved.pages.at(-1)?.step ?? null;
  const drip = dripPricingFromBill(saved.bill, saved.stop.at, lastStep);
  const screenshot = saved.pages.find(({ step }) => step === drip.step)?.screenshot ?? null;
  const kept = drip.status === "found" && screenshot !== null;

  const patterns: PatternFinding[] = PATTERNS.map(({ id, label, group, severity }) => {
    const shown = kept && id === "drip_pricing";
    return {
      id,
      label,
      group,
      severity,
      status: shown ? "found" : "not_checked",
      soFar: false,
      step: shown ? drip.step : null,
      quote: null,
      amounts: shown ? drip.amounts : [],
      screenshot: shown ? screenshot : null,
      note: shown ? drip.note : OLDER_AUDIT,
    };
  });
  return { ...saved, rules: RULES_VERSION, older: true, patterns };
}
