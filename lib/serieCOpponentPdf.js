// Parser client-side do PDF Wyscout "Relatório de Equipa" do adversário.
// O relatório é tratado como um recorte das últimas 10 partidas.
// V2 amplia a leitura: finalização/criação, bola parada, perigo contínuo,
// escudo automático e identificação robusta das páginas com títulos quebrados.
import {
  loadPdfJsClient,
  parseDefenseCorridorsFromTextItems,
  parseAttackCorridorsFromTextItems,
  parseTransitionZonesFromTextItems,
} from './serieCTeamReportSpatial'

function clean(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}
function fold(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function compactFold(value) {
  return fold(value).replace(/[^a-z0-9]+/g, '')
}
function num(value) {
  const m = clean(value).replace(',', '.').match(/<?-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0].replace('<',''))
  return Number.isFinite(n) ? n : null
}
function allNums(value) {
  return (clean(value).replace(/,/g, '.').match(/<?-?\d+(?:\.\d+)?/g) || [])
    .map(x => Number(x.replace('<','')))
    .filter(Number.isFinite)
}

function positioned(pdfjs, viewport, item) {
  try {
    const t = pdfjs.Util.transform(viewport.transform, item.transform)
    return { text:clean(item.str), x:Number(t[4]), y:Number(t[5]) }
  } catch (_) {
    return { text:clean(item?.str), x:Number(item?.transform?.[4]), y:Number(viewport.height) - Number(item?.transform?.[5]) }
  }
}

function rowsFromItems(items, viewport, pdfjs) {
  const pts = (items || []).map(i => positioned(pdfjs, viewport, i)).filter(i => i.text && Number.isFinite(i.x) && Number.isFinite(i.y))
  const rows = []
  for (const p of [...pts].sort((a,b) => a.y-b.y || a.x-b.x)) {
    let row = rows.find(r => Math.abs(r.y-p.y) <= 2.8)
    if (!row) { row={ y:p.y, items:[] }; rows.push(row) }
    row.items.push(p)
  }
  return rows.sort((a,b)=>a.y-b.y).map(r => clean(r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' '))).filter(Boolean)
}
function tokensFromItems(items) { return (items || []).map(i => clean(i?.str)).filter(Boolean) }
function pageCompact(page){ return compactFold((page?.rows || []).join(' ')) }
function pageHas(page, terms=[]){ const t=pageCompact(page); return terms.every(term=>t.includes(compactFold(term))) }
function findPage(pages, variants){
  for (const terms of variants) {
    const p=pages.find(pg=>pageHas(pg,terms))
    if (p) return p
  }
  return null
}

