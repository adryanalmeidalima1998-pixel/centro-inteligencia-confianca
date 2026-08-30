'use client'
import { useState, useRef } from 'react'
import JSZip from 'jszip'
import { invalidatePhotos } from '../../hooks/usePhotos'

const IMAGE_EXTS = ['jpg','jpeg','png','webp','gif']

// ─── PHOTO ITEM ────────────────────────────────────────────────────────────
function PhotoItem({ item, onAssign, onRemove, uploading }) {
  const { filename, previewUrl, assignedTo } = item
  const [nameInput, setNameInput] = useState(assignedTo || filename.replace(/\.[^.]+$/, ''))

  const isUploading = uploading === filename
  const isUploaded = !!assignedTo

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm transition-all
      ${isUploaded ? 'border-sky-200 bg-sky-50' : 'border-gray-200 bg-white'}`}>

      {/* Photo preview */}
      <div className="relative">
        <img src={previewUrl} alt={filename}
          className="w-full h-28 object-cover object-top"/>
        {/* Status badge */}
        <div className="absolute top-1.5 right-1.5">
          {isUploaded
            ? <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-sky-500 text-white shadow-sm">✓ Salva</span>
            : <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-gray-400 text-white shadow-sm">Novo</span>
          }
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Filename */}
        <p className="text-[8px] text-gray-400 truncate" title={filename}>{filename}</p>

        {/* Assigned or input */}
        {isUploaded ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold text-sky-700 leading-tight flex-1 truncate">{assignedTo}</p>
            <button onClick={()=>onRemove(filename)}
              className="text-[8px] text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">✕</button>
          </div>
        ) : (
          <>
            {/* Name input */}
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Nome do atleta..."
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[9px] outline-none transition-colors bg-white
                focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
            />

            {/* Upload button */}
            <button
              disabled={isUploading || !nameInput.trim()}
              onClick={() => onAssign(filename, nameInput.trim())}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors
                bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {isUploading
                ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"/> Enviando...</>
                : <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Salvar
                  </>
              }
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PHOTO MANAGER ────────────────────────────────────────────────────
export default function PhotoManager({ onPhotosUpdated }) {
  const [items, setItems] = useState([])
  const [uploading, setUploading] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const zipRef = useRef()

  // Assign uploaded map { filename -> canonical }
  const [assignedMap, setAssignedMap] = useState({})

  const handleZip = async (file) => {
    if (!file) return
    setProcessing(true)
    setError(null)
    setItems([])
    try {
      const zip = await JSZip.loadAsync(file)
      const newItems = []
      const promises = []
      zip.forEach((path, zipEntry) => {
        if (zipEntry.dir) return
        const filename = path.split('/').pop()
        const ext = filename.split('.').pop().toLowerCase()
        if (!IMAGE_EXTS.includes(ext)) return
        promises.push(
          zipEntry.async('blob').then(blob => {
            const previewUrl = URL.createObjectURL(new Blob([blob], { type: `image/${ext}` }))
            newItems.push({ filename, blob, previewUrl, assignedTo: null })
          })
        )
      })
      await Promise.all(promises)
      setItems(newItems)
    } catch (e) {
      setError('Erro ao processar ZIP: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleAssign = async (filename, canonicalName) => {
    if (!canonicalName) return
    const item = items.find(i => i.filename === filename)
    if (!item) return
    setUploading(filename)
    try {
      const fd = new FormData()
      fd.append('file', item.blob, item.filename)
      fd.append('canonical_name', canonicalName)
      const res = await fetch('/api/photos', { method: 'POST', body: fd })
      
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      
      const d = await res.json()
      setItems(prev => prev.map(i =>
        i.filename === filename ? { ...i, assignedTo: canonicalName } : i
      ))
      setAssignedMap(prev => ({ ...prev, [filename]: canonicalName }))
      invalidatePhotos()
      onPhotosUpdated?.()
    } catch (e) {
      console.error('Erro ao salvar foto:', e)
      setError(e.message || 'Erro ao salvar foto')
    } finally {
      setUploading(null)
    }
  }

  const handleRemove = (filename) => {
    setItems(prev => prev.map(i =>
      i.filename===filename ? {...i, assignedTo: null} : i
    ))
  }

  // Upload all at once
  const handleUploadAll = async () => {
    const unsavedItems = items.filter(i => !i.assignedTo)
    if (unsavedItems.length === 0) return

    for (const item of unsavedItems) {
      const nameInput = item.filename.replace(/\.[^.]+$/, '')
      if (nameInput.trim()) {
        await handleAssign(item.filename, nameInput.trim())
      }
    }
    
    // Apenas notify, não fazer novo fetch (já foi feito no handleAssign)
    if (onPhotosUpdated) {
      setTimeout(() => onPhotosUpdated(), 500)
    }
  }

  const doneCount = items.filter(i => i.assignedTo).length
  const totalCount = items.length

  return (
    <div className="space-y-4">
      {/* ZIP Drop Zone */}
      {items.length === 0 && (
        <div
          className="border-2 border-dashed border-pink-300 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:bg-pink-50 transition-all"
          onClick={() => zipRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleZip(e.dataTransfer.files[0]) }}>
          <input ref={zipRef} type="file" accept=".zip" className="hidden"
            onChange={e => handleZip(e.target.files[0])} />
          {processing
            ? <div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
            : <span className="text-4xl">📦</span>
          }
          <div className="text-center">
            <p className="bc text-lg font-black uppercase text-pink-700">{processing ? 'Processando ZIP…' : 'Solte o ZIP aqui'}</p>
            <p className="text-[9px] text-gray-400 mt-1">JPG, PNG, WEBP aceitos dentro do ZIP</p>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-[10px] text-red-600">{error}</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest">
              <span className="text-sky-600">✓ {doneCount} salvas</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{totalCount - doneCount} pendentes</span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleUploadAll}
                disabled={doneCount === totalCount}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 text-white text-[8px] font-black uppercase tracking-widest hover:bg-pink-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Salvar {totalCount - doneCount}
              </button>
              <button onClick={() => { setItems([]); setError(null) }}
                className="px-3 py-1.5 rounded-xl bg-gray-200 text-gray-600 text-[8px] font-black uppercase tracking-widest hover:bg-gray-300 transition-colors">
                Novo ZIP
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {items.map(item => (
              <PhotoItem
                key={item.filename}
                item={item}
                onAssign={handleAssign}
                onRemove={handleRemove}
                uploading={uploading}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
