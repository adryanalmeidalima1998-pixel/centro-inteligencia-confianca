import { sql } from '@vercel/postgres'
import { buildProfileBands, estimateCompetitiveLevels, competitiveLevelLabel, LEVELING_METHODOLOGY_VERSION, robustnessFromScore } from '@/data/competitive-levels'
import { normNome } from '@/app/lib/cigJogadores'
import { calcularIAP } from '@/lib/iap-engine'
import { resolveGrupo } from '@/data/iap-profiles'

const normalize = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const num = (value, fallback = null) => value === null || value === undefined || value === '' ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)))

let ensurePlayerMasterPromise = null

function seasonYear(season) {
  const match = String(season || '').match(/20\d{2}/)
  return match ? Number(match[0]) : new Date().getFullYear()
}

export function buildPlayerIdentity(player = {}, season = '') {
  const name = normNome(player.nome || player.jogador || player.Jogador)
  const birthDate = player.data_nascimento || player.nascimento || player.birth_date || player['Data de nascimento'] || ''
  let birthDateNorm = ''
  if (birthDate) {
    const parsed = new Date(birthDate)
    if (Number.isFinite(parsed.getTime())) birthDateNorm = parsed.toISOString().slice(0, 10)
  }
  const year = seasonYear(season || player.temporada)
  const age = num(player.idade)
  const birthYear = num(player.ano_nascimento, age ? year - age : null)
  const nationality = normalize(player.pais || player.nacionalidade || player.nationality)
  const position = normalize(String(player.posicao || '').split(',')[0])
  const stable = birthDateNorm || (birthYear ? String(birthYear) : '')
  const identityKey = stable
    ? [name, stable].join('|')
    : [name, nationality || 'na', position || 'na'].join('|')
  return { identityKey, name, birthDate: birthDateNorm || null, birthYear, nationality }
}

export function buildSourcePlayerKey(player = {}, provider = '', leagueSlug = '', season = '') {
  const identity = buildPlayerIdentity(player, season)
  return [provider, leagueSlug, seasonYear(season), identity.identityKey, normalize(player.equipa || player.clube || player.time)].join('|')
}

function dominantMetricCount(player = {}) {
  const profile = player._perfil_dominante
  return profile ? Object.keys(player._percentis_por_perfil?.[profile] || {}).length : 0
}

function applyLevelModelMetadata(players = []) {
  const maxMinutes = new Map()
  const poolSizes = new Map()
  for (const player of players) {
    const group = resolveGrupo(player.posicao) || 'Sem grupo'
    const key = `${player._fonte || ''}|${player._liga || ''}|${group}`
    maxMinutes.set(key, Math.max(maxMinutes.get(key) || 0, num(player.minutos, 0)))
    poolSizes.set(key, (poolSizes.get(key) || 0) + 1)
  }

  return players.map(player => {
    const group = resolveGrupo(player.posicao)
    const key = `${player._fonte || ''}|${player._liga || ''}|${group || 'Sem grupo'}`
    const maximum = maxMinutes.get(key) || num(player.minutos, 0) || 1
    const metricCount = dominantMetricCount(player)
    const expectedMetrics = group === 'Goleiro' ? 6 : 8
    const metricCoverage = clamp((metricCount / expectedMetrics) * 100, 0, 100)
    const iap = num(player._iap_dominante)
    const poolSize = poolSizes.get(key) || 0
    const modelAvailable = Boolean(group && poolSize >= 8 && metricCount >= 4 && iap !== null && iap > 0)
    const performanceScore = iap !== null && iap > 0 ? clamp(iap, 0, 100) : 50
    return {
      ...player,
      _level_position_group:group,
      _level_metric_count:metricCount,
      _level_metric_coverage:Math.round(metricCoverage),
      _level_model_available:modelAvailable,
      _level_pool_size:poolSize,
      _level_performance_score:Math.round(performanceScore),
      _level_minutes_share:clamp(num(player.minutos, 0) / maximum, 0, 1),
    }
  })
}

