import { calculateSportsbasePercentile } from '@/data/sportsbase-map'
import { getPlayerFoot } from '@/data/player-foot'
import { getWyscoutPositionGroup } from '@/data/wyscout-map'

const num=value=>Number.isFinite(Number(value))?Number(value):0
const round=(value,decimals=2)=>{const factor=10**decimals;return Math.round((Number(value)||0)*factor)/factor}

function perMatch(squad,key,matches){
  const total=squad.reduce((sum,player)=>sum+num(player[key])*num(player.minutos)/90,0)
  return matches?total/matches:0
}
function weightedPercent(squad,percentKey,attemptKey){
  let made=0,attempts=0
  for(const player of squad){const attempt=num(player[attemptKey]);const pct=num(player[percentKey]);if(attempt<=0)continue;attempts+=attempt;made+=attempt*pct/100}
  return attempts?made/attempts*100:0
}


export const WYSCOUT_TEAM_DIMENSIONS = {
  producao:{label:'Produção ofensiva'}, criacao:{label:'Criação'}, progressao:{label:'Progressão'},
  defesa:{label:'Defesa'}, distribuicao:{label:'Distribuição'},
}

export const WYSCOUT_TEAM_METRICS = [
  {key:'gols_90',label:'Gols por jogo',group:'Produção'}, {key:'xg_90',label:'xG por jogo',group:'Produção'},
  {key:'remates_90',label:'Chutes por jogo',group:'Produção'}, {key:'remates_golo_pct',label:'Chutes no alvo',group:'Produção',percent:true},
  {key:'assist_remate_90',label:'Passes para finalização por jogo',group:'Criação'}, {key:'passes_chave_90',label:'Passes-chave por jogo',group:'Criação'},
  {key:'xa_90',label:'xA por jogo',group:'Criação'}, {key:'passes_area_90',label:'Passes para a área por jogo',group:'Criação'},
  {key:'passes_prog_90',label:'Passes progressivos por jogo',group:'Progressão'}, {key:'passes_prog_pct',label:'Precisão progressiva',group:'Progressão',percent:true},
  {key:'corridas_progressivas_90',label:'Corridas progressivas por jogo',group:'Progressão'}, {key:'dribles_90',label:'Dribles por jogo',group:'Progressão'},
  {key:'acoes_def_sucesso_90',label:'Ações defensivas com sucesso por jogo',group:'Defesa'}, {key:'intercecoes_90',label:'Interceptações por jogo',group:'Defesa'},
  {key:'duelos_def_pct',label:'Duelos defensivos ganhos',group:'Defesa',percent:true}, {key:'duelos_aereos_pct',label:'Duelos aéreos ganhos',group:'Defesa',percent:true},
  {key:'passes_pct',label:'Precisão de passe',group:'Distribuição',percent:true}, {key:'passes_frente_pct',label:'Precisão para frente',group:'Distribuição',percent:true},
  {key:'passes_longos_pct',label:'Precisão longa',group:'Distribuição',percent:true}, {key:'passes_tercofinal_pct',label:'Precisão no terço final',group:'Distribuição',percent:true},
]

const DIMENSIONS={
  producao:[['gols_90',true],['xg_90',true],['remates_90',true],['remates_golo_pct',true]],
  criacao:[['assist_remate_90',true],['passes_chave_90',true],['xa_90',true],['passes_area_90',true]],
  progressao:[['passes_prog_90',true],['passes_prog_pct',true],['corridas_progressivas_90',true],['dribles_90',true]],
  defesa:[['acoes_def_sucesso_90',true],['intercecoes_90',true],['duelos_def_pct',true],['duelos_aereos_pct',true]],
  distribuicao:[['passes_pct',true],['passes_frente_pct',true],['passes_longos_pct',true],['passes_tercofinal_pct',true]],
}

