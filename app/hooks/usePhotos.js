'use client'
import { useState, useEffect, useCallback } from 'react'

// Módulo-level cache — persiste entre renders
let _cache = null
let _fetching = false
const _listeners = new Set()

async function fetchAndNotify() {
  if (_fetching) return
  _fetching = true
  try {
    const res = await fetch('/api/photos')
    const d = await res.json()
    const map = {}
    ;(d.photos || []).forEach(p => { map[normKey(p.canonical_name)] = p.url })
    _cache = map
    _listeners.forEach(fn => fn({ ...map }))
  } catch {
    _cache = _cache || {}
    _listeners.forEach(fn => fn({ ..._cache }))
  } finally {
    _fetching = false
  }
}

export function usePhotos() {
  const [photoMap, setPhotoMap] = useState(_cache || {})

  useEffect(() => {
    // Register listener
    _listeners.add(setPhotoMap)

    // If we have cache, use it immediately
    if (_cache) {
      setPhotoMap({ ..._cache })
    } else {
      // Fetch on first use
      fetchAndNotify()
    }

    return () => { _listeners.delete(setPhotoMap) }
  }, [])

  return photoMap
}

export function invalidatePhotos() {
  _cache = null
  fetchAndNotify()
}

export function normKey(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ')
}
