import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { enrichPlayersWithFoot, getPlayerFoot } from '@/data/player-foot'
import { buildPlayerIdentity, getCanonicalByIdentityKeys } from '@/app/lib/playerMaster'
import { buildSportsbaseRolePools } from '@/data/sportsbase-selection'
import { buildWyscoutRolePools } from '@/data/wyscout-selection'
import { normalizeSportsbasePosition, SPORTSBASE_POSITION_GROUPS } from '@/data/sportsbase-map'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_HIGHLIGHTS = 8
const NO_STORE_HEADERS = {
  'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
  Pragma:'no-cache',
  Expires:'0',
}

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers:{ ...NO_STORE_HEADERS, ...(init.headers || {}) },
  })
}

const GENERIC_CB_GROUP = { id:'CB', label:'Zagueiros', shortLabel:'ZAG', color:'#2563eb', roles:['CBL','CBR'], profile:'Zagueiro' }

const GROUPS = [
  { id:'GK', label:'Goleiros', shortLabel:'GOL', color:'#d97706', roles:['GK'] },
  { id:'CB_LEFT_FOOT', label:'Zagueiros canhotos', shortLabel:'ZAG-E', color:'#2563eb', roles:['CBL','CBR'], profile:'Zagueiro canhoto' },
  { id:'CB_RIGHT_FOOT', label:'Zagueiros destros', shortLabel:'ZAG-D', color:'#1d4ed8', roles:['CBL','CBR'], profile:'Zagueiro destro' },
  { id:'LB', label:'Laterais esquerdos', shortLabel:'LAT-E', color:'#0891b2', roles:['LB'], profile:'Lateral esquerdo' },
  { id:'RB', label:'Laterais direitos', shortLabel:'LAT-D', color:'#0e7490', roles:['RB'], profile:'Lateral direito' },
  { id:'DM', label:'Primeiros volantes', shortLabel:'1º VOL', color:'#7c3aed', roles:['DM'], profile:'Primeiro volante' },
  { id:'CM', label:'Segundos volantes', shortLabel:'2º VOL', color:'#6d28d9', roles:['CM'], profile:'Segundo volante' },
  { id:'AM', label:'Meias', shortLabel:'MEI', color:'#0f766e', roles:['AM'], profile:'Meia ofensivo' },
  { id:'WG', label:'Atacantes', shortLabel:'ATA', color:'#db2777', roles:['LW','RW'] },
  { id:'ST', label:'Atacantes', shortLabel:'ATA', color:'#dc2626', roles:['CF'] },
]

const POSITION_ALIASES = {
  GK:['GK','G','GOL','GOLEIRO','GOALKEEPER','GUARDA-REDES','GUARDA REDES'],
  CB:['CB','LCB','RCB','CD','LCD','RCD','ZAG','ZAGUEIRO','DEFESA CENTRAL','CENTRAL DEFENDER'],
  LB:['LB','LWB','LE','LAT E','LATERAL ESQUERDO','ALA ESQUERDO','LEFT BACK','LEFT WING BACK'],
  RB:['RB','RWB','LD','LAT D','LATERAL DIREITO','ALA DIREITO','RIGHT BACK','RIGHT WING BACK'],
  DM:['DMF','LDMF','RDMF','CDM','LCDM','RCDM','LDM','RDM','VOL','VOLANTE','PRIMEIRO VOLANTE','DEFENSIVE MIDFIELDER','HOLDING MIDFIELDER'],
  CM:['CM','LCM','RCM','CMF','LCMF','RCMF','MC','MEIO CAMPISTA CENTRAL','MEDIO CENTRO','CENTRAL MIDFIELDER','SEGUNDO VOLANTE'],
  AM:['AMF','CAM','LCAM','RCAM','LM','RM','LMF','RMF','MEI','MEIA','MEIA OFENSIVO','MEDIO OFENSIVO','ATTACKING MIDFIELDER'],
}

