import { ComparisonTable } from "../components/ComparisonTable.tsx";
import { Failed, Link, Loading, Notice, usePageTitle } from "../components/ui.tsx";
import { getAudit } from "../lib/api.ts";
import { buildComparison } from "../lib/compare.ts";
import { useLoad } from "../lib/useLoad.ts";

export function ComparePage({ ids }: { ids: string[] }) {
  usePageTitle("Side by side");
  const { result, refresh } = useLoad(ids.join(","), () => Promise.all(ids.map(getAudit)));

  if (ids.length === 0) return <NothingToCompare />;
  if (result.state === "loading") return <Loading what="Lining up the reports." />;
  if (result.state === "failed") {
    return <Failed level="h1" message={result.message} onRetry={() => void refresh()} />;
  }

  const view = buildComparison(result.data);
  if (view.columns.length < 2) return <NothingToCompare />;
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2.5">
        <Link href="/audits" className="inline-flex min-h-11 items-center text-mute hover:text-ink">
          Past audits
        </Link>
        <span aria-hidden="true" className="text-mute">
          /
        </span>
        <span aria-current="page" className="font-semibold text-ink">
          Side by side
        </span>
      </nav>
      <ComparisonTable
        view={view}
        showTasks={ids.length > 1}
        headingLevel="h1"
        linkFor={({ auditId, key }) => `/audits/${auditId}#site-${key}`}
      />
    </div>
  );
}

function NothingToCompare() {
  return (
    <Notice
      title="There are not two reports to compare yet"
      level="h1"
      action={
        <Link className="btn btn-soft" href="/">
          Pick audits to compare
        </Link>
      }
    >
      Tick audits on your list until they cover at least two finished sites.
    </Notice>
  );
}
