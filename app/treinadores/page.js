'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'

const REC_CFG = {
  'Recomendado':     { bg:'bg-[#0a66b7] text-white', kpi:'bg-green-50 border-green-200 text-green-700' },
  'Com Ressalvas':   { bg:'bg-amber-500 text-white',  kpi:'bg-amber-50 border-amber-200 text-amber-700' },
  'Não Recomendado': { bg:'bg-red-500 text-white',    kpi:'bg-red-50 border-red-200 text-red-700' },
}

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} viewBox="0 0 24 24" className={`w-4 h-4 ${i<=(n||0)?'text-amber-400':'text-slate-200'}`} fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </div>
  )
}

function CoachCard({ coach, onDelete }) {
  const rc = REC_CFG[coach.recomendacao] || REC_CFG['Não Recomendado']
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0a66b7] to-[#1597d4] flex items-center justify-center text-lg font-black text-white flex-shrink-0">
              {(coach.nome||'?')[0]}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{coach.nome}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{coach.nacionalidade || '—'}</p>
            </div>
          </div>
          <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${rc.bg}`}>{coach.recomendacao || '—'}</span>
        </div>
        <Stars n={coach.estrelas}/>
        {coach.sistemas_jogo?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {coach.sistemas_jogo.slice(0,4).map((s,i) => (
              <span key={i} className="text-[10px] font-semibold bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{s}</span>
            ))}
          </div>
        )}
        {coach.estilo_jogo && <p className="text-xs text-slate-500 mt-3 line-clamp-2">{coach.estilo_jogo}</p>}
        <button onClick={() => setExpanded(!expanded)} className="mt-3 text-[10px] font-semibold text-[#0a66b7] hover:underline">
          {expanded ? 'Menos ↑' : 'Ver detalhes ↓'}
        </button>
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-slate-50 pt-3">
            {[['Histórico', coach.historico_clubes],['Forças', coach.forcas],['Fraquezas', coach.fraquezas]].map(([l,v]) => v ? (
              <div key={l}><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{l}</p><p className="text-xs text-slate-600">{v}</p></div>
            ) : null)}
          </div>
        )}
        {/* PDF embutido quando expandido */}
        {expanded && coach.pdf_filename && (
          <div className="mt-3 border-t border-slate-50 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Relatório Original</p>
              <a href={`/api/treinadores?pdf=${coach.id}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-semibold text-[#0a66b7] hover:underline flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Abrir em nova aba
              </a>
            </div>
            <iframe
              src={`/api/treinadores?pdf=${coach.id}`}
              className="w-full rounded-xl border border-slate-200"
              style={{height: 420}}
              title={`Relatório ${coach.nome}`}
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
          {coach.pdf_filename ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-[#0a66b7] flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {coach.pdf_filename}
              </span>
            </div>
          ) : <span/>}
          <button onClick={() => onDelete(coach.id)} className="text-slate-300 hover:text-red-500 transition p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadSection({ onSuccess }) {
  const [files, setFiles] = useState([])
  const [results, setResults] = useState([])
  const [proc, setProc] = useState(false)
  const [current, setCurrent] = useState('')
  const ref = useRef(null)

  function toBase64(file) {
    return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file) })
  }

  async function handle() {
    if (!files.length) return
    setProc(true); setResults([])
    for (const file of files) {
      setCurrent(file.name)
      try {
        const base64 = await toBase64(file)
        const aiRes = await fetch('/api/ai/extract-treinador', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ pdf_base64: base64 }),
        })
        const ai = await aiRes.json()
        if (!ai.success || !ai.data) throw new Error(ai.error||'Extração falhou')
        const fd = new FormData(); fd.append('file', file); fd.append('extracted_data', JSON.stringify(ai.data))
        const save = await fetch('/api/treinadores', {method:'POST',body:fd})
        if (!save.ok) { const s=await save.json(); throw new Error(s.error||'Erro ao salvar') }
        setResults(p => [...p, {name:file.name,status:'ok',nome:ai.data.nome,rec:ai.data.recomendacao}])
        onSuccess()
      } catch(err) { setResults(p => [...p, {name:file.name,status:'err',error:err.message}]) }
    }
    setProc(false); setCurrent(''); setFiles([])
  }

  return (
    <div className="bg-[#f0fdf4] border border-green-200 rounded-2xl p-5 mb-6">
      <h3 className="text-sm font-bold text-[#0a66b7] mb-3">Upload de Relatório PDF</h3>
      <div onClick={() => ref.current?.click()}
        className="border-2 border-dashed border-green-300 hover:border-[#0a66b7] rounded-xl p-5 text-center cursor-pointer transition mb-3">
        <p className="text-sm font-semibold text-[#0a66b7]">Clique para selecionar PDF(s)</p>
        <input ref={ref} type="file" accept=".pdf" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files))}/>
      </div>
      {files.map((f,i) => <p key={i} className="text-xs text-slate-600 bg-white rounded-lg px-3 py-1.5 border border-slate-100 mb-1">📄 {f.name}</p>)}
      <button onClick={handle} disabled={!files.length||proc}
        className="w-full mt-2 py-2.5 bg-[#0a66b7] hover:bg-[#07579e] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2">
        {proc ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processando {current}...</> : 'Processar dados'}
      </button>
      {results.map((r,i) => (
        <div key={i} className={`mt-2 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2 ${r.status==='ok'?'bg-green-50 text-[#0a66b7]':'bg-red-50 text-red-700'}`}>
          {r.status==='ok'?'✅':'❌'} {r.nome||r.name} {r.rec?`— ${r.rec}`:''} {r.error||''}
        </div>
      ))}
    </div>
  )
}

