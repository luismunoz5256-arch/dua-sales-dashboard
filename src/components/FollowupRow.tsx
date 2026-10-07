import { AlarmClock, Check, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isNoOrderFlag, useActions } from '../lib/actions'
import { relativeDay, today } from '../lib/dates'
import type { DateStr, Followup } from '../lib/types'
import { DateChips, DUE_PRESETS } from './fields'
import { Sheet } from './Sheet'
import { useToast } from './Toast'

/** One follow-up: Done circle, client + task (tap to open the client), Snooze. */
export function FollowupRow({ f, clientName }: { f: Followup; clientName: string | undefined }) {
  const { setFollowupDone, snoozeFollowup } = useActions()
  const toast = useToast()
  const [snoozing, setSnoozing] = useState(false)
  const t = today()
  const late = f.due_date < t

  return (
    <div className={`flex items-center gap-1 pl-3 ${isNoOrderFlag(f) ? 'bg-amber-50' : ''}`}>
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
      <Link to={f.client_id ? `/clients/${f.client_id}` : '/followups'} className="flex-1 min-w-0 flex items-center gap-2 py-3 pl-2 active:bg-slate-50">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{clientName ?? 'No client'}</p>
          <p className="text-sm text-slate-700">{f.task}</p>
          <p className={`text-xs font-semibold ${late ? 'text-red-600' : f.due_date === t ? 'text-orange-600' : 'text-slate-500'}`}>
            {late ? `Overdue · ${relativeDay(f.due_date)}` : `Due ${relativeDay(f.due_date)}`}
          </p>
        </div>
        <ChevronRight size={18} className="text-slate-300 shrink-0" />
      </Link>
      <button
        onClick={() => setSnoozing(true)}
        aria-label="Snooze"
        className="w-12 h-14 shrink-0 grid place-items-center text-slate-500 active:bg-slate-100 border-l border-slate-100"
      >
        <AlarmClock size={20} />
      </button>
      <Sheet open={snoozing} onClose={() => setSnoozing(false)} title="Snooze until">
        <p className="text-sm text-slate-600 mb-3">{f.task}</p>
        <DateChips
          value={null}
          presets={DUE_PRESETS}
          onChange={(d: DateStr) => {
            const undo = snoozeFollowup(f, d)
            setSnoozing(false)
            toast(`Snoozed to ${relativeDay(d).toLowerCase()}`, [{ label: 'Undo', onClick: undo }])
          }}
        />
      </Sheet>
    </div>
  )
}
