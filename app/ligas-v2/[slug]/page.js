'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '../../components/layout/AppShell'
import { getLeague } from '@/data/leagues'
import SportsbasePlayersTable from './SportsbasePlayersTable'
import SportsbaseTeamsTable from './SportsbaseTeamsTable'
import CompetitionHighlights from '../../components/ligas/CompetitionHighlights'
import OportunidadesMercado from '../../components/ligas/OportunidadesMercado'

const BRAND_PRIMARY  = '#0a66b7'
const BRAND_DARK = '#064b82'

function n(v, d = 2) { const f = parseFloat(v); return isNaN(f) ? '—' : f % 1 === 0 ? String(f) : f.toFixed(d) }

function selectionDisplayScore(player) { return Number(player?._selection_score ?? player?._score ?? 0) }

const POS_COLORS = {
  GK:{bg:'#fef3c7',color:'#92400e'}, CB:{bg:'#dbeafe',color:'#1e40af'},
  LCB:{bg:'#dbeafe',color:'#1e40af'}, RCB:{bg:'#dbeafe',color:'#1e40af'},
  LB:{bg:'#dbeafe',color:'#1e40af'}, RB:{bg:'#dbeafe',color:'#1e40af'},
  DMF:{bg:'#ede9fe',color:'#6d28d9'}, CMF:{bg:'#d1fae5',color:'#065f46'},
  AMF:{bg:'#d1fae5',color:'#065f46'}, LMF:{bg:'#d1fae5',color:'#065f46'}, RMF:{bg:'#d1fae5',color:'#065f46'},
  CDM:{bg:'#ede9fe',color:'#6d28d9'}, LCDM:{bg:'#ede9fe',color:'#6d28d9'}, RCDM:{bg:'#ede9fe',color:'#6d28d9'},
  LDM:{bg:'#ede9fe',color:'#6d28d9'}, RDM:{bg:'#ede9fe',color:'#6d28d9'},
  LCM:{bg:'#d1fae5',color:'#065f46'}, RCM:{bg:'#d1fae5',color:'#065f46'},
  CAM:{bg:'#d1fae5',color:'#065f46'}, LCAM:{bg:'#d1fae5',color:'#065f46'}, RCAM:{bg:'#d1fae5',color:'#065f46'},
  LWF:{bg:'#fce7f3',color:'#9d174d'}, RWF:{bg:'#fce7f3',color:'#9d174d'}, SS:{bg:'#fce7f3',color:'#9d174d'},
  LM:{bg:'#d1fae5',color:'#065f46'}, RM:{bg:'#d1fae5',color:'#065f46'},
  LAM:{bg:'#fce7f3',color:'#9d174d'}, RAM:{bg:'#fce7f3',color:'#9d174d'},
  CF:{bg:'#fee2e2',color:'#991b1b'}, LCF:{bg:'#fee2e2',color:'#991b1b'}, RCF:{bg:'#fee2e2',color:'#991b1b'},
}
function PosBadge({ pos }) {
  if (!pos) return <span style={{ fontSize:9, color:'#94a3b8' }}>—</span>
  return (
    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
      {pos.split(',').map(p=>p.trim()).slice(0,2).map(p => {
        const s = POS_COLORS[p] || { bg:'#f1f5f9', color:'#64748b' }
        return <span key={p} style={{ fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:4, background:s.bg, color:s.color }}>{p}</span>
      })}
    </div>
  )
}

