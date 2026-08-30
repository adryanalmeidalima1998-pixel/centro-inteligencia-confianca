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

export async function GET() {
  try {
    await ensureTable()
    const result = await sql`SELECT * FROM cig_shadow_teams ORDER BY updated_at DESC, id DESC`
    return NextResponse.json({ teams:result.rows })
  } catch (error) { return NextResponse.json({ error:error.message }, { status:500 }) }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error:'Informe o nome do Time Shadow.' }, { status:400 })
    const result = await sql`
      INSERT INTO cig_shadow_teams (name, formation, slots, notes)
      VALUES (${name}, ${body.formation || '4-3-3'}, ${JSON.stringify(body.slots || {})}::jsonb, ${body.notes || ''})
      RETURNING *
    `
    return NextResponse.json({ team:result.rows[0] })
  } catch (error) { return NextResponse.json({ error:error.message }, { status:500 }) }
}
