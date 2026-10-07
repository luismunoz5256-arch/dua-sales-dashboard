import { ChevronRight, Navigation, Plus, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Card, Chip, Pill } from '../components/ui'
import { STATUS_LABEL, STATUS_STYLE } from '../lib/constants'
import { parseDate, today } from '../lib/dates'
import { newId, nowIso } from '../lib/ids'
import { NO_VISITS_NOTE, planDays, weekDates, type PlannedDay } from '../lib/plan'
import type { Ranked } from '../lib/priority'
import { directionsUrl, planRoute } from '../lib/route'
import { useStore } from '../lib/store'
import type { Client, DateStr, DayKind, Settings } from '../lib/types'

const KIND_LABEL: Record<DayKind, string> = { field: 'Field', warehouse: 'Warehouse', off: 'Off' }
const fmtDay = (d: DateStr, style: 'short' | 'long' = 'short') =>
  parseDate(d).toLocaleDateString(undefined, style === 'short' ? { weekday: 'short' } : { weekday: 'short', month: 'short', day: 'numeric' })

/** The usual kind for a weekday, ignoring per-date overrides. */
function usualKind(date: DateStr, settings: Settings): DayKind {
  const wd = parseDate(date).getDay()
  if (!settings.work_days.includes(wd)) return 'off'
  return settings.warehouse_days.includes(wd) ? 'warehouse' : 'field'
}