let ensureTablePromise = null

async function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS liga_destaques (
          id SERIAL PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          source TEXT DEFAULT 'auto',
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await sql`ALTER TABLE liga_destaques ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'auto'`
      await sql`ALTER TABLE liga_destaques ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`
      await sql`ALTER TABLE liga_destaques ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`
    })().catch(error => {
      ensureTablePromise = null
      throw error
    })
  }
  return ensureTablePromise
}

async function latestDataset(slug, source) {
  const result = await sql`
    SELECT data, upload_at
    FROM liga_jogadores
    WHERE slug = ${slug} AND fonte = ${source}
    ORDER BY upload_at DESC
    LIMIT 1
  `
  return result.rows[0] || null
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function playerKey(player) {
  const identity = buildPlayerIdentity(player).identityKey
  return `${identity}|${normalize(player.equipa || player.time || player.clube)}`
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(number(value) * factor) / factor
}

function positionTokens(value) {
  const normalized = normalizeSportsbasePosition(value)
  const tokens = normalized.split(/[,/;|]+/).map(normalizePositionToken).filter(Boolean)
  if (tokens.length) return tokens
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[,/;|]+/)
    .map(normalizePositionToken)
    .filter(Boolean)
}

function normalizePositionToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function primaryPosition(value) {
  return positionTokens(value)[0] || ''
}

function primaryPositionIs(value, aliases = []) {
  return aliases.includes(primaryPosition(value))
}

function isCentreBack(player) {
  return primaryPositionIs(player.posicao, POSITION_ALIASES.CB)
}

function matchesHighlightGroup(player, groupId) {
  if (groupId === 'CB') return isCentreBack(player)
  if (groupId === 'CB_LEFT_FOOT') return isCentreBack(player) && getPlayerFoot(player) === 'esquerdo'
  if (groupId === 'CB_RIGHT_FOOT') return isCentreBack(player) && getPlayerFoot(player) === 'direito'
  if (groupId === 'LB') return primaryPositionIs(player.posicao, POSITION_ALIASES.LB)
  if (groupId === 'RB') return primaryPositionIs(player.posicao, POSITION_ALIASES.RB)
  if (groupId === 'DM') return primaryPositionIs(player.posicao, POSITION_ALIASES.DM)
  if (groupId === 'CM') return primaryPositionIs(player.posicao, POSITION_ALIASES.CM)
  if (groupId === 'AM') return primaryPositionIs(player.posicao, POSITION_ALIASES.AM)
  return highlightPositionGroup(player.posicao) === groupId
}


function highlightPositionGroup(value) {
  const tokens = positionTokens(value)
  if (tokens.some(token => POSITION_ALIASES.GK.includes(token))) return 'GK'
  return Object.entries(SPORTSBASE_POSITION_GROUPS)
    .find(([, group]) => tokens.some(token => group.positions.includes(token)))?.[0] || null
}

function highlightGroupsForPlayers(players = [], source = 'sportsbase') {
  if (source !== 'sportsbase') return GROUPS

  const centreBacks = players.filter(isCentreBack)
  const hasUnknownCentreBackFoot = centreBacks.some(player => getPlayerFoot(player) === 'unknown')
  if (!hasUnknownCentreBackFoot) return GROUPS

  // O export Sportsbase pode não trazer pé dominante. Nesse cenário, não se pode
  // excluir os zagueiros nem inferir canhoto/destro. Usamos um único card neutro
  // de zagueiros e mantemos a divisão por pé quando a informação está completa.
  return [GROUPS[0], GENERIC_CB_GROUP, ...GROUPS.slice(3)]
}

function fallbackScore(player, maxIndex, maxMinutes) {
  const index = number(player.indice, null)
  if (index !== null && maxIndex > 0) {
    const normalized = index <= 100 ? index : (index / maxIndex) * 100
    return Math.max(35, Math.min(99, normalized))
  }
  const minutes = number(player.minutos)
  return Math.max(35, Math.min(84, 45 + (minutes / Math.max(1, maxMinutes)) * 39))
}

