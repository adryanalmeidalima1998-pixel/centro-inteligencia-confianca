'use client'
// CAMINHO: app/fisiologia/gps/TabCorrelacao.js

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

// ── TEMA ──────────────────────────────────────────────────────────────────────
const G = { verde: '#0B7C3D', verde2: '#0a66b7', amber: '#f59e0b', red: '#dc2626', slate: '#64748b', purple: '#8b5cf6' }
const POS_COLOR = { ZAG: '#0ea5e9', LAT: '#8b5cf6', VOL: '#f59e0b', ATA: '#ef4444', MC: '#10b981', GOL: '#6b7280' }
const POS_LABEL = { ZAG: 'Zagueiro', LAT: 'Lateral', VOL: 'Volante', ATA: 'Atacante', MC: 'Meia', GOL: 'Goleiro' }
const POS_MAP = {
  'ZAGUEIRO':'ZAG','LATERAL':'LAT','VOLANTE':'VOL',
  'ATACANTE':'ATA','MEIO CAMPO':'MC','GOAL KEEPER':'GOL',
  'ZAG':'ZAG','LAT':'LAT','VOL':'VOL','ATA':'ATA','MC':'MC','GOL':'GOL',
}

const GPS_METRICS = [
  { key:'dist_p90',    label:'Distancia p90',      unit:'m', color:G.verde  },
  { key:'hsr_p90',     label:'HSR >20km/h p90',    unit:'m', color:G.verde2 },
  { key:'sprint_p90',  label:'Sprint >25km/h p90', unit:'m', color:'#0ea5e9' },
  { key:'sprints_p90', label:'N Sprints p90',       unit:'',  color:G.purple },
  { key:'accel_p90',   label:'Aceleracoes p90',     unit:'',  color:G.amber  },
  { key:'decel_p90',   label:'Desaceleracoes p90',  unit:'',  color:G.slate  },
]
const PERF_METRICS = [
  { key:'duelos_p90',    label:'Duelos p90',        unit:'' },
  { key:'duelosW_pct',   label:'Duelos Ganhos %',   unit:'%' },
  { key:'interc_p90',    label:'Intercepcoes p90',  unit:'' },
  { key:'passesC_pct',   label:'Precisao Passes %', unit:'%' },
  { key:'acoesW_pct',    label:'Acoes c/ Sucesso %',unit:'%' },
  { key:'passProgr_p90', label:'Passes Prog. p90',  unit:'' },
]

function pearsonR(arr, kx, ky) {
  const n = arr.length; if (n < 3) return 0
  const xs = arr.map(d=>d[kx]), ys = arr.map(d=>d[ky])
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n
  const num = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)
  const dx = Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0))
  const dy = Math.sqrt(ys.reduce((s,y)=>s+(y-my)**2,0))
  return dx&&dy ? +(num/(dx*dy)).toFixed(2) : 0
}
function rColor(r){const a=Math.abs(r);if(a>=.7)return r>0?'#07579e':'#dc2626';if(a>=.4)return r>0?'#0a66b7':'#ef4444';if(a>=.2)return r>0?'#86efac':'#fca5a5';return'#e2e8f0'}
function rBg(r){const a=Math.abs(r);if(a>=.7)return r>0?'#dcfce7':'#fee2e2';if(a>=.4)return r>0?'#f0fdf4':'#fff1f2';if(a>=.2)return r>0?'#f7fef9':'#fff5f5';return'#f8fafc'}
function rLabel(r){const a=Math.abs(r);if(a>=.7)return r>0?'Forte +':'Forte -';if(a>=.4)return r>0?'Moderada +':'Moderada -';if(a>=.2)return r>0?'Fraca +':'Fraca -';return'Nula'}
function normNome(n){return(n||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}

function buildDataset(gpsRows, desempRows) {
  return desempRows.reduce((acc, d) => {
    const dNome = normNome(d.jogador)
    const gps = gpsRows.find(g => {
      const gNome = normNome(g.playerName)
      if (gNome === dNome) return true
      const gP = gNome.split(' '), dP = dNome.split(' ')
      return gP.some(gp => dP.some(dp => gp === dp && gp.length > 3))
    })
    if (!gps) return acc
    const min = parseInt(d.minutos)||90, f = 90/min
    const posRaw = (gps.positionName||'').toUpperCase()
    const pos = POS_MAP[posRaw]||'VOL'
    acc.push({
      nome:d.jogador, pos, min,
      dist_p90:    +(parseFloat(gps.totalDistance||0)*f).toFixed(0),
      hsr_p90:     +(parseFloat(gps.dist20||0)*f).toFixed(0),
      sprint_p90:  +(parseFloat(gps.dist25||0)*f).toFixed(0),
      sprints_p90: +(parseFloat(gps.sprints||0)*f).toFixed(1),
      accel_p90:   +(parseFloat(gps.accel||0)*f).toFixed(1),
      decel_p90:   +(parseFloat(gps.decel||0)*f).toFixed(1),
      duelos_p90:  +(d.duelos*f).toFixed(1),
      duelosW_pct: +(d.duelos_ganhos/Math.max(d.duelos,1)*100).toFixed(1),
      interc_p90:  +(d.intercep*f).toFixed(1),
      passesC_pct: +(d.passes_certos/Math.max(d.passes,1)*100).toFixed(1),
      acoesW_pct:  +(d.acoes_sucesso/Math.max(d.acoes,1)*100).toFixed(1),
      passProgr_p90: +(d.pass_progr*f).toFixed(1),
    })
    return acc
  }, [])
}

// ── Extrai texto do PDF no browser usando pdfjs via CDN ──────────────────────
// Retorna array de strings: uma por página do PDF
async function extractPdfPages(file) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }

  const buf = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let text = '', lastY = null
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) text += '\n'
      text += item.str
      lastY = item.transform[5]
    }
    pages.push(text)
  }

  return pages
}

