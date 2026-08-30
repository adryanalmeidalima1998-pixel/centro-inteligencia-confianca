// Leitura espacial automática do PDF "Relatório de Equipa" Wyscout.
//
// DEFESA (pág. DEFESA):
//   1) duelos defensivos ganhos no terço defensivo;
//   2) duelos perdidos no próprio campo (exposição defensiva);
//   3) duelos aéreos por corredor.
//
// TRANSIÇÕES (pág. TRANSIÇÕES):
//   4) recuperações da posse em matriz 3x3;
//   5) perdas da posse em matriz 3x3;
//   6) faltas cometidas em matriz 3x3.
//
// ATAQUE (pág. ATAQUE):
//   7) cruzamentos;
//   8) dribles bem-sucedidos no último terço;
//   9) recuperações no último terço.
//
// Os gols marcados/sofridos seguem manuais porque é mais confiável o usuário
// clicar na posição exata. Cada gol também pode receber sua origem/tipo.

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

let pdfJsLoadingPromise = null

function clean(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function norm(value) {
  return clean(value).toLocaleLowerCase('pt-BR')
}

function fold(value) {
  return norm(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9%/., -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function loadPdfJsClient() {
  if (typeof window === 'undefined') return Promise.reject(new Error('A leitura automática do PDF roda no navegador.'))
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
    return Promise.resolve(window.pdfjsLib)
  }
  if (pdfJsLoadingPromise) return pdfJsLoadingPromise

  pdfJsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PDFJS_URL
    script.async = true
    script.onload = () => {
      if (!window.pdfjsLib) return reject(new Error('O leitor de PDF não foi carregado.'))
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
      resolve(window.pdfjsLib)
    }
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de PDF. Verifique a conexão.'))
    document.head.appendChild(script)
  })
  return pdfJsLoadingPromise
}

function viewportPoint(pdfjs, viewport, item) {
  try {
    const t = pdfjs.Util.transform(viewport.transform, item.transform)
    return { x:Number(t[4]), y:Number(t[5]) }
  } catch (_) {
    return { x:Number(item?.transform?.[4]), y:viewport.height - Number(item?.transform?.[5]) }
  }
}

function positionedItems(items, viewport, pdfjs) {
  return (items || []).map(item => {
    const point = viewportPoint(pdfjs, viewport, item)
    return { text:clean(item?.str), x:point.x, y:point.y }
  }).filter(item => item.text && Number.isFinite(item.x) && Number.isFinite(item.y))
}

function splitCorridors(events, fieldLeft, fieldRight) {
  const oneThird = (fieldRight - fieldLeft) / 3
  const leftLimit = fieldLeft + oneThird
  const rightLimit = fieldLeft + oneThird * 2
  let esquerda = 0, centro = 0, direita = 0
  for (const event of events) {
    if (event.x < leftLimit) esquerda += 1
    else if (event.x < rightLimit) centro += 1
    else direita += 1
  }
  return { esquerda, centro, direita, total:esquerda + centro + direita }
}

// Padronização defensiva: todos os corredores defensivos são apresentados
// pela direção do ATAQUE ADVERSÁRIO, igual ao campo manual dos gols sofridos.
// esquerda do rival = direita da nossa defesa; direita do rival = esquerda da nossa defesa.
function asOpponentAttackCorridors(raw) {
  if (!raw) return raw
  return { esquerda:raw.direita, centro:raw.centro, direita:raw.esquerda, total:raw.total }
}

function isDefenseSpatialPage(items) {
  const text = items.map(item => fold(item?.str)).filter(Boolean).join(' ')
  return text.includes('duelos defensivos') && text.includes('ganhos') && text.includes('duelos aereos')
}

function defenseThirdAnchors(positioned) {
  const rows = []
  const sorted = [...positioned].sort((a,b) => a.y-b.y || a.x-b.x)
  for (const item of sorted) {
    let row = rows.find(r => Math.abs(r.y - item.y) <= 3.5)
    if (!row) { row = { y:item.y, items:[] }; rows.push(row) }
    row.items.push(item)
  }
  return rows.map(row => ({
    y:row.y,
    text:fold([...row.items].sort((a,b) => a.x-b.x).map(i => i.text).join(' ')),
  })).filter(row => row.text === 'um terco').sort((a,b) => a.y-b.y).slice(0,3)
}

