import { sql } from '@vercel/postgres'
import { ensureTreinadoresSchema, safeJson } from '@/lib/treinadores-schema'
import { analyzeCoachSourceTexts } from '@/lib/treinador-ai'
import { sanitizeCoachReport } from '@/lib/treinador-report-sanitizer'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function mergeProfiles(current=[], incoming=[]) {
  const map = new Map()
  for (const item of current || []) if (item?.posicao && item?.perfil) map.set(String(item.posicao).toLowerCase(), item)
  for (const item of incoming || []) if (item?.posicao && item?.perfil) map.set(String(item.posicao).toLowerCase(), item)
  return [...map.values()]
}

function mergeAdapt(current=[], incoming=[]) {
  const map = new Map()
  for (const item of current || []) if (item?.criterio && Number(item?.nota)>0 && item?.justificativa) map.set(String(item.criterio).toLowerCase(), item)
  for (const item of incoming || []) if (item?.criterio && Number(item?.nota)>0 && item?.justificativa) map.set(String(item.criterio).toLowerCase(), item)
  return [...map.values()]
}

function mergeReport(current, analysis, sourceMeta) {
  const history = Array.isArray(current.fontes_coladas) ? current.fontes_coladas : []
  return sanitizeCoachReport({
    ...current,
    ...analysis,
    analista: current.analista || 'Adryan Almeida',
    coordenador: current.coordenador || '',
    clube_solicitante: current.clube_solicitante || 'Associação Desportiva Confiança — Aracaju / SE',
    cargo_avaliado: current.cargo_avaliado || 'Treinador Principal',
    data_relatorio: current.data_relatorio || new Date().toLocaleDateString('pt-BR'),
    jogos_analisados: current.jogos_analisados || [],
    modelo_jogo: { ...(current.modelo_jogo || {}), ...(analysis.modelo_jogo || {}) },
    perfis_jogadores: mergeProfiles(current.perfis_jogadores, analysis.perfis_jogadores),
    adaptabilidade: mergeAdapt(current.adaptabilidade, analysis.adaptabilidade),
    fontes_coladas: [...history, sourceMeta].slice(-30)
  })
}

export async function POST(request, { params }) {
  try {
    await ensureTreinadoresSchema()
    const { id } = await params
    const body = await request.json()
    const texto = String(body.texto || '').trim()
    if (texto.length < 40) return Response.json({ error:'Cole um texto mais completo para análise.' }, { status:400 })

    const result = await sql`SELECT * FROM treinadores WHERE id = ${id}`
    const coach = result.rows[0]
    if (!coach) return Response.json({ error:'Treinador não encontrado.' }, { status:404 })

    const current = safeJson(coach.relatorio_json, {})
    const analysis = await analyzeCoachSourceTexts({
      coach,
      currentReport: current,
      sourceText: texto,
      sourceTitle: body.titulo || '',
      sourceUrl: body.url || ''
    })

    const sourceMeta = {
      titulo: String(body.titulo || 'Texto colado pelo scouting').trim(),
      url: String(body.url || '').trim(),
      importado_em: new Date().toISOString(),
      caracteres: texto.length,
      evidencias: analysis.evidencias_extraidas || []
    }
    const report = mergeReport(current, analysis, sourceMeta)
    const reportJson = JSON.stringify(report)
    const systems = Array.isArray(analysis.sistemas_taticos) ? analysis.sistemas_taticos.map(x=>x.sistema).filter(Boolean) : []
    const finalSystems = systems.length ? systems : (coach.sistemas_jogo || [])

    await sql`
      UPDATE treinadores SET
        relatorio_json = ${reportJson}::jsonb,
        sistemas_jogo = ${finalSystems},
        estilo_jogo = ${report.resumo_executivo || null},
        forcas = ${(report.pontos_fortes || []).map(x=>x.titulo).filter(Boolean).join(' · ') || null},
        fraquezas = ${(report.pontos_melhoria || []).map(x=>x.titulo).filter(Boolean).join(' · ') || null},
        recomendacao = ${report.recomendacao || 'Em análise'},
        atualizado_em = NOW()
      WHERE id = ${id}
    `

    return Response.json({ success:true, report, analysis, source:sourceMeta })
  } catch (err) {
    const status = Number(err?.status) || (err?.name === 'AbortError' ? 504 : 500)
    console.error('[treinadores/interpretar-textos]', err)
    return Response.json({
      error: err?.message || 'Falha ao interpretar os textos.',
      code: status === 504 ? 'AI_TIMEOUT' : status === 429 ? 'AI_LIMIT' : 'AI_ERROR'
    }, { status: status >= 400 && status <= 599 ? status : 500 })
  }
}
