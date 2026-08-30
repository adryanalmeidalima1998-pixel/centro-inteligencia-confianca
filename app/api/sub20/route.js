import { NextResponse } from 'next/server'
import { getSub20List, getSub20Player } from '@/data/sub20-ranking'
import { loadSub20Dataset, saveSub20Workbook } from '@/lib/sub20-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const rawDataset = await loadSub20Dataset()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (id) {
      const profile = getSub20Player(rawDataset, id)
      if (!profile) return NextResponse.json({ error: 'Atleta não encontrado.' }, { status: 404 })
      return NextResponse.json(profile, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(getSub20List(rawDataset), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[sub20] erro ao montar ranking', error)
    return NextResponse.json({ error: error?.message || 'Erro ao montar ranking Sub-20.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const result = await saveSub20Workbook(file)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[sub20] erro no upload', error)
    return NextResponse.json({ error: error?.message || 'Não foi possível importar a planilha.' }, { status: 400 })
  }
}
