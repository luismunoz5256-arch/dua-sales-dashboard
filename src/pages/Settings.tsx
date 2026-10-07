import { Download, FileUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, Card, SectionTitle, Stepper } from '../components/ui'
import { supabase } from '../lib/backend'
import { exportData } from '../lib/exporters'
import { placesStatus } from '../lib/placesApi'
import { disablePush, enablePush, pushMissing, pushState, sendTestPush, type PushState } from '../lib/push'
import { DEFAULT_FIT_WEIGHTS, FIT_LABEL, type FitWeights } from '../lib/prospects'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { RULE_LABEL, type RuleKey } from '../lib/priority'
import { useStore } from '../lib/store'
import type { Settings } from '../lib/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SettingsPage() {
  const { settings, saveSettings, mode, data, loadSampleData, clearSampleData, remove } = useStore()
  const [address, setAddress] = useState(settings.home_base.address)
  const sampleCount = data.clients.filter((c) => c.is_sample).length

  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

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
      <SecurityCheck />

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
        <p className="text-xs text-slate-500">
          Start of your daily route.{' '}
          {settings.home_base.geocoded_for === settings.home_base.address
            ? '✓ Found on the map.'
            : 'Looking it up on the map… (if this stays, check the address)'}
        </p>
      </Card>

      <SectionTitle>Visits</SectionTitle>
      <Card>
        <Stepper
          label="Visits per field day"
          value={settings.visits_per_day}
          step={1}
          onChange={(v) => saveSettings({ ...settings, visits_per_day: Math.max(1, Math.min(20, v)) })}
        />
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

      <RankingSettings settings={settings} save={saveSettings} />

      <AppSettings settings={settings} save={saveSettings} />

      <FinderSettings settings={settings} save={saveSettings} />

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
      {data.clients.length > 0 && (
        <Card className="p-4 space-y-3 mt-3">
          <p className="text-sm text-slate-600">
            <b>Start fresh</b> erases every client, lead, visit log, follow-up and saved prospect ({data.clients.length} clients now). Your settings,
            areas and goals stay. Download a backup first if you might want anything back.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => exportData('backup', data, settings)}>
              Backup first
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (prompt('This erases ALL clients, leads and history. Type DELETE to confirm.')?.trim().toUpperCase() !== 'DELETE') return
                // Deleting clients also removes their visits, follow-ups and week plans.
                remove('clients', data.clients.map((c) => c.id))
                remove('followups', data.followups.filter((f) => !f.client_id).map((f) => f.id))
                remove('prospects', data.prospects.map((x) => x.id))
                remove('day_status', data.day_status.map((x) => x.id))
              }}
            >
              Start fresh
            </Button>
          </div>
        </Card>
      )}

      <SectionTitle>Your data</SectionTitle>
      <Card className="divide-y divide-slate-100">
        <Link to="/clients/import" className="flex items-center gap-3 px-4 h-14 font-semibold active:bg-slate-50">
          <FileUp size={20} className="text-brand-700" /> Bulk add clients (paste or CSV)
        </Link>
        {(
          [
            ['clients', 'Export clients (CSV)'],
            ['interactions', 'Export interaction log (CSV)'],
            ['followups', 'Export follow-ups (CSV)'],
            ['backup', 'Full backup (JSON)'],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            onClick={() => exportData(kind, data, settings)}
            className="w-full flex items-center gap-3 px-4 h-14 font-semibold text-left active:bg-slate-50"
          >
            <Download size={20} className="text-brand-700" /> {label}
          </button>
        ))}
      </Card>
      <p className="text-xs text-slate-500 mt-2 px-1">The clients export uses the same columns as the import, so you can edit it in a spreadsheet and re-import.</p>

      {supabase && (
        <>
          <SectionTitle>Account</SectionTitle>
          <Button variant="secondary" className="w-full" onClick={() => supabase!.auth.signOut()}>Sign out</Button>
        </>
      )}

      <p className="text-xs text-slate-400 text-center mt-8">
        Dua Sales · your data stays in your own Supabase database.
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


const WEIGHT_ORDER: RuleKey[] = ['followup_due', 'no_order', 'at_risk', 'no_contact', 'new_account', 'stale_lead', 'upsell_gap']

