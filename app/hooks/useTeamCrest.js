'use client'
import { useState, useEffect, useRef } from 'react'

// Module-level memory cache: key → url (persists across re-renders, cleared on page refresh)
const _cache = new Map()
const _inflight = new Map()

/**
 * Fetch a single team crest URL.
 * Returns { url, loading }
 *
 * Usage:
 *   const { url, loading } = useTeamCrest('Confiança')
 *   <img src={url} />
 */
export function useTeamCrest(teamName) {
  const key = (teamName || '').trim()
  const [url,     setUrl]     = useState(_cache.get(key) ?? null)
  const [loading, setLoading] = useState(!_cache.has(key) && !!key)

  useEffect(() => {
    if (!key) return
    if (_cache.has(key)) { setUrl(_cache.get(key)); setLoading(false); return }

    setLoading(true)

    // Deduplicate concurrent requests for same team
    if (!_inflight.has(key)) {
      const promise = fetch(`/api/team-crest?team=${encodeURIComponent(key)}`)
        .then(r => r.json())
        .then(d => {
          _cache.set(key, d.url || null)
          return d.url || null
        })
        .catch(() => { _cache.set(key, null); return null })
        .finally(() => _inflight.delete(key))
      _inflight.set(key, promise)
    }

    _inflight.get(key).then(u => { setUrl(u); setLoading(false) })
  }, [key])

  return { url, loading }
}

/**
 * Prefetch crests for a list of team names in parallel.
 * Call this once when you have the full list of teams.
 *
 * Usage:
 *   useTeamCrestBatch(['Confiança', 'Volta Redonda', 'Santa Cruz'])
 *   → fires requests in parallel, fills cache
 */
export function useTeamCrestBatch(teamNames) {
  const fetched = useRef(new Set())

  useEffect(() => {
    const toFetch = teamNames.filter(n => {
      const k = (n || '').trim()
      return k && !_cache.has(k) && !_inflight.has(k) && !fetched.current.has(k)
    })
    if (!toFetch.length) return

    toFetch.forEach(n => {
      const k = (n || '').trim()
      fetched.current.add(k)
      const promise = fetch(`/api/team-crest?team=${encodeURIComponent(k)}`)
        .then(r => r.json())
        .then(d => { _cache.set(k, d.url || null); return d.url || null })
        .catch(() => { _cache.set(k, null); return null })
        .finally(() => _inflight.delete(k))
      _inflight.set(k, promise)
    })
  }, [teamNames.join(',')])
}

/**
 * Get crest map for a list of teams (returns object { teamName: url })
 * Triggers fetches, re-renders as they arrive.
 *
 * Usage:
 *   const crests = useTeamCrestMap(['Confiança', 'Volta Redonda'])
 *   <img src={crests['Confiança']} />
 */
export function useTeamCrestMap(teamNames) {
  const [map, setMap] = useState(() => {
    const m = {}
    teamNames.forEach(n => {
      const k = (n || '').trim()
      if (_cache.has(k)) m[k] = _cache.get(k)
    })
    return m
  })

  useEffect(() => {
    const toFetch = teamNames.filter(n => {
      const k = (n || '').trim()
      return k && !_cache.has(k)
    })

    if (!toFetch.length) return

    Promise.all(
      toFetch.map(n => {
        const k = (n || '').trim()
        if (_inflight.has(k)) return _inflight.get(k).then(url => ({ k, url }))
        const p = fetch(`/api/team-crest?team=${encodeURIComponent(k)}`)
          .then(r => r.json())
          .then(d => { _cache.set(k, d.url || null); return d.url || null })
          .catch(() => { _cache.set(k, null); return null })
          .finally(() => _inflight.delete(k))
        _inflight.set(k, p)
        return p.then(url => ({ k, url }))
      })
    ).then(results => {
      setMap(prev => {
        const next = { ...prev }
        results.forEach(({ k, url }) => { next[k] = url })
        return next
      })
    })
  }, [teamNames.join(',')])

  return map
}

/**
 * Invalidate a team's cached crest (re-fetch next time).
 */
export function invalidateTeamCrest(teamName) {
  _cache.delete((teamName || '').trim())
}

/**
 * Manually override a team crest URL (saves to API + local cache).
 */
export async function setTeamCrest(teamName, url) {
  const k = (teamName || '').trim()
  _cache.set(k, url)
  await fetch('/api/team-crest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team: k, url }),
  })
}
