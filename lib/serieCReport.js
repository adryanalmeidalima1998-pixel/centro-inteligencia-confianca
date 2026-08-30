// Motor dos relatórios da Série C: atleta + coletivo + GPS.
// A lógica usa a MESMA base para os dois rankings do atleta:
// Liga e elenco = /90 para métricas de volume e percentual para métricas de eficiência.
// Assim, se o atleta é 1º na Liga, obrigatoriamente também é 1º no elenco.
import {
  toNumber, per90, valueFromMetricAny, findMetricColumn,
  metricGroup, metricDisplayName, formatMetricValue, isIdentityColumn, isNumeric,
} from './serieC'
import { metricCategory, metricSampleRule, metricMeta } from './serieCMetricRegistry'

export function positionGroup(position) {
  const p = String(position || '').toUpperCase().replace(/[^A-Z]/g, '')
  if (/GK/.test(p)) return 'GK'
  if (/(CB|LB|RB|LWB|RWB|WB)/.test(p)) return 'DEF'
  if (/(DM|CM|AM|LM|RM|MF)/.test(p)) return 'MEI'
  if (/(LW|RW|CF|ST|SS|FW)/.test(p)) return 'ATA'
  return 'OUT'
}

function mul(metrics, totalNames, pctNames) {
  const total = valueFromMetricAny(metrics, totalNames)
  const pct = valueFromMetricAny(metrics, pctNames)
  if (total === null || pct === null) return null
  return total * pct
}

function reportFamilyFor(metric, entityType = 'player') {
  const category = metricCategory(metric, entityType)
  if (entityType === 'goalkeeper') {
    if (['Defesa de meta','Perfil das finalizações sofridas','Área e cruzamentos','Bolas paradas e pênaltis'].includes(category)) return 'Defesa'
    if (['Distribuição','Tiros de meta'].includes(category)) return 'Construção'
    if (category === 'Ações, erros e disciplina') return 'Disciplina'
    return 'Geral'
  }
  if (category === 'Ataque e finalização') return 'Ataque'
  if (['Criação e xA','Progressão e recepção','Passes e construção'].includes(category)) return 'Construção'
  if (category === 'Dribles e condução') return 'Ataque'
  if (category === 'Duelos e defesa') return 'Defesa'
  if (category === 'Pressão e recuperações') return 'Pressão'
  if (category === 'Controle, perdas e disciplina') return 'Disciplina'
  return 'Geral'
}

function smartDef(def, entityType = 'player') {
  const sourceMetric = def.aliases?.[0] || def.label
  const sample = def.pct ? metricSampleRule(sourceMetric, entityType) : null
  return {
    ...def,
    family:def.family || reportFamilyFor(sourceMetric, entityType),
    ...(sample || {}),
    ...(def.minAttempts ? { minAttempts:def.minAttempts, sampleAliases:def.sampleAliases, sampleNoun:def.sampleNoun } : {}),
  }
}

