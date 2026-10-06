import { FileUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TextArea } from '../components/fields'
import { useToast } from '../components/Toast'
import { Button, Card, Pill, SectionTitle } from '../components/ui'
import { CLIENT_COLUMNS, previewImport } from '../lib/clientCsv'
import { STATUS_LABEL, STATUS_STYLE } from '../lib/constants'
import { downloadFile, toCsv } from '../lib/csv'
import { useStore } from '../lib/store'

const EXAMPLE = `Business name, Contact name, Phone, Address, Area
Tacos Don Chuy, Chuy, 915-555-0199, 1234 Alameda Ave, Lower Valley
Bistro 915, Sarah, 915-555-0188, 500 N Stanton St, Downtown`

export default function ImportPage() {
  const { data, settings, upsert } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [includeDupes, setIncludeDupes] = useState(false)

  const preview = useMemo(
    () => (text.trim() ? previewImport(text, data.clients, settings.areas) : null),
    [text, data.clients, settings.areas],
  )
  const valid = preview?.rows.filter((r) => r.client) ?? []
  const toImport = valid.filter((r) => includeDupes || !r.duplicate)
  const dupes = valid.filter((r) => r.duplicate).length
  const bad = preview?.rows.filter((r) => !r.client).length ?? 0

  async function readFile(f: File) {
    setText(await f.text())
  }

  function doImport() {
    const clients = toImport.map((r) => r.client!)
    upsert('clients', clients)
    toast(`Imported ${clients.length} client${clients.length === 1 ? '' : 's'}`)
    navigate('/clients', { replace: true })
  }

  function template() {
    downloadFile(
      'dua-clients-template.csv',
      toCsv([...CLIENT_COLUMNS], [
        ['Casa Luna Cocina', 'Marisol', '915-555-0101', '5860 N Mesa St, El Paso, TX', 'West Side', 'Active', '',
          'Produce; Prepped veggies', '2x / week', 450, '2026-09-28', 430, 'Visit', '2026-03-01', 'Chef-owner', 'Casa Luna Cocina LLC'],
        ['Blend Smoothie Bar', '', '915-555-0112', '4800 Hondo Pass Dr, El Paso, TX', 'Northeast', 'Lead', 'New',
          '', '', '', '', '', 'Visit', '', '', ''],
      ]),
    )
  }

  return (
    <div>
      <Card className="p-4 text-sm text-slate-600 space-y-2">
        <p>
          Paste rows from a spreadsheet (Google Sheets, Excel) or a CSV, <b>including the header row</b>. Only “Business
          name” is required. Other columns are matched automatically: contact, phone, address, area, status, products,
          frequency, order size, last order, notes…
        </p>
        <p>No header? Each line is read as: name, contact, phone, address, area.</p>
      </Card>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <FileUp size={18} /> CSV file
        </Button>
        <Button variant="secondary" onClick={template}>
          Get template
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
      />

      <SectionTitle right={text && <button className="text-sm font-semibold text-slate-500" onClick={() => setText('')}>Clear</button>}>
        Paste here
      </SectionTitle>
      <TextArea value={text} onChange={setText} rows={6} placeholder={EXAMPLE} />

      {preview && (
        <>
          {preview.mapped.length > 0 && (
            <p className="text-xs text-slate-500 mt-3 px-1">
              Columns:{' '}
              {preview.mapped.map((m, i) => (
                <span key={i} className={m.column ? 'text-slate-700' : 'line-through'}>
                  {m.header}
                  {m.column && m.column !== m.header ? ` → ${m.column}` : ''}
                  {i < preview.mapped.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          )}
          {preview.headerless && <p className="text-xs text-amber-700 mt-3 px-1">No header row found: reading columns as name, contact, phone, address, area.</p>}

          <SectionTitle>
            Preview · {toImport.length} to add{dupes ? ` · ${dupes} already exist` : ''}{bad ? ` · ${bad} skipped` : ''}
          </SectionTitle>
          {dupes > 0 && (
            <label className="flex items-center gap-3 px-1 mb-2 text-sm">
              <input type="checkbox" className="w-5 h-5" checked={includeDupes} onChange={(e) => setIncludeDupes(e.target.checked)} />
              Add duplicates anyway
            </label>
          )}
          <Card className="divide-y divide-slate-100">
            {preview.rows.slice(0, 100).map((r) => (
              <div key={r.line} className={`p-3 text-sm ${!r.client || (r.duplicate && !includeDupes) ? 'opacity-50' : ''}`}>
                {r.client ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{r.client.business_name}</span>
                      <Pill className={STATUS_STYLE[r.client.status]}>{STATUS_LABEL[r.client.status]}</Pill>
                      {r.duplicate && <Pill className="bg-amber-100 text-amber-800">Already exists</Pill>}
                    </div>
                    <p className="text-slate-500">{[r.client.area, r.client.contact_name, r.client.phone].filter(Boolean).join(' · ') || '—'}</p>
                  </>
                ) : (
                  <p className="text-red-600">Line {r.line}: {r.problem}</p>
                )}
              </div>
            ))}
          </Card>
          <Button className="w-full mt-4 h-14 text-lg" disabled={!toImport.length} onClick={doImport}>
            Import {toImport.length} client{toImport.length === 1 ? '' : 's'}
          </Button>
        </>
      )}
    </div>
  )
}
