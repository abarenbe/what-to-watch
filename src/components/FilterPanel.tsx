'use client'

import React from 'react'
import { X, Sparkles, Clock, Star, Baby, SlidersHorizontal, Languages, Users } from 'lucide-react'
import styles from './FilterPanel.module.css'

const GENRE_OPTIONS = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Kids', 'Music',
    'Mystery', 'Reality', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
]

const AGE_OPTIONS = [
    { label: 'All Ages', desc: 'No filter' },
    { label: 'Family (G/PG)', desc: 'Kid-friendly' },
    { label: 'Teen (PG-13)', desc: 'PG-13 & under' },
    { label: 'Mature (R)', desc: 'Includes R-rated' },
]

const RUNTIME_OPTIONS = [
    { label: 'Any', min: '', max: '' },
    { label: '< 90 min', min: '', max: '90' },
    { label: '90–120 min', min: '90', max: '120' },
    { label: '2+ hours', min: '120', max: '' },
]

const RATING_OPTIONS = [
    { label: 'Any', value: '' },
    { label: '6+', value: '6' },
    { label: '7+', value: '7' },
    { label: '8+', value: '8' },
]

const SORT_OPTIONS = [
    { label: 'Popularity', value: 'popularity.desc' },
    { label: 'Rating', value: 'vote_average.desc' },
    { label: 'Newest', value: 'primary_release_date.desc' },
    { label: 'Oldest', value: 'primary_release_date.asc' },
]