const PLAYER_CATALOG = [
  // Produção e finalização
  { key:'gols', label:'Gols', aliases:['Gols'], higher:true, signatureFor:['ATA'] },
  { key:'xg', label:'xG', aliases:['xG (Gols esperados)'], higher:true, signatureFor:['ATA','MEI'] },
  { key:'xgps', label:'xG por chute', aliases:['xGPS (xG por chute)'], higher:true, contextOnly:true },
  { key:'xgpg', label:'xG por gol', aliases:['xGPG (xG por gol)'], higher:false, contextOnly:true },
  { key:'xgc', label:'Conversão de xG', aliases:['xGC (Conversão de xG)'], higher:true, contextOnly:true },
  { key:'chances', label:'Chances de gol', aliases:['Chances de gol'], higher:true, signatureFor:['ATA'] },
  { key:'chancesPct', label:'Chances convertidas %', aliases:['Chances de gol bem-sucedidas, %'], pct:true, higher:true, signatureFor:['ATA'] },
  { key:'chancesCriadas', label:'Chances de gol criadas', aliases:['Chances de gol criadas'], higher:true, signatureFor:['MEI','ATA'] },
  { key:'chutes', label:'Chutes', aliases:['Chutes'], higher:true, signatureFor:['ATA'] },
  { key:'chutesAlvoPct', label:'Chutes no alvo %', aliases:['Chutes no alvo, %'], pct:true, higher:true, signatureFor:['ATA'] },
  { key:'chutesArea', label:'Chutes da área', aliases:['Chutes da área'], higher:true, signatureFor:['ATA'] },
  { key:'chutesAreaPct', label:'Chutes da área no alvo %', aliases:['Chutes no alvo da área, %'], pct:true, higher:true, signatureFor:['ATA'] },
  { key:'chutesFora', label:'Chutes de fora da área', aliases:['Chutes de fora da área'], higher:true },
  { key:'cabec', label:'Cabeceios', aliases:['Cabeceios'], higher:true, signatureFor:['ATA'] },
  { key:'acoesArea', label:'Ações na área adversária', aliases:['Ações na área adversária'], higher:true, signatureFor:['ATA'] },
  { key:'acoesAreaPct', label:'Ações na área bem-sucedidas %', aliases:['Ações na área adversária bem-sucedidas, %'], pct:true, higher:true },
  { key:'participacaoGol', label:'Participação em ataques com gol', aliases:['Participação em ataques com gol'], higher:true },

  // Criação / construção / progressão
  { key:'assist', label:'Assistências', aliases:['Assistências'], higher:true, signatureFor:['MEI','ATA'] },
  { key:'xa', label:'xA', aliases:['xA (assistências esperadas)'], higher:true, signatureFor:['MEI','ATA'] },
  { key:'passesChave', label:'Passes-chave', aliases:['Passes-chave'], higher:true, signatureFor:['MEI','ATA'] },
  { key:'passesChavePct', label:'Passes-chave precisos %', aliases:['Passes-chave precisos, %'], pct:true, higher:true },
  { key:'passesChute', label:'Passes para chute', aliases:['Passes para chute'], higher:true, signatureFor:['MEI','ATA'] },
  { key:'precisaoPasse', label:'Passes precisos %', aliases:['Passes precisos, %'], pct:true, higher:true, signatureFor:['DEF','MEI'] },
  { key:'progressivos', label:'Passes progressivos', aliases:['Passes progressivos'], higher:true, signatureFor:['DEF','MEI'] },
  { key:'progressivosPct', label:'Passes progressivos precisos %', aliases:['Passes progressivos precisos, %'], pct:true, higher:true },
  { key:'progressivosLimpos', label:'Passes progressivos limpos', aliases:['Passes progressivos limpos'], higher:true },
  { key:'passesFrenteTF', label:'Passes à frente no terço final', aliases:['Passes para a frente no terço final'], higher:true },
  { key:'passesArea', label:'Passes para a área', aliases:['Passes para a área'], higher:true, signatureFor:['DEF','MEI'] },
  { key:'passesAreaPct', label:'Passes para a área precisos %', aliases:['Passes para a área precisos, %'], pct:true, higher:true },
  { key:'cruzamentos', label:'Cruzamentos', aliases:['Cruzamentos'], higher:true },
  { key:'cruzamentosPct', label:'Cruzamentos precisos %', aliases:['Cruzamentos precisos, %'], pct:true, higher:true },
  { key:'passesLongos', label:'Passes longos', aliases:['Passes longos'], higher:true },
  { key:'passesLongosPct', label:'Passes longos precisos %', aliases:['Passes longos precisos, %'], pct:true, higher:true },
  { key:'passesMuitoLongos', label:'Passes muito longos', aliases:['Passes muito longos'], higher:true },
  { key:'passesMuitoLongosPct', label:'Passes muito longos precisos %', aliases:['Passes muito longos precisos, %'], pct:true, higher:true },
  { key:'entradasTF', label:'Entradas no terço final', aliases:['Entradas no terço final'], higher:true, signatureFor:['MEI'] },
  { key:'entradasPasse', label:'Entradas no terço final por passe', aliases:['Entradas no terço final por passe'], higher:true },
  { key:'entradasConducao', label:'Entradas no terço final por condução', aliases:['Entradas no terço final por condução'], higher:true },
  { key:'recebidosTF', label:'Passes recebidos no terço final', aliases:['Passes limpos recebidos no terço final'], higher:true },
  { key:'recebidosArea', label:'Passes recebidos na área', aliases:['Passes limpos recebidos na área adversária'], higher:true },

  // 1x1, pressão e defesa
  { key:'dribles', label:'Dribles', aliases:['Dribles'], higher:true, signatureFor:['ATA'] },
  { key:'driblesPct', label:'Dribles bem-sucedidos %', aliases:['Dribles bem-sucedidos, %'], pct:true, higher:true, signatureFor:['ATA'] },
  { key:'driblesTF', label:'Dribles no terço final', aliases:['Dribles no terço final'], higher:true },
  { key:'driblesTFPct', label:'Dribles no terço final bem-sucedidos %', aliases:['Dribles no terço final bem-sucedidos, %'], pct:true, higher:true },
  { key:'conducao', label:'Conduções', aliases:['Condução'], higher:true },
  { key:'recuperacoes', label:'Recuperações da bola', aliases:['Recuperações da bola'], higher:true, signatureFor:['MEI','DEF'] },
  { key:'recSolta', label:'Recuperações de bola solta', aliases:['Recuperações de bola solta'], higher:true },
  { key:'recCampoAdv', label:'Recuperações no campo adversário', aliases:['Recuperações da bola no campo adversário'], higher:true, signatureFor:['MEI','ATA'] },
  { key:'duelosGanhos', label:'Duelos ganhos', aliases:['Duelos ganhos'], higher:true,
    raw:p => valueFromMetricAny(p.metrics,['Duelos ganhos']) ?? mul(p.metrics,['Duelos'],['Duelos ganhos, %']), signatureFor:['DEF','MEI','ATA'] },
  { key:'duelosPct', label:'Duelos ganhos %', aliases:['Duelos ganhos, %'], pct:true, higher:true },
  { key:'duelosDefGanhos', label:'Duelos defensivos ganhos', aliases:['Duelos defensivos ganhos'], higher:true,
    raw:p => valueFromMetricAny(p.metrics,['Duelos defensivos ganhos']) ?? mul(p.metrics,['Duelos defensivos'],['Duelos defensivos ganhos, %']), signatureFor:['DEF','MEI'] },
  { key:'duelosDefPct', label:'Duelos defensivos ganhos %', aliases:['Duelos defensivos ganhos, %'], pct:true, higher:true },
  { key:'duelosOfGanhos', label:'Duelos ofensivos ganhos', aliases:['Duelos ofensivos ganhos'], higher:true,
    raw:p => valueFromMetricAny(p.metrics,['Duelos ofensivos ganhos']) ?? mul(p.metrics,['Duelos ofensivos'],['Duelos ofensivos ganhos, %']), signatureFor:['MEI','ATA'] },
  { key:'duelosOfPct', label:'Duelos ofensivos ganhos %', aliases:['Duelos ofensivos ganhos, %'], pct:true, higher:true },
  { key:'duelosAereosGanhos', label:'Duelos aéreos ganhos', aliases:['Duelos aéreos ganhos'], higher:true,
    raw:p => valueFromMetricAny(p.metrics,['Duelos aéreos ganhos']) ?? mul(p.metrics,['Duelos aéreos'],['Duelos aéreos ganhos, %']), signatureFor:['DEF','ATA'] },
  { key:'duelosAereosPct', label:'Duelos aéreos ganhos %', aliases:['Duelos aéreos ganhos, %'], pct:true, higher:true },
  { key:'desarmes', label:'Desarmes', aliases:['Desarmes'], higher:true, signatureFor:['DEF','MEI'] },
  { key:'desarmesPct', label:'Desarmes bem-sucedidos %', aliases:['Desarmes bem-sucedidos, %'], pct:true, higher:true, signatureFor:['DEF','MEI'] },
  { key:'interceptacoes', label:'Interceptações', aliases:['Interceptações'], higher:true, signatureFor:['DEF','MEI'] },
  { key:'xgd', label:'xG defensivo', aliases:['xGD (xG defensivo)'], higher:true, contextOnly:true },
  { key:'xgdps', label:'xG defensivo por chute', aliases:['xGDPS (xG defensivo por chute)'], higher:true, contextOnly:true },

  // Controle e impacto em campo
  { key:'acoesPct', label:'Ações bem-sucedidas %', aliases:['Ações bem-sucedidas, %'], pct:true, higher:true },
  { key:'perdas', label:'Perdas da bola', aliases:['Perdas da bola'], higher:false, contextOnly:true },
  { key:'perdasProprio', label:'Perdas no próprio campo', aliases:['Perdas da bola no próprio campo'], higher:false, contextOnly:true },
  { key:'errosChance', label:'Erros que geram chances', aliases:['Erros que geram chances de gol'], higher:false, contextOnly:true },
  { key:'errosGol', label:'Erros que resultam em gol', aliases:['Erros que resultam em gol'], higher:false, contextOnly:true },
  { key:'xgt', label:'xG da equipe com atleta em campo', aliases:['xGT (xG enquanto o jogador está em campo)'], higher:true, contextOnly:true },
  { key:'xgopp', label:'xG adversário com atleta em campo', aliases:['xGOPP (xG do adversário enquanto o jogador está em campo)'], higher:false, contextOnly:true },
  { key:'nxg', label:'xG líquido em campo', aliases:['NxG (xG líquido, diferença entre xGT e xGOPP)'], higher:true, signatureFor:['DEF','MEI','ATA'] },
].map(def => smartDef(def, 'player'))

