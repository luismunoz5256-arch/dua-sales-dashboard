import { useMemo } from 'react'
import { today } from './dates'
import { levelFor, scoreEvents, streak, summarize } from './score'
import { useStore } from './store'

export function useScore() {
  const { data, settings } = useStore()
  const t = today()
  return useMemo(() => {
    const events = scoreEvents(data, settings)
    const s = summarize(events, t)
    return { events, ...s, ...levelFor(s.total), streak: streak(data, settings, t) }
  }, [data, settings, t])
}
