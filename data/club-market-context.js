import { getLeague } from '@/data/leagues'

/**
 * Contexto esportivo e de mercado do Confiança.
 *
 * A função desta camada não é afirmar que um atleta pode ou não ser contratado.
 * Ela impede que o dashboard trate mercados estruturalmente incompatíveis como
 * prioridades automáticas para um clube que planeja a Série D de 2027 com objetivo de acesso à Série C.
 * Os casos fora do núcleo permanecem disponíveis nas páginas das ligas, mas
 * entram no Decision Room apenas quando atendem às regras de exceção.
 */
export const CLUB_COMPETITIVE_CONTEXT = {
  club: 'Confiança',
  currentCompetition: 'Planejamento 2027 · Brasileirão Série D',
  objective: 'Acesso ao Brasileirão Série C',
  season: 2027,
  policyVersion: 'serie-d-acesso-c-v1',
  immediateHorizon: 'Janela atual e próxima temporada',
  principles: [
    'Priorizar mercados com viabilidade esportiva e financeira para a Série D/Série C.',
    'Separar desempenho estatístico de acessibilidade de mercado.',
    'Não priorizar automaticamente atletas de primeiras divisões estruturalmente distantes.',
    'Usar grandes clubes sul-americanos apenas como referência, salvo empréstimo ou oportunidade contratual clara.',
    'Manter projetos de formação separados das soluções imediatas para o acesso.',
  ],
}

const POLICY = {
  core: {
    band: 'A',
    label: 'Núcleo imediato',
    score: 100,
    multiplier: 1,
    actionable: true,
    horizon: 'immediate',
  },
  compatible: {
    band: 'B',
    label: 'Mercado compatível',
    score: 90,
    multiplier: 0.95,
    actionable: true,
    horizon: 'immediate',
  },
  conditional: {
    band: 'C',
    label: 'Oportunidade condicionada',
    score: 78,
    multiplier: 0.88,
    actionable: true,
    horizon: 'immediate',
  },
  loan: {
    band: 'E',
    label: 'Empréstimo / ocasião',
    score: 68,
    multiplier: 0.82,
    actionable: true,
    horizon: 'immediate',
  },
  development: {
    band: 'P',
    label: 'Projeto de desenvolvimento',
    score: 72,
    multiplier: 0.82,
    actionable: true,
    horizon: 'development',
  },
  reference: {
    band: 'R',
    label: 'Somente referência',
    score: 0,
    multiplier: 0,
    actionable: false,
    horizon: 'reference',
  },
}

