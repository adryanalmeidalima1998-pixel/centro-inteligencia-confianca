import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS treino_duracao (
      data          DATE PRIMARY KEY,
      duracao_min   INTEGER NOT NULL,
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `
}

export async function GET() {
  try {
    await ensureTable()
    const result = await sql`SELECT data, duracao_min FROM treino_duracao ORDER BY data ASC`
    const map = {}
    result.rows.forEach(r => {
      const d = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data).slice(0, 10)
      map[d] = Number(r.duracao_min)
    })
    return NextResponse.json({ duracoes: map })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { data, duracao_min } = body
    if (!data || duracao_min == null) {
      return NextResponse.json({ error: 'data e duracao_min são obrigatórios' }, { status: 400 })
    }
    await sql`
      INSERT INTO treino_duracao (data, duracao_min, atualizado_em)
      VALUES (${data}, ${duracao_min}, NOW())
      ON CONFLICT (data) DO UPDATE SET duracao_min = ${duracao_min}, atualizado_em = NOW()
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const data = searchParams.get('data')
    if (!data) return NextResponse.json({ error: 'data é obrigatória' }, { status: 400 })
    await sql`DELETE FROM treino_duracao WHERE data = ${data}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
