export function encodePlayerKey(player = {}) {
  return encodeURIComponent(`${String(player.nome || '').trim()}|||${String(player.equipa || '').trim()}`)
}

export function decodePlayerKey(value = '') {
  let decoded = String(value || '')
  try { decoded = decodeURIComponent(decoded) } catch (_) {}
  const [nome = '', equipa = ''] = decoded.split('|||')
  return { nome, equipa }
}

export function playerProfilePath(slug, player) {
  return `/ligas-v2/${slug}/jogadores/${encodePlayerKey(player)}`
}
