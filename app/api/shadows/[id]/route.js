import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS cig_shadow_teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      formation TEXT NOT NULL DEFAULT '4-3-3',
      slots JSONB NOT NULL DEFAULT '{}'::jsonb,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function GET(request, { params }) {
  const { id } = await params
  try {
    await ensureTable()
    const result = await sql`SELECT * FROM cig_shadow_teams WHERE id = ${Number(id)} LIMIT 1`
    if (!result.rows.length) return NextResponse.json({ error:'Time Shadow não encontrado.' }, { status:404 })
    return NextResponse.json({ team:result.rows[0] })
  } catch (error) { return NextResponse.json({ error:error.message }, { status:500 }) }
}

export async function PATCH(request, { params }) {
  const { id } = await params
  try {
    await ensureTable()
    const body = await request.json()
    const result = await sql`
      UPDATE cig_shadow_teams SET
        name = COALESCE(NULLIF(${body.name || ''}, ''), name),
        formation = COALESCE(NULLIF(${body.formation || ''}, ''), formation),
        slots = COALESCE(${body.slots ? JSON.stringify(body.slots) : null}::jsonb, slots),
        notes = COALESCE(${body.notes ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `
    if (!result.rows.length) return NextResponse.json({ error:'Time Shadow não encontrado.' }, { status:404 })
    return NextResponse.json({ team:result.rows[0] })
  } catch (error) { return NextResponse.json({ error:error.message }, { status:500 }) }
}

export async function DELETE(request, { params }) {
  const { id } = await params
  try {
    await ensureTable()
    await sql`DELETE FROM cig_shadow_teams WHERE id = ${Number(id)}`
    return NextResponse.json({ ok:true })
  } catch (error) { return NextResponse.json({ error:error.message }, { status:500 }) }
}
