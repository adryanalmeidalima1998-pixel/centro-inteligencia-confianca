import { sql } from '@vercel/postgres'

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS desempenho_adversarios (
      id               SERIAL PRIMARY KEY,
      nome             TEXT NOT NULL UNIQUE,
      formacao         TEXT DEFAULT '4-3-3',
      escalacao_json   TEXT,
      estudo_gols_json TEXT,
      rodadas_json     TEXT DEFAULT '["Rodada 1","Rodada 2","Rodada 3","Rodada 4"]',
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `
  try { await sql`ALTER TABLE desempenho_adversarios ADD COLUMN IF NOT EXISTS estudo_gols_json TEXT` } catch(_) {}
  try { await sql`ALTER TABLE desempenho_adversarios ADD COLUMN IF NOT EXISTS rodadas_json TEXT DEFAULT '["Rodada 1","Rodada 2","Rodada 3","Rodada 4"]'` } catch(_) {}
  await sql`
    CREATE TABLE IF NOT EXISTS desempenho_imagens (
      id             SERIAL PRIMARY KEY,
      adversario_id  INTEGER REFERENCES desempenho_adversarios(id) ON DELETE CASCADE,
      categoria      TEXT NOT NULL,
      rodada         TEXT,
      imagem_base64  TEXT,
      nome_arquivo   TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS desempenho_jogos (
      id                        SERIAL PRIMARY KEY,
      rodada                    TEXT,
      adversario                TEXT,
      local                     TEXT DEFAULT 'Casa',
      resultado                 TEXT,
      gols_pro                  INTEGER DEFAULT 0,
      gols_contra               INTEGER DEFAULT 0,
      xg                        REAL DEFAULT 0,
      xga                       REAL DEFAULT 0,
      finalizacoes              INTEGER DEFAULT 0,
      finalizacoes_no_alvo      INTEGER DEFAULT 0,
      finalizacoes_sofridas     INTEGER DEFAULT 0,
      passes                    INTEGER DEFAULT 0,
      precisao_passes           REAL DEFAULT 0,
      passes_progressivos       INTEGER DEFAULT 0,
      passes_profundidade       INTEGER DEFAULT 0,
      toques_area               INTEGER DEFAULT 0,
      duelos_ofensivos          INTEGER DEFAULT 0,
      duelos_ofensivos_pct      REAL DEFAULT 0,
      gols_sofridos_xga         REAL DEFAULT 0,
      duelos_defensivos         INTEGER DEFAULT 0,
      duelos_defensivos_pct     REAL DEFAULT 0,
      recuperacoes_posse        INTEGER DEFAULT 0,
      ppda_proprio              REAL DEFAULT 0,
      ppda_adversario           REAL DEFAULT 0,
      toques_area_defensiva     INTEGER DEFAULT 0,
      duelos_total              INTEGER DEFAULT 0,
      duelos_total_pct          REAL DEFAULT 0,
      posse                     REAL DEFAULT 0,
      created_at                TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function GET(request) {
  try {
    await ensureTables()
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'all'
    const adversario_id = searchParams.get('adversario_id')
    if (section === 'adversarios') {
      const r = await sql`SELECT * FROM desempenho_adversarios ORDER BY nome ASC`
      return Response.json({ adversarios: r.rows })
    }
    if (section === 'imagens' && adversario_id) {
      const r = await sql`SELECT * FROM desempenho_imagens WHERE adversario_id=${adversario_id} ORDER BY categoria,rodada`
      return Response.json({ imagens: r.rows })
    }
    if (section === 'jogos') {
      const r = await sql`SELECT * FROM desempenho_jogos ORDER BY id ASC`
      return Response.json({ jogos: r.rows })
    }
    const [adv, jogos] = await Promise.all([
      sql`SELECT * FROM desempenho_adversarios ORDER BY nome ASC`,
      sql`SELECT * FROM desempenho_jogos ORDER BY id ASC`,
    ])
    return Response.json({ adversarios: adv.rows, jogos: jogos.rows })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTables()
    const body = await request.json()
    const { action } = body

    if (action === 'upsert_adversario') {
      const { nome, formacao, escalacao_json } = body
      const ex = await sql`SELECT id FROM desempenho_adversarios WHERE nome=${nome}`
      if (ex.rows.length > 0) {
        await sql`UPDATE desempenho_adversarios SET formacao=${formacao||'4-3-3'}, escalacao_json=${escalacao_json||null}, updated_at=NOW() WHERE nome=${nome}`
        return Response.json({ id: ex.rows[0].id, updated: true })
      }
      const r = await sql`INSERT INTO desempenho_adversarios (nome,formacao,escalacao_json) VALUES (${nome},${formacao||'4-3-3'},${escalacao_json||null}) RETURNING id`
      return Response.json({ id: r.rows[0].id, created: true })
    }

    if (action === 'update_estudo_gols') {
      const { adversario_id, estudo } = body
      await sql`UPDATE desempenho_adversarios SET estudo_gols_json=${JSON.stringify(estudo)}, updated_at=NOW() WHERE id=${adversario_id}`
      return Response.json({ updated: true })
    }

    if (action === 'update_rodadas') {
      const { adversario_id, rodadas } = body
      await sql`UPDATE desempenho_adversarios SET rodadas_json=${JSON.stringify(rodadas)}, updated_at=NOW() WHERE id=${adversario_id}`
      return Response.json({ updated: true })
    }

    if (action === 'upload_imagem') {
      const { adversario_id, categoria, rodada, imagem_base64, nome_arquivo } = body
      const ex = await sql`SELECT id FROM desempenho_imagens WHERE adversario_id=${adversario_id} AND categoria=${categoria} AND (rodada=${rodada} OR (rodada IS NULL AND ${rodada} IS NULL))`
      if (ex.rows.length > 0) {
        await sql`UPDATE desempenho_imagens SET imagem_base64=${imagem_base64}, nome_arquivo=${nome_arquivo||'imagem'}, created_at=NOW() WHERE id=${ex.rows[0].id}`
        return Response.json({ id: ex.rows[0].id, updated: true })
      }
      const r = await sql`INSERT INTO desempenho_imagens (adversario_id,categoria,rodada,imagem_base64,nome_arquivo) VALUES (${adversario_id},${categoria},${rodada||null},${imagem_base64},${nome_arquivo||'imagem'}) RETURNING id`
      return Response.json({ id: r.rows[0].id, created: true })
    }

    if (action === 'create_jogo') {
      const d = body.jogo || {}
      const r = await sql`INSERT INTO desempenho_jogos (rodada,adversario,local,resultado,gols_pro,gols_contra,xg,xga,finalizacoes,finalizacoes_no_alvo,finalizacoes_sofridas,passes,precisao_passes,passes_progressivos,passes_profundidade,toques_area,duelos_ofensivos,duelos_ofensivos_pct,duelos_defensivos,duelos_defensivos_pct,recuperacoes_posse,ppda_proprio,ppda_adversario,toques_area_defensiva,duelos_total,duelos_total_pct,posse) VALUES (${d.rodada||''},${d.adversario||''},${d.local||'Casa'},${d.resultado||''},${d.gols_pro||0},${d.gols_contra||0},${d.xg||0},${d.xga||0},${d.finalizacoes||0},${d.finalizacoes_no_alvo||0},${d.finalizacoes_sofridas||0},${d.passes||0},${d.precisao_passes||0},${d.passes_progressivos||0},${d.passes_profundidade||0},${d.toques_area||0},${d.duelos_ofensivos||0},${d.duelos_ofensivos_pct||0},${d.duelos_defensivos||0},${d.duelos_defensivos_pct||0},${d.recuperacoes_posse||0},${d.ppda_proprio||0},${d.ppda_adversario||0},${d.toques_area_defensiva||0},${d.duelos_total||0},${d.duelos_total_pct||0},${d.posse||0}) RETURNING id`
      return Response.json({ id: r.rows[0].id, created: true })
    }

    if (action === 'update_jogo') {
      const d = body.jogo || {}
      await sql`UPDATE desempenho_jogos SET rodada=${d.rodada||''},adversario=${d.adversario||''},local=${d.local||'Casa'},resultado=${d.resultado||''},gols_pro=${d.gols_pro||0},gols_contra=${d.gols_contra||0},xg=${d.xg||0},xga=${d.xga||0},finalizacoes=${d.finalizacoes||0},finalizacoes_no_alvo=${d.finalizacoes_no_alvo||0},finalizacoes_sofridas=${d.finalizacoes_sofridas||0},passes=${d.passes||0},precisao_passes=${d.precisao_passes||0},passes_progressivos=${d.passes_progressivos||0},passes_profundidade=${d.passes_profundidade||0},toques_area=${d.toques_area||0},duelos_ofensivos=${d.duelos_ofensivos||0},duelos_ofensivos_pct=${d.duelos_ofensivos_pct||0},duelos_defensivos=${d.duelos_defensivos||0},duelos_defensivos_pct=${d.duelos_defensivos_pct||0},recuperacoes_posse=${d.recuperacoes_posse||0},ppda_proprio=${d.ppda_proprio||0},ppda_adversario=${d.ppda_adversario||0},toques_area_defensiva=${d.toques_area_defensiva||0},duelos_total=${d.duelos_total||0},duelos_total_pct=${d.duelos_total_pct||0},posse=${d.posse||0} WHERE id=${d.id}`
      return Response.json({ updated: true })
    }

    return Response.json({ error: 'action inválida' }, { status: 400 })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureTables()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
    if (type === 'adversario') { await sql`DELETE FROM desempenho_adversarios WHERE id=${id}`; return Response.json({ deleted: true }) }
    if (type === 'imagem')     { await sql`DELETE FROM desempenho_imagens WHERE id=${id}`;     return Response.json({ deleted: true }) }
    if (type === 'jogo')       { await sql`DELETE FROM desempenho_jogos WHERE id=${id}`;       return Response.json({ deleted: true }) }
    return Response.json({ error: 'type inválido' }, { status: 400 })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
