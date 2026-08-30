import {
  calculateSportsbasePercentile,
  getMetricEligibility,
  getSportsbaseMetric,
  getSportsbasePositionGroup,
  getSuggestedMinimumMinutes,
  SPORTSBASE_POSITION_GROUPS,
} from '@/data/sportsbase-map'
import { SPORTSBASE_IAP_PERFIS } from '@/data/sportsbase-iap-profiles'

export const GROUP_CODE_TO_PROFILE = {
  GK: 'Goleiro', CB: 'Zagueiro', FB: 'Lateral', DM: 'Volante',
  AM: 'Meia', WG: 'Extremo', ST: 'Atacante',
}
export const PROFILE_TO_GROUP_CODE = Object.fromEntries(Object.entries(GROUP_CODE_TO_PROFILE).map(([code, label]) => [label, code]))

export const GROUP_ACCENTS = {
  GK: '#b45309', CB: '#2563eb', FB: '#0891b2', DM: '#7c3aed',
  AM: '#db2777', WG: '#ea580c', ST: '#dc2626',
}

export function getGroupCode(playerOrPosition) {
  if (typeof playerOrPosition === 'string') return getSportsbasePositionGroup(playerOrPosition)
  return getSportsbasePositionGroup(playerOrPosition?.posicao)
}

export function getGroupLabel(code) {
  return SPORTSBASE_POSITION_GROUPS[code]?.label || 'Sem grupo'
}

export function getProfilesForGroup(code) {
  return SPORTSBASE_IAP_PERFIS[GROUP_CODE_TO_PROFILE[code]] || {}
}

function profileMetricDefinition(metric) {
  const catalog = getSportsbaseMetric(metric.key)
  return {
    ...(catalog || { key: metric.key, label: metric.key, type: 'per90', higherIsBetter: !metric.inverted }),
    higherIsBetter: metric.inverted ? false : catalog?.higherIsBetter !== false,
    denominatorKey: metric.denominatorKey || catalog?.denominatorKey || null,
    denominatorLabel: catalog?.denominatorLabel || null,
    minAttempts: metric.minAttempts || catalog?.minAttempts || 0,
  }
}

export function getSampleConfidence(minutes, reference) {
  const value = Number(minutes) || 0
  const ref = Math.max(90, Number(reference) || 0)
  if (value >= ref * 1.75) return { label: 'Alta', score: 100, color: '#15803d' }
  if (value >= ref) return { label: 'Média', score: 78, color: '#ca8a04' }
  if (value >= ref * 0.6) return { label: 'Baixa', score: 52, color: '#ea580c' }
  return { label: 'Muito baixa', score: 28, color: '#dc2626' }
}

function eligiblePool(pool, metricDef, minimumMinutes) {
  return pool.filter(player => getMetricEligibility(player, metricDef, {
    players: pool,
    selectedMinimum: minimumMinutes,
  }).eligible)
}

export function calculateProfileScore(player, pool, groupCode, profileName, minimumMinutes = 'auto') {
  const profiles = getProfilesForGroup(groupCode)
  const metrics = profiles[profileName] || []
  const resolvedMinimum = minimumMinutes === 'auto' ? getSuggestedMinimumMinutes(pool) : Number(minimumMinutes) || 0
  let weighted = 0
  let usedWeight = 0
  let totalWeight = 0
  const details = []

  for (const metric of metrics) {
    const def = profileMetricDefinition(metric)
    const weight = Number(metric.peso) || 1
    totalWeight += weight
    const eligibility = getMetricEligibility(player, def, { players: pool, selectedMinimum: resolvedMinimum })
    const comparisonPool = eligiblePool(pool, def, resolvedMinimum)
    const values = comparisonPool.map(item => Number(item?.[def.key])).filter(Number.isFinite)
    const percentile = eligibility.eligible
      ? calculateSportsbasePercentile(player?.[def.key], values, def.higherIsBetter !== false)
      : null
    if (percentile !== null) {
      weighted += percentile * weight
      usedWeight += weight
    }
    details.push({
      key: def.key,
      label: def.label,
      type: def.type,
      value: Number(player?.[def.key]),
      percentile,
      weight,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      higherIsBetter: def.higherIsBetter !== false,
    })
  }

  const rawScore = usedWeight ? weighted / usedWeight : 0
  const coverage = totalWeight ? usedWeight / totalWeight : 0
  const confidence = getSampleConfidence(player?.minutos, resolvedMinimum)
  const score = Math.round(rawScore * (0.82 + coverage * 0.18))
  return {
    profile: profileName,
    score,
    rawScore: Math.round(rawScore),
    coverage: Math.round(coverage * 100),
    minimumMinutes: resolvedMinimum,
    confidence,
    details,
  }
}

