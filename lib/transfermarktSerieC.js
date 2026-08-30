import { normalizeSerieCTeamKey } from './serieCTeamNames'

import { parseTransfermarktFixturesText, splitFixtures } from './serieCFixtures'

export const TRANSFERMARKT_SERIE_C_URL = 'https://www.transfermarkt.com.br/campeonato-brasileiro-serie-c/gesamtspielplan/pokalwettbewerb/BRA3/saison_id/2025'
export const TRANSFERMARKT_SERIE_C_URLS = [
  TRANSFERMARKT_SERIE_C_URL,
  'https://www.transfermarkt.com/campeonato-brasileiro-serie-c/gesamtspielplan/pokalwettbewerb/BRA3/saison_id/2025',
  'https://www.transfermarkt.pt/campeonato-brasileiro-serie-c/gesamtspielplan/pokalwettbewerb/BRA3/saison_id/2025',
]
const SERIE_C_TEAMS = [
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
]

const TEAM_NAME_BY_KEY = new Map(SERIE_C_TEAMS)
const TEAM_SEARCH_TERMS = [
  ['aa internacional de limeira', 'inter de limeira'],
  ['internacional de limeira', 'inter de limeira'],
  ['inter limeira', 'inter de limeira'],
  ['botafogo pb', 'botafogo pb'],
  ['botafogo fc', 'botafogo pb'],
  ['ypiranga rs', 'ypiranga erechim'],
  ['ypiranga fc', 'ypiranga erechim'],
  ['ser caxias do sul', 'caxias'],
  ['caxias rs', 'caxias'],
  ['santa cruz pe', 'santa cruz'],
  ['floresta ce', 'floresta ec'],
  ...SERIE_C_TEAMS.map(([key]) => [key, key]),
].sort((a, b) => b[0].length - a[0].length)

function decodeHtmlEntities(value) {
  const named = {
    aacute: 'á', acirc: 'â', agrave: 'à', amp: '&', apos: "'", atilde: 'ã', auml: 'ä',
    ccedil: 'ç', deg: '°', eacute: 'é', ecirc: 'ê', egrave: 'è', euml: 'ë', gt: '>',
    hellip: '…', iacute: 'í', icirc: 'î', laquo: '«', ldquo: '“', lsquo: '‘', lt: '<',
    middot: '·', nbsp: ' ', ndash: '–', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
    quot: '"', raquo: '»', rdquo: '”', rsquo: '’', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  }

  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLocaleLowerCase('en-US')] ?? entity)
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
}

