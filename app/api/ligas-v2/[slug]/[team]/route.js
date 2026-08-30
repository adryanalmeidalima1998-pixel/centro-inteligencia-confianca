import { ensureLigaTimeStatsSchema } from '@/lib/legacy-ligas-schema'
/**
 * GET /api/ligas-v2/[slug]/team-stats/[team]
 * Retorna partidas do time mais recente upload
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(req, { params }) {
  await ensureLigaTimeStatsSchema()
  const { slug, team } = params
  const teamName = decodeURIComponent(team)

  try {
    const result = await sql`
      SELECT data, total, upload_at
      FROM liga_time_stats
      WHERE slug = ${slug} AND team_name = ${teamName}
      ORDER BY upload_at DESC
      LIMIT 1
    `

    if (!result.rows.length) {
      return NextResponse.json({ partidas: [], total: 0, upload_at: null })
    }

    return NextResponse.json({
      team_name: teamName,
      partidas: result.rows[0].data,
      total: result.rows[0].total,
      upload_at: result.rows[0].upload_at,
    })

  } catch (err) {
    console.error('[team-stats-get]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
