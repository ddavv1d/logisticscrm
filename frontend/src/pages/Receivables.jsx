import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useI18n } from '../lib/i18n.js'
import { fmtUsd } from '../lib/format.js'
import { EmptyState, Skeleton } from '../components/ui.jsx'

export default function Receivables() {
  const { t } = useI18n()
  const [rows, setRows] = useState(null)

  useEffect(() => { api.get('/dashboard/receivables').then(setRows).catch(() => setRows([])) }, [])

  if (rows === null) return <Skeleton rows={5} />

  const total = rows.reduce((s, r) => s + r.outstanding_usd, 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold tracking-tight">{t('receivables')}</h1>
        <span className="ml-auto text-sm text-steel">{t('receivable')}: <b className="text-graphite tabnum">{fmtUsd(total)}</b></span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="—" icon="💰" />
      ) : (
        <div className="card overflow-hidden max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-steel">
                <th className="px-4 py-2.5 font-semibold">{t('client')}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t('outstanding')} (USD)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-graphite">{r.client}</td>
                  <td className="px-4 py-3 text-right tabnum font-semibold text-brick">{fmtUsd(r.outstanding_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
