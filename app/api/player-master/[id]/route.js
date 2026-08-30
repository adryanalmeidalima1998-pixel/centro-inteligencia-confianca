import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensurePlayerMaster } from '@/app/lib/playerMaster'
import { competitiveLevelLabel, classifyLevelQuadrant, estimateCompetitiveLevels, LEVELING_METHODOLOGY_VERSION, robustnessFromScore } from '@/data/competitive-levels'
import { buildSportsbaseProfilePayload, buildWyscoutProfilePayload } from '@/data/player-profile'
import { getGuaraniSportsbase } from '@/lib/guarani-sportsbase-store'
import { getLeague } from '@/data/leagues'
import { getSportsbaseMetric } from '@/data/sportsbase-map'
import { ensureLigaJogadoresSchema } from '@/lib/league-dataset-schema'

export const runtime = 'nodejs'
export const maxDuration = 45

const num = (value, fallback = 0) => value === null || value === undefined || value === '' ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback

async function latestLeagueDataset(slug, provider) {
  const result = await sql`
    SELECT data, upload_at FROM liga_jogadores
    WHERE slug = ${slug} AND fonte = ${provider}
    ORDER BY upload_at DESC LIMIT 1
  `
  return result.rows[0] || null
}

function buildPizza(analysis) {
  const radar = (analysis?.radar || []).filter(item => item.eligible && Number.isFinite(Number(item.leaguePercentile)))
  return radar.sort((a, b) => Number(b.leaguePercentile) - Number(a.leaguePercentile)).slice(0, 8).map(item => ({
    key:item.key, label:item.label, value:Math.round(item.leaguePercentile), raw:item.value, type:item.type,
  }))
}

function bestScatterPair(analysis) {
  const radar = analysis?.radar || []
  const candidates = radar
    .map(item => ({ ...item, def:getSportsbaseMetric(item.key) }))
    .filter(item => item.eligible && item.def?.pairedMetricKey)
    .sort((a, b) => Number(b.leaguePercentile || 0) - Number(a.leaguePercentile || 0))
  return candidates[0] || null
}

