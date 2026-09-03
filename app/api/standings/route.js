import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'
import { fetchSerieCStandings } from '@/lib/providers/espn-serie-c'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_standings (
      id          SERIAL PRIMARY KEY,
      team_name   VARCHAR(200) NOT NULL UNIQUE,
      position    INTEGER,
      pts         INTEGER,
      pj          INTEGER,
      vit         INTEGER,
      emp         INTEGER,
      der         INTEGER,
      gp          INTEGER,
      gc          INTEGER,
      sg          INTEGER,
      aprov       NUMERIC(5,1),
      group_name  VARCHAR(50),
      fetched_at  TIMESTAMP DEFAULT NOW()
    )
  `
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === '1'

  try {
    await ensureTable()

    if (!refresh) {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const cached = await sql`
        SELECT * FROM serie_c_standings
        WHERE fetched_at > ${fifteenMinAgo}
        ORDER BY position ASC NULLS LAST, pts DESC
      `
      if (cached.rows.length > 0) {
        return NextResponse.json({ standings: cached.rows, source: 'cache' })
      }
    }

    const rows = await fetchSerieCStandings()
    for (const row of rows) {
      await sql`
        INSERT INTO serie_c_standings
          (team_name, position, pts, pj, vit, emp, der, gp, gc, sg, aprov, group_name)
        VALUES
          (${row.teamName}, ${row.position}, ${row.pts}, ${row.pj}, ${row.vit}, ${row.emp}, ${row.der},
           ${row.gp}, ${row.gc}, ${row.sg}, ${row.aprov}, ${row.group})
        ON CONFLICT (team_name) DO UPDATE SET
          position = EXCLUDED.position,
          pts = EXCLUDED.pts,
          pj = EXCLUDED.pj,
          vit = EXCLUDED.vit,
          emp = EXCLUDED.emp,
          der = EXCLUDED.der,
          gp = EXCLUDED.gp,
          gc = EXCLUDED.gc,
          sg = EXCLUDED.sg,
          aprov = EXCLUDED.aprov,
          group_name = EXCLUDED.group_name,
          fetched_at = NOW()
      `
    }

    const final = await sql`SELECT * FROM serie_c_standings ORDER BY position ASC NULLS LAST, pts DESC`
    return NextResponse.json({ standings: final.rows, source: 'espn', total: rows.length })
  } catch (error) {
    try {
      const cached = await sql`SELECT * FROM serie_c_standings ORDER BY position ASC NULLS LAST, pts DESC`
      return NextResponse.json({ standings: cached.rows, source: 'cache-fallback', error: error.message })
    } catch {
      return NextResponse.json({ standings: [], error: error.message }, { status: 500 })
    }
  }
}
