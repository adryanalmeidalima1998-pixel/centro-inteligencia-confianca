import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'
import { ensureCorpoCoreSchema } from '@/lib/corpo-core-schema'

export async function GET() {
  await ensureCorpoCoreSchema()
  try {
    const result = await sql`SELECT * FROM player_aliases ORDER BY source`
    return NextResponse.json({ aliases: result.rows })
  } catch (err) {
    return NextResponse.json({ aliases: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  await ensureCorpoCoreSchema()
  try {
    const { source_name, canonical_name, source } = await request.json()
    if (!source_name || !canonical_name) {
      return NextResponse.json({ error: 'Campos obrigatórios: source_name, canonical_name' }, { status: 400 })
    }
    // Upsert: se já existe source_name nessa source, atualiza
    const result = await sql`
      INSERT INTO player_aliases (source_name, canonical_name, source)
      VALUES (${source_name}, ${canonical_name}, ${source || 'manual'})
      ON CONFLICT (source_name, source) DO UPDATE
        SET canonical_name = EXCLUDED.canonical_name,
            updated_at = NOW()
      RETURNING *
    `
    return NextResponse.json({ alias: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