/** Thresholds and weights for the "Visit today" ranking. Each rule adds weight x strength to a client's score. */
function RankingSettings({ settings, save }: { settings: Settings; save: (s: Settings) => void }) {
  const p = settings.priority
  const setP = (patch: Partial<Settings['priority']>) => save({ ...settings, priority: { ...p, ...patch } })
  const setW = (k: RuleKey, v: number) => setP({ weights: { ...p.weights, [k]: Math.max(0, Math.min(5, v)) } })
  return (
    <>
      <div id="ranking" className="scroll-mt-16" />
      <SectionTitle>How "Visit today" is ranked</SectionTitle>
      <Card className="p-4 text-sm text-slate-600 space-y-1">
        <p>Each client gets points from the rules below. Highest score first; the top {settings.visits_per_day} make today's visit list, grouped by area. Tap “Why” on a card to see its points.</p>
        <p>Set a rule to 0 to turn it off.</p>
      </Card>
      <Card className="divide-y divide-slate-100 mt-2">
        {WEIGHT_ORDER.map((k) => (
          <Stepper key={k} label={RULE_LABEL[k]} value={p.weights[k]} step={0.5} onChange={(v) => setW(k, v)} />
        ))}
      </Card>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mt-4 mb-2 px-1">Thresholds</p>
      <Card className="divide-y divide-slate-100">
        <Stepper label="Client: no contact after (days)" value={p.no_contact_days} step={1} onChange={(v) => setP({ no_contact_days: Math.max(1, v) })} />
        <Stepper label="Lead: no contact after (days)" value={p.lead_no_contact_days} step={1} onChange={(v) => setP({ lead_no_contact_days: Math.max(1, v) })} />
        <Stepper label="New account period (days)" value={p.new_account_days} step={5} onChange={(v) => setP({ new_account_days: Math.max(5, v) })} />
      </Card>
      <button onClick={() => setP(DEFAULT_SETTINGS.priority)} className="mt-2 px-1 text-sm font-semibold text-slate-500 underline">
        Reset ranking to defaults
      </button>
    </>
  )
}

/** Prospect Finder: Google key status, today's usage, fit weights and extra chain names. */
function FinderSettings({ settings, save }: { settings: Settings; save: (s: Settings) => void }) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof placesStatus>> | null>(null)
  const [chains, setChains] = useState((settings.extra_chains ?? []).join(', '))
  useEffect(() => {
    placesStatus().then(setStatus)
  }, [])
  const w = { ...DEFAULT_FIT_WEIGHTS, ...settings.fit_weights }
  const setW = (k: keyof FitWeights, v: number) => save({ ...settings, fit_weights: { ...w, [k]: Math.max(0, Math.min(3, v)) } })
  return (
    <>
      <div id="finder" className="scroll-mt-16" />
      <SectionTitle>Prospect Finder</SectionTitle>
      <Card className="p-4 text-sm space-y-1">
        {status == null ? (
          <p className="text-slate-500">Checking Google connection…</p>
        ) : status.configured ? (
          <p>
            ✓ <b>Google search connected.</b> {status.usedToday ?? 0} of {status.limit} searches used today. Repeat searches come from the
            30-day cache and are free.
          </p>
        ) : (
          <p>
            <b>Using sample results.</b> {status.reason?.replace(/\.$/, '')}. Add your Google key in Vercel to search real El Paso businesses (see the setup
            steps in the README).
          </p>
        )}
        <p className="text-xs text-slate-500">Google gives 1,000 searches a month free; this app stops at {status?.limit ?? 60} a day.</p>
      </Card>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mt-4 mb-2 px-1">Fit score weights (×)</p>
      <Card className="divide-y divide-slate-100">
        {(Object.keys(FIT_LABEL) as (keyof FitWeights)[]).map((k) => (
          <Stepper key={k} label={FIT_LABEL[k]} value={w[k]} step={0.5} onChange={(v) => setW(k, v)} />
        ))}
      </Card>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mt-4 mb-2 px-1">Also treat as chains</p>
      <Card className="p-3">
        <textarea
          value={chains}
          onChange={(e) => setChains(e.target.value)}
          onBlur={() => save({ ...settings, extra_chains: chains.split(',').map((x) => x.trim()).filter(Boolean) })}
          rows={2}
          placeholder="e.g. Kiki's, Carlos and Mickey's"
          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base"
        />
        <p className="text-xs text-slate-500 mt-1">Comma separated. 70+ national chains are already flagged.</p>
      </Card>
      <button onClick={() => save({ ...settings, fit_weights: DEFAULT_FIT_WEIGHTS })} className="mt-2 px-1 text-sm font-semibold text-slate-500 underline">
        Reset fit weights
      </button>
    </>
  )
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

