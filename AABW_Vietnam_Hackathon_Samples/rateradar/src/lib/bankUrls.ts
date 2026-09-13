// Starting URLs per bank. Where a specific rate/product page was already
// found (Vietcombank, Techcombank, VPBank) it's used as a shortcut — for
// every other bank the agent starts at the homepage and navigates itself,
// which is the standard path, not a degraded fallback.
export const BANK_RATE_PAGE: Record<string, string> = {
  vietcombank: "https://www.vietcombank.com.vn/en/Personal/Cong-cu-Tien-ich/KHCN---Lai-suat",
  techcombank: "https://techcombank.com/en/tools-utilities/interest-rates",
  vpbank: "https://www.vpbank.com.vn/ca-nhan/tiet-kiem",
  bidv: "https://bidv.com.vn",
  mbbank: "https://mbbank.com.vn"
};

export const BANK_APPLICATION_PAGE: Record<string, { savings: string; loan: string }> = {
  vietcombank: {
    savings: "https://www.vietcombank.com.vn/en/Personal/SPDV/Tiet-kiem",
    loan: "https://www.vietcombank.com.vn/en/Personal/SPDV/Vay"
  },
  techcombank: {
    savings: "https://techcombank.com/en/personal/save",
    loan: "https://techcombank.com"
  },
  vpbank: {
    savings: "https://www.vpbank.com.vn/ca-nhan/tiet-kiem",
    loan: "https://www.vpbank.com.vn"
  },
  bidv: { savings: "https://bidv.com.vn", loan: "https://bidv.com.vn" },
  mbbank: { savings: "https://mbbank.com.vn", loan: "https://mbbank.com.vn" }
};

export function getStartUrl(bankId: string, kind: "savings" | "loan"): string {
  return BANK_APPLICATION_PAGE[bankId]?.[kind] ?? BANK_RATE_PAGE[bankId] ?? `https://${bankId}.com.vn`;
}
