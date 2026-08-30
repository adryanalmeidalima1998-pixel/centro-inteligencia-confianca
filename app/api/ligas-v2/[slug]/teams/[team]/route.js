import { sql } from '@vercel/postgres'
import {
  aggregateSportsbaseTeams,
  getSportsbaseTeamLeaders,
  getSportsbaseTeamPlayers,
} from '@/data/sportsbase-team-analytics'
import {
  aggregateWyscoutTeams,
  getWyscoutTeamPlayers,
} from '@/data/wyscout-team-analytics'
import { attachCanonicalPlayers } from '@/app/lib/playerMaster'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

function latest(rows, source) {
  return rows.find(row => row.fonte === source) || null
}

function wyscoutLeaders(players = []) {
  const definitions = [
    ['gols','Gols',false],['xg','xG',false],['assistencias','Assistências',false],
    ['passes_chave_90','Passes-chave/90',true],['passes_prog_90','Passes progressivos/90',true],
    ['acoes_def_sucesso_90','Ações defensivas/90',true],
  ]
  return definitions.map(([key,label,rate])=>({
    key,label,
    players:[...players]
      .filter(player=>Number.isFinite(Number(player[key])))
      .sort((a,b)=>Number(b[key])-Number(a[key]))
      .slice(0,3)
      .map(player=>({ ...player,value:player[key],_rate:rate })),
  }))
}

export async function GET(req, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug, team } = await params
  const teamName = decodeURIComponent(team)
  try {
    const result = await sql`
      SELECT DISTINCT ON (fonte) data, fonte, upload_at
      FROM liga_jogadores
      WHERE slug = ${slug} AND fonte IN ('sportsbase','wyscout')
      ORDER BY fonte, upload_at DESC
    `
    const sportsbase = latest(result.rows,'sportsbase')
    const wyscout = latest(result.rows,'wyscout')
    const requested = new URL(req.url).searchParams.get('source')
    const source = requested === 'wyscout' && wyscout
      ? 'wyscout'
      : requested === 'sportsbase' && sportsbase
        ? 'sportsbase'
        : sportsbase ? 'sportsbase' : wyscout ? 'wyscout' : null
    if (!source) return Response.json({ error:'Sem dados para esta liga' }, { status:404 })

    if (source === 'sportsbase') {
      const allPlayers = sportsbase.data || []
      const teams = aggregateSportsbaseTeams(allPlayers)
      const teamData = teams.find(item=>item.team_name.toLocaleLowerCase('pt-BR')===teamName.toLocaleLowerCase('pt-BR'))
      if (!teamData) return Response.json({ error:'Time não encontrado no upload atual' }, { status:404 })
      const rawPlayers = getSportsbaseTeamPlayers(allPlayers, teamName).sort((a,b)=>(Number(b.minutos)||0)-(Number(a.minutos)||0))
      const players = await attachCanonicalPlayers(rawPlayers.map(player => ({ ...player, _liga:slug, _fonte:'sportsbase' })))
      return Response.json({
        team:teamData, players, leaders:getSportsbaseTeamLeaders(players), league_teams:teams.length,
        upload_at:sportsbase.upload_at, source:'sportsbase', available_sources:{sportsbase:Boolean(sportsbase),wyscout:Boolean(wyscout)},
        methodology:`Indicadores agregados do elenco, não estatísticas coletivas jogo a jogo. Volume por 90 usa equivalentes de jogo com divisor ${teamData.minute_basis}; eficiências são ponderadas pelas tentativas.`,
      })
    }

    const allPlayers = wyscout.data || []
    const teams = aggregateWyscoutTeams(allPlayers)
    const teamData = teams.find(item=>item.team_name.toLocaleLowerCase('pt-BR')===teamName.toLocaleLowerCase('pt-BR'))
    if (!teamData) return Response.json({ error:'Time não encontrado no upload atual' }, { status:404 })
    const rawPlayers = getWyscoutTeamPlayers(allPlayers,teamName).sort((a,b)=>(Number(b.minutos)||0)-(Number(a.minutos)||0))
    const players = await attachCanonicalPlayers(rawPlayers.map(player=>({ ...player,_liga:slug,_fonte:'wyscout' })))
    return Response.json({
      team:teamData,players,leaders:wyscoutLeaders(players),league_teams:teams.length,
      upload_at:wyscout.upload_at,source:'wyscout',available_sources:{sportsbase:Boolean(sportsbase),wyscout:Boolean(wyscout)},
      methodology:`Indicadores Wyscout agregados do elenco. Volumes por jogo são reconstruídos pelas taxas por 90 e minutos; percentuais são ponderados pelas tentativas. Divisor de equivalência: ${teamData.minute_basis}.`,
    })
  } catch (error) {
    console.error('[league-team-detail]', error)
    return Response.json({ error:error.message }, { status:500 })
  }
}
