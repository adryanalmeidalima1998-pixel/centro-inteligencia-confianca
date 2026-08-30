'use client'
import { normTeamName, valueFromMetricAny, formatMetricValue } from '../../../lib/serieC'
import { sameAthlete } from '../../../lib/nameMatch'
import { playerReport, squadLeaders, goalkeeperLeaders, goalkeeperReport, positionGroup } from '../../../lib/serieCReport'

const METRICS=[
  {label:'Gols',aliases:['Gols'],higher:true},
  {label:'Chutes',aliases:['Chutes'],higher:true},
  {label:'Posse de bola',aliases:['Posse de bola, %'],higher:true,pct:true},
  {label:'Passes precisos',aliases:['Passes precisos, %'],higher:true,pct:true},
  {label:'Passes progressivos',aliases:['Passes progressivos'],higher:true},
  {label:'Entradas no terço final',aliases:['Entradas no terço final'],higher:true},
  {label:'Recuperações no campo adversário',aliases:['Recuperações da bola no campo adversário'],higher:true},
  {label:'Duelos ganhos',aliases:['Duelos ganhos, %'],higher:true,pct:true},
  {label:'Interceptações',aliases:['Interceptações'],higher:true},
]

function norm(v){return normTeamName(v||'')}
function sameTeam(a,b){const A=norm(a),B=norm(b);return A===B||A.includes(B)||B.includes(A)}
function fmt(n,d=1){return Number.isFinite(Number(n))?Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'-'}
function pct(n){return Number.isFinite(Number(n))?`${Math.round(Number(n))}%`:'-'}
function corridorLabel(c,def=false){
  if(c==='centro') return 'Centro'
  if(!def) return c==='esquerda'?'Esquerda':'Direita'
  return c==='esquerda'?'Esq. ataque rival / nossa direita':'Dir. ataque rival / nossa esquerda'
}
function maxCorridor(block){
  if(!block)return null
  const list=['esquerda','centro','direita'].map(k=>({key:k,value:Number(block[k]||0)})).sort((a,b)=>b.value-a.value)
  const total=list.reduce((s,x)=>s+x.value,0)
  return total?{...list[0],total,pct:Math.round(list[0].value/total*100)}:null
}
function initials(name){return String(name||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}

function TeamMark({crest,team}){
  return <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-100 bg-white p-1.5">
    {crest?<img src={crest} alt={`Escudo ${team}`} className="h-full w-full object-contain"/>:<span className="text-[10px] font-black text-emerald-700">ADV</span>}
  </div>
}

function Page({number,total,title,subtitle,crest,children}){
  return <section className="opponent-report-page flex min-h-[980px] flex-col rounded-[24px] border border-gray-100 bg-white p-7 shadow-sm print:shadow-none print:rounded-none">
    <header className="flex items-center justify-between border-b-2 border-emerald-600 pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <TeamMark crest={crest} team={title}/>
        <div className="min-w-0"><div className="text-[8px] font-black uppercase tracking-[.24em] text-emerald-600">CIC · ANÁLISE DE ADVERSÁRIO · SÉRIE C</div><div className="bc truncate text-2xl font-black text-gray-900">{title}</div><div className="mt-1 text-[9px] font-bold text-gray-400">{subtitle}</div></div>
      </div>
      <div className="shrink-0 text-right text-[8px] font-bold text-gray-400">Página {number}/{total}<br/>Últimas 10 partidas</div>
    </header>
    <div className="mt-5 flex-1 min-h-0">{children}</div>
    <footer className="mt-auto flex justify-between border-t border-gray-100 pt-2 text-[7px] font-black uppercase tracking-widest text-gray-300"><span>Confiança · Centro de Inteligência</span><span>Adversário · {number}/{total}</span></footer>
  </section>
}

function Kpi({label,value,sub,tone='neutral'}){
  const c=tone==='good'?'text-emerald-600':tone==='bad'?'text-rose-500':'text-gray-900'
  return <div className="rounded-2xl border border-gray-100 bg-white p-3"><div className="text-[7px] font-black uppercase tracking-widest text-gray-400">{label}</div><div className={`bc mt-1 text-2xl font-black ${c}`}>{value}</div>{sub?<div className="mt-1 text-[8px] font-semibold text-gray-400">{sub}</div>:null}</div>
}

function BarRows({block,defensive=false,tone='green',compact=false}){
  if(!block)return <div className="text-[9px] text-gray-400">Leitura não disponível neste PDF.</div>
  const total=['esquerda','centro','direita'].reduce((s,k)=>s+Number(block[k]||0),0)||1
  const bar=tone==='red'?'bg-rose-400':tone==='amber'?'bg-amber-400':'bg-emerald-500'
  return <div className={compact?'space-y-1.5':'space-y-2'}>{['esquerda','centro','direita'].map(k=>{const v=Number(block[k]||0),p=Math.round(v/total*100);return <div key={k} className="grid grid-cols-[132px_1fr_35px_32px] items-center gap-2 text-[8px]"><span className="truncate font-semibold text-gray-600">{corridorLabel(k,defensive)}</span><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${bar}`} style={{width:`${p}%`}}/></div><b className="text-right text-gray-800">{v}</b><span className="text-right text-gray-400">{p}%</span></div>})}</div>
}

function PitchDiagram({block,defensive=false,title,tone='amber'}){
  const total=['esquerda','centro','direita'].reduce((s,k)=>s+Number(block?.[k]||0),0)||1
  const values=['esquerda','centro','direita'].map(k=>Math.round(Number(block?.[k]||0)/total*100))
  const max=Math.max(...values,1)
  const fill=tone==='green'?'#10b981':tone==='red'?'#fb7185':'#f59e0b'
  const labels=defensive?['ESQ. RIVAL','CENTRO','DIR. RIVAL']:['ESQUERDA','CENTRO','DIREITA']
  return <div className="rounded-2xl border border-gray-100 p-3">
    <div className="mb-2 flex items-center justify-between"><h4 className="text-[8px] font-black uppercase tracking-wider text-gray-700">{title}</h4><span className="text-[6px] font-bold text-gray-400">ataque → gol</span></div>
    <svg viewBox="0 0 300 180" className="w-full" role="img" aria-label={title}>
      <rect x="8" y="8" width="284" height="164" rx="8" fill="#ecfdf5" stroke="#6ee7b7" strokeWidth="2"/>
      {[0,1,2].map((i)=><rect key={i} x={8+i*(284/3)} y="8" width={284/3} height="164" fill={fill} opacity={0.05+0.24*(values[i]/max)}/>) }
      <line x1="102.7" y1="8" x2="102.7" y2="172" stroke="#a7f3d0" strokeDasharray="6 5"/>
      <line x1="197.3" y1="8" x2="197.3" y2="172" stroke="#a7f3d0" strokeDasharray="6 5"/>
      <rect x="95" y="8" width="110" height="48" fill="none" stroke="#6ee7b7" strokeWidth="2"/>
      <rect x="127" y="8" width="46" height="12" fill="none" stroke="#34d399" strokeWidth="2"/>
      <path d="M126 56 A26 26 0 0 0 174 56" fill="none" stroke="#6ee7b7" strokeWidth="2"/>
      <circle cx="150" cy="90" r="2.5" fill="#34d399"/><line x1="8" y1="90" x2="292" y2="90" stroke="#a7f3d0"/>
      {labels.map((l,i)=><g key={l}><text x={55+i*95} y="148" textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">{l}</text><text x={55+i*95} y="163" textAnchor="middle" fontSize="14" fontWeight="900" fill={fill}>{values[i]}%</text></g>)}
      <path d="M150 135 L150 110 M144 116 L150 110 L156 116" fill="none" stroke="#64748b" strokeWidth="2"/>
    </svg>
    {defensive?<div className="mt-1 text-center text-[6px] font-semibold text-gray-400">Esquerda do rival = nossa direita defensiva · direita do rival = nossa esquerda</div>:null}
  </div>
}

function Matrix({data,title,tone='green'}){
  const grid=data?.pct
  if(!grid)return <div className="rounded-2xl border border-gray-100 p-3"><h4 className="text-[8px] font-black uppercase tracking-wider text-gray-600">{title}</h4><p className="mt-3 text-[8px] text-gray-400">Sem leitura disponível.</p></div>
  const bg=tone==='red'?'bg-rose-50 text-rose-600':tone==='amber'?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'
  return <div className="rounded-2xl border border-gray-100 p-3"><h4 className="text-[8px] font-black uppercase tracking-wider text-gray-600">{title}</h4><div className="mt-3 grid grid-cols-[28px_repeat(3,1fr)] gap-1 text-center text-[7px]"><span></span><b>DEF</b><b>MÉD</b><b>OF</b>{['esquerda','centro','direita'].map(r=><div key={r} className="contents"><b className="self-center">{r[0].toUpperCase()}</b>{['defensivo','medio','ofensivo'].map(c=><div key={`${r}-${c}`} className={`rounded-lg px-1 py-2 font-black ${bg}`}>{grid?.[r]?.[c]===null||grid?.[r]?.[c]===undefined?'-':`${fmt(grid[r][c],1)}%`}<div className="mt-0.5 text-[6px] font-semibold opacity-70">{data?.per90?.[r]?.[c]===null||data?.per90?.[r]?.[c]===undefined?'':`${fmt(data.per90[r][c],1)}/90`}</div></div>)}</div>)}</div></div>
}

function TeamBenchmark({teams,opponent}){
  const gua=teams.find(t=>t.is_guarani)
  const opp=teams.find(t=>sameTeam(t.team,opponent))
  if(!gua||!opp)return <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-[9px] text-gray-400">Não encontrei o adversário na planilha de times da rodada atual para o benchmark da Série C.</div>
  const rows=METRICS.map(def=>{
    const ov=valueFromMetricAny(opp.metrics,def.aliases),gv=valueFromMetricAny(gua.metrics,def.aliases)
    if(ov===null||gv===null)return null
    const vals=teams.map(t=>valueFromMetricAny(t.metrics,def.aliases)).filter(v=>v!==null).sort((a,b)=>def.higher?b-a:a-b)
    return {...def,ov,gv,rank:vals.findIndex(v=>v===ov)+1,total:vals.length}
  }).filter(Boolean)
  return <div className="overflow-hidden rounded-2xl border border-gray-100"><div className="grid grid-cols-[1.45fr_.65fr_.65fr_.45fr] bg-gray-50 px-3 py-2 text-[7px] font-black uppercase tracking-wider text-gray-400"><span>Métrica</span><span>{opponent}</span><span>Confiança</span><span>Rank rival</span></div>{rows.map(r=><div key={r.label} className="grid grid-cols-[1.45fr_.65fr_.65fr_.45fr] items-center border-t border-gray-50 px-3 py-2 text-[8px]"><b className="text-gray-700">{r.label}</b><span className="font-black text-gray-900">{r.pct?formatMetricValue(r.aliases[0],r.ov):fmt(r.ov,0)}</span><span className="font-bold text-emerald-700">{r.pct?formatMetricValue(r.aliases[0],r.gv):fmt(r.gv,0)}</span><span className="text-gray-400">{r.rank}º/{r.total}</span></div>)}</div>
}

function directLast10Rows(opp,gua){
  if(!opp)return[]
  const os=opp.summary||{},gs=gua?.summary||{},of=opp.finishing?.total||{},gf=gua?.finishing?.total||{}
  const conv=(s,f)=>f?.shots?Number(s.gf||0)/Number(f.shots):null
  return [
    ['Pontos/jogo',os.ppg,gs.ppg,2],['Gols marcados',os.gf,gs.gf,0],['Gols sofridos',os.ga,gs.ga,0],['Saldo',os.goalDiff,gs.goalDiff,0],
    ['Chutes',of.shots,gf.shots,0],['Chutes no alvo',of.onTarget,gf.onTarget,0],['xG',of.xg,gf.xg,2],['Conversão',conv(os,of),conv(gs,gf),'pct'],
  ].filter(r=>r[1]!==undefined&&r[1]!==null)
}
function Last10Comparison({opponent,guarani}){
  const rows=directLast10Rows(opponent,guarani)
  return <div className="overflow-hidden rounded-2xl border border-gray-100"><div className="grid grid-cols-[1.3fr_.7fr_.7fr] bg-gray-50 px-3 py-2 text-[7px] font-black uppercase tracking-wider text-gray-400"><span>Últimos 10</span><span>{opponent.team}</span><span>Confiança</span></div>{rows.map(([l,a,b,d])=><div key={l} className="grid grid-cols-[1.3fr_.7fr_.7fr] border-t border-gray-50 px-3 py-2 text-[8px]"><b className="text-gray-700">{l}</b><span className="font-black">{d==='pct'?pct(a*100):fmt(a,d)}</span><span className="font-bold text-emerald-700">{b===undefined||b===null?'—':d==='pct'?pct(b*100):fmt(b,d)}</span></div>)}</div>
}

function MiniTable({title,headers,rows,empty='Sem dados extraídos.'}){
  return <div className="overflow-hidden rounded-2xl border border-gray-100"><div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-[8px] font-black uppercase tracking-wider text-gray-600">{title}</div>{rows?.length?<><div className={`grid grid-cols-${headers.length} px-3 py-1.5 text-[6px] font-black uppercase text-gray-400`} style={{gridTemplateColumns:`1.5fr repeat(${headers.length-1},.65fr)`}}>{headers.map(h=><span key={h}>{h}</span>)}</div>{rows.map((r,i)=><div key={`${r.player||r.label||i}`} className="grid border-t border-gray-50 px-3 py-2 text-[8px]" style={{gridTemplateColumns:`1.5fr repeat(${headers.length-1},.65fr)`}}>{r.cells.map((c,j)=><span key={j} className={j===0?'font-bold text-gray-700':'font-black text-gray-900'}>{c}</span>)}</div>)}</>:<div className="p-4 text-[8px] text-gray-400">{empty}</div>}</div>
}

function playerStrengthScore(rep,minutes){return (rep?.destaques||[]).slice(0,4).reduce((s,x)=>s+(x.leaguePct||0)+(x.squadLeader?35:0),0)+(Number(minutes)||0)/100}
function playerCardData(player,squad,league,leaders,isGk=false){
  const rep=isGk?goalkeeperReport(player,{squad,leaguePool:league,leaders}):playerReport(player,{squad,leaguePool:league,leaders})
  return {player,rep,score:playerStrengthScore(rep,player.minutes)}
}
function playerPhoto(p){return p?.photo_url||p?.photoUrl||p?.photo||null}
function IndividualHighlights({data,team,roster=[]}){
  const all=data?.players||[],gks=(data?.goalkeepers||[]).map(x=>({...x,position:'GK',isGoalkeeper:true}))
  const rosterNames=(roster||[]).map(x=>x.player).filter(Boolean)
  const active=p=>rosterNames.length<5||rosterNames.some(n=>sameAthlete(n,p.player,[]))
  const opp=all.filter(p=>sameTeam(p.team,team)&&active(p)),gua=all.filter(p=>p.is_guarani)
  const oppG=gks.filter(p=>sameTeam(p.team,team)&&active(p)),guaG=gks.filter(p=>p.is_guarani)
  const ol=squadLeaders(opp),gl=squadLeaders(gua),og=goalkeeperLeaders(oppG),gg=goalkeeperLeaders(guaG)
  const candidates=[...opp.map(p=>playerCardData(p,opp,all,ol,false)),...oppG.map(p=>playerCardData(p,oppG,gks,og,true))].filter(x=>(Number(x.player.minutes)||0)>=300).sort((a,b)=>b.score-a.score).slice(0,5)
  const guaCards=[...gua.map(p=>playerCardData(p,gua,all,gl,false)),...guaG.map(p=>playerCardData(p,guaG,gks,gg,true))]
  return <div className="grid grid-cols-1 gap-3">{candidates.map(c=>{
    const group=positionGroup(c.player.position)
    const peer=guaCards.filter(g=>positionGroup(g.player.position)===group).sort((a,b)=>b.score-a.score)[0]
    const keyMetric=(c.rep.destaques||[])[0]
    const peerMetric=keyMetric&&peer?Object.values(peer.rep.families||{}).flat().find(x=>x.metric===keyMetric.metric):null
    const photo=playerPhoto(c.player)
    return <div key={c.player.player} className="rounded-2xl border border-gray-100 p-3"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gray-100 text-[10px] font-black text-gray-500">{photo?<img src={photo} alt={c.player.player} className="h-full w-full object-cover"/>:initials(c.player.player)}</div><div><b className="text-[10px] text-gray-900">{c.player.player}</b><div className="text-[7px] font-bold text-gray-400">{c.player.position} · {Math.round(Number(c.player.minutes)||0)} min no campeonato</div></div></div>{peer?<div className="text-right text-[7px] text-gray-400">Referência Confiança<br/><b className="text-emerald-700">{peer.player.player}</b></div>:null}</div><div className="mt-3 grid grid-cols-3 gap-2">{(c.rep.destaques||[]).slice(0,3).map(m=><div key={m.metric} className="rounded-xl bg-gray-50 p-2"><div className="text-[6px] font-black uppercase text-gray-400">{m.metric}</div><div className="mt-1 text-[11px] font-black text-gray-900">{m.value}</div><div className="mt-0.5 text-[6px] font-semibold text-gray-400">Liga {m.leagueRank?`${m.leagueRank}º/${m.leagueTotal}`:'—'}</div></div>)}</div>{keyMetric&&peer?<div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-2 py-1.5 text-[7px] text-gray-600"><b>Comparação-chave · {keyMetric.metric}:</b> {c.player.player} <b className="text-gray-900">{keyMetric.value}</b> × {peer.player.player} <b className="text-emerald-700">{peerMetric?.value||'—'}</b></div>:null}</div>
  })}</div>
}

export default function RelatorioAdversario({report,data,guaraniLast10=null}){
  const r=report?.parsedData||report||{}
  const team=report?.team||r.team||'Adversário'
  const crest=r.crestDataUrl||null
  const s=r.summary||{}
  const fin=r.finishing?.total||{}
  const exposure=maxCorridor(r.spatial?.defensive?.exposures)
  const attack=maxCorridor(r.spatial?.offensive?.crosses)
  const strengths=r.insights?.strengths||[],weaknesses=r.insights?.weaknesses||[]
  const matches=r.matches||[]
  const totalPages=7
  const conversion=fin.shots?Number(fin.goals??s.gf??0)/fin.shots:null
  const finishers=(r.playerLast10?.finishers||[]).slice(0,5)
  const creators=(r.playerLast10?.creators||[]).slice(0,5)
  const sp=r.setPieces||{},ct=r.continuousThreat||{}

  return <div className="opponent-report-document space-y-5">
    <Page number={1} total={totalPages} title={team} crest={crest} subtitle="Panorama executivo · recorte Wyscout das últimas 10 partidas">
      <div className="grid grid-cols-4 gap-3"><Kpi label="Campanha" value={`${s.wins||0}V · ${s.draws||0}E · ${s.losses||0}D`} sub={`${fmt(s.ppg,2)} ponto(s)/jogo`}/><Kpi label="Gols marcados" value={s.gf??'-'} sub={`${fmt(s.gfPerGame,2)} / jogo`} tone="good"/><Kpi label="Gols sofridos" value={s.ga??'-'} sub={`${fmt(s.gaPerGame,2)} / jogo`} tone="bad"/><Kpi label="Saldo" value={s.goalDiff>0?`+${s.goalDiff}`:s.goalDiff??'-'} sub="últimas 10" tone={s.goalDiff>=0?'good':'bad'}/></div>
      <div className="mt-4 grid grid-cols-4 gap-3"><Kpi label="Chutes" value={fin.shots??'-'} sub={fin.onTarget!=null?`${fin.onTarget} no alvo · ${fmt(fin.onTargetPct,1)}%`:''}/><Kpi label="xG" value={fin.xg!=null?fmt(fin.xg,2):'-'} sub={fin.xg!=null?`${fmt(fin.xg/10,2)} / jogo`:''}/><Kpi label="Conversão" value={conversion!==null?pct(conversion*100):'-'} sub="gols / chutes"/><Kpi label="Formação base" value={r.formations?.[0]?.formation||'-'} sub={r.formations?.[0]?.share?`${r.formations[0].share}% do recorte`:''}/></div>
      <div className="mt-5 grid grid-cols-2 gap-4"><div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4"><h3 className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Pontos fortes</h3><div className="mt-3 space-y-2">{strengths.length?strengths.map((x,i)=><p key={i} className="text-[8px] font-semibold leading-relaxed text-gray-700">• {x}</p>):<p className="text-[8px] text-gray-400">Sem sinal forte suficiente para afirmar automaticamente.</p>}</div></div><div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4"><h3 className="text-[9px] font-black uppercase tracking-wider text-rose-600">Pontos de atenção / fragilidades</h3><div className="mt-3 space-y-2">{weaknesses.length?weaknesses.map((x,i)=><p key={i} className="text-[8px] font-semibold leading-relaxed text-gray-700">• {x}</p>):<p className="text-[8px] text-gray-400">Sem fragilidade forte suficiente para afirmar automaticamente.</p>}</div></div></div>
      <div className="mt-5"><h3 className="mb-2 text-[9px] font-black uppercase tracking-wider text-gray-700">Últimos 10 jogos</h3><div className="grid grid-cols-2 gap-x-4 gap-y-1">{matches.map((m,i)=><div key={i} className="flex items-center justify-between rounded-lg border-b border-gray-50 px-2 py-1.5 text-[8px]"><span className="font-semibold text-gray-600">{m.home} {m.homeGoals}×{m.awayGoals} {m.away}</span><span className={`font-black ${m.result==='V'?'text-emerald-600':m.result==='D'?'text-rose-500':'text-gray-400'}`}>{m.result}</span></div>)}</div></div>
    </Page>

    <Page number={2} total={totalPages} title={team} crest={crest} subtitle="Mapa de forças, corredores e vulnerabilidades">
      <div className="grid grid-cols-2 gap-4"><PitchDiagram block={r.spatial?.defensive?.exposures} defensive title="Onde o rival mais fica exposto" tone="amber"/><PitchDiagram block={r.spatial?.offensive?.crosses} title="Corredor de maior volume ofensivo" tone="green"/></div>
      <div className="mt-4 grid grid-cols-2 gap-4"><div className="rounded-2xl border border-gray-100 p-4"><h3 className="text-[8px] font-black uppercase text-emerald-700">Duelos defensivos ganhos</h3><div className="mt-3"><BarRows block={r.spatial?.defensive?.won} defensive compact/></div></div><div className="rounded-2xl border border-amber-100 p-4"><h3 className="text-[8px] font-black uppercase text-amber-600">Exposições · duelos perdidos</h3><div className="mt-3"><BarRows block={r.spatial?.defensive?.exposures} defensive tone="amber" compact/></div>{exposure?<p className="mt-3 rounded-lg bg-amber-50 px-2 py-1.5 text-[7px] font-bold text-amber-700">Maior vulnerabilidade: {corridorLabel(exposure.key,true)} · {exposure.pct}%</p>:null}</div></div>
      <div className="mt-4 grid grid-cols-3 gap-4"><div className="rounded-2xl border border-gray-100 p-3"><h3 className="text-[8px] font-black uppercase text-blue-600">Duelos aéreos</h3><div className="mt-3"><BarRows block={r.spatial?.defensive?.aerial} defensive tone="amber" compact/></div></div><div className="rounded-2xl border border-gray-100 p-3"><h3 className="text-[8px] font-black uppercase text-emerald-700">Dribles no último terço</h3><div className="mt-3"><BarRows block={r.spatial?.offensive?.dribbles} compact/></div></div><div className="rounded-2xl border border-gray-100 p-3"><h3 className="text-[8px] font-black uppercase text-emerald-700">Recuperações altas</h3><div className="mt-3"><BarRows block={r.spatial?.offensive?.highRecoveries} compact/></div></div></div>
      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-[7px] leading-relaxed text-blue-800"><b>Referência espacial:</b> no defensivo, os lados são lidos pela direção do ataque adversário. O mapa mostra exposição/duelos perdidos; não inventa localização de gols quando o PDF não fornece coordenada textual confiável.</div>
    </Page>

    <Page number={3} total={totalPages} title={team} crest={crest} subtitle="Finalização, criação e quem decide no recorte">
      <div className="grid grid-cols-4 gap-3"><Kpi label="Chutes" value={fin.shots??'-'} sub={fin.onTarget!=null?`${fin.onTarget} no alvo`:''}/><Kpi label="Precisão dos chutes" value={fin.onTargetPct!=null?`${fmt(fin.onTargetPct,1)}%`:'-'} sub="no alvo / total"/><Kpi label="xG" value={fin.xg!=null?fmt(fin.xg,2):'-'} sub="últimas 10"/><Kpi label="Gols" value={fin.goals??s.gf??'-'} sub={conversion!==null?`${pct(conversion*100)} conversão`:''} tone="good"/></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100"><div className="grid grid-cols-[1.5fr_.55fr_.55fr_.5fr_.4fr] bg-gray-50 px-3 py-2 text-[7px] font-black uppercase text-gray-400"><span>Origem da finalização</span><span>Chutes</span><span>No alvo</span><span>xG</span><span>Gols</span></div>{[['Dentro da área',r.finishing?.insideBox],['Fora da área',r.finishing?.outsideBox],['Após cruzamentos',r.finishing?.afterCross],['Jogo organizado',r.finishing?.organized],['Livres diretos + pênaltis',r.finishing?.directAndPenalties],['Cabeceamentos',r.finishing?.headers]].map(([l,x])=>x?<div key={l} className="grid grid-cols-[1.5fr_.55fr_.55fr_.5fr_.4fr] border-t border-gray-50 px-3 py-2 text-[8px]"><b className="text-gray-700">{l}</b><span>{x.shots}</span><span>{x.onTarget}</span><span>{fmt(x.xg,2)}</span><span className="font-black">{x.goals}</span></div>:null)}</div>
      <div className="mt-5 grid grid-cols-2 gap-4"><MiniTable title="Finalizadores · últimas 10" headers={['Jogador','G','xG','Ch.']} rows={finishers.map(x=>({player:x.player,cells:[x.player,x.goals,fmt(x.xg,2),x.shots]}))}/><MiniTable title="Criadores · últimas 10" headers={['Jogador','A','xA','P. chave']} rows={creators.map(x=>({player:x.player,cells:[x.player,x.assists,fmt(x.xa,2),x.keyPasses]}))}/></div>
      <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-[7px] text-gray-500">Fonte automática: página FINALIZAÇÃO do PDF Wyscout. Esses números são do mesmo recorte de 10 jogos do adversário.</div>
    </Page>

    <Page number={4} total={totalPages} title={team} crest={crest} subtitle="Transições, território e perigo contínuo">
      <div className="grid grid-cols-3 gap-4"><Matrix data={r.spatial?.transitions?.recoveries} title="Recuperações da posse"/><Matrix data={r.spatial?.transitions?.losses} title="Perdas da posse" tone="red"/><Matrix data={r.spatial?.transitions?.fouls} title="Faltas cometidas" tone="amber"/></div>
      <div className="mt-5 grid grid-cols-3 gap-4"><MiniTable title="Dribladores de maior volume" headers={['Jogador','Tot.','/90','Vit.']} rows={(ct.dribblers||[]).slice(0,5).map(x=>({player:x.player,cells:[x.player,x.total,fmt(x.per90,1),x.won]}))}/><MiniTable title="Passes em profundidade" headers={['Jogador','Tot.','/90','Prec.']} rows={(ct.depthPassers||[]).slice(0,5).map(x=>({player:x.player,cells:[x.player,x.total,fmt(x.per90,1),x.accuracy==null?'—':`${fmt(x.accuracy,0)}%`]}))}/><MiniTable title="Foras de jogo" headers={['Jogador','Tot.','/90']} rows={(ct.offsides||[]).slice(0,5).map(x=>({player:x.player,cells:[x.player,x.total,fmt(x.per90,1)]}))}/></div>
      <div className="mt-4 rounded-xl border border-gray-100 p-3 text-[7px] leading-relaxed text-gray-500">A matriz 3×3 mostra onde o adversário recupera, perde a posse e comete faltas. O quadro de perigo contínuo complementa a leitura com os atletas que mais conduzem/driblam, atacam profundidade e entram em impedimento.</div>
    </Page>

    <Page number={5} total={totalPages} title={team} crest={crest} subtitle="Estruturas utilizadas e bolas paradas">
      <div><h3 className="text-[9px] font-black uppercase tracking-wider text-gray-700">Formações utilizadas</h3><div className="mt-3 grid grid-cols-3 gap-3">{(r.formations||[]).map(f=><div key={f.formation} className="rounded-2xl bg-gray-50 p-4 text-center"><div className="bc text-xl font-black text-gray-800">{f.formation}</div><div className="mt-1 text-[10px] font-black text-emerald-600">{f.share}%</div></div>)}</div></div>
      <div className="mt-5 grid grid-cols-2 gap-4"><MiniTable title="Batedores de escanteio" headers={['Jogador','Total','Esq.','Dir.']} rows={(sp.cornerTakers||[]).map(x=>({player:x.player,cells:[x.player,x.total,x.left,x.right]}))}/><MiniTable title="Alvos nos escanteios" headers={['Jogador','Ch.','xG','G']} rows={(sp.cornerTargets||[]).map(x=>({player:x.player,cells:[x.player,x.shots,fmt(x.xg,2),x.goals]}))}/></div>
      <div className="mt-4 grid grid-cols-2 gap-4"><MiniTable title="Batedores de faltas laterais" headers={['Jogador','Total','Esq.','Dir.']} rows={(sp.freeTakers||[]).map(x=>({player:x.player,cells:[x.player,x.total,x.left,x.right]}))}/><MiniTable title="Alvos nas faltas laterais" headers={['Jogador','Ch.','xG','G']} rows={(sp.freeTargets||[]).map(x=>({player:x.player,cells:[x.player,x.shots,fmt(x.xg,2),x.goals]}))}/></div>
      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/40 p-3 text-[7px] leading-relaxed text-amber-800">Leitura automática da página BOLAS PARADAS: identifica principais cobradores, lado das cobranças e jogadores que mais finalizam essas situações.</div>
    </Page>

    <Page number={6} total={totalPages} title={team} crest={crest} subtitle="Comparação direta com o Confiança + plano de jogo">
      <div className="grid grid-cols-2 gap-5"><div><h3 className="mb-2 text-[9px] font-black uppercase tracking-wider text-gray-700">Últimos 10 · PDF x PDF</h3><Last10Comparison opponent={r} guarani={guaraniLast10}/><p className="mt-2 text-[7px] leading-relaxed text-gray-400">A comparação usa o mesmo recorte de 10 jogos sempre que o PDF do Confiança estiver salvo.</p></div><div><h3 className="mb-2 text-[9px] font-black uppercase tracking-wider text-gray-700">Benchmark atual da Série C</h3><TeamBenchmark teams={data?.teams||[]} opponent={team}/><p className="mt-2 text-[7px] leading-relaxed text-gray-400">Este quadro usa a planilha atual da competição e fica separado do recorte Wyscout das últimas 10.</p></div></div>
      <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"><h3 className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Plano de jogo sugerido a partir dos dados</h3><div className="mt-3 grid grid-cols-2 gap-3 text-[8px] leading-relaxed text-gray-700"><p>• Direcionar ações ofensivas para <b>{exposure?corridorLabel(exposure.key,true):'o corredor de maior exposição identificado'}</b>, sobretudo após recuperação curta.</p><p>• Preparar a pressão considerando a estrutura <b>{r.formations?.[0]?.formation||'principal'}</b> e sua frequência no recorte.</p><p>• Controlar <b>{attack?corridorLabel(attack.key):'o corredor de maior volume'}</b>, onde o rival concentra mais cruzamentos.</p><p>• Nas transições, atacar as zonas de maior perda e evitar faltas nas zonas de maior incidência mostradas na matriz.</p><p>• Atenção aos principais criadores do recorte: <b>{creators.slice(0,2).map(x=>x.player).join(' e ')||'ver quadro de criação'}</b>.</p><p>• Nas bolas paradas, priorizar marcação dos alvos com maior xG/gols e antecipar o pé/lado dos principais cobradores.</p></div></div>
    </Page>

    <Page number={7} total={totalPages} title={team} crest={crest} subtitle="Destaques individuais · Série C + comparação com o Confiança">
      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-[7px] font-semibold leading-relaxed text-blue-800">Os destaques usam as mesmas regras inteligentes dos cards individuais: métricas /90 exigem minutos mínimos e percentuais exigem volume mínimo de tentativas. Assim, uma eficiência de 100% com amostra pequena não vira destaque artificial.</div>
      <IndividualHighlights data={data} team={team} roster={r.roster||[]}/>
    </Page>
  </div>
}
