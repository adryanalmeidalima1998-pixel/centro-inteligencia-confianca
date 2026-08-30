// lib/serieCDb.js
// ─────────────────────────────────────────────────────────────────────────────
// Camada de banco (Vercel Postgres) da área Série C | Estatísticas.
// Segue o mesmo padrão usado em app/api/gps/route.js e app/api/standings/route.js:
// tabela "guarda-chuva" com metadados + coluna JSONB com as métricas cruas da
// planilha (não normalizamos nome de coluna nenhum, para não inventar métrica).
// ─────────────────────────────────────────────────────────────────────────────
import { sql } from '@vercel/postgres'

export async function ensureSerieCTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_uploads (
      id                 SERIAL PRIMARY KEY,
      season             VARCHAR(20)  NOT NULL,
      competition        VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      round              INTEGER      NOT NULL,
      guarani_position   INTEGER,
      upload_date        DATE,
      uploaded_at        TIMESTAMP DEFAULT NOW()
    )
  `
  // uma rodada por temporada/competição não deve ter dois uploads (facilita "não apagar mas substituir a mesma rodada")
  try {
    await sql`
      ALTER TABLE serie_c_uploads
      ADD CONSTRAINT serie_c_uploads_unique_round UNIQUE (season, competition, round)
    `
  } catch (_) { /* já existe */ }

  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_team_stats (
      id          SERIAL PRIMARY KEY,
      upload_id   INTEGER NOT NULL REFERENCES serie_c_uploads(id) ON DELETE CASCADE,
      team        VARCHAR(200) NOT NULL,
      is_guarani  BOOLEAN DEFAULT FALSE,
      metrics     JSONB NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_player_stats (
      id          SERIAL PRIMARY KEY,
      upload_id   INTEGER NOT NULL REFERENCES serie_c_uploads(id) ON DELETE CASCADE,
      player      VARCHAR(200) NOT NULL,
      team        VARCHAR(200) NOT NULL,
      is_guarani  BOOLEAN DEFAULT FALSE,
      position    VARCHAR(20),
      age         INTEGER,
      minutes     INTEGER,
      metrics     JSONB NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_goalkeeper_stats (
      id          SERIAL PRIMARY KEY,
      upload_id   INTEGER NOT NULL REFERENCES serie_c_uploads(id) ON DELETE CASCADE,
      player      VARCHAR(200) NOT NULL,
      team        VARCHAR(200) NOT NULL,
      is_guarani  BOOLEAN DEFAULT FALSE,
      age         INTEGER,
      minutes     INTEGER,
      metrics     JSONB NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `

  // índices básicos de consulta
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_team_upload ON serie_c_team_stats(upload_id)` } catch (_) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_player_upload ON serie_c_player_stats(upload_id)` } catch (_) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_gk_upload ON serie_c_goalkeeper_stats(upload_id)` } catch (_) {}

  // Atletas que o usuário decidiu ocultar apenas dos relatórios da Série C.
  // Não apagamos os dados históricos da planilha: a exclusão é reversível.
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_report_exclusions (
      id           SERIAL PRIMARY KEY,
      season       VARCHAR(20)  NOT NULL,
      competition  VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      player       VARCHAR(200) NOT NULL,
      created_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE (season, competition, player)
    )
  `
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_report_exclusions ON serie_c_report_exclusions(season, competition)` } catch (_) {}

  // Histórico de jogos do Confiança (planilha "Estatísticas da partida"), com
  // rodada e posição na tabela cadastradas manualmente na aba Linha do Tempo.
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_guarani_matches (
      id           SERIAL PRIMARY KEY,
      season       VARCHAR(20) NOT NULL,
      competition  VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      match_date   DATE,
      mando        VARCHAR(1),
      opponent     VARCHAR(200) NOT NULL,
      score        VARCHAR(20),
      round        INTEGER,
      position     INTEGER,
      metrics      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `
  try {
    await sql`
      ALTER TABLE serie_c_guarani_matches
      ADD CONSTRAINT serie_c_guarani_matches_unique UNIQUE (season, competition, match_date, opponent)
    `
  } catch (_) { /* já existe */ }
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_matches_round ON serie_c_guarani_matches(season, competition, round)` } catch (_) {}


  // Partidas da competição inteira (duas linhas por jogo na planilha Wyscout).
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_competition_matches (
      id              SERIAL PRIMARY KEY,
      season          VARCHAR(20)  NOT NULL,
      competition     VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      round           INTEGER,
      match_date      DATE NOT NULL,
      match_label     VARCHAR(300) NOT NULL,
      home_team       VARCHAR(200) NOT NULL,
      away_team       VARCHAR(200) NOT NULL,
      home_code       VARCHAR(30),
      away_code       VARCHAR(30),
      home_score      INTEGER,
      away_score      INTEGER,
      home_metrics    JSONB NOT NULL DEFAULT '{}'::jsonb,
      away_metrics    JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_filename VARCHAR(300),
      imported_at     TIMESTAMP DEFAULT NOW()
    )
  `
  try {
    await sql`
      ALTER TABLE serie_c_competition_matches
      ADD CONSTRAINT serie_c_competition_matches_unique
      UNIQUE (season, competition, match_date, home_team, away_team)
    `
  } catch (_) { /* já existe */ }
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_comp_matches_round ON serie_c_competition_matches(season, competition, round)` } catch (_) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_comp_matches_date ON serie_c_competition_matches(season, competition, match_date)` } catch (_) {}

  // Histórico semanal da classificação da competição, extraído do PDF de
  // relatório da época. Cada rodada preserva o PDF original e as 20 linhas
  // estruturadas em JSONB para auditoria e leitura rápida no dashboard.
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_standings_snapshots (
      id              SERIAL PRIMARY KEY,
      season          VARCHAR(20)  NOT NULL,
      competition     VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      round           INTEGER      NOT NULL,
      source_filename VARCHAR(300) NOT NULL,
      source_url      TEXT,
      source_page     INTEGER      NOT NULL DEFAULT 2,
      reference_date  DATE,
      rows            JSONB        NOT NULL,
      report_data     JSONB        NOT NULL DEFAULT '{}'::jsonb,
      uploaded_at     TIMESTAMP DEFAULT NOW()
    )
  `
  try { await sql`ALTER TABLE serie_c_standings_snapshots ADD COLUMN IF NOT EXISTS report_data JSONB NOT NULL DEFAULT '{}'::jsonb` } catch (_) {}
  try {
    await sql`
      ALTER TABLE serie_c_standings_snapshots
      ADD CONSTRAINT serie_c_standings_unique_round
      UNIQUE (season, competition, round)
    `
  } catch (_) { /* já existe */ }
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_standings_latest ON serie_c_standings_snapshots(season, competition, round DESC)` } catch (_) {}

  // Coleta manual em tempo real da comissão. Usa o MESMO banco do dashboard.
  // A cópia offline fica somente no navegador até a internet voltar; depois
  // sincroniza para esta tabela sem apagar qualquer dado já existente.
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_live_matches (
      id                      SERIAL PRIMARY KEY,
      local_id                VARCHAR(100) NOT NULL UNIQUE,
      season                  VARCHAR(20) NOT NULL,
      competition             VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      match_date              DATE,
      opponent                VARCHAR(200) NOT NULL,
      home_away               VARCHAR(1) DEFAULT 'M',
      round                   INTEGER,
      venue                   VARCHAR(200),
      notes                   TEXT,
      status                  VARCHAR(20) NOT NULL DEFAULT 'open',
      active_half             INTEGER NOT NULL DEFAULT 1,
      first_half_finished_at  TIMESTAMP,
      second_half_finished_at TIMESTAMP,
      timer                   JSONB NOT NULL DEFAULT '{}'::jsonb,
      events                  JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sc_live_matches_date ON serie_c_live_matches(season, competition, match_date DESC)` } catch (_) {}
}



export async function ensureSerieCLiveCacheTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS serie_c_live_snapshots (
      id           SERIAL PRIMARY KEY,
      season       VARCHAR(20) NOT NULL,
      competition  VARCHAR(120) NOT NULL DEFAULT 'Brasileiro Série C',
      provider     VARCHAR(80) NOT NULL,
      fetched_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      payload      JSONB NOT NULL,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sc_live_snapshot_unique
    ON serie_c_live_snapshots(season, competition, provider)
  `
}
