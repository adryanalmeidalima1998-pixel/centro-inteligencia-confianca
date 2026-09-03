-- ─── CIG LIGAS — Schema Migration ────────────────────────────────────────────
-- Rodar no Neon Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS ligas_cig (
  id                    SERIAL PRIMARY KEY,
  nome                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  pais                  TEXT DEFAULT 'Brasil',
  temporada             TEXT DEFAULT '2026',
  nivel                 INTEGER,
  tem_jogadores         BOOLEAN DEFAULT TRUE,
  fonte_jogador         TEXT,   -- 'besoccer' | 'footystats' | null
  sheets_base           TEXT,
  gid_league            TEXT,
  gid_matches           TEXT,
  gid_teams             TEXT,
  gid_goleiros          TEXT,
  gid_zagueiros         TEXT,
  gid_laterais_dir      TEXT,
  gid_laterais_esq      TEXT,
  gid_volantes          TEXT,
  gid_medios            TEXT,
  gid_meias_ofensivos   TEXT,
  gid_extremos_dir      TEXT,
  gid_extremos_esq      TEXT,
  gid_centroavantes     TEXT,
  gid_players           TEXT,
  ativo                 BOOLEAN DEFAULT TRUE,
  cor_hex               TEXT DEFAULT '#006633',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liga_stats_cig (
  id                      SERIAL PRIMARY KEY,
  liga_id                 INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
  season                  INTEGER,
  status                  TEXT,
  number_of_clubs         INTEGER,
  total_matches           INTEGER,
  matches_completed       INTEGER,
  progress                INTEGER,
  avg_goals_per_match     NUMERIC,
  avg_goals_home          NUMERIC,
  avg_goals_away          NUMERIC,
  btts_percentage         INTEGER,
  clean_sheets_percentage INTEGER,
  avg_corners_per_match   NUMERIC,
  avg_cards_per_match     NUMERIC,
  xg_avg_per_match        NUMERIC,
  raw_json                JSONB DEFAULT '{}'::jsonb,
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liga_id, season)
);

CREATE TABLE IF NOT EXISTS partidas_liga (
  id              SERIAL PRIMARY KEY,
  liga_id         INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
  date_gmt        TEXT,
  status          TEXT,
  home_team       TEXT,
  away_team       TEXT,
  home_goals      INTEGER,
  away_goals      INTEGER,
  home_goals_ht   INTEGER,
  away_goals_ht   INTEGER,
  home_xg         NUMERIC,
  away_xg         NUMERIC,
  home_shots      INTEGER,
  away_shots      INTEGER,
  home_possession INTEGER,
  away_possession INTEGER,
  home_corners    INTEGER,
  away_corners    INTEGER,
  home_yellow     INTEGER,
  away_yellow     INTEGER,
  stadium         TEXT,
  game_week       INTEGER,
  raw_json        JSONB DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liga_id, home_team, away_team, date_gmt)
);

CREATE TABLE IF NOT EXISTS times_liga (
  id                  SERIAL PRIMARY KEY,
  liga_id             INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
  team_name           TEXT NOT NULL,
  common_name         TEXT,
  matches_played      INTEGER DEFAULT 0,
  wins                INTEGER DEFAULT 0,
  draws               INTEGER DEFAULT 0,
  losses              INTEGER DEFAULT 0,
  goals_scored        INTEGER DEFAULT 0,
  goals_conceded      INTEGER DEFAULT 0,
  goal_difference     INTEGER GENERATED ALWAYS AS (goals_scored - goals_conceded) STORED,
  pontos              INTEGER GENERATED ALWAYS AS (wins * 3 + draws) STORED,
  points_per_game     NUMERIC,
  league_position     INTEGER,
  xg_for_avg          NUMERIC,
  xg_against_avg      NUMERIC,
  avg_possession      NUMERIC,
  shots_per_match     NUMERIC,
  raw_json            JSONB DEFAULT '{}'::jsonb,
  relatorio           JSONB DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liga_id, team_name)
);

