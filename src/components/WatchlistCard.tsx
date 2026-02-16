'use client'

import React from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Trash2, Moon, Play, Check, Users, ExternalLink, Eye } from 'lucide-react'
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

interface WatchlistCardProps {
    item: WatchlistItem
    isUpdating: boolean
    isTonight: boolean
    onUpdateScore: (item: WatchlistItem, score: number) => void
    onUpdateStatus: (item: WatchlistItem, status: string) => void
    onToggleTonight: (item: WatchlistItem) => void
}

export const WatchlistCard = ({
    item,
    isUpdating,
    isTonight,
    onUpdateScore,
    onUpdateStatus,
    onToggleTonight
}: WatchlistCardProps) => {
    const x = useMotionValue(0)

    // Swipe LEFT (negative x) -> Reveals RIGHT side (Nope/Red)
    const nopeOpacity = useTransform(x, [-50, -100], [0, 1])

    // Swipe RIGHT (positive x) -> Reveals LEFT side (Tonight/Yellow)
    const tonightOpacity = useTransform(x, [50, 100], [0, 1])

    const currentScore = SCORE_OPTIONS.find(s => s.score === item.myScore)

    return (
        <motion.div
            className={styles.swipeRow}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.2 }}
        >
            {/* Action Backgrounds */}
            <div className={styles.swipeBackground}>
                {/* Right Side (Nope) - Revealed by swiping LEFT */}
                <motion.div
                    className={`${styles.swipeAction} ${styles.swipeActionLeft}`}
                    style={{ opacity: nopeOpacity }}
                >
                    <Trash2 className="w-6 h-6" />
                    <span>Nope</span>
                </motion.div>

                {/* Left Side (Tonight) - Revealed by swiping RIGHT */}
                <motion.div
                    className={`${styles.swipeAction} ${styles.swipeActionRight}`}
                    style={{ opacity: tonightOpacity }}
                >
                    <Moon className="w-6 h-6" />
                    <span>Tonight</span>
                </motion.div>
            </div>

            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                style={{ x }}
                onDragEnd={(_, info) => {
                    if (info.offset.x < -100) {
                        // Swipe Left -> Nope
                        onUpdateScore(item, 0)
                    } else if (info.offset.x > 100) {
                        // Swipe Right -> Tonight
                        if (!isTonight) onToggleTonight(item)
                    }
                }}
                className={`${styles.card} glass ${isUpdating ? styles.cardUpdating : ''}`}
            >
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
                            {item.status !== 'swiped' && (
                                <span className={`${styles.pill} ${item.status === 'watching' ? styles.pillWatching : styles.pillWatched}`}>
                                    {item.status === 'watching' ? <Play className="w-3 h-3 fill-current" /> : <Check className="w-3 h-3" />}
                                    {item.status === 'watching' ? 'Watching' : 'Watched'}
                                </span>
                            )}

                            {isTonight && (
                                <span className={`${styles.pill} ${styles.pillTonight}`}>
                                    <Moon className="w-3 h-3 fill-current" /> Tonight
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
                                onClick={() => onUpdateStatus(item, item.status === 'watching' ? 'swiped' : 'watching')}
                                className={`${styles.watchingBtn} ${item.status === 'watching' ? styles.watchingBtnActive : ''}`}
                            >
                                <Eye className="w-4 h-4" />
                                <span>{item.status === 'watching' ? 'Watching' : 'Watch'}</span>
                            </button>
                            <button
                                onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(item.title + ' ' + item.year + ' ' + (item.mediaType === 'tv' ? 'tv show' : 'movie') + ' streaming')}`, '_blank')}
                                className={styles.actionBtn}
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>More</span>
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