function cleanText(value) {
  return decodeHtmlEntities(stripMarkdown(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function attributeValue(attrs, name) {
  const match = String(attrs || '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '')
}

function extractBlocks(html, tag) {
  const blocks = []
  const expression = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  let match
  while ((match = expression.exec(String(html || '')))) {
    blocks.push({ attrs: match[1], html: match[2], raw: match[0] })
  }
  return blocks
}

function extractAnchors(html) {
  return extractBlocks(html, 'a').map(anchor => ({
    href: attributeValue(anchor.attrs, 'href'),
    title: attributeValue(anchor.attrs, 'title'),
    text: cleanText(anchor.html),
    html: anchor.html,
  }))
}

function isClubHref(href) {
  const path = String(href || '')
  return /\/(?:startseite|spielplan|kader|transfers|datenfakten|verein)\/verein\/\d+/i.test(path)
    || /\/verein\/\d+/i.test(path)
}

function numberFromText(value) {
  const text = cleanText(value).replace(/[−–—]/g, '-').replace(/^\+/, '')
  return /^-?\d+$/.test(text) ? Number(text) : null
}

function integersFromText(value) {
  return (cleanText(value).replace(/[−–—]/g, '-').match(/[+-]?\d+/g) || []).map(Number)
}

function goalPairFromText(value) {
  const match = cleanText(value).match(/^(\d+)\s*:\s*(\d+)$/)
  return match ? [Number(match[1]), Number(match[2])] : null
}

function canonicalTeam(value) {
  const raw = cleanText(value)
  if (!raw) return null
  const normalizedWhole = normalizeSerieCTeamKey(raw)
  if (TEAM_NAME_BY_KEY.has(normalizedWhole)) return { key: normalizedWhole, name: TEAM_NAME_BY_KEY.get(normalizedWhole) }

  const plain = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const [term, key] of TEAM_SEARCH_TERMS) {
    if (plain === term || plain.includes(` ${term} `) || plain.startsWith(`${term} `) || plain.endsWith(` ${term}`)) {
      return { key, name: TEAM_NAME_BY_KEY.get(key) }
    }
  }
  return null
}

function parseTransfermarktStandingCells(cells) {
  if (cells.length < 5) return null
  const texts = cells.map(cleanText).filter(Boolean)
  if (texts.length < 5) return null

  const positionIndex = texts.findIndex(text => {
    const number = numberFromText(text.replace(/\.$/, ''))
    return Number.isInteger(number) && number >= 1 && number <= 20
  })
  if (positionIndex < 0) return null
  const position = numberFromText(texts[positionIndex].replace(/\.$/, ''))

  let teamIndex = -1
  let team = null
  for (let index = positionIndex + 1; index < texts.length; index += 1) {
    const candidate = canonicalTeam(texts[index])
    if (!candidate) continue
    teamIndex = index
    team = candidate
    break
  }
  if (!team || teamIndex < 0) return null

  const values = texts.slice(teamIndex + 1)
  const goalsIndex = values.findIndex(value => goalPairFromText(value))
  if (goalsIndex < 0) return null

  const goals = goalPairFromText(values[goalsIndex])
  const beforeGoals = values.slice(0, goalsIndex).map(numberFromText).filter(Number.isFinite)
  const afterGoals = values.slice(goalsIndex + 1).map(numberFromText).filter(Number.isFinite)
  if (!beforeGoals.length || !afterGoals.length) return null

  const played = beforeGoals[0]
  const points = afterGoals.at(-1)
  const hasDetailedRecord = beforeGoals.length >= 4
  const won = hasDetailedRecord ? beforeGoals[1] : null
  const drawn = hasDetailedRecord ? beforeGoals[2] : null
  const lost = hasDetailedRecord ? beforeGoals[3] : null
  const goalDifference = hasDetailedRecord
    ? (afterGoals.length >= 2 ? afterGoals[0] : goals[0] - goals[1])
    : (beforeGoals.length >= 2 ? beforeGoals.at(-1) : goals[0] - goals[1])

  if (![position, played, points, goals[0], goals[1], goalDifference].every(Number.isFinite)) return null
  if (played < 0 || played > 40 || points < 0 || points > 120) return null

  return {
    position,
    team: team.name,
    teamKey: team.key,
    points,
    played,
    won,
    drawn,
    lost,
    goalsFor: goals[0],
    goalsAgainst: goals[1],
    goalDifference,
  }
}

function parseStandingRow(rowHtml) {
  const cells = extractBlocks(rowHtml, 'td')
  if (cells.length < 5) return null

  const texts = cells.map(cell => cleanText(cell.html))
  for (let index = 0; index < cells.length; index += 1) {
    const anchors = extractAnchors(cells[index].html)
    const clubAnchor = anchors.find(anchor => isClubHref(anchor.href) && canonicalTeam(anchor.text || anchor.title))
    if (clubAnchor) texts[index] = canonicalTeam(clubAnchor.text || clubAnchor.title)?.name || texts[index]
  }
  return parseTransfermarktStandingCells(texts)
}

function normalizeStandingOrder(rows) {
  const uniqueTeams = new Map()
  for (const row of rows) {
    const key = row.teamKey || normalizeSerieCTeamKey(row.team)
    if (!key || uniqueTeams.has(key)) continue
    uniqueTeams.set(key, { ...row, teamKey: key })
  }

  return [...uniqueTeams.values()].map((row, index) => ({
    ...row,
    // O Transfermarkt pode repetir a posição exibida em empates (ex.: dois clubes em 9º).
    // Para o dashboard e para a projeção dos grupos, vale a ordem real das linhas da tabela.
    position: index + 1,
    providerPosition: row.position,
  }))
}

function parseStandingsTables(html) {
  const tables = extractBlocks(html, 'table')
  let bestRows = []

  for (const table of tables) {
    const parsedRows = extractBlocks(table.html, 'tr')
      .map(row => parseStandingRow(row.raw))
      .filter(Boolean)
    const ordered = normalizeStandingOrder(parsedRows)
    if (ordered.length > bestRows.length) bestRows = ordered
    if (isCompleteTable(ordered)) return ordered
  }

  return bestRows
}

function markdownRows(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.includes('|'))
    .map(line => line.split('|').map(cleanText).filter(Boolean))
    .filter(cells => cells.length >= 4 && !cells.every(cell => /^:?-{2,}:?$/.test(cell)))
}

function parseStandingsText(text) {
  const parsedRows = markdownRows(text)
    .map(parseTransfermarktStandingCells)
    .filter(Boolean)
  return normalizeStandingOrder(parsedRows)
}

function parseCompletedMatchesHtml(html) {
  const matches = []
  const seen = new Set()

  for (const row of extractBlocks(html, 'tr')) {
    const anchors = extractAnchors(row.raw)
    const scoreAnchor = anchors.find(anchor => /^\d+\s*:\s*\d+$/.test(anchor.text))
    if (!scoreAnchor) continue

    const clubs = []
    const clubKeys = new Set()
    for (const anchor of anchors) {
      if (!isClubHref(anchor.href)) continue
      const team = canonicalTeam(anchor.text || anchor.title)
      if (!team || clubKeys.has(team.key)) continue
      clubKeys.add(team.key)
      clubs.push(team)
    }
    if (clubs.length < 2) continue

    const score = goalPairFromText(scoreAnchor.text)
    const matchKey = scoreAnchor.href || `${clubs[0].key}|${clubs[1].key}|${score[0]}:${score[1]}`
    if (seen.has(matchKey)) continue
    seen.add(matchKey)
    matches.push({ home: clubs[0], away: clubs[1], homeGoals: score[0], awayGoals: score[1] })
  }

  return matches
}

function parseCompletedMatchesText(text) {
  const matches = []
  const seen = new Set()

  for (const cells of markdownRows(text)) {
    const scoreIndex = cells.findIndex(cell => goalPairFromText(cell))
    if (scoreIndex < 0) continue

    const before = cells.slice(0, scoreIndex).map(canonicalTeam).filter(Boolean)
    const after = cells.slice(scoreIndex + 1).map(canonicalTeam).filter(Boolean)
    if (!before.length || !after.length) continue

    const home = before.at(-1)
    const away = after[0]
    if (!home || !away || home.key === away.key) continue
    const score = goalPairFromText(cells[scoreIndex])
    const key = `${home.key}|${away.key}|${score[0]}:${score[1]}|${cells.join('|')}`
    if (seen.has(key)) continue
    seen.add(key)
    matches.push({ home, away, homeGoals: score[0], awayGoals: score[1] })
  }

  return matches
}

function aggregateMatches(matches) {
  const records = new Map()
  const ensure = team => {
    if (!records.has(team.key)) {
      records.set(team.key, {
        team: team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      })
    }
    return records.get(team.key)
  }

  for (const match of matches) {
    const home = ensure(match.home)
    const away = ensure(match.away)
    home.played += 1
    away.played += 1
    home.goalsFor += match.homeGoals
    home.goalsAgainst += match.awayGoals
    away.goalsFor += match.awayGoals
    away.goalsAgainst += match.homeGoals

    if (match.homeGoals > match.awayGoals) {
      home.won += 1
      away.lost += 1
    } else if (match.homeGoals < match.awayGoals) {
      away.won += 1
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
    }
  }

  return records
}

function isCompleteTable(rows) {
  if (rows.length !== 20) return false
  const teams = new Set(rows.map(row => row.teamKey || normalizeSerieCTeamKey(row.team)))
  return teams.size === 20
}

function finalizeRows(standings, matches = []) {
  const orderedStandings = normalizeStandingOrder(standings)
  if (!isCompleteTable(orderedStandings)) {
    throw new Error(`A tabela retornou ${orderedStandings.length} equipes válidas; eram esperadas 20.`)
  }

  const matchRecords = aggregateMatches(matches)
  const rows = orderedStandings.map((row, index) => {
    const record = matchRecords.get(row.teamKey || normalizeSerieCTeamKey(row.team))
    const useRecord = record && record.played === row.played
    return {
      position: index + 1,
      providerPosition: row.providerPosition ?? row.position,
      team: row.team,
      points: row.points,
      played: row.played,
      won: useRecord ? record.won : row.won,
      drawn: useRecord ? record.drawn : row.drawn,
      lost: useRecord ? record.lost : row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
    }
  })

  return {
    rows,
    round: Math.max(...rows.map(row => Number(row.played) || 0)),
    completedMatches: Math.round(rows.reduce((sum, row) => sum + (Number(row.played) || 0), 0) / 2),
  }
}

export function parseTransfermarktSerieC(document) {
  const htmlRows = parseStandingsTables(document)
  const textRows = isCompleteTable(htmlRows) ? [] : parseStandingsText(document)
  const standings = isCompleteTable(htmlRows) ? htmlRows : textRows
  const schedule = parseTransfermarktFixturesText(document, {
    source: 'Transfermarkt',
    sourceUrl: TRANSFERMARKT_SERIE_C_URL,
  })
  const scheduledCompleted = schedule
    .filter(fixture => fixture.status === 'finished')
    .map(fixture => ({
      home: { key: fixture.homeKey, name: fixture.home },
      away: { key: fixture.awayKey, name: fixture.away },
      homeGoals: fixture.homeGoals,
      awayGoals: fixture.awayGoals,
    }))
  const htmlMatches = parseCompletedMatchesHtml(document)
  const textMatches = htmlMatches.length ? [] : parseCompletedMatchesText(document)
  const completedMatches = scheduledCompleted.length ? scheduledCompleted : (htmlMatches.length ? htmlMatches : textMatches)
  const finalized = finalizeRows(standings, completedMatches)
  const split = splitFixtures(schedule)
  return {
    ...finalized,
    fixtures: schedule,
    upcomingFixtures: split.upcoming,
    completedFixtures: split.completed,
  }
}

