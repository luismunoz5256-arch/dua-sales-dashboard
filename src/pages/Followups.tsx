import { Check, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Card, SectionTitle } from '../components/ui'
import { isNoOrderFlag, useActions } from '../lib/actions'
import { relativeDay, today } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Followup } from '../lib/types'

/** Every open follow-up: overdue, due today, then upcoming. */
export default function FollowupsPage() {
  const { data } = useStore()
  const { setFollowupDone } = useActions()
  const toast = useToast()
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
            <Card className="divide-y divide-slate-100">
              {list.map((f) => (
                <div key={f.id} className={`flex items-center gap-1 pl-3 ${isNoOrderFlag(f) ? 'bg-amber-50' : ''}`}>
                  <button
                    onClick={() => {
                      setFollowupDone(f, true)
                      toast('Follow-up done', [{ label: 'Undo', onClick: () => setFollowupDone(f, false) }])
                    }}
                    aria-label="Mark done"
                    className="w-11 h-11 shrink-0 rounded-full border-2 border-slate-300 grid place-items-center text-transparent active:bg-brand-100 active:text-brand-700"
                  >
                    <Check size={22} />
                  </button>
                  <Link
                    to={f.client_id ? `/clients/${f.client_id}` : '#'}
                    className="flex-1 min-w-0 flex items-center gap-2 py-3 pl-2 pr-3 active:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{f.client_id ? names.get(f.client_id) : 'No client'}</p>
                      <p className="text-sm text-slate-700">{f.task}</p>
                      <p className={`text-xs font-semibold ${f.due_date < t ? 'text-red-600' : f.due_date === t ? 'text-orange-600' : 'text-slate-500'}`}>
                        {f.due_date < t ? `Overdue · ${relativeDay(f.due_date)}` : `Due ${relativeDay(f.due_date)}`}
                      </p>
                    </div>
                    {f.client_id && <ChevronRight size={18} className="text-slate-300" />}
                  </Link>
                </div>
              ))}
            </Card>
          </div>
        ))}
    </div>
  )
}
