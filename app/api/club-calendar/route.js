import { NextResponse } from 'next/server'
import { fetchSerieCSeasonEvents, teamsMatch } from '@/lib/providers/espn-serie-c'

/**
 * Calendário do Confiança na Série C.
 *
 * Fonte pública da ESPN, normalizada para o calendário do clube.
 */
export async function GET() {
  try {
    const events = await fetchSerieCSeasonEvents()
    const fixtures = events
      .filter(event => teamsMatch(event.homeName, 'Confiança') || teamsMatch(event.awayName, 'Confiança'))
      .map(event => {
        const isHome = teamsMatch(event.homeName, 'Confiança')
        const opponent = isHome ? event.awayName : event.homeName
        const goalsConfianca = isHome ? event.homeScore : event.awayScore
        const goalsOpponent = isHome ? event.awayScore : event.homeScore
        const played = event.status === 'final'
        const result = played && Number.isFinite(goalsConfianca) && Number.isFinite(goalsOpponent)
          ? goalsConfianca > goalsOpponent ? 'W' : goalsConfianca < goalsOpponent ? 'L' : 'D'
          : null
        const rawDate = new Date(event.date)

        return {
          id: event.espnId,
          date: event.date,
          dateKey: event.dateKey,
          competicao: event.competition || 'Brasileirão Série C',
          horario: rawDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          }),
          opponent,
          opponentId: isHome ? event.awayId : event.homeId,
          mando: isHome ? 'H' : 'A',
          golsG: Number.isFinite(goalsConfianca) ? String(goalsConfianca) : '',
          golsAdv: Number.isFinite(goalsOpponent) ? String(goalsOpponent) : '',
          played,
          live: event.status === 'live',
          result,
          venue: event.venue,
        }
      })

    return NextResponse.json({ fixtures, source: 'espn-public' })
  } catch (error) {
    console.error('[GET /api/club-calendar]', error)
    return NextResponse.json({ error: error.message, fixtures: [] }, { status: 500 })
  }
}
