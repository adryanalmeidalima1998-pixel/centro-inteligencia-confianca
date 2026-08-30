// lib/serieCParse.js
// ─────────────────────────────────────────────────────────────────────────────
// Leitura das planilhas Excel (times / jogadores de linha / goleiros) no
// upload semanal. Usa a lib "xlsx" (SheetJS) só no server (rota de API).
// Lê a primeira aba, usa a primeira linha como cabeçalho e devolve um array
// de objetos { "Nome da Coluna": valor }, exatamente como veio da planilha.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx'
import { extractPlayerIdentity, extractTeamIdentity, isGuaraniTeam, normTeamName } from './serieC'
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
      return { team, isGuarani: isGuaraniTeam(team), metrics: row }
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
        isGuarani: isGuaraniTeam(id.team),
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
        isGuarani: isGuaraniTeam(id.team),
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

