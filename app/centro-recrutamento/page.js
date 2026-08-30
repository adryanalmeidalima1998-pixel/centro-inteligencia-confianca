'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button, C, ConfidenceBadge, EmptyState, Field, inputStyle, Kpi, LoadingState,
  MiniSignal, PageHeader, Panel, PercentileBar, ScoreBadge, ScoutingPage, StatusDot, Tabs,
} from '@/app/components/scouting/ScoutingUI'
import {
  enrichScoutingPool, getGroupLabel, getProfilesForGroup, scoutingNarrative,
} from '@/data/sportsbase-scouting'
import { formatSportsbaseMetric, getSportsbaseMetric } from '@/data/sportsbase-map'
import { PLAYER_FOOT_OPTIONS, playerFootLabel } from '@/data/player-foot'

const GROUPS = [
  { id:'CB', label:'Zagueiro', icon:'🛡️', positions:'CB,LCB,RCB' },
  { id:'FB', label:'Lateral', icon:'↔️', positions:'LB,RB,LWB,RWB' },
  { id:'DM', label:'Volante', icon:'⚙️', positions:'DMF,CMF,LCMF,RCMF,LDMF,RDMF,CDM,LCDM,RCDM,LDM,RDM,LCM,RCM' },
  { id:'AM', label:'Meia', icon:'🎯', positions:'AMF,CAM,LCAM,RCAM,LM,RM' },
  { id:'WG', label:'Extremo', icon:'⚡', positions:'LWF,RWF,LW,RW,LAMF,RAMF,LAM,RAM' },
  { id:'ST', label:'Atacante', icon:'🔥', positions:'CF,LCF,RCF,SS' },
]
const ETAPAS = ['Identificados','Análise em vídeo','Observação ao vivo','Pré-lista','Alvo prioritário','Acompanhamento']
const PRIORITY = { Alta:C.red, Média:C.amber, Baixa:C.muted }
const stageTone = { Identificados:C.blue, 'Análise em vídeo':C.purple, 'Observação ao vivo':'#0f766e', 'Pré-lista':C.amber, 'Alvo prioritário':C.red, Acompanhamento:C.muted }

const initialFocus = {
  nome:'', descricao:'', groupCode:'CB', papel:'', prioridade:'Média', idade_min:18,
  idade_max:30, min_minutos:500, liga:'', pe:'', tipo_necessidade:'Carência do elenco', janela:'Próxima janela',
}

function leagueLabel(value='') { return String(value).replace('brasileirao-','Brasileirão ').replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase()) }
function fmt(value, digits=1) { const n=Number(value); return Number.isFinite(n) ? n.toLocaleString('pt-BR',{maximumFractionDigits:digits}) : '—' }
function focusCode(focus) {
  const explicit = focus?.config_observacao?.groupCode || focus?.group_code
  if (explicit) return explicit
  const pos = String(focus?.posicao || '')
  return GROUPS.find(group => group.positions.split(',').some(code => pos.split(',').includes(code)))?.id || 'CB'
}

