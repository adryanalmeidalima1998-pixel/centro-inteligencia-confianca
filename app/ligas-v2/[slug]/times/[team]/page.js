'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import AppShell from '../../../../components/layout/AppShell'
import { getLeague } from '@/data/leagues'
import { SPORTSBASE_TEAM_DIMENSIONS, SPORTSBASE_TEAM_METRICS } from '@/data/sportsbase-team-analytics'
import { WYSCOUT_TEAM_DIMENSIONS, WYSCOUT_TEAM_METRICS } from '@/data/wyscout-team-analytics'
import { playerProfilePath } from '@/data/player-route'

const GFC='#0a66b7'
const profileHref=(slug,player)=>player?._canonical_id?`/database/${player._canonical_id}`:playerProfilePath(slug,player)
const fmt=(value,decimals=2)=>Number.isFinite(Number(value))?Number(value).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:decimals}):'—'

function PositionBadge({ value }) {
  const first=String(value||'—').split(',')[0].trim()
  return <span style={{fontSize:9,fontWeight:900,padding:'3px 6px',borderRadius:5,background:'#eef7f1',color:GFC}}>{first}</span>
}

function PercentileBadge({ value }) {
  const numeric=Number(value)
  const background=numeric>=75?'#dcfce7':numeric<=25?'#fee2e2':'#f1f5f9'
  const color=numeric>=75?'#15803d':numeric<=25?'#b91c1c':'#475569'
  return <span style={{fontSize:10,fontWeight:900,padding:'3px 8px',borderRadius:999,background,color}}>P{Number.isFinite(numeric)?Math.round(numeric):'—'}</span>
}

