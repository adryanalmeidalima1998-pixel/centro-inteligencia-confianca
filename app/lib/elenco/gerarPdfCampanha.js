// app/lib/elenco/gerarPdfCampanha.js
// Gera PDF executivo da campanha do Confiança — design CIC profissional.
// Usa jsPDF (client-side). Importar dinamicamente para não quebrar SSR.

// ── Cores CIC ────────────────────────────────────────────────
const C = {
  verde:     [0,   102,  51],
  verdeMed:  [0,   134,  67],
  verdeCla:  [232, 245, 237],
  verdeEsc:  [26,  58,  38],
  laranja:   [180, 83,   9],
  laranjaCla:[255, 247, 237],
  vermelho:  [198, 40,  40],
  vermCla:   [253, 236, 234],
  cinza:     [148, 184, 160],
  cinzaEsc:  [100, 116, 139],
  fundo:     [247, 252, 249],
  branco:    [255, 255, 255],
  preto:     [26,  58,  38],
  borda:     [224, 237, 230],
  linha:     [240, 247, 242],
}

const RES_COR = { V: C.verde, E: C.laranja, D: C.vermelho }
const RES_LABEL = { V: 'Vitória', E: 'Empate', D: 'Derrota' }

// ── Helpers ───────────────────────────────────────────────────
const f1 = (n) => isNaN(n) || n == null ? '0.0' : Number(n).toFixed(1)
const fp = (n) => `${f1(n)}%`
const rgb = (arr) => ({ r: arr[0], g: arr[1], b: arr[2] })
const hex = (arr) => '#' + arr.map(v => v.toString(16).padStart(2, '0')).join('')

function setFill(doc, color) { doc.setFillColor(...color) }
function setStroke(doc, color) { doc.setDrawColor(...color) }
function setTextColor(doc, color) { doc.setTextColor(...color) }
function setFont(doc, weight = 'normal', size = 10) {
  doc.setFont('helvetica', weight)
  doc.setFontSize(size)
}

// Rect com borda suave (simulada com rounding via linha)
function card(doc, x, y, w, h, { fill = C.branco, stroke = C.borda, radius = 4 } = {}) {
  setFill(doc, fill)
  setStroke(doc, stroke)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, radius, radius, 'FD')
}

function badge(doc, x, y, label, color) {
  const w = 14, h = 7
  setFill(doc, color.map(v => Math.min(255, v + 180 > 255 ? 255 : v + 180)))
  setStroke(doc, color)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  setFont(doc, 'bold', 7)
  setTextColor(doc, color)
  doc.text(label, x + w / 2, y + h / 2 + 2.5, { align: 'center' })
}

// Cabeçalho padrão de página
function header(doc, titulo, subtitulo, pageNum) {
  const W = doc.internal.pageSize.getWidth()
  // Faixa verde topo
  setFill(doc, C.verde)
  doc.rect(0, 0, W, 16, 'F')
  // Título
  setFont(doc, 'bold', 13)
  setTextColor(doc, C.branco)
  doc.text('CONFIANÇA', 14, 10)
  setFont(doc, 'normal', 8)
  doc.text('CIC — Central de Inteligência', 14, 14.5)
  // Título direito
  setFont(doc, 'bold', 10)
  doc.text(titulo.toUpperCase(), W - 14, 9, { align: 'right' })
  setFont(doc, 'normal', 7)
  doc.text(subtitulo, W - 14, 13.5, { align: 'right' })
}

// Rodapé padrão
function footer(doc, pageNum, total) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  setFill(doc, C.borda)
  doc.rect(0, H - 10, W, 10, 'F')
  setFont(doc, 'normal', 7)
  setTextColor(doc, C.cinzaEsc)
  const now = new Date().toLocaleDateString('pt-BR')
  doc.text(`CIC — Central de Inteligência do Confiança · Série C 2026 · Gerado em ${now}`, 14, H - 3.5)
  doc.text(`${pageNum} / ${total}`, W - 14, H - 3.5, { align: 'right' })
}

// Mini KPI card
function kpiCard(doc, x, y, w, h, label, value, color = C.verde, small = false) {
  card(doc, x, y, w, h)
  // Dot colorido no topo direito
  setFill(doc, color)
  doc.circle(x + w - 5, y + 5, 2, 'F')
  // Label
  setFont(doc, 'bold', 6.5)
  setTextColor(doc, C.cinza)
  doc.text(label.toUpperCase(), x + 6, y + 8)
  // Valor
  setFont(doc, 'bold', small ? 14 : 18)
  setTextColor(doc, color)
  doc.text(String(value), x + 6, y + h - 5)
}

// Linha separadora seção
function sectionTitle(doc, x, y, text) {
  setFill(doc, C.verde)
  doc.rect(x, y, 3, 10, 'F')
  setFont(doc, 'bold', 10)
  setTextColor(doc, C.verdeEsc)
  doc.text(text.toUpperCase(), x + 7, y + 7)
}

