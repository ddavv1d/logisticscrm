import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'
import { makeLookups, fmtDateTime, fmtUsd, TRANSPORT_ICON } from '../lib/format.js'
import { StageBadge, StuckPill, Toast, Skeleton } from '../components/ui.jsx'
import StagePopover from '../components/StagePopover.jsx'
import MoneyBlock from '../components/MoneyBlock.jsx'

export default function ContainerDetail() {
  const { id } = useParams()
  const { reference } = useAuth()
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const L = makeLookups(reference, lang)

  const [c, setC] = useState(null)
  const [history, setHistory] = useState([])
  const [popover, setPopover] = useState(false)
  const [toast, setToast] = useState('')

  const load = async () => {
    const [detail, hist] = await Promise.all([
      api.get(`/containers/${id}`), api.get(`/containers/${id}/history`),
    ])
    setC(detail); setHistory(hist)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  if (!c) return <div className="max-w-3xl"><Skeleton rows={4} /></div>

  const legs = c.legs || []
  const curLegSeq = reference?.stages?.find((s) => s.code === c.current_stage_code)?.leg_seq
  const curOrder = reference?.stages?.find((s) => s.code === c.current_stage_code)?.order ?? 0
  const totalLegs = legs.length

  const onStageChanged = (updated) => {
    setC(updated); setPopover(false)
    setToast(t('saved')); setTimeout(() => setToast(''), 2000)
    api.get(`/containers/${id}/history`).then(setHistory)
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* левая колонка: шапка + стадия + история */}
      <div className="lg:col-span-2 space-y-5">
        <button onClick={() => nav('/containers')} className="text-sm text-steel hover:text-graphite">← {t('back')}</button>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tabnum tracking-tight">{c.ref_no}</h1>
                {c.is_stuck && <StuckPill>{c.days_on_stage}{lang === 'ru' ? 'д' : 'd'}</StuckPill>}
              </div>
              {c.container_no && <div className="font-mono text-sm text-steel mt-0.5">{c.container_no} · {c.container_type || '—'}</div>}
              <div className="text-sm text-steel mt-1">{c.client?.name || '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-steel mb-1">{t('legOf')} {curLegSeq || '—'} {t('of')} {totalLegs}</div>
              <div className="relative inline-block">
                <StageBadge code={c.current_stage_code} title={L.stages[c.current_stage_code]} onClick={() => setPopover(true)} />
                {popover && (
                  <StagePopover
                    container={c} currentOrder={curOrder} lookups={L}
                    onClose={() => setPopover(false)} onChanged={onStageChanged}
                  />
                )}
              </div>
            </div>
          </div>

          {/* степпер плеч */}
          <div className="mt-5 flex items-center">
            {legs.map((l, i) => {
              const passed = curLegSeq && l.seq < curLegSeq
              const current = l.seq === curLegSeq
              return (
                <div key={l.id} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex flex-col items-center ${current ? 'text-sea' : passed ? 'text-grass' : 'text-steel-faint'}`}>
                    <div className={`grid h-9 w-9 place-items-center rounded-full border-2 text-base ${current ? 'border-sea bg-sea-soft' : passed ? 'border-grass bg-grass-soft' : 'border-line bg-base-card'}`}>
                      {TRANSPORT_ICON[l.transport_type]}
                    </div>
                    <span className="mt-1 text-[10px] font-medium max-w-[70px] text-center leading-tight">
                      {L.locations[l.from_location]}→{L.locations[l.to_location]}
                    </span>
                  </div>
                  {i < legs.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${passed ? 'bg-grass' : 'bg-line'}`} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* лента истории — append-only */}
        <div className="card p-5">
          <h2 className="font-bold text-sm uppercase tracking-wide text-steel mb-4">{t('history')}</h2>
          <ol className="relative border-l-2 border-line ml-2">
            {history.map((e) => (
              <li key={e.id} className="relative pl-5 pb-4 last:pb-0">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-sea border-2 border-base-card" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-graphite">{L.stages[e.stage_code] || e.stage_code}</span>
                  <span className="text-xs text-steel">· {fmtDateTime(e.changed_at, lang)}</span>
                </div>
                {e.comment && <div className="text-sm text-steel mt-0.5">{e.comment}</div>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* правая колонка: деньги */}
      <div className="space-y-5">
        <MoneyBlock container={c} lookups={L} onChanged={load} />
      </div>

      <Toast show={!!toast} text={toast} />
    </div>
  )
}
