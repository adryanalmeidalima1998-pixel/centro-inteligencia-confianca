import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const runtime  = 'nodejs'
export const maxDuration = 60

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS wyscout_rodada_players (
      id                    SERIAL PRIMARY KEY,
      slug                  TEXT NOT NULL,
      rodada                INTEGER NOT NULL,
      jogador               TEXT NOT NULL,
      clube                 TEXT,
      gols                  NUMERIC DEFAULT 0,
      xg                    NUMERIC DEFAULT 0,
      assistencias          NUMERIC DEFAULT 0,
      xa                    NUMERIC DEFAULT 0,
      contribuicao_ofensiva NUMERIC DEFAULT 0,
      toques_area           NUMERIC DEFAULT 0,
      passes_decisivos      NUMERIC DEFAULT 0,
      remates               NUMERIC DEFAULT 0,
      dribles_total         NUMERIC DEFAULT 0,
      dribles_sucesso       NUMERIC DEFAULT 0,
      corridas_seguidas     NUMERIC DEFAULT 0,
      passes_progressivos   NUMERIC DEFAULT 0,
      passes_tercofinal     NUMERIC DEFAULT 0,
      cruzamentos           NUMERIC DEFAULT 0,
      organizacao           NUMERIC DEFAULT 0,
      duelos_def_total      NUMERIC DEFAULT 0,
      duelos_def_ganhos     NUMERIC DEFAULT 0,
      duelos_aereos_total   NUMERIC DEFAULT 0,
      duelos_aereos_ganhos  NUMERIC DEFAULT 0,
      recuperacoes          NUMERIC DEFAULT 0,
      intercecoes           NUMERIC DEFAULT 0,
      remates_intercetados  NUMERIC DEFAULT 0,
      faltas_cometidas      NUMERIC DEFAULT 0,
      amarelos              NUMERIC DEFAULT 0,
      vermelhos             NUMERIC DEFAULT 0,
      criado_em             TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(slug, rodada, jogador, clube)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_wrp_slug_rodada ON wyscout_rodada_players(slug, rodada)`
}

const EXTRACTION_PROMPT = `Você receberá texto extraído de um "Relatório da Jornada" do Wyscout.
Extraia os dados de TODOS os jogadores nas tabelas individuais (seções JOGADORES).
Retorne SOMENTE JSON válido sem markdown:

{"jogadores":[{"jogador":"Nome","clube":"Clube","gols":0,"xg":0.0,"assistencias":0,"xa":0.0,"contribuicao_ofensiva":0.0,"toques_area":0,"passes_decisivos":0,"remates":0,"dribles_total":0,"dribles_sucesso":0,"corridas_seguidas":0,"passes_progressivos":0,"passes_tercofinal":0,"cruzamentos":0,"organizacao":0.0,"duelos_def_total":0,"duelos_def_ganhos":0,"duelos_aereos_total":0,"duelos_aereos_ganhos":0,"recuperacoes":0,"intercecoes":0,"remates_intercetados":0,"faltas_cometidas":0,"amarelos":0,"vermelhos":0}]}

Regras:
- Consolide o mesmo jogador em uma única entrada (ele aparece em várias tabelas)
- Campos ausentes = 0
- Para duelos "29/22 76%": total=29, ganhos=22
- contribuicao_ofensiva = xGChain; organizacao = xGBuildup
- Inclua TODOS os jogadores de qualquer tabela individual`

export async function POST(req, { params }) {
  const { slug } = await params
  try {
    await ensureTable()
    const formData = await req.formData()
    const file   = formData.get('file')
    const rodada = parseInt(formData.get('rodada') || '0')

    if (!file)                return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (!rodada || rodada < 1) return NextResponse.json({ error: 'Rodada obrigatória' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })

    // 1. Extrai texto do PDF com pdf-parse (local, sem worker, rápido)
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const buffer   = Buffer.from(await file.arrayBuffer())
    let pdfText
    try {
      const data = await pdfParse(buffer)
      pdfText    = data.text
    } catch (e) {
      return NextResponse.json({ error: `Erro ao ler PDF: ${e.message}` }, { status: 500 })
    }

    if (!pdfText || pdfText.trim().length < 200) {
      return NextResponse.json({ error: 'Não foi possível extrair texto. O PDF pode ser escaneado (imagem).' }, { status: 400 })
    }

    // 2. Chat Completions com o texto (sem upload, sem timeout)
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        max_tokens:  8000,
        temperature: 0,
        messages: [
          { role: 'system', content: 'Extrator de dados Wyscout. Retorne SOMENTE JSON válido sem markdown.' },
          { role: 'user',   content: `${EXTRACTION_PROMPT}\n\n--- RELATÓRIO ---\n${pdfText.slice(0, 60000)}` },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      if (res.status === 401) return NextResponse.json({ error: 'OPENAI_API_KEY inválida.' }, { status: 401 })
      if (res.status === 429) return NextResponse.json({ error: 'Limite OpenAI atingido. Tente novamente.' }, { status: 429 })
      return NextResponse.json({ error: `Serviço de processamento ${res.status}: ${err.slice(0,200)}` }, { status: 500 })
    }

    const data    = await res.json()
    const rawText = data.choices?.[0]?.message?.content || ''

    let extracted
    try {
      extracted = JSON.parse(rawText.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim())
    } catch {
      return NextResponse.json({ error: 'Formato inválido na resposta', detail: rawText.slice(0,200) }, { status: 500 })
    }

    const jogadores = extracted?.jogadores || []
    if (!jogadores.length) return NextResponse.json({ error: 'Nenhum jogador extraído.' }, { status: 400 })

    // 3. Upsert no banco
    let salvos = 0
    for (const j of jogadores) {
      const nome = (j.jogador||'').trim()
      if (!nome) continue
      await sql`
        INSERT INTO wyscout_rodada_players (
          slug,rodada,jogador,clube,
          gols,xg,assistencias,xa,contribuicao_ofensiva,toques_area,passes_decisivos,remates,
          dribles_total,dribles_sucesso,corridas_seguidas,passes_progressivos,passes_tercofinal,
          cruzamentos,organizacao,duelos_def_total,duelos_def_ganhos,duelos_aereos_total,
          duelos_aereos_ganhos,recuperacoes,intercecoes,remates_intercetados,
          faltas_cometidas,amarelos,vermelhos
        ) VALUES (
          ${slug},${rodada},${nome},${(j.clube||'').trim()},
          ${+j.gols||0},${+j.xg||0},${+j.assistencias||0},${+j.xa||0},
          ${+j.contribuicao_ofensiva||0},${+j.toques_area||0},${+j.passes_decisivos||0},${+j.remates||0},
          ${+j.dribles_total||0},${+j.dribles_sucesso||0},${+j.corridas_seguidas||0},
          ${+j.passes_progressivos||0},${+j.passes_tercofinal||0},${+j.cruzamentos||0},${+j.organizacao||0},
          ${+j.duelos_def_total||0},${+j.duelos_def_ganhos||0},${+j.duelos_aereos_total||0},
          ${+j.duelos_aereos_ganhos||0},${+j.recuperacoes||0},${+j.intercecoes||0},
          ${+j.remates_intercetados||0},${+j.faltas_cometidas||0},${+j.amarelos||0},${+j.vermelhos||0}
        )
        ON CONFLICT (slug,rodada,jogador,clube) DO UPDATE SET
          gols=EXCLUDED.gols,xg=EXCLUDED.xg,assistencias=EXCLUDED.assistencias,xa=EXCLUDED.xa,
          contribuicao_ofensiva=EXCLUDED.contribuicao_ofensiva,toques_area=EXCLUDED.toques_area,
          passes_decisivos=EXCLUDED.passes_decisivos,remates=EXCLUDED.remates,
          dribles_total=EXCLUDED.dribles_total,dribles_sucesso=EXCLUDED.dribles_sucesso,
          corridas_seguidas=EXCLUDED.corridas_seguidas,passes_progressivos=EXCLUDED.passes_progressivos,
          passes_tercofinal=EXCLUDED.passes_tercofinal,cruzamentos=EXCLUDED.cruzamentos,
          organizacao=EXCLUDED.organizacao,duelos_def_total=EXCLUDED.duelos_def_total,
          duelos_def_ganhos=EXCLUDED.duelos_def_ganhos,duelos_aereos_total=EXCLUDED.duelos_aereos_total,
          duelos_aereos_ganhos=EXCLUDED.duelos_aereos_ganhos,recuperacoes=EXCLUDED.recuperacoes,
          intercecoes=EXCLUDED.intercecoes,remates_intercetados=EXCLUDED.remates_intercetados,
          faltas_cometidas=EXCLUDED.faltas_cometidas,amarelos=EXCLUDED.amarelos,
          vermelhos=EXCLUDED.vermelhos,criado_em=NOW()
      `
      salvos++
    }

    return NextResponse.json({ ok:true, slug, rodada, total:salvos, message:`${salvos} jogadores salvos para a Rodada ${rodada}` })
  } catch (err) {
    console.error('[rodada-pdf]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req, { params }) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const rodada = parseInt(searchParams.get('rodada') || '0')
  try {
    await ensureTable()
    if (!rodada) {
      const { rows } = await sql`
        SELECT rodada, COUNT(*) as total_jogadores, MAX(criado_em) as atualizado_em
        FROM wyscout_rodada_players WHERE slug=${slug}
        GROUP BY rodada ORDER BY rodada DESC`
      return NextResponse.json({ rodadas: rows })
    }
    const { rows } = await sql`
      SELECT *, ROUND((
        gols*3.0+assistencias*2.0+contribuicao_ofensiva*1.5+toques_area*0.8+
        passes_decisivos*0.8+recuperacoes*0.6+duelos_def_ganhos*0.5+
        dribles_sucesso*0.4+passes_progressivos*0.3+intercecoes*0.3
      )::numeric,2) AS score
      FROM wyscout_rodada_players
      WHERE slug=${slug} AND rodada=${rodada}
      ORDER BY score DESC`
    return NextResponse.json({ rodada, slug, total:rows.length, jogadores:rows })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const rodada = parseInt(searchParams.get('rodada') || '0')
  if (!rodada) return NextResponse.json({ error: 'rodada obrigatória' }, { status: 400 })
  try {
    const { rowCount } = await sql`DELETE FROM wyscout_rodada_players WHERE slug=${slug} AND rodada=${rodada}`
    return NextResponse.json({ ok:true, deletados:rowCount })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
