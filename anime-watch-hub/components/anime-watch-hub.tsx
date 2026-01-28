'use client'

import React from "react"
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useAnimeSearch } from '@/hooks/use-anime-search'
import { PlatformCard } from '@/components/platform-card'
import { ResultsSidebar } from '@/components/results-sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2, Sparkles, RotateCcw } from 'lucide-react'

export function AnimeWatchHub() {
  const searchParams = useSearchParams()
  const [animeTitle, setAnimeTitle] = useState(searchParams?.get('title') || '')
  const [searchedTitle, setSearchedTitle] = useState('')
  const { search, reset, isSearching, isDiscovering, agents, error } = useAnimeSearch()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (animeTitle.trim()) {
      setSearchedTitle(animeTitle.trim())
      await search(animeTitle.trim())
    }
  }

  const handleReset = () => {
    setAnimeTitle('')
    setSearchedTitle('')
    reset()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Anime Watch Hub</h1>
                <p className="text-xs text-muted-foreground">Find where to stream any anime</p>
              </div>
            </div>
            {agents.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                New Search
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search Section */}
        <div className="mx-auto max-w-2xl">
          <Card className="border-2">
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="anime-search" className="text-sm font-medium">
                    Search for an anime
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="anime-search"
                      type="text"
                      placeholder="e.g., Attack on Titan, Demon Slayer, One Piece..."
                      value={animeTitle}
                      onChange={(e) => setAnimeTitle(e.target.value)}
                      disabled={isSearching}
                      className="text-base"
                    />
                    <Button type="submit" disabled={isSearching || !animeTitle.trim()}>
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Search</span>
                    </Button>
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Discovery Status */}
        {isDiscovering && (
          <div className="mx-auto mt-8 max-w-2xl">
            <Card>
              <CardContent className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Using AI to find streaming platforms for &quot;{searchedTitle}&quot;...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Section */}
        {agents.length > 0 && !isDiscovering && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Platform Grid */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                Checking {agents.length} Streaming Platforms
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {agents.map((agent) => (
                  <PlatformCard key={agent.platformId} agent={agent} />
                ))}
              </div>
            </div>

            {/* Results Sidebar */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ResultsSidebar agents={agents} animeTitle={searchedTitle} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && agents.length === 0 && (
          <div className="mx-auto mt-12 max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Find Where to Watch</h2>
            <p className="mt-2 text-muted-foreground">
              Enter an anime title above and we&apos;ll check Netflix, Crunchyroll, 
              Prime Video, Hulu, and more to find where it&apos;s streaming.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['Attack on Titan', 'Demon Slayer', 'Jujutsu Kaisen', 'One Piece'].map((title) => (
                <Button
                  key={title}
                  variant="outline"
                  size="sm"
                  onClick={() => setAnimeTitle(title)}
                >
                  {title}
                </Button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
