import {
  calculateSportsbasePercentile,
  getMetricEligibility,
  getSportsbaseMetric,
  getSportsbasePositionGroup,
  getSuggestedMinimumMinutes,
} from '@/data/sportsbase-map'
import { buildScoutingPlayer } from '@/data/sportsbase-scouting'
import {
  getSuggestedWyscoutMinimumMinutes,
  getWyscoutMetric,
  getWyscoutPositionGroup,
} from '@/data/wyscout-map'

export { encodePlayerKey, decodePlayerKey, playerProfilePath } from '@/data/player-route'

const RADAR_BY_GROUP = {
  GK: ['minutos', 'jogos'],
  CB: ['duelos_def_pct', 'desarmes_90', 'intercecoes_90', 'recuperacoes_90', 'duelos_aereos_pct', 'passes_prog_90'],
  FB: ['duelos_def_pct', 'desarmes_90', 'recuperacoes_90', 'passes_prog_90', 'passes_area_90', 'conducoes_90'],
  DM: ['duelos_def_pct', 'recuperacoes_90', 'intercecoes_90', 'passes_prog_90', 'passes_pct', 'perdas_bola_90'],
  AM: ['chances_criadas_90', 'passes_chave_90', 'passes_prog_90', 'assistencias_90', 'dribles_90', 'perdas_bola_90'],
  WG: ['gols_90', 'assistencias_90', 'dribles_90', 'dribles_pct', 'acoes_area_90', 'passes_chave_90'],
  ST: ['gols_90', 'xg_90', 'remates_90', 'remates_golo_pct', 'acoes_area_90', 'duelos_aereos_pct'],
}

const FALLBACK_METRICS = ['gols_90', 'xg_90', 'assistencias_90', 'passes_prog_90', 'dribles_90', 'recuperacoes_90']

function average(values = []) {
  const clean = values.map(Number).filter(Number.isFinite)
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null
}

function sportsbaseGroup(player) {
  return getSportsbasePositionGroup(player?.posicao) || player?.grupo_posicional || null
}

function eligibleValues(pool, metric, minimum) {
  return pool
    .filter(item => getMetricEligibility(item, metric, { players: pool, selectedMinimum: minimum }).eligible)
    .map(item => Number(item?.[metric.key]))
    .filter(Number.isFinite)
}

function sharedPercentile(value, values, higherIsBetter = true) {
  if (!Number.isFinite(Number(value)) || !values.length) return null
  return calculateSportsbasePercentile(Number(value), values, higherIsBetter)
}

