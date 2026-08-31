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


const OBJECTIVE_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    objetivo:{type:'string'},
    nota:{type:'integer',minimum:0,maximum:100},
    nivel:{type:'string',enum:['Muito alta','Alta','Média','Baixa','Em análise']},
    acessos_confirmados:{type:'array',items:{type:'object',additionalProperties:false,properties:{clube:{type:'string'},temporada:{type:'string'},origem:{type:'string'},destino:{type:'string'},conquista:{type:'string'},evidencia:{type:'string'}},required:['clube','temporada','origem','destino','conquista','evidencia']}},
    experiencia_serie_d:{type:'string'},
    evidencias:{type:'array',items:{type:'string'}},
    riscos:{type:'array',items:{type:'string'}}
  },
  required:['objetivo','nota','nivel','acessos_confirmados','experiencia_serie_d','evidencias','riscos']
}

const REPORT_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    resumo_executivo:{type:'string'},
    titulos_principais:{type:'string'},
    sistemas_taticos:{type:'array',items:{type:'object',additionalProperties:false,properties:{sistema:{type:'string'},frequencia:{type:'string'},contexto:{type:'string'},evidencia:{type:'string'}},required:['sistema','frequencia','contexto','evidencia']}},
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
    aderencia_objetivo:OBJECTIVE_SCHEMA,
    fontes_publicas:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},url:{type:'string'},uso:{type:'string'}},required:['titulo','url','uso']}}
  },
  required:['resumo_executivo','titulos_principais','sistemas_taticos','modelo_jogo','pontos_fortes','pontos_melhoria','perfis_jogadores','adaptabilidade','filosofia_declarada','fonte_filosofia','coerencia_discurso_dados','referencias_externas','recomendacao','justificativas_recomendacao','sintese_final','aderencia_objetivo','fontes_publicas']
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

