export interface SiteOverride {
  /** Where the login is, for a site whose home page has no way in. */
  loginUrl: string;
}

/** Only for pages the general rules cannot read. Each entry should say why it is here. */
const OVERRIDES: Readonly<Record<string, SiteOverride>> = {
  // A desktop visitor to the home page gets an app download page with no Log in button at all.
  "zomato.com": { loginUrl: "https://www.zomato.com/ncr/restaurants" },
};

export function overrideFor(host: string): SiteOverride | null {
  const parts = host.split(".");
  for (let start = 0; start < parts.length - 1; start += 1) {
    const override = OVERRIDES[parts.slice(start).join(".")];
    if (override) return override;
  }
  return null;
}
