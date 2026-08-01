import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'

export default function CreateContainer({ onClose, onCreated }) {
  const { reference } = useAuth()
  const { t, lang } = useI18n()
  const key = lang === 'ru' ? 'title_ru' : 'title_en'
  const [clients, setClients] = useState([])
  const [form, setForm] = useState({
    container_no: '', container_type: '', client_id: '',
    origin_location: 'poti', dest_location: 'tashkent', apply_corridor_preset: true,
    // стоимость перевозки клиенту (доход) — сразу заводим, чтобы маржа/дебиторка считались
    price: '', currency: 'USD', rate_to_usd: '1', due_date: '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.get('/meta/clients').then(setClients).catch(() => {}) }, [])

  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      const body = {
        client_id: form.client_id ? Number(form.client_id) : null,
        container_type: form.container_type || null,
        container_no: form.container_no || null,
        origin_location: form.origin_location,
        dest_location: form.dest_location,
        apply_corridor_preset: form.apply_corridor_preset,
      }
      const c = await api.post('/containers', body)
      // если указана стоимость — сразу создаём income (freight) для маржи/дебиторки
      if (form.price && Number(form.price) > 0) {
        await api.post(`/containers/${c.id}/charges`, {
          kind: 'income', charge_type: 'freight_rail', amount: Number(form.price),
          currency: form.currency, rate_to_usd: Number(form.rate_to_usd) || 1,
          payment_status: 'unpaid', ...(form.due_date ? { due_date: form.due_date } : {}),
        })
      }
      onCreated(c)
    } finally { setBusy(false) }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const locations = reference?.locations || []
  const types = ['20DC', '40DC', '40HC', 'REEFER', 'OT', 'TANK']

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-graphite/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="card w-full max-w-md p-6"
      >
        <h2 className="text-lg font-bold tracking-tight mb-4">{t('createTitle')}</h2>

        <label className="field-label">{t('client')}</label>
        <select className="input mb-3" value={form.client_id} onChange={set('client_id')}>
          <option value="">— {t('optional')} —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t('containerNo')}</label>
            <input className="input font-mono" placeholder="MSKU1234565" value={form.container_no} onChange={set('container_no')} />
          </div>
          <div>
            <label className="field-label">{t('containerType')}</label>
            <select className="input" value={form.container_type} onChange={set('container_type')}>
              <option value="">—</option>
              {types.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="field-label">{t('route')} — from</label>
            <select className="input" value={form.origin_location} onChange={set('origin_location')}>
              {locations.map((l) => <option key={l.code} value={l.code}>{l[key]}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">to</label>
            <select className="input" value={form.dest_location} onChange={set('dest_location')}>
              {locations.map((l) => <option key={l.code} value={l.code}>{l[key]}</option>)}
            </select>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-chip border border-sea/30 bg-sea-soft px-3 py-2.5 cursor-pointer">
          <input type="checkbox" checked={form.apply_corridor_preset}
            onChange={(e) => setForm({ ...form, apply_corridor_preset: e.target.checked })} />
          <span className="text-sm font-medium text-sea-deep">{t('applyPreset')}</span>
        </label>

        {/* стоимость перевозки клиенту — сразу заводим доход (маржа/дебиторка оживают) */}
        <div className="mt-4 rounded-chip border border-grass/30 bg-grass-soft/50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-grass mb-2">{t('freightPrice')}</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="field-label">{t('amount')}</label>
              <input className="input tabnum" type="number" step="0.01" min="0" placeholder="5000"
                value={form.price} onChange={set('price')} />
            </div>
            <div>
              <label className="field-label">{t('currency')}</label>
              <select className="input" value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value, rate_to_usd: e.target.value === 'USD' ? '1' : form.rate_to_usd })}>
                {(reference?.currencies || []).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {form.currency !== 'USD' && (
              <div>
                <label className="field-label">{t('rate')}</label>
                <input className="input tabnum" type="number" step="0.000001" value={form.rate_to_usd} onChange={set('rate_to_usd')} />
              </div>
            )}
            <div className={form.currency === 'USD' ? 'col-span-2' : ''}>
              <label className="field-label">{t('dueDate')} ({t('optional')})</label>
              <input className="input" type="date" value={form.due_date} onChange={set('due_date')} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary flex-1" disabled={busy}>{busy ? '…' : t('create')}</button>
        </div>
      </form>
    </div>
  )
}
