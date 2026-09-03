// lib/serieCParse.js
// ─────────────────────────────────────────────────────────────────────────────
// Leitura das planilhas Excel (times / jogadores de linha / goleiros) no
// upload semanal. Usa a lib "xlsx" (SheetJS) só no server (rota de API).
// Lê a primeira aba, usa a primeira linha como cabeçalho e devolve um array
// de objetos { "Nome da Coluna": valor }, exatamente como veio da planilha.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx'
import { extractPlayerIdentity, extractTeamIdentity, isClubTeam, normTeamName } from './serieC'
import { inferRounds, parseMatchLabel, parseSpreadsheetDate } from './serieCMatch'


export function workbookMetricColumns(rawRows = []) {
  return Array.from(new Set((rawRows || []).flatMap(row => Object.keys(row || {}))))
}

export function detectStatsWorkbookKind(rawRows = []) {
  const headers = workbookMetricColumns(rawRows)
  const normalized = new Set(headers.map(key => String(key || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()))
  const has = name => normalized.has(String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim())

  const goalkeeperSignals = [
    'Chutes sofridos', 'Chutes no alvo sofridos', 'Chutes defendidos, %',
    'Tentativas de interceptação de cruzamentos e passes', 'Tiros de meta',
    'Pênaltis defendidos, %',
  ].filter(has).length
  const playerSignals = [
    'Posição', 'Duelos', 'Dribles', 'Passes progressivos',
    'xG (Gols esperados)', 'Recuperações da bola',
  ].filter(has).length
  const teamSignals = ['Time', 'Índice', 'Posse de bola, %', 'Pressão do time bem-sucedida, %'].filter(has).length

  if (goalkeeperSignals >= 3 && !has('Posição')) return 'goalkeepers'
  if (playerSignals >= 3 && has('Posição')) return 'players'
  if (teamSignals >= 3 && !has('Jogador')) return 'teams'
  return 'unknown'
}

export async function parseWorkbookFile(file) {
  if (!file) return []
  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []
  // defval: '' garante que células vazias não somem do objeto (mantém colunas alinhadas)
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
  return rows
}

// ── Parser específico para as planilhas jogo a jogo ─────────────────────────
// A exportação Wyscout "Team Stats" usa cabeçalhos agrupados. Exemplo:
// "Remates / à baliza" ocupa 3 colunas (total, no alvo, %), mas apenas a
// primeira coluna tem texto no cabeçalho. O sheet_to_json tradicional chama as
// demais de __EMPTY e a versão antiga acabava descartando justamente os
// subcampos. Aqui transformamos a matriz da planilha em chaves canônicas antes
// de gravar no JSONB, preservando TODOS os valores úteis.
function normalizeHeader(value = '') {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim()
}

function headerIndex(headers, label) {
  const target = normalizeHeader(label)
  return (headers || []).findIndex(value => normalizeHeader(value) === target)
}

function stripFormation(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.replace(/\s*\([^)]*%\)\s*$/, '').trim()
}

