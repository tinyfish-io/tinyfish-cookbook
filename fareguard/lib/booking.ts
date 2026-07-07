import type { SitePriceSeries, BookingRequest } from "./types";
import { store } from "./store";

function latestPrice(priceSeries: Record<string, SitePriceSeries>, siteId: string, routeCode: string) {
  const series = priceSeries[`${siteId}__${routeCode}`];
  if (!series || series.history.length === 0) return null;
  return series.history[series.history.length - 1].priceVnd;
}

// Compares every "waiting" booking request against the latest scraped price
// on its preferred site. If the fare has dropped to/below the threshold,
// flips it to "booked". This is a demo-only status — no real booking or
// payment happens. Only ever called as part of a scheduled sweep, never on
// booking-request creation itself.
export async function checkBookingThresholds(priceSeries: Record<string, SitePriceSeries>): Promise<number> {
  const requests = await store.getBookingRequests();
  let triggeredCount = 0;

  const updated: BookingRequest[] = requests.map((req) => {
    if (req.status !== "waiting") return req;
    const price = latestPrice(priceSeries, req.preferredSiteId, req.routeCode);
    if (price !== null && price <= req.thresholdVnd) {
      triggeredCount += 1;
      return { ...req, status: "booked" as const };
    }
    return req;
  });

  await store.setBookingRequests(updated);
  return triggeredCount;
}