function defenseMapEvents(positioned, viewport, anchor, nextAnchor = null) {
  const pageW = Number(viewport.width) || 595
  const pageH = Number(viewport.height) || 842
  const fieldLeft = pageW * 0.04
  const fieldRight = pageW * 0.48
  const mapTop = anchor.y + Math.max(5, pageH * 0.006)
  const mapBottom = nextAnchor
    ? nextAnchor.y - Math.max(16, pageH * 0.019)
    : Math.min(pageH * 0.86, anchor.y + pageH * 0.185)

  const events = positioned.filter(item =>
    /^\d{1,2}$/.test(item.text) &&
    item.x >= fieldLeft && item.x <= fieldRight &&
    item.y >= mapTop && item.y <= mapBottom
  )
  return splitCorridors(events, fieldLeft, fieldRight)
}

export function parseDefenseCorridorsFromTextItems(items, viewport, pdfjs) {
  if (!Array.isArray(items) || !items.length || !viewport) return null
  if (!isDefenseSpatialPage(items)) return null

  const positioned = positionedItems(items, viewport, pdfjs)
  const anchors = defenseThirdAnchors(positioned)
  if (anchors.length < 3) return null

  const won = asOpponentAttackCorridors(defenseMapEvents(positioned, viewport, anchors[0], anchors[1]))
  const exposure = asOpponentAttackCorridors(defenseMapEvents(positioned, viewport, anchors[1], anchors[2]))
  const aerial = asOpponentAttackCorridors(defenseMapEvents(positioned, viewport, anchors[2], null))

  if (exposure.total < 20) return null

  return {
    // Legado mantido: ataques_* = exposições defensivas (duelos perdidos).
    ataques_esquerda:exposure.esquerda,
    ataques_centro:exposure.centro,
    ataques_direita:exposure.direita,
    amostra_ataques:exposure.total,

    duelos_def_ganhos_esquerda:won.esquerda,
    duelos_def_ganhos_centro:won.centro,
    duelos_def_ganhos_direita:won.direita,
    amostra_duelos_def_ganhos:won.total,

    duelos_aereos_esquerda:aerial.esquerda,
    duelos_aereos_centro:aerial.centro,
    duelos_aereos_direita:aerial.direita,
    amostra_duelos_aereos:aerial.total,

    metodo:'auto_pdf_defesa_3_mapas_v12_ref_ataque_adversario',
    descricao:'Página DEFESA: corredores pela direção do ataque adversário; esquerda rival = direita defensiva do Confiança.',
  }
}

function isAttackSpatialPage(items) {
  const text = items.map(item => fold(item?.str)).filter(Boolean).join(' ')
  return text.includes('cruzamento') && text.includes('dribl') && text.includes('recuper') && text.includes('ultimo') && text.includes('terco')
}

function attackAnchors(positioned) {
  const rows = []
  const sorted = [...positioned].sort((a,b) => a.y-b.y || a.x-b.x)
  const tolerance = 3.5
  for (const item of sorted) {
    let row = rows.find(r => Math.abs(r.y - item.y) <= tolerance)
    if (!row) { row = { y:item.y, items:[] }; rows.push(row) }
    row.items.push(item)
  }

  return rows.map(row => {
    const parts = [...row.items].sort((a,b) => a.x-b.x)
    return { text:fold(parts.map(i => i.text).join(' ')), y:row.y }
  }).filter(row => row.text === 'ultimo terco').sort((a,b) => a.y-b.y).slice(0,3)
}

function eventsAboveAnchor(positioned, anchor, viewport) {
  const pageW = Number(viewport.width) || 595
  const pageH = Number(viewport.height) || 842
  const fieldLeft = pageW * 0.04
  const fieldRight = pageW * 0.48
  const mapTop = anchor.y - pageH * 0.18
  const mapBottom = anchor.y - pageH * 0.005
  const events = positioned.filter(item =>
    /^\d{1,2}$/.test(item.text) &&
    item.x >= fieldLeft && item.x <= fieldRight &&
    item.y >= mapTop && item.y <= mapBottom
  )
  return splitCorridors(events, fieldLeft, fieldRight)
}

