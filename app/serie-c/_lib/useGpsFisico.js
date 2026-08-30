// app/serie-c/_lib/useGpsFisico.js
// Puxa as sessões de GPS e usa a tabela player_aliases para casar o nome do
// Catapult com o nome técnico/Wyscout. O vínculo manual passa a valer em todos
// os relatórios individuais, elenco, coletivo e PDFs.
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildAliasGroups, buildResolver, normName, sameAthlete } from '@/lib/nameMatch'

function n(v) {
  const x = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}

function durationMin(row) {
  const d = n(row?.duration)
  return d > 0 ? d / 60 : null
}

function normLoose(s) {
  return String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ')
}

function isMatchSession(s) {
  const t = normLoose(s?.tipo_sessao || s?.titulo)
  return /jogo|partida|match/.test(t)
}

// A API de GPS já teve dois formatos de persistência:
// 1) rows: [ ...jogadores ]
// 2) rows: { rows:[ ...jogadores ], blocos:[], rowsByBloco:{...} }
// O segundo é o formato atual. Centralizar essa normalização evita exceção
// client-side quando existem sessões antigas e novas misturadas no banco.
function sessionRows(session) {
  let raw = session?.rows
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch (_) { return [] }
  }
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.rows)) return raw.rows
  if (session?.payload && Array.isArray(session.payload.rows)) return session.payload.rows
  return []
}

export function useGpsFisico({ matchOnly = true } = {}) {
  const [sessions, setSessions] = useState([])
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [aliasError, setAliasError] = useState(null)

  const loadGps = useCallback(async () => {
    try {
      const r = await fetch('/api/gps', { cache:'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao carregar GPS.')
      setSessions(Array.isArray(d?.sessions) ? d.sessions : (d?.rows ? [d] : []))
      setError(null)
    } catch (e) {
      setError(e?.message || 'Falha ao carregar GPS.')
    }
  }, [])

  const reloadAliases = useCallback(async () => {
    try {
      const r = await fetch(`/api/aliases?_ts=${Date.now()}`, { cache:'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao carregar vínculos de nomes.')
      setAliases(Array.isArray(d?.aliases) ? d.aliases : [])
      setAliasError(null)
      return Array.isArray(d?.aliases) ? d.aliases : []
    } catch (e) {
      setAliasError(e?.message || 'Falha ao carregar vínculos de nomes.')
      return []
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      await Promise.allSettled([loadGps(), reloadAliases()])
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [loadGps, reloadAliases])

  const gpsNames = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const s of sessions) {
      if (matchOnly && !isMatchSession(s)) continue
      for (const r of sessionRows(s)) {
        if (String(r?.periodNumber) !== '0') continue
        const raw = String(r?.playerName || '').trim()
        const key = normName(raw)
        if (!raw || !key || seen.has(key)) continue
        seen.add(key)
        out.push(raw)
      }
    }
    return out.sort((a,b) => a.localeCompare(b, 'pt-BR'))
  }, [sessions, matchOnly])

  const gpsAliases = useMemo(
    () => aliases.filter(a => String(a?.source || '').toLowerCase() === 'gps'),
    [aliases]
  )
  const aliasGroups = useMemo(() => buildAliasGroups(gpsAliases), [gpsAliases])
  const resolver = useMemo(() => buildResolver(gpsNames, aliasGroups), [gpsNames, aliasGroups])
  const resolveGps = useCallback((technicalName) => resolver.resolve(technicalName), [resolver])

  function aggregateForRange(technicalName, { from = null, to = null } = {}) {
    const games = []
    let linkedGpsName = resolveGps(technicalName) || ''

    for (const s of sessions) {
      if (matchOnly && !isMatchSession(s)) continue
      const ymd = s?.data_sessao ? String(s.data_sessao).slice(0, 10) : null
      if (from && (!ymd || ymd < from)) continue
      if (to && (!ymd || ymd > to)) continue
      const rows = sessionRows(s).filter(r => String(r?.periodNumber) === '0')

      // Primeiro respeita os vínculos manuais; depois usa o fuzzy seguro do motor central.
      const mine = rows.find(r => sameAthlete(r?.playerName, technicalName, aliasGroups))
      if (!mine) continue
      if (!linkedGpsName) linkedGpsName = mine.playerName || ''

      const min = durationMin(mine)
      games.push({
        data:ymd,
        distancia_total:n(mine.totalDistance),
        hsr_m:n(mine.dist20),
        sprint_m:n(mine.dist25),
        n_sprints:n(mine.sprints),
        aceleracoes:n(mine.accel),
        desaceleracoes:n(mine.decel),
        vel_max:n(mine.maxVel),
        dist_min:min ? n(mine.totalDistance) / min : null,
      })
    }

    if (!games.length) return null
    const avg = key => games.reduce((t,g) => t + (g[key] || 0), 0) / games.length
    const withMin = games.filter(g => g.dist_min !== null)

    return {
      nome:technicalName,
      gps_nome:linkedGpsName || null,
      jogos:games.length,
      distancia_total:avg('distancia_total'),
      hsr_m:avg('hsr_m'),
      sprint_m:avg('sprint_m'),
      n_sprints:avg('n_sprints'),
      aceleracoes:avg('aceleracoes'),
      desaceleracoes:avg('desaceleracoes'),
      vel_max:Math.max(...games.map(g => g.vel_max)),
      dist_min:withMin.length ? withMin.reduce((t,g) => t + g.dist_min, 0) / withMin.length : null,
      from:games.map(g=>g.data).filter(Boolean).sort()[0] || null,
      to:games.map(g=>g.data).filter(Boolean).sort().slice(-1)[0] || null,
    }
  }

  function aggregateFor(technicalName) {
    return aggregateForRange(technicalName)
  }

  function aggregateSquad(technicalNames) {
    return (technicalNames || []).map(aggregateFor).filter(Boolean)
  }

  function aggregateSquadRange(technicalNames, range = {}) {
    return (technicalNames || []).map(name => aggregateForRange(name, range)).filter(Boolean)
  }

  return {
    sessions,
    aliases,
    gpsNames,
    loading,
    error,
    aliasError,
    resolveGps,
    reloadAliases,
    aggregateFor,
    aggregateForRange,
    aggregateSquad,
    aggregateSquadRange,
    hasData:sessions.length > 0,
  }
}