// Gráfico de linha da posição — desenhado manualmente
function graficoLinha(doc, x, y, w, h, sorted) {
  if (!sorted.length) return
  const margin = { top: 8, right: 10, bottom: 18, left: 22 }
  const chartW = w - margin.left - margin.right
  const chartH = h - margin.top - margin.bottom
  const cx = x + margin.left
  const cy = y + margin.top

  const posicoes = sorted.map(s => s.posicao)
  const maxPos = Math.max(...posicoes, 12)
  const minPos = 1
  const n = sorted.length

  // Fundo do gráfico
  setFill(doc, C.branco)
  doc.rect(cx, cy, chartW, chartH, 'F')

  // Faixa G8 (posições 1-8) — verde claro
  const g8Top = cy
  const g8Bot = cy + ((8 - minPos) / (maxPos - minPos)) * chartH
  setFill(doc, [232, 248, 240])
  doc.rect(cx, g8Top, chartW, g8Bot - g8Top, 'F')

  // Linha pontilhada G8
  const yG8 = cy + ((8 - minPos) / (maxPos - minPos)) * chartH
  setStroke(doc, C.verde)
  doc.setLineWidth(0.5)
  doc.setLineDashPattern([2, 1.5], 0)
  doc.line(cx, yG8, cx + chartW, yG8)
  doc.setLineDashPattern([], 0)
  setFont(doc, 'bold', 6)
  setTextColor(doc, C.verde)
  doc.text('G8', cx + chartW + 2, yG8 + 2)

  // Grid linhas horizontais
  doc.setLineWidth(0.2)
  setStroke(doc, C.linha)
  for (let p = 2; p <= maxPos; p += 2) {
    const yy = cy + ((p - minPos) / (maxPos - minPos)) * chartH
    doc.line(cx, yy, cx + chartW, yy)
  }

  // Labels eixo Y
  setFont(doc, 'normal', 6)
  setTextColor(doc, C.cinza)
  for (let p = 1; p <= maxPos; p += 2) {
    const yy = cy + ((p - minPos) / (maxPos - minPos)) * chartH
    doc.text(`${p}°`, cx - 3, yy + 2, { align: 'right' })
  }

  // Labels eixo X
  const xStep = chartW / (n - 1 || 1)
  sorted.forEach((s, i) => {
    const xx = cx + i * xStep
    setFont(doc, 'normal', 6)
    setTextColor(doc, C.cinza)
    doc.text(`R${s.rodada}`, xx, cy + chartH + 7, { align: 'center' })
  })

  // Calcular pontos
  const pts = sorted.map((s, i) => ({
    x: cx + i * xStep,
    y: cy + ((s.posicao - minPos) / (maxPos - minPos)) * chartH,
    r: s.resultado,
    pos: s.posicao,
    isLast: i === sorted.length - 1,
  }))

  // Área sombreada abaixo da linha (gradiente simulado com retângulos)
  // Desenhamos polígono fechado com fill verde claro
  if (pts.length > 1) {
    setFill(doc, [10, 102, 183, 0.08])
    const polyPts = [
      [pts[0].x, cy + chartH],
      ...pts.map(p => [p.x, p.y]),
      [pts[pts.length - 1].x, cy + chartH],
    ]
    // jsPDF polygon
    doc.setFillColor(10, 102, 183)
    doc.setGState && doc.setGState(doc.GState({ opacity: 0.07 }))
    // Fallback: linha simples
  }

  // Linha principal verde
  doc.setLineWidth(1.5)
  setStroke(doc, C.verde)
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
  }

  // Pontos com resultado
  pts.forEach((p, i) => {
    const cor = RES_COR[p.r] || C.cinza
    const r = p.isLast ? 5 : 4
    // Halo no último
    if (p.isLast) {
      setFill(doc, cor.map(v => Math.min(255, v + 160)))
      doc.circle(p.x, p.y, r + 2.5, 'F')
    }
    // Círculo
    setFill(doc, cor.map(v => Math.min(255, v + 180)))
    setStroke(doc, cor)
    doc.setLineWidth(1)
    doc.circle(p.x, p.y, r, 'FD')
    // Label resultado
    setFont(doc, 'bold', 5.5)
    setTextColor(doc, cor)
    doc.text(p.r, p.x, p.y + 2, { align: 'center' })
  })

  // Label "Liderança" se chegou a 1°
  const liderIdx = sorted.findIndex(s => s.posicao === 1)
  if (liderIdx >= 0) {
    const px = pts[liderIdx].x
    const py = pts[liderIdx].y
    setFont(doc, 'bold', 5.5)
    setTextColor(doc, C.verde)
    doc.text('Liderança', px, py - 6, { align: 'center' })
  }
}

// ── Cálculos derivados ────────────────────────────────────────
function calcStats(sorted) {
  if (!sorted.length) return null
  const n = sorted.length
  const posAtual = sorted[n - 1].posicao
  const melhor = Math.min(...sorted.map(h => h.posicao))
  const pior = Math.max(...sorted.map(h => h.posicao))
  const g8 = sorted.filter(h => h.posicao <= 8).length
  const foraG8 = sorted.filter(h => h.posicao > 8).length
  const ptsAcum = sorted[n - 1].pontosAcumulados || 0
  const aprGeral = n ? parseFloat(((ptsAcum / (n * 3)) * 100).toFixed(1)) : 0
  const variacoes = sorted.map(h => h.variacaoPosicao).filter(v => !isNaN(v))
  const maiorSubida = variacoes.length ? Math.max(...variacoes) : 0
  const maiorQueda = variacoes.length ? Math.min(...variacoes) : 0
  const totalGp = sorted.reduce((s, h) => s + (h.golsPro || 0), 0)
  const totalGc = sorted.reduce((s, h) => s + (h.golsContra || 0), 0)
  const rodadasLider = sorted.filter(h => h.posicao === 1).length

  // Último 5
  const last5 = sorted.slice(-5)
  const pts5 = last5.reduce((s, h) => s + (h.pontosRodada || 0), 0)
  const apr5 = last5.length ? parseFloat(((pts5 / (last5.length * 3)) * 100).toFixed(1)) : 0
  const v5 = last5.filter(h => h.resultado === 'V').length
  const e5 = last5.filter(h => h.resultado === 'E').length
  const d5 = last5.filter(h => h.resultado === 'D').length
  const gp5 = last5.reduce((s, h) => s + (h.golsPro || 0), 0)
  const gc5 = last5.reduce((s, h) => s + (h.golsContra || 0), 0)
  const varPos5 = last5.length >= 2 ? last5[0].posicao - last5[last5.length - 1].posicao : 0

  // Tendência (últimas 3 rodadas)
  const last3 = sorted.slice(-3)
  let tend = 'estavel'
  if (last3.length >= 2) {
    if (last3[last3.length - 1].posicao < last3[0].posicao) tend = 'subindo'
    else if (last3[last3.length - 1].posicao > last3[0].posicao) tend = 'caindo'
  }

  // Sequência atual
  let seqAtual = 0, seqTipo = ''
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (i === sorted.length - 1) { seqTipo = sorted[i].resultado; seqAtual = 1 }
    else if (sorted[i].resultado === seqTipo) seqAtual++
    else break
  }

  // Casa x Fora
  const casa = sorted.filter(h => h.mando === 'casa')
  const fora = sorted.filter(h => h.mando !== 'casa')
  const mandoCalc = (arr) => {
    if (!arr.length) return null
    const v = arr.filter(h => h.resultado === 'V').length
    const e = arr.filter(h => h.resultado === 'E').length
    const d = arr.filter(h => h.resultado === 'D').length
    const gp = arr.reduce((s, h) => s + (h.golsPro || 0), 0)
    const gc = arr.reduce((s, h) => s + (h.golsContra || 0), 0)
    const pts = arr.reduce((s, h) => s + (h.pontosRodada || 0), 0)
    return { j: arr.length, v, e, d, gp, gc, pts, apr: parseFloat(((pts / (arr.length * 3)) * 100).toFixed(1)) }
  }

  // Maior vitória
  const comDiff = sorted.map(h => ({ ...h, diff: (h.golsPro || 0) - (h.golsContra || 0) }))
  const maiorVit = comDiff.filter(h => h.resultado === 'V').sort((a, b) => b.diff - a.diff)[0]
  // Maior impacto
  const maiorImpacto = [...sorted].sort((a, b) => b.variacaoPosicao - a.variacaoPosicao)[0]
  // Jogos sem sofrer gol
  const cleanSheets = sorted.filter(h => (h.golsContra || 0) === 0).length

  return {
    n, posAtual, melhor, pior, g8, foraG8, ptsAcum, aprGeral,
    maiorSubida, maiorQueda, totalGp, totalGc, rodadasLider,
    tend, seqAtual, seqTipo,
    last5: { n: last5.length, pts: pts5, apr: apr5, v: v5, e: e5, d: d5, gp: gp5, gc: gc5, varPos: varPos5 },
    casa: mandoCalc(casa),
    fora: mandoCalc(fora),
    maiorVit, maiorImpacto, cleanSheets,
  }
}

