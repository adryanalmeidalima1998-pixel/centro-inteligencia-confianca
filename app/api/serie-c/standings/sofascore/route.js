import { NextResponse } from 'next/server'
import {
  parseSofaScoreSerieC,
  SOFASCORE_SERIE_C_URL,
  SOFASCORE_SERIE_C_WIDGET_URL,
  SOFASCORE_STANDINGS_URLS,
} from '../../../../../lib/sofascoreSerieC'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 20

const CACHE_TTL_MS = 30 * 1000
const FETCH_TIMEOUT_MS = 9 * 1000

function cacheStore() {
  if (!globalThis.__serieCSofaScoreStandingsCacheV2) {
    globalThis.__serieCSofaScoreStandingsCacheV2 = new Map()
  }
  return globalThis.__serieCSofaScoreStandingsCacheV2
}

function requestHeaders() {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
    'Cache-Control': 'no-cache, no-store, max-age=0',
    Pragma: 'no-cache',
    Referer: 'https://www.sofascore.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  }
}

async function fetchCandidate(url, priority) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const separator = url.includes('?') ? '&' : '?'
    const response = await fetch(`${url}${separator}_=${Date.now()}`, {
      cache: 'no-store',
      headers: requestHeaders(),
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const text = await response.text()
    if (!text) throw new Error('resposta vazia')
    const parsed = parseSofaScoreSerieC(text)

    return {
      ...parsed,
      requestUrl: url,
      priority,
      totalPoints: parsed.rows.reduce((sum, row) => sum + row.points, 0),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function compareResults(a, b) {
  const aScore = [a.round, a.completedMatches, a.totalPoints, a.updatedAt ? Date.parse(a.updatedAt) : 0, -a.priority]
  const bScore = [b.round, b.completedMatches, b.totalPoints, b.updatedAt ? Date.parse(b.updatedAt) : 0, -b.priority]

  for (let index = 0; index < aScore.length; index += 1) {
    if (aScore[index] !== bScore[index]) return bScore[index] - aScore[index]
  }
  return 0
}

function noStoreJson(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Expires: '0',
      Pragma: 'no-cache',
      'Surrogate-Control': 'no-store',
    },
  })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'
  const cache = cacheStore()
  const cacheKey = 'serie-c-2026-sofascore-standings-v2'
  const cached = cache.get(cacheKey)
  const now = Date.now()

  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return noStoreJson({
      ...cached.payload,
      cached: true,
      cacheAgeSeconds: Math.round((now - cached.timestamp) / 1000),
    })
  }

  const attempts = await Promise.allSettled(
    SOFASCORE_STANDINGS_URLS.map((url, index) => fetchCandidate(url, index)),
  )
  const valid = attempts
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
    .sort(compareResults)

  if (valid.length) {
    const selected = valid[0]
    const payload = {
      ok: true,
      source: 'Sofascore',
      sourceUrl: SOFASCORE_SERIE_C_URL,
      widgetUrl: SOFASCORE_SERIE_C_WIDGET_URL,
      requestUrl: selected.requestUrl,
      fetchedAt: new Date().toISOString(),
      providerUpdatedAt: selected.updatedAt,
      round: selected.round,
      completedMatches: selected.completedMatches,
      rows: selected.rows,
      automatic: true,
      transport: 'server',
    }
    cache.set(cacheKey, { timestamp: now, payload })
    return noStoreJson({ ...payload, cached: false })
  }

  const errors = attempts.map((result, index) => {
    const reason = result.status === 'rejected'
      ? (result.reason?.name === 'AbortError' ? 'tempo limite excedido' : result.reason?.message)
      : 'resposta inválida'
    return `${SOFASCORE_STANDINGS_URLS[index]}: ${reason || 'falha desconhecida'}`
  })
  console.error('[GET /api/serie-c/standings/sofascore]', errors.join(' | '))

  return noStoreJson({
    ok: false,
    source: 'Sofascore',
    sourceUrl: SOFASCORE_SERIE_C_URL,
    widgetUrl: SOFASCORE_SERIE_C_WIDGET_URL,
    error: 'A Vercel não conseguiu consultar o Sofascore. O navegador tentará o endpoint oficial diretamente.',
    details: process.env.NODE_ENV === 'development' ? errors : undefined,
  }, 502)
}
