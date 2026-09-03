import { isIdentityColumn, isNumeric, normTeamName, toNumber } from './serieC'
import { isCurrentClubIdentity } from './club-config'

export const MATCH_IDENTITY_KEYS = new Set([
  'data', 'match', 'jogo', 'time', 'equipa', 'equipe', 'clube',
  'competição', 'competicao', 'duração', 'duracao',
  'tática (inicial)', 'tatica (inicial)', 'sistema',
])

export function isMatchIdentityColumn(key) {
  const normalized = String(key || '').trim().toLowerCase()
  return MATCH_IDENTITY_KEYS.has(normalized) || isIdentityColumn(key)
}

export function parseSpreadsheetDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }
  if (typeof value === 'string' && value.trim()) {
    const br = value.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/)
    if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }
  return null
}

export function parseMatchLabel(label) {
  const text = String(label || '').trim()
  if (!text) return null

  // Exportação tradicional: "Anapolis 2:1 Confiança".
  const scoreInMiddle = text.match(/^(.*?)\s+(\d+)\s*:\s*(\d+)\s+(.+)$/)
  if (scoreInMiddle) {
    return {
      homeTeam: scoreInMiddle[1].trim(),
      homeScore: Number(scoreInMiddle[2]),
      awayScore: Number(scoreInMiddle[3]),
      awayTeam: scoreInMiddle[4].trim(),
    }
  }

  // Exportação "Team Stats": "Anápolis - Confiança 2:1".
  const scoreAtEnd = text.match(/^(.*?)\s+-\s+(.*?)\s+(\d+)\s*:\s*(\d+)$/)
  if (scoreAtEnd) {
    return {
      homeTeam: scoreAtEnd[1].trim(),
      awayTeam: scoreAtEnd[2].trim(),
      homeScore: Number(scoreAtEnd[3]),
      awayScore: Number(scoreAtEnd[4]),
    }
  }

  return null
}


export function matchDateKey(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10)
}

export function matchDayDistance(a, b) {
  const first = new Date(`${matchDateKey(a)}T12:00:00Z`).getTime()
  const second = new Date(`${matchDateKey(b)}T12:00:00Z`).getTime()
  if (!Number.isFinite(first) || !Number.isFinite(second)) return Number.POSITIVE_INFINITY
  return Math.abs(first - second) / 86400000
}

const TEAM_NAME_STOP_WORDS = new Set(['FC','EC','SC','AA','AD','SAF','CLUBE','CLUB','DE','DA','DO','DAS','DOS','ESPORTE','SPORT'])

export function sameTeamName(a, b) {
  const first = normTeamName(a)
  const second = normTeamName(b)
  if (!first || !second) return false
  if (first === second || first.includes(second) || second.includes(first)) return true
  const firstTokens = first.split(' ').filter(token => token && !TEAM_NAME_STOP_WORDS.has(token))
  const secondTokens = second.split(' ').filter(token => token && !TEAM_NAME_STOP_WORDS.has(token))
  if (!firstTokens.length || !secondTokens.length) return false
  const shared = firstTokens.filter(token => secondTokens.includes(token))
  return shared.length / Math.min(firstTokens.length, secondTokens.length) >= 0.5
}

export function inferRounds(records) {
  const sorted = [...records].sort((a, b) => {
    const dateDiff = String(a.matchDate).localeCompare(String(b.matchDate))
    if (dateDiff !== 0) return dateDiff
    return String(a.matchLabel).localeCompare(String(b.matchLabel), 'pt-BR')
  })

  let currentRound = 0
  let previousDate = null
  for (const record of sorted) {
    const currentDate = new Date(`${record.matchDate}T12:00:00Z`)
    if (!previousDate || (currentDate.getTime() - previousDate.getTime()) / 86400000 > 3) currentRound += 1
    record.round = currentRound
    previousDate = currentDate
  }
  return sorted
}

export function matchMetricCategory(key) {
  const k = String(key || '').toLowerCase()
  if (['gol', 'chance', 'chute', 'trave', 'impedimento', 'ação na área', 'acoes na area'].some(term => k.includes(term))) return 'Ataque e finalização'
  if (['passe', 'posse', 'cruzamento', 'terço final', 'terco final', 'entrada no campo', 'entrada na área', 'entrada na area'].some(term => k.includes(term))) return 'Construção e progressão'
  if (['duelo', 'desarme', 'intercept', 'drible'].some(term => k.includes(term))) return 'Duelos e 1x1'
  if (['pressão', 'pressao', 'recupera'].some(term => k.includes(term))) return 'Pressão e recuperações'
  if (['perda', 'domínio', 'dominio'].some(term => k.includes(term))) return 'Perdas e segurança'
  if (['tiro de meta'].some(term => k.includes(term))) return 'Tiros de meta'
  if (['escanteio', 'bola parada'].some(term => k.includes(term))) return 'Bola parada'
  if (['falta', 'cartão', 'cartao'].some(term => k.includes(term))) return 'Disciplina'
  if (['ação', 'acoes', 'ações', 'condução', 'conducao', 'índice', 'indice', 'distância', 'distancia'].some(term => k.includes(term))) return 'Volume e controle'
  return 'Outras métricas'
}

export const MATCH_CATEGORY_ORDER = [
  'Ataque e finalização',
  'Construção e progressão',
  'Duelos e 1x1',
  'Pressão e recuperações',
  'Perdas e segurança',
  'Bola parada',
  'Tiros de meta',
  'Disciplina',
  'Volume e controle',
  'Outras métricas',
]

export function numericMetricKeys(homeMetrics, awayMetrics) {
  const keys = Array.from(new Set([...Object.keys(homeMetrics || {}), ...Object.keys(awayMetrics || {})]))
  return keys.filter(key => {
    if (isMatchIdentityColumn(key)) return false
    return isNumeric(homeMetrics?.[key]) || isNumeric(awayMetrics?.[key])
  })
}

export function formatMatchDate(value) {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function isClubMatch(match) {
  return isCurrentClubIdentity(match?.home_team || match?.homeTeam, match?.home_code || match?.homeCode) ||
    isCurrentClubIdentity(match?.away_team || match?.awayTeam, match?.away_code || match?.awayCode)
}

export function metricWinner(metric, homeValue, awayValue) {
  const home = toNumber(homeValue)
  const away = toNumber(awayValue)
  if (home === null || away === null || home === away) return null
  const lowerBetter = ['perda', 'falta', 'cartão', 'cartao', 'duelos perdidos', 'dribles falhados', 'domínio incorreto', 'dominio incorreto'].some(term => String(metric).toLowerCase().includes(term))
  if (lowerBetter) return home < away ? 'home' : 'away'
  return home > away ? 'home' : 'away'
}
