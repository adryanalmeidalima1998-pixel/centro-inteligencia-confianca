// app/api/elenco-session/route.js
// Persiste o estado completo do ElencoClient no banco de dados Neon/Vercel Postgres.
// Substitui o localStorage — os dados ficam disponíveis em qualquer dispositivo/navegador.

import { sql } from '@vercel/postgres'

export const runtime = 'nodejs'
export const maxDuration = 30

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS elenco_session (
      id          SERIAL PRIMARY KEY,
      session_key TEXT NOT NULL UNIQUE,
      payload     TEXT NOT NULL,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `

}

const SESSION_KEY = 'confianca_elenco_2026'

// GET — carrega o estado salvo
export async function GET() {
  try {
    await ensureTable()
    const res = await sql`
      SELECT payload, updated_at
      FROM elenco_session
      WHERE session_key = ${SESSION_KEY}
      LIMIT 1
    `
    if (!res.rows.length) return Response.json({ found: false, data: null })
    const data = JSON.parse(res.rows[0].payload)
    return Response.json({ found: true, data, updated_at: res.rows[0].updated_at })
  } catch (err) {
    console.error('[elenco-session GET]', err)
    return Response.json({ error: err.message, found: false, data: null }, { status: 500 })
  }
}

// POST — salva/atualiza o estado
export async function POST(req) {
  try {
    await ensureTable()
    const body = await req.json()
    const payload = JSON.stringify(body)

    await sql`
      INSERT INTO elenco_session (session_key, payload, updated_at)
      VALUES (${SESSION_KEY}, ${payload}, NOW())
      ON CONFLICT (session_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[elenco-session POST]', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — limpa o estado salvo
export async function DELETE() {
  try {
    await ensureTable()
    await sql`DELETE FROM elenco_session WHERE session_key = ${SESSION_KEY}`
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[elenco-session DELETE]', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
