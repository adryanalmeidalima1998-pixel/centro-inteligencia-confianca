/**
 * Catálogo nativo do export Wyscout "Search results".
 * Mantém as métricas no significado original do fornecedor e apenas usa
 * chaves compartilhadas com o Sportsbase quando a definição é equivalente.
 */
import { getFootCoverage, normalizePlayerFoot } from '@/data/player-foot'
import { SPORTSBASE_POSITION_GROUPS } from '@/data/sportsbase-map'

const round = (value, decimals = 4) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const factor = 10 ** decimals
  return Math.round(number * factor) / factor
}

export function normalizeWyscoutHeader(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[´’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const columns = [
  ['nome','text',['Jogador']],
  ['equipa','text',['Equipa','Equipe']],
  ['equipa_periodo','text',['Equipa dentro de um período de tempo seleccionado','Equipe dentro de um período de tempo selecionado']],
  ['posicao','position',['Posição','Posicao']],
  ['idade','number',['Idade']],
  ['valor_mercado','number',['Valor de mercado']],
  ['fim_contrato','date',['Contrato termina']],
  ['jogos','number',['Partidas jogadas','Jogos disputados']],
  ['minutos','number',['Minutos jogados:','Minutos jogados']],
  ['gols','number',['Golos','Gols']],
  ['xg','number',['Golos esperados','Gols esperados']],
  ['assistencias','number',['Assistências','Assistencias']],
  ['xa','number',['Assistências esperadas','Assistencias esperadas']],
  ['duelos_90','number',['Duelos/90']],
  ['duelos_pct','percent',['Duelos ganhos, %']],
  ['naturalidade','text',['Naturalidade']],
  ['pais','text',['País de nacionalidade','Pais de nacionalidade']],
  ['pe','foot',['Pé','Pé preferido','Pé dominante','Pe','Preferred foot']],
  ['altura','number',['Altura']],
  ['peso','number',['Peso']],
  ['emprestado','text',['Emprestado']],
  ['acoes_def_sucesso_90','number',['Ações defensivas com êxito/90','Acções defensivas com êxito/90']],
  ['duelos_def_90','number',['Duelos defensivos/90']],
  ['duelos_def_pct','percent',['Duelos defensivos ganhos, %']],
  ['duelos_aereos_90','number',['Duelos aérios/90','Duelos aéreos/90']],
  ['duelos_aereos_pct','percent',['Duelos aéreos ganhos, %','Duelos aérios ganhos, %']],
  ['cortes_90','number',['Cortes/90']],
  ['cortes_padj','number',['Cortes de carrinho ajust. à posse','Cortes de carrinho ajustados à posse']],
  ['remates_intercetados_90','number',['Remates intercetados/90','Remates interceptados/90']],
  ['intercecoes_90','number',['Interseções/90','Interceções/90','Intercepções/90','Interceptações/90']],
  ['intercecoes_padj','number',['Interceções ajust. à posse','Intercepções ajust. à posse','Interceptações ajust. à posse']],
  ['faltas_90','number',['Faltas/90']],
  ['amarelos','number',['Cartões amarelos']],
  ['amarelos_90','number',['Cartões amarelos/90']],
  ['vermelhos','number',['Cartões vermelhos']],
  ['vermelhos_90','number',['Cartões vermelhos/90']],
  ['acoes_atacantes_sucesso_90','number',['Acções atacantes com sucesso/90','Ações atacantes com sucesso/90']],
  ['gols_90','number',['Golos/90','Gols/90']],
  ['gols_sem_penalti','number',['Golos sem ser por penálti','Gols sem ser por pênalti']],
  ['gols_sem_penalti_90','number',['Golos sem ser por penálti/90','Gols sem ser por pênalti/90']],
  ['xg_90','number',['Golos esperados/90','Gols esperados/90']],
  ['gols_cabeca','number',['Golos de cabeça','Gols de cabeça']],
  ['gols_cabeca_90','number',['Golos de cabeça/90','Gols de cabeça/90']],
  ['remates','number',['Remate','Remates']],
  ['remates_90','number',['Remates/90']],
  ['remates_golo_pct','percent',['Remates à baliza, %','Remates ao gol, %']],
  ['conversao_gols_pct','percent',['Golos marcados, %','Gols marcados, %']],
  ['assistencias_90','number',['Assistências/90','Assistencias/90']],
  ['cruzamentos_90','number',['Cruzamentos/90']],
  ['cruzamentos_pct','percent',['Cruzamentos certos, %']],
  ['cruzamentos_esq_90','number',['Cruzamentos do flanco esquerdo/90']],
  ['cruzamentos_esq_pct','percent',['Cruzamentos precisos do flanco esquerdo, %']],
  ['cruzamentos_dir_90','number',['Cruzamentos do flanco direito/90']],
  ['cruzamentos_dir_pct','percent',['Cruzamentos precisos do flanco direito, %']],
  ['cruzamentos_area_gol_90','number',['Cruzamentos para a área de baliza/90','Cruzamentos para a área de gol/90']],
  ['dribles_90','number',['Dribles/90']],
  ['dribles_pct','percent',['Dribles com sucesso, %']],
  ['duelos_of_90','number',['Duelos ofensivos/90']],
  ['duelos_of_pct','percent',['Duelos ofensivos ganhos, %']],
  ['toques_area_90','number',['Toques na área/90']],
  ['corridas_progressivas_90','number',['Corridas progressivas/90']],
  ['aceleracoes_90','number',['Acelerações/90','Aceleracoes/90']],
  ['passes_recebidos_90','number',['Passes recebidos/90']],
  ['passes_longos_recebidos_90','number',['Passes longos recebidos/90']],
  ['faltas_sofridas_90','number',['Faltas sofridas/90']],
  ['passes_90','number',['Passes/90']],
  ['passes_pct','percent',['Passes certos, %']],
  ['passes_frente_90','number',['Passes para a frente/90']],
  ['passes_frente_pct','percent',['Passes para a frente certos, %']],
  ['passes_tras_90','number',['Passes para trás/90']],
  ['passes_tras_pct','percent',['Passes para trás certos, %']],
  ['passes_laterais_90','number',['Passes laterais/90']],
  ['passes_laterais_pct','percent',['Passes laterais certos, %']],
  ['passes_curtos_90','number',['Passes curtos / médios /90','Passes curtos/médios/90']],
  ['passes_curtos_pct','percent',['Passes curtos / médios precisos, %','Passes curtos/médios precisos, %']],
  ['passes_longos_90','number',['Passes longos/90']],
  ['passes_longos_pct','percent',['Passes longos certos, %']],
  ['comprimento_passe_m','number',['Comprimento médio de passes, m']],
  ['comprimento_passe_longo_m','number',['Comprimento médio de passes longos, m']],
  ['xa_90','number',['Assistências esperadas/90','Assistencias esperadas/90']],
  ['assist_remate_90','number',['Assistências para remate/90','Assistencias para remate/90']],
  ['segundas_assistencias_90','number',['Segundas assistências/90','Segundas assistencias/90']],
  ['terceiras_assistencias_90','number',['Terceiras assistências/90','Terceiras assistencias/90']],
  ['passes_inteligentes_90','number',['Passes inteligentes/90']],
  ['passes_inteligentes_pct','percent',['Passes inteligentes certos, %']],
  ['passes_chave_90','number',['Passes chave/90','Passes-chave/90']],
  ['passes_tercofinal_90','number',['Passes para terço final/90']],
  ['passes_tercofinal_pct','percent',['Passes certos para terço final, %']],
  ['passes_area_90','number',['Passes para a área de penálti/90','Passes para a área de pênalti/90']],
  ['passes_area_pct','percent',['Passes precisos para a área de penálti, %','Passes precisos para a área de pênalti, %']],
  ['passes_profundidade_90','number',['Passes em profundidade/90']],
  ['passes_profundidade_pct','percent',['Passes em profundidade certos, %']],
  ['rececoes_profundidade_90','number',['Receção de passes em profundidade/90','Recepção de passes em profundidade/90']],
  ['cruzamentos_profundidade_recebidos_90','number',['Cruzamentos em profundidade recebidos/90']],
  ['passes_prog_90','number',['Passes progressivos/90']],
  ['passes_prog_pct','percent',['Passes progressivos certos, %']],
  ['gols_sofridos','number',['Golos sofridos','Gols sofridos']],
  ['gols_sofridos_90','number',['Golos sofridos/90','Gols sofridos/90']],
  ['remates_sofridos','number',['Remates sofridos']],
  ['remates_sofridos_90','number',['Remates sofridos/90']],
  ['clean_sheets','number',['Jogos sem sofrer golos','Jogos sem sofrer gols']],
  ['defesas_pct','percent',['Defesas, %']],
  ['xga','number',['Golos sofridos esperados ','Golos sofridos esperados','Gols sofridos esperados']],
  ['xga_90','number',['Golos sofridos esperados/90','Gols sofridos esperados/90']],
  ['gols_prevenidos','number',['Golos expectáveis defendidos','Gols esperados defendidos']],
  ['gols_prevenidos_90','number',['Golos expectáveis defendidos por 90´','Golos expectáveis defendidos por 90','Gols esperados defendidos/90']],
  ['passes_tras_recebidos_gk_90','number',['Passes para trás recebidos pelo guarda-redes/90','Passes para trás recebidos pelo goleiro/90']],
  ['saidas_90','number',['Saídas/90','Saidas/90']],
  ['duelos_aereos_gk_90','number',['Duelos aérios/90_1','Duelos aéreos/90_1']],
  ['livres_90','number',['Livres/90']],
  ['livres_diretos_90','number',['Livres directos/90','Livres diretos/90']],
  ['livres_diretos_alvo_pct','percent',['Pontapés livres directos à baliza, %','Pontapés livres diretos à baliza, %']],
  ['cantos_90','number',['Cantos/90']],
  ['penaltis_marcados','number',['Penaltis marcados','Pênaltis marcados']],
  ['penaltis_conversao_pct','percent',['Conversão de penaltis, %','Conversão de pênaltis, %']],
]

export const WYSCOUT_COLUMN_DEFINITIONS = columns.map(([key,type,aliases]) => ({ key,type,aliases }))
export const WYSCOUT_COL_MAP = Object.fromEntries(columns.flatMap(([key,,aliases]) => aliases.map(alias => [alias,key])))
const HEADER_INDEX = new Map(columns.flatMap(([key,type,aliases]) => aliases.map(alias => [normalizeWyscoutHeader(alias), { key,type }])))

export function resolveWyscoutHeader(header) {
  const normalized = normalizeWyscoutHeader(header)
  if (normalized === normalizeWyscoutHeader('Duelos aérios/90_1')) return { key:'duelos_aereos_gk_90', type:'number' }
  return HEADER_INDEX.get(normalized) || null
}

export function getRecognizedWyscoutHeaders(headers = []) {
  return headers.filter(header => Boolean(resolveWyscoutHeader(header)))
}

export const WYSCOUT_REQUIRED_FIELDS = [
  { label:'Jogador', keys:['nome'] },
  { label:'Equipe', keys:['equipa'] },
  { label:'Posição', keys:['posicao'] },
  { label:'Minutos jogados', keys:['minutos'] },
  { label:'Partidas jogadas', keys:['jogos'] },
]

export function parseWyscoutNumber(value) {
  if (value === null || value === undefined || value === '' || value === '-') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  let text = String(value).trim().replace(/\s/g, '')
  if (!text || text === '-') return null
  text = text.replace('%','')
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g,'').replace(',','.')
      : text.replace(/,/g,'')
  } else if (text.includes(',')) text = text.replace(',','.')
  const parsed = Number(text.replace(/[^0-9.+-]/g,''))
  return Number.isFinite(parsed) ? parsed : null
}

