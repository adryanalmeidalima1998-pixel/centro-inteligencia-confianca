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
    if (summary.ppda <= 8 && summary.ppda < summary.opponentPpda) out.push('A equipe procura pressionar cedo, encurta o campo e tenta recuperar a posse ainda em zonas altas.')
    else if (summary.ppda >= 12) out.push('A equipe não sustenta pressão alta o tempo todo e alterna momentos de espera com acelerações para pressionar.')
  }
  if (Number.isFinite(summary.possession)) {
    if (summary.possession >= 52) out.push('Com bola, tende a assumir o controle da partida e permanecer mais tempo em organização ofensiva.')
    else if (summary.possession <= 47) out.push('Convive bem com períodos sem bola e procura ser mais objetiva quando recupera a posse.')
  }
  if (Number.isFinite(summary.xg) && Number.isFinite(summary.xga)) {
    if (summary.xg-summary.xga >= 0.35) out.push('O time consegue criar situações mais perigosas do que concede e apresenta boa capacidade de transformar domínio em ameaça real.')
    else if (summary.xg-summary.xga <= -0.35) out.push('A equipe concede chances perigosas com frequência maior do que consegue produzir, o que exige atenção ao equilíbrio defensivo.')
  }
  if (Number.isFinite(summary.boxEntries) && Number.isFinite(summary.opponentBoxEntries)) {
    if (summary.boxEntries-summary.opponentBoxEntries >= 5) out.push('Consegue sustentar presença no último terço e chegar à área adversária com regularidade.')
    else if (summary.boxEntries-summary.opponentBoxEntries <= -5) out.push('Tem dificuldade para transformar a posse em presença de área e permite que o adversário chegue com frequência ao próprio terço defensivo.')
  }
  if (Number.isFinite(summary.longPassPct) && Number.isFinite(summary.passesPerPossession)) {
    if (summary.longPassPct <= 13 && summary.passesPerPossession >= 3.2) out.push('A construção privilegia circulação e continuidade das posses antes de acelerar a progressão.')
    else if (summary.longPassPct >= 18) out.push('A equipe utiliza com frequência uma construção mais direta para ganhar território e chegar mais rápido ao ataque.')
  }
  if (Number.isFinite(summary.goalsAgainst) && summary.games > 0 && summary.goalsAgainst/summary.games <= 0.8) out.push('Defensivamente, apresenta boa capacidade para proteger a própria área e controlar o placar ao longo dos jogos.')
  return out
}

function directGameReading(game) {
  const m=game?.metricas || {}, o=game?.adversario_metricas || {}
  const parts=[]
  const finite=v=>Number.isFinite(Number(v))
  const n=v=>Number(v)
  const xgDiff=finite(m.xg)&&finite(o.xg)?n(m.xg)-n(o.xg):null
  const shotDiff=finite(m.shots)&&finite(o.shots)?n(m.shots)-n(o.shots):null
  const boxDiff=finite(m.boxEntries)&&finite(o.boxEntries)?n(m.boxEntries)-n(o.boxEntries):null

  if (xgDiff != null) {
    if (xgDiff >= 0.75) parts.push('Foi superior na criação e conseguiu chegar às situações mais claras da partida.')
    else if (xgDiff <= -0.75) parts.push('Teve dificuldade para controlar as melhores chances do adversário e ficou mais exposto defensivamente.')
    else if (shotDiff != null && shotDiff >= 5) parts.push('Conseguiu sustentar volume ofensivo, mas nem sempre transformou as finalizações em chances realmente limpas.')
    else if (shotDiff != null && shotDiff <= -5) parts.push('Passou boa parte do jogo contendo o volume ofensivo adversário e teve menos presença para finalizar.')
    else parts.push('A partida foi equilibrada na criação, sem domínio claro de um dos lados nas chances mais perigosas.')
  }

  if (finite(m.possession)) {
    if (n(m.possession) >= 58 && (boxDiff == null || boxDiff >= 0)) parts.push('Com bola, assumiu o controle do jogo e conseguiu sustentar presença no campo ofensivo.')
    else if (n(m.possession) <= 42 && xgDiff != null && xgDiff >= 0.2) parts.push('Mesmo com menos bola, foi objetivo quando atacou e conseguiu criar perigo nas chegadas.')
  }

  if (finite(m.ppda)) {
    if (n(m.ppda) <= 7.5) parts.push('Sem bola, pressionou com agressividade e procurou recuperar a posse ainda no campo adversário.')
    else if (n(m.ppda) >= 11.5) parts.push('Sem bola, alternou momentos de pressão com uma postura mais paciente e organizada.')
  }

  if (finite(m.positionalAttacks) && finite(m.counterattacks)) {
    if (n(m.positionalAttacks) >= Math.max(8, n(m.counterattacks)*2.2)) parts.push('A fase ofensiva teve maior presença de ataques organizados do que de ações em transição.')
    else if (n(m.counterattacks) >= 5 && n(m.counterattacks) >= n(m.positionalAttacks)*0.55) parts.push('As transições apareceram com frequência e foram uma via importante para acelerar o ataque.')
  }

  if (boxDiff != null && boxDiff >= 8) parts.push('Conseguiu ocupar a área adversária com frequência e manter presença constante no último terço.')
  else if (boxDiff != null && boxDiff <= -8) parts.push('Teve dificuldade para transformar as posses em presença de área e permitiu mais chegadas ao adversário.')

  if (finite(m.setPiecesShots) && n(m.setPiecesShots) >= 2) parts.push('A bola parada ofensiva teve participação relevante na criação de finalizações.')

  const unique=[]
  for (const part of parts) if (part && !unique.includes(part)) unique.push(part)
  return unique.slice(0,2).join(' ')
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
    const game={
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
    }
    game.leitura_automatica=directGameReading(game)
    games.push(game)
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
