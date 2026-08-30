import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS shadow_team_v2 (
      id           SERIAL PRIMARY KEY,
      slug         TEXT NOT NULL,
      team_name    TEXT NOT NULL DEFAULT 'Shadow Team',
      slots        JSONB NOT NULL DEFAULT '{}',
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

// GET /api/ligas-v2/[slug]/shadow-team
// Retorna todos os shadow teams da liga
export async function GET(req, { params }) {
  const { slug } = await params
  await ensureTable()

  try {
    const { rows } = await sql`
      SELECT id, team_name, slots, criado_em, atualizado_em
      FROM shadow_team_v2
      WHERE slug = ${slug}
      ORDER BY criado_em ASC
    `
    return Response.json({ teams: rows })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/ligas-v2/[slug]/shadow-team
// body: { id?, team_name, slots }
// Se id vier → update; senão → insert
export async function POST(req, { params }) {
  const { slug } = await params
  await ensureTable()

  try {
    const body = await req.json()
    const { id, team_name, slots } = body

    if (!team_name?.trim()) {
      return Response.json({ error: 'team_name é obrigatório' }, { status: 400 })
    }

    const slotsJson = JSON.stringify(slots || {})

    if (id) {
      await sql`
        UPDATE shadow_team_v2
        SET team_name = ${team_name.trim()},
            slots = ${slotsJson}::jsonb,
            atualizado_em = NOW()
        WHERE id = ${parseInt(id)} AND slug = ${slug}
      `
      return Response.json({ ok: true, id })
    } else {
      const { rows } = await sql`
        INSERT INTO shadow_team_v2 (slug, team_name, slots)
        VALUES (${slug}, ${team_name.trim()}, ${slotsJson}::jsonb)
        RETURNING id
      `
      return Response.json({ ok: true, id: rows[0].id })
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/ligas-v2/[slug]/shadow-team?id=123
export async function DELETE(req, { params }) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  try {
    await sql`DELETE FROM shadow_team_v2 WHERE id = ${parseInt(id)} AND slug = ${slug}`
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