async function responsesJson({ instructions, input, schema, schemaName, web=false, timeoutMs=38000, maxOutputTokens=5200 }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada na Vercel.')

  // Modelo rápido por padrão para manter a função dentro do limite da Vercel.
  // Pode ser sobrescrito pela variável OPENAI_TRAINER_MODEL.
  const configuredModel = String(process.env.OPENAI_TRAINER_MODEL || '').trim()
  // Compatibilidade com a configuração sugerida nas primeiras versões do módulo.
  const model = (!configuredModel || configuredModel === 'gpt-5-mini') ? 'gpt-5.6-luna' : configuredModel
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(10000, timeoutMs))

  function apiErrorMessage(raw, status) {
    let detail = String(raw || '').trim()
    try {
      const parsed = JSON.parse(detail)
      detail = parsed?.error?.message || parsed?.message || detail
    } catch {}
    if (status === 401) return 'A OPENAI_API_KEY configurada na Vercel não foi aceita. Verifique a chave e faça um novo deploy.'
    if (status === 429) return `A API da OpenAI recusou a solicitação por limite/créditos. ${detail || 'Verifique o faturamento e os limites da conta.'}`
    if (status === 403) return `A conta da OpenAI não tem permissão para esta operação/modelo. ${detail}`
    if (status === 404) return `O modelo ${model} não está disponível para esta chave. Configure OPENAI_TRAINER_MODEL com outro modelo compatível.`
    return `OpenAI (${status || 'erro'}): ${detail || 'falha ao processar o material.'}`
  }

  function parseStructuredJson(text) {
    const cleaned = cleanJsonText(text)
    try { return JSON.parse(cleaned) } catch {}
    // Defesa extra para respostas que tragam algum texto antes/depois do JSON.
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first >= 0 && last > first) {
      try { return JSON.parse(cleaned.slice(first, last + 1)) } catch {}
    }
    throw new Error('A OpenAI respondeu, mas o conteúdo estruturado veio em formato inválido. Tente novamente.')
  }

  try {
    const payload = {
      model,
      instructions,
      input,
      text: { format: { type:'json_schema', name:schemaName, strict:true, schema } },
      max_output_tokens: maxOutputTokens,
      store: false
    }
    if (model.startsWith('gpt-5')) payload.reasoning = { effort:'low' }
    if (web) payload.tools = [{ type:'web_search', search_context_size:'medium' }]

    const res = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      signal:controller.signal,
      headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' },
      body:JSON.stringify(payload)
    })
    const raw = await res.text()
    if (!res.ok) {
      const err = new Error(apiErrorMessage(raw, res.status))
      err.status = res.status
      throw err
    }

    let data
    try { data = JSON.parse(raw) }
    catch { throw new Error('A API da OpenAI retornou uma resposta HTTP inválida. Tente novamente.') }

    if (data?.status === 'failed') {
      throw new Error(data?.error?.message || 'A OpenAI não conseguiu concluir a análise.')
    }
    if (data?.status === 'incomplete') {
      const reason = data?.incomplete_details?.reason
      throw new Error(reason === 'max_output_tokens'
        ? 'A análise ficou maior que o limite de saída. Divida o material em duas fontes e importe novamente.'
        : 'A análise não foi concluída pela OpenAI. Tente novamente.')
    }

    const text = extractOutputText(data)
    if (!text) throw new Error('A OpenAI não retornou conteúdo estruturado para este material.')
    return parseStructuredJson(text)
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeout = new Error('A interpretação demorou além do limite seguro da Vercel. Tente novamente; se o texto for muito grande, importe em duas partes.')
      timeout.status = 504
      throw timeout
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
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
    metricas:{jogos_carreira:m.jogos_carreira,ppj_carreira:m.ppj_carreira,jogos_detalhados:m.jogos_detalhados,jogos_com_formacao:m.jogos_com_formacao,vitorias:m.vitorias,empates:m.empates,derrotas:m.derrotas,aproveitamento:m.aproveitamento,gols_pro:m.gols_pro,gols_contra:m.gols_contra,formacoes:m.formacoes,esquemas_base:m.esquemas_base,evolucao_tatica:m.evolucao_tatica,maiores_vitorias:m.maiores_vitorias},
    jogos:compactMatches,
    transfermarkt_url:data.transfermarkt_url, performance_url:data.performance_url
  }
  const instructions = `Você atua como analista de mercado do Centro de Inteligência da Associação Desportiva Confiança. Gere um relatório profissional de scouting de treinador em português do Brasil.\nREGRAS OBRIGATÓRIAS:\n1) Use os dados estruturados fornecidos como fonte primária e factual.\n2) Use pesquisa web para complementar SOMENTE informações públicas verificáveis: títulos, entrevistas, filosofia declarada, contexto de trabalhos e referências externas.\n3) Identifique sistemas táticos e variações a partir das formações registradas. Em sistemas_taticos, combine frequência quantitativa com contexto público verificável.
4) NÃO afirme que assistiu partidas, vídeos ou Wyscout. Não invente comportamentos táticos específicos sem evidência pública. Quando a leitura de modelo de jogo for inferência a partir de formações/resultados/entrevistas, escreva de forma explícita como \"indício\", \"tendência\" ou \"a validar em vídeo\".\n5) Todos os campos devem ser preenchidos. Se não houver evidência suficiente para uma ação específica, diga objetivamente \"Sem evidência pública suficiente; validar em vídeo\" em vez de inventar.\n6) O parecer deve considerar o contexto do Confiança e ser conservador. Se faltar análise visual, prefira \"Em análise\" ou \"Com Ressalvas\".\n7) Pontos fortes e de melhoria precisam ter evidência concreta (números, trabalhos, ciclos, resultados, fontes públicas).\n8) Perfis de jogadores devem ser deduzidos apenas das estruturas/formações e evidências públicas, identificando quando for inferência.\n9) Em fontes_publicas inclua URLs relevantes realmente usadas.\n10) Linguagem institucional, sem mencionar IA, robô ou automação.
11) CONTEXTO INSTITUCIONAL: o objetivo prioritário do Confiança é conquistar o retorno à Série C. Histórico comprovado de acessos, especialmente Série D → Série C, deve ter peso alto na aderência e na decisão. Não confunda classificação para a Série D com acesso à Série C.
12) Preencha aderencia_objetivo com nota de 0 a 100 usando esta referência: até 35 pts por histórico comprovado de acessos relevantes (20 para um acesso D→C, 30 para dois, 35 para três ou mais); até 20 pts por sucesso recente na Série D/mata-mata; até 15 pts por desempenho/resultados no contexto; até 10 pts por experiência em jogos de pressão; até 10 pts por aderência tática; até 10 pts por continuidade/risco. Use apenas evidências verificáveis.`
  const input = `DADOS ESTRUTURADOS DO TREINADOR:\n${JSON.stringify(facts)}\n\nPesquise na web informações públicas complementares do treinador e gere o dossiê completo.`
  try {
    return await responsesJson({ instructions, input, schema:REPORT_SCHEMA, schemaName:'coach_scouting_report', web:true, timeoutMs:52000 })
  } catch (webErr) {
    // Fallback sem web: ainda preenche o relatório a partir dos dados estruturados.
    const fallbackInstructions = `${instructions}\nA pesquisa web não está disponível nesta execução. Baseie-se apenas nos dados estruturados fornecidos e declare falta de evidência quando necessário.`
    return responsesJson({ instructions:fallbackInstructions, input, schema:REPORT_SCHEMA, schemaName:'coach_scouting_report_no_web', web:false, timeoutMs:45000 })
  }
}

