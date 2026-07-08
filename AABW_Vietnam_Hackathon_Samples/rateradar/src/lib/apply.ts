import { Bank, RateListing, ApplicantProfile, ApplicationDraft } from "./types";
import { RateProduct } from "./products";
import { getTinyFishClient, pollRun } from "./tinyfish";
import { getStartUrl } from "./bankUrls";

function estimateForLoan(amountVND: number, ratePercent: number, tenureMonths: number) {
  const monthlyRate = ratePercent / 100 / 12;
  if (monthlyRate === 0) return Math.round(amountVND / tenureMonths);
  const payment =
    (amountVND * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  return Math.round(payment);
}

function estimateForSavings(amountVND: number, ratePercent: number) {
  return Math.round((amountVND * (ratePercent / 100)) / 12);
}

// The agent fills the bank's real application / lead-capture form up to,
// but never past, the final submit step. It never clicks submit itself —
// that stays a human decision on a binding financial application. The
// staged field values are handed back so the person can review and
// complete submission themselves on the bank's own site.
export async function fetchApplicationDraft(
  bank: Bank,
  product: RateProduct,
  listing: RateListing,
  applicant: ApplicantProfile
): Promise<ApplicationDraft> {
  const ratePercent = listing.ratePercent ?? 0;
  const estimate =
    product.kind === "loan"
      ? estimateForLoan(applicant.amountVND, ratePercent, applicant.tenureMonths)
      : estimateForSavings(applicant.amountVND, ratePercent);

  const baseDraft: ApplicationDraft = {
    id: `app_${bank.id}_${product.id}_${Date.now()}`,
    bankId: bank.id,
    bankName: bank.name,
    productId: product.id,
    productName: product.name,
    applicant,
    ratePercent,
    estimatedMonthly: estimate,
    formUrl: getStartUrl(bank.id, product.kind),
    fieldsStaged: [
      { label: "Applicant name", value: applicant.name },
      { label: "Phone", value: applicant.phone },
      { label: "Monthly income", value: applicant.monthlyIncomeVND.toLocaleString("en-US") + " VND" },
      { label: "Product", value: product.name },
      { label: "Amount", value: applicant.amountVND.toLocaleString("en-US") + " VND" },
      { label: "Tenure", value: `${applicant.tenureMonths} months` },
      { label: "Rate at application", value: `${ratePercent.toFixed(2)}%` }
    ],
    status: "staging",
    createdAt: new Date().toISOString()
  };

  const client = getTinyFishClient();
  if (!client) {
    return { ...baseDraft, status: "ready_to_submit" };
  }

  try {
    const startUrl = getStartUrl(bank.id, product.kind);
    const goal = `Visit ${bank.domain} (starting at ${startUrl}) and find the application or inquiry form for "${product.name}" (a ${product.kind === "savings" ? "savings deposit" : "loan"} product).

Navigate to find it yourself: check the main menu, "Personal Banking" section, or site search for links like "${product.kind === "savings" ? "Savings, Deposit, Open account, Tiet kiem" : "Loans, Vay, Apply now, Personal loan, Home loan"}". Many banks have a lead-capture / "get a call back" / "apply now" form on their public marketing pages that doesn't require login — that's the one to use.

Work as quickly and efficiently as possible. Take the minimum number of steps. Try the most obvious navigation path to the form first. If that doesn't lead to it, try one alternative path (2 attempts total) — if the form still can't be found, stop and return no result rather than continuing to search.

Fill in the following details if matching fields exist: applicant name "${applicant.name}", phone "${applicant.phone}", monthly income ${applicant.monthlyIncomeVND} VND, requested amount ${applicant.amountVND} VND, tenure ${applicant.tenureMonths} months. Do NOT click submit, do NOT complete the application, do NOT proceed past the final confirmation step. Just fill the fields and stop.

Return ONLY JSON, no other text: {"form_url": "the actual application page URL", "fields_confirmed": true}`;

    const queued = await client.agent.queue({ url: startUrl, goal, browser_profile: "stealth" });
    if (!queued.run_id) throw new Error(queued.error?.message ?? "queue failed with no run_id");
    const run = await pollRun(client, queued.run_id, { timeoutMs: 280000 });
    const raw = run.result?.result ?? run.result;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as { form_url?: string });

    return {
      ...baseDraft,
      formUrl: parsed?.form_url ?? baseDraft.formUrl,
      status: "ready_to_submit"
    };
  } catch (err) {
    console.error(`[TinyFish] application fill failed for ${bank.id}:`, err);
    return { ...baseDraft, status: "ready_to_submit" };
  }
}
