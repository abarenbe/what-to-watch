import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Returns all movie IDs that a user has already swiped on,
// so the discovery feed can filter them out.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const groupId = searchParams.get('groupId')

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    try {
        let query = supabase
            .from('swipes')
            .select('movie_id, media_type')
            .eq('user_id', userId)

        if (groupId) {
            query = query.eq('group_id', groupId)
        }

        const { data, error } = await query

        if (error) throw error

        // Return a set-friendly list of "movieId_mediaType" keys
        const swipedKeys = (data || []).map(
            (row: { movie_id: string; media_type: string }) =>
                `${row.movie_id}_${row.media_type}`
        )

        return NextResponse.json({ swipedKeys })
    } catch (error) {
        console.error('Swiped IDs API Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