const TEXT_SOURCE_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    resumo_executivo:{type:'string'},
    titulos_principais:{type:'string'},
    sistemas_taticos:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      sistema:{type:'string'}, frequencia:{type:'string'}, contexto:{type:'string'}, evidencia:{type:'string'}
    },required:['sistema','frequencia','contexto','evidencia']}},
    modelo_jogo:{type:'object',additionalProperties:false,properties:{
      saida_bola:{type:'string'},construcao:{type:'string'},ultimo_terco:{type:'string'},transicao_ofensiva:{type:'string'},bloco_alto:{type:'string'},bloco_medio_baixo:{type:'string'},transicao_defensiva:{type:'string'},bola_parada_ofensiva:{type:'string'},bola_parada_defensiva:{type:'string'}
    },required:['saida_bola','construcao','ultimo_terco','transicao_ofensiva','bloco_alto','bloco_medio_baixo','transicao_defensiva','bola_parada_ofensiva','bola_parada_defensiva']},
    pontos_fortes:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},evidencia:{type:'string'}},required:['titulo','evidencia']}},
    pontos_melhoria:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},evidencia:{type:'string'}},required:['titulo','evidencia']}},
    perfis_jogadores:{type:'array',items:{type:'object',additionalProperties:false,properties:{posicao:{type:'string'},perfil:{type:'string'},observacao:{type:'string'}},required:['posicao','perfil','observacao']}},
    adaptabilidade:{type:'array',items:{type:'object',additionalProperties:false,properties:{criterio:{type:'string'},nota:{type:'integer',minimum:0,maximum:5},justificativa:{type:'string'}},required:['criterio','nota','justificativa']}},
    filosofia_declarada:{type:'string'}, fonte_filosofia:{type:'string'}, coerencia_discurso_dados:{type:'string'}, referencias_externas:{type:'string'},
    recomendacao:{type:'string',enum:['Em análise','Recomendado','Com Ressalvas','Não Recomendado']},
    justificativas_recomendacao:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},texto:{type:'string'}},required:['titulo','texto']}},
    sintese_final:{type:'string'},
    aderencia_objetivo:OBJECTIVE_SCHEMA,
    evidencias_extraidas:{type:'array',items:{type:'string'}}
  },
  required:['resumo_executivo','titulos_principais','sistemas_taticos','modelo_jogo','pontos_fortes','pontos_melhoria','perfis_jogadores','adaptabilidade','filosofia_declarada','fonte_filosofia','coerencia_discurso_dados','referencias_externas','recomendacao','justificativas_recomendacao','sintese_final','aderencia_objetivo','evidencias_extraidas']
}

