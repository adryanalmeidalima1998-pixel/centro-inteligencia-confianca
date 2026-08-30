import { calcularIAP } from '@/lib/iap-engine'
import { resolveGrupo } from '@/data/iap-profiles'
import { getLeague } from '@/data/leagues'
import { LEAGUE_ENGINE_VERSION } from '@/lib/league-dataset-version'
import { evaluateGuaraniMarketContext, GUARANI_COMPETITIVE_CONTEXT, isGuaraniOwnClub } from '@/data/guarani-market-context'

export const EVOLUTION_POSITION_ORDER = [
  'Goleiro',
  'Zagueiro',
  'Lateral',
  'Volante',
  'Meia',
  'Extremo',
  'Atacante',
]

const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function finite(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value, decimals = 1) {
  if (!Number.isFinite(Number(value))) return null
  const factor = 10 ** decimals
  return Math.round(Number(value) * factor) / factor
}

function dateValue(value) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function isoDate(value) {
  const date = dateValue(value)
  return date ? date.toISOString() : null
}

function daysBetween(start, end) {
  const startDate = dateValue(start)
  const endDate = dateValue(end)
  if (!startDate || !endDate) return 0
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000))
}

function birthYear(player) {
  const rawDate = player?.data_nascimento || player?.nascimento || player?.birth_date || player?.['Data de nascimento']
  const parsedDate = dateValue(rawDate)
  if (parsedDate) return parsedDate.getUTCFullYear()
  return finite(player?.ano_nascimento)
}

/**
 * Identidade estável para acompanhar o atleta entre uploads, inclusive quando muda de clube.
 * Quando a planilha não possui data de nascimento, usa nome + ano de nascimento ou nacionalidade.
 */
export function evolutionPlayerKey(player = {}) {
  const name = normalizeText(player.nome || player.jogador || player.Jogador)
  const year = birthYear(player)
  const nationality = normalizeText(player.pais || player.nacionalidade || player.naturalidade)
  if (!name) return ''
  if (year) return `${name}|${year}`
  return `${name}|${nationality || 'na'}`
}

export function resolveEvolutionPeriod(year, type = 'season', index = 1) {
  const safeYear = Number(year) || new Date().getFullYear()
  const safeType = ['season', 'semester', 'bimester'].includes(type) ? type : 'season'
  const safeIndex = Math.max(1, Number(index) || 1)

  let startMonth = 0
  let endMonth = 12
  let label = `Temporada ${safeYear}`

  if (safeType === 'semester') {
    const semester = Math.min(2, safeIndex)
    startMonth = (semester - 1) * 6
    endMonth = startMonth + 6
    label = `${semester}º semestre de ${safeYear}`
  }

  if (safeType === 'bimester') {
    const bimester = Math.min(6, safeIndex)
    startMonth = (bimester - 1) * 2
    endMonth = startMonth + 2
    label = `${bimester}º bimestre de ${safeYear}`
  }

  const start = new Date(Date.UTC(safeYear, startMonth, 1, 0, 0, 0))
  const end = new Date(Date.UTC(safeYear + (endMonth >= 12 ? 1 : 0), endMonth % 12, 1, 0, 0, 0))
  const seasonStart = new Date(Date.UTC(safeYear, 0, 1, 0, 0, 0))
  const seasonEnd = new Date(Date.UTC(safeYear + 1, 0, 1, 0, 0, 0))

  return {
    year: safeYear,
    type: safeType,
    index: safeIndex,
    label,
    start,
    end,
    seasonStart,
    seasonEnd,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    seasonStartIso: seasonStart.toISOString(),
    seasonEndIso: seasonEnd.toISOString(),
  }
}

function periodShortLabel(date) {
  const parsed = dateValue(date)
  if (!parsed) return ''
  return `${String(parsed.getUTCDate()).padStart(2, '0')} ${MONTH_LABELS[parsed.getUTCMonth()]}`
}

