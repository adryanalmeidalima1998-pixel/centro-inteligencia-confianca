// lib/serieC.js
// ─────────────────────────────────────────────────────────────────────────────
// Motor de métricas da área "Série C | Estatísticas".
// Funções puras (rodam no client e no server) para:
//   - detectar o Confiança entre variações de nome
//   - decidir se uma métrica é "de volume" (pode virar /90) ou já proporcional
//   - calcular valor por 90 minutos
//   - calcular ranking, percentil, média da competição e variação entre uploads
// Nada aqui inventa métrica nova: tudo parte das colunas que já vêm da planilha.
// ─────────────────────────────────────────────────────────────────────────────

import { isCurrentClubName, normalizeTeamIdentity } from './club-config'

// ── Confiança: reconhece variações de nome ────────────────────────────────────
export const normTeamName = normalizeTeamIdentity

export function isClubTeam(name) {
  return isCurrentClubName(name)
}

// ── Classificação de métricas: volume x proporcional ────────────────────────
// Palavras/símbolos que indicam que a métrica JÁ é proporcional e não deve
// ser recalculada por 90 minutos.
const NON_VOLUME_HINTS = [
  '%', 'percentual', 'percentil', 'índice', 'indice', 'ranking',
  'taxa', 'média', 'media', '/90', 'por 90', 'xg por', 'distância média',
  'distancia media', 'conversão', 'conversao',
]

// Colunas que claramente não são estatística numérica de produção (identificação)
export const NON_METRIC_KEYS = new Set([
  '№', 'jogador', 'time', 'idade', 'altura', 'peso', 'nacionalidade',
  'posição', 'posicao', 'minutos jogados',
])

export function isIdentityColumn(key) {
  return NON_METRIC_KEYS.has(normTeamName(key).toLowerCase()) ||
    NON_METRIC_KEYS.has(String(key).trim().toLowerCase())
}

export function isVolumeMetric(key) {
  const k = String(key).toLowerCase()
  if (NON_VOLUME_HINTS.some(h => k.includes(h))) return false
  return true
}

export function isNumeric(value) {
  if (value === null || value === undefined || value === '' || value === '-') return false
  const n = Number(value)
  return Number.isFinite(n)
}

export function toNumber(value, fallback = null) {
  if (!isNumeric(value)) return fallback
  return Number(value)
}

// ── Cálculo por 90 minutos ───────────────────────────────────────────────────
export function per90(value, minutes) {
  const v = toNumber(value)
  const m = toNumber(minutes)
  if (v === null || m === null || m <= 0) return null
  return (v / m) * 90
}

// Nome amigável da coluna calculada por 90 (ex.: "Gols" -> "Gols/90")
export function per90Label(key) {
  return `${key}/90`
}

// Dado o objeto bruto de métricas (metrics JSONB) + minutos, devolve um novo
// objeto com os valores no modo pedido: 'total' | 'per90'.
// No modo 'per90', métricas de volume viram valor/minutos*90; o restante
// (percentuais, índices etc.) permanece igual.
export function applyMetricMode(metrics, minutes, mode) {
  if (!metrics) return {}
  if (mode !== 'per90') return metrics
  const out = {}
  for (const [key, value] of Object.entries(metrics)) {
    if (isIdentityColumn(key)) { out[key] = value; continue }
    if (isNumeric(value) && isVolumeMetric(key)) {
      const p = per90(value, minutes)
      out[key] = p === null ? value : Number(p.toFixed(2))
    } else {
      out[key] = value
    }
  }
  return out
}

// ── Ranking / percentil / média ──────────────────────────────────────────────
// rows: [{ id, ...campos, value }]  (value já é o número a comparar)
// higherBetter: true = maior é melhor (default). false para métricas negativas
// (gols sofridos, cartões, perdas, faltas etc.)
export function rankByMetric(rows, higherBetter = true) {
  const valid = rows.filter(r => isNumeric(r.value))
  const sorted = [...valid].sort((a, b) =>
    higherBetter ? toNumber(b.value) - toNumber(a.value) : toNumber(a.value) - toNumber(b.value)
  )
  const total = sorted.length
  const withRank = sorted.map((r, i) => ({
    ...r,
    rank: i + 1,
    total,
    percentile: total > 1 ? Math.round(((total - 1 - i) / (total - 1)) * 100) : 100,
  }))
  // mantém quem não tem valor numérico no final, sem rank
  const invalid = rows.filter(r => !isNumeric(r.value)).map(r => ({ ...r, rank: null, total, percentile: null }))
  return [...withRank, ...invalid]
}

