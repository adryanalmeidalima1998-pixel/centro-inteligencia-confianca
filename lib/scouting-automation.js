import { sql } from '@vercel/postgres'
import { getLeague } from '@/data/leagues'
import {
  SPORTSBASE_CORE_METRICS,
  calculateSportsbasePercentile,
  getMetricEligibility,
  getSportsbaseMetric,
  getSportsbasePositionGroup,
  getSuggestedMinimumMinutes,
} from '@/data/sportsbase-map'
import { enrichScoutingPool, getGroupCode } from '@/data/sportsbase-scouting'
import { getClubSportsbase } from '@/lib/club-sportsbase-store'
import { encodePlayerKey } from '@/data/player-route'
import { enrichPlayersWithFoot } from '@/data/player-foot'
import {
  evaluateClubMarketContext,
  getClubLeagueMarketPolicy,
  marketContextForDashboard,
  summarizeClubMarket,
} from '@/data/club-market-context'

const DAY = 86400000
const STAGES = ['Identificados', 'Análise em vídeo', 'Observação ao vivo', 'Pré-lista', 'Alvo prioritário', 'Acompanhamento']
const POSITION_GROUPS = ['CB', 'FB', 'DM', 'AM', 'WG', 'ST']
const GROUP_LABELS = { CB: 'Zagueiros', FB: 'Laterais', DM: 'Volantes', AM: 'Meias', WG: 'Extremos', ST: 'Atacantes', GK: 'Goleiros' }

const NEED_MAP = {
  construcao: { title: 'Construção e controle', group: 'DM', reason: 'Elevar segurança, circulação e progressão desde trás.' },
  progressao: { title: 'Progressão territorial', group: 'DM', reason: 'Ganhar avanço por passe e condução para o campo ofensivo.' },
  desequilibrio: { title: 'Desequilíbrio individual', group: 'WG', reason: 'Aumentar 1×1, condução e entradas no terço final.' },
  pressao: { title: 'Pressão e recuperação alta', group: 'WG', reason: 'Sustentar pressão e recuperar a bola no campo rival.' },
  finalizacao: { title: 'Criação e presença de área', group: 'ST', reason: 'Elevar geração de chances, xG e ocupação da área.' },
  seguranca: { title: 'Controle de risco', group: 'DM', reason: 'Reduzir perdas e estabilizar a posse em zonas sensíveis.' },
}

function nowIso() { return new Date().toISOString() }
function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback }
function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, num(value))) }
function round(value, decimals = 0) { const p = 10 ** decimals; return Math.round(num(value) * p) / p }
function text(value) { return String(value ?? '').trim() }
function normalize(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function playerKey(player, league = '') { return `${normalize(player?.nome)}|${normalize(player?.equipa || player?.clube || player?.time_atual)}|${normalize(league || player?._liga || player?.liga)}` }
function nameKey(player) { return normalize(player?.nome || player?.jogador) }
function daysSince(date) {
  if (!date) return null
  const stamp = new Date(date).getTime()
  return Number.isFinite(stamp) ? Math.max(0, Math.floor((Date.now() - stamp) / DAY)) : null
}
function freshness(date) {
  const days = daysSince(date)
  if (days === null) return { label: 'Sem upload', level: 'critical', days: null }
  if (days <= 7) return { label: 'Atualizada', level: 'ok', days }
  if (days <= 14) return { label: 'Atenção', level: 'warning', days }
  return { label: 'Desatualizada', level: 'critical', days }
}
function ageScore(age) {
  const value = num(age, 99)
  if (value <= 20) return 100
  if (value <= 21) return 96
  if (value <= 23) return 90
  if (value <= 25) return 80
  if (value <= 27) return 68
  if (value <= 29) return 54
  return 38
}
function positionGroup(value) { return getSportsbasePositionGroup(value) || getGroupCode(value) || null }
function expiryDays(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.ceil((parsed.getTime() - Date.now()) / DAY)
}
function safeJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch (_) { return fallback }
}

async function safeRows(query) {
  try { return (await query()).rows || [] } catch (_) { return [] }
}