const GK_CATALOG = [
  // Defesa de meta e qualidade do chute enfrentado
  { key:'savePct', label:'Defesas %', aliases:['Chutes defendidos, %'], pct:true, higher:true, signatureFor:['GK'] },
  { key:'saves', label:'Defesas', aliases:['Chutes defendidos'], higher:true, signatureFor:['GK'] },
  { key:'bigSaves', label:'Grandes defesas', aliases:['Grandes defesas'], higher:true, signatureFor:['GK'] },
  { key:'goalsAgainst', label:'Gols sofridos', aliases:['Gols sofridos'], higher:false, contextOnly:true },
  { key:'shotsFaced', label:'Chutes sofridos', aliases:['Chutes sofridos'], higher:true, contextOnly:true },
  { key:'sotFaced', label:'Chutes no alvo sofridos', aliases:['Chutes no alvo sofridos'], higher:true, contextOnly:true },
  { key:'xgFaced', label:'xG enfrentado', aliases:['xG dos chutes do adversário'], higher:true, contextOnly:true },
  { key:'xgPerShot', label:'xG por chute adversário', aliases:['xG por chute do adversário'], higher:true, contextOnly:true },
  { key:'xgPerGoal', label:'xG por gol sofrido', aliases:['xG por gol sofrido'], higher:true, signatureFor:['GK'] },
  { key:'xgPerSave', label:'xG por chute defendido', aliases:['xG por chute defendido'], higher:true, contextOnly:true },
  { key:'oppXgConversion', label:'Conversão de xG adversária', aliases:['Conversão de xG do adversário'], higher:false, contextOnly:true },
  { key:'catchPct', label:'Chutes encaixados %', aliases:['Chutes encaixados, %'], pct:true, higher:true },
  { key:'safeParryPct', label:'Espalmadas seguras %', aliases:['Espalmadas para zona segura, %'], pct:true, higher:true },
  { key:'dangerParryPct', label:'Espalmadas para zona perigosa %', aliases:['Espalmadas para zona perigosa, %'], pct:true, higher:false },
  { key:'shortSavePct', label:'Defesas curta distância %', aliases:['Chutes de curta distância defendidos, %'], pct:true, higher:true },
  { key:'mediumSavePct', label:'Defesas média distância %', aliases:['Chutes de média distância defendidos, %'], pct:true, higher:true },
  { key:'longSavePct', label:'Defesas longa distância %', aliases:['Chutes de longa distância defendidos, %'], pct:true, higher:true },

  // Área, cruzamentos e cobertura
  { key:'sweeper', label:'Intervenções fora da área', aliases:['Intervenções fora da área'], higher:true, signatureFor:['GK'] },
  { key:'sweeperPct', label:'Intervenções fora da área bem-sucedidas %', aliases:['Intervenções fora da área bem-sucedidas, %'], pct:true, higher:true },
  { key:'crossAttempts', label:'Tentativas de interceptação de cruzamentos', aliases:['Tentativas de interceptação de cruzamentos e passes'], higher:true },
  { key:'crossInterceptions', label:'Interceptações de cruzamentos', aliases:['Tentativas de interceptação de cruzamentos e passes bem-sucedidas'], higher:true, signatureFor:['GK'] },
  { key:'crossInterceptionsPct', label:'Interceptações de cruzamentos %', aliases:['Tentativas de interceptação de cruzamentos e passes bem-sucedidas, %'], pct:true, higher:true, signatureFor:['GK'] },

  // Distribuição
  { key:'passPct', label:'Passes precisos %', aliases:['Passes precisos, %'], pct:true, higher:true, signatureFor:['GK'] },
  { key:'livePassPct', label:'Passes em jogo corrido precisos %', aliases:['Passes em jogo corrido precisos, %'], pct:true, higher:true },
  { key:'throwPct', label:'Lançamentos com a mão precisos %', aliases:['Lançamentos com a mão precisos, %'], pct:true, higher:true },
  { key:'setPassPct', label:'Passes de bola parada precisos %', aliases:['Passes de bola parada precisos, %'], pct:true, higher:true },
  { key:'shortPassPct', label:'Passes curtos precisos %', aliases:['Passes curtos precisos, %'], pct:true, higher:true },
  { key:'mediumPassPct', label:'Passes médios precisos %', aliases:['Passes médios precisos, %'], pct:true, higher:true },
  { key:'longPasses', label:'Passes longos', aliases:['Passes longos'], higher:true },
  { key:'longPassPct', label:'Passes longos precisos %', aliases:['Passes longos precisos, %'], pct:true, higher:true, signatureFor:['GK'] },
  { key:'progressiveClean', label:'Passes progressivos limpos', aliases:['Passes progressivos limpos'], higher:true },
  { key:'keyPasses', label:'Passes-chave', aliases:['Passes-chave'], higher:true },

  // Tiros de meta
  { key:'goalKicks', label:'Tiros de meta', aliases:['Tiros de meta'], higher:true, contextOnly:true },
  { key:'goalKickPct', label:'Tiros de meta precisos %', aliases:['Tiros de meta precisos, %'], pct:true, higher:true },
  { key:'goalKickShortPct', label:'Tiros de meta curtos precisos %', aliases:['Tiros de meta curtos (<15 m) precisos, %'], pct:true, higher:true },
  { key:'goalKickMediumPct', label:'Tiros de meta médios precisos %', aliases:['Tiros de meta médios (15-40 m) precisos, %'], pct:true, higher:true },
  { key:'goalKickLongPct', label:'Tiros de meta longos precisos %', aliases:['Tiros de meta longos (40+ m) precisos, %'], pct:true, higher:true },

  // Bolas paradas / pênaltis e segurança
  { key:'setPieceShotPct', label:'Bola parada adversária com chute %', aliases:['Ataques do adversário de bola parada com chute, %'], pct:true, higher:false, contextOnly:true },
  { key:'cornerShotPct', label:'Escanteios adversários com chute %', aliases:['Ataques do adversário de escanteio com chute, %'], pct:true, higher:false, contextOnly:true },
  { key:'freeKickShotPct', label:'Tiros livres adversários com chute %', aliases:['Ataques do adversário de tiro livre com chute, %'], pct:true, higher:false, contextOnly:true },
  { key:'penaltySavePct', label:'Pênaltis defendidos %', aliases:['Pênaltis defendidos, %'], pct:true, higher:true, signatureFor:['GK'] },
  { key:'errorsChance', label:'Erros que geram chances', aliases:['Erros que geram chances de gol'], higher:false, contextOnly:true },
  { key:'errorsGoal', label:'Erros que resultam em gol', aliases:['Erros que resultam em gol'], higher:false, contextOnly:true },
  { key:'actionsPct', label:'Ações bem-sucedidas %', aliases:['Ações bem-sucedidas, %'], pct:true, higher:true },
].map(def => smartDef(def, 'goalkeeper'))

