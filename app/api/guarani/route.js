import { NextResponse } from 'next/server'
import { getGuaraniFixtures, getSerieCStandings, getConfiancaTeamId } from '@/lib/sportmonks'


/**
 * Normaliza um fixture da Sportmonks para o formato usado pela página
 */
function normalizeFixture(fixture, teamId) {
  const participants = fixture.participants || []

  // Tenta via meta.location primeiro (jogos passados/ao vivo)
  let home = participants.find(p => p.meta?.location === 'home')
  let away = participants.find(p => p.meta?.location === 'away')

  // Fallback para jogos futuros: Sportmonks nem sempre retorna meta.location
  // Sem ela, identifica o Confiança pelo ID e usa a ordem dos participantes
  // (convenção Sportmonks: índice 0 = mandante, índice 1 = visitante)
  if (!home && !away && participants.length >= 2) {
    const guaraniIdx = participants.findIndex(p => p.id === teamId)
    if (guaraniIdx !== -1) {
      home = participants[0]
      away = participants[1]
    }
  }

  const guaraniIsHome = home?.id === teamId
  const opponent = guaraniIsHome ? away : home
  const mando = guaraniIsHome ? 'H' : 'A'

  // Monta placar de forma segura
  const scores = fixture.scores || []
  let golsG = '', golsAdv = ''
  const scoresByParticipant = {}
  for (const s of scores) {
    if (s.description === 'CURRENT' || s.description === 'FT') {
      if (s.score?.participant === 'home') scoresByParticipant.home = s.score.goals
      if (s.score?.participant === 'away') scoresByParticipant.away = s.score.goals
    }
  }
  if (scoresByParticipant.home != null && scoresByParticipant.away != null) {
    golsG   = String(guaraniIsHome ? scoresByParticipant.home : scoresByParticipant.away)
    golsAdv = String(guaraniIsHome ? scoresByParticipant.away : scoresByParticipant.home)
  }

  // Estado do jogo
  const stateShort = fixture.state?.short_name || ''
  const played = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(stateShort)
  const live   = ['LIVE', 'HT', '1H', '2H', 'ET'].includes(stateShort)

  const result = played && golsG !== '' && golsAdv !== ''
    ? parseInt(golsG) > parseInt(golsAdv) ? 'W'
    : parseInt(golsG) < parseInt(golsAdv) ? 'L' : 'D'
    : null

  // Data
  const rawDate = fixture.starting_at ? new Date(fixture.starting_at) : null
  const dateKey = rawDate ? rawDate.toISOString().slice(0, 10) : null
  const horario = rawDate
    ? rawDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : ''

  return {
    id:         fixture.id,
    date:       rawDate,
    dateKey,
    competicao: fixture.league?.name || 'Brasileirão Série C',
    horario,
    opponent:   opponent?.name || '',
    opponentId: opponent?.id || null,
    mando,
    golsG,
    golsAdv,
    played,
    live,
    result,
    venue:      fixture.venue?.name || null,
  }
}

export async function GET() {
  try {
    const teamId = await getConfiancaTeamId()
    const [fixturesRaw, standings] = await Promise.all([
      getGuaraniFixtures(),
      getSerieCStandings().catch(() => []),
    ])

    const fixtures = (fixturesRaw || [])
      .map(f => normalizeFixture(f, teamId))
      .filter(f => f.dateKey && f.opponent) // filtra fixtures sem adversário identificado
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    return NextResponse.json({
      fixtures,
      standings: standings || [],
      source: 'sportmonks',
    })
  } catch (err) {
    console.error('Erro API Confiança Sportmonks:', err)
    return NextResponse.json({ error: err.message, fixtures: [], standings: [] }, { status: 500 })
  }
}