const EXPLICIT_POLICIES = {
  'brasileiros-no-exterior': {
    ...POLICY.conditional,
    score: 74,
    multiplier: 0.85,
    maxAge: 29,
    reason: 'Base ampla de brasileiros no exterior; entra como oportunidade condicionada ao nível da liga, custo, contrato e viabilidade de retorno.',
  },

  // Brasil — base principal para um clube em Série D com ambição de acesso à Série C.
  'brasileirao-serie-a': { ...POLICY.loan, mode: 'young-low-minutes', maxAge: 23, maxMinutes: 900, blockGiants: true, reason: 'Série A apenas para jovens com baixa minutagem, empréstimo ou ocasião contratual, fora dos clubes de maior poder.' },
  'brasileirao-serie-b': { ...POLICY.conditional, score: 80, multiplier: 0.88, maxAge: 29, blockGiants: true, reason: 'Mercado acima do contexto imediato; priorizar oportunidades contratuais, empréstimos e atletas com baixa minutagem.' },
  'brasileirao-serie-c': { ...POLICY.core, score: 100, multiplier: 1, maxAge: 31, blockGiants: true, reason: 'Divisão-alvo do projeto 2027; principal referência de nível, adaptação e prontidão competitiva.' },
  'brasileirao-serie-d': { ...POLICY.core, score: 99, multiplier: 1, maxAge: 31, blockGiants: true, reason: 'Mesmo contexto competitivo projetado para 2027; máxima comparabilidade e adaptação imediata.' },
  'paulista-a1': { ...POLICY.compatible, score: 94, multiplier: 0.97, maxAge: 31, blockGiants: true, reason: 'Mercado estadual conhecido, com adaptação e observação facilitadas.' },
  'paulista-a2': { ...POLICY.core, score: 98, multiplier: 0.99, maxAge: 31, blockGiants: true, reason: 'Mercado estadual de alta viabilidade e bom histórico de transição.' },
  'paulista-a3': { ...POLICY.compatible, score: 92, multiplier: 0.96, maxAge: 29, blockGiants: true, reason: 'Mercado de prospecção e valorização com baixa barreira de adaptação.' },
  'copa-paulista': { ...POLICY.compatible, score: 91, multiplier: 0.95, maxAge: 28, blockGiants: true, reason: 'Competição regional útil para profundidade, jovens e oportunidades.' },
  'copa-do-nordeste': { ...POLICY.compatible, score: 96, multiplier: 0.98, maxAge: 31, reason: 'Mercado regional prioritário, com adaptação logística e competitiva direta ao contexto do Confiança.' },
  'paulista-sub20': { ...POLICY.development, maxAge: 20, blockGiants: true, reason: 'Projeto de formação; não deve competir com soluções imediatas no ranking principal.' },
  'brasileiro-sub20': { ...POLICY.development, maxAge: 20, blockGiants: true, reason: 'Projeto de formação e antecipação de mercado.' },
  'brasileiro-sub17': { ...POLICY.reference, reason: 'Faixa de formação distante da necessidade esportiva imediata.' },

  // Argentina — Primera Nacional é plausível; primeira divisão não deve liderar a triagem.
  'primera-nacional-arg': { ...POLICY.compatible, score: 88, multiplier: 0.94, maxAge: 28, reason: 'Segunda divisão argentina com nível e custo mais compatíveis.' },
  'liga-profesional-arg': { ...POLICY.reference, reason: 'Primeira divisão argentina fora do universo automático de prioridade do Confiança.' },
  'primera-division-arg': { ...POLICY.reference, reason: 'Primeira divisão argentina fora do universo automático de prioridade do Confiança.' },
  'copa-argentina': { ...POLICY.reference, reason: 'Copa com mistura de níveis e duplicidade; usada apenas como referência.' },

  // Colômbia.
  'liga-betplay': { ...POLICY.conditional, score: 76, multiplier: 0.87, maxAge: 27, blockGiants: true, reason: 'Primeira divisão colombiana apenas em clubes acessíveis e perfis de oportunidade.' },
  'torneo-betplay': { ...POLICY.compatible, score: 88, multiplier: 0.94, maxAge: 28, blockGiants: true, reason: 'Segunda divisão colombiana com boa relação entre nível, idade e acessibilidade, exceto grandes estruturas.' },
  'copa-betplay': { ...POLICY.reference, reason: 'Copa usada como referência, evitando duplicidade com as ligas.' },

  // Equador.
  'ligapro-ecuador': { ...POLICY.conditional, score: 84, multiplier: 0.91, maxAge: 28, blockGiants: true, reason: 'Primeira divisão equatoriana é viável fora dos clubes de maior poder.' },
  'ligapro-serie-b-ecu': { ...POLICY.compatible, score: 90, multiplier: 0.95, maxAge: 29, reason: 'Segunda divisão equatoriana com boa acessibilidade de mercado.' },
  'supercopa-equador': { ...POLICY.reference, reason: 'Competição de referência, concentrada nos clubes de maior poder.' },
  'copa-equador': { ...POLICY.reference, reason: 'Copa usada como referência, evitando duplicidade.' },

  // Uruguai.
  'primera-division-uru': { ...POLICY.conditional, score: 84, multiplier: 0.91, maxAge: 28, blockGiants: true, reason: 'Primeira divisão uruguaia é viável fora de Nacional e Peñarol.' },
  'segunda-division-uru': { ...POLICY.compatible, score: 91, multiplier: 0.95, maxAge: 29, reason: 'Mercado uruguaio de boa formação e acessibilidade.' },

  // Paraguai e Peru — oportunidade, não núcleo.
  'division-paraguaya': { ...POLICY.conditional, score: 78, multiplier: 0.88, maxAge: 28, blockGiants: true, reason: 'Mercado condicionado a clubes acessíveis e contexto contratual.' },
  'copa-paraguay': { ...POLICY.reference, reason: 'Copa usada como referência.' },
  'liga-1-peru': { ...POLICY.conditional, score: 76, multiplier: 0.87, maxAge: 28, blockGiants: true, reason: 'Mercado condicionado a clubes acessíveis e perfis de oportunidade.' },
  'copa-peru': { ...POLICY.reference, reason: 'Copa usada como referência.' },

  // Portugal — segunda divisão pode gerar exceções; primeira divisão não entra automaticamente.
  'primeira-liga-por': { ...POLICY.reference, reason: 'Primeira Liga portuguesa fora da realidade automática de contratação do Confiança.' },
  'liga-portugal-2': { ...POLICY.conditional, score: 70, multiplier: 0.83, maxAge: 26, blockGiants: true, reason: 'Somente jovens, retornos ou oportunidades específicas da segunda divisão portuguesa.' },
  'taca-de-portugal': { ...POLICY.reference, reason: 'Copa usada apenas como referência.' },
  'taca-da-liga-por': { ...POLICY.reference, reason: 'Copa usada apenas como referência.' },

  // México — barreira econômica alta para o contexto atual.
  'liga-mx': { ...POLICY.reference, reason: 'Barreira econômica e contratual incompatível com a priorização automática atual.' },
}

