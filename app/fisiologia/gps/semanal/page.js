'use client'
import { useState, useEffect } from 'react'
import AppShell from '../../../components/layout/AppShell'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList
} from 'recharts'

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
  * { scrollbar-width: thin; scrollbar-color: #0B7C3D #f1f5f9; }
  *::-webkit-scrollbar { width: 4px; height: 4px; }
  *::-webkit-scrollbar-thumb { background: #0B7C3D; border-radius: 9999px; }
  .row-hover:hover { background: #f0fdf4; }
  .fade-in { animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
`

const G = { verde: '#0B7C3D', verde2: '#0a66b7' }

const num = v => parseFloat(v) || 0
const fmt = (v, unit) => {
  const n = num(v)
  if (unit === 'm' && n >= 1000) return `${(n / 1000).toFixed(2)} km`
  if (unit === 'km/h') return `${n.toFixed(1)}`
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

const METRICS = [
  { key: 'totalDistance', label: 'Distância Total',   unit: 'm',    icon: '📏', color: '#0B7C3D', metaKey: 'wDist',    metaDef: 50000, step: 1000 },
  { key: 'dist20',        label: 'HSR > 20 km/h',     unit: 'm',    icon: '⚡', color: '#0a66b7', metaKey: 'wHSR',     metaDef: 8000,  step: 500  },
  { key: 'dist25',        label: 'Sprint > 25 km/h',  unit: 'm',    icon: '🚀', color: '#0ea5e9', metaKey: 'wSprint',  metaDef: 3000,  step: 200  },
  { key: 'sprints',       label: 'Nº de Sprints',      unit: '',     icon: '🔁', color: '#a855f7', metaKey: 'wSprints', metaDef: 40,    step: 5    },
  { key: 'accel',         label: 'Acelerações',        unit: '',     icon: '📈', color: '#f59e0b', metaKey: 'wAccel',   metaDef: 100,   step: 10   },
  { key: 'decel',         label: 'Desacelerações',     unit: '',     icon: '📉', color: '#64748b', metaKey: 'wDecel',   metaDef: 100,   step: 10   },
  { key: 'maxVel',        label: 'Vel. Máxima',        unit: 'km/h', icon: '🏎️', color: '#f97316', metaKey: 'wVel',     metaDef: 32,    step: 0.5  },
]

const WGOALS_KEY = 'confianca_gps_semanal_metas_v1'
const COLORS = ['#0B7C3D','#0a66b7','#4ade80','#a855f7','#f59e0b','#f97316','#0ea5e9','#ec4899','#64748b','#10b981']

const BarLabel = ({ x, y, width, value }) => {
  if (!value || width < 14) return null
  const n = num(value)
  const label = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n % 1 === 0 ? String(n) : n.toFixed(1)
  return (
    <text x={x + width / 2} y={y - 5} fill="#374151"
      textAnchor="middle" fontSize={7} fontWeight="800" fontFamily="DM Sans,sans-serif">
      {label}
    </text>
  )
}

export default function GpsSemanalPage() {
  const [sessions,     setSessions]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [dateFrom,     setDateFrom]     = useState(() => {
    // Default: início da semana atual
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
    return d.toISOString().slice(0, 10)
  })
  const [dateTo,       setDateTo]       = useState(() => new Date().toISOString().slice(0, 10))
  const [goals,        setGoals]        = useState({})
  const [editGoals,    setEditGoals]    = useState(false)
  const [draftGoals,   setDraftGoals]   = useState({})

  useEffect(() => {
    fetch('/api/gps')
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
    try {
      const s = localStorage.getItem(WGOALS_KEY)
      if (s) setGoals(JSON.parse(s))
    } catch (_) {}
  }, [])

  // Sessões no período selecionado (ignora goleiros)
  const filtered = sessions.filter(s => {
    if (!s.data_sessao) return false
    if (s.tipo_sessao === 'Goleiros') return false
    if (dateFrom && s.data_sessao < dateFrom) return false
    if (dateTo   && s.data_sessao > dateTo)   return false
    return true
  })

  // Acumulado individual por atleta
  const accumulated = {}
  filtered.forEach(s => {
    // suporta novo formato {rows:[...]} e legado (array direto)
    const rowArr = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
    rowArr.forEach(r => {
      const p = r.playerName
      if (!p) return
      if (!accumulated[p]) accumulated[p] = { name: p, pos: r.positionName || '', sessoes: 0 }
      METRICS.forEach(m => {
        accumulated[p][m.key] = (accumulated[p][m.key] || 0) + num(r[m.key])
      })
      accumulated[p].sessoes++
    })
  })
  const players = Object.values(accumulated).sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0))

  const saveGoals = () => {
    setGoals(draftGoals)
    localStorage.setItem(WGOALS_KEY, JSON.stringify(draftGoals))
    setEditGoals(false)
  }

  const pctColor = p => p >= 100 ? G.verde : p >= 75 ? '#f59e0b' : '#dc2626'

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-20">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-400 mb-0.5">GPS · Catapult</p>
              <h1 className="bc text-3xl font-black uppercase text-gray-900 leading-none">Acumulado Semanal</h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filtro datas */}
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-gray-400">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="text-[10px] text-gray-600 bg-transparent focus:outline-none w-28" />
                <span className="text-gray-300">→</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="text-[10px] text-gray-600 bg-transparent focus:outline-none w-28" />
              </div>
              <button
                onClick={() => { setDraftGoals({ ...goals }); setEditGoals(true) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest shadow-sm"
                style={{ background: G.verde }}>
                ⚙️ Metas Semanais
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">

          {/* Modal metas */}
          {editGoals && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditGoals(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-sky-50">
                  <p className="bc text-xl font-black uppercase text-gray-900">⚙️ Metas Semanais Individuais</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Definidas por atleta — acumulado de toda a semana</p>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {METRICS.map(m => {
                    const v = draftGoals[m.metaKey] !== undefined ? draftGoals[m.metaKey] : m.metaDef
                    return (
                      <div key={m.key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span>{m.icon}</span>
                            <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">{m.label}</p>
                          </div>
                          <span className="text-[8px] text-gray-400">{m.unit || 'nº'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={m.metaDef * 2} step={m.step} value={v}
                            onChange={e => setDraftGoals(p => ({ ...p, [m.metaKey]: parseFloat(e.target.value) }))}
                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, ${m.color} ${(v/(m.metaDef*2))*100}%, #e5e7eb ${(v/(m.metaDef*2))*100}%)` }} />
                          <input type="number" value={v} step={m.step}
                            onChange={e => setDraftGoals(p => ({ ...p, [m.metaKey]: parseFloat(e.target.value) || 0 }))}
                            className="w-20 text-right text-[10px] font-black border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-sky-400" />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
                  <button onClick={() => setEditGoals(false)} className="px-4 py-2 text-[9px] font-black uppercase text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancelar</button>
                  <button onClick={saveGoals} className="px-5 py-2 rounded-xl text-white text-[9px] font-black uppercase shadow" style={{ background: G.verde }}>✓ Salvar</button>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <span>ℹ️</span>
            <p className="text-[9px] text-blue-700 font-medium">
              Acumulado <strong>individual</strong> de cada atleta — {filtered.length} sessão(ões) no período.
              {filtered.length === 0 && ' Selecione um intervalo de datas que contenha sessões.'}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: G.verde }} />
            </div>
          ) : players.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center fade-in">
              <p className="text-4xl mb-2">📅</p>
              <p className="bc text-xl font-black uppercase text-gray-300">Nenhum atleta no período</p>
              <p className="text-[10px] text-gray-300 mt-1">Ajuste o filtro de datas acima</p>
            </div>
          ) : (
            <>
              {/* Cards resumo por métrica */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {METRICS.map(m => {
                  const total  = players.reduce((s, p) => s + (p[m.key] || 0), 0)
                  const avgVal = players.length ? total / players.length : 0
                  const goal   = goals[m.metaKey] || m.metaDef
                  const pct    = Math.min(100, (avgVal / goal) * 100)
                  return (
                    <div key={m.key} className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 leading-tight">{m.label}</p>
                        <span className="text-base">{m.icon}</span>
                      </div>
                      <p className="bc text-lg font-black leading-none" style={{ color: m.color }}>{fmt(avgVal, m.unit)}</p>
                      <p className="text-[7px] text-gray-400 mt-0.5">méd. individual</p>
                      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pctColor(pct) }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Gráfico por métrica */}
              {METRICS.map(m => {
                const data = [...players]
                  .sort((a, b) => (b[m.key] || 0) - (a[m.key] || 0))
                  .map(p => ({ name: p.name.split(' ')[0], fullName: p.name, value: num(p[m.key]) }))
                const goal  = goals[m.metaKey] || 0
                const n = data.length
                const bottom = n > 22 ? 72 : n > 14 ? 58 : 48

                return (
                  <div key={m.key} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span>{m.icon}</span>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                          {m.label} — Acumulado Individual
                          {m.unit === 'm' && <span className="ml-1 text-gray-300 font-normal">(m)</span>}
                        </p>
                      </div>
                      {goal > 0 && (
                        <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                          🎯 Meta: {fmt(goal, m.unit)}
                        </span>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(200, 160 + n * 4)}>
                      <BarChart data={data} margin={{ top: 22, right: 6, left: -18, bottom }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#4b5563' }}
                          angle={-40} textAnchor="end" interval={0} height={bottom} />
                        <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', fontWeight: 600 }}
                          formatter={v => [fmt(v, m.unit), m.label]}
                          labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''} />
                        {goal > 0 && (
                          <line x1="0%" x2="100%" y={goal} stroke={G.verde} strokeDasharray="4 2" strokeWidth={2} />
                        )}
                        <Bar dataKey="value" fill={m.color} radius={[5, 5, 0, 0]} maxBarSize={52}>
                          <LabelList dataKey="value" content={<BarLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })}

              {/* Tabela completa */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm fade-in">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                    Tabela Completa — {players.length} atleta{players.length > 1 ? 's' : ''} · {filtered.length} sessão(ões)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr style={{ background: G.verde }}>
                        <th className="px-3 py-3 text-left text-[8px] font-black uppercase tracking-widest text-white w-8">#</th>
                        <th className="px-3 py-3 text-left text-[8px] font-black uppercase tracking-widest text-white">Atleta</th>
                        <th className="px-3 py-3 text-center text-[8px] font-black uppercase tracking-widest text-white">Sess.</th>
                        {METRICS.map(m => (
                          <th key={m.key} className="px-3 py-3 text-right text-[8px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                            {m.icon} {m.label.split(' ')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p, i) => (
                        <tr key={i} className={`border-b border-gray-50 row-hover ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                          <td className="px-3 py-2.5 text-gray-400 font-bold">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-bold text-gray-900 whitespace-nowrap">{p.name}</p>
                            {p.pos && <p className="text-[8px] text-gray-400">{p.pos}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-500">{p.sessoes}</td>
                          {METRICS.map(m => {
                            const val  = p[m.key] || 0
                            const goal = goals[m.metaKey] || 0
                            const pct  = goal > 0 ? Math.min(100, (val / goal) * 100) : null
                            return (
                              <td key={m.key} className="px-3 py-2.5 text-right">
                                <span className="tabular-nums font-bold text-gray-700">{fmt(val, m.unit)}</span>
                                {pct !== null && (
                                  <span className="block text-[7px] font-bold tabular-nums" style={{ color: pctColor(pct) }}>
                                    {Math.round(pct)}%
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
