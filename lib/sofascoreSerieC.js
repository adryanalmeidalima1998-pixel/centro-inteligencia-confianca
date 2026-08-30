import { normalizeSerieCTeamKey } from './serieCTeamNames'

export const SOFASCORE_TOURNAMENT_ID = 27213
export const SOFASCORE_UNIQUE_TOURNAMENT_ID = 1281
export const SOFASCORE_SEASON_ID = 90642
export const SOFASCORE_SERIE_C_URL = 'https://www.sofascore.com/pt/football/tournament/brazil/brasileirao-serie-c/1281#id:90642'
export const SOFASCORE_SERIE_C_WIDGET_URL = 'https://widgets.sofascore.com/pt-BR/embed/tournament/27213/season/90642/standings/Brasileiro%20Serie%20C%202026?widgetTitle=Brasileiro%20Serie%20C%202026&showCompetitionLogo=true'

// O endpoint api.sofascore.com aceita CORS. Por isso, a página tenta lê-lo
// diretamente no navegador antes de recorrer à rota server-side da Vercel.
export const SOFASCORE_STANDINGS_URLS = [
  `https://api.sofascore.com/api/v1/tournament/${SOFASCORE_TOURNAMENT_ID}/season/${SOFASCORE_SEASON_ID}/standings/total`,
  `https://www.sofascore.com/api/v1/tournament/${SOFASCORE_TOURNAMENT_ID}/season/${SOFASCORE_SEASON_ID}/standings/total`,
  `https://api.sofascore.com/api/v1/unique-tournament/${SOFASCORE_UNIQUE_TOURNAMENT_ID}/season/${SOFASCORE_SEASON_ID}/standings/total`,
  `https://www.sofascore.com/api/v1/unique-tournament/${SOFASCORE_UNIQUE_TOURNAMENT_ID}/season/${SOFASCORE_SEASON_ID}/standings/total`,
]

const CANONICAL_TEAMS = new Map([
  ['amazonas', 'Amazonas'],
  ['anapolis', 'Anápolis'],
  ['barra', 'Barra'],
  ['botafogo pb', 'Botafogo-PB'],
  ['brusque', 'Brusque'],
  ['caxias', 'Caxias'],
  ['confianca', 'Confiança'],
  ['ferroviaria', 'Ferroviária'],
  ['figueirense', 'Figueirense'],
  ['floresta ec', 'Floresta'],
  ['confianca', 'Confiança'],
  ['inter de limeira', 'Inter de Limeira'],
  ['itabaiana', 'Itabaiana'],
  ['ituano', 'Ituano'],
  ['maranhao', 'Maranhão'],
  ['maringa', 'Maringá'],
  ['paysandu', 'Paysandu'],
  ['santa cruz', 'Santa Cruz'],
  ['volta redonda', 'Volta Redonda'],
  ['ypiranga erechim', 'Ypiranga-RS'],
])

const SOFASCORE_ALIASES = new Map([
  ['amazonas fc', 'amazonas'],
  ['amazonas futebol clube', 'amazonas'],
  ['anapolis fc', 'anapolis'],
  ['anapolis futebol clube', 'anapolis'],
  ['barra fc', 'barra'],
  ['barra futebol clube', 'barra'],
  ['botafogo paraiba', 'botafogo pb'],
  ['botafogo pb', 'botafogo pb'],
  ['botafogo futebol clube pb', 'botafogo pb'],
  ['brusque fc', 'brusque'],
  ['caxias do sul', 'caxias'],
  ['ser caxias', 'caxias'],
  ['sociedade esportiva e recreativa caxias do sul', 'caxias'],
  ['ad confianca', 'confianca'],
  ['associacao desportiva confianca', 'confianca'],
  ['ferroviaria sp', 'ferroviaria'],
  ['associacao ferroviaria de esportes', 'ferroviaria'],
  ['figueirense fc', 'figueirense'],
  ['floresta', 'floresta ec'],
  ['floresta esporte clube', 'floresta ec'],
  ['internacional de limeira', 'inter de limeira'],
  ['inter limeira', 'inter de limeira'],
  ['aa internacional', 'inter de limeira'],
  ['aa internacional de limeira', 'inter de limeira'],
  ['associacao atletica internacional', 'inter de limeira'],
  ['ao itabaiana', 'itabaiana'],
  ['associacao olimpica de itabaiana', 'itabaiana'],
  ['ituano fc', 'ituano'],
  ['maranhao ac', 'maranhao'],
  ['maranhao atletico clube', 'maranhao'],
  ['maringa fc', 'maringa'],
  ['paysandu sc', 'paysandu'],
  ['paysandu sport club', 'paysandu'],
  ['santa cruz fc', 'santa cruz'],
  ['santa cruz pe', 'santa cruz'],
  ['volta redonda fc', 'volta redonda'],
  ['ypiranga', 'ypiranga erechim'],
  ['ypiranga fc', 'ypiranga erechim'],
  ['ypiranga rs', 'ypiranga erechim'],
])

function finiteNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function cleanTeamName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function keyContainsAll(key, words) {
  return words.every(word => key.includes(word))
}

