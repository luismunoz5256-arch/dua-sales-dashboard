import type { ContactMethod, Frequency, InteractionType, LeadStage, ProductLine, Settings, Status } from './types'

export const STATUS_LABEL: Record<Status, string> = {
  lead: 'Lead',
  active: 'Active',
  at_risk: 'At risk',
  inactive: 'Inactive',
}

export const STATUS_STYLE: Record<Status, string> = {
  lead: 'bg-sky-100 text-sky-800',
  active: 'bg-green-100 text-green-800',
  at_risk: 'bg-amber-100 text-amber-800',
  inactive: 'bg-slate-200 text-slate-700',
}

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  sampled_quoted: 'Sampled / Quoted',
  won: 'Won',
  lost: 'Lost',
}

export const PRODUCT_LINES: ProductLine[] = ['produce', 'commercial_juice', 'cold_pressed', 'prepped_veg', 'other']

export const PRODUCT_LABEL: Record<ProductLine, string> = {
  produce: 'Produce',
  commercial_juice: 'Commercial juices',
  cold_pressed: 'Cold-pressed juices',
  prepped_veg: 'Prepped veggies',
  other: 'Other',
}

export const PRODUCT_SHORT: Record<ProductLine, string> = {
  produce: 'Produce',
  commercial_juice: 'Juice',
  cold_pressed: 'Cold-pressed',
  prepped_veg: 'Prepped',
  other: 'Other',
}

export const FREQUENCIES: Frequency[] = ['daily', '3x_week', '2x_week', 'weekly', 'biweekly', 'monthly', 'irregular']

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: 'Daily',
  '3x_week': '3x / week',
  '2x_week': '2x / week',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  irregular: 'Irregular',
}

/** Average days between orders, used by the "overdue order" priority rule. */
export const FREQUENCY_DAYS: Record<Frequency, number | null> = {
  daily: 1,
  '3x_week': 7 / 3,
  '2x_week': 3.5,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  irregular: null,
}

export const CONTACT_LABEL: Record<ContactMethod, string> = { visit: 'Visit', call: 'Call', text: 'Text' }

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  visit: 'Visited',
  call: 'Called',
  text: 'Texted',
  sample_drop: 'Sample drop',
  quote_sent: 'Quote sent',
  order: 'Ordered',
}

export const DEFAULT_AREAS = [
  'West Side',
  'Upper Valley',
  'Downtown',
  'Central',
  'Northeast',
  'East Side',
  'Far East',
  'Lower Valley',
  'Mission Valley',
  'Socorro/Horizon',
]

export const DEFAULT_SETTINGS: Settings = {
  // Coordinates are approximate until we geocode the address in a later step.
  home_base: { label: 'Home', address: '840 N Hawkins Blvd, El Paso, TX 79915', lat: 31.7793, lng: -106.3838 },
  areas: DEFAULT_AREAS,
  visits_per_day: 6,
  work_days: [1, 2, 3, 4, 5, 6],
  warehouse_days: [],
  priority: {
    no_contact_days: 14,
    lead_no_contact_days: 7,
    new_account_days: 60,
    weights: {
      overdue_order: 3,
      no_contact: 2,
      followup_due: 3,
      new_account: 2,
      upsell_gap: 1,
      stale_lead: 1.5,
    },
  },
  pitch_language: 'en',
}

/**
 * "Hasn't ordered" flags are ordinary follow-ups whose task starts with this text,
 * so they show up with the other follow-ups and need no extra database column.
 */
export const NO_ORDER_PREFIX = "Hasn't ordered"
export const NO_ORDER_TASK = `${NO_ORDER_PREFIX} — follow up`
export const isNoOrderFlag = (f: { task: string }) => f.task.startsWith(NO_ORDER_PREFIX)

