import { sql } from '@vercel/postgres'
import { ensureCigJogadores, findOrCreateJogador, normNome } from '@/app/lib/cigJogadores'

/* ─── GET /api/cig-jogadores ────────────────────────────────────────
   Retorna todos os jogadores canônicos com sua posição no funil.
   Parâmetros opcionais:
     ?q=nome        busca por nome (min 2 chars)
     ?id=N          retorna um jogador específico com detalhe
──────────────────────────────────────────────────────────────────── */
export async function GET(request) {
  try {
    await ensureCigJogadores()
    const { searchParams } = new URL(request.url)
    const q  = searchParams.get('q')
    const id = searchParams.get('id')

    if (id) {
      const row = await sql`
        SELECT
          cj.*,
          lp.status         AS watchlist_status,
          lp.prioridade     AS watchlist_prioridade,
          lf.recomendacao   AS recomendacao_final,
          lf.irc_final,
          jd.veredito       AS veredito_campo,
          jd.jogos          AS n_observacoes,
          jd.n_contratar,
          jd.n_monitorar
        FROM cig_jogadores cj
        LEFT JOIN lista_preferencial  lp ON lp.cig_jogador_id = cj.id
        LEFT JOIN lista_final          lf ON lf.cig_jogador_id = cj.id
        LEFT JOIN jogadores_destacados jd ON jd.cig_jogador_id = cj.id
        WHERE cj.id = ${id}
      `
      return Response.json({ jogador: row.rows[0] || null })
    }

    if (q && q.length >= 2) {
      const like = `%${normNome(q)}%`
      const rows = await sql`
        SELECT cj.id, cj.nome, cj.clube, cj.posicao,
          CASE WHEN lp.id IS NOT NULL THEN TRUE ELSE FALSE END AS na_watchlist,
          CASE WHEN lf.id IS NOT NULL THEN TRUE ELSE FALSE END AS na_lista_final,
          CASE WHEN jd.id IS NOT NULL THEN TRUE ELSE FALSE END AS foi_observado
        FROM cig_jogadores cj
        LEFT JOIN lista_preferencial  lp ON lp.cig_jogador_id = cj.id
        LEFT JOIN lista_final          lf ON lf.cig_jogador_id = cj.id
        LEFT JOIN jogadores_destacados jd ON jd.cig_jogador_id = cj.id
        WHERE cj.nome_norm LIKE ${like}
        ORDER BY cj.nome LIMIT 30
      `
      return Response.json({ jogadores: rows.rows })
    }

    // Lista completa com estágio no funil
    const rows = await sql`
      SELECT
        cj.id, cj.nome, cj.clube, cj.posicao, cj.updated_at,
        lp.status         AS watchlist_status,
        lp.prioridade     AS watchlist_prioridade,
        lf.recomendacao   AS recomendacao_final,
        lf.irc_final,
        jd.veredito       AS veredito_campo,
        jd.jogos          AS n_observacoes
      FROM cig_jogadores cj
      LEFT JOIN lista_preferencial  lp ON lp.cig_jogador_id = cj.id
      LEFT JOIN lista_final          lf ON lf.cig_jogador_id = cj.id
      LEFT JOIN jogadores_destacados jd ON jd.cig_jogador_id = cj.id
      ORDER BY cj.updated_at DESC
      LIMIT 200
    `
    return Response.json({ jogadores: rows.rows })
  } catch (err) {
    return Response.json({ jogadores: [], error: err.message }, { status: 500 })
  }
}

/* ─── POST /api/cig-jogadores ───────────────────────────────────────
   Cria ou encontra um jogador canônico. Retorna o id.
──────────────────────────────────────────────────────────────────── */
export async function POST(request) {
  try {
    await ensureCigJogadores()
    const { nome, clube, posicao } = await request.json()
    if (!nome) return Response.json({ error: 'nome obrigatório' }, { status: 400 })
    const id = await findOrCreateJogador(nome, clube, posicao)
    return Response.json({ success: true, id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
