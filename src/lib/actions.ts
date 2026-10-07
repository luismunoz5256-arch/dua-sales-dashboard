import { useCallback } from 'react'
import { NO_ORDER_PREFIX, NO_ORDER_TASK } from './constants'
import { today } from './dates'
import { newId, nowIso } from './ids'
import { useStore } from './store'
import type { Client, DateStr, Followup, Interaction, InteractionType, Order, ProductLine } from './types'

export interface LogOptions {
  date?: DateStr
  notes?: string | null
  outcome?: string | null
  next_step?: string | null
  next_step_due?: DateStr | null
  /** For orders */
  amount?: number | null
  product_lines?: ProductLine[]
}

export interface LogResult {
  interaction: Interaction
  undo: () => void
}

/** Status/stage changes implied by an interaction, e.g. a lead's first call moves it to "Contacted". */
function clientAfter(c: Client, type: InteractionType, date: DateStr, o: LogOptions): Client {
  const next = { ...c }
  if (type === 'order') {
    if (!c.last_order_date || date >= c.last_order_date) {
      next.last_order_date = date
      next.last_order_amount = o.amount ?? null
    }
    if (c.status !== 'active') next.status = 'active'
    if (c.status === 'lead') next.lead_stage = 'won'
    if (!c.account_start_date && c.status === 'lead') next.account_start_date = date
    if (o.product_lines?.length) next.product_lines = [...new Set([...c.product_lines, ...o.product_lines])]
  } else if (c.status === 'lead') {
    if ((type === 'sample_drop' || type === 'quote_sent') && c.lead_stage !== 'won' && c.lead_stage !== 'lost')
      next.lead_stage = 'sampled_quoted'
    else if (!c.lead_stage || c.lead_stage === 'new') next.lead_stage = 'contacted'
  }
  return next
}

const changed = (a: Client, b: Client) =>
  (Object.keys(a) as (keyof Client)[]).some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))

export function useActions() {
  const { upsert, remove } = useStore()

  const logInteraction = useCallback(
    (client: Client, type: InteractionType, o: LogOptions = {}): LogResult => {
      const now = nowIso()
      const date = o.date ?? today()
      const interaction: Interaction = {
        id: newId(),
        client_id: client.id,
        date,
        type,
        notes: o.notes?.trim() || null,
        outcome: o.outcome?.trim() || null,
        next_step: o.next_step?.trim() || null,
        next_step_due: o.next_step?.trim() ? o.next_step_due ?? null : null,
        created_at: now,
      }
      upsert('interactions', interaction)

      let order: Order | null = null
      if (type === 'order') {
        order = {
          id: newId(), client_id: client.id, date, amount: o.amount ?? null,
          product_lines: o.product_lines ?? client.product_lines, source: 'manual', qb_ref: null, created_at: now,
        }
        upsert('orders', order)
      }

      let followup: Followup | null = null
      if (interaction.next_step && interaction.next_step_due) {
        followup = {
          id: newId(), client_id: client.id, task: interaction.next_step, due_date: interaction.next_step_due,
          done: false, done_at: null, interaction_id: interaction.id, created_at: now,
        }
        upsert('followups', followup)
      }

      const updated = clientAfter(client, type, date, o)
      if (changed(client, updated)) upsert('clients', { ...updated, updated_at: now })

      const undo = () => {
        if (followup) remove('followups', followup.id)
        if (order) remove('orders', order.id)
        remove('interactions', interaction.id)
        if (changed(client, updated)) upsert('clients', client)
      }
      return { interaction, undo }
    },
    [upsert, remove],
  )

  /** Edit an interaction after the fact (e.g. "Add note" after a one-tap log). Adds a follow-up for a new next step. */
  const updateInteraction = useCallback(
    (before: Interaction, after: Interaction, existingFollowup: Followup | null) => {
      const next: Interaction = {
        ...after,
        notes: after.notes?.trim() || null,
        outcome: after.outcome?.trim() || null,
        next_step: after.next_step?.trim() || null,
        next_step_due: after.next_step?.trim() ? after.next_step_due : null,
      }
      upsert('interactions', next)
      if (next.next_step && next.next_step_due) {
        upsert('followups', {
          id: existingFollowup?.id ?? newId(),
          client_id: next.client_id,
          task: next.next_step,
          due_date: next.next_step_due,
          done: existingFollowup?.done ?? false,
          done_at: existingFollowup?.done_at ?? null,
          interaction_id: next.id,
          created_at: existingFollowup?.created_at ?? nowIso(),
        })
      } else if (existingFollowup && !existingFollowup.done && before.next_step) {
        remove('followups', existingFollowup.id)
      }
    },
    [upsert, remove],
  )

  const deleteInteraction = useCallback(
    (i: Interaction, linked: Followup | null) => {
      if (linked && !linked.done) remove('followups', linked.id)
      remove('interactions', i.id)
    },
    [remove],
  )

  const addFollowup = useCallback(
    (clientId: string | null, task: string, due: DateStr) => {
      upsert('followups', {
        id: newId(), client_id: clientId, task: task.trim(), due_date: due, done: false, done_at: null,
        interaction_id: null, created_at: nowIso(),
      })
    },
    [upsert],
  )

  const setFollowupDone = useCallback(
    (f: Followup, done: boolean) => upsert('followups', { ...f, done, done_at: done ? nowIso() : null }),
    [upsert],
  )

  /** Flag "hasn't ordered": one open follow-up per client; flagging again just moves its due date. */
  const flagNoOrder = useCallback(
    (client: Client, due: DateStr, note: string, existing: Followup | null) => {
      const task = note.trim() ? `${NO_ORDER_PREFIX} — ${note.trim()}` : NO_ORDER_TASK
      const f: Followup = existing
        ? { ...existing, task, due_date: due }
        : { id: newId(), client_id: client.id, task, due_date: due, done: false, done_at: null, interaction_id: null, created_at: nowIso() }
      upsert('followups', f)
      return () => (existing ? upsert('followups', existing) : remove('followups', f.id))
    },
    [upsert, remove],
  )

  const saveClient = useCallback((c: Client) => upsert('clients', { ...c, updated_at: nowIso() }), [upsert])

  return { logInteraction, updateInteraction, deleteInteraction, addFollowup, setFollowupDone, flagNoOrder, saveClient }
}

export { isNoOrderFlag, NO_ORDER_PREFIX, NO_ORDER_TASK } from './constants'

export function blankClient(status: Client['status'] = 'active'): Client {
  const now = nowIso()
  return {
    id: newId(), business_name: '', contact_name: null, phone: null, address: null, lat: null, lng: null, area: null,
    status, lead_stage: status === 'lead' ? 'new' : null, product_lines: [], other_products: null, order_frequency: null,
    typical_order_size: null, last_order_date: null, last_order_amount: null, preferred_contact: null, notes: null,
    account_start_date: null, source: 'manual', google_place_id: null, qb_customer_name: null, is_sample: false,
    created_at: now, updated_at: now,
  }
}

export function mapsUrl(c: Pick<Client, 'address' | 'lat' | 'lng' | 'business_name'>): string | null {
  const q = c.address ? `${c.business_name}, ${c.address}` : c.lat != null && c.lng != null ? `${c.lat},${c.lng}` : null
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}
