/**
 * POST /api/ligas-v2/logo?slug=xxx  — salva logo em base64 no banco
 * GET  /api/ligas-v2/logo?slug=xxx  — retorna a logo
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS liga_logos (
      slug       TEXT PRIMARY KEY,
      logo_b64   TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {})
}

export async function POST(req) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })
  try {
    await ensureTable()
    const fd   = await req.formData()
    const file = fd.get('file')
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo' }, { status: 400 })
    const buf  = Buffer.from(await file.arrayBuffer())
    const b64  = `data:${file.type};base64,${buf.toString('base64')}`
    await sql`
      INSERT INTO liga_logos (slug, logo_b64, updated_at)
      VALUES (${slug}, ${b64}, NOW())
      ON CONFLICT (slug) DO UPDATE SET logo_b64 = EXCLUDED.logo_b64, updated_at = NOW()
    `
    return NextResponse.json({ ok: true, slug })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })
  try {
    await ensureTable()
    const r = await sql`SELECT logo_b64 FROM liga_logos WHERE slug = ${slug}`
    if (!r.rows.length) return NextResponse.json({ logo: null })
    return NextResponse.json({ logo: r.rows[0].logo_b64 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
