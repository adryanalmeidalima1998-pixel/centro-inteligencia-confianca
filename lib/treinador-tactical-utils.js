function clean(v=''){ return String(v ?? '').trim() }

export function yearFromDate(value){
  const text=clean(value)
  if(!text) return null
  const direct=text.match(/\b(19|20)\d{2}\b/)
  if(direct) return Number(direct[0])
  const parts=text.split(/[\/-]/).map(x=>Number(x))
  if(parts.length===3){
    const maybe=parts.find(x=>x>=1900&&x<=2200)
    if(maybe) return maybe
  }
  return null
}

export function lastTenYearCutoff(referenceYear=new Date().getFullYear()){
  const y=Number(referenceYear)||new Date().getFullYear()
  return y-9
}

export function filterCareerLastTenYears(career=[], referenceYear=new Date().getFullYear()){
  const cutoff=lastTenYearCutoff(referenceYear)
  return (Array.isArray(career)?career:[]).filter(spell=>{
    const start=yearFromDate(spell?.entrada)
    const endText=clean(spell?.saida).toLowerCase()
    const end=/atual|current|hoje/.test(endText) ? referenceYear : yearFromDate(spell?.saida)
    if(end && end>=cutoff) return true
    if(start && start>=cutoff) return true
    return false
  })
}

export function filterEvolutionLastTenYears(evolution=[], referenceYear=new Date().getFullYear()){
  const cutoff=lastTenYearCutoff(referenceYear)
  return (Array.isArray(evolution)?evolution:[])
    .filter(item=>{
      const y=Number(String(item?.temporada||'').match(/\d{4}/)?.[0]||0)
      return y>=cutoff && y<=referenceYear
    })
    .sort((a,b)=>Number(String(b.temporada).match(/\d{4}/)?.[0]||0)-Number(String(a.temporada).match(/\d{4}/)?.[0]||0))
}

function baseFormation(value=''){
  const text=clean(value)
  return text.match(/\b(\d(?:-\d+)+)\b/)?.[1] || text
}

export function rebuildTacticalMetrics(metrics={}, games=[]){
  const tacticalGames=(Array.isArray(games)?games:[]).filter(g=>{
    const t=clean(g?.tatica_wyscout || g?.tatica)
    return t && t!=='?' && t!=='—' && t!=='-'
  })

  const formationMap=new Map()
  const baseMap=new Map()
  const seasonMap=new Map()

  for(const game of tacticalGames){
    const tactic=clean(game?.tatica_wyscout || game?.tatica)
    if(!tactic) continue
    formationMap.set(tactic,(formationMap.get(tactic)||0)+1)
    const base=baseFormation(tactic)
    baseMap.set(base,(baseMap.get(base)||0)+1)

    const season=clean(game?.temporada) || String(yearFromDate(game?.data)||'')
    if(!season) continue
    const current=seasonMap.get(season) || {temporada:season,jogos:0,formacoes:new Map(),clubes:new Map()}
    current.jogos++
    current.formacoes.set(tactic,(current.formacoes.get(tactic)||0)+1)
    const club=clean(game?.clube_treinador || game?.equipe || game?.team)
    if(club) current.clubes.set(club,(current.clubes.get(club)||0)+1)
    seasonMap.set(season,current)
  }

  const total=tacticalGames.length
  const formacoes=[...formationMap.entries()].sort((a,b)=>b[1]-a[1]).map(([formacao,jogos])=>({
    formacao,jogos,percentual:total?Math.round(jogos/total*1000)/10:0
  }))
  const esquemas_base=[...baseMap.entries()].sort((a,b)=>b[1]-a[1]).map(([formacao,jogos])=>({
    formacao,jogos,percentual:total?Math.round(jogos/total*1000)/10:0
  }))
  const evolucao_tatica=[...seasonMap.values()]
    .map(x=>({
      temporada:x.temporada,
      jogos:x.jogos,
      clubes:[...x.clubes.entries()].sort((a,b)=>b[1]-a[1]).map(([clube])=>clube).slice(0,3),
      formacoes:[...x.formacoes.entries()].sort((a,b)=>b[1]-a[1]).map(([formacao,jogos])=>({formacao,jogos})).slice(0,5)
    }))
    .sort((a,b)=>Number(String(b.temporada).match(/\d{4}/)?.[0]||0)-Number(String(a.temporada).match(/\d{4}/)?.[0]||0))

  return {
    ...(metrics||{}),
    jogos_com_formacao:total || Number(metrics?.jogos_com_formacao||0),
    formacoes:formacoes.length?formacoes:(metrics?.formacoes||[]),
    esquemas_base:esquemas_base.length?esquemas_base:(metrics?.esquemas_base||[]),
    evolucao_tatica:evolucao_tatica.length?evolucao_tatica:(metrics?.evolucao_tatica||[])
  }
}
