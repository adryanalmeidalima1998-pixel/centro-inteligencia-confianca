import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'

export const maxDuration = 60

const DEFAULT_COMPETITION = 'Brasileiro Série C'
const MAX_PDF_BYTES = 20 * 1024 * 1024

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_team_reports (
      id SERIAL PRIMARY KEY,
      season VARCHAR(20) NOT NULL,
      competition VARCHAR(120) NOT NULL,
      round INTEGER NOT NULL,
      source_filename TEXT NOT NULL,
      source_url TEXT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (season, competition, round)
    )
  `
}

function serialize(row) {
  if (!row) return null
  return {
    id: row.id,
    season: row.season,
    competition: row.competition,
    round: Number(row.round),
    sourceFilename: row.source_filename,
    sourceUrl: row.source_url,
    uploadedAt: row.uploaded_at,
  }
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const season = String(searchParams.get('season') || new Date().getFullYear())
    const competition = String(searchParams.get('competition') || DEFAULT_COMPETITION)
    const result = await sql`
      SELECT id, season, competition, round, source_filename, source_url, uploaded_at
      FROM serie_c_team_reports
      WHERE season = ${season} AND competition = ${competition}
      ORDER BY round DESC, uploaded_at DESC
    `
    return NextResponse.json({ reports: result.rows.map(serialize), latest: serialize(result.rows[0]) })
  } catch (error) {
    return NextResponse.json({ reports: [], latest: null, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const form = await request.formData()
    const season = String(form.get('season') || '').trim()
    const competition = String(form.get('competition') || DEFAULT_COMPETITION).trim()
    const round = Number(form.get('round'))
    const file = form.get('file')

    if (!season || !Number.isInteger(round) || round <= 0) {
      return NextResponse.json({ error: 'Informe temporada e rodada válidas.' }, { status: 400 })
    }
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Envie o PDF do relatório de equipe.' }, { status: 400 })
    }
    const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf')
    if (!isPdf) return NextResponse.json({ error: 'O relatório de equipe precisa estar em PDF.' }, { status: 400 })
    if (Number(file.size || 0) > MAX_PDF_BYTES) return NextResponse.json({ error: 'O PDF ultrapassa 20 MB.' }, { status: 400 })

    const safeName = String(file.name || 'relatorio-equipe.pdf')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 180)
    const blobPath = `confianca/serie-c/relatorio-equipe/${season}/rodada-${round}/${Date.now()}-${safeName}`
    const blob = await put(blobPath, file, { access: 'public' })

    const result = await sql`
      INSERT INTO serie_c_team_reports (season, competition, round, source_filename, source_url)
      VALUES (${season}, ${competition}, ${round}, ${file.name}, ${blob.url})
      ON CONFLICT (season, competition, round)
      DO UPDATE SET source_filename = EXCLUDED.source_filename, source_url = EXCLUDED.source_url, uploaded_at = NOW()
      RETURNING id, season, competition, round, source_filename, source_url, uploaded_at
    `
    return NextResponse.json({ ok: true, report: serialize(result.rows[0]) })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Falha ao salvar relatório de equipe.' }, { status: 500 })
  }
}
