'use client'
import { useState, useEffect } from 'react'

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '')
    .trim().replace(/\s+/g, ' ')
}

export function PhotoSelectorModal({
  isOpen,
  playerName,
  currentPhoto = null,
  onPhotoSelect = () => {},
  onClose = () => {},
}) {
  const [search, setSearch]   = useState('')
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setSearch('')
    setLoading(true)
    fetch('/api/photos')
      .then(r => r.json())
      .then(d => setPhotos(d.photos || []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen || !playerName) return null

  const filtered = photos.filter(p =>
    norm(p.canonical_name).includes(norm(search)) ||
    norm(p.filename || '').includes(norm(search))
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-black uppercase tracking-wide">Foto do Jogador</h2>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors text-xl font-bold">
                ✕
              </button>
            </div>
            <p className="text-teal-100 text-sm">
              Selecione a foto para: <strong className="text-white">{playerName}</strong>
            </p>
          </div>

          {/* SEARCH */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <input
              type="text"
              placeholder="Buscar foto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </div>

          {/* GRID */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">

                {/* SEM FOTO */}
                <button
                  onClick={() => { onPhotoSelect(null); onClose() }}
                  className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all
                    ${!currentPhoto ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center bg-gray-100">
                    <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold text-center text-gray-600 leading-tight">Sem Foto</p>
                </button>

                {/* FOTOS */}
                {filtered.map(photo => {
                  const isSelected = currentPhoto === photo.url
                  return (
                    <button
                      key={photo.id}
                      onClick={() => { onPhotoSelect(photo.url); onClose() }}
                      className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all hover:shadow-md
                        ${isSelected ? 'border-teal-500 bg-teal-50 shadow-md' : 'border-gray-200 hover:border-teal-300'}`}
                      title={photo.canonical_name}
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={photo.url}
                          alt={photo.canonical_name}
                          className="w-full h-full object-cover object-top"
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      </div>
                      <p className="text-[9px] font-bold text-gray-700 text-center line-clamp-2 leading-tight">
                        {photo.canonical_name}
                      </p>
                    </button>
                  )
                })}

                {filtered.length === 0 && !loading && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-gray-400 text-lg">Nenhuma foto encontrada</p>
                    <p className="text-gray-300 text-sm mt-1">Tente outro nome ou adicione fotos na página Fotos</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-between">
            <p className="text-[9px] text-gray-400 uppercase tracking-widest">{photos.length} fotos disponíveis</p>
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
