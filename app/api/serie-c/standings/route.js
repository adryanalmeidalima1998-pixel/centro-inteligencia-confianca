import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { ensureSerieCTables } from '../../../../lib/serieCDb'
import { validateSerieCStandingsRows } from '../../../../lib/serieCStandingsPdf'

export const maxDuration = 60

const DEFAULT_COMPETITION = 'Brasileiro Série C'
const MAX_PDF_BYTES = 12 * 1024 * 1024

function serializeSnapshot(row) {
  if (!row) return null
  return {
    id: row.id,
    season: row.season,
    competition: row.competition,
    round: Number(row.round),
    sourceFilename: row.source_filename,
    sourceUrl: row.source_url,
    sourcePage: Number(row.source_page || 2),
    referenceDate: row.reference_date,
    uploadedAt: row.uploaded_at,
    rows: Array.isArray(row.rows) ? row.rows : [],
    reportData: row.report_data && typeof row.report_data === 'object' ? row.report_data : {},
  }
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    const { searchParams } = new URL(request.url)
    const season = String(searchParams.get('season') || new Date().getFullYear()).trim()
    const competition = String(searchParams.get('competition') || DEFAULT_COMPETITION).trim()

    const [latestResult, historyResult, timelineResult] = await Promise.all([
      sql`
        SELECT id, season, competition, round, source_filename, source_url,
               source_page, reference_date, rows, report_data, uploaded_at
        FROM serie_c_standings_snapshots
        WHERE season = ${season} AND competition = ${competition}
        ORDER BY round DESC, uploaded_at DESC
        LIMIT 1
      `,
      sql`
        SELECT id, season, competition, round, source_filename, source_url,
               source_page, reference_date, uploaded_at,
               jsonb_array_length(rows) AS teams_count,
               CASE WHEN report_data IS NULL OR report_data = '{}'::jsonb THEN FALSE ELSE TRUE END AS has_report_data
        FROM serie_c_standings_snapshots
        WHERE season = ${season} AND competition = ${competition}
        ORDER BY round DESC, uploaded_at DESC
      `,
      sql`
        SELECT round, reference_date, rows, report_data
        FROM serie_c_standings_snapshots
        WHERE season = ${season} AND competition = ${competition}
        ORDER BY round ASC, uploaded_at ASC
      `,
    ])

    return NextResponse.json({
      snapshot: serializeSnapshot(latestResult.rows[0]),
      snapshots: historyResult.rows.map(row => ({
        id: row.id,
        season: row.season,
        competition: row.competition,
        round: Number(row.round),
        sourceFilename: row.source_filename,
        sourceUrl: row.source_url,
        sourcePage: Number(row.source_page || 2),
        referenceDate: row.reference_date,
        uploadedAt: row.uploaded_at,
        teamsCount: Number(row.teams_count || 0),
        hasReportData: Boolean(row.has_report_data),
      })),
      timeline: timelineResult.rows.map(row => {
        const rows = Array.isArray(row.rows) ? row.rows : []
        const clubStandingRow = rows.find(item => String(item?.team || '').toLocaleLowerCase('pt-BR').includes('confianca')) || null
        return {
          round: Number(row.round),
          referenceDate: row.reference_date,
          position: clubStandingRow?.position ?? null,
          points: clubStandingRow?.points ?? null,
          xg: clubStandingRow?.xg ?? null,
          xga: clubStandingRow?.xga ?? null,
          xgDiff: clubStandingRow && Number.isFinite(Number(clubStandingRow.xg)) && Number.isFinite(Number(clubStandingRow.xga)) ? Number(clubStandingRow.xg) - Number(clubStandingRow.xga) : null,
          xPoints: clubStandingRow?.xPoints ?? null,
          reportData: row.report_data && typeof row.report_data === 'object' ? row.report_data : {},
        }
      }),
    })
  } catch (error) {
    console.error('[GET /api/serie-c/standings]', error)
    return NextResponse.json({ snapshot: null, snapshots: [], error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureSerieCTables()
    const form = await request.formData()

    const season = String(form.get('season') || '').trim()
    const competition = String(form.get('competition') || DEFAULT_COMPETITION).trim()
    const round = Number(form.get('round'))
    const sourcePage = Number(form.get('sourcePage') || 2)
    const referenceDate = form.get('referenceDate') ? String(form.get('referenceDate')) : null
    const standingsJson = String(form.get('standingsJson') || '')
    const reportJson = String(form.get('reportJson') || '{}')
    const file = form.get('file')

    if (!season || !Number.isInteger(round) || round <= 0) {
      return NextResponse.json({ error: 'Informe temporada e rodada válidas.' }, { status: 400 })
    }
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Envie o PDF do relatório da época.' }, { status: 400 })
    }
    const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf')
    if (!isPdf) return NextResponse.json({ error: 'O arquivo da classificação precisa estar em PDF.' }, { status: 400 })
    if (Number(file.size || 0) > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'O PDF ultrapassa o limite de 12 MB.' }, { status: 400 })
    }

    let parsedRows
    try {
      parsedRows = JSON.parse(standingsJson)
    } catch (_) {
      return NextResponse.json({ error: 'Os dados extraídos do PDF estão inválidos. Selecione o arquivo novamente.' }, { status: 400 })
    }

    let reportData = {}
    try {
      const parsedReport = JSON.parse(reportJson)
      if (parsedReport && typeof parsedReport === 'object' && !Array.isArray(parsedReport)) reportData = parsedReport
    } catch (_) {
      reportData = {}
    }

    const validation = validateSerieCStandingsRows(parsedRows)
    if (!validation.ok) {
      return NextResponse.json({
        error: 'A classificação extraída não passou na validação.',
        details: validation.errors,
      }, { status: 400 })
    }

    const safeFileName = String(file.name || 'classificacao.pdf')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 180)
    const blobPath = `confianca/serie-c/classificacao/${season}/rodada-${round}/${Date.now()}-${safeFileName}`
    const blob = await put(blobPath, file, { access: 'public' })

    const result = await sql`
      INSERT INTO serie_c_standings_snapshots
        (season, competition, round, source_filename, source_url, source_page, reference_date, rows, report_data)
      VALUES
        (${season}, ${competition}, ${round}, ${file.name}, ${blob.url}, ${sourcePage}, ${referenceDate}, ${JSON.stringify(validation.rows)}::jsonb, ${JSON.stringify(reportData)}::jsonb)
      ON CONFLICT (season, competition, round)
      DO UPDATE SET
        source_filename = EXCLUDED.source_filename,
        source_url = EXCLUDED.source_url,
        source_page = EXCLUDED.source_page,
        reference_date = EXCLUDED.reference_date,
        rows = EXCLUDED.rows,
        report_data = EXCLUDED.report_data,
        uploaded_at = NOW()
      RETURNING id, season, competition, round, source_filename, source_url,
                source_page, reference_date, rows, report_data, uploaded_at
    `

    const clubRow = validation.rows.find(row => String(row.team || '').toLocaleLowerCase('pt-BR').includes('confianca'))
    if (clubRow?.position) {
      try {
        await sql`
          UPDATE serie_c_uploads
          SET club_position = ${Number(clubRow.position)}
          WHERE season = ${season} AND competition = ${competition} AND round = ${round}
        `
      } catch (_) {}
      try {
        await sql`
          UPDATE serie_c_club_matches
          SET position = ${Number(clubRow.position)}
          WHERE season = ${season} AND competition = ${competition} AND round = ${round}
        `
      } catch (_) {}
    }

    return NextResponse.json({ ok: true, snapshot: serializeSnapshot(result.rows[0]) })
  } catch (error) {
    console.error('[POST /api/serie-c/standings]', error)
    return NextResponse.json({ error: error.message || 'Falha ao salvar a classificação.' }, { status: 500 })
  }
}
