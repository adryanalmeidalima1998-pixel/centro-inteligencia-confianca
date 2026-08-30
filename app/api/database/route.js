/**
 * GET /api/database
 * Base canônica de atletas. Leitura sem efeitos colaterais: identidades e níveis
 * são sincronizados automaticamente no upload; a consulta apenas consolida o recorte.
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { resolveGrupo, GRUPOS_POSICOES } from '@/data/iap-profiles'
import { enrichPlayersWithFoot, matchesPlayerFoot } from '@/data/player-foot'
import { calcularIAP, calcularRanking, calcularMediasGrupo } from '@/lib/iap-engine'
import { attachCanonicalPlayers, buildPlayerIdentity, ensurePlayerMaster } from '@/app/lib/playerMaster'
import { competitiveLevelLabel, robustnessFromScore } from '@/data/competitive-levels'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

export const runtime = 'nodejs'
export const maxDuration = 30

const num = (value, fallback = 0) => value === null || value === undefined || value === '' ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback
const DATASET_CACHE = globalThis.__cigDatabaseDatasetCache || new Map()
const MODEL_CACHE = globalThis.__cigDatabaseModelCache || new Map()
if (!globalThis.__cigDatabaseDatasetCache) globalThis.__cigDatabaseDatasetCache = DATASET_CACHE
if (!globalThis.__cigDatabaseModelCache) globalThis.__cigDatabaseModelCache = MODEL_CACHE

function remember(key, value) {
  DATASET_CACHE.set(key, { value, at:Date.now() })
  while (DATASET_CACHE.size > 8) DATASET_CACHE.delete(DATASET_CACHE.keys().next().value)
}

function sourceWeight(player) {
  return (player._fonte === 'sportsbase' ? 5000 : 0) + num(player.minutos) + new Date(player._upload_at || 0).getTime() / 1e12
}

function dedupeCanonical(players = []) {
  const map = new Map()
  for (const player of players) {
    const identityKey = player._identity_key || buildPlayerIdentity(player).identityKey
    const current = map.get(identityKey)
    const context = {
      liga:player._liga, fonte:player._fonte, equipa:player.equipa, posicao:player.posicao,
      minutos:num(player.minutos), jogos:num(player.jogos), upload_at:player._upload_at,
    }
    if (!current) {
      map.set(identityKey, { ...player, _identity_key:identityKey, _contexts:[context] })
      continue
    }
    const contexts = [...(current._contexts || []), context]
    if (sourceWeight(player) > sourceWeight(current)) map.set(identityKey, { ...player, _identity_key:identityKey, _contexts:contexts })
    else current._contexts = contexts
  }
  return [...map.values()]
}

async function sourceCounts(ids = []) {
  if (!ids.length) return new Map()
  try {
    const result = await sql`
      SELECT cig_jogador_id, COUNT(*)::int AS source_count,
        COUNT(DISTINCT league_slug)::int AS league_count,
        COUNT(DISTINCT season)::int AS season_count
      FROM cig_player_sources
      WHERE cig_jogador_id = ANY(${ids})
      GROUP BY cig_jogador_id
    `
    return new Map(result.rows.map(row => [Number(row.cig_jogador_id), row]))
  } catch (_) { return new Map() }
}

async function loadLatestDatasets(selectedLeagues, metaRows) {
  if (!selectedLeagues.length) return { players:[], key:'empty' }
  const key = selectedLeagues.map(slug => {
    const rows = metaRows.filter(row => row.slug === slug)
    return `${slug}:${rows.map(row => `${row.fonte}:${new Date(row.upload_at).getTime()}`).sort().join(',')}`
  }).join('|')
  const cached = DATASET_CACHE.get(key)
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return { players:cached.value, key }

  const result = await sql`
    SELECT DISTINCT ON (slug, fonte) slug, fonte, data, upload_at
    FROM liga_jogadores
    WHERE fonte IN ('sportsbase','wyscout') AND slug = ANY(${selectedLeagues})
    ORDER BY slug, fonte, upload_at DESC
  `
  const byLeague = new Map()
  for (const row of result.rows) {
    if (!byLeague.has(row.slug)) byLeague.set(row.slug, {})
    byLeague.get(row.slug)[row.fonte || 'sportsbase'] = row
  }
  const players = []
  for (const slug of selectedLeagues) {
    const sources = byLeague.get(slug) || {}
    const primary = sources.sportsbase || sources.wyscout
    if (!primary) continue
    const base = primary.fonte === 'sportsbase'
      ? enrichPlayersWithFoot(primary.data || [], sources.wyscout?.data || [], 'wyscout')
      : (primary.data || [])
    players.push(...base.map(player => ({ ...player, _liga:slug, _fonte:primary.fonte, _upload_at:primary.upload_at })))
  }
  remember(key, players)
  return { players, key }
}

function modelDatasets(players, key) {
  const cached = MODEL_CACHE.get(key)
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.value
  const modeled = []
  const buckets = new Map()
  for (const player of players) {
    const resolved = resolveGrupo(player.posicao)
    if (!resolved) {
      modeled.push({ ...player, _grupo:null, _iap_dominante:0, _perfil_dominante:null, _percentis_por_perfil:{} })
      continue
    }
    const bucketKey = `${player._fonte || 'unknown'}|${player._liga || ''}|${resolved}`
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { group:resolved, players:[] })
    buckets.get(bucketKey).players.push(player)
  }
  for (const { group, players:list } of buckets.values()) modeled.push(...calcularRanking(calcularIAP(list, group)))
  MODEL_CACHE.set(key, { value:modeled, at:Date.now() })
  while (MODEL_CACHE.size > 8) MODEL_CACHE.delete(MODEL_CACHE.keys().next().value)
  return modeled
}

export async function GET(req) {
  await ensureLigaJogadoresSchema()
  const { searchParams } = new URL(req.url)
  const liga = searchParams.get('liga') || ''
  const grupo = searchParams.get('grupo') || ''
  const posicao = searchParams.get('posicao') || ''
  const busca = searchParams.get('busca') || ''
  const equipa = searchParams.get('equipa') || ''
  const pe = searchParams.get('pe') || ''
  const pais = searchParams.get('pais') || ''
  const perfilFiltro = searchParams.get('perfil') || ''
  const idadeMin = parseInt(searchParams.get('idadeMin') || '15')
  const idadeMax = parseInt(searchParams.get('idadeMax') || '45')
  const minMin = parseInt(searchParams.get('minMin') || '0')
  const minMax = parseInt(searchParams.get('minMax') || '99999')
  const iapMin = parseInt(searchParams.get('iapMin') || '0')
  const nivelAtualMin = parseFloat(searchParams.get('nivelAtualMin') || '0')
  const nivelPotencialMin = parseFloat(searchParams.get('nivelPotencialMin') || '0')
  const nivelRealMin = parseFloat(searchParams.get('nivelRealMin') || '0')
  const confFiltro = searchParams.get('confiabilidade') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50')))
  const ordenarPor = searchParams.get('ordenarPor') || 'nivel_atual'
  const dir = searchParams.get('dir') || 'desc'

  try {
    await ensurePlayerMaster()
    const meta = await sql`
      SELECT DISTINCT ON (slug, fonte) slug, fonte, upload_at
      FROM liga_jogadores
      WHERE fonte IN ('sportsbase','wyscout')
      ORDER BY slug, fonte, upload_at DESC
    `
    if (!meta.rows.length) return NextResponse.json({ jogadores:[], total:0, ligas:[], pages:1, medias:{} })

    const ligasDisponiveis = [...new Set(meta.rows.map(row => row.slug))].sort()
    const selectedLeagues = liga ? ligasDisponiveis.filter(item => item === liga) : ligasDisponiveis
    const dataset = await loadLatestDatasets(selectedLeagues, meta.rows)
    let todos = [...modelDatasets(dataset.players, dataset.key)]

    if (minMin > 0) todos = todos.filter(player => num(player.minutos) >= minMin)
    if (minMax < 99999) todos = todos.filter(player => num(player.minutos) <= minMax)
    if (idadeMin > 15 || idadeMax < 45) todos = todos.filter(player => !Number.isFinite(Number(player.idade)) || (num(player.idade) >= idadeMin && num(player.idade) <= idadeMax))
    if (busca) {
      const term = busca.toLowerCase()
      todos = todos.filter(player => `${player.nome || ''} ${player.equipa || ''}`.toLowerCase().includes(term))
    }
    if (equipa) todos = todos.filter(player => String(player.equipa || '').toLowerCase().includes(equipa.toLowerCase()))
    if (pe) todos = todos.filter(player => matchesPlayerFoot(player, pe))
    if (pais) todos = todos.filter(player => String(player.pais || player.nacionalidade || '').toLowerCase().includes(pais.toLowerCase()))

    let grupoFinal = grupo
    if (posicao && !grupo) grupoFinal = resolveGrupo(posicao) || ''
    if (grupoFinal) {
      const allowed = GRUPOS_POSICOES[grupoFinal] || []
      todos = todos.filter(player => String(player.posicao || '').split(',').map(item => item.trim()).some(item => allowed.includes(item)))
    } else if (posicao) {
      const codes = posicao.split(',').map(item => item.trim())
      todos = todos.filter(player => String(player.posicao || '').split(',').map(item => item.trim()).some(item => codes.includes(item)))
    }

    let calculated = dedupeCanonical(todos)
    calculated = await attachCanonicalPlayers(calculated)

    if (iapMin > 0) calculated = calculated.filter(player => num(player._iap_dominante) >= iapMin)
    if (nivelAtualMin > 0) calculated = calculated.filter(player => num(player._nivel_atual_score) >= nivelAtualMin)
    if (nivelPotencialMin > 0) calculated = calculated.filter(player => num(player._nivel_potencial_score) >= nivelPotencialMin)
    if (nivelRealMin > 0) calculated = calculated.filter(player => num(player._nivel_real_score, 0) >= nivelRealMin)
    if (confFiltro) calculated = calculated.filter(player => (player._robustez?.label || robustnessFromScore(player._nivel_confianca).label) === confFiltro)
    if (perfilFiltro) calculated = calculated.filter(player => player._perfil_dominante === perfilFiltro)

    const sortValue = player => {
      if (ordenarPor === 'nivel_recomendado') return num(player._nivel_recomendado_score, -1)
      if (ordenarPor === 'nivel_real') return num(player._nivel_real_score, -1)
      if (ordenarPor === 'nivel_potencial') return num(player._nivel_potencial_score, -1)
      if (ordenarPor === 'nivel_comprovado') return num(player._nivel_comprovado_score, -1)
      if (ordenarPor === 'iap') return num(player._iap_dominante)
      if (ordenarPor === 'minutos') return num(player.minutos)
      if (ordenarPor === 'idade') return num(player.idade)
      return num(player._nivel_atual_score, -1)
    }
    calculated.sort((a, b) => dir === 'asc' ? sortValue(a) - sortValue(b) : sortValue(b) - sortValue(a))

    const total = calculated.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const paginated = calculated.slice((page - 1) * limit, page * limit)
    const counts = await sourceCounts(paginated.map(player => Number(player._canonical_id)).filter(Boolean))
    const resultado = paginated.map(player => {
      const count = counts.get(Number(player._canonical_id)) || {}
      return {
        ...player,
        _percentis_dominante:player._perfil_dominante ? player._percentis_por_perfil?.[player._perfil_dominante] || {} : {},
        _nivel_recomendado:player._nivel_recomendado || competitiveLevelLabel(player._nivel_recomendado_score),
        _nivel_real:player._nivel_real_score === null || player._nivel_real_score === undefined ? null : (player._nivel_real || competitiveLevelLabel(player._nivel_real_score)),
        _nivel_atual:player._nivel_atual || competitiveLevelLabel(player._nivel_atual_score),
        _nivel_potencial:player._nivel_potencial || competitiveLevelLabel(player._nivel_potencial_score),
        _nivel_comprovado:player._nivel_comprovado_score ? (player._nivel_comprovado || competitiveLevelLabel(player._nivel_comprovado_score)) : null,
        _source_count:count.source_count || player._contexts?.length || 1,
        _league_count:count.league_count || new Set((player._contexts || []).map(item => item.liga)).size || 1,
        _season_count:count.season_count || 1,
      }
    })

    const response = NextResponse.json({
      jogadores:resultado, total, page, pages, ligas:ligasDisponiveis,
      medias:calcularMediasGrupo(todos), grupoAtivo:grupoFinal || null,
      methodology:'Faixas S–E internas à própria liga, temporada, posição e perfil. O índice bruto é ajustado pela robustez; a faixa validada pelo scout prevalece sobre a automática.',
    })
    response.headers.set('Cache-Control', 'private, max-age=20, stale-while-revalidate=120')
    return response
  } catch (error) {
    console.error('[api/database]', error)
    return NextResponse.json({ error:error.message }, { status:500 })
  }
}
