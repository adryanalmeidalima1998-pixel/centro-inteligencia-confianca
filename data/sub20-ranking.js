import staticRawDataset from '@/data/sub20-america-sul.json'
import { getMetricEligibility } from '@/data/sportsbase-map'
import {
  getWyscoutMetric,
  getWyscoutPrimaryPosition,
  parseWyscoutRow,
  WYSCOUT_METRIC_GROUPS,
} from '@/data/wyscout-map'

const ROLE_DEFINITIONS = {
  GK: {
    label: 'Goleiro', short: 'GOL', positions: ['GK'],
    groupWeights: { goleiros: .72, distribuicao: .23, disciplina: .05 },
    pizza: ['defesas_pct', 'gols_prevenidos_90', 'gols_sofridos_90', 'xga_90', 'clean_sheets_pct', 'saidas_90', 'passes_tras_recebidos_gk_90', 'passes_longos_90', 'passes_longos_pct', 'passes_pct'],
  },
  LB: {
    label: 'Lateral esquerdo', short: 'LE', positions: ['LB', 'LWB'],
    groupWeights: { defesa: .25, distribuicao: .18, criacao: .22, umcontraum: .22, producao: .08, disciplina: .05 },
    pizza: ['duelos_def_pct', 'intercecoes_90', 'acoes_def_sucesso_90', 'passes_prog_90', 'passes_prog_pct', 'cruzamentos_90', 'cruzamentos_pct', 'corridas_progressivas_90', 'dribles_90', 'dribles_pct', 'passes_area_90', 'assist_remate_90'],
  },
  CB: {
    label: 'Zagueiro', short: 'ZAG', positions: ['LCB', 'CB', 'RCB'],
    groupWeights: { defesa: .42, distribuicao: .30, criacao: .13, umcontraum: .08, disciplina: .07 },
    pizza: ['duelos_def_pct', 'duelos_aereos_pct', 'acoes_def_sucesso_90', 'intercecoes_90', 'cortes_90', 'remates_intercetados_90', 'passes_pct', 'passes_longos_90', 'passes_longos_pct', 'passes_prog_90', 'passes_prog_pct', 'passes_tercofinal_90'],
  },
  RB: {
    label: 'Lateral direito', short: 'LD', positions: ['RB', 'RWB'],
    groupWeights: { defesa: .25, distribuicao: .18, criacao: .22, umcontraum: .22, producao: .08, disciplina: .05 },
    pizza: ['duelos_def_pct', 'intercecoes_90', 'acoes_def_sucesso_90', 'passes_prog_90', 'passes_prog_pct', 'cruzamentos_90', 'cruzamentos_pct', 'corridas_progressivas_90', 'dribles_90', 'dribles_pct', 'passes_area_90', 'assist_remate_90'],
  },
  DM: {
    label: 'Volante', short: 'VOL', positions: ['DMF', 'LDMF', 'RDMF'],
    groupWeights: { defesa: .28, distribuicao: .28, criacao: .25, umcontraum: .10, producao: .04, disciplina: .05 },
    pizza: ['acoes_def_sucesso_90', 'intercecoes_90', 'duelos_def_pct', 'passes_90', 'passes_pct', 'passes_prog_90', 'passes_prog_pct', 'passes_tercofinal_90', 'passes_tercofinal_pct', 'passes_longos_90', 'passes_longos_pct', 'assist_remate_90'],
  },
  CM: {
    label: 'Meio-campista', short: 'MC', positions: ['CMF', 'LCMF', 'RCMF'],
    groupWeights: { distribuicao: .28, criacao: .30, defesa: .15, umcontraum: .12, producao: .10, disciplina: .05 },
    pizza: ['passes_90', 'passes_pct', 'passes_prog_90', 'passes_prog_pct', 'passes_tercofinal_90', 'passes_area_90', 'passes_chave_90', 'assist_remate_90', 'xa_90', 'corridas_progressivas_90', 'acoes_def_sucesso_90', 'intercecoes_90'],
  },
  AM: {
    label: 'Meia ofensivo', short: 'MEI', positions: ['AMF', 'LAMF', 'RAMF'],
    groupWeights: { criacao: .35, umcontraum: .22, producao: .20, finalizacao: .13, distribuicao: .07, disciplina: .03 },
    pizza: ['assist_remate_90', 'passes_chave_90', 'xa_90', 'passes_inteligentes_90', 'passes_area_90', 'passes_profundidade_90', 'passes_prog_90', 'dribles_90', 'dribles_pct', 'corridas_progressivas_90', 'gols_90', 'xg_90'],
  },
  LW: {
    label: 'Ponta esquerda', short: 'PE', positions: ['LW', 'LWF'],
    groupWeights: { umcontraum: .32, criacao: .25, producao: .20, finalizacao: .18, disciplina: .05 },
    pizza: ['dribles_90', 'dribles_pct', 'duelos_of_pct', 'corridas_progressivas_90', 'aceleracoes_90', 'passes_chave_90', 'passes_area_90', 'assistencias_90', 'xa_90', 'gols_90', 'xg_90', 'toques_area_90'],
  },
  RW: {
    label: 'Ponta direita', short: 'PD', positions: ['RW', 'RWF'],
    groupWeights: { umcontraum: .32, criacao: .25, producao: .20, finalizacao: .18, disciplina: .05 },
    pizza: ['dribles_90', 'dribles_pct', 'duelos_of_pct', 'corridas_progressivas_90', 'aceleracoes_90', 'passes_chave_90', 'passes_area_90', 'assistencias_90', 'xa_90', 'gols_90', 'xg_90', 'toques_area_90'],
  },
  CF: {
    label: 'Centroavante', short: 'CA', positions: ['CF'],
    groupWeights: { producao: .30, finalizacao: .30, umcontraum: .15, criacao: .12, distribuicao: .05, defesa: .03, disciplina: .05 },
    pizza: ['gols_90', 'xg_90', 'gols_sem_penalti_90', 'remates_90', 'remates_golo_pct', 'conversao_gols_pct', 'toques_area_90', 'duelos_aereos_pct', 'assist_remate_90', 'faltas_sofridas_90', 'acoes_atacantes_sucesso_90', 'passes_recebidos_90'],
  },
}

