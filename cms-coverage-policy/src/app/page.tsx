import { db } from "@/lib/db";
import { Header } from "@/components/Header";
import { MapView, type CoverageRecord } from "@/components/MapView";

export const dynamic = "force-dynamic";

export default async function MapPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const slug = params.condition === "cgm" ? "cgm" : "glp1_obesity";
  const sql = db();
  const conditions = await sql`select id, name, slug from conditions order by id`;
  const condition = conditions.find((c) => c.slug === slug)!;
  const records = (await sql`
    select state, coverage_status, criteria_summary, criteria_raw_excerpt, administering_entity,
      source_doc, source_url, effective_date, dropped_this_year, last_checked_at
    from coverage_records where condition_id = ${condition.id} order by state`) as unknown as CoverageRecord[];

  const covered = records.filter((r) => r.coverage_status === "covered" || r.coverage_status === "limits").length;
  const dropped = records.filter((r) => r.dropped_this_year).length;
  const [sweep] = await sql`select max(last_checked_at) as at from coverage_records`;

  return (
    <main className="min-h-screen">
      <Header active="map" sweptLine={`Agents last swept all 51 policies ${formatSweep(String(sweep.at))}`} />
      <div className="mx-auto max-w-[1440px] px-16 pb-18 pt-10 max-lg:px-6">
        <div className="mb-7 flex items-end gap-6 max-lg:flex-col max-lg:items-start">
          <div>
            <div className="mb-3 flex gap-2">
              {conditions.map((c) => (
                <a
                  key={c.slug}
                  href={c.slug === "glp1_obesity" ? "/" : `/?condition=${c.slug}`}
                  className="filter-chip !no-underline"
                  style={c.slug === slug ? { background: "var(--color-primary)", color: "#fffdf9", borderColor: "var(--color-primary)" } : undefined}
                >
                  {c.name}
                </a>
              ))}
              <span className="filter-chip">Medicaid</span>
            </div>
            <h1 className="h-serif text-[38px] leading-[1.15]">
              {slug === "cgm" ? "Where Medicaid covers continuous glucose monitors" : "Where Medicaid covers GLP-1s for weight loss"}
            </h1>
          </div>
          <div className="ml-auto flex gap-3 max-lg:ml-0">
            <StatCard big={`${covered} of 51`} sub="states cover it today" color="oklch(0.45 0.11 155)" />
            <StatCard big={`${dropped}`} sub="states dropped it this year" color="var(--color-drop)" />
            {slug === "glp1_obesity" && <StatCard big="~80%" sub="of patients have no covered pathway" color="var(--color-body)" />}
          </div>
        </div>
        <MapView records={records} conditionSlug={slug} />
      </div>
    </main>
  );
}

function StatCard({ big, sub, color }: { big: string; sub: string; color: string }) {
  return (
    <div className="min-w-[150px] rounded-[18px] border px-5 py-4" style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}>
      <div className="h-serif text-[28px]" style={{ color }}>{big}</div>
      <div className="mt-0.5 text-[13.5px] leading-snug" style={{ color: "var(--color-secondary)" }}>{sub}</div>
    </div>
  );
}

function formatSweep(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? `today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
