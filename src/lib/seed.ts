import { addDays, today } from './dates'
import { newId, nowIso } from './ids'
import type { Client, DataSet, Followup, Interaction, InteractionType } from './types'
import { NO_ORDER_PREFIX, NO_ORDER_TASK } from './constants'
import { emptyData } from './backend'

/**
 * Fictional sample accounts around El Paso so every screen has something to show.
 * All rows are marked is_sample and can be removed in one tap from Settings.
 */
type SeedClient = Partial<Client> & {
  business_name: string
  area: string
  /** days ago the account started */
  started?: number
  log?: [daysAgo: number, type: InteractionType, notes: string][]
  followups?: [task: string, dueInDays: number][]
}

const C: SeedClient[] = [
  {
    business_name: 'Casa Luna Cocina', contact_name: 'Marisol', phone: '915-555-0101', area: 'West Side',
    address: '5860 N Mesa St, El Paso, TX', lat: 31.8327, lng: -106.5496, status: 'active',
    product_lines: ['produce', 'prepped_veg'], order_frequency: '2x_week', typical_order_size: 450, started: 200, preferred_contact: 'visit',
    notes: 'Chef-owner. Likes to see product before buying. Brunch on weekends.',
    log: [[12, 'visit', 'Dropped off cilantro sample']],
  },
  {
    business_name: 'Tacos El Primo', contact_name: 'Ruben', phone: '915-555-0102', area: 'Central',
    address: '2900 Montana Ave, El Paso, TX', lat: 31.7787, lng: -106.4594, status: 'active',
    product_lines: ['produce'], order_frequency: 'weekly', typical_order_size: 300, started: 120, preferred_contact: 'call',
    notes: 'Big pico and salsa volume. Could use prepped onions/cilantro.',
    log: [[5, 'call', 'Took phone order']],
  },
  {
    business_name: 'Verde Juice Co.', contact_name: 'Alyssa', phone: '915-555-0103', area: 'West Side',
    address: '7500 N Mesa St, El Paso, TX', lat: 31.8571, lng: -106.5765, status: 'active',
    product_lines: ['cold_pressed'], order_frequency: 'weekly', typical_order_size: 350, started: 25, preferred_contact: 'text',
    notes: 'New account. Interested in organic produce for smoothies.',
    log: [[10, 'visit', 'Signed up, first order placed']],
    followups: [['Send organic produce price list', 0]],
  },
  {
    business_name: 'The Copper Tap', contact_name: 'Dave', phone: '915-555-0104', area: 'Downtown',
    address: '201 E Main Dr, El Paso, TX', lat: 31.7595, lng: -106.4869, status: 'active',
    product_lines: ['commercial_juice'], order_frequency: 'weekly', typical_order_size: 200, started: 300, preferred_contact: 'call',
    notes: 'Bar. Uses OJ, cranberry, pineapple. Limes/lemons from Sysco right now.',
    log: [[20, 'call', 'Asked about garnish pricing']],
    followups: [[`${NO_ORDER_PREFIX} — usually orders Thursdays`, -1]],
  },
  {
    business_name: 'Sunrise Brunch House', contact_name: 'Karen', phone: '915-555-0105', area: 'Northeast',
    address: '9100 Dyer St, El Paso, TX', lat: 31.8723, lng: -106.4334, status: 'at_risk',
    product_lines: ['produce', 'commercial_juice'], order_frequency: 'weekly', typical_order_size: 520, started: 400, preferred_contact: 'visit',
    notes: 'Complained about tomato quality last month.',
    log: [[30, 'visit', 'Tomato complaint, offered credit']],
    followups: [['Bring tomato samples from new grower', -3], [NO_ORDER_TASK, 0]],
  },
  {
    business_name: 'Mariscos La Playa', contact_name: 'Jorge', phone: '915-555-0106', area: 'East Side',
    address: '1700 N Zaragoza Rd, El Paso, TX', lat: 31.7782, lng: -106.3077, status: 'active',
    product_lines: ['produce', 'prepped_veg', 'commercial_juice'], order_frequency: '2x_week', typical_order_size: 600, started: 500, preferred_contact: 'call',
    log: [[8, 'visit', 'All good']],
  },
  {
    business_name: 'Fit Fuel Gym Cafe', contact_name: 'Tony', phone: '915-555-0107', area: 'Far East',
    address: '12000 Montwood Dr, El Paso, TX', lat: 31.7629, lng: -106.2486, status: 'active',
    product_lines: ['cold_pressed'], order_frequency: 'biweekly', typical_order_size: 180, started: 45, preferred_contact: 'text',
    log: [[20, 'text', 'Confirmed delivery day']],
  },
  {
    business_name: 'Abuela’s Kitchen', contact_name: 'Rosa', phone: '915-555-0108', area: 'Lower Valley',
    address: '7900 Alameda Ave, El Paso, TX', lat: 31.7166, lng: -106.3487, status: 'active',
    product_lines: ['produce'], order_frequency: 'weekly', typical_order_size: 250, started: 90, preferred_contact: 'visit',
    log: [[18, 'visit', 'Asked about chile pricing']],
  },
  {
    business_name: 'Mesa Street Deli', contact_name: 'Greg', phone: '915-555-0109', area: 'Central',
    address: '3100 N Mesa St, El Paso, TX', lat: 31.7856, lng: -106.5052, status: 'inactive',
    product_lines: ['produce'], order_frequency: 'weekly', typical_order_size: 150, started: 400, preferred_contact: 'call',
    notes: 'Went with Shamrock. Check back in a couple months.',
    log: [[60, 'call', 'Said they switched suppliers on price']],
  },
  {
    business_name: 'Green Bowl Poke', contact_name: 'Kim', phone: '915-555-0110', area: 'West Side', status: 'lead',
    lead_stage: 'contacted', address: '5200 N Desert Blvd, El Paso, TX', lat: 31.8441, lng: -106.5598,
    product_lines: [], preferred_contact: 'visit', notes: 'Lots of fresh veg. Owner is in after 2pm.',
    log: [[11, 'visit', 'Introduced, left card']],
    followups: [['Drop off prepped veg sample', 1]],
  },
  {
    business_name: 'El Paso Catering Co.', contact_name: 'Linda', phone: '915-555-0111', area: 'East Side', status: 'lead',
    lead_stage: 'sampled_quoted', address: '1450 Lee Trevino Dr, El Paso, TX', lat: 31.7749, lng: -106.3356,
    product_lines: [], preferred_contact: 'call', notes: 'Large events on weekends. Wants weekly pricing sheet.',
    log: [[6, 'quote_sent', 'Sent quote for produce + prepped veg']],
    followups: [['Call to review the quote', -1]],
  },
  {
    business_name: 'Blend Smoothie Bar', area: 'Northeast', status: 'lead', lead_stage: 'new',
    address: '4800 Hondo Pass Dr, El Paso, TX', lat: 31.8945, lng: -106.4245, product_lines: [],
    preferred_contact: 'visit', phone: '915-555-0112',
  },
  {
    business_name: 'Café Azul', contact_name: 'Pedro', area: 'Downtown', status: 'lead', lead_stage: 'new',
    address: '310 N Oregon St, El Paso, TX', lat: 31.7612, lng: -106.4891, product_lines: [],
    preferred_contact: 'visit', phone: '915-555-0113',
  },
  {
    business_name: 'Horizon Family Grill', contact_name: 'Ana', area: 'Socorro/Horizon', status: 'lead',
    lead_stage: 'contacted', address: '14000 Horizon Blvd, Horizon City, TX', lat: 31.6834, lng: -106.2189,
    product_lines: [], preferred_contact: 'call', phone: '915-555-0114',
    log: [[15, 'call', 'Asked to call back next month']],
  },
]

