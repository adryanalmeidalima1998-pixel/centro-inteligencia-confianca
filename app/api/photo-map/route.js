import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// GET /api/photo-map → { map: { "nome canonical": "arquivo.png", ... } }
export async function GET() {
  try {
    // Garante que a tabela existe (cria se não existir)
    await sql`
      CREATE TABLE IF NOT EXISTS player_photo_map (
        id          SERIAL PRIMARY KEY,
        player_name TEXT    NOT NULL UNIQUE,
        filename    TEXT    NOT NULL,
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `
    const result = await sql`SELECT player_name, filename FROM player_photo_map`
    const map = {}
    result.rows.forEach(r => { map[r.player_name] = r.filename })
    return NextResponse.json({ map })
  } catch (err) {
    console.error('[GET /api/photo-map]', err)
    return NextResponse.json({ map: {}, error: err.message }, { status: 500 })
  }
}

// POST /api/photo-map  body: { player_name, filename }  (filename null = remove)
export async function POST(request) {
  try {
    const { player_name, filename } = await request.json()
    if (!player_name) return NextResponse.json({ error: 'player_name obrigatório' }, { status: 400 })

    if (!filename) {
      // Remover associação
      await sql`DELETE FROM player_photo_map WHERE player_name = ${player_name}`
      return NextResponse.json({ ok: true, removed: true })
    }

    // Upsert
    await sql`
      INSERT INTO player_photo_map (player_name, filename, updated_at)
      VALUES (${player_name}, ${filename}, NOW())
      ON CONFLICT (player_name) DO UPDATE
        SET filename   = EXCLUDED.filename,
            updated_at = NOW()
    `
    return NextResponse.json({ ok: true, player_name, filename })
  } catch (err) {
    console.error('[POST /api/photo-map]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
