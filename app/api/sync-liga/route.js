import { ensureLegacyLigasSchema } from '@/lib/legacy-ligas-schema'
import { sql } from '@vercel/postgres'

function parseNum(v) {
  if (v === null || v === undefined || v === '-' || v === '' || v === 'NaN') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseStr(v) {
  if (!v || v === '-' || v === 'nan' || v === 'NaN' || v === 'None') return null
  return String(v).trim() || null
}

async function fetchCSV(baseUrl, gid) {
  const url = `${baseUrl}?output=csv&gid=${gid}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheets falhou: ${url} (${res.status})`)
  const text = await res.text()
  // Parse CSV manual simples
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { vals.push(cur); cur = '' }
      else cur += ch
    }
    vals.push(cur)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').replace(/^"|"$/g, '').trim()]))
  })
}

const POSICAO_BESOCCER = {
  'GOLEIROS':           { posicao: 'Goleiro',         grupo: 'Goleiro' },
  'ZAGUEIROS':          { posicao: 'Zagueiro',         grupo: 'Defensor' },
  'LATERAIS DIREITO':   { posicao: 'Lateral Direito',  grupo: 'Defensor' },
  'LATERAIS ESQUERDO':  { posicao: 'Lateral Esquerdo', grupo: 'Defensor' },
  'VOLANTE':            { posicao: 'Volante',           grupo: 'Meia' },
  'MÉDIO':              { posicao: 'Médio',             grupo: 'Meia' },
  'MEIA OFENSIVO':      { posicao: 'Meia Ofensivo',     grupo: 'Meia' },
  'EXTREMOS DIREITO':   { posicao: 'Extremo Direito',   grupo: 'Atacante' },
  'EXTREMOS ESQUERDO':  { posicao: 'Extremo Esquerdo',  grupo: 'Atacante' },
  'CENTROAVANTES':      { posicao: 'Centroavante',      grupo: 'Atacante' },
}

const POSICAO_FOOTYSTATS = {
  'Goalkeeper': { posicao: 'Goleiro',       grupo: 'Goleiro' },
  'Defender':   { posicao: 'Defensor',      grupo: 'Defensor' },
  'Midfielder': { posicao: 'Médio',         grupo: 'Meia' },
  'Forward':    { posicao: 'Atacante',      grupo: 'Atacante' },
}