export function buildSampleData(): DataSet {
  const t = today()
  const now = nowIso()
  const data = emptyData()
  for (const s of C) {
    const { started, log, followups, ...fields } = s
    const client: Client = {
      id: newId(),
      contact_name: null,
      phone: null,
      address: null,
      lat: null,
      lng: null,
      status: 'lead',
      lead_stage: null,
      product_lines: [],
      other_products: null,
      order_frequency: null,
      typical_order_size: null,
      last_order_date: null,
      last_order_amount: null,
      preferred_contact: null,
      notes: null,
      account_start_date: started != null ? addDays(t, -started) : null,
      source: 'sample',
      google_place_id: null,
      qb_customer_name: null,
      is_sample: true,
      created_at: now,
      updated_at: now,
      ...fields,
    }
    data.clients.push(client)

    for (const [ago, type, notes] of log ?? []) {
      const i: Interaction = {
        id: newId(), client_id: client.id, date: addDays(t, -ago), type, notes: notes || null,
        outcome: null, next_step: null, next_step_due: null, created_at: now,
      }
      data.interactions.push(i)
    }
    for (const [task, due] of followups ?? []) {
      const f: Followup = {
        id: newId(), client_id: client.id, task, due_date: addDays(t, due),
        done: false, done_at: null, interaction_id: null, created_at: now,
      }
      data.followups.push(f)
    }
  }
  return data
}
