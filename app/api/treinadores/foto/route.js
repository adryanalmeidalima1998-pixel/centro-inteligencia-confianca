import { NextResponse } from 'next/server'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const url = String(searchParams.get('url') || '').trim()
    if (!url) return NextResponse.json({ error: 'URL da foto não informada.' }, { status: 400 })

    let parsed
    try { parsed = new URL(url) } catch {
      return NextResponse.json({ error: 'URL da foto inválida.' }, { status: 400 })
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return NextResponse.json({ error: 'Protocolo de URL não permitido.' }, { status: 400 })
    }

    const res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Falha ao buscar foto (${res.status}).` }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await res.arrayBuffer())
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar foto do treinador.' }, { status: 500 })
  }
}
