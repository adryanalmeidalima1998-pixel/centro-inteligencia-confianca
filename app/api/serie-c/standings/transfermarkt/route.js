import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import {
  parseTransfermarktSerieC,
  TRANSFERMARKT_SERIE_C_URL,
  TRANSFERMARKT_SERIE_C_URLS,
} from '../../../../../lib/transfermarktSerieC'
import { ensureSerieCLiveCacheTable } from '../../../../../lib/serieCDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

const CACHE_TTL_MS = 90 * 1000
const STALE_CACHE_LIMIT_MS = 30 * 60 * 1000
const FETCH_TIMEOUT_MS = 18 * 1000
const MIN_DOCUMENT_LENGTH = 700
const DURABLE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const MEMORY_CACHE_KEY = 'serie-c-2026-transfermarkt-standings-v3'
const SNAPSHOT_PROVIDER = 'transfermarkt-standings-v3'

function cacheStore() {
  if (!globalThis.__serieCTransfermarktCache) globalThis.__serieCTransfermarktCache = new Map()
  return globalThis.__serieCTransfermarktCache
}

function isTransfermarktPayload(payload) {
  return Boolean(
    payload
    && payload.source === 'Transfermarkt'
    && Array.isArray(payload.rows)
    && payload.rows.length === 20
  )
}

function readerUrl(targetUrl) {
  return `https://r.jina.ai/http://${String(targetUrl).replace(/^https?:\/\//, '')}`
}

const SOURCE_CANDIDATES = [
  {
    id: 'jina-reader-br',
    requestUrl: readerUrl(TRANSFERMARKT_SERIE_C_URL),
    sourceUrl: TRANSFERMARKT_SERIE_C_URL,
    transport: 'reader',
    priority: 0,
  },
  ...TRANSFERMARKT_SERIE_C_URLS.map((url, index) => ({
    id: `transfermarkt-direct-${index}`,
    requestUrl: url,
    sourceUrl: TRANSFERMARKT_SERIE_C_URL,
    transport: 'direct',
    priority: index + 1,
  })),
]

function requestHeaders(candidate) {
  if (candidate.transport === 'reader') {
    const headers = {
      Accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Confiança-FC-Serie-C-Dashboard/2.0',
      'X-No-Cache': 'true',
      'X-Cache-Tolerance': '0',
      'X-Respond-Timing': 'networkidle2',
      'X-User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'X-Referer': 'https://www.transfermarkt.com.br/',
    }
    if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
    return headers
  }

  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.7,en;q=0.6',
    'Cache-Control': 'no-cache, no-store, max-age=0',
    Pragma: 'no-cache',
    Referer: 'https://www.transfermarkt.com.br/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  }
}

