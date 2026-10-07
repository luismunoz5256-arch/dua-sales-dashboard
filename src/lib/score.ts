import { FREQUENCY_DAYS, INTERACTION_LABEL } from './constants'
import { addDays, toDateStr } from './dates'
import { GOAL_BONUS, goalBonuses } from './goals'
import { dayKind } from './priority'
import type { Client, DataSet, DateStr, InteractionType, Settings } from './types'

/** Points per logged action. Each type counts once per client per day. */
export const ACTION_POINTS: Record<InteractionType, number> = {
  visit: 10,
  call: 5,
  text: 3,
  sample_drop: 15,
  quote_sent: 20,
  order: 0,
}
export const FOLLOWUP_POINTS = 5

export type ClientSize = 'small' | 'medium' | 'large' | 'unknown'
export const WIN_POINTS: Record<ClientSize, number> = { unknown: 100, small: 100, medium: 200, large: 350 }
export const SIZE_LABEL: Record<ClientSize, string> = { unknown: 'Size not set', small: 'Small', medium: 'Medium', large: 'Large' }

/** Size from typical order × orders per week: Small < $300/wk, Medium $300–999, Large $1,000+. */
export function clientSize(c: Pick<Client, 'typical_order_size' | 'order_frequency'>): ClientSize {
  if (c.typical_order_size == null || c.typical_order_size <= 0) return 'unknown'
  const days = c.order_frequency ? FREQUENCY_DAYS[c.order_frequency] : null
  const perWeek = days ? 7 / days : 0.5
  const weekly = c.typical_order_size * perWeek
  return weekly >= 1000 ? 'large' : weekly >= 300 ? 'medium' : 'small'
}

export const winPoints = (c: Pick<Client, 'typical_order_size' | 'order_frequency'>) => WIN_POINTS[clientSize(c)]

export type EventKind = InteractionType | 'followup' | 'win' | 'goal'

export interface ScoreEvent {
  date: DateStr
  points: number
  kind: EventKind
  label: string
  clientId: string | null
  /** for sorting events within a day */
  at: string
}

/**
 * Every point comes from something already in your data, so totals are always explainable
 * and Undo / delete takes the points back automatically.
 */
export function scoreEvents(data: DataSet, settings: Settings): ScoreEvent[] {
  const names = new Map(data.clients.map((c) => [c.id, c.business_name]))
  const events: ScoreEvent[] = []
  const seen = new Set<string>()
  for (const i of data.interactions) {
    const pts = ACTION_POINTS[i.type]
    const key = `${i.client_id}|${i.date}|${i.type}`
    if (!pts || seen.has(key)) continue
    seen.add(key)
    events.push({ date: i.date, points: pts, kind: i.type, label: `${INTERACTION_LABEL[i.type]} ${names.get(i.client_id) ?? ''}`.trim(), clientId: i.client_id, at: i.created_at })
  }
  for (const f of data.followups) {
    if (!f.done || !f.done_at) continue
    const who = f.client_id ? names.get(f.client_id) : null
    events.push({ date: toDateStr(new Date(f.done_at)), points: FOLLOWUP_POINTS, kind: 'followup', label: `Follow-up done${who ? ` · ${who}` : ''}`, clientId: f.client_id, at: f.done_at })
  }
  for (const c of data.clients) {
    if (c.status === 'lead' || !c.account_start_date) continue
    const size = clientSize(c)
    events.push({
      date: c.account_start_date,
      points: WIN_POINTS[size],
      kind: 'win',
      label: `Secured ${c.business_name}${size !== 'unknown' ? ` (${SIZE_LABEL[size].toLowerCase()})` : ''}`,
      clientId: c.id,
      at: `${c.account_start_date}T12:00:00.000Z`,
    })
  }
  for (const g of goalBonuses(data, settings))
    events.push({ date: g.date, points: GOAL_BONUS, kind: 'goal', label: g.label, clientId: null, at: `${g.date}T23:59:59.000Z` })
  return events.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
}

export interface Level {
  level: number
  name: string
  emoji: string
  /** points needed to reach this level */
  min: number
}

const NAMES: [string, string][] = [
  ['Seedling', '🌱'],
  ['Sprout', '🌿'],
  ['Grower', '🥕'],
  ['Picker', '🍅'],
  ['Market Runner', '🧺'],
  ['Route Pro', '🚚'],
  ['Produce Pro', '🥑'],
  ['Fresh Closer', '🍊'],
  ['Harvest Master', '🌽'],
  ['Route Legend', '👑'],
]

/** Each level needs a bit more than the last: 0, 150, 400, 750, 1200, 1750, 2400, 3150, 4000, 4950, then +1,400 each. */
export function levelMin(level: number): number {
  if (level <= 1) return 0
  let total = 0
  for (let l = 2; l <= level; l++) total += l <= 10 ? 150 + (l - 2) * 100 : 1400
  return total
}

export function levelInfo(level: number): Level {
  const [name, emoji] = level <= NAMES.length ? NAMES[level - 1] : [`${NAMES[NAMES.length - 1][0]} ${level - NAMES.length + 1}`, '👑']
  return { level, name, emoji, min: levelMin(level) }
}

export function levelFor(points: number): { current: Level; next: Level; progress: number } {
  let level = 1
  while (levelMin(level + 1) <= points) level++
  const current = levelInfo(level)
  const next = levelInfo(level + 1)
  return { current, next, progress: (points - current.min) / (next.min - current.min) }
}

/** Consecutive field days with at least one logged action, ending today (or yesterday if nothing yet today). Warehouse/off days don't break it. */
export function streak(data: DataSet, settings: Settings, t: DateStr): number {
  const active = new Set(data.interactions.map((i) => i.date))
  let d = active.has(t) ? t : addDays(t, -1)
  let count = 0
  for (let n = 0; n < 400; n++, d = addDays(d, -1)) {
    if (active.has(d)) count++
    else if (dayKind(d, settings, data) === 'field') break
  }
  return count
}

export function summarize(events: ScoreEvent[], t: DateStr) {
  const weekStart = addDays(t, -((new Date(t + 'T12:00:00').getDay() + 6) % 7)) // Monday
  const sum = (list: ScoreEvent[]) => list.reduce((s, e) => s + e.points, 0)
  return {
    total: sum(events),
    today: sum(events.filter((e) => e.date === t)),
    week: sum(events.filter((e) => e.date >= weekStart && e.date <= t)),
    weekEvents: events.filter((e) => e.date >= weekStart && e.date <= t),
  }
}
