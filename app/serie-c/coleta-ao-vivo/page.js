'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toJpeg, toPng } from 'html-to-image'
import {
  ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Clock3, Download, FileImage, FileText,
  Flag, Pause, Play, Plus, RefreshCw, RotateCcw, Save, ShieldCheck, Trash2, Undo2,
  Wifi, WifiOff,
} from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import {
  getLocalMatch, listLocalMatches, mergeRemoteMatches, newLocalId,
  putLocalMatch, removeLocalMatch,
} from './offlineDb'

const SEASON = '2026'
const COMPETITION = 'Brasileiro Série C'
const TEAM = 'Confiança'
const CREST = '/confianca.png'

const EVENT_META = {
  final_third_for: { label: 'Entrada no terço final — Confiança', short: 'Terço final CON' },
  final_third_against: { label: 'Entrada adversário no nosso terço', short: 'Terço final ADV' },
  recovery: { label: 'Recuperação de posse — Confiança', short: 'Recuperação' },
  turnover: { label: 'Perda de posse — Confiança', short: 'Perda' },
  box_touch_for: { label: 'Toque do Confiança na área adversária', short: 'Toque área CON' },
  box_touch_against: { label: 'Toque do adversário na nossa área', short: 'Toque área ADV' },
}

const ZONE_LABEL = { left: 'Esquerda', center: 'Centro', right: 'Direita', own: 'Campo próprio', opponent: 'Campo adversário' }
const EMPTY_TIMER = { half1Elapsed: 0, half2Elapsed: 0, runningHalf: null, startedAt: null }

function localDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function secondsFor(match, half, now = Date.now()) {
  const timer = { ...EMPTY_TIMER, ...(match?.timer || {}) }
  const key = half === 1 ? 'half1Elapsed' : 'half2Elapsed'
  let seconds = Number(timer[key] || 0)
  if (Number(timer.runningHalf) === half && timer.startedAt) {
    seconds += Math.max(0, Math.floor((now - new Date(timer.startedAt).getTime()) / 1000))
  }
  return seconds
}

function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds || 0))
  const minutes = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function countEvents(events, half, type, zone) {
  return (events || []).filter(event =>
    (!half || Number(event.half) === Number(half)) &&
    event.type === type &&
    (zone === undefined || event.zone === zone)
  ).length
}

function sumType(events, type, half = null) {
  return countEvents(events, half, type, undefined)
}

