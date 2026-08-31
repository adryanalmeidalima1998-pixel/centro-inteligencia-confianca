import * as XLSX from 'xlsx'

function norm(value='') {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function num(value) {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function round(value, digits=2) {
  if (!Number.isFinite(Number(value))) return null
  const p = 10 ** digits
  return Math.round(Number(value) * p) / p
}

function formatDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d=String(value.getDate()).padStart(2,'0'), m=String(value.getMonth()+1).padStart(2,'0')
    return `${d}/${m}/${value.getFullYear()}`
  }
  const raw=String(value).trim()
  const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const br=raw.match(/^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/)
  if (br) return `${br[1]}/${br[2]}/${br[3]}`
  return raw
}

function stripFormation(value='') {
  const raw=String(value || '').trim()
  if (!raw) return null
  return raw.replace(/\s*\([^)]*%\)\s*$/,'').trim() || null
}

function headerIndex(headers, label) {
  const target=norm(label)
  return headers.findIndex(h=>norm(h)===target)
}

function metricRow(row, idx) {
  const get=(name, offset=0)=>idx[name] >= 0 ? num(row[idx[name] + offset]) : null
  return {
    goals:get('goals'), xg:get('xg'),
    shots:get('shots'), shotsOnTarget:get('shots',1), shotsOnTargetPct:get('shots',2),
    passes:get('passes'), passesAcc:get('passes',2), possession:get('possession'),
    losses:get('losses'), lossesShort:get('losses',1), lossesMedium:get('losses',2), lossesLong:get('losses',3),
    recoveries:get('recoveries'), recoveriesShort:get('recoveries',1), recoveriesMedium:get('recoveries',2), recoveriesLong:get('recoveries',3),
    positionalAttacks:get('positionalAttacks'), positionalAttacksShots:get('positionalAttacks',1),
    counterattacks:get('counterattacks'), counterattacksShots:get('counterattacks',1),
    setPieces:get('setPieces'), setPiecesShots:get('setPieces',1),
    corners:get('corners'), cornersShots:get('corners',1),
    freeKicks:get('freeKicks'), freeKicksShots:get('freeKicks',1),
    crosses:get('crosses'), crossesAcc:get('crosses',2),
    deepCrossesReceived:get('deepCrosses'), deepPassesReceived:get('deepPasses'),
    boxEntries:get('boxEntries'), boxEntriesRuns:get('boxEntries',1), boxEntriesCrosses:get('boxEntries',2), touchesBox:get('touchesBox'),
    offensiveDuels:get('offensiveDuels'), offensiveDuelsWon:get('offensiveDuels',1), offensiveDuelsWonPct:get('offensiveDuels',2),
    shotsAgainst:get('shotsAgainst'), shotsAgainstOnTarget:get('shotsAgainst',1), shotsAgainstOnTargetPct:get('shotsAgainst',2),
    defensiveDuels:get('defensiveDuels'), defensiveDuelsWon:get('defensiveDuels',1), defensiveDuelsWonPct:get('defensiveDuels',2),
    aerialDuels:get('aerialDuels'), aerialDuelsWon:get('aerialDuels',1), aerialDuelsWonPct:get('aerialDuels',2),
    tackles:get('tackles'), tacklesWon:get('tackles',1), tacklesWonPct:get('tackles',2),
    interceptions:get('interceptions'), clearances:get('clearances'), fouls:get('fouls'), yellowCards:get('yellowCards'), redCards:get('redCards'),
    finalThirdPasses:get('finalThirdPasses'), finalThirdPassesAcc:get('finalThirdPasses',2),
    progressivePasses:get('progressivePasses'), progressivePassesAcc:get('progressivePasses',2),
    smartPasses:get('smartPasses'), smartPassesAcc:get('smartPasses',2),
    gameIntensity:get('gameIntensity'), passesPerPossession:get('passesPerPossession'), longPassPct:get('longPassPct'),
    shotDistance:get('shotDistance'), averagePassLength:get('averagePassLength'), ppda:get('ppda')
  }
}

function avg(list, key) {
  const values=list.map(x=>x?.[key]).filter(v=>Number.isFinite(Number(v))).map(Number)
  if (!values.length) return null
  return round(values.reduce((a,b)=>a+b,0)/values.length, 2)
}

