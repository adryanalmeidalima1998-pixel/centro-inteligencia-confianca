// app/api/serie-c/data/route.js
// Devolve o snapshot de uma rodada (times, jogadores, goleiros), a rodada
// anterior (para calcular variação) e a linha do tempo completa do Confiança.
import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { ensureSerieCTables } from '../../../../lib/serieCDb'
import { findMetricColumnAny, normTeamName, valueFromMetricAny } from '../../../../lib/serieC'

const XG_ALIASES = ['Golos esperados', 'Gols esperados', 'xG', 'Expected goals']

const MATCH_ALIASES = {
  duration: ['Duração', 'Duracao'],
  possession: ['Posse, %', 'Posse de bola, %', 'Posse'],
  ppda: ['PPDA'],
  goals: ['Gols', 'Golos'],
  xg: XG_ALIASES,

  shots: ['Chutes', 'Remates'],
  shotsOnTarget: ['Chutes no alvo', 'Remates à baliza', 'Remates no alvo'],
  shotsAgainst: ['Chutes contra', 'Remates contra'],
  shotsAgainstOnTarget: ['Chutes contra no alvo', 'Remates contra no alvo'],
  blockedShots: ['Chutes bloqueados', 'Remates bloqueados'],

  passes: ['Passes'],
  passAccuracy: ['Passes precisos, %', 'Precisão de passe, %', 'Precisao de passe, %'],
  progressivePasses: ['Passes progressivos', 'Passes progressivos / precisos'],
  progressivePassAccuracy: ['Passes progressivos precisos, %', 'Passes progressivos / precisos, %'],
  finalThirdPasses: ['Passes para o terço final', 'Passes para terço final', 'Passes para terço final / certos'],
  finalThirdPassAccuracy: ['Passes para o terço final precisos, %', 'Passes para terço final precisos, %'],
  deepReceptions: ['Passes em profundidade recebidos', 'Recepções profundas', 'Rececoes profundas'],
  deepCrossesReceived: ['Cruzamentos em profundidade recebidos'],
  passesPerPossession: ['Média de passes por posse', 'Media de passes por posse'],
  longPassPct: ['% de passe longo'],
  intensity: ['Intensidade de jogo'],

  boxEntries: ['Entradas na área adversária', 'Entradas na grande área', 'Entradas na área', 'Entradas na grande área (corridas/cruzamentos)'],
  boxTouches: ['Toques na área', 'Ações na área adversária', 'Acoes na area adversaria'],
  crosses: ['Cruzamentos'],
  crossesAccuracy: ['Cruzamentos precisos, %'],
  dribbles: ['Dribles'],
  dribblesSuccess: ['Dribles bem-sucedidos, %'],
  offensiveDuels: ['Duelos ofensivos'],
  offensiveDuelsSuccess: ['Duelos ofensivos ganhos, %'],

  pressureSuccess: ['Pressão do time bem-sucedida, %', 'Pressão bem-sucedida, %', 'Pressão bem-sucedida'],
  recoveries: ['Recuperações da bola', 'Recuperações', 'Recuperacoes'],
  recoveriesOppHalf: ['Recuperações da bola no campo adversário', 'Recuperações campo adversário'],
  interceptions: ['Interceptações', 'Interseções,', 'Interseções'],
  defensiveDuels: ['Duelos defensivos'],
  defensiveDuelsSuccess: ['Duelos defensivos ganhos, %'],
  aerialDuels: ['Duelos aéreos', 'Duelos aereos'],
  aerialDuelsSuccess: ['Duelos aéreos ganhos, %', 'Duelos aereos ganhos, %'],
  tackles: ['Desarmes', 'Carrinhos'],
  tacklesSuccess: ['Desarmes bem-sucedidos, %', 'Carrinhos bem sucedidos, %'],

  setPieces: ['Bolas paradas'],
  setPiecesShots: ['Bolas paradas com chutes', 'Bolas paradas com remates'],
  setPieceGoals: ['Ataques de bola parada com gol'],
  corners: ['Escanteios', 'Cantos'],
  cornersShots: ['Escanteios com chutes', 'Cantos com remates', 'Cantos com chutes'],
  cornerGoals: ['Ataques de escanteio com gol'],
  freeKicks: ['Faltas cobradas', 'Pontapés livre'],

  formation: ['Tática (inicial)', 'Tatica (inicial)', 'Sistema'],
}

function avgNumbers(values) {
  const valid = values.filter(v => Number.isFinite(Number(v))).map(Number)
  return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null
}

function sumNumbers(values) {
  const valid = values.filter(v => Number.isFinite(Number(v))).map(Number)
  return valid.length ? valid.reduce((a,b)=>a+b,0) : null
}

