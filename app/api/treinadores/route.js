import { sql } from '@vercel/postgres'
import { ensureTreinadoresSchema } from '@/lib/treinadores-schema'
import { sanitizeCoachReport } from '@/lib/treinador-report-sanitizer'

export async function GET(request) {
  try {
    await ensureTreinadoresSchema()
    const { searchParams } = new URL(request.url)
    const pdfId = searchParams.get('pdf')

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
      SELECT id, nome, data_nascimento, idade, nacionalidade, clube_atual, cargo_atual,
             licenca, formacao_preferida, foto_url, transfermarkt_url, performance_url,
             sistemas_jogo, estilo_jogo, forcas, fraquezas, recomendacao, estrelas,
             metricas_json, relatorio_json, pdf_filename, fonte_atualizada_em, atualizado_em, uploaded_at
      FROM treinadores
      ORDER BY atualizado_em DESC NULLS LAST, uploaded_at DESC
    `
    const coaches = rows.rows.map(coach => {
      const report = sanitizeCoachReport(coach.relatorio_json || {})
      return {
        ...coach,
        relatorio_json: report,
        estilo_jogo: report.resumo_executivo || coach.estilo_jogo,
        forcas: (report.pontos_fortes || []).map(x=>x.titulo).filter(Boolean).join(' · ') || null,
        fraquezas: (report.pontos_melhoria || []).map(x=>x.titulo).filter(Boolean).join(' · ') || null
      }
    })
    return Response.json({ coaches, total: coaches.length })
  } catch (err) {
    return Response.json({ coaches: [], total: 0, error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTreinadoresSchema()
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const d = await request.json()
      if (!d?.nome) return Response.json({ error: 'Nome obrigatório.' }, { status: 400 })
      const sanitizedReport = sanitizeCoachReport(d.relatorio_json || {})
      const report = JSON.stringify(sanitizedReport)
      const metrics = JSON.stringify(d.metricas_json || {})
      const career = JSON.stringify(d.carreira_json || [])
      const games = JSON.stringify(d.jogos_json || [])
      const row = await sql`
        INSERT INTO treinadores (
          nome, data_nascimento, idade, nacionalidade, clube_atual, cargo_atual, licenca,
          formacao_preferida, foto_url, transfermarkt_url, performance_url, transfermarkt_id,
          carreira_json, jogos_json, metricas_json, relatorio_json, recomendacao, estrelas, atualizado_em
        ) VALUES (
          ${d.nome}, ${d.data_nascimento || null}, ${d.idade || null}, ${d.nacionalidade || null},
          ${d.clube_atual || null}, ${d.cargo_atual || null}, ${d.licenca || null}, ${d.formacao_preferida || null},
          ${d.foto_url || null}, ${d.transfermarkt_url || null}, ${d.performance_url || null}, ${d.transfermarkt_id || null},
          ${career}::jsonb, ${games}::jsonb, ${metrics}::jsonb, ${report}::jsonb,
          ${d.recomendacao || 'Em análise'}, ${d.estrelas || null}, NOW()
        )
        ON CONFLICT (nome) DO UPDATE SET
          data_nascimento = EXCLUDED.data_nascimento,
          idade = EXCLUDED.idade,
          nacionalidade = EXCLUDED.nacionalidade,
          clube_atual = EXCLUDED.clube_atual,
          cargo_atual = EXCLUDED.cargo_atual,
          licenca = EXCLUDED.licenca,
          formacao_preferida = EXCLUDED.formacao_preferida,
          foto_url = COALESCE(EXCLUDED.foto_url, treinadores.foto_url),
          transfermarkt_url = COALESCE(EXCLUDED.transfermarkt_url, treinadores.transfermarkt_url),
          performance_url = COALESCE(EXCLUDED.performance_url, treinadores.performance_url),
          transfermarkt_id = COALESCE(EXCLUDED.transfermarkt_id, treinadores.transfermarkt_id),
          carreira_json = EXCLUDED.carreira_json,
          jogos_json = EXCLUDED.jogos_json,
          metricas_json = EXCLUDED.metricas_json,
          relatorio_json = EXCLUDED.relatorio_json,
          recomendacao = EXCLUDED.recomendacao,
          estrelas = EXCLUDED.estrelas,
          atualizado_em = NOW()
        RETURNING id
      `
      return Response.json({ success: true, id: row.rows[0]?.id })
    }

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
        sistemas_jogo, estilo_jogo, forcas, fraquezas, recomendacao, estrelas, pdf_base64, pdf_filename, atualizado_em)
      VALUES (
        ${d.nome}, ${d.data_nascimento}, ${d.nacionalidade}, ${d.historico_clubes},
        ${d.sistemas_jogo || []}, ${d.estilo_jogo}, ${d.forcas}, ${d.fraquezas},
        ${d.recomendacao}, ${d.estrelas}, ${pdfBase64}, ${pdfFilename}, NOW()
      )
      ON CONFLICT (nome) DO UPDATE SET
        data_nascimento = COALESCE(EXCLUDED.data_nascimento, treinadores.data_nascimento),
        nacionalidade = COALESCE(EXCLUDED.nacionalidade, treinadores.nacionalidade),
        historico_clubes = COALESCE(EXCLUDED.historico_clubes, treinadores.historico_clubes),
        sistemas_jogo = COALESCE(EXCLUDED.sistemas_jogo, treinadores.sistemas_jogo),
        estilo_jogo = COALESCE(EXCLUDED.estilo_jogo, treinadores.estilo_jogo),
        forcas = COALESCE(EXCLUDED.forcas, treinadores.forcas),
        fraquezas = COALESCE(EXCLUDED.fraquezas, treinadores.fraquezas),
        recomendacao = COALESCE(EXCLUDED.recomendacao, treinadores.recomendacao),
        estrelas = COALESCE(EXCLUDED.estrelas, treinadores.estrelas),
        pdf_base64 = COALESCE(${pdfBase64}, treinadores.pdf_base64),
        pdf_filename = COALESCE(${pdfFilename}, treinadores.pdf_filename),
        atualizado_em = NOW()
    `
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureTreinadoresSchema()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'ID obrigatório' }, { status: 400 })
    await sql`DELETE FROM treinadores WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
