import { NextResponse } from 'next/server'
import { getDiscoveryFeed, DiscoveryFilters } from '@/lib/tmdb'
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
    }

    try {
        const data = await getDiscoveryFeed(filters)
        return NextResponse.json(data)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