function metricText(metrics, aliases) {
  const key = findMetricColumnAny(metrics || {}, aliases)
  if (!key) return null
  const value = metrics?.[key]
  return value === null || value === undefined || value === '' ? null : String(value).trim()
}

function formationBase(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const match = raw.match(/\b\d-\d(?:-\d){1,3}\b/)
  return match ? match[0] : raw.replace(/\s*\([^)]*%\)\s*$/, '').trim()
}

function metricPer90(games, key) {
  let total = 0
  let minutes = 0
  let validWithDuration = 0
  for (const game of games) {
    const value = Number(game?.[key])
    const duration = Number(game?.duration)
    if (!Number.isFinite(value)) continue
    if (Number.isFinite(duration) && duration > 0) {
      total += value
      minutes += duration
      validWithDuration += 1
    }
  }
  if (validWithDuration && minutes > 0) return total / minutes * 90
  return avgNumbers(games.map(game => game?.[key]))
}


function clubTokens(value) {
  const stop = new Set(['FC','EC','SC','AA','AD','SAF','CLUBE','CLUB','DE','DA','DO','DAS','DOS','ESPORTE','SPORT'])
  return normTeamName(value).split(' ').filter(token => token && !stop.has(token))
}

function sameClubName(a, b) {
  const na = normTeamName(a), nb = normTeamName(b)
  if (!na || !nb) return false
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  const ta = clubTokens(a), tb = clubTokens(b)
  if (!ta.length || !tb.length) return false
  const shared = ta.filter(token => tb.includes(token))
  return shared.length / Math.min(ta.length, tb.length) >= 0.5
}

function dateDistanceDays(a, b) {
  const da = new Date(a).getTime(), db = new Date(b).getTime()
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY
  return Math.abs(da - db) / 86400000
}