export async function ensureAutomationTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS cig_import_logs (
      id SERIAL PRIMARY KEY,
      provider TEXT NOT NULL,
      source_type TEXT NOT NULL,
      league_slug TEXT,
      filename TEXT,
      sheet_name TEXT,
      rows_processed INTEGER DEFAULT 0,
      rows_eligible INTEGER DEFAULT 0,
      clubs INTEGER DEFAULT 0,
      recognized_headers INTEGER DEFAULT 0,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      validation JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'success',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS cig_automation_runs (
      id SERIAL PRIMARY KEY,
      trigger_type TEXT DEFAULT 'manual',
      trigger_ref TEXT,
      status TEXT DEFAULT 'running',
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS cig_automation_snapshots (
      id SERIAL PRIMARY KEY,
      run_id INTEGER,
      period_key TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS cig_automation_alerts (
      id SERIAL PRIMARY KEY,
      fingerprint TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      href TEXT,
      entity_key TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'active',
      first_seen_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS cig_automation_reports (
      id SERIAL PRIMARY KEY,
      period_key TEXT NOT NULL UNIQUE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cig_snapshots_created ON cig_automation_snapshots(created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_cig_runs_started ON cig_automation_runs(started_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_cig_alerts_status ON cig_automation_alerts(status, last_seen_at DESC)`
}

export async function recordImportLog(input = {}) {
  await ensureAutomationTables()
  const row = await sql`
    INSERT INTO cig_import_logs (
      provider, source_type, league_slug, filename, sheet_name,
      rows_processed, rows_eligible, clubs, recognized_headers,
      warnings, validation, status
    ) VALUES (
      ${input.provider || 'unknown'}, ${input.sourceType || 'market'}, ${input.leagueSlug || null},
      ${input.filename || null}, ${input.sheetName || null}, ${num(input.rowsProcessed)},
      ${num(input.rowsEligible)}, ${num(input.clubs)}, ${num(input.recognizedHeaders)},
      ${JSON.stringify(input.warnings || [])}::jsonb,
      ${JSON.stringify(input.validation || {})}::jsonb,
      ${input.status || 'success'}
    ) RETURNING id, created_at
  `
  return row.rows[0]
}

async function latestSnapshot() {
  await ensureAutomationTables()
  const result = await sql`
    SELECT id, run_id, period_key, payload, created_at
    FROM cig_automation_snapshots
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (!result.rows.length) return null
  return { ...result.rows[0], payload: safeJson(result.rows[0].payload, {}) }
}

async function latestUploads() {
  const rows = await safeRows(() => sql`
    SELECT DISTINCT ON (slug, fonte) slug, data, total, fonte, upload_at
    FROM liga_jogadores
    ORDER BY slug, fonte, upload_at DESC
  `)
  const grouped = rows.reduce((acc, row) => {
    if (!acc[row.slug]) acc[row.slug] = []
    acc[row.slug].push(row)
    return acc
  }, {})
  return Object.entries(grouped).map(([slug, variants]) => {
    const sportsbase = variants.find(row => text(row.fonte || 'sportsbase') === 'sportsbase')
    const wyscout = variants.find(row => text(row.fonte) === 'wyscout')
    if (sportsbase) {
      const sportsbasePlayers = Array.isArray(sportsbase.data) ? sportsbase.data : []
      const wyscoutPlayers = Array.isArray(wyscout?.data) ? wyscout.data : []
      return {
        ...sportsbase,
        data: enrichPlayersWithFoot(sportsbasePlayers, wyscoutPlayers, 'wyscout'),
        sourceAvailability: {
          sportsbase: true,
          wyscout: Boolean(wyscout),
          sportsbaseUploadAt: sportsbase.upload_at || null,
          wyscoutUploadAt: wyscout?.upload_at || null,
        },
      }
    }
    return wyscout ? {
      ...wyscout,
      sourceAvailability: {
        sportsbase: false,
        wyscout: true,
        sportsbaseUploadAt: null,
        wyscoutUploadAt: wyscout.upload_at || null,
      },
    } : variants[0]
  }).filter(Boolean)
}

function validateLeague(row) {
  const players = Array.isArray(row.data) ? row.data : []
  const source = text(row.fonte || players[0]?._fonte || 'sportsbase')
  const maxMinutes = Math.max(0, ...players.map(player => num(player.minutos)))
  const minimum = source === 'sportsbase'
    ? getSuggestedMinimumMinutes(players)
    : Math.max(270, Math.round((maxMinutes * 0.25) / 90) * 90)
  const eligible = players.filter(player => num(player.minutos) >= minimum).length
  const teams = new Set(players.map(player => text(player.equipa)).filter(Boolean))
  const duplicateKeys = new Map()
  const missingPosition = []
  const invalidPercentages = []
  const invalidPer90 = []
  const incoherentMinutes = []
  const teamVariants = new Map()

  for (const player of players) {
    const key = `${normalize(player.nome)}|${normalize(player.equipa)}`
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1)
    if (!text(player.posicao)) missingPosition.push(player.nome)
    const teamKey = normalize(player.equipa)
    if (teamKey) {
      if (!teamVariants.has(teamKey)) teamVariants.set(teamKey, new Set())
      teamVariants.get(teamKey).add(text(player.equipa))
    }
    const games = num(player.jogos)
    const minutes = num(player.minutos)
    if (minutes < 0 || (games > 0 && minutes > games * 130 + 30)) incoherentMinutes.push(player.nome)
    for (const [keyName, raw] of Object.entries(player)) {
      const value = Number(raw)
      if (!Number.isFinite(value)) continue
      if (keyName.endsWith('_pct') && (value < 0 || value > 100.001)) invalidPercentages.push(`${player.nome}:${keyName}`)
      if (keyName.endsWith('_90') && (value < 0 || value > 500)) invalidPer90.push(`${player.nome}:${keyName}`)
    }
  }

  const duplicates = [...duplicateKeys.values()].filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0)
  const clubAliasGroups = [...teamVariants.values()].filter(set => set.size > 1).map(set => [...set])
  const healthIssues = [
    duplicates ? { code: 'duplicates', severity: 'warning', message: `${duplicates} registro(s) duplicado(s).` } : null,
    missingPosition.length ? { code: 'missing-position', severity: 'warning', message: `${missingPosition.length} atleta(s) sem posição.` } : null,
    invalidPercentages.length ? { code: 'invalid-percent', severity: 'critical', message: `${invalidPercentages.length} percentual(is) fora de 0–100.` } : null,
    invalidPer90.length ? { code: 'invalid-per90', severity: 'warning', message: `${invalidPer90.length} valor(es) por 90 incompatíveis.` } : null,
    incoherentMinutes.length ? { code: 'minutes', severity: 'warning', message: `${incoherentMinutes.length} minutagem(ns) incoerente(s).` } : null,
    clubAliasGroups.length ? { code: 'club-alias', severity: 'warning', message: `${clubAliasGroups.length} possível(is) variação(ões) de nome de clube.` } : null,
  ].filter(Boolean)

  const freshnessInfo = freshness(row.upload_at)
  if (freshnessInfo.level !== 'ok') healthIssues.unshift({ code: 'stale', severity: freshnessInfo.level, message: `${freshnessInfo.label}${freshnessInfo.days !== null ? ` há ${freshnessInfo.days} dias` : ''}.` })

  return {
    slug: row.slug,
    name: getLeague(row.slug)?.nome || row.slug,
    source,
    sourceAvailability: row.sourceAvailability || { [source]: true },
    players: players.length,
    eligible,
    minimum,
    teams: teams.size,
    uploadedAt: row.upload_at,
    freshness: freshnessInfo,
    healthIssues,
    validation: {
      duplicates,
      missingPosition: missingPosition.length,
      invalidPercentages: invalidPercentages.length,
      invalidPer90: invalidPer90.length,
      incoherentMinutes: incoherentMinutes.length,
      clubAliases: clubAliasGroups,
    },
    data: players,
  }
}

function contextualizeLeague(league) {
  const policy = getClubLeagueMarketPolicy(league.slug)
  const data = (league.data || []).map(player => {
    const contextualPlayer = { ...player, _liga: league.slug, _source: league.source }
    return {
      ...contextualPlayer,
      _market: evaluateClubMarketContext(contextualPlayer, league.slug),
    }
  })
  const summary = summarizeClubMarket(data)
  return {
    ...league,
    market: {
      band: policy.band,
      label: policy.label,
      score: policy.score,
      horizon: policy.horizon,
      reason: policy.reason,
      actionablePlayers: summary.actionable,
      immediatePlayers: summary.immediate,
      developmentPlayers: summary.development,
      referencePlayers: summary.reference,
    },
    data,
  }
}

function focusScore(player, focus) {
  if (!focus) return 50
  const group = positionGroup(player.posicao)
  const requested = text(focus.pos_grupo || focus.posicao)
  const posMatch = !requested || requested === group || normalize(requested) === normalize(player.posicao)
  const age = num(player.idade, 99)
  const ageMatch = age >= num(focus.idade_min, 15) && age <= num(focus.idade_max, 99)
  const minuteMatch = num(player.minutos) >= num(focus.min_minutos)
  const foot = normalize(player.pe)
  const requestedFoot = normalize(focus.pe)
  const footMatch = !requestedFoot || requestedFoot === 'qualquer' || foot.includes(requestedFoot)
  const leagueMatch = !text(focus.liga) || normalize(focus.liga) === normalize(player._liga)
  const metrics = safeJson(focus.metricas_pesos, [])
  const scoutDetails = player?._scouting?.profileRanking?.flatMap(item => item.details || []) || player?._scouting?.tactical?.details || []
  const metricMap = new Map(scoutDetails.map(item => [item.key, item.percentile]))
  let metricScore = 60
  if (Array.isArray(metrics) && metrics.length) {
    let weighted = 0
    let used = 0
    for (const item of metrics) {
      const percentile = metricMap.get(item.key || item.metrica)
      if (!Number.isFinite(percentile)) continue
      const weight = num(item.peso, 1)
      weighted += percentile * weight
      used += weight
    }
    if (used) metricScore = weighted / used
  }
  return Math.round(
    (posMatch ? 35 : 0) +
    (ageMatch ? 20 : 0) +
    (minuteMatch ? 15 : 0) +
    (footMatch ? 10 : 0) +
    (leagueMatch ? 5 : 0) +
    metricScore * 0.15
  )
}

function opportunityReasons(player, focusAdherence, trendScore, market, technicalPriority) {
  const scout = player._scouting || {}
  const positives = []
  const cautions = []
  if (scout.strengths?.[0]) positives.push(`P${scout.strengths[0].percentile} em ${scout.strengths[0].label}`)
  if (scout.tacticalScore >= 85) positives.push(`Fit Confiança ${scout.tacticalScore}`)
  if (num(player.idade, 99) <= 23) positives.push('Sub-23')
  if (focusAdherence >= 80) positives.push('Aderente a foco ativo')
  if (trendScore >= 65) positives.push('Tendência positiva')
  if (market?.actionable) positives.push(`${market.label} · mercado ${market.band}`)
  if (technicalPriority >= 85 && market?.multiplier < 1) cautions.push(`Prioridade técnica ${technicalPriority}, ajustada pela viabilidade do mercado`)
  if (market?.horizon === 'development') cautions.push('Projeto de desenvolvimento; não é solução imediata para o acesso')
  if (market?.cautions?.length) cautions.push(...market.cautions)
  if (scout.confidence?.score < 65) cautions.push('Amostra ainda moderada')
  if (scout.concerns?.[0]) cautions.push(`${scout.concerns[0].label} P${scout.concerns[0].percentile}`)
  return { positives: positives.slice(0, 6), cautions: [...new Set(cautions)].slice(0, 4) }
}

function trendScore(player, previousByKey) {
  const previous = previousByKey.get(playerKey(player, player._liga))
  if (!previous) return 50
  const currentProfile = num(player._scouting?.profileScore)
  const currentFit = num(player._scouting?.tacticalScore)
  const profileDelta = currentProfile - num(previous.profileScore, currentProfile)
  const fitDelta = currentFit - num(previous.fit, currentFit)
  const minutesDelta = num(player.minutos) - num(previous.minutos)
  return clamp(50 + profileDelta * 1.7 + fitDelta * 1.2 + (minutesDelta > 0 ? Math.min(10, minutesDelta / 90) : -5))
}

function dedupeMarketPlayers(pool = []) {
  const map = new Map()
  for (const player of pool) {
    const key = `${normalize(player.nome)}|${normalize(player.equipa)}`
    if (!key || key === '|') continue
    const current = map.get(key)
    const playerContext = player._market || evaluateClubMarketContext(player, player._liga)
    const currentContext = current?._market || (current ? evaluateClubMarketContext(current, current._liga) : null)
    const playerValue = num(playerContext?.score) * 10000 + num(player.minutos) + (player._source === 'sportsbase' ? 500 : 0)
    const currentValue = current ? num(currentContext?.score) * 10000 + num(current.minutos) + (current._source === 'sportsbase' ? 500 : 0) : -1
    if (!current || playerValue > currentValue) map.set(key, player)
  }
  return [...map.values()]
}

function buildOpportunities(pool, model, focuses, previousPayload) {
  const previousByKey = new Map((previousPayload?.trackedPlayers || []).map(item => [item.key, item]))
  const deduped = dedupeMarketPlayers(pool).filter(player => player?._market?.actionable)
  const grouped = deduped.reduce((acc, player) => {
    const group = positionGroup(player.posicao)
    if (!POSITION_GROUPS.includes(group)) return acc
    if (num(player.minutos) < 270 || normalize(player.equipa).includes('confianca')) return acc
    if (!acc[group]) acc[group] = []
    acc[group].push(player)
    return acc
  }, {})
  const candidatePool = Object.values(grouped).flatMap(players =>
    players.sort((a, b) => {
      const marketDelta = num(b._market?.score) - num(a._market?.score)
      if (marketDelta) return marketDelta
      return num(b.indice, b.minutos) - num(a.indice, a.minutos)
    }).slice(0, 420)
  )
  const enriched = candidatePool.length ? enrichScoutingPool(candidatePool, model, 'auto') : []
  const opportunities = enriched.map(player => {
    const scout = player._scouting || {}
    const market = player._market || evaluateClubMarketContext(player, player._liga)
    const bestFocus = focuses
      .map(focus => ({ focus, score: focusScore(player, focus) }))
      .sort((a, b) => b.score - a.score)[0] || { focus: null, score: 50 }
    const trend = trendScore(player, previousByKey)
    const technicalPriority = Math.round(
      num(scout.tacticalScore) * 0.35 +
      num(scout.profileScore) * 0.25 +
      ageScore(player.idade) * 0.15 +
      num(scout.confidence?.score) * 0.10 +
      bestFocus.score * 0.10 +
      trend * 0.05
    )
    let score = Math.round(technicalPriority * num(market.multiplier, 0))
    if (market.horizon === 'development') score = Math.min(score, 79)
    const hasStatisticalEvidence = num(scout.profileScore) > 0 || num(scout.tacticalScore) > 0
    const reasons = opportunityReasons(player, bestFocus.score, trend, market, technicalPriority)
    return {
      key: playerKey(player, player._liga),
      nome: player.nome,
      equipe: player.equipa,
      posicao: player.posicao,
      group: positionGroup(player.posicao),
      idade: player.idade,
      pe: player.pe || null,
      liga: player._liga,
      ligaNome: getLeague(player._liga)?.nome || player._liga,
      fonte: player._source,
      minutos: player.minutos,
      profile: scout.profile,
      profileScore: scout.profileScore,
      fit: scout.tacticalScore,
      confidence: scout.confidence,
      focusAdherence: bestFocus.score,
      focus: bestFocus.focus ? { id: bestFocus.focus.id, nome: bestFocus.focus.nome } : null,
      trendScore: Math.round(trend),
      technicalPriority,
      marketScore: market.score,
      marketBand: market.band,
      marketLabel: market.label,
      marketReason: market.reason,
      marketHorizon: market.horizon,
      marketMultiplier: market.multiplier,
      opportunityScore: score,
      positives: reasons.positives,
      cautions: reasons.cautions,
      path: `/ligas-v2/${player._liga}/jogadores/${encodePlayerKey(player)}`,
      _eligible: market.actionable && hasStatisticalEvidence,
    }
  }).filter(item => item._eligible && item.opportunityScore > 0)
    .map(({ _eligible, ...item }) => item)
    .sort((a, b) => b.opportunityScore - a.opportunityScore || b.technicalPriority - a.technicalPriority)
  return { opportunities: opportunities.slice(0, 100), enriched }
}

function buildTopMetrics(pool) {
  const contexts = {
    gols_90: ['AM', 'WG', 'ST'], xg_90: ['AM', 'WG', 'ST'], assistencias_90: ['FB', 'AM', 'WG'],
    chances_criadas_90: ['FB', 'AM', 'WG'], remates_90: ['AM', 'WG', 'ST'], remates_golo_pct: ['AM', 'WG', 'ST'],
    passes_chave_90: ['DM', 'AM', 'WG'], passes_prog_90: ['CB', 'FB', 'DM', 'AM'], dribles_90: ['FB', 'AM', 'WG', 'ST'],
    duelos_def_pct: ['CB', 'FB', 'DM'], recuperacoes_90: ['CB', 'FB', 'DM', 'AM', 'WG'], perdas_bola_90: POSITION_GROUPS,
  }
  return SPORTSBASE_CORE_METRICS.map(({ key }) => {
    const def = getSportsbaseMetric(key)
    const allowed = contexts[key] || POSITION_GROUPS
    const comparison = pool.filter(player => allowed.includes(positionGroup(player.posicao)))
    const minimum = getSuggestedMinimumMinutes(comparison)
    const eligible = comparison.filter(player => getMetricEligibility(player, def, { players: comparison, selectedMinimum: minimum }).eligible)
    const values = eligible.map(player => num(player[key])).filter(Number.isFinite)
    const rows = eligible.map(player => ({
      nome: player.nome,
      equipe: player.equipa,
      posicao: player.posicao,
      liga: player._liga,
      ligaNome: getLeague(player._liga)?.nome || player._liga,
      minutos: player.minutos,
      marketBand: player._market?.band || null,
      marketLabel: player._market?.label || null,
      value: num(player[key]),
      percentile: calculateSportsbasePercentile(player[key], values, def?.higherIsBetter !== false),
      path: `/ligas-v2/${player._liga}/jogadores/${encodePlayerKey(player)}`,
    })).sort((a, b) => def?.higherIsBetter === false ? a.value - b.value : b.value - a.value).slice(0, 5)
    return { key, label: def?.label || key, type: def?.type || 'per90', higherIsBetter: def?.higherIsBetter !== false, minimum, eligible: eligible.length, rows }
  })
}

function buildNeeds(clubData, focuses, pipeline, opportunities, enrichedClubPlayers) {
  const focusNeeds = focuses.slice(0, 5).map(focus => {
    const candidates = pipeline.filter(item => num(item.foco_id) === num(focus.id)).length
    const marketMatches = opportunities.filter(item => item.focus?.id === focus.id && item.focusAdherence >= 70).length
    return {
      id: `focus-${focus.id}`,
      source: 'focus',
      focusId: focus.id,
      title: focus.nome,
      group: focus.pos_grupo || focus.posicao || 'Mercado',
      reason: focus.descricao || `${focus.tipo_necessidade || 'Necessidade'} · ${focus.prioridade || 'Média'}`,
      priority: focus.prioridade || 'Média',
      candidates,
      marketMatches,
      href: '/centro-recrutamento',
    }
  })
  const counts = (clubData.players || []).reduce((acc, player) => {
    const group = positionGroup(player.posicao)
    if (group) acc[group] = (acc[group] || 0) + 1
    return acc
  }, {})
  const modelNeeds = [...(clubData.model?.needs || clubData.summary?.model?.needs || [])]
    .sort((a, b) => a.score - b.score)
    .map(item => {
      const mapped = NEED_MAP[item.key] || { title: item.label, group: 'Mercado', reason: 'Dimensão abaixo das demais no modelo atual.' }
      const matches = opportunities.filter(op => op.group === mapped.group && op.opportunityScore >= 70).length
      return {
        id: `model-${item.key}`,
        source: 'model',
        dimension: item.key,
        title: mapped.title,
        group: mapped.group,
        reason: mapped.reason,
        score: item.score,
        priority: item.score < 42 ? 'Alta' : 'Média',
        candidates: matches,
        marketMatches: matches,
        suggestedFocus: {
          nome: mapped.title,
          descricao: `${mapped.reason} Necessidade sugerida automaticamente a partir das planilhas Sportsbase do Confiança.`,
          tipo_necessidade: 'Lacuna detectada por dados',
          prioridade: item.score < 42 ? 'Alta' : 'Média',
          pos_grupo: mapped.group,
          min_minutos: 450,
          idade_min: 17,
          idade_max: 28,
          criado_por: 'automacao-cig',
        },
        href: '/recomendacoes',
      }
    })
  const depthNeeds = POSITION_GROUPS.filter(group => num(counts[group]) < 2).map(group => ({
    id: `depth-${group}`,
    source: 'depth',
    title: `Profundidade em ${GROUP_LABELS[group]}`,
    group,
    reason: `O elenco possui somente ${num(counts[group])} atleta(s) no grupo funcional.`,
    priority: num(counts[group]) === 0 ? 'Alta' : 'Média',
    candidates: opportunities.filter(item => item.group === group && item.opportunityScore >= 70).length,
    suggestedFocus: {
      nome: `Profundidade · ${GROUP_LABELS[group]}`,
      descricao: `Aumentar profundidade funcional do elenco no grupo ${GROUP_LABELS[group]}.`,
      tipo_necessidade: 'Profundidade do elenco',
      prioridade: num(counts[group]) === 0 ? 'Alta' : 'Média',
      pos_grupo: group,
      min_minutos: 450,
      idade_min: 17,
      idade_max: 29,
      criado_por: 'automacao-cig',
    },
    href: '/recomendacoes',
  }))
  const dependencyNeeds = []
  for (const group of POSITION_GROUPS) {
    const list = enrichedClubPlayers.filter(player => positionGroup(player.posicao) === group)
    const totalMinutes = list.reduce((sum, player) => sum + num(player.minutos), 0)
    const top = [...list].sort((a, b) => num(b.minutos) - num(a.minutos))[0]
    const share = totalMinutes && top ? num(top.minutos) / totalMinutes : 0
    if (share >= 0.48 && list.length >= 2) dependencyNeeds.push({
      id: `dependency-${group}`,
      source: 'dependency',
      title: `Dependência em ${GROUP_LABELS[group]}`,
      group,
      reason: `${top.nome} concentra ${Math.round(share * 100)}% dos minutos do grupo funcional.`,
      priority: share >= 0.60 ? 'Alta' : 'Média',
      candidates: opportunities.filter(item => item.group === group && item.opportunityScore >= 70).length,
      href: '/elenco',
    })
  }
  return [...focusNeeds, ...depthNeeds, ...modelNeeds, ...dependencyNeeds]
    .sort((a, b) => ({ Alta: 0, Média: 1, Baixa: 2 }[a.priority] ?? 3) - ({ Alta: 0, Média: 1, Baixa: 2 }[b.priority] ?? 3))
    .slice(0, 10)
}

function buildTimeline(clubData, session) {
  const history = Array.isArray(session?.historico) ? session.historico : []
  return (clubData.games || []).map(game => {
    const saved = history.find(item => num(item.rodada) === num(game.rodada)) || {}
    return {
      rodada: game.rodada,
      data: game.data,
      adversario: game.adversario,
      resultado: game.resultado,
      golsPro: game.golsPro,
      golsContra: game.golsContra,
      pontos: game.pontos,
      sistema: game.tatica || game.sistema || game['Tática (inicial)'] || null,
      posicao: saved.posicao || game.posicao_tabela || null,
      observacao: saved.obs || null,
      positionStatus: saved.posicao ? 'confirmada' : game.posicao_tabela ? 'fonte' : 'pendente',
    }
  })
}

function buildExecutiveSummary(clubData, opportunities, needs, alerts, marketContext) {
  const model = clubData.model || clubData.summary?.model || {}
  const positive = (model.keyTrends || []).filter(item => num(item.delta) > 0).sort((a, b) => b.delta - a.delta)[0]
  const negative = (model.keyTrends || []).filter(item => num(item.delta) < 0).sort((a, b) => a.delta - b.delta)[0]
  const topOpportunity = opportunities[0]
  const highFit = opportunities.filter(item => item.fit >= 80).length
  const activeNeed = needs.find(item => item.priority === 'Alta') || needs[0]
  const market = marketContext?.summary || {}
  const sentences = []
  if (clubData.summary?.games) sentences.push(`O Confiança soma ${clubData.summary.points || 0} pontos em ${clubData.summary.games} partidas, com ${round(clubData.summary.performance, 1)}% de aproveitamento, em um planejamento orientado ao acesso à Série C.`)
  if (market.actionable || market.reference) sentences.push(`A triagem contextual considera ${market.immediate || 0} atleta(s) de mercado imediato e mantém ${market.reference || 0} somente como referência, sem misturar acessibilidade com desempenho.`)
  if (positive) sentences.push(`A principal evolução recente está em ${positive.label.toLowerCase()} (${positive.delta > 0 ? '+' : ''}${round(positive.delta, 1)} frente ao bloco anterior).`)
  if (negative) sentences.push(`O principal sinal de atenção está em ${negative.label.toLowerCase()} (${round(negative.delta, 1)} no comparativo recente).`)
  if (activeNeed) sentences.push(`A necessidade prioritária identificada é ${activeNeed.title.toLowerCase()}, com ${activeNeed.candidates || 0} candidato(s) de mercado contextual já compatíveis.`)
  if (topOpportunity) sentences.push(`Entre as opções viáveis, ${topOpportunity.nome}, do ${topOpportunity.equipe}, lidera a triagem com prioridade ${topOpportunity.opportunityScore}, após ajuste do score técnico ${topOpportunity.technicalPriority} pela realidade do mercado ${topOpportunity.marketLabel.toLowerCase()}.`)
  if (highFit) sentences.push(`${highFit} atleta(s) do universo acionável têm Fit Confiança igual ou superior a 80.`)
  if (alerts.filter(item => item.severity === 'critical').length) sentences.push(`Há ${alerts.filter(item => item.severity === 'critical').length} alerta(s) crítico(s) que exigem ação operacional.`)
  return sentences.join(' ')
}

function alertFingerprint(alert) { return normalize(`${alert.category}|${alert.title}|${alert.entityKey || alert.href || alert.message}`) }
function makeAlert(category, severity, title, message, href, entityKey = null, payload = {}) {
  return { category, severity, title, message, href, entityKey, payload, fingerprint: alertFingerprint({ category, title, message, href, entityKey }) }
}

function buildAlerts({ coverage, clubData, focuses, pipeline, monitoring, finalRows, preferred, observations, opportunities, previousPayload, marketPool }) {
  const alerts = []
  for (const league of coverage) {
    const operationalLeague = league.market?.band !== 'R'
    for (const issue of league.healthIssues) {
      if (!operationalLeague && (issue.code === 'stale' || issue.severity !== 'critical')) continue
      const severity = operationalLeague ? issue.severity : 'warning'
      alerts.push(makeAlert('DADOS', severity, league.name, issue.message, `/ligas-v2/${league.slug}`, league.slug, { ...issue, marketBand: league.market?.band }))
    }
  }
  if (!clubData.uploads?.team || !clubData.uploads?.players) alerts.push(makeAlert('CONFIANÇA', 'warning', 'Base do Confiança incompleta', 'A planilha coletiva ou individual Sportsbase ainda não foi carregada.', '/elenco', 'club-upload'))
  for (const focus of focuses) {
    const candidates = pipeline.filter(item => num(item.foco_id) === num(focus.id))
    if (candidates.length < 5) alerts.push(makeAlert('PROCESSO', focus.prioridade === 'Alta' ? 'critical' : 'warning', focus.nome, `O foco possui somente ${candidates.length} candidato(s); mínimo operacional recomendado: 5.`, '/centro-recrutamento', `focus-${focus.id}`))
  }
  for (const candidate of pipeline) {
    const stale = daysSince(candidate.updated_at)
    if (stale !== null && stale > 14) alerts.push(makeAlert('FUNIL', stale > 30 ? 'critical' : 'warning', candidate.jogador, `${candidate.etapa || 'Etapa'} sem atualização há ${stale} dias.`, '/centro-recrutamento', `pipeline-${candidate.id}`))
    if (['Observação ao vivo', 'Pré-lista', 'Alvo prioritário'].includes(candidate.etapa) && !text(candidate.notas || candidate.observacoes || candidate.pontos_fortes)) {
      alerts.push(makeAlert('SCOUTING', 'warning', candidate.jogador, `Está em ${candidate.etapa}, mas ainda sem registro qualitativo consolidado.`, '/centro-recrutamento', `qualitative-${candidate.id}`))
    }
    const candidateMarket = evaluateClubMarketContext({
      nome: candidate.jogador, equipa: candidate.clube, idade: candidate.idade, minutos: candidate.minutos,
      fim_contrato: candidate.data_fim_contrato, emprestado: candidate.emprestado,
    }, candidate.liga)
    if (!candidateMarket.actionable) {
      alerts.push(makeAlert('VIABILIDADE', 'warning', candidate.jogador, `${candidateMarket.label}: ${candidateMarket.reason}${candidateMarket.cautions?.length ? ` ${candidateMarket.cautions.join(' ')}` : ''}`, '/centro-recrutamento', `market-${candidate.id}`, candidateMarket))
    } else if (candidate.etapa === 'Identificados' && num(candidate.fit_score) >= 80) {
      alerts.push(makeAlert('SUGESTÃO', 'ok', candidate.jogador, `Fit ${candidate.fit_score} e mercado ${candidateMarket.band} (${candidateMarket.label}): revisar para possível avanço à análise em vídeo.`, '/centro-recrutamento', `advance-${candidate.id}`, candidateMarket))
    }
    if (num(candidate.fit_score) > 0 && num(candidate.fit_score) < 55 && stale > 30) alerts.push(makeAlert('SUGESTÃO', 'warning', candidate.jogador, `Fit ${candidate.fit_score} e ${stale} dias sem evolução: revisar permanência no foco.`, '/centro-recrutamento', `archive-${candidate.id}`))
  }
  const pendingObservations = observations.filter(item => normalize(item.status) === 'pendente')
  if (monitoring.length && !pendingObservations.length) alerts.push(makeAlert('SCOUTING', 'warning', 'Observação sem fila', `${monitoring.length} atleta(s) monitorado(s) e nenhuma observação pendente.`, '/observacao', 'observations-empty'))
  for (const player of monitoring) {
    const days = expiryDays(player.data_contrato_fim)
    if (days !== null && days >= 0 && days <= 180) alerts.push(makeAlert('MERCADO', days <= 90 ? 'critical' : 'warning', player.nome, `Contrato termina em ${days} dia(s).`, '/monitoramento', `contract-${player.id}`))
    const stale = daysSince(player.updated_at)
    if (stale !== null && stale > 21) alerts.push(makeAlert('WATCHLIST', 'warning', player.nome, `Monitoramento sem atualização há ${stale} dias.`, '/monitoramento', `monitor-${player.id}`))
  }

  const previousTracked = new Map((previousPayload?.trackedPlayers || []).map(item => [item.key, item]))
  const previousByName = new Map((previousPayload?.trackedPlayers || []).map(item => [normalize(item.nome), item]))
  const currentCoverageBySlug = new Map((coverage || []).map(item => [item.slug, item]))
  const previousCoverageBySlug = new Map((previousPayload?.coverage || []).map(item => [item.slug, item]))
  const marketByName = new Map()
  for (const player of marketPool || []) {
    const key = normalize(player.nome)
    const current = marketByName.get(key)
    if (key && (!current || num(player.minutos) > num(current.minutos))) marketByName.set(key, player)
  }
  for (const monitored of monitoring) {
    const current = marketByName.get(normalize(monitored.nome))
    const previous = previousByName.get(normalize(monitored.nome))
    if (!current) {
      alerts.push(makeAlert('WATCHLIST', 'warning', monitored.nome, 'Não foi encontrado no último conjunto de dados das ligas monitoradas.', '/monitoramento', `missing-${monitored.id}`))
      continue
    }
    if (previous && normalize(previous.equipe) !== normalize(current.equipa)) {
      alerts.push(makeAlert('MUDANÇA', 'warning', monitored.nome, `Mudança de clube detectada: ${previous.equipe || '—'} → ${current.equipa || '—'}.`, '/monitoramento', `club-change-${monitored.id}`))
    }
    if (previous && normalize(previous.posicao) !== normalize(current.posicao)) {
      alerts.push(makeAlert('MUDANÇA', 'ok', monitored.nome, `Mudança de posição detectada: ${previous.posicao || '—'} → ${current.posicao || '—'}.`, '/monitoramento', `position-change-${monitored.id}`))
    }
    const currentCoverage = currentCoverageBySlug.get(current._liga)
    const previousCoverage = previousCoverageBySlug.get(current._liga)
    const sourceUpdated = currentCoverage?.uploadedAt && previousCoverage?.uploadedAt && String(currentCoverage.uploadedAt) !== String(previousCoverage.uploadedAt)
    if (previous && sourceUpdated && num(current.minutos) <= num(previous.minutos)) {
      alerts.push(makeAlert('MINUTOS', 'warning', monitored.nome, 'A liga foi atualizada, mas a minutagem do atleta não cresceu.', '/monitoramento', `minutes-flat-${monitored.id}`))
    }
  }
  for (const item of opportunities.slice(0, 50)) {
    const previous = previousTracked.get(item.key)
    if (!previous && item.opportunityScore >= 80) alerts.push(makeAlert('OPORTUNIDADE', 'ok', item.nome, `Novo destaque viável: prioridade ${item.opportunityScore}, Fit ${item.fit}, perfil ${item.profile} e mercado ${item.marketBand} (${item.marketLabel}).`, item.path, item.key, { marketBand: item.marketBand, marketLabel: item.marketLabel }))
    if (previous) {
      if (item.profileScore >= 90 && num(previous.profileScore) < 90) alerts.push(makeAlert('CRESCIMENTO', 'ok', item.nome, `Entrou no P90 do perfil ${item.profile}.`, item.path, `${item.key}-p90`))
      if (item.profileScore < 90 && num(previous.profileScore) >= 90) alerts.push(makeAlert('QUEDA', 'warning', item.nome, `Saiu do P90 do perfil ${item.profile}.`, item.path, `${item.key}-p90-out`))
      if (num(item.minutos) >= 500 && num(previous.minutos) < 500) alerts.push(makeAlert('AMOSTRA', 'ok', item.nome, 'Atingiu 500 minutos e passou a ter amostra elegível para os rankings centrais.', item.path, `${item.key}-500`))
      if (item.focusAdherence >= 70 && num(previous.focusAdherence) < 70) alerts.push(makeAlert('FOCO', 'ok', item.nome, `Passou a atender o foco ${item.focus?.nome || 'ativo'} com aderência ${item.focusAdherence}.`, item.path, `${item.key}-focus`))
      if (num(item.confidence?.score) + 12 < num(previous.confidenceScore, item.confidence?.score)) alerts.push(makeAlert('AMOSTRA', 'warning', item.nome, 'A qualidade relativa da amostra caiu desde o último processamento.', item.path, `${item.key}-sample-drop`))
      const delta = item.profileScore - num(previous.profileScore, item.profileScore)
      if (Math.abs(delta) >= 10) alerts.push(makeAlert(delta > 0 ? 'CRESCIMENTO' : 'QUEDA', delta > 0 ? 'ok' : 'warning', item.nome, `${delta > 0 ? 'Subiu' : 'Caiu'} ${Math.abs(Math.round(delta))} pontos no perfil desde o último processamento.`, item.path, `${item.key}-delta`))
    }
  }
  if (preferred.length && finalRows.length === 0) alerts.push(makeAlert('PROCESSO', 'warning', 'Lista preferencial sem decisão', `${preferred.length} atleta(s) preferencial(is) e nenhum registro na Lista Final.`, '/lista-final', 'preferred-final-gap'))
  return alerts
}

function buildActions({ coverage, focuses, pipeline, monitoring, finalRows, observations, alerts }) {
  const stalePipeline = pipeline.filter(item => (daysSince(item.updated_at) || 0) > 14).length
  const missingQualitative = pipeline.filter(item => ['Observação ao vivo', 'Pré-lista', 'Alvo prioritário'].includes(item.etapa) && !text(item.notas || item.observacoes || item.pontos_fortes)).length
  const shortFoci = focuses.filter(focus => pipeline.filter(item => num(item.foco_id) === num(focus.id)).length < 5).length
  const expiring = monitoring.filter(item => { const d = expiryDays(item.data_contrato_fim); return d !== null && d >= 0 && d <= 180 }).length
  const viabilityReview = pipeline.filter(item => !evaluateClubMarketContext({
    nome: item.jogador, equipa: item.clube, idade: item.idade, minutos: item.minutos,
    fim_contrato: item.data_fim_contrato, emprestado: item.emprestado,
  }, item.liga).actionable).length
  return [
    { label: 'Candidatos aguardando vídeo', value: pipeline.filter(item => ['Identificados', 'Análise em vídeo'].includes(item.etapa)).length, href: '/centro-recrutamento', priority: 'normal' },
    { label: 'Registros qualitativos pendentes', value: missingQualitative, href: '/centro-recrutamento', priority: missingQualitative ? 'high' : 'normal' },
    { label: 'Jogadores parados no funil', value: stalePipeline, href: '/centro-recrutamento', priority: stalePipeline ? 'high' : 'normal' },
    { label: 'Observações pendentes', value: observations.filter(item => normalize(item.status) === 'pendente').length, href: '/observacao', priority: 'normal' },
    { label: 'Focos com shortlist curta', value: shortFoci, href: '/centro-recrutamento', priority: shortFoci ? 'high' : 'normal' },
    { label: 'Candidatos para revisar viabilidade', value: viabilityReview, href: '/centro-recrutamento', priority: viabilityReview ? 'high' : 'normal' },
    { label: 'Ligas acionáveis pedindo atualização', value: coverage.filter(item => item.market?.band !== 'R' && item.freshness.level !== 'ok').length, href: '/ligas-v2', priority: 'normal' },
    { label: 'Contratos até 6 meses', value: expiring, href: '/monitoramento', priority: expiring ? 'high' : 'normal' },
    { label: 'Atletas em decisão final', value: finalRows.length, href: '/lista-final', priority: 'normal' },
    { label: 'Alertas críticos', value: alerts.filter(item => item.severity === 'critical').length, href: '/', priority: 'high' },
  ]
}

function buildFunnel(pipeline) {
  return STAGES.map(stage => {
    const items = pipeline.filter(item => item.etapa === stage)
    const stale = items.filter(item => (daysSince(item.updated_at) || 0) > 14).length
    const missingQualitative = items.filter(item => ['Observação ao vivo', 'Pré-lista', 'Alvo prioritário'].includes(stage) && !text(item.notas || item.observacoes || item.pontos_fortes)).length
    return { stage, total: items.length, stale, missingQualitative }
  })
}

function healthSummary(coverage, clubData) {
  const operationalCoverage = coverage.filter(item => item.market?.band !== 'R')
  const referenceCoverage = coverage.filter(item => item.market?.band === 'R')
  const issues = operationalCoverage.flatMap(item => item.healthIssues.map(issue => ({ ...issue, league: item.name, slug: item.slug, marketBand: item.market?.band })))
  const referenceCritical = referenceCoverage.flatMap(item => item.healthIssues
    .filter(issue => issue.severity === 'critical' && issue.code !== 'stale')
    .map(issue => ({ ...issue, severity: 'warning', league: item.name, slug: item.slug, marketBand: 'R' })))
  issues.push(...referenceCritical)
  if (!clubData.uploads?.team) issues.push({ code: 'club-team', severity: 'warning', league: 'Confiança', message: 'Planilha coletiva ausente.' })
  if (!clubData.uploads?.players) issues.push({ code: 'club-players', severity: 'warning', league: 'Confiança', message: 'Planilha individual ausente.' })
  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === 'critical' ? 12 : issue.severity === 'warning' ? 5 : 1), 0)
  const score = clamp(100 - penalty)
  return {
    score,
    status: score >= 85 ? 'Saudável' : score >= 65 ? 'Atenção' : 'Crítico',
    issues,
    updated: operationalCoverage.filter(item => item.freshness.level === 'ok').length,
    warning: operationalCoverage.filter(item => item.freshness.level === 'warning').length,
    stale: operationalCoverage.filter(item => item.freshness.level === 'critical').length,
    referenceStale: referenceCoverage.filter(item => item.freshness.level !== 'ok').length,
    operationalLeagues: operationalCoverage.length,
  }
}

function trackedPlayers(opportunities, monitoring, allPool) {
  const byName = new Map()
  for (const player of allPool) {
    const key = nameKey(player)
    if (!key) continue
    const current = byName.get(key)
    if (!current || num(player.minutos) > num(current.minutos)) byName.set(key, player)
  }
  const tracked = opportunities.slice(0, 100).map(item => ({
    key: item.key, nome: item.nome, equipe: item.equipe, liga: item.liga, posicao: item.posicao,
    minutos: item.minutos, profileScore: item.profileScore, fit: item.fit, opportunityScore: item.opportunityScore,
    technicalPriority: item.technicalPriority, marketBand: item.marketBand, marketLabel: item.marketLabel,
    focusAdherence: item.focusAdherence, confidenceScore: item.confidence?.score || 0,
  }))
  for (const monitored of monitoring) {
    const match = byName.get(nameKey(monitored))
    const key = match ? playerKey(match, match._liga) : `monitor|${nameKey(monitored)}`
    if (tracked.some(item => item.key === key)) continue
    tracked.push({
      key, nome: monitored.nome, equipe: match?.equipa || monitored.time_atual, liga: match?._liga || monitored.liga,
      posicao: match?.posicao || monitored.posicao, minutos: match?.minutos || 0,
      profileScore: match?._scouting?.profileScore || 0, fit: match?._scouting?.tacticalScore || 0,
      monitoringId: monitored.id,
    })
  }
  return tracked
}

async function persistAlerts(alerts) {
  const active = new Set(alerts.map(item => item.fingerprint))
  for (const alert of alerts) {
    await sql`
      INSERT INTO cig_automation_alerts (
        fingerprint, category, severity, title, message, href, entity_key, payload, status, last_seen_at
      ) VALUES (
        ${alert.fingerprint}, ${alert.category}, ${alert.severity}, ${alert.title}, ${alert.message},
        ${alert.href || null}, ${alert.entityKey || null}, ${JSON.stringify(alert.payload || {})}::jsonb,
        'active', NOW()
      ) ON CONFLICT (fingerprint) DO UPDATE SET
        severity = EXCLUDED.severity,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        href = EXCLUDED.href,
        entity_key = EXCLUDED.entity_key,
        payload = EXCLUDED.payload,
        status = 'active',
        last_seen_at = NOW(),
        resolved_at = NULL
    `
  }
  const existing = await safeRows(() => sql`SELECT fingerprint FROM cig_automation_alerts WHERE status = 'active'`)
  for (const row of existing) {
    if (!active.has(row.fingerprint)) await sql`UPDATE cig_automation_alerts SET status = 'resolved', resolved_at = NOW() WHERE fingerprint = ${row.fingerprint}`
  }
}

async function loadOperationalData() {
  const [uploads, clubData, focuses, pipeline, monitoring, finalRows, preferred, observations, sessionRows, importLogs] = await Promise.all([
    latestUploads(),
    getClubSportsbase().catch(() => ({ games: [], players: [], summary: {}, model: null, uploads: {} })),
    safeRows(() => sql`SELECT * FROM focos_recrutamento WHERE status <> 'Encerrado' ORDER BY CASE prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END, updated_at DESC`),
    safeRows(() => sql`SELECT * FROM candidatos_pipeline ORDER BY updated_at DESC`),
    safeRows(() => sql`SELECT * FROM atletas_monitoramento ORDER BY updated_at DESC`),
    safeRows(() => sql`SELECT * FROM lista_final ORDER BY created_at DESC`),
    safeRows(() => sql`SELECT * FROM lista_preferencial ORDER BY created_at DESC`),
    safeRows(() => sql`SELECT * FROM observacao_partidas ORDER BY updated_at DESC`),
    safeRows(() => sql`
      SELECT payload
      FROM elenco_session
      WHERE session_key = 'confianca_elenco_2026'
      LIMIT 1
    `),
    safeRows(() => sql`SELECT * FROM cig_import_logs ORDER BY created_at DESC LIMIT 12`),
  ])
  const session = sessionRows[0]?.payload ? safeJson(sessionRows[0].payload, {}) : {}
  return { uploads, clubData, focuses, pipeline, monitoring, finalRows, preferred, observations, session, importLogs }
}

function buildReportPayload(payload) {
  const periodKey = new Date().toISOString().slice(0, 10)
  return {
    periodKey,
    title: `Pacote semanal CIC · ${new Date().toLocaleDateString('pt-BR')}`,
    generatedAt: payload.generatedAt,
    executiveSummary: payload.executiveSummary,
    kpis: payload.kpis,
    health: payload.health,
    marketContext: payload.marketContext,
    opportunities: payload.opportunities.slice(0, 20),
    topMetrics: payload.topMetrics,
    needs: payload.needs,
    alerts: payload.alerts.slice(0, 30),
    funnel: payload.funnel,
    actions: payload.actions,
    coverage: payload.coverage,
    club: payload.club || null,
  }
}

export async function runScoutingAutomation(options = {}) {
  await ensureAutomationTables()
  const triggerType = options.trigger || 'manual'
  const triggerRef = options.triggerRef || null
  const runRow = await sql`
    INSERT INTO cig_automation_runs (trigger_type, trigger_ref, status)
    VALUES (${triggerType}, ${triggerRef}, 'running')
    RETURNING id, started_at
  `
  const runId = runRow.rows[0].id
  try {
    const previous = await latestSnapshot()
    const operational = await loadOperationalData()
    const bandOrder = { A: 0, B: 1, C: 2, E: 3, P: 4, R: 5 }
    const coverage = operational.uploads.map(validateLeague).map(contextualizeLeague).sort((a, b) => (bandOrder[a.market?.band] ?? 9) - (bandOrder[b.market?.band] ?? 9) || b.players - a.players)
    const marketPool = coverage.flatMap(league => league.data)
    const marketSummary = summarizeClubMarket(marketPool)
    const actionablePool = marketPool.filter(player => player?._market?.actionable)
    const immediatePool = actionablePool.filter(player => player?._market?.horizon !== 'development')
    const model = operational.clubData.model || operational.clubData.summary?.model || null
    const { opportunities, enriched } = buildOpportunities(actionablePool, model, operational.focuses, previous?.payload)
    const clubPlayers = operational.clubData.players || []
    const enrichedClubPlayers = clubPlayers.length
      ? enrichScoutingPool(clubPlayers, model, Math.max(270, getSuggestedMinimumMinutes(clubPlayers)))
      : []
    const needs = buildNeeds(operational.clubData, operational.focuses, operational.pipeline, opportunities, enrichedClubPlayers)
    const severityOrder = { critical: 0, warning: 1, ok: 2 }
    const alerts = buildAlerts({
      coverage, clubData: operational.clubData, focuses: operational.focuses, pipeline: operational.pipeline,
      monitoring: operational.monitoring, finalRows: operational.finalRows, preferred: operational.preferred,
      observations: operational.observations, opportunities, previousPayload: previous?.payload, marketPool,
    }).sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
      .slice(0, 80)
    const health = healthSummary(coverage, operational.clubData)
    const funnel = buildFunnel(operational.pipeline)
    const actions = buildActions({
      coverage, focuses: operational.focuses, pipeline: operational.pipeline, monitoring: operational.monitoring,
      finalRows: operational.finalRows, observations: operational.observations, alerts,
    })
    const timeline = buildTimeline(operational.clubData, operational.session)
    const topMetrics = buildTopMetrics(immediatePool)
    const payload = {
      generatedAt: nowIso(),
      run: { id: runId, trigger: triggerType, triggerRef, status: 'success' },
      kpis: {
        leagues: coverage.length,
        players: coverage.reduce((sum, item) => sum + item.players, 0),
        eligible: coverage.reduce((sum, item) => sum + item.eligible, 0),
        actionablePlayers: marketSummary.actionable,
        immediatePlayers: marketSummary.immediate,
        developmentPlayers: marketSummary.development,
        referencePlayers: marketSummary.reference,
        actionableLeagues: coverage.filter(item => num(item.market?.actionablePlayers) > 0).length,
        activeFoci: operational.focuses.length,
        pipeline: operational.pipeline.length,
        monitoring: operational.monitoring.length,
        preferred: operational.preferred.length,
        final: operational.finalRows.length,
        observations: operational.observations.length,
        opportunities: opportunities.filter(item => item.opportunityScore >= 75).length,
        u23Opportunities: opportunities.filter(item => num(item.idade, 99) <= 23 && item.opportunityScore >= 70).length,
        highFit: opportunities.filter(item => item.fit >= 80).length,
        staleLeagues: coverage.filter(item => item.market?.band !== 'R' && item.freshness.level !== 'ok').length,
      },
      health,
      marketContext: { ...marketContextForDashboard(), summary: marketSummary },
      coverage: coverage.map(({ data, ...item }) => item),
      opportunities,
      needs,
      funnel,
      alerts,
      actions,
      topMetrics,
      club: {
        summary: operational.clubData.summary || {},
        model,
        uploads: operational.clubData.uploads || {},
        timeline,
        depth: operational.clubData.summary?.groups || {},
      },
      executiveSummary: '',
      importLogs: operational.importLogs,
      trackedPlayers: trackedPlayers(opportunities, operational.monitoring, [...marketPool, ...enriched]),
      workflow: {
        suggestions: {
          advance: alerts.filter(item => item.category === 'SUGESTÃO' && item.message.includes('avanço')).length,
          archive: alerts.filter(item => item.category === 'SUGESTÃO' && item.message.includes('permanência')).length,
          missingQualitative: alerts.filter(item => item.category === 'SCOUTING' && item.message.includes('qualitativo')).length,
        },
      },
    }
    payload.executiveSummary = buildExecutiveSummary(operational.clubData, opportunities, needs, alerts, payload.marketContext)
    await persistAlerts(alerts)
    const periodKey = new Date().toISOString().slice(0, 10)
    const snapshotRow = await sql`
      INSERT INTO cig_automation_snapshots (run_id, period_key, payload)
      VALUES (${runId}, ${periodKey}, ${JSON.stringify(payload)}::jsonb)
      RETURNING id, created_at
    `
    const reportPayload = buildReportPayload(payload)
    await sql`
      INSERT INTO cig_automation_reports (period_key, payload, generated_at, updated_at)
      VALUES (${periodKey}, ${JSON.stringify(reportPayload)}::jsonb, NOW(), NOW())
      ON CONFLICT (period_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `
    const summary = {
      leagues: payload.kpis.leagues,
      players: payload.kpis.players,
      eligible: payload.kpis.eligible,
      actionablePlayers: payload.kpis.actionablePlayers,
      immediatePlayers: payload.kpis.immediatePlayers,
      opportunities: payload.kpis.opportunities,
      alerts: alerts.length,
      criticalAlerts: alerts.filter(item => item.severity === 'critical').length,
      healthScore: health.score,
    }
    await sql`
      UPDATE cig_automation_runs
      SET status = 'success', summary = ${JSON.stringify(summary)}::jsonb, finished_at = NOW()
      WHERE id = ${runId}
    `
    return { ...payload, snapshotId: snapshotRow.rows[0].id, reportPeriod: periodKey }
  } catch (error) {
    await sql`
      UPDATE cig_automation_runs
      SET status = 'error', error = ${error.message}, finished_at = NOW()
      WHERE id = ${runId}
    `.catch(() => {})
    throw error
  }
}

export async function getAutomationDashboard({ refreshIfMissing = true, maxAgeMinutes = 180 } = {}) {
  const snapshot = await latestSnapshot()
  if (!snapshot && refreshIfMissing) return runScoutingAutomation({ trigger: 'dashboard-bootstrap' })
  if (!snapshot) return null
  const ageMinutes = Math.max(0, (Date.now() - new Date(snapshot.created_at).getTime()) / 60000)
  const currentPolicy = marketContextForDashboard().policyVersion
  if (refreshIfMissing && snapshot.payload?.marketContext?.policyVersion !== currentPolicy) {
    return runScoutingAutomation({ trigger: 'market-policy-update', triggerRef: currentPolicy })
  }
  if (refreshIfMissing && ageMinutes > maxAgeMinutes) return runScoutingAutomation({ trigger: 'dashboard-stale' })
  return { ...snapshot.payload, club: snapshot.payload?.club || null, snapshotId: snapshot.id, snapshotCreatedAt: snapshot.created_at }
}

export async function getLatestReportPayload() {
  await ensureAutomationTables()
  const result = await sql`
    SELECT period_key, payload, generated_at, updated_at
    FROM cig_automation_reports
    ORDER BY updated_at DESC
    LIMIT 1
  `
  if (!result.rows.length) {
    const payload = await runScoutingAutomation({ trigger: 'report-bootstrap' })
    return buildReportPayload(payload)
  }
  const saved = safeJson(result.rows[0].payload, {})
  if (saved?.marketContext?.policyVersion !== marketContextForDashboard().policyVersion) {
    const payload = await runScoutingAutomation({ trigger: 'report-policy-update', triggerRef: marketContextForDashboard().policyVersion })
    return buildReportPayload(payload)
  }
  return { ...saved, periodKey: result.rows[0].period_key }
}

export async function approveSuggestedFocus(suggested = {}) {
  if (!suggested.nome) throw new Error('Sugestão sem nome de foco.')
  await sql`
    CREATE TABLE IF NOT EXISTS focos_recrutamento (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      tipo_necessidade TEXT DEFAULT 'Carência do elenco',
      janela TEXT DEFAULT 'Próxima janela',
      prioridade TEXT DEFAULT 'Média',
      status TEXT DEFAULT 'Ativo',
      papel TEXT,
      posicao TEXT,
      posicao_secundaria TEXT,
      pos_grupo TEXT,
      pe TEXT DEFAULT '',
      idade_min INTEGER DEFAULT 15,
      idade_max INTEGER DEFAULT 32,
      min_minutos INTEGER DEFAULT 0,
      liga TEXT DEFAULT '',
      metricas_pesos JSONB DEFAULT '[]'::jsonb,
      criterios_obrigatorios JSONB DEFAULT '[]'::jsonb,
      criterios_desejaveis JSONB DEFAULT '[]'::jsonb,
      criterios_exclusao JSONB DEFAULT '[]'::jsonb,
      config_observacao JSONB DEFAULT '{}'::jsonb,
      criado_por TEXT DEFAULT 'sistema',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  const row = await sql`
    INSERT INTO focos_recrutamento (
      nome, descricao, tipo_necessidade, janela, prioridade, status,
      pos_grupo, idade_min, idade_max, min_minutos, criado_por, created_at, updated_at
    ) VALUES (
      ${suggested.nome}, ${suggested.descricao || null}, ${suggested.tipo_necessidade || 'Lacuna detectada por dados'},
      ${suggested.janela || 'Próxima janela'}, ${suggested.prioridade || 'Média'}, 'Ativo',
      ${suggested.pos_grupo || null}, ${num(suggested.idade_min, 17)}, ${num(suggested.idade_max, 28)},
      ${num(suggested.min_minutos, 450)}, ${suggested.criado_por || 'automacao-cig'}, NOW(), NOW()
    ) RETURNING id
  `
  return row.rows[0]
}

export async function getAutomationHistory(limit = 20) {
  await ensureAutomationTables()
  const [runs, imports, alerts] = await Promise.all([
    safeRows(() => sql`SELECT * FROM cig_automation_runs ORDER BY started_at DESC LIMIT ${Math.min(100, Math.max(1, num(limit, 20)))}`),
    safeRows(() => sql`SELECT * FROM cig_import_logs ORDER BY created_at DESC LIMIT 20`),
    safeRows(() => sql`SELECT * FROM cig_automation_alerts WHERE status = 'active' ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, last_seen_at DESC LIMIT 50`),
  ])
  return { runs, imports, alerts }
}
