// lib/elenco/parseStats.js
// Client-side only — usa SheetJS (xlsx)

import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// Mapa de normalização de colunas — pt-PT, pt-BR e variações Wyscout
// ---------------------------------------------------------------------------

const TEAM_COL_MAP = {
  // Identificação
  'jogo': 'jogo', 'game': 'jogo', 'match': 'jogo', 'partida': 'jogo',
  'data': 'data', 'date': 'data',
  'competicao': 'competicao', 'competition': 'competicao', 'liga': 'competicao',
  'duracao': 'duracao', 'duration': 'duracao', 'tempo': 'duracao',
  'equipa': 'equipa', 'equipe': 'equipa', 'team': 'equipa', 'clube': 'equipa',
  'sistema': 'sistema', 'formation': 'sistema', 'formacao': 'sistema',

  // Gols
  'golos': 'golsPro', 'gols': 'golsPro', 'goals': 'golsPro',
  'gols marcados': 'golsPro', 'golos marcados': 'golsPro',
  'golos sofridos': 'golsContra', 'gols sofridos': 'golsContra',
  'gols concedidos': 'golsContra', 'goals conceded': 'golsContra',
  'gols contra': 'golsContra',

  // xG
  'xg': 'xg', 'golos esperados': 'xg', 'expected goals': 'xg',
  'xg contra': 'xgContra', 'xg concedido': 'xgContra',
  'expected goals against': 'xgContra', 'xg sofrido': 'xgContra',

  // Finalizações
  'remates': 'remates', 'shots': 'remates', 'finalizacoes': 'remates',
  'remates a baliza': 'rematesAlvo', 'remates no alvo': 'rematesAlvo',
  'shots on target': 'rematesAlvo', 'finalizacoes no alvo': 'rematesAlvo',
  'remates contra': 'rematesContra', 'shots against': 'rematesContra',
  'finalizacoes sofridas': 'rematesContra', 'remates sofridos': 'rematesContra',
  'remates contra a baliza': 'rematesContraAlvo',
  'shots on target against': 'rematesContraAlvo',

  // Posse e passes
  'posse': 'posse', 'possession': 'posse', 'posse de bola': 'posse',
  'passes': 'passes',
  'passes certos': 'passesCertos', 'accurate passes': 'passesCertos',
  'passes corretos': 'passesCertos',
  'passes longos': 'passesLongos', 'long passes': 'passesLongos',
  'passes para frente': 'passesFrente', 'forward passes': 'passesFrente',
  'passes para tras': 'passesAtras', 'backward passes': 'passesAtras',
  'passes atras': 'passesAtras',
  'passes laterais': 'passesLaterais', 'lateral passes': 'passesLaterais',
  'passes progressivos': 'passesProgressivos', 'progressive passes': 'passesProgressivos',
  'passes para terco final': 'passesTercoFinal',
  'passes para o terco final': 'passesTercoFinal',
  'passes to final third': 'passesTercoFinal',
  'passes inteligentes': 'passesInteligentes', 'smart passes': 'passesInteligentes',

  // Área
  'entradas na area': 'entradasArea', 'entries to penalty area': 'entradasArea',
  'toques na area': 'toquesArea', 'touches in penalty area': 'toquesArea',

  // Cruzamentos e ataques
  'cruzamentos': 'cruzamentos', 'crosses': 'cruzamentos',
  'cruzamentos certos': 'cruzamentosCertos', 'accurate crosses': 'cruzamentosCertos',
  'ataques posicionais': 'ataquesPositivos', 'positional attacks': 'ataquesPositivos',
  'ataques posicionais com remate': 'ataquesPositivosRemate',
  'positional attacks with shots': 'ataquesPositivosRemate',
  'contra ataques': 'contraAtaques', 'counterattacks': 'contraAtaques',
  'contra-ataques': 'contraAtaques',
  'contra ataques com remate': 'contraAtaquesRemate',
  'contra-ataques com remate': 'contraAtaquesRemate',
  'counterattacks with shots': 'contraAtaquesRemate',

  // Bolas paradas
  'bolas paradas': 'bolasParadas', 'set pieces': 'bolasParadas',
  'cantos': 'cantos', 'corners': 'cantos',
  'cantos com remate': 'cantosRemate', 'corners with shots': 'cantosRemate',

  // Duelos
  'duelos': 'duelos', 'duels': 'duelos',
  'duelos ganhos': 'duelosGanhos', 'duels won': 'duelosGanhos',
  'duelos ofensivos': 'duelosOfensivos', 'offensive duels': 'duelosOfensivos',
  'duelos defensivos': 'duelosDefensivos', 'defensive duels': 'duelosDefensivos',
  'duelos aereos': 'duelosAereos', 'aerial duels': 'duelosAereos',

  // Defensivo
  'intercecoes': 'intercecoes', 'intercepcoes': 'intercecoes',
  'interceptions': 'intercecoes',
  'recuperacoes': 'recuperacoes', 'ball recoveries': 'recuperacoes',
  'perdas': 'perdas', 'losses': 'perdas', 'turnovers': 'perdas',
  'alivioss': 'alivioss', 'clearances': 'alivioss',
  'faltas': 'faltas', 'fouls': 'faltas',
  'cartoes amarelos': 'cartamarelos', 'yellow cards': 'cartamarelos',
  'cartoes vermelhos': 'cartvermelhos', 'red cards': 'cartvermelhos',

  // Avançado
  'ppda': 'ppda',
  'intensidade de jogo': 'intensidade', 'game intensity': 'intensidade',
  'media de passes por posse': 'passesPorPosse',
  'passes per possession': 'passesPorPosse',
  'comprimento medio dos passes': 'comprimentoPasseMedio',
  'average pass length': 'comprimentoPasseMedio',
  'distancia media do remate': 'distanciaRemAteMedio',
  'average shot distance': 'distanciaRemAteMedio',
}

