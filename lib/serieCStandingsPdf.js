// Utilitários puros para transformar a página "POSIÇÕES" do relatório de época
// Wyscout em uma classificação estruturada. O PDF é lido no navegador com
// PDF.js; este arquivo interpreta os itens de texto e valida os dados antes de
// gravar o snapshot semanal.

const EXPECTED_TEAMS = 20

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDecimalText(value) {
  return cleanText(value)
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
}

function parseInteger(value) {
  const text = normalizeDecimalText(value)
  const match = text.match(/-?\d+/)
  return match ? Number(match[0]) : null
}

function parseNumberToken(value) {
  const text = normalizeDecimalText(value)
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

function parseMetricPair(value) {
  const text = normalizeDecimalText(value)
  if (!text) return [null, null]

  const explicitPair = text.match(/^([+-]?\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)$/)
  if (explicitPair) return [Number(explicitPair[1]), Number(explicitPair[2])]

  const zeroDelta = text.match(/^([+-]?\d+\.\d)(0)$/)
  if (zeroDelta) return [Number(zeroDelta[1]), 0]

  const numbers = text.match(/[+-]?\d+(?:\.\d+)?/g) || []
  if (numbers.length >= 2) return [Number(numbers[0]), Number(numbers[1])]
  if (numbers.length === 1) return [Number(numbers[0]), null]
  return [null, null]
}

function numeric(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function normalizeSerieCStandingsRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((raw, index) => {
      const position = Math.trunc(numeric(raw.position, index + 1))
      const points = numeric(raw.points)
      const played = numeric(raw.played)
      const won = numeric(raw.won)
      const drawn = numeric(raw.drawn)
      const lost = numeric(raw.lost)
      const goalsFor = numeric(raw.goalsFor)
      const goalsAgainst = numeric(raw.goalsAgainst)
      const goalDifference = Number.isFinite(Number(raw.goalDifference))
        ? Number(raw.goalDifference)
        : goalsFor - goalsAgainst
      const xg = numeric(raw.xg)
      const xgDelta = Number.isFinite(Number(raw.xgDelta)) ? Number(raw.xgDelta) : xg - goalsFor
      const xga = numeric(raw.xga)
      const xgaDelta = Number.isFinite(Number(raw.xgaDelta)) ? Number(raw.xgaDelta) : xga - goalsAgainst
      const expectedGoalDifference = Number.isFinite(Number(raw.expectedGoalDifference))
        ? Number(raw.expectedGoalDifference)
        : xg - xga
      const expectedGoalDifferenceDelta = Number.isFinite(Number(raw.expectedGoalDifferenceDelta))
        ? Number(raw.expectedGoalDifferenceDelta)
        : expectedGoalDifference - goalDifference
      const xPoints = numeric(raw.xPoints)
      const xPointsDelta = Number.isFinite(Number(raw.xPointsDelta)) ? Number(raw.xPointsDelta) : xPoints - points

      return {
        position,
        team: cleanText(raw.team),
        points,
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference,
        xg,
        xgDelta,
        xga,
        xgaDelta,
        expectedGoalDifference,
        expectedGoalDifferenceDelta,
        xPoints,
        xPointsDelta,
      }
    })
    .filter(row => row.team && row.position > 0)
    .sort((a, b) => a.position - b.position)
}

export function validateSerieCStandingsRows(rows) {
  const normalized = normalizeSerieCStandingsRows(rows)
  const errors = []

  if (normalized.length !== EXPECTED_TEAMS) {
    errors.push(`Foram identificadas ${normalized.length} equipes; o esperado para a Série C é ${EXPECTED_TEAMS}.`)
  }

  const positions = new Set(normalized.map(row => row.position))
  const teams = new Set(normalized.map(row => row.team.toLocaleLowerCase('pt-BR')))
  if (positions.size !== normalized.length) errors.push('Há posições repetidas na classificação.')
  if (teams.size !== normalized.length) errors.push('Há equipes repetidas na classificação.')

  for (const row of normalized) {
    if (row.position < 1 || row.position > EXPECTED_TEAMS) errors.push(`Posição inválida para ${row.team}.`)
    if (row.played < 0 || row.won < 0 || row.drawn < 0 || row.lost < 0) errors.push(`Campanha inválida para ${row.team}.`)
    if (Math.round(row.won + row.drawn + row.lost) !== Math.round(row.played)) errors.push(`J/V/E/D não fecha para ${row.team}.`)
    if (Math.round(row.won * 3 + row.drawn) !== Math.round(row.points)) errors.push(`Pontuação não fecha para ${row.team}.`)
  }

  if (!normalized.some(row => row.team.toLocaleLowerCase('pt-BR').includes('confianca'))) {
    errors.push('O Confiança não foi identificado na classificação.')
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)], rows: normalized }
}

