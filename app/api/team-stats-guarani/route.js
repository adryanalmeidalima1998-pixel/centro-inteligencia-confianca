import {
  clearGuaraniSportsbase,
  getGuaraniSportsbase,
  parseGuaraniTeamFile,
  saveGuaraniSportsbase,
} from '@/lib/guarani-sportsbase-store'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function GET() {
  try {
    const data = await getGuaraniSportsbase()
    return Response.json({
      stats: data.summary?.averages || null,
      summary: data.summary,
      model: data.summary?.model || null,
      games: data.games,
      upload_at: data.uploads?.team?.uploadedAt || null,
      filename: data.uploads?.team?.filename || null,
      fonte: 'sportsbase',
    })
  } catch (error) {
    return Response.json({ error: error.message, stats: null, games: [] }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const form = await request.formData()
    const file = form.get('file') || form.get('teamFile')
    if (!file) return Response.json({ error: 'Nenhuma planilha coletiva enviada.' }, { status: 400 })
    const games = parseGuaraniTeamFile(Buffer.from(await file.arrayBuffer()))
    if (!games.length) return Response.json({ error: 'Nenhuma partida encontrada no modelo coletivo Sportsbase.' }, { status: 400 })
    const data = await saveGuaraniSportsbase({ games, teamFilename: file.name })
    return Response.json({ ok: true, games: data.games, stats: data.summary?.averages, summary: data.summary, model: data.summary?.model })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await clearGuaraniSportsbase('team')
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
