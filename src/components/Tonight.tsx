'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Moon, Sparkles, Users, Trash2, ExternalLink, Clock, Popcorn } from 'lucide-react'
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
}

export const Tonight = ({ userId, groupId }: { userId: string, groupId: string }) => {
    const [picks, setPicks] = useState<TonightPick[]>([])
    const [loading, setLoading] = useState(true)
    const [expiresIn, setExpiresIn] = useState('')

    const fetchPicks = useCallback(async () => {
        try {
            const res = await fetch(`/api/tonight?groupId=${groupId}`)
            const data = await res.json()
            if (data.picks) {
                setPicks(data.picks)
            }
        } catch (err) {
            console.error('Failed to fetch tonight picks:', err)
        } finally {
            setLoading(false)
        }
    }, [groupId])

    useEffect(() => {
        fetchPicks()
    }, [fetchPicks])

    // Countdown timer for expiry
    useEffect(() => {
        const updateExpiry = () => {
            const now = new Date()
            const midnight = new Date(now)
            midnight.setHours(24, 0, 0, 0)
            const diff = midnight.getTime() - now.getTime()
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            setExpiresIn(`${hours}h ${mins}m`)
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
            setPicks(prev => prev.filter(p => p.id !== pick.id))
        } catch (err) {
            console.error('Failed to remove tonight pick:', err)
        }
    }

    const myPicks = picks.filter(p => p.pickedBy.includes(userId))
    const otherPicks = picks.filter(p => !p.pickedBy.includes(userId))
    const overlaps = picks.filter(p => p.isOverlap)

    if (loading) {
        return <div className={styles.loading}>Loading tonight&apos;s picks...</div>
    }

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

            {/* Overlap / Match Section */}
            {overlaps.length > 0 && (
                <div className={styles.overlapSection}>
                    <div className={styles.overlapHeader}>
                        <Sparkles className={styles.sparkle} />
                        <h3 className={styles.overlapTitle}>
                            {overlaps.length === 1 ? "Everyone's pick!" : `${overlaps.length} matches tonight!`}
                        </h3>
                    </div>
                    <div className={styles.overlapCards}>
                        {overlaps.map(pick => (
                            <div key={pick.id} className={styles.overlapCard}>
                                <div
                                    className={styles.overlapPoster}
                                    style={{ backgroundImage: `url(${pick.image})` }}
                                >
                                    <div className={styles.overlapGlow} />
                                </div>
                                <div className={styles.overlapInfo}>
                                    <h4 className={styles.overlapName}>{pick.title}</h4>
                                    <span className={styles.overlapMeta}>
                                        {pick.year} · {pick.mediaType === 'tv' ? 'TV' : 'Movie'} · ⭐ {pick.rating.toFixed(1)}
                                    </span>
                                    <div className={styles.overlapMatch}>
                                        <Users className="w-3.5 h-3.5" />
                                        {pick.pickedBy.length} family members picked this!
                                    </div>
                                    <button
                                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(pick.title + ' ' + pick.year + ' streaming')}`, '_blank')}
                                        className={styles.watchNowBtn}
                                    >
                                        <Popcorn className="w-4 h-4" />
                                        Watch Now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* My Picks */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                    <Moon className="w-4 h-4" />
                    My Picks ({myPicks.length})
                </h3>
                {myPicks.length > 0 ? (
                    <div className={styles.pickGrid}>
                        {myPicks.map(pick => (
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
                                </div>
                                <div className={styles.pickActions}>
                                    <button
                                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(pick.title + ' ' + pick.year + ' streaming')}`, '_blank')}
                                        className={styles.pickActionBtn}
                                        title="Find streaming"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => removePick(pick)}
                                        className={styles.pickRemoveBtn}
                                        title="Remove pick"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyPicks}>
                        <p>No picks yet! Go to <strong>My List</strong> and tap the 🌙 button on shows you&apos;re in the mood for tonight.</p>
                    </div>
                )}
            </div>

            {/* Family's Picks */}
            {otherPicks.length > 0 && (
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Users className="w-4 h-4" />
                        Family&apos;s Picks ({otherPicks.length})
                    </h3>
                    <div className={styles.pickGrid}>
                        {otherPicks.map(pick => (
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
                                    <span className={styles.pickedBy}>
                                        Picked by a family member
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
