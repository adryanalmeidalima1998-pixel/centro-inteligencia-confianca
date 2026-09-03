// app/api/serie-c/upload/route.js
// Upload semanal das 3 planilhas (times / jogadores de linha / goleiros).
// Salva como snapshot da rodada, sem apagar uploads anteriores.
//
// IMPORTANTE: os inserts são feitos em LOTE (multi-row INSERT), não linha a
// linha — com ~20 times + ~400-600 jogadores de linha + ~20 goleiros por
// rodada, inserir um de cada vez estoura o tempo de execução da função na
// Vercel. Em lotes de 50 linhas, o upload inteiro leva poucos segundos.
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'
import { parseWorkbookFile, buildTeamRecords, buildPlayerRecords, buildGoalkeeperRecords, detectStatsWorkbookKind, workbookMetricColumns } from '../../../../lib/serieCParse'

// dá mais tempo pra função na Vercel (em planos que respeitam esse valor;
// no Hobby o limite real continua sendo o do plano, mas não atrapalha)
export const maxDuration = 60

const CHUNK_SIZE = 50

// Insere em lote: cada registro vira uma linha VALUES ($1,$2,...) e tudo
// vai numa única query por lote, usando sql.query (parametrizado, sem risco
// de SQL injection).
async function bulkInsert(table, columns, jsonbColumn, rows, mapRow) {
  if (!rows.length) return 0
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const placeholders = []
    const params = []
    chunk.forEach((row, idx) => {
      const values = mapRow(row)
      const base = idx * values.length
      const rowPlaceholders = values.map((_, j) => {
        const paramIndex = base + j + 1
        const col = columns[j]
        return col === jsonbColumn ? `$${paramIndex}::jsonb` : `$${paramIndex}`
      })
      placeholders.push(`(${rowPlaceholders.join(', ')})`)
      params.push(...values)
    })
    const queryText = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`
    await sql.query(queryText, params)
    inserted += chunk.length
  }
  return inserted
}

export async function POST(request) {
  try {
    await ensureSerieCTables()

    const form = await request.formData()
    const season = String(form.get('season') || '').trim()
    const competition = String(form.get('competition') || 'Brasileiro Série C').trim()
    const round = Number(form.get('round'))
    const uploadDate = form.get('uploadDate') ? String(form.get('uploadDate')) : null
    const clubPositionRaw = form.get('clubPosition') ?? form.get('clubPosition')
    const clubPosition = clubPositionRaw ? Number(clubPositionRaw) : null

    const teamsFile = form.get('teamsFile')
    const playersFile = form.get('playersFile')
    const goalkeepersFile = form.get('goalkeepersFile')

    if (!season || !round) {
      return NextResponse.json({ error: 'Informe pelo menos temporada e rodada.' }, { status: 400 })
    }
    if (!teamsFile && !playersFile && !goalkeepersFile) {
      return NextResponse.json({ error: 'Envie ao menos uma das 3 planilhas (times, jogadores de linha ou goleiros).' }, { status: 400 })
    }

    // Upsert do upload da rodada (substitui se a mesma rodada/temporada/competição já existir,
    // preservando o histórico das outras rodadas).
    const uploadRes = await sql`
      INSERT INTO serie_c_uploads (season, competition, round, club_position, upload_date)
      VALUES (${season}, ${competition}, ${round}, ${clubPosition}, ${uploadDate})
      ON CONFLICT (season, competition, round) DO UPDATE SET
        club_position = COALESCE(EXCLUDED.club_position, serie_c_uploads.club_position),
        upload_date = COALESCE(EXCLUDED.upload_date, serie_c_uploads.upload_date),
        uploaded_at = NOW()
      RETURNING id
    `
    const uploadId = uploadRes.rows[0].id

    // Em reenvio parcial, só substituímos a tabela cujo arquivo foi enviado.
    // Isso evita apagar jogadores/goleiros quando o usuário atualiza apenas times.
    let teamsCount = 0, playersCount = 0, goalkeepersCount = 0
    const detected = { teams:null, players:null, goalkeepers:null }

    if (teamsFile && typeof teamsFile.arrayBuffer === 'function') {
      const rawRows = await parseWorkbookFile(teamsFile)
      detected.teams = { kind:detectStatsWorkbookKind(rawRows), columns:workbookMetricColumns(rawRows).length }
      const records = buildTeamRecords(rawRows)
      if (!records.length) throw new Error('A planilha de times não possui linhas válidas. Confirme se a primeira aba contém a coluna Time.')
      await sql`DELETE FROM serie_c_team_stats WHERE upload_id = ${uploadId}`
      teamsCount = await bulkInsert(
        'serie_c_team_stats',
        ['upload_id', 'team', 'is_club', 'metrics'],
        'metrics',
        records,
        r => [uploadId, r.team, r.isClub, JSON.stringify(r.metrics)]
      )
    }

    if (playersFile && typeof playersFile.arrayBuffer === 'function') {
      const rawRows = await parseWorkbookFile(playersFile)
      const kind = detectStatsWorkbookKind(rawRows)
      detected.players = { kind, columns:workbookMetricColumns(rawRows).length }
      if (kind === 'goalkeepers') throw new Error('O arquivo enviado em Jogadores de linha parece ser a planilha de goleiros. Troque os arquivos de campo.')
      const records = buildPlayerRecords(rawRows)
      if (!records.length) throw new Error('A planilha de jogadores não possui linhas válidas. Confirme as colunas Jogador e Time.')
      await sql`DELETE FROM serie_c_player_stats WHERE upload_id = ${uploadId}`
      playersCount = await bulkInsert(
        'serie_c_player_stats',
        ['upload_id', 'player', 'team', 'is_club', 'position', 'age', 'minutes', 'metrics'],
        'metrics',
        records,
        r => [uploadId, r.player, r.team, r.isClub, r.position, r.age, r.minutes, JSON.stringify(r.metrics)]
      )
    }

    if (goalkeepersFile && typeof goalkeepersFile.arrayBuffer === 'function') {
      const rawRows = await parseWorkbookFile(goalkeepersFile)
      const kind = detectStatsWorkbookKind(rawRows)
      detected.goalkeepers = { kind, columns:workbookMetricColumns(rawRows).length }
      if (kind === 'players') throw new Error('O arquivo enviado em Goleiros parece ser a planilha de jogadores de linha. Troque os arquivos de campo.')
      const records = buildGoalkeeperRecords(rawRows)
      if (!records.length) throw new Error('A planilha de goleiros não possui linhas válidas. Confirme as colunas Jogador e Time.')
      await sql`DELETE FROM serie_c_goalkeeper_stats WHERE upload_id = ${uploadId}`
      goalkeepersCount = await bulkInsert(
        'serie_c_goalkeeper_stats',
        ['upload_id', 'player', 'team', 'is_club', 'age', 'minutes', 'metrics'],
        'metrics',
        records,
        r => [uploadId, r.player, r.team, r.isClub, r.age, r.minutes, JSON.stringify(r.metrics)]
      )
    }

    // Retorna o total efetivamente preservado na rodada, não apenas o arquivo
    // reenviado nesta chamada. Assim um upload parcial não aparece como "0".
    const totals = await Promise.all([
      sql`SELECT COUNT(*)::int AS count FROM serie_c_team_stats WHERE upload_id = ${uploadId}`,
      sql`SELECT COUNT(*)::int AS count FROM serie_c_player_stats WHERE upload_id = ${uploadId}`,
      sql`SELECT COUNT(*)::int AS count FROM serie_c_goalkeeper_stats WHERE upload_id = ${uploadId}`,
    ])

    return NextResponse.json({
      ok: true,
      uploadId,
      season, competition, round,
      counts: {
        teams: Number(totals[0].rows[0]?.count || 0),
        players: Number(totals[1].rows[0]?.count || 0),
        goalkeepers: Number(totals[2].rows[0]?.count || 0),
      },
      updated: { teams: teamsCount, players: playersCount, goalkeepers: goalkeepersCount },
      detected,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Falha ao processar upload.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    await ensureSerieCTables()
    const res = await sql`
      SELECT id, season, competition, round, club_position, upload_date, uploaded_at
      FROM serie_c_uploads
      ORDER BY season DESC, round DESC
    `
    return NextResponse.json({ uploads: res.rows })
  } catch (err) {
    return NextResponse.json({ uploads: [], error: err.message }, { status: 500 })
  }
}
