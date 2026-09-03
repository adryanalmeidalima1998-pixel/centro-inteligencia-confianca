/**
 * Mapeamento do export Sportsbase "Estatísticas do jogador" (PT-BR)
 * para as chaves internas usadas pela Base de Ligas/CIC.
 */
import { getFootCoverage, normalizePlayerFoot } from '@/data/player-foot'

export const SPORTSBASE_COL_MAP = {
  '№': 'numero',
  'Jogador': 'nome',
  'Time': 'equipa',
  'Idade': 'idade',
  'Altura': 'altura',
  'Peso': 'peso',
  'Nacionalidade': 'pais',
  'Índice': 'indice',
  'Minutos jogados': 'minutos',
  'Posição': 'posicao',
  'Pé': 'pe',
  'Pé preferido': 'pe',
  'Pé dominante': 'pe',
  'Preferred foot': 'pe',
  'Foot': 'pe',
  'Erros que resultam em gol': 'erros_gol',
  'Erros que geram chances de gol': 'erros_chances_gol',
  'Gols': 'gols',
  'Assistências': 'assistencias',
  'Chances de gol': 'chances_gol',
  'Chances de gol bem-sucedidas': 'chances_gol_sucesso',
  'Chances de gol bem-sucedidas, %': 'chances_gol_pct',
  'Chances de gol criadas': 'chances_criadas',
  'Participação em ataques com gol': 'participacao_gols',
  'Cartões amarelos': 'amarelos',
  'Cartões vermelhos': 'vermelhos',
  'Faltas': 'faltas',
  'Faltas sofridas': 'faltas_sofridas',
  'Chutes': 'remates',
  'Chutes no alvo': 'remates_no_alvo',
  'Gols de cabeça': 'gols_cabeca',
  'Chutes de tiro livre': 'remates_livre',
  'Gols de tiro livre': 'gols_livre',
  'Passes': 'passes',
  'Passes precisos, %': 'passes_pct',
  'Passes-chave': 'passes_chave',
  'Passes-chave precisos, %': 'passes_chave_pct',
  'Cruzamentos': 'cruzamentos',
  'Cruzamentos precisos, %': 'cruzamentos_pct',
  'Passes progressivos': 'passes_prog',
  'Passes progressivos precisos, %': 'passes_prog_pct',
  'Passes progressivos limpos': 'passes_prog_limpos',
  'Passes curtos': 'passes_curtos',
  'Passes curtos precisos, %': 'passes_curtos_pct',
  'Passes longos': 'passes_longos',
  'Passes longos precisos, %': 'passes_longos_pct',
  'Passes para a frente no terço final': 'passes_tercofinal',
  'Passes para a frente no terço final precisos, %': 'passes_tercofinal_pct',
  'Passes para a área': 'passes_area',
  'Passes para a área precisos, %': 'passes_area_pct',
  'Passes para chute': 'assist_remate',
  'Passes muito longos': 'passes_muito_longos',
  'Passes muito longos precisos, %': 'passes_muito_longos_pct',
  'Duelos': 'duelos',
  'Duelos ganhos, %': 'duelos_pct',
  'Duelos defensivos': 'duelos_def',
  'Duelos defensivos ganhos, %': 'duelos_def_pct',
  'Duelos ofensivos': 'duelos_of',
  'Duelos ofensivos ganhos, %': 'duelos_of_pct',
  'Duelos aéreos': 'duelos_aereos',
  'Duelos aéreos ganhos, %': 'duelos_aereos_pct',
  'Dribles': 'dribles',
  'Dribles bem-sucedidos, %': 'dribles_pct',
  'Dribles no terço final': 'dribles_tercofinal',
  'Dribles no terço final bem-sucedidos, %': 'dribles_tercofinal_pct',
  'Desarmes': 'desarmes',
  'Desarmes bem-sucedidos, %': 'desarmes_pct',
  'Interceptações': 'intercecoes',
  'Recuperações de bola solta': 'recuperacoes_bola_solta',
  'xG (Gols esperados)': 'xg',
  'Partidas jogadas': 'jogos',
  'Aparições na escalação inicial': 'titularidades',
  'Substituições': 'substituicoes',
  'Substituições_1': 'substituido',
  'Ações': 'acoes',
  'Ações bem-sucedidas': 'acoes_sucesso',
  'Ações bem-sucedidas, %': 'acoes_pct',
  'Ações malsucedidas': 'acoes_falha',
  'Ações na área adversária': 'acoes_area',
  'Ações na área adversária bem-sucedidas': 'acoes_area_sucesso',
  'Ações na área adversária bem-sucedidas, %': 'acoes_area_pct',
  'Chutes no alvo, %': 'remates_golo_pct',
  'Chutes para fora': 'remates_fora',
  'Chutes bloqueados': 'remates_bloqueados',
  'Chutes na trave / no travessão': 'remates_trave',
  'Chutes da área': 'remates_area',
  'Chutes no alvo da área': 'remates_area_alvo',
  'Chutes no alvo da área, %': 'remates_area_pct',
  'Chutes de fora da área': 'remates_fora_area',
  'Chutes no alvo de fora da área': 'remates_fora_area_alvo',
  'Chutes no alvo de fora da área, %': 'remates_fora_area_pct',
  'Cabeceios': 'cabecadas',
  'Cabeceios no alvo': 'cabecadas_alvo',
  'Cabeceios no alvo, %': 'cabecadas_pct',
  'Chutes de tiro livre no alvo': 'remates_livre_alvo',
  'Chutes de tiro livre no alvo, %': 'remates_livre_pct',
  'Entradas no terço final': 'entradas_tercofinal',
  'Entradas no terço final por passe': 'entradas_terco_passe',
  'Entradas no terço final por passe, % do total': 'entradas_terco_passe_pct',
  'Entradas no terço final por condução': 'entradas_terco_conducao',
  'Entradas no terço final por condução, % do total': 'entradas_terco_conducao_pct',
  'Passes precisos': 'passes_precisos',
  'Passes-chave precisos': 'passes_chave_precisos',
  'Cruzamentos precisos': 'cruzamentos_precisos',
  'Passes progressivos precisos': 'passes_prog_precisos',
  'Passes curtos precisos': 'passes_curtos_precisos',
  'Passes longos precisos': 'passes_longos_precisos',
  'Passes para a frente no terço final precisos': 'passes_tercofinal_precisos',
  'Passes para a área precisos': 'passes_area_precisos',
  'Passes muito longos precisos': 'passes_muito_longos_precisos',
  'Passes limpos recebidos': 'passes_recebidos',
  'Passes longos limpos recebidos': 'passes_longos_recebidos',
  'Passes muito longos limpos recebidos': 'passes_muito_longos_recebidos',
  'Passes limpos recebidos no primeiro terço': 'passes_recebidos_primeiro_terco',
  'Passes limpos recebidos no terço central': 'passes_recebidos_terco_central',
  'Passes limpos recebidos no terço final': 'passes_recebidos_tercofinal',
  'Passes limpos recebidos na área adversária': 'passes_recebidos_area',
  'Perdas da bola': 'perdas_bola',
  'Perdas da bola no próprio campo': 'perdas_campo_proprio',
  'Perdas da bola após passes': 'perdas_apos_passes',
  'Perdas individuais da bola': 'perdas_individuais',
  'Duelos perdidos': 'duelos_perdidos',
  'Dribles falhados': 'dribles_falhados',
  'Domínio de bola incorreto': 'dominio_incorreto',
  'Impedimentos': 'impedimentos',
  'Recuperações da bola': 'recuperacoes',
  'Recuperações da bola no campo adversário': 'recuperacoes_campo_adversario',
  'Condução': 'conducoes',
  'xA (assistências esperadas)': 'xa',
  'xGPS (xG por chute)': 'xgps',
  'xGPG (xG por gol)': 'xgpg',
  'xGC (Conversão de xG)': 'xgc',
  'xGT (xG enquanto o jogador está em campo)': 'xgt',
  'xGOPP (xG do adversário enquanto o jogador está em campo)': 'xgopp',
  'NxG (xG líquido, diferença entre xGT e xGOPP)': 'nxg',
  'xGD (xG defensivo)': 'xgd',
  'xGDPS (xG defensivo por chute)': 'xgdps',
  'Duelos ganhos': 'duelos_ganhos',
  'Duelos defensivos ganhos': 'duelos_def_ganhos',
  'Duelos ofensivos ganhos': 'duelos_of_ganhos',
  'Duelos aéreos ganhos': 'duelos_aereos_ganhos',
  'Dribles bem-sucedidos': 'dribles_sucesso',
  'Dribles no terço final bem-sucedidos': 'dribles_tercofinal_sucesso',
  'Desarmes bem-sucedidos': 'desarmes_sucesso',
}

