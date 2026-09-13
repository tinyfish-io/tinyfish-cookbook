import { getDefaultCategory, getDefaultLocation } from "@/lib/config";

/** Starter values for the analysis console — editable before each run. */
export function getAnalysisPrefills() {
  const market = getDefaultLocation() || "TP.HCM";

  return {
    menuItems: "Cà phê sữa đá\nBạc xỉu\nTrà đào",
    menuLocation: market,
    trendName: "Matcha latte",
    forecastLocation: market,
    regionA: "Hà Nội",
    regionB: market === "Hà Nội" ? "TP.HCM" : market,
    category: getDefaultCategory(),
    supplierTrend: "Matcha latte",
    ingredients: "matcha powder, coconut cream",
    supplierLocation: market,
    supplierInfo: "Example Supplier Co. — procurement@example.com",
    productNeeds: "Ceremonial matcha and coconut cream for cafe menu testing",
  };
}
