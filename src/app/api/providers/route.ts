import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_API_BASE = 'https://api.themoviedb.org/3'

interface TMDBProvider {
    provider_id: number
    provider_name: string
    logo_path: string | null
    display_priority: number
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    try {
        // 1. Fetch available providers from TMDb
        const tmdbUrl = `${TMDB_API_BASE}/watch/providers/movie?api_key=${TMDB_API_KEY}&watch_region=US`
        const tmdbRes = await fetch(tmdbUrl)
        if (!tmdbRes.ok) throw new Error('Failed to fetch from TMDb')
        const tmdbData = await tmdbRes.json()

        const allProviders: TMDBProvider[] = tmdbData.results || []

        allProviders.sort((a, b) => {
            const pA = a.display_priority ?? 999
            const pB = b.display_priority ?? 999
            if (pA !== pB) return pA - pB
            return a.provider_name.localeCompare(b.provider_name)
        })

        // 2. Fetch group's selected providers if groupId is present
        let selectedIds: number[] = []
        if (groupId) {
            const client = supabaseAdmin || supabase
            const { data } = await client
                .from('group_providers')
                .select('provider_id')
                .eq('group_id', groupId)

            if (data) {
                selectedIds = data.map(p => p.provider_id)
            }
        }

        return NextResponse.json({
            providers: allProviders,
            selected: selectedIds
        })

    } catch (error) {
        console.error('Providers API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const { groupId, providerIds } = await request.json()

        if (!groupId || !Array.isArray(providerIds)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        const client = supabaseAdmin || supabase

        // 1. Delete existing selections for this group
        const { error: deleteError } = await client
            .from('group_providers')
            .delete()
            .eq('group_id', groupId)

        if (deleteError) throw deleteError

        // 2. Insert new selections
        if (providerIds.length > 0) {
            const rows = providerIds.map((pid: number) => ({
                group_id: groupId,
                provider_id: pid
            }))

            const { error: insertError } = await client
                .from('group_providers')
                .insert(rows)

            if (insertError) throw insertError
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Providers Save Error:', error)
        return NextResponse.json({ error: 'Failed to save providers' }, { status: 500 })
    }
}
