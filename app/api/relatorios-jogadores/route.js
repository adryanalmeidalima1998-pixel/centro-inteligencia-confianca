import { sql } from '@vercel/postgres'

// ─── Tabela ─────────────────────────────────────────────────────────────────
// Cada relatório é uma "lista preferencial" nomeada. Os jogadores ficam num
// array JSONB no próprio registro — simples de ler, salvar e reordenar.
// Formato de cada jogador:
//   { id, nome, idade, posicao, clube, link, grupo }
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS relatorios_jogadores (
      id          SERIAL PRIMARY KEY,
      nome        TEXT NOT NULL,
      jogadores   JSONB DEFAULT '[]'::jsonb,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

// ─── GET ────────────────────────────────────────────────────────────────────
// sem id → lista todos os relatórios (com contagem de jogadores)
// ?id=   → devolve um relatório completo
export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const rows = await sql`SELECT * FROM relatorios_jogadores WHERE id = ${id}`
      return Response.json({ relatorio: rows.rows[0] || null })
    }

    const rows = await sql`
      SELECT id, nome, created_at, updated_at,
             COALESCE(jsonb_array_length(jogadores), 0) AS total
      FROM relatorios_jogadores
      ORDER BY updated_at DESC
    `
    return Response.json({ relatorios: rows.rows })
  } catch (err) {
    return Response.json({ relatorios: [], error: err.message }, { status: 500 })
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// cria um relatório novo (opcionalmente já com jogadores)
export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const nome = String(body?.nome || '').trim()
    if (!nome) return Response.json({ error: 'nome obrigatório' }, { status: 400 })

    const jogadores = Array.isArray(body?.jogadores) ? body.jogadores : []
    const rows = await sql`
      INSERT INTO relatorios_jogadores (nome, jogadores)
      VALUES (${nome}, ${JSON.stringify(jogadores)}::jsonb)
      RETURNING *
    `
    return Response.json({ relatorio: rows.rows[0] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────
// atualiza nome e/ou a lista de jogadores
export async function PATCH(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { id, nome, jogadores } = body
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

    const nomeVal = nome !== undefined ? String(nome).trim() : null
    const jogVal  = jogadores !== undefined ? JSON.stringify(Array.isArray(jogadores) ? jogadores : []) : null

    await sql`
      UPDATE relatorios_jogadores SET
        nome      = COALESCE(${nomeVal}, nome),
        jogadores = COALESCE(${jogVal}::jsonb, jogadores),
        updated_at = NOW()
      WHERE id = ${id}
    `
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
    await sql`DELETE FROM relatorios_jogadores WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
