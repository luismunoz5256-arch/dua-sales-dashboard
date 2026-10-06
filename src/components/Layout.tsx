import { CalendarDays, Home, Search, Settings, Target, Users, Sprout } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Button } from './ui'

const TABS = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/week', label: 'Week', icon: CalendarDays },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/leads', label: 'Leads', icon: Sprout },
  { to: '/find', label: 'Find', icon: Search },
]

const TITLES: Record<string, string> = {
  '/': 'Today',
  '/week': 'Week plan',
  '/clients': 'Clients',
  '/leads': 'Leads',
  '/find': 'Find prospects',
  '/goals': 'Goals',
  '/settings': 'Settings',
}

export function Layout() {
  const { ready, loadError, saveError, dismissSaveError, reload, mode } = useStore()
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Dua Sales'

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 bg-brand-700 text-white safe-top">
        <div className="h-14 flex items-center px-4 gap-2 max-w-2xl mx-auto">
          <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
          {mode === 'demo' && <span className="text-[11px] font-semibold bg-white/20 rounded-full px-2 py-0.5">DEMO</span>}
          <Link to="/goals" aria-label="Goals" className="w-11 h-11 grid place-items-center rounded-full active:bg-white/20">
            <Target size={22} />
          </Link>
          <Link to="/settings" aria-label="Settings" className="w-11 h-11 grid place-items-center rounded-full active:bg-white/20">
            <Settings size={22} />
          </Link>
        </div>
      </header>

      {saveError && (
        <div className="bg-red-600 text-white text-sm px-4 py-3 flex items-center gap-3">
          <span className="flex-1">{saveError}</span>
          <button className="font-bold underline" onClick={() => { dismissSaveError(); reload() }}>Reload</button>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pt-3 pb-nav">
        {!ready ? (
          <p className="text-center text-slate-500 py-16">Loading…</p>
        ) : loadError ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-red-700">Couldn't load your data:<br />{loadError}</p>
            <Button onClick={reload}>Try again</Button>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 safe-bottom">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `h-16 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  isActive ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              <Icon size={24} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