export async function analyzeCoachSourceTexts({ coach, currentReport={}, sourceText, sourceTitle='', sourceUrl='' }) {
  const metrics = coach?.metricas_json || coach?.metricas || {}
  const factual = {
    nome: coach?.nome,
    clube_atual: coach?.clube_atual,
    idade: coach?.idade,
    nacionalidade: coach?.nacionalidade,
    licenca: coach?.licenca,
    formacao_preferida: coach?.formacao_preferida,
    carreira: (coach?.carreira_json || coach?.carreira || []).slice(0,40),
    metricas: {
      jogos_carreira: metrics.jogos_carreira,
      ppj_carreira: metrics.ppj_carreira,
      jogos_detalhados: metrics.jogos_detalhados,
      vitorias: metrics.vitorias,
      empates: metrics.empates,
      derrotas: metrics.derrotas,
      aproveitamento: metrics.aproveitamento,
      gols_pro: metrics.gols_pro,
      gols_contra: metrics.gols_contra,
      formacoes: metrics.formacoes,
      esquemas_base: metrics.esquemas_base,
      evolucao_tatica: metrics.evolucao_tatica
    }
  }
  const text = String(sourceText || '').trim().slice(0,140000)
  if (!text) throw new Error('Cole pelo menos um texto para análise.')
  const instructions = `Você é analista de mercado do Centro de Inteligência da Associação Desportiva Confiança. Sua tarefa é transformar textos, matérias, entrevistas, transcrições e análises fornecidas pelo usuário em um relatório de scouting de treinador.
REGRAS:
1) O texto fornecido pelo usuário é a fonte principal para a análise qualitativa. Os dados estruturados do Transfermarkt são a fonte factual para carreira e formações.
2) NÃO invente comportamentos. Quando o texto não sustentar uma conclusão, escreva "Sem evidência suficiente no material enviado; validar em vídeo".
3) Identifique explicitamente ESQUEMAS TÁTICOS e VARIAÇÕES. Exemplos: 4-2-3-1, 3-4-3, 4-4-2, linha de cinco. Use as métricas do Transfermarkt para frequência quantitativa e o texto para contexto de uso.
4) Diferencie formação-base de comportamento. Ex.: 3-4-3 com alas altos, bloco em linha de cinco sem bola, 4-2-3-1 com meia próximo ao 9.
5) Preencha saída de bola, construção, último terço, transições, blocos e bolas paradas apenas com evidência. Pode sintetizar diferentes matérias, mas preserve divergências quando existirem.
6) Extraia pontos fortes e pontos de melhoria com evidências concretas.
7) Gere perfil de jogadores por posição apenas quando houver base no material; se for inferência, escreva "inferência" na observação.
8) Em adaptabilidade, atribua 0 a 5 estrelas e justifique com fatos do material e trajetória.
9) Filosofia declarada deve privilegiar falas do próprio treinador quando existirem. Em fonte_filosofia, registre veículo/título/URL ou identificação da fonte.
10) O parecer deve ser institucional e conservador. Não diga que o departamento assistiu jogos se o texto não disser isso.
11) Não mencione IA, automação, robô ou prompt no relatório.
12) Retorne todos os campos do schema em português do Brasil.\n13) Seja objetivo: normalmente 1 a 4 frases por campo e no máximo 12 evidências extraídas, para concluir dentro do tempo da aplicação.
14) CONTEXTO INSTITUCIONAL FIXO: o Confiança tem como objetivo prioritário voltar à Série C. Histórico comprovado de acessos deve pesar de forma relevante na nota, no parecer e no resumo executivo.
15) Em aderencia_objetivo, diferencie claramente: acesso da Série D para a Série C; classificação estadual que apenas garante Série D; título sem promoção; e campanhas de mata-mata. Só conte como acesso D→C quando a fonte disser isso.
16) Rubrica de aderência ao objetivo: até 35 pts por histórico comprovado de acessos relevantes (20 para um D→C, 30 para dois, 35 para três ou mais); até 20 por sucesso recente na Série D/mata-mata; até 15 por desempenho/resultados; até 10 por experiência em pressão; até 10 por aderência tática; até 10 por continuidade/risco. A nota deve ser explicada pelas evidências do material.`
  const input = `TREINADOR E DADOS FACTUAIS:\n${JSON.stringify(factual)}\n\nRELATÓRIO ATUAL (use apenas como contexto; o novo texto deve atualizar a análise):\n${JSON.stringify(currentReport)}\n\nIDENTIFICAÇÃO DA FONTE:\nTítulo: ${sourceTitle || 'Texto colado pelo scouting'}\nURL: ${sourceUrl || 'não informada'}\n\nMATERIAL PARA INTERPRETAR:\n${text}`
  return responsesJson({ instructions, input, schema:TEXT_SOURCE_SCHEMA, schemaName:'coach_text_source_analysis', web:false, timeoutMs:36000, maxOutputTokens:4800 })
}


