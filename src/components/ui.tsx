import { ChevronDown, Minus, Phone, Plus } from 'lucide-react'
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white active:bg-brand-800',
  secondary: 'bg-white text-slate-800 border border-slate-300 active:bg-slate-100',
  ghost: 'text-slate-700 active:bg-slate-200',
  danger: 'bg-white text-red-700 border border-red-300 active:bg-red-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`h-12 px-5 rounded-xl font-semibold text-base inline-flex items-center justify-center gap-2 disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-6 mb-2 px-1">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{children}</h2>
      {right}
    </div>
  )
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-10 px-4 rounded-full text-sm font-semibold border ${
        active ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

export function ComingSoon({ step, children }: { step: number; children: ReactNode }) {
  return (
    <Card className="p-5 border-dashed">
      <p className="text-xs font-bold uppercase text-brand-700 mb-1">Coming in step {step}</p>
      <div className="text-slate-600 text-sm space-y-1">{children}</div>
    </Card>
  )
}

/** Round green call button. */
export function CallButton({ phone, name }: { phone: string | null; name: string }) {
  if (!phone) return null
  return (
    <a href={`tel:${phone}`} aria-label={`Call ${name}`} className="w-11 h-11 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center active:bg-brand-100">
      <Phone size={20} />
    </a>
  )
}

/** A "▾ title" toggle that shows its content when tapped. */
export function Collapsible({ title, children, small }: { title: string; children: ReactNode; small?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={small ? 'mt-1' : 'mt-3'}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 font-semibold text-slate-600 ${small ? 'text-xs h-9' : 'text-sm h-10 px-1'}`}
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} /> {title}
      </button>
      {open && <div className={small ? '' : 'mt-1'}>{children}</div>}
    </div>
  )
}

/** Label with − value + buttons. `name` is used for screen readers when the label is generic. */
export function Stepper({ label, name, value, step, onChange }: { label: string; name?: string; value: number; step: number; onChange: (v: number) => void }) {
  const what = name ?? label
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="flex-1 text-sm font-medium">{label}</span>
      <button aria-label={`Less: ${what}`} onClick={() => onChange(value - step)} className="w-11 h-11 rounded-lg border border-slate-300 grid place-items-center active:bg-slate-100">
        <Minus size={18} />
      </button>
      <span className="w-10 text-center font-bold">{value}</span>
      <button aria-label={`More: ${what}`} onClick={() => onChange(value + step)} className="w-11 h-11 rounded-lg border border-slate-300 grid place-items-center active:bg-slate-100">
        <Plus size={18} />
      </button>
    </div>
  )
}
