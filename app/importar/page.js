'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'
import Papa from 'papaparse'

/* ─── Configuração de posições ─── */
const POSICOES_MERCADO = [
  { label: 'Centroavante',    col: 'Centroavante' },
  { label: 'Extremo Direito', col: 'Extremo Direito' },
  { label: 'Extremo Esquerdo',col: 'Extremo Esquerdo' },
  { label: 'Goleiro',         col: 'Goleiro' },
  { label: 'Lateral Direito', col: 'Lateral Direito' },
  { label: 'Lateral Esquerdo',col: 'Lateral Esquerdo' },
  { label: 'Meia Central',    col: 'Meia Central' },
  { label: 'Volante',         col: 'Volante' },
  { label: 'Zagueiro',        col: 'Zagueiro' },
]

/* ─── Campo de observações ─── */
function Field({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm text-slate-800 font-medium mt-0.5 leading-tight">{String(value)}</p>
    </div>
  )
}

/* ─── Preview modal ─── */
function PreviewModal({ data, tipo, file, onConfirm, onCancel, saving }) {
  const recCfg = (r) => {
    const s=(r||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    if(s==='CONTRATACAO'||s==='RECOMENDADO') return 'bg-[#0a66b7] text-white'
    if(s.includes('NAO')) return 'bg-red-500 text-white'
    return 'bg-amber-500 text-white'
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-800">
              {tipo==='atleta' ? 'Relatório CIC — Atleta' : 'Relatório — Treinador'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">📄 {file.name} · Confirme antes de salvar</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">
          {tipo==='atleta' ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-100">
                <Field label="Nome" value={data.jogador}/>
                <Field label="Clube" value={data.clube}/>
                <Field label="Posição" value={data.posicao}/>
                <Field label="Idade" value={data.idade}/>
                <Field label="Altura" value={data.altura}/>
                <Field label="Pé" value={data.pe_preferido}/>
              </div>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                {data.irc_final!=null&&<div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-center"><p className="bc text-3xl font-black text-[#0a66b7]">{parseFloat(data.irc_final||0).toFixed(1)}</p><p className="text-[9px] text-slate-400 font-semibold mt-0.5">IRC</p></div>}
                {data.recomendacao&&<span className={`text-sm font-black px-4 py-2 rounded-xl ${recCfg(data.recomendacao)}`}>{data.recomendacao}</span>}
              </div>
              {[['Pontos Físicos',data.pontos_fisicos],['Pontos Técnicos',data.pontos_tecnicos],['Pontos Táticos',data.pontos_taticos],['Veredicto',data.veredicto]].map(([l,v])=>
                v?<div key={l} className="bg-slate-50 rounded-xl p-3 mb-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{l}</p><p className="text-xs text-slate-700">{v}</p></div>:null
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-100">
                <Field label="Nome" value={data.nome}/>
                <Field label="Nacionalidade" value={data.nacionalidade}/>
                <Field label="Nascimento" value={data.data_nascimento}/>
              </div>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 flex-wrap">
                {data.recomendacao&&<span className={`text-sm font-black px-4 py-2 rounded-xl ${recCfg(data.recomendacao)}`}>{data.recomendacao}</span>}
                {data.estrelas&&<div className="flex gap-0.5">{[1,2,3,4,5].map(i=><svg key={i} viewBox="0 0 24 24" className={`w-5 h-5 ${i<=data.estrelas?'text-amber-400':'text-slate-200'}`} fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>}
              </div>
              {[['Estilo',data.estilo_jogo],['Forças',data.forcas],['Fraquezas',data.fraquezas]].map(([l,v])=>
                v?<div key={l} className="bg-slate-50 rounded-xl p-3 mb-2"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{l}</p><p className="text-xs text-slate-700">{v}</p></div>:null
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-400">Dados extraídos automaticamente — revise antes de confirmar.</p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl">Cancelar</button>
            <button onClick={onConfirm} disabled={saving}
              className="px-5 py-2 text-sm font-bold bg-[#0a66b7] hover:bg-[#07579e] disabled:opacity-50 text-white rounded-xl flex items-center gap-2">
              {saving?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Salvando...</>:'✓ Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── CSV WYSCOUT UPLOADER ─── */
function CsvWyscoutUploader({ onSuccess }) {
  const [section, setSection] = useState('mercado')
  const [posicao, setPosicao] = useState('Centroavante')
  const [file,    setFile]   = useState(null)
  const [parsed,  setParsed] = useState(null)
  const [step,    setStep]   = useState('idle') // idle | preview | saving | done
  const [result,  setResult] = useState(null)
  const [uploads, setUploads]= useState([])
  const ref = useRef(null)

  useEffect(() => {
    fetch('/api/wyscout').then(r=>r.json()).then(d=>setUploads(d.uploads||[])).catch(()=>{})
  }, [])

  function refreshStatus() {
    fetch('/api/wyscout').then(r=>r.json()).then(d=>setUploads(d.uploads||[])).catch(()=>{})
  }

  function handleFile(f) {
    if (!f) return
    setFile(f); setResult(null); setParsed(null); setStep('idle')
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setResult({ status: 'err', error: 'CSV sem dados.' })
          return
        }
        const players = results.data.map(row => {
          if (section === 'mercado') {
            return { ...row, _posicao_label: posicao }
          }
          return row // elenco: preserve all columns
        })
        setParsed(players)
        setStep('preview')
      },
      error: (err) => setResult({ status: 'err', error: err.message }),
    })
  }

  async function saveToDb() {
    if (!parsed) return
    setStep('saving')
    try {
      const posLabel = section === 'elenco' ? 'elenco' : posicao
      const res = await fetch('/api/wyscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, posicao_label: posLabel, players: parsed }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao salvar')
      setResult({ status: 'ok', count: d.count })
      setStep('done')
      setParsed(null); setFile(null)
      refreshStatus()
      if (onSuccess) onSuccess()
    } catch(err) {
      setResult({ status: 'err', error: err.message })
      setStep('idle')
    }
  }

  async function deleteUpload(sec, pos) {
    await fetch(`/api/wyscout?section=${sec}&posicao=${encodeURIComponent(pos)}`, { method: 'DELETE' })
    refreshStatus()
  }

  const previewRows = parsed ? parsed.slice(0, 5) : []
  const previewCols = previewRows.length ? Object.keys(previewRows[0]).slice(0, 8) : []

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Upload CSV Wyscout</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Importe dados exportados do Wyscout para atualizar o banco de atletas em produção.
          </p>
        </div>
        {uploads.length > 0 && (
          <span className="text-[10px] font-bold bg-[#f0fdf4] border border-green-200 text-[#0a66b7] px-2.5 py-1 rounded-lg flex-shrink-0">
            {uploads.length} seção{uploads.length!==1?'ões':''} no banco
          </span>
        )}
      </div>

      {/* Seleção de seção */}
      <div className="flex gap-2 mt-4 mb-3">
        {[['mercado','📊 Mercado (atletas externos)'],['elenco','⚽ Elenco (plantel Confiança)']].map(([k,l])=>(
          <button key={k} onClick={()=>{setSection(k);setParsed(null);setFile(null);setStep('idle');setResult(null)}}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${section===k?'bg-[#0a66b7] border-[#0a66b7] text-white shadow-sm':'border-slate-200 text-slate-600 hover:border-[#0a66b7]/30 hover:bg-[#f0fdf4]'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Posição (só para mercado) */}
      {section === 'mercado' && (
        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Posição do CSV</label>
          <div className="flex flex-wrap gap-1.5">
            {POSICOES_MERCADO.map(p=>(
              <button key={p.label} onClick={()=>setPosicao(p.label)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${posicao===p.label?'bg-[#0a66b7] text-white shadow-sm':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Cada exportação do Wyscout é por posição. Selecione antes de fazer o upload.</p>
        </div>
      )}

      {/* Upload */}
      <div onClick={()=>ref.current?.click()}
        className="border-2 border-dashed border-slate-200 hover:border-[#0a66b7] rounded-2xl p-7 text-center cursor-pointer transition-colors group mb-4">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-sm font-semibold text-slate-600 group-hover:text-[#0a66b7] transition-colors">
          {file ? file.name : 'Clique para selecionar CSV do Wyscout'}
        </p>
        <p className="text-xs text-slate-400 mt-1">Exportado do Wyscout — formato CSV UTF-8</p>
        <input ref={ref} type="file" accept=".csv,text/csv" className="hidden"
          onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); e.target.value='' }}/>
      </div>

      {/* PREVIEW */}
      {step === 'preview' && parsed && (
        <div className="mb-4 border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-700">
                Preview — {parsed.length.toLocaleString('pt-BR')} atletas · {section==='mercado'?posicao:'Elenco Confiança'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Mostrando {previewCols.length} de {Object.keys(previewRows[0]||{}).length} colunas · primeiras 5 linhas
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"/>
              <span className="text-[10px] font-semibold text-[#0a66b7]">Mapeamento automático</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {previewCols.map(c=>(
                    <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {previewRows.map((row, i)=>(
                  <tr key={i} className="hover:bg-[#f0fdf4] transition-colors">
                    {previewCols.map(c=>(
                      <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[120px] truncate">{row[c]||'—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-[#f0fdf4] border-t border-green-100 flex items-center justify-between">
            <p className="text-xs text-[#0a66b7] font-medium">
              Tudo certo? Isso vai <strong>substituir</strong> os dados atuais de{' '}
              {section==='mercado'?posicao:'Elenco Confiança'} no banco.
            </p>
            <div className="flex gap-2">
              <button onClick={()=>{setStep('idle');setParsed(null);setFile(null)}}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={saveToDb}
                className="px-4 py-1.5 text-xs font-bold bg-[#0a66b7] hover:bg-[#07579e] text-white rounded-lg transition flex items-center gap-1.5">
                ✓ Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saving state */}
      {step === 'saving' && (
        <div className="mb-4 bg-[#f0fdf4] border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-green-200 border-t-[#0a66b7] rounded-full animate-spin flex-shrink-0"/>
          <p className="text-sm font-semibold text-[#0a66b7]">
            Salvando {parsed?.length.toLocaleString('pt-BR')} atletas no banco...
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium ${result.status==='ok'?'bg-green-50 border border-green-200 text-[#0a66b7]':'bg-red-50 border border-red-200 text-red-700'}`}>
          <span className="text-base">{result.status==='ok'?'✅':'❌'}</span>
          {result.status==='ok'
            ? <span><strong>{result.count.toLocaleString('pt-BR')}</strong> atletas salvos com sucesso. O banco foi atualizado — dados estão disponíveis imediatamente.</span>
            : <span>Erro: {result.error}</span>}
        </div>
      )}

      {/* STATUS DOS UPLOADS */}
      {uploads.length > 0 && (
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dados no banco (substituem os arquivos estáticos)</p>
          </div>
          <div className="divide-y divide-slate-50">
            {uploads.map((u,i)=>(
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-2 h-2 rounded-full bg-[#0a66b7] flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-700">{u.posicao_label}</span>
                  <span className="text-[10px] text-slate-400 ml-2">{u.section}</span>
                </div>
                <span className="text-xs font-bold text-[#0a66b7] bg-green-50 px-2 py-0.5 rounded-md">
                  {(u.row_count||0).toLocaleString('pt-BR')} atletas
                </span>
                <span className="text-[10px] text-slate-400">
                  {u.uploaded_at ? new Date(u.uploaded_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : ''}
                </span>
                <button onClick={()=>deleteUpload(u.section, u.posicao_label)}
                  title="Remover do banco (volta ao estático)"
                  className="text-slate-300 hover:text-red-500 transition-colors p-0.5 flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              🗑 Remover uma posição volta ao arquivo estático original (Excel importado na última atualização do sistema).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── PDF UPLOAD SECTION ─── */
function PdfUploadSection({ title, desc, apiExtract, apiSave, tipo }) {
  const [files,   setFiles]  = useState([])
  const [results, setResults]= useState([])
  const [proc,    setProc]   = useState(false)
  const [current, setCurrent]= useState('')
  const [preview, setPreview]= useState(null)
  const [saving,  setSaving] = useState(false)
  const ref = useRef(null)

  async function handleStart() {
    if (!files.length) return
    setProc(true); setResults([])
    for (const file of files) {
      setCurrent(file.name)
      try {
        // Send PDF directly as FormData — conversion to image happens server-side
        const fd = new FormData()
        fd.append('file', file)
        const aiRes = await fetch(apiExtract, { method: 'POST', body: fd })
        const ai = await aiRes.json()
        if (!ai.success||!ai.data) throw new Error(ai.error||'Extração falhou')
        setFiles(prev=>prev.filter(f=>f.name!==file.name))
        setPreview({data:ai.data,file})
        setProc(false)
        return
      } catch(err) {
        setResults(prev=>[...prev,{name:file.name,status:'err',error:err.message}])
      }
    }
    setProc(false); setCurrent('')
  }

  async function handleConfirm() {
    if (!preview) return
    setSaving(true)
    try {
      const fd = new FormData(); fd.append('file',preview.file); fd.append('extracted_data',JSON.stringify(preview.data))
      const save = await fetch(apiSave,{method:'POST',body:fd})
      if (!save.ok){const s=await save.json();throw new Error(s.error||'Erro ao salvar')}
      const nome = tipo==='atleta'?preview.data.jogador:preview.data.nome
      const rec  = preview.data.recomendacao
      setResults(prev=>[...prev,{name:preview.file.name,status:'ok',nome,rec}])
    } catch(err) {
      setResults(prev=>[...prev,{name:preview.file.name,status:'err',error:err.message}])
    } finally {
      setSaving(false); setPreview(null)
      if (files.length>0) { setProc(true); setTimeout(()=>handleStart(),300) }
      else setCurrent('')
    }
  }

  return (
    <>
      {preview&&<PreviewModal data={preview.data} tipo={tipo} file={preview.file} onConfirm={handleConfirm} onCancel={()=>setPreview(null)} saving={saving}/>}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
        <h2 className="text-sm font-bold text-slate-800 mb-1">{title}</h2>
        <p className="text-xs text-slate-400 mb-4">{desc}</p>
        <div onClick={()=>ref.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-[#0a66b7] rounded-2xl p-7 text-center cursor-pointer transition-colors group mb-4">
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-semibold text-slate-600 group-hover:text-[#0a66b7] transition-colors">Clique para selecionar PDFs</p>
          <p className="text-xs text-slate-400 mt-1">Múltiplos arquivos · preview antes de salvar</p>
          <input ref={ref} type="file" accept=".pdf" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files))}/>
        </div>
        {files.length>0&&(<div className="mb-4 space-y-1">{files.map((f,i)=>(
          <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5">
            <span>📄</span><span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
            <span className="text-xs text-slate-400">{(f.size/1024).toFixed(0)} KB</span>
            <button onClick={()=>setFiles(p=>p.filter(x=>x.name!==f.name))} className="text-slate-300 hover:text-red-500">×</button>
          </div>
        ))}</div>)}
        <button onClick={handleStart} disabled={!files.length||proc}
          className="w-full py-3 bg-[#0a66b7] hover:bg-[#07579e] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2">
          {proc?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Extraindo {current}...</>:`Extrair${files.length?` ${files.length} arquivo(s)`:''} automaticamente`}
        </button>
        {results.map((r,i)=>(
          <div key={i} className={`mt-2 flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium ${r.status==='ok'?'bg-green-50 text-[#0a66b7]':'bg-red-50 text-red-700'}`}>
            <span>{r.status==='ok'?'✅':'❌'}</span>
            <span className="flex-1 truncate">{r.nome||r.name}{r.rec?` — ${r.rec}`:''}{r.error||''}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ─── DOCX UPLOAD ─── */
function DocxUpload() {
  const [file,   setFile]   = useState(null)
  const [result, setResult] = useState(null)
  const [proc,   setProc]   = useState(false)
  const [preview,setPreview]= useState(null)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  async function handle() {
    if (!file) return
    setProc(true); setResult(null)
    try {
      const fd = new FormData(); fd.append('file',file)
      const res = await fetch('/api/ai/extract-docx',{method:'POST',body:fd})
      const ai  = await res.json()
      if (!ai.success||!ai.data) throw new Error(ai.error||'Extração falhou')
      setPreview({data:ai.data,file})
    } catch(err) { setResult({status:'err',error:err.message}) }
    finally { setProc(false) }
  }

  async function confirm() {
    if (!preview) return
    setSaving(true)
    try {
      const fd2=new FormData();fd2.append('file',preview.file);fd2.append('extracted_data',JSON.stringify(preview.data))
      const save=await fetch('/api/treinadores',{method:'POST',body:fd2})
      if(!save.ok){const s=await save.json();throw new Error(s.error||'Erro ao salvar')}
      setResult({status:'ok',nome:preview.data.nome,rec:preview.data.recomendacao})
      setPreview(null);setFile(null)
    } catch(err){setResult({status:'err',error:err.message});setPreview(null)}
    finally{setSaving(false)}
  }

  return (
    <>
      {preview&&<PreviewModal data={preview.data} tipo="treinador" file={preview.file} onConfirm={confirm} onCancel={()=>setPreview(null)} saving={saving}/>}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
        <h2 className="text-sm font-bold text-slate-800 mb-1">Relatórios de Treinadores — DOCX</h2>
        <p className="text-xs text-slate-400 mb-4">Upload de relatórios Word (.docx). O texto é extraído e estruturado com pré-visualização antes de salvar.</p>
        <div onClick={()=>ref.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-[#0a66b7] rounded-2xl p-7 text-center cursor-pointer transition-colors group mb-4">
          <div className="text-3xl mb-2">📝</div>
          <p className="text-sm font-semibold text-slate-600 group-hover:text-[#0a66b7] transition-colors">Clique para selecionar DOCX</p>
          <p className="text-xs text-slate-400 mt-1">Formato Word (.docx)</p>
          <input ref={ref} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
            onChange={e=>{if(e.target.files[0])setFile(e.target.files[0]);e.target.value=''}}/>
        </div>
        {file&&(<div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 mb-4">
          <span>📝</span><span className="text-sm text-slate-700 flex-1 truncate">{file.name}</span>
          <span className="text-xs text-slate-400">{(file.size/1024).toFixed(0)} KB</span>
          <button onClick={()=>setFile(null)} className="text-slate-300 hover:text-red-500">×</button>
        </div>)}
        <button onClick={handle} disabled={!file||proc}
          className="w-full py-3 bg-[#0a66b7] hover:bg-[#07579e] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2">
          {proc?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Extraindo...</>:'Extrair dados'}
        </button>
        {result&&(<div className={`mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium ${result.status==='ok'?'bg-green-50 text-[#0a66b7]':'bg-red-50 text-red-700'}`}>
          <span>{result.status==='ok'?'✅':'❌'}</span>
          <span>{result.nome||'Erro'}{result.rec?` — ${result.rec}`:''}{result.error||''}</span>
        </div>)}
      </div>
    </>
  )
}

/* ─── PAGE ─── */
export default function ImportarPage() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  if (!canEdit) {
    return (
      <AppShell>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: '#0a66b7', textTransform: 'uppercase', marginBottom: 8 }}>
            Acesso Restrito
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            Seu perfil não tem permissão para importar dados.
          </p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 max-w-[900px] mx-auto">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Portal de Dados</p>
          <h1 className="bc text-4xl font-black uppercase text-[#0a66b7]">Importar</h1>
          <p className="text-sm text-slate-400 mt-1">Ponto de entrada de todos os dados do sistema</p>
        </div>

        {/* ── 1. CSV WYSCOUT — o mais importante ── */}
        <div className="flex items-center gap-3 mb-3">
          <span className="w-6 h-6 rounded-full bg-[#0a66b7] text-white text-xs font-black flex items-center justify-center flex-shrink-0">1</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Dados de Atletas (CSV Wyscout)</p>
            <p className="text-[10px] text-slate-400">Atualiza o banco de mercado ou elenco · substitui os dados estáticos</p>
          </div>
        </div>
        <CsvWyscoutUploader/>

        {/* ── 2. PDF Lista Final ── */}
        <div className="flex items-center gap-3 mb-3">
          <span className="w-6 h-6 rounded-full bg-slate-400 text-white text-xs font-black flex items-center justify-center flex-shrink-0">2</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Relatórios CIC — Lista Final (PDF)</p>
            <p className="text-[10px] text-slate-400">Extração estruturada com pré-visualização antes de salvar</p>
          </div>
        </div>
        <PdfUploadSection
          title="Relatórios CIC — Lista Final"
          desc="PDFs com IRC, perfil tático e recomendação."
          apiExtract="/api/ai/extract"
          apiSave="/api/lista-final"
          tipo="atleta"
        />

        {/* ── 3. PDF/DOCX Treinadores ── */}
        <div className="flex items-center gap-3 mb-3">
          <span className="w-6 h-6 rounded-full bg-slate-400 text-white text-xs font-black flex items-center justify-center flex-shrink-0">3</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Relatórios de Treinadores (PDF)</p>
            <p className="text-[10px] text-slate-400">Sistemas de jogo, forças/fraquezas e recomendação</p>
          </div>
        </div>
        <PdfUploadSection
          title="Relatórios de Treinadores — PDF"
          desc="PDFs de scouting de treinadores."
          apiExtract="/api/ai/extract-treinador"
          apiSave="/api/treinadores"
          tipo="treinador"
        />

        <div className="flex items-center gap-3 mb-3">
          <span className="w-6 h-6 rounded-full bg-slate-400 text-white text-xs font-black flex items-center justify-center flex-shrink-0">4</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Relatórios de Treinadores (DOCX)</p>
            <p className="text-[10px] text-slate-400">Formato Word — texto extraído e processado automaticamente</p>
          </div>
        </div>
        <DocxUpload/>

        {/* Guia */}
        <div className="bg-[#f0fdf4] border border-green-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#0a66b7] mb-3">Como atualizar os dados de atletas</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {n:'1',t:'Exportar do Wyscout',d:'Vá em Wyscout → Exportar → CSV. Cada aba de posição gera um arquivo separado.'},
              {n:'2',t:'Selecionar seção',d:'Escolha Mercado ou Elenco e selecione a posição correspondente ao arquivo.'},
              {n:'3',t:'Preview automático',d:'O sistema mostra as primeiras 5 linhas e confirma o mapeamento de colunas.'},
              {n:'4',t:'Confirmar',d:'Dados salvos no banco e disponíveis imediatamente. Arquivo estático vira fallback.'},
            ].map(({n,t,d})=>(
              <div key={n} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[#0a66b7] text-white flex items-center justify-center text-xs font-black flex-shrink-0">{n}</div>
                <div><p className="text-xs font-bold text-[#0a66b7]">{t}</p><p className="text-[10px] text-slate-500 mt-0.5">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}