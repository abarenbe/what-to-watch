import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchTMDB, endpoints, getTMDBImageUrl } from '@/lib/tmdb'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const groupId = searchParams.get('groupId')

    if (!userId || !groupId) {
        return NextResponse.json({ error: 'userId and groupId are required' }, { status: 400 })
    }

    try {
        // 1. Fetch user's personal swipes (Score > 0 means they want to watch)
        const { data: mySwipes, error: swipeError } = await supabase
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

        // 2. Fetch other people's swipes for these same movies in the group
        const { data: groupSwipes, error: groupError } = await supabase
            .from('swipes')
            .select('movie_id, user_id, score')
            .eq('group_id', groupId)
            .in('movie_id', movieIds)
            .neq('user_id', userId)
            .gt('score', 0)

        if (groupError) throw groupError

        // 3. Combine and Hydrate with TMDB — use correct media_type for each
        const watchlist = await Promise.all(
            mySwipes.map(async (swipe) => {
                const type = (swipe.media_type || 'movie') as 'movie' | 'tv'
                try {
                    const details = await fetchTMDB(endpoints.details(swipe.movie_id, type))
                    const matchCount = groupSwipes?.filter(gs => gs.movie_id === swipe.movie_id).length || 0

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
                        othersCount: matchCount
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
