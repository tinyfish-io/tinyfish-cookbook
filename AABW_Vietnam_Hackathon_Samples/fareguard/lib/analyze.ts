import type { SitePriceSeries, RouteRecommendation, RouteCode, RouteInfo } from "./types";
import { getVietnamDateString } from "./date";

function bestSeriesPerRoute(priceSeries: Record<string, SitePriceSeries>, routes: RouteInfo[]) {
  const byRoute: Record<RouteCode, SitePriceSeries[]> = {};
  routes.forEach((r) => (byRoute[r.code] = []));
  Object.values(priceSeries).forEach((s) => {
    if (byRoute[s.routeCode]) byRoute[s.routeCode].push(s);
  });
  return byRoute;
}

// Used when GROQ_API_KEY isn't set, or the call fails — keeps the dashboard
// useful without an external dependency.
function heuristicRecommendations(priceSeries: Record<string, SitePriceSeries>, routes: RouteInfo[]): RouteRecommendation[] {
  const byRoute = bestSeriesPerRoute(priceSeries, routes);
  return routes
    .filter((route) => byRoute[route.code]?.length > 0)
    .map((route) => {
    const series = byRoute[route.code];
    const cheapest = series.reduce((min, s) => {
      const last = s.history[s.history.length - 1]?.priceVnd ?? Infinity;
      const minLast = min.history[min.history.length - 1]?.priceVnd ?? Infinity;
      return last < minLast ? s : min;
    }, series[0]);

    const hist = cheapest.history;
    const recent = hist.slice(-5).map((p) => p.priceVnd);
    const earlier = hist.slice(0, 5).map((p) => p.priceVnd);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    const pctChange = (recentAvg - earlierAvg) / earlierAvg;

    let recommendation: string;
    let bookByDate: string;
    let confidence: "low" | "medium" | "high";

    if (pctChange < -0.03) {
      recommendation = "Prices have been trending down. Worth waiting a few more days before locking in.";
      bookByDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      confidence = "medium";
    } else if (pctChange > 0.03) {
      recommendation = "Prices are climbing. Book within the next 2-3 days before the trend continues.";
      bookByDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      confidence = "high";
    } else {
      recommendation = "Prices are stable. Current fare is a reasonable time to book.";
      bookByDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
      confidence = "medium";
    }

    return { routeCode: route.code, recommendation, bookByDate, confidence };
  });
}

export async function buildRecommendations(priceSeries: Record<string, SitePriceSeries>, routes: RouteInfo[]): Promise<RouteRecommendation[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return heuristicRecommendations(priceSeries, routes);

  try {
    const byRoute = bestSeriesPerRoute(priceSeries, routes);
    const todayStr = getVietnamDateString();
    const summary = routes.map((route) => ({
      route: route.code,
      label: route.label,
      sites: byRoute[route.code].map((s) => ({
        site: s.siteId,
        last7: s.history.slice(-7).map((p) => p.priceVnd),
      })),
    }));

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: [
              `Today's date is ${todayStr} (Vietnam local time, UTC+7). Use this as the reference point for any date you return — do not rely on your own assumption of the current date, which may be wrong.`,
              "You are a corporate travel cost analyst for a company in Vietnam, advising the travel/finance team on when staff should book flights.",
              "You will receive fare history (VND, one-way economy) from the last 7 scrapes across multiple sites, for several routes.",
              "For each route: look at the direction and steadiness of the trend across sites, not just the single cheapest point. Weight the more recent points more heavily than older ones.",
              "Account for Vietnam-specific demand patterns where relevant: fares typically rise sharply in the weeks before Tet (Lunar New Year) and around major domestic holidays/long weekends, and are usually softer mid-week and outside school holiday periods.",
              "Do not invent specific promotions, sales, or named events that aren't implied by the data — base the recommendation only on the price pattern given.",
              "Be decisive: give a clear book-by date and a plain reason, not hedging language.",
              `Respond with ONLY a raw JSON array, no prose, no markdown code fences, no explanation before or after. Each item: {"routeCode": string, "recommendation": string (max 22 words, plain analyst tone, no exclamation marks), "bookByDate": ISO date string strictly between ${todayStr} and 10 days after it, "confidence": "low"|"medium"|"high"}.`,
              "confidence should be \"high\" only when the trend is consistent across at least two sites; otherwise use \"medium\" or \"low\".",
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(summary) },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
    });

    if (!res.ok) return heuristicRecommendations(priceSeries, routes);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) return heuristicRecommendations(priceSeries, routes);

    // Safety net: never trust a date outside a sane window, even after
    // explicitly anchoring the prompt above — reject silently rather than
    // show a nonsense date like "16 Feb" when it's actually July.
    const fallback = heuristicRecommendations(priceSeries, routes);
    const now = Date.now();
    const maxWindow = 14 * 24 * 60 * 60 * 1000;
    const validated: RouteRecommendation[] = parsed.map((rec: any) => {
      const bookByTime = new Date(rec?.bookByDate).getTime();
      const isSaneDate = !Number.isNaN(bookByTime) && bookByTime >= now - 24 * 60 * 60 * 1000 && bookByTime <= now + maxWindow;
      if (isSaneDate && typeof rec?.routeCode === "string" && typeof rec?.recommendation === "string") {
        return rec as RouteRecommendation;
      }
      const fallbackForRoute = fallback.find((f) => f.routeCode === rec?.routeCode);
      return fallbackForRoute ?? fallback[0];
    });

    return validated;
  } catch {
    return heuristicRecommendations(priceSeries, routes);
  }
}
