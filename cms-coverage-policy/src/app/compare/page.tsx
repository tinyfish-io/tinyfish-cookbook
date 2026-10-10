import { db } from "@/lib/db";
import { Header } from "@/components/Header";
import { CompareRows } from "@/components/CompareRows";
import { STATE_NAMES, STATUS_LABELS, type CoverageStatus } from "@/lib/states";

export const dynamic = "force-dynamic";

const LEFT = "SC";
const RIGHT = "TX";

export default async function ComparePage() {
  const sql = db();
  const [condition] = await sql`select id, name from conditions where slug = 'cgm'`;
  const rows = await sql`
    select state, criterion, label, plain, verbatim, source_doc
    from criteria_rows where condition_id = ${condition.id} and state in (${LEFT}, ${RIGHT})
    order by id`;
  const records = await sql`
    select state, coverage_status, effective_date, administering_entity, source_doc, source_url, last_checked_at
    from coverage_records where condition_id = ${condition.id} and state in (${LEFT}, ${RIGHT})`;
  const [sweep] = await sql`select max(last_checked_at) as at from coverage_records`;

  type CriteriaBucket = { label: string; left?: (typeof rows)[number]; right?: (typeof rows)[number] };
  const criteria = new Map<string, CriteriaBucket>();
  for (const row of rows) {
    const bucket: CriteriaBucket = criteria.get(row.criterion) ?? { label: row.label };
    if (row.state === LEFT) bucket.left = row;
    else bucket.right = row;
    criteria.set(row.criterion, bucket);
  }
  const sides = [LEFT, RIGHT].map((st) => records.find((r) => r.state === st));

  return (
    <main className="min-h-screen">
      <Header active="compare" sweptLine={`Agents last swept all 51 policies ${formatSweep(String(sweep.at))}`} />
      <div className="mx-auto max-w-[1240px] px-16 pb-18 pt-10 max-lg:px-6">
        <div className="mb-3 flex gap-2">
          <span className="filter-chip">{condition.name}</span>
          <span className="filter-chip">Medicaid</span>
        </div>
        <h1 className="h-serif mb-2 text-[38px]">
          {STATE_NAMES[LEFT]} vs. {STATE_NAMES[RIGHT]}
        </h1>
        <p className="mb-8 max-w-[640px] text-base leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          The same device, two rulebooks. Rows where the states disagree are gently highlighted; expand any row for the exact
          policy wording.
        </p>

        <div className="grid grid-cols-[200px_1fr_1fr] items-stretch gap-3.5 max-md:grid-cols-1">
          <div className="max-md:hidden" />
          {sides.map(
            (side) =>
              side && (
                <div key={side.state} className="card">
                  <div className="flex items-center justify-between gap-2.5">
                    <h2 className="h-serif text-[23px]">{STATE_NAMES[side.state]}</h2>
                    <span className="chip" style={{ padding: "5px 11px", fontSize: 12 }}>
                      <span className="fresh-dot" style={{ width: 6, height: 6 }} aria-hidden />
                      {formatChecked(String(side.last_checked_at))}
                    </span>
                  </div>
                  <span className={`pill pill-${side.coverage_status} mt-3`} style={{ display: "inline-block" }}>
                    {STATUS_LABELS[side.coverage_status as CoverageStatus]}
                  </span>
                  <div className="mt-3.5 text-[13.5px] leading-relaxed" style={{ color: "var(--color-faint)" }}>
                    Run by <strong style={{ color: "var(--color-body)" }}>{side.administering_entity ?? `${STATE_NAMES[side.state]} Medicaid`}</strong>
                    <br />
                    {side.source_url ? (
                      <a href={side.source_url} target="_blank" rel="noreferrer" className="font-semibold text-[13.5px]">
                        {side.source_doc} ↗
                      </a>
                    ) : (
                      side.source_doc
                    )}
                  </div>
                </div>
              ),
          )}

          <CompareRows
            rows={[...criteria.entries()].map(([criterion, bucket]) => ({
              criterion,
              label: bucket.label,
              differs: (bucket.left?.plain ?? "") !== (bucket.right?.plain ?? ""),
              left: { plain: bucket.left?.plain ?? "—", verbatim: bucket.left?.verbatim ?? null, source: bucket.left?.source_doc ?? null },
              right: { plain: bucket.right?.plain ?? "—", verbatim: bucket.right?.verbatim ?? null, source: bucket.right?.source_doc ?? null },
            }))}
          />
        </div>
      </div>
    </main>
  );
}

function formatChecked(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Checked today, ${time}` : `Checked ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
function formatSweep(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? `today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
