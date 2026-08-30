'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import AppShell from '../components/layout/AppShell'
import BancoDadosTab from './BancoDadosTab'

// ─── CONFIG POR ABA ─────────────────────────────────────────────────────────
const ABAS = {
  campo: {
    tipo:        'treino',
    label:       'Campo',
    labelLong:   'Programação de Campo',
    icon:        '⚽',
    emptyIcon:   '📋',
    btnLabel:    'Novo Plano de Treino',
    uploadTitle: 'Salvar Plano de Treino',
    headerGrad:  'linear-gradient(160deg, #166534 0%, #07579e 100%)',
    accent:      '#0a66b7',
    accentLight: '#f0fdf4',
    accentBorder:'#bbf7d0',
    spinner:     'border-t-sky-500',
    btn:         'bg-sky-600 hover:bg-sky-700',
    btnSec:      'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
    inputFocus:  '#0a66b7',
    dotColor:    'bg-sky-400',
    sidebarScroll: 'scrollbar-green',
  },
  goleiros: {
    tipo:        'goleiros',
    label:       'Goleiros',
    labelLong:   'Treinamento Específico',
    icon:        '🧤',
    emptyIcon:   '🧤',
    btnLabel:    'Nova Sessão de Goleiros',
    uploadTitle: 'Salvar Sessão de Goleiros',
    headerGrad:  'linear-gradient(160deg, #1e3a5f 0%, #1d4ed8 100%)',
    accent:      '#2563eb',
    accentLight: '#eff6ff',
    accentBorder:'#bfdbfe',
    spinner:     'border-t-blue-500',
    btn:         'bg-blue-600 hover:bg-blue-700',
    btnSec:      'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    inputFocus:  '#2563eb',
    dotColor:    'bg-blue-400',
    sidebarScroll: 'scrollbar-blue',
  },
}

const PERIODOS = ['Preparatório', 'Pré-Competitivo', 'Competitivo', 'Transição']

const PERIODO_CFG = {
  'Preparatório':    { bar: '#0a66b7', badge: 'bg-sky-100 text-sky-700'   },
  'Pré-Competitivo': { bar: '#2563eb', badge: 'bg-blue-100 text-blue-700'     },
  'Competitivo':     { bar: '#ea580c', badge: 'bg-orange-100 text-orange-700' },
  'Transição':       { bar: '#7c3aed', badge: 'bg-violet-100 text-violet-700' },
}
const DEF_PERIODO = { bar: '#94a3b8', badge: 'bg-gray-100 text-gray-500' }

// ─── UTILS ───────────────────────────────────────────────────────────────────
function parseDate(raw) {
  if (!raw) return null
  try {
    const d = typeof raw === 'string' && raw.length === 10
      ? new Date(raw + 'T12:00:00')
      : new Date(raw)
    return isNaN(d.getTime()) ? null : d
  } catch { return null }
}
const fmtShort  = r => parseDate(r)?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) ?? '—'
const fmtLong   = r => parseDate(r)?.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) ?? '—'
const fmtWkday  = r => parseDate(r)?.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase() ?? null

function groupByMicrociclo(pdfs) {
  const groups = {}
  pdfs.forEach(pdf => {
    const mc  = pdf.microciclo
    const key = mc ? `Microciclo ${mc}` : (() => {
      const d = parseDate(pdf.data_treino)
      return d ? d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Sem data'
    })()
    ;(groups[key] = groups[key] || []).push(pdf)
  })
  return groups
}

function calcStats(pdfs) {
  const vols  = pdfs.map(p => parseInt(p.volume)).filter(v => !isNaN(v) && v > 0)
  const mcs   = pdfs.map(p => parseInt(p.microciclo)).filter(v => !isNaN(v) && v > 0)
  const cnt   = {}
  pdfs.forEach(p => { if (p.periodo) cnt[p.periodo] = (cnt[p.periodo] || 0) + 1 })
  return {
    total:      pdfs.length,
    avgVol:     vols.length ? Math.round(vols.reduce((a,b) => a+b, 0) / vols.length) : 0,
    maxMC:      mcs.length  ? Math.max(...mcs) : 0,
    topPeriodo: Object.entries(cnt).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '—',
  }
}

