import { calculateSportsbasePercentile, getSportsbasePositionGroup } from './sportsbase-map'

const safeNumber = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const round = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const sumBy = (players, key) => players.reduce((sum, player) => sum + safeNumber(player?.[key]), 0)

const weightedPercent = (players, attemptsKey, percentKey, successKey = null) => {
  const relevant = players.filter(player => {
    const attempts = Number(player?.[attemptsKey])
    const outcome = Number(player?.[successKey || percentKey])
    return Number.isFinite(attempts) && attempts > 0 && Number.isFinite(outcome)
  })
  const attempts = sumBy(relevant, attemptsKey)
  if (!attempts) return null
  const successes = successKey
    ? sumBy(relevant, successKey)
    : relevant.reduce((sum, player) => sum + safeNumber(player?.[attemptsKey]) * Number(player?.[percentKey]) / 100, 0)
  return round(successes * 100 / attempts, 1)
}

const shareTop = (players, key, count = 3) => {
  const values = players.map(player => safeNumber(player?.[key])).sort((a, b) => b - a)
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!total) return null
  return round(values.slice(0, count).reduce((sum, value) => sum + value, 0) * 100 / total, 1)
}

const perTeam90 = (total, matchEquivalents) => matchEquivalents > 0 ? round(total / matchEquivalents, 2) : null

export const SPORTSBASE_TEAM_METRICS = [
  { key:'gols_90', label:'Gols/90 de equipe', higherIsBetter:true, group:'Produção' },
  { key:'xg_90', label:'xG/90 de equipe', higherIsBetter:true, group:'Produção' },
  { key:'assistencias_90', label:'Assistências/90', higherIsBetter:true, group:'Produção' },
  { key:'chances_criadas_90', label:'Chances criadas/90', higherIsBetter:true, group:'Produção' },
  { key:'remates_90', label:'Chutes/90', higherIsBetter:true, group:'Finalização' },
  { key:'remates_golo_pct', label:'Chutes no alvo', higherIsBetter:true, group:'Finalização', percent:true },
  { key:'conversao_gols_pct', label:'Conversão gols/chutes', higherIsBetter:true, group:'Finalização', percent:true },
  { key:'passes_chave_90', label:'Passes-chave/90', higherIsBetter:true, group:'Criação' },
  { key:'passes_prog_90', label:'Passes progressivos/90', higherIsBetter:true, group:'Criação' },
  { key:'passes_prog_pct', label:'Precisão progressiva', higherIsBetter:true, group:'Criação', percent:true },
  { key:'passes_area_90', label:'Passes para a área/90', higherIsBetter:true, group:'Criação' },
  { key:'passes_area_pct', label:'Precisão para a área', higherIsBetter:true, group:'Criação', percent:true },
  { key:'dribles_90', label:'Dribles/90', higherIsBetter:true, group:'Desequilíbrio' },
  { key:'dribles_pct', label:'Sucesso nos dribles', higherIsBetter:true, group:'Desequilíbrio', percent:true },
  { key:'conducoes_90', label:'Conduções/90', higherIsBetter:true, group:'Desequilíbrio' },
  { key:'duelos_def_90', label:'Duelos defensivos/90', higherIsBetter:true, group:'Defesa' },
  { key:'duelos_def_pct', label:'Duelos defensivos ganhos', higherIsBetter:true, group:'Defesa', percent:true },
  { key:'desarmes_90', label:'Desarmes/90', higherIsBetter:true, group:'Defesa' },
  { key:'desarmes_pct', label:'Desarmes bem-sucedidos', higherIsBetter:true, group:'Defesa', percent:true },
  { key:'intercecoes_90', label:'Interceptações/90', higherIsBetter:true, group:'Defesa' },
  { key:'recuperacoes_90', label:'Recuperações/90', higherIsBetter:true, group:'Defesa' },
  { key:'recuperacoes_campo_adversario_90', label:'Recuperações no campo adversário/90', higherIsBetter:true, group:'Pressão' },
  { key:'duelos_aereos_pct', label:'Duelos aéreos ganhos', higherIsBetter:true, group:'Defesa', percent:true },
  { key:'perdas_bola_90', label:'Perdas de bola/90', higherIsBetter:false, group:'Segurança' },
  { key:'perdas_campo_proprio_90', label:'Perdas no próprio campo/90', higherIsBetter:false, group:'Segurança' },
  { key:'erros_chances_gol_90', label:'Erros que geram chances/90', higherIsBetter:false, group:'Segurança' },
  { key:'erros_gol_90', label:'Erros que resultam em gol/90', higherIsBetter:false, group:'Segurança' },
]

