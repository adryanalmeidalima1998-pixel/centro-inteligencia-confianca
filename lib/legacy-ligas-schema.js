import { sql } from '@vercel/postgres'

let legacyReady = null
let teamStatsReady = null

/**
 * Garante as tabelas da primeira geração do módulo de ligas.
 * Algumas telas legadas continuam disponíveis por compatibilidade e devem
 * funcionar mesmo quando o Centro de Inteligência começa com um banco novo.
 */
export async function ensureLegacyLigasSchema() {
  if (legacyReady) return legacyReady
  legacyReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS ligas_cig (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        pais TEXT DEFAULT 'Brasil',
        temporada TEXT DEFAULT '2026',
        nivel INTEGER,
        tem_jogadores BOOLEAN DEFAULT TRUE,
        fonte_jogador TEXT,
        sheets_base TEXT,
        gid_league TEXT,
        gid_matches TEXT,
        gid_teams TEXT,
        gid_goleiros TEXT,
        gid_zagueiros TEXT,
        gid_laterais_dir TEXT,
        gid_laterais_esq TEXT,
        gid_volantes TEXT,
        gid_medios TEXT,
        gid_meias_ofensivos TEXT,
        gid_extremos_dir TEXT,
        gid_extremos_esq TEXT,
        gid_centroavantes TEXT,
        gid_players TEXT,
        ativo BOOLEAN DEFAULT TRUE,
        cor_hex TEXT DEFAULT '#0a66b7',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS liga_stats_cig (
        id SERIAL PRIMARY KEY,
        liga_id INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
        season INTEGER,
        status TEXT,
        number_of_clubs INTEGER,
        total_matches INTEGER,
        matches_completed INTEGER,
        progress INTEGER,
        avg_goals_per_match NUMERIC,
        avg_goals_home NUMERIC,
        avg_goals_away NUMERIC,
        btts_percentage INTEGER,
        clean_sheets_percentage INTEGER,
        avg_corners_per_match NUMERIC,
        avg_cards_per_match NUMERIC,
        xg_avg_per_match NUMERIC,
        raw_json JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(liga_id, season)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS partidas_liga (
        id SERIAL PRIMARY KEY,
        liga_id INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
        date_gmt TEXT,
        status TEXT,
        home_team TEXT,
        away_team TEXT,
        home_goals INTEGER,
        away_goals INTEGER,
        home_goals_ht INTEGER,
        away_goals_ht INTEGER,
        home_xg NUMERIC,
        away_xg NUMERIC,
        home_shots INTEGER,
        away_shots INTEGER,
        home_possession INTEGER,
        away_possession INTEGER,
        home_corners INTEGER,
        away_corners INTEGER,
        home_yellow INTEGER,
        away_yellow INTEGER,
        stadium TEXT,
        game_week INTEGER,
        raw_json JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(liga_id, home_team, away_team, date_gmt)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS times_liga (
        id SERIAL PRIMARY KEY,
        liga_id INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
        team_name TEXT NOT NULL,
        common_name TEXT,
        matches_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        goals_scored INTEGER DEFAULT 0,
        goals_conceded INTEGER DEFAULT 0,
        goal_difference INTEGER GENERATED ALWAYS AS (goals_scored - goals_conceded) STORED,
        pontos INTEGER GENERATED ALWAYS AS (wins * 3 + draws) STORED,
        points_per_game NUMERIC,
        league_position INTEGER,
        xg_for_avg NUMERIC,
        xg_against_avg NUMERIC,
        avg_possession NUMERIC,
        shots_per_match NUMERIC,
        raw_json JSONB DEFAULT '{}'::jsonb,
        relatorio JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(liga_id, team_name)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS jogadores_liga (
        id SERIAL PRIMARY KEY,
        liga_id INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        equipe TEXT,
        posicao TEXT,
        posicao_grupo TEXT,
        idade INTEGER,
        altura INTEGER,
        pe TEXT,
        nacionalidade TEXT,
        minutos INTEGER DEFAULT 0,
        partidas INTEGER DEFAULT 0,
        fim_contrato TEXT,
        valor_mercado TEXT,
        agente TEXT,
        elo NUMERIC,
        elo_max NUMERIC,
        reap NUMERIC,
        potencial INTEGER,
        gols NUMERIC DEFAULT 0,
        assistencias NUMERIC DEFAULT 0,
        xg NUMERIC DEFAULT 0,
        xa NUMERIC DEFAULT 0,
        passes_pct NUMERIC,
        passes_prog NUMERIC,
        dribles NUMERIC,
        dribles_pct NUMERIC,
        interceptacoes NUMERIC,
        recuperacoes NUMERIC,
        desarmes NUMERIC,
        duelos_aereos NUMERIC,
        duelos_aereos_pct NUMERIC,
        chutes NUMERIC,
        chutes_gol NUMERIC,
        cruzamentos NUMERIC,
        metricas_raw JSONB DEFAULT '{}'::jsonb,
        fonte TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(liga_id, nome, equipe)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_jl_liga ON jogadores_liga(liga_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_jl_pos ON jogadores_liga(posicao_grupo)`
    await sql`CREATE INDEX IF NOT EXISTS idx_jl_min ON jogadores_liga(minutos)`
    await sql`CREATE INDEX IF NOT EXISTS idx_jl_idade ON jogadores_liga(idade)`
    await sql`CREATE INDEX IF NOT EXISTS idx_jl_equipe ON jogadores_liga(equipe)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pl_liga ON partidas_liga(liga_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_tl_liga ON times_liga(liga_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_tl_pos ON times_liga(liga_id, league_position)`
  })().catch(error => {
    legacyReady = null
    throw error
  })
  return legacyReady
}

/** Tabela dos uploads coletivos Wyscout por clube e competição. */
export async function ensureLigaTimeStatsSchema() {
  if (teamStatsReady) return teamStatsReady
  teamStatsReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS liga_time_stats (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        team_name TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        total INTEGER DEFAULT 0,
        upload_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_liga_time_stats_lookup ON liga_time_stats(slug, team_name, upload_at DESC)`
  })().catch(error => {
    teamStatsReady = null
    throw error
  })
  return teamStatsReady
}
