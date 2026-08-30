import {
  parseSportsbaseNumber,
  parseSportsbaseRow,
  getSportsbasePositionGroup,
} from '@/data/sportsbase-map'

const PERCENT_HEADERS = new Set([
  'Chances de gol bem-sucedidas, %', 'Tiros de meta precisos, %', 'Passes precisos, %',
  'Passes-chave precisos, %', 'Cruzamentos precisos, %', 'Passes progressivos precisos, %',
  'Passes longos precisos, %', 'Passes muito longos precisos, %', 'Passes para a área precisos, %',
  'Duelos ganhos, %', 'Duelos defensivos ganhos, %', 'Duelos ofensivos ganhos, %',
  'Duelos aéreos ganhos, %', 'Dribles bem-sucedidos, %',
  'Dribles no terço final bem-sucedidos, %', 'Desarmes bem-sucedidos, %',
  'Pressão do time bem-sucedida, %', 'Posse de bola, %', 'Chutes no alvo, %',
  'Ações bem-sucedidas, %', 'Ações na área adversária bem-sucedidas, %',
  'Entradas no terço final por passe, % do total', 'Entradas no terço final por condução, % do total',
  'Tiros de meta curtos (<15 m) precisos, %', 'Tiros de meta médios (15-40 m) precisos, %',
  'Tiros de meta longos (40+ m) precisos, %', 'Passes para a frente precisos, %',
])

export const GUARANI_TEAM_COL_MAP = {
  'Posição na tabela': 'posicao_tabela',
  'Posição': 'posicao_tabela',
  'Classificação': 'posicao_tabela',
  'Índice': 'indice',
  'Chances de gol': 'chances_gol',
  'Chances de gol bem-sucedidas, %': 'chances_gol_pct',
  'Faltas': 'faltas',
  'Cartões amarelos': 'amarelos',
  'Cartões vermelhos': 'vermelhos',
  'Escanteios': 'escanteios',
  'Chutes': 'remates',
  'Chutes no alvo': 'remates_no_alvo',
  'Entradas no campo adversário': 'entradas_campo_adversario',
  'Entradas na área adversária': 'entradas_area',
  'Perdas da bola': 'perdas_bola',
  'Perdas da bola no próprio campo': 'perdas_campo_proprio',
  'Passes': 'passes',
  'Passes precisos, %': 'passes_pct',
  'Passes-chave': 'passes_chave',
  'Passes-chave precisos': 'passes_chave_precisos',
  'Passes-chave precisos, %': 'passes_chave_pct',
  'Cruzamentos': 'cruzamentos',
  'Cruzamentos precisos, %': 'cruzamentos_pct',
  'Passes progressivos': 'passes_prog',
  'Passes progressivos precisos, %': 'passes_prog_pct',
  'Passes progressivos limpos': 'passes_prog_limpos',
  'Passes longos': 'passes_longos',
  'Passes longos precisos, %': 'passes_longos_pct',
  'Passes muito longos': 'passes_muito_longos',
  'Passes muito longos precisos, %': 'passes_muito_longos_pct',
  'Passes para a área': 'passes_area',
  'Passes para a área precisos, %': 'passes_area_pct',
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
  'Pressão do time': 'pressao',
  'Pressão do time bem-sucedida, %': 'pressao_pct',
  'Posse de bola, %': 'posse_pct',
  'Ataques de bola parada com gol': 'ataques_bola_parada_gol',
  'Ataques de escanteio com gol': 'ataques_escanteio_gol',
  'Chutes no alvo, %': 'remates_alvo_pct',
  'Chutes para fora': 'remates_fora',
  'Chutes bloqueados': 'remates_bloqueados',
  'Chutes na trave / no travessão': 'remates_trave',
  'Ações': 'acoes',
  'Ações bem-sucedidas': 'acoes_sucesso',
  'Ações bem-sucedidas, %': 'acoes_pct',
  'Ações na área adversária': 'acoes_area',
  'Ações na área adversária bem-sucedidas': 'acoes_area_sucesso',
  'Ações na área adversária bem-sucedidas, %': 'acoes_area_pct',
  'Entradas no terço final': 'entradas_tercofinal',
  'Entradas no terço final por passe': 'entradas_terco_passe',
  'Entradas no terço final por passe, % do total': 'entradas_terco_passe_pct',
  'Entradas no terço final por condução': 'entradas_terco_conducao',
  'Entradas no terço final por condução, % do total': 'entradas_terco_conducao_pct',
  'Perdas da bola após passes': 'perdas_apos_passes',
  'Perdas individuais da bola': 'perdas_individuais',
  'Duelos perdidos': 'duelos_perdidos',
  'Dribles falhados': 'dribles_falhados',
  'Domínio de bola incorreto': 'dominio_incorreto',
  'Impedimentos': 'impedimentos',
  'Recuperações da bola': 'recuperacoes',
  'Recuperações da bola no campo adversário': 'recuperacoes_campo_adversario',
  'Recuperações da bola após perdas em até 10 segundos': 'recuperacoes_10s',
  'Recuperações da bola após perdas em até 10 segundos no campo adversário': 'recuperacoes_10s_campo_adversario',
  'Recuperações da bola após perdas em até 5 segundos': 'recuperacoes_5s',
  'Recuperações da bola após perdas em até 5 segundos no campo adversário': 'recuperacoes_5s_campo_adversario',
  'Distância média até o gol nas recuperações da bola': 'distancia_recuperacao_gol',
  'Distância média até o gol nas perdas da bola': 'distancia_perda_gol',
  'Condução': 'conducoes',
  'Passes para a frente': 'passes_frente',
  'Passes para a frente precisos': 'passes_frente_precisos',
  'Passes para a frente precisos, %': 'passes_frente_pct',
  'Passes de lateral': 'passes_lateral',
  'Duelos ganhos': 'duelos_ganhos',
  'Duelos defensivos ganhos': 'duelos_def_ganhos',
  'Duelos ofensivos ganhos': 'duelos_of_ganhos',
  'Duelos aéreos ganhos': 'duelos_aereos_ganhos',
  'Dribles bem-sucedidos': 'dribles_sucesso',
  'Dribles no terço final bem-sucedidos': 'dribles_tercofinal_sucesso',
  'Desarmes bem-sucedidos': 'desarmes_sucesso',
  'Interceptações': 'intercecoes',
  'Recuperações de bola solta': 'recuperacoes_bola_solta',
}