function gerarTextoResumo(sorted, st) {
  if (!sorted || !st) return ''
  const primeiraPos = sorted[0].posicao
  const posStr = st.posAtual === 1 ? 'na liderança' : `em ${st.posAtual}° lugar`
  let txt = `O Confiança iniciou a competição em ${primeiraPos}° lugar e hoje se encontra ${posStr}, `
  txt += `acumulando ${st.ptsAcum} pontos em ${st.n} rodadas com ${f1(st.aprGeral)}% de aproveitamento. `
  if (st.g8 === st.n) txt += `A equipe permaneceu dentro do G8 em todas as rodadas analisadas. `
  else if (st.g8 > st.foraG8) txt += `A equipe permaneceu dentro do G8 em ${st.g8} das ${st.n} rodadas analisadas, demonstrando estabilidade competitiva. `
  else txt += `A equipe ainda busca estabilidade dentro do G8, tendo ficado fora da zona por ${st.foraG8} rodadas. `
  if (st.rodadasLider > 0) txt += `O time liderou a tabela em ${st.rodadasLider} rodada${st.rodadasLider > 1 ? 's' : ''}. `
  const saldo = st.totalGp - st.totalGc
  txt += `Saldo de gols positivo: ${saldo >= 0 ? '+' : ''}${saldo} (${st.totalGp} marcados, ${st.totalGc} sofridos).`
  return txt
}

function gerarTextoConclusao(sorted, st) {
  if (!st) return ''
  const tendStr = { subindo: 'ascendente', estavel: 'estável', caindo: 'em queda' }[st.tend] || 'estável'
  let txt = `A campanha apresenta trajetória ${tendStr}. `
  if (st.posAtual <= 8) txt += `O Confiança está dentro do G8 com ${st.ptsAcum} pontos, posição que deve ser sustentada com regularidade nas próximas rodadas. `
  else txt += `O time está fora do G8 e precisa recuperar posição nas próximas rodadas. `
  if (st.seqAtual >= 2 && st.seqTipo === 'V') txt += `A sequência de ${st.seqAtual} vitórias seguidas indica momento positivo. `
  if (st.casa && st.fora) {
    if (st.casa.apr > st.fora.apr) txt += `O rendimento em casa (${f1(st.casa.apr)}%) é superior ao desempenho fora (${f1(st.fora.apr)}%), indicando maior vulnerabilidade nos jogos como visitante. `
    else if (st.fora.apr > st.casa.apr) txt += `O time apresenta bom rendimento fora de casa (${f1(st.fora.apr)}%), resultado que diferencia equipes que chegam às fases finais da competição. `
    else txt += `O aproveitamento em casa e fora está equilibrado, sinal de consistência competitiva. `
  }
  const pontoAtencao = st.tend === 'caindo' ? 'A queda recente de posições é o principal ponto de atenção.' :
    st.fora && st.fora.apr < 40 ? 'O aproveitamento fora de casa abaixo de 40% merece atenção imediata.' :
    st.cleanSheets < 3 ? 'A defesa sofreu gols em muitos jogos — solidez defensiva é ponto a desenvolver.' :
    'Manter regularidade ofensiva e defensive ao longo da competição é o principal desafio.'
  txt += pontoAtencao
  return txt
}

function gerarObjetivoImediato(st) {
  if (!st) return 'Seguir firme na competição.'
  if (st.posAtual === 1) return 'Sustentar a liderança e ampliar a margem sobre os demais concorrentes ao G8.'
  if (st.posAtual <= 4) return 'Manter-se no G8 e pressionar a liderança nas próximas rodadas.'
  if (st.posAtual <= 8) return 'Consolidar posição dentro do G8 e aumentar a folga em relação ao 9° colocado.'
  return 'Recuperar posição na tabela, encurtar distância para o G8 e retomar regularidade.'
}

function statusNarrativo(h, i, sorted) {
  const prev = sorted[i - 1]
  if (!prev) return h.posicao <= 8 ? 'Início dentro do G8.' : 'Início fora do G8.'
  if (h.posicao === 1 && prev.posicao !== 1) return 'Assumiu a liderança da tabela.'
  if (prev.posicao === 1 && h.posicao !== 1) return 'Deixou a liderança.'
  if (prev.posicao > 8 && h.posicao <= 8) return 'Entrou na zona de classificação (G8).'
  if (prev.posicao <= 8 && h.posicao > 8) return 'Saiu do G8.'
  if (h.variacaoPosicao > 0) return `Subiu ${h.variacaoPosicao} posição${h.variacaoPosicao > 1 ? 'ões' : ''} na tabela.`
  if (h.variacaoPosicao < 0) return `Cedeu ${Math.abs(h.variacaoPosicao)} posição${Math.abs(h.variacaoPosicao) > 1 ? 'ões' : ''}.`
  return 'Manteve a posição.'
}

