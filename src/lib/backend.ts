import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withDefaults } from './settings'
import type { DataSet, RowOf, Settings, TableName } from './types'

export const TABLES: TableName[] = ['clients', 'interactions', 'followups', 'orders', 'week_plan', 'day_status', 'prospects']

export function emptyData(): DataSet {
  return { clients: [], interactions: [], followups: [], orders: [], week_plan: [], day_status: [], prospects: [] }
}

export { withDefaults } from './settings'

export interface Backend {
  kind: 'demo' | 'supabase'
  loadAll(): Promise<{ data: DataSet; settings: Settings }>
  upsert<T extends TableName>(table: T, rows: RowOf<T>[]): Promise<void>
  remove(table: TableName, ids: string[]): Promise<void>
  saveSettings(settings: Settings): Promise<void>
}

// ---------- Demo mode: everything in this browser's localStorage ----------

const LS_DATA = 'dua.data.v1'
const LS_SETTINGS = 'dua.settings.v1'

export class LocalBackend implements Backend {
  kind = 'demo' as const

  private read(): DataSet {
    try {
      const raw = localStorage.getItem(LS_DATA)
      return raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData()
    } catch {
      return emptyData()
    }
  }

  private write(data: DataSet) {
    localStorage.setItem(LS_DATA, JSON.stringify(data))
  }

  async loadAll() {
    let settings: Partial<Settings> | null = null
    try {
      settings = JSON.parse(localStorage.getItem(LS_SETTINGS) ?? 'null')
    } catch {
      /* ignore corrupt settings */
    }
    return { data: this.read(), settings: withDefaults(settings) }
  }

  async upsert<T extends TableName>(table: T, rows: RowOf<T>[]) {
    const data = this.read()
    const list = data[table] as RowOf<T>[]
    for (const row of rows) {
      const i = list.findIndex((r) => r.id === row.id)
      if (i >= 0) list[i] = row
      else list.push(row)
    }
    this.write(data)
  }

  async remove(table: TableName, ids: string[]) {
    const data = this.read()
    const drop = new Set(ids)
    ;(data[table] as { id: string }[]) = (data[table] as { id: string }[]).filter((r) => !drop.has(r.id))
    if (table === 'clients') {
      // mimic "on delete cascade"
      for (const t of ['interactions', 'followups', 'orders', 'week_plan'] as const) {
        ;(data[t] as { client_id: string | null }[]) = (data[t] as { client_id: string | null }[]).filter(
          (r) => !r.client_id || !drop.has(r.client_id),
        )
      }
    }
    this.write(data)
  }

  async saveSettings(settings: Settings) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
  }
}

// ---------- Hosted mode: Supabase ----------

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export class SupabaseBackend implements Backend {
  kind = 'supabase' as const
  constructor(private sb: SupabaseClient) {}

  async loadAll() {
    const data = emptyData()
    await Promise.all(
      TABLES.map(async (t) => {
        // Supabase returns at most 1000 rows per request; page through.
        const rows: unknown[] = []
        for (let from = 0; ; from += 1000) {
          const { data: page, error } = await this.sb.from(t).select('*').range(from, from + 999)
          if (error) throw error
          rows.push(...page)
          if (page.length < 1000) break
        }
        ;(data[t] as unknown[]) = rows
      }),
    )
    const { data: s, error } = await this.sb.from('settings').select('data').eq('id', 'main').maybeSingle()
    if (error) throw error
    return { data, settings: withDefaults(s?.data) }
  }

  async upsert<T extends TableName>(table: T, rows: RowOf<T>[]) {
    if (!rows.length) return
    const { error } = await this.sb.from(table).upsert(rows)
    if (error) throw error
  }

  async remove(table: TableName, ids: string[]) {
    if (!ids.length) return
    const { error } = await this.sb.from(table).delete().in('id', ids)
    if (error) throw error
  }

  async saveSettings(settings: Settings) {
    const { error } = await this.sb.from('settings').upsert({ id: 'main', data: settings })
    if (error) throw error
  }
}

export const backend: Backend = supabase ? new SupabaseBackend(supabase) : new LocalBackend()
