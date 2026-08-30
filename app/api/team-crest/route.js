import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS team_crests (
      id           SERIAL PRIMARY KEY,
      team_key     VARCHAR(200) NOT NULL UNIQUE,
      crest_url    TEXT,
      source       VARCHAR(50),
      fetched_at   TIMESTAMP DEFAULT NOW()
    )
  `
}

function normalizeKey(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

// ─── DIRECT WIKIPEDIA PT TITLES ────────────────────────────────────────────
// normalizeKey(name) → exact PT Wikipedia article title
// Evita busca — vai direto no artigo certo, muito mais confiável
const WIKI_PT_TITLES = {
  'confianca':           'Associação Desportiva Confiança',
  'guaranifc':         'Guarani Futebol Clube',
  'maranhaoa':         'Maranhão Atlético Clube',
  'maranhaoac':        'Maranhão Atlético Clube',
  'voltaredonda':      'Volta Redonda Futebol Clube',
  'voltaredondafc':    'Volta Redonda Futebol Clube',
  'aoitabaiana':       'Associação Desportiva Itabaiana',
  'itabaiana':         'Associação Desportiva Itabaiana',
  'ferroviaria':       'Ferroviária Futebol Clube',
  'ferroviariafc':     'Ferroviária Futebol Clube',
  'santacruz':         'Santa Cruz Futebol Clube',
  'santacruzfc':       'Santa Cruz Futebol Clube',
  'maringa':           'Maringá Futebol Clube',
  'maringafc':         'Maringá Futebol Clube',
  'ituano':            'Ituano Futebol Clube',
  'ituanofc':          'Ituano Futebol Clube',
  'barra':             'Barra Futebol Clube',
  'barrafc':           'Barra Futebol Clube',
  'amazonas':          'Amazonas Futebol Clube',
  'amazonasfc':        'Amazonas Futebol Clube',
  'caxias':            'Esporte Clube Caxias do Sul',
  'eccaxias':          'Esporte Clube Caxias do Sul',
  'confianca':         'Associação Desportiva Confiança',
  'adconfianca':       'Associação Desportiva Confiança',
  'figueirense':       'Figueirense Futebol Clube',
  'figueirensefc':     'Figueirense Futebol Clube',
  'floresta':          'Floresta Esporte Clube',
  'florestaec':        'Floresta Esporte Clube',
  'paysandu':          'Paysandu Sport Club',
  'paysandusc':        'Paysandu Sport Club',
  'interdelimeira':    'Inter de Limeira',
  'anapolis':          'Anápolis Futebol Clube',
  'anapolisfc':        'Anápolis Futebol Clube',
  'ypiranga':          'Ypiranga Futebol Clube',
  'ypirangafc':        'Ypiranga Futebol Clube',
  'botafogopb':        'Botafogo Futebol Clube (João Pessoa)',
  'botafogojp':        'Botafogo Futebol Clube (João Pessoa)',
  'brusque':           'Brusque Futebol Clube',
  'brusquefc':         'Brusque Futebol Clube',
}

// ─── THESPORTSDB NAMES ─────────────────────────────────────────────────────
const TSDB_NAMES = {
  'confianca':        'Confiança',
  'guaranifc':      'Guarani',
  'voltaredonda':   'Volta Redonda',
  'voltaredondafc': 'Volta Redonda',
  'santacruz':      'Santa Cruz',
  'santacruzfc':    'Santa Cruz',
  'maringa':        'Maringa FC',
  'maringafc':      'Maringa FC',
  'ituano':         'Ituano',
  'ituanofc':       'Ituano',
  'amazonas':       'Amazonas FC',
  'amazonasfc':     'Amazonas FC',
  'paysandu':       'Paysandu',
  'paysandusc':     'Paysandu',
  'figueirense':    'Figueirense',
  'figueirensefc':  'Figueirense',
  'brusque':        'Brusque',
  'brusquefc':      'Brusque',
  'ferroviaria':    'Ferroviaria',
  'caxias':         'Caxias do Sul',
}

// ─── SOURCE 1: Wikipedia PT via título direto ──────────────────────────────
async function fetchFromWikiPtDirect(teamName) {
  const key   = normalizeKey(teamName)
  const title = WIKI_PT_TITLES[key]
  if (!title) return null
  try {
    const url = `https://pt.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=300&format=json&origin=*`
    const res  = await fetch(url, { signal: AbortSignal.timeout(7000) })
    if (!res.ok) return null
    const data = await res.json()
    const page = Object.values(data?.query?.pages || {})[0]
    if (!page || page.missing !== undefined) return null
    return page?.thumbnail?.source || null
  } catch { return null }
}

