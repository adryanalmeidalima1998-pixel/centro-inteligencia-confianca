import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getClubSportsbase } from '@/lib/club-sportsbase-store'
import {
  buildSportsbaseProfilePayload,
  buildWyscoutProfilePayload,
} from '@/data/player-profile'
import { decodePlayerKey } from '@/data/player-route'
import { getLeague } from '@/data/leagues'
import { enrichPlayersWithFoot } from '@/data/player-foot'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'
import { compareProviderFreshness, fusePlayerRecords, pairProviderPlayers } from '@/data/provider-data-fusion'
import {
  attachCanonicalPlayers,
  ensurePlayerMaster,
  syncPlayerSourceBatch,
} from '@/app/lib/playerMaster'

export const runtime = 'nodejs'
export const maxDuration = 45

async function getLatestSource(slug, source) {
  const result = await sql`
    SELECT data, fonte, upload_at
    FROM liga_jogadores
    WHERE slug = ${slug} AND fonte = ${source}
    ORDER BY upload_at DESC
    LIMIT 1
  `
  if (!result.rows.length) return null
  return {
    players: Array.isArray(result.rows[0].data) ? result.rows[0].data : [],
    source: result.rows[0].fonte || source,
    uploadedAt: result.rows[0].upload_at,
  }
}

async function getLatestLeague(slug) {
  const [sportsbase, wyscout] = await Promise.all([
    getLatestSource(slug, 'sportsbase'),
    getLatestSource(slug, 'wyscout'),
  ])
  return { sportsbase, wyscout }
}

function findSourcePlayer(players = [], key = {}) {
  const exact = players.find(item => String(item.nome || '').trim() === key.nome && String(item.equipa || '').trim() === key.equipa)
  if (exact) return exact
  // Se uma das bases já atualizou o clube e a outra ainda não, o nome pode existir
  // com outra equipe. Só usamos o fallback quando o nome é único para evitar homônimos.
  const sameName = players.filter(item => String(item.nome || '').trim() === key.nome)
  return sameName.length === 1 ? sameName[0] : null
}

function findPlayerContext(datasets, playerId) {
  const key = decodePlayerKey(playerId)
  const sportsbasePlayers = datasets.sportsbase
    ? enrichPlayersWithFoot(datasets.sportsbase.players, datasets.wyscout?.players || [], 'wyscout')
      .map(player=>({ ...player, _source_upload_at:datasets.sportsbase?.uploadedAt }))
    : []
  const wyscoutPlayers = datasets.wyscout
    ? (datasets.wyscout.players || []).map(player=>({ ...player, _source_upload_at:datasets.wyscout?.uploadedAt }))
    : []
  let sportsbasePlayer = findSourcePlayer(sportsbasePlayers, key)
  let wyscoutPlayer = findSourcePlayer(wyscoutPlayers, key)
  let matchQuality = 0
  let matchReason = ''

  // A URL pode ter sido criada com o nome completo do Sportsbase enquanto o
  // Wyscout usa abreviação (ex.: Kevin Stiben Viveros Rodallega ↔ K. Viveros),
  // ou o inverso. Depois do match exato em uma fonte, procuramos o par seguro
  // na outra usando o mesmo resolvedor do modo Automático.
  if (sportsbasePlayer && !wyscoutPlayer && wyscoutPlayers.length) {
    const pair = pairProviderPlayers([sportsbasePlayer], wyscoutPlayers).find(item=>item.sportsbase && item.wyscout)
    if (pair) {
      wyscoutPlayer = pair.wyscout
      matchQuality = pair.matchQuality
      matchReason = pair.matchReason
    }
  } else if (wyscoutPlayer && !sportsbasePlayer && sportsbasePlayers.length) {
    const pair = pairProviderPlayers(sportsbasePlayers, [wyscoutPlayer]).find(item=>item.sportsbase && item.wyscout)
    if (pair) {
      sportsbasePlayer = pair.sportsbase
      matchQuality = pair.matchQuality
      matchReason = pair.matchReason
    }
  }

  if (!sportsbasePlayer && !wyscoutPlayer) return { player:null, source:null, datasetPlayers:[], uploadedAt:null }

  if (sportsbasePlayer && wyscoutPlayer) {
    const freshness = compareProviderFreshness(sportsbasePlayer, wyscoutPlayer)
    const source = freshness.primary
    const datasetPlayers = source === 'sportsbase' ? sportsbasePlayers : wyscoutPlayers
    const uploadedAt = source === 'sportsbase' ? datasets.sportsbase?.uploadedAt : datasets.wyscout?.uploadedAt
    const player = fusePlayerRecords(sportsbasePlayer, wyscoutPlayer, matchQuality || 1, matchReason || 'profile_exact')
    return { player, source, datasetPlayers, uploadedAt, sourcePlayer:source === 'sportsbase' ? sportsbasePlayer : wyscoutPlayer }
  }

  const source = sportsbasePlayer ? 'sportsbase' : 'wyscout'
  const player = sportsbasePlayer || wyscoutPlayer
  const datasetPlayers = source === 'sportsbase' ? sportsbasePlayers : wyscoutPlayers
  const uploadedAt = source === 'sportsbase' ? datasets.sportsbase?.uploadedAt : datasets.wyscout?.uploadedAt
  return { player, source, datasetPlayers, uploadedAt, sourcePlayer:player }
}

