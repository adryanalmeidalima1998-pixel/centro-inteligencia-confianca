'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'

const GFC  = '#0a66b7'
const BLUE = '#1565c0'
const AMB  = '#b45309'
const RED  = '#c62828'

// ── Mapear posição PT (monitoramento) → grupo ────────────────────────────────
function posGroupFromPT(posStr) {
  const p = (posStr || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (p.includes('goleiro') || /\bgk\b/.test(p))            return 'GK'
  if (p.includes('zagueiro') || /\bcb\b/.test(p))           return 'CB'
  if (p.includes('lateral'))                                  return 'FB'
  if (p.includes('volante') || /\b(dm|cdm)\b/.test(p))      return 'DM'
  if (p.includes('meia atacante') || /\bcam\b/.test(p))     return 'AM'
  if (p.includes('meia') || /\bcm\b/.test(p))               return 'CM'
  if (p.includes('ponta') || p.includes('extremo') || /\b[lr]w\b/.test(p)) return 'WI'
  if (p.includes('centroavante') || p.includes('atacante') || /\b(cf|st)\b/.test(p)) return 'CF'
  return 'CM'
}

// ── Mapear grupo → grupo Wyscout ─────────────────────────────────────────────
function posGroupFromWyscout(posStr) {
  const p = (posStr || '').toUpperCase()
  if (/\bGK\b/.test(p))                               return 'GK'
  if (/\b(LCB|RCB|CB)\b/.test(p))                     return 'CB'
  if (/\b(LB|RB|LWB|RWB)\b/.test(p))                  return 'FB'
  if (/\b(DMF|LDMF|RDMF)\b/.test(p))                  return 'DM'
  if (/\b(CMF|LCMF|RCMF)\b/.test(p))                  return 'CM'
  if (/\b(AMF|LAMF|RAMF)\b/.test(p))                  return 'AM'
  if (/\b(LW|RW|LWF|RWF)\b/.test(p))                  return 'WI'
  if (/\b(CF|SS)\b/.test(p))                           return 'CF'
  return 'CM'
}

// ── Métricas por grupo (6 dimensões para radar) ──────────────────────────────
const RADAR_METRICS = {
  GK: [
    { key: 'defesas_pct',     label: 'Defesas %',     max: 100, inv: false },
    { key: 'gols_sofridos_90',label: 'Gols Sof./90',  max: 2,   inv: true  },
    { key: 'xg_contra_90',   label: 'xG Contra/90',  max: 2,   inv: true  },
    { key: 'saidas_90',       label: 'Saídas/90',     max: 3,   inv: false },
    { key: 'duelos_aereos_pct',label: 'Aéreos %',     max: 100, inv: false },
    { key: 'passes_pct',      label: 'Passes %',      max: 100, inv: false },
  ],
  CB: [
    { key: 'duelos_def_pct',  label: 'Duelos Def %',  max: 100, inv: false },
    { key: 'duelos_aereos_pct',label: 'Aéreos %',     max: 100, inv: false },
    { key: 'intercepoes_90',  label: 'Interce./90',   max: 6,   inv: false },
    { key: 'acoes_def_90',    label: 'Ações Def/90',  max: 10,  inv: false },
    { key: 'passes_prog_90',  label: 'Passes Prog/90',max: 6,   inv: false },
    { key: 'passes_pct',      label: 'Passes %',      max: 100, inv: false },
  ],
  FB: [
    { key: 'duelos_def_pct',  label: 'Duelos Def %',  max: 100, inv: false },
    { key: 'cruzamentos_90',  label: 'Cruzamentos/90',max: 5,   inv: false },
    { key: 'corridas_prog_90',label: 'Corridas Prog/90',max:6,  inv: false },
    { key: 'assists_90',      label: 'Assistências/90',max:0.3, inv: false },
    { key: 'passes_prog_90',  label: 'Passes Prog/90',max: 6,   inv: false },
    { key: 'acoes_def_90',    label: 'Ações Def/90',  max: 10,  inv: false },
  ],
  DM: [
    { key: 'intercepoes_90',  label: 'Interce./90',   max: 6,   inv: false },
    { key: 'acoes_def_90',    label: 'Ações Def/90',  max: 10,  inv: false },
    { key: 'passes_90',       label: 'Passes/90',     max: 70,  inv: false },
    { key: 'passes_pct',      label: 'Passes %',      max: 100, inv: false },
    { key: 'duelos_def_pct',  label: 'Duelos Def %',  max: 100, inv: false },
    { key: 'passes_prog_90',  label: 'Passes Prog/90',max: 8,   inv: false },
  ],
  CM: [
    { key: 'passes_chave_90', label: 'Passes Chave/90',max:2.5, inv: false },
    { key: 'assists_90',      label: 'Assistências/90',max:0.4, inv: false },
    { key: 'passes_prog_90',  label: 'Passes Prog/90',max: 8,   inv: false },
    { key: 'intercepoes_90',  label: 'Interce./90',   max: 5,   inv: false },
    { key: 'duelos_pct',      label: 'Duelos %',      max: 100, inv: false },
    { key: 'dribles_pct',     label: 'Dribles %',     max: 100, inv: false },
  ],
  AM: [
    { key: 'passes_chave_90', label: 'Passes Chave/90',max:2.5, inv: false },
    { key: 'xg_90',           label: 'xG/90',          max: 0.5,inv: false },
    { key: 'assists_90',      label: 'Assistências/90', max:0.4, inv: false },
    { key: 'dribles_pct',     label: 'Dribles %',       max:100, inv: false },
    { key: 'corridas_prog_90',label: 'Corridas Prog/90',max: 6,  inv: false },
    { key: 'toques_area_90',  label: 'Toques Área/90',  max: 5,  inv: false },
  ],
  WI: [
    { key: 'dribles_pct',     label: 'Dribles %',       max:100, inv: false },
    { key: 'cruzamentos_90',  label: 'Cruzamentos/90',  max: 5,  inv: false },
    { key: 'gols_90',         label: 'Gols/90',          max:0.5, inv: false },
    { key: 'assists_90',      label: 'Assistências/90',  max:0.3, inv: false },
    { key: 'corridas_prog_90',label: 'Corridas Prog/90', max: 8,  inv: false },
    { key: 'xg_90',           label: 'xG/90',             max:0.4, inv: false },
  ],
  CF: [
    { key: 'gols_90',         label: 'Gols/90',           max:0.7, inv: false },
    { key: 'xg_90',           label: 'xG/90',              max:0.7, inv: false },
    { key: 'remates_90',      label: 'Remates/90',         max: 4,  inv: false },
    { key: 'toques_area_90',  label: 'Toques Área/90',     max: 6,  inv: false },
    { key: 'duelos_aereos_pct',label:'Aéreos %',           max:100, inv: false },
    { key: 'dribles_pct',     label: 'Dribles %',          max:100, inv: false },
  ],
}

// ── Dimensões de performance completas ───────────────────────────────────────
const DIMENSOES = [
  { cat: 'Ataque',     metrics: [
    { key:'gols_90', label:'Gols/90' }, { key:'xg_90', label:'xG/90' },
    { key:'remates_90', label:'Remates/90' }, { key:'remates_baliza_pct', label:'Remates Baliza %' },
    { key:'toques_area_90', label:'Toques Área/90' }, { key:'assists_90', label:'Assists/90' },
    { key:'xa_90', label:'xA/90' },
  ]},
  { cat: 'Passes',     metrics: [
    { key:'passes_90', label:'Passes/90' }, { key:'passes_pct', label:'Passes %' },
    { key:'passes_prog_90', label:'Passes Prog/90' }, { key:'passes_chave_90', label:'Passes Chave/90' },
    { key:'passes_tercofinal_90', label:'Passes Terço/90' }, { key:'passes_area_90', label:'Passes Área/90' },
    { key:'passes_longos_90', label:'Passes Longos/90' }, { key:'passes_longos_pct', label:'Passes Longos %' },
  ]},
  { cat: 'Ações Ind.', metrics: [
    { key:'dribles_90', label:'Dribles/90' }, { key:'dribles_pct', label:'Dribles %' },
    { key:'corridas_prog_90', label:'Corridas Prog/90' }, { key:'aceleracoes_90', label:'Acelerações/90' },
    { key:'cruzamentos_90', label:'Cruzamentos/90' }, { key:'cruzamentos_pct', label:'Cruzamentos %' },
  ]},
  { cat: 'Defesa',     metrics: [
    { key:'duelos_def_90', label:'Duelos Def/90' }, { key:'duelos_def_pct', label:'Duelos Def %' },
    { key:'duelos_aereos_pct', label:'Aéreos %' }, { key:'intercepoes_90', label:'Interc./90' },
    { key:'acoes_def_90', label:'Ações Def/90' }, { key:'cortes_90', label:'Cortes/90' },
    { key:'faltas_90', label:'Faltas/90' },
  ]},
  { cat: 'GK',         metrics: [
    { key:'defesas_pct', label:'Defesas %' }, { key:'gols_sofridos_90', label:'Gols Sof/90' },
    { key:'xg_contra_90', label:'xG Contra/90' }, { key:'saidas_90', label:'Saídas/90' },
  ]},
]

// ── Converter T (aggregate) do monitoramento para formato benchmark ───────────
function tToBenchmark(T, minutos) {
  if (!T || !minutos) return {}
  const m = minutos
  const s = (v, d=0) => { const n = parseFloat(v); return isNaN(n) ? null : n }
  const r90 = (v) => m > 0 ? Math.round((s(v, 0) / m) * 90 * 100) / 100 : null
  return {
    gols_90:           r90(T.gols),
    xg_90:             r90(T.xg),
    assists_90:        r90(T.assists),
    xa_90:             r90(T.xa),
    remates_90:        r90(T.remates_totais),
    remates_baliza_pct: T.remates_totais > 0 ? Math.round(T.remates_baliza / T.remates_totais * 100) : null,
    passes_90:         r90(T.passes_totais),
    passes_pct:        T.passes_totais > 0 ? Math.round(T.passes_certos / T.passes_totais * 100) : null,
    passes_prog_90:    r90(T.passes_prof),
    passes_chave_90:   r90(T.assist_remate),
    passes_tercofinal_90: r90(T.passes_terco),
    passes_area_90:    r90(T.passes_area),
    passes_longos_90:  r90(T.passes_longos),
    passes_longos_pct: T.passes_longos > 0 ? Math.round(T.passes_longos_certos / T.passes_longos * 100) : null,
    dribles_90:        r90(T.dribbles),
    dribles_pct:       T.dribbles > 0 ? Math.round(T.dribbles_ok / T.dribbles * 100) : null,
    corridas_prog_90:  r90(T.corridas),
    aceleracoes_90:    null,
    cruzamentos_90:    r90(T.cruzamentos),
    cruzamentos_pct:   T.cruzamentos > 0 ? Math.round(T.cruzamentos_certos / T.cruzamentos * 100) : null,
    duelos_def_90:     r90(T.duelos_def),
    duelos_def_pct:    T.duelos_def > 0 ? Math.round(T.duelos_def_ganhos / T.duelos_def * 100) : null,
    duelos_aereos_pct: T.duelos_aereos > 0 ? Math.round(T.duelos_aereos_ganhos / T.duelos_aereos * 100) : null,
    intercepoes_90:    r90(T.intercepcoes),
    acoes_def_90:      r90(T.acoes_ok),
    cortes_90:         r90(T.carrinhos),
    toques_area_90:    r90(T.toques_area),
    duelos_pct:        T.duelos > 0 ? Math.round(T.duelos_ganhos / T.duelos * 100) : null,
    faltas_90:         r90(T.faltas),
  }
}

// ── Percentil de um valor dentro de um array ─────────────────────────────────
function calcPercentil(val, arr) {
  if (val === null || val === undefined || !arr.length) return null
  const sorted = arr.filter(v => v !== null && !isNaN(v)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const rank = sorted.filter(v => v <= val).length
  return Math.round((rank / sorted.length) * 100)
}

// ── Normalizar para radar (0-100) ─────────────────────────────────────────────
function normalize(val, max, inv = false) {
  if (val === null || val === undefined || isNaN(val)) return 0
  const pct = Math.min(100, Math.max(0, (val / max) * 100))
  return inv ? Math.max(0, 100 - pct) : pct
}

// ── Média de uma métrica num array de jogadores ───────────────────────────────
function avg(players, key) {
  const vals = players.map(p => p[key]).filter(v => v !== null && !isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabComparacao({ atleta, T }) {
  const [guaraniPlayers, setGuaraniPlayers]  = useState([])
  const [serieCPlayers,  setSerieCPlayers]   = useState([])
  const [loadingG,       setLoadingG]        = useState(false)
  const [loadingS,       setLoadingS]        = useState(false)
  const [selectedG,      setSelectedG]       = useState([])
  const [uploadStatus,   setUploadStatus]    = useState({ guarani: null, serie_c: null })

  const posGrupo = posGroupFromPT(atleta.posicao || '')
  const metrics  = RADAR_METRICS[posGrupo] || RADAR_METRICS.CM

  // Dados do atleta convertidos
  const atletaStats = useMemo(() => {
    if (!T) return {}
    return tToBenchmark(T, T.minutos)
  }, [T])

  // Carrega dados do benchmark
  useEffect(() => {
    fetch('/api/wyscout-benchmark').then(r => r.json()).then(d => {
      setUploadStatus(d.status || {})
    }).catch(() => {})

    setLoadingG(true)
    fetch('/api/wyscout-benchmark?tipo=guarani')
      .then(r => r.json())
      .then(d => { setGuaraniPlayers(d.players || []); setLoadingG(false) })
      .catch(() => setLoadingG(false))

    setLoadingS(true)
    fetch('/api/wyscout-benchmark?tipo=serie_c')
      .then(r => r.json())
      .then(d => { setSerieCPlayers(d.players || []); setLoadingS(false) })
      .catch(() => setLoadingS(false))
  }, [])

  // Série C filtrado pela posição do atleta
  const serieCPosicao = useMemo(() =>
    serieCPlayers.filter(p => posGroupFromWyscout(p.posicao) === posGrupo),
    [serieCPlayers, posGrupo]
  )

  // Média da Série C para a posição
  const serieCMedia = useMemo(() => {
    if (!serieCPosicao.length) return {}
    const result = {}
    metrics.forEach(m => { result[m.key] = avg(serieCPosicao, m.key) })
    return result
  }, [serieCPosicao, metrics])

  // Jogadores Confiança selecionados
  const guaraniSelecionados = useMemo(() =>
    guaraniPlayers.filter(p => selectedG.includes(p.nome)),
    [guaraniPlayers, selectedG]
  )

  // Dados radar
  const radarData = useMemo(() => metrics.map(m => {
    const point = { metric: m.label, atleta: normalize(atletaStats[m.key], m.max, m.inv) }
    guaraniSelecionados.forEach(p => {
      point[p.nome] = normalize(p[m.key], m.max, m.inv)
    })
    point['Série C (média)'] = normalize(serieCMedia[m.key], m.max, m.inv)
    return point
  }), [metrics, atletaStats, guaraniSelecionados, serieCMedia])

  // Pontos fortes e fracos vs Série C
  const { fortes, fracos } = useMemo(() => {
    if (!serieCPosicao.length) return { fortes: [], fracos: [] }
    const allMetrics = metrics.map(m => {
      const atletaVal = atletaStats[m.key]
      const scMedia   = serieCMedia[m.key]
      if (atletaVal === null || scMedia === null || scMedia === 0) return null
      const diff = m.inv
        ? ((scMedia - atletaVal) / scMedia) * 100
        : ((atletaVal - scMedia) / scMedia) * 100
      return { label: m.label, atletaVal, scMedia, diff, key: m.key, inv: m.inv }
    }).filter(Boolean).sort((a, b) => b.diff - a.diff)

    return {
      fortes: allMetrics.filter(m => m.diff > 0).slice(0, 4),
      fracos: allMetrics.filter(m => m.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 4),
    }
  }, [metrics, atletaStats, serieCMedia, serieCPosicao])

  // Percentis do atleta na Série C
  const percentis = useMemo(() => {
    if (!serieCPosicao.length) return {}
    const result = {}
    metrics.forEach(m => {
      const vals = serieCPosicao.map(p => p[m.key]).filter(v => v !== null && !isNaN(v))
      result[m.key] = calcPercentil(atletaStats[m.key], vals)
    })
    return result
  }, [serieCPosicao, metrics, atletaStats])

  const fmt = (v) => v === null || v === undefined ? '—' : (typeof v === 'number' ? (v % 1 === 0 ? v : v.toFixed(2)) : v)

  const COLORS = [GFC, BLUE, AMB, '#7b1fa2', '#00796b']

  if (!T) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 12 }}>
      Faça upload da planilha do atleta para habilitar a comparação.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Upload status */}
      {(!uploadStatus.guarani || !uploadStatus.serie_c) && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#92400e' }}>
          ⚠ {!uploadStatus.guarani ? 'Dados do Confiança não carregados.' : ''}{!uploadStatus.serie_c ? ' Dados da Série C não carregados.' : ''}{' '}
          Use os botões de upload no topo da página para carregar os Excel.
        </div>
      )}

      {/* ── GRID PRINCIPAL: Radar Confiança + Radar Série C ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Radar vs Confiança */}
        <div style={{ background: '#fff', border: '1px solid #e5edf5', borderRadius: 14, padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#10233b', marginBottom: 10 }}>
            🟢 vs Elenco Confiança
          </p>

          {/* Seletor de jogadores */}
          {loadingG ? (
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>Carregando elenco...</p>
          ) : guaraniPlayers.length === 0 ? (
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>Nenhum dado do Confiança carregado.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {guaraniPlayers.map((p, i) => {
                const sel = selectedG.includes(p.nome)
                return (
                  <button key={i} onClick={() => setSelectedG(prev =>
                    sel ? prev.filter(n => n !== p.nome) : [...prev, p.nome].slice(0, 3)
                  )} style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                    border: `1.5px solid ${sel ? BLUE : '#e5edf5'}`,
                    background: sel ? '#eff6ff' : '#f8fdf9',
                    color: sel ? BLUE : '#64748b',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {p.nome?.split(' ').slice(0, 2).join(' ')}
                    {p.posicao ? ` · ${p.posicao.split(',')[0]}` : ''}
                  </button>
                )
              })}
            </div>
          )}

          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5edf5" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#64748b' }} />
              <Radar name={atleta.apelido || atleta.nome} dataKey="atleta" stroke={GFC} fill={GFC} fillOpacity={0.18} strokeWidth={2} />
              {guaraniSelecionados.map((p, i) => (
                <Radar key={p.nome} name={p.nome.split(' ').slice(0, 2).join(' ')} dataKey={p.nome} stroke={COLORS[i + 1]} fill={COLORS[i + 1]} fillOpacity={0.12} strokeWidth={1.5} />
              ))}
              <Tooltip formatter={(v) => `${Math.round(v)}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar vs Série C */}
        <div style={{ background: '#fff', border: '1px solid #e5edf5', borderRadius: 14, padding: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#10233b', marginBottom: 4 }}>
            📊 vs Série C — {posGrupo}
          </p>
          <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
            {loadingS ? 'Carregando...' : `${serieCPosicao.length} jogadores na base para ${posGrupo}`}
          </p>

          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5edf5" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#64748b' }} />
              <Radar name={atleta.apelido || atleta.nome} dataKey="atleta" stroke={GFC} fill={GFC} fillOpacity={0.22} strokeWidth={2} />
              <Radar name="Média Série C" dataKey="Série C (média)" stroke={AMB} fill={AMB} fillOpacity={0.12} strokeWidth={1.5} strokeDasharray="4 2" />
              <Tooltip formatter={(v) => `${Math.round(v)}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>

          {/* Percentis */}
          {serieCPosicao.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 8 }}>
              {metrics.map(m => {
                const pct = percentis[m.key]
                const color = pct >= 75 ? GFC : pct >= 50 ? AMB : pct !== null ? RED : '#94a3b8'
                return (
                  <div key={m.key} style={{ background: '#f7fcf9', borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1 }}>
                      {pct !== null ? `P${pct}` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Pontos Fortes e a Melhorar ── */}
      {serieCPosicao.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: GFC, marginBottom: 10 }}>✅ 4 Pontos Fortes vs Série C</p>
            {fortes.length === 0 ? (
              <p style={{ fontSize: 11, color: '#94a3b8' }}>Dados insuficientes</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fortes.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: GFC, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: 'white' }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: '#52677e' }}>
                        {fmt(m.atletaVal)} vs {fmt(m.scMedia)} médio
                        <span style={{ marginLeft: 6, color: GFC, fontWeight: 700 }}>
                          +{Math.round(m.diff)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ background: '#dcfce7', color: '#166534', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                      P{percentis[m.key] ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: RED, marginBottom: 10 }}>🎯 4 Pontos a Melhorar</p>
            {fracos.length === 0 ? (
              <p style={{ fontSize: 11, color: '#94a3b8' }}>Dados insuficientes</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fracos.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: 'white' }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b' }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: '#7f1d1d' }}>
                        {fmt(m.atletaVal)} vs {fmt(m.scMedia)} médio
                        <span style={{ marginLeft: 6, color: RED, fontWeight: 700 }}>
                          {Math.round(m.diff)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                      P{percentis[m.key] ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dimensões de Performance — Tabela lateral a lateral ── */}
      <div style={{ background: '#fff', border: '1px solid #e5edf5', borderRadius: 14, padding: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#10233b', marginBottom: 12 }}>
          📋 Dimensões de Performance — Estatísticas Lado a Lado
        </p>

        {DIMENSOES.filter(d => d.cat !== 'GK' || posGrupo === 'GK').map(dim => {
          const visibleMetrics = dim.metrics.filter(m =>
            atletaStats[m.key] !== null || serieCMedia[m.key] !== null
          )
          if (!visibleMetrics.length) return null
          return (
            <div key={dim.cat} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f1f5f9' }}>
                {dim.cat}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f7fcf9' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Métrica</th>
                    <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: 9, fontWeight: 700, color: GFC, textTransform: 'uppercase' }}>
                      {atleta.apelido || atleta.nome}
                    </th>
                    {guaraniSelecionados.slice(0, 2).map((p, i) => (
                      <th key={i} style={{ textAlign: 'center', padding: '4px 8px', fontSize: 9, fontWeight: 700, color: COLORS[i + 1], textTransform: 'uppercase' }}>
                        {p.nome?.split(' ').slice(0, 1).join(' ')}
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: 9, fontWeight: 700, color: AMB, textTransform: 'uppercase' }}>
                      Série C (méd.)
                    </th>
                    <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      Percentil
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMetrics.map((m, mi) => {
                    const atletaV  = atletaStats[m.key]
                    const scV      = serieCMedia[m.key]
                    const pct      = percentis[m.key]
                    const isBetter = atletaV !== null && scV !== null && atletaV > scV
                    return (
                      <tr key={m.key} style={{ borderBottom: '1px solid #f1f5f9', background: mi % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '5px 8px', color: '#52677e', fontWeight: 600 }}>{m.label}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 800, color: isBetter ? GFC : '#10233b' }}>
                          {fmt(atletaV)}
                        </td>
                        {guaraniSelecionados.slice(0, 2).map((p, i) => (
                          <td key={i} style={{ padding: '5px 8px', textAlign: 'center', color: COLORS[i + 1], fontWeight: 600 }}>
                            {fmt(p[m.key])}
                          </td>
                        ))}
                        <td style={{ padding: '5px 8px', textAlign: 'center', color: AMB, fontWeight: 600 }}>
                          {fmt(scV)}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          {pct !== null && pct !== undefined ? (
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                              background: pct >= 75 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#fee2e2',
                              color: pct >= 75 ? '#166534' : pct >= 50 ? '#92400e' : '#991b1b',
                            }}>P{pct}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
