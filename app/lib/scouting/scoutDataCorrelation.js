const DIRECT = 'direct'
const INDIRECT = 'indirect'
const QUALITATIVE = 'qualitative'

const CONCEPTS = [
  {
    id:'short_pass', title:'PASSE CURTO E SEGURANÇA NA CIRCULAÇÃO', category:'TÉCNICO', evidence:DIRECT,
    patterns:[/passe curto/i,/seguran[cç]a no passe/i,/qualidade (?:t[eé]cnica )?.{0,25}passe/i,/boa rela[cç][aã]o com a bola/i],
    metricKeys:['passes_pct','passes_90','acoes_pct'],
  },
  {
    id:'long_pass', title:'PASSE LONGO E MUDANÇA DE CORREDOR', category:'TÉCNICO/TÁTICO', evidence:DIRECT,
    patterns:[/passe longo/i,/invers(?:a|ã)o/i,/troca(?:s)? de corredor/i,/mudan[cç]a de corredor/i],
    metricKeys:['passes_longos_pct','passes_longos_90'],
  },
  {
    id:'progression', title:'PROGRESSÃO E QUEBRA DE LINHAS', category:'TÉCNICO/TÁTICO', evidence:INDIRECT,
    patterns:[/quebrar? linhas?/i,/quebra de linhas?/i,/passes? verticais?/i,/progress(?:a|ã)o/i,/ganhar metros/i,/condu[cç][oõ]es?.{0,35}(?:press[aã]o|superioridade|linha)/i],
    metricKeys:['passes_tercofinal_90','passes_tercofinal_pct','passes_area_90'],
  },
  {
    id:'recovery', title:'RECUPERAÇÃO DE POSSE', category:'TÁTICO/DEFENSIVO', evidence:DIRECT,
    patterns:[/capacidade de recupera[cç][aã]o/i,/recupera[cç][oõ]es?/i,/recuperar a bola/i,/recuperar posse/i],
    metricKeys:['recuperacoes_90','recuperacoes_campo_adversario_90','intercecoes_90'],
  },
  {
    id:'ground_duels', title:'COMPETITIVIDADE NOS DUELOS PELO CHÃO', category:'FÍSICO/DEFENSIVO', evidence:DIRECT,
    patterns:[/duelos? pelo ch[aã]o/i,/duelos? terrestres?/i,/compete bem nos duelos/i,/competitividade nos duelos/i,/confronto defensivo/i],
    metricKeys:['duelos_def_pct','duelos_pct','duelos_def_90'],
  },
  {
    id:'aerial', title:'JOGO AÉREO', category:'FÍSICO/TÁTICO', evidence:DIRECT,
    patterns:[/jogo a[eé]reo/i,/duelos? a[eé]reos?/i,/bola a[eé]rea/i,/disputas? a[eé]reas?/i],
    metricKeys:['duelos_aereos_pct'],
  },
  {
    id:'ball_protection', title:'PROTEÇÃO DA BOLA SOB PRESSÃO', category:'TÉCNICO/FÍSICO', evidence:INDIRECT,
    patterns:[/proteger a bola/i,/prote[cç][aã]o da bola/i,/sustentar a posse sob contato/i,/recebe de costas/i,/recep[cç][aã]o de costas/i,/girar.{0,35}espa[cç]os curtos/i],
    metricKeys:['duelos_of_pct','perdas_campo_proprio_90','perdas_bola_90'],
  },
  {
    id:'scanning', title:'PERCEPÇÃO DO ENTORNO ANTES DA RECEPÇÃO', category:'COGNITIVO', evidence:QUALITATIVE,
    patterns:[/mapeamento/i,/percep[cç][aã]o do entorno/i,/scann(?:ing|ear|eamento)/i,/olha(?:r)? antes de receber/i,/antes da recep[cç][aã]o/i],
    metricKeys:[],
  },
  {
    id:'decision_pressure', title:'DECISÃO SOB PRESSÃO E EM ESPAÇO CURTO', category:'COGNITIVO/TÉCNICO', evidence:INDIRECT,
    patterns:[/tempo para decis[aã]o/i,/velocidade de (?:percep[cç][aã]o e )?decis[aã]o/i,/decis[aã]o sob press[aã]o/i,/solu[cç][oõ]es? em espa[cç]os curtos/i,/sob press[aã]o/i],
    metricKeys:['perdas_campo_proprio_90','passes_pct','duelos_of_pct'],
  },
  {
    id:'intensity', title:'RITMO E AÇÕES DE ALTA INTENSIDADE', category:'FÍSICO', evidence:QUALITATIVE,
    patterns:[/rota[cç][aã]o/i,/alta intensidade/i,/maior acelera[cç][aã]o/i,/em trote/i,/elevar o ritmo/i,/ritmo.{0,25}(?:m[eé]di|baix|alt)/i],
    metricKeys:[],
  },
  {
    id:'defensive_intervention', title:'AGRESSIVIDADE E INTERVENÇÃO DEFENSIVA', category:'TÁTICO/DEFENSIVO', evidence:DIRECT,
    patterns:[/agressiv.{0,25}(?:portador|defens)/i,/atacar o portador/i,/desarm(?:e|es|ar)/i,/interven[cç][aã]o defensiva/i],
    metricKeys:['duelos_def_90','intercecoes_90','recuperacoes_90'],
  },
  {
    id:'risk_control', title:'CONTROLE DE RISCO EM POSSE', category:'TÉCNICO/COGNITIVO', evidence:DIRECT,
    patterns:[/perdas? (?:de bola|no pr[oó]prio campo)/i,/risco em posse/i,/exposto [aà] press[aã]o/i,/entregar transi[cç][aã]o/i],
    metricKeys:['perdas_campo_proprio_90','perdas_bola_90','acoes_pct'],
  },
  {
    id:'availability', title:'DISPONIBILIDADE E PARTICIPAÇÃO NO JOGO', category:'FÍSICO/FUNCIONAL', evidence:INDIRECT,
    patterns:[/disponibilidade para o jogo/i,/participa[cç][aã]o constante/i,/oferece linha de passe/i,/envolvimento na circula[cç][aã]o/i],
    metricKeys:['passes_90','acoes_pct'],
  },
  {
    id:'competition_projection', title:'PROJEÇÃO DE NÍVEL COMPETITIVO', category:'PROJEÇÃO', evidence:QUALITATIVE,
    patterns:[/s[eé]rie c/i,/s[eé]rie b/i,/campeonato paulista/i,/n[ií]vel competitivo/i,/ritmo da competi[cç][aã]o/i,/transi[cç][aã]o para contextos/i,/maior intensidade/i],
    metricKeys:[],
  },
]

