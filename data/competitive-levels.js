export const LEVELING_METHODOLOGY_VERSION = '2026.08-relative-v1'

export const COMPETITIVE_LEVELS = [
  { score:1, key:'e', label:'E', short:'E', min:0, max:9.99, description:'Muito abaixo do grupo comparável' },
  { score:2, key:'d', label:'D', short:'D', min:10, max:24.99, description:'Baixo impacto no recorte' },
  { score:3, key:'c', label:'C', short:'C', min:25, max:39.99, description:'Abaixo da média da função' },
  { score:4, key:'c-plus', label:'C+', short:'C+', min:40, max:54.99, description:'Competitivo dentro da média' },
  { score:5, key:'b', label:'B', short:'B', min:55, max:69.99, description:'Competitivo, acima do padrão médio' },
  { score:6, key:'b-plus', label:'B+', short:'B+', min:70, max:79.99, description:'Claramente acima da média' },
  { score:7, key:'a', label:'A', short:'A', min:80, max:89.99, description:'Destaque claro dentro da função' },
  { score:8, key:'a-plus', label:'A+', short:'A+', min:90, max:94.99, description:'Destaque de elite dentro da liga' },
  { score:9, key:'s', label:'S', short:'S', min:95, max:100, description:'Referência absoluta da posição na liga' },
]

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0))
const num = (value, fallback = null) => value === null || value === undefined || value === '' ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback
const round = (value, decimals = 1) => value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(Number(value).toFixed(decimals))

function gradeForIndex(value) {
  const index = clamp(value)
  return COMPETITIVE_LEVELS.find(item => index >= item.min && index <= item.max) || COMPETITIVE_LEVELS[0]
}

export function getCompetitiveLevel(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return null
  const numeric = Number(value)
  if (numeric >= 1 && numeric <= 9 && Number.isInteger(numeric)) return COMPETITIVE_LEVELS[numeric - 1]
  return gradeForIndex(numeric)
}

export function competitiveLevelLabel(value) {
  return getCompetitiveLevel(value)?.label || '—'
}

export function relativeGradeFromIndex(index) {
  const level = gradeForIndex(clamp(index))
  return { ...level, index:round(clamp(index)) }
}

function minutesScore(minutes) {
  if (minutes >= 1800) return 100
  if (minutes >= 1350) return 92
  if (minutes >= 900) return 80
  if (minutes >= 600) return 66
  if (minutes >= 450) return 55
  if (minutes >= 270) return 40
  if (minutes >= 90) return 22
  return 8
}

function gamesScore(games) {
  if (games >= 20) return 100
  if (games >= 15) return 86
  if (games >= 10) return 70
  if (games >= 6) return 50
  if (games >= 3) return 28
  return 10
}

export function robustnessFromScore(score) {
  const value = clamp(score)
  if (value >= 88) return { label:'Muito alta', key:'very-high', score:Math.round(value) }
  if (value >= 72) return { label:'Alta', key:'high', score:Math.round(value) }
  if (value >= 52) return { label:'Moderada', key:'moderate', score:Math.round(value) }
  if (value >= 32) return { label:'Baixa', key:'low', score:Math.round(value) }
  return { label:'Muito baixa', key:'very-low', score:Math.round(value) }
}

export function getSampleConfidence(player = {}, source = '', options = {}) {
  const minutes = num(player.minutos, 0)
  const games = num(player.jogos || player.partidas, 0)
  const coverage = clamp(num(options.metricCoverage, player._level_metric_coverage ?? 0))
  const poolSize = Math.max(0, num(options.poolSize, player._level_pool_size ?? 0))
  const minutesShare = clamp(num(options.minutesShare, player._level_minutes_share ?? 0), 0, 1)
  const poolScore = poolSize >= 30 ? 100 : poolSize >= 20 ? 85 : poolSize >= 12 ? 68 : poolSize >= 8 ? 48 : 22
  const shareScore = minutesShare >= .8 ? 100 : minutesShare >= .6 ? 82 : minutesShare >= .4 ? 62 : minutesShare >= .2 ? 38 : 18
  const sourceScore = String(source || player._fonte || '').toLowerCase() === 'sportsbase' ? 84 : 80
  let score = Math.round(clamp(
    minutesScore(minutes) * .40 + gamesScore(games) * .16 + coverage * .24 + poolScore * .12 + shareScore * .05 + sourceScore * .03
  ))
  // A robustez nunca pode ser inflada apenas por cobertura. A minutagem define o teto
  // da confiança e evita faixas S/A+ consolidadas em amostras muito curtas.
  const minutesCap = minutes < 270 ? 31 : minutes < 450 ? 51 : minutes < 900 ? 71 : minutes < 1350 ? 87 : 100
  const gamesCap = games < 3 ? 26 : games < 6 ? 48 : games < 10 ? 69 : games < 15 ? 86 : 100
  score = Math.min(score, minutesCap, gamesCap)
  return { ...robustnessFromScore(score), minutes, games, metricCoverage:Math.round(coverage), poolSize, minutesShare:round(minutesShare, 3) }
}

function performanceScore(player = {}, options = {}) {
  const direct = [options.performanceScore, player._level_performance_score, player._iap_dominante, player._performance_score, player._score]
    .find(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)))
  return direct === undefined ? 50 : clamp(direct)
}

export function adjustRelativeIndex(rawIndex, confidenceScore) {
  const raw = clamp(rawIndex)
  const confidence = clamp(confidenceScore)
  const shrinkage = .25 + confidence * .0075
  return {
    rawIndex:round(raw),
    adjustedIndex:round(50 + (raw - 50) * shrinkage),
    shrinkage:round(shrinkage, 3),
  }
}

