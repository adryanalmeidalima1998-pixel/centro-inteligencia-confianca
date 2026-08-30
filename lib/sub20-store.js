import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'
import { gzipSync, gunzipSync } from 'node:zlib'
import staticDataset from '@/data/sub20-america-sul.json'

let tableReady = null

function ensureTable() {
  if (!tableReady) {
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS sub20_uploads (
        dataset_key  TEXT PRIMARY KEY,
        filename     TEXT NOT NULL,
        dataset_json TEXT NOT NULL,
        row_count    INTEGER NOT NULL,
        league_count INTEGER NOT NULL,
        uploaded_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `.catch(error => {
      tableReady = null
      throw error
    })
  }
  return tableReady
}

function workbookPayload(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheets = workbook.SheetNames.map(name => {
    const worksheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true })
      .map((row, index) => ({ ...row, _sheet: name, _row: index + 2 }))
      .filter(row => String(row.Jogador || '').trim())
    return { name: String(name || '').trim(), rows }
  }).filter(sheet => sheet.name && sheet.rows.length)

  const rowCount = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)
  if (!sheets.length || !rowCount) throw new Error('A planilha não possui abas com atletas válidos.')

  const required = ['Jogador', 'Posição', 'Minutos jogados:']
  for (const sheet of sheets) {
    const headers = new Set(Object.keys(sheet.rows[0] || {}))
    const missing = required.filter(header => !headers.has(header))
    if (missing.length) throw new Error(`A aba ${sheet.name} não possui: ${missing.join(', ')}.`)
    if (!headers.has('Equipa') && !headers.has('Equipe')) throw new Error(`A aba ${sheet.name} não possui a coluna Equipa.`)
  }

  return {
    source: filename,
    generatedAt: new Date().toISOString(),
    sheets,
    rowCount,
    leagueCount: sheets.length,
  }
}

export async function loadSub20Dataset() {
  try {
    await ensureTable()
    const result = await sql`
      SELECT filename, dataset_json, row_count, league_count, uploaded_at
      FROM sub20_uploads
      WHERE dataset_key = 'current'
      LIMIT 1
    `
    const row = result.rows[0]
    if (!row) return { ...staticDataset, storage: 'static', uploadedAt: staticDataset.generatedAt || null }
    return {
      ...JSON.parse(String(row.dataset_json || '').startsWith('gzip:')
        ? gunzipSync(Buffer.from(String(row.dataset_json).slice(5), 'base64')).toString('utf8')
        : row.dataset_json),
      source: row.filename,
      uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : row.uploaded_at,
      storage: 'database',
    }
  } catch (error) {
    console.warn('[sub20] banco indisponível; usando dataset estático', error?.message)
    return {
      ...staticDataset,
      storage: 'static',
      uploadedAt: staticDataset.generatedAt || null,
      warning: 'A base estática foi carregada porque o armazenamento de uploads está indisponível.',
    }
  }
}

export async function saveSub20Workbook(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Selecione um arquivo Excel válido.')
  const filename = String(file.name || 'SUB20 AMÉRICA DO SUL.xlsx')
  if (!/\.xlsx?$/i.test(filename)) throw new Error('Envie um arquivo .xlsx ou .xls.')
  if (Number(file.size) > 15 * 1024 * 1024) throw new Error('O arquivo excede o limite de 15 MB.')

  const buffer = Buffer.from(await file.arrayBuffer())
  const payload = workbookPayload(buffer, filename)
  const datasetJsonRaw = JSON.stringify({
    source: payload.source,
    generatedAt: payload.generatedAt,
    sheets: payload.sheets,
  })
  const datasetJson = `gzip:${gzipSync(datasetJsonRaw).toString('base64')}`

  await ensureTable()
  await sql`
    INSERT INTO sub20_uploads (dataset_key, filename, dataset_json, row_count, league_count, uploaded_at)
    VALUES ('current', ${filename}, ${datasetJson}, ${payload.rowCount}, ${payload.leagueCount}, NOW())
    ON CONFLICT (dataset_key)
    DO UPDATE SET
      filename = EXCLUDED.filename,
      dataset_json = EXCLUDED.dataset_json,
      row_count = EXCLUDED.row_count,
      league_count = EXCLUDED.league_count,
      uploaded_at = NOW()
  `

  return {
    success: true,
    source: filename,
    rowCount: payload.rowCount,
    leagueCount: payload.leagueCount,
    uploadedAt: new Date().toISOString(),
  }
}