function rankPercentile(rank, total) {
  if (!rank || !total) return null
  if (total === 1) return 100
  return round(((total - rank) / (total - 1)) * 100, 1)
}

function minutesPerGame(player) {
  const games = finite(player?.jogos, 0)
  const minutes = finite(player?.minutos, 0)
  return games > 0 ? round(minutes / games, 1) : null
}

function starterRate(player) {
  const games = finite(player?.jogos, 0)
  const starts = finite(player?.titularidades, null)
  if (!games || starts === null) return null
  return round((starts / games) * 100, 1)
}

function prepareSnapshot(row, seasonYear) {
  const rawPlayers = Array.isArray(row?.data) ? row.data : []
  const playersByGroup = new Map()

  for (const raw of rawPlayers) {
    const group = resolveGrupo(raw?.posicao)
    if (!group) continue
    if (!playersByGroup.has(group)) playersByGroup.set(group, [])
    playersByGroup.get(group).push({
      ...raw,
      _fonte: row.fonte,
      _liga: row.slug,
    })
  }

  const playerMap = new Map()

  for (const group of EVOLUTION_POSITION_ORDER) {
    const groupPlayers = playersByGroup.get(group) || []
    if (!groupPlayers.length) continue

    const ranked = calcularIAP(groupPlayers, group)
      .map(player => ({
        ...player,
        _evolutionKey: evolutionPlayerKey(player),
      }))
      .filter(player => player._evolutionKey && finite(player._iap_dominante, 0) > 0)
      .sort((a, b) => (
        finite(b._iap_dominante, 0) - finite(a._iap_dominante, 0)
        || finite(b.minutos, 0) - finite(a.minutos, 0)
        || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
      ))

    const totalInGroup = ranked.length

    ranked.forEach((player, index) => {
      const key = player._evolutionKey
      const rank = index + 1
      const market = evaluateGuaraniMarketContext({ ...player, _liga: row.slug }, row.slug)
      const current = {
        key,
        nome: String(player.nome || '').trim(),
        clube: String(player.equipa || player.clube || '').trim(),
        posicao: String(player.posicao || '').trim(),
        grupo: player._grupo || resolveGrupo(player.posicao),
        idade: finite(player.idade),
        minutos: finite(player.minutos, 0),
        jogos: finite(player.jogos || player.partidas, 0),
        titularidades: finite(player.titularidades, null),
        score: round(player._iap_dominante, 1),
        perfil: player._perfil_dominante || null,
        confiabilidadeIap: player._confiabilidade?.label || null,
        confiabilidadeIapNivel: finite(player._confiabilidade?.nivel, 0),
        pe: player.pe || null,
        rank,
        rankTotal: totalInGroup,
        rankPercentile: rankPercentile(rank, totalInGroup),
        minutosPorJogo: minutesPerGame(player),
        titularidadePct: starterRate(player),
        market: {
          policyVersion: market.policyVersion,
          actionable: market.actionable,
          score: market.score,
          multiplier: market.multiplier,
          band: market.band,
          label: market.label,
          horizon: market.horizon,
          reason: market.reason,
          cautions: market.cautions,
          giantClub: market.giantClub,
          ownClub: market.ownClub,
          contractualOpportunity: market.contractualOpportunity,
        },
      }

      // Em duplicidades no mesmo arquivo, mantém a linha com maior minutagem.
      const previous = playerMap.get(key)
      if (!previous || current.minutos > previous.minutos) playerMap.set(key, current)
    })
  }

  return {
    id: row.id,
    slug: row.slug,
    fonte: row.fonte,
    season: finite(row.season, seasonYear),
    engineVersion: row.engine_version || 'legacy',
    schemaVersion: row.schema_version || `${row.fonte || 'unknown'}-legacy`,
    uploadAt: isoDate(row.upload_at),
    uploadLabel: periodShortLabel(row.upload_at),
    total: finite(row.total, rawPlayers.length),
    players: playerMap,
  }
}