/** Notifications, pitch language and installing the app. */
function AppSettings({ settings, save }: { settings: Settings; save: (s: Settings) => void }) {
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const installed = window.matchMedia('(display-mode: standalone)').matches
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(
    () => (window as unknown as { duaInstallPrompt?: InstallPromptEvent }).duaInstallPrompt ?? null,
  )
  useEffect(() => {
    pushState().then(setPush)
  }, [])
  const prefs = { morning: true, midday: true, ...settings.notifications }
  const setPref = (k: 'morning' | 'midday', v: boolean) => save({ ...settings, notifications: { ...prefs, [k]: v } })

  async function toggle() {
    setBusy(true)
    setMsg(null)
    try {
      setPush(push === 'on' ? await disablePush() : await enablePush())
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionTitle>Notifications</SectionTitle>
      <Card className="p-4 space-y-3">
        {push === 'unsupported' && <p className="text-sm">This browser can't show notifications. Use Chrome on Android, ideally with the app installed.</p>}
        {push === 'not_configured' && (
          <p className="text-sm">
            Notifications aren't set up on the server yet.{' '}
            {!supabase
              ? 'Notifications need the online database (they are off in demo mode).'
              : pushMissing.length
              ? <>Missing in Vercel: <b>{pushMissing.join(', ')}</b>. Add them (Production), then redeploy.</>
              : 'The server did not answer. Check that the latest Vercel deployment is Ready.'}
          </p>
        )}
        {push === 'denied' && (
          <p className="text-sm">
            Notifications are blocked for this site. In Chrome: tap the lock icon by the address (or long-press the app icon → App info) → Notifications → Allow.
          </p>
        )}
        {(push === 'on' || push === 'off') && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold">{push === 'on' ? '✓ On for this phone' : 'Off on this phone'}</p>
                <p className="text-xs text-slate-500">Morning summary around 7am · midday reminder around noon if follow-ups are still open.</p>
              </div>
              <Button variant={push === 'on' ? 'secondary' : 'primary'} disabled={busy} onClick={toggle}>
                {push === 'on' ? 'Turn off' : 'Turn on'}
              </Button>
            </div>
            {push === 'on' && (
              <>
                <Toggle label="Morning summary (visits, follow-ups, no-order)" on={prefs.morning} onChange={(v) => setPref('morning', v)} />
                <Toggle label="Midday reminder (only if follow-ups are still due)" on={prefs.midday} onChange={(v) => setPref('midday', v)} />
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setMsg(await sendTestPush())
                    setBusy(false)
                  }}
                >
                  Send a test notification
                </Button>
              </>
            )}
          </>
        )}
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </Card>

      <SectionTitle>Pitch language</SectionTitle>
      <div className="grid grid-cols-3 gap-1 bg-slate-200 rounded-xl p-1">
        {(
          [
            ['en', 'English'],
            ['es', 'Español'],
            ['both', 'Both'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => save({ ...settings, pitch_language: k })}
            className={`h-11 rounded-lg text-sm font-semibold ${settings.pitch_language === k ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2 px-1">Used for upsell pitches on TODAY and opening lines in the Prospect Finder.</p>

      <SectionTitle>App</SectionTitle>
      <Card className="p-4">
        {installed ? (
          <p className="text-sm">✓ Installed on this phone. Long-press the icon for shortcuts: Today, Follow-ups, Find, Leads.</p>
        ) : installEvt ? (
          <Button
            className="w-full"
            onClick={async () => {
              await installEvt.prompt()
              await installEvt.userChoice
              setInstallEvt(null)
            }}
          >
            Install Dua Sales on this phone
          </Button>
        ) : (
          <p className="text-sm">To install: open the Chrome menu ⋮ → <b>Add to Home screen</b> (or <b>Install app</b>).</p>
        )}
      </Card>
    </>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center gap-3 text-left min-h-11">
      <span className="flex-1 text-sm">{label}</span>
      <span className={`w-12 h-7 rounded-full p-1 transition-colors ${on ? 'bg-brand-600' : 'bg-slate-300'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

/**
 * Warns if the database still lets any signed-in account in (security update not installed),
 * or if this login isn't the owner account.
 */
function SecurityCheck() {
  const [state, setState] = useState<'ok' | 'update' | 'not_owner' | null>(null)
  useEffect(() => {
    supabase?.rpc('is_owner').then(({ data, error }) => {
      if (error) setState(error.code === 'PGRST202' || /is_owner/.test(error.message) ? 'update' : null)
      else setState(data === true ? 'ok' : 'not_owner')
    })
  }, [])
  if (state === 'update')
    return (
      <Card className="p-4 mt-3 bg-red-50 border-red-300 text-sm text-red-900">
        <p className="font-bold">Security update needed</p>
        <p className="mt-1">
          Right now any account that signs up to your Supabase project could read your data. In Supabase, open <b>SQL Editor → New query</b>, paste the
          file <b>supabase/migrations/002_owner_only.sql</b> from the project, and press <b>Run</b>. Also make sure "Allow new users to sign up" is off.
        </p>
      </Card>
    )
  if (state === 'not_owner')
    return (
      <Card className="p-4 mt-3 bg-amber-50 border-amber-300 text-sm">
        This login isn't the owner account, so it can't see the data. Sign out and use your main login.
      </Card>
    )
  return null
}