const WYSCOUT_ANALYSIS_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    wyscout_sintese:{type:'string'},
    leitura_ofensiva:{type:'string'},
    leitura_defensiva:{type:'string'},
    pressao_sem_bola:{type:'string'},
    progressao_posse:{type:'string'},
    transicoes:{type:'string'},
    bola_parada:{type:'string'},
    jogos_destaque:{type:'array',items:{type:'object',additionalProperties:false,properties:{data:{type:'string'},jogo:{type:'string'},leitura:{type:'string'}},required:['data','jogo','leitura']}},
    resumo_executivo:{type:'string'},
    modelo_jogo:{type:'object',additionalProperties:false,properties:{
      saida_bola:{type:'string'},construcao:{type:'string'},ultimo_terco:{type:'string'},transicao_ofensiva:{type:'string'},bloco_alto:{type:'string'},bloco_medio_baixo:{type:'string'},transicao_defensiva:{type:'string'},bola_parada_ofensiva:{type:'string'},bola_parada_defensiva:{type:'string'}
    },required:['saida_bola','construcao','ultimo_terco','transicao_ofensiva','bloco_alto','bloco_medio_baixo','transicao_defensiva','bola_parada_ofensiva','bola_parada_defensiva']},
    pontos_fortes:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},evidencia:{type:'string'}},required:['titulo','evidencia']}},
    pontos_melhoria:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},evidencia:{type:'string'}},required:['titulo','evidencia']}},
    adaptabilidade:{type:'array',items:{type:'object',additionalProperties:false,properties:{criterio:{type:'string'},nota:{type:'integer',minimum:0,maximum:5},justificativa:{type:'string'}},required:['criterio','nota','justificativa']}},
    aderencia_objetivo:OBJECTIVE_SCHEMA,
    recomendacao:{type:'string',enum:['Em análise','Recomendado','Com Ressalvas','Não Recomendado']},
    justificativas_recomendacao:{type:'array',items:{type:'object',additionalProperties:false,properties:{titulo:{type:'string'},texto:{type:'string'}},required:['titulo','texto']}},
    sintese_final:{type:'string'}
  },
  required:['wyscout_sintese','leitura_ofensiva','leitura_defensiva','pressao_sem_bola','progressao_posse','transicoes','bola_parada','jogos_destaque','resumo_executivo','modelo_jogo','pontos_fortes','pontos_melhoria','adaptabilidade','aderencia_objetivo','recomendacao','justificativas_recomendacao','sintese_final']
}