function ScoreCard({ label, value, sub }) {
  return <div style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:12,padding:'13px 15px'}}>
    <p style={{fontSize:9,color:'#94a3b8',fontWeight:800,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</p>
    <p style={{fontSize:21,fontWeight:900,color:'#10233b',marginTop:4}}>{value}</p>
    {sub&&<p style={{fontSize:9.5,color:'#64748b',marginTop:3}}>{sub}</p>}
  </div>
}

function DimensionCards({ team, dimensions }) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,marginBottom:20}}>
    {Object.entries(dimensions).map(([key,item])=>{
      const value=Number(team.dimensions?.[key])||0
      return <div key={key} style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:11,padding:'12px 14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><p style={{fontSize:10,fontWeight:800,color:'#334155'}}>{item.label}</p><span style={{fontSize:16,fontWeight:900,color:GFC}}>{Math.round(value)}</span></div>
        <div style={{height:6,background:'#e8f4ec',borderRadius:999,overflow:'hidden',marginTop:8}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,value))}%`,background:GFC,borderRadius:999}}/></div>
      </div>
    })}
  </div>
}

function MetricTable({ team, metrics }) {
  const groups=[...new Set(metrics.map(metric=>metric.group))]
  return <div style={{display:'flex',flexDirection:'column',gap:13}}>
    {groups.map(group=>{
      const groupMetrics=metrics.filter(metric=>metric.group===group)
      return <section key={group} style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',background:'#f8fdf9',borderBottom:'1px solid #edf4ef'}}><h3 style={{fontSize:12,fontWeight:900,color:'#10233b'}}>{group}</h3></div>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:560}}>
          <thead><tr>{['Métrica','Valor agregado','Percentil na liga','Leitura'].map(header=><th key={header} style={{padding:'8px 12px',fontSize:9,color:'#94a3b8',fontWeight:800,textAlign:header==='Métrica'?'left':'center',borderBottom:'1px solid #edf4ef'}}>{header}</th>)}</tr></thead>
          <tbody>{groupMetrics.map((metric,index)=>{
            const value=team[metric.key]
            const percentile=team.metric_percentiles?.[metric.key]
            const reading=Number(percentile)>=75?'Força do perfil':Number(percentile)<=25?'Ponto de atenção':'Faixa intermediária'
            return <tr key={metric.key} style={{background:index%2?'#fcfdfc':'#fff',borderBottom:'1px solid #f1f5f2'}}>
              <td style={{padding:'9px 12px',fontSize:11,fontWeight:700,color:'#334155'}}>{metric.label}</td>
              <td style={{padding:'9px 12px',fontSize:12,fontWeight:900,color:'#10233b',textAlign:'center'}}>{fmt(value,metric.percent?1:2)}{metric.percent&&value!=null?'%':''}</td>
              <td style={{padding:'9px 12px',textAlign:'center'}}><PercentileBadge value={percentile}/></td>
              <td style={{padding:'9px 12px',fontSize:10,color:Number(percentile)>=75?'#15803d':Number(percentile)<=25?'#b91c1c':'#64748b',fontWeight:700,textAlign:'center'}}>{reading}</td>
            </tr>
          })}</tbody>
        </table></div>
      </section>
    })}
  </div>
}

function SquadTable({ players, slug, source }) {
  const wyscout=source==='wyscout'
  const headers=wyscout?['Jogador','Pos','Idade','Min','Jogos','Gols','xG','Assist.','P. chave/90','P. prog./90','Ações def./90']:['Jogador','Pos','Idade','Min','Jogos','Gols','xG','Assist.','P. chave','P. prog.','Recup.']
  return <div style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:12,overflow:'hidden'}}>
    <div style={{padding:'11px 14px',background:'#f8fdf9',borderBottom:'1px solid #edf4ef'}}><h3 style={{fontSize:12,fontWeight:900,color:'#10233b'}}>Elenco no upload atual</h3></div>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:760}}>
      <thead><tr>{headers.map(header=><th key={header} style={{padding:'8px 10px',fontSize:9,color:'#94a3b8',fontWeight:800,textAlign:header==='Jogador'?'left':'center',borderBottom:'1px solid #edf4ef'}}>{header}</th>)}</tr></thead>
      <tbody>{players.map((player,index)=><tr key={`${player.nome}-${index}`} style={{background:index%2?'#fcfdfc':'#fff',borderBottom:'1px solid #f1f5f2'}}>
        <td style={{padding:'9px 10px'}}><Link href={profileHref(slug, player)} style={{fontSize:11,fontWeight:800,color:GFC,textDecoration:'none'}}>{player.nome}</Link></td>
        <td style={{padding:'9px 10px',textAlign:'center'}}><PositionBadge value={player.posicao}/></td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10,color:'#64748b'}}>{player.idade||'—'}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10,fontWeight:700,color:'#334155'}}>{Math.round(Number(player.minutos)||0)}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10,color:'#64748b'}}>{player.jogos||'—'}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10,fontWeight:800}}>{fmt(player.gols,0)}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10}}>{fmt(player.xg,2)}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10}}>{fmt(player.assistencias,0)}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10}}>{fmt(wyscout?player.passes_chave_90:player.passes_chave,wyscout?2:0)}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10}}>{fmt(wyscout?player.passes_prog_90:player.passes_prog,wyscout?2:0)}</td>
        <td style={{padding:'9px 10px',textAlign:'center',fontSize:10}}>{fmt(wyscout?player.acoes_def_sucesso_90:player.recuperacoes,wyscout?2:0)}</td>
      </tr>)}</tbody>
    </table></div>
  </div>
}

function Leaders({ leaders, slug }) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(245px,1fr))',gap:12}}>
    {leaders.map(item=><div key={item.key} style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'10px 13px',background:'#f8fdf9',borderBottom:'1px solid #edf4ef'}}><p style={{fontSize:11,fontWeight:900,color:'#10233b'}}>{item.label}</p></div>
      {item.players.map((player,index)=><div key={`${player.nome}-${index}`} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'9px 13px',borderBottom:'1px solid #f1f5f2'}}>
        <div><p style={{fontSize:10.5,fontWeight:800,color:index===0?GFC:'#334155'}}>{index+1}. <Link href={profileHref(slug, player)} style={{color:'inherit',textDecoration:'none'}}>{player.nome}</Link></p><p style={{fontSize:9,color:'#94a3b8',marginTop:2}}>{String(player.posicao||'').split(',')[0]} · {Math.round(player.minutos||0)} min</p></div>
        <span style={{fontSize:14,fontWeight:900,color:index===0?GFC:'#10233b'}}>{fmt(player.value,(player._rate||item.key==='xg')?2:0)}</span>
      </div>)}
    </div>)}
  </div>
}

function TimePageInner() {
  const params=useParams()
  const searchParams=useSearchParams()
  const sourcePreference=searchParams.get('source') || 'auto'
  const slug=params?.slug
  const teamName=decodeURIComponent(params?.team||'')
  const liga=getLeague(slug)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('perfil')

  const fetchData=useCallback(async()=>{
    setLoading(true)
    try {
      const query=sourcePreference!=='auto'?`?source=${sourcePreference}`:''
      const response=await fetch(`/api/ligas-v2/${slug}/teams/${encodeURIComponent(teamName)}${query}`)
      const result=await response.json()
      if(!response.ok) throw new Error(result.error||'Falha ao carregar equipe')
      setData(result)
    } catch(error) {
      console.error(error)
      setData(null)
    }
    setLoading(false)
  },[slug,teamName,sourcePreference])

  useEffect(()=>{if(slug&&teamName)fetchData()},[slug,teamName,fetchData])

  const dimensions=data?.source==='wyscout'?WYSCOUT_TEAM_DIMENSIONS:SPORTSBASE_TEAM_DIMENSIONS
  const metricDefinitions=data?.source==='wyscout'?WYSCOUT_TEAM_METRICS:SPORTSBASE_TEAM_METRICS
  const radar=useMemo(()=>data?.team?Object.entries(data?.source==='wyscout'?WYSCOUT_TEAM_DIMENSIONS:SPORTSBASE_TEAM_DIMENSIONS).map(([key,item])=>({subject:item.label.replace('Eficiência de ',''),value:Number(data.team.dimensions?.[key])||0,fullMark:100})):[],[data])

  if(loading) return <AppShell><div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>Carregando perfil estatístico da equipe...</div></AppShell>
  if(!data?.team) return <AppShell><div style={{padding:60,textAlign:'center'}}><p style={{fontSize:28}}>⚠️</p><p style={{fontWeight:800,color:'#b91c1c',marginTop:8}}>Equipe não encontrada no upload atual</p><Link href={`/ligas-v2/${slug}`} style={{display:'inline-block',marginTop:12,color:GFC,fontSize:12}}>← Voltar à liga</Link></div></AppShell>

  const team=data.team
  return <AppShell><div style={{padding:'32px 32px 48px',maxWidth:1300}}>
    <div style={{fontSize:11,color:'#94a3b8',marginBottom:18}}><Link href="/ligas-v2" style={{color:'#94a3b8',textDecoration:'none'}}>Ligas</Link> › <Link href={`/ligas-v2/${slug}`} style={{color:'#94a3b8',textDecoration:'none'}}>{liga?.nome||slug}</Link> › <b style={{color:'#334155'}}>{teamName}</b></div>

    <div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start',flexWrap:'wrap',marginBottom:20}}>
      <div style={{display:'flex',gap:15,alignItems:'center'}}>
        <div style={{width:62,height:62,borderRadius:14,background:'linear-gradient(135deg,#064b82,#008044)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🏟️</div>
        <div><h1 style={{fontSize:24,fontWeight:900,color:'#10233b'}}>{teamName}</h1><p style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{liga?.nome} · {data.source==='wyscout'?'Wyscout':'Sportsbase'} · {team.players_total} jogadores · upload {data.upload_at?new Date(data.upload_at).toLocaleDateString('pt-BR'):'—'}</p></div>
      </div>
      <div style={{background:'#eaf4fd',border:'1px solid #bbf7d0',borderRadius:12,padding:'9px 14px',textAlign:'center'}}><p style={{fontSize:22,fontWeight:900,color:GFC}}>{fmt(team.profile_score,0)}</p><p style={{fontSize:9,fontWeight:900,color:'#15803d'}}>PERFIL #{team.profile_rank} DE {data.league_teams}</p></div>
    </div>

    <div style={{padding:'10px 13px',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10,fontSize:10,color:'#9a3412',lineHeight:1.5,marginBottom:18}}><b>Escopo:</b> esta tela descreve o perfil agregado do elenco a partir do arquivo de jogadores. Ela não substitui dados coletivos de jogo como posse, PPDA, altura do bloco ou confrontos contra adversários.</div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:20}}>
      <ScoreCard label="Jogos equivalentes" value={fmt(team.match_equivalents,1)} sub={`jogador-minutos ÷ ${team.minute_basis || 990}`}/>
      <ScoreCard label="Gols / jogo" value={fmt(team.gols_90,2)} sub={`P${team.metric_percentiles?.gols_90??'—'} na liga`}/>
      <ScoreCard label="xG / jogo" value={fmt(team.xg_90,2)} sub={`P${team.metric_percentiles?.xg_90??'—'} na liga`}/>
      {data.source==='wyscout'?<ScoreCard label="Ações defensivas / jogo" value={fmt(team.acoes_def_sucesso_90,2)} sub={`P${team.metric_percentiles?.acoes_def_sucesso_90??'—'} na liga`}/>:<ScoreCard label="Recuperações / 90" value={fmt(team.recuperacoes_90,2)} sub={`P${team.metric_percentiles?.recuperacoes_90??'—'} na liga`}/>} 
      <ScoreCard label="Minutos Sub-23" value={`${fmt(team.u23_minutes_pct,1)}%`} sub={`idade média ponderada ${fmt(team.avg_age,1)}`}/>
      <ScoreCard label="Concentração de gols" value={`${fmt(team.goals_top3_share,1)}%`} sub="parcela dos 3 principais"/>
    </div>

    <div style={{display:'flex',gap:4,background:'#f8fdf9',borderRadius:10,padding:4,width:'fit-content',marginBottom:18,flexWrap:'wrap'}}>
      {[['perfil','📊 Perfil'],['metricas','📋 Métricas'],['destaques','⭐ Destaques'],['elenco','👥 Elenco']].map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{padding:'8px 16px',border:'none',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:800,background:tab===key?GFC:'transparent',color:tab===key?'#fff':'#64748b'}}>{label}</button>)}
    </div>

    {tab==='perfil'&&<div>
      <DimensionCards team={team} dimensions={dimensions}/>
      <div style={{display:'grid',gridTemplateColumns:'minmax(330px,1.1fr) minmax(300px,.9fr)',gap:16,alignItems:'stretch'}}>
        <div style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:12,padding:14,height:390}}>
          <h3 style={{fontSize:12,fontWeight:900,color:'#10233b',marginBottom:4}}>Radar do perfil relativo à liga</h3><p style={{fontSize:9.5,color:'#94a3b8'}}>100 = topo do campeonato no conjunto de métricas da dimensão.</p>
          <div style={{height:330}}><ResponsiveContainer width="100%" height="100%"><RadarChart data={radar}><PolarGrid/><PolarAngleAxis dataKey="subject" tick={{fontSize:9}}/><PolarRadiusAxis domain={[0,100]} tick={{fontSize:8}}/><Radar dataKey="value" stroke={GFC} fill={GFC} fillOpacity={0.28}/><Tooltip/></RadarChart></ResponsiveContainer></div>
        </div>
        <div style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:12,padding:15}}>
          <h3 style={{fontSize:12,fontWeight:900,color:'#10233b',marginBottom:13}}>Composição e dependência</h3>
          {(data.source==='wyscout' ? [
            ['Jogadores com 450+ min',`${team.players_450} de ${team.players_total}`],
            ['Top 3 no xG',`${fmt(team.xg_top3_share,1)}%`],
            ['Top 3 na criação',`${fmt(team.creation_top3_share,1)}%`],
            ['Zagueiros / laterais',`${team.positions?.CB||0} / ${team.positions?.FB||0}`],
            ['Volantes / meias / extremos',`${team.positions?.DM||0} / ${team.positions?.AM||0} / ${team.positions?.WG||0}`],
            ['Atacantes / goleiros',`${team.positions?.ST||0} / ${team.positions?.GK||0}`],
          ] : [
            ['Jogadores com 450+ min',`${team.players_450} de ${team.players_total}`],
            ['Índice Sportsbase ponderado',fmt(team.avg_index,1)],
            ['Top 3 no xG',`${fmt(team.xg_top3_share,1)}%`],
            ['Top 3 na criação',`${fmt(team.creation_top3_share,1)}%`],
            ['Zagueiros / laterais',`${team.positions?.CB||0} / ${team.positions?.FB||0}`],
            ['Volantes / meias / extremos',`${team.positions?.DM||0} / ${team.positions?.AM||0} / ${team.positions?.WG||0}`],
            ['Atacantes',team.positions?.ST||0],
          ]).map(([label,value])=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'10px 0',borderBottom:'1px solid #edf4ef'}}><span style={{fontSize:10.5,color:'#64748b'}}>{label}</span><b style={{fontSize:11,color:'#10233b'}}>{value}</b></div>)}
        </div>
      </div>
    </div>}
    {tab==='metricas'&&<MetricTable team={team} metrics={metricDefinitions}/>} 
    {tab==='destaques'&&<Leaders leaders={data.leaders||[]} slug={slug}/>} 
    {tab==='elenco'&&<SquadTable players={data.players||[]} slug={slug} source={data.source}/>} 

    {data.methodology&&<p style={{fontSize:9,color:'#94a3b8',lineHeight:1.5,marginTop:16}}>{data.methodology}</p>}
  </div></AppShell>
}


export default function TimePage() {
  return (
    <Suspense fallback={<AppShell><div style={{padding:60,textAlign:'center',color:'#94a3b8'}}>Carregando perfil estatístico da equipe...</div></AppShell>}>
      <TimePageInner />
    </Suspense>
  )
}
