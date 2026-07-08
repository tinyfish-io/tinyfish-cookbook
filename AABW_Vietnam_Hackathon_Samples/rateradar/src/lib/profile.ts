import { ApplicantProfile } from "./types";
import { storeGet, storeSet } from "./storage";

const PROFILE_KEY = "applicant-profile";

// Shown until the person fills in their own — realistic Vietnam values,
// not placeholder-looking zeros, so the rest of the app (application
// drafts, monthly payment estimates) demos sensibly from the first run.
export const DEFAULT_PROFILE: ApplicantProfile = {
  name: "Nguyen Van An",
  phone: "0912 345 678",
  monthlyIncomeVND: 35000000,
  productId: "home-loan",
  amountVND: 800000000,
  tenureMonths: 240
};

export async function getProfile(): Promise<ApplicantProfile> {
  const saved = await storeGet<ApplicantProfile>(PROFILE_KEY);
  return saved ?? DEFAULT_PROFILE;
}

export async function setProfile(profile: ApplicantProfile): Promise<void> {
  await storeSet(PROFILE_KEY, profile);
}
