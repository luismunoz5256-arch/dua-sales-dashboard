import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, ComingSoon } from '../components/ui'
import { isNoOrderFlag } from '../lib/actions'
import { today } from '../lib/dates'
import { useStore } from '../lib/store'

export default function TodayPage() {
  const { data, loadSampleData } = useStore()
  const t = today()
  const open = data.followups.filter((f) => !f.done)
  const due = open.filter((f) => f.due_date <= t).length
  const overdue = open.filter((f) => f.due_date < t).length
  const noOrder = new Set(open.filter((f) => f.client_id && isNoOrderFlag(f)).map((f) => f.client_id)).size
  const active = data.clients.filter((c) => c.status === 'active').length
  const atRisk = data.clients.filter((c) => c.status === 'at_risk').length
  const leads = data.clients.filter((c) => c.status === 'lead').length
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  if (data.clients.length === 0) {
    return (
      <Card className="p-6 text-center space-y-4 mt-6">
        <p className="text-lg font-semibold">No clients yet</p>
        <p className="text-slate-600 text-sm">Load the sample accounts to see how things work. You can remove them in Settings later.</p>
        <Button onClick={loadSampleData}>Load sample data</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-500 font-medium">{dateLabel}</p>
      <div className="grid grid-cols-2 gap-2">
        <Stat to="/followups" label="Follow-ups due" value={due} note={overdue ? `${overdue} overdue` : undefined} tone={due ? 'red' : undefined} />
        <Stat to="/clients?status=no_order" label="Hasn't ordered" value={noOrder} tone={noOrder ? 'amber' : undefined} />
        <Stat to="/clients?status=active" label="Active accounts" value={active} note={atRisk ? `+ ${atRisk} at risk` : undefined} />
        <Stat to="/clients?status=lead" label="Leads" value={leads} />
      </div>
      <ComingSoon step={3}>
        <p>Your ranked "Visit today" list grouped by area with a Google Maps route, follow-ups with Done / Snooze, upsell ideas, leads to pursue, clients flagged as hasn't ordered, and one-tap Called / Texted / Visited / No order.</p>
      </ComingSoon>
      <p className="text-sm text-center">
        <Link to="/clients" className="text-brand-700 font-semibold underline">Browse clients →</Link>
      </p>
    </div>
  )
}

const TONE = { red: 'text-red-600', amber: 'text-amber-600' }

function Stat({ to, label, value, note, tone }: { to: string; label: string; value: number; note?: string; tone?: keyof typeof TONE }) {
  return (
    <Link to={to} className="block active:scale-[0.98] transition-transform">
      <Card className="p-4 flex items-center gap-2 active:bg-slate-50">
        <div className="flex-1 min-w-0">
          <div className={`text-3xl font-bold ${tone ? TONE[tone] : ''}`}>{value}</div>
          <div className="text-sm text-slate-600 leading-tight">{label}</div>
          {note && <div className="text-xs text-slate-500 mt-0.5">{note}</div>}
        </div>
        <ChevronRight size={20} className="text-slate-300 shrink-0" />
      </Card>
    </Link>
  )
}
