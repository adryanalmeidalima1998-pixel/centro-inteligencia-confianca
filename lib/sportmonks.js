/** Integração Sportmonks — Associação Desportiva Confiança */
const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_TOKEN
const BASE_URL = 'https://api.sportmonks.com/v3/football'
const SEASON_SERIE_C_2026 = Number(process.env.SPORTMONKS_SERIE_C_SEASON_ID || 27199)
let cachedTeamId = Number(process.env.SPORTMONKS_TEAM_ID || 0) || null

export async function fetchSportmonks(endpoint, params = {}) {
  if (!SPORTMONKS_TOKEN) throw new Error('SPORTMONKS_API_TOKEN não configurado.')
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.append('api_token', SPORTMONKS_TOKEN)
  Object.keys(params).forEach(key => params[key] != null && url.searchParams.append(key, params[key]))
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Sportmonks API error: ${res.status}`)
  const json = await res.json()
  return json.data
}

export async function getConfiancaTeamId() {
  if (cachedTeamId) return cachedTeamId
  const teams = await fetchSportmonks('teams/search/Confianca', { per_page: 50 })
  const normalized = String => String.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const exact = (teams || []).find(t => normalized(t.name || '').includes('confianca'))
  if (!exact?.id) throw new Error('Confiança não localizado na Sportmonks.')
  cachedTeamId = Number(exact.id)
  return cachedTeamId
}

export async function getGuaraniFixtures(seasonId = SEASON_SERIE_C_2026) {
  const teamId = await getConfiancaTeamId()
  return fetchSportmonks('fixtures', {
    filters: `fixtureTeams:${teamId};fixtureSeasons:${seasonId}`,
    include: 'participants;scores;venue;league;state',
  })
}

export async function getSerieCStandings() {
  return fetchSportmonks(`standings/seasons/${SEASON_SERIE_C_2026}`, { include: 'participant' })
}
