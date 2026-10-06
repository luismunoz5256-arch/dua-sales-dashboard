import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/backend'
import { Button } from './ui'

/** In demo mode (no Supabase configured) there is no login. Otherwise: one email + password. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) return <>{children}</>
  if (session === undefined) return <div className="p-8 text-center text-slate-500">Loading…</div>
  if (!session) return <Login />
  return <>{children}</>
}

function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('dua.email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(error.message)
    else localStorage.setItem('dua.email', email)
  }

  return (
    <div className="min-h-full flex flex-col justify-center px-6 safe-top">
      <img src="/icon.svg" alt="" className="w-24 h-24 mx-auto mb-4 rounded-3xl shadow-md" />
      <h1 className="text-2xl font-bold text-center">Dua Route</h1>
      <p className="text-slate-500 text-center mb-8">Dua Food sales</p>
      <form onSubmit={submit} className="space-y-4 max-w-sm w-full mx-auto">
        <input
          type="email" autoComplete="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-14 px-4 rounded-xl border border-slate-300 text-lg bg-white"
        />
        <input
          type="password" autoComplete="current-password" required placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-14 px-4 rounded-xl border border-slate-300 text-lg bg-white"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  )
}
