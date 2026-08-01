import { useEffect, useState, Suspense, lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'
import { makeLookups, fmtUsd, fmtDateTime } from '../lib/format.js'
import { StatCard, EmptyState, Skeleton } from '../components/ui.jsx'

const StageChart = lazy(() => import('../components/StageChart.jsx'))

export default function Dashboard() {
  const { reference } = useAuth()
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const L = makeLookups(reference, lang)
  const [d, setD] = useState(null)
  const [activity, setActivity] = useState([])

  useEffect(() => {
    api.get('/dashboard').then(setD).catch(() => {})
    api.get('/dashboard/activity').then(setActivity).catch(() => {})
  }, [])

  if (!d) return <div className="space-y-5"><Skeleton rows={3} /></div>

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight">{t('dashboard')}</h1>

      {/* 4 крупных числа сверху */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('receivable')} value={fmtUsd(d.money.receivable_usd)} tone="sea" icon="$"
          sub={`${t('margin')}: ${fmtUsd(d.money.margin_usd)}`} onClick={() => nav('/receivables')} />
        <StatCard label={t('overdue')} value={fmtUsd(d.money.overdue_usd)} tone="brick" icon="!"
          onClick={() => nav('/receivables')} />
        <StatCard label={t('stuck')} value={d.counts.stuck} tone="amber" icon="⚠"
          sub={t('whereStuck')} onClick={() => nav('/containers?chip=stuck')} />
        <StatCard label={t('inTransit')} value={d.counts.in_transit} tone="grass" icon="🚆"
          sub={`${t('delivered')}: ${d.counts.delivered}`} onClick={() => nav('/containers?chip=in_transit')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* застрявшие */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="font-bold text-sm uppercase tracking-wide text-amber mb-3 flex items-center gap-2">
            <span aria-hidden>⚠</span>{t('stuckContainers')}
          </h2>
          {d.stuck.length === 0 ? (
            <div className="text-sm text-steel py-4 text-center">{t('noStuck')}</div>
          ) : (
            <ul className="space-y-2">
              {d.stuck.map((s) => (
                <li key={s.id}>
                  <button onClick={() => nav(`/containers/${s.id}`)}
                    className="w-full flex items-center justify-between rounded-chip border border-amber/30 bg-amber-soft/60 px-3 py-2 text-left hover:bg-amber-soft">
                    <span className="font-semibold tabnum text-graphite text-sm">{s.ref_no}</span>
                    <span className="text-xs text-amber">{s.stage_title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* график по этапам */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-bold text-sm uppercase tracking-wide text-steel mb-3">{t('byCorridorStage')}</h2>
          {d.in_transit.length === 0 ? (
            <EmptyState title="—" />
          ) : (
            <Suspense fallback={<div className="h-56 animate-pulse rounded bg-base-2" />}>
              <StageChart data={d.in_transit} />
            </Suspense>
          )}
        </div>
      </div>

      {/* лента активности */}
      <div className="card p-5">
        <h2 className="font-bold text-sm uppercase tracking-wide text-steel mb-3">{t('activity')}</h2>
        <ul className="divide-y divide-line">
          {activity.map((a, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              <button onClick={() => nav(`/containers/${a.container_id}`)}
                className="font-semibold tabnum text-graphite hover:text-sea">{a.ref_no}</button>
              <span className="text-steel">→ {a.stage_title}</span>
              <span className="ml-auto text-xs text-steel-faint">{a.by} · {fmtDateTime(a.at, lang)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
