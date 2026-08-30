import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'
import { ensureCorpoCoreSchema } from '@/lib/corpo-core-schema'

export async function DELETE(request, { params }) {
  await ensureCorpoCoreSchema()
  try {
    await sql`DELETE FROM player_aliases WHERE id = ${params.id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
