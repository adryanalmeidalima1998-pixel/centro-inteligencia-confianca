'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import AppShell from '../components/layout/AppShell'
import { usePlayerPhotos } from '../hooks/usePlayerPhotos'
import { PhotoSelectorModal } from '../components/photos/PhotoSelectorModal'

const STYLE = `
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm-font { font-family: 'DM Sans', sans-serif; }
  .card-hover { transition: all 0.2s ease; }
  .card-hover:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -8px rgba(0,0,0,0.12); }
  .pulse-dot { animation: pulse 2.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
  .input-field {
    width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0;
    border-radius: 10px; font-size: 11px; font-family: 'DM Sans', sans-serif;
    background: #f8fafc; color: #0f172a; outline: none; transition: border-color 0.15s;
  }
  .input-field:focus { border-color: #dc2626; background: white; }
  select.input-field { cursor: pointer; }
  .modal-scroll::-webkit-scrollbar { width: 4px; }
  .modal-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
  .player-search-dropdown {
    position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
    background: white; border: 1px solid #e2e8f0; border-radius: 12px;
    box-shadow: 0 8px 24px -4px rgba(0,0,0,0.15);
    max-height: 220px; overflow-y: auto;
    margin-top: 4px;
  }
  .player-search-dropdown::-webkit-scrollbar { width: 3px; }
  .player-search-dropdown::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
  .player-option { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; transition: background 0.1s; }
  .player-option:hover { background: #fef2f2; }
  .player-option-photo { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; object-position: top; background: #f1f5f9; flex-shrink: 0; }
  .player-option-initials { width: 32px; height: 32px; border-radius: 50%; background: #dc2626; display: flex; align-items: center; justify-content: center; font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 11px; color: white; flex-shrink: 0; }
  .tipo-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 8px; font-size: 9px;
    font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    cursor: pointer; border: 1.5px solid transparent; transition: all 0.15s;
    font-family: 'Barlow Condensed', sans-serif;
  }
  .log-row { transition: background 0.1s; }
  .log-row:hover { background: #fef7f7; }
  @media print {
    body * { visibility: hidden; }
    #relatorio-print, #relatorio-print * { visibility: visible; }
    #relatorio-print { position: absolute; top: 0; left: 0; width: 100%; }
  }
`

const PARTES_CORPO = [
  'Abdômen','Adutor','Antebraço / Punho','Braço / Cotovelo','Cabeça / Face',
  'Canela / Tibial Anterior','Coluna Cervical','Coluna Lombar','Coluna Torácica',
  'Coxa Anterior / Quadríceps','Coxa Posterior / Isquiotibiais',
  'Flexores de quadril','Glúteo','Joelho','Mão / Dedos','Ombro','Panturrilha',
  'Pé','Púbis / Virilha','Quadril','Reto Femoral','Tendão Calcâneo','Tornozelo',
]
const MEMBROS_AFETADOS = ['Bilateral','MID','MID e MIE','MIE','MMSS','MSD','MSD e MSE','MSE']
const TIPOS_TRABALHO = ['Tratamento','Recovery','Manutenção','Preventivo / Ativação','Avaliação']
const PERIODOS = ['Manhã','Tarde','Noite','Integral']
const PRE_POS_OPCOES = ['Pré Treino','Pós Treino']
const CATEGORIAS = ['Profissional','Sub-20','Sub-17']

const TIPOS_LESAO = [
  'Articular','Clínica','Ligamentar','Muscular','Neurológica','Óssea','Overuse','Sobrecarga','Tendínosa','Traumática',
]
const DIAGNOSTICOS = [
  'Cervicalgia',
  'Contusão (Pancada)',
  'Contratura Muscular',
  'COVID / Doença Viral',
  'Distensão Adutor',
  'Distensão Bíceps Femoral',
  'Distensão Quadríceps',
  'Entorse de Joelho',
  'Entorse de Tornozelo',
  'Fadiga Muscular',
  'Fratura por Estresse',
  'Fratura Traumática',
  'Gastroenterite',
  'Gripe',
  'LCA – Ligamento Cruzado Anterior',
  'LCL – Ligamento Colateral Lateral',
  'LCM – Ligamento Colateral Medial',
  'LCP – Ligamento Cruzado Posterior',
  'Lesão Grau 1 – Isquiotibial',
  'Lesão Grau 2 – Isquiotibial',
  'Lesão Grau 3 – Isquiotibial',
  'Lesão Grau 1 – Quadríceps',
  'Lesão Grau 2 – Quadríceps',
  'Lesão Grau 3 – Quadríceps',
  'Lesão Grau 1 – Reto Femoral',
  'Lesão Grau 2 – Reto Femoral',
  'Lesão Grau 1 – Semimembranoso',
  'Lesão Grau 2 – Semimembranoso',
  'Lombalgia',
  'Luxação',
  'Menisco Lateral',
  'Menisco Medial',
  'Pubalgia',
  'Ruptura de Aquiles',
  'Ruptura Muscular',
  'Sobrecarga Muscular',
  'Tendinite Aquileana',
  'Tendinite Patelar',
]
const ESTAGIOS = ['Fase Aguda','Fase Subaguda','Reabilitação','Transição','Retorno Progressivo']
const STATUS_OPTIONS = ['Tratamento','Recovery','Manutenção']
const MEMBROS = ['Bilateral','MID','MID e MIE','MIE','MMSS','MSD','MSD e MSE','MSE']
const PERIODOS_REL = ['Manhã','Tarde','Integral']

const STATUS_CFG = {
  'Tratamento': { bg:'bg-red-50',border:'border-red-200',badge:'bg-red-100 text-red-700',dot:'bg-red-500',header:'from-red-600 to-red-700',kpi:'border-red-200 bg-red-50',icon:'🚨' },
  'Recovery':   { bg:'bg-amber-50',border:'border-amber-200',badge:'bg-amber-100 text-amber-700',dot:'bg-amber-500',header:'from-amber-500 to-amber-600',kpi:'border-amber-200 bg-amber-50',icon:'🔄' },
  'Manutenção': { bg:'bg-blue-50',border:'border-blue-200',badge:'bg-blue-100 text-blue-700',dot:'bg-blue-500',header:'from-blue-600 to-blue-700',kpi:'border-blue-200 bg-blue-50',icon:'🔧' },
}
const DEFAULT_STATUS_CFG = STATUS_CFG['Tratamento']

const TIPO_TRABALHO_CFG = {
  'Tratamento':            { color:'bg-red-100 text-red-700 border-red-200',    icon:'🚨' },
  'Recovery':              { color:'bg-amber-100 text-amber-700 border-amber-200', icon:'🔄' },
  'Manutenção':            { color:'bg-blue-100 text-blue-700 border-blue-200',  icon:'🔧' },
  'Preventivo / Ativação': { color:'bg-sky-100 text-sky-700 border-sky-200',icon:'🟢' },
  'Avaliação':             { color:'bg-purple-100 text-purple-700 border-purple-200',icon:'📋' },
}

const PRE_POS_CFG = {
  'Pré Treino': { color:'bg-sky-100 text-sky-700 border-sky-200',       icon:'⏱️' },
  'Pós Treino': { color:'bg-violet-100 text-violet-700 border-violet-200', icon:'🏁' },
}

// Define o período automaticamente pelo horário atual
function getPeriodoPorHora(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Manhã'
  if (h < 18) return 'Tarde'
  return 'Noite'
}

const ESTAGIO_COLORS = {
  'Fase Aguda':'bg-red-100 text-red-700',
  'Fase Subaguda':'bg-orange-100 text-orange-700',
  'Reabilitação':'bg-yellow-100 text-yellow-700',
  'Transição':'bg-blue-100 text-blue-700',
  'Retorno Progressivo':'bg-sky-100 text-sky-700',
}

const TABS = ['Atletas em Tratamento','Registros DM','Gerar Relatório','Gráficos','Status Recuperação']

// ─── CORES STATUS RECUPERAÇÃO ──────────────────────────────────────────────────
const COR_STATUS = {
  'Verde':    { bg: 'bg-sky-500',  text: 'text-white',    label: '🟢', hex: '#0ea5e9' },
  'Amarelo':  { bg: 'bg-yellow-400', text: 'text-gray-900', label: '🟡', hex: '#facc15' },
  'Vermelho': { bg: 'bg-red-500',    text: 'text-white',    label: '🔴', hex: '#ef4444' },
}
const COR_OPTIONS = ['Verde', 'Amarelo', 'Vermelho']
const TESTES_LABEL = { recuperacao: 'Recuperação', cmj: 'CMJ', pcr: 'PCR', forca: 'Força' }

// helpers de cor
const NOTA_COR = (n) => (n == null) ? null : n >= 7 ? 'Verde' : n >= 5 ? 'Amarelo' : 'Vermelho'
// CMJ: direcional — ES negativo = queda de performance (fadiga); positivo = melhora → sempre Verde
const CMJ_ES_COR  = (es) => (es == null) ? null : es >= -0.2 ? 'Verde' : es >= -0.8 ? 'Amarelo' : 'Vermelho'
const PCR_ES_COR  = (es) => (es == null) ? null : es <= 0.2 ? 'Verde' : es <= 0.8 ? 'Amarelo' : 'Vermelho'
// Força: vermelho se queda > 15% do basal OU assimetria bilateral > 15%
const FORCA_COR   = (quedaPct, assimetria) => {
  if (quedaPct == null && assimetria == null) return null
  const q = quedaPct ?? 0
  const a = assimetria ?? 0
  if (q > 15 || a > 15) return 'Vermelho'
  if (q > 10) return 'Amarelo'
  return 'Verde'
}
const COR_BG  = { Verde: '#0ea5e9', Amarelo: '#facc15', Vermelho: '#ef4444' }
const COR_TXT = { Verde: '#fff',    Amarelo: '#1f2937', Vermelho: '#fff'    }

