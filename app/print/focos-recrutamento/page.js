'use client'

import { useState, useEffect, Suspense } from 'react'

const BRAND_PRIMARY  = '#0a66b7'
const BRAND_DARK = '#064b82'

// ─── HELPERS ────────────────────────────────────────────────────────────────
function fmt(v, d = 2) { const n = parseFloat(v); return isNaN(n) ? '—' : n % 1 === 0 ? String(n) : n.toFixed(d) }

function fitColor(s) {
  if (!s && s !== 0) return { bg: '#f8fafc', c: '#94a3b8', label: '—' }
  if (s >= 85) return { bg: '#fef3c7', c: '#92400e', label: 'Elite' }
  if (s >= 70) return { bg: '#f0fdf4', c: BRAND_PRIMARY,       label: 'Forte' }
  if (s >= 55) return { bg: '#eff6ff', c: '#1d4ed8',  label: 'Viável' }
  return { bg: '#f8fafc', c: '#64748b', label: 'Baixo' }
}

function priColor(p) {
  return { Alta: { bg: '#fee2e2', c: '#991b1b' }, Média: { bg: '#fef3c7', c: '#92400e' }, Baixa: { bg: '#f1f5f9', c: '#64748b' } }[p] || { bg: '#f1f5f9', c: '#64748b' }
}

function etapaColor(e) {
  const m = {
    'Identificados':      { bg: '#f1f5f9', c: '#475569' },
    'Análise em vídeo':   { bg: '#eff6ff', c: '#1d4ed8' },
    'Observação ao vivo': { bg: '#fef3c7', c: '#92400e' },
    'Pré-lista':          { bg: '#f3e8ff', c: '#6b21a8' },
    'Alvo prioritário':   { bg: '#f0fdf4', c: BRAND_PRIMARY       },
    'Acompanhamento':     { bg: '#dcfce7', c: '#166534' },
  }
  return m[e] || { bg: '#f1f5f9', c: '#64748b' }
}

// ─── SVG: Gráfico de Pizza ──────────────────────────────────────────────────
function PieChart({ data, size = 70 }) {
  // data: [{label, value, color}]
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 8, color: '#94a3b8' }}>—</span></div>

  const cx = size / 2, cy = size / 2, r = size / 2 - 2
  let paths = []
  let angle = -Math.PI / 2

  data.forEach(d => {
    if (!d.value) return
    const slice = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(angle + slice)
    const y2 = cy + r * Math.sin(angle + slice)
    const large = slice > Math.PI ? 1 : 0
    paths.push(
      <path key={d.label}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={d.color} stroke="white" strokeWidth={1} />
    )
    angle += slice
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  )
}

// ─── SVG: Barra horizontal ──────────────────────────────────────────────────
function BarH({ value, max = 100, color = BRAND_PRIMARY, height = 6, width = 80 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x={0} y={0} width={width} height={height} rx={3} fill="#f1f5f9" />
      <rect x={0} y={0} width={(pct / 100) * width} height={height} rx={3} fill={color} />
    </svg>
  )
}

// ─── SVG: Radar / Spider chart ──────────────────────────────────────────────
function RadarChart({ metricas, jogador, size = 100 }) {
  // metricas: [{label, valor, meta}]
  const n = metricas.length
  if (n < 3) return null
  const cx = size / 2, cy = size / 2, r = size / 2 - 14

  const angles = metricas.map((_, i) => (2 * Math.PI * i / n) - Math.PI / 2)

  const gridLevels = [0.25, 0.5, 0.75, 1.0]
  const gridPaths = gridLevels.map(level => {
    const pts = angles.map(a => `${cx + r * level * Math.cos(a)},${cy + r * level * Math.sin(a)}`).join(' ')
    return <polygon key={level} points={pts} fill="none" stroke="#e2e8f0" strokeWidth={0.8} />
  })

  const axes = angles.map((a, i) => (
    <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#e2e8f0" strokeWidth={0.8} />
  ))

  const vals = metricas.map((m, i) => {
    const pct = m.meta > 0 ? Math.min(1, (parseFloat(m.valor) || 0) / m.meta) : 0
    const a = angles[i]
    return `${cx + r * pct * Math.cos(a)},${cy + r * pct * Math.sin(a)}`
  })
  const dataPath = vals.join(' ')

  const labels = metricas.map((m, i) => {
    const a = angles[i]
    const lx = cx + (r + 10) * Math.cos(a)
    const ly = cy + (r + 10) * Math.sin(a)
    return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={5} fill="#64748b" fontWeight={700}>{m.label}</text>
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridPaths}
      {axes}
      <polygon points={dataPath} fill={`${BRAND_PRIMARY}33`} stroke={BRAND_PRIMARY} strokeWidth={1.5} />
      {labels}
      {vals.map((pt, i) => {
        const [px, py] = pt.split(',')
        return <circle key={i} cx={px} cy={py} r={2} fill={BRAND_PRIMARY} />
      })}
    </svg>
  )
}