const TEXT_KEYS = new Set(['nome', 'equipa', 'pais', 'posicao', 'pe'])
export const SPORTSBASE_PERCENT_KEYS = new Set([
  'chances_gol_pct', 'passes_pct', 'passes_chave_pct', 'cruzamentos_pct',
  'passes_prog_pct', 'passes_curtos_pct', 'passes_longos_pct',
  'passes_tercofinal_pct', 'passes_area_pct', 'passes_muito_longos_pct',
  'duelos_pct', 'duelos_def_pct', 'duelos_of_pct', 'duelos_aereos_pct',
  'dribles_pct', 'dribles_tercofinal_pct', 'desarmes_pct', 'acoes_pct',
  'acoes_area_pct', 'remates_golo_pct', 'remates_area_pct',
  'remates_fora_area_pct', 'cabecadas_pct', 'remates_livre_pct',
  'entradas_terco_passe_pct', 'entradas_terco_conducao_pct',
])

const OPTIONAL_NUMERIC_KEYS = new Set([
  'numero', 'idade', 'altura', 'peso', 'indice', 'minutos',
  // Métricas avançadas de xG podem vir como "-" quando não há amostra aplicável.
  // Nesses casos, preservar nulo evita transformar ausência de dado em zero real.
  'xa', 'xgps', 'xgpg', 'xgc', 'xgt', 'xgopp', 'nxg', 'xgd', 'xgdps',
])
const ZERO_DEFAULT_KEYS = new Set(
  Object.values(SPORTSBASE_COL_MAP).filter(key =>
    !TEXT_KEYS.has(key) && !SPORTSBASE_PERCENT_KEYS.has(key) && !OPTIONAL_NUMERIC_KEYS.has(key)
  )
)

function round(value, decimals = 4) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function parseSportsbaseNumber(value) {
  if (value === null || value === undefined || value === '' || value === '-') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  let text = String(value).trim().replace(/\s/g, '')
  if (!text || text === '-') return null
  const hasPercent = text.endsWith('%')
  text = text.replace('%', '')

  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '')
  } else if (text.includes(',')) {
    text = text.replace(',', '.')
  }

  const parsed = Number(text)
  if (!Number.isFinite(parsed)) return null
  return hasPercent ? parsed : parsed
}

function parsePercent(value) {
  const parsed = parseSportsbaseNumber(value)
  if (parsed === null) return null
  return round(Math.abs(parsed) <= 1 ? parsed * 100 : parsed, 4)
}

export function sportsbasePer90(value, minutes) {
  const total = parseSportsbaseNumber(value)
  const mins = parseSportsbaseNumber(minutes)
  if (total === null || !mins || mins <= 0) return null
  return round((total * 90) / mins)
}

