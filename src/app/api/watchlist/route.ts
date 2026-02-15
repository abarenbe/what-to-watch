import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fetchTMDB, endpoints, getTMDBImageUrl, MOVIE_GENRES, TV_GENRES } from '@/lib/tmdb'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const groupId = searchParams.get('groupId')

    if (!userId || !groupId) {
        return NextResponse.json({ error: 'userId and groupId are required' }, { status: 400 })
    }

    const client = supabaseAdmin || supabase

    // Debug logging
    console.log(`Fetching watchlist for user: ${userId}, group: ${groupId}`)


    try {
        // 1. Fetch user's personal swipes (Score > 0 means they want to watch)
        const { data: mySwipes, error: swipeError } = await client
            .from('swipes')
            .select('movie_id, media_type, score, status')
            .eq('user_id', userId)
            .gt('score', 0)
            .order('created_at', { ascending: false })

        if (swipeError) throw swipeError

        if (!mySwipes || mySwipes.length === 0) {
            return NextResponse.json([])
        }

        const movieIds = mySwipes.map(s => s.movie_id)

        // 2. Fetch ALL swipes for these movies in the group (including other members)
        const { data: groupSwipes, error: groupError } = await client
            .from('swipes')
            .select('movie_id, user_id, score')
            .eq('group_id', groupId)
            .in('movie_id', movieIds)
            .neq('user_id', userId)

        if (groupError) throw groupError

        // 3. Fetch profiles for display names
        const memberIds = [...new Set((groupSwipes || []).map(s => s.user_id))]
        let profileMap: Record<string, string> = {}
        if (memberIds.length > 0) {
            const { data: profiles } = await client
                .from('profiles')
                .select('id, display_name')
                .in('id', memberIds)
            if (profiles) {
                profileMap = Object.fromEntries(
                    profiles.map(p => [p.id, p.display_name || 'Family Member'])
                )
            }
        }

        // 4. Combine and Hydrate with TMDB — return rich data for filtering
        const genreMap = (type: 'movie' | 'tv') => type === 'movie' ? MOVIE_GENRES : TV_GENRES

        const watchlist = await Promise.all(
            mySwipes.map(async (swipe) => {
                const type = (swipe.media_type || 'movie') as 'movie' | 'tv'
                try {
                    const details = await fetchTMDB(endpoints.details(swipe.movie_id, type))

                    // Build family scores array
                    const memberSwipes = (groupSwipes || []).filter(gs => gs.movie_id === swipe.movie_id)
                    const familyScores = memberSwipes.map(ms => ({
                        userId: ms.user_id,
                        displayName: profileMap[ms.user_id] || 'Family Member',
                        score: ms.score,
                    }))

                    // Resolve genre names
                    const gMap = genreMap(type)
                    const genres: string[] = (details.genre_ids || details.genres?.map((g: { id: number }) => g.id) || [])
                        .map((id: number) => gMap[id])
                        .filter(Boolean)

                    return {
                        id: swipe.movie_id,
                        title: details.title || details.name || 'Unknown',
                        image: getTMDBImageUrl(details.poster_path),
                        year: details.release_date || details.first_air_date
                            ? new Date(details.release_date || details.first_air_date).getFullYear()
                            : 0,
                        mediaType: type,
                        myScore: swipe.score,
                        status: swipe.status,
                        othersCount: memberSwipes.filter(ms => ms.score > 0).length,
                        // Enriched data for filtering
                        genres,
                        tmdbRating: details.vote_average || 0,
                        runtime: details.runtime || details.episode_run_time?.[0] || 0,
                        familyScores,
                    }
                } catch (error) {
                    console.error(`Error hydrating ${type}/${swipe.movie_id}:`, error)
                    return null
                }
            })
        )

        return NextResponse.json(watchlist.filter(Boolean))
    } catch (error) {
        console.error('Watchlist API Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
