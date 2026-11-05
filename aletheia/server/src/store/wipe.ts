import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { readJson, writeJson } from "./jsonFile.ts";

const LOGIN_DOMAINS_FILE = "login-domains.json";
const SIGNINS_FILE = "signins.json";

export interface WipeInput {
  dataDir: string;
  /** Null when there is no API key, so saved sign-ins cannot be removed from TinyFish. */
  deleteProfile: ((profileId: string) => Promise<void>) | null;
}

export interface WipeResult {
  audits: number;
  profilesDeleted: number;
  profilesLeft: string[];
}

interface SavedSignIn {
  profileId: string;
}

async function isDeleted(
  profileId: string,
  deleteProfile: WipeInput["deleteProfile"],
): Promise<boolean> {
  if (!deleteProfile) return false;
  return deleteProfile(profileId).then(
    () => true,
    () => false,
  );
}

/** Removes only what the app writes, so a wrong DATA_DIR cannot take other files with it. */
export async function wipeData({ dataDir, deleteProfile }: WipeInput): Promise<WipeResult> {
  const signInsPath = join(dataDir, SIGNINS_FILE);
  const signIns = (await readJson<SavedSignIn[]>(signInsPath)) ?? [];

  const left: SavedSignIn[] = [];
  for (const signIn of signIns) {
    if (!(await isDeleted(signIn.profileId, deleteProfile))) left.push(signIn);
  }

  // A sign-in left behind still holds cookies at TinyFish, so its record has to survive.
  if (left.length > 0) await writeJson(signInsPath, left);
  else await rm(signInsPath, { force: true });

  const auditsDir = join(dataDir, "audits");
  const audits = await readdir(auditsDir).catch(() => []);
  await rm(auditsDir, { recursive: true, force: true });
  await rm(join(dataDir, LOGIN_DOMAINS_FILE), { force: true });

  return {
    audits: audits.length,
    profilesDeleted: signIns.length - left.length,
    profilesLeft: left.map((signIn) => signIn.profileId),
  };
}
