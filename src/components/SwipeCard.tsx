import React from 'react'
import { motion, PanInfo, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { Star, Play, Search, Eye, ChevronDown, Check, X } from 'lucide-react'
import styles from './SwipeCard.module.css'

interface SwipeCardProps {
    id: string
    title: string
    image: string
    rating: number
    year: number
    overview: string
    mediaType: 'movie' | 'tv'
    isActive?: boolean
    onSwipe: (id: string, direction: 'up' | 'down' | 'left' | 'right', mediaType: 'movie' | 'tv', status?: 'swiped' | 'watching' | 'watched') => void
}

export const SwipeCard = ({ id, title, image, rating = 0, year, overview, mediaType, isActive = true, onSwipe }: SwipeCardProps) => {
    const [isExpanded, setIsExpanded] = React.useState(false)
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const rotate = useTransform(x, [-200, 200], [-25, 25])
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0])

    const rightOpacity = useTransform(x, [0, 80], [0, 1])
    const leftOpacity = useTransform(x, [0, -80], [0, 1])
    const upOpacity = useTransform(y, [0, -80], [0, 1])
    const downOpacity = useTransform(y, [0, 80], [0, 1])

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        if (isExpanded) return
        const threshold = 100
        if (info.offset.x > threshold) onSwipe(id, 'right', mediaType)
        else if (info.offset.x < -threshold) onSwipe(id, 'left', mediaType)
        else if (info.offset.y < -threshold) onSwipe(id, 'up', mediaType)
        else if (info.offset.y > threshold) onSwipe(id, 'down', mediaType)
    }

    const handleAction = (e: React.MouseEvent, status: 'watching' | 'watched' | 'skip') => {
        e.stopPropagation()
        if (status === 'skip') {
            onSwipe(id, 'left', mediaType)
        } else {
            onSwipe(id, 'up', mediaType, status)
        }
    }

    const openSearch = (e: React.MouseEvent) => {
        e.stopPropagation()
        const mediaLabel = mediaType === 'tv' ? 'tv show' : 'movie'
        window.open(`https://www.google.com/search?q=${encodeURIComponent(title + ' ' + year + ' ' + mediaLabel + ' where to watch')}`, '_blank')
    }

    return (
        <motion.div
            layout
            style={{ x, y, rotate, opacity }}
            drag={!isExpanded && isActive}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
            onClick={() => isActive && !isExpanded && setIsExpanded(true)}
            className={`${styles.card} glass ${isExpanded ? styles.cardExpanded : ''} ${isActive ? styles.cardActive : ''}`}
        >
            <div className={styles.detailsScroll}>
                <div className={styles.image} style={{ backgroundImage: `url(${image})` }} />
                <div className={styles.overlay} />

                <button className={styles.skipButton} onClick={(e) => handleAction(e, 'skip')}>
                    <X className="w-5 h-5" />
                </button>

                <div className={styles.content}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>{title}</h2>
                        {isExpanded && (
                            <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}>
                                <ChevronDown className="w-6 h-6" />
                            </button>
                        )}
                        {!isExpanded && (
                            <div className={styles.rating}>
                                <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                                <span>{rating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.meta}>
                        <span>{year}</span>
                        <span>•</span>
                        <span style={{
                            background: mediaType === 'tv' ? 'rgba(139,92,246,0.25)' : 'rgba(59,130,246,0.25)',
                            color: mediaType === 'tv' ? '#a78bfa' : '#60a5fa',
                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700
                        }}>
                            {mediaType === 'tv' ? 'TV' : 'Movie'}
                        </span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            <span>{rating.toFixed(1)}</span>
                        </div>
                    </div>

                    <p className={styles.synopsis}>{overview}</p>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                            >
                                <button className={styles.trailerButton} onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + year + ' trailer')}`, '_blank')
                                }}>
                                    <Play className="w-4 h-4 fill-current" />
                                    Watch Trailer
                                </button>

                                <div className={styles.actionGrid}>
                                    <button className={styles.actionButton} onClick={openSearch}>
                                        <Search className="w-4 h-4" />
                                        Search Info
                                    </button>
                                    <button className={styles.actionButton} onClick={(e) => handleAction(e, 'watching')}>
                                        <Eye className="w-4 h-4" />
                                        Watching
                                    </button>
                                    <button className={styles.actionButton} onClick={(e) => handleAction(e, 'watched')}>
                                        <Check className="w-4 h-4" />
                                        Watched
                                    </button>
                                    <button className={styles.actionButton} onClick={(e) => handleAction(e, 'skip')}>
                                        <ChevronDown className="w-4 h-4" />
                                        Skip Now
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Swipe Indicators */}
            {!isExpanded && (
                <>
                    <motion.div style={{ opacity: rightOpacity }} className={`${styles.indicator} ${styles.indicatorRight}`}>SOCIAL</motion.div>
                    <motion.div style={{ opacity: leftOpacity }} className={`${styles.indicator} ${styles.indicatorLeft}`}>NOPE</motion.div>
                    <motion.div style={{ opacity: upOpacity }} className={`${styles.indicator} ${styles.indicatorUp}`}>WATCH</motion.div>
                    <motion.div style={{ opacity: downOpacity }} className={`${styles.indicator} ${styles.indicatorDown}`}>MAYBE</motion.div>
                </>
            )}
        </motion.div>
    )
}
