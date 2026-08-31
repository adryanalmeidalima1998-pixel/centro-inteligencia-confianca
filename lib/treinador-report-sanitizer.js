const UNSUPPORTED_PATTERNS = [
  /sem\s+evid[eê]ncia/i,
  /evid[eê]ncia\s+insuficiente/i,
  /n[aã]o\s+h[aá]\s+evid[eê]ncia/i,
  /aus[eê]ncia\s+de\s+evid[eê]ncia/i,
  /falta\s+de\s+evid[eê]ncia/i,
  /validar\s+em\s+v[ií]deo/i,
  /valida[cç][aã]o\s+(?:complementar\s+)?(?:em\s+)?v[ií]deo/i,
  /necessita\s+(?:de\s+)?valida[cç][aã]o/i,
  /precisa\s+(?:ser\s+)?validado/i,
  /requer\s+valida[cç][aã]o/i,
  /\binfer[eê]ncia\b/i,
  /material\s+(?:enviado\s+)?n[aã]o\s+(?:informa|permite|traz|detalha|descreve)/i,
  /n[aã]o\s+h[aá]\s+(?:descri[cç][aã]o|detalhamento|informa[cç][aã]o)\s+(?:suficiente|concreta|espec[ií]fica)?/i,
  /sem\s+(?:descri[cç][aã]o|detalhamento|informa[cç][aã]o)\s+(?:suficiente|concreta|espec[ií]fica)?/i,
  /n[aã]o\s+(?:permite|[ée]\s+poss[ií]vel)\s+concluir/i,
  /n[aã]o\s+foi\s+poss[ií]vel\s+(?:concluir|determinar|identificar)/i,
  /comportamentos?\s+[^.]{0,60}n[aã]o\s+documentad[oa]s?/i,
  /aspectos?\s+[^.]{0,60}n[aã]o\s+documentad[oa]s?/i,
  /dados?\s+[^.]{0,40}n[aã]o\s+permitem/i,
  /pode\s+ser\s+uma\s+infer[eê]ncia/i,
  /isso\s+[ée]\s+infer[eê]ncia/i,
]

export function isUnsupportedScoutingText(value) {
  const text = String(value || '').trim()
  if (!text) return false
  return UNSUPPORTED_PATTERNS.some(rx => rx.test(text))
}

export function sanitizeScoutingText(value) {
  const text = String(value || '').trim()
  if (!text || isUnsupportedScoutingText(text)) return ''
  return text
}

function cleanPairs(list, textKeys) {
  return (Array.isArray(list) ? list : [])
    .map(item => {
      const next = { ...(item || {}) }
      for (const key of textKeys) next[key] = sanitizeScoutingText(next[key])
      return next
    })
    .filter(item => textKeys.some(key => String(item?.[key] || '').trim()))
}

export function sanitizeCoachReport(report = {}) {
  const next = { ...(report || {}) }

  for (const key of [
    'resumo_executivo','titulos_principais','filosofia_declarada','fonte_filosofia',
    'coerencia_discurso_dados','referencias_externas','sintese_final'
  ]) next[key] = sanitizeScoutingText(next[key])

  next.modelo_jogo = { ...(next.modelo_jogo || {}) }
  for (const key of [
    'saida_bola','construcao','ultimo_terco','transicao_ofensiva','bloco_alto',
    'bloco_medio_baixo','transicao_defensiva','bola_parada_ofensiva','bola_parada_defensiva'
  ]) next.modelo_jogo[key] = sanitizeScoutingText(next.modelo_jogo[key])

  next.pontos_fortes = cleanPairs(next.pontos_fortes, ['titulo','evidencia'])
  next.pontos_melhoria = cleanPairs(next.pontos_melhoria, ['titulo','evidencia'])
    .filter(item => item.titulo && item.evidencia)

  next.perfis_jogadores = (Array.isArray(next.perfis_jogadores) ? next.perfis_jogadores : [])
    .map(item => ({
      ...(item || {}),
      posicao: String(item?.posicao || '').trim(),
      perfil: sanitizeScoutingText(item?.perfil),
      observacao: sanitizeScoutingText(item?.observacao)
    }))
    // Uma posição só entra no relatório quando existe um perfil concreto sustentado pelo material.
    .filter(item => item.posicao && item.perfil)

  next.adaptabilidade = (Array.isArray(next.adaptabilidade) ? next.adaptabilidade : [])
    .map(item => ({
      ...(item || {}),
      criterio: String(item?.criterio || '').trim(),
      nota: Number(item?.nota || 0),
      justificativa: sanitizeScoutingText(item?.justificativa)
    }))
    // Nota sem justificativa ou critério sem base não deve aparecer como avaliação.
    .filter(item => item.criterio && item.nota > 0 && item.justificativa)

  next.sistemas_taticos = (Array.isArray(next.sistemas_taticos) ? next.sistemas_taticos : [])
    .map(item => ({
      ...(item || {}),
      sistema: String(item?.sistema || '').trim(),
      frequencia: sanitizeScoutingText(item?.frequencia),
      contexto: sanitizeScoutingText(item?.contexto),
      evidencia: sanitizeScoutingText(item?.evidencia)
    }))
    .filter(item => item.sistema && (item.contexto || item.frequencia || item.evidencia))

  next.justificativas_recomendacao = cleanPairs(next.justificativas_recomendacao, ['titulo','texto'])
    .filter(item => item.titulo && item.texto)

  if (next.aderencia_objetivo && typeof next.aderencia_objetivo === 'object') {
    next.aderencia_objetivo = { ...next.aderencia_objetivo }
    next.aderencia_objetivo.experiencia_serie_d = sanitizeScoutingText(next.aderencia_objetivo.experiencia_serie_d)
    next.aderencia_objetivo.evidencias = (next.aderencia_objetivo.evidencias || []).map(sanitizeScoutingText).filter(Boolean)
    next.aderencia_objetivo.riscos = (next.aderencia_objetivo.riscos || []).map(sanitizeScoutingText).filter(Boolean)
    next.aderencia_objetivo.acessos_confirmados = (next.aderencia_objetivo.acessos_confirmados || [])
      .map(item => ({ ...(item || {}), evidencia: sanitizeScoutingText(item?.evidencia) }))
      .filter(item => item.clube && item.temporada && item.origem && item.destino && item.evidencia)
  }

  return next
}
