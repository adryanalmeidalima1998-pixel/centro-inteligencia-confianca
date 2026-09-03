'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import WyscoutUploader from './WyscoutUploader'
import XmlAnalyzer from './XmlAnalyzer'

const BRAND_PRIMARY  = '#0a66b7'
const RED  = '#c62828'
const BLUE = '#1565c0'
const PURP = '#6a1b9a'

const FORMACOES = ['4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2','4-1-4-1','4-3-2-1']

const CATS_OFF_AGRUP = [
  { key:'finalizacoes_of', label:'Finalizações ofensivas', icon:'🎯' },
  { key:'cruzamentos',     label:'Cruzamentos ofensivos',  icon:'📐' },
  { key:'passes_prof',     label:'Passe para profundidade',icon:'📏' },
  { key:'perdas_posse',    label:'Perdas da posse',         icon:'🔄' },
]
const CATS_DEF_AGRUP = [
  { key:'finalizacoes_def', label:'Finalizações sofridas',  icon:'🧤' },
  { key:'recuperacoes',     label:'Recuperações da posse',  icon:'🔃' },
]
const CATS_JOGO = [
  { key:'ataques',          label:'Ataques',                secao:'of' },
  { key:'ataques_sofridos', label:'Ataques sofridos',       secao:'def' },
  { key:'intensidade',      label:'Intensidade de pressão',secao:'def' },
]

const METRICAS_IND = [
  { key:'Gols',                          label:'Gols' },
  { key:'Xg',                             label:'xG' },
  { key:'Chutes',                        label:'Finalizações' },
  { key:'Assistências',                  label:'Assistências' },
  { key:'Cruzamentos',                   label:'Cruzamentos' },
  { key:'Disputas ofensivas ganhas, %',  label:'Duelos ofens. %' },
  { key:'Passes progressivos',           label:'Passes progressivos' },
  { key:'Disputas',                      label:'Duelos totais' },
  { key:'Disputas aéreas',               label:'Duelos aéreos' },
  { key:'Faltas',                        label:'Faltas' },
  { key:'Ações defensivas com êxito',    label:'Ações def. êxito' },
  { key:'Disputas defensivas ganhas, %', label:'Duelos def. %' },
]

const POSICOES_FORMACAO = {
  '4-3-3':  [['GK'],['RB','CB','CB','LB'],['CM','CM','CM'],['RW','ST','LW']],
  '4-4-2':  [['GK'],['RB','CB','CB','LB'],['RM','CM','CM','LM'],['ST','ST']],
  '4-2-3-1':[['GK'],['RB','CB','CB','LB'],['CDM','CDM'],['RAM','CAM','LAM'],['ST']],
  '3-5-2':  [['GK'],['CB','CB','CB'],['RM','CM','CM','CM','LM'],['ST','ST']],
  '3-4-3':  [['GK'],['CB','CB','CB'],['RM','CM','CM','LM'],['RW','ST','LW']],
  '5-3-2':  [['GK'],['RWB','CB','CB','CB','LWB'],['CM','CM','CM'],['ST','ST']],
  '4-1-4-1':[['GK'],['RB','CB','CB','LB'],['CDM'],['RM','CM','CM','LM'],['ST']],
  '4-3-2-1':[['GK'],['RB','CB','CB','LB'],['CM','CM','CM'],['SS','SS'],['ST']],
}

const ESTUDO_BLANK = {
  gols_marcados:0,gols_sofridos:0,xg:0,xga:0,
  origem_jogo_aberto:0,origem_bola_parada:0,origem_contra_ataque:0,origem_outros:0,
  gols_sofridos_jogo_aberto:0,gols_sofridos_bola_parada:0,
  min_1_15:0,min_16_30:0,min_31_45:0,min_46_60:0,min_61_75:0,min_76_90:0,
  min_1_15_s:0,min_16_30_s:0,min_31_45_s:0,min_46_60_s:0,min_61_75_s:0,min_76_90_s:0,
}
const JOGO_BLANK = {
  rodada:'',adversario:'',local:'Casa',resultado:'',
  gols_pro:0,gols_contra:0,xg:0,xga:0,
  finalizacoes:0,finalizacoes_no_alvo:0,finalizacoes_sofridas:0,
  passes:0,precisao_passes:0,passes_progressivos:0,passes_profundidade:0,
  toques_area:0,duelos_ofensivos:0,duelos_ofensivos_pct:0,
  duelos_defensivos:0,duelos_defensivos_pct:0,
  recuperacoes_posse:0,ppda_proprio:0,ppda_adversario:0,
  toques_area_defensiva:0,duelos_total:0,duelos_total_pct:0,posse:0,
}

function avg(arr, k) {
  const v = arr.map(j=>parseFloat(j[k])||0)
  return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0
}
function n(v,d=1){ const f=parseFloat(v)||0; return Number.isInteger(f)?f:f.toFixed(d) }

