import { sql } from '@vercel/postgres'

let ensurePromise = null

async function ensureInternal() {
  await sql`
    CREATE TABLE IF NOT EXISTS liga_jogadores (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '[]'::jsonb,
      total INTEGER DEFAULT 0,
      fonte TEXT DEFAULT 'sportsbase',
      upload_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0`
  await sql`ALTER TABLE liga_jogadores ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'sportsbase'`
  await sql`CREATE INDEX IF NOT EXISTS liga_jogadores_slug_fonte_upload_idx ON liga_jogadores(slug, fonte, upload_at DESC)`
}

export async function ensureLigaJogadoresSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureInternal().catch(error => {
      ensurePromise = null
      throw error
    })
  }
  return ensurePromise
}
