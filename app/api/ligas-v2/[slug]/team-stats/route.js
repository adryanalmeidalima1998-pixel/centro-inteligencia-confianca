import { ensureLigaTimeStatsSchema } from '@/lib/legacy-ligas-schema'
/**
 * POST /api/ligas-v2/[slug]/team-stats
 * Recebe um arquivo Excel de stats coletivas de um time e salva no banco
 *
 * GET /api/ligas-v2/[slug]/team-stats
 * Lista todos os times que têm upload nesta liga
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'
import { parseTeamStatsRow } from '@/data/team-stats-map'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req, { params }) {
  await ensureLigaTimeStatsSchema()
  const { slug } = params

  try {
    const formData = await req.formData()
    const file      = formData.get('file')
    const teamName  = formData.get('team_name')  // nome do time (obrigatório)

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }
    if (!teamName) {
      return NextResponse.json({ error: 'Nome do time não informado' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]

    // Ler como array de arrays para ter controle exato das colunas
    const rawAoA = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })

    if (!rawAoA || rawAoA.length < 3) {
      return NextResponse.json({ error: 'Planilha vazia ou formato inválido' }, { status: 400 })
    }

    // Row 0 = cabeçalhos da planilha Wyscout TeamStats
    // Row 1 = "Flamengo" (nome do time) — ignorar
    // Row 2 = "Adversários" — ignorar
    // Dados começam na row 3
    const headers = rawAoA[0].map(h => h !== null ? String(h).trim() : '')

    // Encontrar onde começam os dados reais (linha com data)
    const dataRows = rawAoA.slice(3).filter(row => row[0] && String(row[0]).match(/\d{4}/))

    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma partida encontrada. Verifique o formato.' }, { status: 400 })
    }

    // Converter para objetos com chaves pelos índices de header
    const partidas = dataRows.map(row => {
      const rowObj = {}
      headers.forEach((h, i) => { rowObj[h] = row[i] })
      return parseTeamStatsRow(rowObj, headers)
    }).filter(Boolean)

    const dataJson = JSON.stringify(partidas)

    await sql`
      INSERT INTO liga_time_stats (slug, team_name, data, total)
      VALUES (${slug}, ${teamName}, ${dataJson}::jsonb, ${partidas.length})
    `

    return NextResponse.json({
      ok: true,
      slug,
      team_name: teamName,
      total: partidas.length,
      message: `${partidas.length} partidas importadas para ${teamName}`,
    })

  } catch (err) {
    console.error('[team-stats-upload]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req, { params }) {
  await ensureLigaTimeStatsSchema()
  const { slug } = params

  try {
    const result = await sql`
      SELECT DISTINCT ON (team_name)
        team_name, upload_at, total
      FROM liga_time_stats
      WHERE slug = ${slug}
      ORDER BY team_name, upload_at DESC
    `

    return NextResponse.json({ times: result.rows })

  } catch (err) {
    console.error('[team-stats-list]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