// ─── SOURCE 2: TheSportsDB ─────────────────────────────────────────────────
async function fetchFromTheSportsDB(teamName) {
  const key      = normalizeKey(teamName)
  const tsdbName = TSDB_NAMES[key] || teamName
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(tsdbName)}`
    const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(7000) })
    if (!res.ok) return null
    const data = await res.json()
    return data?.teams?.[0]?.strTeamBadge || null
  } catch { return null }
}

// ─── SOURCE 3: Wikipedia PT busca com variações ────────────────────────────
async function fetchFromWikiPtSearch(teamName) {
  // Gera variações: nome completo, sem sufixo, só a palavra principal
  const clean    = teamName.trim()
  const noSuffix = clean.replace(/\s+(FC|SC|AC|EC|AA|SE|CR|CF)$/i, '').replace(/^(AD|AA|EC|SC|AC|FC|CF)\s+/i, '').trim()
  const lastWord = noSuffix.split(/\s+/).pop()
  const queries  = [...new Set([clean, noSuffix, lastWord].filter(Boolean))]

  for (const query of queries) {
    try {
      const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' futebol clube')}&srlimit=3&format=json&origin=*`
      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(7000) })
      if (!searchRes.ok) continue
      const results = (await searchRes.json())?.query?.search || []

      const footballKw = ['futebol', 'esporte', 'atlético', 'sport', 'clube', ' fc', ' sc', ' ec']
      const hit = results.find(r => footballKw.some(kw => r.title.toLowerCase().includes(kw))) || results[0]
      if (!hit) continue

      const imgUrl = `https://pt.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=pageimages&pithumbsize=300&format=json&origin=*`
      const imgRes  = await fetch(imgUrl, { signal: AbortSignal.timeout(7000) })
      if (!imgRes.ok) continue
      const page = Object.values((await imgRes.json())?.query?.pages || {})[0]
      if (page?.thumbnail?.source) return page.thumbnail.source
    } catch { continue }
  }
  return null
}

// ─── GET /api/team-crest?team=Confiança ─────────────────────────────────────
// ?force=1 → ignora cache e re-busca
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const teamName = (searchParams.get('team') || '').trim()
  const force    = searchParams.get('force') === '1'

  if (!teamName) return NextResponse.json({ error: 'Parâmetro ?team= obrigatório.' }, { status: 400 })

  try {
    await ensureTable()
    const key = normalizeKey(teamName)

    // Cache hit — só usa se tiver URL válida e não for force
    if (!force) {
      const cached = await sql`SELECT crest_url, source FROM team_crests WHERE team_key = ${key}`
      if (cached.rows.length > 0 && cached.rows[0].crest_url) {
        return NextResponse.json({ team: teamName, url: cached.rows[0].crest_url, source: cached.rows[0].source, cached: true })
      }
    }

    // Tentar fontes em ordem
    let url = null, source = null

    url = await fetchFromWikiPtDirect(teamName)
    if (url) source = 'wikipedia-pt-direct'

    if (!url) { url = await fetchFromTheSportsDB(teamName); if (url) source = 'thesportsdb' }
    if (!url) { url = await fetchFromWikiPtSearch(teamName); if (url) source = 'wikipedia-pt-search' }

    // Só cacheia se achou — null nunca entra no cache
    if (url) {
      await sql`
        INSERT INTO team_crests (team_key, crest_url, source)
        VALUES (${key}, ${url}, ${source})
        ON CONFLICT (team_key) DO UPDATE
          SET crest_url = EXCLUDED.crest_url, source = EXCLUDED.source, fetched_at = NOW()
      `
    }

    return NextResponse.json({ team: teamName, url, source, cached: false })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST — override manual ────────────────────────────────────────────────
export async function POST(request) {
  try {
    await ensureTable()
    const { team, url } = await request.json()
    if (!team) return NextResponse.json({ error: 'team obrigatório.' }, { status: 400 })
    const key = normalizeKey(team)
    await sql`
      INSERT INTO team_crests (team_key, crest_url, source)
      VALUES (${key}, ${url || null}, 'manual')
      ON CONFLICT (team_key) DO UPDATE
        SET crest_url = EXCLUDED.crest_url, source = 'manual', fetched_at = NOW()
    `
    return NextResponse.json({ ok: true, team, url })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── DELETE — limpar cache ─────────────────────────────────────────────────
// ?team=Confiança → limpa um time
// ?all=1        → limpa tudo (força re-fetch de todos)
export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const team = searchParams.get('team')
    const all  = searchParams.get('all') === '1'
    if (all) { await sql`DELETE FROM team_crests`; return NextResponse.json({ ok: true, cleared: 'all' }) }
    if (!team) return NextResponse.json({ error: 'Use ?team=Nome ou ?all=1' }, { status: 400 })
    await sql`DELETE FROM team_crests WHERE team_key = ${normalizeKey(team)}`
    return NextResponse.json({ ok: true, team })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
