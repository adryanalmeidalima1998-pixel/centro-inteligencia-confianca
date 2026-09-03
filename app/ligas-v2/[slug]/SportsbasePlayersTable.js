'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import {
  METRIC_GROUPS,
  METRIC_TYPE_LABELS,
  SPORTSBASE_POSITION_GROUPS,
  SPORTSBASE_CORE_METRICS,
  calculateSportsbasePercentile,
  formatSportsbaseMetric,
  getMetricEligibility,
  getSportsbaseMetric,
  getSportsbaseMetricGroup,
  getSportsbasePositionGroup,
  resolveMetricMinimumMinutes,
} from '@/data/sportsbase-map'
import { playerProfilePath } from '@/data/player-route'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot, playerFootLabel } from '@/data/player-foot'
import { WYSCOUT_GROUP_LABELS, WYSCOUT_SERIE_D_METRICS } from '@/data/wyscout-seried'
import WyscoutPlayersTable from './WyscoutPlayersTable'
import PlayerMaterialLinks from '@/app/components/ligas/PlayerMaterialLinks'

const BRAND_PRIMARY = '#0a66b7'

function canonicalPlayerPath(slug, player) {
  return player?._canonical_id ? `/database/${player._canonical_id}` : playerProfilePath(slug, player)
}

const POS_COLORS = {
  GK:{bg:'#fef3c7',color:'#92400e'}, CB:{bg:'#dbeafe',color:'#1e40af'}, LCB:{bg:'#dbeafe',color:'#1e40af'}, RCB:{bg:'#dbeafe',color:'#1e40af'},
  LB:{bg:'#dbeafe',color:'#1e40af'}, RB:{bg:'#dbeafe',color:'#1e40af'}, LWB:{bg:'#dbeafe',color:'#1e40af'}, RWB:{bg:'#dbeafe',color:'#1e40af'},
  DMF:{bg:'#ede9fe',color:'#6d28d9'}, CMF:{bg:'#d1fae5',color:'#065f46'}, CDM:{bg:'#ede9fe',color:'#6d28d9'}, LCDM:{bg:'#ede9fe',color:'#6d28d9'},
  RCDM:{bg:'#ede9fe',color:'#6d28d9'}, LDM:{bg:'#ede9fe',color:'#6d28d9'}, RDM:{bg:'#ede9fe',color:'#6d28d9'}, LCM:{bg:'#d1fae5',color:'#065f46'}, RCM:{bg:'#d1fae5',color:'#065f46'},
  AMF:{bg:'#d1fae5',color:'#065f46'}, CAM:{bg:'#d1fae5',color:'#065f46'}, LCAM:{bg:'#d1fae5',color:'#065f46'}, RCAM:{bg:'#d1fae5',color:'#065f46'}, LM:{bg:'#d1fae5',color:'#065f46'}, RM:{bg:'#d1fae5',color:'#065f46'},
  LWF:{bg:'#fce7f3',color:'#9d174d'}, RWF:{bg:'#fce7f3',color:'#9d174d'}, LW:{bg:'#fce7f3',color:'#9d174d'}, RW:{bg:'#fce7f3',color:'#9d174d'}, LAM:{bg:'#fce7f3',color:'#9d174d'}, RAM:{bg:'#fce7f3',color:'#9d174d'},
  CF:{bg:'#fee2e2',color:'#991b1b'}, LCF:{bg:'#fee2e2',color:'#991b1b'}, RCF:{bg:'#fee2e2',color:'#991b1b'}, SS:{bg:'#fee2e2',color:'#991b1b'},
}

function PositionBadge({ posicao }) {
  if (!posicao) return <span style={{ fontSize:10, color:'#94a3b8' }}>—</span>
  return (
    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
      {String(posicao).split(',').map(item => item.trim()).filter(Boolean).slice(0,2).map(item => {
        const style = POS_COLORS[item] || { bg:'#f1f5f9', color:'#64748b' }
        return <span key={item} style={{ fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:4, background:style.bg, color:style.color }}>{item}</span>
      })}
    </div>
  )
}

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function SampleBadge({ player, effectiveMinimum, attempts, minimumAttempts }) {
  const minutes = Number(player?.minutos) || 0
  let label = 'Baixa'
  let background = '#fff7ed'
  let color = '#c2410c'
  if (minutes >= Math.max(900, effectiveMinimum * 1.75)) {
    label = 'Alta'; background = '#dcfce7'; color = '#15803d'
  } else if (minutes >= effectiveMinimum && (!minimumAttempts || attempts >= minimumAttempts * 2)) {
    label = 'Média'; background = '#fef9c3'; color = '#a16207'
  }
  return <span style={{ fontSize:9, fontWeight:800, borderRadius:999, padding:'3px 7px', background, color }}>{label}</span>
}

function MetricTypeBadge({ metric }) {
  const colors = {
    total:['#f1f5f9','#475569'], per90:['#ede9fe','#6d28d9'], percent:['#dbeafe','#1d4ed8'],
    distribution:['#cffafe','#0e7490'], index:['#dcfce7','#15803d'],
  }
  const [background,color] = colors[metric?.type] || colors.total
  return <span style={{ fontSize:9, fontWeight:900, letterSpacing:'.04em', padding:'3px 7px', borderRadius:999, background, color }}>{METRIC_TYPE_LABELS[metric?.type] || metric?.type}</span>
}

function buildScoutingInsights(player, metric, percentile, pairedMetric, pairedPercentile, effectiveMinimum) {
  const insights = []
  const value = formatSportsbaseMetric(player?.[metric.key], metric)
  if (percentile >= 85) {
    insights.push({ tone:'positive', text:`Destaque estatístico em ${metric.label}: ${value}, percentil ${percentile} no contexto selecionado.` })
  } else if (percentile <= 20) {
    insights.push({ tone:'attention', text:`Produção baixa em ${metric.label} no recorte. Verificar função, modelo de jogo e qualidade das oportunidades.` })
  } else {
    insights.push({ tone:'neutral', text:`Desempenho intermediário em ${metric.label} (P${percentile}). O vídeo deve definir se o número atende à função observada.` })
  }

  if (pairedMetric && Number.isFinite(pairedPercentile)) {
    const currentIsEfficiency = ['percent','distribution'].includes(metric.type)
    const volumePct = currentIsEfficiency ? pairedPercentile : percentile
    const efficiencyPct = currentIsEfficiency ? percentile : pairedPercentile
    if (volumePct >= 75 && efficiencyPct >= 75) {
      insights.push({ tone:'positive', text:'Combina volume e eficiência. Priorizar ações completas em vídeo para validar repetibilidade, oposição e tomada de decisão.' })
    } else if (volumePct >= 75 && efficiencyPct <= 35) {
      insights.push({ tone:'attention', text:'Volume alto com eficiência baixa. Observar seleção da ação, nível de risco e perdas geradas pelas tentativas.' })
    } else if (volumePct <= 35 && efficiencyPct >= 75) {
      insights.push({ tone:'neutral', text:'Eficiência alta em baixo volume. Verificar se a limitação vem da função, do modelo coletivo ou de pouca iniciativa.' })
    }
  }

  if ((Number(player?.minutos) || 0) < Math.max(700, effectiveMinimum * 1.4)) {
    insights.push({ tone:'attention', text:'Amostra ainda moderada. Não fechar avaliação sem sequência de jogos completos e análise contextual.' })
  }
  return insights.slice(0,4)
}

function QuadrantTooltip({ active, payload, xMetric, yMetric }) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  return (
    <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:10, padding:'10px 12px', boxShadow:'0 10px 30px rgba(15,23,42,.12)', minWidth:190 }}>
      <p style={{ fontSize:12, fontWeight:900, color:'#10233b' }}>{item.nome}</p>
      <p style={{ fontSize:10, color:'#64748b', marginBottom:7 }}>{item.equipa} · {item.posicao} · {Math.round(item.minutos)} min</p>
      <p style={{ fontSize:11, color:'#334155' }}>{xMetric.label}: <b>{formatSportsbaseMetric(item.x, xMetric)}</b></p>
      <p style={{ fontSize:11, color:'#334155' }}>{yMetric.label}: <b>{formatSportsbaseMetric(item.y, yMetric)}</b></p>
    </div>
  )
}

