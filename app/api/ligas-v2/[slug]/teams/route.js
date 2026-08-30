import { sql } from '@vercel/postgres'
import { aggregateSportsbaseTeams } from '@/data/sportsbase-team-analytics'
import { aggregateWyscoutTeams } from '@/data/wyscout-team-analytics'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'


export async function GET(req, { params }) {
  await ensureLigaJogadoresSchema()
  const { slug } = await params
  try {
    const result = await sql`
      SELECT DISTINCT ON (fonte) data, fonte, upload_at
      FROM liga_jogadores
      WHERE slug = ${slug} AND fonte IN ('sportsbase', 'wyscout')
      ORDER BY fonte, upload_at DESC
    `
    const sportsbase = result.rows.find(row => row.fonte === 'sportsbase')
    const wyscout = result.rows.find(row => row.fonte === 'wyscout')
    const requested = new URL(req.url).searchParams.get('source')
    const source = requested === 'wyscout' && wyscout
      ? 'wyscout'
      : requested === 'sportsbase' && sportsbase
        ? 'sportsbase'
        : sportsbase ? 'sportsbase' : wyscout ? 'wyscout' : null

    if (source === 'sportsbase') {
      const teams = aggregateSportsbaseTeams(sportsbase.data || [])
      return Response.json({
        times: teams,
        upload_at: sportsbase.upload_at,
        source: 'sportsbase',
        limited: false,
        available_sources: { sportsbase:true, wyscout:Boolean(wyscout) },
        methodology: 'Agregação do elenco a partir do mesmo upload de jogadores. Taxas por 90 usam equivalentes de jogo = soma dos jogador-minutos ÷ 900 quando o export não contém goleiros, ou ÷ 990 quando contém; percentuais são ponderados pelas tentativas.',
      })
    }

    if (source === 'wyscout') {
      return Response.json({
        times: aggregateWyscoutTeams(wyscout.data || []),
        upload_at: wyscout.upload_at,
        source: 'wyscout',
        limited: false,
        available_sources: { sportsbase:Boolean(sportsbase), wyscout:true },
        methodology: 'Agregação Wyscout do elenco. Volumes são reconstruídos a partir das taxas por 90 e dos minutos de cada atleta; percentuais são ponderados pelas tentativas. Os indicadores representam o perfil agregado do elenco, não eventos coletivos jogo a jogo.',
      })
    }

    return Response.json({ times:[], upload_at:null, source:null, limited:false, available_sources:{sportsbase:false,wyscout:false} })
  } catch (error) {
    console.error('[league-teams]', error)
    return Response.json({ error:error.message }, { status:500 })
  }
}