function emptyForm() {
  return { titulo: '', data_treino: '', microciclo: '', mesociclo: '', periodo: 'Preparatório', volume: '' }
}

// ─── PDF CARD ─────────────────────────────────────────────────────────────────
function PdfCard({ pdf, isActive, cfg, onClick, onDelete, deleting }) {
  const pcfg = PERIODO_CFG[pdf.periodo] || DEF_PERIODO
  const d    = parseDate(pdf.data_treino)
  const wd   = fmtWkday(pdf.data_treino)

  return (
    <div
      onClick={onClick}
      style={isActive ? { background: cfg.accentLight, borderColor: cfg.accentBorder } : {}}
      className={`mx-2 mb-1.5 rounded-xl border flex overflow-hidden cursor-pointer transition-all group
        ${isActive ? 'shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm hover:translate-x-0.5'}`}
    >
      <div className="w-[3px] rounded-l-none flex-shrink-0" style={{ background: pcfg.bar }} />
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[10px] font-black uppercase leading-tight truncate"
            style={{ color: isActive ? cfg.accent : '#1e293b' }}>
            {pdf.titulo || pdf.nome_arquivo}
          </p>
          <button
            onClick={e => { e.stopPropagation(); onDelete(pdf) }}
            disabled={deleting}
            className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
          >
            {deleting
              ? <div className="w-2.5 h-2.5 border border-gray-300 border-t-transparent rounded-full animate-spin" />
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            }
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {d && (
            <div className="flex items-center gap-1">
              {wd && <span className="text-[7px] font-black px-1 py-0.5 rounded bg-gray-100 text-gray-500">{wd}</span>}
              <span className="text-[9px] text-gray-400">{fmtShort(pdf.data_treino)}</span>
            </div>
          )}
          {pdf.volume    && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">⏱ {pdf.volume}'</span>}
          {pdf.microciclo && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">MC {pdf.microciclo}</span>}
        </div>
        {pdf.periodo && (
          <span className={`inline-block mt-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${pcfg.badge}`}>
            {pdf.periodo}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── DROP ZONE ────────────────────────────────────────────────────────────────
function DropZone({ cfg, onFile, onClickUpload }) {
  const [dragging, setDragging] = useState(false)
  const handle = e => { e.preventDefault(); e.stopPropagation() }

  return (
    <div
      onDragEnter={e => { handle(e); setDragging(true) }}
      onDragLeave={e => { handle(e); setDragging(false) }}
      onDragOver={handle}
      onDrop={e => { handle(e); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') onFile(f) }}
      onClick={onClickUpload}
      style={dragging ? { borderColor: cfg.accent, background: cfg.accentLight } : {}}
      className={`flex-1 flex flex-col items-center justify-center cursor-pointer m-6 rounded-2xl border-2 border-dashed transition-all
        ${dragging ? '' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'}`}
    >
      <div
        className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all ${dragging ? 'scale-110' : ''}`}
        style={{ background: dragging ? cfg.accentLight : 'white', border: dragging ? `2px solid ${cfg.accent}` : '2px dashed #e2e8f0' }}
      >
        <span className={`text-4xl transition-transform ${dragging ? 'animate-bounce' : ''}`}>{cfg.icon}</span>
      </div>
      {dragging ? (
        <>
          <p className="bc text-2xl font-black uppercase" style={{ color: cfg.accent }}>Solte aqui!</p>
          <p className="text-[10px] mt-1" style={{ color: cfg.accent }}>O PDF será salvo automaticamente</p>
        </>
      ) : (
        <>
          <p className="bc text-2xl font-black uppercase text-gray-400">Arraste um PDF aqui</p>
          <p className="text-[10px] text-gray-300 mt-1">ou clique para selecionar</p>
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-[9px] font-black uppercase tracking-widest text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {cfg.btnLabel}
          </div>
        </>
      )}
    </div>
  )
}

// ─── SEÇÃO DE CONTEÚDO (shared entre campo/goleiros) ─────────────────────────
function Section({ cfg, pdfs, loading, selectedPdf, setSelectedPdf, onFileSelect, inputRef }) {
  const [deleting, setDeleting] = useState(null)
  const groups = groupByMicrociclo(pdfs)

  const handleDelete = async pdf => {
    if (!confirm(`Remover "${pdf.titulo || pdf.nome_arquivo}"?`)) return
    setDeleting(pdf.id)
    try {
      await fetch(`/api/pdfs/${pdf.id}`, { method: 'DELETE' })
      // parent will re-fetch
      window.dispatchEvent(new CustomEvent('pdf-deleted', { detail: { id: pdf.id, tipo: cfg.tipo } }))
    } finally { setDeleting(null) }
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className={`w-6 h-6 border-2 border-gray-200 ${cfg.spinner} rounded-full animate-spin`} />
        </div>
      ) : pdfs.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-3xl mb-2">{cfg.emptyIcon}</p>
          <p className="text-[10px] font-bold text-gray-400">Nenhum plano ainda</p>
          <p className="text-[9px] text-gray-300 mt-1">Clique acima para adicionar</p>
        </div>
      ) : (
        Object.entries(groups).map(([grp, items]) => (
          <div key={grp}>
            <div className="flex items-center gap-2 px-4 pt-4 pb-1.5">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400">{grp}</p>
              <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">{items.length}</span>
            </div>
            {items.map(pdf => (
              <PdfCard
                key={pdf.id}
                pdf={pdf}
                cfg={cfg}
                isActive={selectedPdf?.id === pdf.id}
                onClick={() => setSelectedPdf(pdf)}
                onDelete={handleDelete}
                deleting={deleting === pdf.id}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────────
export default function TreinoPage() {
  const [aba, setAba]             = useState('campo')
  const [campoPdfs, setCampoPdfs] = useState([])
  const [golPdfs,   setGolPdfs]   = useState([])
  const [loadC, setLoadC]         = useState(true)
  const [loadG, setLoadG]         = useState(true)
  const [selectedC, setSelectedC] = useState(null)
  const [selectedG, setSelectedG] = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadForm, setUploadForm] = useState(emptyForm())
  const [error, setError]           = useState(null)
  const inputRef = useRef()

  const cfg      = ABAS[aba] || ABAS['campo']
  const pdfs     = aba === 'goleiros' ? golPdfs : campoPdfs
  const selected = aba === 'goleiros' ? selectedG : selectedC
  const setPdfs  = aba === 'goleiros' ? setGolPdfs : setCampoPdfs
  const setSelected = aba === 'goleiros' ? setSelectedG : setSelectedC

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCampo = useCallback(async () => {
    setLoadC(true)
    try {
      const d = await fetch('/api/pdfs?tipo=treino').then(r => r.json())
      setCampoPdfs(d.pdfs || [])
    } catch { setError('Erro ao carregar campo.') } finally { setLoadC(false) }
  }, [])

  const fetchGoleiros = useCallback(async () => {
    setLoadG(true)
    try {
      const d = await fetch('/api/pdfs?tipo=goleiros').then(r => r.json())
      setGolPdfs(d.pdfs || [])
    } catch { setError('Erro ao carregar goleiros.') } finally { setLoadG(false) }
  }, [])

  useEffect(() => { fetchCampo(); fetchGoleiros() }, [fetchCampo, fetchGoleiros])
  useEffect(() => { setUploadForm(f => ({ ...f, data_treino: new Date().toISOString().slice(0, 10) })) }, [])
  useEffect(() => { if (!selectedC && campoPdfs.length > 0) setSelectedC(campoPdfs[0]) }, [campoPdfs])
  useEffect(() => { if (!selectedG && golPdfs.length > 0)   setSelectedG(golPdfs[0]) },  [golPdfs])

  // Ouvir evento de delete do componente Section
  useEffect(() => {
    const handler = e => {
      const { id, tipo } = e.detail
      if (tipo === 'treino') {
        setCampoPdfs(prev => {
          const next = prev.filter(p => p.id !== id)
          if (selectedC?.id === id) setSelectedC(next[0] || null)
          return next
        })
      } else {
        setGolPdfs(prev => {
          const next = prev.filter(p => p.id !== id)
          if (selectedG?.id === id) setSelectedG(next[0] || null)
          return next
        })
      }
    }
    window.addEventListener('pdf-deleted', handler)
    return () => window.removeEventListener('pdf-deleted', handler)
  }, [selectedC, selectedG])

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleFileSelect = file => {
    if (!file || file.type !== 'application/pdf') return
    setUploadFile(file)
    setUploadForm(f => ({ ...f, titulo: f.titulo || file.name.replace('.pdf','').replace(/_/g,' ') }))
    setShowModal(true)
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('tipo', cfg.tipo)
      Object.entries(uploadForm).forEach(([k,v]) => { if (v) fd.append(k,v) })
      const res  = await fetch('/api/pdfs', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')
      setPdfs(prev => [data.pdf, ...prev])
      setSelected(data.pdf)
      setShowModal(false); setUploadFile(null)
      setUploadForm({ ...emptyForm(), data_treino: new Date().toISOString().slice(0, 10) })
    } catch (e) { setError(e.message) } finally { setUploading(false) }
  }

  const stats = calcStats(pdfs)
  const loading = aba === 'goleiros' ? loadG : loadC

  return (
    <AppShell>
      <div className="bc-font flex h-screen overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── ABA BANCO DE DADOS ─────────────────────────────────────── */}
        {aba === 'banco' ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* mini header com toggle */}
            <div className="flex-shrink-0 px-4 pt-3 pb-0" style={{ background: 'linear-gradient(160deg, #166534 0%, #07579e 100%)' }}>
              <div className="flex gap-1 mb-3 p-1 rounded-xl w-fit" style={{ background: 'rgba(0,0,0,0.2)' }}>
                {Object.entries(ABAS).map(([key, c]) => (
                  <button key={key} onClick={() => setAba(key)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                    style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <span>{c.icon}</span>{c.label}
                  </button>
                ))}
                <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                  🗄️ Banco
                </button>
              </div>
            </div>
            <BancoDadosTab />
          </div>
        ) : (

        <>
        {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 flex flex-col overflow-hidden bg-white border-r border-gray-100">

          {/* HEADER DINÂMICO */}
          <div className="flex-shrink-0 px-4 pt-4 pb-4" style={{ background: cfg.headerGrad }}>

            {/* TOGGLE CAMPO / GOLEIROS / BANCO */}
            <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)' }}>
              {Object.entries(ABAS).map(([key, c]) => (
                <button key={key} onClick={() => setAba(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                  style={aba === key
                    ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                    : { color: 'rgba(255,255,255,0.45)' }
                  }
                >
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              ))}
              <button onClick={() => setAba('banco')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                style={aba === 'banco'
                  ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                  : { color: 'rgba(255,255,255,0.45)' }
                }
              >
                <span>🗄️</span>
                Banco
              </button>
            </div>

            {/* LABEL */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
              <p className="text-[8px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Banco de PDFs
              </p>
            </div>
            <p className="bc text-2xl font-black uppercase text-white leading-none mb-3"
               style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {cfg.labelLong}
            </p>

            {/* KPIs */}
            {!loading && pdfs.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Sessões', val: stats.total, sub: null },
                  { label: 'Vol. Médio', val: stats.avgVol > 0 ? stats.avgVol : '—', sub: stats.avgVol > 0 ? 'min/sessão' : null },
                  stats.maxMC > 0 ? { label: 'Microciclo', val: stats.maxMC, sub: 'atual' } : null,
                  stats.topPeriodo !== '—' ? { label: 'Período', val: stats.topPeriodo, isText: true } : null,
                ].filter(Boolean).map(kpi => (
                  <div key={kpi.label} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <p className="text-[7px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>{kpi.label}</p>
                    <p className={`font-black text-white leading-none mt-0.5 ${kpi.isText ? 'text-[11px]' : 'text-xl'}`}
                       style={{ fontFamily: kpi.isText ? 'inherit' : "'Barlow Condensed', sans-serif" }}>
                      {kpi.val}
                    </p>
                    {kpi.sub && <p className="text-[7px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{kpi.sub}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTÃO UPLOAD */}
          <div className="px-3 py-3 border-b border-gray-100 flex-shrink-0">
            <button onClick={() => inputRef.current?.click()}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm ${cfg.btn}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {cfg.btnLabel}
            </button>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => handleFileSelect(e.target.files[0])} />
          </div>

          {error && (
            <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 flex-shrink-0">
              <p className="text-[9px] font-semibold text-red-600">{error}</p>
            </div>
          )}

          {/* LISTA */}
          <Section
            cfg={cfg}
            pdfs={pdfs}
            loading={loading}
            selectedPdf={selected}
            setSelectedPdf={setSelected}
            onFileSelect={handleFileSelect}
            inputRef={inputRef}
          />
        </aside>

        {/* ── VIEWER ────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {selected ? (
            <>
              {/* TOOLBAR */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: cfg.accentLight }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"
                      style={{ stroke: cfg.accent }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-800">
                      {selected.titulo || selected.nome_arquivo}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {selected.data_treino && <span className="text-[9px] text-gray-400">{fmtLong(selected.data_treino)}</span>}
                      {selected.microciclo  && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">MC {selected.microciclo}</span>}
                      {selected.mesociclo   && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Meso {selected.mesociclo}</span>}
                      {selected.volume      && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">⏱ {selected.volume} min</span>}
                      {selected.periodo && (() => {
                        const pc = PERIODO_CFG[selected.periodo] || DEF_PERIODO
                        return <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${pc.badge}`}>{selected.periodo}</span>
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={selected.url} target="_blank" rel="noreferrer"
                    className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                    Abrir em Nova Aba ↗
                  </a>
                  <button onClick={() => inputRef.current?.click()}
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${cfg.btnSec}`}>
                    + {aba === 'campo' ? 'Novo PDF' : 'Nova Sessão'}
                  </button>
                </div>
              </div>

              <iframe key={selected.id} src={selected.url} className="flex-1 w-full"
                title={selected.titulo || cfg.labelLong} />
            </>
          ) : (
            <DropZone cfg={cfg} onFile={handleFileSelect} onClickUpload={() => inputRef.current?.click()} />
          )}
        </main>
      </>
      )}
      </div>

      {/* ── MODAL UPLOAD ──────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-xl font-black uppercase text-gray-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {cfg.uploadTitle}
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5 truncate max-w-xs">{uploadFile?.name}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Título</label>
                <input value={uploadForm.titulo} onChange={e => setUploadForm(f => ({...f, titulo: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 outline-none focus:bg-white transition-colors"
                  style={{ fontFamily: 'inherit' }}
                  placeholder="Ex: Plano de Treino – Quarta-feira" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Data</label>
                  <input type="date" value={uploadForm.data_treino} onChange={e => setUploadForm(f => ({...f, data_treino: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 outline-none focus:bg-white" style={{ fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Volume (min)</label>
                  <input type="number" value={uploadForm.volume} onChange={e => setUploadForm(f => ({...f, volume: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 outline-none focus:bg-white" style={{ fontFamily: 'inherit' }} placeholder="60" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[['microciclo','Microciclo','1'],['mesociclo','Mesociclo','1']].map(([k,l,p]) => (
                  <div key={k}>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">{l}</label>
                    <input value={uploadForm[k]} onChange={e => setUploadForm(f => ({...f, [k]: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 outline-none focus:bg-white" style={{ fontFamily: 'inherit' }} placeholder={p} />
                  </div>
                ))}
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Período</label>
                  <select value={uploadForm.periodo} onChange={e => setUploadForm(f => ({...f, periodo: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 outline-none focus:bg-white cursor-pointer" style={{ fontFamily: 'inherit' }}>
                    {PERIODOS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleUpload} disabled={uploading}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm disabled:opacity-60 ${cfg.btn}`}>
                {uploading && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                {uploading ? 'Salvando...' : 'Salvar no Banco'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
