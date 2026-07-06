import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ANALYSIS_EXAMPLES,
  type AnalysisCategory,
} from "@/components/monai/analysisExamples";
import { ExampleReportPreview, IntelligenceReportView } from "@/components/monai/IntelligenceReport";
import { buildClientReport } from "@/lib/buildClientReport";
import { normalizeResult } from "@/lib/normalizeResult";
import {
  checkHealth,
  discoverSuppliers,
  generateOutreach,
  isApiConfigured,
  runMenuGapAnalysis,
  runRegionalComparison,
  runTrendForecast,
} from "@/lib/api";

function AnalysisResult({ data }: { data: unknown }) {
  const normalized = normalizeResult(data);
  const report = buildClientReport(normalized);

  if (report) {
    return <IntelligenceReportView report={report} />;
  }

  return (
    <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-card p-4 text-xs text-nuoc">
      {JSON.stringify(normalized, null, 2)}
    </pre>
  );
}

function RunButton({
  tab,
  loadingTab,
  label,
  onClick,
}: {
  tab: AnalysisCategory;
  loadingTab: AnalysisCategory | null;
  label: string;
  onClick: () => void;
}) {
  const busy = loadingTab === tab;
  return (
    <Button disabled={loadingTab !== null} onClick={onClick}>
      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      <span>{label}</span>
    </Button>
  );
}

