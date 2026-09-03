// app/api/serie-c/matches/route.js
// Histórico de jogos do Confiança (planilha "Estatísticas da partida").
// GET  -> lista os jogos importados (ordenados por rodada, depois por data)
// POST -> importa/atualiza a planilha inteira (upsert por data+adversário,
//         SEM sobrescrever rodada e posição já cadastradas manualmente)
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'
import { parseWorkbookFile, buildMatchRecords } from '../../../../lib/serieCParse'
import { matchDateKey } from '../../../../lib/serieCMatch'
import { normTeamName, valueFromMetricAny } from '../../../../lib/serieC'
import { isCurrentClubIdentity } from '../../../../lib/club-config'

export const maxDuration = 60

const XG_ALIASES = ['Golos esperados', 'Gols esperados', 'xG', 'Expected goals']


function clubXgFromCompetition(row) {
  const homeIsClub = isCurrentClubIdentity(row.home_team, row.home_code)
  const awayIsClub = isCurrentClubIdentity(row.away_team, row.away_code)
  if (!homeIsClub && !awayIsClub) return null
  const ownMetrics = homeIsClub ? row.home_metrics : row.away_metrics
  const oppMetrics = homeIsClub ? row.away_metrics : row.home_metrics
  const xg = valueFromMetricAny(ownMetrics, XG_ALIASES)
  const xga = valueFromMetricAny(oppMetrics, XG_ALIASES)
  if (xg === null && xga === null) return null
  return {
    opponent: homeIsClub ? row.away_team : row.home_team,
    xg,
    xga,
    xgDiff: xg !== null && xga !== null ? xg - xga : null,
  }
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season')
    const competition = searchParams.get('competition') || 'Brasileiro Série C'

    const res = season
      ? await sql`
          SELECT * FROM serie_c_club_matches
          WHERE season = ${season} AND competition = ${competition}
          ORDER BY round ASC NULLS LAST, match_date ASC
        `
      : await sql`
          SELECT * FROM serie_c_club_matches
          WHERE competition = ${competition}
          ORDER BY season DESC, round ASC NULLS LAST, match_date ASC
        `
    let matches = res.rows
    if (season && matches.length) {
      const xgRes = await sql`
        SELECT match_date, home_team, away_team, home_code, away_code, home_metrics, away_metrics
        FROM serie_c_competition_matches
        WHERE season = ${season} AND competition = ${competition}
          AND (home_team ILIKE '%Confiança%' OR away_team ILIKE '%Confiança%' OR home_code = 'CON' OR away_code = 'CON')
      `
      const xgMap = new Map()
      const xgByOpponent = new Map()
      for (const row of xgRes.rows) {
        const info = clubXgFromCompetition(row)
        if (!info) continue
        const date = matchDateKey(row.match_date)
        const opponent = normTeamName(info.opponent)
        const enriched = { ...info, date }
        xgMap.set(`${date}|${opponent}`, enriched)
        const bucket = xgByOpponent.get(opponent) || []
        bucket.push(enriched)
        xgByOpponent.set(opponent, bucket)
      }
      matches = matches.map(match => {
        const date = matchDateKey(match.match_date)
        const opponent = normTeamName(match.opponent)
        let info = xgMap.get(`${date}|${opponent}`)
        if (!info) {
          info = (xgByOpponent.get(opponent) || [])
            .map(item => ({ item, distance: Math.abs(new Date(`${date}T12:00:00Z`) - new Date(`${item.date}T12:00:00Z`)) / 86400000 }))
            .filter(entry => entry.distance <= 2)
            .sort((a, b) => a.distance - b.distance)[0]?.item
        }
        return info ? { ...match, xg: info.xg, xga: info.xga, xg_diff: info.xgDiff } : match
      })
    }
    return NextResponse.json({ matches })
  } catch (err) {
    return NextResponse.json({ matches: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureSerieCTables()
    const form = await request.formData()
    const season = String(form.get('season') || '').trim()
    const competition = String(form.get('competition') || 'Brasileiro Série C').trim()
    const file = form.get('file')

    if (!season) return NextResponse.json({ error: 'Informe a temporada.' }, { status: 400 })
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Envie o arquivo da planilha de partidas.' }, { status: 400 })
    }

    const rawRows = await parseWorkbookFile(file)
    const records = buildMatchRecords(rawRows)
    if (records.length === 0) {
      return NextResponse.json({ error: 'Nenhuma partida foi encontrada nessa planilha.' }, { status: 400 })
    }

    // Upsert em lote: mantém round/position se o jogo já existir (não apaga
    // o que foi cadastrado manualmente), só atualiza placar e métricas.
    const CHUNK = 40
    let imported = 0
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      const placeholders = []
      const params = []
      chunk.forEach((r, idx) => {
        const base = idx * 7
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb)`)
        params.push(season, competition, r.matchDate, r.mando, r.opponent, r.score, JSON.stringify(r.metrics))
      })
      const queryText = `
        INSERT INTO serie_c_club_matches (season, competition, match_date, mando, opponent, score, metrics)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (season, competition, match_date, opponent) DO UPDATE SET
          mando = EXCLUDED.mando,
          score = EXCLUDED.score,
          metrics = EXCLUDED.metrics
      `
      await sql.query(queryText, params)
      imported += chunk.length
    }

    return NextResponse.json({ ok: true, imported })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Falha ao importar jogos.' }, { status: 500 })
  }
}
