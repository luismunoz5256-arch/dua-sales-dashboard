import { Minus, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Card, SectionTitle } from '../components/ui'
import { supabase } from '../lib/backend'
import { useStore } from '../lib/store'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SettingsPage() {
  const { settings, saveSettings, mode, data, loadSampleData, clearSampleData } = useStore()
  const [address, setAddress] = useState(settings.home_base.address)
  const sampleCount = data.clients.filter((c) => c.is_sample).length

  const toggle = (list: number[], d: number) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort())

  return (
    <div>
      <Card className="p-4 mt-2">
        {mode === 'demo' ? (
          <>
            <p className="font-semibold">Demo mode</p>
            <p className="text-sm text-slate-600 mt-1">
              Data is saved only in this browser. Once your Supabase database is connected, everything is stored online and
              reachable from any device with your login.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">Connected to your online database</p>
            <p className="text-sm text-slate-600 mt-1">Signed in. Data syncs to Supabase.</p>
          </>
        )}
      </Card>

      <SectionTitle>Home base</SectionTitle>
      <Card className="p-4 space-y-3">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border border-slate-300 text-base"
        />
        {address !== settings.home_base.address && (
          <Button onClick={() => saveSettings({ ...settings, home_base: { ...settings.home_base, address } })}>
            Save address
          </Button>
        )}
        <p className="text-xs text-slate-500">Used as the start of your route and for "distance from home" searches.</p>
      </Card>

      <SectionTitle>Visits per field day</SectionTitle>
      <Card className="p-4 flex items-center justify-between">
        <StepButton label="Fewer" onClick={() => saveSettings({ ...settings, visits_per_day: Math.max(1, settings.visits_per_day - 1) })}>
          <Minus size={22} />
        </StepButton>
        <span className="text-3xl font-bold">{settings.visits_per_day}</span>
        <StepButton label="More" onClick={() => saveSettings({ ...settings, visits_per_day: Math.min(20, settings.visits_per_day + 1) })}>
          <Plus size={22} />
        </StepButton>
      </Card>

      <SectionTitle>Work days</SectionTitle>
      <DayPicker
        days={settings.work_days}
        onToggle={(d) => saveSettings({ ...settings, work_days: toggle(settings.work_days, d) })}
      />

      <SectionTitle>Usual warehouse days</SectionTitle>
      <DayPicker
        days={settings.warehouse_days}
        tone="amber"
        onToggle={(d) => saveSettings({ ...settings, warehouse_days: toggle(settings.warehouse_days, d) })}
      />
      <p className="text-xs text-slate-500 mt-2 px-1">
        No visits get planned on these days. You can also flip any single day in the Week plan.
      </p>

      <SectionTitle>Areas</SectionTitle>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {settings.areas.map((a) => (
            <span key={a} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{a}</span>
          ))}
        </div>
      </Card>

      <SectionTitle>Sample data</SectionTitle>
      <Card className="p-4 space-y-3">
        <p className="text-sm text-slate-600">
          {sampleCount > 0
            ? `${sampleCount} sample accounts are loaded. Remove them before entering your real accounts.`
            : 'No sample accounts loaded.'}
        </p>
        {sampleCount > 0 ? (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => confirm(`Remove ${sampleCount} sample accounts and their history?`) && clearSampleData()}
          >
            Remove sample data
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" onClick={loadSampleData}>Load sample data</Button>
        )}
      </Card>

      {supabase && (
        <>
          <SectionTitle>Account</SectionTitle>
          <Button variant="secondary" className="w-full" onClick={() => supabase!.auth.signOut()}>Sign out</Button>
        </>
      )}

      <p className="text-xs text-slate-400 text-center mt-8">
        Priority weights, CSV import/export and notifications arrive in later steps.
      </p>
    </div>
  )
}

function DayPicker({ days, onToggle, tone = 'green' }: { days: number[]; onToggle: (d: number) => void; tone?: 'green' | 'amber' }) {
  const on = tone === 'green' ? 'bg-brand-700 text-white border-brand-700' : 'bg-amber-500 text-white border-amber-500'
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAYS.map((label, d) => (
        <button
          key={d}
          onClick={() => onToggle(d)}
          className={`h-12 rounded-xl text-sm font-semibold border ${days.includes(d) ? on : 'bg-white text-slate-600 border-slate-300'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="w-14 h-14 grid place-items-center rounded-xl border border-slate-300 bg-white text-slate-800 active:bg-slate-100"
    >
      {children}
    </button>
  )
}
