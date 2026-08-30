'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button, C, ConfidenceBadge, EmptyState, Field, inputStyle, Kpi, LoadingState,
  MiniSignal, PageHeader, Panel, PercentileBar, ScoreBadge, ScoutingPage, StatusDot, Tabs,
} from '@/app/components/scouting/ScoutingUI'
import { buildScoutingPlayer, enrichScoutingPool } from '@/data/sportsbase-scouting'
import { calculateSportsbasePercentile, formatSportsbaseMetric, getMetricEligibility, getSportsbaseMetric } from '@/data/sportsbase-map'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot, playerFootLabel } from '@/data/player-foot'

const GROUPS=[
  {id:'CB',label:'Zagueiro',positions:'CB,LCB,RCB'}, {id:'FB',label:'Lateral',positions:'LB,RB,LWB,RWB'},
  {id:'DM',label:'Volante',positions:'DMF,CMF,LCMF,RCMF,LDMF,RDMF,CDM,LCDM,RCDM,LDM,RDM,LCM,RCM'},
  {id:'AM',label:'Meia',positions:'AMF,CAM,LCAM,RCAM,LM,RM'}, {id:'WG',label:'Extremo',positions:'LWF,RWF,LW,RW,LAMF,RAMF,LAM,RAM'},
  {id:'ST',label:'Atacante',positions:'CF,LCF,RCF,SS'},
]
const METRICS={
  CB:['duelos_def_90','duelos_def_pct','duelos_aereos_90','duelos_aereos_pct','intercecoes_90','desarmes_90','passes_prog_90','passes_prog_pct','perdas_campo_proprio_90'],
  FB:['duelos_def_90','duelos_def_pct','desarmes_90','passes_prog_90','passes_prog_pct','cruzamentos_90','cruzamentos_pct','dribles_90','dribles_pct','perdas_bola_90'],
  DM:['recuperacoes_90','duelos_def_90','duelos_def_pct','intercecoes_90','passes_prog_90','passes_prog_pct','entradas_terco_passe_90','perdas_campo_proprio_90'],
  AM:['passes_chave_90','chances_criadas_90','assistencias_90','passes_area_90','passes_area_pct','passes_prog_90','dribles_90','dribles_pct','perdas_bola_90'],
  WG:['dribles_90','dribles_pct','dribles_tercofinal_90','dribles_tercofinal_pct','passes_area_90','xg_90','gols_90','remates_90','perdas_individuais_90'],
  ST:['gols_90','xg_90','remates_90','remates_golo_pct','conversao_gols_pct','remates_area_90','duelos_aereos_90','duelos_aereos_pct','participacao_gols_90'],
}
const MULTI_GROUP_METRICS=[
  'gols_90','xg_90','assistencias_90','chances_criadas_90','remates_90','remates_golo_pct',
  'passes_chave_90','passes_prog_90','passes_prog_pct','dribles_90','dribles_pct',
  'duelos_def_90','duelos_def_pct','recuperacoes_90','perdas_bola_90',
]
function fmt(v,d=1){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:d}):'—'}
function leagueLabel(value=''){return String(value).replace('brasileirao-','Brasileirão ').replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function includesPosition(player,positions){const allowed=positions.split(',');return String(player?.posicao||'').split(',').map(x=>x.trim()).some(code=>allowed.includes(code))}

function Picker({label,mode,setMode,query,setQuery,options,selected,onSelect,guaraniAvailable=true}){
  const filtered=options.filter(p=>`${p.nome} ${p.equipa}`.toLowerCase().includes(query.toLowerCase())).slice(0,10)
  return <Panel title={label} subtitle={selected?`${selected.equipa} · ${selected.posicao} · ${fmt(selected.minutos,0)} min`:'Selecione um atleta'} bodyStyle={{padding:12}}>
    <div style={{display:'flex',gap:5,marginBottom:8}}><button onClick={()=>setMode('market')} style={{flex:1,padding:7,borderRadius:8,border:`1px solid ${mode==='market'?C.green:C.line}`,background:mode==='market'?C.green2:'#fff',color:mode==='market'?C.green:C.muted,fontSize:9.5,fontWeight:850,cursor:'pointer'}}>🌐 Mercado</button><button disabled={!guaraniAvailable} onClick={()=>setMode('confianca')} style={{flex:1,padding:7,borderRadius:8,border:`1px solid ${mode==='confianca'?C.green:C.line}`,background:mode==='confianca'?C.green2:'#fff',color:mode==='confianca'?C.green:C.muted,fontSize:9.5,fontWeight:850,cursor:'pointer',opacity:guaraniAvailable?1:.5}}>🟢 Confiança</button></div>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar atleta ou clube..." style={inputStyle}/>
    {query&&<div style={{marginTop:6,border:`1px solid ${C.line}`,borderRadius:9,overflow:'hidden'}}>{filtered.map(player=><button key={`${player.nome}-${player.equipa}`} onClick={()=>{onSelect(player);setQuery('')}} style={{width:'100%',padding:'8px 9px',border:0,borderBottom:`1px solid ${C.line}`,background:'#fff',textAlign:'left',cursor:'pointer'}}><strong style={{display:'block',fontSize:10,color:C.ink}}>{player.nome}</strong><span style={{fontSize:8.5,color:C.muted}}>{player.equipa} · {player.posicao} · Pé {playerFootLabel(player.pe)} · {fmt(player.minutos,0)} min</span></button>)}</div>}
    {selected&&<div style={{marginTop:10,padding:11,borderRadius:10,background:C.green2,border:`1px solid ${C.green3}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><strong style={{fontSize:11,color:C.ink}}>{selected.nome}</strong><p style={{fontSize:9,color:C.muted,marginTop:2}}>{selected._scouting?.profile||'Calculando perfil...'}</p></div><ScoreBadge value={selected._scouting?.finalScore}/></div>}
  </Panel>
}

function MetricCompare({metric,a,b,pool}){
  const def=getSportsbaseMetric(metric)||{key:metric,label:metric,higherIsBetter:true,type:'per90'}
  const eligible=pool.filter(p=>getMetricEligibility(p,def,{players:pool,selectedMinimum:450}).eligible)
  const values=eligible.map(p=>Number(p[metric])).filter(Number.isFinite)
  const pct=p=>getMetricEligibility(p,def,{players:pool,selectedMinimum:450}).eligible?calculateSportsbasePercentile(p[metric],values,def.higherIsBetter!==false):null
  const pa=a?pct(a):null,pb=b?pct(b):null
  return <div style={{display:'grid',gridTemplateColumns:'1fr minmax(140px,1.2fr) 1fr',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid #edf3ef`}}>
    <div style={{textAlign:'right'}}><strong style={{fontSize:11,color:pa!=null&&pb!=null&&pa>pb?C.green:C.ink}}>{a?formatSportsbaseMetric(a[metric],def):'—'}</strong><p style={{fontSize:8.5,color:C.muted}}>{pa==null?'sem amostra':`P${Math.round(pa)}`}</p></div>
    <div style={{textAlign:'center'}}><p style={{fontSize:9.5,fontWeight:850,color:C.ink}}>{def.label}</p><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,marginTop:5}}><div style={{height:5,borderRadius:9,background:'#edf3ef',overflow:'hidden',display:'flex',justifyContent:'flex-end'}}><div style={{width:`${pa||0}%`,background:C.green}}/></div><div style={{height:5,borderRadius:9,background:'#edf3ef',overflow:'hidden'}}><div style={{width:`${pb||0}%`,background:C.blue,height:'100%'}}/></div></div></div>
    <div><strong style={{fontSize:11,color:pa!=null&&pb!=null&&pb>pa?C.blue:C.ink}}>{b?formatSportsbaseMetric(b[metric],def):'—'}</strong><p style={{fontSize:8.5,color:C.muted}}>{pb==null?'sem amostra':`P${Math.round(pb)}`}</p></div>
  </div>
}