export async function POST(req) {
  await ensureLegacyLigasSchema()
  try {
    const { liga_slug, tipo } = await req.json()
    // tipo: 'all' | 'league' | 'teams' | 'matches' | 'jogadores'
    const syncTipo = tipo || 'all'

    const { rows: ligas } = await sql`SELECT * FROM ligas_cig WHERE slug = ${liga_slug}`
    if (!ligas.length) return Response.json({ error: 'Liga não encontrada' }, { status: 404 })
    const liga = ligas[0]
    const log = []

    // ─── LEAGUE STATS ─────────────────────────────────────────────────────────
    if ((syncTipo === 'all' || syncTipo === 'league') && liga.gid_league) {
      const rows = await fetchCSV(liga.sheets_base, liga.gid_league)
      if (rows.length) {
        const r = rows[0]
        await sql`
          INSERT INTO liga_stats_cig (liga_id, season, status, number_of_clubs, total_matches,
            matches_completed, progress, avg_goals_per_match, avg_goals_home, avg_goals_away,
            btts_percentage, clean_sheets_percentage, avg_corners_per_match,
            avg_cards_per_match, xg_avg_per_match, raw_json)
          VALUES (${liga.id}, ${parseNum(r.season)||2026}, ${parseStr(r.status)},
            ${parseNum(r.number_of_clubs)}, ${parseNum(r.total_matches)},
            ${parseNum(r.matches_completed)}, ${parseNum(r.progress)},
            ${parseNum(r.average_goals_per_match)}, ${parseNum(r.average_scored_home_team)},
            ${parseNum(r.average_scored_away_team)}, ${parseNum(r.btts_percentage)},
            ${parseNum(r.clean_sheets_percentage)}, ${parseNum(r.average_corners_per_match)},
            ${parseNum(r.average_cards_per_match)}, ${parseNum(r.xg_avg_per_match)},
            ${JSON.stringify(r)})
          ON CONFLICT (liga_id, season) DO UPDATE SET
            status = EXCLUDED.status, matches_completed = EXCLUDED.matches_completed,
            progress = EXCLUDED.progress, avg_goals_per_match = EXCLUDED.avg_goals_per_match,
            raw_json = EXCLUDED.raw_json, updated_at = NOW()
        `
        log.push(`league stats ✓ (${r.status || 'ok'})`)
      }
    }

    // ─── TEAMS ────────────────────────────────────────────────────────────────
    if ((syncTipo === 'all' || syncTipo === 'teams') && liga.gid_teams) {
      const rows = await fetchCSV(liga.sheets_base, liga.gid_teams)
      let cnt = 0
      for (const r of rows) {
        if (!r.team_name) continue
        const jogos = parseNum(r.matches_played) || 1
        await sql`
          INSERT INTO times_liga (liga_id, team_name, common_name, matches_played,
            wins, draws, losses, goals_scored, goals_conceded, points_per_game,
            league_position, xg_for_avg, xg_against_avg, avg_possession, shots_per_match, raw_json)
          VALUES (${liga.id}, ${r.team_name}, ${parseStr(r.common_name)||r.team_name},
            ${parseNum(r.matches_played)||0}, ${parseNum(r.wins)||0},
            ${parseNum(r.draws)||0}, ${parseNum(r.losses)||0},
            ${parseNum(r.goals_scored)||0}, ${parseNum(r.goals_conceded)||0},
            ${parseNum(r.points_per_game)}, ${parseNum(r.league_position)},
            ${parseNum(r.xg_for_avg_overall)}, ${parseNum(r.xg_against_avg_overall)},
            ${parseNum(r.average_possession)},
            ${parseNum(r.shots) ? (parseNum(r.shots)||0) / Math.max(jogos,1) : null},
            ${JSON.stringify(r)})
          ON CONFLICT (liga_id, team_name) DO UPDATE SET
            matches_played = EXCLUDED.matches_played, wins = EXCLUDED.wins,
            draws = EXCLUDED.draws, losses = EXCLUDED.losses,
            goals_scored = EXCLUDED.goals_scored, goals_conceded = EXCLUDED.goals_conceded,
            league_position = EXCLUDED.league_position, points_per_game = EXCLUDED.points_per_game,
            xg_for_avg = EXCLUDED.xg_for_avg, raw_json = EXCLUDED.raw_json, updated_at = NOW()
        `
        cnt++
      }
      log.push(`teams ✓ (${cnt} times)`)
    }

    // ─── MATCHES ──────────────────────────────────────────────────────────────
    if ((syncTipo === 'all' || syncTipo === 'matches') && liga.gid_matches) {
      const rows = await fetchCSV(liga.sheets_base, liga.gid_matches)
      let cnt = 0
      for (const r of rows) {
        if (!r.home_team_name || !r.away_team_name) continue
        await sql`
          INSERT INTO partidas_liga (liga_id, date_gmt, status, home_team, away_team,
            home_goals, away_goals, home_goals_ht, away_goals_ht,
            home_xg, away_xg, home_shots, away_shots, home_possession, away_possession,
            home_corners, away_corners, home_yellow, away_yellow, stadium, game_week, raw_json)
          VALUES (${liga.id}, ${parseStr(r.date_GMT)}, ${parseStr(r.status)},
            ${r.home_team_name}, ${r.away_team_name},
            ${parseNum(r.home_team_goal_count)}, ${parseNum(r.away_team_goal_count)},
            ${parseNum(r.home_team_goal_count_half_time)}, ${parseNum(r.away_team_goal_count_half_time)},
            ${parseNum(r.team_a_xg)}, ${parseNum(r.team_b_xg)},
            ${parseNum(r.home_team_shots)}, ${parseNum(r.away_team_shots)},
            ${parseNum(r.home_team_possession)}, ${parseNum(r.away_team_possession)},
            ${parseNum(r.home_team_corner_count)}, ${parseNum(r.away_team_corner_count)},
            ${parseNum(r.home_team_yellow_cards)}, ${parseNum(r.away_team_yellow_cards)},
            ${parseStr(r.stadium_name)}, ${parseNum(r['Game Week'])}, ${JSON.stringify(r)})
          ON CONFLICT (liga_id, home_team, away_team, date_gmt) DO UPDATE SET
            status = EXCLUDED.status, home_goals = EXCLUDED.home_goals,
            away_goals = EXCLUDED.away_goals, home_xg = EXCLUDED.home_xg,
            away_xg = EXCLUDED.away_xg, raw_json = EXCLUDED.raw_json, updated_at = NOW()
        `
        cnt++
      }
      log.push(`matches ✓ (${cnt} partidas)`)
    }

    // ─── JOGADORES BESOCCER ───────────────────────────────────────────────────
    if ((syncTipo === 'all' || syncTipo === 'jogadores') && liga.fonte_jogador === 'besoccer') {
      const gidMap = {
        'GOLEIROS':          { gid: liga.gid_goleiros,        ...POSICAO_BESOCCER['GOLEIROS'] },
        'ZAGUEIROS':         { gid: liga.gid_zagueiros,       ...POSICAO_BESOCCER['ZAGUEIROS'] },
        'LATERAIS DIREITO':  { gid: liga.gid_laterais_dir,    ...POSICAO_BESOCCER['LATERAIS DIREITO'] },
        'LATERAIS ESQUERDO': { gid: liga.gid_laterais_esq,    ...POSICAO_BESOCCER['LATERAIS ESQUERDO'] },
        'VOLANTE':           { gid: liga.gid_volantes,        ...POSICAO_BESOCCER['VOLANTE'] },
        'MÉDIO':             { gid: liga.gid_medios,          ...POSICAO_BESOCCER['MÉDIO'] },
        'MEIA OFENSIVO':     { gid: liga.gid_meias_ofensivos, ...POSICAO_BESOCCER['MEIA OFENSIVO'] },
        'EXTREMOS DIREITO':  { gid: liga.gid_extremos_dir,    ...POSICAO_BESOCCER['EXTREMOS DIREITO'] },
        'EXTREMOS ESQUERDO': { gid: liga.gid_extremos_esq,    ...POSICAO_BESOCCER['EXTREMOS ESQUERDO'] },
        'CENTROAVANTES':     { gid: liga.gid_centroavantes,   ...POSICAO_BESOCCER['CENTROAVANTES'] },
      }
      let total = 0
      for (const [aba, info] of Object.entries(gidMap)) {
        if (!info.gid) continue
        const rows = await fetchCSV(liga.sheets_base, info.gid)
        for (const r of rows) {
          const nome = parseStr(r['Jogador'])
          if (!nome || nome === '-') continue
          await sql`
            INSERT INTO jogadores_liga (
              liga_id, nome, equipe, posicao, posicao_grupo, idade, altura, pe,
              minutos, partidas, fim_contrato, valor_mercado, agente,
              elo, elo_max, reap, potencial,
              gols, assistencias, xg, xa,
              passes_pct, passes_prog, dribles, dribles_pct,
              interceptacoes, recuperacoes, desarmes,
              duelos_aereos, duelos_aereos_pct, chutes, chutes_gol, cruzamentos,
              metricas_raw, fonte
            ) VALUES (
              ${liga.id}, ${nome}, ${parseStr(r['Equipe'])},
              ${info.posicao}, ${info.grupo},
              ${parseNum(r['Idade'])}, ${parseNum(r['Altura'])}, ${parseStr(r['Perna boa'])},
              ${parseNum(r['Estat. avançada (min)'])||0}, ${parseNum(r['Partidas jogadas'])||0},
              ${parseStr(r['Fim de Contrato'])}, ${parseStr(r['Valor de mercado'])}, ${parseStr(r['Agente'])},
              ${parseNum(r['Elo'])}, ${parseNum(r['Máx. ELO'])}, ${parseNum(r['REAP'])}, ${parseNum(r['Potencial'])},
              ${parseNum(r['Gols'])||0}, ${parseNum(r['Assistências'])||0},
              ${parseNum(r['xG'])||0}, ${parseNum(r['xA'])||0},
              ${parseNum(r['% Passes concluídos'])}, ${parseNum(r['Passes progr.'])},
              ${parseNum(r['Dribles'])}, ${parseNum(r['% Dribles completos'])},
              ${parseNum(r['Interceptações'])}, ${parseNum(r['Recuperações'])}, ${parseNum(r['Entradas'])},
              ${parseNum(r['Disputas aéreas'])}, ${parseNum(r['% Disputas aéreas vencidas'])},
              ${parseNum(r['Chutes'])}, ${parseNum(r['Chutes a gol'])}, ${parseNum(r['Cruzamentos'])},
              ${JSON.stringify(r)}, 'besoccer'
            )
            ON CONFLICT (liga_id, nome, equipe) DO UPDATE SET
              minutos = EXCLUDED.minutos, partidas = EXCLUDED.partidas,
              gols = EXCLUDED.gols, assistencias = EXCLUDED.assistencias,
              xg = EXCLUDED.xg, xa = EXCLUDED.xa, elo = EXCLUDED.elo,
              interceptacoes = EXCLUDED.interceptacoes, desarmes = EXCLUDED.desarmes,
              metricas_raw = EXCLUDED.metricas_raw, updated_at = NOW()
          `
          total++
        }
      }
      log.push(`jogadores BeSoccer ✓ (${total} atletas)`)
    }

    // ─── JOGADORES FOOTYSTATS ─────────────────────────────────────────────────
    if ((syncTipo === 'all' || syncTipo === 'jogadores') && liga.fonte_jogador === 'footystats' && liga.gid_players) {
      const rows = await fetchCSV(liga.sheets_base, liga.gid_players)
      let cnt = 0
      for (const r of rows) {
        const nome = parseStr(r.full_name)
        if (!nome) continue
        const posInfo = POSICAO_FOOTYSTATS[r.position] || { posicao: r.position || 'Médio', grupo: 'Meia' }
        await sql`
          INSERT INTO jogadores_liga (
            liga_id, nome, equipe, posicao, posicao_grupo, idade, minutos, partidas,
            gols, assistencias, xg, xa, passes_prog, dribles,
            interceptacoes, desarmes, chutes, cruzamentos,
            duelos_aereos, duelos_aereos_pct, metricas_raw, fonte
          ) VALUES (
            ${liga.id}, ${nome}, ${parseStr(r['Current Club'])},
            ${posInfo.posicao}, ${posInfo.grupo},
            ${parseNum(r.age)}, ${parseNum(r.minutes_played_overall)||0},
            ${parseNum(r.appearances_overall)||0},
            ${parseNum(r.goals_overall)||0}, ${parseNum(r.assists_overall)||0},
            ${parseNum(r.xg_total_overall)||0}, ${parseNum(r.xa_total_overall)||0},
            ${parseNum(r.progressive_passes_total_overall)},
            ${parseNum(r.dribbles_total_overall)}, ${parseNum(r.interceptions_total_overall)},
            ${parseNum(r.tackles_total_overall)}, ${parseNum(r.shots_total_overall)},
            ${parseNum(r.crosses_total_overall)},
            ${parseNum(r.aerial_duels_total_overall)},
            ${parseNum(r.aerial_duels_won_percentage_overall)},
            ${JSON.stringify(r)}, 'footystats'
          )
          ON CONFLICT (liga_id, nome, equipe) DO UPDATE SET
            minutos = EXCLUDED.minutos, gols = EXCLUDED.gols,
            assistencias = EXCLUDED.assistencias, xg = EXCLUDED.xg,
            metricas_raw = EXCLUDED.metricas_raw, updated_at = NOW()
        `
        cnt++
      }
      log.push(`jogadores FootyStats ✓ (${cnt} atletas)`)
    }

    return Response.json({ ok: true, liga: liga.nome, sync: log })
  } catch (e) {
    console.error(e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