function parsePercent(value) {
  const number = parseWyscoutNumber(value)
  if (!Number.isFinite(number)) return null
  return round(Math.abs(number) > 0 && Math.abs(number) <= 1 ? number * 100 : number, 3)
}

function dateValue(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10)
  if (typeof value === 'number' && value > 20000) return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0,10)
  const text = String(value).trim()
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0,10)
}

export function normalizeWyscoutPosition(value) {
  return String(value || '').split(',').map(item=>item.trim().toUpperCase()).filter(Boolean).join(', ')
}

export const WYSCOUT_POSITION_GROUPS = SPORTSBASE_POSITION_GROUPS
export const WYSCOUT_GROUP_LABELS = Object.fromEntries(Object.entries(WYSCOUT_POSITION_GROUPS).map(([key,value])=>[key,value.label]))

export function getWyscoutPrimaryPosition(value) {
  return normalizeWyscoutPosition(value).split(',')[0]?.trim() || ''
}

export function getWyscoutPositionGroup(value) {
  const positions = normalizeWyscoutPosition(value).split(',').map(item=>item.trim()).filter(Boolean)
  for (const position of positions) {
    const match = Object.entries(WYSCOUT_POSITION_GROUPS).find(([,group])=>group.positions.includes(position))
    if (match) return match[0]
  }
  return null
}