function rawMetric(player, def) {
  if (typeof def.raw === 'function') return toNumber(def.raw(player))
  return valueFromMetricAny(player?.metrics, def.aliases || [def.label])
}

function compareMetric(player, def) {
  const raw = rawMetric(player, def)
  if (raw === null) return null
  return def.pct ? raw : per90(raw, player.minutes)
}

function sampleMetric(player, def) {
  if (!def?.pct) return null
  if (Array.isArray(def.sampleAliases) && def.sampleAliases.length) {
    return valueFromMetricAny(player?.metrics, def.sampleAliases)
  }
  if (Array.isArray(def.sampleFromNumeratorAliases) && def.sampleFromNumeratorAliases.length) {
    const numerator = valueFromMetricAny(player?.metrics, def.sampleFromNumeratorAliases)
    const pct = rawMetric(player, def)
    if (numerator === null || pct === null || Number(pct) <= 0) return null
    // Percentuais vindos do Wyscout chegam normalmente na escala 0..1.
    const rate = Number(pct) > 1 ? Number(pct) / 100 : Number(pct)
    return rate > 0 ? Number(numerator) / rate : null
  }
  return null
}

function metricEligibility(player, def, { minMinutes = 300 } = {}) {
  const minutes = toNumber(player?.minutes) || 0
  const sample = sampleMetric(player, def)
  const minAttempts = Number(def?.minAttempts || 0)
  const contextOnly = Boolean(def?.contextOnly)
  const minutesOk = minutes >= minMinutes
  const sampleOk = !def?.pct || !minAttempts || (sample !== null && sample >= minAttempts)
  return {
    eligible: !contextOnly && minutesOk && sampleOk,
    contextOnly,
    minutesOk,
    sampleOk,
    sample,
    minAttempts,
    sampleNoun:def?.sampleNoun || 'ações',
  }
}

function sampleTextFor(eligibility) {
  if (!eligibility) return null
  if (eligibility.contextOnly) return 'Indicador contextual - sem ranking'
  if (!eligibility.minutesOk) return 'Amostra baixa de minutos - sem ranking'
  if (!eligibility.sampleOk && eligibility.minAttempts) {
    const n = eligibility.sample === null ? '—' : Math.round(eligibility.sample).toLocaleString('pt-BR')
    return `Amostra baixa: ${n} ${eligibility.sampleNoun} (mín. ${eligibility.minAttempts})`
  }
  if (eligibility.sample !== null && eligibility.minAttempts) {
    return `${Math.round(eligibility.sample).toLocaleString('pt-BR')} ${eligibility.sampleNoun}`
  }
  return null
}

