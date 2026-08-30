import { sql } from '@vercel/postgres'
import { normNome } from '@/app/lib/cigJogadores'

function groupBy(arr, key) {
  const m = {}
  for (const r of arr) {
    const v = r[key] || 'Outros'
    m[v] = (m[v] || 0) + 1
  }
  return m
}

function normalizePosGrupo(pos) {
  if (!pos) return 'Sem posição'
  const p = pos.split(',')[0].trim().toUpperCase()
  if (['GK'].includes(p)) return 'Goleiro'
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p)) return 'Defensor'
  if (['DMF', 'CMF', 'LCMF', 'RCMF', 'LDMF', 'RDMF', 'AMF', 'LMF', 'RMF', 'RAMF', 'LAMF'].includes(p)) return 'Meia'
  if (['CF', 'SS', 'LWF', 'RWF', 'RW', 'LW'].includes(p)) return 'Atacante'
  // Nomes por extenso (vindos de Observação)
  if (p.includes('GOLEIRO')) return 'Goleiro'
  if (p.includes('ZAGUEIRO') || p.includes('LATERAL')) return 'Defensor'
  if (p.includes('VOLANTE') || p.includes('MEIA')) return 'Meia'
  if (p.includes('ATACANTE') || p.includes('CENTROAVANTE') || p.includes('PONTA')) return 'Atacante'
  return 'Outros'
}

/* ─── GET /api/funil ────────────────────────────────────────────────
   Agrega dados das 3 etapas do funil de scouting:
     1. Observação (jogadores_destacados)
     2. Watchlist  (lista_preferencial)
     3. Lista Final (lista_final)

   Retorna:
     etapas      → contagens e breakdowns por etapa
     conversao   → taxas entre etapas (por cig_jogador_id + nome_norm fallback)
     represados  → atletas na watchlist > 30 dias sem avançar
     pos_grupos  → breakdown por grupo de posição nas 3 etapas
     jogadores   → listas completas para renderização na página
──────────────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const [obsRes, wtchRes, finalRes] = await Promise.all([
      sql`
        SELECT nome, time_nome AS clube, posicao, veredito, jogos,
               n_contratar, n_monitorar, updated_at, cig_jogador_id
        FROM jogadores_destacados
        ORDER BY updated_at DESC
        LIMIT 200
      `,
      sql`
        SELECT id, jogador, clube, posicao, prioridade, status,
               created_at, cig_jogador_id
        FROM lista_preferencial
        WHERE status != 'Descartado'
        ORDER BY
          CASE prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END,
          created_at DESC
      `,
      sql`
        SELECT id, jogador, clube, posicao, recomendacao,
               irc_final, uploaded_at, cig_jogador_id
        FROM lista_final
        ORDER BY
          CASE recomendacao WHEN 'CONTRATAÇÃO' THEN 1 WHEN 'MONITORAR' THEN 2 ELSE 3 END,
          irc_final DESC NULLS LAST
      `,
    ])

    const obs   = obsRes.rows
    const wtch  = wtchRes.rows
    const final = finalRes.rows

    // ── Conjuntos para cross-link (cig_jogador_id preferencial, nome_norm fallback) ──
    const obsCigIds  = new Set(obs.filter(p => p.cig_jogador_id).map(p => p.cig_jogador_id))
    const obsNormas  = new Set(obs.map(p => normNome(p.nome) + '|' + normNome(p.clube || '')))

    const finalCigIds = new Set(final.filter(p => p.cig_jogador_id).map(p => p.cig_jogador_id))
    const finalNormas = new Set(final.map(p => normNome(p.jogador) + '|' + normNome(p.clube || '')))

    // Watchlist que tem origem em Observação
    const wtchComObs = wtch.filter(p =>
      (p.cig_jogador_id && obsCigIds.has(p.cig_jogador_id)) ||
      obsNormas.has(normNome(p.jogador) + '|' + normNome(p.clube || ''))
    )

    // Watchlist que avançou para Lista Final
    const wtchParaFinal = wtch.filter(p =>
      (p.cig_jogador_id && finalCigIds.has(p.cig_jogador_id)) ||
      finalNormas.has(normNome(p.jogador) + '|' + normNome(p.clube || ''))
    )

    // ── Represados: status Monitorando + criados > 30 dias atrás + não na Lista Final ──
    const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const represados = wtch.filter(p =>
      p.status === 'Monitorando' &&
      new Date(p.created_at) < trintaDias &&
      !(p.cig_jogador_id && finalCigIds.has(p.cig_jogador_id)) &&
      !finalNormas.has(normNome(p.jogador) + '|' + normNome(p.clube || ''))
    )

    // ── Breakdown por grupo de posição ──
    const posGrupos = {
      observacao: {},
      watchlist:  {},
      lista_final: {},
    }
    for (const p of obs)   { const g = normalizePosGrupo(p.posicao);   posGrupos.observacao[g]  = (posGrupos.observacao[g]  || 0) + 1 }
    for (const p of wtch)  { const g = normalizePosGrupo(p.posicao);   posGrupos.watchlist[g]   = (posGrupos.watchlist[g]   || 0) + 1 }
    for (const p of final) { const g = normalizePosGrupo(p.posicao);   posGrupos.lista_final[g] = (posGrupos.lista_final[g] || 0) + 1 }

    return Response.json({
      etapas: {
        observacao: {
          total:       obs.length,
          por_veredito: groupBy(obs, 'veredito'),
        },
        watchlist: {
          total:      wtch.length,
          com_origem_obs: wtchComObs.length,
          por_status:    groupBy(wtch, 'status'),
          por_prioridade: groupBy(wtch, 'prioridade'),
        },
        lista_final: {
          total:          final.length,
          vindo_watchlist: wtchParaFinal.length,
          por_recomendacao: groupBy(final, 'recomendacao'),
        },
      },
      conversao: {
        obs_para_watchlist:   obs.length  > 0 ? Math.round(wtchComObs.length    / obs.length  * 100) : 0,
        watchlist_para_final: wtch.length > 0 ? Math.round(wtchParaFinal.length / wtch.length * 100) : 0,
      },
      represados,
      pos_grupos: posGrupos,
      jogadores: {
        observados:  obs.slice(0, 50),
        watchlist:   wtch,
        lista_final: final,
      },
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
