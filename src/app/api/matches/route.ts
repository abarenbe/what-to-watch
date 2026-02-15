import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fetchTMDB, endpoints, getTMDBImageUrl } from '@/lib/tmdb'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
        return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    const client = supabaseAdmin || supabase

    try {
        // 1. Fetch matches from our Supabase view
        const { data: matches, error } = await client
            .from('group_matches')
            .select('*')
            .eq('group_id', groupId)
            .order('total_match_score', { ascending: false })

        if (error) throw error

        // 2. Hydrate matches with TMDB data — using the correct media_type
        const hydratedMatches = await Promise.all(
            (matches || []).map(async (match) => {
                const type = (match.media_type || 'movie') as 'movie' | 'tv'
                try {
                    const details = await fetchTMDB(endpoints.details(match.movie_id, type))
                    return {
                        id: match.movie_id,
                        title: details.title || details.name || 'Unknown',
                        image: getTMDBImageUrl(details.poster_path),
                        score: match.total_match_score,
                        swipeCount: match.swipe_count,
                        mediaType: type,
                        year: details.release_date || details.first_air_date
                            ? new Date(details.release_date || details.first_air_date).getFullYear()
                            : 0
                    }
                } catch (error) {
                    console.error(`Error hydrating ${type}/${match.movie_id}:`, error)
                    return null
                }
            })
        )

        return NextResponse.json(hydratedMatches.filter(Boolean))
    } catch (error) {
        console.error('Matches API Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