function rawCoordinates(item, viewportHeight, viewportWidth) {
  const transform = Array.isArray(item?.transform) ? item.transform : []
  const rawX = Number(item?.x ?? transform[4])
  const rawY = Number(item?.top ?? transform[5])
  const xScale = Number.isFinite(viewportWidth) && viewportWidth > 0 ? 595.2756 / viewportWidth : 1
  const yScale = Number.isFinite(viewportHeight) && viewportHeight > 0 ? 841.8898 / viewportHeight : 1
  return {
    x: rawX * xScale,
    // Para agrupar uma linha só precisamos que todos os itens usem a mesma
    // orientação. O y bruto do PDF.js é muito mais estável que tentar adivinhar
    // "top" em navegadores diferentes.
    y: rawY * yScale,
    text: cleanText(item?.str ?? item?.text),
    index: Number(item?.__index ?? 0),
  }
}

function dedupeItems(items) {
  const seen = new Set()
  return items.filter(item => {
    const key = `${Math.round(item.x)}|${Math.round(item.y * 2)}|${item.text}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function textInRange(items, minX, maxX) {
  const unique = dedupeItems(items.filter(item => item.x >= minX && item.x < maxX && item.text))
  return unique
    .sort((a, b) => a.x - b.x || a.index - b.index)
    .map(item => item.text)
    .join('')
}

function rowItemsAround(items, y) {
  return items.filter(item => Math.abs(item.y - y) <= 5.2)
}

function rowFromTextItems(positionItem, allItems) {
  const rowItems = rowItemsAround(allItems, positionItem.y)
  const position = parseInteger(positionItem.text)
  const team = dedupeItems(rowItems
    .filter(item => item.x >= 45 && item.x < 125 && item.text))
    .sort((a, b) => a.x - b.x || a.index - b.index)
    .map(item => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  const points = parseInteger(textInRange(rowItems, 120, 150))
  const played = parseInteger(textInRange(rowItems, 150, 195))
  const won = parseInteger(textInRange(rowItems, 195, 230))
  const drawn = parseInteger(textInRange(rowItems, 230, 265))
  const lost = parseInteger(textInRange(rowItems, 265, 305))
  const goalsFor = parseInteger(textInRange(rowItems, 305, 350))
  const goalsAgainst = parseInteger(textInRange(rowItems, 350, 390))
  const goalDifference = parseInteger(textInRange(rowItems, 390, 423))
  const [xg, xgDelta] = parseMetricPair(textInRange(rowItems, 423, 460))
  const [xga, xgaDelta] = parseMetricPair(textInRange(rowItems, 460, 510))
  const [expectedGoalDifference, expectedGoalDifferenceDelta] = parseMetricPair(textInRange(rowItems, 520, 565))
  const [xPoints, xPointsDelta] = parseMetricPair(textInRange(rowItems, 565, 610))

  return {
    position,
    team,
    points,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference,
    xg,
    xgDelta,
    xga,
    xgaDelta,
    expectedGoalDifference,
    expectedGoalDifferenceDelta,
    xPoints,
    xPointsDelta,
  }
}

function buildCoordinateRows(items) {
  // O PDF possui alguns textos duplicados em camadas diferentes. O filtro por
  // x + número captura a coluna de posição e ignora página/ano/cabeçalhos.
  const positions = dedupeItems(items
    .filter(item => item.x >= 5 && item.x < 45 && /^(?:[1-9]|1\d|20)$/.test(item.text)))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const byPosition = new Map()
  for (const positionItem of positions) {
    const row = rowFromTextItems(positionItem, items)
    if (row.position >= 1 && row.position <= EXPECTED_TEAMS && row.team && !byPosition.has(row.position)) {
      byPosition.set(row.position, row)
    }
  }
  return [...byPosition.values()].sort((a, b) => a.position - b.position)
}

function isPlainNumericToken(text) {
  return /^[+-]?\d+(?:[.,]\d+)?$/.test(cleanText(text))
}

function looksLikeRowStart(tokens, index) {
  const position = parseInteger(tokens[index])
  if (!Number.isInteger(position) || position < 1 || position > EXPECTED_TEAMS) return false
  if (!/^\d{1,2}$/.test(cleanText(tokens[index]))) return false
  // Uma nova linha tem posição seguida por nome de equipe, nunca por outro valor.
  for (let j = index + 1; j < Math.min(tokens.length, index + 5); j += 1) {
    const next = cleanText(tokens[j])
    if (!next) continue
    return !isPlainNumericToken(next)
  }
  return false
}

function rowFromLinearTokens(position, team, numericTokens) {
  let values = numericTokens
    .map(parseNumberToken)
    .filter(value => value !== null)

  // No Wyscout a coluna de pontos pode aparecer duas vezes sobreposta no PDF.
  // Na ordem de leitura isso vira, por exemplo, 28, 28, 16, 8, 4...
  if (values.length >= 16 && values[0] === values[1]) values = values.slice(1)
  if (values.length < 8) return null

  return {
    position,
    team,
    points: values[0] ?? null,
    played: values[1] ?? null,
    won: values[2] ?? null,
    drawn: values[3] ?? null,
    lost: values[4] ?? null,
    goalsFor: values[5] ?? null,
    goalsAgainst: values[6] ?? null,
    goalDifference: values[7] ?? null,
    xg: values[8] ?? null,
    xgDelta: values[9] ?? null,
    xga: values[10] ?? null,
    xgaDelta: values[11] ?? null,
    expectedGoalDifference: values[12] ?? null,
    expectedGoalDifferenceDelta: values[13] ?? null,
    xPoints: values[14] ?? null,
    xPointsDelta: values[15] ?? null,
  }
}

function buildLinearRows(rawItems) {
  const tokens = (Array.isArray(rawItems) ? rawItems : [])
    .map(item => cleanText(item?.str ?? item?.text))
    .filter(Boolean)

  const start = Math.max(0, tokens.findIndex(token => /Época Regular/i.test(token)))
  const rows = []
  let i = start

  while (i < tokens.length) {
    if (!looksLikeRowStart(tokens, i)) {
      i += 1
      continue
    }

    const position = parseInteger(tokens[i])
    let cursor = i + 1
    const teamParts = []
    while (cursor < tokens.length && !isPlainNumericToken(tokens[cursor])) {
      const text = cleanText(tokens[cursor])
      if (text && !/^(RELATÓRIO|POSIÇÕES|Brazil\.|2026)$/i.test(text)) teamParts.push(text)
      cursor += 1
      if (teamParts.length > 6) break
    }
    const team = teamParts.join(' ').replace(/\s+/g, ' ').trim()

    const numericTokens = []
    while (cursor < tokens.length) {
      if (looksLikeRowStart(tokens, cursor)) break
      if (isPlainNumericToken(tokens[cursor])) numericTokens.push(tokens[cursor])
      cursor += 1
    }

    const row = rowFromLinearTokens(position, team, numericTokens)
    if (row?.team) rows.push(row)
    i = Math.max(cursor, i + 1)
  }

  const unique = new Map()
  for (const row of rows) {
    if (!unique.has(row.position)) unique.set(row.position, row)
  }
  return [...unique.values()].sort((a, b) => a.position - b.position)
}

export function parseWyscoutStandingsTextItems(rawItems, viewportHeight, viewportWidth) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map((item, index) => rawCoordinates({ ...item, __index: index }, viewportHeight, viewportWidth))
    .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y) && item.text)

  const coordinateRows = buildCoordinateRows(items)
  const coordinateValidation = validateSerieCStandingsRows(coordinateRows)
  if (coordinateValidation.ok) {
    return {
      ...coordinateValidation,
      inferredRound: Math.max(...coordinateValidation.rows.map(row => numeric(row.played))),
      parser: 'coordinates',
    }
  }

  // Fallback decisivo: usa a ordem dos itens de texto do PDF.js e não depende
  // de coordenadas/Y. Isso cobre variações do Edge/Chrome e PDFs com camadas de
  // texto sobrepostas, que eram responsáveis pelo erro de "0 equipes".
  const linearRows = buildLinearRows(rawItems)
  const linearValidation = validateSerieCStandingsRows(linearRows)
  const best = linearValidation.rows.length >= coordinateValidation.rows.length
    ? linearValidation
    : coordinateValidation

  const inferredRound = best.rows.length
    ? Math.max(...best.rows.map(row => numeric(row.played)))
    : null

  return {
    ...best,
    inferredRound,
    parser: best === linearValidation ? 'linear' : 'coordinates',
    diagnostics: {
      coordinateTeams: coordinateValidation.rows.length,
      linearTeams: linearValidation.rows.length,
      textItems: Array.isArray(rawItems) ? rawItems.length : 0,
    },
  }
}
