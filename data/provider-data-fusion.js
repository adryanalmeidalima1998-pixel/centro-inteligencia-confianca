import { buildPlayerIdentity } from '../lib/player-identity.js'

const STATIC_KEYS = new Set([
  'nome','idade','altura','peso','pais','nacionalidade','naturalidade','pe','pe_original','pe_fonte',
  'posicao','grupo_posicional','data_nascimento','nascimento','ano_nascimento','valor_mercado','contrato_termina','fim_contrato','emprestado',
])

const IDENTITY_KEYS = new Set(['nome','idade','pais','nacionalidade','posicao','equipa','time','clube'])
const OBJECTIVE_TOTAL_KEYS = new Set([
  'jogos','minutos','gols','assistencias','gols_sem_penalti','gols_cabeca','penaltis_marcados','clean_sheets',
])
const RATE_FROM_TOTAL = {
  gols_90:'gols',
  assistencias_90:'assistencias',
  gols_sem_penalti_90:'gols_sem_penalti',
  gols_cabeca_90:'gols_cabeca',
}
const NAME_PARTICLES = new Set(['da','das','de','del','della','des','di','do','dos','du','e','el','la','las','le','los','van','von'])
const NAME_SUFFIXES = new Set(['filho','jr','junior','neto','sobrinho'])
const TEAM_STOP = new Set(['fc','ec','se','sc','saf','club','clube','futebol','esporte','esportivo','associacao','associação'])

