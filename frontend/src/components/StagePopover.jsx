import { useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'
import { stageTone } from '../lib/format.js'

// Поповер смены стадии: крупная кнопка «→ Следующая» (1 клик) + полный список для откатов.
export default function StagePopover({ container, currentOrder, lookups, onClose, onChanged }) {
  const { reference } = useAuth()
  const { t } = useI18n()
  const stages = reference?.stages || []
  const next = stages.find((s) => s.order > currentOrder)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const change = async (stage_code) => {
    setBusy(true)
    try {
      const updated = await api.post(`/containers/${container.id}/stage`, {
        stage_code, comment: comment.trim() || null,
      })
      onChanged(updated)
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 z-40 w-72 card p-3 shadow-pop text-left">
        {next && (
          <button
            onClick={() => change(next.code)} disabled={busy}
            className="btn-primary w-full mb-2 justify-between"
          >
            <span>→ {lookups.stages[next.code]}</span>
            <span aria-hidden>›</span>
          </button>
        )}
        <input
          className="input mb-2 text-sm" placeholder={t('comment')}
          value={comment} onChange={(e) => setComment(e.target.value)}
        />
        <div className="text-[11px] uppercase tracking-wide text-steel-faint px-1 mb-1">{t('changeStage')}</div>
        <div className="max-h-56 overflow-y-auto -mx-1 px-1">
          {stages.map((s) => {
            const active = s.code === container.current_stage_code
            const tone = stageTone(s.code)
            return (
              <button
                key={s.code} onClick={() => change(s.code)} disabled={busy || active}
                className={`w-full text-left rounded-chip px-2.5 py-1.5 text-sm mb-0.5 flex items-center gap-2 ${active ? 'bg-base-2 text-steel-faint cursor-default' : 'hover:bg-base-2 text-graphite'}`}
              >
                <span className={`h-2 w-2 rounded-full ${tone === 'amber' ? 'bg-amber' : tone === 'grass' ? 'bg-grass' : tone === 'steel' ? 'bg-steel-faint' : 'bg-sea'}`} />
                {lookups.stages[s.code]}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