function pct(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function safeFilename(value) {
  return String(value || 'partida').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

function matchTitle(match) {
  return match?.homeAway === 'M' ? `${TEAM} x ${match?.opponent || ''}` : `${match?.opponent || ''} x ${TEAM}`
}

function statusLabel(match) {
  if (match?.status === 'finished') return 'Finalizada'
  if (match?.firstHalfFinishedAt && !match?.secondHalfFinishedAt) return 'Intervalo / 2ºT'
  return 'Em andamento'
}

function summaryRows(match) {
  const events = match?.events || []
  const row = (label, type, zone) => ({
    label,
    h1: countEvents(events, 1, type, zone),
    h2: countEvents(events, 2, type, zone),
    total: countEvents(events, null, type, zone),
  })
  return [
    { group: 'Entradas no terço final — Confiança' },
    row('Lado esquerdo', 'final_third_for', 'left'),
    row('Centro', 'final_third_for', 'center'),
    row('Lado direito', 'final_third_for', 'right'),
    { group: 'Entradas no nosso terço — adversário' },
    row('Lado esquerdo do ataque adversário', 'final_third_against', 'left'),
    row('Centro', 'final_third_against', 'center'),
    row('Lado direito do ataque adversário', 'final_third_against', 'right'),
    { group: 'Recuperações de posse — Confiança' },
    row('Campo próprio', 'recovery', 'own'),
    row('Campo adversário', 'recovery', 'opponent'),
    { group: 'Perdas de posse — Confiança' },
    row('Campo próprio', 'turnover', 'own'),
    row('Campo adversário', 'turnover', 'opponent'),
    { group: 'Toques na área' },
    row('Confiança na área adversária', 'box_touch_for'),
    row('Adversário na área do Confiança', 'box_touch_against'),
  ]
}

function buildStats(match) {
  const events = match?.events || []
  const zones = type => ({
    left: countEvents(events, null, type, 'left'),
    center: countEvents(events, null, type, 'center'),
    right: countEvents(events, null, type, 'right'),
  })
  const forZones = zones('final_third_for')
  const againstZones = zones('final_third_against')
  const finalFor = Object.values(forZones).reduce((a, b) => a + b, 0)
  const finalAgainst = Object.values(againstZones).reduce((a, b) => a + b, 0)
  const recOwn = countEvents(events, null, 'recovery', 'own')
  const recOpp = countEvents(events, null, 'recovery', 'opponent')
  const lossOwn = countEvents(events, null, 'turnover', 'own')
  const lossOpp = countEvents(events, null, 'turnover', 'opponent')
  const boxFor = sumType(events, 'box_touch_for')
  const boxAgainst = sumType(events, 'box_touch_against')
  const half = h => ({
    entriesFor: sumType(events, 'final_third_for', h),
    entriesAgainst: sumType(events, 'final_third_against', h),
    recoveryHigh: countEvents(events, h, 'recovery', 'opponent'),
    lossOwn: countEvents(events, h, 'turnover', 'own'),
    boxFor: sumType(events, 'box_touch_for', h),
    boxAgainst: sumType(events, 'box_touch_against', h),
  })
  return {
    forZones, againstZones, finalFor, finalAgainst,
    recOwn, recOpp, lossOwn, lossOpp, boxFor, boxAgainst,
    h1: half(1), h2: half(2),
    entriesBalance: finalFor - finalAgainst,
    boxBalance: boxFor - boxAgainst,
  }
}

function buildScopedStats(match, half) {
  const events = (match?.events || []).filter(event => Number(event.half) === Number(half))
  const zones = type => ({
    left: countEvents(events, null, type, 'left'),
    center: countEvents(events, null, type, 'center'),
    right: countEvents(events, null, type, 'right'),
  })
  const forZones = zones('final_third_for')
  const againstZones = zones('final_third_against')
  return {
    forZones,
    againstZones,
    finalFor: Object.values(forZones).reduce((a, b) => a + b, 0),
    finalAgainst: Object.values(againstZones).reduce((a, b) => a + b, 0),
    recOwn: countEvents(events, null, 'recovery', 'own'),
    recOpp: countEvents(events, null, 'recovery', 'opponent'),
    lossOwn: countEvents(events, null, 'turnover', 'own'),
    lossOpp: countEvents(events, null, 'turnover', 'opponent'),
    boxFor: sumType(events, 'box_touch_for'),
    boxAgainst: sumType(events, 'box_touch_against'),
  }
}

function dominantZone(zones) {
  const entries = Object.entries(zones)
  const max = Math.max(0, ...entries.map(([, value]) => value))
  if (!max) return 'sem predominância'
  const leaders = entries.filter(([, value]) => value === max).map(([key]) => ZONE_LABEL[key]?.toLowerCase())
  return leaders.join(' / ')
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

async function jpegPagesToPdf(images) {
  const enc = new TextEncoder()
  const pageW = 842
  const pageH = 595
  const margin = 12
  const chunks = []
  const offsets = []
  let position = 0
  const push = bytes => { chunks.push(bytes); position += bytes.length }
  const pushText = text => push(enc.encode(text))
  pushText('%PDF-1.4\n%âãÏÓ\n')

  offsets[1] = position
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const pageIds = images.map((_, i) => 3 + i * 3)
  offsets[2] = position
  pushText(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${images.length} >>\nendobj\n`)

  images.forEach((image, i) => {
    const pageId = 3 + i * 3
    const imageId = pageId + 1
    const contentId = pageId + 2
    const jpeg = dataUrlBytes(image.dataUrl)
    const scale = Math.min((pageW - margin * 2) / image.width, (pageH - margin * 2) / image.height)
    const drawW = image.width * scale
    const drawH = image.height * scale
    const x = (pageW - drawW) / 2
    const y = (pageH - drawH) / 2
    const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im${i} Do\nQ\n`

    offsets[pageId] = position
    pushText(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`)
    offsets[imageId] = position
    pushText(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
    push(jpeg)
    pushText('\nendstream\nendobj\n')
    offsets[contentId] = position
    pushText(`${contentId} 0 obj\n<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`)
  })

  const maxObject = 2 + images.length * 3
  const xref = position
  pushText(`xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`)
  for (let i = 1; i <= maxObject; i += 1) pushText(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`)
  pushText(`trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  return new Blob([concatBytes(chunks)], { type: 'application/pdf' })
}

function SummaryTable({ match, dense = false }) {
  const rows = summaryRows(match)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[1fr_56px_56px_64px] border-b border-slate-200 bg-slate-900 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white">
        <span>Métrica</span><span className="text-center">1ºT</span><span className="text-center">2ºT</span><span className="text-center">Total</span>
      </div>
      {rows.map((item, index) => item.group ? (
        <div key={`${item.group}-${index}`} className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[8px] font-black uppercase tracking-wide text-slate-500">{item.group}</div>
      ) : (
        <div key={`${item.label}-${index}`} className={`grid grid-cols-[1fr_56px_56px_64px] items-center border-b border-slate-100 px-3 ${dense ? 'py-1.5' : 'py-2'} text-[9px] last:border-b-0`}>
          <span className="font-semibold text-slate-600">{item.label}</span>
          <span className="text-center font-black text-slate-700">{item.h1}</span>
          <span className="text-center font-black text-slate-700">{item.h2}</span>
          <span className="text-center text-xs font-black text-emerald-700">{item.total}</span>
        </div>
      ))}
    </div>
  )
}

function PitchSvg({ direction = 'up', accent = 'emerald', compact = false }) {
  const stroke = '#ffffff'
  const arrow = accent === 'red' ? '#dc2626' : '#059669'
  const arrowHead = direction === 'up' ? '8,0 16,12 12,12 12,32 4,32 4,12 0,12' : '0,20 4,20 4,0 12,0 12,20 16,20 8,32'
  const ys = direction === 'up' ? 120 : 34
  const goalY = direction === 'up' ? 2 : 244
  const boxY = direction === 'up' ? 2 : 194
  const sixY = direction === 'up' ? 2 : 224
  const arcY = direction === 'up' ? 77 : 191
  return (
    <svg viewBox="0 0 600 260" className={`h-full w-full ${compact ? 'min-h-[110px]' : 'min-h-[210px]'}`} role="img" aria-label="Campo de futebol">
      <rect x="2" y="2" width="596" height="256" rx="14" fill="#0b7f33" stroke={stroke} strokeWidth="3" />
      <line x1="2" y1="130" x2="598" y2="130" stroke={stroke} strokeWidth="2" opacity="0.9" />
      <circle cx="300" cy="130" r="42" fill="none" stroke={stroke} strokeWidth="2" opacity="0.9" />
      <circle cx="300" cy="130" r="3" fill={stroke} />
      <rect x="182" y={boxY} width="236" height="64" fill="none" stroke={stroke} strokeWidth="2.5" />
      <rect x="245" y={sixY} width="110" height="34" fill="none" stroke={stroke} strokeWidth="2.5" />
      <rect x="270" y={goalY} width="60" height="10" fill="none" stroke={stroke} strokeWidth="2.5" />
      <path d={direction === 'up' ? `M270 ${arcY} A48 48 0 0 0 330 ${arcY}` : `M270 ${arcY} A48 48 0 0 1 330 ${arcY}`} fill="none" stroke={stroke} strokeWidth="2" />
      {[90, 292, 494].map((x, i) => (
        <g key={x} transform={`translate(${x} ${ys})`}>
          <polygon points={arrowHead} fill={arrow} stroke="rgba(0,0,0,.2)" strokeWidth="1" />
          <circle cx="8" cy={direction === 'up' ? 47 : -15} r="20" fill="rgba(255,255,255,.96)" />
          <text x="8" y={direction === 'up' ? 52 : -10} textAnchor="middle" fontSize="12" fontWeight="900" fill={arrow}>{i === 0 ? 'E' : i === 1 ? 'C' : 'D'}</text>
        </g>
      ))}
    </svg>
  )
}

function PitchZonePanel({ title, subtitle, direction = 'up', accent = 'emerald', counts, onZone, disabled = false, compact = false }) {
  const zones = ['left', 'center', 'right']
  const tone = accent === 'red'
    ? { border: 'border-red-100', text: 'text-red-700', badge: 'bg-red-600', hover: 'hover:bg-red-50/20' }
    : { border: 'border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-600', hover: 'hover:bg-emerald-50/20' }
  return (
    <div className={`rounded-3xl border bg-white ${tone.border} ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><p className={`text-[9px] font-black uppercase tracking-[0.16em] ${tone.text}`}>{title}</p>{subtitle && <p className="mt-1 text-[9px] font-semibold text-slate-400">{subtitle}</p>}</div>
        <div className={`rounded-xl px-3 py-2 text-center text-white ${tone.badge}`}><p className="text-[7px] font-black uppercase opacity-80">Total</p><p className="text-lg font-black leading-none">{counts.left + counts.center + counts.right}</p></div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-white/30 shadow-inner">
        <PitchSvg direction={direction} accent={accent} compact={compact} />
        {onZone && (
          <div className="absolute inset-0 grid grid-cols-3">
            {zones.map(zone => (
              <button key={zone} type="button" disabled={disabled} onClick={() => onZone(zone)} className={`group relative border-r border-white/25 last:border-r-0 ${tone.hover} disabled:cursor-not-allowed disabled:opacity-50`}>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-white/95 px-3 py-1.5 text-center shadow-md">
                  <span className={`block text-[8px] font-black uppercase ${tone.text}`}>{ZONE_LABEL[zone]}</span>
                  <span className="block text-lg font-black leading-tight text-slate-900">{counts[zone]}</span>
                  <span className="block text-[7px] font-bold uppercase text-slate-400 group-active:text-slate-700">toque +1</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {!onZone && (
          <div className="absolute bottom-3 left-0 right-0 grid grid-cols-3 gap-2 px-4">
            {zones.map(zone => <div key={zone} className="rounded-xl bg-white/95 px-2 py-1.5 text-center shadow"><p className={`text-[8px] font-black uppercase ${tone.text}`}>{ZONE_LABEL[zone]}</p><p className="text-lg font-black text-slate-900">{counts[zone]}</p></div>)}
          </div>
        )}
      </div>
      {onZone && <div className="mt-2 grid grid-cols-3 gap-2">{zones.map(zone => <button key={zone} type="button" disabled={disabled || counts[zone] <= 0} onClick={() => onZone(zone, -1)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[8px] font-black uppercase text-slate-500 disabled:opacity-35">−1 {ZONE_LABEL[zone]}</button>)}</div>}
    </div>
  )
}

function SplitFieldCard({ title, type, own, opponent, onAdd, disabled, accent = 'blue' }) {
  const tones = accent === 'red' ? { bg: 'bg-red-50', text: 'text-red-700', line: '#dc2626' } : { bg: 'bg-blue-50', text: 'text-blue-700', line: '#2563eb' }
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{title}</p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-[#0b7f33]">
        <div className="relative h-28">
          <svg viewBox="0 0 500 120" className="absolute inset-0 h-full w-full">
            <rect x="1" y="1" width="498" height="118" rx="10" fill="#0b7f33" stroke="white" strokeWidth="2" />
            <line x1="250" y1="1" x2="250" y2="119" stroke="white" strokeWidth="2" />
            <circle cx="250" cy="60" r="26" fill="none" stroke="white" strokeWidth="2" />
            <rect x="1" y="30" width="62" height="60" fill="none" stroke="white" strokeWidth="2" />
            <rect x="437" y="30" width="62" height="60" fill="none" stroke="white" strokeWidth="2" />
          </svg>
          <div className="absolute inset-0 grid grid-cols-2">
            <button type="button" disabled={disabled} onClick={() => onAdd(type, 'own')} className="m-2 rounded-xl bg-white/90 px-3 text-left shadow-sm transition active:scale-[.98] disabled:opacity-40">
              <span className={`text-[8px] font-black uppercase ${tones.text}`}>Campo próprio</span><span className="mt-1 block text-2xl font-black text-slate-900">{own}</span><span className="text-[7px] font-bold uppercase text-slate-400">toque +1</span>
            </button>
            <button type="button" disabled={disabled} onClick={() => onAdd(type, 'opponent')} className="m-2 rounded-xl bg-white/90 px-3 text-left shadow-sm transition active:scale-[.98] disabled:opacity-40">
              <span className={`text-[8px] font-black uppercase ${tones.text}`}>Campo adversário</span><span className="mt-1 block text-2xl font-black text-slate-900">{opponent}</span><span className="text-[7px] font-bold uppercase text-slate-400">toque +1</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BoxTouchCard({ forCount, againstCount, onAdd, disabled }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Toques dentro da área</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={disabled} onClick={() => onAdd('box_touch_for')} className="relative min-h-28 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left active:scale-[.99] disabled:opacity-40">
          <div className="absolute -right-5 -top-5 h-24 w-32 rounded-b-3xl border-2 border-emerald-200" />
          <p className="relative text-[9px] font-black uppercase text-emerald-700">Confiança</p><p className="relative mt-1 text-[8px] font-semibold text-emerald-600">na área adversária</p><p className="relative mt-3 text-3xl font-black text-emerald-800">{forCount}</p><p className="relative text-[7px] font-black uppercase text-emerald-500">toque +1</p>
        </button>
        <button type="button" disabled={disabled} onClick={() => onAdd('box_touch_against')} className="relative min-h-28 overflow-hidden rounded-2xl border border-red-100 bg-red-50 p-4 text-left active:scale-[.99] disabled:opacity-40">
          <div className="absolute -right-5 -top-5 h-24 w-32 rounded-b-3xl border-2 border-red-200" />
          <p className="relative text-[9px] font-black uppercase text-red-700">Adversário</p><p className="relative mt-1 text-[8px] font-semibold text-red-600">na nossa área</p><p className="relative mt-3 text-3xl font-black text-red-800">{againstCount}</p><p className="relative text-[7px] font-black uppercase text-red-500">toque +1</p>
        </button>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone = 'slate' }) {
  const styles = tone === 'green' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : tone === 'red' ? 'border-red-100 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-800'
  return <div className={`rounded-2xl border p-3 ${styles}`}><p className="text-[8px] font-black uppercase tracking-wide opacity-65">{label}</p><p className="mt-1 text-2xl font-black leading-none">{value}</p>{sub && <p className="mt-1.5 text-[8px] font-semibold opacity-65">{sub}</p>}</div>
}

function CompareBars({ title, items, maxValue }) {
  const max = maxValue || Math.max(1, ...items.map(item => item.value))
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-4 text-[9px] font-black uppercase tracking-wider text-slate-500">{title}</p>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold text-slate-600"><span>{item.label}</span><span className="font-black text-slate-900">{item.value}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.tone === 'red' ? 'bg-red-500' : item.tone === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(item.value ? 7 : 0, (item.value / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HalfSummary({ title, stats, tone = 'slate' }) {
  const border = tone === 'green' ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200 bg-white'
  return (
    <div className={`rounded-2xl border p-4 ${border}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">{title}</p>
      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4">
        {[
          ['Entradas CON', stats.entriesFor, 'text-emerald-700'], ['Entradas ADV', stats.entriesAgainst, 'text-red-700'], ['Rec. alta', stats.recoveryHigh, 'text-blue-700'],
          ['Perda campo próprio', stats.lossOwn, 'text-red-700'], ['Toques área CON', stats.boxFor, 'text-emerald-700'], ['Toques área ADV', stats.boxAgainst, 'text-red-700'],
        ].map(([label, value, color]) => <div key={label}><p className="text-[7px] font-bold uppercase leading-tight text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${color}`}>{value}</p></div>)}
      </div>
    </div>
  )
}

function InsightCard({ match, stats }) {
  const recoveries = stats.recOwn + stats.recOpp
  const losses = stats.lossOwn + stats.lossOpp
  const lines = [
    `O Confiança concentrou mais entradas no terço final pelo ${dominantZone(stats.forZones)} (${Math.max(...Object.values(stats.forZones), 0)}).`,
    `O adversário chegou mais ao nosso terço pelo ${dominantZone(stats.againstZones)} (${Math.max(...Object.values(stats.againstZones), 0)}).`,
    recoveries ? `${pct(stats.recOpp, recoveries)}% das recuperações registradas ocorreram no campo adversário.` : 'Não houve recuperações de posse marcadas.',
    losses ? `${pct(stats.lossOwn, losses)}% das perdas registradas ocorreram no próprio campo.` : 'Não houve perdas de posse marcadas.',
    `Saldo de toques dentro da área: ${stats.boxBalance > 0 ? '+' : ''}${stats.boxBalance} (${stats.boxFor} x ${stats.boxAgainst}).`,
  ]
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Leitura automática da coleta</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {lines.map((line, index) => <div key={line} className="rounded-xl bg-white/8 px-3 py-2 text-[9px] font-semibold leading-relaxed text-slate-200"><span className="mr-2 font-black text-emerald-300">0{index + 1}</span>{line}</div>)}
      </div>
      {match?.notes && <p className="mt-3 border-t border-white/10 pt-3 text-[8px] font-semibold text-slate-300">Observação cadastrada: {match.notes}</p>}
    </div>
  )
}

function ReportHeader({ match, title = 'Relatório da coleta' }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 p-2"><img src={CREST} alt="Confiança" className="h-full w-full object-contain" /></div>
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-600">{title}</p><h2 className="mt-1 text-2xl font-black leading-tight text-slate-900">{matchTitle(match)}</h2><p className="mt-1 text-[9px] font-bold text-slate-400">{match.matchDate ? new Date(`${match.matchDate}T12:00:00`).toLocaleDateString('pt-BR') : ''}{match.round ? ` • Rodada ${match.round}` : ''}{match.venue ? ` • ${match.venue}` : ''} • {COMPETITION}</p></div>
      </div>
      <div className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-right text-white"><p className="text-[7px] font-black uppercase tracking-wider text-slate-400">Status</p><p className="mt-1 text-xs font-black uppercase">{statusLabel(match)}</p></div>
    </div>
  )
}

function ExportHeader({ match, title = 'Relatório da coleta' }) {
  const currentTitle = matchTitle(match)
  const titleClass = currentTitle.length > 34 ? 'text-[18px]' : currentTitle.length > 27 ? 'text-[20px]' : 'text-[22px]'
  return (
    <div className="flex h-[66px] items-center justify-between border-b border-slate-200 pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[14px] border border-emerald-100 bg-emerald-50 p-2">
          <img src={CREST} alt="Confiança" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase leading-[11px] tracking-[0.18em] text-emerald-700">{title}</p>
          <h2 className={`mt-[3px] whitespace-nowrap font-black leading-[24px] text-slate-900 ${titleClass}`}>{currentTitle}</h2>
          <p className="mt-[2px] whitespace-nowrap text-[8px] font-bold leading-[10px] text-slate-400">
            {match.matchDate ? new Date(`${match.matchDate}T12:00:00`).toLocaleDateString('pt-BR') : ''}{match.round ? ` • Rodada ${match.round}` : ''}{match.venue ? ` • ${match.venue}` : ''} • {COMPETITION}
          </p>
        </div>
      </div>
      <div className="ml-4 flex h-[52px] w-[112px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-slate-900 text-white">
        <p className="text-[7px] font-black uppercase leading-[9px] tracking-[0.13em] text-slate-400">Status</p>
        <p className="mt-1 whitespace-nowrap text-[12px] font-black uppercase leading-[14px]">{statusLabel(match)}</p>
      </div>
    </div>
  )
}

function ExportKpi({ label, value, sub, tone = 'slate' }) {
  const styles = tone === 'green'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
    : tone === 'red'
      ? 'border-red-100 bg-red-50 text-red-800'
      : 'border-slate-200 bg-slate-50 text-slate-800'
  const valueLength = String(value ?? '').length
  const valueSize = valueLength > 11 ? 'text-[16px] leading-[18px]' : valueLength > 7 ? 'text-[19px] leading-[21px]' : 'text-[23px] leading-[25px]'
  return (
    <div className={`box-border flex h-[82px] min-w-0 flex-col justify-between rounded-[16px] border p-[11px] ${styles}`}>
      <p className="whitespace-nowrap text-[8px] font-black uppercase leading-[10px] tracking-[0.04em] opacity-70">{label}</p>
      <p className={`whitespace-nowrap font-black ${valueSize}`}>{value}</p>
      <p className="min-h-[10px] whitespace-nowrap text-[7px] font-semibold leading-[9px] opacity-70">{sub || ' '}</p>
    </div>
  )
}

function ExportPitchGraphic({ direction = 'up', accent = 'emerald' }) {
  const stroke = '#ffffff'
  const arrow = accent === 'red' ? '#dc2626' : '#059669'
  const goalTop = direction === 'up'
  const boxY = goalTop ? 2 : 176
  const sixY = goalTop ? 2 : 206
  const goalY = goalTop ? 2 : 236
  const arcY = goalTop ? 73 : 179
  const arrowStartY = goalTop ? 154 : 86
  const arrowEndY = goalTop ? 96 : 144
  return (
    <svg viewBox="0 0 600 248" className="block h-full w-full" role="img" aria-label="Campo de futebol">
      <rect x="2" y="2" width="596" height="244" rx="12" fill="#0b7f33" stroke={stroke} strokeWidth="3" />
      <line x1="2" y1="124" x2="598" y2="124" stroke={stroke} strokeWidth="2" opacity="0.95" />
      <circle cx="300" cy="124" r="39" fill="none" stroke={stroke} strokeWidth="2" opacity="0.95" />
      <circle cx="300" cy="124" r="3" fill={stroke} />
      <line x1="200" y1="2" x2="200" y2="246" stroke={stroke} strokeWidth="1" opacity="0.22" strokeDasharray="7 7" />
      <line x1="400" y1="2" x2="400" y2="246" stroke={stroke} strokeWidth="1" opacity="0.22" strokeDasharray="7 7" />
      <rect x="182" y={boxY} width="236" height="68" fill="none" stroke={stroke} strokeWidth="2.5" />
      <rect x="245" y={sixY} width="110" height="38" fill="none" stroke={stroke} strokeWidth="2.5" />
      <rect x="270" y={goalY} width="60" height="10" fill="none" stroke={stroke} strokeWidth="2.5" />
      <path d={goalTop ? `M270 ${arcY} A48 48 0 0 0 330 ${arcY}` : `M270 ${arcY} A48 48 0 0 1 330 ${arcY}`} fill="none" stroke={stroke} strokeWidth="2" />
      {[100, 300, 500].map(x => (
        <g key={x}>
          <line x1={x} y1={arrowStartY} x2={x} y2={arrowEndY} stroke={arrow} strokeWidth="9" strokeLinecap="round" />
          <polygon points={goalTop ? `${x-10},${arrowEndY+3} ${x+10},${arrowEndY+3} ${x},${arrowEndY-12}` : `${x-10},${arrowEndY-3} ${x+10},${arrowEndY-3} ${x},${arrowEndY+12}`} fill={arrow} />
        </g>
      ))}
    </svg>
  )
}

function ExportPitchPanel({ title, subtitle, direction = 'up', accent = 'emerald', counts }) {
  const red = accent === 'red'
  const text = red ? 'text-red-700' : 'text-emerald-700'
  const border = red ? 'border-red-100' : 'border-emerald-100'
  const badge = red ? 'bg-red-600' : 'bg-emerald-600'
  const chip = red ? 'border-red-100 bg-red-50/70' : 'border-emerald-100 bg-emerald-50/70'
  const zones = ['left', 'center', 'right']
  return (
    <div className={`box-border h-[238px] overflow-hidden rounded-[18px] border bg-white p-3 ${border}`}>
      <div className="flex h-[35px] items-start justify-between gap-3">
        <div className="min-w-0 pt-[1px]">
          <p className={`whitespace-nowrap text-[9px] font-black uppercase leading-[11px] tracking-[0.10em] ${text}`}>{title}</p>
          <p className="mt-[3px] whitespace-nowrap text-[7px] font-semibold leading-[9px] text-slate-400">{subtitle}</p>
        </div>
        <div className={`flex h-[34px] w-[48px] shrink-0 flex-col items-center justify-center rounded-[11px] text-white ${badge}`}>
          <p className="text-[6px] font-black uppercase leading-[7px] opacity-80">Total</p>
          <p className="text-[17px] font-black leading-[18px]">{counts.left + counts.center + counts.right}</p>
        </div>
      </div>
      <div className="mt-1.5 h-[116px] overflow-hidden rounded-[12px]">
        <ExportPitchGraphic direction={direction} accent={accent} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {zones.map(zone => (
          <div key={zone} className={`box-border flex h-[49px] flex-col items-center justify-center rounded-[10px] border ${chip}`}>
            <p className={`whitespace-nowrap text-[7px] font-black uppercase leading-[8px] ${text}`}>{ZONE_LABEL[zone]}</p>
            <p className="mt-[2px] text-[18px] font-black leading-[19px] text-slate-900">{counts[zone]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExportCompareBars({ title, items, maxValue, height = 112 }) {
  const max = maxValue || Math.max(1, ...items.map(item => item.value))
  return (
    <div style={{ height }} className="box-border overflow-hidden rounded-[16px] border border-slate-200 bg-white p-3">
      <p className="mb-2 whitespace-nowrap text-[8px] font-black uppercase leading-[10px] tracking-[0.08em] text-slate-500">{title}</p>
      <div className="space-y-[7px]">
        {items.map(item => (
          <div key={item.label}>
            <div className="mb-[3px] flex items-center justify-between text-[8px] font-bold leading-[9px] text-slate-600">
              <span className="whitespace-nowrap">{item.label}</span><span className="font-black text-slate-900">{item.value}</span>
            </div>
            <div className="h-[8px] overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${item.tone === 'red' ? 'bg-red-500' : item.tone === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(item.value ? 7 : 0, (item.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExportInsight({ match, stats }) {
  const recoveries = stats.recOwn + stats.recOpp
  const losses = stats.lossOwn + stats.lossOpp
  const lines = [
    `O Confiança concentrou mais entradas no terço final pelo ${dominantZone(stats.forZones)} (${Math.max(...Object.values(stats.forZones), 0)}).`,
    `O adversário chegou mais ao nosso terço pelo ${dominantZone(stats.againstZones)} (${Math.max(...Object.values(stats.againstZones), 0)}).`,
    recoveries ? `${pct(stats.recOpp, recoveries)}% das recuperações registradas ocorreram no campo adversário.` : 'Não houve recuperações de posse marcadas.',
    losses ? `${pct(stats.lossOwn, losses)}% das perdas registradas ocorreram no próprio campo.` : 'Não houve perdas de posse marcadas.',
    `Saldo de toques dentro da área: ${stats.boxBalance > 0 ? '+' : ''}${stats.boxBalance} (${stats.boxFor} x ${stats.boxAgainst}).`,
  ]
  return (
    <div className="box-border h-[126px] overflow-hidden rounded-[16px] bg-slate-900 p-3 text-white">
      <p className="text-[8px] font-black uppercase leading-[10px] tracking-[0.14em] text-emerald-300">Leitura automática da coleta</p>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-[5px]">
        {lines.map((line, index) => (
          <div key={line} className="flex min-h-[24px] items-center rounded-[9px] bg-white/[0.08] px-2 py-1 text-[7px] font-semibold leading-[10px] text-slate-200">
            <span className="mr-2 shrink-0 font-black text-emerald-300">0{index + 1}</span><span>{line}</span>
          </div>
        ))}
      </div>
      {match?.notes && <p className="mt-[5px] truncate border-t border-white/10 pt-[4px] text-[7px] font-semibold leading-[9px] text-slate-300">Obs.: {match.notes}</p>}
    </div>
  )
}

function ExportHalfSummary({ title, stats, tone = 'slate' }) {
  const border = tone === 'green' ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200 bg-white'
  const data = [
    ['Entradas CON', stats.entriesFor, 'text-emerald-700'], ['Entradas ADV', stats.entriesAgainst, 'text-red-700'], ['Rec. alta', stats.recoveryHigh, 'text-blue-700'],
    ['Perda campo próprio', stats.lossOwn, 'text-red-700'], ['Toques área CON', stats.boxFor, 'text-emerald-700'], ['Toques área ADV', stats.boxAgainst, 'text-red-700'],
  ]
  return (
    <div className={`box-border h-[112px] rounded-[16px] border p-3 ${border}`}>
      <p className="text-[9px] font-black uppercase leading-[11px] tracking-[0.08em] text-slate-700">{title}</p>
      <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-[7px]">
        {data.map(([label, value, color]) => (
          <div key={label} className="min-w-0">
            <p className="whitespace-nowrap text-[6px] font-bold uppercase leading-[8px] text-slate-400">{label}</p>
            <p className={`mt-[2px] text-[18px] font-black leading-[19px] ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExportSummaryTable({ match }) {
  const rows = summaryRows(match)
  return (
    <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
      <div className="grid h-[24px] grid-cols-[1fr_52px_52px_58px] items-center bg-slate-900 px-3 text-[8px] font-black uppercase leading-[9px] tracking-[0.06em] text-white">
        <span>Métrica</span><span className="text-center">1ºT</span><span className="text-center">2ºT</span><span className="text-center">Total</span>
      </div>
      {rows.map((item, index) => item.group ? (
        <div key={`${item.group}-${index}`} className="flex h-[16px] items-center border-b border-slate-100 bg-slate-50 px-3 text-[6px] font-black uppercase leading-[7px] tracking-[0.04em] text-slate-500">{item.group}</div>
      ) : (
        <div key={`${item.label}-${index}`} className="grid h-[18px] grid-cols-[1fr_52px_52px_58px] items-center border-b border-slate-100 px-3 text-[7px] leading-[8px] last:border-b-0">
          <span className="whitespace-nowrap font-semibold text-slate-600">{item.label}</span>
          <span className="text-center font-black text-slate-700">{item.h1}</span>
          <span className="text-center font-black text-slate-700">{item.h2}</span>
          <span className="text-center text-[9px] font-black text-emerald-700">{item.total}</span>
        </div>
      ))}
    </div>
  )
}

function ReportPageOne({ match, exportMode = false }) {
  const stats = buildStats(match)
  const duration1 = formatClock(secondsFor(match, 1))
  const duration2 = formatClock(secondsFor(match, 2))

  if (exportMode) {
    return (
      <div style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className="box-border h-[792px] w-[1120px] overflow-hidden bg-white p-6 antialiased">
        <ExportHeader match={match} />
        <div className="mt-3 grid h-[82px] grid-cols-6 gap-2.5">
          <ExportKpi label="Entradas CON" value={stats.finalFor} sub={`saldo ${stats.entriesBalance >= 0 ? '+' : ''}${stats.entriesBalance}`} tone="green" />
          <ExportKpi label="Entradas ADV" value={stats.finalAgainst} sub="no nosso terço" tone="red" />
          <ExportKpi label="Rec. campo ADV" value={stats.recOpp} sub={`${pct(stats.recOpp, stats.recOwn + stats.recOpp)}% das recuperações`} tone="green" />
          <ExportKpi label="Perdas campo próprio" value={stats.lossOwn} sub={`${pct(stats.lossOwn, stats.lossOwn + stats.lossOpp)}% das perdas`} tone="red" />
          <ExportKpi label="Toques área CON" value={stats.boxFor} sub={`saldo ${stats.boxBalance >= 0 ? '+' : ''}${stats.boxBalance}`} tone="green" />
          <ExportKpi label="Tempos" value={`${duration1} / ${duration2}`} sub={`${match.events?.length || 0} marcações`} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ExportPitchPanel title="Entradas no terço final - Confiança" subtitle="Distribuição pelo corredor de ataque" direction="up" accent="emerald" counts={stats.forZones} />
          <ExportPitchPanel title="Entradas no nosso terço - adversário" subtitle="Perspectiva de quem ataca" direction="down" accent="red" counts={stats.againstZones} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <ExportCompareBars title="Entradas no terço" items={[{ label: 'Confiança', value: stats.finalFor }, { label: 'Adversário', value: stats.finalAgainst, tone: 'red' }]} />
          <ExportCompareBars title="Toques dentro da área" items={[{ label: 'Confiança', value: stats.boxFor }, { label: 'Adversário', value: stats.boxAgainst, tone: 'red' }]} />
          <ExportCompareBars title="Recuperações de posse" items={[{ label: 'Campo próprio', value: stats.recOwn, tone: 'blue' }, { label: 'Campo adversário', value: stats.recOpp }]} />
          <ExportCompareBars title="Perdas de posse" items={[{ label: 'Campo próprio', value: stats.lossOwn, tone: 'red' }, { label: 'Campo adversário', value: stats.lossOpp }]} />
        </div>
        <div className="mt-3"><ExportInsight match={match} stats={stats} /></div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <ReportHeader match={match} />
      <div className="mt-4 grid grid-cols-6 gap-3">
        <Kpi label="Entradas CON" value={stats.finalFor} sub={`saldo ${stats.entriesBalance >= 0 ? '+' : ''}${stats.entriesBalance}`} tone="green" />
        <Kpi label="Entradas ADV" value={stats.finalAgainst} sub="no nosso terço" tone="red" />
        <Kpi label="Rec. campo ADV" value={stats.recOpp} sub={`${pct(stats.recOpp, stats.recOwn + stats.recOpp)}% das recuperações`} tone="green" />
        <Kpi label="Perdas campo próprio" value={stats.lossOwn} sub={`${pct(stats.lossOwn, stats.lossOwn + stats.lossOpp)}% das perdas`} tone="red" />
        <Kpi label="Toques área CON" value={stats.boxFor} sub={`saldo ${stats.boxBalance >= 0 ? '+' : ''}${stats.boxBalance}`} tone="green" />
        <Kpi label="Tempos" value={`${duration1} / ${duration2}`} sub={`${match.events?.length || 0} marcações`} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <PitchZonePanel title="Entradas no terço final — Confiança" subtitle="Distribuição pelo corredor de ataque" direction="up" accent="emerald" counts={stats.forZones} compact />
        <PitchZonePanel title="Entradas no nosso terço — adversário" subtitle="Perspectiva de quem ataca" direction="down" accent="red" counts={stats.againstZones} compact />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-4">
        <CompareBars title="Entradas no terço" items={[{ label: 'Confiança', value: stats.finalFor }, { label: 'Adversário', value: stats.finalAgainst, tone: 'red' }]} />
        <CompareBars title="Toques dentro da área" items={[{ label: 'Confiança', value: stats.boxFor }, { label: 'Adversário', value: stats.boxAgainst, tone: 'red' }]} />
        <CompareBars title="Recuperações de posse" items={[{ label: 'Campo próprio', value: stats.recOwn, tone: 'blue' }, { label: 'Campo adversário', value: stats.recOpp }]} />
        <CompareBars title="Perdas de posse" items={[{ label: 'Campo próprio', value: stats.lossOwn, tone: 'red' }, { label: 'Campo adversário', value: stats.lossOpp }]} />
      </div>
      <div className="mt-4"><InsightCard match={match} stats={stats} /></div>
    </div>
  )
}

function ReportPageTwo({ match, exportMode = false }) {
  const stats = buildStats(match)

  if (exportMode) {
    return (
      <div style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className="box-border h-[792px] w-[1120px] overflow-hidden bg-white p-6 antialiased">
        <ExportHeader match={match} title="Resumo por tempo e detalhamento" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ExportHalfSummary title="1º tempo" stats={stats.h1} />
          <ExportHalfSummary title="2º tempo" stats={stats.h2} tone="green" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <ExportCompareBars height={148} title="Entradas por tempo" items={[{ label: 'Confiança 1ºT', value: stats.h1.entriesFor }, { label: 'Confiança 2ºT', value: stats.h2.entriesFor }, { label: 'ADV 1ºT', value: stats.h1.entriesAgainst, tone: 'red' }, { label: 'ADV 2ºT', value: stats.h2.entriesAgainst, tone: 'red' }]} />
          <ExportCompareBars height={148} title="Toques na área por tempo" items={[{ label: 'CON 1ºT', value: stats.h1.boxFor }, { label: 'CON 2ºT', value: stats.h2.boxFor }, { label: 'ADV 1ºT', value: stats.h1.boxAgainst, tone: 'red' }, { label: 'ADV 2ºT', value: stats.h2.boxAgainst, tone: 'red' }]} />
          <ExportCompareBars height={148} title="Pressão territorial" items={[{ label: 'Rec. campo adversário', value: stats.recOpp }, { label: 'Perdas campo próprio', value: stats.lossOwn, tone: 'red' }]} />
        </div>
        <div className="mt-3"><ExportSummaryTable match={match} /></div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <ReportHeader match={match} title="Resumo por tempo e detalhamento" />
      <div className="mt-4 grid grid-cols-2 gap-4"><HalfSummary title="1º tempo" stats={stats.h1} /><HalfSummary title="2º tempo" stats={stats.h2} tone="green" /></div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <CompareBars title="Entradas por tempo" items={[{ label: 'Confiança 1ºT', value: stats.h1.entriesFor }, { label: 'Confiança 2ºT', value: stats.h2.entriesFor }, { label: 'ADV 1ºT', value: stats.h1.entriesAgainst, tone: 'red' }, { label: 'ADV 2ºT', value: stats.h2.entriesAgainst, tone: 'red' }]} />
        <CompareBars title="Toques na área por tempo" items={[{ label: 'CON 1ºT', value: stats.h1.boxFor }, { label: 'CON 2ºT', value: stats.h2.boxFor }, { label: 'ADV 1ºT', value: stats.h1.boxAgainst, tone: 'red' }, { label: 'ADV 2ºT', value: stats.h2.boxAgainst, tone: 'red' }]} />
        <CompareBars title="Pressão territorial" items={[{ label: 'Rec. campo adversário', value: stats.recOpp }, { label: 'Perdas campo próprio', value: stats.lossOwn, tone: 'red' }]} />
      </div>
      <div className="mt-4"><SummaryTable match={match} dense /></div>
    </div>
  )
}

function LiveSummary({ match, tick }) {
  const stats = buildStats(match)
  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">Resumo ao vivo</p><h3 className="mt-1 text-lg font-black text-slate-900">{matchTitle(match)}</h3></div><img src={CREST} alt="Confiança" className="h-11 w-11 object-contain" /></div>
        <div className="grid grid-cols-3 gap-2"><Kpi label="1ºT" value={formatClock(secondsFor(match, 1, tick))} /><Kpi label="2ºT" value={formatClock(secondsFor(match, 2, tick))} /><Kpi label="Marcações" value={match.events?.length || 0} tone="green" /></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><HalfSummary title="1º tempo" stats={stats.h1} /><HalfSummary title="2º tempo" stats={stats.h2} tone="green" /></div>
        <div className="mt-3"><SummaryTable match={match} dense /></div>
      </div>
    </div>
  )
}

export default function ColetaAoVivoPage() {
  const [matches, setMatches] = useState([])
  const [activeMatch, setActiveMatch] = useState(null)
  const activeMatchRef = useRef(null)
  const [online, setOnline] = useState(true)
  const [offlineReady, setOfflineReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(Date.now())
  const [draft, setDraft] = useState({ opponent: '', matchDate: localDateValue(), homeAway: 'M', round: '', venue: '', notes: '' })
  const exportWrapRef = useRef(null)
  const exportPage1Ref = useRef(null)
  const exportPage2Ref = useRef(null)
  const autoSyncTimerRef = useRef(null)
  // Incrementado em toda ação local do usuário. Serve para impedir que uma
  // sincronização iniciada antes do clique sobrescreva o relógio/eventos novos.
  const localMutationVersionRef = useRef(0)

  useEffect(() => { activeMatchRef.current = activeMatch }, [activeMatch])

  const refreshLocal = useCallback(async () => {
    const rows = await listLocalMatches()
    setMatches(rows)
    return rows
  }, [])

  const syncOne = useCallback(async match => {
    const sentUpdatedAt = match?.updatedAt || null
    const response = await fetch('/api/serie-c/live-matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match }),
    })
    const payload = await response.json()
    if (!response.ok || payload.error) throw new Error(payload.error || 'Falha ao sincronizar.')
    if (match.deletedAt) { await removeLocalMatch(match.localId); return null }

    // Nunca deixa uma resposta do servidor sobrescrever uma marcação mais nova
    // feita neste dispositivo enquanto o POST estava em andamento.
    const currentLocal = await getLocalMatch(match.localId)
    if (currentLocal?.dirty && sentUpdatedAt && currentLocal.updatedAt !== sentUpdatedAt) {
      return currentLocal
    }

    const saved = { ...payload.match, dirty: false, deletedAt: null, syncedAt: new Date().toISOString() }
    await putLocalMatch(saved)
    return saved
  }, [])

  const pullRemote = useCallback(async () => {
    if (!navigator.onLine) return []
    const response = await fetch(`/api/serie-c/live-matches?season=${SEASON}&competition=${encodeURIComponent(COMPETITION)}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.error) throw new Error(payload.error || 'Falha ao carregar partidas do banco geral.')
    await mergeRemoteMatches(payload.matches || [])
    return payload.matches || []
  }, [])

  const syncAll = useCallback(async ({ silent = false } = {}) => {
    if (!navigator.onLine) {
      if (!silent) setMessage('Sem internet. Tudo continua salvo no Mac e será sincronizado quando a conexão voltar.')
      return
    }
    const mutationVersionAtStart = localMutationVersionRef.current
    setSyncing(true)
    try {
      const local = await listLocalMatches({ includeDeleted: true })
      const pending = local.filter(match => match.dirty || match.deletedAt)
      for (const match of pending) await syncOne(match)
      await pullRemote()
      const rows = await refreshLocal()
      const current = activeMatchRef.current
      const currentId = current?.localId
      if (currentId) {
        const refreshed = rows.find(item => item.localId === currentId)
        const userChangedDuringSync = localMutationVersionRef.current !== mutationVersionAtStart

        if (userChangedDuringSync && current) {
          // A coleta mudou enquanto a sincronização estava em andamento (ex.: o
          // usuário clicou em INICIAR). A cópia local mais nova SEMPRE vence.
          // Regravamos o estado atual porque o pull remoto pode ter terminado
          // alguns milissegundos depois do clique e colocado uma versão antiga
          // no IndexedDB.
          await putLocalMatch(current)
          setMatches(prev => {
            const hasCurrent = prev.some(item => item.localId === current.localId)
            return hasCurrent
              ? prev.map(item => item.localId === current.localId ? current : item)
              : [current, ...prev]
          })
          setActiveMatch(current)
        } else if (refreshed) {
          activeMatchRef.current = refreshed
          setActiveMatch(refreshed)
        }
      }
      if (!silent) setMessage(pending.length ? `${pending.length} partida(s) sincronizada(s) com o dashboard.` : 'Tudo já está sincronizado.')
    } catch (error) {
      if (!silent) setMessage(`Os dados continuam salvos no Mac. Sincronização pendente: ${error.message}`)
    } finally { setSyncing(false) }
  }, [pullRemote, refreshLocal, syncOne])

  const scheduleAutoSync = useCallback((delay = 700) => {
    if (!navigator.onLine) return
    if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current)
    autoSyncTimerRef.current = setTimeout(() => {
      autoSyncTimerRef.current = null
      void syncAll({ silent: true })
    }, delay)
  }, [syncAll])

  const prepareOffline = useCallback(async () => {
    if (!('serviceWorker' in navigator)) { setOfflineReady(false); return }
    try {
      const registration = await navigator.serviceWorker.register('/serie-c-live-sw.js', { scope: '/', updateViaCache: 'none' })
      await registration.update().catch(() => null)
      await navigator.serviceWorker.ready
      const resources = performance.getEntriesByType('resource')
        .map(entry => entry.name).filter(url => url.startsWith(window.location.origin))
        .map(url => new URL(url).pathname + new URL(url).search)
      const urls = Array.from(new Set(['/serie-c/coleta-ao-vivo', CREST, ...resources]))
      const worker = registration.active || registration.waiting || registration.installing
      if (!worker) { setOfflineReady(false); return }
      const cacheStatus = await new Promise(resolve => {
        const channel = new MessageChannel()
        const timeout = setTimeout(() => resolve({ ok: false }), 8000)
        channel.port1.onmessage = event => { clearTimeout(timeout); resolve(event.data || { ok: false }) }
        worker.postMessage({ type: 'CACHE_URLS', urls }, [channel.port2])
      })
      setOfflineReady(Boolean(cacheStatus?.ok))
    } catch { setOfflineReady(false) }
  }, [])

  useEffect(() => {
    setOnline(navigator.onLine)
    refreshLocal().then(() => { if (navigator.onLine) syncAll({ silent: true }) }).catch(error => setMessage(error.message))
    prepareOffline()
    const onOnline = () => { setOnline(true); syncAll({ silent: false }) }
    const onOffline = () => { setOnline(false); setMessage('Modo offline ativo. As marcações estão sendo salvas neste Mac até a conexão voltar.') }
    const onFocus = () => { if (navigator.onLine) syncAll({ silent: true }) }
    const periodic = setInterval(() => { if (navigator.onLine) syncAll({ silent: true }) }, 20000)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', onFocus)
      clearInterval(periodic)
      if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const pendingCount = matches.filter(match => match.dirty).length

  async function commitMatch(nextMatch, { trySync = false } = {}) {
    localMutationVersionRef.current += 1
    const optimistic = { ...nextMatch, updatedAt: new Date().toISOString(), dirty: true }
    activeMatchRef.current = optimistic
    setActiveMatch(optimistic)
    setMatches(prev => prev.some(row => row.localId === optimistic.localId)
      ? prev.map(row => row.localId === optimistic.localId ? optimistic : row)
      : [optimistic, ...prev])
    const saved = await putLocalMatch(optimistic)

    if (navigator.onLine) {
      if (trySync) {
        const mutationVersionAtSend = localMutationVersionRef.current
        try {
          const synced = await syncOne(saved)
          const current = activeMatchRef.current
          // Só aplica a resposta se nenhuma nova ação foi feita enquanto o
          // snapshot viajava até o banco geral.
          if (synced && current?.localId === saved.localId && localMutationVersionRef.current === mutationVersionAtSend) {
            activeMatchRef.current = synced
            setActiveMatch(synced)
            setMatches(prev => prev.map(row => row.localId === synced.localId ? synced : row))
          }
        } catch (error) {
          setMessage(`Salvo neste Mac. Banco geral pendente: ${error.message}`)
        }
      } else {
        // Durante a coleta os cliques continuam instantâneos no Mac, mas são
        // enviados ao Postgres em segundo plano logo após a sequência de ações.
        scheduleAutoSync()
      }
    }
    return saved
  }

  async function createMatch(event) {
    event.preventDefault()
    if (!draft.opponent.trim()) { setMessage('Informe o adversário.'); return }
    const now = new Date().toISOString()
    const match = {
      localId: newLocalId(), season: SEASON, competition: COMPETITION,
      opponent: draft.opponent.trim(), matchDate: draft.matchDate || localDateValue(), homeAway: draft.homeAway,
      round: draft.round || '', venue: draft.venue.trim(), notes: draft.notes.trim(), status: 'open', activeHalf: 1,
      firstHalfFinishedAt: null, secondHalfFinishedAt: null, timer: { ...EMPTY_TIMER }, events: [],
      createdAt: now, updatedAt: now, dirty: true, syncedAt: null, deletedAt: null,
    }
    await commitMatch(match, { trySync: true })
    setDraft({ opponent: '', matchDate: localDateValue(), homeAway: 'M', round: '', venue: '', notes: '' })
    setMessage('Partida criada e salva. Online, ela já entra no banco geral; offline, fica pendente neste Mac até a conexão voltar.')
  }

  async function openMatch(localId) {
    const match = await getLocalMatch(localId)
    if (match) { activeMatchRef.current = match; setActiveMatch(match) }
  }

  async function deleteMatch(match) {
    if (!window.confirm(`Excluir ${matchTitle(match)}? Essa exclusão também será sincronizada quando houver internet.`)) return
    const tombstone = { ...match, deletedAt: new Date().toISOString(), dirty: true }
    await putLocalMatch(tombstone)
    if (activeMatchRef.current?.localId === match.localId) { activeMatchRef.current = null; setActiveMatch(null) }
    await refreshLocal()
    if (navigator.onLine) syncAll({ silent: true })
  }

  function addEvent(type, zone, delta = 1) {
    const base = activeMatchRef.current
    if (!base || base.status === 'finished') return
    const half = Number(base.activeHalf || 1)
    if (delta < 0) {
      const index = [...(base.events || [])].map((event, idx) => ({ event, idx })).reverse().find(item => Number(item.event.half) === half && item.event.type === type && item.event.zone === zone)?.idx
      if (index === undefined) return
      const events = [...base.events]
      events.splice(index, 1)
      void commitMatch({ ...base, events })
      return
    }
    const event = { localId: newLocalId(), type, zone: zone ?? null, half, matchSeconds: secondsFor(base, half), createdAt: new Date().toISOString() }
    void commitMatch({ ...base, events: [...(base.events || []), event] })
  }

  function undoLastEvent() {
    const base = activeMatchRef.current
    if (!base?.events?.length || base.status === 'finished') return
    void commitMatch({ ...base, events: base.events.slice(0, -1) })
    setMessage('Última marcação desfeita.')
  }

  function toggleClock() {
    const base = activeMatchRef.current
    if (!base || base.status === 'finished') return
    // Marca a ação antes de qualquer I/O. Isso faz o primeiro clique ser a
    // fonte de verdade mesmo se houver uma sincronização automática em curso.
    localMutationVersionRef.current += 1
    const half = Number(base.activeHalf || 1)
    const nowMs = Date.now()
    const timer = { ...EMPTY_TIMER, ...(base.timer || {}) }
    if (Number(timer.runningHalf) === half) {
      const key = half === 1 ? 'half1Elapsed' : 'half2Elapsed'
      timer[key] = secondsFor(base, half, nowMs)
      timer.runningHalf = null
      timer.startedAt = null
    } else {
      if (timer.runningHalf) {
        const previousHalf = Number(timer.runningHalf)
        const previousKey = previousHalf === 1 ? 'half1Elapsed' : 'half2Elapsed'
        timer[previousKey] = secondsFor(base, previousHalf, nowMs)
      }
      timer.runningHalf = half
      timer.startedAt = new Date(nowMs).toISOString()
    }
    const optimistic = { ...base, timer, updatedAt: new Date(nowMs).toISOString(), dirty: true }
    activeMatchRef.current = optimistic
    setActiveMatch(optimistic)
    setTick(nowMs)
    setMatches(prev => prev.map(row => row.localId === optimistic.localId ? optimistic : row))
    setMessage(Number(timer.runningHalf) === half ? `${half}º tempo iniciado.` : `${half}º tempo pausado.`)
    void putLocalMatch(optimistic).then(() => {
      if (navigator.onLine) scheduleAutoSync(250)
    }).catch(error => setMessage(`Relógio ativo na tela, mas houve falha ao salvar localmente: ${error.message}`))
  }

  function resetClock() {
    const base = activeMatchRef.current
    if (!base || !window.confirm(`Zerar apenas o relógio do ${base.activeHalf}º tempo? As marcações não serão apagadas.`)) return
    const half = Number(base.activeHalf || 1)
    const timer = { ...EMPTY_TIMER, ...(base.timer || {}) }
    const key = half === 1 ? 'half1Elapsed' : 'half2Elapsed'
    timer[key] = 0; timer.runningHalf = null; timer.startedAt = null
    void commitMatch({ ...base, timer })
  }

  async function finishHalf() {
    const base = activeMatchRef.current
    if (!base || base.status === 'finished') return
    const half = Number(base.activeHalf || 1)
    if (!window.confirm(`Finalizar o ${half}º tempo?`)) return
    const timer = { ...EMPTY_TIMER, ...(base.timer || {}) }
    const key = half === 1 ? 'half1Elapsed' : 'half2Elapsed'
    timer[key] = secondsFor(base, half); timer.runningHalf = null; timer.startedAt = null
    const now = new Date().toISOString()
    const next = half === 1
      ? { ...base, timer, activeHalf: 2, firstHalfFinishedAt: now }
      : { ...base, timer, activeHalf: 2, status: 'finished', secondHalfFinishedAt: now }
    await commitMatch(next, { trySync: true })
    setMessage(half === 1 ? '1º tempo finalizado. O 2º tempo está pronto para iniciar.' : 'Partida finalizada, salva e pronta para relatório.')
  }

  async function saveCurrent() {
    const base = activeMatchRef.current
    if (!base) return
    await commitMatch(base, { trySync: true })
    setMessage(navigator.onLine ? 'Partida salva e enviada ao banco geral do dashboard.' : 'Partida salva neste Mac. Assim que este Mac voltar à internet, ela será enviada ao banco geral do dashboard.')
  }

  async function exportPng() {
    const base = activeMatchRef.current
    if (!exportWrapRef.current || !base) return
    try {
      setMessage('Gerando PNG do relatório...')
      const dataUrl = await toPng(exportWrapRef.current, { pixelRatio: 2, backgroundColor: '#eef2f5', cacheBust: true, skipFonts: true })
      const response = await fetch(dataUrl)
      saveBlob(await response.blob(), `relatorio-coleta-${base.matchDate}-${safeFilename(base.opponent)}.png`)
      setMessage('PNG gerado com campinhos, gráficos e resumo completo.')
    } catch (error) { setMessage(`Falha ao exportar PNG: ${error.message}`) }
  }

  async function exportPdf() {
    const base = activeMatchRef.current
    if (!exportPage1Ref.current || !exportPage2Ref.current || !base) return
    try {
      setMessage('Gerando PDF visual em 2 páginas...')
      const nodes = [exportPage1Ref.current, exportPage2Ref.current]
      const images = []
      for (const node of nodes) {
        const dataUrl = await toJpeg(node, { quality: 0.98, pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, skipFonts: true })
        const image = new Image()
        image.src = dataUrl
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
        images.push({ dataUrl, width: image.naturalWidth, height: image.naturalHeight })
      }
      const pdf = await jpegPagesToPdf(images)
      saveBlob(pdf, `relatorio-coleta-${base.matchDate}-${safeFilename(base.opponent)}.pdf`)
      setMessage('PDF gerado em 2 páginas com escudo, campinhos, gráficos e resumo por tempo.')
    } catch (error) { setMessage(`Falha ao exportar PDF: ${error.message}`) }
  }

  if (!activeMatch) {
    return (
      <AppShell>
        <SerieCTabs />
        <main className="space-y-6 p-4 md:p-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-600">Comissão técnica • coleta própria</p><h2 className="bc mt-1 text-3xl font-black text-slate-900">Coleta de jogo em tempo real</h2><p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-slate-500">Cadastre e marque mesmo offline. Com internet, as partidas e marcações são gravadas no banco geral do dashboard e aparecem em qualquer computador que abrir esta página.</p></div>
            <div className="flex flex-wrap gap-2">
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{online ? 'ONLINE' : 'OFFLINE'}</div>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black ${offlineReady ? 'border-emerald-200 bg-white text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}><ShieldCheck className="h-4 w-4" />{offlineReady ? 'PRONTO PARA USO OFFLINE' : 'PREPARANDO OFFLINE'}</div>
              <button type="button" onClick={() => syncAll()} disabled={!online || syncing} className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black text-white disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />SINCRONIZAR</button>
            </div>
          </div>
          {message && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-bold text-slate-600">{message}</div>}
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <form onSubmit={createMatch} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-600" /><h3 className="text-[12px] font-black uppercase tracking-wider text-slate-800">Nova partida</h3></div>
              <div className="mt-4 space-y-3">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Adversário<input value={draft.opponent} onChange={e => setDraft(v => ({ ...v, opponent: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] font-semibold text-slate-700 outline-none focus:border-emerald-300" placeholder="Ex.: Ponte Preta" /></label>
                <div className="grid grid-cols-2 gap-3"><label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Data<input type="date" value={draft.matchDate} onChange={e => setDraft(v => ({ ...v, matchDate: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] font-semibold" /></label><label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Mando<select value={draft.homeAway} onChange={e => setDraft(v => ({ ...v, homeAway: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] font-semibold"><option value="M">Mandante</option><option value="V">Visitante</option></select></label></div>
                <div className="grid grid-cols-2 gap-3"><label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Rodada<input type="number" min="1" value={draft.round} onChange={e => setDraft(v => ({ ...v, round: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] font-semibold" /></label><label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Local<input value={draft.venue} onChange={e => setDraft(v => ({ ...v, venue: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] font-semibold" placeholder="Opcional" /></label></div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Observação<textarea value={draft.notes} onChange={e => setDraft(v => ({ ...v, notes: e.target.value }))} rows="2" className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] font-semibold" /></label>
                <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-700">Criar e abrir partida</button>
              </div>
            </form>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Menu inicial</p><h3 className="mt-1 text-base font-black text-slate-800">Partidas cadastradas</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-black text-slate-500">{pendingCount} pendente(s)</span></div>
              <div className="mt-4 space-y-2">{matches.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-[11px] font-semibold text-slate-400">Nenhuma partida cadastrada ainda.</div>}{matches.map(match => <div key={match.localId} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-800">{matchTitle(match)}</p><span className="rounded-full bg-white px-2 py-1 text-[8px] font-black uppercase text-slate-500">{statusLabel(match)}</span></div><p className="mt-1 text-[10px] font-semibold text-slate-400">{match.matchDate ? new Date(`${match.matchDate}T12:00:00`).toLocaleDateString('pt-BR') : '-'}{match.round ? ` • Rodada ${match.round}` : ''} • {(match.events || []).length} marcações</p><p className={`mt-1 text-[9px] font-black ${match.dirty ? 'text-amber-600' : 'text-emerald-600'}`}>{match.dirty ? 'SALVO NESTE MAC • PENDENTE NO BANCO GERAL' : 'NO BANCO GERAL • DISPONÍVEL EM OUTROS DISPOSITIVOS'}</p></div><div className="flex gap-2"><button type="button" onClick={() => openMatch(match.localId)} className="rounded-xl bg-slate-900 px-4 py-2 text-[9px] font-black uppercase text-white">{match.status === 'finished' ? 'Ver relatório' : 'Abrir'}</button><button type="button" onClick={() => deleteMatch(match)} className="rounded-xl border border-red-100 bg-white px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
            </section>
          </div>
        </main>
      </AppShell>
    )
  }

  const activeHalf = Number(activeMatch.activeHalf || 1)
  const clockRunning = Number(activeMatch.timer?.runningHalf) === activeHalf
  const currentSeconds = secondsFor(activeMatch, activeHalf, tick)
  const lastEvent = activeMatch.events?.at(-1)
  const stats = buildStats(activeMatch)
  const liveStats = buildScopedStats(activeMatch, activeHalf)
  const finished = activeMatch.status === 'finished'

  return (
    <AppShell>
      <SerieCTabs />
      <main className="space-y-4 p-3 md:p-6">
        <div className="sticky top-[104px] z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur md:top-[112px]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => { activeMatchRef.current = null; setActiveMatch(null) }} className="rounded-xl border border-slate-200 p-2 text-slate-500"><ArrowLeft className="h-4 w-4" /></button><img src={CREST} alt="Confiança" className="h-9 w-9 object-contain" /><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{matchTitle(activeMatch)}</p><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{finished ? 'Partida finalizada • relatório' : `${activeHalf}º tempo`} • {online ? 'online' : 'offline'} • {activeMatch.dirty ? 'pendente neste Mac' : 'banco geral'}</p></div></div>
            <div className="flex flex-wrap items-center gap-2">
              {!finished && <><div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-white transition ${clockRunning ? 'bg-emerald-600 ring-2 ring-emerald-200' : 'bg-slate-900'}`}><Clock3 className={`h-4 w-4 ${clockRunning ? 'animate-pulse' : ''}`} /><span className="font-mono text-xl font-black tracking-wider">{formatClock(currentSeconds)}</span></div><button type="button" onClick={toggleClock} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[9px] font-black uppercase ${clockRunning ? 'bg-amber-100 text-amber-800' : 'bg-emerald-600 text-white'}`}>{clockRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{clockRunning ? 'Pausar' : 'Iniciar'}</button><button type="button" onClick={resetClock} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"><RotateCcw className="h-4 w-4" /></button></>}
              {finished && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-[9px] font-black uppercase text-emerald-700"><CheckCircle2 className="h-4 w-4" />Partida finalizada</div>}
              <button type="button" onClick={saveCurrent} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase text-white"><Save className="h-4 w-4" />Salvar partida</button>
              <button type="button" onClick={exportPng} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase text-slate-700"><FileImage className="h-4 w-4" />PNG</button>
              <button type="button" onClick={exportPdf} className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[9px] font-black uppercase text-white"><FileText className="h-4 w-4" />PDF</button>
            </div>
          </div>
        </div>

        {message && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-bold text-slate-600">{message}</div>}

        {finished ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Relatório pós-jogo</p><p className="mt-1 text-[10px] font-semibold text-emerald-700/70">A tela de marcação foi substituída pelo relatório visual da partida. Os dados permanecem salvos e sincronizados na mesma base.</p></div><div className="hidden items-center gap-2 md:flex"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="text-[9px] font-black uppercase text-emerald-700">{activeMatch.dirty ? 'Pendente neste Mac' : 'Banco geral'}</span></div></div>
            <ReportPageOne match={activeMatch} />
            <ReportPageTwo match={activeMatch} />
          </div>
        ) : (
          <div className="grid gap-4 2xl:grid-cols-[1.32fr_.68fr]">
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <PitchZonePanel title="Entradas no terço final — Confiança" subtitle={`Somente ${activeHalf}º tempo • clique no corredor`} direction="up" accent="emerald" counts={liveStats.forZones} onZone={(zone, delta = 1) => addEvent('final_third_for', zone, delta)} compact />
                <PitchZonePanel title="Entradas no nosso terço — adversário" subtitle={`Somente ${activeHalf}º tempo • perspectiva do ataque adversário`} direction="down" accent="red" counts={liveStats.againstZones} onZone={(zone, delta = 1) => addEvent('final_third_against', zone, delta)} compact />
              </div>
              <div className="grid gap-4 lg:grid-cols-2"><SplitFieldCard title="Recuperações de posse — Confiança" type="recovery" own={liveStats.recOwn} opponent={liveStats.recOpp} onAdd={addEvent} accent="blue" /><SplitFieldCard title="Perdas de posse — Confiança" type="turnover" own={liveStats.lossOwn} opponent={liveStats.lossOpp} onAdd={addEvent} accent="red" /></div>
              <BoxTouchCard forCount={liveStats.boxFor} againstCount={liveStats.boxAgainst} onAdd={addEvent} />
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between"><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Última marcação</p><p className="mt-1 text-[11px] font-bold text-slate-700">{lastEvent ? `${EVENT_META[lastEvent.type]?.short || lastEvent.type}${lastEvent.zone ? ` • ${ZONE_LABEL[lastEvent.zone] || lastEvent.zone}` : ''} • ${lastEvent.half}ºT ${formatClock(lastEvent.matchSeconds)}` : 'Nenhuma marcação ainda'}</p></div><div className="flex gap-2"><button type="button" onClick={undoLastEvent} disabled={!lastEvent} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[9px] font-black uppercase text-slate-600 disabled:opacity-40"><Undo2 className="h-4 w-4" />Desfazer última</button><button type="button" onClick={finishHalf} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-[9px] font-black uppercase text-white"><Flag className="h-4 w-4" />{activeHalf === 1 ? 'Finalizar 1º tempo' : 'Finalizar 2º tempo'}</button></div></div>
            </section>
            <aside className="space-y-4"><LiveSummary match={activeMatch} tick={tick} /><div className={`rounded-2xl border p-4 ${activeMatch.dirty ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><div className="flex items-start gap-3">{activeMatch.dirty ? <Download className="mt-0.5 h-4 w-4 text-amber-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />}<div><p className={`text-[10px] font-black uppercase ${activeMatch.dirty ? 'text-amber-700' : 'text-emerald-700'}`}>{activeMatch.dirty ? 'Pendente neste Mac' : 'Banco geral'}</p><p className="mt-1 text-[9px] font-semibold leading-relaxed text-slate-500">{activeMatch.dirty ? 'Nenhum dado será perdido sem internet. Quando ESTE Mac voltar à conexão, as alterações pendentes serão enviadas ao banco geral.' : 'Esta partida está no banco geral do dashboard e pode ser carregada em outros notebooks/Macs.'}</p></div></div></div></aside>
          </div>
        )}

        <div aria-hidden="true" className="pointer-events-none fixed left-[-20000px] top-0 z-[-1] bg-white">
          <div ref={exportWrapRef} className="w-[1152px] space-y-4 bg-slate-100 p-4">
            <div ref={exportPage1Ref} className="overflow-hidden rounded-[4px] bg-white shadow-sm"><ReportPageOne match={activeMatch} exportMode /></div>
            <div ref={exportPage2Ref} className="overflow-hidden rounded-[4px] bg-white shadow-sm"><ReportPageTwo match={activeMatch} exportMode /></div>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
