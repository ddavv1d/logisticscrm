import { useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'
import { fmtUsd, fmtMoney } from '../lib/format.js'

const PAY_TONE = { paid: 'text-grass', partial: 'text-amber', unpaid: 'text-steel' }

export default function MoneyBlock({ container, lookups, onChanged }) {
  const { user, reference } = useAuth()
  const { t, lang } = useI18n()
  const [adding, setAdding] = useState(false)

  if (!user?.can_see_money || !container.money) {
    return (
      <div className="card p-5 text-sm text-steel">
        <h2 className="font-bold text-sm uppercase tracking-wide text-steel mb-2">{t('money')}</h2>
        {t('noMoney')}
      </div>
    )
  }

  const m = container.money
  const charges = container.charges || []
  const income = charges.filter((c) => c.kind === 'income')
  const expense = charges.filter((c) => c.kind === 'expense')

  return (
    <>
      {/* маржа-карточка */}
      <div className="card border-t-[3px] border-t-grass p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-steel">{t('margin')}</div>
        <div className="text-3xl font-extrabold tabnum text-graphite mt-1">{fmtUsd(m.margin_usd)}</div>
        <div className="mt-2 flex gap-4 text-sm">
          <span className="text-steel">{t('income')}: <b className="text-grass tabnum">{fmtUsd(m.income_usd)}</b></span>
          <span className="text-steel">{t('expense')}: <b className="text-brick tabnum">{fmtUsd(m.expense_usd)}</b></span>
        </div>
      </div>

      {/* строки денег */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm uppercase tracking-wide text-steel">{t('money')}</h2>
          <button className="text-sm text-sea font-semibold hover:text-sea-deep" onClick={() => setAdding(true)}>+ {t('addCharge')}</button>
        </div>
        <ChargeList title={t('income')} rows={income} lookups={lookups} lang={lang} />
        <ChargeList title={t('expense')} rows={expense} lookups={lookups} lang={lang} />
      </div>

      {adding && (
        <AddCharge
          container={container} reference={reference} lookups={lookups}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); onChanged() }}
        />
      )}
    </>
  )
}

function ChargeList({ title, rows, lookups, lang }) {
  if (!rows.length) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] uppercase tracking-wide text-steel-faint mb-1">{title}</div>
      {rows.map((c) => {
        const outstanding = Number(c.amount) - Number(c.paid_amount)
        return (
          <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-line last:border-0 text-sm">
            <div>
              <div className="text-graphite">{lookups.chargeTypes[c.charge_type] || c.charge_type}</div>
              <div className="text-xs text-steel-faint">
                {fmtMoney(c.amount, c.currency, lookups.currencySym[c.currency])}
                {c.currency !== 'USD' && <span className="text-steel"> · {fmtUsd(c.amount_usd)}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xs font-semibold ${PAY_TONE[c.payment_status]}`}>
                {c.payment_status === 'paid' ? '✓' : c.payment_status === 'partial' ? '◐' : '○'} {c.payment_status}
              </div>
              {outstanding > 0 && c.kind === 'income' && (
                <div className="text-[11px] text-brick tabnum">{fmtMoney(outstanding, c.currency, lookups.currencySym[c.currency])}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AddCharge({ container, reference, lookups, onClose, onAdded }) {
  const { t } = useI18n()
  const [f, setF] = useState({
    kind: 'expense', charge_type: 'freight_rail', amount: '', currency: 'USD',
    rate_to_usd: '1', payment_status: 'unpaid',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const currencies = reference?.currencies || []
  const chargeTypes = reference?.charge_types || []

  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      await api.post(`/containers/${container.id}/charges`, {
        kind: f.kind, charge_type: f.charge_type, amount: Number(f.amount),
        currency: f.currency, rate_to_usd: Number(f.rate_to_usd) || 1,
        payment_status: f.payment_status,
      })
      onAdded()
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-graphite/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="card w-full max-w-sm p-5">
        <h3 className="font-bold mb-4">{t('addCharge')}</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button type="button" onClick={() => setF({ ...f, kind: 'income' })}
            className={`btn ${f.kind === 'income' ? 'bg-grass text-white' : 'border border-line text-steel'}`}>{t('income')}</button>
          <button type="button" onClick={() => setF({ ...f, kind: 'expense' })}
            className={`btn ${f.kind === 'expense' ? 'bg-brick text-white' : 'border border-line text-steel'}`}>{t('expense')}</button>
        </div>
        <label className="field-label">{t('addCharge')}</label>
        <select className="input mb-3" value={f.charge_type} onChange={set('charge_type')}>
          {chargeTypes.map((c) => <option key={c.code} value={c.code}>{lookups.chargeTypes[c.code]}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="field-label">{t('amount')}</label>
            <input className="input tabnum" type="number" step="0.01" value={f.amount} onChange={set('amount')} required autoFocus />
          </div>
          <div>
            <label className="field-label">{t('currency')}</label>
            <select className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value, rate_to_usd: e.target.value === 'USD' ? '1' : f.rate_to_usd })}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
        </div>
        {f.currency !== 'USD' && (
          <div className="mt-3">
            <label className="field-label">{t('rate')}</label>
            <input className="input tabnum" type="number" step="0.000001" value={f.rate_to_usd} onChange={set('rate_to_usd')} required />
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary flex-1" disabled={busy}>{busy ? '…' : t('save')}</button>
        </div>
      </form>
    </div>
  )
}