export function aggregateWyscoutTeams(players=[]){
  const grouped=new Map()
  for(const player of players){const team=String(player.equipa||'').trim();if(!team)continue;if(!grouped.has(team))grouped.set(team,[]);grouped.get(team).push(player)}
  const teams=[...grouped.entries()].map(([team_name,squad])=>{
    const hasGoalkeeper=squad.some(player=>getWyscoutPositionGroup(player.posicao)==='GK')
    const minuteBasis=hasGoalkeeper?990:900
    const totalMinutes=squad.reduce((sum,p)=>sum+num(p.minutos),0)
    const matchEquivalents=Math.max(1,totalMinutes/minuteBasis)
    const u23Minutes=squad.filter(p=>num(p.idade)>0&&num(p.idade)<=23).reduce((sum,p)=>sum+num(p.minutos),0)
    const feet=squad.reduce((acc,p)=>{const foot=getPlayerFoot(p);acc[foot]=(acc[foot]||0)+1;return acc},{direito:0,esquerdo:0,ambos:0,unknown:0})
    const positions=squad.reduce((acc,p)=>{const group=getWyscoutPositionGroup(p.posicao)||'OUTRO';acc[group]=(acc[group]||0)+1;return acc},{})
    const ageMinutes=squad.filter(p=>num(p.idade)>0).reduce((sum,p)=>sum+num(p.idade)*num(p.minutos),0)
    const validAgeMinutes=squad.filter(p=>num(p.idade)>0).reduce((sum,p)=>sum+num(p.minutos),0)
    const goalsTotal=squad.reduce((sum,p)=>sum+num(p.gols),0)
    const xgTotal=squad.reduce((sum,p)=>sum+num(p.xg),0)
    const creationValues=squad.map(p=>num(p.assist_remate_90)*num(p.minutos)/90).sort((a,b)=>b-a)
    const topShare=(values,total)=>total?values.slice(0,3).reduce((a,b)=>a+b,0)/total*100:0
    const team={
      team_name,players_total:squad.length,players_450:squad.filter(p=>num(p.minutos)>=450).length,
      match_equivalents:round(matchEquivalents,2),minute_basis:minuteBasis,u23_minutes_pct:totalMinutes?round(u23Minutes/totalMinutes*100,1):0,preferred_feet:feet,positions,avg_age:validAgeMinutes?round(ageMinutes/validAgeMinutes,1):0,
      goals_top3_share:round(topShare(squad.map(p=>num(p.gols)).sort((a,b)=>b-a),goalsTotal),1),
      xg_top3_share:round(topShare(squad.map(p=>num(p.xg)).sort((a,b)=>b-a),xgTotal),1),
      creation_top3_share:round(topShare(creationValues,creationValues.reduce((a,b)=>a+b,0)),1),
      gols_90:round(perMatch(squad,'gols_90',matchEquivalents)),xg_90:round(perMatch(squad,'xg_90',matchEquivalents)),
      assistencias_90:round(perMatch(squad,'assistencias_90',matchEquivalents)),remates_90:round(perMatch(squad,'remates_90',matchEquivalents)),
      assist_remate_90:round(perMatch(squad,'assist_remate_90',matchEquivalents)),passes_chave_90:round(perMatch(squad,'passes_chave_90',matchEquivalents)),
      passes_prog_90:round(perMatch(squad,'passes_prog_90',matchEquivalents)),passes_area_90:round(perMatch(squad,'passes_area_90',matchEquivalents)),
      corridas_progressivas_90:round(perMatch(squad,'corridas_progressivas_90',matchEquivalents)),dribles_90:round(perMatch(squad,'dribles_90',matchEquivalents)),
      acoes_def_sucesso_90:round(perMatch(squad,'acoes_def_sucesso_90',matchEquivalents)),intercecoes_90:round(perMatch(squad,'intercecoes_90',matchEquivalents)),
      xa_90:round(perMatch(squad,'xa_90',matchEquivalents)),
      remates_golo_pct:round(weightedPercent(squad,'remates_golo_pct','remates')),
      passes_pct:round(weightedPercent(squad,'passes_pct','passes')),
      passes_frente_pct:round(weightedPercent(squad,'passes_frente_pct','passes_frente')),
      passes_longos_pct:round(weightedPercent(squad,'passes_longos_pct','passes_longos')),
      passes_tercofinal_pct:round(weightedPercent(squad,'passes_tercofinal_pct','passes_tercofinal')),
      passes_prog_pct:round(weightedPercent(squad,'passes_prog_pct','passes_prog')),
      duelos_def_pct:round(weightedPercent(squad,'duelos_def_pct','duelos_def')),
      duelos_aereos_pct:round(weightedPercent(squad,'duelos_aereos_pct','duelos_aereos')),
    }
    return team
  })

  const metricPercentiles={}
  const allMetricKeys=[...new Set(Object.values(DIMENSIONS).flatMap(items=>items.map(([key])=>key)))]
  for(const key of allMetricKeys){const values=teams.map(team=>team[key]);metricPercentiles[key]=values}
  for(const team of teams){
    team.metric_percentiles={}
    for(const key of allMetricKeys)team.metric_percentiles[key]=calculateSportsbasePercentile(team[key],metricPercentiles[key],true)
    team.dimensions={}
    for(const [dimension,items] of Object.entries(DIMENSIONS)){
      const values=items.map(([key])=>team.metric_percentiles[key]).filter(Number.isFinite)
      team.dimensions[dimension]=values.length?round(values.reduce((a,b)=>a+b,0)/values.length,0):0
    }
    const dimensions=Object.values(team.dimensions).filter(Number.isFinite)
    team.profile_score=dimensions.length?round(dimensions.reduce((a,b)=>a+b,0)/dimensions.length,0):0
  }
  teams.sort((a,b)=>b.profile_score-a.profile_score)
  teams.forEach((team,index)=>team.profile_rank=index+1)
  return teams
}

export function getWyscoutTeamPlayers(players=[],teamName=''){
  const normalized=String(teamName).toLocaleLowerCase('pt-BR')
  return players.filter(player=>String(player.equipa||'').toLocaleLowerCase('pt-BR')===normalized)
}
