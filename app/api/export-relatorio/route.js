import { sql } from '@vercel/postgres'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const match_key = searchParams.get('match_key')
    const formato   = searchParams.get('formato') // 'pdf' | 'excel'
    const tipo      = searchParams.get('tipo')    // 'relatorio' | 'destaques' | 'semanal'

    if (tipo === 'destaques') {
      const rows = await sql`
        SELECT * FROM jogadores_destacados ORDER BY n_contratar DESC, n_monitorar DESC, jogos DESC
      `
      const data = buildDestaquesCSV(rows.rows)
      return new Response(data, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="jogadores_destacados.csv"',
        },
      })
    }

    if (tipo === 'semanal') {
      // retornar JSON da observação semanal para o front gerar o PDF
      const rows = await sql`
        SELECT match_key, mandante, visitante, competicao, data_jogo, relatorio, updated_at
        FROM relatorios_partida
        WHERE data_jogo >= (CURRENT_DATE - INTERVAL '14 days')::TEXT
        ORDER BY data_jogo DESC
      `
      return Response.json({ partidas: rows.rows })
    }

    if (!match_key) {
      return Response.json({ error: 'match_key required' }, { status: 400 })
    }

    const res = await sql`
      SELECT * FROM relatorios_partida WHERE match_key = ${match_key}
    `
    if (!res.rows[0]) return Response.json({ error: 'not found' }, { status: 404 })

    const rel = res.rows[0]
    const data = formato === 'excel' ? buildExcel(rel) : null

    if (formato === 'excel' && data) {
      return new Response(data, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="relatorio_${match_key}.xlsx"`,
        },
      })
    }

    // Para PDF retornar JSON e o front usa jsPDF
    return Response.json({ relatorio: rel.relatorio, meta: { match_key, mandante: rel.mandante, visitante: rel.visitante, data_jogo: rel.data_jogo, competicao: rel.competicao } })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function buildDestaquesCSV(rows) {
  const header = 'Nome,Clube,Posição,Pé,Altura,Veredito,Jogos,Arquivar,Monitorar,Contratar,Promovido'
  const lines = rows.map(r =>
    `"${r.nome}","${r.time_nome}","${r.posicao}","${r.pe}","${r.altura}","${r.veredito}",${r.jogos},${r.n_arquivar},${r.n_monitorar},${r.n_contratar},${r.promovido ? 'Sim' : 'Não'}`
  )
  return [header, ...lines].join('\n')
}

function buildExcel(rel) {
  // Placeholder: retorna null, front usa xlsx
  return null
}
