/** Shared helpers for the Vercel functions (files under api/_lib are not exposed as endpoints). */
import { timingSafeEqual } from 'node:crypto'

/** First non-empty env var, trimmed (values pasted on a phone often pick up a stray space or line break). */
export const env = (...names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean)

export const supabaseUrl = () => env('SUPABASE_URL', 'VITE_SUPABASE_URL')
export const supabaseAnonKey = () => env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')

/** Constant-time string compare, for secrets. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Request body as an object; malformed JSON becomes {} instead of crashing the function. */
export function readBody(req: { body?: unknown }): Record<string, unknown> {
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body || '{}')
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
}

export const bearer = (req: { headers: Record<string, unknown> }) => String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')

/**
 * Is this the app owner? Asks the database's is_owner() check with the caller's own login.
 * If that security update hasn't been installed yet (404), falls back to "any signed-in account"
 * and reports ownerCheck: false so the app can show a warning.
 */
export async function checkOwner(token: string): Promise<{ ok: boolean; ownerCheck: boolean }> {
  const url = supabaseUrl()
  const anon = supabaseAnonKey()
  if (!token || !url || !anon) return { ok: false, ownerCheck: true }
  const headers = { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const r = await fetch(`${url}/rest/v1/rpc/is_owner`, { method: 'POST', headers, body: '{}' })
  if (r.ok) return { ok: (await r.json()) === true, ownerCheck: true }
  if (r.status === 404) {
    const who = await fetch(`${url}/auth/v1/user`, { headers })
    return { ok: who.ok, ownerCheck: false }
  }
  return { ok: false, ownerCheck: true }
}
