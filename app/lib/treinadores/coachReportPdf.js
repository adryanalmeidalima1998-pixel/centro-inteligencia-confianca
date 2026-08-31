import { sanitizeCoachReport } from '@/lib/treinador-report-sanitizer'
import { filterCareerLastTenYears, filterEvolutionLastTenYears, rebuildTacticalMetrics } from '@/lib/treinador-tactical-utils'

const BLUE = [10, 102, 183]
const SKY = [36, 164, 235]
const NAVY = [6, 23, 46]
const LIGHT = [242, 247, 252]
const LIGHTER = [248, 250, 252]
const TEXT = [71, 85, 105]
const MUTED = [132, 145, 165]
const GREEN = [22, 163, 74]
const GREEN_BG = [239, 253, 244]
const RED = [220, 38, 38]
const RED_BG = [254, 242, 242]
const AMBER = [245, 158, 11]
const BORDER = [224, 231, 239]
const WHITE = [255, 255, 255]

function safe(v, fallback='-') { return v == null || v === '' ? fallback : String(v) }
function clean(value='') { return String(value || '').trim() }
function pct(v) { return Number.isFinite(Number(v)) ? `${Number(v).toFixed(1).replace('.', ',')}%` : '-' }

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
    if (!res.ok) return null
    return await blobToDataUrl(await res.blob())
  } catch { return null }
}

async function coachPhotoData(photoUrl) {
  if (!clean(photoUrl)) return null
  try {
    const res = await fetch(`/api/treinadores/foto?url=${encodeURIComponent(photoUrl)}`, { cache:'no-store' })
    if (!res.ok) return null
    return await blobToDataUrl(await res.blob())
  } catch { return null }
}

