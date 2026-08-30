import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'

const DEFAULT_COMPETITION = 'Brasileiro Série C'

function safeJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function mapRow(row) {
  return {
    localId: row.local_id,
    season: row.season,
    competition: row.competition,
    matchDate: row.match_date ? new Date(row.match_date).toISOString().slice(0, 10) : '',
    opponent: row.opponent,
    homeAway: row.home_away || 'M',
    round: row.round ?? '',
    venue: row.venue || '',
    notes: row.notes || '',
    status: row.status || 'open',
    activeHalf: row.active_half || 1,
    firstHalfFinishedAt: row.first_half_finished_at ? new Date(row.first_half_finished_at).toISOString() : null,
    secondHalfFinishedAt: row.second_half_finished_at ? new Date(row.second_half_finished_at).toISOString() : null,
    timer: safeJson(row.timer, { half1Elapsed: 0, half2Elapsed: 0, runningHalf: null, startedAt: null }),
    events: safeJson(row.events, []),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    syncedAt: new Date().toISOString(),
    dirty: false,
    deletedAt: null,
  }
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season') || '2026'
    const competition = searchParams.get('competition') || DEFAULT_COMPETITION
    const result = await sql`
      SELECT * FROM serie_c_live_matches
      WHERE season = ${season} AND competition = ${competition}
      ORDER BY match_date DESC, updated_at DESC
    `
    return NextResponse.json({ matches: result.rows.map(mapRow) })
  } catch (error) {
    return NextResponse.json({ matches: [], error: error.message || 'Falha ao carregar coletas.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureSerieCTables()
    const body = await request.json()
    const match = body?.match
    if (!match?.localId) return NextResponse.json({ error: 'Partida sem identificador local.' }, { status: 400 })

    if (match.deletedAt) {
      await sql`DELETE FROM serie_c_live_matches WHERE local_id = ${match.localId}`
      return NextResponse.json({ ok: true, deleted: true, localId: match.localId })
    }

    const season = String(match.season || '2026')
    const competition = String(match.competition || DEFAULT_COMPETITION)
    const opponent = String(match.opponent || '').trim()
    if (!opponent) return NextResponse.json({ error: 'Informe o adversário.' }, { status: 400 })

    const result = await sql`
      INSERT INTO serie_c_live_matches (
        local_id, season, competition, match_date, opponent, home_away, round,
        venue, notes, status, active_half, first_half_finished_at,
        second_half_finished_at, timer, events, created_at, updated_at
      ) VALUES (
        ${match.localId}, ${season}, ${competition}, ${match.matchDate || null}, ${opponent},
        ${match.homeAway || 'M'}, ${match.round ? Number(match.round) : null}, ${match.venue || null},
        ${match.notes || null}, ${match.status || 'open'}, ${Number(match.activeHalf || 1)},
        ${match.firstHalfFinishedAt || null}, ${match.secondHalfFinishedAt || null},
        ${JSON.stringify(match.timer || {})}::jsonb, ${JSON.stringify(match.events || [])}::jsonb,
        ${match.createdAt || new Date().toISOString()}, NOW()
      )
      ON CONFLICT (local_id) DO UPDATE SET
        season = EXCLUDED.season,
        competition = EXCLUDED.competition,
        match_date = EXCLUDED.match_date,
        opponent = EXCLUDED.opponent,
        home_away = EXCLUDED.home_away,
        round = EXCLUDED.round,
        venue = EXCLUDED.venue,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        active_half = EXCLUDED.active_half,
        first_half_finished_at = EXCLUDED.first_half_finished_at,
        second_half_finished_at = EXCLUDED.second_half_finished_at,
        timer = EXCLUDED.timer,
        events = EXCLUDED.events,
        updated_at = NOW()
      RETURNING *
    `
    return NextResponse.json({ ok: true, match: mapRow(result.rows[0]) })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Falha ao sincronizar partida.' }, { status: 500 })
  }
}
