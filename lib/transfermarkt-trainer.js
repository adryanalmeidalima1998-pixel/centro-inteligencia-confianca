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

function parseMatches(html) {
  const table = extractTables(html).find(t => /Time da casa/i.test(stripTags(t)) && /(Tática|Formation)/i.test(stripTags(t)))
  if (!table) return []
  const result = []
  for (const row of extractRows(table)) {
    const texts = extractCells(row).map(c => c.text).filter((v, i, arr) => v || arr.length)
    const dateIdx = texts.findIndex(v => /^\d{2}\/\d{2}\/\d{4}$/.test(v))
    if (dateIdx < 0 || texts.length < dateIdx + 7) continue
    const slice = texts.slice(dateIdx)
    const [data, competicao, temporada, rodada, mandante, placar, visitante, tatica] = slice
    if (!mandante || !visitante || !placar) continue
    result.push({ data, competicao, temporada, rodada, mandante, placar, visitante, tatica: tatica || null })
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
  const formationList = [...formations.entries()].sort((a,b)=>b[1]-a[1]).map(([formacao,jogos])=>({formacao,jogos,percentual: matches.length ? Math.round(jogos/matches.length*100) : 0}))
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
    formacoes: formationList,
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

async function fetchTransfermarkt(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18000)
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    if (!res.ok) {
      const err = new Error(`Transfermarkt respondeu com HTTP ${res.status}.`)
      err.status = res.status
      throw err
    }
    const text = await res.text()
    if (/captcha|access denied|unusual traffic|cf-chl/i.test(text)) {
      throw new Error('O Transfermarkt bloqueou a leitura automática nesta tentativa. Tente novamente mais tarde ou use o preenchimento manual.')
    }
    return text
  } finally { clearTimeout(timer) }
}

export async function scrapeTransfermarktTrainer(inputUrl) {
  const urls = normalizeTransfermarktTrainerUrl(inputUrl)
  const [profileHtml, performanceHtml] = await Promise.all([
    fetchTransfermarkt(urls.profileUrl),
    fetchTransfermarkt(urls.performanceUrl)
  ])

  const nome = extractName(profileHtml)
  if (!nome) throw new Error('Não foi possível ler o nome do treinador no Transfermarkt.')

  const carreira = parseCareer(profileHtml)
  const jogosRaw = parseMatches(performanceHtml)
  const metricas = aggregate(jogosRaw, carreira)
  const birthRaw = extractLabelValue(profileHtml, ['Nasc./Idade', 'Nasc./Idade:'])
  const birth = extractDate(birthRaw) || extractLabelValue(profileHtml, ['Data de nascimento'])
  const age = Number((birthRaw || '').match(/\((\d{1,3})\)/)?.[1] || 0) || null
  const current = carreira.find(c => !c.saida) || carreira[0] || null

  return {
    transfermarkt_id: urls.id,
    transfermarkt_url: urls.profileUrl,
    performance_url: urls.performanceUrl,
    nome,
    nome_completo: extractLabelValue(profileHtml, ['Nome completo']) || nome,
    data_nascimento: birth,
    idade: age,
    cidade_nascimento: extractLabelValue(profileHtml, ['Local de nascimento']),
    nacionalidade: extractLabelValue(profileHtml, ['Nacionalidade']),
    licenca: extractLabelValue(profileHtml, ['Licença de treinador', 'Licença']),
    formacao_preferida: extractLabelValue(profileHtml, ['Formação preferida', 'Formação favorita']),
    media_tempo_cargo: extractLabelValue(profileHtml, ['Média de tempo como treinador']),
    agente: extractLabelValue(profileHtml, ['Agente']),
    foto_url: extractPhoto(profileHtml, nome),
    clube_atual: current?.clube || null,
    cargo_atual: current?.cargo || 'Treinador',
    carreira,
    jogos: metricas.jogos_enriquecidos,
    metricas: { ...metricas, jogos_enriquecidos: undefined },
    sistemas_jogo: metricas.formacoes.map(x=>x.formacao),
    fonte_atualizada_em: new Date().toISOString()
  }
}
