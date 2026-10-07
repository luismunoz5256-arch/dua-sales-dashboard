import { ChevronDown, ChevronRight, Phone, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChoiceChips, Label, MultiChips, TextInput } from '../components/fields'
import { QuickLog } from '../components/QuickLog'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Button, Card, Pill } from '../components/ui'
import { useActions } from '../lib/actions'
import { FREQUENCIES, FREQUENCY_LABEL, LEAD_STAGE_LABEL, PRODUCT_LABEL, PRODUCT_LINES } from '../lib/constants'
import { daysBetween, relativeDay, today } from '../lib/dates'
import { lastContactMap } from '../lib/priority'
import { clientSize, SIZE_LABEL, WIN_POINTS } from '../lib/score'
import { useStore } from '../lib/store'
import type { Client, Frequency, LeadStage, ProductLine } from '../lib/types'

const STAGES: LeadStage[] = ['new', 'contacted', 'sampled_quoted', 'won', 'lost']
const OPEN: LeadStage[] = ['new', 'contacted', 'sampled_quoted']
const NEXT: Partial<Record<LeadStage, LeadStage>> = { new: 'contacted', contacted: 'sampled_quoted', sampled_quoted: 'won' }
const STAGE_COLOR: Record<LeadStage, string> = {
  new: 'bg-sky-400',
  contacted: 'bg-sky-600',
  sampled_quoted: 'bg-orange-500',
  won: 'bg-brand-600',
  lost: 'bg-slate-400',
}
const LOST_REASONS = ['Price', 'Has a supplier', 'Not interested', 'Closed / moved', 'No response']

/** Leads and the accounts you won from them (lead_stage stays "won" after they become active). */
function stageOf(c: Client): LeadStage | null {
  if (c.status === 'lead') return c.lead_stage ?? 'new'
  return c.lead_stage === 'won' ? 'won' : null
}

let savedStage: LeadStage = 'new'