function result(team, opp) {
  const gf=Number(team?.goals), ga=Number(opp?.goals)
  if (!Number.isFinite(gf) || !Number.isFinite(ga)) return null
  return gf>ga?'V':gf<ga?'D':'E'
}

function deterministicInsights(summary) {
  const out=[]
  if (Number.isFinite(summary.ppda) && Number.isFinite(summary.opponentPpda)) {
    if (summary.ppda <= 8 && summary.ppda < summary.opponentPpda) out.push(`Pressão sem bola: PPDA médio ${summary.ppda}, inferior ao dos adversários (${summary.opponentPpda}), indício quantitativo de maior intensidade de pressão.`)
    else if (summary.ppda >= 12) out.push(`Pressão sem bola: PPDA médio ${summary.ppda}, sugerindo menor frequência de pressão alta sustentada no recorte importado.`)
  }
  if (Number.isFinite(summary.possession)) {
    if (summary.possession >= 52) out.push(`Controle territorial: posse média de ${summary.possession}%, com tendência a maior volume de bola no recorte.`)
    else if (summary.possession <= 47) out.push(`Controle territorial: posse média de ${summary.possession}%, sugerindo maior convivência sem bola e possibilidade de modelo mais reativo.`)
  }
  if (Number.isFinite(summary.xg) && Number.isFinite(summary.xga)) {
    const diff=round(summary.xg-summary.xga,2)
    out.push(`Produção de chances: xG médio ${summary.xg} x ${summary.xga} do adversário (${diff>=0?'+':''}${diff} de saldo de xG).`)
  }
  if (Number.isFinite(summary.boxEntries) && Number.isFinite(summary.opponentBoxEntries)) {
    const diff=round(summary.boxEntries-summary.opponentBoxEntries,1)
    out.push(`Último terço: ${summary.boxEntries} entradas médias na área contra ${summary.opponentBoxEntries} dos adversários (${diff>=0?'+':''}${diff}).`)
  }
  if (Number.isFinite(summary.longPassPct) && Number.isFinite(summary.passesPerPossession)) {
    if (summary.longPassPct <= 13 && summary.passesPerPossession >= 3.2) out.push(`Construção: ${summary.passesPerPossession} passes por posse e ${summary.longPassPct}% de passe longo, indício de circulação mais apoiada do que direta.`)
    else if (summary.longPassPct >= 18) out.push(`Construção: ${summary.longPassPct}% de passe longo, indício de maior uso de jogo direto no recorte.`)
  }
  if (Number.isFinite(summary.goalsAgainst) && summary.games > 0) {
    const ga=round(summary.goalsAgainst/summary.games,2)
    if (ga <= 0.8) out.push(`Solidez defensiva: ${ga} gol sofrido por jogo no recorte importado.`)
  }
  return out
}

function similarClub(a,b) {
  const x=norm(a), y=norm(b)
  if (!x || !y) return false
  return x===y || x.includes(y) || y.includes(x)
}