// ─── PICKER: RECUPERAÇÃO (nota 1-10) ─────────────────────────────────────────
function RecuperacaoPicker({ value, onSave, onClose }) {
  return (
    <div data-picker style={{
      position:'absolute', zIndex:300, top:'110%', left:'50%', transform:'translateX(-50%)',
      background:'white', border:'1px solid #e5e7eb', borderRadius:14,
      boxShadow:'0 8px 32px -4px rgba(0,0,0,0.18)', padding:'12px 14px', minWidth:220,
    }}>
      <p style={{fontSize:9,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.08em',color:'#6b7280',margin:'0 0 10px',textAlign:'center'}}>
        Nota de Recuperação (1–10)
      </p>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'center',marginBottom:8}}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => {
          const cor = NOTA_COR(n)
          const active = value === n
          return (
            <button key={n} onClick={() => onSave(n)} style={{
              width:34,height:34,borderRadius:8,
              border: active ? '2.5px solid #1f2937' : '2px solid transparent',
              background: COR_BG[cor] || '#f3f4f6',
              color: COR_TXT[cor] || '#374151',
              fontSize:13,fontWeight:900,cursor:'pointer',
              transform: active ? 'scale(1.15)' : 'scale(1)',
              boxShadow: active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
            }}>{n}</button>
          )
        })}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'#9ca3af',padding:'0 2px',marginBottom:8}}>
        <span>🔴 Ruim (1–4)</span><span>🟡 Médio (5–6)</span><span>🟢 Bom (7–10)</span>
      </div>
      {value != null && (
        <button onClick={() => onSave(null)} style={{width:'100%',padding:'4px 0',borderRadius:8,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer',marginBottom:4}}>
          Limpar nota
        </button>
      )}
      <button onClick={onClose} style={{width:'100%',padding:'4px 0',borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'}}>
        Fechar
      </button>
    </div>
  )
}

// ─── PICKER: CMJ (valor em cm, ES automático) ─────────────────────────────────
function CMJPicker({ value, basal, dp, onSave, onClose }) {
  const [input, setInput] = useState(value != null ? String(value) : '')
  const valNum = parseFloat(input)
  const previewES = (!isNaN(valNum) && basal != null && dp) ? (valNum - basal) / dp : null
  const previewCor = previewES != null ? CMJ_ES_COR(previewES) : null
  const esLabel = (e) => e == null ? '' : Math.abs(e) <= 0.2 ? 'Trivial' : Math.abs(e) <= 0.5 ? 'Pouca Fadiga' : Math.abs(e) <= 0.8 ? 'Fadiga Moderada' : 'Fadiga Alta'
  const isNewRecord = !isNaN(valNum) && basal != null && valNum > basal

  return (
    <div data-picker style={{position:'absolute',zIndex:300,top:'110%',left:'50%',transform:'translateX(-50%)',background:'white',border:'1px solid #e5e7eb',borderRadius:14,boxShadow:'0 8px 32px -4px rgba(0,0,0,0.18)',padding:'14px 16px',minWidth:230}}>
      <p style={{fontSize:9,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.08em',color:'#6b7280',margin:'0 0 10px',textAlign:'center'}}>CMJ — Salto com Contramovimento</p>
      {basal != null && (
        <div style={{background:'#f8fafc',borderRadius:8,padding:'6px 10px',marginBottom:10,fontSize:9,color:'#475569',display:'flex',justifyContent:'space-between'}}>
          <span>Basal: <strong>{basal} cm</strong></span>
          {dp && <span>DP: <strong>{dp.toFixed(2)}</strong></span>}
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
        <input type="number" step="0.1" min="0" max="100" value={input} onChange={e => setInput(e.target.value)} placeholder="Ex: 47.3" autoFocus
          style={{flex:1,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:16,fontWeight:700,textAlign:'center',fontFamily:'Barlow Condensed, sans-serif',color:'#0f172a',outline:'none'}} />
        <span style={{fontSize:11,color:'#64748b',fontWeight:700}}>cm</span>
      </div>
      {previewES != null && (
        <div style={{background:COR_BG[previewCor]||'#f3f4f6',color:COR_TXT[previewCor]||'#374151',borderRadius:10,padding:'8px 12px',marginBottom:10,textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:900}}>ES: {previewES > 0 ? '+' : ''}{previewES.toFixed(2)}</div>
          <div style={{fontSize:9,opacity:0.85,marginTop:2}}>{esLabel(previewES)}{isNewRecord ? ' — Novo Basal!' : ''}</div>
        </div>
      )}
      <div style={{display:'flex',gap:6}}>
        {value != null && <button onClick={() => onSave(null)} style={{flex:1,padding:'6px 0',borderRadius:8,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'}}>Limpar</button>}
        <button onClick={onClose} style={{flex:1,padding:'6px 0',borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'}}>Cancelar</button>
        <button onClick={() => { if (!isNaN(valNum) && valNum > 0) onSave(valNum) }} disabled={isNaN(valNum)||valNum<=0}
          style={{flex:1,padding:'6px 0',borderRadius:8,border:'none',background:'#1f2937',color:'white',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer',opacity:(isNaN(valNum)||valNum<=0)?0.4:1}}>Salvar</button>
      </div>
    </div>
  )
}

// ─── PICKER: PCR (mg/dL, ES direcional) ───────────────────────────────────────
function PCRPicker({ value, basal, dp, onSave, onClose }) {
  const [input, setInput] = useState(value != null ? String(value) : '')
  const valNum = parseFloat(input)
  const previewES = (!isNaN(valNum) && basal != null && dp) ? (valNum - basal) / dp : null
  const previewCor = previewES != null ? PCR_ES_COR(previewES) : null
  const esLabel = (e) => e == null ? '' : e <= 0 ? 'PCR caiu — boa recuperação' : e <= 0.2 ? 'Trivial' : e <= 0.8 ? 'Inflamação moderada' : 'Inflamação alta'

  return (
    <div data-picker style={{position:'absolute',zIndex:300,top:'110%',left:'50%',transform:'translateX(-50%)',background:'white',border:'1px solid #e5e7eb',borderRadius:14,boxShadow:'0 8px 32px -4px rgba(0,0,0,0.18)',padding:'14px 16px',minWidth:240}}>
      <p style={{fontSize:9,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.08em',color:'#6b7280',margin:'0 0 10px',textAlign:'center'}}>PCR — Proteína C-Reativa</p>
      {basal != null && (
        <div style={{background:'#f8fafc',borderRadius:8,padding:'6px 10px',marginBottom:10,fontSize:9,color:'#475569',display:'flex',justifyContent:'space-between'}}>
          <span>Basal: <strong>{Number(basal).toFixed(2)} mg/dL</strong></span>
          {dp && <span>DP: <strong>{Number(dp).toFixed(4)}</strong></span>}
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
        <input type="number" step="0.01" min="0" max="50" value={input} onChange={e => setInput(e.target.value)} placeholder="Ex: 0.83" autoFocus
          style={{flex:1,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:16,fontWeight:700,textAlign:'center',fontFamily:'Barlow Condensed, sans-serif',color:'#0f172a',outline:'none'}} />
        <span style={{fontSize:10,color:'#64748b',fontWeight:700}}>mg/dL</span>
      </div>
      {previewES != null && (
        <div style={{background:COR_BG[previewCor]||'#f3f4f6',color:COR_TXT[previewCor]||'#374151',borderRadius:10,padding:'8px 12px',marginBottom:10,textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:900}}>ES: {previewES > 0 ? '+' : ''}{previewES.toFixed(2)}</div>
          <div style={{fontSize:9,opacity:0.85,marginTop:2}}>{esLabel(previewES)}</div>
        </div>
      )}
      <div style={{fontSize:8,color:'#94a3b8',textAlign:'center',marginBottom:10}}>ES positivo = mais inflamação (ruim) · ES negativo = boa recuperação</div>
      <div style={{display:'flex',gap:6}}>
        {value != null && <button onClick={() => onSave(null)} style={{flex:1,padding:'6px 0',borderRadius:8,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'}}>Limpar</button>}
        <button onClick={onClose} style={{flex:1,padding:'6px 0',borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'}}>Cancelar</button>
        <button onClick={() => { if (!isNaN(valNum) && valNum >= 0) onSave(valNum) }} disabled={isNaN(valNum)||valNum<0}
          style={{flex:1,padding:'6px 0',borderRadius:8,border:'none',background:'#1f2937',color:'white',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer',opacity:(isNaN(valNum)||valNum<0)?0.4:1}}>Salvar</button>
      </div>
    </div>
  )
}

// ─── PICKER: FORÇA Nordic Hamstring (E+D, % queda) ────────────────────────────
function ForcaPicker({ value_esq, value_dir, basal, absolutaApres, onSave, onClose }) {
  const [esq, setEsq] = useState(value_esq != null ? String(value_esq) : '')
  const [dir, setDir] = useState(value_dir != null ? String(value_dir) : '')
  const eNum = parseFloat(esq), dNum = parseFloat(dir)
  const bothValid = !isNaN(eNum) && !isNaN(dNum) && eNum > 0 && dNum > 0
  const absoluta   = bothValid ? (eNum + dNum) / 2 : null
  const maxVal     = bothValid ? Math.max(eNum, dNum) : null
  const assimetria = bothValid ? (Math.abs(eNum - dNum) / maxVal) * 100 : null

  // Compara vs os dois referenciais, usa o pior
  const quedaVsAbsoluta = (absoluta != null && absolutaApres != null && absolutaApres > 0)
    ? ((absolutaApres - absoluta) / absolutaApres) * 100 : null
  const quedaVsBasal    = (absoluta != null && basal != null && basal > 0)
    ? ((basal - absoluta) / basal) * 100 : null
  const quedaFinal = Math.max(quedaVsAbsoluta ?? -Infinity, quedaVsBasal ?? -Infinity)
  const quedaPct   = quedaFinal === -Infinity ? null : quedaFinal

  const cor = FORCA_COR(quedaPct, assimetria)
  const quedaLabel = (q, a) => {
    if (a != null && a > 15) return `Assimetria bilateral alta (${a.toFixed(1)}%)`
    if (q == null) return ''
    return q <= 0 ? 'Força acima dos dois referenciais' : q <= 10 ? 'Pouca fadiga' : q <= 15 ? 'Fadiga moderada' : 'Fadiga alta'
  }
  const assAlerta = assimetria != null && assimetria > 15

  return (
    <div data-picker style={{position:'absolute',zIndex:300,top:'110%',right:0,background:'white',border:'1px solid #e5e7eb',borderRadius:14,boxShadow:'0 8px 32px -4px rgba(0,0,0,0.18)',padding:'14px 16px',minWidth:280}}>
      <p style={{fontSize:9,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.08em',color:'#6b7280',margin:'0 0 10px',textAlign:'center'}}>Força — Nordic Hamstring (N)</p>
      {/* Dois referenciais */}
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {absolutaApres != null && (
          <div style={{flex:1,background:'#f0fdf4',borderRadius:8,padding:'5px 8px',fontSize:9,color:'#07579e',textAlign:'center',border:'1px solid #bbf7d0'}}>
            <div style={{fontSize:8,opacity:0.8}}>Apresentação (fixo)</div>
            <strong style={{fontSize:11}}>{Number(absolutaApres).toFixed(1)} N</strong>
          </div>
        )}
        {basal != null && (
          <div style={{flex:1,background:'#eff6ff',borderRadius:8,padding:'5px 8px',fontSize:9,color:'#1d4ed8',textAlign:'center',border:'1px solid #bfdbfe'}}>
            <div style={{fontSize:8,opacity:0.8}}>Basal pós-jogo (melhor)</div>
            <strong style={{fontSize:11}}>{Number(basal).toFixed(1)} N</strong>
          </div>
        )}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:10}}>
        <div style={{flex:1}}>
          <p style={{fontSize:8,fontWeight:900,textTransform:'uppercase',color:'#6b7280',margin:'0 0 4px',textAlign:'center'}}>Esquerda (N)</p>
          <input type="number" step="1" min="0" value={esq} onChange={e => setEsq(e.target.value)} placeholder="Ex: 407" autoFocus
            style={{width:'100%',padding:'8px 6px',border:'1.5px solid #bfdbfe',borderRadius:10,fontSize:15,fontWeight:700,textAlign:'center',fontFamily:'Barlow Condensed, sans-serif',color:'#1e40af',outline:'none',boxSizing:'border-box'}} />
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:8,fontWeight:900,textTransform:'uppercase',color:'#6b7280',margin:'0 0 4px',textAlign:'center'}}>Direita (N)</p>
          <input type="number" step="1" min="0" value={dir} onChange={e => setDir(e.target.value)} placeholder="Ex: 378"
            style={{width:'100%',padding:'8px 6px',border:'1.5px solid #fde68a',borderRadius:10,fontSize:15,fontWeight:700,textAlign:'center',fontFamily:'Barlow Condensed, sans-serif',color:'#92400e',outline:'none',boxSizing:'border-box'}} />
        </div>
      </div>
      {bothValid && (
        <>
          <div style={{background:COR_BG[cor]||'#f3f4f6',color:COR_TXT[cor]||'#374151',borderRadius:10,padding:'8px 12px',marginBottom:8,textAlign:'center'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,fontWeight:700}}>
              <span>Absoluta: <strong>{absoluta.toFixed(1)} N</strong></span>
              {quedaPct != null && <span style={{fontSize:14,fontWeight:900}}>{quedaPct > 0 ? '-' : '+'}{Math.abs(quedaPct).toFixed(1)}%</span>}
            </div>
            {quedaPct != null && <div style={{fontSize:9,opacity:0.85,marginTop:3}}>{quedaLabel(quedaPct, assimetria)}</div>}
          </div>
          <div style={{background:assAlerta?'#fee2e2':'#f0fdf4',border:`1px solid ${assAlerta?'#fca5a5':'#bbf7d0'}`,borderRadius:8,padding:'5px 10px',marginBottom:8,fontSize:9,color:assAlerta?'#991b1b':'#166534',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>Assimetria E/D:</span>
            <strong style={{fontSize:11}}>{assAlerta ? '🚨 ' : ''}{assimetria.toFixed(1)}%{assAlerta ? ' — Vermelho!' : ' — OK'}</strong>
          </div>
        </>
      )}
      <div style={{fontSize:8,color:'#94a3b8',textAlign:'center',marginBottom:10}}>Verde ≤10% queda · Amarelo 11-15% · Vermelho &gt;15% queda ou &gt;15% assimetria</div>
      <div style={{display:'flex',gap:6}}>
        {(value_esq != null || value_dir != null) && <button onClick={() => onSave(null, null)} style={{flex:1,padding:'6px 0',borderRadius:8,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'}}>Limpar</button>}
        <button onClick={onClose} style={{flex:1,padding:'6px 0',borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#6b7280',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'}}>Cancelar</button>
        <button onClick={() => { if (bothValid) onSave(eNum, dNum) }} disabled={!bothValid}
          style={{flex:1,padding:'6px 0',borderRadius:8,border:'none',background:'#1f2937',color:'white',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer',opacity:bothValid?1:0.4}}>Salvar</button>
      </div>
    </div>
  )
}

// ─── ABA STATUS RECUPERAÇÃO ────────────────────────────────────────────────────
function TabStatusRecuperacao({ players, getPhotoUrl }) {
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [partidas,     setPartidas]     = useState([])
  const [partidaSel,   setPartidaSel]   = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [novaPartida,  setNovaPartida]  = useState('')
  const [novaData,     setNovaData]     = useState('')
  const [jogadoresSel, setJogadoresSel] = useState([])
  const [saving,       setSaving]       = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(null)
  const [pickerOpen,   setPickerOpen]   = useState(null) // { rowId, col }
  const [cmjBasals,    setCmjBasals]    = useState({})
  const [cmjDP,        setCmjDP]        = useState(5.03)
  const [pcrBasals,    setPcrBasals]    = useState({})
  const [pcrDP,        setPcrDP]        = useState(0.4606)
  const [forcaBasals,  setForcaBasals]  = useState({})

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const [srRes, cmjRes, pcrRes, forcaRes] = await Promise.all([
        fetch('/api/status-recuperacao'),
        fetch('/api/cmj-basal'),
        fetch('/api/pcr-basal'),
        fetch('/api/forca-basal'),
      ])
      const srData    = await srRes.json()
      const cmjData   = await cmjRes.json()
      const pcrData   = await pcrRes.json()
      const forcaData = await forcaRes.json()

      const all = srData.rows || []
      setRows(all)
      const map = {}
      all.forEach(r => { map[r.partida] = r.data_partida })
      const pts = Object.entries(map).map(([p, d]) => ({ partida: p, data: d }))
        .sort((a, b) => new Date(b.data) - new Date(a.data))
      setPartidas(pts)
      if (!partidaSel && pts.length > 0) setPartidaSel(pts[0].partida)

      const cm = {}
      ;(cmjData.basals || []).forEach(b => { cm[b.jogador.toLowerCase().trim()] = parseFloat(b.basal) })
      setCmjBasals(cm)
      if (cmjData.dp) setCmjDP(cmjData.dp)

      const pm = {}
      ;(pcrData.basals || []).forEach(b => { pm[b.jogador.toLowerCase().trim()] = parseFloat(b.basal) })
      setPcrBasals(pm)
      if (pcrData.dp) setPcrDP(pcrData.dp)

      const fm = {}
      ;(forcaData.basals || []).forEach(b => {
        const k = b.jogador.toLowerCase().trim()
        fm[k] = {
          basal:    b.basal                  != null ? parseFloat(b.basal)                  : null,
          absoluta: b.absoluta_apresentacao  != null ? parseFloat(b.absoluta_apresentacao)  : null,
        }
      })
      setForcaBasals(fm)
    } finally { setLoading(false) }
  }, [partidaSel])

  useEffect(() => { fetchRows() }, [])

  // Fecha picker ao clicar fora
  useEffect(() => {
    if (!pickerOpen) return
    function handler(e) { if (!e.target.closest('[data-picker]')) setPickerOpen(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const rowsPartida = rows.filter(r => r.partida === partidaSel)

  async function upsert(row, patch) {
    await fetch('/api/status-recuperacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'upsert',
        partida: row.partida,
        data_partida: row.data_partida,
        jogador: row.jogador,
        recuperacao_nota: row.recuperacao_nota ?? null,
        cmj_valor:        row.cmj_valor ?? null,
        pcr_valor:        row.pcr_valor ?? null,
        forca_esquerda:   row.forca_esquerda ?? null,
        forca_direita:    row.forca_direita ?? null,
        ...patch,
      })
    })
    fetchRows()
  }

  async function handleNovaPartida() {
    if (!novaPartida.trim() || !novaData || jogadoresSel.length === 0) return
    setSaving(true)
    await fetch('/api/status-recuperacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'nova_partida',
        partida: novaPartida.trim(),
        data_partida: novaData,
        jogadores: jogadoresSel,
      })
    })
    setSaving(false)
    setShowForm(false)
    setNovaPartida('')
    setNovaData('')
    setJogadoresSel([])
    await fetchRows()
    setPartidaSel(novaPartida.trim())
  }

  async function handleDeletePartida() {
    await fetch(`/api/status-recuperacao?partida=${encodeURIComponent(confirmDel)}`, { method: 'DELETE' })
    setConfirmDel(null)
    if (partidaSel === confirmDel) setPartidaSel('')
    fetchRows()
  }

  const toggleJogador = (nome) => {
    setJogadoresSel(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome])
  }

  const fmtDataPartida = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Renderiza célula com picker para cada coluna
  function CelulaRecuperacao({ row }) {
    const nota = row.recuperacao_nota != null ? Number(row.recuperacao_nota) : null
    const cor  = NOTA_COR(nota)
    const open = pickerOpen?.rowId === row.id && pickerOpen?.col === 'recuperacao'
    return (
      <td className="px-4 py-2.5 text-center">
        <div data-picker style={{position:'relative',display:'inline-block'}}>
          <button onClick={() => setPickerOpen(open ? null : { rowId: row.id, col: 'recuperacao' })}
            style={{width:52,height:36,borderRadius:10,background:cor?COR_BG[cor]:'#f3f4f6',color:cor?COR_TXT[cor]:'#9ca3af',border:open?'2.5px solid #1f2937':'2px solid transparent',fontSize:nota!=null?16:12,fontWeight:900,cursor:'pointer',boxShadow:cor?'0 1px 4px rgba(0,0,0,0.12)':'none',transition:'all 0.15s',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {nota != null ? nota : '—'}
          </button>
          {open && <RecuperacaoPicker value={nota} onSave={v => { setPickerOpen(null); upsert(row, { recuperacao_nota: v }) }} onClose={() => setPickerOpen(null)} />}
        </div>
      </td>
    )
  }

  function CelulaCMJ({ row }) {
    const bKey = row.jogador.toLowerCase().trim()
    const basal = cmjBasals[bKey] ?? null
    const val  = row.cmj_valor != null ? parseFloat(row.cmj_valor) : null
    const es   = row.cmj_es   != null ? parseFloat(row.cmj_es)   : null
    const cor  = row.cmj || null
    const open = pickerOpen?.rowId === row.id && pickerOpen?.col === 'cmj'
    return (
      <td className="px-4 py-2.5 text-center">
        <div data-picker style={{position:'relative',display:'inline-block'}}>
          <button onClick={() => setPickerOpen(open ? null : { rowId: row.id, col: 'cmj' })}
            style={{minWidth:64,height:36,borderRadius:10,padding:'0 8px',background:cor?COR_BG[cor]:'#f3f4f6',color:cor?COR_TXT[cor]:'#9ca3af',border:open?'2.5px solid #1f2937':'2px solid transparent',fontSize:10,fontWeight:900,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',lineHeight:1.2,boxShadow:cor?'0 1px 4px rgba(0,0,0,0.12)':'none',transition:'all 0.15s'}}>
            {val != null ? (<><span style={{fontSize:11}}>{val.toFixed(1)} cm</span>{es!=null&&<span style={{fontSize:8,opacity:0.85}}>ES {es>0?'+':''}{es.toFixed(2)}</span>}</>) : '—'}
          </button>
          {open && <CMJPicker value={val} basal={basal} dp={cmjDP} onSave={v => { setPickerOpen(null); upsert(row, { cmj_valor: v }) }} onClose={() => setPickerOpen(null)} />}
        </div>
      </td>
    )
  }

  function CelulaPCR({ row }) {
    const bKey = row.jogador.toLowerCase().trim()
    const basal = pcrBasals[bKey] ?? null
    const val  = row.pcr_valor != null ? parseFloat(row.pcr_valor) : null
    const es   = row.pcr_es   != null ? parseFloat(row.pcr_es)   : null
    const cor  = row.pcr || null
    const open = pickerOpen?.rowId === row.id && pickerOpen?.col === 'pcr'
    return (
      <td className="px-4 py-2.5 text-center">
        <div data-picker style={{position:'relative',display:'inline-block'}}>
          <button onClick={() => setPickerOpen(open ? null : { rowId: row.id, col: 'pcr' })}
            style={{minWidth:72,height:36,borderRadius:10,padding:'0 8px',background:cor?COR_BG[cor]:'#f3f4f6',color:cor?COR_TXT[cor]:'#9ca3af',border:open?'2.5px solid #1f2937':'2px solid transparent',fontSize:10,fontWeight:900,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',lineHeight:1.2,boxShadow:cor?'0 1px 4px rgba(0,0,0,0.12)':'none',transition:'all 0.15s'}}>
            {val != null ? (<><span style={{fontSize:11}}>{val.toFixed(2)} mg/dL</span>{es!=null&&<span style={{fontSize:8,opacity:0.85}}>ES {es>0?'+':''}{es.toFixed(2)}</span>}</>) : '—'}
          </button>
          {open && <PCRPicker value={val} basal={basal} dp={pcrDP} onSave={v => { setPickerOpen(null); upsert(row, { pcr_valor: v }) }} onClose={() => setPickerOpen(null)} />}
        </div>
      </td>
    )
  }

  function CelulaForca({ row }) {
    const bKey = row.jogador.toLowerCase().trim()
    const basalObj = forcaBasals[bKey] ?? {}
    const basal        = basalObj.basal    ?? null
    const absolutaApres= basalObj.absoluta ?? null
    const fEsq = row.forca_esquerda != null ? parseFloat(row.forca_esquerda) : null
    const fDir = row.forca_direita  != null ? parseFloat(row.forca_direita)  : null
    const fAbs = row.forca_absoluta != null ? parseFloat(row.forca_absoluta) : null
    const fQue = row.forca_queda_pct != null ? parseFloat(row.forca_queda_pct) : null
    const fAss = row.forca_assimetria != null ? parseFloat(row.forca_assimetria) : null
    const cor  = row.forca || null
    const open = pickerOpen?.rowId === row.id && pickerOpen?.col === 'forca'
    const assAlerta = fAss != null && fAss > 15
    return (
      <td className="px-4 py-2.5 text-center">
        <div data-picker style={{position:'relative',display:'inline-block'}}>
          <button onClick={() => setPickerOpen(open ? null : { rowId: row.id, col: 'forca' })}
            style={{minWidth:72,height:36,borderRadius:10,padding:'0 8px',background:cor?COR_BG[cor]:'#f3f4f6',color:cor?COR_TXT[cor]:'#9ca3af',border:open?'2.5px solid #1f2937':'2px solid transparent',fontSize:10,fontWeight:900,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',lineHeight:1.2,boxShadow:cor?'0 1px 4px rgba(0,0,0,0.12)':'none',transition:'all 0.15s',gap:1}}>
            {fAbs != null ? (<><span style={{fontSize:11}}>{fAbs.toFixed(0)} N</span>{fQue!=null&&<span style={{fontSize:8,opacity:0.85}}>{fQue>0?'-':'+'}{Math.abs(fQue).toFixed(1)}%{assAlerta?' ⚠':''}</span>}</>) : '—'}
          </button>
          {open && <ForcaPicker value_esq={fEsq} value_dir={fDir} basal={basal} absolutaApres={absolutaApres} onSave={(e, d) => { setPickerOpen(null); upsert(row, { forca_esquerda: e, forca_direita: d }) }} onClose={() => setPickerOpen(null)} />}
        </div>
      </td>
    )
  }

  // ─── PDF GERAÇÃO ──────────────────────────────────────────────────────────────
  function gerarPdfRecuperacao() {
    const partida = partidaSel
    const dataPartida = partidas.find(p => p.partida === partida)?.data
    const dataFmt = dataPartida
      ? new Date(dataPartida).toLocaleDateString('pt-BR', { timeZone:'UTC', day:'2-digit', month:'long', year:'numeric' })
      : ''

    const COR_PDF = {
      Verde:    { bg: '#0ea5e9', text: '#fff', label: 'APTO' },
      Amarelo:  { bg: '#facc15', text: '#1f2937', label: 'ATENÇÃO' },
      Vermelho: { bg: '#ef4444', text: '#fff', label: 'ALERTA' },
    }
    const pill = (cor, texto, sub) => {
      const c = COR_PDF[cor] || { bg: '#e5e7eb', text: '#6b7280', label: '—' }
      return `
        <div style="background:${c.bg};color:${c.text};border-radius:10px;padding:6px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:72px;min-height:44px;gap:2px;">
          <span style="font-size:13px;font-weight:900;line-height:1">${texto || '—'}</span>
          ${sub ? `<span style="font-size:9px;opacity:0.85;line-height:1">${sub}</span>` : ''}
        </div>`
    }
    const pillVazio = () => `<div style="min-width:72px;min-height:44px;background:#f3f4f6;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:16px;">—</div>`

    const linhas = rowsPartida.map((row, i) => {
      const photoUrl = getPhotoUrl(row.jogador)
      const initials = (row.jogador||'').split(' ').filter(Boolean).map(n=>n[0]).join('').substring(0,2).toUpperCase()
      const avatarHtml = photoUrl
        ? `<img src="${photoUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #e5e7eb;flex-shrink:0;" crossorigin="anonymous"/>`
        : `<div style="width:40px;height:40px;border-radius:50%;background:#dc2626;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:#fff;font-size:12px;font-weight:900;">${initials}</span></div>`

      // Recuperação
      const nota = row.recuperacao_nota != null ? Number(row.recuperacao_nota) : null
      const recCor = NOTA_COR(nota)
      const recHtml = nota != null ? pill(recCor, `${nota}/10`, recCor === 'Verde' ? 'Ótimo' : recCor === 'Amarelo' ? 'Regular' : 'Ruim') : pillVazio()

      // CMJ
      const cmjVal = row.cmj_valor != null ? parseFloat(row.cmj_valor) : null
      const cmjEs  = row.cmj_es   != null ? parseFloat(row.cmj_es)   : null
      const cmjCor = row.cmj || null
      const cmjHtml = cmjVal != null
        ? pill(cmjCor, `${cmjVal.toFixed(1)} cm`, cmjEs != null ? `ES ${cmjEs>0?'+':''}${cmjEs.toFixed(2)}` : null)
        : pillVazio()

      // PCR
      const pcrVal = row.pcr_valor != null ? parseFloat(row.pcr_valor) : null
      const pcrEs  = row.pcr_es   != null ? parseFloat(row.pcr_es)   : null
      const pcrCor = row.pcr || null
      const pcrHtml = pcrVal != null
        ? pill(pcrCor, `${pcrVal.toFixed(2)}`, pcrEs != null ? `ES ${pcrEs>0?'+':''}${pcrEs.toFixed(2)}` : null)
        : pillVazio()

      // Força
      const fAbs = row.forca_absoluta  != null ? parseFloat(row.forca_absoluta)  : null
      const fQue = row.forca_queda_pct != null ? parseFloat(row.forca_queda_pct) : null
      const fAss = row.forca_assimetria!= null ? parseFloat(row.forca_assimetria): null
      const fCor = row.forca || null
      const fAssAlert = fAss != null && fAss > 15
      const fSub = fQue != null ? `${fQue > 0 ? '-' : '+'}${Math.abs(fQue).toFixed(1)}%${fAssAlert ? ' ⚠' : ''}` : null
      const forcaHtml = fAbs != null ? pill(fCor, `${fAbs.toFixed(0)} N`, fSub) : pillVazio()

      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb'
      return `
        <tr style="background:${bg};">
          <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${avatarHtml}
              <div>
                <div style="font-size:12px;font-weight:900;color:#111827;letter-spacing:0.03em;text-transform:uppercase;">${row.jogador}</div>
              </div>
            </div>
          </td>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f3f4f6;">${recHtml}</td>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f3f4f6;">${cmjHtml}</td>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f3f4f6;">${pcrHtml}</td>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f3f4f6;">${forcaHtml}</td>
        </tr>`
    }).join('')

    // Contagem de status
    const contagem = { Verde: 0, Amarelo: 0, Vermelho: 0 }
    rowsPartida.forEach(row => {
      const cors = [row.recuperacao, row.cmj, row.pcr, row.forca].filter(Boolean)
      if (cors.includes('Vermelho')) contagem.Vermelho++
      else if (cors.includes('Amarelo')) contagem.Amarelo++
      else if (cors.length > 0) contagem.Verde++
    })

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Status Recuperação — ${partida}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#fff; color:#111827; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:A4 landscape; margin:14mm 14mm 12mm 14mm; }
  @media print {
    body { font-size:11px; }
    .no-print { display:none !important; }
  }
  .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:14px; border-bottom:3px solid #dc2626; }
  .logo-area { display:flex; align-items:center; gap:12px; }
  .logo-circle { width:44px; height:44px; background:#07579e; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:900; letter-spacing:-0.03em; flex-shrink:0; }
  .title-block h1 { font-size:20px; font-weight:900; color:#dc2626; letter-spacing:-0.02em; line-height:1; }
  .title-block p { font-size:10px; color:#6b7280; margin-top:3px; font-weight:600; }
  .meta { text-align:right; }
  .meta .partida { font-size:14px; font-weight:900; color:#111827; }
  .meta .data { font-size:10px; color:#6b7280; margin-top:2px; }
  .kpi-bar { display:flex; gap:10px; margin-bottom:18px; }
  .kpi { flex:1; border-radius:12px; padding:10px 14px; display:flex; align-items:center; gap:10px; }
  .kpi-n { font-size:26px; font-weight:900; line-height:1; }
  .kpi-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; opacity:0.8; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  thead th { background:#1f2937; color:#fff; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; padding:10px 14px; text-align:center; }
  thead th:first-child { text-align:left; border-radius:8px 0 0 0; }
  thead th:last-child { border-radius:0 8px 0 0; }
  .legend { display:flex; gap:16px; margin-top:14px; justify-content:flex-end; align-items:center; font-size:9px; color:#6b7280; }
  .legend-dot { width:10px; height:10px; border-radius:3px; display:inline-block; margin-right:4px; }
  .footer { margin-top:16px; font-size:8px; color:#9ca3af; display:flex; justify-content:space-between; }
  .print-btn { position:fixed; top:16px; right:16px; background:#dc2626; color:#fff; border:none; border-radius:10px; padding:10px 20px; font-size:13px; font-weight:900; cursor:pointer; letter-spacing:0.04em; box-shadow:0 4px 12px rgba(220,38,38,0.3); }
  .print-btn:hover { background:#b91c1c; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">⬇ Baixar PDF</button>

<div class="header">
  <div class="logo-area">
    <div class="logo-circle">ADC</div>
    <div class="title-block">
      <h1>STATUS RECUPERAÇÃO</h1>
      <p>Associação Desportiva Confiança · Departamento Médico &amp; Fisiologia</p>
    </div>
  </div>
  <div class="meta">
    <div class="partida">${partida}</div>
    <div class="data">${dataFmt}</div>
  </div>
</div>

<div class="kpi-bar">
  <div class="kpi" style="background:#f0fdf4;border:1.5px solid #bbf7d0;">
    <div class="kpi-n" style="color:#0a66b7;">${contagem.Verde}</div>
    <div><div class="kpi-label" style="color:#07579e;">✓ Aptos</div></div>
  </div>
  <div class="kpi" style="background:#fefce8;border:1.5px solid #fde68a;">
    <div class="kpi-n" style="color:#ca8a04;">${contagem.Amarelo}</div>
    <div><div class="kpi-label" style="color:#92400e;">⚠ Atenção</div></div>
  </div>
  <div class="kpi" style="background:#fef2f2;border:1.5px solid #fecaca;">
    <div class="kpi-n" style="color:#dc2626;">${contagem.Vermelho}</div>
    <div><div class="kpi-label" style="color:#991b1b;">🚨 Alerta</div></div>
  </div>
  <div class="kpi" style="background:#f8fafc;border:1.5px solid #e2e8f0;">
    <div class="kpi-n" style="color:#334155;">${rowsPartida.length}</div>
    <div><div class="kpi-label" style="color:#475569;">Atletas testados</div></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="text-align:left;width:220px;">Atleta</th>
      <th>Recuperação<br/><span style="font-weight:400;opacity:0.7;font-size:7px">Subjetiva (1–10)</span></th>
      <th>CMJ<br/><span style="font-weight:400;opacity:0.7;font-size:7px">Effect Size</span></th>
      <th>PCR<br/><span style="font-weight:400;opacity:0.7;font-size:7px">Effect Size</span></th>
      <th>Força Nordic<br/><span style="font-weight:400;opacity:0.7;font-size:7px">% Queda Basal</span></th>
    </tr>
  </thead>
  <tbody>${linhas}</tbody>
</table>

<div class="legend">
  <span><span class="legend-dot" style="background:#0ea5e9;"></span>Verde = Apto</span>
  <span><span class="legend-dot" style="background:#facc15;"></span>Amarelo = Atenção</span>
  <span><span class="legend-dot" style="background:#ef4444;"></span>Vermelho = Alerta</span>
</div>

<div class="footer">
  <span>Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema CIC / Confiança</span>
  <span>Confidencial — Uso interno</span>
</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=1100,height=750')
    if (!win) { alert('Permita pop-ups para gerar o PDF.'); return }
    win.document.write(html)
    win.document.close()
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[13px] font-black uppercase tracking-widest text-gray-800">Status Recuperação Fisiológica</h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Testes realizados nos atletas após a partida anterior</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={gerarPdfRecuperacao}
            disabled={rowsPartida.length === 0}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            Gerar PDF
          </button>
          <button onClick={async () => {
            if (!confirm('Recalcular cores de todos os registros existentes com a nova lógica?')) return
            const res = await fetch('/api/status-recuperacao', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'recalcular_cores' }),
            })
            const data = await res.json()
            if (data.ok) { alert(`${data.atualizados} registro(s) recalculado(s).`); fetchRows() }
            else alert('Erro: ' + data.error)
          }}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-colors">
            ↻ Recalcular Cores
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors">
            + Nova Partida
          </button>
        </div>
      </div>

      {/* Seletor de Partida */}
      {partidas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {partidas.map(p => (
            <button key={p.partida} onClick={() => setPartidaSel(p.partida)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
                ${partidaSel === p.partida ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}>
              {p.partida}
              <span className="ml-1.5 font-normal opacity-70">{fmtDataPartida(p.data)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-[11px]">Carregando...</div>
      ) : rowsPartida.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-4xl">🏃</span>
          <p className="text-[11px] text-gray-400 font-bold">
            {partidas.length === 0 ? 'Nenhuma partida cadastrada ainda.' : 'Selecione uma partida acima.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Legenda */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Legenda:</span>
            {COR_OPTIONS.map(c => (
              <span key={c} className="flex items-center gap-1.5 text-[9px] text-gray-600 font-bold">
                <span className={`w-3 h-3 rounded-sm ${COR_STATUS[c].bg}`}/>
                {c}
              </span>
            ))}
            <span className="text-[9px] text-gray-400 ml-1">· Clique na célula para registrar o valor</span>
            <div className="ml-auto">
              <button onClick={() => setConfirmDel(partidaSel)}
                className="text-[9px] text-red-400 hover:text-red-600 font-bold transition-colors">
                🗑 Excluir partida
              </button>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest w-48">Atleta</th>
                <th className="text-center px-4 py-3 text-[9px] font-black uppercase tracking-widest">
                  Recuperação<span className="block text-[7px] font-normal opacity-60 mt-0.5">Subjetiva (1–10)</span>
                </th>
                <th className="text-center px-4 py-3 text-[9px] font-black uppercase tracking-widest">
                  CMJ<span className="block text-[7px] font-normal opacity-60 mt-0.5">Effect Size</span>
                </th>
                <th className="text-center px-4 py-3 text-[9px] font-black uppercase tracking-widest">
                  PCR<span className="block text-[7px] font-normal opacity-60 mt-0.5">Effect Size</span>
                </th>
                <th className="text-center px-4 py-3 text-[9px] font-black uppercase tracking-widest">
                  Força<span className="block text-[7px] font-normal opacity-60 mt-0.5">% Queda Basal</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsPartida.map((row, i) => {
                const photoUrl = getPhotoUrl(row.jogador)
                const initials = (row.jogador || '').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0,2).toUpperCase()
                return (
                  <tr key={row.id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-red-50/30 transition-colors`}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {photoUrl ? (
                          <img src={photoUrl} alt={row.jogador} className="w-7 h-7 rounded-full object-cover object-top border border-gray-100 flex-shrink-0"/>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-black text-white">{initials}</span>
                          </div>
                        )}
                        <span className="text-[11px] font-black text-gray-800 bc uppercase">{row.jogador}</span>
                      </div>
                    </td>
                    <CelulaRecuperacao row={row} />
                    <CelulaCMJ row={row} />
                    <CelulaPCR row={row} />
                    <CelulaForca row={row} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova Partida */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-[13px] font-black uppercase tracking-widest text-gray-800">Nova Partida</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 modal-scroll">
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Partida *</label>
                  <input className="input-field" placeholder="Ex: Confiança x Ferroviária" value={novaPartida} onChange={e => setNovaPartida(e.target.value)}/>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">Data da Partida *</label>
                  <input type="date" className="input-field" value={novaData} onChange={e => setNovaData(e.target.value)}/>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-2">
                    Atletas que atuaram 45+ min * <span className="font-normal text-gray-400">({jogadoresSel.length} selecionados)</span>
                  </label>
                  <div className="border border-gray-200 rounded-xl max-h-56 overflow-y-auto modal-scroll">
                    {players.sort((a,b) => (a.nome||'').localeCompare(b.nome||'')).map(p => (
                      <button key={p.id || p.nome} onClick={() => toggleJogador(p.nome)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors border-b border-gray-50 last:border-0
                          ${jogadoresSel.includes(p.nome) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                          ${jogadoresSel.includes(p.nome) ? 'bg-red-600 border-red-600' : 'border-gray-300'}`}>
                          {jogadoresSel.includes(p.nome) && <span className="text-white text-[8px] font-black">✓</span>}
                        </div>
                        <span className="text-[11px] font-bold text-gray-700 bc uppercase">{p.nome}</span>
                        {p.posicao && <span className="text-[8px] text-gray-400 ml-auto">{p.posicao}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleNovaPartida} disabled={saving || !novaPartida.trim() || !novaData || jogadoresSel.length === 0}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-colors">
                {saving ? 'Salvando...' : 'Criar Partida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="text-[13px] font-black text-gray-800 mb-2">Excluir partida?</p>
            <p className="text-[11px] text-gray-500 mb-5">Todos os dados de <strong>{confirmDel}</strong> serão removidos.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleDeletePartida} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function emptyCase() {
  return {
    jogador:'',parte_corporal:'',tipo_lesao:'',diagnostico:'',hd_texto:'',
    estagio:'',status:'Tratamento',membro:'',sintomatico:true,conduta:'',
    data_entrada:'',data_lesao:'',data_exame:'',data_cirurgia:'',previsao_retorno:'',observacoes:'',
  }
}
function emptyLog() {
  return {
    data:'',jogador:'',posicao:'',pe_dominante:'',categoria:'Profissional',
    periodo:getPeriodoPorHora(),local_queixa:'',membro_afetado:'',hd:'',tipo_trabalho:'',pre_pos:'',observacoes:'',
  }
}

function parseDate(iso) {
  if (!iso) return null
  try {
    // Se já tem hora (ex: "2026-03-30T00:00:00.000Z" ou "2026-03-30T12:00:00"), usa direto
    // Se é só data (ex: "2026-03-30"), adiciona T12:00:00 para evitar problema de fuso
    const s = String(iso).trim()
    const d = s.includes('T') ? new Date(s) : new Date(s + 'T12:00:00')
    return isNaN(d.getTime()) ? null : d
  } catch { return null }
}
function fmtDate(iso) {
  const d = parseDate(iso)
  if (!d) return '—'
  try { return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) } catch { return String(iso) }
}
function fmtDatePtBr(iso) {
  const d = parseDate(iso)
  if (!d) return '—'
  try { return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) } catch { return String(iso) }
}
function fmtDateLong(iso) {
  const d = parseDate(iso)
  if (!d) return ''
  try { return d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) } catch { return String(iso) }
}
function daysUntilReturn(iso) {
  const d = parseDate(iso)
  if (!d) return null
  return Math.round((d - new Date()) / 86400000)
}
function buildHD(c) {
  if (c.hd_texto) return c.hd_texto
  const parts = []
  if (c.diagnostico) parts.push(c.diagnostico)
  if (c.parte_corporal) parts.push(c.parte_corporal)
  return parts.join(' – ') || '—'
}

// ─── PLAYER SEARCH AUTOCOMPLETE ──────────────────────────────────────────────
function PlayerSearchInput({ value, onChange, onSelect, players, getPhotoUrl, placeholder }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const ref = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])

  const filtered = query.length < 1 ? players : players.filter(p =>
    p.nome.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectPlayer(p) {
    setQuery(p.nome)
    onChange(p.nome)
    onSelect(p)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <input
          className="input-field"
          value={query}
          placeholder={placeholder || 'Buscar atleta...'}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        <svg style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#94a3b8' }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </div>
      {open && filtered.length > 0 && (
        <div className="player-search-dropdown">
          {filtered.map(p => {
            const photo = getPhotoUrl(p.nome)
            const initials = p.nome.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()
            return (
              <div key={p.id || p.nome} className="player-option" onMouseDown={() => selectPlayer(p)}>
                {photo
                  ? <img src={photo} alt={p.nome} className="player-option-photo" onError={e => e.target.style.display='none'} />
                  : <div className="player-option-initials">{initials}</div>
                }
                <div>
                  <p style={{ fontSize:11,fontWeight:700,color:'#0f172a',lineHeight:1.2 }}>{p.nome}</p>
                  <p style={{ fontSize:9,color:'#64748b',marginTop:1 }}>
                    {p.posicao} {p.pe_dominante ? `· Pé ${p.pe_dominante}` : ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── CARD DE CASO ─────────────────────────────────────────────────────────────
function CaseCard({ c, getPhotoUrl, onEdit, onDelete, onPhotoClick }) {
  const cfg = STATUS_CFG[c.status] || DEFAULT_STATUS_CFG
  const stageCls = ESTAGIO_COLORS[c.estagio] || 'bg-gray-100 text-gray-600'
  const photoUrl = getPhotoUrl(c.jogador)
  const initials = (c.jogador||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()
  const returnDays = daysUntilReturn(c.previsao_retorno)
  const daysLabel = returnDays===null ? null : returnDays<0 ? `${Math.abs(returnDays)}d atraso` : returnDays===0 ? 'Retorna hoje' : `${returnDays}d p/ retorno`
  const daysColor = returnDays===null ? '' : returnDays<=0 ? 'text-red-600' : returnDays<=7 ? 'text-amber-600' : 'text-sky-600'
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={`card-hover bg-white rounded-2xl border overflow-hidden ${cfg.border}`}>
      <div className={`bg-gradient-to-r ${cfg.header} px-4 pt-4 pb-3 relative overflow-hidden`}>
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 bg-white" />
        <div className="flex items-start gap-3 relative">
          <div className="relative flex-shrink-0 cursor-pointer group" onClick={e => { e.stopPropagation(); onPhotoClick(c.jogador) }}>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/40 shadow-sm">
              {photoUrl
                ? <img src={photoUrl} alt={c.jogador} className="w-full h-full object-cover object-top" onError={e=>{e.target.style.display='none'}} />
                : <span className="bc text-base font-black text-white">{initials}</span>}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
              <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="bc text-lg font-black uppercase text-white leading-tight truncate">{c.jogador}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/20 text-white">{cfg.icon} {c.status}</span>
              {c.membro && <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/20 text-white">{c.membro}</span>}
              <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${c.sintomatico?'bg-red-800/40 text-red-100':'bg-sky-700/40 text-sky-100'}`}>
                {c.sintomatico ? 'Sintomático' : 'Assintomático'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={`px-4 py-3 space-y-2 ${cfg.bg}`}>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">HD</p>
          <p className="text-[11px] font-bold text-gray-800 leading-tight">🩺 {buildHD(c)}</p>
          {(c.parte_corporal||c.tipo_lesao) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {c.parte_corporal && <span className="text-[9px] text-gray-500">📍 {c.parte_corporal}</span>}
              {c.tipo_lesao    && <span className="text-[9px] text-gray-500">🔖 {c.tipo_lesao}</span>}
            </div>
          )}
        </div>
        {c.conduta && (
          <div className="bg-white/60 rounded-lg px-2.5 py-1.5 border border-black/5">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Conduta</p>
            <p className="text-[9px] text-gray-700">{c.conduta}</p>
          </div>
        )}
        {c.estagio && <span className={`inline-block text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${stageCls}`}>{c.estagio}</span>}
        <div className="border-t border-black/5 pt-2 space-y-0.5">
          {c.data_lesao && <p className="text-[8px] text-gray-400">Lesão: <span className="font-semibold text-gray-600">{fmtDate(c.data_lesao)}</span></p>}
          {c.data_cirurgia && <p className="text-[8px] text-gray-400">Cirurgia: <span className="font-semibold text-gray-600">{fmtDate(c.data_cirurgia)}</span></p>}
          {c.previsao_retorno && (
            <p className="text-[8px] text-gray-400">RTT: <span className={`font-bold ${daysColor}`}>{fmtDate(c.previsao_retorno)}</span>
              {daysLabel && <span className={`ml-1 font-black ${daysColor}`}>({daysLabel})</span>}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-1.5 pt-1">
          <button onClick={() => onEdit(c)} className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider bg-white/70 text-gray-600 hover:bg-white transition-colors border border-black/5">Editar</button>
          {confirming ? (
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-gray-500 font-bold">Remover?</span>
              <button onClick={() => { onDelete(c.id); setConfirming(false) }} className="px-2 py-1 rounded-lg text-[8px] font-black bg-red-600 text-white hover:bg-red-700 transition-colors">Sim</button>
              <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-lg text-[8px] font-black bg-white/70 text-gray-600 border border-black/5">Não</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="px-2.5 py-1 rounded-lg text-[8px] font-black bg-white/70 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-black/5">✕</button>
          )}
        </div>
        {c.observacoes && <p className="text-[9px] text-gray-500 italic border-t border-black/5 pt-2">"{c.observacoes}"</p>}
      </div>
    </div>
  )
}

// ─── MODAL FORM ───────────────────────────────────────────────────────────────
function ModalForm({ title, children, onClose, onSave, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="bc text-xl font-black uppercase text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto modal-scroll flex-1">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-sm disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormGrid({ children }) { return <div className="grid grid-cols-2 gap-4">{children}</div> }
function FormField({ label, children, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
function SectionDivider({ label }) {
  return (
    <div className="col-span-2 flex items-center gap-2 mt-2">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{label}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  )
}

// ─── LOG FORM MODAL ───────────────────────────────────────────────────────────
function LogFormModal({ logForm, setLogForm, players, getPhotoUrl, onClose, onSave, saving, isEditing }) {
  const selectedPlayer = players.find(p => p.nome === logForm.jogador)
  const photoUrl = selectedPlayer ? getPhotoUrl(selectedPlayer.nome) : null
  const initials = logForm.jogador ? logForm.jogador.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() : ''

  function handleSelectPlayer(p) {
    setLogForm(f => ({
      ...f,
      jogador: p.nome,
      posicao: p.posicao || '',
      pe_dominante: p.pe_dominante || '',
    }))
  }

  const tipoCfg = TIPO_TRABALHO_CFG[logForm.tipo_trabalho] || null

  return (
    <ModalForm title={isEditing ? 'Editar Registro DM' : 'Novo Registro DM'} onClose={onClose} onSave={onSave} saving={saving}>
      <FormGrid>
        {/* DATA / PERÍODO */}
        <SectionDivider label="Data e Período" />
        <FormField label="Data *">
          <input type="date" value={logForm.data} onChange={e => setLogForm(f => ({ ...f, data: e.target.value }))} className="input-field" />
        </FormField>
        <FormField label="Período">
          <select value={logForm.periodo} onChange={e => setLogForm(f => ({ ...f, periodo: e.target.value }))} className="input-field">
            <option value="">Selecione...</option>
            {PERIODOS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="Categoria">
          <select value={logForm.categoria} onChange={e => setLogForm(f => ({ ...f, categoria: e.target.value }))} className="input-field">
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label="Momento do Treino">
          <select value={logForm.pre_pos} onChange={e => setLogForm(f => ({ ...f, pre_pos: e.target.value }))} className="input-field">
            <option value="">— Não se aplica —</option>
            {PRE_POS_OPCOES.map(p => <option key={p}>{p}</option>)}
          </select>
        </FormField>

        {/* ATLETA */}
        <SectionDivider label="Atleta" />
        <FormField label="Nome do Atleta *" span>
          <PlayerSearchInput
            value={logForm.jogador}
            onChange={name => setLogForm(f => ({ ...f, jogador: name }))}
            onSelect={handleSelectPlayer}
            players={players}
            getPhotoUrl={getPhotoUrl}
            placeholder="Buscar pelo nome..."
          />
        </FormField>

        {/* Preview do atleta */}
        {logForm.jogador && (
          <div className="col-span-2">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
              {photoUrl
                ? <img src={photoUrl} alt={logForm.jogador} className="w-10 h-10 rounded-full object-cover object-top border border-gray-200" onError={e=>e.target.style.display='none'} />
                : <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                    <span className="bc font-black text-white text-sm">{initials}</span>
                  </div>
              }
              <div className="flex-1">
                <p className="bc font-black text-gray-900 text-sm uppercase">{logForm.jogador}</p>
                <div className="flex gap-3 mt-0.5">
                  {logForm.posicao && <span className="text-[9px] text-gray-500">⚽ {logForm.posicao}</span>}
                  {logForm.pe_dominante && <span className="text-[9px] text-gray-500">👟 Pé {logForm.pe_dominante}</span>}
                </div>
              </div>
              {/* Editar posição/pé manualmente se necessário */}
            </div>
          </div>
        )}

        <FormField label="Posição">
          <input value={logForm.posicao} onChange={e => setLogForm(f => ({ ...f, posicao: e.target.value }))} className="input-field" placeholder="Auto-preenchido pelo elenco" />
        </FormField>
        <FormField label="Pé Dominante">
          <select value={logForm.pe_dominante} onChange={e => setLogForm(f => ({ ...f, pe_dominante: e.target.value }))} className="input-field">
            <option value="">Selecione...</option>
            <option>Direito</option>
            <option>Esquerdo</option>
            <option>Ambidestro</option>
          </select>
        </FormField>

        {/* QUEIXA */}
        <SectionDivider label="Queixa / Atendimento" />
        <FormField label="Local da Queixa">
          <select value={logForm.local_queixa} onChange={e => setLogForm(f => ({ ...f, local_queixa: e.target.value }))} className="input-field">
            <option value="">Selecione...</option>
            {PARTES_CORPO.map(p => <option key={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="Membro Afetado">
          <select value={logForm.membro_afetado} onChange={e => setLogForm(f => ({ ...f, membro_afetado: e.target.value }))} className="input-field">
            <option value="">Selecione...</option>
            {MEMBROS_AFETADOS.map(m => <option key={m}>{m}</option>)}
          </select>
        </FormField>
        <FormField label="HD (Hipótese Diagnóstica)" span>
          <input value={logForm.hd} onChange={e => setLogForm(f => ({ ...f, hd: e.target.value }))} className="input-field" placeholder="Ex: Sobrecarga muscular, Lesão grau 2..." />
        </FormField>

        {/* TIPO DE TRABALHO */}
        <SectionDivider label="Tipo de Trabalho Realizado" />
        <div className="col-span-2">
          <div className="flex flex-wrap gap-2">
            {TIPOS_TRABALHO.map(t => {
              const cfg = TIPO_TRABALHO_CFG[t]
              const selected = logForm.tipo_trabalho === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLogForm(f => ({ ...f, tipo_trabalho: selected ? '' : t }))}
                  className={`tipo-badge ${cfg.color} ${selected ? 'ring-2 ring-offset-1 ring-current' : 'opacity-60 hover:opacity-100'}`}
                >
                  <span>{cfg.icon}</span>
                  <span>{t}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        <FormField label="Observações" span>
          <textarea value={logForm.observacoes} onChange={e => setLogForm(f => ({ ...f, observacoes: e.target.value }))}
            className="input-field resize-none" rows={2} placeholder="Observações adicionais..." />
        </FormField>
      </FormGrid>
    </ModalForm>
  )
}

// ─── RELATÓRIO PRINT ─────────────────────────────────────────────────────────
// Fonte: dm_logs do dia + dm_cases ativos (para o resumo individual)
// Modelos de referência: Relatório_DM_-_Manhã.docx e Relatório_DM_-_Contra_turno.docx

const PRINT_STYLE = `
  @media print {
    @page { size: A4 portrait; margin: 1.8cm 1.6cm; }
    body * { visibility: hidden !important; }
    #relatorio-print, #relatorio-print * { visibility: visible !important; }
    #relatorio-print {
      position: absolute !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important;
      font-family: Arial, sans-serif !important;
      color: #1a1a1a !important;
    }
    .rel-no-print { display: none !important; }
    .rel-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 0; }
    .rel-table th { background: #0a66b7 !important; color: white !important; font-size: 8pt; font-weight: 900; padding: 5px 7px; border: 1px solid #aaa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rel-table td { border: 1px solid #ccc; padding: 4px 7px; font-size: 9pt; }
    .rel-section-header { background: #1a1a1a !important; color: white !important; font-weight: 900; font-size: 9pt; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.08em; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rel-row-alt { background: #edf7f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rel-resumo-nome { font-weight: 900; font-size: 10pt; text-decoration: underline; color: #0a66b7; margin: 12pt 0 3pt; }
    .rel-resumo-linha { font-size: 9pt; margin: 2pt 0; }
    .rel-rodape { font-size: 8pt; font-style: italic; color: #555; margin-top: 18pt; text-align: center; }
  }
`

// Mapa: qual seção da tabela cada registro pertence
// Período "Manhã" → PRÉ TREINO + DM; Período "Tarde" ou "Integral" → ATENDIMENTOS
// Quando o relatório é "Manhã", divide em PRÉ TREINO / DM / PÓS TREINO
// Quando é "Tarde" ou "Integral", usa uma seção única ATENDIMENTOS

function RelatorioPrint({ logsDodia, cases, data, periodo, modelo }) {
  const campinas = new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})
  const dataFormatada = data ? fmtDateLong(data) : campinas

  // Cria um mapa jogador→caso para o resumo individual
  const caseMap = {}
  cases.forEach(c => { caseMap[c.jogador?.toLowerCase().trim()] = c })
  function getCasePorNome(nome) {
    return caseMap[nome?.toLowerCase().trim()] || null
  }

  // Mapa jogador→log do dia (para puxar observações do registro diário no resumo)
  const logMap = {}
  logsDodia.forEach(l => { if (l.jogador) logMap[l.jogador.toLowerCase().trim()] = l })
  function getLogPorNome(nome) {
    return logMap[nome?.toLowerCase().trim()] || null
  }

  // Atletas em Tratamento nos casos — base do RESUMO INDIVIDUAL
  // Aparece no resumo TODOS os casos em Tratamento (independente de ter log do dia)
  const casosEmTratamento = cases.filter(c => c.status === 'Tratamento')
  const jogadoresNosLogs = new Set(logsDodia.map(l => l.jogador?.toLowerCase().trim()))
  // Resumo: todos os que estão em Tratamento
  const resumoAtletas = casosEmTratamento

  // Se não há logs do dia, gera linhas a partir dos casos em Tratamento para a tabela
  const tabelaRows = logsDodia.length > 0 ? logsDodia : casosEmTratamento.map(c => ({
    id: c.id,
    jogador: c.jogador,
    local_queixa: c.parte_corporal || '—',
    membro_afetado: c.membro || '—',
    hd: buildHD(c),
    tipo_trabalho: c.status,
  }))
  // modelo "manha": PRÉ TREINO / ATLETAS NO DM / PÓS TREINO
  // modelo "tarde" ou "integral": uma seção ATENDIMENTOS
  let secoes = []

  if (modelo === 'manha') {
    const preTreino = tabelaRows.filter(l => l.pre_pos === 'Pré Treino')
    const posTreino = tabelaRows.filter(l => l.pre_pos === 'Pós Treino')
    const noDM      = tabelaRows.filter(l => l.tipo_trabalho === 'Tratamento')
    if (preTreino.length) secoes.push({ label: 'PRÉ TREINO', rows: preTreino })
    if (posTreino.length) secoes.push({ label: 'PÓS TREINO', rows: posTreino })
    secoes.push({ label: 'ATLETAS NO DEPARTAMENTO MÉDICO', rows: noDM })
  } else {
    secoes.push({ label: 'ATENDIMENTOS', rows: tabelaRows })
  }

  // Atletas em Tratamento nos casos — base do RESUMO INDIVIDUAL
  // Mostra TODOS os casos em Tratamento (independente de ter log no dia)

  const S = { // inline styles
    page:    { fontFamily:'Arial, sans-serif', maxWidth:740, margin:'0 auto', padding:'24px 0', color:'#1a1a1a', fontSize:10 },
    header:  { textAlign:'center', borderBottom:'2.5px solid #0a66b7', paddingBottom:14, marginBottom:20 },
    titulo:  { fontWeight:900, color:'#0a66b7', fontSize:20, margin:0, letterSpacing:'0.01em' },
    subtit:  { fontWeight:700, color:'#444', fontSize:14, margin:'4px 0 0' },
    data:    { fontSize:10, color:'#555', marginTop:8 },
    chamada: { fontWeight:900, textAlign:'center', fontSize:11, letterSpacing:'0.08em', marginBottom:16, marginTop:4 },
    secHdr:  { background:'#1a1a1a', color:'white', fontWeight:900, fontSize:9, padding:'4px 8px', textTransform:'uppercase', letterSpacing:'0.08em' },
    th:      { background:'#0a66b7', color:'white', fontWeight:900, fontSize:9, padding:'5px 7px', border:'1px solid #aaa', textAlign:'left' },
    td:      { border:'1px solid #ccc', padding:'4px 7px', fontSize:9 },
    tdBold:  { border:'1px solid #ccc', padding:'4px 7px', fontSize:9, fontWeight:700 },
    tdAlt:   { border:'1px solid #ccc', padding:'4px 7px', fontSize:9, background:'#edf7f2' },
    tdBoldAlt:{ border:'1px solid #ccc', padding:'4px 7px', fontSize:9, fontWeight:700, background:'#edf7f2' },
    resNome: { fontWeight:900, fontSize:11, textDecoration:'underline', color:'#0a66b7', margin:'14px 0 3px' },
    resLinha:{ fontSize:9, margin:'2px 0' },
    rodape:  { fontSize:8, fontStyle:'italic', color:'#666', marginTop:28, textAlign:'center' },
    resumoTit:{ fontWeight:900, textAlign:'center', fontSize:12, margin:'24px 0 14px', borderTop:'1px solid #ddd', paddingTop:16 },
  }

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div id="relatorio-print" style={S.page}>

        {/* CABEÇALHO */}
        <div style={S.header}>
          <p style={S.titulo}>Associação Desportiva Confiança</p>
          <p style={S.subtit}>Departamento de Fisioterapia</p>
          <p style={S.data}>Aracaju, {dataFormatada}.</p>
        </div>

        {/* CHAMADA */}
        <p style={S.chamada}>
          ATLETAS QUE COMPARECERAM NO PERÍODO {periodo === 'Integral' ? 'INTEGRAL' : `DA ${periodo.toUpperCase()}`}.
        </p>

        {/* TABELA COM SEÇÕES */}
        {tabelaRows.length === 0 ? (
          <p style={{textAlign:'center',color:'#888',fontSize:10,padding:'20px 0'}}>
            Nenhum registro encontrado para esta data e período.
          </p>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',marginBottom:8,fontSize:9}}>
            {secoes.map((sec, si) => {
              let rowIdx = 0
              return (
                <tbody key={sec.label}>
                  {/* Header da seção */}
                  <tr>
                    <td colSpan={6} style={S.secHdr} className="rel-section-header">{sec.label}</td>
                  </tr>
                  {/* Header de colunas */}
                  <tr>
                    {['NOME','LOCAL DA QUEIXA','MEMBRO','HD','TIPO DE TRABALHO','OBSERVAÇÕES'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                  {/* Dados */}
                  {sec.rows.length === 0 ? (
                    <tr><td colSpan={6} style={{...S.td, color:'#888', fontStyle:'italic', textAlign:'center'}}>—</td></tr>
                  ) : sec.rows.map((l, i) => {
                    const alt = i % 2 === 1
                    return (
                      <tr key={l.id} className={alt ? 'rel-row-alt' : ''}>
                        <td style={alt ? S.tdBoldAlt : S.tdBold}>{l.jogador || '—'}</td>
                        <td style={alt ? S.tdAlt : S.td}>{l.local_queixa || '—'}</td>
                        <td style={alt ? S.tdAlt : S.td}>{l.membro_afetado || '—'}</td>
                        <td style={alt ? S.tdAlt : S.td}>{l.hd || '—'}</td>
                        <td style={alt ? S.tdAlt : S.td}>{l.tipo_trabalho || '—'}</td>
                        <td style={{...(alt ? S.tdAlt : S.td), fontStyle:'italic', color:'#555'}}>{l.observacoes || '—'}</td>
                      </tr>
                    )
                  })}
                  {/* Espaço entre seções */}
                  {si < secoes.length - 1 && (
                    <tr><td colSpan={6} style={{padding:'4px',border:'none'}} /></tr>
                  )}
                </tbody>
              )
            })}
          </table>
        )}

        {/* RESUMO DOS ATENDIMENTOS — só para quem está em Tratamento e apareceu no dia */}
        {resumoAtletas.length > 0 && (
          <>
            <p style={S.resumoTit}>RESUMO DOS ATENDIMENTOS:</p>
            {resumoAtletas.map(c => (
              <div key={c.id}>
                <p style={S.resNome} className="rel-resumo-nome">{c.jogador}</p>
                <p style={S.resLinha} className="rel-resumo-linha">
                  <strong>HD:</strong> {buildHD(c)}.
                </p>
                {c.data_lesao && (
                  <p style={S.resLinha} className="rel-resumo-linha">
                    <strong>Data da lesão:</strong> {fmtDatePtBr(c.data_lesao)}.
                  </p>
                )}
                {c.data_exame && (
                  <p style={S.resLinha} className="rel-resumo-linha">
                    <strong>Data do exame:</strong> {fmtDatePtBr(c.data_exame)}.
                  </p>
                )}
                {c.data_cirurgia && (
                  <p style={S.resLinha} className="rel-resumo-linha">
                    <strong>Data da cirurgia:</strong> {fmtDatePtBr(c.data_cirurgia)}.
                  </p>
                )}
                {c.previsao_retorno && (
                  <p style={{...S.resLinha, color:'#c0392b', fontWeight:600}} className="rel-resumo-linha">
                    <strong>Data de RTT:</strong> {fmtDatePtBr(c.previsao_retorno)} (De acordo com a evolução do atleta).
                  </p>
                )}
                <p style={S.resLinha} className="rel-resumo-linha">
                  {c.sintomatico
                    ? `Atleta sintomático.${c.observacoes ? ' ' + c.observacoes : ''}`
                    : `Atleta assintomático.${c.observacoes ? ' ' + c.observacoes : ''}`}
                </p>
                {c.conduta && (
                  <p style={S.resLinha} className="rel-resumo-linha">
                    <strong>Conduta:</strong> {c.conduta}.
                  </p>
                )}
                {(() => { const logDia = getLogPorNome(c.jogador); return logDia?.observacoes ? (
                  <p style={{...S.resLinha, fontStyle:'italic', color:'#444'}} className="rel-resumo-linha">
                    <strong>Obs. do dia:</strong> {logDia.observacoes}.
                  </p>
                ) : null })()}
              </div>
            ))}
          </>
        )}

        <p style={S.rodape} className="rel-rodape">*Demais atletas não procuraram o DM.</p>
      </div>
    </>
  )
}

// ─── LOGS TABLE ───────────────────────────────────────────────────────────────
function LogsTable({ logs, getPhotoUrl, onDelete, onEdit, onNewLog, loading }) {
  const [filterDate, setFilterDate] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterPeriodo, setFilterPeriodo] = useState('')
  const [groupByDate, setGroupByDate] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)

  const filtered = logs.filter(l => {
    if (filterDate && (!l.data || !l.data.startsWith(filterDate))) return false
    if (filterTipo && l.tipo_trabalho !== filterTipo) return false
    if (filterPeriodo && l.periodo !== filterPeriodo) return false
    return true
  })

  // Agrupar por data
  const groups = {}
  filtered.forEach(l => {
    const key = l.data ? l.data.substring(0,10) : 'Sem data'
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })
  const sortedDates = Object.keys(groups).sort((a,b) => b.localeCompare(a))

  // Resumo rápido por tipo
  const byTipo = {}
  filtered.forEach(l => {
    if (l.tipo_trabalho) byTipo[l.tipo_trabalho] = (byTipo[l.tipo_trabalho]||0) + 1
  })

  return (
    <div>
      {/* MODAL DE DETALHES DO REGISTRO */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getPhotoUrl(selectedLog.jogador)
                  ? <img src={getPhotoUrl(selectedLog.jogador)} alt={selectedLog.jogador} className="w-10 h-10 rounded-full object-cover object-top border-2 border-white/20" onError={e=>e.target.style.display='none'} />
                  : <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                      <span className="bc text-[10px] font-black text-white">{(selectedLog.jogador||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</span>
                    </div>
                }
                <div>
                  <p className="font-black text-white text-sm">{selectedLog.jogador||'—'}</p>
                  <p className="text-[9px] text-gray-400">{selectedLog.posicao||''}{selectedLog.pe_dominante ? ` · Pé ${selectedLog.pe_dominante}` : ''}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>
            {/* Corpo */}
            <div className="px-5 py-4 space-y-3 text-[11px]">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Data</p>
                  <p className="font-bold text-gray-800">{fmtDate(selectedLog.data)||'—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Período</p>
                  <p className="font-bold text-gray-800">{selectedLog.periodo||'—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Momento</p>
                  <p className="font-bold text-gray-800">{selectedLog.pre_pos||'—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Local da Queixa</p>
                  <p className="font-bold text-gray-800">{selectedLog.local_queixa||'—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Membro</p>
                  <p className="font-bold text-gray-800">{selectedLog.membro_afetado||'—'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">HD</p>
                <p className="font-bold text-gray-800">{selectedLog.hd||'—'}</p>
              </div>
              {(() => { const cfg = TIPO_TRABALHO_CFG[selectedLog.tipo_trabalho]; return (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mr-1">Tipo</p>
                  {cfg ? <span className={`tipo-badge ${cfg.color}`}>{cfg.icon} {selectedLog.tipo_trabalho}</span> : <span className="text-gray-500">{selectedLog.tipo_trabalho||'—'}</span>}
                </div>
              )})()}
              {selectedLog.observacoes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 mb-1">Observações</p>
                  <p className="text-gray-700 leading-relaxed">{selectedLog.observacoes}</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="px-5 pb-4 flex justify-end gap-2">
              <button onClick={() => { onEdit(selectedLog); setSelectedLog(null) }}
                className="px-4 py-2 rounded-xl text-[9px] font-black uppercase text-sky-600 hover:bg-sky-50 border border-sky-200 transition-colors">
                Editar registro
              </button>
              <button onClick={() => { onDelete(selectedLog.id); setSelectedLog(null) }}
                className="px-4 py-2 rounded-xl text-[9px] font-black uppercase text-red-500 hover:bg-red-50 border border-red-200 transition-colors">
                Excluir registro
              </button>
              <button onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-[9px] font-black uppercase bg-gray-800 text-white hover:bg-gray-900 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Data</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="input-field" style={{width:150}} />
        </div>
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Tipo de Trabalho</label>
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="input-field" style={{width:170}}>
            <option value="">Todos</option>
            {TIPOS_TRABALHO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Período</label>
          <select value={filterPeriodo} onChange={e => setFilterPeriodo(e.target.value)} className="input-field" style={{width:130}}>
            <option value="">Todos</option>
            {PERIODOS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        {(filterDate||filterTipo||filterPeriodo) && (
          <button onClick={()=>{setFilterDate('');setFilterTipo('');setFilterPeriodo('')}}
            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase text-red-500 hover:bg-red-50 border border-red-200">
            Limpar filtros
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setGroupByDate(g => !g)}
            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all
              ${groupByDate ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {groupByDate ? '📅 Por data' : '📋 Lista'}
          </button>
          <button onClick={onNewLog}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
            Novo Registro
          </button>
        </div>
      </div>

      {/* RESUMO */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
            <span className="text-[9px] font-black uppercase text-gray-400">Total</span>
            <span className="bc text-base font-black text-gray-800">{filtered.length}</span>
          </div>
          {Object.entries(byTipo).map(([t,n]) => {
            const cfg = TIPO_TRABALHO_CFG[t] || { color:'bg-gray-100 text-gray-600', icon:'•' }
            return (
              <div key={t} className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 border ${cfg.color}`}>
                <span className="text-[9px]">{cfg.icon}</span>
                <span className="text-[9px] font-black uppercase">{t}</span>
                <span className="bc text-sm font-black">{n}</span>
              </div>
            )
          })}
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="bc text-xl font-black uppercase text-gray-400">
            {logs.length === 0 ? 'Nenhum registro' : 'Nenhum registro para esses filtros'}
          </p>
          {logs.length === 0 && (
            <button onClick={onNewLog} className="mt-4 px-5 py-2.5 rounded-xl bg-gray-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-gray-900">
              + Novo Registro
            </button>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && groupByDate && (
        <div className="space-y-5">
          {sortedDates.map(date => {
            const dayLogs = groups[date]
            // Sub-totais por tipo
            const dayTipo = {}
            dayLogs.forEach(l => { if (l.tipo_trabalho) dayTipo[l.tipo_trabalho] = (dayTipo[l.tipo_trabalho]||0)+1 })
            return (
              <div key={date}>
                {/* Header do dia */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-1.5">
                    <span className="text-[9px] font-black uppercase text-white/60">📅</span>
                    <span className="bc text-sm font-black text-white">{fmtDate(date)}</span>
                  </div>
                  <span className="text-[9px] font-black text-gray-400 uppercase">{dayLogs.length} atleta{dayLogs.length!==1?'s':''}</span>
                  <div className="flex gap-1.5">
                    {Object.entries(dayTipo).map(([t,n]) => {
                      const cfg = TIPO_TRABALHO_CFG[t] || { color:'bg-gray-100 text-gray-600', icon:'•' }
                      return (
                        <span key={t} className={`tipo-badge ${cfg.color}`}>{cfg.icon} {t} ({n})</span>
                      )
                    })}
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Tabela do dia */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500 w-8">#</th>
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Atleta</th>
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Posição</th>
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Período</th>
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Local da Queixa</th>
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Membro</th>
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">HD</th>
                        <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Tipo de Trabalho</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {dayLogs.map((log, i) => {
                        const photo = getPhotoUrl(log.jogador)
                        const initials = (log.jogador||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()
                        const tipoCfg = TIPO_TRABALHO_CFG[log.tipo_trabalho]
                        const hasObs = !!log.observacoes
                        return (
                          <tr key={log.id} onClick={() => setSelectedLog(log)}
                            className={`log-row border-b border-gray-50 cursor-pointer hover:bg-sky-50/50 transition-colors ${i%2?'bg-gray-50/50':''}`}>
                            <td className="px-4 py-2.5 text-gray-400 font-bold">{i+1}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {photo
                                  ? <img src={photo} alt={log.jogador} className="w-7 h-7 rounded-full object-cover object-top border border-gray-100 flex-shrink-0" onError={e=>e.target.style.display='none'} />
                                  : <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                                      <span className="bc text-[9px] font-black text-white">{initials}</span>
                                    </div>
                                }
                                <div>
                                  <p className="font-bold text-gray-800 whitespace-nowrap">{log.jogador||'—'}</p>
                                  <div className="flex items-center gap-1">
                                    {log.pe_dominante && <p className="text-[8px] text-gray-400">Pé {log.pe_dominante}</p>}
                                    {hasObs && <span className="text-[7px] bg-amber-100 text-amber-600 font-black px-1 py-0.5 rounded">OBS</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{log.posicao||'—'}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col items-start gap-1">
                                {log.periodo && <span className="bg-gray-100 text-gray-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">{log.periodo}</span>}
                                {log.pre_pos && <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase border ${(PRE_POS_CFG[log.pre_pos]||{}).color||'bg-gray-100 text-gray-600'}`}>{log.pre_pos}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">{log.local_queixa||'—'}</td>
                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{log.membro_afetado||'—'}</td>
                            <td className="px-4 py-2.5 text-gray-700 font-medium max-w-[160px]">
                              <span className="truncate block">{log.hd||'—'}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              {tipoCfg
                                ? <span className={`tipo-badge ${tipoCfg.color}`}>{tipoCfg.icon} {log.tipo_trabalho}</span>
                                : <span className="text-gray-400">—</span>
                              }
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <button onClick={e => { e.stopPropagation(); onEdit(log) }} className="text-gray-300 hover:text-sky-500 transition-colors text-sm" title="Editar">✎</button>
                                <button onClick={e => { e.stopPropagation(); onDelete(log.id) }} className="text-gray-300 hover:text-red-500 transition-colors text-sm" title="Excluir">✕</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && !groupByDate && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Data</th>
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Atleta</th>
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Posição</th>
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Período</th>
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Local da Queixa</th>
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Membro</th>
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">HD</th>
                <th className="px-4 py-2.5 text-left font-black uppercase tracking-widest text-gray-500">Tipo de Trabalho</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((log,i) => {
                const photo = getPhotoUrl(log.jogador)
                const initials = (log.jogador||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()
                const tipoCfg = TIPO_TRABALHO_CFG[log.tipo_trabalho]
                const hasObs = !!log.observacoes
                return (
                  <tr key={log.id} onClick={() => setSelectedLog(log)}
                    className={`log-row border-b border-gray-50 cursor-pointer hover:bg-sky-50/50 transition-colors ${i%2?'bg-gray-50/50':''}`}>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-medium">{fmtDate(log.data)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {photo
                          ? <img src={photo} alt={log.jogador} className="w-7 h-7 rounded-full object-cover object-top border border-gray-100 flex-shrink-0" onError={e=>e.target.style.display='none'} />
                          : <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0"><span className="bc text-[9px] font-black text-white">{initials}</span></div>
                        }
                        <div>
                          <span className="font-bold text-gray-800 whitespace-nowrap block">{log.jogador||'—'}</span>
                          {hasObs && <span className="text-[7px] bg-amber-100 text-amber-600 font-black px-1 py-0.5 rounded">OBS</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{log.posicao||'—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        {log.periodo && <span className="bg-gray-100 text-gray-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">{log.periodo}</span>}
                        {log.pre_pos && <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase border ${(PRE_POS_CFG[log.pre_pos]||{}).color||'bg-gray-100 text-gray-600'}`}>{log.pre_pos}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{log.local_queixa||'—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{log.membro_afetado||'—'}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-medium max-w-[160px]"><span className="truncate block">{log.hd||'—'}</span></td>
                    <td className="px-4 py-2.5">
                      {tipoCfg ? <span className={`tipo-badge ${tipoCfg.color}`}>{tipoCfg.icon} {log.tipo_trabalho}</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); onEdit(log) }} className="text-gray-300 hover:text-sky-500 transition-colors text-sm" title="Editar">✎</button>
                        <button onClick={e => { e.stopPropagation(); onDelete(log.id) }} className="text-gray-300 hover:text-red-500 transition-colors text-sm" title="Excluir">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── ABA GRÁFICOS ─────────────────────────────────────────────────────────────
function TabGraficos({ logs, cases }) {
  const [mesSel, setMesSel] = useState('todos')
  const [anoSel, setAnoSel] = useState('todos')

  const VERDE = '#0B7C3D'
  const VERDE_LIGHT = '#0a66b7'
  const VERDE_PALE = '#dcfce7'

  const TIPO_COLORS = {
    'Tratamento':            '#1e3a5f',
    'Recovery':              '#f97316',
    'Preventivo / Ativação': '#0a66b7',
    'Manutenção':            '#0ea5e9',
    'Avaliação':             '#a855f7',
  }

  // Normaliza string para comparação
  const norm = s => (s||'').toLowerCase().trim()

  // Todos os registros: logs + cases convertidos
  // Logs têm: data, jogador, posicao, local_queixa, tipo_trabalho
  // Cases têm: jogador, parte_corporal, status (tipo), data_entrada
  const allLogs = logs || []
  const allCases = cases || []

  // Meses disponíveis dos logs
  const mesesDisp = [...new Set(
    allLogs
      .filter(l => l.data)
      .map(l => {
        const d = l.data.substring(0,7) // YYYY-MM
        return d
      })
  )].sort()

  // Anos disponíveis
  const anosDisp = [...new Set(mesesDisp.map(m => m.substring(0,4)))].sort()

  // Filtra logs por mês/ano selecionado
  const logsFiltered = allLogs.filter(l => {
    if (!l.data) return false
    if (anoSel !== 'todos' && !l.data.startsWith(anoSel)) return false
    if (mesSel !== 'todos' && l.data.substring(0,7) !== mesSel) return false
    return true
  })

  // ── 1. Volume mensal por tipo ─────────────────────────────────────────────
  const MESES_NOMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const byMesTipo = {}
  allLogs.forEach(l => {
    if (!l.data || !l.tipo_trabalho) return
    const m = new Date(l.data + 'T12:00:00').getMonth() // 0-11
    const ano = l.data.substring(0,4)
    const key = `${ano}-${String(m+1).padStart(2,'0')}`
    if (!byMesTipo[key]) byMesTipo[key] = {}
    const t = l.tipo_trabalho
    byMesTipo[key][t] = (byMesTipo[key][t] || 0) + 1
  })

  const mesesChart = Object.keys(byMesTipo).sort()
  const tiposUnicos = ['Tratamento','Recovery','Preventivo / Ativação','Manutenção','Avaliação']

  // ── 2. Atendimento por queixa (filtrado) ──────────────────────────────────
  const byQueixa = {}
  logsFiltered.forEach(l => {
    const q = l.local_queixa || '—'
    const t = l.tipo_trabalho || 'Outros'
    if (!byQueixa[q]) byQueixa[q] = {}
    byQueixa[q][t] = (byQueixa[q][t] || 0) + 1
  })
  const queixasSort = Object.entries(byQueixa)
    .sort((a,b) => Object.values(b[1]).reduce((s,v)=>s+v,0) - Object.values(a[1]).reduce((s,v)=>s+v,0))
    .filter(([q]) => q !== '—')
    .slice(0,15)

  // ── 3. Atendimento por posição (filtrado) ─────────────────────────────────
  const byPosicao = {}
  logsFiltered.forEach(l => {
    const p = l.posicao || '—'
    const t = l.tipo_trabalho || 'Outros'
    if (p === '—') return
    if (!byPosicao[p]) byPosicao[p] = {}
    byPosicao[p][t] = (byPosicao[p][t] || 0) + 1
  })
  const posicoesSort = Object.entries(byPosicao).sort((a,b) => a[0].localeCompare(b[0]))

  // ── 4. Atendimento por atleta (filtrado) ──────────────────────────────────
  const byAtleta = {}
  logsFiltered.forEach(l => {
    const a = l.jogador || '—'
    const t = l.tipo_trabalho || 'Outros'
    if (a === '—') return
    if (!byAtleta[a]) byAtleta[a] = {}
    byAtleta[a][t] = (byAtleta[a][t] || 0) + 1
  })
  const atletasSort = Object.entries(byAtleta)
    .sort((a,b) => Object.values(b[1]).reduce((s,v)=>s+v,0) - Object.values(a[1]).reduce((s,v)=>s+v,0))

  // ── 5. KPIs do período filtrado ───────────────────────────────────────────
  const totalFiltrado = logsFiltered.length
  const totalCasosAtivos = allCases.filter(c => c.status === 'Tratamento').length
  const tipoCount = {}
  logsFiltered.forEach(l => { const t=l.tipo_trabalho||'Outros'; tipoCount[t]=(tipoCount[t]||0)+1 })

  // ── Helpers de gráfico de barras empilhadas ───────────────────────────────
  function StackedBar({ items, tipos, colors, maxVal, height=22, label, labelWidth=140 }) {
    const total = tipos.reduce((s,t) => s+(items[t]||0), 0)
    if (total === 0) return null
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
        <p style={{ width:labelWidth, fontSize:9, fontWeight:700, textAlign:'right', color:'#374151',
          flexShrink:0, textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {label}
        </p>
        <div style={{ flex:1, height, background:'#f3f4f6', borderRadius:4, overflow:'hidden', display:'flex' }}>
          {tipos.map(t => {
            const v = items[t] || 0
            if (!v) return null
            const pct = (v / maxVal) * 100
            return (
              <div key={t} style={{ width:`${pct}%`, height:'100%', background:colors[t]||'#9ca3af',
                display:'flex', alignItems:'center', justifyContent:'center', minWidth:v>0?18:0 }}>
                {v > 0 && pct > 5 && <span style={{ fontSize:8, fontWeight:900, color:'white' }}>{v}</span>}
              </div>
            )
          })}
        </div>
        <span style={{ fontSize:9, fontWeight:700, color:'#374151', minWidth:24, textAlign:'right' }}>{total}</span>
      </div>
    )
  }

  function ChartLegend({ tipos, colors }) {
    return (
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', marginBottom:12 }}>
        {tipos.map(t => (
          <div key={t} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:colors[t]||'#9ca3af', flexShrink:0 }} />
            <span style={{ fontSize:8, color:'#6b7280' }}>{t}</span>
          </div>
        ))}
      </div>
    )
  }

  function SectionCard({ title, subtitle, children }) {
    return (
      <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:16, overflow:'hidden', marginBottom:20, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ background:VERDE, padding:'10px 16px' }}>
          <p style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:15, fontWeight:900,
            textTransform:'uppercase', letterSpacing:2, color:'white', margin:0 }}>{title}</p>
          {subtitle && <p style={{ fontSize:8, color:'rgba(255,255,255,0.7)', margin:'2px 0 0' }}>{subtitle}</p>}
        </div>
        <div style={{ padding:'16px' }}>{children}</div>
      </div>
    )
  }

  // ── Gráfico de colunas mensal (SVG) ───────────────────────────────────────
  function BarChartMensal() {
    if (!mesesChart.length) return <p style={{ color:'#9ca3af', fontSize:10, textAlign:'center', padding:'20px 0' }}>Nenhum dado disponível</p>

    const tiposGraf = ['Tratamento','Recovery','Preventivo / Ativação','Manutenção','Avaliação']
    const totaisPorMes = mesesChart.map(m => tiposGraf.reduce((s,t) => s+(byMesTipo[m]?.[t]||0), 0))
    const maxTotal = Math.max(...totaisPorMes, 1)

    const W = 700, H = 200, PAD_L = 40, PAD_B = 30, PAD_T = 10, PAD_R = 10
    const chartW = W - PAD_L - PAD_R
    const chartH = H - PAD_B - PAD_T
    const barW = Math.min(40, (chartW / mesesChart.length) * 0.65)
    const gap = chartW / mesesChart.length

    // Y gridlines
    const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(p => Math.round(p * maxTotal))

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:W }}>
        {/* Grid */}
        {yTicks.map(v => {
          const y = PAD_T + chartH - (v/maxTotal)*chartH
          return (
            <g key={v}>
              <line x1={PAD_L} y1={y} x2={W-PAD_R} y2={y} stroke="#f3f4f6" strokeWidth={1}/>
              <text x={PAD_L-4} y={y+3} fontSize={7} fill="#9ca3af" textAnchor="end">{v}</text>
            </g>
          )
        })}
        {/* Bars */}
        {mesesChart.map((m, mi) => {
          const cx = PAD_L + gap * mi + gap / 2
          let yOff = 0
          const bars = tiposGraf.map(t => {
            const v = byMesTipo[m]?.[t] || 0
            if (!v) return null
            const h = (v / maxTotal) * chartH
            const y = PAD_T + chartH - yOff - h
            yOff += h
            return (
              <g key={t}>
                <rect x={cx - barW/2} y={y} width={barW} height={h} fill={TIPO_COLORS[t]||'#9ca3af'} rx={1} />
                {h > 12 && <text x={cx} y={y + h/2 + 3} fontSize={7} fill="white" textAnchor="middle" fontWeight="bold">{v}</text>}
              </g>
            )
          })
          const label = MESES_NOMES[parseInt(m.split('-')[1])-1]
          const total = totaisPorMes[mi]
          return (
            <g key={m}>
              {bars}
              <text x={cx} y={H-PAD_B+12} fontSize={8} fill="#6b7280" textAnchor="middle">{label}</text>
              {total > 0 && <text x={cx} y={PAD_T + chartH - yOff - 4} fontSize={7} fill="#374151" textAnchor="middle" fontWeight="bold">{total}</text>}
            </g>
          )
        })}
        {/* Axis */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T+chartH} stroke="#d1d5db" strokeWidth={1}/>
        <line x1={PAD_L} y1={PAD_T+chartH} x2={W-PAD_R} y2={PAD_T+chartH} stroke="#d1d5db" strokeWidth={1}/>
      </svg>
    )
  }

  const PRINT_STYLE_GRAF = `@media print {
    body>*{visibility:hidden!important}
    #rel-graficos,#rel-graficos *{visibility:visible!important}
    #rel-graficos{position:absolute!important;top:0!important;left:0!important;width:100%!important;font-size:9px!important}
    .no-print{display:none!important}
  }`

  return (
    <div className="dm-font fade-in">
      <style>{PRINT_STYLE_GRAF}</style>

      {/* ── FILTROS ── */}
      <div className="flex flex-wrap items-end gap-3 mb-5 no-print">
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Ano</label>
          <select value={anoSel} onChange={e => { setAnoSel(e.target.value); setMesSel('todos') }} className="input-field" style={{width:110}}>
            <option value="todos">Todos</option>
            {anosDisp.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Mês</label>
          <select value={mesSel} onChange={e => setMesSel(e.target.value)} className="input-field" style={{width:160}}>
            <option value="todos">Todos os meses</option>
            {mesesDisp.filter(m => anoSel === 'todos' || m.startsWith(anoSel)).map(m => {
              const [y,mo] = m.split('-')
              return <option key={m} value={m}>{MESES_NOMES[parseInt(mo)-1].toUpperCase()} {y}</option>
            })}
          </select>
        </div>
        {(mesSel !== 'todos' || anoSel !== 'todos') && (
          <button onClick={() => { setMesSel('todos'); setAnoSel('todos') }}
            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase text-red-500 hover:bg-red-50 border border-red-200">
            Limpar filtros
          </button>
        )}
        <div className="ml-auto">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest shadow-sm"
            style={{ background: VERDE }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Exportar PDF
          </button>
        </div>
      </div>

      <div id="rel-graficos">
        {/* HEADER DO RELATÓRIO */}
        <div style={{ background:VERDE, borderRadius:16, padding:'16px 24px', marginBottom:20, color:'white', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:22, fontWeight:900, margin:0, letterSpacing:2, textTransform:'uppercase' }}>
              Associação Desportiva Confiança
            </p>
            <p style={{ fontSize:11, opacity:0.8, margin:'2px 0 0', fontWeight:600 }}>DM | Fisioterapia — Relatório de Atendimentos</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:13, fontWeight:900, margin:0 }}>
              {mesSel !== 'todos'
                ? MESES_NOMES[parseInt(mesSel.split('-')[1])-1].toUpperCase() + ' ' + mesSel.split('-')[0]
                : anoSel !== 'todos' ? anoSel : 'Todos os períodos'}
            </p>
            <p style={{ fontSize:9, opacity:0.7, margin:'2px 0 0' }}>Registros DM</p>
          </div>
        </div>

        {/* KPIs GERAIS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:10, marginBottom:20 }}>
          {[
            { label:'Total Atendimentos', value:totalFiltrado, icon:'📋', bg:'#f0fdf4', border:'#86efac', vc:'#07579e' },
            { label:'Casos em Tratamento', value:totalCasosAtivos, icon:'🚨', bg:'#fef2f2', border:'#fca5a5', vc:'#dc2626' },
            { label:'Atletas Atendidos', value:Object.keys(byAtleta).length, icon:'👥', bg:'#eff6ff', border:'#93c5fd', vc:'#1d4ed8' },
            ...tiposUnicos.filter(t=>tipoCount[t]).map(t => ({
              label:t, value:tipoCount[t]||0, icon:t==='Tratamento'?'🚨':t==='Recovery'?'🔄':t==='Manutenção'?'🔧':t==='Preventivo / Ativação'?'🟢':'📋',
              bg:'#f9fafb', border:'#e5e7eb', vc:'#374151'
            })),
          ].map((k,i) => (
            <div key={i} style={{ background:k.bg, border:`1px solid ${k.border}`, borderRadius:12, padding:'10px 12px' }}>
              <p style={{ fontSize:8, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'#6b7280', margin:'0 0 4px' }}>{k.icon} {k.label}</p>
              <p style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:26, fontWeight:900, color:k.vc, margin:0, lineHeight:1 }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* VOLUME MENSAL */}
        {mesesChart.length > 0 && (
          <SectionCard title="Volume de Atendimentos" subtitle="Por tipo de trabalho — acumulado mensal">
            <ChartLegend tipos={tiposUnicos.filter(t => mesesChart.some(m=>byMesTipo[m]?.[t]))} colors={TIPO_COLORS} />
            <BarChartMensal />
          </SectionCard>
        )}

        {/* ATENDIMENTO POR QUEIXA */}
        {queixasSort.length > 0 && (
          <SectionCard title="Atendimento por Queixa" subtitle={`${mesSel!=='todos'?MESES_NOMES[parseInt(mesSel.split('-')[1])-1].toUpperCase()+' '+mesSel.split('-')[0]:'Período selecionado'}`}>
            <ChartLegend tipos={tiposUnicos.filter(t => queixasSort.some(([,d])=>d[t]))} colors={TIPO_COLORS} />
            {(() => {
              const maxQ = Math.max(...queixasSort.map(([,d]) => Object.values(d).reduce((s,v)=>s+v,0)), 1)
              return queixasSort.map(([q, d]) => (
                <StackedBar key={q} label={q} items={d} tipos={tiposUnicos} colors={TIPO_COLORS} maxVal={maxQ} />
              ))
            })()}
          </SectionCard>
        )}

        {/* ATENDIMENTO POR POSIÇÃO */}
        {posicoesSort.length > 0 && (
          <SectionCard title="Atendimento por Posição" subtitle={`${mesSel!=='todos'?MESES_NOMES[parseInt(mesSel.split('-')[1])-1].toUpperCase()+' '+mesSel.split('-')[0]:'Período selecionado'}`}>
            <ChartLegend tipos={tiposUnicos.filter(t => posicoesSort.some(([,d])=>d[t]))} colors={TIPO_COLORS} />
            {(() => {
              const maxP = Math.max(...posicoesSort.map(([,d]) => Object.values(d).reduce((s,v)=>s+v,0)), 1)
              return posicoesSort.map(([p, d]) => (
                <StackedBar key={p} label={p} items={d} tipos={tiposUnicos} colors={TIPO_COLORS} maxVal={maxP} />
              ))
            })()}
          </SectionCard>
        )}

        {/* ATENDIMENTO POR ATLETA */}
        {atletasSort.length > 0 && (
          <SectionCard title="Atendimento por Atleta" subtitle={`${mesSel!=='todos'?MESES_NOMES[parseInt(mesSel.split('-')[1])-1].toUpperCase()+' '+mesSel.split('-')[0]:'Período selecionado'} — ordenado por volume`}>
            <ChartLegend tipos={tiposUnicos.filter(t => atletasSort.some(([,d])=>d[t]))} colors={TIPO_COLORS} />
            {(() => {
              const maxA = Math.max(...atletasSort.map(([,d]) => Object.values(d).reduce((s,v)=>s+v,0)), 1)
              return atletasSort.map(([a, d]) => (
                <StackedBar key={a} label={a} items={d} tipos={tiposUnicos} colors={TIPO_COLORS} maxVal={maxA} labelWidth={160} />
              ))
            })()}
          </SectionCard>
        )}

        {logsFiltered.length === 0 && (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center gap-3">
            <p className="text-5xl">📊</p>
            <p className="bc text-xl font-black uppercase text-gray-400">Nenhum registro para o período selecionado</p>
            <p className="text-[9px] text-gray-400">Os gráficos são gerados automaticamente a partir dos Registros DM</p>
          </div>
        )}
      </div>
    </div>
  )
}


// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function DmPage() {
  const { setPhoto, getPhotoUrl } = usePlayerPhotos()

  const [tab,          setTab]          = useState(0)
  const [cases,        setCases]        = useState([])
  const [logs,         setLogs]         = useState([])
  const [players,      setPlayers]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showCaseForm, setShowCaseForm] = useState(false)
  const [showLogForm,  setShowLogForm]  = useState(false)
  const [caseForm,     setCaseForm]     = useState(emptyCase())
  const [logForm,      setLogForm]      = useState(emptyLog())
  const [editId,       setEditId]       = useState(null)
  const [editLogId,    setEditLogId]    = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [photoModal,   setPhotoModal]   = useState(null)
  const [relData,      setRelData]      = useState('')
  const [relPeriodo,   setRelPeriodo]   = useState('Tarde')
  const [relFilter,    setRelFilter]    = useState('Todos')
  const [relModelo,    setRelModelo]    = useState('tarde')

  // ── CARGA ──────────────────────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true)
    try {
      const [dmRes, squadRes] = await Promise.all([
        fetch('/api/dm'),
        fetch('/api/squad'),
      ])
      const dmData    = await dmRes.json()
      const squadData = await squadRes.json()
      setCases(dmData.cases || [])
      setLogs(dmData.logs   || [])
      setPlayers(squadData.players || [])
    } catch (err) {
      console.error('[DM] Erro ao carregar:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    const hoje = new Date().toISOString().slice(0,10)
    setCaseForm(f => ({ ...f, data_entrada: f.data_entrada || hoje }))
    setLogForm(f  => ({ ...f, data: f.data || hoje }))
    setRelData(hoje)
  }, [])

  // ── SALVAR CASO ────────────────────────────────────────────────────────────
  async function saveCase() {
    if (!caseForm.jogador.trim()) return
    setSaving(true)
    try {
      const url    = editId ? `/api/dm/${editId}` : '/api/dm'
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify({type:'case',...caseForm}) })
      const data   = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (method === 'PUT') setCases(prev => prev.map(c => c.id===editId ? data.case : c))
      else setCases(prev => [data.case,...prev])
      setShowCaseForm(false); setEditId(null); setCaseForm(emptyCase())
    } catch (e) { alert('Erro ao salvar: '+e.message) }
    finally { setSaving(false) }
  }

  // ── SALVAR LOG ─────────────────────────────────────────────────────────────
  async function saveLog() {
    if (!logForm.jogador?.trim()) return
    setSaving(true)
    try {
      const url    = editLogId ? `/api/dm/${editLogId}` : '/api/dm'
      const method = editLogId ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify({type:'log',...logForm}) })
      const data   = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (method === 'PUT') setLogs(prev => prev.map(l => Number(l.id)===Number(editLogId) ? data.log : l))
      else setLogs(prev => [data.log,...prev])
      setShowLogForm(false); setLogForm(emptyLog()); setEditLogId(null)
    } catch (e) { alert('Erro ao salvar: '+e.message) }
    finally { setSaving(false) }
  }

  function editLog(l) {
    setLogForm({
      data: l.data ? l.data.substring(0,10) : '',
      jogador: l.jogador||'', posicao: l.posicao||'', pe_dominante: l.pe_dominante||'',
      categoria: l.categoria||'Profissional', periodo: l.periodo||getPeriodoPorHora(),
      local_queixa: l.local_queixa||'', membro_afetado: l.membro_afetado||'',
      hd: l.hd||'', tipo_trabalho: l.tipo_trabalho||'', pre_pos: l.pre_pos||'',
      observacoes: l.observacoes||'',
    })
    setEditLogId(l.id)
    setShowLogForm(true)
  }

  async function deleteCase(id) {
    try {
      const res = await fetch(`/api/dm/${id}?type=case`,{method:'DELETE'})
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCases(prev => prev.filter(c => Number(c.id)!==Number(id)))
    } catch (e) { alert('Erro ao deletar: '+e.message) }
  }

  async function deleteLog(id) {
    try {
      const res = await fetch(`/api/dm/${id}?type=log`,{method:'DELETE'})
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLogs(prev => prev.filter(l => Number(l.id)!==Number(id)))
    } catch (e) { alert('Erro ao deletar: '+e.message) }
  }

  function editCase(c) {
    setCaseForm({
      jogador: c.jogador||'', parte_corporal: c.parte_corporal||'', tipo_lesao: c.tipo_lesao||'',
      diagnostico: c.diagnostico||'', hd_texto: c.hd_texto||'', estagio: c.estagio||'',
      status: c.status||'Tratamento', membro: c.membro||'',
      sintomatico: c.sintomatico!==undefined ? c.sintomatico : true, conduta: c.conduta||'',
      data_entrada: c.data_entrada ? c.data_entrada.substring(0,10) : '',
      data_lesao: c.data_lesao ? c.data_lesao.substring(0,10) : '',
      data_exame: c.data_exame ? c.data_exame.substring(0,10) : '',
      data_cirurgia: c.data_cirurgia ? c.data_cirurgia.substring(0,10) : '',
      previsao_retorno: c.previsao_retorno ? c.previsao_retorno.substring(0,10) : '',
      observacoes: c.observacoes||'',
    })
    setEditId(c.id)
    setShowCaseForm(true)
  }

  // Handler para selecionar atleta no form de caso
  function handleCasePlayerSelect(p) {
    setCaseForm(f => ({ ...f, jogador: p.nome }))
  }

  const statusCount = STATUS_OPTIONS.reduce((acc,s) => {
    acc[s] = cases.filter(c => c.status===s).length; return acc
  }, {})
  const filteredCases = filterStatus==='Todos' ? cases : cases.filter(c => c.status===filterStatus)
  const casesParaRelatorio = relFilter==="Todos" ? cases : cases.filter(c => c.status===relFilter)
  // Logs do dia selecionado, filtrados por periodo
  const logsParaRelatorio = logs.filter(l => {
    if (!l.data) return false
    const logDate = l.data.substring(0,10)
    if (logDate !== relData) return false
    if (relPeriodo !== "Integral" && l.periodo && l.periodo !== relPeriodo) return false
    return true
  })

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm-font h-screen overflow-y-auto bg-gray-50">

        {/* HERO */}
        <div className="px-8 py-8 relative overflow-hidden" style={{background:'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)'}}>
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10 bg-white" />
          <div className="relative max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="pulse-dot w-2 h-2 rounded-full bg-red-300" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-200">Departamento Médico</p>
            </div>
            <h1 className="bc text-5xl font-black uppercase text-white leading-none mb-4">DM</h1>
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2">
                <span className="text-lg">🏥</span>
                <div>
                  <p className="text-[7px] text-red-200 font-black uppercase tracking-widest">Total em DM</p>
                  <p className="bc text-xl font-black text-white leading-none">{cases.length}</p>
                </div>
              </div>
              {STATUS_OPTIONS.map(s => {
                const cfg = STATUS_CFG[s]
                return (
                  <div key={s} className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <div>
                      <p className="text-[7px] text-red-200 font-black uppercase tracking-widest">{s}</p>
                      <p className="bc text-xl font-black text-white leading-none">{statusCount[s]||0}</p>
                    </div>
                  </div>
                )
              })}
              <div className="ml-auto">
                <button onClick={() => { setCaseForm(emptyCase()); setEditId(null); setShowCaseForm(true) }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-red-700 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
                  Novo Caso
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="max-w-7xl mx-auto px-8 py-6">

          {/* TABS */}
          <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
            {TABS.map((t,i) => (
              <button key={t} onClick={() => setTab(i)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                  ${tab===i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* ── RELATÓRIO DIÁRIO ── */}
          {tab===0 && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {['Todos',...STATUS_OPTIONS].map(s => {
                  const cfg = s!=='Todos' ? STATUS_CFG[s] : null
                  const count = s==='Todos' ? cases.length : statusCount[s]||0
                  return (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                        ${filterStatus===s ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-600'}`}>
                      {cfg?.icon} {s} <span className="opacity-50 ml-0.5">({count})</span>
                    </button>
                  )
                })}
              </div>

              {loading && <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>}

              {!loading && filteredCases.length===0 && (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center gap-3">
                  <p className="text-5xl">🏥</p>
                  <p className="bc text-xl font-black uppercase text-gray-400">
                    {filterStatus==='Todos' ? 'Nenhum atleta em DM' : `Nenhum atleta em ${filterStatus}`}
                  </p>
                  {filterStatus==='Todos' && (
                    <button onClick={() => { setCaseForm(emptyCase()); setEditId(null); setShowCaseForm(true) }}
                      className="mt-1 px-5 py-2.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700">
                      + Adicionar Caso
                    </button>
                  )}
                </div>
              )}

              {!loading && filteredCases.length>0 && (
                <div className="space-y-6">
                  {(filterStatus==='Todos' ? STATUS_OPTIONS : [filterStatus]).map(status => {
                    const group = filteredCases.filter(c => c.status===status)
                    if (!group.length) return null
                    const cfg = STATUS_CFG[status]
                    return (
                      <div key={status}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{cfg.icon}</span>
                          <p className="bc text-base font-black uppercase text-gray-700">{status}</p>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${cfg.badge}`}>{group.length}</span>
                          <div className="flex-1 h-px bg-gray-200 ml-1" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {group.map(c => (
                            <CaseCard key={c.id} c={c} getPhotoUrl={getPhotoUrl}
                              onEdit={editCase} onDelete={deleteCase}
                              onPhotoClick={name => setPhotoModal(name)} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── REGISTROS DM ── */}
          {tab===1 && (
            <LogsTable
              logs={logs}
              getPhotoUrl={getPhotoUrl}
              onDelete={deleteLog}
              onEdit={editLog}
              onNewLog={() => { setEditLogId(null); setLogForm({...emptyLog(), data: new Date().toISOString().slice(0,10)}); setShowLogForm(true) }}
              loading={loading}
            />
          )}

          {/* ── GERAR RELATÓRIO ── */}
          {tab===2 && (
            <>
              {/* CONTROLES */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
                <div className="flex flex-wrap gap-4 items-end">
                  {/* Data */}
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Data do Relatório</label>
                    <input type="date" value={relData} onChange={e => setRelData(e.target.value)} className="input-field" style={{width:160}} />
                  </div>

                  {/* Período */}
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Período</label>
                    <select value={relPeriodo} onChange={e => {
                      setRelPeriodo(e.target.value)
                      setRelModelo(e.target.value === 'Manhã' ? 'manha' : 'tarde')
                    }} className="input-field" style={{width:130}}>
                      {PERIODOS_REL.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Modelo */}
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Modelo</label>
                    <div className="flex gap-1.5">
                      {[
                        { key:'manha', label:'☀️ Manhã', desc:'PRÉ / DM / PÓS' },
                        { key:'tarde', label:'🌙 Tarde', desc:'Atendimentos' },
                      ].map(m => (
                        <button key={m.key} onClick={() => setRelModelo(m.key)}
                          className={`px-3 py-2 rounded-xl border text-[9px] font-black transition-all text-left
                            ${relModelo===m.key ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                          <div>{m.label}</div>
                          <div className={`text-[7px] mt-0.5 ${relModelo===m.key ? 'text-gray-300' : 'text-gray-400'}`}>{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Botão imprimir */}
                  <div className="ml-auto self-end">
                    <button onClick={() => window.print()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-800 shadow-sm transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      Salvar PDF
                    </button>
                  </div>
                </div>

                {/* Dica */}
                <p className="text-[8px] text-gray-400 mt-3 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>
                    O relatório usa os <strong>Registros DM</strong> da data selecionada como tabela de atendimentos.
                    Quando não há registros no dia, exibe automaticamente os <strong>Atletas em Tratamento</strong> ativos.
                    O Resumo Individual sempre mostra todos os <strong>Casos DM ativos</strong> em Tratamento.
                  </span>
                </p>
              </div>

              {/* PREVIEW HEADER */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Preview</span>
                <span className="bg-gray-800 text-white text-[8px] font-black px-2 py-0.5 rounded-full">
                  {logsParaRelatorio.length} log{logsParaRelatorio.length!==1?'s':''}
                </span>
                {cases.filter(c => c.status==='Tratamento').length > 0 && (
                  <span className="bg-red-100 text-red-700 text-[8px] font-black px-2 py-0.5 rounded-full">
                    {cases.filter(c => c.status==='Tratamento').length} em tratamento
                  </span>
                )}
                <div className="flex-1 h-px bg-gray-200" />
                {!relData && (
                  <span className="text-[8px] text-amber-600 font-bold">⚠ Selecione uma data</span>
                )}
              </div>

              {/* PREVIEW DO RELATÓRIO */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <RelatorioPrint
                  logsDodia={logsParaRelatorio}
                  cases={cases}
                  data={relData}
                  periodo={relPeriodo}
                  modelo={relModelo}
                />
              </div>
            </>
          )}

          {/* ── GRÁFICOS ── */}
          {tab===3 && (
            <TabGraficos logs={logs} cases={cases} />
          )}

          {/* ── STATUS RECUPERAÇÃO ── */}
          {tab===4 && (
            <TabStatusRecuperacao players={players} getPhotoUrl={getPhotoUrl} />
          )}
        </div>
      </div>

      {/* ── MODAL CASO ── */}
      {showCaseForm && (
        <ModalForm title={editId ? 'Editar Caso DM' : 'Novo Caso DM'} onClose={() => { setShowCaseForm(false); setEditId(null) }} onSave={saveCase} saving={saving}>
          <FormGrid>
            <SectionDivider label="Identificação" />
            <FormField label="Jogador *" span>
              <PlayerSearchInput
                value={caseForm.jogador}
                onChange={name => setCaseForm(f => ({ ...f, jogador: name }))}
                onSelect={handleCasePlayerSelect}
                players={players}
                getPhotoUrl={getPhotoUrl}
                placeholder="Buscar pelo nome..."
              />
            </FormField>
            <FormField label="Status">
              <select value={caseForm.status} onChange={e => setCaseForm(p => ({ ...p, status: e.target.value }))} className="input-field">
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <div /> {/* spacer */}

            <SectionDivider label="Diagnóstico" />
            <FormField label="HD (Hipótese Diagnóstica)" span>
              <input value={caseForm.hd_texto} onChange={e => setCaseForm(p => ({ ...p, hd_texto: e.target.value }))} className="input-field" placeholder="Ex: Lesão grau 2 do Reto femoral direito" />
              <p className="text-[8px] text-gray-400 mt-1">Se preenchido, substitui o campo diagnóstico no relatório.</p>
            </FormField>
            <FormField label="Diagnóstico (lista)">
              <select value={caseForm.diagnostico} onChange={e => setCaseForm(p => ({ ...p, diagnostico: e.target.value }))} className="input-field">
                <option value="">Selecione...</option>
                {DIAGNOSTICOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Parte do Corpo">
              <select value={caseForm.parte_corporal} onChange={e => setCaseForm(p => ({ ...p, parte_corporal: e.target.value }))} className="input-field">
                <option value="">Selecione...</option>
                {PARTES_CORPO.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Tipo de Lesão">
              <select value={caseForm.tipo_lesao} onChange={e => setCaseForm(p => ({ ...p, tipo_lesao: e.target.value }))} className="input-field">
                <option value="">Selecione...</option>
                {TIPOS_LESAO.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Membro">
              <select value={caseForm.membro} onChange={e => setCaseForm(p => ({ ...p, membro: e.target.value }))} className="input-field">
                <option value="">Selecione...</option>
                {MEMBROS.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Estágio">
              <select value={caseForm.estagio} onChange={e => setCaseForm(p => ({ ...p, estagio: e.target.value }))} className="input-field">
                <option value="">Selecione...</option>
                {ESTAGIOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>

            <SectionDivider label="Quadro Clínico" />
            <FormField label="Sintomático" span>
              <div className="flex gap-3">
                {[true,false].map(v => (
                  <button key={String(v)} onClick={() => setCaseForm(p => ({ ...p, sintomatico: v }))}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all
                      ${caseForm.sintomatico===v ? v ? 'bg-red-600 text-white border-red-600' : 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                    {v ? 'Sintomático' : 'Assintomático'}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Conduta" span>
              <textarea value={caseForm.conduta} onChange={e => setCaseForm(p => ({ ...p, conduta: e.target.value }))} className="input-field resize-none" rows={2} placeholder="Ex: SIS, Laser, bicicleta e fortalecimento de CORE" />
            </FormField>
            <FormField label="Observações" span>
              <textarea value={caseForm.observacoes} onChange={e => setCaseForm(p => ({ ...p, observacoes: e.target.value }))} className="input-field resize-none" rows={2} placeholder="Observações clínicas adicionais..." />
            </FormField>

            <SectionDivider label="Datas" />
            <FormField label="Data da Lesão"><input type="date" value={caseForm.data_lesao} onChange={e => setCaseForm(p => ({ ...p, data_lesao: e.target.value }))} className="input-field" /></FormField>
            <FormField label="Data do Exame"><input type="date" value={caseForm.data_exame} onChange={e => setCaseForm(p => ({ ...p, data_exame: e.target.value }))} className="input-field" /></FormField>
            <FormField label="Data da Cirurgia"><input type="date" value={caseForm.data_cirurgia} onChange={e => setCaseForm(p => ({ ...p, data_cirurgia: e.target.value }))} className="input-field" /></FormField>
            <FormField label="Previsão RTT"><input type="date" value={caseForm.previsao_retorno} onChange={e => setCaseForm(p => ({ ...p, previsao_retorno: e.target.value }))} className="input-field" /></FormField>
            <FormField label="Data de Entrada no DM"><input type="date" value={caseForm.data_entrada} onChange={e => setCaseForm(p => ({ ...p, data_entrada: e.target.value }))} className="input-field" /></FormField>
          </FormGrid>
        </ModalForm>
      )}

      {/* ── MODAL LOG ── */}
      {showLogForm && (
        <LogFormModal
          logForm={logForm}
          setLogForm={setLogForm}
          players={players}
          getPhotoUrl={getPhotoUrl}
          onClose={() => { setShowLogForm(false); setEditLogId(null); setLogForm(emptyLog()) }}
          onSave={saveLog}
          saving={saving}
          isEditing={!!editLogId}
        />
      )}

      {/* ── MODAL FOTO ── */}
      <PhotoSelectorModal
        isOpen={!!photoModal}
        playerName={photoModal}
        currentPhoto={photoModal ? getPhotoUrl(photoModal) : null}
        onPhotoSelect={url => { if (photoModal) setPhoto(photoModal, url||null) }}
        onClose={() => setPhotoModal(null)}
      />
    </AppShell>
  )
}
