import { sql } from '@vercel/postgres'

export async function ensureTreinadoresSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS treinadores (
      id                SERIAL PRIMARY KEY,
      nome              TEXT NOT NULL,
      data_nascimento   TEXT,
      nacionalidade     TEXT,
      historico_clubes  TEXT,
      sistemas_jogo     TEXT[],
      estilo_jogo       TEXT,
      forcas            TEXT,
      fraquezas         TEXT,
      recomendacao      TEXT,
      estrelas          INTEGER,
      pdf_base64        TEXT,
      pdf_filename      TEXT,
      uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome)
    )
  `

  const alters = [
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS transfermarkt_id TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS transfermarkt_url TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS performance_url TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS foto_url TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS clube_atual TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS cargo_atual TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS cidade_nascimento TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS idade INTEGER`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS licenca TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS formacao_preferida TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS media_tempo_cargo TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS agente TEXT`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS carreira_json JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS jogos_json JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS metricas_json JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS relatorio_json JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS fonte_atualizada_em TIMESTAMPTZ`,
    `ALTER TABLE treinadores ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW()`
  ]

  for (const statement of alters) {
    await sql.query(statement)
  }

  await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS treinadores_transfermarkt_id_uq ON treinadores(transfermarkt_id) WHERE transfermarkt_id IS NOT NULL`)
}

export function safeJson(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}
