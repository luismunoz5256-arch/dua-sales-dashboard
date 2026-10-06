import { Phone, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, Chip, Pill } from '../components/ui'
import { FREQUENCY_LABEL, PRODUCT_SHORT, STATUS_LABEL, STATUS_STYLE } from '../lib/constants'
import { relativeDay } from '../lib/dates'
import { useStore } from '../lib/store'
import type { Status } from '../lib/types'

const FILTERS: (Status | 'all')[] = ['all', 'active', 'at_risk', 'lead', 'inactive']

export default function ClientsPage() {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<Status | 'all'>('all')

  const lastContact = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of data.interactions) if ((m.get(i.client_id) ?? '') < i.date) m.set(i.client_id, i.date)
    return m
  }, [data.interactions])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.clients
      .filter((c) => status === 'all' || c.status === status)
      .filter(
        (c) =>
          !needle ||
          [c.business_name, c.contact_name, c.area, c.address].some((v) => v?.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.business_name.localeCompare(b.business_name))
  }, [data.clients, q, status])

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, contact, area"
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-300 bg-white text-base"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4">
        {FILTERS.map((f) => (
          <Chip key={f} active={status === f} onClick={() => setStatus(f)}>
            {f === 'all' ? `All (${data.clients.length})` : STATUS_LABEL[f]}
          </Chip>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((c) => (
          <Card key={c.id} className="p-4 flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base truncate">{c.business_name}</span>
                <Pill className={STATUS_STYLE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
              </div>
              <p className="text-sm text-slate-600 mt-0.5">
                {[c.area, c.contact_name, c.order_frequency && FREQUENCY_LABEL[c.order_frequency]].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Last order: {relativeDay(c.last_order_date)} · Last contact: {relativeDay(lastContact.get(c.id))}
              </p>
              {c.product_lines.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {c.product_lines.map((p) => (
                    <Pill key={p} className="bg-slate-100 text-slate-700">{PRODUCT_SHORT[p]}</Pill>
                  ))}
                </div>
              )}
            </div>
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                aria-label={`Call ${c.business_name}`}
                className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-brand-50 text-brand-700 active:bg-brand-100"
              >
                <Phone size={22} />
              </a>
            )}
          </Card>
        ))}
        {list.length === 0 && <p className="text-center text-slate-500 py-10">No matches.</p>}
      </div>
      <p className="text-xs text-slate-400 text-center mt-6">Client detail, quick-log, add/edit and CSV import arrive in step 2.</p>
    </div>
  )
}
