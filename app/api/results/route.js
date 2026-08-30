import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// ─── ESPN PUBLIC API ────────────────────────────────────────────────────────
// Brasileirão Série C = bra.3 | Série B = bra.2 | Série A = bra.1
// Sem API key, sem autenticação. Limite generoso (~1000 req/dia).
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.3'

// ─── TABLE ──────────────────────────────────────────────────────────────────
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS match_results (
      id           SERIAL PRIMARY KEY,
      date_key     VARCHAR(10)  NOT NULL,  -- YYYY-MM-DD
      home_team    VARCHAR(200) NOT NULL,
      away_team    VARCHAR(200) NOT NULL,
      home_score   INTEGER,
      away_score   INTEGER,
      status       VARCHAR(50),            -- 'final' | 'live' | 'scheduled'
      espn_id      VARCHAR(50),
      fetched_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE(date_key, home_team, away_team)
    )
  `
}

// ─── NORMALIZE name para matching fuzzy ─────────────────────────────────────
function norm(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+(fc|sc|ac|ec|aa|se|cr|cf|futebol|clube|esporte|sport)$/gi, '')
    .replace(/^(ad|aa|ec|sc|ac|fc|cf|esporte)\s+/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

// ESPN retorna nomes variados — precisa casar com os nomes do CSV
// Chave = norm(ESPN name), valor = norm(CSV name)
const ESPN_NAME_MAP = {
  // Série C 2026
  'confianca':           'confianca',
  'adconfianca':         'confianca',
  'guaranifc':         'guarani',
  'maranhao':          'maranhaoa',
  'maranhaoac':        'maranhaoa',
  'voltaredonda':      'voltaredonda',
  'itabaiana':         'aoitabaiana',
  'adoitabaiana':      'aoitabaiana',
  'ferroviaria':       'ferroviaria',
  'ferroviariafc':     'ferroviaria',
  'santacruz':         'santacruz',
  'maringa':           'maringafc',
  'maringafc':         'maringafc',
  'ituano':            'ituano',
  'barra':             'barrafc',
  'barrafc':           'barrafc',
  'amazonas':          'amazonasfc',
  'amazonasfc':        'amazonasfc',
  'caxias':            'caxias',
  'eccaxias':          'caxias',
  'confianca':         'confianca',
  'figueirense':       'figueirense',
  'floresta':          'floresta',
  'paysandu':          'paysandu',
  'paysandusc':        'paysandu',
  'interdelimeira':    'interdelimeira',
  'anapolis':          'anapolis',
  'anapolisfc':        'anapolis',
  'ypiranga':          'ypiranga',
  'ypirangafc':        'ypiranga',
  'botafogopb':        'botafogopb',
  'botafogojp':        'botafogopb',
  'brusque':           'brusque',
}

function resolveEspnName(espnName) {
  const k = norm(espnName)
  return ESPN_NAME_MAP[k] || k
}

function teamsMatch(espnName, csvName) {
  return resolveEspnName(espnName) === norm(csvName)
}

// ─── FETCH ESPN SCOREBOARD ──────────────────────────────────────────────────
// ESPN aceita ?dates=YYYYMMDD ou ?dates=YYYYMMDD-YYYYMMDD
async function fetchESPN(dateParam) {
  const url = `${ESPN_BASE}/scoreboard?dates=${dateParam}&limit=50`
  const res  = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    signal:  AbortSignal.timeout(8000),
    next:    { revalidate: 300 }, // cache Vercel 5min
  })
  if (!res.ok) throw new Error(`ESPN retornou ${res.status}`)
  return res.json()
}

// Extrai resultado limpo de um event ESPN
function parseESPNEvent(event) {
  const comp        = event.competitions?.[0]
  if (!comp) return null
  const competitors = comp.competitors || []
  const home        = competitors.find(c => c.homeAway === 'home')
  const away        = competitors.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const statusType = comp.status?.type
  const completed  = statusType?.completed === true
  const live       = statusType?.name === 'STATUS_IN_PROGRESS'
  const status     = completed ? 'final' : live ? 'live' : 'scheduled'

  // date em UTC → converte pra date local BR (UTC-3)
  const rawDate = new Date(event.date)
  // Série C joga no Brasil, desloca -3h para pegar a data correta do jogo
  const brDate  = new Date(rawDate.getTime() - 3 * 60 * 60 * 1000)
  const dateKey = brDate.toISOString().slice(0, 10)

  return {
    espnId:    event.id,
    dateKey,
    homeName:  home.team?.displayName || home.team?.name || '',
    awayName:  away.team?.displayName || away.team?.name || '',
    homeScore: completed || live ? parseInt(home.score) : null,
    awayScore: completed || live ? parseInt(away.score) : null,
    status,
  }
}

// ─── FETCH RANGE DE MESES ───────────────────────────────────────────────────
// ESPN aceita range de datas. A Série C 2026 vai de abril a novembro.
// Busca tudo de uma vez em chunks mensais.
async function fetchAllSerieC2026() {
  const months = [
    '20260401-20260430',
    '20260501-20260531',
    '20260601-20260630',
    '20260701-20260731',
    '20260801-20260831',
    '20260901-20260930',
    '20261001-20261031',
  ]

  const results = []
  await Promise.allSettled(
    months.map(async m => {
      try {
        const data   = await fetchESPN(m)
        const events = (data.events || []).map(parseESPNEvent).filter(Boolean)
        results.push(...events)
      } catch { /* ignora mês que falhar */ }
    })
  )
  return results
}

// ─── GET /api/results ───────────────────────────────────────────────────────
// ?refresh=1  → ignora cache e re-busca na ESPN
// ?date=YYYY-MM-DD → filtra por data específica
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === '1'
  const dateFilter = searchParams.get('date') // opcional

  try {
    await ensureTable()

    // ── Retorna cache se recente (< 10min) e não forçou refresh ─────────────
    if (!refresh) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const cached = dateFilter
        ? await sql`SELECT * FROM match_results WHERE date_key = ${dateFilter} AND fetched_at > ${tenMinAgo}`
        : await sql`SELECT * FROM match_results WHERE fetched_at > ${tenMinAgo} ORDER BY date_key`

      if (cached.rows.length > 0) {
        return NextResponse.json({ results: formatRows(cached.rows), source: 'cache' })
      }
    }

    // ── Busca na ESPN ────────────────────────────────────────────────────────
    const events = await fetchAllSerieC2026()

    // Salva/atualiza no Postgres
    for (const ev of events) {
      if (ev.status === 'final' || ev.status === 'live') {
        await sql`
          INSERT INTO match_results (date_key, home_team, away_team, home_score, away_score, status, espn_id)
          VALUES (${ev.dateKey}, ${ev.homeName}, ${ev.awayName}, ${ev.homeScore}, ${ev.awayScore}, ${ev.status}, ${ev.espnId})
          ON CONFLICT (date_key, home_team, away_team) DO UPDATE
            SET home_score = EXCLUDED.home_score,
                away_score = EXCLUDED.away_score,
                status     = EXCLUDED.status,
                fetched_at = NOW()
        `
      }
    }

    // Lê de volta do Postgres (inclui resultados antigos + novos)
    const all = dateFilter
      ? await sql`SELECT * FROM match_results WHERE date_key = ${dateFilter} ORDER BY date_key`
      : await sql`SELECT * FROM match_results ORDER BY date_key`

    return NextResponse.json({ results: formatRows(all.rows), source: 'espn', total: events.length })
  } catch (err) {
    // Se ESPN falhar, retorna o que tem no cache mesmo
    try {
      const fallback = await sql`SELECT * FROM match_results ORDER BY date_key`
      return NextResponse.json({ results: formatRows(fallback.rows), source: 'cache-fallback', error: err.message })
    } catch {
      return NextResponse.json({ error: err.message, results: [] }, { status: 500 })
    }
  }
}

function formatRows(rows) {
  return rows.map(r => ({
    dateKey:    r.date_key,
    homeName:   r.home_team,
    awayName:   r.away_team,
    homeScore:  r.home_score,
    awayScore:  r.away_score,
    status:     r.status,
    espnId:     r.espn_id,
    fetchedAt:  r.fetched_at,
  }))
}

// ─── Exporta norm e teamsMatch pra uso em outros módulos ───────────────────
export { norm, teamsMatch, resolveEspnName }
