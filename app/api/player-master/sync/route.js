import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { syncPlayerSourceBatch } from '@/app/lib/playerMaster'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

export const runtime = 'nodejs'
export const maxDuration = 60

const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback

export async function POST(request) {
  await ensureLigaJogadoresSchema()
  try {
    const body = await request.json().catch(() => ({}))
    const cursor = integer(body.cursor, 0)
    const batchSize = Math.max(1, Math.min(4, integer(body.batchSize, 2)))
    const result = await sql`
      SELECT DISTINCT ON (slug, fonte) slug, fonte, data, upload_at
      FROM liga_jogadores
      WHERE fonte IN ('sportsbase','wyscout')
      ORDER BY slug, fonte, upload_at DESC
    `
    const datasets = result.rows
      .filter(row => Array.isArray(row.data) && row.data.length)
      .sort((a, b) => String(a.slug).localeCompare(String(b.slug), 'pt-BR') || (a.fonte === 'sportsbase' ? -1 : 1))
    const slice = datasets.slice(cursor, cursor + batchSize)
    const processed = []
    let players = 0
    let canonical = 0

    for (const dataset of slice) {
      const season = new Date(dataset.upload_at || Date.now()).getFullYear()
      const synced = await syncPlayerSourceBatch({
        players:dataset.data,
        provider:dataset.fonte,
        leagueSlug:dataset.slug,
        season,
        uploadedAt:dataset.upload_at,
      })
      players += synced.players || 0
      canonical += synced.canonical || 0
      processed.push({ slug:dataset.slug, source:dataset.fonte, players:synced.players || 0 })
    }

    const nextCursor = cursor + slice.length
    return NextResponse.json({
      ok:true,
      cursor,
      nextCursor,
      totalDatasets:datasets.length,
      complete:nextCursor >= datasets.length,
      processed,
      players,
      canonical,
    })
  } catch (error) {
    console.error('[player-master-sync]', error)
    return NextResponse.json({ error:error.message }, { status:500 })
  }
}
