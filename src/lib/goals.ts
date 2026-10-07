import { addDays, parseDate, toDateStr } from './dates'
import type { DataSet, DateStr, ProductLine, Settings } from './types'

export type GoalKey = 'new_accounts_month' | 'visits_week' | 'leads_week' | 'multi_line_clients'
export type Period = 'week' | 'month' | 'standing'

export const GOALS: { key: GoalKey; label: string; period: Period; hint: string }[] = [
  { key: 'new_accounts_month', label: 'New accounts this month', period: 'month', hint: 'Leads you turn into active clients' },
  { key: 'visits_week', label: 'Visits this week', period: 'week', hint: 'One per client per day' },
  { key: 'leads_week', label: 'Leads contacted this week', period: 'week', hint: 'Different leads you visit, call or text' },
  { key: 'multi_line_clients', label: 'Clients buying 2+ product lines', period: 'standing', hint: 'Grows with every upsell' },
]

export const GOAL_BONUS = 50

/** Monday–Sunday week or calendar month containing `t`, shifted back by `back` periods. */
export function periodBounds(t: DateStr, period: Exclude<Period, 'standing'>, back = 0): [DateStr, DateStr] {
  if (period === 'week') {
    const monday = addDays(t, -((parseDate(t).getDay() + 6) % 7) - back * 7)
    return [monday, addDays(monday, 6)]
  }
  const d = parseDate(t)
  const start = new Date(d.getFullYear(), d.getMonth() - back, 1)
  const end = new Date(d.getFullYear(), d.getMonth() - back + 1, 0)
  return [toDateStr(start), toDateStr(end)]
}

const MAIN: ProductLine[] = ['produce', 'commercial_juice', 'cold_pressed', 'prepped_veg']

/**
 * The dated "units" that count toward a goal (e.g. each visit), sorted by date.
 * The nth item's date is when a target of n was reached.
 */
export function goalUnits(key: Exclude<GoalKey, 'multi_line_clients'>, data: DataSet): DateStr[] {
  if (key === 'new_accounts_month')
    return data.clients.filter((c) => c.status !== 'lead' && c.account_start_date).map((c) => c.account_start_date!).sort()
  const seen = new Set<string>()
  const out: DateStr[] = []
  const clients = new Map(data.clients.map((c) => [c.id, c]))
  for (const i of [...data.interactions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (key === 'visits_week') {
      if (i.type !== 'visit') continue
      const k = `${i.client_id}|${i.date}`
      if (!seen.has(k)) out.push(i.date), seen.add(k)
    } else {
      // Was this client a lead at the time? (still a lead, or became an account later)
      const c = clients.get(i.client_id)
      if (!c || i.type === 'order') continue
      const wasLead = c.status === 'lead' || (c.account_start_date != null && i.date < c.account_start_date)
      const k = `${i.client_id}|${weekKey(i.date)}`
      if (wasLead && !seen.has(k)) out.push(i.date), seen.add(k)
    }
  }
  return out
}

const weekKey = (d: DateStr) => periodBounds(d, 'week')[0]

export function multiLineClients(data: DataSet): number {
  return data.clients.filter((c) => (c.status === 'active' || c.status === 'at_risk') && MAIN.filter((p) => c.product_lines.includes(p)).length >= 2).length
}

export function progress(key: GoalKey, data: DataSet, t: DateStr): number {
  if (key === 'multi_line_clients') return multiLineClients(data)
  const meta = GOALS.find((g) => g.key === key)!
  const [start, end] = periodBounds(t, meta.period as 'week' | 'month')
  return goalUnits(key, data).filter((d) => d >= start && d <= end).length
}

/** Counts for the previous `n` periods (most recent first), for history and suggestions. */
export function history(key: Exclude<GoalKey, 'multi_line_clients'>, data: DataSet, t: DateStr, n: number): number[] {
  const meta = GOALS.find((g) => g.key === key)!
  const units = goalUnits(key, data)
  return Array.from({ length: n }, (_, i) => {
    const [s, e] = periodBounds(t, meta.period as 'week' | 'month', i + 1)
    return units.filter((d) => d >= s && d <= e).length
  })
}

/** Starting goals from your own recent numbers, nudged up a little so they stretch you. */
export function suggestGoals(data: DataSet, settings: Settings, t: DateStr): Record<GoalKey, number> {
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
  const fieldDays = settings.work_days.filter((d) => !settings.warehouse_days.includes(d)).length
  const active = data.clients.filter((c) => c.status === 'active' || c.status === 'at_risk').length
  const multi = multiLineClients(data)
  const visitsAvg = avg(history('visits_week', data, t, 4))
  const leadsAvg = avg(history('leads_week', data, t, 4))
  const acctAvg = avg(history('new_accounts_month', data, t, 3))
  return {
    new_accounts_month: Math.max(2, Math.ceil(acctAvg * 1.25)),
    visits_week: visitsAvg >= 5 ? Math.round(visitsAvg * 1.15) : Math.max(5, Math.round(settings.visits_per_day * fieldDays * 0.6)),
    leads_week: Math.max(3, Math.round(leadsAvg * 1.2)),
    multi_line_clients: Math.min(Math.max(active, multi + 1), multi + Math.max(1, Math.round(active * 0.15))),
  }
}

/** Bonus events: each week/month a goal was met (since you started using goals), dated the day it was reached. */
export function goalBonuses(data: DataSet, settings: Settings): { date: DateStr; label: string }[] {
  const out: { date: DateStr; label: string }[] = []
  for (const g of GOALS) {
    if (g.period === 'standing') continue
    const target = settings.goals?.[g.key]
    if (!target || target <= 0) continue
    const byPeriod = new Map<string, DateStr[]>()
    for (const d of goalUnits(g.key as Exclude<GoalKey, 'multi_line_clients'>, data)) {
      const k = periodBounds(d, g.period)[0]
      byPeriod.set(k, [...(byPeriod.get(k) ?? []), d])
    }
    const since = settings.goals_since ? periodBounds(settings.goals_since, g.period)[0] : null
    for (const [start, units] of byPeriod) if (since && start >= since && units.length >= target) out.push({ date: units[target - 1], label: `Goal hit: ${target} ${g.label.toLowerCase().replace(/ this (week|month)/, '')} (${g.period}ly)` })
  }
  return out
}
