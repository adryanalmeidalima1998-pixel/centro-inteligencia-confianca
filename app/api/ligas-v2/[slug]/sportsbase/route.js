/**
 * GET/POST /api/ligas-v2/[slug]/sportsbase
 * Importa o modelo Sportsbase "Estatísticas do jogador" e retorna o último upload.
 * Quando existe um upload Wyscout da mesma liga, o pé preferido é enriquecido por
 * correspondência segura de identidade, sem misturar as métricas dos fornecedores.
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'
import { parseSportsbaseExcel, getSportsbaseDatasetMeta, SPORTSBASE_COL_MAP } from '@/data/sportsbase-map'
import { enrichPlayersWithFoot, matchesPlayerFoot } from '@/data/player-foot'
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
            id        SERIAL PRIMARY KEY,
            slug      TEXT NOT NULL,
            data      JSONB NOT NULL DEFAULT '[]'::jsonb,
            total     INTEGER DEFAULT 0,
            fonte     TEXT DEFAULT 'sportsbase',
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

async function latestSource(slug, source) {
  const result = await sql`
    SELECT data, upload_at
    FROM liga_jogadores
    WHERE slug = ${slug} AND fonte = ${source}
    ORDER BY upload_at DESC
    LIMIT 1
  `
  return result.rows[0] || null
}

export async function POST(req, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    await ensureTable()
    const formData = await req.formData()
    const file = formData.get('file')
    const season = resolveLeagueSeason(formData.get('season'))
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const preferredSheet = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('estatísticas principais') || name.toLowerCase().includes('estatisticas principais')
    )
    const sheetName = preferredSheet || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true })
    if (!rows.length) return NextResponse.json({ error: 'Planilha vazia ou formato inválido' }, { status: 400 })

    const headers = Object.keys(rows[0] || {})
    const required = ['Jogador', 'Time', 'Minutos jogados', 'Posição']
    const missing = required.filter(header => !headers.includes(header))
    if (missing.length) {
      return NextResponse.json({ error: `Modelo Sportsbase inválido. Colunas ausentes: ${missing.join(', ')}` }, { status: 400 })
    }

    let players = parseSportsbaseExcel(rows)
    if (!players.length) return NextResponse.json({ error: 'Nenhum jogador válido encontrado' }, { status: 400 })

    const [wyscout, previousSportsbase] = await Promise.all([
      latestSource(slug, 'wyscout'),
      latestSource(slug, 'sportsbase'),
    ])
    players = enrichPlayersWithFoot(players, [
      ...(wyscout?.data || []),
      ...(previousSportsbase?.data || []),
    ], wyscout?.data?.length ? 'wyscout' : 'sportsbase-anterior')

    // Esta é a única etapa pesada que precisa terminar antes da resposta:
    // garantir que o novo conjunto esteja persistido e disponível na liga.
    await sql`
      INSERT INTO liga_jogadores (slug, data, total, fonte, engine_version, schema_version, season)
      VALUES (
        ${slug},
        ${JSON.stringify(players)}::jsonb,
        ${players.length},
        'sportsbase',
        ${LEAGUE_ENGINE_VERSION},
        ${getLeagueSchemaVersion('sportsbase')},
        ${season}
      )
    `

    const meta = getSportsbaseDatasetMeta(players)
    const recognizedHeaders = headers.filter(header => Object.prototype.hasOwnProperty.call(SPORTSBASE_COL_MAP, header))
    const warnings = []
    if (!meta.hasGoalkeepers) warnings.push('O arquivo não contém goleiros; rankings e seleção de GK ficarão indisponíveis.')
    if (recognizedHeaders.length < 100) warnings.push(`Somente ${recognizedHeaders.length} colunas Sportsbase foram reconhecidas.`)
    if (!meta.hasPreferredFoot) warnings.push('Este modelo Sportsbase não contém pé preferido. Importe também o Wyscout da liga para complementar esse campo.')
    else if (!headers.some(header => ['Pé', 'Pé preferido', 'Pé dominante', 'Preferred foot', 'Foot'].includes(header))) {
      warnings.push(`Pé preferido enriquecido por outra fonte em ${meta.footCoverage?.informed || 0} atletas.`)
    }

    const eligible = players.filter(player => Number(player.minutos || 0) >= Number(meta.suggestedMinimumMinutes || 0)).length

    scheduleLeagueUploadProcessing({
      players,
      provider: 'sportsbase',
      leagueSlug: slug,
      filename: file.name,
      sheetName,
      rowsEligible: eligible,
      clubs: meta.teamsTotal,
      recognizedHeaders: recognizedHeaders.length,
      warnings,
      validation: {
        hasGoalkeepers: meta.hasGoalkeepers,
        positions: meta.positions?.length || 0,
        minimumMinutes: meta.suggestedMinimumMinutes,
        preferredFootCoverage: meta.footCoverage?.coveragePct || 0,
      },
    })

    return NextResponse.json({
      ok: true,
      slug,
      total: players.length,
      eligible,
      sheet: sheetName,
      fonte: 'sportsbase',
      season,
      engine_version: LEAGUE_ENGINE_VERSION,
      schema_version: getLeagueSchemaVersion('sportsbase'),
      meta,
      warnings,
      recognized_headers: recognizedHeaders.length,
      background_processing: true,
      automation: { status: 'queued' },
      master_sync: { status: 'queued' },
      message: `${players.length} jogadores Sportsbase importados com sucesso`,
    })
  } catch (err) {
    console.error('[sportsbase-upload]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const position = searchParams.get('pos')
  const foot = searchParams.get('pe') || ''
  const minutes = parseInt(searchParams.get('min') || '0', 10)

  try {
    await ensureTable()
    const [sportsbase, wyscout] = await Promise.all([
      latestSource(slug, 'sportsbase'),
      latestSource(slug, 'wyscout'),
    ])

    if (!sportsbase) {
      return NextResponse.json({
        jogadores: [], total: 0, total_upload: 0, fonte: 'sportsbase', upload_at: null,
        meta: getSportsbaseDatasetMeta([]),
        available_sources: { sportsbase: false, wyscout: Boolean(wyscout) },
      })
    }

    const enrichedPlayers = enrichPlayersWithFoot(sportsbase.data || [], wyscout?.data || [], 'wyscout').map(player => ({ ...player, _liga: slug, _fonte: 'sportsbase' }))
    const allPlayers = await attachCanonicalPlayers(enrichedPlayers)
    let players = [...allPlayers]
    if (minutes > 0) players = players.filter(player => (player.minutos || 0) >= minutes)
    if (position) {
      const filter = position.toUpperCase()
      players = players.filter(player => String(player.posicao || '').toUpperCase().includes(filter))
    }
    if (foot) players = players.filter(player => matchesPlayerFoot(player, foot))

    return NextResponse.json({
      jogadores: players, total: players.length, total_upload: allPlayers.length,
      fonte: 'sportsbase', upload_at: sportsbase.upload_at, meta: getSportsbaseDatasetMeta(allPlayers),
      available_sources: { sportsbase: true, wyscout: Boolean(wyscout) },
      source_uploads: { sportsbase: sportsbase.upload_at, wyscout: wyscout?.upload_at || null },
    })
  } catch (err) {
    console.error('[sportsbase-get]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
