// app/serie-c/_lib/useSerieCData.js
// Hook compartilhado por todas as abas da Série C.
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const REQUEST_TIMEOUT_MS = 20000

export function useSerieCData({ season, round } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (season) params.set('season', season)
      if (round) params.set('round', round)

      const response = await fetch(`/api/serie-c/data?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })

      let payload = null
      try {
        payload = await response.json()
      } catch {
        throw new Error('O servidor retornou uma resposta inválida.')
      }

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || `Falha ao carregar os dados (${response.status}).`)
      }

      if (requestId === requestRef.current) setData(payload)
    } catch (err) {
      if (requestId !== requestRef.current) return
      if (err?.name === 'AbortError') {
        setError('A consulta demorou mais de 20 segundos. Verifique a conexão com o banco e tente novamente.')
      } else {
        setError(err?.message || 'Falha ao carregar os dados da Série C.')
      }
    } finally {
      window.clearTimeout(timer)
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [season, round])

  useEffect(() => {
    load()
    return () => { requestRef.current += 1 }
  }, [load])

  return { data, loading, error, reload: load }
}
