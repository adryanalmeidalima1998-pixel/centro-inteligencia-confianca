const TEAM_ALIASES = new Map([
  ['inter limeira', 'inter de limeira'],
  ['internacional de limeira', 'inter de limeira'],
  ['aa internacional de limeira', 'inter de limeira'],
  ['associacao atletica internacional de limeira', 'inter de limeira'],
  ['botafogo paraiba', 'botafogo pb'],
  ['botafogo futebol clube pb', 'botafogo pb'],
  ['botafogo fc pb', 'botafogo pb'],
  ['botafogo fc', 'botafogo pb'],
  ['ypiranga rs', 'ypiranga erechim'],
  ['ypiranga futebol clube', 'ypiranga erechim'],
  ['ypiranga fc', 'ypiranga erechim'],
  ['floresta', 'floresta ec'],
  ['floresta esporte clube', 'floresta ec'],
  ['floresta ce', 'floresta ec'],
  ['barra sc', 'barra'],
  ['barra futebol clube sc', 'barra'],
  ['barra fc sc', 'barra'],
  ['barra fc', 'barra'],
  ['brusque futebol clube sc', 'brusque'],
  ['brusque fc', 'brusque'],
  ['paysandu sport club', 'paysandu'],
  ['paysandu sc', 'paysandu'],
  ['santa cruz futebol clube', 'santa cruz'],
  ['santa cruz fc', 'santa cruz'],
  ['santa cruz pe', 'santa cruz'],
  ['amazonas futebol clube', 'amazonas'],
  ['amazonas fc', 'amazonas'],
  ['ser caxias do sul', 'caxias'],
  ['sociedade esportiva e recreativa caxias do sul', 'caxias'],
  ['caxias rs', 'caxias'],
  ['associacao ferroviaria de esportes', 'ferroviaria'],
  ['ferroviaria sp', 'ferroviaria'],
  ['maringa futebol clube', 'maringa'],
  ['maringa fc', 'maringa'],
  ['maranhao atletico clube', 'maranhao'],
  ['maranhao ac', 'maranhao'],
  ['figueirense futebol clube', 'figueirense'],
  ['figueirense fc', 'figueirense'],
  ['ituano futebol clube', 'ituano'],
  ['ituano fc', 'ituano'],
  ['volta redonda futebol clube', 'volta redonda'],
  ['volta redonda fc', 'volta redonda'],
  ['associacao olimpica de itabaiana', 'itabaiana'],
  ['ao itabaiana', 'itabaiana'],
  ['itabaiana se', 'itabaiana'],
  ['anapolis futebol clube', 'anapolis'],
  ['anapolis fc', 'anapolis'],
  ['associacao desportiva confianca', 'confianca'],
  ['ad confianca', 'confianca'],
  ['confianca se', 'confianca'],
])

export function normalizeSerieCTeamKey(value) {
  const key = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return TEAM_ALIASES.get(key) || key
}
