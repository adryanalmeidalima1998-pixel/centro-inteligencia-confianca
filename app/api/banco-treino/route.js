import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS banco_treino (
      id                   SERIAL PRIMARY KEY,
      data                 DATE,
      semana               INTEGER,
      local                VARCHAR(100),
      periodo              VARCHAR(50),
      objetivo_sessao      VARCHAR(255),
      objetivo_secundario  VARCHAR(255),
      atividade_1          TEXT,
      atividade_2          TEXT,
      atividade_3          TEXT,
      atividade_4          TEXT,
      atividade_5          TEXT,
      complemento          TEXT,
      pdf_id               INTEGER,
      link_video           TEXT,
      unid_treino          VARCHAR(100),
      criado_em            TIMESTAMP DEFAULT NOW(),
      atualizado_em        TIMESTAMP DEFAULT NOW()
    )
  `
}

export async function GET() {
  try {
    await ensureTable()
    const result = await sql`SELECT * FROM banco_treino ORDER BY data DESC, criado_em DESC`
    return NextResponse.json({ sessoes: result.rows })
  } catch (err) {
    return NextResponse.json({ sessoes: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const result = await sql`
      INSERT INTO banco_treino (
        data, semana, local, periodo,
        objetivo_sessao, objetivo_secundario,
        atividade_1, atividade_2, atividade_3, atividade_4, atividade_5,
        complemento, pdf_id, link_video, unid_treino
      ) VALUES (
        ${body.data || null},
        ${body.semana || null},
        ${body.local || null},
        ${body.periodo || null},
        ${body.objetivo_sessao || null},
        ${body.objetivo_secundario || null},
        ${body.atividade_1 || null},
        ${body.atividade_2 || null},
        ${body.atividade_3 || null},
        ${body.atividade_4 || null},
        ${body.atividade_5 || null},
        ${body.complemento || null},
        ${body.pdf_id || null},
        ${body.link_video || null},
        ${body.unid_treino || null}
      )
      RETURNING *
    `
    return NextResponse.json({ sessao: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
