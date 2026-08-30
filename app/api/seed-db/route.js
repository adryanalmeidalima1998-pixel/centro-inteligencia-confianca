import { sql } from '@vercel/postgres'
import { LIGAS_SEED, TIMES_SEED } from './seed-data.js'

/* ─── TABELAS ──────────────────────────────────────────────────── */
async function ensureTables() {
  // Tabela de ligas (tem ID próprio)
  await sql`
    CREATE TABLE IF NOT EXISTS ligas_db (
      id         SERIAL PRIMARY KEY,
      nome       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Tabela de times (ID único por nome, independente de liga)
  await sql`
    CREATE TABLE IF NOT EXISTS times_db (
      id         SERIAL PRIMARY KEY,
      nome       TEXT NOT NULL UNIQUE,
      ligas      TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Tabela de jogadores vinculados a times
  await sql`
    CREATE TABLE IF NOT EXISTS jogadores_banco (
      id          SERIAL PRIMARY KEY,
      nome        TEXT NOT NULL,
      time_id     INTEGER REFERENCES times_db(id) ON DELETE SET NULL,
      posicao     TEXT,
      pe          TEXT,
      altura      TEXT,
      nascimento  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome, time_id)
    )
  `
  // Índice para busca rápida por nome de time
  await sql`
    CREATE INDEX IF NOT EXISTS idx_times_nome ON times_db USING GIN (to_tsvector('portuguese', nome))
  `.catch(() => {}) // ignora se já existe
}

/* ─── GET: status do seed ───────────────────────────────────────── */
export async function GET(request) {
  try {
    await ensureTables()
    const { searchParams } = new URL(request.url)
    const check = searchParams.get('check')

    if (check) {
      const [ligas, times] = await Promise.all([
        sql`SELECT COUNT(*)::int as c FROM ligas_db`,
        sql`SELECT COUNT(*)::int as c FROM times_db`,
      ])
      return Response.json({
        ligas: ligas.rows[0].c,
        times: times.rows[0].c,
        seeded: ligas.rows[0].c > 0 && times.rows[0].c > 0,
      })
    }

    return Response.json({ message: 'Use POST para executar o seed, GET?check=1 para verificar status.' })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* ─── POST: executar seed ───────────────────────────────────────── */
export async function POST(request) {
  try {
    await ensureTables()

    const body = await request.json().catch(() => ({}))
    const force = body.force === true // se force=true, limpa e reinsere

    if (force) {
      // Só reseta as ligas e times, não os jogadores (não queremos perder dados de jogadores)
      // Só limpa ligas_db — NÃO usa CASCADE para não apagar times_db e jogadores_banco
      await sql`TRUNCATE ligas_db RESTART IDENTITY`
    }

    // ── 1. Inserir ligas ─────────────────────────────────────────
    let ligasInseridas = 0
    for (const liga of LIGAS_SEED) {
      const res = await sql`
        INSERT INTO ligas_db (nome) VALUES (${liga})
        ON CONFLICT (nome) DO NOTHING
        RETURNING id
      `
      if (res.rows.length > 0) ligasInseridas++
    }

    // ── 2. Inserir times ─────────────────────────────────────────
    // Processo em batches de 50 para não travar
    let timesInseridos = 0
    const BATCH = 50

    for (let i = 0; i < TIMES_SEED.length; i += BATCH) {
      const batch = TIMES_SEED.slice(i, i + BATCH)
      for (const t of batch) {
        const ligasArray = t.ligas || []
        const res = await sql`
          INSERT INTO times_db (nome, ligas) VALUES (${t.nome}, ${ligasArray})
          ON CONFLICT (nome) DO UPDATE SET
            ligas = (
              SELECT ARRAY(
                SELECT DISTINCT unnest(times_db.ligas || EXCLUDED.ligas)
                ORDER BY 1
              )
            )
          RETURNING id
        `
        if (res.rows.length > 0) timesInseridos++
      }
    }

    // ── 3. Verificar resultado ─────────────────────────────────
    const [ligaCount, timeCount] = await Promise.all([
      sql`SELECT COUNT(*)::int as c FROM ligas_db`,
      sql`SELECT COUNT(*)::int as c FROM times_db`,
    ])

    return Response.json({
      success: true,
      ligasInseridas,
      timesInseridos,
      totalLigas: ligaCount.rows[0].c,
      totalTimes: timeCount.rows[0].c,
      message: `Seed concluído: ${ligaCount.rows[0].c} ligas e ${timeCount.rows[0].c} times no banco.`,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
