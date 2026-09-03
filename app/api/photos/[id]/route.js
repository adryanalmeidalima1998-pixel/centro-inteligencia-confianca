import { sql } from '@vercel/postgres'
import { del } from '@vercel/blob'
import { NextResponse } from 'next/server'

async function ensureHiddenTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS player_photo_hidden (
      filename  TEXT PRIMARY KEY,
      hidden_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params
    const id = decodeURIComponent(String(resolvedParams?.id || ''))
    if (!id) return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 })

    await ensureHiddenTable()
    const isNumeric = /^\d+$/.test(id)

    if (isNumeric) {
      // Foto enviada pelo dashboard: remove Blob e registro do banco.
      const photoId = Number(id)
      const existing = await sql`SELECT url FROM player_photos WHERE id = ${photoId}`
      if (existing.rows.length > 0) {
        const url = existing.rows[0].url
        if (url && url.startsWith('https://')) {
          try { await del(url) } catch (err) { console.warn('[DELETE /api/photos] Blob:', err.message) }
        }
        await sql`DELETE FROM player_photos WHERE id = ${photoId}`
      }
      return NextResponse.json({ ok: true, source: 'db' })
    }

    // Foto que veio empacotada em public/photoplayers: o filesystem da Vercel
    // é somente leitura. Guardamos o filename como removido no Postgres para
    // ela deixar de aparecer de forma persistente em todos os dispositivos.
    await sql`
      INSERT INTO player_photo_hidden (filename, hidden_at)
      VALUES (${id}, NOW())
      ON CONFLICT (filename) DO UPDATE SET hidden_at = NOW()
    `
    return NextResponse.json({ ok: true, source: 'local', hidden: true })
  } catch (err) {
    console.error('[DELETE /api/photos]', err)
    return NextResponse.json({ error: err.message || 'Não foi possível excluir a foto.' }, { status: 500 })
  }
}
