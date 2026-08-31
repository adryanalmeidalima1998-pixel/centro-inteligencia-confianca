import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'
import { buildCompetitionMatchRecords, parseCompetitionWorkbookFile } from '../../../../lib/serieCParse'
import seedMatches from '../../../../lib/data/serieCMatchesSeed2026.json'
import { normTeamName, toNumber } from '../../../../lib/serieC'

export const maxDuration = 60

function expectedGoals(metrics) {
  if (!metrics) return null
  const aliases = ['Golos esperados', 'Gols esperados', 'xG', 'Expected goals']
  const keys = Object.keys(metrics)
  const key = aliases.map(alias => keys.find(k => normTeamName(k) === normTeamName(alias))).find(Boolean)
  return key ? toNumber(metrics[key]) : null
}

function dateKey(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10)
}

function normalizedMatchKey(record) {
  return `${dateKey(record.matchDate)}|${normTeamName(record.homeTeam)}|${normTeamName(record.awayTeam)}`
}

function normalizedPairKey(record) {
  return `${normTeamName(record.homeTeam)}|${normTeamName(record.awayTeam)}`
}

function dayDistance(a, b) {
  const first = new Date(`${dateKey(a)}T12:00:00Z`).getTime()
  const second = new Date(`${dateKey(b)}T12:00:00Z`).getTime()
  if (!Number.isFinite(first) || !Number.isFinite(second)) return Number.POSITIVE_INFINITY
  return Math.abs(first - second) / 86400000
}


function clubTokens(value) {
  const stop = new Set(['FC','EC','SC','AA','AD','SAF','CLUBE','CLUB','DE','DA','DO','DAS','DOS','ESPORTE','SPORT'])
  return normTeamName(value).split(' ').filter(token => token && !stop.has(token))
}

function sameClubName(a, b) {
  const na = normTeamName(a), nb = normTeamName(b)
  if (!na || !nb) return false
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  const ta = clubTokens(a), tb = clubTokens(b)
  if (!ta.length || !tb.length) return false
  const shared = ta.filter(token => tb.includes(token))
  return shared.length / Math.min(ta.length, tb.length) >= 0.5
}

function sameMatchPair(record, row) {
  return sameClubName(record.homeTeam, row.home_team) && sameClubName(record.awayTeam, row.away_team)
}
function isGuaraniIdentity(team, code) {
  return normTeamName(team).includes('CONFIANCA') || normTeamName(code) === 'CON'
}

async function syncGuaraniTimeline(records, season, competition) {
  const guaraniRecords = records.filter(record =>
    isGuaraniIdentity(record.homeTeam, record.homeCode) || isGuaraniIdentity(record.awayTeam, record.awayCode)
  )
  if (!guaraniRecords.length) return 0

  const current = await sql`
    SELECT id, match_date, opponent
    FROM serie_c_guarani_matches
    WHERE season = ${season} AND competition = ${competition}
  `
  const existingByOpponent = new Map()
  for (const row of current.rows) {
    const key = normTeamName(row.opponent)
    const bucket = existingByOpponent.get(key) || []
    bucket.push(row)
    existingByOpponent.set(key, bucket)
  }

  let synced = 0
  for (const record of guaraniRecords) {
    const isHome = isGuaraniIdentity(record.homeTeam, record.homeCode)
    const opponentRaw = isHome ? record.awayTeam : record.homeTeam
    const exactCandidates = existingByOpponent.get(normTeamName(opponentRaw)) || []
    const candidates = exactCandidates.length ? exactCandidates : current.rows.filter(row => sameClubName(row.opponent, opponentRaw))
    const nearest = candidates
      .map(row => ({ row, distance: dayDistance(record.matchDate, row.match_date) }))
      .filter(item => item.distance <= 2)
      .sort((a, b) => a.distance - b.distance)[0]?.row
    const matchDate = nearest ? dateKey(nearest.match_date) : dateKey(record.matchDate)
    const opponent = nearest?.opponent || opponentRaw
    const metrics = isHome ? record.homeMetrics : record.awayMetrics
    const score = `${record.homeScore}:${record.awayScore}`
    const mando = isHome ? 'M' : 'V'

    await sql`
      INSERT INTO serie_c_guarani_matches
        (season, competition, match_date, mando, opponent, score, round, metrics)
      VALUES
        (${season}, ${competition}, ${matchDate}, ${mando}, ${opponent}, ${score}, ${record.round || null}, ${JSON.stringify(metrics)}::jsonb)
      ON CONFLICT (season, competition, match_date, opponent) DO UPDATE SET
        mando = EXCLUDED.mando,
        score = EXCLUDED.score,
        round = COALESCE(serie_c_guarani_matches.round, EXCLUDED.round),
        metrics = serie_c_guarani_matches.metrics || EXCLUDED.metrics
    `
    synced += 1
  }
  return synced
}

