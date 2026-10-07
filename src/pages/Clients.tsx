import { FileUp, Phone, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChoiceChips, Label, MultiChips } from '../components/fields'
import { Sheet } from '../components/Sheet'
import { Button, Card, Chip, Pill } from '../components/ui'
import { FREQUENCY_LABEL, PRODUCT_LABEL, PRODUCT_LINES, PRODUCT_SHORT, STATUS_LABEL, STATUS_STYLE } from '../lib/constants'
import { daysAgo, relativeDay } from '../lib/dates'
import { isNoOrderFlag } from '../lib/actions'
import { useStore } from '../lib/store'
import type { ProductLine, Status } from '../lib/types'

type StatusFilter = Status | 'all' | 'no_order'
const FILTERS: StatusFilter[] = ['all', 'no_order', 'active', 'at_risk', 'lead', 'inactive']
type Contact = 'any' | '7' | '14' | '30' | 'never'
const CONTACT_FILTERS: Contact[] = ['any', '7', '14', '30', 'never']
const CONTACT_LABEL: Record<Contact, string> = { any: 'Any', '7': '7+ days', '14': '14+ days', '30': '30+ days', never: 'Never' }
type Sort = 'name' | 'contact'
const SORT_LABEL: Record<Sort, string> = { name: 'Name', contact: 'Longest since contact' }

/** Filters survive leaving and coming back to the list during this session. */
const saved = { q: '', status: 'all' as StatusFilter, areas: [] as string[], products: [] as ProductLine[], contact: 'any' as Contact, sort: 'name' as Sort }