const ROLE_BY_POSITION = Object.entries(ROLE_DEFINITIONS).reduce((acc, [key, role]) => {
  role.positions.forEach(position => { acc[position] = key })
  return acc
}, {})

const ESSENTIAL_123_FIELDS = new Set([
  'Jogador', 'Equipa', 'Equipa dentro de um período de tempo seleccionado', 'Posição', 'Idade',
  'Partidas jogadas', 'Minutos jogados:', 'Golos', 'Assistências',
])

// Volumes totais dependem diretamente da minutagem. O índice usa todas as métricas
// posicionais elegíveis já normalizadas por 90, percentuais e índices comparáveis.
const INDEX_EXCLUDED_KEYS = new Set([
  'diferenca_gols_xg',
  'comprimento_passe_m',
  'comprimento_passe_longo_m',
  'remates_sofridos_90',
])

const round = (value, decimals = 1) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const factor = 10 ** decimals
  return Math.round(number * factor) / factor
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function cleanRawRow(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const isSentinel = String(value).trim() === '123'
    if (isSentinel && !ESSENTIAL_123_FIELDS.has(key)) return [key, null]
    return [key, value]
  }))
}

function roleForPosition(value) {
  const primary = getWyscoutPrimaryPosition(value)
  return ROLE_BY_POSITION[primary] || null
}

function percentile(value, values, higherIsBetter = true) {
  const current = Number(value)
  const valid = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!Number.isFinite(current) || !valid.length) return null
  let lower = 0
  let equal = 0
  for (const item of valid) {
    if (item < current) lower += 1
    else if (item === current) equal += 1
  }
  const base = ((lower + equal * .5) / valid.length) * 100
  return round(higherIsBetter ? base : 100 - base, 0)
}