function canonicalTeamStatsRow(row, idx) {
  const get = (name, offset = 0) => idx[name] >= 0 ? row[idx[name] + offset] ?? '' : ''
  const out = {
    Data: get('date'),
    Jogo: get('game'),
    'Competição': get('competition'),
    'Duração': get('duration'),
    Equipa: get('team'),
    Sistema: get('formation'),
    'Tática (inicial)': stripFormation(get('formation')),
    Gols: get('goals'),
    'Golos esperados': get('xg'),

    Chutes: get('shots'),
    'Chutes no alvo': get('shots', 1),
    'Chutes no alvo, %': get('shots', 2),
    Passes: get('passes'),
    'Passes precisos': get('passes', 1),
    'Passes precisos, %': get('passes', 2),
    'Posse de bola, %': get('possession'),

    'Perdas da bola': get('losses'),
    'Perdas da bola curtas': get('losses', 1),
    'Perdas da bola médias': get('losses', 2),
    'Perdas da bola longas': get('losses', 3),
    'Recuperações da bola': get('recoveries'),
    'Recuperações da bola curtas': get('recoveries', 1),
    'Recuperações da bola médias': get('recoveries', 2),
    'Recuperações da bola longas': get('recoveries', 3),

    Duelos: get('duels'),
    'Duelos ganhos': get('duels', 1),
    'Duelos ganhos, %': get('duels', 2),
    'Chutes de fora da área': get('outsideShots'),
    'Chutes de fora da área no alvo': get('outsideShots', 1),
    'Chutes de fora da área no alvo, %': get('outsideShots', 2),

    'Ataques posicionais': get('positionalAttacks'),
    'Ataques posicionais com chutes': get('positionalAttacks', 1),
    'Ataques posicionais com chutes, %': get('positionalAttacks', 2),
    'Contra-ataques': get('counterattacks'),
    'Contra-ataques com chutes': get('counterattacks', 1),
    'Contra-ataques com chutes, %': get('counterattacks', 2),
    'Bolas paradas': get('setPieces'),
    'Bolas paradas com chutes': get('setPieces', 1),
    'Bolas paradas com chutes, %': get('setPieces', 2),
    Escanteios: get('corners'),
    'Escanteios com chutes': get('corners', 1),
    'Escanteios com chutes, %': get('corners', 2),
    'Faltas cobradas': get('freeKicks'),
    'Faltas cobradas com chutes': get('freeKicks', 1),
    'Faltas cobradas com chutes, %': get('freeKicks', 2),
    Pênaltis: get('penalties'),
    'Pênaltis convertidos': get('penalties', 1),
    'Pênaltis convertidos, %': get('penalties', 2),

    Cruzamentos: get('crosses'),
    'Cruzamentos precisos': get('crosses', 1),
    'Cruzamentos precisos, %': get('crosses', 2),
    'Cruzamentos em profundidade recebidos': get('deepCrosses'),
    'Passes em profundidade recebidos': get('deepPasses'),
    'Entradas na área adversária': get('boxEntries'),
    'Entradas na área adversária por corrida': get('boxEntries', 1),
    'Entradas na área adversária por cruzamento': get('boxEntries', 2),
    'Toques na área': get('touchesBox'),

    'Duelos ofensivos': get('offensiveDuels'),
    'Duelos ofensivos ganhos': get('offensiveDuels', 1),
    'Duelos ofensivos ganhos, %': get('offensiveDuels', 2),
    Impedimentos: get('offsides'),
    'Gols sofridos': get('goalsAgainst'),
    'Chutes contra': get('shotsAgainst'),
    'Chutes contra no alvo': get('shotsAgainst', 1),
    'Chutes contra no alvo, %': get('shotsAgainst', 2),
    'Duelos defensivos': get('defensiveDuels'),
    'Duelos defensivos ganhos': get('defensiveDuels', 1),
    'Duelos defensivos ganhos, %': get('defensiveDuels', 2),
    'Duelos aéreos': get('aerialDuels'),
    'Duelos aéreos ganhos': get('aerialDuels', 1),
    'Duelos aéreos ganhos, %': get('aerialDuels', 2),
    Desarmes: get('tackles'),
    'Desarmes bem-sucedidos': get('tackles', 1),
    'Desarmes bem-sucedidos, %': get('tackles', 2),
    Interceptações: get('interceptions'),
    Alívios: get('clearances'),
    Faltas: get('fouls'),
    'Cartões amarelos': get('yellowCards'),
    'Cartões vermelhos': get('redCards'),
  }

  const passGroups = [
    ['forwardPasses', 'Passes para a frente'],
    ['backPasses', 'Passes para trás'],
    ['lateralPasses', 'Passes laterais'],
    ['longPasses', 'Passes longos'],
    ['finalThirdPasses', 'Passes para o terço final'],
    ['progressivePasses', 'Passes progressivos'],
    ['smartPasses', 'Passes inteligentes'],
    ['throwIns', 'Lançamentos'],
  ]
  for (const [key, label] of passGroups) {
    out[label] = get(key)
    out[`${label} precisos`] = get(key, 1)
    out[`${label} precisos, %`] = get(key, 2)
  }

  Object.assign(out, {
    'Tiros de meta': get('goalKicks'),
    'Intensidade de jogo': get('gameIntensity'),
    'Média de passes por posse': get('passesPerPossession'),
    '% de passe longo': get('longPassPct'),
    'Distância média do chute': get('shotDistance'),
    'Comprimento médio dos passes': get('averagePassLength'),
    PPDA: get('ppda'),
  })
  return out
}