const POSITIVE = /\b(boa|bom|boas|bons|qualidade|seguran[cç]a|adequad[oa]s?|interessante|recurso|agrega|agregar|compete bem|competitividade|forte|eficiente|consistente|disponibilidade|capacidade|ganha|ganhar|mant[eé]m)\b/i
const NEGATIVE = /\b(pouco|pouca|poucos|poucas|dificuldade|dificuldades|baixo|baixa|m[eé]dia para baixa|limitad[oa]s?|conservador[oa]|exposto|problema|aten[cç][aã]o|d[uú]vida|oscila|perde|perdas|sem iniciativa|n[aã]o consegue|n[aã]o demonstra)\b/i

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function splitSentences(value) {
  const clean = cleanText(value)
  if (!clean) return []
  return clean.split(/(?<=[.!?;])\s+|\s+(?=(?:NO GERAL|DEFENSIVAMENTE|FISICAMENTE|EM POSSE|O PRINCIPAL|ESSE COMPORTAMENTO|O N[IÍ]VEL|PARA UMA S[EÉ]RIE)\b)/i)
    .map(s=>s.trim())
    .filter(s=>s.length >= 12)
}

function observationDirection(sentence) {
  const negative = NEGATIVE.test(sentence)
  const positive = POSITIVE.test(sentence)
  if (negative && !positive) return 'negative'
  if (positive && !negative) return 'positive'
  if (negative && positive) {
    const negAt = sentence.search(NEGATIVE)
    const posAt = sentence.search(POSITIVE)
    return negAt >= 0 && (posAt < 0 || negAt < posAt) ? 'negative' : 'positive'
  }
  return 'neutral'
}

function metricByKey(analysis, key) {
  return (analysis?.metrics || []).find(m=>m.key === key) || null
}

function dataEvidence(concept, analysis) {
  const metrics = concept.metricKeys.map(key=>metricByKey(analysis, key)).filter(Boolean)
    .filter(m=>m.percentileSerieC != null || m.percentileClub != null)
  if (!metrics.length) return null

  const ranked = metrics.map(m => {
    const values = [m.percentileSerieC, m.percentileClub].filter(v=>v!=null).map(Number)
    const percentile = values.length ? values.reduce((a,b)=>a+b,0)/values.length : null
    return { ...m, combinedPercentile:percentile }
  }).filter(m=>m.combinedPercentile != null)

  if (!ranked.length) return null
  const percentile = ranked.reduce((a,m)=>a+m.combinedPercentile,0)/ranked.length
  const direction = percentile >= 60 ? 'positive' : percentile <= 40 ? 'negative' : 'neutral'
  return { metrics:ranked, percentile:Math.round(percentile), direction }
}

