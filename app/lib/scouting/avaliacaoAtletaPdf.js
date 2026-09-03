const GREEN = [10, 102, 183]
const DARK = [19, 41, 28]
const MUTED = [95, 119, 104]
const LINE = [221, 236, 228]
const BG = [247, 251, 248]
const GREEN_SOFT = [232, 245, 237]
const GREEN_BORDER = [213, 235, 222]
const AMBER = [180, 83, 9]
const AMBER_SOFT = [255, 250, 240]
const RED = [197, 58, 50]
const RED_SOFT = [255, 244, 242]
const BLUE = [37, 99, 235]
const BLUE_SOFT = [239, 246, 255]
const PURPLE = [124, 58, 237]
const PURPLE_SOFT = [245, 243, 255]

const BAND_COLORS = [
  { from:0, to:20, color:'#a11218' },
  { from:20, to:40, color:'#d35a2c' },
  { from:40, to:60, color:'#d6bd86' },
  { from:60, to:80, color:'#72a96a' },
  { from:80, to:100, color:'#0b6b3a' },
]

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(v) || 0))
}

function shortText(value, max = 22) {
  const text = String(value || '')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function formatValue(value, format = 'decimal') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-'
  if (format === 'percent') return `${Number(value).toFixed(1)}%`
  return Number(value).toFixed(2)
}

function positionLabel(code) {
  const map = {
    GK:'Goleiro', CB:'Zagueiro', RB:'Lateral direito', LB:'Lateral esquerdo', FB:'Lateral',
    DM:'Volante', CM:'Meia central', AM:'Meia ofensivo', RW:'Extremo direito', LW:'Extremo esquerdo',
    WG:'Extremo', ST:'Atacante', CF:'Atacante',
  }
  return map[String(code || '').toUpperCase()] || code || '-'
}

function fitTone(score) {
  const v = Number(score) || 0
  if (v >= 80) return [21, 128, 61]
  if (v >= 65) return [15, 118, 110]
  if (v >= 50) return [196, 123, 9]
  return [197, 58, 50]
}

function fitSoftTone(score) {
  const v = Number(score) || 0
  if (v >= 80) return [232, 245, 237]
  if (v >= 65) return [236, 250, 248]
  if (v >= 50) return [255, 250, 240]
  return [255, 244, 242]
}

