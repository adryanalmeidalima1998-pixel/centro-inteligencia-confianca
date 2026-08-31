/**
 * GET /api/ligas-v2/jogadores
 * Base global de mercado. Carrega somente as ligas solicitadas e permite aplicar
 * o contexto competitivo do Confiança antes de retornar candidatos.
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { SPORTSBASE_METRIC_INDEX } from '@/data/sportsbase-map'
import { enrichPlayersWithFoot, matchesPlayerFoot } from '@/data/player-foot'
import { mergeProviderDatasets } from '@/data/provider-data-fusion'
import { attachCanonicalPlayers } from '@/app/lib/playerMaster'
import { evaluateGuaraniMarketContext, getGuaraniLeagueMarketPolicy } from '@/data/guarani-market-context'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

const SPORTSBASE_DATA_KEYS = [...new Set([
  ...Object.keys(SPORTSBASE_METRIC_INDEX),
  ...Object.values(SPORTSBASE_METRIC_INDEX).map(metric => metric.denominatorKey).filter(Boolean),
])]

const VALID_KEYS = [
  'minutos','jogos','idade','indice','gols','gols_90','xg','xg_90',
  'assistencias','assistencias_90','chances_criadas','chances_criadas_90','participacao_gols_90',
  'remates_90','remates_golo_pct','remates_area_90','conversao_gols_pct',
  'passes_90','passes_pct','passes_chave_90','passes_chave_pct','passes_prog_90','passes_prog_pct',
  'passes_tercofinal_90','passes_tercofinal_pct','passes_area_90','passes_area_pct','assist_remate_90',
  'passes_longos_90','passes_longos_pct','cruzamentos_90','cruzamentos_pct',
  'dribles_90','dribles_pct','dribles_tercofinal_90','dribles_tercofinal_pct','conducoes_90','entradas_terco_conducao_90',
  'duelos_def_90','duelos_def_pct','duelos_of_90','duelos_of_pct','duelos_aereos_90','duelos_aereos_pct',
  'desarmes_90','desarmes_pct','intercecoes_90','recuperacoes_90','recuperacoes_campo_adversario_90',
  'acoes_area_90','acoes_area_pct','perdas_bola_90','perdas_campo_proprio_90','erros_chances_gol_90',
  'amarelos','amarelos_90','vermelhos','vermelhos_90','faltas_90',
  'defesas_pct','gols_sofridos','gols_sofridos_90','clean_sheets','valor_mercado_num',
  ...SPORTSBASE_DATA_KEYS,
]

const GRUPO_MAP = {
  goleiro:['GK'],
  defensor:['CB','LCB','RCB','LB','RB','LWB','RWB'],
  meia:['DMF','CMF','AMF','LMF','RMF','LCMF','RCMF','LDMF','RDMF','CDM','LCDM','RCDM','LDM','RDM','LCM','RCM','CAM','LCAM','RCAM','LM','RM'],
  medio:['DMF','CMF','AMF','LMF','RMF','LCMF','RCMF','LDMF','RDMF','CDM','LCDM','RCDM','LDM','RDM','LCM','RCM','CAM','LCAM','RCAM','LM','RM'],
  extremo:['LWF','RWF','LW','RW','RAMF','LAMF','LAM','RAM'],
  atacante:['CF','LCF','RCF','SS'],
}

const DATA_CACHE = globalThis.__cigLeaguePlayersCache || new Map()
if (!globalThis.__cigLeaguePlayersCache) globalThis.__cigLeaguePlayersCache = DATA_CACHE
let ensureTablePromise = null

function groupPositions(value = '') {
  const key = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return GRUPO_MAP[key] || []
}

async function ensureTable() {
  if (!ensureTablePromise) ensureTablePromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS liga_jogadores (
        id SERIAL PRIMARY KEY, slug TEXT NOT NULL, data JSONB NOT NULL DEFAULT '[]'::jsonb,
        total INTEGER DEFAULT 0, fonte TEXT DEFAULT 'sportsbase', upload_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0`
    await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'sportsbase'`
  })().catch(error => { ensureTablePromise = null; throw error })
  return ensureTablePromise
}

async function loadDatasets(selectedLeagues, metaRows) {
  if (!selectedLeagues.length) return new Map()
  const key = selectedLeagues.map(slug => {
    const rows = metaRows.filter(row => row.slug === slug)
    return `${slug}:${rows.map(row => `${row.fonte}:${new Date(row.upload_at).getTime()}`).sort().join(',')}`
  }).join('|')
  const cached = DATA_CACHE.get(key)
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.value

  const rows = await sql`
    SELECT DISTINCT ON (slug, fonte) slug, fonte, data, upload_at
    FROM liga_jogadores
    WHERE fonte IN ('sportsbase','wyscout') AND slug = ANY(${selectedLeagues})
    ORDER BY slug, fonte, upload_at DESC
  `
  const byLeague = new Map()
  for (const row of rows.rows) {
    if (!byLeague.has(row.slug)) byLeague.set(row.slug, {})
    byLeague.get(row.slug)[row.fonte || 'sportsbase'] = row
  }
  DATA_CACHE.set(key, { value:byLeague, at:Date.now() })
  while (DATA_CACHE.size > 10) DATA_CACHE.delete(DATA_CACHE.keys().next().value)
  return byLeague
}

export async function GET(req) {
  await ensureLigaJogadoresSchema()
  const { searchParams } = new URL(req.url)
  const busca = searchParams.get('busca') || ''
  const posicao = searchParams.get('posicao') || ''
  const posGrupo = searchParams.get('pos_grupo') || ''
  const equipa = searchParams.get('equipa') || ''
  const liga = searchParams.get('liga') || ''
  const sourceFilter = searchParams.get('fonte') || ''
  const pe = searchParams.get('pe') || ''
  const pais = searchParams.get('pais') || ''
  const minMin = parseInt(searchParams.get('minMin') || '0')
  const idadeMin = parseInt(searchParams.get('idadeMin') || '15')
  const idadeMax = parseInt(searchParams.get('idadeMax') || '45')
  const ordem = searchParams.get('ordem') || 'minutos'
  const dir = searchParams.get('dir') || 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.max(0, Math.min(1000, parseInt(searchParams.get('limit') || '50')))
  const ordemKey = VALID_KEYS.includes(ordem) ? ordem : 'minutos'
  const guaraniContext = ['confianca','guarani'].includes(searchParams.get('contexto'))
  const viableOnly = guaraniContext && searchParams.get('somenteViaveis') !== '0'
  const withCanonical = searchParams.get('canonical') !== '0'

  try {
    await ensureTable()
    const meta = await sql`
      SELECT DISTINCT ON (slug, fonte) slug, fonte, upload_at,
             jsonb_array_length(COALESCE(data, '[]'::jsonb)) AS player_count
      FROM liga_jogadores
      WHERE fonte IN ('sportsbase','wyscout')
      ORDER BY slug, fonte, upload_at DESC
    `

    const byMetaLeague = new Map()
    for (const row of meta.rows) {
      if (!byMetaLeague.has(row.slug)) byMetaLeague.set(row.slug, {})
      byMetaLeague.get(row.slug)[row.fonte || 'sportsbase'] = row
    }

    let availableLeagues = [...byMetaLeague.entries()]
      .filter(([, sources]) => sourceFilter ? Boolean(sources[sourceFilter]) : Boolean(sources.sportsbase || sources.wyscout))
      .map(([slug]) => slug)
      .sort()
    if (guaraniContext) availableLeagues = availableLeagues.filter(slug => getGuaraniLeagueMarketPolicy(slug).actionable)

    const isSummary = limit === 1 && !busca && !posicao && !posGrupo && !equipa && !pe && !pais && minMin === 0
    if (isSummary) {
      const selected = liga ? availableLeagues.filter(item => item === liga) : availableLeagues
      if (sourceFilter) {
        const total = selected.reduce((sum, slugValue) => {
          const sources = byMetaLeague.get(slugValue) || {}
          return sum + (parseInt(sources[sourceFilter]?.player_count) || 0)
        }, 0)
        return NextResponse.json({ jogadores:[], total, page:1, pages:1, ligas:availableLeagues })
      }
      const summaryDatasets = await loadDatasets(selected, meta.rows)
      let total = 0
      for (const slugValue of selected) {
        const sources = summaryDatasets.get(slugValue) || {}
        if (sources.sportsbase && sources.wyscout) {
          const sportsbasePlayers = enrichPlayersWithFoot(sources.sportsbase.data || [], sources.wyscout.data || [], 'wyscout')
            .map(player=>({ ...player, _source_upload_at:sources.sportsbase.upload_at }))
          const wyscoutPlayers = (sources.wyscout.data || []).map(player=>({ ...player, _source_upload_at:sources.wyscout.upload_at }))
          total += mergeProviderDatasets(sportsbasePlayers, wyscoutPlayers).players.length
        } else {
          total += parseInt((sources.sportsbase || sources.wyscout)?.total || (sources.sportsbase || sources.wyscout)?.data?.length || 0) || 0
        }
      }
      return NextResponse.json({ jogadores:[], total, page:1, pages:1, ligas:availableLeagues })
    }

    const selectedLeagues = liga ? availableLeagues.filter(item => item === liga) : availableLeagues
    const byLeague = await loadDatasets(selectedLeagues, meta.rows)
    let players = []
    for (const leagueSlug of selectedLeagues) {
      const sources = byLeague.get(leagueSlug) || {}
      if (sourceFilter) {
        const selectedSource = sources[sourceFilter]
        if (!selectedSource) continue
        const base = selectedSource.fonte === 'sportsbase'
          ? enrichPlayersWithFoot(selectedSource.data || [], sources.wyscout?.data || [], 'wyscout')
          : (selectedSource.data || [])
        players.push(...base.map(player => ({
          ...player, _liga:leagueSlug, _fonte:selectedSource.fonte, _upload_at:selectedSource.upload_at,
        })))
        continue
      }

      if (sources.sportsbase && sources.wyscout) {
        const sportsbasePlayers = enrichPlayersWithFoot(sources.sportsbase.data || [], sources.wyscout.data || [], 'wyscout')
          .map(player=>({ ...player, _liga:leagueSlug, _fonte:'sportsbase', _source_upload_at:sources.sportsbase.upload_at }))
        const wyscoutPlayers = (sources.wyscout.data || [])
          .map(player=>({ ...player, _liga:leagueSlug, _fonte:'wyscout', _source_upload_at:sources.wyscout.upload_at }))
        const merged = mergeProviderDatasets(sportsbasePlayers, wyscoutPlayers)
        players.push(...merged.players.map(player=>({
          ...player,
          _liga:leagueSlug,
          _fonte:player._fonte || 'combined',
          _upload_at:[sources.sportsbase.upload_at, sources.wyscout.upload_at].filter(Boolean).sort().slice(-1)[0] || null,
        })))
        continue
      }

      const selectedSource = sources.sportsbase || sources.wyscout
      if (!selectedSource) continue
      const base = selectedSource.fonte === 'sportsbase'
        ? enrichPlayersWithFoot(selectedSource.data || [], [], 'sportsbase')
        : (selectedSource.data || [])
      players.push(...base.map(player => ({
        ...player, _liga:leagueSlug, _fonte:selectedSource.fonte, _upload_at:selectedSource.upload_at,
      })))
    }

    if (minMin > 0) players = players.filter(player => (Number(player.minutos) || 0) >= minMin)
    if (idadeMin > 15 || idadeMax < 45) players = players.filter(player => {
      const age = Number(player.idade)
      return !Number.isFinite(age) || (age >= idadeMin && age <= idadeMax)
    })
    if (busca) {
      const value = busca.toLowerCase()
      players = players.filter(player => `${player.nome || ''} ${player.equipa || ''}`.toLowerCase().includes(value))
    }
    if (equipa) {
      const value = equipa.toLowerCase()
      players = players.filter(player => String(player.equipa || '').toLowerCase().includes(value))
    }
    if (posicao) {
      const codes = posicao.split(',').map(item => item.trim().toUpperCase()).filter(Boolean)
      players = players.filter(player => {
        const playerPositions = String(player.posicao || '').split(',').map(item => item.trim().toUpperCase())
        return codes.some(code => playerPositions.includes(code))
      })
    } else if (posGrupo) {
      const allowed = groupPositions(posGrupo)
      if (allowed.length) players = players.filter(player => String(player.posicao || '').split(',').map(item => item.trim()).some(item => allowed.includes(item)))
    }
    if (pe) players = players.filter(player => matchesPlayerFoot(player, pe))
    if (pais) {
      const value = pais.toLowerCase()
      players = players.filter(player => String(player.pais || player.nacionalidade || '').toLowerCase().includes(value))
    }

    if (guaraniContext) {
      players = players.map(player => ({ ...player, _market:evaluateGuaraniMarketContext(player, player._liga) }))
      if (viableOnly) players = players.filter(player => player._market?.actionable)
    }

    players.sort((a, b) => {
      const av = Number(a[ordemKey]) || 0
      const bv = Number(b[ordemKey]) || 0
      return dir === 'asc' ? av - bv : bv - av
    })

    const total = players.length
    let pagePlayers = limit > 0 ? players.slice((page - 1) * limit, page * limit) : players
    if (withCanonical) pagePlayers = await attachCanonicalPlayers(pagePlayers)

    const projected = pagePlayers.map(player => {
      const item = {
        nome:player.nome, equipa:player.equipa, posicao:player.posicao, idade:player.idade,
        pe:player.pe, pe_fonte:player.pe_fonte, pais:player.pais, altura:player.altura,
        minutos:player.minutos, jogos:player.jogos, indice:player.indice,
        _liga:player._liga, _fonte:player._fonte, _upload_at:player._upload_at,
        _canonical_id:player._canonical_id, _identity_key:player._identity_key,
        _nivel_atual:player._nivel_atual, _nivel_atual_score:player._nivel_atual_score,
        _nivel_potencial:player._nivel_potencial, _nivel_potencial_score:player._nivel_potencial_score,
        _nivel_comprovado:player._nivel_comprovado, _nivel_comprovado_score:player._nivel_comprovado_score,
        _nivel_confianca:player._nivel_confianca, _market:player._market,
        valor_mercado:player.valor_mercado, valor_mercado_num:player.valor_mercado_num,
        fim_contrato:player.fim_contrato, contrato:player.contrato, emprestado:player.emprestado,
        defesas_pct:player.defesas_pct, gols_sofridos:player.gols_sofridos,
        gols_sofridos_90:player.gols_sofridos_90, clean_sheets:player.clean_sheets,
      }
      for (const key of SPORTSBASE_DATA_KEYS) if (player[key] !== undefined) item[key] = player[key]
      return item
    })

    const response = NextResponse.json({
      jogadores:projected, total, page, pages:limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
      ligas:availableLeagues,
      context:guaraniContext ? { name:'Confiança 2027 · Série D → Série C', viableOnly } : null,
    })
    response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=90')
    return response
  } catch (error) {
    console.error('[ligas-v2-jogadores]', error)
    return NextResponse.json({ error:error.message }, { status:500 })
  }
}