function preparePerformancePlayers(players = [], provider = '', leagueSlug = '') {
  const source = String(provider || '').toLowerCase()
  const prepared = players.map(player => ({ ...player, _fonte:source, _liga:leagueSlug || player._liga }))
  const groups = new Map()
  for (const player of prepared) {
    const group = resolveGrupo(player.posicao) || 'Sem grupo'
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(player)
  }

  const result = []
  for (const [group, list] of groups.entries()) {
    if (group !== 'Sem grupo') result.push(...calcularIAP(list, group))
    else result.push(...list.map(player => ({ ...player, _perfil_dominante:null, _iap_dominante:0, _percentis_por_perfil:{} })))
  }
  return applyLevelModelMetadata(result)
}

async function ensurePlayerMasterInternal() {
  await sql`
    CREATE TABLE IF NOT EXISTS cig_jogadores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      nome_norm TEXT NOT NULL,
      clube TEXT NOT NULL DEFAULT '',
      posicao TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(nome_norm, clube)
    )
  `
  // A ficha-mãe usa identity_key como identidade única. O constraint legado por nome+clube
  // gerava colisões quando homônimos ou mudanças de fonte eram sincronizados.
  await sql`ALTER TABLE cig_jogadores DROP CONSTRAINT IF EXISTS cig_jogadores_nome_norm_clube_key`
  await sql`DROP INDEX IF EXISTS cig_jogadores_nome_norm_clube_key`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS identity_key TEXT`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS birth_date DATE`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS birth_year INTEGER`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nacionalidade TEXT`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS pe_preferido TEXT`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS idade_atual INTEGER`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS video_url TEXT`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS ogol_url TEXT`

  // Colunas antigas são mantidas como nível efetivo para não quebrar consumidores existentes.
  // O nível efetivo é sempre: nível real do analista, quando preenchido; senão recomendação automática.
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_atual_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_potencial_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_comprovado_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_recomendado_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_potencial_recomendado_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_comprovado_recomendado_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_real_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_potencial_real_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_comprovado_real_score NUMERIC(5,2)`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_real_nota TEXT`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_real_updated_at TIMESTAMPTZ`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_confianca INTEGER DEFAULT 0`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_override JSONB DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_criterios JSONB DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_metodologia TEXT`
  await sql`ALTER TABLE cig_jogadores ADD COLUMN IF NOT EXISTS nivel_modelo_disponivel BOOLEAN DEFAULT FALSE`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS cig_jogadores_identity_key_uidx ON cig_jogadores(identity_key) WHERE identity_key IS NOT NULL`

  // Migra apenas decisões manuais da versão anterior. Recomendações antigas não são usadas quando a versão metodológica diverge.
  await sql`
    UPDATE cig_jogadores SET
      nivel_real_score = COALESCE(nivel_real_score, CASE WHEN COALESCE(nivel_override->>'current','') ~ '^[0-9]+([.][0-9]+)?$' THEN (nivel_override->>'current')::numeric END),
      nivel_potencial_real_score = COALESCE(nivel_potencial_real_score, CASE WHEN COALESCE(nivel_override->>'potential','') ~ '^[0-9]+([.][0-9]+)?$' THEN (nivel_override->>'potential')::numeric END),
      nivel_comprovado_real_score = COALESCE(nivel_comprovado_real_score, CASE WHEN COALESCE(nivel_override->>'proven','') ~ '^[0-9]+([.][0-9]+)?$' THEN (nivel_override->>'proven')::numeric END)
    WHERE nivel_override <> '{}'::jsonb
  `
  // Recomendações antigas são ignoradas em leitura pela versão da metodologia.
  // O recálculo v3 acontece automaticamente nos novos uploads, sem varrer toda a tabela.


  await sql`
    CREATE TABLE IF NOT EXISTS cig_player_sources (
      id BIGSERIAL PRIMARY KEY,
      cig_jogador_id INTEGER NOT NULL REFERENCES cig_jogadores(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      league_slug TEXT NOT NULL,
      season INTEGER NOT NULL,
      source_player_key TEXT NOT NULL,
      club TEXT,
      position TEXT,
      age INTEGER,
      preferred_foot TEXT,
      minutes NUMERIC DEFAULT 0,
      games NUMERIC DEFAULT 0,
      level_base NUMERIC(5,2),
      level_current NUMERIC(5,2),
      level_potential NUMERIC(5,2),
      level_proven NUMERIC(5,2),
      level_confidence INTEGER,
      performance_score INTEGER,
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      upload_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(provider, league_slug, season, source_player_key)
    )
  `
  await sql`ALTER TABLE cig_player_sources ADD COLUMN IF NOT EXISTS level_model_available BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE cig_player_sources ADD COLUMN IF NOT EXISTS level_metric_coverage INTEGER DEFAULT 0`
  await sql`ALTER TABLE cig_player_sources ADD COLUMN IF NOT EXISTS level_criteria JSONB DEFAULT '{}'::jsonb`
  await sql`ALTER TABLE cig_player_sources ADD COLUMN IF NOT EXISTS level_methodology TEXT`
  await sql`ALTER TABLE cig_player_sources ADD COLUMN IF NOT EXISTS level_reason TEXT`
  await sql`CREATE INDEX IF NOT EXISTS cig_player_sources_player_idx ON cig_player_sources(cig_jogador_id, upload_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS cig_player_sources_league_idx ON cig_player_sources(league_slug, provider, upload_at DESC)`
}


