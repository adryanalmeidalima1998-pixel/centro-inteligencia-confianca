/**
 * GET  /api/ligas-v2/[slug]/categorias-rodada?rodada=3
 *   → retorna as 4 categorias salvas da rodada
 *
 * POST /api/ligas-v2/[slug]/categorias-rodada
 *   body: { rodada, categoria, jogador_nome, clube, justificativa }
 *   → salva/atualiza uma categoria específica
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const runtime = 'nodejs'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS categorias_rodada (
      id            SERIAL PRIMARY KEY,
      slug          TEXT NOT NULL,
      rodada        INTEGER NOT NULL,
      categoria     TEXT NOT NULL,
      jogador_nome  TEXT,
      clube         TEXT,
      justificativa TEXT,
      criado_em     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(slug, rodada, categoria)
    )
  `
}

export async function GET(req, { params }) {
  const { slug }       = await params
  const { searchParams } = new URL(req.url)
  const rodada           = parseInt(searchParams.get('rodada') || '0')

  if (!rodada) return NextResponse.json({ error: 'rodada obrigatória' }, { status: 400 })

  try {
    await ensureTable()
    const { rows } = await sql`
      SELECT categoria, jogador_nome, clube, justificativa, criado_em
      FROM categorias_rodada
      WHERE slug = ${slug} AND rodada = ${rodada}
    `
    // Transforma em objeto { goleiro: {...}, defensor: {...}, motor: {...}, mvp: {...} }
    const result = {}
    for (const r of rows) result[r.categoria] = r
    return NextResponse.json({ rodada, categorias: result })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req, { params }) {
  const { slug } = await params

  try {
    await ensureTable()
    const { rodada, categoria, jogador_nome, clube, justificativa } = await req.json()

    const CATS = ['goleiro', 'defensor', 'motor', 'mvp']
    if (!rodada || !CATS.includes(categoria)) {
      return NextResponse.json({ error: 'rodada e categoria válida são obrigatórias' }, { status: 400 })
    }

    await sql`
      INSERT INTO categorias_rodada (slug, rodada, categoria, jogador_nome, clube, justificativa)
      VALUES (${slug}, ${rodada}, ${categoria}, ${jogador_nome||''}, ${clube||''}, ${justificativa||''})
      ON CONFLICT (slug, rodada, categoria) DO UPDATE SET
        jogador_nome  = ${jogador_nome||''},
        clube         = ${clube||''},
        justificativa = ${justificativa||''},
        criado_em     = NOW()
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