const BIG_CLUBS = {
  brasil: [
    ['palmeiras', 'se palmeiras'],
    ['flamengo', 'cr flamengo'],
    ['corinthians', 'sc corinthians paulista'],
    ['sao paulo', 'sao paulo fc'],
    ['atletico mineiro', 'atletico mg'],
    ['cruzeiro', 'cruzeiro ec'],
    ['gremio', 'gremio fbpa'],
    ['internacional', 'sc internacional'],
    ['fluminense', 'fluminense fc'],
    ['botafogo', 'botafogo fr'],
    ['vasco da gama', 'vasco'],
    ['santos', 'santos fc'],
    ['athletico paranaense', 'athletico pr'],
  ],
  chile: [
    ['colo colo'],
    ['universidad de chile', 'u de chile'],
    ['universidad catolica', 'u catolica'],
  ],
  equador: [
    ['independiente del valle', 'ind del valle'],
    ['liga de quito', 'ldu quito', 'ldu'],
    ['barcelona sc', 'barcelona guayaquil'],
    ['emelec'],
  ],
  uruguai: [
    ['penarol', 'club atletico penarol'],
    ['nacional', 'club nacional de football'],
  ],
  colombia: [
    ['atletico nacional'],
    ['millonarios'],
    ['junior barranquilla', 'atletico junior', 'junior fc'],
    ['america de cali'],
  ],
  paraguai: [
    ['olimpia'],
    ['cerro porteno'],
    ['libertad'],
  ],
  peru: [
    ['alianza lima'],
    ['universitario'],
    ['sporting cristal'],
  ],
  portugal: [
    ['sl benfica', 'benfica b'],
    ['fc porto', 'porto b'],
    ['sporting cp', 'sporting clube de portugal', 'sporting b'],
    ['sc braga', 'braga b'],
  ],
}