export async function ensurePlayerMaster() {
  if (!ensurePlayerMasterPromise) {
    ensurePlayerMasterPromise = ensurePlayerMasterInternal().catch(error => {
      ensurePlayerMasterPromise = null
      throw error
    })
  }
  return ensurePlayerMasterPromise
}

export async function syncPlayerSourceBatch({ players = [], provider = 'sportsbase', leagueSlug = '', season = new Date().getFullYear(), uploadedAt = null }) {
  if (!players.length || !leagueSlug) return { players: 0, canonical: 0 }
  await ensurePlayerMaster()
  const year = seasonYear(season)
  const performancePlayers = preparePerformancePlayers(players, provider, leagueSlug)
  const records = performancePlayers.map(player => {
    const identity = buildPlayerIdentity(player, year)
    const levels = estimateCompetitiveLevels(player, leagueSlug, { source: provider })
    return {
      identity_key: identity.identityKey,
      nome: String(player.nome || player.jogador || player.Jogador || '').trim(),
      nome_norm: identity.name,
      clube: String(player.equipa || player.clube || player.time || '').trim(),
      posicao: String(player.posicao || '').trim(),
      birth_date: identity.birthDate,
      birth_year: identity.birthYear,
      nacionalidade: String(player.pais || player.nacionalidade || '').trim(),
      pe_preferido: String(player.pe || '').trim(),
      idade_atual: num(player.idade),
      provider,
      league_slug: leagueSlug,
      season: year,
      source_player_key: buildSourcePlayerKey(player, provider, leagueSlug, year),
      minutes: num(player.minutos, 0),
      games: num(player.jogos || player.partidas, 0),
      level_base: levels.baseScore,
      level_current: levels.current.rawScore,
      level_potential: levels.potential.rawScore,
      level_proven: levels.proven.rawScore,
      level_confidence: levels.confidence.score,
      performance_score: levels.performanceScore,
      level_model_available: levels.modelAvailable,
      level_metric_coverage: levels.confidence.metricCoverage,
      level_criteria: levels.criteria,
      level_methodology: levels.methodologyVersion,
      level_reason: levels.reason,
      raw_data: player,
      upload_at: uploadedAt || new Date().toISOString(),
    }
  }).filter(item => item.nome && item.nome_norm)
  if (!records.length) return { players: 0, canonical: 0 }
  const payload = JSON.stringify(records)

  await sql.query(`
    WITH incoming_raw AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        identity_key text, nome text, nome_norm text, clube text, posicao text,
        birth_date date, birth_year integer, nacionalidade text, pe_preferido text, idade_atual integer,
        provider text, league_slug text, season integer, source_player_key text,
        minutes numeric, games numeric, level_base numeric, level_current numeric,
        level_potential numeric, level_proven numeric, level_confidence integer,
        performance_score integer, level_model_available boolean, level_metric_coverage integer,
        level_criteria jsonb, level_methodology text, level_reason text,
        raw_data jsonb, upload_at timestamptz
      )
    ), incoming AS (
      SELECT DISTINCT ON (identity_key) *
      FROM incoming_raw
      WHERE identity_key IS NOT NULL AND identity_key <> ''
      ORDER BY identity_key, minutes DESC
    ), claimed AS (
      UPDATE cig_jogadores cj SET
        identity_key = i.identity_key,
        birth_date = COALESCE(cj.birth_date, i.birth_date),
        birth_year = COALESCE(cj.birth_year, i.birth_year),
        nacionalidade = COALESCE(cj.nacionalidade, NULLIF(i.nacionalidade,'')),
        pe_preferido = COALESCE(cj.pe_preferido, NULLIF(i.pe_preferido,'')),
        idade_atual = COALESCE(i.idade_atual, cj.idade_atual),
        updated_at = NOW()
      FROM incoming i
      WHERE cj.identity_key IS NULL
        AND cj.nome_norm = i.nome_norm
        AND LOWER(TRIM(cj.clube)) = LOWER(TRIM(i.clube))
      RETURNING cj.id
    ), inserted AS (
      INSERT INTO cig_jogadores (
        identity_key, nome, nome_norm, clube, posicao, birth_date, birth_year,
        nacionalidade, pe_preferido, idade_atual,
        nivel_recomendado_score, nivel_potencial_recomendado_score, nivel_comprovado_recomendado_score,
        nivel_atual_score, nivel_potencial_score, nivel_comprovado_score,
        nivel_confianca, nivel_criterios, nivel_metodologia, nivel_modelo_disponivel, updated_at
      )
      SELECT
        i.identity_key, i.nome, i.nome_norm, i.clube, NULLIF(i.posicao,''), i.birth_date, i.birth_year,
        NULLIF(i.nacionalidade,''), NULLIF(i.pe_preferido,''), i.idade_atual,
        i.level_current, i.level_potential, i.level_proven,
        i.level_current, i.level_potential, i.level_proven,
        i.level_confidence, i.level_criteria, i.level_methodology, i.level_model_available, NOW()
      FROM incoming i
      WHERE NOT EXISTS (SELECT 1 FROM cig_jogadores cj WHERE cj.identity_key = i.identity_key)
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    UPDATE cig_jogadores cj SET
      nome = i.nome,
      nome_norm = i.nome_norm,
      clube = CASE WHEN i.clube <> '' THEN i.clube ELSE cj.clube END,
      posicao = COALESCE(NULLIF(i.posicao,''), cj.posicao),
      birth_date = COALESCE(cj.birth_date, i.birth_date),
      birth_year = COALESCE(cj.birth_year, i.birth_year),
      nacionalidade = COALESCE(NULLIF(i.nacionalidade,''), cj.nacionalidade),
      pe_preferido = COALESCE(NULLIF(i.pe_preferido,''), cj.pe_preferido),
      idade_atual = COALESCE(i.idade_atual, cj.idade_atual),
      updated_at = NOW()
    FROM incoming i
    WHERE cj.identity_key = i.identity_key
  `, [payload])

  await sql.query(`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        identity_key text, nome text, nome_norm text, clube text, posicao text,
        birth_date date, birth_year integer, nacionalidade text, pe_preferido text, idade_atual integer,
        provider text, league_slug text, season integer, source_player_key text,
        minutes numeric, games numeric, level_base numeric, level_current numeric,
        level_potential numeric, level_proven numeric, level_confidence integer,
        performance_score integer, level_model_available boolean, level_metric_coverage integer,
        level_criteria jsonb, level_methodology text, level_reason text,
        raw_data jsonb, upload_at timestamptz
      )
    )
    INSERT INTO cig_player_sources (
      cig_jogador_id, provider, league_slug, season, source_player_key, club, position,
      age, preferred_foot, minutes, games, level_base, level_current, level_potential,
      level_proven, level_confidence, performance_score, level_model_available,
      level_metric_coverage, level_criteria, level_methodology, level_reason, raw_data, upload_at
    )
    SELECT cj.id, i.provider, i.league_slug, i.season, i.source_player_key,
      i.clube, NULLIF(i.posicao,''), i.idade_atual, NULLIF(i.pe_preferido,''),
      i.minutes, i.games, i.level_base, i.level_current, i.level_potential,
      i.level_proven, i.level_confidence, i.performance_score, i.level_model_available,
      i.level_metric_coverage, i.level_criteria, i.level_methodology, i.level_reason, i.raw_data, i.upload_at
    FROM incoming i
    JOIN cig_jogadores cj ON cj.identity_key = i.identity_key
    ON CONFLICT (provider, league_slug, season, source_player_key) DO UPDATE SET
      cig_jogador_id = EXCLUDED.cig_jogador_id,
      club = EXCLUDED.club,
      position = EXCLUDED.position,
      age = EXCLUDED.age,
      preferred_foot = COALESCE(EXCLUDED.preferred_foot, cig_player_sources.preferred_foot),
      minutes = EXCLUDED.minutes,
      games = EXCLUDED.games,
      level_base = EXCLUDED.level_base,
      level_current = EXCLUDED.level_current,
      level_potential = EXCLUDED.level_potential,
      level_proven = EXCLUDED.level_proven,
      level_confidence = EXCLUDED.level_confidence,
      performance_score = EXCLUDED.performance_score,
      level_model_available = EXCLUDED.level_model_available,
      level_metric_coverage = EXCLUDED.level_metric_coverage,
      level_criteria = EXCLUDED.level_criteria,
      level_methodology = EXCLUDED.level_methodology,
      level_reason = EXCLUDED.level_reason,
      raw_data = EXCLUDED.raw_data,
      upload_at = EXCLUDED.upload_at
  `, [payload])

  await sql.query(`
    WITH affected AS (
      SELECT DISTINCT cj.id
      FROM jsonb_to_recordset($1::jsonb) AS x(identity_key text)
      JOIN cig_jogadores cj ON cj.identity_key = x.identity_key
    ), latest_level AS (
      SELECT DISTINCT ON (s.cig_jogador_id)
        s.cig_jogador_id, s.level_current, s.level_potential, s.level_confidence,
        s.level_criteria, s.level_methodology, s.level_model_available
      FROM cig_player_sources s JOIN affected a ON a.id = s.cig_jogador_id
      ORDER BY s.cig_jogador_id, s.season DESC,
        CASE WHEN s.level_current IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN s.provider = 'sportsbase' THEN 0 ELSE 1 END,
        s.upload_at DESC, s.minutes DESC
    ), latest_context AS (
      SELECT DISTINCT ON (s.cig_jogador_id)
        s.cig_jogador_id, s.club, s.position, s.age, s.preferred_foot
      FROM cig_player_sources s JOIN affected a ON a.id = s.cig_jogador_id
      ORDER BY s.cig_jogador_id, s.upload_at DESC, s.minutes DESC
    ), aggregate AS (
      SELECT s.cig_jogador_id,
        MAX(CASE WHEN s.level_proven IS NOT NULL AND s.level_confidence >= 62 THEN s.level_proven END) AS proven
      FROM cig_player_sources s JOIN affected a ON a.id = s.cig_jogador_id
      GROUP BY s.cig_jogador_id
    )
    UPDATE cig_jogadores cj SET
      nivel_recomendado_score = l.level_current,
      nivel_potencial_recomendado_score = l.level_potential,
      nivel_comprovado_recomendado_score = a.proven,
      nivel_atual_score = COALESCE(cj.nivel_real_score, l.level_current),
      nivel_potencial_score = COALESCE(cj.nivel_potencial_real_score, l.level_potential),
      nivel_comprovado_score = COALESCE(cj.nivel_comprovado_real_score, a.proven),
      nivel_confianca = l.level_confidence,
      nivel_criterios = COALESCE(l.level_criteria, '{}'::jsonb),
      nivel_metodologia = COALESCE(l.level_methodology, '2026.08-relative-v1'),
      nivel_modelo_disponivel = COALESCE(l.level_model_available, FALSE),
      clube = COALESCE(NULLIF(c.club,''), cj.clube),
      posicao = COALESCE(NULLIF(c.position,''), cj.posicao),
      idade_atual = COALESCE(c.age, cj.idade_atual),
      pe_preferido = COALESCE(NULLIF(c.preferred_foot,''), cj.pe_preferido),
      updated_at = NOW()
    FROM latest_level l
    JOIN latest_context c ON c.cig_jogador_id = l.cig_jogador_id
    JOIN aggregate a ON a.cig_jogador_id = l.cig_jogador_id
    WHERE cj.id = l.cig_jogador_id
  `, [payload])

  return { players: records.length, canonical: new Set(records.map(item => item.identity_key)).size }
}