function compactPlayer(player, overrides = {}) {
  const score = round(overrides.score ?? player._score ?? player._performance_score ?? player.indice ?? 0)
  const strengths = Array.isArray(player._strengths) ? player._strengths : []
  const strongest = strengths[0]?.label || overrides.strongest || null
  return {
    key:playerKey(player),
    identityKey:buildPlayerIdentity(player).identityKey,
    nome:player.nome || 'Atleta',
    equipa:player.equipa || player.time || player.clube || 'Sem equipe',
    posicao:player.posicao || '',
    pe:getPlayerFoot(player),
    idade:number(player.idade, null),
    minutos:Math.round(number(player.minutos)),
    jogos:Math.round(number(player.jogos)),
    score,
    performance:round(player._performance_score ?? score),
    coverage:Math.round(number(player._coverage, 0)),
    profile:overrides.profile || player._perfil_dominante || player._role_label || 'Destaque estatístico',
    strongest,
    source:player._fonte || null,
    canonicalId:player._canonical_id || null,
    videoUrl:player._video_url || player.video_url || null,
    ogolUrl:player._ogol_url || player.ogol_url || null,
  }
}

function mergeRoleCandidates(rolePools, roles, group) {
  const map = new Map()
  for (const role of roles) {
    for (const player of rolePools?.[role]?.ranked || []) {
      if (!matchesHighlightGroup(player, group.id)) continue
      const key = playerKey(player)
      const current = map.get(key)
      const candidate = compactPlayer(player, { profile:group.profile || player._role_label || current?.profile })
      if (!current || candidate.score > current.score) map.set(key, candidate)
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score || b.minutos - a.minutos)
}

function buildHighlights(players, source) {
  const highlightGroups = highlightGroupsForPlayers(players, source)
  const pools = source === 'wyscout'
    ? buildWyscoutRolePools(players).rolePools
    : buildSportsbaseRolePools(players).rolePools

  const maxIndex = Math.max(0, ...players.map(player => number(player.indice)))
  const maxMinutes = Math.max(1, ...players.map(player => number(player.minutos)))

  return highlightGroups.map(group => {
    const ranked = mergeRoleCandidates(pools, group.roles, group)
    const used = new Set(ranked.map(player => player.key))
    const fallback = players
      .filter(player => matchesHighlightGroup(player, group.id))
      .map(player => compactPlayer(player, {
        score:fallbackScore(player, maxIndex, maxMinutes),
        profile:group.profile || player._perfil_dominante || (group.id === 'GK' ? 'Goleiro' : 'Destaque da posição'),
      }))
      .filter(player => !used.has(player.key))
      .sort((a, b) => b.score - a.score || b.minutos - a.minutos)

    const candidates = [...ranked, ...fallback]
    return {
      ...group,
      automatic:candidates.slice(0, MAX_HIGHLIGHTS),
      candidates:candidates.slice(0, 160),
    }
  })
}

function buildAllCandidates(players, groups) {
  const maxIndex = Math.max(0, ...players.map(player => number(player.indice)))
  const maxMinutes = Math.max(1, ...players.map(player => number(player.minutos)))
  const map = new Map()

  for (const group of groups || []) {
    for (const player of group.candidates || []) {
      const current = map.get(player.key)
      if (!current || number(player.score) > number(current.score)) map.set(player.key, player)
    }
  }

  for (const player of players || []) {
    const candidate = compactPlayer(player, {
      score:fallbackScore(player, maxIndex, maxMinutes),
      profile:player._perfil_dominante || player._role_label || 'Destaque estatístico',
    })
    if (!map.has(candidate.key)) map.set(candidate.key, candidate)
  }

  return [...map.values()]
    .sort((a, b) => b.score - a.score || b.minutos - a.minutos || a.nome.localeCompare(b.nome, 'pt-BR'))
}

async function attachPlayerLinks(players) {
  if (!players.length) return players
  const identities = players.map(player => buildPlayerIdentity(player))
  const map = await getCanonicalByIdentityKeys([...new Set(identities.map(item => item.identityKey))])
  return players.map((player, index) => {
    const canonical = map.get(identities[index].identityKey)
    return {
      ...player,
      _canonical_id:canonical?.id || player._canonical_id || null,
      _video_url:canonical?.video_url || null,
      _ogol_url:canonical?.ogol_url || null,
    }
  })
}

function resolveSource(slug, requested, savedSource, sportsbase, wyscout) {
  if (requested === 'sportsbase' && sportsbase) return 'sportsbase'
  if (requested === 'wyscout' && wyscout) return 'wyscout'

  // A Série D é operada com o export Wyscout. No modo automático, essa fonte
  // deve prevalecer mesmo que exista uma importação Sportsbase antiga.
  if (requested === 'auto' && slug === 'brasileirao-serie-d' && wyscout) return 'wyscout'

  if (requested === 'auto' && savedSource === 'wyscout' && wyscout) return 'wyscout'
  if (requested === 'auto' && savedSource === 'sportsbase' && sportsbase) return 'sportsbase'
  return sportsbase ? 'sportsbase' : wyscout ? 'wyscout' : null
}

function savedEntryObject(entry) {
  if (typeof entry === 'string') return { key:entry }
  if (!entry || typeof entry !== 'object') return null
  return entry
}

function nameTeamKey(player) {
  return `${normalize(player?.nome)}|${normalize(player?.equipa || player?.time || player?.clube)}`
}

function savedSnapshot(entry) {
  if (!entry?.nome) return null
  return {
    key:String(entry.key || `${entry.identityKey || normalize(entry.nome)}|${normalize(entry.equipa)}`),
    identityKey:entry.identityKey || null,
    nome:String(entry.nome),
    equipa:String(entry.equipa || 'Sem equipe'),
    posicao:String(entry.posicao || ''),
    pe:getPlayerFoot(entry),
    idade:number(entry.idade, null),
    minutos:Math.round(number(entry.minutos)),
    jogos:Math.round(number(entry.jogos)),
    score:round(entry.score),
    performance:round(entry.performance ?? entry.score),
    coverage:Math.round(number(entry.coverage)),
    profile:entry.profile || 'Destaque estatístico',
    strongest:entry.strongest || null,
    source:entry.source || null,
    canonicalId:entry.canonicalId || null,
    videoUrl:entry.videoUrl || null,
    ogolUrl:entry.ogolUrl || null,
    savedSnapshot:true,
  }
}

function resolveSavedPlayer(entry, allCandidates) {
  const saved = savedEntryObject(entry)
  if (!saved) return null

  const candidates = allCandidates || []
  if (saved.key) {
    const exact = candidates.find(player => player.key === saved.key)
    if (exact) return exact
  }
  if (saved.canonicalId) {
    const canonical = candidates.find(player => player.canonicalId && player.canonicalId === saved.canonicalId)
    if (canonical) return canonical
  }
  if (saved.identityKey) {
    const identity = candidates.find(player => player.identityKey && player.identityKey === saved.identityKey)
    if (identity) return identity
  }
  if (saved.nome) {
    const byNameAndTeam = candidates.find(player => nameTeamKey(player) === nameTeamKey(saved))
    if (byNameAndTeam) return byNameAndTeam
    const sameName = candidates.filter(player => normalize(player.nome) === normalize(saved.nome))
    if (sameName.length === 1) return sameName[0]
  }

  // A curadoria manual pode posicionar qualquer atleta em qualquer card.
  // Quando o atleta não estiver mais na base atual, preserva-se o snapshot salvo.
  return savedSnapshot(saved)
}

function legacyMidfieldEntries(savedGroups, groupId) {
  const defensive = Array.isArray(savedGroups.DM) ? savedGroups.DM : []
  const advanced = Array.isArray(savedGroups.AM) ? savedGroups.AM : []
  const combined = [...defensive, ...advanced]
  const seen = new Set()

  return combined.filter(entry => {
    const saved = savedEntryObject(entry)
    if (!saved || !matchesHighlightGroup(saved, groupId)) return false
    const dedupeKey = saved.key || saved.identityKey || nameTeamKey(saved)
    if (dedupeKey && seen.has(dedupeKey)) return false
    if (dedupeKey) seen.add(dedupeKey)
    return true
  })
}

function savedEntriesForGroup(savedData, savedGroups, groupId) {
  const current = Array.isArray(savedGroups[groupId]) ? savedGroups[groupId] : []
  const version = number(savedData?.version, 0)

  // Versões anteriores reuniam primeiro/segundo volante no mesmo card e também
  // juntavam meia central com meia ofensivo. A migração é feita apenas uma vez;
  // depois da primeira gravação na versão 4, a curadoria fica totalmente livre.
  if (version < 4 && ['DM','CM','AM'].includes(groupId)) {
    const migrated = legacyMidfieldEntries(savedGroups, groupId)
    return migrated.length ? migrated : current
  }

  return current
}

function resolveSelection(groups, allCandidates, savedData, source) {
  const savedGroups = savedData?.source === source ? savedData.groups || {} : {}
  const selection = {}
  for (const group of groups) {
    const entries = savedEntriesForGroup(savedData, savedGroups, group.id)
    const chosen = []
    const used = new Set()
    for (const entry of entries) {
      const player = resolveSavedPlayer(entry, allCandidates)
      if (!player || used.has(player.key)) continue
      chosen.push(player)
      used.add(player.key)
      if (chosen.length >= MAX_HIGHLIGHTS) break
    }
    const completed = [...chosen, ...group.automatic.filter(player => !used.has(player.key))].slice(0, MAX_HIGHLIGHTS)
    selection[group.id] = completed
  }
  return selection
}

function serializeSavedPlayer(entry) {
  if (typeof entry === 'string') return { key:entry }
  if (!entry || typeof entry !== 'object') return null
  return {
    key:String(entry.key || ''),
    identityKey:entry.identityKey || null,
    canonicalId:entry.canonicalId || null,
    nome:entry.nome || null,
    equipa:entry.equipa || null,
    posicao:entry.posicao || null,
    pe:getPlayerFoot(entry),
    idade:number(entry.idade, null),
    minutos:Math.round(number(entry.minutos)),
    jogos:Math.round(number(entry.jogos)),
    score:round(entry.score),
    performance:round(entry.performance ?? entry.score),
    coverage:Math.round(number(entry.coverage)),
    profile:entry.profile || null,
    strongest:entry.strongest || null,
    source:entry.source || null,
    videoUrl:entry.videoUrl || null,
    ogolUrl:entry.ogolUrl || null,
  }
}

export async function GET(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    await ensureTable()
    const [sportsbase, wyscout, savedResult] = await Promise.all([
      latestDataset(slug, 'sportsbase'),
      latestDataset(slug, 'wyscout'),
      sql`SELECT source, data, updated_at FROM liga_destaques WHERE slug = ${slug} LIMIT 1`,
    ])

    const saved = savedResult.rows[0] || null
    const requested = new URL(request.url).searchParams.get('source') || 'auto'
    const source = resolveSource(slug, requested, saved?.source, sportsbase, wyscout)

    if (!source) {
      return noStoreJson({
        source:null,
        available_sources:{ sportsbase:false, wyscout:false },
        groups:GROUPS.map(group => ({ ...group, automatic:[], candidates:[] })),
        all_candidates:[],
        selection:Object.fromEntries(GROUPS.map(group => [group.id, []])),
        saved:false,
        updated_at:null,
        max_highlights:MAX_HIGHLIGHTS,
      })
    }

    const raw = source === 'sportsbase'
      ? enrichPlayersWithFoot(sportsbase.data || [], wyscout?.data || [], 'wyscout')
      : (wyscout.data || [])
    const basePlayers = raw.map(player => ({ ...player, _liga:slug, _fonte:source }))
    const players = await attachPlayerLinks(basePlayers)
    const groups = buildHighlights(players, source)
    const allCandidates = buildAllCandidates(players, groups)
    const savedData = saved?.data && typeof saved.data === 'object' ? saved.data : {}

    return noStoreJson({
      source,
      available_sources:{ sportsbase:Boolean(sportsbase), wyscout:Boolean(wyscout) },
      groups,
      all_candidates:allCandidates,
      selection:resolveSelection(groups, allCandidates, savedData, source),
      saved:Boolean(saved && savedData?.source === source && savedData?.groups),
      updated_at:saved?.updated_at || null,
      total_players:players.length,
      upload_at:(source === 'sportsbase' ? sportsbase : wyscout)?.upload_at || null,
      max_highlights:MAX_HIGHLIGHTS,
      methodology:`Até ${MAX_HIGHLIGHTS} destaques por posição com score funcional ${source === 'wyscout' ? 'Wyscout' : 'Sportsbase'}, percentis das métricas do dashboard, adequação posicional e robustez da amostra. A classificação automática separa primeiros volantes (DM/CDM) de segundos volantes (CM), mantém os meias ofensivos em um card próprio e laterais pela posição principal. Para zagueiros, a divisão por pé só é usada quando essa informação está disponível para todos os zagueiros do recorte; se o Sportsbase não trouxer pé dominante, todos entram em um card único de Zagueiros, sem inferência de canhoto/destro. Na curadoria manual, qualquer atleta da competição pode ser inserido em qualquer card e em qualquer colocação. Goleiros sem cobertura estatística completa entram pela posição e pela amostra disponível.`,
    })
  } catch (error) {
    console.error('[league-highlights-get]', error)
    return noStoreJson({ error:error.message }, { status:500 })
  }
}

