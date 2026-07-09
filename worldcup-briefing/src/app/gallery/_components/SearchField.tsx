"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/Icons";

export function SearchField({ initialSearch = "" }: { initialSearch?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get("search") ?? initialSearch;

  const push = useCallback(
    (text: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (text) {
        params.set("search", text);
      } else {
        params.delete("search");
      }
      params.delete("page");
      const q = params.toString();
      router.push(q ? `/gallery?${q}` : "/gallery", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-3 w-full sm:w-[280px] transition-all duration-200 focus-within:border-[#F24E1E] focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_rgba(242,78,30,0.12)]">
      <SearchIcon className="size-[14px] text-[var(--c-text-faint)] shrink-0" />
      <input
        type="text"
        aria-label="Search briefings"
        defaultValue={value}
        key={`search-${value}`}
        onChange={(e) => push(e.target.value)}
        placeholder="Search briefings…"
        className="w-full border-none bg-transparent text-[15px] text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-subtle)]"
      />
    </div>
  );
}
