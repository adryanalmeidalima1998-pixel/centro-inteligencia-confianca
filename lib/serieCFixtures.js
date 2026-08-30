import { normalizeSerieCTeamKey } from './serieCTeamNames.js'

const TEAMS = new Map([
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

const EXTRA_ALIASES = new Map([
  ['associacao ferroviaria de esportes', 'ferroviaria'],
  ['ferroviaria sp', 'ferroviaria'],
  ['associacao atletica internacional', 'inter de limeira'],
  ['aa internacional', 'inter de limeira'],
  ['aa internacional de limeira sp', 'inter de limeira'],
  ['internacional de limeira sp', 'inter de limeira'],
  ['inter limeira', 'inter de limeira'],
  ['internacional de limeira', 'inter de limeira'],
  ['botafogo paraiba', 'botafogo pb'],
  ['botafogo fc', 'botafogo pb'],
  ['caxias do sul', 'caxias'],
  ['ser caxias', 'caxias'],
  ['ypiranga rs', 'ypiranga erechim'],
  ['ypiranga fc', 'ypiranga erechim'],
  ['ypiranga erechim', 'ypiranga erechim'],
  ['floresta ec', 'floresta ec'],
  ['ituano sp', 'ituano'],
  ['ituano sp', 'ituano'],
  ['maranhao ma', 'maranhao'],
  ['itabaiana se', 'itabaiana'],
  ['anapolis go', 'anapolis'],
  ['brusque sc', 'brusque'],
  ['barra sc', 'barra'],
  ['santa cruz pe', 'santa cruz'],
])

function clean(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`~]/g, '')
    .replace(/\\([:|-])/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalized(value) {
  const base = normalizeSerieCTeamKey(clean(value))
  return EXTRA_ALIASES.get(base) || base
}

export function canonicalFixtureTeam(value) {
  const key = normalized(value)
  if (TEAMS.has(key)) return { key, name: TEAMS.get(key), providerName: clean(value) }
  const candidates = [...TEAMS.keys()].sort((a, b) => b.length - a.length)
  const matchingKey = candidates.find(candidate => key === candidate || key.startsWith(`${candidate} `) || key.endsWith(` ${candidate}`))
  if (matchingKey) return { key: matchingKey, name: TEAMS.get(matchingKey), providerName: clean(value) }
  if (key.includes('internacional') && key.includes('limeira')) return { key: 'inter de limeira', name: TEAMS.get('inter de limeira'), providerName: clean(value) }
  if (key.includes('botafogo') && (key.includes('pb') || key.includes('paraiba'))) return { key: 'botafogo pb', name: TEAMS.get('botafogo pb'), providerName: clean(value) }
  if (key.includes('ypiranga')) return { key: 'ypiranga erechim', name: TEAMS.get('ypiranga erechim'), providerName: clean(value) }
  if (key.includes('ferroviaria')) return { key: 'ferroviaria', name: TEAMS.get('ferroviaria'), providerName: clean(value) }
  return null
}

export function parseFixtureDate(value, fallbackYear = 2026) {
  const text = clean(value)
  const match = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  const short = text.match(/(\d{1,2})[./-](\d{1,2})/)
  if (short) return `${fallbackYear}-${short[2].padStart(2, '0')}-${short[1].padStart(2, '0')}`
  return null
}

function fixtureStatus(homeGoals, awayGoals) {
  return Number.isFinite(homeGoals) && Number.isFinite(awayGoals) ? 'finished' : 'scheduled'
}

export function makeFixture({ season = '2026', round = null, date = null, time = null, home, away, homeGoals = null, awayGoals = null, source = 'unknown', sourceUrl = null, providerId = null }) {
  const homeTeam = typeof home === 'string' ? canonicalFixtureTeam(home) : home
  const awayTeam = typeof away === 'string' ? canonicalFixtureTeam(away) : away
  if (!homeTeam || !awayTeam || homeTeam.key === awayTeam.key) return null
  const parsedHomeGoals = homeGoals === null || homeGoals === undefined || homeGoals === '' ? null : Number(homeGoals)
  const parsedAwayGoals = awayGoals === null || awayGoals === undefined || awayGoals === '' ? null : Number(awayGoals)
  const safeHomeGoals = Number.isFinite(parsedHomeGoals) ? parsedHomeGoals : null
  const safeAwayGoals = Number.isFinite(parsedAwayGoals) ? parsedAwayGoals : null
  const status = fixtureStatus(safeHomeGoals, safeAwayGoals)
  return {
    id: `${season}|${round || 0}|${date || ''}|${homeTeam.key}|${awayTeam.key}`,
    season,
    round: Number.isFinite(Number(round)) ? Number(round) : null,
    date: date || null,
    time: time || null,
    home: homeTeam.name,
    away: awayTeam.name,
    homeKey: homeTeam.key,
    awayKey: awayTeam.key,
    homeGoals: safeHomeGoals,
    awayGoals: safeAwayGoals,
    status,
    source,
    sourceUrl,
    providerId: providerId || null,
  }
}

export function fixtureKey(fixture) {
  return `${fixture.date || ''}|${fixture.homeKey}|${fixture.awayKey}`
}

export function mergeFixtures(...lists) {
  const merged = new Map()
  for (const list of lists) {
    for (const fixture of Array.isArray(list) ? list : []) {
      if (!fixture?.homeKey || !fixture?.awayKey) continue
      const key = fixtureKey(fixture)
      const previous = merged.get(key)
      if (!previous || (previous.status !== 'finished' && fixture.status === 'finished') || (!previous.time && fixture.time)) {
        merged.set(key, { ...previous, ...fixture })
      }
    }
  }
  return [...merged.values()].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || (a.round || 0) - (b.round || 0) || a.home.localeCompare(b.home, 'pt-BR'))
}

function markdownCells(line) {
  return line.split('|').map(clean).filter(Boolean)
}

export function parseTransfermarktFixturesText(text, { source = 'Transfermarkt', sourceUrl = null } = {}) {
  const fixtures = []
  let currentRound = null
  let currentDate = null
  const lines = String(text || '').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    const roundMatch = trimmed.match(/(?:^|\s)(\d{1,2})\s*\\?\.?\s*Rodada/i)
    if (roundMatch) {
      currentRound = Number(roundMatch[1])
      continue
    }
    const date = parseFixtureDate(trimmed)
    if (date && !trimmed.includes('|')) {
      currentDate = date
      continue
    }
    if (!trimmed.includes('|')) continue
    const cells = markdownCells(trimmed)
    if (cells.length < 4) continue
    const scoreIndex = cells.findIndex(cell => /^\d+\s*:\s*\d+$/.test(cell) || /^-\s*:\s*-$/i.test(cell))
    if (scoreIndex < 0) continue
    const before = cells.slice(0, scoreIndex).map(canonicalFixtureTeam).filter(Boolean)
    const after = cells.slice(scoreIndex + 1).map(canonicalFixtureTeam).filter(Boolean)
    if (!before.length || !after.length) continue
    const home = before.at(-1)
    const away = after[0]
    const score = cells[scoreIndex].match(/^(\d+)\s*:\s*(\d+)$/)
    const rowDate = parseFixtureDate(cells[0]) || currentDate
    const time = cells.find(cell => /^\d{1,2}:\d{2}$/.test(cell)) || null
    const fixture = makeFixture({
      round: currentRound,
      date: rowDate,
      time,
      home,
      away,
      homeGoals: score ? Number(score[1]) : null,
      awayGoals: score ? Number(score[2]) : null,
      source,
      sourceUrl,
    })
    if (fixture) fixtures.push(fixture)
  }

  return mergeFixtures(fixtures)
}

export function parse365ScoresFixtures(text, { source = '365Scores', sourceUrl = null } = {}) {
  const fixtures = []
  let currentRound = null
  let currentDate = null
  const lines = String(text || '').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    const roundMatch = trimmed.match(/^Rodada\s+(\d{1,2})/i)
    if (roundMatch) {
      currentRound = Number(roundMatch[1])
      continue
    }
    const date = parseFixtureDate(trimmed)
    if (date && !trimmed.startsWith('[')) {
      currentDate = date
      continue
    }
    const match = trimmed.match(/^\[(.*)\]\((https?:\/\/[^)]+)\)$/)
    if (!match) continue
    const raw = clean(match[1])
    const providerId = match[2].match(/#id=(\d+)/)?.[1] || null
    const timeMatch = raw.match(/\s(\d{1,2}:\d{2})\s/)
    const time = timeMatch?.[1] || null
    const withoutTime = raw.replace(new RegExp(`\\s${time?.replace(':', '\\:')}\\s`), ' ')
    const names = withoutTime.split(/\s{2,}/).map(part => part.trim()).filter(Boolean)
    let home = names.map(canonicalFixtureTeam).find(Boolean)
    let away = null
    if (names.length >= 2) {
      for (let index = names.length - 1; index >= 0; index -= 1) {
        const candidate = canonicalFixtureTeam(names[index])
        if (candidate && (!home || candidate.key !== home.key)) {
          away = candidate
          break
        }
      }
    }
    if (!home || !away) {
      const known = [...TEAMS.entries()].map(([key, name]) => ({ key, name, index: raw.toLocaleLowerCase('pt-BR').indexOf(name.toLocaleLowerCase('pt-BR')) })).filter(item => item.index >= 0).sort((a, b) => a.index - b.index)
      if (known.length >= 2) {
        home = { key: known[0].key, name: known[0].name }
        away = { key: known.at(-1).key, name: known.at(-1).name }
      }
    }
    const fixture = makeFixture({ round: currentRound, date: currentDate, time, home, away, source, sourceUrl, providerId })
    if (fixture) fixtures.push(fixture)
  }

  return mergeFixtures(fixtures)
}

export function splitFixtures(fixtures, now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  return {
    completed: fixtures.filter(fixture => fixture.status === 'finished'),
    upcoming: fixtures.filter(fixture => fixture.status !== 'finished' && (!fixture.date || fixture.date >= today)),
  }
}
