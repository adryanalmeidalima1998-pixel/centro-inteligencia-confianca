// app/api/serie-c/data/route.js
// Devolve o snapshot de uma rodada (times, jogadores, goleiros), a rodada
// anterior (para calcular variação) e a linha do tempo completa do Confiança.
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'
import { normTeamName, valueFromMetricAny } from '../../../../lib/serieC'

const XG_ALIASES = ['Golos esperados', 'Gols esperados', 'xG', 'Expected goals']

const MATCH_ALIASES = {
  possession: ['Posse, %', 'Posse de bola, %', 'Posse'],
  ppda: ['PPDA'],
  shots: ['Remates / à baliza', 'Remates', 'Chutes'],
  shotsOnTarget: ['Remates à baliza', 'Remates no alvo', 'Chutes no alvo'],
  shotsAgainst: ['Remates contra / no alvo', 'Remates contra', 'Chutes contra'],
  shotsAgainstOnTarget: ['Remates contra no alvo', 'Remates contra / no alvo'],
  xg: XG_ALIASES,
  boxEntries: ['Entradas na grande área', 'Entradas na área', 'Entradas na grande área (corridas/cruzamentos)'],
  progressivePasses: ['Passes progressivos / precisos', 'Passes progressivos'],
  finalThirdPasses: ['Passes para terço final / certos', 'Passes para terço final', 'Passes para o terço final'],
  recoveries: ['Recuperações', 'Recuperacoes'],
  intensity: ['Intensidade de jogo'],
}
function avgNumbers(values) {
  const valid = values.filter(v => Number.isFinite(Number(v))).map(Number)
  return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null
}
function aggregateConfiancaMatchStats(rows) {
  const games=[]
  for (const row of rows || []) {
    const home=isGuaraniSide(row.home_team,row.home_code)
    const away=isGuaraniSide(row.away_team,row.away_code)
    if(!home && !away) continue
    const own=home ? (row.home_metrics||{}) : (row.away_metrics||{})
    const opp=home ? (row.away_metrics||{}) : (row.home_metrics||{})
    const metric=(aliases,obj=own)=>valueFromMetricAny(obj,aliases)
    games.push({
      round:Number(row.round)||null,
      date:row.match_date,
      opponent:home?row.away_team:row.home_team,
      goalsFor:Number(home?row.home_score:row.away_score)||0,
      goalsAgainst:Number(home?row.away_score:row.home_score)||0,
      possession:metric(MATCH_ALIASES.possession),
      ppda:metric(MATCH_ALIASES.ppda),
      shots:metric(MATCH_ALIASES.shots),
      shotsOnTarget:metric(MATCH_ALIASES.shotsOnTarget),
      shotsAgainst:metric(MATCH_ALIASES.shotsAgainst) ?? metric(MATCH_ALIASES.shots,opp),
      shotsAgainstOnTarget:metric(MATCH_ALIASES.shotsAgainstOnTarget) ?? metric(MATCH_ALIASES.shotsOnTarget,opp),
      xg:metric(MATCH_ALIASES.xg),
      xga:metric(MATCH_ALIASES.xg,opp),
      boxEntries:metric(MATCH_ALIASES.boxEntries),
      progressivePasses:metric(MATCH_ALIASES.progressivePasses),
      finalThirdPasses:metric(MATCH_ALIASES.finalThirdPasses),
      recoveries:metric(MATCH_ALIASES.recoveries),
      intensity:metric(MATCH_ALIASES.intensity),
    })
  }
  if(!games.length) return null
  return {
    source:'partidas-wyscout', matches:games.length,
    goalsFor:games.reduce((a,g)=>a+g.goalsFor,0), goalsAgainst:games.reduce((a,g)=>a+g.goalsAgainst,0),
    possession:avgNumbers(games.map(g=>g.possession)), ppda:avgNumbers(games.map(g=>g.ppda)),
    shots:avgNumbers(games.map(g=>g.shots)), shotsOnTarget:avgNumbers(games.map(g=>g.shotsOnTarget)),
    shotsAgainst:avgNumbers(games.map(g=>g.shotsAgainst)), shotsAgainstOnTarget:avgNumbers(games.map(g=>g.shotsAgainstOnTarget)),
    xg:avgNumbers(games.map(g=>g.xg)), xga:avgNumbers(games.map(g=>g.xga)),
    boxEntries:avgNumbers(games.map(g=>g.boxEntries)), progressivePasses:avgNumbers(games.map(g=>g.progressivePasses)),
    finalThirdPasses:avgNumbers(games.map(g=>g.finalThirdPasses)), recoveries:avgNumbers(games.map(g=>g.recoveries)),
    intensity:avgNumbers(games.map(g=>g.intensity)), games,
  }
}

function isGuaraniSide(team, code) {
  return normTeamName(team).includes('CONFIANCA') || normTeamName(code) === 'CON'
}