async function fetchCandidate(candidate) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(candidate.requestUrl, {
      cache: 'no-store',
      headers: requestHeaders(candidate),
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const document = await response.text()
    if (!document || document.length < MIN_DOCUMENT_LENGTH) {
      throw new Error(`documento incompleto (${document?.length || 0} caracteres)`)
    }

    const parsed = parseTransfermarktSerieC(document)
    return {
      ...candidate,
      ...parsed,
      totalPoints: parsed.rows.reduce((sum, row) => sum + Number(row.points || 0), 0),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function compareResults(a, b) {
  return (Number(b.completedMatches) || 0) - (Number(a.completedMatches) || 0)
    || (Number(b.round) || 0) - (Number(a.round) || 0)
    || (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0)
    || Number(a.priority || 0) - Number(b.priority || 0)
}

function noStoreJson(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Expires: '0',
      Pragma: 'no-cache',
    },
  })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'
  const cache = cacheStore()
  const cacheKey = MEMORY_CACHE_KEY
  const cachedEntry = cache.get(cacheKey)
  const cached = isTransfermarktPayload(cachedEntry?.payload) ? cachedEntry : null
  const now = Date.now()

  if (cachedEntry && !cached) cache.delete(cacheKey)

  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return noStoreJson({
      ...cached.payload,
      cached: true,
      cacheAgeSeconds: Math.round((now - cached.timestamp) / 1000),
    })
  }

  const transfermarktResults = await Promise.allSettled(SOURCE_CANDIDATES.map(fetchCandidate))
  const validTransfermarkt = transfermarktResults
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
    .sort(compareResults)
  const selected = validTransfermarkt[0]

  if (selected) {
    const payload = {
      ok: true,
      source: 'Transfermarkt',
      sourceUrl: selected.sourceUrl,
      fetchedAt: new Date().toISOString(),
      round: selected.round,
      completedMatches: selected.completedMatches,
      rows: selected.rows,
      automatic: true,
      transport: selected.transport,
      fallback: selected.transport !== 'direct',
    }
    cache.set(cacheKey, { timestamp: now, payload })
    await writeDurableSnapshot(payload, SNAPSHOT_PROVIDER)
    return noStoreJson({ ...payload, cached: false })
  }

  const transferErrors = transfermarktResults.map((result, index) => {
    const candidate = SOURCE_CANDIDATES[index]
    const reason = result.status === 'rejected'
      ? (result.reason?.name === 'AbortError' ? 'tempo limite excedido' : result.reason?.message)
      : 'resposta inválida'
    return `${candidate.id}: ${reason || 'falha desconhecida'}`
  })
  const errors = transferErrors
  console.error('[GET /api/serie-c/standings/transfermarkt]', errors.join(' | '))

  if (cached?.payload && now - cached.timestamp <= STALE_CACHE_LIMIT_MS) {
    const staleAgeMinutes = Math.max(1, Math.round((now - cached.timestamp) / 60000))
    return noStoreJson({
      ...cached.payload,
      cached: true,
      stale: true,
      staleAgeMinutes,
      warning: `As fontes ao vivo não responderam. Exibindo a última leitura válida obtida há ${staleAgeMinutes} min.`,
    })
  }

  const durable = await readDurableSnapshot()
  if (durable?.payload && durable.ageMs <= DURABLE_CACHE_MAX_AGE_MS) {
    const staleAgeHours = Math.max(1, Math.round(durable.ageMs / 3600000))
    return noStoreJson({
      ...durable.payload,
      cached: true,
      persisted: true,
      stale: true,
      staleAgeHours,
      warning: `As fontes ao vivo não responderam. Exibindo o último snapshot persistido, obtido há ${staleAgeHours} h.`,
    })
  }

  return noStoreJson({
    ok: false,
    source: 'Transfermarkt',
    sourceUrl: TRANSFERMARKT_SERIE_C_URL,
    error: `Não foi possível consultar a classificação ao vivo. ${errors.join(' | ')}`,
  }, 502)
}



async function readDurableSnapshot() {
  try {
    await ensureSerieCLiveCacheTable()
    const result = await sql`
      SELECT provider, fetched_at, payload
      FROM serie_c_live_snapshots
      WHERE season = '2026' AND competition = 'Brasileiro Série C' AND provider = ${SNAPSHOT_PROVIDER}
      ORDER BY fetched_at DESC
      LIMIT 1
    `
    const row = result.rows[0]
    if (!row?.payload) return null
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    if (!isTransfermarktPayload(payload)) return null
    const fetchedAt = row.fetched_at ? new Date(row.fetched_at).toISOString() : null
    return {
      provider: row.provider,
      fetchedAt,
      payload,
      ageMs: fetchedAt ? Date.now() - Date.parse(fetchedAt) : Number.POSITIVE_INFINITY,
    }
  } catch (error) {
    console.warn('[serie-c] cache durável indisponível:', error.message)
    return null
  }
}

async function writeDurableSnapshot(payload, provider) {
  try {
    await ensureSerieCLiveCacheTable()
    await sql`
      INSERT INTO serie_c_live_snapshots (season, competition, provider, fetched_at, payload)
      VALUES ('2026', 'Brasileiro Série C', ${provider}, NOW(), ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (season, competition, provider) DO UPDATE SET
        fetched_at = NOW(),
        payload = EXCLUDED.payload
    `
  } catch (error) {
    console.warn('[serie-c] não foi possível persistir o snapshot vivo:', error.message)
  }
}
