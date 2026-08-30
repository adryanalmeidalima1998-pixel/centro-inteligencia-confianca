import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS gps_sessions (
      id           SERIAL PRIMARY KEY,
      titulo       VARCHAR(255),
      data_sessao  DATE,
      tipo_sessao  VARCHAR(50),
      periodo_dia  VARCHAR(20),
      url          TEXT NOT NULL DEFAULT '',
      rows         JSONB,
      criado_em    TIMESTAMP DEFAULT NOW()
    )
  `
  try { await sql`ALTER TABLE gps_sessions ALTER COLUMN url SET DEFAULT ''` } catch (_) {}
  try { await sql`UPDATE gps_sessions SET url = '' WHERE url IS NULL` } catch (_) {}
  try { await sql`ALTER TABLE gps_sessions ADD COLUMN IF NOT EXISTS periodo_dia VARCHAR(20)` } catch (_) {}
}

// Detecta se o CSV é do relatório de goleiros (colunas específicas de GK)
function isGoalkeeperCSV(headers) {
  return headers.includes('Total Dive Count') || headers.includes('Total Dive Load')
}

function parseGpsCSV(csvText) {
  const text = csvText.replace(/^\uFEFF/, '')
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  let sessionDate = null
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    // Formato EN: Date: DD/MM/YYYY | Formato PT: Data,YYYY-MM-DD
    const m = lines[i].match(/Date[:\s,;]+(\d{2}\/\d{2}\/\d{4})/)
    if (m) { sessionDate = m[1]; break }
    const mPt = lines[i].match(/^[^,]*,(\d{4}-\d{2}-\d{2})/)
    if (mPt) { sessionDate = mPt[1]; break }
    if (m) { sessionDate = m[1]; break }
  }
  // PT-BR: se ainda não achou a data, tenta pegar do campo 'Data' nas linhas de dados
  if (!sessionDate) {
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',')
      // Linha de dados PT-BR: Sessão,Data,Tipo,...
      if (parts[1] && parts[1].match(/^\d{4}-\d{2}-\d{2}$/)) {
        sessionDate = parts[1].trim()
        break
      }
    }
  }
  if (!sessionDate) sessionDate = new Date().toISOString().split('T')[0]

  // Detectar formato: EN (Player Name) ou PT-BR (Atleta)
  let headerIdx = -1
  let csvFormat = 'EN' // 'EN' ou 'PT'
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Player Name')) { headerIdx = i; csvFormat = 'EN'; break }
    if (lines[i].includes('Atleta')) { headerIdx = i; csvFormat = 'PT'; break }
  }
  if (headerIdx === -1) return { error: 'Cabeçalho não encontrado (Player Name ou Atleta).' }

  const sep = lines[headerIdx].includes(';') ? ';' : ','
  const headers = lines[headerIdx].split(sep).map(h => h.replace(/"/g, '').trim())

  const isGK = isGoalkeeperCSV(headers)

  const allRows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = line.split(sep).map(v => v.replace(/"/g, '').trim())
    if (values.length < headers.length) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })

    if (isGK) {
      // ── Métricas específicas de goleiros ──────────────────────────────────
      allRows.push({
        playerName:    (row['Player Name'] || '').toUpperCase(),
        positionName:  row['Position Name'] || 'Goleiro',
        periodNumber:  row['Period Number'] || '',
        periodName:    row['Period Name'] || row['Period Number'] || '',
        // distância total (mesma coluna)
        totalDistance: row['Total Distance'] || '0',
        // mergulhos
        totalDiveCount:     row['Total Dive Count'] || '0',
        totalDiveLoad:      row['Total Dive Load'] || '0',
        diveLoadRight:      row['Total Dive Load Right'] || '0',
        diveLoadLeft:       row['Total Dive Load Left'] || '0',
        diveCentreCount:    row['Dive Centre Count'] || '0',
        diveLeftCount:      row['Dive Left Count'] || '0',
        diveRightCount:     row['Dive Right Count'] || '0',
        // saltos
        jumpHigh:      row['IMA Jump Count High Band'] || '0',
        jumpMed:       row['IMA Jump Count Med Band'] || '0',
        jumpLow:       row['IMA Jump Count Low Band'] || '0',
        // acelerações / desacelerações (banda B1-3)
        accel:         row['Acceleration B1-3 Total Efforts (Gen 2)'] || '0',
        decel:         row['Deceleration B1-3 Total Efforts (Gen 2)'] || '0',
        // campos de campo zerados (compatibilidade com front que usa esses campos)
        dist20:  '0',
        dist25:  '0',
        sprints: '0',
        maxVel:  '0',
        // flag para o front saber que é GK
        isGK: true,
      })
    } else {
      // ── Métricas padrão de jogadores de campo ─────────────────────────────
      // PT-BR: Atleta, Posição, Distância Total (m), HSR >20km/h (m), Sprint >25km/h (m), Nº Sprints, Acelerações, Desacelerações, Vel. Máxima (km/h)
      const isPT = csvFormat === 'PT'
      allRows.push({
        playerName:    isPT
          ? (row['Atleta'] || '').toUpperCase()
          : (row['Player Name'] || '').toUpperCase(),
        positionName:  isPT
          ? (row['Posição'] || row['Posicao'] || '')
          : (row['Position Name'] || ''),
        // PT-BR: todas as linhas são o jogo completo, usar '0' como periodNumber
        periodNumber:  isPT ? '0' : (row['Period Number'] || ''),
        periodName:    isPT ? 'Jogo' : (row['Period Name'] || row['Period Number'] || ''),
        totalDistance: isPT
          ? (row['Distância Total (m)'] || row['Distancia Total (m)'] || '0')
          : (row['Total Distance'] || '0'),
        dist20: isPT
          ? (row['HSR >20km/h (m)'] || '0')
          : (row['Distância (> 20 Km/h) (m)'] || row['Distance > 20km/h (m)'] || '0'),
        dist25: isPT
          ? (row['Sprint >25km/h (m)'] || '0')
          : (row['Distância em Sprint (> 25 Km/h) (m)'] || row['Distance Sprint > 25km/h (m)'] || '0'),
        sprints: isPT
          ? (row['Nº Sprints'] || row['No Sprints'] || '0')
          : (row['Nº Esforços (> 25 Km/h)'] || row['Sprints (nº)'] || row['Sprint Count'] || row['Nb Efforts (> 25 Km/h)'] || '0'),
        accel: isPT
          ? (row['Acelerações'] || row['Aceleracoes'] || '0')
          : (row['Acc > 3 m/s² (nº)'] || row['Acceleration Count'] || '0'),
        decel: isPT
          ? (row['Desacelerações'] || row['Desaceleracoes'] || '0')
          : (row['Decel < - 3 m/s² (nº)'] || row['Deceleration Count'] || '0'),
        maxVel: isPT
          ? (row['Vel. Máxima (km/h)'] || row['Vel. Maxima (km/h)'] || '0')
          : (row['Maximum Velocity'] || '0'),
        duration: isPT ? '' : (row['Duration'] || row['Period Duration'] || row['Time (s)'] || ''),
        isGK: isPT ? (row['Posição'] || '').toLowerCase().includes('goal') : false,
      })
    }
  }

  const rows = allRows.filter(r => r.periodNumber === '0')
  const blocos = [...new Set(allRows.filter(r => r.periodNumber !== '0').map(r => r.periodName))].filter(Boolean)
  const rowsByBloco = {}
  blocos.forEach(b => {
    rowsByBloco[b] = allRows.filter(r => r.periodName === b && r.periodNumber !== '0')
  })

  if (rows.length === 0) return { error: 'Nenhum jogador encontrado (Period Number = 0).' }
  return { sessionDate, rows, blocos, rowsByBloco, isGK }
}

export async function GET() {
  try {
    await ensureTable()
    const result = await sql`SELECT id, titulo, data_sessao, tipo_sessao, periodo_dia, rows, criado_em FROM gps_sessions ORDER BY data_sessao DESC`
    // Garante que data_sessao sempre vem como string "YYYY-MM-DD"
    // O @vercel/postgres retorna colunas DATE como objeto Date — isso quebra
    // concatenações como dataSessao + 'T12:00:00' no front-end
    const sessions = result.rows.map(s => {
      // Parse rows JSON if it's a string
      let parsedRows = s.rows
      if (typeof parsedRows === 'string') {
        try {
          parsedRows = JSON.parse(parsedRows)
        } catch(_) {
          parsedRows = {}
        }
      }
      return {
        ...s,
        rows: parsedRows,
        data_sessao: s.data_sessao
          ? (s.data_sessao instanceof Date
              ? s.data_sessao.toISOString().slice(0, 10)
              : String(s.data_sessao).slice(0, 10))
          : null
      }
    })
    return NextResponse.json({ sessions })
  } catch (err) {
    return NextResponse.json({ sessions: [], error: err.message })
  }
}

export async function POST(request) {
  try {
    await ensureTable()
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    const csvText = await file.text()
    const { sessionDate, rows, blocos, rowsByBloco, isGK, error } = parseGpsCSV(csvText)
    if (error) return NextResponse.json({ error }, { status: 400 })
    const [d, m, y] = sessionDate.split('/')
    const dataSessao = `${y}-${m}-${d}`
    const tipo = formData.get('tipo_sessao') || 'Treino'
    const periodo = formData.get('periodo_dia') || 'Manhã'
    const titulo = formData.get('titulo') || `${tipo.toUpperCase()} ${d}/${m}/${y}`
    const payload = { rows, blocos: blocos || [], rowsByBloco: rowsByBloco || {}, isGK: isGK || false }
    await sql`
      INSERT INTO gps_sessions (titulo, data_sessao, tipo_sessao, periodo_dia, url, rows)
      VALUES (${titulo}, ${dataSessao}, ${tipo}, ${periodo}, '', ${JSON.stringify(payload)})
    `
    return NextResponse.json({ ok: true, isGK: isGK || false })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