export function buildSportsbaseProfilePayload(player, leaguePlayers = [], clubPlayers = [], model = null) {
  const group = sportsbaseGroup(player)
  const leagueGroup = leaguePlayers.filter(item => sportsbaseGroup(item) === group)
  const clubGroup = clubPlayers.filter(item => sportsbaseGroup(item) === group)
  const minimum = getSuggestedMinimumMinutes(leagueGroup.length ? leagueGroup : leaguePlayers)
  const keys = RADAR_BY_GROUP[group] || FALLBACK_METRICS
  const radar = []

  for (const key of keys) {
    const metric = getSportsbaseMetric(key)
    if (!metric) continue
    const leagueValues = eligibleValues(leagueGroup, metric, minimum)
    const playerEligible = getMetricEligibility(player, metric, { players: leagueGroup, selectedMinimum: minimum })
    const playerValue = Number(player?.[key])
    const leaguePercentile = playerEligible.eligible
      ? sharedPercentile(playerValue, leagueValues, metric.higherIsBetter !== false)
      : null

    const combined = [...leagueGroup, ...clubGroup]
    const combinedMinimum = getSuggestedMinimumMinutes(combined.length ? combined : leagueGroup)
    const combinedValues = eligibleValues(combined, metric, combinedMinimum)
    const playerCombinedEligible = getMetricEligibility(player, metric, { players: combined, selectedMinimum: combinedMinimum })
    const playerVsClub = playerCombinedEligible.eligible
      ? sharedPercentile(playerValue, combinedValues, metric.higherIsBetter !== false)
      : null
    const clubPercentiles = clubGroup.map(item => {
      const eligibility = getMetricEligibility(item, metric, { players: combined, selectedMinimum: combinedMinimum })
      return eligibility.eligible
        ? sharedPercentile(Number(item?.[key]), combinedValues, metric.higherIsBetter !== false)
        : null
    }).filter(Number.isFinite)

    radar.push({
      key,
      label: metric.label.replace('/90', '').replace('Precisão dos ', '').replace(' bem-sucedidos', ''),
      fullLabel: metric.label,
      type: metric.type,
      value: Number.isFinite(playerValue) ? playerValue : null,
      leaguePercentile,
      playerVsClub,
      clubAverage: clubPercentiles.length ? Math.round(average(clubPercentiles)) : null,
      eligible: playerEligible.eligible,
      reason: playerEligible.reason || null,
      higherIsBetter: metric.higherIsBetter !== false,
    })
  }

  const scouting = buildScoutingPlayer(player, leagueGroup.length ? leagueGroup : leaguePlayers, model, minimum)
  const centralStats = [
    'gols_90', 'xg_90', 'assistencias_90', 'chances_criadas_90', 'remates_90', 'remates_golo_pct',
    'passes_chave_90', 'passes_prog_90', 'dribles_90', 'duelos_def_pct', 'recuperacoes_90', 'perdas_bola_90',
  ].map(key => {
    const metric = getSportsbaseMetric(key)
    return metric ? { ...metric, value: player?.[key] ?? null } : null
  }).filter(Boolean)

  return {
    source: 'sportsbase',
    group,
    groupSize: leagueGroup.length,
    clubGroupSize: clubGroup.length,
    minimumMinutes: minimum,
    radar,
    centralStats,
    scouting: scouting._scouting,
    methodology: 'Percentis posicionais com elegibilidade por minutos e, nos percentuais, mínimo de tentativas. O fit combina perfil funcional, modelo do Confiança e confiança da amostra.',
  }
}

function basicPercentile(value, pool, key, higher = true) {
  const values = pool.map(item => Number(item?.[key])).filter(Number.isFinite).sort((a, b) => a - b)
  if (!Number.isFinite(Number(value)) || !values.length) return null
  return calculateSportsbasePercentile(Number(value), values, higher)
}

const WYSCOUT_RADAR_BY_GROUP = {
  GK:['defesas_pct','gols_prevenidos_90','gols_sofridos_90','xga_90','clean_sheets_pct','passes_longos_pct'],
  CB:['duelos_def_pct','duelos_aereos_pct','acoes_def_sucesso_90','intercecoes_90','passes_prog_90','passes_prog_pct'],
  FB:['duelos_def_pct','intercecoes_90','passes_prog_90','passes_prog_pct','cruzamentos_90','cruzamentos_pct'],
  DM:['acoes_def_sucesso_90','intercecoes_90','duelos_def_pct','passes_prog_90','passes_prog_pct','passes_pct'],
  AM:['assist_remate_90','passes_chave_90','xa_90','passes_prog_90','assistencias_90','dribles_90'],
  WG:['gols_90','assistencias_90','dribles_90','dribles_pct','passes_chave_90','corridas_progressivas_90'],
  ST:['gols_90','xg_90','remates_90','remates_golo_pct','toques_area_90','duelos_aereos_pct'],
}

const WYSCOUT_CENTRAL_KEYS = [
  'gols_90','xg_90','assistencias_90','assist_remate_90','remates_90','remates_golo_pct',
  'passes_chave_90','passes_prog_90','dribles_90','duelos_def_pct','intercecoes_90','duelos_aereos_pct',
]

