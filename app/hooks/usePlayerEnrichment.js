'use client'
import { useState, useEffect, useRef } from 'react'

const _cache = new Map()
const _inflight = new Map()

function normKey(name) {
  return (name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '').trim()
}

/**
 * Busca enriquecimento de UM jogador (Transfermarkt + Wikidata)
 * Só use em componentes que renderizam UM jogador por vez, nunca em loops.
 */
export function usePlayerEnrichment(playerName) {
  const key = normKey(playerName)
  const [data,    setData]    = useState(_cache.get(key) ?? null)
  const [loading, setLoading] = useState(!_cache.has(key) && !!playerName)

  useEffect(() => {
    if (!playerName) return
    if (_cache.has(key)) { setData(_cache.get(key)); setLoading(false); return }
    setLoading(true)

    if (!_inflight.has(key)) {
      const p = fetch(`/api/player-enrichment?player=${encodeURIComponent(playerName)}`)
        .then(r => r.json())
        .then(d => { _cache.set(key, d.error ? null : d); return d.error ? null : d })
        .catch(() => { _cache.set(key, null); return null })
        .finally(() => _inflight.delete(key))
      _inflight.set(key, p)
    }

    _inflight.get(key).then(d => { setData(d); setLoading(false) })
  }, [key])

  return { data, loading }
}

/**
 * ✅ PADRÃO CORRETO PARA LISTAS
 * Chame UMA vez no componente pai com a lista completa de nomes.
 * Retorna um mapa { normKey(name) → enrichData } para passar como prop.
 *
 * Exemplo:
 *   const enrichMap = useEnrichmentMap(players.map(p => p.name))
 *   <PlayerCard enrich={enrichMap[normKey(player.name)]} />
 */
export function useEnrichmentMap(names) {
  const [map, setMap] = useState({})
  const fetched = useRef(new Set())
  const namesKey = Array.isArray(names) ? [...names].sort().join('|') : ''

  useEffect(() => {
    if (!namesKey) return
    const arr = namesKey.split('|').filter(Boolean)

    arr.forEach(name => {
      const k = normKey(name)
      if (!k || fetched.current.has(k)) return
      fetched.current.add(k)

      if (_cache.has(k)) {
        setMap(prev => ({ ...prev, [k]: _cache.get(k) }))
        return
      }

      if (!_inflight.has(k)) {
        const p = fetch(`/api/player-enrichment?player=${encodeURIComponent(name)}`)
          .then(r => r.json())
          .then(d => { const v = d.error ? null : d; _cache.set(k, v); return v })
          .catch(() => { _cache.set(k, null); return null })
          .finally(() => _inflight.delete(k))
        _inflight.set(k, p)
      }

      _inflight.get(k).then(d => {
        if (d) setMap(prev => ({ ...prev, [k]: d }))
      })
    })
  }, [namesKey])

  return map
}

// Normalizer exportada para lookup no parent
export { normKey as normEnrichKey }

export function invalidatePlayerEnrichment(name) {
  _cache.delete(normKey(name))
}
