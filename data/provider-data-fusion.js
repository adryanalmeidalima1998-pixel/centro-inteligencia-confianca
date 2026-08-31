import { buildPlayerIdentity } from '@/app/lib/playerMaster'

const STATIC_KEYS = new Set([
  'nome','idade','altura','peso','pais','nacionalidade','naturalidade','pe','pe_original','pe_fonte',
  'posicao','grupo_posicional','data_nascimento','nascimento','ano_nascimento','valor_mercado','contrato_termina','emprestado',
])

const IDENTITY_KEYS = new Set(['nome','idade','pais','nacionalidade','posicao','equipa','time','clube'])

const OBJECTIVE_CUMULATIVE_KEYS = new Set([
  'gols','assistencias','gols_sem_penalti','gols_cabeca',
  'amarelos','vermelhos','gols_sofridos','clean_sheets','penaltis_marcados',
])

const DERIVED_RATE_FROM_TOTAL = {
  gols_90:'gols',
  assistencias_90:'assistencias',
  gols_sem_penalti_90:'gols_sem_penalti',
  gols_cabeca_90:'gols_cabeca',
  amarelos_90:'amarelos',
  vermelhos_90:'vermelhos',
  gols_sofridos_90:'gols_sofridos',
}

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

export function hasProviderValue(value) {
  if (value === null || value === undefined || value === '' || value === '-') return false
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

function normalizedTeam(value) {
  const stop = new Set(['fc','ec','se','sc','saf','club','clube','futebol','esporte'])
  return normalize(value).split(' ').filter(token => token && !stop.has(token)).join(' ')
}

function teamSimilarity(a, b) {
  const left = normalizedTeam(a)
  const right = normalizedTeam(b)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return .88
  const aTokens = new Set(left.split(' '))
  const bTokens = new Set(right.split(' '))
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length
  const union = new Set([...aTokens, ...bTokens]).size
  return union ? intersection / union : 0
}

function primaryPosition(value) {
  return normalize(String(value || '').split(',')[0])
}

function identityCompatibility(a = {}, b = {}) {
  if (normalize(a.nome) !== normalize(b.nome)) return -Infinity
  let score = 3
  const ageA = numeric(a.idade)
  const ageB = numeric(b.idade)
  if (ageA !== null && ageB !== null) {
    const diff = Math.abs(ageA - ageB)
    if (diff === 0) score += 4
    else if (diff === 1) score += 2
    else return -Infinity
  }
  const natA = normalize(a.pais || a.nacionalidade)
  const natB = normalize(b.pais || b.nacionalidade)
  if (natA && natB) score += natA === natB ? 2 : -1
  const posA = primaryPosition(a.posicao)
  const posB = primaryPosition(b.posicao)
  if (posA && posB) score += posA === posB ? 2 : 0
  const team = teamSimilarity(a.equipa || a.time || a.clube, b.equipa || b.time || b.clube)
  score += team * 3
  return score
}

function exactIdentity(player = {}) {
  return buildPlayerIdentity(player).identityKey || ''
}

export function pairProviderPlayers(sportsbasePlayers = [], wyscoutPlayers = []) {
  const wyscoutUnused = new Set(wyscoutPlayers.map((_, index) => index))
  const wyscoutByIdentity = new Map()
  const wyscoutByName = new Map()

  wyscoutPlayers.forEach((player, index) => {
    const identity = exactIdentity(player)
    if (identity) {
      const list = wyscoutByIdentity.get(identity) || []
      list.push(index)
      wyscoutByIdentity.set(identity, list)
    }
    const name = normalize(player.nome)
    const byName = wyscoutByName.get(name) || []
    byName.push(index)
    wyscoutByName.set(name, byName)
  })

  const pairs = []
  for (const sportsbase of sportsbasePlayers) {
    let matchIndex = null
    let matchQuality = 0
    const identity = exactIdentity(sportsbase)
    const exact = (wyscoutByIdentity.get(identity) || []).filter(index => wyscoutUnused.has(index))

    if (exact.length === 1) {
      const score = identityCompatibility(sportsbase, wyscoutPlayers[exact[0]])
      if (score >= 8) {
        matchIndex = exact[0]
        matchQuality = score >= 10 ? 1 : .96
      }
    } else if (exact.length > 1) {
      const scored = exact.map(index => ({ index, score:identityCompatibility(sportsbase, wyscoutPlayers[index]) }))
        .sort((a,b)=>b.score-a.score)
      if (scored[0]?.score >= 5) {
        matchIndex = scored[0].index
        matchQuality = .96
      }
    } else {
      const nameMatches = (wyscoutByName.get(normalize(sportsbase.nome)) || []).filter(index => wyscoutUnused.has(index))
      const scored = nameMatches.map(index => ({ index, score:identityCompatibility(sportsbase, wyscoutPlayers[index]) }))
        .filter(item => Number.isFinite(item.score))
        .sort((a,b)=>b.score-a.score)
      if (scored[0]?.score >= 6 && (!scored[1] || scored[0].score - scored[1].score >= 1.5)) {
        matchIndex = scored[0].index
        matchQuality = scored[0].score >= 9 ? .94 : .86
      }
    }

    if (matchIndex !== null) {
      wyscoutUnused.delete(matchIndex)
      pairs.push({ sportsbase, wyscout:wyscoutPlayers[matchIndex], matchQuality })
    } else {
      pairs.push({ sportsbase, wyscout:null, matchQuality:0 })
    }
  }

  for (const index of wyscoutUnused) pairs.push({ sportsbase:null, wyscout:wyscoutPlayers[index], matchQuality:0 })
  return pairs
}

function parsedTimestamp(value) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0
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
    staleFactor = gap >= 3 ? .30 : gap === 2 ? .45 : .62
    reason = `${gap} jogo(s) de diferença`
  } else if (sm !== null && wm !== null && Math.abs(sm - wm) >= 45) {
    const gap = Math.abs(sm - wm)
    primary = wm > sm ? 'wyscout' : 'sportsbase'
    staleFactor = gap >= 270 ? .48 : gap >= 180 ? .58 : gap >= 90 ? .70 : .84
    reason = `${Math.round(gap)} minutos de diferença`
  } else {
    const cumulativeSignals = ['gols','assistencias']
      .map(key => ({ sportsbase:numeric(sportsbase[key]), wyscout:numeric(wyscout[key]) }))
      .filter(item => item.sportsbase !== null && item.wyscout !== null && item.sportsbase !== item.wyscout)
    const sportsbaseAhead = cumulativeSignals.filter(item => item.sportsbase > item.wyscout).length
    const wyscoutAhead = cumulativeSignals.filter(item => item.wyscout > item.sportsbase).length
    if (wyscoutAhead > 0 && sportsbaseAhead === 0) {
      primary = 'wyscout'
      staleFactor = .86
      reason = 'eventos acumulados mais completos no Wyscout'
    } else if (sportsbaseAhead > 0 && wyscoutAhead === 0) {
      primary = 'sportsbase'
      staleFactor = .86
      reason = 'eventos acumulados mais completos no Sportsbase'
    } else if (su && wu && su !== wu) {
      primary = wu > su ? 'wyscout' : 'sportsbase'
      staleFactor = .94
      reason = 'upload mais recente sem diferença de amostra'
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


function chooseObjectiveCumulative(key, sportsbase, wyscout, freshness) {
  const sb = numeric(sportsbase?.[key])
  const wy = numeric(wyscout?.[key])
  if (sb !== null && wy !== null) {
    if (wy > sb) return { value:wyscout[key], source:'wyscout' }
    if (sb > wy) return { value:sportsbase[key], source:'sportsbase' }
    const source = freshness.primary === 'wyscout' ? 'wyscout' : 'sportsbase'
    return { value:source === 'wyscout' ? wyscout[key] : sportsbase[key], source }
  }
  if (wy !== null) return { value:wyscout[key], source:'wyscout' }
  if (sb !== null) return { value:sportsbase[key], source:'sportsbase' }
  return { value:null, source:null }
}

function recomputeObjectiveRates(fused, fieldSources) {
  const minutes = numeric(fused.minutos)
  if (!(minutes > 0)) return
  for (const [rateKey,totalKey] of Object.entries(DERIVED_RATE_FROM_TOTAL)) {
    const total = numeric(fused[totalKey])
    if (total === null) continue
    fused[rateKey] = Math.round((total * 90 / minutes) * 10000) / 10000
    const totalSource = fieldSources[totalKey]
    const minuteSource = fieldSources.minutos
    fieldSources[rateKey] = totalSource && minuteSource && totalSource === minuteSource ? totalSource : 'combined'
  }
}

function preferredStaticValue(key, sportsbase, wyscout, freshness) {
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

export function fusePlayerRecords(sportsbase, wyscout, matchQuality = 0) {
  if (!sportsbase && !wyscout) return null
  if (!sportsbase) return { ...wyscout, _fonte:'wyscout', _source_coverage:1, _fresh_source:'wyscout', _field_sources:{} }
  if (!wyscout) return { ...sportsbase, _fonte:'sportsbase', _source_coverage:1, _fresh_source:'sportsbase', _field_sources:{} }

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
    else if (OBJECTIVE_CUMULATIVE_KEYS.has(key)) selected = chooseObjectiveCumulative(key, sportsbase, wyscout, freshness)
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

  recomputeObjectiveRates(fused, fieldSources)

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
    _provider_field_counts:{ sportsbase:sbFields, wyscout:wyFields, fused:fusedFields },
    _source_scores:null,
  }
}

export function mergeProviderDatasets(sportsbasePlayers = [], wyscoutPlayers = []) {
  const pairs = pairProviderPlayers(sportsbasePlayers, wyscoutPlayers)
  const players = pairs.map(pair=>fusePlayerRecords(pair.sportsbase,pair.wyscout,pair.matchQuality)).filter(Boolean)
  const paired = pairs.filter(pair=>pair.sportsbase && pair.wyscout)
  const fresher = paired.reduce((acc,pair)=>{
    const source = compareProviderFreshness(pair.sportsbase,pair.wyscout).primary
    acc[source] = (acc[source] || 0) + 1
    return acc
  }, { sportsbase:0, wyscout:0 })
  return {
    players,
    quality:{
      paired:paired.length,
      sportsbase_only:pairs.filter(pair=>pair.sportsbase && !pair.wyscout).length,
      wyscout_only:pairs.filter(pair=>!pair.sportsbase && pair.wyscout).length,
      fresher,
      conflicts:players.reduce((sum,player)=>sum+(player._conflict_fields?.length||0),0),
      fallback_fields:players.reduce((sum,player)=>sum+(player._fallback_fields?.length||0),0),
    },
  }
}
