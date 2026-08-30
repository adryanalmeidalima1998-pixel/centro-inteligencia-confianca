import {
  clearGuaraniSportsbase,
  getGuaraniSportsbase,
  parseGuaraniPlayerFile,
  saveGuaraniSportsbase,
} from '@/lib/guarani-sportsbase-store'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function GET() {
  try {
    const data = await getGuaraniSportsbase()
    return Response.json({
      jogadores: data.players,
      upload_at: data.uploads?.players?.uploadedAt || null,
      filename: data.uploads?.players?.filename || null,
      fonte: 'sportsbase',
    })
  } catch (error) {
    return Response.json({ error: error.message, jogadores: [] }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const form = await request.formData()
    const file = form.get('file') || form.get('playersFile')
    if (!file) return Response.json({ error: 'Nenhuma planilha individual enviada.' }, { status: 400 })
    const players = parseGuaraniPlayerFile(Buffer.from(await file.arrayBuffer()))
    if (!players.length) return Response.json({ error: 'Nenhum atleta encontrado no modelo individual Sportsbase.' }, { status: 400 })
    const data = await saveGuaraniSportsbase({ players, playersFilename: file.name })
    return Response.json({ ok: true, total: players.length, jogadores: data.players, summary: data.summary })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await clearGuaraniSportsbase('players')
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