function setDerivedAttempt(player, outputKey, per90Key) {
  const rate = Number(player?.[per90Key])
  const minutes = Number(player?.minutos)
  if (Number.isFinite(rate) && minutes > 0) player[outputKey] = round(rate * minutes / 90, 1)
}

const ATTEMPT_DERIVATIONS = {
  duelos:'duelos_90', duelos_def:'duelos_def_90', duelos_aereos:'duelos_aereos_90',
  cruzamentos:'cruzamentos_90', dribles:'dribles_90', duelos_of:'duelos_of_90',
  passes:'passes_90', passes_frente:'passes_frente_90', passes_tras:'passes_tras_90',
  passes_laterais:'passes_laterais_90', passes_curtos:'passes_curtos_90', passes_longos:'passes_longos_90',
  passes_inteligentes:'passes_inteligentes_90', passes_tercofinal:'passes_tercofinal_90',
  passes_area:'passes_area_90', passes_profundidade:'passes_profundidade_90', passes_prog:'passes_prog_90',
}

export function parseWyscoutRow(row = {}) {
  const player = { _fonte:'wyscout', _modelo:'wyscout-search-results-full-v2' }
  const duplicateCounter = new Map()
  for (const [header,value] of Object.entries(row || {})) {
    if (value === null || value === undefined || value === '') continue
    const normalized = normalizeWyscoutHeader(header)
    const seen = duplicateCounter.get(normalized) || 0
    duplicateCounter.set(normalized, seen + 1)
    let definition = resolveWyscoutHeader(header)
    if (normalized === normalizeWyscoutHeader('Duelos aérios/90') && seen > 0) definition = { key:'duelos_aereos_gk_90', type:'number' }
    if (!definition) continue
    const { key,type } = definition
    if (type === 'text') player[key] = String(value).trim()
    else if (type === 'position') player[key] = normalizeWyscoutPosition(value)
    else if (type === 'foot') {
      player.pe_original = String(value).trim()
      player.pe = normalizePlayerFoot(value)
      player.pe_fonte = player.pe !== 'unknown' ? 'wyscout' : null
    } else if (type === 'date') player[key] = dateValue(value)
    else if (type === 'percent') player[key] = parsePercent(value)
    else player[key] = parseWyscoutNumber(value)
  }

  player.pe = normalizePlayerFoot(player.pe)
  player.pe_fonte = player.pe !== 'unknown' ? (player.pe_fonte || 'wyscout') : null
  player.gols = Number(player.gols) || 0
  player.xg = Number(player.xg) || 0
  player.assistencias = Number(player.assistencias) || 0
  player.xa = Number(player.xa) || 0
  player.jogos = Number(player.jogos) || 0
  player.minutos = Number(player.minutos) || 0
  player.grupo_posicional = getWyscoutPositionGroup(player.posicao)
  player.minutos_por_jogo = player.jogos > 0 ? round(player.minutos / player.jogos, 1) : null
  player.diferenca_gols_xg = round(player.gols - player.xg, 2)
  player.clean_sheets_pct = player.jogos > 0 ? round((Number(player.clean_sheets || 0) * 100) / player.jogos, 1) : null
  if (!Number.isFinite(Number(player.gols_90)) && player.minutos > 0) player.gols_90 = round(player.gols * 90 / player.minutos)
  if (!Number.isFinite(Number(player.xg_90)) && player.minutos > 0) player.xg_90 = round(player.xg * 90 / player.minutos)
  if (!Number.isFinite(Number(player.assistencias_90)) && player.minutos > 0) player.assistencias_90 = round(player.assistencias * 90 / player.minutos)
  if (!Number.isFinite(Number(player.xa_90)) && player.minutos > 0) player.xa_90 = round(player.xa * 90 / player.minutos)
  for (const [outputKey,per90Key] of Object.entries(ATTEMPT_DERIVATIONS)) setDerivedAttempt(player,outputKey,per90Key)
  return player
}

