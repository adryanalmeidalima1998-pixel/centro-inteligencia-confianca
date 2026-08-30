// lib/nameMatch.js
// ─────────────────────────────────────────────────────────────────────────────
// Motor de correlação de nomes entre fontes diferentes (planilha de bem-estar,
// PSE, GPS/Catapult, elenco). Resolve acentos, nome do meio, ordem trocada,
// abreviações ("CARLOS E." -> "CARLOS EDUARDO") e apelidos via tabela de aliases.
//
// Fluxo de resolução (do mais forte pro mais fraco):
//   1. Igualdade normalizada exata
//   2. Equivalência por grupo de alias (player_aliases)
//   3. Fuzzy por tokens (com guarda de primeiro nome + margem de desempate)
// ─────────────────────────────────────────────────────────────────────────────

// Partículas que não ajudam a identificar a pessoa (preposições/conectivos).
// "E" NÃO entra aqui de propósito: em "CARLOS E." o E é inicial do nome do meio.
const PARTICLES = new Set([
  'DE', 'DA', 'DO', 'DAS', 'DOS', 'DI', 'DEL', 'DELLA', 'LA', 'LE',
  'VON', 'VAN', 'Y', 'DOS', 'DAS',
])

// Normaliza: tira acento, caixa alta, troca pontuação por espaço, colapsa espaços.
export function normName(s) {
  return (s == null ? '' : String(s))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')    // pontos, hífens, etc. viram espaço ("E." -> "E")
    .replace(/\s+/g, ' ')
    .trim()
}

// Tokens úteis do nome (sem partículas).
export function nameTokens(s) {
  return normName(s).split(' ').filter(t => t && !PARTICLES.has(t))
}

// Levenshtein curto (cap em 2) só pra pegar erro de digitação leve.
function lev(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 3
  const m = a.length, n = b.length
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
    if (Math.min(...cur) > 2) return 3 // poda
  }
  return prev[n]
}

// Similaridade entre dois tokens (0..1).
function tokenSim(x, y) {
  if (x === y) return 1
  if (x.length === 1 && y[0] === x) return 0.6      // inicial casa com nome cheio
  if (y.length === 1 && x[0] === y) return 0.6
  if (x.length >= 3 && y.startsWith(x)) return 0.85 // prefixo ("WILL" / "WILLIAN")
  if (y.length >= 3 && x.startsWith(y)) return 0.85
  if (x.length >= 4 && y.length >= 4 && lev(x, y) <= 1) return 0.8 // typo leve
  return 0
}

// Pontuação de match entre dois conjuntos de tokens (0..1) + info de 1º nome.
function scoreTokens(aTok, bTok) {
  if (!aTok.length || !bTok.length) return { score: 0, firstOk: false }
  const used = new Array(bTok.length).fill(false)
  let total = 0
  for (const a of aTok) {
    let best = 0, bi = -1
    for (let i = 0; i < bTok.length; i++) {
      if (used[i]) continue
      const s = tokenSim(a, bTok[i])
      if (s > best) { best = s; bi = i }
    }
    if (bi >= 0 && best > 0) { used[bi] = true; total += best }
  }
  const firstOk = tokenSim(aTok[0], bTok[0]) >= 0.6
  return { score: total / Math.min(aTok.length, bTok.length), firstOk }
}

// ── Aliases ──────────────────────────────────────────────────────────────────
// Recebe linhas da tabela player_aliases ({ source_name, canonical_name }) e
// monta grupos de equivalência (todos os nomes que apontam pro mesmo canonical).
export function buildAliasGroups(rows) {
  const byCanon = new Map()
  ;(rows || []).forEach(r => {
    const canon = normName(r.canonical_name)
    const src = normName(r.source_name)
    if (!canon) return
    if (!byCanon.has(canon)) byCanon.set(canon, new Set([canon]))
    if (src) byCanon.get(canon).add(src)
  })
  return Array.from(byCanon.values()).map(set => Array.from(set))
}

// nome normalizado -> id do grupo de alias
function indexAliasGroups(aliasGroups) {
  const idx = new Map()
  ;(aliasGroups || []).forEach((g, gi) => {
    g.forEach(n => idx.set(normName(n), gi))
  })
  return idx
}

// ── Resolver principal ───────────────────────────────────────────────────────
// gpsNames: lista de playerName crus vistos no GPS.
// Retorna { resolve(nomeWellness) -> nomeGpsCru | '' , key(nome) -> normName }.
export function buildResolver(gpsNames, aliasGroups) {
  const aliasIdx = indexAliasGroups(aliasGroups)
  const seen = new Set()
  const cands = []
  ;(gpsNames || []).forEach(raw => {
    const key = normName(raw)
    if (!key || seen.has(key)) return
    seen.add(key)
    cands.push({ raw, key, tok: nameTokens(raw), group: aliasIdx.has(key) ? aliasIdx.get(key) : -1 })
  })

  const cache = new Map()

  function resolve(wellnessName) {
    const wkey = normName(wellnessName)
    if (!wkey) return ''
    if (cache.has(wkey)) return cache.get(wkey)

    let result = ''

    // 1. igualdade exata normalizada
    const exact = cands.find(c => c.key === wkey)
    if (exact) { result = exact.raw }

    // 2. grupo de alias
    if (!result && aliasIdx.has(wkey)) {
      const gid = aliasIdx.get(wkey)
      const byGroup = cands.find(c => c.group === gid)
      if (byGroup) result = byGroup.raw
    }

    // 3. fuzzy por tokens (melhor candidato, com margem de desempate)
    if (!result) {
      const wtok = nameTokens(wellnessName)
      let best = null, bestScore = 0, second = 0
      for (const c of cands) {
        const { score, firstOk } = scoreTokens(wtok, c.tok)
        if (!firstOk) continue
        if (score > bestScore) { second = bestScore; bestScore = score; best = c }
        else if (score > second) { second = score }
      }
      if (best && bestScore >= 0.6 && (bestScore - second) >= 0.12) {
        result = best.raw
      }
    }

    cache.set(wkey, result)
    return result
  }

  return { resolve, key: normName, candidates: cands.map(c => c.raw) }
}

// Comparação direta entre dois nomes (útil em .find pontuais).
export function sameAthlete(a, b, aliasGroups) {
  const ka = normName(a), kb = normName(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  const idx = indexAliasGroups(aliasGroups)
  if (idx.has(ka) && idx.has(kb) && idx.get(ka) === idx.get(kb)) return true
  const r = scoreTokens(nameTokens(a), nameTokens(b))
  return r.firstOk && r.score >= 0.62
}
