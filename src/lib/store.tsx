import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend, emptyData, TABLES, withDefaults } from './backend'
import { mergeRows } from './rows'
import { buildSampleData } from './seed'
import type { DataSet, RowOf, Settings, TableName } from './types'

/**
 * The whole data set is small (a few hundred rows), so it is loaded once into memory.
 * Screens read from memory instantly; writes update memory first, then save in the background.
 * Background saves run one at a time, in order, so a row is always saved before rows that refer to it.
 * Callers don't need to await writes; awaiting just waits until that write has been saved.
 */
interface Store {
  ready: boolean
  loadError: string | null
  saveError: string | null
  data: DataSet
  settings: Settings
  mode: 'demo' | 'supabase'
  upsert<T extends TableName>(table: T, rows: RowOf<T> | RowOf<T>[]): Promise<void>
  remove(table: TableName, ids: string | string[]): Promise<void>
  saveSettings(s: Settings): Promise<void>
  loadSampleData(): Promise<void>
  clearSampleData(): Promise<void>
  reload(): Promise<void>
  dismissSaveError(): void
}

const Ctx = createContext<Store | null>(null)
const SEEDED_FLAG = 'dua.demoSeeded'

function applyUpsert<T extends TableName>(data: DataSet, table: T, rows: RowOf<T>[]): DataSet {
  return { ...data, [table]: mergeRows(data[table] as RowOf<T>[], rows) }
}

function applyRemove(data: DataSet, table: TableName, ids: string[]): DataSet {
  const drop = new Set(ids)
  const next = { ...data, [table]: (data[table] as { id: string }[]).filter((r) => !drop.has(r.id)) }
  if (table === 'clients') {
    next.interactions = next.interactions.filter((r) => !drop.has(r.client_id))
    next.followups = next.followups.filter((r) => !r.client_id || !drop.has(r.client_id))
    next.orders = next.orders.filter((r) => !drop.has(r.client_id))
    next.week_plan = next.week_plan.filter((r) => !drop.has(r.client_id))
  }
  return next as DataSet
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [data, setData] = useState<DataSet>(emptyData())
  const [settings, setSettings] = useState<Settings>(withDefaults(null))

  const reload = useCallback(async () => {
    try {
      let loaded = await backend.loadAll()
      // First time in demo mode: fill with sample data so there is something to look at.
      if (backend.kind === 'demo' && !localStorage.getItem(SEEDED_FLAG)) {
        const sample = buildSampleData()
        for (const t of TABLES) await backend.upsert(t, sample[t] as never)
        localStorage.setItem(SEEDED_FLAG, '1')
        loaded = await backend.loadAll()
      }
      setData(loaded.data)
      setSettings(loaded.settings)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const failed = useCallback((e: unknown) => {
    setSaveError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`)
  }, [])

  const queue = useRef<Promise<void>>(Promise.resolve())
  const enqueue = useCallback(
    (job: () => Promise<void>) => {
      const p = queue.current.then(job).catch(failed)
      queue.current = p
      return p
    },
    [failed],
  )

  const upsert = useCallback(
    async <T extends TableName>(table: T, rowOrRows: RowOf<T> | RowOf<T>[]) => {
      const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
      setData((d) => applyUpsert(d, table, rows))
      return enqueue(() => backend.upsert(table, rows))
    },
    [enqueue],
  )

  const remove = useCallback(
    async (table: TableName, idOrIds: string | string[]) => {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
      setData((d) => applyRemove(d, table, ids))
      return enqueue(() => backend.remove(table, ids))
    },
    [enqueue],
  )

  const saveSettings = useCallback(
    async (s: Settings) => {
      setSettings(s)
      return enqueue(() => backend.saveSettings(s))
    },
    [enqueue],
  )

  const loadSampleData = useCallback(async () => {
    const sample = buildSampleData()
    // Parents before children so foreign keys are satisfied (the save queue keeps this order).
    for (const t of TABLES) upsert(t, sample[t] as never)
  }, [upsert])

  const clearSampleData = useCallback(async () => {
    const ids = data.clients.filter((c) => c.is_sample).map((c) => c.id)
    await remove('clients', ids)
  }, [data.clients, remove])

  const value = useMemo<Store>(
    () => ({
      ready,
      loadError,
      saveError,
      data,
      settings,
      mode: backend.kind,
      upsert,
      remove,
      saveSettings,
      loadSampleData,
      clearSampleData,
      reload,
      dismissSaveError: () => setSaveError(null),
    }),
    [ready, loadError, saveError, data, settings, upsert, remove, saveSettings, loadSampleData, clearSampleData, reload],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside DataProvider')
  return s
}