function normalize(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function numeric(value) {
  if (value === null || value === undefined || value === '' || value === '-') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function round(value, decimals = 4) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export function hasProviderValue(value) {
  if (value === null || value === undefined || value === '' || value === '-') return false
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

function normalizedTeam(value) {
  return normalize(value).split(' ').filter(token => token && !TEAM_STOP.has(token)).join(' ')
}

function teamSimilarity(a, b) {
  const left = normalizedTeam(a)
  const right = normalizedTeam(b)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return .92
  const aTokens = new Set(left.split(' '))
  const bTokens = new Set(right.split(' '))
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length
  const union = new Set([...aTokens, ...bTokens]).size
  return union ? intersection / union : 0
}

function cleanNameTokens(value) {
  return normalize(value)
    .split(' ')
    .filter(Boolean)
    .filter(token => !NAME_PARTICLES.has(token) && !NAME_SUFFIXES.has(token))
}

function significantNameTokens(value) {
  return cleanNameTokens(value).filter(token => token.length > 1)
}

function compactName(value) {
  return cleanNameTokens(value).join('')
}

function isInitial(token) {
  return token.length === 1
}

function tokenSetSimilarity(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0
  const a = new Set(aTokens)
  const b = new Set(bTokens)
  const intersection = [...a].filter(token => b.has(token)).length
  const union = new Set([...a, ...b]).size
  return union ? intersection / union : 0
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const prev = Array.from({ length:b.length + 1 }, (_, index) => index)
  const curr = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]
  }
  return prev[b.length]
}

function stringSimilarity(a, b) {
  const left = String(a || '')
  const right = String(b || '')
  if (!left || !right) return 0
  const max = Math.max(left.length, right.length)
  return max ? 1 - (levenshtein(left, right) / max) : 0
}

function abbreviationMatch(shortTokens, longTokens) {
  if (shortTokens.length < 2 || longTokens.length < 2) return false
  const first = shortTokens[0]
  const longFirst = longTokens[0]
  const firstMatches = isInitial(first)
    ? longFirst.startsWith(first)
    : first === longFirst || longFirst.startsWith(first) || first.startsWith(longFirst)
  if (!firstMatches) return false
  const remaining = shortTokens.slice(1).filter(token => !isInitial(token))
  if (!remaining.length) return false
  return remaining.every(token => longTokens.includes(token))
}

function nameEvidence(a, b) {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return { score:0, type:'missing' }
  if (left === right) return { score:1, type:'exact' }

  const aTokens = cleanNameTokens(a)
  const bTokens = cleanNameTokens(b)
  const aCompact = compactName(a)
  const bCompact = compactName(b)
  if (aCompact && aCompact === bCompact) return { score:.99, type:'compact_exact' }

  const short = aTokens.length <= bTokens.length ? aTokens : bTokens
  const long = aTokens.length <= bTokens.length ? bTokens : aTokens
  if (abbreviationMatch(short, long)) return { score:.95, type:'initial_surname' }

  const shortStrong = short.filter(token => !isInitial(token))
  if (shortStrong.length >= 2 && shortStrong.every(token => long.includes(token))) {
    return { score:.92, type:'token_subset' }
  }

  const shared = significantNameTokens(a).filter(token => significantNameTokens(b).includes(token))
  const firstInitialCompatible = aTokens[0] && bTokens[0] && aTokens[0][0] === bTokens[0][0]
  if (shared.length >= 2 && firstInitialCompatible) return { score:.89, type:'multi_token' }
  if (shared.length >= 1 && firstInitialCompatible) return { score:.80, type:'surname_initial' }

  const tokenSimilarity = tokenSetSimilarity(significantNameTokens(a), significantNameTokens(b))
  const fuzzy = stringSimilarity(aCompact, bCompact)
  const score = Math.max(tokenSimilarity * .88, fuzzy * .84)
  return { score, type:score >= .72 ? 'fuzzy' : 'weak' }
}

function primaryPosition(value) {
  return normalize(String(value || '').split(',')[0])
}

function positionGroup(value) {
  const pos = String(value || '').split(',')[0].trim().toUpperCase()
  if (!pos) return ''
  if (pos === 'GK') return 'GK'
  if (['CB','LCB','RCB','LB','RB','LWB','RWB'].includes(pos)) return 'DEF'
  if (['DMF','CMF','AMF','LMF','RMF','LCMF','RCMF','LDMF','RDMF','CDM','LCDM','RCDM','LDM','RDM','LCM','RCM','CAM','LCAM','RCAM','LM','RM'].includes(pos)) return 'MID'
  if (['LWF','RWF','LW','RW','RAMF','LAMF','LAM','RAM','CF','LCF','RCF','SS'].includes(pos)) return 'FWD'
  return pos
}

function normalizedNationality(player = {}) {
  return normalize(player.pais || player.nacionalidade || player.nationality)
}

function birthDateValue(player = {}) {
  const raw = player.data_nascimento || player.nascimento || player.birth_date || player['Data de nascimento']
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null
}

function birthYearValue(player = {}) {
  const direct = numeric(player.ano_nascimento)
  if (direct !== null) return direct
  const date = birthDateValue(player)
  if (date) return Number(date.slice(0, 4))
  const identity = buildPlayerIdentity(player)
  return numeric(identity.birthYear)
}

function scoreIdentityCandidate(a = {}, b = {}) {
  const name = nameEvidence(a.nome, b.nome)
  if (name.score < .64) return null

  const birthA = birthDateValue(a)
  const birthB = birthDateValue(b)
  if (birthA && birthB && birthA !== birthB) return null

  const yearA = birthYearValue(a)
  const yearB = birthYearValue(b)
  if (yearA !== null && yearB !== null && Math.abs(yearA - yearB) > 1) return null

  const ageA = numeric(a.idade)
  const ageB = numeric(b.idade)
  if (ageA !== null && ageB !== null && Math.abs(ageA - ageB) > 1) return null

  const team = teamSimilarity(a.equipa || a.time || a.clube, b.equipa || b.time || b.clube)
  const natA = normalizedNationality(a)
  const natB = normalizedNationality(b)
  const posA = primaryPosition(a.posicao)
  const posB = primaryPosition(b.posicao)
  const groupA = positionGroup(a.posicao)
  const groupB = positionGroup(b.posicao)

  let score = name.score * 55
  let supports = 0
  const reasons = [name.type]

  if (birthA && birthB && birthA === birthB) { score += 28; supports += 2; reasons.push('birthdate') }
  else if (yearA !== null && yearB !== null) {
    if (yearA === yearB) { score += 17; supports += 1; reasons.push('birthyear') }
    else { score += 7; reasons.push('birthyear±1') }
  }

  if (ageA !== null && ageB !== null) {
    if (ageA === ageB) { score += 14; supports += 1; reasons.push('age') }
    else { score += 7; reasons.push('age±1') }
  }

  if (team > 0) {
    score += team * 17
    if (team >= .78) { supports += 1; reasons.push('team') }
    else if (team >= .45) reasons.push('team_partial')
  }

  if (natA && natB) {
    if (natA === natB) { score += 7; supports += 1; reasons.push('nationality') }
    else score -= 4
  }

  if (posA && posB) {
    if (posA === posB) { score += 8; supports += 1; reasons.push('position') }
    else if (groupA && groupA === groupB) { score += 5; supports += .5; reasons.push('position_group') }
    else score -= 3
  }

  // Nomes abreviados como "K. Viveros" só entram quando existem evidências
  // independentes suficientes para não juntar homônimos por sobrenome.
  const abbreviationLike = ['initial_surname','surname_initial','fuzzy'].includes(name.type)
  if (abbreviationLike && supports < 1.5 && name.score < .9) return null
  if (name.type === 'surname_initial' && supports < 2) return null

  return {
    score,
    quality:Math.max(0, Math.min(1, score / 105)),
    nameScore:name.score,
    nameType:name.type,
    supports,
    reason:reasons.join('+'),
  }
}

function exactIdentity(player = {}) {
  return buildPlayerIdentity(player).identityKey || ''
}

function candidateIndexesForPlayer(player, indexes, total) {
  const set = new Set()
  const identity = exactIdentity(player)
  for (const index of indexes.byIdentity.get(identity) || []) set.add(index)
  const exactName = normalize(player.nome)
  for (const index of indexes.byName.get(exactName) || []) set.add(index)
  for (const token of significantNameTokens(player.nome)) {
    for (const index of indexes.byToken.get(token) || []) set.add(index)
  }
  const team = normalizedTeam(player.equipa || player.time || player.clube)
  for (const token of team.split(' ').filter(Boolean)) {
    for (const index of indexes.byTeamToken.get(token) || []) set.add(index)
  }
  // Em nomes muito curtos, o bloqueio pode não trazer nada. O universo Wyscout
  // é no máximo ~500 atletas por export, então um fallback completo é aceitável.
  if (!set.size && total <= 700) for (let i = 0; i < total; i += 1) set.add(i)
  return set
}

export function pairProviderPlayers(sportsbasePlayers = [], wyscoutPlayers = []) {
  if (!sportsbasePlayers.length) return wyscoutPlayers.map(wyscout => ({ sportsbase:null, wyscout, matchQuality:0, matchReason:'wyscout_only' }))
  if (!wyscoutPlayers.length) return sportsbasePlayers.map(sportsbase => ({ sportsbase, wyscout:null, matchQuality:0, matchReason:'sportsbase_only' }))

  const indexes = { byIdentity:new Map(), byName:new Map(), byToken:new Map(), byTeamToken:new Map() }
  wyscoutPlayers.forEach((player, index) => {
    const push = (map, key) => {
      if (!key) return
      const list = map.get(key) || []
      list.push(index)
      map.set(key, list)
    }
    push(indexes.byIdentity, exactIdentity(player))
    push(indexes.byName, normalize(player.nome))
    significantNameTokens(player.nome).forEach(token => push(indexes.byToken, token))
    normalizedTeam(player.equipa || player.time || player.clube).split(' ').filter(Boolean).forEach(token => push(indexes.byTeamToken, token))
  })

  const edges = []
  const sbCandidates = new Map()
  const wyCandidates = new Map()

  sportsbasePlayers.forEach((sportsbase, sbIndex) => {
    const candidates = candidateIndexesForPlayer(sportsbase, indexes, wyscoutPlayers.length)
    for (const wyIndex of candidates) {
      const scored = scoreIdentityCandidate(sportsbase, wyscoutPlayers[wyIndex])
      if (!scored) continue
      const edge = { sbIndex, wyIndex, ...scored }
      edges.push(edge)
      const bySb = sbCandidates.get(sbIndex) || []
      bySb.push(edge); sbCandidates.set(sbIndex, bySb)
      const byWy = wyCandidates.get(wyIndex) || []
      byWy.push(edge); wyCandidates.set(wyIndex, byWy)
    }
  })

  for (const list of sbCandidates.values()) list.sort((a,b)=>b.score-a.score)
  for (const list of wyCandidates.values()) list.sort((a,b)=>b.score-a.score)

  const accepted = edges.filter(edge => {
    const sbList = sbCandidates.get(edge.sbIndex) || []
    const wyList = wyCandidates.get(edge.wyIndex) || []
    const sbSecond = sbList.find(item => item.wyIndex !== edge.wyIndex)
    const wySecond = wyList.find(item => item.sbIndex !== edge.sbIndex)
    const sbMargin = edge.score - (sbSecond?.score ?? 0)
    const wyMargin = edge.score - (wySecond?.score ?? 0)
    const exactish = ['exact','compact_exact','token_subset'].includes(edge.nameType)
    const threshold = exactish ? 63 : edge.nameType === 'initial_surname' ? 69 : 76
    const marginNeeded = exactish ? 2 : edge.nameType === 'initial_surname' ? 5 : 9
    return edge.score >= threshold && sbMargin >= marginNeeded && wyMargin >= marginNeeded
  }).sort((a,b)=>b.score-a.score)

  const usedSb = new Set()
  const usedWy = new Set()
  const matchBySb = new Map()
  for (const edge of accepted) {
    if (usedSb.has(edge.sbIndex) || usedWy.has(edge.wyIndex)) continue
    usedSb.add(edge.sbIndex)
    usedWy.add(edge.wyIndex)
    matchBySb.set(edge.sbIndex, edge)
  }

  const pairs = sportsbasePlayers.map((sportsbase, sbIndex) => {
    const edge = matchBySb.get(sbIndex)
    if (!edge) {
      const best = (sbCandidates.get(sbIndex) || [])[0]
      return {
        sportsbase,
        wyscout:null,
        matchQuality:0,
        matchReason:best ? `ambiguous_or_low_confidence:${best.reason}` : 'no_candidate',
      }
    }
    return {
      sportsbase,
      wyscout:wyscoutPlayers[edge.wyIndex],
      matchQuality:round(edge.quality, 3),
      matchReason:edge.reason,
      matchScore:round(edge.score, 2),
    }
  })

  wyscoutPlayers.forEach((wyscout, wyIndex) => {
    if (!usedWy.has(wyIndex)) pairs.push({ sportsbase:null, wyscout, matchQuality:0, matchReason:'wyscout_only' })
  })
  return pairs
}

export function findBestProviderMatch(player, candidates = []) {
  if (!player || !candidates.length) return null
  const pairs = pairProviderPlayers([player], candidates)
  const paired = pairs.find(item => item.sportsbase && item.wyscout)
  return paired ? { player:paired.wyscout, matchQuality:paired.matchQuality, matchReason:paired.matchReason } : null
}

function parsedTimestamp(value) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0
}