function expectedPerformanceFromMatches(rows, standingsGuarani) {
  const timeline = []
  let xg = 0, xga = 0, goals = 0, goalsAgainst = 0
  for (const row of rows || []) {
    const guaraniHome = isGuaraniSide(row.home_team, row.home_code)
    const guaraniAway = isGuaraniSide(row.away_team, row.away_code)
    if (!guaraniHome && !guaraniAway) continue
    const ownMetrics = guaraniHome ? row.home_metrics : row.away_metrics
    const oppMetrics = guaraniHome ? row.away_metrics : row.home_metrics
    const matchXg = valueFromMetricAny(ownMetrics, XG_ALIASES)
    const matchXga = valueFromMetricAny(oppMetrics, XG_ALIASES)
    if (matchXg === null || matchXga === null) continue
    const gf = Number(guaraniHome ? row.home_score : row.away_score) || 0
    const ga = Number(guaraniHome ? row.away_score : row.home_score) || 0
    xg += matchXg
    xga += matchXga
    goals += gf
    goalsAgainst += ga
    timeline.push({
      round: Number(row.round),
      matchDate: row.match_date,
      opponent: guaraniHome ? row.away_team : row.home_team,
      xg: matchXg,
      xga: matchXga,
      xgDiff: matchXg - matchXga,
      goals: gf,
      goalsAgainst: ga,
    })
  }
  timeline.sort((a, b) => a.round - b.round)
  if (timeline.length) {
    return {
      source: 'partidas',
      matches: timeline.length,
      xg, xga, xgDiff: xg - xga,
      xgPerMatch: xg / timeline.length,
      xgaPerMatch: xga / timeline.length,
      goals,
      goalsAgainst,
      goalsMinusXg: goals - xg,
      goalsAgainstMinusXga: goalsAgainst - xga,
      xPoints: Number.isFinite(Number(standingsGuarani?.xPoints)) ? Number(standingsGuarani.xPoints) : null,
      timeline,
    }
  }
  if (standingsGuarani && Number.isFinite(Number(standingsGuarani.xg)) && Number.isFinite(Number(standingsGuarani.xga))) {
    const sxg = Number(standingsGuarani.xg)
    const sxga = Number(standingsGuarani.xga)
    return {
      source: 'pdf', matches: Number(standingsGuarani.played) || null,
      xg: sxg, xga: sxga, xgDiff: sxg - sxga,
      xgPerMatch: standingsGuarani.played ? sxg / Number(standingsGuarani.played) : null,
      xgaPerMatch: standingsGuarani.played ? sxga / Number(standingsGuarani.played) : null,
      goals: Number(standingsGuarani.goalsFor) || 0,
      goalsAgainst: Number(standingsGuarani.goalsAgainst) || 0,
      goalsMinusXg: (Number(standingsGuarani.goalsFor) || 0) - sxg,
      goalsAgainstMinusXga: (Number(standingsGuarani.goalsAgainst) || 0) - sxga,
      xPoints: Number.isFinite(Number(standingsGuarani.xPoints)) ? Number(standingsGuarani.xPoints) : null,
      timeline: [],
    }
  }
  return null
}

