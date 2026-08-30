'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button, C, EmptyState, Kpi, LoadingState, PageHeader, Panel,
  ScoutingPage, StatusDot,
} from '@/app/components/scouting/ScoutingUI'

const STAGES = [
  {
    key:'observacao', number:'01', title:'Observação', action:'Avaliar em vídeo ou ao vivo',
    explanation:'O atleta entra aqui para receber evidências qualitativas, contexto de função e um parecer inicial.',
    next:'Avança quando existe parecer suficiente para acompanhamento contínuo.', link:'/observacao', tone:C.green,
  },
  {
    key:'watchlist', number:'02', title:'Watchlist', action:'Acompanhar evolução e contexto',
    explanation:'O jogador já merece acompanhamento. A equipe registra prioridade, mudanças de produção e novas observações.',
    next:'Avança quando há convicção técnica e aderência a uma necessidade real do elenco.', link:'/lista-preferencial', tone:C.blue,
  },
  {
    key:'lista_final', number:'03', title:'Lista Final', action:'Tomar decisão de recrutamento',
    explanation:'Grupo reduzido para decisão. Aqui ficam o parecer final, os riscos, a recomendação e a justificativa.',
    next:'O sistema organiza a decisão, mas nunca aprova uma contratação automaticamente.', link:'/lista-final', tone:C.purple,
  },
]

const normalize = value => String(value || '').trim().toUpperCase()
const daysSince = value => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)) : null

function StageCard({ stage, count, primary, secondary, conversion }) {
  return <div style={{ border:`1px solid ${stage.tone}32`, borderTop:`4px solid ${stage.tone}`, borderRadius:14, background:'#fff', overflow:'hidden', height:'100%' }}>
    <div style={{ padding:14, display:'grid', gridTemplateColumns:'44px 1fr auto', gap:10, alignItems:'start' }}>
      <div style={{ width:40, height:40, display:'grid', placeItems:'center', borderRadius:11, background:`${stage.tone}12`, color:stage.tone, fontSize:12, fontWeight:950 }}>{stage.number}</div>
      <div><p style={{ color:stage.tone, fontSize:8.2, fontWeight:950, textTransform:'uppercase' }}>{stage.action}</p><h2 style={{ color:C.ink, fontSize:17, marginTop:3 }}>{stage.title}</h2></div>
      <strong style={{ color:stage.tone, fontSize:28, lineHeight:1 }}>{count}</strong>
    </div>
    <div style={{ padding:'0 14px 14px' }}>
      <p style={{ color:C.muted, fontSize:9.2, lineHeight:1.5 }}>{stage.explanation}</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:7, marginTop:11 }}>
        <div style={{ padding:8, borderRadius:9, background:'#f7faf8' }}><span style={{ color:C.muted, fontSize:7.5, textTransform:'uppercase' }}>Ponto de atenção</span><strong style={{ display:'block', color:C.ink, fontSize:9.5, marginTop:3 }}>{primary}</strong></div>
        <div style={{ padding:8, borderRadius:9, background:'#f7faf8' }}><span style={{ color:C.muted, fontSize:7.5, textTransform:'uppercase' }}>{conversion === null ? 'Indicador' : 'Conversão'}</span><strong style={{ display:'block', color:C.ink, fontSize:9.5, marginTop:3 }}>{conversion === null ? secondary : `${conversion}% para próxima etapa`}</strong></div>
      </div>
      <div style={{ marginTop:11, padding:'8px 9px', borderRadius:9, border:`1px solid ${stage.tone}24`, background:`${stage.tone}08` }}><span style={{ color:stage.tone, fontSize:8.4, fontWeight:900 }}>CRITÉRIO DE AVANÇO</span><p style={{ color:C.muted, fontSize:8.5, lineHeight:1.4, marginTop:3 }}>{stage.next}</p></div>
      <Link href={stage.link} style={{ display:'inline-flex', marginTop:11, color:stage.tone, fontSize:9.2, fontWeight:950, textDecoration:'none' }}>Abrir etapa →</Link>
    </div>
  </div>
}

