'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { BookMarked, Users, ExternalLink, Play, Trash2, Check, ChevronDown, ChevronUp, Moon, Film, Tv, Filter, X, Clock, Star, Baby, SlidersHorizontal } from 'lucide-react'
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
    sortBy: 'recent',
}

export const Watchlist = ({ userId, groupId }: { userId: string, groupId: string }) => {
    const [items, setItems] = useState<WatchlistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState<WatchlistFilters>({ ...DEFAULT_WATCHLIST_FILTERS })
    const [tonightPicks, setTonightPicks] = useState<Set<string>>(new Set())

    const fetchWatchlist = useCallback(async () => {
        try {
            const res = await fetch(`/api/watchlist?userId=${userId}&groupId=${groupId}`)
            const data = await res.json()
            if (Array.isArray(data)) {
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

    const removeItem = async (item: WatchlistItem) => {
        setUpdatingId(item.id)
        try {
            await fetch(`/api/swipe?userId=${userId}&movieId=${item.id}&mediaType=${item.mediaType}`, {
                method: 'DELETE',
            })
            setItems(prev => prev.filter(i => i.id !== item.id))
        } catch (err) {
            console.error('Failed to remove item:', err)
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
        if (filters.myScore !== null && i.myScore !== filters.myScore) return false
        if (filters.mediaType !== 'all' && i.mediaType !== filters.mediaType) return false
        if (filters.genres.length > 0 && !filters.genres.some(g => i.genres.includes(g))) return false
        if (filters.minTmdbRating > 0 && i.tmdbRating < filters.minTmdbRating) return false
        if (runtimeOpt.max < Infinity && i.runtime > runtimeOpt.max) return false
        if (runtimeOpt.min > 0 && i.runtime < runtimeOpt.min) return false

        // Family member filter
        if (filters.familyMember !== 'all') {
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
    const familyMembers = Array.from(
        new Map(
            items.flatMap(i => i.familyScores).map(fs => [fs.userId, fs.displayName])
        ).entries()
    ).map(([id, name]) => ({ id, name }))

    if (loading) {
        return <div className={styles.loading}>Loading your list...</div>
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
                            {familyMembers.length > 0 && (
                                <section className={styles.filterSection}>
                                    <h3 className={styles.filterSectionTitle}>
                                        <Users className="w-4 h-4" /> Family Ratings
                                    </h3>
                                    <div className={styles.familyFilterRow}>
                                        <div className={styles.chipRow}>
                                            <button
                                                onClick={() => setFilters(prev => ({ ...prev, familyMember: 'all', familyMinScore: 0 }))}
                                                className={`${styles.chip} ${filters.familyMember === 'all' && filters.familyMinScore === 0 ? styles.chipActive : ''}`}
                                            >
                                                Anyone
                                            </button>
                                            {familyMembers.map(m => (
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
                                        {(filters.familyMember !== 'all' || filters.familyMinScore > 0) && (
                                            <div className={styles.chipRow} style={{ marginTop: 8 }}>
                                                <span className={styles.filterSubLabel}>Min rating:</span>
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
                    {sortedItems.map((item) => {
                        const isExpanded = expandedId === item.id
                        const isUpdating = updatingId === item.id
                        const currentScore = SCORE_OPTIONS.find(s => s.score === item.myScore)
                        const currentStatus = STATUS_OPTIONS.find(s => s.value === item.status)

                        return (
                            <div key={item.id} className={`${styles.card} glass fade-in ${isUpdating ? styles.cardUpdating : ''}`}>
                                <div className={styles.cardMain}>
                                    <div
                                        className={styles.poster}
                                        style={{ backgroundImage: `url(${item.image})` }}
                                    />
                                    <div className={styles.info}>
                                        <div className={styles.movieHeader}>
                                            <h3 className={styles.movieTitle}>{item.title}</h3>
                                            <span className={styles.year}>
                                                {item.year} · {item.mediaType === 'tv' ? 'TV' : 'Movie'}
                                                {item.runtime > 0 && ` · ${item.runtime}m`}
                                            </span>
                                        </div>

                                        <div className={styles.pills}>
                                            {/* Current rating badge */}
                                            <span className={`${styles.pill} ${styles.pillRating}`}>
                                                {currentScore?.emoji} {currentScore?.label}
                                            </span>

                                            {/* Status badge */}
                                            {item.status !== 'swiped' && currentStatus && (
                                                <span className={`${styles.pill} ${item.status === 'watching' ? styles.pillWatching : styles.pillWatched}`}>
                                                    {item.status === 'watching' ? <Play className="w-3 h-3 fill-current" /> : <Check className="w-3 h-3" />}
                                                    {currentStatus.label}
                                                </span>
                                            )}

                                            {/* TMDb rating */}
                                            {item.tmdbRating > 0 && (
                                                <span className={`${styles.pill} ${styles.pillTmdb}`}>
                                                    ⭐ {item.tmdbRating.toFixed(1)}
                                                </span>
                                            )}

                                            {item.othersCount > 0 && (
                                                <span className={`${styles.pill} ${styles.pillMatch}`}>
                                                    <Users className="w-3 h-3" />
                                                    {item.othersCount} Match
                                                </span>
                                            )}
                                        </div>

                                        {/* Family scores inline */}
                                        {item.familyScores.length > 0 && (
                                            <div className={styles.familyScores}>
                                                {item.familyScores.map(fs => {
                                                    const fsScore = SCORE_OPTIONS.find(s => s.score === fs.score)
                                                    return (
                                                        <span key={fs.userId} className={styles.familyScorePill} title={`${fs.displayName}: ${fsScore?.label}`}>
                                                            {fs.displayName.split(' ')[0]}: {fsScore?.emoji}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        <div className={styles.actions}>
                                            <button
                                                onClick={() => toggleTonight(item)}
                                                className={`${styles.tonightBtn} ${tonightPicks.has(item.id) ? styles.tonightBtnActive : ''}`}
                                                title={tonightPicks.has(item.id) ? 'Remove from tonight' : 'Pick for tonight'}
                                            >
                                                <Moon className="w-4 h-4" />
                                                <span>Tonight</span>
                                            </button>
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                                className={`${styles.editBtn} ${isExpanded ? styles.editBtnActive : ''}`}
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(item.title + ' ' + item.year + ' ' + (item.mediaType === 'tv' ? 'tv show' : 'movie') + ' streaming')}`, '_blank')}
                                                className={styles.actionBtn}
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                <span>Find</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded edit panel */}
                                {isExpanded && (
                                    <div className={styles.editPanel}>
                                        {/* Re-rate */}
                                        <div className={styles.editSection}>
                                            <span className={styles.editLabel}>Rating</span>
                                            <div className={styles.scoreRow}>
                                                {SCORE_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt.score}
                                                        onClick={() => updateScore(item, opt.score)}
                                                        className={`${styles.scoreBtn} ${item.myScore === opt.score ? styles.scoreBtnActive : ''}`}
                                                        disabled={isUpdating}
                                                    >
                                                        <span className={styles.scoreEmoji}>{opt.emoji}</span>
                                                        <span className={styles.scoreLabel}>{opt.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className={styles.editSection}>
                                            <span className={styles.editLabel}>Status</span>
                                            <div className={styles.statusRow}>
                                                {STATUS_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => updateStatus(item, opt.value)}
                                                        className={`${styles.statusBtn} ${item.status === opt.value ? styles.statusBtnActive : ''}`}
                                                        disabled={isUpdating}
                                                    >
                                                        <opt.icon className="w-3.5 h-3.5" />
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Genres display */}
                                        {item.genres.length > 0 && (
                                            <div className={styles.editSection}>
                                                <span className={styles.editLabel}>Genres</span>
                                                <div className={styles.genreTags}>
                                                    {item.genres.map(g => (
                                                        <span key={g} className={styles.genreTag}>{g}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Remove */}
                                        <button
                                            onClick={() => removeItem(item)}
                                            className={styles.removeBtn}
                                            disabled={isUpdating}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Remove from list
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
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