function buildSummary(rows) {
  const goals = rows.reduce((sum, row) => sum + Number(row.home_score || 0) + Number(row.away_score || 0), 0)
  const rounds = Array.from(new Set(rows.map(row => row.round).filter(Boolean))).sort((a, b) => a - b)
  const teams = Array.from(new Set(rows.flatMap(row => [row.home_team, row.away_team]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return {
    matches: rows.length,
    goals,
    goalsPerMatch: rows.length ? goals / rows.length : 0,
    rounds: rounds.length,
    latestRound: rounds.at(-1) || null,
    teams: teams.length,
  }
}

function seedPayload({ round, team } = {}) {
  let rows = [...seedMatches]
  if (round) rows = rows.filter(row => String(row.round) === String(round))
  if (team) {
    const query = String(team).toLowerCase()
    rows = rows.filter(row => `${row.home_team} ${row.away_team} ${row.home_code} ${row.away_code}`.toLowerCase().includes(query))
  }
  rows.sort((a, b) => b.round - a.round || String(b.match_date).localeCompare(String(a.match_date)))
  return {
    matches: rows,
    rounds: Array.from(new Set(seedMatches.map(row => row.round))).sort((a, b) => a - b),
    teams: Array.from(new Set(seedMatches.flatMap(row => [row.home_team, row.away_team]))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    summary: buildSummary(rows),
    source: 'embedded-spreadsheet',
  }
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season') || '2026'
    const competition = searchParams.get('competition') || 'Brasileiro Série C'
    const round = searchParams.get('round')
    const team = searchParams.get('team')

    let result
    if (round && team) {
      result = await sql`
        SELECT * FROM serie_c_competition_matches
        WHERE season = ${season} AND competition = ${competition}
          AND round = ${Number(round)}
          AND (home_team ILIKE ${`%${team}%`} OR away_team ILIKE ${`%${team}%`} OR home_code ILIKE ${`%${team}%`} OR away_code ILIKE ${`%${team}%`})
        ORDER BY match_date DESC, id DESC
      `
    } else if (round) {
      result = await sql`
        SELECT * FROM serie_c_competition_matches
        WHERE season = ${season} AND competition = ${competition} AND round = ${Number(round)}
        ORDER BY match_date DESC, id DESC
      `
    } else if (team) {
      result = await sql`
        SELECT * FROM serie_c_competition_matches
        WHERE season = ${season} AND competition = ${competition}
          AND (home_team ILIKE ${`%${team}%`} OR away_team ILIKE ${`%${team}%`} OR home_code ILIKE ${`%${team}%`} OR away_code ILIKE ${`%${team}%`})
        ORDER BY round DESC NULLS LAST, match_date DESC, id DESC
      `
    } else {
      result = await sql`
        SELECT * FROM serie_c_competition_matches
        WHERE season = ${season} AND competition = ${competition}
        ORDER BY round DESC NULLS LAST, match_date DESC, id DESC
      `
    }

    const meta = await sql`
      SELECT DISTINCT round FROM serie_c_competition_matches
      WHERE season = ${season} AND competition = ${competition} AND round IS NOT NULL
      ORDER BY round ASC
    `
    const teamMeta = await sql`
      SELECT home_team AS team FROM serie_c_competition_matches WHERE season = ${season} AND competition = ${competition}
      UNION
      SELECT away_team AS team FROM serie_c_competition_matches WHERE season = ${season} AND competition = ${competition}
      ORDER BY team ASC
    `

    if (result.rows.length === 0 && meta.rows.length === 0 && season === '2026') {
      return NextResponse.json(seedPayload({ round, team }))
    }

    return NextResponse.json({
      matches: result.rows,
      rounds: meta.rows.map(row => row.round),
      teams: teamMeta.rows.map(row => row.team),
      summary: buildSummary(result.rows),
      source: 'database',
    })
  } catch (err) {
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season') || '2026'
    if (season === '2026') {
      return NextResponse.json({ ...seedPayload({ round: searchParams.get('round'), team: searchParams.get('team') }), warning: err.message })
    }
    return NextResponse.json({ matches: [], rounds: [], teams: [], error: err.message || 'Falha ao carregar partidas.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureSerieCTables()
    const form = await request.formData()
    const season = String(form.get('season') || '2026').trim()
    const competition = String(form.get('competition') || 'Brasileiro Série C').trim()
    const file = form.get('file')

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Envie a planilha de estatísticas das partidas.' }, { status: 400 })
    }

    const rawRows = await parseCompetitionWorkbookFile(file)
    const records = buildCompetitionMatchRecords(rawRows)
    if (!records.length) {
      return NextResponse.json({ error: 'Nenhuma partida válida foi encontrada. Aceito: Data + Match + Time ou Data + Jogo + Equipa.' }, { status: 400 })
    }

    // Evita duplicar partidas quando uma exportação usa acentos (Anápolis) e
    // outra não (Anapolis). Se a partida já existe com os mesmos times/data
    // após normalização, reutilizamos exatamente os nomes gravados no banco.
    const existingResult = await sql`
      SELECT round, match_date, home_team, away_team, home_code, away_code
      FROM serie_c_competition_matches
      WHERE season = ${season} AND competition = ${competition}
    `
    const existingRows = existingResult.rows
    const existingMap = new Map()
    const existingByPair = new Map()
    for (const row of existingRows) {
      const date = dateKey(row.match_date)
      const pair = `${normTeamName(row.home_team)}|${normTeamName(row.away_team)}`
      existingMap.set(`${date}|${pair}`, row)
      const bucket = existingByPair.get(pair) || []
      bucket.push(row)
      existingByPair.set(pair, bucket)
    }
    for (const record of records) {
      let existing = existingMap.get(normalizedMatchKey(record))
      if (!existing) {
        const exactCandidates = existingByPair.get(normalizedPairKey(record)) || []
        const candidates = exactCandidates.length ? exactCandidates : existingRows.filter(row => sameMatchPair(record, row))
        existing = candidates
          .map(row => ({ row, distance: dayDistance(record.matchDate, row.match_date) }))
          .filter(item => item.distance <= 2)
          .sort((a, b) => a.distance - b.distance)[0]?.row
      }
      if (!existing) continue
      // Algumas exportações Wyscout usam a data UTC e aparecem um dia depois.
      // Ao reconhecer o mesmo confronto, reutilizamos data/rodada da partida já gravada.
      record.matchDate = dateKey(existing.match_date)
      if (existing.round) record.round = Number(existing.round)
      record.homeTeam = existing.home_team
      record.awayTeam = existing.away_team
      if (!record.homeCode) record.homeCode = existing.home_code
      if (!record.awayCode) record.awayCode = existing.away_code
    }

    const chunkSize = 20
    let imported = 0
    for (let start = 0; start < records.length; start += chunkSize) {
      const chunk = records.slice(start, start + chunkSize)
      const placeholders = []
      const params = []
      chunk.forEach((record, index) => {
        const base = index * 14
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}::jsonb, $${base + 13}::jsonb, $${base + 14})`)
        params.push(
          season,
          competition,
          record.round,
          record.matchDate,
          record.matchLabel,
          record.homeTeam,
          record.awayTeam,
          record.homeCode,
          record.awayCode,
          record.homeScore,
          record.awayScore,
          JSON.stringify(record.homeMetrics),
          JSON.stringify(record.awayMetrics),
          file.name || null,
        )
      })

      await sql.query(`
        INSERT INTO serie_c_competition_matches
          (season, competition, round, match_date, match_label, home_team, away_team,
           home_code, away_code, home_score, away_score, home_metrics, away_metrics, source_filename)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (season, competition, match_date, home_team, away_team) DO UPDATE SET
          round = EXCLUDED.round,
          match_label = EXCLUDED.match_label,
          home_code = COALESCE(EXCLUDED.home_code, serie_c_competition_matches.home_code),
          away_code = COALESCE(EXCLUDED.away_code, serie_c_competition_matches.away_code),
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          home_metrics = serie_c_competition_matches.home_metrics || EXCLUDED.home_metrics,
          away_metrics = serie_c_competition_matches.away_metrics || EXCLUDED.away_metrics,
          source_filename = EXCLUDED.source_filename,
          imported_at = NOW()
      `, params)
      imported += chunk.length
    }

    const xgMatches = records.filter(record => expectedGoals(record.homeMetrics) !== null && expectedGoals(record.awayMetrics) !== null).length
    const guaraniTimelineMatches = await syncGuaraniTimeline(records, season, competition)
    return NextResponse.json({
      ok: true,
      imported,
      xgMatches,
      guaraniTimelineMatches,
      rounds: Math.max(...records.map(record => record.round || 0)),
      firstDate: records[0]?.matchDate,
      lastDate: records.at(-1)?.matchDate,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Falha ao importar as partidas.' }, { status: 500 })
  }
}
