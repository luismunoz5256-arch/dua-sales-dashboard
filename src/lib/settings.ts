import { DEFAULT_SETTINGS } from './constants'
import type { Settings } from './types'

/** Merge saved settings over defaults so newly added settings always have a value. */
export function withDefaults(saved: Partial<Settings> | null | undefined): Settings {
  const s = saved ?? {}
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    priority: {
      ...DEFAULT_SETTINGS.priority,
      ...s.priority,
      weights: { ...DEFAULT_SETTINGS.priority.weights, ...s.priority?.weights },
    },
  }
}
