'use client'
// CAMINHO: app/banco-fisico-tatico/page.js

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import AppShell from '../components/layout/AppShell'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ZAxis, ReferenceLine, Legend,
  LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

// ─── TEMA ─────────────────────────────────────────────────────────────────────
const G = {
  verde:  '#0B7C3D', verde2: '#0a66b7', verde3: '#0ea5e9',
  amber:  '#f59e0b', red:    '#dc2626', sky:    '#0ea5e9',
  purple: '#8b5cf6', slate:  '#64748b',
}
const POS_COLOR = { ZAG:'#0ea5e9', LAT:'#8b5cf6', VOL:'#f59e0b', ATA:'#ef4444', MC:'#10b981', GOL:'#6b7280' }
const POS_LABEL = { ZAG:'Zagueiro', LAT:'Lateral', VOL:'Volante', ATA:'Atacante', MC:'Meia', GOL:'Goleiro' }
const SEMAPHORE_CFG = {
  verde:    { color:'#0a66b7', bg:'#f0fdf4', border:'#bbf7d0', icon:'🟢', label:'Alto Impacto'    },
  amarelo:  { color:'#ca8a04', bg:'#fefce8', border:'#fde68a', icon:'🟡', label:'Impacto Moderado'},
  vermelho: { color:'#dc2626', bg:'#fef2f2', border:'#fecaca', icon:'🔴', label:'Baixo Impacto'   },
}

const GPS_METRICS = [
  { key:'dist_p90',    label:'Distância p90',   unit:'m', color:G.verde  },
  { key:'hsr_p90',     label:'HSR >20 p90',     unit:'m', color:G.verde2 },
  { key:'sprint_p90',  label:'Sprint >25 p90',  unit:'m', color:G.verde3 },
  { key:'sprints_p90', label:'N. Sprints p90',  unit:'',  color:G.purple },
  { key:'accel_p90',   label:'Acelerações p90', unit:'',  color:G.amber  },
  { key:'decel_p90',   label:'Desacel. p90',    unit:'',  color:G.slate  },
]
const PERF_METRICS = [
  // Volume de participação
  { key:'duelos_p90',       label:'Duelos p90',           unit:''  },
  { key:'duelosW_pct',      label:'Duelos Ganhos %',      unit:'%' },
  { key:'duelos_def_p90',   label:'Duelos Def. p90',      unit:''  },
  { key:'duelos_def_pct',   label:'Duelos Def. Ganhos %', unit:'%' },
  { key:'duelos_of_p90',    label:'Duelos Of. p90',       unit:''  },
  { key:'duelos_of_pct',    label:'Duelos Of. Ganhos %',  unit:'%' },
  { key:'duelos_aereos_pct',label:'Duelos Aéreos %',      unit:'%' },
  { key:'interc_p90',       label:'Intercepções p90',     unit:''  },
  { key:'alivios_p90',      label:'Alívios p90',          unit:''  },
  // Passe
  { key:'passesC_pct',      label:'Precisão Passes %',    unit:'%' },
  { key:'passProgr_p90',    label:'Passes Progr. p90',    unit:''  },
  { key:'passes_tf_pct',    label:'Passes Terço Final %', unit:'%' },
  { key:'passes_longos_pct',label:'Passes Longos %',      unit:'%' },
  // Ação geral
  { key:'acoesW_pct',       label:'Ações c/ Sucesso %',   unit:'%' },
  { key:'remates_p90',      label:'Remates p90',          unit:''  },
  // Drible / cruzamento
  { key:'dribles_p90',      label:'Dribles p90',          unit:''  },
  { key:'dribles_suc_pct',  label:'Dribles Sucesso %',    unit:'%' },
  { key:'cruzamentos_p90',  label:'Cruzamentos p90',      unit:''  },
  { key:'cruzamentos_pct',  label:'Cruzamentos Certos %', unit:'%' },
  // Disciplina
  { key:'faltas_p90',       label:'Faltas p90',           unit:''  },
  { key:'faltas_sof_p90',   label:'Faltas Sofridas p90',  unit:''  },
]

// Team Stats metrics (Wyscout coletivo)
const TEAMSTATS_METRICS = [
  { key:'posse',           label:'Posse (%)',              unit:'%' },
  { key:'finalizacoes',    label:'Finalizações',            unit:''  },
  { key:'xg',              label:'xG',                      unit:''  },
  { key:'passes_pct',      label:'Precisão Passes %',       unit:'%' },
  { key:'duelos_pct',      label:'Duelos Ganhos %',        unit:'%' },
  { key:'intercep',        label:'Intercepções',            unit:''  },
  { key:'recuperacoes',    label:'Recuperações',            unit:''  },
  { key:'entradas_tf',     label:'Entradas Terço Final',    unit:''  },
  { key:'passes_prog',     label:'Passes Progressivos',     unit:''  },
]

// Natural language maps for interpretations
const GPS_TEXT = {
  dist_p90:    'a distância percorrida por atleta', hsr_p90: 'a distância em alta intensidade (HSR)',
  sprint_p90:  'a distância em sprint',            sprints_p90: 'o número de sprints',
  accel_p90:   'o volume de acelerações',          decel_p90: 'o volume de desacelerações',
}
const PERF_TEXT = {
  duelos_p90:'o volume de duelos', duelosW_pct:'a taxa de duelos ganhos',
  duelos_def_p90:'o volume de duelos defensivos', duelos_def_pct:'a taxa de duelos defensivos ganhos',
  duelos_of_p90:'o volume de duelos ofensivos', duelos_of_pct:'a taxa de duelos ofensivos ganhos',
  duelos_aereos_pct:'a taxa de duelos aéreos ganhos',
  interc_p90:'o volume de intercepções', alivios_p90:'o volume de alívios',
  passesC_pct:'a precisão de passes', passProgr_p90:'o volume de passes progressivos',
  passes_tf_pct:'a precisão de passes ao terço final', passes_longos_pct:'a precisão de passes longos',
  acoesW_pct:'a eficiência nas ações', remates_p90:'o volume de remates',
  dribles_p90:'o volume de dribles', dribles_suc_pct:'a taxa de dribles com sucesso',
  cruzamentos_p90:'o volume de cruzamentos', cruzamentos_pct:'a precisão de cruzamentos',
  faltas_p90:'o volume de faltas cometidas', faltas_sof_p90:'o volume de faltas sofridas',
}
const TEAMSTATS_TEXT = {
  posse: 'a posse de bola', finalizacoes: 'o número de finalizações', xg: 'o xG criado',
  passes_pct: 'a precisão de passes coletiva', duelos_pct: 'a taxa de duelos ganhos',
  intercep: 'as intercepções coletivas', recuperacoes: 'as recuperações de bola',
  entradas_tf: 'as entradas no terço final', passes_prog: 'os passes progressivos coletivos',
}

function genInterpretation(gpsKey, metricKey, r, isTeamStat = false) {
  const gpsText  = GPS_TEXT[gpsKey]  || gpsKey
  const perfText = (isTeamStat ? TEAMSTATS_TEXT : PERF_TEXT)[metricKey] || metricKey
  const abs = Math.abs(r)
  const dir = r > 0 ? 'tende a ser maior' : 'tende a ser menor'
  const str = abs >= 0.6 ? 'Correlação forte' : abs >= 0.4 ? 'Correlação moderada' : 'Correlação fraca'
  return `Quando ${gpsText} é alta, ${perfText} ${dir}. ${str}.`
}

const TABS = [
  { id:'upload',      label:'Upload',            icon:'⬆️'  },
  { id:'banco',       label:'Banco de Partidas', icon:'📋'  },
  { id:'consolidado', label:'Consolidado',       icon:'📊'  },
  { id:'correlacoes', label:'Correlações',       icon:'🔗'  },
  { id:'scatter',     label:'Scatter',           icon:'🎯'  },
  { id:'posicao',     label:'Por Posição',       icon:'📐'  },
  { id:'atleta',      label:'Atleta',            icon:'👤'  },
  { id:'padroes',     label:'Padrões',           icon:'🧠'  },
  { id:'coletivo',    label:'Coletivo',          icon:'🏟️'  },
  { id:'resultado',   label:'Resultado',         icon:'🏆'  },
]

const RESULTADO_OPTS = [
  { v:'V', label:'Vitória', color:'#0a66b7' },
  { v:'E', label:'Empate',  color:'#ca8a04' },
  { v:'D', label:'Derrota', color:'#dc2626' },
]
const MODELO_OPTS = ['Bloco Alto','Bloco Médio','Bloco Baixo','Controle','Transição','Pressão Alta','Misto']