export const SPORTSBASE_TEAM_DIMENSIONS = {
  producao: { label:'Produção ofensiva', metrics:['gols_90','xg_90','chances_criadas_90','remates_90'] },
  finalizacao: { label:'Eficiência de finalização', metrics:['remates_golo_pct','conversao_gols_pct'] },
  criacao: { label:'Criação e progressão', metrics:['passes_chave_90','passes_prog_90','passes_prog_pct','passes_area_90'] },
  desequilibrio: { label:'Condução e desequilíbrio', metrics:['dribles_90','dribles_pct','conducoes_90'] },
  defesa: { label:'Produção defensiva', metrics:['duelos_def_90','duelos_def_pct','intercecoes_90','recuperacoes_90'] },
  pressao: { label:'Recuperação alta', metrics:['recuperacoes_campo_adversario_90','desarmes_90'] },
  seguranca: { label:'Segurança com bola', metrics:['perdas_bola_90','perdas_campo_proprio_90','erros_chances_gol_90'] },
}

export function aggregateSportsbaseTeam(teamName, players = []) {
  const teamMinutes = sumBy(players, 'minutos')
  // O export Sportsbase pode vir sem goleiros. Nesse caso, um jogo equivale a 10 x 90 = 900
  // jogador-minutos; com goleiros, usamos 11 x 90 = 990. Assim, a ausência da posição no
  // arquivo não infla artificialmente as taxas agregadas da equipe.
  const hasGoalkeeper = players.some(player => getSportsbasePositionGroup(player.posicao) === 'GK')
  const minuteBasis = (hasGoalkeeper ? 11 : 10) * 90
  const matchEquivalents = teamMinutes > 0 ? teamMinutes / minuteBasis : 0
  const goals = sumBy(players, 'gols')
  const shots = sumBy(players, 'remates')
  const agePlayers = players.filter(player => Number.isFinite(Number(player.idade)) && Number(player.idade) > 0)
  const ageMinutes = sumBy(agePlayers, 'minutos')
  const ageWeight = agePlayers.reduce((sum, player) => sum + Number(player.idade) * safeNumber(player.minutos), 0)
  const u23Minutes = agePlayers.reduce((sum, player) => sum + (Number(player.idade) <= 23 ? safeNumber(player.minutos) : 0), 0)
  const indexPlayers = players.filter(player => Number.isFinite(Number(player.indice)))
  const indexMinutes = sumBy(indexPlayers, 'minutos')
  const indexWeight = indexPlayers.reduce((sum, player) => sum + Number(player.indice) * safeNumber(player.minutos), 0)

  const positions = Object.keys({ GK:1, CB:1, FB:1, DM:1, AM:1, WG:1, ST:1 }).reduce((acc, key) => {
    acc[key] = players.filter(player => getSportsbasePositionGroup(player.posicao) === key).length
    return acc
  }, {})

  const totals = {
    gols:goals,
    xg:sumBy(players, 'xg'),
    assistencias:sumBy(players, 'assistencias'),
    chances_criadas:sumBy(players, 'chances_criadas'),
    participacao_gols:sumBy(players, 'participacao_gols'),
    remates:shots,
    passes_chave:sumBy(players, 'passes_chave'),
    passes_prog:sumBy(players, 'passes_prog'),
    passes_area:sumBy(players, 'passes_area'),
    entradas_terco_passe:sumBy(players, 'entradas_terco_passe'),
    dribles:sumBy(players, 'dribles'),
    conducoes:sumBy(players, 'conducoes'),
    duelos_def:sumBy(players, 'duelos_def'),
    desarmes:sumBy(players, 'desarmes'),
    intercecoes:sumBy(players, 'intercecoes'),
    recuperacoes:sumBy(players, 'recuperacoes'),
    recuperacoes_campo_adversario:sumBy(players, 'recuperacoes_campo_adversario'),
    perdas_bola:sumBy(players, 'perdas_bola'),
    perdas_campo_proprio:sumBy(players, 'perdas_campo_proprio'),
    erros_chances_gol:sumBy(players, 'erros_chances_gol'),
    erros_gol:sumBy(players, 'erros_gol'),
  }

  return {
    team_name:teamName,
    players_total:players.length,
    players_450:players.filter(player=>safeNumber(player.minutos)>=450).length,
    team_minutes:Math.round(teamMinutes),
    match_equivalents:round(matchEquivalents, 1),
    minute_basis:minuteBasis,
    includes_goalkeepers:hasGoalkeeper,
    max_player_minutes:Math.max(0, ...players.map(player=>safeNumber(player.minutos))),
    max_games:Math.max(0, ...players.map(player=>safeNumber(player.jogos))),
    avg_age:ageMinutes ? round(ageWeight / ageMinutes, 1) : null,
    u23_minutes_pct:ageMinutes ? round(u23Minutes * 100 / ageMinutes, 1) : null,
    avg_index:indexMinutes ? round(indexWeight / indexMinutes, 1) : null,
    positions,
    ...totals,
    gols_90:perTeam90(totals.gols, matchEquivalents),
    xg_90:perTeam90(totals.xg, matchEquivalents),
    assistencias_90:perTeam90(totals.assistencias, matchEquivalents),
    chances_criadas_90:perTeam90(totals.chances_criadas, matchEquivalents),
    participacao_gols_90:perTeam90(totals.participacao_gols, matchEquivalents),
    remates_90:perTeam90(totals.remates, matchEquivalents),
    remates_golo_pct:weightedPercent(players, 'remates', 'remates_golo_pct', 'remates_no_alvo'),
    conversao_gols_pct:shots ? round(goals * 100 / shots, 1) : null,
    passes_chave_90:perTeam90(totals.passes_chave, matchEquivalents),
    passes_prog_90:perTeam90(totals.passes_prog, matchEquivalents),
    passes_prog_pct:weightedPercent(players, 'passes_prog', 'passes_prog_pct', 'passes_prog_precisos'),
    passes_area_90:perTeam90(totals.passes_area, matchEquivalents),
    passes_area_pct:weightedPercent(players, 'passes_area', 'passes_area_pct', 'passes_area_precisos'),
    entradas_terco_passe_90:perTeam90(totals.entradas_terco_passe, matchEquivalents),
    dribles_90:perTeam90(totals.dribles, matchEquivalents),
    dribles_pct:weightedPercent(players, 'dribles', 'dribles_pct'),
    conducoes_90:perTeam90(totals.conducoes, matchEquivalents),
    duelos_def_90:perTeam90(totals.duelos_def, matchEquivalents),
    duelos_def_pct:weightedPercent(players, 'duelos_def', 'duelos_def_pct'),
    desarmes_90:perTeam90(totals.desarmes, matchEquivalents),
    desarmes_pct:weightedPercent(players, 'desarmes', 'desarmes_pct'),
    intercecoes_90:perTeam90(totals.intercecoes, matchEquivalents),
    recuperacoes_90:perTeam90(totals.recuperacoes, matchEquivalents),
    recuperacoes_campo_adversario_90:perTeam90(totals.recuperacoes_campo_adversario, matchEquivalents),
    duelos_aereos_pct:weightedPercent(players, 'duelos_aereos', 'duelos_aereos_pct'),
    perdas_bola_90:perTeam90(totals.perdas_bola, matchEquivalents),
    perdas_campo_proprio_90:perTeam90(totals.perdas_campo_proprio, matchEquivalents),
    erros_chances_gol_90:perTeam90(totals.erros_chances_gol, matchEquivalents),
    erros_gol_90:perTeam90(totals.erros_gol, matchEquivalents),
    goals_top3_share:shareTop(players, 'gols'),
    xg_top3_share:shareTop(players, 'xg'),
    creation_top3_share:shareTop(players, 'chances_criadas'),
  }
}

