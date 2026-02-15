const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || ''

export async function fetchTMDB(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_API_BASE}${endpoint}`)
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]))

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
      'Content-Type': 'application/json;charset=utf-8'
    }
  })

  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.statusText}`)
  }

  return response.json()
}

export const endpoints = {
  discover: (type: 'movie' | 'tv') => `/discover/${type}`,
  trending: (type: 'all' | 'movie' | 'tv') => `/trending/${type}/day`,
  search: '/search/multi',
  details: (id: string, type: 'movie' | 'tv') => `/${type}/${id}`,
  watchProviders: (id: string, type: 'movie' | 'tv') => `/${type}/${id}/watch/providers`
}

export function getTMDBImageUrl(path: string, size: 'w500' | 'original' = 'w500') {
  if (!path) return '/placeholder-poster.png'
  return `https://image.tmdb.org/t/p/${size}${path}`
}

// ---------- Genre mappings ----------
export const MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller',
  10752: 'War', 37: 'Western'
}

export const TV_GENRES: Record<number, string> = {
  10759: 'Action', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids',
  9648: 'Mystery', 10764: 'Reality', 10765: 'Sci-Fi', 10766: 'Soap',
  10767: 'Talk', 10768: 'War', 37: 'Western'
}

// Combined unique genre labels for the UI
export const ALL_GENRE_LABELS = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Kids', 'Music',
  'Mystery', 'Reality', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
]

// Reverse lookup: genre label → TMDb IDs
function genreLabelToIds(label: string): { movie: number[], tv: number[] } {
  const movieIds = Object.entries(MOVIE_GENRES)
    .filter(([, v]) => v === label)
    .map(([k]) => parseInt(k))
  const tvIds = Object.entries(TV_GENRES)
    .filter(([, v]) => v === label)
    .map(([k]) => parseInt(k))
  return { movie: movieIds, tv: tvIds }
}

export function resolveGenreIds(labels: string[], type: 'movie' | 'tv'): string {
  const ids: number[] = []
  for (const label of labels) {
    const resolved = genreLabelToIds(label)
    ids.push(...(type === 'movie' ? resolved.movie : resolved.tv))
  }
  return ids.join(',')
}

// ---------- Certification / Age Rating ----------
export const AGE_RATINGS = [
  { label: 'All Ages', movie: '', tv: '' },
  { label: 'Family (G/PG)', movie: 'G|PG', tv: 'TV-Y|TV-Y7|TV-G|TV-PG' },
  { label: 'Teen (PG-13)', movie: 'G|PG|PG-13', tv: 'TV-Y|TV-Y7|TV-G|TV-PG|TV-14' },
  { label: 'Mature (R)', movie: 'G|PG|PG-13|R', tv: 'TV-Y|TV-Y7|TV-G|TV-PG|TV-14|TV-MA' },
]

// ---------- Discovery with filters ----------

export interface DiscoveryFilters {
  page?: number
  type?: 'all' | 'movie' | 'tv'
  genres?: string       // comma-separated genre labels
  ageRating?: string    // one of the AGE_RATINGS labels
  minRating?: string    // e.g. "7"
  maxRuntime?: string   // e.g. "120"
  minRuntime?: string   // e.g. "90"
  newReleases?: string  // "true" or "false"
  sortBy?: string       // e.g. "popularity.desc"
}

export async function getDiscoveryFeed(filters: DiscoveryFilters = {}) {
  const {
    page = 1,
    type = 'all',
    genres,
    ageRating,
    minRating,
    maxRuntime,
    minRuntime,
    newReleases,
    sortBy = 'popularity.desc',
  } = filters

  // If no filters active and type is "all", use trending for a nice mixed feed
  const hasFilters = genres || ageRating || minRating || maxRuntime || minRuntime || newReleases === 'true'
  if (!hasFilters && type === 'all') {
    return fetchTMDB(endpoints.trending('all'), { page: page.toString() })
  }

  // When type is "all" with filters, fetch both movie & tv and merge
  if (type === 'all' && hasFilters) {
    const [movieData, tvData] = await Promise.all([
      fetchFilteredDiscover('movie', filters),
      fetchFilteredDiscover('tv', filters),
    ])
    // Interleave results and tag with media_type
    const merged = interleave(
      (movieData.results || []).map((r: Record<string, unknown>) => ({ ...r, media_type: 'movie' })),
      (tvData.results || []).map((r: Record<string, unknown>) => ({ ...r, media_type: 'tv' }))
    )
    return { results: merged, page, total_pages: Math.min(movieData.total_pages, tvData.total_pages) }
  }

  // Single type with filters → use discover endpoint
  const mediaType = type as 'movie' | 'tv'
  const data = await fetchFilteredDiscover(mediaType, filters)
  // Tag each result with media_type so the frontend can identify them
  data.results = (data.results || []).map((r: Record<string, unknown>) => ({ ...r, media_type: mediaType }))
  return data
}

async function fetchFilteredDiscover(mediaType: 'movie' | 'tv', filters: DiscoveryFilters) {
  const params: Record<string, string> = {
    page: (filters.page || 1).toString(),
    sort_by: filters.sortBy || 'popularity.desc',
    include_adult: 'false',
    'vote_count.gte': '50',
  }

  // Genre
  if (filters.genres) {
    const genreLabels = filters.genres.split(',').map(g => g.trim())
    const ids = resolveGenreIds(genreLabels, mediaType)
    if (ids) params.with_genres = ids
  }

  // Age rating / certification
  if (filters.ageRating && filters.ageRating !== 'All Ages') {
    const match = AGE_RATINGS.find(r => r.label === filters.ageRating)
    if (match) {
      const certs = mediaType === 'movie' ? match.movie : match.tv
      if (certs) {
        params.certification_country = 'US'
        params.certification = certs
      }
    }
  }

  // Rating
  if (filters.minRating) {
    params['vote_average.gte'] = filters.minRating
  }

  // Runtime
  if (mediaType === 'movie') {
    if (filters.maxRuntime) params['with_runtime.lte'] = filters.maxRuntime
    if (filters.minRuntime) params['with_runtime.gte'] = filters.minRuntime
  }

  // New releases (last 6 months)
  if (filters.newReleases === 'true') {
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const dateStr = sixMonthsAgo.toISOString().split('T')[0]
    if (mediaType === 'movie') {
      params['primary_release_date.gte'] = dateStr
    } else {
      params['first_air_date.gte'] = dateStr
    }
  }

  return fetchTMDB(endpoints.discover(mediaType), params)
}

function interleave<T>(a: T[], b: T[]): T[] {
  const result: T[] = []
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    if (i < a.length) result.push(a[i])
    if (i < b.length) result.push(b[i])
  }
  return result
}
