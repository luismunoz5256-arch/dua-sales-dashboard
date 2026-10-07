import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { today } from '../lib/dates'
import { useStore } from '../lib/store'
import { useScore } from '../lib/useScore'
import { Button } from './ui'

/**
 * Game feedback: a floating "+N" when points are earned, a celebration for a secured client,
 * and a level-up screen. Losing points (Undo) is silent.
 */
export function ScoreFx() {
  const { ready } = useStore()
  const { total, current, events } = useScore()
  const prev = useRef<{ total: number; level: number } | null>(null)
  const [bubble, setBubble] = useState<{ id: number; points: number } | null>(null)
  const [celebrate, setCelebrate] = useState<{ title: string; body: string; emoji: string } | null>(null)

  useEffect(() => {
    if (!ready) return
    const before = prev.current
    prev.current = { total, level: current.level }
    if (!before || total <= before.total) return
    const gained = total - before.total
    // Big jumps come from loading data, bulk import or sample data, not from something you just did.
    if (gained > 500) return
    setBubble({ id: Date.now(), points: gained })
    const timer = setTimeout(() => setBubble(null), 1600)
    const win = gained >= 100 ? events.find((e) => e.kind === 'win' && e.date === today()) : undefined
    const winText = win ? `Client secured: ${win.label.replace('Secured ', '')} (+${win.points}).` : ''
    if (current.level > before.level) {
      setCelebrate({ emoji: current.emoji, title: `Level ${current.level}: ${current.name}!`, body: `${winText} You've reached ${total.toLocaleString()} points. Keep it going.`.trim() })
    } else if (win) {
      setCelebrate({ emoji: '🤝', title: `Client secured! +${win.points}`, body: `${win.label.replace('Secured ', '')} is now an account.` })
    }
    return () => clearTimeout(timer)
  }, [ready, total, current, events])

  return (
    <>
      {bubble && (
        <div key={bubble.id} className="fixed inset-x-0 top-20 z-50 flex justify-center pointer-events-none animate-[float-up_1.6s_ease-out_forwards]">
          <span className="inline-block rounded-full bg-orange-500 text-white font-extrabold text-2xl px-6 py-2 shadow-xl">+{bubble.points} pts</span>
        </div>
      )}
      {celebrate && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-6" onClick={() => setCelebrate(null)}>
          <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full animate-[pop_0.35s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="text-7xl mb-2">{celebrate.emoji}</div>
            <p className="text-2xl font-extrabold">{celebrate.title}</p>
            <p className="text-slate-600 mt-2">{celebrate.body}</p>
            <div className="grid grid-cols-2 gap-2 mt-6">
              <Link to="/score" onClick={() => setCelebrate(null)} className="h-12 rounded-xl border border-slate-300 font-semibold flex items-center justify-center">
                See score
              </Link>
              <Button onClick={() => setCelebrate(null)}>Nice!</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Slim level bar for the top of TODAY. */
export function LevelBar() {
  const { total, current, next, progress, today, streak } = useScore()
  return (
    <Link to="/score" className="block bg-white rounded-2xl border border-slate-200 shadow-sm px-3 py-2.5 active:bg-slate-50">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{current.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-bold">Lv {current.level} · {current.name}</span>
            <span className="text-xs text-slate-500 ml-auto">{total.toLocaleString()} / {next.min.toLocaleString()}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      </div>
      <div className="flex gap-3 text-xs font-semibold text-slate-600 mt-1.5 pl-9">
        <span className="text-orange-700">+{today} today</span>
        {streak > 0 && <span>🔥 {streak}-day streak</span>}
        <span className="ml-auto text-slate-400">{(next.min - total).toLocaleString()} to {next.emoji} {next.name}</span>
      </div>
    </Link>
  )
}
