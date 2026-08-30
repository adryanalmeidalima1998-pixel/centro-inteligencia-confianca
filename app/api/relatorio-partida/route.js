import { sql } from '@vercel/postgres'
import { ensureCigJogadores, findOrCreateJogador } from '@/app/lib/cigJogadores'

/* ─── TABELAS ──────────────────────────────────────────────────── */
async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS relatorios_partida (
      id           SERIAL PRIMARY KEY,
      match_key    TEXT UNIQUE NOT NULL,
      mandante     TEXT,
      visitante    TEXT,
      competicao   TEXT,
      data_jogo    TEXT,
      relatorio    JSONB NOT NULL DEFAULT '{}',
      status       TEXT  DEFAULT 'Pendente',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS times_db (
      id         SERIAL PRIMARY KEY,
      nome       TEXT NOT NULL UNIQUE,
      ligas      TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS jogadores_banco (
      id          SERIAL PRIMARY KEY,
      nome        TEXT NOT NULL,
      time_id     INTEGER REFERENCES times_db(id),
      posicao     TEXT,
      pe          TEXT,
      altura      TEXT,
      nascimento  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome, time_id)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS jogadores_destacados (
      id            SERIAL PRIMARY KEY,
      nome          TEXT NOT NULL,
      time_nome     TEXT,
      time_id       INTEGER,
      posicao       TEXT,
      pe            TEXT,
      altura        TEXT,
      jogos         INTEGER DEFAULT 0,
      n_arquivar    INTEGER DEFAULT 0,
      n_monitorar   INTEGER DEFAULT 0,
      n_contratar   INTEGER DEFAULT 0,
      veredito      TEXT,
      promovido     BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome, time_nome)
    )
  `
  // Garante coluna cig_jogador_id em jogadores_destacados
  await ensureCigJogadores()
}

/* ─── VEREDITO ──────────────────────────────────────────────────── */
function calcVeredito(n_contratar, n_monitorar, n_arquivar, total) {
  if (n_contratar >= 2)                       return { veredito: 'CONTRATAÇÃO',   promover: true  }
  if (n_monitorar >= 3)                       return { veredito: 'MONITORAR',     promover: true  }
  if (n_monitorar >= 2 && n_contratar >= 1)   return { veredito: 'CONTRATAÇÃO',   promover: true  }
  if (n_arquivar > 0 && n_arquivar === total) return { veredito: 'ARQUIVAR',      promover: false }
  if (n_contratar === 1)                      return { veredito: 'OBSERVAR MAIS', promover: false }
  if (n_monitorar >= 1)                       return { veredito: 'OBSERVAR MAIS', promover: false }
  return                                             { veredito: 'OBSERVAR MAIS', promover: false }
}

/* ─── ATUALIZAR DESTAQUE + vincular cig_jogadores ─────────────────
   IDEMPOTENTE: cada partida só é contada 1x por jogador.
──────────────────────────────────────────────────────────────────── */
async function atualizarDestaque(avaliacoes, mandante, visitante, match_key) {
  try { await sql`ALTER TABLE jogadores_destacados ADD COLUMN IF NOT EXISTS match_keys TEXT[] DEFAULT '{}'` } catch (_) {}

  const sumulas = [
    ...(avaliacoes?.sumula_mandante_avaliados || []).map(a => ({ ...a, time: mandante })),
    ...(avaliacoes?.sumula_visitante_avaliados || []).map(a => ({ ...a, time: visitante })),
  ]

  for (const a of sumulas) {
    const rec = (a.recomendacao || '').toLowerCase()
    const isContratar = rec.includes('contratar')
    const isMonitorar = rec.includes('monitorar')
    const isArquivar  = rec.includes('arquivar')
    if (!isContratar && !isMonitorar && !isArquivar) continue

    const timeNome = a.time_nome || a.time || ''
    const mk = match_key || ''

    await sql`
      INSERT INTO jogadores_destacados
        (nome, time_nome, posicao, pe, altura, competicao, idade, jogos, n_arquivar, n_monitorar, n_contratar, match_keys)
      VALUES (
        ${a.nome}, ${timeNome}, ${a.posicao || ''}, ${a.pe_preferido || ''},
        ${a.altura || ''}, ${competicao || ''}, ${a.idade ? parseInt(a.idade) : null}, 1,
        ${isArquivar  ? 1 : 0},
        ${isMonitorar ? 1 : 0},
        ${isContratar ? 1 : 0},
        CASE WHEN ${mk} <> '' THEN ARRAY[${mk}]::TEXT[] ELSE '{}'::TEXT[] END
      )
      ON CONFLICT (nome, time_nome) DO UPDATE SET
        jogos       = jogadores_destacados.jogos +
                      CASE WHEN ${mk} = '' OR ${mk} = ANY(COALESCE(jogadores_destacados.match_keys,'{}'))
                           THEN 0 ELSE 1 END,
        n_arquivar  = jogadores_destacados.n_arquivar +
                      CASE WHEN ${mk} = '' OR ${mk} = ANY(COALESCE(jogadores_destacados.match_keys,'{}'))
                           THEN 0 ELSE ${isArquivar  ? 1 : 0} END,
        n_monitorar = jogadores_destacados.n_monitorar +
                      CASE WHEN ${mk} = '' OR ${mk} = ANY(COALESCE(jogadores_destacados.match_keys,'{}'))
                           THEN 0 ELSE ${isMonitorar ? 1 : 0} END,
        n_contratar = jogadores_destacados.n_contratar +
                      CASE WHEN ${mk} = '' OR ${mk} = ANY(COALESCE(jogadores_destacados.match_keys,'{}'))
                           THEN 0 ELSE ${isContratar ? 1 : 0} END,
        match_keys  = CASE WHEN ${mk} <> '' AND NOT (${mk} = ANY(COALESCE(jogadores_destacados.match_keys,'{}')))
                           THEN array_append(COALESCE(jogadores_destacados.match_keys,'{}'), ${mk})
                           ELSE jogadores_destacados.match_keys END,
        posicao     = COALESCE(NULLIF(${a.posicao || ''},''), jogadores_destacados.posicao),
        pe          = COALESCE(NULLIF(${a.pe_preferido || ''},''), jogadores_destacados.pe),
        altura      = COALESCE(NULLIF(${a.altura || ''},''), jogadores_destacados.altura),
        competicao  = COALESCE(NULLIF(${competicao || ''},''), jogadores_destacados.competicao),
        updated_at  = NOW()
    `

    // Recalcular veredito
    const row = await sql`
      SELECT id, n_arquivar, n_monitorar, n_contratar, jogos, promovido
      FROM jogadores_destacados WHERE nome = ${a.nome} AND time_nome = ${timeNome}
    `
    if (!row.rows[0]) continue
    const r = row.rows[0]
    const { veredito, promover } = calcVeredito(r.n_contratar, r.n_monitorar, r.n_arquivar, r.jogos)

    await sql`
      UPDATE jogadores_destacados SET veredito = ${veredito}, updated_at = NOW()
      WHERE id = ${r.id}
    `

    // ── NOVO: vincular ao registro canônico cig_jogadores ──
    const cigId = await findOrCreateJogador(a.nome, timeNome, a.posicao || '')
    if (cigId) {
      await sql`
        UPDATE jogadores_destacados SET cig_jogador_id = ${cigId}
        WHERE id = ${r.id} AND cig_jogador_id IS NULL
      `
    }

    // Auto-promoção para monitoramento
    if (promover && !r.promovido) {
      try {
        await sql`
          INSERT INTO atletas_monitoramento (nome, posicao, time_atual, nivel_interesse, observacoes)
          VALUES (${a.nome}, ${a.posicao || ''}, ${timeNome},
                  'Monitorando', ${'Auto-promovido via Observação (' + veredito + '). Veredito: ' + a.recomendacao})
          ON CONFLICT DO NOTHING
        `
        await sql`
          UPDATE jogadores_destacados SET promovido = TRUE, updated_at = NOW()
          WHERE id = ${r.id}
        `
      } catch (_) {}
    }
  }
}

/* ─── GET ───────────────────────────────────────────────────────── */
export async function GET(request) {
  try {
    await ensureTables()
    const { searchParams } = new URL(request.url)
    const mk = searchParams.get('match_key')

    if (mk) {
      const res = await sql`SELECT * FROM relatorios_partida WHERE match_key = ${mk}`
      return Response.json({ relatorio: res.rows[0] || null })
    }

    const res = await sql`
      SELECT id, match_key, mandante, visitante, competicao, data_jogo, status, updated_at,
        (relatorio->>'gols_mandante')  AS gols_mandante,
        (relatorio->>'gols_visitante') AS gols_visitante,
        (
          SELECT jsonb_agg(elem->>'nome')
          FROM jsonb_array_elements(
            COALESCE(relatorio->'sumula_mandante','[]'::jsonb) ||
            COALESCE(relatorio->'reservas_mandante','[]'::jsonb)
          ) elem
          WHERE (elem->>'gols') ~ '^\\d+$' AND (elem->>'gols')::int > 0
        ) AS goleadores_mandante,
        (
          SELECT jsonb_agg(elem->>'nome')
          FROM jsonb_array_elements(
            COALESCE(relatorio->'sumula_visitante','[]'::jsonb) ||
            COALESCE(relatorio->'reservas_visitante','[]'::jsonb)
          ) elem
          WHERE (elem->>'gols') ~ '^\\d+$' AND (elem->>'gols')::int > 0
        ) AS goleadores_visitante,
        (
          SELECT jsonb_agg(jsonb_build_object(
            'nome',         elem->>'nome',
            'time_nome',    elem->>'time_nome',
            'posicao',      elem->>'posicao',
            'nota_jogo',    elem->>'nota_jogo',
            'recomendacao', elem->>'recomendacao',
            'link_lances',  elem->>'link_lances'
          ))
          FROM jsonb_array_elements(
            COALESCE(relatorio->'sumula_mandante_avaliados','[]'::jsonb) ||
            COALESCE(relatorio->'sumula_visitante_avaliados','[]'::jsonb)
          ) elem
          WHERE (elem->>'nome') IS NOT NULL AND (elem->>'nome') != ''
        ) AS avaliacoes_resumo
      FROM relatorios_partida ORDER BY updated_at DESC
    `
    return Response.json({ relatorios: res.rows })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* ─── POST / UPSERT ─────────────────────────────────────────────── */
export async function POST(request) {
  try {
    await ensureTables()
    const body = await request.json()
    const { match_key, mandante, visitante, competicao, data_jogo, relatorio } = body

    const rel = JSON.stringify(relatorio || {})

    await sql`
      INSERT INTO relatorios_partida (match_key, mandante, visitante, competicao, data_jogo, relatorio, status, updated_at)
      VALUES (${match_key}, ${mandante}, ${visitante}, ${competicao}, ${data_jogo}, ${rel}::jsonb, 'Assistido', NOW())
      ON CONFLICT (match_key) DO UPDATE SET
        relatorio  = ${rel}::jsonb,
        mandante   = COALESCE(NULLIF(${mandante},''), relatorios_partida.mandante),
        visitante  = COALESCE(NULLIF(${visitante},''), relatorios_partida.visitante),
        competicao = COALESCE(NULLIF(${competicao},''), relatorios_partida.competicao),
        data_jogo  = COALESCE(NULLIF(${data_jogo},''), relatorios_partida.data_jogo),
        status     = 'Assistido',
        updated_at = NOW()
    `

    await salvarJogadores(relatorio)
    await atualizarDestaque(relatorio, mandante, visitante, match_key)

    try {
      await sql`
        UPDATE observacao_partidas SET status = 'Relatório Enviado', updated_at = NOW()
        WHERE match_key = ${match_key}
      `
    } catch (_) {}

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

/* ─── SALVAR JOGADORES NA BASE ──────────────────────────────────── */
async function salvarJogadores(relatorio) {
  const todos = [
    ...(relatorio?.sumula_mandante  || []),
    ...(relatorio?.sumula_visitante || []),
  ]
  for (const j of todos) {
    if (!j.nome || !j.time_nome) continue
    await sql`INSERT INTO times_db (nome) VALUES (${j.time_nome}) ON CONFLICT (nome) DO NOTHING`
    const timeRow = await sql`SELECT id FROM times_db WHERE nome = ${j.time_nome}`
    const timeId = timeRow.rows[0]?.id
    if (!timeId) continue
    await sql`
      INSERT INTO jogadores_banco (nome, time_id, posicao, pe, altura, nascimento)
      VALUES (${j.nome}, ${timeId}, ${j.posicao || ''}, ${j.pe || ''}, ${j.altura || ''}, ${j.nasc || ''})
      ON CONFLICT (nome, time_id) DO UPDATE SET
        posicao    = COALESCE(NULLIF(${j.posicao || ''},''), jogadores_banco.posicao),
        pe         = COALESCE(NULLIF(${j.pe || ''},''), jogadores_banco.pe),
        altura     = COALESCE(NULLIF(${j.altura || ''},''), jogadores_banco.altura),
        nascimento = COALESCE(NULLIF(${j.nasc || ''},''), jogadores_banco.nascimento)
    `
  }
}