function sampleConfidence(minutes) {
  const value = Math.max(0, Number(minutes) || 0)
  return Math.round(20 + 80 * Math.min(1, Math.sqrt(value / 900)))
}

function median(values = []) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function buildRoleMetrics(roleKey) {
  const role = ROLE_DEFINITIONS[roleKey]
  const seen = new Set()
  const metrics = []

  for (const [groupKey, groupWeight] of Object.entries(role.groupWeights)) {
    const group = WYSCOUT_METRIC_GROUPS[groupKey]
    if (!group) continue
    const available = group.metricas.filter(definition => {
      if (!definition || seen.has(definition.key)) return false
      if (definition.type === 'total' || INDEX_EXCLUDED_KEYS.has(definition.key)) return false
      return true
    })
    if (!available.length) continue
    const metricWeight = groupWeight / available.length
    for (const definition of available) {
      seen.add(definition.key)
      metrics.push({
        key: definition.key,
        definition,
        weight: metricWeight,
        groupKey,
        groupLabel: String(group.label || groupKey).replace(/^[^\p{L}\p{N}]+/u, ''),
        color: group.cor || '#0a66b7',
      })
    }
  }

  const total = metrics.reduce((sum, item) => sum + item.weight, 0) || 1
  return metrics.map(item => ({ ...item, weight: item.weight / total }))
}

for (const roleKey of Object.keys(ROLE_DEFINITIONS)) {
  ROLE_DEFINITIONS[roleKey].metrics = buildRoleMetrics(roleKey)
}

function buildPoolMetricCache(pool, roleKey) {
  const role = ROLE_DEFINITIONS[roleKey]
  const cache = {}
  for (const metric of role.metrics) {
    cache[metric.key] = pool
      .filter(player => getMetricEligibility(player, metric.definition, { players: pool, selectedMinimum: 0 }).eligible)
      .map(player => Number(player[metric.key]))
      .filter(Number.isFinite)
  }
  return cache
}

function scorePlayer(player, pool, roleKey, cache) {
  const role = ROLE_DEFINITIONS[roleKey]
  const totalWeight = role.metrics.reduce((sum, item) => sum + item.weight, 0)
  let weighted = 0
  let covered = 0
  const metrics = []

  for (const metric of role.metrics) {
    const values = cache[metric.key] || []
    if (!values.length) continue
    const eligibility = getMetricEligibility(player, metric.definition, { players: pool, selectedMinimum: 0 })
    if (!eligibility.eligible) continue
    const value = Number(player[metric.key])
    const pct = percentile(value, values, metric.definition.higherIsBetter !== false)
    if (!Number.isFinite(pct)) continue
    weighted += pct * metric.weight
    covered += metric.weight
    metrics.push({
      key: metric.key,
      label: metric.definition.label,
      value: round(value, metric.definition.decimals ?? 2),
      percentile: pct,
      weight: round(metric.weight * 100, 1),
      higherIsBetter: metric.definition.higherIsBetter !== false,
      median: round(median(values), metric.definition.decimals ?? 2),
      groupKey: metric.groupKey,
      groupLabel: metric.groupLabel,
      color: metric.color,
    })
  }

  const performance = covered ? weighted / covered : null
  const confidence = sampleConfidence(player.minutos)
  const coverage = totalWeight ? (covered / totalWeight) * 100 : 0
  const score = Number.isFinite(performance)
    ? performance * (.55 + .25 * confidence / 100 + .20 * coverage / 100)
    : null
  return {
    score: round(score, 1),
    performance: round(performance, 1),
    confidence,
    coverage: round(coverage, 0),
    metricCount: metrics.length,
    metrics,
  }
}