export async function GET(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { id } = await params
  try {
    await ensurePlayerMaster()
    const playerResult = await sql`
      SELECT * FROM cig_jogadores WHERE id = ${Number(id)} LIMIT 1
    `
    const master = playerResult.rows[0]
    if (!master) return NextResponse.json({ error:'Ficha-mãe não encontrada.' }, { status:404 })

    const sourceResult = await sql`
      SELECT * FROM cig_player_sources
      WHERE cig_jogador_id = ${Number(id)}
      ORDER BY upload_at DESC, minutes DESC
    `
    const sources = sourceResult.rows
    const newestSeason = sources.length ? Math.max(...sources.map(source => Number(source.season) || 0)) : 0
    const latest = sources
      .filter(source => Number(source.season) === newestSeason)
      .sort((a, b) => (a.provider === 'sportsbase' ? -1 : 1) - (b.provider === 'sportsbase' ? -1 : 1) || new Date(b.upload_at).getTime() - new Date(a.upload_at).getTime() || Number(b.minutes) - Number(a.minutes))[0] || sources[0] || null
    let analysis = null
    let leaguePlayers = []
    let guarani = { players:[], games:[], model:null }

    if (latest) {
      const dataset = await latestLeagueDataset(latest.league_slug, latest.provider)
      leaguePlayers = Array.isArray(dataset?.data) ? dataset.data : []
      const rawPlayer = latest.raw_data || {}
      guarani = await getGuaraniSportsbase()
      analysis = latest.provider === 'wyscout'
        ? buildWyscoutProfilePayload(rawPlayer, leaguePlayers, guarani.players || [], guarani.model || guarani.summary?.model)
        : buildSportsbaseProfilePayload(rawPlayer, leaguePlayers, guarani.players || [], guarani.model || guarani.summary?.model)
    }

    const instantEstimate = latest
      ? estimateCompetitiveLevels({ ...(latest.raw_data || {}), _liga:latest.league_slug, _fonte:latest.provider }, latest.league_slug, { source:latest.provider })
      : null
    const storedRecommendationCurrent = master.nivel_metodologia === LEVELING_METHODOLOGY_VERSION && num(master.nivel_recomendado_score, null) !== null
    const recommendedScore = storedRecommendationCurrent
      ? num(master.nivel_recomendado_score, instantEstimate?.current.rawScore)
      : num(instantEstimate?.current.rawScore, num(latest?.level_current, 1))
    const realScore = num(master.nivel_real_score, null)
    const currentScore = realScore ?? recommendedScore
    const potentialRecommendedScore = storedRecommendationCurrent
      ? num(master.nivel_potencial_recomendado_score, instantEstimate?.potential.rawScore)
      : num(instantEstimate?.potential.rawScore, recommendedScore)
    const potentialRealScore = num(master.nivel_potencial_real_score, null)
    const potentialScore = potentialRealScore ?? potentialRecommendedScore
    const provenRecommendedScore = storedRecommendationCurrent
      ? num(master.nivel_comprovado_recomendado_score, instantEstimate?.proven.rawScore)
      : num(instantEstimate?.proven.rawScore, null)
    const provenRealScore = num(master.nivel_comprovado_real_score, null)
    const provenScore = provenRealScore ?? provenRecommendedScore
    const confidence = storedRecommendationCurrent ? num(master.nivel_confianca, instantEstimate?.confidence.score || 0) : num(instantEstimate?.confidence.score, num(latest?.level_confidence, 0))
    const levels = {
      recommended:{ score:recommendedScore, label:competitiveLevelLabel(recommendedScore), source:'automático' },
      real:{ score:realScore, label:realScore === null ? 'Não validada' : competitiveLevelLabel(realScore), source:'analista', note:master.nivel_real_nota || '', updatedAt:master.nivel_real_updated_at || null },
      current:{ score:currentScore, label:competitiveLevelLabel(currentScore), source:realScore !== null ? 'analista' : 'automático' },
      potentialRecommended:{ score:potentialRecommendedScore, label:competitiveLevelLabel(potentialRecommendedScore) },
      potentialReal:{ score:potentialRealScore, label:potentialRealScore === null ? 'Não validada' : competitiveLevelLabel(potentialRealScore) },
      potential:{ score:potentialScore, label:competitiveLevelLabel(potentialScore), source:potentialRealScore !== null ? 'analista' : 'automático' },
      provenRecommended:{ score:provenRecommendedScore, label:competitiveLevelLabel(provenRecommendedScore) },
      provenReal:{ score:provenRealScore, label:provenRealScore === null ? 'Não validada' : competitiveLevelLabel(provenRealScore) },
      proven:{ score:provenScore, label:competitiveLevelLabel(provenScore), source:provenRealScore !== null ? 'analista' : 'automático' },
      confidence,
      robustnessLabel:robustnessFromScore(confidence).label,
      modelAvailable:storedRecommendationCurrent ? Boolean(master.nivel_modelo_disponivel) : Boolean(instantEstimate?.modelAvailable),
      recommendationType:instantEstimate?.recommendationType || 'provisório',
      criteria:storedRecommendationCurrent ? (master.nivel_criterios || latest?.level_criteria || {}) : (instantEstimate?.criteria || latest?.level_criteria || {}),
      methodology:storedRecommendationCurrent ? master.nivel_metodologia : (instantEstimate?.methodologyVersion || LEVELING_METHODOLOGY_VERSION),
      quadrant:classifyLevelQuadrant(currentScore, potentialScore, confidence),
    }

    const scatterPair = bestScatterPair(analysis)
    let scatter = null
    if (scatterPair?.def?.pairedMetricKey && latest) {
      const yDef = getSportsbaseMetric(scatterPair.def.pairedMetricKey)
      const sameGroup = leaguePlayers.filter(item => {
        const pos = String(item.posicao || '').split(',')[0]
        const masterPos = String(latest.position || master.posicao || '').split(',')[0]
        return pos === masterPos || (analysis?.group && String(item.grupo_posicional || '').includes(analysis.group))
      })
      scatter = {
        x:{ key:scatterPair.key, label:scatterPair.fullLabel || scatterPair.label },
        y:{ key:yDef?.key, label:yDef?.label || scatterPair.def.pairedMetricKey },
        points:sameGroup.map(item => ({
          nome:item.nome, equipa:item.equipa, x:num(item[scatterPair.key], null), y:num(item[yDef?.key], null), minutos:num(item.minutos), selected:String(item.nome) === String(latest.raw_data?.nome) && String(item.equipa) === String(latest.raw_data?.equipa),
        })).filter(item => item.x !== null && item.y !== null),
      }
    }

    return NextResponse.json({
      player:{
        id:master.id, nome:master.nome, clube:master.clube, posicao:master.posicao,
        idade:master.idade_atual, nacionalidade:master.nacionalidade, pe:master.pe_preferido,
        birthDate:master.birth_date, birthYear:master.birth_year,
      },
      levels,
      sources:sources.map(source => {
        const recalculated = source.level_methodology === LEVELING_METHODOLOGY_VERSION
          ? null
          : estimateCompetitiveLevels({ ...(source.raw_data || {}), _liga:source.league_slug, _fonte:source.provider }, source.league_slug, { source:source.provider })
        return {
          id:source.id, provider:source.provider, leagueSlug:source.league_slug,
          leagueName:getLeague(source.league_slug)?.nome || source.league_slug,
          season:source.season, club:source.club, position:source.position, age:source.age,
          preferredFoot:source.preferred_foot, minutes:num(source.minutes), games:num(source.games),
          uploadedAt:source.upload_at,
          levelCurrent:recalculated?.current.rawScore ?? num(source.level_current, null),
          levelPotential:recalculated?.potential.rawScore ?? num(source.level_potential, null),
          levelProven:recalculated?.proven.rawScore ?? num(source.level_proven, null),
          levelConfidence:recalculated?.confidence.score ?? num(source.level_confidence, 0),
          performanceScore:recalculated?.performanceScore ?? num(source.performance_score, null),
          levelModelAvailable:recalculated?.modelAvailable ?? Boolean(source.level_model_available),
          levelMetricCoverage:recalculated?.confidence.metricCoverage ?? num(source.level_metric_coverage, 0),
          levelCriteria:recalculated?.criteria || source.level_criteria || {},
          levelReason:recalculated?.reason || source.level_reason || null,
        }
      }),
      latest:latest ? { ...latest.raw_data, _liga:latest.league_slug, _fonte:latest.provider } : null,
      league:latest ? (getLeague(latest.league_slug) || { slug:latest.league_slug, nome:latest.league_slug }) : null,
      analysis,
      pizza:buildPizza(analysis),
      scatter,
      guarani:{ players:(guarani.players || []).length, games:(guarani.games || []).length },
    })
  } catch (error) {
    console.error('[player-master-detail]', error)
    return NextResponse.json({ error:error.message }, { status:500 })
  }
}