function classification(concept, observed, data) {
  if (concept.evidence === QUALITATIVE || !data) return 'exclusive'
  if (observed === 'neutral' || data.direction === 'neutral') return concept.evidence === INDIRECT ? 'partial' : 'partial'
  if (observed === data.direction) return concept.evidence === INDIRECT ? 'indirect' : 'converge'
  return 'diverge'
}

function classMeta(kind) {
  if (kind === 'converge') return { label:'CONVERGE', tone:'#15803d', weight:1 }
  if (kind === 'indirect') return { label:'SUPORTE INDIRETO', tone:'#0f766e', weight:.75 }
  if (kind === 'partial') return { label:'CONVERGÊNCIA PARCIAL', tone:'#b7791f', weight:.55 }
  if (kind === 'diverge') return { label:'DIVERGÊNCIA / CONTEXTUALIZAR', tone:'#b45309', weight:.15 }
  return { label:'EVIDÊNCIA EXCLUSIVA DO SCOUT', tone:'#7c3aed', weight:null }
}

function metricSummary(data) {
  if (!data?.metrics?.length) return 'SEM INDICADOR QUANTITATIVO DIRETO NA BASE UTILIZADA.'
  return data.metrics.slice(0,3).map(m => {
    const parts = [m.label]
    if (m.percentileSerieC != null) parts.push(`SÉRIE C P${Math.round(m.percentileSerieC)}`)
    if (m.percentileClub != null) parts.push(`ADC P${Math.round(m.percentileClub)}`)
    return parts.join(' · ')
  }).join(' | ')
}

function readingCopy(kind, concept, observed, data) {
  if (kind === 'exclusive') return `A OBSERVAÇÃO SOBRE ${concept.title.toLowerCase()} É QUALITATIVA E NÃO POSSUI INDICADOR DIRETO SUFICIENTE NA BASE PARA CONFIRMAÇÃO OU CONTRADIÇÃO.`
  if (kind === 'converge') return `A LEITURA DO SCOUT E O PADRÃO QUANTITATIVO CAMINHAM NA MESMA DIREÇÃO PARA ${concept.title.toLowerCase()}.`
  if (kind === 'indirect') return `HÁ SUPORTE QUANTITATIVO INDIRETO PARA A OBSERVAÇÃO DE ${concept.title.toLowerCase()}, MAS AS MÉTRICAS NÃO IDENTIFICAM SOZINHAS A CAUSA DO COMPORTAMENTO.`
  if (kind === 'partial') return `OS DADOS OFERECEM SUPORTE PARCIAL OU NEUTRO PARA ${concept.title.toLowerCase()}; O CONTEXTO DA FUNÇÃO E DAS AÇÕES OBSERVADAS É NECESSÁRIO PARA FECHAR A LEITURA.`
  const direction = observed === 'negative' ? 'LIMITAÇÃO' : 'DESTAQUE'
  const dataText = data?.direction === 'positive' ? 'DESEMPENHO RELATIVO FAVORÁVEL' : data?.direction === 'negative' ? 'DESEMPENHO RELATIVO BAIXO' : 'DESEMPENHO PRÓXIMO DA MÉDIA'
  return `HÁ UMA DIVERGÊNCIA APARENTE: O SCOUT DESCREVE ${direction}, ENQUANTO O DADO MOSTRA ${dataText}. A DIFERENÇA DEVE SER CONTEXTUALIZADA PELA NATUREZA, LOCALIZAÇÃO E DIFICULDADE DAS AÇÕES.`
}

function collectMatches(report, analysis) {
  const sentences = splitSentences(report)
  const items = []
  for (const concept of CONCEPTS) {
    const matches = sentences.filter(sentence => concept.patterns.some(pattern=>pattern.test(sentence)))
    if (!matches.length) continue
    const selected = matches.slice(0,2).join(' ')
    const observed = observationDirection(selected)
    const data = dataEvidence(concept, analysis)
    const kind = classification(concept, observed, data)
    const meta = classMeta(kind)
    items.push({
      id:concept.id,
      title:concept.title,
      category:concept.category,
      observation:selected,
      observedDirection:observed,
      evidenceType:concept.evidence,
      classification:kind,
      classificationLabel:meta.label,
      tone:meta.tone,
      dataPercentile:data?.percentile ?? null,
      dataDirection:data?.direction || null,
      metrics:data?.metrics?.map(m=>({ key:m.key, label:m.label, percentileSerieC:m.percentileSerieC, percentileClub:m.percentileClub })) || [],
      dataText:metricSummary(data),
      reading:readingCopy(kind, concept, observed, data),
    })
  }
  return items
}

