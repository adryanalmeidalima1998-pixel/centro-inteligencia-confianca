// gerarPdfRelatorioJogadores.js
// PDF moderno em cards (estilo aba "Destaques"), layout ESPAÇOSO em 1 coluna,
// escudo do Confiança no cabeçalho e LINKS CLICÁVEIS por jogador.
//
// Uso (client-side):
//   import { gerarPdfRelatorioJogadores } from '@/app/lib/relatorios/gerarPdfRelatorioJogadores'
//   await gerarPdfRelatorioJogadores({ nome, jogadores, grupos })

const GREEN = [10, 102, 183]
const GREEN_DARK = [0, 77, 38]
const DARK = [22, 59, 40]
const MUTED = [90, 110, 100]
const SOFT = [150, 165, 175]
const LINE = [223, 233, 226]
const WHITE = [255, 255, 255]
const LINKBLUE = [37, 99, 235]

const GRUPOS_PADRAO = [
  { id: 'GOL', label: 'Goleiros',      short: 'GOL', color: '#ea580c' },
  { id: 'ZAG', label: 'Zagueiros',     short: 'ZAG', color: '#2563eb' },
  { id: 'LAT', label: 'Laterais',      short: 'LAT', color: '#0d9488' },
  { id: 'VOL', label: 'Volantes',      short: 'VOL', color: '#7c3aed' },
  { id: 'MEI', label: 'Meias',         short: 'MEI', color: '#4f46e5' },
  { id: 'EXT', label: 'Extremos',      short: 'EXT', color: '#db2777' },
  { id: 'CA',  label: 'Centroavantes', short: 'CA',  color: '#dc2626' },
]

