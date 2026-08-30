import { sql } from '@vercel/postgres'
import { ensureTreinadoresSchema } from '@/lib/treinadores-schema'
import { scrapeTransfermarktTrainer } from '@/lib/transfermarkt-trainer'

export const maxDuration = 45
export const dynamic = 'force-dynamic'

function initialReport(data) {
  const m = data.metricas || {}
  const formations = (m.formacoes || []).slice(0, 4).map(x => x.formacao).filter(Boolean)
  const careerGames = m.jogos_carreira || m.jogos_detalhados || 0
  const ppj = m.ppj_carreira || m.ppj_detalhado || 0
  const current = data.clube_atual ? ` Atualmente está no ${data.clube_atual}.` : ''
  const summary = `${data.nome_completo || data.nome}${data.idade ? `, ${data.idade} anos` : ''}, ${data.nacionalidade || 'treinador'}, possui ${careerGames} jogo(s) registrados no histórico importado e média de ${Number(ppj).toFixed(2).replace('.', ',')} ponto(s) por jogo.${data.formacao_preferida ? ` A formação preferencial indicada é ${data.formacao_preferida}.` : ''}${current}`
  return {
    analista: 'Adryan Almeida',
    coordenador: '',
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
    const d = await scrapeTransfermarktTrainer(url)
    const career = JSON.stringify(d.carreira || [])
    const games = JSON.stringify(d.jogos || [])
    const metrics = JSON.stringify(d.metricas || {})
    const report = JSON.stringify(initialReport(d))
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
        ${career}::jsonb, ${games}::jsonb, ${metrics}::jsonb, ${report}::jsonb, 'Em análise',
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