function objectiveProgressSignal(sportsbase, wyscout) {
  const keys = ['gols','assistencias','gols_sem_penalti','clean_sheets']
  let sportsbaseWins = 0
  let wyscoutWins = 0
  const differences = []
  for (const key of keys) {
    const sb = numeric(sportsbase?.[key])
    const wy = numeric(wyscout?.[key])
    if (sb === null || wy === null || sb === wy) continue
    if (sb > wy) sportsbaseWins += key === 'gols' ? 2 : 1
    else wyscoutWins += key === 'gols' ? 2 : 1
    differences.push(key)
  }
  return { sportsbaseWins, wyscoutWins, differences }
}

export function compareProviderFreshness(sportsbase, wyscout) {
  if (!sportsbase && !wyscout) return { primary:null, sportsbase:0, wyscout:0, reason:'sem fontes' }
  if (!sportsbase) return { primary:'wyscout', sportsbase:0, wyscout:1, reason:'somente Wyscout' }
  if (!wyscout) return { primary:'sportsbase', sportsbase:1, wyscout:0, reason:'somente Sportsbase' }

  const sg = numeric(sportsbase.jogos)
  const wg = numeric(wyscout.jogos)
  const sm = numeric(sportsbase.minutos)
  const wm = numeric(wyscout.minutos)
  const su = parsedTimestamp(sportsbase._source_upload_at)
  const wu = parsedTimestamp(wyscout._source_upload_at)

  let primary = null
  let staleFactor = .96
  let reason = 'mesma janela competitiva'

  if (sg !== null && wg !== null && sg !== wg) {
    const gap = Math.abs(sg - wg)
    primary = wg > sg ? 'wyscout' : 'sportsbase'
    staleFactor = gap >= 3 ? .28 : gap === 2 ? .45 : .65
    reason = `${gap} jogo(s) de diferença`
  } else if (sm !== null && wm !== null && Math.abs(sm - wm) >= 30) {
    const gap = Math.abs(sm - wm)
    primary = wm > sm ? 'wyscout' : 'sportsbase'
    staleFactor = gap >= 270 ? .45 : gap >= 180 ? .58 : gap >= 90 ? .72 : .86
    reason = `${Math.round(gap)} minutos de diferença`
  } else {
    const signal = objectiveProgressSignal(sportsbase, wyscout)
    if (signal.sportsbaseWins !== signal.wyscoutWins && Math.max(signal.sportsbaseWins, signal.wyscoutWins) >= 2) {
      primary = signal.wyscoutWins > signal.sportsbaseWins ? 'wyscout' : 'sportsbase'
      staleFactor = .78
      reason = `totais acumulados (${signal.differences.join(', ')}) indicam fonte mais completa`
    } else if (su && wu && su !== wu) {
      primary = wu > su ? 'wyscout' : 'sportsbase'
      staleFactor = .92
      reason = 'upload mais recente'
    }
  }

  if (!primary) {
    primary = (wm || 0) > (sm || 0) ? 'wyscout' : 'sportsbase'
    return { primary, sportsbase:1, wyscout:1, reason }
  }

  return {
    primary,
    sportsbase:primary === 'sportsbase' ? 1 : staleFactor,
    wyscout:primary === 'wyscout' ? 1 : staleFactor,
    reason,
  }
}

