import { sql } from '@vercel/postgres'
import { buildCompetitiveLeagueSelections, buildCompetitiveLeagueSelectionsFromPools } from '@/data/level-selection'
import { buildIntegratedRolePools } from '@/data/unified-selection'
import { enrichPlayersWithFoot } from '@/data/player-foot'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

async function latest(slug, source) {
  const result = await sql`
    SELECT data, upload_at FROM liga_jogadores
    WHERE slug = ${slug} AND fonte = ${source}
    ORDER BY upload_at DESC LIMIT 1
  `
  return result.rows[0] || null
}

export async function GET(req, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    const [sportsbase, wyscout] = await Promise.all([latest(slug, 'sportsbase'), latest(slug, 'wyscout')])
    const requested = new URL(req.url).searchParams.get('source')
    const source = requested === 'wyscout' && wyscout
      ? 'wyscout'
      : requested === 'sportsbase' && sportsbase
        ? 'sportsbase'
        : requested === 'combined' && sportsbase && wyscout
          ? 'combined'
          : sportsbase && wyscout ? 'combined' : sportsbase ? 'sportsbase' : wyscout ? 'wyscout' : null
    if (!source) return Response.json({ selections:{}, teamA:[], teamB:[], teamC:[], total_jogadores:0, thresholds:{}, upload_at:null })

    let selection
    if (source === 'combined') {
      const sportsbasePlayers = enrichPlayersWithFoot(sportsbase.data || [], wyscout?.data || [], 'wyscout').map(player => ({ ...player, _liga:slug, _fonte:'sportsbase', _source_upload_at:sportsbase.upload_at }))
      const wyscoutPlayers = (wyscout.data || []).map(player => ({ ...player, _liga:slug, _fonte:'wyscout', _source_upload_at:wyscout.upload_at }))
      const integrated = buildIntegratedRolePools(sportsbasePlayers, wyscoutPlayers)
      selection = buildCompetitiveLeagueSelectionsFromPools(integrated, slug, 'combined')
    } else {
      const raw = source === 'sportsbase'
        ? enrichPlayersWithFoot(sportsbase.data || [], wyscout?.data || [], 'wyscout')
        : (wyscout.data || [])
      const players = raw.map(player => ({ ...player, _liga:slug, _fonte:source }))
      selection = buildCompetitiveLeagueSelections(players, slug, source)
    }
    const current = selection.selections.current

    return Response.json({
      source,
      available_sources:{ sportsbase:Boolean(sportsbase), wyscout:Boolean(wyscout) },
      selections:selection.selections,
      teamA:current.reference,
      teamB:current.highlight,
      teamC:current.ascent,
      total_jogadores:selection.totalEligible,
      thresholds:selection.thresholds,
      role_thresholds:selection.thresholds,
      upload_at:source === 'combined' ? [sportsbase?.upload_at, wyscout?.upload_at].filter(Boolean).sort().slice(-1)[0] || null : (source === 'sportsbase' ? sportsbase : wyscout).upload_at,
      missing_groups:selection.missingRoles.includes('GK') ? ['GK'] : [],
      missing_roles:selection.missingRoles,
      methodology:selection.methodology,
      formation:'4-3-3 funcional',
      squad_names:{ reference:'XI Referência', highlight:'XI Destaque', ascent:'XI Ascensão' },
    })
  } catch (error) {
    console.error('[competitive-selection]', error)
    return Response.json({ error:error.message }, { status:500 })
  }
}
