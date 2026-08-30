const GROUPS = [
  { key: 'A', positions: [1, 4, 5, 8] },
  { key: 'B', positions: [2, 3, 6, 7] },
]

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function hashSeed(text) {
  let hash = 2166136261
  for (const char of String(text || '')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function teamStrength(row) {
  const played = Math.max(number(row.played), 1)
  const ppg = number(row.points) / played
  const goalRate = (number(row.goalsFor) - number(row.goalsAgainst)) / played
  const attackRate = number(row.goalsFor) / played
  const defenseRate = number(row.goalsAgainst) / played
  return {
    ppg,
    goalRate,
    attackRate,
    defenseRate,
    strength: ppg * 0.62 + goalRate * 0.16 + attackRate * 0.14 - defenseRate * 0.08,
  }
}

export function predictFixture(fixture, standings) {
  const byTeam = new Map(standings.map(row => [row.teamKey || normalizeKey(row.team), row]))
  const home = byTeam.get(fixture.homeKey) || {}
  const away = byTeam.get(fixture.awayKey) || {}
  const homeStrength = teamStrength(home)
  const awayStrength = teamStrength(away)
  const margin = homeStrength.strength - awayStrength.strength + 0.18
  const homeWin = clamp(0.33 + margin * 0.22, 0.12, 0.78)
  const draw = clamp(0.28 - Math.abs(margin) * 0.055, 0.16, 0.31)
  const awayWin = clamp(1 - homeWin - draw, 0.10, 0.72)
  const total = homeWin + draw + awayWin
  const probabilities = {
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,
  }
  const entries = [
    ['home', probabilities.homeWin],
    ['draw', probabilities.draw],
    ['away', probabilities.awayWin],
  ].sort((a, b) => b[1] - a[1])
  const expectedHomeGoals = clamp(1.05 + homeStrength.attackRate * 0.52 - awayStrength.defenseRate * 0.21 + 0.10, 0.25, 3.2)
  const expectedAwayGoals = clamp(0.82 + awayStrength.attackRate * 0.45 - homeStrength.defenseRate * 0.16, 0.20, 2.8)
  const expectedResult = entries[0][0]
  const label = expectedResult === 'home' ? 'Casa' : expectedResult === 'away' ? 'Fora' : 'Empate'
  return {
    ...fixture,
    probabilities,
    pick: expectedResult,
    pickLabel: label,
    confidence: entries[0][1],
    expectedHomeGoals,
    expectedAwayGoals,
    expectedScore: `${Math.max(0, Math.round(expectedHomeGoals))}–${Math.max(0, Math.round(expectedAwayGoals))}`,
  }
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function rankTable(rows, points, goalDifference, goalsFor) {
  return [...rows]
    .map(row => ({
      ...row,
      projectedPoints: points.get(row.teamKey || normalizeKey(row.team)) ?? number(row.points),
      projectedGoalDifference: goalDifference.get(row.teamKey || normalizeKey(row.team)) ?? number(row.goalDifference),
      projectedGoalsFor: goalsFor.get(row.teamKey || normalizeKey(row.team)) ?? number(row.goalsFor),
    }))
    .sort((a, b) => b.projectedPoints - a.projectedPoints || b.projectedGoalDifference - a.projectedGoalDifference || b.projectedGoalsFor - a.projectedGoalsFor || number(a.position) - number(b.position))
    .map((row, index) => ({ ...row, projectedPosition: index + 1 }))
}

function sampleOutcome(probabilities, random) {
  const value = random()
  if (value < probabilities.homeWin) return 'home'
  if (value < probabilities.homeWin + probabilities.draw) return 'draw'
  return 'away'
}

export function projectSerieC(standings, fixtures, { simulations = 1200, seed = null } = {}) {
  const realRows = [...standings].sort((a, b) => number(a.position) - number(b.position))
  const upcoming = (fixtures || []).filter(fixture => fixture.status !== 'finished' && fixture.homeKey && fixture.awayKey)
  const predictions = upcoming.map(fixture => predictFixture(fixture, realRows))
  const probabilitiesByTeam = new Map(realRows.map(row => [row.teamKey || normalizeKey(row.team), {
    team: row.team,
    teamKey: row.teamKey || normalizeKey(row.team),
    meanPoints: 0,
    meanPosition: 0,
    g8: 0,
    first: 0,
    relegation: 0,
    groupA: 0,
    groupB: 0,
  }]))
  const random = seededRandom(hashSeed(seed || `${realRows.map(row => row.team).join('|')}|${upcoming.map(fixture => fixture.id).join('|')}`))
  const iterations = Math.max(250, Math.min(Number(simulations) || 1200, 3000))

  for (let simulation = 0; simulation < iterations; simulation += 1) {
    const points = new Map(realRows.map(row => [row.teamKey || normalizeKey(row.team), number(row.points)]))
    const goalDifference = new Map(realRows.map(row => [row.teamKey || normalizeKey(row.team), number(row.goalDifference)]))
    const goalsFor = new Map(realRows.map(row => [row.teamKey || normalizeKey(row.team), number(row.goalsFor)]))
    for (const prediction of predictions) {
      const outcome = sampleOutcome(prediction.probabilities, random)
      const homeKey = prediction.homeKey
      const awayKey = prediction.awayKey
      const homePoints = points.get(homeKey) || 0
      const awayPoints = points.get(awayKey) || 0
      if (outcome === 'home') {
        points.set(homeKey, homePoints + 3)
        goalDifference.set(homeKey, (goalDifference.get(homeKey) || 0) + 1)
        goalDifference.set(awayKey, (goalDifference.get(awayKey) || 0) - 1)
        goalsFor.set(homeKey, (goalsFor.get(homeKey) || 0) + 1)
      } else if (outcome === 'away') {
        points.set(awayKey, awayPoints + 3)
        goalDifference.set(awayKey, (goalDifference.get(awayKey) || 0) + 1)
        goalDifference.set(homeKey, (goalDifference.get(homeKey) || 0) - 1)
        goalsFor.set(awayKey, (goalsFor.get(awayKey) || 0) + 1)
      } else {
        points.set(homeKey, homePoints + 1)
        points.set(awayKey, awayPoints + 1)
      }
    }
    const ranked = rankTable(realRows, points, goalDifference, goalsFor)
    const groupA = new Set(GROUPS[0].positions.map(position => ranked[position - 1]?.teamKey).filter(Boolean))
    const groupB = new Set(GROUPS[1].positions.map(position => ranked[position - 1]?.teamKey).filter(Boolean))
    ranked.forEach(row => {
      const key = row.teamKey || normalizeKey(row.team)
      const result = probabilitiesByTeam.get(key)
      if (!result) return
      result.meanPoints += row.projectedPoints
      result.meanPosition += row.projectedPosition
      if (row.projectedPosition <= 8) result.g8 += 1
      if (row.projectedPosition === 1) result.first += 1
      if (row.projectedPosition >= 17) result.relegation += 1
      if (groupA.has(key)) result.groupA += 1
      if (groupB.has(key)) result.groupB += 1
    })
  }

  const probabilities = [...probabilitiesByTeam.values()].map(result => ({
    ...result,
    meanPoints: result.meanPoints / iterations,
    meanPosition: result.meanPosition / iterations,
    g8Probability: result.g8 / iterations,
    leaderProbability: result.first / iterations,
    relegationProbability: result.relegation / iterations,
    groupAProbability: result.groupA / iterations,
    groupBProbability: result.groupB / iterations,
  }))
  const probabilityByKey = new Map(probabilities.map(result => [result.teamKey, result]))
  const projectedTable = [...realRows]
    .map(row => ({ ...row, ...(probabilityByKey.get(row.teamKey || normalizeKey(row.team)) || {}) }))
    .sort((a, b) => a.meanPosition - b.meanPosition || b.meanPoints - a.meanPoints)
    .map((row, index) => ({ ...row, projectedPosition: index + 1 }))
  const projectedGroups = GROUPS.map(group => ({
    ...group,
    teams: group.positions.map(position => projectedTable[position - 1]).filter(Boolean),
  }))

  return {
    simulations: iterations,
    generatedAt: new Date().toISOString(),
    upcomingCount: upcoming.length,
    predictions,
    projectedTable,
    projectedGroups,
    probabilities,
  }
}