function richerName(a, b) {
  if (!hasProviderValue(a)) return b
  if (!hasProviderValue(b)) return a
  const aTokens = significantNameTokens(a)
  const bTokens = significantNameTokens(b)
  if (aTokens.length !== bTokens.length) return aTokens.length > bTokens.length ? a : b
  return String(a).length >= String(b).length ? a : b
}

function preferredStaticValue(key, sportsbase, wyscout, freshness) {
  if (key === 'nome') {
    const value = richerName(sportsbase?.nome, wyscout?.nome)
    return { value, source:value === sportsbase?.nome ? 'sportsbase' : 'wyscout' }
  }
  if (key === 'pe' || key === 'pe_original' || key === 'pe_fonte') {
    const wy = wyscout?.[key]
    if (hasProviderValue(wy) && !['unknown','desconhecido'].includes(normalize(wy))) return { value:wy, source:'wyscout' }
    const sb = sportsbase?.[key]
    if (hasProviderValue(sb) && !['unknown','desconhecido'].includes(normalize(sb))) return { value:sb, source:'sportsbase' }
  }
  const primary = freshness.primary === 'wyscout' ? wyscout : sportsbase
  const secondary = freshness.primary === 'wyscout' ? sportsbase : wyscout
  if (hasProviderValue(primary?.[key])) return { value:primary[key], source:freshness.primary }
  const secondarySource = freshness.primary === 'wyscout' ? 'sportsbase' : 'wyscout'
  if (hasProviderValue(secondary?.[key])) return { value:secondary[key], source:secondarySource }
  return { value:null, source:null }
}