function teamStatsIndexes(headers) {
  return {
    date: headerIndex(headers, 'Data'), game: headerIndex(headers, 'Jogo'), competition: headerIndex(headers, 'Competição'), duration: headerIndex(headers, 'Duração'), team: headerIndex(headers, 'Equipa'), formation: headerIndex(headers, 'Sistema'),
    goals: headerIndex(headers, 'Golos'), xg: headerIndex(headers, 'Golos esperados'), shots: headerIndex(headers, 'Remates / à baliza'), passes: headerIndex(headers, 'Passes / certos'), possession: headerIndex(headers, 'Posse, %'),
    losses: headerIndex(headers, 'Perdas / curto/ médio / longo'), recoveries: headerIndex(headers, 'Recuperações / curto / médio / longo'), duels: headerIndex(headers, 'Duelos/ganhos'), outsideShots: headerIndex(headers, 'Remates de fora da área / no alvo'),
    positionalAttacks: headerIndex(headers, 'Ataques posicionais / com remates'), counterattacks: headerIndex(headers, 'Contra-ataques / com remates'), setPieces: headerIndex(headers, 'Bolas paradas / com remates'), corners: headerIndex(headers, 'Cantos / com remates'), freeKicks: headerIndex(headers, 'Pontapés livre / com remates'), penalties: headerIndex(headers, 'Penaltis / convertidos'),
    crosses: headerIndex(headers, 'Cruzamentos / certos'), deepCrosses: headerIndex(headers, 'Cruzamentos em profundidade recebidos'), deepPasses: headerIndex(headers, 'Passes em profundidade recebidos'), boxEntries: headerIndex(headers, 'Entradas na grande área (corridas/cruzamentos)'), touchesBox: headerIndex(headers, 'Toques na área'), offensiveDuels: headerIndex(headers, 'Duelos ofensivos / ganhos'), offsides: headerIndex(headers, 'Foras de jogo'), goalsAgainst: headerIndex(headers, 'Golos sofridos'), shotsAgainst: headerIndex(headers, 'Remates contra / no alvo'), defensiveDuels: headerIndex(headers, 'Duelos defensivos / ganhos'), aerialDuels: headerIndex(headers, 'Duelos aéreos / ganhos'), tackles: headerIndex(headers, 'Carrinhos / bem sucedidos'), interceptions: headerIndex(headers, 'Interseções,'), clearances: headerIndex(headers, 'Alívios'), fouls: headerIndex(headers, 'Faltas'), yellowCards: headerIndex(headers, 'Cartões amarelos'), redCards: headerIndex(headers, 'Cartões vermelhos'),
    forwardPasses: headerIndex(headers, 'Passes para a frente / certos'), backPasses: headerIndex(headers, 'Passes para trás / certos'), lateralPasses: headerIndex(headers, 'Passes laterais / certos'), longPasses: headerIndex(headers, 'Passes longos / certos'), finalThirdPasses: headerIndex(headers, 'Passes para terço final / certos'), progressivePasses: headerIndex(headers, 'Passes progressivos / precisos'), smartPasses: headerIndex(headers, 'Passes inteligentes / certos'), throwIns: headerIndex(headers, 'Lançamentos / certos'), goalKicks: headerIndex(headers, 'Pontapés de baliza'), gameIntensity: headerIndex(headers, 'Intensidade de jogo'), passesPerPossession: headerIndex(headers, 'Média de passes por posse'), longPassPct: headerIndex(headers, '% de passe longo'), shotDistance: headerIndex(headers, 'Distância média do remate'), averagePassLength: headerIndex(headers, 'Comprimento médio de passes'), ppda: headerIndex(headers, 'PPDA'),
  }
}

function isTeamStatsMatrix(matrix = []) {
  const headers = matrix?.[0] || []
  return headerIndex(headers, 'Jogo') >= 0 && headerIndex(headers, 'Equipa') >= 0 && headerIndex(headers, 'Remates / à baliza') >= 0 && headerIndex(headers, 'PPDA') >= 0
}