function extractTeamName(pages) {
  const rows = pages[0]?.rows || []
  const bad = /relat[oó]rio|hudl|wyscout|serie c|\d{2}\.\d{2}\.\d{4}/i
  const candidates = rows.filter(r => !bad.test(r) && !/\d+\s*[×x-]\s*\d+/.test(r) && /^[\p{L} .'-]{3,40}$/u.test(r))
  const count = new Map()
  candidates.forEach(r => count.set(r,(count.get(r)||0)+1))
  const repeated = [...count.entries()].sort((a,b)=>b[1]-a[1] || a[0].length-b[0].length)
  return repeated[0]?.[0] || 'Adversário'
}

function parseMatches(page, team) {
  const textRows = page?.rows || []
  const out=[]
  for (let i=0;i<textRows.length;i++) {
    const row=textRows[i]
    const m=row.match(/^(.+?)\s+(\d+)\s*[×xX]\s*(\d+)\s+(.+)$/)
    if (!m) continue
    const dateRow = textRows.slice(i, i+4).find(x => /\d{2}\.\d{2}\.\d{4}/.test(x)) || ''
    const dm = dateRow.match(/(\d{2}\.\d{2}\.\d{4})/)
    const home=clean(m[1]), away=clean(m[4]), hg=Number(m[2]), ag=Number(m[3])
    const teamFold=fold(team)
    const isHome=fold(home).includes(teamFold) || teamFold.includes(fold(home))
    const gf=isHome?hg:ag, ga=isHome?ag:hg
    out.push({ home, away, homeGoals:hg, awayGoals:ag, date:dm?.[1]||null, gf, ga, result:gf>ga?'V':gf<ga?'D':'E' })
  }
  return out.slice(0,10)
}

function parseFormations(page) {
  const tokens = page?.tokens || []
  const out=[]
  for (let i=0;i<tokens.length-1;i++) {
    if (!/^\d-\d(?:-\d){1,3}$/.test(tokens[i])) continue
    let share=null
    for (let j=i+1;j<Math.min(tokens.length,i+8);j++) {
      if (/^\d+(?:[.,]\d+)?%$/.test(tokens[j])) { share=num(tokens[j]); break }
    }
    if (share!==null && !out.some(x=>x.formation===tokens[i])) out.push({ formation:tokens[i], share })
  }
  return out.sort((a,b)=>b.share-a.share).slice(0,4)
}

function numbersAfterLabel(row,labelRegex) {
  if (!row) return []
  const m=row.match(labelRegex)
  const tail=m ? row.slice((m.index||0)+m[0].length) : row
  return allNums(tail)
}
function parseFinishRow(row,labelRegex) {
  if (!row) return null
  const n=numbersAfterLabel(row,labelRegex)
  if (n.length < 4) return null
  // Wyscout: remates / no alvo | % | xG | golos.
  // Algumas linhas (livres/pênaltis) quebram a % em outra linha; nesse caso ficam 4 números.
  if (n.length >= 5) return { shots:n[0], onTarget:n[1], onTargetPct:n[2], xg:n[3], goals:n[4] }
  return { shots:n[0], onTarget:n[1], onTargetPct:null, xg:n[2], goals:n[3] }
}

function findRow(rows, predicates){
  return rows.find(r=>predicates.some(p=>p.test(r))) || null
}

function parseFinishing(page) {
  const rows=page?.rows || []
  const totalRow = findRow(rows,[/\bTotal\b/i])
  const footRow = findRow(rows,[/Remates com o p[eé]/i])
  const headRow = findRow(rows,[/Cabeceamentos/i])
  const boxRow = findRow(rows,[/Dentro da grande [aá]rea/i])
  const outsideRow = findRow(rows,[/Fora da grande [aá]rea/i])
  const crossRow = findRow(rows,[/Ap[oó]s cruzamentos/i])
  const organizedRow = findRow(rows,[/Depois da jogada organizada/i])
  const setRow = findRow(rows,[/Livres diretos e pen[aá]ltis/i,/Livres directos e pen[aá]ltis/i])
  return {
    total:parseFinishRow(totalRow,/\bTotal\b/i),
    foot:parseFinishRow(footRow,/Remates com o p[eé]/i),
    headers:parseFinishRow(headRow,/Cabeceamentos/i),
    insideBox:parseFinishRow(boxRow,/Dentro da grande [aá]rea/i),
    outsideBox:parseFinishRow(outsideRow,/Fora da grande [aá]rea/i),
    afterCross:parseFinishRow(crossRow,/Ap[oó]s cruzamentos/i),
    organized:parseFinishRow(organizedRow,/Depois da jogada organizada/i),
    directAndPenalties:parseFinishRow(setRow,/Livres (?:diretos|directos) e pen[aá]ltis/i),
  }
}

function parsePlayerLeaders(page) {
  const rows=page?.rows || []
  const result={ finishers:[], creators:[] }
  let assistStart=rows.findIndex(r=>compactFold(r).includes('passedecisivo'))
  if (assistStart < 0) assistStart=rows.length
  for (let i=0;i<assistStart;i++) {
    const r=rows[i]
    const m=r.match(/(?:^|\s)(\d{1,2})\s+([^\d][\p{L} .'-]+?)\s+(\d{2,4})\s+(\d+)\s*\/\s*(\d+)\s+\d+(?:[.,]\d+)?%\s+([<\d.,]+)\s+(\d+)$/u)
    if (!m) continue
    result.finishers.push({ player:clean(m[2]), minutes:Number(m[3]), shots:Number(m[4]), onTarget:Number(m[5]), xg:num(m[6]), goals:Number(m[7]) })
  }
  for (let i=assistStart;i<rows.length;i++) {
    const r=rows[i]
    const m=r.match(/(?:^|\s)(\d{1,2})\s+([^\d][\p{L} .'-]+?)\s+(\d{2,4})\s+(\d+)\s+([<\d.,]+)\s+(\d+)$/u)
    if (!m) continue
    result.creators.push({ player:clean(m[2]), minutes:Number(m[3]), keyPasses:Number(m[4]), xa:num(m[5]), assists:Number(m[6]) })
  }
  result.finishers.sort((a,b)=>b.goals-a.goals || b.xg-a.xg || b.shots-a.shots)
  result.creators.sort((a,b)=>b.assists-a.assists || b.xa-a.xa || b.keyPasses-a.keyPasses)
  return { finishers:result.finishers.slice(0,8), creators:result.creators.slice(0,8) }
}

function parseRoster(page) {
  const rows=page?.rows || []
  const out=[]
  for (const r of rows) {
    const m=r.match(/^\d+\s+(.+?)\s+(GK|[LR]?(?:CB|B|WB|DMF|CMF|AMF|MF|W|CF|FW|ST|RDMF|LDMF|RCMF|LCMF|RAMF|LAMF|RWF|LWF))\s+(\d{1,2})\b/i)
    if (m) out.push({ player:clean(m[1]), position:m[2].toUpperCase(), age:Number(m[3]) })
  }
  return out
}

function sectionRows(rows,startPatterns,endPatterns=[]){
  const start=rows.findIndex(r=>startPatterns.some(p=>p.test(r)))
  if(start<0)return[]
  let end=rows.length
  for(let i=start+1;i<rows.length;i++) if(endPatterns.some(p=>p.test(rows[i]))){end=i;break}
  return rows.slice(start+1,end)
}

function parseTakers(rows){
  const out=[]
  for(const r of rows){
    let m=r.match(/^\d+\s+(.+?)\s+(Esquerda|Direita)\s+(\d+)\s+(\d+)\s+(\d+)$/i)
    if(m){out.push({player:clean(m[1]),foot:m[2],total:Number(m[3]),left:Number(m[4]),right:Number(m[5])});continue}
    m=r.match(/^\d+\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)$/)
    if(m)out.push({player:clean(m[1]),foot:null,total:Number(m[2]),left:Number(m[3]),right:Number(m[4])})
  }
  return out.sort((a,b)=>b.total-a.total).slice(0,6)
}
function parseTargets(rows){
  const out=[]
  for(const r of rows){
    const m=r.match(/^\d+\s+(.+?)\s+(\d+)\s+(\d+)\s+([<\d.,]+)\s+(\d+)$/)
    if(m)out.push({player:clean(m[1]),height:Number(m[2]),shots:Number(m[3]),xg:num(m[4]),goals:Number(m[5])})
  }
  return out.sort((a,b)=>b.goals-a.goals || b.xg-a.xg || b.shots-a.shots).slice(0,6)
}
function parseSetPieces(page){
  const rows=page?.rows||[]
  const cornerTakers=parseTakers(sectionRows(rows,[/CANTOS À ESQUERDA/i,/CANTOS A ESQUERDA/i],[/^ÚLTIMO TERÇO$/i,/CANTOS À DIREITA/i,/CANTOS A DIREITA/i]))
  const cornerTargets=parseTargets(sectionRows(rows,[/CANTOS À DIREITA/i,/CANTOS A DIREITA/i],[/Bolas paradas/i,/LIVRES À ESQUERDA/i,/LIVRES A ESQUERDA/i]))
  const freeTakers=parseTakers(sectionRows(rows,[/LIVRES À ESQUERDA/i,/LIVRES A ESQUERDA/i],[/^ÚLTIMO TERÇO$/i,/LIVRES À DIREITA/i,/LIVRES A DIREITA/i]))
  const freeTargets=parseTargets(sectionRows(rows,[/LIVRES À DIREITA/i,/LIVRES A DIREITA/i],[/RELATÓRIO DE EQUIPA/i,/BOL AS PARADA/i]))
  return {cornerTakers,cornerTargets,freeTakers,freeTargets}
}

function parseContinuousThreat(page){
  const rows=page?.rows||[]
  const out={dribblers:[],depthPassers:[],offsides:[]}
  const dStart=rows.findIndex(r=>/^Drible$/i.test(r))
  const pStart=rows.findIndex(r=>/Passe para profundidade/i.test(r))
  const oStart=rows.findIndex(r=>/Foras de jogo/i.test(r))
  const parseDribble=(from,to)=>{for(let i=from;i<to;i++){const m=rows[i].match(/^\d+\s+(.+?)\s+(\d+)'?\s+(\d+)\s+([\d.,]+)\s+(\d+)\s+(\d+)$/);if(m)out.dribblers.push({player:clean(m[1]),minutes:Number(m[2]),total:Number(m[3]),per90:num(m[4]),won:Number(m[5]),lost:Number(m[6])})}}
  const parseDepth=(from,to)=>{for(let i=from;i<to;i++){const m=rows[i].match(/^\d+\s+(.+?)\s+(\d+)'?\s+(\d+)\s+(-|\d+)\s+(-|[\d.,]+)\s+([\d.,]+)$/);if(m)out.depthPassers.push({player:clean(m[1]),minutes:Number(m[2]),total:Number(m[3]),accurate:m[4]==='-'?null:Number(m[4]),accuracy:m[5]==='-'?null:num(m[5]),per90:num(m[6])})}}
  const parseOff=(from,to)=>{for(let i=from;i<to;i++){const m=rows[i].match(/^\d+\s+(.+?)\s+(\d+)'?\s+(\d+)\s+([\d.,]+)$/);if(m)out.offsides.push({player:clean(m[1]),minutes:Number(m[2]),total:Number(m[3]),per90:num(m[4])})}}
  if(dStart>=0)parseDribble(dStart,pStart>0?pStart:rows.length)
  if(pStart>=0)parseDepth(pStart,oStart>0?oStart:rows.length)
  if(oStart>=0)parseOff(oStart,rows.length)
  out.dribblers.sort((a,b)=>b.total-a.total);out.depthPassers.sort((a,b)=>b.total-a.total);out.offsides.sort((a,b)=>b.total-a.total)
  return {dribblers:out.dribblers.slice(0,6),depthPassers:out.depthPassers.slice(0,6),offsides:out.offsides.slice(0,6)}
}

function summarizeMatches(matches) {
  const s={ played:matches.length,wins:0,draws:0,losses:0,gf:0,ga:0,points:0 }
  for (const m of matches) { s.gf+=m.gf; s.ga+=m.ga; if(m.result==='V'){s.wins++;s.points+=3}else if(m.result==='E'){s.draws++;s.points++}else s.losses++ }
  return { ...s, goalDiff:s.gf-s.ga, ppg:s.played?s.points/s.played:0, gfPerGame:s.played?s.gf/s.played:0, gaPerGame:s.played?s.ga/s.played:0 }
}

function corridorLeader(block) {
  if (!block) return null
  const pairs=[['esquerda',Number(block.esquerda)||0],['centro',Number(block.centro)||0],['direita',Number(block.direita)||0]]
  pairs.sort((a,b)=>b[1]-a[1])
  const total=pairs.reduce((s,[,v])=>s+v,0)
  return total?{ corridor:pairs[0][0], value:pairs[0][1], pct:Math.round(pairs[0][1]/total*100), total }:null
}

function buildInsights(report) {
  const s=report.summary||{}
  const finishing=report.finishing?.total
  const def=report.spatial?.defensive
  const off=report.spatial?.offensive
  const strengths=[], weaknesses=[]
  const dominant=report.formations?.[0]
  if (dominant?.share>=45) strengths.push(`Estrutura bem definida: ${dominant.formation} em ${dominant.share}% do recorte.`)
  if (s.gf>s.ga) strengths.push(`Saldo positivo nas últimas ${s.played}: ${s.gf} gols marcados e ${s.ga} sofridos.`)
  if (finishing?.xg != null && finishing?.goals != null && finishing.goals>finishing.xg) strengths.push(`Conversão acima do esperado: ${finishing.goals} gols para ${finishing.xg.toFixed(1).replace('.',',')} xG.`)
  const high= corridorLeader(off?.highRecoveries)
  if (high) strengths.push(`Pressão alta mais presente pelo corredor ${high.corridor} (${high.pct}% das recuperações altas mapeadas).`)
  if (s.gaPerGame>=1.2) weaknesses.push(`Concede ${s.gaPerGame.toFixed(2).replace('.',',')} gol/jogo no recorte.`)
  if (finishing?.shots && finishing?.goals!=null) {
    const conv=finishing.goals/finishing.shots
    if (conv<0.10) weaknesses.push(`Conversão de finalizações baixa: ${(conv*100).toFixed(1).replace('.',',')}% dos chutes viram gol.`)
  }
  const exposure=corridorLeader(def?.exposures)
  if (exposure) weaknesses.push(`Maior exposição defensiva pelo corredor ${exposure.corridor} do ataque adversário (${exposure.pct}% dos duelos perdidos mapeados).`)
  if (dominant?.share>=45) weaknesses.push(`A forte dependência do ${dominant.formation} cria um padrão estrutural previsível para preparação do jogo.`)
  return { strengths:strengths.slice(0,4), weaknesses:weaknesses.slice(0,4) }
}

async function extractCrestDataUrl(pdf){
  if(typeof document==='undefined')return null
  try{
    const page=await pdf.getPage(1)
    const viewport=page.getViewport({scale:1.6})
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    await page.render({canvasContext:ctx,viewport}).promise
    const x0=Math.floor(canvas.width*0.37),x1=Math.floor(canvas.width*0.63),y0=Math.floor(canvas.height*0.27),y1=Math.floor(canvas.height*0.40)
    const img=ctx.getImageData(x0,y0,x1-x0,y1-y0)
    let minX=img.width,minY=img.height,maxX=-1,maxY=-1
    for(let y=0;y<img.height;y+=1){for(let x=0;x<img.width;x+=1){const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2],a=img.data[i+3];const dark=(r+g+b)<660;if(a>20&&dark){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}}}
    if(maxX<minX||maxY<minY)return null
    const pad=10,minXX=Math.max(0,minX-pad),minYY=Math.max(0,minY-pad),w=Math.min(img.width-minXX,maxX-minX+pad*2),h=Math.min(img.height-minYY,maxY-minY+pad*2)
    const out=document.createElement('canvas');out.width=144;out.height=144
    const o=out.getContext('2d');o.clearRect(0,0,144,144)
    const scale=Math.min(124/w,124/h),dw=w*scale,dh=h*scale
    o.drawImage(canvas,x0+minXX,y0+minYY,w,h,(144-dw)/2,(144-dh)/2,dw,dh)
    return out.toDataURL('image/png')
  }catch(_){return null}
}

export async function extractOpponentTeamReport(fileOrBuffer) {
  const pdfjs=await loadPdfJsClient()
  const raw = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer()
  const data = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
  const pdf=await pdfjs.getDocument({ data }).promise
  const pages=[]
  let defensive=null, offensive=null, transitions=null
  for (let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++) {
    const page=await pdf.getPage(pageNumber)
    const viewport=page.getViewport({ scale:1 })
    const content=await page.getTextContent({normalizeWhitespace:true,disableCombineTextItems:false})
    const pageObj={ pageNumber, rows:rowsFromItems(content.items,viewport,pdfjs), tokens:tokensFromItems(content.items) }
    pages.push(pageObj)
    if (!defensive) {
      const p=parseDefenseCorridorsFromTextItems(content.items,viewport,pdfjs)
      if (p) defensive={
        won:{ esquerda:p.duelos_def_ganhos_esquerda, centro:p.duelos_def_ganhos_centro, direita:p.duelos_def_ganhos_direita, total:p.amostra_duelos_def_ganhos },
        exposures:{ esquerda:p.ataques_esquerda, centro:p.ataques_centro, direita:p.ataques_direita, total:p.amostra_ataques },
        aerial:{ esquerda:p.duelos_aereos_esquerda, centro:p.duelos_aereos_centro, direita:p.duelos_aereos_direita, total:p.amostra_duelos_aereos },
        page:pageNumber,
      }
    }
    if (!offensive) {
      const p=parseAttackCorridorsFromTextItems(content.items,viewport,pdfjs)
      if (p) offensive={
        crosses:{ esquerda:p.cruzamentos_esquerda, centro:p.cruzamentos_centro, direita:p.cruzamentos_direita, total:p.amostra_cruzamentos },
        dribbles:{ esquerda:p.dribles_esquerda, centro:p.dribles_centro, direita:p.dribles_direita, total:p.amostra_dribles },
        highRecoveries:{ esquerda:p.recuperacoes_altas_esquerda, centro:p.recuperacoes_altas_centro, direita:p.recuperacoes_altas_direita, total:p.amostra_recuperacoes_altas },
        page:pageNumber,
      }
    }
    if (!transitions) {
      const p=parseTransitionZonesFromTextItems(content.items,viewport,pdfjs)
      if (p) transitions={ recoveries:p.recuperacoes_zonas, losses:p.perdas_zonas, fouls:p.faltas_zonas, page:pageNumber }
    }
  }

  const team=extractTeamName(pages)
  const matches=parseMatches(pages[0],team)
  const formationPage=findPage(pages,[["formacoes"],["form acoes"]]) || pages[5] || {}
  const finishingPage=findPage(pages,[["remates","passe decisivo","total"],["finalizacao","remates"]]) || pages[19] || {}
  const setPiecePage=findPage(pages,[["cantos","livres","bolas paradas"]]) || pages[22] || {}
  const dangerPage=findPage(pages,[["drible","passe para profundidade","foras de jogo"]]) || pages[21] || {}
  const report={
    version:2,
    source:'wyscout-team-report-last10',
    team,
    crestDataUrl:await extractCrestDataUrl(pdf),
    extractedAt:new Date().toISOString(),
    matches,
    summary:summarizeMatches(matches),
    roster:parseRoster(pages[1]||{}),
    formations:parseFormations(formationPage),
    finishing:parseFinishing(finishingPage),
    playerLast10:parsePlayerLeaders(finishingPage),
    setPieces:parseSetPieces(setPiecePage),
    continuousThreat:parseContinuousThreat(dangerPage),
    spatial:{ defensive, offensive, transitions },
    sourcePages:{formation:formationPage?.pageNumber||null,finishing:finishingPage?.pageNumber||null,setPieces:setPiecePage?.pageNumber||null,danger:dangerPage?.pageNumber||null},
  }
  report.insights=buildInsights(report)
  return report
}

export async function extractOpponentTeamReportFromUrl(url) {
  const res=await fetch(url,{ cache:'no-store' })
  if (!res.ok) throw new Error('Não foi possível abrir o PDF salvo para comparação.')
  return extractOpponentTeamReport(await res.arrayBuffer())
}
