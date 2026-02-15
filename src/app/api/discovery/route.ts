import { NextResponse } from 'next/server'
import { getDiscoveryFeed, DiscoveryFilters } from '@/lib/tmdb'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const filters: DiscoveryFilters = {
        page: parseInt(searchParams.get('page') || '1'),
        type: (searchParams.get('type') || 'all') as 'all' | 'movie' | 'tv',
        genres: searchParams.get('genres') || undefined,
        ageRating: searchParams.get('ageRating') || undefined,
        minRating: searchParams.get('minRating') || undefined,
        maxRuntime: searchParams.get('maxRuntime') || undefined,
        minRuntime: searchParams.get('minRuntime') || undefined,
        newReleases: searchParams.get('newReleases') || undefined,
        sortBy: searchParams.get('sortBy') || undefined,
    }

    try {
        const data = await getDiscoveryFeed(filters)
        return NextResponse.json(data)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