CREATE TABLE IF NOT EXISTS jogadores_liga (
  id               SERIAL PRIMARY KEY,
  liga_id          INTEGER REFERENCES ligas_cig(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  equipe           TEXT,
  posicao          TEXT,
  posicao_grupo    TEXT,  -- 'Goleiro' | 'Defensor' | 'Meia' | 'Atacante'
  idade            INTEGER,
  altura           INTEGER,
  pe               TEXT,
  nacionalidade    TEXT,
  minutos          INTEGER DEFAULT 0,
  partidas         INTEGER DEFAULT 0,
  fim_contrato     TEXT,
  valor_mercado    TEXT,
  agente           TEXT,
  elo              NUMERIC,
  elo_max          NUMERIC,
  reap             NUMERIC,
  potencial        INTEGER,
  -- métricas normalizadas principais
  gols             NUMERIC DEFAULT 0,
  assistencias     NUMERIC DEFAULT 0,
  xg               NUMERIC DEFAULT 0,
  xa               NUMERIC DEFAULT 0,
  passes_pct       NUMERIC,
  passes_prog      NUMERIC,
  dribles          NUMERIC,
  dribles_pct      NUMERIC,
  interceptacoes   NUMERIC,
  recuperacoes     NUMERIC,
  desarmes         NUMERIC,
  duelos_aereos    NUMERIC,
  duelos_aereos_pct NUMERIC,
  chutes           NUMERIC,
  chutes_gol       NUMERIC,
  cruzamentos      NUMERIC,
  metricas_raw     JSONB DEFAULT '{}'::jsonb,
  fonte            TEXT,  -- 'besoccer' | 'footystats'
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liga_id, nome, equipe)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_jl_liga    ON jogadores_liga(liga_id);
CREATE INDEX IF NOT EXISTS idx_jl_pos     ON jogadores_liga(posicao_grupo);
CREATE INDEX IF NOT EXISTS idx_jl_min     ON jogadores_liga(minutos);
CREATE INDEX IF NOT EXISTS idx_jl_idade   ON jogadores_liga(idade);
CREATE INDEX IF NOT EXISTS idx_jl_equipe  ON jogadores_liga(equipe);
CREATE INDEX IF NOT EXISTS idx_pl_liga    ON partidas_liga(liga_id);
CREATE INDEX IF NOT EXISTS idx_tl_liga    ON times_liga(liga_id);
CREATE INDEX IF NOT EXISTS idx_tl_pos     ON times_liga(liga_id, league_position);

-- Seed das 3 ligas iniciais
INSERT INTO ligas_cig (
  nome, slug, pais, temporada, nivel, tem_jogadores, fonte_jogador,
  sheets_base,
  gid_league, gid_matches, gid_teams,
  gid_goleiros, gid_zagueiros, gid_laterais_dir, gid_laterais_esq,
  gid_volantes, gid_medios, gid_meias_ofensivos,
  gid_extremos_dir, gid_extremos_esq, gid_centroavantes
) VALUES (
  'Brasileirão Série C', 'serie-c-2026', 'Brasil', '2026', 3, TRUE, 'besoccer',
  'CONFIGURE_SHEETS_BASE_URL',
  '1296948672', '1104213841', '548563815',
  '0', '1927040773', '710128616', '592747026',
  '2024466051', '247666035', '871820534',
  '1601794186', '1557537335', '1123037743'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO ligas_cig (
  nome, slug, pais, temporada, nivel, tem_jogadores, fonte_jogador,
  sheets_base,
  gid_league, gid_matches, gid_teams
) VALUES (
  'Brasileirão Série D', 'serie-d-2026', 'Brasil', '2026', 4, FALSE, NULL,
  'CONFIGURE_SHEETS_BASE_URL',
  '638348524', '294724991', '1375785428'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO ligas_cig (
  nome, slug, pais, temporada, nivel, tem_jogadores, fonte_jogador,
  sheets_base,
  gid_league, gid_matches, gid_teams, gid_players
) VALUES (
  'Paulista A2', 'paulista-a2-2026', 'Brasil', '2026', NULL, TRUE, 'footystats',
  'CONFIGURE_SHEETS_BASE_URL',
  '638348524', '1759951252', '294724991', '1375785428'
) ON CONFLICT (slug) DO NOTHING;