function PlayerDrawer({ player, metric, metricGroup, rankedPool, effectiveMinimum, slug, focos, onClose }) {
  const [status, setStatus] = useState('')
  const [focoId, setFocoId] = useState('')
  const current = rankedPool.find(item => item.nome === player.nome && item.equipa === player.equipa) || player
  const pairedMetric = metric.pairedMetricKey ? getSportsbaseMetric(metric.pairedMetricKey) : null
  const pairedPool = pairedMetric
    ? rankedPool.filter(item => Number.isFinite(Number(item[pairedMetric.key])))
    : []
  const pairedPercentile = pairedMetric
    ? calculateSportsbasePercentile(current[pairedMetric.key], pairedPool.map(item=>item[pairedMetric.key]), pairedMetric.higherIsBetter)
    : null
  const insights = buildScoutingInsights(current, metric, current._percentile, pairedMetric, pairedPercentile, effectiveMinimum)

  const metricHighlights = metricGroup.metricas
    .map(item => {
      const eligible = getMetricEligibility(current, item, { players: rankedPool, selectedMinimum:'auto' }).eligible
      const pool = rankedPool.filter(candidate => getMetricEligibility(candidate, item, { players: rankedPool, selectedMinimum:'auto' }).eligible)
      if (!eligible || !pool.length) return null
      return {
        ...item,
        percentile: calculateSportsbasePercentile(current[item.key], pool.map(candidate=>candidate[item.key]), item.higherIsBetter),
      }
    })
    .filter(Boolean)
    .sort((a,b)=>b.percentile-a.percentile)
    .slice(0,5)

  const addWatchlist = async () => {
    setStatus('Salvando na Watchlist...')
    try {
      const res = await fetch('/api/lista-preferencial', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          jogador:current.nome, clube:current.equipa, posicao:current.posicao, idade:current.idade || null,
          nacionalidade:current.pais || null, altura:current.altura || null, pe_preferido:current.pe || null, prioridade:'Média', origem:'Triagem Sportsbase',
          observacoes:`Triagem de dados: ${metric.label} ${formatSportsbaseMetric(current[metric.key], metric)} · P${current._percentile} · ${Math.round(current.minutos||0)} min.`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setStatus('✓ Adicionado à Watchlist')
    } catch (error) { setStatus(`✗ ${error.message}`) }
  }

  const sendToVideo = async () => {
    if (!focoId) return setStatus('Selecione um foco de recrutamento.')
    setStatus('Enviando para análise em vídeo...')
    try {
      const res = await fetch('/api/candidatos-pipeline', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          foco_id:Number(focoId), jogador:current.nome, clube:current.equipa, posicao:current.posicao,
          liga:slug, pe:current.pe || null, idade:current.idade || null, minutos:Math.round(current.minutos || 0),
          etapa:'Análise em vídeo', fonte:current._fonte || 'sportsbase', nacionalidade:current.pais || null, altura:current.altura || null,
          fit_score:current._percentile,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar')
      setStatus('✓ Enviado para Análise em vídeo')
    } catch (error) { setStatus(`✗ ${error.message}`) }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(15,23,42,.45)', display:'flex', justifyContent:'flex-end' }} onClick={onClose}>
      <aside style={{ width:'min(520px, 100vw)', height:'100%', overflowY:'auto', background:'#f8fbf9', boxShadow:'-15px 0 45px rgba(15,23,42,.18)', padding:22 }} onClick={event=>event.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:18 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}><PositionBadge posicao={current.posicao}/><SampleBadge player={current} effectiveMinimum={effectiveMinimum}/></div>
            <h3 style={{ fontSize:21, fontWeight:950, color:'#153526', lineHeight:1.15 }}>{current.nome}</h3>
            <p style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{current.equipa} · {current.idade || '—'} anos · {Math.round(current.minutos || 0)} min · {current.jogos || '—'} jogos</p>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:10, border:'1px solid #dbe7f2', background:'#fff', cursor:'pointer', fontSize:18 }}>×</button>
        </div>

        <PlayerMaterialLinks slug={slug} player={current} />

        <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:14, padding:16, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
            <div><p style={{ fontSize:10, fontWeight:900, color:'#64748b', textTransform:'uppercase' }}>Métrica ativa</p><p style={{ fontSize:15, fontWeight:900, color:'#10233b', marginTop:3 }}>{metric.label}</p></div>
            <MetricTypeBadge metric={metric}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:12 }}>
            <div style={{ background:'#f8fdf9', borderRadius:10, padding:10 }}><p style={{ fontSize:9, color:'#64748b' }}>VALOR</p><p style={{ fontSize:20, fontWeight:950, color:BRAND_PRIMARY }}>{formatSportsbaseMetric(current[metric.key], metric)}</p></div>
            <div style={{ background:'#f8fdf9', borderRadius:10, padding:10 }}><p style={{ fontSize:9, color:'#64748b' }}>PERCENTIL</p><p style={{ fontSize:20, fontWeight:950, color:BRAND_PRIMARY }}>P{current._percentile}</p></div>
            <div style={{ background:'#f8fdf9', borderRadius:10, padding:10 }}><p style={{ fontSize:9, color:'#64748b' }}>RANKING</p><p style={{ fontSize:20, fontWeight:950, color:BRAND_PRIMARY }}>#{current._rank}</p></div>
          </div>
          {metric.denominatorKey && <p style={{ fontSize:10, color:'#64748b', marginTop:9 }}>Base: {current[metric.denominatorKey] || 0} {metric.denominatorLabel} · mínimo exigido: {metric.minAttempts}</p>}
        </div>

        <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:14, padding:16, marginBottom:12 }}>
          <p style={{ fontSize:11, fontWeight:900, color:'#10233b', marginBottom:10 }}>Leitura para scouting</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {insights.map((insight,index) => {
              const style = insight.tone === 'positive' ? ['#f0fdf4','#15803d'] : insight.tone === 'attention' ? ['#fff7ed','#c2410c'] : ['#f8fafc','#475569']
              return <p key={index} style={{ fontSize:11, lineHeight:1.55, padding:'9px 10px', borderRadius:9, background:style[0], color:style[1] }}>{insight.text}</p>
            })}
          </div>
        </div>

        <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:14, padding:16, marginBottom:12 }}>
          <p style={{ fontSize:11, fontWeight:900, color:'#10233b', marginBottom:10 }}>Melhores sinais no bloco</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            {metricHighlights.map(item=><div key={item.key} style={{ background:'#f8fdf9', borderRadius:9, padding:9 }}><p style={{ fontSize:9, color:'#64748b' }}>{item.label}</p><p style={{ fontSize:12, fontWeight:900, color:'#10233b' }}>{formatSportsbaseMetric(current[item.key], item)} · P{item.percentile}</p></div>)}
          </div>
        </div>

        <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:14, padding:16 }}>
          <p style={{ fontSize:11, fontWeight:900, color:'#10233b', marginBottom:10 }}>Próxima ação</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Link href={canonicalPlayerPath(slug, current)} style={{ textAlign:'center', textDecoration:'none', borderRadius:9, padding:'10px 12px', background:BRAND_PRIMARY, color:'#fff', fontSize:11, fontWeight:800 }}>📊 Perfil completo</Link>
            <button onClick={addWatchlist} style={{ border:'none', borderRadius:9, padding:'10px 12px', background:'#eaf4fd', color:BRAND_PRIMARY, fontSize:11, fontWeight:800, cursor:'pointer' }}>⭐ Watchlist</button>
            <Link href={`/comparacao?nome=${encodeURIComponent(current.nome)}&equipa=${encodeURIComponent(current.equipa || '')}&liga=${encodeURIComponent(slug)}`} style={{ textAlign:'center', textDecoration:'none', borderRadius:9, padding:'10px 12px', background:'#eef2ff', color:'#4338ca', fontSize:11, fontWeight:800 }}>⚖️ Comparar</Link>
            <Link href={`/lista-final?nome=${encodeURIComponent(current.nome)}`} style={{ textAlign:'center', textDecoration:'none', borderRadius:9, padding:'10px 12px', background:'#fef3c7', color:'#92400e', fontSize:11, fontWeight:800 }}>📋 Lista Final</Link>
          </div>
          <div style={{ display:'flex', gap:7, marginTop:9 }}>
            <select value={focoId} onChange={event=>setFocoId(event.target.value)} style={{ flex:1, border:'1px solid #dbe7f2', borderRadius:9, padding:'9px 10px', fontSize:11, background:'#fff' }}>
              <option value="">Selecionar foco de recrutamento</option>
              {focos.filter(foco=>foco.status==='Ativo').map(foco=><option key={foco.id} value={foco.id}>{foco.nome}</option>)}
            </select>
            <button onClick={sendToVideo} style={{ border:'1px solid #d97706', borderRadius:9, padding:'9px 11px', background:'#fff7ed', color:'#b45309', fontSize:11, fontWeight:800, cursor:'pointer' }}>🎥 Enviar p/ vídeo</button>
          </div>
          {status && <p style={{ fontSize:10, fontWeight:700, color:status.startsWith('✓')?BRAND_PRIMARY:status.startsWith('✗')?'#dc2626':'#64748b', marginTop:8 }}>{status}</p>}
        </div>
      </aside>
    </div>
  )
}


