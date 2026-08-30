import { readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'

const PHOTO_DIR   = join(process.cwd(), 'public', 'photoplayers')
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

function normalizeName(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ')
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS player_photos (
      id             SERIAL PRIMARY KEY,
      canonical_name VARCHAR(255) UNIQUE NOT NULL,
      url            TEXT         NOT NULL,
      filename       VARCHAR(255),
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW()
    )
  `
}

// ─── GET: filesystem (fotos existentes) + postgres (fotos novas) ──────────────
export async function GET() {
  const photos = []
  const seen   = new Set() // evitar duplicatas por canonical_name

  // 1. Fotos do Vercel Blob (salvas via POST)
  try {
    await ensureTable()
    const result = await sql`SELECT * FROM player_photos ORDER BY created_at DESC`
    for (const row of result.rows) {
      const key = normalizeName(row.canonical_name)
      seen.add(key)
      photos.push({
        id:             row.id,
        canonical_name: row.canonical_name,
        filename:       row.filename || '',
        url:            row.url,
        source:         'db',
      })
    }
  } catch (err) {
    console.warn('[API/photos GET] Postgres indisponível:', err.message)
  }

  // 2. Fotos do filesystem public/photoplayers (as 30 originais)
  try {
    const files = readdirSync(PHOTO_DIR)
    for (const filename of files) {
      const ext = extname(filename).toLowerCase()
      if (!ALLOWED_EXTS.includes(ext)) continue
      if (['guarani.png','confianca.png'].includes(filename.toLowerCase())) continue

      let nameWithoutExt = filename.replace(/\.[^.]+$/, '')
      nameWithoutExt = nameWithoutExt.replace(/^(?:GUA|CON|ADC)_/i, '')
      nameWithoutExt = nameWithoutExt.replace(/-removebg-preview$/i, '')
      nameWithoutExt = nameWithoutExt.replace(/_\d+$/, '')
      nameWithoutExt = nameWithoutExt.replace(/[_-]/g, ' ')
      const canonicalName = normalizeName(nameWithoutExt)
      if (!canonicalName) continue

      // Só adiciona se não veio do banco (evita duplicata)
      if (seen.has(canonicalName)) continue
      seen.add(canonicalName)

      photos.push({
        id:             filename, // filename como id para fotos locais
        canonical_name: canonicalName,
        filename:       filename,
        url:            `/photoplayers/${filename}`,
        source:         'local',
      })
    }
  } catch (err) {
    console.warn('[API/photos GET] Erro ao ler filesystem:', err.message)
  }

  return NextResponse.json({ photos })
}

// ─── POST: upload para Vercel Blob + salva no Postgres ────────────────────────
export async function POST(request) {
  try {
    await ensureTable()

    const formData      = await request.formData()
    const file          = formData.get('file')
    const canonicalName = (formData.get('canonical_name') || '').trim()

    if (!file)          return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    if (!canonicalName) return NextResponse.json({ error: 'Nome do atleta é obrigatório.' }, { status: 400 })

    // Upload para Vercel Blob
    const safeName = canonicalName.replace(/\s+/g, '_').toLowerCase()
    const ext      = file.name.split('.').pop().toLowerCase() || 'jpg'
    const blobPath = `confianca/photos/${Date.now()}_${safeName}.${ext}`

    const blob = await put(blobPath, file, { access: 'public' })

    // Upsert no Postgres (atualiza se já existe o mesmo canonical_name)
    const result = await sql`
      INSERT INTO player_photos (canonical_name, url, filename)
      VALUES (${canonicalName}, ${blob.url}, ${file.name})
      ON CONFLICT (canonical_name)
      DO UPDATE SET
        url        = EXCLUDED.url,
        filename   = EXCLUDED.filename,
        updated_at = NOW()
      RETURNING *
    `

    return NextResponse.json({ photo: result.rows[0] })
  } catch (err) {
    console.error('[POST /api/photos]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
