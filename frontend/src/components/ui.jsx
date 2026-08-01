import { stageTone } from '../lib/format.js'
import { TransportIcon, StageIcon } from '../lib/icons.jsx'
import { Clock, CheckCircle2, AlertTriangle, Package, Inbox, ChevronRight } from 'lucide-react'

const TONE = {
  sea: 'bg-sea-soft text-sea-deep border-sea/30',
  amber: 'bg-amber-soft text-amber border-amber/40',
  grass: 'bg-grass-soft text-grass border-grass/40',
  steel: 'bg-base-2 text-steel border-line',
  brick: 'bg-brick-soft text-brick border-brick/40',
}

export function StageBadge({ code, title, onClick }) {
  const tone = TONE[stageTone(code)] || TONE.sea
  const showIcon = code === 'ferry_wait' || code === 'delivered' || code === 'empty_returned'
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone} ${onClick ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'}`}
    >
      {showIcon && <StageIcon code={code} className="h-3 w-3" strokeWidth={2.5} />}
      <span>{title || code}</span>
    </button>
  )
}

export function StuckPill({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft border border-amber/40 px-2 py-0.5 text-[11px] font-bold text-amber">
      <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />{children}
    </span>
  )
}

// мини-карта маршрута из плеч (lucide-иконки транспорта)
export function RouteMini({ legs, currentLegSeq }) {
  if (!legs?.length) return <span className="text-steel-faint">—</span>
  return (
    <span className="inline-flex items-center gap-0.5">
      {legs.map((l, i) => (
        <span key={l.id ?? l.seq} className="inline-flex items-center gap-0.5">
          <TransportIcon
            type={l.transport_type}
            className={`h-4 w-4 ${currentLegSeq && l.seq <= currentLegSeq ? 'text-sea' : 'text-steel-faint/50'}`}
            strokeWidth={2}
          />
          {i < legs.length - 1 && <ChevronRight className="h-3 w-3 text-line" strokeWidth={2} />}
        </span>
      ))}
    </span>
  )
}

export function StatCard({ label, value, sub, tone = 'sea', onClick, icon }) {
  const ring = {
    sea: 'border-t-sea', amber: 'border-t-amber', grass: 'border-t-grass', brick: 'border-t-brick',
  }[tone]
  const iconTone = {
    sea: 'text-sea bg-sea-soft', amber: 'text-amber bg-amber-soft',
    grass: 'text-grass bg-grass-soft', brick: 'text-brick bg-brick-soft',
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`card card-hover ${ring} border-t-[3px] p-4 text-left w-full ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-steel">{label}</span>
        {icon && <span className={`grid h-7 w-7 place-items-center rounded-lg ${iconTone}`}>{icon}</span>}
      </div>
      <div className="mt-2 text-[32px] font-extrabold tabnum text-graphite leading-none">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-steel">{sub}</div>}
    </button>
  )
}

export function EmptyState({ title, hint, icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-base-2 text-steel-faint mb-3">
        {icon || <Inbox className="h-6 w-6" strokeWidth={1.5} />}
      </span>
      <div className="font-semibold text-graphite">{title}</div>
      {hint && <div className="mt-1 text-sm text-steel max-w-xs">{hint}</div>}
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
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-chip bg-graphite px-4 py-2.5 text-sm font-medium text-white shadow-pop transition-all ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
    >
      <CheckCircle2 className="h-4 w-4 text-grass" strokeWidth={2.5} />{text}
    </div>
  )
}
