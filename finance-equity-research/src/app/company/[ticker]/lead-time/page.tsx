import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

type SeriesPoint = { t: string; v: number };
type EventMark = { title: string; occurred_on: string; is_key: boolean; url: string | null };

export default async function LeadTimePage({ params }: PageProps<"/company/[ticker]/lead-time">) {
  const { ticker } = await params;
  const sql = db();

  const [company] = await sql`select id, ticker, name from companies where ticker = ${ticker.toUpperCase()}`;
  if (!company) notFound();

  const [read] = await sql`
    select signal_metric, signal_start_on, signal_rule, filed_on, lead_days, narrative, series
    from lead_time_reads where company_id = ${company.id} order by created_at desc limit 1`;
  if (!read) {
    return (
      <main className="min-h-screen">
        <TopBar active="lead" />
        <div className="px-12 py-16 text-[14px] text-muted">
          No measured lead-time read for {company.name} yet. A read lands once a signal series and an official filing can be paired.
        </div>
      </main>
    );
  }

  const events = (await sql`
    select distinct on (occurred_on) title, occurred_on, is_key, url from official_events
    where company_id = ${company.id} and occurred_on >= ${read.signal_start_on}::date - interval '90 days'
    order by occurred_on asc, is_key desc limit 3`) as unknown as EventMark[];

  const series = read.series as SeriesPoint[];
  const chart = layoutChart(series, String(read.signal_start_on), String(read.filed_on), events);
  const startLabel = formatDay(String(read.signal_start_on));
  const filedLabel = formatDay(String(read.filed_on));

  return (
    <main className="min-h-screen">
      <TopBar active="lead" />

      <div className="max-w-[1100px] px-12 pb-5 pt-12">
        <div className="eyebrow mb-3.5" style={{ color: "var(--color-rust)", letterSpacing: "0.16em" }}>
          Lead-time analysis · {company.ticker} — {company.name}
        </div>
        <h1 className="font-serif text-[50px] font-medium leading-[1.05] tracking-tight">
          Customers turned <span style={{ color: "var(--color-rust)" }}>{read.lead_days} days</span> before the filing.
        </h1>
        <div className="mt-4 max-w-[760px] text-[15px] leading-relaxed text-muted">
          {String(read.signal_metric).replaceAll("_", " ")} began a sustained rise on {startLabel}. The filing reached SEC EDGAR on{" "}
          {filedLabel} — {read.lead_days} days later. Measured, not modeled.
        </div>
      </div>

      <div className="px-12 pt-4">
        <div className="rule-ink mb-2 flex items-baseline gap-4 pb-2">
          <div className="eyebrow" style={{ letterSpacing: "0.14em" }}>
            {String(read.signal_metric).replaceAll("_", " ")}, indexed
          </div>
          <div className="text-[11px] text-muted tnum">
            {formatDay(series[0].t)} = 100 · weekly
          </div>
        </div>
        {/* the signature: measured gap between signal turn and filing */}
        <svg viewBox="0 0 1240 440" className="block w-full" role="img"
          aria-label={`${read.narrative} Signal start ${startLabel}, filing ${filedLabel}.`}>
          {chart.gridY.map((y, i) => (
            <g key={i}>
              <line x1={60} y1={y.px} x2={1180} y2={y.px} stroke="var(--color-hairline)" strokeWidth={1} />
              <text x={52} y={y.px + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">{y.label}</text>
            </g>
          ))}
          <rect x={chart.startX} y={36} width={chart.filedX - chart.startX} height={266} fill="var(--color-rust)" opacity={0.06} />
          <line x1={chart.startX} y1={32} x2={chart.startX} y2={302} stroke="var(--color-rust)" strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />
          <line x1={chart.filedX} y1={32} x2={chart.filedX} y2={302} stroke="var(--color-rust)" strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />
          <line x1={chart.startX} y1={26} x2={chart.filedX} y2={26} stroke="var(--color-rust)" strokeWidth={1.5} />
          <line x1={chart.startX} y1={20} x2={chart.startX} y2={32} stroke="var(--color-rust)" strokeWidth={1.5} />
          <line x1={chart.filedX} y1={20} x2={chart.filedX} y2={32} stroke="var(--color-rust)" strokeWidth={1.5} />
          <text x={(chart.startX + chart.filedX) / 2} y={152} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={122} fontWeight={500} fill="var(--color-rust)">
            {read.lead_days}
          </text>
          <text x={(chart.startX + chart.filedX) / 2} y={186} textAnchor="middle" fontSize={13} letterSpacing={3} fill="var(--color-ink)">
            DAYS BEFORE THE FILING
          </text>
          <polyline points={chart.linePoints} fill="none" stroke="var(--color-ink)" strokeWidth={2} />
          <circle cx={chart.startX} cy={chart.startY} r={4.5} fill="var(--color-rust)" />
          <line x1={60} y1={302} x2={1180} y2={302} stroke="var(--color-ink)" strokeWidth={1.5} />
          {chart.months.map((m) => (
            <text key={m.label} x={m.px} y={320} fontSize={10.5} fill="var(--color-muted)">{m.label}</text>
          ))}
          <line x1={chart.startX} y1={306} x2={chart.startX} y2={330} stroke="var(--color-rust)" strokeWidth={1} />
          <text x={chart.startX - 8} y={344} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--color-rust)">
            Signal turns · {startLabel}
          </text>
          {chart.eventMarks.map((mark, i) => (
            <g key={i}>
              <rect x={mark.px - 3} y={299} width={6} height={6} fill={mark.isKey ? "var(--color-rust)" : "var(--color-ink)"} />
              <line x1={mark.px} y1={306} x2={mark.px} y2={mark.labelY - 12} stroke={mark.isKey ? "var(--color-rust)" : "var(--color-muted)"} strokeWidth={1} />
              <text x={mark.anchorEnd ? mark.px - 6 : mark.px + 7} y={mark.labelY}
                textAnchor={mark.anchorEnd ? "end" : "start"} fontSize={mark.isKey ? 12 : 11.5}
                fontWeight={mark.isKey ? 600 : 400} fill={mark.isKey ? "var(--color-ink)" : "var(--color-muted)"}>
                {mark.title} · {formatDay(mark.date)}
              </text>
            </g>
          ))}
        </svg>
        <div className="rule-hairline max-w-[900px] pt-2.5 text-[11px] leading-normal text-muted" style={{ borderTop: "1px solid var(--color-hairline)", borderBottom: "none" }}>
          Line: {String(read.signal_metric).replaceAll("_", " ")} per week across primary sources, indexed to the week of {formatDay(series[0].t)} = 100.
          Events: company press releases and SEC filings, dated as published. Sources scraped continuously.
        </div>
      </div>

      <div className="grid max-w-[1100px] grid-cols-3 gap-11 px-12 pb-16 pt-9 max-md:grid-cols-1">
        <div className="pt-3.5" style={{ borderTop: "1px solid var(--color-ink)" }}>
          <div className="eyebrow mb-2 text-muted" style={{ letterSpacing: "0.14em" }}>Signal start</div>
          <div className="font-serif text-2xl font-medium">{startLabel}</div>
          <div className="mt-1.5 text-[12.5px] leading-normal text-muted">{read.signal_rule}.</div>
        </div>
        <div className="pt-3.5" style={{ borderTop: "1px solid var(--color-ink)" }}>
          <div className="eyebrow mb-2 text-muted" style={{ letterSpacing: "0.14em" }}>Official filing</div>
          <div className="font-serif text-2xl font-medium">{filedLabel}</div>
          <div className="mt-1.5 text-[12.5px] leading-normal text-muted">
            Form 8-K, Item 5.02 — departure of the Chief Executive Officer.{" "}
            {events.find((e) => e.is_key)?.url && (
              <a href={events.find((e) => e.is_key)!.url!} target="_blank" rel="noreferrer" className="text-[12.5px]">
                View on EDGAR →
              </a>
            )}
          </div>
        </div>
        <div className="pt-3.5" style={{ borderTop: "1px solid var(--color-rust)" }}>
          <div className="eyebrow mb-2" style={{ color: "var(--color-rust)", letterSpacing: "0.14em" }}>Lead time</div>
          <div className="font-serif text-2xl font-medium" style={{ color: "var(--color-rust)" }}>{read.lead_days} days</div>
          <div className="mt-1.5 text-[12.5px] leading-normal text-muted">
            The measured gap between the first sustained customer signal and the official record.
          </div>
        </div>
      </div>
    </main>
  );
}

