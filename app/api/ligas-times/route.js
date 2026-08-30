import { sql } from '@vercel/postgres'

/* ─── GET: buscar ligas e times ─────────────────────────────────── */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo   = searchParams.get('tipo')    // 'ligas' | 'times' | 'times_liga'
    const q      = searchParams.get('q')       // busca por nome
    const liga   = searchParams.get('liga')    // filtrar times por liga
    const timeId = searchParams.get('time_id') // buscar jogadores de um time

    // ── Listar ligas ─────────────────────────────────────────────
    if (tipo === 'ligas' || (!tipo && !q && !liga && !timeId)) {
      const res = await sql`SELECT * FROM ligas_db ORDER BY nome`
      return Response.json({ ligas: res.rows })
    }

    // ── Jogadores de um time ──────────────────────────────────────
    if (timeId) {
      const res = await sql`
        SELECT j.id, j.nome, j.posicao, j.pe, j.altura, j.nascimento, t.nome as time_nome
        FROM jogadores_banco j
        JOIN times_db t ON t.id = j.time_id
        WHERE j.time_id = ${timeId}
        ORDER BY j.nome
      `
      return Response.json({ jogadores: res.rows })
    }

    // ── Busca por nome de time (com filtro por liga opcional) ─────
    if (q || liga) {
      const like = q ? `%${q}%` : null
      let res
      if (liga && like) {
        res = await sql`
          SELECT * FROM times_db
          WHERE LOWER(nome) LIKE LOWER(${like})
            AND ${liga} = ANY(ligas)
          ORDER BY nome LIMIT 20
        `
      } else if (liga) {
        res = await sql`
          SELECT * FROM times_db
          WHERE ${liga} = ANY(ligas)
          ORDER BY nome
        `
      } else {
        res = await sql`
          SELECT * FROM times_db
          WHERE LOWER(nome) LIKE LOWER(${like})
          ORDER BY nome LIMIT 20
        `
      }
      return Response.json({ times: res.rows })
    }

    // ── Listar todos os times (limite 300) ────────────────────────
    const res = await sql`SELECT * FROM times_db ORDER BY nome LIMIT 300`
    return Response.json({ times: res.rows })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* ─── POST: criar/atualizar time ────────────────────────────────── */
export async function POST(request) {
  try {
    const { nome, ligas } = await request.json()
    if (!nome?.trim()) return Response.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const res = await sql`
      INSERT INTO times_db (nome, ligas) VALUES (${nome.trim()}, ${ligas || []})
      ON CONFLICT (nome) DO UPDATE SET
        ligas = (
          SELECT ARRAY(
            SELECT DISTINCT unnest(times_db.ligas || EXCLUDED.ligas)
            ORDER BY 1
          )
        )
      RETURNING *
    `
    return Response.json({ time: res.rows[0] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
