// Catálogo inteligente das métricas das novas planilhas SportsBase/Wyscout.
// Mantém a base flexível: qualquer coluna numérica continua disponível, mas
// categorias, direção de desempenho e amostra mínima evitam rankings enganosos.
import {
  findMetricColumn,
  higherIsBetter,
  isIdentityColumn,
  isNumeric,
  isPercentageMetric,
  isVolumeMetric,
  toNumber,
} from './serieC'

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export const PLAYER_CATEGORY_ORDER = [
  'Ataque e finalização',
  'Criação e xA',
  'Progressão e recepção',
  'Passes e construção',
  'Dribles e condução',
  'Duelos e defesa',
  'Pressão e recuperações',
  'Controle, perdas e disciplina',
  'Impacto xG em campo',
  'Outras métricas',
]

export const GOALKEEPER_CATEGORY_ORDER = [
  'Defesa de meta',
  'Perfil das finalizações sofridas',
  'Área e cruzamentos',
  'Distribuição',
  'Tiros de meta',
  'Bolas paradas e pênaltis',
  'Ações, erros e disciplina',
  'Outras métricas',
]

export function playerMetricCategory(metric) {
  const k = norm(metric)
  if (/(xgt|xgopp|nxg|xgd\b|xgdps)/.test(k)) return 'Impacto xG em campo'
  if (/(assist|xa \(|passes?-chave|passes? para chute|chance.*criad)/.test(k)) return 'Criação e xA'
  if (/(passe.*recebid|entrada.*terco final|para a frente no terco final|progressiv|limpos recebidos)/.test(k)) return 'Progressão e recepção'
  if (/(gol|xg \(|xgps|xgpg|xgc|chute|remate|chance de gol|cabec|tiro livre|acao na area adversaria|participacao em ataques com gol)/.test(k)) return 'Ataque e finalização'
  if (/(passe|cruzamento)/.test(k)) return 'Passes e construção'
  if (/(drible|conduc)/.test(k)) return 'Dribles e condução'
  if (/(duelo|desarme|intercept)/.test(k)) return 'Duelos e defesa'
  if (/(recupera)/.test(k)) return 'Pressão e recuperações'
  if (/(perda|falta|cartao|erro|acao malsucedida|dominio.*incorreto|impedimento|substitu|aparicoes|partidas jogadas)/.test(k)) return 'Controle, perdas e disciplina'
  return 'Outras métricas'
}

export function goalkeeperMetricCategory(metric) {
  const k = norm(metric)
  if (/(penalti|bola parada|escanteio|tiro livre|lateral)/.test(k)) return 'Bolas paradas e pênaltis'
  if (/(tiro de meta)/.test(k)) return 'Tiros de meta'
  if (/(passe|lancamento com a mao)/.test(k)) return 'Distribuição'
  if (/(cruzamento|intervenc.*fora da area)/.test(k)) return 'Área e cruzamentos'
  if (/(curta distancia|media distancia|longa distancia)/.test(k)) return 'Perfil das finalizações sofridas'
  if (/(chute|gol sofrido|defesa|encaix|espalm|xg dos chutes|xg por chute|conversao de xg)/.test(k)) return 'Defesa de meta'
  if (/(acao|erro|cartao|falta|participacao)/.test(k)) return 'Ações, erros e disciplina'
  return 'Outras métricas'
}

export function metricCategory(metric, entityType = 'player') {
  return entityType === 'goalkeeper' ? goalkeeperMetricCategory(metric) : playerMetricCategory(metric)
}

// Carga/contexto: útil para leitura, mas não deve gerar automaticamente a frase
// "melhor da liga". Ex.: goleiro que sofreu mais chutes não é necessariamente melhor.
export function isContextMetric(metric, entityType = 'player') {
  const k = norm(metric)
  if (entityType === 'goalkeeper') {
    return [
      'chutes sofridos', 'chutes no alvo sofridos', 'cruzamentos do adversario',
      'chutes de curta distancia do adversario', 'chutes de media distancia do adversario',
      'chutes de longa distancia do adversario', 'xg dos chutes do adversario',
      'ataques do adversario de bola parada', 'ataques do adversario de tiro livre',
      'ataques do adversario de escanteio', 'ataques do adversario de lateral',
      'penaltis do adversario', 'partidas jogadas',
    ].some(term => k.includes(term)) && !k.includes('defendid') && !k.includes('bem-suced') && !k.includes('com chute, %')
  }
  return /(partidas jogadas|aparicoes na escalacao inicial|substituicoes$|xgt|xgopp|xgpg|xgc|entradas no terco final por (passe|conducao), % do total)/.test(k)
}

export function metricHigherIsBetter(metric, entityType = 'player') {
  const k = norm(metric)
  if (entityType === 'goalkeeper') {
    if (/(gols sofridos|gols de tiro livre do adversario|erros que|malsucedid|espalmadas para zona perigosa|conversao de xg do adversario|gols sofridos de penalti)/.test(k)) return false
    // Para métricas de frequência de ataques/chutes adversários após bola parada,
    // menor é preferível quando usadas como desempenho defensivo.
    if (/ataques do adversario.*com chute/.test(k)) return false
  }
  return higherIsBetter(metric)
}

function rule(sampleAliases, minAttempts, sampleNoun) {
  return { sampleAliases, minAttempts, sampleNoun }
}

// Retorna o denominador e o piso de amostra para percentuais de eficiência.
// Percentuais que descrevem apenas distribuição (ex.: % de entradas por passe)
// não precisam ser tratados como "eficiência" para ranking.
export function metricSampleRule(metric, entityType = 'player') {
  const k = norm(metric)
  if (!isPercentageMetric(metric)) return null

  if (entityType === 'goalkeeper') {
    if (k === 'chutes defendidos, %') return rule(['Chutes no alvo sofridos'], 30, 'chutes no alvo sofridos')
    if (k.includes('tentativas de interceptacao de cruzamentos') && k.includes('%')) return rule(['Tentativas de interceptação de cruzamentos e passes'], 10, 'tentativas')
    if (k === 'passes precisos, %') return rule(['Passes'], 100, 'passes')
    if (k.includes('intervencoes fora da area bem-sucedidas')) return rule(['Intervenções fora da área'], 6, 'intervenções')
    if (k === 'tiros de meta precisos, %') return rule(['Tiros de meta'], 25, 'tiros de meta')
    if (k.includes('tiros de meta curtos') && k.includes('%')) return rule(['Tiros de meta curtos (<15 m)'], 8, 'tiros curtos')
    if (k.includes('tiros de meta medios') && k.includes('%')) return rule(['Tiros de meta médios (15-40 m)'], 12, 'tiros médios')
    if (k.includes('tiros de meta longos') && k.includes('%')) return rule(['Tiros de meta longos (40+ m)'], 15, 'tiros longos')
    if (k.includes('passes em jogo corrido precisos')) return rule(['Passes em jogo corrido'], 80, 'passes em jogo corrido')
    if (k.includes('lancamentos com a mao precisos')) return rule(['Lançamentos com a mão'], 20, 'lançamentos')
    if (k.includes('passes de bola parada precisos')) return rule(['Passes de bola parada'], 30, 'passes de bola parada')
    if (k.includes('passes curtos precisos')) return rule(['Passes curtos'], 25, 'passes curtos')
    if (k.includes('passes medios precisos')) return rule(['Passes médios'], 60, 'passes médios')
    if (k.includes('passes longos precisos')) return rule(['Passes longos'], 40, 'passes longos')
    if (k.includes('curta distancia defendidos')) return rule(['Chutes de curta distância do adversário no alvo'], 10, 'chutes no alvo')
    if (k.includes('media distancia defendidos')) return rule(['Chutes de média distância do adversário no alvo'], 12, 'chutes no alvo')
    if (k.includes('longa distancia defendidos')) return rule(['Chutes de longa distância do adversário no alvo'], 12, 'chutes no alvo')
    if (k.includes('ataques do adversario de bola parada com chute')) return rule(['Ataques do adversário de bola parada'], 40, 'ataques de bola parada')
    if (k.includes('ataques do adversario de tiro livre com chute')) return rule(['Ataques do adversário de tiro livre'], 20, 'ataques de tiro livre')
    if (k.includes('ataques do adversario de escanteio com chute')) return rule(['Ataques do adversário de escanteio'], 30, 'escanteios adversários')
    if (k.includes('ataques do adversario de lateral com chute')) return rule(['Ataques do adversário de lateral'], 15, 'laterais adversários')
    if (k.includes('penaltis defendidos')) return rule(['Pênaltis do adversário'], 3, 'pênaltis')
    // Percentuais de composição de defesas (encaixadas/espalmadas) usam a quantidade de defesas como amostra.
    if (/(chutes encaixados|espalmadas para zona segura|espalmadas para zona perigosa), %/.test(k)) return rule(['Chutes defendidos'], 25, 'defesas')
    if (k === 'gols de tiro livre do adversario, %') return rule(['Chutes de tiro livre do adversário'], 5, 'chutes de tiro livre')
    if (k === 'acoes bem-sucedidas, %') return rule(['Ações'], 60, 'ações')
    return null
  }

  if (k === 'chances de gol bem-sucedidas, %') return rule(['Chances de gol'], 10, 'chances')
  if (k === 'passes precisos, %') return rule(['Passes'], 150, 'passes')
  if (k === 'passes-chave precisos, %') return rule(['Passes-chave'], 12, 'passes-chave')
  if (k === 'cruzamentos precisos, %') return rule(['Cruzamentos'], 20, 'cruzamentos')
  if (k === 'passes progressivos precisos, %') return rule(['Passes progressivos'], 50, 'passes progressivos')
  if (k === 'passes curtos precisos, %') return rule(['Passes curtos'], 50, 'passes curtos')
  if (k === 'passes longos precisos, %') return rule(['Passes longos'], 30, 'passes longos')
  if (k === 'passes para a frente no terco final precisos, %') return rule(['Passes para a frente no terço final'], 25, 'passes')
  if (k === 'passes para a area precisos, %') return rule(['Passes para a área'], 20, 'passes para a área')
  if (k === 'passes muito longos precisos, %') return rule(['Passes muito longos'], 15, 'passes muito longos')
  if (k === 'duelos ganhos, %') return rule(['Duelos'], 50, 'duelos')
  if (k === 'duelos defensivos ganhos, %') return rule(['Duelos defensivos'], 30, 'duelos defensivos')
  if (k === 'duelos ofensivos ganhos, %') return rule(['Duelos ofensivos'], 30, 'duelos ofensivos')
  if (k === 'duelos aereos ganhos, %') return rule(['Duelos aéreos'], 20, 'duelos aéreos')
  if (k === 'dribles bem-sucedidos, %') return rule(['Dribles'], 20, 'dribles')
  if (k === 'dribles no terco final bem-sucedidos, %') return rule(['Dribles no terço final'], 10, 'dribles no terço final')
  if (k === 'desarmes bem-sucedidos, %') return rule(['Desarmes'], 20, 'desarmes')
  if (k === 'acoes bem-sucedidas, %') return rule(['Ações'], 100, 'ações')
  if (k === 'acoes na area adversaria bem-sucedidas, %') return rule(['Ações na área adversária'], 15, 'ações na área')
  if (k === 'chutes no alvo, %') return rule(['Chutes'], 15, 'chutes')
  if (k === 'chutes no alvo da area, %') return rule(['Chutes da área'], 10, 'chutes da área')
  if (k === 'chutes no alvo de fora da area, %') return rule(['Chutes de fora da área'], 8, 'chutes de fora')
  if (k === 'cabecios no alvo, %') return rule(['Cabeceios'], 8, 'cabeceios')
  if (k === 'chutes de tiro livre no alvo, %') return rule(['Chutes de tiro livre'], 5, 'faltas diretas')
  // Percentuais de composição das entradas no terço final não são eficiência.
  if (k.includes('entradas no terco final por passe, %') || k.includes('entradas no terco final por conducao, %')) return null
  return null
}

export function metricEligibilityForRanking(row, metric, { entityType = 'player', minMinutes = 300 } = {}) {
  const minutes = toNumber(row?.minutes) || 0
  if (minutes < minMinutes) return { eligible:false, reason:'minutes', sample:null, rule:null }
  if (isContextMetric(metric, entityType)) return { eligible:false, reason:'context', sample:null, rule:null }
  const sampleRule = metricSampleRule(metric, entityType)
  if (!sampleRule) return { eligible:true, reason:null, sample:null, rule:null }
  const sampleCol = sampleRule.sampleAliases.map(name => findMetricColumn(row?.metrics, name)).find(Boolean)
  const sample = sampleCol ? toNumber(row?.metrics?.[sampleCol]) : null
  const eligible = sample !== null && sample >= sampleRule.minAttempts
  return { eligible, reason:eligible ? null : 'sample', sample, rule:sampleRule }
}

export function numericMetricKeys(rows = []) {
  const keys = Array.from(new Set((rows || []).flatMap(row => Object.keys(row?.metrics || {}))))
  return keys.filter(key => !isIdentityColumn(key) && (rows || []).some(row => isNumeric(row?.metrics?.[key])))
}

export function metricMeta(metric, entityType = 'player') {
  return {
    metric,
    category:metricCategory(metric, entityType),
    higher:metricHigherIsBetter(metric, entityType),
    contextOnly:isContextMetric(metric, entityType),
    pct:isPercentageMetric(metric),
    volume:isVolumeMetric(metric),
    sampleRule:metricSampleRule(metric, entityType),
  }
}

export const PLAYER_OVERVIEW_METRICS = [
  'Gols', 'Assistências', 'xG (Gols esperados)', 'xA (assistências esperadas)',
  'Chances de gol criadas', 'Chutes', 'Chutes no alvo, %', 'Ações na área adversária',
  'Passes-chave', 'Passes progressivos', 'Passes progressivos limpos', 'Passes para a área',
  'Entradas no terço final', 'Dribles bem-sucedidos, %', 'Duelos ganhos, %',
  'Duelos defensivos ganhos, %', 'Duelos ofensivos ganhos, %', 'Duelos aéreos ganhos, %',
  'Interceptações', 'Recuperações da bola', 'Recuperações da bola no campo adversário',
  'Perdas da bola no próprio campo', 'NxG (xG líquido, diferença entre xGT e xGOPP)',
]

export const PLAYER_RADAR_METRICS = [
  'Gols', 'xG (Gols esperados)', 'xA (assistências esperadas)', 'Passes-chave',
  'Passes progressivos', 'Entradas no terço final', 'Dribles bem-sucedidos, %',
  'Duelos ganhos, %', 'Interceptações', 'Recuperações da bola no campo adversário',
]

export const GOALKEEPER_OVERVIEW_METRICS = [
  'Chutes defendidos, %', 'Grandes defesas', 'xG dos chutes do adversário',
  'xG por gol sofrido', 'Intervenções fora da área',
  'Tentativas de interceptação de cruzamentos e passes bem-sucedidas, %',
  'Passes precisos, %', 'Passes longos precisos, %', 'Tiros de meta precisos, %',
  'Chutes de curta distância defendidos, %', 'Chutes de média distância defendidos, %',
  'Chutes de longa distância defendidos, %', 'Pênaltis defendidos, %',
]

export const GOALKEEPER_RADAR_METRICS = [
  'Chutes defendidos, %', 'Grandes defesas', 'xG por gol sofrido',
  'Tentativas de interceptação de cruzamentos e passes bem-sucedidas, %',
  'Intervenções fora da área bem-sucedidas, %', 'Passes precisos, %',
  'Passes longos precisos, %', 'Tiros de meta precisos, %',
]
