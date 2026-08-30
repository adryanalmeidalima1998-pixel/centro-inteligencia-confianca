import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// ─── TABLE ──────────────────────────────────────────────────────────────────
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS player_enrichment (
      id              SERIAL PRIMARY KEY,
      player_key      VARCHAR(200) NOT NULL UNIQUE,
      full_name       VARCHAR(200),
      birth_date      VARCHAR(20),
      nationality     VARCHAR(100),
      nationality_flag VARCHAR(10),
      market_value    INTEGER,          -- em EUR
      market_value_fmt VARCHAR(30),     -- "€ 250 mil"
      position_tm     VARCHAR(100),
      current_club    VARCHAR(200),
      contract_until  VARCHAR(20),
      height_cm       INTEGER,
      foot            VARCHAR(10),
      tm_url          VARCHAR(500),
      tm_id           VARCHAR(50),
      wikidata_id     VARCHAR(20),
      photo_url       VARCHAR(500),
      clubs_history   TEXT,             -- JSON array
      fetched_at      TIMESTAMP DEFAULT NOW()
    )
  `
}

function normKey(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

// ─── TRANSFERMARKT via transfermarkt-api (free community proxy) ─────────────
// https://transfermarkt-api.fly.dev — open source, sem key, hospedado publicamente
const TM_PROXY = 'https://transfermarkt-api.fly.dev'

async function searchTransfermarkt(playerName) {
  try {
    const url = `${TM_PROXY}/players/search/${encodeURIComponent(playerName)}?page_number=1`
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    // Retorna o primeiro resultado
    return data?.results?.[0] || null
  } catch { return null }
}

async function getPlayerProfile(tmId) {
  try {
    const url = `${TM_PROXY}/players/${tmId}/profile`
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function getPlayerMarketValue(tmId) {
  try {
    const url = `${TM_PROXY}/players/${tmId}/market_value`
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.marketValues?.[0] || data || null
  } catch { return null }
}

async function getPlayerTransfers(tmId) {
  try {
    const url = `${TM_PROXY}/players/${tmId}/transfers`
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.transfers || []).slice(0, 6).map(t => ({
      from:   t.from?.clubName || '',
      to:     t.to?.clubName   || '',
      season: t.season || '',
      fee:    t.fee    || '',
    }))
  } catch { return [] }
}

// ─── WIKIDATA — busca por nome do jogador (SPARQL) ──────────────────────────
async function fetchWikidata(playerName) {
  try {
    const query = `
      SELECT ?player ?playerLabel ?birthDate ?nationalityLabel ?nationalityCode WHERE {
        ?player wdt:P106 wd:Q937857.
        ?player rdfs:label "${playerName}"@pt.
        OPTIONAL { ?player wdt:P569 ?birthDate. }
        OPTIONAL { ?player wdt:P27 ?nationality.
                   ?nationality wdt:P297 ?nationalityCode. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
      }
      LIMIT 1
    `
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'ConfiançaDashboard/1.0', Accept: 'application/json' },
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data    = await res.json()
    const binding = data?.results?.bindings?.[0]
    if (!binding) return null

    const qid = binding.player?.value?.split('/').pop()
    return {
      wikidataId:  qid,
      birthDate:   binding.birthDate?.value?.slice(0, 10) || null,
      nationality: binding.nationalityLabel?.value || null,
      flag:        countryFlag(binding.nationalityCode?.value),
    }
  } catch { return null }
}

// ISO 3166-1 alpha-2 → emoji flag
function countryFlag(code) {
  if (!code) return ''
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join('')
}

// Formata valor de mercado em EUR
function formatMarketValue(value) {
  if (!value || value === 0) return null
  if (value >= 1_000_000) return `€ ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)} M`
  if (value >= 1_000)     return `€ ${Math.round(value / 1_000)} mil`
  return `€ ${value}`
}

// ─── GET /api/player-enrichment?player=Rodrigo Andrade ──────────────────────
// ?refresh=1 → re-busca mesmo se em cache
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const playerName = (searchParams.get('player') || '').trim()
  const refresh    = searchParams.get('refresh') === '1'

  if (!playerName) return NextResponse.json({ error: 'player= obrigatório' }, { status: 400 })

  try {
    await ensureTable()
    const key = normKey(playerName)

    // Cache: 24h (dados de mercado não mudam todo dia)
    if (!refresh) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const cached = await sql`SELECT * FROM player_enrichment WHERE player_key = ${key} AND fetched_at > ${dayAgo}`
      if (cached.rows.length > 0) {
        return NextResponse.json({ ...formatRow(cached.rows[0]), cached: true })
      }
    }

    // ── Busca em paralelo: TM search + Wikidata ──────────────────────────────
    const [tmResult, wikiResult] = await Promise.all([
      searchTransfermarkt(playerName),
      fetchWikidata(playerName),
    ])

    let profile = null, mvData = null, transfers = []

    if (tmResult?.id) {
      ;[profile, mvData, transfers] = await Promise.all([
        getPlayerProfile(tmResult.id),
        getPlayerMarketValue(tmResult.id),
        getPlayerTransfers(tmResult.id),
      ])
    }

    // Montar objeto unificado
    const mv = profile?.marketValue
      ? parseInt(String(profile.marketValue).replace(/\D/g, '')) || null
      : (mvData?.currentMarketValue ?? null)

    const row = {
      playerKey:       key,
      fullName:        profile?.name || tmResult?.name || playerName,
      birthDate:       profile?.dateOfBirth || wikiResult?.birthDate || null,
      nationality:     profile?.citizenship || wikiResult?.nationality || null,
      nationalityFlag: wikiResult?.flag || '',
      marketValue:     mv,
      marketValueFmt:  formatMarketValue(mv),
      positionTm:      profile?.position?.main || tmResult?.position || null,
      currentClub:     profile?.club?.name || null,
      contractUntil:   profile?.contract?.expires || null,
      heightCm:        profile?.height ? parseInt(String(profile.height).replace(/\D/g, '')) || null : null,
      foot:            profile?.foot || null,
      tmUrl:           tmResult?.url || null,
      tmId:            tmResult?.id  || null,
      wikidataId:      wikiResult?.wikidataId || null,
      photoUrl:        profile?.imageURL || tmResult?.image || null,
      clubsHistory:    JSON.stringify(transfers),
      fetchedAt:       new Date().toISOString(),
    }

    // Upsert
    await sql`
      INSERT INTO player_enrichment
        (player_key, full_name, birth_date, nationality, nationality_flag,
         market_value, market_value_fmt, position_tm, current_club, contract_until,
         height_cm, foot, tm_url, tm_id, wikidata_id, photo_url, clubs_history)
      VALUES
        (${row.playerKey}, ${row.fullName}, ${row.birthDate}, ${row.nationality}, ${row.nationalityFlag},
         ${row.marketValue}, ${row.marketValueFmt}, ${row.positionTm}, ${row.currentClub}, ${row.contractUntil},
         ${row.heightCm}, ${row.foot}, ${row.tmUrl}, ${row.tmId}, ${row.wikidataId}, ${row.photoUrl}, ${row.clubsHistory})
      ON CONFLICT (player_key) DO UPDATE SET
        full_name = EXCLUDED.full_name, birth_date = EXCLUDED.birth_date,
        nationality = EXCLUDED.nationality, nationality_flag = EXCLUDED.nationality_flag,
        market_value = EXCLUDED.market_value, market_value_fmt = EXCLUDED.market_value_fmt,
        position_tm = EXCLUDED.position_tm, current_club = EXCLUDED.current_club,
        contract_until = EXCLUDED.contract_until, height_cm = EXCLUDED.height_cm,
        foot = EXCLUDED.foot, tm_url = EXCLUDED.tm_url, tm_id = EXCLUDED.tm_id,
        wikidata_id = EXCLUDED.wikidata_id, photo_url = EXCLUDED.photo_url,
        clubs_history = EXCLUDED.clubs_history, fetched_at = NOW()
    `

    return NextResponse.json({ ...row, cached: false })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function formatRow(r) {
  return {
    playerKey:       r.player_key,
    fullName:        r.full_name,
    birthDate:       r.birth_date,
    nationality:     r.nationality,
    nationalityFlag: r.nationality_flag,
    marketValue:     r.market_value,
    marketValueFmt:  r.market_value_fmt,
    positionTm:      r.position_tm,
    currentClub:     r.current_club,
    contractUntil:   r.contract_until,
    heightCm:        r.height_cm,
    foot:            r.foot,
    tmUrl:           r.tm_url,
    tmId:            r.tm_id,
    wikidataId:      r.wikidata_id,
    photoUrl:        r.photo_url,
    clubsHistory:    r.clubs_history,
  }
}