function selectSource(sourceGroups, requestedSource, period) {
  const candidates = [...sourceGroups.entries()]
    .map(([source, snapshots]) => {
      const inPeriod = snapshots.filter(snapshot => {
        const date = dateValue(snapshot.uploadAt)
        return date && date >= period.start && date < period.end
      })
      const reference = inPeriod.length ? inPeriod : snapshots
      return {
        source,
        snapshots,
        latest: reference[reference.length - 1]?.uploadAt || null,
        periodCount: inPeriod.length,
      }
    })
    .filter(candidate => candidate.snapshots.length)

  if (!candidates.length) return null
  if (requestedSource !== 'auto') {
    return candidates.find(candidate => candidate.source === requestedSource) || null
  }

  return candidates.sort((a, b) => {
    if (Boolean(b.periodCount) !== Boolean(a.periodCount)) return b.periodCount ? 1 : -1
    const aDate = dateValue(a.latest)?.getTime() || 0
    const bDate = dateValue(b.latest)?.getTime() || 0
    if (bDate !== aDate) return bDate - aDate
    if (b.periodCount !== a.periodCount) return b.periodCount - a.periodCount
    return a.source === 'sportsbase' ? -1 : 1
  })[0]
}

function pointsCounterDelta(points, key) {
  if (points.length < 2) return null
  let total = 0
  let observed = false
  for (let index = 1; index < points.length; index += 1) {
    const previous = finite(points[index - 1]?.[key], null)
    const current = finite(points[index]?.[key], null)
    if (previous === null || current === null) continue
    observed = true
    // Em troca de clube/competição alguns fornecedores reiniciam o acumulado.
    total += current >= previous ? current - previous : current
  }
  return observed ? round(total, 1) : null
}

function evolutionConfidence(periodPoints, participation, minimumMinutes) {
  const collectionCount = periodPoints.length
  const spanDays = collectionCount > 1
    ? daysBetween(periodPoints[0].date, periodPoints[collectionCount - 1].date)
    : 0
  const addedMinutes = finite(participation.addedMinutes, 0)
  const highMinutes = Math.max(270, Number(minimumMinutes) || 0)
  const mediumMinutes = Math.max(90, Math.round(highMinutes * 0.5))

  if (collectionCount >= 3 && addedMinutes >= highMinutes && spanDays >= 28) {
    return {
      key: 'high',
      label: 'Alta confiança',
      collectionCount,
      spanDays,
      addedMinutes,
      reason: `${collectionCount} coletas, ${Math.round(addedMinutes)} minutos adicionados e ${spanDays} dias de intervalo.`,
    }
  }

  if (collectionCount >= 2 && addedMinutes >= mediumMinutes && spanDays >= 14) {
    return {
      key: 'medium',
      label: 'Média confiança',
      collectionCount,
      spanDays,
      addedMinutes,
      reason: `${collectionCount} coletas, ${Math.round(addedMinutes)} minutos adicionados e ${spanDays} dias de intervalo.`,
    }
  }

  const reasons = []
  if (collectionCount < 3) reasons.push(`${collectionCount} coleta(s)`)
  if (addedMinutes < mediumMinutes) reasons.push(`${Math.round(addedMinutes)} minutos novos`)
  if (spanDays < 14) reasons.push(`${spanDays} dias entre referências`)
  return {
    key: 'low',
    label: 'Baixa confiança',
    collectionCount,
    spanDays,
    addedMinutes,
    reason: reasons.join(', ') || 'Amostra curta para confirmar a direção da evolução.',
  }
}