export function calculatePlayerProfiles(player, pool, minimumMinutes = 'auto') {
  const groupCode = getGroupCode(player)
  const profiles = getProfilesForGroup(groupCode)
  const ranking = Object.keys(profiles)
    .map(profile => calculateProfileScore(player, pool, groupCode, profile, minimumMinutes))
    .sort((a, b) => b.score - a.score)
  return {
    groupCode,
    groupLabel: getGroupLabel(groupCode),
    ranking,
    dominant: ranking[0] || null,
    secondary: ranking[1] || null,
  }
}

const TACTICAL_BASE = {
  CB: [
    ['duelos_def_pct', 3], ['intercecoes_90', 2.5], ['passes_prog_90', 2.5],
    ['passes_pct', 2], ['duelos_aereos_pct', 2], ['erros_chances_gol_90', 2, true],
  ],
  FB: [
    ['duelos_def_pct', 2], ['desarmes_90', 2], ['passes_prog_90', 2],
    ['cruzamentos_90', 2], ['dribles_90', 1.5], ['perdas_bola_90', 2, true],
  ],
  DM: [
    ['recuperacoes_90', 2.5], ['duelos_def_pct', 2], ['passes_prog_90', 2.5],
    ['passes_prog_pct', 2], ['intercecoes_90', 2], ['perdas_campo_proprio_90', 2, true],
  ],
  AM: [
    ['passes_chave_90', 3], ['chances_criadas_90', 2.5], ['passes_area_90', 2],
    ['passes_prog_90', 1.5], ['assistencias_90', 2], ['perdas_bola_90', 1.5, true],
  ],
  WG: [
    ['dribles_90', 2.5], ['dribles_pct', 2], ['dribles_tercofinal_90', 2],
    ['passes_area_90', 1.5], ['xg_90', 2], ['perdas_individuais_90', 1.5, true],
  ],
  ST: [
    ['xg_90', 3], ['gols_90', 3], ['remates_golo_pct', 2.5],
    ['remates_area_90', 2], ['duelos_of_pct', 1.5], ['participacao_gols_90', 1.5],
  ],
  GK: [],
}

function tacticalMetricList(groupCode, model) {
  const base = [...(TACTICAL_BASE[groupCode] || [])]
  const modelMetrics = Array.isArray(model?.recruitmentMetrics) ? model.recruitmentMetrics : []
  for (const key of modelMetrics) {
    const def = getSportsbaseMetric(key)
    if (!def) continue
    const existing = base.find(item => item[0] === key)
    if (existing) existing[1] += 0.75
    else base.push([key, 0.9, def.higherIsBetter === false])
  }
  return base
}

export function calculateTacticalFit(player, pool, model, minimumMinutes = 'auto') {
  const groupCode = getGroupCode(player)
  const metrics = tacticalMetricList(groupCode, model)
  const resolvedMinimum = minimumMinutes === 'auto' ? getSuggestedMinimumMinutes(pool) : Number(minimumMinutes) || 0
  let weighted = 0
  let used = 0
  const details = []

  for (const [key, weight, inverted] of metrics) {
    const catalog = getSportsbaseMetric(key) || { key, label: key, type: 'per90', higherIsBetter: !inverted }
    const def = { ...catalog, higherIsBetter: inverted ? false : catalog.higherIsBetter !== false }
    const eligibility = getMetricEligibility(player, def, { players: pool, selectedMinimum: resolvedMinimum })
    const values = eligiblePool(pool, def, resolvedMinimum).map(item => Number(item?.[key])).filter(Number.isFinite)
    const percentile = eligibility.eligible
      ? calculateSportsbasePercentile(player?.[key], values, def.higherIsBetter !== false)
      : null
    if (percentile !== null) {
      weighted += percentile * weight
      used += weight
    }
    details.push({ key, label: def.label, percentile, value: player?.[key], weight, eligible: eligibility.eligible, reason: eligibility.reason })
  }

  const score = used ? Math.round(weighted / used) : 0
  const sorted = details.filter(item => item.percentile !== null).sort((a, b) => b.percentile - a.percentile)
  return {
    score,
    details,
    strengths: sorted.slice(0, 3),
    concerns: [...sorted].sort((a, b) => a.percentile - b.percentile).slice(0, 3),
    minimumMinutes: resolvedMinimum,
  }
}

