import { Suspense } from 'react'
import { AnimeWatchHub } from '@/components/anime-watch-hub'

function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AnimeWatchHub />
    </Suspense>
  )
}
