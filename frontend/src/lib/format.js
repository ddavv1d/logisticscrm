// Форматирование: деньги, валюты, даты. Мультивалюта: показываем оригинал + USD.

export function fmtUsd(v) {
  const n = Number(v || 0)
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtMoney(amount, currency, symbol) {
  const n = Number(amount || 0)
  const s = symbol || currency
  const num = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  // символы валют, где символ идёт после числа
  if (currency === 'UZS') return `${num} ${s}`
  return `${s}${num}`
}

export function fmtDate(iso, lang = 'ru') {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function fmtDateTime(iso, lang = 'ru') {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// иконки видов транспорта (Unicode — простые, читаемые; не эмодзи-слоп, а функциональные значки маршрута)
export const TRANSPORT_ICON = { rail: '🚆', sea_ferry: '⛴', truck: '🚚', other: '•' }

// цвет-класс зоны по стадии (дальтоник-безопасно: + подпись/иконка всегда рядом)
export function stageTone(code) {
  if (code === 'ferry_wait') return 'amber'
  if (code === 'delivered' || code === 'empty_returned') return 'grass'
  if (code === 'booking') return 'steel'
  return 'sea'
}

// строим словари из reference (стадии/точки/валюты) с учётом языка
export function makeLookups(reference, lang) {
  const key = lang === 'ru' ? 'title_ru' : 'title_en'
  const stages = Object.fromEntries((reference?.stages || []).map((s) => [s.code, s[key]]))
  const locations = Object.fromEntries((reference?.locations || []).map((l) => [l.code, l[key]]))
  const currencySym = Object.fromEntries((reference?.currencies || []).map((c) => [c.code, c.symbol]))
  const chargeTypes = Object.fromEntries((reference?.charge_types || []).map((c) => [c.code, c[key]]))
  const stageOrder = (reference?.stages || []).map((s) => s.code)
  return { stages, locations, currencySym, chargeTypes, stageOrder }
}