export function buildScoutingPlayer(player, pool, model, minimumMinutes = 'auto') {
  const profiles = calculatePlayerProfiles(player, pool, minimumMinutes)
  const tactical = calculateTacticalFit(player, pool, model, minimumMinutes)
  const confidence = getSampleConfidence(player?.minutos, tactical.minimumMinutes)
  const profileScore = profiles.dominant?.score || 0
  const finalScore = Math.round(profileScore * 0.58 + tactical.score * 0.30 + confidence.score * 0.12)
  const strengths = [...(profiles.dominant?.details || [])]
    .filter(item => item.percentile !== null)
    .sort((a, b) => b.percentile - a.percentile)
    .slice(0, 3)
  const concerns = [...(profiles.dominant?.details || [])]
    .filter(item => item.percentile !== null)
    .sort((a, b) => a.percentile - b.percentile)
    .slice(0, 3)

  return {
    ...player,
    _scouting: {
      finalScore,
      groupCode: profiles.groupCode,
      groupLabel: profiles.groupLabel,
      profile: profiles.dominant?.profile || 'Sem perfil',
      profileScore,
      secondaryProfile: profiles.secondary?.profile || null,
      secondaryScore: profiles.secondary?.score || 0,
      profileRanking: profiles.ranking,
      tacticalScore: tactical.score,
      tactical,
      confidence,
      strengths,
      concerns,
      minimumMinutes: tactical.minimumMinutes,
    },
  }
}

function percentileLookup(values = [], higherIsBetter = true) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  const lookup = new Map()
  let index = 0
  while (index < sorted.length) {
    const value = sorted[index]
    let end = index + 1
    while (end < sorted.length && sorted[end] === value) end += 1
    const raw = ((index + (end - index) * 0.5) / sorted.length) * 100
    lookup.set(value, Math.round(higherIsBetter ? raw : 100 - raw))
    index = end
  }
  return lookup
}

function metricSignature(def) {
  return [def.key, def.denominatorKey || '', def.minAttempts || 0, def.higherIsBetter !== false ? 1 : 0].join('|')
}

function createBatchContext(pool, groupCode, model, minimumMinutes) {
  const resolvedMinimum = minimumMinutes === 'auto' ? getSuggestedMinimumMinutes(pool) : Number(minimumMinutes) || 0
  const profileDefs = Object.values(getProfilesForGroup(groupCode)).flat().map(profileMetricDefinition)
  const tacticalDefs = tacticalMetricList(groupCode, model).map(([key, weight, inverted]) => {
    const catalog = getSportsbaseMetric(key) || { key, label:key, type:'per90', higherIsBetter:!inverted }
    return { ...catalog, higherIsBetter: inverted ? false : catalog.higherIsBetter !== false, _weight:weight }
  })
  const definitions = [...profileDefs, ...tacticalDefs]
  const cache = new Map()
  for (const def of definitions) {
    const signature = metricSignature(def)
    if (cache.has(signature)) continue
    const values = pool
      .filter(player => getMetricEligibility(player, def, { players:pool, selectedMinimum:resolvedMinimum }).eligible)
      .map(player => Number(player?.[def.key]))
      .filter(Number.isFinite)
    cache.set(signature, { def, lookup:percentileLookup(values, def.higherIsBetter !== false) })
  }
  return { pool, groupCode, model, resolvedMinimum, cache }
}

function batchDetail(player, def, context, weight = 1) {
  const eligibility = getMetricEligibility(player, def, { players:context.pool, selectedMinimum:context.resolvedMinimum })
  const lookup = context.cache.get(metricSignature(def))?.lookup
  const value = Number(player?.[def.key])
  return {
    key:def.key, label:def.label, type:def.type, value,
    percentile:eligibility.eligible && Number.isFinite(value) ? (lookup?.get(value) ?? null) : null,
    weight, eligible:eligibility.eligible, reason:eligibility.reason,
    higherIsBetter:def.higherIsBetter !== false,
  }
}

function batchProfileScore(player, profileName, metrics, context) {
  let weighted = 0
  let usedWeight = 0
  let totalWeight = 0
  const details = metrics.map(metric => {
    const def = profileMetricDefinition(metric)
    const weight = Number(metric.peso) || 1
    totalWeight += weight
    const detail = batchDetail(player, def, context, weight)
    if (detail.percentile !== null) {
      weighted += detail.percentile * weight
      usedWeight += weight
    }
    return detail
  })
  const rawScore = usedWeight ? weighted / usedWeight : 0
  const coverage = totalWeight ? usedWeight / totalWeight : 0
  const confidence = getSampleConfidence(player?.minutos, context.resolvedMinimum)
  return {
    profile:profileName,
    score:Math.round(rawScore * (0.82 + coverage * 0.18)),
    rawScore:Math.round(rawScore), coverage:Math.round(coverage * 100),
    minimumMinutes:context.resolvedMinimum, confidence, details,
  }
}

