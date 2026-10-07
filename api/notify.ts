/**
 * Push notifications.
 * - Vercel Cron calls GET /api/notify?slot=morning (about 7:30am El Paso) and ?slot=midday (about noon).
 *   Cron requests carry "Authorization: Bearer CRON_SECRET".
 * - POST {test: true} from the signed-in app sends a test notification.
 *
 * Env vars (Vercel > Settings > Environment Variables):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY        push keys (pair); the public one is served to the app
 *   SUPABASE_SERVICE_ROLE_KEY                   lets the scheduled job read your data (server only, never in the app)
 *   CRON_SECRET                                 any long random string
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   already set
 */
process.env.TZ = 'America/Denver' // El Paso time, so "today" is right

import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { withDefaults } from '../src/lib/settings.js'
import { today } from '../src/lib/dates.js'
import { middayMessage, morningMessage, type PushMessage } from '../src/lib/notifyText.js'
import type { DataSet, Settings } from '../src/lib/types.js'
import { bearer, checkOwner, env, readBody, safeEqual, supabaseUrl } from './_lib/server.js'

const TABLES = ['clients', 'interactions', 'followups', 'week_plan', 'day_status'] as const

export default async function handler(req: any, res: any) {
  const url = supabaseUrl()
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  const pub = env('VAPID_PUBLIC_KEY', 'VITE_VAPID_PUBLIC_KEY')
  const priv = env('VAPID_PRIVATE_KEY')
  const cronSecret = env('CRON_SECRET')
  const missing = Object.entries({ VITE_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: service, VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, CRON_SECRET: cronSecret })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  // The public key is meant to be public: the app asks for it when turning notifications on.
  if (req.method === 'GET' && req.query?.publicKey) return res.status(missing.length ? 501 : 200).json({ publicKey: missing.length ? null : pub, missing })
  if (missing.length) return res.status(501).json({ error: 'not_configured', missing })

  // Vercel Cron sends the secret; otherwise it must be the signed-in owner (test button).
  const token = bearer(req)
  const isCron = safeEqual(token, cronSecret!)
  const isUser = !isCron && (await checkOwner(token)).ok
  if (!isCron && !isUser) return res.status(401).json({ error: 'unauthorized' })

  const db = createClient(url!, service!, { auth: { persistSession: false } })
  webpush.setVapidDetails('mailto:noreply@dua-sales.app', pub!, priv!)

  const body = readBody(req)
  const slot = String(req.query?.slot ?? body.slot ?? '')
  let message: PushMessage | null

  if (isUser && body.test) {
    message = { title: 'Dua Sales', body: 'Notifications are working. 🎉', url: '/', tag: 'test' }
  } else {
    const { data: s } = await db.from('settings').select('data').eq('id', 'main').maybeSingle()
    const settings: Settings = withDefaults(s?.data)
    const prefs = { morning: true, midday: true, ...settings.notifications }
    if ((slot === 'morning' && !prefs.morning) || (slot === 'midday' && !prefs.midday)) return res.status(200).json({ sent: 0, reason: 'turned off' })
    const data = { clients: [], interactions: [], followups: [], orders: [], week_plan: [], day_status: [], prospects: [] } as DataSet
    for (const t of TABLES) {
      const { data: rows, error } = await db.from(t).select('*').limit(5000)
      if (error) return res.status(500).json({ error: error.message })
      ;(data[t] as unknown[]) = rows ?? []
    }
    const t = today()
    message = slot === 'morning' ? morningMessage(data, settings, t) : slot === 'midday' ? middayMessage(data, t) : null
    if (!message) return res.status(200).json({ sent: 0, reason: 'nothing to say' })
  }

  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, keys')
  let sent = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(message), { TTL: 4 * 3600 })
      sent++
    } catch (e: any) {
      // Phone unsubscribed or app removed: forget this subscription.
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
  return res.status(200).json({ sent, message })
}
