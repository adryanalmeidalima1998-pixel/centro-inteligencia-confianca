'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../../components/layout/AppShell'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, ComposedChart, Area
} from 'recharts'
import TabComparacao from '../TabComparacao'

const BRAND_PRIMARY  = '#0a66b7'
const RED  = '#c62828'
const AMB  = '#b45309'
const PURP = '#6a1b9a'
const BRAND_DARK = '#eaf4fd'
const BLUE = '#1565c0'
const TEAL = '#00796b'

/* ─── Helpers ─────────────────────────────────────────────────────── */
const calcIdade = (d) => d ? Math.floor((Date.now()-new Date(d))/(1000*60*60*24*365.25)) : null
const safeNum   = (v, fb=0) => { const n=parseFloat(v); return isNaN(n)?fb:n }
const pct       = (num, den) => den>0 ? Math.round((safeNum(num)/safeNum(den))*100) : 0
const p90       = (v, m) => m>0 ? Math.round((safeNum(v)/safeNum(m))*90*100)/100 : 0
const norm      = (v, max) => max>0 ? Math.min(100, Math.round((v/max)*100)) : 0

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleDateString('pt-BR')
}

const PAIS_FLAG = {
  // América do Sul
  'Brasil':'🇧🇷','Argentina':'🇦🇷','Colômbia':'🇨🇴','Uruguai':'🇺🇾','Chile':'🇨🇱',
  'Paraguai':'🇵🇾','Bolívia':'🇧🇴','Peru':'🇵🇪','Equador':'🇪🇨','Venezuela':'🇻🇪',
  'Suriname':'🇸🇷','Guiana':'🇬🇾',
  // América do Norte e Central
  'México':'🇲🇽','EUA':'🇺🇸','Canadá':'🇨🇦','Costa Rica':'🇨🇷','Honduras':'🇭🇳',
  'Guatemala':'🇬🇹','El Salvador':'🇸🇻','Panamá':'🇵🇦','Haiti':'🇭🇹','Jamaica':'🇯🇲',
  'Cuba':'🇨🇺','Trinidad e Tobago':'🇹🇹','República Dominicana':'🇩🇴',
  // Europa Ocidental
  'Portugal':'🇵🇹','Espanha':'🇪🇸','Itália':'🇮🇹','Alemanha':'🇩🇪','França':'🇫🇷',
  'Inglaterra':'🇬🇧','Holanda':'🇳🇱','Bélgica':'🇧🇪','Suíça':'🇨🇭','Áustria':'🇦🇹',
  'Irlanda':'🇮🇪','País de Gales':'🇬🇧','Grécia':'🇬🇷','Turquia':'🇹🇷','Luxemburgo':'🇱🇺',
  // Europa do Norte
  'Dinamarca':'🇩🇰','Suécia':'🇸🇪','Noruega':'🇳🇴','Finlândia':'🇫🇮','Islândia':'🇮🇸',
  // Europa do Leste e Balcãs
  'Croácia':'🇭🇷','Sérvia':'🇷🇸','Romênia':'🇷🇴','Polônia':'🇵🇱','República Checa':'🇨🇿',
  'Hungria':'🇭🇺','Bulgária':'🇧🇬','Ucrânia':'🇺🇦','Rússia':'🇷🇺','Eslováquia':'🇸🇰',
  'Eslovênia':'🇸🇮','Bósnia e Herzegovina':'🇧🇦','Albânia':'🇦🇱','Kosovo':'🇽🇰',
  'Montenegro':'🇲🇪','Macedônia do Norte':'🇲🇰','Moldova':'🇲🇩','Belarus':'🇧🇾',
  'Geórgia':'🇬🇪','Armênia':'🇦🇲','Azerbaijão':'🇦🇿','Cazaquistão':'🇰🇿',
  'Estônia':'🇪🇪','Letônia':'🇱🇻','Lituânia':'🇱🇹',
  // Mediterrâneo e Oriente Médio
  'Israel':'🇮🇱','Chipre':'🇨🇾','Malta':'🇲🇹','Arábia Saudita':'🇸🇦',
  'Emirados Árabes':'🇦🇪','Catar':'🇶🇦','Kuwait':'🇰🇼','Bahrein':'🇧🇭',
  'Iraque':'🇮🇶','Irã':'🇮🇷','Jordânia':'🇯🇴','Omã':'🇴🇲','Síria':'🇸🇾',
  'Líbano':'🇱🇧','Palestina':'🇵🇸','Iêmen':'🇾🇪',
  // Ásia
  'Japão':'🇯🇵','Coreia do Sul':'🇰🇷','Coreia do Norte':'🇰🇵','China':'🇨🇳',
  'Indonésia':'🇮🇩','Tailândia':'🇹🇭','Malásia':'🇲🇾','Vietnam':'🇻🇳',
  'Filipinas':'🇵🇭','Singapura':'🇸🇬','Camboja':'🇰🇭','Myanmar':'🇲🇲',
  'Índia':'🇮🇳','Bangladesh':'🇧🇩','Paquistão':'🇵🇰','Sri Lanka':'🇱🇰',
  'Nepal':'🇳🇵','Uzbequistão':'🇺🇿','Quirguistão':'🇰🇬','Tajiquistão':'🇹🇯',
  'Turcomenistão':'🇹🇲','Afeganistão':'🇦🇫','Hong Kong':'🇭🇰','Macau':'🇲🇴',
  'Mongólia':'🇲🇳','Laos':'🇱🇦',
  // África
  'Egito':'🇪🇬','Marrocos':'🇲🇦','Argélia':'🇩🇿','Tunísia':'🇹🇳','Líbia':'🇱🇾',
  'Gana':'🇬🇭','Nigéria':'🇳🇬','Costa do Marfim':'🇨🇮','Senegal':'🇸🇳',
  'Camarões':'🇨🇲','África do Sul':'🇿🇦','Quênia':'🇰🇪','Etiópia':'🇪🇹',
  'Angola':'🇦🇴','Moçambique':'🇲🇿','Tanzânia':'🇹🇿','Uganda':'🇺🇬',
  'Zâmbia':'🇿🇲','Zimbabwe':'🇿🇼','Mali':'🇲🇱','Burkina Faso':'🇧🇫',
  'Guiné':'🇬🇳','Congo':'🇨🇬','RD Congo':'🇨🇩','Ruanda':'🇷🇼',
  'Sudão':'🇸🇩','Gabão':'🇬🇦','Serra Leoa':'🇸🇱','Libéria':'🇱🇷',
  // Oceania
  'Austrália':'🇦🇺','Nova Zelândia':'🇳🇿','Papua-Nova Guiné':'🇵🇬',
}
function getFlag(pais) {
  if (!pais) return ''
  return PAIS_FLAG[pais] || '🌐'
}

/* ─── Aggregate all metrics from metricas_json ─────────────────────── */
function aggregate(metricas) {
  if (!metricas?.length) return null
  const T = {
    jogos:0, minutos:0, gols:0, assists:0, xg:0, xa:0,
    remates_totais:0, remates_baliza:0,
    passes_totais:0, passes_certos:0,
    passes_longos:0, passes_longos_certos:0,
    cruzamentos:0, cruzamentos_certos:0,
    dribbles:0, dribbles_ok:0,
    duelos:0, duelos_ganhos:0,
    duelos_aereos:0, duelos_aereos_ganhos:0,
    duelos_def:0, duelos_def_ganhos:0,
    duelos_off:0, duelos_off_ganhos:0,
    bola_livre:0, bola_livre_ganhos:0,
    carrinhos:0, carrinhos_ok:0,
    intercepcoes:0,
    perdas_proprio:0, recuperacoes:0,
    amarelo:0, vermelho:0,
    amarelo2:0, vermelho2:0,
    toques_area:0, fora_jogo:0, corridas:0, faltas_sofridas:0,
    passes_prof:0, passes_prof_certos:0,
    passes_terco:0, passes_terco_certos:0,
    passes_area:0, passes_area_certos:0,
    passes_recebidos:0, passes_frente:0, passes_tras:0,
    acoes_totais:0, acoes_ok:0,
    assist_remate:0, segundas_assist:0, alivios:0, faltas:0,
  }
  metricas.forEach(g => {
    T.jogos++
    Object.keys(T).forEach(k => { if (k!=='jogos') T[k] += safeNum(g[k]) })
  })
  return T
}

/* ═══════════════════════════════════════════════════════════════════════
   IMPACT ENGINE V5 — Modelo de Mérito Absoluto
   Camada 1: Impact Engine (Wyscout, confiança 1.0)
   Camada 2: Shadow Rating (sem Wyscout, confiança 0.4)
   Camada 3: FNE — Fator de Nível de Enfrentamento
═══════════════════════════════════════════════════════════════════════ */