export default function ClientsPage() {
  const { data, settings } = useStore()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // Opened from a Today tile (e.g. /clients?status=lead): start from a clean list with just that filter.
  const linked = params.get('status') as StatusFilter | null
  if (linked && FILTERS.includes(linked)) Object.assign(saved, { q: '', status: linked, areas: [], products: [], contact: 'any', sort: 'name' })
  useEffect(() => {
    if (linked) navigate('/clients', { replace: true })
  }, [linked, navigate])
  const [q, setQ] = useState(saved.q)
  const [status, setStatus] = useState(saved.status)
  const [areas, setAreas] = useState(saved.areas)
  const [products, setProducts] = useState(saved.products)
  const [contact, setContact] = useState(saved.contact)
  const [sort, setSort] = useState(saved.sort)
  const [filtersOpen, setFiltersOpen] = useState(false)
  Object.assign(saved, { q, status, areas, products, contact, sort })

  const lastContact = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of data.interactions) if ((m.get(i.client_id) ?? '') < i.date) m.set(i.client_id, i.date)
    return m
  }, [data.interactions])

  const flagged = useMemo(
    () => new Set(data.followups.filter((f) => !f.done && f.client_id && isNoOrderFlag(f)).map((f) => f.client_id!)),
    [data.followups],
  )
  const count = (f: StatusFilter) =>
    f === 'all' ? data.clients.length : f === 'no_order' ? flagged.size : data.clients.filter((c) => c.status === f).length

  const extraFilters = (areas.length ? 1 : 0) + (products.length ? 1 : 0) + (contact !== 'any' ? 1 : 0) + (sort !== 'name' ? 1 : 0)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = data.clients
      .filter((c) => status === 'all' || (status === 'no_order' ? flagged.has(c.id) : c.status === status))
      .filter((c) => !areas.length || (c.area != null && areas.includes(c.area)))
      .filter((c) => products.every((p) => c.product_lines.includes(p)))
      .filter((c) => {
        if (contact === 'any') return true
        const n = daysAgo(lastContact.get(c.id))
        if (contact === 'never') return n == null
        return n == null || n >= Number(contact)
      })
      .filter(
        (c) =>
          !needle ||
          [c.business_name, c.contact_name, c.area, c.address, c.phone].some((v) => v?.toLowerCase().includes(needle)),
      )
    // Oldest date first; never contacted ('') sorts to the top.
    return out.sort((a, b) => {
      if (sort === 'contact') return (lastContact.get(a.id) ?? '').localeCompare(lastContact.get(b.id) ?? '')
      return a.business_name.localeCompare(b.business_name)
    })
  }, [data.clients, q, status, areas, products, contact, sort, lastContact, flagged])

  return (
    <div className="pb-20">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 bg-white text-base"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          aria-label="Filters"
          className={`relative w-12 h-12 rounded-xl border grid place-items-center ${extraFilters ? 'bg-brand-700 text-white border-brand-700' : 'bg-white border-slate-300 text-slate-700'}`}
        >
          <SlidersHorizontal size={20} />
          {extraFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-bold grid place-items-center">
              {extraFilters}
            </span>
          )}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4">
        {FILTERS.map((f) => (
          <Chip key={f} active={status === f} onClick={() => setStatus(f)}>
            {f === 'all' ? 'All' : f === 'no_order' ? "Hasn't ordered" : STATUS_LABEL[f]} ({count(f)})
          </Chip>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((c) => (
          <Card key={c.id} className="flex items-stretch overflow-hidden">
            <Link to={`/clients/${c.id}`} className="flex-1 min-w-0 p-4 active:bg-slate-50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base truncate">{c.business_name}</span>
                <Pill className={STATUS_STYLE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                {flagged.has(c.id) && <Pill className="bg-amber-100 text-amber-900">Hasn't ordered</Pill>}
              </div>
              <p className="text-sm text-slate-600 mt-0.5">
                {[c.area, c.contact_name, c.order_frequency && FREQUENCY_LABEL[c.order_frequency]].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Last contact: {relativeDay(lastContact.get(c.id))}
              </p>
              {c.product_lines.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {c.product_lines.map((p) => (
                    <Pill key={p} className="bg-slate-100 text-slate-700">{PRODUCT_SHORT[p]}</Pill>
                  ))}
                </div>
              )}
            </Link>
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                aria-label={`Call ${c.business_name}`}
                className="w-16 shrink-0 grid place-items-center text-brand-700 border-l border-slate-100 active:bg-brand-50"
              >
                <Phone size={22} />
              </a>
            )}
          </Card>
        ))}
        {list.length === 0 && (
          <p className="text-center text-slate-500 py-10">{data.clients.length ? 'No matches.' : 'No clients yet. Tap + to add one.'}</p>
        )}
      </div>

      <Link
        to="/clients/import"
        className="mt-6 h-12 rounded-xl border border-dashed border-slate-300 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600"
      >
        <FileUp size={18} /> Bulk add (paste or CSV)
      </Link>

      <Link
        to={status === 'lead' ? '/clients/new?status=lead' : '/clients/new'}
        aria-label="Add client"
        className="fixed right-4 z-10 w-16 h-16 rounded-full bg-orange-500 text-white shadow-lg grid place-items-center active:bg-orange-600"
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={30} />
      </Link>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter & sort">
        <Label>Area</Label>
        <MultiChips options={settings.areas} value={areas} onChange={setAreas} />
        <Label>Buys (all selected)</Label>
        <MultiChips options={PRODUCT_LINES} value={products} onChange={setProducts} labels={PRODUCT_LABEL} />
        <Label>Last contact</Label>
        <ChoiceChips options={CONTACT_FILTERS} value={contact} onChange={(v) => setContact(v ?? 'any')} labels={CONTACT_LABEL} />
        <Label>Sort by</Label>
        <ChoiceChips options={['name', 'contact'] as Sort[]} value={sort} onChange={(v) => setSort(v ?? 'name')} labels={SORT_LABEL} />
        <div className="grid grid-cols-2 gap-2 mt-6">
          <Button
            variant="secondary"
            onClick={() => {
              setAreas([])
              setProducts([])
              setContact('any')
              setSort('name')
            }}
          >
            Reset
          </Button>
          <Button onClick={() => setFiltersOpen(false)}>Show {list.length}</Button>
        </div>
      </Sheet>
    </div>
  )
}
