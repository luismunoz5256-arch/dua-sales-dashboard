import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'

/** Rough El Paso area box (west, north, east, south) so lookups stay local. */
const VIEWBOX = '-106.75,32.05,-106.0,31.5'
const FAILED_KEY = 'dua.geocodeFailed'

function withCity(address: string) {
  return /\b(tx|texas|el paso|socorro|horizon|canutillo|anthony|clint|san elizario)\b/i.test(address)
    ? address
    : `${address}, El Paso, TX`
}

/**
 * Free address → coordinates lookup via OpenStreetMap Nominatim (no key, no cost).
 * Their usage policy allows light use like this: one request at a time, at most one per second.
 */
/** Returns coordinates, null when the address isn't found, or undefined when the lookup itself failed (retry later). */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null | undefined> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(withCity(address))}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return undefined
    const [hit] = (await res.json()) as { lat: string; lon: string }[]
    return hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) } : null
  } catch {
    return undefined
  }
}

function failedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAILED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Background job: looks up coordinates for the home base and any client with an address but no coordinates. */
export function useBackgroundGeocoding() {
  const { ready, data, settings, upsert, saveSettings } = useStore()
  const running = useRef(false)
  // Bumped after each run so anything added meanwhile gets picked up.
  const [tick, setTick] = useState(0)
  const latest = useRef({ data, settings })
  latest.current = { data, settings }

  useEffect(() => {
    if (!ready || running.current || !navigator.onLine) return
    const failed = failedSet()
    const home = settings.home_base
    const homeTodo = home.address && home.geocoded_for !== home.address && !failed.has(`home:${home.address}`)
    const todo = data.clients.filter((c) => c.address && (c.lat == null || c.lng == null) && !failed.has(`${c.id}:${c.address}`))
    if (!homeTodo && !todo.length) return

    running.current = true
    ;(async () => {
      let serviceDown = false
      if (homeTodo) {
        const hit = await geocode(home.address)
        const s = latest.current.settings
        if (hit) await saveSettings({ ...s, home_base: { ...s.home_base, ...hit, geocoded_for: home.address } })
        else if (hit === null) failed.add(`home:${home.address}`)
        else serviceDown = true
        await sleep(1100)
      }
      for (const c of serviceDown ? [] : todo) {
        const hit = await geocode(c.address!)
        if (hit === undefined) {
          serviceDown = true // offline or service down: retry in a minute
          break
        }
        // Re-read the client: it may have been edited while we waited.
        const current = latest.current.data.clients.find((x) => x.id === c.id)
        if (hit && current && current.address === c.address) upsert('clients', { ...current, ...hit })
        else if (hit === null) failed.add(`${c.id}:${c.address}`)
        await sleep(1100)
      }
      try {
        localStorage.setItem(FAILED_KEY, JSON.stringify([...failed]))
      } catch {
        /* ignore */
      }
      running.current = false
      if (serviceDown) setTimeout(() => setTick((n) => n + 1), 60_000)
      else setTick((n) => n + 1)
    })()
  }, [ready, data.clients, settings.home_base, upsert, saveSettings, tick])
}
