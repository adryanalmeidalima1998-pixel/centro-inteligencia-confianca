import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS penaltis_cig (
      id          SERIAL PRIMARY KEY,
      atleta_id   INTEGER,
      atleta_nome VARCHAR(255) NOT NULL,
      data        DATE NOT NULL,
      tipo        VARCHAR(20) NOT NULL,
      zona        INTEGER NOT NULL,
      resultado   VARCHAR(10) NOT NULL,
      criado_em   TIMESTAMP DEFAULT NOW()
    )
  `
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const atleta_id = searchParams.get('atleta_id')
    const tipo      = searchParams.get('tipo')
    const data      = searchParams.get('data')

    let rows
    if (atleta_id && tipo && data) {
      rows = await sql`
        SELECT * FROM penaltis_cig
        WHERE atleta_id = ${atleta_id} AND tipo = ${tipo} AND data = ${data}
        ORDER BY criado_em DESC
      `
    } else if (atleta_id && tipo) {
      rows = await sql`
        SELECT * FROM penaltis_cig
        WHERE atleta_id = ${atleta_id} AND tipo = ${tipo}
        ORDER BY data DESC, criado_em DESC
      `
    } else if (atleta_id) {
      rows = await sql`
        SELECT * FROM penaltis_cig
        WHERE atleta_id = ${atleta_id}
        ORDER BY data DESC, criado_em DESC
      `
    } else {
      rows = await sql`
        SELECT * FROM penaltis_cig
        ORDER BY data DESC, criado_em DESC
        LIMIT 500
      `
    }

    return NextResponse.json({ penaltis: rows.rows })
  } catch (err) {
    return NextResponse.json({ penaltis: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const { atleta_id, atleta_nome, data, tipo, zona, resultado } = await request.json()

    if (!atleta_nome || !data || !tipo || zona === undefined || zona === null || !resultado) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO penaltis_cig (atleta_id, atleta_nome, data, tipo, zona, resultado)
      VALUES (${atleta_id || null}, ${atleta_nome}, ${data}, ${tipo}, ${zona}, ${resultado})
      RETURNING *
    `
    return NextResponse.json({ penalti: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
