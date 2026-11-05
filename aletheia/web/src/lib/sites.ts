/** Matches the most sites the server takes in one audit. */
export const MAX_SITES = 4;

const TONES = 5;

/** A readable name for any host: "www.adobe.com" gives "Adobe", "in.bookmyshow.com" "Bookmyshow". */
/** The brand's own name when the server knows it, otherwise one read from the address. */
export function siteName(host: string, known?: string | null): string {
  if (known) return known;
  const name = host.replace(/^(www|[a-z]{2})\.(?=[^.]+\.[^.]+)/, "").split(".")[0] ?? host;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Picks one of the avatar tints, the same one every time for a host. */
export function avatarTone(host: string): number {
  let sum = 0;
  for (const char of host) sum += char.codePointAt(0) ?? 0;
  return sum % TONES;
}

export interface PlannedSite {
  url: string;
  host: string;
}

type Parsed = { ok: true; url: string; host: string } | { ok: false; message: string };

const NOT_A_SITE = "Enter a site address, such as adobe.com.";

export function parseSite(input: string): Parsed {
  const text = input.trim();
  if (!text) return { ok: false, message: NOT_A_SITE };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, message: NOT_A_SITE };
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) {
    return { ok: false, message: NOT_A_SITE };
  }
  return { ok: true, url: url.href, host: url.hostname.replace(/^www\./, "") };
}

type Added = { ok: true; sites: PlannedSite[] } | { ok: false; message: string };

export function addSite(
  sites: readonly PlannedSite[],
  { url, host }: { url: string; host: string },
): Added {
  if (sites.some((site) => site.host === host)) {
    return { ok: false, message: `${host} is already on the list.` };
  }
  if (sites.length >= MAX_SITES) {
    return { ok: false, message: `One audit can cover ${MAX_SITES} sites.` };
  }
  return { ok: true, sites: [...sites, { url, host }] };
}
