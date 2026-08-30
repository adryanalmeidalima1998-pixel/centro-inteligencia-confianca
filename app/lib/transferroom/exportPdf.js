/* ─────────────────────────────────────────────────────────────────────────────
   Exportação do TransferRoom · Centro de Inteligência · Confiança
   - Campinho (elenco) desenhado em <canvas> → exportável como PNG e PDF.
   - Quadro Indicados × Contratados → PDF tabelado (jspdf-autotable).
   Usa apenas jspdf/jspdf-autotable (já no projeto) — sem dependência nova.
   ──────────────────────────────────────────────────────────────────────────── */

const GREEN = '#0a66b7'
const INK = '#13291c'
const MUTED = '#6d8476'
const ESCUDO = '/confianca.png'

/* ── helpers de imagem (mesmo padrão dos demais PDFs do projeto) ─────────────── */
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
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function shortName(nome) {
  const t = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (t.length <= 2) return nome || ''
  return `${t[0]} ${t[t.length - 1]}`
}
function initials(nome) {
  const t = shortName(nome).split(/\s+/).filter(Boolean)
  return (t.slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase()
}
function today() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

/* ── desenho do campinho em canvas ───────────────────────────────────────────── */
async function renderCampinhoCanvas(zonas) {
  const W = 1580, HEADER = 104, PITCH_Y = HEADER + 6, PITCH_H = 980, H = PITCH_Y + PITCH_H + 20
  const M = 30
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // fundo
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── cabeçalho ──
  let shield = null
  try { shield = await loadImage(await fetchDataUrl(ESCUDO)) } catch (_) {}
  if (shield) ctx.drawImage(shield, M, 18, 68, 68)
  ctx.fillStyle = INK
  ctx.font = '800 30px Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('CIC · ELENCO 2026', M + 84, 48)
  ctx.fillStyle = MUTED
  ctx.font = '600 16px Arial, sans-serif'
  ctx.fillText('Plantel por posição — Centro de Inteligência do Confiança', M + 84, 74)
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = '600 15px Arial, sans-serif'
  ctx.fillText(today(), W - M, 74)
  ctx.textAlign = 'left'
  ctx.strokeStyle = '#e6efe9'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(M, HEADER - 2); ctx.lineTo(W - M, HEADER - 2); ctx.stroke()

  // ── gramado ──
  const px = M, py = PITCH_Y, pw = W - 2 * M, ph = PITCH_H
  const grad = ctx.createLinearGradient(px, 0, px + pw, 0)
  grad.addColorStop(0, '#0a5c31'); grad.addColorStop(0.5, '#0c6b3a'); grad.addColorStop(1, '#0a5c31')
  roundRect(ctx, px, py, pw, ph, 20); ctx.fillStyle = grad; ctx.fill()
  // faixas verticais
  ctx.save(); roundRect(ctx, px, py, pw, ph, 20); ctx.clip()
  for (let i = 0; i < 8; i++) {
    if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(px + (i * pw) / 8, py, pw / 8, ph) }
  }
  ctx.restore()
  // linhas
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3
  roundRect(ctx, px + 14, py + 14, pw - 28, ph - 28, 10); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px + pw / 2, py + 14); ctx.lineTo(px + pw / 2, py + ph - 14); ctx.stroke()
  ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, 70, 0, Math.PI * 2); ctx.stroke()
  const areaH = ph * 0.5, areaW = pw * 0.11
  ctx.strokeRect(px + 14, py + (ph - areaH) / 2, areaW, areaH)
  ctx.strokeRect(px + pw - 14 - areaW, py + (ph - areaH) / 2, areaW, areaH)

  // pré-carrega fotos
  const photoMap = {}
  await Promise.all(zonas.flatMap(z => z.jogadores.filter(j => j.tem_foto).map(async j => {
    try { photoMap[j.id] = await loadImage(await fetchDataUrl(`/api/transferroom?foto=${j.id}`)) } catch (_) {}
  })))

  // ── plaquinhas por posição ──
  const PW = 226, PH = 44, GAP = 10
  for (const z of zonas) {
    const cx = px + (z.x / 100) * pw
    const cy = py + (z.y / 100) * ph
    const n = z.jogadores.length
    const stackH = n > 0 ? n * (PH + GAP) - GAP : 30
    let y = cy - stackH / 2

    // rótulo do setor
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    ctx.font = '800 14px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(z.key.toUpperCase(), cx, y - 8)
    ctx.textAlign = 'left'

    if (n === 0) {
      const x0 = cx - PW / 2
      ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5
      roundRect(ctx, x0, y, PW, 30, 15); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '700 13px Arial, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('Sem atletas', cx, y + 20); ctx.textAlign = 'left'
      continue
    }

    for (const j of z.jogadores) {
      const x0 = cx - PW / 2
      // pill
      const g = ctx.createLinearGradient(0, y, 0, y + PH)
      g.addColorStop(0, '#0c6b3a'); g.addColorStop(1, '#064a26')
      roundRect(ctx, x0, y, PW, PH, PH / 2); ctx.fillStyle = g; ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke()

      // avatar
      const ar = (PH - 8) / 2, acx = x0 + 4 + ar, acy = y + PH / 2
      ctx.save(); ctx.beginPath(); ctx.arc(acx, acy, ar, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
      if (photoMap[j.id]) {
        const im = photoMap[j.id], s = Math.min(im.width, im.height)
        ctx.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, acx - ar, acy - ar, ar * 2, ar * 2)
      } else {
        ctx.fillStyle = '#0a3d20'; ctx.fillRect(acx - ar, acy - ar, ar * 2, ar * 2)
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 15px Arial, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(initials(j.nome), acx, acy + 1)
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      }
      ctx.restore()
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.22)'
      ctx.beginPath(); ctx.arc(acx, acy, ar, 0, Math.PI * 2); ctx.stroke()

      // escudo à direita
      if (shield) ctx.drawImage(shield, x0 + PW - 26, acy - 9, 18, 18)

      // nome
      ctx.fillStyle = '#ffffff'; ctx.font = '800 15px Arial, sans-serif'
      const textX = acx + ar + 10, textMax = (x0 + PW - 32) - textX
      ctx.fillText(fitText(ctx, shortName(j.nome).toUpperCase(), textMax), textX, acy + 5)

      y += PH + GAP
    }
  }

  return canvas
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function exportCampinhoPNG(zonas) {
  const canvas = await renderCampinhoCanvas(zonas)
  await new Promise(res => canvas.toBlob(b => { download(b, `Elenco-2026-CIC-${today().replace(/\//g, '-')}.png`); res() }, 'image/png'))
}