function round(value, decimals = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

function percentValue(value) {
  const n = parseSportsbaseNumber(value)
  if (n === null) return null
  return round(Math.abs(n) <= 1 ? n * 100 : n, 4)
}

function numericValue(value, isPercent = false) {
  if (value === '-' || value === '' || value === null || value === undefined) return 0
  return isPercent ? (percentValue(value) ?? 0) : (parseSportsbaseNumber(value) ?? 0)
}

export function excelDateToISO(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && value > 30000) {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    return new Date(ms).toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  const br = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10)
}

function parseScore(score, mando) {
  const match = String(score || '').match(/(\d+)\s*[:x-]\s*(\d+)/i)
  if (!match) return { golsPro: 0, golsContra: 0, resultado: 'E' }
  const first = Number(match[1]) || 0
  const second = Number(match[2]) || 0
  const casa = String(mando || '').toLowerCase().startsWith('m')
  const golsPro = casa ? first : second
  const golsContra = casa ? second : first
  return { golsPro, golsContra, resultado: golsPro > golsContra ? 'V' : golsPro < golsContra ? 'D' : 'E' }
}

export function parseGuaraniTeamRows(rows = []) {
  const games = []
  for (const row of rows) {
    const adversario = String(row?.['Adversário'] || '').trim()
    const dataRaw = row?.Data
    if (!adversario || !dataRaw || String(dataRaw).toLowerCase() === 'total') continue

    const mandoCode = String(row?.['m / v'] || '').trim().toLowerCase()
    const mando = mandoCode.startsWith('m') ? 'casa' : 'fora'
    const score = parseScore(row?.Placar, mandoCode)
    const game = {
      id: `sb_${excelDateToISO(dataRaw)}_${adversario}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]+/gi, '_').toLowerCase(),
      data: excelDateToISO(dataRaw),
      adversario,
      mando,
      mando_code: mandoCode,
      placar: String(row?.Placar || ''),
      sistema: String(row?.['Tática (inicial)'] || '—').trim(),
      competicao: 'Brasileirão Série C 2026',
      ...score,
      pontos: score.resultado === 'V' ? 3 : score.resultado === 'E' ? 1 : 0,
      _fonte: 'sportsbase',
    }
    for (const [header, key] of Object.entries(GUARANI_TEAM_COL_MAP)) {
      game[key] = numericValue(row?.[header], PERCENT_HEADERS.has(header))
    }
    games.push(game)
  }

  games.sort((a, b) => String(a.data).localeCompare(String(b.data)))
  return games.map((game, index) => ({ ...game, rodada: index + 1 }))
}

export function parseGuaraniPlayerRows(rows = []) {
  return rows
    .map(row => parseSportsbaseRow({ ...row, Time: row?.Time || 'Confiança' }))
    .filter(player => player.nome && (Number(player.minutos) || 0) > 0)
    .map(player => ({ ...player, equipa: 'Confiança', equipa_periodo: 'Confiança', _fonte: 'sportsbase-guarani' }))
}

function average(list, key) {
  const values = list.map(item => Number(item?.[key])).filter(Number.isFinite)
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : 0
}

function total(list, key) {
  return round(list.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0), 2)
}

function scale(value, min, max, inverted = false) {
  if (max <= min) return 50
  const raw = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100))
  return Math.round(inverted ? 100 - raw : raw)
}

const STYLE_DIMENSIONS = [
  { key: 'construcao', label: 'Construção e controle', metrics: [
    ['passes_pct', 74, 91], ['passes_prog', 55, 145], ['entradas_terco_passe', 10, 45], ['acoes_pct', 68, 86],
  ] },
  { key: 'progressao', label: 'Progressão territorial', metrics: [
    ['passes_prog', 55, 145], ['entradas_tercofinal', 15, 65], ['passes_area', 8, 35], ['entradas_campo_adversario', 35, 95],
  ] },
  { key: 'desequilibrio', label: 'Condução e 1×1', metrics: [
    ['dribles', 8, 26], ['dribles_pct', 35, 72], ['entradas_terco_conducao', 2, 16], ['conducoes', 8, 32],
  ] },
  { key: 'pressao', label: 'Pressão e recuperação alta', metrics: [
    ['pressao_pct', 10, 65], ['recuperacoes_campo_adversario', 2, 18], ['recuperacoes_10s_campo_adversario', 1, 10], ['duelos_def_pct', 38, 62],
  ] },
  { key: 'finalizacao', label: 'Criação e finalização', metrics: [
    ['chances_gol', 3, 11], ['remates', 8, 20], ['remates_alvo_pct', 22, 48], ['entradas_area', 7, 22],
  ] },
  { key: 'seguranca', label: 'Segurança com bola', metrics: [
    ['perdas_bola', 40, 85, true], ['perdas_campo_proprio', 4, 20, true], ['passes_pct', 74, 91], ['acoes_pct', 68, 86],
  ] },
]

function avgScores(scores) {
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
}

function trend(current, previous, higherBetter = true) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0
  const diff = current - previous
  return round(higherBetter ? diff : -diff, 2)
}

export function deriveGuaraniModel(games = []) {
  const recent = games.slice(-5)
  const previous = games.slice(Math.max(0, games.length - 10), Math.max(0, games.length - 5))
  const dimensions = STYLE_DIMENSIONS.map(dimension => {
    const metricScores = dimension.metrics.map(([key, min, max, inverted]) => scale(average(games, key), min, max, Boolean(inverted)))
    return { key: dimension.key, label: dimension.label, score: avgScores(metricScores) }
  }).sort((a, b) => b.score - a.score)

  const top = dimensions[0]
  const identityMap = {
    construcao: 'Construção apoiada e controle territorial',
    progressao: 'Progressão vertical com ocupação do campo adversário',
    desequilibrio: 'Ataque por condução e desequilíbrio individual',
    pressao: 'Pressão ativa e recuperação em campo alto',
    finalizacao: 'Produção ofensiva orientada à área',
    seguranca: 'Controle de risco e circulação segura',
  }

  const keyTrends = [
    { key: 'chances_gol', label: 'Chances de gol', current: average(recent, 'chances_gol'), previous: average(previous, 'chances_gol'), higherBetter: true },
    { key: 'remates', label: 'Chutes', current: average(recent, 'remates'), previous: average(previous, 'remates'), higherBetter: true },
    { key: 'passes_prog', label: 'Passes progressivos', current: average(recent, 'passes_prog'), previous: average(previous, 'passes_prog'), higherBetter: true },
    { key: 'recuperacoes_campo_adversario', label: 'Recuperações altas', current: average(recent, 'recuperacoes_campo_adversario'), previous: average(previous, 'recuperacoes_campo_adversario'), higherBetter: true },
    { key: 'perdas_campo_proprio', label: 'Perdas no próprio campo', current: average(recent, 'perdas_campo_proprio'), previous: average(previous, 'perdas_campo_proprio'), higherBetter: false },
  ].map(item => ({ ...item, delta: trend(item.current, item.previous, item.higherBetter) }))

  const weak = [...dimensions].sort((a, b) => a.score - b.score).slice(0, 3)
  const strengths = dimensions.slice(0, 3)
  const priorityMap = {
    construcao: ['passes_pct', 'passes_prog_90', 'passes_prog_pct', 'perdas_apos_passes_90'],
    progressao: ['passes_prog_90', 'passes_tercofinal_90', 'entradas_terco_passe_90', 'entradas_terco_conducao_90'],
    desequilibrio: ['dribles_90', 'dribles_pct', 'dribles_tercofinal_90', 'faltas_sofridas_90'],
    pressao: ['recuperacoes_campo_adversario_90', 'duelos_def_90', 'duelos_def_pct', 'desarmes_90'],
    finalizacao: ['xg_90', 'gols_90', 'remates_90', 'remates_golo_pct', 'chances_criadas_90'],
    seguranca: ['perdas_bola_90', 'perdas_campo_proprio_90', 'passes_pct', 'acoes_pct'],
  }
  const recruitmentMetrics = [...new Set([...strengths.slice(0, 2), ...weak.slice(0, 2)].flatMap(item => priorityMap[item.key] || []))]

  return {
    identity: identityMap[top?.key] || 'Modelo em construção',
    dimensions,
    strengths,
    needs: weak,
    keyTrends,
    recruitmentMetrics,
    sampleGames: games.length,
  }
}

export function summarizeGuaraniDataset(games = [], players = []) {
  const wins = games.filter(game => game.resultado === 'V').length
  const draws = games.filter(game => game.resultado === 'E').length
  const losses = games.filter(game => game.resultado === 'D').length
  const points = wins * 3 + draws
  const last5 = games.slice(-5)
  const model = deriveGuaraniModel(games)
  const groups = players.reduce((acc, player) => {
    const group = getSportsbasePositionGroup(player.posicao) || 'OUTRO'
    if (!acc[group]) acc[group] = { total: 0, minutes: 0, avgAge: 0 }
    acc[group].total += 1
    acc[group].minutes += Number(player.minutos) || 0
    acc[group].avgAge += Number(player.idade) || 0
    return acc
  }, {})
  for (const group of Object.values(groups)) group.avgAge = group.total ? round(group.avgAge / group.total, 1) : 0

  return {
    games: games.length,
    players: players.length,
    wins,
    draws,
    losses,
    points,
    performance: games.length ? round((points / (games.length * 3)) * 100, 1) : 0,
    goalsFor: total(games, 'golsPro'),
    goalsAgainst: total(games, 'golsContra'),
    goalDifference: total(games, 'golsPro') - total(games, 'golsContra'),
    last5Points: last5.reduce((sum, game) => sum + game.pontos, 0),
    last5Results: last5.map(game => game.resultado),
    averages: {
      goals: average(games, 'golsPro'),
      chances: average(games, 'chances_gol'),
      shots: average(games, 'remates'),
      shotsOnTargetPct: average(games, 'remates_alvo_pct'),
      possession: average(games, 'posse_pct'),
      passAccuracy: average(games, 'passes_pct'),
      progressivePasses: average(games, 'passes_prog'),
      finalThirdEntries: average(games, 'entradas_tercofinal'),
      boxEntries: average(games, 'entradas_area'),
      defensiveDuelPct: average(games, 'duelos_def_pct'),
      recoveries: average(games, 'recuperacoes'),
      highRecoveries: average(games, 'recuperacoes_campo_adversario'),
      losses: average(games, 'perdas_bola'),
      ownHalfLosses: average(games, 'perdas_campo_proprio'),
    },
    groups,
    model,
  }
}
