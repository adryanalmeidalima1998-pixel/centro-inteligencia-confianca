/**
 * GET /api/ligas-v2/brasileirao-serie-d/rankings
 * Retorna todos os rankings da Série D salvos no banco.
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT sheet_key, data, uploaded_at
      FROM serie_d_rankings
      WHERE slug = 'brasileirao-serie-d'
      ORDER BY sheet_key
    `

    if (rows.length === 0) {
      return NextResponse.json({ rankings: {}, uploaded_at: null })
    }

    const rankings = {}
    for (const row of rows) {
      rankings[row.sheet_key] = row.data
    }

    return NextResponse.json({
      rankings,
      uploaded_at: rows[0]?.uploaded_at || null,
    })

  } catch (err) {
    // Tabela ainda não existe — retorna vazio sem crash
    if (err.message?.includes('does not exist')) {
      return NextResponse.json({ rankings: {}, uploaded_at: null })
    }
    console.error('[serie-d-rankings]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
