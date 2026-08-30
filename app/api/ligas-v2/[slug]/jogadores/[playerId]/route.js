import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getGuaraniSportsbase } from '@/lib/guarani-sportsbase-store'
import {
  buildSportsbaseProfilePayload,
  buildWyscoutProfilePayload,
} from '@/data/player-profile'
import { decodePlayerKey } from '@/data/player-route'
import { getLeague } from '@/data/leagues'
import { enrichPlayersWithFoot } from '@/data/player-foot'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'
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

function findPlayerContext(datasets, playerId) {
  const key = decodePlayerKey(playerId)
  const matchesKey = item => String(item.nome || '').trim() === key.nome && String(item.equipa || '').trim() === key.equipa
  const sportsbasePlayers = datasets.sportsbase
    ? enrichPlayersWithFoot(datasets.sportsbase.players, datasets.wyscout?.players || [], 'wyscout')
    : []
  const sportsbasePlayer = sportsbasePlayers.find(matchesKey)
  const wyscoutPlayer = datasets.wyscout?.players.find(matchesKey)
  const source = sportsbasePlayer ? 'sportsbase' : wyscoutPlayer ? 'wyscout' : null
  const player = sportsbasePlayer || wyscoutPlayer || null
  const datasetPlayers = source === 'sportsbase' ? sportsbasePlayers : (datasets.wyscout?.players || [])
  const uploadedAt = source === 'sportsbase' ? datasets.sportsbase?.uploadedAt : datasets.wyscout?.uploadedAt
  return { player, source, datasetPlayers, uploadedAt }
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

    const player = await ensureCanonicalPlayer({ ...context, slug })
    const guarani = await getGuaraniSportsbase()
    const analysis = context.source === 'wyscout'
      ? buildWyscoutProfilePayload(player, context.datasetPlayers, guarani.players || [], guarani.model || guarani.summary?.model)
      : buildSportsbaseProfilePayload(player, context.datasetPlayers, guarani.players || [], guarani.model || guarani.summary?.model)

    return NextResponse.json({
      player,
      league: getLeague(slug) || { slug, nome: slug },
      uploadedAt:context.uploadedAt,
      guarani: {
        model: guarani.model || guarani.summary?.model || null,
        players: (guarani.players || []).length,
        games: (guarani.games || []).length,
      },
      levels: {
        recommended: { score:player._nivel_recomendado_score, label:player._nivel_recomendado },
        real: { score:player._nivel_real_score, label:player._nivel_real || 'Não validada' },
        current: { score:player._nivel_atual_score, label:player._nivel_atual, source:player._nivel_fonte },
        potentialRecommended: { score:player._nivel_potencial_recomendado_score, label:player._nivel_potencial_recomendado },
        potential: { score:player._nivel_potencial_score, label:player._nivel_potencial },
        proven: { score:player._nivel_comprovado_score, label:player._nivel_comprovado },
        confidence: player._nivel_confianca,
        robustness: player._robustez || null,
        recommendationType: player._nivel_recomendacao_tipo || 'provisório',
        modelAvailable: player._nivel_modelo_disponivel,
        criteria: player._nivel_criterios || {},
        profileBands: player._faixas_perfis || [],
      },
      links: {
        videoUrl:player._video_url || null,
        ogolUrl:player._ogol_url || null,
      },
      canonicalId: player._canonical_id || null,
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
    const player = await ensureCanonicalPlayer({ ...context, slug })
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
