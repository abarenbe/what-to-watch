const OMDB_API_BASE = 'https://www.omdbapi.com/'
const OMDB_API_KEY = process.env.OMDB_API_KEY || ''

export async function fetchOMDB(imdbId: string) {
    const url = new URL(OMDB_API_BASE)
    url.searchParams.append('apikey', OMDB_API_KEY)
    url.searchParams.append('i', imdbId)

    const response = await fetch(url.toString())

    if (!response.ok) {
        throw new Error(`OMDb API error: ${response.statusText}`)
    }

    return response.json()
}

export function getRottenTomatoesScore(ratings: { Source: string; Value: string }[]) {
    const rtRating = ratings.find(r => r.Source === 'Rotten Tomatoes')
    return rtRating ? rtRating.Value : null
}
