import { MapPin, MessageSquare, MoreHorizontal, Phone, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useActions } from '../lib/actions'
import { INTERACTION_LABEL, PRODUCT_LABEL, PRODUCT_LINES } from '../lib/constants'
import { today } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Client, DateStr, Interaction, InteractionType, ProductLine } from '../lib/types'
import { ChoiceChips, DateChips, DUE_PRESETS, Label, MultiChips, PAST_PRESETS, TextArea, TextInput } from './fields'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Button } from './ui'

const ONE_TAP: { type: InteractionType; label: string; icon: typeof Phone }[] = [
  { type: 'call', label: 'Called', icon: Phone },
  { type: 'text', label: 'Texted', icon: MessageSquare },
  { type: 'visit', label: 'Visited', icon: MapPin },
]

/**
 * Called / Texted / Visited log with one tap (then "Add note" or "Undo" in the toast).
 * Ordered asks for the amount. "…" opens the full log form (sample drop, quote, notes, next step).
 */
export function QuickLog({ client, size = 'md' }: { client: Client; size?: 'sm' | 'md' }) {
  const { logInteraction } = useActions()
  const toast = useToast()
  const [sheet, setSheet] = useState<null | 'order' | 'full' | Interaction>(null)
  const h = size === 'sm' ? 'h-12' : 'h-14'

  function oneTap(type: InteractionType) {
    const { interaction, undo } = logInteraction(client, type)
    toast(`${INTERACTION_LABEL[type]} ${client.business_name}`, [
      { label: 'Add note', onClick: () => setSheet(interaction) },
      { label: 'Undo', onClick: undo },
    ])
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-1.5">
        {ONE_TAP.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => oneTap(type)}
            className={`${h} rounded-xl bg-slate-100 active:bg-brand-100 flex flex-col items-center justify-center text-[11px] font-semibold text-slate-700`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
        <button
          onClick={() => setSheet('order')}
          className={`${h} rounded-xl bg-orange-100 active:bg-orange-200 flex flex-col items-center justify-center text-[11px] font-semibold text-orange-800`}
        >
          <ShoppingCart size={20} />
          Ordered
        </button>
        <button
          onClick={() => setSheet('full')}
          aria-label="More log options"
          className={`${h} rounded-xl bg-slate-100 active:bg-slate-200 flex flex-col items-center justify-center text-[11px] font-semibold text-slate-700`}
        >
          <MoreHorizontal size={20} />
          More
        </button>
      </div>
      <OrderSheet client={client} open={sheet === 'order'} onClose={() => setSheet(null)} />
      <LogSheet
        client={client}
        open={sheet === 'full' || (sheet !== null && typeof sheet === 'object')}
        interaction={typeof sheet === 'object' ? sheet : null}
        onClose={() => setSheet(null)}
      />
    </>
  )
}

export function OrderSheet({ client, open, onClose }: { client: Client; open: boolean; onClose: () => void }) {
  const { logInteraction } = useActions()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState<DateStr>(today())
  const [lines, setLines] = useState<ProductLine[]>([])

  useEffect(() => {
    if (!open) return
    setAmount(client.typical_order_size != null ? String(client.typical_order_size) : '')
    setDate(today())
    setLines(client.product_lines)
  }, [open, client])

  function save() {
    const n = parseFloat(amount.replace(/[$,]/g, ''))
    const { undo } = logInteraction(client, 'order', {
      date,
      amount: Number.isFinite(n) ? n : null,
      product_lines: lines,
    })
    onClose()
    toast(`Order logged for ${client.business_name}`, [{ label: 'Undo', onClick: undo }])
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Order · ${client.business_name}`}>
      <Label>Amount</Label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">$</span>
        <TextInput
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="pl-9 text-xl font-semibold"
          autoFocus
        />
      </div>
      <Label>Date</Label>
      <DateChips value={date} onChange={setDate} presets={PAST_PRESETS} />
      <Label>Products in this order</Label>
      <MultiChips options={PRODUCT_LINES} value={lines} onChange={setLines} labels={PRODUCT_LABEL} />
      {client.status === 'lead' && (
        <p className="text-sm text-brand-700 font-semibold mt-4">🎉 First order: this lead becomes an active client.</p>
      )}
      <Button className="w-full mt-6 h-14 text-lg" onClick={save}>
        Save order
      </Button>
    </Sheet>
  )
}

const ALL_TYPES: InteractionType[] = ['visit', 'call', 'text', 'sample_drop', 'quote_sent']
const TYPE_LABEL: Record<InteractionType, string> = {
  visit: 'Visit', call: 'Call', text: 'Text', sample_drop: 'Sample drop', quote_sent: 'Quote sent', order: 'Order',
}
const OUTCOMES = ['Interested', 'Placed order', 'Needs pricing', 'Not now', 'No answer', 'Happy']

/** Full log form. With `interaction` it edits that entry (used by "Add note" and by tapping history). */
export function LogSheet({
  client,
  open,
  onClose,
  interaction,
}: {
  client: Client
  open: boolean
  onClose: () => void
  interaction: Interaction | null
}) {
  const { data } = useStore()
  const { logInteraction, updateInteraction, deleteInteraction } = useActions()
  const toast = useToast()
  const [type, setType] = useState<InteractionType>('visit')
  const [date, setDate] = useState<DateStr>(today())
  const [notes, setNotes] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [due, setDue] = useState<DateStr | null>(null)

  const linked = interaction ? data.followups.find((f) => f.interaction_id === interaction.id) ?? null : null

  useEffect(() => {
    if (!open) return
    setType(interaction?.type ?? 'visit')
    setDate(interaction?.date ?? today())
    setNotes(interaction?.notes ?? '')
    setOutcome(interaction?.outcome ?? '')
    setNextStep(interaction?.next_step ?? '')
    setDue(interaction?.next_step_due ?? null)
  }, [open, interaction?.id])

  const needsDue = nextStep.trim() !== '' && !due

  function save() {
    if (interaction) {
      updateInteraction(
        interaction,
        { ...interaction, type, date, notes, outcome, next_step: nextStep, next_step_due: due },
        linked,
      )
      toast('Saved')
    } else {
      const { undo } = logInteraction(client, type, { date, notes, outcome, next_step: nextStep, next_step_due: due })
      toast(`${TYPE_LABEL[type]} logged`, [{ label: 'Undo', onClick: undo }])
    }
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={interaction ? `Edit · ${client.business_name}` : `Log · ${client.business_name}`}>
      {interaction?.type !== 'order' && (
        <>
          <Label>Type</Label>
          <ChoiceChips options={ALL_TYPES} value={type} onChange={(v) => v && setType(v)} labels={TYPE_LABEL} />
        </>
      )}
      <Label>Date</Label>
      <DateChips value={date} onChange={setDate} presets={PAST_PRESETS} />
      <Label>What was discussed</Label>
      <TextArea value={notes} onChange={setNotes} placeholder="Optional" />
      <Label>Outcome</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {OUTCOMES.map((o) => (
          <button
            type="button"
            key={o}
            onClick={() => setOutcome(outcome === o ? '' : o)}
            className={`min-h-10 px-3 rounded-full text-sm font-semibold border ${
              outcome === o ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <TextInput value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Or type an outcome" />
      <Label>Next step (creates a follow-up)</Label>
      <TextInput value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Bring tomato samples" />
      {nextStep.trim() && (
        <div className="mt-3">
          <DateChips value={due} onChange={setDue} presets={DUE_PRESETS} />
          {needsDue && <p className="text-xs text-amber-700 mt-2">Pick a due date to create the follow-up.</p>}
        </div>
      )}
      <Button className="w-full mt-6 h-14 text-lg" onClick={save}>
        Save
      </Button>
      {interaction && (
        <Button
          variant="danger"
          className="w-full mt-3"
          onClick={() => {
            if (!confirm('Delete this entry?')) return
            deleteInteraction(interaction, linked)
            onClose()
            toast('Deleted')
          }}
        >
          Delete entry
        </Button>
      )}
    </Sheet>
  )
}
