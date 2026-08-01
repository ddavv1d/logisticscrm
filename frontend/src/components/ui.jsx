import { TRANSPORT_ICON, stageTone } from '../lib/format.js'

const TONE = {
  sea: 'bg-sea-soft text-sea-deep border-sea/30',
  amber: 'bg-amber-soft text-amber border-amber/40',
  grass: 'bg-grass-soft text-grass border-grass/40',
  steel: 'bg-base-2 text-steel border-line',
  brick: 'bg-brick-soft text-brick border-brick/40',
}

export function StageBadge({ code, title, onClick }) {
  const tone = TONE[stageTone(code)] || TONE.sea
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone} ${onClick ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'}`}
    >
      {code === 'ferry_wait' && <span aria-hidden>⏳</span>}
      {(code === 'delivered' || code === 'empty_returned') && <span aria-hidden>✓</span>}
      <span>{title || code}</span>
    </button>
  )
}

export function StuckPill({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft border border-amber/40 px-2 py-0.5 text-[11px] font-bold text-amber">
      <span aria-hidden>⚠</span>{children}
    </span>
  )
}

// мини-карта маршрута из плеч (иконки транспорта)
export function RouteMini({ legs, currentLegSeq }) {
  if (!legs?.length) return <span className="text-steel-faint">—</span>
  return (
    <span className="inline-flex items-center gap-0.5">
      {legs.map((l, i) => (
        <span key={l.id} className="inline-flex items-center gap-0.5">
          <span
            title={l.transport_type}
            className={`text-sm leading-none ${currentLegSeq && l.seq <= currentLegSeq ? 'opacity-100' : 'opacity-30'}`}
          >
            {TRANSPORT_ICON[l.transport_type] || '•'}
          </span>
          {i < legs.length - 1 && <span className="text-steel-faint text-xs">›</span>}
        </span>
      ))}
    </span>
  )
}

export function StatCard({ label, value, sub, tone = 'sea', onClick, icon }) {
  const ring = {
    sea: 'border-t-sea', amber: 'border-t-amber', grass: 'border-t-grass', brick: 'border-t-brick',
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`card ${ring} border-t-[3px] p-4 text-left w-full transition-shadow ${onClick ? 'hover:shadow-pop cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-steel">{label}</span>
        {icon && <span className="text-steel-faint" aria-hidden>{icon}</span>}
      </div>
      <div className="mt-1.5 text-3xl font-extrabold tabnum text-graphite leading-none">{value}</div>
      {sub && <div className="mt-1 text-xs text-steel">{sub}</div>}
    </button>
  )
}

export function EmptyState({ title, hint, icon = '📦' }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-3xl mb-2" aria-hidden>{icon}</div>
      <div className="font-semibold text-graphite">{title}</div>
      {hint && <div className="mt-1 text-sm text-steel">{hint}</div>}
    </div>
  )
}

export function Skeleton({ rows = 6 }) {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
          <div className="h-4 w-24 animate-pulse rounded bg-base-2" />
          <div className="h-4 w-32 animate-pulse rounded bg-base-2" />
          <div className="ml-auto h-5 w-28 animate-pulse rounded-full bg-base-2" />
        </div>
      ))}
    </div>
  )
}

export function Toast({ show, text }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-chip bg-graphite px-4 py-2 text-sm font-medium text-white shadow-pop transition-all ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
    >
      ✓ {text}
    </div>
  )
}