function metricFamily(def, isGK = false) {
  if (def?.family) return def.family
  if (isGK) {
    if (/passe/i.test(def.label)) return 'Construção'
    if (/defesa|gol sofrido|grande defesa|intercept/i.test(def.label)) return 'Defesa'
    return 'Geral'
  }
  return metricGroup(def.label)
}

function playerKey(player) {
  return `${String(player?.team || '').trim().toLowerCase()}::${String(player?.player || '').trim().toLowerCase()}`
}

function uniquePlayers(pool = []) {
  const seen = new Set()
  return pool.filter(player => {
    const key = playerKey(player)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function standingFor(player, def, pool, { minMinutes = 300, minPool = 1 } = {}) {
  const v = compareMetric(player, def)
  if (v === null) return null
  const targetEligibility = metricEligibility(player, def, { minMinutes })
  if (!targetEligibility.eligible) return null

  const vals = uniquePlayers(pool || [])
    .filter(p => metricEligibility(p, def, { minMinutes }).eligible)
    .map(p => compareMetric(p, def))
    .filter(x => x !== null)
  if (vals.length < minPool) return null

  const better = vals.filter(x => def.higher ? x > v : x < v).length
  const worse = vals.filter(x => def.higher ? x < v : x > v).length
  const rank = better + 1
  const total = vals.length
  const percentile = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100
  return { rank, total, percentile, worse }
}

function leagueStandingFor(player, def, leaguePool, { minMinutes = 300 } = {}) {
  // Ranking da Liga = todos os jogadores elegíveis da competição, mesma base (/90 ou %).
  return standingFor(player, def, leaguePool, { minMinutes, minPool: 5 })
}

function squadStandingFor(player, def, squad, { minMinutes = 300 } = {}) {
  // Ranking do elenco usa exatamente a mesma métrica do ranking da Liga.
  return standingFor(player, def, squad, { minMinutes, minPool: 1 })
}

export function leaguePercentile(player, def, leaguePool, opts) {
  return leagueStandingFor(player, def, leaguePool, opts)?.percentile ?? null
}

function leadersFromCatalog(players, catalog, { minMinutes = 300 } = {}) {
  const pool = uniquePlayers(players || [])
  const out = {}
  for (const def of catalog) {
    if (def.contextOnly) continue
    const ranked = pool
      .filter(p => metricEligibility(p, def, { minMinutes }).eligible)
      .map(p => ({ player:p.player, position:p.position, value:compareMetric(p, def) }))
      .filter(r => r.value !== null)
      .sort((a,b) => def.higher ? b.value - a.value : a.value - b.value)
    if (ranked.length) out[def.key] = { ...ranked[0], def }
  }
  return out
}

export function squadLeaders(guaraniPlayers, opts = {}) {
  return leadersFromCatalog(guaraniPlayers, PLAYER_CATALOG, opts)
}

export function goalkeeperLeaders(guaraniGoalkeepers, opts = {}) {
  return leadersFromCatalog(guaraniGoalkeepers, GK_CATALOG, opts)
}

function completeCatalogForPlayer(player, baseCatalog, entityType = 'player') {
  const existing = new Set(baseCatalog.flatMap(def => def.aliases || []).map(name => String(name).toLowerCase()))
  const extras = Object.keys(player?.metrics || {})
    .filter(metric => !isIdentityColumn(metric) && isNumeric(player?.metrics?.[metric]) && !existing.has(String(metric).toLowerCase()))
    .map((metric, index) => {
      const meta = metricMeta(metric, entityType)
      return smartDef({
        key:`extra_${entityType}_${index}_${String(metric).replace(/[^a-z0-9]+/gi,'_').slice(0,24)}`,
        label:metricDisplayName(metric), aliases:[metric], higher:meta.higher,
        contextOnly:meta.contextOnly, pct:meta.pct,
      }, entityType)
    })
  return [...baseCatalog, ...extras]
}

function reportFromCatalog(player, { squad, leaguePool, leaders, minMinutes = 300, catalog, isGK = false }) {
  leaders = leaders || leadersFromCatalog(squad, catalog, { minMinutes })
  const group = positionGroup(player.position)
  // leaguePool pode já conter atletas do Confiança; deduplicamos para garantir um ranking único.
  const competitionPool = uniquePlayers([...(leaguePool || []), ...(squad || [])])

  const rows = catalog.map(def => {
    const raw = rawMetric(player, def)
    if (raw === null) return null
    const per90Value = def.pct ? null : per90(raw, player.minutes)
    const eligibility = metricEligibility(player, def, { minMinutes })
    const league = eligibility.eligible ? leagueStandingFor(player, def, competitionPool, { minMinutes }) : null
    const squadStanding = eligibility.eligible ? squadStandingFor(player, def, squad, { minMinutes }) : null
    const pct = league?.percentile ?? null
    const isSquadLeader = eligibility.eligible && (squadStanding?.rank === 1 || leaders[def.key]?.player === player.player)
    const signature = (def.signatureFor || []).includes(group)
    const score = eligibility.eligible ? ((isSquadLeader ? 65 : 0) + (pct ?? 0) + (signature ? 20 : 0)) : -100
    return {
      def, raw, per90Value, pct, league, squadStanding, eligibility,
      isSquadLeader, signature, score, family:metricFamily(def, isGK),
    }
  }).filter(Boolean).sort((a,b) => b.score - a.score)

  const destaques = rows
    .filter(r => r.isSquadLeader || (r.pct !== null && r.pct >= 75))
    .slice(0, 5)
    .map(r => ({
      metric:r.def.label,
      value: r.def.pct
        ? formatMetricValue(r.def.label, r.raw)
        : formatMetricValue(r.def.label, r.per90Value, { per90Mode:true }),
      secondary: !r.def.pct ? `Total: ${formatMetricValue(r.def.label, r.raw)}` : sampleTextFor(r.eligibility),
      per90: !r.def.pct,
      leaguePct:r.pct,
      leagueRank:r.league?.rank ?? null,
      leagueTotal:r.league?.total ?? null,
      squadRank:r.squadStanding?.rank ?? null,
      squadTotal:r.squadStanding?.total ?? null,
      squadLeader:r.isSquadLeader,
      leagueBasis:r.def.pct ? 'percentual · Liga' : 'por 90 · Liga',
      squadBasis:r.def.pct ? 'mesmo percentual · elenco' : 'mesma taxa /90 · elenco',
      phrase:r.isSquadLeader
        ? `Líder do elenco em ${r.def.label.toLowerCase()}`
        : `Top ${Math.max(1, 100 - r.pct)}% da Série C em ${r.def.label.toLowerCase()}`,
    }))

  const allFamilies = {}
  for (const r of rows) {
    ;(allFamilies[r.family] = allFamilies[r.family] || []).push({
      metric:r.def.label,
      value:r.def.pct
        ? formatMetricValue(r.def.label, r.raw)
        : `${formatMetricValue(r.def.label, r.raw)} · ${formatMetricValue(r.def.label, r.per90Value, { per90Mode:true })}/90`,
      leaguePct:r.pct,
      leagueRank:r.league?.rank ?? null,
      leagueTotal:r.league?.total ?? null,
      squadRank:r.squadStanding?.rank ?? null,
      squadTotal:r.squadStanding?.total ?? null,
      sampleLow:!r.eligibility?.eligible && !r.eligibility?.contextOnly,
      contextOnly:Boolean(r.eligibility?.contextOnly),
      sampleText:sampleTextFor(r.eligibility),
    })
  }
  // O PDF individual continua sintético e legível. As páginas analíticas da Série C
  // usam a base integral; aqui entram as 6 leituras mais relevantes de cada família.
  const families = Object.fromEntries(Object.entries(allFamilies).map(([family, items]) => [family, items.slice(0, 6)]))

  return { player:player.player, position:player.position, group, destaques, families, allFamilies }
}

export function playerReport(player, opts) {
  return reportFromCatalog(player, { ...opts, catalog:completeCatalogForPlayer(player, PLAYER_CATALOG, 'player'), isGK:false })
}

export function goalkeeperReport(player, opts) {
  return reportFromCatalog(player, { ...opts, catalog:completeCatalogForPlayer(player, GK_CATALOG, 'goalkeeper'), isGK:true })
}

// Coletivo: conjunto enxuto de indicadores que mostram identidade, força e alerta.
const TEAM_METRICS = [
  { col:'Índice', higher:true },
  { col:'Gols', higher:true },
  { col:'Chances de gol', higher:true },
  { col:'Chutes', higher:true },
  { col:'Chutes no alvo, %', higher:true, pct:true },
  { col:'Posse de bola, %', higher:true, pct:true },
  { col:'Passes precisos, %', higher:true, pct:true },
  { col:'Passes progressivos', higher:true },
  { col:'Passes progressivos precisos, %', higher:true, pct:true },
  { col:'Entradas no terço final', higher:true },
  { col:'Passes para a área', higher:true },
  { col:'Passes para a área precisos, %', higher:true, pct:true },
  { col:'Passes-chave precisos, %', higher:true, pct:true },
  { col:'Cruzamentos precisos, %', higher:true, pct:true },
  { col:'Recuperações da bola', higher:true },
  { col:'Recuperações da bola no campo adversário', higher:true },
  { col:'Recuperações da bola após perdas em até 10 segundos', higher:true },
  { col:'Recuperações da bola após perdas em até 10 segundos no campo adversário', higher:true },
  { col:'Interceptações', higher:true },
  { col:'Pressão do time bem-sucedida, %', higher:true, pct:true },
  { col:'Duelos ganhos, %', higher:true, pct:true },
  { col:'Duelos defensivos ganhos, %', higher:true, pct:true },
  { col:'Duelos aéreos ganhos, %', higher:true, pct:true },
  { col:'Dribles bem-sucedidos, %', higher:true, pct:true },
  { col:'Passes longos', higher:true },
  { col:'Passes longos precisos, %', higher:true, pct:true },
  { col:'Passes muito longos', higher:true },
  { col:'Passes muito longos precisos, %', higher:true, pct:true },
  { col:'Tiros de meta longos (40+ m)', higher:true },
  { col:'Tiros de meta longos (40+ m) precisos, %', higher:true, pct:true },
  { col:'Perdas da bola', higher:false },
  { col:'Perdas da bola no próprio campo', higher:false },
  { col:'Faltas', higher:false },
  { col:'Cartões amarelos', higher:false },
  { col:'Cartões vermelhos', higher:false },
]

function teamVal(team, col) {
  const src = team?.metrics || team
  const key = findMetricColumn(src, col)
  return key ? toNumber(src[key]) : null
}

function isRealCompetitionTeam(team) {
  const name = String(team?.team ?? team?.Time ?? '').trim()
  if (!name) return false
  const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  // Proteção para uploads antigos que já salvaram a linha-resumo Wyscout
  // "Média por time, Total" como se fosse a 21ª equipe.
  if (n.includes('MEDIA POR TIME') || n.includes('AVERAGE PER TEAM')) return false
  if (/^(MEDIA|AVERAGE|TOTAL)(\s|,|$)/.test(n)) return false
  return true
}

export function collectiveReport(teams) {
  const competitionTeams = (teams || []).filter(isRealCompetitionTeam)
  const rows = TEAM_METRICS.map(def => {
    const graded = competitionTeams
      .map(t => ({ team:t.team, is_guarani:t.is_guarani, value:teamVal(t, def.col) }))
      .filter(t => t.value !== null)
      .sort((a,b) => def.higher ? b.value - a.value : a.value - b.value)
    const total = graded.length
    const idx = graded.findIndex(t => t.is_guarani)
    if (idx < 0 || !total) return null

    const me = graded[idx]
    const rank = idx + 1
    const percentile = total > 1 ? Math.round(((total-rank)/(total-1))*100) : 100
    const avg = graded.reduce((sum, row) => sum + Number(row.value || 0), 0) / total
    const rawDiffPct = avg !== 0 ? ((Number(me.value) - avg) / Math.abs(avg)) * 100 : 0
    // Sempre em lógica de desempenho: positivo = melhor que a média; negativo = pior.
    // Nas métricas em que menor é melhor (faltas/perdas/cartões), o sinal é invertido.
    const vsAveragePct = def.higher ? rawDiffPct : -rawDiffPct
    const worseThanAverage = vsAveragePct < -0.05
    const topQuartile = rank <= Math.max(3, Math.ceil(total * .25))
    const bottomQuartile = rank > Math.floor(total * .75)

    // Antes, só o quartil inferior entrava como alerta. Isso escondia métricas
    // importantes que já estavam abaixo da média (ex.: pressão bem-sucedida).
    // Agora: crítico = quartil inferior; atenção = qualquer desempenho pior que a média.
    let status = 'medio'
    let alertLevel = null
    if (topQuartile && !worseThanAverage) status = 'forca'
    if (worseThanAverage) {
      status = 'alerta'
      alertLevel = bottomQuartile ? 'critico' : 'atencao'
    }

    return {
      metric:metricDisplayName(def.col), value:formatMetricValue(def.col, me.value),
      rawValue:me.value, rank, total, percentile, status, alertLevel,
      leagueAverage:avg, vsAveragePct,
    }
  }).filter(Boolean)

  const alertas = rows
    .filter(r => r.status === 'alerta')
    .sort((a,b) => {
      const severityA = a.alertLevel === 'critico' ? 0 : 1
      const severityB = b.alertLevel === 'critico' ? 0 : 1
      if (severityA !== severityB) return severityA - severityB
      // Mais distante negativamente da média aparece primeiro.
      if (a.vsAveragePct !== b.vsAveragePct) return a.vsAveragePct - b.vsAveragePct
      return b.rank - a.rank
    })

  return {
    forcas:rows.filter(r => r.status === 'forca').sort((a,b) => a.rank-b.rank),
    alertas,
    todos:rows,
  }
}

const GPS_METRICS = [
  { key:'dist_min', label:'Intensidade (m/min)', field:'dist_min' },
  { key:'distancia_total', label:'Distância / jogo (m)', field:'distancia_total' },
  { key:'hsr_m', label:'Alta velocidade >20 km/h (m)', field:'hsr_m' },
  { key:'sprint_m', label:'Sprint >25 km/h (m)', field:'sprint_m' },
  { key:'n_sprints', label:'Nº de sprints', field:'n_sprints' },
  { key:'aceleracoes', label:'Acelerações >3 m/s²', field:'aceleracoes' },
  { key:'desaceleracoes', label:'Desacelerações <-3 m/s²', field:'desaceleracoes' },
  { key:'vel_max', label:'Velocidade máxima (km/h)', field:'vel_max' },
]

const GPS_GK_METRICS = [
  { key:'distancia_total', label:'Distância / jogo (m)', field:'distancia_total' },
  { key:'aceleracoes', label:'Acelerações', field:'aceleracoes' },
  { key:'desaceleracoes', label:'Desacelerações', field:'desaceleracoes' },
  { key:'total_dive_count', label:'Mergulhos / jogo', field:'total_dive_count' },
  { key:'total_dive_load', label:'Carga de mergulho / jogo', field:'total_dive_load' },
  { key:'jump_high', label:'Saltos alta intensidade / jogo', field:'jump_high' },
  { key:'jump_med', label:'Saltos média intensidade / jogo', field:'jump_med' },
]

export function physicalReport(aggRows) {
  const rows = (aggRows || []).filter(r => (toNumber(r.jogos) || 0) >= 1)
  const leaders = {}
  for (const g of GPS_METRICS) {
    const ranked = rows.filter(r => !r.is_gk)
      .map(r => ({ nome:r.nome, value:toNumber(r[g.field]) }))
      .filter(r => r.value !== null)
      .sort((a,b) => b.value-a.value)
    if (ranked.length) leaders[g.key] = { label:g.label, ...ranked[0] }
  }

  function metricsFor(row) { return row?.is_gk ? GPS_GK_METRICS : GPS_METRICS }
  function playerStanding(nome, field) {
    const row = rows.find(r => r.nome === nome)
    if (!row) return null
    const vals = rows
      .filter(r => Boolean(r.is_gk) === Boolean(row.is_gk))
      .map(r => toNumber(r[field]))
      .filter(v => v !== null)
    const v = toNumber(row[field])
    if (v === null || vals.length < 3) return null
    const rank = vals.filter(x => x > v).length + 1
    const total = vals.length
    const percentile = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100
    return { rank, total, percentile }
  }
  function playerPct(nome, field) {
    return playerStanding(nome, field)?.percentile ?? null
  }
  return {
    rows, leaders, metrics:GPS_METRICS, goalkeeperMetrics:GPS_GK_METRICS,
    metricsFor, playerPct, playerStanding,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO DO ELENCO — TOP 3 POR MÉTRICA
// Não usa Índice. A base é a mesma do card individual:
//   • gols e assistências = TOTAL no campeonato
//   • demais métricas de volume = taxa /90
//   • eficiência = percentual
// GPS = média por jogo.
// ─────────────────────────────────────────────────────────────────────────────
function catalogTop3(players, catalog, { minMinutes = 300, isGK = false } = {}) {
  const allPlayers = uniquePlayers(players || [])
  const totalRankingKeys = new Set(['gols', 'assist'])

  return catalog.map(def => {
    // Gols e assistências representam produção acumulada no campeonato.
    // Por isso entram TODOS os atletas com minutos, sem corte de amostra.
    // As demais métricas seguem a amostra mínima e a base comparável (/90 ou %).
    const useTotal = !isGK && totalRankingKeys.has(def.key)
    if (def.contextOnly) return null
    const pool = allPlayers.filter(p => {
      const minutes = toNumber(p.minutes) || 0
      if (useTotal) return minutes > 0
      return metricEligibility(p, def, { minMinutes }).eligible
    })

    const ranked = pool.map(p => {
      const raw = rawMetric(p, def)
      const compare = useTotal ? raw : compareMetric(p, def)
      const eligibility = metricEligibility(p, def, { minMinutes })
      return raw === null || compare === null ? null : {
        player:p.player,
        position:p.position,
        minutes:toNumber(p.minutes) || 0,
        raw,
        compare,
        sample:eligibility.sample,
      }
    }).filter(Boolean).sort((a,b) => def.higher ? b.compare-a.compare : a.compare-b.compare)

    if (!ranked.length) return null
    return {
      key:def.key,
      metric:def.label,
      family:metricFamily(def, isGK),
      basis:useTotal ? 'total no campeonato' : (def.pct ? '% com amostra mínima' : '/90'),
      higher:def.higher,
      minMinutes:useTotal ? 0 : minMinutes,
      minAttempts:def.minAttempts || 0,
      sampleNoun:def.sampleNoun || 'ações',
      top:ranked.slice(0,3).map((row,index) => ({
        ...row,
        rank:index+1,
        value:useTotal
          ? formatMetricValue(def.label, row.raw)
          : def.pct
            ? formatMetricValue(def.label, row.raw)
            : `${formatMetricValue(def.label, row.compare, { per90Mode:true })}/90`,
        secondary:useTotal
          ? `${Math.round(row.minutes)} min`
          : def.pct
            ? `${row.sample !== null && row.sample !== undefined ? `${Math.round(row.sample).toLocaleString('pt-BR')} ${def.sampleNoun || 'ações'} · ` : ''}${Math.round(row.minutes)} min`
            : `Total ${formatMetricValue(def.label, row.raw)} · ${Math.round(row.minutes)} min`,
      })),
    }
  }).filter(Boolean)
}

function gpsTop3(physical, metrics, { goalkeeper = false } = {}) {
  const rows = (physical?.rows || []).filter(r => Boolean(r.is_gk) === goalkeeper)
  return metrics.map(def => {
    const ranked = rows.map(r => ({
      player:r.nome,
      position:goalkeeper ? 'GK' : null,
      games:toNumber(r.jogos) || 0,
      compare:toNumber(r[def.field]),
    })).filter(r => r.compare !== null && r.games >= 1).sort((a,b) => b.compare-a.compare)
    if (!ranked.length) return null
    return {
      key:`gps_${def.key}`,
      metric:def.label,
      family:'Físico',
      basis:'média por jogo',
      higher:true,
      top:ranked.slice(0,3).map((row,index) => ({
        ...row,
        rank:index+1,
        value:def.key === 'vel_max'
          ? `${Number(row.compare).toFixed(1).replace('.', ',')}`
          : Math.round(Number(row.compare)).toLocaleString('pt-BR'),
        secondary:`${Math.round(row.games)} jogo(s) GPS`,
      })),
    }
  }).filter(Boolean)
}

const SQUAD_TOP3_PLAYER_KEYS = new Set([
  'gols','xg','chancesCriadas','chutes',
  'assist','xa','passesChave','progressivos','passesArea','entradasTF',
  'recuperacoes','recSolta','recCampoAdv',
  'duelosGanhos','duelosDefGanhos','duelosAereosGanhos','desarmes','interceptacoes',
  'acoesPct','nxg',
])

const SQUAD_TOP3_GK_KEYS = new Set([
  'savePct','bigSaves','xgPerGoal','shortSavePct','mediumSavePct','longSavePct',
  'sweeperPct','crossInterceptionsPct','passPct','longPassPct','goalKickPct','penaltySavePct',
])

export function squadTop3Report(linePlayers = [], goalkeeperPlayers = [], physical = null, opts = {}) {
  const minMinutes = Number(opts.minMinutes ?? 300)
  const minGoalkeeperMinutes = Number(opts.minGoalkeeperMinutes ?? 180)
  return {
    line:catalogTop3(linePlayers, PLAYER_CATALOG.filter(def => SQUAD_TOP3_PLAYER_KEYS.has(def.key)), { minMinutes, isGK:false }),
    goalkeepers:catalogTop3(goalkeeperPlayers, GK_CATALOG.filter(def => SQUAD_TOP3_GK_KEYS.has(def.key)), { minMinutes:minGoalkeeperMinutes, isGK:true }),
    physical:gpsTop3(physical, GPS_METRICS, { goalkeeper:false }),
    goalkeeperPhysical:gpsTop3(physical, GPS_GK_METRICS, { goalkeeper:true }),
    meta:{ minMinutes, minGoalkeeperMinutes },
  }
}