export function parseAttackCorridorsFromTextItems(items, viewport, pdfjs) {
  if (!Array.isArray(items) || !items.length || !viewport) return null
  if (!isAttackSpatialPage(items)) return null

  const positioned = positionedItems(items, viewport, pdfjs)
  let anchors = attackAnchors(positioned)
  if (anchors.length < 3) {
    const headingYs = positioned
      .filter(i => { const t=fold(i.text); return t.includes('dribl') || t.includes('recuper') })
      .map(i => i.y)
    anchors = positioned
      .filter(i => fold(i.text) === 'ultimo' && !headingYs.some(y => Math.abs(y-i.y) <= 4))
      .sort((a,b) => a.y-b.y)
      .slice(0,3)
  }
  if (anchors.length < 3) return null

  const crosses = eventsAboveAnchor(positioned, anchors[0], viewport)
  const dribbles = eventsAboveAnchor(positioned, anchors[1], viewport)
  const highRecoveries = eventsAboveAnchor(positioned, anchors[2], viewport)

  if (crosses.total < 20 || dribbles.total < 10 || highRecoveries.total < 10) return null

  return {
    cruzamentos_esquerda:crosses.esquerda,
    cruzamentos_centro:crosses.centro,
    cruzamentos_direita:crosses.direita,
    amostra_cruzamentos:crosses.total,
    dribles_esquerda:dribbles.esquerda,
    dribles_centro:dribbles.centro,
    dribles_direita:dribbles.direita,
    amostra_dribles:dribbles.total,
    recuperacoes_altas_esquerda:highRecoveries.esquerda,
    recuperacoes_altas_centro:highRecoveries.centro,
    recuperacoes_altas_direita:highRecoveries.direita,
    amostra_recuperacoes_altas:highRecoveries.total,
    metodo_ofensivo:'auto_pdf_pagina_ataque_eventos_posicionados_v8',
    descricao_ofensiva:'Página ATAQUE: cruzamentos, dribles bem-sucedidos e recuperações no último terço, mantidos separadamente.',
  }
}

function isTransitionSpatialPage(items) {
  const text = items.map(item => fold(item?.str)).filter(Boolean).join(' ')
  return text.includes('recuperacoes') && text.includes('perdas') && text.includes('faltas') && text.includes('posse')
}

function findTransitionHeading(positioned, keyword, viewport) {
  const pageW = Number(viewport.width) || 595
  return positioned
    .filter(i => i.x < pageW * 0.35 && fold(i.text).includes(keyword))
    .sort((a,b) => a.y-b.y)[0] || null
}

