// Report-language helpers.
//
// A report always carries English and Hindi text (plus Hinglish "original"
// text when the claim was Hinglish). The user's own language is the default
// view; the toggle on the results switches views without a new request.

export const VIEW_LABELS = { en: "English", hi: "हिंदी", original: "Hinglish" };

export function detectedLanguage(analysis) {
  // Older stored reports only have `language`.
  return analysis?.detected_language || analysis?.language || "en";
}

export function viewsFor(detected) {
  return detected === "hinglish" ? ["original", "en", "hi"] : ["en", "hi"];
}

export function defaultView(detected) {
  if (detected === "hi") return "hi";
  if (detected === "hinglish") return "original";
  return "en";
}

// Picks one language out of a bilingual field. Also accepts plain strings and
// the legacy { en, local } shape from reports saved before this feature.
export function pickText(field, view) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  if (view === "original") return field.original || field.local || field.en || "";
  if (view === "hi") return field.hi || field.local || field.en || "";
  return field.en || "";
}

// UI chrome follows the report language; Hinglish reads in English chrome.
export const chromeFor = (view) => (view === "hi" ? "hi" : "en");

export const STRINGS = {
  en: {
    toggleLabel: "Report language",
    kicker: "INVESTIGATION REPORT",
    title: "Analysis results",
    subtitle: "Review the verdict and explore the evidence behind it.",
    clear: "Clear results ×",
    share: "Share Fact-Card",
    shareHint: "Print this report or save it as a PDF to share",
    noExplanation: "No explanation is available.",
    consensus: "CONSENSUS SCORE",
    noStance: "No dominant stance",
    zombieTitle: "Possible recycled claim",
    zombieBody: "This result has been flagged as potentially recycled or resurfacing news.",
    breakdownKicker: "CLAIM BREAKDOWN",
    breakdownTitle: "Pinpoint the difference",
    breakdownHint: "Select a segment to inspect its correction",
    inspect: "Click to inspect related evidence",
    related: "Related evidence is highlighted below.",
    legendTrue: "Verified",
    legendMisleading: "Misleading",
    legendFalse: "Contradicted",
    claimed: "WHAT WAS CLAIMED",
    reality: "THE REALITY",
    disclaimer:
      "ⓘ This report was returned by the live TruthLens backend. The consensus score is not a probability that a claim is true.",
    evKicker: "EVIDENCE & SOURCES",
    evTitle: "What the sources say",
    evCaption: "Direct quotes from the pages used to reach this verdict.",
    quotes: (n) => `${n} quotes`,
    searches: (s, a) => `${s}/${a} searches succeeded`,
    pagesRead: (n) => `${n} pages read`,
    sourcesConsidered: (n) => `${n} sources considered`,
    noEvidence: "No verified evidence quotes were returned for this claim.",
    evidenceNo: "Evidence",
    tier: "Tier",
    quoteVerified: "✓ Quote verified",
    quoteUnverified: "⚠ Unverified quote",
    readSource: "Read original source ↗",
    alsoConsulted: "Also consulted",
    sourcesConsulted: "Sources consulted",
    sourceLang: "Source language",
    verdicts: {
      SUPPORTED: "Supported",
      REFUTED: "Refuted",
      INSUFFICIENT_EVIDENCE: "Insufficient evidence",
      UNVERIFIED_NO_AUTHORITATIVE_SOURCES: "Unverified",
    },
    stances: { SUPPORTS: "Supports", CONTRADICTS: "Contradicts", CONTEXT: "Context", NONE: "None", TIED: "Tied" },
    labels: { TRUE: "True", MISLEADING: "Misleading", FALSE: "False" },
  },
  hi: {
    toggleLabel: "रिपोर्ट की भाषा",
    kicker: "जांच रिपोर्ट",
    title: "विश्लेषण के परिणाम",
    subtitle: "निर्णय देखें और उसके पीछे के प्रमाण जानें।",
    clear: "परिणाम हटाएं ×",
    share: "फैक्ट-कार्ड साझा करें",
    shareHint: "इस रिपोर्ट को प्रिंट करें या PDF के रूप में सहेजकर साझा करें",
    noExplanation: "कोई स्पष्टीकरण उपलब्ध नहीं है।",
    consensus: "सहमति स्कोर",
    noStance: "कोई प्रमुख रुख नहीं",
    zombieTitle: "संभावित रूप से पुराना दावा",
    zombieBody: "इस परिणाम को पुरानी खबर के दोबारा फैलने की आशंका के रूप में चिह्नित किया गया है।",
    breakdownKicker: "दावे का विश्लेषण",
    breakdownTitle: "अंतर की पहचान",
    breakdownHint: "सुधार देखने के लिए किसी हिस्से को चुनें",
    inspect: "संबंधित प्रमाण देखने के लिए क्लिक करें",
    related: "संबंधित प्रमाण नीचे हाइलाइट किए गए हैं।",
    legendTrue: "सत्यापित",
    legendMisleading: "भ्रामक",
    legendFalse: "खंडित",
    claimed: "क्या दावा किया गया",
    reality: "वास्तविकता",
    disclaimer:
      "ⓘ यह रिपोर्ट लाइव TruthLens बैकएंड से मिली है। सहमति स्कोर इस बात की संभावना नहीं है कि दावा सही है।",
    evKicker: "प्रमाण और स्रोत",
    evTitle: "स्रोत क्या कहते हैं",
    evCaption: "इस निर्णय तक पहुँचने के लिए प्रयुक्त पृष्ठों से सीधे उद्धरण।",
    quotes: (n) => `${n} उद्धरण`,
    searches: (s, a) => `${a} में से ${s} खोज सफल`,
    pagesRead: (n) => `${n} पृष्ठ पढ़े गए`,
    sourcesConsidered: (n) => `${n} स्रोतों पर विचार किया गया`,
    noEvidence: "इस दावे के लिए कोई सत्यापित उद्धरण नहीं मिला।",
    evidenceNo: "प्रमाण",
    tier: "स्तर",
    quoteVerified: "✓ उद्धरण सत्यापित",
    quoteUnverified: "⚠ असत्यापित उद्धरण",
    readSource: "मूल स्रोत पढ़ें ↗",
    alsoConsulted: "इनसे भी परामर्श लिया गया",
    sourcesConsulted: "परामर्श किए गए स्रोत",
    sourceLang: "स्रोत की भाषा",
    verdicts: {
      SUPPORTED: "समर्थित",
      REFUTED: "खंडित",
      INSUFFICIENT_EVIDENCE: "अपर्याप्त प्रमाण",
      UNVERIFIED_NO_AUTHORITATIVE_SOURCES: "असत्यापित",
    },
    stances: { SUPPORTS: "समर्थन", CONTRADICTS: "खंडन", CONTEXT: "संदर्भ", NONE: "कोई नहीं", TIED: "बराबरी" },
    labels: { TRUE: "सही", MISLEADING: "भ्रामक", FALSE: "गलत" },
  },
};
