import { sql } from '@vercel/postgres'

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS times_db (
      id         SERIAL PRIMARY KEY,
      nome       TEXT NOT NULL UNIQUE,
      ligas      TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS jogadores_banco (
      id          SERIAL PRIMARY KEY,
      nome        TEXT NOT NULL,
      time_id     INTEGER REFERENCES times_db(id),
      posicao     TEXT,
      pe          TEXT,
      altura      TEXT,
      nascimento  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome, time_id)
    )
  `
}

/* ─── GET: buscar times (search + listar jogadores de um time) ─── */
export async function GET(request) {
  try {
    await ensureTables()
    const { searchParams } = new URL(request.url)
    const q       = searchParams.get('q')      // busca por nome
    const timeId  = searchParams.get('time_id') // listar jogadores

    if (timeId) {
      const res = await sql`
        SELECT j.id, j.nome, j.posicao, j.pe, j.altura, j.nascimento, t.nome as time_nome
        FROM jogadores_banco j JOIN times_db t ON t.id = j.time_id
        WHERE j.time_id = ${timeId}
        ORDER BY j.nome
      `
      return Response.json({ jogadores: res.rows })
    }

    if (q) {
      const like = `%${q}%`
      const res = await sql`
        SELECT * FROM times_db
        WHERE LOWER(nome) LIKE LOWER(${like})
        ORDER BY nome LIMIT 20
      `
      return Response.json({ times: res.rows })
    }

    const res = await sql`SELECT * FROM times_db ORDER BY nome LIMIT 200`
    return Response.json({ times: res.rows })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* ─── POST: criar time ──────────────────────────────────────────── */
export async function POST(request) {
  try {
    await ensureTables()
    const { nome, ligas } = await request.json()
    const res = await sql`
      INSERT INTO times_db (nome, ligas) VALUES (${nome}, ${ligas || []})
      ON CONFLICT (nome) DO UPDATE SET ligas = EXCLUDED.ligas
      RETURNING *
    `
    return Response.json({ time: res.rows[0] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