export async function GET(request) {
  try {
    await ensureSerieCTables()
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season')
    const competition = searchParams.get('competition') || 'Brasileiro Série C'
    const roundParam = searchParams.get('round')

    const uploadsRes = season
      ? await sql`
          SELECT id, season, competition, round, guarani_position, upload_date, uploaded_at
          FROM serie_c_uploads
          WHERE competition = ${competition} AND season = ${season}
          ORDER BY season DESC, round DESC
        `
      : await sql`
          SELECT id, season, competition, round, guarani_position, upload_date, uploaded_at
          FROM serie_c_uploads
          WHERE competition = ${competition}
          ORDER BY season DESC, round DESC
        `
    const uploads = uploadsRes.rows

    if (uploads.length === 0) {
      return NextResponse.json({
        uploads: [], upload: null, previousUpload: null,
        teams: [], players: [], goalkeepers: [], reportExcludedPlayers: [], timeline: [],
      })
    }

    const currentUpload = roundParam
      ? uploads.find(u => String(u.round) === String(roundParam)) || uploads[0]
      : uploads[0]

    const sameSeasonUploads = uploads
      .filter(u => u.season === currentUpload.season && u.competition === currentUpload.competition)
      .sort((a, b) => a.round - b.round)

    const idx = sameSeasonUploads.findIndex(u => u.id === currentUpload.id)
    const previousUpload = idx > 0 ? sameSeasonUploads[idx - 1] : null

    const [teamsRes, playersRes, gkRes, exclusionsRes] = await Promise.all([
      sql`SELECT team, is_guarani, metrics FROM serie_c_team_stats WHERE upload_id = ${currentUpload.id}`,
      sql`SELECT player, team, is_guarani, position, age, minutes, metrics FROM serie_c_player_stats WHERE upload_id = ${currentUpload.id}`,
      sql`SELECT player, team, is_guarani, age, minutes, metrics FROM serie_c_goalkeeper_stats WHERE upload_id = ${currentUpload.id}`,
      sql`
        SELECT player
        FROM serie_c_report_exclusions
        WHERE season = ${currentUpload.season} AND competition = ${currentUpload.competition}
        ORDER BY player ASC
      `,
    ])

    let previousTeams = []
    if (previousUpload) {
      const prevRes = await sql`SELECT team, is_guarani, metrics FROM serie_c_team_stats WHERE upload_id = ${previousUpload.id}`
      previousTeams = prevRes.rows
    }

    const [matchXgRes, standingsRes] = await Promise.all([
      sql`
        SELECT round, match_date, home_team, away_team, home_code, away_code,
               home_score, away_score, home_metrics, away_metrics
        FROM serie_c_competition_matches
        WHERE season = ${currentUpload.season} AND competition = ${currentUpload.competition}
          AND round IS NOT NULL AND round <= ${currentUpload.round}
          AND (home_team ILIKE '%Confiança%' OR away_team ILIKE '%Confiança%' OR home_team ILIKE '%Confianca%' OR away_team ILIKE '%Confianca%' OR home_code = 'CON' OR away_code = 'CON')
        ORDER BY round ASC, match_date ASC
      `,
      sql`
        SELECT round, rows, report_data, reference_date
        FROM serie_c_standings_snapshots
        WHERE season = ${currentUpload.season} AND competition = ${currentUpload.competition}
          AND round <= ${currentUpload.round}
        ORDER BY round DESC, uploaded_at DESC
        LIMIT 1
      `,
    ])
    const standingsRows = Array.isArray(standingsRes.rows[0]?.rows) ? standingsRes.rows[0].rows : []
    const standingsGuarani = standingsRows.find(row => normTeamName(row?.team).includes('CONFIANCA')) || null
    const seasonReport = standingsRes.rows[0]?.report_data && typeof standingsRes.rows[0].report_data === 'object'
      ? standingsRes.rows[0].report_data
      : {}
    const expectedPerformance = expectedPerformanceFromMatches(matchXgRes.rows, standingsGuarani)
    const teamMatchStats = aggregateConfiancaMatchStats(matchXgRes.rows)

    const reportHistoryRes = await sql`
      SELECT round, rows, report_data, reference_date
      FROM serie_c_standings_snapshots
      WHERE season = ${currentUpload.season} AND competition = ${currentUpload.competition}
        AND round <= ${currentUpload.round}
      ORDER BY round ASC, uploaded_at ASC
    `
    const seasonReportTimeline = reportHistoryRes.rows.map(snapshot => {
      const rows = Array.isArray(snapshot.rows) ? snapshot.rows : []
      const guarani = rows.find(row => normTeamName(row?.team).includes('CONFIANCA')) || null
      return {
        round: Number(snapshot.round),
        referenceDate: snapshot.reference_date,
        position: guarani?.position ?? null,
        points: guarani?.points ?? null,
        xg: guarani?.xg ?? null,
        xga: guarani?.xga ?? null,
        xgDiff: guarani && Number.isFinite(Number(guarani.xg)) && Number.isFinite(Number(guarani.xga)) ? Number(guarani.xg) - Number(guarani.xga) : null,
        xPoints: guarani?.xPoints ?? null,
        reportData: snapshot.report_data && typeof snapshot.report_data === 'object' ? snapshot.report_data : {},
      }
    })

    // Linha do tempo: uma entrada por rodada da temporada/competição, com a
    // posição informada no upload e as métricas do Confiança naquela rodada.
    const timeline = []
    for (const u of sameSeasonUploads) {
      const teamRow = u.id === currentUpload.id
        ? teamsRes.rows.find(t => t.is_guarani)
        : (await sql`SELECT metrics FROM serie_c_team_stats WHERE upload_id = ${u.id} AND is_guarani = TRUE LIMIT 1`).rows[0]
      timeline.push({
        round: u.round,
        uploadDate: u.upload_date,
        guaraniPosition: u.guarani_position,
        metrics: teamRow?.metrics || null,
      })
    }

    return NextResponse.json({
      uploads,
      upload: currentUpload,
      previousUpload,
      teams: teamsRes.rows,
      previousTeams,
      players: playersRes.rows,
      goalkeepers: gkRes.rows,
      reportExcludedPlayers: exclusionsRes.rows.map(row => row.player),
      timeline,
      expectedPerformance,
      teamMatchStats,
      standingsGuarani,
      seasonReport,
      seasonReportTimeline,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Falha ao carregar dados da Série C.' }, { status: 500 })
  }
}