function sanitizeFileName(value) {
  return String(value || 'sportsbase')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function rankMetricPlayers(players, metric, context = 'ALL', exactPosition = '', selectedMinimum = 'auto', foot = '') {
  const contextPlayers = players.filter(player => {
    if (context !== 'ALL' && getSportsbasePositionGroup(player.posicao) !== context) return false
    if (foot && !matchesPlayerFoot(player, foot)) return false
    if (exactPosition && !String(player.posicao || '').split(',').map(item=>item.trim()).includes(exactPosition)) return false
    return true
  })
  const eligible = contextPlayers.filter(player => getMetricEligibility(player, metric, { players:contextPlayers, selectedMinimum }).eligible)
  const values = eligible.map(player=>player[metric.key])
  const ranking = eligible.map(player=>({
    ...player,
    _percentile:calculateSportsbasePercentile(player[metric.key], values, metric.higherIsBetter),
  })).sort((a,b)=>metric.higherIsBetter?Number(b[metric.key])-Number(a[metric.key]):Number(a[metric.key])-Number(b[metric.key]))
  return {
    ranking:ranking.slice(0,5).map((player,index)=>({ ...player, _rank:index+1 })),
    total:ranking.length,
    effectiveMinimum:resolveMetricMinimumMinutes(metric, contextPlayers, selectedMinimum),
    contextPlayers,
  }
}

function canvasRoundRect(ctx,x,y,w,h,r=12) {
  const radius=Math.min(r,w/2,h/2)
  ctx.beginPath()
  ctx.moveTo(x+radius,y)
  ctx.arcTo(x+w,y,x+w,y+h,radius)
  ctx.arcTo(x+w,y+h,x,y+h,radius)
  ctx.arcTo(x,y+h,x,y,radius)
  ctx.arcTo(x,y,x+w,y,radius)
  ctx.closePath()
}

function canvasText(ctx,text,x,y,maxWidth,font,fillStyle,align='left') {
  ctx.font=font
  ctx.fillStyle=fillStyle
  ctx.textAlign=align
  const value=String(text ?? '')
  if(ctx.measureText(value).width<=maxWidth){ctx.fillText(value,x,y);return}
  let shortened=value
  while(shortened.length>2&&ctx.measureText(`${shortened}…`).width>maxWidth) shortened=shortened.slice(0,-1)
  ctx.fillText(`${shortened}…`,x,y)
}

function drawCanvasReportHeader(ctx,width,title,subtitle) {
  ctx.fillStyle='#064b82';ctx.fillRect(0,0,width,116)
  canvasText(ctx,'CIC · CONFIANÇA',54,38,width-108,'700 18px Arial','#b7e4c7')
  canvasText(ctx,title,54,77,width-108,'900 32px Arial','#ffffff')
  canvasText(ctx,subtitle,54,103,width-108,'500 15px Arial','rgba(255,255,255,.75)')
}

function getExportPairedText(player,item) {
  if (!item.pairedMetric) return ''
  const eligible=getMetricEligibility(player,item.pairedMetric,{players:item.contextPlayers||[],selectedMinimum:item.selectedMinimum??'auto'}).eligible
  return eligible ? `${item.pairedMetric.label}: ${formatSportsbaseMetric(player[item.pairedMetric.key],item.pairedMetric)}` : `${item.pairedMetric.label}: amostra insuficiente`
}

function drawCanvasTopFiveBlock(ctx,item,x,y,width,height) {
  const color=item.group?.cor||BRAND_PRIMARY
  ctx.fillStyle='#ffffff';canvasRoundRect(ctx,x,y,width,height,18);ctx.fill()
  ctx.strokeStyle='#dbe7f2';ctx.lineWidth=2;ctx.stroke()
  ctx.fillStyle=color;canvasRoundRect(ctx,x,y,width,68,18);ctx.fill()
  ctx.fillRect(x,y+34,width,34)
  canvasText(ctx,item.metric.label,x+24,y+31,width-250,'900 22px Arial','#ffffff')
  canvasText(ctx,METRIC_TYPE_LABELS[item.metric.type]||item.metric.type,x+width-24,y+31,210,'900 13px Arial','rgba(255,255,255,.82)','right')
  canvasText(ctx,`${item.contextLabel} · mínimo ${item.effectiveMinimum} min${item.metric.denominatorKey?` · ${item.metric.minAttempts} ${item.metric.denominatorLabel}`:''} · ${item.total} elegíveis`,x+24,y+55,width-48,'500 13px Arial','rgba(255,255,255,.78)')

  const rowHeight=(height-84)/5
  for(let index=0;index<5;index++){
    const player=item.ranking[index]
    const rowY=y+76+index*rowHeight
    ctx.fillStyle=index%2===0?'#f8fdf9':'#ffffff';ctx.fillRect(x+1,rowY,width-2,rowHeight)
    ctx.fillStyle=index===0?color:'#e8f4ec';ctx.beginPath();ctx.arc(x+35,rowY+rowHeight/2,18,0,Math.PI*2);ctx.fill()
    canvasText(ctx,index+1,x+35,rowY+rowHeight/2+6,30,'900 17px Arial',index===0?'#ffffff':BRAND_PRIMARY,'center')
    if(!player){canvasText(ctx,'Sem jogador elegível',x+70,rowY+rowHeight/2+5,width-100,'700 16px Arial','#94a3b8');continue}
    canvasText(ctx,player.nome,x+70,rowY+25,width-510,'900 17px Arial','#10233b')
    canvasText(ctx,`${player.equipa||'—'} · ${String(player.posicao||'').split(',')[0]||'—'} · ${Math.round(player.minutos||0)} min`,x+70,rowY+47,width-510,'500 13px Arial','#64748b')
    const value=formatSportsbaseMetric(player[item.metric.key],item.metric)
    canvasText(ctx,value,x+width-250,rowY+31,180,'900 22px Arial',color,'right')
    canvasText(ctx,`P${player._percentile}`,x+width-182,rowY+31,58,'900 15px Arial',player._percentile>=80?'#15803d':'#475569','center')
    if(item.pairedMetric){
      canvasText(ctx,getExportPairedText(player,item),x+width-24,rowY+50,350,'600 11px Arial','#64748b','right')
    }
  }
}

async function exportTopFivePng(items,title,fileName) {
  const width=1500
  const blockHeight=390
  const gap=28
  const height=150+items.length*(blockHeight+gap)+48
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='#f3f8f5';ctx.fillRect(0,0,width,height)
  drawCanvasReportHeader(ctx,width,title,`${items.length} ${items.length===1?'métrica':'métricas'} · Top 5 por contexto posicional e amostra elegível`)
  items.forEach((item,index)=>drawCanvasTopFiveBlock(ctx,item,48,142+index*(blockHeight+gap),width-96,blockHeight))
  canvasText(ctx,`Gerado em ${new Date().toLocaleString('pt-BR')} · Fonte: Sportsbase · Ranking estatístico para triagem de scouting`,width/2,height-22,width-96,'500 12px Arial','#94a3b8','center')
  const link=document.createElement('a')
  link.download=`${sanitizeFileName(fileName)}.png`
  link.href=canvas.toDataURL('image/png')
  link.click()
}

function drawPdfTopFivePage(doc,item,title,page,totalPages) {
  const pageWidth=doc.internal.pageSize.getWidth()
  const pageHeight=doc.internal.pageSize.getHeight()
  const colorHex=(item.group?.cor||BRAND_PRIMARY).replace('#','')
  const color=[parseInt(colorHex.slice(0,2),16),parseInt(colorHex.slice(2,4),16),parseInt(colorHex.slice(4,6),16)]
  doc.setFillColor(0,77,38);doc.rect(0,0,pageWidth,24,'F')
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('CIC · CONFIANÇA',12,8)
  doc.setFontSize(13);doc.text(title,12,17)
  doc.setTextColor(...color);doc.setFontSize(14);doc.text(item.metric.label,12,37)
  doc.setTextColor(100,116,139);doc.setFont('helvetica','normal');doc.setFontSize(7)
  doc.text(`${item.contextLabel} · ${METRIC_TYPE_LABELS[item.metric.type]} · mínimo ${item.effectiveMinimum} min${item.metric.denominatorKey?` · ${item.metric.minAttempts} ${item.metric.denominatorLabel}`:''} · ${item.total} elegíveis`,12,44)
  const startY=54,rowHeight=21
  item.ranking.concat(Array(Math.max(0,5-item.ranking.length)).fill(null)).slice(0,5).forEach((player,index)=>{
    const y=startY+index*rowHeight
    if(index%2===0){doc.setFillColor(248,253,249);doc.roundedRect(10,y-4,pageWidth-20,rowHeight-2,2,2,'F')}
    if(index===0) doc.setFillColor(...color)
    else doc.setFillColor(232,244,236)
    doc.circle(18,y+5,5,'F')
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(index===0?255:0,index===0?255:102,index===0?255:51);doc.text(String(index+1),18,y+7,{align:'center'})
    if(!player){doc.setTextColor(148,163,184);doc.text('Sem jogador elegível',29,y+7);return}
    doc.setTextColor(24,56,42);doc.setFontSize(9);doc.text(String(player.nome||'—').slice(0,45),29,y+4)
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(100,116,139)
    doc.text(`${player.equipa||'—'} · ${String(player.posicao||'').split(',')[0]||'—'} · ${Math.round(player.minutos||0)} min`,29,y+10)
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...color)
    doc.text(formatSportsbaseMetric(player[item.metric.key],item.metric),pageWidth-54,y+7,{align:'right'})
    doc.setFontSize(8);doc.setTextColor(player._percentile>=80?21:71,player._percentile>=80?128:85,player._percentile>=80?61:105);doc.text(`P${player._percentile}`,pageWidth-35,y+7,{align:'center'})
    if(item.pairedMetric){doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(100,116,139);doc.text(getExportPairedText(player,item),pageWidth-12,y+12,{align:'right'})}
  })
  doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(148,163,184)
  doc.text('Percentis calculados no contexto posicional e apenas entre jogadores elegíveis. Use como triagem para vídeo, não como avaliação final.',12,pageHeight-9)
  doc.text(`${page}/${totalPages}`,pageWidth-12,pageHeight-9,{align:'right'})
}

