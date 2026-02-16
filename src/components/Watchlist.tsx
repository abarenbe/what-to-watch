'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { BookMarked, Play, Check, Filter, X, Clock, Star, SlidersHorizontal, Users } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { WatchlistCard } from './WatchlistCard'
import styles from './Watchlist.module.css'

interface FamilyScore {
    userId: string
    displayName: string
    score: number
}

interface WatchlistItem {
    id: string
    title: string
    image: string
    year: number
    mediaType: 'movie' | 'tv'
    myScore: number
    status: string
    othersCount: number
    genres: string[]
    tmdbRating: number
    runtime: number
    familyScores: FamilyScore[]
    isWatchable: boolean
    ageRating?: string
}

const SCORE_OPTIONS = [
    { score: 0, emoji: '👎', label: 'Nope' },
    { score: 1, emoji: '🤷', label: 'Maybe' },
    { score: 2, emoji: '👍', label: 'Want' },
    { score: 3, emoji: '❤️', label: 'Must Watch' },
]

const STATUS_OPTIONS = [
    { value: 'swiped', label: 'To Watch', icon: BookMarked },
    { value: 'watching', label: 'Watching', icon: Play },
    { value: 'watched', label: 'Watched', icon: Check },
]

const GENRE_OPTIONS = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Kids', 'Music',
    'Mystery', 'Reality', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
]

const RUNTIME_OPTIONS = [
    { label: 'Any', min: 0, max: Infinity },
    { label: '< 90 min', min: 0, max: 90 },
    { label: '90–120 min', min: 90, max: 120 },
    { label: '2+ hours', min: 120, max: Infinity },
]

const TMDB_RATING_OPTIONS = [
    { label: 'Any', value: 0 },
    { label: '6+', value: 6 },
    { label: '7+', value: 7 },
    { label: '8+', value: 8 },
]

interface WatchlistFilters {
    status: string
    myScore: number | null
    mediaType: 'all' | 'movie' | 'tv'
    genres: string[]
    minTmdbRating: number
    runtimeIdx: number       // index into RUNTIME_OPTIONS
    familyMember: string     // userId or 'all'  
    familyMinScore: number   // 0 = any, 1+ = filter
    isWatchable: boolean     // Just Watch filter
    isFamilyFriendly: boolean // G/PG/TV-Y/TV-G/TV-Y7/TV-PG
    sortBy: 'recent' | 'rating' | 'myScore' | 'title'
}

const DEFAULT_WATCHLIST_FILTERS: WatchlistFilters = {
    status: 'all',
    myScore: null,
    mediaType: 'all',
    genres: [],
    minTmdbRating: 0,
    runtimeIdx: 0,
    familyMember: 'all',
    familyMinScore: 0,
    isWatchable: false,
    isFamilyFriendly: false,
    sortBy: 'recent',
}

