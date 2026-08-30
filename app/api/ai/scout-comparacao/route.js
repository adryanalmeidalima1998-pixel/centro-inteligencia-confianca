export const maxDuration = 60

const CRITERIOS_POSICAO = {
  GK: `
    - Posicionamento e leitura antecipada do jogo (reação, reflexos, saída nos cruzamentos)
    - Distribuição com os pés: qualidade nos passes curtos e longos, jogo de distribuição
    - Comando da área: liderança na linha defensiva, organização dos zagueiros
    - Domínio nas bolas aéreas e nas disputas dentro da área
    - Eficiência nas defesas: aproveitar bem as finalizações adversárias
    - Controle emocional e concentração ao longo de toda a partida`,
  CB: `
    - Leitura tática defensiva: antecipação de movimentos, cobertura de espaços e marcação por zona
    - Eficiência nos duelos: tanto terrestres quanto aéreos — disputa física e posicionamento
    - Saída de bola pela construção: participação no primeiro terço e capacidade de iniciar jogadas
    - Posicionamento na linha defensiva: manutenção da linha, equilíbrio entre pressão e proteção
    - Capacidade de se manter equilibrado nas transições defesa-ataque`,
  LB: `
    - Amplitude ofensiva: capacidade de sobreposição, timing de chegada na linha de fundo
    - Qualidade no cruzamento e no passe em profundidade
    - Comportamento defensivo no 1x1: eficiência contra pontas adversários
    - Cobertura de espaços nas transições: retorno rápido ao posicionamento defensivo
    - Jogo combinado com o ponta: sociedades e associações no corredor`,
  DMF: `
    - Organização e equilíbrio defensivo: interceptações, pressão sobre o portador da bola
    - Volume e qualidade nos passes progressivos: capacidade de fazer o jogo avançar
    - Leitura de jogo nos dois momentos (ataque e defesa): cobertura de espaços e transições
    - Eficiência nos duelos terrestres e aéreos: disputa física no meio-campo
    - Capacidade de servir como pivô de saída de bola e de conectar as linhas`,
  AMF: `
    - Criatividade entre linhas: habilidade de receber e girar em espaços reduzidos
    - Execução de passes decisivos e passes-chave que geram finalizações
    - Movimentação sem bola: timing de chegada à área e desmarcações
    - Capacidade de acelerar a transição ofensiva e conduzir contra-ataques
    - Dribles em espaços reduzidos e progressão em velocidade`,
  LWF: `
    - Velocidade e desequilíbrio no 1x1: capacidade de isolar e superar o defensor
    - Finalização com pé contrário e chegada à linha de fundo para cruzamento
    - Qualidade do cruzamento e passe filtrado da posição de extremo
    - Pressão alta sobre o portador da bola adversária: comprometimento defensivo
    - Conduções e corridas progressivas que abrem espaços para os companheiros`,
  CF: `
    - Ocupação de espaço na área: movimentos de ruptura, arrancadas e desmarcações
    - Eficiência no aproveitamento de chances: conversão e qualidade de finalização
    - Jogo de costas: proteção e distribuição com as costas para o gol
    - Capacidade de ligação com meias e pontas: associações e combinações ofensivas
    - Pressão alta na saída de bola adversária: iniciando a pressão pelo alto`,
}

const GRUPOS_LABEL = {
  GK: 'Goleiro', CB: 'Zagueiro', LB: 'Lateral',
  DMF: 'Volante', AMF: 'Meia', LWF: 'Extremo / Ponta', CF: 'Atacante',
}