function setIfValue(target, key, value) {
  if (value !== null && value !== undefined && value !== '') target[key] = value
}

function setPer90(target, outputKey, sourceKey) {
  setIfValue(target, outputKey, sportsbasePer90(target[sourceKey], target.minutos))
}

export function normalizeSportsbasePosition(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toUpperCase())
    .filter(Boolean)
    .join(', ')
}

export const SPORTSBASE_POSITION_GROUPS = {
  GK: { label: 'Goleiros', shortLabel: 'GOL', positions: ['GK'] },
  CB: { label: 'Zagueiros', shortLabel: 'ZAG', positions: ['CB', 'LCB', 'RCB'] },
  FB: { label: 'Laterais', shortLabel: 'LAT', positions: ['LB', 'RB', 'LWB', 'RWB'] },
  DM: { label: 'Volantes', shortLabel: 'VOL', positions: ['DMF', 'LDMF', 'RDMF', 'CDM', 'LCDM', 'RCDM', 'LDM', 'RDM', 'LCM', 'RCM', 'CMF', 'LCMF', 'RCMF'] },
  AM: { label: 'Meias', shortLabel: 'MEI', positions: ['AMF', 'CAM', 'LCAM', 'RCAM', 'LM', 'RM', 'LMF', 'RMF'] },
  WG: { label: 'Extremos', shortLabel: 'EXT', positions: ['LW', 'RW', 'LWF', 'RWF', 'LAM', 'RAM', 'LAMF', 'RAMF'] },
  ST: { label: 'Atacantes', shortLabel: 'ATA', positions: ['CF', 'LCF', 'RCF', 'SS'] },
}

export function getSportsbasePrimaryPosition(posicao) {
  return normalizeSportsbasePosition(posicao).split(',')[0]?.trim() || ''
}

export function getSportsbasePositionGroup(posicao) {
  const primary = getSportsbasePrimaryPosition(posicao)
  return Object.entries(SPORTSBASE_POSITION_GROUPS)
    .find(([, group]) => group.positions.includes(primary))?.[0] || null
}

const PER90_SOURCE_KEYS = {
  gols_90: 'gols', assistencias_90: 'assistencias', xg_90: 'xg',
  chances_gol_90: 'chances_gol', chances_gol_sucesso_90: 'chances_gol_sucesso',
  chances_criadas_90: 'chances_criadas', participacao_gols_90: 'participacao_gols',
  gols_cabeca_90: 'gols_cabeca', remates_90: 'remates', remates_no_alvo_90: 'remates_no_alvo',
  remates_area_90: 'remates_area', remates_area_alvo_90: 'remates_area_alvo',
  remates_fora_area_90: 'remates_fora_area', remates_fora_area_alvo_90: 'remates_fora_area_alvo',
  remates_bloqueados_90: 'remates_bloqueados', cabecadas_90: 'cabecadas', cabecadas_alvo_90: 'cabecadas_alvo',
  faltas_90: 'faltas', faltas_sofridas_90: 'faltas_sofridas', amarelos_90: 'amarelos', vermelhos_90: 'vermelhos',
  passes_90: 'passes', passes_chave_90: 'passes_chave', cruzamentos_90: 'cruzamentos',
  passes_prog_90: 'passes_prog', passes_prog_limpos_90: 'passes_prog_limpos',
  passes_curtos_90: 'passes_curtos', passes_longos_90: 'passes_longos',
  passes_tercofinal_90: 'passes_tercofinal', passes_area_90: 'passes_area',
  assist_remate_90: 'assist_remate', passes_muito_longos_90: 'passes_muito_longos',
  duelos_90: 'duelos', duelos_def_90: 'duelos_def', duelos_of_90: 'duelos_of',
  duelos_aereos_90: 'duelos_aereos', dribles_90: 'dribles',
  dribles_tercofinal_90: 'dribles_tercofinal', desarmes_90: 'desarmes',
  intercecoes_90: 'intercecoes', recuperacoes_bola_solta_90: 'recuperacoes_bola_solta',
  recuperacoes_90: 'recuperacoes', recuperacoes_campo_adversario_90: 'recuperacoes_campo_adversario',
  acoes_90: 'acoes', acoes_sucesso_90: 'acoes_sucesso', acoes_falha_90: 'acoes_falha',
  acoes_area_90: 'acoes_area', acoes_area_sucesso_90: 'acoes_area_sucesso',
  entradas_tercofinal_90: 'entradas_tercofinal', entradas_terco_passe_90: 'entradas_terco_passe',
  entradas_terco_conducao_90: 'entradas_terco_conducao', passes_recebidos_90: 'passes_recebidos',
  passes_longos_recebidos_90: 'passes_longos_recebidos', passes_muito_longos_recebidos_90: 'passes_muito_longos_recebidos',
  passes_recebidos_primeiro_terco_90: 'passes_recebidos_primeiro_terco',
  passes_recebidos_terco_central_90: 'passes_recebidos_terco_central',
  passes_recebidos_tercofinal_90: 'passes_recebidos_tercofinal', passes_recebidos_area_90: 'passes_recebidos_area',
  perdas_bola_90: 'perdas_bola', perdas_campo_proprio_90: 'perdas_campo_proprio',
  perdas_apos_passes_90: 'perdas_apos_passes', perdas_individuais_90: 'perdas_individuais',
  duelos_perdidos_90: 'duelos_perdidos', dribles_falhados_90: 'dribles_falhados',
  dominio_incorreto_90: 'dominio_incorreto', impedimentos_90: 'impedimentos', conducoes_90: 'conducoes',
  erros_gol_90: 'erros_gol', erros_chances_gol_90: 'erros_chances_gol',
  xa_90: 'xa', xgt_90: 'xgt', xgopp_90: 'xgopp', nxg_90: 'nxg', xgd_90: 'xgd',
  duelos_ganhos_90: 'duelos_ganhos', duelos_def_ganhos_90: 'duelos_def_ganhos',
  duelos_of_ganhos_90: 'duelos_of_ganhos', duelos_aereos_ganhos_90: 'duelos_aereos_ganhos',
  dribles_sucesso_90: 'dribles_sucesso', dribles_tercofinal_sucesso_90: 'dribles_tercofinal_sucesso',
  desarmes_sucesso_90: 'desarmes_sucesso',
}

