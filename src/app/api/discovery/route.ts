import { NextResponse } from 'next/server'
import { getDiscoveryFeed, DiscoveryFilters, fetchTMDB, endpoints } from '@/lib/tmdb'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const userId = searchParams.get('userId')
    const client = supabaseAdmin || supabase

    // Logic to determine available watch providers
    let watchProviders: string | undefined = undefined

    try {
        let providerIds: number[] = []

        if (groupId) {
            // Get all members of the group
            const { data: members } = await client
                .from('group_members')
                .select('user_id')
                .eq('group_id', groupId)

            if (members && members.length > 0) {
                const memberIds = members.map(m => m.user_id)
                // Get providers for all members (UNION logic - if ANYONE has it, show it)
                // Or INTERSECTION? "We want to watch together" -> Intersection?
                // Usually family sharing implies Union (I have Netflix, you have Hulu = we have both).
                // Let's use Union.
                const { data: providers } = await client
                    .from('user_providers')
                    .select('provider_id')
                    .in('user_id', memberIds)

                if (providers) {
                    providerIds = providers.map(p => p.provider_id)
                }
            }
        } else if (userId) {
            // Check just for this user
            const { data: providers } = await client
                .from('user_providers')
                .select('provider_id')
                .eq('user_id', userId)

            if (providers) {
                providerIds = providers.map(p => p.provider_id)
            }
        }

        // Dedup ids
        if (providerIds.length > 0) {
            watchProviders = [...new Set(providerIds)].join('|')
        }
    } catch (e) {
        console.warn('Failed to fetch providers for discovery filter', e)
        // Fallback to no filter
    }

    const filters: DiscoveryFilters = {
        page: parseInt(searchParams.get('page') || '1'),
        type: (searchParams.get('type') || 'all') as 'all' | 'movie' | 'tv',
        genres: searchParams.get('genres') || undefined,
        ageRating: searchParams.get('ageRating') || undefined,
        minRating: searchParams.get('minRating') || undefined,
        runtimes: searchParams.get('runtimes') || undefined,
        language: searchParams.get('language') || undefined,
        newReleases: searchParams.get('newReleases') || undefined,
        sortBy: searchParams.get('sortBy') || undefined,
        watchProviders, // Add this
        query: searchParams.get('query') || undefined, // Search query
        isFree: searchParams.get('isFree') || undefined, // "true" or "false"
        isClassic: searchParams.get('isClassic') || undefined, // "true" or "false"
        familyLiked: searchParams.get('familyLiked') || undefined,
    }

    // --- Special Mode: Family Liked ---
    // If filtering by family likes, we query our DB for items others liked,
    // then hydrate those specific IDs from TMDB.
    if (filters.familyLiked === 'true' && groupId && userId) {
        try {
            // 1. Get IDs liked by others in this group
            const { data: likedSwipes } = await client
                .from('swipes')
                .select('movie_id, media_type')
                .eq('group_id', groupId)
                .neq('user_id', userId)
                .gte('score', 2) // Liked (+) or Must Watch (++)

            if (!likedSwipes || likedSwipes.length === 0) {
                return NextResponse.json({ results: [], page: 1, total_pages: 1 })
            }

            // Dedup IDs (different people might have liked the same thing)
            const uniqueItems = Array.from(
                new Map(likedSwipes.map(s => [`${s.movie_id}_${s.media_type}`, s])).values()
            )

            // Pagination (Discovery uses page 1, 2, 3...)
            const pageSize = 20
            const page = filters.page || 1
            const start = (page - 1) * pageSize
            const end = start + pageSize
            const pageItems = uniqueItems.slice(start, end)

            // 2. Hydrate from TMDB
            // Note: Since we need details for EACH, we do parallel fetches.
            // This is slightly heavy but okay for small page sizes.
            const results = await Promise.all(
                pageItems.map(async (s) => {
                    try {
                        const type = (s.media_type || 'movie') as 'movie' | 'tv'
                        const details = await fetchTMDB(endpoints.details(s.movie_id, type))
                        return { ...details, media_type: type }
                    } catch {
                        return null
                    }
                })
            )

            return NextResponse.json({
                results: results.filter(Boolean),
                page,
                total_pages: Math.ceil(uniqueItems.length / pageSize)
            })
        } catch (error) {
            console.error('Family Liked Discovery Error:', error)
            // Fall through to normal discovery if this fails? 
            // Or return error? Let's return error for clarity.
            return NextResponse.json({ error: 'Failed to fetch family likes' }, { status: 500 })
        }
    }

    try {
        const data = await getDiscoveryFeed(filters)
        return NextResponse.json(data)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