function deltaStatus(delta, hasComparison, confidence) {
  if (!hasComparison) return { key: 'new', label: 'Novo no recorte' }
  if (!Number.isFinite(delta)) return { key: 'insufficient', label: 'Sem comparação' }
  if (delta >= 3) {
    return confidence.key === 'low'
      ? { key: 'trendPositive', label: 'Tendência positiva' }
      : { key: 'improved', label: 'Em evolução' }
  }
  if (delta <= -3) {
    return confidence.key === 'low'
      ? { key: 'trendNegative', label: 'Tendência de queda' }
      : { key: 'declined', label: 'Em queda' }
  }
  return { key: 'stable', label: 'Estável' }
}

function participationEvolution(current, baseline, periodPoints) {
  const currentMinutesPerGame = finite(current?.minutosPorJogo, null)
  const baselineMinutesPerGame = finite(baseline?.minutosPorJogo, null)
  const currentStarterRate = finite(current?.titularidadePct, null)
  const baselineStarterRate = finite(baseline?.titularidadePct, null)
  const minutesPerGameDelta = currentMinutesPerGame !== null && baselineMinutesPerGame !== null
    ? round(currentMinutesPerGame - baselineMinutesPerGame, 1)
    : null
  const starterRateDelta = currentStarterRate !== null && baselineStarterRate !== null
    ? round(currentStarterRate - baselineStarterRate, 1)
    : null
  const addedMinutes = pointsCounterDelta(periodPoints, 'minutos')
  const addedGames = pointsCounterDelta(periodPoints, 'jogos')
  const addedStarts = pointsCounterDelta(periodPoints, 'titularidades')

  let trend = 'stable'
  let trendLabel = 'Participação estável'
  if ((addedGames || 0) <= 0) {
    trend = 'inactive'
    trendLabel = 'Sem novos jogos'
  } else if ((minutesPerGameDelta ?? 0) >= 10 || (starterRateDelta ?? 0) >= 10) {
    trend = 'increased'
    trendLabel = 'Mais participação'
  } else if ((minutesPerGameDelta ?? 0) <= -10 || (starterRateDelta ?? 0) <= -10) {
    trend = 'reduced'
    trendLabel = 'Menos participação'
  }

  return {
    currentMinutes: finite(current?.minutos, 0),
    baselineMinutes: finite(baseline?.minutos, null),
    addedMinutes,
    currentGames: finite(current?.jogos, 0),
    baselineGames: finite(baseline?.jogos, null),
    addedGames,
    currentStarts: finite(current?.titularidades, null),
    baselineStarts: finite(baseline?.titularidades, null),
    addedStarts,
    currentMinutesPerGame,
    baselineMinutesPerGame,
    minutesPerGameDelta,
    currentStarterRate,
    baselineStarterRate,
    starterRateDelta,
    trend,
    trendLabel,
  }
}

function playerEvolution(current, seriesSnapshots, period, minimumMinutes) {
  const points = seriesSnapshots
    .map(snapshot => {
      const player = snapshot.players.get(current.key)
      if (!player) return null
      return {
        date: snapshot.uploadAt,
        label: snapshot.uploadLabel,
        score: player.score,
        minutos: player.minutos,
        jogos: player.jogos,
        titularidades: player.titularidades,
        minutosPorJogo: player.minutosPorJogo,
        titularidadePct: player.titularidadePct,
        clube: player.clube,
        posicao: player.posicao,
        grupo: player.grupo,
        perfil: player.perfil,
        rank: player.rank,
        rankTotal: player.rankTotal,
        rankPercentile: player.rankPercentile,
        engineVersion: snapshot.engineVersion,
        schemaVersion: snapshot.schemaVersion,
      }
    })
    .filter(Boolean)

  const periodPoints = points.filter(point => {
    const date = dateValue(point.date)
    return date && date >= period.start && date < period.end
  })
  const periodFirst = periodPoints[0] || null
  const seasonFirst = points[0] || null
  const hasPeriodComparison = Boolean(periodFirst && periodPoints.length > 1)
  const periodDelta = hasPeriodComparison
    ? round(current.score - periodFirst.score, 1)
    : null
  const seasonDelta = seasonFirst && points.length > 1
    ? round(current.score - seasonFirst.score, 1)
    : null
  const recentDelta = points.length > 1
    ? round(points[points.length - 1].score - points[points.length - 2].score, 1)
    : null

  const participation = participationEvolution(current, periodFirst, periodPoints)
  const confidence = evolutionConfidence(periodPoints, participation, minimumMinutes)
  const status = deltaStatus(periodDelta, hasPeriodComparison, confidence)

  return {
    ...current,
    periodBaselineScore: hasPeriodComparison ? periodFirst.score : null,
    seasonBaselineScore: seasonFirst?.score ?? null,
    periodDelta,
    seasonDelta,
    recentDelta,
    rankCurrent: current.rank,
    rankBaseline: hasPeriodComparison ? periodFirst.rank : null,
    rankDelta: hasPeriodComparison && periodFirst.rank && current.rank ? periodFirst.rank - current.rank : null,
    percentileCurrent: current.rankPercentile,
    percentileBaseline: hasPeriodComparison ? periodFirst.rankPercentile : null,
    percentileDelta: hasPeriodComparison && periodFirst.rankPercentile !== null && periodFirst.rankPercentile !== undefined
      ? round(current.rankPercentile - periodFirst.rankPercentile, 1)
      : null,
    participation,
    evolutionConfidence: confidence,
    status: status.key,
    statusLabel: status.label,
    points,
    periodPoints,
  }
}