/** Parseia uma linha do arquivo Sportsbase para o formato interno. */
export function parseSportsbaseRow(row) {
  const out = { _fonte: 'sportsbase', _modelo: 'sportsbase-player-stats-ptbr-v2' }

  for (const [header, key] of Object.entries(SPORTSBASE_COL_MAP)) {
    const value = row[header]
    if (value === null || value === undefined || value === '' || value === '-') continue

    if (TEXT_KEYS.has(key)) {
      setIfValue(out, key, key === 'posicao' ? normalizeSportsbasePosition(value) : key === 'pe' ? normalizePlayerFoot(value) : String(value).trim())
    } else {
      setIfValue(out, key, SPORTSBASE_PERCENT_KEYS.has(key) ? parsePercent(value) : parseSportsbaseNumber(value))
    }
  }

  for (const key of ZERO_DEFAULT_KEYS) {
    if (out[key] === null || out[key] === undefined) out[key] = 0
  }

  out.pe = normalizePlayerFoot(out.pe)
  out.pe_fonte = out.pe !== 'unknown' ? 'sportsbase' : null
  out.equipa_periodo = out.equipa
  out.naturalidade = out.pais
  out.grupo_posicional = getSportsbasePositionGroup(out.posicao)

  for (const [outputKey, sourceKey] of Object.entries(PER90_SOURCE_KEYS)) {
    setPer90(out, outputKey, sourceKey)
  }

  // Única taxa derivada adicionada: relação explícita gols/chutes.
  // Não são criadas equivalências semânticas com métricas Wyscout.
  setIfValue(out, 'conversao_gols_pct', out.remates > 0 ? round(((out.gols || 0) * 100) / out.remates, 2) : null)

  return out
}

/** Parseia todas as linhas e remove registros sem jogador/minutagem. */
export function parseSportsbaseExcel(rows) {
  return rows
    .map(parseSportsbaseRow)
    .filter(player => player.nome && (player.minutos || 0) > 0)
}

function metric(key, label, type, options = {}) {
  return {
    key,
    label,
    type,
    higherIsBetter: options.higherIsBetter !== false,
    decimals: options.decimals ?? (type === 'total' ? 0 : type === 'percent' || type === 'distribution' ? 1 : 2),
    denominatorKey: options.denominatorKey || null,
    denominatorLabel: options.denominatorLabel || null,
    minAttempts: options.minAttempts || 0,
    pairedMetricKey: options.pairedMetricKey || null,
    pairedMetricLabel: options.pairedMetricLabel || null,
    description: options.description || '',
    derived: Boolean(options.derived),
  }
}

export const METRIC_TYPE_LABELS = {
  total: 'TOTAL',
  per90: '/90',
  percent: '% SUCESSO',
  distribution: '% DISTRIBUIÇÃO',
  index: 'ÍNDICE SPORTSBASE',
  rate: 'TAXA',
}