function text(value) { return String(value ?? '').trim() }
export function normalizeMarketText(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export const OWN_CLUB_ALIASES = [
  'confianca',
  'ad confianca',
  'associacao desportiva confianca',
  'confianca se',
  'associacao desportiva confianca se',
]

/** Identifica a Associação Desportiva Confiança (Aracaju/SE), sem confundir clubes adversários. */
export function isOwnClub(value) {
  const normalized = normalizeMarketText(value)
  if (!normalized) return false
  if (OWN_CLUB_ALIASES.includes(normalized)) return true
  return /^(?:ad |associacao desportiva )?confianca(?: se)?(?: sub ?\d{2}| u ?\d{2}| b)?$/.test(normalized)
}
function num(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }

function inferCountry(slug, league) {
  if (league?.pais) return normalizeMarketText(league.pais)
  const value = normalizeMarketText(slug)
  if (/brasil|brasileir|paulista|nordeste|serie [abcd]/.test(value)) return 'brasil'
  if (/arg|liga profesional|primera nacional/.test(value)) return 'argentina'
  if (/chile/.test(value)) return 'chile'
  if (/ecu|ecuador/.test(value)) return 'equador'
  if (/uru|uruguai/.test(value)) return 'uruguai'
  if (/venezuela|futve/.test(value)) return 'venezuela'
  if (/colombia|betplay/.test(value)) return 'colombia'
  if (/paragu/.test(value)) return 'paraguai'
  if (/peru/.test(value)) return 'peru'
  if (/portugal| por$|primeira liga|taca da liga|taca de portugal/.test(value)) return 'portugal'
  if (/mex|mx/.test(value)) return 'mexico'
  return ''
}

function genericPolicy(slug, league) {
  const normalized = normalizeMarketText(`${slug} ${league?.nome || ''}`)
  const country = inferCountry(slug, league)
  if (/copa|taca|supercopa/.test(normalized)) return { ...POLICY.reference, reason: 'Competição de copa mantida como referência para evitar duplicidade de mercado.' }
  if (/sub 17|u17/.test(normalized)) return { ...POLICY.reference, reason: 'Faixa de formação distante da necessidade imediata.' }
  if (/sub 20|u20/.test(normalized)) return { ...POLICY.development, maxAge: 20, reason: 'Projeto de desenvolvimento separado das soluções imediatas.' }
  if (/serie a/.test(normalized) && country === 'brasil') return { ...POLICY.loan, mode: 'young-low-minutes', maxAge: 23, maxMinutes: 900, blockGiants: true, reason: 'Série A apenas para empréstimo, jovem sem espaço ou ocasião contratual, fora dos clubes de maior poder.' }
  if (/serie b/.test(normalized) && country === 'brasil') return { ...POLICY.conditional, score: 80, multiplier: 0.88, maxAge: 29, blockGiants: true, reason: 'Mercado acima do contexto imediato; priorizar oportunidades contratuais, empréstimos e baixa minutagem.' }
  if (/serie c/.test(normalized) && country === 'brasil') return { ...POLICY.core, maxAge: 31, blockGiants: true, reason: 'Divisão-alvo do projeto; principal referência de nível, adaptação e prontidão competitiva.' }
  if (/serie d/.test(normalized) && country === 'brasil') return { ...POLICY.core, score: 99, multiplier: 1, maxAge: 31, blockGiants: true, reason: 'Mesmo contexto competitivo projetado para 2027; máxima comparabilidade e adaptação imediata.' }
  if (/paulista a1/.test(normalized)) return { ...POLICY.compatible, score: 94, multiplier: 0.97, maxAge: 31, blockGiants: true, reason: 'Mercado estadual conhecido e observável.' }
  if (/paulista a2/.test(normalized)) return { ...POLICY.core, score: 98, multiplier: 0.99, maxAge: 31, blockGiants: true, reason: 'Mercado estadual de alta viabilidade.' }
  if (/paulista a3/.test(normalized)) return { ...POLICY.compatible, score: 92, multiplier: 0.96, maxAge: 29, blockGiants: true, reason: 'Mercado estadual de prospecção.' }
  if (country === 'chile') return { ...POLICY.conditional, score: 84, multiplier: 0.91, maxAge: 28, blockGiants: true, reason: 'Primeira divisão chilena é viável fora dos três grandes.' }
  if (country === 'venezuela') return { ...POLICY.compatible, score: 86, multiplier: 0.93, maxAge: 29, reason: 'Primeira divisão venezuelana é compatível como mercado de oportunidade.' }
  if (country === 'equador') return { ...POLICY.conditional, score: 82, multiplier: 0.90, maxAge: 28, blockGiants: true, reason: 'Mercado equatoriano condicionado à acessibilidade do clube.' }
  if (country === 'uruguai') return { ...POLICY.conditional, score: 82, multiplier: 0.90, maxAge: 28, blockGiants: true, reason: 'Mercado uruguaio condicionado à acessibilidade do clube.' }
  if (country === 'colombia' && /torneo|segunda/.test(normalized)) return { ...POLICY.compatible, score: 88, multiplier: 0.94, maxAge: 28, blockGiants: true, reason: 'Segunda divisão colombiana compatível, exceto grandes estruturas.' }
  if (country === 'colombia') return { ...POLICY.conditional, score: 76, multiplier: 0.87, maxAge: 27, blockGiants: true, reason: 'Primeira divisão colombiana apenas em clubes acessíveis.' }
  if (country === 'paraguai') return { ...POLICY.conditional, score: 78, multiplier: 0.88, maxAge: 28, blockGiants: true, reason: 'Mercado paraguaio condicionado a clubes acessíveis.' }
  if (country === 'peru') return { ...POLICY.conditional, score: 76, multiplier: 0.87, maxAge: 28, blockGiants: true, reason: 'Mercado peruano condicionado a clubes acessíveis.' }
  if (country === 'argentina' && /nacional|segunda|b nacional/.test(normalized)) return { ...POLICY.compatible, score: 88, multiplier: 0.94, maxAge: 28, reason: 'Segunda divisão argentina compatível.' }
  if (country === 'argentina') return { ...POLICY.reference, reason: 'Primeira divisão argentina fora da prioridade automática.' }
  if (country === 'portugal' && /segunda|liga 2/.test(normalized)) return { ...POLICY.conditional, score: 70, multiplier: 0.83, maxAge: 26, blockGiants: true, reason: 'Apenas oportunidade específica na segunda divisão portuguesa.' }
  if (country === 'portugal') return { ...POLICY.reference, reason: 'Primeira divisão portuguesa fora da prioridade automática.' }
  return { ...POLICY.reference, reason: 'Liga sem regra de viabilidade aprovada para a priorização automática.' }
}

export function getClubLeagueMarketPolicy(slug) {
  const league = getLeague(slug)
  const policy = EXPLICIT_POLICIES[slug] || genericPolicy(slug, league)
  return {
    slug,
    country: inferCountry(slug, league),
    leagueName: league?.nome || slug,
    ...policy,
  }
}

function truthyLoan(value) {
  const normalized = normalizeMarketText(value)
  return ['sim', 'yes', 'true', '1', 'emprestado', 'loan'].some(token => normalized === token || normalized.includes(token))
}

function expiryDays(value) {
  if (!value) return null
  const stamp = new Date(value).getTime()
  if (!Number.isFinite(stamp)) return null
  return Math.ceil((stamp - Date.now()) / 86400000)
}

function giantMatch(team, country) {
  const normalizedTeam = normalizeMarketText(team)
  const groups = BIG_CLUBS[country] || []
  for (const aliases of groups) {
    const match = aliases.find(alias => {
      const normalizedAlias = normalizeMarketText(alias)
      if (!normalizedAlias) return false
      if (normalizedAlias.length <= 4) return normalizedTeam === normalizedAlias || normalizedTeam.startsWith(`${normalizedAlias} `)
      return normalizedTeam.includes(normalizedAlias)
    })
    if (match) return aliases[0]
  }
  return null
}

/** Retorna a viabilidade do atleta para o contexto atual do Confiança. */
export function evaluateClubMarketContext(player = {}, leagueSlug = '') {
  const policy = getClubLeagueMarketPolicy(leagueSlug || player._liga || player.liga)
  const age = num(player.idade, 99)
  const minutes = num(player.minutos)
  const loan = truthyLoan(player.emprestado || player.loan)
  const daysToExpiry = expiryDays(player.fim_contrato || player.data_fim_contrato || player.contrato_fim)
  const contractualOpportunity = loan || (daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 180)
  const currentClub = player.equipa || player.clube || player.time_atual || player.equipe
  const ownClub = isOwnClub(currentClub)
  const giant = policy.blockGiants ? giantMatch(currentClub, policy.country) : null
  let actionable = policy.actionable
  let score = policy.score
  let multiplier = policy.multiplier
  let label = policy.label
  let band = policy.band
  let horizon = policy.horizon
  const reasons = [policy.reason]
  const cautions = []

  if (ownClub) {
    actionable = false
    score = 0
    multiplier = 0
    label = POLICY.reference.label
    band = POLICY.reference.band
    horizon = POLICY.reference.horizon
    cautions.push('Atleta vinculado ao próprio Confiança; fora do universo de prospecção externa.')
  }

  if (policy.mode === 'young-low-minutes') {
    const eligibleException = age <= num(policy.maxAge, 23) && (minutes <= num(policy.maxMinutes, 900) || contractualOpportunity)
    if (!eligibleException) {
      actionable = false
      score = 0
      multiplier = 0
      label = POLICY.reference.label
      band = POLICY.reference.band
      horizon = POLICY.reference.horizon
      cautions.push('Titular ou atleta consolidado de Série A sem sinal de empréstimo/ocasião.')
    } else {
      reasons.push('Jovem com baixa minutagem ou condição de empréstimo/ocasião.')
    }
  }

  if (giant) {
    if (contractualOpportunity) {
      actionable = true
      score = Math.min(score, POLICY.loan.score)
      multiplier = Math.min(multiplier, POLICY.loan.multiplier)
      label = POLICY.loan.label
      band = POLICY.loan.band
      reasons.push(`Exceção contratual em clube de maior poder (${giant}).`)
    } else {
      actionable = false
      score = 0
      multiplier = 0
      label = POLICY.reference.label
      band = POLICY.reference.band
      horizon = POLICY.reference.horizon
      cautions.push(`Clube de maior poder no mercado (${giant}).`)
    }
  }

  if (policy.maxAge && age > policy.maxAge) {
    actionable = false
    score = 0
    multiplier = 0
    label = POLICY.reference.label
    band = POLICY.reference.band
    horizon = POLICY.reference.horizon
    cautions.push(`Idade acima do recorte contextual deste mercado (${policy.maxAge}).`)
  }

  if (policy.horizon === 'development' && age > 20) {
    actionable = false
    score = 0
    multiplier = 0
    label = POLICY.reference.label
    band = POLICY.reference.band
    horizon = POLICY.reference.horizon
    cautions.push('Fora da faixa de projeto definida para competições de formação.')
  }

  if (contractualOpportunity && actionable && policy.band !== 'A') {
    score = Math.min(100, score + 4)
    multiplier = Math.min(1, multiplier + 0.02)
    reasons.push(loan ? 'Atleta indicado como emprestado.' : 'Contrato próximo do fim.')
  }

  return {
    policyVersion: CLUB_COMPETITIVE_CONTEXT.policyVersion,
    actionable,
    score: Math.round(score),
    multiplier,
    band,
    label,
    horizon,
    country: policy.country,
    leagueName: policy.leagueName,
    reason: reasons.filter(Boolean).join(' '),
    reasons: reasons.filter(Boolean),
    cautions,
    giantClub: giant,
    ownClub,
    contractualOpportunity,
  }
}

export function summarizeClubMarket(players = []) {
  const summary = {
    total: players.length,
    actionable: 0,
    immediate: 0,
    development: 0,
    reference: 0,
    bands: {},
  }
  for (const player of players) {
    const context = player?._market || evaluateClubMarketContext(player, player?._liga || player?.liga)
    summary.bands[context.band] = (summary.bands[context.band] || 0) + 1
    if (!context.actionable) summary.reference += 1
    else {
      summary.actionable += 1
      if (context.horizon === 'development') summary.development += 1
      else summary.immediate += 1
    }
  }
  return summary
}

export function marketContextForDashboard() {
  return {
    ...CLUB_COMPETITIVE_CONTEXT,
    primaryMarkets: ['Série B', 'Série C', 'Série D', 'Paulistas A1/A2/A3', 'segundas divisões sul-americanas'],
    conditionalMarkets: ['Chile (sem os três grandes)', 'Equador (sem os grandes)', 'Venezuela', 'Uruguai (sem Nacional e Peñarol)'],
    referenceOnly: ['Primeira Liga de Portugal', 'Primeira divisão argentina', 'Liga MX', 'grandes clubes regionais sem condição de ocasião'],
  }
}
