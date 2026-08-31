const BLUE = [10, 102, 183]
const NAVY = [6, 23, 46]
const LIGHT = [239, 246, 252]
const LIGHTER = [247, 250, 252]
const TEXT = [71, 85, 105]
const GREEN = [22, 163, 74]
const RED = [220, 38, 38]
const AMBER = [217, 119, 6]
const BORDER = [226, 232, 240]

function safe(v, fallback='—') { return v == null || v === '' ? fallback : String(v) }
function pct(v) { return Number.isFinite(Number(v)) ? `${Number(v).toFixed(1).replace('.', ',')}%` : '—' }
function clean(value='') { return String(value || '').trim() }

async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function logoData() {
  try {
    const res = await fetch('/confianca.png')
    const blob = await res.blob()
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

async function coachPhotoData(photoUrl) {
  if (!clean(photoUrl)) return null
  try {
    const res = await fetch(`/api/treinadores/foto?url=${encodeURIComponent(photoUrl)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

export async function exportCoachReportPdf(coach) {
  const [{ jsPDF }, atMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = atMod.autoTable ?? atMod.default
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true })

  const W = 210
  const H = 297
  const M = 14
  const pageBottom = H - 18

  const report = coach.relatorio_json || {}
  const objective = report.aderencia_objetivo || {}
  const wyscout = report.wyscout_analise || null
  const metrics = coach.metricas_json || {}
  const career = coach.carreira_json || []
  const games = coach.jogos_json || []
  const [logo, coachPhoto] = await Promise.all([logoData(), coachPhotoData(coach.foto_url)])

  let y = 16

  const recommendation = report.recomendacao || coach.recomendacao || 'Em análise'
  const recColor = recommendation === 'Recomendado' ? GREEN : recommendation === 'Não Recomendado' ? RED : recommendation === 'Com Ressalvas' ? AMBER : BLUE

  const newPage = () => {
    doc.addPage()
    header('RELATÓRIO DE SCOUTING DE TREINADOR')
  }
  const ensure = (need = 22) => { if (y + need > pageBottom) newPage() }

  const header = (title='RELATÓRIO DE SCOUTING DE TREINADOR') => {
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 24, 'F')
    if (logo) {
      try { doc.addImage(logo, 'PNG', M, 4, 16, 16) } catch {}
    }
    doc.setTextColor(255,255,255)
    doc.setFont('helvetica','bold')
    doc.setFontSize(11)
    doc.text('ASSOCIAÇÃO DESPORTIVA CONFIANÇA', M + 20, 10)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.5)
    doc.text('Centro de Inteligência · Scouting & Recrutamento', M + 20, 15)
    doc.setFont('helvetica','bold')
    doc.setFontSize(7)
    doc.text(title, W - M, 11, { align:'right' })
    y = 31
  }

  const footer = () => {
    const pages = doc.internal.getNumberOfPages()
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p)
      doc.setDrawColor(...BORDER)
      doc.line(M, H - 12, W - M, H - 12)
      doc.setFontSize(6.8)
      doc.setTextColor(...TEXT)
      doc.setFont('helvetica','normal')
      doc.text('Documento confidencial · Uso interno · Centro de Inteligência do Confiança', M, H - 7)
      doc.text(`Página ${p}/${pages}`, W - M, H - 7, { align:'right' })
    }
  }

  const section = (title, subtitle='') => {
    ensure(16)
    doc.setDrawColor(...BLUE)
    doc.setLineWidth(0.8)
    doc.line(M, y, M + 22, y)
    y += 4
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica','bold')
    doc.setFontSize(12)
    doc.text(title, M, y)
    if (subtitle) {
      doc.setFont('helvetica','normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...TEXT)
      doc.text(subtitle, W - M, y, { align:'right' })
    }
    y += 5
  }

  const paragraph = (text, color = NAVY, fontSize = 8.3) => {
    const value = clean(text)
    if (!value) return
    doc.setTextColor(...color)
    doc.setFont('helvetica','normal')
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(value, W - (M * 2))
    ensure(lines.length * 4 + 4)
    doc.text(lines, M, y)
    y += lines.length * 4 + 3
  }

  const infoBadge = (x, top, label, value, width) => {
    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, top, width, 10, 2, 2, 'F')
    doc.setFont('helvetica','bold')
    doc.setFontSize(6.7)
    doc.setTextColor(...BLUE)
    doc.text(label.toUpperCase(), x + 3, top + 4)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.2)
    doc.setTextColor(...NAVY)
    doc.text(safe(value), x + 3, top + 7.5)
  }

  const statCard = (x, top, width, height, label, value, sub='') => {
    doc.setDrawColor(...BORDER)
    doc.setFillColor(255,255,255)
    doc.roundedRect(x, top, width, height, 3, 3, 'FD')
    doc.setFont('helvetica','bold')
    doc.setFontSize(6.6)
    doc.setTextColor(...TEXT)
    doc.text(String(label).toUpperCase(), x + 4, top + 5)
    doc.setFont('helvetica','bold')
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text(String(value), x + 4, top + 12)
    if (sub) {
      doc.setFont('helvetica','normal')
      doc.setFontSize(6.3)
      doc.setTextColor(...TEXT)
      doc.text(String(sub), x + 4, top + 16.5)
    }
  }

  const kvTable = (rows) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: 'plain',
      body: rows.map(([a, b]) => [a, safe(b)]),
      styles: {
        fontSize: 8,
        cellPadding: 2.8,
        textColor: NAVY,
        lineColor: BORDER,
        lineWidth: 0.15,
        valign: 'middle'
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: LIGHT, cellWidth: 50, textColor: NAVY },
        1: { fillColor: [255, 255, 255], textColor: TEXT }
      },
      alternateRowStyles: { fillColor: LIGHTER }
    })
    y = doc.lastAutoTable.finalY + 6
  }

  const dataTable = (head, body, opts = {}) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [head],
      body,
      theme: 'grid',
      styles: {
        fontSize: opts.fontSize || 7,
        cellPadding: 2.1,
        textColor: NAVY,
        lineColor: BORDER,
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: {
        fillColor: opts.headFillColor || NAVY,
        textColor: [255,255,255],
        fontStyle: 'bold',
        fontSize: opts.headFontSize || 7.3
      },
      bodyStyles: {
        fillColor: [255,255,255]
      },
      alternateRowStyles: { fillColor: LIGHTER },
      ...opts
    })
    y = doc.lastAutoTable.finalY + 6
  }

  header()

  const heroTop = y
  const heroHeight = 36
  const photoSize = 26
  const photoX = W - M - photoSize
  const heroTextWidth = W - (M * 2) - photoSize - 6

  doc.setDrawColor(...BORDER)
  doc.setFillColor(255,255,255)
  doc.roundedRect(M, heroTop, W - (M * 2), heroHeight, 4, 4, 'FD')

  doc.setFont('helvetica','bold')
  doc.setFontSize(22)
  doc.setTextColor(...NAVY)
  const nameLines = doc.splitTextToSize(safe(coach.nome, 'TREINADOR').toUpperCase(), heroTextWidth)
  doc.text(nameLines.slice(0, 2), M + 4, heroTop + 10)

  doc.setFont('helvetica','normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  doc.text(`${safe(coach.clube_atual, 'Sem clube')} · ${safe(coach.cargo_atual, 'Treinador')} · ${safe(coach.nacionalidade)}`, M + 4, heroTop + 18)

  infoBadge(M + 4, heroTop + 22, 'Licença', coach.licenca || 'Não informada', 44)
  infoBadge(M + 50, heroTop + 22, 'Formação base', coach.formacao_preferida || '—', 30)
  infoBadge(M + 82, heroTop + 22, 'Recomendação', recommendation, 36)
  infoBadge(M + 120, heroTop + 22, 'Data', report.data_relatorio || new Date().toLocaleDateString('pt-BR'), 30)

  if (coachPhoto) {
    try {
      doc.setDrawColor(...BORDER)
      doc.roundedRect(photoX, heroTop + 5, photoSize, photoSize, 4, 4, 'S')
      doc.addImage(coachPhoto, 'JPEG', photoX, heroTop + 5, photoSize, photoSize)
    } catch {
      doc.setFillColor(...LIGHT)
      doc.roundedRect(photoX, heroTop + 5, photoSize, photoSize, 4, 4, 'F')
      doc.setFont('helvetica','bold')
      doc.setFontSize(16)
      doc.setTextColor(...BLUE)
      doc.text((coach.nome || 'T').charAt(0).toUpperCase(), photoX + photoSize / 2, heroTop + 21, { align:'center' })
    }
  } else {
    doc.setFillColor(...LIGHT)
    doc.roundedRect(photoX, heroTop + 5, photoSize, photoSize, 4, 4, 'F')
    doc.setFont('helvetica','bold')
    doc.setFontSize(16)
    doc.setTextColor(...BLUE)
    doc.text((coach.nome || 'T').charAt(0).toUpperCase(), photoX + photoSize / 2, heroTop + 21, { align:'center' })
  }

  y = heroTop + heroHeight + 7

  const kpis = [
    ['Jogos carreira', metrics.jogos_carreira || metrics.jogos_detalhados || 0, 'Base Transfermarkt'],
    ['PPJ carreira', Number(metrics.ppj_carreira || metrics.ppj_detalhado || 0).toFixed(2).replace('.', ','), 'Pontos por jogo'],
    ['Aproveitamento', pct(metrics.aproveitamento), `${metrics.vitorias || 0}V · ${metrics.empates || 0}E · ${metrics.derrotas || 0}D`],
    ['Gols', `${metrics.gols_pro || 0}:${metrics.gols_contra || 0}`, 'Pró x Contra'],
    ['Fit Série C', Number(objective.nota || 0) > 0 ? `${objective.nota}/100` : '—', objective.nivel || 'Em análise'],
    ['Idade', coach.idade ? `${coach.idade}` : '—', coach.data_nascimento || '—']
  ]
  const gap = 2
  const sw = (W - (M * 2) - (gap * 5)) / 6
  kpis.forEach(([label, value, sub], i) => statCard(M + (i * (sw + gap)), y, sw, 20, label, value, sub))
  y += 27

  section('IDENTIFICAÇÃO DO RELATÓRIO', 'Dados administrativos e de referência')
  kvTable([
    ['Scouting/Dados', report.analista || 'Adryan Almeida'],
    ['Coordenação de Mercado', clean(report.coordenador) || 'Anthony Emanoel'],
    ['Data do Relatório', report.data_relatorio || new Date().toLocaleDateString('pt-BR')],
    ['Clube Solicitante', report.clube_solicitante || 'Associação Desportiva Confiança — Aracaju / SE'],
    ['Cargo Avaliado', report.cargo_avaliado || 'Treinador Principal'],
    ['Formação preferida', coach.formacao_preferida || '—'],
    ['Fonte base', coach.transfermarkt_url ? 'Transfermarkt + observação interna' : 'Base interna']
  ])

  if (Number(objective.nota || 0) > 0 || (objective.acessos_confirmados || []).length) {
    section('ADERÊNCIA AO OBJETIVO INSTITUCIONAL', 'Prioridade: retorno do Confiança à Série C')
    dataTable(['Nota','Nível','Objetivo'], [[`${objective.nota || 0}/100`, objective.nivel || 'Em análise', objective.objetivo || 'Retorno à Série C']], { fontSize:7.4, headFillColor:BLUE })
    if ((objective.acessos_confirmados || []).length) {
      dataTable(['Clube','Temporada','Movimento','Conquista / evidência'], (objective.acessos_confirmados || []).map(x=>[
        x.clube, x.temporada, `${x.origem || '—'} → ${x.destino || '—'}`, [x.conquista,x.evidencia].filter(Boolean).join(' · ')
      ]), { fontSize:6.6, headFillColor:GREEN })
    }
    if (objective.experiencia_serie_d) paragraph(objective.experiencia_serie_d, NAVY, 8)
  }

  section('RESUMO EXECUTIVO', 'Síntese para abertura do relatório')
  paragraph(report.resumo_executivo || coach.estilo_jogo || 'Análise executiva pendente de preenchimento pelo departamento de scouting.', NAVY, 8.6)

  const watchedIds = new Set((report.jogos_analisados || []).map(x => Number(x.id)))
  const watched = games.filter(g => watchedIds.has(Number(g.id)))
  if (watched.length) {
    section('1. JOGOS ANALISADOS', 'Partidas assistidas e marcadas para leitura qualitativa')
    dataTable(
      ['Data','Partida','Competição','Tática','Fonte'],
      watched.map(g => [
        g.data,
        `${g.mandante} ${g.placar} ${g.visitante}`,
        g.competicao,
        g.tatica || '—',
        (report.jogos_analisados || []).find(x => Number(x.id) === Number(g.id))?.fonte || 'Wyscout'
      ]),
      { fontSize: 6.8 }
    )
  }

  if (wyscout?.resumo) {
    section('ANÁLISE QUANTITATIVA · WYSCOUT TEAM STATS', `${wyscout.resumo.games || 0} jogos importados`)
    dataTable(['Jogos','V-E-D','xG/xGA','Posse','PPDA','Entradas área','Remates'], [[
      wyscout.resumo.games || 0,
      `${wyscout.resumo.wins || 0}-${wyscout.resumo.draws || 0}-${wyscout.resumo.losses || 0}`,
      `${Number(wyscout.resumo.xg || 0).toFixed(2).replace('.',',')} / ${Number(wyscout.resumo.xga || 0).toFixed(2).replace('.',',')}`,
      `${Number(wyscout.resumo.possession || 0).toFixed(1).replace('.',',')}%`,
      Number(wyscout.resumo.ppda || 0).toFixed(2).replace('.',','),
      Number(wyscout.resumo.boxEntries || 0).toFixed(1).replace('.',','),
      `${Number(wyscout.resumo.shots || 0).toFixed(1).replace('.',',')} (${Number(wyscout.resumo.shotsOnTarget || 0).toFixed(1).replace('.',',')} alvo)`
    ]], { fontSize:6.8, headFillColor:BLUE })
    if (wyscout.ai?.sintese) paragraph(wyscout.ai.sintese, NAVY, 8.1)
    ;(wyscout.insights || []).slice(0,6).forEach((insight,i)=>{
      ensure(8); doc.setFont('helvetica','bold'); doc.setFontSize(7.8); doc.setTextColor(...BLUE); doc.text(`${i+1}.`,M,y); doc.setFont('helvetica','normal'); doc.setTextColor(...NAVY); const lines=doc.splitTextToSize(String(insight),W-(M*2)-6); doc.text(lines,M+5,y); y+=Math.max(4,lines.length*3.6)+1
    })
    const wsGames=(wyscout.jogos || []).filter(x=>x.game_id).slice(0,12)
    if (wsGames.length) {
      dataTable(['Data','Jogo','Sistema','xG','Posse','PPDA'], wsGames.map(g=>[
        g.data,g.jogo,g.sistema || '—',`${Number(g.metricas?.xg || 0).toFixed(2).replace('.',',')} / ${Number(g.adversario_metricas?.xg || 0).toFixed(2).replace('.',',')}`,
        `${Number(g.metricas?.possession || 0).toFixed(1).replace('.',',')}%`,Number(g.metricas?.ppda || 0).toFixed(2).replace('.',',')
      ]), { fontSize:6.3, headFillColor:NAVY })
    }
  }

  section('2. PERFIL DO TREINADOR', 'Dados públicos consolidados')
  kvTable([
    ['Nome completo', coach.nome],
    ['Nacionalidade', coach.nacionalidade],
    ['Nascimento', coach.data_nascimento],
    ['Local de nascimento', coach.cidade_nascimento],
    ['Clube atual', coach.clube_atual],
    ['Licença', coach.licenca],
    ['Média no cargo', coach.media_tempo_cargo],
    ['Sistema preferencial', coach.formacao_preferida],
    ['Títulos principais', report.titulos_principais || '—'],
    ['Agente', coach.agente]
  ])

  section('ESTATÍSTICAS GERAIS DE CARREIRA', 'Indicadores consolidados do histórico')
  dataTable(['Jogos','Vitórias','Empates','Derrotas','Aproveit.','Gols','PPJ'], [[
    metrics.jogos_carreira || metrics.jogos_detalhados || 0,
    metrics.vitorias || 0,
    metrics.empates || 0,
    metrics.derrotas || 0,
    pct(metrics.aproveitamento),
    `${metrics.gols_pro || 0}:${metrics.gols_contra || 0}`,
    Number(metrics.ppj_carreira || metrics.ppj_detalhado || 0).toFixed(2).replace('.', ',')
  ]], { fontSize: 7.2 })

  if ((metrics.maiores_vitorias || []).length) {
    doc.setFont('helvetica','bold')
    doc.setFontSize(8.6)
    doc.setTextColor(...BLUE)
    doc.text('Maiores vitórias registradas', M, y)
    y += 4
    dataTable(['Competição','Data','Resultado'], (metrics.maiores_vitorias || []).map(g => [g.competicao, g.data, `${g.mandante} ${g.placar} ${g.visitante}`]), { fontSize: 6.8 })
  }

  if (career.length) {
    section('3. HISTÓRICO DE CLUBES E EVOLUÇÃO', 'Passagens profissionais e desempenho')
    dataTable(['Clube','Cargo','Entrada','Saída','Jogos','PPJ'], career.map(c => [c.clube, c.cargo, c.entrada || '—', c.saida || 'Atual', c.jogos || 0, Number(c.ppj || 0).toFixed(2).replace('.', ',')]), { fontSize: 6.7 })
  }

  if ((metrics.esquemas_base || []).length) {
    section('ESQUEMAS-BASE MAIS UTILIZADOS', 'Leitura direta dos sistemas-base do Transfermarkt')
    dataTable(['Sistema','Jogos','Frequência'], (metrics.esquemas_base || []).slice(0, 12).map(f => [f.formacao, f.jogos, `${Number(f.percentual || 0).toFixed(1).replace('.', ',')}%`]), { fontSize: 7 })
  }

  if ((metrics.formacoes || []).length) {
    section('VARIAÇÕES TÁTICAS REGISTRADAS', 'Variações e ajustes usados ao longo dos jogos')
    dataTable(['Variação','Jogos','Frequência'], (metrics.formacoes || []).slice(0, 14).map(f => [f.formacao, f.jogos, `${Number(f.percentual || 0).toFixed(1).replace('.', ',')}%`]), { fontSize: 7 })
  }

  if ((report.sistemas_taticos || []).length) {
    section('LEITURA DOS SISTEMAS TÁTICOS', 'Interpretação qualitativa do comportamento estrutural')
    dataTable(['Sistema','Frequência','Contexto','Evidência'], (report.sistemas_taticos || []).map(x => [x.sistema, x.frequencia || '—', x.contexto || '—', x.evidencia || '—']), { fontSize: 6.5 })
  }

  if ((metrics.evolucao_tatica || []).length) {
    section('EVOLUÇÃO TÁTICA POR TEMPORADA', 'Panorama de utilização por ano/clubes')
    dataTable(['Temporada','Clube(s)','Formações mais usadas'], (metrics.evolucao_tatica || []).map(x => [x.temporada, (x.clubes || []).join(' · ') || '—', (x.formacoes || []).map(f => `${f.formacao} (${f.jogos})`).join(' · ') || '—']), { fontSize: 6.5 })
  }

  const model = report.modelo_jogo || {}
  section('4. MODELO DE JOGO', 'Síntese das evidências por fase do jogo')
  const modelSections = [
    ['4.1 Saída de bola', model.saida_bola],
    ['4.2 Construção', model.construcao],
    ['4.3 Último terço', model.ultimo_terco],
    ['4.4 Transição ofensiva', model.transicao_ofensiva],
    ['4.5 Bloco alto', model.bloco_alto],
    ['4.6 Bloco médio / baixo', model.bloco_medio_baixo],
    ['4.7 Transição defensiva', model.transicao_defensiva],
    ['4.8 Bolas paradas ofensivas', model.bola_parada_ofensiva],
    ['4.9 Bolas paradas defensivas', model.bola_parada_defensiva]
  ]
  modelSections.forEach(([title, text]) => {
    if (!clean(text)) return
    ensure(12)
    doc.setFont('helvetica','bold')
    doc.setFontSize(8.7)
    doc.setTextColor(...BLUE)
    doc.text(title, M, y)
    y += 4
    paragraph(text, NAVY, 8.2)
  })

  if ((report.pontos_fortes || []).length || (report.pontos_melhoria || []).length) {
    section('5. PONTOS FORTES E PONTOS DE MELHORIA', 'Principais evidências da avaliação')
    if ((report.pontos_fortes || []).length) {
      dataTable(['Ponto forte','Evidência'], (report.pontos_fortes || []).filter(x => x.titulo || x.evidencia).map(x => [x.titulo, x.evidencia]), { headFillColor: GREEN })
    }
    if ((report.pontos_melhoria || []).length) {
      dataTable(['Ponto de melhoria','Evidência'], (report.pontos_melhoria || []).filter(x => x.titulo || x.evidencia).map(x => [x.titulo, x.evidencia]), { headFillColor: RED })
    }
  }

  if ((report.perfis_jogadores || []).some(x => x.perfil || x.observacao)) {
    section('6. PERFIL DE JOGADORES NECESSÁRIOS AO MODELO', 'Perfis mais aderentes ao contexto do treinador')
    dataTable(['Posição','Perfil prioritário','Observação'], (report.perfis_jogadores || []).filter(x => x.perfil || x.observacao).map(x => [x.posicao, x.perfil, x.observacao]), { fontSize: 6.8 })
  }

  if ((report.adaptabilidade || []).some(x => Number(x.nota) > 0 || x.justificativa)) {
    section('7. ADAPTABILIDADE DO TREINADOR', 'Critérios complementares da decisão')
    dataTable(['Critério','Avaliação','Justificativa'], (report.adaptabilidade || []).map(x => [x.criterio, Number(x.nota) > 0 ? `${'★'.repeat(Number(x.nota))}${'☆'.repeat(5 - Number(x.nota))}` : '—', x.justificativa || '—']), { fontSize: 7 })
  }

  if (report.filosofia_declarada || report.coerencia_discurso_dados || report.referencias_externas) {
    section('8. ENTREVISTAS E REFERÊNCIAS', 'Base textual e fontes externas incorporadas')
    if (report.filosofia_declarada) {
      doc.setFont('helvetica','bold')
      doc.setTextColor(...BLUE)
      doc.setFontSize(8.7)
      doc.text('Filosofia declarada', M, y)
      y += 4
      paragraph(report.filosofia_declarada)
      if (report.fonte_filosofia) paragraph(`Fonte: ${report.fonte_filosofia}`, TEXT, 7.6)
    }
    if (report.coerencia_discurso_dados) {
      doc.setFont('helvetica','bold')
      doc.setTextColor(...BLUE)
      doc.setFontSize(8.7)
      doc.text('Coerência entre discurso e evidências', M, y)
      y += 4
      paragraph(report.coerencia_discurso_dados)
    }
    if (report.referencias_externas) {
      doc.setFont('helvetica','bold')
      doc.setTextColor(...BLUE)
      doc.setFontSize(8.7)
      doc.text('Referências externas', M, y)
      y += 4
      paragraph(report.referencias_externas)
    }
  }

  section('9. CONSIDERAÇÕES FINAIS E RECOMENDAÇÃO', 'Encaminhamento final para decisão')
  doc.setFillColor(...recColor)
  doc.roundedRect(M, y, W - (M * 2), 11, 2.5, 2.5, 'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.text(String(recommendation).toUpperCase(), W / 2, y + 7, { align:'center' })
  y += 17

  ;(report.justificativas_recomendacao || []).forEach((x, i) => {
    if (!x.titulo && !x.texto) return
    ensure(15)
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica','bold')
    doc.setFontSize(8.5)
    doc.text(`${i + 1}. ${x.titulo || 'Justificativa'}`, M, y)
    y += 4
    paragraph(x.texto)
  })

  if (report.sintese_final) {
    ensure(16)
    doc.setFont('helvetica','bold')
    doc.setTextColor(...BLUE)
    doc.setFontSize(9)
    doc.text('Em síntese', M, y)
    y += 5
    paragraph(report.sintese_final)
  }

  if (coach.transfermarkt_url) {
    ensure(14)
    doc.setFontSize(6.6)
    doc.setTextColor(...TEXT)
    doc.text('Fontes públicas estruturadas:', M, y)
    y += 3
    const tmLines = doc.splitTextToSize(coach.transfermarkt_url, W - (M * 2))
    doc.text(tmLines, M, y)
    y += tmLines.length * 3
    if (coach.performance_url) {
      const perfLines = doc.splitTextToSize(coach.performance_url, W - (M * 2))
      doc.text(perfLines, M, y)
      y += perfLines.length * 3
    }
  }

  footer()
  const filename = `Scouting-Treinador-${String(coach.nome || 'treinador').replace(/[^a-z0-9]+/gi,'-')}-Confianca.pdf`
  doc.save(filename)
}
