const PROFILE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    nome: { type: ['string','null'] },
    nome_completo: { type: ['string','null'] },
    data_nascimento: { type: ['string','null'] },
    idade: { type: ['integer','null'] },
    cidade_nascimento: { type: ['string','null'] },
    nacionalidade: { type: ['string','null'] },
    licenca: { type: ['string','null'] },
    formacao_preferida: { type: ['string','null'] },
    media_tempo_cargo: { type: ['string','null'] },
    agente: { type: ['string','null'] },
    clube_atual: { type: ['string','null'] },
    cargo_atual: { type: ['string','null'] },
    carreira: {
      type: 'array', items: { type: 'object', additionalProperties: false, properties: {
        clube:{type:'string'}, cargo:{type:'string'}, entrada:{type:['string','null']}, saida:{type:['string','null']}, jogos:{type:'integer'}, ppj:{type:'number'}
      }, required:['clube','cargo','entrada','saida','jogos','ppj'] }
    },
    jogos: {
      type: 'array', items: { type:'object', additionalProperties:false, properties:{
        data:{type:'string'}, competicao:{type:'string'}, temporada:{type:['string','null']}, rodada:{type:['string','null']}, mandante:{type:'string'}, placar:{type:'string'}, visitante:{type:'string'}, tatica:{type:['string','null']}
      }, required:['data','competicao','temporada','rodada','mandante','placar','visitante','tatica'] }
    }
  },
  required:['nome','nome_completo','data_nascimento','idade','cidade_nascimento','nacionalidade','licenca','formacao_preferida','media_tempo_cargo','agente','clube_atual','cargo_atual','carreira','jogos']
}

const REPORT_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    resumo_executivo:{type:'string'},
    titulos_principais:{type:'string'},
    modelo_jogo:{type:'object',additionalProperties:false,properties:{
      saida_bola:{type:'string'},construcao:{type:'string'},ultimo_terco:{type:'string'},transicao_ofensiva:{type:'string'},bloco_alto:{type:'string'},bloco_medio_baixo:{type:'string'},transicao_defensiva:{type:'string'},bola_parada_ofensiva:{type:'string'},bola_parada_defensiva:{type:'string'}
    },required:['saida_bola','construcao','ultimo_terco','transicao_ofensiva','bloco_alto','bloco_medio_baixo','transicao_defensiva','bola_parada_ofensiva','bola_parada_defensiva']},
    pontos_fortes:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},evidencia:{type:'string'}},required:['titulo','evidencia']}},
    pontos_melhoria:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},evidencia:{type:'string'}},required:['titulo','evidencia']}},
    perfis_jogadores:{type:'array',items:{type:'object',additionalProperties:false,properties:{posicao:{type:'string'},perfil:{type:'string'},observacao:{type:'string'}},required:['posicao','perfil','observacao']}},
    adaptabilidade:{type:'array',items:{type:'object',additionalProperties:false,properties:{criterio:{type:'string'},nota:{type:'integer',minimum:0,maximum:5},justificativa:{type:'string'}},required:['criterio','nota','justificativa']}},
    filosofia_declarada:{type:'string'},fonte_filosofia:{type:'string'},coerencia_discurso_dados:{type:'string'},referencias_externas:{type:'string'},
    recomendacao:{type:'string',enum:['Em análise','Recomendado','Com Ressalvas','Não Recomendado']},
    justificativas_recomendacao:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},texto:{type:'string'}},required:['titulo','texto']}},
    sintese_final:{type:'string'},
    fontes_publicas:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},url:{type:'string'},uso:{type:'string'}},required:['titulo','url','uso']}}
  },
  required:['resumo_executivo','titulos_principais','modelo_jogo','pontos_fortes','pontos_melhoria','perfis_jogadores','adaptabilidade','filosofia_declarada','fonte_filosofia','coerencia_discurso_dados','referencias_externas','recomendacao','justificativas_recomendacao','sintese_final','fontes_publicas']
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string') return data.output_text
  const chunks = []
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if ((content?.type === 'output_text' || content?.type === 'text') && typeof content?.text === 'string') chunks.push(content.text)
    }
  }
  return chunks.join('\n').trim()
}

function cleanJsonText(text='') {
  return String(text).replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim()
}

