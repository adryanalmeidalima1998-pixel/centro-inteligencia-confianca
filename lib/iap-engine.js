/**
 * iap-engine.js
 * Motor puro de cálculo de percentil + IAP
 * Sem side effects, sem fetch, sem estado
 *
 * Uso:
 *   import { calcularIAP } from '@/lib/iap-engine'
 *   const resultado = calcularIAP(jogadores, grupo, filtros)
 */

import { IAP_PERFIS, getConfiabilidade, resolveGrupo } from '@/data/iap-profiles'
import { getSportsbaseIapProfiles, isSportsbaseIapMetricEligible } from '@/data/sportsbase-iap-profiles'
import { getSuggestedMinimumMinutes } from '@/data/sportsbase-map'

function roundTo50(value) {
  return Math.max(0, Math.round(Number(value || 0) / 50) * 50)
}

function getSportsbaseConfiabilidade(minutos, minimumMinutes) {
  const m = Number(minutos) || 0
  const reference = Math.max(50, Number(minimumMinutes) || 0)
  const mediumThreshold = reference
  const lowThreshold = Math.max(270, roundTo50(reference * 0.6))
  const highThreshold = Math.max(mediumThreshold + 250, roundTo50(reference * 1.75))

  if (m >= highThreshold) return { label:'Alta', cor:'#16a34a', nivel:4, threshold:highThreshold, reference }
  if (m >= mediumThreshold) return { label:'Média', cor:'#ca8a04', nivel:3, threshold:mediumThreshold, reference }
  if (m >= lowThreshold) return { label:'Baixa', cor:'#ea580c', nivel:2, threshold:lowThreshold, reference }
  return { label:'Muito Baixa', cor:'#dc2626', nivel:1, threshold:lowThreshold, reference }
}

/**
 * Calcula o percentil de um valor dentro de um array de valores
 * @param {number} valor - valor do jogador
 * @param {number[]} todos - todos os valores do grupo
 * @param {boolean} inverted - se true, menor = melhor
 * @returns {number} percentil 0–100
 */
export function calcularPercentil(valor, todos, inverted = false) {
  if (valor === null || valor === undefined || isNaN(parseFloat(valor))) return 0
  const v = parseFloat(valor)
  const validos = todos.filter(x => x !== null && x !== undefined && !isNaN(parseFloat(x))).map(parseFloat)
  if (validos.length === 0) return 0

  const abaixo = validos.filter(x => x < v).length
  const igual  = validos.filter(x => x === v).length
  // Percentil de posição média. Para métricas invertidas, menor valor recebe percentil maior.
  const pct = ((abaixo + 0.5 * igual) / validos.length) * 100
  return inverted ? (100 - pct) : pct
}

/**
 * Calcula o IAP de um jogador para um perfil específico
 * @param {Object} jogador - dados do jogador (chaves normalizadas da base de ligas)
 * @param {Array} metricas - lista de { key, peso, inverted? }
 * @param {Object} percentisGrupo - { [key]: number[] } — valores do grupo para cada chave
 * @returns {{ iap: number, percentis: Object }}
 */
export function calcularIAPPerfil(jogador, metricas, percentisGrupo, options = {}) {
  let somaPonderada = 0
  let somaPesos = 0
  const percentis = {}

  for (const metrica of metricas) {
    const { key, peso, inverted } = metrica
    const val = jogador[key]
    const todos = (percentisGrupo[key] || []).filter(
      item => item !== null && item !== undefined && !isNaN(parseFloat(item))
    )

    // No Sportsbase, percentuais só entram com denominador e amostra suficientes.
    if (options.sportsbase && !isSportsbaseIapMetricEligible(jogador, metrica, options.minimumMinutes || 0)) continue

    // Fontes diferentes podem não oferecer todas as métricas do perfil.
    // Nesses casos, a métrica não entra no peso em vez de virar zero artificial.
    if (val === null || val === undefined || isNaN(parseFloat(val)) || todos.length === 0) continue

    const pct = calcularPercentil(val, todos, inverted)
    percentis[key] = Math.round(pct)
    somaPonderada += pct * peso
    somaPesos += peso
  }

  const iap = somaPesos > 0 ? Math.round(somaPonderada / somaPesos) : 0
  return { iap, percentis }
}

