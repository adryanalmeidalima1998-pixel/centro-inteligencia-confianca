import { sql } from '@vercel/postgres'

/* ─── Normalização de nome ──────────────────────────────────────────
   Converte "Bruninho", "bruninho", "Brùninho" → "bruninho"
   Usado para match cross-módulo sem depender de ID externo.
──────────────────────────────────────────────────────────────────── */
export function normNome(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/* ─── Garante tabela cig_jogadores + migrações ─────────────────────
   Chamada no início de qualquer route que usa esta lib.
──────────────────────────────────────────────────────────────────── */
export async function ensureCigJogadores() {
  await sql`
    CREATE TABLE IF NOT EXISTS cig_jogadores (
      id         SERIAL PRIMARY KEY,
      nome       TEXT NOT NULL,
      nome_norm  TEXT NOT NULL,
      clube      TEXT NOT NULL DEFAULT '',
      posicao    TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome_norm, clube)
    )
  `

  // As três etapas do funil são criadas aqui também para que a ficha canônica
  // funcione em um banco novo, independentemente da ordem em que as páginas
  // forem abertas pela primeira vez.
  await sql`
    CREATE TABLE IF NOT EXISTS lista_preferencial (
      id                 SERIAL PRIMARY KEY,
      jogador            TEXT NOT NULL,
      nome_completo      TEXT,
      clube              TEXT,
      posicao            TEXT,
      posicao_secundaria TEXT,
      idade              INTEGER,
      data_nascimento    DATE,
      nacionalidade      TEXT,
      altura             TEXT,
      pe_preferido       TEXT,
      valor_mercado      TEXT,
      prioridade         TEXT DEFAULT 'Média',
      status             TEXT DEFAULT 'Pendente',
      origem             TEXT DEFAULT 'Iniciativa CIC',
      solicitante        TEXT,
      observacoes        TEXT,
      descricao          TEXT,
      pontos_fortes      TEXT,
      pontos_melhorar    TEXT,
      link_externo       TEXT,
      link_video         TEXT,
      historico_clubes   JSONB DEFAULT '[]'::jsonb,
      cig_jogador_id     INTEGER,
      foto_base64        TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(jogador)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS lista_final (
      id                SERIAL PRIMARY KEY,
      jogador           TEXT NOT NULL,
      clube             TEXT,
      posicao           TEXT,
      idade             INTEGER,
      altura            TEXT,
      pe_preferido      TEXT,
      jogos             INTEGER,
      minutagem         INTEGER,
      gols              INTEGER,
      assistencias      INTEGER,
      perfil_tags       TEXT[],
      pontos_fisicos    TEXT,
      pontos_tecnicos   TEXT,
      pontos_taticos    TEXT,
      veredicto         TEXT,
      irc_final         NUMERIC(3,1),
      irc_classificacao TEXT,
      historico_score   INTEGER,
      nivel_competicao  INTEGER,
      adequacao_modelo  INTEGER,
      recomendacao      TEXT,
      pdf_base64        TEXT,
      pdf_filename      TEXT,
      foto_base64       TEXT,
      origem            TEXT DEFAULT 'lista_final',
      monitoramento_id  INTEGER,
      cig_jogador_id    INTEGER,
      uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(jogador, clube)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS jogadores_destacados (
      id             SERIAL PRIMARY KEY,
      nome           TEXT NOT NULL,
      time_nome      TEXT,
      time_id        INTEGER,
      posicao        TEXT,
      pe             TEXT,
      altura         TEXT,
      idade          INTEGER,
      competicao     TEXT,
      jogos          INTEGER DEFAULT 0,
      n_arquivar     INTEGER DEFAULT 0,
      n_monitorar    INTEGER DEFAULT 0,
      n_contratar    INTEGER DEFAULT 0,
      veredito       TEXT,
      promovido      BOOLEAN DEFAULT FALSE,
      cig_jogador_id INTEGER,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome, time_nome)
    )
  `

  // Migrações seguras para bancos já existentes.
  await sql`ALTER TABLE lista_preferencial ADD COLUMN IF NOT EXISTS cig_jogador_id INTEGER`
  await sql`ALTER TABLE lista_final ADD COLUMN IF NOT EXISTS cig_jogador_id INTEGER`
  await sql`ALTER TABLE jogadores_destacados ADD COLUMN IF NOT EXISTS cig_jogador_id INTEGER`
}

/* ─── findOrCreateJogador ──────────────────────────────────────────
   Upsert pelo par (nome_norm, clube). Retorna o id do registro.
   Nunca joga exceção — se falhar, retorna null (non-blocking).
──────────────────────────────────────────────────────────────────── */
export async function findOrCreateJogador(nome, clube = '', posicao = '') {
  const nn = normNome(nome)
  const cb = (clube || '').trim()
  if (!nn) return null
  try {
    await ensureCigJogadores()
    const existing = await sql`
      SELECT id FROM cig_jogadores
      WHERE nome_norm = ${nn} AND clube = ${cb}
      ORDER BY updated_at DESC, id ASC
      LIMIT 1
    `
    if (existing.rows[0]?.id) {
      await sql`
        UPDATE cig_jogadores
        SET nome = ${nome.trim()},
            posicao = COALESCE(NULLIF(${posicao || ''}, ''), posicao),
            updated_at = NOW()
        WHERE id = ${existing.rows[0].id}
      `
      return existing.rows[0].id
    }
    const row = await sql`
      INSERT INTO cig_jogadores (nome, nome_norm, clube, posicao)
      VALUES (${nome.trim()}, ${nn}, ${cb}, ${posicao || null})
      RETURNING id
    `
    return row.rows[0]?.id ?? null
  } catch (_) {
    // Em caso de corrida concorrente num banco que ainda mantenha o constraint legado,
    // tenta recuperar o registro criado pela outra requisição.
    try {
      const retry = await sql`
        SELECT id FROM cig_jogadores
        WHERE nome_norm = ${nn} AND clube = ${cb}
        ORDER BY updated_at DESC, id ASC LIMIT 1
      `
      return retry.rows[0]?.id ?? null
    } catch {
      return null
    }
  }
}
