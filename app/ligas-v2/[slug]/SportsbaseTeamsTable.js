'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const BRAND_PRIMARY='#0a66b7'

const fmt=(value,decimals=1)=>Number.isFinite(Number(value))?Number(value).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:decimals}):'—'

function PercentileBadge({ value }) {
  const numeric=Number(value)
  const bg=numeric>=75?'#dcfce7':numeric<=25?'#fee2e2':'#f1f5f9'
  const color=numeric>=75?'#15803d':numeric<=25?'#b91c1c':'#475569'
  return <span style={{display:'inline-block',minWidth:38,textAlign:'center',padding:'3px 7px',borderRadius:999,background:bg,color,fontSize:10,fontWeight:900}}>P{Number.isFinite(numeric)?Math.round(numeric):'—'}</span>
}

function DimensionBar({ label, value }) {
  const numeric=Math.max(0,Math.min(100,Number(value)||0))
  return <div style={{marginBottom:7}}>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#64748b',fontWeight:700,marginBottom:3}}><span>{label}</span><span>{Math.round(numeric)}</span></div>
    <div style={{height:5,borderRadius:999,background:'#e8f4ec',overflow:'hidden'}}><div style={{height:'100%',width:`${numeric}%`,background:BRAND_PRIMARY,borderRadius:999}}/></div>
  </div>
}

function SourceSwitch({ value, available, onChange }) {
  if (!onChange || (!available?.sportsbase && !available?.wyscout)) return null
  return <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
    <span style={{fontSize:8.5,fontWeight:900,color:'#94a3b8'}}>FONTE</span>
    {[['auto','Automático'],['sportsbase','Sportsbase'],['wyscout','Wyscout']].filter(([key])=>key==='auto'||available?.[key]).map(([key,label])=><button key={key} onClick={()=>onChange(key)} style={{border:`1px solid ${value===key?BRAND_PRIMARY:'#dbe7f2'}`,borderRadius:7,padding:'5px 8px',background:value===key?'#eaf4fd':'#fff',color:value===key?BRAND_PRIMARY:'#64748b',fontSize:9,fontWeight:800,cursor:'pointer'}}>{label}</button>)}
  </div>
}

