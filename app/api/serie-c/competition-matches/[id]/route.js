import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../../lib/serieCDb'
import seedMatches from '../../../../../lib/data/serieCMatchesSeed2026.json'

export async function GET(request, { params }) {
  try {
    await ensureSerieCTables()
    const { id } = await params
    if (String(id).startsWith('seed-')) {
      const seed = seedMatches.find(match => match.id === String(id))
      if (!seed) return NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })
      return NextResponse.json({ match: seed, source: 'embedded-spreadsheet' })
    }
    const result = await sql`SELECT * FROM serie_c_competition_matches WHERE id = ${id} LIMIT 1`
    if (!result.rows.length) return NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })
    return NextResponse.json({ match: result.rows[0], source: 'database' })
  } catch (err) {
    const { id } = await params
    const seed = seedMatches.find(match => match.id === String(id))
    if (seed) return NextResponse.json({ match: seed, source: 'embedded-spreadsheet', warning: err.message })
    return NextResponse.json({ error: err.message || 'Falha ao carregar a partida.' }, { status: 500 })
  }
}
