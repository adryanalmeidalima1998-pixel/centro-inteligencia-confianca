// Extração complementar do "Relatório da Época" Wyscout.
// O objetivo é guardar um snapshot semanal do campeonato, não apenas a tabela.
// Funções puras e compatíveis com browser/Next: recebem itens de texto do PDF.js.

function clean(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenValue(value) {
  const text = clean(value).replace(',', '.').replace(/[−–—]/g, '-')
  const match = text.match(/[+-]?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function pctValue(value) {
  const n = tokenValue(value)
  return Number.isFinite(n) ? n : null
}

function pageTokens(page) {
  return (page?.items || []).map(item => clean(item?.str ?? item?.text)).filter(Boolean)
}

function findExact(tokens, label, from = 0) {
  const wanted = clean(label).toLocaleLowerCase('pt-BR')
  return tokens.findIndex((token, index) => index >= from && clean(token).toLocaleLowerCase('pt-BR') === wanted)
}

function findStarts(tokens, label, from = 0) {
  const wanted = clean(label).toLocaleLowerCase('pt-BR')
  return tokens.findIndex((token, index) => index >= from && clean(token).toLocaleLowerCase('pt-BR').startsWith(wanted))
}

function parseRankedClub(tokens, heading, valueCount, occurrence = 0) {
  let from = 0
  let headingIndex = -1
  for (let n = 0; n <= occurrence; n += 1) {
    headingIndex = findExact(tokens, heading, from)
    if (headingIndex < 0) headingIndex = findStarts(tokens, heading, from)
    if (headingIndex < 0) return null
    from = headingIndex + 1
  }

  const nextHeadingLimit = tokens.length
  for (let i = headingIndex + 1; i < nextHeadingLimit - 1; i += 1) {
    if (clean(tokens[i]).toLocaleLowerCase('pt-BR') !== 'confianca') continue
    const previous = tokenValue(tokens[i - 1])
    if (!Number.isInteger(previous) || previous < 1 || previous > 20) continue
    const values = []
    for (let j = i + 1; j < tokens.length && values.length < valueCount; j += 1) {
      const text = clean(tokens[j])
      if (/^\d{1,2}$/.test(text) && values.length > 0 && j + 1 < tokens.length && !/[\d%]/.test(clean(tokens[j + 1]))) break
      values.push(text)
    }
    if (values.length >= valueCount) {
      return { rank: previous, values: values.slice(0, valueCount) }
    }
  }
  return null
}

function parseGoalTypeBlock(tokens, heading) {
  const start = findExact(tokens, heading)
  if (start < 0) return null

  // Neste bloco o Wyscout lista primeiro os 20 nomes e depois 5 valores por
  // equipe. Procuramos a primeira sequência de 20 textos não numéricos seguida
  // por um valor numérico, sem assumir qual clube aparece em primeiro.
  let teamsStart = -1
  let cursor = -1
  for (let i = start + 1; i < tokens.length - 20; i += 1) {
    let run = 0
    while (i + run < tokens.length && !/^[+-]?\d/.test(clean(tokens[i + run]))) run += 1
    if (run >= 20 && i + 20 < tokens.length && /^[+-]?\d/.test(clean(tokens[i + 20]))) {
      teamsStart = i
      cursor = i + 20
      break
    }
  }
  if (teamsStart < 0) return null
  const teamNames = tokens.slice(teamsStart, teamsStart + 20).map(clean)
  const index = teamNames.findIndex(team => team.toLocaleLowerCase('pt-BR') === 'confianca')
  if (index < 0) return null
  const base = cursor + index * 5
  const values = tokens.slice(base, base + 5)
  if (values.length < 5) return null
  return {
    total: tokenValue(values[0]),
    longRange: tokenValue(values[1]),
    counterAttack: tokenValue(values[2]),
    organizedPlay: tokenValue(values[3]),
    setPieces: tokenValue(values[4]),
    raw: values,
  }
}

function parseGoalDynamics(tokens, heading) {
  const start = findExact(tokens, heading)
  if (start < 0) return null
  const totalHeader = findExact(tokens, 'Total', start)
  if (totalHeader < 0) return null
  let clubIndex = findExact(tokens, 'Confiança', totalHeader + 1)
  if (clubIndex < 0) return null

  const values = tokens.slice(clubIndex + 1, clubIndex + 19)
  if (values.length < 18) return null
  const pair = index => ({ goals: tokenValue(values[index]), xg: tokenValue(values[index + 1]) })
  return {
    total: pair(0),
    firstHalf: pair(2),
    secondHalf: pair(4),
    periods: [
      { label: '1-15', ...pair(6) },
      { label: '16-30', ...pair(8) },
      { label: '31-45+', ...pair(10) },
      { label: '46-60', ...pair(12) },
      { label: '61-75', ...pair(14) },
      { label: '76-90+', ...pair(16) },
    ],
  }
}

function parseFormations(tokens) {
  const start = findExact(tokens, 'Formações')
  if (start < 0) return null
  const index = findExact(tokens, 'Confiança', start)
  if (index < 0) return null
  const values = tokens.slice(index + 1, index + 7)
  if (values.length < 6) return null
  return [0, 2, 4].map(offset => ({
    formation: clean(values[offset]),
    share: pctValue(values[offset + 1]),
  })).filter(item => item.formation)
}

function parseRatio(value) {
  const match = clean(value).match(/([\d.]+)\s*\/\s*([\d.]+)/)
  if (!match) return { total: tokenValue(value), shots: null }
  return { total: Number(match[1]), shots: Number(match[2]) }
}

function parseCorners(tokens) {
  const start = findStarts(tokens, 'Distribuição nos cantos')
  if (start < 0) return null
  const index = findExact(tokens, 'Confiança', start)
  if (index < 0) return null
  const values = tokens.slice(index + 1, index + 13)
  if (values.length < 12) return null
  const labels = ['total', 'nearPost', 'farPost', 'penaltyArea', 'goalkeeperZone', 'short']
  const result = {}
  labels.forEach((label, pairIndex) => {
    const ratio = parseRatio(values[pairIndex * 2])
    result[label] = { ...ratio, xg: tokenValue(values[pairIndex * 2 + 1]) }
  })
  return result
}

function numbers(values) {
  return values.map(tokenValue)
}

function parseTeamProfile(pages) {
  const p5 = pageTokens(pages.find(page => page.pageNumber === 5))
  const p6 = pageTokens(pages.find(page => page.pageNumber === 6))
  const p7 = pageTokens(pages.find(page => page.pageNumber === 7))
  const p8 = pageTokens(pages.find(page => page.pageNumber === 8))
  const p9 = pageTokens(pages.find(page => page.pageNumber === 9))
  const p10 = pageTokens(pages.find(page => page.pageNumber === 10))
  const p11 = pageTokens(pages.find(page => page.pageNumber === 11))
  const p12 = pageTokens(pages.find(page => page.pageNumber === 12))
  const p13 = pageTokens(pages.find(page => page.pageNumber === 13))

  const profile = {}

  profile.formations = parseFormations(p5)

  const goals = parseRankedClub(p6, 'Golo', 2)
  const conceded = parseRankedClub(p6, 'Golos sofridos', 2)
  const shots = parseRankedClub(p6, 'Remate', 3)
  const shotsAgainst = parseRankedClub(p6, 'Remates sofridos', 3)
  if (goals) profile.goalsOverview = { rank: goals.rank, goals: tokenValue(goals.values[0]), xg: tokenValue(goals.values[1]) }
  if (conceded) profile.concededOverview = { rank: conceded.rank, goalsAgainst: tokenValue(conceded.values[0]), xga: tokenValue(conceded.values[1]) }
  if (shots) profile.shots = { rank: shots.rank, per90: tokenValue(shots.values[0]), avgDistance: tokenValue(shots.values[1]), xgPerShot: tokenValue(shots.values[2]) }
  if (shotsAgainst) profile.shotsAgainst = { rank: shotsAgainst.rank, per90: tokenValue(shotsAgainst.values[0]), avgDistance: tokenValue(shotsAgainst.values[1]), xgPerShot: tokenValue(shotsAgainst.values[2]) }

  const losses = parseRankedClub(p7, 'Perdas', 7)
  const recoveries = parseRankedClub(p7, 'Recuperações', 7)
  if (losses) {
    const n = numbers(losses.values)
    profile.losses = { rank: losses.rank, per90: n[0], defensiveThird: n[1], defensiveThirdPct: n[2], middleThird: n[3], middleThirdPct: n[4], finalThird: n[5], finalThirdPct: n[6] }
  }
  if (recoveries) {
    const n = numbers(recoveries.values)
    profile.recoveries = { rank: recoveries.rank, per90: n[0], defensiveThird: n[1], defensiveThirdPct: n[2], middleThird: n[3], middleThirdPct: n[4], finalThird: n[5], finalThirdPct: n[6] }
  }

  const organization = parseRankedClub(p8, 'Organização', 10)
  const possession = parseRankedClub(p8, 'Posse de bola', 7)
  if (organization) {
    const n = numbers(organization.values)
    profile.organization = {
      rank: organization.rank,
      passesPer90: n[0], passAccuracy: n[1], forwardPasses: n[2], forwardAccuracy: n[3],
      lateralPasses: n[4], lateralAccuracy: n[5], longPasses: n[6], longAccuracy: n[7],
      avgPassLength: n[8], gameIntensity: n[9],
    }
  }
  if (possession) {
    const n = numbers(possession.values)
    profile.possession = {
      rank: possession.rank,
      pct: n[0], possessions: n[1], under5s: n[2], between5and15s: n[3], between15and45s: n[4], over45s: n[5], avgDuration: n[6],
    }
  }

  const finalThirdPasses = parseRankedClub(p9, 'Passes para terço final', 2)
  const deepReceptions = parseRankedClub(p9, 'Receção de passes em profundidade', 1)
  const progressivePasses = parseRankedClub(p9, 'Passes progressivos', 2)
  const deepPasses = parseRankedClub(p9, 'Passe para profundidade', 2)
  if (finalThirdPasses) profile.finalThirdPasses = { rank: finalThirdPasses.rank, per90: tokenValue(finalThirdPasses.values[0]), accuracy: tokenValue(finalThirdPasses.values[1]) }
  if (deepReceptions) profile.deepReceptions = { rank: deepReceptions.rank, per90: tokenValue(deepReceptions.values[0]) }
  if (progressivePasses) profile.progressivePasses = { rank: progressivePasses.rank, per90: tokenValue(progressivePasses.values[0]), accuracy: tokenValue(progressivePasses.values[1]) }
  if (deepPasses) profile.deepPasses = { rank: deepPasses.rank, per90: tokenValue(deepPasses.values[0]), accuracy: tokenValue(deepPasses.values[1]) }

  const crosses = parseRankedClub(p10, 'Cruzamento', 6)
  const dribbles = parseRankedClub(p10, 'Dribles', 2)
  const boxTouches = parseRankedClub(p10, 'Toques na área', 1)
  const foulsSuffered = parseRankedClub(p10, 'Faltas sofridas', 2)
  if (crosses) {
    const n = numbers(crosses.values)
    profile.crosses = { rank: crosses.rank, per90: n[0], accuracy: n[1], right: n[2], rightAccuracy: n[3], left: n[4], leftAccuracy: n[5] }
  }
  if (dribbles) profile.dribbles = { rank: dribbles.rank, per90: tokenValue(dribbles.values[0]), success: tokenValue(dribbles.values[1]) }
  if (boxTouches) profile.boxTouches = { rank: boxTouches.rank, per90: tokenValue(boxTouches.values[0]) }
  if (foulsSuffered) profile.foulsSuffered = { rank: foulsSuffered.rank, per90: tokenValue(foulsSuffered.values[0]), offsides: tokenValue(foulsSuffered.values[1]) }

  const offensiveDuels = parseRankedClub(p11, 'Duelos ofensivos', 2)
  const defensiveDuels = parseRankedClub(p11, 'Duelos defensivos', 3)
  const aerialDuels = parseRankedClub(p11, 'Duelos aéreos', 2)
  const looseBallDuels = parseRankedClub(p11, 'Duelos bolas perdidas', 2)
  if (offensiveDuels) profile.offensiveDuels = { rank: offensiveDuels.rank, per90: tokenValue(offensiveDuels.values[0]), success: tokenValue(offensiveDuels.values[1]) }
  if (defensiveDuels) profile.defensiveDuels = { rank: defensiveDuels.rank, per90: tokenValue(defensiveDuels.values[0]), success: tokenValue(defensiveDuels.values[1]), intensity: tokenValue(defensiveDuels.values[2]) }
  if (aerialDuels) profile.aerialDuels = { rank: aerialDuels.rank, per90: tokenValue(aerialDuels.values[0]), success: tokenValue(aerialDuels.values[1]) }
  if (looseBallDuels) profile.looseBallDuels = { rank: looseBallDuels.rank, per90: tokenValue(looseBallDuels.values[0]), success: tokenValue(looseBallDuels.values[1]) }

  const interceptions = parseRankedClub(p12, 'Intercepção', 1)
  const ppda = parseRankedClub(p12, 'Intensidade de pressão (PPDA)', 1)
  const blockedShots = parseRankedClub(p12, 'Remates intercetados', 3)
  const fouls = parseRankedClub(p12, 'Falta', 3)
  if (interceptions) profile.interceptions = { rank: interceptions.rank, per90: tokenValue(interceptions.values[0]) }
  if (ppda) profile.ppda = { rank: ppda.rank, value: tokenValue(ppda.values[0]) }
  if (blockedShots) profile.blockedShots = { rank: blockedShots.rank, per90: tokenValue(blockedShots.values[0]), pct: tokenValue(blockedShots.values[1]), xgBlocked: tokenValue(blockedShots.values[2]) }
  if (fouls) profile.fouls = { rank: fouls.rank, per90: tokenValue(fouls.values[0]), yellowCards: tokenValue(fouls.values[1]), redCards: tokenValue(fouls.values[2]) }

  const penalties = parseRankedClub(p13, 'Penáltis', 2)
  const directFreeKicks = parseRankedClub(p13, 'Livres directos', 1)
  if (penalties) {
    const ratio = parseRatio(penalties.values[0])
    profile.penalties = { rank: penalties.rank, attempts: ratio.total, scored: ratio.shots, conversion: tokenValue(penalties.values[1]) }
  }
  if (directFreeKicks) profile.directFreeKicks = { rank: directFreeKicks.rank, total: tokenValue(directFreeKicks.values[0]) }
  profile.corners = parseCorners(p13)

  return profile
}

function extractClubLeaderMentions(pages) {
  const results = []
  for (const page of pages.filter(page => page.pageNumber >= 14 && page.pageNumber <= 18)) {
    const tokens = pageTokens(page)
    for (let i = 0; i < tokens.length; i += 1) {
      if (clean(tokens[i]).toLocaleLowerCase('pt-BR') !== 'confianca') continue
      const player = clean(tokens[i - 1])
      if (!player || /^\d/.test(player)) continue
      const values = []
      for (let j = i + 1; j < Math.min(tokens.length, i + 5); j += 1) {
        const text = clean(tokens[j])
        if (/^(RELATÓRIO|Brazil\.|2026)$/i.test(text)) break
        values.push(text)
      }
      results.push({ page: page.pageNumber, player, values })
    }
  }
  return results.slice(0, 40)
}

export function parseWyscoutSeasonReportPages(pages, standingsRows = []) {
  const p3 = pageTokens(pages.find(page => page.pageNumber === 3))
  const p4 = pageTokens(pages.find(page => page.pageNumber === 4))
  const clubStandings = (standingsRows || []).find(row => clean(row?.team).toLocaleLowerCase('pt-BR').includes('confianca')) || null

  return {
    version: 1,
    club: {
      standings: clubStandings,
      goalsByType: parseGoalTypeBlock(p3, 'Tipos de golos marcados'),
      concededByType: parseGoalTypeBlock(p4, 'Tipos de golos sofridos'),
      goalsTiming: parseGoalDynamics(p3, 'Golos marcados em dinâmicas de jogo'),
      concededTiming: parseGoalDynamics(p4, 'Golos sofridos em dinâmicas de jogo'),
      profile: parseTeamProfile(pages),
    },
    leaders: extractClubLeaderMentions(pages),
    parsedPages: pages.map(page => page.pageNumber),
  }
}
