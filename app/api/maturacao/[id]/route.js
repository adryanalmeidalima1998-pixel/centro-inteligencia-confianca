import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

// PUT: atualiza observações da comissão / responsável de uma avaliação
export async function PUT(request, context) {
  try {
    const { id: rawId } = await context.params
    const id = parseInt(rawId)
    const body = await request.json()
    const result = await sql`
      UPDATE maturacao_assessments SET
        staff_notes = ${body.staff_notes ?? null},
        responsavel = ${body.responsavel ?? null}
      WHERE id = ${id}
      RETURNING *
    `
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Avaliação não encontrada.' }, { status: 404 })
    }
    return NextResponse.json({ assessment: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: type=assessment (padrão) remove avaliação; type=athlete remove atleta + avaliações
export async function DELETE(request, context) {
  try {
    const { id: rawId } = await context.params
    const id = parseInt(rawId)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'assessment'

    if (type === 'athlete') {
      await sql`DELETE FROM maturacao_athletes WHERE id = ${id}`
    } else {
      await sql`DELETE FROM maturacao_assessments WHERE id = ${id}`
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