function uniqueTitles(items, limit = 3) {
  return items.slice(0,limit).map(i=>i.title).join(', ')
}

function integratedSummary(items, analysis, score, label) {
  if (!items.length) return ''
  const converges = items.filter(i=>['converge','indirect'].includes(i.classification))
  const diverges = items.filter(i=>i.classification === 'diverge')
  const exclusives = items.filter(i=>i.classification === 'exclusive')
  const partials = items.filter(i=>i.classification === 'partial')
  const parts = []

  parts.push(`A OBSERVAÇÃO DO SCOUT APRESENTA ${label} COM O PERFIL IDENTIFICADO NOS DADOS ENTRE OS ASPECTOS QUE POSSUEM CORRESPONDÊNCIA QUANTITATIVA.`)
  if (converges.length) parts.push(`AS PRINCIPAIS CONVERGÊNCIAS ESTÃO RELACIONADAS A ${uniqueTitles(converges)}.`)
  if (diverges.length) parts.push(`HÁ DIVERGÊNCIA OU NECESSIDADE DE CONTEXTUALIZAÇÃO EM ${uniqueTitles(diverges,2)}, O QUE EXIGE LEITURA DA NATUREZA E DO CONTEXTO DAS AÇÕES EM VEZ DE INTERPRETAÇÃO ISOLADA DO PERCENTIL.`)
  if (partials.length) parts.push(`OUTROS ASPECTOS, COMO ${uniqueTitles(partials,2)}, RECEBEM SUPORTE APENAS PARCIAL DOS INDICADORES DISPONÍVEIS.`)
  if (exclusives.length) parts.push(`A OBSERVAÇÃO ACRESCENTA EVIDÊNCIAS QUE A BASE NÃO MEDE DIRETAMENTE, ESPECIALMENTE ${uniqueTitles(exclusives)}; NESTES PONTOS, O PARECER DO SCOUT É A FONTE PRINCIPAL.`)
  if (analysis?.serieCScore != null) parts.push(`NO BENCHMARK QUANTITATIVO, O ATLETA REGISTRA NÍVEL SÉRIE C ${Math.round(analysis.serieCScore)} E FIT CONFIANÇA ${Math.round(analysis.fitScore || 0)}; ESSES SCORES DEVEM SER LIDOS EM CONJUNTO COM A OBSERVAÇÃO E NÃO COMO SUBSTITUTOS DELA.`)
  return parts.join(' ')
}

export function buildScoutDataCorrelation(report, analysis) {
  const clean = cleanText(report)
  if (!clean) return null
  const items = collectMatches(clean, analysis)
  const comparable = items.filter(i=>i.classification !== 'exclusive')
  const weights = comparable.map(item=>classMeta(item.classification).weight).filter(v=>v!=null)
  const score = weights.length ? Math.round(weights.reduce((a,b)=>a+b,0)/weights.length * 100) : null
  const label = score == null ? 'SEM BASE COMPARÁVEL' : score >= 75 ? 'ALTA CONVERGÊNCIA' : score >= 55 ? 'CONVERGÊNCIA RELEVANTE' : score >= 35 ? 'CONVERGÊNCIA PARCIAL' : 'BAIXA CONVERGÊNCIA'
  return {
    version:1,
    generatedAt:new Date().toISOString(),
    score,
    label,
    comparableCount:comparable.length,
    convergenceCount:items.filter(i=>['converge','indirect'].includes(i.classification)).length,
    divergenceCount:items.filter(i=>i.classification === 'diverge').length,
    exclusiveCount:items.filter(i=>i.classification === 'exclusive').length,
    items,
    integratedSummary:integratedSummary(items, analysis, score, label),
    note:'O ÍNDICE DE CONVERGÊNCIA NÃO É UMA CORRELAÇÃO ESTATÍSTICA NEM UMA NOTA DO ATLETA. ELE RESUME O GRAU DE ALINHAMENTO ENTRE OBSERVAÇÕES COM CORRESPONDÊNCIA QUANTITATIVA E OS PERCENTIS DISPONÍVEIS.',
  }
}
