import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { enrichPlayersWithFoot, matchesPlayerFoot } from '@/data/player-foot'
import { getSportsbaseDatasetMeta } from '@/data/sportsbase-map'
import { getWyscoutSerieDMeta } from '@/data/wyscout-seried'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

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
      ? 'wyscout'
      : requested === 'sportsbase'
        ? 'sportsbase'
        : sportsbase ? 'sportsbase' : wyscout ? 'wyscout' : null

    if (!source) {
      return NextResponse.json({
        jogadores: [], total: 0, total_upload: 0, fonte: null, upload_at: null,
        available_sources: { sportsbase: false, wyscout: false }, source_uploads: {}, meta: null,
      })
    }

    const selected = source === 'sportsbase' ? sportsbase : wyscout
    if (!selected) {
      return NextResponse.json({
        jogadores: [], total: 0, total_upload: 0, fonte: source, upload_at: null,
        available_sources: { sportsbase: Boolean(sportsbase), wyscout: Boolean(wyscout) },
        source_uploads: { sportsbase: sportsbase?.upload_at || null, wyscout: wyscout?.upload_at || null },
        meta: source === 'sportsbase' ? getSportsbaseDatasetMeta([]) : getWyscoutSerieDMeta([]),
      })
    }

    const all = source === 'sportsbase'
      ? enrichPlayersWithFoot(selected.data || [], wyscout?.data || [], 'wyscout')
      : (selected.data || [])
    let players = [...all]
    if (min > 0) players = players.filter(player => Number(player.minutos || 0) >= min)
    if (foot) players = players.filter(player => matchesPlayerFoot(player, foot))
    if (search) players = players.filter(player => `${player.nome} ${player.equipa}`.toLowerCase().includes(search))

    return NextResponse.json({
      jogadores: players,
      total: players.length,
      total_upload: all.length,
      fonte: source,
      upload_at: selected.upload_at,
      available_sources: { sportsbase: Boolean(sportsbase), wyscout: Boolean(wyscout) },
      source_uploads: { sportsbase: sportsbase?.upload_at || null, wyscout: wyscout?.upload_at || null },
      meta: source === 'sportsbase' ? getSportsbaseDatasetMeta(all) : getWyscoutSerieDMeta(all),
    })
  } catch (error) {
    console.error('[league-dataset]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
