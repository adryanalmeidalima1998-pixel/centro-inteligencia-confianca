import {
  calculateSportsbasePercentile,
  getMetricEligibility,
  getSportsbaseMetric,
  normalizeSportsbasePosition,
} from './sportsbase-map'

const round = (value, decimals = 1) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const ROLE = (slot, label, group, positions, fallback, metrics) => ({ slot, label, group, positions, fallback, metrics })

export const SPORTSBASE_SELECTION_ROLES = [
  ROLE('GK','Goleiro','GK',['GK'],[],[]),
  ROLE('LB','Lateral esquerdo','DEF',['LB','LWB'],['LCB','LM'],[
    ['duelos_def_pct',.14],['duelos_def_90',.10],['desarmes_pct',.10],['intercecoes_90',.10],
    ['passes_prog_90',.14],['passes_prog_pct',.10],['entradas_terco_passe_90',.08],['conducoes_90',.08],
    ['recuperacoes_90',.08],['perdas_campo_proprio_90',.08],
  ]),
  ROLE('CBL','Zagueiro esquerdo','DEF',['LCB','CB'],['LB'],[
    ['duelos_def_pct',.16],['duelos_aereos_pct',.15],['intercecoes_90',.14],['desarmes_pct',.10],
    ['recuperacoes_90',.10],['passes_prog_90',.12],['passes_prog_pct',.10],['passes_pct',.07],
    ['erros_chances_gol_90',.06],
  ]),
  ROLE('CBR','Zagueiro direito','DEF',['RCB','CB'],['RB'],[
    ['duelos_def_pct',.16],['duelos_aereos_pct',.15],['intercecoes_90',.14],['desarmes_pct',.10],
    ['recuperacoes_90',.10],['passes_prog_90',.12],['passes_prog_pct',.10],['passes_pct',.07],
    ['erros_chances_gol_90',.06],
  ]),
  ROLE('RB','Lateral direito','DEF',['RB','RWB'],['RCB','RM'],[
    ['duelos_def_pct',.14],['duelos_def_90',.10],['desarmes_pct',.10],['intercecoes_90',.10],
    ['passes_prog_90',.14],['passes_prog_pct',.10],['entradas_terco_passe_90',.08],['conducoes_90',.08],
    ['recuperacoes_90',.08],['perdas_campo_proprio_90',.08],
  ]),
  ROLE('DM','Volante','MID',['CDM','LCDM','RCDM','LDM','RDM','DMF','LDMF','RDMF'],['LCM','RCM','CMF'],[
    ['recuperacoes_90',.14],['intercecoes_90',.12],['duelos_def_pct',.12],['desarmes_pct',.08],
    ['passes_prog_90',.14],['passes_prog_pct',.10],['passes_pct',.08],['passes_longos_pct',.07],
    ['perdas_bola_90',.09],['perdas_campo_proprio_90',.06],
  ]),
  ROLE('CM','Meia central','MID',['LCM','RCM','CMF','LCMF','RCMF'],['CDM','CAM','LM','RM'],[
    ['passes_prog_90',.14],['passes_prog_pct',.10],['passes_chave_90',.12],['assist_remate_90',.10],
    ['passes_area_90',.08],['entradas_terco_passe_90',.08],['recuperacoes_90',.10],['conducoes_90',.08],
    ['participacao_gols_90',.08],['perdas_bola_90',.08],['passes_pct',.04],
  ]),
  ROLE('AM','Meia ofensivo','MID',['CAM','LCAM','RCAM','AMF'],['LM','RM','LCM','RCM'],[
    ['passes_chave_90',.16],['assist_remate_90',.12],['chances_criadas_90',.12],['assistencias_90',.10],
    ['passes_area_90',.10],['passes_prog_90',.08],['dribles_90',.08],['dribles_pct',.06],
    ['participacao_gols_90',.10],['perdas_bola_90',.08],
  ]),
  ROLE('LW','Extremo esquerdo','FWD',['LW','LWF','LAM','LAMF'],['LM','LCF'],[
    ['dribles_90',.14],['dribles_pct',.10],['dribles_tercofinal_90',.10],['conducoes_90',.08],
    ['passes_chave_90',.10],['passes_area_90',.08],['chances_criadas_90',.08],['gols_90',.10],
    ['xg_90',.08],['remates_golo_pct',.07],['participacao_gols_90',.07],
  ]),
  ROLE('CF','Centroavante','FWD',['CF','LCF','RCF'],['SS'],[
    ['gols_90',.18],['xg_90',.15],['conversao_gols_pct',.10],['remates_area_90',.12],
    ['remates_golo_pct',.10],['gols_cabeca_90',.07],['duelos_aereos_pct',.08],['acoes_area_90',.08],
    ['participacao_gols_90',.07],['passes_recebidos_area_90',.05],
  ]),
  ROLE('RW','Extremo direito','FWD',['RW','RWF','RAM','RAMF'],['RM','RCF'],[
    ['dribles_90',.14],['dribles_pct',.10],['dribles_tercofinal_90',.10],['conducoes_90',.08],
    ['passes_chave_90',.10],['passes_area_90',.08],['chances_criadas_90',.08],['gols_90',.10],
    ['xg_90',.08],['remates_golo_pct',.07],['participacao_gols_90',.07],
  ]),
]

