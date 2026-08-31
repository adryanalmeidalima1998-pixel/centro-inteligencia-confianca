'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import AppShell from '../../components/layout/AppShell'
import { usePlayerPhotos } from '../../hooks/usePlayerPhotos'
import { PhotoSelectorModal } from '../../components/photos/PhotoSelectorModal'
import TabCorrelacao from './TabCorrelacao'
import { CORPO_TECNICO_DEMO_ENABLED, buildDemoGpsSessions } from '@/lib/demoCorpoTecnico'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LabelList, ReferenceLine, Cell,
  LineChart, Line, ComposedChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'

// ─── TEMA CONFIANÇA ─────────────────────────────────────────────────────────────
const G = {
  verde:      '#0B7C3D',
  verde2:     '#0d9649',
  verde3:     '#0a66b7',
  verdeLight: '#f0fdf4',
  verdeBorder:'#bbf7d0',
  amber:      '#f59e0b',
  amberLight: '#fffbeb',
  amberBorder:'#fde68a',
  red:        '#dc2626',
  sky:        '#0ea5e9',
  purple:     '#8b5cf6',
}

// ─── MÉTRICAS LINHA ───────────────────────────────────────────────────────────
const LINE_METRICS = [
  { key:'totalDistance', label:'Distância Total',     unit:'m',    color:'#0B7C3D', icon:'📏', shortLabel:'Dist.',    metaKey:'meta_dist',    step:100, min:0, max:15000 },
  { key:'dist20',        label:'HSR > 20 km/h',       unit:'m',    color:'#0a66b7', icon:'⚡', shortLabel:'HSR',      metaKey:'meta_dist20',  step:50,  min:0, max:3000  },
  { key:'dist25',        label:'Sprint > 25 km/h',    unit:'m',    color:'#0ea5e9', icon:'🚀', shortLabel:'Sprint',   metaKey:'meta_sprint',  step:10,  min:0, max:1500  },
  { key:'sprints',       label:'Nº de Sprints',        unit:'',     color:'#a855f7', icon:'🔁', shortLabel:'Sprints',  metaKey:'meta_sprints', step:1,   min:0, max:80    },
  { key:'accel',         label:'Acelerações',          unit:'',     color:'#f59e0b', icon:'📈', shortLabel:'Acel.',    metaKey:'meta_accel',   step:1,   min:0, max:80    },
  { key:'decel',         label:'Desacelerações',       unit:'',     color:'#64748b', icon:'📉', shortLabel:'Desac.',   metaKey:'meta_decel',   step:1,   min:0, max:80    },
  { key:'maxVel',        label:'Vel. Máxima',          unit:'km/h', color:'#f97316', icon:'🏎️', shortLabel:'Vel. Máx', metaKey:'meta_vel',     step:0.5, min:0, max:45    },
]

// ─── MÉTRICAS GOLEIROS ────────────────────────────────────────────────────────
const GK_METRICS = [
  { key:'totalDistance',  label:'Distância Total',        unit:'m',  color:'#0B7C3D', icon:'📏', shortLabel:'Distância'   },
  { key:'totalDiveCount', label:'Mergulhos Totais',        unit:'',   color:'#f59e0b', icon:'🤿', shortLabel:'Mergulhos'   },
  { key:'totalDiveLoad',  label:'Carga de Mergulho',       unit:'',   color:'#ef4444', icon:'⚖️', shortLabel:'Carga Merg.' },
  { key:'diveCentreCount',label:'Mergulhos ao Centro',     unit:'',   color:'#8b5cf6', icon:'🎯', shortLabel:'Centro'      },
  { key:'diveLeftCount',  label:'Mergulhos à Esquerda',    unit:'',   color:'#0ea5e9', icon:'⬅️', shortLabel:'Esquerda'    },
  { key:'diveRightCount', label:'Mergulhos à Direita',     unit:'',   color:'#10b981', icon:'➡️', shortLabel:'Direita'     },
  { key:'diveLoadRight',  label:'Carga Mergulho Direita',  unit:'',   color:'#06b6d4', icon:'↗️', shortLabel:'Carga Dir.'  },
  { key:'diveLoadLeft',   label:'Carga Mergulho Esquerda', unit:'',   color:'#6366f1', icon:'↖️', shortLabel:'Carga Esq.'  },
  { key:'jumpHigh',       label:'Saltos Alta Intens.',     unit:'',   color:'#f97316', icon:'🦘', shortLabel:'Salto Alto'  },
  { key:'jumpMed',        label:'Saltos Média Intens.',    unit:'',   color:'#fbbf24', icon:'⬆️', shortLabel:'Salto Méd.'  },
  { key:'jumpLow',        label:'Saltos Baixa Intens.',    unit:'',   color:'#a3e635', icon:'↑',  shortLabel:'Salto Baixo' },
  { key:'accel',          label:'Acelerações',             unit:'',   color:'#ec4899', icon:'📈', shortLabel:'Acel.'       },
  { key:'decel',          label:'Desacelerações',          unit:'',   color:'#94a3b8', icon:'📉', shortLabel:'Desac.'      },
]

const TIPO_ICONS   = { Treino:'🏃', Jogo:'⚽', Goleiros:'🧤' }
const PERIODO_ICONS= { Manhã:'🌅', Tarde:'☀️', Noite:'🌙' }

// Abas principais do dashboard
const TABS = [
  { id:'resumo',    label:'Resumo',    icon:'📊' },
  { id:'metricas',  label:'Métricas',  icon:'📐' },

  { id:'semanal',     label:'Semanal',     icon:'🗓️' },
  { id:'media_grupo', label:'Média Grupo', icon:'📊' },
  { id:'perfil',      label:'Perfil',      icon:'👤' },

  { id:'jogo_treino',  label:'Jogo vs Treino', icon:'⚽' },
  { id:'destaques',   label:'Destaques',   icon:'🏆' },
  { id:'goleiros',  label:'Goleiros',  icon:'🧤' },
  { id:'acwr',      label:'ACWR',       icon:'⚖️' },
  { id:'por_posicao',      label:'Por Posição',      icon:'📐' },
  { id:'rel_individual',   label:'Rel. Individual',  icon:'👤' },
  { id:'correlacao', label:'GPS x Perf.', icon:'🔗' },
  { id:'relatorio_jogo', label:'Rel. Jogo', icon:'📋' },
]

const META_STORAGE  = 'guarani_gps_metas_v4'

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const num = v => parseFloat(v) || 0
const fmt = (v, unit) => {
  const n = num(v)
  if (!unit) return n % 1 === 0 ? String(n) : n.toFixed(1)
  if (unit === 'm' && n >= 1000) return `${(n / 1000).toFixed(2)} km`
  if (unit === 'km/h') return `${n.toFixed(1)} km/h`
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}
const fmtShort = (v, unit) => {
  const n = num(v)
  if (unit === 'm' && n >= 1000) return `${(n / 1000).toFixed(1)}k`
  if (unit === 'km/h') return n.toFixed(1)
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}
const avg = (arr, key) => arr.length ? arr.reduce((s, r) => s + num(r[key]), 0) / arr.length : 0
const pctColor = p => p >= 100 ? G.verde : p >= 85 ? G.verde3 : p >= 70 ? G.amber : G.red
const pctBg    = p => p >= 100 ? 'bg-sky-50 border-sky-300' : p >= 85 ? 'bg-sky-50 border-sky-200' : p >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
const statusLabel = p => p >= 100 ? '✅ Meta atingida' : p >= 85 ? '🟡 Próximo' : p >= 70 ? '🟠 Abaixo' : '🔴 Muito abaixo'

// ─── HELPERS: FILTRO POR BLOCO (multi-seleção) ────────────────────────────────
// Lista de blocos/períodos disponíveis numa sessão (ex.: "Aquecimento", "Bloco 1"...)
const getSessionBlocos = session => (session?.rows?.blocos || []).filter(Boolean)

// Retorna as linhas (uma por atleta) considerando os blocos selecionados.
// Sem seleção => sessão completa (comportamento atual). Com 1+ blocos selecionados,
// soma as métricas aditivas de cada atleta nos blocos escolhidos (e usa o máximo para Vel. Máxima).
function getRowsForBlocos(session, selectedBlocos) {
  const allRows = session?.rows?.rows || []
  if (!selectedBlocos || selectedBlocos.length === 0) return allRows

  const rowsByBloco = session?.rows?.rowsByBloco || {}
  const merged = {}
  selectedBlocos.forEach(bloco => {
    const blocoRows = rowsByBloco[bloco] || []
    blocoRows.forEach(r => {
      const key = r.playerName
      if (!key) return
      if (!merged[key]) {
        merged[key] = {
          playerName: r.playerName,
          positionName: r.positionName || '',
          isGK: !!r.isGK,
          totalDistance: 0, dist20: 0, dist25: 0, sprints: 0, accel: 0, decel: 0, maxVel: 0,
        }
      }
      merged[key].totalDistance += num(r.totalDistance)
      merged[key].dist20        += num(r.dist20)
      merged[key].dist25        += num(r.dist25)
      merged[key].sprints       += num(r.sprints)
      merged[key].accel         += num(r.accel)
      merged[key].decel         += num(r.decel)
      merged[key].maxVel         = Math.max(merged[key].maxVel, num(r.maxVel))
      if (!merged[key].positionName && r.positionName) merged[key].positionName = r.positionName
    })
  })
  return Object.values(merged)
}

