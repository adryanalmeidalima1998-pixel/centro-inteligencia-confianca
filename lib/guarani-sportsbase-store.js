import { sql } from '@vercel/postgres'
import * as XLSX from 'xlsx'
import {
  parseGuaraniPlayerRows,
  parseGuaraniTeamRows,
  summarizeGuaraniDataset,
} from '@/data/guarani-sportsbase'

export async function ensureGuaraniSportsbaseTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS guarani_sportsbase (
      id               SERIAL PRIMARY KEY,
      team_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
      players_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
      summary_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
      team_filename    TEXT,
      players_filename TEXT,
      team_upload_at   TIMESTAMPTZ,
      players_upload_at TIMESTAMPTZ,
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `
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

export function parseGuaraniTeamFile(buffer) {
  return parseGuaraniTeamRows(readRows(buffer))
}

export function parseGuaraniPlayerFile(buffer) {
  return parseGuaraniPlayerRows(readRows(buffer))
}

export async function getGuaraniSportsbase() {
  await ensureGuaraniSportsbaseTable()
  const result = await sql`
    SELECT team_json, players_json, summary_json, team_filename, players_filename,
           team_upload_at, players_upload_at, updated_at
    FROM guarani_sportsbase
    ORDER BY updated_at DESC
    LIMIT 1
  `
  if (!result.rows.length) {
    const games = []
    const players = []
    return { games, players, summary: summarizeGuaraniDataset(games, players), uploads: {} }
  }
  const row = result.rows[0]
  const games = Array.isArray(row.team_json) ? row.team_json : []
  const players = Array.isArray(row.players_json) ? row.players_json : []
  const summary = row.summary_json && Object.keys(row.summary_json).length
    ? row.summary_json
    : summarizeGuaraniDataset(games, players)
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

export async function saveGuaraniSportsbase({ games, players, teamFilename, playersFilename, preserve = true }) {
  await ensureGuaraniSportsbaseTable()
  const current = preserve ? await getGuaraniSportsbase() : { games: [], players: [], uploads: {} }
  const nextGames = games === undefined ? current.games : games
  const nextPlayers = players === undefined ? current.players : players
  const summary = summarizeGuaraniDataset(nextGames, nextPlayers)
  const now = new Date()
  const nextTeamFilename = games === undefined ? current.uploads?.team?.filename || null : teamFilename || null
  const nextPlayersFilename = players === undefined ? current.uploads?.players?.filename || null : playersFilename || null
  const teamUploadAt = games === undefined ? current.uploads?.team?.uploadedAt || null : now
  const playersUploadAt = players === undefined ? current.uploads?.players?.uploadedAt || null : now

  await sql`DELETE FROM guarani_sportsbase`
  await sql`
    INSERT INTO guarani_sportsbase (
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
  return getGuaraniSportsbase()
}

export async function clearGuaraniSportsbase(part = 'all') {
  const current = await getGuaraniSportsbase()
  if (part === 'team') {
    await saveGuaraniSportsbase({ games: [], players: current.players, teamFilename: null, preserve: false })
    await sql`UPDATE guarani_sportsbase SET team_filename = NULL, team_upload_at = NULL, updated_at = NOW()`
    return getGuaraniSportsbase()
  }
  if (part === 'players') {
    await saveGuaraniSportsbase({ games: current.games, players: [], playersFilename: null, preserve: false })
    await sql`UPDATE guarani_sportsbase SET players_filename = NULL, players_upload_at = NULL, updated_at = NOW()`
    return getGuaraniSportsbase()
  }
  await ensureGuaraniSportsbaseTable()
  await sql`DELETE FROM guarani_sportsbase`
  return getGuaraniSportsbase()
}