const PLAYER_COL_MAP = {
  // Identidade
  'jogador': 'playerName', 'player': 'playerName', 'nome': 'playerName', 'name': 'playerName',
  'jogo': 'jogo', 'game': 'jogo', 'match': 'jogo', 'partida': 'jogo',
  'data': 'data', 'date': 'data',
  'competicao': 'competicao', 'competition': 'competicao',
  'posicao': 'posicao', 'position': 'posicao', 'pos': 'posicao',
  'minutos jogados': 'minutos', 'minutos': 'minutos',
  'minutes played': 'minutos', 'min': 'minutos',

  // Ações
  'acoes totais': 'acoesTotais', 'total actions': 'acoesTotais',
  'acoes bem sucedidas': 'acoesBemSucedidas', 'successful actions': 'acoesBemSucedidas',

  // Gols e assistências
  'golos': 'gols', 'gols': 'gols', 'goals': 'gols',
  'assistencias': 'assistencias', 'assists': 'assistencias',

  // Finalizações
  'remates': 'remates', 'shots': 'remates', 'finalizacoes': 'remates',
  'remates a baliza': 'rematesAlvo', 'remates no alvo': 'rematesAlvo',
  'shots on target': 'rematesAlvo',
  'xg': 'xg', 'expected goals': 'xg',
  'xa': 'xa', 'expected assists': 'xa',

  // Passes
  'passes': 'passes',
  'passes certos': 'passesCertos', 'accurate passes': 'passesCertos',
  'passes longos': 'passesLongos', 'long passes': 'passesLongos',
  'passes longos certos': 'passesLongosCertos',
  'accurate long passes': 'passesLongosCertos',
  'cruzamentos': 'cruzamentos', 'crosses': 'cruzamentos',
  'cruzamentos certos': 'cruzamentosCertos', 'accurate crosses': 'cruzamentosCertos',
  'dribles': 'dribles', 'dribbles': 'dribles',
  'dribles certos': 'driblesCertos', 'accurate dribbles': 'driblesCertos',

  // Duelos
  'duelos': 'duelos', 'duels': 'duelos',
  'duelos ganhos': 'duelosGanhos', 'duels won': 'duelosGanhos',
  'duelos ofensivos': 'duelosOfensivos', 'offensive duels': 'duelosOfensivos',
  'duelos ofensivos ganhos': 'duelosOfensivosGanhos',
  'offensive duels won': 'duelosOfensivosGanhos',
  'duelos defensivos': 'duelosDefensivos', 'defensive duels': 'duelosDefensivos',
  'duelos defensivos ganhos': 'duelosDefensivosGanhos',
  'defensive duels won': 'duelosDefensivosGanhos',
  'duelos aereos': 'duelosAereos', 'aerial duels': 'duelosAereos',
  'duelos aereos ganhos': 'duelosAereosGanhos',
  'aerial duels won': 'duelosAereosGanhos',

  // Defensivo
  'intercepcoes': 'intercepcoes', 'intercecoes': 'intercepcoes',
  'interceptions': 'intercepcoes',
  'recuperacoes': 'recuperacoes', 'ball recoveries': 'recuperacoes',
  'perdas': 'perdas', 'losses': 'perdas',
  'aliivos': 'aliivos', 'clearances': 'aliivos',
  'carrinhos': 'carrinhos', 'tackles': 'carrinhos',
  'faltas': 'faltas', 'fouls': 'faltas',
  'faltas sofridas': 'faltasSofridas', 'fouls suffered': 'faltasSofridas',
  'cartoes amarelos': 'cartamarelos', 'yellow cards': 'cartamarelos',
  'cartoes vermelhos': 'cartvermelhos', 'red cards': 'cartvermelhos',

  // Criação
  'assistencias para remate': 'assistenciasRemate',
  'shot assists': 'assistenciasRemate', 'pre-assists': 'assistenciasRemate',
  'segundas assistencias': 'segundasAssistencias',
  'second assists': 'segundasAssistencias',
  'passes inteligentes': 'passesInteligentes', 'smart passes': 'passesInteligentes',
  'passes em profundidade': 'passesProfundidade', 'through balls': 'passesProfundidade',
  'passes para terco final': 'passesTercoFinal',
  'passes to final third': 'passesTercoFinal',
  'passes para a grande area': 'passesGrandeArea',
  'passes to penalty area': 'passesGrandeArea',
  'passes recebidos': 'passesRecebidos', 'received passes': 'passesRecebidos',
  'passes para frente': 'passesFrente', 'forward passes': 'passesFrente',
  'passes para tras': 'passesAtras', 'backward passes': 'passesAtras',
  'toques na area': 'toquesArea', 'touches in penalty area': 'toquesArea',
  'corridas seguidas': 'corridasSeguidas', 'progressive runs': 'corridasSeguidas',

  // Goleiro
  'golos sofridos': 'golsSofridos', 'gols sofridos': 'golsSofridos',
  'goals conceded': 'golsSofridos',
  'xcg': 'xcg',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeKey(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapColumn(raw, colMap) {
  const norm = normalizeKey(raw)
  if (colMap[norm]) return colMap[norm]
  for (const [key, val] of Object.entries(colMap)) {
    if (norm === key) return val
    if (norm.startsWith(key) || key.startsWith(norm)) return val
  }
  return norm.replace(/\s/g, '_').replace(/-/g, '_')
}

export function safeNum(v) {
  if (v === null || v === undefined || v === '' || v === '-' || v === 'N/A') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function safeStr(v) {
  return v == null ? '' : String(v).trim()
}

// ---------------------------------------------------------------------------
// Parser Team Stats
// ---------------------------------------------------------------------------

export function parseTeamStatsFile(buffer) {
  try {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    // Lê como matriz (array de arrays), preservando colunas vazias
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
    if (matrix.length < 2) return []

    // Mapa de colunas por ÍNDICE FIXO (estrutura Wyscout Team Stats)
    // Cada métrica composta ocupa colunas consecutivas: [valor, valor2, %]
    const COL = {
      data: 0, jogo: 1, competicao: 2, duracao: 3, equipa: 4, sistema: 5,
      golos: 6, xg: 7,
      remates: 8, rematesAlvo: 9,
      passes: 11, passesCertos: 12,
      posse: 14,
      perdas: 15,
      recuperacoes: 19,
      duelos: 23, duelosGanhos: 24,
      ataquesPositivos: 29, ataquesPositivosRemate: 30,
      contraAtaques: 32, contraAtaquesRemate: 33,
      bolasParadas: 35, bolasParadasRemate: 36,
      cantos: 38, cantosRemate: 39,
      cruzamentos: 47, cruzamentosCertos: 48,
      entradasArea: 52,
      toquesArea: 55,
      duelosOfensivos: 56, duelosOfensivosGanhos: 57,
      golosSofridos: 60,
      rematesContra: 61, rematesContraAlvo: 62,
      duelosDefensivos: 64, duelosDefensivosGanhos: 65,
      duelosAereos: 67, duelosAereosGanhos: 68,
      intercecoes: 73, alivioss: 74, faltas: 75,
      cartamarelos: 76, cartvermelhos: 77,
      passesFrente: 78, passesFrenteCertos: 79,
      passesAtras: 81,
      passesLaterais: 84,
      passesLongos: 87, passesLongosCertos: 88,
      passesTercoFinal: 90, passesTercoFinalCertos: 91,
      passesProgressivos: 93, passesProgressivosCertos: 94,
      passesInteligentes: 96, passesInteligentesCertos: 97,
      intensidade: 103, passesPorPosse: 104,
      distanciaRemAteMedio: 106, comprimentoPasseMedio: 107,
      ppda: 108,
    }

    const at = (row, idx) => (idx == null || !row || row[idx] == null) ? 0 : safeNum(row[idx])

    // A linha do JOGO é a que tem Equipa === "Confiança". A linha seguinte é o adversário.
    // Ignora linhas de cabeçalho extra ("Confiança"/"Adversários" na coluna Data).
    const dataRows = matrix.slice(1)
    const games = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      if (!row) continue
      const equipa = safeStr(row[COL.equipa])
      const jogoStr = safeStr(row[COL.jogo])
      // só processa a linha do Confiança que tenha um Jogo válido
      if (!/confian[cç]a/i.test(equipa) || !jogoStr) continue

      // adversário = próxima linha (Equipa != Confiança)
      const advRow = dataRows[i + 1] && !/confian[cç]a/i.test(safeStr(dataRows[i + 1][COL.equipa])) ? dataRows[i + 1] : []

      const dataCell = row[COL.data]
      let dataStr = ''
      if (dataCell instanceof Date) dataStr = dataCell.toISOString().slice(0, 10)
      else dataStr = safeStr(dataCell)

      // Mando + placar a partir de "Jogo": ex "Barra - Confiança 0:2" ou "Confiança - Ituano 1:3"
      let mando = 'fora'
      let golsPro = 0, golsContra = 0
      const m = jogoStr.match(/^(.*?)\s*[-–]\s*(.*?)\s+(\d+)\s*[:x]\s*(\d+)\s*$/i)
      if (m) {
        const mandante = m[1].trim()
        const visitante = m[2].trim()
        const gMandante = parseInt(m[3])
        const gVisitante = parseInt(m[4])
        const guaraniMandante = /confian[cç]a/i.test(mandante)
        mando = guaraniMandante ? 'casa' : 'fora'
        golsPro = guaraniMandante ? gMandante : gVisitante
        golsContra = guaraniMandante ? gVisitante : gMandante
      } else {
        // fallback: gols da própria linha
        golsPro = at(row, COL.golos)
        golsContra = at(advRow, COL.golos)
        if (/^confian[cç]a/i.test(jogoStr)) mando = 'casa'
      }

      let resultado = null
      if (golsPro > golsContra) resultado = 'V'
      else if (golsPro < golsContra) resultado = 'D'
      else resultado = 'E'

      // Sistema: "4-4-2 (69.6%)" → pega só o formato
      const sistemaRaw = safeStr(row[COL.sistema])
      const sistema = (sistemaRaw.match(/[\d\-]+/) || [sistemaRaw])[0]

      games.push({
        id: `g_${dataStr}_${jogoStr}`.replace(/[^a-z0-9_]/gi, '_').slice(0, 60),
        jogo: jogoStr,
        data: dataStr,
        competicao: safeStr(row[COL.competicao]) || 'Série C 2026',
        duracao: at(row, COL.duracao) || 90,
        equipa: 'Confiança',
        sistema,
        mando,
        resultado,
        golsPro,
        golsContra,
        // ofensivo (linha Confiança)
        xg: at(row, COL.xg),
        remates: at(row, COL.remates),
        rematesAlvo: at(row, COL.rematesAlvo),
        posse: at(row, COL.posse),
        passes: at(row, COL.passes),
        passesCertos: at(row, COL.passesCertos),
        passesLongos: at(row, COL.passesLongos),
        passesFrente: at(row, COL.passesFrente),
        passesAtras: at(row, COL.passesAtras),
        passesLaterais: at(row, COL.passesLaterais),
        passesProgressivos: at(row, COL.passesProgressivos),
        passesTercoFinal: at(row, COL.passesTercoFinal),
        passesInteligentes: at(row, COL.passesInteligentes),
        entradasArea: at(row, COL.entradasArea),
        toquesArea: at(row, COL.toquesArea),
        cruzamentos: at(row, COL.cruzamentos),
        cruzamentosCertos: at(row, COL.cruzamentosCertos),
        ataquesPositivos: at(row, COL.ataquesPositivos),
        ataquesPositivosRemate: at(row, COL.ataquesPositivosRemate),
        contraAtaques: at(row, COL.contraAtaques),
        contraAtaquesRemate: at(row, COL.contraAtaquesRemate),
        bolasParadas: at(row, COL.bolasParadas),
        cantos: at(row, COL.cantos),
        cantosRemate: at(row, COL.cantosRemate),
        duelos: at(row, COL.duelos),
        duelosGanhos: at(row, COL.duelosGanhos),
        duelosOfensivos: at(row, COL.duelosOfensivos),
        duelosDefensivos: at(row, COL.duelosDefensivos),
        duelosAereos: at(row, COL.duelosAereos),
        intercecoes: at(row, COL.intercecoes),
        recuperacoes: at(row, COL.recuperacoes),
        perdas: at(row, COL.perdas),
        alivioss: at(row, COL.alivioss),
        faltas: at(row, COL.faltas),
        cartamarelos: at(row, COL.cartamarelos),
        cartvermelhos: at(row, COL.cartvermelhos),
        ppda: at(row, COL.ppda),
        intensidade: at(row, COL.intensidade),
        passesPorPosse: at(row, COL.passesPorPosse),
        comprimentoPasseMedio: at(row, COL.comprimentoPasseMedio),
        distanciaRemAteMedio: at(row, COL.distanciaRemAteMedio),
        // defensivo: o que sofremos = ofensivo do adversário (linha de baixo)
        xgContra: at(advRow, COL.xg),
        rematesContra: at(row, COL.rematesContra) || at(advRow, COL.remates),
        rematesContraAlvo: at(row, COL.rematesContraAlvo) || at(advRow, COL.rematesAlvo),
      })
    }

    return games
  } catch (e) {
    console.error('[parseTeamStatsFile] erro:', e)
    return []
  }
}

// ---------------------------------------------------------------------------
// Parser Player Stats
// ---------------------------------------------------------------------------

export function parsePlayerStatsFile(buffer, filenameHint) {
  try {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
    if (matrix.length < 2) return []

    // Nome vem do arquivo (a planilha Wyscout individual não traz o nome do atleta)
    const nameFromFile = filenameHint
      ? filenameHint
          .replace(/\.(xlsx?|csv)$/i, '')
          .replace(/[Pp]layer[_\s]?[Ss]tats[_\s]?/i, '')
          .replace(/[_\s]*\(\d+\)\s*$/, '')
          .replace(/[_\s]+\d+[_\s]*$/, '')
          .replace(/[_]+/g, ' ')
          .trim()
      : ''
    const playerName = nameFromFile || 'Jogador'
    const playerId = playerName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')

    // -----------------------------------------------------------------------
    // Detectar layout: goleiro (Wyscout GK export) vs jogador de linha
    // O export do Wyscout para GK começa com cols específicas de goleiro
    // (Golos sofridos, xCG, Remates sofridos, Defesas...) logo após minutos,
    // enquanto o export de jogadores de linha começa com ações totais, gols, etc.
    // Heurística: se o header da coluna 5 contiver "sofridos" ou "xcg" ou "defesa" → GK layout
    // -----------------------------------------------------------------------
    const headerRow = matrix[0] || []
    const h5 = String(headerRow[5] || '').toLowerCase()
    const isGKLayout = /sofridos|xcg|defesa|goalkeeper/.test(h5) ||
      /^gk$/i.test(String(headerRow[3] || '')) ||
      // fallback: verifica primeira linha de dados
      /^gk$/i.test(String((matrix[1] || [])[3] || ''))

    // ── Layout Goleiro (Wyscout GK export) ──────────────────────────────
    // Col: 0=Jogo, 1=Competition, 2=Date, 3=Posição, 4=Minutos jogados
    //      5=Golos sofridos, 6=xCG, 7=Remates sofridos,
    //      8=Defesas totais, 9=Defesas com reflexo,
    //      10=Saídas,
    //      11=Passes longos, 12=Passes longos certos,
    //      13=Short passes, 14=Short passes accurate,
    //      15=Pontapés de baliza, 16=curtos, 17=longos
    const COL_GK = {
      jogo: 0, competicao: 1, data: 2, posicao: 3, minutos: 4,
      golsSofridos: 5, xcg: 6, rematesSofridos: 7,
      defesas: 8, defesasReflexo: 9,
      saidas: 10,
      passesLongos: 11, passesLongosCertos: 12,
      passes: 13, passesCertos: 14,
      pontapesBalizaTotal: 15, pontapesBalizaCurtos: 16, pontapesBalizaLongos: 17,
    }

    // ── Layout Jogador de Linha (Wyscout standard) ───────────────────────
    const COL = {
      jogo: 0, competicao: 1, data: 2, posicao: 3, minutos: 4,
      acoesTotais: 5, acoesBemSucedidas: 6,
      gols: 7, assistencias: 8,
      remates: 9, rematesAlvo: 10, xg: 11,
      passes: 12, passesCertos: 13,
      passesLongos: 14, passesLongosCertos: 15,
      cruzamentos: 16, cruzamentosCertos: 17,
      dribles: 18, driblesCertos: 19,
      duelos: 20, duelosGanhos: 21,
      duelosAereos: 22, duelosAereosGanhos: 23,
      intercepcoes: 24,
      perdas: 25,
      recuperacoes: 27,
      duelosDefensivos: 31, duelosDefensivosGanhos: 32,
      carrinhos: 35, carrinhosOk: 36,
      aliivos: 37, faltas: 38,
      cartamarelos: 39, cartvermelhos: 40,
      assistenciasRemate: 41,
      duelosOfensivos: 42, duelosOfensivosGanhos: 43,
      toquesArea: 44, foras: 45, corridasSeguidas: 46, faltasSofridas: 47,
      passesProfundidade: 48, passesProfundidadeCertos: 49,
      xa: 50, segundasAssistencias: 51,
      passesTercoFinal: 52, passesTercoFinalCertos: 53,
      passesGrandeArea: 54, passesGrandeAreaCertos: 55,
      passesRecebidos: 56,
      passesFrente: 57, passesFrenteCertos: 58,
      passesAtras: 59, passesAtrasCertos: 60,
      golsSofridos: 61, xcg: 62, rematesSofridos: 63,
      defesas: 64, saidas: 66,
    }

    const at = (row, idx) => (idx == null || !row || row[idx] == null) ? 0 : safeNum(row[idx])

    const dataRows = matrix.slice(1)
    const out = []

    for (const row of dataRows) {
      if (!row) continue
      const jogoStr = safeStr(row[0])
      const minutos = at(row, 4)
      if (!jogoStr && minutos < 1) continue

      const posRaw = safeStr(row[3])
      const posicao = posRaw.split(/[,/]/)[0].trim() || (isGKLayout ? 'GK' : '')

      const dataCell = row[2]
      let dataStr = ''
      if (dataCell instanceof Date) dataStr = dataCell.toISOString().slice(0, 10)
      else dataStr = safeStr(dataCell)

      const competicao = safeStr(row[1]) || 'Série C 2026'

      if (isGKLayout) {
        // ── Parse linha de goleiro ───────────────────────────────────────
        const C = COL_GK
        const golsSofridos = at(row, C.golsSofridos)
        const xcgVal      = at(row, C.xcg)
        const rematesSof  = at(row, C.rematesSofridos)
        const defesasTot  = at(row, C.defesas)
        const defesasRef  = at(row, C.defesasReflexo)
        const saidasVal   = at(row, C.saidas)
        const passesL     = at(row, C.passesLongos)
        const passesLCert = at(row, C.passesLongosCertos)
        const passesS     = at(row, C.passes)
        const passesSCert = at(row, C.passesCertos)

        // % de defesas (defesasTot > 0 ? defesasTot/rematesSof : 0)
        const defesasPct  = rematesSof > 0 ? parseFloat(((defesasTot / rematesSof) * 100).toFixed(1)) : 0
        // passes totais e certos
        const passesTot   = passesS + passesL
        const passesCertTot = passesSCert + passesLCert

        out.push({
          playerId, playerName,
          jogo: jogoStr, data: dataStr, competicao, posicao,
          minutos,
          // métricas de goleiro — mapeadas nos campos padrão usados pelo scoring
          golsSofridos,
          xcg: xcgVal,
          rematesSofridos: rematesSof,
          defesas: defesasTot,
          defesasReflexo: defesasRef,
          defesasPct,
          saidas: saidasVal,
          passes: passesTot,
          passesCertos: passesCertTot,
          passesLongos: passesL,
          passesLongosCertos: passesLCert,
          // zeros para campos irrelevantes ao goleiro
          gols: 0, assistencias: 0, remates: 0, rematesAlvo: 0,
          xg: 0, xa: 0,
          cruzamentos: 0, cruzamentosCertos: 0,
          dribles: 0, driblesCertos: 0,
          duelos: 0, duelosGanhos: 0,
          duelosOfensivos: 0, duelosOfensivosGanhos: 0,
          duelosDefensivos: 0, duelosDefensivosGanhos: 0,
          duelosAereos: 0, duelosAereosGanhos: 0,
          intercepcoes: 0, recuperacoes: 0,
          perdas: 0, aliivos: 0, carrinhos: 0,
          faltas: 0, faltasSofridas: 0,
          cartamarelos: 0, cartvermelhos: 0,
          assistenciasRemate: 0, segundasAssistencias: 0,
          passesInteligentes: 0, passesProfundidade: 0,
          passesTercoFinal: 0, passesGrandeArea: 0,
          passesRecebidos: 0, passesFrente: 0, passesAtras: 0,
          toquesArea: 0, corridasSeguidas: 0,
          acoesTotais: defesasTot + passesTot + saidasVal,
          acoesBemSucedidas: defesasTot + passesCertTot + saidasVal,
        })
      } else {
        // ── Parse linha de jogador de linha ─────────────────────────────
        out.push({
          playerId, playerName,
          jogo: jogoStr, data: dataStr, competicao,
          posicao,
          minutos,
          acoesTotais: at(row, COL.acoesTotais),
          acoesBemSucedidas: at(row, COL.acoesBemSucedidas),
          gols: at(row, COL.gols),
          assistencias: at(row, COL.assistencias),
          remates: at(row, COL.remates),
          rematesAlvo: at(row, COL.rematesAlvo),
          xg: at(row, COL.xg),
          xa: at(row, COL.xa),
          passes: at(row, COL.passes),
          passesCertos: at(row, COL.passesCertos),
          passesLongos: at(row, COL.passesLongos),
          passesLongosCertos: at(row, COL.passesLongosCertos),
          cruzamentos: at(row, COL.cruzamentos),
          cruzamentosCertos: at(row, COL.cruzamentosCertos),
          dribles: at(row, COL.dribles),
          driblesCertos: at(row, COL.driblesCertos),
          duelos: at(row, COL.duelos),
          duelosGanhos: at(row, COL.duelosGanhos),
          duelosOfensivos: at(row, COL.duelosOfensivos),
          duelosOfensivosGanhos: at(row, COL.duelosOfensivosGanhos),
          duelosDefensivos: at(row, COL.duelosDefensivos),
          duelosDefensivosGanhos: at(row, COL.duelosDefensivosGanhos),
          duelosAereos: at(row, COL.duelosAereos),
          duelosAereosGanhos: at(row, COL.duelosAereosGanhos),
          intercepcoes: at(row, COL.intercepcoes),
          recuperacoes: at(row, COL.recuperacoes),
          perdas: at(row, COL.perdas),
          aliivos: at(row, COL.aliivos),
          carrinhos: at(row, COL.carrinhos),
          faltas: at(row, COL.faltas),
          faltasSofridas: at(row, COL.faltasSofridas),
          cartamarelos: at(row, COL.cartamarelos),
          cartvermelhos: at(row, COL.cartvermelhos),
          assistenciasRemate: at(row, COL.assistenciasRemate),
          segundasAssistencias: at(row, COL.segundasAssistencias),
          passesInteligentes: at(row, COL.passesProfundidade),
          passesProfundidade: at(row, COL.passesProfundidade),
          passesTercoFinal: at(row, COL.passesTercoFinal),
          passesGrandeArea: at(row, COL.passesGrandeArea),
          passesRecebidos: at(row, COL.passesRecebidos),
          passesFrente: at(row, COL.passesFrente),
          passesAtras: at(row, COL.passesAtras),
          toquesArea: at(row, COL.toquesArea),
          corridasSeguidas: at(row, COL.corridasSeguidas),
          golsSofridos: at(row, COL.golsSofridos),
          xcg: at(row, COL.xcg),
          defesas: at(row, COL.defesas),
          saidas: at(row, COL.saidas),
          rematesSofridos: at(row, COL.rematesSofridos),
        })
      }
    }

    return out
  } catch (e) {
    console.error('[parsePlayerStatsFile] erro:', e)
    return []
  }
}

// ---------------------------------------------------------------------------
// Agregação
// ---------------------------------------------------------------------------

const NUMERIC_PLAYER_KEYS = [
  'minutos', 'acoesTotais', 'acoesBemSucedidas', 'gols', 'assistencias',
  'remates', 'rematesAlvo', 'xg', 'xa', 'passes', 'passesCertos',
  'passesLongos', 'passesLongosCertos', 'cruzamentos', 'cruzamentosCertos',
  'dribles', 'driblesCertos', 'duelos', 'duelosGanhos', 'duelosOfensivos',
  'duelosOfensivosGanhos', 'duelosDefensivos', 'duelosDefensivosGanhos',
  'duelosAereos', 'duelosAereosGanhos', 'intercepcoes', 'recuperacoes',
  'perdas', 'aliivos', 'carrinhos', 'faltas', 'faltasSofridas',
  'cartamarelos', 'cartvermelhos', 'assistenciasRemate', 'segundasAssistencias',
  'passesInteligentes', 'passesProfundidade', 'passesTercoFinal', 'passesGrandeArea',
  'passesRecebidos', 'passesFrente', 'passesAtras', 'toquesArea',
  'corridasSeguidas', 'golsSofridos', 'xcg',
  // métricas exclusivas de goleiro
  'defesas', 'defesasReflexo', 'rematesSofridos', 'saidas',
]

export function aggregatePlayerGames(games) {
  const agg = {}
  for (const key of NUMERIC_PLAYER_KEYS) {
    agg[key] = games.reduce((s, g) => s + (g[key] || 0), 0)
  }
  // defesasPct deve ser média ponderada por jogos com remates sofridos, não soma
  const gkGames = games.filter(g => (g.rematesSofridos || 0) > 0)
  if (gkGames.length > 0) {
    const totalDef = gkGames.reduce((s, g) => s + (g.defesas || 0), 0)
    const totalRem = gkGames.reduce((s, g) => s + (g.rematesSofridos || 0), 0)
    agg['defesasPct'] = totalRem > 0 ? parseFloat(((totalDef / totalRem) * 100).toFixed(1)) : 0
  } else {
    agg['defesasPct'] = 0
  }
  return agg
}

export function computePer90(agg, totalMin) {
  if (totalMin < 1) return {}
  const factor = 90 / totalMin
  const per90 = {}
  for (const [key, val] of Object.entries(agg)) {
    if (key === 'minutos') continue
    per90[key] = parseFloat((val * factor).toFixed(3))
  }
  return per90
}

export function groupPlayerGamesByName(allGames) {
  const groups = {}
  for (const g of allGames) {
    if (!groups[g.playerId]) groups[g.playerId] = []
    groups[g.playerId].push(g)
  }
  return groups
}

export function percentOf(part, total) {
  if (!total) return 0
  return parseFloat(((part / total) * 100).toFixed(1))
}
