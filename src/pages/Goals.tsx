import { Minus, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useToast } from '../components/Toast'
import { Button, Card, SectionTitle } from '../components/ui'
import { daysBetween, today } from '../lib/dates'
import { GOAL_BONUS, GOALS, history, periodBounds, progress, suggestGoals, type GoalKey } from '../lib/goals'
import { useStore } from '../lib/store'

export default function GoalsPage() {
  const { data, settings, saveSettings } = useStore()
  const toast = useToast()
  const t = today()
  const suggested = useMemo(() => suggestGoals(data, settings, t), [data, settings, t])
  const goals = settings.goals
  const hasGoals = !!goals && Object.keys(goals).length > 0

  const since = settings.goals_since ?? t
  const setGoal = (key: GoalKey, v: number) => saveSettings({ ...settings, goals_since: since, goals: { ...suggested, ...goals, [key]: Math.max(1, v) } })

  return (
    <div>
      {!hasGoals && (
        <Card className="p-4 mt-2 bg-orange-50 border-orange-200">
          <p className="font-bold">Suggested starting goals</p>
          <p className="text-sm text-slate-700 mt-1">
            Based on your last few weeks, nudged up a little so they stretch you. Adjust any of them with − and +. Hitting a weekly or monthly goal
            earns <b>+{GOAL_BONUS} pts</b>.
          </p>
          <Button
            className="w-full mt-3"
            onClick={() => {
              saveSettings({ ...settings, goals_since: since, goals: suggested })
              toast('Goals set. Good luck!')
            }}
          >
            Start with these goals
          </Button>
        </Card>
      )}

      <div className="space-y-3 mt-3">
        {GOALS.map((g) => {
          const target = goals?.[g.key] ?? suggested[g.key]
          const value = progress(g.key, data, t)
          const pct = Math.min(1, value / target)
          const done = value >= target
          const past = g.key === 'multi_line_clients' ? null : history(g.key, data, t, 4)
          const left =
            g.period === 'standing' ? null : daysBetween(t, periodBounds(t, g.period)[1]) + 1
          return (
            <Card key={g.key} className={`p-4 ${done ? 'border-brand-600' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{g.label}</p>
                  <p className="text-xs text-slate-500">
                    {g.hint}
                    {left != null && ` · ${left} day${left === 1 ? '' : 's'} left`}
                  </p>
                </div>
                {done && <span className="text-sm font-bold text-brand-700">✓ Done{g.period !== 'standing' && hasGoals ? ` +${GOAL_BONUS}` : ''}</span>}
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className={`text-3xl font-extrabold ${done ? 'text-brand-700' : ''}`}>{value}</span>
                <span className="text-slate-500 font-semibold">/ {target}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${done ? 'bg-brand-600' : 'bg-gradient-to-r from-orange-400 to-orange-600'}`}
                  style={{ width: `${Math.round(pct * 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-slate-500 flex-1">
                  {past ? `Last ${g.period === 'week' ? '4 weeks' : '4 months'}: ${past.join(', ')}` : 'Counts your accounts right now'}
                </span>
                <span className="text-xs font-semibold text-slate-500">Goal</span>
                <button aria-label={`Lower ${g.label}`} onClick={() => setGoal(g.key, target - 1)} className="w-10 h-10 rounded-lg border border-slate-300 grid place-items-center active:bg-slate-100">
                  <Minus size={16} />
                </button>
                <span className="w-7 text-center font-bold">{target}</span>
                <button aria-label={`Raise ${g.label}`} onClick={() => setGoal(g.key, target + 1)} className="w-10 h-10 rounded-lg border border-slate-300 grid place-items-center active:bg-slate-100">
                  <Plus size={16} />
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      <SectionTitle>About these goals</SectionTitle>
      <Card className="p-4 text-sm text-slate-600 space-y-1.5">
        <p>Weeks run Monday to Sunday. Visits count once per client per day.</p>
        <p>"Orders per client" isn't tracked because orders live in QuickBooks. It can come back if you import QuickBooks orders later.</p>
        {hasGoals && (
          <button
            className="font-semibold text-slate-500 underline"
            onClick={() => {
              saveSettings({ ...settings, goals: suggested })
              toast('Goals reset to suggestions')
            }}
          >
            Reset to suggested goals
          </button>
        )}
      </Card>
    </div>
  )
}
