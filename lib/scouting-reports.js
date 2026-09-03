import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'
import sharp from 'sharp'

const GREEN = [10, 102, 183]
const DARK = [20, 48, 33]
const MUTED = [90, 112, 99]

function safe(value, fallback = '—') { return value === null || value === undefined || value === '' ? fallback : String(value) }
function number(value, decimals = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function metricValue(value, type) {
  if (type === 'percent' || type === 'distribution') return `${number(value, 1)}%`
  if (type === 'total' || type === 'index') return number(value, 0)
  return number(value, 2)
}
function escapeXml(value) {
  return safe(value, '').replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]))
}
function slugify(value) {
  return safe(value, 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
function pdfBuffer(doc) { return Buffer.from(doc.output('arraybuffer')) }

function header(doc, title, subtitle = '') {
  const width = doc.internal.pageSize.getWidth()
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, width, 25, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(title, 14, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(subtitle, 14, 18)
  doc.setTextColor(...DARK)
}

function footer(doc, generatedAt) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    const height = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`CIC · Centro de Inteligência do Confiança · ${new Date(generatedAt || Date.now()).toLocaleString('pt-BR')}`, 14, height - 7)
    doc.text(`${page}/${pages}`, doc.internal.pageSize.getWidth() - 14, height - 7, { align: 'right' })
  }
}

function sectionTitle(doc, title, y) {
  doc.setFillColor(236, 247, 240)
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 9, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...GREEN)
  doc.text(title, 18, y + 6)
  doc.setTextColor(...DARK)
  return y + 13
}

export function createDashboardPdf(report) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  header(doc, 'CIC Decision Room', 'Confiança 2027 · Série D → Série C · mercado contextual')
  let y = 34
  const k = report.kpis || {}
  autoTable(doc, {
    startY: y,
    head: [['Ligas', 'Base total', 'Mercado imediato', 'Só referência', 'Oportunidades', 'Focos', 'Funil', 'Saúde']],
    body: [[k.leagues || 0, k.players || 0, k.immediatePlayers || 0, k.referencePlayers || 0, k.opportunities || 0, k.activeFoci || 0, k.pipeline || 0, `${report.health?.score || 0}/100`]],
    styles: { fontSize: 9, halign: 'center', cellPadding: 3 },
    headStyles: { fillColor: GREEN, textColor: 255 },
  })
  y = doc.lastAutoTable.finalY + 8
  y = sectionTitle(doc, 'Resumo executivo', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const lines = doc.splitTextToSize(report.executiveSummary || 'Sem resumo disponível.', 260)
  doc.text(lines, 16, y)
  y += lines.length * 4.5 + 6
  y = sectionTitle(doc, 'Oportunidades prioritárias', y)
  autoTable(doc, {
    startY: y,
    head: [['#', 'Jogador', 'Clube', 'Pos.', 'Idade', 'Liga', 'Mercado', 'Perfil', 'Fit', 'Técnica', 'Prioridade']],
    body: (report.opportunities || []).slice(0, 10).map((item, index) => [index + 1, item.nome, item.equipe, item.posicao, item.idade || '—', item.ligaNome, `${item.marketBand || '—'} · ${item.marketLabel || '—'}`, item.profile, item.fit, item.technicalPriority, item.opportunityScore]),
    styles: { fontSize: 7.8, cellPadding: 2.1 },
    headStyles: { fillColor: [25, 77, 49], textColor: 255 },
    columnStyles: { 0: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' } },
  })
  const nextY = doc.lastAutoTable.finalY + 8
  if (nextY > 170) doc.addPage()
  const start = nextY > 170 ? 32 : nextY
  sectionTitle(doc, 'Cobertura das ligas', start)
  autoTable(doc, {
    startY: start + 13,
    head: [['Liga', 'Mercado', 'Acionáveis', 'Referência', 'Fonte', 'Jogadores', 'Corte', 'Status']],
    body: (report.coverage || []).slice(0, 14).map(item => [item.name, `${item.market?.band || 'R'} · ${item.market?.label || 'Referência'}`, item.market?.actionablePlayers || 0, item.market?.referencePlayers || 0, safe(item.source).toUpperCase(), item.players, `${item.minimum} min`, item.freshness?.label || '—']),
    styles: { fontSize: 7.8, cellPadding: 2 },
    headStyles: { fillColor: GREEN, textColor: 255 },
  })
  footer(doc, report.generatedAt)
  return pdfBuffer(doc)
}

export function createOpportunitiesPdf(report) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  header(doc, 'Oportunidades prioritárias', 'Score técnico ajustado pela viabilidade do mercado para um Confiança buscando o acesso')
  autoTable(doc, {
    startY: 33,
    head: [['#', 'Jogador', 'Clube', 'Pos.', 'Liga', 'Mercado', 'Idade', 'Min', 'Perfil', 'Fit', 'Desemp.', 'Técnica', 'Prioridade', 'Por quê']],
    body: (report.opportunities || []).slice(0, 30).map((item, index) => [
      index + 1, item.nome, item.equipe, item.posicao, item.ligaNome, `${item.marketBand || '—'} · ${item.marketLabel || '—'}`, item.idade || '—', item.minutos,
      item.profile, item.fit, item.profileScore, item.technicalPriority, item.opportunityScore,
      [...(item.positives || []), ...(item.cautions || []).map(value => `Atenção: ${value}`)].join(' · '),
    ]),
    styles: { fontSize: 6.9, cellPadding: 1.7, valign: 'middle' },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 13: { cellWidth: 56 } },
  })
  footer(doc, report.generatedAt)
  return pdfBuffer(doc)
}

