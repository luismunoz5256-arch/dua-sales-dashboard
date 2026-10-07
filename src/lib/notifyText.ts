import { isNoOrderFlag } from './constants'
import { planDays, weekDates } from './plan'
import { dayKind } from './priority'
import { planRoute } from './route'
import type { DataSet, DateStr, Settings } from './types'

export interface PushMessage {
  title: string
  body: string
  url: string
  tag: string
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

/** The 7:30am summary. Returns null on a day off with nothing due. */
export function morningMessage(data: DataSet, settings: Settings, t: DateStr): PushMessage | null {
  const open = data.followups.filter((f) => !f.done)
  const due = open.filter((f) => f.due_date <= t)
  const late = due.filter((f) => f.due_date < t).length
  const noOrder = new Set(open.filter((f) => f.client_id && isNoOrderFlag(f)).map((f) => f.client_id)).size
  const kind = dayKind(t, settings, data)

  const parts: string[] = []
  if (due.length) parts.push(`${plural(due.length, 'follow-up')} due${late ? ` (${late} overdue)` : ''}`)
  if (noOrder) parts.push(`${noOrder} hasn't ordered`)

  if (kind === 'field') {
    const plan = planDays(data, settings, [...new Set([t, ...weekDates(t)])].sort(), t)
    const visits = plan.days.find((d) => d.date === t)?.visits ?? []
    const home = settings.home_base.lat != null && settings.home_base.lng != null ? { lat: settings.home_base.lat, lng: settings.home_base.lng } : null
    const areas = planRoute(home, visits).map((g) => g.area)
    return {
      title: visits.length ? `Good morning! ${plural(visits.length, 'visit')} today` : 'Good morning!',
      body: [areas.length ? areas.join(' → ') : 'No visits needed today', ...parts].join(' · '),
      url: '/',
      tag: 'morning',
    }
  }
  if (kind === 'warehouse') {
    return { title: 'Warehouse day', body: parts.length ? `${parts.join(' · ')}. Good day for calls and texts.` : 'Nothing due. Enjoy the quiet day.', url: '/', tag: 'morning' }
  }
  return due.length ? { title: 'Day off', body: `${parts.join(' · ')}.`, url: '/followups', tag: 'morning' } : null
}

/** The midday nudge: only when follow-ups due today (or overdue) are still open. */
export function middayMessage(data: DataSet, t: DateStr): PushMessage | null {
  const names = new Map(data.clients.map((c) => [c.id, c.business_name]))
  const due = data.followups.filter((f) => !f.done && f.due_date <= t).sort((a, b) => a.due_date.localeCompare(b.due_date))
  if (!due.length) return null
  const lines = due.slice(0, 2).map((f) => `${f.client_id ? `${names.get(f.client_id)}: ` : ''}${f.task}`)
  return {
    title: `${plural(due.length, 'follow-up')} still due`,
    body: lines.join(' · ') + (due.length > 2 ? ` (+${due.length - 2} more)` : ''),
    url: '/followups',
    tag: 'midday',
  }
}