export function parseWyscoutExcel(rows = []) {
  return rows.map(parseWyscoutRow).filter(player=>player.nome && player.equipa && player.minutos > 0)
}

function metric(key,label,type,options={}) {
  return {
    key,label,type,
    higherIsBetter:options.higherIsBetter !== false,
    decimals:options.decimals ?? (type === 'total' ? 0 : ['percent','distribution'].includes(type) ? 1 : 2),
    denominatorKey:options.denominatorKey || null,
    denominatorLabel:options.denominatorLabel || null,
    minAttempts:options.minAttempts || 0,
    pairedMetricKey:options.pairedMetricKey || null,
    pairedMetricLabel:options.pairedMetricLabel || null,
    description:options.description || '',
    derived:Boolean(options.derived),
  }
}

export const WYSCOUT_METRIC_GROUPS = {
  producao:{ label:'⚽ Produção ofensiva',cor:'#16a34a',defaultContext:'ST',metricas:[
    metric('gols','Gols','total'), metric('gols_90','Gols/90','per90'), metric('gols_sem_penalti_90','Gols sem pênalti/90','per90'),
    metric('xg','xG','total',{decimals:2}), metric('xg_90','xG/90','per90'), metric('assistencias','Assistências','total'),
    metric('assistencias_90','Assistências/90','per90'), metric('xa','xA','total',{decimals:2}), metric('xa_90','xA/90','per90'),
    metric('acoes_atacantes_sucesso_90','Ações atacantes com sucesso/90','per90'), metric('diferenca_gols_xg','Gols − xG','index'),
  ]},
  finalizacao:{ label:'🎯 Finalização',cor:'#0369a1',defaultContext:'ST',metricas:[
    metric('remates_90','Chutes/90','per90',{pairedMetricKey:'remates_golo_pct'}),
    metric('remates_golo_pct','Chutes no alvo','percent',{denominatorKey:'remates',denominatorLabel:'chutes',minAttempts:10,pairedMetricKey:'remates_90'}),
    metric('conversao_gols_pct','Conversão de gols','percent',{denominatorKey:'remates',denominatorLabel:'chutes',minAttempts:10,pairedMetricKey:'remates_90'}),
    metric('gols_sem_penalti_90','Gols sem pênalti/90','per90'), metric('gols_cabeca_90','Gols de cabeça/90','per90'),
    metric('toques_area_90','Toques na área/90','per90'), metric('xg_90','xG/90','per90'),
  ]},
  criacao:{ label:'🔑 Criação e progressão',cor:'#7c3aed',defaultContext:'AM',metricas:[
    metric('assist_remate_90','Passes para finalização/90','per90'), metric('passes_chave_90','Passes-chave/90','per90'),
    metric('xa_90','xA/90','per90'), metric('passes_inteligentes_90','Passes inteligentes/90','per90',{pairedMetricKey:'passes_inteligentes_pct'}),
    metric('passes_inteligentes_pct','Precisão dos passes inteligentes','percent',{denominatorKey:'passes_inteligentes',denominatorLabel:'passes inteligentes',minAttempts:8,pairedMetricKey:'passes_inteligentes_90'}),
    metric('passes_prog_90','Passes progressivos/90','per90',{pairedMetricKey:'passes_prog_pct'}),
    metric('passes_prog_pct','Precisão dos passes progressivos','percent',{denominatorKey:'passes_prog',denominatorLabel:'passes progressivos',minAttempts:25,pairedMetricKey:'passes_prog_90'}),
    metric('passes_tercofinal_90','Passes para o terço final/90','per90',{pairedMetricKey:'passes_tercofinal_pct'}),
    metric('passes_tercofinal_pct','Precisão no terço final','percent',{denominatorKey:'passes_tercofinal',denominatorLabel:'passes para o terço final',minAttempts:20,pairedMetricKey:'passes_tercofinal_90'}),
    metric('passes_area_90','Passes para a área/90','per90',{pairedMetricKey:'passes_area_pct'}),
    metric('passes_area_pct','Precisão dos passes para a área','percent',{denominatorKey:'passes_area',denominatorLabel:'passes para a área',minAttempts:12,pairedMetricKey:'passes_area_90'}),
    metric('passes_profundidade_90','Passes em profundidade/90','per90',{pairedMetricKey:'passes_profundidade_pct'}),
    metric('passes_profundidade_pct','Precisão dos passes em profundidade','percent',{denominatorKey:'passes_profundidade',denominatorLabel:'passes em profundidade',minAttempts:6,pairedMetricKey:'passes_profundidade_90'}),
    metric('segundas_assistencias_90','Segundas assistências/90','per90'), metric('terceiras_assistencias_90','Terceiras assistências/90','per90'),
  ]},
  distribuicao:{ label:'📮 Distribuição',cor:'#0891b2',defaultContext:'DM',metricas:[
    metric('passes_90','Passes/90','per90',{pairedMetricKey:'passes_pct'}),
    metric('passes_pct','Precisão de passe','percent',{denominatorKey:'passes',denominatorLabel:'passes',minAttempts:100,pairedMetricKey:'passes_90'}),
    metric('passes_frente_90','Passes para frente/90','per90',{pairedMetricKey:'passes_frente_pct'}),
    metric('passes_frente_pct','Precisão dos passes para frente','percent',{denominatorKey:'passes_frente',denominatorLabel:'passes para frente',minAttempts:50,pairedMetricKey:'passes_frente_90'}),
    metric('passes_curtos_90','Passes curtos/médios/90','per90',{pairedMetricKey:'passes_curtos_pct'}),
    metric('passes_curtos_pct','Precisão curta/média','percent',{denominatorKey:'passes_curtos',denominatorLabel:'passes curtos/médios',minAttempts:60,pairedMetricKey:'passes_curtos_90'}),
    metric('passes_longos_90','Passes longos/90','per90',{pairedMetricKey:'passes_longos_pct'}),
    metric('passes_longos_pct','Precisão dos passes longos','percent',{denominatorKey:'passes_longos',denominatorLabel:'passes longos',minAttempts:20,pairedMetricKey:'passes_longos_90'}),
    metric('passes_recebidos_90','Passes recebidos/90','per90'), metric('passes_longos_recebidos_90','Passes longos recebidos/90','per90'),
    metric('comprimento_passe_m','Comprimento médio do passe','index'), metric('comprimento_passe_longo_m','Comprimento médio do passe longo','index'),
  ]},
  umcontraum:{ label:'⚡ 1×1 e condução',cor:'#d97706',defaultContext:'WG',metricas:[
    metric('dribles_90','Dribles/90','per90',{pairedMetricKey:'dribles_pct'}),
    metric('dribles_pct','Dribles bem-sucedidos','percent',{denominatorKey:'dribles',denominatorLabel:'dribles',minAttempts:15,pairedMetricKey:'dribles_90'}),
    metric('duelos_of_90','Duelos ofensivos/90','per90',{pairedMetricKey:'duelos_of_pct'}),
    metric('duelos_of_pct','Duelos ofensivos ganhos','percent',{denominatorKey:'duelos_of',denominatorLabel:'duelos ofensivos',minAttempts:20,pairedMetricKey:'duelos_of_90'}),
    metric('corridas_progressivas_90','Corridas progressivas/90','per90'), metric('aceleracoes_90','Acelerações/90','per90'),
    metric('faltas_sofridas_90','Faltas sofridas/90','per90'), metric('toques_area_90','Toques na área/90','per90'),
  ]},
  defesa:{ label:'🛡️ Defesa e recuperação',cor:'#1e40af',defaultContext:'CB',metricas:[
    metric('acoes_def_sucesso_90','Ações defensivas com sucesso/90','per90'),
    metric('duelos_def_90','Duelos defensivos/90','per90',{pairedMetricKey:'duelos_def_pct'}),
    metric('duelos_def_pct','Duelos defensivos ganhos','percent',{denominatorKey:'duelos_def',denominatorLabel:'duelos defensivos',minAttempts:20,pairedMetricKey:'duelos_def_90'}),
    metric('duelos_aereos_90','Duelos aéreos/90','per90',{pairedMetricKey:'duelos_aereos_pct'}),
    metric('duelos_aereos_pct','Duelos aéreos ganhos','percent',{denominatorKey:'duelos_aereos',denominatorLabel:'duelos aéreos',minAttempts:20,pairedMetricKey:'duelos_aereos_90'}),
    metric('cortes_90','Cortes/90','per90'), metric('cortes_padj','Cortes ajustados à posse','index'),
    metric('intercecoes_90','Interceptações/90','per90'), metric('intercecoes_padj','Interceptações ajustadas à posse','index'),
    metric('remates_intercetados_90','Chutes bloqueados/90','per90'), metric('duelos_90','Duelos/90','per90',{pairedMetricKey:'duelos_pct'}),
    metric('duelos_pct','Duelos ganhos','percent',{denominatorKey:'duelos',denominatorLabel:'duelos',minAttempts:30,pairedMetricKey:'duelos_90'}),
  ]},
  goleiros:{ label:'🧤 Goleiros',cor:'#d97706',defaultContext:'GK',metricas:[
    metric('defesas_pct','Defesas','percent',{denominatorKey:'remates_sofridos',denominatorLabel:'chutes sofridos',minAttempts:15}),
    metric('gols_prevenidos_90','Gols evitados/90','per90'), metric('gols_prevenidos','Gols evitados','total'),
    metric('gols_sofridos_90','Gols sofridos/90','per90',{higherIsBetter:false}), metric('xga_90','xGA/90','per90',{higherIsBetter:false}),
    metric('remates_sofridos_90','Chutes sofridos/90','per90'), metric('clean_sheets_pct','Jogos sem sofrer gols','percent',{denominatorKey:'jogos',denominatorLabel:'jogos',minAttempts:5}),
    metric('saidas_90','Saídas/90','per90'), metric('passes_tras_recebidos_gk_90','Passes recuados recebidos/90','per90'),
    metric('passes_longos_90','Passes longos/90','per90',{pairedMetricKey:'passes_longos_pct'}),
    metric('passes_longos_pct','Precisão dos passes longos','percent',{denominatorKey:'passes_longos',denominatorLabel:'passes longos',minAttempts:20,pairedMetricKey:'passes_longos_90'}),
  ]},
  disciplina:{ label:'🟨 Disciplina e bola parada',cor:'#ca8a04',defaultContext:'ALL',metricas:[
    metric('faltas_90','Faltas/90','per90',{higherIsBetter:false}), metric('faltas_sofridas_90','Faltas sofridas/90','per90'),
    metric('amarelos','Cartões amarelos','total',{higherIsBetter:false}), metric('amarelos_90','Cartões amarelos/90','per90',{higherIsBetter:false}),
    metric('vermelhos','Cartões vermelhos','total',{higherIsBetter:false}), metric('vermelhos_90','Cartões vermelhos/90','per90',{higherIsBetter:false}),
    metric('cantos_90','Escanteios/90','per90'), metric('livres_90','Bolas paradas/90','per90'), metric('livres_diretos_90','Faltas diretas/90','per90'),
    metric('livres_diretos_alvo_pct','Faltas diretas no alvo','percent'), metric('penaltis_conversao_pct','Conversão de pênaltis','percent'),
  ]},
}

