import { NextResponse } from 'next/server'

// Os dados de bem-estar precisam ser consultados em tempo quase real.
// Impede que o Route Handler seja pré-renderizado/revalidado por intervalo.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  const configuredSources = {
    pre: { url: process.env.WELLNESS_PRE_SHEET_URL, env: 'WELLNESS_PRE_SHEET_URL' },
    pos: { url: process.env.WELLNESS_POST_SHEET_URL, env: 'WELLNESS_POST_SHEET_URL' },
    observacao: { url: process.env.OBSERVACAO_SHEET_URL, env: 'OBSERVACAO_SHEET_URL' },
  }
  const configuredSource = source ? configuredSources[source] : null
  const rawUrl = configuredSource ? configuredSource.url : searchParams.get('url')

  if (source && !Object.prototype.hasOwnProperty.call(configuredSources, source)) {
    return new NextResponse('Fonte de planilha inválida', { status: 400 })
  }

  if (!rawUrl) {
    return new NextResponse(
      source
        ? `Planilha ${source} não configurada. Defina ${configuredSource?.env || 'a variável correspondente'} no ambiente.`
        : 'URL não fornecida',
      { status: 503 },
    )
  }

  let sheetUrl
  try {
    sheetUrl = new URL(rawUrl)
  } catch {
    return new NextResponse('URL inválida', { status: 400 })
  }

  // Permite somente endpoints públicos de planilhas do Google.
  if (sheetUrl.hostname !== 'docs.google.com' || !sheetUrl.pathname.startsWith('/spreadsheets/')) {
    return new NextResponse('URL não permitida', { status: 403 })
  }

  // Evita reaproveitamento de uma resposta antiga pelo CDN do endpoint publicado.
  sheetUrl.searchParams.set('_ts', Date.now().toString())

  try {
    const res = await fetch(sheetUrl.toString(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const text = await res.text()
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (err) {
    return new NextResponse(`Erro ao buscar planilha: ${err.message}`, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }
}
