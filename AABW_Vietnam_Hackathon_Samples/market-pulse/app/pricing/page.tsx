"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, LabelList } from "recharts";
import { AlertCircle } from "lucide-react";
import type { Product, CompetitorSite, CompetitorListing } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";
import { formatVnd } from "@/lib/format";

const SITE_COLORS = ["#B8891A", "#6B2430", "#8C7355", "#A8362F", "#5C4A2E"];

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sites, setSites] = useState<CompetitorSite[]>([]);
  const [listings, setListings] = useState<Record<string, CompetitorListing>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/products");
      setProducts(data.products);
      setSites(data.sites);
      setListings(data.listings);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load pricing data</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }
  if (!loaded) return <div className="skeleton h-96" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl">Pricing intelligence</h1>
        <p className="text-sm text-text-muted mt-1">One chart per tracked product — our price against each of the 5 competitors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {products.map((product) => {
          const rows = [
            { name: "Us", price: product.ourPrice, isUs: true },
            ...sites
              .map((site) => {
                const listing = listings[`${site.id}__${product.id}`];
                if (!listing?.price) return null;
                return { name: site.name, price: listing.price, isUs: false };
              })
              .filter((r): r is { name: string; price: number; isUs: boolean } => r !== null),
          ].sort((a, b) => a.price - b.price);

          const beaten = rows.some((r) => !r.isUs && r.price < product.ourPrice);

          return (
            <div key={product.id} className="card-surface rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{product.category}</p>
                </div>
                {beaten && (
                  <span className="flex items-center gap-1 text-xs text-danger">
                    <AlertCircle size={12} /> Beaten on price
                  </span>
                )}
              </div>

              {rows.length <= 1 ? (
                <p className="text-xs text-text-muted py-8 text-center">No competitor data yet for this product.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(rows.length * 42, 160)}>
                  <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke="var(--border)" horizontal={false} strokeOpacity={0.5} />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                      formatter={(value: number) => formatVnd(value)}
                    />
                    <Bar dataKey="price" radius={[0, 4, 4, 0]}>
                      {rows.map((r, i) => (
                        <Cell key={i} fill={r.isUs ? "var(--accent)" : SITE_COLORS[i % SITE_COLORS.length]} />
                      ))}
                      <LabelList dataKey="price" position="right" formatter={(v: number) => formatVnd(v)} style={{ fill: "var(--text-secondary)", fontSize: 10 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