export async function exportCampinhoPDF(zonas) {
  const canvas = await renderCampinhoCanvas(zonas)
  const img = canvas.toDataURL('image/jpeg', 0.92)
  const mod = await import('jspdf')
  const jsPDF = mod.jsPDF ?? mod.default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight()
  const m = 8, availW = pw - 2 * m, availH = ph - 2 * m
  const ratio = canvas.width / canvas.height
  let w = availW, h = w / ratio
  if (h > availH) { h = availH; w = h * ratio }
  doc.addImage(img, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST')
  doc.save(`Elenco-2026-CIC-${today().replace(/\//g, '-')}.pdf`)
}

/* ── quadro Indicados × Contratados em PDF ───────────────────────────────────── */
export async function exportBoardPDF(rows) {
  const mod = await import('jspdf')
  const jsPDF = mod.jsPDF ?? mod.default
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()

  // cabeçalho
  let shield = null
  try { shield = await fetchDataUrl(ESCUDO) } catch (_) {}
  if (shield) { try { doc.addImage(shield, 'PNG', 14, 10, 16, 16, undefined, 'FAST') } catch (_) {} }
  doc.setTextColor(INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text('TransferRoom · Indicados × Contratados', shield ? 34 : 14, 18)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED)
  doc.text('Centro de Inteligência do Confiança', shield ? 34 : 14, 24)
  doc.text(today(), pw - 14, 24, { align: 'right' })

  const fmt = list => (list && list.length)
    ? list.map(p => `• ${p.nome}${p.tem_relatorio ? '  [relatório ✓]' : ''}${p.clube ? `  (${p.clube})` : ''}`).join('\n')
    : '—'

  const body = rows
    .filter(r => (r.indicados?.length || 0) + (r.contratados?.length || 0) > 0)
    .map(r => [r.pos, fmt(r.indicados), fmt(r.contratados)])

  autoTable(doc, {
    startY: 30,
    head: [['Posição', 'Recomendação do scouting', 'Contratados']],
    body: body.length ? body : [['—', 'Nenhum indicado cadastrado', 'Nenhum contratado cadastrado']],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, valign: 'top', lineColor: [223, 236, 228], textColor: [19, 41, 28] },
    headStyles: { fillColor: [10, 102, 183], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [244, 248, 245] },
    columnStyles: { 0: { cellWidth: 34, fontStyle: 'bold' }, 1: { cellWidth: 74 }, 2: { cellWidth: 74 } },
    margin: { left: 14, right: 14 },
  })

  doc.save(`TransferRoom-CIC-${today().replace(/\//g, '-')}.pdf`)
}
