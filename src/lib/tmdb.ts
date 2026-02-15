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
  genres?: string
  ageRating?: string // comma separated labels
  minRating?: string
  runtimes?: string  // comma separated labels like '<90','90-120'
  newReleases?: string
  sortBy?: string
  watchProviders?: string
  query?: string       // New: Search query
  isFree?: string      // New: "true" or "false"
  isClassic?: string   // New: "true" or "false"
}

export async function getDiscoveryFeed(filters: DiscoveryFilters = {}) {
  const {
    page = 1,
    type = 'all',
    query
  } = filters

  // 1. Search Mode Override
  if (query && query.trim().length > 0) {
    const params: Record<string, string> = {
      query: query,
      page: page.toString(),
      include_adult: 'false'
    }
    return fetchTMDB(endpoints.search, params) // uses /search/multi
  }

  // 2. Normal Discovery Mode
  const hasFilters = filters.genres || filters.ageRating || filters.minRating || filters.runtimes || filters.newReleases === 'true' || !!filters.watchProviders || filters.isFree === 'true' || filters.isClassic === 'true'

  if (!hasFilters && type === 'all') {
    return fetchTMDB(endpoints.trending('all'), { page: page.toString() })
  }

  // When type is "all" with filters, fetch both movie & tv and merge
  if (type === 'all' && hasFilters) {
    const [movieData, tvData] = await Promise.all([
      fetchFilteredDiscover('movie', filters),
      fetchFilteredDiscover('tv', filters),
    ])
    const merged = interleave(
      (movieData.results || []).map((r: Record<string, unknown>) => ({ ...r, media_type: 'movie' })),
      (tvData.results || []).map((r: Record<string, unknown>) => ({ ...r, media_type: 'tv' }))
    )
    return { results: merged, page, total_pages: Math.min(movieData.total_pages, tvData.total_pages) }
  }

  // When merging results from multi-select filters, we rely on TMDB's ability to handle OR logic for some fields (like with_genres).
  // For age rating certification, TMDB allows `certification.lte` or `certification` with OR logic using pipes `|`.
  // For runtimes, if multiple ranges selected, we might need multiple queries or broad range?
  // TMDB `with_runtime.gte` / `lte` is a single range.
  // If user selects "<90" AND "90-120", effectively it is "<120".
  // If they select "<90" AND ">120" (skipping middle), TMDB can't do that easily in one query.
  // Strategy: Calculate the min of all minRuntimes and max of all maxRuntimes.

  // Single type with filters
  const mediaType = type as 'movie' | 'tv'
  const data = await fetchFilteredDiscover(mediaType, filters)
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

  // Watch Providers (Streaming Services)
  if (filters.watchProviders) {
    params.with_watch_providers = filters.watchProviders
    params.watch_region = 'US'
  }

  // "Just Watch" Filter
  // This means "Watchable on my services (flatrate) OR Free services (ads/free)" without renting/buying.
  if (filters.isFree === 'true') {
    params.with_watch_monetization_types = 'flatrate|free|ads'
    params.watch_region = 'US'
  }

  // CLASSIC Filter (Older & Highly Rated)
  if (filters.isClassic === 'true') {
    // Arbitrary definition: Before 2005 and Rating > 7.0
    // If user set a stricter rating, respect it, otherwise default to 7.0
    if (!params['vote_average.gte']) {
      params['vote_average.gte'] = '7.0'
    }

    const cutoffDate = '2005-01-01'
    if (mediaType === 'movie') {
      params['primary_release_date.lte'] = cutoffDate
    } else {
      params['first_air_date.lte'] = cutoffDate
    }

    // Usually classics are sorted by rating or popularity. Keep user sort or default.
  }

  // Genre
  if (filters.genres) {
    const genreLabels = filters.genres.split(',').map(g => g.trim())
    const ids = resolveGenreIds(genreLabels, mediaType)
    if (ids) params.with_genres = ids
  }

  // Age rating (Multi-select)
  if (filters.ageRating) {
    const selectedLabels = filters.ageRating.split(',')
    const combinedCerts: string[] = []

    selectedLabels.forEach(label => {
      const match = AGE_RATINGS.find(r => r.label === label)
      if (match) {
        const certs = mediaType === 'movie' ? match.movie : match.tv
        if (certs) combinedCerts.push(certs)
      }
    })

    if (combinedCerts.length > 0) {
      // TMDB allows `certification` parameter to be pipe-separated OR list? 
      // Actually certification usually takes one value or uses certification.lte.
      // But we can try passing pipe separated values to `certification` or `certification.lte`?
      // According to docs, `certification` matches exact. 
      // `certification.lte` matches less than.
      // If we want multiple specific ratings (PG OR G), we need pipe separated string?
      // TMDB docs say: `certification` query param supports multiple values separated by pipe `|`.

      const uniqueCerts = [...new Set(combinedCerts.join('|').split('|'))].join('|')
      params.certification_country = 'US'
      params.certification = uniqueCerts
    }
  }

  // Rating
  if (filters.minRating) {
    params['vote_average.gte'] = filters.minRating
  }

  // Runtime (Multi-select) - Combine ranges
  if (mediaType === 'movie' && filters.runtimes) {
    const selectedLabels = filters.runtimes.split(',')
    // Parse our specific known options
    // '< 90 min' -> max 90
    // '90–120 min' -> min 90, max 120
    // '2+ hours' -> min 120

    // If multiple selected, we union them.
    // e.g. <90 AND >120 -> We can't do disjoint ranges in TMDB easily.
    // We will take the overall range that covers all selections.
    // <90 (0-90) + >120 (120-999) -> 0-999 (No filter effectively)
    // <90 + 90-120 -> 0-120.

    // Check which ones are present
    const hasShort = selectedLabels.includes('< 90 min')
    const hasMedium = selectedLabels.includes('90–120 min')
    const hasLong = selectedLabels.includes('2+ hours')

    if (hasShort && hasMedium && hasLong) {
      // All selected = no filter
    } else if (hasShort && hasMedium) {
      // 0 - 120
      params['with_runtime.lte'] = '120'
    } else if (hasMedium && hasLong) {
      // 90 - 999
      params['with_runtime.gte'] = '90'
    } else if (hasShort && hasLong) {
      // 0-90 OR 120+. Hard. Let's just ignore runtime filter or map to full range.
      // Effectively no filter.
    } else if (hasShort) {
      params['with_runtime.lte'] = '90'
    } else if (hasMedium) {
      params['with_runtime.gte'] = '90'
      params['with_runtime.lte'] = '120'
    } else if (hasLong) {
      params['with_runtime.gte'] = '120'
    }
  }

  // New releases (mutually exclusive with Classic effectively, but let's handle precedence)
  if (filters.newReleases === 'true' && filters.isClassic !== 'true') {
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