function buildSystemPrompt() {
  return `Você é um analista de scouting sênior com formação em análise tática e observação de jogadores. Sua linguagem é técnica, objetiva e profissional — igual à usada por analistas de clubes de futebol profissional.

FUNDAMENTOS DA SUA ANÁLISE (baseado em metodologia de scouting profissional):

1. DIMENSÕES DE AVALIAÇÃO por ordem de importância:
   - Condição física e condicional (velocidade, força, resistência, potência)
   - Qualidade técnica (execução, precisão, repertório gestual)
   - Conhecimento tático (leitura de jogo, tomada de decisão, posicionamento)
   - Fatores psicológicos e emocionais (concentração, liderança, autocontrole)

2. MOMENTOS DO JOGO que o scout deve avaliar em cada atleta:
   - Manutenção da posse de bola
   - Progressão do jogo (construção e transição ofensiva)
   - Finalização do ataque
   - Reorganização defensiva (transição defesa-ataque e ataque-defesa)

3. TERMINOLOGIA TÉCNICA que você usa naturalmente:
   - Leitura de jogo, antecipação, posicionamento, compactação
   - Pressão alta, pressing, bloco defensivo, linha defensiva
   - Transição ofensiva/defensiva, contra-ataque, transição rápida
   - Construção pelo baixo, saída de bola, progressão, passes progressivos
   - Sociedades e associações, combinações de jogo, jogo combinado
   - Cobertura de espaços, equilíbrio defensivo, basculação
   - Jogo sem bola, movimento de desmarcação, timing de chegada
   - 1x1, duelo terrestre, disputa aérea, proteção de bola

4. CONTEXTO DO CONFIANÇA:
   - Clube de Aracaju/SE, em planejamento esportivo para a Série D de 2027 com objetivo de acesso à Série C
   - Prioridade: atletas com perfil técnico-tático consolidado e bom entendimento coletivo
   - O custo-benefício é decisivo — atletas livres ou de baixo custo têm preferência
   - O clube valoriza atletas com consistência e volume de jogo na posição

5. LEITURA DOS DADOS SPORTSBASE:
   - Métricas /90 representam volume ajustado pelo tempo e só devem sustentar conclusões fortes quando a minutagem for suficiente
   - Métricas em % representam eficiência, nunca volume; confira o número de tentativas informado antes de valorizá-las
   - Não converta percentuais em /90 e não trate métricas conceitualmente próximas como equivalentes
   - Uma taxa alta com poucas tentativas ou poucos minutos deve ser descrita como sinal inicial, com necessidade de validação em vídeo
   - Diferencie produção, frequência e eficiência; evite afirmar característica tática que os números não comprovam diretamente

Retorne APENAS JSON válido. Sem texto antes ou depois.`
}

