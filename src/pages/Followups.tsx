import { useMemo } from 'react'
import { FollowupRow } from '../components/FollowupRow'
import { Card, SectionTitle } from '../components/ui'
import { today } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Followup } from '../lib/types'

/** Every open follow-up: overdue, due today, then upcoming. */
export default function FollowupsPage() {
  const { data } = useStore()
  const t = today()
  const names = useMemo(() => new Map(data.clients.map((c) => [c.id, c.business_name])), [data.clients])

  const open = data.followups.filter((f) => !f.done).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const groups: [string, Followup[]][] = [
    ['Overdue', open.filter((f) => f.due_date < t)],
    ['Due today', open.filter((f) => f.due_date === t)],
    ['Upcoming', open.filter((f) => f.due_date > t)],
  ]

  if (!open.length) return <p className="text-center text-slate-500 py-16">No open follow-ups. 🎉</p>

  return (
    <div>
      {groups
        .filter(([, list]) => list.length)
        .map(([title, list]) => (
          <div key={title}>
            <SectionTitle>
              {title} ({list.length})
            </SectionTitle>
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {list.map((f) => (
                <FollowupRow key={f.id} f={f} clientName={f.client_id ? names.get(f.client_id) : undefined} />
              ))}
            </Card>
          </div>
        ))}
    </div>
  )
}
