/**
 * POST /api/ligas-v2/brasileirao-serie-d/upload
 * Recebe a planilha semanal de rankings da Série D e salva no banco.
 * Substitui os dados anteriores a cada upload.
 */
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const maxDuration = 30

// Mapeamento de abas da planilha → chave interna + colunas esperadas
const SHEET_CONFIG = {
  'Artilheiro':       { key: 'artilheiro',       cols: ['Pos','Jogador','J','G','PEN','AG','MPG','GTIT','GSUP','GPTS','GVIT','GRVV','PGE'] },
  'Média Gols Jogo':  { key: 'media_gols_jogo',  cols: ['Pos','Jogador','J','MG','MPEN','MAG'] },
  'Mais Penaltis':    { key: 'mais_penaltis',     cols: ['Pos','Jogador','J','G','PEN','AG','MPG','GTIT','GSUP','GPTS','GVIT','GRVV','PGE'] },
  'Gols Reserva':     { key: 'gols_reserva',      cols: ['Pos','Jogador','J','G','PEN','AG','MPG','GTIT','GSUP','GPTS','GVIT','GRVV','PGE'] },
  'Gols Vitória':     { key: 'gols_vitoria',      cols: ['Pos','Jogador','J','G','PEN','AG','MPG','GTIT','GSUP','GPTS','GVIT','GRVV','PGE'] },
  'Dois Gols Jogo':   { key: 'dois_gols_jogo',   cols: ['Pos','Jogador','G','BIS','HAT','POK','+4'] },
  'Três Gols Jogo':   { key: 'tres_gols_jogo',   cols: ['Pos','Jogador','G','BIS','HAT','POK','+4'] },
  'Mais Amarelos':    { key: 'mais_amarelos',     cols: ['Pos','Jogador','J','A','2A','VE'] },
  'Segundos Amarelos':{ key: 'segundos_amarelos', cols: ['Pos','Jogador','J','A','2A','VE'] },
  'Mais Vermelhos':   { key: 'mais_vermelhos',    cols: ['Pos','Jogador','J','A','2A','VE'] },
  '12º Jogador':      { key: 'decimo_segundo',    cols: ['Pos','Jogador','J','M','T','U','NU'] },
  'Mais Gols Sofridos':{ key: 'mais_gols_sofridos', cols: ['Pos','Jogador','J','GS'] },
  'Mais Minutos':     { key: 'mais_minutos',      cols: ['Pos','Jogador','J','M','T','U','NU'] },
}

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', raw: false })

    const sheets = {}
    let totalLinhas = 0

    for (const sheetName of wb.SheetNames) {
      const config = SHEET_CONFIG[sheetName]
      if (!config) continue // ignora abas desconhecidas (ex: Resumo)

      const ws = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false })
      sheets[config.key] = rows
      totalLinhas += rows.length
    }

    if (Object.keys(sheets).length === 0) {
      return NextResponse.json({ error: 'Nenhuma aba reconhecida na planilha' }, { status: 400 })
    }

    // Garante que a tabela existe
    await sql`
      CREATE TABLE IF NOT EXISTS serie_d_rankings (
        id          SERIAL PRIMARY KEY,
        slug        TEXT NOT NULL DEFAULT 'brasileirao-serie-d',
        sheet_key   TEXT NOT NULL,
        data        JSONB NOT NULL DEFAULT '[]'::jsonb,
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(slug, sheet_key)
      )
    `

    // Upsert de cada aba
    for (const [key, rows] of Object.entries(sheets)) {
      const dataJson = JSON.stringify(rows)
      await sql`
        INSERT INTO serie_d_rankings (slug, sheet_key, data, uploaded_at)
        VALUES ('brasileirao-serie-d', ${key}, ${dataJson}::jsonb, NOW())
        ON CONFLICT (slug, sheet_key) DO UPDATE
          SET data = EXCLUDED.data, uploaded_at = NOW()
      `
    }

    return NextResponse.json({
      ok: true,
      abas: Object.keys(sheets).length,
      totalLinhas,
      message: `${Object.keys(sheets).length} rankings importados com sucesso (${totalLinhas} linhas)`,
    })

  } catch (err) {
    console.error('[serie-d-upload]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