export default function SportsbaseTeamsTable({ slug, sourcePreference='auto', onSourceChange }) {
  const [teams,setTeams]=useState([])
  const [loading,setLoading]=useState(true)
  const [uploadAt,setUploadAt]=useState(null)
  const [methodology,setMethodology]=useState('')
  const [source,setSource]=useState(null)
  const [limited,setLimited]=useState(false)
  const [availableSources,setAvailableSources]=useState({sportsbase:false,wyscout:false})
  const [search,setSearch]=useState('')
  const [sort,setSort]=useState('profile_score')

  const fetchTeams=useCallback(async()=>{
    setLoading(true)
    try {
      const query=sourcePreference&&sourcePreference!=='auto'?`?source=${sourcePreference}`:''
      const response=await fetch(`/api/ligas-v2/${slug}/teams${query}`)
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||'Falha ao carregar times')
      setTeams(data.times||[])
      setUploadAt(data.upload_at||null)
      setMethodology(data.methodology||'')
      setSource(data.source||null)
      setLimited(Boolean(data.limited))
      setAvailableSources(data.available_sources||{sportsbase:data.source==='sportsbase',wyscout:data.source==='wyscout'})
      if(data.source==='wyscout') setSort(current=>current==='profile_score'?'gols_90':current)
    } catch(error) {
      console.error(error)
      setTeams([])
    }
    setLoading(false)
  },[slug,sourcePreference])

  useEffect(()=>{fetchTeams()},[fetchTeams])

  const visible=useMemo(()=>{
    const filtered=teams.filter(team=>!search||team.team_name.toLowerCase().includes(search.toLowerCase()))
    return [...filtered].sort((a,b)=>{
      if(sort==='team_name') return a.team_name.localeCompare(b.team_name,'pt-BR')
      if(sort==='perdas_bola_90') return (Number(a[sort])||0)-(Number(b[sort])||0)
      return (Number(b[sort])||0)-(Number(a[sort])||0)
    })
  },[teams,search,sort])

  if(loading) return <div style={{padding:50,textAlign:'center',color:'#94a3b8'}}>Agregando os dados da liga por equipe...</div>
  if(!teams.length) return <div style={{padding:60,textAlign:'center',background:'#fff',borderRadius:12,border:'1px solid #e8f4ec'}}>
    <p style={{fontSize:28,marginBottom:8}}>🏟️</p>
    <p style={{fontWeight:800,color:'#2d4a35'}}>Nenhuma equipe encontrada</p>
    <p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>Envie Sportsbase ou Wyscout na aba Upload. A agregação é feita automaticamente.</p>
  </div>

  if(source==='wyscout') return <div>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap',marginBottom:14}}>
      <div><p style={{fontSize:11,color:'#64748b'}}>🔵 Wyscout · upload {uploadAt?new Date(uploadAt).toLocaleDateString('pt-BR'):'—'} · {teams.length} equipes agregadas</p><p style={{fontSize:10,color:'#94a3b8',marginTop:3}}>Perfil estatístico do elenco com produção, criação, progressão, defesa e distribuição.</p></div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><SourceSwitch value={sourcePreference} available={availableSources} onChange={onSourceChange}/><button onClick={fetchTeams} style={{border:`1px solid ${BRAND_PRIMARY}`,background:'#fff',color:BRAND_PRIMARY,borderRadius:8,padding:'7px 12px',fontSize:10,fontWeight:800,cursor:'pointer'}}>🔄 Atualizar</button></div>
    </div>
    <div style={{padding:'10px 12px',background:'#eef6ff',border:'1px solid #c9ddf8',borderRadius:10,fontSize:10,color:'#24558a',lineHeight:1.5,marginBottom:14}}><b>Leitura Wyscout:</b> os volumes por jogo são reconstruídos pelas taxas por 90 e minutos dos atletas. As eficiências são ponderadas pelo número estimado de tentativas. Não são dados coletivos evento a evento.</div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(190px,1fr) minmax(190px,1fr)',gap:10,marginBottom:14,maxWidth:650}}>
      <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="🔍 Buscar equipe" style={{border:'1px solid #dbe7f2',borderRadius:8,padding:'9px 11px',fontSize:11}}/>
      <select value={sort} onChange={event=>setSort(event.target.value)} style={{border:'1px solid #dbe7f2',borderRadius:8,padding:'9px 11px',fontSize:11,background:'#fff'}}><option value="profile_score">Perfil geral</option><option value="gols_90">Gols/jogo</option><option value="xg_90">xG/jogo</option><option value="passes_chave_90">Passes-chave/jogo</option><option value="passes_prog_90">Passes progressivos/jogo</option><option value="acoes_def_sucesso_90">Ações defensivas/jogo</option><option value="u23_minutes_pct">Minutos Sub-23</option><option value="players_total">Jogadores</option><option value="team_name">Nome</option></select>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>{visible.map(team=><Link key={team.team_name} href={`/ligas-v2/${slug}/times/${encodeURIComponent(team.team_name)}?source=${source}`} style={{textDecoration:'none'}}><article style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:13,padding:15,height:'100%',boxSizing:'border-box'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',marginBottom:12}}><div><p style={{fontSize:14,fontWeight:900,color:BRAND_PRIMARY}}>{team.team_name}</p><p style={{fontSize:9.5,color:'#94a3b8',marginTop:4}}>{team.players_total} jogadores · {team.players_450} com 450+ min · {fmt(team.match_equivalents,1)} jogos equivalentes</p></div><div style={{textAlign:'center',background:'#eaf2ff',borderRadius:10,padding:'6px 9px',minWidth:48}}><p style={{fontSize:16,fontWeight:900,color:'#1d4ed8'}}>{fmt(team.profile_score,0)}</p><p style={{fontSize:8,color:'#1d4ed8',fontWeight:800}}>PERFIL #{team.profile_rank}</p></div></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:12}}>{[['Gols',team.gols_90],['xG',team.xg_90],['P. chave',team.passes_chave_90],['P. prog.',team.passes_prog_90]].map(([label,value])=><div key={label} style={{background:'#f8fdf9',borderRadius:8,padding:'7px 5px',textAlign:'center'}}><p style={{fontSize:8,color:'#94a3b8',fontWeight:700}}>{label}/jogo</p><p style={{fontSize:12,fontWeight:900,color:'#10233b',marginTop:2}}>{fmt(value,2)}</p></div>)}</div><DimensionBar label="Produção" value={team.dimensions?.producao}/><DimensionBar label="Criação" value={team.dimensions?.criacao}/><DimensionBar label="Progressão" value={team.dimensions?.progressao}/><DimensionBar label="Defesa" value={team.dimensions?.defesa}/><DimensionBar label="Distribuição" value={team.dimensions?.distribuicao}/><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,paddingTop:10,borderTop:'1px solid #edf4ef'}}><span style={{fontSize:9.5,color:'#64748b'}}>Sub-23: <b>{fmt(team.u23_minutes_pct,1)}%</b></span><div style={{display:'flex',gap:4}}><PercentileBadge value={team.metric_percentiles?.gols_90}/><PercentileBadge value={team.metric_percentiles?.acoes_def_sucesso_90}/></div></div></article></Link>)}</div>
    {methodology&&<p style={{fontSize:9,color:'#94a3b8',marginTop:14,lineHeight:1.5}}>{methodology}</p>}
  </div>

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap',marginBottom:14}}>
      <div>
        <p style={{fontSize:11,color:'#64748b'}}>🔄 Upload {uploadAt?new Date(uploadAt).toLocaleDateString('pt-BR'):'—'} · {teams.length} equipes agregadas automaticamente</p>
        <p style={{fontSize:10,color:'#94a3b8',marginTop:3}}>Não exige upload coletivo separado. Os indicadores representam o perfil estatístico agregado do elenco.</p>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><SourceSwitch value={sourcePreference} available={availableSources} onChange={onSourceChange}/><button onClick={fetchTeams} style={{border:`1px solid ${BRAND_PRIMARY}`,background:'#fff',color:BRAND_PRIMARY,borderRadius:8,padding:'7px 12px',fontSize:10,fontWeight:800,cursor:'pointer'}}>🔄 Atualizar</button></div>
    </div>

    <div style={{padding:'10px 12px',background:'#effaf3',border:'1px solid #bbf7d0',borderRadius:10,fontSize:10,color:'#166534',lineHeight:1.5,marginBottom:14}}>
      <b>Leitura correta:</b> as taxas por 90 são calculadas sobre equivalentes de jogo da equipe (soma dos jogador-minutos ÷ 900 quando o export não tem goleiros; ÷ 990 quando tem), e as eficiências são ponderadas pelo volume de tentativas. Não são dados de posse, PPDA ou eventos coletivos jogo a jogo.
    </div>

    <div style={{display:'grid',gridTemplateColumns:'minmax(190px,1fr) minmax(190px,1fr)',gap:10,marginBottom:14,maxWidth:650}}>
      <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="🔍 Buscar equipe" style={{border:'1px solid #dbe7f2',borderRadius:8,padding:'9px 11px',fontSize:11}}/>
      <select value={sort} onChange={event=>setSort(event.target.value)} style={{border:'1px solid #dbe7f2',borderRadius:8,padding:'9px 11px',fontSize:11,background:'#fff'}}>
        <option value="profile_score">Ordenar: perfil geral</option>
        <option value="gols_90">Gols/90</option>
        <option value="xg_90">xG/90</option>
        <option value="passes_prog_90">Passes progressivos/90</option>
        <option value="recuperacoes_90">Recuperações/90</option>
        <option value="perdas_bola_90">Menos perdas/90</option>
        <option value="u23_minutes_pct">Minutos Sub-23</option>
        <option value="team_name">Nome</option>
      </select>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(285px,1fr))',gap:12}}>
      {visible.map(team=><Link key={team.team_name} href={`/ligas-v2/${slug}/times/${encodeURIComponent(team.team_name)}?source=${source}`} style={{textDecoration:'none'}}>
        <article style={{background:'#fff',border:'1px solid #dbe7f2',borderRadius:13,padding:15,height:'100%',boxSizing:'border-box',transition:'transform .15s,box-shadow .15s'}}
          onMouseEnter={event=>{event.currentTarget.style.transform='translateY(-2px)';event.currentTarget.style.boxShadow='0 8px 22px rgba(10,102,183,.10)'}}
          onMouseLeave={event=>{event.currentTarget.style.transform='none';event.currentTarget.style.boxShadow='none'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',marginBottom:12}}>
            <div>
              <p style={{fontSize:14,fontWeight:900,color:BRAND_PRIMARY,lineHeight:1.2}}>{team.team_name}</p>
              <p style={{fontSize:9.5,color:'#94a3b8',marginTop:4}}>{team.players_total} jogadores · {team.players_450} com 450+ min · {fmt(team.match_equivalents,1)} jogos equivalentes</p>
            </div>
            <div style={{textAlign:'center',background:'#eaf4fd',borderRadius:10,padding:'6px 9px',minWidth:46}}>
              <p style={{fontSize:16,fontWeight:900,color:BRAND_PRIMARY}}>{fmt(team.profile_score,0)}</p>
              <p style={{fontSize:8,color:'#15803d',fontWeight:800}}>PERFIL #{team.profile_rank}</p>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:12}}>
            {[
              ['Gols/90',team.gols_90],['xG/90',team.xg_90],['P. Prog/90',team.passes_prog_90],['Recup./90',team.recuperacoes_90],
            ].map(([label,value])=><div key={label} style={{background:'#f8fdf9',borderRadius:8,padding:'7px 5px',textAlign:'center'}}><p style={{fontSize:8,color:'#94a3b8',fontWeight:700}}>{label}</p><p style={{fontSize:12,fontWeight:900,color:'#10233b',marginTop:2}}>{fmt(value,2)}</p></div>)}
          </div>

          <DimensionBar label="Produção" value={team.dimensions?.producao}/>
          <DimensionBar label="Criação" value={team.dimensions?.criacao}/>
          <DimensionBar label="Defesa" value={team.dimensions?.defesa}/>
          <DimensionBar label="Segurança" value={team.dimensions?.seguranca}/>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,paddingTop:10,borderTop:'1px solid #edf4ef'}}>
            <span style={{fontSize:9.5,color:'#64748b'}}>Sub-23: <b>{fmt(team.u23_minutes_pct,1)}%</b> dos minutos</span>
            <div style={{display:'flex',gap:4}}><PercentileBadge value={team.metric_percentiles?.gols_90}/><PercentileBadge value={team.metric_percentiles?.recuperacoes_90}/></div>
          </div>
        </article>
      </Link>)}
    </div>
    {methodology&&<p style={{fontSize:9,color:'#94a3b8',marginTop:14,lineHeight:1.5}}>{methodology}</p>}
  </div>
}
