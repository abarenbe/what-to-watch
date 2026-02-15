'use client'

import React, { useEffect, useState } from 'react'
import { Star, TrendingUp, Users } from 'lucide-react'
import styles from './Matches.module.css'

interface Match {
    id: string
    title: string
    image: string
    score: number
    swipeCount: number
    year: number
}

export const Matches = ({ groupId }: { groupId: string }) => {
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const res = await fetch(`/api/matches?groupId=${groupId}`)
                const data = await res.json()
                if (Array.isArray(data)) {
                    setMatches(data)
                }
            } catch (err) {
                console.error('Failed to fetch matches:', err)
            } finally {
                setLoading(false)
            }
        }

        if (groupId) fetchMatches()
    }, [groupId])

    if (loading) {
        return <div className={styles.loading}>Finding consensus...</div>
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <TrendingUp className="text-accent" />
                <h2 className={styles.title}>Top Matches</h2>
            </div>

            {matches.length > 0 ? (
                <div className={styles.grid}>
                    {matches.map((match) => (
                        <div key={match.id} className={`${styles.card} glass fade-in`}>
                            <div
                                className={styles.poster}
                                style={{ backgroundImage: `url(${match.image})` }}
                            />
                            <div className={styles.info}>
                                <div className={styles.matchHeader}>
                                    <h3 className={styles.movieTitle}>{match.title}</h3>
                                    <span className={styles.year}>{match.year}</span>
                                </div>

                                <div className={styles.stats}>
                                    <div className={styles.scoreBadge}>
                                        <Star className="w-3 h-3 fill-accent text-accent" />
                                        <span>Score: {match.score}</span>
                                    </div>
                                    <div className={styles.userBadge}>
                                        <Users className="w-3 h-3" />
                                        <span>{match.swipeCount} Swipes</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.empty}>
                    <p>No matches yet. Keep swiping!</p>
                </div>
            )}
        </div>
    )
}