function lastDistinct(values = []) {
  return [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))]
}

function isThreeCollectionTrend(points, direction) {
  const recent = points.slice(-3)
  if (recent.length < 3) return false
  const differences = [
    recent[1].score - recent[0].score,
    recent[2].score - recent[1].score,
  ]
  const total = recent[2].score - recent[0].score
  return direction === 'up'
    ? differences.every(value => value > 0) && total >= 3
    : differences.every(value => value < 0) && total <= -3
}

function alertEntry(type, player, league, message) {
  return {
    id: `${type}:${league.slug}:${player.key}`,
    type,
    message,
    league: {
      slug: league.slug,
      nome: league.nome,
      bandeira: league.bandeira,
      cor: league.cor,
      fonte: league.fonte,
    },
    player,
  }
}

function buildLeagueAlerts(players, league) {
  const alerts = {
    growth: [],
    decline: [],
    newU23Top5: [],
    clubChanges: [],
  }

  for (const player of players) {
    if (player.evolutionConfidence?.key !== 'low' && isThreeCollectionTrend(player.periodPoints, 'up')) {
      alerts.growth.push(alertEntry('growth', player, league, `Cresceu nas 3 últimas coletas (${player.periodDelta >= 0 ? '+' : ''}${player.periodDelta?.toFixed(1)} IAP).`))
    }
    if (player.evolutionConfidence?.key !== 'low' && isThreeCollectionTrend(player.periodPoints, 'down')) {
      alerts.decline.push(alertEntry('decline', player, league, `Caiu nas 3 últimas coletas (${player.periodDelta?.toFixed(1)} IAP).`))
    }
    if (finite(player.idade, 99) <= 23 && player.rankCurrent <= 5 && (!player.rankBaseline || player.rankBaseline > 5)) {
      alerts.newU23Top5.push(alertEntry('newU23Top5', player, league, `Sub-23 entrou no Top 5 da posição e agora ocupa o ${player.rankCurrent}º lugar.`))
    }

    const clubs = lastDistinct(player.periodPoints.map(point => point.clube))
    if (clubs.length > 1) {
      alerts.clubChanges.push(alertEntry('clubChanges', player, league, `Mudou de clube no período: ${clubs[0]} → ${clubs[clubs.length - 1]}.`))
    }

  }

  alerts.growth.sort((a, b) => finite(b.player.periodDelta, 0) - finite(a.player.periodDelta, 0))
  alerts.decline.sort((a, b) => finite(a.player.periodDelta, 0) - finite(b.player.periodDelta, 0))
  alerts.newU23Top5.sort((a, b) => a.player.rankCurrent - b.player.rankCurrent)
  return alerts
}

