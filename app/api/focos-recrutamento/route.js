import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS focos_recrutamento (
      id                      SERIAL PRIMARY KEY,
      nome                    TEXT NOT NULL,
      descricao               TEXT,
      tipo_necessidade        TEXT DEFAULT 'Carência do elenco',
      janela                  TEXT DEFAULT 'Próxima janela',
      prioridade              TEXT DEFAULT 'Média',
      status                  TEXT DEFAULT 'Ativo',
      papel                   TEXT,
      posicao                 TEXT,
      posicao_secundaria      TEXT,
      pos_grupo               TEXT,
      pe                      TEXT DEFAULT '',
      idade_min               INTEGER DEFAULT 15,
      idade_max               INTEGER DEFAULT 32,
      min_minutos             INTEGER DEFAULT 0,
      liga                    TEXT DEFAULT '',
      metricas_pesos          JSONB DEFAULT '[]',
      criterios_obrigatorios  JSONB DEFAULT '[]',
      criterios_desejaveis    JSONB DEFAULT '[]',
      criterios_exclusao      JSONB DEFAULT '[]',
      config_observacao       JSONB DEFAULT '{}',
      criado_por              TEXT DEFAULT 'sistema',
      created_at              TIMESTAMPTZ DEFAULT NOW(),
      updated_at              TIMESTAMPTZ DEFAULT NOW()
    )
  `
  const migs = [
    ['tipo_necessidade',      "TEXT DEFAULT 'Carência do elenco'"],
    ['janela',                "TEXT DEFAULT 'Próxima janela'"],
    ['papel',                 'TEXT'],
    ['posicao_secundaria',    'TEXT'],
    ['metricas_pesos',        "JSONB DEFAULT '[]'"],
    ['criterios_obrigatorios',"JSONB DEFAULT '[]'"],
    ['criterios_desejaveis',  "JSONB DEFAULT '[]'"],
    ['criterios_exclusao',    "JSONB DEFAULT '[]'"],
    ['config_observacao',     "JSONB DEFAULT '{}'"],
  ]
  for (const [col, def] of migs) {
    try { await sql.query(`ALTER TABLE focos_recrutamento ADD COLUMN IF NOT EXISTS ${col} ${def}`) } catch (_) {}
  }
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await sql`
      SELECT * FROM focos_recrutamento
      ORDER BY
        CASE prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END,
        CASE status WHEN 'Ativo' THEN 1 WHEN 'Pausado' THEN 2 ELSE 3 END,
        created_at DESC
    `
    return Response.json({ focos: rows.rows })
  } catch (err) {
    return Response.json({ focos: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const b = await request.json()
    if (!b.nome) return Response.json({ error: 'nome obrigatório' }, { status: 400 })

    const row = await sql`
      INSERT INTO focos_recrutamento (
        nome, descricao, tipo_necessidade, janela, prioridade, status,
        papel, posicao, posicao_secundaria, pos_grupo, pe,
        idade_min, idade_max, min_minutos, liga,
        metricas_pesos, criterios_obrigatorios, criterios_desejaveis,
        criterios_exclusao, config_observacao, criado_por
      ) VALUES (
        ${b.nome}, ${b.descricao || null},
        ${b.tipo_necessidade || 'Carência do elenco'}, ${b.janela || 'Próxima janela'},
        ${b.prioridade || 'Média'}, ${b.status || 'Ativo'},
        ${b.papel || null}, ${b.posicao || null}, ${b.posicao_secundaria || null},
        ${b.pos_grupo || null}, ${b.pe || ''},
        ${b.idade_min ?? 15}, ${b.idade_max ?? 32}, ${b.min_minutos ?? 0}, ${b.liga || ''},
        ${JSON.stringify(b.metricas_pesos || [])}::jsonb,
        ${JSON.stringify(b.criterios_obrigatorios || [])}::jsonb,
        ${JSON.stringify(b.criterios_desejaveis || [])}::jsonb,
        ${JSON.stringify(b.criterios_exclusao || [])}::jsonb,
        ${JSON.stringify(b.config_observacao || {})}::jsonb,
        ${b.criado_por || 'sistema'}
      ) RETURNING id
    `
    return Response.json({ success: true, id: row.rows[0].id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    await ensureTable()
    const { id, ...f } = await request.json()
    if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

    const mp  = f.metricas_pesos        !== undefined
    const co  = f.criterios_obrigatorios !== undefined
    const cd  = f.criterios_desejaveis  !== undefined
    const ce  = f.criterios_exclusao    !== undefined

    await sql`
      UPDATE focos_recrutamento SET
        nome                   = COALESCE(NULLIF(${f.nome || ''}, ''), nome),
        descricao              = COALESCE(${f.descricao ?? null}, descricao),
        tipo_necessidade       = COALESCE(NULLIF(${f.tipo_necessidade || ''}, ''), tipo_necessidade),
        janela                 = COALESCE(NULLIF(${f.janela || ''}, ''), janela),
        prioridade             = COALESCE(NULLIF(${f.prioridade || ''}, ''), prioridade),
        status                 = COALESCE(NULLIF(${f.status || ''}, ''), status),
        papel                  = COALESCE(${f.papel ?? null}, papel),
        posicao                = COALESCE(${f.posicao ?? null}, posicao),
        posicao_secundaria     = COALESCE(${f.posicao_secundaria ?? null}, posicao_secundaria),
        pos_grupo              = COALESCE(${f.pos_grupo ?? null}, pos_grupo),
        pe                     = COALESCE(${f.pe ?? null}, pe),
        idade_min              = COALESCE(${f.idade_min ?? null}, idade_min),
        idade_max              = COALESCE(${f.idade_max ?? null}, idade_max),
        min_minutos            = COALESCE(${f.min_minutos ?? null}, min_minutos),
        liga                   = COALESCE(${f.liga ?? null}, liga),
        metricas_pesos         = CASE WHEN ${mp} THEN ${JSON.stringify(f.metricas_pesos || [])}::jsonb ELSE metricas_pesos END,
        criterios_obrigatorios = CASE WHEN ${co} THEN ${JSON.stringify(f.criterios_obrigatorios || [])}::jsonb ELSE criterios_obrigatorios END,
        criterios_desejaveis   = CASE WHEN ${cd} THEN ${JSON.stringify(f.criterios_desejaveis || [])}::jsonb ELSE criterios_desejaveis END,
        criterios_exclusao     = CASE WHEN ${ce} THEN ${JSON.stringify(f.criterios_exclusao || [])}::jsonb ELSE criterios_exclusao END,
        updated_at             = NOW()
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
    await sql`DELETE FROM focos_recrutamento WHERE id = ${id}`
    try { await sql`DELETE FROM candidatos_pipeline WHERE foco_id = ${id}` } catch (_) {}
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
