import type { InputHTMLAttributes, ReactNode } from 'react'
import { addDays, parseDate, today } from '../lib/dates'
import type { DateStr } from '../lib/types'

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-600 mb-1.5 mt-4">{children}</label>
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-base ${className}`} />
}

export function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-base"
    />
  )
}

/** Big tappable single-choice chips. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  labels,
  allowNone = false,
}: {
  options: readonly T[]
  value: T | null
  onChange: (v: T | null) => void
  labels?: Partial<Record<T, string>>
  allowNone?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          onClick={() => onChange(allowNone && value === o ? null : o)}
          className={`min-h-11 px-4 rounded-full text-sm font-semibold border ${
            value === o ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
          }`}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}

export function MultiChips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[]
  value: T[]
  onChange: (v: T[]) => void
  labels?: Partial<Record<T, string>>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            type="button"
            key={o}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`min-h-11 px-4 rounded-full text-sm font-semibold border ${
              on ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {on ? '✓ ' : ''}
            {labels?.[o] ?? o}
          </button>
        )
      })}
    </div>
  )
}

/** Quick date picking: chips for the common choices plus a calendar for anything else. */
export function DateChips({
  value,
  onChange,
  presets,
}: {
  value: DateStr | null
  onChange: (v: DateStr) => void
  presets: { label: string; days: number }[]
}) {
  const t = today()
  const presetDates = presets.map((p) => ({ ...p, date: addDays(t, p.days) }))
  const isPreset = presetDates.some((p) => p.date === value)
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {presetDates.map((p) => (
        <button
          type="button"
          key={p.label}
          onClick={() => onChange(p.date)}
          className={`min-h-11 px-4 rounded-full text-sm font-semibold border ${
            value === p.date ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
          }`}
        >
          {p.label}
        </button>
      ))}
      <label
        className={`relative min-h-11 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${
          value && !isPreset ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
        }`}
      >
        {value && !isPreset ? parseDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Pick date'}
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0"
        />
      </label>
    </div>
  )
}

export const DUE_PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: '2 weeks', days: 14 },
]
export const PAST_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: -1 },
]
