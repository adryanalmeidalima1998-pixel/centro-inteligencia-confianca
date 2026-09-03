import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { enrichPlayersWithFoot, matchesPlayerFoot } from '@/data/player-foot'
import { getSportsbaseDatasetMeta } from '@/data/sportsbase-map'
import { getWyscoutSerieDMeta } from '@/data/wyscout-seried'
import { mergeProviderDatasets } from '@/data/provider-data-fusion'
import { attachCanonicalPlayers } from '@/app/lib/playerMaster'
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

function decorate(players = [], source, uploadAt, slug) {
  return players.map(player => ({
    ...player,
    _liga:slug,
    _fonte:source,
    _source_upload_at:uploadAt,
  }))
}

function resolveRequestedSource(requested, sportsbase, wyscout) {
  if (requested === 'sportsbase') return sportsbase ? 'sportsbase' : null
  if (requested === 'wyscout') return wyscout ? 'wyscout' : null
  if (requested === 'combined') return sportsbase && wyscout ? 'combined' : sportsbase ? 'sportsbase' : wyscout ? 'wyscout' : null
  if (sportsbase && wyscout) return 'combined'
  if (sportsbase) return 'sportsbase'
  if (wyscout) return 'wyscout'
  return null
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
    const source = resolveRequestedSource(requested, sportsbase, wyscout)

    if (!source) {
      return NextResponse.json({
        jogadores: [], total: 0, total_upload: 0, fonte: null, upload_at: null,
        available_sources: { sportsbase: Boolean(sportsbase), wyscout: Boolean(wyscout) },
        source_uploads: { sportsbase:sportsbase?.upload_at || null, wyscout:wyscout?.upload_at || null },
        meta: null,
        fusion_quality:null,
      })
    }

    const sportsbasePlayers = sportsbase
      ? decorate(enrichPlayersWithFoot(sportsbase.data || [], wyscout?.data || [], 'wyscout'), 'sportsbase', sportsbase.upload_at, slug)
      : []
    const wyscoutPlayers = wyscout
      ? decorate(wyscout.data || [], 'wyscout', wyscout.upload_at, slug)
      : []

    let all = []
    let meta = null
    let uploadAt = null
    let fusionQuality = null

    if (source === 'combined') {
      const merged = mergeProviderDatasets(sportsbasePlayers, wyscoutPlayers)
      all = merged.players
      fusionQuality = merged.quality
      uploadAt = [sportsbase?.upload_at, wyscout?.upload_at].filter(Boolean).sort().slice(-1)[0] || null
      // O modo combinado usa o catálogo visual Sportsbase quando ele existe, mas
      // os registros podem receber campos objetivos atualizados pelo Wyscout.
      meta = getSportsbaseDatasetMeta(all)
    } else if (source === 'sportsbase') {
      all = sportsbasePlayers
      uploadAt = sportsbase?.upload_at || null
      meta = getSportsbaseDatasetMeta(all)
    } else {
      all = wyscoutPlayers
      uploadAt = wyscout?.upload_at || null
      meta = getWyscoutSerieDMeta(all)
    }

    // Vincula à ficha-mãe quando já existir, sem impedir a visualização se o master
    // ainda não tiver sido sincronizado pelo processamento em background.
    try {
      all = await attachCanonicalPlayers(all)
    } catch (canonicalError) {
      console.warn('[league-dataset] canonical enrichment skipped:', canonicalError.message)
    }

    let players = [...all]
    if (min > 0) players = players.filter(player => Number(player.minutos || 0) >= min)
    if (foot) players = players.filter(player => matchesPlayerFoot(player, foot))
    if (search) players = players.filter(player => `${player.nome} ${player.equipa}`.toLowerCase().includes(search))

    const response = NextResponse.json({
      jogadores: players,
      total: players.length,
      total_upload: all.length,
      fonte: source,
      requested_source: requested,
      upload_at: uploadAt,
      available_sources: { sportsbase: Boolean(sportsbase), wyscout: Boolean(wyscout) },
      source_uploads: { sportsbase: sportsbase?.upload_at || null, wyscout: wyscout?.upload_at || null },
      meta,
      fusion_quality:fusionQuality,
      methodology:source === 'combined'
        ? 'Modo Automático: cruza Sportsbase + Wyscout por identidade probabilística segura; mantém atletas exclusivos de cada fonte; escolhe a janela mais atualizada por jogos/minutos/totais acumulados e usa fallback por campo sem tratar ausência como zero.'
        : `Fonte única ativa: ${source === 'sportsbase' ? 'Sportsbase' : 'Wyscout'}.`,
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('[league-dataset]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
