import { sql } from '@vercel/postgres'
import { ensureTreinadoresSchema } from '@/lib/treinadores-schema'
import { scrapeTransfermarktTrainer } from '@/lib/transfermarkt-trainer'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function hasText(value) { return typeof value === 'string' && value.trim().length > 12 }
function mergeAutoReport(base, existing={}, auto={}) {
  const preserveKeys = ['analista','coordenador','clube_solicitante','cargo_avaliado','data_relatorio','jogos_analisados','fontes_coladas']
  const out = { ...base, ...existing }
  // O resumo inicial antigo é substituído pelo resumo automático; textos realmente editados são preservados.
  const looksInitial = /jogo\(s\) registrados no histórico importado/i.test(existing.resumo_executivo || '')
  if (!hasText(existing.resumo_executivo) || looksInitial) out.resumo_executivo = auto.resumo_executivo || base.resumo_executivo
  const scalar = ['titulos_principais','filosofia_declarada','fonte_filosofia','coerencia_discurso_dados','referencias_externas','sintese_final']
  for (const key of scalar) if (!hasText(existing[key]) && hasText(auto[key])) out[key] = auto[key]
  if ((!existing.pontos_fortes || !existing.pontos_fortes.length) && auto.pontos_fortes?.length) out.pontos_fortes = auto.pontos_fortes
  if ((!existing.pontos_melhoria || !existing.pontos_melhoria.length) && auto.pontos_melhoria?.length) out.pontos_melhoria = auto.pontos_melhoria
  if ((!existing.justificativas_recomendacao || !existing.justificativas_recomendacao.length) && auto.justificativas_recomendacao?.length) out.justificativas_recomendacao = auto.justificativas_recomendacao
  if ((!existing.sistemas_taticos || !existing.sistemas_taticos.length) && auto.sistemas_taticos?.length) out.sistemas_taticos = auto.sistemas_taticos
  const model = { ...(base.modelo_jogo || {}), ...(existing.modelo_jogo || {}) }
  for (const [key,value] of Object.entries(auto.modelo_jogo || {})) if (!hasText(model[key]) && hasText(value)) model[key] = value
  out.modelo_jogo = model
  if (auto.perfis_jogadores?.length) {
    const byPos = new Map((existing.perfis_jogadores || base.perfis_jogadores || []).map(x=>[x.posicao,x]))
    for (const item of auto.perfis_jogadores) {
      const cur = byPos.get(item.posicao) || {}
      if (!hasText(cur.perfil) && !hasText(cur.observacao)) byPos.set(item.posicao,{...cur,...item})
    }
    out.perfis_jogadores = [...byPos.values()]
  }
  if (auto.adaptabilidade?.length) {
    const byKey = new Map((existing.adaptabilidade || base.adaptabilidade || []).map(x=>[x.criterio,x]))
    for (const item of auto.adaptabilidade) {
      const cur = byKey.get(item.criterio) || {}
      if (!Number(cur.nota) && !hasText(cur.justificativa)) byKey.set(item.criterio,{...cur,...item})
    }
    out.adaptabilidade = [...byKey.values()]
  }
  if ((!existing.recomendacao || existing.recomendacao === 'Em análise') && auto.recomendacao) out.recomendacao = auto.recomendacao
  for (const key of preserveKeys) if (existing[key] != null) out[key] = existing[key]
  return out
}

function initialReport(data) {
  const m = data.metricas || {}
  const formations = (m.formacoes || []).slice(0, 4).map(x => x.formacao).filter(Boolean)
  const careerGames = m.jogos_carreira || m.jogos_detalhados || 0
  const ppj = m.ppj_carreira || m.ppj_detalhado || 0
  const current = data.clube_atual ? ` Atualmente está no ${data.clube_atual}.` : ''
  const summary = `${data.nome_completo || data.nome}${data.idade ? `, ${data.idade} anos` : ''}, ${data.nacionalidade || 'treinador'}, possui ${careerGames} jogo(s) registrados no histórico importado e média de ${Number(ppj).toFixed(2).replace('.', ',')} ponto(s) por jogo.${data.formacao_preferida ? ` A formação preferencial indicada é ${data.formacao_preferida}.` : ''}${current}`
  return {
    analista: 'Adryan Almeida',
    coordenador: 'Anthony Emanoel',
    clube_solicitante: 'Associação Desportiva Confiança — Aracaju / SE',
    cargo_avaliado: 'Treinador Principal',
    data_relatorio: new Date().toLocaleDateString('pt-BR'),
    resumo_executivo: summary,
    titulos_principais: '',
    jogos_analisados: [],
    modelo_jogo: {
      saida_bola: '', construcao: '', ultimo_terco: '', transicao_ofensiva: '',
      bloco_alto: '', bloco_medio_baixo: '', transicao_defensiva: '',
      bola_parada_ofensiva: '', bola_parada_defensiva: ''
    },
    pontos_fortes: [],
    pontos_melhoria: [],
    perfis_jogadores: [
      { posicao:'Goleiro', perfil:'', observacao:'' }, { posicao:'Zagueiro', perfil:'', observacao:'' },
      { posicao:'Lateral / Ala', perfil:'', observacao:'' }, { posicao:'Volante', perfil:'', observacao:'' },
      { posicao:'Meia', perfil:'', observacao:'' }, { posicao:'Ponta', perfil:'', observacao:'' },
      { posicao:'Centroavante', perfil:'', observacao:'' }
    ],
    adaptabilidade: [
      { criterio:'Flexibilidade tática', nota:0, justificativa: formations.length ? `Formações registradas: ${formations.join(' · ')}` : '' },
      { criterio:'Gestão de grupo', nota:0, justificativa:'' },
      { criterio:'Trabalho com jovens', nota:0, justificativa:'' },
      { criterio:'Reação a adversidades', nota:0, justificativa:'' },
      { criterio:'Uso de dados/tecnologia', nota:0, justificativa:'' },
      { criterio:'Adaptação ao elenco', nota:0, justificativa:'' }
    ],
    filosofia_declarada: '', fonte_filosofia: '', coerencia_discurso_dados: '', referencias_externas: '',
    recomendacao: 'Em análise', justificativas_recomendacao: [], sintese_final: ''
  }
}

