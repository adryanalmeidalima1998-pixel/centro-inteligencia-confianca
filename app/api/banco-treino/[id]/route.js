import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const result = await sql`
      UPDATE banco_treino SET
        data                = ${body.data || null},
        semana              = ${body.semana || null},
        local               = ${body.local || null},
        periodo             = ${body.periodo || null},
        objetivo_sessao     = ${body.objetivo_sessao || null},
        objetivo_secundario = ${body.objetivo_secundario || null},
        atividade_1         = ${body.atividade_1 || null},
        atividade_2         = ${body.atividade_2 || null},
        atividade_3         = ${body.atividade_3 || null},
        atividade_4         = ${body.atividade_4 || null},
        atividade_5         = ${body.atividade_5 || null},
        complemento         = ${body.complemento || null},
        pdf_id              = ${body.pdf_id || null},
        link_video          = ${body.link_video || null},
        unid_treino         = ${body.unid_treino || null},
        atualizado_em       = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ sessao: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params
    await sql`DELETE FROM banco_treino WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
