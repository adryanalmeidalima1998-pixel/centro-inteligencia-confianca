import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS jogadores_destacados (
      id            SERIAL PRIMARY KEY,
      nome          TEXT NOT NULL,
      time_nome     TEXT,
      time_id       INTEGER,
      posicao       TEXT,
      pe            TEXT,
      altura        TEXT,
      jogos         INTEGER DEFAULT 0,
      n_arquivar    INTEGER DEFAULT 0,
      n_monitorar   INTEGER DEFAULT 0,
      n_contratar   INTEGER DEFAULT 0,
      veredito      TEXT,
      promovido     BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome, time_nome)
    )
  `
  // Adicionar colunas que podem não existir em tabelas antigas
  await sql`ALTER TABLE jogadores_destacados ADD COLUMN IF NOT EXISTS competicao TEXT`.catch(()=>{})
  await sql`ALTER TABLE jogadores_destacados ADD COLUMN IF NOT EXISTS idade INTEGER`.catch(()=>{})
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const veredito = searchParams.get('veredito')

    let res
    if (veredito) {
      res = await sql`
        SELECT * FROM jogadores_destacados WHERE veredito = ${veredito}
        ORDER BY n_contratar DESC, n_monitorar DESC, jogos DESC
      `
    } else {
      res = await sql`
        SELECT * FROM jogadores_destacados
        ORDER BY n_contratar DESC, n_monitorar DESC, jogos DESC
      `
    }
    return Response.json({ jogadores: res.rows })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    await sql`DELETE FROM jogadores_destacados WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