export const METRIC_GROUPS = {
  producao: {
    label: '⚽ Produção ofensiva', cor: '#16a34a', defaultContext: 'ST', metricas: [
      metric('gols', 'Gols', 'total'),
      metric('gols_90', 'Gols/90', 'per90'),
      metric('xg', 'xG', 'total', { decimals: 2 }),
      metric('xg_90', 'xG/90', 'per90'),
      metric('xa', 'xA', 'total', { decimals: 2 }),
      metric('xa_90', 'xA/90', 'per90'),
      metric('assistencias', 'Assistências', 'total'),
      metric('assistencias_90', 'Assistências/90', 'per90'),
      metric('chances_criadas', 'Chances de gol criadas', 'total'),
      metric('chances_criadas_90', 'Chances criadas/90', 'per90'),
      metric('participacao_gols', 'Participação em ataques com gol', 'total'),
      metric('participacao_gols_90', 'Participação em ataques com gol/90', 'per90'),
      metric('acoes_90', 'Ações/90', 'per90'),
      metric('chances_gol_pct', 'Conversão das chances de gol', 'percent', { denominatorKey:'chances_gol', denominatorLabel:'chances de gol', minAttempts:6 }),
    ],
  },
  finalizacao: {
    label: '🎯 Finalização', cor: '#0369a1', defaultContext: 'ST', metricas: [
      metric('remates_90', 'Chutes/90', 'per90', { pairedMetricKey:'remates_golo_pct', pairedMetricLabel:'Chutes no alvo %' }),
      metric('remates_golo_pct', 'Chutes no alvo', 'percent', { denominatorKey:'remates', denominatorLabel:'chutes', minAttempts:10, pairedMetricKey:'remates_90', pairedMetricLabel:'Chutes/90' }),
      metric('conversao_gols_pct', 'Conversão de gols (gols/chutes)', 'percent', { denominatorKey:'remates', denominatorLabel:'chutes', minAttempts:10, derived:true }),
      metric('remates_area_90', 'Chutes da área/90', 'per90', { pairedMetricKey:'remates_area_pct', pairedMetricLabel:'Chutes da área no alvo %' }),
      metric('remates_area_pct', 'Chutes da área no alvo', 'percent', { denominatorKey:'remates_area', denominatorLabel:'chutes da área', minAttempts:8, pairedMetricKey:'remates_area_90', pairedMetricLabel:'Chutes da área/90' }),
      metric('remates_fora_area_90', 'Chutes de fora da área/90', 'per90', { pairedMetricKey:'remates_fora_area_pct', pairedMetricLabel:'Chutes de fora no alvo %' }),
      metric('remates_fora_area_pct', 'Chutes de fora no alvo', 'percent', { denominatorKey:'remates_fora_area', denominatorLabel:'chutes de fora', minAttempts:8, pairedMetricKey:'remates_fora_area_90', pairedMetricLabel:'Chutes de fora/90' }),
      metric('cabecadas_90', 'Cabeceios/90', 'per90', { pairedMetricKey:'cabecadas_pct', pairedMetricLabel:'Cabeceios no alvo %' }),
      metric('cabecadas_pct', 'Cabeceios no alvo', 'percent', { denominatorKey:'cabecadas', denominatorLabel:'cabeceios', minAttempts:5, pairedMetricKey:'cabecadas_90', pairedMetricLabel:'Cabeceios/90' }),
      metric('remates_bloqueados_90', 'Chutes bloqueados/90', 'per90'),
      metric('gols_cabeca_90', 'Gols de cabeça/90', 'per90'),
      metric('xgps', 'xG por chute (xGPS)', 'rate', { denominatorKey:'remates', denominatorLabel:'chutes', minAttempts:10 }),
      metric('xgpg', 'xG por gol (xGPG)', 'rate', { higherIsBetter:false, denominatorKey:'gols', denominatorLabel:'gols', minAttempts:2 }),
      metric('xgc', 'Conversão de xG (Gols/xG)', 'rate', { denominatorKey:'xg', denominatorLabel:'xG acumulado', minAttempts:1.5 }),
    ],
  },
  impacto_xg: {
    label: '📈 Impacto xG em campo', cor: '#0f766e', defaultContext: 'ALL', metricas: [
      metric('xgt', 'xG do time em campo (xGT)', 'total', { decimals:2 }),
      metric('xgt_90', 'xG do time em campo/90', 'per90'),
      metric('xgopp', 'xG adversário em campo (xGOPP)', 'total', { decimals:2, higherIsBetter:false }),
      metric('xgopp_90', 'xG adversário em campo/90', 'per90', { higherIsBetter:false }),
      metric('nxg', 'xG líquido em campo (NxG)', 'total', { decimals:2 }),
      metric('nxg_90', 'xG líquido em campo/90', 'per90'),
      metric('xgd', 'xG defensivo (xGD)', 'total', { decimals:2 }),
      metric('xgd_90', 'xG defensivo/90', 'per90'),
      metric('xgdps', 'xG defensivo por chute (xGDPS)', 'rate'),
    ],
  },
  criacao: {
    label: '🔑 Criação e progressão', cor: '#7c3aed', defaultContext: 'AM', metricas: [
      metric('passes_chave_90', 'Passes-chave/90', 'per90', { pairedMetricKey:'passes_chave_pct', pairedMetricLabel:'Precisão dos passes-chave %' }),
      metric('passes_chave_pct', 'Precisão dos passes-chave', 'percent', { denominatorKey:'passes_chave', denominatorLabel:'passes-chave', minAttempts:10, pairedMetricKey:'passes_chave_90', pairedMetricLabel:'Passes-chave/90' }),
      metric('passes_prog_90', 'Passes progressivos/90', 'per90', { pairedMetricKey:'passes_prog_pct', pairedMetricLabel:'Precisão progressiva %' }),
      metric('passes_prog_pct', 'Precisão dos passes progressivos', 'percent', { denominatorKey:'passes_prog', denominatorLabel:'passes progressivos', minAttempts:30, pairedMetricKey:'passes_prog_90', pairedMetricLabel:'Passes progressivos/90' }),
      metric('passes_prog_limpos_90', 'Passes progressivos limpos/90', 'per90'),
      metric('passes_tercofinal_90', 'Passes para frente no terço final/90', 'per90', { pairedMetricKey:'passes_tercofinal_pct', pairedMetricLabel:'Precisão no terço final %' }),
      metric('passes_tercofinal_pct', 'Precisão dos passes para frente no terço final', 'percent', { denominatorKey:'passes_tercofinal', denominatorLabel:'passes para frente no terço final', minAttempts:20, pairedMetricKey:'passes_tercofinal_90', pairedMetricLabel:'Passes para o terço final/90' }),
      metric('passes_area_90', 'Passes para a área/90', 'per90', { pairedMetricKey:'passes_area_pct', pairedMetricLabel:'Precisão para a área %' }),
      metric('passes_area_pct', 'Precisão dos passes para a área', 'percent', { denominatorKey:'passes_area', denominatorLabel:'passes para a área', minAttempts:15, pairedMetricKey:'passes_area_90', pairedMetricLabel:'Passes para a área/90' }),
      metric('assist_remate_90', 'Passes para chute/90', 'per90'),
      metric('cruzamentos_90', 'Cruzamentos/90', 'per90', { pairedMetricKey:'cruzamentos_pct', pairedMetricLabel:'Precisão dos cruzamentos %' }),
      metric('cruzamentos_pct', 'Precisão dos cruzamentos', 'percent', { denominatorKey:'cruzamentos', denominatorLabel:'cruzamentos', minAttempts:15, pairedMetricKey:'cruzamentos_90', pairedMetricLabel:'Cruzamentos/90' }),
      metric('entradas_terco_passe_90', 'Entradas no terço final por passe/90', 'per90'),
      metric('entradas_terco_passe_pct', 'Distribuição das entradas por passe', 'distribution', { denominatorKey:'entradas_tercofinal', denominatorLabel:'entradas no terço final', minAttempts:10 }),
    ],
  },
  distribuicao: {
    label: '📮 Distribuição', cor: '#0891b2', defaultContext: 'DM', metricas: [
      metric('passes_90', 'Passes/90', 'per90', { pairedMetricKey:'passes_pct', pairedMetricLabel:'Precisão de passe %' }),
      metric('passes_pct', 'Precisão de passe', 'percent', { denominatorKey:'passes', denominatorLabel:'passes', minAttempts:100, pairedMetricKey:'passes_90', pairedMetricLabel:'Passes/90' }),
      metric('passes_curtos_90', 'Passes curtos/90', 'per90', { pairedMetricKey:'passes_curtos_pct', pairedMetricLabel:'Precisão curta %' }),
      metric('passes_curtos_pct', 'Precisão dos passes curtos', 'percent', { denominatorKey:'passes_curtos', denominatorLabel:'passes curtos', minAttempts:50, pairedMetricKey:'passes_curtos_90', pairedMetricLabel:'Passes curtos/90' }),
      metric('passes_longos_90', 'Passes longos/90', 'per90', { pairedMetricKey:'passes_longos_pct', pairedMetricLabel:'Precisão longa %' }),
      metric('passes_longos_pct', 'Precisão dos passes longos', 'percent', { denominatorKey:'passes_longos', denominatorLabel:'passes longos', minAttempts:20, pairedMetricKey:'passes_longos_90', pairedMetricLabel:'Passes longos/90' }),
      metric('passes_muito_longos_90', 'Passes muito longos/90', 'per90', { pairedMetricKey:'passes_muito_longos_pct', pairedMetricLabel:'Precisão muito longa %' }),
      metric('passes_muito_longos_pct', 'Precisão dos passes muito longos', 'percent', { denominatorKey:'passes_muito_longos', denominatorLabel:'passes muito longos', minAttempts:10, pairedMetricKey:'passes_muito_longos_90', pairedMetricLabel:'Passes muito longos/90' }),
      metric('passes_recebidos_90', 'Passes limpos recebidos/90', 'per90'),
      metric('passes_recebidos_tercofinal_90', 'Passes recebidos no terço final/90', 'per90'),
      metric('passes_recebidos_area_90', 'Passes recebidos na área/90', 'per90'),
    ],
  },
  umcontraum: {
    label: '⚡ 1×1 e condução', cor: '#d97706', defaultContext: 'WG', metricas: [
      metric('dribles_90', 'Dribles/90', 'per90', { pairedMetricKey:'dribles_pct', pairedMetricLabel:'Dribles bem-sucedidos %' }),
      metric('dribles_pct', 'Dribles bem-sucedidos', 'percent', { denominatorKey:'dribles', denominatorLabel:'dribles', minAttempts:15, pairedMetricKey:'dribles_90', pairedMetricLabel:'Dribles/90' }),
      metric('dribles_sucesso', 'Dribles bem-sucedidos', 'total'),
      metric('dribles_sucesso_90', 'Dribles bem-sucedidos/90', 'per90'),
      metric('dribles_tercofinal_90', 'Dribles no terço final/90', 'per90', { pairedMetricKey:'dribles_tercofinal_pct', pairedMetricLabel:'Sucesso no terço final %' }),
      metric('dribles_tercofinal_pct', 'Dribles no terço final bem-sucedidos', 'percent', { denominatorKey:'dribles_tercofinal', denominatorLabel:'dribles no terço final', minAttempts:10, pairedMetricKey:'dribles_tercofinal_90', pairedMetricLabel:'Dribles no terço final/90' }),
      metric('dribles_tercofinal_sucesso', 'Dribles no terço final bem-sucedidos', 'total'),
      metric('dribles_tercofinal_sucesso_90', 'Dribles no terço final bem-sucedidos/90', 'per90'),
      metric('duelos_of_90', 'Duelos ofensivos/90', 'per90', { pairedMetricKey:'duelos_of_pct', pairedMetricLabel:'Duelos ofensivos ganhos %' }),
      metric('duelos_of_pct', 'Duelos ofensivos ganhos', 'percent', { denominatorKey:'duelos_of', denominatorLabel:'duelos ofensivos', minAttempts:20, pairedMetricKey:'duelos_of_90', pairedMetricLabel:'Duelos ofensivos/90' }),
      metric('duelos_of_ganhos', 'Duelos ofensivos ganhos', 'total'),
      metric('duelos_of_ganhos_90', 'Duelos ofensivos ganhos/90', 'per90'),
      metric('entradas_terco_conducao_90', 'Entradas no terço final por condução/90', 'per90'),
      metric('entradas_terco_conducao_pct', 'Distribuição das entradas por condução', 'distribution', { denominatorKey:'entradas_tercofinal', denominatorLabel:'entradas no terço final', minAttempts:10 }),
      metric('conducoes_90', 'Conduções/90', 'per90'),
      metric('faltas_sofridas_90', 'Faltas sofridas/90', 'per90'),
    ],
  },
  defesa: {
    label: '🛡️ Defesa e recuperação', cor: '#1e40af', defaultContext: 'CB', metricas: [
      metric('duelos_90', 'Duelos/90', 'per90'),
      metric('duelos_ganhos', 'Duelos ganhos', 'total'),
      metric('duelos_ganhos_90', 'Duelos ganhos/90', 'per90'),
      metric('duelos_def_90', 'Duelos defensivos/90', 'per90', { pairedMetricKey:'duelos_def_pct', pairedMetricLabel:'Duelos defensivos ganhos %' }),
      metric('duelos_def_pct', 'Duelos defensivos ganhos', 'percent', { denominatorKey:'duelos_def', denominatorLabel:'duelos defensivos', minAttempts:20, pairedMetricKey:'duelos_def_90', pairedMetricLabel:'Duelos defensivos/90' }),
      metric('duelos_def_ganhos', 'Duelos defensivos ganhos', 'total'),
      metric('duelos_def_ganhos_90', 'Duelos defensivos ganhos/90', 'per90'),
      metric('desarmes_90', 'Desarmes/90', 'per90', { pairedMetricKey:'desarmes_pct', pairedMetricLabel:'Desarmes bem-sucedidos %' }),
      metric('desarmes_pct', 'Desarmes bem-sucedidos', 'percent', { denominatorKey:'desarmes', denominatorLabel:'desarmes', minAttempts:10, pairedMetricKey:'desarmes_90', pairedMetricLabel:'Desarmes/90' }),
      metric('desarmes_sucesso', 'Desarmes bem-sucedidos', 'total'),
      metric('desarmes_sucesso_90', 'Desarmes bem-sucedidos/90', 'per90'),
      metric('intercecoes_90', 'Interceptações/90', 'per90'),
      metric('recuperacoes_90', 'Recuperações/90', 'per90'),
      metric('recuperacoes_campo_adversario_90', 'Recuperações no campo adversário/90', 'per90'),
      metric('recuperacoes_bola_solta_90', 'Recuperações de bola solta/90', 'per90'),
      metric('duelos_aereos_90', 'Duelos aéreos/90', 'per90', { pairedMetricKey:'duelos_aereos_pct', pairedMetricLabel:'Duelos aéreos ganhos %' }),
      metric('duelos_aereos_pct', 'Duelos aéreos ganhos', 'percent', { denominatorKey:'duelos_aereos', denominatorLabel:'duelos aéreos', minAttempts:20, pairedMetricKey:'duelos_aereos_90', pairedMetricLabel:'Duelos aéreos/90' }),
      metric('duelos_aereos_ganhos', 'Duelos aéreos ganhos', 'total'),
      metric('duelos_aereos_ganhos_90', 'Duelos aéreos ganhos/90', 'per90'),
    ],
  },
  seguranca: {
    label: '🔒 Segurança com bola', cor: '#b45309', defaultContext: 'DM', metricas: [
      metric('perdas_bola_90', 'Perdas de bola/90', 'per90', { higherIsBetter:false }),
      metric('perdas_campo_proprio_90', 'Perdas no próprio campo/90', 'per90', { higherIsBetter:false }),
      metric('perdas_apos_passes_90', 'Perdas após passes/90', 'per90', { higherIsBetter:false }),
      metric('perdas_individuais_90', 'Perdas individuais/90', 'per90', { higherIsBetter:false }),
      metric('dominio_incorreto_90', 'Domínio incorreto/90', 'per90', { higherIsBetter:false }),
      metric('dribles_falhados_90', 'Dribles falhados/90', 'per90', { higherIsBetter:false }),
      metric('duelos_perdidos_90', 'Duelos perdidos/90', 'per90', { higherIsBetter:false }),
      metric('erros_chances_gol_90', 'Erros que geram chances/90', 'per90', { higherIsBetter:false }),
      metric('erros_gol_90', 'Erros que resultam em gol/90', 'per90', { higherIsBetter:false }),
    ],
  },
  disciplina: {
    label: '🟨 Disciplina', cor: '#ca8a04', defaultContext: 'ALL', metricas: [
      metric('faltas', 'Faltas', 'total', { higherIsBetter:false }),
      metric('faltas_90', 'Faltas/90', 'per90', { higherIsBetter:false }),
      metric('faltas_sofridas_90', 'Faltas sofridas/90', 'per90'),
      metric('amarelos', 'Cartões amarelos', 'total', { higherIsBetter:false }),
      metric('amarelos_90', 'Cartões amarelos/90', 'per90', { higherIsBetter:false }),
      metric('vermelhos', 'Cartões vermelhos', 'total', { higherIsBetter:false }),
      metric('vermelhos_90', 'Cartões vermelhos/90', 'per90', { higherIsBetter:false }),
      metric('impedimentos_90', 'Impedimentos/90', 'per90', { higherIsBetter:false }),
      metric('indice', 'Índice Sportsbase', 'index', { decimals:0 }),
    ],
  },
}



