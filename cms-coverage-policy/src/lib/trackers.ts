// Authoritative public trackers per condition — the sweep's ground truth.
// (Mirrored in scripts/seed.mjs, which can't import TS.)
export const TRACKERS: Record<string, { name: string; url: string; doc: string; prompt: string }> = {
  glp1_obesity: {
    name: "GLP-1 weight-loss drugs (obesity)",
    url: "https://therxindex.com/research/medicaid-glp-1-coverage-by-state/",
    doc: "The RX Index — Medicaid GLP-1 coverage by state tracker",
    prompt:
      "This page tracks which US state Medicaid programs cover GLP-1 drugs for the OBESITY/weight-loss indication (the diabetes indication is federally mandated everywhere — ignore it).",
  },
  cgm: {
    name: "Continuous glucose monitors",
    url: "https://t1dexchange.org/a-guide-to-cgms-and-medicaid-coverage-differences-by-state/",
    doc: "T1D Exchange — CGMs and Medicaid coverage differences by state",
    prompt:
      "This page tracks US state Medicaid coverage of continuous glucose monitors (CGM): which states cover via pharmacy/medical benefit, which require prior authorization, which have no published FFS policy.",
  },
};
