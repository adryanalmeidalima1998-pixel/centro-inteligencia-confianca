/**
 * GET/POST /api/ligas-v2/[slug]/wyscout
 * Importa o export Wyscout "Search results" em qualquer competição.
 * O arquivo é mantido como fonte própria e também pode enriquecer o pé
 * preferido de uma base Sportsbase da mesma liga.
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'
import {
  getRecognizedWyscoutHeaders,
  getWyscoutSerieDMeta,
  parseWyscoutSerieD,
  resolveWyscoutHeader,
  WYSCOUT_SERIE_D_HEADERS,
} from '@/data/wyscout-seried'
import { matchesPlayerFoot } from '@/data/player-foot'
import { attachCanonicalPlayers } from '@/app/lib/playerMaster'
import { scheduleLeagueUploadProcessing } from '@/lib/league-upload-background'
import { getLeagueSchemaVersion, LEAGUE_ENGINE_VERSION, resolveLeagueSeason } from '@/lib/league-dataset-version'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

export const runtime = 'nodejs'
export const maxDuration = 60

let ensureTablePromise = null

async function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
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
    })().catch(error => {
      ensureTablePromise = null
      throw error
    })
  }
  return ensureTablePromise
}

export async function POST(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    await ensureTable()
    const form = await request.formData()
    const file = form.get('file')
    const season = resolveLeagueSeason(form.get('season'))
    if (!file) return NextResponse.json({ error: 'Selecione a planilha Wyscout em .xlsx.' }, { status: 400 })

    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('search results')) || workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
    if (!rows.length) return NextResponse.json({ error: 'Planilha vazia ou sem registros válidos.' }, { status: 400 })

    const headers = Object.keys(rows[0] || {})
    const resolvedFields = new Set(headers.map(header => resolveWyscoutHeader(header)?.key).filter(Boolean))
    const required = [
      { label: 'Jogador', key: 'nome' },
      { label: 'Equipa/Equipe', key: 'equipa' },
      { label: 'Posição', key: 'posicao' },
      { label: 'Minutos jogados', key: 'minutos' },
      { label: 'Partidas jogadas', key: 'jogos' },
    ]
    const missing = required.filter(field => !resolvedFields.has(field.key)).map(field => field.label)
    if (missing.length) {
      return NextResponse.json({
        error: `Modelo Wyscout inválido. Campos ausentes: ${missing.join(', ')}`,
        expected: Object.keys(WYSCOUT_SERIE_D_HEADERS),
      }, { status: 400 })
    }

    const players = parseWyscoutSerieD(rows)
    if (!players.length) return NextResponse.json({ error: 'Nenhum jogador com minutagem foi encontrado.' }, { status: 400 })

    await sql`
      INSERT INTO liga_jogadores (slug, data, total, fonte, engine_version, schema_version, season)
      VALUES (
        ${slug},
        ${JSON.stringify(players)}::jsonb,
        ${players.length},
        'wyscout',
        ${LEAGUE_ENGINE_VERSION},
        ${getLeagueSchemaVersion('wyscout')},
        ${season}
      )
    `

    const meta = getWyscoutSerieDMeta(players)
    const recognizedHeaders = getRecognizedWyscoutHeaders(headers).length
    const warnings = []
    if (recognizedHeaders < 30) warnings.push('O arquivo possui poucas métricas reconhecidas. Rankings e seleções usarão somente os campos efetivamente disponíveis.')
    else warnings.push(`${recognizedHeaders} colunas Wyscout reconhecidas; percentis, gráficos e seleções foram ativados para esta fonte.`)
    if ((meta.footCoverage?.coveragePct || 0) < 100) warnings.push(`Pé preferido não informado em ${meta.footCoverage?.unknown || 0} atleta(s).`)
    const eligible = players.filter(player => Number(player.minutos || 0) >= Number(meta.suggestedMinimum || 270)).length

    scheduleLeagueUploadProcessing({
      players,
      provider: 'wyscout',
      leagueSlug: slug,
      filename: file.name,
      sheetName,
      rowsEligible: eligible,
      clubs: new Set(players.map(player => player.equipa).filter(Boolean)).size,
      recognizedHeaders,
      warnings,
      validation: {
        minimumMinutes: meta.suggestedMinimum || 270,
        preferredFootCoverage: meta.footCoverage?.coveragePct || 0,
      },
    })

    return NextResponse.json({
      ok: true,
      fonte: 'wyscout',
      slug,
      season,
      engine_version: LEAGUE_ENGINE_VERSION,
      schema_version: getLeagueSchemaVersion('wyscout'),
      sheet: sheetName,
      total: players.length,
      eligible,
      meta,
      recognized_headers: recognizedHeaders,
      background_processing: true,
      automation: { status: 'queued' },
      master_sync: { status: 'queued' },
      message: `${players.length} jogadores Wyscout importados com sucesso.`,
      warnings,
    })
  } catch (error) {
    console.error('[wyscout-upload]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    await ensureTable()
    const result = await sql`
      SELECT data, total, fonte, upload_at
      FROM liga_jogadores
      WHERE slug = ${slug} AND fonte = 'wyscout'
      ORDER BY upload_at DESC
      LIMIT 1
    `
    if (!result.rows.length) {
      return NextResponse.json({ jogadores: [], total: 0, total_upload: 0, fonte: 'wyscout', upload_at: null, meta: getWyscoutSerieDMeta([]) })
    }

    const rawPlayers = Array.isArray(result.rows[0].data) ? result.rows[0].data : []
    const all = await attachCanonicalPlayers(rawPlayers.map(player => ({ ...player, _liga: slug, _fonte: 'wyscout' })))
    const { searchParams } = new URL(request.url)
    const search = String(searchParams.get('busca') || '').toLowerCase()
    const team = String(searchParams.get('equipe') || searchParams.get('equipa') || '').toLowerCase()
    const group = String(searchParams.get('grupo') || '')
    const foot = String(searchParams.get('pe') || '')
    const min = Number(searchParams.get('min') || 0)
    let players = [...all]
    if (search) players = players.filter(player => `${player.nome} ${player.equipa}`.toLowerCase().includes(search))
    if (team) players = players.filter(player => String(player.equipa || '').toLowerCase().includes(team))
    if (group) players = players.filter(player => player.grupo_posicional === group)
    if (foot) players = players.filter(player => matchesPlayerFoot(player, foot))
    if (min > 0) players = players.filter(player => Number(player.minutos) >= min)

    return NextResponse.json({
      jogadores: players, total: players.length, total_upload: all.length,
      fonte: 'wyscout', upload_at: result.rows[0].upload_at, meta: getWyscoutSerieDMeta(all),
    })
  } catch (error) {
    console.error('[wyscout-get]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
