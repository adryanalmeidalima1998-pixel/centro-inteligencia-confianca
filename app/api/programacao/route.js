import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'
import { ensureCorpoCoreSchema } from '@/lib/corpo-core-schema'

export async function GET(request) {
  await ensureCorpoCoreSchema()
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') // 'semanal' | 'diaria'
    const result = tipo
      ? await sql`SELECT * FROM programacao WHERE tipo = ${tipo} ORDER BY criado_em DESC`
      : await sql`SELECT * FROM programacao ORDER BY criado_em DESC`
    return NextResponse.json({ programacao: result.rows })
  } catch (err) {
    return NextResponse.json({ programacao: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  await ensureCorpoCoreSchema()
  try {
    const body = await request.json()
    const { tipo, titulo, data_inicio, data_fim, conteudo, nome_arquivo } = body
    if (!conteudo) return NextResponse.json({ error: 'Conteúdo obrigatório.' }, { status: 400 })
    const result = await sql`
      INSERT INTO programacao (tipo, titulo, data_inicio, data_fim, conteudo, nome_arquivo)
      VALUES (${tipo}, ${titulo||null}, ${data_inicio||null}, ${data_fim||null}, ${conteudo}, ${nome_arquivo||null})
      RETURNING *
    `
    return NextResponse.json({ programacao: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  await ensureCorpoCoreSchema()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })
    await sql`DELETE FROM programacao WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