/* ─── Shared style tokens ──────────────────────────────────────────── */
const S = {
  card: { background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:16, boxShadow:'0 4px 12px rgba(10,102,183,0.03)' },
  head: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  input: { background:'#f9fbf9', border:'1.5px solid #e5edf5', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', transition:'border 0.2s', color:'#10233b' },
  select: { background:'#f9fbf9', border:'1.5px solid #e5edf5', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', cursor:'pointer', color:'#10233b' },
  btnGreen: { background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'transform 0.1s active' },
  btnGhost: { background:'#f4f8fc', color:BRAND_PRIMARY, border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8 },
}

/* ─── Components ───────────────────────────────────────────────────── */
function Card({ title, sub, children, action }) {
  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <h3 style={{ fontSize:13, fontWeight:900, color:'#10233b', textTransform:'uppercase', letterSpacing:0.5 }}>{title}</h3>
          {sub && <p style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function SectionDiv({ label, badge, color, bg }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'28px 0 16px' }}>
      <span style={{ fontSize:10, fontWeight:900, background:bg, color, padding:'4px 10px', borderRadius:6, letterSpacing:1 }}>{badge}</span>
      <p style={{ fontSize:14, fontWeight:700, color:'#2d4a35' }}>{label}</p>
      <div style={{ flex:1, height:1, background:'#e5edf5' }}/>
    </div>
  )
}

/* ─── Mini bar ─────────────────────────────────────────────────────── */
function MBar({ label, value, max, color=BRAND_PRIMARY, unit='' }) {
  const pct = max>0 ? Math.min(100,(value/max)*100) : 0
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:10, color:'#64748b' }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:700, color:'#10233b' }}>{n(value)}{unit}</span>
      </div>
      <div style={{ height:5, background:'#e8f4ec', borderRadius:99, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99 }}/>
      </div>
    </div>
  )
}

