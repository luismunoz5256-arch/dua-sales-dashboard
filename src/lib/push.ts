import { supabase } from './backend'

/** Settings the server says it's missing (shown in Settings > Notifications). */
export let pushMissing: string[] = []

/** The server hands out the push public key (it's safe to share), so no build-time setting is needed. */
async function publicKey(): Promise<string | null> {
  try {
    const j = await (await fetch('/api/notify?publicKey=1', { cache: 'no-store' })).json()
    pushMissing = j.missing ?? []
    return j.publicKey ?? null
  } catch {
    pushMissing = []
    return null
  }
}

export type PushState = 'unsupported' | 'not_configured' | 'denied' | 'off' | 'on'

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (!supabase || !(await publicKey())) return 'not_configured'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Ask permission, subscribe this phone, and save the subscription so the server can reach it. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  const key = await publicKey()
  if (!key || !supabase) return 'not_configured'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: json.endpoint, keys: json.keys }, { onConflict: 'endpoint' })
  if (error) throw error
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}

export async function sendTestPush(): Promise<string> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({ test: true }),
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 501) return `Server setup incomplete: missing ${(json.missing ?? []).join(', ')}`
  if (!res.ok) return `Test failed (${json.error ?? res.status})`
  return json.sent ? 'Test sent. It should pop up in a few seconds.' : 'No phone is subscribed yet.'
}
