import { sql } from '@vercel/postgres'
import { ensureTreinadoresSchema } from '@/lib/treinadores-schema'
import { sanitizeCoachReport } from '@/lib/treinador-report-sanitizer'

export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  try {
    await ensureTreinadoresSchema()
    const { id } = await params
    const row = await sql`SELECT * FROM treinadores WHERE id = ${id}`
    if (!row.rows[0]) return Response.json({ error:'Treinador não encontrado.' }, { status:404 })
    const coach = row.rows[0]
    const report = sanitizeCoachReport(coach.relatorio_json || {})
    return Response.json({ coach:{...coach,relatorio_json:report,estilo_jogo:report.resumo_executivo||coach.estilo_jogo,forcas:(report.pontos_fortes||[]).map(x=>x.titulo).filter(Boolean).join(' · ')||null,fraquezas:(report.pontos_melhoria||[]).map(x=>x.titulo).filter(Boolean).join(' · ')||null} })
  } catch (err) { return Response.json({ error:err.message }, { status:500 }) }
}

export async function PUT(request, { params }) {
  try {
    await ensureTreinadoresSchema()
    const { id } = await params
    const body = await request.json()
    const sanitized = sanitizeCoachReport(body.relatorio_json || {})
    const report = JSON.stringify(sanitized)
    const recommendation = body.recomendacao || sanitized?.recomendacao || 'Em análise'
    const stars = body.estrelas == null ? null : Math.max(1, Math.min(5, Number(body.estrelas)))

    const row = await sql`
      UPDATE treinadores SET
        relatorio_json = ${report}::jsonb,
        recomendacao = ${recommendation},
        estrelas = ${stars},
        estilo_jogo = ${body.estilo_jogo || null},
        forcas = ${body.forcas || null},
        fraquezas = ${body.fraquezas || null},
        atualizado_em = NOW()
      WHERE id = ${id}
      RETURNING id
    `
    if (!row.rows[0]) return Response.json({ error:'Treinador não encontrado.' }, { status:404 })
    return Response.json({ success:true })
  } catch (err) { return Response.json({ error:err.message }, { status:500 }) }
}

export async function DELETE(_request, { params }) {
  try {
    await ensureTreinadoresSchema()
    const { id } = await params
    await sql`DELETE FROM treinadores WHERE id = ${id}`
    return Response.json({ success:true })
  } catch (err) { return Response.json({ error:err.message }, { status:500 }) }
}
