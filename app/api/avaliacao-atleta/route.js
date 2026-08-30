import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'
import sharp from 'sharp'
import { getGuaraniSportsbase } from '@/lib/guarani-sportsbase-store'
import { aggregateIScoutGames, analyzeIScoutPlayer, parseIScoutRows } from '@/data/iscout-analysis'
import { buildScoutDataCorrelation } from '@/app/lib/scouting/scoutDataCorrelation'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

export const runtime = 'nodejs'
export const maxDuration = 60

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS avaliacoes_atletas (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      equipa TEXT,
      posicao TEXT,
      idade INTEGER,
      pe TEXT,
      nacionalidade TEXT,
      liga TEXT,
      filename TEXT,
      photo_base64 TEXT,
      photo_mime TEXT,
      photo_filename TEXT,
      aggregate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      qualitative_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE avaliacoes_atletas ADD COLUMN IF NOT EXISTS qualitative_json JSONB NOT NULL DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE avaliacoes_atletas ADD COLUMN IF NOT EXISTS photo_base64 TEXT`
  await sql`ALTER TABLE avaliacoes_atletas ADD COLUMN IF NOT EXISTS photo_mime TEXT`
  await sql`ALTER TABLE avaliacoes_atletas ADD COLUMN IF NOT EXISTS photo_filename TEXT`
  await sql`ALTER TABLE avaliacoes_atletas ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`
}

async function latestLeaguePlayers(slug = 'brasileirao-serie-c') {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS liga_jogadores (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        total INTEGER DEFAULT 0,
        fonte TEXT DEFAULT 'sportsbase',
        upload_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0`
    await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'sportsbase'`
    const result = await sql`
      SELECT data, fonte, upload_at
      FROM liga_jogadores
      WHERE slug = ${slug}
      ORDER BY CASE WHEN fonte = 'sportsbase' THEN 0 ELSE 1 END, upload_at DESC
      LIMIT 1
    `
    if (result.rows[0]) return { players: result.rows[0].data || [], source: result.rows[0].fonte, uploadedAt: result.rows[0].upload_at }
  } catch {}

  try {
    const legacy = await sql`SELECT data_json, upload_at FROM wyscout_benchmark WHERE tipo = 'serie_c' LIMIT 1`
    if (legacy.rows[0]) return { players: JSON.parse(legacy.rows[0].data_json || '[]'), source:'wyscout-benchmark', uploadedAt:legacy.rows[0].upload_at }
  } catch {}
  return { players:[], source:null, uploadedAt:null }
}

async function normalizePhoto(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number(file.size || 0)) return null
  if (!String(file.type || '').startsWith('image/')) throw new Error('A foto do atleta precisa ser uma imagem.')
  if (Number(file.size) > 8 * 1024 * 1024) throw new Error('A foto do atleta deve ter no máximo 8 MB.')

  const input = Buffer.from(await file.arrayBuffer())
  const output = await sharp(input)
    .rotate()
    .resize(720, 900, { fit:'cover', position:'attention' })
    .jpeg({ quality:82, mozjpeg:true })
    .toBuffer()

  const base64 = output.toString('base64')
  return {
    base64,
    mime:'image/jpeg',
    filename:`${String(file.name || 'foto-atleta').replace(/\.[^.]+$/, '')}.jpg`,
    dataUrl:`data:image/jpeg;base64,${base64}`,
  }
}

function readIScoutFile(buffer) {
  const workbook = XLSX.read(buffer, { type:'buffer', cellDates:true })
  const sheetName = workbook.SheetNames.includes('PlayerStats') ? 'PlayerStats' : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Não foi possível localizar a aba de partidas.')
  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:null, raw:true, cellDates:true })
  return parseIScoutRows(rows)
}

function buildPhotoDataUrl(row) {
  if (!row?.photo_base64 || !row?.photo_mime) return null
  return `data:${row.photo_mime};base64,${row.photo_base64}`
}

export async function GET(request) {
  await ensureLigaJogadoresSchema()
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id') || 0)
    if (id) {
      const result = await sql`SELECT * FROM avaliacoes_atletas WHERE id = ${id} LIMIT 1`
      if (!result.rows[0]) return Response.json({ error:'Avaliação não encontrada.' }, { status:404 })
      const row = result.rows[0]

      // Avaliações novas guardam as partidas brutas. Isso permite recalcular a amostra
      // com o filtro correto de competição e com a matriz atual de KPIs posicionais.
      try {
        const aggregate = row.aggregate_json || {}
        const rawGames = Array.isArray(aggregate?.games) ? aggregate.games : []
        if (rawGames.length) {
          const metadata = {
            nome:row.nome || aggregate?.metadata?.nome || aggregate?.player?.nome || 'Atleta',
            equipa:row.equipa || aggregate?.metadata?.equipa || '',
            posicao:row.posicao || aggregate?.metadata?.posicao || '',
            idade:row.idade || aggregate?.metadata?.idade || null,
            pe:row.pe || aggregate?.metadata?.pe || '',
            nacionalidade:row.nacionalidade || aggregate?.metadata?.nacionalidade || '',
            liga:row.liga || aggregate?.metadata?.liga || '',
          }
          const freshAggregate = aggregateIScoutGames(rawGames, metadata)
          const [guarani, serieC] = await Promise.all([getGuaraniSportsbase(), latestLeaguePlayers()])
          const refreshedAnalysis = analyzeIScoutPlayer({
            player:freshAggregate.player,
            games:freshAggregate.games,
            context:{
              ...freshAggregate.context,
              serieCSource:serieC.source,
              serieCUpdatedAt:serieC.uploadedAt,
              guaraniUpdatedAt:guarani.uploads?.players?.uploadedAt || guarani.uploads?.updatedAt || null,
            },
            guaraniPlayers:guarani.players || [],
            serieCPlayers:serieC.players || [],
            guaraniModel:guarani.model || guarani.summary?.model || null,
          })
          row.analysis_json = refreshedAnalysis
          row.aggregate_json = { ...aggregate, player:freshAggregate.player, context:freshAggregate.context, metadata }
          await sql`
            UPDATE avaliacoes_atletas
            SET aggregate_json = ${JSON.stringify(row.aggregate_json)}::jsonb,
                analysis_json = ${JSON.stringify(refreshedAnalysis)}::jsonb
            WHERE id = ${id}
          `
        } else if (aggregate?.player) {
          // Registros antigos não possuem todas as linhas da planilha e não podem ter
          // a competição recomposta com segurança quando havia múltiplos torneios.
          const competitions = aggregate?.context?.competitions || []
          const needsReimport = competitions.length > 1 || Number(row.analysis_json?.schemaVersion || 0) < 3
          row.analysis_json = {
            ...(row.analysis_json || {}),
            context:{
              ...(row.analysis_json?.context || aggregate?.context || {}),
              requiresReimport:needsReimport,
              reimportReason:needsReimport ? 'Esta avaliação foi criada antes da correção do filtro de competição e do mapeamento iScout. Reimporte a planilha para recalcular os números com segurança.' : null,
            },
          }
        }
      } catch (refreshError) {
        console.warn('[avaliacao-atleta:refresh-analysis]', refreshError)
      }

      return Response.json({ ...row, photo_data_url:buildPhotoDataUrl(row) })
    }
    const archived = searchParams.get('archived') === '1'
    const result = archived
      ? await sql`
          SELECT id, nome, equipa, posicao, idade, pe, liga, filename, created_at, updated_at, archived_at,
                 analysis_json->>'fitScore' AS fit_score,
                 analysis_json->>'fitLabel' AS fit_label
          FROM avaliacoes_atletas
          WHERE archived_at IS NOT NULL
          ORDER BY archived_at DESC, updated_at DESC
          LIMIT 60
        `
      : await sql`
          SELECT id, nome, equipa, posicao, idade, pe, liga, filename, created_at, updated_at, archived_at,
                 analysis_json->>'fitScore' AS fit_score,
                 analysis_json->>'fitLabel' AS fit_label
          FROM avaliacoes_atletas
          WHERE archived_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 60
        `
    return Response.json({ items:result.rows, archived })
  } catch (error) {
    return Response.json({ error:error.message, items:[] }, { status:500 })
  }
}

export async function POST(request) {
  await ensureLigaJogadoresSchema()
  try {
    await ensureTable()
    const form = await request.formData()
    const file = form.get('file')
    const photo = form.get('photo')
    const nome = String(form.get('nome') || '').trim()
    if (!nome) return Response.json({ error:'Informe o nome do atleta.' }, { status:400 })
    if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error:'Envie a planilha iScout do atleta.' }, { status:400 })

    const metadata = {
      nome,
      equipa:String(form.get('equipa') || '').trim(),
      posicao:String(form.get('posicao') || '').trim(),
      idade:Number(form.get('idade') || 0) || null,
      pe:String(form.get('pe') || '').trim(),
      nacionalidade:String(form.get('nacionalidade') || '').trim(),
      liga:String(form.get('liga') || '').trim(),
    }

    const photoData = await normalizePhoto(photo)
    const allGames = readIScoutFile(Buffer.from(await file.arrayBuffer()))
    const aggregate = aggregateIScoutGames(allGames, metadata)
    const [guarani, serieC] = await Promise.all([getGuaraniSportsbase(), latestLeaguePlayers()])
    const analysis = analyzeIScoutPlayer({
      player:aggregate.player,
      games:aggregate.games,
      context:{
        ...aggregate.context,
        serieCSource:serieC.source,
        serieCUpdatedAt:serieC.uploadedAt,
        guaraniUpdatedAt:guarani.uploads?.players?.uploadedAt || guarani.uploads?.updatedAt || null,
      },
      guaraniPlayers:guarani.players || [],
      serieCPlayers:serieC.players || [],
      guaraniModel:guarani.model || guarani.summary?.model || null,
    })

    const saved = await sql`
      INSERT INTO avaliacoes_atletas
        (nome, equipa, posicao, idade, pe, nacionalidade, liga, filename, photo_base64, photo_mime, photo_filename, aggregate_json, analysis_json, updated_at)
      VALUES
        (${analysis.player.nome}, ${analysis.player.equipa || null}, ${analysis.player.posicao || null}, ${analysis.player.idade || null},
         ${analysis.player.pe || null}, ${analysis.player.pais || null}, ${aggregate.context.competition || metadata.liga || null}, ${file.name || null},
         ${photoData?.base64 || null}, ${photoData?.mime || null}, ${photoData?.filename || null},
         ${JSON.stringify({ player:aggregate.player, context:aggregate.context, games:allGames, metadata })}::jsonb,
         ${JSON.stringify(analysis)}::jsonb, NOW())
      RETURNING id, created_at
    `

    return Response.json({
      ok:true,
      id:saved.rows[0].id,
      created_at:saved.rows[0].created_at,
      analysis,
      photo_data_url:photoData?.dataUrl || null,
    })
  } catch (error) {
    console.error('[avaliacao-atleta]', error)
    return Response.json({ error:error.message }, { status:500 })
  }
}

function sanitizeQualitative(input = {}, analysis = null) {
  const primarySource = ['video','in_loco','mixed'].includes(String(input?.primarySource || '')) ? String(input.primarySource) : 'video'
  const scoutReport = String(input?.scoutReport || input?.scoutSummary || '').trim().slice(0, 12000)
  const correlation = scoutReport && analysis ? buildScoutDataCorrelation(scoutReport, analysis) : null

  return {
    version:2,
    primarySource,
    sources:{
      data:true,
      video:primarySource === 'video' || primarySource === 'mixed',
      inLoco:primarySource === 'in_loco' || primarySource === 'mixed',
      reference:Boolean(input?.sources?.reference),
      interview:Boolean(input?.sources?.interview),
    },
    scoutReport,
    correlation,
    // Campos legados são mantidos para não quebrar avaliações antigas.
    scoutSummary:String(input?.scoutSummary || '').trim().slice(0, 6000),
    convergence:String(input?.convergence || '').slice(0, 40),
    dimensions:typeof input?.dimensions === 'object' && input.dimensions ? input.dimensions : {},
    updatedAt:new Date().toISOString(),
  }
}

export async function PUT(request) {
  await ensureLigaJogadoresSchema()
  try {
    await ensureTable()
    const form = await request.formData()
    const id = Number(form.get('id') || 0)
    const photo = form.get('photo')
    if (!id) return Response.json({ error:'ID da avaliação é obrigatório.' }, { status:400 })

    const photoData = await normalizePhoto(photo)
    if (!photoData) return Response.json({ error:'Selecione uma foto válida.' }, { status:400 })

    const result = await sql`
      UPDATE avaliacoes_atletas
      SET photo_base64 = ${photoData.base64},
          photo_mime = ${photoData.mime},
          photo_filename = ${photoData.filename},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, updated_at
    `
    if (!result.rows[0]) return Response.json({ error:'Avaliação não encontrada.' }, { status:404 })
    return Response.json({ ok:true, id:result.rows[0].id, photo_data_url:photoData.dataUrl, updated_at:result.rows[0].updated_at })
  } catch (error) {
    console.error('[avaliacao-atleta:foto]', error)
    return Response.json({ error:error.message }, { status:500 })
  }
}

export async function PATCH(request) {
  await ensureLigaJogadoresSchema()
  try {
    await ensureTable()
    const body = await request.json()
    const id = Number(body?.id || 0)
    if (!id) return Response.json({ error:'ID da avaliação é obrigatório.' }, { status:400 })

    const action = String(body?.action || '').trim().toLowerCase()
    if (action === 'archive' || action === 'unarchive') {
      const result = action === 'archive'
        ? await sql`
            UPDATE avaliacoes_atletas
            SET archived_at = NOW(), updated_at = NOW()
            WHERE id = ${id}
            RETURNING id, archived_at, updated_at
          `
        : await sql`
            UPDATE avaliacoes_atletas
            SET archived_at = NULL, updated_at = NOW()
            WHERE id = ${id}
            RETURNING id, archived_at, updated_at
          `
      if (!result.rows[0]) return Response.json({ error:'Avaliação não encontrada.' }, { status:404 })
      return Response.json({ ok:true, action, ...result.rows[0] })
    }

    const current = await sql`SELECT analysis_json FROM avaliacoes_atletas WHERE id = ${id} LIMIT 1`
    if (!current.rows[0]) return Response.json({ error:'Avaliação não encontrada.' }, { status:404 })
    const qualitative = sanitizeQualitative(body?.qualitative || {}, current.rows[0].analysis_json || {})

    const result = await sql`
      UPDATE avaliacoes_atletas
      SET qualitative_json = ${JSON.stringify(qualitative)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, qualitative_json, updated_at
    `
    return Response.json({ ok:true, id:result.rows[0].id, qualitative:result.rows[0].qualitative_json, updated_at:result.rows[0].updated_at })
  } catch (error) {
    console.error('[avaliacao-atleta:scout-dados]', error)
    return Response.json({ error:error.message }, { status:500 })
  }
}

export async function DELETE(request) {
  await ensureLigaJogadoresSchema()
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id') || 0)
    if (!id) return Response.json({ error:'ID obrigatório.' }, { status:400 })
    await sql`DELETE FROM avaliacoes_atletas WHERE id = ${id}`
    return Response.json({ ok:true })
  } catch (error) {
    return Response.json({ error:error.message }, { status:500 })
  }
}
