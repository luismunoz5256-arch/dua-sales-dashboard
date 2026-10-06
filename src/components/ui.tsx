import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
