import { extractTransfermarktFactsWithAI } from './treinador-ai'

const ALLOWED_HOSTS = new Set([
  'transfermarkt.com.br', 'www.transfermarkt.com.br',
  'transfermarkt.com', 'www.transfermarkt.com',
  'transfermarkt.de', 'www.transfermarkt.de'
])

const ENTITY_MAP = {
  '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&lt;': '<', '&gt;': '>', '&ndash;': '–', '&mdash;': '—', '&middot;': '·'
}

function decodeHtml(input = '') {
  return String(input)
    .replace(/&(nbsp|amp|quot|apos|lt|gt|ndash|mdash|middot);/gi, m => ENTITY_MAP[m.toLowerCase()] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

function stripTags(input = '') {
  return decodeHtml(String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}


function cleanReadableText(value = '') {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<https?:\/\/[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function readableLines(source = '') {
  return String(source || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(cleanReadableText)
    .filter(Boolean)
}

function splitMarkdownRow(line = '') {
  if (!String(line).includes('|')) return []
  return String(line)
    .split('|')
    .map(cleanReadableText)
    .filter(cell => cell && !/^:?-{3,}:?$/.test(cell))
}

function extractReadableName(source = '') {
  const lines = readableLines(source)
  const heading = lines.find(line => /^#\s+/.test(line))
  if (heading) return heading.replace(/^#+\s*/, '').replace(/\s*-\s*Ficha de treinador.*$/i, '').trim()
  const title = lines.find(line => /Ficha de treinador/i.test(line))
  return title ? title.replace(/\s*-\s*Ficha de treinador.*$/i, '').replace(/^#+\s*/, '').trim() : null
}

function extractReadableField(source = '', labels = []) {
  const lines = readableLines(source)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const label of labels) {
      const escaped = esc(label)
      const inline = line.match(new RegExp(`(?:^|\\*\\s*)${escaped}\\s*:?\\s*(?:\\|\\s*)?(.+)$`, 'i'))
      if (inline?.[1]) {
        const value = cleanReadableText(inline[1]).replace(/^\|\s*/, '').trim()
        if (value && value.toLowerCase() !== label.toLowerCase()) return value
      }
      if (new RegExp(`^${escaped}\\s*:?$`, 'i').test(line) && lines[i + 1]) {
        return cleanReadableText(lines[i + 1])
      }
    }
  }
  return null
}

function parseCareerReadable(source = '') {
  const lines = readableLines(source)
  const header = lines.findIndex(line => /Time e cargo/i.test(line) && /Entrada/i.test(line) && /PPJ/i.test(line))
  if (header < 0) return []
  const rows = []
  let pendingClub = null
  for (let i = header + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^#{1,3}\s/.test(line) && rows.length) break
    if (/^\d{4,}$/.test(line) && rows.length) break
    if (/^Links Rápidos/i.test(line) && rows.length) break
    if (/^---/.test(line)) continue

    let cells = splitMarkdownRow(line)
    if (cells.length >= 5) {
      // Normal Transfermarkt markdown: club | role | entrada | saída | jogos | ppj
      if (cells.length >= 6 && /Treinador/i.test(cells[1])) {
        rows.push({
          clube: cells[0],
          cargo: cells[1],
          entrada: extractDate(cells[2]) || cells[2] || null,
          saida: cells[3] === '-' ? null : (extractDate(cells[3]) || cells[3] || null),
          jogos: Number(String(cells[4] || '').replace(/\D/g, '')) || 0,
          ppj: Number(String(cells[5] || '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0
        })
        pendingClub = null
        continue
      }
      // Reader may split the club onto the prior line.
      if (pendingClub && /Treinador/i.test(cells[0])) {
        rows.push({
          clube: pendingClub,
          cargo: cells[0],
          entrada: extractDate(cells[1]) || cells[1] || null,
          saida: cells[2] === '-' ? null : (extractDate(cells[2]) || cells[2] || null),
          jogos: Number(String(cells[3] || '').replace(/\D/g, '')) || 0,
          ppj: Number(String(cells[4] || '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0
        })
        pendingClub = null
        continue
      }
    }

    // Some readers render the club on one line and the rest of the row on the next.
    if (!line.includes('|') && !/Treinador/i.test(line) && line.length < 80) {
      pendingClub = line.replace(/^[-*]\s*/, '').trim()
      continue
    }
    if (pendingClub && /Treinador/i.test(line) && line.includes('|')) {
      cells = splitMarkdownRow(line)
      if (cells.length >= 5) {
        rows.push({
          clube: pendingClub,
          cargo: cells[0],
          entrada: extractDate(cells[1]) || cells[1] || null,
          saida: cells[2] === '-' ? null : (extractDate(cells[2]) || cells[2] || null),
          jogos: Number(String(cells[3] || '').replace(/\D/g, '')) || 0,
          ppj: Number(String(cells[4] || '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0
        })
        pendingClub = null
      }
    }
  }
  return rows.filter(row => row.clube && row.cargo && /Treinador/i.test(row.cargo))
}

function parseMatchesReadable(source = '') {
  const lines = readableLines(source)
  const header = lines.findIndex(line => /Data/i.test(line) && /Competi[cç][aã]o/i.test(line) && /Time da casa/i.test(line) && /T[aá]tica/i.test(line))
  if (header < 0) return []
  const matches = []
  for (let i = header + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^#{1,3}\s/.test(line) && matches.length) break
    if (!/^\d{2}\/\d{2}\/\d{4}/.test(line)) continue
    const cells = splitMarkdownRow(line)
    if (cells.length < 7) continue

    // Remove occasional empty/duplicated reader cells and anchor noise.
    const cleanCells = cells.map(cleanReadableText).filter(Boolean)
    const dateIdx = cleanCells.findIndex(value => /^\d{2}\/\d{2}\/\d{4}$/.test(value))
    if (dateIdx < 0) continue
    const row = cleanCells.slice(dateIdx)
    if (row.length < 7) continue
    const [data, competicao, temporada, rodada, mandante, placar, visitante, tatica] = row
    if (!mandante || !visitante || !/^\d+\s*[:x-]\s*\d+/i.test(placar || '')) continue
    matches.push({
      data,
      competicao: String(competicao || '').trim(),
      temporada: temporada || null,
      rodada: rodada || null,
      mandante: String(mandante).trim(),
      placar: String(placar).trim(),
      visitante: String(visitante).trim(),
      tatica: tatica && tatica !== '?' ? String(tatica).trim() : null
    })
  }
  return matches
}

function esc(value = '') { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function extractLabelValue(html, labels = []) {
  for (const label of labels) {
    const e = esc(label)
    const patterns = [
      new RegExp(`${e}[\\s\\S]{0,500}?info-table__content--bold[^>]*>([\\s\\S]*?)<\\/span>`, 'i'),
      new RegExp(`${e}[\\s\\S]{0,500}?<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i'),
      new RegExp(`<[^>]+>\\s*${e}\\s*:?[\\s]*<\\/[^>]+>[\\s\\S]{0,250}?<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, 'i')
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]) {
        const val = stripTags(match[1])
        if (val && val.toLowerCase() !== label.toLowerCase()) return val
      }
    }
  }
  return null
}

function extractName(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  return h1 ? stripTags(h1[1]) : null
}

function extractPhoto(html, name) {
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0])
  const candidates = imgs.filter(tag => {
    const low = tag.toLowerCase()
    return low.includes('portrait') || low.includes('bilder') || (name && low.includes(name.toLowerCase().split(' ')[0]))
  })
  for (const tag of candidates) {
    const src = tag.match(/(?:data-src|src)=["']([^"']+)["']/i)?.[1]
    if (src && /^https?:\/\//i.test(src)) return decodeHtml(src)
  }
  return null
}

function extractTables(html) {
  return [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(m => m[0])
}

function extractRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1])
}

function extractCells(rowHtml) {
  return [...rowHtml.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(m => ({ html: m[1], text: stripTags(m[1]) }))
}

function firstUsefulAnchor(cellHtml) {
  const links = [...cellHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m => stripTags(m[1]))
    .filter(Boolean)
  return links.find(t => t.length > 1 && !/^\d+(?:[.,]\d+)?$/.test(t)) || links[0] || null
}

function extractDate(value = '') {
  return value.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || null
}

function parsePtDate(value) {
  const m = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
}

function slugText(value='') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
}

function clubMatches(a, b) {
  const x = slugText(a), y = slugText(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

function parseCareer(html) {
  const table = extractTables(html).find(t => /PPJ/i.test(stripTags(t)) && /(Entrada|Entry)/i.test(stripTags(t)))
  if (!table) return []
  const rows = []
  for (const row of extractRows(table)) {
    const cells = extractCells(row)
    if (cells.length < 5) continue
    const all = cells.map(c => c.text)
    if (all.some(v => /Time e cargo|Team and position/i.test(v))) continue
    const club = firstUsefulAnchor(cells[0].html) || all[0]
    if (!club) continue
    const tail = all.slice(-4)
    const [entradaRaw, saidaRaw, jogosRaw, ppjRaw] = tail
    const first = all.slice(0, Math.max(1, all.length - 4)).join(' ').trim()
    const role = first.replace(club, '').replace(/\s+/g, ' ').trim() || 'Treinador'
    const jogos = Number(String(jogosRaw || '').replace(/[^0-9]/g, '')) || 0
    const ppj = Number(String(ppjRaw || '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0
    rows.push({
      clube: club,
      cargo: role,
      entrada: extractDate(entradaRaw) || entradaRaw || null,
      saida: extractDate(saidaRaw) || (saidaRaw === '-' ? null : saidaRaw || null),
      jogos,
      ppj
    })
  }
  return rows
}

function anchorTextByHref(cellHtml='', pattern) {
  const links = [...String(cellHtml).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  for (const match of links) {
    const attrs = match[1] || ''
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1] || ''
    if (pattern.test(href)) {
      const text = stripTags(match[2])
      if (text) return text
    }
  }
  return null
}

function looksLikeFormation(value='') {
  const text = stripTags(value).trim()
  return text === '?' || /^\d(?:-\d+){2,}(?:\s+[\p{L}0-9+./-]+(?:\s+[\p{L}0-9+./-]+)*)?$/iu.test(text)
}

function parseMatches(html) {
  const table = extractTables(html).find(t => /Time da casa/i.test(stripTags(t)) && /(Tática|Formation)/i.test(stripTags(t)))
  if (!table) return []
  const result = []

  for (const row of extractRows(table)) {
    const cells = extractCells(row)
    if (!cells.length) continue

    const dateIdx = cells.findIndex(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c.text))
    if (dateIdx < 0) continue

    const scoreIdx = cells.findIndex((c, idx) => idx > dateIdx && /^\d+\s*[:x-]\s*\d+(?:\s*\([^)]*\))?$/i.test(c.text))
    if (scoreIdx < 0) continue

    // Transfermarkt inclui células auxiliares/links vazios. Os clubes são
    // identificados pelos links /verein/ em vez de posição fixa na tabela.
    const teamCells = cells
      .map((c, idx) => ({ idx, text: anchorTextByHref(c.html, /\/verein\//i) || null }))
      .filter(x => x.text)

    const homeTeam = [...teamCells].reverse().find(x => x.idx < scoreIdx)?.text || null
    const awayTeam = teamCells.find(x => x.idx > scoreIdx)?.text || null
    if (!homeTeam || !awayTeam) continue

    // Competição e temporada também são identificadas semanticamente.
    const competitionCell = cells.find((c, idx) => idx > dateIdx && idx < scoreIdx && /\/wettbewerb\//i.test(c.html))
    const competicao = competitionCell ? (anchorTextByHref(competitionCell.html, /\/wettbewerb\//i) || competitionCell.text) : (cells[dateIdx + 1]?.text || '')
    const temporada = cells
      .slice(dateIdx + 1, scoreIdx)
      .map(c => c.text)
      .find(v => /^(?:\d{4}|\d{2}\/\d{2})$/.test(v)) || null

    const rodada = cells
      .slice(dateIdx + 1, scoreIdx)
      .map(c => c.text)
      .find(v => v && v !== competicao && v !== temporada && !/^[A-Z]{2,4}$/.test(v) && !/^\d+$/.test(v)) || null

    let tatica = null
    for (let i = cells.length - 1; i > scoreIdx; i--) {
      const value = cells[i].text
      if (looksLikeFormation(value)) {
        tatica = value === '?' ? null : value
        break
      }
    }

    result.push({
      data: cells[dateIdx].text,
      competicao: String(competicao || '').trim(),
      temporada,
      rodada,
      mandante: String(homeTeam).trim(),
      placar: String(cells[scoreIdx].text).trim(),
      visitante: String(awayTeam).trim(),
      tatica: tatica ? String(tatica).trim() : null
    })
  }

  return result
}

function findSpellForMatch(match, career) {
  const d = parsePtDate(match.data)
  if (!d) return null
  return career.find(spell => {
    const ini = parsePtDate(spell.entrada)
    const fim = parsePtDate(spell.saida) || new Date(Date.UTC(2099,0,1))
    return ini && d >= ini && d <= fim && (clubMatches(match.mandante, spell.clube) || clubMatches(match.visitante, spell.clube))
  }) || career.find(spell => {
    const ini = parsePtDate(spell.entrada)
    const fim = parsePtDate(spell.saida) || new Date(Date.UTC(2099,0,1))
    return ini && d >= ini && d <= fim
  }) || null
}

function resultForCoach(match, club) {
  const nums = String(match.placar || '').match(/(\d+)\s*[:x-]\s*(\d+)/i)
  if (!nums || !club) return null
  const home = Number(nums[1]), away = Number(nums[2])
  const isHome = clubMatches(match.mandante, club)
  const isAway = clubMatches(match.visitante, club)
  if (!isHome && !isAway) return null
  const gf = isHome ? home : away
  const ga = isHome ? away : home
  return { gf, ga, result: gf > ga ? 'V' : gf < ga ? 'D' : 'E' }
}

function aggregate(matches, career) {
  let v=0,e=0,d=0,gf=0,ga=0,known=0
  const formations = new Map()
  const byClub = new Map()
  const enriched = matches.map((m, idx) => {
    const spell = findSpellForMatch(m, career)
    const r = resultForCoach(m, spell?.clube)
    if (r) {
      known++; gf += r.gf; ga += r.ga
      if (r.result === 'V') v++; else if (r.result === 'E') e++; else d++
      const cur = byClub.get(spell.clube) || { clube:spell.clube, jogos:0, v:0, e:0, d:0, gf:0, ga:0 }
      cur.jogos++; cur.gf += r.gf; cur.ga += r.ga; cur[r.result.toLowerCase()]++
      byClub.set(spell.clube, cur)
    }
    if (m.tatica && m.tatica !== '?') formations.set(m.tatica, (formations.get(m.tatica)||0)+1)
    return { id: idx+1, ...m, clube_treinador: spell?.clube || null, resultado_treinador: r?.result || null, gols_pro: r?.gf ?? null, gols_contra: r?.ga ?? null }
  })

  const careerGames = career.reduce((sum, c) => sum + (Number(c.jogos)||0), 0)
  const weightedPpj = careerGames ? career.reduce((sum,c)=>sum+(Number(c.ppj)||0)*(Number(c.jogos)||0),0)/careerGames : 0
  const jogosComFormacao = [...formations.values()].reduce((sum,n)=>sum+n,0)
  const formationList = [...formations.entries()].sort((a,b)=>b[1]-a[1]).map(([formacao,jogos])=>({
    formacao,jogos,
    percentual: jogosComFormacao ? Math.round((jogos/jogosComFormacao)*1000)/10 : 0,
    percentual_total: matches.length ? Math.round((jogos/matches.length)*1000)/10 : 0
  }))
  const baseMap = new Map()
  for (const [formacao,jogos] of formations.entries()) {
    const base = String(formacao).match(/\b(\d(?:-\d+)+)\b/)?.[1] || String(formacao).trim()
    baseMap.set(base,(baseMap.get(base)||0)+jogos)
  }
  const esquemasBase = [...baseMap.entries()].sort((a,b)=>b[1]-a[1]).map(([formacao,jogos])=>({
    formacao,jogos,percentual:jogosComFormacao ? Math.round((jogos/jogosComFormacao)*1000)/10 : 0
  }))
  const clubs = [...byClub.values()].map(x=>({ ...x, aproveitamento: x.jogos ? Math.round(((x.v*3+x.e)/(x.jogos*3))*1000)/10 : 0 })).sort((a,b)=>b.jogos-a.jogos)
  const biggestWins = enriched.filter(x=>x.resultado_treinador==='V').sort((a,b)=>((b.gols_pro-b.gols_contra)-(a.gols_pro-a.gols_contra)) || (b.gols_pro-a.gols_pro)).slice(0,5)
  const seasonMap = new Map()
  for (const game of enriched) {
    const season = game.temporada || 'Sem temporada'
    const current = seasonMap.get(season) || { temporada:season, jogos:0, formacoes:new Map(), clubes:new Map() }
    current.jogos++
    if (game.tatica && game.tatica !== '?') current.formacoes.set(game.tatica,(current.formacoes.get(game.tatica)||0)+1)
    if (game.clube_treinador) current.clubes.set(game.clube_treinador,(current.clubes.get(game.clube_treinador)||0)+1)
    seasonMap.set(season,current)
  }
  const evolucaoTatica = [...seasonMap.values()].map(x=>({
    temporada:x.temporada, jogos:x.jogos,
    clubes:[...x.clubes.entries()].sort((a,b)=>b[1]-a[1]).map(([clube])=>clube).slice(0,2),
    formacoes:[...x.formacoes.entries()].sort((a,b)=>b[1]-a[1]).map(([formacao,jogos])=>({formacao,jogos})).slice(0,4)
  }))

  return {
    jogos_detalhados: known,
    vitorias: v, empates:e, derrotas:d,
    aproveitamento: known ? Math.round(((v*3+e)/(known*3))*1000)/10 : 0,
    ppj_detalhado: known ? Math.round(((v*3+e)/known)*100)/100 : 0,
    gols_pro: gf, gols_contra:ga,
    saldo: gf-ga,
    jogos_carreira: careerGames,
    ppj_carreira: Math.round(weightedPpj*100)/100,
    jogos_com_formacao: jogosComFormacao,
    formacoes: formationList,
    esquemas_base: esquemasBase,
    clubes_detalhados: clubs,
    maiores_vitorias: biggestWins,
    evolucao_tatica: evolucaoTatica,
    ultimos_10: enriched.slice(0,10),
    jogos_enriquecidos: enriched
  }
}

export function normalizeTransfermarktTrainerUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('Informe a URL do treinador no Transfermarkt.')
  let url
  try { url = new URL(raw) } catch { throw new Error('URL do Transfermarkt inválida.') }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error('Use uma URL oficial do Transfermarkt.')
  const id = url.pathname.match(/\/trainer\/(\d+)/)?.[1]
  if (!id) throw new Error('Não foi possível identificar o ID do treinador na URL.')
  const nameSlug = url.pathname.split('/').filter(Boolean)[0] || 'trainer'
  const origin = 'https://www.transfermarkt.com.br'
  return {
    id,
    profileUrl: `${origin}/${nameSlug}/profil/trainer/${id}`,
    performanceUrl: `${origin}/${nameSlug}/leistungsdatenDetail/trainer/${id}/saison_id//verein_id//gegner_id//liga//wettbewerb_id//datum_zu//datum_ab//trainer_id//plus/1`
  }
}

async function fetchDirect(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18000)
  try {
    const res = await fetch(url, {
      cache: 'no-store', redirect: 'follow', signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    if (!res.ok) throw Object.assign(new Error(`Transfermarkt respondeu com HTTP ${res.status}.`), { status:res.status })
    const text = await res.text()
    if (/captcha|access denied|unusual traffic|cf-chl|zugriff verweigert/i.test(text) || text.length < 1200) {
      throw new Error('Resposta direta do Transfermarkt incompleta ou bloqueada.')
    }
    return text
  } finally { clearTimeout(timer) }
}

async function fetchReader(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 24000)
  try {
    const target = `https://r.jina.ai/${url}`
    const headers = { 'Accept':'text/plain', 'X-Return-Format':'markdown', 'X-Timeout':'18' }
    if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
    const res = await fetch(target, { cache:'no-store', redirect:'follow', signal:controller.signal, headers })
    if (!res.ok) throw new Error(`Leitor web respondeu com HTTP ${res.status}.`)
    const text = await res.text()
    if (!text || text.length < 800) throw new Error('Leitor web retornou conteúdo insuficiente.')
    return text
  } finally { clearTimeout(timer) }
}

async function fetchTransfermarktPage(url) {
  let html = null, readable = null, directError = null
  try {
    html = await fetchDirect(url)
    readable = stripTags(html)
    // Se a leitura direta veio completa, não chama um segundo serviço e reduz
    // bastante o tempo da função na Vercel.
    if (html && readable && readable.length > 1200) return { html, readable, source:'direct' }
  } catch (err) { directError = err }

  // O Reader só entra como fallback quando o Transfermarkt bloqueia ou devolve
  // conteúdo insuficiente para o datacenter da Vercel.
  try {
    const reader = await fetchReader(url)
    if (reader) readable = reader
    return { html, readable:readable || '', source:'reader' }
  } catch (readerError) {
    if (!html && directError) {
      const err = new Error(`Não foi possível ler o Transfermarkt. Direto: ${directError.message} Leitor: ${readerError.message}`)
      err.status = directError.status
      throw err
    }
    return { html, readable:readable || '', source:'direct-partial' }
  }
}

function pick(value, fallback) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return fallback
  return value
}

function normalizeAiCareer(list=[]) {
  return list.filter(x=>x?.clube).map(x=>({
    clube:String(x.clube).trim(), cargo:String(x.cargo||'Treinador').trim(),
    entrada:x.entrada || null, saida:x.saida && x.saida !== '-' ? x.saida : null,
    jogos:Number(x.jogos)||0, ppj:Number(x.ppj)||0
  }))
}

function normalizeAiMatches(list=[]) {
  return list.filter(x=>x?.data && x?.mandante && x?.visitante && x?.placar).map((x,i)=>({
    id:i+1, data:String(x.data).trim(), competicao:String(x.competicao||'').trim(), temporada:x.temporada||null,
    rodada:x.rodada||null, mandante:String(x.mandante).trim(), placar:String(x.placar).trim(), visitante:String(x.visitante).trim(),
    tatica:x.tatica && x.tatica !== '?' ? String(x.tatica).trim() : null
  }))
}

export async function scrapeTransfermarktTrainer(inputUrl, options = {}) {
  const urls = normalizeTransfermarktTrainerUrl(inputUrl)
  const allowAiFallback = options.allowAiFallback === true
  const [profileResult, performanceResult] = await Promise.allSettled([
    fetchTransfermarktPage(urls.profileUrl),
    fetchTransfermarktPage(urls.performanceUrl)
  ])
  if (profileResult.status !== 'fulfilled') throw profileResult.reason
  const profilePage = profileResult.value
  const performancePage = performanceResult.status === 'fulfilled' ? performanceResult.value : { html:'', readable:'' }
  const performanceWarning = performanceResult.status === 'rejected' ? performanceResult.reason?.message || 'Falha na página detalhada.' : null

  const profileHtml = profilePage.html || ''
  const performanceHtml = performancePage.html || ''
  const profileReadable = profilePage.readable || ''
  const performanceReadable = performancePage.readable || ''

  // Primeiro usa extração determinística. O formato abaixo replica a lógica
  // do extrator Python validado no Transfermarkt: perfil + trabalhos + partidas.
  let nome = extractName(profileHtml) || extractReadableName(profileReadable)
  let carreira = parseCareer(profileHtml)
  if (!carreira.length) carreira = parseCareerReadable(profileReadable)
  let jogosRaw = parseMatches(performanceHtml)
  if (!jogosRaw.length) jogosRaw = parseMatchesReadable(performanceReadable)
  let ai = null
  let aiWarning = null

  // A IA é apenas fallback factual. Quando a leitura determinística encontrou
  // carreira e partidas, ela NÃO substitui os dados do Transfermarkt. Isso evita
  // truncar listas longas (ex.: 200+ jogos) por limite de saída do modelo.
  const needsAiFacts = !nome || !carreira.length || !jogosRaw.length
  if (process.env.OPENAI_API_KEY && needsAiFacts && allowAiFallback) {
    try {
      ai = await extractTransfermarktFactsWithAI({
        profileText: profileReadable,
        performanceText: performanceReadable,
        profileUrl: urls.profileUrl,
        performanceUrl: urls.performanceUrl
      })
      nome = pick(nome, ai.nome)
      const aiCareer = normalizeAiCareer(ai.carreira)
      const aiMatches = normalizeAiMatches(ai.jogos)
      if (!carreira.length && aiCareer.length) carreira = aiCareer
      if (!jogosRaw.length && aiMatches.length) jogosRaw = aiMatches
    } catch (err) { aiWarning = err.message }
  }

  if (!nome) throw new Error('Não foi possível ler o nome do treinador no Transfermarkt.')
  if (!carreira.length && !jogosRaw.length) {
    const suffix = aiWarning ? ` Processamento inteligente: ${aiWarning}` : ' Configure OPENAI_API_KEY para habilitar a leitura inteligente.'
    throw new Error(`A página foi acessada, mas carreira e jogos não puderam ser estruturados.${suffix}`)
  }

  const metricas = aggregate(jogosRaw, carreira)
  const birthRaw = extractLabelValue(profileHtml, ['Nasc./Idade', 'Nasc./Idade:'])
    || extractReadableField(profileReadable, ['Nasc./Idade'])
  const birth = pick(ai?.data_nascimento,
    extractDate(birthRaw)
    || extractLabelValue(profileHtml, ['Data de nascimento'])
    || extractDate(extractReadableField(profileReadable, ['Data de nascimento']) || '')
  )
  const age = Number(pick(ai?.idade, (birthRaw || '').match(/\((\d{1,3})\)/)?.[1] || 0)) || null
  const currentClubReadable = extractReadableField(profileReadable, ['Clube atual'])
  const currentRoleReadable = extractReadableField(profileReadable, ['Cargo atual'])
  const current = carreira.find(c => !c.saida) || carreira[0] || null

  return {
    transfermarkt_id: urls.id,
    transfermarkt_url: urls.profileUrl,
    performance_url: urls.performanceUrl,
    nome,
    nome_completo: pick(ai?.nome_completo,
      extractLabelValue(profileHtml, ['Nome completo'])
      || extractReadableField(profileReadable, ['Nome completo'])
      || nome
    ),
    data_nascimento: birth,
    idade: age,
    cidade_nascimento: pick(ai?.cidade_nascimento,
      extractLabelValue(profileHtml, ['Local de nascimento'])
      || extractReadableField(profileReadable, ['Local de nascimento'])
    ),
    nacionalidade: pick(ai?.nacionalidade,
      extractLabelValue(profileHtml, ['Nacionalidade'])
      || extractReadableField(profileReadable, ['Nacionalidade'])
    ),
    licenca: pick(ai?.licenca,
      extractLabelValue(profileHtml, ['Licença de treinador', 'Licença'])
      || extractReadableField(profileReadable, ['Licença de treinador', 'Licença'])
    ),
    formacao_preferida: pick(ai?.formacao_preferida,
      extractLabelValue(profileHtml, ['Formação preferida', 'Formação favorita'])
      || extractReadableField(profileReadable, ['Formação preferida', 'Formação favorita'])
    ),
    media_tempo_cargo: pick(ai?.media_tempo_cargo,
      extractLabelValue(profileHtml, ['Média de tempo como treinador'])
      || extractReadableField(profileReadable, ['Média de tempo como treinador'])
    ),
    agente: pick(ai?.agente,
      extractLabelValue(profileHtml, ['Agente'])
      || extractReadableField(profileReadable, ['Agente'])
    ),
    foto_url: extractPhoto(profileHtml, nome),
    clube_atual: pick(ai?.clube_atual, currentClubReadable || current?.clube || null),
    cargo_atual: pick(ai?.cargo_atual, currentRoleReadable || current?.cargo || 'Treinador'),
    carreira,
    jogos: metricas.jogos_enriquecidos,
    metricas: { ...metricas, jogos_enriquecidos: undefined },
    sistemas_jogo: metricas.formacoes.map(x=>x.formacao),
    fonte_atualizada_em: new Date().toISOString(),
    leitura_ia: Boolean(ai),
    aviso_ia: aiWarning,
    aviso_coleta: performanceWarning
  }
}