/* ── Upload Box ───────────────────────────────────────────────────────── */
function UploadBox({ slug, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState(null)
  const [provider, setProvider] = useState('sportsbase')
  const fileRef = useRef()

  const providerCopy = provider === 'sportsbase'
    ? {
        title:'Sportsbase · estatísticas avançadas',
        description:'Base principal para métricas, percentis, IAP, Fit Confiança, equipes e seleção. O modelo enviado não possui pé preferido.',
        accent:'#0a66b7', background:'#f0fdf4', border:'#86efac',
      }
    : {
        title:'Wyscout · estatísticas completas',
        description:'Importa o catálogo completo do Search results: produção, finalização, passe, progressão, 1×1, defesa, goleiros, percentis e seleções.',
        accent:'#2563eb', background:'#eff6ff', border:'#93c5fd',
      }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return setMsg({ tipo:'erro', texto:'Selecione um arquivo .xlsx' })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    setLoading(true)
    setMsg(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const endpoint = `/api/ligas-v2/${slug}/${provider}`
      const res = await fetch(endpoint, { method:'POST', body:fd, signal:controller.signal })
      const raw = await res.text()
      let data = {}
      try { data = raw ? JSON.parse(raw) : {} } catch (_) { data = { error: raw || 'Resposta inválida do servidor' } }
      if (!res.ok) throw new Error(data.error || `Falha no upload (${res.status})`)

      const background = data.background_processing
        ? 'Ficha-mãe e dashboard estão sendo atualizados em segundo plano.'
        : null
      setMsg({ tipo:'ok', texto:[data.message, background, ...(data.warnings || [])].filter(Boolean).join(' · ') })
      if (fileRef.current) fileRef.current.value=''
      onSuccess?.(provider, data)
    } catch (error) {
      const text = error?.name === 'AbortError'
        ? 'O servidor demorou além do limite. O envio foi interrompido; atualize a aba Jogadores antes de tentar novamente para verificar se os dados foram gravados.'
        : (error?.message || 'Erro inesperado no upload')
      setMsg({ tipo:'erro', texto:text })
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  return (
    <div style={{ background:providerCopy.background, border:`1.5px dashed ${providerCopy.border}`, borderRadius:12, padding:'16px 20px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        {[
          ['sportsbase','📊 Sportsbase','Métricas avançadas e modelo de jogo'],
          ['wyscout','🔵 Wyscout','Métricas completas e pé preferido'],
        ].map(([value,label,description])=><button key={value} onClick={()=>{setProvider(value);setMsg(null);if(fileRef.current)fileRef.current.value=''}} style={{ textAlign:'left', border:`1.5px solid ${provider===value?(value==='sportsbase'?BRAND_PRIMARY:'#2563eb'):'#dbe7f2'}`, borderRadius:10, padding:'10px 12px', background:provider===value?'#fff':'rgba(255,255,255,.55)', cursor:'pointer' }}><p style={{ fontSize:11, fontWeight:900, color:provider===value?(value==='sportsbase'?BRAND_PRIMARY:'#1d4ed8'):'#334155' }}>{label}</p><p style={{ fontSize:9, color:'#64748b', marginTop:3 }}>{description}</p></button>)}
      </div>
      <p style={{ fontSize:11, fontWeight:800, color:providerCopy.accent, marginBottom:4 }}>{providerCopy.title}</p>
      <p style={{ fontSize:10, color:'#64748b', lineHeight:1.5, marginBottom:10 }}>{providerCopy.description}</p>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" disabled={loading} style={{ fontSize:12, flex:1, opacity:loading ? 0.65 : 1 }} />
        <button onClick={handleUpload} disabled={loading}
          style={{ background:loading?'#94a3b8':providerCopy.accent, color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontWeight:700, fontSize:12, cursor:loading?'wait':'pointer', whiteSpace:'nowrap' }}>
          {loading ? 'Salvando dados...' : `Importar ${provider==='sportsbase'?'Sportsbase':'Wyscout'}`}
        </button>
      </div>
      {msg && <p style={{ marginTop:8, fontSize:10.5, fontWeight:700, lineHeight:1.5, color:msg.tipo==='ok'?'#15803d':'#dc2626' }}>{msg.tipo==='ok'?'✓ ':'✗ '}{msg.texto}</p>}
      <div style={{ marginTop:10, padding:'9px 11px', borderRadius:9, background:'#fff', border:'1px solid rgba(148,163,184,.25)', fontSize:9.5, color:'#475569', lineHeight:1.55 }}>
        <b>Fluxo por liga:</b> Sportsbase e Wyscout podem funcionar isoladamente. Quando as duas planilhas existem na mesma liga, o modo Automático integra os scores por função sem excluir atletas que estejam apenas em uma das bases; o Wyscout também complementa o pé preferido quando disponível.
      </div>
    </div>
  )
}
/* ── Tabela de Jogadores Sportsbase ───────────────────────────────── */
function TabelaJogadores({ slug, ligaNome, source = 'auto' }) {
  return <SportsbasePlayersTable slug={slug} ligaNome={ligaNome} source={source} />
}

/* ── Times com Stats ──────────────────────────────────────────────────── */
function TimesComStats({ slug, source='auto', onSourceChange }) {
  return <SportsbaseTeamsTable slug={slug} sourcePreference={source} onSourceChange={onSourceChange} />
}

/* ══════════════════════════════════════════════════════════════════════
   CAMPO TÁTICO — componentes compartilhados
   ══════════════════════════════════════════════════════════════════════ */
const COORDS_433 = {
  FWD:[{x:20,y:22},{x:50,y:16},{x:80,y:22}],
  MID:[{x:22,y:46},{x:50,y:50},{x:78,y:46}],
  DEF:[{x:16,y:70},{x:37,y:67},{x:63,y:67},{x:84,y:70}],
  GK: [{x:50,y:88}],
}
const SELECTION_SLOTS = [
  { id:'LW',  grupo:'FWD', label:'PE',  x:20, y:22 },
  { id:'CF',  grupo:'FWD', label:'CA',  x:50, y:16 },
  { id:'RW',  grupo:'FWD', label:'PD',  x:80, y:22 },
  { id:'CM',  grupo:'MID', label:'MC',  x:22, y:46 },
  { id:'DM',  grupo:'MID', label:'VOL', x:50, y:50 },
  { id:'AM',  grupo:'MID', label:'MEI', x:78, y:46 },
  { id:'LB',  grupo:'DEF', label:'LE',  x:16, y:70 },
  { id:'CBL', grupo:'DEF', label:'ZAG', x:37, y:67 },
  { id:'CBR', grupo:'DEF', label:'ZAG', x:63, y:67 },
  { id:'RB',  grupo:'DEF', label:'LD',  x:84, y:70 },
  { id:'GK',  grupo:'GK',  label:'GOL', x:50, y:88 },
]
const DEF_LABELS  = ['LE','ZAG','ZAG','LD']
const GRUPO_COR   = { GK:'#f59e0b', DEF:'#3b82f6', MID:'#8b5cf6', FWD:'#ef4444' }
const GRUPO_LABEL = { GK:'Goleiro', DEF:'Defensores', MID:'Meias', FWD:'Atacantes' }

function PeIcon({ pe }) {
  if (!pe || pe==='unknown') return null
  if (pe==='ambos') return <span title="Ambos" style={{ fontSize:9 }}>⚡</span>
  return (
    <span title={pe==='esquerdo'?'Canhoto':'Destro'}
      style={{ fontSize:8, fontWeight:900, background:pe==='esquerdo'?'#dbeafe':'#fef3c7', color:pe==='esquerdo'?'#1e40af':'#92400e', padding:'1px 4px', borderRadius:4 }}>
      {pe==='esquerdo'?'E':'D'}
    </span>
  )
}

function SvgCampo() {
  return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 100 130" preserveAspectRatio="none">
      <rect x="5" y="5" width="90" height="120" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <line x1="5" y1="65" x2="95" y2="65" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <rect x="22" y="100" width="56" height="25" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <rect x="35" y="113" width="30" height="12" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <rect x="22" y="5" width="56" height="25" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <rect x="35" y="5" width="30" height="12" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      {[0,1,2,3,4,5,6,7,8,9].map(i=>(
        <rect key={i} x="5" y={5+i*12} width="90" height="12" fill={i%2===0?'rgba(0,0,0,0.04)':'rgba(0,0,0,0)'} />
      ))}
    </svg>
  )
}

function PitchPlayer({ jogador, x, y, selected, onClick, emptyLabel }) {
  if (!jogador) return (
    <div style={{ position:'absolute', left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)',
      width:44, height:44, borderRadius:'50%', background:'rgba(255,255,255,0.08)',
      border:'2px dashed rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700 }}>{emptyLabel||'?'}</span>
    </div>
  )
  const cor         = GRUPO_COR[jogador._grupo] || BRAND_PRIMARY
  const nomeDisplay = jogador.nome?.split(' ').slice(-1)[0] || '?'
  const timeDisplay = jogador.equipa ? jogador.equipa.split(' ').slice(0,2).join(' ') : ''
  return (
    <div onClick={onClick} style={{ position:'absolute', left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)',
      cursor:'pointer', zIndex:selected?20:10, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <div style={{ width:selected?52:44, height:selected?52:44, borderRadius:'50%',
        background:selected?cor:`${cor}dd`, border:selected?'3px solid #fff':`2px solid ${cor}88`,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:selected?`0 0 0 4px ${cor}55,0 4px 16px rgba(0,0,0,0.5)`:'0 2px 8px rgba(0,0,0,0.4)',
        transition:'all 0.15s', fontSize:11, fontWeight:800, color:'#fff' }}>
        {selectionDisplayScore(jogador).toFixed(0)}
      </div>
      <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:'rgba(0,0,0,0.65)',
        padding:'2px 7px', borderRadius:20, whiteSpace:'nowrap', maxWidth:88,
        overflow:'hidden', textOverflow:'ellipsis', backdropFilter:'blur(4px)', lineHeight:1.3 }}>
        {nomeDisplay}
      </span>
      {timeDisplay && (
        <span style={{ fontSize:8, fontWeight:600, color:'rgba(255,255,255,0.75)', background:'rgba(0,0,0,0.45)',
          padding:'1px 5px', borderRadius:20, whiteSpace:'nowrap', maxWidth:84,
          overflow:'hidden', textOverflow:'ellipsis', backdropFilter:'blur(4px)' }}>
          {timeDisplay}
        </span>
      )}
    </div>
  )
}

function CardDetalhe({ jogador, onClose }) {
  if (!jogador) return null
  const cor = GRUPO_COR[jogador._grupo] || BRAND_PRIMARY
  const wyscout = jogador._fonte === 'wyscout' || (jogador._fonte === 'combined' && jogador._fresh_source === 'wyscout')
  const pct = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—'
  const metricas = wyscout
    ? jogador._grupo==='GK'
      ? [['Defesas%',pct(jogador.defesas_pct)],['Clean sheets%',pct(jogador.clean_sheets_pct)],['GS/90',jogador.gols_sofridos_90],['Gols evit./90',jogador.gols_prevenidos_90],['Saídas/90',jogador.saidas_90],['P. longos%',pct(jogador.passes_longos_pct)]]
      : jogador._grupo==='DEF'
        ? [['D. defensivos%',pct(jogador.duelos_def_pct)],['Ações def./90',jogador.acoes_def_sucesso_90],['Interc./90',jogador.intercecoes_90],['D. aéreos%',pct(jogador.duelos_aereos_pct)],['P. prog./90',jogador.passes_prog_90],['P. prog.%',pct(jogador.passes_prog_pct)]]
        : jogador._grupo==='MID'
          ? [['P. prog./90',jogador.passes_prog_90],['P. prog.%',pct(jogador.passes_prog_pct)],['P. chave/90',jogador.passes_chave_90],['Assist. remate/90',jogador.assist_remate_90],['Dribles/90',jogador.dribles_90],['Passe%',pct(jogador.passes_pct)]]
          : [['Gols/90',jogador.gols_90],['xG/90',jogador.xg_90],['Remates/90',jogador.remates_90],['No alvo%',pct(jogador.remates_golo_pct)],['Dribles/90',jogador.dribles_90],['Toques área/90',jogador.toques_area_90]]
    : jogador._grupo==='GK'
      ? [['Defesas%',pct(jogador.defesas_pct)],['CleanSh.',jogador.clean_sheets],['GS/90',jogador.gols_sofridos_90],['G.Def.Esp.',jogador.gols_defend_esperados],['Minutos',jogador.minutos?Math.round(jogador.minutos):'—'],['Jogos',jogador.jogos]]
      : jogador._grupo==='DEF'
        ? [['D.Def%',pct(jogador.duelos_def_pct)],['Interc/90',jogador.intercecoes_90],['Desarmes/90',jogador.desarmes_90],['D.Aér%',pct(jogador.duelos_aereos_pct)],['Passe%',pct(jogador.passes_pct)],['Minutos',jogador.minutos?Math.round(jogador.minutos):'—']]
        : jogador._grupo==='MID'
          ? [['P.Prog/90',jogador.passes_prog_90],['P.Chave/90',jogador.passes_chave_90],['Passe%',pct(jogador.passes_pct)],['Dribles/90',jogador.dribles_90],['Gols/90',jogador.gols_90],['Assist/90',jogador.assistencias_90]]
          : [['Gols/90',jogador.gols_90],['xG/90',jogador.xg_90],['Assist/90',jogador.assistencias_90],['Dribles/90',jogador.dribles_90],['Ações Área/90',jogador.acoes_area_90],['Remates/90',jogador.remates_90]]
  return (
    <div style={{ position:'absolute', top:8, right:8, zIndex:100, background:'#fff', borderRadius:14, padding:16,
      width:220, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', border:`2px solid ${cor}44` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div>
          <p style={{ fontSize:13, fontWeight:800, color:'#1a2e1a', lineHeight:1.2 }}>{jogador.nome}</p>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
            <p style={{ fontSize:10, color:'#64748b' }}>{jogador.equipa} · {jogador.posicao?.split(',')[0]}</p>
            <PeIcon pe={jogador.pe} />
          </div>
        </div>
        <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:16, color:'#94a3b8' }}>✕</button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'8px 12px', background:`${cor}15`, borderRadius:10 }}>
        <span style={{ fontSize:24, fontWeight:900, color:cor }}>{selectionDisplayScore(jogador).toFixed(1)}</span>
        <div>
          <p style={{ fontSize:10, fontWeight:700, color:cor }}>Score da função</p>
          <p style={{ fontSize:9, color:'#94a3b8' }}>{jogador._role_label || GRUPO_LABEL[jogador._grupo]}</p>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {metricas.map(([l,v])=>(
          <div key={l} style={{ background:'#f8fdf9', borderRadius:8, padding:'6px 10px' }}>
            <p style={{ fontSize:9, color:'#94a3b8', fontWeight:600 }}>{l}</p>
            <p style={{ fontSize:13, fontWeight:800, color:'#1a2e1a' }}>
              {v==null?'—':typeof v==='string'?v:isNaN(parseFloat(v))?'—':parseFloat(v)%1===0?parseInt(v):parseFloat(v).toFixed(2)}
            </p>
          </div>
        ))}
      </div>
      {jogador._performance_score!=null && (
        <div style={{ marginTop:9, paddingTop:9, borderTop:'1px solid #edf4ef' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
            {[
              ['Performance',jogador._performance_score],
              ['Cobertura',`${jogador._coverage||0}%`],
              ['Confiança',jogador._sample_confidence],
            ].map(([label,value])=><div key={label} style={{background:'#f8fdf9',borderRadius:7,padding:'5px 6px',textAlign:'center'}}><p style={{fontSize:8,color:'#94a3b8',fontWeight:700}}>{label}</p><p style={{fontSize:11,fontWeight:900,color:'#10233b',marginTop:2}}>{value}</p></div>)}
          </div>
          {jogador._strengths?.length>0 && <p style={{fontSize:8.5,color:'#15803d',lineHeight:1.45,marginTop:7}}><b>Forças:</b> {jogador._strengths.map(item=>`${item.label} P${item.percentile}`).join(' · ')}</p>}
          {jogador._watchouts?.length>0 && <p style={{fontSize:8.5,color:'#b45309',lineHeight:1.45,marginTop:4}}><b>Observar:</b> {jogador._watchouts.map(item=>`${item.label} P${item.percentile}`).join(' · ')}</p>}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   SELEÇÃO DO CAMPEONATO
   ══════════════════════════════════════════════════════════════════════ */

const BRAND_RGB = [10, 102, 183]
const FIELD    = { x:10, y:25, w:90, h:120 }

function coordToMm(xPct, yPct) {
  return { x: FIELD.x + (xPct/100)*FIELD.w, y: FIELD.y + (yPct/100)*FIELD.h }
}

const COORDS_433_PDF = {
  FWD:[{x:20,y:22},{x:50,y:16},{x:80,y:22}],
  MID:[{x:22,y:46},{x:50,y:50},{x:78,y:46}],
  DEF:[{x:16,y:70},{x:37,y:67},{x:63,y:67},{x:84,y:70}],
  GK: [{x:50,y:88}],
}
const GRUPO_COR_PDF = { GK:[245,158,11], DEF:[59,130,246], MID:[139,92,246], FWD:[239,68,68] }

function drawField(doc) {
  const {x,y,w,h} = FIELD
  doc.setFillColor(21,87,47); doc.rect(x,y,w,h,'F')
  for(let i=0;i<10;i++){if(i%2===0){doc.setFillColor(26,107,58);doc.rect(x,y+i*(h/10),w,h/10,'F')}}
  doc.setDrawColor(255,255,255);doc.setLineWidth(0.3)
  doc.setGState(doc.GState({opacity:0.25}))
  doc.rect(x+3,y+3,w-6,h-6)
  doc.line(x+3,y+h/2,x+w-3,y+h/2)
  doc.circle(x+w/2,y+h/2,8)
  doc.rect(x+3+(w-6)*0.2,y+3+(h-6)*0.77,(w-6)*0.6,(h-6)*0.2)
  doc.rect(x+3+(w-6)*0.33,y+3+(h-6)*0.87,(w-6)*0.34,(h-6)*0.1)
  doc.rect(x+3+(w-6)*0.2,y+3,(w-6)*0.6,(h-6)*0.2)
  doc.rect(x+3+(w-6)*0.33,y+3,(w-6)*0.34,(h-6)*0.1)
  doc.setGState(doc.GState({opacity:1}))
}

function drawPlayerOnField(doc,jogador,xPct,yPct) {
  const {x,y} = coordToMm(xPct,yPct)
  const cor = GRUPO_COR_PDF[jogador?._grupo]||[100,100,100]
  doc.setFillColor(...cor); doc.circle(x,y,4.5,'F')
  doc.setTextColor(255,255,255);doc.setFontSize(5.5);doc.setFont('helvetica','bold')
  doc.text(selectionDisplayScore(jogador).toFixed(0),x,y+1.5,{align:'center'})
  const nome = jogador?.nome?.split(' ').slice(-1)[0]||''
  doc.setFontSize(4);doc.setFont('helvetica','bold')
  doc.setFillColor(0,0,0);doc.setGState(doc.GState({opacity:0.6}))
  const nw = doc.getTextWidth(nome)+2
  doc.roundedRect(x-nw/2,y+4.8,nw,3,0.5,0.5,'F')
  doc.setGState(doc.GState({opacity:1}));doc.setTextColor(255,255,255)
  doc.text(nome,x,y+6.8,{align:'center'})
  const time = jogador?.equipa?.split(' ')[0]||''
  if(time){doc.setFontSize(3.2);doc.setFont('helvetica','normal');doc.setTextColor(200,200,200);doc.text(time,x,y+9.5,{align:'center'})}
  doc.setTextColor(0,0,0)
}

function drawEmptySlot(doc,xPct,yPct,label) {
  const {x,y} = coordToMm(xPct,yPct)
  doc.setDrawColor(255,255,255);doc.setLineWidth(0.3)
  doc.setGState(doc.GState({opacity:0.3}));doc.circle(x,y,4.5)
  doc.setGState(doc.GState({opacity:1}))
  doc.setFontSize(4);doc.setFont('helvetica','bold');doc.setTextColor(180,180,180)
  doc.text(label||'?',x,y+1.5,{align:'center'});doc.setTextColor(0,0,0)
}

function drawHeader(doc,titulo,subtitulo) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BRAND_RGB);doc.rect(0,0,W,14,'F')
  doc.setTextColor(255,255,255)
  doc.setFontSize(6);doc.setFont('helvetica','normal');doc.text('CIC · CONFIANÇA',8,5.5)
  doc.setFontSize(9);doc.setFont('helvetica','bold');doc.text(titulo,8,11)
  doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text(subtitulo,W-8,11,{align:'right'})
  doc.setTextColor(0,0,0)
}

function drawFooter(doc,page,total) {
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight()
  doc.setFontSize(5.5);doc.setTextColor(160)
  doc.text(`CIC Confiança  ·  ${new Date().toLocaleDateString('pt-BR')}  ·  Pág ${page}/${total}`,W/2,H-3,{align:'center'})
  doc.setTextColor(0,0,0)
}

function drawPlayerList(doc,squad,teamLabel,thresholds) {
  const grupos=['GK','DEF','MID','FWD']
  const LABEL={GK:'Goleiro',DEF:'Defensores',MID:'Meias',FWD:'Atacantes'}
  const COR=GRUPO_COR_PDF
  let cx=FIELD.x+FIELD.w+6,cy=28
  const maxW=297-cx-5
  doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(...BRAND_RGB)
  doc.text(teamLabel,cx,cy);cy+=5
  for(const g of grupos){
    const players=squad.filter(j=>j._grupo===g);if(!players.length)continue
    const cor=COR[g]||[100,100,100]
    doc.setFillColor(...cor);doc.roundedRect(cx,cy,maxW,5.5,1,1,'F')
    doc.setTextColor(255,255,255);doc.setFontSize(6);doc.setFont('helvetica','bold')
    doc.text(LABEL[g].toUpperCase(),cx+2,cy+3.8)
    doc.setTextColor(0,0,0);cy+=6
    for(const j of players){
      if(cy>195)break
      if(players.indexOf(j)%2===0){doc.setFillColor(248,253,249);doc.rect(cx,cy-0.5,maxW,8,'F')}
      doc.setFillColor(...cor);doc.circle(cx+3,cy+3,2.5,'F')
      doc.setTextColor(255,255,255);doc.setFontSize(5);doc.setFont('helvetica','bold')
      doc.text(selectionDisplayScore(j).toFixed(0),cx+3,cy+4.2,{align:'center'})
      doc.setTextColor(20,46,53);doc.setFontSize(6.5);doc.setFont('helvetica','bold')
      const ns=(j.nome||'').split(' ')
      doc.text(ns.length>2?ns.slice(-2).join(' '):(j.nome||''),cx+7,cy+3.2)
      doc.setFontSize(5);doc.setFont('helvetica','normal');doc.setTextColor(100)
      const peL=j.pe==='esquerdo'?' · E':j.pe==='direito'?' · D':j.pe==='ambos'?' · Amb':''
      doc.text((j._role_label||'')+' · '+(j.equipa||'—')+' · '+(j.posicao?.split(',')[0]||'')+peL,cx+7,cy+6.5)
      doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(...cor)
      doc.text(selectionDisplayScore(j).toFixed(0),cx+maxW-2,cy+4.5,{align:'right'})
      doc.setTextColor(0,0,0);cy+=8.5
    }
    cy+=3
  }
}

async function exportSelecaoPDF(teams,thresholds,uploadAt,ligaNome,selectionLabel='Desempenho Atual') {
  const mod=await import('jspdf');const jsPDF=mod.jsPDF??mod.default
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  const keys=[['A','XI Referência'],['B','XI Destaque'],['C','XI Ascensão']]
  keys.forEach(([key,squadLabel],pi)=>{
    if(pi>0)doc.addPage()
    const squad=teams[key]||[]
    const sub=`${ligaNome}${uploadAt?' · Upload '+new Date(uploadAt).toLocaleDateString('pt-BR'):''}`
    drawHeader(doc,`⭐ ${selectionLabel} — ${squadLabel}`,sub)
    drawField(doc)
    SELECTION_SLOTS.forEach(slot=>{
      const j=squad.find(player=>player._slot===slot.id)||null
      if(j)drawPlayerOnField(doc,j,slot.x,slot.y)
      else drawEmptySlot(doc,slot.x,slot.y,slot.label)
    })
    const lt=Object.entries(thresholds||{}).filter(([,t])=>t.limiar>0).map(([slot,t])=>`${slot}≥${t.limiar}min`).join(' · ')
    if(lt){doc.setFontSize(4.5);doc.setFont('helvetica','normal');doc.setTextColor(150,210,150);doc.text(lt,FIELD.x+FIELD.w/2,FIELD.y+FIELD.h+3,{align:'center'});doc.setTextColor(0,0,0)}
    drawPlayerList(doc,squad,`${squadLabel} · 4-3-3`,thresholds)
    drawFooter(doc,pi+1,keys.length)
  })
  doc.save(`selecao-${ligaNome.replace(/\s+/g,'-').toLowerCase()}.pdf`)
}

async function exportShadowPDF(slots,teamName,ligaNome) {
  const mod=await import('jspdf');const jsPDF=mod.jsPDF??mod.default
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  drawHeader(doc,`🕶 Shadow: ${teamName}`,ligaNome)
  drawField(doc)
  const SHADOW_COORDS=[
    {id:'GK',grupo:'GK',label:'GOL',x:50,y:88},
    {id:'LB',grupo:'DEF',label:'LE',x:16,y:70},
    {id:'CB1',grupo:'DEF',label:'ZAG',x:37,y:67},
    {id:'CB2',grupo:'DEF',label:'ZAG',x:63,y:67},
    {id:'RB',grupo:'DEF',label:'LD',x:84,y:70},
    {id:'CM1',grupo:'MID',label:'MEI',x:22,y:46},
    {id:'CM2',grupo:'MID',label:'VOL',x:50,y:50},
    {id:'CM3',grupo:'MID',label:'MEI',x:78,y:46},
    {id:'LW',grupo:'FWD',label:'ATA',x:20,y:22},
    {id:'ST',grupo:'FWD',label:'CA',x:50,y:16},
    {id:'RW',grupo:'FWD',label:'ATA',x:80,y:22},
  ]
  SHADOW_COORDS.forEach(slot=>{
    const j=slots[slot.id]
    if(j){
      const cor=GRUPO_COR_PDF[slot.grupo]||[100,100,100]
      const {x,y}=coordToMm(slot.x,slot.y)
      doc.setFillColor(...cor);doc.circle(x,y,4.5,'F')
      doc.setTextColor(255,255,255);doc.setFontSize(5);doc.setFont('helvetica','bold')
      doc.text(slot.label,x,y+1.5,{align:'center'})
      const nome=j.nome?.split(' ').slice(-1)[0]||''
      doc.setFontSize(4);doc.setFont('helvetica','bold')
      doc.setFillColor(0,0,0);doc.setGState(doc.GState({opacity:0.6}))
      const nw=doc.getTextWidth(nome)+2
      doc.roundedRect(x-nw/2,y+4.8,nw,3,0.5,0.5,'F')
      doc.setGState(doc.GState({opacity:1}));doc.setTextColor(255,255,255)
      doc.text(nome,x,y+6.8,{align:'center'})
      const time=j.equipa?.split(' ')[0]||''
      if(time){doc.setFontSize(3.2);doc.setFont('helvetica','normal');doc.setTextColor(200,200,200);doc.text(time,x,y+9.5,{align:'center'})}
    } else {
      drawEmptySlot(doc,slot.x,slot.y,slot.label)
    }
    doc.setTextColor(0,0,0)
  })
  // Lista lateral shadow
  const cx=FIELD.x+FIELD.w+6;let cy=28;const maxW=297-cx-5
  const COR=GRUPO_COR_PDF;const LABEL={GK:'Goleiro',DEF:'Defensores',MID:'Meias',FWD:'Atacantes'}
  doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(...BRAND_RGB)
  doc.text(teamName,cx,cy);cy+=5
  for(const g of ['GK','DEF','MID','FWD']){
    const slotsG=SHADOW_COORDS.filter(s=>s.grupo===g)
    const players=slotsG.map(s=>slots[s.id]?{...slots[s.id],_slot:s}:null).filter(Boolean)
    if(!players.length)continue
    const cor=COR[g]||[100,100,100]
    doc.setFillColor(...cor);doc.roundedRect(cx,cy,maxW,5.5,1,1,'F')
    doc.setTextColor(255,255,255);doc.setFontSize(6);doc.setFont('helvetica','bold')
    doc.text(LABEL[g].toUpperCase(),cx+2,cy+3.8);doc.setTextColor(0,0,0);cy+=6
    for(const j of players){
      if(cy>195)break
      if(players.indexOf(j)%2===0){doc.setFillColor(248,253,249);doc.rect(cx,cy-0.5,maxW,8,'F')}
      doc.setFillColor(...cor);doc.circle(cx+3,cy+3,2.5,'F')
      doc.setTextColor(255,255,255);doc.setFontSize(5.5);doc.setFont('helvetica','bold')
      doc.text(j._slot?.label||'',cx+3,cy+4.2,{align:'center'})
      doc.setTextColor(20,46,53);doc.setFontSize(6.5);doc.setFont('helvetica','bold')
      const ns=(j.nome||'').split(' ')
      doc.text(ns.length>2?ns.slice(-2).join(' '):(j.nome||''),cx+7,cy+3.2)
      doc.setFontSize(5);doc.setFont('helvetica','normal');doc.setTextColor(100)
      const peL=j.pe==='esquerdo'?' · E':j.pe==='direito'?' · D':j.pe==='ambos'?' · Amb':''
      doc.text([j._role_label,j.equipa||'—',j.posicao?.split(',')[0]].filter(Boolean).join(' · ')+peL,cx+7,cy+6.5)
      doc.setTextColor(0,0,0);cy+=8.5
    }
    cy+=3
  }
  drawFooter(doc,1,1)
  doc.save(`shadow-${teamName.replace(/\s+/g,'-').toLowerCase()}.pdf`)
}

function SelecaoCampeonato({ slug, ligaNome, sourcePreference='auto', onSourceChange }) {
  const [selections, setSelections] = useState({ current:{}, potential:{}, opportunity:{} })
  const [thresholds, setThresholds] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploadAt, setUploadAt] = useState(null)
  const [selectionType, setSelectionType] = useState('current')
  const [activeSquad, setActiveSquad] = useState('reference')
  const [selected, setSelected] = useState(null)
  const [total, setTotal] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [missingGroups, setMissingGroups] = useState([])
  const [missingRoles, setMissingRoles] = useState([])
  const [methodology, setMethodology] = useState({})
  const [source, setSource] = useState('sportsbase')
  const [availableSources, setAvailableSources] = useState({ sportsbase:false, wyscout:false })

  const TYPE_LABELS = {
    current:{ label:'Seleção Desempenho Atual', question:'Quem apresenta o melhor rendimento estatístico na função hoje?', tone:'#0a66b7' },
    potential:{ label:'Seleção Projeção Interna', question:'Quem combina desempenho, idade e margem de evolução dentro de contexto semelhante?', tone:'#7c3aed' },
    opportunity:{ label:'Seleção Oportunidade', question:'Quem combina desempenho, projeção, robustez, idade e viabilidade?', tone:'#d97706' },
  }
  const SQUAD_LABELS = { reference:'XI Referência', highlight:'XI Destaque', ascent:'XI Ascensão' }

  const buscar = useCallback(async () => {
    if (!slug) return
    setLoading(true); setSelected(null)
    try {
      const query = sourcePreference && sourcePreference !== 'auto' ? `?source=${sourcePreference}` : ''
      const response = await fetch(`/api/ligas-v2/${slug}/selecao${query}`)
      if (response.ok) {
        const body = await response.json()
        setSelections(body.selections || { current:{ reference:body.teamA||[], highlight:body.teamB||[], ascent:body.teamC||[] }, potential:{}, opportunity:{} })
        setThresholds(body.thresholds || {})
        setTotal(body.total_jogadores || 0)
        setUploadAt(body.upload_at)
        setMissingGroups(body.missing_groups || [])
        setMissingRoles(body.missing_roles || [])
        setMethodology(body.methodology || {})
        setSource(body.source || 'sportsbase')
        setAvailableSources(body.available_sources || { sportsbase:body.source==='sportsbase', wyscout:body.source==='wyscout' })
      }
    } catch (error) { console.error(error) }
    setLoading(false)
  }, [slug, sourcePreference])

  useEffect(() => { buscar() }, [buscar])

  const squads = selections[selectionType] || {}
  const squad = squads[activeSquad] || []
  const typeInfo = TYPE_LABELS[selectionType]

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportSelecaoPDF({ A:squads.reference || [], B:squads.highlight || [], C:squads.ascent || [] }, thresholds, uploadAt, ligaNome, typeInfo.label)
    } catch (error) { console.error(error) }
    setExporting(false)
  }

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}><p style={{ fontSize:24, marginBottom:8 }}>⏳</p><p>Calculando seleções estatísticas por função...</p></div>
  if (!squad.length) return <div style={{ padding:48, textAlign:'center', background:'#fff', borderRadius:14, border:'1px solid #e8f4ec' }}><p style={{ fontSize:32, marginBottom:12 }}>⭐</p><p style={{ fontWeight:700, color:'#2d4a35', marginBottom:4 }}>Sem dados suficientes</p><p style={{ fontSize:12, color:'#94a3b8' }}>Suba uma planilha Sportsbase ou Wyscout para gerar as seleções.</p></div>

  const groups = ['GK','DEF','MID','FWD']
  const byGroup = Object.fromEntries(groups.map(group => [group, squad.filter(player => player._grupo === group)]))
  const thresholdsText = Object.entries(thresholds).map(([slot,item]) => {
    if (source === 'combined') {
      const parts=[]
      if (item.sportsbase > 0) parts.push(`SB ${item.sportsbase}`)
      if (item.wyscout > 0) parts.push(`WY ${item.wyscout}`)
      return parts.length ? `${slot}: ${parts.join(' / ')} min` : null
    }
    return item.limiar > 0 ? `${slot} ≥ ${item.limiar} min` : null
  }).filter(Boolean).join(' · ')

  return <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:14, flexWrap:'wrap', marginBottom:14 }}>
      <div><h2 style={{ fontSize:18, fontWeight:900, color:'#1a2e1a' }}>⭐ Seleções do Campeonato</h2><p style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>4-3-3 funcional · {total} jogadores elegíveis · fonte {source === 'combined' ? 'Sportsbase + Wyscout' : source === 'sportsbase' ? 'Sportsbase' : 'Wyscout'}{uploadAt ? ` · ${new Date(uploadAt).toLocaleDateString('pt-BR')}` : ''}</p></div>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:8.5,fontWeight:900,color:'#94a3b8'}}>FONTE</span>{[['auto','Auto'],['sportsbase','Sportsbase'],['wyscout','Wyscout']].filter(([value])=>value==='auto'||availableSources[value]).map(([value,label])=><button key={value} onClick={()=>onSourceChange?.(value)} style={{padding:'6px 8px',border:`1px solid ${sourcePreference===value?BRAND_PRIMARY:'#dbe7f2'}`,borderRadius:7,background:sourcePreference===value?'#eaf4fd':'#fff',color:sourcePreference===value?BRAND_PRIMARY:'#64748b',fontSize:9,fontWeight:800,cursor:'pointer'}}>{label}</button>)}</div>
        <button onClick={buscar} style={{ padding:'8px 13px', background:'#fff', border:`1.5px solid ${BRAND_PRIMARY}`, borderRadius:9, color:BRAND_PRIMARY, fontWeight:800, cursor:'pointer' }}>↻ Atualizar</button><button onClick={handleExport} disabled={exporting} style={{ padding:'8px 13px', background:exporting?'#94a3b8':BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:9, fontWeight:800, cursor:exporting?'wait':'pointer' }}>{exporting?'Gerando...':'📄 PDF'}</button></div>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(190px,1fr))', gap:8, marginBottom:10 }}>
      {Object.entries(TYPE_LABELS).map(([key,item]) => <button key={key} onClick={() => { setSelectionType(key); setActiveSquad('reference'); setSelected(null) }} style={{ textAlign:'left', padding:'11px 12px', borderRadius:11, border:`1.5px solid ${selectionType===key?item.tone:'#dbe7f2'}`, background:selectionType===key?`${item.tone}0d`:'#fff', cursor:'pointer' }}><strong style={{ display:'block', color:selectionType===key?item.tone:'#334155', fontSize:11 }}>{item.label}</strong><span style={{ color:'#64748b', fontSize:8.7, lineHeight:1.4 }}>{item.question}</span></button>)}
    </div>

    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:10 }}>
      <div style={{ display:'flex', gap:4, padding:3, border:'1px solid #e8f4ec', borderRadius:10, background:'#f8fdf9' }}>{Object.entries(SQUAD_LABELS).map(([key,label]) => <button key={key} onClick={() => { setActiveSquad(key); setSelected(null) }} style={{ padding:'7px 13px', border:'none', borderRadius:8, background:activeSquad===key?typeInfo.tone:'transparent', color:activeSquad===key?'#fff':'#64748b', fontSize:10.5, fontWeight:850, cursor:'pointer' }}>{label}</button>)}</div>
      <span style={{ color:typeInfo.tone, background:`${typeInfo.tone}0d`, border:`1px solid ${typeInfo.tone}25`, borderRadius:8, padding:'6px 9px', fontSize:9.5, fontWeight:850 }}>{typeof methodology === 'string' ? methodology : methodology?.[selectionType]}</span>
    </div>

    {thresholdsText && <div style={{ padding:'8px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9, marginBottom:9, fontSize:10, color:'#15803d' }}>Amostra por função: {thresholdsText}</div>}
    {missingGroups.includes('GK') && <div style={{ padding:'8px 12px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:9, marginBottom:9, fontSize:10, color:'#c2410c' }}>O arquivo não contém goleiros; a vaga permanece vazia.</div>}
    {missingRoles.filter(role => role !== 'GK').length > 0 && <div style={{ padding:'8px 12px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:9, marginBottom:9, fontSize:10, color:'#c2410c' }}>Funções sem pool elegível: {missingRoles.filter(role => role !== 'GK').join(', ')}.</div>}

    <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:18, alignItems:'start' }}>
      <div style={{ position:'relative' }}><div style={{ position:'relative', width:'100%', paddingBottom:'130%', background:'linear-gradient(180deg,#1a6b3a 0%,#15572f 50%,#1a6b3a 100%)', borderRadius:16, overflow:'hidden', border:'2px solid rgba(255,255,255,.12)', boxShadow:'0 8px 32px rgba(0,0,0,.25)' }}><SvgCampo />{SELECTION_SLOTS.map(slot => { const player=squad.find(item => item._slot === slot.id) || null; const isSelected=selected?.nome===player?.nome&&selected?.equipa===player?.equipa; return <PitchPlayer key={slot.id} jogador={player} x={slot.x} y={slot.y} selected={isSelected} emptyLabel={slot.label} onClick={() => player && setSelected(isSelected?null:player)} /> })}{selected && <CardDetalhe jogador={selected} onClose={() => setSelected(null)} />}<div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,.55)', padding:'4px 14px', borderRadius:20, color:'rgba(255,255,255,.8)', fontSize:10, fontWeight:800 }}>{typeInfo.label} · {SQUAD_LABELS[activeSquad]}</div></div></div>
      <div style={{ display:'grid', gap:10 }}>{groups.map(group => { const color=GRUPO_COR[group]; const players=byGroup[group] || []; return <div key={group} style={{ background:'#fff', borderRadius:11, border:'1px solid #e8f4ec', overflow:'hidden' }}><div style={{ background:color, padding:'7px 11px', color:'#fff', fontSize:9, fontWeight:900, textTransform:'uppercase' }}>{GRUPO_LABEL[group]}</div>{players.length ? players.map(player => <div key={`${player.nome}-${player._slot}`} onClick={() => setSelected(player)} style={{ padding:'8px 11px', borderBottom:'1px solid #f1f5f2', cursor:'pointer' }}><div style={{ display:'flex', justifyContent:'space-between', gap:8 }}><div><strong style={{ display:'block', color:'#1a2e1a', fontSize:10.5 }}>{player.nome?.split(' ').slice(-2).join(' ')}</strong><span style={{ color:'#94a3b8', fontSize:8.5 }}>{player._role_label} · {player.equipa}</span></div><strong style={{ color:typeInfo.tone, fontSize:12 }}>{player._selection_score?.toFixed?.(0) || player._score?.toFixed?.(0)}</strong></div><div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:5 }}><span style={{ fontSize:7.8, padding:'2px 5px', borderRadius:5, background:'#e8f7ee', color:'#15803d', fontWeight:850 }}>Faixa {player._nivel_atual}</span><span style={{ fontSize:7.8, padding:'2px 5px', borderRadius:5, background:'#f1ecff', color:'#7c3aed', fontWeight:850 }}>Proj. {player._nivel_potencial}</span></div></div>) : <p style={{ padding:9, color:'#94a3b8', fontSize:9 }}>Sem elegíveis</p>}</div> })}</div>
    </div>
  </div>
}

/* ══════════════════════════════════════════════════════════════════════
   SHADOW TEAMS
   ══════════════════════════════════════════════════════════════════════ */
const SHADOW_SLOTS = [
  { id:'GK',  grupo:'GK',  label:'GOL', x:50, y:88 },
  { id:'LB',  grupo:'DEF', label:'LE',  x:16, y:70, footPref:'esquerdo' },
  { id:'CB1', grupo:'DEF', label:'ZAG', x:37, y:67 },
  { id:'CB2', grupo:'DEF', label:'ZAG', x:63, y:67 },
  { id:'RB',  grupo:'DEF', label:'LD',  x:84, y:70, footPref:'direito' },
  { id:'CM1', grupo:'MID', label:'MEI', x:22, y:46 },
  { id:'CM2', grupo:'MID', label:'VOL', x:50, y:50 },
  { id:'CM3', grupo:'MID', label:'MEI', x:78, y:46 },
  { id:'LW',  grupo:'FWD', label:'ATA', x:20, y:22 },
  { id:'ST',  grupo:'FWD', label:'CA',  x:50, y:16 },
  { id:'RW',  grupo:'FWD', label:'ATA', x:80, y:22 },
]

function getGrupoFromPos(posicao) {
  if (!posicao) return null
  const p = posicao.split(',')[0].trim().toUpperCase()
  if (p==='GK') return 'GK'
  if (['CB','LCB','RCB','LB','RB'].includes(p)) return 'DEF'
  if (['DMF','CMF','AMF','LMF','RMF','CDM','LCDM','RCDM','LDM','RDM','LCM','RCM','CAM','LCAM','RCAM','LM','RM'].includes(p)) return 'MID'
  if (['LWF','RWF','CF','LCF','RCF','SS','LAMF','RAMF','LAM','RAM'].includes(p)) return 'FWD'
  return null
}

function PlayerPickerModal({ slot, jogadores, onSelect, onClose }) {
  const [aba, setAba]             = useState('base')
  const [busca, setBusca]         = useState('')
  const [grupFilter, setGrupFilter] = useState(slot?.grupo||'')
  const [manual, setManual]       = useState({ nome:'', equipa:'', posicao:'', pe:'direito', idade:'' })

  const filtered = useMemo(() => {
    return jogadores.filter(j => {
      const gOk = !grupFilter || getGrupoFromPos(j.posicao)===grupFilter
      const nOk = !busca || (j.nome||'').toLowerCase().includes(busca.toLowerCase()) || (j.equipa||'').toLowerCase().includes(busca.toLowerCase())
      return gOk && nOk
    }).slice(0, 60)
  }, [jogadores, busca, grupFilter])

  const confirmarManual = () => {
    if (!manual.nome.trim()) return
    onSelect({ nome:manual.nome.trim(), equipa:manual.equipa.trim(), posicao:manual.posicao||'?', pe:manual.pe, idade:manual.idade?parseInt(manual.idade):null })
    onClose()
  }

  const inputStyle = { width:'100%', border:'1.5px solid #e8f4ec', borderRadius:8, padding:'8px 12px', fontSize:12, outline:'none', boxSizing:'border-box', color:'#1a2e1a' }
  const labelStyle = { fontSize:10, fontWeight:700, color:'#64748b', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e8f4ec', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fdf9' }}>
          <div>
            <p style={{ fontSize:14, fontWeight:800, color:'#1a2e1a' }}>Escolher jogador</p>
            <p style={{ fontSize:11, color:'#94a3b8' }}>Slot: <strong>{slot?.label}</strong>{slot?.footPref&&` · Pé ${slot.footPref} preferencial`}</p>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>✕</button>
        </div>

        {/* abas */}
        <div style={{ display:'flex', borderBottom:'1px solid #e8f4ec' }}>
          {[{id:'base',label:'📋 Da Base'},{id:'manual',label:'✏️ Manual'}].map(a=>(
            <button key={a.id} onClick={()=>setAba(a.id)} style={{
              flex:1, padding:'10px', border:'none', borderBottom:`2px solid ${aba===a.id?BRAND_PRIMARY:'transparent'}`,
              background:'transparent', cursor:'pointer', fontSize:12, fontWeight:700,
              color:aba===a.id?BRAND_PRIMARY:'#94a3b8', transition:'all .15s' }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* aba: base */}
        {aba==='base' && (<>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8f4ec', display:'flex', flexDirection:'column', gap:8 }}>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Nome ou clube..." autoFocus
              style={{ border:'1.5px solid #e8f4ec', borderRadius:8, padding:'8px 12px', fontSize:12, outline:'none' }} />
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {[{id:'',label:'Todos'},{id:'GK',label:'Goleiro'},{id:'DEF',label:'Defensor'},{id:'MID',label:'Meia'},{id:'FWD',label:'Atacante'}].map(g=>(
                <button key={g.id} onClick={()=>setGrupFilter(g.id)} style={{
                  padding:'5px 12px', border:`1.5px solid ${grupFilter===g.id?BRAND_PRIMARY:'#e8f4ec'}`, borderRadius:20, fontSize:11, fontWeight:700,
                  background:grupFilter===g.id?BRAND_PRIMARY:'#fff', color:grupFilter===g.id?'#fff':'#64748b', cursor:'pointer' }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {filtered.length===0
              ? <div style={{ padding:24, textAlign:'center' }}>
                  <p style={{ color:'#94a3b8', fontSize:12, marginBottom:8 }}>Nenhum jogador encontrado na base</p>
                  <button onClick={()=>setAba('manual')} style={{ padding:'7px 16px', background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                    ✏️ Adicionar manualmente
                  </button>
                </div>
              : filtered.map((j,i) => {
                  const footOk = slot?.footPref ? j.pe===slot.footPref : null
                  return (
                    <div key={i} onClick={()=>{ onSelect(j); onClose() }}
                      style={{ padding:'10px 16px', borderBottom:'1px solid #f8fdf9', cursor:'pointer',
                        display:'flex', justifyContent:'space-between', alignItems:'center', background:footOk===true?'#f0fdf4':'#fff' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8fdf9'}
                      onMouseLeave={e=>e.currentTarget.style.background=footOk===true?'#f0fdf4':'#fff'}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <p style={{ fontSize:13, fontWeight:700, color:BRAND_PRIMARY }}>{j.nome}</p>
                          <PeIcon pe={j.pe} />
                          {footOk===true && <span style={{ fontSize:9, background:'#16a34a', color:'#fff', padding:'1px 5px', borderRadius:10, fontWeight:700 }}>✓ pé</span>}
                        </div>
                        <p style={{ fontSize:11, color:'#64748b' }}>{j.equipa}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <PosBadge pos={j.posicao} />
                        <span style={{ fontSize:11, color:'#94a3b8' }}>{j.idade||'?'} anos</span>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </>)}

        {/* aba: manual */}
        {aba==='manual' && (
          <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={labelStyle}>Nome *</label>
              <input value={manual.nome} onChange={e=>setManual(p=>({...p,nome:e.target.value}))} placeholder="Ex: Adrianinho" autoFocus style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Time / Clube *</label>
              <input value={manual.equipa} onChange={e=>setManual(p=>({...p,equipa:e.target.value}))} placeholder="Ex: Brusque" style={inputStyle} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={labelStyle}>Posição</label>
                <select value={manual.posicao} onChange={e=>setManual(p=>({...p,posicao:e.target.value}))}
                  style={{ ...inputStyle, cursor:'pointer' }}>
                  <option value="">Selecionar...</option>
                  <optgroup label="Goleiro"><option value="GK">GK — Goleiro</option></optgroup>
                  <optgroup label="Defensores">
                    <option value="CB">CB — Zagueiro</option>
                    <option value="LB">LB — Lateral Esq.</option>
                    <option value="RB">RB — Lateral Dir.</option>
                    <option value="LWB">LWB — Ala Esq.</option>
                    <option value="RWB">RWB — Ala Dir.</option>
                  </optgroup>
                  <optgroup label="Meio-campo">
                    <option value="DMF">DMF — Volante</option>
                    <option value="CMF">CMF — Meia Central</option>
                    <option value="AMF">AMF — Meia Ofensivo</option>
                    <option value="LMF">LMF — Meia Esq.</option>
                    <option value="RMF">RMF — Meia Dir.</option>
                  </optgroup>
                  <optgroup label="Ataque">
                    <option value="LWF">LWF — Ponta Esq.</option>
                    <option value="RWF">RWF — Ponta Dir.</option>
                    <option value="SS">SS — Segundo Atacante</option>
                    <option value="CF">CF — Centroavante</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Idade</label>
                <input type="number" min="15" max="45" value={manual.idade} onChange={e=>setManual(p=>({...p,idade:e.target.value}))} placeholder="Ex: 24" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Pé dominante</label>
              <div style={{ display:'flex', gap:8 }}>
                {[{v:'direito',l:'🦶 Direito'},{v:'esquerdo',l:'🦶 Esquerdo'},{v:'ambos',l:'⚡ Ambos'}].map(opt=>(
                  <button key={opt.v} onClick={()=>setManual(p=>({...p,pe:opt.v}))}
                    style={{ flex:1, padding:'8px', border:`1.5px solid ${manual.pe===opt.v?BRAND_PRIMARY:'#e8f4ec'}`,
                      borderRadius:8, background:manual.pe===opt.v?'#f0fdf4':'#fff',
                      color:manual.pe===opt.v?BRAND_PRIMARY:'#64748b', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={confirmarManual} disabled={!manual.nome.trim()||!manual.equipa.trim()}
              style={{ padding:'10px', background:manual.nome.trim()&&manual.equipa.trim()?BRAND_PRIMARY:'#e2e8f0', color:'#fff',
                border:'none', borderRadius:8, cursor:manual.nome.trim()&&manual.equipa.trim()?'pointer':'not-allowed',
                fontSize:13, fontWeight:700, marginTop:4 }}>
              ✅ Confirmar jogador manual
            </button>
          </div>
        )}

        {/* rodapé */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #e8f4ec' }}>
          <button onClick={()=>{ onSelect(null); onClose() }} style={{ width:'100%', padding:9, background:'#fff', border:'1.5px solid #fecaca', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, color:'#dc2626' }}>
            🗑 Remover jogador deste slot
          </button>
        </div>
      </div>
    </div>
  )
}

function ShadowPitch({ slots, onSlotClick }) {
  return (
    <div style={{ position:'relative', width:'100%', paddingBottom:'130%',
      background:'linear-gradient(180deg,#1a6b3a 0%,#15572f 50%,#1a6b3a 100%)',
      borderRadius:16, overflow:'hidden', border:'2px solid rgba(255,255,255,0.12)',
      boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
      <SvgCampo />
      {SHADOW_SLOTS.map(slot => {
        const jogador     = slots[slot.id] || null
        const cor         = GRUPO_COR[slot.grupo] || BRAND_PRIMARY
        const nomeDisplay = jogador?.nome?.split(' ').slice(-1)[0] || null
        const timeDisplay = jogador?.equipa ? jogador.equipa.split(' ').slice(0,2).join(' ') : null
        return (
          <div key={slot.id} onClick={()=>onSlotClick(slot)}
            style={{ position:'absolute', left:`${slot.x}%`, top:`${slot.y}%`, transform:'translate(-50%,-50%)',
              cursor:'pointer', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <div style={{ width:46, height:46, borderRadius:'50%',
              background:jogador?`${cor}ee`:'rgba(255,255,255,0.12)',
              border:jogador?`2px solid ${cor}`:'2px dashed rgba(255,255,255,0.4)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:jogador?'0 2px 8px rgba(0,0,0,0.35)':'none', transition:'all 0.15s' }}>
              {jogador
                ? <span style={{ fontSize:11, fontWeight:900, color:'#fff' }}>{slot.label}</span>
                : <span style={{ fontSize:14, color:'rgba(255,255,255,0.5)', fontWeight:300 }}>+</span>
              }
            </div>
            <span style={{ fontSize:10, fontWeight:700,
              color:jogador?'#fff':'rgba(255,255,255,0.45)',
              background:jogador?'rgba(0,0,0,0.65)':'transparent',
              padding:jogador?'2px 7px':'0', borderRadius:20, whiteSpace:'nowrap',
              maxWidth:84, overflow:'hidden', textOverflow:'ellipsis',
              backdropFilter:jogador?'blur(4px)':'none', lineHeight:1.3 }}>
              {nomeDisplay||slot.label}
            </span>
            {timeDisplay && (
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.65)', background:'rgba(0,0,0,0.4)',
                padding:'1px 5px', borderRadius:20, whiteSpace:'nowrap', backdropFilter:'blur(4px)' }}>
                {timeDisplay}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ShadowTeams({ slug, ligaNome }) {
  const [teams, setTeams]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeId, setActiveId]   = useState(null)
  const [slots, setSlots]         = useState({})
  const [teamName, setTeamName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [pickerSlot, setPickerSlot] = useState(null)
  const [jogadores, setJogadores] = useState([])
  const [editingName, setEditingName] = useState(false)
  const [exporting, setExporting]     = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try { await exportShadowPDF(slots, teamName||'Shadow Team', ligaNome) }
    catch(e) { console.error(e) }
    setExporting(false)
  }

  const buscarTeams = useCallback(async () => {
    setLoading(true)
    try { const res=await fetch(`/api/ligas-v2/${slug}/shadow-team`); if(res.ok){const d=await res.json();setTeams(d.teams||[])} }
    catch(e){console.error(e)}
    setLoading(false)
  }, [slug])

  const buscarJogadores = useCallback(async () => {
    try { const res=await fetch(`/api/ligas-v2/${slug}/sportsbase?min=0`); if(res.ok){const d=await res.json();setJogadores(d.jogadores||[])} }
    catch(e){}
  }, [slug])

  useEffect(() => { buscarTeams(); buscarJogadores() }, [buscarTeams, buscarJogadores])

  useEffect(() => {
    const t = teams.find(t=>t.id===activeId)
    if (t) { setSlots(t.slots||{}); setTeamName(t.team_name||'') }
  }, [activeId, teams])

  useEffect(() => {
    if (teams.length && activeId===null) setActiveId(teams[0].id)
  }, [teams, activeId])

  const criarNovoTime = async () => {
    const nome = `Shadow Team ${teams.length+1}`
    try {
      const res = await fetch(`/api/ligas-v2/${slug}/shadow-team`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ team_name:nome, slots:{} }) })
      if (res.ok) { const d=await res.json(); await buscarTeams(); setActiveId(d.id); setSlots({}); setTeamName(nome) }
    } catch(e){console.error(e)}
  }

  const salvar = async () => {
    if (!activeId) return
    setSaving(true)
    try { await fetch(`/api/ligas-v2/${slug}/shadow-team`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:activeId,team_name:teamName||'Shadow Team',slots})}); await buscarTeams() }
    catch(e){console.error(e)}
    setSaving(false)
  }

  const removerTime = async (id) => {
    if (!confirm('Remover este shadow team?')) return
    await fetch(`/api/ligas-v2/${slug}/shadow-team?id=${id}`,{method:'DELETE'})
    await buscarTeams()
    if (activeId===id) setActiveId(null)
  }

  const handleSlotSelect = (jogador) => {
    if (!pickerSlot) return
    setSlots(prev => ({ ...prev, [pickerSlot.id]: jogador ? { nome:jogador.nome, equipa:jogador.equipa, posicao:jogador.posicao, pe:jogador.pe, idade:jogador.idade } : undefined }))
  }

  const countFilled = Object.values(slots).filter(Boolean).length

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>Carregando shadow teams...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:900, color:'#1a2e1a', marginBottom:2 }}>🕶 Shadow Teams</h2>
          <p style={{ fontSize:12, color:'#94a3b8' }}>Monte e salve seus times manualmente · Clique num slot para escolher o jogador</p>
        </div>
        <button onClick={criarNovoTime} style={{ padding:'9px 18px', background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700 }}>+ Novo Time</button>
      </div>

      {teams.length===0 ? (
        <div style={{ padding:48, textAlign:'center', background:'#fff', borderRadius:14, border:'1px solid #e8f4ec' }}>
          <p style={{ fontSize:32, marginBottom:12 }}>🕶</p>
          <p style={{ fontWeight:700, color:'#2d4a35', marginBottom:4 }}>Nenhum shadow team ainda</p>
          <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Clique em "Novo Time" para começar a montar</p>
          <button onClick={criarNovoTime} style={{ padding:'10px 24px', background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>+ Criar primeiro time</button>
        </div>
      ) : (
        <div>
          <div style={{ display:'flex', gap:4, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
            {teams.map(t=>(
              <button key={t.id} onClick={()=>setActiveId(t.id)} style={{
                padding:'7px 16px', border:`1.5px solid ${activeId===t.id?BRAND_PRIMARY:'#e8f4ec'}`, borderRadius:8, cursor:'pointer',
                fontSize:12, fontWeight:700, background:activeId===t.id?BRAND_PRIMARY:'#fff', color:activeId===t.id?'#fff':'#64748b' }}>
                {t.team_name}
              </button>
            ))}
          </div>

          {activeId && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20, alignItems:'start' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                  {editingName
                    ? <input value={teamName} onChange={e=>setTeamName(e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==='Enter'&&setEditingName(false)} autoFocus
                        style={{ border:`1.5px solid ${BRAND_PRIMARY}`, borderRadius:8, padding:'7px 12px', fontSize:14, fontWeight:700, color:'#1a2e1a', outline:'none', minWidth:200 }} />
                    : <h3 onClick={()=>setEditingName(true)} title="Clique para renomear"
                        style={{ fontSize:15, fontWeight:800, color:'#1a2e1a', cursor:'pointer', borderBottom:'1.5px dashed #e8f4ec', paddingBottom:2 }}>
                        {teamName||'Shadow Team'} ✏️
                      </h3>
                  }
                  <span style={{ fontSize:12, color:'#94a3b8' }}>{countFilled}/11 jogadores</span>
                  <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                    <button onClick={handleExport} disabled={exporting} style={{ padding:'8px 16px', background:exporting?'#94a3b8':BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:8, cursor:exporting?'wait':'pointer', fontSize:12, fontWeight:700, opacity:exporting?0.7:1 }}>
                      {exporting?'Gerando...':'📄 PDF'}
                    </button>
                    <button onClick={salvar} disabled={saving} style={{ padding:'8px 20px', background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:8, cursor:saving?'not-allowed':'pointer', fontSize:12, fontWeight:700, opacity:saving?0.7:1 }}>
                      {saving?'Salvando...':'💾 Salvar'}
                    </button>
                    <button onClick={()=>removerTime(activeId)} style={{ padding:'8px 12px', background:'#fff', color:'#dc2626', border:'1.5px solid #fecaca', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700 }}>🗑</button>
                  </div>
                </div>
                <ShadowPitch slots={slots} onSlotClick={setPickerSlot} />
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ background:'linear-gradient(135deg,#064b82,#0a66b7)', borderRadius:12, padding:'14px 16px' }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', marginBottom:2 }}>Escalação</p>
                  <p style={{ fontSize:22, fontWeight:900, color:'#fff' }}>{countFilled} <span style={{ fontSize:14, fontWeight:600, opacity:.7 }}>/ 11</span></p>
                </div>
                {SHADOW_SLOTS.map(slot => {
                  const jogador = slots[slot.id]
                  const cor     = GRUPO_COR[slot.grupo]
                  return (
                    <div key={slot.id} onClick={()=>setPickerSlot(slot)}
                      style={{ background:'#fff', borderRadius:10, border:`1.5px solid ${jogador?cor+'44':'#e8f4ec'}`,
                        padding:'9px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'border-color 0.1s' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=cor}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=jogador?cor+'44':'#e8f4ec'}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:6, background:`${cor}22`, color:cor, minWidth:28, textAlign:'center' }}>{slot.label}</span>
                        {jogador
                          ? <div>
                              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <p style={{ fontSize:12, fontWeight:700, color:'#1a2e1a' }}>{jogador.nome?.split(' ').slice(-2).join(' ')}</p>
                                <PeIcon pe={jogador.pe} />
                              </div>
                              <p style={{ fontSize:10, color:'#94a3b8' }}>{jogador.equipa}</p>
                            </div>
                          : <p style={{ fontSize:11, color:'#94a3b8' }}>Clique para escolher</p>
                        }
                      </div>
                      <span style={{ fontSize:12, color:'#94a3b8' }}>›</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {pickerSlot && <PlayerPickerModal slot={pickerSlot} jogadores={jogadores} onSelect={handleSlotSelect} onClose={()=>setPickerSlot(null)} />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   SELEÇÃO DA RODADA
   ══════════════════════════════════════════════════════════════════════ */
function SelecaoRodada({ slug }) {
  // ── estado de upload ──────────────────────────────────────────────────
  const [showUpload, setShowUpload] = useState(false)
  const [uploadRodada, setUploadRodada] = useState('')
  const [uploadFile, setUploadFile]   = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadMsg, setUploadMsg]     = useState(null) // { ok, text }

  // ── estado de rodadas e jogadores ─────────────────────────────────────
  const [rodadas, setRodadas]       = useState([])
  const [loadingRodadas, setLoadingRodadas] = useState(true)
  const [rodadaAtiva, setRodadaAtiva]   = useState(null)
  const [jogadores, setJogadores]       = useState([])
  const [loadingJogs, setLoadingJogs]   = useState(false)
  const [xiSelecionado, setXiSelecionado] = useState([]) // ids dos 11 marcados

  // ── estado de categorias especiais ─────────────────────────────────
  const CATS_CONFIG = [
    { key:'goleiro',  emoji:'🧤', label:'Melhor Goleiro',       cor:'#0284c7',
      score: j => (j.remates_intercetados||0)*3 + (j.intercecoes||0)*1.5 - (j.contribuicao_ofensiva||0)*0.5,
      template: j => `🧤 ${j.jogador} (${j.clube}) foi o destaque entre os goleiros da rodada. Registrou ${j.remates_intercetados||0} remate(s) interceptado(s) e ${j.intercecoes||0} interceptações, sendo determinante para a solidez defensiva da equipe.` },
    { key:'defensor', emoji:'🧱', label:'Melhor Defensor',       cor:'#15803d',
      score: j => (j.duelos_def_ganhos||0)*2 + (j.intercecoes||0)*1.5 + (j.recuperacoes||0),
      template: j => `🧱 ${j.jogador} (${j.clube}) se destacou na fase defensiva com ${j.duelos_def_ganhos||0}/${j.duelos_def_total||0} duelos defensivos ganhos e ${j.recuperacoes||0} recuperações de bola, exercendo controle defensivo consistente ao longo da partida.` },
    { key:'motor',    emoji:'⚙️', label:'Motor do Meio-campo',   cor:'#7c3aed',
      score: j => (j.passes_progressivos||0) + (j.recuperacoes||0) + (j.passes_decisivos||0)*1.5 + (j.organizacao||0)*2,
      template: j => `⚙️ ${j.jogador} (${j.clube}) foi o motor do meio-campo com ${j.passes_progressivos||0} passes progressivos, ${j.recuperacoes||0} recuperações e ${j.passes_decisivos||0} passes decisivos, equilibrando as duas fases e dando fluidez ao jogo da equipe.` },
    { key:'mvp',      emoji:'🎯', label:'Jogador da Rodada',     cor:'#d97706',
      score: j => parseFloat(j.score||0),
      template: j => `🎯 ${j.jogador} (${j.clube}) foi o jogador mais influente da rodada com score geral ${parseFloat(j.score||0).toFixed(1)}, contribuindo com ${j.gols||0} gol(s), ${j.assistencias||0} assistência(s) e xGChain de ${parseFloat(j.contribuicao_ofensiva||0).toFixed(2)}.` },
  ]
  const [categorias, setCategorias] = useState({ goleiro:{}, defensor:{}, motor:{}, mvp:{} })
  const [catEdit, setCatEdit]       = useState({ goleiro:{jogador_nome:'',clube:'',justificativa:''}, defensor:{jogador_nome:'',clube:'',justificativa:''}, motor:{jogador_nome:'',clube:'',justificativa:''}, mvp:{jogador_nome:'',clube:'',justificativa:''} })
  const [salvandoCat, setSalvandoCat] = useState({})
  const [catPickerAberto, setCatPickerAberto] = useState(null)
  const [catBusca, setCatBusca]     = useState('')

  // ── busca rodadas disponíveis ─────────────────────────────────────────
  const buscarRodadas = useCallback(async () => {
    setLoadingRodadas(true)
    try {
      const res = await fetch(`/api/ligas-v2/${slug}/rodada-pdf`)
      if (res.ok) { const d = await res.json(); setRodadas(d.rodadas || []) }
    } catch(e) { console.error(e) }
    setLoadingRodadas(false)
  }, [slug])

  useEffect(() => { buscarRodadas() }, [buscarRodadas])

  // ── busca jogadores de uma rodada ─────────────────────────────────────
  const abrirRodada = async (rodada) => {
    if (rodadaAtiva === rodada) { setRodadaAtiva(null); setJogadores([]); setXiSelecionado([]); return }
    setRodadaAtiva(rodada)
    setJogadores([])
    setXiSelecionado([])
    setCategorias({ goleiro:{}, defensor:{}, motor:{}, mvp:{} })
    setCatEdit({ goleiro:{jogador_nome:'',clube:'',justificativa:''}, defensor:{jogador_nome:'',clube:'',justificativa:''}, motor:{jogador_nome:'',clube:'',justificativa:''}, mvp:{jogador_nome:'',clube:'',justificativa:''} })
    setLoadingJogs(true)
    try {
      const [resJogs, resCats] = await Promise.all([
        fetch(`/api/ligas-v2/${slug}/rodada-pdf?rodada=${rodada}`),
        fetch(`/api/ligas-v2/${slug}/categorias-rodada?rodada=${rodada}`)
      ])
      if (resJogs.ok) {
        const d = await resJogs.json()
        const jogs = d.jogadores || []
        setJogadores(jogs)
        // Se não há categorias salvas ainda, calcular sugestões
        if (resCats.ok) {
          const dc = await resCats.json()
          const saved = dc.categorias || {}
          // Para cada categoria sem dados salvos, sugerir pelo score específico
          const editInit = {}
          ;['goleiro','defensor','motor','mvp'].forEach(key => {
            const cfg = [
              { key:'goleiro',  score: j => (j.remates_intercetados||0)*3 + (j.intercecoes||0)*1.5 - (j.contribuicao_ofensiva||0)*0.5 },
              { key:'defensor', score: j => (j.duelos_def_ganhos||0)*2 + (j.intercecoes||0)*1.5 + (j.recuperacoes||0) },
              { key:'motor',    score: j => (j.passes_progressivos||0) + (j.recuperacoes||0) + (j.passes_decisivos||0)*1.5 + (j.organizacao||0)*2 },
              { key:'mvp',      score: j => parseFloat(j.score||0) },
            ].find(c => c.key === key)
            if (saved[key]?.jogador_nome) {
              editInit[key] = saved[key]
            } else if (jogs.length > 0 && cfg) {
              const sug = [...jogs].sort((a,b) => cfg.score(b) - cfg.score(a))[0]
              const templates = {
                goleiro: j => `🧤 ${j.jogador} (${j.clube}) foi o destaque entre os goleiros da rodada. Registrou ${j.remates_intercetados||0} remate(s) interceptado(s) e ${j.intercecoes||0} interceptações, sendo determinante para a solidez defensiva da equipe.`,
                defensor: j => `🧱 ${j.jogador} (${j.clube}) se destacou na fase defensiva com ${j.duelos_def_ganhos||0}/${j.duelos_def_total||0} duelos defensivos ganhos e ${j.recuperacoes||0} recuperações de bola, exercendo controle defensivo consistente ao longo da partida.`,
                motor: j => `⚙️ ${j.jogador} (${j.clube}) foi o motor do meio-campo com ${j.passes_progressivos||0} passes progressivos, ${j.recuperacoes||0} recuperações e ${j.passes_decisivos||0} passes decisivos, equilibrando as duas fases e dando fluidez ao jogo da equipe.`,
                mvp: j => `🎯 ${j.jogador} (${j.clube}) foi o jogador mais influente da rodada com score geral ${parseFloat(j.score||0).toFixed(1)}, contribuindo com ${j.gols||0} gol(s), ${j.assistencias||0} assistência(s) e xGChain de ${parseFloat(j.contribuicao_ofensiva||0).toFixed(2)}.`,
              }
              editInit[key] = { jogador_nome: sug.jogador, clube: sug.clube||'', justificativa: templates[key](sug) }
            } else {
              editInit[key] = { jogador_nome:'', clube:'', justificativa:'' }
            }
          })
          setCategorias(saved)
          setCatEdit(editInit)
        }
      }
    } catch(e) { console.error(e) }
    setLoadingJogs(false)
  }

  // ── upload do PDF ─────────────────────────────────────────────────────
  const handleUpload = async () => {
    setUploadMsg(null)
    if (!uploadRodada || !uploadFile) { setUploadMsg({ ok:false, text:'Informe a rodada e selecione o PDF.' }); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('rodada', uploadRodada)
      const res = await fetch(`/api/ligas-v2/${slug}/rodada-pdf`, { method:'POST', body:fd })
      const d   = await res.json()
      if (res.ok) {
        setUploadMsg({ ok:true, text: d.message || `${d.total} jogadores extraídos!` })
        setUploadFile(null); setUploadRodada('')
        setShowUpload(false)
        buscarRodadas()
      } else {
        setUploadMsg({ ok:false, text: d.error || 'Erro no upload.' })
      }
    } catch(e) { setUploadMsg({ ok:false, text: e.message }) }
    setUploading(false)
  }

  // ── apagar rodada ─────────────────────────────────────────────────────
  const apagarRodada = async (rodada) => {
    if (!confirm(`Apagar todos os dados da Rodada ${rodada}?`)) return
    await fetch(`/api/ligas-v2/${slug}/rodada-pdf?rodada=${rodada}`, { method:'DELETE' })
    if (rodadaAtiva === rodada) { setRodadaAtiva(null); setJogadores([]) }
    buscarRodadas()
  }

  // ── toggle jogador no XI ──────────────────────────────────────────────
  const toggleXI = (id) => {
    setXiSelecionado(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 11) return prev
      return [...prev, id]
    })
  }

  // ── salvar categoria ─────────────────────────────────────────────────
  const salvarCategoria = async (key) => {
    setSalvandoCat(p => ({...p, [key]:true}))
    try {
      const ed = catEdit[key] || {}
      const res = await fetch(`/api/ligas-v2/${slug}/categorias-rodada`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ rodada:rodadaAtiva, categoria:key, jogador_nome:ed.jogador_nome||'', clube:ed.clube||'', justificativa:ed.justificativa||'' })
      })
      if (res.ok) setCategorias(p => ({...p, [key]:ed}))
    } catch(e) { console.error(e) }
    setSalvandoCat(p => ({...p, [key]:false}))
  }

  // ── score badge color ─────────────────────────────────────────────────
  const scoreBg = (s) => {
    const v = parseFloat(s) || 0
    if (v >= 10) return '#15803d'
    if (v >= 5)  return '#0284c7'
    if (v >= 2)  return '#7c3aed'
    return '#64748b'
  }

  return (
    <div>
      {/* ── header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:900, color:'#1a2e1a', marginBottom:2 }}>📅 Seleção da Rodada</h2>
          <p style={{ fontSize:12, color:'#94a3b8' }}>Upload do Relatório Wyscout · Extração estruturada · Curadoria do XI</p>
        </div>
        <button onClick={()=>{ setShowUpload(v=>!v); setUploadMsg(null) }}
          style={{ padding:'9px 18px', background:showUpload?'#fff':BRAND_PRIMARY, color:showUpload?BRAND_PRIMARY:'#fff', border:`1.5px solid ${BRAND_PRIMARY}`, borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700 }}>
          {showUpload ? '✕ Cancelar' : '+ Upload PDF Wyscout'}
        </button>
      </div>

      {/* ── formulário de upload ── */}
      {showUpload && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8f4ec', padding:20, marginBottom:24 }}>
          <h3 style={{ fontSize:13, fontWeight:800, color:'#1a2e1a', marginBottom:4 }}>Importar Relatório da Jornada</h3>
          <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>O Claude vai ler o PDF e extrair automaticamente as estatísticas de todos os jogadores.</p>

          <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:10, fontWeight:700, color:'#64748b', display:'block', marginBottom:4 }}>RODADA *</label>
              <input type="number" min="1" value={uploadRodada} onChange={e=>setUploadRodada(e.target.value)} placeholder="ex: 3"
                style={{ width:'100%', border:'1.5px solid #e8f4ec', borderRadius:8, padding:'9px 12px', fontSize:13, fontWeight:700, color:'#1a2e1a', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:700, color:'#64748b', display:'block', marginBottom:4 }}>PDF DO RELATÓRIO WYSCOUT *</label>
              <input type="file" accept=".pdf" onChange={e=>setUploadFile(e.target.files?.[0]||null)}
                style={{ width:'100%', border:'1.5px solid #e8f4ec', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#475569', outline:'none', boxSizing:'border-box', cursor:'pointer' }} />
            </div>
          </div>

          {uploadMsg && (
            <p style={{ fontSize:12, color: uploadMsg.ok ? '#15803d' : '#dc2626', marginBottom:12, fontWeight:600 }}>
              {uploadMsg.ok ? '✅' : '⚠️'} {uploadMsg.text}
            </p>
          )}

          {uploading && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 16px', marginBottom:12, fontSize:12, color:'#15803d', fontWeight:600 }}>
              Processando o PDF e extraindo as estatísticas... Isso pode levar até 30 segundos.
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleUpload} disabled={uploading}
              style={{ padding:'9px 20px', background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:8, cursor:uploading?'not-allowed':'pointer', fontSize:13, fontWeight:700, opacity:uploading?0.7:1 }}>
              {uploading ? '⏳ Processando...' : '🚀 Extrair e Salvar'}
            </button>
            <button onClick={()=>{ setShowUpload(false); setUploadMsg(null) }}
              style={{ padding:'9px 16px', background:'#fff', color:'#64748b', border:'1.5px solid #e8f4ec', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── lista de rodadas disponíveis ── */}
      {loadingRodadas ? (
        <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Carregando...</div>
      ) : rodadas.length === 0 ? (
        <div style={{ padding:48, textAlign:'center', background:'#fff', borderRadius:14, border:'1px solid #e8f4ec' }}>
          <p style={{ fontSize:32, marginBottom:12 }}>📄</p>
          <p style={{ fontWeight:700, color:'#2d4a35', marginBottom:4 }}>Nenhuma rodada importada ainda</p>
          <p style={{ fontSize:12, color:'#94a3b8' }}>Faça upload do PDF do Relatório da Jornada do Wyscout</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* chips de rodadas */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {rodadas.map(r => (
              <button key={r.rodada} onClick={()=>abrirRodada(r.rodada)}
                style={{ padding:'7px 16px', background: rodadaAtiva===r.rodada ? BRAND_PRIMARY : '#fff', color: rodadaAtiva===r.rodada ? '#fff' : '#2d4a35',
                  border:`1.5px solid ${rodadaAtiva===r.rodada ? BRAND_PRIMARY : '#d1fae5'}`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:700, transition:'all .15s' }}>
                Rodada {r.rodada}
                <span style={{ marginLeft:6, fontSize:10, opacity:0.7 }}>{r.total_jogadores} jogadores</span>
              </button>
            ))}
          </div>

          {/* painel da rodada ativa */}
          {rodadaAtiva && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8f4ec', overflow:'hidden' }}>

              {/* header do painel */}
              <div style={{ padding:'14px 20px', background:'linear-gradient(135deg,#064b82,#0a66b7)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ fontSize:15, fontWeight:900, color:'#fff' }}>Rodada {rodadaAtiva}</p>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:2 }}>
                    {xiSelecionado.length}/11 jogadores no XI · Clique para marcar/desmarcar
                  </p>
                </div>
                <button onClick={()=>apagarRodada(rodadaAtiva)}
                  style={{ padding:'6px 12px', background:'rgba(255,255,255,0.1)', color:'#fca5a5', border:'1px solid rgba(255,100,100,0.3)', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                  🗑 Apagar rodada
                </button>
              </div>

              {/* legenda do score */}
              <div style={{ padding:'10px 20px', background:'#f8fdf9', borderBottom:'1px solid #e8f4ec', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:10, color:'#64748b', fontWeight:700 }}>SCORE:</span>
                {[['#15803d','≥10 Excepcional'],['#0284c7','≥5 Muito bom'],['#7c3aed','≥2 Bom'],['#64748b','Abaixo']].map(([cor,txt])=>(
                  <span key={txt} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#64748b' }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:cor, display:'inline-block' }} />{txt}
                  </span>
                ))}
                <span style={{ marginLeft:'auto', fontSize:11, color:'#15803d', fontWeight:700 }}>
                  {xiSelecionado.length === 11 ? '✅ XI completo!' : `Selecione mais ${11 - xiSelecionado.length} jogadores`}
                </span>
              </div>

              {/* tabela de jogadores */}
              {loadingJogs ? (
                <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Carregando jogadores...</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                    <thead>
                      <tr style={{ background:'#f8fdf9' }}>
                        {['XI','#','Jogador','Clube','Score','G','A','xGChain','Toques área','Rec.','Duelos def.','Dribles'].map((h,i)=>(
                          <th key={i} style={{ padding:'9px 12px', fontSize:10, fontWeight:800, color:'#64748b', textAlign: i<3?'left':'center', borderBottom:'1px solid #e8f4ec', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jogadores.map((j, idx) => {
                        const noXI = xiSelecionado.includes(j.id)
                        const xiLleno = xiSelecionado.length >= 11 && !noXI
                        return (
                          <tr key={j.id} onClick={()=>!xiLleno && toggleXI(j.id)}
                            style={{ background: noXI ? '#f0fdf4' : idx%2===0 ? '#fff' : '#fafafa',
                              cursor: xiLleno ? 'not-allowed' : 'pointer', transition:'background .1s',
                              borderLeft: noXI ? `3px solid ${BRAND_PRIMARY}` : '3px solid transparent',
                              opacity: xiLleno ? 0.5 : 1 }}>
                            <td style={{ padding:'9px 12px', textAlign:'center' }}>
                              <span style={{ fontSize:14 }}>{noXI ? '✅' : '○'}</span>
                            </td>
                            <td style={{ padding:'9px 12px', fontSize:11, fontWeight:700, color:'#94a3b8' }}>{idx+1}</td>
                            <td style={{ padding:'9px 12px' }}>
                              <span style={{ fontSize:13, fontWeight:800, color:'#1a2e1a' }}>{j.jogador}</span>
                            </td>
                            <td style={{ padding:'9px 12px' }}>
                              <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>{j.clube || '—'}</span>
                            </td>
                            <td style={{ padding:'9px 12px', textAlign:'center' }}>
                              <span style={{ background:scoreBg(j.score), color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>
                                {parseFloat(j.score||0).toFixed(1)}
                              </span>
                            </td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, fontWeight:700, color: j.gols>0?'#15803d':'#94a3b8' }}>{j.gols||0}</td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, fontWeight:700, color: j.assistencias>0?'#0284c7':'#94a3b8' }}>{j.assistencias||0}</td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, color:'#475569' }}>{parseFloat(j.contribuicao_ofensiva||0).toFixed(2)}</td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, color:'#475569' }}>{j.toques_area||0}</td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, color:'#475569' }}>{j.recuperacoes||0}</td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, color:'#475569' }}>
                              {j.duelos_def_ganhos||0}/{j.duelos_def_total||0}
                            </td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, color:'#475569' }}>
                              {j.dribles_sucesso||0}/{j.dribles_total||0}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── categorias especiais ── */}
              {jogadores.length > 0 && (
                <div style={{ padding:'20px 20px 4px', borderTop:'1px solid #e8f4ec' }}>
                  <div style={{ marginBottom:16 }}>
                    <p style={{ fontSize:13, fontWeight:900, color:'#1a2e1a', marginBottom:2 }}>🏆 Categorias Especiais</p>
                    <p style={{ fontSize:11, color:'#94a3b8' }}>Sistema sugere com base nos dados · Confirme ou troque o jogador e edite a justificativa</p>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:14, marginBottom:20 }}>
                    {CATS_CONFIG.map(cfg => {
                      const ed      = catEdit[cfg.key] || {}
                      const salvo   = categorias[cfg.key]?.jogador_nome
                      const saving  = salvandoCat[cfg.key]
                      const pickerOn = catPickerAberto === cfg.key
                      const filtrados = catBusca.trim()
                        ? jogadores.filter(j => j.jogador?.toLowerCase().includes(catBusca.toLowerCase()) || j.clube?.toLowerCase().includes(catBusca.toLowerCase()))
                        : [...jogadores].sort((a,b) => cfg.score(b) - cfg.score(a)).slice(0,8)
                      return (
                        <div key={cfg.key} style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${salvo ? cfg.cor+'40' : '#e8f4ec'}`, overflow:'hidden' }}>
                          {/* header da categoria */}
                          <div style={{ padding:'10px 14px', background: salvo ? cfg.cor+'15' : '#f8fdf9', borderBottom:'1px solid #e8f4ec', display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:18 }}>{cfg.emoji}</span>
                            <div style={{ flex:1 }}>
                              <p style={{ fontSize:11, fontWeight:900, color: cfg.cor, textTransform:'uppercase', letterSpacing:'0.5px' }}>{cfg.label}</p>
                              {salvo && <p style={{ fontSize:10, color:'#64748b', marginTop:1 }}>✅ Confirmado</p>}
                            </div>
                          </div>
                          <div style={{ padding:14 }}>
                            {/* jogador selecionado */}
                            <div style={{ marginBottom:10 }}>
                              <label style={{ fontSize:9, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:4 }}>Jogador</label>
                              <div style={{ display:'flex', gap:6 }}>
                                <input value={ed.jogador_nome||''} onChange={e=>setCatEdit(p=>({...p,[cfg.key]:{...p[cfg.key],jogador_nome:e.target.value}}))}
                                  placeholder="Nome do jogador"
                                  style={{ flex:1, border:'1.5px solid #e8f4ec', borderRadius:7, padding:'7px 10px', fontSize:12, fontWeight:700, color:'#1a2e1a', outline:'none' }} />
                                <button onClick={()=>{ setCatPickerAberto(pickerOn?null:cfg.key); setCatBusca('') }}
                                  style={{ padding:'7px 10px', background: pickerOn?cfg.cor:'#f1f5f9', color: pickerOn?'#fff':'#64748b', border:'none', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                                  {pickerOn ? '✕' : '🔍 Trocar'}
                                </button>
                              </div>
                              {ed.clube && <p style={{ fontSize:10, color:'#64748b', marginTop:3 }}>{ed.clube}</p>}
                            </div>

                            {/* picker de jogador */}
                            {pickerOn && (
                              <div style={{ marginBottom:10, background:'#f8fdf9', borderRadius:8, border:'1px solid #e8f4ec', overflow:'hidden' }}>
                                <input value={catBusca} onChange={e=>setCatBusca(e.target.value)} placeholder="Buscar jogador..."
                                  style={{ width:'100%', border:'none', borderBottom:'1px solid #e8f4ec', padding:'8px 12px', fontSize:12, outline:'none', background:'transparent', boxSizing:'border-box' }} />
                                <div style={{ maxHeight:160, overflowY:'auto' }}>
                                  {filtrados.map(j => (
                                    <div key={j.id} onClick={()=>{
                                      setCatEdit(p=>({...p,[cfg.key]:{...p[cfg.key], jogador_nome:j.jogador, clube:j.clube||'', justificativa:cfg.template(j)}}))
                                      setCatPickerAberto(null); setCatBusca('')
                                    }}
                                    style={{ padding:'7px 12px', cursor:'pointer', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                                    onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'}
                                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                      <div>
                                        <span style={{ fontSize:12, fontWeight:700, color:'#1a2e1a' }}>{j.jogador}</span>
                                        <span style={{ fontSize:10, color:'#64748b', marginLeft:6 }}>{j.clube}</span>
                                      </div>
                                      <span style={{ fontSize:10, color:cfg.cor, fontWeight:700 }}>
                                        {cfg.score(j).toFixed(1)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* justificativa */}
                            <div style={{ marginBottom:10 }}>
                              <label style={{ fontSize:9, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:4 }}>Justificativa</label>
                              <textarea value={ed.justificativa||''} onChange={e=>setCatEdit(p=>({...p,[cfg.key]:{...p[cfg.key],justificativa:e.target.value}}))}
                                rows={4} placeholder="Justificativa qualitativa..."
                                style={{ width:'100%', border:'1.5px solid #e8f4ec', borderRadius:7, padding:'8px 10px', fontSize:11, color:'#475569', resize:'vertical', outline:'none', lineHeight:1.5, boxSizing:'border-box', fontFamily:'inherit' }} />
                            </div>

                            {/* salvar */}
                            <button onClick={()=>salvarCategoria(cfg.key)} disabled={saving||!ed.jogador_nome}
                              style={{ width:'100%', padding:'8px', background: ed.jogador_nome?cfg.cor:'#e2e8f0', color:'#fff', border:'none', borderRadius:7,
                                cursor: ed.jogador_nome&&!saving?'pointer':'not-allowed', fontSize:12, fontWeight:700, opacity:saving?0.7:1 }}>
                              {saving ? 'Salvando...' : salvo ? '✅ Atualizar' : '💾 Confirmar'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* XI selecionado */}
              {xiSelecionado.length > 0 && (
                <div style={{ padding:'16px 20px', borderTop:'1px solid #e8f4ec', background:'#f0fdf4' }}>
                  <p style={{ fontSize:11, fontWeight:800, color:'#15803d', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    XI da Rodada {rodadaAtiva} ({xiSelecionado.length}/11)
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {jogadores.filter(j=>xiSelecionado.includes(j.id)).map(j=>(
                      <div key={j.id} style={{ background:'#fff', border:`1.5px solid ${BRAND_PRIMARY}`, borderRadius:10, padding:'6px 12px', display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:12, fontWeight:800, color:'#1a2e1a' }}>{j.jogador}</span>
                        <span style={{ fontSize:10, color:'#64748b' }}>{j.clube}</span>
                        <span style={{ background:scoreBg(j.score), color:'#fff', borderRadius:4, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{parseFloat(j.score||0).toFixed(1)}</span>
                        <button onClick={()=>toggleXI(j.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:13, padding:0, lineHeight:1 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════ */
export default function LigaV2Page({ slugOverride = null } = {}) {
  const params  = useParams()
  const slug    = slugOverride || params?.slug
  const { data: session } = useSession()
  const [tab, setTab]               = useState('jogadores')
  const [refreshKey, setRefreshKey] = useState(0)
  const [dataSource, setDataSource] = useState('auto')
  const [logo, setLogo]             = useState(null)
  const fotoRef                     = useRef(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const canEdit = !['diretoria','comissao'].includes(session?.user?.role)
  const liga    = getLeague(slug)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/ligas-v2/logo?slug=${slug}`).then(r=>r.json()).then(d=>{ if(d.logo) setLogo(d.logo) }).catch(()=>{})
  }, [slug])

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]; if(!file) return
    setUploadingLogo(true)
    try {
      const fd = new FormData(); fd.append('file',file)
      const res = await fetch(`/api/ligas-v2/logo?slug=${slug}`,{method:'POST',body:fd})
      const d   = await res.json()
      if(d.ok){ const r=new FileReader(); r.onload=ev=>setLogo(ev.target.result); r.readAsDataURL(file) }
    } catch{}
    setUploadingLogo(false); e.target.value=''
  }

  // Aba de oportunidades de mercado depende da divisão:
  //  · Série C → destaques que ainda não bateram o limite de 13 jogos (regra do vínculo)
  //  · Séries A e B → jogadores encostados, com pouca minutagem, que podemos tentar trazer
  const oportunidadeMode =
    slug === 'brasileirao-serie-c' ? 'elegiveis13'
    : (slug === 'brasileirao-serie-a' || slug === 'brasileirao-serie-b') ? 'encostados'
    : null

  const tabs = [
    { key:'jogadores',      label:'👤 Jogadores'  },
    { key:'times',          label:'🏟️ Times'      },
    { key:'selecao',        label:'⭐ Seleção'     },
    { key:'destaques',       label:'✨ Destaques'   },
    ...(oportunidadeMode === 'elegiveis13' ? [{ key:'oportunidades', label:'🎯 Elegíveis 13J' }] : []),
    ...(oportunidadeMode === 'encostados'  ? [{ key:'oportunidades', label:'🧊 Encostados'    }] : []),
    { key:'shadow',         label:'🕶 Shadow'      },
    { key:'selecao_rodada', label:'📅 Rodada'      },
    { key:'upload',         label:'📥 Upload'      },
  ]

  if (!liga) return (
    <AppShell>
      <div style={{ padding:60, textAlign:'center' }}>
        <p style={{ fontSize:24, marginBottom:8 }}>⚠️</p>
        <p style={{ fontWeight:700, color:'#dc2626' }}>Liga não encontrada</p>
        <Link href="/ligas-v2" style={{ color:BRAND_PRIMARY, fontSize:12, marginTop:12, display:'block' }}>← Voltar</Link>
      </div>
    </AppShell>
  )

  const ligaNome = liga.nome || slug

  return (
    <AppShell>
      <div style={{ padding:'32px 32px 48px', maxWidth:1300 }}>

        <div style={{ marginBottom:28 }}>
          <Link href="/ligas-v2" style={{ fontSize:11, color:'#94a3b8', textDecoration:'none', fontWeight:600 }}>← Ligas</Link>
          <div style={{ display:'flex', alignItems:'flex-start', gap:20, marginTop:12 }}>
            <div onClick={()=>fotoRef.current?.click()} title="Clique para trocar a logo"
              style={{ width:64, height:64, borderRadius:12, background:logo?'transparent':(liga.cor||BRAND_PRIMARY), display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0, overflow:'hidden', cursor:'pointer', border:logo?'none':'2px dashed rgba(255,255,255,0.4)', position:'relative' }}>
              {uploadingLogo?<span style={{ fontSize:20 }}>⏳</span>:logo?<img src={logo} alt={liga.nome} style={{ width:'100%', height:'100%', objectFit:'contain' }} />:liga.bandeira}
              <input ref={fotoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoChange} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <h1 style={{ fontSize:24, fontWeight:900, color:'#1a2e1a' }}>{liga.nome}</h1>
                <span style={{ fontSize:11, background:liga.tipo==='copa'?'#fef3c7':'#f0fdf4', color:liga.tipo==='copa'?'#92400e':BRAND_PRIMARY, fontWeight:700, padding:'3px 10px', borderRadius:20, border:`1px solid ${liga.tipo==='copa'?'#fef3c7':BRAND_PRIMARY}` }}>
                  {liga.tipo==='copa'?'🏆 Copa':'🏅 Liga'}
                </span>
              </div>
              <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{liga.bandeira} {liga.pais} · {liga.continente}</p>
              {liga.descricao && <p style={{ fontSize:11, color:'#64748b', marginTop:6, lineHeight:1.5, maxWidth:760 }}>{liga.descricao}</p>}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:4, marginBottom:24, background:'#f8fdf9', padding:4, borderRadius:10, width:'fit-content', flexWrap:'wrap' }}>
          {tabs.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              padding:'8px 20px', border:'none', borderRadius:8, cursor:'pointer',
              fontWeight:700, fontSize:12, background:tab===t.key?BRAND_PRIMARY:'transparent', color:tab===t.key?'#fff':'#64748b' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab==='jogadores' && <div>
          <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:9, fontWeight:900, color:'#64748b' }}>FONTE EXIBIDA</span>
            {[
              ['auto','Automático'],['sportsbase','Sportsbase'],['wyscout','Wyscout'],
            ].map(([value,label])=><button key={value} onClick={()=>setDataSource(value)} style={{ border:`1px solid ${dataSource===value?BRAND_PRIMARY:'#dbe7f2'}`, borderRadius:8, padding:'6px 9px', background:dataSource===value?'#eaf4fd':'#fff', color:dataSource===value?BRAND_PRIMARY:'#64748b', fontSize:9.5, fontWeight:800, cursor:'pointer' }}>{label}</button>)}
          </div>
          <TabelaJogadores key={`${refreshKey}-${dataSource}`} slug={slug} ligaNome={ligaNome} source={dataSource} />
        </div>}
        {tab==='times'          && <TimesComStats       key={`${refreshKey}-${dataSource}`} slug={slug} source={dataSource} onSourceChange={setDataSource} />}
        {tab==='selecao'        && <SelecaoCampeonato   slug={slug} ligaNome={ligaNome} sourcePreference={dataSource} onSourceChange={setDataSource} />}
        {tab==='destaques'       && <CompetitionHighlights slug={slug} leagueName={ligaNome} logo={logo} sourcePreference={dataSource} onSourceChange={setDataSource} canEdit={canEdit} />}
        {tab==='oportunidades'  && oportunidadeMode && <OportunidadesMercado slug={slug} ligaNome={ligaNome} mode={oportunidadeMode} sourcePreference={dataSource} />}
        {tab==='shadow'         && <ShadowTeams         slug={slug} ligaNome={ligaNome} />}
        {tab==='selecao_rodada' && <SelecaoRodada        slug={slug} />}

        {tab==='upload' && (
          <div>
            <div style={{ background:'linear-gradient(135deg,#064b82,#0a66b7)', borderRadius:14, padding:'20px 24px', marginBottom:24 }}>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.65)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>Central de Upload</p>
              <h2 style={{ fontSize:18, fontWeight:900, color:'#fff', marginBottom:4 }}>Importar Dados — {liga.nome}</h2>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.75)' }}>Importe Sportsbase, Wyscout ou as duas. Cada fonte mantém seu próprio catálogo de métricas; quando ambas estão disponíveis, o modo Automático integra os rankings por função.</p>
              {liga.orientacaoUpload && <p style={{ fontSize:10.5, color:'#d1fae5', marginTop:8, lineHeight:1.5, fontWeight:700 }}>ℹ {liga.orientacaoUpload}</p>}
            </div>
            {canEdit
              ? <div style={{ maxWidth:760 }}>
                  <UploadBox slug={slug} onSuccess={()=>{ setDataSource('auto'); setRefreshKey(k=>k+1) }} />
                  <div style={{marginTop:12,padding:'10px 13px',background:'#effaf3',border:'1px solid #bbf7d0',borderRadius:10,fontSize:10,color:'#166534',lineHeight:1.5}}><b>Integração por liga:</b> Sportsbase e Wyscout podem ser usados sozinhos. Com as duas fontes, o Automático cruza o mesmo atleta e combina os scores funcionais ponderando robustez e cobertura, sem penalizar quem aparece apenas em uma planilha.</div>
                </div>
              : <div style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:13 }}>🔒 Upload restrito ao administrador</div>
            }
          </div>
        )}

      </div>
    </AppShell>
  )
}
