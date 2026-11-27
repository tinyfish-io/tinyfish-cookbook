// Phase 0 — turn whatever the user typed into a scan target.
//
// The user types "weight loss drugs" or "Ozempic" or "kids with autism". None of
// those are searchable policy terms. One smart-model call normalises the input
// into a condition, the treatment class states actually write policy about, the
// brand and generic names their formularies list, and — the part that shapes the
// whole narrative — *why states are allowed to differ at all*. If a treatment is
// federally mandated there is no story; the policy lever is what makes a
// fifty-state scan worth running.

import { askJson } from "../lib/llm"
import type { ConditionSpec } from "../lib/types"

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "treatmentClass", "treatments", "policyLever", "searchTerms", "scannable", "rejectionReason"],
  properties: {
    name: { type: "string", description: "Canonical condition or indication, title case" },
    treatmentClass: { type: "string", description: "The drug/device class state policy is written about" },
    treatments: {
      type: "array",
      items: { type: "string" },
      description: "Brand and generic names as they appear on a preferred drug list. 2-8 entries.",
    },
    policyLever: {
      type: "string",
      description: "One sentence: why state Medicaid programs are permitted to differ on this, or why they are not.",
    },
    searchTerms: {
      type: "array",
      items: { type: "string" },
      description: "6-12 lowercase phrases to window policy documents on. Include the drug names, the class, and the indication.",
    },
    scannable: { type: "boolean", description: "false only if the input is not a medical condition or treatment at all" },
    rejectionReason: { type: ["string", "null"] },
  },
} as const

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
}

export async function resolveCondition(userInput: string): Promise<ConditionSpec> {
  const parsed = await askJson<{
    name: string
    treatmentClass: string
    treatments: string[]
    policyLever: string
    searchTerms: string[]
    scannable: boolean
    rejectionReason: string | null
  }>({
    tier: "smart",
    schema: SCHEMA,
    schemaName: "condition_spec",
    label: "resolve condition",
    maxTokens: 900,
    system:
      "You normalise a user's free-text health query into a scan target for a US state Medicaid coverage scanner. " +
      "The scanner compares fee-for-service coverage of one treatment class across all 50 states plus DC.\n\n" +
      "Rules:\n" +
      "- If the user names a drug, resolve to the indication that states actually make coverage decisions about. " +
      "GLP-1s are the clearest case: the type 2 diabetes indication is federally mandated everywhere, so the scannable " +
      "target is the OBESITY/weight-management indication, which is optional for states.\n" +
      "- searchTerms are what a document-windowing function greps for. Include brand names, generic names, the class " +
      "name, and the indication. Lowercase, no punctuation beyond hyphens.\n" +
      "- policyLever must say concretely what makes states free to differ (optional benefit, no national coverage " +
      "determination, medical-necessity left to the state, EPSDT floor for under-21s, etc.).\n" +
      "- scannable is false only for input that is not health related at all.",
    user: `User query: ${JSON.stringify(userInput)}`,
  })

  if (!parsed.scannable) {
    throw new Error(parsed.rejectionReason ?? `"${userInput}" does not look like a condition or treatment.`)
  }

  return {
    slug: slugify(`${parsed.name}_${parsed.treatmentClass}`) || slugify(userInput),
    userInput,
    name: parsed.name,
    treatmentClass: parsed.treatmentClass,
    treatments: parsed.treatments.slice(0, 8),
    policyLever: parsed.policyLever,
    searchTerms: [...new Set(parsed.searchTerms.map((t) => t.toLowerCase()))].slice(0, 12),
    createdAt: new Date().toISOString(),
    builtIn: false,
  }
}