export function AnalysisPanel() {
  const fieldId = useId();
  const [loadingTab, setLoadingTab] = useState<AnalysisCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisCategory>("menu-gap");
  const [showExample, setShowExample] = useState(true);

  const [menuItems, setMenuItems] = useState("Cà phê sữa đá\nBạc xỉu\nTrà đào");
  const [menuLocation, setMenuLocation] = useState("Hà Nội");
  const [competitorUrls, setCompetitorUrls] = useState("");

  const [trendName, setTrendName] = useState("Matcha Coconut Coffee");
  const [forecastLocation, setForecastLocation] = useState("TP.HCM");

  const [regionA, setRegionA] = useState("Hà Nội");
  const [regionB, setRegionB] = useState("TP.HCM");
  const [category, setCategory] = useState("beverage");

  const [supplierTrend, setSupplierTrend] = useState("Matcha Coconut Coffee");
  const [ingredients, setIngredients] = useState("matcha powder, coconut cream");
  const [supplierLocation, setSupplierLocation] = useState("TP.HCM");

  const [supplierInfo, setSupplierInfo] = useState("Saigon Matcha Co. — sales@saigonmatcha.vn");
  const [productNeeds, setProductNeeds] = useState("500kg ceremonial matcha, monthly delivery");

  const example = ANALYSIS_EXAMPLES[activeTab];
  const id = (name: string) => `${fieldId}-${name}`;

  async function runAnalysis(tab: AnalysisCategory, fn: () => Promise<Record<string, unknown>>) {
    if (!isApiConfigured()) {
      setError("API not configured. Set VITE_API_BASE_URL to your Render backend URL.");
      return;
    }
    setLoadingTab(tab);
    setError(null);
    setResult(null);
    setShowExample(false);
    try {
      const data = await fn();
      setResult(data);
      setResultVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoadingTab(null);
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value as AnalysisCategory);
    setResult(null);
    setError(null);
    setShowExample(true);
    setLoadingTab(null);
  }

  useEffect(() => {
    if (!isApiConfigured()) {
      setApiOk(false);
      return;
    }
    checkHealth()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <section id="analysis" className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <span className="stamp mb-4">Run Analysis</span>
          <h2 className="chopstick-heading mt-4 font-[family-name:var(--font-display)] text-3xl italic text-nuoc">
            AI Trend Intelligence Console
          </h2>
          <p className="mt-3 text-muted-foreground">
            Menu gaps · forecasts · regional compare · supplier discovery · RFQ outreach
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span
              className={`rounded-full px-3 py-1 ${apiOk ? "bg-cilantro/15 text-cilantro" : apiOk === false ? "bg-chili/10 text-chili" : "bg-muted text-muted-foreground"}`}
            >
              API: {apiOk === null ? "checking…" : apiOk ? "connected" : "offline"}
            </span>
          </div>
        </div>

        <div className="mb-6 text-sm leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-nuoc">{example.title}.</strong> {example.description}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
            <TabsTrigger value="menu-gap">Menu Gap</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="regional">Regional</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="outreach">RFQ</TabsTrigger>
          </TabsList>

          {activeTab === "menu-gap" && (
            <TabsContent value="menu-gap" className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-border bg-card p-6">
                <div>
                  <Label htmlFor={id("menu-items")}>Current menu items (one per line)</Label>
                  <Textarea
                    id={id("menu-items")}
                    value={menuItems}
                    onChange={(e) => setMenuItems(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor={id("menu-location")}>Location</Label>
                  <Input
                    id={id("menu-location")}
                    value={menuLocation}
                    onChange={(e) => setMenuLocation(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor={id("competitors")}>Competitor menu URLs (optional, comma-separated)</Label>
                  <Input
                    id={id("competitors")}
                    value={competitorUrls}
                    onChange={(e) => setCompetitorUrls(e.target.value)}
                    placeholder="https://..."
                    className="mt-2"
                  />
                </div>
                <RunButton
                  tab="menu-gap"
                  loadingTab={loadingTab}
                  label="Analyze Menu Gap"
                  onClick={() =>
                    runAnalysis("menu-gap", () =>
                      runMenuGapAnalysis({
                        current_menu_items: menuItems.split("\n").map((s) => s.trim()).filter(Boolean),
                        location: menuLocation,
                        competitor_urls: competitorUrls
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                    )
                  }
                />
              </div>
            </TabsContent>
          )}

          {activeTab === "forecast" && (
            <TabsContent value="forecast" className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-border bg-card p-6">
                <div>
                  <Label htmlFor={id("trend-name")}>Trend name</Label>
                  <Input
                    id={id("trend-name")}
                    value={trendName}
                    onChange={(e) => setTrendName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor={id("forecast-loc")}>Location</Label>
                  <Input
                    id={id("forecast-loc")}
                    value={forecastLocation}
                    onChange={(e) => setForecastLocation(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <RunButton
                  tab="forecast"
                  loadingTab={loadingTab}
                  label="Run Forecast"
                  onClick={() => runAnalysis("forecast", () => runTrendForecast(trendName, forecastLocation))}
                />
              </div>
            </TabsContent>
          )}

          {activeTab === "regional" && (
            <TabsContent value="regional" className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-border bg-card p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={id("region-a")}>Region A</Label>
                    <Input id={id("region-a")} value={regionA} onChange={(e) => setRegionA(e.target.value)} className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor={id("region-b")}>Region B</Label>
                    <Input id={id("region-b")} value={regionB} onChange={(e) => setRegionB(e.target.value)} className="mt-2" />
                  </div>
                </div>
                <div>
                  <Label htmlFor={id("category")}>Category</Label>
                  <Input id={id("category")} value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2" />
                </div>
                <RunButton
                  tab="regional"
                  loadingTab={loadingTab}
                  label="Compare Regions"
                  onClick={() => runAnalysis("regional", () => runRegionalComparison(regionA, regionB, category))}
                />
              </div>
            </TabsContent>
          )}

          {activeTab === "suppliers" && (
            <TabsContent value="suppliers" className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-border bg-card p-6">
                <div>
                  <Label htmlFor={id("sup-trend")}>Trend</Label>
                  <Input id={id("sup-trend")} value={supplierTrend} onChange={(e) => setSupplierTrend(e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor={id("ingredients")}>Ingredients (comma-separated)</Label>
                  <Input id={id("ingredients")} value={ingredients} onChange={(e) => setIngredients(e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor={id("sup-loc")}>Location</Label>
                  <Input id={id("sup-loc")} value={supplierLocation} onChange={(e) => setSupplierLocation(e.target.value)} className="mt-2" />
                </div>
                <RunButton
                  tab="suppliers"
                  loadingTab={loadingTab}
                  label="Discover Suppliers"
                  onClick={() =>
                    runAnalysis("suppliers", () =>
                      discoverSuppliers({
                        trend_name: supplierTrend,
                        ingredients: ingredients.split(",").map((s) => s.trim()).filter(Boolean),
                        location: supplierLocation,
                      }),
                    )
                  }
                />
              </div>
            </TabsContent>
          )}

          {activeTab === "outreach" && (
            <TabsContent value="outreach" className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-border bg-card p-6">
                <div>
                  <Label htmlFor={id("sup-info")}>Supplier info</Label>
                  <Textarea id={id("sup-info")} value={supplierInfo} onChange={(e) => setSupplierInfo(e.target.value)} rows={2} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor={id("product-needs")}>Product needs</Label>
                  <Textarea id={id("product-needs")} value={productNeeds} onChange={(e) => setProductNeeds(e.target.value)} rows={3} className="mt-2" />
                </div>
                <RunButton
                  tab="outreach"
                  loadingTab={loadingTab}
                  label="Generate RFQ"
                  onClick={() =>
                    runAnalysis("outreach", () =>
                      generateOutreach({ supplier_info: supplierInfo, product_needs: productNeeds }),
                    )
                  }
                />
              </div>
            </TabsContent>
          )}
        </Tabs>

        <div className="mt-8 space-y-4">
          {loadingTab && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Running live intelligence scan…</span>
            </div>
          )}

          {!loadingTab && error && (
            <div className="rounded-lg border border-chili/30 bg-chili/5 p-4 text-sm text-chili">{error}</div>
          )}

          {!loadingTab && result != null && (
            <AnalysisResult key={resultVersion} data={result} />
          )}

          {!loadingTab && result == null && showExample && !error && (
            <ExampleReportPreview key={activeTab} report={example.sampleOutput} />
          )}
        </div>
      </div>
    </section>
  );
}