export function aggregateSportsbaseTeams(players = []) {
  const grouped = new Map()
  for (const player of players) {
    const team = String(player?.equipa || '').trim()
    if (!team) continue
    if (!grouped.has(team)) grouped.set(team, [])
    grouped.get(team).push(player)
  }
  const teams = [...grouped.entries()].map(([team, teamPlayers]) => aggregateSportsbaseTeam(team, teamPlayers))
  return enrichSportsbaseTeams(teams)
}

export function enrichSportsbaseTeams(teams = []) {
  const metricDefs = Object.fromEntries(SPORTSBASE_TEAM_METRICS.map(metric=>[metric.key,metric]))
  const withPercentiles = teams.map(team => {
    const metricPercentiles = {}
    for (const metric of SPORTSBASE_TEAM_METRICS) {
      const values = teams.map(item=>item[metric.key]).filter(Number.isFinite)
      metricPercentiles[metric.key] = calculateSportsbasePercentile(team[metric.key], values, metric.higherIsBetter)
    }
    const dimensions = {}
    for (const [key, dimension] of Object.entries(SPORTSBASE_TEAM_DIMENSIONS)) {
      const values = dimension.metrics.map(metricKey=>metricPercentiles[metricKey]).filter(Number.isFinite)
      dimensions[key] = values.length ? round(values.reduce((sum,value)=>sum+value,0)/values.length,0) : null
    }
    const dimensionValues = Object.values(dimensions).filter(Number.isFinite)
    const profileScore = dimensionValues.length ? round(dimensionValues.reduce((sum,value)=>sum+value,0)/dimensionValues.length,1) : null
    return { ...team, metric_percentiles:metricPercentiles, dimensions, profile_score:profileScore }
  })

  return withPercentiles
    .sort((a,b)=>(b.profile_score||0)-(a.profile_score||0))
    .map((team,index)=>({ ...team, profile_rank:index+1, metric_definitions:metricDefs }))
}

