/**
 * Mapeamento das colunas do export Team Stats do Wyscout (PT)
 * Estrutura: colunas agrupadas (ex: "Remates / à baliza" + Unnamed:9 + Unnamed:10)
 */

/**
 * Parseia uma linha do TeamStats do Wyscout.
 * O export tem colunas "multiplas" (ex: Remates/à baliza tem 3 sub-colunas):
 *   col_principal, Unnamed:N, Unnamed:N+1
 * A posição exata no array de colunas é usada para mapear.
 */
export function parseTeamStatsRow(row, headers) {
  if (!row || !headers) return null

  const get = (idx) => {
    const h = headers[idx]
    const v = row[h]
    if (v === undefined || v === null || v === '') return null
    const n = parseFloat(String(v).replace(',', '.'))
    return isNaN(n) ? String(v).trim() : n
  }

  return {
    // ── Identificação ──────────────────────────────────────────────────
    data:        get(0) ? String(get(0)).substring(0, 10) : null,
    jogo:        get(1),
    competicao:  get(2),
    duracao:     get(3),
    equipa:      get(4),
    sistema:     get(5),

    // ── Produção ───────────────────────────────────────────────────────
    gols:         get(6),
    xg:           get(7),

    // Remates / à baliza / % (cols 8, 9, 10)
    remates:      get(8),
    remates_alvo: get(9),
    remates_pct:  get(10),

    // Passes / certos / % (11, 12, 13)
    passes:       get(11),
    passes_certos: get(12),
    passes_pct:   get(13),

    posse:        get(14),

    // Perdas / curto / médio / longo (15, 16, 17, 18)
    perdas:       get(15),
    perdas_curto: get(16),
    perdas_medio: get(17),
    perdas_longo: get(18),

    // Recuperações / curto / médio / longo (19, 20, 21, 22)
    recuperacoes:       get(19),
    recuperacoes_curto: get(20),
    recuperacoes_medio: get(21),
    recuperacoes_longo: get(22),

    // Duelos / ganhos / % (23, 24, 25)
    duelos:       get(23),
    duelos_ganhos: get(24),
    duelos_pct:   get(25),

    // Remates fora área / alvo / % (26, 27, 28)
    remates_fora_area: get(26),
    remates_fora_area_alvo: get(27),
    remates_fora_area_pct: get(28),

    // Ataques posicionais / com remates / % (29, 30, 31)
    ataques_pos:       get(29),
    ataques_pos_rem:   get(30),
    ataques_pos_pct:   get(31),

    // Contra-ataques / com remates / % (32, 33, 34)
    contra_ataques:     get(32),
    contra_ataques_rem: get(33),
    contra_ataques_pct: get(34),

    // Bolas paradas / com remates / % (35, 36, 37)
    bolas_paradas:     get(35),
    bolas_paradas_rem: get(36),
    bolas_paradas_pct: get(37),

    // Cantos / com remates / % (38, 39, 40)
    cantos:     get(38),
    cantos_rem: get(39),
    cantos_pct: get(40),

    // Livres / com remates / % (41, 42, 43)
    livres:     get(41),
    livres_rem: get(42),
    livres_pct: get(43),

    // Penaltis / convertidos / % (44, 45, 46)
    penaltis:       get(44),
    penaltis_conv:  get(45),
    penaltis_pct:   get(46),

    // Cruzamentos / certos / % (47, 48, 49)
    cruzamentos:     get(47),
    cruzamentos_certos: get(48),
    cruzamentos_pct: get(49),

    cruzamentos_prof:    get(50),
    passes_prof_receb:   get(51),

    // Entradas grande área (corridas/cruzamentos) (52, 53, 54)
    entradas_area:     get(52),
    entradas_corridas: get(53),
    entradas_cruzamentos: get(54),

    toques_area:  get(55),

    // Duelos ofensivos / ganhos / % (56, 57, 58)
    duelos_of:      get(56),
    duelos_of_gan:  get(57),
    duelos_of_pct:  get(58),

    foras_jogo:  get(59),

    // Defesa
    gols_sofridos:  get(60),

    // Remates contra / alvo / % (61, 62, 63)
    remates_contra:     get(61),
    remates_contra_alvo: get(62),
    remates_contra_pct: get(63),

    // Duelos defensivos / ganhos / % (64, 65, 66)
    duelos_def:     get(64),
    duelos_def_gan: get(65),
    duelos_def_pct: get(66),

    // Duelos aéreos / ganhos / % (67, 68, 69)
    duelos_aereos:     get(67),
    duelos_aereos_gan: get(68),
    duelos_aereos_pct: get(69),

    // Carrinhos / bem sucedidos / % (70, 71, 72)
    carrinhos:     get(70),
    carrinhos_ok:  get(71),
    carrinhos_pct: get(72),

    intercecoes: get(73),
    aliviamentos: get(74),
    faltas:      get(75),
    amarelos:    get(76),
    vermelhos:   get(77),

    // Passes para a frente / certos / % (78, 79, 80)
    passes_frente:     get(78),
    passes_frente_ok:  get(79),
    passes_frente_pct: get(80),

    // Passes para trás / certos / % (81, 82, 83)
    passes_tras:     get(81),
    passes_tras_ok:  get(82),
    passes_tras_pct: get(83),

    // Passes laterais / certos / % (84, 85, 86)
    passes_lat:     get(84),
    passes_lat_ok:  get(85),
    passes_lat_pct: get(86),

    // Passes longos / certos / % (87, 88, 89)
    passes_longos:     get(87),
    passes_longos_ok:  get(88),
    passes_longos_pct: get(89),

    // Passes terço final / certos / % (90, 91, 92)
    passes_tfl:     get(90),
    passes_tfl_ok:  get(91),
    passes_tfl_pct: get(92),

    // Passes progressivos / precisos / % (93, 94, 95)
    passes_prog:     get(93),
    passes_prog_ok:  get(94),
    passes_prog_pct: get(95),

    // Passes inteligentes / certos / % (96, 97, 98)
    passes_intelig:     get(96),
    passes_intelig_ok:  get(97),
    passes_intelig_pct: get(98),

    // Lançamentos / certos / % (99, 100, 101)
    lancamentos:     get(99),
    lancamentos_ok:  get(100),
    lancamentos_pct: get(101),

    pontapes_baliza: get(102),
    intensidade:     get(103),
    passes_por_posse: get(104),
    pct_passe_longo: get(105),
    dist_media_remate: get(106),
    comp_medio_passe: get(107),
    ppda:            get(108),
  }
}

