import { clientToRow, CLIENT_COLUMNS } from './clientCsv'
import { INTERACTION_LABEL } from './constants'
import { downloadFile, toCsv } from './csv'
import { today } from './dates'
import type { DataSet, Settings } from './types'

export function exportData(kind: 'clients' | 'interactions' | 'followups' | 'backup', data: DataSet, settings: Settings) {
  const name = new Map(data.clients.map((c) => [c.id, c.business_name]))
  const stamp = today()
  const byDate = <T extends { date?: string; due_date?: string }>(a: T, b: T) =>
    (b.date ?? b.due_date ?? '').localeCompare(a.date ?? a.due_date ?? '')

  switch (kind) {
    case 'clients':
      return downloadFile(
        `dua-clients-${stamp}.csv`,
        toCsv([...CLIENT_COLUMNS], [...data.clients].sort((a, b) => a.business_name.localeCompare(b.business_name)).map(clientToRow)),
      )
    case 'interactions':
      return downloadFile(
        `dua-interactions-${stamp}.csv`,
        toCsv(
          ['Date', 'Business name', 'Type', 'What was discussed', 'Outcome', 'Next step', 'Next step due'],
          [...data.interactions].sort(byDate).map((i) => [i.date, name.get(i.client_id), INTERACTION_LABEL[i.type], i.notes, i.outcome, i.next_step, i.next_step_due]),
        ),
      )
    case 'followups':
      return downloadFile(
        `dua-followups-${stamp}.csv`,
        toCsv(
          ['Due', 'Business name', 'Task', 'Done', 'Done at'],
          [...data.followups].sort(byDate).map((f) => [f.due_date, f.client_id ? name.get(f.client_id) : '', f.task, f.done ? 'Yes' : 'No', f.done_at]),
        ),
      )
    case 'backup':
      return downloadFile(
        `dua-backup-${stamp}.json`,
        JSON.stringify({ exported_at: new Date().toISOString(), settings, ...data }, null, 2),
        'application/json',
      )
  }
}
