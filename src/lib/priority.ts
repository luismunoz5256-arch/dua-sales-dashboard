import { isNoOrderFlag, PRODUCT_LABEL } from './constants.js'
import { daysBetween } from './dates.js'
import { suggestUpsell } from './pitch.js'
import { miles } from './route.js'
import type { Client, DataSet, DateStr, Followup, PriorityWeights, Settings } from './types.js'

export type RuleKey = keyof PriorityWeights

export interface Reason {
  key: RuleKey
  text: string
  points: number
}

export interface Ranked {
  client: Client
  score: number
  reasons: Reason[]
  lastContact: DateStr | null
  dueFollowups: Followup[]
}

export const RULE_LABEL: Record<RuleKey, string> = {
  no_order: "Flagged as hasn't ordered",
  followup_due: 'Follow-up due or overdue',
  at_risk: 'Marked "At risk"',
  no_contact: 'No contact in a while (clients)',
  new_account: 'New account (first weeks)',
  upsell_gap: 'Not buying every product line',
  stale_lead: 'Lead not contacted recently',
}

export function lastContactMap(data: DataSet): Map<string, DateStr> {
  const m = new Map<string, DateStr>()
  for (const i of data.interactions) if ((m.get(i.client_id) ?? '') < i.date) m.set(i.client_id, i.date)
  return m
}

/**
 * Scores every client for "who should I see today". Each rule adds weight × strength, and
 * contributes a plain-English reason, so the ranking is never a mystery.
 */
export function rankClients(data: DataSet, settings: Settings, t: DateStr): Ranked[] {
  const { weights: w, no_contact_days, lead_no_contact_days, new_account_days } = settings.priority
  const last = lastContactMap(data)
  const openByClient = new Map<string, Followup[]>()
  for (const f of data.followups) {
    if (f.done || !f.client_id) continue
    openByClient.set(f.client_id, [...(openByClient.get(f.client_id) ?? []), f])
  }

  const out: Ranked[] = []
  for (const c of data.clients) {
    if (c.status === 'lead' && (c.lead_stage === 'lost' || c.lead_stage === 'won')) continue
    const reasons: Reason[] = []
    const add = (key: RuleKey, strength: number, text: string) => {
      const points = w[key] * strength
      if (points > 0) reasons.push({ key, text, points })
    }
    const open = openByClient.get(c.id) ?? []
    const lc = last.get(c.id) ?? null
    const since = lc ? daysBetween(lc, t) : null

    const flag = open.find(isNoOrderFlag)
    if (flag && c.status !== 'inactive') add('no_order', flag.due_date <= t ? 1 : 0.5, flag.task)

    const due = open.filter((f) => !isNoOrderFlag(f) && f.due_date <= t).sort((a, b) => a.due_date.localeCompare(b.due_date))
    if (due.length) {
      const late = daysBetween(due[0].due_date, t)
      const more = due.length > 1 ? ` (+${due.length - 1} more)` : ''
      add('followup_due', late > 0 ? 1.25 : 1, `${late > 0 ? `Follow-up ${late}d overdue` : 'Follow-up due today'}: ${due[0].task}${more}`)
    }

    if (c.status === 'inactive') {
      // Inactive accounts only come up when you've set a follow-up for them.
      if (reasons.length) out.push(finish(c, reasons, lc, due))
      continue
    }

    if (c.status === 'at_risk') add('at_risk', 1, 'Marked at risk')

    if (c.status === 'lead') {
      if (since == null) add('stale_lead', 1.5, 'Lead, never contacted')
      else if (since >= lead_no_contact_days) add('stale_lead', Math.min(2, since / lead_no_contact_days), `Lead, no contact in ${since} days`)
    } else {
      if (since == null) add('no_contact', 1.5, 'No contact logged yet')
      else if (since >= no_contact_days) add('no_contact', Math.min(2, since / no_contact_days), `No contact in ${since} days`)

      if (c.account_start_date) {
        const age = daysBetween(c.account_start_date, t)
        if (age >= 0 && age <= new_account_days) add('new_account', 1 - (age / new_account_days) * 0.5, `New account, day ${age} of ${new_account_days}`)
      }

      const upsell = suggestUpsell(c)
      if (upsell) add('upsell_gap', 1, `Not buying ${PRODUCT_LABEL[upsell].toLowerCase()} yet`)
    }

    if (reasons.length) out.push(finish(c, reasons, lc, due))
  }
  return out.sort((a, b) => b.score - a.score || a.client.business_name.localeCompare(b.client.business_name))
}

