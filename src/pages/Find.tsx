import { Bookmark, Download, ExternalLink, Globe, List, Loader2, Map as MapIcon, MapPin, Phone, RefreshCw, Search, Star, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Button, Card, Chip, Pill, SectionTitle } from '../components/ui'
import { blankClient, useActions } from '../lib/actions'
import { PRODUCT_LABEL } from '../lib/constants'
import { downloadFile, toCsv } from '../lib/csv'
import { relativeDay, toDateStr, today } from '../lib/dates'
import { newId, nowIso } from '../lib/ids'
import { planDays, weekDates } from '../lib/plan'
import { SearchError, searchPlaces, type SearchParams, type SearchResult } from '../lib/placesApi'
import {
  areaCenter, BUSINESS_TYPES, computeFit, DEFAULT_CHAINS, DEFAULT_FIT_WEIGHTS, findExisting, normName, PRICE_LABEL, prospectPitch,
  socialSearchLinks, type Category, type Fit, type Place,
} from '../lib/prospects'
import { pitchText } from '../lib/pitch'
import { miles } from '../lib/route'
import { useStore } from '../lib/store'
import type { Client, Prospect } from '../lib/types'

const ProspectMap = lazy(() => import('../components/ProspectMap'))

type Where = { kind: 'area'; area: string } | { kind: 'me' } | { kind: 'home' } | { kind: 'route' }
const RADII = [1, 3, 5]
const MI = 1609.34

/** Remember the last search while moving around the app. */
const last: { type: string; where: Where | null; radius: number; view: 'list' | 'map'; tab: 'search' | 'saved' } = {
  type: 'restaurants',
  where: null,
  radius: 3,
  view: 'list',
  tab: 'search',
}

interface Scored {
  place: Place
  fit: Fit
}

