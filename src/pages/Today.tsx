import { CheckCircle2, ChevronDown, ChevronRight, Info, MessageSquare, Navigation, Phone, Warehouse } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FollowupRow } from '../components/FollowupRow'
import { QuickLog } from '../components/QuickLog'
import { useToast } from '../components/Toast'
import { Button, Card, Pill, SectionTitle } from '../components/ui'
import { isNoOrderFlag } from '../lib/actions'
import { CONTACT_LABEL, INTERACTION_LABEL, LEAD_STAGE_LABEL, PRODUCT_LABEL, STATUS_LABEL, STATUS_STYLE } from '../lib/constants'
import { daysBetween, relativeDay, today } from '../lib/dates'
import { suggestUpsell, upsellPitch } from '../lib/pitch'
import { planDays, weekDates } from '../lib/plan'
import { dayKind, lastContactMap, type Ranked } from '../lib/priority'
import { directionsUrl, planRoute } from '../lib/route'
import { useStore } from '../lib/store'
import type { Client } from '../lib/types'

export default function TodayPage() {
  const { data, settings, loadSampleData } = useStore()
  const t = today()
  const [showAnyway, setShowAnyway] = useState(false)

  const kind = dayKind(t, settings, data)
  // Same planner as the Week screen, so edits made there show up here.
  const { ranked, day } = useMemo(() => {
    const dates = [...new Set([t, ...weekDates(t)])].sort()
    const plan = planDays(data, settings, dates, t, showAnyway ? [t] : [])
    return { ranked: plan.ranked, day: plan.days.find((d) => d.date === t)! }
  }, [data, settings, t, showAnyway])
  const doneToday = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of data.interactions) if (i.date === t) m.set(i.client_id, INTERACTION_LABEL[i.type])
    return m
  }, [data.interactions, t])
  const lastContact = useMemo(() => lastContactMap(data), [data])
  const names = useMemo(() => new Map(data.clients.map((c) => [c.id, c.business_name])), [data.clients])

  const visits = day.visits
  const visitIds = new Set(visits.map((v) => v.client.id))
  const home = settings.home_base.lat != null && settings.home_base.lng != null ? { lat: settings.home_base.lat, lng: settings.home_base.lng } : null
  const groups = planRoute(home, visits)
  const ordered = groups.flatMap((g) => g.stops)
  const routeAreas = new Set(groups.map((g) => g.area))
  const elsewhere = ranked.filter((r) => !visitIds.has(r.client.id) && !routeAreas.has(r.client.area || 'No area'))
  const nearby = ranked
    .filter((r) => !visitIds.has(r.client.id) && routeAreas.has(r.client.area || 'No area') && !doneToday.has(r.client.id))
    .slice(0, 4)
  const otherAreas = elsewhere.filter((r) => !doneToday.has(r.client.id)).slice(0, 4)
  const remainingStops = ordered.filter((r) => !doneToday.has(r.client.id)).map((r) => r.client)
  const dayRoute = directionsUrl(remainingStops, settings.home_base.address)

  const open = data.followups.filter((f) => !f.done)
  const dueFollowups = open.filter((f) => f.due_date <= t).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const overdue = dueFollowups.filter((f) => f.due_date < t).length
  const noOrder = new Set(open.filter((f) => f.client_id && isNoOrderFlag(f)).map((f) => f.client_id)).size

  // Clients on today's route first (you'll be there anyway), then the ones you've seen least recently.
  const upsells = data.clients
    .filter((c) => (c.status === 'active' || c.status === 'at_risk') && suggestUpsell(c))
    .sort(
      (a, b) =>
        Number(visitIds.has(b.id)) - Number(visitIds.has(a.id)) ||
        Number(routeAreas.has(b.area || '')) - Number(routeAreas.has(a.area || '')) ||
        (lastContact.get(a.id) ?? '').localeCompare(lastContact.get(b.id) ?? ''),
    )
  const leads = useMemo(
    () =>
      data.clients
        .filter((c) => c.status === 'lead' && c.lead_stage !== 'won' && c.lead_stage !== 'lost')
        .filter((c) => {
          const lc = lastContact.get(c.id)
          return !lc || daysBetween(lc, t) >= settings.priority.lead_no_contact_days
        })
        .sort((a, b) => (lastContact.get(a.id) ?? '').localeCompare(lastContact.get(b.id) ?? '')),
    [data.clients, lastContact, settings.priority.lead_no_contact_days, t],
  )

  if (data.clients.length === 0) {
    return (
      <Card className="p-6 text-center space-y-4 mt-6">
        <p className="text-lg font-semibold">No clients yet</p>
        <p className="text-slate-600 text-sm">Load the sample accounts to see how things work. You can remove them in Settings later.</p>
        <Button onClick={loadSampleData}>Load sample data</Button>
      </Card>
    )
  }

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const visitsHidden = kind !== 'field' && !showAnyway
  const doneCount = visits.filter((v) => doneToday.has(v.client.id)).length

  return (
    <div>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-slate-500 font-medium flex-1">{dateLabel}</p>
        <Link to="/settings#ranking" className="text-xs font-semibold text-slate-500 flex items-center gap-1 h-9 px-2 rounded-lg active:bg-slate-200">
          <Info size={14} /> How it's ranked
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mt-2">
        <Stat to="/followups" label="Due" value={dueFollowups.length} sub={overdue ? `${overdue} late` : undefined} tone={dueFollowups.length ? 'text-red-600' : ''} />
        <Stat to="/clients?status=no_order" label="No order" value={noOrder} tone={noOrder ? 'text-amber-600' : ''} />
        <Stat to="/clients?status=active" label="Active" value={data.clients.filter((c) => c.status === 'active').length} />
        <Stat to="/clients?status=lead" label="Leads" value={data.clients.filter((c) => c.status === 'lead').length} />
      </div>

      {/* ---------------- Visit today ---------------- */}
      <SectionTitle right={!visitsHidden && visits.length > 0 && <span className="text-xs font-semibold text-slate-500">{doneCount}/{visits.length} done</span>}>
        Visit today
      </SectionTitle>

      {visitsHidden ? (
        <Card className="p-4 flex items-start gap-3">
          <Warehouse className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{kind === 'warehouse' ? 'Warehouse day' : 'Day off'}: no visits planned.</p>
            <p className="text-sm text-slate-600">Calls, texts and follow-ups are below.</p>
            <button onClick={() => setShowAnyway(true)} className="mt-2 text-sm font-semibold text-brand-700 underline">
              Show visit list anyway
            </button>
          </div>
        </Card>
      ) : visits.length === 0 ? (
        <Card className="p-4 text-sm text-slate-600">Nobody needs a visit right now. Nice work.</Card>
      ) : (
        <>
          {dayRoute && (
            <a
              href={dayRoute}
              target="_blank"
              rel="noreferrer"
              className="mb-3 h-14 rounded-xl bg-brand-700 active:bg-brand-800 text-white font-semibold flex items-center justify-center gap-2"
            >
              <Navigation size={20} /> Open today's route in Google Maps
            </a>
          )}
          <div className="space-y-4">
            {groups.map((g) => {
              const areaRoute = directionsUrl(g.stops.filter((s) => !doneToday.has(s.client.id)).map((s) => s.client))
              return (
                <div key={g.area}>
                  <div className="flex items-center gap-2 px-1 mb-1.5">
                    <h3 className="font-bold text-slate-800 flex-1">
                      {g.area} <span className="font-normal text-slate-500 text-sm">· {g.stops.length} stop{g.stops.length > 1 ? 's' : ''}</span>
                    </h3>
                    {areaRoute && (
                      <a href={areaRoute} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-white border border-slate-300 text-sm font-semibold flex items-center gap-1 active:bg-slate-100">
                        <Navigation size={14} /> Route
                      </a>
                    )}
                  </div>
                  <div className="space-y-2">
                    {g.stops.map((r) => (
                      <VisitCard key={r.client.id} r={r} done={doneToday.get(r.client.id)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {groups.length > 0 && (
            <p className="text-xs text-slate-500 px-1 mt-3">
              Today's focus: {groups.map((g) => g.area).join(' → ')}.{' '}
              {day.saved ? (
                <>
                  You adjusted this day in the <Link to="/week" className="underline">Week plan</Link>.
                </>
              ) : (
                'Picked the area that needs you most, then the closest areas.'
              )}
            </p>
          )}
          {nearby.length > 0 && (
            <Collapsible title={`If you have time, nearby (${nearby.length})`}>
              <div className="space-y-2">
                {nearby.map((r) => (
                  <VisitCard key={r.client.id} r={r} />
                ))}
              </div>
            </Collapsible>
          )}
          {otherAreas.length > 0 && (
            <Collapsible title={`Also needs attention, other areas (${otherAreas.length})`}>
              <p className="text-xs text-slate-500 px-1 mb-2">Not on today's route. Call or text them, or catch them on another day.</p>
              <div className="space-y-2">
                {otherAreas.map((r) => (
                  <VisitCard key={r.client.id} r={r} showArea />
                ))}
              </div>
            </Collapsible>
          )}
        </>
      )}

      {/* ---------------- Follow-ups ---------------- */}
      <SectionTitle right={<SeeAll to="/followups" />}>Follow-ups due ({dueFollowups.length})</SectionTitle>
      {dueFollowups.length === 0 ? (
        <p className="text-sm text-slate-500 px-1">All caught up.</p>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {dueFollowups.slice(0, 6).map((f) => (
            <FollowupRow key={f.id} f={f} clientName={f.client_id ? names.get(f.client_id) : undefined} />
          ))}
          {dueFollowups.length > 6 && (
            <Link to="/followups" className="block p-3 text-center text-sm font-semibold text-brand-700">
              See all {dueFollowups.length}
            </Link>
          )}
        </Card>
      )}

      {/* ---------------- Upsell ---------------- */}
      <SectionTitle>Upsell opportunities ({upsells.length})</SectionTitle>
      {upsells.length === 0 ? (
        <p className="text-sm text-slate-500 px-1">Every active client buys all product lines.</p>
      ) : (
        <ShowMore items={upsells} initial={3} render={(c) => <UpsellCard key={c.id} c={c} onRoute={visitIds.has(c.id)} />} />
      )}

      {/* ---------------- Leads ---------------- */}
      <SectionTitle right={<SeeAll to="/clients?status=lead" />}>Leads to pursue ({leads.length})</SectionTitle>
      {leads.length === 0 ? (
        <p className="text-sm text-slate-500 px-1">All leads contacted in the last {settings.priority.lead_no_contact_days} days.</p>
      ) : (
        <ShowMore
          items={leads}
          initial={4}
          render={(c) => <LeadCard key={c.id} c={c} lastContact={lastContact.get(c.id)} onRoute={visitIds.has(c.id)} />}
        />
      )}
    </div>
  )
}

function Stat({ to, label, value, sub, tone = '' }: { to: string; label: string; value: number; sub?: string; tone?: string }) {
  return (
    <Link to={to} className="bg-white rounded-xl border border-slate-200 shadow-sm py-2 text-center active:bg-slate-50">
      <div className={`text-2xl font-bold leading-tight ${tone}`}>{value}</div>
      <div className="text-[11px] text-slate-600 font-semibold">{label}</div>
      {sub && <div className="text-[10px] text-red-600 font-semibold">{sub}</div>}
    </Link>
  )
}

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="text-sm font-semibold text-brand-700 flex items-center h-8">
      See all <ChevronRight size={16} />
    </Link>
  )
}

function ClientHeader({ c, right }: { c: Client; right?: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Link to={`/clients/${c.id}`} className="flex-1 min-w-0 active:opacity-70">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-base">{c.business_name}</span>
          {c.status !== 'active' && <Pill className={STATUS_STYLE[c.status]}>{STATUS_LABEL[c.status]}</Pill>}
        </div>
        <p className="text-xs text-slate-500">
          {[c.contact_name, c.preferred_contact && `prefers ${CONTACT_LABEL[c.preferred_contact].toLowerCase()}`].filter(Boolean).join(' · ')}
        </p>
      </Link>
      {right}
      {c.phone && (
        <a href={`tel:${c.phone}`} aria-label={`Call ${c.business_name}`} className="w-11 h-11 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center active:bg-brand-100">
          <Phone size={20} />
        </a>
      )}
    </div>
  )
}

function VisitCard({ r, done, showArea }: { r: Ranked; done?: string; showArea?: boolean }) {
  const [why, setWhy] = useState(false)
  return (
    <Card className={`p-3 ${done ? 'opacity-60' : ''}`}>
      <ClientHeader
        c={r.client}
        right={done && <span className="text-brand-700 text-xs font-bold flex items-center gap-1 h-11"><CheckCircle2 size={18} /> {done}</span>}
      />
      <button onClick={() => setWhy(!why)} className="w-full text-left mt-1.5 mb-2">
        <p className="text-sm text-slate-800">
          {showArea && r.client.area && <span className="font-semibold text-slate-500">{r.client.area} · </span>}
          <span className="font-semibold text-orange-700">Why: </span>
          {r.reasons.length ? r.reasons.slice(0, 2).map((x) => x.text).join(' · ') : 'You added this stop'}
          {r.reasons.length > 2 && <span className="text-slate-500"> +{r.reasons.length - 2}</span>}
        </p>
      </button>
      {why && (
        <div className="mb-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 space-y-0.5">
          {r.reasons.map((x) => (
            <p key={x.key} className="flex gap-2">
              <span className="flex-1">{x.text}</span>
              <span className="font-semibold">+{Math.round(x.points * 10) / 10}</span>
            </p>
          ))}
          <p className="flex gap-2 border-t border-slate-200 pt-1 font-bold text-slate-700">
            <span className="flex-1">Priority score</span>
            <span>{r.score}</span>
          </p>
        </div>
      )}
      {!done && <QuickLog client={r.client} size="sm" />}
    </Card>
  )
}

function UpsellCard({ c, onRoute }: { c: Client; onRoute: boolean }) {
  const toast = useToast()
  const line = suggestUpsell(c)!
  const pitch = upsellPitch(c, line)
  return (
    <Card className="p-3">
      <ClientHeader c={c} right={onRoute && <Pill className="bg-brand-100 text-brand-800 self-center">On route</Pill>} />
      <p className="text-sm mt-2">
        <span className="font-semibold text-orange-700">Pitch {PRODUCT_LABEL[line].toLowerCase()}.</span>{' '}
        <span className="text-slate-500">Buys {c.product_lines.map((p) => PRODUCT_LABEL[p].toLowerCase()).join(', ')}.</span>
      </p>
      <p className="text-sm text-slate-700 italic bg-orange-50 rounded-lg p-2.5 mt-1.5">“{pitch}”</p>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {c.phone ? (
          <a href={`sms:${c.phone}?body=${encodeURIComponent(pitch)}`} className="h-11 rounded-xl bg-slate-100 active:bg-slate-200 font-semibold text-sm flex items-center justify-center gap-1.5">
            <MessageSquare size={16} /> Text this
          </a>
        ) : (
          <span />
        )}
        <button
          onClick={() => navigator.clipboard?.writeText(pitch).then(() => toast('Pitch copied'), () => toast("Couldn't copy"))}
          className="h-11 rounded-xl bg-slate-100 active:bg-slate-200 font-semibold text-sm"
        >
          Copy
        </button>
      </div>
      <Collapsible title="Log" small>
        <QuickLog client={c} size="sm" />
      </Collapsible>
    </Card>
  )
}

function LeadCard({ c, lastContact, onRoute }: { c: Client; lastContact: string | undefined; onRoute: boolean }) {
  return (
    <Card className="p-3">
      <ClientHeader c={c} right={onRoute && <Pill className="bg-brand-100 text-brand-800 self-center">On route</Pill>} />
      <p className="text-sm text-slate-700 mt-1.5">
        {[c.lead_stage && LEAD_STAGE_LABEL[c.lead_stage], c.area, lastContact ? `last contact ${relativeDay(lastContact).toLowerCase()}` : 'never contacted']
          .filter(Boolean)
          .join(' · ')}
      </p>
      <Collapsible title="Log" small>
        <QuickLog client={c} size="sm" />
      </Collapsible>
    </Card>
  )
}

function Collapsible({ title, children, small }: { title: string; children: ReactNode; small?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={small ? 'mt-1' : 'mt-3'}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 font-semibold text-slate-600 ${small ? 'text-xs h-9' : 'text-sm h-10 px-1'}`}
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} /> {title}
      </button>
      {open && <div className={small ? '' : 'mt-1'}>{children}</div>}
    </div>
  )
}

function ShowMore<T>({ items, initial, render }: { items: T[]; initial: number; render: (item: T) => ReactNode }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, initial)
  return (
    <div className="space-y-2">
      {shown.map(render)}
      {items.length > initial && (
        <button onClick={() => setAll(!all)} className="w-full h-11 text-sm font-semibold text-brand-700">
          {all ? 'Show fewer' : `Show ${items.length - initial} more`}
        </button>
      )}
    </div>
  )
}
