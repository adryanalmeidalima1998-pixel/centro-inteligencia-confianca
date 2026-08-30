// CAMINHO: app/api/banco-partidas/[id]/route.js
import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export async function GET(_, { params }) {
  try {
    const { id: rawId } = await params          // ← await params (Next.js 15+)
    const id = parseInt(rawId)
    const res = await sql`SELECT * FROM banco_partidas WHERE id = ${id}`
    if (!res.rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json({ partida: res.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id: rawId } = await params          // ← await params (Next.js 15+)
    const id   = parseInt(rawId)
    const body = await request.json()
    const { gps_rows, wyscout_rows, team_stats, ...meta } = body

    if (gps_rows !== undefined) {
      const st = gps_rows.length ? 'ok' : 'pendente'
      await sql`
        UPDATE banco_partidas
        SET gps_rows = ${JSON.stringify(gps_rows)}, gps_status = ${st}
        WHERE id = ${id}
      `
    }

    if (wyscout_rows !== undefined) {
      const st = wyscout_rows.length ? 'ok' : 'pendente'
      await sql`
        UPDATE banco_partidas
        SET wyscout_rows = ${JSON.stringify(wyscout_rows)}, wyscout_status = ${st}
        WHERE id = ${id}
      `
    }

    if (team_stats !== undefined) {
      await sql`UPDATE banco_partidas SET team_stats = ${JSON.stringify(team_stats)} WHERE id = ${id}`
    }

    // Update meta fields if any provided
    const {
      adversario, placar, resultado, competicao,
      rodada, mando, modelo_jogo, data_jogo,
    } = meta

    if (Object.keys(meta).length) {
      await sql`
        UPDATE banco_partidas SET
          adversario  = COALESCE(${adversario  ?? null}, adversario),
          placar      = COALESCE(${placar      ?? null}, placar),
          resultado   = COALESCE(${resultado   ?? null}, resultado),
          competicao  = COALESCE(${competicao  ?? null}, competicao),
          rodada      = COALESCE(${rodada      ?? null}, rodada),
          mando       = COALESCE(${mando       ?? null}, mando),
          modelo_jogo = COALESCE(${modelo_jogo ?? null}, modelo_jogo),
          data_jogo   = COALESCE(${data_jogo   ?? null}, data_jogo)
        WHERE id = ${id}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_, { params }) {
  try {
    const { id: rawId } = await params          // ← await params (Next.js 15+)
    const id = parseInt(rawId)
    await sql`DELETE FROM banco_partidas WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
