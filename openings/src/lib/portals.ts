import { tinyfish } from "./tinyfish";
import { classifyUrl } from "./ats";

/**
 * Reduce any posting URL on a JS-app ATS to the portal's root, where Agent can search.
 *   jobs.ashbyhq.com/notion/3fba…              -> https://jobs.ashbyhq.com/notion
 *   nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/… -> https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite
 */
export function portalRoot(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const { ats } = classifyUrl(url);
  const segs = u.pathname.split("/").filter(Boolean);
  if (ats === "ashby" && segs[0]) return `https://${u.hostname}/${segs[0]}`;
  if (ats === "workday") {
    const site = /^[a-z]{2}-[A-Z]{2}$/.test(segs[0] ?? "") ? segs[1] : segs[0];
    return site ? `https://${u.hostname}/${site}` : null;
  }
  return null;
}

const PORTAL_DOMAINS = "jobs.ashbyhq.com,myworkdayjobs.com";

/**
 * TinyFish Search: find where a company hosts its jobs when it isn't on Greenhouse/Lever
 * (i.e. a JS-app portal that only Agent can list). Returns null if nothing credible is found.
 */
export async function findPortal(company: string): Promise<string | null> {
  const name = company.replace(/[-_]+/g, " ");
  const res = await tinyfish().search.query({
    query: `${name} careers jobs`,
    include_domains: PORTAL_DOMAINS,
    purpose: `Find the official careers portal where ${name} lists its open jobs`,
  });
  const key = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const r of res.results) {
    const root = portalRoot(r.url);
    // The portal slug/subdomain must look like the company, or we'd send Agent to someone else's site.
    if (root && root.toLowerCase().replace(/[^a-z0-9]/g, "").includes(key.slice(0, 5))) return root;
  }
  return null;
}
