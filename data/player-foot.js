export const PLAYER_FOOT_OPTIONS = [
  { value: '', label: 'Qualquer pé' },
  { value: 'direito', label: 'Direito' },
  { value: 'esquerdo', label: 'Esquerdo' },
  { value: 'ambos', label: 'Ambos' },
  { value: 'unknown', label: 'Não informado' },
]

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function normalizePlayerFoot(value) {
  const text = normalizeText(value)
  if (!text || ['-', 'n/a', 'na', 'null', 'undefined', 'desconhecido', 'nao informado'].includes(text)) return 'unknown'
  if (['both', 'ambos', 'ambidestro', 'ambidextra', 'two-footed', 'bilateral'].some(item => text.includes(item))) return 'ambos'
  if (['left', 'esquerdo', 'esquerda', 'canhoto', 'sinistro'].some(item => text.includes(item))) return 'esquerdo'
  if (['right', 'direito', 'direita', 'destro'].some(item => text.includes(item))) return 'direito'
  return 'unknown'
}

export function getPlayerFoot(player = {}) {
  const candidates = [
    player.pe,
    player.pe_preferido,
    player.pe_preferencial,
    player.pe_dominante,
    player.preferred_foot,
    player.preferredFoot,
    player.foot,
    player['Pé'],
    player['Pé preferido'],
  ]
  for (const candidate of candidates) {
    const normalized = normalizePlayerFoot(candidate)
    if (normalized !== 'unknown') return normalized
  }
  return 'unknown'
}

export function playerFootLabel(value, short = false) {
  const foot = normalizePlayerFoot(value)
  if (foot === 'direito') return short ? 'D' : 'Direito'
  if (foot === 'esquerdo') return short ? 'E' : 'Esquerdo'
  if (foot === 'ambos') return short ? 'A' : 'Ambos'
  return short ? '—' : 'Não informado'
}

export function matchesPlayerFoot(player, filter) {
  if (!filter) return true
  const wanted = normalizePlayerFoot(filter)
  return getPlayerFoot(player) === wanted
}

export function normalizeIdentityText(value = '') {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function nameTokens(value = '') {
  return normalizeIdentityText(value).split(' ').filter(token => token.length > 1)
}

function positionTokens(value = '') {
  return String(value || '').toUpperCase().split(',').map(item => item.trim()).filter(Boolean)
}

function teamComparable(a = '', b = '') {
  const aa = normalizeIdentityText(a)
  const bb = normalizeIdentityText(b)
  if (!aa || !bb) return false
  return aa === bb || aa.includes(bb) || bb.includes(aa)
}

function playerMatchScore(player = {}, reference = {}) {
  const nameA = normalizeIdentityText(player.nome || player.jogador)
  const nameB = normalizeIdentityText(reference.nome || reference.jogador)
  const teamA = player.equipa || player.clube || player.time
  const teamB = reference.equipa || reference.clube || reference.time
  const exactName = nameA && nameA === nameB
  const sameTeam = teamComparable(teamA, teamB)
  const ageA = Number(player.idade)
  const ageB = Number(reference.idade)
  const sameAge = Number.isFinite(ageA) && Number.isFinite(ageB) && ageA === ageB
  const tokensA = nameTokens(nameA)
  const tokensB = nameTokens(nameB)
  const overlap = tokensA.filter(token => tokensB.includes(token)).length
  const lastA = tokensA.at(-1)
  const lastB = tokensB.at(-1)
  const surnameMatch = Boolean(lastA && lastB && (lastA === lastB || tokensA.includes(lastB) || tokensB.includes(lastA)))
  const posA = positionTokens(player.posicao)
  const posB = positionTokens(reference.posicao)
  const samePosition = posA.some(code => posB.includes(code))

  if (exactName && sameTeam) return 100
  if (exactName && sameAge) return 92
  if (exactName) return 72
  let score = 0
  if (sameTeam) score += 38
  if (sameAge) score += 22
  if (surnameMatch) score += 24
  score += Math.min(20, overlap * 8)
  if (samePosition) score += 8
  return score
}

export function enrichPlayersWithFoot(players = [], references = [], source = 'reference') {
  const usableReferences = references
    .map(item => ({ ...item, pe: getPlayerFoot(item) }))
    .filter(item => item.pe !== 'unknown')

  return players.map(player => {
    const existing = getPlayerFoot(player)
    if (existing !== 'unknown') return { ...player, pe: existing, pe_fonte: player.pe_fonte || player._fonte || source }

    let best = null
    let bestScore = 0
    for (const reference of usableReferences) {
      const score = playerMatchScore(player, reference)
      if (score > bestScore) { best = reference; bestScore = score }
    }
    if (!best || bestScore < 80) return { ...player, pe: 'unknown', pe_fonte: null }
    return { ...player, pe: best.pe, pe_fonte: best.pe_fonte || best._fonte || source, _pe_match_score: bestScore }
  })
}

export function getFootCoverage(players = []) {
  const counts = { direito: 0, esquerdo: 0, ambos: 0, unknown: 0 }
  for (const player of players) counts[getPlayerFoot(player)] += 1
  const informed = players.length - counts.unknown
  return {
    ...counts,
    informed,
    total: players.length,
    coveragePct: players.length ? Math.round((informed / players.length) * 100) : 0,
  }
}
