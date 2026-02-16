'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Moon, Clock, Sparkles, Trash2, ExternalLink, Play, Eye, Check } from 'lucide-react'
import styles from './Tonight.module.css'

interface TonightPick {
    id: string
    title: string
    image: string
    year: number
    mediaType: 'movie' | 'tv'
    overview: string
    rating: number
    pickedBy: string[]
    isOverlap: boolean
    createdAt: string
}

export const Tonight = ({ userId, groupId }: { userId: string, groupId: string }) => {

    const [watchingItems, setWatchingItems] = useState<TonightPick[]>([])
    const [loading, setLoading] = useState(true)
    const [expiresIn, setExpiresIn] = useState('')

    // Derived states to satisfy React 19 purity rules (no Date.now() in render)
    const [tonightPicksArr, setTonightPicksArr] = useState<TonightPick[]>([])
    const [recentlyTonightedArr, setRecentlyTonightedArr] = useState<TonightPick[]>([])

    // Update status (Watching/Watched)
    const updateStatus = async (pick: TonightPick, status: 'watching' | 'watched') => {
        // Optimistic update
        if (status === 'watching') {
            setWatchingItems(prev => [...prev, { ...pick, createdAt: new Date().toISOString() }])
            setTonightPicksArr(prev => prev.filter(p => p.id !== pick.id))
            setRecentlyTonightedArr(prev => prev.filter(p => p.id !== pick.id))
        } else if (status === 'watched') {
            setWatchingItems(prev => prev.filter(p => p.id !== pick.id))
            // Also remove from tonight picks if it was there
            setTonightPicksArr(prev => prev.filter(p => p.id !== pick.id))
            setRecentlyTonightedArr(prev => prev.filter(p => p.id !== pick.id))
            // Clean up from tonight_picks table too since it's done
            removePick(pick)
        }

        try {
            await fetch('/api/swipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    groupId,
                    movieId: pick.id,
                    mediaType: pick.mediaType,
                    status,
                    score: 2 // Assume if they interact here they like it, or keep existing? Defaulting to "Want" (2) seems safe if unsure.
                })
            })
        } catch (err) {
            console.error('Failed to update status:', err)
            // Revert would go here in a full impl
        }
    }

    const fetchPicks = useCallback(async () => {
        try {
            const res = await fetch(`/api/tonight?groupId=${groupId}`)
            const data = await res.json()
            if (data.picks) {
                const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
                const now = Date.now()

                const evening = data.picks.filter((p: TonightPick) =>
                    (now - new Date(p.createdAt).getTime()) < TWELVE_HOURS_MS
                )
                const recent = data.picks.filter((p: TonightPick) =>
                    (now - new Date(p.createdAt).getTime()) >= TWELVE_HOURS_MS
                )

                setTonightPicksArr(evening)
                setRecentlyTonightedArr(recent)
            }
        } catch (err) {
            console.error('Failed to fetch tonight picks:', err)
        }
    }, [groupId])

    const fetchWatching = useCallback(async () => {
        try {
            const res = await fetch(`/api/watchlist?userId=${userId}&groupId=${groupId}`)
            const data = await res.json()
            const items = data.items || data
            if (Array.isArray(items)) {
                setWatchingItems(items
                    .filter((i: { status: string }) => i.status === 'watching')
                    .map((i: { id: string; title: string; image: string; year: number; mediaType: 'movie' | 'tv'; tmdbRating: number }): TonightPick => ({
                        id: i.id,
                        title: i.title,
                        image: i.image,
                        year: i.year,
                        mediaType: i.mediaType,
                        overview: '',
                        rating: i.tmdbRating,
                        pickedBy: [userId],
                        isOverlap: false,
                        createdAt: new Date().toISOString()
                    }))
                )
            }
        } catch (err) {
            console.error('Failed to fetch watching items:', err)
        }
    }, [userId, groupId])

    useEffect(() => {
        const loadAll = async () => {
            setLoading(true)
            await Promise.all([fetchPicks(), fetchWatching()])
            setLoading(false)
        }
        loadAll()
    }, [fetchPicks, fetchWatching])

    // Derived lists for rendering (filtering out items that are currently watching)
    const filteredTonightPicks = React.useMemo(() => {
        const watchingIds = new Set(watchingItems.map(i => i.id))
        return tonightPicksArr.filter(p => !watchingIds.has(p.id))
    }, [tonightPicksArr, watchingItems])

    const filteredRecentPicks = React.useMemo(() => {
        const watchingIds = new Set(watchingItems.map(i => i.id))
        return recentlyTonightedArr.filter(p => !watchingIds.has(p.id))
    }, [recentlyTonightedArr, watchingItems])

    // Countdown timer for expiry
    useEffect(() => {
        const updateExpiry = () => {
            const now = new Date()
            const midnight = new Date(now)
            midnight.setHours(24, 0, 0, 0)
            const diff = midnight.getTime() - now.getTime()
            const h = Math.floor(diff / (1000 * 60 * 60))
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            setExpiresIn(`${h}h ${m}m`)
        }
        updateExpiry()
        const interval = setInterval(updateExpiry, 60000)
        return () => clearInterval(interval)
    }, [])

    const removePick = async (pick: TonightPick) => {
        try {
            await fetch(`/api/tonight?userId=${userId}&movieId=${pick.id}&mediaType=${pick.mediaType}`, {
                method: 'DELETE',
            })
            setTonightPicksArr(prev => prev.filter(p => p.id !== pick.id))
            setRecentlyTonightedArr(prev => prev.filter(p => p.id !== pick.id))
        } catch (err) {
            console.error('Failed to remove tonight pick:', err)
        }
    }

    if (loading) {
        return <div className={styles.loading}>Loading tonight&apos;s picks...</div>
    }

    const renderPickCard = (pick: TonightPick, variant: 'default' | 'watching' | 'recent' = 'default', showRemove: boolean = false) => (
        <div key={pick.id} className={`${styles.pickCard} glass`}>
            <div
                className={styles.pickPoster}
                style={{ backgroundImage: `url(${pick.image})` }}
            />
            <div className={styles.pickInfo}>
                <h4 className={styles.pickTitle}>{pick.title}</h4>
                <span className={styles.pickMeta}>
                    {pick.year} · {pick.mediaType === 'tv' ? 'TV' : 'Movie'}
                </span>
                {pick.pickedBy && pick.pickedBy.length > 1 && (
                    <span className={styles.matchBadge}>Match!</span>
                )}
            </div>
            <div className={styles.pickActions}>
                {variant !== 'watching' && (
                    <button
                        onClick={() => updateStatus(pick, 'watching')}
                        className={styles.pickActionBtn}
                        title="Mark as Watching"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                )}
                {variant === 'watching' && (
                    <button
                        onClick={() => updateStatus(pick, 'watched')}
                        className={`${styles.pickActionBtn} ${styles.btnSuccess}`}
                        title="Mark as Watched"
                        style={{ color: '#4ade80' }}
                    >
                        <Check className="w-4 h-4" />
                    </button>
                )}

                <button
                    onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(pick.title + ' ' + pick.year + ' streaming')}`, '_blank')}
                    className={styles.pickActionBtn}
                    title="Find Streaming"
                >
                    <ExternalLink className="w-4 h-4" />
                </button>

                {showRemove && variant !== 'watching' && (
                    <button
                        onClick={() => removePick(pick)}
                        className={styles.pickRemoveBtn}
                        title="Remove"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <Moon className={styles.headerIcon} />
                <div>
                    <h2 className={styles.title}>Tonight</h2>
                    <div className={styles.timer}>
                        <Clock className="w-3 h-3" />
                        <span>Resets in {expiresIn}</span>
                    </div>
                </div>
            </div>

            {/* OVERLAP BANNER */}
            {filteredTonightPicks.some((p: TonightPick) => p.isOverlap) && (
                <div className={styles.overlapBanner}>
                    <Sparkles className="w-5 h-5" />
                    <span>Multiple family members picked some of these! Check them out!</span>
                </div>
            )}

            {/* Tonight Section */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <Sparkles className="w-4 h-4 text-accent" /> Tonight
                </h3>
                {filteredTonightPicks.length > 0 ? (
                    <div className={styles.pickGrid}>
                        {filteredTonightPicks.map((p: TonightPick) => renderPickCard(p, 'default', p.pickedBy.includes(userId)))}
                    </div>
                ) : (
                    <div className={styles.emptyPicks}>
                        <p>No picks for tonight yet! Swipe right on shows you want to watch tonight.</p>
                    </div>
                )}
            </div>

            {/* Watching Section */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <Play className="w-4 h-4 text-blue-400" /> Watching
                </h3>
                {watchingItems.length > 0 ? (
                    <div className={styles.pickGrid}>
                        {watchingItems.map((p: TonightPick) => renderPickCard(p, 'watching'))}
                    </div>
                ) : (
                    <div className={styles.emptyPicks}>
                        <p>No shows currently being watched.</p>
                    </div>
                )}
            </div>

            {/* Recently Tonighted Section */}
            {filteredRecentPicks.length > 0 && (
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Clock className="w-4 h-4" /> Recently Tonighted
                    </h3>
                    <div className={styles.pickGrid}>
                        {filteredRecentPicks.map((p: TonightPick) => renderPickCard(p, 'recent'))}
                    </div>
                </div>
            )}
        </div>
    )
}
