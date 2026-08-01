// «Живая карта коридора» на MapLibre GL — НАСТОЯЩИЕ гео-тайлы (страны точно на месте).
// Адаптация flightcn-компонента (Next+TS) под наш Vite+JS: без next-themes, без базы
// аэропортов — только карта + маркеры реальных городов коридора + линии маршрута.
import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

export default function CorridorMap({ legs = [], lineColor = '#2E7D8A' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [55, 41], // середина коридора (Каспий)
      zoom: 3.4,
      attributionControl: { compact: true },
      renderWorldCopies: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      // фон-заливка нашим цветом: если внешние тайлы (CARTO) заблокированы
      // корп-сетью/firewall — маршрут и города всё равно видны на чистом фоне,
      // а не на уродливом сером пятне. С интернетом тайлы рисуются поверх.
      if (!map.getLayer('lc-bg')) {
        const first = map.getStyle().layers?.[0]?.id
        map.addLayer({ id: 'lc-bg', type: 'background', paint: { 'background-color': '#eef2f4' } }, first)
      }
      // фитим карту по всем точкам коридора
      const pts = []
      legs.forEach((l) => { pts.push([l.from.lng, l.from.lat], [l.to.lng, l.to.lat]) })
      if (pts.length) {
        const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]))
        map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 5 })
      }

      // линии маршрута (пройденные — цветом, предстоящие — пунктиром)
      legs.forEach((leg, i) => {
        const id = `leg-${i}`
        map.addSource(id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[leg.from.lng, leg.from.lat], [leg.to.lng, leg.to.lat]] },
          },
        })
        map.addLayer({
          id,
          type: 'line',
          source: id,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': leg.done ? lineColor : '#8a99a3',
            'line-width': leg.done ? 3 : 2,
            'line-opacity': leg.done ? 0.9 : 0.6,
            ...(leg.done ? {} : { 'line-dasharray': [2, 2] }),
          },
        })
      })

      // маркеры-города
      const seen = new Set()
      const addMarker = (node, active) => {
        const key = `${node.lng},${node.lat}`
        if (seen.has(key)) return
        seen.add(key)
        // безопасное построение DOM (без innerHTML — данные могут прийти из БД)
        const el = document.createElement('div')
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer'
        const dot = document.createElement('div')
        dot.style.cssText = `background:${active ? lineColor : '#8a99a3'};width:12px;height:12px;border-radius:9999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`
        const label = document.createElement('div')
        label.style.cssText = 'margin-top:2px;font:600 11px/1 Onest,sans-serif;color:#1E2A32;background:rgba(255,255,255,.85);padding:1px 4px;border-radius:4px;white-space:nowrap'
        label.textContent = node.label // textContent — экранирует, XSS невозможен
        el.append(dot, label)
        new maplibregl.Marker({ element: el, anchor: 'top' })
          .setLngLat([node.lng, node.lat])
          .addTo(map)
      }
      legs.forEach((leg) => { addMarker(leg.from, leg.done); addMarker(leg.to, leg.done) })
    })

    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="w-full rounded-card overflow-hidden border border-line" style={{ height: 320 }} />
}