const primaryPosition = player => normalizeSportsbasePosition(player?.posicao).split(',')[0]?.trim() || ''
const allPositions = player => normalizeSportsbasePosition(player?.posicao).split(',').map(item=>item.trim()).filter(Boolean)

export function getRoleSuitability(player, role) {
  const positions = allPositions(player)
  const primary = primaryPosition(player)
  if (role.positions.includes(primary)) return 1
  if (positions.some(position=>role.positions.includes(position))) return .96
  if (role.fallback.includes(primary)) return .88
  if (positions.some(position=>role.fallback.includes(position))) return .84
  return 0
}

function adaptiveRolePool(players, role) {
  const candidates = players.filter(player=>getRoleSuitability(player,role)>0)
  if (!candidates.length) return { candidates:[], minimumMinutes:0, maxMinutes:0, factor:0 }
  const maxMinutes = Math.max(...candidates.map(player=>Number(player.minutos)||0))
  const targetSize = role.slot==='GK' ? 3 : 7
  const factors = [.35,.30,.25,.20,.15,0]
  for (const factor of factors) {
    const minimumMinutes = factor ? Math.max(50, Math.round(maxMinutes*factor/50)*50) : 0
    const eligible = candidates.filter(player=>(Number(player.minutos)||0)>=minimumMinutes)
    if (eligible.length>=targetSize || factor===0) return { candidates:eligible, minimumMinutes, maxMinutes:Math.round(maxMinutes), factor }
  }
  return { candidates, minimumMinutes:0, maxMinutes:Math.round(maxMinutes), factor:0 }
}

function scoreRoleCandidates(players, role) {
  const poolInfo = adaptiveRolePool(players,role)
  if (!role.metrics.length) return { ...poolInfo, ranked:[] }
  const totalWeight = role.metrics.reduce((sum,[,weight])=>sum+weight,0)
  const valuesByMetric = {}

  for (const [metricKey] of role.metrics) {
    const metric = getSportsbaseMetric(metricKey)
    if (!metric) continue
    valuesByMetric[metricKey] = poolInfo.candidates
      .filter(player=>getMetricEligibility(player,metric,{players:poolInfo.candidates,selectedMinimum:poolInfo.minimumMinutes}).eligible)
      .map(player=>player[metricKey])
  }

  const ranked = poolInfo.candidates.map(player=>{
    let weightedScore=0
    let coveredWeight=0
    const breakdown=[]
    for (const [metricKey,weight] of role.metrics) {
      const metric=getSportsbaseMetric(metricKey)
      const values=valuesByMetric[metricKey]||[]
      if (!metric || !values.length) continue
      const eligibility=getMetricEligibility(player,metric,{players:poolInfo.candidates,selectedMinimum:poolInfo.minimumMinutes})
      if (!eligibility.eligible) continue
      const percentile=calculateSportsbasePercentile(player[metricKey],values,metric.higherIsBetter)
      if (!Number.isFinite(percentile)) continue
      weightedScore+=percentile*weight
      coveredWeight+=weight
      breakdown.push({ key:metricKey, label:metric.label, percentile, value:player[metricKey], weight })
    }

    const coverage=totalWeight?coveredWeight/totalWeight:0
    if (coverage<.52 || !coveredWeight) return null
    const performance=weightedScore/coveredWeight
    const suitability=getRoleSuitability(player,role)
    const sampleBase=Math.max(poolInfo.minimumMinutes*2,900)
    const sampleConfidence=Math.min(100,60+40*Math.min(1,(Number(player.minutos)||0)/sampleBase))
    const score=performance*.87+sampleConfidence*.08+suitability*100*.05
    const ordered=[...breakdown].sort((a,b)=>b.percentile-a.percentile)
    return {
      ...player,
      _slot:role.slot,
      _role_label:role.label,
      _grupo:role.group,
      _score:round(score,1),
      _performance_score:round(performance,1),
      _sample_confidence:round(sampleConfidence,0),
      _coverage:round(coverage*100,0),
      _suitability:round(suitability*100,0),
      _score_breakdown:breakdown,
      _strengths:ordered.filter(item=>item.percentile>=70).slice(0,3),
      _watchouts:[...breakdown].sort((a,b)=>a.percentile-b.percentile).filter(item=>item.percentile<=35).slice(0,2),
      _sample_minimum:poolInfo.minimumMinutes,
    }
  }).filter(Boolean).sort((a,b)=>b._score-a._score)

  return { ...poolInfo, ranked }
}