function batchBuildPlayer(player, context) {
  const profiles = getProfilesForGroup(context.groupCode)
  const ranking = Object.entries(profiles)
    .map(([name, metrics]) => batchProfileScore(player, name, metrics, context))
    .sort((a, b) => b.score - a.score)
  const tacticalDetails = tacticalMetricList(context.groupCode, context.model).map(([key, weight, inverted]) => {
    const catalog = getSportsbaseMetric(key) || { key, label:key, type:'per90', higherIsBetter:!inverted }
    const def = { ...catalog, higherIsBetter:inverted ? false : catalog.higherIsBetter !== false }
    return batchDetail(player, def, context, weight)
  })
  let tacticalWeighted = 0
  let tacticalUsed = 0
  for (const detail of tacticalDetails) {
    if (detail.percentile !== null) {
      tacticalWeighted += detail.percentile * detail.weight
      tacticalUsed += detail.weight
    }
  }
  const tacticalScore = tacticalUsed ? Math.round(tacticalWeighted / tacticalUsed) : 0
  const tacticalSorted = tacticalDetails.filter(item => item.percentile !== null).sort((a, b) => b.percentile - a.percentile)
  const dominant = ranking[0] || null
  const secondary = ranking[1] || null
  const confidence = getSampleConfidence(player?.minutos, context.resolvedMinimum)
  const finalScore = Math.round((dominant?.score || 0) * 0.58 + tacticalScore * 0.30 + confidence.score * 0.12)
  const profileDetails = [...(dominant?.details || [])].filter(item => item.percentile !== null)
  return {
    ...player,
    _scouting:{
      finalScore, groupCode:context.groupCode, groupLabel:getGroupLabel(context.groupCode),
      profile:dominant?.profile || 'Sem perfil', profileScore:dominant?.score || 0,
      secondaryProfile:secondary?.profile || null, secondaryScore:secondary?.score || 0,
      profileRanking:ranking, tacticalScore,
      tactical:{
        score:tacticalScore, details:tacticalDetails,
        strengths:tacticalSorted.slice(0,3),
        concerns:[...tacticalSorted].sort((a,b)=>a.percentile-b.percentile).slice(0,3),
        minimumMinutes:context.resolvedMinimum,
      },
      confidence,
      strengths:[...profileDetails].sort((a,b)=>b.percentile-a.percentile).slice(0,3),
      concerns:[...profileDetails].sort((a,b)=>a.percentile-b.percentile).slice(0,3),
      minimumMinutes:context.resolvedMinimum,
    },
  }
}

export function enrichScoutingPool(players = [], model = null, minimumMinutes = 'auto') {
  const byGroup = players.reduce((acc, player) => {
    const code = getGroupCode(player)
    if (!code) return acc
    if (!acc[code]) acc[code] = []
    acc[code].push(player)
    return acc
  }, {})
  const contexts = Object.fromEntries(Object.entries(byGroup).map(([code, pool]) => [code, createBatchContext(pool, code, model, minimumMinutes)]))
  return players.map(player => {
    const code = getGroupCode(player)
    const context = contexts[code]
    return context ? batchBuildPlayer(player, context) : buildScoutingPlayer(player, players, model, minimumMinutes)
  })
}

export function scoutingNarrative(player) {
  const scout = player?._scouting
  if (!scout) return { headline: 'Sem leitura disponível', observation: 'Dados insuficientes para uma leitura segura.' }
  const best = scout.strengths?.[0]
  const risk = scout.concerns?.[0]
  const headline = `${scout.profile} · fit ${scout.finalScore}/100`
  let observation = best
    ? `O principal sinal estatístico é ${best.label.toLowerCase()} no percentil ${best.percentile}.`
    : 'Não há métricas elegíveis suficientes para destacar um comportamento.'
  if (risk) observation += ` A validação em vídeo deve priorizar ${risk.label.toLowerCase()} (P${risk.percentile}).`
  if (scout.confidence.label === 'Muito baixa' || scout.confidence.label === 'Baixa') observation += ' A amostra ainda é curta e o dado deve ser tratado apenas como triagem.'
  return { headline, observation }
}