// ── UPLOAD PANEL ──────────────────────────────────────────────────────────────
function UploadPanel({ session, onSucesso }) {
  const [file, setFile]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState('')
  const [erro, setErro]         = useState('')
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  const handleFile = e => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setErro('Selecione um arquivo PDF.'); return }
    setFile(f); setErro(''); setResultado(null)
  }
  const handleDrop = e => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setErro('Arquivo deve ser PDF.'); return }
    setFile(f); setErro(''); setResultado(null)
  }

  const enviar = async () => {
    if (!file) { setErro('Selecione o PDF primeiro.'); return }
    setLoading(true); setErro(''); setResultado(null)
    try {
      setProgress('Lendo PDF no navegador...')
      const pages = await extractPdfPages(file)

      if (!pages.length) throw new Error('Não foi possível extrair texto do PDF.')

      setProgress(`Enviando ${pages.length} páginas para o servidor...`)
      const res = await fetch('/api/gps/desempenho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, pages }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erro ao processar o PDF.')
      setResultado(data)
      setProgress('')
      setTimeout(() => onSucesso(), 1200)
    } catch (e) {
      setErro(e.message); setProgress('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-[11px] font-black text-blue-800 uppercase tracking-wide mb-1">Como funciona</p>
        <ol className="text-[10px] text-blue-700 space-y-1 list-decimal list-inside">
          <li>No Wyscout, abra o jogo e exporte o <b>Players in Match Report</b> em PDF</li>
          <li>Faça o upload do PDF aqui abaixo</li>
          <li>O sistema parseia automaticamente duelos, intercepções, passes e ações de cada jogador</li>
          <li>Os dados são cruzados com o GPS da sessão selecionada e a correlação é calculada</li>
        </ol>
      </div>

      <div
        onDrop={handleDrop} onDragOver={e=>e.preventDefault()}
        onClick={()=>inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
          ${file?'border-sky-400 bg-sky-50':'border-gray-200 hover:border-sky-400 hover:bg-sky-50/30'}`}
      >
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFile}/>
        <p className="text-3xl mb-2">{file?'📄':'📎'}</p>
        {file ? (
          <div>
            <p className="font-black text-sky-700 text-[13px]">{file.name}</p>
            <p className="text-[10px] text-sky-600 mt-0.5">{(file.size/1024).toFixed(1)} KB · clique para trocar</p>
          </div>
        ) : (
          <div>
            <p className="font-bold text-gray-600 text-[13px]">Arraste o PDF do Wyscout aqui</p>
            <p className="text-[10px] text-gray-400 mt-1">ou clique para selecionar · Players in Match Report</p>
          </div>
        )}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-[11px] text-red-600 font-bold">{erro}</p>
        </div>
      )}
      {resultado && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
          <p className="text-[11px] text-sky-700 font-black">
            ✅ {resultado.salvos} jogadores extraídos com sucesso! Calculando correlação...
          </p>
          {resultado.jogadores && (
            <p className="text-[9px] text-sky-600 mt-1">
              {resultado.jogadores.map(j=>j.jogador).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[9px] text-gray-400">Sessão: {session.titulo}</p>
        <button
          onClick={enviar} disabled={loading||!file}
          className="bg-sky-700 hover:bg-sky-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest px-8 py-2.5 rounded-xl transition-all flex items-center gap-2"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>{progress||'Processando...'}</>
          ) : '⚡ Extrair e Calcular'}
        </button>
      </div>
    </div>
  )
}

// ── ANÁLISE ───────────────────────────────────────────────────────────────────
function Analise({ dataset, sessionInfo, onEditar }) {
  const [sx,setSx]=useState('hsr_p90'),[sy,setSy]=useState('interc_p90')
  const [minF,setMinF]=useState(20),[posF,setPosF]=useState('Todos')

  const filtered=useMemo(()=>dataset.filter(d=>d.min>=minF&&(posF==='Todos'||d.pos===posF)),[dataset,minF,posF])
  const matrix=useMemo(()=>GPS_METRICS.map(gm=>({gps:gm,perfs:PERF_METRICS.map(pm=>({perf:pm,r:pearsonR(filtered,gm.key,pm.key)}))})),[filtered])
  const scatter=useMemo(()=>{
    const gm=GPS_METRICS.find(g=>g.key===sx),pm=PERF_METRICS.find(p=>p.key===sy)
    return{pts:filtered.map(d=>({...d,_x:d[sx],_y:d[sy]})),r:pearsonR(filtered,sx,sy),xl:gm?.label||sx,yl:pm?.label||sy}
  },[filtered,sx,sy])
  const posGroups=useMemo(()=>[...new Set(dataset.map(d=>d.pos))].map(pos=>{
    const g=dataset.filter(d=>d.pos===pos),avg=k=>g.reduce((s,d)=>s+d[k],0)/g.length
    return{pos,label:POS_LABEL[pos]||pos,color:POS_COLOR[pos]||'#888',n:g.length,
      hsr:+avg('hsr_p90').toFixed(0),sprint:+avg('sprint_p90').toFixed(0),
      accel:+avg('accel_p90').toFixed(1),decel:+avg('decel_p90').toFixed(1)}
  }),[dataset])
  const insights=useMemo(()=>{
    const p=[];matrix.forEach(r=>r.perfs.forEach(c=>p.push({gps:r.gps.label,perf:c.perf.label,r:c.r})))
    return p.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r)).slice(0,6)
  },[matrix])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-900 to-sky-700 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-sky-300 text-[10px] font-black uppercase tracking-widest mb-1">GPS x Wyscout · Analise Automatica</p>
            <h2 className="text-2xl font-black uppercase">Correlacao GPS x Desempenho</h2>
            <p className="text-sky-200 text-xs mt-1">{sessionInfo}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] text-sky-300 uppercase">Atletas</p>
              <p className="text-3xl font-black">{filtered.length}</p>
              <p className="text-[9px] text-sky-300">GPS + Wyscout</p>
            </div>
            <button onClick={onEditar} className="text-[9px] font-black uppercase text-white/60 hover:text-white border border-white/20 hover:border-white/50 px-3 py-1.5 rounded-xl transition-all">
              Novo PDF
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
            <span className="text-[9px] text-sky-200 uppercase">Min.</span>
            {[20,30,45,60].map(v=>(
              <button key={v} onClick={()=>setMinF(v)}
                className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${minF===v?'bg-white text-sky-900':'text-white hover:bg-white/20'}`}>
                {v}'
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
            <span className="text-[9px] text-sky-200 uppercase">Pos.</span>
            {['Todos',...Object.keys(POS_LABEL)].map(p=>(
              <button key={p} onClick={()=>setPosF(p)}
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${posF===p?'bg-white text-sky-900':'text-white hover:bg-white/20'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matriz */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-[15px] font-black uppercase text-gray-900 mb-1">Matriz de Correlacao</h3>
        <p className="text-[10px] text-gray-400 mb-4">Pearson r · n={filtered.length} atletas · clique na célula para ver scatter</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="text-left text-gray-400 font-black text-[9px] uppercase pb-3 pr-3 w-44">GPS \ Desempenho</th>
                {PERF_METRICS.map(pm=>(
                  <th key={pm.key} className="text-center text-gray-500 font-black text-[9px] uppercase pb-3 px-1 min-w-[80px]">{pm.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row,ri)=>(
                <tr key={row.gps.key} className={ri%2===0?'bg-gray-50/50':''}>
                  <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap text-[11px]" style={{borderLeft:`3px solid ${row.gps.color}`,paddingLeft:8}}>
                    {row.gps.label}
                  </td>
                  {row.perfs.map(cell=>(
                    <td key={cell.perf.key} className="py-1.5 px-1 text-center">
                      <button onClick={()=>{setSx(row.gps.key);setSy(cell.perf.key)}}
                        className="w-full rounded-lg py-1.5 px-1 font-black transition-all hover:scale-105 text-[11px]"
                        style={{background:rBg(cell.r),color:rColor(cell.r)}}>
                        {cell.r>0?'+':''}{cell.r.toFixed(2)}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scatter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-[15px] font-black uppercase text-gray-900">Scatter Plot</h3>
            <p className="text-[10px] text-gray-400">Cada ponto = 1 atleta · cor por posicao</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400 uppercase">r</p>
            <p className="text-2xl font-black" style={{color:rColor(scatter.r)}}>{scatter.r>0?'+':''}{scatter.r.toFixed(2)}</p>
            <p className="text-[9px] font-black" style={{color:rColor(scatter.r)}}>{rLabel(scatter.r)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[9px] text-gray-400 uppercase font-black block mb-1">Eixo X — GPS</label>
            <select value={sx} onChange={e=>setSx(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[11px] font-bold text-gray-700 bg-gray-50 focus:outline-none focus:border-sky-500">
              {GPS_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase font-black block mb-1">Eixo Y — Desempenho</label>
            <select value={sy} onChange={e=>setSy(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[11px] font-bold text-gray-700 bg-gray-50 focus:outline-none focus:border-sky-500">
              {PERF_METRICS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{top:10,right:20,bottom:20,left:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="_x" type="number" label={{value:scatter.xl,position:'insideBottom',offset:-10,fontSize:9,fill:'#94a3b8'}} tick={{fontSize:9,fill:'#94a3b8'}}/>
              <YAxis dataKey="_y" type="number" label={{value:scatter.yl,angle:-90,position:'insideLeft',offset:10,fontSize:9,fill:'#94a3b8'}} tick={{fontSize:9,fill:'#94a3b8'}}/>
              <ZAxis range={[55,55]}/>
              <Tooltip content={({active,payload})=>{
                if(!active||!payload?.length)return null
                const d=payload[0]?.payload
                return(
                  <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                    <p className="font-black text-gray-900 mb-1">{d?.nome}</p>
                    <p className="text-gray-500">{POS_LABEL[d?.pos]||d?.pos} · {d?.min}'</p>
                    <p className="mt-1"><span className="text-gray-400">{scatter.xl}:</span> <b>{d?._x}</b></p>
                    <p><span className="text-gray-400">{scatter.yl}:</span> <b>{d?._y}</b></p>
                  </div>
                )
              }}/>
              {Object.keys(POS_COLOR).map(pos=>{
                const pts=scatter.pts.filter(d=>d.pos===pos)
                if(!pts.length)return null
                return<Scatter key={pos} data={pts} name={POS_LABEL[pos]} fill={POS_COLOR[pos]} fillOpacity={0.85}/>
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {Object.entries(POS_LABEL).map(([k,v])=>(
            <span key={k} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{background:POS_COLOR[k]}}/>
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Radar por posição */}
      {posGroups.length>0&&(
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-[15px] font-black uppercase text-gray-900 mb-4">Perfil GPS por Posicao</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {posGroups.map(pg=>{
              const rd=[
                {label:'HSR',value:Math.min(pg.hsr/1500*100,100)},
                {label:'Sprint',value:Math.min(pg.sprint/600*100,100)},
                {label:'Acel.',value:Math.min(pg.accel/60*100,100)},
                {label:'Desac.',value:Math.min(pg.decel/80*100,100)},
              ]
              return(
                <div key={pg.pos} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{background:pg.color}}/>
                    <span className="text-[12px] font-black uppercase text-gray-800">{pg.label}</span>
                    <span className="text-[9px] text-gray-400 ml-auto">n={pg.n}</span>
                  </div>
                  <div className="h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={rd} cx="50%" cy="50%" outerRadius="65%">
                        <PolarGrid stroke="#e2e8f0"/>
                        <PolarAngleAxis dataKey="label" tick={{fontSize:8,fill:'#94a3b8'}}/>
                        <Radar dataKey="value" stroke={pg.color} fill={pg.color} fillOpacity={0.25}/>
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {[['HSR',pg.hsr+'m'],['Sprint',pg.sprint+'m'],['Acel.',pg.accel],['Desac.',pg.decel]].map(([k,v])=>(
                      <div key={k} className="flex justify-between text-[10px]">
                        <span className="text-gray-400">{k} p90</span>
                        <span className="font-black text-gray-700">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-[15px] font-black uppercase text-gray-900 mb-4">Insights Principais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins,i)=>(
            <div key={i} className="rounded-xl p-3 border flex items-start gap-3" style={{background:rBg(ins.r),borderColor:rColor(ins.r)+'40'}}>
              <div className="text-center min-w-[48px]">
                <p className="text-xl font-black" style={{color:rColor(ins.r)}}>{ins.r>0?'+':''}{ins.r.toFixed(2)}</p>
                <p className="text-[8px] font-black uppercase" style={{color:rColor(ins.r)}}>{rLabel(ins.r)}</p>
              </div>
              <div>
                <p className="text-[11px] font-black text-gray-800">{ins.gps}</p>
                <p className="text-[9px] text-gray-400">x</p>
                <p className="text-[11px] font-bold text-gray-700">{ins.perf}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-[15px] font-black uppercase text-gray-900 mb-4">Dados Consolidados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Atleta','Pos','Min','Dist p90','HSR p90','Sprint p90','Acel','Duelos p90','Duelos W%','Intercep.','Passes%','Acoes W%'].map(h=>(
                  <th key={h} className="text-left py-2 px-2 text-[9px] font-black uppercase text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtered].sort((a,b)=>b.min-a.min).map((p,i)=>(
                <tr key={p.nome} className={`border-b border-gray-50 ${i%2===0?'bg-gray-50/30':''} hover:bg-sky-50/30`}>
                  <td className="py-2 px-2 font-bold text-gray-800 whitespace-nowrap">{p.nome}</td>
                  <td className="py-2 px-2"><span className="rounded-full px-1.5 py-0.5 text-[9px] font-black text-white" style={{background:POS_COLOR[p.pos]||'#888'}}>{p.pos}</span></td>
                  <td className="py-2 px-2 text-gray-500">{p.min}'</td>
                  <td className="py-2 px-2 font-bold text-gray-700">{(p.dist_p90/1000).toFixed(2)}k</td>
                  <td className="py-2 px-2 font-bold" style={{color:p.hsr_p90>800?G.verde:p.hsr_p90>500?G.amber:G.slate}}>{p.hsr_p90}</td>
                  <td className="py-2 px-2 font-bold" style={{color:p.sprint_p90>300?G.verde:p.sprint_p90>150?G.amber:G.slate}}>{p.sprint_p90}</td>
                  <td className="py-2 px-2 text-gray-700">{p.accel_p90}</td>
                  <td className="py-2 px-2 text-gray-700">{p.duelos_p90}</td>
                  <td className="py-2 px-2 font-bold" style={{color:p.duelosW_pct>=60?G.verde:p.duelosW_pct>=45?G.amber:G.red}}>{p.duelosW_pct}%</td>
                  <td className="py-2 px-2 text-gray-700">{p.interc_p90}</td>
                  <td className="py-2 px-2 font-bold" style={{color:p.passesC_pct>=80?G.verde:p.passesC_pct>=65?G.amber:G.red}}>{p.passesC_pct}%</td>
                  <td className="py-2 px-2 font-bold" style={{color:p.acoesW_pct>=60?G.verde:p.acoesW_pct>=45?G.amber:G.red}}>{p.acoesW_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-gray-300 mt-3">* p90 = valor × (90/min jogados) · GPS: Catapult · Desempenho: Wyscout PDF</p>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function TabCorrelacao({ session }) {
  const [loading,setLoading]       = useState(true)
  const [desempRows,setDesempRows] = useState(null)
  const [uploadMode,setUploadMode] = useState(false)
  const [error,setError]           = useState('')

  const gpsRows = useMemo(()=>{
    if(!session?.rows)return[]
    const p=typeof session.rows==='string'?JSON.parse(session.rows):session.rows
    return p.rows||[]
  },[session])

  const fetchDesempenho = useCallback(async()=>{
    if(!session?.id)return
    setLoading(true);setError('')
    try{
      const res=await fetch(`/api/gps/desempenho?session_id=${session.id}`)
      const data=await res.json()
      setDesempRows(data.rows||[])
    }catch(e){setError('Erro ao buscar dados.');setDesempRows([])}
    finally{setLoading(false)}
  },[session?.id])

  useEffect(()=>{fetchDesempenho()},[fetchDesempenho])

  const dataset=useMemo(()=>{
    if(!desempRows?.length||!gpsRows.length)return[]
    return buildDataset(gpsRows,desempRows)
  },[gpsRows,desempRows])

  const sessionInfo=session?`${session.titulo} · ${session.data_sessao||''}`  :''

  if(!session)return(
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-5xl mb-4">🔗</p>
      <p className="text-xl font-black uppercase text-gray-700">Selecione uma sessao de jogo</p>
      <p className="text-[11px] text-gray-400 mt-2">Escolha uma sessao na lista lateral para analisar a correlacao GPS x Desempenho</p>
    </div>
  )

  if(loading)return(
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-4"/>
      <p className="text-[12px] text-gray-400 font-bold">Verificando dados...</p>
    </div>
  )

  if(error)return(
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-4xl mb-3">⚠️</p>
      <p className="text-red-500 font-bold text-sm">{error}</p>
      <button onClick={fetchDesempenho} className="mt-4 text-[11px] font-black uppercase text-sky-700 border border-sky-200 px-4 py-2 rounded-xl">
        Tentar novamente
      </button>
    </div>
  )

  if(!desempRows?.length||uploadMode)return(
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-black uppercase text-gray-900">{uploadMode?'Atualizar Dados':'Upload PDF Wyscout'}</h3>
            <p className="text-[11px] text-gray-400">{sessionInfo}</p>
          </div>
          {uploadMode&&(
            <button onClick={()=>setUploadMode(false)} className="text-[10px] font-black uppercase text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50">
              Cancelar
            </button>
          )}
        </div>
        <UploadPanel session={session} onSucesso={()=>{setUploadMode(false);fetchDesempenho()}}/>
      </div>
    </div>
  )

  if(!dataset.length)return(
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <p className="text-4xl mb-3">🔎</p>
      <p className="text-lg font-black uppercase text-gray-700">Nenhum match encontrado</p>
      <p className="text-[11px] text-gray-400 mt-2 mb-4">
        Os nomes do PDF Wyscout nao coincidiram com os nomes no GPS.<br/>
        Verifique se a sessao GPS corresponde ao mesmo jogo.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={()=>setUploadMode(true)} className="bg-sky-700 text-white text-[11px] font-black uppercase px-5 py-2 rounded-xl">
          Tentar outro PDF
        </button>
        <button onClick={fetchDesempenho} className="border border-gray-200 text-gray-600 text-[11px] font-black uppercase px-5 py-2 rounded-xl hover:bg-gray-50">
          Recarregar
        </button>
      </div>
      <details className="mt-4 text-left">
        <summary className="text-[9px] text-gray-400 cursor-pointer">Debug: nomes do Wyscout ({desempRows.length})</summary>
        <div className="mt-2 space-y-0.5">
          {desempRows.map(r=><p key={r.id} className="text-[9px] text-gray-500">{r.jogador} ({r.minutos}')</p>)}
        </div>
      </details>
    </div>
  )

  return<Analise dataset={dataset} sessionInfo={sessionInfo} onEditar={()=>setUploadMode(true)}/>
}
