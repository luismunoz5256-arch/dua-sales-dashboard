import { supabase } from './backend'
import type { Place } from './prospects'
import { SAMPLE_PLACES } from './samplePlaces'

export interface SearchParams {
  type: string
  area?: string
  lat?: number
  lng?: number
  radiusMeters?: number
  pageToken?: string | null
  refresh?: boolean
}

export interface SearchResult {
  places: Place[]
  nextPageToken: string | null
  cached: boolean
  fetchedAt: string
  sample: boolean
  usedToday?: number
  limit?: number
}

export class SearchError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

const LOCAL_KEY = 'dua.find.cache.v1'
const keyOf = (p: SearchParams) => JSON.stringify([p.type, p.area ?? '', p.lat?.toFixed(3), p.lng?.toFixed(3), p.radiusMeters, p.pageToken ?? ''])

function readLocal(): Record<string, SearchResult> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function writeLocal(k: string, r: SearchResult) {
  try {
    const all = readLocal()
    all[k] = r
    // keep the 30 most recent searches on this phone
    const keep = Object.entries(all).sort((a, b) => b[1].fetchedAt.localeCompare(a[1].fetchedAt)).slice(0, 30)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch {
    /* storage full: skip */
  }
}

/** Last results for this exact search on this phone (instant, no network). */
export function cachedSearch(p: SearchParams): SearchResult | null {
  return readLocal()[keyOf(p)] ?? null
}

async function call(body: object) {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null
  return fetch('/api/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  })
}

/**
 * Real search through our server function. In demo mode, or before the Google key is set up,
 * returns built-in sample El Paso businesses so the screen can be tried out.
 */
export async function searchPlaces(p: SearchParams): Promise<SearchResult> {
  const k = keyOf(p)
  if (!p.refresh) {
    const local = readLocal()[k]
    if (local && !local.sample) return { ...local, cached: true }
  }
  if (!supabase) return sample(p)
  let res: Response
  try {
    res = await call(p)
  } catch {
    throw new SearchError('offline', "Couldn't reach the server. Check your connection.")
  }
  if (res.status === 404 || res.status === 501) return sample(p)
  const json = await res.json().catch(() => ({}))
  if (res.status === 429) throw new SearchError('daily_limit', `Daily search limit reached (${json.limit}). Cached searches still work; new ones resume tomorrow.`)
  if (res.status === 401) throw new SearchError('sign_in', 'Please sign in again.')
  if (!res.ok) throw new SearchError('google', `Search failed (${json.error ?? res.status}). ${json.detail ? String(json.detail).slice(0, 160) : ''}`)
  const result: SearchResult = { ...json, sample: false }
  writeLocal(k, result)
  return result
}

/** Is the Google key set up? (free: no Google call) */
export async function placesStatus(): Promise<{ configured: boolean; usedToday?: number; limit?: number; reason?: string }> {
  if (!supabase) return { configured: false, reason: 'Demo mode' }
  try {
    const res = await call({ ping: true })
    if (res.ok) return await res.json()
    const json = await res.json().catch(() => ({}))
    return { configured: false, reason: json.detail ?? `Server answered ${res.status}` }
  } catch {
    return { configured: false, reason: 'Server not reachable' }
  }
}

function sample(p: SearchParams): SearchResult {
  const places = SAMPLE_PLACES.filter((s) => s.searchTypes.includes(p.type)).map(({ searchTypes: _t, ...place }) => place)
  return { places, nextPageToken: null, cached: false, fetchedAt: new Date().toISOString(), sample: true }
}
