'use client'
import { useState, useEffect, useCallback } from 'react'

// Módulo-level cache para evitar múltiplos fetches
let _cache = null
let _fetching = false
const _listeners = new Set()

function normKey(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

async function fetchMapFromDB() {
  if (_fetching) return
  _fetching = true
  try {
    const res = await fetch('/api/photo-map')
    const data = await res.json()
    _cache = data.map || {}
    _listeners.forEach(fn => fn({ ..._cache }))
  } catch (err) {
    console.error('[usePlayerPhotos] Erro ao carregar mapa de fotos:', err)
    _cache = _cache || {}
    _listeners.forEach(fn => fn({ ..._cache }))
  } finally {
    _fetching = false
  }
}

export function usePlayerPhotos() {
  const [photoMap, setPhotoMap] = useState(_cache || {})
  const [loaded, setLoaded]     = useState(_cache !== null)

  useEffect(() => {
    _listeners.add(setPhotoMap)

    if (_cache !== null) {
      setPhotoMap({ ..._cache })
      setLoaded(true)
    } else {
      migrateFromLocalStorage().then(() => {
        fetchMapFromDB().then(() => setLoaded(true))
      })
    }

    return () => { _listeners.delete(setPhotoMap) }
  }, [])

  // Salva associação no banco (agora recebe URL direta)
  const setPhoto = useCallback(async (playerName, photoUrl) => {
    if (!playerName) return

    // Atualiza cache e UI imediatamente (optimistic)
    _cache = { ...(_cache || {}), [playerName]: photoUrl || undefined }
    if (!photoUrl) delete _cache[playerName]
    _listeners.forEach(fn => fn({ ..._cache }))

    // Persiste no banco
    try {
      await fetch('/api/photo-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // filename agora é a URL completa (suporta blob e local)
        body: JSON.stringify({ player_name: playerName, filename: photoUrl || null }),
      })
    } catch (err) {
      console.error('[usePlayerPhotos] Erro ao salvar foto no banco:', err)
    }
  }, [])

  // Retorna URL da foto dado o nome do atleta
  // Suporta: URL completa (https://blob...), path local (/photoplayers/...) ou filename puro (caique_franca.png)
  const getPhotoUrl = useCallback((playerName) => {
    if (!playerName || !_cache) return null

    // Tenta pelo nome exato primeiro
    let stored = _cache[playerName]
    if (!stored) {
      const key = normKey(playerName)
      const entry = Object.entries(_cache).find(([k]) => normKey(k) === key)
      stored = entry?.[1]
    }

    if (!stored) return null

    // URL completa (Vercel Blob)
    if (stored.startsWith('http://') || stored.startsWith('https://')) return stored
    // Path relativo já correto
    if (stored.startsWith('/')) return stored
    // Filename puro (legado) → constrói path local
    return `/photoplayers/${stored}`
  }, [photoMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearAll = useCallback(async () => {
    _cache = {}
    _listeners.forEach(fn => fn({}))
  }, [])

  return { photoMap, setPhoto, getPhotoUrl, clearAll, loaded }
}

// Migração única: lê localStorage → banco
async function migrateFromLocalStorage() {
  if (typeof window === 'undefined') return
  const STORAGE_KEY = 'guarani_player_photos'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    const map = JSON.parse(saved)
    const entries = Object.entries(map).filter(([, v]) => v)
    if (!entries.length) return
    await Promise.all(entries.map(([player_name, filename]) =>
      fetch('/api/photo-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name, filename }),
      }).catch(() => {})
    ))
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