export const WYSCOUT_CORE_METRICS = [
  {key:'gols_90',context:'ST'}, {key:'xg_90',context:'ST'}, {key:'assistencias_90',context:'AM'},
  {key:'assist_remate_90',context:'AM'}, {key:'remates_90',context:'ST'}, {key:'remates_golo_pct',context:'ST'},
  {key:'passes_chave_90',context:'AM'}, {key:'passes_prog_90',context:'DM'}, {key:'dribles_90',context:'WG'},
  {key:'duelos_def_pct',context:'CB'}, {key:'intercecoes_90',context:'DM'}, {key:'duelos_aereos_pct',context:'CB'},
]

export const WYSCOUT_METRIC_INDEX = Object.values(WYSCOUT_METRIC_GROUPS).flatMap(group=>group.metricas).reduce((acc,item)=>({ ...acc,[item.key]:item }),{})
export function getWyscoutMetric(key) { return WYSCOUT_METRIC_INDEX[key] || null }
export function getWyscoutMetricGroup(key) { return Object.entries(WYSCOUT_METRIC_GROUPS).find(([,group])=>group.metricas.some(metric=>metric.key===key))?.[0] || null }

export function getSuggestedWyscoutMinimumMinutes(players = []) {
  const maxMinutes = Math.max(0,...players.map(player=>Number(player.minutos)||0))
  if (!maxMinutes) return 0
  return Math.max(270,Math.round((maxMinutes * .30) / 90) * 90)
}