const LANGUAGE_OPTIONS = [
    { label: 'All Languages', value: '' },
    { label: 'English', value: 'en' },
    { label: 'Spanish', value: 'es' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
    { label: 'Japanese', value: 'ja' },
    { label: 'Korean', value: 'ko' },
    { label: 'Hindi', value: 'hi' },
]

export interface FilterState {
    type: 'all' | 'movie' | 'tv'
    genres: string[]
    ageRating: string[]
    minRating: string
    runtimes: string[] // e.g. ['<90', '90-120']
    language: string
    newReleases: boolean
    familyLiked: boolean
    likedByMember?: string
    isFree: boolean
    isClassic: boolean
    sortBy: string
    query?: string
}

export const DEFAULT_FILTERS: FilterState = {
    type: 'all',
    genres: [],
    ageRating: [],
    minRating: '6',
    runtimes: [],
    language: 'en',
    newReleases: true,
    familyLiked: false,
    isFree: false,
    isClassic: false,
    sortBy: 'popularity.desc',
}

interface FilterPanelProps {
    filters: FilterState
    onChange: (filters: FilterState) => void
    members?: { id: string, display_name: string }[]
    onClose: () => void
    onApply: () => void
}

export const FilterPanel = ({ filters, onChange, members = [], onClose, onApply }: FilterPanelProps) => {
    const update = (partial: Partial<FilterState>) => {
        onChange({ ...filters, ...partial })
    }

    const toggleGenre = (genre: string) => {
        const next = filters.genres.includes(genre)
            ? filters.genres.filter(g => g !== genre)
            : [...filters.genres, genre]
        update({ genres: next })
    }

    const activeFilterCount = [
        filters.genres.length > 0,
        filters.ageRating.length > 0,
        filters.minRating !== '',
        filters.runtimes.length > 0,
        filters.language !== '',
        filters.newReleases,
        filters.familyLiked,
        filters.sortBy !== 'popularity.desc',
    ].filter(Boolean).length

    const handleReset = () => {
        onChange({ ...DEFAULT_FILTERS })
    }

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.panelHeader}>
                    <div className={styles.panelTitle}>
                        <SlidersHorizontal className="w-5 h-5" />
                        <span>Filters</span>
                        {activeFilterCount > 0 && (
                            <span className={styles.filterCount}>{activeFilterCount}</span>
                        )}
                    </div>
                    <div className={styles.headerActions}>
                        {activeFilterCount > 0 && (
                            <button className={styles.resetBtn} onClick={handleReset}>Reset</button>
                        )}
                        <button className={styles.closeBtn} onClick={onClose}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className={styles.scrollArea}>
                    {/* Media Type */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Type</h3>
                        <div className={styles.chipRow}>
                            {(['all', 'movie', 'tv'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => update({ type: t })}
                                    className={`${styles.chip} ${filters.type === t ? styles.chipActive : ''}`}
                                >
                                    {t === 'all' ? '🔥 Trending' : t === 'movie' ? '🎬 Movies' : '📺 TV Shows'}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Genres */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Genre</h3>
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

                    {/* Age Rating */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <Baby className="w-4 h-4" /> Age Rating
                        </h3>
                        <div className={styles.chipRow}>
                            {AGE_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => {
                                        const isSelected = filters.ageRating.includes(opt.label)
                                        const next = isSelected
                                            ? filters.ageRating.filter(r => r !== opt.label)
                                            : [...filters.ageRating, opt.label]
                                        update({ ageRating: next })
                                    }}
                                    className={`${styles.chip} ${filters.ageRating.includes(opt.label) ? styles.chipActive : ''}`}
                                >
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Runtime (only for movies) */}
                    {filters.type !== 'tv' && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <Clock className="w-4 h-4" /> Runtime
                            </h3>
                            <div className={styles.chipRow}>
                                {RUNTIME_OPTIONS.map(opt => (
                                    <button
                                        key={opt.label}
                                        onClick={() => {
                                            const isSelected = filters.runtimes.includes(opt.label)
                                            const next = isSelected
                                                ? filters.runtimes.filter(r => r !== opt.label)
                                                : [...filters.runtimes, opt.label]
                                            update({ runtimes: next })
                                        }}
                                        className={`${styles.chip} ${filters.runtimes.includes(opt.label)
                                            ? styles.chipActive : ''
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Language */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <Languages className="w-4 h-4" /> Language
                        </h3>
                        <div className={styles.chipRow}>
                            {LANGUAGE_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => update({ language: opt.value })}
                                    className={`${styles.chip} ${filters.language === opt.value ? styles.chipActive : ''}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Minimum Rating */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <Star className="w-4 h-4" /> Minimum Rating
                        </h3>
                        <div className={styles.chipRow}>
                            {RATING_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => update({ minRating: opt.value })}
                                    className={`${styles.chip} ${filters.minRating === opt.value ? styles.chipActive : ''}`}
                                >
                                    {opt.value ? `⭐ ${opt.label}` : opt.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* New Releases & Collections */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <Sparkles className="w-4 h-4" /> Collections
                        </h3>
                        <div className={styles.chipRow}>
                            <button
                                onClick={() => update({ newReleases: !filters.newReleases, isClassic: false })}
                                className={`${styles.chip} ${filters.newReleases ? styles.chipActive : ''}`}
                            >
                                🔥 New Releases
                            </button>
                            <button
                                onClick={() => update({ familyLiked: !filters.familyLiked })}
                                className={`${styles.chip} ${filters.familyLiked ? styles.chipActive : ''}`}
                            >
                                ❤️ Family Liked
                            </button>
                            <button
                                onClick={() => update({ isClassic: !filters.isClassic, newReleases: false })}
                                className={`${styles.chip} ${filters.isClassic ? styles.chipActive : ''}`}
                            >
                                📼 Classics
                            </button>
                            <button
                                onClick={() => update({ isFree: !filters.isFree })}
                                className={`${styles.chip} ${filters.isFree ? styles.chipActive : ''}`}
                            >
                                ✅ Just Watch
                            </button>
                            <button
                                onClick={() => {
                                    // Quick toggle for G/PG (Family) in Age Rating
                                    const familyLabel = 'Family (G/PG)'
                                    const next = filters.ageRating.includes(familyLabel)
                                        ? filters.ageRating.filter(r => r !== familyLabel)
                                        : [familyLabel] // Replace or add? Let's treat it as a filter set.
                                    update({ ageRating: next })
                                }}
                                className={`${styles.chip} ${filters.ageRating.includes('Family (G/PG)') ? styles.chipActive : ''}`}
                            >
                                👶 Family Friendly
                            </button>
                        </div>
                    </section>

                    {/* Liked By Member */}
                    {filters.familyLiked && members.length > 0 && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <Users className="w-4 h-4" /> Liked By
                            </h3>
                            <div className={styles.chipRow}>
                                <button
                                    onClick={() => update({ likedByMember: undefined })}
                                    className={`${styles.chip} ${!filters.likedByMember ? styles.chipActive : ''}`}
                                >
                                    Everyone Else
                                </button>
                                {members.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => update({ likedByMember: m.id })}
                                        className={`${styles.chip} ${filters.likedByMember === m.id ? styles.chipActive : ''}`}
                                    >
                                        {m.display_name}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Sort By */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Sort By</h3>
                        <div className={styles.chipRow}>
                            {SORT_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => update({ sortBy: opt.value })}
                                    className={`${styles.chip} ${filters.sortBy === opt.value ? styles.chipActive : ''}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Apply Button */}
                <div className={styles.applyBar}>
                    <button className={styles.applyBtn} onClick={onApply}>
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    )
}
