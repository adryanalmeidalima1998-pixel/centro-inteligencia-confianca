import { calculateSportsbasePercentile, getMetricEligibility } from '@/data/sportsbase-map'
import { SPORTSBASE_SELECTION_ROLES, getRoleSuitability } from '@/data/sportsbase-selection'
import { getWyscoutMetric } from '@/data/wyscout-map'
import { adaptiveRolePool, calibrateRoleCandidates } from '@/data/selection-score-utils'

const round = (value, decimals = 1) => {
  const factor = 10 ** decimals
  return Math.round((Number(value) || 0) * factor) / factor
}

const ROLE_METRICS = {
  GK:[
    ['defesas_pct',.23],['gols_prevenidos_90',.20],['gols_sofridos_90',.14],['xga_90',.10],
    ['clean_sheets_pct',.10],['saidas_90',.08],['passes_longos_pct',.08],['passes_tras_recebidos_gk_90',.07],
  ],
  LB:[
    ['duelos_def_pct',.14],['acoes_def_sucesso_90',.11],['intercecoes_90',.10],['cortes_90',.08],
    ['passes_prog_90',.13],['passes_prog_pct',.09],['cruzamentos_90',.10],['cruzamentos_pct',.08],
    ['corridas_progressivas_90',.09],['passes_area_90',.08],
  ],
  CBL:[
    ['duelos_def_pct',.17],['duelos_aereos_pct',.16],['acoes_def_sucesso_90',.13],['intercecoes_90',.13],
    ['cortes_90',.10],['passes_prog_90',.11],['passes_prog_pct',.09],['passes_longos_pct',.07],['faltas_90',.04],
  ],
  CBR:[
    ['duelos_def_pct',.17],['duelos_aereos_pct',.16],['acoes_def_sucesso_90',.13],['intercecoes_90',.13],
    ['cortes_90',.10],['passes_prog_90',.11],['passes_prog_pct',.09],['passes_longos_pct',.07],['faltas_90',.04],
  ],
  RB:[
    ['duelos_def_pct',.14],['acoes_def_sucesso_90',.11],['intercecoes_90',.10],['cortes_90',.08],
    ['passes_prog_90',.13],['passes_prog_pct',.09],['cruzamentos_90',.10],['cruzamentos_pct',.08],
    ['corridas_progressivas_90',.09],['passes_area_90',.08],
  ],
  DM:[
    ['acoes_def_sucesso_90',.14],['intercecoes_90',.13],['duelos_def_pct',.12],['cortes_90',.08],
    ['passes_prog_90',.14],['passes_prog_pct',.10],['passes_pct',.08],['passes_longos_pct',.07],
    ['passes_tercofinal_90',.08],['faltas_90',.06],
  ],
  CM:[
    ['passes_prog_90',.14],['passes_prog_pct',.10],['passes_chave_90',.11],['assist_remate_90',.11],
    ['passes_tercofinal_90',.09],['passes_area_90',.07],['passes_pct',.08],['acoes_def_sucesso_90',.08],
    ['corridas_progressivas_90',.07],['xa_90',.05],['assistencias_90',.05],['faltas_90',.05],
  ],
  AM:[
    ['assist_remate_90',.15],['passes_chave_90',.14],['xa_90',.12],['passes_inteligentes_90',.10],
    ['passes_area_90',.10],['assistencias_90',.10],['passes_prog_90',.08],['dribles_90',.07],
    ['dribles_pct',.05],['corridas_progressivas_90',.05],['gols_90',.04],
  ],
  LW:[
    ['dribles_90',.13],['dribles_pct',.10],['duelos_of_pct',.08],['corridas_progressivas_90',.10],
    ['aceleracoes_90',.08],['passes_chave_90',.09],['passes_area_90',.08],['gols_90',.10],
    ['xg_90',.08],['assistencias_90',.07],['remates_golo_pct',.05],['toques_area_90',.04],
  ],
  CF:[
    ['gols_90',.18],['xg_90',.16],['gols_sem_penalti_90',.10],['remates_90',.10],
    ['remates_golo_pct',.09],['conversao_gols_pct',.08],['toques_area_90',.09],['gols_cabeca_90',.06],
    ['duelos_aereos_pct',.07],['assist_remate_90',.04],['faltas_sofridas_90',.03],
  ],
  RW:[
    ['dribles_90',.13],['dribles_pct',.10],['duelos_of_pct',.08],['corridas_progressivas_90',.10],
    ['aceleracoes_90',.08],['passes_chave_90',.09],['passes_area_90',.08],['gols_90',.10],
    ['xg_90',.08],['assistencias_90',.07],['remates_golo_pct',.05],['toques_area_90',.04],
  ],
}

function rolePool(players, role) {
  return adaptiveRolePool(players, { ...role, suitability:player=>getRoleSuitability(player, role) })
}

function scoreRole(players, role) {
  const pool = rolePool(players,role)
  const metrics = ROLE_METRICS[role.slot] || []
  const totalWeight = metrics.reduce((sum,[,weight])=>sum+weight,0)
  const values = {}
  for (const [key] of metrics) {
    const metric = getWyscoutMetric(key)
    if (!metric) continue
    values[key] = pool.candidates
      .filter(player=>getMetricEligibility(player,metric,{players:pool.candidates,selectedMinimum:pool.minimumMinutes}).eligible)
      .map(player=>player[key])
  }

  const raw = pool.candidates.map(player=>{
    let weighted=0
    let covered=0
    const breakdown=[]
    for (const [key,weight] of metrics) {
      const metric=getWyscoutMetric(key)
      const metricValues=values[key] || []
      if (!metric || !metricValues.length) continue
      const eligibility=getMetricEligibility(player,metric,{players:pool.candidates,selectedMinimum:pool.minimumMinutes})
      if (!eligibility.eligible) continue
      const percentile=calculateSportsbasePercentile(player[key],metricValues,metric.higherIsBetter)
      if (!Number.isFinite(percentile)) continue
      weighted += percentile * weight
      covered += weight
      breakdown.push({key,label:metric.label,percentile,value:player[key],weight})
    }
    const coverage = totalWeight ? covered / totalWeight : 0
    if (!covered || coverage < .58) return null
    const performance = weighted / covered
    const suitability = getRoleSuitability(player,role)
    const ordered=[...breakdown].sort((a,b)=>b.percentile-a.percentile)
    return {
      ...player,
      _slot:role.slot,_role_label:role.label,_grupo:role.group,
      _raw_performance:round(performance),
      _coverage:round(coverage*100,0),
      _suitability:round(suitability*100,0),
      _score_breakdown:breakdown,
      _strengths:ordered.filter(item=>item.percentile>=72).slice(0,3),
      _watchouts:[...breakdown].sort((a,b)=>a.percentile-b.percentile).filter(item=>item.percentile<=28).slice(0,2),
      _sample_minimum:pool.minimumMinutes,
      _sample_target:pool.sampleTarget,
      _source_model:'wyscout-role-percentiles',
    }
  }).filter(Boolean)

  return { ...pool, ranked:calibrateRoleCandidates(raw) }
}

export function buildWyscoutRolePools(players = []) {
  const rolePools={}
  const thresholds={}
  for (const role of SPORTSBASE_SELECTION_ROLES) {
    const scored=scoreRole(players,role)
    rolePools[role.slot]=scored
    thresholds[role.slot]={ label:role.label,limiar:scored.minimumMinutes,maxMin:scored.maxMinutes,pct:scored.factor,total:scored.ranked.length }
  }
  return { rolePools,thresholds }
}
