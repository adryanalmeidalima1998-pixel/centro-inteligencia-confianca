import {
  SPORTSBASE_SELECTION_ROLES,
  buildSportsbaseRolePools,
} from '@/data/sportsbase-selection'
import { competitiveLevelLabel, estimateCompetitiveLevels } from '@/data/competitive-levels'
import { evaluateGuaraniMarketContext } from '@/data/guarani-market-context'
import { buildWyscoutRolePools } from '@/data/wyscout-selection'

const clamp = value => Math.max(0, Math.min(100, Number(value) || 0))
const num = (value, fallback = 0) => value === null || value === undefined || value === '' ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback
const keyOf = player => `${player.nome}|${player.equipa}`
const ageScore = age => {
  const value = num(age, 30)
  if (value <= 20) return 100
  if (value <= 22) return 92
  if (value <= 24) return 82
  if (value <= 26) return 70
  if (value <= 28) return 58
  if (value <= 30) return 45
  return 30
}

function wyscoutRolePools(players = []) {
  return buildWyscoutRolePools(players)
}

function enrichCandidate(player, slug, source) {
  const levels = estimateCompetitiveLevels(player, slug, { source, performanceScore:player._performance_score || player._score })
  const market = evaluateGuaraniMarketContext(player, slug)
  const currentScore = num(player._nivel_atual_score, levels.current.rawScore)
  const potentialScore = num(player._nivel_potencial_score, levels.potential.rawScore)
  const provenScore = num(player._nivel_comprovado_score, levels.proven.rawScore)
  const confidence = num(player._nivel_confianca, levels.confidence.score)
  return {
    ...player,
    _nivel_atual_score:currentScore,
    _nivel_atual:player._nivel_atual || competitiveLevelLabel(currentScore),
    _nivel_potencial_score:potentialScore,
    _nivel_potencial:player._nivel_potencial || competitiveLevelLabel(potentialScore),
    _nivel_comprovado_score:provenScore,
    _nivel_comprovado:player._nivel_comprovado || competitiveLevelLabel(provenScore),
    _nivel_confianca:confidence,
    _market:market,
  }
}

function modeScore(player, mode) {
  const performance = clamp(player._performance_score || player._score)
  const sample = clamp(player._sample_confidence || player._nivel_confianca)
  const coverage = clamp(player._coverage ?? 70)
  const suitability = clamp(player._suitability ?? 90)
  const age = ageScore(player.idade)
  const viability = player._market?.actionable ? clamp(player._market.score) : clamp(player._market?.score || 45)

  // Todas as seleções partem do rendimento estatístico na função. A faixa interna
  // é exibida como contexto, nunca como a nota que escolhe o jogador.
  if (mode === 'potential') {
    const upside = clamp(performance * .55 + age * .45)
    return performance * .62 + age * .18 + sample * .08 + coverage * .07 + upside * .05
  }
  if (mode === 'opportunity') {
    return performance * .55 + viability * .20 + age * .15 + sample * .07 + coverage * .03
  }
  return performance * .82 + sample * .10 + coverage * .05 + suitability * .03
}

function pickSquad(rolePools, mode, excluded = new Set()) {
  const available = SPORTSBASE_SELECTION_ROLES.map(role => ({
    role,
    candidates:(rolePools[role.slot]?.ranked || [])
      .filter(player => !excluded.has(keyOf(player)))
      .map(player => ({ ...player, _selection_score:Number(modeScore(player, mode).toFixed(1)) }))
      .sort((a, b) => b._selection_score - a._selection_score),
  })).sort((a, b) => a.candidates.length - b.candidates.length)
  const used = new Set(excluded)
  const selected = []
  for (const { role, candidates } of available) {
    const player = candidates.find(candidate => !used.has(keyOf(candidate)))
    if (!player) continue
    used.add(keyOf(player))
    selected.push({ ...player, _slot:role.slot, _role_label:role.label, _grupo:role.group })
  }
  return SPORTSBASE_SELECTION_ROLES.map(role => selected.find(player => player._slot === role.slot)).filter(Boolean)
}

function buildMode(rolePools, mode) {
  const reference = pickSquad(rolePools, mode)
  const usedReference = new Set(reference.map(keyOf))
  const highlight = pickSquad(rolePools, mode, usedReference)
  const usedTwo = new Set([...usedReference, ...highlight.map(keyOf)])
  const ascent = pickSquad(rolePools, mode, usedTwo)
  return { reference, highlight, ascent }
}

export function buildCompetitiveLeagueSelectionsFromPools(base = { rolePools:{}, thresholds:{} }, slug = '', source = 'sportsbase') {
  const rolePools = {}
  for (const role of SPORTSBASE_SELECTION_ROLES) {
    rolePools[role.slot] = {
      ...base.rolePools[role.slot],
      ranked:(base.rolePools[role.slot]?.ranked || []).map(player => enrichCandidate(player, slug, source)),
    }
  }
  const totalEligible = new Set(Object.values(rolePools).flatMap(pool => pool.ranked.map(keyOf))).size
  return {
    source,
    selections:{
      current:buildMode(rolePools, 'current'),
      potential:buildMode(rolePools, 'potential'),
      opportunity:buildMode(rolePools, 'opportunity'),
    },
    thresholds:base.thresholds,
    totalEligible,
    missingRoles:SPORTSBASE_SELECTION_ROLES.filter(role => !(rolePools[role.slot]?.ranked || []).length).map(role => role.slot),
    methodology:{
      current:`Rendimento por função ${source === 'combined' ? 'integrado Sportsbase + Wyscout' : source === 'wyscout' ? 'Wyscout' : 'Sportsbase'}: score funcional calibrado, robustez da amostra e adequação posicional.`,
      potential:`Projeção ${source === 'combined' ? 'integrada' : source === 'wyscout' ? 'Wyscout' : 'Sportsbase'}: rendimento atual 62%, curva etária 18%, amostra 8%, cobertura 7% e combinação idade-desempenho 5%.`,
      opportunity:`Oportunidade ${source === 'combined' ? 'integrada' : source === 'wyscout' ? 'Wyscout' : 'Sportsbase'}: rendimento por função 55%, viabilidade do mercado 20%, idade 15%, amostra 7% e cobertura estatística 3%.`,
    },
  }
}

export function buildCompetitiveLeagueSelections(players = [], slug = '', source = 'sportsbase') {
  const base = source === 'sportsbase' ? buildSportsbaseRolePools(players) : wyscoutRolePools(players)
  return buildCompetitiveLeagueSelectionsFromPools(base, slug, source)
}
