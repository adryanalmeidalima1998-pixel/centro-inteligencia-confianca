// CAMINHO: app/api/gps/desempenho/route.js
// Parser baseado no formato real do PDF Wyscout (Players in Match Report)
// Cada página = 1 jogador. Nome está na linha ANTES de "Maringá × X Confiança".
// O texto é extraído no browser via pdfjs-dist e enviado página a página.

import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS gps_desempenho (
      id            SERIAL PRIMARY KEY,
      session_id    INTEGER NOT NULL,
      jogador       VARCHAR(120) NOT NULL,
      posicao       VARCHAR(15),
      minutos       INTEGER DEFAULT 90,
      duelos        INTEGER DEFAULT 0,
      duelos_ganhos INTEGER DEFAULT 0,
      intercep      INTEGER DEFAULT 0,
      passes        INTEGER DEFAULT 0,
      passes_certos INTEGER DEFAULT 0,
      acoes         INTEGER DEFAULT 0,
      acoes_sucesso INTEGER DEFAULT 0,
      pass_progr    INTEGER DEFAULT 0,
      criado_em     TIMESTAMP DEFAULT NOW()
    )
  `
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_gps_desempenho_session ON gps_desempenho(session_id)`
  } catch (_) {}
}

// Corrige nomes com espaços quebrados pelo PDF: "A ntônio" → "Antônio"
function fixName(raw) {
  if (!raw) return ''
  raw = raw.replace(/^\d\.ª\s+P\s*A?\s*R?\s*T?\s*E\s+/i, '').trim()
  raw = raw.replace(/\s+\d{1,3}[''′]/g, '').trim()
  raw = raw.replace(/[■⊕∧∨⊙☐◆▪]/g, '').trim()
  // Espaço entre Maiúscula + minúscula = letra partida pelo extrator
  raw = raw.replace(/([A-ZÁÉÍÓÚÂÊÔÃÕÀÜ])\s([a-záéíóúâêôãõàü])/g, '$1$2')
  return raw.replace(/\s{2,}/g, ' ').trim()
}

// Calcula minutos a partir dos tempos presentes na linha do nome
// Ex: "Nathan Melo 40' 83'" → 83 (saiu aos 83)
// Ex: "Yan 12' 57'" → 57 (saiu aos 57, 12' = amarelo)
// Ex: "João Paulo 69' 82'" → 8 (entrou aos 82, 69' = amarelo)
// Heurística: se max > 75 e min < 60 → entrou (90-max); senão usa max
function calcMinutos(nameLine) {
  const times = [...nameLine.matchAll(/(\d{1,3})[''′]/g)].map(m => parseInt(m[1]))
  if (!times.length) return 90
  if (times.length === 1) {
    return times[0] > 45 ? times[0] : 90 - times[0]
  }
  const mx = Math.max(...times), mn = Math.min(...times)
  // Dois tempos: se o maior for a saída → usa o maior
  // Se o menor for amarelo e o maior for entrada → 90 - maior
  if (mx > 75 && mn < 55) return 90 - mx   // entrou tarde (ex: 82')
  return mx                                  // saiu antes (ex: 83', 57')
}

// Parser de uma página (1 jogador)
function parsePage(pageText) {
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean)

  let nome = null
  let minutos = 90

  for (let j = 0; j < lines.length; j++) {
    if (/Maringá|×\s*\d+\s*Confiança/i.test(lines[j]) && j > 0) {
      const nameLine = lines[j - 1]
      nome = fixName(nameLine)
      minutos = calcMinutos(nameLine)
      break
    }
  }

  if (!nome || nome.includes('GUARDA') || nome.includes('PARTE') || nome.length < 2) {
    return null
  }

  function frac(re) {
    const m = pageText.match(re)
    return m ? [parseInt(m[1]), parseInt(m[2])] : [0, 0]
  }
  function num(re) {
    const m = pageText.match(re)
    return m ? parseInt(m[1]) : 0
  }

  const [acoes, acoesS]   = frac(/Ações\s*\/\s*com\s+sucesso\s+(\d+)\/(\d+)/)
  const [passes, passesS] = frac(/Passes\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const [duelos, duelosS] = frac(/Duelos\s*\/\s*ganhos\s+(\d+)\/(\d+)/)
  const [progr]           = frac(/Passes\s+para\s+a\s+frente\s*\/\s*certos\s+(\d+)\/(\d+)/)
  const intercep          = num(/Intercepção\s+(\d+)/)

  if (acoes === 0 && passes === 0 && duelos === 0) return null

  return {
    jogador: nome, posicao: 'VOL', minutos,
    duelos, duelos_ganhos: duelosS, intercep,
    passes, passes_certos: passesS,
    acoes, acoes_sucesso: acoesS,
    pass_progr: progr,
  }
}