export async function parseCompetitionWorkbookFile(file) {
  if (!file) return []
  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames.find(name => /team\s*stats/i.test(name)) || wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []

  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  if (isTeamStatsMatrix(matrix)) {
    const headers = matrix[0] || []
    const idx = teamStatsIndexes(headers)
    return matrix.slice(1)
      .filter(row => row && idx.date >= 0 && row[idx.date] && idx.game >= 0 && row[idx.game] && idx.team >= 0 && row[idx.team])
      .map(row => canonicalTeamStatsRow(row, idx))
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
}

function isCompetitionTeamName(name) {
  const n = normTeamName(name)
  if (!n) return false
  // A exportação Wyscout termina com linhas de resumo, por exemplo
  // "Média por time, Total". Elas não são clubes e não podem entrar no ranking.
  if (/^(MEDIA|MÉDIA|AVERAGE|TOTAL)(\s|$)/i.test(String(name || '').trim())) return false
  if (n.includes('MEDIA POR TIME') || n.includes('AVERAGE PER TEAM')) return false
  return true
}

export function buildTeamRecords(rawRows) {
  return rawRows
    .map(row => {
      const { team } = extractTeamIdentity(row)
      if (!isCompetitionTeamName(team)) return null
      return { team, isClub: isClubTeam(team), metrics: row }
    })
    .filter(Boolean)
}

export function buildPlayerRecords(rawRows) {
  return rawRows
    .map(row => {
      const id = extractPlayerIdentity(row)
      if (!id.player) return null
      return {
        player: id.player,
        team: id.team,
        isClub: isClubTeam(id.team),
        position: id.position || null,
        age: id.age,
        minutes: id.minutes,
        metrics: row,
      }
    })
    .filter(Boolean)
}

export function buildGoalkeeperRecords(rawRows) {
  return rawRows
    .map(row => {
      const id = extractPlayerIdentity(row)
      if (!id.player) return null
      return {
        player: id.player,
        team: id.team,
        isClub: isClubTeam(id.team),
        age: id.age,
        minutes: id.minutes,
        metrics: row,
      }
    })
    .filter(Boolean)
}

// ── Planilha "Estatísticas da partida" (jogo a jogo do Confiança) ─────────────
// Uma linha por partida: Data, m/v (mandante/visitante), Adversário, Placar
// + todas as métricas de time daquele jogo. A Wyscout costuma terminar a
// planilha com uma linha "Total" (soma da temporada) — essa linha é ignorada.
function findMatchKey(obj, candidates) {
  const keys = Object.keys(obj || {})
  for (const cand of candidates) {
    const hit = keys.find(k => k.toLowerCase().trim() === cand.toLowerCase().trim())
    if (hit) return hit
  }
  return null
}

export function buildMatchRecords(rawRows) {
  return rawRows
    .map(row => {
      const dateKey = findMatchKey(row, ['Data'])
      const mandoKey = findMatchKey(row, ['m / v', 'M/V', 'Mando'])
      const oppKey = findMatchKey(row, ['Adversário', 'Adversario'])
      const scoreKey = findMatchKey(row, ['Placar'])
      const opponent = oppKey ? row[oppKey] : null
      const dateValue = dateKey ? row[dateKey] : null
      // ignora a linha de totais da temporada (não tem adversário nem data válida)
      if (!opponent || !dateValue) return null

      let isoDate = null
      if (dateValue instanceof Date) {
        isoDate = dateValue.toISOString().slice(0, 10)
      } else if (typeof dateValue === 'number') {
        // fallback: número serial do Excel (dias desde 1899-12-30)
        const d = new Date(Math.round((dateValue - 25569) * 86400 * 1000))
        if (!isNaN(d.getTime())) isoDate = d.toISOString().slice(0, 10)
      } else if (typeof dateValue === 'string' && dateValue.trim()) {
        const d = new Date(dateValue)
        if (!isNaN(d.getTime())) isoDate = d.toISOString().slice(0, 10)
      }
      if (!isoDate) return null

      return {
        matchDate: isoDate,
        mando: mandoKey ? String(row[mandoKey]).toUpperCase().slice(0, 1) : null,
        opponent: String(opponent).trim(),
        score: scoreKey ? String(row[scoreKey]) : null,
        metrics: row,
      }
    })
    .filter(Boolean)
}



// ── Planilha "Estatísticas da partida" / "Team Stats" ─────────────────────
// As duas exportações têm duas linhas por jogo, mas a Team Stats pode listar
// primeiro o Confiança mesmo quando ele é visitante. Por isso a ordem é resolvida
// pelo nome da equipe, quando disponível, e não apenas pela posição das linhas.
function isBlankGeneratedHeader(key) {
  return /^__EMPTY(?:_\d+)?$/i.test(String(key || '').trim())
}

function cleanCompetitionMetrics(row) {
  const out = {}
  for (const [key, value] of Object.entries(row || {})) {
    if (isBlankGeneratedHeader(key)) continue
    out[key] = value
  }
  return out
}

function looksLikeTeamCode(value) {
  const text = String(value || '').trim()
  return /^[A-Z0-9]{2,5}$/.test(text)
}

function teamRowMatches(rowTeam, parsedTeam) {
  const a = normTeamName(rowTeam)
  const b = normTeamName(parsedTeam)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

export function buildCompetitionMatchRecords(rawRows) {
  const groups = new Map()
  let currentGroupKey = null

  for (const row of rawRows || []) {
    const matchKey = findMatchKey(row, ['Match', 'Partida', 'Jogo'])
    const dateKey = findMatchKey(row, ['Data'])
    const teamKey = findMatchKey(row, ['Time', 'Equipa', 'Equipe', 'Clube'])
    const matchLabel = matchKey ? String(row[matchKey] || '').trim() : ''
    const team = teamKey ? String(row[teamKey] || '').trim() : ''

    // No export tradicional, Data/Match aparecem só na linha do mandante e a
    // linha seguinte (visitante) vem com essas células vazias. Na Team Stats,
    // Data/Jogo costumam ser repetidos nas duas linhas. O agrupamento abaixo
    // aceita os dois formatos.
    if (matchLabel) {
      const parsed = parseMatchLabel(matchLabel)
      const matchDate = parseSpreadsheetDate(dateKey ? row[dateKey] : null)
      if (parsed && matchDate) {
        currentGroupKey = `${matchDate}|${normTeamName(parsed.homeTeam)}|${normTeamName(parsed.awayTeam)}`
        if (!groups.has(currentGroupKey)) {
          groups.set(currentGroupKey, { matchDate, matchLabel, parsed, entries: [] })
        }
      } else {
        currentGroupKey = null
      }
    }

    if (!team || !currentGroupKey) continue
    const group = groups.get(currentGroupKey)
    if (!group) continue
    // Evita linhas duplicadas da mesma equipe dentro do mesmo confronto.
    if (!group.entries.some(entry => normTeamName(entry.team) === normTeamName(team))) {
      group.entries.push({ row, team })
    }
  }

  const records = []
  for (const group of groups.values()) {
    if (group.entries.length < 2) continue
    const { parsed } = group
    let homeEntry = null
    let awayEntry = null

    const hasFullNames = group.entries.some(entry => !looksLikeTeamCode(entry.team))
    if (hasFullNames) {
      homeEntry = group.entries.find(entry => teamRowMatches(entry.team, parsed.homeTeam)) || null
      awayEntry = group.entries.find(entry => teamRowMatches(entry.team, parsed.awayTeam)) || null
    }

    // Exportação tradicional usa códigos (ANA/GUA). Nela a primeira linha é
    // mandante e a segunda visitante, pois os códigos não permitem casar com
    // os nomes completos do rótulo de forma confiável.
    if (!homeEntry || !awayEntry) {
      homeEntry = group.entries[0]
      awayEntry = group.entries[1]
    }

    records.push({
      matchDate: group.matchDate,
      matchLabel: group.matchLabel,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      homeCode: looksLikeTeamCode(homeEntry.team) ? homeEntry.team : null,
      awayCode: looksLikeTeamCode(awayEntry.team) ? awayEntry.team : null,
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
      homeMetrics: cleanCompetitionMetrics(homeEntry.row),
      awayMetrics: cleanCompetitionMetrics(awayEntry.row),
    })
  }

  return inferRounds(records)
}

