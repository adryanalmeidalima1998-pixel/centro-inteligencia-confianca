import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { enrichPlayersWithFoot, matchesPlayerFoot } from '@/data/player-foot'
import { getSportsbaseDatasetMeta } from '@/data/sportsbase-map'
import { getWyscoutSerieDMeta } from '@/data/wyscout-seried'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'
import { mergeProviderDatasets } from '@/data/provider-data-fusion'

export const runtime = 'nodejs'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS liga_jogadores (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '[]'::jsonb,
      total INTEGER DEFAULT 0,
      fonte TEXT DEFAULT 'sportsbase',
      upload_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0`
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'sportsbase'`
}

async function latest(slug, source) {
  const result = await sql`
    SELECT data, total, fonte, upload_at
    FROM liga_jogadores
    WHERE slug = ${slug} AND fonte = ${source}
    ORDER BY upload_at DESC
    LIMIT 1
  `
  return result.rows[0] || null
}

export async function GET(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('source') || 'auto'
  const foot = searchParams.get('pe') || ''
  const min = Number(searchParams.get('min') || 0)
  const search = String(searchParams.get('busca') || '').toLowerCase()

  try {
    await ensureTable()
    const [sportsbase, wyscout] = await Promise.all([latest(slug, 'sportsbase'), latest(slug, 'wyscout')])
    const source = requested === 'wyscout'
      ? (wyscout ? 'wyscout' : null)
      : requested === 'sportsbase'
        ? (sportsbase ? 'sportsbase' : null)
        : sportsbase && wyscout
          ? 'combined'
          : sportsbase
            ? 'sportsbase'
            : wyscout
              ? 'wyscout'
              : null

    if (!source) {
      return NextResponse.json({
        jogadores: [], total: 0, total_upload: 0, fonte: requested === 'auto' ? null : requested, upload_at: null,
        available_sources: { sportsbase: Boolean(sportsbase), wyscout: Boolean(wyscout) },
        source_uploads: { sportsbase: sportsbase?.upload_at || null, wyscout: wyscout?.upload_at || null },
        meta: null, fusion_quality: null,
      })
    }

    let all = []
    let meta = null
    let uploadAt = null
    let fusionQuality = null

    if (source === 'combined') {
      const sportsbasePlayers = enrichPlayersWithFoot(sportsbase?.data || [], wyscout?.data || [], 'wyscout')
        .map(player => ({ ...player, _liga:slug, _fonte:'sportsbase', _source_upload_at:sportsbase?.upload_at || null }))
      const wyscoutPlayers = (wyscout?.data || [])
        .map(player => ({ ...player, _liga:slug, _fonte:'wyscout', _source_upload_at:wyscout?.upload_at || null }))
      const merged = mergeProviderDatasets(sportsbasePlayers, wyscoutPlayers)
      all = merged.players.map(player => ({ ...player, _liga:slug }))
      fusionQuality = merged.quality
      uploadAt = [sportsbase?.upload_at, wyscout?.upload_at].filter(Boolean).sort().slice(-1)[0] || null
      meta = getSportsbaseDatasetMeta(all)
    } else if (source === 'sportsbase') {
      all = enrichPlayersWithFoot(sportsbase?.data || [], wyscout?.data || [], 'wyscout')
        .map(player => ({ ...player, _liga:slug, _fonte:'sportsbase', _source_upload_at:sportsbase?.upload_at || null }))
      uploadAt = sportsbase?.upload_at || null
      meta = getSportsbaseDatasetMeta(all)
    } else {
      all = (wyscout?.data || [])
        .map(player => ({ ...player, _liga:slug, _fonte:'wyscout', _source_upload_at:wyscout?.upload_at || null }))
      uploadAt = wyscout?.upload_at || null
      meta = getWyscoutSerieDMeta(all)
    }

    let players = [...all]
    if (min > 0) players = players.filter(player => Number(player.minutos || 0) >= min)
    if (foot) players = players.filter(player => matchesPlayerFoot(player, foot))
    if (search) players = players.filter(player => `${player.nome} ${player.equipa}`.toLowerCase().includes(search))

    return NextResponse.json({
      jogadores: players,
      total: players.length,
      total_upload: all.length,
      fonte: source,
      upload_at: uploadAt,
      available_sources: { sportsbase: Boolean(sportsbase), wyscout: Boolean(wyscout) },
      source_uploads: { sportsbase: sportsbase?.upload_at || null, wyscout: wyscout?.upload_at || null },
      meta,
      fusion_quality: fusionQuality,
    })
  } catch (error) {
    console.error('[league-dataset]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