function parseNumber(text) {
  const s = clean(text).replace('%','').replace(',','.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function median(values) {
  const arr = values.filter(Number.isFinite).sort((a,b) => a-b)
  if (!arr.length) return null
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 ? arr[mid] : (arr[mid-1] + arr[mid]) / 2
}

function emptyNine() {
  return {
    esquerda:{ defensivo:null, medio:null, ofensivo:null },
    centro:{ defensivo:null, medio:null, ofensivo:null },
    direita:{ defensivo:null, medio:null, ofensivo:null },
  }
}

function parseNineZoneMap(positioned, viewport, heading, nextHeading = null) {
  if (!heading) return null
  const pageW = Number(viewport.width) || 595
  const pageH = Number(viewport.height) || 842
  const fieldLeft = pageW * 0.04
  const fieldRight = pageW * 0.48
  const mapTop = heading.y + pageH * 0.072
  const mapBottom = nextHeading ? nextHeading.y - pageH * 0.022 : Math.min(pageH * 0.88, heading.y + pageH * 0.25)
  if (mapBottom <= mapTop) return null

  const rowNames = ['esquerda','centro','direita']
  const colNames = ['defensivo','medio','ofensivo']
  const pctBuckets = Array.from({length:3}, () => Array.from({length:3}, () => []))
  const p90Buckets = Array.from({length:3}, () => Array.from({length:3}, () => []))

  for (const item of positioned) {
    if (item.x < fieldLeft || item.x > fieldRight || item.y < mapTop || item.y > mapBottom) continue
    const col = Math.max(0, Math.min(2, Math.floor(((item.x-fieldLeft)/(fieldRight-fieldLeft))*3)))
    const row = Math.max(0, Math.min(2, Math.floor(((item.y-mapTop)/(mapBottom-mapTop))*3)))
    if (/^\d+(?:[.,]\d+)?%$/.test(item.text)) {
      const value = parseNumber(item.text)
      if (value != null && value <= 100) pctBuckets[row][col].push(value)
    } else if (/^\d+(?:[.,]\d+)?$/.test(item.text)) {
      const value = parseNumber(item.text)
      if (value != null && value <= 60) p90Buckets[row][col].push(value)
    }
  }

  const pctGrid = emptyNine()
  const per90Grid = emptyNine()
  let cells = 0
  for (let r=0; r<3; r += 1) {
    for (let c=0; c<3; c += 1) {
      const p = median(pctBuckets[r][c])
      const p90 = median(p90Buckets[r][c])
      pctGrid[rowNames[r]][colNames[c]] = p
      per90Grid[rowNames[r]][colNames[c]] = p90
      if (p != null) cells += 1
    }
  }
  if (cells < 7) return null
  return { pct:pctGrid, per90:per90Grid }
}

export function parseTransitionZonesFromTextItems(items, viewport, pdfjs) {
  if (!Array.isArray(items) || !items.length || !viewport) return null
  if (!isTransitionSpatialPage(items)) return null
  const positioned = positionedItems(items, viewport, pdfjs)
  const rec = findTransitionHeading(positioned, 'recuper', viewport)
  const losses = findTransitionHeading(positioned, 'perdas', viewport)
  const fouls = findTransitionHeading(positioned, 'faltas', viewport)
  if (!rec || !losses || !fouls) return null

  const recuperacoes = parseNineZoneMap(positioned, viewport, rec, losses)
  const perdas = parseNineZoneMap(positioned, viewport, losses, fouls)
  const faltas = parseNineZoneMap(positioned, viewport, fouls, null)
  if (!recuperacoes && !perdas && !faltas) return null

  return {
    recuperacoes_zonas:recuperacoes,
    perdas_zonas:perdas,
    faltas_zonas:faltas,
    metodo_transicoes:'auto_pdf_transicoes_matriz_3x3_v8',
    descricao_transicoes:'Página TRANSIÇÕES: distribuição percentual e média/90 em 9 zonas para recuperações, perdas e faltas cometidas.',
  }
}

export async function extractTeamReportSpatial(fileOrBlob) {
  if (!fileOrBlob || typeof fileOrBlob.arrayBuffer !== 'function') throw new Error('PDF inválido para leitura espacial.')
  const pdfjs = await loadPdfJsClient()
  const data = new Uint8Array(await fileOrBlob.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const maxPages = Math.min(pdf.numPages, 30)

  let defensive = null
  let offensive = null
  let transitions = null

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale:1 })
    const textContent = await page.getTextContent({ normalizeWhitespace:true, disableCombineTextItems:false })

    if (!defensive) {
      const parsedDefense = parseDefenseCorridorsFromTextItems(textContent.items, viewport, pdfjs)
      if (parsedDefense) defensive = { ...parsedDefense, source_page:pageNumber }
    }
    if (!offensive) {
      const parsedAttack = parseAttackCorridorsFromTextItems(textContent.items, viewport, pdfjs)
      if (parsedAttack) offensive = { ...parsedAttack, source_page_ofensiva:pageNumber }
    }
    if (!transitions) {
      const parsedTransitions = parseTransitionZonesFromTextItems(textContent.items, viewport, pdfjs)
      if (parsedTransitions) transitions = { ...parsedTransitions, source_page_transicoes:pageNumber }
    }
    if (defensive && offensive && transitions) break
  }

  if (!defensive && !offensive && !transitions) throw new Error('Não encontrei os mapas espaciais de DEFESA, ATAQUE ou TRANSIÇÕES no PDF de equipe.')
  return { ...(defensive || {}), ...(offensive || {}), ...(transitions || {}) }
}
