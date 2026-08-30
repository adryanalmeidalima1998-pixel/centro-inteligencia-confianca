import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS treinadores (
      id                SERIAL PRIMARY KEY,
      nome              TEXT NOT NULL,
      data_nascimento   TEXT,
      nacionalidade     TEXT,
      historico_clubes  TEXT,
      sistemas_jogo     TEXT[],
      estilo_jogo       TEXT,
      forcas            TEXT,
      fraquezas         TEXT,
      recomendacao      TEXT,
      estrelas          INTEGER,
      pdf_base64        TEXT,
      pdf_filename      TEXT,
      uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome)
    )
  `
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const pdfId = searchParams.get('pdf')
    await ensureTable()

    if (pdfId) {
      const row = await sql`SELECT pdf_base64, pdf_filename FROM treinadores WHERE id = ${pdfId}`
      if (!row.rows[0]?.pdf_base64) return Response.json({ error: 'PDF não encontrado' }, { status: 404 })
      const buf = Buffer.from(row.rows[0].pdf_base64, 'base64')
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${row.rows[0].pdf_filename || 'treinador.pdf'}"`,
        },
      })
    }

    const rows = await sql`
      SELECT id, nome, data_nascimento, nacionalidade, historico_clubes,
             sistemas_jogo, estilo_jogo, forcas, fraquezas, recomendacao,
             estrelas, pdf_filename, uploaded_at
      FROM treinadores
      ORDER BY
        CASE recomendacao WHEN 'Recomendado' THEN 1 WHEN 'Com Ressalvas' THEN 2 ELSE 3 END,
        estrelas DESC NULLS LAST
    `
    return Response.json({ coaches: rows.rows, total: rows.rows.length })
  } catch (err) {
    return Response.json({ coaches: [], total: 0, error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const formData = await request.formData()
    const file = formData.get('file')
    const dataRaw = formData.get('extracted_data')
    if (!dataRaw) return Response.json({ error: 'dados obrigatórios' }, { status: 400 })

    const d = JSON.parse(dataRaw)
    let pdfBase64 = null, pdfFilename = null

    if (file) {
      const buf = Buffer.from(await file.arrayBuffer())
      pdfBase64 = buf.toString('base64')
      pdfFilename = file.name
    }

    await sql`
      INSERT INTO treinadores (nome, data_nascimento, nacionalidade, historico_clubes,
        sistemas_jogo, estilo_jogo, forcas, fraquezas, recomendacao, estrelas, pdf_base64, pdf_filename)
      VALUES (
        ${d.nome}, ${d.data_nascimento}, ${d.nacionalidade}, ${d.historico_clubes},
        ${d.sistemas_jogo || []}, ${d.estilo_jogo}, ${d.forcas}, ${d.fraquezas},
        ${d.recomendacao}, ${d.estrelas}, ${pdfBase64}, ${pdfFilename}
      )
      ON CONFLICT (nome) DO UPDATE SET
        recomendacao = ${d.recomendacao}, estrelas = ${d.estrelas},
        pdf_base64 = COALESCE(${pdfBase64}, treinadores.pdf_base64),
        uploaded_at = NOW()
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
    await sql`DELETE FROM treinadores WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