function addRanks(items, scoreKey, rankKey, filter = () => true) {
  const ranked = items.filter(filter).sort((a, b) => {
    const av = Number(a[scoreKey])
    const bv = Number(b[scoreKey])
    if (!Number.isFinite(av) && !Number.isFinite(bv)) return (b.minutos || 0) - (a.minutos || 0)
    if (!Number.isFinite(av)) return 1
    if (!Number.isFinite(bv)) return -1
    return bv - av || (b.minutos || 0) - (a.minutos || 0)
  })
  ranked.forEach((player, index) => { player[rankKey] = index + 1 })
}

const DATASET_CACHE = new Map()

function datasetFingerprint(rawDataset) {
  const sheets = Array.isArray(rawDataset?.sheets) ? rawDataset.sheets : []
  const counts = sheets.map(sheet => `${sheet.name}:${sheet.rows?.length || 0}`).join('|')
  return `${rawDataset?.source || 'sub20'}|${rawDataset?.uploadedAt || rawDataset?.generatedAt || ''}|${counts}`
}

export function getSub20Dataset(rawDataset = staticRawDataset) {
  const fingerprint = datasetFingerprint(rawDataset)
  if (DATASET_CACHE.has(fingerprint)) return DATASET_CACHE.get(fingerprint)

  const sheets = Array.isArray(rawDataset?.sheets) ? rawDataset.sheets : []
  const players = sheets.flatMap(sheet => (sheet.rows || []).map((raw, index) => {
    const normalized = parseWyscoutRow(cleanRawRow(raw))
    const roleKey = roleForPosition(normalized.posicao)
    const currentClub = normalized.equipa || ''
    const competitionClub = normalized.equipa_periodo || currentClub
    return {
      ...normalized,
      equipa: competitionClub,
      equipaAtual: currentClub,
      id: `${slugify(sheet.name)}-${raw._row || index + 2}`,
      liga: sheet.name,
      ligaSlug: slugify(sheet.name),
      sourceRow: raw._row || index + 2,
      roleKey,
      roleLabel: roleKey ? ROLE_DEFINITIONS[roleKey].label : 'Sem grupo',
      roleShort: roleKey ? ROLE_DEFINITIONS[roleKey].short : '—',
    }
  })).filter(player => player.nome && player.equipa && player.minutos > 0 && player.roleKey)

  const globalPools = {}
  const globalCaches = {}
  for (const roleKey of Object.keys(ROLE_DEFINITIONS)) {
    globalPools[roleKey] = players.filter(player => player.roleKey === roleKey)
    globalCaches[roleKey] = buildPoolMetricCache(globalPools[roleKey], roleKey)
  }

  const leaguePools = {}
  const leagueCaches = {}
  for (const sheet of sheets) {
    leaguePools[sheet.name] = {}
    leagueCaches[sheet.name] = {}
    for (const roleKey of Object.keys(ROLE_DEFINITIONS)) {
      const pool = players.filter(player => player.liga === sheet.name && player.roleKey === roleKey)
      leaguePools[sheet.name][roleKey] = pool
      leagueCaches[sheet.name][roleKey] = buildPoolMetricCache(pool, roleKey)
    }
  }

  for (const player of players) {
    const global = scorePlayer(player, globalPools[player.roleKey], player.roleKey, globalCaches[player.roleKey])
    const league = scorePlayer(player, leaguePools[player.liga][player.roleKey], player.roleKey, leagueCaches[player.liga][player.roleKey])
    player.globalScore = global.score
    player.globalPerformance = global.performance
    player.globalCoverage = global.coverage
    player.globalMetricCount = global.metricCount
    player.sampleConfidence = global.confidence
    player.globalMetrics = global.metrics
    player.leagueScore = league.score
    player.leaguePerformance = league.performance
    player.leagueCoverage = league.coverage
    player.leagueMetricCount = league.metricCount
    player.leagueMetrics = league.metrics
  }

  addRanks(players, 'globalScore', 'rankGlobal')
  for (const roleKey of Object.keys(ROLE_DEFINITIONS)) {
    addRanks(players, 'globalScore', 'rankRoleGlobal', player => player.roleKey === roleKey)
  }
  for (const sheet of sheets) {
    addRanks(players, 'leagueScore', 'rankLeague', player => player.liga === sheet.name)
    for (const roleKey of Object.keys(ROLE_DEFINITIONS)) {
      addRanks(players, 'leagueScore', 'rankLeagueRole', player => player.liga === sheet.name && player.roleKey === roleKey)
    }
  }

  const leagueMeta = sheets.map(sheet => {
    const subset = players.filter(player => player.liga === sheet.name)
    return {
      name: sheet.name,
      slug: slugify(sheet.name),
      players: subset.length,
      clubs: new Set(subset.map(player => player.equipa)).size,
    }
  })
  const roleMeta = Object.entries(ROLE_DEFINITIONS).map(([key, role]) => ({
    key,
    label: role.label,
    short: role.short,
    players: players.filter(player => player.roleKey === key).length,
    scoreMetrics: role.metrics.length,
  }))
  const minutes = players.map(player => player.minutos).filter(Number.isFinite)
  const ages = players.map(player => player.idade).filter(Number.isFinite)

  const dataset = {
    source: rawDataset?.source || 'SUB20 AMÉRICA DO SUL.xlsx',
    generatedAt: rawDataset?.generatedAt || null,
    uploadedAt: rawDataset?.uploadedAt || rawDataset?.generatedAt || null,
    storage: rawDataset?.storage || 'static',
    warning: rawDataset?.warning || null,
    players,
    meta: {
      totalPlayers: players.length,
      totalLeagues: leagueMeta.length,
      totalClubs: new Set(players.map(player => player.equipa)).size,
      averageAge: round(ages.reduce((sum, value) => sum + value, 0) / Math.max(1, ages.length), 1),
      medianMinutes: Math.round(median(minutes) || 0),
      averageMetricCoverage: round(players.reduce((sum, player) => sum + (player.globalMetricCount || 0), 0) / Math.max(1, players.length), 1),
      methodology: 'Todas as métricas de desempenho elegíveis e normalizadas por posição, convertidas em percentis e ajustadas pela amostra e cobertura.',
      leagues: leagueMeta,
      roles: roleMeta,
    },
  }

  DATASET_CACHE.set(fingerprint, dataset)
  if (DATASET_CACHE.size > 3) DATASET_CACHE.delete(DATASET_CACHE.keys().next().value)
  return dataset
}

