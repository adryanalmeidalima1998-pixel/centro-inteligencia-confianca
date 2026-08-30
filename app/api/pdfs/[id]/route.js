import { sql } from '@vercel/postgres'
import { del } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { ensureCorpoCoreSchema } from '@/lib/corpo-core-schema'

export async function DELETE(request, { params }) {
  await ensureCorpoCoreSchema()
  try {
    const { id } = params

    // Fetch URL before deleting
    const row = await sql`SELECT url FROM training_pdfs WHERE id = ${id}`
    if (!row.rows.length) {
      return NextResponse.json({ error: 'PDF não encontrado.' }, { status: 404 })
    }

    // Delete from Blob
    await del(row.rows[0].url)

    // Delete from Postgres
    await sql`DELETE FROM training_pdfs WHERE id = ${id}`

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/pdfs/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