export function createFocusPdf(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  header(doc, 'Focos e necessidades de recrutamento', 'Lacunas do elenco cruzadas com o mercado')
  let y = 34
  for (const need of (report.needs || []).slice(0, 12)) {
    if (y > 255) { doc.addPage(); y = 20 }
    doc.setDrawColor(215, 231, 220)
    doc.setFillColor(248, 252, 249)
    doc.roundedRect(14, y, 182, 27, 3, 3, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(`${need.priority || 'Média'} · ${need.title}`, 18, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(need.reason || '', 135), 18, y + 13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GREEN)
    doc.text(`${need.group || 'Mercado'} · ${need.candidates || 0} candidato(s)`, 192, y + 7, { align: 'right' })
    y += 32
  }
  footer(doc, report.generatedAt)
  return pdfBuffer(doc)
}

export function createAlertsPdf(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  header(doc, 'Alertas e próximas ações', 'Saúde dos dados, watchlist e gestão do funil')
  autoTable(doc, {
    startY: 33,
    head: [['Nível', 'Categoria', 'Título', 'Alerta']],
    body: (report.alerts || []).map(item => [safe(item.severity).toUpperCase(), item.category, item.title, item.message]),
    styles: { fontSize: 8, cellPadding: 2.4 },
    headStyles: { fillColor: GREEN, textColor: 255 },
    columnStyles: { 3: { cellWidth: 100 } },
  })
  let y = doc.lastAutoTable.finalY + 8
  if (y > 240) { doc.addPage(); y = 20 }
  y = sectionTitle(doc, 'Fila operacional', y)
  autoTable(doc, {
    startY: y,
    head: [['Ação', 'Quantidade', 'Prioridade']],
    body: (report.actions || []).map(item => [item.label, item.value, item.priority === 'high' ? 'Alta' : 'Normal']),
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [25, 77, 49], textColor: 255 },
  })
  footer(doc, report.generatedAt)
  return pdfBuffer(doc)
}

export function createExecutivePdf(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  header(doc, 'Resumo executivo semanal', 'Leitura automática com evidências do dashboard')
  let y = 36
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  const lines = doc.splitTextToSize(report.executiveSummary || 'Sem resumo disponível.', 178)
  doc.text(lines, 16, y)
  y += lines.length * 5.5 + 10
  y = sectionTitle(doc, 'Contexto de mercado aplicado', y)
  const market = report.marketContext?.summary || {}
  autoTable(doc, {
    startY: y,
    head: [['Competição atual', 'Objetivo', 'Mercado imediato', 'Projetos', 'Somente referência']],
    body: [[report.marketContext?.currentCompetition || 'Planejamento 2027 · Série D', report.marketContext?.objective || 'Acesso à Série C', market.immediate || 0, market.development || 0, market.reference || 0]],
    styles: { fontSize: 8.2, cellPadding: 2.4 },
    headStyles: { fillColor: [25, 77, 49], textColor: 255 },
  })
  y = doc.lastAutoTable.finalY + 8
  y = sectionTitle(doc, 'Confiança', y)
  const clubData = report.club || {}
  const g = clubData.summary || {}
  autoTable(doc, {
    startY: y,
    head: [['Jogos', 'Pontos', 'Aproveitamento', 'GP', 'GC', 'Saldo', 'Identidade']],
    body: [[g.games || 0, g.points || 0, `${number(g.performance, 1)}%`, g.goalsFor || 0, g.goalsAgainst || 0, g.goalDifference || 0, clubData.model?.identity || 'Em construção']],
    styles: { fontSize: 8.2, cellPadding: 2.4 },
    headStyles: { fillColor: GREEN, textColor: 255 },
  })
  y = doc.lastAutoTable.finalY + 8
  y = sectionTitle(doc, 'Principais necessidades', y)
  autoTable(doc, {
    startY: y,
    head: [['Prioridade', 'Necessidade', 'Grupo', 'Candidatos', 'Motivo']],
    body: (report.needs || []).slice(0, 6).map(item => [item.priority, item.title, item.group, item.candidates || 0, item.reason]),
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [25, 77, 49], textColor: 255 },
    columnStyles: { 4: { cellWidth: 78 } },
  })
  footer(doc, report.generatedAt)
  return pdfBuffer(doc)
}

