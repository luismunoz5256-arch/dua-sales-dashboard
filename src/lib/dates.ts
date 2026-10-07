import type { DateStr } from './types.js'

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today(): DateStr {
  return toDateStr(new Date())
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function daysBetween(from: DateStr, to: DateStr): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000)
}

export function daysAgo(s: DateStr | null | undefined): number | null {
  return s ? daysBetween(s, today()) : null
}

/** "Today", "Yesterday", "3d ago", "Oct 2" */
export function relativeDay(s: DateStr | null | undefined): string {
  if (!s) return 'Never'
  const n = daysBetween(s, today())
  if (n === 0) return 'Today'
  if (n === 1) return 'Yesterday'
  if (n === -1) return 'Tomorrow'
  if (n > 1 && n < 30) return `${n}d ago`
  if (n < -1 && n > -30) return `in ${-n}d`
  return parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
