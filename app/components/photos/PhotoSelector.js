'use client'
import { useState } from 'react'

export function PhotoSelector({ canonicalName, allPhotos, currentPhoto, onPhotoSelect }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Filtrar fotos pelo search
  const filtered = allPhotos.filter(p =>
    p.canonical_name.toLowerCase().includes(search.toLowerCase())
  )

  // Encontrar foto selecionada
  const selected = allPhotos.find(p => p.filename === currentPhoto)

  const handleSelect = (filename) => {
    onPhotoSelect(canonicalName, filename)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      {/* Botão para abrir seletor */}
      <button
        onClick={() => setOpen(!open)}
        className="text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
        title="Selecionar foto"
      >
        {selected ? '✓ Foto' : '○ Foto'}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-[8px] border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>

          {/* Remover foto */}
          <button
            onClick={() => handleSelect(null)}
            className={`w-full text-left px-3 py-2 text-[7px] font-bold uppercase tracking-widest border-b border-gray-100 ${
              !currentPhoto
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            ✕ Nenhuma
          </button>

          {/* Lista de fotos */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-[7px] text-gray-400">
                Nenhuma foto
              </div>
            ) : (
              filtered.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => handleSelect(photo.filename)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 text-[7px] font-bold uppercase tracking-widest transition-colors ${
                    currentPhoto === photo.filename
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={photo.url}
                        alt={photo.canonical_name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                    <span className="truncate">{photo.canonical_name}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
