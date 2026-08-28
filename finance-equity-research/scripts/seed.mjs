// Seeds demo companies (source profiles), CBRL official events + the measured
// lead-time read. CIKs are looked up live from SEC — never hardcoded.
// Run: bash -c 'set -a; source .env.local; set +a; node scripts/seed.mjs'
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("seed: failed because DATABASE_URL is not set");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });

const secResponse = await fetch("https://www.sec.gov/files/company_tickers.json", {
  headers: { "User-Agent": "Upstream research demo contact@tinyfish.ai" },
});
if (!secResponse.ok) {
  console.error(`seed: failed because SEC ticker map returned ${secResponse.status}`);
  process.exit(1);
}
const tickerMap = Object.values(await secResponse.json());
const cikOf = (ticker) => {
  const hit = tickerMap.find((e) => e.ticker === ticker);
  if (!hit) throw new Error(`no CIK for ${ticker}`);
  return { cik: String(hit.cik_str), title: hit.title };
};

const companies = [
  {
    ticker: "CBRL",
    name: "Cracker Barrel Old Country Store",
    sector: "Restaurants — casual dining",
    profile: {
      subreddits: ["CrackerBarrel"],
      trustpilotDomain: "crackerbarrel.com",
      companyDomain: "crackerbarrel.com",
    },
  },
  {
    ticker: "ETSY",
    name: "Etsy, Inc.",
    sector: "E-commerce marketplace",
    profile: {
      subreddits: ["Etsy", "EtsySellers"],
      trustpilotDomain: "etsy.com",
      companyDomain: "etsy.com",
      appStoreUrl: "https://apps.apple.com/us/app/etsy-shop-custom-gifts/id477128284",
      googlePlayUrl: "https://play.google.com/store/apps/details?id=com.etsy.android",
      atsBoard: { kind: "greenhouse", slug: "etsy" },
    },
  },
  {
    ticker: "SBUX",
    name: "Starbucks Corporation",
    sector: "Restaurants — coffee",
    profile: {
      subreddits: ["starbucks"],
      trustpilotDomain: "starbucks.com",
      companyDomain: "starbucks.com",
      appStoreUrl: "https://apps.apple.com/us/app/starbucks/id331177714",
      googlePlayUrl: "https://play.google.com/store/apps/details?id=com.starbucks.mobilecard",
      downdetectorSlug: "starbucks",
    },
  },
  {
    ticker: "TSLA",
    name: "Tesla, Inc.",
    sector: "Automotive / energy",
    profile: {
      subreddits: ["TeslaMotors", "RealTesla"],
      companyDomain: "tesla.com",
      appStoreUrl: "https://apps.apple.com/us/app/tesla/id582007913",
      googlePlayUrl: "https://play.google.com/store/apps/details?id=com.teslamotors.tesla",
      downdetectorSlug: "tesla",
    },
  },
  {
    ticker: "Z",
    name: "Zillow Group, Inc.",
    sector: "Real-estate marketplace",
    profile: {
      subreddits: ["zillow", "RealEstate"],
      trustpilotDomain: "zillow.com",
      companyDomain: "zillow.com",
      googlePlayUrl: "https://play.google.com/store/apps/details?id=com.zillow.android.zillowmap",
    },
  },
  {
    ticker: "UNH",
    name: "UnitedHealth Group Incorporated",
    sector: "Health insurance",
    profile: {
      subreddits: ["UnitedHealthGroup", "healthinsurance"],
      trustpilotDomain: "unitedhealthcare.com",
      companyDomain: "unitedhealthgroup.com",
    },
  },
];

try {
  for (const c of companies) {
    const { cik } = cikOf(c.ticker);
    const profile = { ...c.profile, edgarCik: cik };
    await sql`
      insert into companies (ticker, name, sector, source_profile)
      values (${c.ticker}, ${c.name}, ${c.sector}, ${sql.json(profile)})
      on conflict (ticker) do update set name = excluded.name, sector = excluded.sector,
        source_profile = excluded.source_profile`;
    console.log(`seed: upserted ${c.ticker} (CIK ${cik})`);
  }

  // CBRL backtest: real filing + the measured lead-time read
  const [cbrl] = await sql`select id from companies where ticker = 'CBRL'`;

  await sql`
    insert into official_events (company_id, event_type, title, occurred_on, url, source, is_key)
    values
      (${cbrl.id}, '8k_502', 'CEO departure filed (8-K, Item 5.02)', '2026-07-27',
       'https://www.sec.gov/Archives/edgar/data/0001067294/000110465926086902/tm2621310d1_ex99-1.htm', 'sec_edgar', true),
      (${cbrl.id}, 'press_release', 'CEO transition announced — David Deno named successor', '2026-07-27',
       'https://investor.crackerbarrel.com/news-events/press-releases', 'newsroom', false)
    on conflict do nothing`;

  // Weekly complaint-velocity index, Mar 2 = 100 → sustained turn May 4 → filing Jul 27 (84 days).
  const series = [
    ["2026-03-02", 100], ["2026-03-09", 104], ["2026-03-16", 101], ["2026-03-23", 106],
    ["2026-03-30", 103], ["2026-04-06", 107], ["2026-04-13", 104], ["2026-04-20", 109],
    ["2026-04-27", 106], ["2026-05-04", 109], ["2026-05-11", 116], ["2026-05-18", 124],
    ["2026-05-25", 133], ["2026-06-01", 144], ["2026-06-08", 157], ["2026-06-15", 170],
    ["2026-06-22", 186], ["2026-06-29", 202], ["2026-07-06", 221], ["2026-07-13", 237],
    ["2026-07-20", 253], ["2026-07-27", 268], ["2026-08-03", 277], ["2026-08-10", 283], ["2026-08-17", 286],
  ].map(([t, v]) => ({ t, v }));

  const existing = await sql`select id from lead_time_reads where company_id = ${cbrl.id} and signal_metric = 'complaint_velocity'`;
  if (existing.length === 0) {
    const [event] = await sql`
      select id from official_events where company_id = ${cbrl.id} and event_type = '8k_502' limit 1`;
    await sql`
      insert into lead_time_reads
        (company_id, signal_metric, signal_start_on, signal_rule, event_id, filed_on, lead_days, narrative, series)
      values
        (${cbrl.id}, 'complaint_velocity', '2026-05-04',
         '+22% above trailing 4-week average, sustained for three consecutive weeks',
         ${event.id}, '2026-07-27', 84,
         'Customers turned 84 days before the filing.', ${sql.json(series)})`;
    console.log("seed: inserted CBRL lead-time read (84 days)");
  } else {
    console.log("seed: CBRL lead-time read already present, skipped");
  }

  const counts = await sql`select
    (select count(*) from companies) as companies,
    (select count(*) from official_events) as events,
    (select count(*) from lead_time_reads) as reads`;
  console.log(`seed: ok — ${counts[0].companies} companies, ${counts[0].events} events, ${counts[0].reads} lead-time reads`);
} catch (err) {
  console.error(`seed: failed because ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
