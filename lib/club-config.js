/**
 * Identidade canônica do clube atual.
 *
 * Este módulo centraliza nome, sigla e aliases para evitar regras de identidade
 * espalhadas por rotas, parsers e componentes. Ele é deliberadamente puro e
 * pode ser usado tanto no server quanto no client.
 */
export const CURRENT_CLUB = Object.freeze({
  name: 'Confiança',
  formalName: 'Associação Desportiva Confiança',
  code: 'CON',
  slug: 'confianca',
  aliases: Object.freeze([
    'Confiança',
    'Confianca',
    'AD Confiança',
    'AD Confianca',
    'Associação Desportiva Confiança',
    'Associacao Desportiva Confianca',
  ]),
  colors: Object.freeze({
    primary: '#0a66b7',
    dark: '#064b82',
  }),
})

export function normalizeTeamIdentity(value) {
  return (value == null ? '' : String(value))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NORMALIZED_ALIASES = CURRENT_CLUB.aliases.map(normalizeTeamIdentity)

export function isCurrentClubName(value) {
  const normalized = normalizeTeamIdentity(value)
  if (!normalized) return false
  return NORMALIZED_ALIASES.some(alias =>
    normalized === alias || normalized.startsWith(`${alias} `)
  )
}

export function isCurrentClubCode(value) {
  return normalizeTeamIdentity(value) === CURRENT_CLUB.code
}

export function isCurrentClubIdentity(team, code) {
  return isCurrentClubName(team) || isCurrentClubCode(code)
}