export function getSub20List(rawDataset = staticRawDataset) {
  const dataset = getSub20Dataset(rawDataset)
  return {
    source: dataset.source,
    generatedAt: dataset.generatedAt,
    uploadedAt: dataset.uploadedAt,
    storage: dataset.storage,
    warning: dataset.warning,
    meta: dataset.meta,
    players: dataset.players.map(player => ({
      id: player.id,
      nome: player.nome,
      equipa: player.equipa,
      equipaAtual: player.equipaAtual,
      posicao: player.posicao,
      idade: player.idade,
      minutos: player.minutos,
      jogos: player.jogos,
      gols: player.gols,
      assistencias: player.assistencias,
      liga: player.liga,
      ligaSlug: player.ligaSlug,
      roleKey: player.roleKey,
      roleLabel: player.roleLabel,
      roleShort: player.roleShort,
      globalScore: player.globalScore,
      leagueScore: player.leagueScore,
      globalPerformance: player.globalPerformance,
      leaguePerformance: player.leaguePerformance,
      sampleConfidence: player.sampleConfidence,
      globalCoverage: player.globalCoverage,
      leagueCoverage: player.leagueCoverage,
      globalMetricCount: player.globalMetricCount,
      leagueMetricCount: player.leagueMetricCount,
      rankGlobal: player.rankGlobal,
      rankRoleGlobal: player.rankRoleGlobal,
      rankLeague: player.rankLeague,
      rankLeagueRole: player.rankLeagueRole,
    })),
  }
}

