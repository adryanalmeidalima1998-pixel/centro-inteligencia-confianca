import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })
    const numId = Number(id)
    if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
    await sql`DELETE FROM penaltis_cig WHERE id = ${numId}`
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
