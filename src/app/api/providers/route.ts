import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_API_BASE = 'https://api.themoviedb.org/3'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    try {
        // 1. Fetch available providers from TMDb
        const tmdbUrl = `${TMDB_API_BASE}/watch/providers/movie?api_key=${TMDB_API_KEY}&watch_region=US`
        const tmdbRes = await fetch(tmdbUrl)
        if (!tmdbRes.ok) throw new Error('Failed to fetch from TMDb')
        const tmdbData = await tmdbRes.json()

        // Filter to popular ones to avoid 100s of obscure platforms
        // (Just returning all sorted by display_priority is usually handled by TMDB)
        const allProviders: any[] = tmdbData.results || []

        // Sort by priority (lower is better, e.g. Netflix/Hulu first)
        allProviders.sort((a, b) => {
            const pA = a.display_priority ?? 999
            const pB = b.display_priority ?? 999
            if (pA !== pB) return pA - pB
            return a.provider_name.localeCompare(b.provider_name)
        })

        // 2. Fetch user's selected providers if userId is present
        let selectedIds: number[] = []
        if (userId) {
            const client = supabaseAdmin || supabase
            const { data } = await client
                .from('user_providers')
                .select('provider_id')
                .eq('user_id', userId)

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
        const { userId, providerIds } = await request.json()

        if (!userId || !Array.isArray(providerIds)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        const client = supabaseAdmin || supabase

        // 1. Delete existing selections
        const { error: deleteError } = await client
            .from('user_providers')
            .delete()
            .eq('user_id', userId)

        if (deleteError) throw deleteError

        // 2. Insert new selections
        if (providerIds.length > 0) {
            const rows = providerIds.map((pid: number) => ({
                user_id: userId,
                provider_id: pid
            }))

            const { error: insertError } = await client
                .from('user_providers')
                .insert(rows)

            if (insertError) throw insertError
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Providers Save Error:', error)
        return NextResponse.json({ error: 'Failed to save providers' }, { status: 500 })
    }
}
