import { Bank } from "./types";

// Shinhan's own rates are displayed directly (this build is explicitly
// sponsored by Shinhan) but never scraped from their own site — a bank
// already knows its own published rates internally.
export const OUR_BANK: Bank = { id: "shinhan", name: "Shinhan Bank", domain: "shinhan.com.vn", isSponsor: true };

// Real competitor banks in the Vietnam retail banking market — checked
// live, in parallel, every day.
export const COMPETITOR_BANKS: Bank[] = [
  { id: "vietcombank", name: "Vietcombank", domain: "vietcombank.com.vn" },
  { id: "techcombank", name: "Techcombank", domain: "techcombank.com.vn" },
  { id: "vpbank", name: "VPBank", domain: "vpbank.com.vn" },
  { id: "bidv", name: "BIDV", domain: "bidv.com.vn" },
  { id: "mbbank", name: "MB Bank", domain: "mbbank.com.vn" }
];

export const BANKS: Bank[] = [OUR_BANK, ...COMPETITOR_BANKS];