function getPosGrupo(posicao) {
  const p = (posicao||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  if (p.includes('goleiro') || p === 'gk') return 'GK'
  if (p.includes('zagueiro') || p === 'cb') return 'CB'
  if (p.includes('lateral direito') || p === 'rb') return 'RB'
  if (p.includes('lateral esquerdo') || p === 'lb') return 'LB'
  if (p.includes('lateral')) return 'RB'
  if (p.includes('volante') || p === 'dm' || p === 'cdm' || p === 'vol') return 'DM'
  if (p.includes('meia atacante') || p === 'cam' || p === 'am') return 'CAM'
  if (p.includes('meia') || p === 'cm' || p === 'mc') return 'CM'
  if (p.includes('ponta') || p.includes('extremo') || p === 'rw' || p === 'lw' || p === 'ala') return 'W'
  if (p.includes('centroavante') || p.includes('atacante') || p === 'st' || p === 'cf' || p === 'ca') return 'ST'
  return 'CM'
}

// ── Camada 3: FNE ──────────────────────────────────────────────────
function getFNE(competicao) {
  const c = (competicao||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  // Nível 1 — 1.00
  if (/serie.?a$|brasileirao.?a|libertadores|sul-americana|copa.?brasil.*(oitavas|quartas|semi|final)|champions|premier.?league|la.?liga|bundesliga|serie.?a.*(ital)|ligue.?1|eredivisie/.test(c)) return 1.00
  // Nível 2 — 0.90
  if (/serie.?b|paulistao|carioca|mineiro|gaucho|copa.?brasil|liga.?1.*indo|indonesia.*liga.?1|super.?league.*indo|indo.*super.?league|primeira.?liga|primeira.?divisao|allsvenskan|primeira|ekstraklasa|super.?lig/.test(c)) return 0.90
  // Nível 3 — 0.82
  if (/segunda.?liga|segunda.?division|2.*liga|league.?one|championship|liga.?pro|apertura|clausura|liga.?futve|ecuador|venezuela.*primera|primera.*venezuela|cypru|cipro|segunda.*espanhola|2a.*div|segunda.?b/.test(c)) return 0.82
  // Nível 4 — 0.75
  if (/serie.?c|cearense|pernambucano|baiano|amazonense|paranaense|alagoano|potiguar|maranhense|acreano|goiano|piauiense|sergipano|tocantinense|paraibano|capixaba|campeonato.?de.?portugal|terceira/.test(c)) return 0.75
  // Nível 5 — 0.60
  if (/serie.?d|copa.?verde|copa.?nordeste|copa.?sao.?paulo|sub.?20|copa.?estado|copa.?interior|futsal|piala/.test(c)) return 0.60
  return 0.85 // default: liga internacional não mapeada — conservador mas não punitivo
}

// ── Camada 1: Impact Engine V5 (dados Wyscout reais) ──────────────
// Piso profissional 6.5 + bônus diretos + regras de proteção de elite
function calcImpactEngine(g) {
  const mins = safeNum(g.minutos)
  if (mins < 15) return null

  const gols    = safeNum(g.gols)
  const assists = safeNum(g.assists)
  const xg      = safeNum(g.xg)
  const xa      = safeNum(g.xa)
  const assistRemate = safeNum(g.assist_remate) // grande chance criada (proxy)
  const remates = safeNum(g.remates_totais)
  const amarelo = safeNum(g.amarelo2)
  const vermelho= safeNum(g.vermelho2)

  // 1. Nota base — piso profissional
  let nota = 6.5

  // 2. Bônus de impacto (soma direta)
  nota += gols    * 1.5
  nota += assists * 1.0
  nota += Math.min(xg,  3) * 1.2  // cap em 3 para não inflacionar
  nota += Math.min(xa,  2) * 1.0
  nota += Math.min(assistRemate, 4) * 0.6
  nota += Math.min(remates, 8) * 0.1 // passe-chave / finalização proxy

  // 3. Penalidades graves
  nota += vermelho * -2.5
  nota += amarelo  * -0.3

  // 4. Ajuste por participação (se jogou menos de 60min, escala o piso)
  if (mins < 60) nota = nota * (mins / 60) + 6.5 * (1 - mins / 60)

  // 5. Regras de proteção de elite — nota mínima garantida
  if (gols >= 2 && assists >= 1) nota = Math.max(nota, 10.0)
  else if (gols >= 2 || (gols >= 1 && assists >= 1)) nota = Math.max(nota, 8.8)
  else if (gols >= 1 || assists >= 1) nota = Math.max(nota, 7.8)

  return Math.round(Math.min(10.0, Math.max(0, nota)) * 10) / 10
}

// ── Camada 2: Shadow Rating (sem Wyscout) ─────────────────────────
// Base = EWMA das últimas notas reais + ajuste resultado + bônus individual
function calcShadowRating(j, ewmaBase) {
  const mins    = safeNum(j['Minutos'])
  if (mins < 1 && j['Titular'] !== 'Sim') return null

  const gols    = safeNum(j['Gols'])
  const assists = safeNum(j['Assistências'])
  const amarelo = safeNum(j['Cartões Amarelos'])
  const vermelho= safeNum(j['Cartões Vermelhos'])

  // Detecta resultado do placar
  const gt = safeNum(j['Gols Atlético Cearense'] ?? j['Gols Time'] ?? 0)
  const ga = safeNum(j['Gols adversário'] ?? 0)
  const temPlacar = (j['Gols adversário'] !== null && j['Gols adversário'] !== undefined)
    && (j['Gols Atlético Cearense'] !== null || j['Gols Time'] !== null)

  let ajusteResultado = 0
  if (temPlacar) {
    if (gt > ga)        ajusteResultado = +0.4
    else if (gt === ga) ajusteResultado = +0.1
    else                ajusteResultado = -0.2
  }

  // Base ancorada no EWMA histórico
  const base = ewmaBase !== null ? ewmaBase : 6.5

  // Bônus individual direto (mesmo espírito do Impact Engine)
  const bonusIndiv = (gols * 1.5) + (assists * 1.0) + (vermelho * -2.5) + (amarelo * -0.3)

  // Fator participação
  const fatPartic = mins >= 60 ? 1.0 : mins >= 30 ? 0.85 : 0.65

  const notaRaw = base + (ajusteResultado) + (bonusIndiv * fatPartic)

  // Proteção de elite no Shadow também
  let nota = notaRaw
  if (gols >= 2 && assists >= 1) nota = Math.max(nota, 10.0)
  else if (gols >= 2 || (gols >= 1 && assists >= 1)) nota = Math.max(nota, 8.8)
  else if (gols >= 1 || assists >= 1) nota = Math.max(nota, 7.8)

  return Math.round(Math.min(10.0, Math.max(0, nota)) * 10) / 10
}

// ── Motor unificado ────────────────────────────────────────────────
function calcNotaJogo(g, posGrupo, ewmaBase = null) {
  if (!g) return null
  const isWyscout = g.jogo !== undefined || g.xg !== undefined || g.passes_totais !== undefined
  if (isWyscout) {
    const nota = calcImpactEngine(g)
    if (nota === null) return null
    return { nota, confianca: 1.0, tipo: 'wyscout' }
  } else {
    const nota = calcShadowRating(g, ewmaBase)
    if (nota === null) return null
    return { nota, confianca: 0.4, tipo: 'shadow' }
  }
}

// ── EWMA cronológico ──────────────────────────────────────────────
function calcEWMA(notas, alpha = 0.3) {
  if (!notas.length) return null
  let ewma = notas[0]
  for (let i = 1; i < notas.length; i++) ewma = alpha * notas[i] + (1 - alpha) * ewma
  return ewma
}

// ── Nota geral: ponderada por confiança + FNE ─────────────────────
function calcNotaGeral(metricas, jogosTemp, posGrupo) {
  const metOrd = (metricas||[]).slice().sort((a,b) => (a.date||'').localeCompare(b.date||''))
  const ewmaBase = calcEWMA(metOrd.map(g => calcNotaJogo(g, posGrupo)?.nota).filter(Boolean))

  const todos = []
  for (const g of metOrd) {
    const r = calcNotaJogo(g, posGrupo)
    if (!r) continue
    todos.push({ ...r, notaFinal: r.nota * getFNE(g.competition || '') })
  }
  for (const j of (jogosTemp||[])) {
    if (safeNum(j['Minutos']) < 1 && j['Titular'] === null) continue
    const r = calcNotaJogo(j, posGrupo, ewmaBase)
    if (!r) continue
    todos.push({ ...r, notaFinal: r.nota * getFNE(j['Competição'] || '') })
  }
  if (!todos.length) return null

  let sumPeso = 0, sumNota = 0
  for (const t of todos) { sumNota += t.notaFinal * t.confianca; sumPeso += t.confianca }

  return {
    nota: Math.round((sumNota / sumPeso) * 10) / 10,
    jogosWyscout: todos.filter(t=>t.tipo==='wyscout').length,
    jogosShadow:  todos.filter(t=>t.tipo==='shadow').length,
    total: todos.length,
    confiancaGeral: Math.round((sumPeso / todos.length) * 100),
  }
}

function calcNotasPorAno(metricas, jogosTemp, posGrupo) {
  const metOrd = (metricas||[]).slice().sort((a,b) => (a.date||'').localeCompare(b.date||''))
  const ewmaBase = calcEWMA(metOrd.map(g => calcNotaJogo(g, posGrupo)?.nota).filter(Boolean))
  const byAno = {}
  const add = (ano, notaFinal, confianca, tipo) => {
    if (!byAno[ano]) byAno[ano] = []
    byAno[ano].push({ notaFinal, confianca, tipo })
  }
  for (const g of metOrd) {
    const r = calcNotaJogo(g, posGrupo)
    if (!r) continue
    add((g.date||'????').slice(0,4), r.nota * getFNE(g.competition||''), r.confianca, 'wyscout')
  }
  for (const j of (jogosTemp||[])) {
    if (safeNum(j['Minutos']) < 1 && j['Titular'] === null) continue
    const r = calcNotaJogo(j, posGrupo, ewmaBase)
    if (!r) continue
    add((j['Data']||'????').slice(0,4), r.nota * getFNE(j['Competição']||''), r.confianca, 'shadow')
  }
  return Object.entries(byAno).sort((a,b)=>b[0].localeCompare(a[0])).map(([ano, itens]) => {
    let sp = 0, sn = 0
    for (const it of itens) { sn += it.notaFinal * it.confianca; sp += it.confianca }
    return {
      ano,
      nota: Math.round((sn/sp)*10)/10,
      jogosWyscout: itens.filter(i=>i.tipo==='wyscout').length,
      jogosShadow:  itens.filter(i=>i.tipo==='shadow').length,
      total: itens.length,
    }
  })
}

function NotaBadge({ nota, confianca, size='md' }) {
  if (nota === null || nota === undefined) return <span style={{ fontSize:size==='sm'?9:11, color:'#c0d8c4' }}>—</span>
  const color = nota >= 7.5 ? BRAND_PRIMARY : nota >= 6 ? TEAL : nota >= 5 ? AMB : RED
  const bg    = nota >= 7.5 ? BRAND_PRIMARY+'15' : nota >= 6 ? TEAL+'15' : nota >= 5 ? AMB+'15' : RED+'15'
  const fs    = size === 'sm' ? 10 : size === 'lg' ? 28 : 14
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:bg, border:`1px solid ${color}40`, borderRadius:size==='lg'?12:6,
      padding: size==='lg'?'8px 14px':'2px 7px', minWidth: size==='lg'?60:36, textAlign:'center', gap:1 }}>
      <span style={{ fontSize:fs, fontWeight:900, color, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>
        {nota.toFixed(1)}
      </span>
      {confianca !== undefined && size !== 'sm' && (
        <span style={{ fontSize:7, color: confianca < 60 ? AMB : '#94a3b8', marginTop:2 }}>
          {confianca < 60 ? '~shadow' : '●wyscout'}
        </span>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color=BRAND_PRIMARY, big=false }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'12px 14px', textAlign:'center' }}>
      <p style={{ fontSize:big?30:22, fontWeight:900, color, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{value ?? '—'}</p>
      <p style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginTop:4 }}>{label}</p>
      {sub && <p style={{ fontSize:9, color:'#c0d8c4', marginTop:2 }}>{sub}</p>}
    </div>
  )
}

/* ─── Progress bar metric ────────────────────────────────────────────── */
function MetricRow({ label, value, max100, pctVal, color=BRAND_PRIMARY, extra }) {
  const w = pctVal != null ? pctVal : (max100 ? norm(value, max100) : null)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', borderBottom:'1px solid #f7fcf9' }}>
      <span style={{ fontSize:10, color:'#94a3b8', minWidth:170, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:11, fontWeight:700, color:'#10233b', minWidth:36, textAlign:'right' }}>{value}</span>
      {w != null && (
        <div style={{ flex:1, height:5, background:'#f4f8fc', borderRadius:99, overflow:'hidden' }}>
          <div style={{ width:`${Math.min(100,w)}%`, height:'100%', background:color, borderRadius:99, transition:'width 0.4s' }} />
        </div>
      )}
      {w != null && <span style={{ fontSize:9, color:'#94a3b8', minWidth:28, textAlign:'right' }}>{Math.round(w)}%</span>}
      {extra && <span style={{ fontSize:9, color:color, fontWeight:700 }}>{extra}</span>}
    </div>
  )
}

/* ─── Section header ─────────────────────────────────────────────────── */
function SectionTitle({ label, icon }) {
  return (
    <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:10, display:'flex', alignItems:'center', gap:5 }}>
      {icon} {label}
    </p>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB DESEMPENHO — rich & professional