export function buildWyscoutProfilePayload(player, leaguePlayers = [], clubPlayers = [], model = null) {
  const group = getWyscoutPositionGroup(player?.posicao)
  const leagueGroup = leaguePlayers.filter(item => getWyscoutPositionGroup(item?.posicao) === group)
  const clubGroup = clubPlayers.filter(item => sportsbaseGroup(item) === group)
  const minimum = getSuggestedWyscoutMinimumMinutes(leagueGroup.length ? leagueGroup : leaguePlayers)
  const keys = WYSCOUT_RADAR_BY_GROUP[group] || WYSCOUT_CENTRAL_KEYS.slice(0,6)
  const radar = []

  for (const key of keys) {
    const metric = getWyscoutMetric(key)
    if (!metric) continue
    const leagueEligible = leagueGroup.filter(item => getMetricEligibility(item, metric, { players:leagueGroup, selectedMinimum:['total','index'].includes(metric.type)?0:minimum }).eligible)
    const leagueValues = leagueEligible.map(item=>Number(item[key])).filter(Number.isFinite)
    const playerEligibility = getMetricEligibility(player, metric, { players:leagueGroup, selectedMinimum:['total','index'].includes(metric.type)?0:minimum })
    const leaguePercentile = playerEligibility.eligible
      ? calculateSportsbasePercentile(player[key], leagueValues, metric.higherIsBetter)
      : null

    const combined = [...leagueGroup, ...clubGroup].filter(item=>Number.isFinite(Number(item?.[key])))
    const combinedValues = combined.map(item=>Number(item[key])).filter(Number.isFinite)
    const playerVsClub = combinedValues.length
      ? calculateSportsbasePercentile(player[key], combinedValues, metric.higherIsBetter)
      : null
    const clubPercentiles = clubGroup.map(item=>Number.isFinite(Number(item?.[key]))
      ? calculateSportsbasePercentile(item[key],combinedValues,metric.higherIsBetter)
      : null).filter(Number.isFinite)

    radar.push({
      key,label:metric.label.replace('/90','').replace('Precisão dos ','').replace(' bem-sucedidos',''),
      fullLabel:metric.label,type:metric.type,value:player?.[key] ?? null,
      leaguePercentile,playerVsClub,clubAverage:clubPercentiles.length?Math.round(average(clubPercentiles)):null,
      eligible:playerEligibility.eligible,reason:playerEligibility.reason || null,higherIsBetter:metric.higherIsBetter !== false,
    })
  }

  const validLeague = radar.map(item=>item.leaguePercentile).filter(Number.isFinite)
  const performance = Math.round(average(validLeague) || 0)
  const sample = Math.min(100,Math.round(45+55*Math.min(1,(Number(player.minutos)||0)/Math.max(900,minimum*2))))
  const coverage = Math.round((validLeague.length / Math.max(1,radar.length))*100)
  const age = Number(player.idade)
  const development = !Number.isFinite(age)?55:Math.max(25,Math.min(100,105-Math.max(0,age-19)*5))
  const tactical = Array.isArray(model?.recruitmentMetrics)
    ? Math.round(average(model.recruitmentMetrics.map(key=>radar.find(item=>item.key===key)?.leaguePercentile).filter(Number.isFinite)) || 55)
    : 55
  const fit = Math.round(performance*.55+tactical*.20+sample*.15+development*.10)
  const ordered=[...radar].filter(item=>Number.isFinite(item.leaguePercentile)).sort((a,b)=>b.leaguePercentile-a.leaguePercentile)

  return {
    source:'wyscout',group,groupSize:leagueGroup.length,clubGroupSize:clubGroup.length,minimumMinutes:minimum,radar,
    centralStats:WYSCOUT_CENTRAL_KEYS.map(key=>{const metric=getWyscoutMetric(key);return metric?{...metric,value:player?.[key]??null}:null}).filter(Boolean),
    scouting:{
      finalScore:fit,profile:`Wyscout · ${group || 'função'}`,profileScore:performance,tacticalScore:tactical,
      confidence:{label:sample>=80?'Alta':sample>=60?'Média':'Baixa',score:sample,color:sample>=80?'#15803d':sample>=60?'#c47b09':'#c53a32'},
      coverage,strengths:ordered.filter(item=>item.leaguePercentile>=70).slice(0,3).map(item=>({label:item.fullLabel,percentile:item.leaguePercentile,value:item.value})),
      concerns:[...ordered].reverse().filter(item=>item.leaguePercentile<=35).slice(0,3).map(item=>({label:item.fullLabel,percentile:item.leaguePercentile,value:item.value})),
      minimumMinutes:minimum,limited:false,
    },
    methodology:'Percentis Wyscout por grupo posicional, com corte adaptativo de minutos e mínimos de tentativas nos percentuais. O radar contra o Confiança usa somente métricas semanticamente equivalentes entre as fontes.',
  }
}
