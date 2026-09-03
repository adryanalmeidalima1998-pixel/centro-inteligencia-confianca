const normalizePlayerName = value => String(value || '')
  .toLowerCase()
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')

const normalizeIdentityValue = value => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const numberOrNull = value => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function seasonYear(season) {
  const match = String(season || '').match(/20\d{2}/)
  return match ? Number(match[0]) : new Date().getFullYear()
}

export function buildPlayerIdentity(player = {}, season = '') {
  const name = normalizePlayerName(player.nome || player.jogador || player.Jogador)
  const birthDateRaw = player.data_nascimento || player.nascimento || player.birth_date || player['Data de nascimento'] || ''

  let birthDate = null
  if (birthDateRaw) {
    const parsed = new Date(birthDateRaw)
    if (Number.isFinite(parsed.getTime())) birthDate = parsed.toISOString().slice(0, 10)
  }

  const year = seasonYear(season || player.temporada)
  const age = numberOrNull(player.idade)
  const birthYear = numberOrNull(player.ano_nascimento) ?? (age ? year - age : null)
  const nationality = normalizeIdentityValue(player.pais || player.nacionalidade || player.nationality)
  const position = normalizeIdentityValue(String(player.posicao || '').split(',')[0])
  const stable = birthDate || (birthYear ? String(birthYear) : '')
  const identityKey = stable
    ? [name, stable].join('|')
    : [name, nationality || 'na', position || 'na'].join('|')

  return { identityKey, name, birthDate, birthYear, nationality }
}
