import { sql } from '@vercel/postgres'

/* ─────────────────────────────────────────────────────────────────────────────
   TransferRoom · Centro de Inteligência · Confiança
   Tabela auto-criada (padrão do projeto — não precisa rodar SQL manual).
   Guarda jogadores INDICADOS pelo scouting e CONTRATADOS pelo clube, por posição.
   Foto e PDF do relatório ficam em base64 e são servidos por ?foto=id / ?pdf=id.
   O card sinaliza "relatório feito" automaticamente quando existe PDF anexado.
   ──────────────────────────────────────────────────────────────────────────── */

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS transferroom (
      id                    SERIAL PRIMARY KEY,
      nome                  TEXT NOT NULL,
      clube                 TEXT,
      idade                 INTEGER,
      posicao               TEXT,
      pe_preferido          TEXT,
      tipo                  TEXT DEFAULT 'indicado',   -- 'radar' | 'indicado' | 'contratado' | 'elenco'
      observacoes           TEXT,
      mes                   TEXT,                       -- p/ radar (ex.: 'Maio/2026')
      link                  TEXT,                       -- p/ radar (ogol/transfermarkt)
      irc                   TEXT,                       -- p/ indicação concluída
      decisao               TEXT,                       -- Contratação | Não contratação
      foto_base64           TEXT,
      relatorio_pdf_base64  TEXT,
      relatorio_nome        TEXT,
      foto_url              TEXT,                       -- Vercel Blob (quando disponível)
      relatorio_url         TEXT,                       -- Vercel Blob (quando disponível)
      created_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Migrations defensivas para bases já existentes
  const cols = [
    ['clube',                'TEXT'],
    ['idade',                'INTEGER'],
    ['posicao',              'TEXT'],
    ['pe_preferido',         'TEXT'],
    ['tipo',                 "TEXT DEFAULT 'indicado'"],
    ['observacoes',          'TEXT'],
    ['mes',                  'TEXT'],
    ['link',                 'TEXT'],
    ['irc',                  'TEXT'],
    ['decisao',              'TEXT'],
    ['foto_base64',          'TEXT'],
    ['relatorio_pdf_base64', 'TEXT'],
    ['relatorio_nome',       'TEXT'],
    ['foto_url',             'TEXT'],
    ['relatorio_url',        'TEXT'],
  ]
  for (const [col, type] of cols) {
    try { await sql.query(`ALTER TABLE transferroom ADD COLUMN IF NOT EXISTS ${col} ${type}`) } catch (_) {}
  }
}

// Sobe um arquivo pro Vercel Blob se o pacote/token existirem; senão retorna null
// (aí o fluxo cai no armazenamento em base64, mantendo compatibilidade).
async function uploadBlob(path, file, contentType) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const { put } = await import('@vercel/blob')
    const { url } = await put(path, file, { access: 'public', contentType, addRandomSuffix: true })
    return url
  } catch (_) { return null }
}