async function ensureCanonicalPlayer({ player, source, slug, uploadedAt }) {
  let [canonicalPlayer] = await attachCanonicalPlayers([{ ...player, _liga:slug, _fonte:source }])
  if (!canonicalPlayer?._canonical_id) {
    try {
      await syncPlayerSourceBatch({ players:[player], provider:source, leagueSlug:slug, uploadedAt })
      ;[canonicalPlayer] = await attachCanonicalPlayers([{ ...player, _liga:slug, _fonte:source }])
    } catch (syncError) {
      console.warn('[player-profile] canonical sync skipped:', syncError.message)
    }
  }
  return canonicalPlayer || player
}

function normalizeExternalUrl(value, label) {
  const text = String(value || '').trim()
  if (!text) return null
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  let url
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`${label} inválido.`)
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} deve usar http ou https.`)
  return url.toString()
}

export async function GET(_request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug, playerId } = await params
  try {
    const datasets = await getLatestLeague(slug)
    if (!datasets.sportsbase && !datasets.wyscout) return NextResponse.json({ error: 'Competição sem dados carregados.' }, { status: 404 })

    const context = findPlayerContext(datasets, playerId)
    if (!context.player) return NextResponse.json({ error: 'Jogador não encontrado no último upload da competição.' }, { status: 404 })

    const canonicalSourcePlayer = await ensureCanonicalPlayer({ player:context.sourcePlayer || context.player, source:context.source, uploadedAt:context.uploadedAt, slug })
    const [player] = await attachCanonicalPlayers([{ ...context.player, _liga:slug, _fonte:context.player?._fonte || context.source }])
    const resolvedPlayer = player || { ...context.player, _canonical_id:canonicalSourcePlayer?._canonical_id || null }
    const clubData = await getClubSportsbase()
    const analysis = context.source === 'wyscout'
      ? buildWyscoutProfilePayload(resolvedPlayer, context.datasetPlayers, clubData.players || [], clubData.model || clubData.summary?.model)
      : buildSportsbaseProfilePayload(resolvedPlayer, context.datasetPlayers, clubData.players || [], clubData.model || clubData.summary?.model)

    return NextResponse.json({
      player:resolvedPlayer,
      league: getLeague(slug) || { slug, nome: slug },
      uploadedAt:context.uploadedAt,
      club: {
        model: clubData.model || clubData.summary?.model || null,
        players: (clubData.players || []).length,
        games: (clubData.games || []).length,
      },
      levels: {
        recommended: { score:resolvedPlayer._nivel_recomendado_score, label:resolvedPlayer._nivel_recomendado },
        real: { score:resolvedPlayer._nivel_real_score, label:resolvedPlayer._nivel_real || 'Não validada' },
        current: { score:resolvedPlayer._nivel_atual_score, label:resolvedPlayer._nivel_atual, source:resolvedPlayer._nivel_fonte },
        potentialRecommended: { score:resolvedPlayer._nivel_potencial_recomendado_score, label:resolvedPlayer._nivel_potencial_recomendado },
        potential: { score:resolvedPlayer._nivel_potencial_score, label:resolvedPlayer._nivel_potencial },
        proven: { score:resolvedPlayer._nivel_comprovado_score, label:resolvedPlayer._nivel_comprovado },
        confidence: resolvedPlayer._nivel_confianca,
        robustness: resolvedPlayer._robustez || null,
        recommendationType: resolvedPlayer._nivel_recomendacao_tipo || 'provisório',
        modelAvailable: resolvedPlayer._nivel_modelo_disponivel,
        criteria: resolvedPlayer._nivel_criterios || {},
        profileBands: resolvedPlayer._faixas_perfis || [],
      },
      links: {
        videoUrl:resolvedPlayer._video_url || null,
        ogolUrl:resolvedPlayer._ogol_url || null,
      },
      canonicalId: resolvedPlayer._canonical_id || null,
      analysis,
    })
  } catch (error) {
    console.error('[player-profile]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug, playerId } = await params
  try {
    const body = await request.json()
    let videoUrl
    let ogolUrl
    try {
      videoUrl = normalizeExternalUrl(body?.videoUrl, 'Link do material de vídeo')
      ogolUrl = normalizeExternalUrl(body?.ogolUrl, 'Link do oGol')
    } catch (validationError) {
      return NextResponse.json({ error:validationError.message }, { status:400 })
    }

    const datasets = await getLatestLeague(slug)
    if (!datasets.sportsbase && !datasets.wyscout) return NextResponse.json({ error: 'Competição sem dados carregados.' }, { status: 404 })
    const context = findPlayerContext(datasets, playerId)
    if (!context.player) return NextResponse.json({ error: 'Jogador não encontrado no último upload da competição.' }, { status: 404 })

    await ensurePlayerMaster()
    const player = await ensureCanonicalPlayer({ player:context.sourcePlayer || context.player, source:context.source, uploadedAt:context.uploadedAt, slug })
    if (!player?._canonical_id) return NextResponse.json({ error:'Não foi possível criar a ficha-mãe deste atleta.' }, { status:409 })

    await sql`
      UPDATE cig_jogadores
      SET video_url = ${videoUrl}, ogol_url = ${ogolUrl}, updated_at = NOW()
      WHERE id = ${player._canonical_id}
    `

    return NextResponse.json({
      ok:true,
      canonicalId:player._canonical_id,
      links:{ videoUrl, ogolUrl },
    })
  } catch (error) {
    console.error('[player-profile-links]', error)
    return NextResponse.json({ error:error.message }, { status:500 })
  }
}