async function saveJogadores(sessionId, list) {
  await sql`DELETE FROM gps_desempenho WHERE session_id = ${sessionId}`
  for (const j of list) {
    await sql`
      INSERT INTO gps_desempenho
        (session_id, jogador, posicao, minutos, duelos, duelos_ganhos,
         intercep, passes, passes_certos, acoes, acoes_sucesso, pass_progr)
      VALUES
        (${sessionId}, ${j.jogador}, ${j.posicao || 'VOL'}, ${j.minutos || 90},
         ${j.duelos || 0}, ${j.duelos_ganhos || 0}, ${j.intercep || 0},
         ${j.passes || 0}, ${j.passes_certos || 0},
         ${j.acoes || 0}, ${j.acoes_sucesso || 0}, ${j.pass_progr || 0})
    `
  }
}

export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return NextResponse.json({ error: 'session_id obrigatorio' }, { status: 400 })
    const result = await sql`
      SELECT * FROM gps_desempenho WHERE session_id = ${parseInt(sessionId)} ORDER BY jogador ASC
    `
    return NextResponse.json({ rows: result.rows })
  } catch (err) {
    return NextResponse.json({ rows: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { session_id, pages, pdfText, jogadores } = body

    if (!session_id) return NextResponse.json({ error: 'session_id obrigatorio.' }, { status: 400 })
    const sid = parseInt(session_id)

    // Formato 1: array de páginas (enviado pelo frontend, 1 item por página do PDF)
    if (Array.isArray(pages) && pages.length > 0) {
      const list = pages.map(parsePage).filter(Boolean)
      if (!list.length) return NextResponse.json({
        error: 'Nenhum jogador encontrado. Confirme que é o relatório Players in Match Report do Wyscout.'
      }, { status: 422 })
      await saveJogadores(sid, list)
      return NextResponse.json({ ok: true, salvos: list.length, jogadores: list })
    }

    // Formato 2: texto completo (fallback)
    if (pdfText) {
      // Divide em blocos por jogador: cada bloco termina com "Maringá × N Confiança"
      const blocks = []
      let cur = ''
      for (const line of pdfText.split('\n')) {
        cur += line + '\n'
        if (/Maringá.*×.*Confiança/i.test(line)) {
          blocks.push(cur); cur = ''
        }
      }
      const list = blocks.map(parsePage).filter(Boolean)
      if (!list.length) return NextResponse.json({
        error: 'Nenhum jogador encontrado. Confirme que é o relatório Players in Match Report do Wyscout.'
      }, { status: 422 })
      await saveJogadores(sid, list)
      return NextResponse.json({ ok: true, salvos: list.length, jogadores: list })
    }

    // Formato 3: dados manuais
    if (Array.isArray(jogadores) && jogadores.length) {
      await saveJogadores(sid, jogadores)
      return NextResponse.json({ ok: true, salvos: jogadores.length })
    }

    return NextResponse.json({ error: 'Envie pages[], pdfText ou jogadores[].' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return NextResponse.json({ error: 'session_id obrigatorio' }, { status: 400 })
    await sql`DELETE FROM gps_desempenho WHERE session_id = ${parseInt(sessionId)}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