/**
 * Motor principal: processa todos os jogadores de um grupo e calcula IAP por perfil
 * @param {Array} jogadores - lista de jogadores já filtrados pelo grupo/posição
 * @param {string} grupo - 'Goleiro' | 'Zagueiro' | 'Lateral' | 'Volante' | 'Meia' | 'Extremo' | 'Atacante'
 * @returns {Array} jogadores enriquecidos com campos IAP
 */
export function calcularIAP(jogadores, grupo) {
  if (jogadores.length === 0) return jogadores

  const sportsbase = jogadores.some(jogador => jogador?._fonte === 'sportsbase')
  const perfis = sportsbase ? getSportsbaseIapProfiles(grupo) : IAP_PERFIS[grupo]
  if (!perfis || Object.keys(perfis).length === 0) return jogadores

  const minimumMinutes = sportsbase ? getSuggestedMinimumMinutes(jogadores) : 0
  const nomePerfis = Object.keys(perfis)

  // 1. Coletar todos os valores por chave (para calcular percentis dinamicamente)
  const todasChaves = new Set()
  for (const metricas of Object.values(perfis)) {
    for (const { key } of metricas) todasChaves.add(key)
  }

  const metricasPorChave = {}
  for (const metricas of Object.values(perfis)) {
    for (const metrica of metricas) {
      if (!metricasPorChave[metrica.key]) metricasPorChave[metrica.key] = metrica
    }
  }

  const percentisGrupo = {}
  for (const key of todasChaves) {
    const metrica = metricasPorChave[key]
    percentisGrupo[key] = jogadores
      .filter(jogador => !sportsbase || isSportsbaseIapMetricEligible(jogador, metrica, minimumMinutes))
      .map(jogador => jogador[key])
  }

  // 2. Calcular IAP por perfil para cada jogador
  return jogadores.map(jogador => {
    const iapPorPerfil = {}
    const percentisPorPerfil = {}

    for (const nomePerfil of nomePerfis) {
      const metricas = perfis[nomePerfil]
      const { iap, percentis } = calcularIAPPerfil(jogador, metricas, percentisGrupo, { sportsbase, minimumMinutes })
      iapPorPerfil[nomePerfil] = iap
      percentisPorPerfil[nomePerfil] = percentis
    }

    // 3. Ordenar perfis por IAP para encontrar dominante e 2º melhor
    const rankingPerfis = nomePerfis
      .map(nome => ({ nome, iap: iapPorPerfil[nome] }))
      .sort((a, b) => b.iap - a.iap)

    const perfilDominante    = rankingPerfis[0]?.nome || null
    const iapDominante       = rankingPerfis[0]?.iap  || 0
    const segundoPerfil      = rankingPerfis[1]?.nome || null
    const iapSegundoPerfil   = rankingPerfis[1]?.iap  || 0

    // 4. Confiabilidade
    const confiabilidade = sportsbase
      ? getSportsbaseConfiabilidade(jogador.minutos, minimumMinutes)
      : getConfiabilidade(jogador.minutos)

    // 5. Alertas técnicos
    const alertas = gerarAlertas(jogador, grupo, perfilDominante, iapDominante, confiabilidade, rankingPerfis)

    return {
      ...jogador,
      _grupo: grupo,
      _iap_por_perfil: iapPorPerfil,
      _percentis_por_perfil: percentisPorPerfil,
      _ranking_perfis: rankingPerfis,
      _perfil_dominante: perfilDominante,
      _iap_dominante: iapDominante,
      _segundo_perfil: segundoPerfil,
      _iap_segundo: iapSegundoPerfil,
      _confiabilidade: confiabilidade,
      _alertas: alertas,
    }
  })
}

/**
 * Calcula ranking por perfil: posição do jogador no grupo para o perfil dominante
 * @param {Array} jogadoresComIAP - resultado de calcularIAP
 * @returns {Array} jogadores com _ranking (posição) e _total_ranking (total no recorte)
 */
