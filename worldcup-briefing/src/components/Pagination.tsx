"use client";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-text-muted)] transition-all hover:border-[#F24E1E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
      >
        &larr; Previous
      </button>
      <span className="text-[13px] font-medium text-[var(--c-text-subtle)]">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-text-muted)] transition-all hover:border-[#F24E1E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
      >
        Next &rarr;
      </button>
    </div>
  );
}
