import { parseDelimited } from './csv'
import { CONTACT_LABEL, FREQUENCY_LABEL, LEAD_STAGE_LABEL, PRODUCT_LABEL, STATUS_LABEL } from './constants'
import { newId, nowIso } from './ids'
import type { Client, ContactMethod, DateStr, Frequency, LeadStage, ProductLine, Status } from './types'

/** Column order used by the template and the clients export, so an export can be re-imported. */
export const CLIENT_COLUMNS = [
  'Business name', 'Contact name', 'Phone', 'Address', 'Area', 'Status', 'Lead stage', 'Products',
  'Order frequency', 'Typical order size', 'Last order date', 'Last order amount', 'Preferred contact',
  'Customer since', 'Notes', 'QuickBooks name',
] as const
type Column = (typeof CLIENT_COLUMNS)[number]

/** Header spellings we recognise (lower-case, punctuation removed). Includes common QuickBooks export names. */
const ALIASES: Record<Column, string[]> = {
  'Business name': ['business name', 'business', 'name', 'customer', 'customer name', 'company', 'company name', 'restaurant', 'client', 'display name'],
  'Contact name': ['contact name', 'contact', 'owner', 'manager', 'full name', 'chef'],
  Phone: ['phone', 'phone number', 'phone numbers', 'telephone', 'mobile', 'cell', 'main phone'],
  Address: ['address', 'billing address', 'shipping address', 'street', 'street address', 'location'],
  Area: ['area', 'zone', 'neighborhood', 'region', 'side', 'route'],
  Status: ['status', 'type'],
  'Lead stage': ['lead stage', 'stage', 'pipeline'],
  Products: ['products', 'product lines', 'product line', 'buys', 'categories'],
  'Order frequency': ['order frequency', 'frequency', 'orders', 'how often'],
  'Typical order size': ['typical order size', 'typical order', 'order size', 'avg order', 'average order'],
  'Last order date': ['last order date', 'last order', 'last purchase', 'last invoice date'],
  'Last order amount': ['last order amount', 'last amount', 'last invoice amount'],
  'Preferred contact': ['preferred contact', 'contact method', 'prefers'],
  'Customer since': ['customer since', 'start date', 'since', 'account start', 'created'],
  Notes: ['notes', 'note', 'comments', 'memo'],
  'QuickBooks name': ['quickbooks name', 'qb name', 'qb customer'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function matchHeader(header: string): Column | null {
  const h = norm(header)
  for (const col of CLIENT_COLUMNS) if (ALIASES[col].includes(h)) return col
  return null
}

/** Without a recognisable header row, pasted lines are read as: name, contact, phone, address, area. */
const HEADERLESS: Column[] = ['Business name', 'Contact name', 'Phone', 'Address', 'Area']

export function parseStatus(v: string): Status | null {
  const s = norm(v)
  if (!s) return null
  if (/at ?risk|risk/.test(s)) return 'at_risk'
  if (/inactive|lost|former|closed/.test(s)) return 'inactive'
  if (/lead|prospect|new lead/.test(s)) return 'lead'
  if (/active|customer|client|account/.test(s)) return 'active'
  return null
}

export function parseLeadStage(v: string): LeadStage | null {
  const s = norm(v)
  if (!s) return null
  if (/sampl|quot/.test(s)) return 'sampled_quoted'
  if (/contact/.test(s)) return 'contacted'
  if (/won/.test(s)) return 'won'
  if (/lost/.test(s)) return 'lost'
  if (/new/.test(s)) return 'new'
  return null
}

export function parseProducts(v: string): ProductLine[] {
  const out = new Set<ProductLine>()
  for (const part of v.split(/[;,/|+]| and /i).map(norm).filter(Boolean)) {
    if (/cold|press/.test(part)) out.add('cold_pressed')
    else if (/juice/.test(part)) out.add('commercial_juice')
    else if (/prep|cut|veg/.test(part)) out.add('prepped_veg')
    else if (/produce|fruit|herb|lettuce|tomato/.test(part)) out.add('produce')
    else out.add('other')
  }
  return [...out]
}

export function parseFrequency(v: string): Frequency | null {
  const s = norm(v)
  if (!s) return null
  if (/daily|every day/.test(s)) return 'daily'
  if (/3 ?x|three/.test(s)) return '3x_week'
  if (/2 ?x|twice|two times/.test(s)) return '2x_week'
  if (/bi ?week|every 2|every other|2 week/.test(s)) return 'biweekly'
  if (/week/.test(s)) return 'weekly'
  if (/month/.test(s)) return 'monthly'
  if (/irreg|as needed|varies/.test(s)) return 'irregular'
  return null
}

export function parseContact(v: string): ContactMethod | null {
  const s = norm(v)
  if (/visit|person/.test(s)) return 'visit'
  if (/text|sms|whats/.test(s)) return 'text'
  if (/call|phone/.test(s)) return 'call'
  return null
}

export function parseAmount(v: string): number | null {
  const n = parseFloat(v.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

const pad = (n: number) => String(n).padStart(2, '0')
export function parseDateLoose(v: string): DateStr | null {
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return `${y}-${pad(+m[1])}-${pad(+m[2])}`
  }
  return null
}

export function matchArea(v: string, areas: string[]): string | null {
  const s = norm(v)
  if (!s) return null
  return areas.find((a) => norm(a) === s) ?? areas.find((a) => norm(a).includes(s) || s.includes(norm(a))) ?? v.trim()
}

export interface ImportRow {
  line: number
  client: Client | null
  problem: string | null
  duplicate: boolean
}

export interface ImportPreview {
  mapped: { header: string; column: Column | null }[]
  headerless: boolean
  rows: ImportRow[]
}

export function previewImport(text: string, existing: Client[], areas: string[]): ImportPreview {
  const table = parseDelimited(text)
  if (!table.length) return { mapped: [], headerless: false, rows: [] }

  const headerCols = table[0].map(matchHeader)
  const hasHeader = headerCols.includes('Business name') || headerCols.filter(Boolean).length >= 2
  const cols: (Column | null)[] = hasHeader ? headerCols : table[0].map((_, i) => HEADERLESS[i] ?? null)
  const body = hasHeader ? table.slice(1) : table
  const mapped = hasHeader ? table[0].map((header, i) => ({ header, column: cols[i] })) : []

  const known = new Set(existing.map((c) => norm(c.business_name)))
  const seen = new Set<string>()
  const now = nowIso()

  const rows = body.map((r, idx): ImportRow => {
    const get = (c: Column) => {
      const i = cols.indexOf(c)
      return i >= 0 ? (r[i] ?? '').trim() : ''
    }
    const line = idx + (hasHeader ? 2 : 1)
    const name = get('Business name')
    if (!name) return { line, client: null, problem: 'No business name', duplicate: false }

    const status = parseStatus(get('Status')) ?? (get('Last order date') || get('Products') ? 'active' : 'lead')
    const client: Client = {
      id: newId(),
      business_name: name,
      contact_name: get('Contact name') || null,
      phone: get('Phone') || null,
      address: get('Address') || null,
      lat: null,
      lng: null,
      area: matchArea(get('Area'), areas),
      status,
      lead_stage: status === 'lead' ? parseLeadStage(get('Lead stage')) ?? 'new' : null,
      product_lines: parseProducts(get('Products')),
      other_products: null,
      order_frequency: parseFrequency(get('Order frequency')),
      typical_order_size: parseAmount(get('Typical order size')),
      last_order_date: parseDateLoose(get('Last order date')),
      last_order_amount: parseAmount(get('Last order amount')),
      preferred_contact: parseContact(get('Preferred contact')),
      notes: get('Notes') || null,
      account_start_date: parseDateLoose(get('Customer since')),
      source: 'csv',
      google_place_id: null,
      qb_customer_name: get('QuickBooks name') || null,
      is_sample: false,
      created_at: now,
      updated_at: now,
    }
    const key = norm(name)
    const duplicate = known.has(key) || seen.has(key)
    seen.add(key)
    return { line, client, problem: null, duplicate }
  })
  return { mapped, headerless: !hasHeader, rows }
}

export function clientToRow(c: Client): unknown[] {
  return [
    c.business_name, c.contact_name, c.phone, c.address, c.area, STATUS_LABEL[c.status],
    c.lead_stage ? LEAD_STAGE_LABEL[c.lead_stage] : '', c.product_lines.map((p) => PRODUCT_LABEL[p]),
    c.order_frequency ? FREQUENCY_LABEL[c.order_frequency] : '', c.typical_order_size, c.last_order_date,
    c.last_order_amount, c.preferred_contact ? CONTACT_LABEL[c.preferred_contact] : '', c.account_start_date,
    c.notes, c.qb_customer_name,
  ]
}
