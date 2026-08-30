import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export async function PATCH(request, context) {
  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const body = await request.json()
    const { match_info } = body

    if (!match_info) return NextResponse.json({ error: 'match_info obrigatório' }, { status: 400 })

    // Busca a sessão atual e mescla match_info no JSONB rows
    const current = await sql`SELECT rows FROM gps_sessions WHERE id = ${id}`
    if (current.rows.length === 0) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

    const rows = current.rows[0].rows || {}
    const updated = { ...rows, match_info }

    await sql`UPDATE gps_sessions SET rows = ${JSON.stringify(updated)} WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  try {
    // Next.js 15: params must be awaited
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    // Deletar de forma segura
    const result = await sql`DELETE FROM gps_sessions WHERE id = ${id} RETURNING id`

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Sessão deletada com sucesso',
      deletedId: id
    })
  } catch (err) {
    console.error('Erro ao deletar sessão:', err)
    return NextResponse.json(
      { error: 'Erro ao deletar sessão', details: err.message },
      { status: 500 }
    )
  }
}
