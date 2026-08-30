import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS jogadores_banco (
      id          SERIAL PRIMARY KEY,
      nome        TEXT NOT NULL,
      time_id     INTEGER REFERENCES times_db(id) ON DELETE SET NULL,
      posicao     TEXT,
      pe          TEXT,
      altura      TEXT,
      nascimento  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome, time_id)
    )
  `
}

/* ─── GET: buscar jogadores ─────────────────────────────────────── */
export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const q      = searchParams.get('q')       // busca global por nome
    const timeId = searchParams.get('time_id') // filtrar por time
    const id     = searchParams.get('id')      // buscar um jogador específico

    if (id) {
      const res = await sql`
        SELECT j.*, t.nome as time_nome, t.ligas as time_ligas
        FROM jogadores_banco j
        LEFT JOIN times_db t ON t.id = j.time_id
        WHERE j.id = ${id}
      `
      return Response.json({ jogador: res.rows[0] || null })
    }

    if (timeId) {
      const res = await sql`
        SELECT j.*, t.nome as time_nome
        FROM jogadores_banco j
        LEFT JOIN times_db t ON t.id = j.time_id
        WHERE j.time_id = ${timeId}
        ORDER BY j.nome
      `
      return Response.json({ jogadores: res.rows })
    }

    if (q && q.length >= 2) {
      const like = `%${q}%`
      const res = await sql`
        SELECT j.*, t.nome as time_nome
        FROM jogadores_banco j
        LEFT JOIN times_db t ON t.id = j.time_id
        WHERE LOWER(j.nome) LIKE LOWER(${like})
        ORDER BY j.nome
        LIMIT 30
      `
      return Response.json({ jogadores: res.rows })
    }

    // Paginação simples
    const page   = parseInt(searchParams.get('page') || '1')
    const limit  = 50
    const offset = (page - 1) * limit
    const res = await sql`
      SELECT j.*, t.nome as time_nome
      FROM jogadores_banco j
      LEFT JOIN times_db t ON t.id = j.time_id
      ORDER BY j.nome
      LIMIT ${limit} OFFSET ${offset}
    `
    const count = await sql`SELECT COUNT(*)::int as c FROM jogadores_banco`
    return Response.json({ jogadores: res.rows, total: count.rows[0].c, page, limit })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* ─── POST: criar/atualizar jogador ─────────────────────────────── */
export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { nome, time_nome, time_id: rawTimeId, posicao, pe, altura, nascimento } = body

    if (!nome?.trim()) return Response.json({ error: 'Nome é obrigatório' }, { status: 400 })

    let timeId = rawTimeId || null

    // Resolver time_id a partir do nome se necessário
    if (!timeId && time_nome) {
      const tRes = await sql`
        INSERT INTO times_db (nome) VALUES (${time_nome.trim()})
        ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
        RETURNING id
      `
      timeId = tRes.rows[0]?.id || null
    }

    const res = await sql`
      INSERT INTO jogadores_banco (nome, time_id, posicao, pe, altura, nascimento)
      VALUES (${nome.trim()}, ${timeId}, ${posicao||null}, ${pe||null}, ${altura||null}, ${nascimento||null})
      ON CONFLICT (nome, time_id) DO UPDATE SET
        posicao    = COALESCE(NULLIF(${posicao||''},''), jogadores_banco.posicao),
        pe         = COALESCE(NULLIF(${pe||''},''), jogadores_banco.pe),
        altura     = COALESCE(NULLIF(${altura||''},''), jogadores_banco.altura),
        nascimento = COALESCE(NULLIF(${nascimento||''},''), jogadores_banco.nascimento)
      RETURNING *
    `
    return Response.json({ jogador: res.rows[0] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* ─── DELETE: remover jogador ───────────────────────────────────── */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
    await sql`DELETE FROM jogadores_banco WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