// ─── DATE HELPER — safe for any Postgres/ISO/date-string format ───────────────
function fmtDate(raw, opts = {day:'2-digit', month:'short'}) {
  if (!raw) return '—'
  const m = String(raw).match(/(\d{4}-\d{2}-\d{2})/)
  if (!m) return '—'
  const d = new Date(m[1] + 'T12:00:00')
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', opts)
}

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;800;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  .bc  { font-family:'Barlow Condensed',sans-serif; }
  .dm  { font-family:'DM Sans',sans-serif; }
  .fade-in { animation:fadeIn .3s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .row-hover:hover { background:#f0fdf4; }
  .scrollbar-g::-webkit-scrollbar{width:4px;height:4px}
  .scrollbar-g::-webkit-scrollbar-thumb{background:#0B7C3D;border-radius:9999px}
`

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const num = v => parseFloat(String(v || '0').replace(',', '.')) || 0

function durationToMin(raw) {
  if (!raw) return 90
  const s = String(raw)
  const p = s.split(':')
  if (p.length === 3) return parseInt(p[0]) * 60 + parseInt(p[1]) + parseInt(p[2]) / 60
  if (p.length === 2) return parseInt(p[0]) + parseInt(p[1]) / 60
  const n = parseFloat(s)
  return n > 300 ? n / 60 : n > 0 ? n : 90
}

function normPos(str) {
  const p = (str || '').toLowerCase()
  if (p.includes('atacante') || p.includes('forward') || p.includes(' st') || p.includes('cf')) return 'ATA'
  if (p.includes('lateral')  || p.includes('fullback') || p.includes('rb') || p.includes('lb')) return 'LAT'
  if (p.includes('volante')  || p.includes('cdm') || p.includes('vol')) return 'VOL'
  if (p.includes('meia')     || p.includes('meio') || p.includes('cam') || p.includes('mid')) return 'MC'
  if (p.includes('zagueiro') || p.includes('center back') || p.includes('cb') || p.includes('zag')) return 'ZAG'
  if (p.includes('golei')    || p.includes('goal') || p === 'gk') return 'GOL'
  return 'VOL'
}

function normNome(n) {
  return (n || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// ─── NAME SIMILARITY ENGINE ───────────────────────────────────────────────────
const NAME_MAP_KEY = 'confianca_name_map_v1'

function loadNameMap() {
  try { return JSON.parse(localStorage.getItem(NAME_MAP_KEY) || '{}') } catch { return {} }
}
function saveNameMap(map) {
  try { localStorage.setItem(NAME_MAP_KEY, JSON.stringify(map)) } catch (_) {}
}

// Bigram set from a string
function _bigrams(s) {
  const set = new Set()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

// 0-1 similarity: tokens + bigrams + prefix bonus
function nameSimilarity(a, b) {
  const na = normNome(a), nb = normNome(b)
  if (na === nb) return 1.0

  const as = na.replace(/ /g, ''), bs = nb.replace(/ /g, '')

  // Token overlap (exact word matches)
  const aT = na.split(' ').filter(t => t.length >= 3)
  const bT = nb.split(' ').filter(t => t.length >= 3)
  const sharedTokens = aT.filter(t => bT.includes(t)).length
  const tokenScore = sharedTokens > 0 ? (2 * sharedTokens) / (aT.length + bT.length) : 0

  // Character bigram similarity
  const aBi = _bigrams(as), bBi = _bigrams(bs)
  const inter = [...aBi].filter(x => bBi.has(x)).length
  const bigramScore = (2 * inter) / (aBi.size + bBi.size + 0.01)

  // Prefix bonus (first 5 chars of any word from shorter name appear in longer)
  const shorter = aT.length <= bT.length ? aT : bT
  const longer  = aT.length <= bT.length ? bT  : aT
  const prefixBonus = shorter.some(st =>
    longer.some(lt => st.slice(0, 5) === lt.slice(0, 5) && st.length > 3)
  ) ? 0.15 : 0

  return Math.min(1, Math.max(tokenScore * 0.55 + bigramScore * 0.35 + prefixBonus, bigramScore * 0.55))
}

// Returns sorted GPS candidates for a given Wyscout name
function getGpsCandidates(wyscoutName, gpsRows, topN = 4) {
  return gpsRows
    .filter(r => !isGK(r))
    .map(r => ({ gpsName: r.playerName, normGps: normNome(r.playerName), score: nameSimilarity(wyscoutName, r.playerName) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

// Build reconciliation report: auto-matched, needs confirmation, unmatched
function buildReconciliation(gpsRows, wyscoutRows, customMappings = {}) {
  const matched = [], needsConfirm = [], unmatched = []
  const fieldGps = gpsRows.filter(r => !isGK(r))

  wyscoutRows.forEach(d => {
    const dN = normNome(d.jogador)
    // 1. Custom mapping
    if (customMappings[dN]) {
      const gps = fieldGps.find(g => normNome(g.playerName) === customMappings[dN])
      if (gps) { matched.push({ wyscout: d.jogador, gps: gps.playerName, type:'manual' }); return }
    }
    // 2. Auto-match
    const auto = _findGps(d.jogador, fieldGps)
    if (auto) {
      const autoN = normNome(auto.playerName)
      const exact = autoN === dN
      matched.push({ wyscout: d.jogador, gps: auto.playerName, type: exact ? 'exact' : 'auto' })
      return
    }
    // 3. No match — compute candidates
    const candidates = getGpsCandidates(d.jogador, fieldGps)
    if (candidates.length && candidates[0].score >= 0.25) {
      needsConfirm.push({ wyscout: d.jogador, normWyscout: dN, candidates })
    } else {
      unmatched.push(d.jogador)
    }
  })

  return { matched, needsConfirm, unmatched }
}

// ─── ESTATÍSTICAS — Pearson r, R², p-value (incomplete beta) ─────────────────
function _lgamma(x) {
  const c = [76.18009172947146,-86.50532032941677,24.01409824083091,
             -1.231739572450155,1.208650973866179e-3,-5.395239384953e-6]
  let y = x, s = 1.0000000001900148
  const t = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  for (let j = 0; j < 6; j++) s += c[j] / ++y
  return -t + Math.log(2.5066282746310005 * s / x)
}
function _betaCF(a, b, x) {
  const [MAX, EPS, MIN] = [100, 3e-7, 1e-30]
  const [qab, qap, qam] = [a+b, a+1, a-1]
  let [c, d] = [1, 1 - qab*x/qap]
  if (Math.abs(d)<MIN) d=MIN; d=1/d; let h=d
  for (let m=1; m<=MAX; m++) {
    for (let s=0; s<2; s++) {
      const aa = s===0 ? m*(b-m)*x/((qam+2*m)*(a+2*m)) : -(a+m)*(qab+m)*x/((a+2*m)*(qap+2*m))
      d=1+aa*d; if(Math.abs(d)<MIN)d=MIN
      c=1+aa/c; if(Math.abs(c)<MIN)c=MIN
      d=1/d; h*=d*c
    }
    if (Math.abs(d*c-1) < EPS) break
  }
  return h
}
function _betaInc(a, b, x) {
  if (x<=0) return 0; if (x>=1) return 1
  const front = Math.exp(a*Math.log(x)+b*Math.log(1-x)-_lgamma(a)-_lgamma(b)+_lgamma(a+b)) / a
  return x < (a+1)/(a+b+2)
    ? front * _betaCF(a,b,x)
    : 1 - Math.exp(_lgamma(a+b)-_lgamma(a)-_lgamma(b)+b*Math.log(1-x)+a*Math.log(x))/b*_betaCF(b,a,1-x)
}

function pearsonStats(arr, kx, ky) {
  const valid = arr.filter(d => d[kx]!=null && d[ky]!=null && !isNaN(+d[kx]) && !isNaN(+d[ky]))
  const n = valid.length
  if (n < 3) return { r:null, r2:null, p:null, n, sig:false }
  const xs = valid.map(d => +d[kx]||0), ys = valid.map(d => +d[ky]||0)
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n
  const cov = xs.reduce((s,x,i) => s+(x-mx)*(ys[i]-my), 0)
  const sx  = Math.sqrt(xs.reduce((s,x) => s+(x-mx)**2, 0))
  const sy  = Math.sqrt(ys.reduce((s,y) => s+(y-my)**2, 0))
  if (!sx||!sy) return { r:null, r2:null, p:null, n, sig:false }
  const r   = Math.max(-1, Math.min(1, cov/(sx*sy)))
  const r2  = r*r
  const tSt = r * Math.sqrt(n-2) / Math.sqrt(Math.max(1e-10, 1-r2))
  const p   = Math.min(1, _betaInc((n-2)/2, 0.5, (n-2)/(n-2+tSt*tSt)))
  return { r:+r.toFixed(2), r2:+r2.toFixed(3), p:+p.toFixed(4), n, t:+tSt.toFixed(2), sig:p<0.05 }
}

// Backward-compatible wrapper
function pearsonR(arr, kx, ky) { return pearsonStats(arr, kx, ky).r }

function rColor(r) {
  if (r === null) return '#e2e8f0'
  const a = Math.abs(r)
  if (a >= .5) return r > 0 ? '#07579e' : '#dc2626'
  if (a >= .3) return r > 0 ? '#0a66b7' : '#ef4444'
  if (a >= .15) return r > 0 ? '#86efac' : '#fca5a5'
  return '#e2e8f0'
}
function rBg(r) {
  if (r === null) return '#f8fafc'
  const a = Math.abs(r)
  if (a >= .5) return r > 0 ? '#dcfce7' : '#fee2e2'
  if (a >= .3) return r > 0 ? '#f0fdf4' : '#fff1f2'
  if (a >= .15) return r > 0 ? '#f7fef9' : '#fff5f5'
  return '#f8fafc'
}
function rLabel(r) {
  if (r === null) return '—'
  const a = Math.abs(r)
  if (a >= .6) return r > 0 ? 'Forte +' : 'Forte -'
  if (a >= .4) return r > 0 ? 'Moderada +' : 'Moderada -'
  if (a >= .2) return r > 0 ? 'Fraca +' : 'Fraca -'
  return 'Nula'
}

// ─── GPS CSV PARSER (client-side) ─────────────────────────────────────────────
function csvLine(line) {
  const res = []; let cur = ''; let inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { res.push(cur.trim()); cur = '' }
    else cur += ch
  }
  res.push(cur.trim())
  return res
}

// ─── GPS CSV PARSER — Catapult CTR (new) + legacy format (old) ───────────────
// CTR columns (0-indexed, from "Player Name" header row):
const CTR_COLS = {
  name:0, period:1, pos:3, dur:4, dist:5, dist20a25:7, n20a25:8,
  dist25a30:9, n25a30:10, dist30:11, n30:12, hsr:13, hmld:14,
  maxVel:15, accDist:16, accel:17, decelDist:18, decel:19,
  nSprints:20, sprint:21,
  mii1:22, mii2:23, mii3:24, b5:25, b6:26, p85:27, p90:28, p95:29,
}

function _parseDuration(d) {
  // "01:42:05" → minutes, or "90" → 90
  if (!d) return 90
  const parts = String(d).split(':')
  if (parts.length === 3) return +parts[0]*60 + +parts[1] + +parts[2]/60
  if (parts.length === 2) return +parts[0] + +parts[1]/60
  return parseFloat(d) || 90
}

function parseGpsCsvText(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n')

  // Find header row
  let headerIdx = -1
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i].includes('Player Name')) { headerIdx = i; break }
  }
  if (headerIdx < 0) {
    // Fallback: legacy format (Sessão, Data, ..., Atleta)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].toLowerCase().includes('atleta') || lines[i].toLowerCase().includes('sessão')) {
        headerIdx = i; break
      }
    }
    if (headerIdx < 0) return { error: 'Formato GPS não reconhecido. Esperado: Catapult CTR Export.' }
    return _parseLegacyGps(lines, headerIdx)
  }

  // ─── CTR format ───────────────────────────────────────────────────────────
  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const c = csvLine(line)
    if (!c[CTR_COLS.period]) continue
    // Only use "Session" rows (full-game aggregates, not per-period or per-minute)
    if (c[CTR_COLS.period].trim() !== 'Session') continue

    const name = (c[CTR_COLS.name] || '').replace(/"/g, '').trim()
    if (!name) continue

    const g = idx => parseFloat((c[idx] || '0').replace(/"/g, '')) || 0
    const minutos = _parseDuration((c[CTR_COLS.dur] || '').replace(/"/g,''))

    rows.push({
      playerName:    name,
      positionName:  (c[CTR_COLS.pos] || '').replace(/"/g,'').trim(),
      duration:      String(minutos),          // in minutes
      totalDistance: String(g(CTR_COLS.dist)),
      dist20:        String(g(CTR_COLS.hsr)),  // >20 km/h total
      dist25:        String(g(CTR_COLS.sprint)), // >25 km/h total
      sprints:       String(g(CTR_COLS.nSprints)),
      accel:         String(g(CTR_COLS.accel)),
      decel:         String(g(CTR_COLS.decel)),
      maxVel:        String(g(CTR_COLS.maxVel)),
      hmld:          String(g(CTR_COLS.hmld)),
      dist20a25:     String(g(CTR_COLS.dist20a25)),
      dist25a30:     String(g(CTR_COLS.dist25a30)),
      dist30:        String(g(CTR_COLS.dist30)),
      n30:           String(g(CTR_COLS.n30)),
      accDist:       String(g(CTR_COLS.accDist)),
      decelDist:     String(g(CTR_COLS.decelDist)),
      mii1:          String(g(CTR_COLS.mii1)),
      mii2:          String(g(CTR_COLS.mii2)),
      mii3:          String(g(CTR_COLS.mii3)),
    })
  }

  if (!rows.length) return { error: 'Nenhuma linha "Session" encontrada. Verifique se o arquivo é um Catapult CTR export.' }
  return { rows, format: 'ctr' }
}

// Legacy format: Sessão, Data, Tipo, ..., Atleta, Posição, ...
function _parseLegacyGps(lines, headerIdx) {
  const headers = csvLine(lines[headerIdx]).map(h => h.toLowerCase().trim())
  const find = (...keys) => { for (const k of keys) { const i = headers.findIndex(h => h.includes(k)); if (i>=0) return i } return -1 }
  const cols = {
    name:find('atleta','player name'), pos:find('posição','position'), dur:find('duração','duration','minutes'),
    dist:find('distância total','total distance'), hsr:find('> 20','>20','hsr'),
    sprint:find('> 25','>25'), sprints:find('nº sprint','# sprint'),
    accel:find('aceler'), decel:find('desaceler'), maxVel:find('vel. máxima','maximum velocity'),
  }
  if (cols.name < 0) return { error: 'Coluna "Atleta" não encontrada no CSV legado.' }
  const rows = []
  for (let i = headerIdx+1; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line) continue
    const c = csvLine(line)
    const name = (c[cols.name]||'').trim(); if (!name) continue
    const get = col => col>=0?(c[col]||'0'):'0'
    rows.push({ playerName:name, positionName:get(cols.pos), duration:get(cols.dur),
      totalDistance:get(cols.dist), dist20:get(cols.hsr), dist25:get(cols.sprint),
      sprints:get(cols.sprints), accel:get(cols.accel), decel:get(cols.decel), maxVel:get(cols.maxVel),
    })
  }
  if (!rows.length) return { error: 'Nenhum atleta encontrado no formato legado.' }
  return { rows, format:'legacy' }
}

async function parseGpsFile(file) {
  const text = await file.text()
  return parseGpsCsvText(text)
}

// ─── WYSCOUT PDF PARSER — all metrics ────────────────────────────────────────
function fixName(raw) {
  if (!raw) return ''
  // Remove "1.ª PARTE" / "2.ª PARTE" prefix
  raw = raw.replace(/^\d\.ª\s+P\s*A?\s*R?\s*T?\s*E\s+/i, '').trim()
  // Remove time patterns: "40'", "90+7'", "90'" (with or without +stoppage)
  raw = raw.replace(/\s+\d{1,3}(\+\d+)?[''′]/g, '').trim()
  // Remove substitution symbols
  raw = raw.replace(/[■⊕∧∨⊙☐◆▪↑↓→←✔✗]/g, '').trim()
  // Fix split accented letters: "Antô nio" → "Antônio"
  raw = raw.replace(/([A-ZÁÉÍÓÚÂÊÔÃÕÀÜ])\s([a-záéíóúâêôãõàü])/g, '$1$2')
  return raw.replace(/\s{2,}/g, ' ').trim()
}

function calcMinutos(nameLine) {
  // Match patterns: "40'", "90+7'" → capture full number including stoppage
  const times = [...nameLine.matchAll(/(\d{1,3})(?:\+\d+)?[''′]/g)].map(m => parseInt(m[1]))
  if (!times.length) return 90
  if (times.length === 1) {
    const t = times[0]
    const subbedIn = /[⊕∧↑]/.test(nameLine)
    if (subbedIn) return Math.max(1, 90 - t)
    return Math.min(t, 120)  // subbed out at t' (cap at 120 for ET)
  }
  // Two times: entered at min, left at max
  return Math.max(1, Math.max(...times) - Math.min(...times))
}

// Generic fraction extractor: "Label X/Y pct%" → [X, Y]
function _frac(text, pattern) {
  const m = text.match(pattern)
  return m ? [parseInt(m[1]), parseInt(m[2])] : [0, 0]
}

function _nr(text, pattern) {
  const m = text.match(pattern)
  return m ? parseInt(m[1]) : 0
}

function parseWyscoutPage(pageText) {
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean)
  let nome = null, minutos = 90

  for (let j = 0; j < lines.length; j++) {
    if (/\d\s*[×x]\s*\d/.test(lines[j])) {
      for (let back = j - 1; back >= Math.max(0, j - 4); back--) {
        const candidate = fixName(lines[back])
        if (candidate && /[A-Za-záéíóúâêôãõàü]{3}/.test(candidate) && candidate.length > 2 && candidate.length < 40) {
          nome = candidate
          minutos = calcMinutos(lines[back])
          break
        }
      }
      if (nome) break
    }
  }

  if (!nome || nome.length < 2) return null

  const T = pageText  // full page text

  // Helper: first occurrence of "Label D/S..." → [D, S]
  const frac = (re) => _frac(T, re)
  const nr   = (re) => _nr(T, re)

  // ─── Core stats ───────────────────────────────────────────────────────────
  const [acoes,   acoesS  ] = frac(/Ações\s*\/\s*com\s+sucesso\s+(\d+)\/(\d+)/)
  const [remates, remBal  ] = frac(/Remates\s*\/\s*[aà]\s+baliza\s+(\d+)\/(\d+)/)
  const [passes,  passesS ] = frac(/Passes\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [pFrente, pFrenteS] = frac(/Passes\s+para\s+a\s+frente\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [pAtras,  pAtrasS ] = frac(/Passes\s+para\s+tr[aá]s\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [pLat,    pLatS   ] = frac(/Passes\s+laterais?\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [pTF,     pTFS    ] = frac(/Passes\s+para\s+ter[cç]o\s+final\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [pLongos, pLongosS] = frac(/Passes\s+longos\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [dribles, driblesS] = frac(/Dribbles?\s*\/\s*com\s+sucesso\s+(\d+)\/(\d+)/)
  const [cruza,   cruzaS  ] = frac(/Cruzamentos\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [duelos,  duelosS ] = frac(/Duelos\s*\/\s*ganhos\s+(\d+)\/(\d+)/)
  const [dDef,    dDefS   ] = frac(/Duelos\s+defensivos\s*\/\s*ganhos\s+(\d+)\/(\d+)/)
  const [dOf,     dOfS    ] = frac(/Duelos\s+ofensivos\s*\/\s*ganhos\s+(\d+)\/(\d+)/)
  const [dAer,    dAerS   ] = frac(/Duelos\s+a[eé]reos\s*\/\s*ganhos\s+(\d+)\/(\d+)/)
  const [alivios, aliviosS] = frac(/Al[ií]vios\s+(\d+)\/(\d+)/)
  const intercep   = nr(/Intercep[cç][aã]o\s+(\d+)/)
  const corteCarr  = nr(/Corte\s+de\s+carrinho\s+(\d+)/)
  const faltas     = nr(/^Falta\s+(\d+)/m)
  const faltasSof  = nr(/Faltas?\s+sofridas?\s+(\d+)/)

  if (acoes === 0 && passes === 0 && duelos === 0 && intercep === 0) return null

  return {
    jogador:        nome,
    minutos,
    acoes,          acoes_sucesso: acoesS,
    remates,        remates_baliza: remBal,
    passes,         passes_certos: passesS,
    passes_frente:  pFrente,   passes_frente_certos: pFrenteS,
    passes_atras:   pAtras,    passes_atras_certos:  pAtrasS,
    passes_lat:     pLat,      passes_lat_certos:    pLatS,
    passes_tf:      pTF,       passes_tf_certos:     pTFS,
    passes_longos:  pLongos,   passes_longos_certos: pLongosS,
    dribles,        dribles_sucesso: driblesS,
    cruzamentos:    cruza,     cruzamentos_certos: cruzaS,
    duelos,         duelos_ganhos: duelosS,
    duelos_def:     dDef,      duelos_def_ganhos: dDefS,
    duelos_of:      dOf,       duelos_of_ganhos: dOfS,
    duelos_aereos:  dAer,      duelos_aereos_ganhos: dAerS,
    alivios,        alivios_sucesso: aliviosS,
    intercep,
    corte_carrinho: corteCarr,
    faltas,
    faltas_sofridas: faltasSof,
    // Legacy compat
    duelos_ganhos:  duelosS,
    pass_progr:     pFrenteS,  // passes para a frente = progr. proxy
  }
}

async function extractPdfPages(file) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
  const buf = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    let text = '', lastY = null
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) text += '\n'
      text += item.str
      lastY = item.transform[5]
    }
    pages.push(text)
  }
  return pages
}

// ─── TEAM STATS WYSCOUT PARSER (client-side) ──────────────────────────────────
// ─── TEAM STATS PARSER — Custom Excel format (Confiança template) ──────────────
// Column mapping (0-indexed, matches the actual Excel structure):
// A=0:Data, B=1:Jogo, C=2:Competição, D=3:Duração, E=4:Equipa, F=5:Sistema
// G=6:Golos, H=7:xG, I=8:Remates, J=9:Remates à baliza, K=10:Remates%
// L=11:Passes, M=12:Passes certos, N=13:Pass%, O=14:Posse%
// P=15:Perdas, Q=16:Perdas curto, R=17:Perdas médio, S=18:Perdas longo
// T=19:Recuperações, U=20:Rec curto, V=21:Rec médio, W=22:Rec longo
// X=23:Duelos, Y=24:Duelos ganhos, Z=25:Duelos%
const TS_IDX = {
  data:0, jogo:1, equipa:4, gols:6, xg:7, finalizacoes:8, fin_alvo:9,
  passes:11, passes_certos:12, passes_pct:13, posse:14,
  perdas:15, recuperacoes:19, duelos:23, duelos_ganhos:24, duelos_pct:25,
}

// Normalize a date string to YYYY-MM-DD for comparison
function _normDate(d) {
  if (!d) return ''
  const s = String(d)
  // Handle Excel date objects (already YYYY-MM-DD from sheet_to_json)
  // Handle "2026-05-12" or "12/05/2026" or Date objects
  const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return isoMatch[0]
  const brMatch = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  return s.slice(0,10)
}

// Load SheetJS from CDN (avoids npm dependency)
let _xlsxLib = null
async function _loadXlsx() {
  if (_xlsxLib) return _xlsxLib
  if (typeof window !== 'undefined' && window.XLSX) { _xlsxLib = window.XLSX; return _xlsxLib }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload  = resolve
    s.onerror = () => reject(new Error('Falha ao carregar SheetJS do CDN'))
    document.head.appendChild(s)
  })
  _xlsxLib = window.XLSX
  return _xlsxLib
}

async function parseTeamStatsFile(file, matchDate, adversario) {
  try {
    const XLSX = await _loadXlsx()
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { cellDates: false, cellNF: false })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const raw  = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true })

    // Skip first 3 rows (header row 0 + 2 average rows)
    const clubRows = raw.slice(3).filter(row =>
      row && row[TS_IDX.equipa] && String(row[TS_IDX.equipa]).toLowerCase().includes('confianca')
    )

    if (!clubRows.length) {
      return { error: 'Nenhuma linha do Confiança encontrada. Verifique a coluna "Equipa".' }
    }

    let matchRow = null
    const normAdv = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()

    if (matchDate) {
      const target = _normDate(matchDate)
      matchRow = clubRows.find(row => _normDate(row[TS_IDX.data]) === target)
    }
    if (!matchRow && adversario) {
      const adv = normAdv(adversario).slice(0, 6)
      matchRow = clubRows.find(row => normAdv(String(row[TS_IDX.jogo]||'')).includes(adv))
    }
    if (!matchRow) matchRow = clubRows[0]

    const g = idx => parseFloat(matchRow[idx] || 0) || 0

    return {
      teamStats: {
        gols:          g(TS_IDX.gols),
        xg:            g(TS_IDX.xg),
        finalizacoes:  g(TS_IDX.finalizacoes),
        fin_alvo:      g(TS_IDX.fin_alvo),
        passes:        g(TS_IDX.passes),
        passes_pct:    g(TS_IDX.passes_pct),
        posse:         g(TS_IDX.posse),
        perdas:        g(TS_IDX.perdas),
        recuperacoes:  g(TS_IDX.recuperacoes),
        duelos:        g(TS_IDX.duelos),
        duelos_ganhos: g(TS_IDX.duelos_ganhos),
        duelos_pct:    g(TS_IDX.duelos_pct),
      },
      allGames: clubRows.map(row => ({
        data: _normDate(row[TS_IDX.data]),
        jogo: String(row[TS_IDX.jogo] || ''),
        gols: row[TS_IDX.gols],
      })),
      matchedGame: {
        data: _normDate(matchRow[TS_IDX.data]),
        jogo: String(matchRow[TS_IDX.jogo] || ''),
      },
    }
  } catch (e) {
    return { error: 'Erro ao ler Excel de Team Stats: ' + e.message }
  }
}

// ─── COLLECTIVE DATASET (GPS time médio × Team Stats) ─────────────────────────
const GPS_KEY_MAP = {
  dist_p90:'totalDistance', hsr_p90:'dist20', sprint_p90:'dist25',
  sprints_p90:'sprints', accel_p90:'accel', decel_p90:'decel',
}

function isGK(r) {
  const p = (r.positionName || '').toLowerCase()
  return p.includes('golei') || p.includes('goal') || p === 'gk'
}

function buildCollectiveDataset(fullPartidas) {
  return fullPartidas
    .filter(p => p.gps_status === 'ok' && p.team_stats && Object.keys(p.team_stats).length > 2)
    .map(p => {
      const gpsRows = (p.gps_rows || []).filter(r => !isGK(r))
      if (!gpsRows.length) return null
      const teamGps = {}
      GPS_METRICS.forEach(m => {
        const raw = GPS_KEY_MAP[m.key]
        const vals = gpsRows.map(r => {
          const min = Math.max(durationToMin(r.duration), 1)
          return num(r[raw]) * (90 / min)
        }).filter(v => v > 0)
        teamGps[m.key] = vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : 0
      })
      return {
        partida_id: p.id, adversario: p.adversario||'?',
        data_jogo: p.data_jogo||'', resultado: p.resultado||'E',
        n_atletas: gpsRows.length,
        ...teamGps, ...p.team_stats,
      }
    })
    .filter(Boolean)
}
// Robust name matcher: exact > all-words > surname-only
function _findGps(wyscoutName, gpsRows) {
  const dN = normNome(wyscoutName)
  const dP = dN.split(' ').filter(p => p.length >= 3)
  // 1. Exact
  let m = gpsRows.find(g => normNome(g.playerName) === dN)
  if (m) return m
  // 2. ALL words of Wyscout name present in GPS name
  m = gpsRows.find(g => {
    const gP = normNome(g.playerName).split(' ').filter(p => p.length >= 3)
    return dP.length > 0 && dP.every(dp => gP.includes(dp))
  })
  if (m) return m
  // 3. Surname match — last significant word (min 4 chars to avoid false positives)
  const surname = dP[dP.length - 1]
  if (surname && surname.length >= 4) {
    m = gpsRows.find(g => normNome(g.playerName).split(' ').includes(surname))
  }
  return m || null
}

function _findGpsWithMappings(wyscoutName, gpsRows, customMappings) {
  const dN = normNome(wyscoutName)
  const mapped = customMappings[dN]
  if (mapped) {
    const m = gpsRows.find(g => normNome(g.playerName) === mapped)
    if (m) return m
  }
  return _findGps(wyscoutName, gpsRows)
}

function buildDataset(gpsRows, wyscoutRows, customMappings = {}) {
  if (!gpsRows?.length || !wyscoutRows?.length) return []
  return wyscoutRows.reduce((acc, d) => {
    const gps = _findGpsWithMappings(d.jogador, gpsRows, customMappings)
    if (!gps) return acc
    const min = Math.max(d.minutos || 90, 1)
    const f   = 90 / min
    const pct = (s, t) => t > 0 ? +(s / t * 100).toFixed(1) : 0
    const p90 = v => +(num(v) * f).toFixed(1)

    acc.push({
      nome:   d.jogador,
      pos:    normPos(gps.positionName),
      min,
      // ─── GPS ───────────────────────────────────────────────────────────────
      dist_p90:    Math.round(num(gps.totalDistance) * f),
      hsr_p90:     Math.round(num(gps.dist20)  * f),
      sprint_p90:  Math.round(num(gps.dist25)  * f),
      sprints_p90: p90(gps.sprints),
      accel_p90:   p90(gps.accel),
      decel_p90:   p90(gps.decel),
      maxVel:      num(gps.maxVel),
      hmld_p90:    p90(gps.hmld),
      // ─── Wyscout: ações ───────────────────────────────────────────────────
      acoes:          d.acoes       || 0,
      acoes_sucesso:  d.acoes_sucesso || 0,
      acoesW_pct:     pct(d.acoes_sucesso || 0, d.acoes || 1),
      remates_p90:    p90(d.remates),
      remates_baliza_p90: p90(d.remates_baliza),
      // ─── Wyscout: passes ──────────────────────────────────────────────────
      passesC_pct:      pct(d.passes_certos  || 0, d.passes     || 1),
      passProgr_p90:    p90(d.passes_frente_certos),
      passes_tf_pct:    pct(d.passes_tf_certos || 0, d.passes_tf || 1),
      passes_longos_pct:pct(d.passes_longos_certos || 0, d.passes_longos || 1),
      // ─── Wyscout: duelos ──────────────────────────────────────────────────
      duelos_p90:       p90(d.duelos),
      duelosW_pct:      pct(d.duelos_ganhos    || 0, d.duelos     || 1),
      duelos_def_p90:   p90(d.duelos_def),
      duelos_def_pct:   pct(d.duelos_def_ganhos|| 0, d.duelos_def || 1),
      duelos_of_p90:    p90(d.duelos_of),
      duelos_of_pct:    pct(d.duelos_of_ganhos || 0, d.duelos_of  || 1),
      duelos_aereos_pct:pct(d.duelos_aereos_ganhos || 0, d.duelos_aereos || 1),
      // ─── Wyscout: recuperação / pressão ───────────────────────────────────
      interc_p90:       p90(d.intercep),
      alivios_p90:      p90(d.alivios),
      // ─── Wyscout: drible / cruzamento ─────────────────────────────────────
      dribles_p90:      p90(d.dribles),
      dribles_suc_pct:  pct(d.dribles_sucesso || 0, d.dribles || 1),
      cruzamentos_p90:  p90(d.cruzamentos),
      cruzamentos_pct:  pct(d.cruzamentos_certos || 0, d.cruzamentos || 1),
      // ─── Wyscout: disciplina ──────────────────────────────────────────────
      faltas_p90:       p90(d.faltas),
      faltas_sof_p90:   p90(d.faltas_sofridas),
    })
    return acc
  }, [])
}

// Build dataset across all matches (historical)
function buildHistoricalDataset(partidas) {
  const customMappings = loadNameMap()  // load persisted name mappings
  const all = []
  partidas.forEach(p => {
    const ds = buildDataset(p.gps_rows || [], p.wyscout_rows || [], customMappings)
    ds.forEach(d => all.push({
      ...d,
      partida_id:  p.id,
      adversario:  p.adversario || '?',
      data_jogo:   p.data_jogo  || '',
      resultado:   p.resultado  || 'E',
      competicao:  p.competicao || '',
    }))
  })
  return all
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ icon = '📊', title, sub }) {
  return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center fade-in">
      <p className="text-5xl mb-3">{icon}</p>
      <p className="bc text-xl font-black uppercase text-gray-300">{title}</p>
      {sub && <p className="text-[10px] text-gray-300 mt-1">{sub}</p>}
    </div>
  )
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = status === 'ok'
    ? { bg:'bg-sky-100', text:'text-sky-700', border:'border-sky-200', label:'✓ OK' }
    : { bg:'bg-gray-100',  text:'text-gray-400',  border:'border-gray-200',  label:'Pendente' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: PAINEL DE RECONCILIAÇÃO DE NOMES
// ═══════════════════════════════════════════════════════════════════════════════
function ReconciliationPanel({ gpsRows, wyscoutRows, onMappingsChange }) {
  const [localMap,    setLocalMap]    = useState(() => loadNameMap())
  const [selections,  setSelections]  = useState({})
  const [showMatched, setShowMatched] = useState(false)

  const recon = useMemo(() =>
    buildReconciliation(gpsRows, wyscoutRows, localMap),
    [gpsRows, wyscoutRows, localMap]
  )

  const pending = recon.needsConfirm.filter(p => !selections[p.normWyscout])
  const totalMatched = recon.matched.length +
    Object.entries(selections).filter(([,v]) => v !== 'skip').length

  const confirm = (normW, normG) => {
    const newSel = { ...selections, [normW]: normG }
    setSelections(newSel)
    const toSave = { ...localMap }
    Object.entries(newSel).forEach(([k,v]) => v !== 'skip' ? (toSave[k]=v) : delete toSave[k])
    saveNameMap(toSave); setLocalMap(toSave); onMappingsChange?.(toSave)
  }

  const skip = (normW) => setSelections(s => ({ ...s, [normW]: 'skip' }))

  const resetManual = (normW) => {
    const newMap = { ...localMap }; delete newMap[normW]
    saveNameMap(newMap); setLocalMap(newMap)
    setSelections(s => { const n={...s}; delete n[normW]; return n })
    onMappingsChange?.(newMap)
  }

  if (!gpsRows.length || !wyscoutRows.length) return null

  return (
    <div className="space-y-3 mt-4">
      {/* Status */}
      <div className={`rounded-xl px-4 py-3 border flex items-center justify-between ${pending.length===0&&recon.needsConfirm.length===0?'bg-sky-50 border-sky-200':'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{pending.length===0&&recon.needsConfirm.length===0?'✅':'⚠️'}</span>
          <div>
            <p className="text-[10px] font-black text-gray-800">
              {totalMatched}/{wyscoutRows.length} atletas combinados GPS × Wyscout
            </p>
            <p className="text-[8px] text-gray-500 mt-0.5">
              {recon.matched.filter(m=>m.type==='exact').length} exatos ·{' '}
              {recon.matched.filter(m=>m.type==='auto').length} automáticos ·{' '}
              {recon.matched.filter(m=>m.type==='manual').length} manuais ·{' '}
              {pending.length>0?<span className="text-amber-600 font-bold">{pending.length} aguardando confirmação</span>:'todos resolvidos'}
            </p>
          </div>
        </div>
        {recon.matched.length>0 && (
          <button onClick={()=>setShowMatched(s=>!s)} className="text-[8px] text-gray-400 hover:text-gray-600 underline">
            {showMatched?'ocultar':'ver matches'}
          </button>
        )}
      </div>

      {/* Matched list */}
      {showMatched && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-[8px] font-black uppercase text-gray-400">Matches Ativos</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-44 overflow-y-auto scrollbar-g">
            {recon.matched.map((m,i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <span className={`text-[6px] px-1.5 py-0.5 rounded-full font-black flex-shrink-0 ${m.type==='exact'?'bg-sky-100 text-sky-700':m.type==='auto'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>
                  {m.type==='exact'?'EXATO':m.type==='auto'?'AUTO':'MANUAL'}
                </span>
                <span className="text-[9px] font-bold text-gray-700 truncate">{m.wyscout}</span>
                <span className="text-[8px] text-gray-300">→</span>
                <span className="text-[9px] text-gray-500 truncate flex-1">{m.gps}</span>
                {m.type==='manual' && (
                  <button onClick={()=>resetManual(normNome(m.wyscout))} className="text-[7px] text-gray-300 hover:text-red-400 flex-shrink-0">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs confirmation */}
      {recon.needsConfirm.length > 0 && (
        <div className="space-y-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-amber-700">
            🔍 Confirmar — Nomes Diferentes entre GPS e Wyscout
          </p>
          {recon.needsConfirm.map(item => {
            const sel = selections[item.normWyscout]
            const resolved = !!sel
            const confirmedCand = resolved && sel !== 'skip'
              ? item.candidates.find(c => c.normGps === sel) : null

            return (
              <div key={item.normWyscout}
                className={`bg-white border rounded-xl overflow-hidden ${resolved?'border-sky-300':'border-amber-200'}`}>
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[7px] font-black uppercase text-gray-400">Wyscout (não encontrado no GPS)</p>
                      <p className="text-sm font-black text-gray-900 mt-0.5">{item.wyscout}</p>
                    </div>
                    {resolved && (
                      <div className="text-right">
                        <p className="text-[7px] font-black uppercase text-sky-600">{sel==='skip'?'Pulado':'Confirmado'}</p>
                        {confirmedCand && <p className="text-[9px] font-bold text-sky-700">→ {confirmedCand.gpsName}</p>}
                        <button onClick={() => setSelections(s=>{const n={...s};delete n[item.normWyscout];return n})}
                          className="text-[7px] text-gray-400 hover:text-gray-600 underline">desfazer</button>
                      </div>
                    )}
                  </div>
                  {!resolved && (
                    <div>
                      <p className="text-[7px] font-black uppercase text-gray-400 mb-2">Candidatos GPS por similaridade:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.candidates.map(c => {
                          const pct = Math.round(c.score * 100)
                          const cls = pct>=60?'border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800':
                                      pct>=35?'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800':
                                              'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'
                          const badgeCls = pct>=60?'bg-sky-200 text-sky-700':pct>=35?'bg-amber-200 text-amber-700':'bg-gray-200 text-gray-500'
                          return (
                            <button key={c.normGps} onClick={() => confirm(item.normWyscout, c.normGps)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-bold transition-all ${cls}`}>
                              {c.gpsName}
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${badgeCls}`}>{pct}%</span>
                            </button>
                          )
                        })}
                        <button onClick={() => skip(item.normWyscout)}
                          className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-[9px] text-gray-400 font-bold">
                          Pular
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Truly unmatched */}
      {recon.unmatched.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Sem candidatos (excluídos da análise):</p>
          <div className="flex flex-wrap gap-1">
            {recon.unmatched.map(n => (
              <span key={n} className="text-[8px] px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">{n}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: UPLOAD (wizard 5 passos)
// ═══════════════════════════════════════════════════════════════════════════════
function TabUpload({ onRefresh }) {
  const [step,        setStep]        = useState(1)
  const [matchInfo,   setMatchInfo]   = useState({
    data_jogo:'', adversario:'', competicao:'Campeonato Brasileiro Série C',
    rodada:'', mando:'casa', placar:'0x0', resultado:'E', modelo_jogo:'',
  })
  const [gpsFile,      setGpsFile]      = useState(null)
  const [gpsRows,      setGpsRows]      = useState([])
  const [gpsError,     setGpsError]     = useState('')
  const [wyscoutFile,  setWyscoutFile]  = useState(null)
  const [wyscoutRows,  setWyscoutRows]  = useState([])
  const [wyscoutError, setWyscoutError] = useState('')
  const [tsFile,       setTsFile]       = useState(null)
  const [teamStats,    setTeamStats]    = useState(null)
  const [customMappings, setCustomMappings] = useState(() => loadNameMap())
  const [tsMatchedGame, setTsMatchedGame] = useState(null)
  const [tsAllGames,   setTsAllGames]   = useState([])
  const [tsError,      setTsError]      = useState('')
  const [parsing,      setParsing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState('')

  const gpsRef     = useRef()
  const wyscoutRef = useRef()
  const tsRef      = useRef()

  const setField = (k, v) => setMatchInfo(p => ({ ...p, [k]: v }))

  const handleGpsChange = async file => {
    if (!file) return
    setGpsFile(file); setGpsError(''); setGpsRows([])
    setParsing(true)
    const result = await parseGpsFile(file)
    setParsing(false)
    if (result.error) { setGpsError(result.error); return }
    setGpsRows(result.rows)
  }

  const handleWyscoutChange = async file => {
    if (!file) return
    setWyscoutFile(file); setWyscoutError(''); setWyscoutRows([])
    setParsing(true)
    try {
      const pages = await extractPdfPages(file)
      const rows  = pages.map(parseWyscoutPage).filter(Boolean)
      if (!rows.length) { setWyscoutError('Nenhum jogador encontrado. Confirme que é o Players in Match Report.'); setParsing(false); return }
      setWyscoutRows(rows)
    } catch (e) { setWyscoutError('Erro ao ler PDF: ' + e.message) }
    setParsing(false)
  }

  const handleTsChange = async file => {
    if (!file) return
    setTsFile(file); setTsError(''); setTeamStats(null); setTsMatchedGame(null); setTsAllGames([])
    setParsing(true)
    const result = await parseTeamStatsFile(file, matchInfo.data_jogo, matchInfo.adversario)
    setParsing(false)
    if (result.error) { setTsError(result.error); return }
    setTeamStats(result.teamStats)
    setTsMatchedGame(result.matchedGame || null)
    setTsAllGames(result.allGames || [])
  }

  const handleSave = async () => {
    setSaving(true); setSaveError('')
    try {
      const res  = await fetch('/api/banco-partidas', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ...matchInfo, gps_rows: gpsRows, wyscout_rows: wyscoutRows, team_stats: teamStats || {} }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erro ao salvar')
      setSaved(true)
      onRefresh()
      setTimeout(() => {
        setStep(1); setMatchInfo({ data_jogo:'', adversario:'', competicao:'Campeonato Brasileiro Série C', rodada:'', mando:'casa', placar:'0x0', resultado:'E', modelo_jogo:'' })
        setGpsFile(null); setGpsRows([]); setWyscoutFile(null); setWyscoutRows([])
        setTsFile(null); setTeamStats(null); setTsMatchedGame(null); setTsAllGames([]); setSaved(false)
      }, 2000)
    } catch (e) { setSaveError(e.message) }
    setSaving(false)
  }

  const canNext1 = matchInfo.data_jogo && matchInfo.adversario
  const canNext2 = gpsRows.length > 0
  const merged = useMemo(() => buildDataset(gpsRows, wyscoutRows, customMappings), [gpsRows, wyscoutRows, customMappings])

  const STEP_LABELS = ['', 'Informações', 'GPS', 'Wyscout', 'Team Stats', 'Confirmar']

  return (
    <div className="space-y-5 max-w-3xl fade-in">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {[1,2,3,4,5].map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div onClick={() => s < step && setStep(s)}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black border-2 transition-all ${s <= step ? 'cursor-pointer' : ''}`}
              style={{ background:s===step?G.verde:s<step?G.verde2:'white', borderColor:s<=step?G.verde:'#e5e7eb', color:s<=step?'white':'#9ca3af' }}>
              {s < step ? '✓' : s}
            </div>
            {s < 5 && <div className="h-0.5 w-6 flex-shrink-0" style={{background:s<step?G.verde:'#e5e7eb'}} />}
          </div>
        ))}
        <p className="text-[9px] text-gray-400 ml-2 font-bold">{STEP_LABELS[step]}</p>
      </div>

      {/* STEP 1: Match info */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <p className="bc text-lg font-black uppercase text-gray-900 mb-4">⚽ Informações da Partida</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Data do Jogo *</label>
              <input type="date" value={matchInfo.data_jogo} onChange={e => setField('data_jogo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Adversário *</label>
              <input value={matchInfo.adversario} onChange={e => setField('adversario', e.target.value)} placeholder="Ex: Pouso Alegre FC"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Competição</label>
              <input value={matchInfo.competicao} onChange={e => setField('competicao', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Rodada</label>
              <input value={matchInfo.rodada} onChange={e => setField('rodada', e.target.value)} placeholder="Ex: 3ª Rodada"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Mando</label>
              <div className="flex gap-2">
                {[['casa','🏟️ Casa'],['fora','✈️ Fora']].map(([v,l]) => (
                  <button key={v} onClick={() => setField('mando', v)}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${matchInfo.mando===v?'text-white border-transparent':'bg-gray-50 text-gray-500 border-gray-200'}`}
                    style={matchInfo.mando===v?{background:G.verde}:{}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Placar</label>
              <input value={matchInfo.placar} onChange={e => setField('placar', e.target.value)} placeholder="Ex: 2x1"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Resultado</label>
              <div className="flex gap-2">
                {RESULTADO_OPTS.map(({ v, label, color }) => (
                  <button key={v} onClick={() => setField('resultado', v)}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${matchInfo.resultado===v?'text-white border-transparent':'bg-gray-50 text-gray-500 border-gray-200'}`}
                    style={matchInfo.resultado===v?{background:color}:{}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Modelo de Jogo</label>
              <select value={matchInfo.modelo_jogo} onChange={e => setField('modelo_jogo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 focus:outline-none focus:border-sky-400">
                <option value="">— selecione —</option>
                {MODELO_OPTS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!canNext1}
              className="px-6 py-2.5 rounded-xl text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
              style={{background:G.verde}}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: GPS */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <p className="bc text-lg font-black uppercase text-gray-900">📡 GPS do Jogo</p>
          <p className="text-[9px] text-gray-400">Exporte o CSV ou XLSX do Catapult para este jogo. Aceita o mesmo formato que a página GPS principal.</p>
          <div
            onDrop={e => { e.preventDefault(); handleGpsChange(e.dataTransfer.files[0]) }}
            onDragOver={e => e.preventDefault()}
            onClick={() => gpsRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${gpsRows.length?'border-sky-400 bg-sky-50':'border-gray-200 hover:border-sky-300 hover:bg-sky-50/30'}`}>
            <input ref={gpsRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => handleGpsChange(e.target.files[0])} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:G.verde}} />
                <p className="text-[11px] text-gray-400">Processando...</p>
              </div>
            ) : gpsRows.length ? (
              <div>
                <p className="text-2xl mb-1">✅</p>
                <p className="font-black text-sky-700 text-[13px]">{gpsFile?.name}</p>
                <p className="text-[10px] text-sky-600 mt-0.5">{gpsRows.length} atletas encontrados · clique para trocar</p>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">📡</p>
                <p className="font-bold text-gray-500 text-[13px]">Arraste o CSV/XLSX do GPS aqui</p>
                <p className="text-[10px] text-gray-400 mt-1">Catapult Export · CSV ou XLSX</p>
              </div>
            )}
          </div>
          {gpsError && <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{gpsError}</p>}
          {gpsRows.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[8px] font-black uppercase text-gray-400 mb-2">Pré-visualização</p>
              <div className="flex flex-wrap gap-1">
                {gpsRows.slice(0, 12).map(r => (
                  <span key={r.playerName} className="text-[8px] px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600 font-bold">
                    {r.playerName.split(' ')[0]}
                  </span>
                ))}
                {gpsRows.length > 12 && <span className="text-[8px] text-gray-400 px-2 py-0.5">+{gpsRows.length-12} mais</span>}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="text-[9px] font-black uppercase text-gray-400 hover:text-gray-600">← Voltar</button>
            <button onClick={() => setStep(3)} disabled={!canNext2}
              className="px-6 py-2.5 rounded-xl text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
              style={{background:G.verde}}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Wyscout */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <p className="bc text-lg font-black uppercase text-gray-900">📄 Wyscout Players in Match Report</p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[9px] text-blue-700">No Wyscout: abra o jogo → <strong>Players in Match Report</strong> → exportar PDF. Um PDF com todos os jogadores da partida.</p>
          </div>
          <div
            onDrop={e => { e.preventDefault(); handleWyscoutChange(e.dataTransfer.files[0]) }}
            onDragOver={e => e.preventDefault()}
            onClick={() => wyscoutRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${wyscoutRows.length?'border-sky-400 bg-sky-50':'border-gray-200 hover:border-sky-300 hover:bg-sky-50/30'}`}>
            <input ref={wyscoutRef} type="file" accept=".pdf" className="hidden"
              onChange={e => handleWyscoutChange(e.target.files[0])} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:G.verde}} />
                <p className="text-[11px] text-gray-400">Lendo PDF...</p>
              </div>
            ) : wyscoutRows.length ? (
              <div>
                <p className="text-2xl mb-1">✅</p>
                <p className="font-black text-sky-700 text-[13px]">{wyscoutFile?.name}</p>
                <p className="text-[10px] text-sky-600 mt-0.5">{wyscoutRows.length} jogadores extraídos · clique para trocar</p>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">📄</p>
                <p className="font-bold text-gray-500 text-[13px]">Arraste o PDF do Wyscout aqui</p>
                <p className="text-[10px] text-gray-400 mt-1">Players in Match Report · PDF</p>
              </div>
            )}
          </div>
          {wyscoutError && <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{wyscoutError}</p>}
          {wyscoutRows.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[8px] font-black uppercase text-gray-400 mb-2">Jogadores extraídos ({wyscoutRows.length})</p>
              <div className="flex flex-wrap gap-1">
                {wyscoutRows.map(r => (
                  <span key={r.jogador} className="text-[8px] px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600 font-bold">
                    {r.jogador.split(' ')[0]} ({r.minutos}')
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reconciliation panel — shows when both GPS and Wyscout are loaded */}
          {gpsRows.length > 0 && wyscoutRows.length > 0 && (
            <ReconciliationPanel
              gpsRows={gpsRows}
              wyscoutRows={wyscoutRows}
              onMappingsChange={map => setCustomMappings(map)}
            />
          )}

          <p className="text-[9px] text-gray-400">Passo opcional — você pode salvar e adicionar o Wyscout depois na aba Banco.</p>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="text-[9px] font-black uppercase text-gray-400 hover:text-gray-600">← Voltar</button>
            <button onClick={() => setStep(4)}
              className="px-6 py-2.5 rounded-xl text-white text-[9px] font-black uppercase tracking-widest"
              style={{background:G.verde}}>
              Próximo →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Team Stats */}
      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <p className="bc text-lg font-black uppercase text-gray-900">📊 Team Stats Wyscout</p>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
            <p className="text-[9px] text-purple-700">
              No Wyscout: <strong>Competitions → seu jogo → Team Statistics → Export Excel</strong>.
              Use para análise coletiva GPS × posse, xG, finalizações, recuperações.
            </p>
          </div>
          <div
            onDrop={e => { e.preventDefault(); handleTsChange(e.dataTransfer.files[0]) }}
            onDragOver={e => e.preventDefault()}
            onClick={() => tsRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${teamStats?'border-sky-400 bg-sky-50':'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'}`}>
            <input ref={tsRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => handleTsChange(e.target.files[0])} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:G.purple}} />
                <p className="text-[11px] text-gray-400">Lendo arquivo...</p>
              </div>
            ) : teamStats ? (
              <div>
                <p className="text-2xl mb-1">✅</p>
                <p className="font-black text-sky-700 text-[13px]">{tsFile?.name}</p>
                {tsMatchedGame && (
                  <div className="mt-2 px-3 py-2 bg-sky-100 rounded-xl border border-sky-300 text-center">
                    <p className="text-[9px] font-black text-sky-700">Jogo detectado automaticamente</p>
                    <p className="text-[11px] font-bold text-sky-800 mt-0.5">{tsMatchedGame.jogo} · {tsMatchedGame.data}</p>
                  </div>
                )}
                {tsAllGames.length > 1 && (
                  <div className="mt-2">
                    <p className="text-[8px] text-gray-400 mb-1">{tsAllGames.length} jogos no arquivo:</p>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {tsAllGames.map((g,i) => (
                        <span key={i} className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold border ${tsMatchedGame?.data===g.data?'bg-sky-100 border-sky-400 text-sky-700':'bg-gray-50 border-gray-200 text-gray-400'}`}>
                          {g.data} {g.gols !== null ? `(${g.gols}g)` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {Object.entries(teamStats).filter(([,v]) => v>0).slice(0,5).map(([k,v]) => (
                    <span key={k} className="text-[8px] px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600 font-bold">
                      {k}: {typeof v==='number'?v.toFixed(1):v}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">📊</p>
                <p className="font-bold text-gray-500 text-[13px]">Arraste o Excel/CSV de Team Stats aqui</p>
                <p className="text-[10px] text-gray-400 mt-1">Wyscout Team Statistics · CSV ou XLSX · opcional</p>
              </div>
            )}
          </div>
          {tsError && <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{tsError}</p>}
          <p className="text-[9px] text-gray-400">Passo opcional — habilita a aba "Coletivo" com análise GPS × Team Stats.</p>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(3)} className="text-[9px] font-black uppercase text-gray-400 hover:text-gray-600">← Voltar</button>
            <button onClick={() => setStep(5)}
              className="px-6 py-2.5 rounded-xl text-white text-[9px] font-black uppercase tracking-widest"
              style={{background:G.verde}}>
              Revisar →
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Confirm */}
      {step === 5 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
          <p className="bc text-lg font-black uppercase text-gray-900">✅ Confirmar e Salvar</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Adversário',  val: matchInfo.adversario || '—' },
              { label:'Data',        val: matchInfo.data_jogo   || '—' },
              { label:'Placar',      val: matchInfo.placar       || '—' },
              { label:'Resultado',   val: matchInfo.resultado    || '—' },
              { label:'Competição',  val: matchInfo.competicao   || '—' },
              { label:'Rodada',      val: matchInfo.rodada       || '—' },
              { label:'Mando',       val: matchInfo.mando        || '—' },
              { label:'Modelo',      val: matchInfo.modelo_jogo  || '—' },
            ].map(({ label, val }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-[11px] font-bold text-gray-800 mt-0.5">{val}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl border p-4 text-center" style={{borderColor:gpsRows.length?G.verde:'#e5e7eb',background:gpsRows.length?'#f0fdf4':'#f8fafc'}}>
              <p className="text-[8px] font-black uppercase text-gray-400">GPS</p>
              <p className="text-xl font-black mt-1" style={{color:gpsRows.length?G.verde:'#9ca3af'}}>{gpsRows.length}</p>
              <p className="text-[8px] text-gray-400">atletas</p>
            </div>
            <div className="flex-1 rounded-xl border p-4 text-center" style={{borderColor:wyscoutRows.length?G.verde:'#e5e7eb',background:wyscoutRows.length?'#f0fdf4':'#f8fafc'}}>
              <p className="text-[8px] font-black uppercase text-gray-400">Wyscout</p>
              <p className="text-xl font-black mt-1" style={{color:wyscoutRows.length?G.verde:'#9ca3af'}}>{wyscoutRows.length}</p>
              <p className="text-[8px] text-gray-400">jogadores</p>
            </div>
            <div className="flex-1 rounded-xl border p-4 text-center" style={{borderColor:merged.length?G.verde:'#e5e7eb',background:merged.length?'#f0fdf4':'#f8fafc'}}>
              <p className="text-[8px] font-black uppercase text-gray-400">Match</p>
              <p className="text-xl font-black mt-1" style={{color:merged.length?G.verde:'#9ca3af'}}>{merged.length}</p>
              <p className="text-[8px] text-gray-400">cruzados</p>
            </div>
            <div className="flex-1 rounded-xl border p-4 text-center" style={{borderColor:teamStats?G.purple:'#e5e7eb',background:teamStats?'#faf5ff':'#f8fafc'}}>
              <p className="text-[8px] font-black uppercase text-gray-400">Team Stats</p>
              <p className="text-xl font-black mt-1" style={{color:teamStats?G.purple:'#9ca3af'}}>{teamStats?'✓':'—'}</p>
              <p className="text-[8px] text-gray-400">{teamStats?'importado':'pendente'}</p>
            </div>
          </div>
          {saveError && <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{saveError}</p>}
          {saved     && <p className="text-[10px] text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 font-black">✅ Partida salva com sucesso!</p>}
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(4)} className="text-[9px] font-black uppercase text-gray-400 hover:text-gray-600">← Voltar</button>
            <button onClick={handleSave} disabled={saving || saved}
              className="px-8 py-2.5 rounded-xl text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
              style={{background:G.verde}}>
              {saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</> : '💾 Salvar Partida'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: BANCO DE PARTIDAS
// ═══════════════════════════════════════════════════════════════════════════════
function TabBanco({ partidas, loading, onDelete }) {
  const [filterResult, setFilterResult] = useState('Todos')
  const [filterMando,  setFilterMando]  = useState('Todos')

  const filtered = partidas.filter(p => {
    if (filterResult !== 'Todos' && p.resultado !== filterResult) return false
    if (filterMando  !== 'Todos' && p.mando     !== filterMando)  return false
    return true
  })

  const stats = useMemo(() => ({
    total: partidas.length,
    completos: partidas.filter(p => p.gps_status === 'ok' && p.wyscout_status === 'ok').length,
    vitorias:  partidas.filter(p => p.resultado === 'V').length,
    empates:   partidas.filter(p => p.resultado === 'E').length,
    derrotas:  partidas.filter(p => p.resultado === 'D').length,
  }), [partidas])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{borderColor:G.verde}} />
    </div>
  )

  return (
    <div className="space-y-5 fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label:'Total de Jogos', val: stats.total,      color:G.verde  },
          { label:'Completos',      val: stats.completos,  color:G.verde2 },
          { label:'Vitórias',       val: stats.vitorias,   color:'#0a66b7'},
          { label:'Empates',        val: stats.empates,    color:G.amber  },
          { label:'Derrotas',       val: stats.derrotas,   color:G.red    },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">{label}</p>
            <p className="bc text-2xl font-black mt-1" style={{color}}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div>
          <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Resultado</p>
          <div className="flex gap-1">
            {['Todos','V','E','D'].map(r => (
              <button key={r} onClick={() => setFilterResult(r)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${filterResult===r?'text-white':'bg-gray-100 text-gray-500'}`}
                style={filterResult===r?{background:r==='V'?'#0a66b7':r==='D'?G.red:r==='E'?G.amber:G.verde}:{}}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Mando</p>
          <div className="flex gap-1">
            {['Todos','casa','fora'].map(m => (
              <button key={m} onClick={() => setFilterMando(m)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${filterMando===m?'text-white bg-gray-700':'bg-gray-100 text-gray-500'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[9px] text-gray-400 ml-auto">{filtered.length} partida(s)</p>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <EmptyState icon="📋" title="Nenhuma partida encontrada" sub="Use o tab Upload para adicionar jogos ao banco." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto scrollbar-g">
            <table className="w-full text-[10px]">
              <thead>
                <tr style={{background:G.verde}}>
                  {['Data','Jogo','Placar','Res.','Comp.','Rodada','Mando','GPS','Wyscout','Ações'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[8px] font-black uppercase tracking-widest text-white whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const resCfg = { V:{bg:'#dcfce7',color:'#07579e'}, E:{bg:'#fef9c3',color:'#854d0e'}, D:{bg:'#fee2e2',color:'#991b1b'} }[p.resultado] || {bg:'#f3f4f6',color:'#6b7280'}
                  return (
                    <tr key={p.id} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/30'} hover:bg-gray-50`}>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {fmtDate(p.data_jogo)}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 whitespace-nowrap">Confiança vs {p.adversario || '—'}</td>
                      <td className="px-3 py-2.5 font-black text-gray-700">{p.placar || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-black" style={{background:resCfg.bg,color:resCfg.color}}>
                          {p.resultado || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate">{p.competicao || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-400">{p.rodada || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 capitalize">{p.mando || '—'}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={p.gps_status} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={p.wyscout_status} /></td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => onDelete(p.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                            <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: BANCO CONSOLIDADO
// ═══════════════════════════════════════════════════════════════════════════════
function TabConsolidado({ fullPartidas }) {
  const [posFilter, setPosFilter] = useState('Todos')
  const [minMin,    setMinMin]    = useState(30)

  const historico = useMemo(() => buildHistoricalDataset(fullPartidas), [fullPartidas])

  const filtered = historico.filter(d => {
    if (posFilter !== 'Todos' && d.pos !== posFilter) return false
    if (d.min < minMin) return false
    return true
  })

  const positions = ['Todos', ...Object.keys(POS_LABEL)]

  if (!fullPartidas.length) return <EmptyState icon="📊" title="Nenhuma partida com dados" sub="Faça upload de partidas com GPS e Wyscout." />

  return (
    <div className="space-y-4 fade-in">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div>
          <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Posição</p>
          <div className="flex flex-wrap gap-1">
            {positions.map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${posFilter===pos?'text-white':'bg-gray-100 text-gray-500'}`}
                style={posFilter===pos?{background:pos==='Todos'?G.verde:(POS_COLOR[pos]||G.verde)}:{}}>
                {POS_LABEL[pos] || pos}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Min. minutos</p>
          <div className="flex gap-1">
            {[20,30,45,60].map(m => (
              <button key={m} onClick={() => setMinMin(m)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-black ${minMin===m?'text-white':'bg-gray-100 text-gray-500'}`}
                style={minMin===m?{background:G.verde}:{}}>
                {m}'
              </button>
            ))}
          </div>
        </div>
        <p className="text-[9px] text-gray-400 ml-auto">{filtered.length} registros · {fullPartidas.length} jogos</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-g">
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{background:'#1f2937'}}>
                {['Jogo','Atleta','Pos','Min','Dist p90','HSR p90','Sprint p90','Sprints','Acel','Decel','Duelos','D. Ganhos %','Intercep.','Passes %','Ações %','PP p90'].map(h => (
                  <th key={h} className="px-2 py-3 text-left text-[8px] font-black uppercase tracking-wide text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/30'} row-hover`}>
                  <td className="px-2 py-2 text-gray-400 text-[8px] whitespace-nowrap">{d.adversario}</td>
                  <td className="px-2 py-2 font-bold text-gray-900 whitespace-nowrap">{d.nome}</td>
                  <td className="px-2 py-2"><span className="inline-block px-1.5 py-0.5 rounded-full text-[7px] font-black text-white" style={{background:POS_COLOR[d.pos]||'#888'}}>{d.pos}</span></td>
                  <td className="px-2 py-2 text-gray-400">{d.min}'</td>
                  <td className="px-2 py-2 font-bold text-gray-700">{d.dist_p90 >= 1000 ? `${(d.dist_p90/1000).toFixed(1)}k` : d.dist_p90}</td>
                  <td className="px-2 py-2" style={{color:d.hsr_p90>800?G.verde:d.hsr_p90>400?G.amber:G.slate}}>{d.hsr_p90}</td>
                  <td className="px-2 py-2" style={{color:d.sprint_p90>300?G.verde:d.sprint_p90>150?G.amber:G.slate}}>{d.sprint_p90}</td>
                  <td className="px-2 py-2 text-gray-600">{d.sprints_p90}</td>
                  <td className="px-2 py-2 text-gray-600">{d.accel_p90}</td>
                  <td className="px-2 py-2 text-gray-600">{d.decel_p90}</td>
                  <td className="px-2 py-2 text-gray-600">{d.duelos_p90}</td>
                  <td className="px-2 py-2 font-bold" style={{color:d.duelosW_pct>=55?G.verde:d.duelosW_pct>=40?G.amber:G.red}}>{d.duelosW_pct}%</td>
                  <td className="px-2 py-2 text-gray-600">{d.interc_p90}</td>
                  <td className="px-2 py-2 font-bold" style={{color:d.passesC_pct>=80?G.verde:d.passesC_pct>=65?G.amber:G.red}}>{d.passesC_pct}%</td>
                  <td className="px-2 py-2 font-bold" style={{color:d.acoesW_pct>=60?G.verde:d.acoesW_pct>=45?G.amber:G.red}}>{d.acoesW_pct}%</td>
                  <td className="px-2 py-2 text-gray-600">{d.passProgr_p90}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[10px] text-gray-300">Nenhum dado com os filtros selecionados</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CORRELAÇÕES (single game + historical)
// ═══════════════════════════════════════════════════════════════════════════════
function TabCorrelacoes({ fullPartidas }) {
  const [scope,       setScope]       = useState('historico')
  const [selectedId,  setSelectedId]  = useState('')
  const [posFilter,   setPosFilter]   = useState('ZAG')
  const [minMin,      setMinMin]      = useState(30)
  const [dimFilter,   setDimFilter]   = useState('Todos')   // Todos | Defensiva | Ofensiva | Controle
  const [resFilter,   setResFilter]   = useState('Todos')   // Todos | V | E | D
  const [activeSx,    setActiveSx]    = useState('accel_p90')
  const [activeSy,    setActiveSy]    = useState('interc_p90')
  const [colorBy,     setColorBy]     = useState('resultado')  // resultado | posicao

  const historico = useMemo(() => buildHistoricalDataset(fullPartidas), [fullPartidas])

  // Dimension groups for PERF_METRICS
  const DIM_GROUPS = {
    Defensiva: ['duelos_p90','duelosW_pct','duelos_def_p90','duelos_def_pct','duelos_aereos_pct','interc_p90','alivios_p90'],
    Ofensiva:  ['duelos_of_p90','duelos_of_pct','remates_p90','dribles_p90','dribles_suc_pct','cruzamentos_p90','cruzamentos_pct','faltas_sof_p90','passProgr_p90'],
    Controle:  ['passesC_pct','passes_tf_pct','passes_longos_pct','acoesW_pct','faltas_p90'],
  }

  const filteredPerfs = useMemo(() => {
    if (dimFilter === 'Todos') return PERF_METRICS
    const keys = DIM_GROUPS[dimFilter] || []
    return PERF_METRICS.filter(m => keys.includes(m.key))
  }, [dimFilter])

  const dataset = useMemo(() => {
    let base = scope === 'historico' ? historico
      : historico.filter(d => String(d.partida_id) === String(selectedId))
    if (posFilter) base = base.filter(d => d.pos === posFilter)
    if (resFilter !== 'Todos') base = base.filter(d => d.resultado === resFilter)
    return base.filter(d => d.min >= minMin)
  }, [historico, scope, selectedId, posFilter, minMin, resFilter])

  const matrix = useMemo(() => GPS_METRICS.map(gm => ({
    gps: gm,
    perfs: filteredPerfs.map(pm => ({ perf: pm, stats: pearsonStats(dataset, gm.key, pm.key) }))
  })), [dataset, filteredPerfs])

  // All pairs sorted by |r|
  const allPairs = useMemo(() => {
    const out = []
    matrix.forEach(row => row.perfs.forEach(cell => {
      if (cell.stats.r !== null)
        out.push({ gpsKey:row.gps.key, gpsLabel:row.gps.label, gpsColor:row.gps.color,
                   perfKey:cell.perf.key, perfLabel:cell.perf.label, ...cell.stats })
    }))
    return out.sort((a,b) => Math.abs(b.r) - Math.abs(a.r))
  }, [matrix])

  const topSig       = allPairs.filter(p => p.sig)
  const topStrong    = allPairs.filter(p => Math.abs(p.r) >= 0.5).slice(0, 6)
  const topPositive  = allPairs.filter(p => p.r > 0).slice(0, 4)
  const topNegative  = allPairs.filter(p => p.r < 0).slice(0, 4)

  // Scatter data
  const gxMeta = GPS_METRICS.find(g => g.key === activeSx) || GPS_METRICS[0]
  const pyMeta = filteredPerfs.find(p => p.key === activeSy) || filteredPerfs[0] || PERF_METRICS[0]

  const scatterData = useMemo(() => {
    const all = []
    GPS_METRICS.forEach(gm => filteredPerfs.forEach(pm => {
      if (gm.key===activeSx && pm.key===activeSy) {
        dataset.forEach(d => all.push({
          ...d, _x:d[activeSx]||0, _y:(activeSy&&d[activeSy])||0,
          fill: colorBy==='resultado'
            ? ({V:'#0a66b7',E:'#ca8a04',D:'#dc2626'}[d.resultado]||'#6b7280')
            : (POS_COLOR[d.pos]||'#6b7280')
        }))
      }
    }))
    return all
  }, [dataset, activeSx, activeSy, colorBy, filteredPerfs])

  const scatterStats = useMemo(() => pearsonStats(dataset, activeSx, activeSy), [dataset, activeSx, activeSy])

  // Outlier detection: residuals from regression line
  const outliers = useMemo(() => {
    const pts = scatterData.filter(d => d._x > 0 && d._y > 0)
    if (pts.length < 4) return { above:[], below:[] }
    const n = pts.length
    const mx = pts.reduce((s,d)=>s+d._x,0)/n
    const my = pts.reduce((s,d)=>s+d._y,0)/n
    const slope = pts.reduce((s,d)=>s+(d._x-mx)*(d._y-my),0) / (pts.reduce((s,d)=>s+(d._x-mx)**2,0)||1)
    const intercept = my - slope * mx
    const withRes = pts.map(d => ({ ...d, predicted: slope*d._x + intercept, residual: d._y - (slope*d._x+intercept) }))
    const resStd = Math.sqrt(withRes.reduce((s,d)=>s+d.residual**2,0)/n)
    return {
      above: withRes.filter(d => d.residual >  resStd * 1.2).sort((a,b)=>b.residual-a.residual).slice(0,3),
      below: withRes.filter(d => d.residual < -resStd * 1.2).sort((a,b)=>a.residual-b.residual).slice(0,3),
    }
  }, [scatterData])

  // Auto diagnostic text
  const diagnostic = useMemo(() => {
    if (!topStrong.length || !posFilter) return null
    const posName = POS_LABEL[posFilter] || posFilter
    const top = topStrong[0]
    const neg = topNegative[0]
    const n   = dataset.length
    if (n < 3) return null
    let txt = `Nos ${n} registros de ${posName}s (mín. ${minMin}'), `
    txt += `as métricas de maior relação foram ${topStrong.slice(0,3).map(p=>`${p.gpsLabel} × ${p.perfLabel} (r=${p.r>0?'+':''}${p.r})`).join(', ')}. `
    if (top.r > 0.6) {
      txt += `A relação forte entre ${top.gpsLabel} e ${top.perfLabel} sugere que maior exigência nessa dimensão física esteve associada a maior volume de ação na função tática. `
    }
    if (neg && Math.abs(neg.r) >= 0.4) {
      txt += `A relação negativa entre ${neg.gpsLabel} e ${neg.perfLabel} (r=${neg.r}) pode indicar queda de eficiência técnica sob alta exigência física.`
    }
    return txt
  }, [topStrong, topNegative, posFilter, dataset.length, minMin])

  // Football-language insight for a correlation
  const corrInsight = (gpsKey, perfKey, r) => {
    const posName = POS_LABEL[posFilter] || 'atletas'
    const abs = Math.abs(r)
    const dir = r > 0 ? 'positiva' : 'negativa'
    const str = abs >= 0.7 ? 'forte' : abs >= 0.5 ? 'moderada' : 'fraca'
    const GPS_PHRASE = {
      hsr_p90:    'maior deslocamento em alta intensidade',
      sprint_p90: 'maior volume em sprint',
      accel_p90:  'maior volume de acelerações',
      decel_p90:  'maior volume de desacelerações',
      dist_p90:   'maior distância percorrida',
      sprints_p90:'maior número de sprints',
    }
    const PERF_PHRASE = {
      duelos_p90:      'maior volume de duelos',
      duelos_def_p90:  'maior participação defensiva em duelos',
      duelos_of_p90:   'maior participação ofensiva em duelos',
      interc_p90:      'maior volume de intercepções',
      passesC_pct:     'melhor precisão de passes',
      acoesW_pct:      'melhor taxa de ações certas',
      dribles_p90:     'maior número de dribles',
      remates_p90:     'mais remates',
      passProgr_p90:   'mais passes progressivos',
    }
    const gPhrase = GPS_PHRASE[gpsKey] || gpsKey
    const pPhrase = PERF_PHRASE[perfKey] || perfKey
    const insight = r > 0
      ? `Relação ${dir} ${str}: ${gPhrase} esteve associado a ${pPhrase} em ${posName}s.`
      : `Relação ${dir} ${str}: ${gPhrase} esteve associado a menor ${pPhrase.replace('maior ','').replace('melhor ','')} — possível queda de eficiência sob alta demanda.`
    const alert = r > 0 && gpsKey.includes('hsr') && perfKey.includes('duelo')
      ? 'Alerta: pode indicar contexto de maior exigência defensiva no jogo, não necessariamente performance superior.'
      : null
    return { insight, alert }
  }

  const hasData = dataset.length >= 3

  return (
    <div className="space-y-5 fade-in">

      {/* ── FILTROS ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-5 items-end">
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Escopo</p>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[['historico','📈 Histórico'],['jogo','⚽ Jogo único']].map(([id,lbl]) => (
              <button key={id} onClick={() => setScope(id)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${scope===id?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:bg-white/60'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {scope === 'jogo' && (
          <div className="flex-1 min-w-48">
            <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Partida</p>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] bg-gray-50 focus:outline-none focus:border-sky-400">
              <option value="">— selecione —</option>
              {fullPartidas.filter(p => p.gps_status==='ok'&&p.wyscout_status==='ok').map(p => (
                <option key={p.id} value={p.id}>Confiança vs {p.adversario} ({p.data_jogo || '?'})</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Posição</p>
          <div className="flex flex-wrap gap-1">
            {Object.keys(POS_LABEL).filter(p=>p!=='GOL').map(p => (
              <button key={p} onClick={() => setPosFilter(p)}
                className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${posFilter===p?'text-white':'bg-gray-100 text-gray-500'}`}
                style={posFilter===p?{background:POS_COLOR[p]||G.verde}:{}}>
                {POS_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="text-[7px] text-gray-400 mt-1">Análise intra-posição · Para visão coletiva use a aba Coletivo</p>
        </div>
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Dimensão</p>
          <div className="flex gap-1">
            {['Todos','Defensiva','Ofensiva','Controle'].map(d => (
              <button key={d} onClick={() => setDimFilter(d)}
                className={`px-2 py-1 rounded-lg text-[8px] font-black ${dimFilter===d?'text-white bg-gray-700':'bg-gray-100 text-gray-500'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Resultado</p>
          <div className="flex gap-1">
            {['Todos','V','E','D'].map(r => (
              <button key={r} onClick={() => setResFilter(r)}
                className={`px-2 py-1 rounded-lg text-[8px] font-black ${resFilter===r?'text-white':'bg-gray-100 text-gray-500'}`}
                style={resFilter===r?{background:r==='V'?'#0a66b7':r==='D'?'#dc2626':r==='E'?'#ca8a04':'#374151'}:{}}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Min. minutos</p>
          <div className="flex gap-1">
            {[20,30,45].map(m => (
              <button key={m} onClick={() => setMinMin(m)}
                className={`px-2 py-1 rounded-lg text-[8px] font-black ${minMin===m?'text-white':'bg-gray-100 text-gray-500'}`}
                style={minMin===m?{background:G.verde}:{}}>
                {m}'
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-100 rounded-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span className="text-[8px] font-black text-sky-700">n = {dataset.length} registros</span>
        </div>
      </div>

      {/* ── AVISO AMOSTRA ────────────────────────────────────────────────── */}
      {dataset.length < 10 && dataset.length >= 3 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-amber-500">⚠️</span>
          <p className="text-[9px] text-amber-700">
            <strong>n={dataset.length} registros.</strong> {dataset.length < 5 ? 'Amostra muito pequena — interprete apenas como indício.' : 'Amostra moderada — interprete como tendência inicial, não causalidade.'}
          </p>
        </div>
      )}

      {!hasData ? (
        <EmptyState icon="🔗" title="Poucos dados para esta seleção"
          sub="Selecione outra posição, reduza o filtro de minutos ou importe mais partidas." />
      ) : (
        <>
          {/* ── DIAGNÓSTICO AUTOMÁTICO ─────────────────────────────────────── */}
          {diagnostic && (
            <div className="bg-white rounded-2xl border-l-4 border-sky-600 border border-sky-100 shadow-sm p-5">
              <p className="text-[8px] font-black uppercase tracking-widest text-sky-700 mb-2">💡 Diagnóstico — {POS_LABEL[posFilter] || posFilter}s</p>
              <p className="text-[11px] text-gray-700 leading-relaxed">{diagnostic}</p>
            </div>
          )}

          {/* ── RELAÇÕES PRIORITÁRIAS ──────────────────────────────────────── */}
          {topStrong.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <p className="bc text-base font-black uppercase text-gray-900">Relações Prioritárias</p>
                  <p className="text-[9px] text-gray-400">|r| ≥ 0.5 · ★ = p&lt;.05 · posição selecionada: {POS_LABEL[posFilter]}</p>
                </div>
                <div className="flex gap-2 text-[8px] items-center">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-sky-300 inline-block"/>r &gt; 0</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-300 inline-block"/>r &lt; 0</span>
                  <span className="text-gray-400">★ p&lt;.05</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topStrong.map((c, i) => {
                  const { insight, alert } = corrInsight(c.gpsKey, c.perfKey, c.r)
                  return (
                    <div key={i} className="rounded-xl border p-4"
                      style={{background:rBg(c.r), borderColor:rColor(c.r)+'40'}}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="text-center flex-shrink-0 min-w-[52px]">
                          <p className="bc text-2xl font-black leading-none" style={{color:rColor(c.r)}}>
                            {c.r>0?'+':''}{c.r}{c.sig?' ★':''}
                          </p>
                          <p className="text-[7px] font-black uppercase mt-0.5" style={{color:rColor(c.r)}}>{rLabel(c.r)}</p>
                          <p className="text-[7px] text-gray-400 mt-0.5">r²={c.r2?.toFixed(2)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-gray-700" style={{borderLeft:`2px solid ${c.gpsColor}`,paddingLeft:6}}>{c.gpsLabel}</p>
                          <p className="text-[8px] text-gray-400 ml-1.5">×</p>
                          <p className="text-[9px] font-black text-gray-700 ml-1.5">{c.perfLabel}</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-600 leading-relaxed">{insight}</p>
                      {alert && (
                        <p className="text-[8px] text-amber-600 mt-1 italic">⚠️ {alert}</p>
                      )}
                    </div>
                  )
                })}
              </div>
              {topSig.length > 0 && (
                <p className="text-[8px] text-gray-400 mt-3">
                  {topSig.length} relação(ões) estatisticamente significativa(s) (p&lt;.05) no total · n={dataset.length}
                </p>
              )}
            </div>
          )}

          {/* ── MATRIZ DE CORRELAÇÃO ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div>
                <h3 className="bc text-base font-black uppercase text-gray-900">Matriz de Correlação</h3>
                <p className="text-[9px] text-gray-400">{dataset.length} registros · {POS_LABEL[posFilter]||'posição'} · {dimFilter} · clique na célula → scatter</p>
              </div>
              {/* LEGENDA */}
              <div className="flex flex-wrap gap-2 text-[7px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-8 h-2 rounded inline-block bg-sky-300"/>pos. forte</span>
                <span className="flex items-center gap-1"><span className="w-8 h-2 rounded inline-block bg-red-300"/>neg. forte</span>
                <span className="flex items-center gap-1"><span className="w-4 h-2 rounded inline-block bg-gray-200"/>fraca</span>
                <span className="font-bold">★ = p&lt;.05</span>
                <span>r²= poder explicativo</span>
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-g mt-3">
              <table className="w-full text-[10px]">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 font-black text-[9px] uppercase pb-3 pr-4 w-40">GPS \ Desempenho</th>
                    {filteredPerfs.map(pm => (
                      <th key={pm.key} className="text-center text-gray-400 font-black text-[8px] uppercase pb-3 px-1 min-w-[88px] whitespace-nowrap">{pm.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, ri) => (
                    <tr key={row.gps.key} className={ri%2===0?'bg-gray-50/50':''}>
                      <td className="py-2 pr-4 font-bold text-gray-700 whitespace-nowrap text-[10px]"
                        style={{borderLeft:`3px solid ${row.gps.color}`, paddingLeft:8}}>
                        {row.gps.label}
                      </td>
                      {row.perfs.map(cell => {
                        const { r, r2, p, sig, n } = cell.stats
                        const isWeak = r !== null && Math.abs(r) < 0.25
                        return (
                          <td key={cell.perf.key} className="py-1.5 px-1 text-center">
                            <button
                              onClick={() => { setActiveSx(row.gps.key); setActiveSy(cell.perf.key) }}
                              title={r!==null ? `r²=${r2} · p=${p} · n=${n}${sig?' · ★ p<.05':''}` : 'n < 3'}
                              className={`w-full rounded-lg pt-1.5 pb-1 px-1 font-black transition-all hover:scale-105 ${isWeak?'opacity-50':''}`}
                              style={{background:rBg(r), color:rColor(r), border:sig?`1.5px solid ${rColor(r)}`:'none'}}>
                              <div className="text-[8px] leading-none mb-0.5">
                                {r!==null && Math.abs(r)>=0.5 ? (r>0?'🟢':'🔴') : r!==null && Math.abs(r)>=0.3 ? '⚠️' : '⚪'}
                              </div>
                              <div className="text-[11px] leading-tight">
                                {r !== null ? `${r > 0 ? '+' : ''}${r.toFixed(2)}${sig?' ★':''}` : '—'}
                              </div>
                              {r2 !== null && (
                                <div className="text-[7px] font-bold opacity-70 leading-tight mt-0.5">
                                  r²={r2.toFixed(2)}
                                </div>
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SCATTER + OUTLIERS ────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <p className="bc text-base font-black uppercase text-gray-900">Scatter Plot</p>
                <p className="text-[9px] text-gray-400">Cada ponto = atleta em 1 jogo · {scope==='historico'?'histórico':'jogo único'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-[7px] text-gray-400 uppercase">r</p>
                  <p className="text-xl font-black" style={{color:rColor(scatterStats.r)}}>
                    {scatterStats.r!==null?`${scatterStats.r>0?'+':''}${scatterStats.r.toFixed(2)}${scatterStats.sig?' ★':''}`:'—'}
                  </p>
                  {scatterStats.r2!=null&&<p className="text-[7px] text-gray-400">r²={scatterStats.r2.toFixed(2)} · {scatterStats.sig?'p<.05':'p='+scatterStats.p}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[7px] font-black uppercase text-gray-400 block mb-1">GPS (X)</label>
                <select value={activeSx} onChange={e=>setActiveSx(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-sky-400">
                  {GPS_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[7px] font-black uppercase text-gray-400 block mb-1">Desempenho (Y)</label>
                <select value={activeSy} onChange={e=>setActiveSy(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-sky-400">
                  {filteredPerfs.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[7px] font-black uppercase text-gray-400 block mb-1">Colorir por</label>
                <div className="flex gap-1">
                  {[['resultado','Resultado'],['posicao','Posição']].map(([id,lbl]) => (
                    <button key={id} onClick={()=>setColorBy(id)}
                      className={`flex-1 py-1.5 rounded-xl text-[8px] font-black ${colorBy===id?'text-white':'bg-gray-100 text-gray-500'}`}
                      style={colorBy===id?{background:G.verde}:{}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {scatterData.length >= 3 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{top:8,right:16,bottom:24,left:-4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="_x" type="number"
                    label={{value:gxMeta.label, position:'insideBottom', offset:-14, fontSize:8, fill:'#94a3b8'}}
                    tick={{fontSize:8,fill:'#94a3b8'}} />
                  <YAxis dataKey="_y" type="number"
                    label={{value:pyMeta?.label||activeSy, angle:-90, position:'insideLeft', offset:8, fontSize:8, fill:'#94a3b8'}}
                    tick={{fontSize:8,fill:'#94a3b8'}} />
                  <ZAxis range={[55,55]} />
                  <Tooltip content={({active,payload}) => {
                    if (!active||!payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                        <p className="font-black text-gray-900">{d?.nome}</p>
                        <p className="text-gray-400 text-[9px]">vs {d?.adversario} · {d?.resultado} · {d?.min}'</p>
                        <p className="text-[9px]">{POS_LABEL[d?.pos]||d?.pos}</p>
                        <p className="mt-1"><span className="text-gray-400">{gxMeta.label}:</span> <b>{d?._x?.toFixed(1)}</b></p>
                        <p><span className="text-gray-400">{pyMeta?.label||activeSy}:</span> <b>{d?._y?.toFixed(1)}</b></p>
                      </div>
                    )
                  }} />
                  <Scatter data={scatterData}
                    shape={({cx,cy,payload}) => (
                      <circle cx={cx} cy={cy} r={5} fill={payload?.fill||G.verde} fillOpacity={0.85} stroke="white" strokeWidth={1}/>
                    )} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[9px] text-gray-400 text-center py-8">Mínimo 3 registros para o scatter.</p>
            )}

            {/* Legenda colorBy */}
            <div className="flex gap-4 mt-2 justify-center text-[9px]">
              {colorBy === 'resultado' ? (
                [['#0a66b7','Vitória'],['#ca8a04','Empate'],['#dc2626','Derrota']].map(([c,l])=>(
                  <span key={l} className="flex items-center gap-1.5 font-bold text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>{l}
                  </span>
                ))
              ) : (
                Object.entries(POS_COLOR).map(([p,c])=>(
                  <span key={p} className="flex items-center gap-1.5 font-bold text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>{POS_LABEL[p]}
                  </span>
                ))
              )}
            </div>

            {/* Outliers */}
            {(outliers.above.length > 0 || outliers.below.length > 0) && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                  <p className="text-[8px] font-black uppercase text-sky-700 mb-2">⬆️ Acima da Curva</p>
                  <p className="text-[7px] text-sky-600 mb-2">Entregam mais desempenho do que esperado para a carga física</p>
                  {outliers.above.map((d,i) => (
                    <div key={i} className="text-[8px] text-gray-700 font-bold">
                      {d.nome} <span className="text-gray-400 font-normal">vs {d.adversario} · {d.min}'</span>
                    </div>
                  ))}
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-[8px] font-black uppercase text-red-600 mb-2">⬇️ Abaixo da Curva</p>
                  <p className="text-[7px] text-red-500 mb-2">Alta demanda física com baixo retorno na métrica selecionada</p>
                  {outliers.below.map((d,i) => (
                    <div key={i} className="text-[8px] text-gray-700 font-bold">
                      {d.nome} <span className="text-gray-400 font-normal">vs {d.adversario} · {d.min}'</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── INSIGHTS COMPLETOS ────────────────────────────────────────── */}
          {allPairs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="bc text-base font-black uppercase text-gray-900 mb-4">💡 Todas as Relações Relevantes (|r| ≥ 0.3)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allPairs.filter(c=>Math.abs(c.r)>=0.3).slice(0,10).map((c, i) => (
                  <div key={i} className="rounded-xl border p-3 flex items-start gap-3"
                    style={{background:rBg(c.r), borderColor:rColor(c.r)+'40'}}>
                    <div className="text-center flex-shrink-0 min-w-[52px]">
                      <p className="bc text-xl font-black leading-none" style={{color:rColor(c.r)}}>
                        {c.r>0?'+':''}{c.r}{c.sig?' ★':''}
                      </p>
                      <p className="text-[7px] font-black uppercase mt-0.5" style={{color:rColor(c.r)}}>{rLabel(c.r)}</p>
                      <p className="text-[7px] text-gray-400 mt-0.5">r²={c.r2?.toFixed(2)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-gray-800">{c.gpsLabel} × {c.perfLabel}</p>
                      <p className="text-[8px] text-gray-500 mt-0.5">{corrInsight(c.gpsKey, c.perfKey, c.r).insight}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SCATTER / QUADRANTE
// ═══════════════════════════════════════════════════════════════════════════════
function TabScatter({ fullPartidas }) {
  const [sx,         setSx]         = useState('hsr_p90')
  const [sy,         setSy]         = useState('duelosW_pct')
  const [posFilter,  setPosFilter]  = useState('')
  const [resultFilter, setResultFilter] = useState('Todos')
  const [minMin,     setMinMin]     = useState(30)

  const historico = useMemo(() => buildHistoricalDataset(fullPartidas), [fullPartidas])

  const filtered = useMemo(() => historico.filter(d => {
    if (posFilter && d.pos !== posFilter)    return false
    if (resultFilter !== 'Todos' && d.resultado !== resultFilter) return false
    if (d.min < minMin) return false
    return d[sx] != null && d[sy] != null
  }), [historico, sx, sy, posFilter, resultFilter, minMin])

  const r = useMemo(() => pearsonR(filtered, sx, sy), [filtered, sx, sy])

  // Medians for quadrant lines
  const medX = useMemo(() => {
    if (!filtered.length) return 0
    const sorted = [...filtered].map(d => d[sx] || 0).sort((a,b) => a-b)
    return sorted[Math.floor(sorted.length/2)]
  }, [filtered, sx])
  const medY = useMemo(() => {
    if (!filtered.length) return 0
    const sorted = [...filtered].map(d => d[sy] || 0).sort((a,b) => a-b)
    return sorted[Math.floor(sorted.length/2)]
  }, [filtered, sy])

  const gm = GPS_METRICS.find(m => m.key === sx)
  const pm = PERF_METRICS.find(m => m.key === sy)

  // Quadrant counts
  const q1 = filtered.filter(d => (d[sx]||0) >= medX && (d[sy]||0) >= medY).length
  const q2 = filtered.filter(d => (d[sx]||0) <  medX && (d[sy]||0) >= medY).length
  const q3 = filtered.filter(d => (d[sx]||0) >= medX && (d[sy]||0) <  medY).length
  const q4 = filtered.filter(d => (d[sx]||0) <  medX && (d[sy]||0) <  medY).length

  return (
    <div className="space-y-5 fade-in">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Eixo X — GPS</p>
          <select value={sx} onChange={e => setSx(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-sky-400">
            {GPS_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Eixo Y — Desempenho</p>
          <select value={sy} onChange={e => setSy(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-sky-400">
            {PERF_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Posição</p>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setPosFilter('')}
              className={`px-2 py-1 rounded-lg text-[8px] font-black ${!posFilter?'text-white bg-gray-700':'bg-gray-100 text-gray-500'}`}>
              Todas
            </button>
            {Object.keys(POS_LABEL).map(p => (
              <button key={p} onClick={() => setPosFilter(p)}
                className={`px-2 py-1 rounded-lg text-[8px] font-black ${posFilter===p?'text-white':'bg-gray-100 text-gray-500'}`}
                style={posFilter===p?{background:POS_COLOR[p]||G.verde}:{}}>
                {POS_LABEL[p]}
              </button>
            ))}
          </div>
          {!posFilter && (
            <p className="text-[7px] text-amber-600 mt-1">⚠️ Misturando posições — interpretar com cautela</p>
          )}
        </div>
        <div>
          <p className="text-[8px] font-black uppercase text-gray-400 mb-1.5">Resultado</p>
          <div className="flex gap-1">
            {['Todos','V','E','D'].map(r => (
              <button key={r} onClick={() => setResultFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-black ${resultFilter===r?'text-white':'bg-gray-100 text-gray-500'}`}
                style={resultFilter===r?{background:r==='V'?'#0a66b7':r==='D'?G.red:r==='E'?G.amber:G.verde}:{}}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length < 3 ? (
        <EmptyState icon="🎯" title="Dados insuficientes" sub="Importe mais partidas com GPS + Wyscout." />
      ) : (
        <>
          {/* Quadrant summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label:'Alta Carga + Alto Impacto', n:q1, color:'#07579e', bg:'#f0fdf4', border:'#bbf7d0', q:'Q1' },
              { label:'Baixa Carga + Alto Impacto', n:q2, color:'#0369a1', bg:'#f0f9ff', border:'#bae6fd', q:'Q2' },
              { label:'Alta Carga + Baixo Impacto', n:q3, color:'#dc2626', bg:'#fef2f2', border:'#fecaca', q:'Q3' },
              { label:'Baixa Carga + Baixo Impacto', n:q4, color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', q:'Q4' },
            ].map(q => (
              <div key={q.q} className="rounded-2xl border p-3 text-center" style={{background:q.bg,borderColor:q.border}}>
                <p className="text-[8px] font-black uppercase text-gray-500 mb-1">{q.q}</p>
                <p className="bc text-2xl font-black" style={{color:q.color}}>{q.n}</p>
                <p className="text-[7px] text-gray-400 mt-0.5 leading-tight">{q.label}</p>
              </div>
            ))}
          </div>

          {/* Main scatter with quadrant lines */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="bc text-base font-black uppercase text-gray-900">Scatter — Quadrante</h3>
                <p className="text-[9px] text-gray-400">{gm?.label} vs {pm?.label} · linhas = mediana · n={filtered.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-gray-400">r</p>
                <p className="text-xl font-black" style={{color:rColor(r)}}>{r!==null?`${r>0?'+':''}${r.toFixed(2)}`:'—'}</p>
                <p className="text-[8px]" style={{color:rColor(r)}}>{rLabel(r)}</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{top:10,right:20,bottom:28,left:10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="_x" type="number"
                    label={{value:gm?.label||sx, position:'insideBottom', offset:-14, fontSize:9, fill:'#94a3b8'}}
                    tick={{fontSize:9,fill:'#94a3b8'}} />
                  <YAxis dataKey="_y" type="number"
                    label={{value:pm?.label||sy, angle:-90, position:'insideLeft', offset:10, fontSize:9, fill:'#94a3b8'}}
                    tick={{fontSize:9,fill:'#94a3b8'}} />
                  <ZAxis range={[48,48]} />
                  <ReferenceLine x={medX} stroke="#9ca3af" strokeDasharray="4 2" strokeWidth={1.5} />
                  <ReferenceLine y={medY} stroke="#9ca3af" strokeDasharray="4 2" strokeWidth={1.5} />
                  <Tooltip content={({active,payload}) => {
                    if (!active||!payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                        <p className="font-black text-gray-900">{d?.nome}</p>
                        <p className="text-gray-400 text-[9px]">{POS_LABEL[d?.pos]||d?.pos} · vs {d?.adversario}</p>
                        <p className="mt-1"><span className="text-gray-400">{gm?.label}:</span> <b>{d?._x}</b></p>
                        <p><span className="text-gray-400">{pm?.label}:</span> <b>{d?._y}</b></p>
                      </div>
                    )
                  }} />
                  {Object.keys(POS_COLOR).map(pos => {
                    const pts = filtered.filter(d => d.pos === pos).map(d => ({ ...d, _x: d[sx], _y: d[sy] }))
                    if (!pts.length) return null
                    return <Scatter key={pos} data={pts} name={POS_LABEL[pos]} fill={POS_COLOR[pos]} fillOpacity={0.85} />
                  })}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {Object.entries(POS_LABEL).map(([k,v]) => (
                <span key={k} className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full" style={{background:POS_COLOR[k]}} />{v}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: POR POSIÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

// ─── INTELIGÊNCIA POR POSIÇÃO ────────────────────────────────────────────────
const POS_INTEL = {
  ZAG: {
    funcao:       'Cobertura + Duelo + Progressão',
    metricaFisica:['dist_p90', 'hsr_p90'],
    metricaFisicaLabel: 'Distância + HSR',
    metricaDesempenho:  'Duelos Def. + Passes Progr.',
    perfisParticipacao: ['duelos_p90','duelos_def_p90','passProgr_p90'],
    perfisEficiencia:   ['duelos_def_pct','duelosW_pct','passesC_pct'],
    perfil: 'Zagueiros com maior exigência física tendem a entrar em mais ações de disputa e cobertura. A leitura principal deve separar participação de eficiência: mais duelos não significa necessariamente melhor desempenho defensivo. Passes progressivos indicam o início da construção a partir do setor.',
    assinatura: 'Alta relação entre distância/HSR e duelos. A posição exige combinação de cobertura defensiva com capacidade de iniciar progressão. Quando a exigência física sobe, a participação em disputas sobe junto.',
    alerta: 'Volume alto de duelos pode indicar exposição defensiva. Cruzar com duelos ganhos %, gols sofridos e xG contra.',
    treino: ['Duelos após deslocamento intenso','Cobertura em alta intensidade','Tomada de decisão após aceleração/desaceleração','Precisão de passe sob fadiga'],
    mercado: ['Capacidade de HSR defensivo','Volume e eficiência em duelos','Precisão de passe sob demanda','Participação na primeira progressão'],
  },
  LAT: {
    funcao:       'Ida e Volta + Duelo nas Duas Fases',
    metricaFisica:['hsr_p90', 'decel_p90'],
    metricaFisicaLabel: 'HSR + Desacelerações',
    metricaDesempenho:  'Duelos Def. + Ações Ofensivas',
    perfisParticipacao: ['duelos_p90','duelos_def_p90','duelos_of_p90','cruzamentos_p90'],
    perfisEficiencia:   ['duelos_def_pct','duelos_of_pct','cruzamentos_pct','duelosW_pct'],
    perfil: 'Laterais combinam alta cobertura de espaço com participação nas duas fases. O HSR elevado reflete os ciclos de ida ao ataque e retorno defensivo. Desacelerações frequentes indicam ajustes posicionais constantes em transição.',
    assinatura: 'Alto volume físico distribuído nas duas fases. O HSR do lateral precisa ser interpretado em dois contextos: profundidade ofensiva (cruzamentos, sobreposição) e recomposição defensiva (retorno, marcação).',
    alerta: 'Alto HSR precisa ser separado entre profundidade ofensiva e recomposição defensiva. Volume sem eficiência nos dois contextos pode indicar desgaste sem impacto real.',
    treino: ['Ida e volta em corredor com sprint e recuperação','HSR ofensivo seguido de cruzamento','Duelo defensivo após retorno intenso','Decisão técnica após sprint máximo'],
    mercado: ['Distância e sprints em ambas as fases','Duelos nas duas fases com eficiência','Participação ofensiva e defensiva','Equilíbrio físico-técnico sob pressão de tempo'],
  },
  VOL: {
    funcao:       'Cobertura + Disputa Central + Transição',
    metricaFisica:['dist_p90', 'accel_p90'],
    metricaFisicaLabel: 'Distância + Acelerações',
    metricaDesempenho:  'Intercepções + Duelos',
    perfisParticipacao: ['duelos_p90','interc_p90','duelos_def_p90','alivios_p90'],
    perfisEficiencia:   ['duelos_def_pct','duelosW_pct','acoesW_pct','passesC_pct'],
    perfil: 'Função com forte relação entre mobilidade curta, cobertura e disputa. Para essa posição, aceleração e desaceleração costumam ser mais determinantes do que sprint puro. Alta distância associada a intercepções indica papel de varredura e antecipação.',
    assinatura: 'Relação forte entre distância, acelerações e intercepções. A posição exige mobilidade constante em espaço reduzido. Volume de duelos ligado ao deslocamento indica capacidade de cobertura e pressão.',
    alerta: 'Alto volume de acelerações sem aumento de intercepções pode indicar perseguição sem recuperação efetiva. Diferenciar aceleração reativa de proativa.',
    treino: ['Aceleração curta para pressão e cobertura','Desaceleração para ajuste corporal antes do duelo','Intercepção após deslocamento lateral','Passe progressivo após recuperação sob pressão'],
    mercado: ['Boa aceleração e desaceleração','Volume de duelos com eficiência','Intercepções p90 acima da média','Manutenção técnica sob intensidade'],
  },
  MC: {
    funcao:       'Criação + Pressão + Circulação',
    metricaFisica:['dist_p90', 'accel_p90'],
    metricaFisicaLabel: 'Distância + Interações Técnicas',
    metricaDesempenho:  'Ações c/ Sucesso + Passes Progr.',
    perfisParticipacao: ['duelos_p90','passProgr_p90','dribles_p90','faltas_sof_p90'],
    perfisEficiencia:   ['passesC_pct','acoesW_pct','dribles_suc_pct','duelosW_pct'],
    perfil: 'Meia apresenta padrões mais instáveis, dependentes do papel tático atribuído. Quando a exigência física aumenta, há risco de redução na precisão técnica. A posição precisa equilibrar cobertura de espaço e tomada de decisão de qualidade.',
    assinatura: 'Correlações mais variáveis. A eficiência da posição depende mais do papel tático (criativo vs de pressão) do que do volume físico bruto. Identificar o meia pelo tipo de contribuição técnica e física.',
    alerta: 'Se maior exigência física reduz precisão ou ações com sucesso, pode haver perda de tomada de decisão sob intensidade. Monitorar ações com sucesso % em jogos de alta carga.',
    treino: ['Passe preciso após sprint ou aceleração','Drible em espaço reduzido sob fadiga','Pressão organizada com recuperação posicional','Tomada de decisão rápida após deslocamento intenso'],
    mercado: ['Precisão de passe mantida sob pressão','Passes progressivos p90','Dribles com sucesso % em contexto de alta exigência','Ações com sucesso % elevado'],
  },
  ATA: {
    funcao:       'Ruptura + Finalização + Disputa Ofensiva',
    metricaFisica:['hsr_p90', 'sprint_p90'],
    metricaFisicaLabel: 'HSR + Sprint',
    metricaDesempenho:  'Duelos Ofensivos + Faltas Sofridas',
    perfisParticipacao: ['duelos_of_p90','remates_p90','dribles_p90','faltas_sof_p90'],
    perfisEficiencia:   ['duelos_of_pct','dribles_suc_pct','acoesW_pct','duelosW_pct'],
    perfil: 'Forte relação entre distância, HSR e volume de duelos, indicando maior participação em confronto direto quando a exigência física sobe. O ponto crítico é verificar se esse volume se converte em ações ofensivas úteis: finalizações, dribles e faltas sofridas.',
    assinatura: 'Sprint e HSR ligados a duelos ofensivos e ruptura. Alta intensidade precisa virar ação concreta. Faltas sofridas podem indicar busca de profundidade e confronto direto com defesa.',
    alerta: 'Alta distância ou sprint sem aumento de ações ofensivas pode indicar desgaste improdutivo. Monitorar se sprint gera ação concreta ou apenas perseguição de bola.',
    treino: ['Sprint em profundidade com finalização','Duelo ofensivo após aceleração explosiva','Ação técnica (drible/passe) após HSR','Manutenção da qualidade ofensiva sob fadiga'],
    mercado: ['Sprint útil com ação ofensiva','HSR com finalização ou drible','Duelos ofensivos ganhos %','Ações com sucesso % sob alta exigência'],
  },
  GOL: {
    funcao:       'Decisão + Saída de Bola + Reflexo',
    metricaFisica:['decel_p90', 'accel_p90'],
    metricaFisicaLabel: 'Desacelerações + Ações Específicas',
    metricaDesempenho:  'Ações Defensivas + Precisão de Passe',
    perfisParticipacao: ['alivios_p90','passProgr_p90'],
    perfisEficiencia:   ['passesC_pct','acoesW_pct'],
    perfil: 'Goleiros têm perfil físico distinto das demais posições. Desacelerações e acelerações curtas refletem saídas do gol e posicionamento. A participação na construção do jogo é avaliada por precisão de passe e passes progressivos.',
    assinatura: 'Volume físico concentrado em movimentos curtos e explosivos. A análise do goleiro precisa incorporar métricas de decisão além das GPS.',
    alerta: 'Amostra geralmente pequena. Correlações devem ser interpretadas com cautela. Priorizar métricas qualitativas e análise de vídeo.',
    treino: ['Saída de gol sob pressão de tempo','Passe preciso após deslocamento','Posicionamento em espaço reduzido','Reflexo após movimentação lateral'],
    mercado: ['Saída de bola com precisão','Passes progressivos a partir do setor','Tomada de decisão sob pressão','Leitura do jogo e posicionamento'],
  },
}

// ─── SCORE FÍSICO/IMPACTO/EFICIÊNCIA por posição ────────────────────────────
function calcPosScores(group, pos) {
  if (!group.length) return { fisico: 0, impacto: 0, eficiencia: 0, status: '' }
  const avg = k => group.reduce((s,d) => s + (d[k]||0), 0) / group.length

  // Físico: normalização por referência empírica das posições de campo
  const REF = {
    dist_p90:    { ZAG:8000,  LAT:10000, VOL:9000,  MC:8500,  ATA:7000,  GOL:3000  },
    hsr_p90:     { ZAG:600,   LAT:900,   VOL:700,   MC:650,   ATA:900,   GOL:150   },
    sprint_p90:  { ZAG:150,   LAT:300,   VOL:200,   MC:200,   ATA:350,   GOL:80    },
    accel_p90:   { ZAG:35,    LAT:45,    VOL:40,    MC:35,    ATA:45,    GOL:15    },
    decel_p90:   { ZAG:35,    LAT:45,    VOL:40,    MC:35,    ATA:45,    GOL:15    },
  }
  const fisicoRaw = GPS_METRICS.map(m => {
    const ref = REF[m.key]?.[pos] || 1
    return Math.min(1, (avg(m.key) || 0) / ref)
  })
  const fisico = Math.round(fisicoRaw.reduce((a,b)=>a+b,0)/fisicoRaw.length * 100)

  // Impacto: métricas de participação da posição
  const intel = POS_INTEL[pos]
  const impKeys = intel?.perfisParticipacao || ['duelos_p90','interc_p90']
  const REF_IMP = { duelos_p90:6, duelos_def_p90:4, duelos_of_p90:3, interc_p90:2, passProgr_p90:3, cruzamentos_p90:2, remates_p90:1.5, faltas_sof_p90:2, alivios_p90:2, dribles_p90:2 }
  const impRaw = impKeys.map(k => Math.min(1, (avg(k)||0) / (REF_IMP[k]||1)))
  const impacto = Math.round(impRaw.reduce((a,b)=>a+b,0)/impRaw.length * 100)

  // Eficiência: métricas de %
  const eficKeys = intel?.perfisEficiencia || ['duelosW_pct','acoesW_pct','passesC_pct']
  const eficRaw = eficKeys.map(k => {
    const v = avg(k)||0
    return v > 1 ? Math.min(1, v/100) : Math.min(1, v)
  })
  const eficiencia = eficRaw.length ? Math.round(eficRaw.reduce((a,b)=>a+b,0)/eficRaw.length * 100) : 0

  let status = ''
  if (fisico >= 75 && impacto >= 70 && eficiencia >= 65) status = 'alta participação + boa eficiência'
  else if (fisico >= 75 && impacto >= 70) status = 'alta participação, eficiência moderada'
  else if (fisico >= 75 && eficiencia >= 65) status = 'alta carga, eficiência preservada'
  else if (fisico >= 75) status = 'alta exigência física, impacto a confirmar'
  else if (impacto >= 65) status = 'bom impacto, carga física controlada'
  else status = 'padrão equilibrado'

  return { fisico: Math.min(fisico,100), impacto: Math.min(impacto,100), eficiencia: Math.min(eficiencia,100), status }
}

// ─── RADAR DATA por posição ──────────────────────────────────────────────────
const RADAR_KEYS = [
  { key:'dist_p90',      label:'Distância', ref: { ZAG:8000, LAT:10000, VOL:9000, MC:8500, ATA:7500, GOL:3000 } },
  { key:'hsr_p90',       label:'HSR',       ref: { ZAG:600,  LAT:900,   VOL:700,  MC:650,  ATA:900,  GOL:150  } },
  { key:'sprint_p90',    label:'Sprint',    ref: { ZAG:150,  LAT:300,   VOL:200,  MC:200,  ATA:350,  GOL:80   } },
  { key:'accel_p90',     label:'Aceler.',   ref: { ZAG:35,   LAT:45,    VOL:40,   MC:35,   ATA:45,   GOL:15   } },
  { key:'decel_p90',     label:'Desacel.',  ref: { ZAG:35,   LAT:45,    VOL:40,   MC:35,   ATA:45,   GOL:15   } },
]

function buildRadarData(posSummaries) {
  return RADAR_KEYS.map(rk => {
    const pt = { metric: rk.label }
    posSummaries.forEach(ps => {
      if (ps.pos === 'GOL') return
      const ref = rk.ref[ps.pos] || 1
      pt[ps.pos] = Math.min(100, Math.round((ps.avgGps[rk.key]||0) / ref * 100))
    })
    return pt
  })
}

function TabPorPosicao({ fullPartidas }) {
  const historico = useMemo(() => buildHistoricalDataset(fullPartidas), [fullPartidas])

  const [posFilter,    setPosFilter]    = useState('Todos')
  const [viewMode,     setViewMode]     = useState('perfil')  // 'perfil' | 'treino' | 'mercado'
  const [showRadar,    setShowRadar]    = useState(false)
  const [onlySig,      setOnlySig]      = useState(false)

  const posSummaries = useMemo(() => {
    return Object.keys(POS_LABEL).map(pos => {
      const group = historico.filter(d => d.pos === pos)
      if (!group.length) return null

      const avgGps = {}
      GPS_METRICS.forEach(m => { avgGps[m.key] = group.reduce((s,d)=>s+(d[m.key]||0),0)/group.length })

      // All correlations with stats
      const allCorrs = []
      GPS_METRICS.forEach(gm => {
        PERF_METRICS.forEach(pm => {
          const st = pearsonStats(group, gm.key, pm.key)
          if (st.r !== null && Math.abs(st.r) >= 0.25) {
            allCorrs.push({ gpsKey:gm.key, perfKey:pm.key, gpsLabel:gm.label, perfLabel:pm.label, gpsColor:gm.color, ...st })
          }
        })
      })
      allCorrs.sort((a,b) => Math.abs(b.r)-Math.abs(a.r))

      const intel = POS_INTEL[pos] || {}
      const partCorrs  = allCorrs.filter(c => (intel.perfisParticipacao||[]).includes(c.perfKey) && c.r > 0)
      const eficCorrs  = allCorrs.filter(c => (intel.perfisEficiencia||[]).includes(c.perfKey))
      const alertCorrs = allCorrs.filter(c => c.r < -0.25 || (['faltas_p90'].includes(c.perfKey) && c.r > 0.4))
      const scores     = calcPosScores(group, pos)
      const lowSample  = group.length < 5

      return {
        pos, label:POS_LABEL[pos], color:POS_COLOR[pos], n:group.length,
        avgGps, allCorrs, partCorrs, eficCorrs, alertCorrs,
        scores, lowSample, intel
      }
    }).filter(Boolean)
  }, [historico])

  const radarData = useMemo(() => buildRadarData(posSummaries), [posSummaries])

  const displayed = posFilter === 'Todos'
    ? posSummaries
    : posSummaries.filter(ps => ps.pos === posFilter)

  if (!historico.length) return <EmptyState icon="📐" title="Nenhum dado histórico" sub="Importe partidas com GPS + Wyscout." />

  // ── Comparativo geral ────────────────────────────────────────────────────
  const CompareTable = () => (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Comparativo entre Posições — Médias p90</p>
        <span className="text-[7px] text-gray-400">valores = média por jogador/jogo (p90)</span>
      </div>
      <div className="overflow-x-auto scrollbar-g">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Posição','n','Distância','HSR >20','Sprint >25','N. Sprints','Acelerações','Desacel.','Métrica Dom.','Status'].map(h => (
                <th key={h} className="px-3 py-2 text-[7px] font-black uppercase tracking-widest text-gray-400 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posSummaries.map(ps => (
              <tr key={ps.pos} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-2">
                  <span className="bc text-sm font-black uppercase" style={{color:ps.color}}>{ps.label}</span>
                </td>
                <td className="px-3 py-2 text-gray-400 text-[9px]">
                  {ps.n}{ps.lowSample ? <span className="ml-1 text-amber-500">⚠</span> : ''}
                </td>
                {GPS_METRICS.map(m => (
                  <td key={m.key} className="px-3 py-2 font-black tabular-nums text-[10px]" style={{color:m.color}}>
                    {ps.avgGps[m.key]>=1000?(ps.avgGps[m.key]/1000).toFixed(1)+'k':ps.avgGps[m.key]?.toFixed(0)||'—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-[8px] text-gray-600">{ps.intel?.metricaFisicaLabel||'—'}</td>
                <td className="px-3 py-2">
                  <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full text-white" style={{background:ps.color}}>
                    {ps.scores.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── Score bar ─────────────────────────────────────────────────────────────
  const ScoreBar = ({ label, val, color }) => (
    <div className="flex items-center gap-2">
      <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 w-16 flex-shrink-0">{label}</p>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{width:`${val}%`, background:color}} />
      </div>
      <p className="text-[8px] font-black tabular-nums w-7 text-right" style={{color}}>{val}</p>
    </div>
  )

  // ── Corr pill ──────────────────────────────────────────────────────────────
  const CorrPill = ({ c }) => (
    <div className="flex items-start gap-2 rounded-lg px-2.5 py-2" style={{background:rBg(c.r)}}>
      <span className="text-[10px] font-black min-w-[38px] flex-shrink-0" style={{color:rColor(c.r)}}>
        {c.r>0?'+':''}{c.r.toFixed(2)}{c.sig?' ★':''}
      </span>
      <div className="min-w-0">
        <p className="text-[8px] text-gray-700 leading-tight">{c.gpsLabel} × {c.perfLabel}</p>
        <p className="text-[7px] text-gray-400 mt-0.5">r²={c.r2?.toFixed(2)} · n={c.n}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 fade-in">

      {/* ═══ 1. INFO + FILTROS ════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Assinatura Física-Tática por Posição</p>
          <p className="text-[9px] text-blue-700">Correlações calculadas <strong>dentro de cada posição</strong> · mínimo 3 obs. · ⚠ = amostra baixa (&lt;5)</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {/* Filtro posição */}
          <div className="flex gap-1 flex-wrap">
            {['Todos',...Object.keys(POS_LABEL)].map(p => (
              <button key={p} onClick={() => setPosFilter(p)}
                className="px-2.5 py-1 rounded-xl text-[7px] font-black transition-all"
                style={posFilter===p
                  ? {background: p==='Todos'?G.verde:(POS_COLOR[p]||G.verde), color:'#fff'}
                  : {background:'#f1f5f9', color:'#64748b'}}>
                {POS_LABEL[p]||p}
              </button>
            ))}
          </div>
          {/* View mode */}
          <div className="flex gap-1">
            {[{id:'perfil',label:'Perfil'},{id:'treino',label:'Treino'},{id:'mercado',label:'Mercado'}].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                className="px-2.5 py-1 rounded-xl text-[7px] font-black"
                style={viewMode===v.id ? {background:G.verde, color:'#fff'} : {background:'#f1f5f9', color:'#64748b'}}>
                {v.label}
              </button>
            ))}
          </div>
          {/* Só sig */}
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={onlySig} onChange={e=>setOnlySig(e.target.checked)} className="w-3 h-3 accent-sky-700" />
            <span className="text-[7px] font-black text-gray-500">Só correlações sig.</span>
          </label>
          {/* Radar toggle */}
          <button onClick={() => setShowRadar(v => !v)}
            className="px-2.5 py-1 rounded-xl text-[7px] font-black"
            style={showRadar ? {background:G.purple, color:'#fff'} : {background:'#f5f3ff', color:G.purple}}>
            🕸️ Radar
          </button>
        </div>
      </div>

      {/* ═══ 2. COMPARATIVO ══════════════════════════════════════════════════ */}
      {posFilter === 'Todos' && <CompareTable />}

      {/* ═══ 3. RADAR POR POSIÇÃO ════════════════════════════════════════════ */}
      {showRadar && posFilter === 'Todos' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Radar Físico por Posição</p>
            <span className="text-[7px] text-gray-400 ml-2">valores em percentil relativo à referência da posição · excl. goleiro</span>
          </div>
          <div className="p-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fontWeight: 700, fill:'#6b7280' }} />
                {posSummaries.filter(ps=>ps.pos!=='GOL').map(ps => (
                  <Radar key={ps.pos} name={ps.label} dataKey={ps.pos}
                    stroke={ps.color} fill={ps.color} fillOpacity={0.12} strokeWidth={2} />
                ))}
                <Legend iconType="circle" iconSize={8}
                  formatter={(v, e) => <span style={{fontSize:8, fontWeight:700, color:e.color}}>{v}</span>} />
                <Tooltip formatter={(v, n) => [`${v}/100`, n]} labelStyle={{fontSize:9,fontWeight:700}} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══ 4. CARDS POR POSIÇÃO ════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {displayed.map(ps => {
          const intel = ps.intel || {}
          const filtCorrs = c => onlySig ? c.sig : true
          const partTop  = ps.partCorrs.filter(filtCorrs).slice(0, 2)
          const eficTop  = ps.eficCorrs.filter(filtCorrs).slice(0, 2)
          const alertTop = ps.alertCorrs.filter(filtCorrs).slice(0, 1)

          return (
            <div key={ps.pos} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

              {/* Header */}
              <div className="px-4 py-3.5 flex items-start justify-between" style={{background:`linear-gradient(135deg, ${ps.color} 0%, ${ps.color}cc 100%)`}}>
                <div>
                  <p className="text-white/70 text-[7px] font-black uppercase tracking-widest mb-0.5">{intel.funcao||''}</p>
                  <p className="bc text-xl font-black uppercase text-white tracking-wide">{ps.label}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[7px] font-black px-2 py-0.5 rounded-full text-white ${ps.lowSample?'bg-amber-500':'bg-white/20'}`}>
                    n = {ps.n}{ps.lowSample?' ⚠ amostra baixa':''}
                  </span>
                </div>
              </div>

              {/* GPS médias */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-2">Médias GPS (p90)</p>
                <div className="flex flex-wrap gap-3">
                  {GPS_METRICS.map(m => {
                    const isDominant = (intel.metricaFisica||[]).includes(m.key)
                    return (
                      <div key={m.key} className={`rounded-lg px-2 py-1 ${isDominant?'ring-1':''}` }
                        style={isDominant ? {ringColor:ps.color, background:ps.color+'15', border:`1px solid ${ps.color}40`} : {}}>
                        <p className="text-[6px] text-gray-400">{m.label.split(' ')[0]}</p>
                        <p className="text-[11px] font-black leading-tight" style={{color: isDominant ? ps.color : m.color}}>
                          {ps.avgGps[m.key]>=1000?(ps.avgGps[m.key]/1000).toFixed(1)+'k':ps.avgGps[m.key]?.toFixed(0)||'—'}
                        </p>
                        {isDominant && <p className="text-[5px] font-black uppercase text-gray-400">dominante</p>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Scores */}
              <div className="px-4 py-3 border-b border-gray-100 space-y-1.5">
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-2">Scores da Posição</p>
                <ScoreBar label="Físico"    val={ps.scores.fisico}     color={ps.color} />
                <ScoreBar label="Impacto"   val={ps.scores.impacto}    color={G.sky} />
                <ScoreBar label="Eficiência" val={ps.scores.eficiencia} color={G.amber} />
                <p className="text-[7px] text-gray-500 italic mt-1">Status: {ps.scores.status}</p>
              </div>

              {/* VIEW: PERFIL ──────────────────────────────────────── */}
              {viewMode === 'perfil' && (
                <div className="px-4 py-3 space-y-3">
                  {/* Perfil */}
                  <div>
                    <p className="text-[7px] font-black uppercase tracking-widest mb-1" style={{color:ps.color}}>Perfil da Função</p>
                    <p className="text-[8px] text-gray-600 leading-relaxed">{intel.perfil}</p>
                  </div>
                  {/* Assinatura */}
                  <div className="rounded-xl p-3" style={{background:ps.color+'10', border:`1px solid ${ps.color}25`}}>
                    <p className="text-[7px] font-black uppercase tracking-widest mb-1" style={{color:ps.color}}>Assinatura Física-Tática</p>
                    <p className="text-[8px] text-gray-700 leading-relaxed">{intel.assinatura}</p>
                  </div>
                  {/* Métricas dominantes */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2" style={{background:ps.color+'10'}}>
                      <p className="text-[6px] font-black uppercase text-gray-400 mb-0.5">Métrica Física Dom.</p>
                      <p className="text-[8px] font-black" style={{color:ps.color}}>{intel.metricaFisicaLabel||'—'}</p>
                    </div>
                    <div className="rounded-lg p-2 bg-sky-50">
                      <p className="text-[6px] font-black uppercase text-gray-400 mb-0.5">Desempenho Conectado</p>
                      <p className="text-[8px] font-black text-sky-700">{intel.metricaDesempenho||'—'}</p>
                    </div>
                  </div>
                  {/* Participação */}
                  {partTop.length > 0 && (
                    <div>
                      <p className="text-[7px] font-black uppercase tracking-widest text-sky-700 mb-1.5">📊 Participação</p>
                      <div className="space-y-1.5">{partTop.map((c,i) => <CorrPill key={i} c={c} />)}</div>
                    </div>
                  )}
                  {/* Eficiência */}
                  {eficTop.length > 0 && (
                    <div>
                      <p className="text-[7px] font-black uppercase tracking-widest text-sky-700 mb-1.5">🎯 Eficiência</p>
                      <div className="space-y-1.5">{eficTop.map((c,i) => <CorrPill key={i} c={c} />)}</div>
                    </div>
                  )}
                  {/* Alerta */}
                  {(alertTop.length > 0 || intel.alerta) && (
                    <div className="rounded-xl p-3 bg-amber-50 border border-amber-100">
                      <p className="text-[7px] font-black uppercase tracking-widest text-amber-700 mb-1">⚠️ Alerta da Posição</p>
                      <p className="text-[8px] text-amber-800 leading-relaxed">{intel.alerta}</p>
                      {alertTop.map((c,i) => (
                        <div key={i} className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1 bg-amber-100">
                          <span className="text-[9px] font-black" style={{color:rColor(c.r)}}>{c.r>0?'+':''}{c.r.toFixed(2)}</span>
                          <span className="text-[7px] text-amber-900">{c.gpsLabel} × {c.perfLabel}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ps.lowSample && (
                    <div className="rounded-xl px-3 py-2 bg-amber-50 border border-amber-200">
                      <p className="text-[8px] text-amber-700">⚠️ <strong>Amostra baixa (n={ps.n})</strong> — interpretar como tendência inicial. Correlações podem ser instáveis.</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: TREINO ─────────────────────────────────────── */}
              {viewMode === 'treino' && (
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <p className="text-[7px] font-black uppercase tracking-widest mb-2" style={{color:ps.color}}>💪 O que Observar no Treino</p>
                    <div className="space-y-1.5">
                      {(intel.treino||[]).map((item, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-lg px-3 py-2"
                          style={{background:ps.color+'0D', border:`1px solid ${ps.color}20`}}>
                          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white flex-shrink-0 mt-0.5"
                            style={{background:ps.color}}>{i+1}</span>
                          <p className="text-[9px] text-gray-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Correlações mais relevantes no contexto de treino */}
                  {ps.allCorrs.filter(filtCorrs).slice(0,3).length > 0 && (
                    <div>
                      <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Padrões Internos Relevantes</p>
                      <div className="space-y-1.5">
                        {ps.allCorrs.filter(filtCorrs).slice(0,3).map((c,i) => <CorrPill key={i} c={c} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: MERCADO ────────────────────────────────────── */}
              {viewMode === 'mercado' && (
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <p className="text-[7px] font-black uppercase tracking-widest mb-2" style={{color:ps.color}}>🔍 O que Procurar no Mercado</p>
                    <div className="space-y-1.5">
                      {(intel.mercado||[]).map((item, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-lg px-3 py-2 bg-gray-50 border border-gray-100">
                          <span className="text-base flex-shrink-0">
                            {['🏃','⚡','🎯','🔄','💡','✅'][i] || '•'}
                          </span>
                          <p className="text-[9px] text-gray-700 leading-relaxed">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Assinatura como critério */}
                  <div className="rounded-xl p-3" style={{background:ps.color+'10', border:`1px solid ${ps.color}25`}}>
                    <p className="text-[7px] font-black uppercase tracking-widest mb-1" style={{color:ps.color}}>Assinatura esperada</p>
                    <p className="text-[8px] text-gray-700 leading-relaxed">{intel.assinatura}</p>
                  </div>
                </div>
              )}

            </div>
          )
        })}
      </div>

    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PERFIL DO ATLETA
// ═══════════════════════════════════════════════════════════════════════════════
function TabAtleta({ fullPartidas }) {
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedGpsX,   setSelectedGpsX]   = useState('hsr_p90')
  const [selectedPerfY,  setSelectedPerfY]  = useState('acoesW_pct')
  const [busca,          setBusca]           = useState('')
  const [semFilterState, setSemFilterState]  = useState(null)

  const historico = useMemo(() => buildHistoricalDataset(fullPartidas), [fullPartidas])

  const allPlayers = useMemo(() =>
    [...new Set(historico.map(d => d.nome))].sort()
  , [historico])

  const playerData = useMemo(() => {
    if (!selectedPlayer) return []
    return historico
      .filter(d => d.nome === selectedPlayer)
      .sort((a,b) => (a.data_jogo||'').localeCompare(b.data_jogo||''))
  }, [historico, selectedPlayer])

  const posData = useMemo(() => {
    if (!playerData.length) return []
    return historico.filter(d => d.pos === playerData[0].pos && d.nome !== selectedPlayer)
  }, [historico, playerData, selectedPlayer])

  // Full stats object
  const S = useMemo(() => {
    if (!playerData.length) return null
    const n = playerData.length
    const res = { jogos: n, pos: playerData[0].pos || '' }

    GPS_METRICS.forEach(m => {
      const vals = playerData.map(d => d[m.key] || 0)
      res[`${m.key}_vals`] = vals
      res[`${m.key}_avg`]  = vals.reduce((a,b)=>a+b,0) / n
      res[`${m.key}_peak`] = Math.max(...vals)
      res[`${m.key}_min`]  = Math.min(...vals)
    })

    PERF_METRICS.forEach(m => {
      const vals = playerData.map(d => d[m.key] || 0).filter(v => v > 0)
      res[`${m.key}_avg`] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null
    })

    // Percentiles vs same position group
    const posAll = [...posData, ...playerData]
    GPS_METRICS.forEach(m => {
      const all = posAll.map(d => d[m.key]||0).sort((a,b)=>a-b)
      const myAvg = res[`${m.key}_avg`]
      const pct = all.length > 1
        ? Math.round(all.filter(v => v <= myAvg).length / all.length * 100)
        : null
      res[`${m.key}_pct`] = pct
    })

    return res
  }, [playerData, posData])

  // Individual correlations GPS × PERF
  const corrMatrix = useMemo(() => {
    if (playerData.length < 3) return []
    const out = []
    GPS_METRICS.forEach(gm => {
      PERF_METRICS.slice(0, 12).forEach(pm => {  // cap at 12 perf metrics for readability
        const st = pearsonStats(playerData, gm.key, pm.key)
        if (st.r !== null && Math.abs(st.r) >= 0.25) {
          out.push({ gpsKey:gm.key, gpsLabel:gm.label, gpsColor:gm.color, perfKey:pm.key, perfLabel:pm.label, ...st })
        }
      })
    })
    return out.sort((a,b) => Math.abs(b.r) - Math.abs(a.r))
  }, [playerData])

  // Top correlations (positive, negative, total)
  const topCorrs = useMemo(() => ({
    positive: corrMatrix.filter(c => c.r > 0).slice(0, 6),
    negative: corrMatrix.filter(c => c.r < 0).slice(0, 6),
  }), [corrMatrix])

  // Also compute negative correlations with lower threshold for small samples
  const corrNegative = useMemo(() => {
    if (playerData.length < 3) return []
    const out = []
    GPS_METRICS.forEach(gm => {
      PERF_METRICS.slice(0, 14).forEach(pm => {
        const st = pearsonStats(playerData, gm.key, pm.key)
        if (st.r !== null && st.r < 0) {
          out.push({ gpsKey:gm.key, gpsLabel:gm.label, gpsColor:gm.color, perfKey:pm.key, perfLabel:pm.label, ...st })
        }
      })
    })
    return out.sort((a,b) => a.r - b.r).slice(0, 6)  // most negative first
  }, [playerData])

  // Scatter data for selected GPS × PERF pair
  const scatterData = useMemo(() =>
    playerData.map(d => {
      const sem = S ? gameSemaphore(d) : null
      const fill = sem
        ? {verde:'#0a66b7', amarelo:'#ca8a04', vermelho:'#dc2626'}[sem]
        : (POS_COLOR[S?.pos] || G.verde)
      return {
        _x: d[selectedGpsX] || 0,
        _y: d[selectedPerfY] || 0,
        adversario: d.adversario,
        resultado: d.resultado,
        min: d.min,
        sem,
        fill,
      }
    })
  , [playerData, selectedGpsX, selectedPerfY, S])
  const scatterStats = useMemo(() => pearsonStats(playerData, selectedGpsX, selectedPerfY), [playerData, selectedGpsX, selectedPerfY])

  // ── SEMAPHORE ENGINE — score 0-100 + impact type + reason text ─────────────
  function calcGameScore(d, currentS) {
    const _S = currentS || S
    if (!_S || !d) return null
    const pos = _S.pos || ''

    // Normalize a value vs player's own average (0-1, capped at 1.5)
    const norm = (key, cap = 1.5) => {
      const avg = _S[`${key}_avg`] || 0
      return avg > 0 ? Math.min((d[key]||0) / avg, cap) / cap : 0
    }

    // ── PHYSICAL SCORE (position-weighted) ──────────────────────────────────
    const GPS_POS_WEIGHTS = {
      ATA: { hsr_p90:0.40, sprint_p90:0.35, accel_p90:0.25 },
      LAT: { hsr_p90:0.35, sprint_p90:0.30, accel_p90:0.20, decel_p90:0.15 },
      MC:  { hsr_p90:0.30, sprint_p90:0.25, accel_p90:0.25, decel_p90:0.20 },
      VOL: { hsr_p90:0.25, sprint_p90:0.20, accel_p90:0.30, decel_p90:0.25 },
      ZAG: { hsr_p90:0.20, sprint_p90:0.15, accel_p90:0.30, decel_p90:0.35 },
      GOL: { hsr_p90:0.50, sprint_p90:0.50 },
    }
    const weights = GPS_POS_WEIGHTS[pos] || GPS_POS_WEIGHTS.MC
    let physScore = 0, wTotal = 0
    Object.entries(weights).forEach(([k,w]) => { physScore += norm(k) * w; wTotal += w })
    physScore = wTotal > 0 ? physScore / wTotal : 0

    // ── PERFORMANCE SCORE (position-weighted) ────────────────────────────────
    const PERF_POS_KEYS = {
      ATA: ['acoesW_pct','dribles_suc_pct','duelos_of_pct','remates_p90','passProgr_p90','cruzamentos_pct','faltas_sof_p90'],
      LAT: ['acoesW_pct','cruzamentos_pct','dribles_suc_pct','duelos_def_pct','interc_p90','passProgr_p90'],
      MC:  ['acoesW_pct','passesC_pct','passProgr_p90','dribles_suc_pct','duelos_p90','duelosW_pct'],
      VOL: ['acoesW_pct','duelos_def_pct','interc_p90','alivios_p90','passesC_pct','duelos_p90'],
      ZAG: ['duelos_def_pct','interc_p90','alivios_p90','passesC_pct','duelosW_pct','duelos_aereos_pct'],
      GOL: ['passesC_pct','acoesW_pct'],
    }
    const perfKeys = PERF_POS_KEYS[pos] || PERF_POS_KEYS.MC
    const perfVals = perfKeys.map(k => norm(k)).filter(v => v > 0)
    const perfScore = perfVals.length ? perfVals.reduce((a,b)=>a+b,0)/perfVals.length : 0

    // ── EFFICIENCY SCORE — performance per physical unit ─────────────────────
    const hsr   = d.hsr_p90   || 0.01
    const acoes = d.acoesW_pct || 0
    const effScore = physScore > 0.1
      ? Math.min(acoes / (hsr / (_S.hsr_p90_avg||1)) / 100, 1)  // normalized efficiency
      : 0.5  // if physical was low, neutral efficiency

    // ── FINAL SCORE 0-100 ───────────────────────────────────────────────────
    const score = Math.round((physScore * 0.35 + perfScore * 0.45 + effScore * 0.20) * 100)

    // ── IMPACT TYPE ─────────────────────────────────────────────────────────
    let impactType = ''
    const isHighPhys = physScore >= 0.6
    const isHighPerf = perfScore >= 0.6
    const isHighEff  = effScore  >= 0.55

    if (isHighPhys && isHighPerf) impactType = 'Intenso e produtivo'
    else if (!isHighPhys && isHighPerf) impactType = 'Eficiência técnica'
    else if (isHighPhys && !isHighPerf && effScore < 0.4) impactType = 'Desgaste improdutivo'
    else if (isHighPhys && !isHighPerf) impactType = 'Alta carga, retorno parcial'
    else impactType = 'Baixa participação'

    // ── STATUS ───────────────────────────────────────────────────────────────
    const status = score >= 70 ? 'verde' : score >= 50 ? 'amarelo' : 'vermelho'

    // ── REASON TEXT ─────────────────────────────────────────────────────────
    const reasons = []
    if (physScore >= 0.65) reasons.push(`HSR alto (${(d.hsr_p90||0)>=1000?((d.hsr_p90||0)/1000).toFixed(1)+'k':(d.hsr_p90||0).toFixed(0)}m)`)
    else if (physScore < 0.4) reasons.push(`HSR abaixo da média (${(d.hsr_p90||0)>=1000?((d.hsr_p90||0)/1000).toFixed(1)+'k':(d.hsr_p90||0).toFixed(0)}m)`)
    if (perfScore >= 0.65) reasons.push(`bom desempenho técnico-tático`)
    if ((d.acoesW_pct||0) > (_S.acoesW_pct_avg||60)) reasons.push(`ações com sucesso ${(d.acoesW_pct||0).toFixed(0)}%`)
    if ((d.interc_p90||0) > (_S.interc_p90_avg||2)) reasons.push(`intercepções acima da média`)
    if ((d.dribles_suc_pct||0) > 60) reasons.push(`dribles ${(d.dribles_suc_pct||0).toFixed(0)}% sucesso`)
    if (effScore < 0.35 && physScore >= 0.5) reasons.push(`baixo retorno por carga aplicada`)

    // ── BADGES ───────────────────────────────────────────────────────────────
    const physBadge  = physScore >= 0.65 ? 'Alto' : physScore >= 0.4 ? 'Médio' : 'Baixo'
    const perfBadge  = perfScore >= 0.65 ? 'Alto' : perfScore >= 0.4 ? 'Médio' : 'Baixo'
    const effBadge   = effScore  >= 0.55 ? 'Boa'  : effScore  >= 0.35 ? 'Regular' : 'Baixa'

    // ── POS COMPARISON ───────────────────────────────────────────────────────
    const posHsrAvg = posData.length > 0 ? posData.reduce((s,p)=>s+(p.hsr_p90||0),0)/posData.length : null
    const posAcaoAvg = posData.length > 0 ? posData.reduce((s,p)=>s+(p.acoesW_pct||0),0)/posData.length : null
    const vsHsr  = posHsrAvg  ? Math.round(((d.hsr_p90||0)  - posHsrAvg ) / posHsrAvg  * 100) : null
    const vsAcao = posAcaoAvg ? Math.round(((d.acoesW_pct||0) - posAcaoAvg) / posAcaoAvg * 100) : null

    return { score, status, impactType, reasons, physBadge, perfBadge, effBadge, physScore, perfScore, effScore, vsHsr, vsAcao }
  }

  // Backward-compatible wrapper for existing scatter/timeline dot coloring
  function gameSemaphore(d, currentS) {
    const result = calcGameScore(d, currentS)
    return result?.status || null
  }

  // Auto-generated insight text
  const insight = useMemo(() => {
    if (!S || corrMatrix.length === 0) return null
    const name = selectedPlayer.split(' ')[0]
    const pos  = POS_LABEL[S.pos] || S.pos
    const top  = corrMatrix[0]
    const neg  = corrMatrix.find(c => c.r < -0.3)
    const avg  = S.hsr_p90_avg || 0

    let txt = `${name} acumula ${S.jogos} jogo(s) no banco com média de HSR de ${avg >= 1000 ? (avg/1000).toFixed(1)+'k' : avg.toFixed(0)}m p90.`

    if (top) txt += ` A relação mais forte é entre ${top.gpsLabel} e ${top.perfLabel} (r=${top.r > 0?'+':''}${top.r}), indicando que ${rLabel(top.r) === 'Forte +' || rLabel(top.r) === 'Moderada +' ? 'quando a demanda física aumenta, o desempenho tende a crescer nessa dimensão.' : 'variações físicas têm fraca conexão com esse indicador de desempenho.'}`

    if (neg) txt += ` Por outro lado, há relação negativa entre ${neg.gpsLabel} e ${neg.perfLabel} (r=${neg.r}), sugerindo queda de eficiência técnica sob alta exigência nessa dimensão.`

    const semCounts = { verde:0, amarelo:0, vermelho:0 }
    playerData.forEach(d => { const s = gameSemaphore(d); if (s) semCounts[s]++ })
    const pct = S.jogos > 0 ? Math.round(semCounts.verde / S.jogos * 100) : 0
    txt += ` Em ${pct}% dos jogos o atleta apresentou alta demanda com alto impacto (🟢).`

    return txt
  }, [S, corrMatrix, playerData, selectedPlayer])

  // Quadrant medians
  const qMedX = useMemo(() => {
    if (!playerData.length) return 0
    const s = [...playerData].map(d=>d[selectedGpsX]||0).sort((a,b)=>a-b)
    return s[Math.floor(s.length/2)]
  }, [playerData, selectedGpsX])
  const qMedY = useMemo(() => {
    if (!playerData.length) return 0
    const s = [...playerData].map(d=>d[selectedPerfY]||0).sort((a,b)=>a-b)
    return s[Math.floor(s.length/2)]
  }, [playerData, selectedPerfY])

  const filteredPlayers = busca.trim()
    ? allPlayers.filter(p => p.toLowerCase().includes(busca.toLowerCase()))
    : allPlayers

  const gxMeta  = GPS_METRICS.find(m=>m.key===selectedGpsX)  || GPS_METRICS[0]
  const pyMeta  = PERF_METRICS.find(m=>m.key===selectedPerfY) || PERF_METRICS[0]

  // ─── helper: format metric value ──────────────────────────────────────────
  const fmtV = (v, unit) => {
    if (v === null || v === undefined) return '—'
    if (unit === 'm' && v >= 1000) return `${(v/1000).toFixed(1)}k`
    return typeof v === 'number' ? (v % 1 === 0 ? String(v) : v.toFixed(1)) : '—'
  }

  return (
    <div className="space-y-0 fade-in flex" style={{minHeight:'80vh', gap:0}}>

      {/* ─── LEFT: player list ────────────────────────────────────────────── */}
      <div className="bg-white border-r border-gray-200 rounded-l-2xl flex-shrink-0" style={{width:220}}>
        <div className="px-3 py-3 border-b border-gray-100 bg-gray-50 rounded-tl-2xl">
          <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-1.5">MÓDULOS</p>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar atleta..."
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[10px] bg-white focus:outline-none focus:border-sky-400" />
        </div>
        <div className="overflow-y-auto scrollbar-g" style={{maxHeight:'calc(80vh - 60px)'}}>
          {filteredPlayers.length === 0
            ? <p className="text-[9px] text-gray-400 text-center p-8">Nenhum atleta</p>
            : filteredPlayers.map(name => {
                const pData = historico.filter(d => d.nome === name)
                const active = selectedPlayer === name
                return (
                  <button key={name} onClick={() => setSelectedPlayer(name)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-gray-50 transition-all border-l-4 ${active?'bg-sky-50':'hover:bg-gray-50 border-l-transparent'}`}
                    style={active?{borderLeftColor:G.verde}:{}}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[9px] font-black truncate ${active?'text-sky-700':'text-gray-800'}`}>{name}</p>
                      <p className="text-[7px] text-gray-400">{pData.length} jogo(s) · {POS_LABEL[pData[0]?.pos]||'—'}</p>
                    </div>
                  </button>
                )
              })
          }
        </div>
      </div>

      {/* ─── RIGHT: diagnostic panel ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-r-2xl scrollbar-g" style={{maxHeight:'calc(80vh)'}}>
        {!selectedPlayer ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState icon="👤" title="Selecione um atleta" sub="Clique no nome à esquerda." />
          </div>
        ) : !S ? (
          <EmptyState icon="📊" title="Dados insuficientes" sub="Este atleta não tem dados GPS+Wyscout suficientes." />
        ) : (
          <div className="space-y-5 p-5">

            {/* ═══ 1. HEADER ════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5" style={{background:'linear-gradient(135deg,#0b7c3d 0%,#0a66b7 100%)'}}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sky-200 text-[8px] font-black uppercase tracking-widest mb-1">Diagnóstico Individual</p>
                    <h2 className="bc text-3xl font-black uppercase text-white leading-none">{selectedPlayer}</h2>
                    <p className="text-sky-100 text-[10px] mt-1">
                      {POS_LABEL[S.pos]||'—'} · {S.jogos} jogo(s) no banco
                      {posData.length > 0 && ` · ${posData.length + playerData.length} atletas na posição`}
                    </p>
                  </div>
                  {/* Status cards */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label:'Jogos', val:S.jogos, unit:'', color:'rgba(255,255,255,0.9)' },
                      { label:'HSR Médio p90', val:fmtV(S.hsr_p90_avg,'m'), unit:'', color:'#86efac' },
                      { label:'Sprint Médio p90', val:fmtV(S.sprint_p90_avg,'m'), unit:'', color:'#bbf7d0' },
                      { label:'Aceler. Médio p90', val:S.accel_p90_avg?.toFixed(1)||'—', unit:'', color:'#fde68a' },
                    ].map(k => (
                      <div key={k.label} className="bg-white/10 rounded-xl px-3 py-2 text-center backdrop-blur-sm">
                        <p className="text-[7px] text-white/60 font-black uppercase">{k.label}</p>
                        <p className="bc text-lg font-black leading-tight" style={{color:k.color}}>{k.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* GPS cards row */}
              <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-100">
                {GPS_METRICS.map(m => {
                  const avg  = S[`${m.key}_avg`]  || 0
                  const peak = S[`${m.key}_peak`] || 0
                  const pct  = S[`${m.key}_pct`]
                  return (
                    <div key={m.key} className="px-3 py-3 text-center">
                      <p className="text-[7px] font-black uppercase text-gray-400 truncate">{m.label}</p>
                      <p className="bc text-base font-black mt-0.5" style={{color:m.color}}>
                        {m.unit==='m'&&avg>=1000?`${(avg/1000).toFixed(1)}k`:avg.toFixed(0)}
                      </p>
                      <p className="text-[7px] text-gray-400">média p90</p>
                      {pct !== null && (
                        <div className="mt-1 text-[7px] font-black rounded-full px-1.5 py-0.5 inline-block"
                          style={{background:pct>=70?'#dcfce7':pct>=40?'#fef9c3':'#fee2e2',color:pct>=70?'#07579e':pct>=40?'#854d0e':'#991b1b'}}>
                          P{pct}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ═══ 2. INSIGHT AUTOMÁTICO ════════════════════════════════════ */}
            {insight && (
              <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-5"
                style={{borderLeft:'4px solid #0b7c3d'}}>
                <p className="text-[8px] font-black uppercase tracking-widest text-sky-600 mb-2">💡 Diagnóstico Automático</p>
                <p className="text-[11px] text-gray-700 leading-relaxed">{insight}</p>
              </div>
            )}

            {/* ═══ 3. CORRELAÇÕES INDIVIDUAIS ═══════════════════════════════ */}
            {corrMatrix.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="bc text-base font-black uppercase text-gray-900">Correlações do Atleta</p>
                    <p className="text-[9px] text-gray-400">GPS × Desempenho · Pearson r · {playerData.length} jogos · |r| ≥ 0.25</p>
                  </div>
                  {playerData.length < 5 && (
                    <span className="text-[8px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-bold">
                      ⚠️ amostra pequena
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Positivas */}
                  {topCorrs.positive.length > 0 && (
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-sky-600 mb-2">📈 Positivas — maior carga, maior impacto nessa dimensão</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {topCorrs.positive.map((c, i) => (
                          <div key={i} className="rounded-xl border p-3 flex items-start gap-3"
                            style={{background:rBg(c.r), borderColor:rColor(c.r)+'40'}}>
                            <div className="text-center flex-shrink-0 min-w-[56px]">
                              <p className="bc text-2xl font-black leading-none" style={{color:rColor(c.r)}}>+{c.r}{c.sig?' ★':''}</p>
                              <p className="text-[7px] font-black uppercase mt-0.5" style={{color:rColor(c.r)}}>{rLabel(c.r)}</p>
                              <p className="text-[7px] text-gray-400 mt-0.5">r²={c.r2?.toFixed(2)}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-gray-800 leading-tight">{c.gpsLabel}</p>
                              <p className="text-[8px] text-gray-400">×</p>
                              <p className="text-[10px] font-bold text-gray-700">{c.perfLabel}</p>
                              <p className="text-[9px] text-gray-500 mt-1 leading-snug">{genInterpretation(c.gpsKey, c.perfKey, c.r)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Negativas */}
                  {corrNegative.length > 0 ? (
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-red-600 mb-2">📉 Negativas — maior carga, menor impacto nessa dimensão</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {corrNegative.map((c, i) => (
                          <div key={i} className="rounded-xl border p-3 flex items-start gap-3"
                            style={{background:rBg(c.r), borderColor:rColor(c.r)+'40'}}>
                            <div className="text-center flex-shrink-0 min-w-[56px]">
                              <p className="bc text-2xl font-black leading-none" style={{color:rColor(c.r)}}>{c.r}{c.sig?' ★':''}</p>
                              <p className="text-[7px] font-black uppercase mt-0.5" style={{color:rColor(c.r)}}>{rLabel(c.r)}</p>
                              <p className="text-[7px] text-gray-400 mt-0.5">r²={c.r2?.toFixed(2)}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-gray-800 leading-tight">{c.gpsLabel}</p>
                              <p className="text-[8px] text-gray-400">×</p>
                              <p className="text-[10px] font-bold text-gray-700">{c.perfLabel}</p>
                              <p className="text-[9px] text-gray-500 mt-1 leading-snug">{genInterpretation(c.gpsKey, c.perfKey, c.r)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <p className="text-[9px] text-gray-400">
                        Nenhuma correlação negativa detectada com os dados atuais.
                        {playerData.length < 5 && ' Com mais jogos no banco, padrões negativos podem emergir.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ 4. SCATTER + QUADRANTE ═══════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <p className="bc text-base font-black uppercase text-gray-900">Scatter Físico × Desempenho</p>
                  <p className="text-[9px] text-gray-400">Cada ponto = 1 jogo · linhas = mediana</p>
                </div>
                <div className="text-center">
                  <p className="text-[7px] text-gray-400 uppercase">r</p>
                  <p className="text-xl font-black" style={{color:rColor(scatterStats.r)}}>
                    {scatterStats.r!==null?`${scatterStats.r>0?'+':''}${scatterStats.r}${scatterStats.sig?' ★':''}`:'—'}
                  </p>
                  {scatterStats.r2!=null&&<p className="text-[7px] text-gray-400">r²={scatterStats.r2?.toFixed(2)} · {scatterStats.sig?'p<.05':'n.s.'}</p>}
                </div>
              </div>

              {/* Axis selectors */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-[7px] font-black uppercase text-gray-400 mb-1">GPS (X)</p>
                  <select value={selectedGpsX} onChange={e=>setSelectedGpsX(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-sky-400">
                    {GPS_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Desempenho (Y)</p>
                  <select value={selectedPerfY} onChange={e=>setSelectedPerfY(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-sky-400">
                    {PERF_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              {scatterData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart margin={{top:8,right:16,bottom:24,left:-4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="_x" type="number"
                      label={{value:gxMeta.label, position:'insideBottom', offset:-14, fontSize:8, fill:'#94a3b8'}}
                      tick={{fontSize:8,fill:'#94a3b8'}} />
                    <YAxis dataKey="_y" type="number"
                      label={{value:pyMeta.label, angle:-90, position:'insideLeft', offset:8, fontSize:8, fill:'#94a3b8'}}
                      tick={{fontSize:8,fill:'#94a3b8'}} />
                    <ZAxis range={[55,55]} />
                    <ReferenceLine x={qMedX} stroke="#94a3b8" strokeDasharray="3 2" strokeWidth={1} />
                    <ReferenceLine y={qMedY} stroke="#94a3b8" strokeDasharray="3 2" strokeWidth={1} />
                    <Tooltip content={({active,payload}) => {
                      if (!active||!payload?.length) return null
                      const d = payload[0]?.payload
                      const semIcon = d?.sem ? {verde:'🟢',amarelo:'🟡',vermelho:'🔴'}[d.sem] : ''
                      return (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                          <p className="font-black text-gray-900">vs {d?.adversario} {semIcon}</p>
                          <p className="text-gray-400 text-[9px]">{d?.resultado} · {d?.min}'</p>
                          <p className="mt-1"><span className="text-gray-400">{gxMeta.label}:</span> <b>{typeof d?._x === 'number' ? d._x.toFixed(1) : d?._x}</b></p>
                          <p><span className="text-gray-400">{pyMeta.label}:</span> <b>{typeof d?._y === 'number' ? d._y.toFixed(1) : d?._y}</b></p>
                        </div>
                      )
                    }} />
                    <Scatter data={scatterData}
                      shape={({cx,cy,payload}) => (
                        <circle cx={cx} cy={cy} r={7} fill={payload?.fill || G.verde} fillOpacity={0.85} />
                      )} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-24 flex items-center justify-center">
                  <p className="text-[9px] text-gray-400">Mínimo 2 jogos para exibir scatter.</p>
                </div>
              )}
              <div className="flex gap-4 mt-2 justify-center text-[9px]">
                {[['#0a66b7','Alto impacto'],['#ca8a04','Impacto mod.'],['#dc2626','Baixo impacto']].map(([c,l])=>(
                  <span key={l} className="flex items-center gap-1.5 font-bold text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>{l}
                  </span>
                ))}
              </div>
            </div>

            {/* ═══ 5. TIMELINE CONTEXTUAL ═══════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <p className="bc text-base font-black uppercase text-gray-900">Timeline — {gxMeta.label}</p>
                  <p className="text-[9px] text-gray-400">Linha verde = atleta · Linha pontilhada = média</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {GPS_METRICS.map(m => (
                    <button key={m.key} onClick={() => setSelectedGpsX(m.key)}
                      className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${selectedGpsX===m.key?'text-white':'bg-gray-100 text-gray-500'}`}
                      style={selectedGpsX===m.key?{background:m.color}:{}}>
                      {m.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              {playerData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart
                    data={playerData.map((d) => {
                      const sem = gameSemaphore(d)
                      const semColor = sem
                        ? {verde:'#0a66b7', amarelo:'#ca8a04', vermelho:'#dc2626'}[sem]
                        : gxMeta.color
                      return {
                        name: `vs ${d.adversario}`,
                        val:  d[selectedGpsX] || 0,
                        pos_avg: posData.length > 0
                          ? posData.reduce((s,p)=>s+(p[selectedGpsX]||0),0)/posData.length
                          : null,
                        resultado: d.resultado,
                        min: d.min,
                        semColor,
                      }
                    })}
                    margin={{top:8,right:24,left:-8,bottom:36}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name"
                      tick={({x,y,payload})=>{
                        // payload.value is the "name" string "vs Adversario"
                        // payload.sem and payload.min are encoded in the data object
                        const item = payload   // recharts passes the full tick payload
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={0} dy={12} textAnchor="middle" fill="#9ca3af" fontSize={7} fontWeight={700}>{payload.value}</text>
                          </g>
                        )
                      }}
                      height={24} />
                    <YAxis tick={{fontSize:8,fill:'#9ca3af'}} />
                    <Tooltip contentStyle={{fontSize:10,borderRadius:8,border:'1px solid #e2e8f0'}}
                      formatter={(v,k,props) => {
                        const label = k === 'val' ? gxMeta.label : 'Média Posição'
                        const extra = k === 'val' && props?.payload
                          ? ` · ${props.payload.resultado || ''} · ${props.payload.min || ''}'`
                          : ''
                        return [typeof v === 'number' ? v.toFixed(1) : v, label + extra]
                      }} />
                    <ReferenceLine y={S[`${selectedGpsX}_avg`]}
                      stroke={G.amber} strokeDasharray="4 2" strokeWidth={1.5}
                      label={{value:'Minha Média',position:'insideTopRight',fontSize:7,fill:G.amber,fontWeight:700}} />
                    {posData.length > 0 && (
                      <Line type="monotone" dataKey="pos_avg" stroke="#cbd5e1" strokeWidth={1.5}
                        strokeDasharray="3 2" dot={false} />
                    )}
                    <Line type="monotone" dataKey="val" stroke={gxMeta.color} strokeWidth={2.5}
                      dot={({cx,cy,payload})=>{
                        const col = payload?.semColor || gxMeta.color
                        return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={col} stroke="white" strokeWidth={1.5}/>
                      }}
                      activeDot={{r:7}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-[9px] text-gray-400 text-center py-8">Mínimo 2 jogos para a timeline.</p>
              )}
            </div>

            {/* ═══ 6. SEMÁFORO POR JOGO + COMPARAÇÃO COM POSIÇÃO ═══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Semáforo por jogo */}
              {(() => {
                const _semData = [...playerData].reverse().map(d => ({
                  d, gs: calcGameScore(d)
                })).filter(x => x.gs)
                const _displayed = semFilterState
                  ? _semData.filter(({gs}) =>
                      semFilterState === 'verde'    ? gs.score >= 70 :
                      semFilterState === 'amarelo'  ? gs.score >= 50 && gs.score < 70 :
                      semFilterState === 'vermelho' ? gs.score < 50 : true
                    )
                  : _semData
                return (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="bc text-sm font-black uppercase text-gray-900">Semáforo por Partida</p>
                      <div className="flex gap-1">
                        {[
                          [null,       'Todos',    '#374151'],
                          ['verde',    '🟢 Alto',   '#0a66b7'],
                          ['amarelo',  '🟡 Mod.',   '#ca8a04'],
                          ['vermelho', '🔴 Alerta', '#dc2626'],
                        ].map(([val, lbl, color]) => (
                          <button key={String(val)} onClick={() => setSemFilterState(val)}
                            className={`px-2 py-1 rounded-lg text-[7px] font-black transition-all ${semFilterState===val?'text-white':'bg-gray-100 text-gray-500'}`}
                            style={semFilterState===val?{background:color}:{}}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {_displayed.map(({d, gs}, i) => {
                        const SCfg = SEMAPHORE_CFG[gs.status]
                        const hsr  = (d.hsr_p90||0) >= 1000 ? `${((d.hsr_p90||0)/1000).toFixed(1)}k` : (d.hsr_p90||0).toFixed(0)+'m'
                        const badgeBg  = { Alto:'#dcfce7', Médio:'#fef9c3', Baixo:'#fee2e2', Boa:'#dcfce7', Regular:'#fef9c3' }
                        const badgeCol = { Alto:'#07579e', Médio:'#854d0e', Baixo:'#991b1b', Boa:'#07579e', Regular:'#854d0e' }
                        return (
                          <div key={i} className="rounded-xl border overflow-hidden"
                            style={{borderColor:SCfg?.border||'#e2e8f0'}}>
                            <div className="flex items-center gap-3 px-3 py-2.5"
                              style={{background:SCfg?.bg||'#f8fafc'}}>
                              <span className="text-lg flex-shrink-0">{SCfg?.icon||'⚪'}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[9px] font-black text-gray-800">vs {d.adversario}</p>
                                  <span className="text-[7px] text-gray-400">{fmtDate(d.data_jogo)} · {d.resultado} · {d.min}'</span>
                                </div>
                                <p className="text-[8px] font-black mt-0.5" style={{color:SCfg?.color||'#9ca3af'}}>
                                  {SCfg?.label} · {gs.impactType}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="bc text-xl font-black leading-none" style={{color:SCfg?.color||'#9ca3af'}}>{gs.score}</p>
                                <p className="text-[6px] text-gray-400 font-bold">/ 100</p>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100">
                              <div className="h-full" style={{width:`${gs.score}%`, background:SCfg?.color||'#9ca3af'}} />
                            </div>
                            <div className="px-3 py-2 bg-white flex items-center justify-between flex-wrap gap-2">
                              <div className="flex gap-1.5">
                                {[['Físico',gs.physBadge],['Desempenho',gs.perfBadge],['Eficiência',gs.effBadge]].map(([label,badge]) => (
                                  <div key={label} className="text-center">
                                    <p className="text-[6px] text-gray-400 font-black uppercase">{label}</p>
                                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full"
                                      style={{background:badgeBg[badge]||'#f3f4f6',color:badgeCol[badge]||'#6b7280'}}>
                                      {badge}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="text-right">
                                <p className="text-[7px] text-gray-500">HSR {hsr} · Sprint {(d.sprint_p90||0).toFixed(0)}m · Acel {(d.accel_p90||0).toFixed(0)}</p>
                                <p className="text-[7px] text-gray-500">
                                  Ações {(d.acoesW_pct||0).toFixed(0)}% · Duelos {(d.duelosW_pct||0).toFixed(0)}%
                                  {gs.vsHsr !== null && (
                                    <span className="ml-1 font-black" style={{color:gs.vsHsr>=0?'#0a66b7':'#dc2626'}}>
                                      · HSR {gs.vsHsr>=0?'+':''}{gs.vsHsr}% vs pos.
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {gs.reasons.length > 0 && (
                              <div className="px-3 pb-2 bg-white">
                                <p className="text-[7px] text-gray-400 italic">{gs.reasons.join(' · ')}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {_displayed.length === 0 && (
                        <p className="text-[9px] text-gray-400 text-center py-4">Nenhum jogo com esse status.</p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Comparação com posição */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <p className="bc text-sm font-black uppercase text-gray-900 mb-3">
                  vs Média {POS_LABEL[S.pos]||'Posição'}
                  {posData.length === 0 && <span className="text-[7px] text-gray-400 font-normal ml-2">(sem outros atletas)</span>}
                </p>
                <div className="space-y-3">
                  {GPS_METRICS.map(m => {
                    const myAvg  = S[`${m.key}_avg`] || 0
                    const posAvg = posData.length > 0
                      ? posData.reduce((s,d)=>s+(d[m.key]||0),0)/posData.length
                      : null
                    const diff = posAvg ? ((myAvg - posAvg) / (posAvg + 0.001) * 100) : null
                    const pct  = S[`${m.key}_pct`]
                    const barW = posAvg ? Math.min(100, (myAvg / (posAvg * 2)) * 100) : 50
                    return (
                      <div key={m.key}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[8px] font-black text-gray-600">{m.label}</p>
                          <div className="flex items-center gap-2">
                            {pct !== null && (
                              <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full"
                                style={{background:pct>=70?'#dcfce7':pct>=40?'#fef9c3':'#fee2e2',
                                        color:pct>=70?'#07579e':pct>=40?'#854d0e':'#991b1b'}}>
                                P{pct}
                              </span>
                            )}
                            {diff !== null && (
                              <span className="text-[8px] font-black" style={{color:diff>=0?G.verde:G.red}}>
                                {diff>=0?'+':''}{diff.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${barW}%`,background:m.color}} />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[7px] text-gray-500 font-bold" style={{color:m.color}}>
                            {m.unit==='m'&&myAvg>=1000?`${(myAvg/1000).toFixed(1)}k`:myAvg.toFixed(0)} (eu)
                          </span>
                          {posAvg !== null && (
                            <span className="text-[7px] text-gray-400">
                              {m.unit==='m'&&posAvg>=1000?`${(posAvg/1000).toFixed(1)}k`:posAvg.toFixed(0)} (posição)
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ═══ 7. FORÇAS & ALERTAS ══════════════════════════════════════ */}
            {corrMatrix.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-5">
                  <p className="bc text-sm font-black uppercase text-sky-700 mb-3">🟢 Forças</p>
                  <div className="space-y-2">
                    {corrMatrix.filter(c=>c.r>=0.3).slice(0,4).map((c,i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-sky-500 flex-shrink-0 mt-0.5">✓</span>
                        <div>
                          <p className="text-[9px] font-black text-gray-800">{c.gpsLabel} × {c.perfLabel}</p>
                          <p className="text-[8px] text-gray-500">
                            r={c.r>0?'+':''}{c.r} · Quando a carga aumenta, há ganho nessa dimensão.
                          </p>
                        </div>
                      </div>
                    ))}
                    {corrMatrix.filter(c=>c.r>=0.3).length === 0 && (
                      <p className="text-[9px] text-gray-400">Nenhuma relação positiva relevante identificada ainda.</p>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
                  <p className="bc text-sm font-black uppercase text-red-600 mb-3">🔴 Alertas</p>
                  <div className="space-y-2">
                    {corrMatrix.filter(c=>c.r<=-0.25).slice(0,4).map((c,i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-red-400 flex-shrink-0 mt-0.5">⚠</span>
                        <div>
                          <p className="text-[9px] font-black text-gray-800">{c.gpsLabel} × {c.perfLabel}</p>
                          <p className="text-[8px] text-gray-500">
                            r={c.r.toFixed(2)} · Queda de eficiência quando a carga cresce.
                          </p>
                        </div>
                      </div>
                    ))}
                    {corrMatrix.filter(c=>c.r<=-0.25).length === 0 && (
                      <p className="text-[9px] text-gray-400">Nenhum alerta de relação negativa relevante.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ 8. BANCO DETALHADO ═══════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="bc text-sm font-black uppercase text-gray-700">Banco de Jogos — {selectedPlayer}</p>
              </div>
              <div className="overflow-x-auto scrollbar-g">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{background:'#1f2937'}}>
                      {['Jogo','Res.','Min.','HSR p90','Sprint p90','Acel.','Decel.','Duelos','D.Ganhos%','Intercep.','Passes%','Ações%','Status'].map(h=>(
                        <th key={h} className="px-2 py-2.5 text-left text-[8px] font-black uppercase text-white whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...playerData].reverse().map((d,i) => {
                      const sem = gameSemaphore(d)
                      const SCfg = sem ? SEMAPHORE_CFG[sem] : null
                      const resCfg = {V:{color:'#07579e'},E:{color:'#ca8a04'},D:{color:'#dc2626'}}[d.resultado]||{color:'#6b7280'}
                      return (
                        <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/30'} hover:bg-sky-50/30`}>
                          <td className="px-2 py-2 font-bold text-gray-700 whitespace-nowrap">vs {d.adversario}</td>
                          <td className="px-2 py-2 font-black" style={{color:resCfg.color}}>{d.resultado}</td>
                          <td className="px-2 py-2 text-gray-400">{d.min}'</td>
                          <td className="px-2 py-2 font-bold" style={{color:(d.hsr_p90||0)>=(S.hsr_p90_avg||0)?G.verde:G.red}}>
                            {(d.hsr_p90||0)>=1000?`${((d.hsr_p90||0)/1000).toFixed(1)}k`:(d.hsr_p90||0).toFixed(0)}
                          </td>
                          <td className="px-2 py-2 text-gray-600">{(d.sprint_p90||0).toFixed(0)}</td>
                          <td className="px-2 py-2 text-gray-600">{(d.accel_p90||0).toFixed(1)}</td>
                          <td className="px-2 py-2 text-gray-600">{(d.decel_p90||0).toFixed(1)}</td>
                          <td className="px-2 py-2 text-gray-600">{(d.duelos_p90||0).toFixed(1)}</td>
                          <td className="px-2 py-2 font-bold" style={{color:(d.duelosW_pct||0)>=50?G.verde:G.red}}>{(d.duelosW_pct||0).toFixed(1)}%</td>
                          <td className="px-2 py-2 text-gray-600">{(d.interc_p90||0).toFixed(1)}</td>
                          <td className="px-2 py-2 font-bold" style={{color:(d.passesC_pct||0)>=75?G.verde:G.amber}}>{(d.passesC_pct||0).toFixed(1)}%</td>
                          <td className="px-2 py-2 font-bold" style={{color:(d.acoesW_pct||0)>=60?G.verde:G.amber}}>{(d.acoesW_pct||0).toFixed(1)}%</td>
                          <td className="px-2 py-2">
                            {SCfg ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-black"
                                style={{background:SCfg.bg,color:SCfg.color,border:`1px solid ${SCfg.border}`}}>
                                {SCfg.icon} {SCfg.label}
                              </span>
                            ) : <span className="text-gray-300 text-[7px]">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PADRÕES DA TEMPORADA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── CLASSIFICAÇÃO DE TIPO DE PADRÃO ────────────────────────────────────────
function classifyPatternType(gpsKey, perfKey, r) {
  const isNeg = r < 0
  const perfVolume = ['duelos_p90','duelos_def_p90','duelos_of_p90','interc_p90','alivios_p90','remates_p90','dribles_p90','cruzamentos_p90','faltas_p90','faltas_sof_p90']
  const perfEfic   = ['duelosW_pct','duelos_def_pct','duelos_of_pct','duelos_aereos_pct','passesC_pct','passes_tf_pct','passes_longos_pct','acoesW_pct','dribles_suc_pct','cruzamentos_pct']
  const perfAtk    = ['duelos_of_p90','duelos_of_pct','remates_p90','dribles_p90','dribles_suc_pct','cruzamentos_p90','passProgr_p90']
  const perfDef    = ['duelos_def_p90','duelos_def_pct','interc_p90','alivios_p90']
  const perfFoul   = ['faltas_p90','faltas_sof_p90']
  const isObvious  = (
    (gpsKey === 'dist_p90'    && perfKey === 'duelos_p90') ||
    (gpsKey === 'hsr_p90'     && perfKey === 'duelos_p90') ||
    (gpsKey === 'dist_p90'    && perfKey === 'duelos_def_p90') ||
    (gpsKey === 'dist_p90'    && perfKey === 'duelos_of_p90') ||
    (gpsKey === 'sprint_p90'  && perfKey === 'remates_p90') ||
    (gpsKey === 'accel_p90'   && perfKey === 'dribles_p90')
  )

  if (perfFoul.includes(perfKey) && isNeg === false)
    return { tipo: 'Alerta Físico', priority: 'Alta', utility: 'Alerta', color: '#dc2626', bg: '#fef2f2', icon: '⚠️' }
  if (isNeg && perfEfic.includes(perfKey))
    return { tipo: 'Alerta Técnico', priority: 'Alta', utility: 'Alerta', color: '#dc2626', bg: '#fef2f2', icon: '🔴' }
  if (isNeg && perfVolume.includes(perfKey))
    return { tipo: 'Alerta', priority: 'Média', utility: 'Investigação', color: '#f59e0b', bg: '#fffbeb', icon: '🟡' }
  if (!isNeg && perfEfic.includes(perfKey))
    return { tipo: 'Eficiência', priority: 'Alta', utility: 'Útil', color: '#0ea5e9', bg: '#f0f9ff', icon: '🎯' }
  if (!isNeg && perfAtk.includes(perfKey))
    return { tipo: 'Contexto Ofensivo', priority: isObvious ? 'Baixa' : 'Média', utility: isObvious ? 'Óbvio' : 'Útil', color: '#10b981', bg: '#f0fdf4', icon: '⚡' }
  if (!isNeg && perfDef.includes(perfKey))
    return { tipo: 'Contexto Defensivo', priority: isObvious ? 'Baixa' : 'Média', utility: isObvious ? 'Óbvio' : 'Útil', color: '#0ea5e9', bg: '#f0f9ff', icon: '🛡️' }
  if (!isNeg && perfVolume.includes(perfKey))
    return { tipo: 'Participação', priority: isObvious ? 'Baixa' : 'Média', utility: isObvious ? 'Óbvio' : 'Útil', color: '#0B7C3D', bg: '#f0fdf4', icon: '📊' }
  return { tipo: 'Resultado', priority: 'Média', utility: 'Útil', color: '#8b5cf6', bg: '#f5f3ff', icon: '📈' }
}

// ─── CUIDADO + APLICAÇÃO automáticos por par ────────────────────────────────
function genActionable(gpsKey, perfKey, r) {
  const abs = Math.abs(r), isNeg = r < 0
  const pairs = {
    'dist_p90|duelos_p90':       { cuidado:'Volume de duelo não significa eficiência no duelo.', aplicacao:'Cruzar com duelos ganhos % e contexto da posição.' },
    'hsr_p90|duelos_p90':        { cuidado:'Alta intensidade gera mais disputas, mas pode indicar perseguição tática.', aplicacao:'Verificar se HSR ocorre em transição defensiva ou ofensiva.' },
    'dist_p90|passesC_pct':      { cuidado:'Queda de precisão sob maior demanda pode indicar fadiga ou desorganização.', aplicacao:'Inserir blocos técnicos após sessões de alto volume.' },
    'hsr_p90|faltas_p90':        { cuidado:'Alta intensidade gerando mais faltas pode expor o atleta a cartões.', aplicacao:'Monitorar padrão disciplinar em jogos de alta exigência física.' },
    'accel_p90|duelos_of_p90':   { cuidado:'Explosão curta gera disputa, mas avaliar conversão em finalização.', aplicacao:'Criar tarefas com deslocamento + disputa + finalização.' },
    'decel_p90|interc_p90':      { cuidado:'Frenagem ligada a interceptação pode indicar cobertura reativa.', aplicacao:'Monitorar mudança de direção em situações de pressão e cobertura.' },
    'dist_p90|duelosW_pct':      { cuidado:'Relação negativa indica possível queda de eficiência sob maior esforço.', aplicacao:'Avaliar duelos ganhos em função do período do jogo.' },
    'sprint_p90|remates_p90':    { cuidado:'Sprint gerando remate precisa ser qualificado: chute útil ou reflexo?', aplicacao:'Verificar se sprints resultam em ações ofensivas concretas.' },
    'hsr_p90|acoesW_pct':        { cuidado:'Alta intensidade com queda de eficiência nas ações é sinal de desgaste.', aplicacao:'Monitorar picos de HSR em relação ao período do jogo.' },
  }
  const key = `${gpsKey}|${perfKey}`
  if (pairs[key]) return pairs[key]
  if (isNeg && abs >= 0.4) return {
    cuidado: 'Relação inversa relevante — verificar se há padrão de fadiga ou desorganização tática.',
    aplicacao: 'Cruzar com contexto da partida e período do jogo em que essa relação aparece.'
  }
  if (!isNeg && abs >= 0.7) return {
    cuidado: 'Correlação forte, mas verificar se não é relação óbvia de participação.',
    aplicacao: 'Comparar com métricas de eficiência para qualificar o padrão.'
  }
  return {
    cuidado: 'Interpretar junto ao contexto posicional e do jogo.',
    aplicacao: 'Cruzar com outras métricas para confirmar o padrão.'
  }
}

// ─── DIAGNÓSTICO AUTOMÁTICO DO BANCO ────────────────────────────────────────
function genDiagnosis(allStats) {
  const sig      = allStats.filter(s => s.sig)
  const negAlerts = allStats.filter(s => s.r < -0.3 && ['passesC_pct','duelosW_pct','acoesW_pct'].some(k => s.perfKey === k))
  const topPos   = allStats.filter(s => s.r > 0.7 && s.sig)[0]
  const topNeg   = allStats.filter(s => s.r < -0.4)[0]
  const hasVolPart = allStats.some(s => ['duelos_p90','duelos_def_p90'].includes(s.perfKey) && s.r > 0.6)

  let txt = `O banco apresenta ${sig.length} relações estatisticamente significativas (p < .05).`
  if (hasVolPart) txt += ` Distância, HSR e acelerações aparecem repetidamente associadas ao aumento de duelos e ações defensivas, sugerindo que maior exigência física está mais conectada a participação e disputa do que necessariamente a eficiência técnica.`
  if (topPos)     txt += ` A relação mais forte positiva é entre ${topPos.gpsLabel} e ${topPos.perfLabel} (r ${topPos.r > 0 ? '+' : ''}${topPos.r}).`
  if (negAlerts.length > 0) txt += ` Atenção: ${negAlerts.length} relação(ões) inversa(s) entre carga física e métricas de eficiência foram identificadas — possível sinal de queda técnica sob maior demanda.`
  if (topNeg)     txt += ` O principal alerta é ${topNeg.gpsLabel} × ${topNeg.perfLabel} (r ${topNeg.r}).`
  return txt
}

// ─── FILTROS DE NAVEGAÇÃO POR PERGUNTA ──────────────────────────────────────
const NAV_QUESTIONS = [
  {
    id: 'todos', label: 'Todos', icon: '🧠',
    filter: () => true,
  },
  {
    id: 'participacao', label: 'O que aumenta participação?', icon: '📊',
    filter: s => ['duelos_p90','duelos_def_p90','duelos_of_p90','interc_p90','passProgr_p90'].includes(s.perfKey) && s.r > 0,
  },
  {
    id: 'eficiencia', label: 'O que aumenta eficiência?', icon: '🎯',
    filter: s => ['duelosW_pct','duelos_def_pct','duelos_of_pct','passesC_pct','acoesW_pct','dribles_suc_pct'].includes(s.perfKey),
  },
  {
    id: 'alerta', label: 'O que gera alerta?', icon: '🔴',
    filter: s => s.r < -0.25 || (['faltas_p90'].includes(s.perfKey) && s.r > 0.4),
  },
  {
    id: 'resultado', label: 'O que conecta com resultado?', icon: '🏆',
    filter: s => ['duelosW_pct','acoesW_pct','passesC_pct','interc_p90'].includes(s.perfKey),
  },
]

// ─── POSIÇÃO: padrão dominante + leitura + alerta + aplicação ───────────────
const POS_INTELLIGENCE = {
  ZAG: {
    padrao: 'Distância e HSR ligados a duelos e passes progressivos',
    leitura: 'Zagueiros mais exigidos fisicamente participam mais da disputa e da primeira progressão.',
    alerta:  'Verificar se esse volume vem de controle defensivo ou perseguição reativa.',
    aplicacao: 'Cruzar com duelos ganhos %, precisão de passe e gols sofridos.',
  },
  LAT: {
    padrao: 'Distância e sprints ligados a duelos e participação nas duas fases',
    leitura: 'Laterais com maior cobertura de espaço tendem a se envolver mais em duelos ofensivos e defensivos.',
    alerta:  'Alto volume pode indicar overload nas transições — risco de queda de precisão.',
    aplicacao: 'Monitorar relação entre distância e duelos ganhos % nas duas fases.',
  },
  VOL: {
    padrao: 'Distância e acelerações ligadas a duelos e intercepções',
    leitura: 'Função com forte relação entre mobilidade curta e impacto defensivo/transição.',
    alerta:  'Desaceleração excessiva pode sinalizar cobertura reativa em vez de pressão proativa.',
    aplicacao: 'Monitorar aceleração/desaceleração em tarefas de pressão e cobertura.',
  },
  MC: {
    padrao: 'Correlações mais instáveis, dependentes do contexto de jogo',
    leitura: 'Meia tem padrões menos uniformes — eficiência varia com o papel tático atribuído.',
    alerta:  'Alta distância com baixa precisão de passe pode indicar jogo reativo ou desgaste.',
    aplicacao: 'Avaliar separadamente por papel: Meia criativo x Meia de pressão.',
  },
  ATA: {
    padrão: 'Sprint e aceleração ligados a duelos ofensivos e ações de ruptura',
    leitura: 'Alta intensidade em curtos deslocamentos está associada à disputa ofensiva.',
    alerta:  'Alta intensidade precisa virar finalização, drible ou ação útil — não apenas desgaste.',
    aplicacao: 'Verificar se sprints resultam em ação ofensiva concreta: xG, remates, dribles.',
  },
}

function TabPadroes({ fullPartidas }) {
  const historico  = useMemo(() => buildHistoricalDataset(fullPartidas), [fullPartidas])
  const coletivo   = useMemo(() => buildCollectiveDataset(fullPartidas), [fullPartidas])

  const [navQ,       setNavQ]       = useState('todos')
  const [rankFilter, setRankFilter] = useState('todos')
  const [minR,       setMinR]       = useState(0)
  const [onlySig,    setOnlySig]    = useState(false)
  const [excludeObv, setExcludeObv] = useState(false)

  // All individual correlations with stats + classification
  const allStats = useMemo(() => {
    const res = []
    GPS_METRICS.forEach(gm => {
      PERF_METRICS.forEach(pm => {
        const st = pearsonStats(historico, gm.key, pm.key)
        if (st.r !== null) {
          const cls = classifyPatternType(gm.key, pm.key, st.r)
          const act = genActionable(gm.key, pm.key, st.r)
          res.push({ gpsKey:gm.key, perfKey:pm.key, gpsLabel:gm.label, perfLabel:pm.label, gpsColor:gm.color, ...st, ...cls, ...act })
        }
      })
    })
    return res.sort((a,b) => Math.abs(b.r)-Math.abs(a.r))
  }, [historico])

  const topPositive = allStats.filter(s => s.r > 0)[0] || null
  const topNegative = allStats.filter(s => s.r < 0)[0] || null

  // Padrões confiáveis: sig + r>=0.4 + não óbvio demais
  const confiaveis = allStats.filter(s => s.sig && Math.abs(s.r) >= 0.40 && s.utility !== 'Óbvio').slice(0, 6)

  // Alertas automáticos
  const alertas = allStats.filter(s => s.utility === 'Alerta' || (s.r < -0.35 && Math.abs(s.r) >= 0.35)).slice(0, 5)

  // Per-position strongest correlations
  const posPatterns = useMemo(() => Object.keys(POS_LABEL).filter(p => p !== 'GOL').map(pos => {
    const group = historico.filter(d => d.pos === pos)
    if (group.length < 4) return null
    const res = []
    GPS_METRICS.forEach(gm => {
      PERF_METRICS.forEach(pm => {
        const st = pearsonStats(group, gm.key, pm.key)
        if (st.r !== null && Math.abs(st.r) >= 0.25) {
          const cls = classifyPatternType(gm.key, pm.key, st.r)
          res.push({ gpsKey:gm.key, perfKey:pm.key, gpsLabel:gm.label, perfLabel:pm.label, gpsColor:gm.color, ...st, ...cls })
        }
      })
    })
    res.sort((a,b) => Math.abs(b.r)-Math.abs(a.r))
    return { pos, label:POS_LABEL[pos], color:POS_COLOR[pos], n:group.length, top:res[0]||null, second:res[1]||null, intel:POS_INTELLIGENCE[pos]||null }
  }).filter(Boolean), [historico])

  const nGames   = fullPartidas.filter(p => p.gps_status==='ok'&&p.wyscout_status==='ok').length
  const nSig     = allStats.filter(s => s.sig).length
  const nAtletas = new Set(historico.map(d=>d.nome)).size
  const nAlerts  = alertas.length

  const diagnosis = useMemo(() => genDiagnosis(allStats), [allStats])

  // Filtered ranking
  const navQ_obj   = NAV_QUESTIONS.find(q => q.id === navQ) || NAV_QUESTIONS[0]
  const rankFiltered = useMemo(() => {
    let base = allStats.filter(navQ_obj.filter)
    if (onlySig)    base = base.filter(s => s.sig)
    if (excludeObv) base = base.filter(s => s.utility !== 'Óbvio')
    if (minR > 0)   base = base.filter(s => Math.abs(s.r) >= minR)
    if (rankFilter === 'positivas') base = base.filter(s => s.r > 0)
    if (rankFilter === 'negativas') base = base.filter(s => s.r < 0)
    if (rankFilter === 'alertas')   base = base.filter(s => s.utility === 'Alerta' || s.utility === 'Investigação')
    if (rankFilter === 'eficiencia') base = base.filter(s => s.tipo === 'Eficiência')
    return base
  }, [allStats, navQ, onlySig, excludeObv, minR, rankFilter])

  if (historico.length < 3) return (
    <EmptyState icon="🧠" title="Dados insuficientes" sub="Importe pelo menos 2 partidas completas (GPS + Wyscout) para gerar padrões." />
  )

  // ── Sub-components ──────────────────────────────────────────────────────────
  const ActionableCard = ({ s, accent }) => {
    const cls = s.tipo ? s : classifyPatternType(s.gpsKey, s.perfKey, s.r)
    const act = genActionable(s.gpsKey, s.perfKey, s.r)
    const col = accent || rColor(s.r)
    return (
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{borderColor:col+'30'}}>
        <div className="px-4 pt-4 pb-2" style={{background:`linear-gradient(135deg, ${col}10 0%, transparent 100%)`}}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-block text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1.5"
                style={{background:col+'20', color:col}}>{cls.icon} {cls.tipo}</span>
              <p className="bc text-lg font-black uppercase text-gray-900 leading-tight">{s.gpsLabel}</p>
              <p className="text-[9px] text-gray-400">× {s.perfLabel}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="bc text-3xl font-black leading-none" style={{color:rColor(s.r)}}>
                {s.r>0?'+':''}{s.r}{s.sig?' ★':''}
              </p>
              <p className="text-[7px] font-black uppercase mt-0.5" style={{color:rColor(s.r)}}>{rLabel(s.r)}</p>
              <p className="text-[7px] text-gray-400 mt-1">r²={s.r2?.toFixed(2)} · n={s.n}</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 space-y-2 border-t border-gray-50">
          <div>
            <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Leitura</p>
            <p className="text-[9px] text-gray-700 leading-relaxed">{genInterpretation(s.gpsKey, s.perfKey, s.r)}</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[7px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Cuidado</p>
              <p className="text-[8px] text-gray-600 leading-relaxed">{act.cuidado}</p>
            </div>
            <div className="flex-1">
              <p className="text-[7px] font-black uppercase tracking-widest text-sky-600 mb-0.5">Aplicação</p>
              <p className="text-[8px] text-gray-600 leading-relaxed">{act.aplicacao}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[7px] font-black px-2 py-0.5 rounded-full" style={{background:col+'15',color:col}}>{cls.utility}</span>
            <span className="text-[7px] font-black px-2 py-0.5 rounded-full"
              style={{background: cls.priority==='Alta'?'#fef2f2':cls.priority==='Média'?'#fffbeb':'#f8fafc',
                      color:      cls.priority==='Alta'?'#dc2626':cls.priority==='Média'?'#92400e':'#64748b'}}>
              Prioridade {cls.priority}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">

      {/* ═══ 1. HEADER KPIs ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label:'Jogos no Banco',      val:nGames,          color:G.verde  },
          { label:'Atletas Analisados',  val:nAtletas,        color:G.purple },
          { label:'Pares Correlac.',     val:allStats.length, color:G.sky    },
          { label:'Sig. (p < .05)',      val:nSig,            color:G.amber  },
          { label:'Alertas Detectados',  val:nAlerts,         color:G.red    },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">{k.label}</p>
            <p className="bc text-2xl font-black mt-1" style={{color:k.color}}>{k.val}</p>
          </div>
        ))}
      </div>

      {nGames < 5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-[10px] text-amber-700">
            ⚠️ <strong>Amostra pequena ({nGames} jogos)</strong> — interprete os padrões como tendência inicial. p &lt; .05 ★ indica maior confiabilidade.
          </p>
        </div>
      )}

      {/* ═══ 2. DIAGNÓSTICO GERAL ═════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border-l-4 shadow-sm p-5" style={{borderColor:G.verde}}>
        <p className="text-[8px] font-black uppercase tracking-widest mb-2" style={{color:G.verde}}>🧠 Diagnóstico Geral dos Padrões</p>
        <p className="text-[11px] text-gray-700 leading-relaxed">{diagnosis}</p>
      </div>

      {/* ═══ 3. NAVEGAÇÃO POR PERGUNTA ════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-[7px] font-black uppercase tracking-widest text-gray-400 mb-3">Explorar por pergunta</p>
        <div className="flex flex-wrap gap-2">
          {NAV_QUESTIONS.map(q => (
            <button key={q.id} onClick={() => setNavQ(q.id)}
              className="px-3 py-1.5 rounded-xl text-[8px] font-black transition-all"
              style={navQ === q.id
                ? {background:G.verde, color:'#fff'}
                : {background:'#f1f5f9', color:'#475569'}}>
              {q.icon} {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 4. PADRÕES CONFIÁVEIS ════════════════════════════════════════════ */}
      {confiaveis.length > 0 && navQ === 'todos' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="bc text-base font-black uppercase text-gray-700">✅ Padrões Confiáveis</p>
            <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              p &lt; .05 · |r| ≥ 0.40 · não óbvio
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {confiaveis.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-start gap-3"
                style={{borderLeft:`3px solid ${rColor(s.r)}`}}>
                <div className="text-center flex-shrink-0 min-w-[44px]">
                  <p className="bc text-xl font-black leading-none" style={{color:rColor(s.r)}}>
                    {s.r>0?'+':''}{s.r}{s.sig?' ★':''}
                  </p>
                  <p className="text-[6px] text-gray-400">r²={s.r2?.toFixed(2)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-gray-800 leading-tight">{s.gpsLabel} × {s.perfLabel}</p>
                  <p className="text-[8px] text-gray-500 mt-0.5">{genInterpretation(s.gpsKey, s.perfKey, s.r)}</p>
                  <span className="inline-block mt-1 text-[7px] font-black px-1.5 py-0.5 rounded-full"
                    style={{background:rColor(s.r)+'20', color:rColor(s.r)}}>{s.tipo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 5. PADRÕES ACIONÁVEIS (top positivo + negativo) ═════════════════ */}
      {navQ === 'todos' && (
        <div className="space-y-4">
          <p className="bc text-base font-black uppercase text-gray-700">🏆 Padrões em Destaque</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topPositive && <ActionableCard s={topPositive} accent={G.verde} />}
            {topNegative && <ActionableCard s={topNegative} accent={G.red} />}
          </div>
        </div>
      )}

      {/* ═══ 6. ALERTAS AUTOMÁTICOS ══════════════════════════════════════════ */}
      {alertas.length > 0 && (navQ === 'todos' || navQ === 'alerta') && (
        <div className="space-y-3">
          <p className="bc text-base font-black uppercase text-gray-700">🔴 Alertas Detectados</p>
          <div className="space-y-2">
            {alertas.map((s, i) => {
              const isRed = s.r < -0.4 || s.tipo === 'Alerta Técnico' || s.tipo === 'Alerta Físico'
              return (
                <div key={i} className="rounded-xl border p-4 flex items-start gap-4"
                  style={{background: isRed ? '#fef2f2' : '#fffbeb', borderColor: isRed ? '#fecaca' : '#fde68a'}}>
                  <span className="text-xl flex-shrink-0">{isRed ? '🔴' : '🟡'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-gray-800">{s.gpsLabel} × {s.perfLabel}
                      <span className="ml-2 font-normal" style={{color:rColor(s.r)}}>r {s.r>0?'+':''}{s.r}</span>
                    </p>
                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed">
                      {genActionable(s.gpsKey, s.perfKey, s.r).cuidado}
                    </p>
                    <p className="text-[8px] text-gray-400 mt-1">{s.tipo}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ 7. RESULTADOS DA NAVEGAÇÃO POR PERGUNTA ═════════════════════════ */}
      {navQ !== 'todos' && (
        <div className="space-y-3">
          <p className="bc text-base font-black uppercase text-gray-700">{navQ_obj.icon} {navQ_obj.label}</p>
          {rankFiltered.length === 0 ? (
            <div className="bg-gray-50 rounded-xl px-4 py-8 text-center">
              <p className="text-[10px] text-gray-400">Nenhum padrão encontrado para esse filtro com os dados atuais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rankFiltered.slice(0, 6).map((s, i) => <ActionableCard key={i} s={s} />)}
            </div>
          )}
        </div>
      )}

      {/* ═══ 8. PADRÕES POR POSIÇÃO ══════════════════════════════════════════ */}
      {posPatterns.length > 0 && navQ === 'todos' && (
        <div className="space-y-3">
          <p className="bc text-base font-black uppercase text-gray-700">📐 Padrões por Posição</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posPatterns.map(pp => (
              <div key={pp.pos} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 flex items-center gap-2" style={{background:pp.color}}>
                  <span className="bc text-sm font-black text-white uppercase tracking-wider">{pp.label}</span>
                  <span className="text-[8px] text-white/70 ml-auto">n={pp.n}</span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Top correlations */}
                  {[pp.top, pp.second].filter(Boolean).map((t, ti) => (
                    <div key={ti} className="rounded-xl p-3" style={{background:rBg(t.r), border:`1px solid ${rColor(t.r)}30`}}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-black text-gray-700 leading-tight">{t.gpsLabel} × {t.perfLabel}</p>
                        <div className="text-right ml-2 flex-shrink-0">
                          <p className="text-sm font-black" style={{color:rColor(t.r)}}>{t.r>0?'+':''}{t.r}{t.sig?' ★':''}</p>
                          <p className="text-[7px] text-gray-400">r²={t.r2?.toFixed(2)}</p>
                        </div>
                      </div>
                      <p className="text-[8px] text-gray-500">{genInterpretation(t.gpsKey, t.perfKey, t.r)}</p>
                    </div>
                  ))}
                  {/* Intelligence block */}
                  {pp.intel && (
                    <div className="rounded-xl p-3 space-y-2" style={{background:pp.color+'10', border:`1px solid ${pp.color}30`}}>
                      <div>
                        <p className="text-[7px] font-black uppercase tracking-widest mb-0.5" style={{color:pp.color}}>Padrão Dominante</p>
                        <p className="text-[8px] text-gray-700">{pp.intel.padrao}</p>
                      </div>
                      <div>
                        <p className="text-[7px] font-black uppercase tracking-widest mb-0.5" style={{color:pp.color}}>Leitura</p>
                        <p className="text-[8px] text-gray-600">{pp.intel.leitura}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[7px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Alerta</p>
                          <p className="text-[7px] text-gray-500">{pp.intel.alerta}</p>
                        </div>
                        <div>
                          <p className="text-[7px] font-black uppercase tracking-widest text-sky-600 mb-0.5">Aplicação</p>
                          <p className="text-[7px] text-gray-500">{pp.intel.aplicacao}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!pp.top && <p className="text-[9px] text-gray-400 text-center py-2">Sem padrões relevantes ainda</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 9. APLICAÇÕES PARA TREINO ═══════════════════════════════════════ */}
      {navQ === 'todos' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <p className="bc text-base font-black uppercase text-gray-700">💪 Aplicações para o Treino</p>
            <span className="text-[7px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">baseado nos padrões do banco</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {[
              { icon:'⚔️', titulo:'Duelos sob alta intensidade', texto:'Como HSR e acelerações se conectam com duelos, criar tarefas com deslocamento prévio antes da disputa. Qualidade do duelo precisa superar o volume.' },
              { icon:'🎯', titulo:'Precisão sob fadiga', texto:'Se maior distância se relaciona com queda de precisão, inserir blocos técnicos após sessões de alta carga para treinar tomada de decisão sob estresse.' },
              { icon:'⚡', titulo:'Sprint útil vs sprint de perseguição', texto:'Se sprint se conecta com desempenho positivo, qualificar quando esse sprint gera ação ofensiva real — não só esforço reativo de cobertura.' },
              { icon:'🔄', titulo:'Desaceleração e posicionamento defensivo', texto:'Se desacelerações aparecem ligadas a duelos defensivos e intercepções, monitorar mudança de direção e frenagem nas tarefas de pressão e cobertura.' },
            ].map((item, i) => (
              <div key={i} className="px-5 py-4 flex gap-3 border-b border-r border-gray-100">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-[9px] font-black text-gray-800 mb-1">{item.titulo}</p>
                  <p className="text-[8px] text-gray-500 leading-relaxed">{item.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 10. APLICAÇÕES PARA MERCADO ═════════════════════════════════════ */}
      {navQ === 'todos' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <p className="bc text-base font-black uppercase text-gray-700">🔍 Perfil Físico-Funcional por Posição</p>
            <span className="text-[7px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">scouting baseado nos padrões internos</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
            {[
              { pos:'Zagueiro', color:'#0ea5e9', itens:['Capacidade de HSR defensivo','Volume e eficiência em duelos','Precisão sob demanda física','Participação na progressão'] },
              { pos:'Volante', color:'#f59e0b', itens:['Aceleração e desaceleração','Interceptação e cobertura','Sustentação de duelos no jogo','Mobilidade curta intensa'] },
              { pos:'Lateral', color:'#8b5cf6', itens:['Distância e sprints em dois lados','Duelos nas duas fases','Participação ofensiva e defensiva','Equilíbrio físico-técnico'] },
              { pos:'Atacante', color:'#ef4444', itens:['Sprint útil com ação ofensiva','HSR com finalização','Duelos ofensivos ganhos','Técnica mantida sob intensidade'] },
            ].map((item, i) => (
              <div key={i} className="px-4 py-4 border-r border-b border-gray-100">
                <p className="bc text-sm font-black uppercase mb-2" style={{color:item.color}}>{item.pos}</p>
                <div className="space-y-1">
                  {item.itens.map((it, j) => (
                    <div key={j} className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{background:item.color}} />
                      <p className="text-[8px] text-gray-600">{it}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 11. RANKING COMPLETO ════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Ranking Completo de Correlações</p>
              <p className="text-[7px] text-gray-400 mt-0.5">{rankFiltered.length} pares · ★ = p &lt; .05</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Filtros */}
              <div className="flex gap-1 flex-wrap">
                {[
                  {id:'todos',      label:'Todos'},
                  {id:'positivas',  label:'Positivas'},
                  {id:'negativas',  label:'Negativas'},
                  {id:'alertas',    label:'Alertas'},
                  {id:'eficiencia', label:'Eficiência'},
                ].map(f => (
                  <button key={f.id} onClick={() => setRankFilter(f.id)}
                    className="px-2.5 py-1 rounded-lg text-[7px] font-black"
                    style={rankFilter===f.id ? {background:G.verde, color:'#fff'} : {background:'#f1f5f9', color:'#64748b'}}>
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Toggles */}
              <div className="flex gap-2 items-center">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={onlySig} onChange={e => setOnlySig(e.target.checked)} className="w-3 h-3 accent-sky-700" />
                  <span className="text-[7px] font-black text-gray-500">Só sig.</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={excludeObv} onChange={e => setExcludeObv(e.target.checked)} className="w-3 h-3 accent-sky-700" />
                  <span className="text-[7px] font-black text-gray-500">Excluir óbvias</span>
                </label>
                <select value={minR} onChange={e => setMinR(+e.target.value)}
                  className="text-[7px] font-black border border-gray-200 rounded-lg px-1.5 py-1 bg-white text-gray-500">
                  <option value={0}>|r| mínimo: qualquer</option>
                  <option value={0.3}>|r| ≥ 0.30</option>
                  <option value={0.4}>|r| ≥ 0.40</option>
                  <option value={0.6}>|r| ≥ 0.60</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-g">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['#','GPS (física)','Desempenho','r','r²','p','n','Sig.','Tipo','Utilidade','Prioridade','Interpretação'].map(h => (
                  <th key={h} className={`px-2.5 py-2.5 text-[7px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap
                    ${['#','GPS (física)','Desempenho','Interpretação'].includes(h)?'text-left':'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rankFiltered.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-[9px] text-gray-400">Nenhum resultado para esse filtro.</td></tr>
              ) : rankFiltered.map((s, i) => (
                <tr key={i} className={`border-b border-gray-50 ${s.sig?'bg-sky-50/30':i%2===0?'bg-white':'bg-gray-50/20'}`}>
                  <td className="px-2.5 py-2 text-gray-400 font-bold">{i+1}</td>
                  <td className="px-2.5 py-2 font-bold whitespace-nowrap" style={{borderLeft:`3px solid ${s.gpsColor}`,paddingLeft:8}}>{s.gpsLabel}</td>
                  <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{s.perfLabel}</td>
                  <td className="px-2.5 py-2 text-center font-black tabular-nums" style={{color:rColor(s.r)}}>{s.r>0?'+':''}{s.r}</td>
                  <td className="px-2.5 py-2 text-center text-gray-500 tabular-nums">{s.r2?.toFixed(3)}</td>
                  <td className="px-2.5 py-2 text-center tabular-nums text-[8px]" style={{color:s.sig?'#07579e':'#9ca3af'}}>{s.p}</td>
                  <td className="px-2.5 py-2 text-center text-gray-400">{s.n}</td>
                  <td className="px-2.5 py-2 text-center">{s.sig?<span className="font-black" style={{color:rColor(s.r)}}>★</span>:<span className="text-gray-300">—</span>}</td>
                  <td className="px-2.5 py-2 text-center">
                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{background:(s.color||'#64748b')+'20', color:(s.color||'#64748b')}}>{s.tipo}</span>
                  </td>
                  <td className="px-2.5 py-2 text-center">
                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{background: s.utility==='Óbvio'?'#f1f5f9':s.utility==='Útil'?'#f0fdf4':s.utility==='Alerta'?'#fef2f2':'#fefce8',
                              color:      s.utility==='Óbvio'?'#64748b':s.utility==='Útil'?'#07579e':s.utility==='Alerta'?'#dc2626':'#92400e'}}>
                      {s.utility}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-center">
                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{background: s.priority==='Alta'?'#fef2f2':s.priority==='Média'?'#fffbeb':'#f8fafc',
                              color:      s.priority==='Alta'?'#dc2626':s.priority==='Média'?'#92400e':'#64748b'}}>
                      {s.priority}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-gray-500 text-[8px] max-w-[200px]">{genInterpretation(s.gpsKey, s.perfKey, s.r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: COLETIVO (GPS time médio × Team Stats Wyscout)
// ═══════════════════════════════════════════════════════════════════════════════
function TabColetivo({ fullPartidas }) {
  const coletivo = useMemo(() => buildCollectiveDataset(fullPartidas), [fullPartidas])
  const [activeSx,    setActiveSx]    = useState('accel_p90')
  const [activeSy,    setActiveSy]    = useState('posse')
  const [filterRes,   setFilterRes]   = useState('Todos')
  const [filterMando, setFilterMando] = useState('Todos')

  const nWithTs = fullPartidas.filter(p => p.team_stats && Object.keys(p.team_stats).length > 2).length

  const filtered = useMemo(() => coletivo.filter(d => {
    if (filterRes   !== 'Todos' && d.resultado !== filterRes)   return false
    if (filterMando !== 'Todos' && d.mando     !== filterMando) return false
    return true
  }), [coletivo, filterRes, filterMando])

  // ── All correlations (GPS × TeamStats) with stats ─────────────────────────
  const allCorrs = useMemo(() => {
    if (filtered.length < 3) return []
    const out = []
    GPS_METRICS.forEach(gm => {
      TEAMSTATS_METRICS.forEach(tm => {
        const st = pearsonStats(filtered, gm.key, tm.key)
        if (st.r !== null) out.push({
          gpsKey:gm.key, gpsLabel:gm.label, gpsColor:gm.color,
          tsKey:tm.key,  tsLabel:tm.label, ...st
        })
      })
    })
    return out.sort((a,b) => Math.abs(b.r) - Math.abs(a.r))
  }, [filtered])

  const topPositive = allCorrs.filter(c => c.r > 0).slice(0, 5)
  const topNegative = allCorrs.filter(c => c.r < 0).slice(0, 5)

  const matrix = useMemo(() => GPS_METRICS.map(gm => ({
    gps: gm,
    tss: TEAMSTATS_METRICS.map(tm => ({
      ts: tm, stats: pearsonStats(filtered, gm.key, tm.key)
    }))
  })), [filtered])

  const scatter = useMemo(() => {
    const st  = pearsonStats(filtered, activeSx, activeSy)
    const gm  = GPS_METRICS.find(m => m.key === activeSx)
    const tm  = TEAMSTATS_METRICS.find(m => m.key === activeSy)
    const pts = filtered.map(d => ({
      ...d, _x: d[activeSx]||0, _y: d[activeSy]||0,
      fill: {V:'#07579e',E:'#ca8a04',D:'#dc2626'}[d.resultado] || G.purple,
    }))
    return { pts, ...st, xl:gm?.label||activeSx, yl:tm?.label||activeSy }
  }, [filtered, activeSx, activeSy])

  // ── Composite index: gps_index (normalized avg of 4 GPS metrics) ───────────
  const withIndex = useMemo(() => filtered.map(d => {
    const gpsVals = [d.dist_p90, d.hsr_p90, d.accel_p90, d.decel_p90].filter(v=>v>0)
    const gpsRaw  = gpsVals.length ? gpsVals.reduce((a,b)=>a+b,0)/gpsVals.length : 0
    const prodVals = [d.posse||0, (d.xg||0)*10, d.finalizacoes||0, d.passes_pct||0].filter(v=>v>0)
    const prodRaw  = prodVals.length ? prodVals.reduce((a,b)=>a+b,0)/prodVals.length : 0
    return { ...d, gps_index:gpsRaw, prod_index:prodRaw }
  }), [filtered])

  // medians for quadrant lines
  const medGps  = useMemo(() => {
    const s = [...withIndex].map(d=>d.gps_index).sort((a,b)=>a-b)
    return s.length ? s[Math.floor(s.length/2)] : 0
  }, [withIndex])
  const medProd = useMemo(() => {
    const s = [...withIndex].map(d=>d.prod_index).sort((a,b)=>a-b)
    return s.length ? s[Math.floor(s.length/2)] : 0
  }, [withIndex])

  // ── Auto insight text ──────────────────────────────────────────────────────
  const insightText = useMemo(() => {
    if (allCorrs.length === 0) return null
    const top     = allCorrs[0]
    const negTop  = allCorrs.find(c => c.r < 0)
    const hasJogo = filtered.length
    let txt = `Nos ${hasJogo} jogo(s) analisados, `
    if (top) {
      const dir = top.r > 0 ? 'positiva' : 'negativa'
      txt += `${top.gpsLabel} apresentou relação ${dir} com ${top.tsLabel} (r=${top.r>0?'+':''}${top.r}), `
      txt += top.r > 0
        ? 'sugerindo que jogos de maior demanda física nessa métrica coincidiram com maior performance nessa dimensão coletiva.'
        : 'sugerindo que jogos de maior exigência física coincidiram com menor performance nessa dimensão — possível padrão de perseguição ou jogo desgastante.'
    }
    if (negTop && top && negTop !== top) {
      txt += ` Por outro lado, ${negTop.gpsLabel} apresentou relação negativa com ${negTop.tsLabel} (r=${negTop.r}), `
      txt += 'indicando potencial queda de controle técnico-tático quando a exigência física aumenta.'
    }
    // Detect "chase game" pattern
    const negPosse = allCorrs.find(c => c.tsKey === 'posse' && c.r < -0.3)
    const negPasse = allCorrs.find(c => c.tsKey === 'passes_pct' && c.r < -0.3)
    if (negPosse && negPasse) {
      txt += ' O padrão de correlação negativa com posse e precisão de passe sugere que os jogos de maior volume físico podem estar associados a contextos de menor controle territorial — possível efeito de "jogo de perseguição".'
    }
    return txt
  }, [allCorrs, filtered])

  // ── Game-by-game auto observation ─────────────────────────────────────────
  function gameObs(d) {
    const ctrl = (d.posse||0)
    const prod = (d.xg||0)
    const exig = (d.hsr_p90||0)
    if (ctrl > 60 && prod > 2.0) return 'controle com alta produção'
    if (ctrl > 60 && prod <= 1.5) return 'controle sem conversão'
    if (ctrl < 45 && exig > 650) return 'alta exigência sem posse — possível perseguição'
    if (ctrl < 45 && prod > 2.0) return 'eficiência ofensiva com baixa posse'
    if (exig > 700)               return 'jogo de alta intensidade física'
    if (prod > 2.5)               return 'alta produção ofensiva'
    return 'padrão equilibrado'
  }

  if (!nWithTs) return (
    <div className="space-y-4">
      <EmptyState icon="🏟️" title="Nenhuma partida com Team Stats"
        sub="No wizard de upload (Step 4), adicione o Excel de Team Stats do Wyscout para habilitar a análise coletiva." />
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
        <p className="text-[10px] text-purple-700">
          <strong>Como exportar:</strong> Wyscout → Competição → seu jogo → Team Statistics → Export Excel.
        </p>
      </div>
    </div>
  )

  if (coletivo.length < 2) return (
    <EmptyState icon="🏟️" title="Dados insuficientes"
      sub={`${nWithTs} jogo(s) com Team Stats, mas precisa de ao menos 2 para calcular correlações.`} />
  )

  const RES_COLORS = {V:'#0a66b7',E:'#ca8a04',D:'#dc2626'}

  return (
    <div className="space-y-5 fade-in">

      {/* ══ 1. HEADER + FILTROS ════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5" style={{background:'linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)'}}>
          <p className="text-purple-200 text-[8px] font-black uppercase tracking-widest mb-1">Análise Coletiva</p>
          <h2 className="bc text-3xl font-black uppercase text-white leading-none">GPS Médio × Team Stats</h2>
          <p className="text-purple-200 text-[10px] mt-1">Cada jogo = 1 ponto · GPS = média p90 do elenco (excl. goleiros)</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-5 items-end border-b border-gray-100">
          {/* KPIs */}
          <div className="flex gap-3">
            {[
              { label:'Jogos',       val:coletivo.length,     color:G.purple },
              { label:'Vitórias',    val:coletivo.filter(d=>d.resultado==='V').length, color:'#0a66b7' },
              { label:'Empates',     val:coletivo.filter(d=>d.resultado==='E').length, color:G.amber  },
              { label:'Derrotas',    val:coletivo.filter(d=>d.resultado==='D').length, color:G.red    },
              { label:'Filtrados',   val:filtered.length, color:'#64748b' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-xl px-3 py-2 text-center border border-gray-100">
                <p className="text-[7px] font-black uppercase text-gray-400">{k.label}</p>
                <p className="bc text-lg font-black" style={{color:k.color}}>{k.val}</p>
              </div>
            ))}
          </div>
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div>
              <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Resultado</p>
              <div className="flex gap-1">
                {['Todos','V','E','D'].map(r => (
                  <button key={r} onClick={()=>setFilterRes(r)}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black ${filterRes===r?'text-white':'bg-gray-100 text-gray-500'}`}
                    style={filterRes===r?{background:RES_COLORS[r]||'#374151'}:{}}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Mando</p>
              <div className="flex gap-1">
                {['Todos','casa','fora'].map(m => (
                  <button key={m} onClick={()=>setFilterMando(m)}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black capitalize ${filterMando===m?'text-white bg-gray-700':'bg-gray-100 text-gray-500'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {filtered.length < 5 && (
            <div className="ml-auto bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <p className="text-[8px] text-amber-700 font-bold">⚠️ Amostra pequena ({filtered.length} jogos) — interprete como tendência inicial</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ 2. INSIGHT EXECUTIVO COLETIVO ═════════════════════════════════════ */}
      {insightText && (
        <div className="bg-white rounded-2xl border-l-4 border-purple-500 border border-purple-100 shadow-sm p-5">
          <p className="text-[8px] font-black uppercase tracking-widest text-purple-600 mb-2">💡 Resumo Executivo Coletivo</p>
          <p className="text-[11px] text-gray-700 leading-relaxed">{insightText}</p>
        </div>
      )}

      {/* ══ 3. PADRÕES POSITIVOS / NEGATIVOS ══════════════════════════════════ */}
      {allCorrs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Positivos */}
          <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-5">
            <p className="bc text-sm font-black uppercase text-sky-700 mb-3">📈 Maiores Relações Positivas</p>
            <div className="space-y-2">
              {topPositive.map((c,i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl p-2.5"
                  style={{background:rBg(c.r), border:`1px solid ${rColor(c.r)}30`}}>
                  <div className="text-center flex-shrink-0 min-w-[44px]">
                    <p className="bc text-xl font-black leading-none" style={{color:rColor(c.r)}}>+{c.r.toFixed(2)}{c.sig?' ★':''}</p>
                    <p className="text-[7px] text-gray-400">r²={c.r2?.toFixed(2)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-gray-800 leading-tight">{c.gpsLabel} × {c.tsLabel}</p>
                    <p className="text-[8px] text-gray-500 mt-0.5">
                      {genInterpretation(c.gpsKey, c.tsKey, c.r, true)}
                    </p>
                  </div>
                </div>
              ))}
              {topPositive.length === 0 && <p className="text-[9px] text-gray-400">Nenhuma relação positiva relevante ainda.</p>}
            </div>
          </div>

          {/* Negativos */}
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
            <p className="bc text-sm font-black uppercase text-red-600 mb-3">📉 Maiores Relações Negativas</p>
            <div className="space-y-2">
              {topNegative.map((c,i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl p-2.5"
                  style={{background:rBg(c.r), border:`1px solid ${rColor(c.r)}30`}}>
                  <div className="text-center flex-shrink-0 min-w-[44px]">
                    <p className="bc text-xl font-black leading-none" style={{color:rColor(c.r)}}>{c.r.toFixed(2)}{c.sig?' ★':''}</p>
                    <p className="text-[7px] text-gray-400">r²={c.r2?.toFixed(2)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-gray-800 leading-tight">{c.gpsLabel} × {c.tsLabel}</p>
                    <p className="text-[8px] text-gray-500 mt-0.5">
                      {genInterpretation(c.gpsKey, c.tsKey, c.r, true)}
                    </p>
                  </div>
                </div>
              ))}
              {topNegative.length === 0 && <p className="text-[9px] text-gray-400">Nenhuma relação negativa relevante ainda.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ══ 4. QUADRANTE EXIGÊNCIA × PRODUÇÃO ═════════════════════════════════ */}
      {withIndex.length >= 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="bc text-base font-black uppercase text-gray-900">Quadrante: Exigência Física × Produção Coletiva</p>
              <p className="text-[9px] text-gray-400">
                Exigência = média de dist p90, HSR, Acel., Desacel. · Produção = média composta de posse, xG×10, finalizações, precisão passes
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[8px]">
              {[
                { q:'Q1 🟢', label:'Alta exigência + Alta produção', color:'#dcfce7' },
                { q:'Q2 🔵', label:'Baixa exigência + Alta produção', color:'#dbeafe' },
                { q:'Q3 🔴', label:'Alta exigência + Baixa produção', color:'#fee2e2' },
                { q:'Q4 ⚪', label:'Baixa exigência + Baixa produção', color:'#f3f4f6' },
              ].map(q => (
                <div key={q.q} className="rounded-lg px-2 py-1.5 font-bold text-gray-600" style={{background:q.color}}>
                  <span className="font-black">{q.q}</span> {q.label}
                </div>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{top:10,right:20,bottom:24,left:10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="gps_index" type="number"
                  label={{value:'Índice de Exigência Física', position:'insideBottom', offset:-14, fontSize:8, fill:'#94a3b8'}}
                  tick={{fontSize:8,fill:'#94a3b8'}} />
                <YAxis dataKey="prod_index" type="number"
                  label={{value:'Índice de Produção', angle:-90, position:'insideLeft', offset:8, fontSize:8, fill:'#94a3b8'}}
                  tick={{fontSize:8,fill:'#94a3b8'}} />
                <ZAxis range={[55,55]} />
                <ReferenceLine x={medGps}  stroke="#94a3b8" strokeDasharray="3 2" strokeWidth={1.5} />
                <ReferenceLine y={medProd} stroke="#94a3b8" strokeDasharray="3 2" strokeWidth={1.5} />
                <Tooltip content={({active,payload}) => {
                  if (!active||!payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                      <p className="font-black text-gray-900">vs {d?.adversario}</p>
                      <p className="text-gray-400 text-[9px]">{d?.resultado} · {d?.mando}</p>
                      <p className="mt-1 text-[9px]">{gameObs(d)}</p>
                    </div>
                  )
                }} />
                <Scatter data={withIndex}
                  shape={({cx,cy,payload}) => (
                    <circle cx={cx} cy={cy} r={8}
                      fill={RES_COLORS[payload?.resultado]||G.purple}
                      fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                  )} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 justify-center text-[9px]">
            {[['#0a66b7','Vitória'],['#ca8a04','Empate'],['#dc2626','Derrota']].map(([c,l])=>(
              <span key={l} className="flex items-center gap-1.5 font-bold text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══ 5. TABELA JOGO A JOGO COM LEITURA AUTOMÁTICA ══════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Banco Coletivo — Jogo a Jogo ({filtered.length} partidas)</p>
        </div>
        <div className="overflow-x-auto scrollbar-g">
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{background:'#1f2937'}}>
                {['Jogo','Res.','Mando','Dist p90','HSR p90','Acel.','Posse','Finaliz.','xG','Passes%','Recuper.','Leitura Automática'].map(h=>(
                  <th key={h} className="px-2 py-2.5 text-left text-[8px] font-black uppercase text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d,i) => {
                const resCfg = {V:{color:'#07579e',bg:'#dcfce7'},E:{color:'#854d0e',bg:'#fef9c3'},D:{color:'#991b1b',bg:'#fee2e2'}}[d.resultado]||{color:'#6b7280',bg:'#f3f4f6'}
                return (
                  <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/30'} row-hover`}>
                    <td className="px-2 py-2.5 font-bold text-gray-700 whitespace-nowrap">vs {d.adversario}</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-black" style={{background:resCfg.bg,color:resCfg.color}}>
                        {d.resultado}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-gray-400 capitalize">{d.mando||'—'}</td>
                    <td className="px-2 py-2.5 text-gray-600">{d.dist_p90>=1000?`${(d.dist_p90/1000).toFixed(1)}k`:d.dist_p90||'—'}</td>
                    <td className="px-2 py-2.5 font-bold" style={{color:d.hsr_p90>800?G.verde:d.hsr_p90>400?G.amber:G.slate}}>{d.hsr_p90||'—'}</td>
                    <td className="px-2 py-2.5" style={{color:d.accel_p90>30?G.verde:G.slate}}>{d.accel_p90?.toFixed(1)||'—'}</td>
                    <td className="px-2 py-2.5 font-bold" style={{color:d.posse>55?G.verde:d.posse>44?G.amber:G.red}}>{d.posse>0?`${d.posse.toFixed(0)}%`:'—'}</td>
                    <td className="px-2 py-2.5 text-gray-600">{d.finalizacoes||'—'}</td>
                    <td className="px-2 py-2.5 font-bold" style={{color:d.xg>1.8?G.verde:d.xg>1.0?G.amber:G.red}}>{d.xg>0?d.xg.toFixed(2):'—'}</td>
                    <td className="px-2 py-2.5 font-bold" style={{color:d.passes_pct>82?G.verde:d.passes_pct>74?G.amber:G.red}}>{d.passes_pct>0?`${d.passes_pct.toFixed(0)}%`:'—'}</td>
                    <td className="px-2 py-2.5 text-gray-600">{d.recuperacoes||'—'}</td>
                    <td className="px-2 py-2.5 max-w-[200px]">
                      <span className="inline-block text-[8px] text-gray-500 italic leading-tight">{gameObs(d)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ 6. MATRIZ DE CORRELAÇÃO COLETIVA ══════════════════════════════════ */}
      {filtered.length >= 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div>
              <h3 className="bc text-base font-black uppercase text-gray-900">Matriz de Correlação — Coletivo</h3>
              <p className="text-[9px] text-gray-400">Pearson r · GPS médio × Team Stats · {filtered.length} jogos · ★ = p&lt;.05 · clique na célula → scatter</p>
            </div>
            <div className="flex gap-2 text-[8px] items-center">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-200 inline-block"/>pos. forte</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 inline-block"/>neg. forte</span>
              <span className="flex items-center gap-1 text-gray-400">★ p&lt;.05</span>
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-g mt-3">
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="text-left text-gray-400 font-black text-[9px] uppercase pb-3 pr-4 w-36">GPS Médio \ Team Stat</th>
                  {TEAMSTATS_METRICS.map(tm => (
                    <th key={tm.key} className="text-center text-gray-400 font-black text-[8px] uppercase pb-3 px-1 min-w-[85px] whitespace-nowrap">{tm.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, ri) => (
                  <tr key={row.gps.key} className={ri%2===0?'bg-gray-50/50':''}>
                    <td className="py-2 pr-4 font-bold text-gray-700 text-[10px] whitespace-nowrap"
                      style={{borderLeft:`3px solid ${row.gps.color}`,paddingLeft:8}}>
                      {row.gps.label}
                    </td>
                    {row.tss.map(cell => {
                      const { r, r2, p, sig, n } = cell.stats
                      const icon = r===null ? '—' : Math.abs(r)>=0.5 ? (r>0?'🟢':'🔴') : Math.abs(r)>=0.3 ? '⚠️' : '⚪'
                      return (
                        <td key={cell.ts.key} className="py-1.5 px-1 text-center">
                          <button
                            onClick={() => { setActiveSx(row.gps.key); setActiveSy(cell.ts.key) }}
                            title={r!==null?`r²=${r2} · p=${p} · n=${n}${sig?' · ★ p<.05':''}`:'n < 3'}
                            className="w-full rounded-lg pt-1.5 pb-1 px-1 font-black transition-all hover:scale-105"
                            style={{background:rBg(r), color:rColor(r)}}>
                            <div className="text-[8px] leading-none mb-0.5">{icon}</div>
                            <div className="text-[11px] leading-tight font-black">
                              {r!==null ? `${r>0?'+':''}${r}${sig?' ★':''}` : '—'}
                            </div>
                            {r2!=null && <div className="text-[7px] opacity-70 leading-tight mt-0.5">r²={r2.toFixed(2)}</div>}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ 7. SCATTER COLETIVO CONFIGURÁVEL ══════════════════════════════════ */}
      {filtered.length >= 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div>
              <h3 className="bc text-base font-black uppercase text-gray-900">Scatter Coletivo</h3>
              <p className="text-[9px] text-gray-400">Cada ponto = 1 jogo · cor = resultado</p>
            </div>
            <div className="text-center">
              <p className="text-[7px] text-gray-400 uppercase">r</p>
              <p className="text-xl font-black" style={{color:rColor(scatter.r)}}>
                {scatter.r!==null?`${scatter.r>0?'+':''}${scatter.r}${scatter.sig?' ★':''}`:'—'}
              </p>
              {scatter.r2!=null && <p className="text-[7px] text-gray-400">r²={scatter.r2.toFixed(2)} · {scatter.sig?'p<.05':'p='+scatter.p}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[7px] font-black uppercase text-gray-400 block mb-1">GPS Médio (X)</label>
              <select value={activeSx} onChange={e=>setActiveSx(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-purple-400">
                {GPS_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[7px] font-black uppercase text-gray-400 block mb-1">Team Stat (Y)</label>
              <select value={activeSy} onChange={e=>setActiveSy(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-[10px] font-bold bg-gray-50 focus:outline-none focus:border-purple-400">
                {TEAMSTATS_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{top:10,right:20,bottom:24,left:10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="_x" type="number"
                  label={{value:scatter.xl, position:'insideBottom', offset:-14, fontSize:8, fill:'#94a3b8'}}
                  tick={{fontSize:8,fill:'#94a3b8'}} />
                <YAxis dataKey="_y" type="number"
                  label={{value:scatter.yl, angle:-90, position:'insideLeft', offset:8, fontSize:8, fill:'#94a3b8'}}
                  tick={{fontSize:8,fill:'#94a3b8'}} />
                <ZAxis range={[55,55]} />
                <Tooltip content={({active,payload}) => {
                  if (!active||!payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                      <p className="font-black text-gray-900">vs {d?.adversario}</p>
                      <p className="text-gray-400 text-[9px]">{d?.resultado} · {d?.mando}</p>
                      <p className="mt-1"><span className="text-gray-400">{scatter.xl}:</span> <b>{d?._x?.toFixed(1)}</b></p>
                      <p><span className="text-gray-400">{scatter.yl}:</span> <b>{d?._y?.toFixed(1)}</b></p>
                      <p className="text-[8px] italic text-gray-400 mt-1">{gameObs(d)}</p>
                    </div>
                  )
                }} />
                <Scatter data={scatter.pts}
                  shape={({cx,cy,payload}) => (
                    <circle cx={cx} cy={cy} r={7}
                      fill={payload?.fill || G.purple}
                      fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                  )} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 justify-center text-[9px]">
            {[['#0a66b7','Vitória'],['#ca8a04','Empate'],['#dc2626','Derrota']].map(([c,l])=>(
              <span key={l} className="flex items-center gap-1.5 font-bold text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══ 8. PADRÕES AUTOMÁTICOS ════════════════════════════════════════════ */}
      {allCorrs.filter(c => Math.abs(c.r) >= 0.3).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="bc text-base font-black uppercase text-gray-900 mb-4">🧠 Padrões Coletivos da Temporada</p>
          <div className="space-y-2">
            {allCorrs.filter(c => Math.abs(c.r) >= 0.3).slice(0, 8).map((c,i) => {
              const icon = c.r >= 0.5 ? '🟢' : c.r <= -0.5 ? '🔴' : c.r > 0 ? '🔵' : '🟡'
              const label = `${c.gpsLabel} teve relação ${c.r>0?'positiva':'negativa'} ${Math.abs(c.r)>=0.5?'forte':Math.abs(c.r)>=0.35?'moderada':'fraca'} com ${c.tsLabel} (r=${c.r>0?'+':''}${c.r}${c.sig?' ★':''}).`
              const interp = genInterpretation(c.gpsKey, c.tsKey, c.r, true)
              return (
                <div key={i} className="flex gap-3 items-start rounded-xl px-3 py-2.5 border"
                  style={{background:rBg(c.r), borderColor:rColor(c.r)+'25'}}>
                  <span className="flex-shrink-0 mt-0.5">{icon}</span>
                  <p className="text-[10px] text-gray-700 leading-relaxed">
                    <span className="font-bold">{label}</span> {interp}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── SPEARMAN CORRELATION ──────────────────────────────────────────────────────
function _ranks(arr) {
  const sorted = [...arr].map((v,i) => ({v,i})).sort((a,b) => a.v - b.v)
  const ranks = new Array(arr.length)
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length - 1 && sorted[j+1].v === sorted[j].v) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avg
    i = j + 1
  }
  return ranks
}
function spearmanR(arr, kx, ky) {
  const valid = arr.filter(d => d[kx]!=null && d[ky]!=null && !isNaN(+d[kx]) && !isNaN(+d[ky]))
  if (valid.length < 3) return { r:null, r2:null, p:null, n:valid.length, sig:false }
  const xs = _ranks(valid.map(d => +d[kx]))
  const ys = _ranks(valid.map(d => +d[ky]))
  const n  = valid.length
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n
  const cov = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)
  const sx  = Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0))
  const sy  = Math.sqrt(ys.reduce((s,y)=>s+(y-my)**2,0))
  if (!sx||!sy) return { r:null, r2:null, p:null, n, sig:false }
  const r   = Math.max(-1, Math.min(1, cov/(sx*sy)))
  const r2  = r*r
  const tSt = r * Math.sqrt(n-2) / Math.sqrt(Math.max(1e-10, 1-r2))
  const p   = pearsonStats([...valid.map((_,i)=>({_x:xs[i],_y:ys[i]}))], '_x', '_y').p
  return { r:+r.toFixed(2), r2:+r2.toFixed(3), p:+(p||0).toFixed(4), n, sig:(p||1)<0.05 }
}

// ─── PLACAR PARSER ─────────────────────────────────────────────────────────────
function parsePlacar(placar, mando, resultado) {
  // Format stored: always "HomeGoals x AwayGoals"
  // Confiança = home when mando='casa', away when mando='fora'
  const m = String(placar||'').match(/(\d+)\s*[xX×]\s*(\d+)/)
  if (!m) return { golsPro:0, golsContra:0, saldo:0 }
  const [home, away] = [parseInt(m[1]), parseInt(m[2])]
  const isCasa = (mando||'').toLowerCase() === 'casa'
  let golsPro    = isCasa ? home : away
  let golsContra = isCasa ? away : home
  // Sanity-check against resultado: if V but saldo<=0, or D but saldo>=0, flip
  const res = (resultado||'E').toUpperCase()
  const saldo = golsPro - golsContra
  if (res === 'V' && saldo <= 0 && (home !== away)) { golsPro = isCasa ? away : home; golsContra = isCasa ? home : away }
  if (res === 'D' && saldo >= 0 && (home !== away)) { golsPro = isCasa ? away : home; golsContra = isCasa ? home : away }
  return { golsPro, golsContra, saldo: golsPro - golsContra }
}

function buildResultadoDataset(fullPartidas) {
  return fullPartidas
    .filter(p => p.gps_status === 'ok' && p.wyscout_status === 'ok')
    .map(p => {
      const gpsRows = (p.gps_rows||[]).filter(r => !isGK(r))
      if (!gpsRows.length) return null
      const n = gpsRows.length
      const teamGps = {}
      GPS_METRICS.forEach(m => {
        const raw  = { dist_p90:'totalDistance', hsr_p90:'dist20', sprint_p90:'dist25', sprints_p90:'sprints', accel_p90:'accel', decel_p90:'decel' }[m.key]
        const vals = gpsRows.map(r => {
          const min = Math.max(_parseDuration(r.duration), 1)
          return (num(r[raw]||0)) * (90/min)
        }).filter(v => v > 0)
        teamGps[m.key] = vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : 0
      })
      const { golsPro, golsContra, saldo } = parsePlacar(p.placar, p.mando, p.resultado)
      const pontos = p.resultado === 'V' ? 3 : p.resultado === 'E' ? 1 : 0
      const ts = p.team_stats || {}
      const xg   = ts.xg || 0
      const fins = ts.finalizacoes || 0
      return {
        partida_id:    p.id,
        adversario:    p.adversario || '?',
        data_jogo:     p.data_jogo  || '',
        resultado:     p.resultado  || 'E',
        mando:         p.mando      || '',
        placar:        p.placar     || '',
        pontos, golsPro, golsContra, saldo,
        n_atletas:    n,
        ...teamGps,
        posse:         ts.posse       || 0,
        xg,
        finalizacoes:  fins,
        xg_per_fin:    fins > 0 ? +(xg / fins).toFixed(3) : 0,
        passes_pct:    ts.passes_pct  || 0,
        recuperacoes:  ts.recuperacoes || 0,
        perdas:        ts.perdas      || 0,
        duelos_pct:    ts.duelos_pct  || 0,
        // composite physical index — normalized to ~0-10 range for chart readability
        gps_index: +(
          (teamGps.hsr_p90||0) / 100 * 0.4 +
          (teamGps.sprint_p90||0) / 50 * 0.3 +
          (teamGps.accel_p90||0) / 5  * 0.2 +
          (teamGps.decel_p90||0) / 7  * 0.1
        ).toFixed(2),
      }
    })
    .filter(Boolean)
}

// Individual dataset enriched with resultado
function buildIndivResultado(fullPartidas) {
  const hist = buildHistoricalDataset(fullPartidas)
  return hist.map(d => {
    const p = fullPartidas.find(p => String(p.id) === String(d.partida_id))
    const pontos = p?.resultado === 'V' ? 3 : p?.resultado === 'E' ? 1 : 0
    const { saldo } = parsePlacar(p?.placar, p?.mando, p?.resultado)
    return { ...d, pontos, saldo, venceu: pontos === 3 ? 1 : 0, resultado: p?.resultado||'E' }
  })
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: RESULTADO — correlação com vitória/derrota/empate
// ═══════════════════════════════════════════════════════════════════════════════
function TabResultado({ fullPartidas }) {
  const [viewMode, setViewMode] = useState("coletivo")
  const [posFilter, setPosFilter] = useState("")
  const [minMinFilter, setMinMinFilter] = useState(30)

  const col   = useMemo(() => buildResultadoDataset(fullPartidas),  [fullPartidas])
  const indiv = useMemo(() => buildIndivResultado(fullPartidas),    [fullPartidas])

  const indivFiltered = useMemo(() =>
    indiv.filter(d => {
      if (d.min < minMinFilter) return false
      if (posFilter && d.pos !== posFilter) return false
      if (d.pos === "GOL") return false
      return true
    })
  , [indiv, posFilter, minMinFilter])

  // all collective metric columns
  const ALL_COLS = [
    ...GPS_METRICS.map(m => ({ key:m.key, label:m.label, color:m.color, group:"Físico" })),
    { key:"posse",       label:"Posse %",        color:"#7c3aed", group:"Controle" },
    { key:"xg",          label:"xG",             color:"#7c3aed", group:"Ataque"   },
    { key:"finalizacoes",label:"Finalizações",   color:"#7c3aed", group:"Ataque"   },
    { key:"xg_per_fin",  label:"xG / Finaliz.",  color:"#0ea5e9", group:"Eficiência"},
    { key:"passes_pct",  label:"Precisão Passe%",color:"#7c3aed", group:"Controle" },
    { key:"recuperacoes",label:"Recuperações",   color:"#0a66b7", group:"Defesa"   },
    { key:"perdas",      label:"Perdas",         color:"#dc2626", group:"Defesa"   },
  ]

  const colCorrs = useMemo(() => {
    if (col.length < 3) return []
    return ALL_COLS.map(m => ({
      ...m,
      pontos: spearmanR(col, m.key, "pontos"),
      saldo:  pearsonStats(col, m.key, "saldo"),
    })).filter(m => m.pontos.r !== null)
      .sort((a,b) => Math.abs(b.pontos.r) - Math.abs(a.pontos.r))
  }, [col])

  const colCorrsPositive = colCorrs.filter(c => c.pontos.r > 0)
  const colCorrsNegative = colCorrs.filter(c => c.pontos.r < 0)

  // per-result group averages
  const byResult = useMemo(() => {
    const groups = { V:[], E:[], D:[] }
    col.forEach(d => { if (groups[d.resultado]) groups[d.resultado].push(d) })
    const avg = (arr,key) => arr.length ? arr.reduce((s,d)=>s+(d[key]||0),0)/arr.length : null
    return ["V","E","D"].map(res => ({
      res, n: groups[res].length,
      dist:  avg(groups[res],"dist_p90"),
      hsr:   avg(groups[res],"hsr_p90"),
      accel: avg(groups[res],"accel_p90"),
      posse: avg(groups[res],"posse"),
      xg:    avg(groups[res],"xg"),
      xgFin: avg(groups[res],"xg_per_fin"),
      passes:avg(groups[res],"passes_pct"),
      recup: avg(groups[res],"recuperacoes"),
      perdas:avg(groups[res],"perdas"),
      gpIndex: avg(groups[res],"gps_index"),
    })).filter(r => r.n > 0)
  }, [col])

  // per-position individual correlations
  const POS_PERF_KEYS = {
    ATA: ["hsr_p90","sprint_p90","acoesW_pct","dribles_suc_pct","duelos_of_pct","remates_p90","passProgr_p90"],
    LAT: ["hsr_p90","sprint_p90","cruzamentos_pct","duelos_def_pct","interc_p90","acoesW_pct"],
    MC:  ["passesC_pct","passProgr_p90","acoesW_pct","interc_p90","hsr_p90","accel_p90"],
    VOL: ["duelos_def_pct","interc_p90","acoesW_pct","accel_p90","passesC_pct"],
    ZAG: ["duelos_def_pct","interc_p90","alivios_p90","passesC_pct","duelosW_pct","hsr_p90"],
  }

  const byPosCorrs = useMemo(() => {
    const result = {}
    Object.keys(POS_PERF_KEYS).forEach(pos => {
      const group = indiv.filter(d => d.pos === pos && d.min >= 30)
      if (group.length < 3) return
      const corrs = POS_PERF_KEYS[pos].map(k => {
        const pm = PERF_METRICS.find(m=>m.key===k) || { label:k }
        return { key:k, label:pm.label, ...spearmanR(group, k, "pontos") }
      }).filter(c => c.r !== null).sort((a,b) => Math.abs(b.r)-Math.abs(a.r))
      result[pos] = { corrs, n: group.length }
    })
    return result
  }, [indiv])

  // players performing best in wins
  const byPlayer = useMemo(() => {
    const map = {}
    indiv.filter(d => d.pos !== "GOL" && d.min >= 20).forEach(d => {
      if (!map[d.nome]) map[d.nome] = { nome:d.nome, pos:d.pos, V:[], E:[], D:[] }
      if (map[d.nome][d.resultado]) map[d.nome][d.resultado].push(d)
    })
    return Object.values(map)
      .filter(p => p.V.length > 0)
      .map(p => {
        const avgF = (arr,k) => arr.length ? arr.reduce((s,d)=>s+(d[k]||0),0)/arr.length : null
        const vHsr  = avgF(p.V,"hsr_p90"),   oHsr  = avgF([...p.E,...p.D],"hsr_p90")
        const vAcao = avgF(p.V,"acoesW_pct"), oAcao = avgF([...p.E,...p.D],"acoesW_pct")
        const vInterc = avgF(p.V,"interc_p90")
        const lift = oHsr && vHsr ? ((vHsr - oHsr)/oHsr*100) : null
        return { ...p, vHsr, oHsr, vAcao, oAcao, vInterc, lift, jogos: p.V.length+p.E.length+p.D.length }
      })
      .sort((a,b) => (b.lift||0) - (a.lift||0))
  }, [indiv])

  // auto insight
  const insight = useMemo(() => {
    if (!col.length) return null
    const pts = col.reduce((s,d)=>s+d.pontos,0)
    const max = col.length * 3
    const topPos = colCorrsPositive[0]
    const topNeg = colCorrsNegative[0]
    const vGames = col.filter(d=>d.resultado==="V")
    const eGames = col.filter(d=>d.resultado==="E")
    const avg = (arr,k) => arr.length ? arr.reduce((s,d)=>s+(d[k]||0),0)/arr.length : 0
    const hasPosse = topNeg?.key === 'posse'
    const hasSprint = topPos?.key?.includes('sprint') || topPos?.key?.includes('hsr')
    let txt = `Em ${col.length} jogo(s), o Confiança somou ${pts}/${max} pontos (${Math.round(pts/max*100)}% de aproveitamento). `
    if (hasSprint && hasPosse) {
      txt += `O melhor aproveitamento esteve mais associado a ações de alta intensidade e menor dependência de posse. A relação positiva entre ${topPos.label} e pontuação sugere que os melhores resultados apareceram em jogos com maior capacidade de atacar espaços e sustentar profundidade. Já a relação negativa com posse indica que ter mais a bola, isoladamente, não garantiu melhor resultado — podendo representar posse menos agressiva ou controle sem eficiência ofensiva.`
    } else if (topPos) {
      txt += `A variável mais associada à pontuação foi ${topPos.label} (ρ=+${topPos.pontos.r}). `
      if (topNeg) txt += `Por outro lado, ${topNeg.label} apresentou relação negativa (ρ=${topNeg.pontos.r}), aparecendo mais nos jogos de menor pontuação.`
    }
    if (vGames.length > 0 && eGames.length > 0) {
      const vXg = avg(vGames,'xg'), eXg = avg(eGames,'xg')
      const vXgFin = avg(vGames,'xg_per_fin'), eXgFin = avg(eGames,'xg_per_fin')
      if (vXgFin > eXgFin) txt += ` Nas vitórias, o xG por finalização foi ${vXgFin.toFixed(3)} vs ${eXgFin.toFixed(3)} nos empates — maior eficiência ofensiva por chegada nos jogos vencidos.`
    }
    return txt
  }, [col, colCorrsPositive, colCorrsNegative])

  // game profile
  function gameProfile(d) {
    const ctrl = d.posse || 50
    const prod = d.xg || 0
    const exig = d.hsr_p90 || 0
    const fin  = d.finalizacoes || 0
    const xgFin = d.xg_per_fin || 0
    if (d.resultado==="V" && ctrl < 50 && prod > 1.8 && xgFin > 0.12) return { label:"Vitória eficiente",   icon:"🟢", color:"#07579e", bg:"#dcfce7" }
    if (d.resultado==="V" && ctrl >= 55 && d.passes_pct > 80)           return { label:"Vitória controlada",  icon:"🟢", color:"#0a66b7", bg:"#f0fdf4" }
    if (d.resultado==="V" && exig > 700)                                 return { label:"Vitória intensa",     icon:"🟢", color:"#07579e", bg:"#dcfce7" }
    if (d.resultado==="V")                                               return { label:"Vitória",             icon:"🟢", color:"#0a66b7", bg:"#f0fdf4" }
    if (d.resultado==="E" && ctrl > 60 && prod < 1.5)                   return { label:"Posse estéril",       icon:"🟡", color:"#854d0e", bg:"#fefce8" }
    if (d.resultado==="E")                                               return { label:"Empate equilibrado",  icon:"🟡", color:"#ca8a04", bg:"#fef9c3" }
    if (d.resultado==="D" && ctrl > 55)                                  return { label:"Derrota com posse",   icon:"🔴", color:"#991b1b", bg:"#fee2e2" }
    if (d.resultado==="D" && exig > 650)                                 return { label:"Derrota por desgaste",icon:"🔴", color:"#dc2626", bg:"#fef2f2" }
    return { label:"Derrota", icon:"🔴", color:"#dc2626", bg:"#fee2e2" }
  }

  // per-result auto leitura
  function resultLeitura(row) {
    if (!row) return ""
    if (row.res==="V" && (row.posse||0) < 50 && (row.xg||0) > 1.8) return "intensidade e eficiência sem posse"
    if (row.res==="V" && (row.posse||0) >= 55) return "controle com eficiência"
    if (row.res==="V" && (row.hsr||0) > 700) return "alta intensidade e bom resultado"
    if (row.res==="V") return "vitórias com bom desempenho"
    if (row.res==="E" && (row.posse||0) > 60 && (row.xg||0) < 1.8) return "controle sem conversão (posse estéril)"
    if (row.res==="E") return "equilíbrio com baixa superioridade"
    if (row.res==="D" && (row.posse||0) > 55) return "posse com baixo retorno ofensivo"
    if (row.res==="D" && (row.hsr||0) > 650) return "alta exigência com baixo resultado"
    return "baixa imposição coletiva"
  }

  const pts  = col.reduce((s,d)=>s+d.pontos,0)
  const nV   = col.filter(d=>d.resultado==="V").length
  const nE   = col.filter(d=>d.resultado==="E").length
  const nD   = col.filter(d=>d.resultado==="D").length
  const RES_CFG = { V:{color:"#07579e",bg:"#dcfce7",label:"Vitória"}, E:{color:"#854d0e",bg:"#fefce8",label:"Empate"}, D:{color:"#991b1b",bg:"#fee2e2",label:"Derrota"} }

  if (!col.length) return (
    <EmptyState icon="🏆" title="Nenhum dado disponível" sub="Importe partidas completas (GPS + Wyscout) para analisar correlação com resultado." />
  )

  return (
    <div className="space-y-5 fade-in">

      {/* HEADER */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5" style={{background:"linear-gradient(135deg,#1e3a1f 0%,#166534 100%)"}}>
          <p className="text-sky-300 text-[8px] font-black uppercase tracking-widest mb-1">Correlação com Resultado</p>
          <h2 className="bc text-3xl font-black uppercase text-white">Impacto no Resultado</h2>
          <p className="text-sky-200 text-[10px] mt-1">O que mais aproxima o Confiança da vitória?</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-100">
          {[
            { label:"Jogos",     val:col.length,                  color:"#374151" },
            { label:"Vitórias",  val:nV,                          color:"#0a66b7" },
            { label:"Empates",   val:nE,                          color:"#ca8a04" },
            { label:"Derrotas",  val:nD,                          color:"#dc2626" },
            { label:"Pontos",    val:`${pts}/${col.length*3}`,    color:G.verde   },
            { label:"Aproveit.", val:`${Math.round(pts/(col.length*3)*100)}%`, color:G.verde },
          ].map(k => (
            <div key={k.label} className="px-4 py-3 text-center">
              <p className="text-[7px] font-black uppercase text-gray-400">{k.label}</p>
              <p className="bc text-xl font-black mt-0.5" style={{color:k.color}}>{k.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DIAGNÓSTICO + AVISO AMOSTRA */}
      {insight && (
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border-l-4 border-sky-600 border border-sky-100 shadow-sm p-5">
            <p className="text-[8px] font-black uppercase tracking-widest text-sky-700 mb-2">💡 Diagnóstico de Resultado</p>
            <p className="text-[11px] text-gray-700 leading-relaxed">{insight}</p>
          </div>
          {col.length < 8 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              <p className="text-[9px] text-amber-700">
                <strong>Amostra pequena ({col.length} jogos).</strong> Interprete como tendência inicial, não conclusão definitiva. Resultado sofre influência de contexto, adversário, placar e qualidade das chances.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW TOGGLE */}
      <div className="flex gap-2">
        {[["coletivo","🏟️ Coletivo"],["individual","👤 Individual"]].map(([id,lbl]) => (
          <button key={id} onClick={()=>setViewMode(id)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode===id?"text-white shadow-sm":"bg-white border border-gray-200 text-gray-500"}`}
            style={viewMode===id?{background:G.verde}:{}}>
            {lbl}
          </button>
        ))}
      </div>

      {viewMode === "coletivo" && (
        <div className="space-y-5">

          {/* ══ COMO VENCEMOS / EMPATAMOS / PERDEMOS ══════════════════════ */}
          {byResult.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {["V","E","D"].map(res => {
                const row = byResult.find(r => r.res === res)
                if (!row || row.n === 0) return (
                  <div key={res} className="bg-white rounded-2xl border-2 border-dashed border-gray-100 p-5 text-center">
                    <p className="text-gray-300 text-sm">{RES_CFG[res]?.label}</p>
                    <p className="text-[9px] text-gray-300 mt-1">Nenhum jogo</p>
                  </div>
                )
                const cfg = RES_CFG[res]
                const perfil = resultLeitura(row)
                const metrics = [
                  { label:'HSR p90',   val: row.hsr   ? (row.hsr>=1000?`${(row.hsr/1000).toFixed(1)}k`:row.hsr.toFixed(0))+'m' : '—', icon:'⚡' },
                  { label:'Sprint p90',val: row.dist  ? (row.dist>=1000?`${(row.dist/1000).toFixed(1)}k`:row.dist.toFixed(0)) : '—', icon:'🏃' },
                  { label:'Posse',     val: row.posse ? `${row.posse.toFixed(0)}%` : '—',  icon:'⚽' },
                  { label:'xG',        val: row.xg    ? row.xg.toFixed(2) : '—',            icon:'🎯' },
                  { label:'xG/Fin.',   val: row.xgFin ? row.xgFin.toFixed(3) : '—',         icon:'📊' },
                  { label:'Passes%',   val: row.passes? `${row.passes.toFixed(0)}%` : '—',  icon:'🎭' },
                ]
                return (
                  <div key={res} className="bg-white rounded-2xl shadow-sm overflow-hidden border-2"
                    style={{borderColor:cfg?.color}}>
                    <div className="px-4 py-3 flex items-center justify-between" style={{background:cfg?.bg}}>
                      <div>
                        <p className="bc text-2xl font-black uppercase leading-none" style={{color:cfg?.color}}>{cfg?.label}</p>
                        <p className="text-[8px] font-bold mt-0.5" style={{color:cfg?.color}}>{row.n} jogo(s)</p>
                      </div>
                      <div className="bc text-4xl font-black opacity-20" style={{color:cfg?.color}}>
                        {res==='V'?'🏆':res==='E'?'🤝':'💔'}
                      </div>
                    </div>
                    <div className="p-4 space-y-1.5">
                      {metrics.map(m => (
                        <div key={m.label} className="flex items-center justify-between">
                          <p className="text-[8px] text-gray-500 flex items-center gap-1">{m.icon} {m.label}</p>
                          <p className="text-[10px] font-black text-gray-800">{m.val}</p>
                        </div>
                      ))}
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-[8px] italic text-gray-400">{perfil}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ PERFIL DOS JOGOS ═══════════════════════════════════════════ */}
          {col.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="bc text-base font-black uppercase text-gray-900 mb-3">📋 Perfil dos Jogos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {col.map((d, i) => {
                  const profile = gameProfile(d)
                  const resCfg  = RES_CFG[d.resultado]
                  return (
                    <div key={i} className="rounded-xl border-2 overflow-hidden" style={{borderColor:profile.color+'60'}}>
                      <div className="px-3 py-2 flex items-center justify-between" style={{background:profile.bg}}>
                        <div>
                          <p className="text-[9px] font-black text-gray-800">vs {d.adversario}</p>
                          <p className="text-[7px] text-gray-400">{d.placar||'—'} · {d.mando||''}</p>
                        </div>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full" style={{background:profile.color,color:'white'}}>
                          {profile.icon} {profile.label}
                        </span>
                      </div>
                      <div className="px-3 py-2 bg-white grid grid-cols-3 gap-1">
                        {[
                          ['Posse', d.posse ? `${d.posse.toFixed(0)}%` : '—'],
                          ['xG',    d.xg    ? d.xg.toFixed(2) : '—'],
                          ['HSR',   d.hsr_p90 ? (d.hsr_p90>=1000?`${(d.hsr_p90/1000).toFixed(1)}k`:d.hsr_p90.toFixed(0)) : '—'],
                          ['Pts',   d.pontos],
                          ['Saldo', d.saldo > 0 ? `+${d.saldo}` : d.saldo],
                          ['Passes', d.passes_pct ? `${d.passes_pct.toFixed(0)}%` : '—'],
                        ].map(([lbl, val]) => (
                          <div key={lbl} className="text-center">
                            <p className="text-[6px] uppercase text-gray-400 font-black">{lbl}</p>
                            <p className="text-[9px] font-black text-gray-700">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* RANKING — PONTOS vs SALDO */}
          {colCorrs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Ajudaram o resultado */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <p className="bc text-sm font-black uppercase text-sky-700 mb-0.5">🏆 Mais Associadas a Pontos</p>
                <p className="text-[8px] text-gray-400 mb-1">Spearman ρ · o que aparece mais nos jogos de melhor resultado</p>
                <div className="space-y-1.5 mt-3">
                  {colCorrsPositive.slice(0,6).map((c,i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[7px] text-gray-300 w-3">{i+1}</span>
                      <span className="text-[7px] px-1 py-0.5 rounded font-black" style={{background:"#f0fdf4",color:"#07579e"}}>{c.group}</span>
                      <p className="text-[9px] font-bold text-gray-700 flex-1 truncate">{c.label}</p>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full flex-shrink-0">
                        <div className="h-full rounded-full bg-sky-500" style={{width:`${c.pontos.r*100}%`}}/>
                      </div>
                      <span className="text-[9px] font-black tabular-nums text-sky-600 w-10 text-right">+{c.pontos.r}{c.pontos.sig?" ★":""}</span>
                    </div>
                  ))}
                </div>
                {colCorrsNegative.some(c=>c.key==="finalizacoes") && (
                  <p className="text-[7px] text-gray-400 mt-2 italic">
                    Finalizações negativa pode indicar volume em contexto de perseguição no placar. Cruzar com xG/finalização esclarece melhor.
                  </p>
                )}
              </div>

              {/* Associadas a pior resultado */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <p className="bc text-sm font-black uppercase text-red-600 mb-0.5">📉 Associadas a Pior Resultado</p>
                <p className="text-[8px] text-gray-400 mb-1">O que aparece mais nos jogos de menor pontuação</p>
                <div className="space-y-1.5 mt-3">
                  {colCorrsNegative.slice(0,6).map((c,i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[7px] text-gray-300 w-3">{i+1}</span>
                      <span className="text-[7px] px-1 py-0.5 rounded font-black" style={{background:"#fef2f2",color:"#dc2626"}}>{c.group}</span>
                      <p className="text-[9px] font-bold text-gray-700 flex-1 truncate">{c.label}</p>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full flex-shrink-0 flex justify-end">
                        <div className="h-full rounded-full bg-red-400" style={{width:`${Math.abs(c.pontos.r)*100}%`}}/>
                      </div>
                      <span className="text-[9px] font-black tabular-nums text-red-600 w-10 text-right">{c.pontos.r}{c.pontos.sig?" ★":""}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  <p className="text-[7px] text-amber-700 italic">
                    Relação negativa não significa que a variável cause pior resultado — pode indicar contexto de jogo (perseguição, pressão mais baixa, posse defensiva).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MÉDIAS POR RESULTADO */}
          {byResult.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="bc text-base font-black uppercase text-gray-900 mb-4">📊 Médias por Resultado</p>
              <div className="overflow-x-auto scrollbar-g">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Resultado","Jogos","Dist p90","HSR p90","Acel.","Posse","xG","xG/Fin.","Passes%","Recup.","Leitura automática"].map(h=>(
                        <th key={h} className="px-2 pb-2.5 text-[8px] font-black uppercase text-gray-400 whitespace-nowrap text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byResult.map(row => {
                      const cfg = RES_CFG[row.res]
                      const best = (key) => {
                        const vals = byResult.map(r=>r[key]).filter(v=>v!==null)
                        if (!vals.length) return null
                        const isPerdas = key==="perdas"
                        return isPerdas ? Math.min(...vals) : Math.max(...vals)
                      }
                      const color = (key,val) => {
                        if (val===null) return "#9ca3af"
                        const b = best(key)
                        const isPerdas = key==="perdas"
                        return val===b ? (isPerdas?"#07579e":"#07579e") : (byResult.length>1?"#6b7280":"#374151")
                      }
                      const fmt = (v,k) => {
                        if (v===null) return "—"
                        if (k==="dist") return v>=1000?`${(v/1000).toFixed(1)}k`:v.toFixed(0)
                        if (k==="posse"||k==="passes") return 
                        if (k==="xg") return v.toFixed(2)
                        if (k==="xgFin") return v.toFixed(3)
                        return v.toFixed(0)
                      }
                      return (
                        <tr key={row.res} className="border-b border-gray-50">
                          <td className="px-2 py-3">
                            <span className="inline-block px-2.5 py-1 rounded-full text-[9px] font-black" style={{background:cfg?.bg,color:cfg?.color}}>{cfg?.label} ({row.n})</span>
                          </td>
                          <td className="px-2 py-3 text-center text-gray-400 font-bold">{row.n}</td>
                          {[["dist",row.dist],["hsr",row.hsr],["accel",row.accel],["posse",row.posse],["xg",row.xg],["xgFin",row.xgFin],["passes",row.passes],["recup",row.recup]].map(([k,v]) => (
                            <td key={k} className="px-2 py-3 text-center font-bold" style={{color:color(k,v)}}>{fmt(v,k)}</td>
                          ))}
                          <td className="px-2 py-3 text-[8px] italic text-gray-500">{resultLeitura(row)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QUADRANTE EXIGÊNCIA × RESULTADO */}
          {col.length >= 3 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="bc text-base font-black uppercase text-gray-900 mb-1">📐 Quadrante: Exigência Física × Resultado</p>
              <p className="text-[9px] text-gray-400 mb-4">Cada ponto = 1 jogo · X = índice físico composto · Y = pontos</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{top:8,right:20,bottom:24,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="gps_index" type="number"
                      label={{value:"Exigência física (índice)", position:"insideBottom", offset:-14, fontSize:8, fill:"#94a3b8"}}
                      tick={{fontSize:8,fill:"#94a3b8"}} />
                    <YAxis dataKey="pontos" type="number" domain={[-0.2,3.2]}
                      ticks={[0,1,3]}
                      tickFormatter={v=>v===3?"Vitória":v===1?"Empate":"Derrota"}
                      tick={{fontSize:7,fill:"#94a3b8"}} width={52} />
                    <ZAxis range={[60,60]} />
                    <ReferenceLine y={1.5} stroke="#cbd5e1" strokeDasharray="3 2" strokeWidth={1}/>
                    <ReferenceLine x={col.reduce((s,d)=>s+(d.gps_index||0),0)/col.length} stroke="#cbd5e1" strokeDasharray="3 2" strokeWidth={1}/>
                    <Tooltip content={({active,payload}) => {
                      if (!active||!payload?.length) return null
                      const d = payload[0]?.payload
                      const pf = gameProfile(d)
                      return (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                          <p className="font-black text-gray-900">{pf.icon} vs {d?.adversario}</p>
                          <p className="text-gray-400 text-[9px]">{d?.placar} · {d?.mando}</p>
                          <p className="text-[9px] italic text-gray-500 mt-1">{pf.label}</p>
                        </div>
                      )
                    }} />
                    <Scatter data={col.map(d=>({
                      ...d, gps_index: d.gps_index||0,
                      fill: {V:"#0a66b7",E:"#ca8a04",D:"#dc2626"}[d.resultado]||"#6b7280"
                    }))}
                    shape={({cx,cy,payload}) => (
                      <circle cx={cx} cy={cy} r={8} fill={payload?.fill||"#6b7280"} fillOpacity={0.85} stroke="white" strokeWidth={1.5}/>
                    )} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[8px]">
                {[
                  {q:"⬆️↗️",label:"Alta exigência + bom resultado",sub:"Vitória intensa",color:"#dcfce7"},
                  {q:"⬇️↗️",label:"Baixa exigência + bom resultado",sub:"Vitória controlada",color:"#dbeafe"},
                  {q:"⬆️↘️",label:"Alta exigência + mau resultado",sub:"Desgaste improdutivo",color:"#fee2e2"},
                  {q:"⬇️↘️",label:"Baixa exigência + mau resultado",sub:"Baixa imposição",color:"#f3f4f6"},
                ].map(q=>(
                  <div key={q.q} className="rounded-xl px-2 py-1.5 text-gray-600" style={{background:q.color}}>
                    <p className="font-black text-[9px]">{q.sub}</p>
                    <p className="text-[7px] text-gray-500 mt-0.5">{q.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABELA JOGO A JOGO */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Jogo a Jogo — Perfil de Resultado</p>
            </div>
            <div className="overflow-x-auto scrollbar-g">
              <table className="w-full text-[10px]">
                <thead>
                  <tr style={{background:"#1f2937"}}>
                    {["Jogo","Res.","Placar","Pts","Saldo","Dist p90","HSR","Posse","xG","xG/Fin.","Passes%","Perfil"].map(h=>(
                      <th key={h} className="px-2 py-2.5 text-left text-[8px] font-black uppercase text-white whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {col.map((d,i) => {
                    const profile = gameProfile(d)
                    const resCfg  = RES_CFG[d.resultado]
                    return (
                      <tr key={i} className={`border-b border-gray-50 ${i%2===0?"bg-white":"bg-gray-50/30"} row-hover`}>
                        <td className="px-2 py-2.5 font-bold text-gray-700 whitespace-nowrap">vs {d.adversario}</td>
                        <td className="px-2 py-2.5">
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[8px] font-black" style={{background:resCfg?.bg,color:resCfg?.color}}>{d.resultado}</span>
                        </td>
                        <td className="px-2 py-2.5 text-gray-400 font-mono text-[9px]">{d.placar||"—"}</td>
                        <td className="px-2 py-2.5 font-black" style={{color:d.pontos===3?"#0a66b7":d.pontos===0?"#dc2626":"#ca8a04"}}>{d.pontos}</td>
                        <td className="px-2 py-2.5 font-black" style={{color:d.saldo>0?"#0a66b7":d.saldo<0?"#dc2626":"#ca8a04"}}>{d.saldo>0?"+":""}{d.saldo}</td>
                        <td className="px-2 py-2.5 text-gray-600">{(d.dist_p90||0)>=1000?`${((d.dist_p90||0)/1000).toFixed(1)}k`:(d.dist_p90||0)||"—"}</td>
                        <td className="px-2 py-2.5 font-bold" style={{color:(d.hsr_p90||0)>700?G.verde:G.amber}}>{d.hsr_p90||"—"}</td>
                        <td className="px-2 py-2.5 font-bold" style={{color:(d.posse||0)>55?G.verde:(d.posse||0)>44?G.amber:G.red}}>{(d.posse||0)>0?`${(d.posse||0).toFixed(0)}%`:"—"}</td>
                        <td className="px-2 py-2.5 font-bold" style={{color:(d.xg||0)>2?G.verde:(d.xg||0)>1?G.amber:G.red}}>{(d.xg||0)>0?d.xg.toFixed(2):"—"}</td>
                        <td className="px-2 py-2.5 font-bold" style={{color:(d.xg_per_fin||0)>0.15?G.verde:(d.xg_per_fin||0)>0.09?G.amber:G.red}}>{(d.xg_per_fin||0)>0?d.xg_per_fin.toFixed(3):"—"}</td>
                        <td className="px-2 py-2.5 font-bold" style={{color:(d.passes_pct||0)>82?G.verde:(d.passes_pct||0)>74?G.amber:G.red}}>{(d.passes_pct||0)>0?`${(d.passes_pct||0).toFixed(0)}%`:"—"}</td>
                        <td className="px-2 py-2.5">
                          <span className="inline-flex items-center gap-1 text-[7px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{background:profile.bg,color:profile.color}}>
                            {profile.icon} {profile.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {viewMode === "individual" && (
        <div className="space-y-5">

          {/* ══ RANKING EXECUTIVO — SEM FILTRO ════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p className="bc text-base font-black uppercase text-gray-900 mb-1">🏅 Atletas que Mais Crescem nas Vitórias</p>
            <p className="text-[9px] text-gray-400 mb-4">Δ HSR e ações com sucesso nas vitórias vs empates/derrotas · mín. 20 min · excl. goleiros</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {byPlayer.filter(p=>p.vHsr!==null).slice(0,8).map((p,i) => {
                const liftColor = (p.lift||0) >= 0 ? '#0a66b7' : '#dc2626'
                const liftIcon  = (p.lift||0) >= 10 ? '⬆️' : (p.lift||0) >= 0 ? '↗️' : '↘️'
                const acoaoDiff = p.vAcao && p.oAcao ? p.vAcao - p.oAcao : null
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 bg-gray-50">
                    <span className="bc text-2xl font-black text-gray-200 flex-shrink-0">{i+1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-gray-800 truncate">{p.nome}</p>
                        <span className="text-[7px] px-1.5 py-0.5 rounded-full font-black text-white flex-shrink-0" style={{background:POS_COLOR[p.pos]||'#6b7280'}}>{POS_LABEL[p.pos]||p.pos}</span>
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        <p className="text-[8px] text-gray-500">
                          HSR: <span className="font-black" style={{color:liftColor}}>{liftIcon} {p.lift!==null?`${p.lift>=0?'+':''}${p.lift.toFixed(0)}%`:'—'}</span>
                        </p>
                        {acoaoDiff !== null && (
                          <p className="text-[8px] text-gray-500">
                            Ações%: <span className="font-black" style={{color:acoaoDiff>=0?'#0a66b7':'#dc2626'}}>{acoaoDiff>=0?'+':''}{acoaoDiff.toFixed(0)}pp</span>
                          </p>
                        )}
                        <p className="text-[8px] text-gray-400">{p.V.length}V / {p.E.length}E / {p.D.length}D</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[8px] text-gray-400">HSR nas V</p>
                      <p className="text-[10px] font-black text-sky-700">{p.vHsr?(p.vHsr>=1000?`${(p.vHsr/1000).toFixed(1)}k`:p.vHsr.toFixed(0)):'—'}m</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center">
            <div>
              <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Posição</p>
              <div className="flex gap-1">
                <button onClick={()=>setPosFilter("")} className={`px-2 py-1 rounded-lg text-[8px] font-black ${!posFilter?"text-white bg-gray-700":"bg-gray-100 text-gray-500"}`}>Todas</button>
                {Object.keys(POS_LABEL).filter(p=>p!=="GOL").map(p => (
                  <button key={p} onClick={()=>setPosFilter(p)}
                    className={`px-2 py-1 rounded-lg text-[8px] font-black ${posFilter===p?"text-white":"bg-gray-100 text-gray-500"}`}
                    style={posFilter===p?{background:POS_COLOR[p]}:{}}>{POS_LABEL[p]}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase text-gray-400 mb-1">Min. minutos</p>
              <div className="flex gap-1">
                {[20,30,45,60].map(m=>(
                  <button key={m} onClick={()=>setMinMinFilter(m)}
                    className={`px-2 py-1 rounded-lg text-[8px] font-black ${minMinFilter===m?"text-white":"bg-gray-100 text-gray-500"}`}
                    style={minMinFilter===m?{background:G.verde}:{}}>{m}&apos;</button>
                ))}
              </div>
            </div>
            <p className="text-[8px] text-gray-400 ml-auto">{indivFiltered.length} registros · Spearman ρ</p>
          </div>

          {/* Top variáveis por posição */}
          {Object.keys(byPosCorrs).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="bc text-base font-black uppercase text-gray-900 mb-1">📐 Top Variáveis por Posição × Resultado</p>
              <p className="text-[8px] text-gray-400 mb-4">Spearman ρ · métrica individual × pontos da partida · filtro de posição ativa</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(byPosCorrs).map(([pos, {corrs, n}]) => (
                  <div key={pos} className="rounded-xl overflow-hidden border border-gray-100">
                    <div className="px-3 py-2 flex items-center justify-between" style={{background:POS_COLOR[pos]}}>
                      <span className="bc text-sm font-black text-white uppercase">{POS_LABEL[pos]}</span>
                      <span className="text-[7px] text-white/70">n={n}</span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {corrs.slice(0,4).map((c,i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-[7px] text-gray-300 w-3">{i+1}</span>
                          <p className="text-[8px] font-bold text-gray-700 flex-1 truncate">{c.label}</p>
                          <span className="text-[8px] font-black tabular-nums" style={{color:rColor(c.r)}}>{c.r>0?"+":""}{c.r}{c.sig?" ★":""}</span>
                        </div>
                      ))}
                      {corrs.length === 0 && <p className="text-[8px] text-gray-400">Sem dados (mín. 3 jogos)</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Atletas que melhoram nas vitórias */}
          {byPlayer.filter(p => !posFilter || p.pos === posFilter).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Quem mais performa nas Vitórias — HSR médio (V vs E/D)</p>
              </div>
              <div className="overflow-x-auto scrollbar-g">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{background:"#1f2937"}}>
                      {["Atleta","Pos.","Jogos","HSR (V)","HSR (E/D)","Δ HSR","Ações% (V)","Interc. (V)"].map(h=>(
                        <th key={h} className="px-2 py-2.5 text-left text-[8px] font-black uppercase text-white whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byPlayer
                      .filter(p => !posFilter || p.pos === posFilter)
                      .filter(p => p.vHsr !== null)
                      .slice(0, 12)
                      .map((p,i) => {
                        const liftColor = (p.lift||0) >= 0 ? "#0a66b7" : "#dc2626"
                        return (
                          <tr key={i} className={`border-b border-gray-50 ${i%2===0?"bg-white":"bg-gray-50/30"}`}>
                            <td className="px-2 py-2 font-bold text-gray-800">{p.nome}</td>
                            <td className="px-2 py-2">
                              <span className="text-[7px] px-1.5 py-0.5 rounded-full font-black text-white" style={{background:POS_COLOR[p.pos]||"#6b7280"}}>{POS_LABEL[p.pos]||p.pos}</span>
                            </td>
                            <td className="px-2 py-2 text-gray-400">{p.jogos}</td>
                            <td className="px-2 py-2 font-bold text-sky-700">{p.vHsr ? (p.vHsr>=1000?`${(p.vHsr/1000).toFixed(1)}k`:p.vHsr.toFixed(0)) : "—"}</td>
                            <td className="px-2 py-2 text-gray-500">{p.oHsr ? (p.oHsr>=1000?`${(p.oHsr/1000).toFixed(1)}k`:p.oHsr.toFixed(0)) : "—"}</td>
                            <td className="px-2 py-2 font-black" style={{color:liftColor}}>{p.lift !== null ? `${p.lift>=0?"+":""}${p.lift.toFixed(0)}%` : "—"}</td>
                            <td className="px-2 py-2 font-bold text-sky-700">{p.vAcao !== null ? `${p.vAcao.toFixed(0)}%` : "—"}</td>
                            <td className="px-2 py-2 text-gray-500">{p.vInterc !== null ? p.vInterc.toFixed(1) : "—"}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
export default function BancoFisicoTaticoPage() {
  const [activeTab,     setActiveTab]     = useState('upload')
  const [partidas,      setPartidas]      = useState([])   // lightweight (banco tab)
  const [fullPartidas,  setFullPartidas]  = useState([])   // with rows (analysis tabs)
  const [loading,       setLoading]       = useState(true)
  const [deleteId,      setDeleteId]      = useState(null)

  const loadPartidas = useCallback(async () => {
    setLoading(true)
    try {
      const [resLight, resFull] = await Promise.all([
        fetch('/api/banco-partidas'),
        fetch('/api/banco-partidas?full=1'),
      ])
      const dLight = await resLight.json()
      const dFull  = await resFull.json()
      setPartidas(dLight.partidas   || [])
      setFullPartidas(dFull.partidas || [])
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => { loadPartidas() }, [loadPartidas])

  const handleDelete = async id => {
    setDeleteId(null)
    setPartidas(p => p.filter(x => x.id !== id))
    setFullPartidas(p => p.filter(x => x.id !== id))
    await fetch(`/api/banco-partidas/${id}`, { method:'DELETE' })
  }

  // KPIs header
  const totalJogos    = partidas.length
  const completos     = partidas.filter(p => p.gps_status==='ok' && p.wyscout_status==='ok').length
  const atletasTotal  = new Set(fullPartidas.flatMap(p => (p.wyscout_rows||[]).map(r=>r.jogador))).size
  const historico     = buildHistoricalDataset(fullPartidas)

  const ANALYSIS_TABS = ['consolidado','correlacoes','scatter','posicao','atleta','padroes','coletivo','resultado']

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm min-h-screen bg-gray-50">

        {/* HEADER */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
          <div className="max-w-screen-2xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{background:G.verde}} />
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-400">GPS × Wyscout · Inteligência Físico-Tática</p>
                </div>
                <h1 className="bc text-3xl font-black uppercase text-gray-900 leading-none">Banco Físico-Tático</h1>
              </div>
              {/* KPIs header */}
              <div className="hidden md:flex items-center gap-3">
                {[
                  { label:'Jogos',        val:totalJogos,   color:G.verde  },
                  { label:'Completos',    val:completos,    color:G.verde2 },
                  { label:'Atletas',      val:atletasTotal, color:G.purple },
                  { label:'Registros',    val:historico.length, color:G.amber },
                ].map(k => (
                  <div key={k.label} className="text-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                    <p className="text-[7px] font-black uppercase text-gray-400">{k.label}</p>
                    <p className="bc text-xl font-black" style={{color:k.color}}>{k.val}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto scrollbar-g">
              {TABS.map(t => {
                const disabled = ANALYSIS_TABS.includes(t.id) && fullPartidas.filter(p=>p.gps_status==='ok').length===0
                return (
                  <button key={t.id}
                    onClick={() => !disabled && setActiveTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab===t.id?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'} ${disabled?'opacity-30 cursor-not-allowed':''}`}>
                    {t.icon} {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="max-w-screen-2xl mx-auto px-6 py-6">
          {activeTab === 'upload'      && <TabUpload      onRefresh={loadPartidas} />}
          {activeTab === 'banco'       && <TabBanco       partidas={partidas} loading={loading} onDelete={setDeleteId} />}
          {activeTab === 'consolidado' && <TabConsolidado fullPartidas={fullPartidas} />}
          {activeTab === 'correlacoes' && <TabCorrelacoes fullPartidas={fullPartidas} />}
          {activeTab === 'scatter'     && <TabScatter     fullPartidas={fullPartidas} />}
          {activeTab === 'posicao'     && <TabPorPosicao  fullPartidas={fullPartidas} />}
          {activeTab === 'atleta'      && <TabAtleta      fullPartidas={fullPartidas} />}
          {activeTab === 'padroes'     && <TabPadroes     fullPartidas={fullPartidas} />}
          {activeTab === 'coletivo'    && <TabColetivo    fullPartidas={fullPartidas} />}
          {activeTab === 'resultado'   && <TabResultado   fullPartidas={fullPartidas} />}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <p className="text-3xl mb-2">🗑️</p>
            <p className="bc text-xl font-black uppercase text-gray-900 mb-1">Excluir partida?</p>
            <p className="text-[11px] text-gray-400 mb-5">Todos os dados GPS e Wyscout desta partida serão removidos do banco.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)}
                className="px-5 py-2 rounded-xl text-[9px] font-black uppercase text-gray-500 bg-gray-100 hover:bg-gray-200">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="px-5 py-2 rounded-xl text-white text-[9px] font-black uppercase bg-red-600 hover:bg-red-700">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