export default function TreinadoresPage() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  const [coaches, setCoaches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Todos')
  const [showUpload, setShowUpload] = useState(false)

  const load = () => fetch('/api/treinadores').then(r=>r.json()).then(d=>{setCoaches(d.coaches||[]); setLoading(false)})
  useEffect(()=>{load()},[])
  async function remove(id) { if(!confirm('Remover?')) return; await fetch(`/api/treinadores?id=${id}`,{method:'DELETE'}); load() }

  const filtered = coaches.filter(c => filter==='Todos' || c.recomendacao===filter)
  const counts = { Recomendado:coaches.filter(c=>c.recomendacao==='Recomendado').length, 'Com Ressalvas':coaches.filter(c=>c.recomendacao==='Com Ressalvas').length, 'Não Recomendado':coaches.filter(c=>c.recomendacao==='Não Recomendado').length }

  return (
    <AppShell>
      <div className="p-6 max-w-[1100px] mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Scouting Técnico</p>
            <h1 className="bc text-4xl font-black uppercase text-[#0a66b7]">Treinadores</h1>
            <p className="text-sm text-slate-400 mt-1">{coaches.length} treinadores catalogados</p>
          </div>
          {canEdit && (
            <button onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 bg-[#0a66b7] hover:bg-[#07579e] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Importar PDF
            </button>
          )}
        </div>

        {canEdit && showUpload && <UploadSection onSuccess={()=>{load(); setShowUpload(false)}}/>}

        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20}}>
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:16,padding:'16px 20px'}}>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,color:'#15803d',lineHeight:1}}>{counts['Recomendado']||0}</p>
            <p style={{fontSize:12,fontWeight:600,color:'#16a34a',marginTop:4}}>Recomendado</p>
          </div>
          <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:16,padding:'16px 20px'}}>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,color:'#b45309',lineHeight:1}}>{counts['Com Ressalvas']||0}</p>
            <p style={{fontSize:12,fontWeight:600,color:'#d97706',marginTop:4}}>Com Ressalvas</p>
          </div>
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:16,padding:'16px 20px'}}>
            <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,color:'#b91c1c',lineHeight:1}}>{counts['Não Recomendado']||0}</p>
            <p style={{fontSize:12,fontWeight:600,color:'#dc2626',marginTop:4}}>Não Recomendado</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {['Todos','Recomendado','Com Ressalvas','Não Recomendado'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${filter===f?'bg-[#0a66b7] text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f}</button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_,i)=><div key={i} className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse"/>)}
          </div>
        ) : filtered.length===0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-slate-500 font-semibold">Nenhum treinador cadastrado</p>
            <p className="text-sm text-slate-400 mt-1">Importe PDFs usando o botão acima</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c=><CoachCard key={c.id} coach={c} onDelete={remove}/>)}
          </div>
        )}
      </div>
    </AppShell>
  )
}