function inferCanonicalKey(normalized) {
  if (!normalized) return ''
  const alias = SOFASCORE_ALIASES.get(normalized)
  if (alias) return alias
  if (CANONICAL_TEAMS.has(normalized)) return normalized

  const rules = [
    [['inter', 'limeira'], 'inter de limeira'],
    [['internacional', 'limeira'], 'inter de limeira'],
    [['botafogo', 'pb'], 'botafogo pb'],
    [['botafogo', 'paraiba'], 'botafogo pb'],
    [['volta', 'redonda'], 'volta redonda'],
    [['santa', 'cruz'], 'santa cruz'],
    [['floresta'], 'floresta ec'],
    [['ypiranga'], 'ypiranga erechim'],
    [['ferroviaria'], 'ferroviaria'],
    [['figueirense'], 'figueirense'],
    [['confianca'], 'confianca'],
    [['itabaiana'], 'itabaiana'],
    [['maranhao'], 'maranhao'],
    [['maringa'], 'maringa'],
    [['paysandu'], 'paysandu'],
    [['brusque'], 'brusque'],
    [['confianca'], 'confianca'],
    [['amazonas'], 'amazonas'],
    [['anapolis'], 'anapolis'],
    [['ituano'], 'ituano'],
    [['caxias'], 'caxias'],
    [['barra'], 'barra'],
  ]

  return rules.find(([words]) => keyContainsAll(normalized, words))?.[1] || normalized
}

function canonicalTeamName(value) {
  const rawName = cleanTeamName(value)
  const normalized = normalizeSerieCTeamKey(rawName)
  const key = inferCanonicalKey(normalized)
  return {
    key,
    name: CANONICAL_TEAMS.get(key) || rawName,
    rawName,
  }
}

function selectStandingTable(payload) {
  const standings = Array.isArray(payload?.standings) ? payload.standings : []
  const candidates = standings
    .filter(table => Array.isArray(table?.rows) && table.rows.length)
    .sort((a, b) => {
      const aTotal = String(a?.type || '').toLowerCase() === 'total' ? 1 : 0
      const bTotal = String(b?.type || '').toLowerCase() === 'total' ? 1 : 0
      return bTotal - aTotal || b.rows.length - a.rows.length
    })

  return candidates[0] || null
}

function parseStandingRow(row, fallbackPosition) {
  const rawTeamName = row?.team?.name || row?.team?.shortName || row?.team?.nameCode
  const team = canonicalTeamName(rawTeamName)
  if (!team.name || !team.key) return null

  const position = finiteNumber(row?.position, fallbackPosition)
  const played = finiteNumber(row?.matches ?? row?.played, 0)
  const won = finiteNumber(row?.wins ?? row?.won, 0)
  const drawn = finiteNumber(row?.draws ?? row?.drawn, 0)
  const lost = finiteNumber(row?.losses ?? row?.lost, 0)
  const goalsFor = finiteNumber(row?.scoresFor ?? row?.goalsFor, 0)
  const goalsAgainst = finiteNumber(row?.scoresAgainst ?? row?.goalsAgainst, 0)
  const points = finiteNumber(row?.points, 0)
  const formattedDifference = String(row?.scoreDiffFormatted || '').replace(/[+−–—]/g, match => (match === '+' ? '' : '-'))
  const goalDifference = finiteNumber(row?.goalDifference, finiteNumber(formattedDifference, goalsFor - goalsAgainst))

  if (![position, played, won, drawn, lost, goalsFor, goalsAgainst, points, goalDifference].every(Number.isFinite)) {
    return null
  }

  return {
    position,
    team: team.name,
    teamKey: team.key,
    providerTeamName: team.rawName,
    points,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference,
    providerTeamId: finiteNumber(row?.team?.id),
  }
}

export function parseSofaScoreSerieC(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input
  const table = selectStandingTable(payload)
  if (!table) throw new Error('A resposta do Sofascore não contém uma tabela de classificação.')

  const parsedRows = table.rows
    .map((row, index) => parseStandingRow(row, index + 1))
    .filter(Boolean)
    .sort((a, b) => a.position - b.position)

  // Não descartamos equipes apenas porque o nome mudou no provedor. A posição é
  // a chave principal e os aliases servem somente para casar com as métricas Wyscout.
  const rowsByPosition = new Map()
  for (const row of parsedRows) {
    if (!rowsByPosition.has(row.position)) rowsByPosition.set(row.position, row)
  }
  const rows = [...rowsByPosition.values()].sort((a, b) => a.position - b.position)

  if (rows.length !== 20) {
    const received = parsedRows.map(row => `${row.position}:${row.providerTeamName || row.team}`).join(', ')
    throw new Error(`Tabela incompleta do Sofascore: ${rows.length}/20 equipes${received ? ` (${received})` : ''}.`)
  }

  if (!rows.every((row, index) => row.position === index + 1)) {
    throw new Error('A tabela do Sofascore não contém as posições de 1 a 20 em sequência.')
  }

  const providerIds = rows.map(row => row.providerTeamId).filter(Number.isFinite)
  if (providerIds.length === 20 && new Set(providerIds).size !== 20) {
    throw new Error('A tabela do Sofascore contém equipes repetidas.')
  }

  const updatedAtTimestamp = finiteNumber(table.updatedAtTimestamp ?? payload?.updatedAtTimestamp)
  const updatedAtMilliseconds = updatedAtTimestamp
    ? (updatedAtTimestamp > 1_000_000_000_000 ? updatedAtTimestamp : updatedAtTimestamp * 1000)
    : null
  const updatedAt = updatedAtMilliseconds
    ? new Date(updatedAtMilliseconds).toISOString()
    : null
  const round = Math.max(...rows.map(row => row.played), 0)
  const completedMatches = Math.floor(rows.reduce((sum, row) => sum + row.played, 0) / 2)

  return {
    rows,
    round,
    completedMatches,
    updatedAt,
    tableId: finiteNumber(table.id),
  }
}
