'use client'
import React, { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import RankingTab from './RankingTab'

// ─── CONFIG ────────────────────────────────────────────────────────────────
const ZONES = [
  { id: 1, label: 'Q1', name: 'Alto Esq.'    },
  { id: 2, label: 'Q2', name: 'Alto Centro'  },
  { id: 3, label: 'Q3', name: 'Alto Dir.'    },
  { id: 4, label: 'Q4', name: 'Meio Esq.'    },
  { id: 5, label: 'Q5', name: 'Meio Centro'  },
  { id: 6, label: 'Q6', name: 'Meio Dir.'    },
  { id: 7, label: 'Q7', name: 'Baixo Esq.'   },
  { id: 8, label: 'Q8', name: 'Baixo Centro' },
  { id: 9, label: 'Q9', name: 'Baixo Dir.'   },
]

const TIPO_CFG = {
  treino: { label: 'TREINO', color: '#0a66b7', light: '#f0fdf4', border: '#bbf7d0', icon: '⚽' },
  jogo:   { label: 'JOGO',   color: '#dc2626', light: '#fef2f2', border: '#fecaca', icon: '🏆' },
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(d) {
  if (!d) return ''
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

// ─── DONUT CHART ────────────────────────────────────────────────────────────
function DonutChart({ gols, faltas, foras, total }) {
  const pct = total === 0 ? 0 : Math.round((gols / total) * 100)
  const r = 38
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const gap  = circ - dash

  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#fecaca" strokeWidth="14" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke="#0a66b7" strokeWidth="14"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
        <text x="50" y="47" textAnchor="middle" fill="#1e293b" fontSize="20" fontWeight="900"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          {pct}%
        </text>
        <text x="50" y="60" textAnchor="middle" fill="#94a3b8" fontSize="8">
          aproveitamento
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-2 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          <span className="text-[10px] font-black text-gray-700">{gols} GOL{gols !== 1 ? 'S' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <span className="text-[10px] font-black text-gray-700">{faltas} FALT{faltas !== 1 ? 'AS' : 'A'}</span>
        </div>
        {foras > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span className="text-[10px] font-black text-gray-700">{foras} FORA{foras !== 1 ? 'S' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── GOAL ZONE ───────────────────────────────────────────────────────────────
function GoalZone({ zone, gols, faltas, onScore, onFoul, onDeleteLast, loading }) {
  const total = gols + faltas
  const pct   = total === 0 ? null : Math.round((gols / total) * 100)

  let bg = 'rgba(255,255,255,0.08)'
  let border = 'rgba(255,255,255,0.15)'
  if (pct !== null) {
    if (pct >= 60) { bg = 'rgba(22,163,74,0.18)'; border = 'rgba(22,163,74,0.5)' }
    else if (pct >= 40) { bg = 'rgba(234,179,8,0.18)'; border = 'rgba(234,179,8,0.5)' }
    else { bg = 'rgba(220,38,38,0.18)'; border = 'rgba(220,38,38,0.5)' }
  }

  return (
    <div
      className="flex flex-col items-center justify-between p-2 rounded-xl transition-all"
      style={{ background: bg, border: `1.5px solid ${border}`, minHeight: 100 }}
    >
      {/* Zone label + stats + undo */}
      <div className="w-full flex items-start justify-between">
        <div className="text-center flex-1">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/60">{zone.label}</p>
          {pct !== null && (
            <p className="text-[15px] font-black text-white leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {pct}%
            </p>
          )}
          {total > 0 && (
            <p className="text-[7px] text-white/40">{gols}/{total}</p>
          )}
        </div>
        {/* Apagar último chute deste quadrante */}
        {total > 0 && (
          <button
            onClick={() => onDeleteLast(zone.id)}
            disabled={loading}
            title="Apagar último chute neste quadrante"
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md transition-all active:scale-90 disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-1.5 w-full mt-1">
        {/* GOL - green */}
        <button
          onClick={() => onScore(zone.id)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-0.5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'rgba(22,163,74,0.85)', color: 'white', boxShadow: '0 2px 8px rgba(22,163,74,0.4)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          GOL
        </button>
        {/* FALTA - red */}
        <button
          onClick={() => onFoul(zone.id)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-0.5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'rgba(220,38,38,0.85)', color: 'white', boxShadow: '0 2px 8px rgba(220,38,38,0.4)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          FALTA
        </button>
      </div>
    </div>
  )
}

// ─── HISTORY ITEM ────────────────────────────────────────────────────────────
function HistoryItem({ entry, onDelete }) {
  const isGol  = entry.resultado === 'gol'
  const isFora = entry.resultado === 'fora'
  const label  = isGol ? 'GOL' : isFora ? 'FORA' : 'FALTA'
  const color  = isGol ? '#0a66b7' : isFora ? '#ea580c' : '#dc2626'
  const bgIcon = isGol ? 'bg-sky-100' : isFora ? 'bg-orange-100' : 'bg-red-100'
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-gray-100 group">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${bgIcon}`}>
        {isGol
          ? <svg viewBox="0 0 24 24" fill="none" stroke="#0a66b7" strokeWidth={3} className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
          : isFora
            ? <svg viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth={3} className="w-3.5 h-3.5"><path d="M5 19L19 5M12 4l7 1-1 7"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={3} className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-800">
          <span style={{ color }}>{label}</span>
          {entry.zona > 0 ? ` · Q${entry.zona}` : ' · Chute fora'}
        </p>
        <p className="text-[8px] text-gray-400">{fmtDate(entry.data?.split?.('T')[0] || entry.data)}</p>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PenaltisPage() {
  const [tipo,       setTipo]       = useState('treino')
  const [aba,        setAba]        = useState('registro') // 'registro' | 'ranking'
  const [athletes,   setAthletes]   = useState([])
  const [atleta,     setAtleta]     = useState(null)
  const [date,       setDate]       = useState(todayStr)
  const [session,    setSession]    = useState([]) // entries for selected atleta+date+tipo
  const [allEntries, setAllEntries] = useState([]) // all entries for atleta+tipo (history)
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  const cfg = TIPO_CFG[tipo]

  // ── Load athletes ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/squad')
      .then(r => r.json())
      .then(d => {
        const list = (d.players || []).filter(p => p.ativo !== false)
        setAthletes(list)
        if (list.length > 0 && !atleta) setAtleta(list[0])
      })
      .catch(() => {})
  }, [])

  // ── Load session entries ──────────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    if (!atleta) return
    setLoading(true)
    try {
      const [sess, all] = await Promise.all([
        fetch(`/api/penaltis?atleta_id=${atleta.id}&tipo=${tipo}&data=${date}`).then(r => r.json()),
        fetch(`/api/penaltis?atleta_id=${atleta.id}&tipo=${tipo}`).then(r => r.json()),
      ])
      setSession(sess.penaltis || [])
      setAllEntries(all.penaltis || [])
    } catch { setError('Erro ao carregar dados.') }
    finally { setLoading(false) }
  }, [atleta, tipo, date])

  useEffect(() => { loadSession() }, [loadSession])

  // ── Register kick ─────────────────────────────────────────────────────────
  const registerKick = async (zona, resultado) => {
    if (!atleta) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/penaltis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atleta_id:   atleta.id,
          atleta_nome: atleta.nome,
          data:        date,
          tipo,
          zona,
          resultado,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      const entry = d.penalti
      setSession(prev  => [entry, ...prev])
      setAllEntries(prev => [entry, ...prev])
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Delete entry ──────────────────────────────────────────────────────────
  const deleteEntry = async (id) => {
    const numId = Number(id)
    // Optimistic UI update
    setSession(prev    => prev.filter(e => Number(e.id) !== numId))
    setAllEntries(prev => prev.filter(e => Number(e.id) !== numId))
    try {
      const res = await fetch(`/api/penaltis/${numId}`, { method: 'DELETE' })
      if (!res.ok) {
        // Revert on failure
        await loadSession()
        setError('Erro ao remover. Tente novamente.')
      }
    } catch {
      await loadSession()
      setError('Erro ao remover. Tente novamente.')
    }
  }

  // ── Delete last kick in a zone ────────────────────────────────────────────
  const deleteLastInZone = async (zonaId) => {
    const zoneEntries = session.filter(e => Number(e.zona) === zonaId)
    if (zoneEntries.length === 0) return
    // session is newest-first, so zoneEntries[0] is the most recent
    await deleteEntry(zoneEntries[0].id)
  }

  // ── Computed stats ────────────────────────────────────────────────────────
  const zoneStats = ZONES.reduce((acc, z) => {
    const zEntries = session.filter(e => Number(e.zona) === z.id)
    acc[z.id] = {
      gols:   zEntries.filter(e => e.resultado === 'gol').length,
      faltas: zEntries.filter(e => e.resultado === 'falta').length,
    }
    return acc
  }, {})

  const totalGols   = session.filter(e => e.resultado === 'gol').length
  const totalFaltas = session.filter(e => e.resultado === 'falta').length
  const totalForas  = session.filter(e => e.resultado === 'fora').length
  const totalKicks  = totalGols + totalFaltas + totalForas

  // All-time stats for this tipo
  const allGols   = allEntries.filter(e => e.resultado === 'gol').length
  const allKicks  = allEntries.length
  const allPct    = allKicks === 0 ? 0 : Math.round((allGols / allKicks) * 100)

  // Group history by date
  const histByDate = allEntries.reduce((acc, e) => {
    const d = e.data?.split?.('T')[0] || e.data
    ;(acc[d] = acc[d] || []).push(e)
    return acc
  }, {})

  return (
    <AppShell>
      <div className="flex flex-col min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-4 pt-4 pb-5"
          style={{ background: `linear-gradient(160deg, ${tipo === 'treino' ? '#166534 0%, #07579e' : '#7f1d1d 0%, #dc2626'} 100%)` }}
        >
          {/* Tipo tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: 'rgba(0,0,0,0.2)' }}>
            {Object.entries(TIPO_CFG).map(([key, c]) => (
              <button
                key={key}
                onClick={() => setTipo(key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                style={tipo === key
                  ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                  : { color: 'rgba(255,255,255,0.45)' }
                }
              >
                <span>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>

          {/* Aba tabs: Registro / Ranking */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: 'rgba(0,0,0,0.2)' }}>
            {[
              { key: 'registro', icon: '🥅', label: 'REGISTRO' },
              { key: 'ranking',  icon: '📊', label: 'RANKING'  },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setAba(tab.key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                style={aba === tab.key
                  ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                  : { color: 'rgba(255,255,255,0.45)' }
                }
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/40 mb-1">Aproveitamento de Pênaltis</p>
          <p className="text-2xl font-black uppercase text-white leading-none mb-4"
             style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {cfg.label} · PÊNALTIS
          </p>

          {/* Atleta + Data */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <label className="block text-[8px] font-black uppercase tracking-widest text-white/50 mb-1">Atleta</label>
              <select
                value={atleta?.id || ''}
                onChange={e => {
                  const found = athletes.find(a => a.id === Number(e.target.value))
                  setAtleta(found || null)
                }}
                className="w-full px-3 py-2.5 rounded-xl text-[11px] font-bold outline-none cursor-pointer appearance-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                {athletes.map(a => (
                  <option key={a.id} value={a.id} style={{ background: '#1e293b', color: 'white' }}>
                    {a.nome} {a.numero ? `· #${a.numero}` : ''} {a.posicao ? `· ${a.posicao}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-white/50 mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-[11px] font-bold outline-none w-full sm:w-auto"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
              />
            </div>
          </div>

          {/* KPIs rápidos */}
          {atleta && (
            <div className="flex gap-2 mt-3">
              {[
                { label: 'Sessão',    val: totalKicks,                unit: 'chutes'   },
                { label: 'Gols',      val: totalGols,                 unit: 'hoje'     },
                { label: 'Foras',     val: totalForas,                unit: 'hoje'     },
                { label: 'Geral',     val: `${allPct}%`,              unit: `${allKicks} chutes` },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-xl px-3 py-2 flex-1"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <p className="text-[7px] font-black uppercase tracking-wider text-white/40">{kpi.label}</p>
                  <p className="text-lg font-black text-white leading-none"
                     style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{kpi.val}</p>
                  <p className="text-[7px] text-white/30">{kpi.unit}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CONTENT ────────────────────────────────────────────────── */}
        {aba === 'ranking' ? (
          <RankingTab tipo={tipo} />
        ) : (
        <div className="flex-1 px-4 py-5 space-y-5 max-w-2xl w-full mx-auto">

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200">
              <p className="text-[9px] font-semibold text-red-600">{error}</p>
            </div>
          )}

          {/* ── GOAL GRID ────────────────────────────────────────────── */}
          {!atleta ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-gray-400 font-semibold">Selecione um atleta acima</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden shadow-lg">
              {/* Goal top bar */}
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ background: tipo === 'treino' ? '#166534' : '#7f1d1d' }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/70">
                  GOL INTERATIVO · {atleta.nome}
                </p>
                {loading && (
                  <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
                )}
              </div>

              {/* Goal visual */}
              <div
                className="p-3"
                style={{
                  background: `radial-gradient(ellipse at center bottom, #07579e 0%, #166534 60%, #14532d 100%)`,
                }}
              >
                {/* Goal frame */}
                <div
                  className="rounded-t-xl overflow-hidden"
                  style={{ border: '4px solid rgba(255,255,255,0.9)', borderBottom: 'none', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }}
                >
                  {/* Net pattern background */}
                  <div
                    className="grid grid-cols-3"
                    style={{
                      background: 'repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(255,255,255,0.08) 18px, rgba(255,255,255,0.08) 20px), repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.08) 18px, rgba(255,255,255,0.08) 20px)',
                      backgroundSize: '20px 20px',
                    }}
                  >
                    {/* Top row */}
                    {ZONES.slice(0, 3).map(zone => (
                      <div key={zone.id} className="p-2"
                        style={{ borderRight: zone.id !== 3 ? '2px solid rgba(255,255,255,0.25)' : 'none', borderBottom: '2px solid rgba(255,255,255,0.25)' }}>
                        <GoalZone
                          zone={zone}
                          gols={zoneStats[zone.id]?.gols || 0}
                          faltas={zoneStats[zone.id]?.faltas || 0}
                          onScore={id => registerKick(id, 'gol')}
                          onFoul={id => registerKick(id, 'falta')}
                          onDeleteLast={deleteLastInZone}
                          loading={saving}
                        />
                      </div>
                    ))}
                    {/* Middle row */}
                    {ZONES.slice(3, 6).map(zone => (
                      <div key={zone.id} className="p-2"
                        style={{ borderRight: zone.id !== 6 ? '2px solid rgba(255,255,255,0.25)' : 'none', borderBottom: '2px solid rgba(255,255,255,0.25)' }}>
                        <GoalZone
                          zone={zone}
                          gols={zoneStats[zone.id]?.gols || 0}
                          faltas={zoneStats[zone.id]?.faltas || 0}
                          onScore={id => registerKick(id, 'gol')}
                          onFoul={id => registerKick(id, 'falta')}
                          onDeleteLast={deleteLastInZone}
                          loading={saving}
                        />
                      </div>
                    ))}
                    {/* Bottom row */}
                    {ZONES.slice(6, 9).map(zone => (
                      <div key={zone.id} className="p-2"
                        style={{ borderRight: zone.id !== 9 ? '2px solid rgba(255,255,255,0.25)' : 'none' }}>
                        <GoalZone
                          zone={zone}
                          gols={zoneStats[zone.id]?.gols || 0}
                          faltas={zoneStats[zone.id]?.faltas || 0}
                          onScore={id => registerKick(id, 'gol')}
                          onFoul={id => registerKick(id, 'falta')}
                          onDeleteLast={deleteLastInZone}
                          loading={saving}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom grass bar */}
                <div className="h-3 rounded-b-sm" style={{ background: '#07579e', borderTop: '3px solid rgba(255,255,255,0.15)' }} />
              </div>

              {/* Legend */}
              <div className="px-4 py-2.5 bg-gray-900 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(22,163,74,0.85)' }} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Verde = GOL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(220,38,38,0.85)' }} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Vermelho = FALTA</span>
                </div>
              </div>

              {/* FORA button */}
              <div className="px-4 py-3 bg-gray-950">
                <button
                  onClick={() => registerKick(0, 'fora')}
                  disabled={saving || !atleta}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: 'rgba(234,88,12,0.85)', color: 'white', boxShadow: '0 2px 10px rgba(234,88,12,0.35)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                    <path d="M5 19L19 5"/>
                    <path d="M12 4l7 1-1 7"/>
                  </svg>
                  Chutou Fora {totalForas > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px]" style={{ background: 'rgba(255,255,255,0.2)' }}>{totalForas}</span>}
                </button>
              </div>
            </div>
          )}

          {/* ── RESUMO DA SESSÃO ───────────────────────────────────── */}
          {atleta && totalKicks > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Resumo · Sessão de hoje</p>
                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {fmtDate(date)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4">
                <DonutChart gols={totalGols} faltas={totalFaltas} foras={totalForas} total={totalKicks} />
                <div className="flex-1 w-full">
                  <div className="grid grid-cols-3 gap-2">
                    {ZONES.map(zone => {
                      const g = zoneStats[zone.id]?.gols || 0
                      const f = zoneStats[zone.id]?.faltas || 0
                      const t = g + f
                      const p = t === 0 ? null : Math.round((g / t) * 100)
                      return (
                        <div key={zone.id} className="rounded-xl p-2.5 text-center"
                          style={{
                            background: p === null ? '#f8fafc' : p >= 60 ? '#f0fdf4' : p >= 40 ? '#fefce8' : '#fef2f2',
                            border: p === null ? '1px solid #e2e8f0' : p >= 60 ? '1px solid #bbf7d0' : p >= 40 ? '1px solid #fde68a' : '1px solid #fecaca',
                          }}>
                          <p className="text-[7px] font-black uppercase tracking-widest text-gray-500">{zone.label}</p>
                          <p className="text-base font-black leading-none mt-0.5"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              color: p === null ? '#94a3b8' : p >= 60 ? '#07579e' : p >= 40 ? '#92400e' : '#b91c1c',
                            }}>
                            {p === null ? '—' : `${p}%`}
                          </p>
                          {t > 0 && <p className="text-[7px] text-gray-400">{g}/{t}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── HISTÓRICO ─────────────────────────────────────────── */}
          {atleta && Object.keys(histByDate).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Histórico · {atleta.nome} · {cfg.label}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">{allPct}% total</span>
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{allKicks} chutes</span>
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {Object.entries(histByDate).slice(0, 10).map(([d, entries]) => {
                  const g = entries.filter(e => e.resultado === 'gol').length
                  const t = entries.length
                  const p = Math.round((g / t) * 100)
                  const isToday = d === date
                  return (
                    <div key={d}>
                      <div className="flex items-center justify-between px-4 py-2"
                        style={{ background: isToday ? '#f0fdf4' : undefined }}>
                        <div className="flex items-center gap-2">
                          {isToday && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />}
                          <p className="text-[9px] font-black text-gray-700">{fmtDate(d)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-gray-500">{g}/{t} gols</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${p >= 60 ? 'bg-sky-100 text-sky-700' : p >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {p}%
                          </span>
                        </div>
                      </div>
                      {isToday && (
                        <div className="px-4 pb-2 space-y-1">
                          {entries.map(entry => (
                            <HistoryItem key={entry.id} entry={entry} onDelete={deleteEntry} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {atleta && allEntries.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-4xl mb-3">⚽</p>
              <p className="text-sm font-black text-gray-400">Nenhum pênalti registrado ainda</p>
              <p className="text-[10px] text-gray-300 mt-1">
                Selecione um quadrante no gol acima para começar
              </p>
            </div>
          )}

          {/* Spacer mobile */}
          <div className="h-8 sm:hidden" />
        </div>
        )}
      </div>
    </AppShell>
  )
}