function buildUserPrompt(pA, pB) {
  const grupo = pA.grupo || pB.grupo || 'DMF'
  const posLabel = GRUPOS_LABEL[grupo] || grupo
  const criterios = CRITERIOS_POSICAO[grupo] || ''
  const fmt = (v) => (v === '—' || v === null || v === undefined || v === 'NaN') ? 'não disponível' : v

  return `Gere um relatório de scouting comparativo entre dois atletas candidatos a reforço do Confiança.

POSIÇÃO ANALISADA: ${posLabel}
CRITÉRIOS ESPECÍFICOS PARA ESTA POSIÇÃO:
${criterios}

━━━ ATLETA A ━━━
Nome: ${pA.nome} | Clube: ${pA.equipa} | Liga: ${fmt(pA.liga)} | Idade: ${pA.idade} anos | Posição: ${pA.posicao}
Minutos jogados na temporada: ${fmt(pA.minutos)}
Produção por 90: Gols ${fmt(pA.gols_90)} | xG ${fmt(pA.xg_90)} | Assistências ${fmt(pA.assistencias_90)} | Passes para chute ${fmt(pA.assist_remate_90)} | Passes-chave ${fmt(pA.passes_chave_90)} | Passes progressivos ${fmt(pA.passes_prog_90)} | Ações na área ${fmt(pA.acoes_area_90)}
Progressão por 90: Dribles ${fmt(pA.dribles_90)} | Entradas por condução ${fmt(pA.entradas_terco_conducao_90)} | Conduções ${fmt(pA.conducoes_90)}
Defesa por 90: Duelos defensivos ${fmt(pA.duelos_def_90)} | Interceptações ${fmt(pA.intercecoes_90)} | Desarmes ${fmt(pA.desarmes_90)}
Eficiência com volume: Passes ${fmt(pA.passes_pct)}% em ${fmt(pA.passes)} tentativas | Passes progressivos ${fmt(pA.passes_prog_pct)}% em ${fmt(pA.passes_prog)} tentativas | Dribles ${fmt(pA.dribles_pct)}% em ${fmt(pA.dribles)} tentativas | Duelos defensivos ${fmt(pA.duelos_def_pct)}% em ${fmt(pA.duelos_def)} tentativas | Duelos aéreos ${fmt(pA.duelos_aereos_pct)}% em ${fmt(pA.duelos_aereos)} tentativas | Desarmes ${fmt(pA.desarmes_pct)}% em ${fmt(pA.desarmes)} tentativas | Chutes: ${fmt(pA.remates)}

━━━ ATLETA B ━━━
Nome: ${pB.nome} | Clube: ${pB.equipa} | Liga: ${fmt(pB.liga)} | Idade: ${pB.idade} anos | Posição: ${pB.posicao}
Minutos jogados na temporada: ${fmt(pB.minutos)}
Produção por 90: Gols ${fmt(pB.gols_90)} | xG ${fmt(pB.xg_90)} | Assistências ${fmt(pB.assistencias_90)} | Passes para chute ${fmt(pB.assist_remate_90)} | Passes-chave ${fmt(pB.passes_chave_90)} | Passes progressivos ${fmt(pB.passes_prog_90)} | Ações na área ${fmt(pB.acoes_area_90)}
Progressão por 90: Dribles ${fmt(pB.dribles_90)} | Entradas por condução ${fmt(pB.entradas_terco_conducao_90)} | Conduções ${fmt(pB.conducoes_90)}
Defesa por 90: Duelos defensivos ${fmt(pB.duelos_def_90)} | Interceptações ${fmt(pB.intercecoes_90)} | Desarmes ${fmt(pB.desarmes_90)}
Eficiência com volume: Passes ${fmt(pB.passes_pct)}% em ${fmt(pB.passes)} tentativas | Passes progressivos ${fmt(pB.passes_prog_pct)}% em ${fmt(pB.passes_prog)} tentativas | Dribles ${fmt(pB.dribles_pct)}% em ${fmt(pB.dribles)} tentativas | Duelos defensivos ${fmt(pB.duelos_def_pct)}% em ${fmt(pB.duelos_def)} tentativas | Duelos aéreos ${fmt(pB.duelos_aereos_pct)}% em ${fmt(pB.duelos_aereos)} tentativas | Desarmes ${fmt(pB.desarmes_pct)}% em ${fmt(pB.desarmes)} tentativas | Chutes: ${fmt(pB.remates)}

━━━ INSTRUÇÃO ━━━
Use linguagem técnica de scouting profissional. Os pontos positivos e de atenção devem ser embasados nas métricas acima e nos critérios da posição. Sinalize explicitamente amostra baixa quando a minutagem ou as tentativas não sustentarem a conclusão; não transforme uma taxa percentual alta em evidência de alto volume. Retorne APENAS este JSON:
{"a":{"nome":"${pA.nome}","avaliacao":"frase técnica de scouting descrevendo o perfil do atleta","pros":["pro técnico/tático 1","pro técnico/tático 2","pro técnico/tático 3"],"contras":["ponto de atenção 1","ponto de atenção 2"],"nota":7,"recomendacao":"MONITORAR"},"b":{"nome":"${pB.nome}","avaliacao":"frase técnica de scouting descrevendo o perfil do atleta","pros":["pro técnico/tático 1","pro técnico/tático 2","pro técnico/tático 3"],"contras":["ponto de atenção 1","ponto de atenção 2"],"nota":6,"recomendacao":"NÃO INDICADO"},"veredicto":"2-3 frases técnicas de scouting indicando qual o Confiança deve priorizar e por quê, considerando Série C e custo-benefício."}`
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { pA, pB } = body

    if (!pA || !pB) {
      return Response.json({ error: 'Dados dos atletas não fornecidos.' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'OPENAI_API_KEY não configurada no servidor.' }, { status: 500 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55000)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: buildUserPrompt(pA, pB) },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const errText = await res.text()
      if (res.status === 401) return Response.json({ error: 'OPENAI_API_KEY inválida ou expirada.' }, { status: 401 })
      if (res.status === 429) return Response.json({ error: 'Limite temporário do serviço de processamento. Aguarde alguns minutos.' }, { status: 429 })
      return Response.json({ error: `Erro no serviço de processamento ${res.status}: ${errText}` }, { status: 500 })
    }

    const data = await res.json()
    const txt = data.choices?.[0]?.message?.content
    if (!txt) return Response.json({ error: 'O serviço de processamento não retornou conteúdo.' }, { status: 500 })

    const relatorio = JSON.parse(txt)
    return Response.json({ success: true, relatorio })

  } catch (err) {
    if (err.name === 'AbortError') {
      return Response.json({ error: 'Timeout: a análise demorou muito. Tente novamente.' }, { status: 504 })
    }
    return Response.json({ error: `Erro ao gerar relatório: ${err.message}` }, { status: 500 })
  }
}
