import { Check, ChevronRight, MapPin, MessageSquare, Pencil, Phone, Plus, ShoppingCart } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DateChips, DUE_PRESETS, Label, TextInput } from '../components/fields'
import { LogSheet, QuickLog } from '../components/QuickLog'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Button, Card, Pill, SectionTitle } from '../components/ui'
import { mapsUrl, useActions } from '../lib/actions'
import {
  CONTACT_LABEL, FREQUENCY_LABEL, INTERACTION_LABEL, LEAD_STAGE_LABEL, PRODUCT_LABEL, PRODUCT_LINES, STATUS_LABEL, STATUS_STYLE,
} from '../lib/constants'
import { parseDate, relativeDay, today } from '../lib/dates'
import { useStore } from '../lib/store'
import type { DateStr, Interaction } from '../lib/types'

const money = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)

export default function ClientDetail() {
  const { id } = useParams()
  const { data } = useStore()
  const { setFollowupDone, addFollowup } = useActions()
  const toast = useToast()
  const [editing, setEditing] = useState<Interaction | null>(null)
  const [addingFollowup, setAddingFollowup] = useState(false)

  const client = data.clients.find((c) => c.id === id)
  const history = useMemo(
    () =>
      data.interactions
        .filter((i) => i.client_id === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [data.interactions, id],
  )
  const orders = useMemo(() => data.orders.filter((o) => o.client_id === id), [data.orders, id])
  const followups = useMemo(
    () => data.followups.filter((f) => f.client_id === id && !f.done).sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [data.followups, id],
  )

  if (!client) return <p className="text-center text-slate-500 py-16">Client not found.</p>

  const maps = mapsUrl(client)
  const t = today()
  const missing = PRODUCT_LINES.filter((p) => p !== 'other' && !client.product_lines.includes(p))
  const orderAmount = (i: Interaction) => orders.find((o) => o.date === i.date && o.created_at === i.created_at)?.amount

  return (
    <div>
      <div className="flex items-start gap-2 mt-1">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-tight">{client.business_name}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <Pill className={STATUS_STYLE[client.status]}>{STATUS_LABEL[client.status]}</Pill>
            {client.status === 'lead' && client.lead_stage && (
              <Pill className="bg-sky-50 text-sky-700 border border-sky-200">{LEAD_STAGE_LABEL[client.lead_stage]}</Pill>
            )}
            {client.is_sample && <Pill className="bg-purple-100 text-purple-700">Sample</Pill>}
          </div>
          <p className="text-slate-600 mt-1.5">{[client.contact_name, client.area].filter(Boolean).join(' · ')}</p>
        </div>
        <Link
          to={`/clients/${client.id}/edit`}
          className="h-11 px-4 rounded-xl border border-slate-300 bg-white inline-flex items-center gap-1.5 font-semibold text-sm"
        >
          <Pencil size={16} /> Edit
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <ActionLink href={client.phone ? `tel:${client.phone}` : null} icon={<Phone size={22} />} label="Call" />
        <ActionLink href={client.phone ? `sms:${client.phone}` : null} icon={<MessageSquare size={22} />} label="Text" />
        <ActionLink href={maps} icon={<MapPin size={22} />} label="Map" external />
      </div>

      <SectionTitle>Log</SectionTitle>
      <QuickLog client={client} />

      <SectionTitle
        right={
          <button onClick={() => setAddingFollowup(true)} className="h-9 px-3 rounded-lg text-brand-700 font-semibold text-sm flex items-center gap-1 active:bg-brand-50">
            <Plus size={16} /> Add
          </button>
        }
      >
        Follow-ups
      </SectionTitle>
      {followups.length === 0 ? (
        <p className="text-sm text-slate-500 px-1">None open.</p>
      ) : (
        <Card className="divide-y divide-slate-100">
          {followups.map((f) => {
            const overdue = f.due_date < t
            return (
              <div key={f.id} className="flex items-center gap-3 p-3">
                <button
                  onClick={() => {
                    setFollowupDone(f, true)
                    toast('Follow-up done', [{ label: 'Undo', onClick: () => setFollowupDone(f, false) }])
                  }}
                  aria-label="Mark done"
                  className="w-11 h-11 shrink-0 rounded-full border-2 border-slate-300 grid place-items-center active:bg-brand-100 text-transparent active:text-brand-700"
                >
                  <Check size={22} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{f.task}</p>
                  <p className={`text-xs font-semibold ${overdue ? 'text-red-600' : f.due_date === t ? 'text-orange-600' : 'text-slate-500'}`}>
                    {overdue ? 'Overdue · ' : 'Due '}
                    {relativeDay(f.due_date)}
                  </p>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <SectionTitle>Account</SectionTitle>
      <Card className="p-4 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
        <Info label="Orders" value={client.order_frequency ? FREQUENCY_LABEL[client.order_frequency] : '—'} />
        <Info label="Typical order" value={money(client.typical_order_size)} />
        <Info label="Last order" value={client.last_order_date ? `${relativeDay(client.last_order_date)} · ${money(client.last_order_amount)}` : 'Never'} />
        <Info label="Prefers" value={client.preferred_contact ? CONTACT_LABEL[client.preferred_contact] : '—'} />
        <Info label="Customer since" value={client.account_start_date ? fmt(client.account_start_date) : '—'} />
        <Info label="Phone" value={client.phone ?? '—'} />
        {client.address && (
          <div className="col-span-2">
            <Info label="Address" value={client.address} />
          </div>
        )}
      </Card>

      <SectionTitle>Products</SectionTitle>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {client.product_lines.map((p) => (
            <Pill key={p} className="bg-brand-100 text-brand-800 !text-sm !px-3 !py-1">✓ {PRODUCT_LABEL[p]}</Pill>
          ))}
          {client.product_lines.length === 0 && <span className="text-sm text-slate-500">Not buying yet.</span>}
        </div>
        {client.status !== 'lead' && missing.length > 0 && (
          <p className="text-sm text-slate-600 mt-3">
            <span className="font-semibold text-orange-700">Upsell:</span> {missing.map((p) => PRODUCT_LABEL[p]).join(', ')}
          </p>
        )}
        {client.other_products && <p className="text-sm text-slate-600 mt-2">Other: {client.other_products}</p>}
      </Card>

      {client.notes && (
        <>
          <SectionTitle>Notes</SectionTitle>
          <Card className="p-4 text-sm whitespace-pre-wrap">{client.notes}</Card>
        </>
      )}

      <SectionTitle>History</SectionTitle>
      {history.length === 0 ? (
        <p className="text-sm text-slate-500 px-1">Nothing logged yet. Use the buttons above.</p>
      ) : (
        <Card className="divide-y divide-slate-100">
          {history.map((i) => {
            const amt = i.type === 'order' ? orderAmount(i) : null
            return (
              <button key={i.id} onClick={() => setEditing(i)} className="w-full text-left flex gap-3 p-3 active:bg-slate-50">
                <div className={`w-10 h-10 shrink-0 rounded-full grid place-items-center ${i.type === 'order' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                  {ICON[i.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    {INTERACTION_LABEL[i.type]}
                    {amt != null && ` · ${money(amt)}`}
                    <span className="font-normal text-slate-500"> · {relativeDay(i.date)}</span>
                  </p>
                  {i.notes && <p className="text-sm text-slate-700">{i.notes}</p>}
                  {i.outcome && <p className="text-sm text-slate-500">→ {i.outcome}</p>}
                  {i.next_step && (
                    <p className="text-xs text-brand-700 font-semibold mt-0.5">
                      Next: {i.next_step}
                      {i.next_step_due && ` (${relativeDay(i.next_step_due)})`}
                    </p>
                  )}
                </div>
                <ChevronRight size={18} className="text-slate-300 self-center" />
              </button>
            )
          })}
        </Card>
      )}

      <LogSheet client={client} open={!!editing} interaction={editing} onClose={() => setEditing(null)} />
      <AddFollowupSheet
        open={addingFollowup}
        onClose={() => setAddingFollowup(false)}
        onSave={(task, due) => {
          addFollowup(client.id, task, due)
          toast('Follow-up added')
        }}
      />
    </div>
  )
}

const ICON: Record<Interaction['type'], ReactNode> = {
  visit: <MapPin size={18} />,
  call: <Phone size={18} />,
  text: <MessageSquare size={18} />,
  sample_drop: <span className="text-base">🧺</span>,
  quote_sent: <span className="text-base">📄</span>,
  order: <ShoppingCart size={18} />,
}

const fmt = (d: DateStr) => parseDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function ActionLink({ href, icon, label, external }: { href: string | null; icon: ReactNode; label: string; external?: boolean }) {
  const cls = 'h-14 rounded-xl flex flex-col items-center justify-center text-xs font-semibold'
  if (!href) return <div className={`${cls} bg-slate-100 text-slate-300`}>{icon}{label}</div>
  return (
    <a href={href} target={external ? '_blank' : undefined} rel="noreferrer" className={`${cls} bg-brand-700 text-white active:bg-brand-800`}>
      {icon}
      {label}
    </a>
  )
}

function AddFollowupSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (task: string, due: DateStr) => void }) {
  const [task, setTask] = useState('')
  const [due, setDue] = useState<DateStr | null>(null)
  return (
    <Sheet open={open} onClose={onClose} title="New follow-up">
      <Label>What</Label>
      <TextInput value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Call about weekend order" autoFocus />
      <Label>When</Label>
      <DateChips value={due} onChange={setDue} presets={[{ label: 'Today', days: 0 }, ...DUE_PRESETS]} />
      <Button
        className="w-full mt-6 h-14 text-lg"
        disabled={!task.trim() || !due}
        onClick={() => {
          onSave(task, due!)
          setTask('')
          setDue(null)
          onClose()
        }}
      >
        Save follow-up
      </Button>
    </Sheet>
  )
}
