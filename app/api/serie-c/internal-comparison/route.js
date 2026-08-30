import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'

const DEFAULT_COMPETITION = 'Brasileiro Série C'

async function ensureBaselineTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_internal_baselines (
      id              SERIAL PRIMARY KEY,
      season          VARCHAR(20) NOT NULL,
      competition     VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      baseline_round  INTEGER NOT NULL,
      baseline_date   DATE,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW(),
      UNIQUE (season, competition)
    )
  `
}

function ymd(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    await ensureBaselineTable()

    const { searchParams } = new URL(request.url)
    const seasonParam = String(searchParams.get('season') || '').trim()
    const competition = String(searchParams.get('competition') || DEFAULT_COMPETITION).trim()

    const uploadsRes = seasonParam
      ? await sql`
          SELECT id, season, competition, round, upload_date, uploaded_at
          FROM serie_c_uploads
          WHERE season = ${seasonParam} AND competition = ${competition}
          ORDER BY round ASC
        `
      : await sql`
          SELECT id, season, competition, round, upload_date, uploaded_at
          FROM serie_c_uploads
          WHERE competition = ${competition}
          ORDER BY season DESC, round ASC
        `

    let uploads = uploadsRes.rows
    if (!uploads.length) return NextResponse.json({ uploads:[], players:[], goalkeepers:[], baseline:null, current:null })

    const season = seasonParam || String(uploads[0].season)
    uploads = uploads.filter(u => String(u.season) === season)
    const current = uploads[uploads.length - 1]

    let baselineRes = await sql`
      SELECT season, competition, baseline_round, baseline_date
      FROM serie_c_internal_baselines
      WHERE season = ${season} AND competition = ${competition}
      LIMIT 1
    `

    if (!baselineRes.rows.length) {
      await sql`
        INSERT INTO serie_c_internal_baselines (season, competition, baseline_round, baseline_date)
        VALUES (${season}, ${competition}, ${Number(current.round)}, ${current.upload_date || null})
        ON CONFLICT (season, competition) DO NOTHING
      `
      baselineRes = await sql`
        SELECT season, competition, baseline_round, baseline_date
        FROM serie_c_internal_baselines
        WHERE season = ${season} AND competition = ${competition}
        LIMIT 1
      `
    }

    const saved = baselineRes.rows[0]
    let baselineRound = Number(saved?.baseline_round || current.round)
    let baselineUpload = uploads.find(u => Number(u.round) === baselineRound)
    if (!baselineUpload) {
      baselineUpload = uploads.reduce((best, u) => Number(u.round) <= baselineRound ? u : best, uploads[0])
      baselineRound = Number(baselineUpload.round)
    }

    const relevantUploads = uploads.filter(u => Number(u.round) >= baselineRound)
    const ids = relevantUploads.map(u => Number(u.id)).filter(Number.isFinite)
    if (!ids.length) return NextResponse.json({ uploads, players:[], goalkeepers:[], baseline:null, current })

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    const [playersRes, gkRes] = await Promise.all([
      sql.query(`
        SELECT s.player, s.position, s.age, s.minutes, s.metrics, u.round, u.upload_date
        FROM serie_c_player_stats s
        JOIN serie_c_uploads u ON u.id = s.upload_id
        WHERE s.is_guarani = TRUE AND s.upload_id IN (${placeholders})
        ORDER BY s.player ASC, u.round ASC
      `, ids),
      sql.query(`
        SELECT s.player, 'GK' AS position, s.age, s.minutes, s.metrics, u.round, u.upload_date
        FROM serie_c_goalkeeper_stats s
        JOIN serie_c_uploads u ON u.id = s.upload_id
        WHERE s.is_guarani = TRUE AND s.upload_id IN (${placeholders})
        ORDER BY s.player ASC, u.round ASC
      `, ids),
    ])

    return NextResponse.json({
      season,
      competition,
      uploads: uploads.map(u => ({ ...u, upload_date:ymd(u.upload_date) })),
      baseline:{ round:baselineRound, date:ymd(saved?.baseline_date || baselineUpload.upload_date), uploadId:baselineUpload.id },
      current:{ round:Number(current.round), date:ymd(current.upload_date), uploadId:current.id },
      players:playersRes.rows.map(r => ({ ...r, round:Number(r.round), upload_date:ymd(r.upload_date) })),
      goalkeepers:gkRes.rows.map(r => ({ ...r, round:Number(r.round), upload_date:ymd(r.upload_date) })),
    })
  } catch (err) {
    return NextResponse.json({ error:err?.message || 'Falha ao carregar comparação interna.' }, { status:500 })
  }
}

export async function POST(request) {
  try {
    await ensureSerieCTables()
    await ensureBaselineTable()
    const body = await request.json()
    const season = String(body?.season || '').trim()
    const competition = String(body?.competition || DEFAULT_COMPETITION).trim()
    const baselineRound = Number(body?.baselineRound)
    if (!season || !Number.isFinite(baselineRound)) {
      return NextResponse.json({ error:'Temporada e rodada-base são obrigatórias.' }, { status:400 })
    }
    const uploadRes = await sql`
      SELECT upload_date FROM serie_c_uploads
      WHERE season = ${season} AND competition = ${competition} AND round = ${baselineRound}
      LIMIT 1
    `
    if (!uploadRes.rows.length) return NextResponse.json({ error:'Rodada-base não encontrada nos uploads.' }, { status:404 })
    const baselineDate = uploadRes.rows[0].upload_date || null
    await sql`
      INSERT INTO serie_c_internal_baselines (season, competition, baseline_round, baseline_date, updated_at)
      VALUES (${season}, ${competition}, ${baselineRound}, ${baselineDate}, NOW())
      ON CONFLICT (season, competition) DO UPDATE SET
        baseline_round = EXCLUDED.baseline_round,
        baseline_date = EXCLUDED.baseline_date,
        updated_at = NOW()
    `
    return NextResponse.json({ ok:true, baseline:{ round:baselineRound, date:ymd(baselineDate) } })
  } catch (err) {
    return NextResponse.json({ error:err?.message || 'Falha ao salvar rodada-base.' }, { status:500 })
  }
}
