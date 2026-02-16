'use client'

import React, { useEffect, useState } from 'react'
import { Check, Search, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import styles from './ServiceSelection.module.css'

interface ServiceSelectionProps {
    onComplete: () => void
}

interface Provider {
    provider_id: number
    provider_name: string
    logo_path: string
    display_priority: number
}

export function ServiceSelection({ onComplete }: ServiceSelectionProps) {
    const { activeGroup } = useAuth()
    const [providers, setProviders] = useState<Provider[]>([])
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const groupId = activeGroup?.id

    useEffect(() => {
        if (!groupId) {
            setLoading(false)
            return
        }

        async function fetchProviders() {
            try {
                const res = await fetch(`/api/providers?groupId=${groupId}`)
                if (!res.ok) throw new Error('Failed to load providers')
                const data = await res.json()
                setProviders(data.providers || [])
                setSelectedIds(data.selected || [])
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        fetchProviders()
    }, [groupId])

    const toggleProvider = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(pid => pid !== id)
                : [...prev, id]
        )
    }

    const handleSave = async () => {
        if (!groupId) return
        setSaving(true)
        try {
            await fetch('/api/providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, providerIds: selectedIds })
            })
            onComplete()
        } catch (err) {
            console.error('Failed to save', err)
            onComplete()
        } finally {
            setSaving(false)
        }
    }

    const filteredProviders = providers
        .filter(p => p.provider_name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.display_priority - b.display_priority)

    if (loading) {
        return (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Select Your Services</h2>
                <p>We&apos;ll prioritize movies available on these platforms.</p>
            </div>

            <div className={styles.searchBar}>
                <Search className="w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search Netflix, Hulu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            <div className={styles.grid}>
                {filteredProviders.map(provider => {
                    const isSelected = selectedIds.includes(provider.provider_id)
                    return (
                        <div
                            key={provider.provider_id}
                            className={`${styles.card} ${isSelected ? styles.selected : ''}`}
                            onClick={() => toggleProvider(provider.provider_id)}
                        >
                            <div className={styles.logoWrapper}>
                                <img
                                    src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                                    alt={provider.provider_name}
                                    className={styles.logo}
                                />
                                {isSelected && (
                                    <div className={styles.checkOverlay}>
                                        <Check className="w-6 h-6 text-white" />
                                    </div>
                                )}
                            </div>
                            <span className={styles.name}>{provider.provider_name}</span>
                        </div>
                    )
                })}
            </div>

            <div className={styles.actions}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={styles.saveBtn}
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {selectedIds.length === 0 ? 'Skip for now' : `Save ${selectedIds.length} Services`}
                </button>
            </div>
        </div>
    )
}
