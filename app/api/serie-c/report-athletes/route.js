import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'

const DEFAULT_COMPETITION = 'Brasileiro Série C'

function clean(value) {
  return String(value || '').trim()
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    const { searchParams } = new URL(request.url)
    const season = clean(searchParams.get('season'))
    const competition = clean(searchParams.get('competition')) || DEFAULT_COMPETITION
    if (!season) return NextResponse.json({ players: [] })

    const { rows } = await sql`
      SELECT player, created_at
      FROM serie_c_report_exclusions
      WHERE season = ${season} AND competition = ${competition}
      ORDER BY player ASC
    `
    return NextResponse.json({ players: rows.map(row => row.player), rows })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Falha ao carregar atletas excluídos.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureSerieCTables()
    const body = await request.json()
    const season = clean(body?.season)
    const competition = clean(body?.competition) || DEFAULT_COMPETITION
    const player = clean(body?.player)
    if (!season || !player) {
      return NextResponse.json({ error: 'Temporada e atleta são obrigatórios.' }, { status: 400 })
    }

    await sql`
      INSERT INTO serie_c_report_exclusions (season, competition, player)
      VALUES (${season}, ${competition}, ${player})
      ON CONFLICT (season, competition, player) DO NOTHING
    `
    return NextResponse.json({ ok: true, player })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Falha ao excluir atleta dos relatórios.' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureSerieCTables()
    const body = await request.json()
    const season = clean(body?.season)
    const competition = clean(body?.competition) || DEFAULT_COMPETITION
    const player = clean(body?.player)
    if (!season || !player) {
      return NextResponse.json({ error: 'Temporada e atleta são obrigatórios.' }, { status: 400 })
    }

    await sql`
      DELETE FROM serie_c_report_exclusions
      WHERE season = ${season} AND competition = ${competition} AND player = ${player}
    `
    return NextResponse.json({ ok: true, player })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Falha ao reativar atleta nos relatórios.' }, { status: 500 })
  }
}