// Pills de seleção de bloco — permite marcar mais de um bloco ao mesmo tempo
function BlocoFilter({ blocos, selected, onChange }) {
  if (!blocos.length) return null
  const toggle = b => {
    if (selected.includes(b)) onChange(selected.filter(x => x !== b))
    else onChange([...selected, b])
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mr-1">Bloco(s):</span>
      <button onClick={() => onChange([])}
        className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all"
        style={selected.length === 0 ? { background: '#0B7C3D', color: '#fff', borderColor: '#0B7C3D' } : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
        Sessão Completa
      </button>
      {blocos.map(b => (
        <button key={b} onClick={() => toggle(b)}
          className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all"
          style={selected.includes(b) ? { background: '#0B7C3D', color: '#fff', borderColor: '#0B7C3D' } : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
          {b}
        </button>
      ))}
    </div>
  )
}

// ─── CSS GLOBAL ───────────────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
  .bc  { font-family: 'Barlow Condensed', sans-serif; }
  .dm  { font-family: 'DM Sans', sans-serif; }
  .scrollbar-g::-webkit-scrollbar { width:4px; height:4px }
  .scrollbar-g::-webkit-scrollbar-track { background:#f1f5f9 }
  .scrollbar-g::-webkit-scrollbar-thumb { background:#0B7C3D; border-radius:9999px }
  * { scrollbar-width:thin; scrollbar-color:#0B7C3D #f1f5f9 }
  .card-hover { transition: transform 0.15s, box-shadow 0.15s; }
  .card-hover:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(11,124,61,0.12); }
  .row-hover:hover { background: #f0fdf4; }
  .tab-active { position:relative; }
  .tab-active::after { content:''; position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:24px; height:3px; background:#0B7C3D; border-radius:9999px; }
  .fade-in { animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .gk-card { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); }
`

// ─── CUSTOM LABEL — valor DENTRO da barra (topo interno) ─────────────────────
const BarLabel = ({ x, y, width, height, value, unit }) => {
  if (value === undefined || value === null || value === 0 || width < 18 || height < 16) return null
  const label = fmtShort(value, unit)
  return (
    <text
      x={x + width / 2}
      y={y + Math.min(14, height * 0.45)}
      fill="#ffffff"
      textAnchor="middle"
      fontSize={7}
      fontWeight="900"
      fontFamily="DM Sans, sans-serif">
      {label}
    </text>
  )
}

// Trunca nome para o eixo X
const truncName = (name) => {
  if (!name) return ''
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 12)
  const first = parts[0]
  const last  = parts[parts.length - 1]
  const combined = first + ' ' + last
  if (combined.length <= 14) return combined
  // abreviado: PRIMEIRO + inicial do ÚLTIMO
  return first.slice(0, 10) + ' ' + last.charAt(0) + '.'
}

// ─── NOME DO ATLETA DENTRO DA BARRA (vertical, centralizado) ─────────────────
const PlayerNameLabel = ({ x, y, width, height, value }) => {
  if (!value || width < 10 || height < 30) return null
  const cx = x + width / 2
  const cy = y + height / 2
  return (
    <text
      x={cx}
      y={cy}
      fill="rgba(255,255,255,0.95)"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={9}
      fontWeight="700"
      fontFamily="DM Sans, sans-serif"
      transform={`rotate(-90, ${cx}, ${cy})`}>
      {value}
    </text>
  )
}

// Calcula altura do XAxis — sem labels, só precisamos de espaço mínimo
const xAxisHeight = (data) => 12

// ─── METRIC BAR CHART ─────────────────────────────────────────────────────────
function MetricChart({ data, metric, goal, isGk = false, height = null }) {
  if (!data?.length) return null
  const n = data.length
  const axisH = xAxisHeight(data)
  const h = height || Math.max(260, Math.min(420, 160 + n * 4))
  const barColor = metric.color

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 fade-in ${isGk ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{metric.icon}</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">
            {metric.label}
            {metric.unit && <span className="ml-1 text-gray-300 font-normal normal-case">({metric.unit})</span>}
          </p>
        </div>
        {goal > 0 && (
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
            🎯 Meta: {fmt(goal, metric.unit)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isGk ? '#fef3c7' : '#f1f5f9'} />
          <XAxis dataKey="name" tick={false} height={4} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', fontWeight: 600 }}
            formatter={v => [fmt(v, metric.unit), metric.label]}
            labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''} />
          {goal > 0 && (
            <ReferenceLine y={goal} stroke={G.verde} strokeDasharray="4 2" strokeWidth={2}
              label={{ value: `Meta`, position: 'insideTopRight', fontSize: 8, fill: G.verde, fontWeight: 700, dy: -4 }} />
          )}
          <Bar dataKey="value" fill={barColor} radius={[5, 5, 0, 0]} maxBarSize={52}>
            <LabelList dataKey="value" content={<BarLabel unit={metric.unit} />} />
            <LabelList dataKey="name" content={PlayerNameLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── TABELA GENÉRICA ──────────────────────────────────────────────────────────
function DataTable({ rows, metrics, isGk = false, title = null }) {
  if (!rows?.length) return null
  const sorted = [...rows].sort((a, b) => num(b.totalDistance) - num(a.totalDistance))
  const hBg = isGk ? '#f59e0b' : G.verde
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{title}</p>
        </div>
      )}
      <div className="overflow-x-auto scrollbar-g">
        <table className="w-full text-[10px]">
          <thead>
            <tr style={{ background: hBg }}>
              <th className="px-3 py-3 text-left text-[8px] font-black uppercase tracking-widest text-white w-8">#</th>
              <th className="px-3 py-3 text-left text-[8px] font-black uppercase tracking-widest text-white">Atleta</th>
              {metrics.map(m => (
                <th key={m.key} className="px-3 py-3 text-right text-[8px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                  {m.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className={`border-b border-gray-50 row-hover ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                <td className="px-3 py-2.5 text-gray-400 font-bold">{i + 1}</td>
                <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">{row.playerName}</td>
                {metrics.map(m => (
                  <td key={m.key} className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                    {fmt(row[m.key], m.unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── MODAL DE UPLOAD ──────────────────────────────────────────────────────────
function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [tipo, setTipo] = useState('Treino')
  const [periodo, setPeriodo] = useState('Tarde')
  const [titulo, setTitulo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const submit = async () => {
    if (!file) return setError('Selecione um arquivo CSV')
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tipo_sessao', tipo)
      fd.append('periodo_dia', periodo)
      fd.append('titulo', titulo || '')
      const res = await fetch('/api/gps', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      onSuccess()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="bc text-xl font-black uppercase text-gray-900">Upload CSV Catapult</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Jogadores de linha ou goleiros — detecção automática</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo + Período */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Tipo</p>
              <div className="grid grid-cols-3 gap-1">
                {['Treino','Jogo','Goleiros'].map(t => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wide flex flex-col items-center gap-0.5 border transition-all ${tipo===t ? 'text-white border-transparent' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-sky-300'}`}
                    style={tipo===t ? { background: t==='Goleiros' ? G.amber : G.verde } : {}}>
                    <span className="text-sm">{TIPO_ICONS[t]}</span>
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Período</p>
              <div className="grid grid-cols-3 gap-1">
                {['Manhã','Tarde','Noite'].map(p => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wide flex flex-col items-center gap-0.5 border transition-all ${periodo===p ? 'bg-sky-500 text-white border-sky-500' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    <span className="text-sm">{PERIODO_ICONS[p]}</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Título opcional */}
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Título <span className="font-normal normal-case text-gray-300">(opcional)</span></p>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder={`${tipo} ${periodo} — 2026`}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] text-gray-700 bg-gray-50 focus:outline-none focus:border-sky-400 transition-all" />
          </div>

          {/* Drop zone */}
          <div
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) setFile(f) }}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
              ${file ? 'border-sky-400 bg-sky-50' : 'border-gray-200 bg-gray-50 hover:border-sky-300 hover:bg-sky-50/50'}`}>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0B7C3D" strokeWidth={2} className="w-5 h-5"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <p className="text-[11px] font-bold text-sky-700">{file.name}</p>
                <p className="text-[9px] text-sky-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} className="w-8 h-8 mb-1"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p className="text-[11px] font-bold text-gray-400">Arraste o CSV ou clique aqui</p>
                <p className="text-[9px] text-gray-300">Catapult .csv — linha ou goleiros</p>
              </div>
            )}
          </div>

          {error && <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-xl">Cancelar</button>
          <button onClick={submit} disabled={loading || !file}
            className="px-5 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2 shadow"
            style={{ background: tipo === 'Goleiros' ? G.amber : G.verde }}>
            {loading
              ? <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Importando...</>
              : '✓ Importar Sessão'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DOWNLOAD CSV DE SESSÃO INDIVIDUAL ───────────────────────────────────────
function downloadSessionCsv(session) {
  const isGk = (session?.rows?.isGK ?? session?.rows?.isGk) || session?.tipo_sessao === 'Goleiros'
  const rowArr = Array.isArray(session.rows) ? session.rows : (session.rows?.rows || [])
  if (!rowArr.length) { alert('Sessão sem dados para exportar.'); return }

  const headers = isGk ? [
    'Sessão', 'Data', 'Tipo', 'Período',
    'Atleta', 'Posição',
    'Distância Total (m)',
    'Mergulhos Totais', 'Carga Mergulho',
    'Mergulho Centro', 'Mergulho Esq.', 'Mergulho Dir.',
    'Carga Merg. Dir.', 'Carga Merg. Esq.',
    'Saltos Alto', 'Saltos Méd.', 'Saltos Baixo',
    'Acelerações', 'Desacelerações',
  ] : [
    'Sessão', 'Data', 'Tipo', 'Período',
    'Atleta', 'Posição',
    'Distância Total (m)', 'HSR >20km/h (m)', 'Sprint >25km/h (m)',
    'Nº Sprints', 'Acelerações', 'Desacelerações', 'Vel. Máxima (km/h)',
  ]

  const escCsv = v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }

  const rows = [headers]
  rowArr.forEach(r => {
    if (isGk) {
      rows.push([
        session.titulo || '', session.data_sessao || '', session.tipo_sessao || '', session.periodo_dia || '',
        r.playerName || '', r.positionName || '',
        num(r.totalDistance),
        num(r.totalDiveCount), num(r.totalDiveLoad),
        num(r.diveCentreCount), num(r.diveLeftCount), num(r.diveRightCount),
        num(r.diveLoadRight), num(r.diveLoadLeft),
        num(r.jumpHigh), num(r.jumpMed), num(r.jumpLow),
        num(r.accel), num(r.decel),
      ])
    } else {
      rows.push([
        session.titulo || '', session.data_sessao || '', session.tipo_sessao || '', session.periodo_dia || '',
        r.playerName || '', r.positionName || '',
        num(r.totalDistance), num(r.dist20), num(r.dist25),
        num(r.sprints), num(r.accel), num(r.decel), num(r.maxVel),
      ])
    }
  })

  const csv = '\uFEFF' + rows.map(r => r.map(escCsv).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  const safeTitle = (session.titulo || session.data_sessao || 'sessao').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/ /g, '_')
  a.download = `GPS_${safeTitle}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── SIDEBAR DE SESSÕES ───────────────────────────────────────────────────────
function SessionSidebar({ sessions, selectedId, onSelect, onDelete, loading, filterTipo, setFilterTipo, filterPeriodo, setFilterPeriodo }) {
  const filtered = sessions.filter(s => {
    if (filterTipo !== 'Todos' && s.tipo_sessao !== filterTipo) return false
    if (filterPeriodo !== 'Todos' && s.periodo_dia !== filterPeriodo) return false
    return true
  })

  return (
    <div className="flex-shrink-0 flex flex-col gap-3" style={{ width: 264 }}>
      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">
            Filtrar sessões
          </p>
        </div>
        <div className="px-3 py-3 space-y-2.5">
          <div>
            <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-1">Tipo</p>
            <div className="flex gap-1 flex-wrap">
              {['Todos','Treino','Jogo','Goleiros'].map(t => (
                <button key={t} onClick={() => setFilterTipo(t)}
                  className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase transition-all ${filterTipo===t ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  style={filterTipo===t ? { background: t==='Goleiros' ? G.amber : G.verde } : {}}>
                  {t !== 'Todos' ? TIPO_ICONS[t]+' ' : ''}{t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-1">Período</p>
            <div className="flex gap-1 flex-wrap">
              {['Todos','Manhã','Tarde','Noite'].map(p => (
                <button key={p} onClick={() => setFilterPeriodo(p)}
                  className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase transition-all ${filterPeriodo===p ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {p !== 'Todos' ? PERIODO_ICONS[p]+' ' : ''}{p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1">
        <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">
            {filtered.length} de {sessions.length} sessão(ões)
          </p>
        </div>

        <div className="overflow-y-auto scrollbar-g" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: G.verde }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xl mb-1">📂</p>
              <p className="text-[9px] font-bold text-gray-400">Nenhuma sessão</p>
            </div>
          ) : filtered.map(s => {
            const isGk = s.tipo_sessao === 'Goleiros'
            const isSelected = s.id === selectedId
            const date = s.data_sessao
              ? new Date(s.data_sessao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
              : '—'

            return (
              <div key={s.id}
                onClick={() => onSelect(s.id)}
                className={`px-3 py-2.5 border-b cursor-pointer border-l-[3px] transition-colors
                  ${isSelected
                    ? isGk ? 'bg-amber-50 border-l-amber-500 border-b-amber-100' : 'bg-sky-50 border-l-sky-600 border-b-sky-100'
                    : 'border-l-transparent border-b-gray-50 hover:bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    {isGk && (
                      <span className="inline-flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 mb-1">
                        🧤 Goleiros
                      </span>
                    )}
                    <p className={`text-[10px] font-bold truncate leading-tight ${isSelected ? (isGk?'text-amber-800':'text-sky-800') : 'text-gray-800'}`}>
                      {s.titulo}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="text-[8px] text-gray-400">{date}</span>
                      {!isGk && s.tipo_sessao && (
                        <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${s.tipo_sessao==='Jogo' ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                          {TIPO_ICONS[s.tipo_sessao]} {s.tipo_sessao}
                        </span>
                      )}
                      {s.periodo_dia && (
                        <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-sky-50 text-sky-600">
                          {PERIODO_ICONS[s.periodo_dia]} {s.periodo_dia}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 flex-shrink-0 mt-0.5">
                    {/* Botão download CSV */}
                    <button
                      onClick={e => { e.stopPropagation(); downloadSessionCsv(s) }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-sky-600 hover:bg-sky-50 transition-all"
                      title="Baixar CSV desta sessão">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    {/* Botão deletar */}
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Excluir">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── HELPERS COMPARTILHADOS ────────────────────────────────────────────────────
function durationToMin(raw) {
  if (!raw) return 0
  const s = String(raw)
  const parts = s.split(':')
  if (parts.length === 3) return parseInt(parts[0])*60 + parseInt(parts[1]) + parseInt(parts[2])/60
  if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1])/60
  const n = parseFloat(s)
  return n > 300 ? n/60 : n // se > 300 assume segundos, senão minutos
}

function pct75(v) { return parseFloat((v * 0.75).toFixed(1)) }
function pct90(v) { return parseFloat((v * 0.90).toFixed(1)) }

// Cover de relatório padrão
function RelatorioCover({ session, titulo, subtitulo, info }) {
  return (
    <div style={{ background: '#0B7C3D', borderRadius: 12, padding: '18px 24px', marginBottom: 14, color: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: 2 }}>
            {titulo || 'Sessão de Treinamento'}
          </p>
          <p style={{ fontFamily: 'Barlow Condensed', fontSize: 16, fontWeight: 700, margin: '2px 0 0', opacity: 0.85 }}>
            {subtitulo || 'Relatório de Carga Profissional'}
          </p>
          <p style={{ fontSize: 10, opacity: 0.65, margin: '6px 0 0' }}>Departamento de Fisiologia</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, opacity: 0.8, lineHeight: 1.8 }}>
          {session?.data_sessao && <div>{new Date(session.data_sessao+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>}
          {info?.horario && <div>⏰ {info.horario}</div>}
          {info?.turno && <div>☀️ Turno: {info.turno}</div>}
          {info?.local && <div>📍 {info.local}</div>}
        </div>
      </div>
    </div>
  )
}

// KPI card simples
function KpiCard({ label, value, unit, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 120 }}>
      <p style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280', margin: 0 }}>{label}</p>
      <p style={{ fontFamily: 'Barlow Condensed', fontSize: 32, fontWeight: 900, color: color || '#0B7C3D', margin: '2px 0 0', lineHeight: 1 }}>{value}</p>
      {unit && <p style={{ fontSize: 8, color: '#9ca3af', margin: 0 }}>{unit}</p>}
    </div>
  )
}

// Tabela de velocidade máxima (Player, MaxVel, 75%, 90%)
function VelocidadeTable({ rows }) {
  const sorted = [...rows].sort((a, b) => num(b.maxVel) - num(a.maxVel))
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100" style={{ background: '#0B7C3D' }}>
        <p className="text-[8px] font-black uppercase tracking-widest text-white">Velocidade Máxima</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Player Name', 'Maximum Velocity', '75 DA MÁXIMA', '90 DA MÁXIMA'].map(h => (
                <th key={h} className={`px-3 py-2.5 text-[8px] font-black uppercase tracking-wide text-gray-500 ${h==='Player Name'?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const vel = num(r.maxVel)
              return (
                <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                  <td className="px-3 py-2 font-bold text-gray-900">{r.playerName}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums" style={{ color: '#0B7C3D' }}>{vel.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{pct75(vel).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{pct90(vel).toFixed(1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ABA RESUMO ───────────────────────────────────────────────────────────────

// ─── ABA RESUMO ───────────────────────────────────────────────────────────────
function TabResumo({ session, sessionGoals }) {
  const isGk = (session?.rows?.isGK ?? session?.rows?.isGk) || session?.tipo_sessao === 'Goleiros'
  const allRows = session?.rows?.rows || []

  const [mode, setMode] = useState('analise')  // 'analise' | 'relatorio'
  const [selectedPlayers, setSelectedPlayers] = useState(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [relInfo, setRelInfo] = useState({ horario: '9:30 (BRT)', turno: 'Manhã', local: 'Aracaju - SE' })

  useEffect(() => {
    setSelectedPlayers(null)
    setSelectorOpen(false)
  }, [session?.id])

  if (!allRows.length) return <EmptyState icon="📊" text="Selecione uma sessão para ver o resumo" />

  const rows = selectedPlayers ? allRows.filter(r => selectedPlayers.has(r.playerName)) : allRows
  const isActive  = name => !selectedPlayers || selectedPlayers.has(name)
  const allSel    = !selectedPlayers || selectedPlayers.size === allRows.length
  const selCount  = selectedPlayers ? selectedPlayers.size : allRows.length

  const togglePlayer = name => {
    setSelectedPlayers(prev => {
      const base = prev ? new Set(prev) : new Set(allRows.map(r => r.playerName))
      if (base.has(name)) { if (base.size === 1) return null; base.delete(name) }
      else base.add(name)
      return base.size === allRows.length ? null : new Set(base)
    })
  }

  const metrics = isGk ? GK_METRICS : LINE_METRICS
  const mainMetrics = isGk
    ? ['totalDiveCount','totalDiveLoad','totalDistance','accel','decel','jumpHigh','jumpMed','jumpLow','diveCentreCount','diveLeftCount','diveRightCount']
    : ['totalDistance','dist20','dist25','sprints','accel','decel','maxVel']

  const cardDefs = isGk ? [
    { label:'Goleiros',         value: rows.length,                         icon:'🧤', vc:'text-amber-800',  bg:'bg-amber-50 border-amber-200'   },
    { label:'Méd. Distância',   value: fmt(avg(rows,'totalDistance'), 'm'), icon:'📏', vc:'text-emerald-800',bg:'bg-emerald-50 border-emerald-200'},
    { label:'Méd. Mergulhos',   value: avg(rows,'totalDiveCount').toFixed(1),icon:'🤿', vc:'text-blue-800',  bg:'bg-blue-50 border-blue-200'     },
    { label:'Méd. Carga Merg.', value: avg(rows,'totalDiveLoad').toFixed(1),icon:'⚖️', vc:'text-red-800',    bg:'bg-red-50 border-red-200'       },
    { label:'Méd. Saltos Altos',value: avg(rows,'jumpHigh').toFixed(1),     icon:'🦘', vc:'text-orange-800', bg:'bg-orange-50 border-orange-200' },
    { label:'Méd. Saltos Méd.', value: avg(rows,'jumpMed').toFixed(1),      icon:'⬆️', vc:'text-yellow-800', bg:'bg-yellow-50 border-yellow-200' },
    { label:'Méd. Acel.',       value: avg(rows,'accel').toFixed(1),         icon:'📈', vc:'text-purple-800', bg:'bg-purple-50 border-purple-200' },
    { label:'Méd. Desac.',      value: avg(rows,'decel').toFixed(1),         icon:'📉', vc:'text-gray-700',   bg:'bg-gray-50 border-gray-200'     },
  ] : [
    { label:'Atletas',          value: rows.length,                          icon:'👥', vc:'text-slate-800',  bg:'bg-slate-50 border-slate-200'   },
    { label:'Méd. Distância',   value: fmt(avg(rows,'totalDistance'), 'm'),  icon:'📏', vc:'text-emerald-800',bg:'bg-emerald-50 border-emerald-200'},
    { label:'Méd. HSR > 20',    value: fmt(avg(rows,'dist20'), 'm'),          icon:'⚡', vc:'text-blue-800',  bg:'bg-blue-50 border-blue-200'     },
    { label:'Méd. Sprint',      value: fmt(avg(rows,'dist25'), 'm'),          icon:'🚀', vc:'text-amber-800',  bg:'bg-amber-50 border-amber-200'   },
    { label:'Vel. Máxima',      value: `${(rows.length ? Math.max(...rows.map(r=>num(r.maxVel))) : 0).toFixed(1)} km/h`, icon:'🏎️', vc:'text-orange-800', bg:'bg-orange-50 border-orange-200' },
    { label:'Méd. Sprints',     value: avg(rows,'sprints').toFixed(1),        icon:'🔁', vc:'text-purple-800', bg:'bg-purple-50 border-purple-200' },
    { label:'Méd. Acelerações', value: avg(rows,'accel').toFixed(1),          icon:'📈', vc:'text-yellow-800', bg:'bg-yellow-50 border-yellow-800' },
    { label:'Méd. Desacel.',    value: avg(rows,'decel').toFixed(1),          icon:'📉', vc:'text-gray-700',   bg:'bg-gray-50 border-gray-200'     },
  ]

  // ── RELATÓRIO MODE ─────────────────────────────────────────────────────────
  const avgDist    = avg(rows, 'totalDistance')
  const avgSprints = avg(rows, 'sprints')
  const avgAcc     = avg(rows, 'accel')
  const avgDecel   = avg(rows, 'decel')
  const avgMins    = rows.length ? rows.reduce((s,r) => s + durationToMin(r.duration), 0) / rows.length : 0

  const sortedByDist   = [...rows].sort((a,b) => num(b.totalDistance) - num(a.totalDistance))
  const sortedBySprint = [...rows].sort((a,b) => num(b.sprints) - num(a.sprints))
  const sortedByAcc    = [...rows].sort((a,b) => num(b.accel) - num(a.accel))
  const sortedByMins   = [...rows].sort((a,b) => durationToMin(b.duration) - durationToMin(a.duration))

  const relBar = (data, key, color, labelFn) => {
    const max = Math.max(...data.map(r => num(r[key])), 1)
    return data.map(r => {
      const v = num(r[key])
      const pct = (v/max)*100
      return (
        <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <p style={{ width:160, fontSize:9, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.playerName}
          </p>
          <div style={{ flex:1, height:22, background:'#f3f4f6', borderRadius:4, overflow:'hidden', position:'relative' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:6 }}>
              <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{labelFn ? labelFn(v) : Math.round(v)}</span>
            </div>
          </div>
        </div>
      )
    })
  }

  const accDecelBar = (data) => {
    const maxV = Math.max(...data.map(r => Math.max(num(r.accel), num(r.decel))), 1)
    return data.map(r => {
      const acc   = num(r.accel)
      const decel = num(r.decel)
      return (
        <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <p style={{ width:160, fontSize:9, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.playerName}
          </p>
          <div style={{ flex:1, display:'flex', gap:2, height:22 }}>
            <div style={{ width:`${(acc/maxV)*50}%`, height:'100%', background:'#0B7C3D', borderRadius:'4px 0 0 4px', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>
              <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{Math.round(acc)}</span>
            </div>
            <div style={{ width:`${(decel/maxV)*50}%`, height:'100%', background:'#0ea5e9', borderRadius:'0 4px 4px 0', display:'flex', alignItems:'center', paddingLeft:4 }}>
              <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{Math.round(decel)}</span>
            </div>
          </div>
        </div>
      )
    })
  }

  if (mode === 'relatorio') return (
    <div className="space-y-5 fade-in dm">
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #rel-treino, #rel-treino * { visibility: visible !important; }
          #rel-treino {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            font-size: 10px !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Controles (não imprimem) */}
      <div className="flex items-center gap-3 flex-wrap no-print">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setMode('analise')} className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-white">📊 Análise</button>
          <button className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white text-gray-900 shadow-sm">📋 Relatório</button>
        </div>
        {[
          { k:'horario', ph:'9:30 (BRT)' }, { k:'turno', ph:'Manhã' }, { k:'local', ph:'Local...' }
        ].map(f => (
          <input key={f.k} value={relInfo[f.k]} onChange={e => setRelInfo(p=>({...p,[f.k]:e.target.value}))}
            placeholder={f.ph}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-[9px] bg-gray-50 focus:outline-none focus:border-sky-400 w-40" />
        ))}
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase shadow-sm ml-auto"
          style={{ background:'#0B7C3D' }}>
          🖨️ Imprimir
        </button>
      </div>

      <div id="rel-treino">
        <RelatorioCover session={session} subtitulo={`Relatório de Carga Profissional${isGk?' (Goleiros)':''}`} info={relInfo} />

        {/* KPIs */}
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <KpiCard label="Atletas" value={rows.length} unit="jogadores" />
          <KpiCard label="Méd. Distância/Atleta" value={Math.round(avgDist)} unit="m" />
          <KpiCard label="Méd. Sprints/Atleta" value={avgSprints.toFixed(1)} unit="nº >25km/h" />
          <KpiCard label="Méd. Acel./Atleta" value={avgAcc.toFixed(1)} unit="nº >3m/s²" />
          <KpiCard label="Méd. Desac./Atleta" value={avgDecel.toFixed(1)} unit="nº <-3m/s²" />
          {avgMins > 0 && <KpiCard label="Méd. Minutos/Atleta" value={avgMins.toFixed(0)} unit="min" />}
        </div>

        {/* Total Distance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">Total Distance (m)</p>
          {relBar(sortedByDist, 'totalDistance', '#0B7C3D', v => `${(v/1000).toFixed(3)}`)}
        </div>

        {/* Sprint count */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">Quantidade de Sprints &gt;25,2 km/h</p>
          {relBar(sortedBySprint, 'sprints', '#0a66b7', v => Math.round(v))}
        </div>

        {/* Acc + Decel grouped */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-4 mb-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Acc &gt;3 m/s² (nº) / Decel &lt;-3 m/s² (nº)</p>
            <div className="flex items-center gap-3 text-[8px]">
              <span><span style={{ background:'#0B7C3D', borderRadius:3, padding:'1px 6px', color:'white', fontWeight:700 }}>■</span> Aceleração</span>
              <span><span style={{ background:'#0ea5e9', borderRadius:3, padding:'1px 6px', color:'white', fontWeight:700 }}>■</span> Desaceleração</span>
            </div>
          </div>
          {accDecelBar(sortedByAcc)}
        </div>

        {/* Minutagem */}
        {avgMins > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">Minutagem (min)</p>
            {relBar(sortedByMins, '_mins', '#0ea5e9', v => Math.round(v))}
          </div>
        )}

        {/* Velocity table */}
        <VelocidadeTable rows={rows} />
      </div>
    </div>
  )

  // ── ANÁLISE MODE (existing) ────────────────────────────────────────────────
  return (
    <div className="space-y-6 fade-in">
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white text-gray-900 shadow-sm">📊 Análise</button>
          <button onClick={() => setMode('relatorio')} className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-white">📋 Relatório</button>
        </div>
      </div>

      {/* ── Seletor de atletas ─────────────────────────────────────────────── */}
      <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${!allSel ? 'border-sky-300' : 'border-gray-200'}`}>
        <button onClick={() => setSelectorOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-sm">👥</span>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Filtrar Atletas</p>
            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${allSel ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-sky-100 text-sky-700 border-sky-300'}`}>
              {selCount}/{allRows.length} selecionado{selCount !== 1 ? 's' : ''}
            </span>
            {!allSel && (
              <button onClick={e => { e.stopPropagation(); setSelectedPlayers(null) }}
                className="text-[8px] font-bold text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded-lg hover:bg-red-50 border border-red-200 transition-all">
                ✕ Limpar filtro
              </button>
            )}
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${selectorOpen ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>
        </button>
        {selectorOpen && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setSelectedPlayers(null)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wide border transition-all ${allSel ? 'text-white border-transparent' : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-sky-300'}`}
                style={allSel ? { background: G.verde } : {}}>
                Todos
              </button>
              {allRows.slice().sort((a,b) => num(b.totalDistance)-num(a.totalDistance)).map(r => {
                const active = isActive(r.playerName)
                return (
                  <button key={r.playerName} onClick={() => togglePlayer(r.playerName)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[8px] font-bold border transition-all ${active ? 'text-white border-transparent shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-sky-200 line-through'}`}
                    style={active ? { background: isGk ? G.amber : G.verde } : {}}>
                    {truncName(r.playerName)}
                  </button>
                )
              })}
            </div>
            <p className="text-[7px] text-gray-300 mt-2">Clique nos nomes para incluir/excluir da visualização</p>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cardDefs.map(c => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.bg}`}>
            <div className="flex items-start justify-between mb-1"><p className="text-[7px] font-black uppercase tracking-widest text-gray-500">{c.label}</p><span>{c.icon}</span></div>
            <p className={`bc text-2xl font-black leading-none ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="space-y-4">
        {metrics.filter(m => mainMetrics.includes(m.key)).map(m => {
          const data = [...rows].sort((a,b) => num(b[m.key])-num(a[m.key])).map(r => ({ name: truncName(r.playerName), fullName: r.playerName, value: num(r[m.key]) }))
          return <MetricChart key={m.key} data={data} metric={m} goal={sessionGoals?.[m.metaKey]} isGk={isGk} />
        })}
      </div>

      {/* Tabela Velocidade */}
      {!isGk && <VelocidadeTable rows={rows} />}

      {/* Tabela completa */}
      <DataTable rows={rows} metrics={metrics} isGk={isGk}
        title={`Tabela Completa — ${rows.length} atleta${rows.length > 1 ? 's' : ''}${!allSel ? ` (filtrado de ${allRows.length})` : ''}`} />
    </div>
  )
}


// ─── ABA MÉTRICAS ─────────────────────────────────────────────────────────────
function TabMetricas({ session, sessionGoals }) {
  const isGk = (session?.rows?.isGK ?? session?.rows?.isGk) || session?.tipo_sessao === 'Goleiros'
  const rows  = session?.rows?.rows || []
  const metrics = isGk ? GK_METRICS : LINE_METRICS
  const [selected, setSelected] = useState(metrics[0].key)
  const metric = metrics.find(m => m.key === selected) || metrics[0]

  if (!rows.length) return <EmptyState icon="📐" text="Selecione uma sessão" />

  const sorted = [...rows].sort((a, b) => num(b[metric.key]) - num(a[metric.key]))
  const data   = sorted.map(r => ({ name: truncName(r.playerName), fullName: r.playerName, value: num(r[metric.key]) }))
  const teamAvg  = avg(rows, metric.key)
  const goal     = sessionGoals?.[metric.metaKey] || 0
  const maxVal   = Math.max(...rows.map(r => num(r[metric.key])))

  return (
    <div className="space-y-5 fade-in">
      {/* Seletor de métrica */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-3">Selecionar Métrica</p>
        <div className="flex flex-wrap gap-1.5">
          {metrics.map(m => (
            <button key={m.key} onClick={() => setSelected(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide border transition-all ${selected===m.key ? 'text-white border-transparent shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-sky-200'}`}
              style={selected===m.key ? { background: isGk ? m.color : m.color, borderColor: m.color } : {}}>
              <span>{m.icon}</span>
              {m.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Cards resumo da métrica */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Média da equipe', value: fmt(teamAvg, metric.unit), icon:'👥', bg:'bg-slate-50 border-slate-200', vc:'text-slate-800' },
          { label:'Valor máximo',    value: fmt(maxVal, metric.unit),   icon:'⬆️', bg:'bg-sky-50 border-sky-200',  vc:'text-sky-800' },
          { label:'Valor mínimo',    value: fmt(Math.min(...rows.map(r => num(r[metric.key]))), metric.unit), icon:'⬇️', bg:'bg-red-50 border-red-200', vc:'text-red-800' },
          { label:'Meta diária',     value: goal > 0 ? fmt(goal, metric.unit) : 'Não definida', icon:'🎯', bg:'bg-amber-50 border-amber-200', vc:'text-amber-800' },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.bg}`}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-[7px] font-black uppercase tracking-widest text-gray-500">{c.label}</p>
              <span>{c.icon}</span>
            </div>
            <p className={`bc text-xl font-black leading-none ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <MetricChart data={data} metric={metric} goal={goal} isGk={isGk} height={280} />

      {/* Tabela individual com comparação vs média e meta */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            {metric.icon} {metric.label} — Detalhamento por atleta
          </p>
        </div>
        <div className="overflow-x-auto scrollbar-g">
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: isGk ? G.amber : G.verde }}>
                {['#','Atleta','Valor','vs Média','vs Meta','Status'].map(h => (
                  <th key={h} className={`px-3 py-3 text-[8px] font-black uppercase tracking-widest text-white ${h==='Atleta'||h==='#' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const val  = num(row[metric.key])
                const diff = val - teamAvg
                const pct  = goal > 0 ? Math.min(100, (val / goal) * 100) : null
                return (
                  <tr key={i} className={`border-b border-gray-50 row-hover ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                    <td className="px-3 py-2.5 text-gray-400 font-bold">{i+1}</td>
                    <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">{row.playerName}</td>
                    <td className="px-3 py-2.5 text-right font-black tabular-nums" style={{ color: isGk ? G.amber : G.verde }}>{fmt(val, metric.unit)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-bold text-[9px] ${diff >= 0 ? 'text-sky-600' : 'text-red-500'}`}>
                      {diff >= 0 ? '+' : ''}{fmt(diff, metric.unit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                      {pct !== null ? `${Math.round(pct)}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[8px]">
                      {pct !== null ? statusLabel(pct) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── ABA SEMANAL ──────────────────────────────────────────────────────────────
function TabSemanal({ sessions, dateFrom, dateTo }) {
  const { getPhotoUrl } = usePlayerPhotos ? usePlayerPhotos() : { getPhotoUrl: () => null }
  const [relMode, setRelMode] = useState(false)
  const [relInfo, setRelInfo] = useState({ horario: '9:30 (BRT)', turno: 'Manhã', local: 'Aracaju - SE' })

  if (!dateFrom && !dateTo) return (
    <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl p-12 text-center fade-in">
      <p className="text-4xl mb-3">📅</p>
      <p className="bc text-lg font-black uppercase text-gray-700 mb-2">Selecione um período</p>
      <p className="text-[10px] text-gray-400 mb-4">Use o filtro de datas no cabeçalho para visualizar o acumulado semanal individual.</p>
    </div>
  )

  const filtered = sessions.filter(s => {
    if (!s.data_sessao) return false
    if (dateFrom && s.data_sessao < dateFrom) return false
    if (dateTo   && s.data_sessao > dateTo)   return false
    return true
  })

  if (!filtered.length) return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center fade-in">
      <p className="text-4xl mb-2">📅</p>
      <p className="bc text-lg font-black uppercase text-gray-400">Nenhuma sessão no período</p>
    </div>
  )

  // Acumula por atleta
  const totals = {}
  filtered.forEach(s => {
    const rowArr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
    rowArr.filter(r => !r.isGK && r.playerName).forEach(r => {
      const p = r.playerName
      if (!totals[p]) totals[p] = {
        playerName: p, positionName: r.positionName || '',
        totalDistance: 0, dist20: 0, dist25: 0, sprints: 0,
        accel: 0, decel: 0, maxVel: 0, _mins: 0, _sessions: 0
      }
      ;['totalDistance','dist20','dist25','sprints','accel','decel'].forEach(k => {
        totals[p][k] += num(r[k])
      })
      totals[p].maxVel = Math.max(totals[p].maxVel, num(r.maxVel))
      totals[p]._mins += durationToMin(r.duration)
      totals[p]._sessions++
    })
  })
  const players = Object.values(totals)

  const avgDist    = players.length ? players.reduce((s,p) => s+p.totalDistance,0)/players.length : 0
  const avgSprints = players.length ? players.reduce((s,p) => s+p.sprints,0)/players.length : 0
  const avgMins    = players.length ? players.reduce((s,p) => s+p._mins,0)/players.length : 0

  // Sorted arrays
  const byDist   = [...players].sort((a,b) => b.totalDistance - a.totalDistance)
  const bySprint = [...players].sort((a,b) => b.sprints - a.sprints)
  const byAcc    = [...players].sort((a,b) => b.accel - a.accel)
  const byHSR    = [...players].sort((a,b) => b.dist20 - a.dist20)
  const bySprintDist = [...players].sort((a,b) => b.dist25 - a.dist25)
  const byMins   = [...players].sort((a,b) => b._mins - a._mins)
  const byDecel  = [...players].sort((a,b) => b.decel - a.decel)

  const relBar = (data, key, color, labelFn) => {
    const max = Math.max(...data.map(r => r[key] || 0), 1)
    return data.map(r => {
      const v = r[key] || 0
      return (
        <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <p style={{ width:150, fontSize:8, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.playerName}
          </p>
          <div style={{ flex:1, height:20, background:'#f3f4f6', borderRadius:4, overflow:'hidden' }}>
            <div style={{ width:`${(v/max)*100}%`, height:'100%', background:color, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5 }}>
              {(v/max) > 0.12 && <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{labelFn ? labelFn(v) : Math.round(v)}</span>}
            </div>
          </div>
          {(v/max) <= 0.12 && <span style={{ fontSize:8, fontWeight:900, color:color }}>{labelFn ? labelFn(v) : Math.round(v)}</span>}
        </div>
      )
    })
  }

  const SectionChart = ({ title, data, color, labelFn }) => (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">{title}</p>
      {relBar(data, data[0] ? Object.keys(data[0]).find(k => typeof data[0][k] === 'number' && !['maxVel','_sessions'].includes(k) && data[0][k] === data[0][k]) : 'totalDistance', color, labelFn)}
    </div>
  )

  const SectionBar = ({ title, data, key, color, labelFn }) => (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">{title}</p>
      {data.map(r => {
        const max = Math.max(...data.map(x => x[key]||0),1)
        const v = r[key]||0
        return (
          <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <p style={{ width:150, fontSize:8, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {r.playerName}
            </p>
            <div style={{ flex:1, height:20, background:'#f3f4f6', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:`${(v/max)*100}%`, height:'100%', background:color, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5 }}>
                {(v/max) > 0.12 && <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{labelFn ? labelFn(v) : Math.round(v)}</span>}
              </div>
            </div>
            {(v/max) <= 0.12 && <span style={{ fontSize:8, fontWeight:900, color:color }}>{labelFn ? labelFn(v) : Math.round(v)}</span>}
          </div>
        )
      })}
    </div>
  )

  const content = (
    <div className="space-y-4">
      {/* KPIs */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:4 }}>
        <KpiCard label="Atletas" value={players.length} unit="jogadores" />
        <KpiCard label="Méd. Distância/Dia/Atleta" value={Math.round(avgDist/Math.max(filtered.length,1))} unit="m" />
        <KpiCard label="Méd. Sprints/Dia/Atleta" value={(avgSprints/Math.max(filtered.length,1)).toFixed(1)} unit="nº" />
        <KpiCard label="Total Sessões" value={filtered.length} unit="sessões" />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">Total Distance — Acumulado (m)</p>
        {byDist.map(r => {
          const max = Math.max(...byDist.map(x => x.totalDistance),1)
          const v = r.totalDistance
          return (
            <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
              <p style={{ width:150, fontSize:8, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.playerName}</p>
              <div style={{ flex:1, height:20, background:'#f3f4f6', borderRadius:4, overflow:'hidden' }}>
                <div style={{ width:`${(v/max)*100}%`, height:'100%', background:'#0B7C3D', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5 }}>
                  {(v/max)>0.1 && <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{Math.round(v)}</span>}
                </div>
              </div>
              {(v/max)<=0.1 && <span style={{ fontSize:8, fontWeight:900, color:'#0B7C3D' }}>{Math.round(v)}</span>}
            </div>
          )
        })}
      </div>

      {[
        { title:'Quantidade de Sprints >25,2 km/h — Acumulado', data:bySprint, key:'sprints', color:'#0a66b7' },
        { title:'Aceleração >3 m/s² — Acumulado', data:byAcc, key:'accel', color:'#f59e0b' },
        { title:'Desaceleração <-3 m/s² — Acumulado', data:byDecel, key:'decel', color:'#64748b' },
        { title:'Distância HSR >20 km/h — Acumulado (m)', data:byHSR, key:'dist20', color:'#0ea5e9' },
        { title:'Distância em Sprint >25 km/h — Acumulado (m)', data:bySprintDist, key:'dist25', color:'#0ea5e9' },
      ].map(cfg => (
        <div key={cfg.title} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">{cfg.title}</p>
          {cfg.data.map(r => {
            const max = Math.max(...cfg.data.map(x => x[cfg.key]||0),1)
            const v = r[cfg.key]||0
            return (
              <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <p style={{ width:150, fontSize:8, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.playerName}</p>
                <div style={{ flex:1, height:20, background:'#f3f4f6', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${(v/max)*100}%`, height:'100%', background:cfg.color, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5 }}>
                    {(v/max)>0.1 && <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{Math.round(v)}</span>}
                  </div>
                </div>
                {(v/max)<=0.1 && <span style={{ fontSize:8, fontWeight:900, color:cfg.color }}>{Math.round(v)}</span>}
              </div>
            )
          })}
        </div>
      ))}

      {/* Minutagem */}
      {avgMins > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">Minutagem — Acumulado (min)</p>
          {byMins.map(r => {
            const max = Math.max(...byMins.map(x => x._mins||0),1)
            const v = r._mins||0
            return (
              <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <p style={{ width:150, fontSize:8, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.playerName}</p>
                <div style={{ flex:1, height:20, background:'#f3f4f6', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${(v/max)*100}%`, height:'100%', background:'#6366f1', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5 }}>
                    {(v/max)>0.1 && <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{Math.round(v)}</span>}
                  </div>
                </div>
                {(v/max)<=0.1 && <span style={{ fontSize:8, fontWeight:900, color:'#6366f1' }}>{Math.round(v)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Velocity table */}
      <VelocidadeTable rows={players} />
    </div>
  )

  return (
    <div className="space-y-5 fade-in dm">
      <style>{`@media print { body>*{visibility:hidden!important} #rel-semanal,#rel-semanal *{visibility:visible!important} #rel-semanal{position:fixed;top:0;left:0;width:100%;font-size:9px;overflow:auto} }`}</style>

      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setRelMode(false)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!relMode?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:bg-white'}`}>📊 Análise</button>
          <button onClick={() => setRelMode(true)}  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${relMode?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:bg-white'}`}>📋 Relatório</button>
        </div>
        {relMode && [
          { k:'horario', ph:'9:30 (BRT)' }, { k:'turno', ph:'Manhã' }, { k:'local', ph:'Local...' }
        ].map(f => (
          <input key={f.k} value={relInfo[f.k]} onChange={e => setRelInfo(p=>({...p,[f.k]:e.target.value}))}
            placeholder={f.ph}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-[9px] bg-gray-50 focus:outline-none focus:border-sky-400 w-40" />
        ))}
        {relMode && (
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase shadow-sm ml-auto"
            style={{ background:'#0B7C3D' }}>
            🖨️ Imprimir
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <span>ℹ️</span>
        <p className="text-[9px] text-blue-700 font-medium">
          Acumulado <strong>individual</strong> — {filtered.length} sessão(ões) no período · {players.length} atletas
        </p>
      </div>

      {relMode ? (
        <div id="rel-semanal">
          <div style={{ background:'#0B7C3D', borderRadius:12, padding:'14px 20px', marginBottom:14, color:'white' }}>
            <p style={{ fontFamily:'Barlow Condensed', fontSize:20, fontWeight:900, margin:0, textTransform:'uppercase' }}>
              Relatório de Carga Semanal — Acumulado
            </p>
            <p style={{ fontSize:10, opacity:0.8, margin:'2px 0 0' }}>
              {dateFrom && dateTo ? `${dateFrom} a ${dateTo}` : dateFrom || dateTo} · {filtered.length} sessões · Departamento de Fisiologia
            </p>
          </div>
          {content}
        </div>
      ) : content}
    </div>
  )
}


// ─── ÍNDICE DE DESTAQUE POSICIONAL — LÓGICA COMPARTILHADA ───────────────────
// A mesma metodologia é usada nas abas Destaques e Por Posição.
const POSITION_INDEX_METRICS = [
  { key:'totalDistance', label:'Distância Total', unit:'m',     weight:0.25, fmt: v => v >= 1000 ? `${(v/1000).toFixed(2)} km` : `${Math.round(v)} m`, color:'#0B7C3D' },
  { key:'hsr20to25',     label:'HSR 20–25 km/h',  unit:'m',     weight:0.20, getValue: r => Math.max(0, num(r.dist20) - num(r.dist25)), fmt: v => `${Math.round(v)} m`, color:'#0a66b7' },
  { key:'dist25',        label:'Sprint >25 km/h', unit:'m',     weight:0.15, fmt: v => `${Math.round(v)} m`, color:'#0ea5e9' },
  { key:'sprints',       label:'Nº Sprints',      unit:'',      weight:0.05, fmt: v => Math.round(v), color:'#a855f7' },
  { key:'accel',         label:'Acelerações',     unit:'',      weight:0.15, fmt: v => Math.round(v), color:'#f59e0b' },
  { key:'decel',         label:'Desacelerações',  unit:'',      weight:0.15, fmt: v => Math.round(v), color:'#64748b' },
  { key:'maxVel',        label:'Vel. Máxima',     unit:'km/h',  weight:0.05, fmt: v => `${v.toFixed(1)} km/h`, color:'#f97316' },
]

const positionMetricValue = (metric, row) => metric.getValue ? metric.getValue(row) : num(row[metric.key])

const positionMetricHasVariation = (arr, metric) => {
  const vals = arr.map(r => positionMetricValue(metric, r)).filter(Number.isFinite)
  return vals.length > 1 && Math.min(...vals) !== Math.max(...vals)
}

// Percentil dentro da posição, incluindo zeros e usando posto médio nos empates.
const positionPercentile = (val, arr, metric) => {
  const vals = arr.map(r => positionMetricValue(metric, r)).filter(Number.isFinite)
  if (!positionMetricHasVariation(arr, metric)) return 50

  const value = Number(val)
  const below = vals.filter(v => v < value).length
  const equal = vals.filter(v => v === value).length
  const averageRank = below + Math.max(0, equal - 1) / 2
  return Math.round((averageRank / (vals.length - 1)) * 100)
}

// Score interno: média ponderada dos percentis ativos dentro da posição.
// Métricas sem variação são retiradas e seus pesos são redistribuídos.
const positionInternalScore = (row, positionGroup) => {
  const activeMetrics = POSITION_INDEX_METRICS.filter(metric => positionMetricHasVariation(positionGroup, metric))
  if (!activeMetrics.length) return 50

  const totalWeight = activeMetrics.reduce((sum, metric) => sum + metric.weight, 0)
  return activeMetrics.reduce((sum, metric) => {
    const value = positionMetricValue(metric, row)
    return sum + positionPercentile(value, positionGroup, metric) * metric.weight
  }, 0) / totalWeight
}

// Escala amigável para exibição aos atletas, preservando o ranking interno.
const positionDisplayScore = value => Math.round(60 + Math.min(100, Math.max(0, value)) * 0.40)

const positionHighlightBand = value => {
  if (value >= 90) return { label:'Grande destaque', color:'#0a66b7', background:'#f0fdf4' }
  if (value >= 80) return { label:'Acima da média', color:'#0B7C3D', background:'#f0fdf4' }
  if (value >= 70) return { label:'Boa participação', color:'#ca8a04', background:'#fffbeb' }
  return { label:'Menor destaque', color:'#64748b', background:'#f8fafc' }
}

// ─── ABA DESTAQUES ────────────────────────────────────────────────────────────
function TabDestaques({ session, sessionGoals }) {
  const { getPhotoUrl, setPhoto } = usePlayerPhotos()
  const [photoModal, setPhotoModal] = useState(null)
  const [selectedBlocos, setSelectedBlocos] = useState([])
  const [isExportingPng, setIsExportingPng] = useState(false)
  const exportPngRef = useRef(null)

  // Zera a seleção de blocos ao trocar de sessão
  useEffect(() => { setSelectedBlocos([]) }, [session?.id])

  const blocosDisponiveis = getSessionBlocos(session)
  const rows = getRowsForBlocos(session, selectedBlocos)

  if (!rows.length) return <EmptyState icon="🏆" text="Selecione uma sessão" />

  // Goleiros são excluídos dos destaques de campo — eles terão aba própria
  const isGK = r => {
    const pos = (r.positionName || '').toLowerCase()
    return pos.includes('golei') || pos.includes('goal') || pos === 'gk'
  }

  const fieldRows = rows.filter(r => !isGK(r))

  // Cada atleta recebe o mesmo Índice de Destaque da aba Por Posição:
  // o score é calculado somente contra os companheiros da própria posição.
  const positionGroups = fieldRows.reduce((groups, row) => {
    const position = normPos(row.positionName)
    if (!groups[position]) groups[position] = []
    groups[position].push(row)
    return groups
  }, {})

  const scoredRows = fieldRows.map(row => {
    const position = normPos(row.positionName)
    const positionGroup = positionGroups[position] || [row]
    const scoreValue = positionInternalScore(row, positionGroup)
    return {
      row,
      scoreValue,
      displayIndex: positionDisplayScore(scoreValue),
      band: positionHighlightBand(positionDisplayScore(scoreValue)),
    }
  })

  const sorted = [...scoredRows].sort((a, b) => {
    const diff = b.scoreValue - a.scoreValue
    return Math.abs(diff) > 0.0001
      ? diff
      : (a.row.playerName || '').localeCompare(b.row.playerName || '')
  })

  const top4 = sorted.slice(0, 4)
  const bot4 = sorted.slice(-4).sort((a, b) => {
    const diff = a.scoreValue - b.scoreValue
    return Math.abs(diff) > 0.0001
      ? diff
      : (a.row.playerName || '').localeCompare(b.row.playerName || '')
  })

  const exportFilePart = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  const waitForExportAssets = async node => {
    if (document.fonts?.ready) await document.fonts.ready
    const images = Array.from(node.querySelectorAll('img'))
    await Promise.all(images.map(img => {
      if (img.complete) return img.decode?.().catch(() => {}) || Promise.resolve()
      return new Promise(resolve => {
        const done = () => resolve()
        img.addEventListener('load', done, { once:true })
        img.addEventListener('error', done, { once:true })
      })
    }))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }

  const exportDestaquesPng = async () => {
    const node = exportPngRef.current
    if (!node || isExportingPng) return

    setIsExportingPng(true)
    try {
      await waitForExportAssets(node)
      const { toPng } = await import('html-to-image')
      const bounds = node.getBoundingClientRect()
      const exportWidth = Math.ceil(bounds.width)
      const exportHeight = Math.ceil(node.scrollHeight)
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        width: exportWidth,
        height: exportHeight,
        backgroundColor: '#f9fafb',
        filter: element => element?.getAttribute?.('data-export-ignore') !== 'true',
        style: {
          margin: '0',
          borderRadius: '0',
        },
      })

      const sessionPart = exportFilePart(session?.titulo || 'sessao')
      const datePart = exportFilePart(session?.data_sessao || new Date().toISOString().slice(0, 10))
      const link = document.createElement('a')
      link.download = `destaques-${sessionPart}-${datePart}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Erro ao exportar Destaques em PNG:', error)
      window.alert('Não foi possível exportar a página em PNG. Tente novamente após as fotos terminarem de carregar.')
    } finally {
      setIsExportingPng(false)
    }
  }

  const PlayerCard = ({ item, rank, isTop }) => {
    const { row: player, displayIndex, band } = item
    const photo = getPhotoUrl(player.playerName)
    const accentColor  = isTop ? G.verde : '#dc2626'
    const accentLight  = isTop ? '#f0fdf4' : '#fef2f2'
    const accentBorder = isTop ? '#bbf7d0' : '#fecaca'

    return (
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col"
        style={{ border: `2px solid ${accentBorder}` }}>

        {/* Foto — 220px, topo visível = rosto do atleta */}
        <div className="relative flex-shrink-0" style={{ height: 220, background: accentLight }}>
          {photo ? (
            <img
              src={photo}
              alt={player.playerName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', imageRendering: '-webkit-optimize-contrast' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <span className="bc text-7xl font-black leading-none" style={{ color: accentColor, opacity: 0.18 }}>
                {player.playerName.charAt(0)}
              </span>
              <p className="text-[9px] text-gray-400 font-bold">Sem foto</p>
            </div>
          )}

          {/* Badge rank — canto sup. esq. */}
          <div className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
            style={{ background: accentColor }}>
            <span className="bc text-white font-black text-sm leading-none">{rank}</span>
          </div>

          {/* Botão câmera — canto sup. dir. */}
          <button
            data-export-ignore="true"
            onClick={() => setPhotoModal(player.playerName)}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)' }}
            title={photo ? 'Trocar foto' : 'Adicionar foto'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          {/* Gradiente inferior + nome */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, transparent 100%)' }}>
            <span className="inline-block text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1"
              style={{ background: accentColor, color: '#fff' }}>
              {isTop ? '🏆' : '📉'} #{rank}
            </span>
            <p className="bc text-base font-black uppercase text-white leading-tight drop-shadow">
              {player.playerName}
            </p>
            <p className="text-[8px] text-white/70 mt-0.5">{player.positionName || '—'}</p>
          </div>
        </div>

        {/* Índice + principais métricas */}
        <div className="p-3">
          <div className="rounded-xl px-3 py-2 mb-1.5 flex items-center justify-between gap-3" style={{ background: band.background }}>
            <div>
              <p className="text-[6px] font-black uppercase tracking-widest text-gray-400">Índice de Destaque</p>
              <p className="text-[7px] font-bold" style={{ color: band.color }}>{band.label}</p>
            </div>
            <p className="bc text-2xl font-black leading-none" style={{ color: band.color }}>{displayIndex}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { l: 'Distância',  v: fmt(num(player.totalDistance), 'm'), c: G.verde },
              { l: 'Vel. Máx.',  v: `${num(player.maxVel).toFixed(1)} km/h`, c: '#f97316' },
              { l: 'HSR 20–25', v: fmt(Math.max(0, num(player.dist20) - num(player.dist25)), 'm'), c: '#0ea5e9' },
              { l: 'Sprints',    v: String(Math.round(num(player.sprints))), c: '#a855f7' },
            ].map(stat => (
              <div key={stat.l} className="rounded-xl px-2.5 py-2" style={{ background: accentLight }}>
                <p className="text-[6px] font-black uppercase tracking-widest text-gray-400">{stat.l}</p>
                <p className="bc text-sm font-black leading-tight" style={{ color: stat.c }}>{stat.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3" data-export-ignore="true">
        <div className="flex-1 min-w-[260px]">
          <BlocoFilter blocos={blocosDisponiveis} selected={selectedBlocos} onChange={setSelectedBlocos} />
        </div>
        <button
          onClick={exportDestaquesPng}
          disabled={isExportingPng}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest shadow-sm transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
          style={{ background: G.verde }}>
          {isExportingPng ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Gerando PNG...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M4 4h16v16H4z"/><path d="M8 14l2.5-3 2 2 2.5-3 3 4"/><circle cx="9" cy="8" r="1.2"/><path d="M12 2v4M10 4h4"/>
              </svg>
              Exportar PNG
            </>
          )}
        </button>
      </div>

      <div ref={exportPngRef} className="space-y-6" style={{ background:'#f9fafb' }}>
        {/* Cabeçalho exclusivo da imagem exportada */}
        <div style={{ display: isExportingPng ? 'block' : 'none' }} className="bg-white border border-sky-200 rounded-2xl px-5 py-4">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.35em] text-sky-700 mb-1">Confiança · GPS · Fisiologia</p>
              <p className="bc text-2xl font-black uppercase text-gray-900 leading-none">Destaques da Sessão</p>
              <p className="text-[10px] font-bold text-gray-500 mt-1">{session?.titulo || 'Sessão selecionada'}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-sky-700">{session?.data_sessao ? new Date(`${session.data_sessao}T12:00:00`).toLocaleDateString('pt-BR') : ''}</p>
              <p className="text-[8px] text-gray-400 mt-1">Índice de Destaque relativo à posição</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-[8px] text-gray-500">
            <strong>Blocos:</strong> {selectedBlocos.length ? selectedBlocos.join(' · ') : 'Sessão completa'}
          </div>
        </div>

        {/* dica câmera */}
        <div data-export-ignore="true" className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <p className="text-[9px] text-gray-400">Ranking pelo mesmo Índice de Destaque da aba Por Posição: cada atleta é comparado somente com os jogadores da própria posição. Clique na câmera para trocar a foto.</p>
      </div>

      {/* Top 4 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: G.verde }} />
          <p className="bc text-base font-black uppercase text-gray-900">🏆 Top 4 — Melhores da Sessão</p>
          <p className="text-[8px] text-gray-400 ml-1">(Índice de Destaque relativo à posição)</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={isExportingPng ? { gridTemplateColumns:'repeat(4, minmax(0, 1fr))' } : undefined}>
          {top4.map((item, i) => <PlayerCard key={item.row.playerName} item={item} rank={i + 1} isTop={true} />)}
        </div>
      </div>

      {/* Atenção 4 */}
      {bot4.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <p className="bc text-base font-black uppercase text-gray-900">📉 Pontos de Atenção</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={isExportingPng ? { gridTemplateColumns:'repeat(4, minmax(0, 1fr))' } : undefined}>
            {bot4.map((item, i) => <PlayerCard key={item.row.playerName} item={item} rank={i + 1} isTop={false} />)}
          </div>
        </div>
      )}
      </div>

      {/* Tabela do Índice de Destaque — fica fora da área exportada */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Índice de Destaque da Sessão — comparação dentro de cada posição</p>
        </div>
        <div className="overflow-x-auto scrollbar-g">
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: G.verde }}>
                {['#', 'Atleta', 'Posição', 'Índice', 'Distância', 'HSR 20–25', 'Sprint', 'Acel.', 'Vel. Máx'].map(h => (
                  <th key={h} className={`px-3 py-3 text-[8px] font-black uppercase tracking-widest text-white ${['Atleta','Posição','#'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => {
                const row = item.row
                return (
                  <tr key={row.playerName || i} className={`border-b border-gray-50 row-hover ${i < 4 ? 'bg-sky-50/30' : i >= sorted.length - 4 ? 'bg-red-50/20' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2.5 font-bold text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">{row.playerName}</td>
                    <td className="px-3 py-2.5 text-gray-500">{row.positionName || '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-black" style={{ color: item.band.color }}>{item.displayIndex}</span>
                      <span className="block text-[6px] font-bold" style={{ color: item.band.color }}>{item.band.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(num(row.totalDistance), 'm')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(Math.max(0, num(row.dist20) - num(row.dist25)), 'm')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(num(row.dist25), 'm')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{row.accel}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{num(row.maxVel).toFixed(1)} km/h</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal seleção de foto */}
      {photoModal && (
        <PhotoSelectorModal
          isOpen={true}
          playerName={photoModal}
          currentPhoto={getPhotoUrl(photoModal)}
          onPhotoSelect={filename => { setPhoto(photoModal, filename); setPhotoModal(null) }}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </div>
  )
}

// ─── ABA PERFIL DO ATLETA ─────────────────────────────────────────────────────
function TabPerfil({ sessions, dateFrom, dateTo }) {
  const [scope, setScope] = useState('season') // 'season' | 'session'
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const { getPhotoUrl } = usePlayerPhotos()

  const RADAR_METRICS = [
    { key: 'totalDistance', label: 'Distância', unit: 'm',    max: 12000 },
    { key: 'dist20',        label: 'HSR >20',   unit: 'm',    max: 2000  },
    { key: 'dist25',        label: 'Sprint',    unit: 'm',    max: 800   },
    { key: 'sprints',       label: 'Sprints',   unit: '',     max: 20    },
    { key: 'accel',         label: 'Acel.',     unit: '',     max: 40    },
    { key: 'decel',         label: 'Desac.',    unit: '',     max: 40    },
    { key: 'maxVel',        label: 'Vel. Máx',  unit: 'km/h', max: 35    },
  ]

  const isGK = r => {
    const p = (r.positionName || r.posName || '').toLowerCase()
    return p.includes('golei') || p.includes('goal') || p === 'gk'
  }

  // sessões filtráveis (sem tipo goleiros)
  const fieldSessions = sessions.filter(s => s.tipo_sessao !== 'Goleiros')

  // linhas para o escopo escolhido
  const scopeRows = useMemo(() => {
    if (scope === 'session' && selectedSession) {
      const s = fieldSessions.find(s => s.id === selectedSession)
      if (!s) return []
      const arr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
      return arr.filter(r => !isGK(r))
    }
    // temporada = aplica filtro de datas
    const rows = []
    fieldSessions.forEach(s => {
      if (!s.data_sessao) return
      if (dateFrom && s.data_sessao < dateFrom) return
      if (dateTo   && s.data_sessao > dateTo)   return
      const arr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
      arr.filter(r => !isGK(r)).forEach(r => rows.push(r))
    })
    return rows
  }, [scope, selectedSession, sessions, dateFrom, dateTo])

  // acumula por atleta
  const playerMap = useMemo(() => {
    const map = {}
    scopeRows.forEach(r => {
      const name = r.playerName || ''
      if (!name) return
      if (!map[name]) map[name] = { name, pos: r.positionName || '', sessions: 0, ...Object.fromEntries(RADAR_METRICS.map(m => [m.key, 0])) }
      RADAR_METRICS.forEach(m => { map[name][m.key] += num(r[m.key]) })
      map[name].sessions++
    })
    // média por sessão se temporada
    if (scope === 'season') {
      Object.values(map).forEach(p => {
        RADAR_METRICS.forEach(m => { p[m.key] = p.sessions > 0 ? p[m.key] / p.sessions : 0 })
      })
    }
    return map
  }, [scopeRows, scope])

  const players = Object.values(playerMap).sort((a, b) => a.name.localeCompare(b.name))

  // médias do grupo e por posição
  const groupAvg = useMemo(() => {
    if (!players.length) return {}
    return Object.fromEntries(RADAR_METRICS.map(m => [m.key, players.reduce((s, p) => s + p[m.key], 0) / players.length]))
  }, [players])

  const posPlayers = selectedPlayer ? players.filter(p => p.pos === playerMap[selectedPlayer]?.pos) : []
  const posAvg = useMemo(() => {
    if (!posPlayers.length) return {}
    return Object.fromEntries(RADAR_METRICS.map(m => [m.key, posPlayers.reduce((s, p) => s + p[m.key], 0) / posPlayers.length]))
  }, [posPlayers])

  // normaliza valor 0-100 baseado no max da métrica
  const norm = (val, max) => Math.min(100, Math.round((val / max) * 100))

  const buildRadarData = (playerData, compareData, compareLabel) =>
    RADAR_METRICS.map(m => ({
      metric: m.label,
      Atleta:   norm(playerData[m.key] || 0, m.max),
      [compareLabel]: norm(compareData[m.key] || 0, m.max),
      fullVal:  playerData[m.key] || 0,
      unit: m.unit,
    }))

  const player = selectedPlayer ? playerMap[selectedPlayer] : null
  const photo  = selectedPlayer ? getPhotoUrl(selectedPlayer) : null

  const fmtV = (v, unit) => {
    if (unit === 'm' && v >= 1000) return `${(v/1000).toFixed(2)} km`
    if (unit === 'km/h') return `${v.toFixed(1)} km/h`
    return v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1)
  }

  return (
    <div className="space-y-5 fade-in">

      {/* Controles */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end">

        {/* Escopo */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Escopo</p>
          <div className="flex gap-1.5">
            {[['season','🗓️ Temporada'],['session','⚽ Sessão']].map(([val, label]) => (
              <button key={val} onClick={() => { setScope(val); setSelectedSession(null) }}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                  ${scope === val ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={scope === val ? { background: G.verde } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de sessão */}
        {scope === 'session' && (
          <div className="flex-1 min-w-48">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Sessão</p>
            <select value={selectedSession || ''} onChange={e => setSelectedSession(e.target.value || null)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] font-semibold text-gray-700 focus:outline-none focus:border-sky-400 bg-gray-50">
              <option value="">Selecione uma sessão…</option>
              {fieldSessions.map(s => (
                <option key={s.id} value={s.id}>{s.titulo} — {s.data_sessao || '?'}</option>
              ))}
            </select>
          </div>
        )}

        {/* Info período */}
        {scope === 'season' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-100 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 flex-shrink-0" />
            <p className="text-[9px] text-sky-700 font-medium">Média por sessão · período selecionado</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* Lista de atletas */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">
              {players.length} atleta{players.length !== 1 ? 's' : ''} de campo
            </p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
            {players.length === 0 ? (
              <p className="text-[9px] text-gray-400 text-center p-8">Nenhum dado no período</p>
            ) : players.map(p => {
              const active = selectedPlayer === p.name
              return (
                <button key={p.name} onClick={() => setSelectedPlayer(p.name)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-all
                    ${active ? 'bg-sky-50 border-l-4' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                  style={active ? { borderLeftColor: G.verde } : {}}>
                  {/* mini avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                    {getPhotoUrl(p.name)
                      ? <img src={getPhotoUrl(p.name)} alt={p.name} className="w-full h-full object-cover object-top" />
                      : <span className="text-[9px] font-black text-gray-400">{p.name.charAt(0)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[9px] font-black truncate ${active ? 'text-sky-700' : 'text-gray-800'}`}>{p.name}</p>
                    <p className="text-[7px] text-gray-400 truncate">{p.pos || '—'}</p>
                  </div>
                  {active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: G.verde }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Painel principal */}
        <div className="lg:col-span-3 space-y-4">
          {!player ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-2">👤</p>
              <p className="bc text-xl font-black uppercase text-gray-300">Selecione um atleta</p>
              <p className="text-[10px] text-gray-300 mt-1">Clique no nome à esquerda para ver o perfil</p>
            </div>
          ) : (
            <>
              {/* Header do atleta */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm" style={{ background: '#f0fdf4' }}>
                    {photo
                      ? <img src={photo} alt={player.name} className="w-full h-full object-cover object-top" style={{ imageRendering: '-webkit-optimize-contrast' }} />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="bc text-2xl font-black" style={{ color: G.verde, opacity: 0.3 }}>{player.name.charAt(0)}</span>
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="bc text-2xl font-black uppercase text-gray-900 leading-none">{player.name}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{player.pos || '—'} · {scope === 'season' ? 'Média/sessão · temporada' : 'Sessão única'}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {RADAR_METRICS.map(m => (
                        <span key={m.key} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700">
                          {m.label}: {fmtV(player[m.key], m.unit)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Radares */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Radar 1 — vs Grupo */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">vs Média do Grupo</p>
                  <p className="text-[8px] text-gray-400 mb-4">{players.length} atletas de campo</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={buildRadarData(player, groupAvg, 'Grupo')} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fontWeight: 700, fill: '#4b5563' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Grupo" dataKey="Grupo" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 2" />
                      <Radar name={player.name} dataKey="Atleta" stroke={G.verde} fill={G.verde} fillOpacity={0.25} strokeWidth={2.5} />
                      <Tooltip
                        contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(v, name) => [`${v}/100`, name]} />
                      <Legend wrapperStyle={{ fontSize: 9, paddingTop: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Radar 2 — vs Posição */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">vs Média da Posição</p>
                  <p className="text-[8px] text-gray-400 mb-4">{posPlayers.length} {player.pos || 'posição'}</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={buildRadarData(player, posAvg, 'Posição')} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fontWeight: 700, fill: '#4b5563' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name={`Posição (${player.pos || '—'})`} dataKey="Posição" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 2" />
                      <Radar name={player.name} dataKey="Atleta" stroke={G.verde} fill={G.verde} fillOpacity={0.25} strokeWidth={2.5} />
                      <Tooltip
                        contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(v, name) => [`${v}/100`, name]} />
                      <Legend wrapperStyle={{ fontSize: 9, paddingTop: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabela de comparação detalhada */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Valores Detalhados vs Referências</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr style={{ background: G.verde }}>
                        {['Métrica', 'Atleta', 'Média Grupo', 'Δ Grupo', 'Média Posição', 'Δ Posição'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-[8px] font-black uppercase tracking-widest text-white text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RADAR_METRICS.map((m, i) => {
                        const val   = player[m.key] || 0
                        const gAvg  = groupAvg[m.key] || 0
                        const pAvg  = posAvg[m.key]   || 0
                        const dG    = val - gAvg
                        const dP    = val - pAvg
                        return (
                          <tr key={m.key} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                            <td className="px-3 py-2.5 font-black text-gray-700">{m.label}</td>
                            <td className="px-3 py-2.5 font-black" style={{ color: G.verde }}>{fmtV(val, m.unit)}</td>
                            <td className="px-3 py-2.5 text-gray-500">{fmtV(gAvg, m.unit)}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: dG >= 0 ? G.verde : '#dc2626' }}>
                              {dG >= 0 ? '+' : ''}{fmtV(dG, m.unit)}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">{fmtV(pAvg, m.unit)}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: dP >= 0 ? G.verde : '#dc2626' }}>
                              {dP >= 0 ? '+' : ''}{fmtV(dP, m.unit)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ABA JOGO VS TREINO ───────────────────────────────────────────────────────
function TabJogoVsTreino({ sessions }) {
  const [selectedWeek, setSelectedWeek]   = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const { getPhotoUrl } = usePlayerPhotos()

  const METRICS = [
    { key: 'totalDistance', label: 'Distância Total', unit: 'm',    color: '#0B7C3D', icon: '📏' },
    { key: 'dist20',        label: 'HSR > 20 km/h',  unit: 'm',    color: '#0a66b7', icon: '⚡' },
    { key: 'dist25',        label: 'Sprint > 25',    unit: 'm',    color: '#0ea5e9', icon: '🚀' },
    { key: 'sprints',       label: 'Nº Sprints',     unit: '',     color: '#a855f7', icon: '🔁' },
    { key: 'accel',         label: 'Acelerações',    unit: '',     color: '#f59e0b', icon: '📈' },
    { key: 'maxVel',        label: 'Vel. Máxima',    unit: 'km/h', color: '#f97316', icon: '🏎️' },
  ]

  const isGK = r => {
    const p = (r.positionName || '').toLowerCase()
    return p.includes('golei') || p.includes('goal') || p === 'gk'
  }

  // Agrupa sessões por semana ISO
  const getWeek = dateStr => {
    if (!dateStr) return null
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDay() || 7
    d.setDate(d.getDate() + 4 - day)
    const yearStart = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    return `${d.getFullYear()}-S${String(week).padStart(2, '0')}`
  }

  const weekMap = useMemo(() => {
    const map = {}
    sessions.filter(s => s.tipo_sessao !== 'Goleiros' && s.data_sessao).forEach(s => {
      const wk = getWeek(s.data_sessao)
      if (!wk) return
      if (!map[wk]) map[wk] = { week: wk, jogos: [], treinos: [], dates: [] }
      map[wk].dates.push(s.data_sessao)
      if (s.tipo_sessao === 'Jogo') map[wk].jogos.push(s)
      else map[wk].treinos.push(s)
    })
    return map
  }, [sessions])

  const weeks = Object.keys(weekMap).sort().reverse()

  // Init: primeira semana com jogo
  useEffect(() => {
    const firstWithGame = weeks.find(w => weekMap[w].jogos.length > 0)
    if (firstWithGame && !selectedWeek) setSelectedWeek(firstWithGame)
    else if (weeks.length > 0 && !selectedWeek) setSelectedWeek(weeks[0])
  }, [weeks])

  const currentWeek = selectedWeek ? weekMap[selectedWeek] : null

  // Extrai métricas por atleta de um conjunto de sessões (soma)
  const extractMetrics = (sessionList) => {
    const map = {}
    sessionList.forEach(s => {
      const arr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
      arr.filter(r => !isGK(r) && r.playerName).forEach(r => {
        if (!map[r.playerName]) map[r.playerName] = { name: r.playerName, pos: r.positionName || '', sessions: 0, ...Object.fromEntries(METRICS.map(m => [m.key, 0])) }
        METRICS.forEach(m => { map[r.playerName][m.key] += num(r[m.key]) })
        map[r.playerName].sessions++
      })
    })
    return map
  }

  const jogoData  = currentWeek ? extractMetrics(currentWeek.jogos)   : {}
  const treinoData = currentWeek ? extractMetrics(currentWeek.treinos) : {}

  // União de atletas presentes na semana
  const weekPlayers = [...new Set([...Object.keys(jogoData), ...Object.keys(treinoData)])].sort()

  // Init player
  useEffect(() => {
    if (weekPlayers.length > 0 && (!selectedPlayer || !weekPlayers.includes(selectedPlayer))) {
      setSelectedPlayer(weekPlayers[0])
    }
  }, [weekPlayers])

  const fmtV = (v, unit) => {
    if (!v && v !== 0) return '—'
    if (unit === 'm' && v >= 1000) return `${(v/1000).toFixed(2)} km`
    if (unit === 'km/h') return `${Number(v).toFixed(1)} km/h`
    return Number(v) % 1 === 0 ? String(Math.round(v)) : Number(v).toFixed(1)
  }

  const pct = (t, j) => (j > 0 ? Math.round((t / j) * 100) : null)
  const pctColor = p => p === null ? '#9ca3af' : p >= 90 ? '#0B7C3D' : p >= 70 ? '#0a66b7' : p >= 50 ? '#f59e0b' : '#dc2626'
  const pctBg    = p => p === null ? 'bg-gray-50 border-gray-200' : p >= 90 ? 'bg-sky-50 border-sky-300' : p >= 70 ? 'bg-sky-50 border-sky-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  // Dados para o radar de comparação do atleta selecionado
  const radarData = METRICS.map(m => {
    const jVal = jogoData[selectedPlayer]?.[m.key] || 0
    const tVal = treinoData[selectedPlayer]?.[m.key] || 0
    const maxRef = Math.max(jVal, tVal, 1)
    return {
      metric: m.label,
      Jogo:   jVal > 0 ? Math.round((jVal / maxRef) * 100) : 0,
      Treino: tVal > 0 ? Math.round((tVal / maxRef) * 100) : 0,
    }
  })

  // Dados para gráfico de barras agrupadas — grupo inteiro
  const groupBarData = METRICS.map(m => {
    const jVals = weekPlayers.map(p => jogoData[p]?.[m.key] || 0).filter(v => v > 0)
    const tVals = weekPlayers.map(p => treinoData[p]?.[m.key] || 0).filter(v => v > 0)
    return {
      label: m.label,
      Jogo:   jVals.length ? jVals.reduce((a,b)=>a+b,0)/jVals.length : 0,
      Treino: tVals.length ? tVals.reduce((a,b)=>a+b,0)/tVals.length : 0,
      icon: m.icon,
      unit: m.unit,
    }
  })

  const weekLabel = wk => {
    const parts = wk.split('-S')
    return `Sem. ${parts[1]} / ${parts[0]}`
  }

  return (
    <div className="space-y-5 fade-in">

      {/* Controles */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Semana</p>
          <select value={selectedWeek || ''} onChange={e => setSelectedWeek(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] font-semibold text-gray-700 focus:outline-none focus:border-sky-400 bg-gray-50 min-w-40">
            {weeks.map(w => (
              <option key={w} value={w}>
                {weekLabel(w)} {weekMap[w].jogos.length > 0 ? '⚽' : ''} ({weekMap[w].treinos.length}T · {weekMap[w].jogos.length}J)
              </option>
            ))}
          </select>
        </div>
        {currentWeek && (
          <div className="flex gap-2">
            <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <p className="text-[7px] font-black uppercase tracking-widest text-blue-500">Jogos</p>
              <p className="bc text-lg font-black text-blue-700 leading-none">{currentWeek.jogos.length}</p>
            </div>
            <div className="px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-xl text-center">
              <p className="text-[7px] font-black uppercase tracking-widest text-sky-600">Treinos</p>
              <p className="bc text-lg font-black text-sky-700 leading-none">{currentWeek.treinos.length}</p>
            </div>
            <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-center">
              <p className="text-[7px] font-black uppercase tracking-widest text-gray-500">Atletas</p>
              <p className="bc text-lg font-black text-gray-700 leading-none">{weekPlayers.length}</p>
            </div>
          </div>
        )}
        {currentWeek?.jogos.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
            <span>⚠️</span>
            <p className="text-[9px] text-amber-700 font-medium">Semana sem jogo — mostrando só treinos</p>
          </div>
        )}
      </div>

      {!currentWeek ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-2">⚽</p>
          <p className="bc text-xl font-black uppercase text-gray-300">Selecione uma semana</p>
        </div>
      ) : (
        <>
          {/* Visão grupo — barras comparativas */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4">
              📊 Média do Grupo — Jogo vs Treino (acumulado da semana)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={groupBarData} margin={{ top: 6, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 8, fontWeight: 700, fill: '#4b5563' }} />
                <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v, name, props) => [fmtV(v, props.payload.unit), name]} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="Jogo"   fill="#0ea5e9" radius={[4,4,0,0]} maxBarSize={40} />
                <Bar dataKey="Treino" fill="#0B7C3D" radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de % por atleta */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Lista atletas */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Atleta</p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 460 }}>
                {weekPlayers.map(name => {
                  const active = selectedPlayer === name
                  const jDist = jogoData[name]?.totalDistance || 0
                  const tDist = treinoData[name]?.totalDistance || 0
                  const p = pct(tDist, jDist)
                  return (
                    <button key={name} onClick={() => setSelectedPlayer(name)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-50 transition-all
                        ${active ? 'bg-sky-50 border-l-4' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                      style={active ? { borderLeftColor: G.verde } : {}}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[9px] font-black truncate ${active ? 'text-sky-700' : 'text-gray-800'}`}>{name}</p>
                        {p !== null && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: pctColor(p) }} />
                            </div>
                            <span className="text-[7px] font-black flex-shrink-0" style={{ color: pctColor(p) }}>{p}%</span>
                          </div>
                        )}
                        {p === null && <p className="text-[7px] text-gray-300">Sem jogo na semana</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Painel detalhe atleta selecionado */}
            <div className="lg:col-span-4 space-y-4">
              {selectedPlayer && (
                <>
                  {/* Header */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#f0fdf4' }}>
                      {getPhotoUrl(selectedPlayer)
                        ? <img src={getPhotoUrl(selectedPlayer)} alt={selectedPlayer} className="w-full h-full object-cover object-top" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <span className="bc text-xl font-black" style={{ color: G.verde, opacity: 0.3 }}>{selectedPlayer.charAt(0)}</span>
                          </div>}
                    </div>
                    <div>
                      <p className="bc text-xl font-black uppercase text-gray-900 leading-none">{selectedPlayer}</p>
                      <p className="text-[8px] text-gray-400 mt-0.5">
                        {jogoData[selectedPlayer]?.pos || treinoData[selectedPlayer]?.pos || '—'} ·{' '}
                        {currentWeek.jogos.length} jogo(s) · {currentWeek.treinos.length} treino(s) na semana
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Cards % por métrica */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-3">% Reprodução (Treino ÷ Jogo)</p>
                      <div className="space-y-2">
                        {METRICS.map(m => {
                          const jVal = jogoData[selectedPlayer]?.[m.key] || 0
                          const tVal = treinoData[selectedPlayer]?.[m.key] || 0
                          const p   = pct(tVal, jVal)
                          return (
                            <div key={m.key} className={`rounded-xl border p-2.5 ${pctBg(p)}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm">{m.icon}</span>
                                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">{m.label}</p>
                                </div>
                                <span className="bc text-base font-black" style={{ color: pctColor(p) }}>
                                  {p !== null ? `${p}%` : '—'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[8px]">
                                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">⚽ {fmtV(jVal, m.unit)}</span>
                                <span className="text-gray-300">→</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold">🏃 {fmtV(tVal, m.unit)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Radar jogo vs treino */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Radar Comparativo</p>
                      <p className="text-[7px] text-gray-400 mb-3">Normalizado pelo valor máximo da semana</p>
                      <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                          <PolarGrid stroke="#e5e7eb" />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fontWeight: 700, fill: '#4b5563' }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Jogo"   dataKey="Jogo"   stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} strokeWidth={2} />
                          <Radar name="Treino" dataKey="Treino" stroke={G.verde}  fill={G.verde}  fillOpacity={0.2} strokeWidth={2} />
                          <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v, n) => [`${v}/100`, n]} />
                          <Legend wrapperStyle={{ fontSize: 9, paddingTop: 8 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── CONSTANTES DE POSIÇÃO ────────────────────────────────────────────────────
const POSICOES = ['Atacante', 'Extremo', 'Lateral', 'Meio Campo', 'Volante', 'Zagueiro']

const normPos = str => {
  const p = (str || '').toLowerCase()
  if (p.includes('atacante') || p.includes('forward') || p.includes('st') || p.includes('cf')) return 'Atacante'
  if (p.includes('extremo') || p.includes('ponta') || p.includes('winger') || p.includes('rw') || p.includes('lw')) return 'Extremo'
  if (p.includes('lateral') || p.includes('fullback') || p.includes('rb') || p.includes('lb')) return 'Lateral'
  if (p.includes('volante') || p.includes('cdm') || p.includes('dmf') || p.includes('vol')) return 'Volante'
  if (p.includes('meia') || p.includes('meio') || p.includes('cam') || p.includes('mid')) return 'Meio Campo'
  if (p.includes('zagueiro') || p.includes('cb') || p.includes('center') || p.includes('zag')) return 'Zagueiro'
  return 'Outros'
}

// ─── ABA MÉDIA DO GRUPO ───────────────────────────────────────────────────────
function TabMediaGrupo({ sessions }) {
  const METS_POS = [
    { key:'totalDistance', label:'Distância Total Semana',    unit:'km',  color:'#0B7C3D', refKey:'ref_dist',   fmt: v => (v/1000).toFixed(2) },
    { key:'dist20',        label:'Distância Alta Intensidade Semana', unit:'m', color:'#0ea5e9', refKey:'ref_hsr', fmt: v => Math.round(v) },
    { key:'dist25',        label:'Distância em Sprint Semana',unit:'m',  color:'#0ea5e9', refKey:'ref_sprint',  fmt: v => Math.round(v) },
    { key:'accel',         label:'Aceleração Semana',         unit:'nº', color:'#f59e0b', refKey:'ref_accel',   fmt: v => Math.round(v) },
    { key:'decel',         label:'Desaceleração Semana',      unit:'nº', color:'#64748b', refKey:'ref_decel',   fmt: v => Math.round(v) },
  ]

  const [localFrom, setLocalFrom] = useState('')
  const [localTo,   setLocalTo]   = useState('')
  const [refs, setRefs] = useState({
    ref_dist: { Atacante:10.5,Extremo:10.6,Lateral:11,  'Meio Campo':11.5,'Volante':11.1,'Zagueiro':10.5, Total:65.2 },
    ref_hsr:  { Atacante:1005,Extremo:809, Lateral:1129,'Meio Campo':853, 'Volante':662, 'Zagueiro':609,  Total:5067 },
    ref_sprint:{ Atacante:300,Extremo:300, Lateral:300, 'Meio Campo':261,'Volante':250, 'Zagueiro':200,  Total:1611 },
    ref_accel: { Atacante:36, Extremo:37,  Lateral:33,  'Meio Campo':35, 'Volante':30,  'Zagueiro':32,   Total:213 },
    ref_decel: { Atacante:41, Extremo:16,  Lateral:58,  'Meio Campo':44, 'Volante':45,  'Zagueiro':33,   Total:273 },
  })
  const [editingRefs, setEditingRefs] = useState(false)
  const [relMode, setRelMode] = useState(false)
  const [relInfo, setRelInfo] = useState({ horario: '9:30 (BRT)', turno: 'Manhã', local: 'Aracaju - SE' })

  // Filter sessions
  const filtered = sessions.filter(s => {
    if (!s.data_sessao) return false
    if (s.tipo_sessao === 'Goleiros') return false
    if (localFrom && s.data_sessao < localFrom) return false
    if (localTo   && s.data_sessao > localTo)   return false
    return true
  })

  // Group sessions by weekday (0=Sun...6=Sat)
  const DAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const sessionDays = [...new Set(filtered.map(s => {
    const d = new Date(s.data_sessao+'T12:00:00')
    return `${DAY_NAMES[d.getDay()]} ${s.data_sessao.slice(5,10)}`
  }))].sort()

  // Aggregate rows: { pos -> { day -> { key -> sum, count } } }
  const posData = {}
  POSICOES.forEach(p => { posData[p] = {} })
  posData['Outros'] = {}
  posData['TOTAL'] = {}

  filtered.forEach(s => {
    const d = new Date(s.data_sessao+'T12:00:00')
    const dayKey = `${DAY_NAMES[d.getDay()]} ${s.data_sessao.slice(5,10)}`
    const rowArr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
    rowArr.filter(r => !r.isGK && r.playerName).forEach(r => {
      const pos = normPos(r.positionName)
      if (!posData[pos]) posData[pos] = {}
      if (!posData[pos][dayKey]) posData[pos][dayKey] = { count:0 }
      if (!posData['TOTAL'][dayKey]) posData['TOTAL'][dayKey] = { count:0 }
      METS_POS.forEach(m => {
        posData[pos][dayKey][m.key] = (posData[pos][dayKey][m.key]||0) + num(r[m.key])
        posData['TOTAL'][dayKey][m.key] = (posData['TOTAL'][dayKey][m.key]||0) + num(r[m.key])
      })
      posData[pos][dayKey].count++
      posData['TOTAL'][dayKey].count++
    })
  })

  // Compute avg per pos/day
  const posAvg = {}
  Object.entries(posData).forEach(([pos, days]) => {
    posAvg[pos] = {}
    Object.entries(days).forEach(([day, vals]) => {
      posAvg[pos][day] = {}
      const n = vals.count || 1
      METS_POS.forEach(m => {
        posAvg[pos][day][m.key] = (vals[m.key]||0) / n
      })
    })
  })

  // Row total per pos per metric
  const posTotal = {}
  Object.entries(posAvg).forEach(([pos, days]) => {
    posTotal[pos] = {}
    METS_POS.forEach(m => {
      posTotal[pos][m.key] = Object.values(days).reduce((s, d) => s+(d[m.key]||0), 0)
    })
  })

  const posRows = [...POSICOES.filter(p => Object.keys(posAvg[p]||{}).length > 0), 'TOTAL']

  const cellBg = (val, ref) => {
    if (!ref || ref <= 0) return 'transparent'
    const p = (val/ref)*100
    if (p >= 100) return '#d1fae5'
    if (p >= 85)  return '#fef9c3'
    if (p >= 70)  return '#fed7aa'
    return '#fee2e2'
  }

  function renderMetricTable(m) {
    const refMap = refs[m.refKey] || {}
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
        <div style={{ background: m.color }} className="px-4 py-2.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-white">{m.label}</p>
          <p className="text-[7px] text-white/70 mt-0.5">Média por atleta/dia por posição · {m.unit}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px]" style={{ borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#1f2937' }}>
                <th className="px-3 py-2 text-left text-white text-[8px] font-black uppercase tracking-wide">POSIÇÃO</th>
                <th className="px-3 py-2 text-right text-white text-[8px] font-black uppercase tracking-wide">REFERÊNCIA</th>
                {sessionDays.map(d => (
                  <th key={d} className="px-3 py-2 text-right text-white text-[8px] font-black uppercase tracking-wide whitespace-nowrap">{d}</th>
                ))}
                <th className="px-3 py-2 text-right text-white text-[8px] font-black uppercase tracking-wide">TOTAL</th>
                <th className="px-3 py-2 text-right text-white text-[8px] font-black uppercase tracking-wide">OBJ SEM</th>
                <th className="px-3 py-2 text-right text-white text-[8px] font-black uppercase tracking-wide">FALTA</th>
                <th className="px-3 py-2 text-right text-white text-[8px] font-black uppercase tracking-wide">%</th>
              </tr>
            </thead>
            <tbody>
              {posRows.map((pos, i) => {
                const ref   = refMap[pos] || 0
                const total = posTotal[pos]?.[m.key] || 0
                const falta = ref > 0 ? Math.max(0, ref - total) : 0
                const pct   = ref > 0 ? Math.round((total/ref)*100) : null
                const isTotal = pos === 'TOTAL'
                return (
                  <tr key={pos} style={{ background: isTotal ? '#f0fdf4' : i%2===0 ? 'white' : '#f9fafb', borderBottom:'1px solid #f3f4f6', fontWeight: isTotal ? 900 : 400 }}>
                    <td className="px-3 py-2 font-black text-gray-800 whitespace-nowrap" style={{ fontSize:9 }}>{pos}</td>
                    <td className="px-3 py-2 text-right text-gray-500" style={{ fontSize:9 }}>
                      {editingRefs
                        ? <input type="number" value={ref} onChange={e => setRefs(r => ({ ...r, [m.refKey]: { ...r[m.refKey], [pos]: parseFloat(e.target.value)||0 } }))}
                            style={{ width:60, textAlign:'right', border:'1px solid #d1d5db', borderRadius:4, padding:'1px 4px', fontSize:9 }} />
                        : m.fmt(ref)
                      }
                    </td>
                    {sessionDays.map(d => {
                      const v = posAvg[pos]?.[d]?.[m.key] || 0
                      return (
                        <td key={d} className="px-3 py-2 text-right font-bold tabular-nums" style={{ fontSize:9, background: cellBg(v, ref/sessionDays.length) }}>
                          {v > 0 ? m.fmt(v) : '—'}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-black tabular-nums" style={{ fontSize:9, color: m.color }}>
                      {total > 0 ? m.fmt(total) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500" style={{ fontSize:9 }}>
                      {ref > 0 ? m.fmt(ref) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ fontSize:9, color:'#dc2626', fontWeight: falta>0?700:400 }}>
                      {falta > 0 ? m.fmt(falta) : '✓'}
                    </td>
                    <td className="px-3 py-2 text-right font-black" style={{ fontSize:9, color: pct===null?'#9ca3af':pct>=100?'#0a66b7':pct>=85?'#ca8a04':pct>=70?'#ea580c':'#dc2626' }}>
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const content = (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="bc text-lg font-black uppercase text-gray-900">Métricas Semanais por Posição</p>
        <button onClick={() => setEditingRefs(r => !r)}
          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${editingRefs ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300'}`}>
          {editingRefs ? '✓ Fechar Referências' : '✏️ Editar Referências'}
        </button>
      </div>

      {editingRefs && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <p className="text-[8px] font-black uppercase tracking-widest text-amber-700">
            ℹ️ Edite os valores de referência diretamente nas tabelas abaixo (coluna REFERÊNCIA)
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-2">📊</p>
          <p className="bc text-xl font-black uppercase text-gray-300">Nenhuma sessão no período</p>
        </div>
      ) : (
        <div className="space-y-0">
          {METS_POS.map(m => renderMetricTable(m))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-5 fade-in dm">
      <style>{`@media print { body>*{visibility:hidden!important} #rel-posicao,#rel-posicao *{visibility:visible!important} #rel-posicao{position:fixed;top:0;left:0;width:100%;font-size:8px;overflow:auto} }`}</style>

      {/* Controles */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Visualizar por posição</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-gray-400 flex-shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              <input type="date" value={localFrom} onChange={e => setLocalFrom(e.target.value)} className="text-[9px] text-gray-600 bg-transparent focus:outline-none w-24" />
              <span className="text-gray-300 text-[9px]">→</span>
              <input type="date" value={localTo} onChange={e => setLocalTo(e.target.value)} className="text-[9px] text-gray-600 bg-transparent focus:outline-none w-24" />
              {(localFrom||localTo) && (
                <button onClick={() => { setLocalFrom(''); setLocalTo('') }} className="text-gray-300 hover:text-red-400 ml-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setRelMode(false)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${!relMode?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:bg-white'}`}>📊 Análise</button>
              <button onClick={() => setRelMode(true)}  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${relMode?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:bg-white'}`}>📋 Relatório</button>
            </div>
            {relMode && (
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase shadow-sm"
                style={{ background:'#0B7C3D' }}>
                🖨️ Imprimir
              </button>
            )}
          </div>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-2">
            <span className="text-[8px] text-gray-400 font-medium">Legenda:</span>
            {[['#d1fae5','≥ 100%'],['#fef9c3','85-99%'],['#fed7aa','70-84%'],['#fee2e2','< 70%']].map(([bg,label]) => (
              <span key={label} className="flex items-center gap-1 text-[7px] text-gray-500">
                <span style={{ width:10, height:10, background:bg, borderRadius:2, display:'inline-block', border:'1px solid #e5e7eb' }}/>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {relMode ? (
        <div id="rel-posicao">
          <div style={{ background:'#0B7C3D', borderRadius:12, padding:'12px 20px', marginBottom:12, color:'white' }}>
            <p style={{ fontFamily:'Barlow Condensed', fontSize:18, fontWeight:900, margin:0, textTransform:'uppercase' }}>
              Métricas Semanais por Posição
            </p>
            <p style={{ fontSize:9, opacity:0.8, margin:'2px 0 0' }}>
              {localFrom && localTo ? `${localFrom} a ${localTo}` : localFrom || localTo} · {filtered.length} sessões · Confiança — Departamento de Fisiologia
            </p>
          </div>
          {content}
        </div>
      ) : content}
    </div>
  )
}


// ─── ABA GOLEIROS ─────────────────────────────────────────────────────────────
function TabGoleiros({ session }) {
  const isGk   = (session?.rows?.isGK ?? session?.rows?.isGk) || session?.tipo_sessao === 'Goleiros'
  const rows   = session?.rows?.rows || []
  const [relMode, setRelMode] = useState(false)
  const [relInfo, setRelInfo] = useState({ horario: '9:30 (BRT)', turno: 'Manhã', local: 'Aracaju - SE' })

  const gkRows = isGk ? rows : rows.filter(r => {
    const pos = (r.positionName || '').toLowerCase()
    return pos.includes('golei') || pos.includes('gk') || pos.includes('goalkeeper') || pos.includes('keeper')
  })

  if (!rows.length) return <EmptyState icon="🧤" text="Selecione uma sessão" />

  const display = gkRows.length > 0 ? gkRows : rows
  const isAll   = gkRows.length === 0

  // ── Helpers de barra ──────────────────────────────────────────────────────
  const HBar = ({ data, field, color, title, labelFn }) => {
    const max = Math.max(...data.map(r => num(r[field])), 1)
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">{title}</p>
        {[...data].sort((a,b) => num(b[field])-num(a[field])).map(r => {
          const v = num(r[field])
          return (
            <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <p style={{ width:140, fontSize:9, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.playerName}</p>
              <div style={{ flex:1, height:22, background:'#f3f4f6', borderRadius:4, overflow:'hidden' }}>
                <div style={{ width:`${(v/max)*100}%`, height:'100%', background:color, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:6 }}>
                  <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{labelFn ? labelFn(v) : Math.round(v)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Acc/Decel grouped
  const AccDecelBar = ({ data }) => {
    const maxV = Math.max(...data.map(r => Math.max(num(r.accel), num(r.decel))), 1)
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Acc &gt;2-3 m/s² (nº) / Decel &lt;-2-3 m/s² (nº)</p>
          <div className="flex gap-3 text-[8px]">
            <span className="flex items-center gap-1"><span style={{ background:'#0B7C3D', borderRadius:3, padding:'1px 8px', color:'white', fontWeight:700 }}>■</span> Aceleração</span>
            <span className="flex items-center gap-1"><span style={{ background:'#0ea5e9', borderRadius:3, padding:'1px 8px', color:'white', fontWeight:700 }}>■</span> Desaceleração</span>
          </div>
        </div>
        {[...data].sort((a,b) => num(b.accel)-num(a.accel)).map(r => {
          const acc = num(r.accel), decel = num(r.decel)
          const w = (v) => `${(v/maxV)*48}%`
          return (
            <div key={r.playerName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <p style={{ width:140, fontSize:9, fontWeight:700, textAlign:'right', color:'#374151', flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.playerName}</p>
              <div style={{ flex:1, display:'flex', gap:3, height:22 }}>
                <div style={{ width:w(acc), height:'100%', background:'#0B7C3D', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5 }}>
                  <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{Math.round(acc)}</span>
                </div>
                <div style={{ width:w(decel), height:'100%', background:'#0ea5e9', borderRadius:4, display:'flex', alignItems:'center', paddingLeft:5 }}>
                  <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{Math.round(decel)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Dive Left/Right stacked %
  const DiveLRBar = ({ data }) => (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-4 mb-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Dive Left Count e Dive Right Count</p>
        <div className="flex gap-3 text-[8px]">
          <span className="flex items-center gap-1"><span style={{ background:'#3b82f6', borderRadius:3, padding:'1px 8px', color:'white', fontWeight:700 }}>■</span> Dive Left</span>
          <span className="flex items-center gap-1"><span style={{ background:'#1e3a8a', borderRadius:3, padding:'1px 8px', color:'white', fontWeight:700 }}>■</span> Dive Right</span>
        </div>
      </div>
      {data.map(r => {
        const left  = num(r.diveLeftCount)
        const right = num(r.diveRightCount)
        const total = left + right || 1
        const pL = ((left/total)*100).toFixed(1)
        const pR = ((right/total)*100).toFixed(1)
        return (
          <div key={r.playerName} style={{ marginBottom:8 }}>
            <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:'#374151', marginBottom:2 }}>{r.playerName}</p>
            <div style={{ display:'flex', height:22, borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:`${(left/total)*100}%`, background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{pL}%</span>
              </div>
              <div style={{ width:`${(right/total)*100}%`, background:'#1e3a8a', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{pR}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  // Jump counts stacked (High / Med / Low)
  const JumpStackBar = ({ data }) => {
    const max = Math.max(...data.map(r => num(r.jumpHigh)+num(r.jumpMed)+num(r.jumpLow)), 1)
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-4 mb-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Contagem de Saltos</p>
          <div className="flex gap-3 text-[8px]">
            <span className="flex items-center gap-1"><span style={{ background:'#4b5563', borderRadius:3, padding:'1px 8px', color:'white', fontWeight:700 }}>■</span> High Band</span>
            <span className="flex items-center gap-1"><span style={{ background:'#1e3a8a', borderRadius:3, padding:'1px 8px', color:'white', fontWeight:700 }}>■</span> Med Band</span>
            <span className="flex items-center gap-1"><span style={{ background:'#0ea5e9', borderRadius:3, padding:'1px 8px', color:'white', fontWeight:700 }}>■</span> Low Band</span>
          </div>
        </div>
        {[...data].sort((a,b) => (num(b.jumpHigh)+num(b.jumpMed)+num(b.jumpLow))-(num(a.jumpHigh)+num(a.jumpMed)+num(a.jumpLow))).map(r => {
          const h = num(r.jumpHigh), m = num(r.jumpMed), l = num(r.jumpLow)
          const tot = h + m + l || 1
          const wH = `${(h/max)*100}%`, wM = `${(m/max)*100}%`, wL = `${(l/max)*100}%`
          return (
            <div key={r.playerName} style={{ marginBottom:6 }}>
              <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:'#374151', marginBottom:2 }}>{r.playerName}</p>
              <div style={{ display:'flex', height:22, gap:2, alignItems:'center' }}>
                {h>0 && <div style={{ width:wH, height:'100%', background:'#4b5563', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{Math.round(h)}</span></div>}
                {m>0 && <div style={{ width:wM, height:'100%', background:'#1e3a8a', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{Math.round(m)}</span></div>}
                {l>0 && <div style={{ width:wL, height:'100%', background:'#0ea5e9', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:9, fontWeight:900, color:'white' }}>{Math.round(l)}</span></div>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const relContent = (
    <div className="space-y-4">
      {/* KPIs */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:4 }}>
        <KpiCard label="Goleiros" value={display.length} unit="atletas" color="#f59e0b" />
        <KpiCard label="Méd. Distância" value={Math.round(avg(display,'totalDistance'))} unit="m" color="#0B7C3D" />
        <KpiCard label="Méd. Dive Load" value={avg(display,'totalDiveLoad').toFixed(0)} unit="carga" color="#dc2626" />
        <KpiCard label="Méd. Mergulhos" value={avg(display,'totalDiveCount').toFixed(1)} unit="nº" color="#3b82f6" />
      </div>

      {/* Total Dive Load */}
      <HBar data={display} field="totalDiveLoad" color="#0B7C3D" title="Total Dive Load" />

      {/* Total Distance */}
      <HBar data={display} field="totalDistance" color="#0B7C3D" title="Total Distance (m)" labelFn={v => Math.round(v)} />

      {/* Acc / Decel */}
      <AccDecelBar data={display} />

      {/* Dive Left / Right */}
      {display.some(r => num(r.diveLeftCount) > 0 || num(r.diveRightCount) > 0) && <DiveLRBar data={display} />}

      {/* Jump counts */}
      {display.some(r => num(r.jumpHigh) > 0 || num(r.jumpMed) > 0 || num(r.jumpLow) > 0) && <JumpStackBar data={display} />}
    </div>
  )

  return (
    <div className="space-y-5 fade-in">
      <style>{`@media print { body>*{visibility:hidden!important} #rel-goleiros,#rel-goleiros *{visibility:visible!important} #rel-goleiros{position:fixed;top:0;left:0;width:100%;font-size:9px;overflow:auto} }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-start gap-4 p-4 rounded-2xl border flex-1" style={{ background: G.amberLight, borderColor: G.amberBorder }}>
          <span className="text-3xl">🧤</span>
          <div>
            <p className="bc text-xl font-black uppercase text-gray-900">Preparação de Goleiros</p>
            {isGk   && <p className="text-[9px] text-amber-700 font-bold mt-0.5">✓ Sessão específica de goleiros ({display.length} goleiro{display.length > 1 ? 's' : ''})</p>}
            {!isGk && gkRows.length > 0 && <p className="text-[9px] text-gray-500 mt-0.5">{gkRows.length} goleiro(s) identificado(s) pela posição</p>}
            {isAll  && <p className="text-[9px] text-amber-600 mt-0.5 font-bold">⚠️ Nenhum goleiro identificado — mostrando todos.</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setRelMode(false)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!relMode?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:bg-white'}`}>📊 Análise</button>
            <button onClick={() => setRelMode(true)}  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${relMode?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:bg-white'}`}>📋 Relatório</button>
          </div>
          {relMode && (
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase shadow-sm"
              style={{ background:'#f59e0b' }}>
              🖨️ Imprimir
            </button>
          )}
        </div>
      </div>

      {relMode ? (
        <div id="rel-goleiros">
          <div style={{ background:'#0B7C3D', borderRadius:12, padding:'14px 20px', marginBottom:12, color:'white' }}>
            <p style={{ fontFamily:'Barlow Condensed', fontSize:20, fontWeight:900, margin:0, textTransform:'uppercase' }}>
              Relatório de Carga Profissional (Goleiros)
            </p>
            <p style={{ fontSize:9, opacity:0.8, margin:'2px 0 0' }}>Departamento de Fisiologia · Sessão de Treinamento</p>
          </div>
          {relContent}
        </div>
      ) : (
        <>
          {relContent}
          {/* Tabela completa */}
          <DataTable rows={display} metrics={GK_METRICS} isGk={true} title={`Tabela — Goleiros (${display.length})`} />
        </>
      )}
    </div>
  )
}


// ─── ABA ACWR ─────────────────────────────────────────────────────────────────
function TabACWR({ sessions }) {
  const [metric,   setMetric]   = useState('totalDistance')
  const [refDate,  setRefDate]  = useState('')

  const METRICS = [
    { key: 'totalDistance', label: 'Distância Total', unit: 'm',    icon: '📏' },
    { key: 'dist20',        label: 'HSR > 20 km/h',  unit: 'm',    icon: '⚡' },
    { key: 'dist25',        label: 'Sprint > 25',    unit: 'm',    icon: '🚀' },
    { key: 'accel',         label: 'Acelerações',    unit: '',     icon: '📈' },
  ]

  // Normaliza data_sessao para "YYYY-MM-DD" independente de vir como string ou Date
  const toYMD = d => {
    if (!d) return ''
    if (d instanceof Date) return d.toISOString().split('T')[0]
    return String(d).slice(0, 10)
  }

  const isGKRow = r => {
    const p = (r.positionName || '').toLowerCase()
    return p.includes('golei') || p.includes('goal') || p === 'gk'
  }

  const fieldSessions = useMemo(() =>
    (sessions || [])
      .filter(s => s.tipo_sessao !== 'Goleiros' && s.data_sessao)
      .map(s => ({ ...s, _ymd: toYMD(s.data_sessao) }))
      .sort((a, b) => a._ymd.localeCompare(b._ymd))
  , [sessions])

  const latestYMD = fieldSessions.length
    ? fieldSessions[fieldSessions.length - 1]._ymd
    : ''
  const refDay = refDate || latestYMD   // "YYYY-MM-DD" ou ''

  // ── Helpers de zona ──────────────────────────────────────────────────────────
  const ZONE = {
    sem_dados: { color: '#94a3b8', bg: 'bg-gray-50 border-gray-200',    icon: '—',  label: '— Sem dados'    },
    sub:       { color: '#0ea5e9', bg: 'bg-sky-50 border-sky-200',      icon: '🔵', label: 'Subtreinamento' },
    otima:     { color: '#0B7C3D', bg: 'bg-sky-50 border-sky-300',  icon: '✅', label: 'Zona Ótima'     },
    atencao:   { color: '#f59e0b', bg: 'bg-amber-50 border-amber-200',  icon: '🟡', label: 'Atenção'        },
    risco:     { color: '#dc2626', bg: 'bg-red-50 border-red-200',      icon: '🔴', label: 'Zona de Risco'  },
  }
  const acwrZone = v => {
    if (!v || v <= 0) return 'sem_dados'
    if (v < 0.8)  return 'sub'
    if (v <= 1.3) return 'otima'
    if (v <= 1.5) return 'atencao'
    return 'risco'
  }

  // ── Cálculo do ACWR ──────────────────────────────────────────────────────────
  const acwrData = useMemo(() => {
    if (!refDay) return []
    let refD
    try { refD = new Date(refDay + 'T12:00:00') } catch (_) { return [] }
    if (isNaN(refD.getTime())) return []

    const addDays = (base, offset) => {
      const d = new Date(base)
      d.setDate(base.getDate() + offset)
      return d.toISOString().split('T')[0]
    }

    const d0  = refDay
    const d7  = addDays(refD, -7)
    const d14 = addDays(refD, -14)
    const d21 = addDays(refD, -21)
    const d28 = addDays(refD, -28)

    const map = {}
    fieldSessions.forEach(s => {
      const d = s._ymd
      if (!d || d < d28 || d > d0) return
      const rowArr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
      rowArr.filter(r => !isGKRow(r) && r.playerName).forEach(r => {
        const p = r.playerName
        if (!map[p]) map[p] = { name: p, pos: r.positionName || '', w1: 0, w2: 0, w3: 0, w4: 0 }
        const val = num(r[metric])
        if      (d > d7  && d <= d0)   map[p].w4 += val
        else if (d > d14 && d <= d7)   map[p].w3 += val
        else if (d > d21 && d <= d14)  map[p].w2 += val
        else if (d >= d28 && d <= d21) map[p].w1 += val
      })
    })

    return Object.values(map).map(p => {
      const acute   = p.w4
      const chronic = (p.w1 + p.w2 + p.w3 + p.w4) / 4
      const acwr    = chronic > 0 ? acute / chronic : 0
      const zone    = acwrZone(acwr)
      return { ...p, acute, chronic, acwr, zone }
    }).sort((a, b) => {
      const ord = { risco: 0, atencao: 1, sub: 2, otima: 3, sem_dados: 4 }
      return (ord[a.zone] - ord[b.zone]) || b.acwr - a.acwr
    })
  }, [fieldSessions, metric, refDay])

  if (!fieldSessions.length) return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-20 text-center fade-in">
      <p className="text-5xl mb-3">⚖️</p>
      <p className="bc text-2xl font-black uppercase text-gray-300">Nenhuma sessão de campo disponível</p>
      <p className="text-[10px] text-gray-300 mt-1">Importe sessões GPS pelo botão "Upload CSV"</p>
    </div>
  )

  const curM     = METRICS.find(m => m.key === metric)
  const withData = acwrData.filter(p => p.acwr > 0)
  const chartData = [...acwrData]
    .sort((a, b) => b.acwr - a.acwr)
    .map(p => ({ name: truncName(p.name), fullName: p.name, value: parseFloat(p.acwr.toFixed(3)), zone: p.zone }))

  return (
    <div className="space-y-5 fade-in">

      {/* ── Controles ────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Métrica de Carga</p>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map(m => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide border transition-all ${metric === m.key ? 'text-white border-transparent shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-sky-200'}`}
                style={metric === m.key ? { background: G.verde } : {}}>
                <span>{m.icon}</span>{m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Data de Referência</p>
          <div className="flex items-center gap-2">
            <input type="date" value={refDate || refDay}
              onChange={e => setRefDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] text-gray-700 focus:outline-none focus:border-sky-400 bg-gray-50" />
            {refDate && (
              <button onClick={() => setRefDate('')} className="text-gray-300 hover:text-gray-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-100 rounded-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 flex-shrink-0" />
          <p className="text-[9px] text-sky-700 font-medium">
            ACWR = Carga Aguda (7d) ÷ Média das 4 semanas (28d)
          </p>
        </div>
      </div>

      {/* ── Cards de zona ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { zone: 'otima',   label: 'Zona Ótima',     sub: '0.8 – 1.3' },
          { zone: 'sub',     label: 'Subtreinamento', sub: '< 0.8'      },
          { zone: 'atencao', label: 'Atenção',         sub: '1.3 – 1.5' },
          { zone: 'risco',   label: 'Zona de Risco',  sub: '> 1.5'      },
        ].map(z => {
          const cnt = withData.filter(p => p.zone === z.zone).length
          const Z = ZONE[z.zone]
          return (
            <div key={z.zone} className={`rounded-2xl border p-4 ${Z.bg}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[7px] font-black uppercase tracking-widest text-gray-500">{z.label}</p>
                  <p className="text-[8px] text-gray-400 mt-0.5">ACWR {z.sub}</p>
                </div>
                <span className="text-lg">{Z.icon}</span>
              </div>
              <p className="bc text-3xl font-black leading-none" style={{ color: Z.color }}>{cnt}</p>
              <p className="text-[7px] text-gray-400 mt-0.5">atleta{cnt !== 1 ? 's' : ''}</p>
            </div>
          )
        })}
      </div>

      {/* ── Gráfico de barras ────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="bc text-base font-black uppercase text-gray-900">⚖️ ACWR por Atleta</p>
            <p className="text-[8px] text-gray-400">{curM?.label} · 28 dias a partir de {refDay || '—'} · goleiros excluídos</p>
          </div>
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            {withData.length} com dados
          </span>
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-300">
            <p className="text-sm font-bold">Sem dados no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, 160 + chartData.length * 4)}>
            <BarChart data={chartData} margin={{ top: 28, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={false} height={4} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} domain={[0, 'auto']} tickFormatter={v => v.toFixed(1)} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', fontWeight: 600 }}
                formatter={v => [v.toFixed(2), 'ACWR']}
                labelFormatter={(_, pl) => pl?.[0]?.payload?.fullName || ''} />
              <ReferenceLine y={0.8} stroke="#0ea5e9" strokeDasharray="5 3" strokeWidth={1.5}
                label={{ value: '0.8', position: 'insideTopRight', fontSize: 8, fill: '#0ea5e9', fontWeight: 800, dy: -4 }} />
              <ReferenceLine y={1.3} stroke="#0a66b7" strokeDasharray="5 3" strokeWidth={1.5}
                label={{ value: '1.3', position: 'insideTopRight', fontSize: 8, fill: '#0a66b7', fontWeight: 800, dy: -4 }} />
              <ReferenceLine y={1.5} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={2}
                label={{ value: '1.5 ⚠️', position: 'insideTopRight', fontSize: 8, fill: '#dc2626', fontWeight: 800, dy: -4 }} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={52}>
                {chartData.map((d, i) => <Cell key={i} fill={ZONE[d.zone]?.color || '#94a3b8'} />)}
                <LabelList dataKey="name" content={PlayerNameLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
          {[
            { color: '#0ea5e9', label: '< 0.8 — Subtreinamento' },
            { color: '#0B7C3D', label: '0.8–1.3 — Zona Ótima'   },
            { color: '#f59e0b', label: '1.3–1.5 — Atenção'      },
            { color: '#dc2626', label: '> 1.5 — Zona de Risco'  },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              <p className="text-[8px] text-gray-500 font-medium">{l.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabela detalhada ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Cargas Semanais por Atleta</p>
          <p className="text-[8px] text-gray-400">{curM?.label} · ref {refDay}</p>
        </div>
        <div className="overflow-x-auto scrollbar-g">
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: G.verde }}>
                {['#', 'Atleta', 'Pos.', 'Sem. −4', 'Sem. −3', 'Sem. −2', 'Aguda (−1)', 'Crônica', 'ACWR', 'Status'].map(h => (
                  <th key={h} className={`px-3 py-3 text-[8px] font-black uppercase tracking-widest text-white ${['Atleta','Pos.','#'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acwrData.map((p, i) => {
                const Z = ZONE[p.zone]
                return (
                  <tr key={i} className={`border-b border-gray-50 row-hover ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2.5 text-gray-400 font-bold">{i + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">{p.name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{p.pos || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">{fmt(p.w1, curM?.unit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">{fmt(p.w2, curM?.unit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{fmt(p.w3, curM?.unit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: G.verde }}>{fmt(p.w4, curM?.unit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(p.chronic, curM?.unit)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {p.acwr > 0 ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black border ${Z.bg}`} style={{ color: Z.color }}>
                          {p.acwr.toFixed(2)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[8px] whitespace-nowrap">
                      {p.acwr > 0 ? `${Z.icon} ${Z.label}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Guia de interpretação ────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-3">ℹ️ Como Interpretar o ACWR</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { range: 'ACWR < 0.8', zone: 'sub',
              desc: 'Subtreinamento — carga recente muito abaixo da base crônica. Considere aumentar a carga progressivamente.' },
            { range: 'ACWR 0.8–1.3', zone: 'otima',
              desc: '"Sweet Spot" — zona ideal de adaptação com menor risco relativo de lesão. Objetivo do planejamento de carga.' },
            { range: 'ACWR 1.3–1.5', zone: 'atencao',
              desc: 'Atenção — carga elevada em relação à base crônica. Monitorar bem-estar. Evitar novos picos na semana seguinte.' },
            { range: 'ACWR > 1.5', zone: 'risco',
              desc: '"Zona de Risco" — risco de lesão significativamente elevado (Gabbett, 2016). Reduzir carga e priorizar recuperação.' },
          ].map(z => {
            const Z = ZONE[z.zone]
            return (
              <div key={z.range} className={`rounded-xl border p-3 ${Z.bg}`}>
                <p className="bc text-sm font-black leading-none mb-1.5" style={{ color: Z.color }}>{Z.icon} {z.range}</p>
                <p className="text-[9px] text-gray-600 leading-relaxed">{z.desc}</p>
              </div>
            )
          })}
        </div>
        <p className="text-[8px] text-gray-400 mt-3 leading-relaxed">
          ⚠️ Calculado com carga externa (GPS). Aumentos de carga {'>'}15% semana a semana elevam o risco de lesão em até 50%.
        </p>
      </div>
    </div>
  )
}

// ─── ABA RELATÓRIO DE JOGO ────────────────────────────────────────────────────
function TabRelatorioJogo({ sessions }) {
  const { getPhotoUrl } = usePlayerPhotos()

  // ── Match info ──────────────────────────────────────────────────────────────────────────────
  const [info, setInfo] = useState({
    adversario: '', data: '', placar: '0 x 0',
    estadio: 'Aracaju - SE',
    horario: '', competicao: 'Jogo Amistoso',
  })
  const setField = (k, v) => setInfo(p => ({ ...p, [k]: v }))

  // ── Session selector (uma sessão, blocos 1T/2T detectados automaticamente) ───────
  const [sessId, setSessId] = useState('')
  const [view,   setView]   = useState('completo')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const jogoSessions = sessions.filter(s => s.tipo_sessao === 'Jogo')

  // Nunca considerar aquecimento em jogo
  const isAquecimento = b => /aquecimento/i.test(b)

  // Blocos de jogo (exclui aquecimento)
  const getJogoBlocos = id => {
    if (!id) return []
    const s = sessions.find(s => String(s.id) === String(id))
    return (s?.rows?.blocos || []).filter(b => !isAquecimento(b))
  }

  // Detecta automaticamente 1T e 2T pelo nome do CSV ("1 tempo", "2 tempo")
  const detectBlocos = id => {
    const blocos = getJogoBlocos(id)
    const bloco1 = blocos.find(b => /1\s*tempo/i.test(b)) || blocos[0] || ''
    const bloco2 = blocos.find(b => /2\s*tempo/i.test(b)) || (blocos.length > 1 ? blocos[1] : '') || ''
    return { bloco1, bloco2 }
  }

  // Retorna linhas de um bloco, excluindo GKs
  const getRowsByBloco = (id, bloco) => {
    if (!id) return []
    const s = sessions.find(s => String(s.id) === String(id))
    if (!s) return []
    if (bloco && s.rows?.rowsByBloco?.[bloco]) {
      return s.rows.rowsByBloco[bloco].filter(r => !r.isGK)
    }
    return (Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])).filter(r => !r.isGK)
  }

  // Auto-preenche data ao selecionar sessão
  const handleSessChange = id => {
    setSessId(id)
    setSaved(false)
    if (!id) return
    const s = sessions.find(s => String(s.id) === String(id))
    if (!s) return
    // Se já há match_info salvo, pré-preenche o formulário
    if (s.rows?.match_info) {
      setInfo(prev => ({ ...prev, ...s.rows.match_info }))
    } else if (s.data_sessao) {
      // Só preenche data se ainda vazia
      const [y, m, d] = s.data_sessao.split('-')
      setInfo(prev => ({ ...prev, data: prev.data || `${d}/${m}/${y}` }))
    }
  }

  const { bloco1, bloco2 } = detectBlocos(sessId)
  const rows1T = getRowsByBloco(sessId, bloco1)
  const rows2T = getRowsByBloco(sessId, bloco2)
  const has2T  = !!(bloco2 && bloco2 !== bloco1 && rows2T.length > 0)

  // Salvar registro da partida na sessão GPS (persiste informações do jogo)
  const handleSavePartida = async () => {
    if (!sessId) return
    setSaving(true)
    try {
      await fetch(`/api/gps/${sessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_info: info }),
      })
      setSaved(true)
    } catch (e) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Merge 1T + 2T by playerName (sum dist, sprints, acc, decel; max vel)
  const rowsAll = useMemo(() => {
    const m = {}
    rows1T.forEach(r => {
      m[r.playerName] = { ...r }
      m[r.playerName]._totalMin = durationToMin(r.duration)
    })
    rows2T.forEach(r => {
      const n = r.playerName
      if (m[n]) {
        ;['totalDistance','dist20','dist25','sprints','accel','decel'].forEach(k => {
          m[n][k] = String(num(m[n][k]) + num(r[k]))
        })
        m[n].maxVel = String(Math.max(num(m[n].maxVel), num(r.maxVel)))
        m[n]._totalMin += durationToMin(r.duration)
      } else {
        m[n] = { ...r, _totalMin: durationToMin(r.duration) }
      }
    })
    return Object.values(m)
  }, [rows1T, rows2T])

  const currentRows = view === '1t' ? rows1T : view === '2t' ? rows2T : rowsAll

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getMin = r => {
    if (r._totalMin !== undefined) return r._totalMin
    return durationToMin(r.duration)
  }

  const pctHSR  = r => num(r.totalDistance) > 0 ? (num(r.dist20) / num(r.totalDistance) * 100) : 0
  const mPerMin = r => { const m = getMin(r); return m > 0 ? num(r.totalDistance) / m : 0 }

  // Médias do grupo
  const safeAvg = (arr, fn) => arr.length ? arr.reduce((s, r) => s + fn(r), 0) / arr.length : 0
  const avgDist   = safeAvg(currentRows, r => num(r.totalDistance))
  const avgMpM    = safeAvg(currentRows, mPerMin)
  const avgHSR    = safeAvg(currentRows, r => num(r.dist20))
  const avgPctHSR = safeAvg(currentRows, pctHSR)
  const avgSprint = safeAvg(currentRows, r => num(r.sprints))
  const avgAccel  = safeAvg(currentRows, r => num(r.accel))

  // Velocidade máx do grupo para %MaxVel
  const groupMaxVel = currentRows.length ? Math.max(...currentRows.map(r => num(r.maxVel))) : 1
  const pctMaxVel   = r => groupMaxVel > 0 ? (num(r.maxVel) / groupMaxVel * 100) : 0

  const REF_MPM  = 100
  const REF_PHSR = 7

  // ── Render helper: célula colorida ─────────────────────────────────────────
  const ColCell = ({ val, highlight, format = v => v.toFixed(1) }) => {
    const bg = highlight === 'green'  ? '#c8f7d3' :
               highlight === 'amber'  ? '#fde68a' :
               highlight === 'orange' ? '#fed7aa' : 'transparent'
    return (
      <td style={{ padding: '5px 8px', textAlign: 'right', background: bg, fontWeight: highlight ? 700 : 400, fontSize: 10 }}>
        {format(val)}
      </td>
    )
  }

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => window.print()

  const viewLabel = { '1t':'1° Tempo', '2t':'2° Tempo', 'completo':'Completo', 'destaques':'Destaques', 'posicoes':'Por Posição' }

  // ── Destaques: top 3 por categoria ─────────────────────────────────────────
  const DEST_CATS = [
    { key:'totalDistance', label:'Total Distance',    unit:'m',   fmt: v => (v/1000).toFixed(3), fn: r => num(r.totalDistance) },
    { key:'sprints',       label:'Sprint (>25 Km/h)', unit:'nº',  fmt: v => String(Math.round(v)), fn: r => num(r.sprints)       },
    { key:'maxVel',        label:'Maximum Velocity',  unit:'km/h',fmt: v => v.toFixed(1),        fn: r => num(r.maxVel)         },
    { key:'dist25',        label:'Sprint >25 (m)',    unit:'m',   fmt: v => v.toFixed(1),         fn: r => num(r.dist25)        },
    { key:'accel',         label:'Acc > 3 m/s²',      unit:'nº',  fmt: v => String(Math.round(v)), fn: r => num(r.accel)        },
    { key:'dist20',        label:'HSR >20 Km/h',      unit:'m',   fmt: v => String(Math.round(v)), fn: r => num(r.dist20)       },
    { key:'mpm',           label:'Metros/Min',         unit:'m/min',fmt:v => v.toFixed(1),        fn: r => mPerMin(r)           },
    { key:'decel',         label:'Decel < -3 m/s²',   unit:'nº',  fmt: v => String(Math.round(v)), fn: r => num(r.decel)        },
  ]

  const top3 = fn => [...currentRows].sort((a, b) => fn(b) - fn(a)).slice(0, 3)

  const fmtDist = v => v >= 1000 ? `${(v/1000).toFixed(2)}km` : `${Math.round(v)}m`

  return (
    <div className="space-y-5 fade-in dm">
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #rel-jogo-print, #rel-jogo-print * { visibility: visible !important; }
          #rel-jogo-print {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            font-size: 10px !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── CONFIG PAINEL ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden no-print">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">⚙️ Configurar Relatório</p>
          <div className="flex items-center gap-2">
            {sessId && (
              <button onClick={handleSavePartida} disabled={saving || saved}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border transition-all"
                style={{ background: saved ? '#f0fdf4' : 'white', color: saved ? '#0a66b7' : '#374151', borderColor: saved ? '#86efac' : '#e5e7eb' }}>
                {saving ? (
                  <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/></svg> Salvando...</>
                ) : saved ? (
                  <>✓ Partida Salva</>
                ) : (
                  <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar Registro</>
                )}
              </button>
            )}
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest shadow-sm"
              style={{ background: G.verde }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Imprimir / PDF
            </button>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Adversário', key:'adversario', placeholder:'Ex: Pouso Alegre - MG' },
            { label:'Placar',     key:'placar',     placeholder:'Ex: 2 x 1' },
            { label:'Data',       key:'data',       placeholder:'28/03/2026' },
            { label:'Horário',    key:'horario',    placeholder:'09:30 (BRT)' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">{f.label}</label>
              <input value={info[f.key]} onChange={e => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[10px] bg-gray-50 focus:outline-none focus:border-sky-400" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Estádio / Local</label>
            <input value={info.estadio} onChange={e => setField('estadio', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[10px] bg-gray-50 focus:outline-none focus:border-sky-400" />
          </div>
          <div>
            <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Competição</label>
            <input value={info.competicao} onChange={e => setField('competicao', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[10px] bg-gray-50 focus:outline-none focus:border-sky-400" />
          </div>
          <div className="col-span-2">
            <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Sessão do Jogo</label>
            <select value={sessId} onChange={e => handleSessChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[10px] bg-gray-50 focus:outline-none focus:border-sky-400">
              <option value="">— selecione a sessão —</option>
              {jogoSessions.map(s => <option key={s.id} value={s.id}>{s.titulo} ({s.data_sessao||'?'})</option>)}
            </select>
            {sessId && getJogoBlocos(sessId).length > 0 && (
              <p className="text-[7px] text-gray-400 mt-1">
                Períodos detectados: {getJogoBlocos(sessId).join(' · ')}
                {bloco1 && <span className="ml-2 text-sky-600 font-bold">1T → {bloco1}</span>}
                {has2T  && <span className="ml-2 text-blue-600 font-bold">2T → {bloco2}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── VIEW TABS ─────────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit no-print">
        {[
          { id:'1t',        label:'1° Tempo',        disabled: rows1T.length === 0 },
          { id:'2t',        label:'2° Tempo',        disabled: !has2T },
          { id:'completo',  label:'Completo',         disabled: !sessId },
          { id:'destaques', label:'🏆 Destaques',  disabled: !sessId },
          { id:'posicoes',  label:'📐 Por Posição', disabled: !sessId },
        ].map(v => (
          <button key={v.id} onClick={() => !v.disabled && setView(v.id)}
            disabled={v.disabled}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
              ${view === v.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}
              ${v.disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
            {v.label}
          </button>
        ))}
      </div>

      {!sessId && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-2">📋</p>
          <p className="bc text-lg font-black uppercase text-gray-300">Selecione a sessão do jogo acima</p>
          <p className="text-[9px] text-gray-300 mt-1">Apenas sessões do tipo "Jogo" são listadas</p>
        </div>
      )}

      {/* ─── RELATÓRIO IMPRIMÍVEL ──────────────────────────────────────────── */}
      {currentRows.length > 0 && view !== 'destaques' && (
        <div id="rel-jogo-print">

          {/* COVER */}
          <div style={{ background: G.verde, borderRadius: 16, padding: '20px 24px', marginBottom: 16, color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ fontFamily: 'Barlow Condensed', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: 2 }}>
                  Associação Desportiva Confiança
                </p>
                <p style={{ fontSize: 11, opacity: 0.8, margin: '2px 0 0', fontWeight: 600 }}>Departamento de Fisiologia</p>
                <p style={{ fontSize: 10, opacity: 0.65, margin: '4px 0 0' }}>{info.competicao}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'Barlow Condensed', fontSize: 48, fontWeight: 900, margin: 0, letterSpacing: 4, lineHeight: 1 }}>
                  {info.placar}
                </p>
                {info.adversario && (
                  <p style={{ fontSize: 11, opacity: 0.8, marginTop: 4, fontWeight: 700 }}>vs {info.adversario}</p>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, opacity: 0.8 }}>
                {info.data && <p style={{ margin: 0 }}>{info.data}</p>}
                {info.horario && <p style={{ margin: '2px 0 0' }}>⏰ {info.horario}</p>}
                {info.estadio && <p style={{ margin: '2px 0 0', fontSize: 9, opacity: 0.7 }}>{info.estadio}</p>}
              </div>
            </div>
          </div>

          {/* PERÍODO BADGE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ background: G.verde, color: 'white', borderRadius: 8, padding: '4px 14px', fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>
              {viewLabel[view]}
            </div>
            {/* KPI row */}
            {[
              { label:'Média Jogo', val: (avgDist/1000).toFixed(3), unit:'km' },
              { label:'Dist/Min',   val: avgMpM.toFixed(1),         unit:'m/min' },
              { label:'HSR >20',    val: Math.round(avgHSR),        unit:'m' },
              { label:'%HSR',       val: avgPctHSR.toFixed(1),      unit:'%' },
              { label:'Sprints',    val: Math.round(avgSprint),     unit:'nº' },
              { label:'Acel.',      val: Math.round(avgAccel),      unit:'nº' },
            ].map(k => (
              <div key={k.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 7, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280', margin: 0 }}>{k.label}</p>
                <p style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Barlow Condensed', color: G.verde, margin: 0, lineHeight: 1.2 }}>{k.val}</p>
                <p style={{ fontSize: 7, color: '#9ca3af', margin: 0 }}>{k.unit}</p>
              </div>
            ))}
          </div>

          {/* TABELA PRINCIPAL */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#1f2937' }}>
                  <th style={{ padding: '7px 8px', textAlign: 'left', color: 'white', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Player Name</th>
                  {[
                    'Total Distance', 'Metros/Min', 'HSR >20 Km/h', '% HSR',
                    'Vel. Máx.', 'Sprints >25', 'Acc >3 m/s²', 'Decel <-3 m/s²',
                    'Sprint >25 (m)', '% Vel. Máx.',
                  ].map(h => (
                    <th key={h} style={{ padding: '7px 8px', textAlign: 'right', color: 'white', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...currentRows]
                  .sort((a, b) => num(b.totalDistance) - num(a.totalDistance))
                  .map((r, i) => {
                    const mpm     = mPerMin(r)
                    const pHSR    = pctHSR(r)
                    const pMaxV   = pctMaxVel(r)
                    const bg      = i % 2 === 0 ? 'white' : '#f9fafb'
                    return (
                      <tr key={i} style={{ background: bg, borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '5px 8px', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap' }}>{r.playerName}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(num(r.totalDistance))}</td>
                        {/* m/min — amber if >100, orange if >110 */}
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontWeight: mpm > REF_MPM ? 700 : 400, background: mpm > 110 ? '#fed7aa' : mpm > REF_MPM ? '#fde68a' : 'transparent' }}>
                          {mpm > 0 ? mpm.toFixed(1) : '—'}
                        </td>
                        {/* HSR — green if >150m */}
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontWeight: num(r.dist20) > 150 ? 700 : 400, background: num(r.dist20) > 350 ? '#bbf7d0' : num(r.dist20) > 150 ? '#d1fae5' : 'transparent' }}>
                          {Math.round(num(r.dist20))}
                        </td>
                        {/* %HSR — green if > ref */}
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontWeight: pHSR > REF_PHSR ? 700 : 400, background: pHSR > REF_PHSR ? '#bbf7d0' : 'transparent' }}>
                          {pHSR.toFixed(1)}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10 }}>{num(r.maxVel).toFixed(1)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(num(r.sprints))}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(num(r.accel))}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(num(r.decel))}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10 }}>{num(r.dist25).toFixed(1)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: pMaxV > 100 ? '#dc2626' : G.verde }}>
                          {pMaxV.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                {/* SOMATÓRIO */}
                <tr style={{ background: '#f3f4f6', fontWeight: 900, borderTop: '2px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 8px', fontSize: 10, fontWeight: 900 }}>SOMATÓRIO</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(currentRows.reduce((s,r)=>s+num(r.totalDistance),0))}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{avgMpM.toFixed(1)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(currentRows.reduce((s,r)=>s+num(r.dist20),0))}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{avgPctHSR.toFixed(1)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{currentRows.length > 0 ? Math.max(...currentRows.map(r=>num(r.maxVel))).toFixed(1) : '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(currentRows.reduce((s,r)=>s+num(r.sprints),0))}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(currentRows.reduce((s,r)=>s+num(r.accel),0))}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{Math.round(currentRows.reduce((s,r)=>s+num(r.decel),0))}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>{currentRows.reduce((s,r)=>s+num(r.dist25),0).toFixed(1)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>—</td>
                </tr>
                {/* REFERÊNCIA */}
                <tr style={{ background: '#fef9c3' }}>
                  <td style={{ padding: '4px 8px', fontSize: 9, fontWeight: 700, color: '#854d0e' }}>REFERÊNCIA</td>
                  <td />
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, fontWeight: 800, color: '#dc2626' }}>{REF_MPM}.0</td>
                  <td />
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, fontWeight: 800, color: '#dc2626' }}>{REF_PHSR}.0%</td>
                  <td colSpan={6} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ABA DESTAQUES ──────────────────────────────────────────────────── */}
      {view === 'destaques' && (
        <div>
          {(rows1T.length === 0 && rows2T.length === 0) ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-2">🏆</p>
              <p className="bc text-lg font-black uppercase text-gray-300">Selecione as sessões acima</p>
            </div>
          ) : (
            <div>
              {/* Cover no modo destaques */}
              <div style={{ background: G.verde, borderRadius: 16, padding: '14px 20px', marginBottom: 16, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 900, margin: 0 }}>DESTAQUE INDIVIDUAL DA PARTIDA</p>
                  {info.adversario && <p style={{ fontSize: 11, opacity: 0.8, margin: '2px 0 0' }}>vs {info.adversario} · {info.placar}</p>}
                </div>
                {info.data && <p style={{ fontSize: 11, opacity: 0.75 }}>{info.data}</p>}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {DEST_CATS.map(cat => {
                  const top = top3(cat.fn)
                  return (
                    <div key={cat.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      {/* Header */}
                      <div style={{ background: G.verde, padding: '8px 12px' }}>
                        <p style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, color: 'white', margin: 0 }}>
                          {cat.label}
                        </p>
                      </div>
                      {/* Top 3 */}
                      {top.map((r, rank) => {
                        const photo = getPhotoUrl(r.playerName)
                        const value = cat.fn(r)
                        return (
                          <div key={r.playerName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: rank < 2 ? '1px solid #f3f4f6' : 'none', background: rank === 0 ? '#f0fdf4' : 'white' }}>
                            {/* rank badge */}
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: rank === 0 ? G.verde : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 9, fontWeight: 900, color: rank === 0 ? 'white' : '#6b7280' }}>{rank+1}</span>
                            </div>
                            {/* foto */}
                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {photo
                                ? <img src={photo} alt={r.playerName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} onError={e => { e.target.style.display='none' }} />
                                : <span style={{ fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 900, color: G.verde, opacity: 0.4 }}>{r.playerName.charAt(0)}</span>
                              }
                            </div>
                            {/* nome + valor */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: '#1f2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {truncName(r.playerName)}
                              </p>
                              <p style={{ fontSize: 12, fontWeight: 900, fontFamily: 'Barlow Condensed', color: rank === 0 ? G.verde : '#6b7280', margin: 0, lineHeight: 1.1 }}>
                                {cat.fmt(value)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ─── ABA POR POSIÇÃO ─────────────────────────────────────────────────── */}
      {view === 'posicoes' && (() => {
        const hasRows = currentRows.length > 0 || rows1T.length > 0 || rows2T.length > 0
        const baseRows = currentRows.length > 0 ? currentRows : [...rows1T, ...rows2T]
        if (!hasRows) return (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
            <p className="text-4xl mb-2">📐</p>
            <p className="bc text-lg font-black uppercase text-gray-300">Selecione as sessões acima</p>
          </div>
        )

        const POS_KEYS = ['Atacante','Extremo','Lateral','Volante','Meio Campo','Zagueiro']
        const normPosRel = str => {
          const p = (str||'').toLowerCase()
          if (p.includes('atacante')||p.includes('forward')||p.includes('st')||p.includes('cf')) return 'Atacante'
          if (p.includes('extremo')||p.includes('ponta')||p.includes('winger')||p.includes('rw')||p.includes('lw')) return 'Extremo'
          if (p.includes('lateral')||p.includes('fullback')||p.includes('rb')||p.includes('lb')) return 'Lateral'
          if (p.includes('volante')||p.includes('cdm')||p.includes('dmf')||p.includes('vol')) return 'Volante'
          if (p.includes('meia')||p.includes('meio')||p.includes('cam')||p.includes('mid')) return 'Meio Campo'
          if (p.includes('zagueiro')||p.includes('cb')||p.includes('center')||p.includes('zag')) return 'Zagueiro'
          return 'Outros'
        }

        // Group by position
        const byPos = {}
        baseRows.forEach(r => {
          const pos = normPosRel(r.positionName)
          if (!byPos[pos]) byPos[pos] = []
          byPos[pos].push(r)
        })

        const POS_METRICS = [
          { key:'totalDistance', label:'Distância', fmt: v => `${(v/1000).toFixed(2)}km`, color:'#0B7C3D' },
          { key:'dist20',        label:'HSR >20',   fmt: v => `${Math.round(v)}m`,       color:'#0ea5e9' },
          { key:'sprints',       label:'Sprints',   fmt: v => Math.round(v),              color:'#a855f7' },
          { key:'accel',         label:'Acel.',     fmt: v => Math.round(v),              color:'#f59e0b' },
          { key:'decel',         label:'Desac.',    fmt: v => Math.round(v),              color:'#64748b' },
          { key:'maxVel',        label:'Vel. Máx',  fmt: v => `${v.toFixed(1)} km/h`,    color:'#f97316' },
          { key:'dist25',        label:'Sprint m',  fmt: v => `${v.toFixed(0)}m`,         color:'#0ea5e9' },
        ]

        const POS_COLORS = {
          'Atacante':'#dc2626','Extremo':'#f97316','Lateral':'#0ea5e9',
          'Volante':'#8b5cf6','Meio Campo':'#0B7C3D','Zagueiro':'#374151','Outros':'#9ca3af'
        }

        const posKeys = POS_KEYS.filter(p => byPos[p]?.length > 0)
        if (byPos['Outros']?.length > 0) posKeys.push('Outros')

        return (
          <div className="space-y-6">
            {posKeys.map(pos => {
              const group = byPos[pos]
              if (!group?.length) return null
              const posColor = POS_COLORS[pos] || '#9ca3af'

              return (
                <div key={pos} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Header posição */}
                  <div style={{ background: posColor, padding: '10px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <p style={{ fontFamily:'Barlow Condensed', fontSize:16, fontWeight:900, textTransform:'uppercase', color:'white', margin:0, letterSpacing:2 }}>
                        {pos}
                      </p>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.8)', fontWeight:700 }}>{group.length} atleta{group.length>1?'s':''}</span>
                    </div>
                  </div>

                  {/* Tabela de métricas */}
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ borderCollapse:'collapse', fontSize:10 }}>
                      <thead>
                        <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                          <th style={{ padding:'8px 12px', textAlign:'left', fontSize:8, fontWeight:900, textTransform:'uppercase', letterSpacing:1, color:'#6b7280' }}>Atleta</th>
                          {POS_METRICS.map(m => (
                            <th key={m.key} style={{ padding:'8px 10px', textAlign:'right', fontSize:8, fontWeight:900, textTransform:'uppercase', letterSpacing:1, color:m.color, whiteSpace:'nowrap' }}>{m.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...group].sort((a,b) => num(b.totalDistance)-num(a.totalDistance)).map((r, ri) => {
                          // For each metric, determine rank within the group
                          const getRank = (key) => {
                            const sorted = [...group].sort((a,b) => num(b[key])-num(a[key]))
                            return sorted.findIndex(x => x.playerName === r.playerName)
                          }
                          return (
                            <tr key={r.playerName} style={{ borderBottom:'1px solid #f3f4f6', background: ri%2===0?'white':'#fafafa' }}>
                              <td style={{ padding:'8px 12px', fontWeight:700, color:'#111827', textTransform:'uppercase', fontSize:10, whiteSpace:'nowrap' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  {(() => {
                                    const photo = getPhotoUrl(r.playerName)
                                    return (
                                      <div style={{ width:28, height:28, borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', border:`1.5px solid ${posColor}` }}>
                                        {photo
                                          ? <img src={photo} alt={r.playerName} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} onError={e=>{e.target.style.display='none'}} />
                                          : <span style={{ fontSize:9, fontWeight:900, color:posColor }}>{r.playerName.charAt(0)}</span>
                                        }
                                      </div>
                                    )
                                  })()}
                                  <span style={{ fontSize:9 }}>{r.playerName}</span>
                                </div>
                              </td>
                              {POS_METRICS.map(m => {
                                const rank = getRank(m.key)
                                const isBest  = rank === 0
                                const isWorst = rank === group.length - 1 && group.length > 1
                                const cellBg = isBest ? '#dcfce7' : isWorst ? '#fee2e2' : 'transparent'
                                const cellColor = isBest ? '#07579e' : isWorst ? '#dc2626' : '#374151'
                                return (
                                  <td key={m.key} style={{ padding:'8px 10px', textAlign:'right', fontWeight: (isBest||isWorst)?900:400, background:cellBg, color:cellColor, tabularNums:true }}>
                                    {m.fmt(num(r[m.key]))}
                                    {isBest  && <span style={{ marginLeft:4, fontSize:9 }}>🥇</span>}
                                    {isWorst && <span style={{ marginLeft:4, fontSize:9 }}>⬇️</span>}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                      {/* Média da posição */}
                      {group.length > 1 && (
                        <tfoot>
                          <tr style={{ borderTop:'2px solid #e5e7eb', background:'#f0fdf4' }}>
                            <td style={{ padding:'7px 12px', fontWeight:900, fontSize:9, color:posColor, textTransform:'uppercase', letterSpacing:1 }}>Média Posição</td>
                            {POS_METRICS.map(m => {
                              const avg = group.reduce((s,r) => s+num(r[m.key]),0)/group.length
                              return (
                                <td key={m.key} style={{ padding:'7px 10px', textAlign:'right', fontWeight:900, color:posColor, fontSize:10 }}>
                                  {m.fmt(avg)}
                                </td>
                              )
                            })}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Mini ranking por métrica */}
                  <div style={{ padding:'10px 16px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, flexWrap:'wrap' }}>
                    {POS_METRICS.slice(0, 4).map(m => {
                      const best  = [...group].sort((a,b) => num(b[m.key])-num(a[m.key]))[0]
                      const worst = [...group].sort((a,b) => num(a[m.key])-num(b[m.key]))[0]
                      if (!best || group.length < 2) return null
                      return (
                        <div key={m.key} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'5px 10px', fontSize:8 }}>
                          <p style={{ fontWeight:900, textTransform:'uppercase', color:m.color, letterSpacing:1, margin:0 }}>{m.label}</p>
                          <p style={{ margin:'2px 0 0', color:'#07579e', fontWeight:700 }}>🥇 {best.playerName.split(' ')[0]} ({m.fmt(num(best[m.key]))})</p>
                          {worst.playerName !== best.playerName && (
                            <p style={{ margin:0, color:'#dc2626', fontWeight:700 }}>⬇️ {worst.playerName.split(' ')[0]} ({m.fmt(num(worst[m.key]))})</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {posKeys.length === 0 && (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                <p className="text-4xl mb-2">📐</p>
                <p className="bc text-lg font-black uppercase text-gray-300">Nenhuma posição identificada nos dados</p>
                <p className="text-[9px] text-gray-300 mt-1">Os atletas precisam ter posição definida no CSV</p>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── ABA POR POSIÇÃO ──────────────────────────────────────────────────────────
function TabPorPosicao({ session }) {
  const { getPhotoUrl, setPhoto } = usePlayerPhotos()
  const [posFiltro, setPosFiltro] = useState('Todos')
  const [selectedBlocos, setSelectedBlocos] = useState([])
  const [photoModal, setPhotoModal] = useState(null)

  // Zera a seleção de blocos ao trocar de sessão
  useEffect(() => { setSelectedBlocos([]) }, [session?.id])

  const blocosDisponiveis = getSessionBlocos(session)
  const rows = getRowsForBlocos(session, selectedBlocos).filter(r => {
    const pos = (r.positionName || '').toLowerCase()
    return !pos.includes('golei') && !pos.includes('goal') && pos !== 'gk'
  })

  // Reutiliza exatamente a mesma lógica compartilhada com a aba Destaques.
  const METS = POSITION_INDEX_METRICS
  const metricValue = positionMetricValue
  const metricHasVariation = positionMetricHasVariation
  const pct = positionPercentile
  const score = positionInternalScore
  const displayScore = positionDisplayScore
  const highlightBand = positionHighlightBand

  const posicoes = ['Todos', ...Array.from(new Set(rows.map(r => normPos(r.positionName)))).filter(p => p !== 'Outros').sort()]

  const filteredRows = posFiltro === 'Todos' ? rows : rows.filter(r => normPos(r.positionName) === posFiltro)

  // Por posição: separa grupos e calcula médias
  const grupos = {}
  filteredRows.forEach(r => {
    const pos = normPos(r.positionName)
    if (!grupos[pos]) grupos[pos] = []
    grupos[pos].push(r)
  })

  const rankGroup = posGrupo => {
    const sorted = [...posGrupo].sort((a, b) => {
      const diff = score(b, posGrupo) - score(a, posGrupo)
      return Math.abs(diff) > 0.0001 ? diff : (a.playerName || '').localeCompare(b.playerName || '')
    })

    let previousScore = null
    let previousRank = 0
    return sorted.map((row, index) => {
      const scoreValue = score(row, posGrupo)
      const tied = previousScore !== null && Math.abs(scoreValue - previousScore) <= 0.0001
      const rank = tied ? previousRank : index + 1
      previousScore = scoreValue
      previousRank = rank
      return { row, scoreValue, rank }
    })
  }

  const PlayerRow = ({ r, posGrupo, rank, scoreValue }) => {
    const photo = getPhotoUrl(r.playerName)
    const initials = (r.playerName||'').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()
    const s = displayScore(scoreValue)
    const band = highlightBand(s)
    const isTop = rank === 1

    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 border transition-all ${isTop ? 'border-sky-200 bg-sky-50' : 'border-gray-100 bg-white'}`}>
        <span className="text-[10px] font-black w-5 text-center" style={{color: rank===1?'#0a66b7': rank===2?'#ca8a04':rank===3?'#9ca3af':'#d1d5db'}}>
          {rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}º`}
        </span>
        <div className="relative w-11 h-11 flex-shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden border border-gray-200 bg-sky-700 flex items-center justify-center">
            {photo
              ? <img src={photo} alt={r.playerName} className="w-full h-full object-cover object-top" onError={e => { e.currentTarget.style.display = 'none' }} />
              : <span className="text-white text-[10px] font-black">{initials}</span>
            }
          </div>
          <button
            type="button"
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              setPhotoModal(r.playerName)
            }}
            className="absolute -right-1 -bottom-1 z-10 w-5 h-5 rounded-full bg-sky-700 border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-1"
            title={photo ? 'Trocar foto do atleta' : 'Adicionar foto do atleta'}
            aria-label={photo ? `Trocar foto de ${r.playerName}` : `Adicionar foto de ${r.playerName}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.4} className="w-3 h-3" aria-hidden="true">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase text-gray-900 truncate bc">{r.playerName}</p>
          <p className="text-[8px] text-gray-400">{r.positionName}</p>
          <button
            type="button"
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              setPhotoModal(r.playerName)
            }}
            className="mt-0.5 text-[7px] font-black uppercase tracking-wider text-sky-700 hover:text-sky-900 underline underline-offset-2 cursor-pointer"
          >
            📷 {photo ? 'Alterar foto' : 'Adicionar foto'}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {METS.map(m => {
            const v = metricValue(m, r)
            const active = metricHasVariation(posGrupo, m)
            const p = pct(v, posGrupo, m)
            const bg = !active ? '#f8fafc' : p >= 70 ? '#f0fdf4' : p <= 30 ? '#fef2f2' : '#f8fafc'
            const tc = !active ? '#94a3b8' : p >= 70 ? '#0a66b7' : p <= 30 ? '#dc2626' : '#475569'
            return (
              <div key={m.key} className="flex flex-col items-center" style={{minWidth:52}}>
                <span className="text-[8px] text-gray-400 font-bold">{m.label.split(' ')[0]}</span>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-lg mt-0.5" style={{background:bg,color:tc}}>{m.fmt(v)}</span>
                <span className="text-[7px] text-gray-400 mt-0.5">{active ? `P${p}` : "P—"}</span>
              </div>
            )
          })}
        </div>
        <div className="ml-2 text-center" style={{minWidth:54}} title={band.label}>
          <div className="text-[8px] font-black text-gray-500">Índice</div>
          <div className="text-[14px] font-black" style={{color:band.color}}>{s}</div>
          <div className="text-[6px] font-bold whitespace-nowrap" style={{color:band.color}}>{band.label}</div>
        </div>
      </div>
    )
  }

  const gerarPdf = () => {
    const titulo = session?.titulo || 'Sessão'
    const data   = session?.data_sessao ? new Date(session.data_sessao).toLocaleDateString('pt-BR',{timeZone:'UTC',day:'2-digit',month:'long',year:'numeric'}) : ''

    const gruposOrdenados = Object.entries(grupos).sort((a,b)=>a[0].localeCompare(b[0]))

    const mediaPos = (arr, metric) => {
      const vals = arr.map(r => metricValue(metric, r)).filter(Number.isFinite)
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
    }

    const blocosHtml = gruposOrdenados.map(([pos, arr]) => {
      const ranking = rankGroup(arr)
      const linhas = ranking.map(({ row: r, scoreValue, rank }, i) => {
        const athleteIndex = displayScore(scoreValue)
        const athleteBand = highlightBand(athleteIndex)
        const photoUrl = getPhotoUrl(r.playerName)
        const ini = (r.playerName||'').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()
        const avatar = photoUrl
          ? `<img src="${photoUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #e5e7eb;" crossorigin="anonymous"/>`
          : `<div style="width:32px;height:32px;border-radius:50%;background:#07579e;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:10px;font-weight:900;">${ini}</span></div>`
        const medal = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}º`
        const rowBg = i===0?'#f0fdf4':i%2===0?'#ffffff':'#f9fafb'
        const mCells = METS.map(m => {
          const v = metricValue(m, r)
          const active = metricHasVariation(arr, m)
          const p = pct(v, arr, m)
          const bg = !active?'#f1f5f9':p>=70?'#dcfce7':p<=30?'#fee2e2':'#f1f5f9'
          const tc = !active?'#94a3b8':p>=70?'#07579e':p<=30?'#dc2626':'#475569'
          return `<td style="padding:6px 8px;text-align:center;font-size:10px;"><span style="background:${bg};color:${tc};border-radius:6px;padding:2px 6px;font-weight:700;">${m.fmt(v)}</span><br/><span style="font-size:8px;color:#9ca3af;">${active?`P${p}`:'P—'}</span></td>`
        }).join('')
        return `<tr style="background:${rowBg};">
          <td style="padding:8px 10px;">${medal}</td>
          <td style="padding:8px 10px;"><div style="display:flex;align-items:center;gap:8px;">${avatar}<div><div style="font-size:11px;font-weight:900;text-transform:uppercase;">${r.playerName}</div></div></div></td>
          ${mCells}
          <td style="padding:6px 8px;text-align:center;"><div style="font-size:13px;font-weight:900;color:${athleteBand.color};">${athleteIndex}</div><div style="font-size:7px;font-weight:700;color:${athleteBand.color};white-space:nowrap;">${athleteBand.label}</div></td>
        </tr>`
      }).join('')

      const mediaLinha = METS.map(m => {
        const med = mediaPos(arr, m)
        return `<td style="padding:6px 8px;text-align:center;font-size:10px;font-weight:600;color:#6b7280;">${m.fmt(med)}</td>`
      }).join('')

      return `<div style="margin-bottom:24px;page-break-inside:avoid;">
        <div style="background:#1f2937;color:#fff;border-radius:8px 8px 0 0;padding:8px 14px;font-size:11px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;">${pos} — ${arr.length} atleta${arr.length!==1?'s':''}</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:7px 10px;font-size:8px;font-weight:900;text-transform:uppercase;text-align:center;">#</th>
            <th style="padding:7px 10px;font-size:8px;font-weight:900;text-transform:uppercase;text-align:left;">Atleta</th>
            ${METS.map(m=>`<th style="padding:7px 8px;font-size:8px;font-weight:900;text-transform:uppercase;text-align:center;">${m.label}</th>`).join('')}
            <th style="padding:7px 8px;font-size:8px;font-weight:900;text-transform:uppercase;text-align:center;">Índice de Destaque</th>
          </tr></thead>
          <tbody>
            ${linhas}
            <tr style="background:#f8fafc;border-top:2px solid #e5e7eb;">
              <td colspan="2" style="padding:6px 10px;font-size:9px;font-weight:900;color:#6b7280;">MÉDIA DA POSIÇÃO</td>
              ${mediaLinha}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Por Posição — ${titulo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box} body{font-family:'Inter',sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4 landscape;margin:12mm 12mm 10mm 12mm}
  .no-print{display:none}
  @media print{.no-print{display:none!important}}
  .print-btn{position:fixed;top:14px;right:14px;background:#0B7C3D;color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(11,124,61,0.3)}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">⬇ Baixar PDF</button>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #0B7C3D;">
  <div style="display:flex;align-items:center;gap:10px;">
    <div style="width:40px;height:40px;background:#07579e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:900;">ADC</div>
    <div><div style="font-size:18px;font-weight:900;color:#0B7C3D;letter-spacing:-0.02em;">COMPARATIVO POR POSIÇÃO</div>
    <div style="font-size:9px;color:#6b7280;margin-top:2px;">Confiança · GPS Catapult · Fisiologia</div></div>
  </div>
  <div style="text-align:right;"><div style="font-size:13px;font-weight:900;">${titulo}</div><div style="font-size:9px;color:#6b7280;">${data}</div></div>
</div>
<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
  ${Object.entries(grupos).map(([pos,arr])=>`<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 14px;"><div style="font-size:20px;font-weight:900;color:#1f2937;">${arr.length}</div><div style="font-size:8px;text-transform:uppercase;font-weight:700;color:#6b7280;">${pos}</div></div>`).join('')}
  <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:8px 14px;"><div style="font-size:20px;font-weight:900;color:#0a66b7;">${filteredRows.length}</div><div style="font-size:8px;text-transform:uppercase;font-weight:700;color:#07579e;">Total de Campo</div></div>
</div>
${blocosHtml}
<div style="margin-top:14px;font-size:8px;color:#9ca3af;display:flex;justify-content:space-between;">
  <span>P = percentil dentro da posição · Índice exibido em escala 60–100 · 90–100 Grande destaque · 80–89 Acima da média · 70–79 Boa participação · 60–69 Menor destaque · ranking preserva o score interno relativo</span>
  <span>Gerado em ${new Date().toLocaleString('pt-BR')} · Confidencial — Uso interno</span>
</div>
</body></html>`
    const win = window.open('','_blank','width=1100,height=750')
    if (!win){alert('Permita pop-ups para gerar o PDF.');return}
    win.document.write(html); win.document.close()
  }

  if (!rows.length) return <EmptyState icon="📐" text="Selecione uma sessão de campo" />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="bc text-base font-black uppercase text-gray-900">📐 Comparativo por Posição</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Índice de Destaque em escala 60–100, com ranking relativo dentro de cada posição</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={gerarPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-white transition-all"
            style={{background:'#0B7C3D'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            Gerar PDF
          </button>
        </div>
      </div>

      {/* Filtro por bloco */}
      <BlocoFilter blocos={blocosDisponiveis} selected={selectedBlocos} onChange={setSelectedBlocos} />

      {/* Filtro posição */}
      <div className="flex flex-wrap gap-2 mb-5">
        {posicoes.map(p => (
          <button key={p} onClick={() => setPosFiltro(p)}
            className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all"
            style={posFiltro===p ? {background:'#0B7C3D',color:'#fff',borderColor:'#0B7C3D'} : {background:'#fff',color:'#374151',borderColor:'#e5e7eb'}}>
            {p}
          </button>
        ))}
      </div>

      {/* Legenda do Índice de Destaque */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5 px-3 py-2 rounded-xl border border-gray-100 bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Índice de Destaque</span>
          <span className="text-[8px] font-bold text-sky-600">90–100 Grande destaque</span>
          <span className="text-[8px] font-bold" style={{color:'#0B7C3D'}}>80–89 Acima da média</span>
          <span className="text-[8px] font-bold text-amber-600">70–79 Boa participação</span>
          <span className="text-[8px] font-bold text-slate-500">60–69 Menor destaque</span>
        </div>
        <span className="text-[8px] font-bold text-gray-400">📷 Clique na miniatura para alterar a foto</span>
      </div>

      {/* Grupos */}
      {Object.entries(grupos).sort((a,b)=>a[0].localeCompare(b[0])).map(([pos, arr]) => {
        const ranking = rankGroup(arr)
        return (
          <div key={pos} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-white" style={{background:'#1f2937'}}>{pos}</span>
              <span className="text-[9px] text-gray-400">{arr.length} atleta{arr.length!==1?'s':''}</span>
            </div>
            <div>
              {ranking.map(({ row, scoreValue, rank }) => <PlayerRow key={row.playerName} r={row} posGrupo={arr} rank={rank} scoreValue={scoreValue} />)}
            </div>
          </div>
        )
      })}

      {/* Modal para adicionar, trocar ou remover a foto pela própria miniatura */}
      {photoModal && (
        <PhotoSelectorModal
          isOpen={true}
          playerName={photoModal}
          currentPhoto={getPhotoUrl(photoModal)}
          onPhotoSelect={url => {
            setPhoto(photoModal, url || null)
            setPhotoModal(null)
          }}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </div>
  )
}

// ─── ABA RELATÓRIO INDIVIDUAL ──────────────────────────────────────────────────
function TabRelIndividual({ sessions }) {
  const { getPhotoUrl } = usePlayerPhotos()
  const allPlayers = Array.from(new Set(
    sessions.flatMap(s => (s.rows?.rows||[]).map(r=>r.playerName)).filter(Boolean)
  )).sort()

  const [atleta, setAtleta] = useState('')
  const [periodo, setPeriodo] = useState('semana') // 'semana' | 'mes' | 'tudo'
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('Todos') // 'Todos' | 'Treino' | 'Jogo'

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const METS = [
    { key:'totalDistance', label:'Distância Total',  fmt: v => v>=1000?`${(v/1000).toFixed(2)} km`:`${Math.round(v)} m`, unit:'m',    color:'#0B7C3D' },
    { key:'dist20',        label:'HSR >20 km/h',     fmt: v => `${Math.round(v)} m`,   unit:'m',    color:'#0a66b7' },
    { key:'dist25',        label:'Sprint >25 km/h',  fmt: v => `${Math.round(v)} m`,   unit:'m',    color:'#0ea5e9' },
    { key:'sprints',       label:'Nº Sprints',        fmt: v => Math.round(v),          unit:'',     color:'#a855f7' },
    { key:'accel',         label:'Acelerações',       fmt: v => Math.round(v),          unit:'',     color:'#f59e0b' },
    { key:'decel',         label:'Desacelerações',    fmt: v => Math.round(v),          unit:'',     color:'#64748b' },
    { key:'maxVel',        label:'Vel. Máxima',       fmt: v => `${v.toFixed(1)} km/h`, unit:'km/h', color:'#f97316' },
  ]

  const filteredSessions = sessions.filter(s => {
    if (!s.data_sessao || !s.rows?.rows) return false
    if (!s.rows.rows.some(r => r.playerName === atleta)) return false
    if (s.tipo_sessao === 'Goleiros' && !s.rows.rows.find(r=>r.playerName===atleta)?.positionName?.toLowerCase().includes('golei')) {}
    if (filtroTipo !== 'Todos' && s.tipo_sessao !== filtroTipo) return false
    const d = new Date(s.data_sessao + 'T00:00:00')
    if (periodo === 'semana') { const lim = new Date(hoje); lim.setDate(lim.getDate()-7); return d >= lim }
    if (periodo === 'mes')    { const lim = new Date(hoje); lim.setDate(lim.getDate()-30); return d >= lim }
    return true
  }).sort((a,b) => a.data_sessao.localeCompare(b.data_sessao))

  const sessRows = filteredSessions.map(s => {
    const r = s.rows.rows.find(r => r.playerName === atleta)
    return { sessao: s.titulo || s.data_sessao, data: s.data_sessao, tipo: s.tipo_sessao || '', periodo_dia: s.periodo_dia || '', row: r }
  }).filter(x => x.row)

  const totais = {}
  const maximos = {}
  METS.forEach(m => {
    const vals = sessRows.map(x => num(x.row[m.key])).filter(v => v > 0)
    totais[m.key]  = vals.reduce((a,b)=>a+b, 0)
    maximos[m.key] = vals.length ? Math.max(...vals) : 0
  })

  const fmtData = d => d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : ''
  const tipoCor = t => t === 'Jogo' ? '#1d4ed8' : t === 'Treino' ? '#0B7C3D' : '#7c3aed'

  const gerarPdf = () => {
    const photo = getPhotoUrl(atleta)
    const ini = (atleta||'').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()
    const avatar = photo
      ? `<img src="${photo}" style="width:54px;height:54px;border-radius:50%;object-fit:cover;object-position:top;border:3px solid #e5e7eb;" crossorigin="anonymous"/>`
      : `<div style="width:54px;height:54px;border-radius:50%;background:#07579e;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:15px;font-weight:900;">${ini}</span></div>`

    const periodLabel = periodo==='semana'?'Última Semana':periodo==='mes'?'Último Mês':'Todo o Período'

    const linhas = sessRows.map((x, i) => {
      const bg = i%2===0?'#ffffff':'#f9fafb'
      const tipoBg = x.tipo==='Jogo'?'#dbeafe':x.tipo==='Treino'?'#f0fdf4':'#f3e8ff'
      const tipoTc = x.tipo==='Jogo'?'#1d4ed8':x.tipo==='Treino'?'#07579e':'#7c3aed'
      const cells = METS.map(m => {
        const v = num(x.row[m.key])
        const isMax = v === maximos[m.key] && v > 0
        return `<td style="padding:6px 8px;text-align:center;font-size:10px;font-weight:700;${isMax?'color:#07579e;':'color:#374151;'}">${m.fmt(v)}${isMax?' ★':''}</td>`
      }).join('')
      return `<tr style="background:${bg};">
        <td style="padding:7px 10px;font-size:10px;font-weight:700;">${fmtData(x.data)}</td>
        <td style="padding:7px 10px;font-size:10px;"><span style="background:${tipoBg};color:${tipoTc};border-radius:6px;padding:2px 8px;font-weight:700;font-size:9px;">${x.tipo}</span></td>
        <td style="padding:7px 10px;font-size:10px;">${x.periodo_dia}</td>
        ${cells}
      </tr>`
    }).join('')

    const totalCells = METS.map(m => `<td style="padding:6px 8px;text-align:center;font-size:10px;font-weight:900;color:#0B7C3D;">${m.fmt(totais[m.key])}</td>`).join('')
    const maxCells   = METS.map(m => `<td style="padding:6px 8px;text-align:center;font-size:10px;font-weight:900;color:#f97316;">${m.fmt(maximos[m.key])}</td>`).join('')
    const medCells   = METS.map(m => {
      const med = sessRows.length ? totais[m.key]/sessRows.length : 0
      return `<td style="padding:6px 8px;text-align:center;font-size:10px;font-weight:900;color:#6b7280;">${m.fmt(med)}</td>`
    }).join('')

    const kpis = [
      { label:'Sessões', val: sessRows.length, color:'#0B7C3D' },
      { label:'Treinos', val: sessRows.filter(x=>x.tipo==='Treino').length, color:'#0a66b7' },
      { label:'Jogos',   val: sessRows.filter(x=>x.tipo==='Jogo').length,   color:'#1d4ed8' },
      { label:'Dist. Total', val: totais.totalDistance>=1000 ? `${(totais.totalDistance/1000).toFixed(1)} km` : `${Math.round(totais.totalDistance)} m`, color:'#0B7C3D' },
      { label:'Vel. Máx (Pico)', val: `${maximos.maxVel?.toFixed(1)||0} km/h`, color:'#f97316' },
    ]

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Relatório Individual — ${atleta}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box} body{font-family:'Inter',sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4 landscape;margin:12mm 12mm 10mm 12mm}
  .print-btn{position:fixed;top:14px;right:14px;background:#0B7C3D;color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(11,124,61,0.3)}
  @media print{.print-btn{display:none!important}}
  th{background:#1f2937;color:#fff;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;padding:8px 10px;text-align:center}
  th:first-child,th:nth-child(2),th:nth-child(3){text-align:left}
</style></head><body>
<button class="print-btn" onclick="window.print()">⬇ Baixar PDF</button>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #0B7C3D;">
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:40px;height:40px;background:#07579e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:900;">ADC</div>
    <div><div style="font-size:18px;font-weight:900;color:#0B7C3D;">RELATÓRIO INDIVIDUAL · GPS</div>
    <div style="font-size:9px;color:#6b7280;margin-top:2px;">Confiança · GPS Catapult · ${periodLabel}</div></div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;">
    ${avatar}
    <div style="text-align:right;">
      <div style="font-size:15px;font-weight:900;text-transform:uppercase;">${atleta}</div>
      <div style="font-size:9px;color:#6b7280;margin-top:2px;">${sessRows[0]?.row?.positionName||''}</div>
    </div>
  </div>
</div>
<div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
  ${kpis.map(k=>`<div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 16px;"><div style="font-size:20px;font-weight:900;color:${k.color};">${k.val}</div><div style="font-size:8px;text-transform:uppercase;font-weight:700;color:#6b7280;">${k.label}</div></div>`).join('')}
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
  <thead><tr>
    <th style="text-align:left;">Data</th><th style="text-align:left;">Tipo</th><th style="text-align:left;">Período</th>
    ${METS.map(m=>`<th>${m.label}</th>`).join('')}
  </tr></thead>
  <tbody>
    ${linhas}
    <tr style="background:#f0fdf4;border-top:2px solid #bbf7d0;">
      <td colspan="3" style="padding:7px 10px;font-size:9px;font-weight:900;color:#07579e;">TOTAL ACUMULADO</td>${totalCells}
    </tr>
    <tr style="background:#fff7ed;border-top:1px solid #fed7aa;">
      <td colspan="3" style="padding:7px 10px;font-size:9px;font-weight:900;color:#ea580c;">MÁXIMO (pico)</td>${maxCells}
    </tr>
    <tr style="background:#f8fafc;border-top:1px solid #e2e8f0;">
      <td colspan="3" style="padding:7px 10px;font-size:9px;font-weight:900;color:#6b7280;">MÉDIA POR SESSÃO</td>${medCells}
    </tr>
  </tbody>
</table>
<div style="font-size:8px;color:#9ca3af;display:flex;justify-content:space-between;">
  <span>★ = valor máximo no período · Gerado em ${new Date().toLocaleString('pt-BR')}</span>
  <span>Confidencial — Uso interno · Confiança</span>
</div>
</body></html>`
    const win = window.open('','_blank','width=1100,height=750')
    if(!win){alert('Permita pop-ups para gerar o PDF.');return}
    win.document.write(html); win.document.close()
  }

  const playersFiltrados = busca.trim()
    ? allPlayers.filter(p => p.toLowerCase().includes(busca.toLowerCase()))
    : allPlayers

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="bc text-base font-black uppercase text-gray-900">👤 Relatório Individual</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Histórico completo de um atleta — última semana, mês ou todo o período</p>
        </div>
        <button onClick={gerarPdf} disabled={!atleta || !sessRows.length}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{background:'#0B7C3D'}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          Gerar PDF
        </button>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-3 mb-5 items-start">
        {/* Busca atleta */}
        <div className="flex-1 min-w-48 max-w-72">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Atleta</p>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar atleta..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[11px] font-medium focus:border-sky-400 outline-none"
          />
          {busca && (
            <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto" style={{width:280}}>
              {playersFiltrados.slice(0,10).map(p => (
                <button key={p} onClick={() => { setAtleta(p); setBusca('') }}
                  className="w-full text-left px-3 py-2 text-[11px] hover:bg-sky-50 font-medium bc uppercase">
                  {p}
                </button>
              ))}
            </div>
          )}
          {atleta && (
            <div className="flex items-center gap-2 mt-2">
              {getPhotoUrl(atleta) && <img src={getPhotoUrl(atleta)} className="w-6 h-6 rounded-full object-cover object-top" />}
              <span className="text-[10px] font-black uppercase text-sky-700 bc">{atleta}</span>
              <button onClick={() => setAtleta('')} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
            </div>
          )}
        </div>

        {/* Período */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Período</p>
          <div className="flex gap-1">
            {[['semana','Última Semana'],['mes','Último Mês'],['tudo','Todo Período']].map(([id,label]) => (
              <button key={id} onClick={() => setPeriodo(id)}
                className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all"
                style={periodo===id?{background:'#0B7C3D',color:'#fff',borderColor:'#0B7C3D'}:{background:'#fff',color:'#374151',borderColor:'#e5e7eb'}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Tipo</p>
          <div className="flex gap-1">
            {[['Todos','Todos'],['Treino','🏃 Treino'],['Jogo','⚽ Jogo']].map(([id,label]) => (
              <button key={id} onClick={() => setFiltroTipo(id)}
                className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all"
                style={filtroTipo===id
                  ? {background: id==='Jogo'?'#1d4ed8': id==='Treino'?'#0B7C3D':'#374151', color:'#fff', borderColor:'transparent'}
                  : {background:'#fff',color:'#374151',borderColor:'#e5e7eb'}}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de sessões */}
      {!atleta
        ? <EmptyState icon="👤" text="Selecione um atleta acima" />
        : !sessRows.length
          ? <EmptyState icon="📭" text="Nenhuma sessão encontrada no período" />
          : (
          <div>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
              {[
                { label:'Sessões', val: sessRows.length, color:'#0B7C3D' },
                { label:'Treinos', val: sessRows.filter(x=>x.tipo==='Treino').length, color:'#0a66b7' },
                { label:'Jogos',   val: sessRows.filter(x=>x.tipo==='Jogo').length,   color:'#1d4ed8' },
                { label:'Dist. Total', val: totais.totalDistance>=1000?`${(totais.totalDistance/1000).toFixed(1)} km`:`${Math.round(totais.totalDistance)} m`, color:'#0B7C3D' },
                { label:'Vel. Máx (Pico)', val: `${(maximos.maxVel||0).toFixed(1)} km/h`, color:'#f97316' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">{k.label}</p>
                  <p className="text-xl font-black mt-1" style={{color:k.color}}>{k.val}</p>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900 text-white">
                      <th className="px-4 py-3 text-[8px] font-black uppercase tracking-widest text-left">Data</th>
                      <th className="px-4 py-3 text-[8px] font-black uppercase tracking-widest text-left">Tipo</th>
                      <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-left">Período</th>
                      {METS.map(m => (
                        <th key={m.key} className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-center">{m.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessRows.map((x, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/50'} hover:bg-sky-50/30 transition-colors`}>
                        <td className="px-4 py-2.5 text-[10px] font-bold text-gray-700">{fmtData(x.data)}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase" style={{background: x.tipo==='Jogo'?'#dbeafe':x.tipo==='Treino'?'#f0fdf4':'#f3e8ff', color: tipoCor(x.tipo)}}>
                            {x.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[9px] text-gray-400">{x.periodo_dia}</td>
                        {METS.map(m => {
                          const v = num(x.row[m.key])
                          const isMax = v === maximos[m.key] && v > 0
                          return (
                            <td key={m.key} className="px-3 py-2.5 text-center">
                              <span className={`text-[11px] font-black ${isMax?'text-sky-700':v===0?'text-gray-300':'text-gray-700'}`}>
                                {m.fmt(v)}{isMax?' ★':''}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {/* Linha totais */}
                    <tr className="bg-sky-50 border-t-2 border-sky-200">
                      <td colSpan={3} className="px-4 py-2.5 text-[9px] font-black uppercase text-sky-700">Total Acumulado</td>
                      {METS.map(m => <td key={m.key} className="px-3 py-2.5 text-center text-[11px] font-black text-sky-700">{m.fmt(totais[m.key])}</td>)}
                    </tr>
                    <tr className="bg-orange-50 border-t border-orange-100">
                      <td colSpan={3} className="px-4 py-2.5 text-[9px] font-black uppercase text-orange-600">Máximo (Pico)</td>
                      {METS.map(m => <td key={m.key} className="px-3 py-2.5 text-center text-[11px] font-black text-orange-600">{m.fmt(maximos[m.key])}</td>)}
                    </tr>
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td colSpan={3} className="px-4 py-2.5 text-[9px] font-black uppercase text-gray-500">Média por Sessão</td>
                      {METS.map(m => {
                        const med = sessRows.length ? totais[m.key]/sessRows.length : 0
                        return <td key={m.key} className="px-3 py-2.5 text-center text-[11px] font-black text-gray-500">{m.fmt(med)}</td>
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }
    </div>
  )
}

// ─── EXPORTAÇÃO EXCEL (CSV UTF-8 com BOM) ─────────────────────────────────────
function downloadGpsExcel(sessions, tipo) {
  // Filtra por tipo: 'Treino' = Treino + Goleiros, 'Jogo' = Jogo
  const filtered = sessions.filter(s => {
    if (tipo === 'Treino') return s.tipo_sessao === 'Treino' || s.tipo_sessao === 'Goleiros'
    if (tipo === 'Jogo')   return s.tipo_sessao === 'Jogo'
    return true
  })

  if (!filtered.length) {
    alert(`Nenhuma sessão de ${tipo} encontrada.`)
    return
  }

  const headers = [
    'Sessão', 'Data', 'Tipo', 'Período',
    'Atleta', 'Posição',
    'Distância Total (m)', 'HSR >20km/h (m)', 'Sprint >25km/h (m)',
    'Nº Sprints', 'Acelerações', 'Desacelerações', 'Vel. Máxima (km/h)',
    'Mergulhos Totais', 'Carga Mergulho',
    'Mergulho Centro', 'Mergulho Esq.', 'Mergulho Dir.',
    'Saltos Alto', 'Saltos Méd.', 'Saltos Baixo',
  ]

  const escCsv = v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const rows = [headers]

  filtered.forEach(s => {
    const rowArr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
    const isGk   = (s.rows?.isGK ?? s.rows?.isGk) || s.tipo_sessao === 'Goleiros'
    rowArr.forEach(r => {
      rows.push([
        s.titulo || '',
        s.data_sessao || '',
        s.tipo_sessao || '',
        s.periodo_dia || '',
        r.playerName   || '',
        r.positionName || '',
        // LINE metrics
        num(r.totalDistance),
        num(r.dist20),
        num(r.dist25),
        num(r.sprints),
        num(r.accel),
        num(r.decel),
        num(r.maxVel),
        // GK metrics
        isGk ? num(r.totalDiveCount)  : '',
        isGk ? num(r.totalDiveLoad)   : '',
        isGk ? num(r.diveCentreCount) : '',
        isGk ? num(r.diveLeftCount)   : '',
        isGk ? num(r.diveRightCount)  : '',
        isGk ? num(r.jumpHigh)        : '',
        isGk ? num(r.jumpMed)         : '',
        isGk ? num(r.jumpLow)         : '',
      ])
    })
  })

  const csv = '\uFEFF' + rows.map(r => r.map(escCsv).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `GPS_Confianca_${tipo}_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ icon, text }) {
  return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center fade-in">
      <p className="text-4xl mb-2">{icon}</p>
      <p className="bc text-lg font-black uppercase text-gray-300">{text}</p>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function GpsPage() {
  const [sessions,       setSessions]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [selectedId,     setSelectedId]     = useState(null)
  const [activeTab,      setActiveTab]      = useState('resumo')
  const [showUpload,     setShowUpload]     = useState(false)
  const [deleteId,       setDeleteId]       = useState(null)
  const [filterTipo,     setFilterTipo]     = useState('Todos')
  const [filterPeriodo,  setFilterPeriodo]  = useState('Todos')
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')
  const [sessionGoals,   setSessionGoals]   = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    if (CORPO_TECNICO_DEMO_ENABLED) {
      const s = buildDemoGpsSessions()
      setSessions(s)
      if (s.length && !selectedId) setSelectedId(s[0].id)
      setLoading(false)
      return
    }
    try {
      const res  = await fetch('/api/gps')
      const data = await res.json()
      const s    = data.sessions || []
      setSessions(s)
      if (s.length && !selectedId) setSelectedId(s[0].id)
    } catch (_) {}
    setLoading(false)
  }, [selectedId])

  useEffect(() => { load() }, [])

  // Carregar metas quando muda sessão
  useEffect(() => {
    if (!selectedId) return
    try {
      const stored = localStorage.getItem(META_STORAGE)
      if (stored) {
        const all = JSON.parse(stored)
        setSessionGoals(all[selectedId] || {})
      } else {
        setSessionGoals({})
      }
    } catch (_) { setSessionGoals({}) }
  }, [selectedId])




  // DELETE — remove da UI imediatamente e persiste no banco
  const deleteSession = async (id) => {
    setDeleteId(null)
    if (String(id).startsWith('demo-')) {
      setSessions(prev => {
        const next = prev.filter(s => s.id !== id)
        if (selectedId === id) setSelectedId(next[0]?.id || null)
        return next
      })
      return
    }
    // 1. Remove da UI na hora (optimistic)
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id || null)
      return next
    })
    // 2. Persiste no banco — id como string para a URL
    try {
      const res = await fetch(`/api/gps/${String(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        // DELETE falhou no servidor — recarrega para sincronizar
        console.error('[GPS delete] Falhou:', res.status, await res.text())
        load()
      }
    } catch (err) {
      console.error('[GPS delete] Erro de rede:', err)
      load()
    }
  }

  const selectedSession = sessions.find(s => s.id === selectedId)
  const isGk = (selectedSession?.rows?.isGK ?? selectedSession?.rows?.isGk) || selectedSession?.tipo_sessao === 'Goleiros'

  const visibleTabs = TABS.filter(t => {
    // Aba Goleiros aparece quando sessão é de goleiros OU sempre como consulta
    return true
  })

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm min-h-screen bg-gray-50">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: G.verde }} />
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-400">GPS · Catapult · Fisiologia</p>
                </div>
                <h1 className="bc text-3xl font-black uppercase text-gray-900 leading-none">Central GPS</h1>
                {CORPO_TECNICO_DEMO_ENABLED && <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-sky-600">Modo demonstração · sessões fictícias do elenco do Confiança</p>}
              </div>
              {selectedSession && (
                <div className="hidden md:flex items-center gap-2 pl-4 border-l border-gray-200">
                  <div className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase ${isGk ? 'bg-amber-100 text-amber-700' : selectedSession.tipo_sessao==='Jogo' ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                    {TIPO_ICONS[selectedSession.tipo_sessao] || '🏃'} {selectedSession.tipo_sessao}
                  </div>
                  <p className="bc text-base font-black uppercase text-gray-700">{selectedSession.titulo}</p>
                  {selectedSession.data_sessao && (
                    <p className="text-[9px] text-gray-400">
                      {new Date(selectedSession.data_sessao + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' })}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Filtro de data */}
              <div className="hidden lg:flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="text-[9px] text-gray-600 bg-transparent focus:outline-none w-24" />
                <span className="text-gray-300 text-[9px]">→</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="text-[9px] text-gray-600 bg-transparent focus:outline-none w-24" />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-gray-300 hover:text-gray-500 ml-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>

              {/* Botões de exportação Excel */}
              <button
                onClick={() => downloadGpsExcel(sessions, 'Treino')}
                title="Baixar Excel — Todas as sessões de Treino"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-all shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span className="hidden lg:inline">Excel</span> Treinos
              </button>
              <button
                onClick={() => downloadGpsExcel(sessions, 'Jogo')}
                title="Baixar Excel — Todas as sessões de Jogo"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span className="hidden lg:inline">Excel</span> Jogos
              </button>

              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest shadow-sm hover:opacity-90"
                style={{ background: G.verde }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload CSV
              </button>
              <span className="text-[9px] text-gray-400 hidden sm:block">{sessions.length} sessão(ões){CORPO_TECNICO_DEMO_ENABLED ? ' · DEMO' : ''}</span>
            </div>
          </div>

          {/* Abas */}
          <div className="max-w-screen-2xl mx-auto mt-3 flex gap-0.5 bg-gray-100 p-1 rounded-xl w-fit">
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`tab-btn px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab===t.id ? 'tab-active bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BODY ────────────────────────────────────────────────────────── */}
        <div className="max-w-screen-2xl mx-auto px-6 py-6 flex gap-5">
          <SessionSidebar
            sessions={sessions}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id)}
            onDelete={setDeleteId}
            loading={loading}
            filterTipo={filterTipo}
            setFilterTipo={setFilterTipo}
            filterPeriodo={filterPeriodo}
            setFilterPeriodo={setFilterPeriodo}
          />

          <div className="flex-1 min-w-0">
            {activeTab === 'acwr' ? (
              <TabACWR sessions={sessions} />
            ) : !selectedSession ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-20 text-center">
                <p className="text-5xl mb-3">📡</p>
                <p className="bc text-2xl font-black uppercase text-gray-300">Selecione ou importe uma sessão</p>
                <p className="text-[10px] text-gray-300 mt-1">Use o botão "Upload CSV" para importar dados do Catapult</p>
              </div>
            ) : (
              <>
                {activeTab === 'resumo'    && <TabResumo    session={selectedSession} sessionGoals={sessionGoals} />}
                {activeTab === 'metricas'  && <TabMetricas  session={selectedSession} sessionGoals={sessionGoals} />}

                {activeTab === 'semanal'     && <TabSemanal    sessions={sessions} dateFrom={dateFrom} dateTo={dateTo} />}
                {activeTab === 'media_grupo' && <TabMediaGrupo sessions={sessions} />}
                {activeTab === 'perfil'      && <TabPerfil     sessions={sessions} dateFrom={dateFrom} dateTo={dateTo} />}

                {activeTab === 'jogo_treino'  && <TabJogoVsTreino sessions={sessions} />}
                {activeTab === 'destaques'   && <TabDestaques  session={selectedSession} sessionGoals={sessionGoals} />}
                {activeTab === 'goleiros'  && <TabGoleiros  session={selectedSession} />}
                {activeTab === 'por_posicao'    && <TabPorPosicao   session={selectedSession} />}
                {activeTab === 'rel_individual' && <TabRelIndividual sessions={sessions} />}
                {activeTab === 'correlacao'     && <TabCorrelacao session={selectedSession} />}
              </>
            )}
            {activeTab === 'relatorio_jogo' && <TabRelatorioJogo sessions={sessions} />}
          </div>
        </div>
      </div>

      {/* Modal de upload */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); load() }} />
      )}

      {/* Modal de confirmação de delete */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <p className="text-3xl mb-2">🗑️</p>
            <p className="bc text-xl font-black uppercase text-gray-900 mb-1">Excluir sessão?</p>
            <p className="text-[11px] text-gray-400 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 hover:bg-gray-200">
                Cancelar
              </button>
              <button onClick={() => deleteSession(deleteId)}
                className="px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-700">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