function preferredObjectiveTotal(key, sportsbase, wyscout, freshness) {
  const sb = numeric(sportsbase?.[key])
  const wy = numeric(wyscout?.[key])
  if (sb === null && wy === null) return { value:null, source:null }
  if (sb === null) return { value:wyscout[key], source:'wyscout' }
  if (wy === null) return { value:sportsbase[key], source:'sportsbase' }
  if (sb === wy) return { value:sb, source:freshness.primary }
  // Jogos, minutos, gols e assistências são acumulados na competição. Em um pareamento
  // de alta confiança, o maior acumulado evita que uma exportação atrasada derrube o dado.
  return sb > wy ? { value:sportsbase[key], source:'sportsbase' } : { value:wyscout[key], source:'wyscout' }
}

function recalcRateFields(fused, fieldSources) {
  const minutes = numeric(fused.minutos)
  if (!minutes || minutes <= 0) return
  for (const [rateKey, totalKey] of Object.entries(RATE_FROM_TOTAL)) {
    const total = numeric(fused[totalKey])
    if (total === null) continue
    fused[rateKey] = round((total * 90) / minutes, 4)
    fieldSources[rateKey] = 'derived_combined'
  }
}

export function fusePlayerRecords(sportsbase, wyscout, matchQuality = 0, matchReason = '') {
  if (!sportsbase && !wyscout) return null
  if (!sportsbase) return { ...wyscout, _fonte:'wyscout', _source_coverage:1, _fresh_source:'wyscout', _field_sources:{}, _match_quality:0, _match_reason:'wyscout_only' }
  if (!wyscout) return { ...sportsbase, _fonte:'sportsbase', _source_coverage:1, _fresh_source:'sportsbase', _field_sources:{}, _match_quality:0, _match_reason:'sportsbase_only' }

  const freshness = compareProviderFreshness(sportsbase, wyscout)
  const primary = freshness.primary === 'wyscout' ? wyscout : sportsbase
  const secondary = freshness.primary === 'wyscout' ? sportsbase : wyscout
  const primarySource = freshness.primary
  const secondarySource = primarySource === 'wyscout' ? 'sportsbase' : 'wyscout'
  const keys = new Set([...Object.keys(sportsbase), ...Object.keys(wyscout)])
  const fused = {}
  const fieldSources = {}
  const fallbacks = []
  const conflicts = []

  for (const key of keys) {
    if (key.startsWith('_') && !['_canonical_id','_video_url','_ogol_url'].includes(key)) continue
    let selected
    if (STATIC_KEYS.has(key) || IDENTITY_KEYS.has(key)) selected = preferredStaticValue(key, sportsbase, wyscout, freshness)
    else if (OBJECTIVE_TOTAL_KEYS.has(key)) selected = preferredObjectiveTotal(key, sportsbase, wyscout, freshness)
    else if (hasProviderValue(primary?.[key])) selected = { value:primary[key], source:primarySource }
    else if (hasProviderValue(secondary?.[key])) {
      selected = { value:secondary[key], source:secondarySource }
      fallbacks.push(key)
    } else selected = { value:null, source:null }

    if (selected.source) {
      fused[key] = selected.value
      fieldSources[key] = selected.source
    }

    if (hasProviderValue(sportsbase?.[key]) && hasProviderValue(wyscout?.[key])) {
      const a = sportsbase[key]
      const b = wyscout[key]
      if (typeof a === 'number' && typeof b === 'number') {
        const scale = Math.max(1, Math.abs(a), Math.abs(b))
        if (Math.abs(a-b) / scale > .18) conflicts.push(key)
      } else if (normalize(a) !== normalize(b) && !STATIC_KEYS.has(key)) conflicts.push(key)
    }
  }

  recalcRateFields(fused, fieldSources)

  const sbFields = Object.keys(sportsbase).filter(key=>!key.startsWith('_') && hasProviderValue(sportsbase[key])).length
  const wyFields = Object.keys(wyscout).filter(key=>!key.startsWith('_') && hasProviderValue(wyscout[key])).length
  const fusedFields = Object.keys(fused).filter(key=>!key.startsWith('_') && hasProviderValue(fused[key])).length

  return {
    ...fused,
    _fonte:'combined',
    _modelo:'cic-player-data-fusion-v9',
    _source_coverage:2,
    _fresh_source:freshness.primary,
    _freshness_reason:freshness.reason,
    _freshness_weights:{ sportsbase:freshness.sportsbase, wyscout:freshness.wyscout },
    _field_sources:fieldSources,
    _fallback_fields:fallbacks,
    _conflict_fields:[...new Set(conflicts)],
    _match_quality:matchQuality,
    _match_reason:matchReason,
    _provider_names:{ sportsbase:sportsbase.nome || null, wyscout:wyscout.nome || null },
    _provider_field_counts:{ sportsbase:sbFields, wyscout:wyFields, fused:fusedFields },
    _source_scores:null,
  }
}

