import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Client } from '../lib/types'

export interface MapPin {
  id: string
  lat: number
  lng: number
  name: string
  score: number
  why: string
}

const color = (score: number) => (score >= 7 ? '#15803d' : score >= 4 ? '#f97316' : '#94a3b8')

/** Prospects as numbered score dots, your clients as small green dots. Free OpenStreetMap tiles. */
export default function ProspectMap({ pins, clients, onPick }: { pins: MapPin[]; clients: Client[]; onPick: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { zoomControl: true, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    const layer = L.layerGroup().addTo(m)
    for (const c of clients) {
      if (c.lat == null || c.lng == null || c.status === 'lead') continue
      L.circleMarker([c.lat, c.lng], { radius: 5, color: '#166534', weight: 1, fillColor: '#4ade80', fillOpacity: 0.9 })
        .bindTooltip(`Client: ${c.business_name}`)
        .addTo(layer)
    }
    const bounds: L.LatLngExpression[] = []
    for (const p of pins) {
      bounds.push([p.lat, p.lng])
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color(p.score)};color:#fff;font-weight:800;font-size:12px;border:2px solid #fff;border-radius:9999px;width:30px;height:30px;display:grid;place-items:center;box-shadow:0 1px 4px rgba(0,0,0,.4)">${p.score.toFixed(0)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      L.marker([p.lat, p.lng], { icon })
        .bindPopup(`<b>${escapeHtml(p.name)}</b><br/>Fit ${p.score.toFixed(1)} · ${escapeHtml(p.why)}`)
        .on('click', () => onPick(p.id))
        .addTo(layer)
    }
    if (bounds.length) m.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 15 })
    else m.setView([31.7776, -106.4425], 11)
    return () => {
      layer.remove()
    }
  }, [pins, clients, onPick])

  return <div ref={el} className="w-full h-[60vh] rounded-2xl overflow-hidden border border-slate-200 z-0" />
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
