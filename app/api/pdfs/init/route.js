import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS training_pdfs (
        id          SERIAL PRIMARY KEY,
        tipo        VARCHAR(20)  NOT NULL,
        titulo      VARCHAR(255),
        data_treino DATE,
        microciclo  VARCHAR(50),
        mesociclo   VARCHAR(50),
        periodo     VARCHAR(100),
        volume      INTEGER,
        url         TEXT         NOT NULL,
        nome_arquivo VARCHAR(255),
        criado_em   TIMESTAMP    DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS gps_sessions (
        id           SERIAL PRIMARY KEY,
        titulo       VARCHAR(255),
        data_sessao  DATE,
        tipo_sessao  VARCHAR(50),
        num_atletas  INTEGER,
        url          TEXT DEFAULT '',
        nome_arquivo VARCHAR(255),
        rows         JSONB,
        criado_em    TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE gps_sessions ADD COLUMN IF NOT EXISTS rows JSONB`
    await sql`
      CREATE TABLE IF NOT EXISTS player_photos (
        id             SERIAL PRIMARY KEY,
        canonical_name VARCHAR(255) UNIQUE NOT NULL,
        url            TEXT         NOT NULL,
        filename       VARCHAR(255),
        created_at     TIMESTAMP    DEFAULT NOW(),
        updated_at     TIMESTAMP    DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS player_aliases (
        id             SERIAL PRIMARY KEY,
        source_name    VARCHAR(255) NOT NULL,
        canonical_name VARCHAR(255) NOT NULL,
        source         VARCHAR(50)  NOT NULL DEFAULT 'manual',
        created_at     TIMESTAMP    DEFAULT NOW(),
        updated_at     TIMESTAMP    DEFAULT NOW(),
        UNIQUE (source_name, source)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS programacao (
        id           SERIAL PRIMARY KEY,
        tipo         VARCHAR(20)  NOT NULL,
        titulo       VARCHAR(255),
        data_inicio  DATE,
        data_fim     DATE,
        conteudo     TEXT NOT NULL,
        nome_arquivo VARCHAR(255),
        criado_em    TIMESTAMP DEFAULT NOW()
      )
    `
    return NextResponse.json({ ok: true, message: 'Tabelas criadas ou já existentes.' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