/**
 * Labels legíveis para cada métrica do TeamStats
 */
export const TEAM_METRIC_LABELS = {
  gols:              'Gols',
  xg:                'xG',
  gols_sofridos:     'Gols Sofridos',
  remates:           'Remates',
  remates_alvo:      'Remates no Alvo',
  remates_pct:       'Remates no Alvo %',
  passes:            'Passes',
  passes_certos:     'Passes Certos',
  passes_pct:        'Precisão de Passe %',
  posse:             'Posse %',
  ppda:              'PPDA',
  intensidade:       'Intensidade',
  duelos:            'Duelos',
  duelos_pct:        'Duelos %',
  duelos_aereos:     'Duelos Aéreos',
  duelos_aereos_pct: 'Duelos Aéreos %',
  ataques_pos:       'Ataques Posicionais',
  contra_ataques:    'Contra-Ataques',
  bolas_paradas:     'Bolas Paradas',
  cantos:            'Cantos',
  cruzamentos:       'Cruzamentos',
  cruzamentos_pct:   'Cruzamentos %',
  intercecoes:       'Interceções',
  carrinhos:         'Carrinhos',
  faltas:            'Faltas',
  amarelos:          'Amarelos',
  vermelhos:         'Vermelhos',
  passes_prog:       'Passes Progressivos',
  passes_tfl:        'Passes Terço Final',
  toques_area:       'Toques na Área',
  passes_por_posse:  'Passes por Posse',
  dist_media_remate: 'Distância Média Remate',
}

/**
 * Grupos de métricas do TeamStats para exibição
 */
export const TEAM_STAT_GROUPS = [
  {
    id: 'producao',
    label: '⚽ Produção',
    cor: '#16a34a',
    metricas: ['gols', 'xg', 'remates', 'remates_alvo', 'remates_pct', 'ataques_pos', 'contra_ataques', 'toques_area'],
  },
  {
    id: 'passe',
    label: '📮 Passe',
    cor: '#0369a1',
    metricas: ['passes', 'passes_certos', 'passes_pct', 'passes_prog', 'passes_tfl', 'passes_por_posse', 'ppda'],
  },
  {
    id: 'posse',
    label: '🔵 Posse',
    cor: '#0891b2',
    metricas: ['posse', 'perdas', 'recuperacoes', 'intensidade'],
  },
  {
    id: 'bolas_paradas',
    label: '⚡ Bolas Paradas',
    cor: '#d97706',
    metricas: ['bolas_paradas', 'cantos', 'livres', 'penaltis', 'cruzamentos', 'cruzamentos_pct'],
  },
  {
    id: 'defesa',
    label: '🛡️ Defesa',
    cor: '#1e40af',
    metricas: ['gols_sofridos', 'remates_contra', 'remates_contra_pct', 'duelos_def', 'duelos_def_pct', 'intercecoes', 'carrinhos', 'aliviamentos'],
  },
  {
    id: 'duelos',
    label: '💪 Duelos',
    cor: '#7c3aed',
    metricas: ['duelos', 'duelos_pct', 'duelos_aereos', 'duelos_aereos_pct', 'duelos_of', 'duelos_of_pct'],
  },
  {
    id: 'disciplina',
    label: '🟨 Disciplina',
    cor: '#ca8a04',
    metricas: ['faltas', 'amarelos', 'vermelhos', 'foras_jogo'],
  },
]
