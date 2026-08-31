import { buildPlayerIdentity } from '@/app/lib/playerMaster'
import { SPORTSBASE_SELECTION_ROLES, buildSportsbaseRolePools } from '@/data/sportsbase-selection'
import { buildWyscoutRolePools } from '@/data/wyscout-selection'
import { rankPercentile } from '@/data/selection-score-utils'
import { compareProviderFreshness, pairProviderPlayers } from '@/data/provider-data-fusion'

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0))
const round = (value, decimals = 1) => {
  const factor = 10 ** decimals
  return Math.round((Number(value) || 0) * factor) / factor
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function identityKey(player = {}) {
  const identity = buildPlayerIdentity(player).identityKey
  if (identity) return identity
  return `${normalize(player.nome)}|${normalize(player.equipa || player.time || player.clube)}|${Number(player.idade) || ''}`
}

function candidateQuality(candidate) {
  const sample = clamp(candidate?._sample_confidence ?? 70) / 100
  const coverage = clamp(candidate?._coverage ?? 70) / 100
  const suitability = clamp(candidate?._suitability ?? 90) / 100
  return .50 + .27 * sample + .18 * coverage + .05 * suitability
}

function informedFoot(value) {
  const foot = String(value || '').toLowerCase()
  return foot && !['unknown','desconhecido','na','n/a','null'].includes(foot) ? value : null
}

function mergeStrengths(a = [], b = []) {
  const map = new Map()
  for (const item of [...a, ...b]) {
    const key = String(item?.key || item?.label || '').toLowerCase()
    if (!key) continue
    const current = map.get(key)
    if (!current || Number(item?.percentile) > Number(current?.percentile)) map.set(key, item)
  }
  return [...map.values()].sort((x,y)=>(Number(y.percentile)||0)-(Number(x.percentile)||0)).slice(0,3)
}

function mergeWatchouts(a = [], b = []) {
  const map = new Map()
  for (const item of [...a, ...b]) {
    const key = String(item?.key || item?.label || '').toLowerCase()
    if (!key) continue
    const current = map.get(key)
    if (!current || Number(item?.percentile) < Number(current?.percentile)) map.set(key, item)
  }
  return [...map.values()].sort((x,y)=>(Number(x.percentile)||100)-(Number(y.percentile)||100)).slice(0,2)
}

function fusePair(sportsbase, wyscout, role, matchQuality = 0) {
  if (!sportsbase && !wyscout) return null
  if (!sportsbase) return { ...wyscout, _source_scores:{ wyscout:wyscout._score }, _source_coverage:1, _fonte:'wyscout', _fresh_source:'wyscout', _match_quality:matchQuality }
  if (!wyscout) return { ...sportsbase, _source_scores:{ sportsbase:sportsbase._score }, _source_coverage:1, _fonte:'sportsbase', _fresh_source:'sportsbase', _match_quality:matchQuality }

  const freshness = compareProviderFreshness(sportsbase, wyscout)
  // Cobertura e robustez continuam importantes, mas uma base defasada não pode
  // ter o mesmo peso de outra que já contém um jogo/minutagem adicional.
  const qa = candidateQuality(sportsbase) * freshness.sportsbase
  const qb = candidateQuality(wyscout) * freshness.wyscout
  const weightedScore = (Number(sportsbase._score) * qa + Number(wyscout._score) * qb) / Math.max(.01, qa + qb)
  const weightedPerformance = (Number(sportsbase._performance_score) * qa + Number(wyscout._performance_score) * qb) / Math.max(.01, qa + qb)
  const disagreement = Math.abs(Number(sportsbase._score) - Number(wyscout._score))
  const consensus = clamp(100 - disagreement * 2.2, 55, 100)
  const primary = freshness.primary === 'wyscout' ? wyscout : sportsbase

  return {
    ...primary,
    nome:primary.nome || sportsbase.nome || wyscout.nome,
    equipa:primary.equipa || sportsbase.equipa || wyscout.equipa,
    posicao:primary.posicao || sportsbase.posicao || wyscout.posicao,
    pe:informedFoot(wyscout.pe) || informedFoot(sportsbase.pe) || primary.pe,
    idade:primary.idade ?? sportsbase.idade ?? wyscout.idade,
    minutos:Number(primary.minutos) || Math.max(Number(sportsbase.minutos) || 0, Number(wyscout.minutos) || 0),
    jogos:Number(primary.jogos) || Math.max(Number(sportsbase.jogos) || 0, Number(wyscout.jogos) || 0),
    _slot:role.slot,
    _role_label:role.label,
    _grupo:role.group,
    _score:round(weightedScore),
    _performance_score:round(weightedPerformance),
    _sample_confidence:Math.round((Number(sportsbase._sample_confidence || 0) * qa + Number(wyscout._sample_confidence || 0) * qb) / Math.max(.01, qa + qb)),
    _coverage:Math.round((Number(sportsbase._coverage || 0) * qa + Number(wyscout._coverage || 0) * qb) / Math.max(.01, qa + qb)),
    _suitability:Math.max(Number(sportsbase._suitability) || 0, Number(wyscout._suitability) || 0),
    _reliability:round((Number(sportsbase._reliability || 0) * qa + Number(wyscout._reliability || 0) * qb) / Math.max(.01, qa + qb), 3),
    _strengths:mergeStrengths(sportsbase._strengths, wyscout._strengths),
    _watchouts:mergeWatchouts(sportsbase._watchouts, wyscout._watchouts),
    _score_breakdown:[
      ...(sportsbase._score_breakdown || []).map(item=>({ ...item, provider:'sportsbase' })),
      ...(wyscout._score_breakdown || []).map(item=>({ ...item, provider:'wyscout' })),
    ],
    _source_scores:{ sportsbase:round(sportsbase._score), wyscout:round(wyscout._score) },
    _source_performance:{ sportsbase:round(sportsbase._performance_score), wyscout:round(wyscout._performance_score) },
    _source_coverage:2,
    _source_consensus:Math.round(consensus),
    _fresh_source:freshness.primary,
    _freshness_reason:freshness.reason,
    _freshness_weights:{ sportsbase:round(freshness.sportsbase,2), wyscout:round(freshness.wyscout,2) },
    _match_quality:round(matchQuality,2),
    _fonte:'combined',
    _source_model:'cic-integrated-role-score-v8',
    _provisional:Boolean(sportsbase._provisional && wyscout._provisional),
  }
}

function mergeRole(role, sportsbasePool, wyscoutPool) {
  // Pareamento canônico com fallback controlado para idade ±1, nacionalidade,
  // posição e clube. Isso evita duplicar o mesmo atleta quando os provedores
  // escrevem clube/idade de forma ligeiramente diferente e também evita unir homônimos.
  const pairs = pairProviderPlayers(sportsbasePool?.ranked || [], wyscoutPool?.ranked || [])
  let ranked = pairs.map(item=>fusePair(item.sportsbase, item.wyscout, role, item.matchQuality)).filter(Boolean)

  // Pequena recalibração relativa no universo integrado. Ela preserva os scores
  // das fontes, mas impede que diferenças de escala entre provedores alterem a ordem.
  const sourceScores = ranked.map(player=>Number(player._score)).filter(Number.isFinite)
  ranked = ranked.map(player => {
    const rolePct = rankPercentile(player._score, sourceScores, true) ?? 50
    const relativeDisplay = 45 + rolePct * .50
    const blended = player._source_coverage === 2
      ? Number(player._score) * .88 + relativeDisplay * .12
      : Number(player._score) * .92 + relativeDisplay * .08
    return { ...player, _role_percentile_integrated:round(rolePct), _score:round(blended) }
  }).sort((a,b)=>
    b._score-a._score ||
    b._performance_score-a._performance_score ||
    b._sample_confidence-a._sample_confidence ||
    (Number(b.minutos)||0)-(Number(a.minutos)||0)
  )

  return {
    ranked,
    candidates:ranked,
    minimumMinutes:Math.min(
      Number(sportsbasePool?.minimumMinutes) || Infinity,
      Number(wyscoutPool?.minimumMinutes) || Infinity,
    ) === Infinity ? 0 : Math.min(
      Number(sportsbasePool?.minimumMinutes) || Infinity,
      Number(wyscoutPool?.minimumMinutes) || Infinity,
    ),
    maxMinutes:Math.max(Number(sportsbasePool?.maxMinutes)||0,Number(wyscoutPool?.maxMinutes)||0),
    factor:0,
  }
}

export function buildIntegratedRolePools(sportsbasePlayers = [], wyscoutPlayers = []) {
  const sportsbase = buildSportsbaseRolePools(sportsbasePlayers)
  const wyscout = buildWyscoutRolePools(wyscoutPlayers)
  const rolePools = {}
  const thresholds = {}

  for (const role of SPORTSBASE_SELECTION_ROLES) {
    rolePools[role.slot] = mergeRole(role, sportsbase.rolePools[role.slot], wyscout.rolePools[role.slot])
    thresholds[role.slot] = {
      label:role.label,
      limiar:0,
      maxMin:rolePools[role.slot].maxMinutes,
      total:rolePools[role.slot].ranked.length,
      sportsbase:sportsbase.thresholds[role.slot]?.limiar || 0,
      wyscout:wyscout.thresholds[role.slot]?.limiar || 0,
    }
  }

  return {
    rolePools,
    thresholds,
    source:'combined',
    totalEligible:new Set(Object.values(rolePools).flatMap(pool=>pool.ranked.map(identityKey))).size,
    methodology:'Integração CIC V8 por função: cada fonte calcula seus percentis no próprio modelo; o score integrado pondera cobertura, robustez e atualização individual por jogos/minutos. Campo ausente nunca vira zero automaticamente na elegibilidade. Quando uma fonte está mais atualizada, ela recebe maior peso; a outra continua contribuindo nas métricas que possui. Atletas presentes em apenas uma fonte permanecem elegíveis sem penalização.',
  }
}
