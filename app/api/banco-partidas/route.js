// CAMINHO: app/api/banco-partidas/route.js
import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS banco_partidas (
      id              SERIAL PRIMARY KEY,
      data_jogo       DATE,
      adversario      VARCHAR(120),
      competicao      VARCHAR(100),
      rodada          VARCHAR(50),
      mando           VARCHAR(10)  DEFAULT 'casa',
      placar          VARCHAR(20)  DEFAULT '0x0',
      resultado       VARCHAR(5)   DEFAULT 'E',
      modelo_jogo     VARCHAR(120),
      gps_rows        JSONB        DEFAULT '[]',
      wyscout_rows    JSONB        DEFAULT '[]',
      team_stats      JSONB        DEFAULT '{}',
      gps_status      VARCHAR(20)  DEFAULT 'pendente',
      wyscout_status  VARCHAR(20)  DEFAULT 'pendente',
      criado_em       TIMESTAMP    DEFAULT NOW()
    )
  `
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const full = searchParams.get('full') === '1'

    if (full) {
      // Full data including all rows (for analysis tabs)
      const result = await sql`
        SELECT * FROM banco_partidas ORDER BY data_jogo DESC, criado_em DESC
      `
      return NextResponse.json({ partidas: result.rows })
    }

    // Lightweight: only meta + counts (for banco tab)
    const result = await sql`
      SELECT
        id, data_jogo, adversario, competicao, rodada, mando,
        placar, resultado, modelo_jogo,
        gps_status, wyscout_status, criado_em,
        COALESCE(jsonb_array_length(gps_rows),    0) AS gps_count,
        COALESCE(jsonb_array_length(wyscout_rows), 0) AS wyscout_count
      FROM banco_partidas
      ORDER BY data_jogo DESC, criado_em DESC
    `
    return NextResponse.json({ partidas: result.rows })
  } catch (err) {
    return NextResponse.json({ partidas: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const {
      data_jogo, adversario, competicao, rodada, mando,
      placar, resultado, modelo_jogo,
      gps_rows, wyscout_rows, team_stats,
    } = body

    const gpsStatus     = (gps_rows?.length)     ? 'ok' : 'pendente'
    const wyscoutStatus = (wyscout_rows?.length)  ? 'ok' : 'pendente'

    const res = await sql`
      INSERT INTO banco_partidas
        (data_jogo, adversario, competicao, rodada, mando,
         placar, resultado, modelo_jogo,
         gps_rows, wyscout_rows, team_stats,
         gps_status, wyscout_status)
      VALUES
        (${data_jogo || null},
         ${adversario || ''}, ${competicao || ''}, ${rodada || ''},
         ${mando || 'casa'}, ${placar || '0x0'}, ${resultado || 'E'},
         ${modelo_jogo || ''},
         ${JSON.stringify(gps_rows    || [])},
         ${JSON.stringify(wyscout_rows || [])},
         ${JSON.stringify(team_stats  || {})},
         ${gpsStatus}, ${wyscoutStatus})
      RETURNING id
    `
    return NextResponse.json({ ok: true, id: res.rows[0].id })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
