import { sql } from '@vercel/postgres'
import { ensureCigJogadores, findOrCreateJogador } from '@/app/lib/cigJogadores'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS lista_preferencial (
      id               SERIAL PRIMARY KEY,
      jogador          TEXT NOT NULL,
      nome_completo    TEXT,
      clube            TEXT,
      posicao          TEXT,
      posicao_secundaria TEXT,
      idade            INTEGER,
      data_nascimento  DATE,
      nacionalidade    TEXT,
      altura           TEXT,
      pe_preferido     TEXT,
      valor_mercado    TEXT,
      prioridade       TEXT DEFAULT 'Média',
      status           TEXT DEFAULT 'Pendente',
      origem           TEXT DEFAULT 'Iniciativa CIC',
      solicitante      TEXT,
      observacoes      TEXT,
      descricao        TEXT,
      pontos_fortes    TEXT,
      pontos_melhorar  TEXT,
      link_externo     TEXT,
      link_video       TEXT,
      historico_clubes JSONB DEFAULT '[]'::jsonb,
      cig_jogador_id   INTEGER,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(jogador)
    )
  `
  // Migrations para tabelas existentes
  const cols = [
    ['nome_completo',     'TEXT'],
    ['posicao_secundaria','TEXT'],
    ['data_nascimento',   'DATE'],
    ['nacionalidade',     'TEXT'],
    ['altura',            'TEXT'],
    ['pe_preferido',      'TEXT'],
    ['valor_mercado',     'TEXT'],
    ['origem',            "TEXT DEFAULT 'Iniciativa CIC'"],
    ['solicitante',       'TEXT'],
    ['descricao',         'TEXT'],
    ['pontos_fortes',     'TEXT'],
    ['pontos_melhorar',   'TEXT'],
    ['link_externo',      'TEXT'],
    ['link_video',        'TEXT'],
    ['historico_clubes',  "JSONB DEFAULT '[]'::jsonb"],
    ['cig_jogador_id',    'INTEGER'],
    ['idade',             'INTEGER'],
    ['foto_base64',       'TEXT'],
  ]
  for (const [col, type] of cols) {
    try { await sql.query(`ALTER TABLE lista_preferencial ADD COLUMN IF NOT EXISTS ${col} ${type}`) } catch (_) {}
  }

  // Migra status legados
  try {
    await sql`UPDATE lista_preferencial SET status = 'Pendente'   WHERE status = 'Monitorando'`
    await sql`UPDATE lista_preferencial SET status = 'Em Análise' WHERE status = 'Em Negociação'`
  } catch (_) {}

  await sql`
    CREATE TABLE IF NOT EXISTS lista_preferencial_historico (
      id           SERIAL PRIMARY KEY,
      jogador_id   INTEGER NOT NULL,
      jogador      TEXT NOT NULL,
      campo        TEXT NOT NULL,
      valor_antes  TEXT,
      valor_depois TEXT,
      usuario      TEXT DEFAULT 'sistema',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await ensureCigJogadores()
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const historicoId = searchParams.get('historico')
    const id          = searchParams.get('id')
    const fotoId      = searchParams.get('foto')

    // Serve foto diretamente como imagem
    if (fotoId) {
      const rows = await sql`SELECT foto_base64 FROM lista_preferencial WHERE id = ${fotoId}`
      if (!rows.rows[0]?.foto_base64) return new Response('Not found', { status: 404 })
      const buf = Buffer.from(rows.rows[0].foto_base64, 'base64')
      return new Response(buf, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000' } })
    }

    if (historicoId) {
      const rows = await sql`
        SELECT * FROM lista_preferencial_historico
        WHERE jogador_id = ${historicoId}
        ORDER BY created_at DESC LIMIT 50
      `
      return Response.json({ historico: rows.rows })
    }

    if (id) {
      const rows = await sql`
        SELECT id, jogador, nome_completo, clube, posicao, posicao_secundaria, idade,
               data_nascimento, nacionalidade, altura, pe_preferido, valor_mercado,
               prioridade, status, origem, solicitante, observacoes,
               descricao, pontos_fortes, pontos_melhorar,
               link_externo, link_video, historico_clubes, cig_jogador_id, created_at,
               CASE WHEN foto_base64 IS NOT NULL THEN TRUE ELSE FALSE END AS tem_foto
        FROM lista_preferencial WHERE id = ${id}
      `
      return Response.json({ player: rows.rows[0] || null })
    }

    // Lista geral — exclui foto_base64 (pesada) e expõe só tem_foto
    const rows = await sql`
      SELECT id, jogador, nome_completo, clube, posicao, posicao_secundaria, idade,
             data_nascimento, nacionalidade, altura, pe_preferido, valor_mercado,
             prioridade, status, origem, solicitante, observacoes,
             descricao, pontos_fortes, pontos_melhorar,
             link_externo, link_video, historico_clubes, cig_jogador_id, created_at,
             CASE WHEN foto_base64 IS NOT NULL THEN TRUE ELSE FALSE END AS tem_foto
      FROM lista_preferencial
      ORDER BY
        CASE status
          WHEN 'Pendente'   THEN 1
          WHEN 'Em Análise' THEN 2
          WHEN 'Aprovado'   THEN 3
          WHEN 'Descartado' THEN 4
          WHEN 'Arquivado'  THEN 5
          ELSE 6
        END,
        CASE prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END,
        created_at DESC
    `
    return Response.json({ players: rows.rows })
  } catch (err) {
    return Response.json({ players: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const {
      jogador, nome_completo, clube, posicao, posicao_secundaria, idade,
      data_nascimento, nacionalidade, altura, pe_preferido, valor_mercado,
      prioridade = 'Média',
      origem = 'Iniciativa CIC',
      solicitante, observacoes,
      link_externo, link_video,
      historico_clubes,
    } = body
    if (!jogador) return Response.json({ error: 'jogador obrigatório' }, { status: 400 })

    const cigId = await findOrCreateJogador(jogador, clube, posicao)
    const hist  = historico_clubes ? JSON.stringify(historico_clubes) : '[]'

    await sql`
      INSERT INTO lista_preferencial
        (jogador, nome_completo, clube, posicao, posicao_secundaria, idade, data_nascimento,
         nacionalidade, altura, pe_preferido, valor_mercado, prioridade, status,
         origem, solicitante, observacoes, link_externo, link_video, historico_clubes, cig_jogador_id)
      VALUES
        (${jogador}, ${nome_completo||null}, ${clube||null}, ${posicao||null}, ${posicao_secundaria||null},
         ${idade||null}, ${data_nascimento||null}, ${nacionalidade||null}, ${altura||null},
         ${pe_preferido||null}, ${valor_mercado||null}, ${prioridade}, 'Pendente',
         ${origem}, ${solicitante||null}, ${observacoes||null},
         ${link_externo||null}, ${link_video||null}, ${hist}::jsonb, ${cigId})
      ON CONFLICT (jogador) DO UPDATE SET
        nome_completo      = COALESCE(${nome_completo||null},     lista_preferencial.nome_completo),
        prioridade         = ${prioridade},
        clube              = COALESCE(${clube||null},             lista_preferencial.clube),
        posicao            = COALESCE(${posicao||null},          lista_preferencial.posicao),
        posicao_secundaria = COALESCE(${posicao_secundaria||null},lista_preferencial.posicao_secundaria),
        idade              = COALESCE(${idade||null},             lista_preferencial.idade),
        data_nascimento    = COALESCE(${data_nascimento||null},   lista_preferencial.data_nascimento),
        nacionalidade      = COALESCE(${nacionalidade||null},     lista_preferencial.nacionalidade),
        altura             = COALESCE(${altura||null},            lista_preferencial.altura),
        pe_preferido       = COALESCE(${pe_preferido||null},      lista_preferencial.pe_preferido),
        valor_mercado      = COALESCE(${valor_mercado||null},     lista_preferencial.valor_mercado),
        origem             = ${origem},
        solicitante        = COALESCE(${solicitante||null},       lista_preferencial.solicitante),
        link_externo       = COALESCE(${link_externo||null},      lista_preferencial.link_externo),
        link_video         = COALESCE(${link_video||null},        lista_preferencial.link_video),
        historico_clubes   = CASE WHEN ${hist}::jsonb != '[]'::jsonb
                               THEN ${hist}::jsonb
                               ELSE lista_preferencial.historico_clubes END,
        cig_jogador_id     = COALESCE(${cigId},                   lista_preferencial.cig_jogador_id)
    `
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    await ensureTable()

    // Upload de foto via FormData
    const ct = request.headers.get('content-type') || ''
    if (ct.includes('multipart/form-data')) {
      const fd      = await request.formData()
      const id      = fd.get('id')
      const foto    = fd.get('foto')
      if (!foto || !id) return Response.json({ error: 'id e foto obrigatórios' }, { status: 400 })
      const buf     = Buffer.from(await foto.arrayBuffer())
      const base64  = buf.toString('base64')
      await sql`UPDATE lista_preferencial SET foto_base64 = ${base64} WHERE id = ${id}`
      return Response.json({ success: true, foto_url: `/api/lista-preferencial?foto=${id}` })
    }

    const body = await request.json()
    const {
      id, prioridade, status, observacoes, solicitante, origem,
      descricao, pontos_fortes, pontos_melhorar,
      link_externo, link_video,
      // campos de dados do atleta
      jogador, nome_completo, clube, posicao, posicao_secundaria,
      data_nascimento, nacionalidade, altura, pe_preferido, valor_mercado,
      usuario = 'sistema',
    } = body

    const cur  = await sql`SELECT * FROM lista_preferencial WHERE id = ${id}`
    const prev = cur.rows[0]
    if (!prev) return Response.json({ error: 'registro não encontrado' }, { status: 404 })

    const auditFields = { prioridade, status, observacoes, solicitante, origem }
    for (const [campo, novo] of Object.entries(auditFields)) {
      if (novo !== undefined && novo !== null && novo !== prev[campo]) {
        await sql`
          INSERT INTO lista_preferencial_historico
            (jogador_id, jogador, campo, valor_antes, valor_depois, usuario)
          VALUES (${id}, ${prev.jogador}, ${campo}, ${prev[campo]||null}, ${novo}, ${usuario})
        `
      }
    }

    await sql`
      UPDATE lista_preferencial SET
        prioridade         = COALESCE(${prioridade         ||null}, prioridade),
        status             = COALESCE(${status             ||null}, status),
        observacoes        = COALESCE(${observacoes        ||null}, observacoes),
        solicitante        = COALESCE(${solicitante        ||null}, solicitante),
        origem             = COALESCE(${origem             ||null}, origem),
        descricao          = COALESCE(${descricao          ||null}, descricao),
        pontos_fortes      = COALESCE(${pontos_fortes      ||null}, pontos_fortes),
        pontos_melhorar    = COALESCE(${pontos_melhorar    ||null}, pontos_melhorar),
        link_externo       = COALESCE(${link_externo       ||null}, link_externo),
        link_video         = COALESCE(${link_video         ||null}, link_video),
        jogador            = COALESCE(${jogador            ||null}, jogador),
        nome_completo      = COALESCE(${nome_completo      ||null}, nome_completo),
        clube              = COALESCE(${clube              ||null}, clube),
        posicao            = COALESCE(${posicao            ||null}, posicao),
        posicao_secundaria = COALESCE(${posicao_secundaria ||null}, posicao_secundaria),
        data_nascimento    = COALESCE(${data_nascimento    ||null}, data_nascimento),
        nacionalidade      = COALESCE(${nacionalidade      ||null}, nacionalidade),
        altura             = COALESCE(${altura             ||null}, altura),
        pe_preferido       = COALESCE(${pe_preferido       ||null}, pe_preferido),
        valor_mercado      = COALESCE(${valor_mercado      ||null}, valor_mercado)
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
    await sql`DELETE FROM lista_preferencial WHERE id = ${id}`
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
