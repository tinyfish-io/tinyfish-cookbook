export type RateProduct = {
  id: string;
  name: string;
  kind: "savings" | "loan";
  unit: "apy" | "interest_rate"; // how the rate should be labeled
};

// Three products, spanning both sides of the brief — savings yield and
// loan rates — mirroring the 3-product scope used in the Retail build.
export const PRODUCTS: RateProduct[] = [
  { id: "savings-12m", name: "12-month savings deposit", kind: "savings", unit: "apy" },
  { id: "home-loan", name: "Home loan (mortgage)", kind: "loan", unit: "interest_rate" },
  { id: "personal-loan", name: "Personal loan", kind: "loan", unit: "interest_rate" }
];
