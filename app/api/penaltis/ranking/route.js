import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || 'treino'

    // Aggregate by athlete: total kicks, goals, and per-zone breakdown
    const rows = await sql`
      SELECT
        atleta_id,
        atleta_nome,
        zona,
        COUNT(*) FILTER (WHERE resultado = 'gol')   AS gols,
        COUNT(*) FILTER (WHERE resultado = 'falta')  AS faltas,
        COUNT(*)                                      AS total
      FROM penaltis_cig
      WHERE tipo = ${tipo}
      GROUP BY atleta_id, atleta_nome, zona
      ORDER BY atleta_nome, zona
    `

    // Group by athlete
    const athleteMap = {}
    for (const row of rows.rows) {
      const key = row.atleta_id ?? row.atleta_nome
      if (!athleteMap[key]) {
        athleteMap[key] = {
          atleta_id:   row.atleta_id,
          atleta_nome: row.atleta_nome,
          total_gols:  0,
          total_kicks: 0,
          zones: {},
        }
      }
      const g = Number(row.gols)
      const t = Number(row.total)
      athleteMap[key].total_gols  += g
      athleteMap[key].total_kicks += t
      athleteMap[key].zones[row.zona] = { gols: g, faltas: Number(row.faltas), total: t }
    }

    const athletes = Object.values(athleteMap)
      .filter(a => a.total_kicks >= 1)
      .map(a => ({
        ...a,
        pct: a.total_kicks === 0 ? 0 : Math.round((a.total_gols / a.total_kicks) * 100),
      }))
      .sort((a, b) => b.pct - a.pct || b.total_kicks - a.total_kicks)

    return NextResponse.json({ athletes })
  } catch (err) {
    return NextResponse.json({ athletes: [], error: err.message }, { status: 500 })
  }
}