async function exportTopFivePdf(items,title,fileName) {
  const mod=await import('jspdf')
  const jsPDF=mod.jsPDF??mod.default
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  items.forEach((item,index)=>{if(index>0)doc.addPage();drawPdfTopFivePage(doc,item,title,index+1,items.length)})
  doc.save(`${sanitizeFileName(fileName)}.pdf`)
}


function FootBadge({ value, showUnknown = false }) {
  const label = playerFootLabel(value)
  if (label === 'Não informado' && !showUnknown) return null
  const foot = String(value || 'unknown')
  const style = foot === 'esquerdo'
    ? { background:'#dbeafe', color:'#1d4ed8' }
    : foot === 'direito'
      ? { background:'#fef3c7', color:'#92400e' }
      : foot === 'ambos'
        ? { background:'#ede9fe', color:'#6d28d9' }
        : { background:'#f1f5f9', color:'#64748b' }
  return <span title={`Pé preferido: ${label}`} style={{ ...style, display:'inline-block', borderRadius:999, padding:'3px 7px', fontSize:8.5, fontWeight:900 }}>{label}</span>
}

function WyscoutDatasetTable({ players, meta, uploadAt, slug, ligaNome }) {
  const [search, setSearch] = useState('')
  const [foot, setFoot] = useState('')
  const [team, setTeam] = useState('')
  const [group, setGroup] = useState('')
  const [minimum, setMinimum] = useState(meta?.suggestedMinimum || 270)
  const [sort, setSort] = useState('minutos')
  const teams = useMemo(() => [...new Set(players.map(player => player.equipa).filter(Boolean))].sort(), [players])
  const filtered = useMemo(() => players.filter(player => {
    if (search && !`${player.nome} ${player.equipa}`.toLowerCase().includes(search.toLowerCase())) return false
    if (team && player.equipa !== team) return false
    if (group && player.grupo_posicional !== group) return false
    if (foot && !matchesPlayerFoot(player, foot)) return false
    if (Number(player.minutos || 0) < Number(minimum || 0)) return false
    return true
  }).sort((a,b)=>(Number(b[sort])||0)-(Number(a[sort])||0)), [players, search, team, group, foot, minimum, sort])

  return <div>
    <div style={{ padding:'11px 13px', borderRadius:11, background:'#eef6ff', border:'1px solid #c9ddf8', color:'#24558a', fontSize:10.5, lineHeight:1.5, marginBottom:12 }}>
      <strong>Visualização Wyscout.</strong> Este modelo contém cadastro, pé preferido, jogos, minutos, gols e xG. As métricas avançadas, IAP e gráficos de volume × eficiência dependem do upload Sportsbase da liga.
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'minmax(200px,1.5fr) repeat(5,minmax(130px,.8fr))', gap:8, padding:13, background:'#fff', border:'1px solid #dbe7f2', borderRadius:12, marginBottom:12 }}>
      <label style={{fontSize:9,fontWeight:800,color:'#64748b'}}>BUSCAR<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Jogador ou clube" style={{width:'100%',marginTop:4,border:'1px solid #dbe7f2',borderRadius:8,padding:'8px 9px',fontSize:10}}/></label>
      <label style={{fontSize:9,fontWeight:800,color:'#64748b'}}>CLUBE<select value={team} onChange={e=>setTeam(e.target.value)} style={{width:'100%',marginTop:4,border:'1px solid #dbe7f2',borderRadius:8,padding:'8px 7px',fontSize:10}}><option value="">Todos</option>{teams.map(item=><option key={item}>{item}</option>)}</select></label>
      <label style={{fontSize:9,fontWeight:800,color:'#64748b'}}>GRUPO<select value={group} onChange={e=>setGroup(e.target.value)} style={{width:'100%',marginTop:4,border:'1px solid #dbe7f2',borderRadius:8,padding:'8px 7px',fontSize:10}}><option value="">Todos</option>{Object.entries(WYSCOUT_GROUP_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label style={{fontSize:9,fontWeight:800,color:'#64748b'}}>PÉ PREFERIDO<select value={foot} onChange={e=>setFoot(e.target.value)} style={{width:'100%',marginTop:4,border:'1px solid #dbe7f2',borderRadius:8,padding:'8px 7px',fontSize:10}}>{PLAYER_FOOT_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label style={{fontSize:9,fontWeight:800,color:'#64748b'}}>MIN. MINUTOS<input type="number" min="0" value={minimum} onChange={e=>setMinimum(e.target.value)} style={{width:'100%',marginTop:4,border:'1px solid #dbe7f2',borderRadius:8,padding:'8px 7px',fontSize:10}}/></label>
      <label style={{fontSize:9,fontWeight:800,color:'#64748b'}}>ORDENAR<select value={sort} onChange={e=>setSort(e.target.value)} style={{width:'100%',marginTop:4,border:'1px solid #dbe7f2',borderRadius:8,padding:'8px 7px',fontSize:10}}>{WYSCOUT_SERIE_D_METRICS.map(metric=><option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label>
    </div>
    <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:12, overflow:'hidden' }}>
      <div style={{padding:'12px 15px',background:'#f8fdf9',borderBottom:'1px solid #edf4ef',display:'flex',justifyContent:'space-between'}}><div><strong style={{fontSize:13,color:'#10233b'}}>{ligaNome || slug} · Wyscout</strong><p style={{fontSize:9,color:'#64748b',marginTop:3}}>{uploadAt ? `Atualizado em ${new Date(uploadAt).toLocaleDateString('pt-BR')}` : 'Sem data'} · pé informado em {meta?.footCoverage?.coveragePct || 0}% da base</p></div><strong style={{fontSize:11,color:'#0a66b7'}}>{filtered.length} elegíveis</strong></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:1040}}><thead><tr>{['#','Jogador','Equipe','Posição','Pé','Idade','Min','Jogos','Gols','Gols/90','xG','xG/90','Mercado'].map(label=><th key={label} style={{padding:'9px 10px',fontSize:9,color:'#94a3b8',textAlign:['Jogador','Equipe','Posição'].includes(label)?'left':'center',borderBottom:'1px solid #edf4ef'}}>{label}</th>)}</tr></thead><tbody>{filtered.slice(0,120).map((player,index)=><tr key={`${player.nome}-${player.equipa}`} style={{borderBottom:'1px solid #f1f5f2'}}><td style={{padding:10,textAlign:'center',fontSize:10,color:'#94a3b8'}}>{index+1}</td><td style={{padding:10}}><Link href={canonicalPlayerPath(slug,player)} style={{fontSize:11.5,fontWeight:900,color:'#0a66b7',textDecoration:'none'}}>{player.nome}</Link></td><td style={{padding:10,fontSize:10.5,color:'#475569'}}>{player.equipa}</td><td style={{padding:10}}><PositionBadge posicao={player.posicao}/></td><td style={{padding:10,textAlign:'center'}}><FootBadge value={player.pe} showUnknown/></td><td style={{padding:10,textAlign:'center',fontSize:10}}>{player.idade||'—'}</td><td style={{padding:10,textAlign:'center',fontSize:10,fontWeight:800}}>{Math.round(player.minutos||0)}</td><td style={{padding:10,textAlign:'center',fontSize:10}}>{player.jogos||0}</td><td style={{padding:10,textAlign:'center',fontSize:11,fontWeight:900,color:'#0a66b7'}}>{player.gols||0}</td><td style={{padding:10,textAlign:'center',fontSize:10}}>{Number(player.gols_90||0).toFixed(2)}</td><td style={{padding:10,textAlign:'center',fontSize:10}}>{Number(player.xg||0).toFixed(2)}</td><td style={{padding:10,textAlign:'center',fontSize:10}}>{Number(player.xg_90||0).toFixed(2)}</td><td style={{padding:10,textAlign:'center',fontSize:10}}>{Number(player.valor_mercado_num||player.valor_mercado||0)>0?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'EUR',notation:'compact'}).format(Number(player.valor_mercado_num||player.valor_mercado)):'—'}</td></tr>)}</tbody></table></div>
      {!filtered.length&&<div style={{padding:45,textAlign:'center',color:'#94a3b8',fontSize:12}}>Nenhum jogador no recorte selecionado.</div>}
    </div>
  </div>
}