function pickTeam(rolePools, excluded = new Set()) {
  const availableRoles=SPORTSBASE_SELECTION_ROLES.map(role=>({
    role,
    ranked:(rolePools[role.slot]?.ranked||[]).filter(player=>!excluded.has(`${player.nome}|${player.equipa}`)),
  }))
  // Primeiro ocupamos as funções com menor oferta. Isso reduz improvisações e duplicidade de jogadores versáteis.
  availableRoles.sort((a,b)=>a.ranked.length-b.ranked.length)
  const used=new Set(excluded)
  const selected=[]
  for (const { role, ranked } of availableRoles) {
    const player=ranked.find(candidate=>!used.has(`${candidate.nome}|${candidate.equipa}`))
    if (!player) continue
    used.add(`${player.nome}|${player.equipa}`)
    selected.push({ ...player, _slot:role.slot, _role_label:role.label, _grupo:role.group })
  }
  return SPORTSBASE_SELECTION_ROLES.map(role=>selected.find(player=>player._slot===role.slot)).filter(Boolean)
}

export function buildSportsbaseSelections(players = []) {
  const rolePools={}
  const thresholds={}
  for (const role of SPORTSBASE_SELECTION_ROLES) {
    const scored=scoreRoleCandidates(players,role)
    rolePools[role.slot]=scored
    thresholds[role.slot]={
      label:role.label,
      limiar:scored.minimumMinutes,
      maxMin:scored.maxMinutes,
      pct:scored.factor,
      total:scored.ranked.length,
    }
  }

  const teamA=pickTeam(rolePools)
  const usedA=new Set(teamA.map(player=>`${player.nome}|${player.equipa}`))
  const teamB=pickTeam(rolePools,usedA)
  const usedAB=new Set([...usedA,...teamB.map(player=>`${player.nome}|${player.equipa}`)])
  const teamC=pickTeam(rolePools,usedAB)
  const totalEligible=new Set(Object.values(rolePools).flatMap(pool=>pool.ranked.map(player=>`${player.nome}|${player.equipa}`))).size

  return {
    teamA,teamB,teamC,thresholds,totalEligible,
    missingRoles:SPORTSBASE_SELECTION_ROLES.filter(role=>!(rolePools[role.slot]?.ranked||[]).length).map(role=>role.slot),
    methodology:'Score por função no 4-3-3: percentis Sportsbase nativos, pares volume/eficiência, mínimos de tentativas, cobertura mínima de 52%, adequação posicional e confiança de amostra.',
  }
}

/** Exposição controlada dos pools por função para outras seleções do CIC. */
export function buildSportsbaseRolePools(players = []) {
  const rolePools = {}
  const thresholds = {}
  for (const role of SPORTSBASE_SELECTION_ROLES) {
    const scored = scoreRoleCandidates(players, role)
    rolePools[role.slot] = scored
    thresholds[role.slot] = {
      label: role.label,
      limiar: scored.minimumMinutes,
      maxMin: scored.maxMinutes,
      pct: scored.factor,
      total: scored.ranked.length,
    }
  }
  return { rolePools, thresholds }
}
