import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { store } from "@/lib/store";
import { SITES } from "@/lib/seed";
import type { SitePriceSeries } from "@/lib/types";
import { formatVnd } from "@/lib/format";

// Never statically pre-render this at build time — it depends on live
// Redis/env state that may not be ready during the Vercel build step,
// and should always reflect the current request anyway.
export const dynamic = "force-dynamic";

function cheapestFare(priceSeries: Record<string, SitePriceSeries>, routeCode: string) {
  let best: number | null = null;
  for (const site of SITES) {
    const series = priceSeries[`${site.id}__${routeCode}`];
    if (!series || series.history.length === 0) continue;
    const price = series.history[series.history.length - 1].priceVnd;
    if (best === null || price < best) best = price;
  }
  return best;
}

function trendPct(priceSeries: Record<string, SitePriceSeries>, routeCode: string) {
  const series = priceSeries[`vietjet__${routeCode}`];
  if (!series || series.history.length < 4) return 0;
  const recent = series.history.slice(-3).reduce((a, p) => a + p.priceVnd, 0) / 3;
  const earlier = series.history.slice(0, 3).reduce((a, p) => a + p.priceVnd, 0) / 3;
  return ((recent - earlier) / earlier) * 100;
}

export async function GET() {
  const [routes, priceSeries, recommendations, bookingRequests, meta] = await Promise.all([
    store.getRoutes(),
    store.getPriceSeries(),
    store.getRecommendations(),
    store.getBookingRequests(),
    store.getMeta(),
  ]);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]); // A4
  const margin = 50;
  let y = 792;
  const dark = rgb(0.06, 0.09, 0.16);
  const gray = rgb(0.4, 0.44, 0.51);
  const blue = rgb(0.15, 0.39, 0.92);

  function ensureSpace(lines = 1) {
    if (y < margin + lines * 16) {
      page = doc.addPage([595, 842]);
      y = 792;
    }
  }

  function text(str: string, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; x?: number } = {}) {
    ensureSpace();
    page.drawText(str, {
      x: opts.x ?? margin,
      y,
      size: opts.size ?? 10,
      font: opts.f ?? font,
      color: opts.color ?? dark,
    });
    y -= (opts.size ?? 10) + 8;
  }

  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  text("FareGuard", { size: 22, f: bold, color: blue });
  text(`Weekly report — generated ${generatedAt}`, { size: 11, color: gray });
  y -= 10;

  // Summary
  let savings = 0;
  routes.forEach((route) => {
    SITES.forEach((site) => {
      const series = priceSeries[`${site.id}__${route.code}`];
      if (!series) return;
      const realPoints = series.history.filter((p) => p.source === "real");
      if (realPoints.length < 2) return;
      const prices = realPoints.map((p) => p.priceVnd);
      savings += Math.max(...prices) - prices[prices.length - 1];
    });
  });

  text("Summary", { size: 14, f: bold });
  text(`Savings identified: ${formatVnd(savings)} (from real tracked sweeps only)`);
  text(`Routes monitored: ${routes.length}`);
  text(`Sites tracked: ${SITES.length} (${SITES.filter((s) => s.type === "Airline").length} airlines, ${SITES.filter((s) => s.type === "OTA").length} OTAs)`);
  text(`Booking requests: ${bookingRequests.filter((r) => r.status === "waiting").length} waiting, ${bookingRequests.filter((r) => r.status === "booked").length} booked`);
  text(`Agent mode: ${meta.usingRealAgents ? "live agents" : "simulated"}`);
  y -= 10;

  text("Routes", { size: 14, f: bold });
  routes.forEach((route) => {
    ensureSpace(4);
    const fare = cheapestFare(priceSeries, route.code);
    const trend = trendPct(priceSeries, route.code);
    const rec = recommendations.find((r) => r.routeCode === route.code);
    text(`${route.fromCity} to ${route.toCity} (${route.code})`, { size: 12, f: bold });
    text(`  Cheapest fare: ${fare !== null ? formatVnd(fare) : "no data yet"}  |  Trend: ${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%`, {
      size: 10,
      color: gray,
    });
    if (rec) {
      text(`  AI recommendation (${rec.confidence} confidence): ${rec.recommendation}`, { size: 10, color: gray });
    }
    y -= 6;
  });

  const pdfBytes = await doc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fareguard-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
