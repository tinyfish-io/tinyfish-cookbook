import { db } from "@/lib/db";
import { Header } from "@/components/Header";
import { STATUS_LABELS, type CoverageStatus } from "@/lib/states";

export const dynamic = "force-dynamic";

export default async function ChangesPage({ searchParams }: PageProps<"/changes">) {
  const params = await searchParams;
  const slug = params.condition === "cgm" ? "cgm" : "glp1_obesity";
  const sql = db();
  const [condition] = await sql`select id, name from conditions where slug = ${slug}`;
  const changes = await sql`
    select state, headline, from_status, to_status, change_type, announced_on, effective_on,
      source_doc, source_url, note, last_checked_at
    from change_events where condition_id = ${condition.id}
    order by announced_on desc`;
  const [sweep] = await sql`select max(last_checked_at) as at from coverage_records`;

  return (
    <main className="min-h-screen">
      <Header active="changes" sweptLine={`Agents last swept all 51 policies ${formatSweep(String(sweep.at))}`} />
      <div className="mx-auto max-w-[1080px] px-16 pb-18 pt-10 max-lg:px-6">
        <div className="mb-3 flex gap-2">
          <span className="filter-chip">{condition.name}</span>
          <span className="filter-chip">Medicaid</span>
        </div>
        <h1 className="h-serif mb-2 text-[38px]">What changed this year</h1>
        <p className="mb-10 max-w-[640px] text-base leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          Every policy change our agents caught in the last 12 months, newest first. Each one links to the official document it
          came from.
        </p>

        {changes.length === 0 && (
          <div className="card py-10 text-center text-[15px]" style={{ color: "var(--color-secondary)" }}>
            No policy changes caught for this condition yet — the agents flag them the moment a sweep sees one.
          </div>
        )}
        <div className="flex flex-col">
          {changes.map((change, i) => {
            const dropping = change.to_status === "not";
            return (
              <div key={i} className="grid grid-cols-[130px_28px_1fr] gap-x-4 max-md:grid-cols-[90px_20px_1fr]">
                <div className="pt-6 text-right text-[14.5px] font-bold" style={{ color: "var(--color-faint)" }}>
                  {formatDate(String(change.announced_on))}
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-0.5 flex-1" style={{ background: "var(--color-border-chip)" }} />
                  <div
                    className="my-1 size-3.5 rounded-full"
                    style={{
                      background: dropping ? "var(--color-drop)" : "var(--color-fresh)",
                      border: "3px solid var(--color-page)",
                      boxShadow: `0 0 0 2px ${dropping ? "var(--color-drop)" : "var(--color-fresh)"}`,
                    }}
                  />
                  <div className="w-0.5 flex-1" style={{ background: "var(--color-border-chip)" }} />
                </div>
                <div className="card my-2.5">
                  <h3 className="h-serif mb-3 text-[21px]" style={{ letterSpacing: "-0.005em" }}>
                    {change.headline}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`pill pill-${change.from_status}`} style={{ padding: "5px 13px", fontSize: 13.5 }}>
                      {STATUS_LABELS[change.from_status as CoverageStatus]}
                    </span>
                    <span style={{ color: "var(--color-disabled)" }}>→</span>
                    <span className={`pill pill-${change.to_status}`} style={{ padding: "5px 13px", fontSize: 13.5 }}>
                      {STATUS_LABELS[change.to_status as CoverageStatus]}
                    </span>
                  </div>
                  {change.note && (
                    <div className="quote-panel mt-3.5 rounded-xl px-4 py-3 text-[14.5px] leading-normal" style={{ color: "var(--color-body)" }}>
                      <strong style={{ color: "var(--color-heading)" }}>What happened next:</strong> {change.note}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-[13.5px]" style={{ color: "var(--color-faint)" }}>
                    {change.effective_on && (
                      <span>
                        Effective <strong style={{ color: "var(--color-body)" }}>{formatDate(String(change.effective_on))}</strong>
                      </span>
                    )}
                    <span>·</span>
                    {change.source_url ? (
                      <a href={change.source_url} target="_blank" rel="noreferrer" className="font-semibold text-[13.5px]">
                        {change.source_doc} ↗
                      </a>
                    ) : (
                      <span>{change.source_doc}</span>
                    )}
                    <span className="chip ml-auto" style={{ padding: "4px 11px", fontSize: 12 }}>
                      <span className="fresh-dot" style={{ width: 6, height: 6 }} aria-hidden />
                      {formatChecked(String(change.last_checked_at))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatChecked(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? `Checked today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : `Checked ${formatDate(iso)}`;
}
function formatSweep(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? `today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