═══════════════════════════════════════════════════════════════════════ */
function TabDesempenho({ atleta, metricas }) {
  const [obs, setObs]     = useState(atleta.observacoes || '')
  const [saving, setSaving] = useState(false)

  const T   = aggregate(metricas)
  const m   = T?.minutos || 0

  const posGrupo    = getPosGrupo(atleta.posicao)
  const jogosTemp   = atleta.jogos_temporada_json || []
  const notaGeral   = calcNotaGeral(metricas, jogosTemp, posGrupo)
  const notasPorAno = calcNotasPorAno(metricas, jogosTemp, posGrupo)

  const saveObs = async () => {
    setSaving(true)
    await fetch('/api/monitoramento', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'save_obs', id:atleta.id, observacoes:obs }) })
    setSaving(false)
  }

  /* ── Last 15 games for evolution chart ── */
  const last15 = (metricas||[]).slice(0,15).reverse().map(g => ({
    jogo: (g.jogo||'').replace(/^\S+ - /,'').replace(/ \d+:\d+$/,'').slice(0,12),
    gols: safeNum(g.gols), assists: safeNum(g.assists),
    xg: safeNum(g.xg), mins: safeNum(g.minutos),
  }))

  /* ── Radar datasets ── */
  const radarAtaque = T ? [
    { m:'xG/90', v: norm(p90(T.xg,m), 0.6) },
    { m:'Remates/90', v: norm(p90(T.remates_totais,m), 5) },
    { m:'Dribble %', v: pct(T.dribbles_ok,T.dribbles) },
    { m:'Duelos Off %', v: pct(T.duelos_off_ganhos,T.duelos_off) },
    { m:'Toques Área/90', v: norm(p90(T.toques_area,m), 4) },
    { m:'xA/90', v: norm(p90(T.xa,m), 0.3) },
  ] : []

  const radarPasse = T ? [
    { m:'Precisão Geral', v: pct(T.passes_certos,T.passes_totais) },
    { m:'Passes Longos %', v: pct(T.passes_longos_certos,T.passes_longos) },
    { m:'Cruzamentos %', v: pct(T.cruzamentos_certos,T.cruzamentos) },
    { m:'Passes Prof/90', v: norm(p90(T.passes_prof,m), 3) },
    { m:'Passes Terço/90', v: norm(p90(T.passes_terco,m), 6) },
    { m:'Passes Área/90', v: norm(p90(T.passes_area,m), 2) },
  ] : []

  const radarDuelo = T ? [
    { m:'Duelos %', v: pct(T.duelos_ganhos,T.duelos) },
    { m:'Aéreos %', v: pct(T.duelos_aereos_ganhos,T.duelos_aereos) },
    { m:'Def %', v: pct(T.duelos_def_ganhos,T.duelos_def) },
    { m:'Bola Livre %', v: pct(T.bola_livre_ganhos,T.bola_livre) },
    { m:'Carrinhos %', v: pct(T.carrinhos_ok,T.carrinhos) },
    { m:'Faltas Prov/90', v: norm(p90(T.faltas_sofridas,m), 4) },
  ] : []

  const radarDef = T ? [
    { m:'Intercep/90', v: norm(p90(T.intercepcoes,m), 3) },
    { m:'Recup/90', v: norm(p90(T.recuperacoes,m), 4) },
    { m:'Alívios/90', v: norm(p90(T.alivios,m), 2) },
    { m:'Perdas(inv)/90', v: Math.max(0, 100 - norm(p90(T.perdas_proprio,m), 5)) },
    { m:'Duelos Def %', v: pct(T.duelos_def_ganhos,T.duelos_def) },
    { m:'Carrinhos/90', v: norm(p90(T.carrinhos,m), 2) },
  ] : []

  // ── Pizza Plot (Percentile Chart) SVG puro ──────────────────────────────
  const PizzaPlot = ({ title, data, color, icon, darkBg = false }) => {
    const cx = 100, cy = 100, r = 76
    const n = data.length
    const sliceAngle = (2 * Math.PI) / n
    const bg = darkBg ? '#1a2e1a' : '#fff'
    const trackColor = darkBg ? '#2a4a2a' : '#f4f8fc'
    const labelColor = darkBg ? '#86efac' : '#64748b'
    const textColor  = darkBg ? '#fff' : '#10233b'

    const slices = data.map((d, i) => {
      const startAngle = i * sliceAngle - Math.PI / 2
      const endAngle   = startAngle + sliceAngle
      const pct = Math.max(0, Math.min(100, d.v || 0))
      const rSlice = (pct / 100) * r

      // Track arc (full ring)
      const trackX1 = cx + r * Math.cos(startAngle + 0.04)
      const trackY1 = cy + r * Math.sin(startAngle + 0.04)
      const trackX2 = cx + r * Math.cos(endAngle - 0.04)
      const trackY2 = cy + r * Math.sin(endAngle - 0.04)

      // Value slice
      const vX1 = cx + rSlice * Math.cos(startAngle + 0.04)
      const vY1 = cy + rSlice * Math.sin(startAngle + 0.04)
      const vX2 = cx + rSlice * Math.cos(endAngle - 0.04)
      const vY2 = cy + rSlice * Math.sin(endAngle - 0.04)

      // Label position (outside the pizza)
      const midAngle = startAngle + sliceAngle / 2
      const lx = cx + (r + 18) * Math.cos(midAngle)
      const ly = cy + (r + 18) * Math.sin(midAngle)
      const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle'

      // Percentile color
      const pColor = pct >= 80 ? '#16a34a' : pct >= 60 ? color : pct >= 40 ? '#b45309' : '#c62828'

      return { trackX1,trackY1,trackX2,trackY2, vX1,vY1,vX2,vY2, rSlice, startAngle, endAngle, midAngle, lx, ly, anchor, pct, pColor, label:d.m }
    })

    return (
      <div style={{ background: bg, borderRadius:14, border:`1px solid ${darkBg?'#2a4a2a':'#e5edf5'}`, padding:'14px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, paddingLeft:4 }}>
          <span style={{ fontSize:12 }}>{icon}</span>
          <span style={{ fontSize:10, fontWeight:800, color:textColor, letterSpacing:'0.04em' }}>{title}</span>
        </div>
        <svg viewBox="0 0 200 200" width="100%" style={{ display:'block', maxHeight:200 }}>
          {/* Background rings */}
          {[25,50,75,100].map(pct => (
            <circle key={pct} cx={cx} cy={cy} r={(pct/100)*r} fill="none" stroke={trackColor} strokeWidth={pct===100?1:0.5} strokeDasharray={pct===100?'':'3 2'} />
          ))}
          {/* Center dot */}
          <circle cx={cx} cy={cy} r={3} fill={color} />

          {slices.map((s, i) => (
            <g key={i}>
              {/* Track */}
              <path
                d={`M ${cx} ${cy} L ${s.trackX1} ${s.trackY1} A ${r} ${r} 0 0 1 ${s.trackX2} ${s.trackY2} Z`}
                fill={trackColor} stroke={bg} strokeWidth={1.5}
              />
              {/* Value */}
              {s.pct > 0 && (
                <path
                  d={`M ${cx} ${cy} L ${s.vX1} ${s.vY1} A ${s.rSlice} ${s.rSlice} 0 0 1 ${s.vX2} ${s.vY2} Z`}
                  fill={s.pColor} stroke={bg} strokeWidth={1} opacity={0.92}
                />
              )}
              {/* Label */}
              <text x={s.lx} y={s.ly - 4} textAnchor={s.anchor} fontSize={5.5} fill={labelColor} fontFamily="inherit" fontWeight="700">
                {s.label}
              </text>
              <text x={s.lx} y={s.ly + 5} textAnchor={s.anchor} fontSize={6.5} fill={s.pColor} fontFamily="inherit" fontWeight="900">
                {s.pct}%
              </text>
            </g>
          ))}
        </svg>
      </div>
    )
  }

  if (!T) return (
    <div style={{ textAlign:'center', padding:60, background:'#fff', borderRadius:14, border:'1px solid #e5edf5' }}>
      <p style={{ fontSize:24, marginBottom:8 }}>📊</p>
      <p style={{ fontSize:11, color:'#94a3b8' }}>Faça upload da planilha para ver o desempenho completo.</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Índice de Performance ── */}
      {notaGeral && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:'16px 20px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <SectionTitle label={`Shadow Rating · ${posGrupo}`} icon="📊" />
              <div style={{ display:'flex', gap:10, marginTop:-4 }}>
                <span style={{ fontSize:9, color:'#94a3b8' }}>
                  <strong style={{ color:BRAND_PRIMARY }}>{notaGeral.jogosWyscout}</strong> jogos Wyscout (confiança 1.0)
                </span>
                <span style={{ fontSize:9, color:'#94a3b8' }}>
                  <strong style={{ color:AMB }}>{notaGeral.jogosShadow}</strong> jogos Shadow (confiança 0.4)
                </span>
                <span style={{ fontSize:9, background: notaGeral.confiancaGeral >= 70 ? BRAND_PRIMARY+'15' : AMB+'15',
                  color: notaGeral.confiancaGeral >= 70 ? BRAND_PRIMARY : AMB,
                  borderRadius:10, padding:'1px 8px', fontWeight:700 }}>
                  {notaGeral.confiancaGeral}% confiança
                </span>
              </div>
            </div>
            <NotaBadge nota={notaGeral.nota} confianca={notaGeral.confiancaGeral} size="lg" />
          </div>

          {/* Barra visual */}
          <div style={{ position:'relative', height:8, background:'#f4f8fc', borderRadius:99, marginBottom:10, overflow:'hidden' }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:99, transition:'width 0.6s',
              width:`${notaGeral.nota*10}%`,
              background: notaGeral.nota>=7.5?BRAND_PRIMARY : notaGeral.nota>=6?TEAL : notaGeral.nota>=5?AMB:RED,
            }}/>
            {[5,6,7.5].map(ref => (
              <div key={ref} style={{ position:'absolute', left:`${ref*10}%`, top:0, height:'100%', width:1, background:'rgba(255,255,255,0.6)' }}/>
            ))}
          </div>

          {/* Legenda escala */}
          <div style={{ display:'flex', gap:12, marginBottom:14 }}>
            {[
              { label:'< 5.0', desc:'Abaixo do esperado', color:RED },
              { label:'5.0–5.9', desc:'Regular', color:AMB },
              { label:'6.0–7.4', desc:'Bom', color:TEAL },
              { label:'≥ 7.5', desc:'Excelente', color:BRAND_PRIMARY },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:l.color }} />
                <span style={{ fontSize:9, color:'#94a3b8' }}>{l.desc} <strong style={{ color:l.color }}>{l.label}</strong></span>
              </div>
            ))}
          </div>

          {/* Notas por temporada */}
          {notasPorAno.length > 0 && (
            <div>
              <p style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>Por temporada</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {notasPorAno.map(a => (
                  <div key={a.ano} style={{ background:'#f7fcf9', borderRadius:10, border:'1px solid #e5edf5', padding:'8px 14px', textAlign:'center', minWidth:90 }}>
                    <p style={{ fontSize:9, color:'#94a3b8', marginBottom:4, fontWeight:700 }}>{a.ano}</p>
                    <NotaBadge nota={a.nota} size="md" />
                    <div style={{ marginTop:5, display:'flex', gap:4, justifyContent:'center' }}>
                      {a.jogosWyscout > 0 && <span style={{ fontSize:7, background:BRAND_PRIMARY+'15', color:BRAND_PRIMARY, borderRadius:8, padding:'0 4px' }}>W:{a.jogosWyscout}</span>}
                      {a.jogosShadow > 0  && <span style={{ fontSize:7, background:AMB+'15', color:AMB, borderRadius:8, padding:'0 4px' }}>S:{a.jogosShadow}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI bar ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:8 }}>
        {[
          { l:'Jogos',   v:T.jogos,              c:'#10233b' },
          { l:'Minutos', v:T.minutos,             c:'#10233b' },
          { l:'Gols',    v:T.gols,                c:BRAND_PRIMARY },
          { l:'Assists', v:T.assists,             c:BRAND_PRIMARY },
          { l:'xG',      v:T.xg.toFixed(1),      c:TEAL },
          { l:'xA',      v:T.xa.toFixed(1),      c:TEAL },
          { l:'🟨',      v:T.amarelo2,            c:AMB },
          { l:'🟥',      v:T.vermelho2,           c:RED },
        ].map(({ l, v, c }) => <StatCard key={l} label={l} value={v} color={c} />)}
      </div>

      {/* ── Per-90 highlights ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
        {[
          { l:'Gols/90',       v:p90(T.gols,m).toFixed(2),   c:BRAND_PRIMARY },
          { l:'Assists/90',    v:p90(T.assists,m).toFixed(2), c:BRAND_PRIMARY },
          { l:'xG/90',         v:p90(T.xg,m).toFixed(2),     c:TEAL },
          { l:'xA/90',         v:p90(T.xa,m).toFixed(2),     c:TEAL },
          { l:'Remates/90',    v:p90(T.remates_totais,m).toFixed(1), c:BLUE },
          { l:'Dribbles/90',   v:p90(T.dribbles,m).toFixed(1),       c:BLUE },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background:BRAND_DARK, borderRadius:10, border:`1px solid ${BRAND_PRIMARY}22`, padding:'8px 10px', textAlign:'center' }}>
            <p style={{ fontSize:16, fontWeight:900, color:c, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{v}</p>
            <p style={{ fontSize:8, color:'#64748b', marginTop:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>{l}</p>
          </div>
        ))}
      </div>

      {/* ── 4 Pizza Plots ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
        <PizzaPlot title="Ataque & Finalização" data={radarAtaque} color={BRAND_PRIMARY}  icon="⚽" />
        <PizzaPlot title="Passes & Criação"     data={radarPasse}  color={BLUE} icon="🎯" />
        <PizzaPlot title="Duelos"               data={radarDuelo}  color={AMB}  icon="⚔️" />
        <PizzaPlot title="Defesa & Recuperação" data={radarDef}    color={TEAL} icon="🛡️" />
      </div>

      {/* ── Evolution chart ── */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:'16px 18px' }}>
        <SectionTitle label="Evolução por jogo (últimos 15)" icon="📈" />
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={last15} margin={{ top:0, right:10, bottom:0, left:-20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f8fc" />
            <XAxis dataKey="jogo" tick={{ fontSize:8, fill:'#94a3b8' }} />
            <YAxis tick={{ fontSize:8, fill:'#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize:10, borderRadius:8 }} />
            <Legend wrapperStyle={{ fontSize:9 }} />
            <Bar dataKey="gols"   name="Gols"       fill={BRAND_PRIMARY}  radius={[3,3,0,0]} />
            <Bar dataKey="assists" name="Assists"   fill={BRAND_DARK} stroke={BRAND_PRIMARY} strokeWidth={1} radius={[3,3,0,0]} />
            <Line dataKey="xg" name="xG" stroke={TEAL} strokeWidth={2} dot={{ r:3, fill:TEAL }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Detailed metrics table ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

        {/* ATAQUE */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px' }}>
          <SectionTitle label="Ataque" icon="⚽" />
          <MetricRow label="Gols"                value={T.gols}             max100={null} pctVal={null} />
          <MetricRow label="Assistências"         value={T.assists}          max100={null} pctVal={null} />
          <MetricRow label="xG"                  value={T.xg.toFixed(2)}    max100={null} pctVal={null} />
          <MetricRow label="xA"                  value={T.xa.toFixed(2)}    max100={null} pctVal={null} />
          <MetricRow label="Remates totais"       value={T.remates_totais}   extra={`${pct(T.remates_baliza,T.remates_totais)}% à baliza`} />
          <MetricRow label="Remates à baliza"     value={T.remates_baliza}   pctVal={pct(T.remates_baliza,T.remates_totais)} color={BRAND_PRIMARY} />
          <MetricRow label="Dribbles"             value={T.dribbles}         pctVal={pct(T.dribbles_ok,T.dribbles)} color={BRAND_PRIMARY} extra={`${T.dribbles_ok} ok`} />
          <MetricRow label="Toques na área"       value={T.toques_area}      max100={null} />
          <MetricRow label="Assist. para remate"  value={T.assist_remate}    max100={null} />
          <MetricRow label="Segundas assistências" value={T.segundas_assist} max100={null} />
          <MetricRow label="Faltas sofridas"      value={T.faltas_sofridas}  max100={null} />
          <MetricRow label="Foras de jogo"        value={T.fora_jogo}        max100={null} />
        </div>

        {/* PASSES */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px' }}>
          <SectionTitle label="Passes" icon="🎯" />
          <MetricRow label="Passes totais"        value={T.passes_totais}    pctVal={pct(T.passes_certos,T.passes_totais)} color={BLUE} extra={`${pct(T.passes_certos,T.passes_totais)}%`} />
          <MetricRow label="Passes certos"        value={T.passes_certos}    pctVal={pct(T.passes_certos,T.passes_totais)} color={BLUE} />
          <MetricRow label="Passes longos"        value={T.passes_longos}    pctVal={pct(T.passes_longos_certos,T.passes_longos)} color={BLUE} extra={`${pct(T.passes_longos_certos,T.passes_longos)}%`} />
          <MetricRow label="Cruzamentos"          value={T.cruzamentos}      pctVal={pct(T.cruzamentos_certos,T.cruzamentos)} color={BLUE} extra={`${pct(T.cruzamentos_certos,T.cruzamentos)}%`} />
          <MetricRow label="Passes em profundidade" value={T.passes_prof}   pctVal={pct(T.passes_prof_certos,T.passes_prof)} color={BLUE} extra={`${pct(T.passes_prof_certos,T.passes_prof)}%`} />
          <MetricRow label="Passes para terço final" value={T.passes_terco} pctVal={pct(T.passes_terco_certos,T.passes_terco)} color={BLUE} extra={`${pct(T.passes_terco_certos,T.passes_terco)}%`} />
          <MetricRow label="Passes para grande área" value={T.passes_area}  pctVal={pct(T.passes_area_certos,T.passes_area)} color={BLUE} extra={`${pct(T.passes_area_certos,T.passes_area)}%`} />
          <MetricRow label="Passes recebidos"     value={T.passes_recebidos} max100={null} />
          <MetricRow label="Passes para a frente" value={T.passes_frente}    pctVal={pct(T.passes_frente_certos||0,T.passes_frente)} color={BLUE} />
          <MetricRow label="Passes para trás"     value={T.passes_tras}      pctVal={pct(T.passes_tras_certos||0,T.passes_tras)} color={BLUE} />
        </div>

        {/* DUELOS */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px' }}>
          <SectionTitle label="Duelos" icon="⚔️" />
          <MetricRow label="Duelos totais"        value={T.duelos}           pctVal={pct(T.duelos_ganhos,T.duelos)} color={AMB} extra={`${pct(T.duelos_ganhos,T.duelos)}% vencidos`} />
          <MetricRow label="Duelos ganhos"        value={T.duelos_ganhos}    pctVal={pct(T.duelos_ganhos,T.duelos)} color={AMB} />
          <MetricRow label="Duelos aéreos"        value={T.duelos_aereos}    pctVal={pct(T.duelos_aereos_ganhos,T.duelos_aereos)} color={AMB} extra={`${pct(T.duelos_aereos_ganhos,T.duelos_aereos)}%`} />
          <MetricRow label="Duelos ofensivos"     value={T.duelos_off}       pctVal={pct(T.duelos_off_ganhos,T.duelos_off)} color={BRAND_PRIMARY} extra={`${pct(T.duelos_off_ganhos,T.duelos_off)}%`} />
          <MetricRow label="Duelos defensivos"    value={T.duelos_def}       pctVal={pct(T.duelos_def_ganhos,T.duelos_def)} color={TEAL} extra={`${pct(T.duelos_def_ganhos,T.duelos_def)}%`} />
          <MetricRow label="Duelos bola livre"    value={T.bola_livre}       pctVal={pct(T.bola_livre_ganhos,T.bola_livre)} color={AMB} extra={`${pct(T.bola_livre_ganhos,T.bola_livre)}%`} />
          <MetricRow label="Carrinhos"            value={T.carrinhos}        pctVal={pct(T.carrinhos_ok,T.carrinhos)} color={TEAL} extra={`${pct(T.carrinhos_ok,T.carrinhos)}%`} />
        </div>

        {/* DEFESA & DISCIPLINA */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px' }}>
          <SectionTitle label="Defesa & Disciplina" icon="🛡️" />
          <MetricRow label="Intercepções"         value={T.intercepcoes}     max100={null} extra={`${p90(T.intercepcoes,m).toFixed(1)}/90`} />
          <MetricRow label="Recuperações"         value={T.recuperacoes}     max100={null} extra={`${p90(T.recuperacoes,m).toFixed(1)}/90`} />
          <MetricRow label="Perdas no próprio campo" value={T.perdas_proprio} max100={null} extra={`${p90(T.perdas_proprio,m).toFixed(1)}/90`} />
          <MetricRow label="Alívios"              value={T.alivios}          max100={null} />
          <MetricRow label="Corridas seguidas"    value={T.corridas}         max100={null} />
          <MetricRow label="Ações totais"         value={T.acoes_totais}     pctVal={pct(T.acoes_ok,T.acoes_totais)} color={BRAND_PRIMARY} extra={`${pct(T.acoes_ok,T.acoes_totais)}% ok`} />
          <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #e5edf5' }}>
            <SectionTitle label="Disciplina" icon="🟨" />
          </div>
          <MetricRow label="Faltas cometidas"     value={T.faltas}           extra={`${p90(T.faltas,m).toFixed(1)}/90`} />
          <MetricRow label="Cartões amarelos"     value={T.amarelo2}         color={AMB} extra={`${p90(T.amarelo2,m).toFixed(2)}/90`} />
          <MetricRow label="Cartões vermelhos"    value={T.vermelho2}        color={RED}  />
        </div>
      </div>

      {/* ── Observações ── */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:'16px 18px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <SectionTitle label="Observações do Scout" icon="✏️" />
          <button onClick={saveObs} disabled={saving} style={{ background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:7, padding:'5px 14px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {saving ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>
        <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Escreva observações, pontos fortes, a melhorar, contexto tático..."
          style={{ width:'100%', height:130, padding:'10px 12px', borderRadius:10, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit', resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.7, color:'#10233b' }} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB GERAL
═══════════════════════════════════════════════════════════════════════ */
function TabGeral({ atleta, T, onEdit }) {
  const idade = calcIdade(atleta.data_nascimento)

  // Stats da temporada atual via jogos_temporada_json
  const anoAtual = new Date().getFullYear().toString()
  const jogosTemp = (atleta.jogos_temporada_json || [])
  const jogosAno  = jogosTemp.filter(j => (j['Data']||'').startsWith(anoAtual))
  const tempStats = jogosAno.length > 0 ? {
    jogos:    jogosAno.length,
    jogados:  jogosAno.filter(j => safeNum(j['Minutos']) > 0).length,
    titular:  jogosAno.filter(j => j['Titular'] === 'Sim').length,
    minutos:  jogosAno.reduce((s,j) => s + safeNum(j['Minutos']), 0),
    gols:     jogosAno.reduce((s,j) => s + safeNum(j['Gols']), 0),
    assists:  jogosAno.reduce((s,j) => s + safeNum(j['Assistências']), 0),
    amarelos: jogosAno.reduce((s,j) => s + safeNum(j['Cartões Amarelos']), 0),
    vermelhos:jogosAno.reduce((s,j) => s + safeNum(j['Cartões Vermelhos']), 0),
  } : null
  const bioFields = [
    ['Data de Nascimento', atleta.data_nascimento ? fmtDate(atleta.data_nascimento) : null],
    ['Nacionalidade',      atleta.nacionalidade],
    ['Pé Preferido',       atleta.pe_preferido],
    ['Altura',             atleta.altura ? `${atleta.altura}m` : null],
    ['Clube',              atleta.time_atual],
    ['Liga',               atleta.liga ? `${atleta.pais_liga ? getFlag(atleta.pais_liga)+' ' : ''}${atleta.liga}` : null],
    ['Camisa',             atleta.numero_camisa ? `#${atleta.numero_camisa}` : null],
    ['Término Contrato',   atleta.data_contrato_fim ? fmtDate(atleta.data_contrato_fim) : null],
    ['Empresário',         atleta.empresario],
    ['Valor de Mercado',   atleta.valor_mercado],
    ['Status',             atleta.status],
    ['Nível de Interesse', atleta.nivel_interesse],
    ['Link externo',       atleta.link_externo ? 'link' : null],
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20 }}>
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <SectionTitle label="Informações" icon="👤" />
          <button onClick={onEdit} style={{ background:'none', border:'none', cursor:'pointer', fontSize:9, color:BRAND_PRIMARY, fontWeight:700 }}>✏ Editar</button>
        </div>
        {bioFields.map(([l, v]) => !v ? null : (
          <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f7fcf9' }}>
            <span style={{ fontSize:10, color:'#94a3b8' }}>{l}</span>
            {l === 'Link externo'
              ? <a href={atleta.link_externo} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, fontWeight:700, color:BRAND_PRIMARY }}>Abrir ↗</a>
              : <span style={{ fontSize:10, fontWeight:700, color:'#10233b', maxWidth:150, textAlign:'right' }}>{v}</span>
            }
          </div>
        ))}
      </div>

      <div>
        {/* ── Temporada atual (jogos_temporada_json) ── */}
        {tempStats && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <SectionTitle label={`Temporada ${anoAtual}`} icon="📅" />
              <span style={{ fontSize:9, color:'#94a3b8' }}>{tempStats.jogos} jogos cadastrados · {tempStats.jogados} com dados</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {[
                { l:'Jogos',     v: tempStats.jogados,  c:'#10233b' },
                { l:'Titular',   v: tempStats.titular,  c:'#10233b' },
                { l:'Minutos',   v: tempStats.minutos,  c:'#10233b' },
                { l:'Gols',      v: tempStats.gols,     c: BRAND_PRIMARY },
                { l:'Assists',   v: tempStats.assists,  c: BRAND_PRIMARY },
                { l:'G+A',       v: tempStats.gols + tempStats.assists, c: BRAND_PRIMARY },
                { l:'🟨',        v: tempStats.amarelos, c: AMB },
                { l:'🟥',        v: tempStats.vermelhos,c: RED },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background:'#f7fcf9', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                  <p style={{ fontSize:18, fontWeight:900, color:c, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{v}</p>
                  <p style={{ fontSize:8, color:'#94a3b8', marginTop:3, textTransform:'uppercase' }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Histórico Wyscout ── */}
        {T ? (
          <>
            <div style={{ marginBottom:6 }}><SectionTitle label="Histórico Wyscout (todos os jogos)" icon="📊" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
              {[
                { l:'Jogos',   v:T.jogos,             c:'#10233b' },
                { l:'Minutos', v:T.minutos,            c:'#10233b' },
                { l:'Gols',    v:T.gols,               c:BRAND_PRIMARY },
                { l:'Assists', v:T.assists,            c:BRAND_PRIMARY },
                { l:'xG',      v:T.xg.toFixed(1),     c:TEAL },
                { l:'xA',      v:T.xa.toFixed(1),     c:TEAL },
                { l:'🟨',      v:T.amarelo2,           c:AMB },
                { l:'🟥',      v:T.vermelho2,          c:RED },
              ].map(({ l, v, c }) => <StatCard key={l} label={l} value={v} color={c} />)}
            </div>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px' }}>
              <SectionTitle label="Por 90 Minutos" icon="⏱" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[
                  ['Gols/90',      p90(T.gols,T.minutos).toFixed(2)],
                  ['Assists/90',   p90(T.assists,T.minutos).toFixed(2)],
                  ['xG/90',        p90(T.xg,T.minutos).toFixed(2)],
                  ['Remates/90',   p90(T.remates_totais,T.minutos).toFixed(1)],
                  ['Dribbles/90',  p90(T.dribbles,T.minutos).toFixed(1)],
                  ['Recuper./90',  p90(T.recuperacoes,T.minutos).toFixed(1)],
                ].map(([l, v]) => (
                  <div key={l} style={{ background:'#f7fcf9', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                    <p style={{ fontSize:16, fontWeight:900, color:BRAND_PRIMARY, fontFamily:"'Barlow Condensed',sans-serif" }}>{v}</p>
                    <p style={{ fontSize:8, color:'#94a3b8' }}>{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          !tempStats && (
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:40, textAlign:'center' }}>
            <p style={{ fontSize:24, marginBottom:8 }}>📊</p>
            <p style={{ fontSize:11, color:'#94a3b8' }}>Faça upload da planilha para ver estatísticas.</p>
          </div>
          )
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB CARREIRA
═══════════════════════════════════════════════════════════════════════ */
function TabCarreira({ resumo }) {
  if (!resumo?.length) return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:60, textAlign:'center' }}>
      <p style={{ fontSize:11, color:'#94a3b8' }}>Sem dados de carreira. Faça upload da planilha completa.</p>
    </div>
  )
  const totalGols  = resumo.reduce((s,r)=>s+safeNum(r['Golos']),0)
  const totalAst   = resumo.reduce((s,r)=>s+safeNum(r['Assistências']),0)
  const totalJogos = resumo.reduce((s,r)=>s+safeNum(r['Jogos']),0)
  const totalMins  = resumo.reduce((s,r)=>s+safeNum(r['Minutos Totais']),0)

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[{ l:'Temporadas',v:resumo.length,c:'#10233b'},{l:'Jogos',v:totalJogos,c:'#10233b'},{l:'Gols',v:totalGols,c:BRAND_PRIMARY},{l:'Assistências',v:totalAst,c:BRAND_PRIMARY}].map(({ l, v, c }) => (
          <div key={l} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px', textAlign:'center' }}>
            <p style={{ fontSize:28, fontWeight:900, color:c, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{v}</p>
            <p style={{ fontSize:9, color:'#94a3b8', marginTop:4, textTransform:'uppercase' }}>{l}</p>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'#f7fcf9' }}>
              {['Temporada','Clube','Posição','Jogos','Minutos','Gols','Assists','G+A','🟨','🟥'].map(h => (
                <th key={h} style={{ padding:'9px 12px', textAlign:'center', fontSize:9, fontWeight:700, color:'#94a3b8', borderBottom:'1px solid #e5edf5', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumo.map((r,i) => (
              <tr key={i} style={{ borderBottom:'1px solid #f4f8fc', background:i%2?'#fafffe':'#fff' }}>
                <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:900, color:BRAND_PRIMARY, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14 }}>{r['TEMPORADA']}</td>
                <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:700, color:'#10233b' }}>{r['TIME']}</td>
                <td style={{ padding:'9px 12px', textAlign:'center', color:'#64748b', fontSize:10 }}>{r['Posição']}</td>
                <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:700 }}>{r['Jogos']}</td>
                <td style={{ padding:'9px 12px', textAlign:'center', color:'#64748b' }}>{r['Minutos Totais']}</td>
                <td style={{ padding:'9px 12px', textAlign:'center' }}>
                  <span style={{ background:safeNum(r['Golos'])>0?BRAND_DARK:'transparent', color:safeNum(r['Golos'])>0?BRAND_PRIMARY:'#94a3b8', borderRadius:5, padding:'2px 8px', fontWeight:700 }}>{r['Golos']}</span>
                </td>
                <td style={{ padding:'9px 12px', textAlign:'center' }}>
                  <span style={{ background:safeNum(r['Assistências'])>0?'#e3f2fd':'transparent', color:safeNum(r['Assistências'])>0?BLUE:'#94a3b8', borderRadius:5, padding:'2px 8px', fontWeight:700 }}>{r['Assistências']}</span>
                </td>
                <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:900, color:'#10233b', fontFamily:"'Barlow Condensed',sans-serif", fontSize:14 }}>{safeNum(r['Golos'])+safeNum(r['Assistências'])}</td>
                <td style={{ padding:'9px 12px', textAlign:'center' }}>{safeNum(r['Cartões Amarelos'])>0&&<span style={{ background:'#fff8e1',color:AMB,borderRadius:4,padding:'2px 6px',fontSize:9,fontWeight:700 }}>🟨{r['Cartões Amarelos']}</span>}</td>
                <td style={{ padding:'9px 12px', textAlign:'center' }}>{safeNum(r['Cartões Vermelhos'])>0&&<span style={{ background:'#ffebee',color:RED,borderRadius:4,padding:'2px 6px',fontSize:9,fontWeight:700 }}>🟥{r['Cartões Vermelhos']}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB JOGOS — with per-match video upload (no XML)
═══════════════════════════════════════════════════════════════════════ */
function TabJogos({ atleta, metricas }) {
  const [selectedIdx, setSelectedIdx]  = useState(0)
  const [videoUrls, setVideoUrls]      = useState({})
  const [abaJogos, setAbaJogos]        = useState('temporada') // 'temporada' | 'metricas'
  const videoRefs                      = useRef({})
  const inputRefs                      = useRef({})

  const games        = metricas || []
  const posGrupo     = getPosGrupo(atleta.posicao)
  const jogosTemp    = (atleta.jogos_temporada_json || []).sort((a,b) => new Date(b['Data']||0) - new Date(a['Data']||0))
  const hoje         = new Date(); hoje.setHours(0,0,0,0)

  const handleVideoUpload = (idx, file) => {
    if (videoUrls[idx]) URL.revokeObjectURL(videoUrls[idx])
    setVideoUrls(prev => ({ ...prev, [idx]: URL.createObjectURL(file) }))
  }

  const currentGame  = games[selectedIdx]
  const currentVideo = videoUrls[selectedIdx]

  const fmtData = s => {
    if (!s) return '—'
    const d = new Date(s)
    if (isNaN(d)) return s
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear()
  }

  const jogouPartida = j => j['Minutos'] !== null && j['Minutos'] !== undefined

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'#f4f8fc', borderRadius:10, padding:4, width:'fit-content' }}>
        {[
          { id:'temporada', label:'Jogos da Temporada', count: jogosTemp.length },
          { id:'metricas',  label:'Métricas por Jogo',  count: games.length },
        ].map(t => (
          <button key={t.id} onClick={()=>setAbaJogos(t.id)} style={{
            padding:'6px 14px', fontSize:10, fontWeight:700, borderRadius:7, fontFamily:'inherit',
            cursor:'pointer', border:'none',
            background: abaJogos===t.id ? '#fff' : 'transparent',
            color: abaJogos===t.id ? BRAND_PRIMARY : '#64748b',
            boxShadow: abaJogos===t.id ? '0 1px 4px rgba(10,102,183,0.12)' : 'none',
          }}>
            {t.label} <span style={{ marginLeft:4, fontSize:9, opacity:0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* ABA: JOGOS DA TEMPORADA */}
      {abaJogos === 'temporada' && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #f4f8fc', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px' }}>
              Calendário {new Date().getFullYear()} · {jogosTemp.length} jogos
            </p>
            {jogosTemp.filter(j=>new Date(j['Data'])>=hoje).length > 0 && (
              <span style={{ fontSize:9, fontWeight:700, color:BRAND_PRIMARY, background:BRAND_PRIMARY+'15', borderRadius:20, padding:'2px 10px' }}>
                {jogosTemp.filter(j=>new Date(j['Data'])>=hoje).length} próximos
              </span>
            )}
          </div>
          {jogosTemp.length === 0 ? (
            <p style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:11 }}>
              Sem jogos. Faça upload da planilha com a aba "JOGOS DA TEMPORADA".
            </p>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr style={{ background:'#f7fcf9' }}>
                    {['Data','Competição','Mandante','','Visitante','Min','Titular','Gols','Ast','🟨','🟥','Nota'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign: h===''||h==='Nota' ? 'center' : 'left', fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jogosTemp.map((j, i) => {
                    const dataJogo  = j['Data'] ? new Date(j['Data']) : null
                    const futuro    = dataJogo && dataJogo >= hoje
                    const emBreve   = dataJogo && futuro && (dataJogo - hoje) <= 7*24*60*60*1000
                    const casa      = j['Casa/Fora'] === 'C'
                    const mandante  = casa ? j['Time'] : j['Adversário']
                    const visitante = casa ? j['Adversário'] : j['Time']
                    const gols_time = casa ? (j['Gols Atlético Cearense'] ?? j['Gols Time']) : j['Gols adversário']
                    const gols_adv  = casa ? j['Gols adversário'] : (j['Gols Atlético Cearense'] ?? j['Gols Time'])
                    const jogou     = jogouPartida(j)
                    const metMatch  = (metricas||[]).find(m => {
                      const adv = (j['Adversário']||'').toLowerCase()
                      return m.date === j['Data'] || (m.jogo||'').toLowerCase().includes(adv)
                    })
                    const notaResult = metMatch
                      ? calcNotaJogo(metMatch, posGrupo)
                      : (!futuro && jogou ? calcNotaJogo(j, posGrupo, null) : null)
                    const notaVal  = notaResult?.nota ?? null
                    const notaTipo = notaResult?.tipo ?? null

                    return (
                      <tr key={i} style={{
                        borderBottom:'1px solid #f7fcf9',
                        background: emBreve ? '#f0fdf4' : futuro ? '#fafffe' : '#fff',
                      }}>
                        <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            {emBreve && <span style={{ width:6, height:6, borderRadius:'50%', background:BRAND_PRIMARY, display:'inline-block', flexShrink:0, animation:'pulse 2s infinite' }}/>}
                            <span style={{ fontWeight: emBreve ? 700 : 400, color: futuro ? BRAND_PRIMARY : '#64748b' }}>{fmtData(j['Data'])}</span>
                          </div>
                        </td>
                        <td style={{ padding:'9px 12px', color:'#94a3b8', fontSize:10, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j['Competição']||'—'}</td>
                        <td style={{ padding:'9px 12px', fontWeight: casa ? 700 : 400, color:'#10233b', whiteSpace:'nowrap' }}>{mandante}</td>
                        <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:900, color:'#10233b', whiteSpace:'nowrap' }}>
                          {jogou ? `${gols_time ?? '—'} x ${gols_adv ?? '—'}` : <span style={{ color:'#c0d8c4', fontSize:10 }}>—</span>}
                        </td>
                        <td style={{ padding:'9px 12px', fontWeight: !casa ? 700 : 400, color:'#10233b', whiteSpace:'nowrap' }}>{visitante}</td>
                        <td style={{ padding:'9px 12px', textAlign:'center', color:'#64748b' }}>{j['Minutos'] ?? '—'}</td>
                        <td style={{ padding:'9px 12px', textAlign:'center' }}>
                          {j['Titular'] === 'Sim'
                            ? <span style={{ background:BRAND_PRIMARY+'15', color:BRAND_PRIMARY, borderRadius:4, padding:'1px 6px', fontSize:9, fontWeight:700 }}>TIT</span>
                            : j['Titular'] === 'Não'
                            ? <span style={{ background:'#f5f5f5', color:'#888', borderRadius:4, padding:'1px 6px', fontSize:9 }}>RES</span>
                            : <span style={{ color:'#c0d8c4', fontSize:10 }}>—</span>}
                        </td>
                        <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:700, color: safeNum(j['Gols'])>0?BRAND_PRIMARY:'#64748b' }}>{j['Gols']??'—'}</td>
                        <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:700, color: safeNum(j['Assistências'])>0?BLUE:'#64748b' }}>{j['Assistências']??'—'}</td>
                        <td style={{ padding:'9px 12px', textAlign:'center' }}>
                          {safeNum(j['Cartões Amarelos'])>0
                            ? <span style={{ background:'#fffbeb', color:AMB, borderRadius:4, padding:'1px 6px', fontSize:9, fontWeight:700 }}>🟨 {j['Cartões Amarelos']}</span>
                            : <span style={{ color:'#e5edf5' }}>—</span>}
                        </td>
                        <td style={{ padding:'9px 12px', textAlign:'center' }}>
                          {safeNum(j['Cartões Vermelhos'])>0
                            ? <span style={{ background:'#fef2f2', color:RED, borderRadius:4, padding:'1px 6px', fontSize:9, fontWeight:700 }}>🟥 {j['Cartões Vermelhos']}</span>
                            : <span style={{ color:'#e5edf5' }}>—</span>}
                        </td>
                        <td style={{ padding:'9px 12px', textAlign:'center' }}>
                          {futuro ? (
                            <span style={{ fontSize:9, color:'#c0d8c4' }}>—</span>
                          ) : notaVal !== null ? (
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                              <NotaBadge nota={notaVal} size="sm" />
                              <span style={{ fontSize:7, color: notaTipo==='shadow' ? AMB : BRAND_PRIMARY }}>
                                {notaTipo==='shadow' ? '~' : '●'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize:9, color:'#e5edf5' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA: MÉTRICAS POR JOGO (vídeo) */}
      {abaJogos === 'metricas' && (
        <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16 }}>
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f4f8fc', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px' }}>Partidas ({games.length})</p>
              <span style={{ fontSize:9, color:'#c0d8c4' }}>Clique para ver / vídeo</span>
            </div>
            <div style={{ height:550, overflowY:'auto' }}>
              {games.length === 0
                ? <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', padding:24 }}>Sem partidas. Faça upload da planilha.</p>
                : games.map((g, i) => {
                    const gols     = safeNum(g.gols), ast = safeNum(g.assists)
                    const isActive = selectedIdx === i
                    const notaR    = calcNotaJogo(g, posGrupo)
                    const notaV    = notaR?.nota ?? null
                    return (
                      <div key={i} onClick={() => setSelectedIdx(i)} style={{
                        padding:'10px 14px', borderBottom:'1px solid #f7fcf9', cursor:'pointer',
                        background: isActive ? BRAND_DARK : '#fff',
                        borderLeft: `3px solid ${isActive ? BRAND_PRIMARY : 'transparent'}`,
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                          <p style={{ fontSize:10, fontWeight:700, color:'#10233b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170 }}>{g.jogo}</p>
                          <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                            {videoUrls[i] && <span style={{ fontSize:9, color:BRAND_PRIMARY, fontWeight:700 }}>📹</span>}
                            <NotaBadge nota={notaV} size="sm" />
                          </div>
                        </div>
                        <p style={{ fontSize:9, color:'#94a3b8', marginBottom:5 }}>{g.date} · {g.competition}</p>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          <span style={{ background:'#f4f8fc', color:BRAND_PRIMARY, borderRadius:5, padding:'2px 7px', fontSize:9, fontWeight:700 }}>{safeNum(g.minutos)}'</span>
                          {gols>0 && <span style={{ background:BRAND_DARK, color:BRAND_PRIMARY, borderRadius:5, padding:'2px 7px', fontSize:9 }}>⚽ {gols}</span>}
                          {ast>0  && <span style={{ background:'#e3f2fd', color:BLUE, borderRadius:5, padding:'2px 7px', fontSize:9 }}>🅰 {ast}</span>}
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>

          {currentGame ? (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ fontSize:16, fontWeight:900, color:'#10233b', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:3 }}>{currentGame.jogo}</p>
                  <p style={{ fontSize:10, color:'#94a3b8' }}>{currentGame.date} · {currentGame.competition} · {currentGame.posicao}</p>
                </div>
                <div style={{ textAlign:'center' }}>
                  <NotaBadge nota={calcNotaJogo(currentGame, posGrupo)?.nota ?? null} size="lg" />
                  <p style={{ fontSize:8, color:'#94a3b8', marginTop:4 }}>nota do jogo</p>
                </div>
              </div>
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', overflow:'hidden' }}>
                {currentVideo ? (
                  <div>
                    <video src={currentVideo} controls style={{ width:'100%', display:'block', maxHeight:360, background:'#000' }} />
                    <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:9, color:'#64748b' }}>📹 Destaques · {currentGame.jogo}</span>
                      <button onClick={() => { URL.revokeObjectURL(videoUrls[selectedIdx]); setVideoUrls(p=>({...p,[selectedIdx]:null})) }}
                        style={{ marginLeft:'auto', background:'none', border:'1px solid #e5edf5', borderRadius:6, padding:'4px 10px', fontSize:9, cursor:'pointer', color:'#94a3b8', fontFamily:'inherit' }}>
                        ✕ Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:30, textAlign:'center' }}>
                    <p style={{ fontSize:24, marginBottom:8 }}>📹</p>
                    <p style={{ fontSize:11, color:'#94a3b8', marginBottom:14 }}>Carregue o vídeo de destaques desta partida.</p>
                    <button onClick={() => inputRefs.current[selectedIdx]?.click()}
                      style={{ background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:9, padding:'9px 20px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      📤 Carregar destaques
                    </button>
                    <input ref={el => inputRefs.current[selectedIdx] = el} type="file" accept="video/*" style={{ display:'none' }}
                      onChange={e => { const f=e.target.files[0]; if(f) handleVideoUpload(selectedIdx,f); e.target.value='' }} />
                  </div>
                )}
              </div>
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'14px 16px' }}>
                <SectionTitle label="Métricas desta partida" icon="📊" />
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {[
                    ['Minutos',currentGame.minutos],['Gols',currentGame.gols],['Assistências',currentGame.assists],['xG',safeNum(currentGame.xg).toFixed(2)],
                    ['Remates',currentGame.remates_totais],['À baliza',currentGame.remates_baliza],['Passes',currentGame.passes_totais],['Precisão',`${pct(currentGame.passes_certos,currentGame.passes_totais)}%`],
                    ['Dribbles',currentGame.dribbles],['Dribble ok',currentGame.dribbles_ok],['Duelos',currentGame.duelos],['Duelos ganhos',currentGame.duelos_ganhos],
                    ['Intercepções',currentGame.intercepcoes],['Recuperações',currentGame.recuperacoes],['Toques área',currentGame.toques_area],['xA',safeNum(currentGame.xa).toFixed(2)],
                  ].map(([l,v]) => (
                    <div key={l} style={{ background:'#f7fcf9', borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
                      <p style={{ fontSize:15, fontWeight:900, color:BRAND_PRIMARY, fontFamily:"'Barlow Condensed',sans-serif" }}>{v??'—'}</p>
                      <p style={{ fontSize:8, color:'#94a3b8' }}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:60, textAlign:'center' }}>
              <p style={{ fontSize:11, color:'#94a3b8' }}>Selecione uma partida.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Edit Modal
═══════════════════════════════════════════════════════════════════════ */
function EditModal({ atleta, onClose, onSaved }) {
  const [form, setForm] = useState({
    nome:atleta.nome||'', apelido:atleta.apelido||'',
    posicao:atleta.posicao||'', posicao_secundaria:atleta.posicao_secundaria||'',
    time_atual:atleta.time_atual||'', liga:atleta.liga||'', pais_liga:atleta.pais_liga||'',
    data_contrato_fim:atleta.data_contrato_fim||'',
    valor_mercado:atleta.valor_mercado||'',
    link_externo:atleta.link_externo||'',
    link_video:atleta.link_video||'',
    nivel_interesse:atleta.nivel_interesse||'Monitorando',
    status:atleta.status||'Ativo',
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  const save = async () => {
    setSaving(true)
    const r = await fetch('/api/monitoramento', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'edit', id:atleta.id, fields:form }) })
    const d = await r.json()
    setSaving(false)
    onSaved(d.atleta || { ...atleta, ...form })
  }

  const fields = [
    ['nome','Nome','text'],['apelido','Apelido','text'],
    ['posicao','Posição','text'],['posicao_secundaria','Pos. Secundária','text'],
    ['time_atual','Clube','text'],['liga','Liga','text'],['pais_liga','País da Liga','pais'],
    ['data_contrato_fim','Término contrato','text'],['valor_mercado','Valor de mercado','text'],
    ['link_externo','Link (Transfermarkt/Ogol/Wyscout)','text'],
    ['link_video','Link de Vídeo (YouTube/Drive)','text'],
  ]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:28, width:500, boxShadow:'0 8px 40px rgba(10,102,183,0.15)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <p style={{ fontSize:13, fontWeight:900, color:'#10233b' }}>Editar Atleta</p>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#94a3b8' }}>✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {fields.map(([key,label,type])=>(
            <div key={key} style={{ gridColumn: key==='link_externo' ? 'span 2' : 'span 1' }}>
              <label style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
              {type==='pais' ? (
                <select value={form[key]||''} onChange={e=>set(key,e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit' }}>
                  <option value="">Selecione</option>
                  {Object.keys(PAIS_FLAG).map(p=><option key={p} value={p}>{PAIS_FLAG[p]} {p}</option>)}
                </select>
              ) : (
                <input type={type} value={form[key]} onChange={e=>set(key,e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit', boxSizing:'border-box' }} />
              )}
            </div>
          ))}
          <div>
            <label style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', display:'block', marginBottom:4 }}>Interesse</label>
            <select value={form.nivel_interesse} onChange={e=>set('nivel_interesse',e.target.value)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit' }}>
              {['Monitorando','Interesse','Proposta','Descartado'].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', display:'block', marginBottom:4 }}>Status</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #e5edf5', fontSize:11, fontFamily:'inherit' }}>
              {['Ativo','Cedido','Inativo'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button onClick={save} disabled={saving} style={{ marginTop:20, width:'100%', background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:10, padding:'12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  )
}

/* ─── Upload button ─────────────────────────────────────────────────── */
function UploadBtn({ label, accept, onFile, loading, done, color=BRAND_PRIMARY }) {
  const ref = useRef()
  return (
    <div>
      <button onClick={()=>ref.current?.click()} disabled={loading}
        style={{ background:done?color:'#f4f8fc', color:done?'#fff':color, border:`1px solid ${color}`, borderRadius:8, padding:'7px 14px', fontSize:10, fontWeight:700, cursor:loading?'wait':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
        {loading?'⏳ Processando...':done?`✅ ${label}`:`📤 ${label}`}
      </button>
      <input ref={ref} type="file" accept={accept} style={{ display:'none' }}
        onChange={e=>{const f=e.target.files[0];if(f)onFile(f);e.target.value=''}} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function AtletaPage({ params }) {
  const { id } = params
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  const [atleta,         setAtleta]        = useState(null)
  const [loading,        setLoading]       = useState(true)
  const [tab,            setTab]           = useState('geral')
  const [editModal,      setEditModal]     = useState(false)
  const [uploadingFull,   setUploadingFull]  = useState(false)
  const [uploadingSem,    setUploadingSem]   = useState(false)
  const [uploadingManual, setUploadingManual]= useState(false)
  const [uploadingG,      setUploadingG]     = useState(false)
  const [uploadingSC,     setUploadingSC]    = useState(false)
  const [fotoUploading,   setFotoUploading]  = useState(false)
  const [gerandoPdf,      setGerandoPdf]     = useState(false)
  const [listaFinalRec,   setListaFinalRec]  = useState(null)  // relatório CIC na lista final
  const [uploadingLF,     setUploadingLF]    = useState(false)
  const fotoRef = useRef()
  const lfRef   = useRef()

  useEffect(() => { loadAtleta() }, [id])

  // Busca relatório da Lista Final CIC para este atleta (por nome)
  useEffect(() => {
    if (!id) return
    fetch('/api/lista-final')
      .then(r => r.json())
      .then(d => {
        const players = d.players || []
        // Match por nome do atleta (apelido ou nome completo)
        const match = players.find(p => {
          if (!atleta) return false
          const pn = (p.jogador || '').toLowerCase().trim()
          const an = (atleta.nome || '').toLowerCase().trim()
          const aa = (atleta.apelido || '').toLowerCase().trim()
          return pn === an || pn === aa || (aa && an.startsWith(aa)) || (pn && an.includes(pn.split(' ')[0]))
        })
        setListaFinalRec(match || null)
      })
      .catch(() => {})
  }, [id, atleta?.nome])

  const loadAtleta = async () => {
    setLoading(true)
    const r = await fetch(`/api/monitoramento?id=${id}`)
    setAtleta(await r.json())
    setLoading(false)
  }

  const toB64 = (file) => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=e=>res(e.target.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file) })

  const handleBenchmark = async (file, tipo, setLoading) => {
    setLoading(true)
    const base64 = await toB64(file)
    const r = await fetch('/api/wyscout-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, base64 })
    })
    const d = await r.json()
    if (!d.success) alert('Erro no upload: ' + (d.error || 'desconhecido'))
    setLoading(false)
  }

  // Upload de PDF Lista Final vinculado ao atleta (via lista-final API)
  const handleUploadListaFinal = async (file) => {
    if (!atleta) return
    setUploadingLF(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1]
      const r = await fetch('/api/lista-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jogador:          atleta.apelido || atleta.nome,
          clube:            atleta.time_atual || '—',
          posicao:          atleta.posicao || '',
          // dados biográficos do atleta
          idade:            atleta.data_nascimento
            ? Math.floor((Date.now() - new Date(atleta.data_nascimento + 'T12:00').getTime()) / (1000 * 60 * 60 * 24 * 365.25))
            : null,
          altura:           atleta.altura ? String(atleta.altura) : null,
          pe_preferido:     atleta.pe_preferido || null,
          // PDF
          pdf_base64:       base64,
          pdf_filename:     file.name,
          // origem
          origem:           'monitoramento',
          monitoramento_id: atleta.id,
        })
      })
      const d = await r.json()
      if (d.success || d.id) {
        // Reload lista-final to get the actual DB id
        const lfRes = await fetch('/api/lista-final').then(r2 => r2.json()).catch(() => ({ players: [] }))
        const nome  = (atleta.apelido || atleta.nome || '').toLowerCase().trim()
        const match = (lfRes.players || []).find(p => {
          const pn = (p.jogador || '').toLowerCase().trim()
          return pn === nome || nome.includes(pn.split(' ')[0]) || pn.includes(nome.split(' ')[0])
        })
        setListaFinalRec(match || { pdf_filename: file.name, jogador: atleta.apelido || atleta.nome, origem: 'monitoramento' })
      } else {
        alert('Erro ao anexar: ' + (d.error || 'resposta inválida'))
      }
      setUploadingLF(false)
    }
    reader.onerror = () => { setUploadingLF(false); alert('Erro ao ler o arquivo.') }
    reader.readAsDataURL(file)
  }

  // Gerar PDF do perfil do atleta (abre nova aba de impressão)
  const handleGerarPdf = () => {
    const url = `/monitoramento/${id}/relatorio`
    window.open(url, '_blank', 'noopener')
  }

  const handleExcelFull = async (file) => {
    setUploadingFull(true)
    const base64 = await toB64(file)
    const r = await fetch('/api/monitoramento', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'upload_excel', id, base64 }) })
    const d = await r.json()
    if (d.atleta) setAtleta(d.atleta); else loadAtleta()
    setUploadingFull(false)
  }

  const handleExcelSem = async (file) => {
    setUploadingSem(true)
    const base64 = await toB64(file)
    await fetch('/api/monitoramento', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'upload_semanal', id, base64 }) })
    loadAtleta(); setUploadingSem(false)
  }

  const handleExcelManual = async (file) => {
    setUploadingManual(true)
    const base64 = await toB64(file)
    const r = await fetch('/api/monitoramento', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'upload_manual', id, base64 }) })
    const d = await r.json()
    if (d.atleta) setAtleta(d.atleta); else loadAtleta()
    setUploadingManual(false)
  }

  const handleFoto = async (file) => {
    setFotoUploading(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target.result
      await fetch('/api/monitoramento', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'set_foto', id, foto_url: dataUrl }) })
      setAtleta(a=>({...a, foto_url: dataUrl }))
      setFotoUploading(false)
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <AppShell><div style={{ textAlign:'center', padding:80, color:'#94a3b8' }}>Carregando...</div></AppShell>
  if (!atleta||atleta.error) return <AppShell><div style={{ textAlign:'center', padding:80, color:RED }}>Atleta não encontrado.</div></AppShell>

  const metricas = atleta.metricas_json || []
  const resumo   = atleta.resumo_temporada_json || []
  const T        = aggregate(metricas)
  const idade    = calcIdade(atleta.data_nascimento)

  const NIVEL_C = { 'Monitorando':'#0a66b7','Interesse':'#1565c0','Proposta':'#b45309','Descartado':'#c62828' }
  const nColor  = NIVEL_C[atleta.nivel_interesse] || BRAND_PRIMARY

  const TABS = [
    { key:'geral',      label:'📋 Geral' },
    { key:'desempenho', label:'📊 Desempenho' },
    { key:'comparacao', label:'⚖️ Comparação' },
    { key:'carreira',   label:'📅 Carreira' },
    { key:'jogos',      label:'🎬 Jogos' },
  ]

  return (
    <AppShell>
      <div style={{ padding:'28px 40px', maxWidth:1200, margin:'0 auto' }}>

        {/* Breadcrumb */}
        <p style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>
          <a href="/monitoramento" style={{ color:BRAND_PRIMARY, textDecoration:'none', fontWeight:700 }}>← Monitoramento</a>
          {' '}· {atleta.apelido || atleta.nome}
        </p>

        {/* Header */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e5edf5', padding:'20px 24px', marginBottom:20, display:'flex', gap:20, alignItems:'flex-start' }}>
          {/* Foto */}
          <div style={{ position:'relative', flexShrink:0 }}>
            {atleta.foto_url
              ? <img src={atleta.foto_url} style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:`3px solid ${BRAND_PRIMARY}` }} />
              : <div style={{ width:80, height:80, borderRadius:'50%', background:BRAND_DARK, border:`3px solid ${BRAND_PRIMARY}22`, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:28, color:BRAND_PRIMARY }}>👤</span></div>}
            <button onClick={()=>fotoRef.current?.click()}
              style={{ position:'absolute', bottom:0, right:0, background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:'50%', width:22, height:22, fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {fotoUploading?'⏳':'📷'}
            </button>
            <input ref={fotoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{const f=e.target.files[0];if(f)handleFoto(f);e.target.value=''}} />
          </div>

          {/* Info */}
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <h1 style={{ fontSize:26, fontWeight:900, color:'#10233b', fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>
                {atleta.apelido || atleta.nome}
              </h1>
              {atleta.apelido && <span style={{ fontSize:11, color:'#94a3b8' }}>{atleta.nome}</span>}
              <span style={{ background:`${nColor}18`, color:nColor, border:`1px solid ${nColor}`, borderRadius:6, padding:'3px 9px', fontSize:9, fontWeight:700 }}>
                {atleta.nivel_interesse}
              </span>
            </div>
            <p style={{ fontSize:11, color:'#64748b', marginBottom:10 }}>
              {[atleta.posicao, atleta.time_atual, atleta.liga, atleta.nacionalidade].filter(Boolean).join(' · ')}
            </p>
            {T && (
              <div style={{ display:'flex', gap:18 }}>
                {[['Jogos',T.jogos],['Minutos',T.minutos],['Gols',T.gols],['Assists',T.assists],['xG',T.xg.toFixed(1)],['xA',T.xa.toFixed(1)],['Idade',idade]].map(([l,v])=>(
                  <div key={l} style={{ textAlign:'center' }}>
                    <p style={{ fontSize:18, fontWeight:900, color:BRAND_PRIMARY, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{v}</p>
                    <p style={{ fontSize:8, color:'#94a3b8' }}>{l}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Info pills */}
            <div style={{ marginTop:9, display:'flex', flexWrap:'wrap', gap:6 }}>
              {[
                atleta.data_contrato_fim && (() => { try { const d = new Date(atleta.data_contrato_fim + 'T12:00'); const dias = Math.round((d - new Date()) / 864e5); const c = dias < 0 ? RED : dias <= 60 ? AMB : '#475569'; return { icon:'📅', label:'Contrato', value: `${atleta.data_contrato_fim}${dias < 0 ? ' ❌' : dias <= 60 ? ` ⚠ ${dias}d` : ''}`, color: c } } catch { return { icon:'📅', label:'Contrato', value: atleta.data_contrato_fim, color:'#475569' } } })(),
                atleta.pe_preferido   && { icon:'👟', label:'Pé',       value: atleta.pe_preferido,  color:'#475569' },
                atleta.altura         && { icon:'📏', label:'Altura',   value: `${atleta.altura}m`,  color:'#475569' },
                atleta.valor_mercado  && { icon:'💰', label:'Valor',    value: atleta.valor_mercado, color:BRAND_PRIMARY },
                atleta.empresario     && { icon:'🤝', label:'Empresário',value: atleta.empresario,   color:'#475569' },
                atleta.pais_liga      && { icon:'🌎', label:'País',     value: atleta.pais_liga,     color:'#475569' },
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:4, background:'#f7fcf9', borderRadius:8, padding:'3px 9px', border:'1px solid #e5edf5' }}>
                  <span style={{ fontSize:10 }}>{item.icon}</span>
                  <span style={{ fontSize:9, color:'#94a3b8', fontWeight:700 }}>{item.label}:</span>
                  <span style={{ fontSize:9, fontWeight:800, color: item.color }}>{item.value}</span>
                </div>
              ))}
              {atleta.link_externo && (
                <a href={atleta.link_externo} target="_blank" rel="noopener noreferrer" title="Perfil externo (Transfermarkt/Ogol)"
                  onClick={e=>e.stopPropagation()}
                  style={{ display:'flex', alignItems:'center', gap:5, background:'#f4f8fc', borderRadius:8, padding:'3px 10px', border:'1px solid #c6e0cc', textDecoration:'none' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BRAND_PRIMARY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <span style={{ fontSize:9, fontWeight:700, color:BRAND_PRIMARY }}>Perfil</span>
                </a>
              )}
              {atleta.link_video && (
                <a href={atleta.link_video} target="_blank" rel="noopener noreferrer" title="Material de vídeo"
                  onClick={e=>e.stopPropagation()}
                  style={{ display:'flex', alignItems:'center', gap:5, background:'#fee2e2', borderRadius:8, padding:'3px 10px', border:'1px solid #fca5a5', textDecoration:'none' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#dc2626">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  <span style={{ fontSize:9, fontWeight:700, color:'#dc2626' }}>Vídeo</span>
                </a>
              )}
              {listaFinalRec && (
                <div style={{ display:'flex', alignItems:'center', gap:5, background:'#f0fdf4', borderRadius:8, padding:'3px 9px', border:'1px solid #bbf7d0' }}>
                  <span style={{ fontSize:9, fontWeight:900, color:BRAND_PRIMARY }}>IRC {parseFloat(listaFinalRec.irc_final||0).toFixed(1)}</span>
                  <span style={{ fontSize:8, color:'#52677e' }}>·</span>
                  <span style={{ fontSize:9, fontWeight:700, color:'#52677e' }}>{listaFinalRec.recomendacao||listaFinalRec.irc_classificacao||'Lista Final CIC'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Upload buttons */}
          {canEdit && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
              <UploadBtn label="Planilha Completa" accept=".xlsx,.xls" loading={uploadingFull} done={metricas.length>0} onFile={handleExcelFull} />
              <UploadBtn label="Atualização Semanal" accept=".xlsx,.xls" loading={uploadingSem} done={false} onFile={handleExcelSem} color={BLUE} />
              <UploadBtn label="Planilha Manual" accept=".xlsx,.xls" loading={uploadingManual} done={resumo.length>0 && metricas.length===0} onFile={handleExcelManual} color={TEAL} />
              <div style={{ borderTop:'1px solid #e5edf5', margin:'4px 0' }} />
              <UploadBtn label="Dados Confiança" accept=".xlsx,.xls" loading={uploadingG} done={false} onFile={f=>handleBenchmark(f,'club',setUploadingG)} color='#1565c0' />
              <UploadBtn label="Dados Série C" accept=".xlsx,.xls" loading={uploadingSC} done={false} onFile={f=>handleBenchmark(f,'serie_c',setUploadingSC)} color='#b45309' />
              <button onClick={()=>setEditModal(true)} style={{ background:'none', border:'1px solid #e5edf5', borderRadius:8, padding:'7px 14px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', color:'#64748b' }}>✏ Editar Dados</button>
              <div style={{ borderTop:'1px solid #e5edf5', margin:'4px 0' }} />
              {/* Lista Final PDF */}
              <input ref={lfRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>{const f=e.target.files[0];if(f)handleUploadListaFinal(f);e.target.value=''}} />
              <button onClick={()=>lfRef.current?.click()} disabled={uploadingLF}
                style={{ background:listaFinalRec?'#eff6ff':'#f8fdf9', border:`1px solid ${listaFinalRec?'#93c5fd':'#e5edf5'}`, borderRadius:8, padding:'7px 14px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', color:listaFinalRec?'#1e40af':'#64748b', display:'flex', alignItems:'center', gap:6 }}>
                {uploadingLF ? '⏳' : listaFinalRec ? '📋' : '📎'} {uploadingLF ? 'Enviando...' : listaFinalRec ? 'Relatório CIC' : 'Anexar Relatório CIC'}
              </button>
              {listaFinalRec && (
                <a href={`/api/lista-final?pdf=${listaFinalRec.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:9, fontWeight:700, color:'#1e40af', textDecoration:'none', display:'flex', alignItems:'center', gap:4, padding:'0 4px' }}>
                  ↗ Abrir PDF CIC
                </a>
              )}
              {/* Exportar PDF perfil */}
              <button onClick={handleGerarPdf} disabled={gerandoPdf}
                style={{ background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:10, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                🖨️ Exportar PDF
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:16 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'8px 18px', fontSize:11, fontWeight:700, borderRadius:10, fontFamily:'inherit', background:tab===t.key?BRAND_PRIMARY:'#fff', color:tab===t.key?'#fff':'#64748b', border:`1px solid ${tab===t.key?BRAND_PRIMARY:'#e5edf5'}`, cursor:'pointer', transition:'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab==='geral'      && <TabGeral      atleta={atleta} T={T} onEdit={()=>setEditModal(true)} />}
        {tab==='desempenho' && <TabDesempenho atleta={atleta} metricas={metricas} />}
        {tab==='comparacao' && <TabComparacao atleta={atleta} T={T} />}
        {tab==='carreira'   && <TabCarreira   resumo={resumo} />}
        {tab==='jogos'      && <TabJogos      atleta={atleta} metricas={metricas} />}
      </div>

      {editModal && <EditModal atleta={atleta} onClose={()=>setEditModal(false)} onSaved={a=>{setAtleta(a);setEditModal(false)}} />}
    </AppShell>
  )
}
