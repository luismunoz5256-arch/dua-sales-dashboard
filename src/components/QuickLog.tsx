import { MapPin, MessageSquare, MoreHorizontal, PackageX, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isNoOrderFlag, NO_ORDER_PREFIX, NO_ORDER_TASK, useActions } from '../lib/actions'
import { INTERACTION_LABEL } from '../lib/constants'
import { today } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Client, DateStr, Interaction, InteractionType } from '../lib/types'
import { ChoiceChips, DateChips, DUE_PRESETS, Label, PAST_PRESETS, TextArea, TextInput } from './fields'
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
 * "No order" flags a client that hasn't ordered and sets a follow-up date.
 * "More" opens the full log form (sample drop, quote, notes, next step).
 */
export function QuickLog({ client, size = 'md' }: { client: Client; size?: 'sm' | 'md' }) {
  const { logInteraction } = useActions()
  const toast = useToast()
  const [sheet, setSheet] = useState<null | 'no_order' | 'full' | Interaction>(null)
  const h = size === 'sm' ? 'h-12' : 'h-14'
  // Leads haven't ordered yet, so "No order" doesn't apply to them.
  const isLead = client.status === 'lead'

  function oneTap(type: InteractionType) {
    const { interaction, undo } = logInteraction(client, type)
    toast(`${INTERACTION_LABEL[type]} ${client.business_name}`, [
      { label: 'Add note', onClick: () => setSheet(interaction) },
      { label: 'Undo', onClick: undo },
    ])
  }

  return (
    <>
      <div className={`grid gap-1.5 ${isLead ? 'grid-cols-4' : 'grid-cols-5'}`}>
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
        {!isLead && (
          <button
            onClick={() => setSheet('no_order')}
            className={`${h} rounded-xl bg-amber-100 active:bg-amber-200 flex flex-col items-center justify-center text-[11px] font-semibold text-amber-900`}
          >
            <PackageX size={20} />
            No order
          </button>
        )}
        <button
          onClick={() => setSheet('full')}
          aria-label="More log options"
          className={`${h} rounded-xl bg-slate-100 active:bg-slate-200 flex flex-col items-center justify-center text-[11px] font-semibold text-slate-700`}
        >
          <MoreHorizontal size={20} />
          More
        </button>
      </div>
      <NoOrderSheet client={client} open={sheet === 'no_order'} onClose={() => setSheet(null)} />
      <LogSheet
        client={client}
        open={sheet === 'full' || (sheet !== null && typeof sheet === 'object')}
        interaction={typeof sheet === 'object' ? sheet : null}
        onClose={() => setSheet(null)}
      />
    </>
  )
}

export function NoOrderSheet({ client, open, onClose }: { client: Client; open: boolean; onClose: () => void }) {
  const { data } = useStore()
  const { flagNoOrder } = useActions()
  const toast = useToast()
  const existing = data.followups.find((f) => f.client_id === client.id && !f.done && isNoOrderFlag(f)) ?? null
  const [due, setDue] = useState<DateStr>(today())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setDue(existing?.due_date ?? today())
    setNote(existing && existing.task !== NO_ORDER_TASK ? existing.task.replace(`${NO_ORDER_PREFIX} — `, '') : '')
  }, [open])

  function save() {
    const undo = flagNoOrder(client, due, note, existing)
    onClose()
    toast(`Follow-up set: ${client.business_name} hasn't ordered`, [{ label: 'Undo', onClick: undo }])
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Hasn't ordered · ${client.business_name}`}>
      {existing && <p className="text-sm text-amber-700 font-semibold">Already flagged. Saving moves the follow-up date.</p>}
      <Label>Follow up</Label>
      <DateChips value={due} onChange={setDue} presets={[{ label: 'Today', days: 0 }, ...DUE_PRESETS.slice(0, 3)]} />
      <Label>Note (optional)</Label>
      <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. usually orders Mondays" />
      <Button className="w-full mt-6 h-14 text-lg" onClick={save}>
        Save follow-up
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
