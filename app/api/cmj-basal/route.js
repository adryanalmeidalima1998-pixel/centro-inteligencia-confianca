import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// Dados iniciais da planilha CMJ Paulista 2026 (2)
const SEED_BASALS = [
  { jogador: 'Caique França',      basal: 48.1 },
  { jogador: 'Carlos Eduardo',     basal: 42.8 },
  { jogador: 'Diego Torres',       basal: 42.7 },
  { jogador: 'Edson Rogerio',      basal: 47.7 },
  { jogador: 'Emerson Barbosa',    basal: 56.5 },
  { jogador: 'Frederico Conte',    basal: 47.3 },
  { jogador: 'G. Cachoeira',       basal: 59.2 },
  { jogador: 'G. Maranhão',        basal: 47.6 },
  { jogador: 'G. Parede',          basal: 42.5 },
  { jogador: 'Hebert Oliveira',    basal: 48.2 },
  { jogador: 'Hyan Vieira',        basal: 48.4 },
  { jogador: 'Igor Pereira',       basal: 46.8 },
  { jogador: 'Isaque Elias',       basal: 41.0 },
  { jogador: 'João Paulo',         basal: 43.9 },
  { jogador: 'Jonathan Costa',     basal: 52.0 },
  { jogador: 'Kaua Jesus',         basal: 51.0 },
  { jogador: 'Kewen Andrade',      basal: 43.1 },
  { jogador: 'Lucas Baptista',     basal: 42.3 },
  { jogador: 'Lucas Martins',      basal: 42.3 },
  { jogador: 'Lucca Borges',       basal: 43.7 },
  { jogador: 'Luis Carvalho',      basal: 52.6 },
  { jogador: 'Maurício Antônio',   basal: 43.9 },
  { jogador: 'Nathan Mello',       basal: 40.7 },
  { jogador: 'Rafael Donato',      basal: 49.9 },
  { jogador: 'Rafael Freitas',     basal: 52.0 },
  { jogador: 'Ralf Souza',         basal: 37.0 },
  { jogador: 'Raphael Rodrigues',  basal: 50.4 },
  { jogador: 'Renan Castro',       basal: 44.6 },
  { jogador: 'Rian Pacheco',       basal: 42.1 },
  { jogador: 'Willian Farias',     basal: 51.3 },
  { jogador: 'Ynaiâ Kairê',        basal: 41.3 },
]

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS cmj_basal (
      id           SERIAL PRIMARY KEY,
      jogador      VARCHAR(255) UNIQUE NOT NULL,
      basal        DECIMAL(6,2) NOT NULL,
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `
}

async function seedIfEmpty() {
  const count = await sql`SELECT COUNT(*) FROM cmj_basal`
  if (Number(count.rows[0].count) === 0) {
    for (const { jogador, basal } of SEED_BASALS) {
      await sql`
        INSERT INTO cmj_basal (jogador, basal)
        VALUES (${jogador}, ${basal})
        ON CONFLICT (jogador) DO NOTHING
      `
    }
  }
}

// Calcula DP do grupo a partir dos basais armazenados
function calcDP(rows) {
  if (rows.length < 2) return 5.03 // fallback
  const vals = rows.map(r => parseFloat(r.basal))
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1)
  return Math.sqrt(variance)
}

export async function GET() {
  try {
    await ensureTable()
    await seedIfEmpty()
    const result = await sql`SELECT * FROM cmj_basal ORDER BY jogador ASC`
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
      INSERT INTO cmj_basal (jogador, basal, atualizado_em)
      VALUES (${jogador}, ${basal}, NOW())
      ON CONFLICT (jogador) DO UPDATE
        SET basal = ${basal}, atualizado_em = NOW()
    `
    const all = await sql`SELECT * FROM cmj_basal`
    const dp = calcDP(all.rows)
    return NextResponse.json({ ok: true, dp })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
