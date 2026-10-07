import { Lock } from 'lucide-react'
import { Card, SectionTitle } from '../components/ui'
import { INTERACTION_LABEL } from '../lib/constants'
import { relativeDay } from '../lib/dates'
import { ACTION_POINTS, FOLLOWUP_POINTS, levelInfo, SIZE_LABEL, WIN_POINTS, type ClientSize, type EventKind } from '../lib/score'
import { useScore } from '../lib/useScore'

const KIND_LABEL: Record<EventKind, string> = { ...INTERACTION_LABEL, visit: 'Visits', call: 'Calls', text: 'Texts', sample_drop: 'Sample drops', quote_sent: 'Quotes sent', followup: 'Follow-ups done', win: 'Clients secured' }

export default function ScorePage() {
  const { total, current, next, progress, today, week, weekEvents, events, streak } = useScore()
  const byKind = new Map<EventKind, { n: number; pts: number }>()
  for (const e of weekEvents) {
    const k = byKind.get(e.kind) ?? { n: 0, pts: 0 }
    byKind.set(e.kind, { n: k.n + 1, pts: k.pts + e.points })
  }
  const ladder = Array.from({ length: Math.max(10, current.level + 2) }, (_, i) => levelInfo(i + 1))

  return (
    <div>
      <Card className="p-5 mt-2 text-center bg-gradient-to-b from-orange-50 to-white">
        <div className="text-6xl">{current.emoji}</div>
        <p className="text-sm font-semibold text-orange-700 mt-1">Level {current.level}</p>
        <p className="text-2xl font-extrabold">{current.name}</p>
        <p className="text-4xl font-extrabold mt-2">{total.toLocaleString()} <span className="text-base font-semibold text-slate-500">pts</span></p>
        <div className="h-3 rounded-full bg-slate-200 mt-3 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="text-sm text-slate-600 mt-1.5">
          {(next.min - total).toLocaleString()} pts to {next.emoji} <b>{next.name}</b>
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <Mini label="Today" value={`+${today}`} />
        <Mini label="This week" value={`+${week}`} />
        <Mini label="Streak" value={streak ? `🔥 ${streak}` : '—'} />
      </div>

      <SectionTitle>This week</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {byKind.size === 0 && <p className="p-3 text-sm text-slate-500">No points yet this week. Log a visit to get started.</p>}
        {[...byKind.entries()]
          .sort((a, b) => b[1].pts - a[1].pts)
          .map(([k, v]) => (
            <div key={k} className="flex items-center px-3 py-2.5 text-sm">
              <span className="flex-1">{KIND_LABEL[k]} × {v.n}</span>
              <span className="font-bold text-orange-700">+{v.pts}</span>
            </div>
          ))}
      </Card>

      <SectionTitle>How to earn</SectionTitle>
      <Card className="p-3 text-sm space-y-1.5">
        {(['visit', 'call', 'text', 'sample_drop', 'quote_sent'] as const).map((k) => (
          <Row key={k} label={KIND_LABEL[k].replace(/s$/, '').replace('Quotes sent', 'Quote sent')} pts={ACTION_POINTS[k]} />
        ))}
        <Row label="Follow-up done" pts={FOLLOWUP_POINTS} />
        <div className="border-t border-slate-100 pt-1.5 mt-1.5">
          <p className="font-semibold">Secure a client (lead → active)</p>
          {(['small', 'medium', 'large'] as ClientSize[]).map((s) => (
            <Row key={s} label={`${SIZE_LABEL[s]}${s === 'small' ? ' (under $300/wk) or size not set' : s === 'medium' ? ' ($300–999/wk)' : ' ($1,000+/wk)'}`} pts={WIN_POINTS[s]} />
          ))}
          <p className="text-xs text-slate-500 mt-1">Size = typical order × how often they order. Fill both in on the client to get the size bonus.</p>
        </div>
        <p className="text-xs text-slate-500 border-t border-slate-100 pt-1.5">Each kind of action counts once per client per day. Undo takes the points back.</p>
      </Card>

      <SectionTitle>Levels</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {ladder.map((l) => {
          const reached = l.level <= current.level
          return (
            <div key={l.level} className={`flex items-center gap-3 px-3 py-2 ${l.level === current.level ? 'bg-orange-50' : ''}`}>
              <span className={`text-2xl ${reached ? '' : 'grayscale opacity-40'}`}>{l.emoji}</span>
              <span className={`flex-1 font-semibold ${reached ? '' : 'text-slate-400'}`}>
                {l.level}. {l.name}
              </span>
              <span className="text-sm text-slate-500">{l.min.toLocaleString()}</span>
              {!reached && <Lock size={14} className="text-slate-300" />}
            </div>
          )
        })}
      </Card>

      <SectionTitle>Recent points</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {events.slice(0, 25).map((e, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="flex-1 min-w-0 truncate">{e.label}</span>
            <span className="text-xs text-slate-500">{relativeDay(e.date)}</span>
            <span className={`font-bold w-12 text-right ${e.kind === 'win' ? 'text-brand-700' : 'text-orange-700'}`}>+{e.points}</span>
          </div>
        ))}
        {events.length === 0 && <p className="p-3 text-sm text-slate-500">Nothing yet.</p>}
      </Card>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-xs text-slate-500 font-semibold">{label}</div>
    </Card>
  )
}

function Row({ label, pts }: { label: string; pts: number }) {
  return (
    <div className="flex">
      <span className="flex-1">{label}</span>
      <span className="font-bold text-orange-700">+{pts}</span>
    </div>
  )
}
