'use client'

import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const SwipeCard = dynamic(() => import('@/components/SwipeCard').then(mod => mod.SwipeCard), {
  ssr: false,
})
import { FilterPanel, FilterState, DEFAULT_FILTERS } from '@/components/FilterPanel'
import { Tv, Film, Settings, Heart, Users, Loader2, SlidersHorizontal, Moon, ChevronDown, Search } from 'lucide-react'
import { getTMDBImageUrl } from '@/lib/tmdb'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { AuthScreen } from '@/components/AuthScreen'
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

const GroupSetup = dynamic(() => import('@/components/GroupSetup').then(mod => mod.GroupSetup), { ssr: false })
const Matches = dynamic(() => import('@/components/Matches').then(mod => mod.Matches), { ssr: false })
const Watchlist = dynamic(() => import('@/components/Watchlist').then(mod => mod.Watchlist), { ssr: false })
const Tonight = dynamic(() => import('@/components/Tonight').then(mod => mod.Tonight), { ssr: false })

export default function Home() {
  const { user, profile, groups, activeGroup, loading: authLoading, switchGroup } = useAuth()

  const [items, setItems] = useState<Movie[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeTab, setActiveTab] = useState<'discovery' | 'matches' | 'watchlist' | 'tonight' | 'family'>('discovery')
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS })
  const [pendingFilters, setPendingFilters] = useState<FilterState>({ ...DEFAULT_FILTERS })
  const [showFilters, setShowFilters] = useState(false)
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set())
  const [swipedIdsLoaded, setSwipedIdsLoaded] = useState(false)
  const [showGroupPicker, setShowGroupPicker] = useState(false)

  // ── Auth gates ──
  // ... (auth loading check not shown in partial replace context, keep existing) ...

  // Real auth IDs
  const userId = user?.id || ''
  const groupId = activeGroup?.id || ''

  // Reset discovery when active group changes
  useEffect(() => {
    if (groupId) {
      setItems([])
      setPage(1)
      setHasMore(true)
      setSwipedIdsLoaded(false)
    }
  }, [groupId])

  // Build the query string from active filters
  const buildQuery = useCallback((pg: number, f: FilterState) => {
    const params = new URLSearchParams()
    params.set('page', pg.toString())
    if (userId) params.set('userId', userId)
    if (groupId) params.set('groupId', groupId)
    if (f.query) params.set('query', f.query)
    params.set('type', f.type)
    if (f.genres.length > 0) params.set('genres', f.genres.join(','))
    if (f.ageRating.length > 0) params.set('ageRating', f.ageRating.join(','))
    if (f.minRating) params.set('minRating', f.minRating)
    if (f.runtimes.length > 0) params.set('runtimes', f.runtimes.join(','))
    if (f.language) params.set('language', f.language)
    if (f.newReleases) params.set('newReleases', 'true')
    if (f.familyLiked) params.set('familyLiked', 'true')
    if (f.isFree) params.set('isFree', 'true')
    if (f.isClassic) params.set('isClassic', 'true')
    if (f.sortBy !== 'popularity.desc') params.set('sortBy', f.sortBy)
    return params.toString()
  }, [userId, groupId])

  // Fetch already-swiped IDs so we can filter them from discovery
  useEffect(() => {
    if (!userId) return
    const loadSwipedIds = async () => {
      try {
        let query = supabase
          .from('swipes')
          .select('movie_id, media_type')
          .eq('user_id', userId)

        // If in a group, we still validly want to filter out things we swiped IN THIS GROUP? 
        // Or globally? 
        // Per previous decision: Filter strictly by group context to allow re-matching?
        // Actually, let's filter by group to be consistent with API fix.
        if (groupId) {
          query = query.eq('group_id', groupId)
        }

        const { data, error } = await query

        if (error) {
          console.error('Failed to load swiped IDs:', error)
        } else {
          const keys = (data || []).map(r => `${r.movie_id}_${r.media_type}`)
          setSwipedIds(new Set(keys))
        }
      } catch (err) {
        console.error('Failed to load swiped IDs:', err)
      } finally {
        setSwipedIdsLoaded(true)
      }
    }
    loadSwipedIds()
  }, [userId, groupId])

  const fetchFeed = useCallback(async () => {
    if (loading || !hasMore) return;
    if (page > 500) {
      setHasMore(false)
      return;
    }
    if (!swipedIdsLoaded) return;

    try {
      setLoading(true)
      const query = buildQuery(page, filters)
      const res = await fetch(`/api/discovery?${query}`)
      const data = await res.json()
      if (data.results && data.results.length > 0) {
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
        }) => {
          const mediaType = (item.media_type || (filters.type !== 'all' ? filters.type : (item.title ? 'movie' : 'tv'))) as 'movie' | 'tv'
          return {
            id: item.id.toString(),
            title: item.title || item.name || 'Unknown',
            image: getTMDBImageUrl(item.poster_path),
            rating: item.vote_average,
            year: item.release_date || item.first_air_date
              ? new Date(item.release_date || item.first_air_date!).getFullYear()
              : 0,
            overview: item.overview || '',
            mediaType
          }
        })

        const unswiped = mapped.filter(m => !swipedIds.has(`${m.id}_${m.mediaType}`))
        if (unswiped.length > 0) {
          setItems((prev) => [...prev, ...unswiped])
        }

        // If we got results but they were all filtered, we should probably try the next page immediately
        // instead of waiting for the user to swipe.
        if (data.results.length > 0 && unswiped.length === 0) {
          setPage(p => p + 1)
          // We don't return here, the next useEffect will trigger again if items.length is still low
        } else if (data.results.length > 0) {
          setPage((p) => p + 1)
        }

        // If we got fewer results than expected or empty, we might be at the end
        if (data.results.length === 0 || (data.total_pages && page >= data.total_pages)) {
          setHasMore(false)
        }
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err)
    } finally {
      setLoading(false)
    }
  }, [page, loading, hasMore, filters, buildQuery, swipedIds, swipedIdsLoaded])

  useEffect(() => {
    if (swipedIdsLoaded) fetchFeed()
  }, [fetchFeed, swipedIdsLoaded])

  useEffect(() => {
    if (items.length < 5 && !loading && items.length > 0) {
      fetchFeed()
    }
  }, [items.length, loading, fetchFeed])

  const handleSwipe = async (id: string, direction: 'up' | 'down' | 'left' | 'right', mediaType: 'movie' | 'tv', status: 'swiped' | 'watching' | 'watched' = 'swiped') => {
    setItems((prev) => prev.filter((item) => !(item.id === id && item.mediaType === mediaType)))
    setSwipedIds(prev => {
      const next = new Set(prev)
      next.add(`${id}_${mediaType}`)
      return next
    })
    const score = { up: 3, right: 2, down: 1, left: 0 }[direction]

    try {
      const { error } = await supabase.from('swipes').upsert({
        user_id: userId,
        group_id: groupId,
        movie_id: id,
        media_type: mediaType,
        score,
        status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, movie_id, media_type, group_id' })

      if (error) console.error('Failed to save swipe:', error)
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
    setHasMore(true)
    setShowFilters(false)
  }

  const openFilters = () => {
    setPendingFilters({ ...filters })
    setShowFilters(true)
  }

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters(prev => ({ ...prev, query: searchTerm }))
    setItems([])
    setPage(1)
    if (!searchTerm) setShowSearch(false)
  }

  const activeFilterCount = [
    filters.type !== 'all',
    filters.genres.length > 0,
    filters.ageRating.length > 0,
    filters.minRating !== '',
    filters.runtimes.length > 0,
    filters.newReleases,
    filters.isFree,
    filters.isClassic,
    !!filters.query,
    filters.sortBy !== 'popularity.desc',
  ].filter(Boolean).length

  const quickPresets = [
    {
      label: '👨‍👩‍👧‍👦 Family Night',
      apply: () => {
        const f = { ...DEFAULT_FILTERS, ageRating: ['Family (G/PG)'], genres: ['Family', 'Animation', 'Comedy'] }
        setFilters(f); setPendingFilters(f); setItems([]); setPage(1)
      }
    },
    {
      label: '🍿 New Movies',
      apply: () => {
        const f = { ...DEFAULT_FILTERS, type: 'movie' as const, newReleases: true, minRating: '7' }
        setFilters(f); setPendingFilters(f); setItems([]); setPage(1)
      }
    },
    {
      label: '📺 Binge-worthy',
      apply: () => {
        const f = { ...DEFAULT_FILTERS, type: 'tv' as const, minRating: '8', sortBy: 'vote_average.desc' }
        setFilters(f); setPendingFilters(f); setItems([]); setPage(1)
      }
    },
  ]

  const visibleItems = items.slice(0, 5)

  const [showSetup, setShowSetup] = useState(false)

  // Trigger setup if needed (but only once loaded)
  useEffect(() => {
    if (!authLoading && user && (!profile?.display_name || groups.length === 0)) {
      setShowSetup(true)
    }
  }, [authLoading, user, profile, groups.length])

  // ── Auth gates ──
  if (authLoading) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    )
  }

  if (!user) return <AuthScreen />

  // If setup is needed or explicitly showing
  if (showSetup) {
    return <GroupSetup mode="setup" onComplete={() => setShowSetup(false)} />
  }

  // ── Main app ──
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

          <div className="flex items-center gap-2">
            {/* Search Bar */}
            {activeTab === 'discovery' && (
              <div className={`${styles.searchWrapper} ${showSearch ? styles.searchExpanded : ''}`}>
                {showSearch ? (
                  <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search titles..."
                      className={styles.searchInput}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      onBlur={() => !searchTerm && setShowSearch(false)}
                    />
                    <button type="submit" className={styles.iconButton}>
                      <Search className="w-5 h-5 text-accent" />
                    </button>
                  </form>
                ) : (
                  <button onClick={() => setShowSearch(true)} className={styles.iconButton}>
                    <Search className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Group Switcher (if multiple groups) */}
            {groups.length > 1 ? (
              <div style={{ position: 'relative' }}>
                <button
                  className={`${styles.iconButton} glass`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700
                  }}
                  onClick={() => setShowGroupPicker(!showGroupPicker)}
                >
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeGroup?.name || 'Group'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showGroupPicker && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowGroupPicker(false)} />
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: 8, zIndex: 51,
                      background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16, padding: 8, minWidth: 180,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                    }}>
                      {groups.map(m => (
                        <button
                          key={m.group.id}
                          onClick={() => { switchGroup(m.group.id); setShowGroupPicker(false) }}
                          style={{
                            display: 'block', width: '100%', padding: '10px 14px', borderRadius: 10,
                            fontSize: '0.85rem', fontWeight: activeGroup?.id === m.group.id ? 800 : 500,
                            color: activeGroup?.id === m.group.id ? 'var(--accent)' : 'var(--foreground)',
                            textAlign: 'left', transition: 'background 0.15s',
                            background: activeGroup?.id === m.group.id ? 'rgba(219,39,119,0.08)' : 'transparent'
                          }}
                        >
                          {m.group.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                className={`${styles.iconButton} glass`}
                style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {activeTab === 'discovery' && (
          <div className={styles.filterBar}>
            <button onClick={openFilters} className={`${styles.filterToggle} glass`}>
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
            </button>
            {quickPresets.map(preset => (
              <button key={preset.label} onClick={preset.apply} className={`${styles.filterChip} glass`}>
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={`${styles.main} ${activeTab === 'discovery' ? styles.mainCentered : ''}`}>
        {activeTab === 'discovery' ? (
          loading && items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-muted">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Loading discovery feed...</p>
            </div>
          ) : items.length > 0 ? (
            visibleItems.map((item, index) => (
              <SwipeCard
                key={`${item.id}_${item.mediaType}`}
                {...item}
                rating={item.rating || 0}
                onSwipe={handleSwipe}
                isActive={index === 0}
              />
            )).reverse()
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><Tv className="w-10 h-10" /></div>
              <h3 className={styles.emptyTitle}>No more options!</h3>
              <p className={styles.emptyText}>Change filters to see more options.</p>
              <button onClick={openFilters} className={styles.resetButton}>Adjust Filters</button>
              <button onClick={handleReset} className={styles.resetSecondary}>Start Over</button>
            </div>
          )
        ) : activeTab === 'matches' ? (
          <Matches groupId={groupId} />
        ) : activeTab === 'tonight' ? (
          <Tonight userId={userId} groupId={groupId} />
        ) : activeTab === 'family' ? (
          <GroupSetup mode="manage" />
        ) : (
          <Watchlist userId={userId} groupId={groupId} />
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
        <button
          onClick={() => setActiveTab('tonight')}
          className={`${styles.navButton} ${activeTab === 'tonight' ? styles.navButtonActive : ''}`}
        >
          <Moon />
          <span className={styles.navLabel}>Tonight</span>
        </button>
        <button
          onClick={() => setActiveTab('family')}
          className={`${styles.navButton} ${activeTab === 'family' ? styles.navButtonActive : ''}`}
        >
          <Users />
          <span className={styles.navLabel}>Groups</span>
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