export async function getCanonicalByIdentityKeys(keys = []) {
  if (!keys.length) return new Map()
  await ensurePlayerMaster()
  const result = await sql`
    SELECT id, identity_key, nome, clube, posicao, nacionalidade, pe_preferido, idade_atual,
      video_url, ogol_url,
      nivel_atual_score, nivel_potencial_score, nivel_comprovado_score,
      nivel_recomendado_score, nivel_potencial_recomendado_score, nivel_comprovado_recomendado_score,
      nivel_real_score, nivel_potencial_real_score, nivel_comprovado_real_score,
      nivel_real_nota, nivel_real_updated_at, nivel_confianca, nivel_criterios,
      nivel_metodologia, nivel_modelo_disponivel
    FROM cig_jogadores
    WHERE identity_key = ANY(${keys})
  `
  return new Map(result.rows.map(row => [row.identity_key, {
    ...row,
    nivel_atual:competitiveLevelLabel(row.nivel_atual_score),
    nivel_potencial:competitiveLevelLabel(row.nivel_potencial_score),
    nivel_comprovado:competitiveLevelLabel(row.nivel_comprovado_score),
    nivel_recomendado:competitiveLevelLabel(row.nivel_recomendado_score),
    nivel_potencial_recomendado:competitiveLevelLabel(row.nivel_potencial_recomendado_score),
    nivel_comprovado_recomendado:competitiveLevelLabel(row.nivel_comprovado_recomendado_score),
    nivel_real:row.nivel_real_score === null ? null : competitiveLevelLabel(row.nivel_real_score),
  }]))
}

