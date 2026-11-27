import { useEffect, useRef } from "react";

import { Link, Notice, usePageTitle } from "./components/ui.tsx";
import { navigate, useRoute } from "./lib/useRoute.ts";
import { AuditPage, SharedPage } from "./pages/AuditPage.tsx";
import { ComparePage } from "./pages/ComparePage.tsx";
import { Home } from "./pages/Home.tsx";
import { PastAudits } from "./pages/PastAudits.tsx";

function NotFound() {
  usePageTitle("Page not found");
  return (
    <Notice
      title="There is nothing at this address"
      level="h1"
      action={
        <Link className="btn btn-soft" href="/">
          Run an audit
        </Link>
      }
    >
      The link may be old, or the audit may have been deleted.
    </Notice>
  );
}

/** Old links keep working, and the old address leaves the browser's history. */
function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function Page() {
  const { href, route } = useRoute();
  switch (route.name) {
    case "home":
      return <Home key={href} prefill={route} />;
    case "audits":
      return <PastAudits />;
    case "redirect":
      return <Redirect to={route.to} />;
    case "audit":
      return <AuditPage key={route.id} id={route.id} />;
    case "shared":
      return <SharedPage key={route.token} token={route.token} />;
    case "compare":
      return <ComparePage key={href} ids={route.ids} />;
    case "not_found":
      return <NotFound />;
  }
}

export function App() {
  const { href, route } = useRoute();
  const main = useRef<HTMLElement>(null);
  const firstPage = useRef(true);

  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    // A client-side page change does not move focus, so screen readers would stay on the old link.
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [href]);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-white focus:p-3"
      >
        Skip to the content
      </a>

      <header className="sticky top-3 z-30 mt-3 px-4 sm:top-4 sm:mt-4 sm:px-7">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 rounded-full border border-line bg-white/85 py-1.5 pr-1.5 pl-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] backdrop-blur-sm sm:py-2 sm:pr-2 sm:pl-[18px]">
          <Link
            href="/"
            aria-label="Aletheia, run an audit"
            className="inline-flex min-h-11 items-center gap-[9px] text-[19px] font-semibold tracking-[-0.01em] text-ink"
          >
            <img src="/favicon.svg?v=3" alt="" width="24" height="24" />
            Aletheia
          </Link>

          <nav aria-label="Main">
            <ul className="flex items-center gap-3 sm:gap-[18px]">
              <li>
                <Link
                  href="/audits"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-ink hover:underline hover:underline-offset-4 sm:text-[15px]"
                  aria-current={route.name === "audits" ? "page" : undefined}
                >
                  Past audits
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  className="btn btn-ring px-4 text-sm sm:px-5 sm:text-[15px]"
                  aria-current={route.name === "home" ? "page" : undefined}
                >
                  New audit
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-8 pb-16 outline-none sm:px-7 sm:pt-10"
      >
        <Page />
      </main>

      <footer className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-4 pb-6 text-[13px] text-mute sm:px-7">
        <span className="inline-flex items-center gap-2">
          <img src="/favicon.svg?v=3" alt="" width="18" height="18" />
          Aletheia {new Date().getFullYear()}
        </span>
        <Link href="/audits" className="inline-flex min-h-11 items-center hover:text-ink">
          Past audits
        </Link>
      </footer>
    </div>
  );
}