/* ─── Chart helpers ────────────────────────────────────────────────── */
function DualBar({ data, keys, colors, height=160 }) {
  if (!data?.length) return <div style={{ height:60, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#c0d8c4' }}>Sem dados</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{top:4,right:4,bottom:0,left:-20}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f8fc"/>
        <XAxis dataKey="label" tick={{fontSize:9,fill:'#94a3b8'}}/>
        <YAxis tick={{fontSize:9,fill:'#94a3b8'}}/>
        <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e5edf5'}}/>
        {keys.map((k,i)=><Bar key={k.key} dataKey={k.key} name={k.name} fill={colors[i]||BRAND_PRIMARY} radius={[3,3,0,0]} maxBarSize={28}/>)}
      </BarChart>
    </ResponsiveContainer>
  )
}
function DualLine({ data, keys, colors, height=160 }) {
  if (!data?.length) return <div style={{ height:60, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#c0d8c4' }}>Sem dados</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{top:4,right:4,bottom:0,left:-20}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f8fc"/>
        <XAxis dataKey="label" tick={{fontSize:9,fill:'#94a3b8'}}/>
        <YAxis tick={{fontSize:9,fill:'#94a3b8'}}/>
        <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e5edf5'}}/>
        {keys.map((k,i)=><Line key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={colors[i]||BRAND_PRIMARY} strokeWidth={2} dot={{r:3}}/>)}
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ─── Campograma ───────────────────────────────────────────────────── */
function Campograma({ formacao, escalacao, onChange, editable=false }) {
  const rows = POSICOES_FORMACAO[formacao] || POSICOES_FORMACAO['4-3-3']
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState('')
  const get = (r,c) => escalacao?.[`${r}_${c}`] || null
  const set = (r,c,v) => onChange?.({...escalacao,[`${r}_${c}`]:v})
  return (
    <div style={{ background:'#1a6b2e', borderRadius:10, padding:'12px 10px' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {[...rows].reverse().map((linha,ri) => {
          const rowIdx = rows.length-1-ri
          return (
            <div key={rowIdx} style={{ display:'flex', justifyContent:'space-around', alignItems:'center' }}>
              {linha.map((posSlot,ci) => {
                const player = get(rowIdx,ci)
                const isEditing = editIdx?.row===rowIdx && editIdx?.col===ci
                return (
                  <div key={ci} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    {isEditing && editable ? (
                      <input autoFocus value={editVal}
                        onChange={e=>setEditVal(e.target.value)}
                        onBlur={()=>{set(rowIdx,ci,editVal);setEditIdx(null)}}
                        onKeyDown={e=>{if(e.key==='Enter'){set(rowIdx,ci,editVal);setEditIdx(null)}}}
                        style={{ width:60, textAlign:'center', fontSize:9, borderRadius:6, padding:'3px 4px', background:'#fff', color:'#0a66b7', border:'1px solid #0a66b7', outline:'none' }}/>
                    ) : (
                      <div onClick={()=>{if(editable){setEditIdx({row:rowIdx,col:ci});setEditVal(player||'')}}}
                        style={{
                          width:36, height:36, borderRadius:'50%',
                          background: player ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.18)',
                          color: player ? BRAND_PRIMARY : 'rgba(255,255,255,0.6)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:8, fontWeight:700, cursor: editable ? 'pointer' : 'default',
                          transition:'transform 0.15s',
                        }}>
                        {player ? player.slice(0,7) : posSlot}
                      </div>
                    )}
                    <span style={{ fontSize:7, color:'rgba(255,255,255,0.45)' }}>{posSlot}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {editable && <p style={{ textAlign:'center', fontSize:8, color:'rgba(255,255,255,0.35)', marginTop:8 }}>Clique no círculo para editar</p>}
    </div>
  )
}

/* ─── Image Slot ───────────────────────────────────────────────────── */
function ImageSlot({ label, imagem, onUpload, onRemove }) {
  const ref = useRef()
  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onUpload(ev.target.result, file.name)
    reader.readAsDataURL(file)
  }
  return (
    <div>
      {label && <p style={{ fontSize:10, color:'#64748b', fontWeight:600, marginBottom:5 }}>{label}</p>}
      {imagem ? (
        <div style={{ position:'relative', borderRadius:8, overflow:'hidden', border:'1px solid #e5edf5', aspectRatio:'4/3' }}>
          <img src={imagem} alt={label} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
          <button onClick={onRemove}
            style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'#ef5350', color:'#fff', border:'none', cursor:'pointer', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>
        </div>
      ) : (
        <div onClick={()=>ref.current?.click()}
          style={{ borderRadius:8, border:'1.5px dashed #bfd8ea', background:'#f7fcf9', aspectRatio:'4/3', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', transition:'background 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='#eef8f1'}
          onMouseLeave={e=>e.currentTarget.style.background='#f7fcf9'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#a0bfaa" strokeWidth={1.5} style={{ width:22, height:22 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          <span style={{ fontSize:9, color:'#a0bfaa', textAlign:'center' }}>Adicionar print</span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile}/>
    </div>
  )
}

/* ─── Estudo de Gols ───────────────────────────────────────────────── */
function EstudoGols({ estudo, onChange, onSave, saving }) {
  const f = (k,v) => onChange({...estudo,[k]:parseFloat(v)||0})
  const minData = [
    {label:'1-15',  marc:estudo.min_1_15,  sofr:estudo.min_1_15_s},
    {label:'16-30', marc:estudo.min_16_30, sofr:estudo.min_16_30_s},
    {label:'31-45', marc:estudo.min_31_45, sofr:estudo.min_31_45_s},
    {label:'46-60', marc:estudo.min_46_60, sofr:estudo.min_46_60_s},
    {label:'61-75', marc:estudo.min_61_75, sofr:estudo.min_61_75_s},
    {label:'76-90', marc:estudo.min_76_90, sofr:estudo.min_76_90_s},
  ]
  const totalMarcados = estudo.origem_jogo_aberto + estudo.origem_bola_parada + estudo.origem_contra_ataque + estudo.origem_outros
  const totalSofridos = estudo.gols_sofridos_jogo_aberto + estudo.gols_sofridos_bola_parada

  const kpiStyle = (color) => ({ background: color==='#0a66b7'?'#f0fdf4':'#fef2f2', borderRadius:10, padding:'10px 8px', textAlign:'center' })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {[{l:'Gols marc.',k:'gols_marcados',c:BRAND_PRIMARY},{l:'Gols sofr.',k:'gols_sofridos',c:RED},{l:'xG',k:'xg',c:BRAND_PRIMARY},{l:'xGA',k:'xga',c:RED}].map(({l,k,c})=>(
          <div key={k} style={kpiStyle(c)}>
            <input type="number" min="0" step="0.1" value={estudo[k]} onChange={e=>f(k,e.target.value)}
              style={{ width:'100%', textAlign:'center', fontSize:20, fontWeight:900, background:'transparent', border:'none', outline:'none', color:c, fontFamily:'Barlow Condensed, sans-serif' }}/>
            <p style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>{l}</p>
          </div>
        ))}
      </div>

      {/* Origens marcados */}
      <div>
        <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>Origem — gols marcados</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
          {[{l:'Jogo aberto',k:'origem_jogo_aberto'},{l:'Bola parada',k:'origem_bola_parada'},{l:'Contra-ataque',k:'origem_contra_ataque'},{l:'Outros',k:'origem_outros'}].map(({l,k})=>(
            <div key={k} style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 10px' }}>
              <input type="number" min="0" value={estudo[k]} onChange={e=>f(k,e.target.value)}
                style={{ width:'100%', textAlign:'center', fontSize:16, fontWeight:900, color:BRAND_PRIMARY, background:'transparent', border:'none', outline:'none', fontFamily:'Barlow Condensed, sans-serif' }}/>
              <p style={{ fontSize:9, color:'#94a3b8', textAlign:'center', marginTop:2 }}>{l}</p>
            </div>
          ))}
        </div>
        {totalMarcados>0 && [
          {l:`Jogo aberto (${Math.round(estudo.origem_jogo_aberto/totalMarcados*100)}%)`,v:estudo.origem_jogo_aberto},
          {l:`Bola parada (${Math.round(estudo.origem_bola_parada/totalMarcados*100)}%)`,v:estudo.origem_bola_parada},
          {l:`Contra-ataque (${Math.round(estudo.origem_contra_ataque/totalMarcados*100)}%)`,v:estudo.origem_contra_ataque},
        ].map(({l,v})=><MBar key={l} label={l} value={v} max={totalMarcados} color={BRAND_PRIMARY}/>)}
      </div>

      {/* Origens sofridos */}
      <div>
        <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>Origem — gols sofridos</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
          {[{l:'Jogo aberto',k:'gols_sofridos_jogo_aberto'},{l:'Bola parada',k:'gols_sofridos_bola_parada'}].map(({l,k})=>(
            <div key={k} style={{ background:'#fef2f2', borderRadius:8, padding:'8px 10px' }}>
              <input type="number" min="0" value={estudo[k]} onChange={e=>f(k,e.target.value)}
                style={{ width:'100%', textAlign:'center', fontSize:16, fontWeight:900, color:RED, background:'transparent', border:'none', outline:'none', fontFamily:'Barlow Condensed, sans-serif' }}/>
              <p style={{ fontSize:9, color:'#94a3b8', textAlign:'center', marginTop:2 }}>{l}</p>
            </div>
          ))}
        </div>
        {totalSofridos>0 && [
          {l:`Jogo aberto (${Math.round(estudo.gols_sofridos_jogo_aberto/totalSofridos*100)}%)`,v:estudo.gols_sofridos_jogo_aberto},
          {l:`Bola parada (${Math.round(estudo.gols_sofridos_bola_parada/totalSofridos*100)}%)`,v:estudo.gols_sofridos_bola_parada},
        ].map(({l,v})=><MBar key={l} label={l} value={v} max={totalSofridos} color={RED}/>)}
      </div>

      <button onClick={onSave} disabled={saving} style={{ ...S.btnGreen, width:'100%', justifyContent:'center', marginTop:4 }}>
        {saving?'Salvando...':'Salvar estudo dos gols'}
      </button>
    </div>
  )
}

/* ─── Gerenciador de Rodadas ───────────────────────────────────────── */
function GerenciadorRodadas({ rodadas, onChange, onSave, saving }) {
  const [nova, setNova] = useState('')
  const add = () => { if(nova.trim()){ onChange([...rodadas, nova.trim()]); setNova('') } }
  const rem = (idx) => onChange(rodadas.filter((_,i)=>i!==idx))
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
        {rodadas.map((r,i)=>(
          <span key={i} style={{ background:'#f4f8fc', color:BRAND_PRIMARY, padding:'5px 12px', borderRadius:8, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
            {r} <span onClick={()=>rem(i)} style={{ cursor:'pointer', color:'#94a3b8' }}>✕</span>
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input value={nova} onChange={e=>setNova(e.target.value)} placeholder="Ex: Rodada 5" style={{ ...S.input, flex:1, padding:'6px 12px' }}/>
        <button onClick={add} style={{ ...S.btnGhost, padding:'6px 12px' }}>Add</button>
        <button onClick={onSave} disabled={saving} style={{ ...S.btnGreen, padding:'6px 16px', fontSize:11 }}>{saving?'...':'Salvar configuração'}</button>
      </div>
    </div>
  )
}

/* ─── Export PDF ───────────────────────────────────────────────────── */
async function exportPDF({ adversarioAtivo, estudo, rodadas, imagens, jogos, elenco, tab }) {
  const jsPDF = (await import('jspdf')).default
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const W=210, M=14, CW=W-M*2; let y=16
  doc.setFillColor(10,102,183); doc.rect(0,0,W,12,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold')
  doc.text('CIC · CONFIANÇA', M, 8); doc.text('ANÁLISE DE DESEMPENHO · SÉRIE C 2026', W-M, 8,{align:'right'})
  y=20
  if (tab==='adversario' && adversarioAtivo) {
    doc.setTextColor(10,102,183); doc.setFontSize(14); doc.setFont('helvetica','bold')
    doc.text(`Análise Adversário — ${adversarioAtivo.nome}`, M, y); y+=7
    doc.setTextColor(100,116,139); doc.setFontSize(8); doc.setFont('helvetica','normal')
    doc.text(`Formação: ${adversarioAtivo.formacao||'4-3-3'}  |  Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, M, y); y+=8
    doc.setTextColor(0,0,0); doc.setFontSize(10); doc.setFont('helvetica','bold')
    doc.text('Estudo dos Gols', M, y); y+=5
    autoTable(doc,{startY:y,margin:{left:M,right:M},head:[['Métrica','Valor']],body:[['Gols marcados',estudo.gols_marcados],['Gols sofridos',estudo.gols_sofridos],['xG',(estudo.xg||0).toFixed(2)],['xGA',(estudo.xga||0).toFixed(2)],['Origem jogo aberto',estudo.origem_jogo_aberto],['Origem bola parada',estudo.origem_bola_parada]],styles:{fontSize:8,cellPadding:2},headStyles:{fillColor:[10,102,183],textColor:[255,255,255]}})
    y=doc.lastAutoTable.finalY+8
    const cats=[...CATS_JOGO,...CATS_OFF_AGRUP.map(c=>({...c,tipo:'agrupamento'})),...CATS_DEF_AGRUP.map(c=>({...c,tipo:'agrupamento'}))]
    for (const cat of cats) {
      const isJAJ = CATS_JOGO.find(c=>c.key===cat.key)
      const imgs = []
      if (isJAJ) { for (const r of rodadas) { const k=`${cat.key}_${r}`; if(imagens[k]?.base64) imgs.push({label:r,src:imagens[k].base64}) } }
      else { const k=cat.key; if(imagens[k]?.base64) imgs.push({label:'Agrupamento',src:imagens[k].base64}) }
      if (!imgs.length) continue
      if (y>240) { doc.addPage(); y=16 }
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(10,102,183)
      doc.text(cat.label||cat.key, M, y); y+=4
      const imgW=Math.min(60,CW/imgs.length-2); let x=M
      for (const img of imgs) {
        try { doc.addImage(img.src,'JPEG',x,y,imgW,imgW*0.75); doc.setFontSize(7); doc.setTextColor(100,116,139); doc.setFont('helvetica','normal'); doc.text(img.label,x+imgW/2,y+imgW*0.75+3,{align:'center'}) } catch(_) {}
        x+=imgW+2
      }
      y+=imgW*0.75+8
    }
  } else {
    doc.setTextColor(10,102,183); doc.setFontSize(14); doc.setFont('helvetica','bold')
    doc.text('Acompanhamento Estatístico — Confiança', M, y); y+=7
    doc.setTextColor(100,116,139); doc.setFontSize(8); doc.setFont('helvetica','normal')
    doc.text(`${jogos.length} jogos registrados  |  Série C 2026  |  ${new Date().toLocaleDateString('pt-BR')}`, M, y); y+=8
    if (jogos.length>0) {
      autoTable(doc,{startY:y,margin:{left:M,right:M},head:[['Rodada','Adversário','Local','Resultado','xG','xGA','Posse%','PPDA']],body:jogos.map(j=>[j.rodada||'—',j.adversario||'—',j.local||'—',j.resultado||'—',(j.xg||0).toFixed(1),(j.xga||0).toFixed(1),(j.posse||0).toFixed(1),(j.ppda_proprio||0).toFixed(1)]),styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[10,102,183],textColor:[255,255,255]}})
      y=doc.lastAutoTable.finalY+6
    }
    // Obs: Elenco no PDF depende de dados do WyscoutUploader se integrados
  }
  const totalPages=doc.getNumberOfPages()
  for (let i=1;i<=totalPages;i++) { doc.setPage(i); doc.setFillColor(10,102,183); doc.rect(0,285,W,12,'F'); doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.text('CIC · Confiança · Central de Inteligência Esportiva',M,291); doc.text(`Página ${i} / ${totalPages}`,W-M,291,{align:'right'}) }
  doc.save(tab==='adversario'?`CIC_Adversario_${(adversarioAtivo?.nome||'relatorio').replace(/\s+/g,'_')}.pdf`:`CIC_Confianca_Desempenho.pdf`)
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  PÁGINA PRINCIPAL                                                   */
/* ═══════════════════════════════════════════════════════════════════ */
export default function DesempenhoPage() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  const [tab, setTab]                   = useState('proprio')
  const [adversarios, setAdversarios]   = useState([])
  const [adversarioAtivo, setAdv]       = useState(null)
  const [imagens, setImagens]           = useState({})
  const [jogos, setJogos]               = useState([]) // CORREÇÃO: ADICIONADO ESTADO FALTANTE
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [exportando, setExportando]     = useState(false)
  const [novoAdvNome, setNovoAdvNome]   = useState('')
  const [formacaoSel, setFormacaoSel]   = useState('4-3-3')
  const [escalacao, setEscalacao]       = useState({})
  const [editandoAdv, setEditandoAdv]   = useState(false)
  const [rodadas, setRodadas]           = useState(['Rodada 1','Rodada 2','Rodada 3','Rodada 4'])
  const [estudo, setEstudo]             = useState(ESTUDO_BLANK)

  useEffect(()=>{
    fetch('/api/desempenho').then(r=>r.json()).then(d=>{
      setAdversarios(d.adversarios||[])
      setJogos(d.jogos||[]) // CORREÇÃO: CARREGAR JOGOS INICIAIS
      if (d.adversarios?.length) loadAdversario(d.adversarios[0])
      setLoading(false)
    }).catch(()=>setLoading(false))
  },[])

  async function loadAdversario(adv) {
    setAdv(adv); setFormacaoSel(adv.formacao||'4-3-3')
    try { setEscalacao(adv.escalacao_json?JSON.parse(adv.escalacao_json):{}) } catch { setEscalacao({}) }
    try { setEstudo({...ESTUDO_BLANK,...(adv.estudo_gols_json?JSON.parse(adv.estudo_gols_json):{})}) } catch { setEstudo(ESTUDO_BLANK) }
    try { setRodadas(adv.rodadas_json?JSON.parse(adv.rodadas_json):['Rodada 1','Rodada 2','Rodada 3','Rodada 4']) } catch { setRodadas(['Rodada 1','Rodada 2','Rodada 3','Rodada 4']) }
    try { const r=await fetch(`/api/desempenho?section=imagens&adversario_id=${adv.id}`); const d=await r.json(); const map={}; for(const img of(d.imagens||[])){const k=img.rodada?`${img.categoria}_${img.rodada}`:img.categoria;map[k]={base64:img.imagem_base64,id:img.id}}; setImagens(map) } catch { setImagens({}) }
    // CORREÇÃO: CARREGAR JOGOS DO ADVERSÁRIO ATIVO
    try { const r=await fetch(`/api/desempenho?section=jogos&adversario_id=${adv.id}`); const d=await r.json(); setJogos(d.jogos||[]) } catch { setJogos([]) }
  }

  async function salvarAdversario() {
    if (!novoAdvNome.trim()) return; setSaving(true)
    try {
      const r=await fetch('/api/desempenho',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upsert_adversario',nome:novoAdvNome.trim(),formacao:formacaoSel})})
      const d=await r.json()
      const novo={id:d.id,nome:novoAdvNome.trim(),formacao:formacaoSel}
      setAdversarios(prev=>{const i=prev.findIndex(a=>a.nome===novoAdvNome.trim());if(i>=0){const c=[...prev];c[i]={...c[i],formacao:formacaoSel};return c};return[...prev,novo]})
      setAdv({...novo}); setEscalacao({}); setEstudo(ESTUDO_BLANK); setRodadas(['Rodada 1','Rodada 2','Rodada 3','Rodada 4']); setImagens({})
      setNovoAdvNome(''); setEditandoAdv(false)
    } finally { setSaving(false) }
  }

  async function salvarEscalacao() {
    if (!adversarioAtivo) return; setSaving(true)
    try { await fetch('/api/desempenho',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upsert_adversario',nome:adversarioAtivo.nome,formacao:formacaoSel,escalacao_json:JSON.stringify(escalacao)})}) } finally { setSaving(false) }
  }
  async function salvarEstudo() {
    if (!adversarioAtivo) return; setSaving(true)
    try { await fetch('/api/desempenho',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_estudo_gols',adversario_id:adversarioAtivo.id,estudo})}) } finally { setSaving(false) }
  }
  async function salvarRodadas(novasRodadas) {
    if (!adversarioAtivo) return; setSaving(true)
    try { await fetch('/api/desempenho',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_rodadas',adversario_id:adversarioAtivo.id,rodadas:novasRodadas})}) } finally { setSaving(false) }
  }
  async function uploadImagem(categoria,rodada,base64,nome) {
    if (!adversarioAtivo) return; setSaving(true)
    try { await fetch('/api/desempenho',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upload_imagem',adversario_id:adversarioAtivo.id,categoria,rodada:rodada||null,imagem_base64:base64,nome_arquivo:nome})}); const k=rodada?`${categoria}_${rodada}`:categoria; setImagens(p=>({...p,[k]:{base64}})) } finally { setSaving(false) }
  }
  async function removerImagem(categoria,rodada) {
    const k=rodada?`${categoria}_${rodada}`:categoria; const img=imagens[k]
    if (img?.id) await fetch(`/api/desempenho?type=imagem&id=${img.id}`,{method:'DELETE'})
    setImagens(p=>{const c={...p};delete c[k];return c})
  }
  async function salvarJogo(form) {
    setSaving(true)
    try { 
      const action=form.id?'update_jogo':'create_jogo'; 
      const r=await fetch('/api/desempenho',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,jogo:form})}); 
      const d=await r.json(); 
      if(form.id) setJogos(p=>p.map(j=>j.id===form.id?{...form}:j)); 
      else setJogos(p=>[...p,{...form,id:d.id}]); 
    } finally { setSaving(false) }
  }
  async function deletarJogo(id) { 
    if(!confirm('Remover?'))return; 
    await fetch(`/api/desempenho?type=jogo&id=${id}`,{method:'DELETE'}); 
    setJogos(p=>p.filter(j=>j.id!==id)) 
  }

  const gridCols = (n) => n<=2?'repeat(2,1fr)':n<=4?'repeat(4,1fr)':'repeat(4,1fr)'

  return (
    <AppShell>
      <div style={{ padding:'28px 32px', maxWidth:1400, margin:'0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'3px', color:'#94a3b8', marginBottom:6 }}>CIC · Confiança</p>
            <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:36, fontWeight:900, textTransform:'uppercase', color:BRAND_PRIMARY, letterSpacing:1, lineHeight:1 }}>
              Análise de Desempenho
            </h1>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:5 }}>
              Série C 2026 · {jogos.length} jogo{jogos.length!==1?'s':''} registrado{jogos.length!==1?'s':''}
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {saving && <span style={{ fontSize:11, color:'#94a3b8', animation:'pulse 1.5s infinite' }}>Salvando...</span>}
            <button onClick={async()=>{setExportando(true);try{await exportPDF({adversarioAtivo,estudo,rodadas,imagens,jogos,elenco:[],tab})}catch(e){alert('Erro: '+e.message)}finally{setExportando(false)}}}
              disabled={exportando} style={{ ...S.btnGhost, opacity:exportando?0.6:1 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:14, height:14 }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="12" x2="12" y2="18"/><polyline points="9 15 12 18 15 15"/>
              </svg>
              {exportando?'Gerando...':'Exportar PDF'}
            </button>
            {/* Tabs */}
            <div style={{ display:'flex', background:'#f4f8fc', borderRadius:10, padding:4 }}>
                <button onClick={()=>setTab('proprio')} style={{ padding:'8px 20px', fontSize:12, fontWeight:700, borderRadius:8, border:'none', cursor:'pointer', background:tab==='proprio'?BRAND_PRIMARY:'#f4f8fc', color:tab==='proprio'?'#fff':BRAND_PRIMARY }}>Confiança</button>
                <button onClick={()=>setTab('adversario')} style={{ padding:'8px 20px', fontSize:12, fontWeight:700, borderRadius:8, border:'none', cursor:'pointer', background:tab==='adversario'?BRAND_PRIMARY:'#f4f8fc', color:tab==='adversario'?'#fff':BRAND_PRIMARY }}>Adversários</button>
                <button onClick={()=>setTab('xml')} style={{ padding:'8px 20px', fontSize:12, fontWeight:700, borderRadius:8, border:'none', cursor:'pointer', background:tab==='xml'?BRAND_PRIMARY:'#f4f8fc', color:tab==='xml'?'#fff':BRAND_PRIMARY }}>🗂 XML</button>
              </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[...Array(8)].map((_,i)=><div key={i} style={{ height:120, background:'#f4f8fc', borderRadius:14, animation:'pulse 1.5s infinite' }}/>)}
          </div>
        ) : (
          <>
          {tab === 'proprio' ? (
            canEdit ? <WyscoutUploader /> : <div style={{padding:40,textAlign:'center',color:'#94a3b8',fontSize:13}}>🔒 Upload restrito ao administrador</div>
          ) : tab === 'xml' ? (
            canEdit ? <XmlAnalyzer /> : <div style={{padding:40,textAlign:'center',color:'#94a3b8',fontSize:13}}>🔒 Análise XML restrita ao administrador</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:24 }}>
              {/* Sidebar */}
              <div>
                <div style={{ ...S.card, padding:14 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                    <p style={{ fontSize:11, fontWeight:900, color:'#10233b', textTransform:'uppercase' }}>Adversários</p>
                    <button onClick={()=>setEditandoAdv(!editandoAdv)} style={{ border:'none', background:'none', color:BRAND_PRIMARY, fontSize:10, fontWeight:700, cursor:'pointer' }}>{editandoAdv?'Cancelar':'+ Novo'}</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {adversarios.map(a=>(
                      <div key={a.id} onClick={()=>loadAdversario(a)} 
                        style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', background:adversarioAtivo?.id===a.id?'#f0fdf4':'transparent', color:adversarioAtivo?.id===a.id?BRAND_PRIMARY:'#52677e', transition:'all 0.2s' }}>
                        <p style={{ fontSize:13, fontWeight:700 }}>{a.nome}</p>
                        <p style={{ fontSize:10, opacity:0.6 }}>{a.formacao||'4-3-3'}</p>
                      </div>
                    ))}
                  </div>
                  {editandoAdv && (
                    <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #e5edf5', display:'flex', flexDirection:'column', gap:10 }}>
                      <div>
                        <label style={{ fontSize:10, color:'#94a3b8', display:'block', marginBottom:5 }}>Nome</label>
                        <input value={novoAdvNome} onChange={e=>setNovoAdvNome(e.target.value)} placeholder="Ex: Operário FC" style={{ ...S.input, width:'100%' }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:'#94a3b8', display:'block', marginBottom:5 }}>Formação</label>
                        <select value={formacaoSel} onChange={e=>setFormacaoSel(e.target.value)} style={{ ...S.select, width:'100%' }}>
                          {FORMACOES.map(f=><option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <button onClick={salvarAdversario} disabled={saving||!novoAdvNome.trim()} style={{ ...S.btnGreen, width:'100%', justifyContent:'center', opacity:saving||!novoAdvNome.trim()?0.6:1 }}>
                        {saving?'Salvando...':'Salvar'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {adversarioAtivo ? (<>

                {/* Cabeçalho adversário */}
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:BRAND_PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:18 }}>
                    {adversarioAtivo.nome[0]}
                  </div>
                  <div>
                    <p style={{ fontSize:20, fontWeight:900, color:'#10233b', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase', letterSpacing:1 }}>{adversarioAtivo.nome}</p>
                    <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Formação: {adversarioAtivo.formacao||'4-3-3'}</p>
                  </div>
                </div>

                {/* Escalação + Estudo de Gols */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
                  <Card title="Última escalação" sub={`${formacaoSel} · clique para editar`}
                    action={
                      <div style={{ display:'flex', gap:8 }}>
                        <select value={formacaoSel} onChange={e=>setFormacaoSel(e.target.value)} style={{ ...S.select, fontSize:11, padding:'6px 10px' }}>
                          {FORMACOES.map(f=><option key={f}>{f}</option>)}
                        </select>
                        <button onClick={salvarEscalacao} disabled={saving} style={{ ...S.btnGreen, padding:'6px 12px', fontSize:11, opacity:saving?0.6:1 }}>
                          {saving?'...':'Salvar'}
                        </button>
                      </div>
                    }>
                    <Campograma formacao={formacaoSel} escalacao={escalacao} onChange={setEscalacao} editable/>
                  </Card>
                  <Card title="Estudo dos gols" sub="Edite os campos e salve">
                    <EstudoGols estudo={estudo} onChange={setEstudo} onSave={salvarEstudo} saving={saving}/>
                  </Card>
                </div>

                {/* Rodadas observadas */}
                <Card title="Rodadas observadas" sub="Configure as rodadas que serão usadas nos prints por jogo" action={<span style={{ fontSize:10, fontWeight:700, background:'#f4f8fc', color:'#64748b', borderRadius:6, padding:'3px 10px' }}>{rodadas.length} rodadas</span>}>
                  <GerenciadorRodadas rodadas={rodadas} onChange={setRodadas} onSave={()=>salvarRodadas(rodadas)} saving={saving}/>
                </Card>

                {/* ── OFENSIVO ── */}
                <SectionDiv label="Análise Wyscout — Categorias Ofensivas" badge="OFENSIVO" color={BRAND_PRIMARY} bg="#f0fdf4"/>

                <Card title="⚡ Ataques" sub="Prints individuais por jogo (jogo a jogo)"
                  action={<span style={{ fontSize:9, background:'#f4f8fc', color:'#64748b', borderRadius:6, padding:'3px 9px', fontWeight:700 }}>jogo a jogo</span>}>
                  <div style={{ display:'grid', gridTemplateColumns:gridCols(rodadas.length), gap:12 }}>
                    {rodadas.map(rodada=>(
                      <ImageSlot key={rodada} label={rodada} imagem={imagens[`ataques_${rodada}`]?.base64||null}
                        onUpload={(b64,nome)=>uploadImagem('ataques',rodada,b64,nome)}
                        onRemove={()=>removerImagem('ataques',rodada)}/>
                    ))}
                  </div>
                </Card>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14, marginTop:14 }}>
                  {CATS_OFF_AGRUP.map(cat=>(
                    <Card key={cat.key} title={`${cat.icon} ${cat.label}`} sub="Agrupamento 4 últimos jogos"
                      action={<span style={{ fontSize:9, background:'#f4f8fc', color:'#64748b', borderRadius:6, padding:'3px 9px', fontWeight:700 }}>agrupamento</span>}>
                      <ImageSlot imagem={imagens[cat.key]?.base64||null}
                        onUpload={(b64,nome)=>uploadImagem(cat.key,null,b64,nome)}
                        onRemove={()=>removerImagem(cat.key,null)}/>
                    </Card>
                  ))}
                </div>

                {/* ── DEFENSIVO ── */}
                <SectionDiv label="Análise Wyscout — Categorias Defensivas" badge="DEFENSIVO" color={BLUE} bg="#e8f0fe"/>

                <Card title="🛡 Ataques sofridos" sub="Prints individuais por jogo (jogo a jogo)"
                  action={<span style={{ fontSize:9, background:'#f4f8fc', color:'#64748b', borderRadius:6, padding:'3px 9px', fontWeight:700 }}>jogo a jogo</span>}>
                  <div style={{ display:'grid', gridTemplateColumns:gridCols(rodadas.length), gap:12 }}>
                    {rodadas.map(rodada=>(
                      <ImageSlot key={rodada} label={rodada} imagem={imagens[`ataques_sofridos_${rodada}`]?.base64||null}
                        onUpload={(b64,nome)=>uploadImagem('ataques_sofridos',rodada,b64,nome)}
                        onRemove={()=>removerImagem('ataques_sofridos',rodada)}/>
                    ))}
                  </div>
                </Card>

                <div style={{ marginTop:14 }}>
                  <Card title="💪 Intensidade de pressão" sub="Prints individuais por jogo (jogo a jogo)"
                    action={<span style={{ fontSize:9, background:'#f4f8fc', color:'#64748b', borderRadius:6, padding:'3px 9px', fontWeight:700 }}>jogo a jogo</span>}>
                    <div style={{ display:'grid', gridTemplateColumns:gridCols(rodadas.length), gap:12 }}>
                      {rodadas.map(rodada=>(
                        <ImageSlot key={rodada} label={rodada} imagem={imagens[`intensidade_${rodada}`]?.base64||null}
                          onUpload={(b64,nome)=>uploadImagem('intensidade',rodada,b64,nome)}
                          onRemove={()=>removerImagem('intensidade',rodada)}/>
                      ))}
                    </div>
                  </Card>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14, marginTop:14 }}>
                  {CATS_DEF_AGRUP.map(cat=>(
                    <Card key={cat.key} title={`${cat.icon} ${cat.label}`} sub="Agrupamento 4 últimos jogos"
                      action={<span style={{ fontSize:9, background:'#f4f8fc', color:'#64748b', borderRadius:6, padding:'3px 9px', fontWeight:700 }}>agrupamento</span>}>
                      <ImageSlot imagem={imagens[cat.key]?.base64||null}
                        onUpload={(b64,nome)=>uploadImagem(cat.key,null,b64,nome)}
                        onRemove={()=>removerImagem(cat.key,null)}/>
                    </Card>
                  ))}
                </div>

              </>) : (
                <div style={{ ...S.card, padding:60, textAlign:'center' }}>
                  <p style={{ fontSize:32, marginBottom:10 }}>🔍</p>
                  <p style={{ fontSize:14, fontWeight:700, color:'#52677e', marginBottom:6 }}>Nenhum adversário selecionado</p>
                  <p style={{ fontSize:12, color:'#94a3b8' }}>Crie o primeiro adversário para começar a análise</p>
                </div>
              )}
            </div>
          )}
          </>
        )}
      </div>
    </AppShell>
  )
}