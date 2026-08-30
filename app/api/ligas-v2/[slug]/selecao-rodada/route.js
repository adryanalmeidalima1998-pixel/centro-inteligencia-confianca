import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS selecao_rodada_v2 (
      id          SERIAL PRIMARY KEY,
      slug        TEXT NOT NULL,
      rodada      INTEGER NOT NULL,
      titulo      TEXT,
      iframe_code TEXT NOT NULL,
      criado_em   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(slug, rodada)
    )
  `
}

// GET /api/ligas-v2/[slug]/selecao-rodada
export async function GET(req, { params }) {
  const { slug } = await params
  await ensureTable()

  try {
    const { rows } = await sql`
      SELECT id, rodada, titulo, iframe_code, criado_em
      FROM selecao_rodada_v2
      WHERE slug = ${slug}
      ORDER BY rodada DESC
    `
    return Response.json({ rodadas: rows })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/ligas-v2/[slug]/selecao-rodada
// body: { rodada, iframe_code, titulo? }
export async function POST(req, { params }) {
  const { slug } = await params
  await ensureTable()

  try {
    const body = await req.json()
    const { rodada, iframe_code, titulo } = body

    if (!rodada || !iframe_code?.trim()) {
      return Response.json({ error: 'rodada e iframe_code são obrigatórios' }, { status: 400 })
    }

    await sql`
      INSERT INTO selecao_rodada_v2 (slug, rodada, titulo, iframe_code)
      VALUES (${slug}, ${parseInt(rodada)}, ${titulo || null}, ${iframe_code.trim()})
      ON CONFLICT (slug, rodada)
      DO UPDATE SET
        iframe_code = ${iframe_code.trim()},
        titulo      = ${titulo || null},
        criado_em   = NOW()
    `
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/ligas-v2/[slug]/selecao-rodada?id=123
export async function DELETE(req) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  try {
    await sql`DELETE FROM selecao_rodada_v2 WHERE id = ${parseInt(id)}`
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
