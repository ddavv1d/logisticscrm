import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'
import { makeLookups, fmtUsd, fmtDateTime } from '../lib/format.js'
import { StatCard, EmptyState, Skeleton } from '../components/ui.jsx'
import CorridorLane from '../components/CorridorLane.jsx'
import { DollarSign, AlertTriangle, TrainFront, Clock, ArrowRight } from '../lib/icons.jsx'

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
        <StatCard label={t('receivable')} value={fmtUsd(d.money.receivable_usd)} tone="sea"
          icon={<DollarSign className="h-4 w-4" strokeWidth={2} />}
          sub={`${t('margin')}: ${fmtUsd(d.money.margin_usd)}`} onClick={() => nav('/receivables')} />
        <StatCard label={t('overdue')} value={fmtUsd(d.money.overdue_usd)} tone="brick"
          icon={<AlertTriangle className="h-4 w-4" strokeWidth={2} />}
          onClick={() => nav('/receivables')} />
        <StatCard label={t('stuck')} value={d.counts.stuck} tone="amber"
          icon={<Clock className="h-4 w-4" strokeWidth={2} />}
          sub={t('whereStuck')} onClick={() => nav('/containers?chip=stuck')} />
        <StatCard label={t('inTransit')} value={d.counts.in_transit} tone="grass"
          icon={<TrainFront className="h-4 w-4" strokeWidth={2} />}
          sub={`${t('delivered')}: ${d.counts.delivered}`} onClick={() => nav('/containers?chip=in_transit')} />
      </div>

      {/* лента коридора — на всю ширину, главный визуал */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm uppercase tracking-wide text-steel">{t('byCorridorStage')}</h2>
          <span className="text-xs text-steel-faint">Грузия → Азербайджан → Каспий → Туркменистан → Узбекистан</span>
        </div>
        <CorridorLane data={d.in_transit} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* застрявшие */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="font-bold text-sm uppercase tracking-wide text-amber mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />{t('stuckContainers')}
          </h2>
          {d.stuck.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Clock className="h-6 w-6 text-grass mb-2" strokeWidth={1.5} />
              <span className="text-sm text-steel">{t('noStuck')}</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {d.stuck.map((s) => (
                <li key={s.id}>
                  <button onClick={() => nav(`/containers/${s.id}`)}
                    className="w-full flex items-center justify-between rounded-chip border border-amber/30 bg-amber-soft/60 px-3 py-2 text-left hover:bg-amber-soft transition-colors">
                    <span className="font-semibold tabnum text-graphite text-sm">{s.ref_no}</span>
                    <span className="text-xs text-amber">{s.stage_title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* лента активности переносится сюда как 2-колоночный блок */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-bold text-sm uppercase tracking-wide text-steel mb-3">{t('activity')}</h2>
          <ul className="divide-y divide-line">
            {activity.slice(0, 6).map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <button onClick={() => nav(`/containers/${a.container_id}`)}
                  className="font-semibold tabnum text-graphite hover:text-sea">{a.ref_no}</button>
                <ArrowRight className="h-3.5 w-3.5 text-steel-faint" strokeWidth={2} />
                <span className="text-steel">{a.stage_title}</span>
                <span className="ml-auto text-xs text-steel-faint">{a.by} · {fmtDateTime(a.at, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </div>
  )
}