export const SPORTSBASE_CORE_METRICS = [
  { key:'gols_90', context:'ST' },
  { key:'xg_90', context:'ST' },
  { key:'assistencias_90', context:'AM' },
  { key:'chances_criadas_90', context:'AM' },
  { key:'remates_90', context:'ST' },
  { key:'remates_golo_pct', context:'ST' },
  { key:'passes_chave_90', context:'AM' },
  { key:'passes_prog_90', context:'DM' },
  { key:'dribles_90', context:'WG' },
  { key:'duelos_def_pct', context:'CB' },
  { key:'recuperacoes_90', context:'DM' },
  { key:'perdas_bola_90', context:'AM' },
]

export function getSportsbaseMetricGroup(metricKey) {
  return Object.entries(METRIC_GROUPS).find(([, group]) => group.metricas.some(metric => metric.key === metricKey))?.[0] || null
}

export const SPORTSBASE_METRIC_INDEX = Object.values(METRIC_GROUPS)
  .flatMap(group => group.metricas)
  .reduce((acc, item) => ({ ...acc, [item.key]: item }), {})

const INVERTED_FALLBACK_KEYS = new Set([
  'perdas_bola_90','perdas_campo_proprio_90','perdas_apos_passes_90','perdas_individuais_90',
  'dominio_incorreto_90','dribles_falhados_90','duelos_perdidos_90','erros_chances_gol_90',
  'erros_gol_90','faltas_90','amarelos_90','vermelhos_90','impedimentos_90',
])

