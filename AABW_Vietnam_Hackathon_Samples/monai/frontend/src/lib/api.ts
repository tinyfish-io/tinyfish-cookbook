export function getApiBase(): string | null {
  const url = import.meta.env.VITE_API_BASE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  return null;
}

export function isApiConfigured(): boolean {
  return getApiBase() !== null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  if (base === null) {
    throw new Error("API is not configured. Set VITE_API_BASE_URL or run the dev server with backend.");
  }

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  if (!res.ok) {
    throw new Error(body || `Server error: ${res.status}`);
  }

  if (!contentType.includes("application/json")) {
    const hint =
      body.trimStart().startsWith("<!") || body.includes("<!doctype")
        ? ` Got HTML instead of JSON — check VITE_API_BASE_URL. It must be your Render backend (e.g. https://monai-backend.onrender.com), not your Vercel URL. Current base: ${base}`
        : ` Expected JSON from ${base}${path}.`;
    throw new Error(`API misconfigured.${hint}`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Invalid JSON from API at ${base}${path}.`);
  }
}

export type Trend = {
  trend_name: string;
  display_rank?: number;
  search_rank?: number;
  description: string;
  publisher?: string;
  region?: string;
};

export type HealthResponse = {
  status: string;
  service: string;
};

export async function checkHealth() {
  return apiFetch<HealthResponse>("/health");
}

export async function fetchEmergingTrends(location: string, category: string) {
  const params = new URLSearchParams({ location, category });
  return apiFetch<{ location: string; emerging_trends: Trend[] }>(
    `/api/trends/emerging?${params}`,
  );
}

export async function runMenuGapAnalysis(payload: {
  current_menu_items: string[];
  location: string;
  competitor_urls?: string[];
}) {
  return apiFetch<{ menu_gap_analysis: unknown }>("/api/analysis/menu-gap", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function runTrendForecast(trendName: string, location: string) {
  const params = new URLSearchParams({ trend_name: trendName, location });
  return apiFetch<{ trend: string; forecast: unknown }>(
    `/api/trends/forecast?${params}`,
  );
}

export async function runRegionalComparison(regionA: string, regionB: string, category: string) {
  const params = new URLSearchParams({
    region_a: regionA,
    region_b: regionB,
    category,
  });
  return apiFetch<{ comparison: unknown }>(`/api/trends/regional?${params}`);
}

export async function discoverSuppliers(payload: {
  trend_name: string;
  ingredients: string[];
  location: string;
}) {
  return apiFetch<{ trend: string; suppliers: unknown }>(
    "/api/suppliers/discover",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function generateOutreach(payload: { supplier_info: string; product_needs: string }) {
  return apiFetch<{ rfq_template: unknown }>("/api/suppliers/outreach", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
