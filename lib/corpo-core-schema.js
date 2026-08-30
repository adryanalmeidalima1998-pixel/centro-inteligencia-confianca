import { sql } from '@vercel/postgres'

let coreSchemaPromise = null

async function ensureCoreSchemaInternal() {
  await sql`
    CREATE TABLE IF NOT EXISTS training_pdfs (
      id           SERIAL PRIMARY KEY,
      tipo         VARCHAR(20) NOT NULL,
      titulo       VARCHAR(255),
      data_treino  DATE,
      microciclo   VARCHAR(50),
      mesociclo    VARCHAR(50),
      periodo      VARCHAR(100),
      volume       INTEGER,
      url          TEXT NOT NULL,
      nome_arquivo VARCHAR(255),
      criado_em    TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS player_aliases (
      id             SERIAL PRIMARY KEY,
      source_name    VARCHAR(255) NOT NULL,
      canonical_name VARCHAR(255) NOT NULL,
      source         VARCHAR(50) NOT NULL DEFAULT 'manual',
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW(),
      UNIQUE (source_name, source)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS programacao (
      id           SERIAL PRIMARY KEY,
      tipo         VARCHAR(20) NOT NULL,
      titulo       VARCHAR(255),
      data_inicio  DATE,
      data_fim     DATE,
      conteudo     TEXT NOT NULL,
      nome_arquivo VARCHAR(255),
      criado_em    TIMESTAMP DEFAULT NOW()
    )
  `
}

export async function ensureCorpoCoreSchema() {
  if (!coreSchemaPromise) {
    coreSchemaPromise = ensureCoreSchemaInternal().catch(error => {
      coreSchemaPromise = null
      throw error
    })
  }
  return coreSchemaPromise
}