export function averageOf(rows) {
  const nums = rows.map(r => toNumber(r.value)).filter(v => v !== null)
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function diffFromAverage(value, avg) {
  const v = toNumber(value)
  if (v === null || avg === null) return null
  return v - avg
}

export function pctDiffFromAverage(value, avg) {
  const v = toNumber(value)
  if (v === null || avg === null || avg === 0) return null
  return ((v - avg) / Math.abs(avg)) * 100
}

// Badge de destaque conforme o rank
export function rankBadge(rank) {
  if (rank === null || rank === undefined) return null
  if (rank === 1) return 'top1'
  if (rank <= 3) return 'top3'
  if (rank <= 5) return 'top5'
  return null
}

export function isAboveAverage(value, avg) {
  const v = toNumber(value)
  if (v === null || avg === null) return null
  return v > avg
}

// Lista de métricas conhecidas como "negativas" (menor é melhor)
export const NEGATIVE_METRIC_HINTS = [
  'gols sofridos', 'perdas da bola', 'perdas no próprio campo', 'perdas da bola no próprio campo',
  'faltas', 'cartões amarelos', 'cartões vermelhos', 'erros que geram chance',
  'erros que resultam em gol', 'ações malsucedidas', 'duelos perdidos', 'dribles falhados',
  'domínio de bola incorreto', 'impedimentos', 'malsucedid', 'espalmadas para zona perigosa',
  'conversão de xg do adversário', 'conversao de xg do adversario', 'gols sofridos de pênalti', 'gols de tiro livre do adversário',
]

export function higherIsBetter(key) {
  const k = String(key).toLowerCase()
  return !NEGATIVE_METRIC_HINTS.some(h => k.includes(h))
}

// ── Variação entre uploads (rodada atual x rodada anterior) ─────────────────
export function variation(current, previous) {
  const c = toNumber(current)
  const p = toNumber(previous)
  if (c === null || p === null) return null
  return c - p
}

// ── Extração de campos de identidade (independe da ordem das colunas) ───────
function findKey(obj, candidates) {
  const keys = Object.keys(obj || {})
  for (const cand of candidates) {
    const hit = keys.find(k => normTeamName(k) === normTeamName(cand))
    if (hit) return hit
  }
  return null
}

export function extractTeamIdentity(row) {
  const teamKey = findKey(row, ['Time', 'Equipe', 'Clube'])
  return { team: row[teamKey] ?? row.Time ?? '' }
}

export function extractPlayerIdentity(row) {
  const nameKey = findKey(row, ['Jogador', 'Nome'])
  const teamKey = findKey(row, ['Time', 'Equipe', 'Clube'])
  const ageKey = findKey(row, ['Idade'])
  const minKey = findKey(row, ['Minutos jogados', 'Minutos'])
  const posKey = findKey(row, ['Posição', 'Posicao'])
  const idxKey = findKey(row, ['Índice', 'Indice'])
  return {
    player: nameKey ? row[nameKey] : '',
    team: teamKey ? row[teamKey] : '',
    age: ageKey ? toNumber(row[ageKey]) : null,
    minutes: minKey ? toNumber(row[minKey]) : null,
    position: posKey ? row[posKey] : '',
    index: idxKey ? toNumber(row[idxKey]) : null,
  }
}

export const MINUTES_FILTER_OPTIONS = [180, 300, 450, 600, 900]
export const DEFAULT_MIN_MINUTES = 450

// ── Formatação profissional de números ──────────────────────────────────────
export function isPercentageMetric(key) {
  const k = String(key || '').toLowerCase()
  return k.includes('%') || k.includes('percentual') || k.includes('taxa') || k.includes('aproveitamento')
}

export function roundTo(value, digits = 2) {
  const n = toNumber(value)
  if (n === null) return null
  const p = Math.pow(10, digits)
  return Math.round((n + Number.EPSILON) * p) / p
}

export function formatNumberBR(value, digits = 0) {
  const n = toNumber(value)
  if (n === null) return '-'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

export function formatPercentage(value, digits = 1) {
  const n = toNumber(value)
  if (n === null) return '-'
  const pct = Math.abs(n) <= 1.5 ? n * 100 : n
  return `${formatNumberBR(pct, digits)}%`
}

export function formatMetricValue(metricKey, value, { per90Mode = false } = {}) {
  const n = toNumber(value)
  if (n === null) return '-'
  const key = String(metricKey || '')
  const k = key.toLowerCase()

  if (isPercentageMetric(key)) return formatPercentage(n, 1)
  if (k.includes('xg') || k.includes('gols esperados') || per90Mode || k.includes('/90')) return formatNumberBR(n, 2)
  if (k.includes('índice') || k.includes('indice') || k === 'idade' || k === 'min' || k.includes('minutos')) return formatNumberBR(n, 0)
  if (Number.isInteger(n)) return formatNumberBR(n, 0)
  return formatNumberBR(n, 2)
}

export function metricDisplayName(metricKey) {
  // Normaliza primeiro os nomes especiais e só depois a pontuação.
  // Antes, remover `, %` primeiro transformava
  // `Pressão do time bem-sucedida, %` em `Pressão do time bem-sucedida %`
  // e impedia o alias `Pressão bem-sucedida` de ser aplicado.
  return String(metricKey || '')
    .replace('Pressão do time bem-sucedida, %', 'Pressão bem-sucedida')
    .replace('Pressão do time bem-sucedida %', 'Pressão bem-sucedida')
    .replace('xG (Gols esperados)', 'xG')
    .replace('Recuperações da bola no campo adversário', 'Recuperações campo adversário')
    .replace(', %', ' %')
}

function normMetricName(value) {
  return (value == null ? '' : String(value))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    // Diferente de normTeamName: preserva % para não confundir
    // "Passes precisos" (volume) com "Passes precisos, %" (eficiência).
    .replace(/[^A-Z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findMetricColumn(sampleRow, name) {
  if (!sampleRow) return null
  const keys = Object.keys(sampleRow)
  const targetRaw = String(name ?? '').trim().toLowerCase()

  // 1) Prioriza correspondência literal. Isso é essencial nas planilhas Wyscout,
  // onde existem pares como "Passes precisos" e "Passes precisos, %".
  const exact = keys.find(k => String(k).trim().toLowerCase() === targetRaw)
  if (exact) return exact

  // 2) Normaliza acentos/pontuação, mas PRESERVA o sinal de porcentagem.
  const targetMetric = normMetricName(name)
  const metricMatch = keys.find(k => normMetricName(k) === targetMetric)
  if (metricMatch) return metricMatch

  // 3) Fallback legado para nomes antigos/irregulares.
  return keys.find(k => normTeamName(k) === normTeamName(name)) || null
}

export function findMetricColumnAny(sampleRow, names = []) {
  for (const name of names) {
    const key = findMetricColumn(sampleRow, name)
    if (key) return key
  }
  return null
}

export function valueFromMetricAny(metrics, names = []) {
  const key = findMetricColumnAny(metrics, names)
  return key ? toNumber(metrics?.[key]) : null
}

export function valueFromMetric(metrics, metricName) {
  const col = findMetricColumn(metrics, metricName)
  return col ? toNumber(metrics?.[col]) : null
}

export function isBetterThanAverage(metricKey, value, avg) {
  const v = toNumber(value)
  if (v === null || avg === null || avg === undefined) return null
  return higherIsBetter(metricKey) ? v >= avg : v <= avg
}

export function metricGroup(metricKey) {
  const k = String(metricKey || '').toLowerCase()
  if (['gol', 'chute', 'xg', 'chance'].some(w => k.includes(w))) return 'Ataque'
  if (['passe', 'posse', 'cruzamento', 'terço final', 'área adversária'].some(w => k.includes(w))) return 'Construção'
  if (['pressão', 'recupera'].some(w => k.includes(w))) return 'Pressão'
  if (['duelo', 'desarme', 'intercept', 'sofridos', 'defens'].some(w => k.includes(w))) return 'Defesa'
  if (['cartão', 'cartoes', 'faltas'].some(w => k.includes(w))) return 'Disciplina'
  return 'Geral'
}

export function playerProfile(player) {
  const m = player?.metrics || {}
  const pos = String(player?.position || '').toUpperCase()
  const goals = valueFromMetric(m, 'Gols') || 0
  const xg = valueFromMetric(m, 'xG (Gols esperados)') || 0
  const keyPasses = valueFromMetric(m, 'Passes-chave') || 0
  const progressive = valueFromMetric(m, 'Passes progressivos') || 0
  const dribbles = valueFromMetric(m, 'Dribles bem-sucedidos, %') || 0
  const duels = valueFromMetric(m, 'Duelos ganhos, %') || 0
  const recoveries = valueFromMetric(m, 'Recuperações de bola solta') || valueFromMetric(m, 'Recuperações da bola') || 0

  if (pos.includes('CB') || pos.includes('LCB') || pos.includes('RCB')) return progressive >= 70 ? 'Zagueiro construtor' : 'Duelador defensivo'
  if (pos.includes('LB') || pos.includes('RB') || pos.includes('LWB') || pos.includes('RWB')) return progressive >= 60 || keyPasses >= 5 ? 'Lateral profundo' : 'Lateral equilibrado'
  if (pos.includes('DM') || pos.includes('CM')) return recoveries >= 40 || duels >= 0.58 ? 'Volante marcador' : 'Construtor'
  if (keyPasses >= 8 || progressive >= 70) return 'Criador'
  if (goals >= 3 || xg >= 2) return 'Finalizador'
  if (dribbles >= 0.65) return 'Driblador'
  return 'Equilibrado'
}

export function goalkeeperProfile(goalkeeper) {
  const m = goalkeeper?.metrics || {}
  const savePct = valueFromMetric(m, 'Chutes defendidos, %') || 0
  const exits = valueFromMetric(m, 'Intervenções fora da área') || 0
  const passPct = valueFromMetric(m, 'Passes precisos, %') || 0
  const longPct = valueFromMetric(m, 'Passes longos precisos, %') || 0
  if (exits >= 5) return 'Goleiro líbero'
  if (passPct >= 0.85 || longPct >= 0.65) return 'Goleiro passador'
  if (savePct >= 0.8) return 'Defensor de meta'
  return 'Goleiro reativo'
}