export function parseWyscoutTeamStats(buffer, coachClub='') {
  const wb=XLSX.read(buffer,{type:'buffer',cellDates:true})
  const sheetName=wb.SheetNames.find(n=>/team\s*stats/i.test(n)) || wb.SheetNames[0]
  if (!sheetName) throw new Error('A planilha não contém nenhuma aba legível.')
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true})
  if (!rows?.length) throw new Error('A planilha está vazia.')
  const headers=rows[0] || []
  const idx={
    date:headerIndex(headers,'Data'), game:headerIndex(headers,'Jogo'), competition:headerIndex(headers,'Competição'), duration:headerIndex(headers,'Duração'), team:headerIndex(headers,'Equipa'), formation:headerIndex(headers,'Sistema'),
    goals:headerIndex(headers,'Golos'), xg:headerIndex(headers,'Golos esperados'), shots:headerIndex(headers,'Remates / à baliza'), passes:headerIndex(headers,'Passes / certos'), possession:headerIndex(headers,'Posse, %'),
    losses:headerIndex(headers,'Perdas / curto/ médio / longo'), recoveries:headerIndex(headers,'Recuperações / curto / médio / longo'), positionalAttacks:headerIndex(headers,'Ataques posicionais / com remates'), counterattacks:headerIndex(headers,'Contra-ataques / com remates'),
    setPieces:headerIndex(headers,'Bolas paradas / com remates'), corners:headerIndex(headers,'Cantos / com remates'), freeKicks:headerIndex(headers,'Pontapés livre / com remates'), crosses:headerIndex(headers,'Cruzamentos / certos'), deepCrosses:headerIndex(headers,'Cruzamentos em profundidade recebidos'), deepPasses:headerIndex(headers,'Passes em profundidade recebidos'), boxEntries:headerIndex(headers,'Entradas na grande área (corridas/cruzamentos)'), touchesBox:headerIndex(headers,'Toques na área'),
    offensiveDuels:headerIndex(headers,'Duelos ofensivos / ganhos'), shotsAgainst:headerIndex(headers,'Remates contra / no alvo'), defensiveDuels:headerIndex(headers,'Duelos defensivos / ganhos'), aerialDuels:headerIndex(headers,'Duelos aéreos / ganhos'), tackles:headerIndex(headers,'Carrinhos / bem sucedidos'), interceptions:headerIndex(headers,'Interseções,'), clearances:headerIndex(headers,'Alívios'), fouls:headerIndex(headers,'Faltas'), yellowCards:headerIndex(headers,'Cartões amarelos'), redCards:headerIndex(headers,'Cartões vermelhos'),
    finalThirdPasses:headerIndex(headers,'Passes para terço final / certos'), progressivePasses:headerIndex(headers,'Passes progressivos / precisos'), smartPasses:headerIndex(headers,'Passes inteligentes / certos'), gameIntensity:headerIndex(headers,'Intensidade de jogo'), passesPerPossession:headerIndex(headers,'Média de passes por posse'), longPassPct:headerIndex(headers,'% de passe longo'), shotDistance:headerIndex(headers,'Distância média do remate'), averagePassLength:headerIndex(headers,'Comprimento médio de passes'), ppda:headerIndex(headers,'PPDA')
  }
  for (const key of ['date','game','competition','team','formation','goals']) if (idx[key] < 0) throw new Error(`Formato Wyscout não reconhecido: coluna "${key}" ausente.`)

  const teamHint=String(rows[1]?.[0] || coachClub || '').trim()
  const dataRows=rows.slice(1).filter(r=>r && r[idx.date] && r[idx.game] && r[idx.team])
  const groups=new Map()
  for (const row of dataRows) {
    const key=`${formatDate(row[idx.date])}|${String(row[idx.game]).trim()}`
    if (!groups.has(key)) groups.set(key,[])
    groups.get(key).push(row)
  }

  const games=[]
  for (const groupRows of groups.values()) {
    if (!groupRows.length) continue
    let teamRow=groupRows.find(r=>similarClub(r[idx.team],teamHint))
    if (!teamRow && coachClub) teamRow=groupRows.find(r=>similarClub(r[idx.team],coachClub))
    if (!teamRow && groupRows.length===2) teamRow=groupRows[0]
    if (!teamRow) continue
    const oppRow=groupRows.find(r=>r!==teamRow) || null
    const teamMetrics=metricRow(teamRow,idx)
    const opponentMetrics=oppRow ? metricRow(oppRow,idx) : {}
    games.push({
      data:formatDate(teamRow[idx.date]),
      jogo:String(teamRow[idx.game] || '').trim(),
      competicao:String(teamRow[idx.competition] || '').trim(),
      duracao:num(teamRow[idx.duration]),
      equipe:String(teamRow[idx.team] || teamHint || coachClub || '').trim(),
      adversario:oppRow ? String(oppRow[idx.team] || '').trim() : '',
      sistema:stripFormation(teamRow[idx.formation]),
      sistema_raw:String(teamRow[idx.formation] || '').trim(),
      resultado:result(teamMetrics,opponentMetrics),
      metricas:teamMetrics,
      adversario_metricas:opponentMetrics
    })
  }

  if (!games.length) throw new Error('Nenhum jogo válido foi encontrado na planilha Team Stats.')
  games.sort((a,b)=>{
    const pa=String(a.data||'').split('/').reverse().join('-'), pb=String(b.data||'').split('/').reverse().join('-')
    return pb.localeCompare(pa)
  })

  const teamMetrics=games.map(g=>g.metricas)
  const oppMetrics=games.map(g=>g.adversario_metricas)
  const wins=games.filter(g=>g.resultado==='V').length, draws=games.filter(g=>g.resultado==='E').length, losses=games.filter(g=>g.resultado==='D').length
  const summary={
    games:games.length, wins, draws, losses,
    pointsPerGame:round((wins*3+draws)/games.length,2),
    goals:games.reduce((s,g)=>s+(Number(g.metricas?.goals)||0),0),
    goalsAgainst:games.reduce((s,g)=>s+(Number(g.adversario_metricas?.goals)||0),0),
    xg:avg(teamMetrics,'xg'), xga:avg(oppMetrics,'xg'), shots:avg(teamMetrics,'shots'), opponentShots:avg(oppMetrics,'shots'),
    shotsOnTarget:avg(teamMetrics,'shotsOnTarget'), opponentShotsOnTarget:avg(oppMetrics,'shotsOnTarget'), possession:avg(teamMetrics,'possession'), opponentPossession:avg(oppMetrics,'possession'),
    passAccuracy:avg(teamMetrics,'passesAcc'), opponentPassAccuracy:avg(oppMetrics,'passesAcc'), losses:avg(teamMetrics,'losses'), recoveries:avg(teamMetrics,'recoveries'),
    positionalAttacks:avg(teamMetrics,'positionalAttacks'), counterattacks:avg(teamMetrics,'counterattacks'), setPieces:avg(teamMetrics,'setPieces'),
    boxEntries:avg(teamMetrics,'boxEntries'), opponentBoxEntries:avg(oppMetrics,'boxEntries'), touchesBox:avg(teamMetrics,'touchesBox'), opponentTouchesBox:avg(oppMetrics,'touchesBox'),
    finalThirdPasses:avg(teamMetrics,'finalThirdPasses'), progressivePasses:avg(teamMetrics,'progressivePasses'),
    ppda:avg(teamMetrics,'ppda'), opponentPpda:avg(oppMetrics,'ppda'), gameIntensity:avg(teamMetrics,'gameIntensity'), passesPerPossession:avg(teamMetrics,'passesPerPossession'), longPassPct:avg(teamMetrics,'longPassPct')
  }
  summary.xgDiff=round((summary.xg||0)-(summary.xga||0),2)
  summary.shotDiff=round((summary.shots||0)-(summary.opponentShots||0),2)
  summary.boxEntryDiff=round((summary.boxEntries||0)-(summary.opponentBoxEntries||0),2)

  const formationMap=new Map()
  for (const g of games) if (g.sistema) formationMap.set(g.sistema,(formationMap.get(g.sistema)||0)+1)
  const formations=[...formationMap.entries()].sort((a,b)=>b[1]-a[1]).map(([sistema,jogos])=>({sistema,jogos,percentual:round(jogos/games.length*100,1)}))

  return {
    fonte:'Wyscout Team Stats',
    aba:sheetName,
    equipe:teamHint || games[0]?.equipe || coachClub || '',
    jogos:games,
    resumo:summary,
    formacoes:formations,
    insights:deterministicInsights(summary)
  }
}

export function matchWyscoutToCoachGames(wyscoutGames=[], coachGames=[]) {
  const normDate=(v)=>formatDate(v)
  return wyscoutGames.map(ws=>{
    const match=coachGames.find(g=>{
      if (normDate(g.data)!==normDate(ws.data)) return false
      const names=[g.mandante,g.visitante].map(norm)
      return names.some(n=>n && (n.includes(norm(ws.equipe)) || norm(ws.equipe).includes(n))) && (!ws.adversario || names.some(n=>n && (n.includes(norm(ws.adversario)) || norm(ws.adversario).includes(n))))
    }) || coachGames.find(g=>normDate(g.data)===normDate(ws.data))
    return {...ws, game_id:match?.id ? Number(match.id) : null}
  })
}