export default function WeekPage() {
  const { data, settings, upsert, remove } = useStore()
  const toast = useToast()
  const t = today()
  const [offset, setOffset] = useState(0)
  const [stop, setStop] = useState<{ r: Ranked; date: DateStr } | null>(null)
  const [addTo, setAddTo] = useState<DateStr | null>(null)

  const dates = useMemo(() => weekDates(t, offset), [t, offset])
  const plan = useMemo(() => planDays(data, settings, dates, t), [data, settings, dates, t])
  // Show work days, plus any other day you've overridden or planned.
  const shown = plan.days.filter(
    (d) => settings.work_days.includes(parseDate(d.date).getDay()) || d.visits.length || data.day_status.some((s) => s.id === d.date),
  )
  const upcoming = shown.filter((d) => !d.past)
  const fieldDays = upcoming.filter((d) => d.kind === 'field')
  const plannedOn = new Map<string, DateStr>()
  for (const d of upcoming) for (const v of d.visits) plannedOn.set(v.client.id, d.date)
  const home = settings.home_base.lat != null && settings.home_base.lng != null ? { lat: settings.home_base.lat, lng: settings.home_base.lng } : null

  /** Save a day exactly as given (this "pins" it; suggestions for other days work around it). */
  function setDayStops(date: DateStr, clientIds: string[]) {
    clearDay(date)
    const ids = [...new Set(clientIds)]
    const now = nowIso()
    if (ids.length) upsert('week_plan', ids.map((client_id, position) => ({ id: newId(), date, client_id, position, created_at: now })))
    // Emptied on purpose: remember it, otherwise the day would refill with suggestions.
    else upsert('day_status', { id: date, kind: 'field', note: NO_VISITS_NOTE })
  }

  /** Forget your edits for a day (its stops and the "emptied" marker). */
  function clearDay(date: DateStr) {
    const old = data.week_plan.filter((w) => w.date === date).map((w) => w.id)
    if (old.length) remove('week_plan', old)
    const marker = data.day_status.find((d) => d.id === date && d.note === NO_VISITS_NOTE)
    if (marker) {
      if (usualKind(date, settings) === marker.kind) remove('day_status', date)
      else upsert('day_status', { ...marker, note: null })
    }
  }
  const idsOf = (date: DateStr) => plan.days.find((d) => d.date === date)?.visits.map((v) => v.client.id) ?? []

  function moveStop(clientId: string, from: DateStr | null, to: DateStr) {
    if (from) setDayStops(from, idsOf(from).filter((id) => id !== clientId))
    setDayStops(to, [...idsOf(to).filter((id) => id !== clientId), clientId])
  }

  function setKind(day: PlannedDay, kind: DayKind) {
    if (kind === day.kind) return
    if (day.saved) clearDay(day.date)
    if (kind === usualKind(day.date, settings)) remove('day_status', day.date)
    else upsert('day_status', { id: day.date, kind, note: null })
    if (kind !== 'field' && day.visits.length) toast(`${fmtDay(day.date, 'long')} is now ${KIND_LABEL[kind].toLowerCase()}. Its stops moved to other days.`)
  }

  const totalVisits = fieldDays.reduce((s, d) => s + d.visits.length, 0)

  return (
    <div>
      <div className="flex gap-2 mt-1">
        <Chip active={offset === 0} onClick={() => setOffset(0)}>This week</Chip>
        <Chip active={offset === 1} onClick={() => setOffset(1)}>Next week</Chip>
      </div>
      <p className="text-sm text-slate-600 mt-3 px-1">
        {totalVisits} visits on {fieldDays.length} field day{fieldDays.length === 1 ? '' : 's'}
        {upcoming.length - fieldDays.length > 0 && ` · ${upcoming.length - fieldDays.length} warehouse/off`}. Tap a stop to move it. Each day keeps to one or two nearby areas.
      </p>

      <div className="space-y-3 mt-3">
        {shown.map((day) => {
          const groups = planRoute(home, day.visits)
          const route = directionsUrl(groups.flatMap((g) => g.stops).map((s) => s.client), settings.home_base.address)
          const logged = day.past ? data.interactions.filter((i) => i.date === day.date) : []
          return (
            <Card key={day.date} className={`p-3 ${day.past ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg flex-1">
                  {fmtDay(day.date, 'long')}
                  {day.date === t && <Pill className="bg-orange-100 text-orange-800 ml-2 align-middle">Today</Pill>}
                </h3>
                {!day.past && day.kind === 'field' && (
                  <Pill className={day.saved ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}>{day.saved ? 'Edited' : 'Suggested'}</Pill>
                )}
              </div>

              {!day.past && (
                <div className="grid grid-cols-3 gap-1 mt-2 bg-slate-100 rounded-xl p-1">
                  {(['field', 'warehouse', 'off'] as DayKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(day, k)}
                      className={`h-10 rounded-lg text-sm font-semibold ${
                        day.kind === k ? (k === 'field' ? 'bg-brand-700 text-white' : 'bg-amber-500 text-white') : 'text-slate-600'
                      }`}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              )}

              {day.past ? (
                <p className="text-sm text-slate-600 mt-1">
                  {logged.length ? `${logged.length} logged: ${[...new Set(logged.map((i) => data.clients.find((c) => c.id === i.client_id)?.business_name))].join(', ')}` : 'Nothing logged.'}
                </p>
              ) : day.kind !== 'field' ? (
                <p className="text-sm text-slate-500 mt-2">{day.kind === 'warehouse' ? 'At the warehouse: no visits.' : 'Day off.'}</p>
              ) : (
                <>
                  {groups.length > 0 && <p className="text-sm font-semibold text-slate-700 mt-2">{groups.map((g) => g.area).join(' → ')}</p>}
                  <div className="divide-y divide-slate-100 mt-1">
                    {groups.flatMap((g) =>
                      g.stops.map((r) => (
                        <button key={r.client.id} onClick={() => setStop({ r, date: day.date })} className="w-full text-left flex items-center gap-2 py-2.5 active:bg-slate-50">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">
                              {r.client.business_name}
                              {r.client.status !== 'active' && <Pill className={`${STATUS_STYLE[r.client.status]} ml-1.5 align-middle`}>{STATUS_LABEL[r.client.status]}</Pill>}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {r.client.area ?? 'No area'} · {r.reasons[0]?.text ?? 'Added by you'}
                            </p>
                          </div>
                          <ChevronRight size={18} className="text-slate-300 shrink-0" />
                        </button>
                      )),
                    )}
                    {day.visits.length === 0 && <p className="text-sm text-slate-500 py-2">No stops yet.</p>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setAddTo(day.date)} className="flex-1 h-11 rounded-xl border border-slate-300 font-semibold text-sm flex items-center justify-center gap-1 active:bg-slate-100">
                      <Plus size={16} /> Add
                    </button>
                    {route && (
                      <a href={route} target="_blank" rel="noreferrer" className="flex-1 h-11 rounded-xl border border-slate-300 font-semibold text-sm flex items-center justify-center gap-1 active:bg-slate-100">
                        <Navigation size={16} /> Route
                      </a>
                    )}
                    {day.saved && (
                      <button
                        onClick={() => {
                          clearDay(day.date)
                          toast(`${fmtDay(day.date, 'long')} reset to the suggestion`)
                        }}
                        className="h-11 px-3 rounded-xl border border-slate-300 font-semibold text-sm flex items-center justify-center gap-1 active:bg-slate-100"
                      >
                        <RotateCcw size={16} /> Reset
                      </button>
                    )}
                  </div>
                </>
              )}
            </Card>
          )
        })}
      </div>

      <Sheet open={!!stop} onClose={() => setStop(null)} title={stop?.r.client.business_name ?? ''}>
        {stop && (
          <>
            <p className="text-sm text-slate-600">
              {stop.r.client.area ?? 'No area'} · on {fmtDay(stop.date, 'long')}
            </p>
            {stop.r.reasons.length > 0 && <p className="text-sm text-slate-700 mt-1">Why: {stop.r.reasons.map((x) => x.text).join(' · ')}</p>}
            <p className="text-sm font-semibold text-slate-600 mt-4 mb-2">Move to</p>
            <div className="grid grid-cols-3 gap-2">
              {fieldDays
                .filter((d) => d.date !== stop.date)
                .map((d) => (
                  <button
                    key={d.date}
                    onClick={() => {
                      moveStop(stop.r.client.id, stop.date, d.date)
                      toast(`Moved to ${fmtDay(d.date, 'long')}`)
                      setStop(null)
                    }}
                    className="h-14 rounded-xl border border-slate-300 font-semibold active:bg-brand-50 flex flex-col items-center justify-center leading-tight"
                  >
                    {fmtDay(d.date)}
                    <span className="text-[11px] font-normal text-slate-500">{d.visits.length} stops</span>
                  </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Link to={`/clients/${stop.r.client.id}`} className="h-12 rounded-xl border border-slate-300 font-semibold flex items-center justify-center active:bg-slate-100">
                Open client
              </Link>
              <button
                onClick={() => {
                  setDayStops(stop.date, idsOf(stop.date).filter((id) => id !== stop.r.client.id))
                  toast(`Removed from ${fmtDay(stop.date, 'long')}`)
                  setStop(null)
                }}
                className="h-12 rounded-xl border border-red-300 text-red-700 font-semibold active:bg-red-50"
              >
                Remove from day
              </button>
            </div>
          </>
        )}
      </Sheet>

      <AddStopSheet
        date={addTo}
        onClose={() => setAddTo(null)}
        ranked={plan.ranked}
        clients={data.clients}
        plannedOn={plannedOn}
        onPick={(c) => {
          moveStop(c.id, plannedOn.get(c.id) ?? null, addTo!)
          toast(`Added ${c.business_name} to ${fmtDay(addTo!, 'long')}`)
          setAddTo(null)
        }}
      />
    </div>
  )
}

function AddStopSheet({
  date,
  onClose,
  ranked,
  clients,
  plannedOn,
  onPick,
}: {
  date: DateStr | null
  onClose: () => void
  ranked: Ranked[]
  clients: Client[]
  plannedOn: Map<string, DateStr>
  onPick: (c: Client) => void
}) {
  const [q, setQ] = useState('')
  const score = new Map(ranked.map((r) => [r.client.id, r]))
  const needle = q.trim().toLowerCase()
  const list = clients
    .filter((c) => c.lead_stage !== 'lost' && (!date || plannedOn.get(c.id) !== date))
    .filter((c) => !needle || [c.business_name, c.area, c.contact_name].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => (score.get(b.id)?.score ?? 0) - (score.get(a.id)?.score ?? 0) || a.business_name.localeCompare(b.business_name))

  return (
    <Sheet open={!!date} onClose={onClose} title={date ? `Add a stop · ${fmtDay(date, 'long')}` : ''}>
      <div className="relative mb-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 text-base" />
      </div>
      <div className="divide-y divide-slate-100">
        {list.map((c) => (
          <button key={c.id} onClick={() => onPick(c)} className="w-full text-left py-3 flex items-center gap-2 active:bg-slate-50">
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{c.business_name}</p>
              <p className="text-xs text-slate-500 truncate">
                {[c.area ?? 'No area', score.get(c.id)?.reasons[0]?.text].filter(Boolean).join(' · ')}
              </p>
            </div>
            {plannedOn.has(c.id) && <Pill className="bg-slate-100 text-slate-600">on {fmtDay(plannedOn.get(c.id)!)}</Pill>}
            <Plus size={20} className="text-brand-700 shrink-0" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}