function FocusModal({ onClose, onCreated, leagues }) {
  const [form, setForm] = useState(initialFocus)
  const [saving, setSaving] = useState(false)
  const group = GROUPS.find(item => item.id === form.groupCode)
  const profiles = Object.keys(getProfilesForGroup(form.groupCode))
  function update(key, value) { setForm(prev => ({ ...prev, [key]:value, ...(key === 'groupCode' ? { papel:'' } : {}) })) }
  async function save(event) {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch('/api/focos-recrutamento', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        ...form, posicao:group.positions, pos_grupo:group.label, config_observacao:{ groupCode:form.groupCode, source:'sportsbase', model:'confianca' },
      }) })
      const json = await response.json(); if (!response.ok) throw new Error(json.error || 'Não foi possível criar o foco.')
      onCreated(json.id); onClose()
    } catch (error) { alert(error.message) } finally { setSaving(false) }
  }
  return <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(10,31,19,.52)', display:'grid', placeItems:'center', padding:20 }} onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <form onSubmit={save} style={{ width:'min(720px,96vw)', maxHeight:'90vh', overflow:'auto', background:'#fff', borderRadius:18, boxShadow:'0 24px 80px rgba(0,0,0,.25)' }}>
      <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.line}`, display:'flex', justifyContent:'space-between' }}><div><h2 style={{fontSize:17,color:C.ink}}>Novo foco de recrutamento</h2><p style={{fontSize:10.5,color:C.muted,marginTop:3}}>Transforme uma necessidade do elenco em recorte estatístico e roteiro de observação.</p></div><button type="button" onClick={onClose} style={{border:0,background:'none',fontSize:20,cursor:'pointer'}}>×</button></div>
      <div style={{ padding:20, display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }}>
        <Field label="Nome do foco" style={{gridColumn:'1/-1'}}><input required value={form.nome} onChange={e=>update('nome',e.target.value)} placeholder="Ex.: Volante progressor Sub-25" style={inputStyle}/></Field>
        <Field label="Grupo funcional"><select value={form.groupCode} onChange={e=>update('groupCode',e.target.value)} style={inputStyle}>{GROUPS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <Field label="Perfil Sportsbase"><select value={form.papel} onChange={e=>update('papel',e.target.value)} style={inputStyle}><option value="">Qualquer perfil</option>{profiles.map(profile=><option key={profile}>{profile}</option>)}</select></Field>
        <Field label="Liga"><select value={form.liga} onChange={e=>update('liga',e.target.value)} style={inputStyle}><option value="">Todas as ligas</option>{leagues.map(liga=><option key={liga} value={liga}>{leagueLabel(liga)}</option>)}</select></Field>
        <Field label="Pé preferido"><select value={form.pe} onChange={e=>update('pe',e.target.value)} style={inputStyle}>{PLAYER_FOOT_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        <Field label="Prioridade"><select value={form.prioridade} onChange={e=>update('prioridade',e.target.value)} style={inputStyle}>{['Alta','Média','Baixa'].map(item=><option key={item}>{item}</option>)}</select></Field>
        <Field label="Idade mínima"><input type="number" value={form.idade_min} onChange={e=>update('idade_min',Number(e.target.value)||0)} style={inputStyle}/></Field>
        <Field label="Idade máxima"><input type="number" value={form.idade_max} onChange={e=>update('idade_max',Number(e.target.value)||45)} style={inputStyle}/></Field>
        <Field label="Minutos mínimos"><input type="number" value={form.min_minutos} onChange={e=>update('min_minutos',Number(e.target.value)||0)} style={inputStyle}/></Field>
        <Field label="Janela"><select value={form.janela} onChange={e=>update('janela',e.target.value)} style={inputStyle}>{['Imediata','Próxima janela','Monitoramento'].map(item=><option key={item}>{item}</option>)}</select></Field>
        <Field label="Descrição / problema do elenco" style={{gridColumn:'1/-1'}}><textarea value={form.descricao} onChange={e=>update('descricao',e.target.value)} rows={3} placeholder="Contexto tático, lacuna observada, comportamento esperado..." style={{...inputStyle,resize:'vertical'}}/></Field>
      </div>
      <div style={{padding:'14px 20px',borderTop:`1px solid ${C.line}`,display:'flex',justifyContent:'flex-end',gap:8}}><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando...':'Criar foco'}</Button></div>
    </form>
  </div>
}

function PlayerCard({ player, onOpen, onAdd, added }) {
  const s = player._scouting || {}
  const narrative = scoutingNarrative(player)
  return <div className="scout-hover" style={{border:`1px solid ${C.line}`,borderRadius:13,padding:13,background:'#fff',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:12}}>
    <button onClick={()=>onOpen(player)} style={{border:0,background:'transparent',padding:0,textAlign:'left',cursor:'pointer',minWidth:0}}>
      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}><strong style={{fontSize:11.5,color:C.ink}}>{player.nome}</strong><span style={{fontSize:9,fontWeight:850,padding:'3px 6px',borderRadius:6,background:'#eef5f0',color:C.green}}>{player.posicao}</span><ConfidenceBadge confidence={s.confidence}/></div>
      <p style={{fontSize:9.5,color:C.muted,marginTop:4}}>{player.equipa} · {leagueLabel(player._liga)} · Pé {playerFootLabel(player.pe)} · {player.idade||'—'} anos · {fmt(player.minutos,0)} min</p>
      <p style={{fontSize:10,color:C.ink,marginTop:7,lineHeight:1.4}}><b>{s.profile}</b> · {narrative.observation}</p>
    </button>
    <div style={{display:'flex',alignItems:'center',gap:7}}><ScoreBadge value={s.finalScore}/><Button variant={added?'soft':'secondary'} disabled={added} onClick={()=>onAdd(player)} style={{padding:'7px 9px'}}>{added?'No pipeline':'Adicionar'}</Button></div>
  </div>
}

function CandidateModal({ player, onClose, onAdd, added }) {
  if (!player) return null
  const s = player._scouting || {}; const profile = s.profileRanking?.[0]
  return <div style={{position:'fixed',inset:0,zIndex:101,background:'rgba(10,31,19,.52)',display:'grid',placeItems:'center',padding:20}} onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <div style={{width:'min(860px,96vw)',maxHeight:'90vh',overflow:'auto',background:'#fff',borderRadius:18}}>
      <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.line}`,display:'flex',justifyContent:'space-between',gap:12}}><div><h2 style={{fontSize:18,color:C.ink}}>{player.nome}</h2><p style={{fontSize:10.5,color:C.muted,marginTop:3}}>{player.equipa} · {leagueLabel(player._liga)} · {player.posicao} · Pé {playerFootLabel(player.pe)} · {fmt(player.minutos,0)} min</p></div><button onClick={onClose} style={{border:0,background:'none',fontSize:20,cursor:'pointer'}}>×</button></div>
      <div className="scout-two-col" style={{padding:20,display:'grid',gridTemplateColumns:'1.05fr .95fr',gap:14}}>
        <Panel title="Leitura funcional" subtitle={`${s.profile} · cobertura ${profile?.coverage||0}%`}><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:15}}><MiniSignal label="Score integrado" value={s.finalScore}/><MiniSignal label="Perfil" value={s.profileScore} tone={C.purple}/><MiniSignal label="Fit Confiança" value={s.tacticalScore} tone={C.blue}/></div><div style={{display:'grid',gap:11}}>{(profile?.details||[]).filter(d=>d.percentile!==null).slice(0,7).map(item=><PercentileBar key={item.key} label={item.label} value={item.percentile} raw={formatSportsbaseMetric(item.value,getSportsbaseMetric(item.key)||item)} color={item.percentile>=70?C.green:item.percentile>=45?C.amber:C.red}/>)}</div></Panel>
        <div style={{display:'grid',gap:12}}><Panel title="Pontos de observação"><div style={{display:'grid',gap:8}}>{(s.strengths||[]).map(item=><div key={item.key} style={{padding:9,borderRadius:9,background:C.green2,fontSize:10,color:C.ink}}><b>{item.label}</b><p style={{color:C.green,marginTop:2}}>P{item.percentile} · validar repetição e contexto</p></div>)}{(s.concerns||[]).slice(0,2).map(item=><div key={item.key} style={{padding:9,borderRadius:9,background:'#fff7eb',fontSize:10,color:C.ink}}><b>{item.label}</b><p style={{color:C.amber,marginTop:2}}>P{item.percentile} · priorizar no vídeo</p></div>)}</div></Panel><Panel title="Próxima ação"><p style={{fontSize:10.5,color:C.muted,lineHeight:1.5}}>O score serve para ordenar a triagem. Antes de avançar, validar função real, contexto coletivo, tomada de decisão e recorrência das ações.</p><div style={{display:'flex',gap:8,marginTop:12}}><Link href={`/comparacao?player=${encodeURIComponent(player.nome)}&liga=${encodeURIComponent(player._liga||'')}`}><Button variant="secondary">Comparar</Button></Link><Button disabled={added} onClick={()=>onAdd(player)}>{added?'No pipeline':'Adicionar ao pipeline'}</Button></div></Panel></div>
      </div>
    </div>
  </div>
}

