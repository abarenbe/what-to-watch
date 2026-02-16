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

        // 3. Fetch all group members and their profiles
        const { data: groupMembers } = await client
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId)

        const allMemberIds = [...new Set([userId, ...(groupMembers || []).map(m => m.user_id)])]

        const { data: profiles } = await client
            .from('profiles')
            .select('id, display_name')
            .in('id', allMemberIds)

        const profileMap = Object.fromEntries(
            (profiles || []).map(p => [p.id, p.display_name || (p.id === userId ? 'Me' : 'Family Member')])
        )

        const members = (profiles || []).map(p => ({
            id: p.id,
            name: p.id === userId ? `${p.display_name} (Me)` : (p.display_name || 'Family Member')
        }))



        // 4. Fetch User's Providers (for "Just Watch" calculation)
        const { data: userProviders } = await client
            .from('user_providers')
            .select('provider_id')
            .eq('user_id', userId)

        const myProviderIds = new Set((userProviders || []).map(p => p.provider_id))

        // 5. Combine and Hydrate with TMDB — return rich data for filtering
        const genreMap = (type: 'movie' | 'tv') => type === 'movie' ? MOVIE_GENRES : TV_GENRES

        interface WatchlistItem {
            id: string
            title: string
            image: string
            year: number
            mediaType: 'movie' | 'tv'
            myScore: number
            status: string
            othersCount: number
            genres: string[]
            tmdbRating: number
            runtime: number
            familyScores: { userId: string, displayName: string, score: number }[]
            isWatchable: boolean
            ageRating: string
        }

        // Chunking tmdb requests to avoid overwhelming or timeouts if list is huge
        const CHUNK_SIZE = 10
        const hydratedWatchlist: WatchlistItem[] = []

        for (let i = 0; i < mySwipes.length; i += CHUNK_SIZE) {
            const chunk = mySwipes.slice(i, i + CHUNK_SIZE)
            const results = await Promise.all(
                chunk.map(async (swipe) => {
                    const type = (swipe.media_type || 'movie') as 'movie' | 'tv'
                    try {
                        // Fetch details WITH extra info for filtering
                        const details = await fetchTMDB(
                            endpoints.details(swipe.movie_id, type),
                            { append_to_response: 'watch/providers,release_dates,content_ratings' }
                        )

                        // --- CALC: Just Watch (isWatchable) ---
                        let isWatchable = false
                        if (details['watch/providers'] && details['watch/providers'].results && details['watch/providers'].results.US) {
                            const usProviders = details['watch/providers'].results.US
                            // Check flatrate, free, or ads
                            const available = [
                                ...(usProviders.flatrate || []),
                                ...(usProviders.free || []),
                                ...(usProviders.ads || [])
                            ]
                            // If any available provider matches my providers
                            isWatchable = available.some((p: { provider_id: number }) => myProviderIds.has(p.provider_id))
                        }

                        // --- CALC: Age Rating ---
                        let ageRating = 'NR'
                        if (type === 'movie') {
                            const usRelease = details.release_dates?.results?.find((r: { iso_3166_1: string }) => r.iso_3166_1 === 'US')
                            if (usRelease && usRelease.release_dates) {
                                // Find the first non-empty certification
                                const cert = usRelease.release_dates.find((d: { certification: string }) => d.certification !== '')
                                if (cert) ageRating = cert.certification
                            }
                        } else {
                            const usRating = details.content_ratings?.results?.find((r: { iso_3166_1: string }) => r.iso_3166_1 === 'US')
                            if (usRating) ageRating = usRating.rating
                        }

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
                            isWatchable,
                            ageRating,
                        }
                    } catch (error) {
                        console.error(`Error hydrating ${type}/${swipe.movie_id}:`, error)
                        return null
                    }
                })
            )
            hydratedWatchlist.push(...(results.filter(Boolean) as WatchlistItem[]))
        }

        return NextResponse.json({ items: hydratedWatchlist, members })
    } catch (error) {
        console.error('Watchlist API Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