function PlayerLine({ player, stage }) {
  const name = player.nome || player.jogador || 'Atleta'
  const club = player.clube || 'Sem clube'
  const position = player.posicao || 'Sem posição'
  const days = daysSince(player.created_at || player.updated_at || player.uploaded_at)
  const status = stage === 'observacao' ? (player.veredito || 'SEM PARECER') : stage === 'watchlist' ? (player.prioridade || player.status || 'MONITORANDO') : (player.recomendacao || 'SEM DECISÃO')
  return <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) auto auto', gap:9, alignItems:'center', padding:'9px 0', borderBottom:`1px solid ${C.line}` }}>
    <div style={{ minWidth:0 }}><strong style={{ display:'block', color:C.ink, fontSize:10.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</strong><p style={{ color:C.muted, fontSize:8.2, marginTop:2 }}>{club} · {position}</p></div>
    <span style={{ color:C.green, background:C.green2, borderRadius:8, padding:'4px 6px', fontSize:7.7, fontWeight:900, whiteSpace:'nowrap' }}>{normalize(status)}</span>
    <span style={{ color:C.muted, fontSize:8 }}>{days === null ? '—' : `${days}d`}</span>
  </div>
}

function PositionTable({ data }) {
  const positions = [...new Set([
    ...Object.keys(data?.observacao || {}), ...Object.keys(data?.watchlist || {}), ...Object.keys(data?.lista_final || {}),
  ])]
  if (!positions.length) return <EmptyState icon="🧭" title="Sem distribuição posicional" />
  return <div className="scout-scroll" style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', minWidth:650 }}><thead><tr>{['Grupo','Observação','Watchlist','Lista Final','Leitura'].map(label => <th key={label} style={{ padding:'9px 10px', borderBottom:`1px solid ${C.line}`, textAlign:label === 'Grupo' || label === 'Leitura' ? 'left' : 'center', color:C.muted, fontSize:8.3, textTransform:'uppercase' }}>{label}</th>)}</tr></thead><tbody>{positions.map(group => {
    const obs = data.observacao?.[group] || 0
    const watch = data.watchlist?.[group] || 0
    const final = data.lista_final?.[group] || 0
    const reading = obs > 0 && watch === 0 ? 'Falta converter observações em acompanhamento' : watch >= 5 && final === 0 ? 'Grupo represado antes da decisão' : final > watch ? 'Revisar duplicidades ou origem da Lista Final' : 'Fluxo utilizável'
    return <tr key={group} style={{ borderBottom:`1px solid #edf3ef` }}><td style={{ padding:10, color:C.ink, fontSize:10, fontWeight:900 }}>{group}</td><td style={{ padding:10, textAlign:'center', color:C.green, fontWeight:900 }}>{obs}</td><td style={{ padding:10, textAlign:'center', color:C.blue, fontWeight:900 }}>{watch}</td><td style={{ padding:10, textAlign:'center', color:C.purple, fontWeight:900 }}>{final}</td><td style={{ padding:10, color:C.muted, fontSize:8.8 }}>{reading}</td></tr>
  })}</tbody></table></div>
}