export default function RecruitmentPage() {
  const [foci,setFoci]=useState([]); const [selectedId,setSelectedId]=useState(null); const [pipeline,setPipeline]=useState([])
  const [market,setMarket]=useState([]); const [leagues,setLeagues]=useState([]); const [guarani,setGuarani]=useState(null)
  const [loading,setLoading]=useState(true); const [loadingMarket,setLoadingMarket]=useState(false); const [tab,setTab]=useState('radar')
  const [showCreate,setShowCreate]=useState(false); const [selectedPlayer,setSelectedPlayer]=useState(null); const [search,setSearch]=useState('')
  const selected=useMemo(()=>foci.find(f=>String(f.id)===String(selectedId))||null,[foci,selectedId])
  const groupCode=focusCode(selected); const group=GROUPS.find(item=>item.id===groupCode)||GROUPS[0]

  async function loadFoci(preselect) {
    const response=await fetch('/api/focos-recrutamento'); const json=await response.json(); const items=json.focos||[]; setFoci(items)
    setSelectedId(preselect||selectedId||items[0]?.id||null)
  }
  useEffect(()=>{ Promise.all([
    fetch('/api/guarani-sportsbase').then(r=>r.json()), fetch('/api/ligas-v2/jogadores?limit=1').then(r=>r.json()),
  ]).then(([g,m])=>{setGuarani(g);setLeagues(m.ligas||[])}).finally(()=>setLoading(false)); loadFoci() },[])
  useEffect(()=>{ if(!selectedId){setPipeline([]);return} fetch(`/api/candidatos-pipeline?foco_id=${selectedId}`).then(r=>r.json()).then(j=>setPipeline(j.candidatos||[])).catch(()=>setPipeline([])) },[selectedId])
  useEffect(()=>{
    if(!selected){setMarket([]);return} let cancel=false; setLoadingMarket(true)
    const params=new URLSearchParams({posicao:group.positions,limit:'450',minMin:String(selected.min_minutos||450),idadeMin:String(selected.idade_min||15),idadeMax:String(selected.idade_max||45),ordem:'minutos',dir:'desc'})
    if(selected.liga) params.set('liga',selected.liga)
    if(selected.pe) params.set('pe',selected.pe)
    fetch(`/api/ligas-v2/jogadores?${params}`).then(r=>r.json()).then(json=>{if(cancel)return; const enriched=enrichScoutingPool(json.jogadores||[],guarani?.model||guarani?.summary?.model||null,Number(selected.min_minutos)||'auto').filter(p=>!selected.papel||p._scouting?.profile===selected.papel).sort((a,b)=>b._scouting.finalScore-a._scouting.finalScore); setMarket(enriched)}).catch(()=>setMarket([])).finally(()=>!cancel&&setLoadingMarket(false))
    return()=>{cancel=true}
  },[selectedId,guarani])

  async function addCandidate(player) {
    if(!selected)return
    const s=player._scouting||{}; const response=await fetch('/api/candidatos-pipeline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      foco_id:selected.id,jogador:player.nome,clube:player.equipa,posicao:player.posicao,liga:player._liga,pe:player.pe,idade:Number(player.idade)||null,minutos:Number(player.minutos)||0,
      fit_score:s.finalScore,fit_posicional:s.profileScore,fit_funcional:s.tacticalScore,fit_contexto:s.confidence?.score,risco_nivel:s.confidence?.label==='Alta'?'Baixo':s.confidence?.label==='Média'?'Médio':'Alto',etapa:'Identificados',altura:player.altura,nacionalidade:player.pais,fonte:'sportsbase',
    })}); const json=await response.json(); if(!response.ok)return alert(json.error||'Falha ao adicionar.'); const fresh=await fetch(`/api/candidatos-pipeline?foco_id=${selected.id}`).then(r=>r.json()); setPipeline(fresh.candidatos||[])
  }
  async function moveCandidate(candidate,etapa){await fetch('/api/candidatos-pipeline',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:candidate.id,etapa})});setPipeline(prev=>prev.map(item=>item.id===candidate.id?{...item,etapa}:item))}
  const pipelineNames=new Set(pipeline.map(item=>`${item.jogador}|${item.clube}`)); const visible=market.filter(player=>`${player.nome} ${player.equipa}`.toLowerCase().includes(search.toLowerCase())).slice(0,40)

  if(loading)return <ScoutingPage><LoadingState/></ScoutingPage>
  return <ScoutingPage maxWidth={1540}>
    <PageHeader title="Centro de Recrutamento" subtitle="Da necessidade do elenco à decisão: recorte Sportsbase, perfis funcionais, encaixe no modelo do Confiança e avanço controlado pelo pipeline de scouting." status={<StatusDot>{foci.filter(f=>f.status==='Ativo').length} focos ativos</StatusDot>} actions={<><Link href="/recomendacoes"><Button variant="secondary">🧩 Recomendações</Button></Link><Button onClick={()=>setShowCreate(true)}>＋ Novo foco</Button></>}/>
    <div style={{display:'grid',gridTemplateColumns:'285px minmax(0,1fr)',gap:14,alignItems:'start'}} className="scout-two-col">
      <Panel title="Necessidades do elenco" subtitle="Priorize o problema antes do nome" bodyStyle={{padding:8}}>
        <div style={{display:'grid',gap:6}}>{foci.map(focus=><button key={focus.id} onClick={()=>setSelectedId(focus.id)} style={{textAlign:'left',padding:11,borderRadius:10,border:`1px solid ${String(selectedId)===String(focus.id)?C.green:C.line}`,background:String(selectedId)===String(focus.id)?C.green2:'#fff',cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',gap:6}}><strong style={{fontSize:10.5,color:C.ink}}>{focus.nome}</strong><span style={{fontSize:8.5,color:PRIORITY[focus.prioridade]||C.muted,fontWeight:900}}>{focus.prioridade}</span></div><p style={{fontSize:9,color:C.muted,marginTop:4}}>{getGroupLabel(focusCode(focus))} · {focus.papel||'qualquer perfil'} · Pé {playerFootLabel(focus.pe)} · ≥{focus.min_minutos||0} min</p></button>)}{!foci.length&&<EmptyState icon="🎯" title="Nenhum foco criado" text="Comece por uma necessidade real do elenco." action={<Button onClick={()=>setShowCreate(true)}>Criar foco</Button>}/>}</div>
      </Panel>
      {!selected?<Panel><EmptyState icon="🎯" title="Selecione ou crie um foco" text="O sistema vai traduzir a necessidade em recorte de mercado, perfis e ações de scouting."/></Panel>:<div style={{display:'grid',gap:14}}>
        <Panel bodyStyle={{padding:15}}><div style={{display:'flex',justifyContent:'space-between',gap:14,flexWrap:'wrap'}}><div><div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><h2 style={{fontSize:17,color:C.ink}}>{selected.nome}</h2><StatusDot color={PRIORITY[selected.prioridade]||C.amber}>{selected.prioridade}</StatusDot></div><p style={{fontSize:10.5,color:C.muted,marginTop:5,maxWidth:700}}>{selected.descricao||'Sem descrição registrada.'}</p></div><div style={{display:'flex',gap:8}}><MiniSignal label="Grupo" value={getGroupLabel(groupCode)} tone={C.blue}/><MiniSignal label="Perfil" value={selected.papel||'Aberto'} tone={C.purple}/><MiniSignal label="Pé" value={playerFootLabel(selected.pe)} tone={C.green}/><MiniSignal label="Amostra" value={`≥${selected.min_minutos||0}`} tone={C.amber}/></div></div></Panel>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:9}}><Kpi label="Mercado elegível" value={market.length} sub="após idade, posição e amostra" icon="🌐"/><Kpi label="No pipeline" value={pipeline.length} sub={`${pipeline.filter(c=>c.etapa==='Alvo prioritário').length} alvos prioritários`} icon="🧭" tone={C.purple}/><Kpi label="Modelo Confiança" value={guarani?.model?.identity?'Ativo':'Pendente'} sub={guarani?.model?.identity||'suba a planilha coletiva'} icon="🟢" tone={C.blue}/><Kpi label="Cobertura" value={`${pipeline.length?Math.round(pipeline.reduce((s,c)=>s+(c.fit_score||0),0)/pipeline.length):0}`} sub="score médio dos candidatos" icon="📈" tone={C.amber}/></div>
        <Tabs active={tab} onChange={setTab} items={[{id:'radar',label:'Radar Sportsbase',icon:'📡',flex:1},{id:'pipeline',label:'Pipeline de decisão',icon:'🧭',flex:1},{id:'brief',label:'Brief de observação',icon:'📝',flex:1}]}/>
        {tab==='radar'&&<Panel title="Candidatos ranqueados" subtitle="Score = perfil funcional + encaixe Confiança + confiabilidade de amostra" action={<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar atleta ou clube" style={{...inputStyle,width:230}}/>}>{loadingMarket?<LoadingState text="Calculando perfis e encaixe..."/>:visible.length?<div style={{display:'grid',gap:8}}>{visible.map(player=><PlayerCard key={`${player.nome}-${player.equipa}`} player={player} onOpen={setSelectedPlayer} onAdd={addCandidate} added={pipelineNames.has(`${player.nome}|${player.equipa}`)}/>)}</div>:<EmptyState icon="🧭" title="Nenhum candidato elegível" text="Revise idade, minutos, liga ou perfil do foco."/>}</Panel>}
        {tab==='pipeline'&&<Panel title="Pipeline de decisão" subtitle="Mova apenas após evidência suficiente"><div className="scout-scroll" style={{display:'grid',gridTemplateColumns:`repeat(${ETAPAS.length},minmax(190px,1fr))`,gap:9,overflowX:'auto'}}>{ETAPAS.map(etapa=><div key={etapa} style={{background:'#f6faf7',border:`1px solid ${C.line}`,borderRadius:12,padding:8,minHeight:220}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><strong style={{fontSize:9.5,color:stageTone[etapa]}}>{etapa}</strong><span style={{fontSize:9,color:C.muted}}>{pipeline.filter(c=>c.etapa===etapa).length}</span></div><div style={{display:'grid',gap:7}}>{pipeline.filter(c=>c.etapa===etapa).map(candidate=><div key={candidate.id} style={{background:'#fff',border:`1px solid ${C.line}`,borderRadius:9,padding:9}}><strong style={{fontSize:10,color:C.ink}}>{candidate.jogador}</strong><p style={{fontSize:8.5,color:C.muted,marginTop:2}}>{candidate.clube} · {candidate.posicao}</p><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:7}}><ScoreBadge value={candidate.fit_score}/><select value={candidate.etapa} onChange={e=>moveCandidate(candidate,e.target.value)} style={{...inputStyle,padding:'5px 6px',fontSize:8.5,width:92}}>{ETAPAS.map(item=><option key={item}>{item}</option>)}</select></div></div>)}</div></div>)}</div></Panel>}
        {tab==='brief'&&<Panel title="Brief de observação" subtitle="O que o scout deve responder antes de recomendar"><div className="scout-two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div><h3 style={{fontSize:11,color:C.green,marginBottom:8}}>Hipótese orientada por dados</h3><p style={{fontSize:10.5,color:C.muted,lineHeight:1.55}}>Precisamos de um <b style={{color:C.ink}}>{selected.papel||getGroupLabel(groupCode)}</b> para {selected.descricao||'aumentar a qualidade funcional do elenco'}. O recorte exige {selected.min_minutos||0} minutos e compara o atleta com pares do mesmo grupo posicional.</p><div style={{marginTop:12,display:'grid',gap:7}}>{(guarani?.model?.needs||[]).slice(0,3).map(need=><div key={need.key} style={{padding:9,borderRadius:9,background:'#fff7eb',border:'1px solid #f1dfbd'}}><strong style={{fontSize:10,color:C.ink}}>{need.label}</strong><p style={{fontSize:9,color:C.amber,marginTop:2}}>Dimensão atual: {need.score}/100</p></div>)}</div></div><div><h3 style={{fontSize:11,color:C.green,marginBottom:8}}>Perguntas de vídeo e campo</h3><ol style={{paddingLeft:18,display:'grid',gap:8,color:C.muted,fontSize:10.5,lineHeight:1.45}}><li>A função real corresponde ao perfil estatístico ou é efeito do modelo coletivo?</li><li>Qualidade de decisão se mantém sob pressão, transição e espaços menores?</li><li>O volume vem acompanhado de eficiência e repetição ao longo dos jogos?</li><li>Há comportamento sem bola compatível com o modelo e as necessidades do Confiança?</li><li>Risco físico, competitivo e de adaptação é aceitável para a janela?</li></ol></div></div></Panel>}
      </div>}
    </div>
    {showCreate&&<FocusModal onClose={()=>setShowCreate(false)} onCreated={id=>loadFoci(id)} leagues={leagues}/>} 
    {selectedPlayer&&<CandidateModal player={selectedPlayer} onClose={()=>setSelectedPlayer(null)} onAdd={addCandidate} added={pipelineNames.has(`${selectedPlayer.nome}|${selectedPlayer.equipa}`)}/>} 
  </ScoutingPage>
}
