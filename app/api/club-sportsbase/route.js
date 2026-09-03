import {
  clearClubSportsbase,
  getClubSportsbase,
  parseClubPlayerFile,
  parseClubTeamFile,
  saveClubSportsbase,
} from '@/lib/club-sportsbase-store'
import { recordImportLog, runScoutingAutomation } from '@/lib/scouting-automation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request) {
  try {
    const data = await getClubSportsbase()
    const view = new URL(request.url).searchParams.get('view')

    if (view === 'players') {
      return Response.json({
        jogadores: data.players,
        players: data.players,
        upload_at: data.uploads?.players?.uploadedAt || null,
        filename: data.uploads?.players?.filename || null,
        summary: data.summary,
        fonte: 'sportsbase',
      })
    }

    return Response.json(data)
  } catch (error) {
    return Response.json({ error: error.message, games: [], players: [], summary: null }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const form = await request.formData()
    const teamFile = form.get('teamFile') || form.get('team')
    const playersFile = form.get('playersFile') || form.get('players') || form.get('file')
    if (!teamFile && !playersFile) {
      return Response.json({ error: 'Envie a planilha coletiva e/ou individual do Sportsbase.' }, { status: 400 })
    }

    let games
    let players
    if (teamFile) {
      games = parseClubTeamFile(Buffer.from(await teamFile.arrayBuffer()))
      if (!games.length) return Response.json({ error: 'Nenhuma partida encontrada na planilha coletiva Sportsbase.' }, { status: 400 })
    }
    if (playersFile) {
      players = parseClubPlayerFile(Buffer.from(await playersFile.arrayBuffer()))
      if (!players.length) return Response.json({ error: 'Nenhum atleta encontrado na planilha individual Sportsbase.' }, { status: 400 })
    }

    const data = await saveClubSportsbase({
      games,
      players,
      teamFilename: teamFile?.name,
      playersFilename: playersFile?.name,
      preserve: true,
    })

    if (teamFile) await recordImportLog({
      provider: 'sportsbase', sourceType: 'club-team', filename: teamFile.name,
      sheetName: 'Estatísticas principais', rowsProcessed: games.length,
      rowsEligible: games.length, clubs: 1, recognizedHeaders: Object.keys(games[0] || {}).length,
      validation: { games: games.length, includesTacticalSystem: games.some(game => game.tatica || game.sistema) },
    })
    if (playersFile) await recordImportLog({
      provider: 'sportsbase', sourceType: 'club-players', filename: playersFile.name,
      sheetName: 'Estatísticas principais', rowsProcessed: players.length,
      rowsEligible: players.filter(player => Number(player.minutos || 0) >= 450).length,
      clubs: 1, recognizedHeaders: Object.keys(players[0] || {}).length,
      validation: { players: players.length, positions: new Set(players.map(player => player.posicao).filter(Boolean)).size },
    })

    let automation = null
    let automationWarning = null
    try {
      const result = await runScoutingAutomation({
        trigger: 'upload-club-sportsbase',
        triggerRef: teamFile && playersFile ? 'collective+individual' : teamFile ? 'collective' : 'individual',
      })
      automation = {
        runId: result.run?.id,
        health: result.health?.score,
        needs: result.needs?.length || 0,
        opportunities: result.kpis?.opportunities,
        alerts: result.alerts?.length || 0,
      }
    } catch (automationError) {
      automationWarning = `Upload concluído, mas a automação não foi recalculada: ${automationError.message}`
    }

    return Response.json({ ok: true, ...data, automation, automationWarning })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const part = new URL(request.url).searchParams.get('part') || 'all'
    const data = await clearClubSportsbase(part)
    return Response.json({ ok: true, ...data })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