export function getSportsbaseTeamPlayers(players = [], teamName = '') {
  const normalized = decodeURIComponent(String(teamName || '')).toLocaleLowerCase('pt-BR')
  return players.filter(player=>String(player?.equipa||'').toLocaleLowerCase('pt-BR')===normalized)
}

export function getSportsbaseTeamLeaders(players = []) {
  const definitions = [
    { key:'gols', label:'Gols', higherIsBetter:true },
    { key:'xg', label:'xG', higherIsBetter:true },
    { key:'assistencias', label:'Assistências', higherIsBetter:true },
    { key:'chances_criadas', label:'Chances criadas', higherIsBetter:true },
    { key:'passes_prog', label:'Passes progressivos', higherIsBetter:true },
    { key:'dribles', label:'Dribles', higherIsBetter:true },
    { key:'recuperacoes', label:'Recuperações', higherIsBetter:true },
  ]
  return definitions.map(definition=>({
    ...definition,
    players:[...players]
      .filter(player=>Number.isFinite(Number(player?.[definition.key])))
      .sort((a,b)=>Number(b[definition.key])-Number(a[definition.key]))
      .slice(0,5)
      .map(player=>({ nome:player.nome, posicao:player.posicao, minutos:player.minutos, value:Number(player[definition.key])||0 })),
  }))
}
