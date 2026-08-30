import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS observacao_partidas (
      id          SERIAL PRIMARY KEY,
      mandante    TEXT NOT NULL,
      visitante   TEXT NOT NULL,
      data        TEXT,
      hora        TEXT,
      comp        TEXT DEFAULT 'Série C',
      pais        TEXT,
      local       TEXT,
      scout       TEXT,
      status      TEXT DEFAULT 'Pendente',
      obs         TEXT,
      pdf_base64  TEXT,
      pdf_name    TEXT,
      match_key   TEXT UNIQUE,
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Migrations para tabelas existentes
  await sql`ALTER TABLE observacao_partidas ADD COLUMN IF NOT EXISTS match_key TEXT`
  await sql`ALTER TABLE observacao_partidas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`
  await sql`ALTER TABLE observacao_partidas ADD COLUMN IF NOT EXISTS pais TEXT`
  // Garante UNIQUE constraint no match_key (pode ter sido adicionado sem constraint via ALTER TABLE)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_match_key ON observacao_partidas(match_key) WHERE match_key IS NOT NULL`.catch(()=>{})
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const pdfId = searchParams.get('pdf')

    if (pdfId) {
      const row = await sql`SELECT pdf_base64, pdf_name FROM observacao_partidas WHERE id = ${pdfId}`
      if (!row.rows[0]?.pdf_base64) return Response.json({ error: 'PDF não encontrado' }, { status: 404 })
      const buf = Buffer.from(row.rows[0].pdf_base64, 'base64')
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${row.rows[0].pdf_name || 'relatorio.pdf'}"`,
        },
      })
    }

    const rows = await sql`
      SELECT id, mandante, visitante, data, hora, comp, pais, local, scout, status, obs, pdf_name, match_key, updated_at, created_at
      FROM observacao_partidas ORDER BY data ASC, hora ASC
    `
    return Response.json({ jogos: rows.rows })
  } catch (err) {
    return Response.json({ jogos: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const formData = await request.formData()
    const file = formData.get('pdf')
    const body = JSON.parse(formData.get('data') || '{}')
    const { mandante, visitante, data, hora, comp, pais, local, scout, status, obs, match_key } = body

    let pdfBase64 = null, pdfName = null
    if (file && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer())
      pdfBase64 = buf.toString('base64')
      pdfName = file.name
    }

    const mk = match_key || `${(mandante||'').toLowerCase()}|${(visitante||'').toLowerCase()}|${(data||'')}`

    const row = await sql`
      INSERT INTO observacao_partidas (mandante, visitante, data, hora, comp, pais, local, scout, status, obs, pdf_base64, pdf_name, match_key, updated_at)
      VALUES (${mandante}, ${visitante}, ${data||null}, ${hora||null}, ${comp||'Série C'},
              ${pais||null}, ${local||null}, ${scout||null}, ${status||'Pendente'}, ${obs||null}, ${pdfBase64}, ${pdfName}, ${mk}, NOW())
      ON CONFLICT (match_key) DO UPDATE SET
        mandante   = COALESCE(EXCLUDED.mandante, observacao_partidas.mandante),
        visitante  = COALESCE(EXCLUDED.visitante, observacao_partidas.visitante),
        data       = COALESCE(EXCLUDED.data, observacao_partidas.data),
        hora       = COALESCE(EXCLUDED.hora, observacao_partidas.hora),
        comp       = COALESCE(EXCLUDED.comp, observacao_partidas.comp),
        pais       = COALESCE(EXCLUDED.pais, observacao_partidas.pais),
        scout      = COALESCE(EXCLUDED.scout, observacao_partidas.scout),
        status     = COALESCE(EXCLUDED.status, observacao_partidas.status),
        pdf_base64 = CASE WHEN EXCLUDED.pdf_base64 IS NOT NULL THEN EXCLUDED.pdf_base64 ELSE observacao_partidas.pdf_base64 END,
        pdf_name   = CASE WHEN EXCLUDED.pdf_name IS NOT NULL THEN EXCLUDED.pdf_name ELSE observacao_partidas.pdf_name END,
        updated_at = NOW()
      RETURNING id
    `
    return Response.json({ success: true, id: row.rows[0].id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    await ensureTable()
    const formData = await request.formData()
    const file = formData.get('pdf')
    const body = JSON.parse(formData.get('data') || '{}')
    const { id, status, obs } = body

    let pdfBase64Update = '', pdfNameUpdate = ''
    if (file && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer())
      pdfBase64Update = buf.toString('base64')
      pdfNameUpdate = file.name
    }

    await sql`
      UPDATE observacao_partidas SET
        status     = COALESCE(${status||null}, status),
        obs        = COALESCE(${obs||null}, obs),
        pdf_base64 = CASE WHEN ${pdfBase64Update||null} IS NOT NULL THEN ${pdfBase64Update||null} ELSE pdf_base64 END,
        pdf_name   = CASE WHEN ${pdfNameUpdate||null} IS NOT NULL THEN ${pdfNameUpdate||null} ELSE pdf_name END,
        updated_at = NOW()
      WHERE id = ${id}
    `
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    await sql`DELETE FROM observacao_partidas WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
