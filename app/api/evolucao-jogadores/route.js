import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { buildEvolutionReport, resolveEvolutionPeriod } from '@/lib/player-evolution'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VISIBLE_ALERT_TYPES = ['growth', 'decline', 'newU23Top5', 'clubChanges']

function sanitizeAlerts(alerts = {}) {
  return VISIBLE_ALERT_TYPES.reduce((clean, key) => {
    clean[key] = Array.isArray(alerts?.[key]) ? alerts[key] : []
    return clean
  }, {})
}

function sanitizeEvolutionReport(report) {
  const cleanAlerts = sanitizeAlerts(report?.alerts)
  const leagues = (report?.leagues || []).map(league => ({
    ...league,
    alerts: sanitizeAlerts(league?.alerts),
  }))
  return {
    ...report,
    alerts: cleanAlerts,
    leagues,
    summary: {
      ...(report?.summary || {}),
      alerts: Object.values(cleanAlerts).reduce((sum, items) => sum + items.length, 0),
    },
  }
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS liga_jogadores (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '[]'::jsonb,
      total INTEGER DEFAULT 0,
      fonte TEXT DEFAULT 'sportsbase',
      engine_version TEXT,
      schema_version TEXT,
      season INTEGER,
      upload_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0`
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'sportsbase'`
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS engine_version TEXT`
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS schema_version TEXT`
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS season INTEGER`
  await sql`UPDATE liga_jogadores SET season = EXTRACT(YEAR FROM upload_at)::INTEGER WHERE season IS NULL`
  await sql`UPDATE liga_jogadores SET engine_version = 'legacy' WHERE engine_version IS NULL`
  await sql`UPDATE liga_jogadores SET schema_version = COALESCE(fonte, 'unknown') || '-legacy' WHERE schema_version IS NULL`
  await sql`CREATE INDEX IF NOT EXISTS liga_jogadores_evolucao_idx ON liga_jogadores (slug, fonte, upload_at)`
  await sql`CREATE INDEX IF NOT EXISTS liga_jogadores_temporada_idx ON liga_jogadores (season, slug, fonte)`
}

function parseLeagues(searchParams) {
  const repeated = searchParams.getAll('league')
  const csv = String(searchParams.get('leagues') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  return [...new Set([...repeated, ...csv].filter(value => value && value !== 'all'))]
}

export async function GET(request) {
  await ensureLigaJogadoresSchema()
  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  const periodType = searchParams.get('periodType') || 'season'
  const periodIndex = Number(searchParams.get('periodIndex')) || 1
  const source = searchParams.get('source') || 'auto'
  const leagues = parseLeagues(searchParams)
  const minimumMinutes = Math.max(0, Number(searchParams.get('minimumMinutes')) || 0)
  const marketScope = searchParams.get('marketScope') || 'immediate'
  const limit = Number(searchParams.get('limit')) || 5
  const period = resolveEvolutionPeriod(year, periodType, periodIndex)

  try {
    await ensureTable()
    const params = [year, period.seasonStartIso, period.seasonEndIso]
    let leagueClause = ''
    if (leagues.length) {
      const placeholders = leagues.map(league => {
        params.push(league)
        return `$${params.length}`
      })
      leagueClause = `AND slug IN (${placeholders.join(', ')})`
    }

    const result = await sql.query(`
      SELECT id, slug, fonte, data, total, engine_version, schema_version, season, upload_at
      FROM liga_jogadores
      WHERE (
        season = $1
        OR (season IS NULL AND upload_at >= $2 AND upload_at < $3)
      )
      ${leagueClause}
      ORDER BY slug, fonte, upload_at ASC
    `, params)

    const report = buildEvolutionReport(result.rows, {
      year,
      periodType,
      periodIndex,
      source,
      leagues,
      minimumMinutes,
      marketScope,
      limit,
    })

    return NextResponse.json(sanitizeEvolutionReport(report))
  } catch (error) {
    console.error('[evolucao-jogadores]', error)
    return NextResponse.json({ error: error.message || 'Não foi possível gerar o painel de evolução.' }, { status: 500 })
  }
}