export function calcularRanking(jogadoresComIAP) {
  if (jogadoresComIAP.length === 0) return jogadoresComIAP

  // Agrupar por perfil dominante para ranking
  const porPerfil = {}
  for (const j of jogadoresComIAP) {
    const p = j._perfil_dominante
    if (!porPerfil[p]) porPerfil[p] = []
    porPerfil[p].push(j)
  }

  // Ordenar cada grupo por IAP dominante e atribuir posição
  const resultado = []
  for (const j of jogadoresComIAP) {
    const p = j._perfil_dominante
    const grupo = porPerfil[p].sort((a, b) => b._iap_dominante - a._iap_dominante)
    const posicao = grupo.findIndex(x => x.nome === j.nome && x.equipa === j.equipa) + 1
    resultado.push({
      ...j,
      _ranking: posicao,
      _total_ranking: grupo.length,
    })
  }

  return resultado
}

/**
 * Calcula médias do grupo por métrica (para comparação com média da liga)
 * @param {Array} jogadores
 * @returns {Object} { [key]: number } médias por chave
 */
export function calcularMediasGrupo(jogadores) {
  if (jogadores.length === 0) return {}
  const totais = {}
  const counts = {}

  for (const j of jogadores) {
    for (const [key, val] of Object.entries(j)) {
      if (key.startsWith('_')) continue
      const n = parseFloat(val)
      if (!isNaN(n)) {
        totais[key] = (totais[key] || 0) + n
        counts[key] = (counts[key] || 0) + 1
      }
    }
  }

  const medias = {}
  for (const key of Object.keys(totais)) {
    medias[key] = counts[key] > 0 ? totais[key] / counts[key] : 0
  }
  return medias
}

/**
 * Detecta possível fora de função
 * @param {string} grupoAtual - grupo baseado na posição cadastrada
 * @param {Array} rankingPerfis - ranking dos perfis por IAP
 * @returns {string|null} texto do alerta ou null
 */
export function detectarForaDeFuncao(grupoAtual, rankingPerfis) {
  // Lógica: se o IAP do melhor perfil for muito alto (>75)
  // mas o segundo melhor de outro grupo for ainda mais alto, flag
  // Por ora, checa se o nome do perfil dominante sugere outra posição
  const dominante = rankingPerfis[0]?.nome || ''

  const alertasForaDeFuncao = {
    'Extremo': ['Dinâmico', 'Criativo'], // perfis que são comuns em meias
    'Volante': ['Definidor', 'Driblador'], // perfis mais de meia
    'Zagueiro': ['Construtor-Defensivo', 'Construtor-Dinâmico'],
  }

  for (const [, perfisAlerta] of Object.entries(alertasForaDeFuncao)) {
    if (perfisAlerta.includes(dominante)) {
      return `Possível fora de função — Melhor IAP em perfil de ${dominante}`
    }
  }

  return null
}

/**
 * Gera alertas técnicos automáticos para um jogador
 */
function gerarAlertas(jogador, grupo, perfilDominante, iapDominante, confiabilidade, rankingPerfis) {
  const alertas = []

  // Confiabilidade de amostra
  if (confiabilidade.nivel === 1) alertas.push({ tipo: 'aviso', texto: 'Amostra muito baixa — validar em vídeo' })
  else if (confiabilidade.nivel === 2) alertas.push({ tipo: 'info', texto: 'Amostra baixa' })

  // IAP alto
  if (iapDominante >= 80 && confiabilidade.nivel >= 3) {
    alertas.push({ tipo: 'destaque', texto: `Alto IAP no perfil ${perfilDominante}` })
  }

  // Versatilidade: diferença pequena entre 1º e 2º perfil
  if (rankingPerfis.length >= 2) {
    const diff = rankingPerfis[0].iap - rankingPerfis[1].iap
    if (diff <= 5 && rankingPerfis[0].iap >= 65) {
      alertas.push({ tipo: 'info', texto: `Versátil — próximo de ${rankingPerfis[1].nome}` })
    }
  }

  // Baixa minutagem com IAP alto (possível inflação estatística)
  if (iapDominante >= 75 && confiabilidade.nivel <= 2) {
    alertas.push({ tipo: 'aviso', texto: 'IAP possivelmente inflado — amostra curta' })
  }

  return alertas
}

/**
 * Retorna todos os perfis de um grupo ordenados por nome
 */
export function getPerfisDoGrupo(grupo) {
  return Object.keys(IAP_PERFIS[grupo] || {})
}

/**
 * Retorna as métricas de um perfil específico
 */
export function getMetricasDoPerfil(grupo, perfil) {
  return IAP_PERFIS[grupo]?.[perfil] || []
}