export default function FindPage() {
  const { data, settings, upsert, remove } = useStore()
  const { saveClient } = useActions()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [type, setType] = useState(last.type)
  const [where, setWhere] = useState<Where | null>(last.where)
  const [radius, setRadius] = useState(last.radius)
  const [view, setView] = useState(last.view)
  const [tab, setTab] = useState(last.tab)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [extra, setExtra] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  Object.assign(last, { type, where, radius, view, tab })

  const t = today()
  const typeMeta = BUSINESS_TYPES.find((b) => b.key === type)!
  const routeStops = useMemo(() => {
    const plan = planDays(data, settings, [...new Set([t, ...weekDates(t)])].sort(), t)
    return plan.days.find((d) => d.date === t)?.visits.map((v) => v.client).filter((c) => c.lat != null && c.lng != null) ?? []
  }, [data, settings, t])

  async function buildParams(w: Where, refresh = false): Promise<SearchParams> {
    const base = { type, refresh, radiusMeters: Math.round(radius * MI) }
    if (w.kind === 'area') {
      const c = areaCenter(w.area, data.clients)
      return { ...base, area: w.area, ...(c ? { lat: c.lat, lng: c.lng, radiusMeters: Math.round(c.radius * MI) } : {}) }
    }
    if (w.kind === 'home') {
      if (settings.home_base.lat == null) throw new SearchError('home', 'Your home address is not on the map yet. Check it in Settings.')
      return { ...base, lat: settings.home_base.lat, lng: settings.home_base.lng! }
    }
    if (w.kind === 'route') {
      if (!routeStops.length) throw new SearchError('route', 'No visits with a map location on today\'s plan.')
      const lat = routeStops.reduce((s, c) => s + c.lat!, 0) / routeStops.length
      const lng = routeStops.reduce((s, c) => s + c.lng!, 0) / routeStops.length
      const far = Math.max(...routeStops.map((c) => miles({ lat, lng }, { lat: c.lat!, lng: c.lng! })))
      return { ...base, lat, lng, radiusMeters: Math.round(Math.min(8, far + 1) * MI) }
    }
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 }) : reject(new Error('no gps')),
    ).catch(() => {
      throw new SearchError('gps', 'Couldn\'t get your location. Allow location access for this site and try again.')
    })
    return { ...base, lat: pos.coords.latitude, lng: pos.coords.longitude }
  }

  const run = useCallback(
    async (w: Where, refresh = false) => {
      setBusy(true)
      setError(null)
      setExtra([])
      try {
        const p = await buildParams(w, refresh)
        setResult(await searchPlaces(p))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [type, radius, data.clients, settings.home_base, routeStops], // buildParams reads these
  )

  // Opened from TODAY's "near today's route" button.
  useEffect(() => {
    if (params.get('near') === 'route') {
      setParams({}, { replace: true })
      const w: Where = { kind: 'route' }
      setWhere(w)
      setTab('search')
      run(w)
    }
  }, [params, setParams, run])

  async function loadMore() {
    if (!result?.nextPageToken || !where) return
    setBusy(true)
    try {
      const p = await buildParams(where)
      const more = await searchPlaces({ ...p, pageToken: result.nextPageToken })
      setExtra((x) => [...x, ...more.places])
      setResult({ ...result, nextPageToken: more.nextPageToken })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const prospectsById = useMemo(() => new Map(data.prospects.map((p) => [p.google_place_id, p])), [data.prospects])
  const chains = useMemo(() => [...DEFAULT_CHAINS, ...(settings.extra_chains ?? [])], [settings.extra_chains])
  const score = useCallback(
    (places: Place[], category: Category) => {
      const nameCounts = new Map<string, number>()
      for (const p of places) nameCounts.set(normName(p.name), (nameCounts.get(normName(p.name)) ?? 0) + 1)
      return places.map((place) => ({
        place,
        fit: computeFit(place, category, {
          clients: data.clients,
          routeStops: where?.kind === 'route' ? routeStops : undefined,
          chains,
          weights: { ...DEFAULT_FIT_WEIGHTS, ...settings.fit_weights },
          nameCounts,
        }),
      }))
    },
    [data.clients, routeStops, where, chains, settings.fit_weights],
  )

  const { shown, hidden } = useMemo(() => {
    if (!result) return { shown: [] as Scored[], hidden: { existing: 0, dismissed: 0, far: 0 } }
    const seen = new Set<string>()
    const unique = [...result.places, ...extra].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    const all = score(unique, typeMeta.category)
    const hidden = { existing: 0, dismissed: 0, far: 0 }
    // Google treats the area as a hint, so drop results well outside the area you picked.
    const center = where?.kind === 'area' ? areaCenter(where.area, data.clients) : null
    const shown = all.filter(({ place }) => {
      if (center && place.lat != null && miles(center, { lat: place.lat, lng: place.lng! }) > center.radius * 2) return hidden.far++, false
      const pr = prospectsById.get(place.id)
      if (pr?.status === 'dismissed') return hidden.dismissed++, false
      if (pr?.status === 'added' || findExisting(place, data.clients)) return hidden.existing++, false
      return true
    })
    shown.sort((a, b) => b.fit.score - a.fit.score)
    return { shown, hidden }
  }, [result, extra, score, typeMeta.category, prospectsById, data.clients, where])

  const nearRoute = where?.kind === 'route'
    ? shown.filter(({ place }) => place.lat != null && routeStops.some((c) => miles({ lat: place.lat!, lng: place.lng! }, { lat: c.lat!, lng: c.lng! }) <= 1.5)).slice(0, 5)
    : []

  // ---------- actions ----------
  function saveProspect(place: Place, fit: Fit, status: Prospect['status'], clientId: string | null = null) {
    const existing = prospectsById.get(place.id)
    const now = nowIso()
    const row: Prospect = {
      id: existing?.id ?? newId(),
      google_place_id: place.id,
      name: place.name,
      status,
      fit_score: fit.score,
      data: { ...place, category: fit.category } as unknown as Record<string, unknown>,
      client_id: clientId ?? existing?.client_id ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    upsert('prospects', row)
    return { before: existing ?? null, row }
  }
  const undoProspect = (before: Prospect | null, row: Prospect) => (before ? upsert('prospects', before) : remove('prospects', row.id))

  function nearestArea(place: Place): string | null {
    if (where?.kind === 'area') return where.area
    if (place.lat == null) return null
    let best: { area: string; d: number } | null = null
    for (const area of settings.areas) {
      const c = areaCenter(area, data.clients)
      if (!c) continue
      const d = miles({ lat: place.lat, lng: place.lng! }, c)
      if (!best || d < best.d) best = { area, d }
    }
    return best?.area ?? null
  }

  function addToLeads({ place, fit }: Scored) {
    const pitch = prospectPitch(fit.category, place)
    const c: Client = {
      ...blankClient('lead'),
      business_name: place.name,
      phone: place.phone,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      area: nearestArea(place),
      google_place_id: place.id.startsWith('sample-') ? null : place.id,
      source: 'prospect_finder',
      preferred_contact: 'visit',
      notes: [
        `Found with Prospect Finder: ${place.typeLabel ?? fit.category}${place.rating ? `, ★${place.rating} (${place.reviews} reviews)` : ''}.`,
        `Why: ${fit.why}.`,
        `Lead with: ${pitch.lines.map((l) => PRODUCT_LABEL[l]).join(' + ')}.`,
        place.website ? `Website: ${place.website}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    }
    saveClient(c)
    const { before, row } = saveProspect(place, fit, 'added', c.id)
    toast(`Added ${place.name} to Leads`, [
      { label: 'Open', onClick: () => navigate(`/clients/${c.id}`) },
      { label: 'Undo', onClick: () => (remove('clients', c.id), undoProspect(before, row)) },
    ])
  }

  function act(s: Scored, status: 'saved' | 'dismissed') {
    const { before, row } = saveProspect(s.place, s.fit, status)
    toast(status === 'saved' ? `Saved ${s.place.name} for later` : `Dismissed ${s.place.name}. It won't show again.`, [
      { label: 'Undo', onClick: () => undoProspect(before, row) },
    ])
  }

  const saved = data.prospects.filter((p) => p.status === 'saved')
  const savedScored: Scored[] = saved.map((p) => {
    const place = p.data as unknown as Place & { category?: Category }
    return score([place], place.category ?? 'restaurant')[0]
  })

  function exportSaved() {
    downloadFile(
      `dua-prospects-${t}.csv`,
      toCsv(
        ['Name', 'Type', 'Address', 'Phone', 'Website', 'Rating', 'Reviews', 'Fit score', 'Why', 'Lead with', 'Google Maps', 'Saved'],
        savedScored.map(({ place, fit }) => [
          place.name, place.typeLabel, place.address, place.phone, place.website, place.rating, place.reviews, fit.score, fit.why,
          prospectPitch(fit.category, place).lines.map((l) => PRODUCT_LABEL[l]).join(' + '), place.mapsUrl,
          saved.find((s) => s.google_place_id === place.id)?.updated_at.slice(0, 10),
        ]),
      ),
    )
  }

  const pins = shown
    .filter((s) => s.place.lat != null)
    .map((s) => ({ id: s.place.id, lat: s.place.lat!, lng: s.place.lng!, name: s.place.name, score: s.fit.score, why: s.fit.why }))
  const pick = useCallback((id: string) => setFocus(id), [])
  const hiddenTotal = hidden.existing + hidden.dismissed

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 bg-slate-200 rounded-xl p-1 mt-1">
        {(['search', 'saved'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`h-10 rounded-lg text-sm font-semibold ${tab === k ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
            {k === 'search' ? 'Search' : `Saved (${saved.length})`}
          </button>
        ))}
      </div>

      {tab === 'saved' ? (
        <>
          {saved.length > 0 && (
            <Button variant="secondary" className="w-full mt-3" onClick={exportSaved}>
              <Download size={18} /> Export saved to CSV
            </Button>
          )}
          <div className="space-y-2 mt-3">
            {savedScored.map((s) => (
              <ResultCard key={s.place.id} s={s} onAdd={() => addToLeads(s)} onDismiss={() => act(s, 'dismissed')} savedView />
            ))}
            {saved.length === 0 && <p className="text-center text-slate-500 py-10">Nothing saved yet. Tap Save on a search result.</p>}
          </div>
        </>
      ) : (
        <>
          <SectionTitle>What</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((b) => (
              <Chip key={b.key} active={type === b.key} onClick={() => setType(b.key)}>
                {b.emoji} {b.label}
              </Chip>
            ))}
          </div>

          <SectionTitle>Where</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Chip active={where?.kind === 'me'} onClick={() => setWhere({ kind: 'me' })}>📍 Near me</Chip>
            <Chip active={where?.kind === 'home'} onClick={() => setWhere({ kind: 'home' })}>🏠 Near home</Chip>
            <Chip active={where?.kind === 'route'} onClick={() => setWhere({ kind: 'route' })}>🚚 Today's route</Chip>
            {settings.areas.map((a) => (
              <Chip key={a} active={where?.kind === 'area' && where.area === a} onClick={() => setWhere({ kind: 'area', area: a })}>
                {a}
              </Chip>
            ))}
          </div>
          {(where?.kind === 'me' || where?.kind === 'home') && (
            <div className="flex gap-2 mt-3 items-center">
              <span className="text-sm font-semibold text-slate-600">Within</span>
              {RADII.map((r) => (
                <Chip key={r} active={radius === r} onClick={() => setRadius(r)}>
                  {r} mi
                </Chip>
              ))}
            </div>
          )}

          <Button className="w-full h-14 text-lg mt-4" disabled={!where || busy} onClick={() => where && run(where)}>
            {busy ? <Loader2 className="animate-spin" size={22} /> : <Search size={22} />}
            {where ? `Find ${typeMeta.label.toLowerCase()}` : 'Pick where to search'}
          </Button>

          {error && <Card className="p-3 mt-3 text-sm text-red-700 bg-red-50 border-red-200">{error}</Card>}

          {result && (
            <>
              {result.sample && (
                <Card className="p-3 mt-3 text-sm bg-purple-50 border-purple-200 text-purple-900">
                  <b>Sample results.</b> These are made-up businesses so you can try the screen. Real El Paso results appear once your Google key is set up (see Settings).
                </Card>
              )}
              <div className="flex items-center gap-2 mt-4 px-1">
                <p className="text-sm text-slate-600 flex-1">
                  <b>{shown.length}</b> prospects{hiddenTotal ? ` · ${hiddenTotal} hidden (already yours or dismissed)` : ''}
                  {hidden.far ? ` · ${hidden.far} outside ${where?.kind === 'area' ? where.area : 'the area'}` : ''}
                  {!result.sample && (
                    <span className="block text-xs text-slate-400">
                      {result.cached ? `Saved search from ${relativeDay(toDateStr(new Date(result.fetchedAt))).toLowerCase()}` : 'Fresh from Google'}
                      {result.usedToday != null && ` · ${result.usedToday}/${result.limit} searches today`}
                    </span>
                  )}
                </p>
                {!result.sample && (
                  <button onClick={() => where && run(where, true)} aria-label="Refresh" className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold flex items-center gap-1 active:bg-slate-100">
                    <RefreshCw size={14} /> Refresh
                  </button>
                )}
                <div className="flex bg-slate-200 rounded-lg p-0.5">
                  <button aria-label="List" onClick={() => setView('list')} className={`w-10 h-9 rounded-md grid place-items-center ${view === 'list' ? 'bg-white' : ''}`}>
                    <List size={18} />
                  </button>
                  <button aria-label="Map" onClick={() => setView('map')} className={`w-10 h-9 rounded-md grid place-items-center ${view === 'map' ? 'bg-white' : ''}`}>
                    <MapIcon size={18} />
                  </button>
                </div>
              </div>

              {nearRoute.length > 0 && (
                <Card className="p-3 mt-3 bg-orange-50 border-orange-200">
                  <p className="font-bold text-sm">🚚 Drop in while you're on today's route</p>
                  <ul className="text-sm mt-1 space-y-0.5">
                    {nearRoute.map(({ place, fit }) => (
                      <li key={place.id}>
                        <button className="text-left underline decoration-orange-300" onClick={() => setFocus(place.id)}>
                          {place.name}
                        </button>{' '}
                        <span className="text-slate-500">· fit {fit.score.toFixed(1)} · {fit.reasons.find((r) => r.key === 'near')?.text ?? ''}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {view === 'map' ? (
                <div className="mt-3">
                  <Suspense fallback={<div className="h-[60vh] grid place-items-center text-slate-500">Loading map…</div>}>
                    <ProspectMap pins={pins} clients={data.clients} onPick={pick} />
                  </Suspense>
                  <p className="text-xs text-slate-500 mt-1 px-1">Numbers are fit scores. Green dots are your clients. Tap a pin, then switch to the list to act.</p>
                </div>
              ) : (
                <div className="space-y-2 mt-3">
                  {shown.map((s) => (
                    <ResultCard
                      key={s.place.id}
                      s={s}
                      focused={focus === s.place.id}
                      saved={prospectsById.get(s.place.id)?.status === 'saved'}
                      onAdd={() => addToLeads(s)}
                      onSave={() => act(s, 'saved')}
                      onDismiss={() => act(s, 'dismissed')}
                    />
                  ))}
                  {shown.length === 0 && <p className="text-center text-slate-500 py-8">No new prospects here. Try another type or area.</p>}
                  {result.nextPageToken && (
                    <Button variant="secondary" className="w-full" disabled={busy} onClick={loadMore}>
                      Load more results
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function ResultCard({
  s: { place, fit },
  focused,
  saved,
  savedView,
  onAdd,
  onSave,
  onDismiss,
}: {
  s: Scored
  focused?: boolean
  saved?: boolean
  savedView?: boolean
  onAdd: () => void
  onSave?: () => void
  onDismiss: () => void
}) {
  const [why, setWhy] = useState(false)
  const { settings } = useStore()
  const pitch = prospectPitch(fit.category, place)
  const opener = pitchText(pitch, settings.pitch_language)
  const social = socialSearchLinks(place)
  const tone = fit.score >= 7 ? 'bg-brand-700' : fit.score >= 4 ? 'bg-orange-500' : 'bg-slate-400'
  useEffect(() => {
    if (focused) document.getElementById(`p-${place.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focused, place.id])

  return (
    <Card className={`p-3 ${focused ? 'ring-2 ring-orange-400' : ''}`}>
      <div id={`p-${place.id}`} className="flex items-start gap-3">
        <button onClick={() => setWhy(!why)} aria-label="Fit details" className={`w-12 h-12 shrink-0 rounded-xl ${tone} text-white grid place-items-center leading-none`}>
          <span className="text-lg font-extrabold">{fit.score.toFixed(1)}</span>
          <span className="text-[9px] font-semibold -mt-2">FIT</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-tight">
            {place.name}
            {fit.chain && <Pill className="bg-slate-200 text-slate-700 ml-1.5 align-middle">Chain</Pill>}
            {saved && <Pill className="bg-sky-100 text-sky-800 ml-1.5 align-middle">Saved</Pill>}
          </p>
          <p className="text-xs text-slate-500">
            {[place.typeLabel, place.priceLevel != null ? PRICE_LABEL[place.priceLevel] : null, place.openNow === true ? 'Open now' : place.openNow === false ? 'Closed now' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {place.rating != null && (
            <p className="text-xs text-slate-600 flex items-center gap-1">
              <Star size={12} className="fill-amber-400 text-amber-400" /> {place.rating} ({place.reviews?.toLocaleString() ?? 0})
            </p>
          )}
        </div>
      </div>

      <button onClick={() => setWhy(!why)} className="w-full text-left text-sm mt-2">
        <span className="font-semibold text-orange-700">Why: </span>
        {fit.why}
      </button>
      {why && (
        <div className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 space-y-0.5">
          {fit.reasons.map((r) => (
            <p key={r.key + r.text} className="flex gap-2">
              <span className="flex-1">{r.text}</span>
              <span className={`font-semibold ${r.points < 0 ? 'text-red-600' : ''}`}>
                {r.points > 0 ? '+' : ''}
                {Math.round(r.points * 10) / 10}
              </span>
            </p>
          ))}
          <p className="text-slate-400 pt-1">Score = points ÷ 12 × 10. Change the weights in Settings.</p>
        </div>
      )}
      {place.address && <p className="text-xs text-slate-500 mt-1">{place.address}</p>}

      <div className="mt-2 rounded-lg bg-orange-50 p-2.5 text-sm">
        <p className="font-semibold text-orange-800">Lead with: {pitch.lines.map((l) => PRODUCT_LABEL[l]).join(' + ')}</p>
        <p className="text-slate-700 italic mt-0.5 whitespace-pre-line">“{opener}”</p>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {place.website && <LinkChip href={place.website} icon={<Globe size={14} />} label="Website" />}
        <LinkChip href={social.instagram} icon={<ExternalLink size={14} />} label="Instagram" />
        <LinkChip href={social.facebook} icon={<ExternalLink size={14} />} label="Facebook" />
        {place.mapsUrl && <LinkChip href={place.mapsUrl} icon={<MapPin size={14} />} label="Maps" />}
        {!place.mapsUrl && place.address && (
          <LinkChip href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.address}`)}`} icon={<MapPin size={14} />} label="Maps" />
        )}
        {place.phone && <LinkChip href={`tel:${place.phone}`} icon={<Phone size={14} />} label="Call" external={false} />}
      </div>

      <div className={`grid gap-2 mt-3 ${savedView ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_auto_auto]'}`}>
        <Button className="h-12" onClick={onAdd}>
          + Add to Leads
        </Button>
        {!savedView && (
          <button onClick={onSave} disabled={saved} aria-label="Save for later" className="h-12 w-12 rounded-xl border border-slate-300 grid place-items-center active:bg-slate-100 disabled:opacity-40">
            <Bookmark size={20} />
          </button>
        )}
        <button onClick={onDismiss} aria-label="Dismiss" className="h-12 w-12 rounded-xl border border-slate-300 grid place-items-center text-slate-500 active:bg-slate-100">
          <X size={20} />
        </button>
      </div>
    </Card>
  )
}

function LinkChip({ href, icon, label, external = true }: { href: string; icon: ReactNode; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel="noreferrer"
      className="h-9 px-3 rounded-full bg-slate-100 active:bg-slate-200 text-xs font-semibold flex items-center gap-1 text-slate-700"
    >
      {icon} {label}
    </a>
  )
}