function PlayerSummary({player,tone}){const s=player?._scouting;if(!player)return <EmptyState icon="👤" title="Atleta não selecionado"/>;return <div><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}><div><h3 style={{fontSize:15,color:C.ink}}>{player.nome}</h3><p style={{fontSize:9.5,color:C.muted,marginTop:3}}>{player.equipa} · {leagueLabel(player._liga)} · {player.posicao} · Pé {playerFootLabel(player.pe)} · {player.idade||'—'} anos</p></div><ScoreBadge value={s?.finalScore} color={tone}/></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:12}}><MiniSignal label="Perfil" value={s?.profileScore||0} tone={tone}/><MiniSignal label="Tático" value={s?.tacticalScore||0} tone={C.purple}/><MiniSignal label="Amostra" value={s?.confidence?.label||'—'} tone={s?.confidence?.color||C.amber}/></div><p style={{fontSize:10.5,color:C.ink,lineHeight:1.5,marginTop:12}}><b>{s?.profile}</b>{s?.secondaryProfile?` · alternativa ${s.secondaryProfile}`:''}. Priorizar vídeo nas métricas de menor percentil e validar se os sinais decorrem da função real.</p></div>}

export default function ComparisonPage(){
  const [groups,setGroups]=useState(['AM']); const [league,setLeague]=useState(''); const [foot,setFoot]=useState(''); const [leagues,setLeagues]=useState([]); const [market,setMarket]=useState([]);const [guarani,setGuarani]=useState(null);const [loading,setLoading]=useState(true)
  const [modeA,setModeA]=useState('market'),[modeB,setModeB]=useState('confianca');const [queryA,setQueryA]=useState(''),[queryB,setQueryB]=useState('');const [rawA,setRawA]=useState(null),[rawB,setRawB]=useState(null);const [tab,setTab]=useState('metrics')
  const selectedGroupDefs=useMemo(()=>GROUPS.filter(item=>groups.includes(item.id)),[groups])
  const selectedPositions=useMemo(()=>[...new Set(selectedGroupDefs.flatMap(item=>item.positions.split(',')))].join(','),[selectedGroupDefs])
  const groupsKey=groups.join(',')
  const selectedGroupLabel=selectedGroupDefs.map(item=>item.label).join(' + ')
  const toggleGroup=id=>setGroups(current=>{
    if(current.includes(id)){
      if(current.length===1)return current
      return GROUPS.filter(item=>current.includes(item.id)&&item.id!==id).map(item=>item.id)
    }
    return GROUPS.filter(item=>current.includes(item.id)||item.id===id).map(item=>item.id)
  })
  useEffect(()=>{
    const search=new URLSearchParams(window.location.search)
    const initialLeague=search.get('liga')
    if(initialLeague)setLeague(initialLeague)
    Promise.all([fetch('/api/guarani-sportsbase').then(r=>r.json()),fetch('/api/ligas-v2/jogadores?limit=1').then(r=>r.json())]).then(([g,m])=>{setGuarani(g);setLeagues(m.ligas||[])}).finally(()=>setLoading(false))
  },[])
  useEffect(()=>{if(!guarani||!selectedPositions)return;setLoading(true);const params=new URLSearchParams({posicao:selectedPositions,limit:'600',minMin:'0',ordem:'minutos',dir:'desc'});if(league)params.set('liga',league);if(foot)params.set('pe',foot);fetch(`/api/ligas-v2/jogadores?${params}`).then(r=>r.json()).then(json=>{const pool=json.jogadores||[];setMarket(enrichScoutingPool(pool,guarani.model||null,450));const search=new URLSearchParams(window.location.search);const wanted=search.get('player')||search.get('nome');const wantedTeam=search.get('equipa');if(wanted){const found=pool.find(p=>p.nome===wanted&&(!wantedTeam||p.equipa===wantedTeam));if(found)setRawA(current=>current||found)}}).finally(()=>setLoading(false))},[groupsKey,league,foot,guarani,selectedPositions])
  useEffect(()=>{setRawA(current=>current&&includesPosition(current,selectedPositions)?current:null);setRawB(current=>current&&includesPosition(current,selectedPositions)?current:null);setQueryA('');setQueryB('')},[selectedPositions])
  const guaraniPool=useMemo(()=>enrichScoutingPool((guarani?.players||[]).filter(p=>includesPosition(p,selectedPositions)&&matchesPlayerFoot(p,foot)),guarani?.model||null,0),[guarani,selectedPositions,foot])
  const comparisonPool=useMemo(()=>market.map(p=>{const copy={...p};delete copy._scouting;return copy}),[market])
  const enrichSelected=raw=>raw?buildScoutingPlayer(raw,comparisonPool.length?comparisonPool:[raw],guarani?.model||null,450):null
  const a=useMemo(()=>enrichSelected(rawA),[rawA,comparisonPool,guarani]);const b=useMemo(()=>enrichSelected(rawB),[rawB,comparisonPool,guarani])
  const optionsA=modeA==='confianca'?guaraniPool:market;const optionsB=modeB==='confianca'?guaraniPool:market
  const metrics=useMemo(()=>groups.length===1?(METRICS[groups[0]]||[]):MULTI_GROUP_METRICS,[groupsKey])
  const winner=a&&b?(a._scouting.finalScore===b._scouting.finalScore?null:a._scouting.finalScore>b._scouting.finalScore?a:b):null
  const caveat=a&&b&&Math.abs((a._scouting.finalScore||0)-(b._scouting.finalScore||0))<5

  if(loading&&!guarani)return <ScoutingPage><LoadingState/></ScoutingPage>
  return <ScoutingPage maxWidth={1460}>
    <PageHeader title="Comparação Direta · Sportsbase" subtitle="Compare atletas em uma ou mais funções, com unidades corretas, amostra, percentis e referência tática do Confiança. Quando mais de uma função é selecionada, o universo estatístico e as métricas centrais são combinados." status={<StatusDot>{selectedGroupLabel}</StatusDot>} actions={<Link href="/database"><Button variant="secondary">← Base de Atletas</Button></Link>}/>
    <Panel title="Contexto da comparação" subtitle="Selecione uma ou mais posições para ampliar o universo de busca" bodyStyle={{padding:12}} style={{marginBottom:13}}><div style={{display:'grid',gridTemplateColumns:'minmax(300px,2fr) minmax(180px,1fr)',gap:10}}><div><div className="scout-scroll" style={{display:'flex',gap:5,overflowX:'auto'}}>{GROUPS.map(item=>{const selected=groups.includes(item.id);return <button key={item.id} type="button" aria-pressed={selected} onClick={()=>toggleGroup(item.id)} style={{whiteSpace:'nowrap',padding:'8px 11px',borderRadius:9,border:`1px solid ${selected?C.green:C.line}`,background:selected?C.green2:'#fff',color:selected?C.green:C.muted,fontSize:10,fontWeight:850,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5}}><span style={{fontSize:9}}>{selected?'✓':'+'}</span>{item.label}</button>})}</div><p style={{fontSize:8.5,color:C.muted,marginTop:6}}>{groups.length} {groups.length===1?'posição selecionada':'posições selecionadas'} · clique novamente para remover</p></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field label="Liga do mercado"><select value={league} onChange={e=>setLeague(e.target.value)} style={inputStyle}><option value="">Todas as ligas</option>{leagues.map(item=><option key={item} value={item}>{leagueLabel(item)}</option>)}</select></Field><Field label="Pé preferido"><select value={foot} onChange={e=>setFoot(e.target.value)} style={inputStyle}>{PLAYER_FOOT_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></Field></div></div></Panel>
    <div className="scout-two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}><Picker label="Atleta A" mode={modeA} setMode={setModeA} query={queryA} setQuery={setQueryA} options={optionsA} selected={a} onSelect={setRawA} guaraniAvailable={guaraniPool.length>0}/><Picker label="Atleta B" mode={modeB} setMode={setModeB} query={queryB} setQuery={setQueryB} options={optionsB} selected={b} onSelect={setRawB} guaraniAvailable={guaraniPool.length>0}/></div>
    {!a||!b?<Panel><EmptyState icon="📊" title="Selecione dois atletas" text="Use uma ou mais posições compatíveis com o objetivo da análise. O universo estatístico seguirá a seleção acima."/></Panel>:<div style={{display:'grid',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:9}}><Kpi label="Score A" value={a._scouting.finalScore} sub={`${a._scouting.profile} · ${a._scouting.confidence.label}`} icon="A"/><Kpi label="Score B" value={b._scouting.finalScore} sub={`${b._scouting.profile} · ${b._scouting.confidence.label}`} icon="B" tone={C.blue}/><Kpi label="Diferença" value={Math.abs(a._scouting.finalScore-b._scouting.finalScore)} sub={caveat?'margem estreita: vídeo decide':'diferença estatística relevante'} icon="↔️" tone={C.amber}/><Kpi label="Universo" value={comparisonPool.length} sub="pares no cálculo dos percentis" icon="🌐" tone={C.purple}/></div>
      <Tabs active={tab} onChange={setTab} items={[{id:'metrics',label:'Métricas pareadas',icon:'📊',flex:1},{id:'profiles',label:'Perfis funcionais',icon:'🧬',flex:1},{id:'decision',label:'Leitura de scouting',icon:'🧠',flex:1}]}/>
      {tab==='metrics'&&<Panel title="Volume × eficiência" subtitle="Percentuais exigem denominador mínimo; métricas por 90 exigem amostra"><div style={{display:'grid',gridTemplateColumns:'1fr minmax(140px,1.2fr) 1fr',gap:10,paddingBottom:9,borderBottom:`2px solid ${C.line}`}}><strong style={{textAlign:'right',color:C.green,fontSize:11}}>{a.nome}</strong><span/><strong style={{color:C.blue,fontSize:11}}>{b.nome}</strong></div>{metrics.map(metric=><MetricCompare key={metric} metric={metric} a={a} b={b} pool={comparisonPool}/>)}</Panel>}
      {tab==='profiles'&&<div className="scout-two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Panel title={a.nome} accent={C.green}><PlayerSummary player={a} tone={C.green}/><div style={{display:'grid',gap:10,marginTop:14}}>{(a._scouting.profileRanking?.[0]?.details||[]).filter(d=>d.percentile!==null).slice(0,7).map(item=><PercentileBar key={item.key} label={item.label} value={item.percentile} raw={formatSportsbaseMetric(item.value,getSportsbaseMetric(item.key)||item)} color={C.green}/>)}</div></Panel><Panel title={b.nome} accent={C.blue}><PlayerSummary player={b} tone={C.blue}/><div style={{display:'grid',gap:10,marginTop:14}}>{(b._scouting.profileRanking?.[0]?.details||[]).filter(d=>d.percentile!==null).slice(0,7).map(item=><PercentileBar key={item.key} label={item.label} value={item.percentile} raw={formatSportsbaseMetric(item.value,getSportsbaseMetric(item.key)||item)} color={C.blue}/>)}</div></Panel></div>}
      {tab==='decision'&&<Panel title="Síntese para decisão" subtitle="Não confundir melhor score com melhor contratação"><div className="scout-two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}><div><h3 style={{fontSize:13,color:C.ink}}>{winner?`${winner.nome} apresenta maior aderência estatística`:'Os atletas estão equilibrados no score'}</h3><p style={{fontSize:10.5,color:C.muted,lineHeight:1.6,marginTop:7}}>{caveat?'A diferença está dentro de uma faixa curta. Função real, modelo da equipe, adaptação, custo e evidência de vídeo devem ter mais peso que o score.':`A diferença integrada é de ${Math.abs(a._scouting.finalScore-b._scouting.finalScore)} pontos. Use esse sinal para definir a ordem de observação, não para encerrar a avaliação.`}</p><div style={{display:'flex',gap:8,marginTop:13}}><Link href="/centro-recrutamento"><Button>Enviar ao recrutamento</Button></Link><Link href="/recomendacoes"><Button variant="secondary">Ver recomendações</Button></Link></div></div><div><h3 style={{fontSize:11,color:C.green,marginBottom:8}}>Questões obrigatórias no vídeo</h3><ol style={{paddingLeft:18,display:'grid',gap:7,fontSize:10.5,color:C.muted,lineHeight:1.45}}><li>Os comportamentos aparecem na função e no corredor exigidos?</li><li>Como respondem sob pressão e em transições?</li><li>As ações de alto volume mantêm eficiência e qualidade de decisão?</li><li>Qual atleta reduz melhor a lacuna específica do elenco?</li><li>Há diferença de risco físico, adaptação, contrato e custo?</li></ol></div></div></Panel>}
    </div>}
  </ScoutingPage>
}
