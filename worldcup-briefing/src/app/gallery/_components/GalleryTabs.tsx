"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { GalleryRun } from "../page";
import GalleryGrid from "./GalleryGrid";
import { Pagination } from "@/components/Pagination";
import { ArrowRightIcon, TargetIcon } from "@/components/Icons";

export function GalleryTabs({
  publicRuns,
  page,
  totalPages,
}: {
  publicRuns: GalleryRun[];
  total: number;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    function syncSession() {
      setHasSession(!!localStorage.getItem("session_token"));
    }

    syncSession();
    window.addEventListener("session_changed", syncSession);
    return () => window.removeEventListener("session_changed", syncSession);
  }, []);

  const pushPublicPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage > 1) {
        params.set("page", String(nextPage));
      } else {
        params.delete("page");
      }
      const q = params.toString();
      router.push(q ? `/gallery?${q}` : "/gallery", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div>
      <GalleryGrid runs={publicRuns} />
      <Pagination page={page} totalPages={totalPages} onPageChange={pushPublicPage} />

      {hasSession ? (
        <Link
          href="/me"
          className="mt-[18px] flex w-full items-center justify-between rounded-[14px] border border-[var(--c-border)] bg-[var(--c-hover)] px-5 py-4 hover:border-[#F24E1E]"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex size-[34px] items-center justify-center rounded-[9px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[#F24E1E]">
              <TargetIcon className="size-4" />
            </span>
            <span>
              <span className="block text-[14px] font-bold text-[var(--c-text)]">Go to your briefings</span>
              <span className="mt-px block text-[12.5px] text-[var(--c-text-subtle)]">View reels you generated with your API keys</span>
            </span>
          </span>
          <ArrowRightIcon className="size-4 text-[var(--c-text-faint)]" />
        </Link>
      ) : null}
    </div>
  );
}
