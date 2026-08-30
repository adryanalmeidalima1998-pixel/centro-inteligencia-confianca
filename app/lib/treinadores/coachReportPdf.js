const BLUE = [10, 102, 183]
const NAVY = [6, 23, 46]
const LIGHT = [239, 246, 252]
const GREEN = [22, 163, 74]
const RED = [220, 38, 38]
const AMBER = [217, 119, 6]

async function logoData() {
  try {
    const res = await fetch('/confianca.png')
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob)
    })
  } catch { return null }
}

function safe(v, fallback='—') { return v == null || v === '' ? fallback : String(v) }
function pct(v) { return Number.isFinite(Number(v)) ? `${Number(v).toFixed(1).replace('.', ',')}%` : '—' }

export async function exportCoachReportPdf(coach) {
  const [{ jsPDF }, atMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = atMod.autoTable ?? atMod.default
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true })
  const W = 210, H = 297, M = 14
  const report = coach.relatorio_json || {}
  const metrics = coach.metricas_json || {}
  const career = coach.carreira_json || []
  const games = coach.jogos_json || []
  const logo = await logoData()
  let y = 15

  const header = (title='RELATÓRIO DE SCOUTING DE TREINADOR') => {
    doc.setFillColor(...NAVY); doc.rect(0,0,W,24,'F')
    if (logo) { try { doc.addImage(logo,'PNG',M,4,16,16) } catch {} }
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(11)
    doc.text('ASSOCIAÇÃO DESPORTIVA CONFIANÇA', M+20, 10)
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.text('Centro de Inteligência · Scouting & Recrutamento', M+20, 15)
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.text(title, W-M, 11, {align:'right'})
    y = 31
  }
  const footer = () => {
    const pages = doc.internal.getNumberOfPages()
    for (let p=1;p<=pages;p++) {
      doc.setPage(p); doc.setDrawColor(215,225,236); doc.line(M,H-12,W-M,H-12)
      doc.setFontSize(6.8); doc.setTextColor(100,116,139); doc.setFont('helvetica','normal')
      doc.text('Documento confidencial · Uso interno · Centro de Inteligência do Confiança', M,H-7)
      doc.text(`Página ${p}/${pages}`,W-M,H-7,{align:'right'})
    }
  }
  const newPage = () => { doc.addPage(); header() }
  const ensure = (need=25) => { if (y + need > H-18) newPage() }
  const section = (title) => {
    ensure(14); doc.setTextColor(...NAVY); doc.setFont('helvetica','bold'); doc.setFontSize(12)
    doc.text(title, M, y); doc.setDrawColor(...BLUE); doc.setLineWidth(.7); doc.line(M,y+2,W-M,y+2); y += 8
  }
  const paragraph = (text, color=NAVY) => {
    if (!text) return
    doc.setTextColor(...color); doc.setFont('helvetica','normal'); doc.setFontSize(8.3)
    const lines = doc.splitTextToSize(String(text), W-(M*2)); ensure(lines.length*4+4); doc.text(lines,M,y); y += lines.length*4 + 3
  }
  const kvTable = (rows) => {
    autoTable(doc,{startY:y, margin:{left:M,right:M}, theme:'grid',
      body:rows.map(([a,b])=>[a,safe(b)]),
      styles:{fontSize:7.5,cellPadding:2.2,textColor:NAVY,lineColor:[220,228,236],lineWidth:.2},
      columnStyles:{0:{fontStyle:'bold',fillColor:LIGHT,cellWidth:48}},
      didDrawPage:()=>{},
    }); y=doc.lastAutoTable.finalY+6
  }
  const dataTable = (head, body, opts={}) => {
    autoTable(doc,{startY:y, margin:{left:M,right:M}, head:[head], body,
      styles:{fontSize:opts.fontSize||7,cellPadding:1.8,textColor:NAVY,lineColor:[224,231,239],lineWidth:.15,overflow:'linebreak'},
      headStyles:{fillColor:BLUE,textColor:[255,255,255],fontStyle:'bold'},
      alternateRowStyles:{fillColor:[248,250,252]},
      ...opts
    }); y=doc.lastAutoTable.finalY+6
  }

  header()
  doc.setTextColor(...NAVY); doc.setFont('helvetica','bold'); doc.setFontSize(23); doc.text(safe(coach.nome,'TREINADOR').toUpperCase(),M,y); y+=7
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105)
  doc.text(`${safe(coach.clube_atual,'Sem clube')} · ${safe(coach.cargo_atual,'Treinador')}`,M,y); y+=8

  const kpis = [
    ['Jogos', metrics.jogos_carreira || metrics.jogos_detalhados || 0],
    ['PPJ', Number(metrics.ppj_carreira || metrics.ppj_detalhado || 0).toFixed(2).replace('.',',')],
    ['Aproveit.', pct(metrics.aproveitamento)],
    ['Idade', coach.idade ? `${coach.idade} anos` : '—']
  ]
  const kw=(W-M*2-6)/4
  kpis.forEach(([label,value],i)=>{const x=M+i*(kw+2);doc.setFillColor(...LIGHT);doc.roundedRect(x,y,kw,17,2,2,'F');doc.setTextColor(...BLUE);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(String(value),x+kw/2,y+7,{align:'center'});doc.setTextColor(100,116,139);doc.setFontSize(6.5);doc.text(label,x+kw/2,y+12.5,{align:'center'})}); y+=24

  kvTable([
    ['Analista de Dados', report.analista || 'Adryan Almeida'],
    ['Coordenação de Mercado', report.coordenador || '—'],
    ['Data do Relatório', report.data_relatorio || new Date().toLocaleDateString('pt-BR')],
    ['Clube Solicitante', report.clube_solicitante || 'Associação Desportiva Confiança — Aracaju / SE'],
    ['Cargo Avaliado', report.cargo_avaliado || 'Treinador Principal'],
    ['Formação preferida', coach.formacao_preferida || '—'],
    ['Fonte base', coach.transfermarkt_url ? 'Transfermarkt + observação interna' : 'Base interna']
  ])

  section('RESUMO EXECUTIVO'); paragraph(report.resumo_executivo || coach.estilo_jogo || 'Análise executiva pendente de preenchimento pelo departamento de scouting.')

  const watchedIds = new Set((report.jogos_analisados||[]).map(x=>Number(x.id)))
  const watched = games.filter(g=>watchedIds.has(Number(g.id)))
  if (watched.length) {
    section('1. JOGOS ANALISADOS')
    dataTable(['Data','Partida','Competição','Tática','Fonte'], watched.map(g=>[
      g.data, `${g.mandante} ${g.placar} ${g.visitante}`, g.competicao, g.tatica || '—',
      (report.jogos_analisados||[]).find(x=>Number(x.id)===Number(g.id))?.fonte || 'Wyscout'
    ]), {fontSize:6.7})
  }

  section('2. PERFIL DO TREINADOR')
  kvTable([
    ['Nome completo', coach.nome],['Nacionalidade',coach.nacionalidade],['Nascimento',coach.data_nascimento],
    ['Local de nascimento',coach.cidade_nascimento],['Clube atual',coach.clube_atual],['Licença',coach.licenca],
    ['Média no cargo',coach.media_tempo_cargo],['Sistema preferencial',coach.formacao_preferida],['Títulos principais',report.titulos_principais || '—'],['Agente',coach.agente]
  ])

  section('Estatísticas gerais de carreira')
  dataTable(['Jogos','Vitórias','Empates','Derrotas','Aproveit.','Gols','PPJ'], [[
    metrics.jogos_carreira || metrics.jogos_detalhados || 0, metrics.vitorias || 0, metrics.empates || 0, metrics.derrotas || 0, pct(metrics.aproveitamento),
    `${metrics.gols_pro || 0}:${metrics.gols_contra || 0}`, Number(metrics.ppj_carreira || metrics.ppj_detalhado || 0).toFixed(2).replace('.',',')
  ]])
  if ((metrics.maiores_vitorias||[]).length) {
    doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...BLUE);doc.text('Maiores vitórias registradas',M,y);y+=4
    dataTable(['Competição','Data','Resultado'],metrics.maiores_vitorias.map(g=>[g.competicao,g.data,`${g.mandante} ${g.placar} ${g.visitante}`]),{fontSize:6.7})
  }

  if (career.length) {
    section('3. HISTÓRICO DE CLUBES E EVOLUÇÃO')
    dataTable(['Clube','Cargo','Entrada','Saída','Jogos','PPJ'], career.map(c=>[c.clube,c.cargo,c.entrada||'—',c.saida||'Atual',c.jogos||0,Number(c.ppj||0).toFixed(2).replace('.',',')]), {fontSize:6.6})
  }
  if ((metrics.esquemas_base||[]).length) {
    section('Esquemas-base mais utilizados')
    dataTable(['Sistema','Jogos','Frequência'], metrics.esquemas_base.slice(0,12).map(f=>[f.formacao,f.jogos,`${Number(f.percentual||0).toFixed(1).replace('.',',')}%`]))
  }
  if ((metrics.formacoes||[]).length) {
    section('Variações táticas registradas')
    dataTable(['Variação','Jogos','Frequência'], metrics.formacoes.slice(0,14).map(f=>[f.formacao,f.jogos,`${Number(f.percentual||0).toFixed(1).replace('.',',')}%`]))
  }
  if ((report.sistemas_taticos||[]).length) {
    section('Leitura dos sistemas táticos')
    dataTable(['Sistema','Frequência','Contexto','Evidência'], report.sistemas_taticos.map(x=>[x.sistema,x.frequencia||'—',x.contexto||'—',x.evidencia||'—']),{fontSize:6.4})
  }
  if ((metrics.evolucao_tatica||[]).length) {
    section('Evolução tática por temporada')
    dataTable(['Temporada','Clube(s)','Formações mais usadas'], metrics.evolucao_tatica.map(x=>[x.temporada,(x.clubes||[]).join(' · ')||'—',(x.formacoes||[]).map(f=>`${f.formacao} (${f.jogos})`).join(' · ')||'—']),{fontSize:6.5})
  }

  const model = report.modelo_jogo || {}
  section('4. MODELO DE JOGO')
  const modelSections = [
    ['4.1 Saída de bola',model.saida_bola],['4.2 Construção',model.construcao],['4.3 Último terço',model.ultimo_terco],
    ['4.4 Transição ofensiva',model.transicao_ofensiva],['4.5 Bloco alto',model.bloco_alto],['4.6 Bloco médio/baixo',model.bloco_medio_baixo],
    ['4.7 Transição defensiva',model.transicao_defensiva],['4.8 Bolas paradas ofensivas',model.bola_parada_ofensiva],['4.9 Bolas paradas defensivas',model.bola_parada_defensiva]
  ]
  modelSections.forEach(([title,text])=>{ if(text){ensure(12);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...BLUE);doc.text(title,M,y);y+=4;paragraph(text)}})

  if ((report.pontos_fortes||[]).length || (report.pontos_melhoria||[]).length) {
    section('5. PONTOS FORTES E PONTOS DE MELHORIA')
    if ((report.pontos_fortes||[]).length) dataTable(['Ponto forte','Evidência'],report.pontos_fortes.filter(x=>x.titulo||x.evidencia).map(x=>[x.titulo,x.evidencia]),{headStyles:{fillColor:GREEN,textColor:[255,255,255]}})
    if ((report.pontos_melhoria||[]).length) dataTable(['Ponto de melhoria','Evidência'],report.pontos_melhoria.filter(x=>x.titulo||x.evidencia).map(x=>[x.titulo,x.evidencia]),{headStyles:{fillColor:RED,textColor:[255,255,255]}})
  }

  if ((report.perfis_jogadores||[]).some(x=>x.perfil||x.observacao)) {
    section('6. PERFIL DE JOGADORES NECESSÁRIOS AO MODELO')
    dataTable(['Posição','Perfil prioritário','Observação'],report.perfis_jogadores.filter(x=>x.perfil||x.observacao).map(x=>[x.posicao,x.perfil,x.observacao]))
  }

  if ((report.adaptabilidade||[]).some(x=>Number(x.nota)>0 || x.justificativa)) {
    section('7. ADAPTABILIDADE DO TREINADOR')
    dataTable(['Critério','Avaliação','Justificativa'], report.adaptabilidade.map(x=>[x.criterio, Number(x.nota)>0 ? `${'★'.repeat(Number(x.nota))}${'☆'.repeat(5-Number(x.nota))}` : '—', x.justificativa||'—']))
  }

  if (report.filosofia_declarada || report.coerencia_discurso_dados || report.referencias_externas) {
    section('8. ENTREVISTAS E REFERÊNCIAS')
    if(report.filosofia_declarada){doc.setFont('helvetica','bold');doc.setTextColor(...BLUE);doc.setFontSize(8.5);doc.text('Filosofia declarada',M,y);y+=4;paragraph(report.filosofia_declarada);if(report.fonte_filosofia)paragraph(`Fonte: ${report.fonte_filosofia}`,[100,116,139])}
    if(report.coerencia_discurso_dados){doc.setFont('helvetica','bold');doc.setTextColor(...BLUE);doc.setFontSize(8.5);doc.text('Coerência entre discurso e evidências',M,y);y+=4;paragraph(report.coerencia_discurso_dados)}
    if(report.referencias_externas){doc.setFont('helvetica','bold');doc.setTextColor(...BLUE);doc.setFontSize(8.5);doc.text('Referências externas',M,y);y+=4;paragraph(report.referencias_externas)}
  }

  section('9. CONSIDERAÇÕES FINAIS E RECOMENDAÇÃO')
  const recommendation = report.recomendacao || coach.recomendacao || 'Em análise'
  const recColor = recommendation==='Recomendado'?GREEN:recommendation==='Não Recomendado'?RED:recommendation==='Com Ressalvas'?AMBER:BLUE
  doc.setFillColor(...recColor); doc.roundedRect(M,y,W-M*2,10,2,2,'F'); doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(String(recommendation).toUpperCase(),W/2,y+6.5,{align:'center'});y+=16
  ;(report.justificativas_recomendacao||[]).forEach((x,i)=>{if(!x.titulo&&!x.texto)return;ensure(15);doc.setTextColor(...NAVY);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text(`${i+1}. ${x.titulo||'Justificativa'}`,M,y);y+=4;paragraph(x.texto)})
  if(report.sintese_final){ensure(16);doc.setFont('helvetica','bold');doc.setTextColor(...BLUE);doc.setFontSize(9);doc.text('Em síntese',M,y);y+=5;paragraph(report.sintese_final)}

  if (coach.transfermarkt_url) {
    ensure(12); doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.text('Fontes públicas estruturadas:',M,y); y+=3
    doc.text(coach.transfermarkt_url,M,y); y+=3
    if(coach.performance_url) doc.text(coach.performance_url,M,y)
  }

  footer()
  const filename = `Scouting-Treinador-${String(coach.nome||'treinador').replace(/[^a-z0-9]+/gi,'-')}-Confianca.pdf`
  doc.save(filename)
}