export function getSub20Player(rawDataset = staticRawDataset, id) {
  const dataset = getSub20Dataset(rawDataset)
  const player = dataset.players.find(item => item.id === id)
  if (!player) return null
  const role = ROLE_DEFINITIONS[player.roleKey]
  const globalMetricMap = new Map(player.globalMetrics.map(item => [item.key, item]))
  const leagueMetricMap = new Map(player.leagueMetrics.map(item => [item.key, item]))
  const metrics = role.metrics.map(metric => {
    const definition = getWyscoutMetric(metric.key) || metric.definition
    const global = globalMetricMap.get(metric.key)
    const league = leagueMetricMap.get(metric.key)
    return {
      key: metric.key,
      label: definition?.label || metric.key,
      value: global?.value ?? league?.value ?? null,
      weight: round(metric.weight * 100, 1),
      globalPercentile: global?.percentile ?? null,
      leaguePercentile: league?.percentile ?? null,
      globalMedian: global?.median ?? null,
      leagueMedian: league?.median ?? null,
      higherIsBetter: definition?.higherIsBetter !== false,
      groupKey: metric.groupKey,
      groupLabel: metric.groupLabel,
      color: metric.color,
    }
  })
  const metricMap = new Map(metrics.map(item => [item.key, item]))
  const preferredPizzaMetrics = role.pizza
    .map(key => metricMap.get(key))
    .filter(item => item && (Number.isFinite(item.globalPercentile) || Number.isFinite(item.leaguePercentile)))
  const preferredKeys = new Set(preferredPizzaMetrics.map(item => item.key))
  const fallbackPizzaMetrics = metrics
    .filter(item => !preferredKeys.has(item.key) && (Number.isFinite(item.globalPercentile) || Number.isFinite(item.leaguePercentile)))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
  const pizzaMetrics = [...preferredPizzaMetrics, ...fallbackPizzaMetrics].slice(0, 12)
  const strengths = metrics.filter(item => Number.isFinite(item.globalPercentile)).sort((a, b) => b.globalPercentile - a.globalPercentile).slice(0, 3)
  const watchouts = metrics.filter(item => Number.isFinite(item.globalPercentile)).sort((a, b) => a.globalPercentile - b.globalPercentile).slice(0, 3)
  return {
    source: dataset.source,
    generatedAt: dataset.generatedAt,
    uploadedAt: dataset.uploadedAt,
    storage: dataset.storage,
    warning: dataset.warning,
    player: {
      id: player.id,
      nome: player.nome,
      equipa: player.equipa,
      equipaAtual: player.equipaAtual,
      posicao: player.posicao,
      idade: player.idade,
      minutos: player.minutos,
      jogos: player.jogos,
      gols: player.gols,
      assistencias: player.assistencias,
      pe: player.pe,
      altura: player.altura,
      liga: player.liga,
      roleKey: player.roleKey,
      roleLabel: player.roleLabel,
      roleShort: player.roleShort,
      globalScore: player.globalScore,
      leagueScore: player.leagueScore,
      globalPerformance: player.globalPerformance,
      leaguePerformance: player.leaguePerformance,
      sampleConfidence: player.sampleConfidence,
      globalCoverage: player.globalCoverage,
      leagueCoverage: player.leagueCoverage,
      globalMetricCount: player.globalMetricCount,
      leagueMetricCount: player.leagueMetricCount,
      rankGlobal: player.rankGlobal,
      rankRoleGlobal: player.rankRoleGlobal,
      rankLeague: player.rankLeague,
      rankLeagueRole: player.rankLeagueRole,
    },
    metrics,
    pizzaMetrics,
    strengths,
    watchouts,
    comparison: {
      globalGroupSize: dataset.players.filter(item => item.roleKey === player.roleKey).length,
      leagueGroupSize: dataset.players.filter(item => item.liga === player.liga && item.roleKey === player.roleKey).length,
      roleLabel: role.label,
    },
  }
}

export const SUB20_ROLE_DEFINITIONS = ROLE_DEFINITIONS