export const Watchlist = ({ userId, groupId }: { userId: string, groupId: string }) => {
    const [items, setItems] = useState<WatchlistItem[]>([])
    const [members, setMembers] = useState<{ id: string, name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState<WatchlistFilters>({ ...DEFAULT_WATCHLIST_FILTERS })
    const [tonightPicks, setTonightPicks] = useState<Set<string>>(new Set())

    const fetchWatchlist = useCallback(async () => {
        try {
            const res = await fetch(`/api/watchlist?userId=${userId}&groupId=${groupId}`)
            const data = await res.json()
            if (data.items) {
                setItems(data.items)
                setMembers(data.members || [])
            } else if (Array.isArray(data)) {
                setItems(data)
            }
        } catch (err) {
            console.error('Failed to fetch watchlist:', err)
        } finally {
            setLoading(false)
        }
    }, [userId, groupId])

    const fetchTonightPicks = useCallback(async () => {
        try {
            const res = await fetch(`/api/tonight?groupId=${groupId}`)
            const data = await res.json()
            if (data.picks) {
                const myPickIds = new Set<string>(
                    data.picks
                        .filter((p: { pickedBy: string[] }) => p.pickedBy.includes(userId))
                        .map((p: { id: string }) => p.id)
                )
                setTonightPicks(myPickIds)
            }
        } catch (err) {
            console.error('Failed to fetch tonight picks:', err)
        }
    }, [userId, groupId])

    useEffect(() => {
        if (userId && groupId) {
            fetchWatchlist()
            fetchTonightPicks()
        } else {
            setLoading(false)
        }
    }, [userId, groupId, fetchWatchlist, fetchTonightPicks])

    const updateScore = async (item: WatchlistItem, newScore: number) => {
        setUpdatingId(item.id)
        try {
            await fetch('/api/swipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    groupId,
                    movieId: item.id,
                    mediaType: item.mediaType,
                    score: newScore,
                    status: item.status,
                })
            })
            setItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, myScore: newScore } : i
            ))
        } catch (err) {
            console.error('Failed to update score:', err)
        } finally {
            setUpdatingId(null)
        }
    }

    const updateStatus = async (item: WatchlistItem, newStatus: string) => {
        setUpdatingId(item.id)
        try {
            await fetch('/api/swipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    groupId,
                    movieId: item.id,
                    mediaType: item.mediaType,
                    score: item.myScore,
                    status: newStatus,
                })
            })
            setItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, status: newStatus } : i
            ))
        } catch (err) {
            console.error('Failed to update status:', err)
        } finally {
            setUpdatingId(null)
        }
    }



    const toggleTonight = async (item: WatchlistItem) => {
        const isCurrentlyPicked = tonightPicks.has(item.id)

        // Optimistic update
        setTonightPicks(prev => {
            const next = new Set(prev)
            if (isCurrentlyPicked) next.delete(item.id)
            else next.add(item.id)
            return next
        })

        try {
            if (isCurrentlyPicked) {
                await fetch(`/api/tonight?userId=${userId}&movieId=${item.id}&mediaType=${item.mediaType}`, {
                    method: 'DELETE',
                })
            } else {
                await fetch('/api/tonight', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        groupId,
                        movieId: item.id,
                        mediaType: item.mediaType,
                    })
                })
            }
        } catch (err) {
            console.error('Failed to toggle tonight:', err)
            // Revert on error
            setTonightPicks(prev => {
                const next = new Set(prev)
                if (isCurrentlyPicked) next.add(item.id)
                else next.delete(item.id)
                return next
            })
        }
    }

    // ── Filtering logic ──
    const runtimeOpt = RUNTIME_OPTIONS[filters.runtimeIdx]

    const filteredItems = items.filter(i => {
        if (filters.status !== 'all' && i.status !== filters.status) return false

        // Filter by score. If no specific score filter is set, hide "Nope" (0) items by default.
        if (filters.myScore !== null) {
            if (i.myScore !== filters.myScore) return false
        } else {
            if (i.myScore === 0) return false
        }

        if (filters.mediaType !== 'all' && i.mediaType !== filters.mediaType) return false
        if (filters.genres.length > 0 && !filters.genres.some(g => i.genres.includes(g))) return false
        if (filters.minTmdbRating > 0 && i.tmdbRating < filters.minTmdbRating) return false
        if (runtimeOpt.max < Infinity && i.runtime > runtimeOpt.max) return false
        if (runtimeOpt.min > 0 && i.runtime < runtimeOpt.min) return false
        if (filters.isWatchable && !i.isWatchable) return false

        if (filters.isFamilyFriendly) {
            // Check age rating. 
            // Normalize: G, PG, TV-Y, TV-Y7, TV-G, TV-PG are "Family"
            // Typically PG-13, R, TV-14, TV-MA are NOT.
            // Edge case: NR or Unrated? Usually safe to exclude if strict, or include if lenient?
            // Let's exclude NR for "safe" filtering.
            const r = (i.ageRating || '').toUpperCase()
            const safe = ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG']
            if (!safe.includes(r)) return false
        }

        // Family member filter
        if (filters.familyMember === 'none') {
            if (i.othersCount > 0) return false
        } else if (filters.familyMember !== 'all') {
            const memberScore = i.familyScores.find(fs => fs.userId === filters.familyMember)
            if (!memberScore || memberScore.score < filters.familyMinScore) return false
        } else if (filters.familyMinScore > 0) {
            // "Anyone in family rated at least X"
            const anyMatch = i.familyScores.some(fs => fs.score >= filters.familyMinScore)
            if (!anyMatch) return false
        }

        return true
    })

    // Sorting
    const sortedItems = [...filteredItems].sort((a, b) => {
        switch (filters.sortBy) {
            case 'myScore': return b.myScore - a.myScore
            case 'rating': return b.tmdbRating - a.tmdbRating
            case 'title': return a.title.localeCompare(b.title)
            default: return 0 // 'recent' — keep API order
        }
    })

    const activeFilterCount = [
        filters.status !== 'all',
        filters.myScore !== null,
        filters.mediaType !== 'all',
        filters.genres.length > 0,
        filters.minTmdbRating > 0,
        filters.runtimeIdx > 0,
        filters.familyMember !== 'all' || filters.familyMinScore > 0,
        filters.isWatchable,
        filters.isFamilyFriendly,
        filters.sortBy !== 'recent',
    ].filter(Boolean).length

    const clearAllFilters = () => {
        setFilters({ ...DEFAULT_WATCHLIST_FILTERS })
    }

    const toggleGenre = (genre: string) => {
        setFilters(prev => ({
            ...prev,
            genres: prev.genres.includes(genre)
                ? prev.genres.filter(g => g !== genre)
                : [...prev.genres, genre]
        }))
    }

    // Collect unique family members from all items


    if (loading) {
        return <div className={styles.loading}>Loading your list...</div>
    }

    if (!userId || !groupId) {
        return <div className={styles.empty}>Please join a group to see your list.</div>
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <BookMarked className="text-secondary" />
                <h2 className={styles.title}>My Watchlist</h2>
                <span className={styles.count}>{items.length}</span>
            </div>

            {/* Filter bar */}
            {items.length > 0 && (
                <div className={styles.filterBar}>
                    <button
                        onClick={() => setShowFilters(true)}
                        className={styles.filterToggle}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className={styles.filterBadge}>{activeFilterCount}</span>
                        )}
                    </button>

                    {/* Quick-access status chips */}
                    <div className={styles.quickChips}>
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, familyMember: prev.familyMember === 'none' ? 'all' : 'none' }))}
                            className={`${styles.quickChip} ${filters.familyMember === 'none' ? styles.quickChipActive : ''}`}
                        >
                            🎯 Solo
                        </button>
                        {STATUS_OPTIONS.map(opt => {
                            const count = items.filter(i => i.status === opt.value).length
                            if (count === 0) return null
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilters(prev => ({
                                        ...prev,
                                        status: prev.status === opt.value ? 'all' : opt.value
                                    }))}
                                    className={`${styles.quickChip} ${filters.status === opt.value ? styles.quickChipActive : ''}`}
                                >
                                    {opt.label} ({count})
                                </button>
                            )
                        })}
                    </div>

                    {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} className={styles.clearFilters}>
                            Clear
                        </button>
                    )}

                    <span className={styles.resultCount}>
                        {sortedItems.length} of {items.length}
                    </span>
                </div>
            )}

            {/* Full filter panel (drawer) */}
            {showFilters && (
                <div className={styles.filterBackdrop} onClick={() => setShowFilters(false)}>
                    <div className={styles.filterPanel} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className={styles.filterPanelHeader}>
                            <div className={styles.filterPanelTitle}>
                                <SlidersHorizontal className="w-5 h-5" />
                                <span>Filter Watchlist</span>
                                {activeFilterCount > 0 && (
                                    <span className={styles.filterBadge}>{activeFilterCount}</span>
                                )}
                            </div>
                            <div className={styles.filterHeaderActions}>
                                {activeFilterCount > 0 && (
                                    <button className={styles.resetBtn} onClick={clearAllFilters}>Reset</button>
                                )}
                                <button className={styles.closeBtn} onClick={() => setShowFilters(false)}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className={styles.filterScroll}>
                            {/* Media Type */}
                            <section className={styles.filterSection}>
                                <h3 className={styles.filterSectionTitle}>Type</h3>
                                <div className={styles.chipRow}>
                                    {(['all', 'movie', 'tv'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setFilters(prev => ({ ...prev, mediaType: t }))}
                                            className={`${styles.chip} ${filters.mediaType === t ? styles.chipActive : ''}`}
                                        >
                                            {t === 'all' ? '🎯 All' : t === 'movie' ? '🎬 Movies' : '📺 TV Shows'}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Status */}
                            <section className={styles.filterSection}>
                                <h3 className={styles.filterSectionTitle}>Collections</h3>
                                <div className={styles.chipRow}>
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, isWatchable: !prev.isWatchable }))}
                                        className={`${styles.chip} ${filters.isWatchable ? styles.chipActive : ''}`}
                                    >
                                        ✅ Just Watch
                                    </button>
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, isFamilyFriendly: !prev.isFamilyFriendly }))}
                                        className={`${styles.chip} ${filters.isFamilyFriendly ? styles.chipActive : ''}`}
                                    >
                                        👶 Family Friendly
                                    </button>
                                </div>
                            </section>

                            {/* Status */}
                            <section className={styles.filterSection}>
                                <h3 className={styles.filterSectionTitle}>Status</h3>
                                <div className={styles.chipRow}>
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                                        className={`${styles.chip} ${filters.status === 'all' ? styles.chipActive : ''}`}
                                    >
                                        All
                                    </button>
                                    {STATUS_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFilters(prev => ({
                                                ...prev,
                                                status: prev.status === opt.value ? 'all' : opt.value
                                            }))}
                                            className={`${styles.chip} ${filters.status === opt.value ? styles.chipActive : ''}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* My Rating */}
                            <section className={styles.filterSection}>
                                <h3 className={styles.filterSectionTitle}>My Rating</h3>
                                <div className={styles.chipRow}>
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, myScore: null }))}
                                        className={`${styles.chip} ${filters.myScore === null ? styles.chipActive : ''}`}
                                    >
                                        Any
                                    </button>
                                    {SCORE_OPTIONS.filter(s => s.score > 0).reverse().map(opt => (
                                        <button
                                            key={opt.score}
                                            onClick={() => setFilters(prev => ({
                                                ...prev,
                                                myScore: prev.myScore === opt.score ? null : opt.score
                                            }))}
                                            className={`${styles.chip} ${filters.myScore === opt.score ? styles.chipActive : ''}`}
                                        >
                                            {opt.emoji} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Family Members' Ratings */}
                            {members.length > 0 && (
                                <section className={styles.filterSection}>
                                    <h3 className={styles.filterSectionTitle}>
                                        <Users className="w-4 h-4" /> Liked By
                                    </h3>
                                    <div className={styles.familyFilterRow}>
                                        <div className={styles.chipRow}>
                                            <button
                                                onClick={() => setFilters(prev => ({ ...prev, familyMember: 'all', familyMinScore: 0 }))}
                                                className={`${styles.chip} ${filters.familyMember === 'all' && filters.familyMinScore === 0 ? styles.chipActive : ''}`}
                                            >
                                                Anyone
                                            </button>
                                            <button
                                                onClick={() => setFilters(prev => ({
                                                    ...prev,
                                                    familyMember: prev.familyMember === 'none' ? 'all' : 'none',
                                                    familyMinScore: 0
                                                }))}
                                                className={`${styles.chip} ${filters.familyMember === 'none' ? styles.chipActive : ''}`}
                                            >
                                                🎯 Solo Picks
                                            </button>
                                            {members.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setFilters(prev => ({
                                                        ...prev,
                                                        familyMember: prev.familyMember === m.id ? 'all' : m.id,
                                                        familyMinScore: prev.familyMinScore || 1,
                                                    }))}
                                                    className={`${styles.chip} ${filters.familyMember === m.id ? styles.chipActive : ''}`}
                                                >
                                                    {m.name}
                                                </button>
                                            ))}
                                        </div>
                                        {(filters.familyMember !== 'all' && filters.familyMember !== 'none' || filters.familyMinScore > 0) && (
                                            <div className={styles.chipRow} style={{ marginTop: 12 }}>
                                                <span className={styles.filterSubLabel}>Rating:</span>
                                                {SCORE_OPTIONS.filter(s => s.score > 0).map(opt => (
                                                    <button
                                                        key={opt.score}
                                                        onClick={() => setFilters(prev => ({
                                                            ...prev,
                                                            familyMinScore: prev.familyMinScore === opt.score ? 0 : opt.score,
                                                        }))}
                                                        className={`${styles.chip} ${styles.chipSmall} ${filters.familyMinScore === opt.score ? styles.chipActive : ''}`}
                                                    >
                                                        {opt.emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Genres */}
                            <section className={styles.filterSection}>
                                <h3 className={styles.filterSectionTitle}>Genre</h3>
                                <div className={styles.genreGrid}>
                                    {GENRE_OPTIONS.map(genre => (
                                        <button
                                            key={genre}
                                            onClick={() => toggleGenre(genre)}
                                            className={`${styles.chip} ${filters.genres.includes(genre) ? styles.chipActive : ''}`}
                                        >
                                            {genre}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* TMDb Rating */}
                            <section className={styles.filterSection}>
                                <h3 className={styles.filterSectionTitle}>
                                    <Star className="w-4 h-4" /> TMDb Rating
                                </h3>
                                <div className={styles.chipRow}>
                                    {TMDB_RATING_OPTIONS.map(opt => (
                                        <button
                                            key={opt.label}
                                            onClick={() => setFilters(prev => ({ ...prev, minTmdbRating: opt.value }))}
                                            className={`${styles.chip} ${filters.minTmdbRating === opt.value ? styles.chipActive : ''}`}
                                        >
                                            {opt.value ? `⭐ ${opt.label}` : opt.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Runtime */}
                            {filters.mediaType !== 'tv' && (
                                <section className={styles.filterSection}>
                                    <h3 className={styles.filterSectionTitle}>
                                        <Clock className="w-4 h-4" /> Runtime
                                    </h3>
                                    <div className={styles.chipRow}>
                                        {RUNTIME_OPTIONS.map((opt, idx) => (
                                            <button
                                                key={opt.label}
                                                onClick={() => setFilters(prev => ({ ...prev, runtimeIdx: idx }))}
                                                className={`${styles.chip} ${filters.runtimeIdx === idx ? styles.chipActive : ''}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Sort */}
                            <section className={styles.filterSection}>
                                <h3 className={styles.filterSectionTitle}>Sort By</h3>
                                <div className={styles.chipRow}>
                                    {([
                                        { label: 'Recent', value: 'recent' as const },
                                        { label: 'My Rating', value: 'myScore' as const },
                                        { label: 'TMDb Rating', value: 'rating' as const },
                                        { label: 'Title', value: 'title' as const },
                                    ]).map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFilters(prev => ({ ...prev, sortBy: opt.value }))}
                                            className={`${styles.chip} ${filters.sortBy === opt.value ? styles.chipActive : ''}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Done button */}
                        <div className={styles.applyBar}>
                            <button className={styles.applyBtn} onClick={() => setShowFilters(false)}>
                                Show {sortedItems.length} Result{sortedItems.length !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {sortedItems.length > 0 ? (
                <div className={styles.grid}>
                    <AnimatePresence>
                        {sortedItems.map((item) => (
                            <WatchlistCard
                                key={item.id}
                                item={item}
                                isUpdating={updatingId === item.id}
                                isTonight={tonightPicks.has(item.id)}
                                onUpdateScore={updateScore}
                                onUpdateStatus={updateStatus}
                                onToggleTonight={toggleTonight}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className={styles.empty}>
                    <p>
                        {activeFilterCount > 0
                            ? `No items match your filters. Try adjusting them.`
                            : 'Your watchlist is empty. Swipe right on shows you want to watch!'}
                    </p>
                    {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} className={styles.clearFiltersBtn}>
                            Clear All Filters
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