const SELECT_FIELDS = sql`
  id, nome, clube, idade, posicao, pe_preferido, tipo, observacoes, mes, link, irc, decisao, created_at,
  CASE WHEN foto_base64 IS NOT NULL OR foto_url IS NOT NULL THEN TRUE ELSE FALSE END AS tem_foto,
  CASE WHEN relatorio_pdf_base64 IS NOT NULL OR relatorio_url IS NOT NULL THEN TRUE ELSE FALSE END AS tem_relatorio,
  foto_url, relatorio_url, relatorio_nome
`

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const fotoId = searchParams.get('foto')
    const pdfId  = searchParams.get('pdf')

    // Serve foto (redireciona pro Blob se houver URL; senão base64)
    if (fotoId) {
      const rows = await sql`SELECT foto_base64, foto_url FROM transferroom WHERE id = ${fotoId}`
      const row = rows.rows[0]
      if (row?.foto_url) return Response.redirect(row.foto_url, 307)
      if (!row?.foto_base64) return new Response('Not found', { status: 404 })
      const buf = Buffer.from(row.foto_base64, 'base64')
      return new Response(buf, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } })
    }

    // Serve PDF do relatório (inline; redireciona pro Blob se houver URL)
    if (pdfId) {
      const rows = await sql`SELECT relatorio_pdf_base64, relatorio_url, relatorio_nome FROM transferroom WHERE id = ${pdfId}`
      const row = rows.rows[0]
      if (row?.relatorio_url) return Response.redirect(row.relatorio_url, 307)
      if (!row?.relatorio_pdf_base64) return new Response('Not found', { status: 404 })
      const buf = Buffer.from(row.relatorio_pdf_base64, 'base64')
      const nome = (row.relatorio_nome || `relatorio-${pdfId}.pdf`).replace(/"/g, '')
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${nome}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }

    const rows = await sql`
      SELECT ${SELECT_FIELDS}
      FROM transferroom
      ORDER BY created_at DESC
    `
    return Response.json({ players: rows.rows })
  } catch (err) {
    return Response.json({ players: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()

    // Insert em lote (usado pelos botões "Importar") — loop com o mesmo
    // mecanismo do insert individual, para gravar todos os campos corretamente.
    if (Array.isArray(body.bulk)) {
      const items = body.bulk.filter(p => p && p.nome)
      for (const p of items) {
        await sql`
          INSERT INTO transferroom (nome, clube, idade, posicao, pe_preferido, tipo, observacoes, mes, link, irc, decisao)
          VALUES (${p.nome}, ${p.clube || null}, ${p.idade || null}, ${p.posicao || null}, ${p.pe_preferido || null},
                  ${p.tipo || 'indicado'}, ${p.observacoes || null}, ${p.mes || null}, ${p.link || null}, ${p.irc || null}, ${p.decisao || null})
        `
      }
      return Response.json({ success: true, inserted: items.length })
    }

    const { nome, clube, idade, posicao, pe_preferido, tipo = 'indicado', observacoes, mes, link, irc, decisao } = body
    if (!nome) return Response.json({ error: 'nome obrigatório' }, { status: 400 })

    const rows = await sql`
      INSERT INTO transferroom (nome, clube, idade, posicao, pe_preferido, tipo, observacoes, mes, link, irc, decisao)
      VALUES (${nome}, ${clube || null}, ${idade || null}, ${posicao || null}, ${pe_preferido || null},
              ${tipo}, ${observacoes || null}, ${mes || null}, ${link || null}, ${irc || null}, ${decisao || null})
      RETURNING id
    `
    return Response.json({ success: true, id: rows.rows[0]?.id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    await ensureTable()
    const ct = request.headers.get('content-type') || ''

    // Upload de foto ou PDF via FormData
    if (ct.includes('multipart/form-data')) {
      const fd   = await request.formData()
      const id   = fd.get('id')
      const foto = fd.get('foto')
      const pdf  = fd.get('pdf')
      if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

      if (foto && typeof foto !== 'string') {
        const url = await uploadBlob(`transferroom/foto-${id}.jpg`, foto, foto.type || 'image/jpeg')
        if (url) {
          await sql`UPDATE transferroom SET foto_url = ${url}, foto_base64 = NULL WHERE id = ${id}`
        } else {
          const base64 = Buffer.from(await foto.arrayBuffer()).toString('base64')
          await sql`UPDATE transferroom SET foto_base64 = ${base64}, foto_url = NULL WHERE id = ${id}`
        }
        return Response.json({ success: true, foto_url: `/api/transferroom?foto=${id}` })
      }

      if (pdf && typeof pdf !== 'string') {
        const nome = pdf.name || `relatorio-${id}.pdf`
        const url = await uploadBlob(`transferroom/pdf-${id}.pdf`, pdf, 'application/pdf')
        if (url) {
          await sql`UPDATE transferroom SET relatorio_url = ${url}, relatorio_nome = ${nome}, relatorio_pdf_base64 = NULL WHERE id = ${id}`
        } else {
          const base64 = Buffer.from(await pdf.arrayBuffer()).toString('base64')
          await sql`UPDATE transferroom SET relatorio_pdf_base64 = ${base64}, relatorio_nome = ${nome}, relatorio_url = NULL WHERE id = ${id}`
        }
        return Response.json({ success: true, pdf_url: `/api/transferroom?pdf=${id}` })
      }

      return Response.json({ error: 'nenhum arquivo enviado' }, { status: 400 })
    }

    // Atualização de campos / remoção de anexos via JSON
    const body = await request.json()
    const { id, remove } = body
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

    if (remove === 'foto') {
      await sql`UPDATE transferroom SET foto_base64 = NULL, foto_url = NULL WHERE id = ${id}`
      return Response.json({ success: true })
    }
    if (remove === 'pdf') {
      await sql`UPDATE transferroom SET relatorio_pdf_base64 = NULL, relatorio_url = NULL, relatorio_nome = NULL WHERE id = ${id}`
      return Response.json({ success: true })
    }

    const { nome, clube, idade, posicao, pe_preferido, tipo, observacoes, mes, link, irc, decisao } = body
    await sql`
      UPDATE transferroom SET
        nome         = COALESCE(${nome         || null}, nome),
        clube        = COALESCE(${clube        || null}, clube),
        idade        = COALESCE(${idade        || null}, idade),
        posicao      = COALESCE(${posicao      || null}, posicao),
        pe_preferido = COALESCE(${pe_preferido || null}, pe_preferido),
        tipo         = COALESCE(${tipo         || null}, tipo),
        observacoes  = COALESCE(${observacoes  || null}, observacoes),
        mes          = COALESCE(${mes          || null}, mes),
        link         = COALESCE(${link         || null}, link),
        irc          = COALESCE(${irc          || null}, irc),
        decisao      = COALESCE(${decisao      || null}, decisao)
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
    // Limpeza de registros vazios (órfãos de importações que falharam)
    if (searchParams.get('purge') === 'vazios') {
      const res = await sql`DELETE FROM transferroom WHERE nome IS NULL OR TRIM(nome) = ''`
      return Response.json({ success: true, deleted: res.rowCount })
    }
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
    await sql`DELETE FROM transferroom WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