function humanizeMetricKey(key = '') {
  return String(key)
    .replace(/_90$/, '/90')
    .replace(/_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export function getSportsbaseMetric(key) {
  if (SPORTSBASE_METRIC_INDEX[key]) return SPORTSBASE_METRIC_INDEX[key]
  if (!key) return null
  if (String(key).endsWith('_pct')) {
    return metric(key, humanizeMetricKey(key), 'percent', {
      denominatorKey:String(key).replace(/_pct$/, ''),
      higherIsBetter:!INVERTED_FALLBACK_KEYS.has(key),
    })
  }
  if (String(key).endsWith('_90')) {
    return metric(key, humanizeMetricKey(key), 'per90', { higherIsBetter:!INVERTED_FALLBACK_KEYS.has(key) })
  }
  return null
}

export function getSuggestedMinimumMinutes(players = []) {
  const maxMinutes = Math.max(0, ...players.map(player => Number(player?.minutos) || 0))
  if (!maxMinutes) return 0
  return Math.max(50, Math.round((maxMinutes * 0.35) / 50) * 50)
}

export function resolveMetricMinimumMinutes(metricDef, players = [], selectedMinimum = 'auto') {
  if (typeof selectedMinimum === 'number' && Number.isFinite(selectedMinimum)) return Math.max(0, selectedMinimum)
  if (selectedMinimum !== 'auto') return 0
  if (!metricDef || ['total', 'index'].includes(metricDef.type)) return 0
  return getSuggestedMinimumMinutes(players)
}

function hasNumericMetricValue(value) {
  if (value === null || value === undefined || value === '' || value === '-') return false
  return Number.isFinite(Number(value))
}

export function getMetricEligibility(player, metricDef, options = {}) {
  const players = options.players || []
  const selectedMinimum = options.selectedMinimum ?? 'auto'
  if (!metricDef) return { eligible:false, reason:'Métrica inválida', minimumMinutes:0 }
  const rawValue = player?.[metricDef.key]
  if (!hasNumericMetricValue(rawValue)) return { eligible:false, reason:'Sem valor para a métrica', minimumMinutes:0 }
  const value = Number(rawValue)

  const minimumMinutes = resolveMetricMinimumMinutes(metricDef, players, selectedMinimum)
  const minutes = Number(player?.minutos) || 0
  if (minutes < minimumMinutes) {
    return { eligible:false, reason:`Abaixo de ${minimumMinutes} minutos`, minimumMinutes }
  }

  if (metricDef.denominatorKey && metricDef.minAttempts > 0) {
    const rawAttempts = player?.[metricDef.denominatorKey]
    if (!hasNumericMetricValue(rawAttempts)) {
      return {
        eligible:false,
        reason:`Sem base de ${metricDef.denominatorLabel || 'tentativas'}`,
        minimumMinutes,
        attempts:null,
      }
    }
    const attempts = Number(rawAttempts)
    if (attempts < metricDef.minAttempts) {
      return {
        eligible:false,
        reason:`Abaixo de ${metricDef.minAttempts} ${metricDef.denominatorLabel || 'tentativas'}`,
        minimumMinutes,
        attempts,
      }
    }
  }

  return {
    eligible:true,
    reason:null,
    minimumMinutes,
    value,
    attempts: metricDef.denominatorKey && hasNumericMetricValue(player?.[metricDef.denominatorKey]) ? Number(player[metricDef.denominatorKey]) : null,
  }
}

export function isSportsbaseMetricEligible(player, metricDefOrKey, options = {}) {
  const metricDef = typeof metricDefOrKey === 'string' ? getSportsbaseMetric(metricDefOrKey) : metricDefOrKey
  return getMetricEligibility(player, metricDef, options).eligible
}

export function calculateSportsbasePercentile(value, values, higherIsBetter = true) {
  if (!hasNumericMetricValue(value)) return null
  const numericValue = Number(value)
  const valid = values.filter(hasNumericMetricValue).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!valid.length) return null
  const lower = valid.filter(item => item < numericValue).length
  const equal = valid.filter(item => item === numericValue).length
  const raw = ((lower + equal * 0.5) / valid.length) * 100
  return Math.round(higherIsBetter ? raw : 100 - raw)
}

export function formatSportsbaseMetric(value, metricDef) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const decimals = metricDef?.decimals ?? 2
  const formatted = number.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(number) && decimals > 0 ? 0 : decimals,
    maximumFractionDigits: decimals,
  })
  return ['percent', 'distribution'].includes(metricDef?.type) ? `${formatted}%` : formatted
}

export function getSportsbaseDatasetMeta(players = []) {
  const maxMinutes = Math.max(0, ...players.map(player => Number(player.minutos) || 0))
  const positions = [...new Set(players.flatMap(player => normalizeSportsbasePosition(player.posicao).split(',').map(item => item.trim())).filter(Boolean))].sort()
  const groups = Object.keys(SPORTSBASE_POSITION_GROUPS).reduce((acc, key) => {
    acc[key] = players.filter(player => getSportsbasePositionGroup(player.posicao) === key).length
    return acc
  }, {})
  const teams = [...new Set(players.map(player=>String(player.equipa||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))
  const footCoverage = getFootCoverage(players)
  return {
    maxMinutes,
    suggestedMinimumMinutes: getSuggestedMinimumMinutes(players),
    positions,
    groups,
    teams,
    teamsTotal:teams.length,
    hasGoalkeepers: groups.GK > 0,
    footCoverage,
    hasPreferredFoot: footCoverage.informed > 0,
  }
}
