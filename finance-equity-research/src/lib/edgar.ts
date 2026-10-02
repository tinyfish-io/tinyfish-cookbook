// EDGAR is a structured public API — parse it in code. No LLM, no hallucination
// surface: every row is a real filing with a real URL.

type Submissions = {
  cik: string;
  name: string;
  filings: {
    recent: {
      form: string[];
      filingDate: string[];
      accessionNumber: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
      items: string[];
    };
  };
};

export type EdgarFiling = {
  form: string;
  filedOn: string;
  items: string;
  description: string;
  url: string;
  isLeadershipEvent: boolean; // 8-K Item 5.02
};

export type EdgarRead = {
  filings: EdgarFiling[];
  leadershipEvents: EdgarFiling[];
  familyRead: number;
  note: string;
};

export async function readEdgar(cik: string, windowDays = 365): Promise<EdgarRead> {
  const padded = cik.padStart(10, "0");
  const response = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
    headers: { "User-Agent": "Upstream research demo contact@tinyfish.ai" },
  });
  if (!response.ok) throw new Error(`EDGAR returned ${response.status}`);
  const data = (await response.json()) as Submissions;

  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const recent = data.filings.recent;
  const filings: EdgarFiling[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.filingDate[i] < cutoff) continue;
    const accession = recent.accessionNumber[i].replaceAll("-", "");
    filings.push({
      form: recent.form[i],
      filedOn: recent.filingDate[i],
      items: recent.items[i] ?? "",
      description: recent.primaryDocDescription[i] ?? "",
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${recent.primaryDocument[i]}`,
      isLeadershipEvent: recent.form[i].startsWith("8-K") && (recent.items[i] ?? "").includes("5.02"),
    });
  }

  const leadershipEvents = filings.filter((f) => f.isLeadershipEvent);
  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  const newest = leadershipEvents[0];

  // deterministic read: officer-change filings are adverse-leaning signals; recency decays it
  let familyRead = 55;
  let note = `No officer-change filings (8-K Item 5.02) in the last ${windowDays} days.`;
  if (newest) {
    const age = daysSince(newest.filedOn);
    familyRead = age <= 90 ? 35 : age <= 180 ? 45 : 52;
    note = `Officer change filed ${newest.filedOn} (8-K Item 5.02), ${age} days ago.`;
  }

  return { filings, leadershipEvents, familyRead, note };
}