export async function attachCanonicalPlayers(players = [], { season = new Date().getFullYear() } = {}) {
  if (!players.length) return players
  const modeledPlayers = applyLevelModelMetadata(players)
  const identities = modeledPlayers.map(player => buildPlayerIdentity(player, season))
  const map = await getCanonicalByIdentityKeys([...new Set(identities.map(item => item.identityKey))])
  return modeledPlayers.map((player, index) => {
    const canonical = map.get(identities[index].identityKey)
    const estimate = estimateCompetitiveLevels(player, player._liga || player.liga, { source:player._fonte || player.fonte })
    const canonicalMethodCurrent = canonical?.nivel_metodologia === LEVELING_METHODOLOGY_VERSION
      && num(canonical?.nivel_recomendado_score) !== null
    const recommendedScore = canonicalMethodCurrent
      ? num(canonical?.nivel_recomendado_score, estimate.current.rawScore)
      : estimate.current.rawScore
    const potentialRecommendedScore = canonicalMethodCurrent
      ? num(canonical?.nivel_potencial_recomendado_score, estimate.potential.rawScore)
      : estimate.potential.rawScore
    const provenRecommendedScore = canonicalMethodCurrent
      ? num(canonical?.nivel_comprovado_recomendado_score, estimate.proven.rawScore)
      : estimate.proven.rawScore
    const realScore = num(canonical?.nivel_real_score)
    const potentialRealScore = num(canonical?.nivel_potencial_real_score)
    const provenRealScore = num(canonical?.nivel_comprovado_real_score)
    const effectiveScore = realScore ?? recommendedScore
    const effectivePotential = potentialRealScore ?? potentialRecommendedScore
    const effectiveProven = provenRealScore ?? provenRecommendedScore

    const profileBands = buildProfileBands(player, estimate)
    const robustness = robustnessFromScore(canonicalMethodCurrent ? num(canonical?.nivel_confianca, estimate.confidence.score) : estimate.confidence.score)
    return {
      ...player,
      _identity_key:identities[index].identityKey,
      _canonical_id:canonical?.id || null,
      _nivel_recomendado_score:recommendedScore,
      _nivel_recomendado:competitiveLevelLabel(recommendedScore),
      _nivel_real_score:realScore,
      _nivel_real:realScore === null ? null : competitiveLevelLabel(realScore),
      _nivel_atual_score:effectiveScore,
      _nivel_atual:competitiveLevelLabel(effectiveScore),
      _nivel_fonte:realScore !== null ? 'analista' : 'automático',
      _nivel_potencial_recomendado_score:potentialRecommendedScore,
      _nivel_potencial_recomendado:competitiveLevelLabel(potentialRecommendedScore),
      _nivel_potencial_real_score:potentialRealScore,
      _nivel_potencial_score:effectivePotential,
      _nivel_potencial:competitiveLevelLabel(effectivePotential),
      _nivel_comprovado_recomendado_score:provenRecommendedScore,
      _nivel_comprovado_recomendado:competitiveLevelLabel(provenRecommendedScore),
      _nivel_comprovado_real_score:provenRealScore,
      _nivel_comprovado_score:effectiveProven,
      _nivel_comprovado:competitiveLevelLabel(effectiveProven),
      _nivel_confianca:canonicalMethodCurrent ? num(canonical?.nivel_confianca, estimate.confidence.score) : estimate.confidence.score,
      _nivel_criterios:canonicalMethodCurrent ? (canonical?.nivel_criterios || estimate.criteria || {}) : (estimate.criteria || {}),
      _nivel_metodologia:canonicalMethodCurrent ? canonical?.nivel_metodologia : estimate.methodologyVersion,
      _nivel_modelo_disponivel:canonicalMethodCurrent ? (canonical?.nivel_modelo_disponivel ?? estimate.modelAvailable) : estimate.modelAvailable,
      _nivel_recomendacao_tipo:estimate.recommendationType || estimate.criteria?.recommendationType || 'provisório',
      _indice_bruto:estimate.criteria?.rawIndex ?? player._iap_dominante ?? 50,
      _indice_relativo:estimate.criteria?.adjustedIndex ?? 50,
      _projecao_indice:estimate.criteria?.projectionIndex ?? 50,
      _tendencia:estimate.criteria?.trend || 'Estável',
      _robustez:robustness,
      _faixas_perfis:profileBands,
      _nivel_motivo:estimate.reason || null,
      _nivel_real_nota:canonical?.nivel_real_nota || '',
      _nivel_real_updated_at:canonical?.nivel_real_updated_at || null,
      _video_url:canonical?.video_url || null,
      _ogol_url:canonical?.ogol_url || null,
    }
  })
}
