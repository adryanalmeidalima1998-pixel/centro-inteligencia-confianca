import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'
import {
  parseClubPlayerRows,
  parseClubTeamRows,
  summarizeClubDataset,
} from '@/data/club-sportsbase'

const TABLE = 'club_sportsbase'
let ensured = false

export async function ensureClubSportsbaseTable() {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS club_sportsbase (
      id                SERIAL PRIMARY KEY,
      team_json         JSONB NOT NULL DEFAULT '[]'::jsonb,
      players_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
      summary_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
      team_filename     TEXT,
      players_filename  TEXT,
      team_upload_at    TIMESTAMPTZ,
      players_upload_at TIMESTAMPTZ,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // Tabela canônica do projeto do Confiança.

  ensured = true
}

function readRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames.includes('Estatísticas principais')
    ? 'Estatísticas principais'
    : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
}

export function parseClubTeamFile(buffer) {
  return parseClubTeamRows(readRows(buffer))
}

export function parseClubPlayerFile(buffer) {
  return parseClubPlayerRows(readRows(buffer))
}

export async function getClubSportsbase() {
  await ensureClubSportsbaseTable()
  const result = await sql`
    SELECT team_json, players_json, summary_json, team_filename, players_filename,
           team_upload_at, players_upload_at, updated_at
    FROM club_sportsbase
    ORDER BY updated_at DESC
    LIMIT 1
  `

  if (!result.rows.length) {
    const games = []
    const players = []
    return { games, players, summary: summarizeClubDataset(games, players), uploads: {} }
  }

  const row = result.rows[0]
  const games = Array.isArray(row.team_json) ? row.team_json : []
  const players = Array.isArray(row.players_json) ? row.players_json : []
  const summary = row.summary_json && Object.keys(row.summary_json).length
    ? row.summary_json
    : summarizeClubDataset(games, players)

  return {
    games,
    players,
    summary,
    model: summary.model,
    uploads: {
      team: row.team_upload_at ? { filename: row.team_filename, uploadedAt: row.team_upload_at } : null,
      players: row.players_upload_at ? { filename: row.players_filename, uploadedAt: row.players_upload_at } : null,
      updatedAt: row.updated_at,
    },
  }
}

export async function saveClubSportsbase({ games, players, teamFilename, playersFilename, preserve = true }) {
  await ensureClubSportsbaseTable()
  const current = preserve ? await getClubSportsbase() : { games: [], players: [], uploads: {} }
  const nextGames = games === undefined ? current.games : games
  const nextPlayers = players === undefined ? current.players : players
  const summary = summarizeClubDataset(nextGames, nextPlayers)
  const now = new Date()

  const nextTeamFilename = games === undefined ? current.uploads?.team?.filename || null : teamFilename || null
  const nextPlayersFilename = players === undefined ? current.uploads?.players?.filename || null : playersFilename || null
  const teamUploadAt = games === undefined ? current.uploads?.team?.uploadedAt || null : now
  const playersUploadAt = players === undefined ? current.uploads?.players?.uploadedAt || null : now

  await sql`DELETE FROM club_sportsbase`
  await sql`
    INSERT INTO club_sportsbase (
      team_json, players_json, summary_json, team_filename, players_filename,
      team_upload_at, players_upload_at, updated_at
    ) VALUES (
      ${JSON.stringify(nextGames)}::jsonb,
      ${JSON.stringify(nextPlayers)}::jsonb,
      ${JSON.stringify(summary)}::jsonb,
      ${nextTeamFilename}, ${nextPlayersFilename},
      ${teamUploadAt}, ${playersUploadAt}, NOW()
    )
  `
  return getClubSportsbase()
}

export async function clearClubSportsbase(part = 'all') {
  const current = await getClubSportsbase()

  if (part === 'team') {
    await saveClubSportsbase({ games: [], players: current.players, teamFilename: null, preserve: false })
    await sql`UPDATE club_sportsbase SET team_filename = NULL, team_upload_at = NULL, updated_at = NOW()`
    return getClubSportsbase()
  }

  if (part === 'players') {
    await saveClubSportsbase({ games: current.games, players: [], playersFilename: null, preserve: false })
    await sql`UPDATE club_sportsbase SET players_filename = NULL, players_upload_at = NULL, updated_at = NOW()`
    return getClubSportsbase()
  }

  await ensureClubSportsbaseTable()
  await sql`DELETE FROM club_sportsbase`
  return getClubSportsbase()
}
