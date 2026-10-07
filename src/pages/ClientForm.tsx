import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChoiceChips, Label, MultiChips, TextArea, TextInput } from '../components/fields'
import { useToast } from '../components/Toast'
import { Button } from '../components/ui'
import { blankClient, useActions } from '../lib/actions'
import {
  CONTACT_LABEL, FREQUENCIES, FREQUENCY_LABEL, LEAD_STAGE_LABEL, PRODUCT_LABEL, PRODUCT_LINES, STATUS_LABEL,
} from '../lib/constants'
import { useStore } from '../lib/store'
import type { Client, ContactMethod, LeadStage, Status } from '../lib/types'

const STATUSES: Status[] = ['lead', 'active', 'at_risk', 'inactive']
const STAGES: LeadStage[] = ['new', 'contacted', 'sampled_quoted', 'won', 'lost']
const CONTACTS: ContactMethod[] = ['visit', 'call', 'text']

export default function ClientForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, settings, remove } = useStore()
  const { saveClient } = useActions()

  const existing = id ? data.clients.find((c) => c.id === id) : undefined
  const [c, setC] = useState<Client>(() => existing ?? blankClient(params.get('status') === 'lead' ? 'lead' : 'active'))
  const [showMore, setShowMore] = useState(false)

  if (id && !existing) return <p className="text-center text-slate-500 py-16">Client not found.</p>

  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((prev) => ({ ...prev, [k]: v }))
  const duplicate =
    !existing &&
    c.business_name.trim() !== '' &&
    data.clients.some((x) => x.business_name.trim().toLowerCase() === c.business_name.trim().toLowerCase())

  function save() {
    const name = c.business_name.trim()
    if (!name) return
    const next: Client = {
      ...c,
      business_name: name,
      lead_stage: c.status === 'lead' ? c.lead_stage ?? 'new' : c.lead_stage === 'won' ? 'won' : null,
      // Address changed: drop old coordinates (they'll be looked up again from the new address).
      ...(existing && existing.address !== c.address ? { lat: null, lng: null } : {}),
    }
    saveClient(next)
    toast(existing ? 'Saved' : `Added ${name}`)
    navigate(`/clients/${next.id}`, { replace: true })
  }

  function del() {
    if (!existing || !confirm(`Delete ${existing.business_name} and all its history? This can't be undone.`)) return
    remove('clients', existing.id)
    toast(`Deleted ${existing.business_name}`)
    navigate('/clients', { replace: true })
  }

  return (
    <div className="pb-4">
      <Label>Business name *</Label>
      <TextInput value={c.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="e.g. Casa Luna" autoFocus={!existing} />
      {duplicate && <p className="text-xs text-amber-700 mt-1">You already have a client with this name.</p>}

      <Label>Status</Label>
      <ChoiceChips options={STATUSES} value={c.status} onChange={(v) => v && set('status', v)} labels={STATUS_LABEL} />
      {c.status === 'lead' && (
        <>
          <Label>Lead stage</Label>
          <ChoiceChips options={STAGES} value={c.lead_stage ?? 'new'} onChange={(v) => v && set('lead_stage', v)} labels={LEAD_STAGE_LABEL} />
        </>
      )}

      <Label>Contact name</Label>
      <TextInput value={c.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value || null)} autoComplete="off" />

      <Label>Phone</Label>
      <TextInput type="tel" inputMode="tel" value={c.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} />

      <Label>Address</Label>
      <TextInput value={c.address ?? ''} onChange={(e) => set('address', e.target.value || null)} placeholder="Street, El Paso, TX" />

      <Label>Area</Label>
      <ChoiceChips options={settings.areas} value={c.area} onChange={(v) => set('area', v)} allowNone />

      <Label>Products they buy</Label>
      <MultiChips options={PRODUCT_LINES} value={c.product_lines} onChange={(v) => set('product_lines', v)} labels={PRODUCT_LABEL} />
      {c.product_lines.includes('other') && (
        <TextInput
          className="mt-2"
          value={c.other_products ?? ''}
          onChange={(e) => set('other_products', e.target.value || null)}
          placeholder="Other products (e.g. dairy, eggs)"
        />
      )}

      <Label>How often they order</Label>
      <ChoiceChips options={FREQUENCIES} value={c.order_frequency} onChange={(v) => set('order_frequency', v)} labels={FREQUENCY_LABEL} allowNone />

      <Label>Customer since</Label>
      <TextInput type="date" value={c.account_start_date ?? ''} onChange={(e) => set('account_start_date', e.target.value || null)} />
      <p className="text-xs text-slate-500 mt-1">"Customer since" gives new accounts extra attention for their first 60 days.</p>

      <Label>Best way to reach them</Label>
      <ChoiceChips options={CONTACTS} value={c.preferred_contact} onChange={(v) => set('preferred_contact', v)} labels={CONTACT_LABEL} allowNone />

      <Label>Notes</Label>
      <TextArea value={c.notes ?? ''} onChange={(v) => set('notes', v || null)} placeholder="Best time to visit, who decides, likes/dislikes…" />

      {showMore ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Typical order $</Label>
              <AmountInput value={c.typical_order_size} onChange={(v) => set('typical_order_size', v)} />
            </div>
            <div>
              <Label>Last order date</Label>
              <TextInput type="date" value={c.last_order_date ?? ''} onChange={(e) => set('last_order_date', e.target.value || null)} />
            </div>
          </div>
          <Label>QuickBooks customer name</Label>
          <TextInput value={c.qb_customer_name ?? ''} onChange={(e) => set('qb_customer_name', e.target.value || null)} placeholder="Exactly as in QuickBooks" />
          <p className="text-xs text-slate-500 mt-1">Used to match orders when importing from QuickBooks later.</p>
        </>
      ) : (
        <button onClick={() => setShowMore(true)} className="mt-4 text-sm font-semibold text-brand-700 underline">
          More fields
        </button>
      )}

      <Button className="w-full mt-8 h-14 text-lg" onClick={save} disabled={!c.business_name.trim()}>
        {existing ? 'Save changes' : 'Add client'}
      </Button>
      <Button variant="secondary" className="w-full mt-3" onClick={() => navigate(-1)}>
        Cancel
      </Button>
      {existing && (
        <Button variant="danger" className="w-full mt-8" onClick={del}>
          Delete client
        </Button>
      )}
    </div>
  )
}

/** Keeps the typed text (so "12." stays while typing) and reports the number. */
function AmountInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? String(value) : '')
  return (
    <TextInput
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseFloat(e.target.value.replace(/[$,]/g, ''))
        onChange(Number.isFinite(n) ? n : null)
      }}
    />
  )
}
