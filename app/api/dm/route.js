import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dm_cases (
      id                SERIAL PRIMARY KEY,
      jogador           VARCHAR(255) NOT NULL,
      parte_corporal    VARCHAR(100),
      tipo_lesao        VARCHAR(100),
      diagnostico       VARCHAR(255),
      hd_texto          TEXT,
      estagio           VARCHAR(100),
      status            VARCHAR(50)  DEFAULT 'Tratamento',
      membro            VARCHAR(20),
      sintomatico       BOOLEAN      DEFAULT TRUE,
      conduta           TEXT,
      data_entrada      DATE,
      data_lesao        DATE,
      data_exame        DATE,
      data_cirurgia     DATE,
      previsao_retorno  DATE,
      observacoes       TEXT,
      criado_em         TIMESTAMP    DEFAULT NOW(),
      atualizado_em     TIMESTAMP    DEFAULT NOW()
    )
  `
  const migrations = [
    `ALTER TABLE dm_cases ADD COLUMN IF NOT EXISTS hd_texto TEXT`,
    `ALTER TABLE dm_cases ADD COLUMN IF NOT EXISTS membro VARCHAR(20)`,
    `ALTER TABLE dm_cases ADD COLUMN IF NOT EXISTS sintomatico BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE dm_cases ADD COLUMN IF NOT EXISTS conduta TEXT`,
    `ALTER TABLE dm_cases ADD COLUMN IF NOT EXISTS data_lesao DATE`,
    `ALTER TABLE dm_cases ADD COLUMN IF NOT EXISTS data_exame DATE`,
    `ALTER TABLE dm_cases ADD COLUMN IF NOT EXISTS data_cirurgia DATE`,
  ]
  for (const m of migrations) {
    try { await sql.query(m) } catch (_) {}
  }

  await sql`
    CREATE TABLE IF NOT EXISTS dm_logs (
      id               SERIAL PRIMARY KEY,
      data             DATE,
      jogador          VARCHAR(255),
      posicao          VARCHAR(100),
      pe_dominante     VARCHAR(30),
      categoria        VARCHAR(50)  DEFAULT 'Profissional',
      periodo          VARCHAR(30),
      local_queixa     VARCHAR(100),
      membro_afetado   VARCHAR(50),
      hd               VARCHAR(255),
      tipo_trabalho    VARCHAR(100),
      observacoes      TEXT,
      criado_em        TIMESTAMP DEFAULT NOW()
    )
  `
  const logMigrations = [
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS posicao VARCHAR(100)`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS pe_dominante VARCHAR(30)`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'Profissional'`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS periodo VARCHAR(30)`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS local_queixa VARCHAR(100)`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS membro_afetado VARCHAR(50)`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS hd VARCHAR(255)`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS tipo_trabalho VARCHAR(100)`,
    `ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS pre_pos VARCHAR(30)`,
  ]
  for (const m of logMigrations) {
    try { await sql.query(m) } catch (_) {}
  }
}

export async function GET() {
  try {
    await ensureTable()
    const cases = await sql`SELECT * FROM dm_cases ORDER BY status ASC, criado_em DESC`
    const logs  = await sql`SELECT * FROM dm_logs  ORDER BY data DESC, criado_em DESC`
    return NextResponse.json({ cases: cases.rows, logs: logs.rows })
  } catch (err) {
    return NextResponse.json({ cases: [], logs: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { type = 'case', ...data } = body

    if (type === 'log') {
      const result = await sql`
        INSERT INTO dm_logs (
          data, jogador, posicao, pe_dominante, categoria,
          periodo, local_queixa, membro_afetado, hd, tipo_trabalho, pre_pos, observacoes
        )
        VALUES (
          ${data.data || null},
          ${data.jogador || null},
          ${data.posicao || null},
          ${data.pe_dominante || null},
          ${data.categoria || 'Profissional'},
          ${data.periodo || null},
          ${data.local_queixa || null},
          ${data.membro_afetado || null},
          ${data.hd || null},
          ${data.tipo_trabalho || null},
          ${data.pre_pos || null},
          ${data.observacoes || null}
        )
        RETURNING *
      `
      return NextResponse.json({ log: result.rows[0] })
    }

    if (!data.jogador?.trim()) {
      return NextResponse.json({ error: 'Nome do jogador é obrigatório.' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO dm_cases (
        jogador, parte_corporal, tipo_lesao, diagnostico, hd_texto,
        estagio, status, membro, sintomatico, conduta,
        data_entrada, data_lesao, data_exame, data_cirurgia, previsao_retorno, observacoes
      )
      VALUES (
        ${data.jogador.trim()},
        ${data.parte_corporal || null},
        ${data.tipo_lesao || null},
        ${data.diagnostico || null},
        ${data.hd_texto || null},
        ${data.estagio || null},
        ${data.status || 'Tratamento'},
        ${data.membro || null},
        ${data.sintomatico !== undefined ? data.sintomatico : true},
        ${data.conduta || null},
        ${data.data_entrada || null},
        ${data.data_lesao || null},
        ${data.data_exame || null},
        ${data.data_cirurgia || null},
        ${data.previsao_retorno || null},
        ${data.observacoes || null}
      )
      RETURNING *
    `
    return NextResponse.json({ case: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
