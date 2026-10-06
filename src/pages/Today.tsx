import { Link } from 'react-router-dom'
import { Button, Card, ComingSoon } from '../components/ui'
import { today } from '../lib/dates'
import { useStore } from '../lib/store'

export default function TodayPage() {
  const { data, loadSampleData } = useStore()
  const t = today()
  const due = data.followups.filter((f) => !f.done && f.due_date <= t).length
  const active = data.clients.filter((c) => c.status === 'active' || c.status === 'at_risk').length
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
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Follow-ups due" value={due} />
        <Stat label="Accounts" value={active} />
        <Stat label="Leads" value={leads} />
      </div>
      <ComingSoon step={3}>
        <p>Your ranked "Visit today" list grouped by area with a Google Maps route, follow-ups with Done / Snooze, upsell ideas, leads to pursue, and one-tap Called / Texted / Visited / Ordered.</p>
      </ComingSoon>
      <p className="text-sm text-center">
        <Link to="/clients" className="text-brand-700 font-semibold underline">Browse clients →</Link>
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 leading-tight">{label}</div>
    </Card>
  )
}