export async function exportCoachReportPdf(coach) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true })

  const W = 210
  const H = 297
  const M = 14
  const IW = W - M * 2
  const pageBottom = H - 18

  const report = sanitizeCoachReport(coach.relatorio_json || {})
  const objective = report.aderencia_objetivo || {}
  const wyscout = report.wyscout_analise || null
  const games = coach.jogos_json || []
  const metrics = rebuildTacticalMetrics(coach.metricas_json || {}, games)
  const career = filterCareerLastTenYears(coach.carreira_json || [])
  const evolution = filterEvolutionLastTenYears(metrics.evolucao_tatica || [])
  const [logo, photo] = await Promise.all([logoData(), coachPhotoData(coach.foto_url)])

  const recommendation = report.recomendacao || coach.recomendacao || 'Em análise'
  const recColor = recommendation === 'Recomendado' ? GREEN : recommendation === 'Não Recomendado' ? RED : recommendation === 'Com Ressalvas' ? AMBER : BLUE

  let y = 31

  const header = () => {
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 24, 'F')
    if (logo) {
      try { doc.addImage(logo, 'PNG', M, 4, 16, 16) } catch {}
    }
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica','bold')
    doc.setFontSize(10.8)
    doc.text('ASSOCIAÇÃO DESPORTIVA CONFIANÇA', M + 20, 10)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.2)
    doc.text('Centro de Inteligência - Scouting & Recrutamento', M + 20, 15)
    doc.setFont('helvetica','bold')
    doc.setFontSize(7)
    doc.text('RELATÓRIO DE SCOUTING DE TREINADOR', W - M, 11, { align:'right' })
    y = 31
  }

  const newPage = () => { doc.addPage(); header() }
  const ensure = (need=20) => { if (y + need > pageBottom) newPage() }

  const footer = () => {
    const pages = doc.internal.getNumberOfPages()
    for (let p=1; p<=pages; p++) {
      doc.setPage(p)
      doc.setDrawColor(...BORDER)
      doc.line(M, H - 12, W - M, H - 12)
      doc.setFont('helvetica','normal')
      doc.setFontSize(6.6)
      doc.setTextColor(...TEXT)
      doc.text('Documento confidencial - Uso interno - Centro de Inteligência do Confiança', M, H - 7)
      doc.text(`Página ${p}/${pages}`, W - M, H - 7, { align:'right' })
    }
  }

  const section = (title, subtitle='') => {
    ensure(13)
    doc.setFillColor(...BLUE)
    doc.roundedRect(M, y, 18, 1.5, 0.7, 0.7, 'F')
    y += 6
    doc.setFont('helvetica','bold')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text(title, M, y)
    if (subtitle) {
      doc.setFont('helvetica','normal')
      doc.setFontSize(7.1)
      doc.setTextColor(...MUTED)
      doc.text(subtitle, W-M, y, { align:'right' })
    }
    y += 5
  }

  const textLines = (text, width, size=8) => {
    doc.setFontSize(size)
    return doc.splitTextToSize(clean(text), width)
  }

  const paragraph = (text, size=8.1, color=NAVY, indent=0) => {
    if (!clean(text)) return
    const lines = textLines(text, IW-indent, size)
    ensure(lines.length * 3.7 + 3)
    doc.setFont('helvetica','normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(lines, M + indent, y)
    y += lines.length * 3.7 + 3
  }

  const cardBase = (x, top, w, h, {fill=WHITE,border=BORDER,accent=null,radius=3}={}) => {
    doc.setFillColor(...fill)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, top, w, h, radius, radius, 'FD')
    if (accent) {
      doc.setFillColor(...accent)
      doc.roundedRect(x, top, 2.1, h, 1, 1, 'F')
    }
  }

  const labelValueCard = (x, top, w, label, value, sub='') => {
    const h=18
    cardBase(x,top,w,h,{fill:LIGHTER})
    doc.setFont('helvetica','bold'); doc.setFontSize(6.2); doc.setTextColor(...MUTED)
    doc.text(String(label).toUpperCase(),x+3.5,top+5)
    doc.setFont('helvetica','bold'); doc.setFontSize(10.8); doc.setTextColor(...NAVY)
    const lines=textLines(safe(value),w-7,10.8).slice(0,2)
    doc.text(lines,x+3.5,top+10.5)
    if(sub){doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(...MUTED);doc.text(String(sub),x+3.5,top+16)}
    return h
  }

  const textCardHeight = (title, body, w, size=8, extra=0) => {
    const titleLines = clean(title) ? textLines(title, w-10, 8.2).length : 0
    const bodyLines = clean(body) ? textLines(body, w-10, size).length : 0
    return Math.max(18, 8 + titleLines*3.5 + bodyLines*3.6 + extra)
  }

  const textCard = (x, top, w, title, body, {accent=BLUE,fill=WHITE,size=8,badge='',badgeColor=BLUE}={}) => {
    const h=textCardHeight(title,body,w,size,badge?4:0)
    cardBase(x,top,w,h,{fill,border:BORDER,accent})
    let cy=top+5
    if(title){
      doc.setFont('helvetica','bold');doc.setFontSize(8.2);doc.setTextColor(...NAVY)
      const t=textLines(title,w-10,8.2);doc.text(t,x+5,cy);cy+=t.length*3.5+1.5
    }
    if(badge){
      doc.setFillColor(...badgeColor);doc.roundedRect(x+5,cy-1.5,Math.min(w-10,doc.getTextWidth(badge)+6),5,2,2,'F')
      doc.setFont('helvetica','bold');doc.setFontSize(5.8);doc.setTextColor(...WHITE);doc.text(badge,x+8,cy+1.6);cy+=6
    }
    if(body){
      doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(...TEXT)
      const b=textLines(body,w-10,size);doc.text(b,x+5,cy);cy+=b.length*3.6
    }
    return h
  }

  const rowCards = (items, cols=2, gap=3, options={}) => {
    const w=(IW-gap*(cols-1))/cols
    for(let i=0;i<items.length;i+=cols){
      const row=items.slice(i,i+cols)
      const heights=row.map(item=>textCardHeight(item.title,item.body,w,item.size||options.size||8,item.badge?4:0))
      const rh=Math.max(...heights)
      ensure(rh+gap)
      row.forEach((item,j)=>{
        textCard(M+j*(w+gap),y,w,item.title,item.body,{...options,...item})
      })
      y+=rh+gap
    }
  }

  const drawStar = (cx, cy, r, filled) => {
    const pts=[]
    for(let i=0;i<10;i++){
      const angle=-Math.PI/2 + i*Math.PI/5
      const rr=i%2===0?r:r*0.44
      pts.push([cx+Math.cos(angle)*rr,cy+Math.sin(angle)*rr])
    }
    const deltas=[]
    for(let i=1;i<pts.length;i++) deltas.push([pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]])
    deltas.push([pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1]])
    doc.setFillColor(...(filled?AMBER:[226,232,240]))
    doc.setDrawColor(...(filled?AMBER:[226,232,240]))
    doc.lines(deltas,pts[0][0],pts[0][1],[1,1],'F',true)
  }

  const starRating = (x, top, note) => {
    for(let i=0;i<5;i++) drawStar(x+i*5,top,1.75,i<Number(note||0))
  }

  const formationCard = (x, top, w, item, max) => {
    const h=18
    cardBase(x,top,w,h,{fill:LIGHTER})
    doc.setFont('helvetica','bold');doc.setFontSize(9.3);doc.setTextColor(...NAVY);doc.text(safe(item.formacao),x+4,top+6)
    doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...BLUE);doc.text(`${item.jogos} jogos`,x+w-4,top+6,{align:'right'})
    const pctv=max?Math.min(1,Number(item.jogos||0)/max):0
    doc.setFillColor(...BORDER);doc.roundedRect(x+4,top+10,w-8,2.8,1.4,1.4,'F')
    doc.setFillColor(...BLUE);doc.roundedRect(x+4,top+10,(w-8)*pctv,2.8,1.4,1.4,'F')
    doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(...MUTED);doc.text(`${Number(item.percentual||0).toFixed(1).replace('.',',')}%`,x+4,top+16)
    return h
  }

  header()

  // HERO
  const heroH=39
  cardBase(M,y,IW,heroH,{fill:WHITE,border:BORDER})
  const photoSize=28
  const photoX=W-M-photoSize-5
  const nameWidth=IW-photoSize-14
  doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(...NAVY)
  const name=textLines(safe(coach.nome,'TREINADOR').toUpperCase(),nameWidth,20).slice(0,2)
  doc.text(name,M+5,y+10)
  doc.setFont('helvetica','normal');doc.setFontSize(8.2);doc.setTextColor(...TEXT)
  doc.text(`${safe(coach.clube_atual,'Sem clube')} - ${safe(coach.cargo_atual,'Treinador')} - ${safe(coach.nacionalidade)}`,M+5,y+18)
  doc.setFillColor(...recColor);doc.roundedRect(M+5,y+23,34,7,3,3,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.6);doc.setTextColor(...WHITE);doc.text(recommendation.toUpperCase(),M+22,y+27.5,{align:'center'})
  doc.setFont('helvetica','bold');doc.setFontSize(6.1);doc.setTextColor(...MUTED);doc.text('FORMAÇÃO BASE',M+43,y+25.5);doc.setFontSize(8.2);doc.setTextColor(...NAVY);doc.text(safe(coach.formacao_preferida),M+43,y+30)
  doc.setFont('helvetica','bold');doc.setFontSize(6.1);doc.setTextColor(...MUTED);doc.text('LICENÇA',M+76,y+25.5);doc.setFontSize(7.2);doc.setTextColor(...NAVY);doc.text(textLines(safe(coach.licenca),46,7.2).slice(0,2),M+76,y+30)
  if(photo){
    try{doc.addImage(photo,photo.startsWith('data:image/png')?'PNG':'JPEG',photoX,y+5,photoSize,photoSize)}catch{}
  }else{
    doc.setFillColor(...LIGHT);doc.roundedRect(photoX,y+5,photoSize,photoSize,4,4,'F');doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(...BLUE);doc.text((coach.nome||'T')[0].toUpperCase(),photoX+photoSize/2,y+22,{align:'center'})
  }
  y+=heroH+6

  // KPIs em cards 3x2
  const kpis=[
    ['Jogos carreira',metrics.jogos_carreira||metrics.jogos_detalhados||0,'Base Transfermarkt'],
    ['PPJ carreira',Number(metrics.ppj_carreira||metrics.ppj_detalhado||0).toFixed(2).replace('.',','),'Pontos por jogo'],
    ['Aproveitamento',pct(metrics.aproveitamento),`${metrics.vitorias||0}V - ${metrics.empates||0}E - ${metrics.derrotas||0}D`],
    ['Gols',`${metrics.gols_pro||0}:${metrics.gols_contra||0}`,'Pro x Contra'],
    ['Fit Serie C',Number(objective.nota||0)>0?`${objective.nota}/100`:'-',objective.nivel||'Em análise'],
    ['Idade',coach.idade||'-',coach.data_nascimento||'-']
  ]
  const kw=(IW-6)/3
  for(let r=0;r<2;r++){
    ensure(21)
    for(let c=0;c<3;c++){
      const item=kpis[r*3+c];labelValueCard(M+c*(kw+3),y,kw,item[0],item[1],item[2])
    }
    y+=21
  }
  y+=3

  section('IDENTIFICAÇÃO DO RELATÓRIO','Dados administrativos e de referência')
  rowCards([
    {title:'Scouting/Dados',body:report.analista||'Adryan Almeida',accent:BLUE,fill:LIGHTER,size:8.4},
    {title:'Coordenação de Mercado',body:clean(report.coordenador)||'Anthony Emanoel',accent:BLUE,fill:LIGHTER,size:8.4},
    {title:'Data do relatório',body:report.data_relatorio||new Date().toLocaleDateString('pt-BR'),accent:BLUE,fill:LIGHTER,size:8.4},
    {title:'Clube solicitante',body:report.clube_solicitante||'Associação Desportiva Confiança - Aracaju / SE',accent:BLUE,fill:LIGHTER,size:8.2},
    {title:'Cargo avaliado',body:report.cargo_avaliado||'Treinador Principal',accent:BLUE,fill:LIGHTER,size:8.4},
    {title:'Fonte base',body:coach.transfermarkt_url?'Transfermarkt + Wyscout + observacao interna':'Base interna',accent:BLUE,fill:LIGHTER,size:8.2}
  ],2,3)

  if(Number(objective.nota||0)>0 || (objective.acessos_confirmados||[]).length){
    section('ADERÊNCIA AO OBJETIVO INSTITUCIONAL','Prioridade: retorno do Confiança à Série C')
    ensure(28)
    const scoreW=45
    cardBase(M,y,scoreW,27,{fill:NAVY,border:NAVY})
    doc.setFont('helvetica','bold');doc.setFontSize(6.2);doc.setTextColor(...SKY);doc.text('NOTA DO PROJETO',M+5,y+6)
    doc.setFontSize(20);doc.setTextColor(...WHITE);doc.text(`${objective.nota||0}`,M+5,y+16);doc.setFontSize(8);doc.setTextColor(191,219,254);doc.text('/100',M+23,y+16)
    doc.setFontSize(7.2);doc.setTextColor(...WHITE);doc.text(safe(objective.nivel,'Em análise'),M+5,y+23)
    const objBody=objective.objetivo||'Retorno do Confiança à Série C'
    textCard(M+scoreW+3,y,IW-scoreW-3,'Objetivo competitivo',objBody,{accent:BLUE,fill:LIGHTER,size:8.5})
    y+=31
    rowCards((objective.acessos_confirmados||[]).map(x=>({
      title:`${x.clube} - ${x.temporada}`,
      badge:`${safe(x.origem)} para ${safe(x.destino)}`,
      body:[x.conquista,x.evidencia].filter(Boolean).join('. '),
      accent:GREEN,fill:GREEN_BG,badgeColor:GREEN,size:7.7
    })),2,3)
    if(objective.experiencia_serie_d){
      const h=textCardHeight('Experiência em Série D',objective.experiencia_serie_d,IW,8.1);ensure(h+3);textCard(M,y,IW,'Experiência em Série D',objective.experiencia_serie_d,{accent:GREEN,fill:GREEN_BG,size:8.1});y+=h+3
    }
  }

  section('RESUMO EXECUTIVO','Síntese para abertura do relatório')
  const summary=report.resumo_executivo||coach.estilo_jogo
  if(summary){const h=textCardHeight('',summary,IW,8.6);ensure(h+4);textCard(M,y,IW,'',summary,{accent:BLUE,fill:LIGHTER,size:8.6});y+=h+5}

  const watchedIds=new Set((report.jogos_analisados||[]).map(x=>Number(x.id)))
  const watched=games.filter(g=>watchedIds.has(Number(g.id)))
  if(watched.length){
    section('1. JOGOS ANALISADOS','Partidas selecionadas para leitura técnica')
    const wsByGame=new Map((wyscout?.jogos||[]).filter(x=>x.game_id).map(x=>[Number(x.game_id),x]))
    const selectedMap=new Map((report.jogos_analisados||[]).map(x=>[Number(x.id),x]))
    rowCards(watched.map(g=>{
      const ws=wsByGame.get(Number(g.id));const sel=selectedMap.get(Number(g.id))
      const analysis=clean(sel?.nota)||clean(ws?.leitura_automatica)
      return {
        title:`${g.data} - ${g.mandante} ${g.placar} ${g.visitante}`,
        badge:`${g.tatica_wyscout||g.tatica||'-'} - ${sel?.fonte||'Wyscout'}`,
        body:analysis||g.competicao||'',accent:BLUE,fill:WHITE,badgeColor:BLUE,size:7.5
      }
    }),2,3)
  }

  if(wyscout?.resumo){
    section('LEITURA DOS JOGOS - WYSCOUT',`${wyscout.resumo.games||0} jogos importados`)
    const wk=[
      ['V-E-D',`${wyscout.resumo.wins||0}-${wyscout.resumo.draws||0}-${wyscout.resumo.losses||0}`,'Recorte importado'],
      ['xG / xGA',`${Number(wyscout.resumo.xg||0).toFixed(2).replace('.',',')} / ${Number(wyscout.resumo.xga||0).toFixed(2).replace('.',',')}`,'Média por jogo'],
      ['Posse',`${Number(wyscout.resumo.possession||0).toFixed(1).replace('.',',')}%`,'Média'],
      ['PPDA',Number(wyscout.resumo.ppda||0).toFixed(2).replace('.',','),'Pressão'],
      ['Entradas área',Number(wyscout.resumo.boxEntries||0).toFixed(1).replace('.',','),'Média'],
      ['Remates',`${Number(wyscout.resumo.shots||0).toFixed(1).replace('.',',')}`,'Média por jogo']
    ]
    const wkw=(IW-6)/3
    for(let r=0;r<2;r++){
      ensure(21)
      for(let c=0;c<3;c++){const item=wk[r*3+c];labelValueCard(M+c*(wkw+3),y,wkw,item[0],item[1],item[2])}
      y+=21
    }
    y+=3
    if(wyscout.ai?.sintese){const h=textCardHeight('Leitura consolidada',wyscout.ai.sintese,IW,8.1);ensure(h+4);textCard(M,y,IW,'Leitura consolidada',wyscout.ai.sintese,{accent:BLUE,fill:LIGHTER,size:8.1});y+=h+4}
  }

  section('2. PERFIL DO TREINADOR','Dados públicos consolidados')
  rowCards([
    {title:'Nome completo',body:coach.nome,fill:LIGHTER},
    {title:'Nacionalidade',body:coach.nacionalidade,fill:LIGHTER},
    {title:'Nascimento',body:coach.data_nascimento,fill:LIGHTER},
    {title:'Local de nascimento',body:coach.cidade_nascimento,fill:LIGHTER},
    {title:'Clube atual',body:coach.clube_atual,fill:LIGHTER},
    {title:'Licença',body:coach.licenca,fill:LIGHTER},
    {title:'Média no cargo',body:coach.media_tempo_cargo,fill:LIGHTER},
    {title:'Sistema preferencial',body:coach.formacao_preferida,fill:LIGHTER},
    {title:'Títulos principais',body:report.titulos_principais,fill:LIGHTER,size:7.6},
    {title:'Agente',body:coach.agente,fill:LIGHTER}
  ].filter(x=>clean(x.body)),2,3,{accent:BLUE,size:8.2})

  if((metrics.maiores_vitorias||[]).length){
    section('MAIORES VITÓRIAS','Resultados de maior margem registrados')
    rowCards((metrics.maiores_vitorias||[]).slice(0,6).map(g=>({title:`${g.mandante} ${g.placar} ${g.visitante}`,body:`${g.competicao} - ${g.data}`,accent:GREEN,fill:GREEN_BG,size:7.4})),2,3)
  }

  if(career.length){
    section('3. HISTÓRICO DE CLUBES - ÚLTIMOS 10 ANOS','Passagens profissionais do período recente')
    rowCards(career.map(c=>({
      title:`${c.clube} - ${c.cargo||'Treinador'}`,
      body:`${c.entrada||'-'} a ${c.saida||'Atual'} | ${Number(c.jogos||0)} jogos | ${Number(c.ppj||0).toFixed(2).replace('.',',')} PPJ`,
      accent:BLUE,fill:WHITE,size:7.5
    })),2,3)
  }

  if((metrics.esquemas_base||[]).length){
    section('ESQUEMAS-BASE MAIS UTILIZADOS','Distribuição das formações registradas')
    const items=(metrics.esquemas_base||[]).slice(0,10)
    const max=Math.max(1,...items.map(x=>Number(x.jogos||0)))
    const fw=(IW-3)/2
    for(let i=0;i<items.length;i+=2){
      ensure(21)
      items.slice(i,i+2).forEach((item,j)=>formationCard(M+j*(fw+3),y,fw,item,max))
      y+=21
    }
    y+=2
  }

  if(evolution.length){
    section('EVOLUÇÃO TÁTICA POR TEMPORADA - ÚLTIMOS 10 ANOS','Transfermarkt + táticas importadas do Wyscout')
    rowCards(evolution.map(x=>({
      title:`${x.temporada} - ${(x.clubes||[]).join(' / ')||'Clube não identificado'}`,
      body:(x.formacoes||[]).map(f=>`${f.formacao} (${f.jogos})`).join(' | '),
      accent:SKY,fill:LIGHTER,size:7.8
    })).filter(x=>clean(x.body)),2,3)
  }

  if((report.sistemas_taticos||[]).length){
    section('LEITURA DOS SISTEMAS TÁTICOS','Interpretação qualitativa das estruturas mais recorrentes')
    rowCards((report.sistemas_taticos||[]).map(x=>({
      title:x.sistema,
      badge:x.frequencia||'',
      body:[x.contexto,x.evidencia].filter(Boolean).join(' '),
      accent:BLUE,fill:WHITE,badgeColor:BLUE,size:7.7
    })).filter(x=>clean(x.body)||clean(x.badge)),2,3)
  }

  const model=report.modelo_jogo||{}
  const modelItems=[
    ['Saída de bola',model.saida_bola],['Construção',model.construcao],['Último terço',model.ultimo_terco],
    ['Transição ofensiva',model.transicao_ofensiva],['Bloco alto',model.bloco_alto],['Bloco médio / baixo',model.bloco_medio_baixo],
    ['Transição defensiva',model.transicao_defensiva],['Bolas paradas ofensivas',model.bola_parada_ofensiva],['Bolas paradas defensivas',model.bola_parada_defensiva]
  ].filter(([,v])=>clean(v))
  if(modelItems.length){
    section('4. MODELO DE JOGO','Leitura do comportamento por fase do jogo')
    rowCards(modelItems.map(([title,body])=>({title,body,accent:BLUE,fill:WHITE,size:7.9})),2,3)
  }

  if((report.pontos_fortes||[]).length){
    section('5. PONTOS FORTES','Síntese da avaliação do scouting')
    rowCards((report.pontos_fortes||[]).map(x=>({title:x.titulo,body:x.evidencia,accent:GREEN,fill:GREEN_BG,size:7.7})),2,3)
  }
  if((report.pontos_melhoria||[]).length){
    section('PONTOS DE MELHORIA','Aspectos concretos identificados na avaliação')
    rowCards((report.pontos_melhoria||[]).map(x=>({title:x.titulo,body:x.evidencia,accent:RED,fill:RED_BG,size:7.7})),2,3)
  }

  if((report.perfis_jogadores||[]).length){
    section('6. PERFIL DE JOGADORES NECESSÁRIOS AO MODELO','Somente perfis sustentados pela análise')
    rowCards((report.perfis_jogadores||[]).map(x=>({title:x.posicao,body:[x.perfil,x.observacao].filter(Boolean).join(' '),accent:BLUE,fill:LIGHTER,size:7.7})),2,3)
  }

  if((report.adaptabilidade||[]).length){
    section('7. ADAPTABILIDADE DO TREINADOR','Critérios complementares da decisão')
    for(const item of report.adaptabilidade){
      const h=Math.max(24,textCardHeight(item.criterio,item.justificativa,IW,7.8,5))
      ensure(h+3)
      cardBase(M,y,IW,h,{fill:WHITE,border:BORDER,accent:BLUE})
      doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...NAVY);doc.text(item.criterio,M+6,y+6)
      starRating(M+6,y+12.5,item.nota)
      doc.setFont('helvetica','bold');doc.setFontSize(6.3);doc.setTextColor(...MUTED);doc.text(`${Number(item.nota||0)}/5`,M+34,y+13.8)
      doc.setFont('helvetica','normal');doc.setFontSize(7.8);doc.setTextColor(...TEXT)
      const lines=textLines(item.justificativa,IW-12,7.8);doc.text(lines,M+6,y+19);y+=h+3
    }
  }

  if(report.filosofia_declarada||report.coerencia_discurso_dados||report.referencias_externas){
    section('8. ENTREVISTAS E REFERÊNCIAS','Base textual e fontes incorporadas')
    const refs=[]
    if(report.filosofia_declarada) refs.push({title:'Filosofia declarada',body:report.filosofia_declarada,accent:BLUE,fill:LIGHTER,size:7.8})
    if(report.fonte_filosofia) refs.push({title:'Fonte da declaração',body:report.fonte_filosofia,accent:SKY,fill:WHITE,size:7.2})
    if(report.coerencia_discurso_dados) refs.push({title:'Coerência entre discurso e comportamento',body:report.coerencia_discurso_dados,accent:BLUE,fill:WHITE,size:7.8})
    if(report.referencias_externas) refs.push({title:'Referências externas',body:report.referencias_externas,accent:SKY,fill:WHITE,size:6.9})
    rowCards(refs,1,3)
  }

  section('9. CONSIDERAÇÕES FINAIS E RECOMENDAÇÃO','Encaminhamento para decisão')
  ensure(18)
  doc.setFillColor(...recColor);doc.roundedRect(M,y,IW,13,4,4,'F')
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...WHITE);doc.text(recommendation.toUpperCase(),W/2,y+8.3,{align:'center'})
  y+=18

  if((report.justificativas_recomendacao||[]).length){
    rowCards((report.justificativas_recomendacao||[]).map((x,i)=>({title:`${i+1}. ${x.titulo}`,body:x.texto,accent:recColor,fill:LIGHTER,size:7.9})),1,3)
  }
  if(report.sintese_final){
    const h=textCardHeight('Em síntese',report.sintese_final,IW,8.3);ensure(h+4);textCard(M,y,IW,'Em síntese',report.sintese_final,{accent:recColor,fill:LIGHTER,size:8.3});y+=h+4
  }

  if(coach.transfermarkt_url){
    section('FONTES ESTRUTURADAS','Rastreabilidade do relatório')
    const urls=[coach.transfermarkt_url,coach.performance_url].filter(Boolean)
    rowCards(urls.map((u,i)=>({title:i===0?'Perfil Transfermarkt':'Desempenho detalhado',body:u,accent:BLUE,fill:WHITE,size:6.6})),1,3)
  }

  footer()
  const filename=`Scouting-Treinador-${String(coach.nome||'treinador').replace(/[^a-z0-9]+/gi,'-')}-Confianca.pdf`
  doc.save(filename)
}
