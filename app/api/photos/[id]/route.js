import { sql } from '@vercel/postgres'
import { del } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  const { id } = params

  // Tenta deletar do Postgres (fotos enviadas via upload)
  // Se o id for numérico, é uma foto do banco; se for string (filename), é local
  const isNumeric = /^\d+$/.test(id)

  if (isNumeric) {
    try {
      // Busca a URL antes de deletar (para remover do Blob)
      const existing = await sql`SELECT url FROM player_photos WHERE id = ${parseInt(id)}`
      if (existing.rows.length > 0) {
        const url = existing.rows[0].url
        // Deleta do Vercel Blob (se for URL do Blob, não local)
        if (url && url.startsWith('https://')) {
          try { await del(url) } catch (_) { /* não crítico */ }
        }
        await sql`DELETE FROM player_photos WHERE id = ${parseInt(id)}`
      }
    } catch (err) {
      console.error('[DELETE /api/photos]', err)
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }
  // Fotos locais (public/photoplayers) não são deletadas do filesystem em produção

  return NextResponse.json({ ok: true })
}