export async function PATCH(request, { params }) {
  await ensureLigaJogadoresSchema()
  const { id } = await params
  try {
    await ensurePlayerMaster()
    const body = await request.json()
    const currentResult = await sql`
      SELECT nivel_real_score, nivel_potencial_real_score, nivel_comprovado_real_score,
        nivel_recomendado_score, nivel_potencial_recomendado_score, nivel_comprovado_recomendado_score,
        nivel_real_nota
      FROM cig_jogadores WHERE id = ${Number(id)} LIMIT 1
    `
    const current = currentResult.rows[0]
    if (!current) return NextResponse.json({ error:'Ficha não encontrada.' }, { status:404 })

    const parseLevel = (primaryKey, legacyKey, previous) => {
      const hasPrimary = Object.prototype.hasOwnProperty.call(body, primaryKey)
      const hasLegacy = legacyKey && Object.prototype.hasOwnProperty.call(body, legacyKey)
      if (!hasPrimary && !hasLegacy) return num(previous, null)
      const raw = hasPrimary ? body[primaryKey] : body[legacyKey]
      if (raw === null || raw === undefined || raw === '') return null
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 1 || value > 9) throw new Error(`Nível inválido em ${primaryKey}.`)
      return value
    }

    const real = parseLevel('real', 'current', current.nivel_real_score)
    const automatic = Number.isFinite(Number(body.recommended)) ? Math.max(1, Math.min(9, Number(body.recommended))) : num(current.nivel_recomendado_score, null)
    const potentialReal = parseLevel('potentialReal', 'potential', current.nivel_potencial_real_score)
    const provenReal = parseLevel('provenReal', 'proven', current.nivel_comprovado_real_score)
    const note = Object.prototype.hasOwnProperty.call(body, 'note') ? String(body.note || '').trim().slice(0, 1000) : String(current.nivel_real_nota || '')
    const changedByScout = real !== num(current.nivel_real_score, null) || potentialReal !== num(current.nivel_potencial_real_score, null) || provenReal !== num(current.nivel_comprovado_real_score, null)
    if (changedByScout && (real !== null || potentialReal !== null || provenReal !== null) && !note) throw new Error('Informe a justificativa da validação da faixa.')
    const override = {
      ...(real !== null ? { current:real } : {}),
      ...(potentialReal !== null ? { potential:potentialReal } : {}),
      ...(provenReal !== null ? { proven:provenReal } : {}),
    }

    await sql`
      UPDATE cig_jogadores SET
        nivel_real_score = ${real},
        nivel_potencial_real_score = ${potentialReal},
        nivel_comprovado_real_score = ${provenReal},
        nivel_real_nota = ${note},
        nivel_real_updated_at = CASE WHEN ${real}::numeric IS DISTINCT FROM nivel_real_score OR ${note}::text IS DISTINCT FROM nivel_real_nota THEN NOW() ELSE nivel_real_updated_at END,
        nivel_override = ${JSON.stringify(override)}::jsonb,
        nivel_recomendado_score = COALESCE(nivel_recomendado_score, ${automatic}),
        nivel_atual_score = COALESCE(${real}, ${automatic}, nivel_recomendado_score),
        nivel_potencial_score = COALESCE(${potentialReal}, nivel_potencial_recomendado_score),
        nivel_comprovado_score = COALESCE(${provenReal}, nivel_comprovado_recomendado_score),
        updated_at = NOW()
      WHERE id = ${Number(id)}
    `
    return NextResponse.json({
      ok:true,
      real:{ score:real, label:real === null ? 'Não validada' : competitiveLevelLabel(real) },
      effective:{ score:real ?? automatic, label:competitiveLevelLabel(real ?? automatic) },
    })
  } catch (error) {
    return NextResponse.json({ error:error.message }, { status:500 })
  }
}
