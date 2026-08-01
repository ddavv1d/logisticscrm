import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'
import { makeLookups } from '../lib/format.js'
import { StageBadge, RouteMini, StuckPill, EmptyState, Skeleton, Toast } from '../components/ui.jsx'
import CreateContainer from '../components/CreateContainer.jsx'

const CHIPS = [
  ['all', 'all'], ['in_transit', 'inTransit'], ['ferry_wait', 'ferryWait'],
  ['stuck', 'stuck'], ['flagged', 'flagged'], ['delivered', 'delivered'],
]

export default function Containers() {
  const { reference } = useAuth()
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const L = makeLookups(reference, lang)

  const [rows, setRows] = useState(null)
  const [counts, setCounts] = useState({})
  const [chip, setChip] = useState('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const params = {}
    if (chip !== 'all') params.chip = chip
    if (search.trim()) params.search = search.trim()
    const q = new URLSearchParams(params).toString()
    const [list, cnt] = await Promise.all([
      api.get(`/containers${q ? '?' + q : ''}`),
      api.get('/containers/counts'),
    ])
    setRows(list); setCounts(cnt)
  }, [chip, search])

  useEffect(() => { load() }, [load])

  const chipCount = (key) => (key === 'all' ? counts.all : counts[key]) ?? 0

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold tracking-tight">{t('containers')}</h1>
        <div className="ml-auto flex items-center gap-2">
          <input
            className="input w-56" placeholder={t('search')}
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
          <a
            href={api.exportUrl({ ...(chip !== 'all' ? { chip } : {}), ...(search.trim() ? { search: search.trim() } : {}) })}
            className="btn-ghost" target="_blank" rel="noreferrer"
          >⇩ {t('exportXlsx')}</a>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ {t('newContainer')}</button>
        </div>
      </div>

      {/* чипы-фильтры со счётчиками */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CHIPS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setChip(key)}
            className={`chip ${chip === key ? 'chip-active' : ''} ${key === 'stuck' && chipCount('stuck') > 0 && chip !== 'stuck' ? '!border-amber/40 !text-amber' : ''}`}
          >
            {key === 'stuck' && <span aria-hidden>⚠</span>}
            {t(label)}
            <span className={`tabnum text-xs ${chip === key ? 'text-white/70' : 'text-steel-faint'}`}>{chipCount(key)}</span>
          </button>
        ))}
      </div>

      {rows === null ? <Skeleton /> : rows.length === 0 ? (
        <EmptyState title={t('empty')} hint={t('search')} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-steel">
                <th className="px-4 py-2.5 font-semibold">{t('ref')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('client')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('route')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('stage')}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t('daysOnStage')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const curLeg = reference?.stages?.find((s) => s.code === c.current_stage_code)?.leg_seq
                return (
                  <tr
                    key={c.id}
                    onClick={() => nav(`/containers/${c.id}`)}
                    className={`border-b border-line last:border-0 cursor-pointer hover:bg-base-2 ${c.is_flagged ? 'bg-amber-soft/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-graphite tabnum">{c.ref_no}</div>
                      {c.container_no && <div className="font-mono text-xs text-steel">{c.container_no}</div>}
                    </td>
                    <td className="px-4 py-3 text-graphite">{c.client?.name || '—'}</td>
                    <td className="px-4 py-3"><RouteMini legs={c.legs} currentLegSeq={curLeg} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StageBadge code={c.current_stage_code} title={L.stages[c.current_stage_code]} />
                        {c.is_stuck && <StuckPill>{c.days_on_stage}д</StuckPill>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabnum text-steel">{c.days_on_stage}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateContainer
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { setShowCreate(false); setToast(c.ref_no); load(); setTimeout(() => setToast(''), 2500); nav(`/containers/${c.id}`) }}
        />
      )}
      <Toast show={!!toast} text={`${t('createTitle')}: ${toast}`} />
    </div>
  )
}
