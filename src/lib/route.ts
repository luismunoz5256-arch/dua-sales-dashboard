import type { Client } from './types'

export interface Point {
  lat: number
  lng: number
}

const hasPoint = (c: Pick<Client, 'lat' | 'lng'>): c is Client & Point => c.lat != null && c.lng != null

/** Straight-line distance in miles. */
export function miles(a: Point, b: Point): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Nearest-next-stop ordering from a start point. Stops without coordinates keep their order at the end. */
export function orderStops<T extends Pick<Client, 'lat' | 'lng'>>(start: Point | null, stops: T[]): T[] {
  const located = stops.filter(hasPoint) as (T & Point)[]
  const rest = stops.filter((s) => !hasPoint(s))
  if (!start || !located.length) return [...located, ...rest]
  const out: T[] = []
  let here: Point = start
  const left = [...located]
  while (left.length) {
    let best = 0
    for (let i = 1; i < left.length; i++) if (miles(here, left[i]) < miles(here, left[best])) best = i
    here = left[best]
    out.push(left.splice(best, 1)[0])
  }
  return [...out, ...rest]
}

export interface AreaGroup<T> {
  area: string
  stops: T[]
}

/** Groups stops by area, orders the areas as a drive from home, and orders stops inside each area. */
export function planRoute<T extends { client: Client }>(home: Point | null, items: T[]): AreaGroup<T>[] {
  const byArea = new Map<string, T[]>()
  for (const it of items) {
    const a = it.client.area || 'No area'
    byArea.set(a, [...(byArea.get(a) ?? []), it])
  }
  const groups = [...byArea.entries()].map(([area, stops]) => {
    const pts = stops.map((s) => s.client).filter(hasPoint)
    const center = pts.length
      ? { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length }
      : null
    return { area, stops, lat: center?.lat ?? null, lng: center?.lng ?? null }
  })
  const orderedAreas = orderStops(home, groups)
  const out: AreaGroup<T>[] = []
  let here: Point | null = home
  for (const g of orderedAreas) {
    const ordered = orderStops(here, g.stops.map((s) => ({ ...s, lat: s.client.lat, lng: s.client.lng })))
    const stops = ordered.map(({ lat: _lat, lng: _lng, ...s }) => s as unknown as T)
    const last = [...stops].reverse().find((s) => hasPoint(s.client))
    if (last) here = { lat: last.client.lat!, lng: last.client.lng! }
    out.push({ area: g.area, stops })
  }
  return out
}

/** How Google Maps should find a stop: the business name + address is most reliable; coordinates as fallback. */
export function mapsStop(c: Pick<Client, 'business_name' | 'address' | 'lat' | 'lng'>): string | null {
  if (c.address) return `${c.business_name}, ${c.address}`
  if (c.lat != null && c.lng != null) return `${c.lat},${c.lng}`
  return null
}

/**
 * Google Maps directions link through the stops in order. With no origin, Maps starts from your current location.
 * Maps allows up to 9 stops in between, so longer days are cut to the first 10 stops.
 */
export function directionsUrl(stops: Pick<Client, 'business_name' | 'address' | 'lat' | 'lng'>[], origin?: string | null): string | null {
  const points = stops.map(mapsStop).filter((s): s is string => !!s).slice(0, 10)
  if (!points.length) return null
  const destination = points[points.length - 1]
  const waypoints = points.slice(0, -1)
  const p = new URLSearchParams({ api: '1', destination, travelmode: 'driving' })
  if (origin) p.set('origin', origin)
  if (waypoints.length) p.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}