function layoutChart(series: SeriesPoint[], startOn: string, filedOn: string, events: EventMark[]) {
  const x0 = 60, x1 = 1180, yTop = 55, yBase = 288;
  const t0 = new Date(series[0].t).getTime();
  const t1 = new Date(series[series.length - 1].t).getTime();
  const xOf = (iso: string) => x0 + ((new Date(iso).getTime() - t0) / (t1 - t0)) * (x1 - x0);
  const values = series.map((p) => p.v);
  const vMin = 100, vMax = Math.max(...values);
  const yOf = (v: number) => yBase - ((v - vMin) / (vMax - vMin || 1)) * (yBase - yTop);

  const linePoints = series.map((p) => `${xOf(p.t).toFixed(0)},${yOf(p.v).toFixed(0)}`).join(" ");
  const startX = Math.round(xOf(startOn));
  const filedX = Math.round(xOf(filedOn));
  const startPoint = series.find((p) => p.t >= startOn) ?? series[0];

  const step = Math.ceil((vMax - vMin) / 3 / 50) * 50 || 50;
  const gridY = [];
  for (let v = vMin; v <= vMax; v += step) gridY.push({ label: `${v}`, px: Math.round(yOf(v)) });

  const eventMarks = events.map((event, i) => {
    const px = Math.round(xOf(String(event.occurred_on)));
    // labels near the right edge anchor leftward so nothing bleeds off-canvas
    const anchorEnd = px > 940;
    return {
      px,
      date: String(event.occurred_on),
      title: shorten(event.title.replace(/ \(8-K.*\)/, " (8-K)"), 30),
      isKey: event.is_key,
      anchorEnd,
      labelY: 374 + (i % 2) * 28,
    };
  });

  // month ticks skip any position where a marker's leader line will cross them
  const busyXs = [startX, filedX, ...eventMarks.map((m) => m.px)];
  const months: { label: string; px: number }[] = [];
  const cursor = new Date(series[0].t);
  cursor.setDate(1);
  while (cursor.getTime() <= t1) {
    if (cursor.getTime() >= t0) {
      const px = Math.round(xOf(cursor.toISOString()));
      if (busyXs.every((busy) => Math.abs(busy - px) > 46)) {
        months.push({ label: cursor.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), px });
      }
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return { linePoints, startX, filedX, startY: Math.round(yOf(startPoint.v)), gridY, months, eventMarks };
}

function shorten(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
