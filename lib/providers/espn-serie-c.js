/**
 * Adaptador da ESPN para o Brasileirão Série C.
 *
 * A camada de domínio da aplicação não deve depender do formato bruto da ESPN.
 * Este arquivo concentra chamadas externas, parsing e normalização básica.
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.3'
const DEFAULT_TIMEOUT_MS = 8000

export const SERIE_C_2026_DATE_RANGES = [
  '20260401-20260430',
  '20260501-20260531',
  '20260601-20260630',
  '20260701-20260731',
  '20260801-20260831',
  '20260901-20260930',
  '20261001-20261031',
  '20261101-20261130',
]

export function normalizeTeamName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+(fc|sc|ac|ec|aa|se|cr|cf|futebol|clube|esporte|sport)$/gi, '')
    .replace(/^(ad|aa|ec|sc|ac|fc|cf|esporte)\s+/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

const ESPN_NAME_MAP = {
  confianca: 'confianca',
  adconfianca: 'confianca',
  guaranifc: 'guarani',
  maranhao: 'maranhaoa',
  maranhaoac: 'maranhaoa',
  voltaredonda: 'voltaredonda',
  itabaiana: 'aoitabaiana',
  adoitabaiana: 'aoitabaiana',
  ferroviaria: 'ferroviaria',
  ferroviariafc: 'ferroviaria',
  santacruz: 'santacruz',
  maringa: 'maringafc',
  maringafc: 'maringafc',
  ituano: 'ituano',
  barra: 'barrafc',
  barrafc: 'barrafc',
  amazonas: 'amazonasfc',
  amazonasfc: 'amazonasfc',
  caxias: 'caxias',
  eccaxias: 'caxias',
  figueirense: 'figueirense',
  floresta: 'floresta',
  paysandu: 'paysandu',
  paysandusc: 'paysandu',
  interdelimeira: 'interdelimeira',
  anapolis: 'anapolis',
  anapolisfc: 'anapolis',
  ypiranga: 'ypiranga',
  ypirangafc: 'ypiranga',
  botafogopb: 'botafogopb',
  botafogojp: 'botafogopb',
  brusque: 'brusque',
}

export function resolveEspnTeamName(name) {
  const key = normalizeTeamName(name)
  return ESPN_NAME_MAP[key] || key
}

export function teamsMatch(espnName, localName) {
  return resolveEspnTeamName(espnName) === normalizeTeamName(localName)
}

async function fetchJson(url, { revalidate = 300 } = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Centro-Inteligencia-Confianca/1.0',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    next: { revalidate },
  })
  if (!response.ok) throw new Error(`ESPN retornou HTTP ${response.status}`)
  return response.json()
}

export async function fetchSerieCScoreboard(dateRange) {
  const url = `${ESPN_BASE}/scoreboard?dates=${encodeURIComponent(dateRange)}&limit=100`
  return fetchJson(url, { revalidate: 300 })
}

export function parseEspnEvent(event) {
  const competition = event?.competitions?.[0]
  if (!competition) return null

  const competitors = competition.competitors || []
  const home = competitors.find(item => item.homeAway === 'home')
  const away = competitors.find(item => item.homeAway === 'away')
  if (!home || !away) return null

  const statusType = competition.status?.type || event.status?.type || {}
  const completed = statusType.completed === true
  const live = statusType.name === 'STATUS_IN_PROGRESS'
  const status = completed ? 'final' : live ? 'live' : 'scheduled'

  const date = event.date ? new Date(event.date) : null
  if (!date || Number.isNaN(date.getTime())) return null

  // A data da ESPN vem em UTC. Para jogos nacionais, mantemos a data local BR.
  const brDate = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  const dateKey = brDate.toISOString().slice(0, 10)

  return {
    espnId: String(event.id || ''),
    date: date.toISOString(),
    dateKey,
    competition: event.league?.name || event.season?.name || 'Brasileirão Série C',
    homeName: home.team?.displayName || home.team?.name || '',
    awayName: away.team?.displayName || away.team?.name || '',
    homeId: home.team?.id || null,
    awayId: away.team?.id || null,
    homeScore: completed || live ? Number.parseInt(home.score, 10) : null,
    awayScore: completed || live ? Number.parseInt(away.score, 10) : null,
    status,
    completed,
    live,
    venue: competition.venue?.fullName || competition.venue?.address?.city || null,
  }
}

export async function fetchSerieCSeasonEvents(dateRanges = SERIE_C_2026_DATE_RANGES) {
  const settled = await Promise.allSettled(
    dateRanges.map(async range => {
      const payload = await fetchSerieCScoreboard(range)
      return (payload.events || []).map(parseEspnEvent).filter(Boolean)
    })
  )

  const events = []
  for (const result of settled) {
    if (result.status === 'fulfilled') events.push(...result.value)
  }

  const unique = new Map()
  for (const event of events) {
    const key = event.espnId || `${event.dateKey}|${event.homeName}|${event.awayName}`
    unique.set(key, event)
  }
  return [...unique.values()].sort((a, b) => new Date(a.date) - new Date(b.date))
}

export async function fetchSerieCStandings() {
  const data = await fetchJson(`${ESPN_BASE}/standings`, { revalidate: 900 })
  const groups = data?.standings?.entries
    ? [{ name: 'Geral', entries: data.standings.entries }]
    : (data?.children || []).map(group => ({
        name: group.name || group.abbreviation || 'Geral',
        entries: group.standings?.entries || [],
      }))

  const rows = []
  for (const group of groups) {
    for (const entry of group.entries) {
      const stats = Object.fromEntries((entry.stats || []).map(item => [item.name, item.value]))
      rows.push({
        teamName: entry.team?.displayName || entry.team?.name || '',
        position: entry.note?.rank ?? stats.rank ?? null,
        pts: stats.points ?? stats.pts ?? 0,
        pj: stats.gamesPlayed ?? 0,
        vit: stats.wins ?? 0,
        emp: stats.ties ?? 0,
        der: stats.losses ?? 0,
        gp: stats.pointsFor ?? stats.goalsFor ?? 0,
        gc: stats.pointsAgainst ?? stats.goalsAgainst ?? 0,
        sg: stats.pointDifferential ?? stats.goalDifference ?? 0,
        aprov: stats.winPercent != null ? +(stats.winPercent * 100).toFixed(1) : 0,
        group: group.name,
      })
    }
  }
  return rows.sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || b.pts - a.pts)
}
