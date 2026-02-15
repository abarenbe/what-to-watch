'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { SwipeCard } from '@/components/SwipeCard'
import { FilterPanel, FilterState, DEFAULT_FILTERS } from '@/components/FilterPanel'
import { Tv, Film, Settings, Heart, Users, Loader2, SlidersHorizontal } from 'lucide-react'
import { getTMDBImageUrl } from '@/lib/tmdb'
import styles from './page.module.css'

interface Movie {
  id: string
  title: string
  image: string
  rating: number
  year: number
  overview: string
  mediaType: 'movie' | 'tv'
}

import { Matches } from '@/components/Matches'
import { Watchlist } from '@/components/Watchlist'

export default function Home() {
  const [items, setItems] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'discovery' | 'matches' | 'watchlist'>('discovery')
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS })
  const [pendingFilters, setPendingFilters] = useState<FilterState>({ ...DEFAULT_FILTERS })
  const [showFilters, setShowFilters] = useState(false)

  // Mock IDs for the demo phase
  const MOCK_GROUP_ID = '00000000-0000-0000-0000-000000000000'
  const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001'

  // Build the query string from active filters
  const buildQuery = useCallback((pg: number, f: FilterState) => {
    const params = new URLSearchParams()
    params.set('page', pg.toString())
    params.set('type', f.type)
    if (f.genres.length > 0) params.set('genres', f.genres.join(','))
    if (f.ageRating !== 'All Ages') params.set('ageRating', f.ageRating)
    if (f.minRating) params.set('minRating', f.minRating)
    if (f.maxRuntime) params.set('maxRuntime', f.maxRuntime)
    if (f.minRuntime) params.set('minRuntime', f.minRuntime)
    if (f.newReleases) params.set('newReleases', 'true')
    if (f.sortBy !== 'popularity.desc') params.set('sortBy', f.sortBy)
    return params.toString()
  }, [])

  const fetchFeed = useCallback(async () => {
    if (loading && items.length > 0) return;

    try {
      setLoading(true)
      const query = buildQuery(page, filters)
      const res = await fetch(`/api/discovery?${query}`)
      const data = await res.json()
      if (data.results) {
        const mapped: Movie[] = data.results.map((item: {
          id: number;
          title?: string;
          name?: string;
          poster_path: string;
          vote_average: number;
          release_date?: string;
          first_air_date?: string;
          overview?: string;
          media_type?: string;
        }) => ({
          id: item.id.toString(),
          title: item.title || item.name || 'Unknown',
          image: getTMDBImageUrl(item.poster_path),
          rating: item.vote_average,
          year: item.release_date || item.first_air_date
            ? new Date(item.release_date || item.first_air_date!).getFullYear()
            : 0,
          overview: item.overview || '',
          mediaType: (item.media_type || (filters.type !== 'all' ? filters.type : (item.title ? 'movie' : 'tv'))) as 'movie' | 'tv'
        }))
        setItems((prev) => [...prev, ...mapped])
        setPage((p) => p + 1)
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err)
    } finally {
      setLoading(false)
    }
  }, [page, loading, items.length, filters, buildQuery])

  // Initial load
  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  // Load more items when the queue is low
  useEffect(() => {
    if (items.length < 5 && !loading && items.length > 0) {
      fetchFeed()
    }
  }, [items.length, loading, fetchFeed])

  const handleSwipe = async (id: string, direction: 'up' | 'down' | 'left' | 'right', mediaType: 'movie' | 'tv', status: 'swiped' | 'watching' | 'watched' = 'swiped') => {
    setItems((prev) => prev.filter((item) => item.id !== id))

    const score = { up: 3, right: 2, down: 1, left: 0 }[direction]

    try {
      await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: MOCK_USER_ID,
          groupId: MOCK_GROUP_ID,
          movieId: id,
          mediaType: mediaType,
          score,
          status
        })
      })
    } catch (err) {
      console.error('Failed to save swipe:', err)
    }
  }

  const handleReset = () => {
    setItems([])
    setPage(1)
    fetchFeed()
  }

  const applyFilters = () => {
    setFilters({ ...pendingFilters })
    setItems([])
    setPage(1)
    setShowFilters(false)
  }

  const openFilters = () => {
    setPendingFilters({ ...filters })
    setShowFilters(true)
  }

  // Count active filters for the badge
  const activeFilterCount = [
    filters.type !== 'all',
    filters.genres.length > 0,
    filters.ageRating !== 'All Ages',
    filters.minRating !== '',
    filters.maxRuntime !== '' || filters.minRuntime !== '',
    filters.newReleases,
    filters.sortBy !== 'popularity.desc',
  ].filter(Boolean).length

  // Quick filter chips for common presets
  const quickPresets = [
    {
      label: '👨‍👩‍👧‍👦 Family Night',
      apply: () => {
        const f = { ...DEFAULT_FILTERS, ageRating: 'Family (G/PG)', genres: ['Family', 'Animation', 'Comedy'] }
        setFilters(f)
        setPendingFilters(f)
        setItems([])
        setPage(1)
      }
    },
    {
      label: '🍿 New Movies',
      apply: () => {
        const f = { ...DEFAULT_FILTERS, type: 'movie' as const, newReleases: true, minRating: '7' }
        setFilters(f)
        setPendingFilters(f)
        setItems([])
        setPage(1)
      }
    },
    {
      label: '📺 Binge-worthy',
      apply: () => {
        const f = { ...DEFAULT_FILTERS, type: 'tv' as const, minRating: '8', sortBy: 'vote_average.desc' }
        setFilters(f)
        setPendingFilters(f)
        setItems([])
        setPage(1)
      }
    },
  ]

  const visibleItems = items.slice(0, 5)

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.topBar}>
          <div className={styles.logoWrapper}>
            <div className={styles.iconCircle}>
              <Film className="text-white w-6 h-6" />
            </div>
            <h1 className={styles.title}>WATCH</h1>
          </div>
          <button
            className={`${styles.iconButton} glass`}
            style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'discovery' && (
          <div className={styles.filterBar}>
            <button
              onClick={openFilters}
              className={`${styles.filterToggle} glass`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className={styles.filterBadge}>{activeFilterCount}</span>
              )}
            </button>
            {quickPresets.map(preset => (
              <button
                key={preset.label}
                onClick={preset.apply}
                className={`${styles.filterChip} glass`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content Areas */}
      <main className={styles.main}>
        {activeTab === 'discovery' ? (
          loading && items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-muted">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Loading discovery feed...</p>
            </div>
          ) : items.length > 0 ? (
            visibleItems.map((item) => (
              <SwipeCard
                key={item.id}
                {...item}
                onSwipe={handleSwipe}
              />
            )).reverse()
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Tv className="w-10 h-10" />
              </div>
              <h3 className={styles.emptyTitle}>No more shows!</h3>
              <p className={styles.emptyText}>Try adjusting your filters or start over.</p>
              <button onClick={handleReset} className={styles.resetButton}>
                Start Over
              </button>
            </div>
          )
        ) : activeTab === 'matches' ? (
          <Matches groupId={MOCK_GROUP_ID} />
        ) : (
          <Watchlist userId={MOCK_USER_ID} groupId={MOCK_GROUP_ID} />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className={`${styles.nav} glass`}>
        <button
          onClick={() => setActiveTab('discovery')}
          className={`${styles.navButton} ${activeTab === 'discovery' ? styles.navButtonActive : ''}`}
        >
          <Film />
          <span className={styles.navLabel}>Discover</span>
        </button>
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`${styles.navButton} ${activeTab === 'watchlist' ? styles.navButtonActive : ''}`}
        >
          <Tv />
          <span className={styles.navLabel}>My List</span>
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`${styles.navButton} ${activeTab === 'matches' ? styles.navButtonActive : ''}`}
        >
          <Heart />
          <span className={styles.badge} />
          <span className={styles.navLabel}>Matches</span>
        </button>
        <button className={styles.navButton}>
          <Users />
          <span className={styles.navLabel}>Family</span>
        </button>
      </nav>

      {/* Filter Panel Drawer */}
      {showFilters && (
        <FilterPanel
          filters={pendingFilters}
          onChange={setPendingFilters}
          onClose={() => setShowFilters(false)}
          onApply={applyFilters}
        />
      )}
    </div>
  )
}