function hexToRgb(hex) {
  const raw = String(hex || '#0a66b7').replace('#', '')
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)]
}
function tint(rgb, f) {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * f),
    Math.round(rgb[1] + (255 - rgb[1]) * f),
    Math.round(rgb[2] + (255 - rgb[2]) * f),
  ]
}
function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
async function fetchDataUrl(src) {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Não foi possível carregar ${src}`)
  return readAsDataUrl(await res.blob())
}
function ellipsize(doc, text, maxW) {
  let t = String(text || '')
  if (doc.getTextWidth(t) <= maxW) return t
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1)
  return t + '…'
}
function normalizeUrl(u) {
  const s = String(u || '').trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : 'https://' + s
}

// Seta diagonal (↗) desenhada em vetor — independe da fonte, sempre nítida.
function drawExternalArrow(doc, x, y, size, rgb) {
  doc.setDrawColor(...rgb)
  doc.setLineWidth(0.45)
  const s = size
  doc.line(x, y, x + s, y - s)
  doc.line(x + s, y - s, x + s - s * 0.55, y - s)
  doc.line(x + s, y - s, x + s, y - s + s * 0.55)
  doc.setLineWidth(0.2)
}

export async function gerarPdfRelatorioJogadores({ nome, jogadores = [], grupos = GRUPOS_PADRAO }) {
  const jspdfMod = await import('jspdf')
  const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 14
  const cardW = pageW - M * 2
  const cardH = 26
  const cardGap = 6
  const footerH = 12

  let shield = null
  try { shield = await fetchDataUrl('/confianca.png') } catch (_) {}

  const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  function header(first) {
    const bandH = first ? 32 : 20
    doc.setFillColor(...GREEN_DARK)
    doc.rect(0, 0, pageW, bandH, 'F')
    doc.setFillColor(...GREEN)
    doc.rect(0, bandH - 2.6, pageW, 2.6, 'F')

    if (shield) {
      const s = first ? 18 : 12
      try { doc.addImage(shield, 'PNG', M, first ? 7 : 4, s, s, undefined, 'FAST') } catch (_) {}
    }
    const tx = M + (first ? 24 : 17)
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    if (first) {
      doc.setFontSize(8)
      doc.setTextColor(210, 232, 219)
      doc.text('CONFIANÇA · CENTRAL DE INTELIGÊNCIA', tx, 12)
      doc.setTextColor(...WHITE)
      doc.setFontSize(17)
      doc.text(ellipsize(doc, (nome || 'Relatório de Jogadores').toUpperCase(), pageW - tx - M), tx, 21)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(200, 226, 211)
      doc.text(`${jogadores.length} atleta(s) · Gerado em ${dataStr}`, tx, 27.5)
    } else {
      doc.setFontSize(9.5)
      doc.text(ellipsize(doc, (nome || 'Relatório de Jogadores').toUpperCase(), pageW - tx - M - 34), tx, 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(200, 226, 211)
      doc.text('CIC · Confiança', pageW - M, 12, { align: 'right' })
    }
    return bandH + 8
  }

  function footer(page) {
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(M, pageH - footerH + 3, pageW - M, pageH - footerH + 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...SOFT)
    doc.text('Central de Inteligência · Confiança', M, pageH - 5)
    doc.text(`Página ${page}`, pageW - M, pageH - 5, { align: 'right' })
  }

  let page = 1
  let y = header(true)

  function newPage() {
    footer(page)
    doc.addPage()
    page += 1
    y = header(false)
  }
  function ensure(space) {
    if (y + space > pageH - footerH) newPage()
  }

  function groupBar(g, count) {
    const rgb = hexToRgb(g.color)
    const barH = 11
    ensure(barH + cardH + cardGap)
    doc.setFillColor(...tint(rgb, 0.88))
    doc.setDrawColor(...tint(rgb, 0.55))
    doc.roundedRect(M, y, cardW, barH, 2.4, 2.4, 'FD')
    doc.setFillColor(...rgb)
    doc.roundedRect(M, y, 3, barH, 1.4, 1.4, 'F')
    doc.setFillColor(...rgb)
    doc.roundedRect(M + 6, y + 2.4, 16, barH - 4.8, 1.8, 1.8, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(g.short, M + 6 + 8, y + barH / 2 + 1.3, { align: 'center' })
    doc.setTextColor(...DARK)
    doc.setFontSize(11)
    doc.text(g.label, M + 27, y + barH / 2 + 1.2)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(`${count} atleta(s)`, pageW - M - 4, y + barH / 2 + 1.2, { align: 'right' })
    y += barH + cardGap
  }

  function playerCard(p, rank, rgb) {
    ensure(cardH + cardGap)
    const x = M
    const top = y

    doc.setFillColor(244, 247, 245)
    doc.roundedRect(x + 0.7, top + 0.9, cardW, cardH, 3, 3, 'F')
    doc.setFillColor(...WHITE)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, top, cardW, cardH, 3, 3, 'FD')
    doc.setFillColor(...rgb)
    doc.roundedRect(x, top, 3.4, cardH, 1.6, 1.6, 'F')

    const bx = x + 9, by = top + (cardH - 15) / 2
    doc.setFillColor(...tint(rgb, 0.82))
    doc.roundedRect(bx, by, 15, 15, 3, 3, 'F')
    doc.setTextColor(...rgb)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(`${rank}`, bx + 7.5, by + 9.6, { align: 'center' })

    const tx = bx + 15 + 8
    const rightPad = x + cardW - 8

    let ageLeft = rightPad
    if (p.idade) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      const ageTxt = `${p.idade} anos`
      const aw = doc.getTextWidth(ageTxt) + 8
      const ax = rightPad - aw
      const ay = top + 8
      doc.setFillColor(240, 244, 248)
      doc.roundedRect(ax, ay - 4.4, aw, 6.4, 3.2, 3.2, 'F')
      doc.setTextColor(70, 90, 105)
      doc.text(ageTxt, ax + aw / 2, ay, { align: 'center' })
      ageLeft = ax - 4
    }

    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13.5)
    const nomeMax = ageLeft - tx
    doc.text(ellipsize(doc, p.nome, nomeMax), tx, top + 11)

    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const meta = [p.clube, p.posicao].filter(Boolean).join('   ·   ') || '—'
    doc.text(ellipsize(doc, meta, rightPad - tx), tx, top + 17)

    const url = normalizeUrl(p.link)
    const linkY = top + cardH - 4
    if (url) {
      const label = 'ABRIR PERFIL'
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      const lw = doc.getTextWidth(label)
      const padX = 5, arrowSp = 4.5
      const chipW = lw + padX * 2 + arrowSp
      const chipH = 6.6
      const chipX = tx, chipY = linkY - 4.6
      doc.setFillColor(...tint(LINKBLUE, 0.9))
      doc.roundedRect(chipX, chipY, chipW, chipH, 3.3, 3.3, 'F')
      doc.setTextColor(...LINKBLUE)
      doc.textWithLink(label, chipX + padX, chipY + 4.5, { url })
      drawExternalArrow(doc, chipX + padX + lw + 1.4, chipY + 4.4, 2.4, LINKBLUE)
      doc.link(chipX, chipY, chipW, chipH, { url })
    } else {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(...SOFT)
      doc.text('sem link cadastrado', tx, linkY)
    }

    y += cardH + cardGap
  }

  const byGroup = new Map()
  for (const g of grupos) byGroup.set(g.id, [])
  const outros = []
  for (const p of jogadores) {
    if (byGroup.has(p.grupo)) byGroup.get(p.grupo).push(p)
    else outros.push(p)
  }
  const ordered = [...grupos]
  if (outros.length) { ordered.push({ id: '__outros', label: 'Outros', short: 'OUT', color: '#64748b' }); byGroup.set('__outros', outros) }

  for (const g of ordered) {
    const list = byGroup.get(g.id) || []
    if (!list.length) continue
    const rgb = hexToRgb(g.color)
    groupBar(g, list.length)
    list.forEach((p, i) => playerCard(p, i + 1, rgb))
    y += 4
  }

  if (!jogadores.length) {
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text('Nenhum jogador adicionado a este relatório.', M, y + 6)
  }

  footer(page)

  const safe = String(nome || 'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'relatorio'
  doc.save(`cig-${safe}.pdf`)
}
