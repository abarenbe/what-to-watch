'use client'

import React, { useEffect, useState } from 'react'
import { BookMarked, Users, ExternalLink, Play } from 'lucide-react'
import styles from './Watchlist.module.css'

interface WatchlistItem {
    id: string
    title: string
    image: string
    year: number
    mediaType: 'movie' | 'tv'
    myScore: number
    status: string
    othersCount: number
}

export const Watchlist = ({ userId, groupId }: { userId: string, groupId: string }) => {
    const [items, setItems] = useState<WatchlistItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchWatchlist = async () => {
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
        }

        if (userId && groupId) fetchWatchlist()
    }, [userId, groupId])

    if (loading) {
        return <div className={styles.loading}>Loading your list...</div>
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <BookMarked className="text-secondary" />
                <h2 className={styles.title}>My Watchlist</h2>
            </div>

            {items.length > 0 ? (
                <div className={styles.grid}>
                    {items.map((item) => (
                        <div key={item.id} className={`${styles.card} glass fade-in`}>
                            <div
                                className={styles.poster}
                                style={{ backgroundImage: `url(${item.image})` }}
                            />
                            <div className={styles.info}>
                                <div className={styles.movieHeader}>
                                    <h3 className={styles.movieTitle}>{item.title}</h3>
                                    <span className={styles.year}>{item.year} · {item.mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                                </div>

                                <div className={styles.pills}>
                                    {item.status === 'watching' && (
                                        <span className={`${styles.pill} ${styles.pillWatching}`}>
                                            <Play className="w-3 h-3 fill-current" />
                                            Watching
                                        </span>
                                    )}
                                    {item.othersCount > 0 && (
                                        <span className={`${styles.pill} ${styles.pillMatch}`}>
                                            <Users className="w-3 h-3" />
                                            {item.othersCount} Others Match
                                        </span>
                                    )}
                                </div>

                                <div className={styles.actions}>
                                    <button
                                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(item.title + ' ' + item.year + ' streaming')}`, '_blank')}
                                        className={styles.actionBtn}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>Find Show</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.empty}>
                    <p>Your watchlist is empty. Swipe right on shows you want to watch!</p>
                </div>
            )}
        </div>
    )
}
