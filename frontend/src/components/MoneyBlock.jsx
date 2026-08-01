import { useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../lib/i18n.js'
import { fmtUsd, fmtMoney } from '../lib/format.js'
import { CheckCircle2, CircleDot, Circle, Trash2, Check, X } from 'lucide-react'

const PAY = {
  paid: { tone: 'text-grass', Icon: CheckCircle2 },
  partial: { tone: 'text-amber', Icon: CircleDot },
  unpaid: { tone: 'text-steel', Icon: Circle },
}

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
        <div className="text-[32px] font-extrabold tabnum text-graphite mt-1 leading-none">{fmtUsd(m.margin_usd)}</div>
        <div className="mt-3 flex gap-4 text-sm">
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
        <ChargeList title={t('income')} rows={income} lookups={lookups} container={container} onChanged={onChanged} />
        <ChargeList title={t('expense')} rows={expense} lookups={lookups} container={container} onChanged={onChanged} />
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

function ChargeList({ title, rows, lookups, container, onChanged }) {
  if (!rows.length) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] uppercase tracking-wide text-steel-faint mb-1">{title}</div>
      {rows.map((c) => (
        <ChargeRow key={c.id} c={c} lookups={lookups} container={container} onChanged={onChanged} />
      ))}
    </div>
  )
}

function ChargeRow({ c, lookups, container, onChanged }) {
  const { t } = useI18n()
  const [paying, setPaying] = useState(false)
  const [payVal, setPayVal] = useState('')
  const [busy, setBusy] = useState(false)
  const outstanding = Number(c.amount) - Number(c.paid_amount)
  const { tone, Icon } = PAY[c.payment_status] || PAY.unpaid
  const isIncome = c.kind === 'income'
  const canPay = isIncome && c.payment_status !== 'paid'

  const markPaid = async (amount) => {
    setBusy(true)
    try {
      await api.patch(`/containers/${container.id}/charges/${c.id}`, { paid_amount: amount })
      onChanged()
    } finally { setBusy(false); setPaying(false) }
  }
  const remove = async () => {
    if (!confirm(t('deleteRow') + '?')) return
    setBusy(true)
    try {
      await api.del(`/containers/${container.id}/charges/${c.id}`)
      onChanged()
    } finally { setBusy(false) }
  }

  return (
    <div className="group flex items-center justify-between py-2 border-b border-line last:border-0 text-sm">
      <div className="min-w-0">
        <div className="text-graphite truncate">{lookups.chargeTypes[c.charge_type] || c.charge_type}</div>
        <div className="text-xs text-steel-faint">
          {fmtMoney(c.amount, c.currency, lookups.currencySym[c.currency])}
          {c.currency !== 'USD' && <span className="text-steel"> · {fmtUsd(c.amount_usd)}</span>}
        </div>
      </div>

      {paying ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus type="number" step="0.01" placeholder={String(c.amount)}
            value={payVal} onChange={(e) => setPayVal(e.target.value)}
            className="input tabnum w-24 py-1 text-xs"
          />
          <button disabled={busy} onClick={() => markPaid(Number(payVal || c.amount))}
            className="grid h-7 w-7 place-items-center rounded-chip bg-grass text-white hover:brightness-95" title={t('save')}>
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button onClick={() => setPaying(false)}
            className="grid h-7 w-7 place-items-center rounded-chip border border-line text-steel" title={t('cancel')}>
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />{c.payment_status}
            </div>
            {outstanding > 0 && isIncome && (
              <div className="text-[11px] text-brick tabnum">−{fmtMoney(outstanding, c.currency, lookups.currencySym[c.currency])}</div>
            )}
          </div>
          {/* действия появляются на hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canPay && (
              <button onClick={() => { setPayVal(String(c.amount)); setPaying(true) }}
                className="rounded-chip bg-grass/10 text-grass px-2 py-1 text-[11px] font-semibold hover:bg-grass/20">
                {t('markPaid')}
              </button>
            )}
            <button onClick={remove} disabled={busy}
              className="grid h-6 w-6 place-items-center rounded text-steel-faint hover:text-brick hover:bg-brick-soft" title={t('deleteRow')}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddCharge({ container, reference, lookups, onClose, onAdded }) {
  const { t } = useI18n()
  const [f, setF] = useState({
    kind: 'expense', charge_type: 'freight_rail', amount: '', currency: 'USD',
    rate_to_usd: '1', payment_status: 'unpaid', due_date: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const currencies = reference?.currencies || []
  const chargeTypes = reference?.charge_types || []

  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      const body = {
        kind: f.kind, charge_type: f.charge_type, amount: Number(f.amount),
        currency: f.currency, rate_to_usd: Number(f.rate_to_usd) || 1,
        payment_status: f.payment_status,
      }
      if (f.kind === 'income' && f.due_date) body.due_date = f.due_date
      await api.post(`/containers/${container.id}/charges`, body)
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
        {f.kind === 'income' && (
          <div className="mt-3">
            <label className="field-label">{t('dueDate')} ({t('optional')})</label>
            <input className="input" type="date" value={f.due_date} onChange={set('due_date')} />
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
