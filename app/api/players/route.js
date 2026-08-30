import staticM from '../../../data/players_mercado.json'
import staticE from '../../../data/players_elenco.json'
import { sql } from '@vercel/postgres'

let dbCache = { mercado: null, elenco: null, ts: 0 }
const CACHE_TTL = 60 * 1000 // 60s

async function getFromDB(section) {
  try {
    const rows = await sql`
      SELECT posicao_label, players_json
      FROM wyscout_uploads WHERE section = ${section}
    `
    if (rows.rows.length === 0) return null
    const all = []
    for (const row of rows.rows) {
      const arr = JSON.parse(row.players_json)
      all.push(...arr)
    }
    return all
  } catch {
    return null
  }
}

async function getPlayers(section) {
  const now = Date.now()
  // Cache em memória por 60s para evitar queries repetidas
  if (dbCache[section] && (now - dbCache.ts) < CACHE_TTL) {
    return dbCache[section]
  }
  const db = await getFromDB(section)
  if (db && db.length > 0) {
    dbCache[section] = db
    dbCache.ts = now
    return db
  }
  return section === 'elenco' ? staticE : staticM
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const section  = searchParams.get('section') || 'mercado'
    const posicao  = searchParams.get('posicao') || ''
    const search   = searchParams.get('search') || ''
    const limit    = parseInt(searchParams.get('limit') || '5000')

    let players = await getPlayers(section)

    if (posicao) players = players.filter(p => (p['_posicao_label'] || p['Posição'] || '') === posicao)
    if (search) {
      const q = search.toLowerCase()
      players = players.filter(p =>
        (p['Jogador'] || '').toLowerCase().includes(q) ||
        (p['Time'] || '').toLowerCase().includes(q)
      )
    }

    return Response.json({
      players: players.slice(0, limit),
      total: players.length,
      source: await getFromDB(section).then(d => d && d.length > 0 ? 'db' : 'static').catch(() => 'static'),
    })
  } catch (err) {
    return Response.json({ players: [], total: 0, error: err.message }, { status: 500 })
  }
}