export async function analyzeCoachWyscoutData({ coach, currentReport={}, wyscout }) {
  const factual={
    nome:coach?.nome, clube_atual:coach?.clube_atual, idade:coach?.idade, licenca:coach?.licenca,
    formacao_preferida:coach?.formacao_preferida,
    carreira:(coach?.carreira_json||[]).slice(0,40),
    metricas_carreira:coach?.metricas_json||{},
    aderencia_objetivo_atual:currentReport?.aderencia_objetivo||null
  }
  const compactWyscout={
    equipe:wyscout?.equipe,
    resumo:wyscout?.resumo,
    formacoes:wyscout?.formacoes,
    insights_deterministicos:wyscout?.insights,
    jogos:(wyscout?.jogos||[]).slice(0,30).map(g=>({
      game_id:g.game_id,data:g.data,jogo:g.jogo,competicao:g.competicao,sistema:g.sistema,resultado:g.resultado,
      metricas:g.metricas,adversario:g.adversario,adversario_metricas:g.adversario_metricas
    }))
  }
  const instructions=`Você é analista de desempenho e mercado do Centro de Inteligência da Associação Desportiva Confiança. Interprete dados de Team Stats exportados do Wyscout para enriquecer o scouting de um treinador.
REGRAS:
1) Trate os dados Wyscout como evidência quantitativa dos jogos importados, não como prova absoluta de intenção tática. Use expressões como "o recorte indica", "há evidência quantitativa" e "a validar em vídeo" quando necessário.
2) Cruze xG, remates, entradas na área, passes ao terço final, posse, passes por posse, percentual de passe longo, PPDA, recuperações, perdas, bolas paradas e formações.
3) Diferencie desempenho do time de estilo do treinador. Não invente comportamentos que os números não sustentem.
4) Atualize resumo executivo, modelo de jogo, pontos fortes, pontos de melhoria, adaptabilidade e parecer combinando o relatório atual com os dados Wyscout. Preserve informações qualitativas já sustentadas por fontes textuais; não apague evidências válidas.
5) CONTEXTO PRIORITÁRIO: o Confiança precisa voltar à Série C. Histórico comprovado de acessos deve ter peso alto na decisão e na aderência. A planilha Wyscout complementa o COMO joga; os textos/carreira sustentam os acessos.
6) Em aderencia_objetivo, mantenha acessos já confirmados no relatório atual e reavalie a nota considerando também o desempenho Wyscout no contexto competitivo. Se os campos textuais do relatório atual (resumo, justificativas, referências ou síntese) disserem explicitamente que houve um acesso/promoção, você pode estruturá-lo em acessos_confirmados, sempre indicando clube, temporada e origem→destino quando a evidência permitir. Não invente novos acessos a partir da planilha e não trate classificação para disputar a Série D como acesso à Série C.
7) Rubrica: até 35 pts acessos comprovados; até 20 sucesso recente na Série D/mata-mata; até 15 resultados; até 10 jogos de pressão; até 10 aderência tática; até 10 continuidade/risco.
8) A recomendação final deve explicar explicitamente a relação entre currículo de acesso + evidências Wyscout + riscos.
9) Linguagem institucional, objetiva e sem mencionar IA/automação.`
  const input=`TREINADOR E CARREIRA:
${JSON.stringify(factual)}

RELATÓRIO ATUAL:
${JSON.stringify(currentReport)}

DADOS WYSCOUT TEAM STATS:
${JSON.stringify(compactWyscout)}`
  return responsesJson({instructions,input,schema:WYSCOUT_ANALYSIS_SCHEMA,schemaName:'coach_wyscout_analysis',web:false,timeoutMs:42000,maxOutputTokens:5200})
}