export async function POST(request) {
  try {
    await ensureTreinadoresSchema()
    const { url } = await request.json()
    const d = await scrapeTransfermarktTrainer(url, { allowAiFallback:false })
    const existingRow = await sql`SELECT relatorio_json FROM treinadores WHERE transfermarkt_id = ${d.transfermarkt_id} OR nome = ${d.nome} LIMIT 1`
    const existingReport = existingRow.rows[0]?.relatorio_json || {}
    // O importador salva primeiro os dados factuais. A análise qualitativa por IA
    // é executada na aba "Importar textos", evitando timeout em perfis longos.
    const finalReport = mergeAutoReport(initialReport(d), existingReport, {})
    if (!String(finalReport.coordenador || '').trim()) finalReport.coordenador = 'Anthony Emanoel'
    if (!String(finalReport.analista || '').trim()) finalReport.analista = 'Adryan Almeida'
    const career = JSON.stringify(d.carreira || [])
    const games = JSON.stringify(d.jogos || [])
    const metrics = JSON.stringify(d.metricas || {})
    const report = JSON.stringify(finalReport)
    const historico = (d.carreira || []).map(x => `${x.clube} (${x.entrada || '—'}–${x.saida || 'atual'})`).join(' · ')

    const row = await sql`
      INSERT INTO treinadores (
        nome, data_nascimento, idade, nacionalidade, historico_clubes, sistemas_jogo,
        clube_atual, cargo_atual, cidade_nascimento, licenca, formacao_preferida, media_tempo_cargo,
        agente, foto_url, transfermarkt_id, transfermarkt_url, performance_url,
        carreira_json, jogos_json, metricas_json, relatorio_json, recomendacao,
        fonte_atualizada_em, atualizado_em
      ) VALUES (
        ${d.nome}, ${d.data_nascimento}, ${d.idade}, ${d.nacionalidade}, ${historico}, ${d.sistemas_jogo || []},
        ${d.clube_atual}, ${d.cargo_atual}, ${d.cidade_nascimento}, ${d.licenca}, ${d.formacao_preferida}, ${d.media_tempo_cargo},
        ${d.agente}, ${d.foto_url}, ${d.transfermarkt_id}, ${d.transfermarkt_url}, ${d.performance_url},
        ${career}::jsonb, ${games}::jsonb, ${metrics}::jsonb, ${report}::jsonb, ${finalReport.recomendacao || 'Em análise'},
        NOW(), NOW()
      )
      ON CONFLICT (nome) DO UPDATE SET
        data_nascimento = EXCLUDED.data_nascimento,
        idade = EXCLUDED.idade,
        nacionalidade = EXCLUDED.nacionalidade,
        historico_clubes = EXCLUDED.historico_clubes,
        sistemas_jogo = EXCLUDED.sistemas_jogo,
        clube_atual = EXCLUDED.clube_atual,
        cargo_atual = EXCLUDED.cargo_atual,
        cidade_nascimento = EXCLUDED.cidade_nascimento,
        licenca = EXCLUDED.licenca,
        formacao_preferida = EXCLUDED.formacao_preferida,
        media_tempo_cargo = EXCLUDED.media_tempo_cargo,
        agente = EXCLUDED.agente,
        foto_url = COALESCE(EXCLUDED.foto_url, treinadores.foto_url),
        transfermarkt_id = EXCLUDED.transfermarkt_id,
        transfermarkt_url = EXCLUDED.transfermarkt_url,
        performance_url = EXCLUDED.performance_url,
        carreira_json = EXCLUDED.carreira_json,
        jogos_json = EXCLUDED.jogos_json,
        metricas_json = EXCLUDED.metricas_json,
        relatorio_json = EXCLUDED.relatorio_json,
        recomendacao = EXCLUDED.recomendacao,
        fonte_atualizada_em = NOW(),
        atualizado_em = NOW()
      RETURNING id, nome
    `
    return Response.json({ success:true, id:row.rows[0]?.id, nome:row.rows[0]?.nome, data:d })
  } catch (err) {
    const status = err?.status === 429 ? 429 : 500
    return Response.json({ error: err.message || 'Falha ao importar treinador.' }, { status })
  }
}