// ══════════════════════════════════════════════════════════════
//  FUNÇÃO PRINCIPAL
// ══════════════════════════════════════════════════════════════
export async function gerarPdfCampanha(hist) {
  const { jsPDF } = await import('jspdf')

  const sorted = [...hist].sort((a, b) => a.rodada - b.rodada)
  if (!sorted.length) throw new Error('Nenhuma rodada cadastrada.')

  const st = calcStats(sorted)
  const TOTAL_PAGES = 6
  const W = 210, H = 297 // A4

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ──────────────────────────────────────────────────────────────
  // PÁGINA 1 — CAPA / RESUMO EXECUTIVO
  // ──────────────────────────────────────────────────────────────
  {
    // Bloco verde topo — capa premium
    setFill(doc, C.verde)
    doc.rect(0, 0, W, 60, 'F')

    // Detalhe decorativo
    setFill(doc, C.verdeMed)
    doc.rect(0, 48, W, 12, 'F')

    // Escudo / ícone placeholder
    setFill(doc, [255, 255, 255, 0.1])
    doc.setFillColor(255, 255, 255)
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.08 }))
    doc.circle(W - 28, 28, 22, 'F')

    // Reset opacity
    try { doc.setGState(new doc.GState({ opacity: 1 })) } catch(e) {}

    // Título principal
    setFont(doc, 'bold', 20)
    setTextColor(doc, C.branco)
    doc.text('CONFIANÇA', 14, 20)

    setFont(doc, 'bold', 14)
    doc.text('Evolução na Tabela — Série C 2026', 14, 30)

    setFont(doc, 'normal', 9)
    setTextColor(doc, [200, 230, 210])
    doc.text('Relatório de evolução rodada a rodada, tendência competitiva e permanência no G8', 14, 38)

    // Badge data
    const now = new Date().toLocaleDateString('pt-BR')
    setFont(doc, 'bold', 8)
    setTextColor(doc, C.branco)
    doc.text(`Gerado em ${now}  ·  ${sorted.length} rodadas analisadas`, 14, 53)

    // Tendência badge
    const tendCor = { subindo: C.verde, estavel: C.laranja, caindo: C.vermelho }[st.tend]
    const tendTxt = { subindo: '↑ SUBINDO', estavel: '→ ESTÁVEL', caindo: '↓ CAINDO' }[st.tend]
    card(doc, W - 55, 43, 42, 12, { fill: tendCor.map(v => Math.min(255, v + 160)), stroke: tendCor })
    setFont(doc, 'bold', 8)
    setTextColor(doc, tendCor)
    doc.text(tendTxt, W - 34, 51, { align: 'center' })

    // ── Cards KPIs ──
    const startY = 68
    const cardW = (W - 28 - 8 * 3) / 4
    const cardH = 24
    const kpis = [
      { label: 'Posição atual',   value: `${st.posAtual}°`,       color: st.posAtual <= 8 ? C.verde : C.vermelho },
      { label: 'Melhor posição',  value: `${st.melhor}°`,         color: C.verde },
      { label: 'Pior posição',    value: `${st.pior}°`,           color: C.vermelho },
      { label: 'Pts acumulados',  value: String(st.ptsAcum),      color: C.verdeEsc },
      { label: 'Aprovat. geral',  value: fp(st.aprGeral),         color: st.aprGeral >= 60 ? C.verde : C.laranja },
      { label: 'Rodadas no G8',   value: String(st.g8),           color: C.verde },
      { label: 'Fora do G8',      value: String(st.foraG8),       color: st.foraG8 > 0 ? C.vermelho : C.cinza },
      { label: 'Maior subida',    value: st.maiorSubida > 0 ? `+${st.maiorSubida}` : '—', color: C.verde },
    ]

    kpis.forEach((k, i) => {
      const col = i % 4
      const row = Math.floor(i / 4)
      const kx = 14 + col * (cardW + 8)
      const ky = startY + row * (cardH + 8)
      kpiCard(doc, kx, ky, cardW, cardH, k.label, k.value, k.color)
    })

    // Segunda linha de kpis — dados gols e sequência
    const y2 = startY + (cardH + 8) * 2 + 4
    const kpis2 = [
      { label: 'Gols marcados',  value: String(st.totalGp),  color: C.verde },
      { label: 'Gols sofridos',  value: String(st.totalGc),  color: C.vermelho },
      { label: 'Saldo de gols',  value: `${st.totalGp - st.totalGc >= 0 ? '+' : ''}${st.totalGp - st.totalGc}`, color: C.verde },
      { label: 'Liderou tabela', value: st.rodadasLider ? `${st.rodadasLider}R` : 'Não', color: st.rodadasLider > 0 ? C.verde : C.cinza },
    ]
    kpis2.forEach((k, i) => {
      const kx = 14 + i * (cardW + 8)
      kpiCard(doc, kx, y2, cardW, cardH, k.label, k.value, k.color)
    })

    // ── Leitura geral ──
    const yLeit = y2 + cardH + 12
    sectionTitle(doc, 14, yLeit, 'Leitura Geral da Campanha')

    card(doc, 14, yLeit + 14, W - 28, 34, { fill: C.verdeCla, stroke: C.borda })
    setFont(doc, 'normal', 8.5)
    setTextColor(doc, C.verdeEsc)
    const resumoTexto = gerarTextoResumo(sorted, st)
    const linhas = doc.splitTextToSize(resumoTexto, W - 44)
    doc.text(linhas.slice(0, 4), 20, yLeit + 23)

    footer(doc, 1, TOTAL_PAGES)
  }

  // ──────────────────────────────────────────────────────────────
  // PÁGINA 2 — EVOLUÇÃO DA POSIÇÃO (GRÁFICO)
  // ──────────────────────────────────────────────────────────────
  doc.addPage()
  {
    header(doc, 'Evolução na Tabela', 'Posição rodada a rodada', 2)

    sectionTitle(doc, 14, 24, 'Evolução da Posição na Tabela')

    // Legenda
    const legendY = 28
    ;[['V', 'Vitória', C.verde], ['E', 'Empate', C.laranja], ['D', 'Derrota', C.vermelho]].forEach(([k, l, c], i) => {
      const lx = W - 80 + i * 28
      setFill(doc, c.map(v => Math.min(255, v + 160)))
      setStroke(doc, c)
      doc.setLineWidth(0.3)
      doc.circle(lx, legendY + 2, 3, 'FD')
      setFont(doc, 'bold', 6)
      setTextColor(doc, c)
      doc.text(k, lx, legendY + 4, { align: 'center' })
      setFont(doc, 'normal', 6.5)
      setTextColor(doc, C.cinzaEsc)
      doc.text(l, lx + 5, legendY + 4)
    })

    // Gráfico principal
    graficoLinha(doc, 14, 36, W - 28, 85, sorted)

    // Insight automático abaixo do gráfico
    const yIns = 128
    const ganhouPos = st.pior - st.posAtual
    let insightTxt = ''
    if (ganhouPos > 0) {
      insightTxt = `Entre a pior colocação (${st.pior}°) e a posição atual (${st.posAtual}°), o Confiança ganhou ${ganhouPos} posições na tabela.`
    } else if (ganhouPos < 0) {
      insightTxt = `O time perdeu ${Math.abs(ganhouPos)} posições em relação à sua melhor colocação (${st.melhor}°).`
    } else {
      insightTxt = `O Confiança mantém a posição em relação ao início do recorte analisado.`
    }
    insightTxt += ` A equipe permaneceu dentro do G8 em ${st.g8} de ${st.n} rodadas.`

    card(doc, 14, yIns, W - 28, 16, { fill: C.fundo, stroke: C.borda })
    setFont(doc, 'normal', 8)
    setTextColor(doc, C.verdeEsc)
    doc.text(`💡 ${insightTxt}`, 20, yIns + 9, { maxWidth: W - 40 })

    // ── Sequência de resultados visual ──
    const ySeq = yIns + 24
    sectionTitle(doc, 14, ySeq, 'Sequência de Resultados')

    sorted.forEach((h, i) => {
      const sx = 14 + i * 20
      const sy = ySeq + 14
      const cor = RES_COR[h.resultado] || C.cinza
      // Quadrado resultado
      setFill(doc, cor.map(v => Math.min(255, v + 170)))
      setStroke(doc, cor)
      doc.setLineWidth(0.4)
      doc.roundedRect(sx, sy, 14, 14, 2, 2, 'FD')
      setFont(doc, 'bold', 7)
      setTextColor(doc, cor)
      doc.text(h.resultado, sx + 7, sy + 8.5, { align: 'center' })
      setFont(doc, 'normal', 5.5)
      setTextColor(doc, C.cinza)
      doc.text(`R${h.rodada}`, sx + 7, sy + 14 + 4, { align: 'center' })
      doc.text(`${h.posicao}°`, sx + 7, sy + 14 + 8.5, { align: 'center' })
    })

    // Resumo de resultados
    const vt = sorted.filter(h => h.resultado === 'V').length
    const et = sorted.filter(h => h.resultado === 'E').length
    const dt = sorted.filter(h => h.resultado === 'D').length
    const yRes = ySeq + 46
    ;[
      { label: 'Vitórias', value: vt, color: C.verde },
      { label: 'Empates',  value: et, color: C.laranja },
      { label: 'Derrotas', value: dt, color: C.vermelho },
    ].forEach((item, i) => {
      const rx = 14 + i * 62
      card(doc, rx, yRes, 56, 20, { fill: item.color.map(v => Math.min(255, v + 180)), stroke: item.color })
      setFont(doc, 'bold', 18)
      setTextColor(doc, item.color)
      doc.text(String(item.value), rx + 14, yRes + 15)
      setFont(doc, 'normal', 7)
      setTextColor(doc, item.color)
      doc.text(item.label, rx + 14, yRes + 7)
    })

    footer(doc, 2, TOTAL_PAGES)
  }

  // ──────────────────────────────────────────────────────────────
  // PÁGINA 3 — RODADA A RODADA (TABELA DETALHADA)
  // ──────────────────────────────────────────────────────────────
  doc.addPage()
  {
    header(doc, 'Rodada a Rodada', 'Histórico completo de partidas', 3)
    sectionTitle(doc, 14, 24, 'Histórico de Partidas')

    // Cabeçalho da tabela
    const cols = [
      { label: 'R',         w: 10, align: 'center' },
      { label: 'Data',      w: 22, align: 'left' },
      { label: 'Adversário',w: 38, align: 'left' },
      { label: 'Mando',     w: 18, align: 'center' },
      { label: 'Placar',    w: 16, align: 'center' },
      { label: 'Res',       w: 12, align: 'center' },
      { label: 'Pts',       w: 10, align: 'center' },
      { label: 'Acum',      w: 12, align: 'center' },
      { label: 'Pos',       w: 10, align: 'center' },
      { label: 'Var',       w: 12, align: 'center' },
    ]
    const tableX = 14
    let tx = tableX
    const thY = 36

    setFill(doc, C.verde)
    doc.rect(tableX, thY, W - 28, 8, 'F')
    cols.forEach(col => {
      setFont(doc, 'bold', 7)
      setTextColor(doc, C.branco)
      const ax = col.align === 'center' ? tx + col.w / 2 : tx + 2
      doc.text(col.label, ax, thY + 5.5, { align: col.align === 'center' ? 'center' : 'left' })
      tx += col.w
    })

    // Linhas da tabela
    let rowY = thY + 8
    sorted.forEach((h, i) => {
      const isLast = i === sorted.length - 1
      const cor = RES_COR[h.resultado] || C.cinza
      const bg = isLast ? C.verdeCla : i % 2 === 0 ? C.branco : C.linha

      setFill(doc, bg)
      doc.rect(tableX, rowY, W - 28, 9, 'F')

      // Borda lateral esquerda colorida para última rodada
      if (isLast) {
        setFill(doc, C.verde)
        doc.rect(tableX, rowY, 2, 9, 'F')
      }

      tx = tableX
      const cellData = [
        { v: `R${h.rodada}`,                  align: 'center', bold: true,  color: C.verdeEsc },
        { v: h.data || '—',                   align: 'left',   bold: false, color: C.cinzaEsc },
        { v: h.adversario || '—',             align: 'left',   bold: true,  color: C.verdeEsc },
        { v: h.mando === 'casa' ? 'Casa' : 'Fora', align: 'center', bold: false, color: h.mando === 'casa' ? C.verde : C.cinzaEsc },
        { v: `${h.golsPro}x${h.golsContra}`,  align: 'center', bold: true,  color: cor },
        { v: null, isRes: true, res: h.resultado },
        { v: String(h.pontosRodada || 0),     align: 'center', bold: true,  color: h.pontosRodada === 3 ? C.verde : h.pontosRodada === 1 ? C.laranja : C.vermelho },
        { v: String(h.pontosAcumulados || 0), align: 'center', bold: true,  color: C.verdeEsc },
        { v: `${h.posicao}°`,                 align: 'center', bold: true,  color: h.posicao <= 8 ? C.verde : C.verdeEsc },
        { v: h.variacaoPosicao > 0 ? `↑+${h.variacaoPosicao}` : h.variacaoPosicao < 0 ? `↓${h.variacaoPosicao}` : '—',
          align: 'center', bold: true, color: h.variacaoPosicao > 0 ? C.verde : h.variacaoPosicao < 0 ? C.vermelho : C.cinza },
      ]

      cols.forEach((col, ci) => {
        const cell = cellData[ci]
        const ax = col.align === 'center' ? tx + col.w / 2 : tx + 2
        if (cell.isRes) {
          const resCor = RES_COR[cell.res] || C.cinza
          setFill(doc, resCor.map(v => Math.min(255, v + 170)))
          setStroke(doc, resCor)
          doc.setLineWidth(0.3)
          doc.roundedRect(tx + 2, rowY + 1.5, 8, 6, 1.5, 1.5, 'FD')
          setFont(doc, 'bold', 6.5)
          setTextColor(doc, resCor)
          doc.text(cell.res, tx + 6, rowY + 6, { align: 'center' })
        } else {
          setFont(doc, cell.bold ? 'bold' : 'normal', 7.5)
          setTextColor(doc, cell.color)
          doc.text(String(cell.v), ax, rowY + 6, { align: col.align === 'center' ? 'center' : 'left', maxWidth: col.w - 2 })
        }
        tx += col.w
      })

      // Status narrativo mini
      const statusTxt = statusNarrativo(h, i, sorted)
      if (statusTxt && statusTxt !== 'Manteve a posição.') {
        setFont(doc, 'italic', 5.5)
        setTextColor(doc, C.cinza)
        // doc.text(statusTxt, tableX + 50, rowY + 8.5, { maxWidth: 100 })
      }

      rowY += 9
    })

    // Linha do tempo narrativa
    const yLine = rowY + 8
    sectionTitle(doc, 14, yLine, 'Linha do Tempo Narrativa')

    let ltY = yLine + 15
    sorted.forEach((h, i) => {
      const status = statusNarrativo(h, i, sorted)
      if (status === 'Manteve a posição.') return // skip trivial
      const cor = status.includes('Liderança') || status.includes('G8') ? C.verde :
                  status.includes('Deixou') || status.includes('Saiu') || status.includes('Cedeu') ? C.vermelho : C.laranja
      setFill(doc, cor)
      doc.circle(20, ltY - 1, 1.5, 'F')
      setFont(doc, 'bold', 7.5)
      setTextColor(doc, cor)
      doc.text(`R${h.rodada}:`, 24, ltY)
      setFont(doc, 'normal', 7.5)
      setTextColor(doc, C.verdeEsc)
      doc.text(status, 34, ltY)
      ltY += 8
    })

    footer(doc, 3, TOTAL_PAGES)
  }

  // ──────────────────────────────────────────────────────────────
  // PÁGINA 4 — MOMENTO RECENTE E TENDÊNCIA
  // ──────────────────────────────────────────────────────────────
  doc.addPage()
  {
    header(doc, 'Momento Recente', `Últimas ${st.last5.n} rodadas`, 4)

    sectionTitle(doc, 14, 24, `Análise das Últimas ${st.last5.n} Rodadas`)

    const r5 = st.last5
    const cardW2 = (W - 28 - 8 * 4) / 5
    const yKpi = 36

    const kpisR = [
      { label: 'Jogos',       value: String(r5.n),    color: C.cinzaEsc },
      { label: 'Vitórias',    value: String(r5.v),    color: C.verde },
      { label: 'Empates',     value: String(r5.e),    color: C.laranja },
      { label: 'Derrotas',    value: String(r5.d),    color: C.vermelho },
      { label: 'Pontos',      value: String(r5.pts),  color: C.verdeEsc },
      { label: 'Aprovat.',    value: fp(r5.apr),      color: r5.apr >= 60 ? C.verde : C.laranja },
      { label: 'Gols pró',    value: String(r5.gp),   color: C.verde },
      { label: 'Gols contra', value: String(r5.gc),   color: C.vermelho },
      { label: 'Saldo',       value: `${r5.gp - r5.gc >= 0 ? '+' : ''}${r5.gp - r5.gc}`, color: C.verde },
      { label: 'Var. posição',value: r5.varPos >= 0 ? `+${r5.varPos}` : String(r5.varPos), color: r5.varPos >= 0 ? C.verde : C.vermelho },
    ]
    kpisR.forEach((k, i) => {
      const col = i % 5
      const row = Math.floor(i / 5)
      const kx = 14 + col * (cardW2 + 8)
      const ky = yKpi + row * 32
      kpiCard(doc, kx, ky, cardW2, 26, k.label, k.value, k.color, true)
    })

    // Texto automático do momento
    const yTxt = yKpi + 64
    card(doc, 14, yTxt, W - 28, 28, { fill: C.verdeCla, stroke: C.borda })
    const tendLabel = st.tend === 'subindo' ? 'crescimento' : st.tend === 'caindo' ? 'queda' : 'estabilidade'
    let momTxt = `Nas últimas ${r5.n} rodadas, o Confiança somou ${r5.pts} pontos, com ${r5.v} vitória${r5.v !== 1 ? 's' : ''}, ${r5.e} empate${r5.e !== 1 ? 's' : ''} e ${r5.d} derrota${r5.d !== 1 ? 's' : ''}. `
    momTxt += `O aproveitamento no período foi de ${f1(r5.apr)}%. `
    momTxt += `A variação de posição no recorte foi de ${r5.varPos >= 0 ? '+' : ''}${r5.varPos} posição${Math.abs(r5.varPos) !== 1 ? 'ões' : ''}, indicando tendência de ${tendLabel}.`
    setFont(doc, 'normal', 8.5)
    setTextColor(doc, C.verdeEsc)
    const momLinhas = doc.splitTextToSize(momTxt, W - 44)
    doc.text(momLinhas.slice(0, 3), 20, yTxt + 10)

    // Gráfico mini — aproveitamento acumulado
    const yGraf = yTxt + 36
    sectionTitle(doc, 14, yGraf, 'Aproveitamento Acumulado por Rodada')

    const chartX = 14, chartY = yGraf + 12, chartW = W - 28, chartH2 = 55
    const mg = { t: 5, r: 10, b: 16, l: 22 }
    const cx2 = chartX + mg.l, cy2 = chartY + mg.t
    const cw2 = chartW - mg.l - mg.r, ch2 = chartH2 - mg.t - mg.b

    // fundo
    setFill(doc, C.branco)
    doc.rect(cx2, cy2, cw2, ch2, 'F')

    // linha referência 55.6%
    const y556 = cy2 + (1 - 0.556) * ch2
    doc.setLineDashPattern([2, 1.5], 0)
    setStroke(doc, C.laranja)
    doc.setLineWidth(0.4)
    doc.line(cx2, y556, cx2 + cw2, y556)
    doc.setLineDashPattern([], 0)
    setFont(doc, 'normal', 5.5)
    setTextColor(doc, C.laranja)
    doc.text('55.6% ref.', cx2 + cw2 + 1, y556 + 2)

    // eixo Y %
    setFont(doc, 'normal', 5.5)
    setTextColor(doc, C.cinza)
    ;[0, 33, 67, 100].forEach(v => {
      const yy = cy2 + (1 - v / 100) * ch2
      doc.text(`${v}%`, cx2 - 2, yy + 2, { align: 'right' })
      setStroke(doc, C.linha)
      doc.setLineWidth(0.15)
      doc.line(cx2, yy, cx2 + cw2, yy)
    })

    // barras de aproveitamento
    const barW = (cw2 / sorted.length) * 0.6
    const barGap = cw2 / sorted.length
    sorted.forEach((h, i) => {
      const apr = h.aproveitamentoAcumulado || 0
      const bx = cx2 + i * barGap + barGap * 0.2
      const bh = (apr / 100) * ch2
      const by = cy2 + ch2 - bh
      const cor = apr >= 67 ? C.verde : apr >= 40 ? C.laranja : C.vermelho
      setFill(doc, cor.map(v => Math.min(255, v + 140)))
      doc.roundedRect(bx, by, barW, bh, 1, 1, 'F')
      setFont(doc, 'normal', 5.5)
      setTextColor(doc, C.cinza)
      doc.text(`R${h.rodada}`, bx + barW / 2, cy2 + ch2 + 5, { align: 'center' })
    })

    footer(doc, 4, TOTAL_PAGES)
  }

  // ──────────────────────────────────────────────────────────────
  // PÁGINA 5 — CASA × FORA E GOLS
  // ──────────────────────────────────────────────────────────────
  doc.addPage()
  {
    header(doc, 'Casa × Fora e Gols', 'Análise comparativa de mando de campo', 5)

    sectionTitle(doc, 14, 24, 'Campanha por Mando de Campo')

    const yC = 36
    const halfW = (W - 28 - 8) / 2

    ;[
      { label: '🏠 Em Casa', st: st.casa, x: 14 },
      { label: '✈ Fora',     st: st.fora, x: 14 + halfW + 8 },
    ].forEach(({ label, st: ms, x }) => {
      if (!ms) return
      card(doc, x, yC, halfW, 68)

      // Header do card
      setFill(doc, C.verde)
      doc.roundedRect(x, yC, halfW, 12, 4, 4, 'F')
      doc.rect(x, yC + 6, halfW, 6, 'F')
      setFont(doc, 'bold', 9)
      setTextColor(doc, C.branco)
      doc.text(label, x + halfW / 2, yC + 8, { align: 'center' })

      const rows = [
        ['Jogos',          String(ms.j)],
        ['Vitórias',       String(ms.v)],
        ['Empates',        String(ms.e)],
        ['Derrotas',       String(ms.d)],
        ['Pontos',         String(ms.pts)],
        ['Aproveitamento', fp(ms.apr)],
        ['Gols marcados',  String(ms.gp)],
        ['Gols sofridos',  String(ms.gc)],
        ['Saldo',          `${ms.gp - ms.gc >= 0 ? '+' : ''}${ms.gp - ms.gc}`],
        ['Média gols pró', ms.j ? f1(ms.gp / ms.j) : '—'],
      ]

      rows.forEach(([k, v], ri) => {
        const ry = yC + 14 + ri * 5.3
        setFont(doc, 'normal', 7)
        setTextColor(doc, C.cinzaEsc)
        doc.text(k, x + 6, ry)
        setFont(doc, 'bold', 7)
        setTextColor(doc, C.verdeEsc)
        doc.text(v, x + halfW - 6, ry, { align: 'right' })
      })

      // Aproveitamento bar
      const barY = yC + 61
      const barTotal = halfW - 12
      const barFill = (ms.apr / 100) * barTotal
      setFill(doc, C.linha)
      doc.roundedRect(x + 6, barY, barTotal, 3.5, 1, 1, 'F')
      const aprCor = ms.apr >= 60 ? C.verde : ms.apr >= 40 ? C.laranja : C.vermelho
      setFill(doc, aprCor)
      doc.roundedRect(x + 6, barY, Math.max(1, barFill), 3.5, 1, 1, 'F')
    })

    // ── Gols da campanha ──
    const yGols = yC + 80
    sectionTitle(doc, 14, yGols, 'Gols da Campanha')

    const saldo = st.totalGp - st.totalGc
    const kpisGols = [
      { label: 'Gols marcados',    value: String(st.totalGp),  color: C.verde },
      { label: 'Gols sofridos',    value: String(st.totalGc),  color: C.vermelho },
      { label: 'Saldo',            value: `${saldo >= 0 ? '+' : ''}${saldo}`, color: saldo >= 0 ? C.verde : C.vermelho },
      { label: 'Média pró/jogo',   value: st.n ? f1(st.totalGp / st.n) : '—', color: C.verde },
      { label: 'Média contra/jogo',value: st.n ? f1(st.totalGc / st.n) : '—', color: C.vermelho },
      { label: 'Clean sheets',     value: String(st.cleanSheets), color: C.verde },
    ]
    const gCardW = (W - 28 - 8 * 5) / 6
    kpisGols.forEach((k, i) => {
      kpiCard(doc, 14 + i * (gCardW + 8), yGols + 12, gCardW, 26, k.label, k.value, k.color, true)
    })

    // Maior vitória e maior impacto
    const yDest = yGols + 48
    sectionTitle(doc, 14, yDest, 'Destaques')

    ;[
      {
        title: 'Maior Vitória',
        desc: st.maiorVit ? `${st.maiorVit.golsPro}x${st.maiorVit.golsContra} vs ${st.maiorVit.adversario} (R${st.maiorVit.rodada})` : '—',
        color: C.verde,
      },
      {
        title: 'Maior Impacto Positivo',
        desc: st.maiorImpacto && st.maiorImpacto.variacaoPosicao > 0 ? `+${st.maiorImpacto.variacaoPosicao} posições vs ${st.maiorImpacto.adversario} (R${st.maiorImpacto.rodada})` : '—',
        color: C.verdeMed,
      },
    ].forEach((d, i) => {
      const dx = 14 + i * ((W - 28) / 2 + 4)
      card(doc, dx, yDest + 12, (W - 36) / 2, 20, { fill: d.color.map(v => Math.min(255, v + 175)), stroke: d.color })
      setFont(doc, 'bold', 7.5)
      setTextColor(doc, d.color)
      doc.text(d.title, dx + 6, yDest + 20)
      setFont(doc, 'normal', 9)
      setTextColor(doc, C.verdeEsc)
      doc.text(d.desc, dx + 6, yDest + 28)
    })

    footer(doc, 5, TOTAL_PAGES)
  }

  // ──────────────────────────────────────────────────────────────
  // PÁGINA 6 — CONCLUSÃO PARA COMISSÃO
  // ──────────────────────────────────────────────────────────────
  doc.addPage()
  {
    header(doc, 'Conclusão', 'Leitura final para comissão técnica', 6)

    sectionTitle(doc, 14, 24, 'Conclusão da Campanha')

    // Texto conclusão
    const yConc = 36
    card(doc, 14, yConc, W - 28, 46, { fill: C.fundo, stroke: C.borda })
    setFont(doc, 'normal', 8.5)
    setTextColor(doc, C.verdeEsc)
    const concTexto = gerarTextoConclusao(sorted, st)
    const concLinhas = doc.splitTextToSize(concTexto, W - 44)
    doc.text(concLinhas.slice(0, 6), 20, yConc + 10)

    // Pontos positivos
    const yPos = yConc + 54
    sectionTitle(doc, 14, yPos, 'Pontos Positivos')

    const positivos = []
    if (st.posAtual <= 8) positivos.push(`Posição dentro do G8 (${st.posAtual}°), dentro do objetivo da competição.`)
    if (st.g8 >= st.n * 0.7) positivos.push(`Estabilidade: permaneceu no G8 em ${st.g8} de ${st.n} rodadas (${f1((st.g8/st.n)*100)}%).`)
    if (st.rodadasLider > 0) positivos.push(`Chegou à liderança em ${st.rodadasLider} rodada${st.rodadasLider > 1 ? 's' : ''} — time que luta pelo topo.`)
    if (st.cleanSheets > 2) positivos.push(`Solidez defensiva: ${st.cleanSheets} jogos sem sofrer gol.`)
    if (st.totalGp / st.n > 1.5) positivos.push(`Poder ofensivo: média de ${f1(st.totalGp / st.n)} gols por jogo.`)
    if (!positivos.length) positivos.push('Campanha em desenvolvimento — dados insuficientes para análise completa.')

    positivos.slice(0, 4).forEach((p, i) => {
      const py2 = yPos + 12 + i * 9
      setFill(doc, C.verde)
      doc.circle(18, py2 - 1, 2, 'F')
      setFont(doc, 'normal', 8)
      setTextColor(doc, C.verdeEsc)
      doc.text(p, 23, py2, { maxWidth: W - 40 })
    })

    // Pontos de atenção
    const yAtenc = yPos + 12 + Math.min(4, positivos.length) * 9 + 8
    sectionTitle(doc, 14, yAtenc, 'Pontos de Atenção')

    const atencoes = []
    if (st.tend === 'caindo') atencoes.push('Tendência de queda recente — requer resposta imediata no próximo jogo.')
    if (st.fora && st.fora.apr < 40) atencoes.push(`Rendimento fora de casa abaixo de 40% (${f1(st.fora.apr)}%) — vulnerabilidade como visitante.`)
    if (st.cleanSheets < 2) atencoes.push('Poucos jogos sem sofrer gol — atenção à solidez defensiva.')
    if (st.foraG8 > 0) atencoes.push(`O time ficou fora do G8 em ${st.foraG8} rodada${st.foraG8 > 1 ? 's' : ''} — oscilação que pode ser reduzida.`)
    if (!atencoes.length) atencoes.push('Campanha sem pontos críticos identificados no momento.')

    atencoes.slice(0, 3).forEach((a, i) => {
      const ay = yAtenc + 12 + i * 9
      setFill(doc, C.laranja)
      doc.circle(18, ay - 1, 2, 'F')
      setFont(doc, 'normal', 8)
      setTextColor(doc, [100, 60, 0])
      doc.text(a, 23, ay, { maxWidth: W - 40 })
    })

    // Objetivo imediato — destaque final
    const yObj = H - 55
    setFill(doc, C.verde)
    doc.roundedRect(14, yObj, W - 28, 34, 5, 5, 'F')

    setFont(doc, 'bold', 9)
    setTextColor(doc, [200, 230, 210])
    doc.text('OBJETIVO IMEDIATO', 22, yObj + 10)

    setFont(doc, 'bold', 12)
    setTextColor(doc, C.branco)
    const objTxt = gerarObjetivoImediato(st)
    const objLinhas = doc.splitTextToSize(objTxt, W - 56)
    doc.text(objLinhas, 22, yObj + 20)

    // Assinatura CIC
    setFont(doc, 'bold', 8)
    setTextColor(doc, C.cinza)
    doc.text('CIC — Central de Inteligência do Confiança', W / 2, H - 14, { align: 'center' })
    setFont(doc, 'normal', 7)
    doc.text(`Série C 2026  ·  Gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, H - 9, { align: 'center' })

    footer(doc, 6, TOTAL_PAGES)
  }

  // ── Download ─────────────────────────────────────────────────
  doc.save('evolucao_confianca_tabela_serie_c_2026.pdf')
}
