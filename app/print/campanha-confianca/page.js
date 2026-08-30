'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'

const GFC  = '#0a66b7'
const GFC2 = '#064b82'
const RED  = '#c62828'
const AMB  = '#b45309'
const BLUE = '#1565c0'

const f1 = (n) => isNaN(n) || n == null ? '0.0' : Number(n).toFixed(1)
const fp = (n) => `${f1(n)}%`
const fs = (n) => n > 0 ? `+${n}` : `${n}`

function Badge({ text, bg, color, size = 7 }) {
  if (!text || text === '—') return <span style={{ color: '#94a3b8', fontSize: size }}>—</span>
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 5, fontWeight: 800, fontSize: size, display: 'inline-block', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

function Kpi({ label, value, sub, color = GFC, bg = '#f0fdf4', border = '#bbf7d0' }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 6.5, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function SecTitle({ children, accent = GFC }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155' }}>{children}</span>
    </div>
  )
}

function PageHeader({ title, subtitle, page, total, escudo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/confianca.png" alt="" style={{ height: 30, width: 'auto' }} />
        <div>
          <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>CIC · Campanha Série C 2026 · Pág. {page}</div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>{title}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{subtitle}</span>
        <div style={{ fontSize: 7, color: '#cbd5e1', marginTop: 2 }}>{page} / {total}</div>
      </div>
    </div>
  )
}

function PageFooter({ page, total, geradoEm }) {
  return (
    <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · Série C 2026 · {geradoEm} · Confidencial</span>
      <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>{page} / {total}</span>
    </div>
  )
}

// ── Gráfico SVG de linha da posição ──────────────────────────
function GraficoLinha({ sorted, width = 730, height = 200 }) {
  if (!sorted.length) return null

  const mg = { top: 14, right: 30, bottom: 28, left: 30 }
  const cw = width - mg.left - mg.right
  const ch = height - mg.top - mg.bottom

  const posicoes = sorted.map(h => h.posicao)
  const maxPos = Math.max(...posicoes, 12)
  const minPos = 1
  const n = sorted.length

  const xOf = (i) => mg.left + (n === 1 ? cw / 2 : i * cw / (n - 1))
  const yOf = (pos) => mg.top + ((pos - minPos) / (maxPos - minPos)) * ch

  const linePath = sorted.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(h.posicao)}`).join(' ')
  const areaPath = `${linePath} L ${xOf(n - 1)} ${mg.top + ch} L ${xOf(0)} ${mg.top + ch} Z`

  const RES_COLOR = { V: GFC, E: AMB, D: RED }

  // Linha G8 y
  const yG8 = yOf(8)

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GFC} stopOpacity="0.12" />
          <stop offset="100%" stopColor={GFC} stopOpacity="0.01" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={GFC} floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Faixa G8 */}
      <rect x={mg.left} y={mg.top} width={cw} height={yG8 - mg.top}
        fill={GFC} fillOpacity="0.06" />

      {/* Grid horizontal */}
      {Array.from({ length: Math.ceil(maxPos) }, (_, i) => i + 1).filter(p => p % 2 === 0 || p === 1).map(p => {
        const y = yOf(p)
        return (
          <g key={p}>
            <line x1={mg.left} y1={y} x2={mg.left + cw} y2={y}
              stroke={p === 8 ? GFC : '#f4f8fc'} strokeWidth={p === 8 ? 0 : 0.6} />
          </g>
        )
      })}

      {/* Linha de corte G8 */}
      <line x1={mg.left} y1={yG8} x2={mg.left + cw} y2={yG8}
        stroke={GFC} strokeWidth={1} strokeDasharray="5 3" opacity="0.6" />
      <text x={mg.left + cw + 4} y={yG8 + 3} fontSize="7" fill={GFC} fontWeight="700">G8</text>

      {/* Labels eixo Y */}
      {[1, 4, 8, 12].filter(p => p <= maxPos + 1).map(p => (
        <text key={p} x={mg.left - 5} y={yOf(Math.min(p, maxPos)) + 3}
          fontSize="7" fill="#94a3b8" textAnchor="end">{p}°</text>
      ))}

      {/* Área preenchida */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Linha principal */}
      <path d={linePath} fill="none" stroke={GFC} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow)" />

      {/* Labels eixo X */}
      {sorted.map((h, i) => (
        <text key={i} x={xOf(i)} y={height - 6} fontSize="7.5" fill="#94a3b8"
          textAnchor="middle" fontWeight="600">R{h.rodada}</text>
      ))}

      {/* Pontos */}
      {sorted.map((h, i) => {
        const cx = xOf(i)
        const cy = yOf(h.posicao)
        const col = RES_COLOR[h.resultado] || '#94a3b8'
        const isLast = i === sorted.length - 1
        const r = isLast ? 11 : 9

        // Label especial
        const isLider = h.posicao === 1 && (i === 0 || sorted[i - 1].posicao !== 1)
        const isEntrou = i > 0 && sorted[i - 1].posicao > 8 && h.posicao <= 8

        return (
          <g key={i}>
            {isLast && <circle cx={cx} cy={cy} r={r + 5} fill={col} fillOpacity="0.12" />}
            <circle cx={cx} cy={cy} r={r} fill={col} fillOpacity="0.2"
              stroke={col} strokeWidth={isLast ? 2 : 1.5} />
            <text x={cx} y={cy + 3.5} fontSize="7.5" fill={col}
              textAnchor="middle" fontWeight="900">{h.resultado}</text>
            {isLider && (
              <text x={cx} y={cy - r - 4} fontSize="7" fill={GFC}
                textAnchor="middle" fontWeight="800">Liderança</text>
            )}
            {isEntrou && !isLider && (
              <text x={cx} y={cy - r - 4} fontSize="6.5" fill={GFC}
                textAnchor="middle" fontWeight="700">Entrou G8</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Cálculos ─────────────────────────────────────────────────
function calcStats(sorted) {
  if (!sorted.length) return null
  const n = sorted.length
  const posAtual = sorted[n - 1].posicao
  const melhor = Math.min(...sorted.map(h => h.posicao))
  const pior   = Math.max(...sorted.map(h => h.posicao))
  const g8     = sorted.filter(h => h.posicao <= 8).length
  const foraG8 = sorted.filter(h => h.posicao > 8).length
  const ptsAcum = sorted[n - 1].pontosAcumulados || 0
  const aprGeral = n ? parseFloat(((ptsAcum / (n * 3)) * 100).toFixed(1)) : 0
  const vars = sorted.map(h => h.variacaoPosicao).filter(v => !isNaN(v))
  const maiorSubida = vars.length ? Math.max(...vars) : 0
  const maiorQueda  = vars.length ? Math.min(...vars)  : 0
  const totalGp = sorted.reduce((s, h) => s + (h.golsPro || 0), 0)
  const totalGc = sorted.reduce((s, h) => s + (h.golsContra || 0), 0)
  const rodadasLider = sorted.filter(h => h.posicao === 1).length

  const last5 = sorted.slice(-5)
  const pts5  = last5.reduce((s, h) => s + (h.pontosRodada || 0), 0)
  const apr5  = last5.length ? parseFloat(((pts5 / (last5.length * 3)) * 100).toFixed(1)) : 0
  const v5 = last5.filter(h => h.resultado === 'V').length
  const e5 = last5.filter(h => h.resultado === 'E').length
  const d5 = last5.filter(h => h.resultado === 'D').length
  const gp5 = last5.reduce((s, h) => s + (h.golsPro || 0), 0)
  const gc5 = last5.reduce((s, h) => s + (h.golsContra || 0), 0)
  const varPos5 = last5.length >= 2 ? last5[0].posicao - last5[last5.length - 1].posicao : 0

  const last3 = sorted.slice(-3)
  let tend = 'estavel'
  if (last3.length >= 2) {
    if (last3[last3.length - 1].posicao < last3[0].posicao) tend = 'subindo'
    else if (last3[last3.length - 1].posicao > last3[0].posicao) tend = 'caindo'
  }

  let seqAtual = 0, seqTipo = ''
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (i === sorted.length - 1) { seqTipo = sorted[i].resultado; seqAtual = 1 }
    else if (sorted[i].resultado === seqTipo) seqAtual++
    else break
  }

  const casa  = sorted.filter(h => h.mando === 'casa')
  const fora  = sorted.filter(h => h.mando !== 'casa')
  const mandoCalc = (arr) => {
    if (!arr.length) return null
    const v  = arr.filter(h => h.resultado === 'V').length
    const e  = arr.filter(h => h.resultado === 'E').length
    const d  = arr.filter(h => h.resultado === 'D').length
    const gp = arr.reduce((s, h) => s + (h.golsPro || 0), 0)
    const gc = arr.reduce((s, h) => s + (h.golsContra || 0), 0)
    const pts = arr.reduce((s, h) => s + (h.pontosRodada || 0), 0)
    return { j: arr.length, v, e, d, gp, gc, pts, apr: parseFloat(((pts / (arr.length * 3)) * 100).toFixed(1)) }
  }

  const maiorVit = [...sorted].filter(h => h.resultado === 'V')
    .sort((a, b) => (b.golsPro - b.golsContra) - (a.golsPro - a.golsContra))[0]
  const maiorImpacto = [...sorted].sort((a, b) => b.variacaoPosicao - a.variacaoPosicao)[0]
  const cleanSheets = sorted.filter(h => (h.golsContra || 0) === 0).length

  return {
    n, posAtual, melhor, pior, g8, foraG8, ptsAcum, aprGeral,
    maiorSubida, maiorQueda, totalGp, totalGc, rodadasLider,
    tend, seqAtual, seqTipo,
    last5: { n: last5.length, pts: pts5, apr: apr5, v: v5, e: e5, d: d5, gp: gp5, gc: gc5, varPos: varPos5 },
    casa: mandoCalc(casa), fora: mandoCalc(fora),
    maiorVit, maiorImpacto, cleanSheets,
  }
}

function statusNarrativo(h, i, sorted) {
  const prev = sorted[i - 1]
  if (!prev) return h.posicao <= 8 ? 'Início dentro do G8.' : 'Início fora do G8.'
  if (h.posicao === 1 && prev.posicao !== 1) return 'Assumiu a liderança da tabela.'
  if (prev.posicao === 1 && h.posicao !== 1) return 'Deixou a liderança.'
  if (prev.posicao > 8 && h.posicao <= 8) return 'Entrou na zona de classificação (G8).'
  if (prev.posicao <= 8 && h.posicao > 8) return 'Saiu do G8.'
  if (h.variacaoPosicao > 0) return `Subiu ${h.variacaoPosicao} ${h.variacaoPosicao > 1 ? 'posições' : 'posição'} na tabela.`
  if (h.variacaoPosicao < 0) return `Cedeu ${Math.abs(h.variacaoPosicao)} ${Math.abs(h.variacaoPosicao) > 1 ? 'posições' : 'posição'}.`
  return 'Manteve a posição.'
}

function gerarResumo(sorted, st) {
  if (!sorted || !st) return ''
  const primeiraPos = sorted[0].posicao
  const posStr = st.posAtual === 1 ? 'na liderança' : `em ${st.posAtual}° lugar`
  let txt = `O Confiança iniciou a competição em ${primeiraPos}° lugar e hoje se encontra ${posStr}, acumulando ${st.ptsAcum} pontos em ${st.n} rodadas com ${f1(st.aprGeral)}% de aproveitamento. `
  if (st.g8 === st.n) txt += `A equipe permaneceu dentro do G8 em todas as rodadas analisadas. `
  else if (st.g8 > st.foraG8) txt += `A equipe permaneceu dentro do G8 em ${st.g8} das ${st.n} rodadas analisadas, demonstrando estabilidade competitiva. `
  else txt += `A equipe ficou fora da zona por ${st.foraG8} rodadas, mas busca recuperar estabilidade. `
  if (st.rodadasLider > 0) txt += `O time liderou a tabela em ${st.rodadasLider} rodada${st.rodadasLider > 1 ? 's' : ''}. `
  txt += `Saldo de gols: ${st.totalGp - st.totalGc >= 0 ? '+' : ''}${st.totalGp - st.totalGc} (${st.totalGp} marcados, ${st.totalGc} sofridos).`
  return txt
}

function gerarConclusao(sorted, st) {
  if (!st) return ''
  const tendStr = { subindo: 'ascendente', estavel: 'estável', caindo: 'em queda' }[st.tend] || 'estável'
  let txt = `A campanha apresenta trajetória ${tendStr}. `
  if (st.posAtual <= 8) txt += `O Confiança está dentro do G8 com ${st.ptsAcum} pontos, posição que deve ser sustentada com regularidade nas próximas rodadas. `
  else txt += `O time está fora do G8 e precisa recuperar posição nas próximas rodadas. `
  if (st.seqAtual >= 2 && st.seqTipo === 'V') txt += `A sequência de ${st.seqAtual} vitórias seguidas indica momento positivo. `
  if (st.casa && st.fora) {
    if (st.casa.apr > st.fora.apr + 10) txt += `O rendimento em casa (${f1(st.casa.apr)}%) supera o desempenho fora (${f1(st.fora.apr)}%), indicando vulnerabilidade como visitante. `
    else if (st.fora.apr > st.casa.apr + 10) txt += `O time apresenta bom rendimento fora de casa (${f1(st.fora.apr)}%), diferencial importante para as fases finais. `
    else txt += `O aproveitamento em casa e fora está equilibrado, sinal de consistência. `
  }
  if (st.tend === 'caindo') txt += 'A queda recente de posições é o principal ponto de atenção.'
  else if (st.fora && st.fora.apr < 40) txt += `O aproveitamento fora de casa (${f1(st.fora.apr)}%) merece atenção.`
  else txt += 'Manter a regularidade ao longo da competição é o principal desafio.'
  return txt
}

function gerarObjetivo(st) {
  if (!st) return 'Seguir firme na competição.'
  if (st.posAtual === 1) return 'Sustentar a liderança e ampliar a margem sobre os concorrentes ao G8.'
  if (st.posAtual <= 4) return 'Manter-se no G8 e pressionar a liderança nas próximas rodadas.'
  if (st.posAtual <= 8) return 'Consolidar posição dentro do G8 e aumentar a folga em relação ao 9° colocado.'
  return 'Recuperar posição na tabela, encurtar distância para o G8 e retomar regularidade.'
}

// ── Componente principal ──────────────────────────────────────
function CampanhaContent() {
  const [sorted, setSorted] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Carrega do banco
    fetch('/api/elenco-session')
      .then(r => r.json())
      .then(json => {
        if (json.found && json.data?.historico) {
          const s = [...json.data.historico].sort((a, b) => a.rodada - b.rodada)
          setSorted(s)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const st = useMemo(() => calcStats(sorted), [sorted])
  const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const TOTAL = 6
  const stripe = { position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${GFC} 0%,#22c55e 55%,#1e293b 100%)` }
  const page = { width: 794, background: 'white', padding: '28px 32px 20px', position: 'relative', fontFamily: "'Inter',sans-serif", display: 'flex', flexDirection: 'column', minHeight: 1060 }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter,sans-serif', color: '#94a3b8', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      Preparando relatório CIC...
    </div>
  )

  if (!sorted.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter,sans-serif', color: '#94a3b8', fontSize: 14, fontWeight: 700 }}>
      Nenhuma rodada cadastrada. Cadastre rodadas na página de Elenco.
    </div>
  )

  const tend = st.tend
  const tendLabel = { subindo: '↑ SUBINDO', estavel: '→ ESTÁVEL', caindo: '↓ CAINDO' }[tend]
  const tendBg    = { subindo: '#dcfce7', estavel: '#fef3c7', caindo: '#fee2e2' }[tend]
  const tendColor = { subindo: '#166534', estavel: '#92400e', caindo: '#991b1b' }[tend]

  // Pontos positivos e atenção gerados dinamicamente
  const positivos = []
  if (st.posAtual <= 8) positivos.push(`Posição dentro do G8 (${st.posAtual}°), dentro do objetivo da competição.`)
  if (st.g8 >= st.n * 0.7) positivos.push(`Estabilidade: ${st.g8} de ${st.n} rodadas dentro do G8 (${f1((st.g8/st.n)*100)}%).`)
  if (st.rodadasLider > 0) positivos.push(`Chegou à liderança em ${st.rodadasLider} rodada${st.rodadasLider > 1 ? 's' : ''}.`)
  if (st.cleanSheets > 2) positivos.push(`Solidez defensiva: ${st.cleanSheets} jogos sem sofrer gol.`)
  if (st.totalGp / st.n > 1.5) positivos.push(`Poder ofensivo: média de ${f1(st.totalGp / st.n)} gols por jogo.`)
  if (!positivos.length) positivos.push('Campanha em desenvolvimento — dados insuficientes para análise completa.')

  const atencoes = []
  if (tend === 'caindo') atencoes.push('Tendência de queda recente — requer atenção imediata.')
  if (st.fora && st.fora.apr < 40) atencoes.push(`Rendimento fora de casa abaixo de 40% (${f1(st.fora.apr)}%).`)
  if (st.cleanSheets < 2) atencoes.push('Poucos jogos sem sofrer gol — solidez defensiva a desenvolver.')
  if (st.foraG8 > 0) atencoes.push(`O time ficou fora do G8 em ${st.foraG8} rodada${st.foraG8 > 1 ? 's' : ''}.`)
  if (!atencoes.length) atencoes.push('Nenhum ponto crítico identificado no momento.')

  const RES_CFG = {
    V: { bg: '#dcfce7', color: '#166534' },
    E: { bg: '#fef3c7', color: '#92400e' },
    D: { bg: '#fee2e2', color: '#991b1b' },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Inter',sans-serif;background:white;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        @media print{
          @page{size:A4 portrait;margin:0;}
          html,body{width:210mm;}
          .no-print{display:none!important;}
          .pg{page-break-before:always;}
          .a4{
            width:210mm!important;
            height:297mm!important;
            padding:20px 28px 16px!important;
            overflow:hidden!important;
            box-shadow:none!important;
            margin:0!important;
          }
        }
        @media screen{
          body{background:#94a3b8;padding-bottom:48px;}
          .a4{box-shadow:0 8px 40px rgba(0,0,0,.22);margin:32px auto;}
        }
      `}</style>

      {/* Botões tela */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 7 }}>
        <button onClick={() => window.print()} style={{ background: GFC, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 900, fontSize: 13, cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'Inter,sans-serif' }}>
          🖨️ Salvar PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
          ✕ Fechar
        </button>
      </div>

      {/* ═══════════════ PÁG 1 — RESUMO EXECUTIVO */}
      <div className="a4" style={{ ...page }}>
        <div style={stripe} />

        {/* Capa */}
        <div style={{ background: GFC2, borderRadius: 12, padding: '16px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/confianca.png" alt="" style={{ height: 52, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Associação Desportiva Confiança · CIC</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: 'white', lineHeight: 1 }}>Evolução na Tabela</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#86efac', marginTop: 4 }}>Série C 2026 · Relatório de Campanha</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: tendBg, color: tendColor, padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, marginBottom: 6 }}>{tendLabel}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{sorted.length} rodadas analisadas</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Gerado em {geradoEm}</div>
          </div>
        </div>

        {/* KPIs linha 1 */}
        <SecTitle>Resumo Executivo</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 6 }}>
          <Kpi label="Posição atual"   value={`${st.posAtual}°`}                     color={st.posAtual <= 8 ? '#166534' : '#991b1b'} bg={st.posAtual <= 8 ? '#dcfce7' : '#fee2e2'} border={st.posAtual <= 8 ? '#86efac' : '#fecaca'} />
          <Kpi label="Melhor"          value={`${st.melhor}°`}                        color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Pior"            value={`${st.pior}°`}                          color="#991b1b"  bg="#fee2e2"  border="#fecaca" />
          <Kpi label="Pts acumulados"  value={st.ptsAcum}                             color={GFC}      bg="#f0fdf4"  border="#bbf7d0" />
          <Kpi label="Aprovat. geral"  value={fp(st.aprGeral)}                        color={st.aprGeral >= 60 ? '#166534' : '#92400e'} bg={st.aprGeral >= 60 ? '#dcfce7' : '#fef3c7'} border={st.aprGeral >= 60 ? '#86efac' : '#fde68a'} />
          <Kpi label="Rodadas G8"      value={st.g8}                                  color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Maior subida"    value={st.maiorSubida > 0 ? `+${st.maiorSubida}` : '—'} color="#166534" bg="#dcfce7" border="#86efac" />
          <Kpi label="Maior queda"     value={st.maiorQueda < 0 ? st.maiorQueda : '—'} color="#991b1b" bg="#fee2e2" border="#fecaca" />
        </div>

        {/* KPIs linha 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 8 }}>
          <Kpi label="Gols marcados"   value={st.totalGp}                             color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Gols sofridos"   value={st.totalGc}                             color="#991b1b"  bg="#fee2e2"  border="#fecaca" />
          <Kpi label="Saldo gols"      value={`${st.totalGp-st.totalGc>=0?'+':''}${st.totalGp-st.totalGc}`} color={st.totalGp-st.totalGc>=0?'#166534':'#991b1b'} bg={st.totalGp-st.totalGc>=0?'#dcfce7':'#fee2e2'} border={st.totalGp-st.totalGc>=0?'#86efac':'#fecaca'} />
          <Kpi label="Fora do G8"      value={st.foraG8}                              color={st.foraG8>0?'#991b1b':'#475569'} bg={st.foraG8>0?'#fee2e2':'#f8fafc'} border={st.foraG8>0?'#fecaca':'#e2e8f0'} />
          <Kpi label="Liderou"         value={st.rodadasLider > 0 ? `${st.rodadasLider}R` : 'Não'} color={st.rodadasLider>0?'#166534':'#475569'} bg={st.rodadasLider>0?'#dcfce7':'#f8fafc'} border={st.rodadasLider>0?'#86efac':'#e2e8f0'} />
          <Kpi label="Clean sheets"    value={st.cleanSheets}                         color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Aprovat. últ.5"  value={fp(st.last5.apr)}                       color={st.last5.apr>=60?'#166534':'#92400e'} bg={st.last5.apr>=60?'#dcfce7':'#fef3c7'} border={st.last5.apr>=60?'#86efac':'#fde68a'} />
          <Kpi label="Sequência"       value={st.seqAtual>=2?`${st.seqAtual}${st.seqTipo}s`:'—'} color={st.seqTipo==='V'?'#166534':st.seqTipo==='D'?'#991b1b':'#92400e'} bg={st.seqTipo==='V'?'#dcfce7':st.seqTipo==='D'?'#fee2e2':'#fef3c7'} border={st.seqTipo==='V'?'#86efac':st.seqTipo==='D'?'#fecaca':'#fde68a'} />
        </div>

        {/* Leitura geral */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: GFC, marginBottom: 6 }}>Leitura Geral da Campanha</div>
          <p style={{ fontSize: 9.5, color: '#1a2e1a', lineHeight: 1.65 }}>{gerarResumo(sorted, st)}</p>
        </div>

        {/* Sequência visual de resultados */}
        <SecTitle>Sequência de Resultados — Rodada a Rodada</SecTitle>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {sorted.map((h, i) => {
            const c = RES_CFG[h.resultado] || { bg: '#f1f5f9', color: '#475569' }
            const isLast = i === sorted.length - 1
            return (
              <div key={i} style={{ textAlign: 'center', minWidth: 40 }}>
                <div style={{ background: c.bg, color: c.color, border: `1.5px solid ${c.color}44`, borderRadius: 7, padding: '5px 0', fontSize: 10, fontWeight: 900, outline: isLast ? `2px solid ${c.color}` : 'none' }}>
                  {h.resultado}
                </div>
                <div style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>R{h.rodada}</div>
                <div style={{ fontSize: 7, color: h.posicao <= 8 ? '#166534' : '#94a3b8', fontWeight: 800 }}>{h.posicao}°</div>
              </div>
            )
          })}
        </div>

        <PageFooter page={1} total={TOTAL} geradoEm={geradoEm} />
      </div>

      {/* ═══════════════ PÁG 2 — GRÁFICO DE EVOLUÇÃO */}
      <div className="a4 pg" style={{ ...page }}>
        <div style={stripe} />
        <PageHeader title="Evolução da Posição" subtitle={`${sorted.length} rodadas · Série C 2026`} page={2} total={TOTAL} />

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'center' }}>
          {[['V', 'Vitória', '#166534', '#dcfce7'], ['E', 'Empate', '#92400e', '#fef3c7'], ['D', 'Derrota', '#991b1b', '#fee2e2']].map(([k, l, c, bg]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: bg, border: `2px solid ${c}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: c }}>{k}</span>
              </div>
              <span style={{ fontSize: 8, fontWeight: 600, color: '#64748b' }}>{l}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 24, height: 2, background: GFC, opacity: 0.5 }} />
            <div style={{ width: 6, height: 6, borderRadius: 2, background: GFC, opacity: 0.2 }} />
            <span style={{ fontSize: 8, fontWeight: 600, color: '#64748b' }}>Zona G8</span>
          </div>
        </div>

        {/* Gráfico SVG */}
        <div style={{ background: '#fafcfb', border: '1px solid #e8f4ec', borderRadius: 12, padding: '16px 12px', marginBottom: 14 }}>
          <GraficoLinha sorted={sorted} width={718} height={210} />
        </div>

        {/* Insight */}
        {(() => {
          const ganhou = st.pior - st.posAtual
          const txt = ganhou > 0
            ? `Entre a pior colocação (${st.pior}°) e a posição atual (${st.posAtual}°), o Confiança ganhou ${ganhou} posições na tabela. A equipe permaneceu dentro do G8 em ${st.g8} de ${st.n} rodadas.`
            : `O time está na ${st.posAtual}° posição, tendo ficado dentro do G8 em ${st.g8} de ${st.n} rodadas analisadas.`
          return (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', marginBottom: 14 }}>
              <span style={{ fontSize: 7, fontWeight: 900, color: GFC, textTransform: 'uppercase', letterSpacing: '0.07em' }}>💡 Insight  </span>
              <span style={{ fontSize: 8.5, color: '#1a2e1a' }}>{txt}</span>
            </div>
          )
        })()}

        {/* Mini tabela de resultados com aproveitamento acumulado */}
        <SecTitle>Aproveitamento Acumulado por Rodada</SecTitle>
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end', height: 80, background: '#fafcfb', border: '1px solid #e8f4ec', borderRadius: 10, padding: '10px 12px 20px' }}>
          {sorted.map((h, i) => {
            const apr = h.aproveitamentoAcumulado || 0
            const maxH = 70
            const barH = (apr / 100) * maxH
            const col = apr >= 67 ? '#166534' : apr >= 40 ? '#92400e' : '#991b1b'
            const bg  = apr >= 67 ? '#dcfce7' : apr >= 40 ? '#fef3c7' : '#fee2e2'
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                <span style={{ fontSize: 6, fontWeight: 700, color: col }}>{f1(apr)}%</span>
                <div style={{ width: '70%', height: barH, background: bg, border: `1px solid ${col}44`, borderRadius: '2px 2px 0 0', minHeight: 2 }} />
                <span style={{ fontSize: 6.5, color: '#94a3b8', fontWeight: 600 }}>R{h.rodada}</span>
              </div>
            )
          })}
          {/* Linha de referência 55.6% */}
        </div>
        <div style={{ fontSize: 7, color: '#94a3b8', textAlign: 'right', marginTop: 3 }}>Linha de corte sugerida: 55.6% (aproveitamento médio Série C)</div>

        <PageFooter page={2} total={TOTAL} geradoEm={geradoEm} />
      </div>

      {/* ═══════════════ PÁG 3 — RODADA A RODADA */}
      <div className="a4 pg" style={{ ...page }}>
        <div style={stripe} />
        <PageHeader title="Rodada a Rodada" subtitle={`${sorted.length} partidas registradas`} page={3} total={TOTAL} />

        <SecTitle>Histórico Completo de Partidas</SecTitle>
        <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
            <thead>
              <tr style={{ background: '#1e293b' }}>
                {['R', 'Data', 'Adversário', 'Mando', 'Placar', 'Res', 'Pts', 'Acum', 'Pos', 'Var', 'Aprov. Acum'].map(h => (
                  <th key={h} style={{ padding: '7px 9px', textAlign: 'left', color: 'white', fontWeight: 800, fontSize: 7, letterSpacing: '0.05em', textTransform: 'uppercase', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((h, i) => {
                const isLast = i === sorted.length - 1
                const c = RES_CFG[h.resultado] || { bg: '#f1f5f9', color: '#475569' }
                const varCor = h.variacaoPosicao > 0 ? '#166534' : h.variacaoPosicao < 0 ? '#991b1b' : '#94a3b8'
                const varTxt = h.variacaoPosicao > 0 ? `↑ +${h.variacaoPosicao}` : h.variacaoPosicao < 0 ? `↓ ${h.variacaoPosicao}` : '—'
                return (
                  <tr key={i} style={{ background: isLast ? '#f0fdf4' : i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9', borderLeft: isLast ? `3px solid ${GFC}` : '3px solid transparent' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 800, color: '#1a2e1a', borderRight: '1px solid #f1f5f9' }}>R{h.rodada}</td>
                    <td style={{ padding: '7px 9px', color: '#64748b', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h.data || '—'}</td>
                    <td style={{ padding: '7px 9px', fontWeight: 700, color: '#1a2e1a', borderRight: '1px solid #f1f5f9' }}>{h.adversario || '—'}</td>
                    <td style={{ padding: '7px 9px', borderRight: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 7, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: h.mando === 'casa' ? '#dcfce7' : '#eff6ff', color: h.mando === 'casa' ? '#166534' : BLUE }}>
                        {h.mando === 'casa' ? 'Casa' : h.mando === 'fora' ? 'Fora' : 'Neutro'}
                      </span>
                    </td>
                    <td style={{ padding: '7px 9px', fontWeight: 800, color: c.color, borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h.golsPro}x{h.golsContra}</td>
                    <td style={{ padding: '7px 9px', borderRight: '1px solid #f1f5f9' }}>
                      <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 5, fontWeight: 900, fontSize: 8 }}>{h.resultado}</span>
                    </td>
                    <td style={{ padding: '7px 9px', fontWeight: 800, color: h.pontosRodada===3?'#166534':h.pontosRodada===1?'#92400e':'#991b1b', borderRight: '1px solid #f1f5f9' }}>{h.pontosRodada}</td>
                    <td style={{ padding: '7px 9px', fontWeight: 800, color: '#1a2e1a', borderRight: '1px solid #f1f5f9' }}>{h.pontosAcumulados}</td>
                    <td style={{ padding: '7px 9px', fontWeight: 900, color: h.posicao<=8?'#166534':'#1a2e1a', borderRight: '1px solid #f1f5f9' }}>{h.posicao}°</td>
                    <td style={{ padding: '7px 9px', fontWeight: 800, color: varCor, borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{varTxt}</td>
                    <td style={{ padding: '7px 9px', color: '#64748b' }}>{fp(h.aproveitamentoAcumulado)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Linha do tempo narrativa */}
        <SecTitle>Linha do Tempo Narrativa</SecTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map((h, i) => {
            const status = statusNarrativo(h, i, sorted)
            if (status === 'Manteve a posição.') return null
            const isPositivo = status.includes('Liderança') || status.includes('G8') || status.includes('Subiu')
            const isNegativo = status.includes('Deixou') || status.includes('Saiu') || status.includes('Cedeu')
            const cor = isPositivo ? GFC : isNegativo ? RED : AMB
            const bg  = isPositivo ? '#f0fdf4' : isNegativo ? '#fef2f2' : '#fffbeb'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: bg, borderRadius: 7, padding: '6px 10px', border: `1px solid ${cor}22` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                <span style={{ fontSize: 8, fontWeight: 800, color: cor }}>R{h.rodada}</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: '#334155' }}>{status}</span>
              </div>
            )
          })}
        </div>

        <PageFooter page={3} total={TOTAL} geradoEm={geradoEm} />
      </div>

      {/* ═══════════════ PÁG 4 — MOMENTO RECENTE */}
      <div className="a4 pg" style={{ ...page }}>
        <div style={stripe} />
        <PageHeader title="Momento Recente" subtitle={`Últimas ${st.last5.n} rodadas`} page={4} total={TOTAL} />

        <SecTitle>Análise das Últimas {st.last5.n} Rodadas</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 8 }}>
          <Kpi label="Jogos"        value={st.last5.n}                               color="#475569"  bg="#f8fafc"  border="#e2e8f0" />
          <Kpi label="Vitórias"     value={st.last5.v}                               color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Empates"      value={st.last5.e}                               color="#92400e"  bg="#fef3c7"  border="#fde68a" />
          <Kpi label="Derrotas"     value={st.last5.d}                               color="#991b1b"  bg="#fee2e2"  border="#fecaca" />
          <Kpi label="Pontos"       value={st.last5.pts}                             color={GFC}      bg="#f0fdf4"  border="#bbf7d0" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 10 }}>
          <Kpi label="Aprovat."     value={fp(st.last5.apr)}                         color={st.last5.apr>=60?'#166534':'#92400e'} bg={st.last5.apr>=60?'#dcfce7':'#fef3c7'} border={st.last5.apr>=60?'#86efac':'#fde68a'} />
          <Kpi label="Gols pró"     value={st.last5.gp}                              color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Gols contra"  value={st.last5.gc}                              color="#991b1b"  bg="#fee2e2"  border="#fecaca" />
          <Kpi label="Saldo"        value={`${st.last5.gp-st.last5.gc>=0?'+':''}${st.last5.gp-st.last5.gc}`} color={st.last5.gp-st.last5.gc>=0?'#166534':'#991b1b'} bg={st.last5.gp-st.last5.gc>=0?'#dcfce7':'#fee2e2'} border={st.last5.gp-st.last5.gc>=0?'#86efac':'#fecaca'} />
          <Kpi label="Var. posição" value={st.last5.varPos>=0?`+${st.last5.varPos}`:String(st.last5.varPos)} color={st.last5.varPos>=0?'#166534':'#991b1b'} bg={st.last5.varPos>=0?'#dcfce7':'#fee2e2'} border={st.last5.varPos>=0?'#86efac':'#fecaca'} />
        </div>

        {/* Texto automático momento */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 7, fontWeight: 900, color: GFC, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Leitura do Momento</div>
          <p style={{ fontSize: 9.5, color: '#1a2e1a', lineHeight: 1.65 }}>
            {`Nas últimas ${st.last5.n} rodadas, o Confiança somou ${st.last5.pts} pontos, com ${st.last5.v} vitória${st.last5.v!==1?'s':''}, ${st.last5.e} empate${st.last5.e!==1?'s':''} e ${st.last5.d} derrota${st.last5.d!==1?'s':''}, aproveitamento de ${f1(st.last5.apr)}%. `}
            {`A variação de posição no período foi de ${st.last5.varPos>=0?'+':''}${st.last5.varPos} posição${Math.abs(st.last5.varPos)!==1?'ões':''}, indicando tendência de ${{ subindo:'crescimento', estavel:'estabilidade', caindo:'queda' }[tend]}.`}
          </p>
        </div>

        {/* Partidas das últimas 5 rodadas detalhadas */}
        <SecTitle>Detalhamento das Últimas {st.last5.n} Partidas</SecTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {sorted.slice(-st.last5.n).map((h, i) => {
            const c = RES_CFG[h.resultado] || { bg: '#f1f5f9', color: '#475569' }
            const varCor = h.variacaoPosicao > 0 ? '#166534' : h.variacaoPosicao < 0 ? '#991b1b' : '#94a3b8'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid #f1f5f9', borderLeft: `4px solid ${c.color}`, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ background: c.bg, color: c.color, width: 36, height: 36, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1 }}>{h.resultado}</span>
                  <span style={{ fontSize: 6, fontWeight: 600, opacity: 0.7 }}>R{h.rodada}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#1a2e1a' }}>{h.adversario}</div>
                  <div style={{ fontSize: 7.5, color: '#64748b', marginTop: 2 }}>{h.data || '—'} · {h.mando === 'casa' ? 'Em casa' : 'Fora'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: c.color }}>{h.golsPro}x{h.golsContra}</div>
                  <div style={{ fontSize: 7, color: '#94a3b8' }}>Placar</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 50 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: h.posicao<=8?'#166534':'#1a2e1a' }}>{h.posicao}°</div>
                  <div style={{ fontSize: 7, color: '#94a3b8' }}>Posição</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 40 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: varCor }}>{h.variacaoPosicao>0?`+${h.variacaoPosicao}`:h.variacaoPosicao<0?String(h.variacaoPosicao):'—'}</div>
                  <div style={{ fontSize: 7, color: '#94a3b8' }}>Var.</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 50 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1a2e1a' }}>{h.pontosAcumulados}</div>
                  <div style={{ fontSize: 7, color: '#94a3b8' }}>Pts acum.</div>
                </div>
              </div>
            )
          })}
        </div>

        <PageFooter page={4} total={TOTAL} geradoEm={geradoEm} />
      </div>

      {/* ═══════════════ PÁG 5 — CASA × FORA E GOLS */}
      <div className="a4 pg" style={{ ...page }}>
        <div style={stripe} />
        <PageHeader title="Casa × Fora e Gols" subtitle="Análise comparativa de mando de campo" page={5} total={TOTAL} />

        <SecTitle>Campanha por Mando de Campo</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[{ label: '🏠 Em Casa', ms: st.casa }, { label: '✈ Fora', ms: st.fora }].map(({ label, ms }) => {
            if (!ms) return <div key={label} style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 9 }}>Sem dados</div>
            const aprCor = ms.apr >= 60 ? '#166534' : ms.apr >= 40 ? '#92400e' : '#991b1b'
            const aprBg  = ms.apr >= 60 ? '#dcfce7' : ms.apr >= 40 ? '#fef3c7' : '#fee2e2'
            return (
              <div key={label} style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: GFC2, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: 'white' }}>{label}</div>
                  <div style={{ fontSize: 8, color: '#86efac', marginTop: 2 }}>{ms.j} jogo{ms.j!==1?'s':''}</div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
                    <div style={{ textAlign: 'center', background: '#dcfce7', borderRadius: 8, padding: '8px 0' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#166534' }}>{ms.v}</div>
                      <div style={{ fontSize: 7, color: '#94a3b8', fontWeight: 700 }}>VITÓRIAS</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#fef3c7', borderRadius: 8, padding: '8px 0' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#92400e' }}>{ms.e}</div>
                      <div style={{ fontSize: 7, color: '#94a3b8', fontWeight: 700 }}>EMPATES</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#fee2e2', borderRadius: 8, padding: '8px 0' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#991b1b' }}>{ms.d}</div>
                      <div style={{ fontSize: 7, color: '#94a3b8', fontWeight: 700 }}>DERROTAS</div>
                    </div>
                  </div>
                  {[
                    ['Pontos',            String(ms.pts)],
                    ['Gols marcados',     String(ms.gp)],
                    ['Gols sofridos',     String(ms.gc)],
                    ['Saldo',             `${ms.gp-ms.gc>=0?'+':''}${ms.gp-ms.gc}`],
                    ['Média gols/jogo',   ms.j ? f1(ms.gp/ms.j) : '—'],
                    ['Aproveitamento',    fp(ms.apr)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '4px 0' }}>
                      <span style={{ fontSize: 8, color: '#64748b' }}>{k}</span>
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#1a2e1a' }}>{v}</span>
                    </div>
                  ))}
                  {/* Barra de aproveitamento */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ background: aprCor, width: `${Math.min(100, ms.apr)}%`, height: '100%', borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ fontSize: 6.5, color: '#94a3b8' }}>0%</span>
                      <span style={{ fontSize: 7, fontWeight: 800, color: aprCor }}>{fp(ms.apr)}</span>
                      <span style={{ fontSize: 6.5, color: '#94a3b8' }}>100%</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Gols da campanha */}
        <SecTitle>Gols da Campanha</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 10 }}>
          <Kpi label="Gols marcados"    value={st.totalGp}                                                     color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Gols sofridos"    value={st.totalGc}                                                     color="#991b1b"  bg="#fee2e2"  border="#fecaca" />
          <Kpi label="Saldo"            value={`${st.totalGp-st.totalGc>=0?'+':''}${st.totalGp-st.totalGc}`}  color={st.totalGp-st.totalGc>=0?'#166534':'#991b1b'} bg={st.totalGp-st.totalGc>=0?'#dcfce7':'#fee2e2'} border={st.totalGp-st.totalGc>=0?'#86efac':'#fecaca'} />
          <Kpi label="Média pró/jogo"   value={st.n?f1(st.totalGp/st.n):'—'}                                  color="#166534"  bg="#dcfce7"  border="#86efac" />
          <Kpi label="Média contra/jogo" value={st.n?f1(st.totalGc/st.n):'—'}                                 color="#991b1b"  bg="#fee2e2"  border="#fecaca" />
          <Kpi label="Clean sheets"     value={st.cleanSheets}                                                 color="#166534"  bg="#dcfce7"  border="#86efac" />
        </div>

        {/* Destaques */}
        <SecTitle>Destaques</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { title: '🏆 Maior Vitória', desc: st.maiorVit ? `${st.maiorVit.golsPro}x${st.maiorVit.golsContra} vs ${st.maiorVit.adversario} (R${st.maiorVit.rodada})` : '—', bg: '#dcfce7', border: '#86efac', color: '#166534' },
            { title: '⚡ Maior Impacto Positivo', desc: st.maiorImpacto && st.maiorImpacto.variacaoPosicao > 0 ? `+${st.maiorImpacto.variacaoPosicao} posições vs ${st.maiorImpacto.adversario} (R${st.maiorImpacto.rodada})` : '—', bg: '#f0fdf4', border: '#bbf7d0', color: GFC },
          ].map(d => (
            <div key={d.title} style={{ background: d.bg, border: `1.5px solid ${d.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 7, fontWeight: 900, color: d.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{d.title}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#1a2e1a' }}>{d.desc}</div>
            </div>
          ))}
        </div>

        <PageFooter page={5} total={TOTAL} geradoEm={geradoEm} />
      </div>

      {/* ═══════════════ PÁG 6 — CONCLUSÃO */}
      <div className="a4 pg" style={{ ...page }}>
        <div style={stripe} />
        <PageHeader title="Conclusão da Campanha" subtitle="Leitura final para comissão técnica" page={6} total={TOTAL} />

        {/* Texto conclusão */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 7, fontWeight: 900, color: GFC, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Síntese da Campanha</div>
          <p style={{ fontSize: 9.5, color: '#1a2e1a', lineHeight: 1.7 }}>{gerarConclusao(sorted, st)}</p>
        </div>

        {/* Pontos positivos e de atenção lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 10, padding: '10px 12px' }}>
            <SecTitle>Pontos Positivos</SecTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {positivos.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 9 }}>✓</span>
                  </div>
                  <span style={{ fontSize: 8.5, color: '#334155', lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 10, padding: '10px 12px' }}>
            <SecTitle accent={AMB}>Pontos de Atenção</SecTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {atencoes.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 9 }}>!</span>
                  </div>
                  <span style={{ fontSize: 8.5, color: '#334155', lineHeight: 1.5 }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Objetivo imediato — bloco de destaque */}
        <div style={{ background: GFC2, borderRadius: 12, padding: '14px 20px', marginBottom: 12 }}>
          <div style={{ fontSize: 8, fontWeight: 900, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>🎯 Objetivo Imediato</div>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'white', lineHeight: 1.5 }}>{gerarObjetivo(st)}</p>
        </div>

        {/* Espaço para notas da comissão */}
        <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Observações da Comissão Técnica</div>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ borderBottom: '1px solid #e2e8f0', height: 28, marginBottom: 4 }} />)}
        </div>

        {/* Assinatura */}
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8' }}>CIC — Central de Inteligência do Confiança</div>
          <div style={{ fontSize: 7, color: '#cbd5e1', marginTop: 2 }}>Série C 2026 · Gerado automaticamente em {geradoEm} · Confidencial</div>
        </div>

        <PageFooter page={6} total={TOTAL} geradoEm={geradoEm} />
      </div>
    </>
  )
}

export default function CampanhaGuarani() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter,sans-serif', color: '#94a3b8', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Preparando relatório CIC...
      </div>
    }>
      <CampanhaContent />
    </Suspense>
  )
}
