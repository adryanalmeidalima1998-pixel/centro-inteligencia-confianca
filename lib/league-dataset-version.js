/**
 * Versões persistidas em cada coleta de liga.
 *
 * Ao alterar pesos, perfis, elegibilidade de métricas ou normalização do IAP,
 * incremente LEAGUE_ENGINE_VERSION. Ao alterar o parser/estrutura normalizada de
 * um fornecedor, incremente a versão correspondente em LEAGUE_SCHEMA_VERSIONS.
 */
export const LEAGUE_ENGINE_VERSION = 'iap-engine-2026.08'

export const LEAGUE_SCHEMA_VERSIONS = Object.freeze({
  sportsbase: 'sportsbase-schema-2026.08-v2',
  wyscout: 'wyscout-schema-2026.08',
})

export function getLeagueSchemaVersion(source) {
  return LEAGUE_SCHEMA_VERSIONS[source] || `${source || 'unknown'}-schema-legacy`
}

export function resolveLeagueSeason(value, fallbackDate = new Date()) {
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) return parsed

  const date = fallbackDate instanceof Date ? fallbackDate : new Date(fallbackDate)
  return Number.isFinite(date.getTime()) ? date.getFullYear() : new Date().getFullYear()
}
