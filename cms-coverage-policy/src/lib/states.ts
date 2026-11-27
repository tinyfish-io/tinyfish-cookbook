// Tile-grid coordinates (row, col in an 11-column grid) — the standard
// equal-size state tile map arrangement, as used in the locked design handoff.
export const STATE_TILES: [code: string, name: string, row: number, col: number][] = [
  ["AK", "Alaska", 1, 1], ["ME", "Maine", 1, 11],
  ["VT", "Vermont", 2, 10], ["NH", "New Hampshire", 2, 11],
  ["WA", "Washington", 3, 1], ["ID", "Idaho", 3, 2], ["MT", "Montana", 3, 3], ["ND", "North Dakota", 3, 4],
  ["MN", "Minnesota", 3, 5], ["IL", "Illinois", 3, 6], ["WI", "Wisconsin", 3, 7], ["MI", "Michigan", 3, 8],
  ["NY", "New York", 3, 9], ["MA", "Massachusetts", 3, 10],
  ["OR", "Oregon", 4, 1], ["NV", "Nevada", 4, 2], ["WY", "Wyoming", 4, 3], ["SD", "South Dakota", 4, 4],
  ["IA", "Iowa", 4, 5], ["IN", "Indiana", 4, 6], ["OH", "Ohio", 4, 7], ["PA", "Pennsylvania", 4, 8],
  ["NJ", "New Jersey", 4, 9], ["CT", "Connecticut", 4, 10], ["RI", "Rhode Island", 4, 11],
  ["CA", "California", 5, 1], ["UT", "Utah", 5, 2], ["CO", "Colorado", 5, 3], ["NE", "Nebraska", 5, 4],
  ["MO", "Missouri", 5, 5], ["KY", "Kentucky", 5, 6], ["WV", "West Virginia", 5, 7], ["VA", "Virginia", 5, 8],
  ["MD", "Maryland", 5, 9], ["DE", "Delaware", 5, 10],
  ["AZ", "Arizona", 6, 2], ["NM", "New Mexico", 6, 3], ["KS", "Kansas", 6, 4], ["AR", "Arkansas", 6, 5],
  ["TN", "Tennessee", 6, 6], ["NC", "North Carolina", 6, 7], ["SC", "South Carolina", 6, 8],
  ["DC", "District of Columbia", 6, 9],
  ["OK", "Oklahoma", 7, 4], ["LA", "Louisiana", 7, 5], ["MS", "Mississippi", 7, 6], ["AL", "Alabama", 7, 7],
  ["GA", "Georgia", 7, 8],
  ["HI", "Hawaii", 8, 1], ["TX", "Texas", 8, 4], ["FL", "Florida", 8, 9],
];

export const STATE_NAMES = Object.fromEntries(STATE_TILES.map(([code, name]) => [code, name]));

export type CoverageStatus = "covered" | "limits" | "prior" | "not" | "none";

export const STATUS_LABELS: Record<CoverageStatus, string> = {
  covered: "Covered",
  limits: "Covered with limits",
  prior: "Needs prior approval",
  not: "Not covered",
  none: "No published policy",
};

export const STATUS_ORDER: CoverageStatus[] = ["covered", "limits", "prior", "not", "none"];
