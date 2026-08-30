import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

const ESPN_STANDINGS = 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.3/standings'

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

function parseStandings(data) {
  const rows = []
  const groups = data?.standings?.entries
    ? [{ name: 'Geral', entries: data.standings.entries }]
    : (data?.children || []).map(g => ({ name: g.name || g.abbreviation, entries: g.standings?.entries || [] }))

  for (const group of groups) {
    for (const entry of group.entries) {
      const team = entry.team
      const stats = {}
      for (const s of entry.stats || []) stats[s.name] = s.value

      rows.push({
        teamName:  team?.displayName || team?.name || '',
        position:  entry.note?.rank ?? stats.rank ?? null,
        pts:       stats.points       ?? stats.pts ?? 0,
        pj:        stats.gamesPlayed  ?? 0,
        vit:       stats.wins         ?? 0,
        emp:       stats.ties         ?? 0,
        der:       stats.losses       ?? 0,
        gp:        stats.pointsFor    ?? stats.goalsFor    ?? 0,
        gc:        stats.pointsAgainst ?? stats.goalsAgainst ?? 0,
        sg:        stats.pointDifferential ?? stats.goalDifference ?? 0,
        aprov:     stats.winPercent != null ? +(stats.winPercent * 100).toFixed(1) : 0,
        group:     group.name,
      })
    }
  }

  // Sort by position if available, else by pts
  return rows.sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || b.pts - a.pts)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === '1'

  try {
    await ensureTable()

    // Cache: 15 min
    if (!refresh) {
      const fifteenMin = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const cached = await sql`
        SELECT * FROM serie_c_standings
        WHERE fetched_at > ${fifteenMin}
        ORDER BY position ASC NULLS LAST, pts DESC
      `
      if (cached.rows.length > 0) {
        return NextResponse.json({ standings: cached.rows, source: 'cache' })
      }
    }

    const res  = await fetch(ESPN_STANDINGS, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal:  AbortSignal.timeout(8000),
      next:    { revalidate: 900 },
    })
    if (!res.ok) throw new Error(`ESPN standings ${res.status}`)
    const data = await res.json()
    const rows = parseStandings(data)

    if (rows.length > 0) {
      // Upsert all rows
      for (const r of rows) {
        await sql`
          INSERT INTO serie_c_standings
            (team_name, position, pts, pj, vit, emp, der, gp, gc, sg, aprov, group_name)
          VALUES
            (${r.teamName}, ${r.position}, ${r.pts}, ${r.pj}, ${r.vit}, ${r.emp}, ${r.der},
             ${r.gp}, ${r.gc}, ${r.sg}, ${r.aprov}, ${r.group})
          ON CONFLICT (team_name) DO UPDATE SET
            position = EXCLUDED.position, pts = EXCLUDED.pts, pj = EXCLUDED.pj,
            vit = EXCLUDED.vit, emp = EXCLUDED.emp, der = EXCLUDED.der,
            gp = EXCLUDED.gp, gc = EXCLUDED.gc, sg = EXCLUDED.sg,
            aprov = EXCLUDED.aprov, group_name = EXCLUDED.group_name,
            fetched_at = NOW()
        `
      }
    }

    const final = await sql`SELECT * FROM serie_c_standings ORDER BY position ASC NULLS LAST, pts DESC`
    return NextResponse.json({ standings: final.rows, source: 'espn', total: rows.length })
  } catch (err) {
    // Fallback to cache even if expired
    try {
      const cached = await sql`SELECT * FROM serie_c_standings ORDER BY position ASC NULLS LAST, pts DESC`
      return NextResponse.json({ standings: cached.rows, source: 'cache-fallback', error: err.message })
    } catch {
      return NextResponse.json({ standings: [], error: err.message }, { status: 500 })
    }
  }
}
