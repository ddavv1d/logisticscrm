// «Живая карта коридора» — адаптация world-map (21st) под наш стек.
// Оригинал: Next.js+TS (next/image, next-themes) → переписан под Vite+JS.
// Карта ОБРЕЗАНА до региона Средний коридор (Кавказ → Каспий → Центральная Азия),
// а не весь мир — иначе маршрут был бы точкой в углу пустого глобуса.
// Точки = реальные города коридора; линии = плечи маршрута с анимацией «рисования».
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import DottedMap from 'dotted-map'

// bounding box коридора (немного шире, чтобы был воздух по краям)
const BOX = { lngMin: 38, lngMax: 74, latMin: 34, latMax: 48 }
const W = 800
const H = 320

// проекция гео → пиксели внутри нашего bounding box
function project(lat, lng) {
  const x = ((lng - BOX.lngMin) / (BOX.lngMax - BOX.lngMin)) * W
  const y = ((BOX.latMax - lat) / (BOX.latMax - BOX.latMin)) * H
  return { x, y }
}

function curvedPath(a, b) {
  const midX = (a.x + b.x) / 2
  const midY = Math.min(a.y, b.y) - 40
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`
}

export default function CorridorMap({ legs = [], lineColor = '#2E7D8A' }) {
  // точечный фон карты — считаем один раз
  const svgMap = useMemo(() => {
    const map = new DottedMap({ height: 60, grid: 'diagonal' })
    return map.getSVG({
      radius: 0.25,
      color: '#26343d22',
      shape: 'circle',
      backgroundColor: 'transparent',
    })
  }, [])

  return (
    <div className="relative w-full overflow-hidden rounded-card border border-line bg-base-2/40" style={{ aspectRatio: `${W}/${H}` }}>
      {/* точечный фон */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        alt="карта коридора"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover opacity-70 pointer-events-none select-none [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
      />

      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full pointer-events-none">
        <defs>
          <linearGradient id="corridor-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0" />
            <stop offset="8%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="92%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* линии плеч с анимацией «рисования» */}
        {legs.map((leg, i) => {
          const a = project(leg.from.lat, leg.from.lng)
          const b = project(leg.to.lat, leg.to.lng)
          const done = leg.done
          return (
            <motion.path
              key={`leg-${i}`}
              d={curvedPath(a, b)}
              fill="none"
              stroke={done ? 'url(#corridor-line)' : '#8a99a355'}
              strokeWidth={done ? 2 : 1.5}
              strokeDasharray={done ? '0' : '4 4'}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, delay: 0.35 * i, ease: 'easeOut' }}
            />
          )
        })}

        {/* узлы-города */}
        {legs.map((leg, i) => (
          <Node key={`from-${i}`} p={project(leg.from.lat, leg.from.lng)} label={leg.from.label} active={leg.done} color={lineColor} showLabel={i === 0} />
        ))}
        {legs.map((leg, i) => (
          <Node key={`to-${i}`} p={project(leg.to.lat, leg.to.lng)} label={leg.to.label} active={leg.done} color={lineColor} showLabel />
        ))}
      </svg>
    </div>
  )
}

function Node({ p, label, active, color, showLabel }) {
  return (
    <g>
      {active && (
        <circle cx={p.x} cy={p.y} r="3" fill={color} opacity="0.5">
          <animate attributeName="r" from="3" to="10" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.5" to="0" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={p.x} cy={p.y} r="3.5" fill={active ? color : '#8a99a3'} stroke="#fff" strokeWidth="1.5" />
      {showLabel && label && (
        <text x={p.x} y={p.y - 9} textAnchor="middle" className="fill-graphite" style={{ fontSize: 11, fontWeight: 600 }}>
          {label}
        </text>
      )}
    </g>
  )
}
