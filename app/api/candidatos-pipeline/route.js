import { sql } from '@vercel/postgres'

const ETAPAS = ['Identificados', 'Análise em vídeo', 'Observação ao vivo', 'Pré-lista', 'Alvo prioritário', 'Acompanhamento']

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS candidatos_pipeline (
      id             SERIAL PRIMARY KEY,
      foco_id        INTEGER NOT NULL,
      jogador        TEXT NOT NULL,
      clube          TEXT,
      posicao        TEXT,
      liga           TEXT,
      pe             TEXT,
      idade          INTEGER,
      minutos        INTEGER,
      fit_score      INTEGER,
      fit_posicional INTEGER,
      fit_funcional  INTEGER,
      fit_contexto   INTEGER,
      risco_nivel    TEXT DEFAULT 'Médio',
      risco_desconto INTEGER DEFAULT 0,
      etapa          TEXT DEFAULT 'Identificados',
      responsavel    TEXT,
      notas          TEXT,
      oportunidades  TEXT[],
      altura         TEXT,
      nacionalidade  TEXT,
      data_fim_contrato TEXT,
      observacoes    TEXT,
      pontos_fortes  TEXT,
      pontos_melhorar TEXT,
      link_externo   TEXT,
      link_video     TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(foco_id, jogador, clube)
    )
  `
  const newCols = [
    ['oportunidades',     'TEXT[]'],
    ['altura',            'TEXT'],
    ['nacionalidade',     'TEXT'],
    ['data_fim_contrato', 'TEXT'],
    ['observacoes',       'TEXT'],
    ['pontos_fortes',     'TEXT'],
    ['pontos_melhorar',   'TEXT'],
    ['link_externo',      'TEXT'],
    ['link_video',        'TEXT'],
    ['fonte',             "TEXT DEFAULT 'interno'"],
  ]
  for (const [col, type] of newCols) {
    try { await sql.query(`ALTER TABLE candidatos_pipeline ADD COLUMN IF NOT EXISTS ${col} ${type}`) } catch (_) {}
  }
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const focoId = searchParams.get('foco_id')
    const id     = searchParams.get('id')

    if (id) {
      const rows = await sql`SELECT * FROM candidatos_pipeline WHERE id = ${id}`
      return Response.json({ candidato: rows.rows[0] || null })
    }

    if (!focoId) return Response.json({ error: 'foco_id obrigatório' }, { status: 400 })

    const rows = await sql`
      SELECT * FROM candidatos_pipeline
      WHERE foco_id = ${focoId}
      ORDER BY
        CASE etapa
          WHEN 'Identificados'      THEN 1
          WHEN 'Análise em vídeo'   THEN 2
          WHEN 'Observação ao vivo' THEN 3
          WHEN 'Pré-lista'          THEN 4
          WHEN 'Alvo prioritário'   THEN 5
          WHEN 'Acompanhamento'     THEN 6
        END,
        fit_score DESC NULLS LAST
    `
    const kanban = {}
    for (const e of ETAPAS) kanban[e] = []
    for (const r of rows.rows) {
      if (kanban[r.etapa]) kanban[r.etapa].push(r)
    }
    return Response.json({ candidatos: rows.rows, kanban, etapas: ETAPAS })
  } catch (err) {
    return Response.json({ candidatos: [], kanban: {}, error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const b = await request.json()
    const {
      foco_id, jogador, clube, posicao, liga, pe, idade, minutos,
      fit_score, fit_posicional, fit_funcional, fit_contexto,
      risco_nivel, risco_desconto, etapa, responsavel, oportunidades,
      altura, nacionalidade, data_fim_contrato, fonte, link_externo,
    } = b
    if (!foco_id || !jogador) return Response.json({ error: 'foco_id e jogador obrigatórios' }, { status: 400 })

    await sql`
      INSERT INTO candidatos_pipeline
        (foco_id, jogador, clube, posicao, liga, pe, idade, minutos,
         fit_score, fit_posicional, fit_funcional, fit_contexto,
         risco_nivel, risco_desconto, etapa, responsavel, oportunidades,
         altura, nacionalidade, data_fim_contrato, fonte, link_externo)
      VALUES
        (${foco_id}, ${jogador}, ${clube||null}, ${posicao||null}, ${liga||null},
         ${pe||null}, ${idade||null}, ${minutos||null},
         ${fit_score||null}, ${fit_posicional||null}, ${fit_funcional||null}, ${fit_contexto||null},
         ${risco_nivel||'Médio'}, ${risco_desconto||0},
         ${etapa||'Identificados'}, ${responsavel||null}, ${oportunidades||null},
         ${altura||null}, ${nacionalidade||null}, ${data_fim_contrato||null},
         ${fonte||'interno'}, ${link_externo||null})
      ON CONFLICT (foco_id, jogador, clube) DO UPDATE SET
        etapa             = COALESCE(NULLIF(${etapa||''}, ''), candidatos_pipeline.etapa),
        fit_score         = COALESCE(${fit_score||null}, candidatos_pipeline.fit_score),
        risco_nivel       = COALESCE(NULLIF(${risco_nivel||''}, ''), candidatos_pipeline.risco_nivel),
        altura            = COALESCE(${altura||null}, candidatos_pipeline.altura),
        nacionalidade     = COALESCE(${nacionalidade||null}, candidatos_pipeline.nacionalidade),
        data_fim_contrato = COALESCE(${data_fim_contrato||null}, candidatos_pipeline.data_fim_contrato),
        fonte             = COALESCE(${fonte||null}, candidatos_pipeline.fonte),
        link_externo      = COALESCE(${link_externo||null}, candidatos_pipeline.link_externo),
        updated_at        = NOW()
    `
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    await ensureTable()
    const b = await request.json()
    const {
      id, etapa, responsavel, notas,
      jogador, clube, posicao, pe, idade, altura, nacionalidade, data_fim_contrato,
      observacoes, pontos_fortes, pontos_melhorar, link_externo, link_video,
    } = b
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

    await sql`
      UPDATE candidatos_pipeline SET
        etapa             = COALESCE(NULLIF(${etapa||''}, ''),         etapa),
        responsavel       = COALESCE(${responsavel??null},             responsavel),
        notas             = COALESCE(${notas??null},                   notas),
        jogador           = COALESCE(${jogador||null},                 jogador),
        clube             = COALESCE(${clube||null},                   clube),
        posicao           = COALESCE(${posicao||null},                 posicao),
        pe                = COALESCE(${pe||null},                      pe),
        idade             = COALESCE(${idade||null},                   idade),
        altura            = COALESCE(${altura||null},                  altura),
        nacionalidade     = COALESCE(${nacionalidade||null},           nacionalidade),
        data_fim_contrato = COALESCE(${data_fim_contrato||null},       data_fim_contrato),
        observacoes       = COALESCE(${observacoes??null},             observacoes),
        pontos_fortes     = COALESCE(${pontos_fortes??null},           pontos_fortes),
        pontos_melhorar   = COALESCE(${pontos_melhorar??null},         pontos_melhorar),
        link_externo      = COALESCE(${link_externo??null},            link_externo),
        link_video        = COALESCE(${link_video??null},              link_video),
        updated_at        = NOW()
      WHERE id = ${id}
    `
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    await sql`DELETE FROM candidatos_pipeline WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
