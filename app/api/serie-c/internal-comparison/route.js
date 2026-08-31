import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'
import { normTeamName } from '../../../../lib/serieC'

const DEFAULT_COMPETITION = 'Brasileiro Série C'

function ymd(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}
function isConfianca(team, code) {
  return normTeamName(team).includes('CONFIANCA') || String(code || '').toUpperCase() === 'CON'
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    const { searchParams } = new URL(request.url)
    const seasonParam = String(searchParams.get('season') || '').trim()
    const competition = String(searchParams.get('competition') || DEFAULT_COMPETITION).trim()

    const uploadsRes = seasonParam
      ? await sql`
          SELECT id, season, competition, round, upload_date, uploaded_at
          FROM serie_c_uploads
          WHERE season = ${seasonParam} AND competition = ${competition}
          ORDER BY round ASC, uploaded_at ASC
        `
      : await sql`
          SELECT id, season, competition, round, upload_date, uploaded_at
          FROM serie_c_uploads
          WHERE competition = ${competition}
          ORDER BY season DESC, round ASC, uploaded_at ASC
        `

    let uploads = uploadsRes.rows
    if (!uploads.length) return NextResponse.json({ uploads:[], players:[], goalkeepers:[], matches:[], current:null })

    const season = seasonParam || String(uploads[0].season)
    uploads = uploads.filter(u => String(u.season) === season)
    const ids = uploads.map(u => Number(u.id)).filter(Number.isFinite)
    if (!ids.length) return NextResponse.json({ season, competition, uploads:[], players:[], goalkeepers:[], matches:[], current:null })

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    const [playersRes, gkRes, matchesRes] = await Promise.all([
      sql.query(`
        SELECT s.player, s.position, s.age, s.minutes, s.metrics, u.round, u.upload_date, u.id AS upload_id
        FROM serie_c_player_stats s
        JOIN serie_c_uploads u ON u.id = s.upload_id
        WHERE s.is_guarani = TRUE AND s.upload_id IN (${placeholders})
        ORDER BY s.player ASC, u.round ASC, u.uploaded_at ASC
      `, ids),
      sql.query(`
        SELECT s.player, 'GK' AS position, s.age, s.minutes, s.metrics, u.round, u.upload_date, u.id AS upload_id
        FROM serie_c_goalkeeper_stats s
        JOIN serie_c_uploads u ON u.id = s.upload_id
        WHERE s.is_guarani = TRUE AND s.upload_id IN (${placeholders})
        ORDER BY s.player ASC, u.round ASC, u.uploaded_at ASC
      `, ids),
      sql`
        SELECT id, round, match_date, home_team, away_team, home_code, away_code,
               home_score, away_score, home_metrics, away_metrics
        FROM serie_c_competition_matches
        WHERE season = ${season} AND competition = ${competition}
          AND (home_team ILIKE '%Confiança%' OR away_team ILIKE '%Confiança%' OR home_team ILIKE '%Confianca%' OR away_team ILIKE '%Confianca%' OR home_code = 'CON' OR away_code = 'CON')
        ORDER BY round ASC NULLS LAST, match_date ASC, id ASC
      `,
    ])

    const matches = matchesRes.rows.map(row => {
      const home = isConfianca(row.home_team, row.home_code)
      const away = isConfianca(row.away_team, row.away_code)
      return {
        id: row.id,
        round: Number(row.round),
        date: ymd(row.match_date),
        opponent: home ? row.away_team : row.home_team,
        mando: home ? 'Casa' : away ? 'Fora' : '',
        goalsFor: Number(home ? row.home_score : row.away_score) || 0,
        goalsAgainst: Number(home ? row.away_score : row.home_score) || 0,
        ownMetrics: home ? (row.home_metrics || {}) : (row.away_metrics || {}),
        opponentMetrics: home ? (row.away_metrics || {}) : (row.home_metrics || {}),
      }
    }).filter(m => m.opponent)

    const current = uploads.at(-1)
    return NextResponse.json({
      season,
      competition,
      uploads: uploads.map(u => ({ ...u, round:Number(u.round), upload_date:ymd(u.upload_date) })),
      current: current ? { round:Number(current.round), date:ymd(current.upload_date), uploadId:current.id } : null,
      players: playersRes.rows.map(r => ({ ...r, entityType:'player', round:Number(r.round), upload_date:ymd(r.upload_date) })),
      goalkeepers: gkRes.rows.map(r => ({ ...r, entityType:'goalkeeper', round:Number(r.round), upload_date:ymd(r.upload_date) })),
      matches,
    })
  } catch (err) {
    return NextResponse.json({ error:err?.message || 'Falha ao carregar evolução partida por partida.' }, { status:500 })
  }
}

export async function POST() {
  return NextResponse.json({ ok:true, deprecated:true, message:'A evolução agora é calculada partida por partida e não usa rodada-base.' })
}
