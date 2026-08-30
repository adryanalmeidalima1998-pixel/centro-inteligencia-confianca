/**
 * Catálogo completo de ligas e copas monitoradas pelo Centro de Inteligência · Confiança
 * slug: identificador único para URLs e banco de dados
 */
export const LEAGUES = [
  // ─── MERCADO INTERNACIONAL ─────────────────────────────────────────────────
  {
    slug: 'brasileiros-no-exterior',
    nome: 'Brasileiros no Exterior',
    pais: 'Exterior',
    bandeira: '🌍',
    tipo: 'liga',
    continente: 'Mercado Internacional',
    cor: '#0F766E',
    fontes: ['sportsbase', 'wyscout'],
    descricao: 'Base dedicada a atletas brasileiros que atuam fora das competições já cadastradas no CIC.',
    orientacaoUpload: 'Envie uma planilha Sportsbase ou Wyscout já filtrada com brasileiros que não estejam nas demais ligas cadastradas.',
  },

  // ─── BRASIL ─────────────────────────────────────────────────────────────────
  { slug: 'brasileirao-serie-a',   nome: 'Brasileirão Série A',   pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#009C3B' },
  { slug: 'brasileirao-serie-b',   nome: 'Brasileirão Série B',   pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#009C3B' },
  { slug: 'brasileirao-serie-c',   nome: 'Brasileirão Série C',   pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#009C3B' },
  { slug: 'brasileirao-serie-d',   nome: 'Brasileirão Série D',   pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#009C3B' },
  { slug: 'paulista-a1',           nome: 'Campeonato Paulista A1', pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#E30000' },
  { slug: 'paulista-a2',           nome: 'Campeonato Paulista A2', pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#E30000' },
  { slug: 'paulista-a3',           nome: 'Campeonato Paulista A3', pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#E30000' },
  { slug: 'paulista-sub20',        nome: 'Campeonato Paulista Sub-20', pais: 'Brasil', bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#E30000' },
  { slug: 'brasileiro-sub20',      nome: 'Campeonato Brasileiro Sub-20', pais: 'Brasil', bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#009C3B' },
  { slug: 'brasileiro-sub17',      nome: 'Campeonato Brasileiro Sub-17', pais: 'Brasil', bandeira: '🇧🇷', tipo: 'liga', continente: 'América do Sul', cor: '#009C3B' },
  { slug: 'copa-do-brasil',        nome: 'Copa do Brasil',        pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'copa', continente: 'América do Sul', cor: '#FFDF00' },
  { slug: 'copa-paulista',         nome: 'Copa Paulista',         pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'copa', continente: 'América do Sul', cor: '#E30000' },
  { slug: 'copa-do-nordeste',      nome: 'Copa do Nordeste',      pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'copa', continente: 'América do Sul', cor: '#FF6B00' },
  { slug: 'copa-brasil-sub20',     nome: 'Copa do Brasil Sub-20', pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'copa', continente: 'América do Sul', cor: '#FFDF00' },
  { slug: 'copa-brasil-sub17',     nome: 'Copa do Brasil Sub-17', pais: 'Brasil',   bandeira: '🇧🇷', tipo: 'copa', continente: 'América do Sul', cor: '#FFDF00' },

  // ─── ARGENTINA ──────────────────────────────────────────────────────────────
  { slug: 'liga-profesional-arg',  nome: 'Liga Profesional de Fútbol', pais: 'Argentina', bandeira: '🇦🇷', tipo: 'liga', continente: 'América do Sul', cor: '#74ACDF' },
  { slug: 'primera-nacional-arg',  nome: 'Primera Nacional',      pais: 'Argentina', bandeira: '🇦🇷', tipo: 'liga', continente: 'América do Sul', cor: '#74ACDF' },
  { slug: 'primera-division-arg',  nome: 'Primera División Argentina', pais: 'Argentina', bandeira: '🇦🇷', tipo: 'liga', continente: 'América do Sul', cor: '#74ACDF' },
  { slug: 'copa-argentina',        nome: 'Copa Argentina',        pais: 'Argentina', bandeira: '🇦🇷', tipo: 'copa', continente: 'América do Sul', cor: '#74ACDF' },

  // ─── COLÔMBIA ───────────────────────────────────────────────────────────────
  { slug: 'liga-betplay',          nome: 'Liga BetPlay Dimayor',  pais: 'Colômbia', bandeira: '🇨🇴', tipo: 'liga', continente: 'América do Sul', cor: '#FCD116' },
  { slug: 'torneo-betplay',        nome: 'Torneo BetPlay Dimayor', pais: 'Colômbia', bandeira: '🇨🇴', tipo: 'liga', continente: 'América do Sul', cor: '#FCD116' },
  { slug: 'copa-betplay',          nome: 'Copa BetPlay Dimayor',  pais: 'Colômbia', bandeira: '🇨🇴', tipo: 'copa', continente: 'América do Sul', cor: '#FCD116' },

  // ─── EQUADOR ────────────────────────────────────────────────────────────────
  { slug: 'ligapro-ecuador',       nome: 'LigaPro Ecuador',       pais: 'Equador',  bandeira: '🇪🇨', tipo: 'liga', continente: 'América do Sul', cor: '#FFD100' },
  { slug: 'ligapro-serie-b-ecu',   nome: 'LigaPro Serie B',       pais: 'Equador',  bandeira: '🇪🇨', tipo: 'liga', continente: 'América do Sul', cor: '#FFD100' },
  { slug: 'supercopa-equador',     nome: 'Supercopa do Equador',  pais: 'Equador',  bandeira: '🇪🇨', tipo: 'copa', continente: 'América do Sul', cor: '#FFD100' },
  { slug: 'copa-equador',          nome: 'Copa do Equador',       pais: 'Equador',  bandeira: '🇪🇨', tipo: 'copa', continente: 'América do Sul', cor: '#FFD100' },

  // ─── URUGUAI ────────────────────────────────────────────────────────────────
  { slug: 'primera-division-uru',  nome: 'Campeonato Uruguaio Primera División', pais: 'Uruguai', bandeira: '🇺🇾', tipo: 'liga', continente: 'América do Sul', cor: '#5EB6E4' },
  { slug: 'segunda-division-uru',  nome: 'Campeonato Uruguaio Segunda División', pais: 'Uruguai', bandeira: '🇺🇾', tipo: 'liga', continente: 'América do Sul', cor: '#5EB6E4' },

  // ─── CHILE ──────────────────────────────────────────────────────────────────
  { slug: 'copa-chile',            nome: 'Copa Chile',            pais: 'Chile',    bandeira: '🇨🇱', tipo: 'copa', continente: 'América do Sul', cor: '#D52B1E' },

  // ─── PARAGUAI ───────────────────────────────────────────────────────────────
  { slug: 'division-paraguaya',    nome: 'División Profesional Paraguaya', pais: 'Paraguai', bandeira: '🇵🇾', tipo: 'liga', continente: 'América do Sul', cor: '#D52B1E' },
  { slug: 'copa-paraguay',         nome: 'Copa Paraguay',         pais: 'Paraguai', bandeira: '🇵🇾', tipo: 'copa', continente: 'América do Sul', cor: '#D52B1E' },

  // ─── PERU ───────────────────────────────────────────────────────────────────
  { slug: 'liga-1-peru',           nome: 'Liga 1 Peru',           pais: 'Peru',     bandeira: '🇵🇪', tipo: 'liga', continente: 'América do Sul', cor: '#D91023' },
  { slug: 'copa-peru',             nome: 'Copa Peru',             pais: 'Peru',     bandeira: '🇵🇪', tipo: 'copa', continente: 'América do Sul', cor: '#D91023' },

  // ─── MÉXICO ─────────────────────────────────────────────────────────────────
  { slug: 'liga-mx',               nome: 'Liga MX',               pais: 'México',   bandeira: '🇲🇽', tipo: 'liga', continente: 'América do Norte', cor: '#006847' },

  // ─── PORTUGAL ───────────────────────────────────────────────────────────────
  { slug: 'primeira-liga-por',     nome: 'Primeira Liga',         pais: 'Portugal', bandeira: '🇵🇹', tipo: 'liga', continente: 'Europa', cor: '#D21034' },
  { slug: 'liga-portugal-2',       nome: 'Liga Portugal 2',       pais: 'Portugal', bandeira: '🇵🇹', tipo: 'liga', continente: 'Europa', cor: '#D21034' },
  { slug: 'taca-de-portugal',      nome: 'Taça de Portugal',      pais: 'Portugal', bandeira: '🇵🇹', tipo: 'copa', continente: 'Europa', cor: '#D21034' },
  { slug: 'taca-da-liga-por',      nome: 'Taça da Liga',          pais: 'Portugal', bandeira: '🇵🇹', tipo: 'copa', continente: 'Europa', cor: '#D21034' },
]

// Helpers
export function getLeague(slug) {
  return LEAGUES.find(l => l.slug === slug) || null
}

export function getLeaguesByContinent() {
  const map = {}
  for (const l of LEAGUES) {
    if (!map[l.continente]) map[l.continente] = {}
    if (!map[l.continente][l.pais]) map[l.continente][l.pais] = []
    map[l.continente][l.pais].push(l)
  }
  return map
}

export function getLeaguesByCountry(pais) {
  return LEAGUES.filter(l => l.pais === pais)
}
