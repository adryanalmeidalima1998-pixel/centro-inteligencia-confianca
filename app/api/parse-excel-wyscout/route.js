import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/* ── Column index map (0-based) ──────────────────────────────── */
const COL = {
  date: 0, jogo: 1, competition: 2, duration: 3, team: 4, formation: 5,
  goals: 6, xG: 7,
  shots: 8, shotsOnTarget: 9, shotsPct: 10,
  passes: 11, passesAccurate: 12, passAccuracy: 13,
  possession: 14,
  losses: 15, lossesShort: 16, lossesMedium: 17, lossesLong: 18,
  recoveries: 19,
  duelsTotal: 23, duelsWon: 24, duelsPct: 25,
  shotsOutside: 26,
  positionalAttacks: 29, positionalAttacksShots: 30,
  counterAttacks: 32,
  setPieces: 35,
  corners: 38,
  freekicks: 41,
  crosses: 47, crossesAccurate: 48,
  deepCrossesReceived: 50, deepPassesReceived: 51,
  boxEntriesRuns: 52, boxEntriesCrosses: 53,
  touchesInBox: 55,
  duelsOff: 56, duelsOffWon: 57, duelsOffPct: 58,
  offsides: 59,
  goalsConceded: 60,
  shotsConceded: 61, shotsConcededOnTarget: 62,
  duelsDef: 64, duelsDefWon: 65, duelsDefPct: 66,
  aerialDuels: 67, aerialDuelsWon: 68, aerialDuelsPct: 69,
  tackles: 70,
  interceptions: 73,
  clearances: 74,
  fouls: 75,
  yellowCards: 76,
  redCards: 77,
  passesForward: 78, passesForwardAccurate: 79,
  passesBack: 81, passesBackAccurate: 82,
  passesLateral: 84, passesLateralAccurate: 85,
  passesLong: 87, passesLongAccurate: 88,
  passesFinalThird: 90, passesFinalThirdAccurate: 91,
  progressivePasses: 93, progressivePassesAccurate: 94,
  ppda: 108,
}

function rowToStats(row) {
  const v = (i) => parseFloat(row[i]) || 0
  return {
    goals:              v(COL.goals),
    xG:                 v(COL.xG),
    shots:              v(COL.shots),
    shotsOnTarget:      v(COL.shotsOnTarget),
    passes:             v(COL.passes),
    passAccuracy:       v(COL.passAccuracy),
    possession:         v(COL.possession),
    progressivePasses:  v(COL.progressivePasses),
    recoveries:         v(COL.recoveries),
    duelsTotal:         v(COL.duelsTotal),
    duelsPct:           v(COL.duelsPct),
    duelsOffPct:        v(COL.duelsOffPct),
    duelsDefPct:        v(COL.duelsDefPct),
    aerialDuelsPct:     v(COL.aerialDuelsPct),
    corners:            v(COL.corners),
    fouls:              v(COL.fouls),
    yellowCards:        v(COL.yellowCards),
    redCards:           v(COL.redCards),
    goalsConceded:      v(COL.goalsConceded),
    shotsConceded:      v(COL.shotsConceded),
    touchesInBox:       v(COL.touchesInBox),
    crosses:            v(COL.crosses),
    crossesAccurate:    v(COL.crossesAccurate),
    interceptions:      v(COL.interceptions),
    clearances:         v(COL.clearances),
    positionalAttacks:  v(COL.positionalAttacks),
    counterAttacks:     v(COL.counterAttacks),
    formation:          row[COL.formation] || '',
    ppda:               v(COL.ppda),
    losses:             v(COL.losses),
    deepPassesReceived: v(COL.deepPassesReceived),
  }
}

function parseLabel(jogo) {
  // "Confiança - Botafogo SP 0:2" OR "Palmeiras - Confiança 1:1"
  const m = jogo.match(/^(.+?)\s+-\s+(.+?)\s+(\d+)[:\-xX](\d+)$/)
  if (!m) return { homeTeam: jogo, awayTeam: '', score: '0-0' }
  const [, home, away, g1, g2] = m
  return { homeTeam: home.trim(), awayTeam: away.trim(), score: `${g1}-${g2}` }
}

function formatDate(raw) {
  if (!raw) return ''
  if (typeof raw === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw)
    return `${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')}/${d.y}`
  }
  if (raw instanceof Date) {
    return `${String(raw.getDate()).padStart(2,'0')}/${String(raw.getMonth()+1).padStart(2,'0')}/${raw.getFullYear()}`
  }
  // Already a string
  const s = String(raw)
  // "2026-02-07" → "07/02/2026"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return s
}

export async function POST(req) {
  try {
    const { base64 } = await req.json()
    if (!base64) return NextResponse.json({ error: 'base64 obrigatório' }, { status: 400 })

    const buf  = Buffer.from(base64, 'base64')
    const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    // Skip header rows (rows[0] = header, rows[1] = Confiança averages, rows[2] = Adversários averages)
    const dataRows = rows.slice(3).filter(r => r[COL.team] && r[COL.jogo])

    // Group by jogo string → find Confiança row + opponent row
    const groups = {}
    for (const row of dataRows) {
      const key = `${row[COL.jogo]}||${row[COL.date]}`
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
    }

    const matches = []
    for (const [, pair] of Object.entries(groups)) {
      const guaraniRow = pair.find(r => String(r[COL.team]).toLowerCase().includes('confianca'))
      const oppRow     = pair.find(r => !String(r[COL.team]).toLowerCase().includes('confianca'))
      if (!guaraniRow) continue

      const { homeTeam, awayTeam, score } = parseLabel(guaraniRow[COL.jogo])
      const date        = formatDate(guaraniRow[COL.date])
      const competition = guaraniRow[COL.competition] || ''

      matches.push({
        homeTeam,
        awayTeam,
        score,
        date,
        competition,
        guarani:  rowToStats(guaraniRow),
        opponent: oppRow ? rowToStats(oppRow) : {},
      })
    }

    return NextResponse.json({ matches, count: matches.length })
  } catch (err) {
    console.error('parse-excel-wyscout:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
