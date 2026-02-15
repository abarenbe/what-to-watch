import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { userId, groupId, movieId, mediaType = 'movie', score, status = 'swiped' } = await request.json()

        if (!userId || !groupId || !movieId || score === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const client = supabaseAdmin || supabase

        // Upsert the swipe: if user already swiped this item, update it
        const { data, error } = await client
            .from('swipes')
            .upsert({
                user_id: userId,
                group_id: groupId,
                movie_id: movieId,
                media_type: mediaType,
                score: score,
                status: status,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,movie_id,media_type'
            })

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error) {
        console.error('Swipe API Error:', error)
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
            .from('swipes')
            .delete()
            .eq('user_id', userId)
            .eq('movie_id', movieId)
            .eq('media_type', mediaType)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Swipe DELETE Error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