export function mergeProviderDatasets(sportsbasePlayers = [], wyscoutPlayers = []) {
  const pairs = pairProviderPlayers(sportsbasePlayers, wyscoutPlayers)
  const players = pairs.map(pair=>fusePlayerRecords(pair.sportsbase,pair.wyscout,pair.matchQuality,pair.matchReason)).filter(Boolean)
  const paired = pairs.filter(pair=>pair.sportsbase && pair.wyscout)
  const fresher = paired.reduce((acc,pair)=>{
    const source = compareProviderFreshness(pair.sportsbase,pair.wyscout).primary
    acc[source] = (acc[source] || 0) + 1
    return acc
  }, { sportsbase:0, wyscout:0 })
  const highConfidence = paired.filter(pair=>Number(pair.matchQuality) >= .8).length
  return {
    players,
    quality:{
      paired:paired.length,
      high_confidence_paired:highConfidence,
      sportsbase_only:pairs.filter(pair=>pair.sportsbase && !pair.wyscout).length,
      wyscout_only:pairs.filter(pair=>!pair.sportsbase && pair.wyscout).length,
      ambiguous:pairs.filter(pair=>pair.sportsbase && !pair.wyscout && String(pair.matchReason || '').startsWith('ambiguous_or_low_confidence')).length,
      fresher,
      conflicts:players.reduce((sum,player)=>sum+(player._conflict_fields?.length||0),0),
      fallback_fields:players.reduce((sum,player)=>sum+(player._fallback_fields?.length||0),0),
      model:'identity-resolution-v9',
    },
  }
}