function finish(client: Client, reasons: Reason[], lastContact: DateStr | null, dueFollowups: Followup[]): Ranked {
  reasons.sort((a, b) => b.points - a.points)
  return { client, reasons, lastContact, dueFollowups, score: Math.round(reasons.reduce((s, r) => s + r.points, 0) * 10) / 10 }
}

/** Is this a day for visits? Per-date overrides (Week plan) win over the usual weekly pattern. */
export function dayKind(date: DateStr, settings: Settings, data: DataSet): 'field' | 'warehouse' | 'off' {
  const override = data.day_status.find((d) => d.id === date)
  if (override) return override.kind
  const [y, m, d] = date.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).getDay()
  if (!settings.work_days.includes(weekday)) return 'off'
  if (settings.warehouse_days.includes(weekday)) return 'warehouse'
  return 'field'
}

export interface DayPlan {
  visits: Ranked[]
  /** Areas chosen for today, in the order they were picked. */
  focusAreas: string[]
  /** High-scoring clients outside today's areas (call/text them, or catch them another day). */
  elsewhere: Ranked[]
}

const areaOf = (r: Ranked) => r.client.area || 'No area'

/** Once a day's route has started, only areas within this many miles of it are added (no cross-town zigzags). */
export const MAX_AREA_HOP_MILES = 8

/**
 * Builds a visit list that makes geographic sense: start with the area that needs you most
 * (sum of its top scores), then fill from nearby areas, preferring the closest. Areas farther than
 * MAX_AREA_HOP_MILES are left for another day, even if that leaves today a little short.
 */
export function pickDayPlan(ranked: Ranked[], n: number): DayPlan {
  const byArea = new Map<string, Ranked[]>()
  for (const r of ranked) byArea.set(areaOf(r), [...(byArea.get(areaOf(r)) ?? []), r])
  const need = (list: Ranked[]) => list.slice(0, n).reduce((s, r) => s + r.score, 0)
  const center = (list: Ranked[]) => {
    const pts = list.filter((r) => r.client.lat != null && r.client.lng != null)
    return pts.length
      ? { lat: pts.reduce((s, r) => s + r.client.lat!, 0) / pts.length, lng: pts.reduce((s, r) => s + r.client.lng!, 0) / pts.length }
      : null
  }

  const visits: Ranked[] = []
  const focusAreas: string[] = []
  const remaining = new Map(byArea)
  while (visits.length < n && remaining.size) {
    const here = center(visits)
    let best: string | null = null
    let bestValue = -Infinity
    for (const [area, list] of remaining) {
      const c = center(list)
      // Each 5 miles away halves an area's appeal once you've started a route.
      const distance = here && c ? miles(here, c) : 0
      if (distance > MAX_AREA_HOP_MILES) continue
      const value = need(list) / (1 + distance / 5)
      if (value > bestValue) {
        bestValue = value
        best = area
      }
    }
    if (!best) break
    visits.push(...remaining.get(best)!.slice(0, n - visits.length))
    focusAreas.push(best)
    remaining.delete(best)
  }
  const chosen = new Set(visits.map((v) => v.client.id))
  const elsewhere = ranked.filter((r) => !chosen.has(r.client.id) && !focusAreas.includes(areaOf(r)))
  return { visits, focusAreas, elsewhere }
}