async function responsesJson({ instructions, input, schema, schemaName, web=false, timeoutMs=52000 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada na Vercel.')
  const candidates = [...new Set([process.env.OPENAI_TRAINER_MODEL, 'gpt-5-mini', 'gpt-4.1-mini'].filter(Boolean))]
  let lastError = null
  for (const model of candidates) {
    const controller = new AbortController()
    const timer = setTimeout(()=>controller.abort(), timeoutMs)
    try {
      const payload = {
        model,
        instructions,
        input,
        text:{ format:{ type:'json_schema', name:schemaName, strict:true, schema } },
        max_output_tokens: 9000
      }
      if (web) payload.tools = [{ type:'web_search', search_context_size:'medium' }]
      const res = await fetch('https://api.openai.com/v1/responses', {
        method:'POST', signal:controller.signal,
        headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' },
        body:JSON.stringify(payload)
      })
      const raw = await res.text()
      if (!res.ok) { lastError = new Error(`OpenAI ${model}: ${raw.slice(0,500)}`); continue }
      const data = JSON.parse(raw)
      const text = extractOutputText(data)
      if (!text) { lastError = new Error(`OpenAI ${model} não retornou conteúdo estruturado.`); continue }
      return JSON.parse(cleanJsonText(text))
    } catch (err) { lastError = err }
    finally { clearTimeout(timer) }
  }
  throw lastError || new Error('Falha no processamento automático do relatório.')
}

export async function extractTransfermarktFactsWithAI({ profileText, performanceText, profileUrl, performanceUrl }) {
  const profile = String(profileText||'').slice(0,65000)
  const performance = String(performanceText||'').slice(0,125000)
  const instructions = `Você é o extrator de dados factuais do módulo Scouting de Treinadores do Centro de Inteligência do Confiança.\nLeia EXCLUSIVAMENTE o conteúdo fornecido das páginas públicas do Transfermarkt. Não invente dados e não faça análise tática.\nExtraia o perfil, todos os trabalhos de carreira visíveis e todas as partidas visíveis na página detalhada.\nDatas devem ficar em DD/MM/AAAA quando a fonte trouxer data completa. PPJ deve ser número decimal. Jogos sem formação devem usar null.\nO clube atual deve ser o que consta no cabeçalho/perfil.\nRetorne apenas os campos do schema.`
  const input = `PERFIL TRANSFERMARKT\nURL: ${profileUrl}\n\n${profile}\n\nDADOS DE DESEMPENHO DETALHADOS\nURL: ${performanceUrl}\n\n${performance}`
  try {
    const parsed = await responsesJson({ instructions, input, schema:PROFILE_SCHEMA, schemaName:'transfermarkt_trainer_facts', web:false, timeoutMs:45000 })
    if ((parsed?.carreira||[]).length || (parsed?.jogos||[]).length) return parsed
  } catch {}
  const webInput = `Abra e leia estas duas páginas públicas do Transfermarkt e extraia os dados completos conforme o schema.\nPERFIL: ${profileUrl}\nDESEMPENHO DETALHADO: ${performanceUrl}\nNão use snippets resumidos se conseguir abrir as páginas.`
  return responsesJson({ instructions, input:webInput, schema:PROFILE_SCHEMA, schemaName:'transfermarkt_trainer_facts_web', web:true, timeoutMs:52000 })
}

export async function generateAutomaticCoachReport(data) {
  const m = data.metricas || {}
  const compactMatches = (data.jogos || []).slice(0,140).map(g=>({data:g.data,competicao:g.competicao,temporada:g.temporada,mandante:g.mandante,placar:g.placar,visitante:g.visitante,tatica:g.tatica,clube_treinador:g.clube_treinador,resultado_treinador:g.resultado_treinador}))
  const compactCareer = (data.carreira || []).slice(0,40)
  const facts = {
    nome:data.nome_completo||data.nome, idade:data.idade, nacionalidade:data.nacionalidade, clube_atual:data.clube_atual,
    licenca:data.licenca, formacao_preferida:data.formacao_preferida, media_tempo_cargo:data.media_tempo_cargo,
    carreira:compactCareer,
    metricas:{jogos_carreira:m.jogos_carreira,ppj_carreira:m.ppj_carreira,jogos_detalhados:m.jogos_detalhados,vitorias:m.vitorias,empates:m.empates,derrotas:m.derrotas,aproveitamento:m.aproveitamento,gols_pro:m.gols_pro,gols_contra:m.gols_contra,formacoes:m.formacoes,evolucao_tatica:m.evolucao_tatica,maiores_vitorias:m.maiores_vitorias},
    jogos:compactMatches,
    transfermarkt_url:data.transfermarkt_url, performance_url:data.performance_url
  }
  const instructions = `Você atua como analista de mercado do Centro de Inteligência da Associação Desportiva Confiança. Gere um relatório profissional de scouting de treinador em português do Brasil.\nREGRAS OBRIGATÓRIAS:\n1) Use os dados estruturados fornecidos como fonte primária e factual.\n2) Use pesquisa web para complementar SOMENTE informações públicas verificáveis: títulos, entrevistas, filosofia declarada, contexto de trabalhos e referências externas.\n3) NÃO afirme que assistiu partidas, vídeos ou Wyscout. Não invente comportamentos táticos específicos sem evidência pública. Quando a leitura de modelo de jogo for inferência a partir de formações/resultados/entrevistas, escreva de forma explícita como \"indício\", \"tendência\" ou \"a validar em vídeo\".\n4) Todos os campos devem ser preenchidos. Se não houver evidência suficiente para uma ação específica, diga objetivamente \"Sem evidência pública suficiente; validar em vídeo\" em vez de inventar.\n5) O parecer deve considerar o contexto do Confiança e ser conservador. Se faltar análise visual, prefira \"Em análise\" ou \"Com Ressalvas\".\n6) Pontos fortes e de melhoria precisam ter evidência concreta (números, trabalhos, ciclos, resultados, fontes públicas).\n7) Perfis de jogadores devem ser deduzidos apenas das estruturas/formações e evidências públicas, identificando quando for inferência.\n8) Em fontes_publicas inclua URLs relevantes realmente usadas.\n9) Linguagem institucional, sem mencionar IA, robô ou automação.`
  const input = `DADOS ESTRUTURADOS DO TREINADOR:\n${JSON.stringify(facts)}\n\nPesquise na web informações públicas complementares do treinador e gere o dossiê completo.`
  try {
    return await responsesJson({ instructions, input, schema:REPORT_SCHEMA, schemaName:'coach_scouting_report', web:true, timeoutMs:52000 })
  } catch (webErr) {
    // Fallback sem web: ainda preenche o relatório a partir dos dados estruturados.
    const fallbackInstructions = `${instructions}\nA pesquisa web não está disponível nesta execução. Baseie-se apenas nos dados estruturados fornecidos e declare falta de evidência quando necessário.`
    return responsesJson({ instructions:fallbackInstructions, input, schema:REPORT_SCHEMA, schemaName:'coach_scouting_report_no_web', web:false, timeoutMs:45000 })
  }
}