function hexToRgb(hex) {
  const raw = String(hex).replace('#', '')
  return [parseInt(raw.slice(0,2),16), parseInt(raw.slice(2,4),16), parseInt(raw.slice(4,6),16)]
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
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Não foi possível carregar ${src}`)
  return readAsDataUrl(await response.blob())
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function cropImageDataUrl(dataUrl, width = 700, height = 900) {
  if (!dataUrl) return null
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently:true })

  // Desenha primeiro a imagem recortada e só depois trata o fundo. Isso permite
  // remover fundos pretos uniformes sem apagar áreas escuras internas do atleta.
  ctx.clearRect(0, 0, width, height)
  const scale = Math.max(width / img.width, height / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)

  try {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    const border = []
    const step = Math.max(2, Math.floor(Math.min(width, height) / 90))
    const push = (x, y) => {
      const i = (y * width + x) * 4
      border.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
    }
    for (let x = 0; x < width; x += step) { push(x, 0); push(x, height - 1) }
    for (let y = 0; y < height; y += step) { push(0, y); push(width - 1, y) }

    const opaque = border.filter(v => v[3] > 20)
    const dark = opaque.filter(([r,g,b]) => (r + g + b) / 3 < 72)
    const hasDarkUniformBorder = opaque.length && dark.length / opaque.length > .42

    if (hasDarkUniformBorder) {
      const target = [0,1,2].map(channel => {
        const values = dark.map(v => v[channel]).sort((a,b)=>a-b)
        return values[Math.floor(values.length / 2)] || 0
      })
      const visited = new Uint8Array(width * height)
      const queue = new Int32Array(width * height)
      let head = 0, tail = 0
      const closeToBackground = idx => {
        const i = idx * 4
        if (data[i + 3] < 24) return true
        const dr = data[i] - target[0]
        const dg = data[i + 1] - target[1]
        const db = data[i + 2] - target[2]
        const distance = Math.sqrt(dr*dr + dg*dg + db*db)
        const luma = (data[i] + data[i + 1] + data[i + 2]) / 3
        return distance < 72 && luma < 105
      }
      const enqueue = idx => {
        if (idx < 0 || idx >= width * height || visited[idx] || !closeToBackground(idx)) return
        visited[idx] = 1
        queue[tail++] = idx
      }
      for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x) }
      for (let y = 0; y < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1) }
      while (head < tail) {
        const idx = queue[head++]
        const x = idx % width
        const y = Math.floor(idx / width)
        const i = idx * 4
        data[i] = 244; data[i + 1] = 248; data[i + 2] = 245; data[i + 3] = 255
        if (x > 0) enqueue(idx - 1)
        if (x < width - 1) enqueue(idx + 1)
        if (y > 0) enqueue(idx - width)
        if (y < height - 1) enqueue(idx + width)
      }
    }

    // Transparência restante vira o mesmo fundo claro do card.
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 245) {
        const a = data[i + 3] / 255
        data[i] = Math.round(data[i] * a + 244 * (1 - a))
        data[i + 1] = Math.round(data[i + 1] * a + 248 * (1 - a))
        data[i + 2] = Math.round(data[i + 2] * a + 245 * (1 - a))
        data[i + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
  } catch {
    // Se o navegador bloquear leitura de pixels, mantém a foto original.
  }

  return canvas.toDataURL('image/jpeg', .9)
}
function drawSector(ctx, cx, cy, innerR, outerR, start, end, fill) {
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, start, end)
  ctx.arc(cx, cy, innerR, end, start, true)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()
}

function pizzaCanvas(metrics, percentileKey, title, score) {
  const data = (metrics || []).filter(m => m?.[percentileKey] != null).slice(0, 8)
  if (data.length < 3) return null

  const size = 1040
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const innerR = 86
  const maxR = 325
  const labelR = 405
  const step = Math.PI * 2 / data.length
  const gap = Math.min(.035, step * .08)
  const radiusFor = pct => innerR + clamp(pct) / 100 * (maxR - innerR)

  ctx.beginPath()
  ctx.arc(cx, cy, maxR, 0, Math.PI * 2)
  ctx.fillStyle = '#eef3ef'
  ctx.fill()

  data.forEach((metric, i) => {
    const start = -Math.PI / 2 + i * step + gap
    const end = -Math.PI / 2 + (i + 1) * step - gap
    drawSector(ctx, cx, cy, innerR, maxR, start, end, '#eef3ef')
    const pct = clamp(metric?.[percentileKey])
    BAND_COLORS.forEach(band => {
      const clipped = Math.min(pct, band.to)
      if (clipped <= band.from) return
      drawSector(ctx, cx, cy, radiusFor(band.from), radiusFor(clipped), start, end, band.color)
    })
  })

  ;[20,40,60,80,100].forEach(level => {
    ctx.beginPath()
    ctx.arc(cx, cy, radiusFor(level), 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,.86)'
    ctx.lineWidth = 2
    ctx.stroke()
  })

  ctx.beginPath()
  ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#dce9e0'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#587464'
  ctx.font = '700 21px Arial'
  ctx.fillText(title, cx, cy - 12)
  ctx.fillStyle = '#173b27'
  ctx.font = '900 48px Arial'
  ctx.fillText(String(score ?? '-'), cx, cy + 42)

  data.forEach((metric, i) => {
    const angle = -Math.PI / 2 + i * step + step / 2
    const x = cx + Math.cos(angle) * labelR
    const y = cy + Math.sin(angle) * labelR
    const cos = Math.cos(angle)
    ctx.textAlign = Math.abs(cos) < .18 ? 'center' : cos > 0 ? 'left' : 'right'
    ctx.fillStyle = '#173b27'
    ctx.font = '700 19px Arial'
    ctx.fillText(shortText(metric.label, 20), x, y)
    ctx.fillStyle = '#668374'
    ctx.font = '800 18px Arial'
    ctx.fillText(`P${Math.round(clamp(metric?.[percentileKey]))}`, x, y + 24)
  })

  return canvas.toDataURL('image/png')
}

function benchmarkCanvas(metrics) {
  const data = (metrics || []).filter(m => m.percentileSerieC != null || m.percentileClub != null).slice(0, 8)
  if (!data.length) return null

  const width = 1200
  const height = 620
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const left = 260
  const right = 55
  const top = 70
  const rowH = 63
  const plotW = width - left - right

  ctx.fillStyle = '#173b27'
  ctx.font = '800 24px Arial'
  ctx.fillText('Percentis por contexto', 24, 34)

  const legend = [
    { label:'Série C', color:'#0a66b7', x: width - 220 },
    { label:'Confiança', color:'#7aa98a', x: width - 120 },
  ]
  legend.forEach(item => {
    ctx.fillStyle = item.color
    ctx.fillRect(item.x, 21, 18, 8)
    ctx.fillStyle = '#587464'
    ctx.font = '700 15px Arial'
    ctx.fillText(item.label, item.x + 24, 28)
  })

  ;[0,25,50,75,100].forEach(tick => {
    const x = left + plotW * tick / 100
    ctx.strokeStyle = '#e2ece6'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, top - 22); ctx.lineTo(x, top + rowH * data.length - 8); ctx.stroke()
    ctx.fillStyle = '#789083'
    ctx.font = '13px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(String(tick), x, top - 30)
  })

  data.forEach((metric, i) => {
    const y = top + i * rowH
    ctx.textAlign = 'right'
    ctx.fillStyle = '#294d36'
    ctx.font = '700 16px Arial'
    ctx.fillText(shortText(metric.label, 24), left - 15, y + 16)

    const s = clamp(metric.percentileSerieC)
    const g = clamp(metric.percentileClub)
    ctx.fillStyle = '#edf3ef'
    ctx.fillRect(left, y, plotW, 14)
    if (metric.percentileSerieC != null) {
      ctx.fillStyle = '#0a66b7'
      ctx.fillRect(left, y, plotW * s / 100, 14)
    }
    ctx.fillStyle = '#edf3ef'
    ctx.fillRect(left, y + 22, plotW, 14)
    if (metric.percentileClub != null) {
      ctx.fillStyle = '#7aa98a'
      ctx.fillRect(left, y + 22, plotW * g / 100, 14)
    }

    ctx.textAlign = 'left'
    ctx.fillStyle = '#587464'
    ctx.font = '700 13px Arial'
    ctx.fillText(`Série C ${metric.percentileSerieC != null ? `P${Math.round(metric.percentileSerieC)}` : '-'}`, left + plotW + 10, y + 11)
    ctx.fillText(`Confiança ${metric.percentileClub != null ? `P${Math.round(metric.percentileClub)}` : '-'}`, left + plotW + 10, y + 33)
  })

  return canvas.toDataURL('image/png')
}

function addHeader(doc, shield, section) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, w, 4, 'F')
  if (shield) {
    try { doc.addImage(shield, 'PNG', 12, 8, 14, 14, undefined, 'FAST') } catch {}
  }
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('CONFIANÇA', 31, 13)
  doc.setTextColor(...MUTED)
  doc.setFontSize(7)
  doc.text('CENTRAL DE INTELIGÊNCIA - CIC', 31, 18)
  doc.setTextColor(...DARK)
  doc.setFontSize(13)
  doc.text(section, w - 12, 15, { align:'right' })
  doc.setDrawColor(...LINE)
  doc.line(12, 26, w - 12, 26)
}

function addFooter(doc, page, total) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...LINE)
  doc.line(12, h - 10, w - 12, h - 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text('CIC - Avaliação de Atleta iScout', 12, h - 5.5)
  doc.text(`Página ${page} de ${total}`, w - 12, h - 5.5, { align:'right' })
}

function roundRectCard(doc, x, y, w, h, fill = BG, border = LINE) {
  doc.setFillColor(...fill)
  doc.setDrawColor(...border)
  doc.roundedRect(x, y, w, h, 2.2, 2.2, 'FD')
}

function kpi(doc, x, y, w, label, value, sub, tone) {
  roundRectCard(doc, x, y, w, 19, [255,255,255], LINE)
  doc.setFillColor(...tone)
  doc.rect(x, y, w, 1.4, 'F')
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(String(label).toUpperCase(), x + 4, y + 6)
  doc.setTextColor(...DARK)
  doc.setFontSize(13)
  doc.text(String(value ?? '-'), x + 4, y + 13)
  if (sub) {
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.text(shortText(sub, 34), x + 4, y + 17)
  }
}

function sectionTitle(doc, text, x, y, tone = GREEN) {
  doc.setFillColor(...tone)
  doc.roundedRect(x, y - 3.2, 2.4, 5, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.setFontSize(8.5)
  doc.text(text, x + 5, y)
}

function addInsightList(doc, items, x, y, w, tone, maxItems = 3) {
  let cursor = y
  ;(items || []).slice(0, maxItems).forEach((item, index) => {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...tone)
    doc.setFontSize(6.4)
    doc.text(`${index + 1}. ${shortText(item.title || item.label, 34)}`, x, cursor)
    doc.text(`P${Math.round(Number(item.percentile) || 0)}`, x + w, cursor, { align:'right' })
    cursor += 4.2
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.setFontSize(5.6)
    const lines = doc.splitTextToSize(String(item.text || ''), w)
    doc.text(lines.slice(0, 2), x, cursor)
    cursor += Math.min(lines.length, 2) * 3.2 + 3.2
  })
  return cursor
}

function metricReading(p) {
  const v = Number(p) || 0
  if (v >= 75) return 'FORTE'
  if (v >= 55) return 'COMPETITIVO'
  if (v >= 35) return 'ATENÇÃO'
  return 'FRÁGIL'
}

function textBlock(doc, text, x, y, width, fontSize = 6.3, lineHeight = 3.1, maxLines = null, color = MUTED, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(fontSize)
  doc.setTextColor(...color)
  const lines = doc.splitTextToSize(String(text || ''), width)
  const finalLines = maxLines ? lines.slice(0, maxLines) : lines
  if (finalLines.length) doc.text(finalLines, x, y)
  return finalLines.length * lineHeight
}

function pill(doc, x, y, text, fill = GREEN_SOFT, color = GREEN, border = GREEN_BORDER) {
  const label = String(text || '')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  const width = Math.max(18, doc.getTextWidth(label) + 6.5)
  doc.setFillColor(...fill)
  doc.setDrawColor(...border)
  doc.roundedRect(x, y - 3.7, width, 7, 3.3, 3.3, 'FD')
  doc.setTextColor(...color)
  doc.text(label, x + width / 2, y + .2, { align:'center' })
  return width
}

function drawValueRow(doc, x, y, label, value, width) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text(String(label), x, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(String(value || '-'), x + width, y, { align:'right' })
}

function miniPill(doc, x, y, text, fill, color, border) {
  const label = String(text || '')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.8)
  const width = Math.max(15, doc.getTextWidth(label) + 5)
  doc.setFillColor(...fill)
  doc.setDrawColor(...border)
  doc.roundedRect(x, y - 2.8, width, 5.2, 2.4, 2.4, 'FD')
  doc.setTextColor(...color)
  doc.text(label, x + width / 2, y, { align:'center' })
  return width
}

function drawMiniComparisonCard(doc, metric, x, y, w, h) {
  const percentile = metric.percentileSerieC ?? metric.percentileClub ?? 0
  const tone = fitTone(percentile)
  const soft = fitSoftTone(percentile)
  roundRectCard(doc, x, y, w, h, [255,255,255], LINE)
  doc.setFillColor(...soft)
  doc.roundedRect(x + 1.4, y + 1.4, w - 2.8, 6.7, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.7)
  doc.setTextColor(...DARK)
  doc.text(shortText(metric.label, 24), x + 3, y + 5.5)
  doc.setTextColor(...tone)
  doc.setFontSize(5.2)
  doc.text(metricReading(percentile), x + w - 3, y + 5.5, { align:'right' })

  doc.setFontSize(5.1)
  drawValueRow(doc, x + 3, y + 11.3, 'Atleta', formatValue(metric.value, metric.format), w - 6)
  drawValueRow(doc, x + 3, y + 15.3, 'Média Confiança', formatValue(metric.avgClub, metric.format), w - 6)
  drawValueRow(doc, x + 3, y + 19.3, 'Média Série C', formatValue(metric.avgSerieC, metric.format), w - 6)

  let px = x + 3
  px += miniPill(doc, px, y + 24.6, metric.percentileClub != null ? `ADC P${Math.round(metric.percentileClub)}` : 'ADC -', GREEN_SOFT, GREEN, GREEN_BORDER) + 2
  miniPill(doc, px, y + 24.6, metric.percentileSerieC != null ? `SÉRIE C P${Math.round(metric.percentileSerieC)}` : 'SÉRIE C -', BLUE_SOFT, BLUE, [191,219,254])
}
function drawMetricCard(doc, metric, x, y, w, h) {
  const percentile = metric.percentileSerieC ?? metric.percentileClub ?? 0
  const tone = fitTone(percentile)
  const soft = fitSoftTone(percentile)
  roundRectCard(doc, x, y, w, h, [255,255,255], LINE)

  doc.setFillColor(...soft)
  doc.roundedRect(x + 1.6, y + 1.6, w - 3.2, 8.2, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.1)
  doc.setTextColor(...DARK)
  doc.text(shortText(metric.label, w < 100 ? 21 : 30), x + 3.5, y + 6.2)
  doc.setTextColor(...tone)
  doc.setFontSize(5.3)
  doc.text(metricReading(percentile), x + w - 3.5, y + 6.2, { align:'right' })

  let pX = x + 3.5
  pX += miniPill(doc, pX, y + 13.2, metric.percentileSerieC != null ? `SÉRIE C P${Math.round(metric.percentileSerieC)}` : 'SÉRIE C -', BLUE_SOFT, BLUE, [191,219,254]) + 2
  pX += miniPill(doc, pX, y + 13.2, metric.percentileClub != null ? `ADC P${Math.round(metric.percentileClub)}` : 'ADC -', GREEN_SOFT, GREEN, GREEN_BORDER) + 2
  if (metric.priority && pX < x + w - 28) miniPill(doc, pX, y + 13.2, 'PRIORIDADE', AMBER_SOFT, AMBER, [253,230,138])

  drawValueRow(doc, x + 3.5, y + 19.2, 'Atleta', formatValue(metric.value, metric.format), w - 7)
  drawValueRow(doc, x + 3.5, y + 23.7, 'Média Confiança', formatValue(metric.avgClub, metric.format), w - 7)
  drawValueRow(doc, x + 3.5, y + 28.2, 'Média Série C', formatValue(metric.avgSerieC, metric.format), w - 7)

  const barX = x + 3.5
  const barW = w - 7
  const seriePct = clamp(metric.percentileSerieC)
  const gfcPct = clamp(metric.percentileClub)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.1)
  doc.setTextColor(...MUTED)
  doc.text('Série C', barX, y + 34.8)
  doc.setTextColor(...BLUE)
  doc.text(metric.percentileSerieC != null ? `P${Math.round(metric.percentileSerieC)}` : '-', barX + barW, y + 34.8, { align:'right' })
  doc.setFillColor(237,243,239)
  doc.roundedRect(barX, y + 36.2, barW, 2.8, 1.2, 1.2, 'F')
  if (metric.percentileSerieC != null) {
    doc.setFillColor(...BLUE)
    doc.roundedRect(barX, y + 36.2, barW * seriePct / 100, 2.8, 1.2, 1.2, 'F')
  }

  doc.setTextColor(...MUTED)
  doc.text('Confiança', barX, y + 43.3)
  doc.setTextColor(...GREEN)
  doc.text(metric.percentileClub != null ? `P${Math.round(metric.percentileClub)}` : '-', barX + barW, y + 43.3, { align:'right' })
  doc.setFillColor(237,243,239)
  doc.roundedRect(barX, y + 44.7, barW, 2.8, 1.2, 1.2, 'F')
  if (metric.percentileClub != null) {
    doc.setFillColor(...GREEN)
    doc.roundedRect(barX, y + 44.7, barW * gfcPct / 100, 2.8, 1.2, 1.2, 'F')
  }
}
function drawEvidenceCard(doc, item, x, y, w, h) {
  const classKey = String(item?.classification || '').toLowerCase()
  const tone = classKey.includes('diverg') ? RED : classKey.includes('exclusive') || classKey.includes('nao') ? PURPLE : classKey.includes('partial') || classKey.includes('suporte') ? AMBER : GREEN
  const soft = classKey.includes('diverg') ? RED_SOFT : classKey.includes('exclusive') || classKey.includes('nao') ? PURPLE_SOFT : classKey.includes('partial') || classKey.includes('suporte') ? AMBER_SOFT : GREEN_SOFT
  roundRectCard(doc, x, y, w, h, [255,255,255], LINE)
  doc.setFillColor(...soft)
  doc.roundedRect(x + 1.6, y + 1.6, w - 3.2, 7.2, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.setTextColor(...DARK)
  doc.text(shortText(item.title, 25), x + 3.5, y + 5.8)
  doc.setTextColor(...tone)
  doc.setFontSize(4.8)
  doc.text(shortText(item.classificationLabel || 'LEITURA', 18), x + w - 3.5, y + 5.8, { align:'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.9)
  doc.setTextColor(...MUTED)
  doc.text('OBSERVAÇÃO DO SCOUT', x + 3.5, y + 12.1)
  textBlock(doc, item.observation, x + 3.5, y + 15.1, w - 7, 5, 2.45, 6, DARK)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.9)
  doc.text('EVIDÊNCIA QUANTITATIVA', x + 3.5, y + 31.5)
  textBlock(doc, item.dataText, x + 3.5, y + 34.5, w - 7, 5, 2.45, 5, [41,77,54])
}
function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function exportAvaliacaoAtletaPdf({ analysis, qualitative = null, photoDataUrl }) {
  if (!analysis) throw new Error('Nenhuma avaliação disponível para exportar.')

  const jspdfMod = await import('jspdf')
  const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  let shield = null
  try { shield = await fetchDataUrl('/confianca.png') } catch {}
  let photo = null
  try { photo = await cropImageDataUrl(photoDataUrl) } catch {}

  const clubScore = analysis.clubScore != null ? analysis.clubScore : analysis.clubScore != null ? analysis.clubScore : (() => {
    const values = (analysis.metrics || []).map(m=>m.percentileClub ?? m.percentileClub).filter(v=>v!=null)
    return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0
  })()

  const seriePizza = pizzaCanvas(analysis.metrics, 'percentileSerieC', 'SÉRIE C', analysis.serieCScore)
  const clubPizza = pizzaCanvas(analysis.metrics.map(metric => ({ ...metric, percentileClub: metric.percentileClub ?? metric.percentileClub })), 'percentileClub', 'CONFIANÇA', clubScore)
  const benchmark = benchmarkCanvas(analysis.metrics)
  const metrics = analysis.metrics || []
  const metricsTop = metrics.slice(0, 6)
  const metricsAll = metrics
  const squadMatches = analysis.squadMatches || []
  const comparisonCards = metrics.slice(0, 8)
  const scoutReport = String(qualitative?.scoutReport || qualitative?.scoutSummary || '').trim()
  const correlation = qualitative?.correlation || null

  // Página 1 - Visão geral
  addHeader(doc, shield, 'VISÃO GERAL')
  roundRectCard(doc, 12, 31, 76, 48, [255,255,255], LINE)
  const photoX = 16, photoY = 35, photoW = 25, photoH = 36
  roundRectCard(doc, photoX, photoY, photoW, photoH, [240,245,242], LINE)
  if (photo) {
    try { doc.addImage(photo, 'JPEG', photoX, photoY, photoW, photoH, undefined, 'FAST') } catch {}
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text('FOTO', photoX + photoW / 2, photoY + photoH / 2, { align:'center' })
  }

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(String(analysis.player?.nome || 'Atleta'), 46, 40)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`${analysis.player?.equipa || '-'} | ${positionLabel(analysis.player?.posicao)} | ${analysis.context?.competition || '-'}`, 46, 46)
  doc.text(`Idade ${analysis.player?.idade || '-'} | Pé ${analysis.player?.pe || '-'} | ${Math.round(analysis.player?.minutos || 0)} min`, 46, 51)
  doc.text(`${analysis.player?.jogos || 0} jogos | Confiança ${analysis.sample?.label || '-'} | Pool Confiança ${analysis.pool?.club || 0}`, 46, 56)

  doc.setFillColor(...GREEN_SOFT)
  doc.roundedRect(46, 61, 37, 12, 2.2, 2.2, 'F')
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.text('MODELO ATUAL DO CONFIANÇA', 49, 66)
  doc.setTextColor(...DARK)
  doc.setFontSize(7)
  doc.text(shortText(analysis.model?.identity || 'Modelo não informado', 48), 49, 71)

  kpi(doc, 92, 31, 28, 'Fit Confiança', analysis.fitScore, analysis.fitLabel, fitTone(analysis.fitScore))
  kpi(doc, 123, 31, 28, 'Nível Série C', analysis.serieCScore, analysis.serieCLevel, fitTone(analysis.serieCScore))
  kpi(doc, 154, 31, 28, 'Vs. Confiança', clubScore, 'Comparação com o elenco', fitTone(clubScore))
  kpi(doc, 185, 31, 28, 'Amostra', `${Math.round(analysis.player?.minutos || 0)} min`, `Confiança ${analysis.sample?.label || '-'}`, BLUE)

  roundRectCard(doc, 216, 31, 69, 48, GREEN_SOFT, GREEN_BORDER)
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('LEITURA CIC', 220, 39)
  textBlock(doc, analysis.summary, 220, 44, 60, 6, 3.1, 9, [41,77,54])

  roundRectCard(doc, 12, 83, 88, 97, [255,255,255], LINE)
  roundRectCard(doc, 104, 83, 88, 97, [255,255,255], LINE)
  roundRectCard(doc, 196, 83, 89, 97, [255,255,255], LINE)
  sectionTitle(doc, 'PIZZA PLOT - SÉRIE C', 16, 92)
  sectionTitle(doc, 'PIZZA PLOT - ELENCO CONFIANÇA', 108, 92)
  sectionTitle(doc, 'INSIGHTS CIC', 200, 92)
  if (seriePizza) doc.addImage(seriePizza, 'PNG', 13, 94, 85, 82, undefined, 'FAST')
  if (clubPizza) doc.addImage(clubPizza, 'PNG', 105, 94, 85, 82, undefined, 'FAST')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...GREEN)
  doc.text('PONTOS FORTES', 202, 100)
  let insightY = addInsightList(doc, analysis.strengths, 202, 106, 78, GREEN, 3)
  doc.setTextColor(...AMBER)
  doc.text('PONTOS DE ATENÇÃO', 202, insightY + 4)
  addInsightList(doc, analysis.weaknesses, 202, insightY + 10, 78, AMBER, 3)

  // Página 2 - Comparação com cards
  doc.addPage('a4', 'landscape')
  addHeader(doc, shield, 'COMPARAÇÃO')
  roundRectCard(doc, 12, 31, 162, 74, [255,255,255], LINE)
  sectionTitle(doc, 'PERCENTIS POR CONTEXTO', 16, 40)
  if (benchmark) doc.addImage(benchmark, 'PNG', 14, 43, 157, 59, undefined, 'FAST')

  roundRectCard(doc, 178, 31, 107, 74, [255,255,255], LINE)
  sectionTitle(doc, 'COMPATIBILIDADE COM O ELENCO', 182, 40)
  let sy = 47
  if (squadMatches.length) {
    squadMatches.slice(0, 5).forEach((p, i) => {
      doc.setFillColor(...(i === 0 ? GREEN_SOFT : BG))
      doc.setDrawColor(...(i === 0 ? GREEN_BORDER : LINE))
      doc.roundedRect(182, sy, 98, 10.5, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(...DARK)
      doc.text(`#${i + 1} ${shortText(p.nome, 25)}`, 186, sy + 4.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.7)
      doc.setTextColor(...MUTED)
      doc.text(`${p.posicao || '-'} | ${Math.round(p.minutos || 0)} min`, 186, sy + 8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...fitTone(p.similarity))
      doc.text(`${p.similarity}%`, 276, sy + 5.5, { align:'right' })
      sy += 12.3
    })
  } else {
    textBlock(doc, 'Sem atletas suficientes da mesma função para gerar comparáveis internos.', 186, 49, 87, 6.1, 3.1, 5, MUTED)
  }

  roundRectCard(doc, 12, 110, 273, 74, [255,255,255], LINE)
  sectionTitle(doc, 'MÉTRICAS-CHAVE DE COMPARAÇÃO', 16, 119)
  const compW = 63
  const compGap = 4
  const compStartX = 16
  const compY1 = 124
  const compY2 = 153
  const compH = 27
  comparisonCards.slice(0, 4).forEach((metric, i) => drawMiniComparisonCard(doc, metric, compStartX + i * (compW + compGap), compY1, compW, compH))
  comparisonCards.slice(4, 8).forEach((metric, i) => drawMiniComparisonCard(doc, metric, compStartX + i * (compW + compGap), compY2, compW, compH))

  // Páginas de métricas em grid de cards. O grid é calculado para respeitar
  // a área útil da página e nunca invadir o rodapé.
  const metricPages = chunk(metricsAll, 6)
  metricPages.forEach((metricChunk, pageIndex) => {
    doc.addPage('a4', 'landscape')
    addHeader(doc, shield, pageIndex === 0 ? 'MÉTRICAS' : `MÉTRICAS ${pageIndex + 1}`)
    roundRectCard(doc, 12, 31, 273, 149, [255,255,255], LINE)
    sectionTitle(doc, 'MOSAICO DE MÉTRICAS', 16, 40)
    textBlock(doc, 'Leitura visual em cards, comparando valor do atleta, médias de referência e percentis contra Série C e elenco do Confiança.', 16, 46, 240, 6, 3, 2, MUTED)

    const compact = metricChunk.length > 4
    const cols = compact ? 3 : 2
    const gapX = 5
    const gapY = 6
    const contentW = 265
    const cardW = (contentW - gapX * (cols - 1)) / cols
    const cardH = 51
    const startX = 16
    const startY = 57
    metricChunk.forEach((metric, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      drawMetricCard(doc, metric, startX + col * (cardW + gapX), startY + row * (cardH + gapY), cardW, cardH)
    })
  })

  // Página adicional - Scout x Dados em cards
  if (scoutReport) {
    doc.addPage('a4', 'landscape')
    addHeader(doc, shield, 'SCOUT × DADOS')
    kpi(doc, 12, 31, 36, 'Convergência', correlation?.score == null ? '-' : `${correlation.score}%`, correlation?.label || 'Sem cruzamento', correlation?.score == null ? PURPLE : fitTone(correlation.score))
    kpi(doc, 51, 31, 36, 'Comparáveis', correlation?.comparableCount ?? 0, 'observações com dados', BLUE)
    kpi(doc, 90, 31, 36, 'Convergências', correlation?.convergenceCount ?? 0, 'diretas ou indiretas', GREEN)
    kpi(doc, 129, 31, 36, 'Exclusivas Scout', correlation?.exclusiveCount ?? 0, 'sem métrica direta', PURPLE)
    kpi(doc, 168, 31, 47, 'Fonte qualitativa', qualitative?.primarySource === 'in_loco' ? 'IN LOCO' : qualitative?.primarySource === 'mixed' ? 'VÍDEO + IN LOCO' : 'VÍDEO', 'parecer original preservado', GREEN)
    kpi(doc, 218, 31, 67, 'Status', scoutReport ? 'PARECER REGISTRADO' : 'SEM PARECER', 'triangulação qualitativa', AMBER)

    roundRectCard(doc, 12, 55, 132, 57, [255,255,255], LINE)
    sectionTitle(doc, 'PARECER DO SCOUT', 16, 64)
    textBlock(doc, scoutReport, 16, 70, 124, 6, 3.15, 14, DARK)

    roundRectCard(doc, 148, 55, 137, 57, GREEN_SOFT, GREEN_BORDER)
    sectionTitle(doc, 'SÍNTESE INTEGRADA CIC', 152, 64)
    textBlock(doc, correlation?.integratedSummary || 'O parecer foi salvo, mas ainda não há síntese integrada disponível.', 152, 70, 129, 6, 3.15, 14, [41,77,54])

    if (correlation?.note) {
      roundRectCard(doc, 12, 118, 273, 22, [255,255,255], LINE)
      sectionTitle(doc, 'NOTA METODOLÓGICA', 16, 127)
      textBlock(doc, correlation.note, 16, 133, 263, 5.5, 2.8, 3, MUTED)
    }

    const evidenceItems = correlation?.items || []
    const evidencePages = chunk(evidenceItems, 6)
    evidencePages.forEach((items, evidencePageIndex) => {
      doc.addPage('a4', 'landscape')
      addHeader(doc, shield, evidencePageIndex === 0 ? 'EVIDÊNCIAS CRUZADAS' : `EVIDÊNCIAS CRUZADAS ${evidencePageIndex + 1}`)
      roundRectCard(doc, 12, 31, 273, 149, [255,255,255], LINE)
      sectionTitle(doc, 'SCOUT × DADOS - MATRIZ DE EVIDÊNCIAS', 16, 40)
      textBlock(doc, 'Cada card preserva a observação original e mostra somente a evidência quantitativa relacionada, sem forçar equivalência entre conceitos diferentes.', 16, 46, 255, 5.8, 2.9, 2, MUTED)
      const cols = 3
      const gapX = 4.5
      const gapY = 6
      const cardW = (265 - gapX * 2) / 3
      const cardH = 52
      const startX = 16
      const startY = 57
      items.forEach((item, index) => {
        const col = index % cols
        const row = Math.floor(index / cols)
        drawEvidenceCard(doc, item, startX + col * (cardW + gapX), startY + row * (cardH + gapY), cardW, cardH)
      })
    })
  }

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i)
    addFooter(doc, i, totalPages)
  }

  const safeName = String(analysis.player?.nome || 'atleta').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  doc.save(`CIC_Avaliacao_${safeName || 'Atleta'}.pdf`)
}
