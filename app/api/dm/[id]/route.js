import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export async function PUT(request, context) {
  try {
    const { id: rawId } = await context.params
    const id   = parseInt(rawId)
    const body = await request.json()
    const { type = 'case', ...data } = body

    if (type === 'log') {
      try { await sql.query(`ALTER TABLE dm_logs ADD COLUMN IF NOT EXISTS pre_pos VARCHAR(30)`) } catch (_) {}
      const result = await sql`
        UPDATE dm_logs SET
          data           = ${data.data || null},
          jogador        = ${data.jogador || null},
          posicao        = ${data.posicao || null},
          pe_dominante   = ${data.pe_dominante || null},
          categoria      = ${data.categoria || 'Profissional'},
          periodo        = ${data.periodo || null},
          local_queixa   = ${data.local_queixa || null},
          membro_afetado = ${data.membro_afetado || null},
          hd             = ${data.hd || null},
          tipo_trabalho  = ${data.tipo_trabalho || null},
          pre_pos        = ${data.pre_pos || null},
          observacoes    = ${data.observacoes || null}
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json({ log: result.rows[0] })
    }

    const result = await sql`
      UPDATE dm_cases SET
        jogador          = ${data.jogador?.trim()},
        parte_corporal   = ${data.parte_corporal || null},
        tipo_lesao       = ${data.tipo_lesao || null},
        diagnostico      = ${data.diagnostico || null},
        hd_texto         = ${data.hd_texto || null},
        estagio          = ${data.estagio || null},
        status           = ${data.status || 'Tratamento'},
        membro           = ${data.membro || null},
        sintomatico      = ${data.sintomatico !== undefined ? data.sintomatico : true},
        conduta          = ${data.conduta || null},
        data_entrada     = ${data.data_entrada || null},
        data_lesao       = ${data.data_lesao || null},
        data_exame       = ${data.data_exame || null},
        data_cirurgia    = ${data.data_cirurgia || null},
        previsao_retorno = ${data.previsao_retorno || null},
        observacoes      = ${data.observacoes || null},
        atualizado_em    = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ case: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  try {
    // Next.js 15: params must be awaited
    const { id: rawId } = await context.params
    const id   = parseInt(rawId)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'case'

    if (type === 'log') {
      await sql`DELETE FROM dm_logs WHERE id = ${id}`
    } else {
      await sql`DELETE FROM dm_cases WHERE id = ${id}`
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
