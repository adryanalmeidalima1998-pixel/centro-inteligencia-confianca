import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { ensureCorpoCoreSchema } from '@/lib/corpo-core-schema'

export async function GET(request) {
  await ensureCorpoCoreSchema()
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    let result
    if (tipo) {
      result = await sql`
        SELECT * FROM training_pdfs
        WHERE tipo = ${tipo}
        ORDER BY data_treino DESC, criado_em DESC
      `
    } else {
      result = await sql`
        SELECT * FROM training_pdfs
        ORDER BY data_treino DESC, criado_em DESC
      `
    }
    return NextResponse.json({ pdfs: result.rows })
  } catch (err) {
    console.error('[GET /api/pdfs]', err)
    return NextResponse.json({ pdfs: [], error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  await ensureCorpoCoreSchema()
  try {
    const formData = await request.formData()
    const file       = formData.get('file')
    const tipo       = formData.get('tipo')        || 'treino'
    const titulo     = formData.get('titulo')      || null
    const dataTreino = formData.get('data_treino') || null
    const microciclo = formData.get('microciclo')  || null
    const mesociclo  = formData.get('mesociclo')   || null
    const periodo    = formData.get('periodo')     || null
    const volumeRaw  = formData.get('volume')
    const volume     = volumeRaw ? parseInt(volumeRaw) : null

    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

    const blob = await put(
      `confianca/pdfs/${tipo}/${Date.now()}_${file.name}`,
      file,
      { access: 'public' }
    )

    const result = await sql`
      INSERT INTO training_pdfs
        (tipo, titulo, data_treino, microciclo, mesociclo, periodo, volume, url, nome_arquivo)
      VALUES
        (${tipo}, ${titulo}, ${dataTreino}, ${microciclo}, ${mesociclo}, ${periodo}, ${volume}, ${blob.url}, ${file.name})
      RETURNING *
    `

    return NextResponse.json({ pdf: result.rows[0] })
  } catch (err) {
    console.error('[POST /api/pdfs]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
