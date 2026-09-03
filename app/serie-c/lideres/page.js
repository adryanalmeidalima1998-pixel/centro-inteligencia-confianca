'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Crown, Goal, Medal, Search, ShieldCheck, Sparkles } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import RoundSelector from '../_lib/RoundSelector'
import { useSerieCData } from '../_lib/useSerieCData'
import { MetricModeToggle, MinMinutesSelect, EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import { SectionHeader, FilterShell } from '../../components/serie-c/professional'
import { DashboardKpiCard, LeaderRows, Panel, PodiumCard } from '../../components/serie-c/competition'
import { DEFAULT_MIN_MINUTES, findMetricColumn, formatMetricValue, formatNumberBR, isVolumeMetric, per90, toNumber } from '../../../lib/serieC'
import {
  GOALKEEPER_CATEGORY_ORDER, PLAYER_CATEGORY_ORDER, goalkeeperMetricCategory, isContextMetric,
  metricEligibilityForRanking, metricHigherIsBetter, numericMetricKeys, playerMetricCategory,
} from '../../../lib/serieCMetricRegistry'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`

const TEAM_METRICS = [
  { metric:'Índice', category:'Geral' }, { metric:'Gols', category:'Ataque' }, { metric:'Chances de gol', category:'Ataque' },
  { metric:'Chutes', category:'Ataque' }, { metric:'Chutes no alvo, %', category:'Ataque' }, { metric:'Entradas no terço final', category:'Progressão' },
  { metric:'Entradas na área adversária', category:'Progressão' }, { metric:'Posse de bola, %', category:'Posse' }, { metric:'Passes precisos, %', category:'Posse' },
  { metric:'Passes progressivos', category:'Construção' }, { metric:'Passes para a área', category:'Construção' }, { metric:'Cruzamentos precisos, %', category:'Construção' },
  { metric:'Duelos ganhos, %', category:'Duelo' }, { metric:'Duelos defensivos ganhos, %', category:'Defesa' },
  { metric:'Recuperações da bola no campo adversário', category:'Pressão' }, { metric:'Pressão do time bem-sucedida, %', category:'Pressão' },
]
const TEAM_ALERTS = [{metric:'Perdas da bola',category:'Alertas'},{metric:'Faltas',category:'Alertas'},{metric:'Cartões amarelos',category:'Alertas'},{metric:'Cartões vermelhos',category:'Alertas'}]

function dynamicDefinitions(rows, entityType) {
  return numericMetricKeys(rows)
    .filter(metric => !isContextMetric(metric, entityType))
    .map(metric => ({ metric, category:entityType === 'goalkeeper' ? goalkeeperMetricCategory(metric) : playerMetricCategory(metric) }))
}

function buildLeaders(rows, definitions, { entityType=null, minutesRequired=false, minMinutes=0, mode='total', getName, getTeam, getFlag }={}) {
  const sample=rows[0]?.metrics
  return definitions.map(definition => {
    const col=findMetricColumn(sample,definition.metric)||definition.metric
    if(!col) return null
    const volume=isVolumeMetric(col)
    const eligible=rows.filter(row => {
      if(minutesRequired && toNumber(row.minutes)<minMinutes) return false
      if(entityType) return metricEligibilityForRanking(row,col,{entityType,minMinutes:minutesRequired?minMinutes:0}).eligible
      return true
    })
    const higher=entityType ? metricHigherIsBetter(col,entityType) : true
    const entries=eligible.map(row=>{
      const raw=toNumber(row.metrics?.[col]); const value=mode==='per90'&&volume&&minutesRequired?per90(raw,row.minutes):raw
      return value===null?null:{name:getName(row),team:getTeam?.(row),value,isClub:getFlag(row),per90Mode:mode==='per90'&&volume&&minutesRequired,row}
    }).filter(Boolean).sort((a,b)=>higher?b.value-a.value:a.value-b.value).slice(0,10)
    return entries.length?{...definition,col,entries,canPer90:volume&&minutesRequired}:null
  }).filter(Boolean)
}

export default function SerieCLideresPage(){
  const[round,setRound]=useState(null),[subTab,setSubTab]=useState('jogadores'),[mode,setMode]=useState('total'),[minMinutes,setMinMinutes]=useState(DEFAULT_MIN_MINUTES),[category,setCategory]=useState('Todas'),[search,setSearch]=useState('')
  const{data,loading,error,reload}=useSerieCData({round}); const players=data?.players||[],goalkeepers=data?.goalkeepers||[],teams=data?.teams||[]
  const playerDefs=useMemo(()=>dynamicDefinitions(players,'player'),[players]); const goalkeeperDefs=useMemo(()=>dynamicDefinitions(goalkeepers,'goalkeeper'),[goalkeepers])
  const playerLeaders=useMemo(()=>buildLeaders(players,playerDefs,{entityType:'player',minutesRequired:true,minMinutes,mode,getName:r=>r.player,getTeam:r=>r.team,getFlag:r=>r.is_club}),[players,playerDefs,minMinutes,mode])
  const goalkeeperLeaders=useMemo(()=>buildLeaders(goalkeepers,goalkeeperDefs,{entityType:'goalkeeper',minutesRequired:true,minMinutes,mode,getName:r=>r.player,getTeam:r=>r.team,getFlag:r=>r.is_club}),[goalkeepers,goalkeeperDefs,minMinutes,mode])
  const teamLeaders=useMemo(()=>buildLeaders(teams,TEAM_METRICS,{getName:r=>r.team,getTeam:()=>null,getFlag:r=>r.is_club}),[teams])
  const teamAlerts=useMemo(()=>buildLeaders(teams,TEAM_ALERTS,{getName:r=>r.team,getTeam:()=>null,getFlag:r=>r.is_club}),[teams])
  const current=subTab==='jogadores'?playerLeaders:subTab==='goleiros'?goalkeeperLeaders:teamLeaders
  const orderedCategories=subTab==='jogadores'?PLAYER_CATEGORY_ORDER:subTab==='goleiros'?GOALKEEPER_CATEGORY_ORDER:[]
  const availableCategories=useMemo(()=>['Todas',...orderedCategories.filter(c=>current.some(x=>x.category===c)),...Array.from(new Set(current.map(x=>x.category))).filter(c=>c&&!orderedCategories.includes(c))],[current,orderedCategories])
  const q=search.toLowerCase().trim(); const filtered=current.filter(item=>(category==='Todas'||item.category===category)&&(!q||item.metric.toLowerCase().includes(q)))
  const dominant=useMemo(()=>{const m=new Map();current.forEach(l=>l.entries.slice(0,5).forEach((e,i)=>{const x=m.get(`${e.name}__${e.team}`)||{name:e.name,team:e.team,isClub:e.isClub,points:0,appearances:0};x.points+=5-i;x.appearances++;m.set(`${e.name}__${e.team}`,x)}));return[...m.values()].sort((a,b)=>b.points-a.points||b.appearances-a.appearances).slice(0,8).map(x=>({...x,value:x.points}))},[current])
  const indexLeader=current.find(item=>String(item.metric).toLowerCase()==='índice'||String(item.metric).toLowerCase()==='indice'); const featured=indexLeader?.entries?.[0]
  const clubTopFive=useMemo(()=>current.reduce((sum,l)=>sum+l.entries.slice(0,5).filter(e=>e.isClub).length,0),[current]); const distinct=new Set(current.map(l=>l.entries[0]?.name).filter(Boolean)).size
  const kpis=[
    {label:'Rankings disponíveis',value:formatNumberBR(current.length),helper:subTab==='jogadores'?`${playerDefs.length} métricas detectadas`:subTab==='goleiros'?`${goalkeeperDefs.length} métricas detectadas`:'Clubes',icon:BarChart3,tone:'slate'},
    {label:'Líder de índice',value:featured?formatMetricValue(indexLeader?.col||'Índice',featured.value):'-',helper:featured?.name||'Sem dado',icon:Crown,tone:'amber'},
    {label:'Líderes diferentes',value:formatNumberBR(distinct),helper:'Primeiros lugares em fundamentos',icon:Medal},
    {label:'Confiança no Top-5',value:formatNumberBR(clubTopFive),helper:'Presenças somadas',icon:ShieldCheck},
    {label:'Minutagem mínima',value:subTab==='times'?'—':formatNumberBR(minMinutes),helper:subTab==='times'?'Não se aplica':'+ amostra mínima por eficiência',icon:Sparkles,tone:'blue'},
    {label:'Modo',value:mode==='per90'?'/90':'Total',helper:'Volume ajustável; percentuais mantidos',icon:Goal},
  ]
  return <AppShell><style>{STYLE}</style><SerieCTabs/><div className="space-y-6 p-4 md:p-8">
    <SectionHeader eyebrow="Hub de rankings" title="Líderes FM" description="Todos os fundamentos numéricos das novas planilhas, organizados por categoria e com controle de amostra para evitar líderes artificiais." right={<FilterShell><RoundSelector uploads={data?.uploads} currentRound={data?.upload?.round} onChange={setRound}/>{subTab!=='times'&&<MinMinutesSelect value={minMinutes} onChange={setMinMinutes} options={[180,300,450,600,900]}/>} {subTab!=='times'&&<MetricModeToggle mode={mode} onChange={setMode}/>}</FilterShell>}/>
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="inline-flex self-start rounded-xl border border-gray-200 bg-gray-100 p-1">{[{key:'jogadores',label:'Jogadores de linha'},{key:'goleiros',label:'Goleiros'},{key:'times',label:'Times'}].map(t=><button key={t.key} onClick={()=>{setSubTab(t.key);setCategory('Todas');setSearch('')}} className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${subTab===t.key?'border border-sky-200 bg-white text-sky-700 shadow-sm':'text-gray-400'}`}>{t.label}</button>)}</div><div className="relative w-full xl:max-w-xs"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar ranking/métrica..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[10px]"/></div></div>
    <div className="flex gap-1.5 overflow-x-auto pb-1">{availableCategories.map(v=><button key={v} onClick={()=>setCategory(v)} className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${category===v?'border-sky-600 bg-sky-600 text-white':'border-gray-200 bg-white text-gray-400'}`}>{v}</button>)}</div>
    {loading&&<Loading/>}{!loading&&error&&<ErrorState message={error} onRetry={reload}/>} {!loading&&!error&&!players.length&&!goalkeepers.length&&!teams.length&&<EmptyState title="Ainda não há dados suficientes" description="Envie as planilhas semanais na aba Upload Semanal."/>}
    {!loading&&!error&&current.length>0&&<><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(i=><DashboardKpiCard key={i.label}{...i}/>)}</div>{indexLeader&&<PodiumCard title={`Pódio geral · ${subTab==='times'?'Times':subTab==='goleiros'?'Goleiros':'Jogadores'}`} description="Índice no recorte atual." entries={indexLeader.entries} metric={indexLeader.col}/>}<div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Panel title="Dominância multindicador" description="Pontuação por presença no Top-5 de diferentes fundamentos."><LeaderRows entries={dominant} metric="Pontos" limit={8}/></Panel><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">{filtered.map(l=><Panel key={l.col} title={`${l.metric}${l.canPer90&&mode==='per90'?'/90':''}`} description={`${l.category} · Top 5 · amostra validada`}><LeaderRows entries={l.entries} metric={l.col} limit={5} showTeam={subTab!=='times'}/></Panel>)}</div></div>{subTab==='times'&&teamAlerts.length>0&&<Panel title="Alertas disciplinares e de controle" description="Métricas em que menor valor tende a ser melhor."><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{teamAlerts.map(l=><div key={l.col} className="rounded-xl border border-red-100 bg-red-50/40 p-3"><p className="text-[8px] font-black uppercase tracking-widest text-red-400">{l.metric}</p><LeaderRows entries={l.entries} metric={l.col} limit={5} showTeam={false}/></div>)}</div></Panel>}</>}
  </div></AppShell>
}