export function getWyscoutDatasetMeta(players = []) {
  const maxMinutes = Math.max(0,...players.map(player=>Number(player.minutos)||0))
  const positions = [...new Set(players.flatMap(player=>normalizeWyscoutPosition(player.posicao).split(',').map(item=>item.trim())).filter(Boolean))].sort()
  const groups = Object.keys(WYSCOUT_POSITION_GROUPS).reduce((acc,key)=>{
    acc[key] = players.filter(player=>getWyscoutPositionGroup(player.posicao)===key).length
    return acc
  },{})
  const teams = [...new Set(players.map(player=>String(player.equipa||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))
  const footCoverage = getFootCoverage(players)
  const availableMetrics = Object.keys(WYSCOUT_METRIC_INDEX).filter(key=>players.some(player=>Number.isFinite(Number(player[key]))))
  return {
    players:players.length, teams:teams.length, teamsTotal:teams.length, maxMinutes,
    suggestedMinimum:getSuggestedWyscoutMinimumMinutes(players),
    suggestedMinimumMinutes:getSuggestedWyscoutMinimumMinutes(players),
    positions, groups, hasGoalkeepers:(groups.GK||0)>0,
    footCoverage, hasPreferredFoot:footCoverage.informed>0, availableMetrics,
    fullModel:availableMetrics.length >= 20,
  }
}