export default function FunilPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('acoes')

  useEffect(() => {
    fetch('/api/funil', { cache:'no-store' }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Falha ao carregar o funil.')
      setData(body)
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const metrics = useMemo(() => {
    const obs = data?.jogadores?.observados || []
    const watch = data?.jogadores?.watchlist || []
    const final = data?.jogadores?.lista_final || []
    const obsPending = obs.filter(item => !item.veredito || /OBSERVAR|SEM/i.test(item.veredito)).length
    const highPriority = watch.filter(item => normalize(item.prioridade) === 'ALTA').length
    const stalled = data?.represados?.length || 0
    const finalPending = final.filter(item => !item.recomendacao).length
    return { obs, watch, final, obsPending, highPriority, stalled, finalPending }
  }, [data])

  if (loading) return <ScoutingPage><LoadingState text="Organizando etapas, pendências e critérios de avanço..." /></ScoutingPage>
  if (error) return <ScoutingPage><EmptyState icon="⚠️" title="Funil indisponível" text={error} /></ScoutingPage>

  const stages = data?.etapas || {}
  const conversion = data?.conversao || {}
  return <ScoutingPage maxWidth={1500}>
    <PageHeader eyebrow="RECRUTAMENTO · FLUXO DE DECISÃO" title="Pipeline de Scouting" subtitle="Uma leitura simples do que cada etapa significa, o que está pendente e qual é a próxima ação. O funil organiza o processo; não decide contratações." status={<StatusDot>{(stages.observacao?.total || 0) + (stages.watchlist?.total || 0) + (stages.lista_final?.total || 0)} registros no fluxo</StatusDot>} />

    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:14 }}>
      <Kpi label="Sem parecer inicial" value={metrics.obsPending} sub="observações que precisam de fechamento" icon="👁️" tone={metrics.obsPending ? C.amber : C.green} />
      <Kpi label="Prioridade alta" value={metrics.highPriority} sub="atletas na Watchlist" icon="🔥" tone={C.red} />
      <Kpi label="Represados" value={metrics.stalled} sub="mais de 30 dias sem avançar" icon="⏳" tone={metrics.stalled ? C.amber : C.green} />
      <Kpi label="Decisões pendentes" value={metrics.finalPending} sub="Lista Final sem recomendação" icon="✅" tone={metrics.finalPending ? C.purple : C.green} />
    </div>

    <Panel title="Como o processo funciona" subtitle="Cada etapa tem uma finalidade e um critério claro de avanço" style={{ marginBottom:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:11 }} className="scout-three-col">
        <StageCard stage={STAGES[0]} count={stages.observacao?.total || 0} primary={`${metrics.obsPending} sem parecer`} secondary={`${stages.observacao?.por_veredito?.['CONTRATAÇÃO'] || 0} favoráveis`} conversion={conversion.obs_para_watchlist || 0} />
        <StageCard stage={STAGES[1]} count={stages.watchlist?.total || 0} primary={`${metrics.stalled} represado(s)`} secondary={`${metrics.highPriority} prioridade alta`} conversion={conversion.watchlist_para_final || 0} />
        <StageCard stage={STAGES[2]} count={stages.lista_final?.total || 0} primary={`${metrics.finalPending} sem decisão`} secondary={`${stages.lista_final?.por_recomendacao?.['CONTRATAÇÃO'] || 0} recomendados`} conversion={null} />
      </div>
    </Panel>

    <div style={{ display:'flex', gap:7, marginBottom:10 }}>
      {[['acoes','Próximas ações'],['etapas','Listas por etapa'],['posicoes','Por posição']].map(([key,label]) => <button key={key} onClick={() => setView(key)} style={{ border:`1px solid ${view === key ? C.green : C.line}`, background:view === key ? C.green : '#fff', color:view === key ? '#fff' : C.muted, borderRadius:9, padding:'8px 11px', fontSize:9.5, fontWeight:900, cursor:'pointer' }}>{label}</button>)}
    </div>

    {view === 'acoes' && <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }} className="scout-two-col">
      <Panel title="Fila prioritária" subtitle="O que precisa de ação primeiro">
        <div style={{ display:'grid', gap:8 }}>
          {metrics.obsPending > 0 && <Link href="/observacao" style={{ textDecoration:'none' }}><div style={{ padding:11, borderRadius:10, border:'1px solid #f4d39b', background:'#fff9ed' }}><strong style={{ color:'#8a5a00', fontSize:10.5 }}>{metrics.obsPending} observações sem parecer concluído</strong><p style={{ color:C.muted, fontSize:8.7, marginTop:3 }}>Abrir a Observação e registrar o próximo encaminhamento.</p></div></Link>}
          {metrics.stalled > 0 && <Link href="/lista-preferencial" style={{ textDecoration:'none' }}><div style={{ padding:11, borderRadius:10, border:'1px solid #f4c7c2', background:'#fff5f4' }}><strong style={{ color:C.red, fontSize:10.5 }}>{metrics.stalled} atletas represados na Watchlist</strong><p style={{ color:C.muted, fontSize:8.7, marginTop:3 }}>Revisar, avançar para Lista Final ou encerrar o acompanhamento.</p></div></Link>}
          {metrics.finalPending > 0 && <Link href="/lista-final" style={{ textDecoration:'none' }}><div style={{ padding:11, borderRadius:10, border:'1px solid #ddd2ff', background:'#f8f5ff' }}><strong style={{ color:C.purple, fontSize:10.5 }}>{metrics.finalPending} decisões finais pendentes</strong><p style={{ color:C.muted, fontSize:8.7, marginTop:3 }}>Completar recomendação e justificativa técnica.</p></div></Link>}
          {!metrics.obsPending && !metrics.stalled && !metrics.finalPending && <EmptyState icon="✓" title="Sem pendências críticas" text="O fluxo não possui gargalos imediatos." />}
        </div>
      </Panel>
      <Panel title="Represados" subtitle="Watchlist há mais de 30 dias sem avançar">
        {!data.represados?.length ? <EmptyState icon="✓" title="Nenhum atleta represado" /> : <div>{data.represados.slice(0,10).map(item => <PlayerLine key={item.id || item.jogador} player={item} stage="watchlist" />)}{data.represados.length > 10 && <p style={{ color:C.muted, fontSize:8.5, marginTop:8 }}>+ {data.represados.length - 10} outros atletas</p>}</div>}
      </Panel>
    </div>}

    {view === 'etapas' && <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }} className="scout-three-col">
      <Panel title="Observação" subtitle="Evidência inicial" action={<Link href="/observacao"><Button variant="secondary">Abrir</Button></Link>}>{metrics.obs.slice(0,12).map(item => <PlayerLine key={`${item.nome}-${item.clube}`} player={item} stage="observacao" />)}</Panel>
      <Panel title="Watchlist" subtitle="Acompanhamento ativo" action={<Link href="/lista-preferencial"><Button variant="secondary">Abrir</Button></Link>}>{metrics.watch.slice(0,12).map(item => <PlayerLine key={item.id || item.jogador} player={item} stage="watchlist" />)}</Panel>
      <Panel title="Lista Final" subtitle="Decisão" action={<Link href="/lista-final"><Button variant="secondary">Abrir</Button></Link>}>{metrics.final.slice(0,12).map(item => <PlayerLine key={item.id || item.jogador} player={item} stage="final" />)}</Panel>
    </div>}

    {view === 'posicoes' && <Panel title="Distribuição por grupo posicional" subtitle="Ajuda a identificar gargalos e excesso de candidatos em cada fase"><PositionTable data={data.pos_grupos || {}} /></Panel>}
  </ScoutingPage>
}