export default function SportsbasePlayersTable({ slug, ligaNome = '', source = 'auto' }) {
  const [players, setPlayers] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploadAt, setUploadAt] = useState(null)
  const [provider, setProvider] = useState('sportsbase')
  const [fusionQuality, setFusionQuality] = useState(null)
  const [groupId, setGroupId] = useState('producao')
  const [metricKey, setMetricKey] = useState('gols_90')
  const [metricScope, setMetricScope] = useState('core')
  const [context, setContext] = useState(METRIC_GROUPS.producao.defaultContext)
  const [exactPosition, setExactPosition] = useState('')
  const [sampleMode, setSampleMode] = useState('auto')
  const [customMinutes, setCustomMinutes] = useState(500)
  const [search, setSearch] = useState('')
  const [foot, setFoot] = useState('')
  const [view, setView] = useState('ranking')
  const [selected, setSelected] = useState(null)
  const [focos, setFocos] = useState([])
  const [exporting, setExporting] = useState('')
  const [exportStatus, setExportStatus] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ligas-v2/${slug}/dataset?source=${source}`)
      if (!response.ok) throw new Error('Falha ao carregar dados da liga')
      const data = await response.json()
      setPlayers(data.jogadores || [])
      setMeta(data.meta || null)
      setUploadAt(data.upload_at || null)
      setProvider(data.fonte || 'sportsbase')
      setFusionQuality(data.fusion_quality || null)
    } catch (error) {
      console.error(error)
      setPlayers([])
      setFusionQuality(null)
    }
    setLoading(false)
  }, [slug, source])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    fetch('/api/focos-recrutamento').then(response=>response.json()).then(data=>setFocos(data.focos || [])).catch(()=>setFocos([]))
  }, [])

  const coreMetricKeys = useMemo(()=>new Set(SPORTSBASE_CORE_METRICS.map(item=>item.key)),[])
  const metricGroup = METRIC_GROUPS[groupId]
  const visibleMetrics = metricScope==='core' ? metricGroup.metricas.filter(item=>coreMetricKeys.has(item.key)) : metricGroup.metricas
  const metric = metricGroup.metricas.find(item=>item.key===metricKey) || visibleMetrics[0] || metricGroup.metricas[0]
  const visibleMetricGroups = useMemo(()=>Object.entries(METRIC_GROUPS).filter(([,group])=>metricScope!=='core'||group.metricas.some(item=>coreMetricKeys.has(item.key))),[metricScope,coreMetricKeys])
  const selectedMinimum = sampleMode === 'auto' ? 'auto' : sampleMode === 'all' ? 0 : sampleMode === 'custom' ? Math.max(0, Number(customMinutes)||0) : Number(sampleMode)
  const effectiveMinimum = resolveMetricMinimumMinutes(metric, players, selectedMinimum)

  const contextPool = useMemo(() => players.filter(player => {
    if (context !== 'ALL' && getSportsbasePositionGroup(player.posicao) !== context) return false
    if (foot && !matchesPlayerFoot(player, foot)) return false
    if (exactPosition && !String(player.posicao || '').split(',').map(item=>item.trim()).includes(exactPosition)) return false
    return true
  }), [players, context, exactPosition, foot])

  const eligibility = useMemo(() => contextPool.map(player => ({
    player,
    result:getMetricEligibility(player, metric, { players:contextPool, selectedMinimum }),
  })), [contextPool, metric, selectedMinimum])

  const eligiblePool = useMemo(() => eligibility.filter(item=>item.result.eligible).map(item=>item.player), [eligibility])
  const metricValues = useMemo(() => eligiblePool.map(player=>player[metric.key]), [eligiblePool, metric.key])

  const rankedPool = useMemo(() => {
    const ordered = eligiblePool.map(player => ({
      ...player,
      _percentile:calculateSportsbasePercentile(player[metric.key], metricValues, metric.higherIsBetter),
    })).sort((a,b) => {
      const av = Number(a[metric.key]); const bv = Number(b[metric.key])
      return metric.higherIsBetter ? bv-av : av-bv
    })
    return ordered.map((player,index)=>({ ...player, _rank:index+1 }))
  }, [eligiblePool, metric, metricValues])

  const visibleRanked = useMemo(() => rankedPool.filter(player => !search || `${player.nome} ${player.equipa}`.toLowerCase().includes(search.toLowerCase())), [rankedPool, search])
  const excludedMinutes = eligibility.filter(item=>item.result.reason?.includes('minutos')).length
  const excludedAttempts = eligibility.filter(item=>item.result.reason?.includes('Abaixo de') && !item.result.reason?.includes('minutos')).length
  const positions = meta?.positions || [...new Set(players.flatMap(player=>String(player.posicao||'').split(',').map(item=>item.trim())).filter(Boolean))].sort()

  const pairMetric = metric.pairedMetricKey ? getSportsbaseMetric(metric.pairedMetricKey) : null
  const quadrant = useMemo(() => {
    if (!pairMetric) return null
    const currentIsEfficiency = ['percent','distribution'].includes(metric.type)
    const xMetric = currentIsEfficiency ? pairMetric : metric
    const yMetric = currentIsEfficiency ? metric : pairMetric
    const data = contextPool.filter(player =>
      getMetricEligibility(player, xMetric, { players:contextPool, selectedMinimum }).eligible &&
      getMetricEligibility(player, yMetric, { players:contextPool, selectedMinimum }).eligible
    ).map(player=>({
      x:Number(player[xMetric.key]), y:Number(player[yMetric.key]), z:Math.max(40,Number(player.minutos)||0),
      nome:player.nome, equipa:player.equipa, posicao:player.posicao, minutos:player.minutos,
    }))
    return { data, xMetric, yMetric, xMedian:median(data.map(item=>item.x)), yMedian:median(data.map(item=>item.y)) }
  }, [pairMetric, metric, contextPool, selectedMinimum])

  const changeGroup = (id) => {
    const nextGroup = METRIC_GROUPS[id]
    const nextMetrics = metricScope==='core' ? nextGroup.metricas.filter(item=>coreMetricKeys.has(item.key)) : nextGroup.metricas
    setGroupId(id)
    setMetricKey((nextMetrics[0] || nextGroup.metricas[0]).key)
    setContext(nextGroup.defaultContext)
    setExactPosition('')
    setSelected(null)
  }

  const changeMetricScope = (scope) => {
    setMetricScope(scope)
    if (scope==='core' && !coreMetricKeys.has(metric.key)) {
      const currentCore=metricGroup.metricas.find(item=>coreMetricKeys.has(item.key))
      if (currentCore) setMetricKey(currentCore.key)
      else { setGroupId('producao'); setMetricKey('gols_90') }
    }
    setSelected(null);setView('ranking')
  }

  const getLeader = (item) => {
    const pool = contextPool.filter(player=>getMetricEligibility(player,item,{players:contextPool,selectedMinimum}).eligible)
    return [...pool].sort((a,b)=>item.higherIsBetter?Number(b[item.key])-Number(a[item.key]):Number(a[item.key])-Number(b[item.key]))[0]
  }


  const buildExportItem = (exportMetric, exportContext, exportExactPosition = '') => {
    const rankingData = rankMetricPlayers(players, exportMetric, exportContext, exportExactPosition, selectedMinimum, foot)
    const exportGroupId = getSportsbaseMetricGroup(exportMetric.key)
    const exportGroup = METRIC_GROUPS[exportGroupId] || metricGroup
    const pairedMetric = exportMetric.pairedMetricKey ? getSportsbaseMetric(exportMetric.pairedMetricKey) : null
    const contextLabel = exportContext === 'ALL'
      ? 'Todas as posições'
      : `${SPORTSBASE_POSITION_GROUPS[exportContext]?.label || exportContext}${exportExactPosition ? ` · ${exportExactPosition}` : ''}`
    return { metric:exportMetric, group:exportGroup, pairedMetric, contextLabel, selectedMinimum, ...rankingData }
  }

  const handleExport = async (format, scope) => {
    const exportKey=`${scope}-${format}`
    setExporting(exportKey);setExportStatus('')
    try {
      const items=scope==='current'
        ? [buildExportItem(metric,context,exactPosition)]
        : SPORTSBASE_CORE_METRICS.map(item=>{
            const coreMetric=getSportsbaseMetric(item.key)
            return coreMetric?buildExportItem(coreMetric,item.context):null
          }).filter(Boolean)
      const competition=ligaNome||slug
      const title=scope==='current'?`Top 5 · ${metric.label}`:`Top 5 · 12 métricas centrais · ${competition}`
      const fileName=scope==='current'?`top-5-${competition}-${metric.label}`:`top-5-12-metricas-${competition}`
      if(format==='png') await exportTopFivePng(items,title,fileName)
      else await exportTopFivePdf(items,title,fileName)
      setExportStatus('✓ Arquivo gerado')
    } catch(error) {
      console.error(error)
      setExportStatus(`✗ ${error.message || 'Erro ao exportar'}`)
    }
    setExporting('')
  }

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>Carregando dados da liga...</div>
  if (provider === 'wyscout') return <WyscoutPlayersTable players={players} meta={meta} uploadAt={uploadAt} slug={slug} ligaNome={ligaNome}/>
  if (!players.length) return (
    <div style={{ padding:60, textAlign:'center', background:'#fff', borderRadius:12, border:'1px solid #e8f4ec' }}>
      <p style={{ fontSize:24, marginBottom:8 }}>📊</p><p style={{ fontWeight:700, color:'#2d4a35', marginBottom:4 }}>Sem dados de jogadores</p>
      <p style={{ fontSize:12, color:'#94a3b8' }}>Faça o upload do modelo Sportsbase (.xlsx) para esta liga</p>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', marginBottom:12, flexWrap:'wrap' }}>
        <div>
          <p style={{ fontSize:11, color:'#64748b' }}>🔄 Upload {uploadAt ? new Date(uploadAt).toLocaleDateString('pt-BR') : '—'} · {players.length} jogadores · maior amostra {meta?.maxMinutes || Math.max(...players.map(player=>player.minutos||0))} min</p>
          <p style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>Percentis calculados apenas dentro do contexto posicional e da amostra elegível.{provider==='combined'?' · Automático = Sportsbase + Wyscout com atualização por atleta/campo.':''}</p>
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <div style={{ display:'flex', gap:5, background:'#fff', border:'1px solid #dbe7f2', borderRadius:9, padding:3 }}>
            <button onClick={()=>setView('ranking')} style={{ border:'none', borderRadius:7, padding:'6px 11px', fontSize:10, fontWeight:800, cursor:'pointer', background:view==='ranking'?BRAND_PRIMARY:'transparent', color:view==='ranking'?'#fff':'#64748b' }}>Tabela</button>
            <button disabled={!quadrant} onClick={()=>quadrant&&setView('quadrant')} style={{ border:'none', borderRadius:7, padding:'6px 11px', fontSize:10, fontWeight:800, cursor:quadrant?'pointer':'not-allowed', opacity:quadrant?1:.4, background:view==='quadrant'?BRAND_PRIMARY:'transparent', color:view==='quadrant'?'#fff':'#64748b' }}>Volume × eficiência</button>
          </div>
          <div style={{ display:'flex', gap:4, background:'#fff', border:'1px solid #dbe7f2', borderRadius:9, padding:3, flexWrap:'wrap' }}>
            <button onClick={()=>handleExport('png','current')} disabled={Boolean(exporting)} title="Top 5 da métrica e do contexto atuais" style={{ border:'none', borderRadius:7, padding:'6px 9px', fontSize:9, fontWeight:800, cursor:exporting?'wait':'pointer', background:'#eaf4fd', color:BRAND_PRIMARY }}>{exporting==='current-png'?'Gerando...':'🖼 PNG atual'}</button>
            <button onClick={()=>handleExport('pdf','current')} disabled={Boolean(exporting)} title="Top 5 da métrica e do contexto atuais" style={{ border:'none', borderRadius:7, padding:'6px 9px', fontSize:9, fontWeight:800, cursor:exporting?'wait':'pointer', background:'#f1f5f9', color:'#475569' }}>{exporting==='current-pdf'?'Gerando...':'📄 PDF atual'}</button>
            <button onClick={()=>handleExport('png','core')} disabled={Boolean(exporting)} title="Painel PNG com o Top 5 das 12 métricas centrais" style={{ border:'none', borderRadius:7, padding:'6px 9px', fontSize:9, fontWeight:800, cursor:exporting?'wait':'pointer', background:'#eaf4fd', color:BRAND_PRIMARY }}>{exporting==='core-png'?'Gerando...':'🖼 PNG 12'}</button>
            <button onClick={()=>handleExport('pdf','core')} disabled={Boolean(exporting)} title="PDF com uma página para cada uma das 12 métricas centrais" style={{ border:'none', borderRadius:7, padding:'6px 9px', fontSize:9, fontWeight:800, cursor:exporting?'wait':'pointer', background:'#f1f5f9', color:'#475569' }}>{exporting==='core-pdf'?'Gerando...':'📄 PDF 12'}</button>
          </div>
        </div>
      </div>

      {exportStatus&&<p style={{fontSize:10,fontWeight:800,color:exportStatus.startsWith('✓')?BRAND_PRIMARY:'#dc2626',textAlign:'right',marginTop:-6,marginBottom:8}}>{exportStatus}</p>}

      {provider==='combined'&&fusionQuality&&<div style={{padding:'9px 12px',marginBottom:12,borderRadius:9,background:'#eef6ff',border:'1px solid #c9ddf8',color:'#24558a',fontSize:10,lineHeight:1.45}}>
        <strong>🔗 Integração automática ativa.</strong> {fusionQuality.paired||0} atletas pareados entre as duas fontes ({fusionQuality.high_confidence_paired||0} em alta confiança) · {fusionQuality.sportsbase_only||0} somente Sportsbase · {fusionQuality.wyscout_only||0} somente Wyscout{fusionQuality.ambiguous?` · ${fusionQuality.ambiguous} ambíguo(s) mantido(s) separado(s)`:''}. Nomes abreviados, como <b>K. Viveros</b>, são validados por sobrenome/inicial + clube + idade + posição/nacionalidade antes da fusão.
      </div>}

      {!meta?.hasGoalkeepers && <div style={{ padding:'9px 12px', marginBottom:12, borderRadius:9, background:'#fff7ed', border:'1px solid #fed7aa', color:'#c2410c', fontSize:10 }}>⚠ O arquivo não contém goleiros. O ranking e a Seleção do Campeonato de GK permanecem indisponíveis até um export específico.</div>}

      <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', marginBottom:10, flexWrap:'wrap' }}>
        <div style={{display:'flex',gap:4,background:'#fff',border:'1px solid #dbe7f2',borderRadius:9,padding:3}}>
          <button onClick={()=>changeMetricScope('core')} style={{border:'none',borderRadius:7,padding:'6px 10px',fontSize:9.5,fontWeight:900,cursor:'pointer',background:metricScope==='core'?BRAND_PRIMARY:'transparent',color:metricScope==='core'?'#fff':'#64748b'}}>12 centrais</button>
          <button onClick={()=>changeMetricScope('all')} style={{border:'none',borderRadius:7,padding:'6px 10px',fontSize:9.5,fontWeight:900,cursor:'pointer',background:metricScope==='all'?BRAND_PRIMARY:'transparent',color:metricScope==='all'?'#fff':'#64748b'}}>Catálogo completo</button>
        </div>
        <p style={{fontSize:9.5,color:'#94a3b8'}}>{metricScope==='core'?'Triagem rápida: 12 indicadores centrais':'Todas as métricas Sportsbase organizadas por natureza e unidade'}</p>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:13, flexWrap:'wrap' }}>
        {visibleMetricGroups.map(([id,item])=><button key={id} onClick={()=>changeGroup(id)} style={{ padding:'6px 12px', border:`1.5px solid ${groupId===id?item.cor:'#dbe7f2'}`, borderRadius:20, fontSize:10, fontWeight:800, cursor:'pointer', background:groupId===id?item.cor:'#fff', color:groupId===id?'#fff':'#64748b' }}>{item.label}</button>)}
      </div>

      <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:12, padding:12, marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(170px,1.3fr) minmax(145px,1fr) minmax(120px,.8fr) minmax(135px,.9fr) minmax(260px,1.8fr)', gap:9 }}>
          <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="🔍 Jogador ou equipe" style={{ border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 10px', fontSize:11 }}/>
          <select value={context} onChange={event=>{setContext(event.target.value);setExactPosition('')}} style={{ border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 10px', fontSize:11, background:'#fff' }}>
            <option value="ALL">Todas as posições</option>
            {Object.entries(SPORTSBASE_POSITION_GROUPS).map(([key,item])=><option key={key} value={key}>{item.label} ({meta?.groups?.[key] || 0})</option>)}
          </select>
          <select value={exactPosition} onChange={event=>setExactPosition(event.target.value)} style={{ border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 10px', fontSize:11, background:'#fff' }}>
            <option value="">Todas do grupo</option>{positions.map(item=><option key={item} value={item}>{item}</option>)}
          </select>
          <select value={foot} onChange={event=>setFoot(event.target.value)} style={{ border:'1px solid #dbe7f2', borderRadius:8, padding:'8px 10px', fontSize:11, background:'#fff' }}>
            {PLAYER_FOOT_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:9, fontWeight:900, color:'#64748b', marginRight:2 }}>AMOSTRA</span>
            {[['auto',`Auto (${meta?.suggestedMinimumMinutes || 0})`],['all','Todos'],['270','270'],['500','500'],['900','900']].map(([value,label])=><button key={value} onClick={()=>setSampleMode(value)} style={{ border:`1px solid ${sampleMode===value?BRAND_PRIMARY:'#dbe7f2'}`, borderRadius:7, padding:'5px 7px', background:sampleMode===value?'#eaf4fd':'#fff', color:sampleMode===value?BRAND_PRIMARY:'#64748b', fontSize:9, fontWeight:800, cursor:'pointer' }}>{label}</button>)}
            <button onClick={()=>setSampleMode('custom')} style={{ border:`1px solid ${sampleMode==='custom'?BRAND_PRIMARY:'#dbe7f2'}`, borderRadius:7, padding:'5px 7px', background:sampleMode==='custom'?'#eaf4fd':'#fff', color:sampleMode==='custom'?BRAND_PRIMARY:'#64748b', fontSize:9, fontWeight:800, cursor:'pointer' }}>Outro</button>
            {sampleMode==='custom'&&<input type="number" value={customMinutes} onChange={event=>setCustomMinutes(event.target.value)} style={{ width:62, border:'1px solid #dbe7f2', borderRadius:7, padding:'5px 6px', fontSize:9 }}/>} 
          </div>
        </div>
      </div>

      {sampleMode==='all' && !['total','index'].includes(metric.type) && <div style={{ padding:'8px 12px', marginBottom:12, borderRadius:9, background:'#fff7ed', color:'#c2410c', fontSize:10 }}>Amostra sem corte: valores por 90 podem ser inflados por poucos minutos. O percentil continua exibido, mas exige validação em vídeo.</div>}

      <div style={{ display:'grid', gridTemplateColumns:'205px minmax(0,1fr)', gap:14, alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:680, overflowY:'auto', paddingRight:3 }}>
          {visibleMetrics.map(item => {
            const leader = getLeader(item)
            const active = item.key===metric.key
            return <button key={item.key} onClick={()=>{setMetricKey(item.key);setView('ranking');setSelected(null)}} style={{ textAlign:'left', border:`1.5px solid ${active?metricGroup.cor:'#dbe7f2'}`, borderRadius:9, padding:'9px 10px', background:active?metricGroup.cor:'#fff', cursor:'pointer', boxShadow:active?`0 3px 10px ${metricGroup.cor}25`:'none' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:5 }}><p style={{ fontSize:10.5, fontWeight:800, color:active?'#fff':'#2d4a35', lineHeight:1.25 }}>{item.label}</p><span style={{ fontSize:8, fontWeight:900, color:active?'rgba(255,255,255,.75)':'#94a3b8' }}>{METRIC_TYPE_LABELS[item.type]}</span></div>
              <p style={{ fontSize:9, color:active?'rgba(255,255,255,.72)':'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:3 }}>{leader ? `${leader.nome} — ${formatSportsbaseMetric(leader[item.key],item)}` : 'Sem elegíveis'}</p>
            </button>
          })}
        </div>

        <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'13px 16px', borderBottom:'1px solid #edf4ef', background:'#f8fdf9', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}><div style={{ width:8, height:8, borderRadius:99, background:metricGroup.cor }}/><h3 style={{ fontSize:14, fontWeight:900, color:'#10233b' }}>{metric.label}</h3><MetricTypeBadge metric={metric}/>{metric.derived&&<span style={{ fontSize:8, fontWeight:900, color:'#92400e', background:'#fef3c7', padding:'3px 6px', borderRadius:99 }}>DERIVADA EXPLÍCITA</span>}</div>
              <p style={{ fontSize:9.5, color:'#64748b', marginTop:5 }}>Contexto: {context==='ALL'?'todas as posições':SPORTSBASE_POSITION_GROUPS[context]?.label}{exactPosition?` · ${exactPosition}`:''} · mínimo efetivo {effectiveMinimum} min{metric.denominatorKey?` · mínimo ${metric.minAttempts} ${metric.denominatorLabel}`:''}</p>
            </div>
            <div style={{ textAlign:'right' }}><p style={{ fontSize:11, fontWeight:900, color:BRAND_PRIMARY }}>{visibleRanked.length} elegíveis</p><p style={{ fontSize:9, color:'#94a3b8' }}>{excludedMinutes} excluídos por minutos · {excludedAttempts} por tentativas</p></div>
          </div>

          {view==='quadrant' && quadrant ? (
            <div style={{ padding:16 }}>
              <div style={{ height:480 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top:20, right:25, bottom:35, left:15 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name={quadrant.xMetric.label} tick={{fontSize:10}} label={{value:quadrant.xMetric.label,position:'insideBottom',offset:-20,fontSize:10}} />
                    <YAxis type="number" dataKey="y" name={quadrant.yMetric.label} tick={{fontSize:10}} label={{value:quadrant.yMetric.label,angle:-90,position:'insideLeft',fontSize:10}} />
                    <ZAxis type="number" dataKey="z" range={[45,260]} />
                    <ReferenceLine x={quadrant.xMedian} stroke="#94a3b8" strokeDasharray="4 4" />
                    <ReferenceLine y={quadrant.yMedian} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Tooltip content={<QuadrantTooltip xMetric={quadrant.xMetric} yMetric={quadrant.yMetric}/>} />
                    <Scatter data={quadrant.data} fill={metricGroup.cor} fillOpacity={0.72} onClick={point=>{ const payload=point?.payload || point; setSelected(rankedPool.find(item=>item.nome===payload?.nome&&item.equipa===payload?.equipa) || null) }} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p style={{ fontSize:9.5, color:'#64748b', textAlign:'center' }}>Linhas tracejadas = medianas do recorte · tamanho do ponto = minutos jogados. Clique no ponto para abrir a leitura de scouting.</p>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:760 }}>
                <thead><tr style={{ background:'#fbfdfb' }}>{['#','Jogador','Equipe','Pos','Pé','Idade',metric.label,'Percentil',metric.denominatorKey?'Tentativas':'Amostra','Min','Jogos'].map(header=><th key={header} style={{ padding:'9px 10px', fontSize:9, color:'#94a3b8', fontWeight:800, textAlign:['Jogador','Equipe'].includes(header)?'left':'center', borderBottom:'1px solid #edf4ef', whiteSpace:'nowrap' }}>{header}</th>)}</tr></thead>
                <tbody>
                  {visibleRanked.slice(0,80).map((player,index)=><tr key={`${player.nome}-${player.equipa}`} onClick={()=>setSelected(player)} style={{ borderBottom:'1px solid #f1f5f2', background:index%2?'#fcfdfc':'#fff', cursor:'pointer' }}>
                    <td style={{ padding:'9px 10px', textAlign:'center', fontSize:11, fontWeight:900, color:index===0?metricGroup.cor:'#94a3b8' }}>{player._rank}</td>
                    <td style={{ padding:'9px 10px' }}><Link onClick={event=>event.stopPropagation()} href={canonicalPlayerPath(slug, player)} style={{ fontSize:12, fontWeight:800, color:BRAND_PRIMARY, textDecoration:'none' }}>{player.nome}</Link></td>
                    <td style={{ padding:'9px 10px', fontSize:10.5, color:'#475569' }}>{player.equipa || '—'}</td>
                    <td style={{ padding:'9px 10px' }}><PositionBadge posicao={player.posicao}/></td>
                    <td style={{ padding:'9px 10px', textAlign:'center' }}><FootBadge value={player.pe} showUnknown/></td>
                    <td style={{ padding:'9px 10px', textAlign:'center', fontSize:10.5, color:'#475569' }}>{player.idade || '—'}</td>
                    <td style={{ padding:'9px 10px', textAlign:'center', fontSize:index===0?15:13, fontWeight:900, color:index===0?metricGroup.cor:'#10233b' }}>
                      {formatSportsbaseMetric(player[metric.key],metric)}
                      {provider==='combined'&&player._field_sources?.[metric.key]&&<span title={`Fonte do campo: ${player._field_sources[metric.key]}`} style={{display:'block',fontSize:7.5,fontWeight:900,color:'#94a3b8',marginTop:1}}>{player._field_sources[metric.key]==='wyscout'?'WY':player._field_sources[metric.key]==='sportsbase'?'SB':'MIX'}</span>}
                    </td>
                    <td style={{ padding:'9px 10px', textAlign:'center' }}><span style={{ display:'inline-block', minWidth:38, borderRadius:99, padding:'3px 6px', background:player._percentile>=80?'#dcfce7':player._percentile<=20?'#fee2e2':'#f1f5f9', color:player._percentile>=80?'#15803d':player._percentile<=20?'#b91c1c':'#475569', fontSize:10, fontWeight:900 }}>P{player._percentile}</span></td>
                    <td style={{ padding:'9px 10px', textAlign:'center', fontSize:10, color:'#64748b' }}>{metric.denominatorKey ? `${player[metric.denominatorKey] || 0}` : <SampleBadge player={player} effectiveMinimum={effectiveMinimum}/>}</td>
                    <td style={{ padding:'9px 10px', textAlign:'center', fontSize:10, color:'#64748b' }}>{Math.round(player.minutos || 0)}</td>
                    <td style={{ padding:'9px 10px', textAlign:'center', fontSize:10, color:'#64748b' }}>{player.jogos || '—'}</td>
                  </tr>)}
                </tbody>
              </table>
              {!visibleRanked.length&&<div style={{ padding:45, textAlign:'center', color:'#94a3b8', fontSize:12 }}>Nenhum jogador cumpre as regras de amostra deste recorte.</div>}
            </div>
          )}
        </div>
      </div>

      {selected&&<PlayerDrawer player={selected} metric={metric} metricGroup={metricGroup} rankedPool={rankedPool} effectiveMinimum={effectiveMinimum} slug={slug} focos={focos} onClose={()=>setSelected(null)}/>} 
    </div>
  )
}