export function createTopMetricPdf(metric, generatedAt) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  header(doc, `Top 5 · ${metric.label}`, `Mercado imediato · ${metric.eligible || 0} elegíveis · corte ${metric.minimum || 0} min`)
  autoTable(doc, {
    startY: 36,
    head: [['#', 'Jogador', 'Clube', 'Pos.', 'Liga', 'Mercado', 'Valor', 'Pctl', 'Min']],
    body: (metric.rows || []).map((item, index) => [index + 1, item.nome, item.equipe, item.posicao, item.ligaNome, item.marketBand || '—', metricValue(item.value, metric.type), `P${item.percentile || 0}`, item.minutos]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: GREEN, textColor: 255 },
  })
  footer(doc, generatedAt)
  return pdfBuffer(doc)
}

export async function createTopMetricPng(metric, generatedAt) {
  const rows = (metric.rows || []).slice(0, 5)
  const rowSvg = rows.map((item, index) => {
    const y = 190 + index * 92
    return `<g>
      <rect x="70" y="${y - 50}" width="1060" height="72" rx="16" fill="${index === 0 ? '#e9f7ee' : '#f7faf8'}" stroke="#d8e8dd"/>
      <text x="96" y="${y - 6}" font-size="30" font-weight="800" fill="#0a66b7">${index + 1}º</text>
      <text x="170" y="${y - 18}" font-size="25" font-weight="800" fill="#153323">${escapeXml(item.nome)}</text>
      <text x="170" y="${y + 10}" font-size="16" fill="#607568">${escapeXml(item.equipe)} · ${escapeXml(item.posicao)} · Mercado ${escapeXml(item.marketBand || '—')} · ${escapeXml(item.ligaNome)}</text>
      <text x="1095" y="${y - 8}" text-anchor="end" font-size="31" font-weight="900" fill="#0a66b7">${escapeXml(metricValue(item.value, metric.type))}</text>
      <text x="1095" y="${y + 14}" text-anchor="end" font-size="15" font-weight="700" fill="#7b8d82">P${item.percentile || 0} · ${item.minutos || 0} min</text>
    </g>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <rect width="1200" height="720" fill="#f2f8f4"/>
    <rect width="1200" height="112" fill="#0a66b7"/>
    <text x="70" y="53" font-size="23" font-weight="700" fill="#c9edd5">CIC · SCOUTING &amp; DATA</text>
    <text x="70" y="88" font-size="35" font-weight="900" fill="#ffffff">TOP 5 · ${escapeXml(metric.label).toUpperCase()}</text>
    <text x="70" y="145" font-size="18" fill="#607568">Mercado imediato · ${metric.eligible || 0} elegíveis · corte ${metric.minimum || 0} min · atualizado ${escapeXml(new Date(generatedAt || Date.now()).toLocaleDateString('pt-BR'))}</text>
    ${rowSvg || '<text x="600" y="360" text-anchor="middle" font-size="28" fill="#607568">Sem jogadores elegíveis</text>'}
    <text x="70" y="685" font-size="15" fill="#708279">Triagem estatística. A decisão final depende de vídeo, contexto tático e observação.</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function createWeeklyPackage(report) {
  const zip = new JSZip()
  zip.file('01_dashboard_mercado.pdf', createDashboardPdf(report))
  zip.file('02_oportunidades_prioritarias.pdf', createOpportunitiesPdf(report))
  zip.file('04_focos_recrutamento.pdf', createFocusPdf(report))
  zip.file('05_alertas_watchlist.pdf', createAlertsPdf(report))
  zip.file('06_resumo_executivo.pdf', createExecutivePdf(report))

  const topZip = new JSZip()
  for (const metric of report.topMetrics || []) {
    const base = `${slugify(metric.label)}-${metric.key}`
    topZip.file(`${base}.png`, await createTopMetricPng(metric, report.generatedAt))
    topZip.file(`${base}.pdf`, createTopMetricPdf(metric, report.generatedAt))
  }
  zip.file('03_top5_metricas.zip', await topZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }))
  zip.file('LEIA-ME.txt', [
    'PACOTE SEMANAL CIC',
    `Gerado em: ${new Date(report.generatedAt || Date.now()).toLocaleString('pt-BR')}`,
    '',
    'Os materiais usam uma política contextual para o planejamento 2027 do Confiança na Série D, com objetivo de acesso à Série C. Ligas e clubes fora da realidade permanecem como referência e não lideram a prioridade automática.',
    'A triagem não substitui avaliação de vídeo, observação ao vivo, contexto tático, negociação ou decisão final.',
  ].join('\n'))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