export default function LeadsPage() {
  const { data } = useStore()
  const { saveClient } = useActions()
  const toast = useToast()
  const [stage, setStageState] = useState<LeadStage>(savedStage)
  const setStage = (s: LeadStage) => setStageState((savedStage = s))
  const [winning, setWinning] = useState<Client | null>(null)
  const [losing, setLosing] = useState<Client | null>(null)
  const t = today()

  const last = useMemo(() => lastContactMap(data), [data])
  const byStage = useMemo(() => {
    const m = new Map<LeadStage, Client[]>(STAGES.map((s) => [s, []]))
    for (const c of data.clients) {
      const s = stageOf(c)
      if (s) m.get(s)!.push(c)
    }
    // Open stages: longest without contact first. Won/lost: most recent first.
    for (const s of OPEN) m.get(s)!.sort((a, b) => (last.get(a.id) ?? '').localeCompare(last.get(b.id) ?? ''))
    m.get('won')!.sort((a, b) => (b.account_start_date ?? '').localeCompare(a.account_start_date ?? ''))
    m.get('lost')!.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return m
  }, [data.clients, last])

  const openTotal = OPEN.reduce((s, k) => s + byStage.get(k)!.length, 0)
  const nextFollowup = (id: string) =>
    data.followups.filter((f) => f.client_id === id && !f.done).sort((a, b) => a.due_date.localeCompare(b.due_date))[0]

  function advance(c: Client) {
    const to = NEXT[stageOf(c)!]
    if (!to) return
    if (to === 'won') return setWinning(c)
    saveClient({ ...c, lead_stage: to })
    toast(`${c.business_name} → ${LEAD_STAGE_LABEL[to]}`, [{ label: 'Undo', onClick: () => saveClient(c) }])
  }

  const list = byStage.get(stage)!

  return (
    <div className="pb-20">
      {/* Funnel bar */}
      <div className="flex h-3 rounded-full overflow-hidden mt-2 bg-slate-100">
        {OPEN.map((s) => {
          const n = byStage.get(s)!.length
          return n ? <div key={s} className={STAGE_COLOR[s]} style={{ flex: n }} /> : null
        })}
      </div>
      <p className="text-xs text-slate-500 mt-1 px-1">
        {openTotal} open lead{openTotal === 1 ? '' : 's'} · {byStage.get('won')!.length} won · {byStage.get('lost')!.length} lost
      </p>

      <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`shrink-0 h-10 px-4 rounded-full text-sm font-semibold border flex items-center gap-1.5 ${
              stage === s ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${STAGE_COLOR[s]}`} />
            {LEAD_STAGE_LABEL[s]} ({byStage.get(s)!.length})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((c) => {
          const lc = last.get(c.id)
          const f = nextFollowup(c.id)
          const next = NEXT[stage]
          return (
            <LeadCard key={c.id} c={c}>
              <p className="text-sm text-slate-600 mt-1">
                {[
                  c.area,
                  stage === 'won'
                    ? c.account_start_date && `won ${relativeDay(c.account_start_date).toLowerCase()}`
                    : lc
                      ? `last contact ${relativeDay(lc).toLowerCase()}`
                      : 'never contacted',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {OPEN.includes(stage) && lc && daysBetween(lc, t) >= 14 && <span className="text-red-600 font-semibold"> · going cold</span>}
              </p>
              {f && (
                <p className={`text-xs font-semibold mt-0.5 ${f.due_date <= t ? 'text-orange-700' : 'text-slate-500'}`}>
                  Next: {f.task} ({relativeDay(f.due_date).toLowerCase()})
                </p>
              )}
              {stage === 'lost' && c.notes?.includes('Lost:') && (
                <p className="text-xs text-slate-500 mt-0.5">{c.notes.split('\n').reverse().find((l) => l.startsWith('Lost:'))}</p>
              )}

              {next && (
                <div className="grid grid-cols-[1fr_auto] gap-2 mt-2.5">
                  <button
                    onClick={() => advance(c)}
                    className={`h-12 rounded-xl font-semibold text-sm active:opacity-80 ${
                      next === 'won' ? 'bg-brand-700 text-white' : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}
                  >
                    {next === 'won' ? '🎉 Mark as won' : `Move to ${LEAD_STAGE_LABEL[next]} →`}
                  </button>
                  <button onClick={() => setLosing(c)} className="h-12 px-4 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 active:bg-slate-100">
                    Lost
                  </button>
                </div>
              )}
              {stage === 'lost' && (
                <button
                  onClick={() => {
                    saveClient({ ...c, lead_stage: 'contacted' })
                    toast(`${c.business_name} reopened`)
                  }}
                  className="h-11 w-full mt-2 rounded-xl border border-slate-300 text-sm font-semibold active:bg-slate-100"
                >
                  Reopen lead
                </button>
              )}
              {OPEN.includes(stage) && <LogToggle c={c} />}
            </LeadCard>
          )
        })}
        {list.length === 0 && <p className="text-center text-slate-500 py-10">No {LEAD_STAGE_LABEL[stage].toLowerCase()} leads.</p>}
      </div>

      <Link
        to="/clients/new?status=lead"
        aria-label="Add lead"
        className="fixed right-4 z-10 w-16 h-16 rounded-full bg-orange-500 text-white shadow-lg grid place-items-center active:bg-orange-600"
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={30} />
      </Link>

      <WonSheet
        c={winning}
        onClose={() => setWinning(null)}
        onSave={(c) => {
          saveClient(c)
          setWinning(null)
          setStage('won')
        }}
      />
      <LostSheet
        c={losing}
        onClose={() => setLosing(null)}
        onSave={(c, reason) => {
          const line = `Lost: ${reason} (${t})`
          saveClient({ ...c, lead_stage: 'lost', notes: c.notes ? `${c.notes}\n${line}` : line })
          toast(`${c.business_name} marked lost`, [{ label: 'Undo', onClick: () => saveClient(c) }])
          setLosing(null)
        }}
      />
    </div>
  )
}

function LeadCard({ c, children }: { c: Client; children: ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <Link to={`/clients/${c.id}`} className="flex-1 min-w-0 active:opacity-70">
          <p className="font-bold">
            {c.business_name}
            {c.is_sample && <Pill className="bg-purple-100 text-purple-700 ml-1.5 align-middle">Sample</Pill>}
          </p>
          {c.contact_name && <p className="text-xs text-slate-500">{c.contact_name}</p>}
        </Link>
        {c.phone && (
          <a href={`tel:${c.phone}`} aria-label={`Call ${c.business_name}`} className="w-11 h-11 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center active:bg-brand-100">
            <Phone size={20} />
          </a>
        )}
        <Link to={`/clients/${c.id}`} aria-label="Open" className="w-8 h-11 grid place-items-center text-slate-300">
          <ChevronRight size={18} />
        </Link>
      </div>
      {children}
    </Card>
  )
}

function LogToggle({ c }: { c: Client }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs font-semibold text-slate-600 h-9">
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} /> Log
      </button>
      {open && <QuickLog client={c} size="sm" />}
    </div>
  )
}

/** Capture how big the new account is (for the size bonus), then make it an active client. */
function WonSheet({ c, onClose, onSave }: { c: Client | null; onClose: () => void; onSave: (c: Client) => void }) {
  const [freq, setFreq] = useState<Frequency | null>(null)
  const [amount, setAmount] = useState('')
  const [lines, setLines] = useState<ProductLine[]>([])
  const [forId, setForId] = useState<string | null>(null)
  if (c && forId !== c.id) {
    setForId(c.id)
    setFreq(c.order_frequency)
    setAmount(c.typical_order_size != null ? String(c.typical_order_size) : '')
    setLines(c.product_lines)
  }
  const n = parseFloat(amount.replace(/[$,]/g, ''))
  const typical = Number.isFinite(n) ? n : null
  const size = clientSize({ typical_order_size: typical, order_frequency: freq })
  return (
    <Sheet open={!!c} onClose={onClose} title={c ? `Won · ${c.business_name}` : ''}>
      <p className="text-sm text-slate-600">Tell the app a little about the new account. Bigger accounts earn a bigger bonus.</p>
      <Label>How often will they order?</Label>
      <ChoiceChips options={FREQUENCIES} value={freq} onChange={setFreq} labels={FREQUENCY_LABEL} allowNone />
      <Label>Typical order $</Label>
      <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 350" />
      <Label>What they'll buy</Label>
      <MultiChips options={PRODUCT_LINES} value={lines} onChange={setLines} labels={PRODUCT_LABEL} />
      <p className="text-sm font-semibold text-brand-700 mt-4">
        {size === 'unknown' ? `Worth +${WIN_POINTS.unknown} pts (add frequency and order size for a bigger bonus)` : `${SIZE_LABEL[size]} account: +${WIN_POINTS[size]} pts`}
      </p>
      <Button
        className="w-full mt-4 h-14 text-lg"
        onClick={() =>
          c &&
          onSave({
            ...c,
            status: 'active',
            lead_stage: 'won',
            account_start_date: c.account_start_date ?? today(),
            order_frequency: freq,
            typical_order_size: typical,
            product_lines: lines,
          })
        }
      >
        🎉 Make it an account
      </Button>
    </Sheet>
  )
}

function LostSheet({ c, onClose, onSave }: { c: Client | null; onClose: () => void; onSave: (c: Client, reason: string) => void }) {
  const [reason, setReason] = useState<string | null>(null)
  const [other, setOther] = useState('')
  return (
    <Sheet open={!!c} onClose={onClose} title={c ? `Lost · ${c.business_name}` : ''}>
      <Label>Why?</Label>
      <ChoiceChips options={LOST_REASONS} value={reason} onChange={setReason} allowNone />
      <TextInput className="mt-3" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Or a short note" />
      <p className="text-xs text-slate-500 mt-2">Saved in the client's notes. You can reopen it any time from the Lost tab.</p>
      <Button
        variant="danger"
        className="w-full mt-5"
        disabled={!reason && !other.trim()}
        onClick={() => {
          c && onSave(c, [reason, other.trim()].filter(Boolean).join(': '))
          setReason(null)
          setOther('')
        }}
      >
        Mark as lost
      </Button>
    </Sheet>
  )
}
