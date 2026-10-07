export type Status = 'lead' | 'active' | 'at_risk' | 'inactive'
export type LeadStage = 'new' | 'contacted' | 'sampled_quoted' | 'won' | 'lost'
export type ProductLine = 'produce' | 'commercial_juice' | 'cold_pressed' | 'prepped_veg' | 'other'
export type ContactMethod = 'visit' | 'call' | 'text'
export type InteractionType = 'visit' | 'call' | 'text' | 'sample_drop' | 'quote_sent' | 'order'
export type Frequency = 'daily' | '3x_week' | '2x_week' | 'weekly' | 'biweekly' | 'monthly' | 'irregular'
export type DayKind = 'field' | 'warehouse' | 'off'

/** Dates are local calendar dates as 'YYYY-MM-DD' strings. */
export type DateStr = string

export interface Client {
  id: string
  business_name: string
  contact_name: string | null
  phone: string | null
  address: string | null
  lat: number | null
  lng: number | null
  area: string | null
  status: Status
  lead_stage: LeadStage | null
  product_lines: ProductLine[]
  other_products: string | null
  order_frequency: Frequency | null
  typical_order_size: number | null
  last_order_date: DateStr | null
  last_order_amount: number | null
  preferred_contact: ContactMethod | null
  notes: string | null
  account_start_date: DateStr | null
  source: string | null
  google_place_id: string | null
  qb_customer_name: string | null
  is_sample: boolean
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  client_id: string
  date: DateStr
  type: InteractionType
  notes: string | null
  outcome: string | null
  next_step: string | null
  next_step_due: DateStr | null
  created_at: string
}

export interface Followup {
  id: string
  client_id: string | null
  task: string
  due_date: DateStr
  done: boolean
  done_at: string | null
  interaction_id: string | null
  created_at: string
}

export interface Order {
  id: string
  client_id: string
  date: DateStr
  amount: number | null
  product_lines: ProductLine[]
  source: string
  qb_ref: string | null
  created_at: string
}

export interface WeekPlanItem {
  id: string
  date: DateStr
  client_id: string
  position: number
  created_at: string
}

export interface DayStatus {
  id: DateStr
  kind: DayKind
  note: string | null
}

export interface Prospect {
  id: string
  google_place_id: string
  name: string
  status: 'new' | 'saved' | 'dismissed' | 'added'
  fit_score: number | null
  data: Record<string, unknown>
  client_id: string | null
  created_at: string
  updated_at: string
}

export interface PriorityWeights {
  no_order: number
  followup_due: number
  at_risk: number
  no_contact: number
  new_account: number
  upsell_gap: number
  stale_lead: number
}

export interface Settings {
  /** lat/lng are looked up from the address; geocoded_for is the address they belong to. */
  home_base: { label: string; address: string; lat: number | null; lng: number | null; geocoded_for?: string }
  areas: string[]
  visits_per_day: number
  /** 0 = Sunday … 6 = Saturday */
  work_days: number[]
  /** Usual warehouse weekdays (0–6); can be overridden per date. */
  warehouse_days: number[]
  priority: {
    no_contact_days: number
    lead_no_contact_days: number
    new_account_days: number
    weights: PriorityWeights
  }
  pitch_language: 'en' | 'es' | 'both'
  /** Targets you've set on the Goals page (unset = not tracking yet). */
  goals?: Partial<Record<'new_accounts_month' | 'visits_week' | 'leads_week' | 'multi_line_clients', number>>
  /** Day goals were first set; bonuses only count from the period containing this day. */
  goals_since?: string
  /** Prospect Finder: fit score weights (multipliers, default 1) and extra chain names to flag. */
  fit_weights?: Partial<Record<'type' | 'independent' | 'busy' | 'near' | 'menu' | 'fresh' | 'open', number>>
  extra_chains?: string[]
  /** Push notifications (default on once enabled on a phone). */
  notifications?: { morning: boolean; midday: boolean }
}

export interface DataSet {
  clients: Client[]
  interactions: Interaction[]
  followups: Followup[]
  orders: Order[]
  week_plan: WeekPlanItem[]
  day_status: DayStatus[]
  prospects: Prospect[]
}

export type TableName = keyof DataSet
export type RowOf<T extends TableName> = DataSet[T][number]
