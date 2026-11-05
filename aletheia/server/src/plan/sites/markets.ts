import type { CountrySites } from "../types.ts";
import { GB_SITES } from "./gb.ts";
import { IN_SITES } from "./in.ts";
import { US_SITES } from "./us.ts";
import { WORLD_MARKETS } from "./world.ts";

/** The largest online markets by revenue. Any other country goes through Search. */
export const MARKETS: Readonly<Record<string, CountrySites>> = {
  US: US_SITES,
  GB: GB_SITES,
  IN: IN_SITES,
  ...WORLD_MARKETS,
};
