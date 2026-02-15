import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fetchTMDB, endpoints, getTMDBImageUrl } from '@/lib/tmdb'

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
        return NextResponse.json({ error: 'Missing groupId' }, { status: 400 })
    }

    const client = supabaseAdmin || supabase

    try {
        const cutoff = new Date(Date.now() - TWELVE_HOURS_MS).toISOString()

        // Get all tonight picks for the group that are less than 12 hours old
        const { data: picks, error } = await client
            .from('tonight_picks')
            .select('*')
            .eq('group_id', groupId)
            .gte('created_at', cutoff)

        if (error) throw error

        if (!picks || picks.length === 0) {
            return NextResponse.json({ picks: [], overlaps: [] })
        }

        // Group picks by movie to find overlaps
        const movieMap: Record<string, { movieId: string; mediaType: string; userIds: string[] }> = {}
        for (const pick of picks) {
            const key = `${pick.movie_id}_${pick.media_type}`
            if (!movieMap[key]) {
                movieMap[key] = { movieId: pick.movie_id, mediaType: pick.media_type, userIds: [] }
            }
            movieMap[key].userIds.push(pick.user_id)
        }

        // Hydrate with TMDb details
        const hydratedPicks = await Promise.all(
            Object.values(movieMap).map(async (entry) => {
                const type = entry.mediaType as 'movie' | 'tv'
                try {
                    const details = await fetchTMDB(endpoints.details(entry.movieId, type))
                    return {
                        id: entry.movieId,
                        title: details.title || details.name || 'Unknown',
                        image: getTMDBImageUrl(details.poster_path),
                        year: details.release_date || details.first_air_date
                            ? new Date(details.release_date || details.first_air_date).getFullYear()
                            : 0,
                        mediaType: type,
                        overview: details.overview || '',
                        rating: details.vote_average || 0,
                        pickedBy: entry.userIds,
                        isOverlap: entry.userIds.length > 1,
                    }
                } catch {
                    return null
                }
            })
        )

        const validPicks = hydratedPicks.filter(Boolean)

        // Separate overlaps (multiple people picked) from individual picks
        const overlaps = validPicks.filter(p => p!.isOverlap)
        const allPicks = validPicks

        return NextResponse.json({ picks: allPicks, overlaps })
    } catch (error) {
        console.error('Tonight API Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const { userId, groupId, movieId, mediaType = 'movie' } = await request.json()

        if (!userId || !groupId || !movieId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const client = supabaseAdmin || supabase

        // Clean up old picks (> 12 hours) for this user
        const cutoff = new Date(Date.now() - TWELVE_HOURS_MS).toISOString()
        await client
            .from('tonight_picks')
            .delete()
            .eq('user_id', userId)
            .lt('created_at', cutoff)

        // Add/update tonight pick
        const { error } = await client
            .from('tonight_picks')
            .upsert({
                user_id: userId,
                group_id: groupId,
                movie_id: movieId,
                media_type: mediaType,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,movie_id,media_type'
            })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Tonight POST Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const movieId = searchParams.get('movieId')
        const mediaType = searchParams.get('mediaType') || 'movie'

        if (!userId || !movieId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const client = supabaseAdmin || supabase

        const { error } = await client
            .from('tonight_picks')
            .delete()
            .eq('user_id', userId)
            .eq('movie_id', movieId)
            .eq('media_type', mediaType)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Tonight DELETE Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
