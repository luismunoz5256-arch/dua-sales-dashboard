import { addDays, parseDate, toDateStr } from './dates.js'
import { dayKind, pickDayPlan, rankClients, type Ranked } from './priority.js'
import type { DataSet, DateStr, DayKind, Settings } from './types.js'

/**
 * Rank "as of this morning" (ignoring what was logged today), so today's plan stays put
 * while you work through it; visited clients get a check mark instead of being replaced.
 */
export function asOfMorning(data: DataSet, t: DateStr): DataSet {
  return {
    ...data,
    interactions: data.interactions.filter((i) => i.date < t),
    followups: data.followups.map((f) => (f.done && f.done_at && toDateStr(new Date(f.done_at)) === t ? { ...f, done: false } : f)),
  }
}

/** Mon–Sun of the week containing `t` (on Sunday, the coming week), shifted by `offset` weeks. */
export function weekDates(t: DateStr, offset = 0): DateStr[] {
  const d = parseDate(t)
  const dow = d.getDay()
  const monday = addDays(t, dow === 0 ? 1 : 1 - dow)
  const start = addDays(monday, offset * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** day_status note marking a day you deliberately emptied (so it isn't refilled with suggestions). */
export const NO_VISITS_NOTE = 'no-visits'

export interface PlannedDay {
  date: DateStr
  kind: DayKind
  past: boolean
  /** true when you've edited this day (stored in week_plan); false = live suggestion */
  saved: boolean
  visits: Ranked[]
}

export interface WeekPlan {
  days: PlannedDay[]
  /** Everyone with a reason to be seen, best first (as of this morning). */
  ranked: Ranked[]
}

/**
 * Builds the plan for the given dates. Days you've edited keep exactly what you chose;
 * every other field day (today onward) gets a suggestion, best-need areas first,
 * without repeating anyone who's already on another day this week.
 */
/** Today's plan, computed with the rest of the week so it never repeats someone planned on another day. */
export function planToday(data: DataSet, settings: Settings, t: DateStr, forceField = false): { ranked: Ranked[]; day: PlannedDay } {
  const plan = planDays(data, settings, [...new Set([t, ...weekDates(t)])].sort(), t, forceField ? [t] : [])
  return { ranked: plan.ranked, day: plan.days.find((d) => d.date === t)! }
}

export function planDays(data: DataSet, settings: Settings, dates: DateStr[], t: DateStr, forceField: DateStr[] = []): WeekPlan {
  const ranked = rankClients(asOfMorning(data, t), settings, t)
  const byId = new Map(ranked.map((r) => [r.client.id, r]))
  const clients = new Map(data.clients.map((c) => [c.id, c]))
  const asRanked = (id: string): Ranked | null => {
    const hit = byId.get(id)
    if (hit) return hit
    const client = clients.get(id)
    return client ? { client, score: 0, reasons: [], lastContact: null, dueFollowups: [] } : null
  }

  const savedByDate = new Map<DateStr, string[]>()
  for (const row of [...data.week_plan].sort((a, b) => a.position - b.position)) {
    if (!dates.includes(row.date)) continue
    savedByDate.set(row.date, [...(savedByDate.get(row.date) ?? []), row.client_id])
  }
  // A day you emptied on purpose stays empty.
  for (const d of data.day_status) if (d.note === NO_VISITS_NOTE && dates.includes(d.id) && !savedByDate.has(d.id)) savedByDate.set(d.id, [])
  const taken = new Set<string>()
  for (const [date, ids] of savedByDate) if (date >= t) ids.forEach((id) => taken.add(id))

  let pool = ranked.filter((r) => !taken.has(r.client.id))
  const days = dates.map((date): PlannedDay => {
    const kind = forceField.includes(date) ? 'field' : dayKind(date, settings, data)
    const past = date < t
    const saved = savedByDate.get(date)
    if (saved) return { date, kind, past, saved: true, visits: saved.map(asRanked).filter((r): r is Ranked => !!r) }
    if (past || kind !== 'field') return { date, kind, past, saved: false, visits: [] }
    const { visits } = pickDayPlan(pool, settings.visits_per_day)
    const used = new Set(visits.map((v) => v.client.id))
    pool = pool.filter((r) => !used.has(r.client.id))
    return { date, kind, past, saved: false, visits }
  })
  return { days, ranked }
}