function projectionHeadroom(age, confidence, adjustedIndex) {
  const value = num(age, 25)
  let points = value <= 18 ? 8 : value <= 20 ? 6.5 : value <= 22 ? 5 : value <= 24 ? 3.5 : value <= 26 ? 2 : value <= 28 ? 1 : 0
  points *= .45 + clamp(confidence) / 180
  if (adjustedIndex < 40) points *= .55
  if (adjustedIndex >= 80) points += 1
  return round(Math.min(9, points))
}

export function estimateCompetitiveLevels(player = {}, leagueSlug = '', options = {}) {
  const source = options.source || player._fonte || player.fonte || ''
  const metricCount = num(options.metricCount, player._level_metric_count ?? 0)
  const metricCoverage = num(options.metricCoverage, player._level_metric_coverage ?? 0)
  const poolSize = num(options.poolSize, player._level_pool_size ?? 0)
  const confidence = getSampleConfidence(player, source, { metricCoverage, poolSize, minutesShare:options.minutesShare ?? player._level_minutes_share })
  const rawIndex = performanceScore(player, options)
  const adjusted = adjustRelativeIndex(rawIndex, confidence.score)
  const current = relativeGradeFromIndex(adjusted.adjustedIndex)
  const headroom = projectionHeadroom(player.idade, confidence.score, adjusted.adjustedIndex)
  const potentialIndex = clamp(adjusted.adjustedIndex + headroom)
  const potential = relativeGradeFromIndex(potentialIndex)
  const modelAvailable = metricCount >= 4 && metricCoverage >= 35 && poolSize >= 6 && rawIndex !== null
  const profile = player._perfil_dominante || player._level_profile || 'Perfil geral da posição'
  const positionGroup = player._level_position_group || player._grupo || null
  const trend = potential.score > current.score ? 'Favorável' : potential.index > current.index + 2 ? 'Levemente favorável' : 'Estável'

  return {
    baseScore:50,
    performanceScore:Math.round(rawIndex),
    confidence,
    current:{ ...current, rawScore:current.score, available:true },
    proven:{ ...current, rawScore:current.score, available:confidence.score >= 52, label:current.label },
    potential:{ ...potential, rawScore:potential.score, available:true },
    methodologyVersion:LEVELING_METHODOLOGY_VERSION,
    modelAvailable,
    recommendationType:modelAvailable ? 'estatístico' : 'provisório',
    reason:modelAvailable ? null : 'Faixa provisória: cobertura, amostra ou grupo comparável ainda limitados.',
    criteria:{
      leagueSlug:leagueSlug || player._liga || player.liga || '',
      season:player.temporada || player._temporada || new Date().getFullYear(),
      positionGroup,
      profile,
      rawIndex:adjusted.rawIndex,
      adjustedIndex:adjusted.adjustedIndex,
      shrinkage:adjusted.shrinkage,
      metricCoverage:Math.round(metricCoverage || 0),
      metricCount,
      comparisonPool:poolSize,
      minutes:num(player.minutos, 0),
      games:num(player.jogos || player.partidas, 0),
      projectionIndex:round(potentialIndex),
      projectionHeadroom:headroom,
      trend,
      recommendationType:modelAvailable ? 'estatístico' : 'provisório',
    },
    methodology:'As faixas S–E representam apenas a posição relativa do atleta dentro da própria liga, temporada, posição e perfil. O índice bruto é ajustado em direção à média conforme a robustez da amostra. Não existe equivalência automática com outra divisão.',
  }
}

export function buildProfileBands(player = {}, estimate = null) {
  const baseEstimate = estimate || estimateCompetitiveLevels(player, player._liga || player.liga, { source:player._fonte || player.fonte })
  const confidence = baseEstimate.confidence?.score || 0
  return Object.entries(player._iap_por_perfil || {})
    .map(([profile, raw]) => {
      const adjusted = adjustRelativeIndex(raw, confidence)
      return { profile, ...relativeGradeFromIndex(adjusted.adjustedIndex), rawIndex:adjusted.rawIndex, adjustedIndex:adjusted.adjustedIndex }
    })
    .sort((a, b) => b.adjustedIndex - a.adjustedIndex)
}

export function levelGap(currentScore, potentialScore) {
  if (!Number.isFinite(Number(currentScore)) || !Number.isFinite(Number(potentialScore))) return 0
  return Math.max(0, Number(potentialScore) - Number(currentScore))
}

export function classifyLevelQuadrant(currentScore, potentialScore, confidenceScore = 50) {
  if (!Number.isFinite(Number(currentScore)) || !Number.isFinite(Number(potentialScore))) return { key:'balanced', label:'Leitura em consolidação' }
  const current = Number(currentScore)
  const potential = Number(potentialScore)
  const gap = potential - current
  if (confidenceScore < 32 && gap >= 2) return { key:'high-risk', label:'Aposta de alto risco' }
  if (current >= 7 && potential >= 8) return { key:'ready-high-ceiling', label:'Pronto e alto potencial' }
  if (current >= 7 && gap <= 1) return { key:'immediate', label:'Performance imediata' }
  if (current <= 5 && gap >= 2) return { key:'development', label:'Projeto de desenvolvimento' }
  if (current >= 7 && gap < 1) return { key:'high-low-margin', label:'Faixa alta, pouca margem' }
  return { key:'balanced', label:'Evolução equilibrada' }
}
