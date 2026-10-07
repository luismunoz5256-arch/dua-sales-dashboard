/**
 * Vercel serverless function: the only place the Google Places key is used.
 * - Requires a signed-in Supabase user (so nobody else can spend your quota).
 * - Caches every search in Supabase for 30 days: repeat searches are free.
 * - Stops at DAILY_SEARCH_LIMIT real Google calls per day (default 60).
 *
 * Env vars (Vercel > Settings > Environment Variables):
 *   GOOGLE_PLACES_API_KEY   required for real searches
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   already set for the app
 *   DAILY_SEARCH_LIMIT      optional, default 60
 */
import { createHash } from 'node:crypto'
import { bearer, checkOwner, env, readBody, supabaseAnonKey, supabaseUrl } from './_lib/server.js'

const QUERIES: Record<string, string> = {
  restaurants: 'independent restaurants',
  taquerias: 'taquerias',
  mexican: 'mexican restaurants and mariscos',
  brunch: 'breakfast and brunch restaurants',
  bars: 'bars and pubs',
  cafes: 'cafes and coffee shops',
  juice: 'juice bars and smoothie shops',
  food_trucks: 'food trucks',
  bakeries: 'bakeries',
  catering: 'catering companies',
  hotels: 'hotels with restaurant',
  markets: 'small grocery stores and markets',
  gyms: 'gyms and wellness studios',
  cafeterias: 'school and hospital cafeterias',
  ghost_kitchens: 'ghost kitchens delivery only restaurants',
}

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.primaryType',
  'places.primaryTypeDisplayName', 'places.types', 'places.rating', 'places.userRatingCount', 'places.priceLevel',
  'places.nationalPhoneNumber', 'places.websiteUri', 'places.googleMapsUri', 'places.currentOpeningHours.openNow',
  'places.businessStatus', 'places.servesBrunch', 'places.servesBreakfast', 'places.servesVegetarianFood',
  'places.servesCocktails', 'places.editorialSummary', 'nextPageToken',
].join(',')

const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
}
const CACHE_DAYS = 30

type Json = Record<string, unknown>

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = env('GOOGLE_PLACES_API_KEY')
  const sbUrl = supabaseUrl()
  const sbKey = supabaseAnonKey()
  const limit = Number(env('DAILY_SEARCH_LIMIT') ?? 60) || 60
  const body: Json = readBody(req)

  if (!sbUrl || !sbKey) return res.status(501).json({ error: 'not_configured', detail: 'Supabase is not connected.' })
  if (!key) return res.status(501).json({ error: 'not_configured', detail: 'GOOGLE_PLACES_API_KEY is not set.' })

  // The app owner only (so nobody else can spend your Google quota).
  const token = bearer(req)
  const access = await checkOwner(token)
  if (!access.ok) return res.status(401).json({ error: 'sign_in_required' })

  const db = async (path: string, init: RequestInit = {}) =>
    fetch(`${sbUrl}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: sbKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
  const usageKey = `usage:${today}`
  const readUsage = async () => {
    const r = await db(`places_cache?key=eq.${encodeURIComponent(usageKey)}&select=results`)
    const rows = r.ok ? ((await r.json()) as { results: { count: number } }[]) : []
    return rows[0]?.results?.count ?? 0
  }

  if (body.ping) return res.status(200).json({ configured: true, usedToday: await readUsage(), limit, ownerCheck: access.ownerCheck })

  // Validate input: only known types, El Paso coordinates, sane radius.
  const type = String(body.type ?? '')
  if (!QUERIES[type]) return res.status(400).json({ error: 'bad_type' })
  const area = typeof body.area === 'string' ? body.area.slice(0, 40).replace(/[^\w\s/'.-]/g, '') : ''
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && lat > 31.2 && lat < 32.3 && lng > -107 && lng < -105.7
  const radiusM = Math.min(20000, Math.max(300, Number(body.radiusMeters) || 5000))
  const pageToken = typeof body.pageToken === 'string' ? body.pageToken.slice(0, 2000) : undefined

  const textQuery = `${QUERIES[type]} ${area ? `in ${area}, ` : 'in '}El Paso, TX`
  const cacheKey = 'q:' + createHash('sha256').update(JSON.stringify({ textQuery, lat: hasPoint ? lat.toFixed(3) : null, lng: hasPoint ? lng.toFixed(3) : null, radiusM, pageToken })).digest('hex').slice(0, 40)

  if (!body.refresh) {
    const r = await db(`places_cache?key=eq.${cacheKey}&select=results,fetched_at`)
    const rows = r.ok ? ((await r.json()) as { results: Json; fetched_at: string }[]) : []
    if (rows[0] && Date.now() - new Date(rows[0].fetched_at).getTime() < CACHE_DAYS * 86400000) {
      return res.status(200).json({ ...rows[0].results, cached: true, fetchedAt: rows[0].fetched_at, usedToday: await readUsage(), limit })
    }
  }

  const used = await readUsage()
  if (used >= limit) return res.status(429).json({ error: 'daily_limit', usedToday: used, limit })

  const g = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      textQuery,
      pageSize: 20,
      regionCode: 'US',
      languageCode: 'en',
      ...(pageToken ? { pageToken } : {}),
      ...(hasPoint ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } } } : {}),
    }),
  })
  // Count the call whether or not Google accepted it.
  await db('places_cache', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: usageKey, results: { count: used + 1 }, fetched_at: new Date().toISOString() }),
  })
  if (!g.ok) {
    const detail = await g.text()
    return res.status(502).json({ error: 'google_error', status: g.status, detail: detail.slice(0, 500) })
  }
  const data = (await g.json()) as { places?: Json[]; nextPageToken?: string }
  const places = (data.places ?? [])
    .filter((p: any) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((p: any) => ({
      id: p.id,
      name: p.displayName?.text ?? 'Unknown',
      address: p.formattedAddress ?? null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      primaryType: p.primaryType ?? null,
      typeLabel: p.primaryTypeDisplayName?.text ?? null,
      types: p.types ?? [],
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? null,
      priceLevel: p.priceLevel in PRICE ? PRICE[p.priceLevel] : null,
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      mapsUrl: p.googleMapsUri ?? null,
      openNow: p.currentOpeningHours?.openNow ?? null,
      status: p.businessStatus ?? null,
      servesBrunch: p.servesBrunch ?? null,
      servesBreakfast: p.servesBreakfast ?? null,
      servesVegetarian: p.servesVegetarianFood ?? null,
      servesCocktails: p.servesCocktails ?? null,
      summary: p.editorialSummary?.text ?? null,
    }))
  const result = { places, nextPageToken: data.nextPageToken ?? null }
  const fetchedAt = new Date().toISOString()
  await db('places_cache', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: cacheKey, results: result, fetched_at: fetchedAt }),
  })
  return res.status(200).json({ ...result, cached: false, fetchedAt, usedToday: used + 1, limit })
}
