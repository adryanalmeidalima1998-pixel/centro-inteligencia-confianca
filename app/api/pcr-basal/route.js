import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// Seed: basais da planilha Biomarkers_Ichroma_II — sheet Brasileiro 2026
const SEED_BASALS = [
  { jogador: 'Caique França',      basal: 0.67 },
  { jogador: 'Diego Torres',       basal: 0.33 },
  { jogador: 'Emerson Barbosa',    basal: 0.38 },
  { jogador: 'Carlos Eduardo',     basal: 0.59 },
  { jogador: 'Frederico Conte',    basal: 0.45 },
  { jogador: 'G. Cachoeira',       basal: 1.94 },
  { jogador: 'G. Maranhão',        basal: 0.75 },
  { jogador: 'G. Parede',          basal: 0.39 },
  { jogador: 'Hebert',             basal: 0.41 },
  { jogador: 'Hyan Vieira',        basal: 2.33 },
  { jogador: 'Igor Pereira',       basal: 0.29 },
  { jogador: 'Isaque Elias',       basal: 0.19 },
  { jogador: 'João Paulo',         basal: 0.53 },
  { jogador: 'Jonathan Costa',     basal: 0.32 },
  { jogador: 'Kaua Jesus',         basal: 0.28 },
  { jogador: 'Kewen Andrade',      basal: 0.60 },
  { jogador: 'Lucas Baptista',     basal: 0.35 },
  { jogador: 'Lucas Martins',      basal: 0.45 },
  { jogador: 'Lucca Borges',       basal: 0.72 },
  { jogador: 'Luis Carvalho',      basal: 0.34 },
  { jogador: 'Mateus Claus',       basal: 0.56 },
  { jogador: 'Maurício Antônio',   basal: 0.55 },
  { jogador: 'Nathan Mello',       basal: 0.54 },
  { jogador: 'Rafael Donato',      basal: 0.13 },
  { jogador: 'Ralf Souza',         basal: 0.17 },
  { jogador: 'Raphael Rodrigues',  basal: 0.33 },
  { jogador: 'Renan Castro',       basal: 0.46 },
  { jogador: 'Rian Pacheco',       basal: 0.55 },
  { jogador: 'Ryuta Takahashi',    basal: 0.16 },
  { jogador: 'Willian Farias',     basal: 0.78 },
  { jogador: 'Ynaiâ Kairê',        basal: 0.34 },
]

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pcr_basal (
      id            SERIAL PRIMARY KEY,
      jogador       VARCHAR(255) UNIQUE NOT NULL,
      basal         DECIMAL(8,4) NOT NULL,
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `
}

async function seedIfEmpty() {
  const count = await sql`SELECT COUNT(*) FROM pcr_basal`
  if (Number(count.rows[0].count) === 0) {
    for (const { jogador, basal } of SEED_BASALS) {
      await sql`
        INSERT INTO pcr_basal (jogador, basal)
        VALUES (${jogador}, ${basal})
        ON CONFLICT (jogador) DO NOTHING
      `
    }
  }
}

function calcDP(rows) {
  if (rows.length < 2) return 0.4606 // fallback do grupo atual
  const vals = rows.map(r => parseFloat(r.basal))
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1)
  return Math.sqrt(variance)
}

export async function GET() {
  try {
    await ensureTable()
    await seedIfEmpty()
    const result = await sql`SELECT * FROM pcr_basal ORDER BY jogador ASC`
    const dp = calcDP(result.rows)
    return NextResponse.json({ basals: result.rows, dp })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const { jogador, basal } = await request.json()
    if (!jogador || basal === undefined) {
      return NextResponse.json({ error: 'jogador e basal obrigatórios' }, { status: 400 })
    }
    await sql`
      INSERT INTO pcr_basal (jogador, basal, atualizado_em)
      VALUES (${jogador}, ${basal}, NOW())
      ON CONFLICT (jogador) DO UPDATE
        SET basal = ${basal}, atualizado_em = NOW()
    `
    const all = await sql`SELECT * FROM pcr_basal`
    const dp = calcDP(all.rows)
    return NextResponse.json({ ok: true, dp })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
