import { sql } from '@vercel/postgres'
import { ensureCigJogadores, findOrCreateJogador } from '@/app/lib/cigJogadores'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS lista_final (
      id                SERIAL PRIMARY KEY,
      jogador           TEXT NOT NULL,
      clube             TEXT,
      posicao           TEXT,
      idade             INTEGER,
      altura            TEXT,
      pe_preferido      TEXT,
      jogos             INTEGER,
      minutagem         INTEGER,
      gols              INTEGER,
      assistencias      INTEGER,
      perfil_tags       TEXT[],
      pontos_fisicos    TEXT,
      pontos_tecnicos   TEXT,
      pontos_taticos    TEXT,
      veredicto         TEXT,
      irc_final         NUMERIC(3,1),
      irc_classificacao TEXT,
      historico_score   INTEGER,
      nivel_competicao  INTEGER,
      adequacao_modelo  INTEGER,
      recomendacao      TEXT,
      pdf_base64        TEXT,
      pdf_filename      TEXT,
      foto_base64       TEXT,
      uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(jogador, clube)
    )
  `
  await sql`ALTER TABLE lista_final ADD COLUMN IF NOT EXISTS foto_base64    TEXT`
  await sql`ALTER TABLE lista_final ADD COLUMN IF NOT EXISTS origem         TEXT DEFAULT 'lista_final'`
  await sql`ALTER TABLE lista_final ADD COLUMN IF NOT EXISTS monitoramento_id INTEGER`
  // Migração: coluna de identidade canônica
  await ensureCigJogadores()
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const pdfId  = searchParams.get('pdf')
    const fotoId = searchParams.get('foto')

    if (pdfId) {
      const row = await sql`SELECT pdf_base64, pdf_filename FROM lista_final WHERE id = ${pdfId}`
      if (!row.rows[0]?.pdf_base64) return Response.json({ error: 'PDF não encontrado' }, { status: 404 })
      const buf = Buffer.from(row.rows[0].pdf_base64, 'base64')
      return new Response(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${row.rows[0].pdf_filename || 'relatorio-cig.pdf'}"`,
        },
      })
    }

    if (fotoId) {
      const row = await sql`SELECT foto_base64 FROM lista_final WHERE id = ${fotoId}`
      if (!row.rows[0]?.foto_base64) return Response.json({ error: 'Foto não encontrada' }, { status: 404 })
      const buf = Buffer.from(row.rows[0].foto_base64, 'base64')
      return new Response(buf, { headers: { 'Content-Type': 'image/jpeg' } })
    }

    const rows = await sql`
      SELECT id, jogador, clube, posicao, idade, altura, pe_preferido, jogos, minutagem,
             gols, assistencias, perfil_tags, irc_final, irc_classificacao,
             recomendacao, historico_score, nivel_competicao, adequacao_modelo,
             veredicto, pontos_fisicos, pontos_tecnicos, pontos_taticos,
             pdf_filename, uploaded_at, origem, monitoramento_id, cig_jogador_id,
             CASE WHEN foto_base64 IS NOT NULL THEN TRUE ELSE FALSE END AS tem_foto
      FROM lista_final ORDER BY
        CASE recomendacao
          WHEN 'CONTRATAÇÃO' THEN 1 WHEN 'MONITORAR' THEN 2 ELSE 3
        END, irc_final DESC NULLS LAST
    `
    return Response.json({ players: rows.rows })
  } catch (err) {
    return Response.json({ players: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()

    const contentType = request.headers.get('content-type') || ''
    let d, pdfBase64 = null, pdfFilename = null

    if (contentType.includes('application/json')) {
      const body = await request.json()
      d = body
      if (body.pdf_base64) {
        pdfBase64   = body.pdf_base64
        pdfFilename = body.pdf_filename || 'relatorio-cig.pdf'
      }
    } else {
      const formData = await request.formData()
      const file     = formData.get('file')
      const dataRaw  = formData.get('extracted_data')
      if (!dataRaw) return Response.json({ error: 'dados obrigatórios' }, { status: 400 })
      d = JSON.parse(dataRaw)
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer())
        pdfBase64   = buf.toString('base64')
        pdfFilename = file.name
      }
    }

    // Identidade canônica — não bloqueia se falhar
    const cigId = await findOrCreateJogador(d.jogador, d.clube, d.posicao)

    await sql`
      INSERT INTO lista_final (jogador, clube, posicao, idade, altura, pe_preferido, jogos, minutagem,
        gols, assistencias, perfil_tags, pontos_fisicos, pontos_tecnicos, pontos_taticos, veredicto,
        irc_final, irc_classificacao, historico_score, nivel_competicao, adequacao_modelo,
        recomendacao, pdf_base64, pdf_filename, origem, monitoramento_id, cig_jogador_id)
      VALUES (
        ${d.jogador}, ${d.clube}, ${d.posicao}, ${d.idade}, ${d.altura}, ${d.pe_preferido},
        ${d.jogos}, ${d.minutagem}, ${d.gols}, ${d.assistencias}, ${d.perfil_tags || []},
        ${d.pontos_fisicos}, ${d.pontos_tecnicos}, ${d.pontos_taticos}, ${d.veredicto},
        ${d.irc_final ?? null}, ${d.irc_classificacao || null}, ${d.historico_score ?? null},
        ${d.nivel_competicao ?? null}, ${d.adequacao_modelo ?? null}, ${d.recomendacao || null},
        ${pdfBase64}, ${pdfFilename}, ${d.origem || 'lista_final'}, ${d.monitoramento_id || null},
        ${cigId}
      )
      ON CONFLICT (jogador, clube) DO UPDATE SET
        posicao            = COALESCE(${d.posicao}, lista_final.posicao),
        idade              = COALESCE(${d.idade}, lista_final.idade),
        irc_final          = COALESCE(${d.irc_final ?? null}, lista_final.irc_final),
        irc_classificacao  = COALESCE(${d.irc_classificacao || null}, lista_final.irc_classificacao),
        recomendacao       = COALESCE(${d.recomendacao || null}, lista_final.recomendacao),
        historico_score    = COALESCE(${d.historico_score ?? null}, lista_final.historico_score),
        nivel_competicao   = COALESCE(${d.nivel_competicao ?? null}, lista_final.nivel_competicao),
        adequacao_modelo   = COALESCE(${d.adequacao_modelo ?? null}, lista_final.adequacao_modelo),
        veredicto          = COALESCE(${d.veredicto || null}, lista_final.veredicto),
        perfil_tags        = CASE WHEN array_length(${d.perfil_tags || []}::text[], 1) > 0
                             THEN ${d.perfil_tags || []} ELSE lista_final.perfil_tags END,
        pdf_base64         = COALESCE(${pdfBase64}, lista_final.pdf_base64),
        pdf_filename       = COALESCE(${pdfFilename}, lista_final.pdf_filename),
        uploaded_at        = NOW(),
        origem             = COALESCE(${d.origem || null}, lista_final.origem),
        monitoramento_id   = COALESCE(${d.monitoramento_id || null}, lista_final.monitoramento_id),
        cig_jogador_id     = COALESCE(${cigId}, lista_final.cig_jogador_id)
    `

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'lista_final', dados: { jogador: d.jogador, clube: d.clube, posicao: d.posicao, recomendacao: d.recomendacao, irc_final: d.irc_final } }),
    }).catch(() => {})

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    await ensureTable()
    const contentType = request.headers.get('content-type') || ''
    let id, fields, fotoBase64 = null

    if (contentType.includes('multipart/form-data')) {
      const fd   = await request.formData()
      const foto = fd.get('foto')
      id     = fd.get('id')
      fields = JSON.parse(fd.get('data') || '{}')
      if (foto && foto.size > 0) {
        const buf = Buffer.from(await foto.arrayBuffer())
        fotoBase64 = buf.toString('base64')
      }
    } else {
      const body = await request.json()
      id     = body.id
      fields = body
    }

    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

    const tags = Array.isArray(fields.perfil_tags)
      ? fields.perfil_tags
      : (fields.perfil_tags || '').split(',').map(t => t.trim()).filter(Boolean)

    await sql`
      UPDATE lista_final SET
        jogador           = COALESCE(NULLIF(${fields.jogador||''},''), jogador),
        clube             = COALESCE(NULLIF(${fields.clube||''},''), clube),
        posicao           = COALESCE(NULLIF(${fields.posicao||''},''), posicao),
        idade             = COALESCE(${fields.idade||null}, idade),
        altura            = COALESCE(NULLIF(${fields.altura||''},''), altura),
        pe_preferido      = COALESCE(NULLIF(${fields.pe_preferido||''},''), pe_preferido),
        jogos             = COALESCE(${fields.jogos||null}, jogos),
        minutagem         = COALESCE(${fields.minutagem||null}, minutagem),
        gols              = COALESCE(${fields.gols||null}, gols),
        assistencias      = COALESCE(${fields.assistencias||null}, assistencias),
        perfil_tags       = CASE WHEN ${tags.length} > 0 THEN ${tags} ELSE perfil_tags END,
        pontos_fisicos    = COALESCE(NULLIF(${fields.pontos_fisicos||''},''), pontos_fisicos),
        pontos_tecnicos   = COALESCE(NULLIF(${fields.pontos_tecnicos||''},''), pontos_tecnicos),
        pontos_taticos    = COALESCE(NULLIF(${fields.pontos_taticos||''},''), pontos_taticos),
        veredicto         = COALESCE(NULLIF(${fields.veredicto||''},''), veredicto),
        irc_final         = COALESCE(${fields.irc_final||null}, irc_final),
        irc_classificacao = COALESCE(NULLIF(${fields.irc_classificacao||''},''), irc_classificacao),
        historico_score   = COALESCE(${fields.historico_score||null}, historico_score),
        nivel_competicao  = COALESCE(${fields.nivel_competicao||null}, nivel_competicao),
        adequacao_modelo  = COALESCE(${fields.adequacao_modelo||null}, adequacao_modelo),
        recomendacao      = COALESCE(NULLIF(${fields.recomendacao||''},''), recomendacao),
        uploaded_at       = NOW()
      WHERE id = ${id}
    `

    if (fotoBase64) {
      await sql`
        UPDATE lista_final SET foto_base64 = ${fotoBase64}, uploaded_at = NOW() WHERE id = ${id}
      `
    }

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
    await sql`DELETE FROM lista_final WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
