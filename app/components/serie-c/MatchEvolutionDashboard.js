'use client'
import { useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, Minus, Printer, Search, TrendingUp } from 'lucide-react'
import { findMetricColumn, isIdentityColumn, isPercentageMetric, isVolumeMetric, per90, toNumber } from '../../../lib/serieC'
import { metricCategory, metricHigherIsBetter } from '../../../lib/serieCMetricRegistry'

function norm(value='') {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9%]+/g,' ').trim()
}
function groupPos(pos='') {
  const p=String(pos).toUpperCase()
  if (p.includes('GK')) return 'Goleiros'
  if (/CB|LB|RB|WB|ZAG|LAT/.test(p)) return 'Defesa'
  if (/DM|CM|AM|MF|LM|RM|VOL|MEI/.test(p)) return 'Meio-campo'
  if (/LW|RW|CF|ST|SS|FW|ATA|EXT/.test(p)) return 'Ataque'
  return 'Outros'
}
function metricValue(metrics, metric) {
  if (!metrics) return null
  const key=Object.prototype.hasOwnProperty.call(metrics,metric)?metric:findMetricColumn(metrics,metric)
  return key ? toNumber(metrics[key]) : null
}
function pctScale(value) {
  const n=toNumber(value); if(n===null)return null
  return Math.abs(n)<=1.5?n*100:n
}
function formatDate(v) {
  if(!v)return '—'
  const d=new Date(`${String(v).slice(0,10)}T12:00:00`)
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
}
function formatValue(metric,value,kind='raw') {
  const n=toNumber(value); if(n===null)return '—'
  if(kind==='pct'||isPercentageMetric(metric)) return `${pctScale(n).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`
  if(kind==='rate') return `${n.toLocaleString('pt-BR',{maximumFractionDigits:2})}/90`
  return n.toLocaleString('pt-BR',{maximumFractionDigits:2})
}
function histories(rows=[]) {
  const map=new Map()
  for(const r of rows){
    if(!r.player)continue
    const key=`${r.entityType||'player'}|${r.player}`
    if(!map.has(key))map.set(key,[])
    map.get(key).push(r)
  }
  for(const arr of map.values())arr.sort((a,b)=>Number(a.round)-Number(b.round))
  return map
}
function metricKeys(allHist, entityType='player') {
  const map=new Map()
  for(const arr of allHist.values())for(const r of arr){
    if((r.entityType||'player')!==entityType)continue
    for(const k of Object.keys(r.metrics||{})){
      if(isIdentityColumn(k)||metricValue(r.metrics,k)===null)continue
      const nk=norm(k); if(!map.has(nk))map.set(nk,k)
    }
  }
  return [...map.values()].sort((a,b)=>{
    const ca=metricCategory(a,entityType), cb=metricCategory(b,entityType)
    return ca===cb?a.localeCompare(b,'pt-BR'):String(ca).localeCompare(String(cb),'pt-BR')
  })
}
function snapshotDelta(prev,curr,metric) {
  if(!curr)return null
  const c=metricValue(curr.metrics,metric), b=prev?metricValue(prev.metrics,metric):null
  if(c===null)return null
  const cMin=toNumber(curr.minutes)||0, bMin=prev?(toNumber(prev.minutes)||0):0
  const minutes=Math.max(0,cMin-bMin)
  if(isPercentageMetric(metric)){
    const currPct=pctScale(c), prevPct=pctScale(b)
    return {value:currPct,delta:prevPct===null?null:currPct-prevPct,minutes,kind:'pct',exact:false}
  }
  if(isVolumeMetric(metric)){
    const total=b!==null&&c>=b?c-b:c
    const rate=minutes>0?per90(total,minutes):null
    return {value:rate,delta:null,minutes,total,kind:'rate',exact:b!==null}
  }
  return {value:c,delta:b===null?null:c-b,minutes,kind:'raw',exact:false}
}
function findSnapshotsForRound(arr,round){
  const idx=arr.findIndex(r=>Number(r.round)===Number(round))
  if(idx<0)return {prev:null,curr:null}
  return {prev:idx>0?arr[idx-1]:null,curr:arr[idx]}
}
function matchForSnapshotRound(data,round){
  const exact=(data?.matches||[]).find(m=>Number(m.round)===Number(round))
  if(exact)return exact
  const upload=(data?.uploads||[]).find(u=>Number(u.round)===Number(round))
  if(!upload?.upload_date)return null
  const ud=new Date(`${upload.upload_date}T12:00:00`).getTime()
  return [...(data?.matches||[])].map(m=>({m,diff:ud-new Date(`${m.date}T12:00:00`).getTime()}))
    .filter(x=>x.diff>=0&&x.diff<=5*86400000).sort((a,b)=>a.diff-b.diff)[0]?.m||null
}
function Delta({metric,value,entityType='player'}){
  const n=toNumber(value)
  if(n===null||Math.abs(n)<0.005)return <span className="inline-flex items-center gap-1 text-slate-400"><Minus className="h-3 w-3"/>estável</span>
  const good=metricHigherIsBetter(metric,entityType)?n>0:n<0
  return <span className={`inline-flex items-center gap-1 font-black ${good?'text-emerald-600':'text-rose-500'}`}>{n>0?<ArrowUpRight className="h-3 w-3"/>:<ArrowDownRight className="h-3 w-3"/>}{n>0?'+':''}{n.toLocaleString('pt-BR',{maximumFractionDigits:2})}</span>
}
function MatchBadge({match}){
  if(!match)return <span className="text-slate-400">Partida não vinculada</span>
  const result=match.goalsFor>match.goalsAgainst?'V':match.goalsFor<match.goalsAgainst?'D':'E'
  const cls=result==='V'?'bg-emerald-100 text-emerald-700':result==='D'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'
  return <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${cls}`}>{result}</span><strong>Confiança {match.goalsFor} × {match.goalsAgainst} {match.opponent}</strong><span className="text-slate-400">{match.mando} · {formatDate(match.date)}</span></div>
}

export default function MatchEvolutionDashboard({data}){
  const allRows=useMemo(()=>[...(data?.players||[]),...(data?.goalkeepers||[])],[data])
  const hist=useMemo(()=>histories(allRows),[allRows])
  const rounds=useMemo(()=>[...(data?.uploads||[])].sort((a,b)=>Number(a.round)-Number(b.round)),[data])
  const [selectedRound,setSelectedRound]=useState(()=>Number(data?.current?.round||rounds.at(-1)?.round||0))
  const [entityType,setEntityType]=useState('player')
  const metrics=useMemo(()=>metricKeys(hist,entityType),[hist,entityType])
  const [metric,setMetric]=useState('')
  const activeMetric=metric&&metrics.includes(metric)?metric:(metrics[0]||'')
  const [search,setSearch]=useState('')
  const match=useMemo(()=>matchForSnapshotRound(data,selectedRound),[data,selectedRound])

  const ranking=useMemo(()=>{
    if(!activeMetric)return []
    const rows=[]
    for(const arr of hist.values()){
      if((arr[0]?.entityType||'player')!==entityType)continue
      const {prev,curr}=findSnapshotsForRound(arr,selectedRound)
      if(!curr)continue
      const d=snapshotDelta(prev,curr,activeMetric)
      if(!d||d.value===null||d.minutes<=0)continue
      rows.push({player:curr.player,position:curr.position,minutes:d.minutes,...d,entityType})
    }
    const higher=metricHigherIsBetter(activeMetric,entityType)
    return rows.sort((a,b)=>higher?(b.value-a.value):(a.value-b.value))
  },[hist,selectedRound,activeMetric,entityType])

  const bestBySector=useMemo(()=>{
    const groups={}
    for(const r of ranking){const g=groupPos(r.position);if(!groups[g])groups[g]=r}
    return Object.entries(groups)
  },[ranking])

  const selectedPlayer=useMemo(()=>{
    const q=norm(search); if(!q)return null
    for(const arr of hist.values())if(norm(arr[0]?.player).includes(q))return arr
    return null
  },[hist,search])

  const timeline=useMemo(()=>{
    if(!selectedPlayer||!activeMetric)return []
    return selectedPlayer.map((curr,i)=>{
      const prev=i>0?selectedPlayer[i-1]:null
      const d=snapshotDelta(prev,curr,activeMetric)
      return d?{round:curr.round,date:curr.upload_date,match:matchForSnapshotRound(data,curr.round),...d}:null
    }).filter(Boolean)
  },[selectedPlayer,activeMetric,data])

  return <div className="mx-auto max-w-[1500px] space-y-5 text-slate-900">
    <section className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-white to-emerald-50 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[9px] font-black uppercase tracking-[.3em] text-emerald-600">Série C · Evolução interna</p><h1 className="mt-1 text-3xl font-black">Partida por partida</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">A evolução agora compara snapshots consecutivos para mostrar o que cada atleta produziu entre uma partida e a seguinte, sem rodada-base e sem lógica de troca de comissão.</p></div>
        <button onClick={()=>window.print()} className="no-print inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-black text-emerald-700"><Printer className="h-4 w-4"/>IMPRIMIR / PDF</button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Rodada analisada</p><p className="mt-1 text-2xl font-black">R{selectedRound||'—'}</p></div>
        <div className="rounded-2xl border bg-white p-4 md:col-span-2"><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Partida</p><div className="mt-2 text-sm"><MatchBadge match={match}/></div></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Snapshots disponíveis</p><p className="mt-1 text-2xl font-black">{rounds.length}</p></div>
      </div>
    </section>

    <section className="no-print rounded-2xl border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[190px_180px_1fr]">
        <select value={selectedRound} onChange={e=>setSelectedRound(Number(e.target.value))} className="rounded-xl border px-3 py-2 text-sm font-bold">{rounds.map(r=><option key={r.id} value={r.round}>Rodada {r.round} · {formatDate(r.upload_date)}</option>)}</select>
        <select value={entityType} onChange={e=>{setEntityType(e.target.value);setMetric('')}} className="rounded-xl border px-3 py-2 text-sm font-bold"><option value="player">Linha</option><option value="goalkeeper">Goleiros</option></select>
        <select value={activeMetric} onChange={e=>setMetric(e.target.value)} className="rounded-xl border px-3 py-2 text-sm font-bold">{metrics.map(m=><option key={m} value={m}>{m}</option>)}</select>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Ranking da partida</p><h2 className="text-xl font-black">{activeMetric||'Métrica'}</h2></div><Activity className="h-5 w-5 text-emerald-500"/></div>
        <div className="mt-4 space-y-2">{ranking.slice(0,15).map((r,i)=><div key={`${r.player}-${i}`} className="grid grid-cols-[36px_1fr_90px_85px] items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2"><span className="text-center text-sm font-black text-slate-400">#{i+1}</span><div><p className="font-black">{r.player}</p><p className="text-[10px] text-slate-400">{r.position||'—'} · {Math.round(r.minutes)} min no intervalo</p></div><strong className="text-right text-emerald-700">{formatValue(activeMetric,r.value,r.kind)}</strong><div className="text-right text-[10px]"><Delta metric={activeMetric} value={r.delta} entityType={entityType}/></div></div>)}{!ranking.length&&<div className="rounded-xl border border-dashed p-10 text-center text-slate-400">Ainda não há dois snapshots consecutivos com amostra para esta métrica.</div>}</div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-widest text-sky-600">Destaques do jogo</p><h2 className="text-xl font-black">Melhores por setor</h2>
        <div className="mt-4 space-y-3">{bestBySector.map(([sector,r])=><div key={sector} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-widest text-sky-700">{sector}</span><TrendingUp className="h-4 w-4 text-sky-500"/></div><p className="mt-2 text-base font-black">{r.player}</p><p className="text-sm text-slate-500">{r.position} · {formatValue(activeMetric,r.value,r.kind)}</p></div>)}{!bestBySector.length&&<p className="mt-4 text-sm text-slate-400">Sem destaques elegíveis neste recorte.</p>}</div>
      </section>
    </div>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-violet-600">Evolução individual</p><h2 className="text-xl font-black">Jogo a jogo do atleta</h2></div><div className="relative no-print"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar atleta..." className="w-72 rounded-xl border py-2 pl-9 pr-3 text-sm"/></div></div>
      {selectedPlayer?<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="text-[9px] uppercase tracking-widest text-slate-400"><th className="p-2">Rodada</th><th className="p-2">Partida</th><th className="p-2">Minutos período</th><th className="p-2">{activeMetric}</th><th className="p-2">Variação</th></tr></thead><tbody>{timeline.map((t,i)=><tr key={i} className="border-t"><td className="p-2 font-black">R{t.round}</td><td className="p-2">{t.match?`Confiança ${t.match.goalsFor} x ${t.match.goalsAgainst} ${t.match.opponent}`:formatDate(t.date)}</td><td className="p-2">{Math.round(t.minutes)}</td><td className="p-2 font-black">{formatValue(activeMetric,t.value,t.kind)}</td><td className="p-2"><Delta metric={activeMetric} value={t.delta} entityType={selectedPlayer[0]?.entityType||'player'}/></td></tr>)}</tbody></table></div>:<div className="mt-4 rounded-xl border border-dashed p-10 text-center text-slate-400">Digite o nome de um atleta para visualizar sua sequência partida por partida.</div>}
    </section>
  </div>
}
