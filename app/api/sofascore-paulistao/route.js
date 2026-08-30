export const revalidate = 3600 // revalida a cada 1 hora

const SOFA_URL =
  'https://www.sofascore.com/api/v1/unique-tournament/1234/season/87118/top-players/overall'

export async function GET() {
  try {
    const res = await fetch(SOFA_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        Referer: 'https://www.sofascore.com/',
        Origin: 'https://www.sofascore.com',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return Response.json(
        { error: `SofaScore retornou ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()

    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
      },
    })
  } catch (err) {
    console.error('[sofascore-paulistao]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