function mergeProviderGames(games = []) {
  const merged = []
  const metricKeys = [
    'duration','possession','ppda','shots','shotsOnTarget','shotsAgainst','shotsAgainstOnTarget','blockedShots','xg','xga','passes','passAccuracy',
    'progressivePasses','progressivePassAccuracy','finalThirdPasses','finalThirdPassAccuracy','deepReceptions','deepCrossesReceived','passesPerPossession','longPassPct','intensity',
    'boxEntries','boxTouches','crosses','crossesAccuracy','dribbles','dribblesSuccess','offensiveDuels','offensiveDuelsSuccess','pressureSuccess','recoveries','recoveriesOppHalf',
    'interceptions','defensiveDuels','defensiveDuelsSuccess','aerialDuels','aerialDuelsSuccess','tackles','tacklesSuccess','setPieces','setPiecesShots','setPiecesAgainst','setPiecesShotsAgainst',
    'setPieceGoals','setPieceGoalsAgainst','corners','cornersShots','cornersAgainst','cornerGoals','cornerGoalsAgainst','freeKicks'
  ]
  for (const game of [...games].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))) {
    const hit = merged.find(item => sameClubName(item.opponent, game.opponent) && dateDistanceDays(item.date, game.date) <= 2)
    if (!hit) {
      merged.push({ ...game })
      continue
    }
    for (const key of metricKeys) {
      if ((hit[key] === null || hit[key] === undefined) && game[key] !== null && game[key] !== undefined) hit[key] = game[key]
    }
    if (!hit.formation && game.formation) hit.formation = game.formation
    if (!hit.round && game.round) hit.round = game.round
    // Mantém a data/placar da versão mais recente do confronto.
    if (String(game.date || '') > String(hit.date || '')) hit.date = game.date
    if (!hit.goalsFor && game.goalsFor) hit.goalsFor = game.goalsFor
    if (!hit.goalsAgainst && game.goalsAgainst) hit.goalsAgainst = game.goalsAgainst
  }
  return merged
}
function aggregateConfiancaMatchStats(rows) {
  const allGames=[]
  for (const row of rows || []) {
    const home=isGuaraniSide(row.home_team,row.home_code)
    const away=isGuaraniSide(row.away_team,row.away_code)
    if(!home && !away) continue
    const own=home ? (row.home_metrics||{}) : (row.away_metrics||{})
    const opp=home ? (row.away_metrics||{}) : (row.home_metrics||{})
    const metric=(aliases,obj=own)=>valueFromMetricAny(obj,aliases)
    const text=(aliases,obj=own)=>metricText(obj,aliases)
    allGames.push({
      round:Number(row.round)||null,
      date:row.match_date,
      opponent:home?row.away_team:row.home_team,
      duration:metric(MATCH_ALIASES.duration),
      formation:formationBase(text(MATCH_ALIASES.formation)),
      goalsFor:Number(home?row.home_score:row.away_score)||0,
      goalsAgainst:Number(home?row.away_score:row.home_score)||0,
      possession:metric(MATCH_ALIASES.possession),
      ppda:metric(MATCH_ALIASES.ppda),
      shots:metric(MATCH_ALIASES.shots),
      shotsOnTarget:metric(MATCH_ALIASES.shotsOnTarget),
      shotsAgainst:metric(MATCH_ALIASES.shotsAgainst) ?? metric(MATCH_ALIASES.shots,opp),
      shotsAgainstOnTarget:metric(MATCH_ALIASES.shotsAgainstOnTarget) ?? metric(MATCH_ALIASES.shotsOnTarget,opp),
      blockedShots:metric(MATCH_ALIASES.blockedShots),
      xg:metric(MATCH_ALIASES.xg),
      xga:metric(MATCH_ALIASES.xg,opp),
      passes:metric(MATCH_ALIASES.passes),
      passAccuracy:metric(MATCH_ALIASES.passAccuracy),
      progressivePasses:metric(MATCH_ALIASES.progressivePasses),
      progressivePassAccuracy:metric(MATCH_ALIASES.progressivePassAccuracy),
      finalThirdPasses:metric(MATCH_ALIASES.finalThirdPasses),
      finalThirdPassAccuracy:metric(MATCH_ALIASES.finalThirdPassAccuracy),
      deepReceptions:metric(MATCH_ALIASES.deepReceptions),
      deepCrossesReceived:metric(MATCH_ALIASES.deepCrossesReceived),
      passesPerPossession:metric(MATCH_ALIASES.passesPerPossession),
      longPassPct:metric(MATCH_ALIASES.longPassPct),
      intensity:metric(MATCH_ALIASES.intensity),
      boxEntries:metric(MATCH_ALIASES.boxEntries),
      boxTouches:metric(MATCH_ALIASES.boxTouches),
      crosses:metric(MATCH_ALIASES.crosses),
      crossesAccuracy:metric(MATCH_ALIASES.crossesAccuracy),
      dribbles:metric(MATCH_ALIASES.dribbles),
      dribblesSuccess:metric(MATCH_ALIASES.dribblesSuccess),
      offensiveDuels:metric(MATCH_ALIASES.offensiveDuels),
      offensiveDuelsSuccess:metric(MATCH_ALIASES.offensiveDuelsSuccess),
      pressureSuccess:metric(MATCH_ALIASES.pressureSuccess),
      recoveries:metric(MATCH_ALIASES.recoveries),
      recoveriesOppHalf:metric(MATCH_ALIASES.recoveriesOppHalf),
      interceptions:metric(MATCH_ALIASES.interceptions),
      defensiveDuels:metric(MATCH_ALIASES.defensiveDuels),
      defensiveDuelsSuccess:metric(MATCH_ALIASES.defensiveDuelsSuccess),
      aerialDuels:metric(MATCH_ALIASES.aerialDuels),
      aerialDuelsSuccess:metric(MATCH_ALIASES.aerialDuelsSuccess),
      tackles:metric(MATCH_ALIASES.tackles),
      tacklesSuccess:metric(MATCH_ALIASES.tacklesSuccess),
      setPieces:metric(MATCH_ALIASES.setPieces),
      setPiecesShots:metric(MATCH_ALIASES.setPiecesShots),
      setPiecesAgainst:metric(MATCH_ALIASES.setPieces,opp),
      setPiecesShotsAgainst:metric(MATCH_ALIASES.setPiecesShots,opp),
      setPieceGoals:metric(MATCH_ALIASES.setPieceGoals),
      setPieceGoalsAgainst:metric(MATCH_ALIASES.setPieceGoals,opp),
      corners:metric(MATCH_ALIASES.corners),
      cornersShots:metric(MATCH_ALIASES.cornersShots),
      cornersAgainst:metric(MATCH_ALIASES.corners,opp),
      cornerGoals:metric(MATCH_ALIASES.cornerGoals),
      cornerGoalsAgainst:metric(MATCH_ALIASES.cornerGoals,opp),
      freeKicks:metric(MATCH_ALIASES.freeKicks),
    })
  }
  if(!allGames.length) return null
  const providerMergedGames = mergeProviderGames(allGames)

  // O relatório coletivo é explicitamente um recorte das últimas 10 partidas.
  // Antes a API misturava a temporada inteira; agora o motor ordena por rodada/
  // data e usa exatamente os 10 jogos mais recentes disponíveis.
  const games=[...providerMergedGames].sort((a,b)=>{
    const roundDiff=(Number(b.round)||0)-(Number(a.round)||0)
    if(roundDiff) return roundDiff
    return String(b.date||'').localeCompare(String(a.date||''))
  }).slice(0,10).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))

  const formationCounts=new Map()
  for(const game of games) if(game.formation) formationCounts.set(game.formation,(formationCounts.get(game.formation)||0)+1)
  const formations=[...formationCounts.entries()]
    .sort((a,b)=>b[1]-a[1])
    .map(([formation,matches])=>({formation,matches,share:matches/games.length*100}))

  return {
    source:'partidas-wyscout-sportsbase', matches:games.length,
    goalsFor:games.reduce((a,g)=>a+g.goalsFor,0), goalsAgainst:games.reduce((a,g)=>a+g.goalsAgainst,0),
    possession:avgNumbers(games.map(g=>g.possession)), ppda:avgNumbers(games.map(g=>g.ppda)),
    shots:metricPer90(games,'shots'), shotsOnTarget:metricPer90(games,'shotsOnTarget'),
    shotsAgainst:metricPer90(games,'shotsAgainst'), shotsAgainstOnTarget:metricPer90(games,'shotsAgainstOnTarget'),
    blockedShots:metricPer90(games,'blockedShots'),
    xg:avgNumbers(games.map(g=>g.xg)), xga:avgNumbers(games.map(g=>g.xga)),
    passes:metricPer90(games,'passes'), passAccuracy:avgNumbers(games.map(g=>g.passAccuracy)),
    progressivePasses:metricPer90(games,'progressivePasses'), progressivePassAccuracy:avgNumbers(games.map(g=>g.progressivePassAccuracy)),
    finalThirdPasses:metricPer90(games,'finalThirdPasses'), finalThirdPassAccuracy:avgNumbers(games.map(g=>g.finalThirdPassAccuracy)),
    deepReceptions:metricPer90(games,'deepReceptions'), deepCrossesReceived:metricPer90(games,'deepCrossesReceived'),
    passesPerPossession:avgNumbers(games.map(g=>g.passesPerPossession)), longPassPct:avgNumbers(games.map(g=>g.longPassPct)),
    intensity:avgNumbers(games.map(g=>g.intensity)),
    boxEntries:metricPer90(games,'boxEntries'), boxTouches:metricPer90(games,'boxTouches'),
    crosses:metricPer90(games,'crosses'), crossesAccuracy:avgNumbers(games.map(g=>g.crossesAccuracy)),
    dribbles:metricPer90(games,'dribbles'), dribblesSuccess:avgNumbers(games.map(g=>g.dribblesSuccess)),
    offensiveDuels:metricPer90(games,'offensiveDuels'), offensiveDuelsSuccess:avgNumbers(games.map(g=>g.offensiveDuelsSuccess)),
    pressureSuccess:avgNumbers(games.map(g=>g.pressureSuccess)),
    recoveries:metricPer90(games,'recoveries'), recoveriesOppHalf:metricPer90(games,'recoveriesOppHalf'),
    interceptions:metricPer90(games,'interceptions'),
    defensiveDuels:metricPer90(games,'defensiveDuels'), defensiveDuelsSuccess:avgNumbers(games.map(g=>g.defensiveDuelsSuccess)),
    aerialDuels:metricPer90(games,'aerialDuels'), aerialDuelsSuccess:avgNumbers(games.map(g=>g.aerialDuelsSuccess)),
    tackles:metricPer90(games,'tackles'), tacklesSuccess:avgNumbers(games.map(g=>g.tacklesSuccess)),
    setPieces:metricPer90(games,'setPieces'), setPiecesShots:metricPer90(games,'setPiecesShots'),
    setPiecesAgainst:metricPer90(games,'setPiecesAgainst'), setPiecesShotsAgainst:metricPer90(games,'setPiecesShotsAgainst'),
    setPieceGoals:sumNumbers(games.map(g=>g.setPieceGoals)), setPieceGoalsAgainst:sumNumbers(games.map(g=>g.setPieceGoalsAgainst)),
    corners:metricPer90(games,'corners'), cornersShots:metricPer90(games,'cornersShots'), cornersAgainst:metricPer90(games,'cornersAgainst'),
    cornerGoals:sumNumbers(games.map(g=>g.cornerGoals)), cornerGoalsAgainst:sumNumbers(games.map(g=>g.cornerGoalsAgainst)),
    freeKicks:metricPer90(games,'freeKicks'),
    cleanSheets:games.filter(g=>Number(g.goalsAgainst)===0).length,
    goalsAgainstPerGame:games.length ? games.reduce((a,g)=>a+g.goalsAgainst,0)/games.length : null,
    goalsForPerGame:games.length ? games.reduce((a,g)=>a+g.goalsFor,0)/games.length : null,
    formations,
    games,
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
