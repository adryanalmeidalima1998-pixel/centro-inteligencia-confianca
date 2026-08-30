import { sql } from '@vercel/postgres'

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS wyscout_partidas (
      id           SERIAL PRIMARY KEY,
      label        TEXT NOT NULL,
      home_team    TEXT,
      away_team    TEXT,
      score        TEXT,
      match_date   TEXT,
      competition  TEXT,
      match_json   TEXT NOT NULL,
      exclusive_json TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Add exclusive_json column to existing tables that don't have it
  await sql`
    ALTER TABLE wyscout_partidas
    ADD COLUMN IF NOT EXISTS exclusive_json TEXT
  `.catch(() => {})

  await sql`
    CREATE TABLE IF NOT EXISTS wyscout_jogadores (
      id          SERIAL PRIMARY KEY,
      partida_id  INTEGER REFERENCES wyscout_partidas(id) ON DELETE CASCADE,
      players_json TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function GET() {
  try {
    await ensureTables()
    const partidas  = await sql`SELECT * FROM wyscout_partidas ORDER BY created_at DESC`
    const jogadores = await sql`SELECT partida_id, players_json FROM wyscout_jogadores`

    const jogMap = {}
    for (const j of jogadores.rows) jogMap[j.partida_id] = JSON.parse(j.players_json)

    const result = partidas.rows.map(p => ({
      id:            p.id,
      label:         p.label,
      homeTeam:      p.home_team,
      awayTeam:      p.away_team,
      score:         p.score,
      date:          p.match_date,
      competition:   p.competition,
      createdAt:     p.created_at,
      matchData:     JSON.parse(p.match_json),
      playersData:   jogMap[p.id] || null,
      exclusiveData: p.exclusive_json ? JSON.parse(p.exclusive_json) : null,
    }))

    return Response.json({ partidas: result })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    await ensureTables()
    const body = await req.json()
    const { action } = body

    /* ── Save single match (from AI PDF parse) ──────────────── */
    if (action === 'save_match') {
      const { data } = body
      const { homeTeam, awayTeam, score, date, competition } = data
      const label = `${homeTeam} ${score} ${awayTeam}`
      const ex = await sql`SELECT id FROM wyscout_partidas WHERE label=${label} AND match_date=${date||''}`
      if (ex.rows.length > 0) {
        await sql`UPDATE wyscout_partidas SET match_json=${JSON.stringify(data)}, created_at=NOW() WHERE id=${ex.rows[0].id}`
        return Response.json({ id: ex.rows[0].id, updated: true })
      }
      const r = await sql`
        INSERT INTO wyscout_partidas (label, home_team, away_team, score, match_date, competition, match_json)
        VALUES (${label}, ${homeTeam||''}, ${awayTeam||''}, ${score||''}, ${date||''}, ${competition||''}, ${JSON.stringify(data)})
        RETURNING id
      `
      return Response.json({ id: r.rows[0].id, created: true })
    }

    /* ── Batch save from Excel ───────────────────────────────── */
    if (action === 'save_excel_batch') {
      const { matches } = body
      const results = []
      for (const data of matches) {
        const { homeTeam, awayTeam, score, date, competition } = data
        const label = `${homeTeam} ${score} ${awayTeam}`
        const ex = await sql`SELECT id FROM wyscout_partidas WHERE label=${label} AND match_date=${date||''}`
        if (ex.rows.length > 0) {
          await sql`UPDATE wyscout_partidas SET match_json=${JSON.stringify(data)}, created_at=NOW() WHERE id=${ex.rows[0].id}`
          results.push({ label, id: ex.rows[0].id, updated: true })
        } else {
          const r = await sql`
            INSERT INTO wyscout_partidas (label, home_team, away_team, score, match_date, competition, match_json)
            VALUES (${label}, ${homeTeam||''}, ${awayTeam||''}, ${score||''}, ${date||''}, ${competition||''}, ${JSON.stringify(data)})
            RETURNING id
          `
          results.push({ label, id: r.rows[0].id, created: true })
        }
      }
      return Response.json({ results, count: results.length })
    }

    /* ── Save PDF-exclusive data (timeline, shots, corridors) ── */
    if (action === 'save_exclusive') {
      const { data, partida_id } = body
      await sql`
        UPDATE wyscout_partidas
        SET exclusive_json = ${JSON.stringify(data)}
        WHERE id = ${partida_id}
      `
      return Response.json({ updated: true })
    }

    /* ── Save players ────────────────────────────────────────── */
    if (action === 'save_players') {
      const { data, partida_id } = body
      const ex = await sql`SELECT id FROM wyscout_jogadores WHERE partida_id=${partida_id}`
      if (ex.rows.length > 0) {
        await sql`UPDATE wyscout_jogadores SET players_json=${JSON.stringify(data)} WHERE partida_id=${partida_id}`
        return Response.json({ updated: true })
      }
      await sql`INSERT INTO wyscout_jogadores (partida_id, players_json) VALUES (${partida_id}, ${JSON.stringify(data)})`
      return Response.json({ created: true })
    }

    return Response.json({ error: 'action inválida' }, { status: 400 })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    await ensureTables()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
    await sql`DELETE FROM wyscout_partidas WHERE id=${id}`
    return Response.json({ deleted: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