function isGuaraniContextEligible(player, marketScope = 'immediate') {
  const market = player?.market
  if (market?.ownClub || isGuaraniOwnClub(player?.clube)) return false
  if (!market?.actionable || market.giantClub || market.horizon === 'reference') return false
  if (marketScope === 'immediate-and-development') return ['immediate', 'development'].includes(market.horizon)
  return market.horizon === 'immediate'
}

function contextualExclusionReason(player, marketScope = 'immediate') {
  const market = player?.market
  if (market?.ownClub || isGuaraniOwnClub(player?.clube)) return 'Atleta do próprio Confiança; excluído da prospecção externa.'
  if (market?.giantClub) return `Clube de maior poder (${market.giantClub})`
  if (!market?.actionable || market?.horizon === 'reference') return market?.cautions?.[0] || market?.reason || 'Somente referência para o contexto do Confiança.'
  if (marketScope === 'immediate' && market?.horizon === 'development') return 'Projeto de desenvolvimento fora do recorte imediato.'
  return null
}

function buildLeagueEvolution(slug, snapshotsBySource, options) {
  const selected = selectSource(snapshotsBySource, options.source, options.period)
  if (!selected) return null

  const seasonSnapshots = selected.snapshots
    .filter(snapshot => {
      const date = dateValue(snapshot.uploadAt)
      return snapshot.season === options.period.year
        || (date && date >= options.period.seasonStart && date < options.period.seasonEnd)
    })
    .sort((a, b) => new Date(a.uploadAt).getTime() - new Date(b.uploadAt).getTime())

  const periodSnapshots = seasonSnapshots.filter(snapshot => {
    const date = dateValue(snapshot.uploadAt)
    return date && date >= options.period.start && date < options.period.end
  })

  if (!periodSnapshots.length) return null

  const latest = periodSnapshots[periodSnapshots.length - 1]
  const periodBaseline = periodSnapshots[0]
  const seasonBaseline = seasonSnapshots[0]
  const seriesSnapshots = seasonSnapshots.filter(snapshot => new Date(snapshot.uploadAt) <= new Date(latest.uploadAt))
  const leagueMeta = getLeague(slug)
  const leagueIdentity = {
    slug,
    nome: leagueMeta?.nome || slug,
    pais: leagueMeta?.pais || '',
    bandeira: leagueMeta?.bandeira || '',
    cor: leagueMeta?.cor || '#0a66b7',
    fonte: selected.source,
  }

  const allCurrentEvolution = [...latest.players.values()]
    .map(player => playerEvolution(player, seriesSnapshots, options.period, options.minimumMinutes))

  const contextualPlayers = allCurrentEvolution.filter(player => isGuaraniContextEligible(player, options.marketScope))
  const excludedContextPlayers = allCurrentEvolution
    .filter(player => !isGuaraniContextEligible(player, options.marketScope))
    .map(player => ({
      key: player.key,
      nome: player.nome,
      clube: player.clube,
      grupo: player.grupo,
      score: player.score,
      reason: contextualExclusionReason(player, options.marketScope),
    }))
  const evolutionByKey = new Map(contextualPlayers.map(player => [player.key, player]))
  const positions = []

  for (const group of EVOLUTION_POSITION_ORDER) {
    const currentPlayers = contextualPlayers
      .filter(player => player.grupo === group && player.minutos >= options.minimumMinutes)
      .sort((a, b) => b.score - a.score || b.minutos - a.minutos || a.nome.localeCompare(b.nome, 'pt-BR'))

    const fallbackPlayers = currentPlayers.length >= options.limit
      ? currentPlayers
      : contextualPlayers
          .filter(player => player.grupo === group && !currentPlayers.some(current => current.key === player.key))
          .sort((a, b) => b.score - a.score || b.minutos - a.minutos || a.nome.localeCompare(b.nome, 'pt-BR'))

    const selectedPlayers = [...currentPlayers, ...fallbackPlayers].slice(0, options.limit)
    positions.push({
      grupo: group,
      label: group,
      players: selectedPlayers.map((player, index) => ({
        ...evolutionByKey.get(player.key),
        displayRank: index + 1,
        belowMinimum: player.minutos < options.minimumMinutes,
      })),
    })
  }

  const displayedPlayers = positions.flatMap(position => position.players)
  const statusCounts = displayedPlayers.reduce((acc, player) => {
    acc[player.status] = (acc[player.status] || 0) + 1
    return acc
  }, {})
  const confidenceCounts = displayedPlayers.reduce((acc, player) => {
    const key = player.evolutionConfidence?.key || 'low'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const versionRows = seriesSnapshots.map(snapshot => ({
    engineVersion: snapshot.engineVersion,
    schemaVersion: snapshot.schemaVersion,
  }))
  const engineVersions = [...new Set(versionRows.map(item => item.engineVersion))]
  const schemaVersions = [...new Set(versionRows.map(item => item.schemaVersion))]
  const methodology = {
    calculationEngineVersion: LEAGUE_ENGINE_VERSION,
    storedEngineVersions: engineVersions,
    storedSchemaVersions: schemaVersions,
    hasLegacySnapshots: versionRows.some(item => item.engineVersion === 'legacy' || item.schemaVersion.endsWith('-legacy')),
    hasMixedVersions: engineVersions.length > 1 || schemaVersions.length > 1,
  }

  const alertCandidates = contextualPlayers.filter(player => (
    player.minutos >= options.minimumMinutes
    || player.rankCurrent <= 5
    || finite(player.participation?.addedMinutes, 0) >= 90
  ))
  const alerts = buildLeagueAlerts(alertCandidates, leagueIdentity)

  return {
    ...leagueIdentity,
    periodLabel: options.period.label,
    firstUploadAt: periodBaseline.uploadAt,
    latestUploadAt: latest.uploadAt,
    seasonFirstUploadAt: seasonBaseline?.uploadAt || periodBaseline.uploadAt,
    snapshotCount: periodSnapshots.length,
    seasonSnapshotCount: seriesSnapshots.length,
    totalPlayersLatest: latest.players.size,
    contextEligiblePlayers: contextualPlayers.length,
    contextExcludedPlayers: excludedContextPlayers.length,
    contextExcludedPreview: excludedContextPlayers
      .sort((a, b) => b.score - a.score)
      .slice(0, 8),
    marketScope: options.marketScope,
    marketPolicyVersion: GUARANI_COMPETITIVE_CONTEXT.policyVersion,
    rankedPlayers: displayedPlayers.length,
    statusCounts,
    confidenceCounts,
    methodology,
    alerts,
    positions,
  }
}

function mergeAlerts(leagues) {
  const merged = {
    growth: [],
    decline: [],
    newU23Top5: [],
    clubChanges: [],
  }
  for (const league of leagues) {
    for (const key of Object.keys(merged)) merged[key].push(...(league.alerts?.[key] || []))
  }
  for (const key of Object.keys(merged)) merged[key] = merged[key].slice(0, 15)
  return merged
}

/**
 * Transforma os registros históricos de liga_jogadores no painel bimestral/semestral.
 */
export function buildEvolutionReport(rows = [], options = {}) {
  const period = resolveEvolutionPeriod(options.year, options.periodType, options.periodIndex)
  const source = ['auto', 'sportsbase', 'wyscout'].includes(options.source) ? options.source : 'auto'
  const minimumMinutes = Math.max(0, Number(options.minimumMinutes) || 0)
  const limit = Math.min(10, Math.max(1, Number(options.limit) || 5))
  const marketScope = options.marketScope === 'immediate-and-development' ? 'immediate-and-development' : 'immediate'
  const requestedLeagues = Array.isArray(options.leagues)
    ? [...new Set(options.leagues.map(String).map(value => value.trim()).filter(Boolean))]
    : options.league && options.league !== 'all'
      ? [String(options.league)]
      : []
  const requestedSet = new Set(requestedLeagues)

  const preparedRows = rows
    .filter(row => !requestedSet.size || requestedSet.has(row.slug))
    .map(row => prepareSnapshot(row, period.year))
    .filter(snapshot => snapshot.uploadAt)
    .sort((a, b) => new Date(a.uploadAt).getTime() - new Date(b.uploadAt).getTime())

  const grouped = new Map()
  for (const snapshot of preparedRows) {
    if (!grouped.has(snapshot.slug)) grouped.set(snapshot.slug, new Map())
    const bySource = grouped.get(snapshot.slug)
    if (!bySource.has(snapshot.fonte)) bySource.set(snapshot.fonte, [])
    bySource.get(snapshot.fonte).push(snapshot)
  }

  const leagues = [...grouped.entries()]
    .map(([slug, snapshotsBySource]) => buildLeagueEvolution(slug, snapshotsBySource, {
      period,
      source,
      minimumMinutes,
      limit,
      marketScope,
    }))
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const allPlayers = leagues.flatMap(league => league.positions.flatMap(position => position.players))
  const statusCounts = allPlayers.reduce((acc, player) => {
    acc[player.status] = (acc[player.status] || 0) + 1
    return acc
  }, {})
  const confidenceCounts = allPlayers.reduce((acc, player) => {
    const key = player.evolutionConfidence?.key || 'low'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const alerts = mergeAlerts(leagues)

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      year: period.year,
      periodType: period.type,
      periodIndex: period.index,
      periodLabel: period.label,
      periodStart: period.startIso,
      periodEnd: period.endIso,
      source,
      leagues: requestedLeagues,
      minimumMinutes,
      limit,
      marketScope,
    },
    methodology: {
      calculationEngineVersion: LEAGUE_ENGINE_VERSION,
      comparisonMode: 'Recalculo consistente de todas as coletas com a versão atual do motor.',
      marketPolicyVersion: GUARANI_COMPETITIVE_CONTEXT.policyVersion,
      marketSelection: marketScope === 'immediate'
        ? 'Somente atletas acionáveis no horizonte imediato do Confiança; clubes de maior poder e nomes de referência são excluídos.'
        : 'Atletas acionáveis no horizonte imediato e projetos de desenvolvimento; clubes de maior poder e nomes de referência são excluídos.',
      confidenceRules: {
        high: '3 ou mais coletas, ao menos 270 minutos novos (ou o mínimo selecionado) e intervalo de 28 dias.',
        medium: '2 ou mais coletas, amostra intermediária e intervalo de ao menos 14 dias.',
        low: 'Pouca minutagem, poucas coletas ou referências muito próximas.',
      },
    },
    summary: {
      leagues: leagues.length,
      rankedPlayers: allPlayers.length,
      improved: statusCounts.improved || 0,
      trendPositive: statusCounts.trendPositive || 0,
      declined: statusCounts.declined || 0,
      trendNegative: statusCounts.trendNegative || 0,
      stable: statusCounts.stable || 0,
      newPlayers: statusCounts.new || 0,
      insufficient: statusCounts.insufficient || 0,
      confidenceHigh: confidenceCounts.high || 0,
      confidenceMedium: confidenceCounts.medium || 0,
      confidenceLow: confidenceCounts.low || 0,
      alerts: Object.values(alerts).reduce((sum, items) => sum + items.length, 0),
      contextEligiblePlayers: leagues.reduce((sum, league) => sum + (league.contextEligiblePlayers || 0), 0),
      contextExcludedPlayers: leagues.reduce((sum, league) => sum + (league.contextExcludedPlayers || 0), 0),
    },
    alerts,
    leagues,
  }
}