// ─── MINI COMPONENTES ────────────────────────────────────────────────────────
function Badge({ text, bg, color, size = 6.5 }) {
  if (!text) return null
  return <span style={{ background: bg, color, padding: '2px 6px', borderRadius: 4, fontWeight: 800, fontSize: size, display: 'inline-block', whiteSpace: 'nowrap' }}>{text}</span>
}

function SecTitle({ children, accent = BRAND_PRIMARY }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155' }}>{children}</span>
    </div>
  )
}

function PageHeader({ page, total, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/confianca.png" alt="" style={{ height: 30, width: 'auto' }} />
        <div>
          <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>CIC · Focos de Recrutamento · Pág. {page}/{total}</div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>{title}</div>
        </div>
      </div>
      {sub && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{sub}</span>}
    </div>
  )
}

function PageFooter({ page, total, geradoEm }) {
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · {geradoEm} · Confidencial</span>
      <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>{page} / {total}</span>
    </div>
  )
}

// ─── CONTEÚDO PRINCIPAL ──────────────────────────────────────────────────────
function PrintContent() {
  const [loading,    setLoading]    = useState(true)
  const [focos,      setFocos]      = useState([])
  const [pipelines,  setPipelines]  = useState({}) // foco_id → kanban
  const [candidatos, setCandidatos] = useState({}) // foco_id → array

  useEffect(() => {
    fetch('/api/focos-recrutamento')
      .then(r => r.json())
      .then(async d => {
        const fcs = d.focos || []
        setFocos(fcs)

        // Buscar pipeline de cada foco em paralelo
        const pipRes = await Promise.allSettled(
          fcs.map(f => fetch(`/api/candidatos-pipeline?foco_id=${f.id}`).then(r => r.json()))
        )
        const pipMap = {}
        const candMap = {}
        pipRes.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            pipMap[fcs[i].id] = r.value.kanban || {}
            // Flatten all candidatos
            const all = Object.values(r.value.kanban || {}).flat()
            candMap[fcs[i].id] = all
          }
        })
        setPipelines(pipMap)
        setCandidatos(candMap)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const now       = new Date()
  const dateStr   = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const geradoEm  = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const focosAtivos   = focos.filter(f => f.status !== 'Concluído')
  const totalCand     = Object.values(candidatos).flat().length
  const alvos         = Object.values(candidatos).flat().filter(c => c.etapa === 'Alvo prioritário').length
  const preLista      = Object.values(candidatos).flat().filter(c => c.etapa === 'Pré-lista').length

  // Distribuição por prioridade para pizza
  const distPri = focos.reduce((acc, f) => {
    acc[f.prioridade] = (acc[f.prioridade] || 0) + 1
    return acc
  }, {})
  const pieDataPri = [
    { label: 'Alta',  value: distPri['Alta']  || 0, color: '#dc2626' },
    { label: 'média', value: distPri['Média'] || 0, color: '#f59e0b' },
    { label: 'Baixa', value: distPri['Baixa'] || 0, color: '#94a3b8' },
  ].filter(d => d.value > 0)

  // Distribuição por grupo posicional para pizza
  const distPos = focos.reduce((acc, f) => {
    const k = f.pos_grupo || f.posicao || 'Outro'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const posColors = { Goleiro: '#92400e', Defensor: '#1e40af', Médio: '#6d28d9', Extremo: '#be185d', Atacante: '#dc2626', Outro: '#94a3b8' }
  const pieDataPos = Object.entries(distPos).map(([k, v]) => ({ label: k, value: v, color: posColors[k] || '#64748b' }))

  // Distribuição etapas (todos os candidatos)
  const allCand = Object.values(candidatos).flat()
  const etapas = ['Identificados', 'Análise em vídeo', 'Observação ao vivo', 'Pré-lista', 'Alvo prioritário', 'Acompanhamento']
  const distEtapa = etapas.reduce((acc, e) => { acc[e] = allCand.filter(c => c.etapa === e).length; return acc }, {})
  const etapaColors = { 'Identificados': '#94a3b8', 'Análise em vídeo': '#3b82f6', 'Observação ao vivo': '#f59e0b', 'Pré-lista': '#8b5cf6', 'Alvo prioritário': BRAND_PRIMARY, 'Acompanhamento': '#16a34a' }
  const pieDataEtapa = etapas.map(e => ({ label: e.replace(' ', '\n'), value: distEtapa[e], color: etapaColors[e] })).filter(d => d.value > 0)

  // Número total de páginas: 1 capa + 1 por cada foco
  const totalPages = 1 + focosAtivos.length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter,sans-serif', color: '#94a3b8', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      Preparando relatório de focos...
    </div>
  )

  return (
    <>
      {/* ─── CAPA ─── */}
      <div style={{ pageBreakAfter: 'always', padding: '40px', fontFamily: 'Inter,sans-serif', background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <img src="/confianca.png" alt="" style={{ height: 80, width: 'auto', marginBottom: 40 }} />
          <div style={{ marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: BRAND_PRIMARY, marginBottom: 8 }}>CIC · Centro de Inteligência de Recrutamento</div>
            <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 48, fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', margin: '0 0 20px 0', lineHeight: 1.1 }}>Focos de Recrutamento</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Relatório consolidado de oportunidades e candidatos</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 12 }}>Resumo Executivo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 12, color: '#475569' }}>Focos Ativos</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: BRAND_PRIMARY }}>{focosAtivos.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 12, color: '#475569' }}>Candidatos Identificados</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#1d4ed8' }}>{totalCand}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 12, color: '#475569' }}>Alvos Prioritários</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#dc2626' }}>{alvos}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#475569' }}>Pré-lista</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#92400e' }}>{preLista}</span>
              </div>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 12 }}>Distribuição</p>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              {pieDataPri.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChart data={pieDataPri} size={60} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {pieDataPri.map(d => (
                      <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#475569' }}>{d.label} ({d.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
            <span>Confiança · CIC</span>
            <span>{dateStr}</span>
          </div>
        </div>
      </div>

      {/* ─── PÁGINAS DE FOCOS ─── */}
      {focosAtivos.map((foco, focoIdx) => {
        const pageNum = focoIdx + 2
        const candsFoco = candidatos[foco.id] || []
        const topCands = candsFoco.slice(0, 10)
        const topCand = topCands[0]

        // Métricas para o radar
        const metricas = (foco.metricas_pesos || []).slice(0, 5).map(m => {
          const topVal = topCand ? parseFloat(topCand[m.metrica]) || 0 : 0
          return { label: m.label || m.metrica, valor: topVal, meta: m.meta }
        })

        // Distribuição etapas deste foco
        const distEtapaFoco = etapas.map(e => ({
          label: e.replace(' ', '\n'),
          value: candsFoco.filter(c => c.etapa === e).length,
          color: etapaColors[e],
        })).filter(d => d.value > 0)

        // Distribuição fit score
        const fitDist = [
          { label: 'Elite', value: candsFoco.filter(c => c.fit_score >= 85).length, color: '#fef3c7' },
          { label: 'Forte', value: candsFoco.filter(c => c.fit_score >= 70 && c.fit_score < 85).length, color: '#f0fdf4' },
          { label: 'Viável', value: candsFoco.filter(c => c.fit_score >= 55 && c.fit_score < 70).length, color: '#eff6ff' },
          { label: 'Baixo', value: candsFoco.filter(c => c.fit_score < 55).length, color: '#f8fafc' },
        ].filter(d => d.value > 0)

        return (
          <div key={foco.id} style={{ pageBreakAfter: 'always', padding: '40px', fontFamily: 'Inter,sans-serif', background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <PageHeader page={pageNum} total={totalPages} title={foco.nome} sub={foco.prioridade} />

            {/* Grid de resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px' }}>
                <SecTitle>Candidatos</SecTitle>
                <div style={{ fontSize: 20, fontWeight: 900, color: BRAND_PRIMARY }}>{candsFoco.length}</div>
                <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>Total identificados</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px' }}>
                <SecTitle accent="#92400e">Top Fit Score</SecTitle>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#92400e' }}>{topCand?.fit_score ?? '—'}</div>
                <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>{topCand?.jogador || 'Sem dados'}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px' }}>
                <SecTitle accent="#1d4ed8">Alvos Prioritários</SecTitle>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1d4ed8' }}>{candsFoco.filter(c => c.etapa === 'Alvo prioritário').length}</div>
                <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>Em fase avançada</div>
              </div>
            </div>

            {/* Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {/* Pizza: etapas */}
              <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px' }}>
                <SecTitle>Distribuição Etapas</SecTitle>
                {distEtapaFoco.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 8, textAlign: 'center', padding: '16px 0' }}>Sem dados</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PieChart data={distEtapaFoco} size={70} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {distEtapaFoco.map(d => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 6, fontWeight: 700, color: '#475569' }}>{d.label}</span>
                          <span style={{ fontSize: 7.5, fontWeight: 900, color: '#1a2e1a', marginLeft: 'auto', paddingLeft: 4 }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pizza: fit scores */}
              <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px' }}>
                <SecTitle>Distribuição Fit Score</SecTitle>
                {fitDist.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 8, textAlign: 'center', padding: '16px 0' }}>Sem dados</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PieChart data={fitDist} size={70} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {fitDist.map(d => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 6, fontWeight: 700, color: '#475569' }}>{d.label}</span>
                          <span style={{ fontSize: 7.5, fontWeight: 900, color: '#1a2e1a', marginLeft: 'auto', paddingLeft: 4 }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Radar do top candidato */}
              <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px' }}>
                <SecTitle accent="#92400e">Radar — {topCand ? topCand.jogador : 'Top Candidato'}</SecTitle>
                {!topCand || metricas.length < 3 ? (
                  <div style={{ color: '#94a3b8', fontSize: 8, textAlign: 'center', padding: '16px 0' }}>Sem métricas definidas</div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RadarChart metricas={metricas} jogador={topCand?.jogador} size={110} />
                  </div>
                )}
              </div>
            </div>

            {/* Critérios */}
            {((foco.criterios_obrigatorios || []).length > 0 || (foco.criterios_desejaveis || []).length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>⚠ Critérios Obrigatórios</div>
                  {(foco.criterios_obrigatorios || []).map((c, i) => <div key={i} style={{ fontSize: 7, color: '#7f1d1d', marginBottom: 2 }}>• {c}</div>)}
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>✓ Critérios Desejáveis</div>
                  {(foco.criterios_desejaveis || []).map((c, i) => <div key={i} style={{ fontSize: 7, color: '#14532d', marginBottom: 2 }}>• {c}</div>)}
                </div>
                <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>✗ Critérios de Exclusão</div>
                  {(foco.criterios_exclusao || []).map((c, i) => <div key={i} style={{ fontSize: 7, color: '#475569', marginBottom: 2 }}>• {c}</div>)}
                </div>
              </div>
            )}

            {/* Métricas-peso */}
            {(foco.metricas_pesos || []).length > 0 && (
              <div style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                <SecTitle>Métricas de Avaliação</SecTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {foco.metricas_pesos.map((m, i) => (
                    <div key={i} style={{ background: 'white', borderRadius: 8, padding: '7px 9px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 6.5, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>{m.label || m.metrica}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: BRAND_PRIMARY }}>Meta: {m.meta}</span>
                        <span style={{ fontSize: 7, fontWeight: 700, background: '#f0fdf4', color: BRAND_PRIMARY, padding: '1px 5px', borderRadius: 4 }}>{m.peso}%</span>
                      </div>
                      <BarH value={m.peso} max={100} color={BRAND_PRIMARY} height={5} width={90} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top candidatos com links clicáveis */}
            {topCands.length > 0 && (
              <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '10px 12px' }}>
                <SecTitle accent="#92400e">Top Candidatos — por Fit Score</SecTitle>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7.5 }}>
                  <thead>
                    <tr style={{ background: '#1e293b' }}>
                      {['#', 'Atleta', 'Clube', 'Posição', 'Idade', 'Min.', 'Fit Total', 'Posicional', 'Funcional', 'Contexto', 'Etapa', 'Perfil'].map(h => (
                        <th key={h} style={{ padding: '4px 7px', textAlign: 'left', color: 'white', fontWeight: 800, fontSize: 6, letterSpacing: '0.05em', textTransform: 'uppercase', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topCands.map((c, i) => {
                      const fc = fitColor(c.fit_score)
                      const ec = etapaColor(c.etapa)
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 8, fontWeight: 900, color: '#94a3b8' }}>{i + 1}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', maxWidth: 100 }}>
                            <div style={{ fontSize: 8, fontWeight: 800, color: '#1a2e1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.jogador || '—'}</div>
                          </td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 7, color: '#475569', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.clube || '—'}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 7, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{c.posicao || '—'}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 7.5, fontWeight: 700, color: '#334155', textAlign: 'center' }}>{c.idade || '—'}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 7, color: '#64748b', textAlign: 'center' }}>{c.minutos ? Number(c.minutos).toLocaleString('pt-BR') : '—'}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                            <span style={{ fontSize: 8.5, fontWeight: 900, color: fc.c, background: fc.bg, padding: '2px 6px', borderRadius: 5, display: 'inline-block' }}>{c.fit_score ?? '—'}</span>
                          </td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 7.5, fontWeight: 700, color: '#1d4ed8', textAlign: 'center' }}>{c.fit_posicional ?? '—'}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 7.5, fontWeight: 700, color: '#6d28d9', textAlign: 'center' }}>{c.fit_funcional ?? '—'}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9', fontSize: 7.5, fontWeight: 700, color: '#92400e', textAlign: 'center' }}>{c.fit_contexto ?? '—'}</td>
                          <td style={{ padding: '4px 7px', borderRight: '1px solid #f1f5f9' }}><Badge text={c.etapa} bg={ec.bg} color={ec.c} size={6} /></td>
                          <td style={{ padding: '4px 7px' }}>
                            {c.link_externo ? (
                              <a href={c.link_externo} target="_blank" rel="noopener noreferrer" style={{ color: BRAND_PRIMARY, fontWeight: 700, textDecoration: 'none', fontSize: 7 }}>
                                🔗 Link
                              </a>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Barras de fit comparativo */}
                {topCands.length > 1 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 6.5, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Comparativo Visual — Fit Score</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {topCands.slice(0, 6).map((c, i) => {
                        const fc = fitColor(c.fit_score)
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 6.5, fontWeight: 700, color: '#475569', width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.jogador}</span>
                            <BarH value={c.fit_score || 0} max={100} color={fc.c} height={8} width={350} />
                            <span style={{ fontSize: 7.5, fontWeight: 900, color: fc.c, width: 28, flexShrink: 0, textAlign: 'right' }}>{c.fit_score ?? '—'}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {topCands.length === 0 && (
              <div style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
                Nenhum candidato adicionado ao pipeline deste foco ainda
              </div>
            )}

            <PageFooter page={pageNum} total={totalPages} geradoEm={geradoEm} />
          </div>
        )
      })}
    </>
  )
}

export default function FocosRecrutamentoPrint() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter,sans-serif', color: '#94a3b8', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Preparando relatório de focos...
      </div>
    }>
      <PrintContent />
    </Suspense>
  )
}
