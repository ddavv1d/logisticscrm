import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useI18n } from '../lib/i18n.js'
import { fmtUsd } from '../lib/format.js'
import { EmptyState, Skeleton } from '../components/ui.jsx'
import { DollarSign } from 'lucide-react'

export default function Receivables() {
  const { t } = useI18n()
  const [rows, setRows] = useState(null)

  useEffect(() => { api.get('/dashboard/receivables').then(setRows).catch(() => setRows([])) }, [])

  if (rows === null) return <Skeleton rows={5} />

  const total = rows.reduce((s, r) => s + r.outstanding_usd, 0)
  const max = Math.max(...rows.map((r) => r.outstanding_usd), 1)
  const top = rows[0]

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight mb-4">{t('receivables')}</h1>

      {rows.length === 0 ? (
        <div className="card"><EmptyState title="Долгов нет" hint="Все инвойсы оплачены" icon={<DollarSign className="h-6 w-6" strokeWidth={1.5} />} /></div>
      ) : (
        <>
          {/* саммари-карточки */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="card border-t-[3px] border-t-brick p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel">{t('receivable')}</div>
              <div className="text-[32px] font-extrabold tabnum text-graphite mt-1 leading-none">{fmtUsd(total)}</div>
              <div className="mt-1.5 text-xs text-steel">{rows.length} клиент(ов) с долгом</div>
            </div>
            <div className="card border-t-[3px] border-t-amber p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel">Крупнейший должник</div>
              <div className="text-lg font-bold text-graphite mt-1 truncate">{top.client}</div>
              <div className="mt-1 text-xl font-extrabold tabnum text-brick leading-none">{fmtUsd(top.outstanding_usd)}</div>
            </div>
          </div>

          {/* таблица с барами-долями */}
          <div className="card p-2">
            <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-steel-faint">Кто сколько должен</div>
            {rows.map((r) => (
              <div key={r.client} className="px-3 py-2.5 border-b border-line last:border-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-graphite truncate pr-3">{r.client}</span>
                  <span className="text-sm font-bold tabnum text-brick whitespace-nowrap">{fmtUsd(r.outstanding_usd)}</span>
                </div>
                <div className="share-track">
                  <div className="share-fill bg-brick/70" style={{ width: `${Math.max(6, (r.outstanding_usd / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
