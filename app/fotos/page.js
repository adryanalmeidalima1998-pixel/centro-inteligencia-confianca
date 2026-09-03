'use client'
import { useState, useEffect, useRef } from 'react'
import AppShell from '../components/layout/AppShell'
import { invalidatePhotos } from '../hooks/usePhotos'

const STYLE = `
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
  .drop-active { border-color: #ec4899 !important; background: #fdf2f8 !important; }
  .delete-btn { opacity: 1; transition: transform 0.15s, background-color 0.15s; }
  .delete-btn:hover { transform: scale(1.08); }
  .photo-card:hover .download-btn { opacity: 1; }
  .download-btn { opacity: 0; transition: opacity 0.15s; }
`

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

function guessName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')          // tira extensão
    .replace(/^(?:GUA|CON|ADC)_/i, '')            // tira prefixo GUA_
    .replace(/-removebg-preview$/i, '') // tira sufixo removebg
    .replace(/_\d+$/, '')             // tira sufixo _4, _6, etc
    .replace(/[_-]/g, ' ')            // _ e - viram espaço
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── CARD DE PREVIEW (foto pendente) ─────────────────────────────────────────
function PendingCard({ item, onChange, onRemove, onSave, uploading }) {
  const { filename, previewUrl, name, done, error } = item
  const busy = uploading === filename

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all
      ${done ? 'border-sky-200 bg-sky-50' : error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>

      {/* Foto */}
      <div className="relative">
        <img src={previewUrl} alt={filename}
          className="w-full h-28 object-cover object-top" />
        <div className="absolute top-1.5 right-1.5 flex gap-1">
          {done && <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-500 text-white shadow-sm">✓ Salva</span>}
          {error && <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500 text-white shadow-sm">Erro</span>}
          {!done && (
            <button onClick={() => onRemove(filename)}
              className="w-5 h-5 rounded-full bg-black/40 text-white text-[9px] flex items-center justify-center hover:bg-black/70 transition-colors">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {done ? (
          <p className="text-[10px] font-bold text-sky-700 truncate">{name}</p>
        ) : (
          <>
            <input
              type="text"
              value={name}
              onChange={e => onChange(filename, e.target.value)}
              placeholder="Nome do atleta..."
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[9px] outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-100 bg-white transition-colors"
            />
            <button
              disabled={busy || !name.trim()}
              onClick={() => onSave(filename)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {busy
                ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Salvar</>
              }
            </button>
            {error && <p className="text-[8px] text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function FotosPage() {
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)

  const [pending,   setPending]   = useState([])  // fotos aguardando salvar
  const [uploading, setUploading] = useState(null) // filename sendo salvo

  const [gallery,  setGallery]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState(null)

  // ── GALERIA ───────────────────────────────────────────────────────────────
  async function loadGallery() {
    setLoading(true)
    try {
      const res  = await fetch('/api/photos')
      const data = await res.json()
      setGallery(data.photos || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadGallery() }, [])

  // ── PROCESSAR ARQUIVOS SELECIONADOS ────────────────────────────────────────
  function processFiles(files) {
    const valid = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return IMAGE_EXTS.includes(ext)
    })
    if (!valid.length) return

    const newItems = valid.map(file => ({
      filename: file.name,
      file,
      previewUrl: URL.createObjectURL(file),
      name: guessName(file.name),
      done: false,
      error: null,
    }))

    // Não adiciona duplicatas pelo filename
    setPending(prev => {
      const existing = new Set(prev.map(i => i.filename))
      return [...prev, ...newItems.filter(i => !existing.has(i.filename))]
    })
  }

  // ── DRAG & DROP ───────────────────────────────────────────────────────────
  function onDragOver(e) { e.preventDefault(); setDragging(true) }
  function onDragLeave() { setDragging(false) }
  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    processFiles(e.dataTransfer.files)
  }

  // ── NOME ──────────────────────────────────────────────────────────────────
  function handleNameChange(filename, value) {
    setPending(prev => prev.map(i => i.filename === filename ? { ...i, name: value } : i))
  }

  function handleRemove(filename) {
    setPending(prev => {
      const item = prev.find(i => i.filename === filename)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(i => i.filename !== filename)
    })
  }

  // ── SALVAR INDIVIDUAL ─────────────────────────────────────────────────────
  async function handleSave(filename) {
    const item = pending.find(i => i.filename === filename)
    if (!item || !item.name.trim()) return

    setUploading(filename)
    try {
      const fd = new FormData()
      fd.append('file', item.file, item.filename)
      fd.append('canonical_name', item.name.trim())
      const res = await fetch('/api/photos', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      setPending(prev => prev.map(i => i.filename === filename ? { ...i, done: true, error: null } : i))
      invalidatePhotos()
      loadGallery()
    } catch (e) {
      setPending(prev => prev.map(i => i.filename === filename ? { ...i, error: e.message } : i))
    } finally {
      setUploading(null)
    }
  }

  // ── SALVAR TODAS PENDENTES ─────────────────────────────────────────────────
  async function handleSaveAll() {
    const unsaved = pending.filter(i => !i.done && i.name.trim())
    for (const item of unsaved) {
      await handleSave(item.filename)
    }
  }

  // ── DELETAR DA GALERIA ────────────────────────────────────────────────────
  async function handleDelete(photo) {
    const label = photo?.canonical_name || 'essa foto'
    if (!confirm(`Excluir a foto de ${label}?`)) return
    setDeleting(String(photo.id))
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setGallery(prev => prev.filter(item => String(item.id) !== String(photo.id)))
      invalidatePhotos()
      await loadGallery()
    } catch (err) {
      alert(`Não foi possível excluir a foto: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  // ── BAIXAR FOTO ───────────────────────────────────────────────────────────
  async function handleDownload(url, name) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = name.replace(/\s+/g, '_') + '.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      alert('Erro ao baixar a foto.')
    }
  }

  // ── LIMPAR CONCLUÍDAS ─────────────────────────────────────────────────────
  function clearDone() {
    setPending(prev => {
      prev.filter(i => i.done).forEach(i => URL.revokeObjectURL(i.previewUrl))
      return prev.filter(i => !i.done)
    })
  }

  const doneCount   = pending.filter(i => i.done).length
  const unsaved     = pending.filter(i => !i.done)

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm h-screen overflow-y-auto bg-gray-50">
        <div className="p-6 max-w-7xl mx-auto">

          {/* HEADER */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-400">Galeria do Elenco</p>
            </div>
            <h1 className="bc text-4xl font-black uppercase text-gray-900 leading-none">FOTOS</h1>
            <p className="text-sm text-gray-400 mt-1">
              {loading ? 'Carregando...' : `${gallery.length} foto${gallery.length !== 1 ? 's' : ''} salva${gallery.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* INFO */}
          <div className="mb-6 bg-pink-50 border border-pink-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-[9px] font-black">i</span>
            </div>
            <p className="text-sm text-pink-700">
              Faça upload das fotos dos jogadores. Confirme o nome de cada atleta e clique em Salvar.
              Depois, na página de <strong>ELENCO</strong>, clique no avatar para vincular a foto ao jogador.
            </p>
          </div>

          {/* UPLOAD AREA */}
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center">
                  <span className="bc text-sm font-black text-white">1</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">Upload de Fotos</p>
                  <p className="text-[8px] text-gray-400">JPG, PNG ou WEBP · múltiplas ao mesmo tempo</p>
                </div>
              </div>
              {pending.length > 0 && doneCount > 0 && (
                <button onClick={clearDone}
                  className="text-[8px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">
                  Limpar concluídas
                </button>
              )}
            </div>

            {/* DROP ZONE */}
            <div
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${dragging ? 'drop-active' : 'border-pink-300 hover:bg-pink-50'}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={e => { processFiles(e.target.files); e.target.value = '' }}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                className={`w-10 h-10 transition-colors ${dragging ? 'text-pink-600' : 'text-pink-400'}`}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div className="text-center">
                <p className={`bc text-lg font-black uppercase transition-colors ${dragging ? 'text-pink-700' : 'text-pink-500'}`}>
                  {dragging ? 'Solte aqui' : 'Clique ou arraste as fotos'}
                </p>
                <p className="text-[9px] text-gray-400 mt-1">Selecione quantas quiser de uma vez</p>
              </div>
            </div>

            {/* PENDING GRID */}
            {pending.length > 0 && (
              <div className="mt-4 space-y-3">
                {/* BARRA DE STATUS */}
                <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest">
                    {doneCount > 0 && <span className="text-sky-600">✓ {doneCount} salvas</span>}
                    {unsaved.length > 0 && <><span className="text-gray-300">•</span><span className="text-gray-600">{unsaved.length} pendentes</span></>}
                  </div>
                  {unsaved.length > 1 && (
                    <button onClick={handleSaveAll}
                      disabled={!!uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 text-white text-[8px] font-black uppercase tracking-widest hover:bg-pink-700 transition-colors disabled:opacity-40">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Salvar todas ({unsaved.length})
                    </button>
                  )}
                </div>

                {/* CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {pending.map(item => (
                    <PendingCard
                      key={item.filename}
                      item={item}
                      onChange={handleNameChange}
                      onRemove={handleRemove}
                      onSave={handleSave}
                      uploading={uploading}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GALERIA */}
          {gallery.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">
                    Galeria — {gallery.length} foto{gallery.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[8px] text-gray-400">Clique nos cards do ELENCO para associar as fotos aos jogadores</p>
                </div>
                <button onClick={loadGallery}
                  className="text-[8px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                    <path d="M23 4v6h-6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/><path d="M1 20v-6h6"/>
                  </svg>
                  Atualizar
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                {gallery.map(p => (
                  <div key={p.id} className="photo-card relative group">
                    <div className="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                      <img src={p.url} alt={p.canonical_name}
                        className="w-full h-full object-cover object-top" />
                    </div>
                    <p className="text-[7px] font-bold text-gray-600 mt-1 truncate text-center" title={p.canonical_name}>
                      {p.canonical_name.split(' ')[0]}
                    </p>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deleting === String(p.id)}
                      title="Excluir foto"
                      className="delete-btn absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-wait">
                      {deleting === String(p.id) ? '…' : '✕'}
                    </button>
                    <button
                      onClick={() => handleDownload(p.url, p.canonical_name)}
                      className="download-btn absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm hover:bg-blue-600"
                      title="Baixar foto">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMPTY */}
          {!loading && gallery.length === 0 && pending.length === 0 && (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center gap-3">
              <p className="text-5xl">📸</p>
              <p className="bc text-xl font-black uppercase text-gray-400">Nenhuma foto ainda</p>
              <p className="text-sm text-gray-400">Use a área de upload acima para adicionar fotos do elenco</p>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
