import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";
import { and, desc, eq, or, sql, count, type SQL } from "drizzle-orm";
import { db, runs } from "@/lib/db";
import type { BriefingEvent, VideoCandidate } from "@/lib/demo-data";
import { SearchField } from "./_components/SearchField";
import { GalleryTabs } from "./_components/GalleryTabs";

export type GalleryRun = {
  id: string;
  query: string;
  topic: string | null;
  playerUrl: string | null;
  thumbnailUrl: string | null;
  summary: string | null;
  events: BriefingEvent[];
  selectedVideo: VideoCandidate | null;
  createdAt: string;
  status?: string | null;
};

const PAGE_SIZE = 15;

async function getGalleryRuns(search: string, page: number): Promise<{
  runs: GalleryRun[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const conditions: SQL[] = [eq(runs.isPublic, true), eq(runs.status, "completed")];
  if (search) {
    conditions.push(or(
      sql`${runs.query} ILIKE ${`%${search}%`}`,
      sql`${runs.topic} ILIKE ${`%${search}%`}`,
      sql`${runs.summary} ILIKE ${`%${search}%`}`,
    ) as SQL);
  }

  const where = and(...conditions);
  const offset = (page - 1) * PAGE_SIZE;

  const [totalResult, rows] = await Promise.all([
    db.select({ count: count() }).from(runs).where(where),
    db
      .select({
        id: runs.id,
        query: runs.query,
        topic: runs.topic,
        playerUrl: runs.playerUrl,
        thumbnailUrl: runs.thumbnailUrl,
        summary: runs.summary,
        events: runs.events,
        selectedVideo: runs.selectedVideo,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .where(where)
      .orderBy(desc(runs.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    runs: rows.map((row) => ({
      id: row.id,
      query: row.query,
      topic: row.topic,
      playerUrl: row.playerUrl,
      thumbnailUrl: row.thumbnailUrl,
      summary: row.summary,
      events: (row.events as BriefingEvent[]) ?? [],
      selectedVideo: row.selectedVideo as VideoCandidate,
      createdAt: row.createdAt?.toISOString() ?? "",
    })),
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const { runs: galleryRuns, total, totalPages } = await getGalleryRuns(search, page);

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1080px] px-[22px] pt-5 pb-24">
        <Link
          href="/"
          className="inline-flex items-center gap-[7px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
        >
          <ArrowLeftIcon className="size-3.5" /> Home
        </Link>

        <div className="mt-[18px] flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[27px] font-extrabold tracking-[-0.02em] text-[var(--c-text)]">Public gallery</h1>
            <p className="mt-1.5 text-[14px] text-[var(--c-text-subtle)]">Curated World Cup match moments · {total} reels</p>
          </div>
          <SearchField initialSearch={search} />
        </div>

        <div className="mt-[22px]">
          <GalleryTabs publicRuns={galleryRuns} total={total} page={page} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}
