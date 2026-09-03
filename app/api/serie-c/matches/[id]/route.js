// app/api/serie-c/matches/[id]/route.js
// Edição manual da rodada e da posição na tabela de um jogo específico.
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const round = body.round === '' || body.round === null || body.round === undefined ? null : Number(body.round)
    const position = body.position === '' || body.position === null || body.position === undefined ? null : Number(body.position)

    const res = await sql`
      UPDATE serie_c_club_matches
      SET round = ${round}, position = ${position}
      WHERE id = ${id}
      RETURNING id, round, position
    `
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Jogo não encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, match: res.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Falha ao salvar.' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    await sql`DELETE FROM serie_c_club_matches WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Falha ao excluir.' }, { status: 500 })
  }
}