export async function POST(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    await ensureTable()
    const body = await request.json()
    const source = body?.source === 'wyscout' ? 'wyscout' : 'sportsbase'
    const groups = {}
    const savableGroups = [...GROUPS, GENERIC_CB_GROUP]
    for (const group of savableGroups) {
      const entries = Array.isArray(body?.groups?.[group.id]) ? body.groups[group.id] : []
      const unique = new Map()
      for (const entry of entries) {
        const saved = serializeSavedPlayer(entry)
        if (!saved) continue
        const dedupeKey = saved.key || saved.identityKey || nameTeamKey(saved)
        if (!dedupeKey || unique.has(dedupeKey)) continue
        unique.set(dedupeKey, saved)
        if (unique.size >= MAX_HIGHLIGHTS) break
      }
      groups[group.id] = [...unique.values()]
    }
    const data = { version:4, source, groups, saved_at:new Date().toISOString() }

    await sql`
      INSERT INTO liga_destaques (slug, source, data, updated_at)
      VALUES (${slug}, ${source}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (slug) DO UPDATE SET
        source = EXCLUDED.source,
        data = EXCLUDED.data,
        updated_at = NOW()
    `

    return noStoreJson({ ok:true, source, data, max_highlights:MAX_HIGHLIGHTS })
  } catch (error) {
    console.error('[league-highlights-post]', error)
    return noStoreJson({ error:error.message }, { status:500 })
  }
}

export async function DELETE(_request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    await ensureTable()
    await sql`DELETE FROM liga_destaques WHERE slug = ${slug}`
    return noStoreJson({ ok:true })
  } catch (error) {
    console.error('[league-highlights-delete]', error)
    return noStoreJson({ error:error.message }, { status:500 })
  }
}
