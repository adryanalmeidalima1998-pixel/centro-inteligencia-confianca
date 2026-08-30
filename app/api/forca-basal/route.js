import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// ── Absoluta da Apresentação = (E+D)/2 no primeiro dia da temporada ──────────
// FIXO para sempre. Roda no GET toda vez para garantir consistência.
const SEED_APRESENTACAO = [
  { jogador: 'Caique Franca',      absoluta: 477.0 },
  { jogador: 'Carlos Eduardo',     absoluta: 522.5 },
  { jogador: 'Diego Torres',       absoluta: 392.5 },
  { jogador: 'Emerson Barbosa',    absoluta: 506.5 },
  { jogador: 'Frederico Conte',    absoluta: 479.5 },
  { jogador: 'G. Cachoeira',       absoluta: 400.0 },
  { jogador: 'G. Maranhão',        absoluta: 459.5 },
  { jogador: 'G. Parede',          absoluta: 301.0 },
  { jogador: 'Hebert',             absoluta: 490.0 },
  { jogador: 'Hyan Vieira',        absoluta: 419.0 },
  { jogador: 'Igor Pereira',       absoluta: 487.0 },
  { jogador: 'Isaque Elias',       absoluta: 455.0 },
  { jogador: 'João Paulo',         absoluta: 344.5 },
  { jogador: 'Jonathan Costa',     absoluta: 489.5 },
  { jogador: 'Kaua Jesus',         absoluta: 435.0 },
  { jogador: 'Kewen Andrade',      absoluta: 482.0 },
  { jogador: 'Lucas Baptista',     absoluta: 400.0 },
  { jogador: 'Lucas Martins',      absoluta: 530.0 },
  { jogador: 'Lucca Borges',       absoluta: 324.5 },
  { jogador: 'Luis Carvalho',      absoluta: 378.0 },
  { jogador: 'Maurício Antônio',   absoluta: 398.0 },
  { jogador: 'Nathan Mello',       absoluta: 410.5 },
  { jogador: 'Rafael Donato',      absoluta: 548.5 },
  { jogador: 'Ralf',               absoluta: 454.0 },
  { jogador: 'Raphael Rodrigues',  absoluta: 393.0 },
  { jogador: 'Renan Castro',       absoluta: 384.5 },
  { jogador: 'Rian Pacheco',       absoluta: 333.0 },
  { jogador: 'Willian Farias',     absoluta: 380.0 },
  { jogador: 'Ynaiã Kairê',        absoluta: 435.0 },
]

async function ensureTable() {
  // Cria tabela se não existir
  await sql`
    CREATE TABLE IF NOT EXISTS forca_basal (
      id                    SERIAL PRIMARY KEY,
      jogador               VARCHAR(255) UNIQUE NOT NULL,
      absoluta_apresentacao DECIMAL(8,2) DEFAULT NULL,
      basal                 DECIMAL(8,2) DEFAULT NULL,
      atualizado_em         TIMESTAMP DEFAULT NOW()
    )
  `
  // Adiciona colunas novas se a tabela já existia sem elas
  await sql`ALTER TABLE forca_basal ADD COLUMN IF NOT EXISTS absoluta_apresentacao DECIMAL(8,2) DEFAULT NULL`
  await sql`ALTER TABLE forca_basal ALTER COLUMN basal DROP NOT NULL`
}

async function syncApresentacao() {
  // Sempre faz upsert do absoluta_apresentacao — é fixo e nunca deve mudar por lógica de jogo
  // Usa ON CONFLICT para não sobrescrever basal (campo separado)
  for (const { jogador, absoluta } of SEED_APRESENTACAO) {
    await sql`
      INSERT INTO forca_basal (jogador, absoluta_apresentacao)
      VALUES (${jogador}, ${absoluta})
      ON CONFLICT (jogador) DO UPDATE
        SET absoluta_apresentacao = ${absoluta}
    `
  }
}

export async function GET() {
  try {
    await ensureTable()
    await syncApresentacao()
    const result = await sql`SELECT * FROM forca_basal ORDER BY jogador ASC`
    return NextResponse.json({ basals: result.rows })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()

    // Atualiza basal pós-jogo: usa GREATEST para nunca diminuir
    if (body.type === 'update_basal') {
      const { jogador, basal } = body
      if (!jogador || basal === undefined)
        return NextResponse.json({ error: 'jogador e basal obrigatórios' }, { status: 400 })
      await sql`
        INSERT INTO forca_basal (jogador, basal, atualizado_em)
        VALUES (${jogador}, ${basal}, NOW())
        ON CONFLICT (jogador) DO UPDATE
          SET basal = GREATEST(COALESCE(forca_basal.basal, 0), ${basal}),
              atualizado_em = NOW()
      `
      return NextResponse.json({ ok: true })
    }

    // Atualiza absoluta da apresentação manualmente (caso especial)
    if (body.type === 'update_apresentacao') {
      const { jogador, absoluta } = body
      if (!jogador || absoluta === undefined)
        return NextResponse.json({ error: 'jogador e absoluta obrigatórios' }, { status: 400 })
      await sql`
        INSERT INTO forca_basal (jogador, absoluta_apresentacao, atualizado_em)
        VALUES (${jogador}, ${absoluta}, NOW())
        ON CONFLICT (jogador) DO UPDATE
          SET absoluta_apresentacao = ${absoluta}, atualizado_em = NOW()
      `
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'type inválido' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
