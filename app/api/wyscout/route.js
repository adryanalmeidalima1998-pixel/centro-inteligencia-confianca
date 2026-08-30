import { sql } from '@vercel/postgres'

/*
  Tabela: wyscout_uploads
  Guarda os dados mais recentes de cada seção/posição importados via CSV.
  Quando o usuário faz upload novo de uma posição, substitui o anterior.
*/
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS wyscout_uploads (
      id            SERIAL PRIMARY KEY,
      section       TEXT NOT NULL,   -- 'elenco' | 'mercado'
      posicao_label TEXT NOT NULL,   -- 'Centroavante', 'Goleiro', etc. | 'elenco' para o plantel
      players_json  TEXT NOT NULL,   -- JSON array serializado
      row_count     INTEGER,
      uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(section, posicao_label)
    )
  `
}

/* GET — retorna status dos uploads e os dados quando necessário */
export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const section      = searchParams.get('section')
    const posicaoLabel = searchParams.get('posicao')
    const dataOnly     = searchParams.get('data') === '1'

    if (dataOnly && section && posicaoLabel) {
      // Retorna os dados de uma seção/posição específica
      const row = await sql`
        SELECT players_json FROM wyscout_uploads
        WHERE section = ${section} AND posicao_label = ${posicaoLabel}
      `
      if (!row.rows[0]) return Response.json({ players: [], found: false })
      const players = JSON.parse(row.rows[0].players_json)
      return Response.json({ players, found: true })
    }

    if (dataOnly && section) {
      // Retorna TODOS os dados de uma seção
      const rows = await sql`
        SELECT posicao_label, players_json, row_count, uploaded_at
        FROM wyscout_uploads WHERE section = ${section}
        ORDER BY posicao_label
      `
      const all = []
      for (const row of rows.rows) {
        const arr = JSON.parse(row.players_json)
        all.push(...arr)
      }
      return Response.json({ players: all, total: all.length, found: rows.rows.length > 0 })
    }

    // Status de todos os uploads
    const rows = await sql`
      SELECT section, posicao_label, row_count, uploaded_at
      FROM wyscout_uploads ORDER BY section, posicao_label
    `
    return Response.json({ uploads: rows.rows })
  } catch (err) {
    return Response.json({ uploads: [], error: err.message }, { status: 500 })
  }
}

/* POST — recebe dados parseados do CSV e salva/substitui */
export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { section, posicao_label, players } = body

    if (!section || !posicao_label || !Array.isArray(players)) {
      return Response.json({ error: 'section, posicao_label e players são obrigatórios' }, { status: 400 })
    }
    if (players.length === 0) {
      return Response.json({ error: 'Nenhum atleta encontrado no CSV' }, { status: 400 })
    }

    const playersJson = JSON.stringify(players)

    await sql`
      INSERT INTO wyscout_uploads (section, posicao_label, players_json, row_count)
      VALUES (${section}, ${posicao_label}, ${playersJson}, ${players.length})
      ON CONFLICT (section, posicao_label)
      DO UPDATE SET
        players_json = ${playersJson},
        row_count    = ${players.length},
        uploaded_at  = NOW()
    `
    return Response.json({ success: true, count: players.length })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* DELETE — remove upload de uma posição específica (volta ao estático) */
export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const section      = searchParams.get('section')
    const posicaoLabel = searchParams.get('posicao')

    if (!section || !posicaoLabel) {
      return Response.json({ error: 'section e posicao são obrigatórios' }, { status: 400 })
    }
    await sql`
      DELETE FROM wyscout_uploads
      WHERE section = ${section} AND posicao_label = ${posicaoLabel}
    `
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
