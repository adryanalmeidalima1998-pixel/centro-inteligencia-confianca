'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import {
  C, EmptyState, Kpi, LoadingState, MiniSignal, PageHeader,
  Panel, ScoutingPage, ScoreBadge, StatusDot,
} from '@/app/components/scouting/ScoutingUI'
import { playerFootLabel } from '@/data/player-foot'
import { classifyLevelQuadrant, getCompetitiveLevel } from '@/data/competitive-levels'

function num(value, decimals = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function metricValue(value, type) {
  if (['percent', 'distribution'].includes(type)) return `${num(value, 1)}%`
  if (['total', 'index'].includes(type)) return num(value, 0)
  return num(value, 2)
}
function dateTime(value) { return value ? new Date(value).toLocaleString('pt-BR') : '—' }

const LEVEL = {
  ok: { color: C.green, label: 'OK' },
  warning: { color: C.amber, label: 'ATENÇÃO' },
  critical: { color: C.red, label: 'CRÍTICO' },
}

const levelShort = value => getCompetitiveLevel(Number(value))?.short || '—'

function OpportunityTable({ items = [] }) {
  const visible = items
  if (!items.length) return <EmptyState icon="🎯" title="Sem oportunidades contextuais" text="Nenhum atleta combinou evidência estatística com viabilidade de mercado para o contexto atual do Confiança." />
  const marketTone = band => ({ A: C.green, B: C.blue, C: C.amber, E: C.purple, P: C.purple, R: C.muted }[band] || C.muted)
  return <div>
    {!visible.length ? <EmptyState icon="🎯" title="Nenhuma oportunidade no recorte atual" text="O painel exibirá novos nomes quando os dados e a viabilidade de mercado forem atualizados." /> : <div style={{ overflowX: 'auto' }} className="scout-scroll">
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1320 }}>
      <thead><tr>{['#', 'Jogador', 'Liga e amostra', 'Mercado', 'Perfil', 'Fit', 'Desemp.', 'Foco', 'Tend.', 'Técnica', 'Prioridade', 'Explicação'].map(label => <th key={label} style={{ textAlign: ['Jogador', 'Liga e amostra', 'Mercado', 'Perfil', 'Explicação'].includes(label) ? 'left' : 'center', padding: '10px 8px', borderBottom: `1px solid ${C.line}`, color: C.muted, fontSize: 8.5, textTransform: 'uppercase' }}>{label}</th>)}</tr></thead>
      <tbody>{visible.map((item, index) => { const tone = marketTone(item.marketBand); return <tr key={item.key || `${item.nome}-${item.equipe}`} style={{ borderBottom: `1px solid ${C.line}` }}>
        <td style={{ padding: 10, color: C.muted, fontSize: 10 }}>{index + 1}</td>
        <td style={{ padding: 10 }}><Link href={item.path} style={{ color: C.green, textDecoration: 'none', fontSize: 11, fontWeight: 950 }}>{item.nome}</Link><p style={{ color: C.muted, fontSize: 8.8, marginTop: 2 }}>{item.equipe} · {item.posicao} · Pé {playerFootLabel(item.pe)} · {item.idade || '—'} anos</p></td>
        <td style={{ padding: 10 }}><p style={{ color: C.ink, fontSize: 10 }}>{item.ligaNome}</p><p style={{ color: C.muted, fontSize: 8.8 }}>{num(item.minutos)} min · {item.confidence?.label || '—'}</p></td>
        <td style={{ padding: 10, minWidth: 155 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: tone, background: `${tone}12`, border: `1px solid ${tone}2f`, borderRadius: 99, padding: '4px 7px', fontSize: 8.2, fontWeight: 950 }}>{item.marketBand}</span><strong style={{ color: C.ink, fontSize: 9.2 }}>{item.marketLabel}</strong></div><p title={item.marketReason} style={{ color: C.muted, fontSize: 7.8, marginTop: 4, maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.marketReason}</p></td>
        <td style={{ padding: 10, color: C.ink, fontSize: 10 }}>{item.profile}</td>
        <td style={{ padding: 10, textAlign: 'center' }}><ScoreBadge value={item.fit} /></td>
        <td style={{ padding: 10, textAlign: 'center' }}><ScoreBadge value={item.profileScore} color={C.blue} /></td>
        <td style={{ padding: 10, textAlign: 'center' }}><ScoreBadge value={item.focusAdherence} color={C.amber} /></td>
        <td style={{ padding: 10, textAlign: 'center' }}><ScoreBadge value={item.trendScore} color={C.purple} /></td>
        <td style={{ padding: 10, textAlign: 'center' }}><ScoreBadge value={item.technicalPriority} color={C.blue} /></td>
        <td style={{ padding: 10, textAlign: 'center' }}><ScoreBadge value={item.opportunityScore} color={C.purple} /></td>
        <td style={{ padding: 10, minWidth: 300 }}><p style={{ color: C.green, fontSize: 8.8, lineHeight: 1.4 }}>{(item.positives || []).map(value => `+ ${value}`).join(' · ') || 'Triagem estatística contextual'}</p>{item.cautions?.length ? <p style={{ color: C.amber, fontSize: 8.5, marginTop: 4 }}>− {item.cautions.join(' · ')}</p> : null}</td>
      </tr> })}</tbody>
    </table>
  </div>}
  </div>
}


function LevelCards() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/database?limit=320&minMin=270&ordenarPor=nivel_potencial&dir=desc', { cache:'no-store' })
      .then(response => response.json())
      .then(body => setPlayers(body.jogadores || []))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const definitions = [
      { key:'ready-high-ceiling', label:'Faixa alta + projeção alta', description:'Destaques internos que combinam produção atual e margem de evolução.', tone:C.green, icon:'🚀' },
      { key:'immediate', label:'Destaques consolidados', description:'Faixa A ou superior com robustez utilizável e menor distância para a projeção.', tone:C.blue, icon:'⚡' },
      { key:'development', label:'Projetos com margem', description:'Faixa atual intermediária ou baixa, mas projeção interna superior.', tone:C.purple, icon:'🌱' },
      { key:'high-risk', label:'Projeção com baixa robustez', description:'Sinais positivos que ainda precisam de mais amostra e validação em vídeo.', tone:C.red, icon:'🎲' },
      { key:'high-low-margin', label:'Faixa alta, margem menor', description:'Produção atual forte e projeção próxima do desempenho já demonstrado.', tone:C.amber, icon:'🧱' },
      { key:'balanced', label:'Evolução equilibrada', description:'Faixa atual e projeção evoluem de forma proporcional.', tone:C.muted, icon:'📈' },
    ]
    const buckets = Object.fromEntries(definitions.map(item => [item.key, []]))
    for (const item of players) {
      const current = Number(item._nivel_atual_score)
      const potential = Number(item._nivel_potencial_score)
      if (!Number.isFinite(current) || !Number.isFinite(potential)) continue
      const confidence = Number(item._nivel_confianca) || 35
      const quadrant = classifyLevelQuadrant(current, potential, confidence)
      const key = buckets[quadrant.key] ? quadrant.key : 'balanced'
      buckets[key].push({ ...item, _card_current:current, _card_potential:potential, _card_confidence:confidence })
    }
    return definitions.map(definition => ({
      ...definition,
      players:buckets[definition.key]
        .sort((a,b) => (b._card_current + b._card_potential + b._card_confidence / 100) - (a._card_current + a._card_potential + a._card_confidence / 100)),
    }))
  }, [players])

  if (loading) return <LoadingState text="Carregando panorama de faixas e projeção..." />
  if (!players.length) return <EmptyState icon="🗂️" title="Panorama ainda sem fichas" text="Os cards serão preenchidos automaticamente após os uploads das ligas." />

  return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(235px,1fr))', gap:10 }}>
    {groups.map(group => <Link key={group.key} href="/database" style={{ textDecoration:'none' }}>
      <div className="scout-hover" style={{ height:'100%', minHeight:205, border:`1px solid ${group.tone}30`, borderTop:`4px solid ${group.tone}`, borderRadius:13, padding:13, background:'#fff', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
          <div><span style={{ fontSize:18 }}>{group.icon}</span><h3 style={{ color:C.ink, fontSize:11.5, fontWeight:950, marginTop:5 }}>{group.label}</h3><p style={{ color:C.muted, fontSize:8.5, lineHeight:1.4, marginTop:3 }}>{group.description}</p></div>
          <div style={{ minWidth:38, height:38, borderRadius:10, background:`${group.tone}12`, color:group.tone, display:'grid', placeItems:'center', fontSize:15, fontWeight:950 }}>{group.players.length}</div>
        </div>
        <div style={{ display:'grid', gap:6, marginTop:12, flex:1 }}>
          {group.players.slice(0,3).map((player,index) => <div key={player._canonical_id || `${player.nome}-${index}`} style={{ display:'grid', gridTemplateColumns:'20px 1fr auto', gap:7, alignItems:'center', borderTop:index ? `1px solid ${C.line}` : 0, paddingTop:index ? 6 : 0 }}>
            <strong style={{ color:index === 0 ? group.tone : C.muted, fontSize:8.5 }}>{index + 1}º</strong>
            <div style={{ minWidth:0 }}><strong style={{ display:'block', color:C.ink, fontSize:9.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player.nome}</strong><p style={{ color:C.muted, fontSize:7.6, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player.equipa || player.clube || '—'} · {player.posicao || '—'} · {String(player._liga || '').replace(/-/g,' ') || 'liga'} · {player.idade || '—'} anos</p></div>
            <div style={{ textAlign:'right' }}><strong style={{ color:group.tone, fontSize:8.5 }}>Faixa {player._nivel_atual || levelShort(player._card_current)}</strong><p style={{ color:C.purple, fontSize:7.2, marginTop:2 }}>Projeção {player._nivel_potencial || levelShort(player._card_potential)}</p></div>
          </div>)}
          {!group.players.length && <p style={{ color:C.muted, fontSize:8.5, padding:'14px 0' }}>Nenhum jogador neste recorte.</p>}
        </div>
        <div style={{ marginTop:10, color:group.tone, fontSize:8.3, fontWeight:900 }}>Abrir recorte no banco →</div>
      </div>
    </Link>)}
  </div>
}

function OpportunityMap({ items = [] }) {
  const data = items.slice(0, 60).map(item => ({ ...item, x: item.fit, y: item.profileScore, z: Math.max(90, Number(item.minutos) || 90) }))
  if (data.length < 2) return <EmptyState icon="◉" title="Mapa ainda sem recorte" text="São necessárias ao menos duas oportunidades elegíveis." />
  return <div style={{ height: 360 }}><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 18, right: 22, bottom: 30, left: 8 }}>
    <CartesianGrid stroke="#e2ede6" strokeDasharray="4 4" />
    <XAxis type="number" dataKey="x" domain={[0, 100]} tick={{ fontSize: 9 }} label={{ value: 'Fit Confiança', position: 'insideBottom', offset: -18, fontSize: 10 }} />
    <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{ fontSize: 9 }} label={{ value: 'Desempenho no perfil', angle: -90, position: 'insideLeft', fontSize: 10 }} />
    <ZAxis type="number" dataKey="z" range={[80, 430]} />
    <Tooltip content={({ active, payload }) => active && payload?.[0]?.payload ? <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}><strong style={{ fontSize: 11, color: C.ink }}>{payload[0].payload.nome}</strong><p style={{ fontSize: 9, color: C.muted }}>{payload[0].payload.equipe} · {payload[0].payload.posicao}</p><p style={{ fontSize: 9.5, color: C.green, marginTop: 5 }}>Fit {payload[0].payload.fit} · Perfil {payload[0].payload.profileScore} · Prioridade {payload[0].payload.opportunityScore}</p><p style={{ fontSize: 8.5, color: C.muted, marginTop: 3 }}>Mercado {payload[0].payload.marketBand} · {payload[0].payload.marketLabel}</p></div> : null} />
    <Scatter data={data} fill="#0a66b7" fillOpacity={0.72} />
  </ScatterChart></ResponsiveContainer></div>
}

function MarketContextPanel({ context, kpis }) {
  if (!context) return null
  const summary = context.summary || {}
  return <Panel
    title="Contexto competitivo aplicado"
    subtitle={`${context.currentCompetition || 'Planejamento 2027 · Série D'} · objetivo: ${context.objective || 'acesso à Série C'} · política ${context.policyVersion || 'contextual'}`}
    accent={C.green}
    style={{ marginBottom: 14 }}
    action={<StatusDot color={C.green}>TRIAGEM CONTEXTUAL</StatusDot>}
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 8, marginBottom: 12 }}>
      <MiniSignal label="Mercado imediato" value={summary.immediate || kpis?.immediatePlayers || 0} sub={`${kpis?.actionableLeagues || 0} ligas acionáveis`} tone={C.green} />
      <MiniSignal label="Projetos separados" value={summary.development || kpis?.developmentPlayers || 0} sub="não competem com soluções imediatas" tone={C.purple} />
      <MiniSignal label="Somente referência" value={summary.reference || kpis?.referencePlayers || 0} sub="fora da prioridade automática" tone={C.muted} />
      <MiniSignal label="Oportunidades reais" value={kpis?.opportunities || 0} sub="score 75+ após viabilidade" tone={C.blue} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 9 }}>
      <div style={{ padding: 11, borderRadius: 10, background: C.green2, border: `1px solid ${C.green3}` }}><strong style={{ color: C.green, fontSize: 8.5, textTransform: 'uppercase' }}>Mercado principal</strong><p style={{ color: C.ink, fontSize: 9.5, lineHeight: 1.5, marginTop: 4 }}>{(context.primaryMarkets || []).join(' · ')}</p></div>
      <div style={{ padding: 11, borderRadius: 10, background: '#fff8e8', border: '1px solid #f3d79d' }}><strong style={{ color: C.amber, fontSize: 8.5, textTransform: 'uppercase' }}>Primeiras divisões condicionais</strong><p style={{ color: C.ink, fontSize: 9.5, lineHeight: 1.5, marginTop: 4 }}>{(context.conditionalMarkets || []).join(' · ')}</p></div>
      <div style={{ padding: 11, borderRadius: 10, background: '#f6f7f8', border: `1px solid ${C.line}` }}><strong style={{ color: C.muted, fontSize: 8.5, textTransform: 'uppercase' }}>Não priorizar automaticamente</strong><p style={{ color: C.ink, fontSize: 9.5, lineHeight: 1.5, marginTop: 4 }}>{(context.referenceOnly || []).join(' · ')}</p></div>
    </div>
  </Panel>
}

function Needs({ items = [] }) {
  if (!items.length) return <EmptyState icon="🧩" title="Necessidades ainda não derivadas" text="Atualize as planilhas do Confiança ou crie focos de recrutamento." />
  return <div style={{ display: 'grid', gap: 9 }}>{items.slice(0, 7).map(item => <div key={item.id} className="scout-hover" style={{ border: `1px solid ${C.line}`, borderLeft: `4px solid ${item.priority === 'Alta' ? C.red : C.amber}`, borderRadius: 12, padding: 12, background: '#fff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><h3 style={{ fontSize: 11.2, color: C.ink, fontWeight: 950 }}>{item.title}</h3><p style={{ color: C.muted, fontSize: 9.2, marginTop: 4, lineHeight: 1.45 }}>{item.reason}</p></div><span style={{ height: 'fit-content', color: item.priority === 'Alta' ? C.red : C.amber, background: `${item.priority === 'Alta' ? C.red : C.amber}12`, borderRadius: 99, padding: '4px 7px', fontSize: 8.2, fontWeight: 950 }}>{item.priority}</span></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 }}><Link href={item.href || '/recomendacoes'} style={{ color: C.green, fontSize: 9.2, fontWeight: 900, textDecoration: 'none' }}>{item.group} · {item.candidates || 0} candidatos →</Link><span style={{ color:C.muted, fontSize:8 }}>gestão no Recrutamento</span></div>
  </div>)}</div>
}

function Alerts({ items = [] }) {
  if (!items.length) return <div style={{ padding: 14, color: C.green, background: C.green2, borderRadius: 11, fontSize: 10.5 }}>✓ Nenhum alerta operacional relevante no momento.</div>
  return <div style={{ display: 'grid', gap: 7 }}>{items.slice(0, 12).map((item, index) => { const tone = LEVEL[item.severity] || LEVEL.warning; return <Link href={item.href || '#'} key={`${item.fingerprint || item.title}-${index}`} style={{ textDecoration: 'none' }}><div style={{ display: 'grid', gridTemplateColumns: '78px 145px 1fr 14px', gap: 8, alignItems: 'center', border: `1px solid ${tone.color}28`, background: `${tone.color}08`, borderRadius: 9, padding: '9px 10px' }}><span style={{ fontSize: 8, color: tone.color, fontWeight: 950 }}>{item.severity?.toUpperCase()}</span><strong style={{ fontSize: 9.2, color: C.ink }}>{item.title}</strong><span style={{ fontSize: 9.5, color: C.muted }}>{item.message}</span><span style={{ color: tone.color }}>›</span></div></Link> })}</div>
}

function Funnel({ items = [] }) {
  const max = Math.max(1, ...items.map(item => item.total))
  return <div style={{ display: 'grid', gap: 9 }}>{items.map((item, index) => <Link key={item.stage} href="/centro-recrutamento" style={{ textDecoration: 'none' }}><div style={{ display: 'grid', gridTemplateColumns: '145px 1fr 36px', alignItems: 'center', gap: 9 }}><div><span style={{ color: C.ink, fontSize: 9.8, fontWeight: 850 }}>{item.stage}</span>{item.stale || item.missingQualitative ? <p style={{ color: C.amber, fontSize: 7.8, marginTop: 2 }}>{item.stale || 0} parado(s) · {item.missingQualitative || 0} sem parecer</p> : null}</div><div style={{ height: 12, borderRadius: 20, background: '#edf3ef', overflow: 'hidden' }}><div style={{ width: `${Math.max(3, item.total / max * 100)}%`, height: '100%', borderRadius: 20, background: index >= 3 ? C.green : index === 2 ? C.blue : C.purple }} /></div><strong style={{ color: C.ink, fontSize: 11, textAlign: 'right' }}>{item.total}</strong></div></Link>)}</div>
}

function Coverage({ items = [] }) {
  const marketTone = band => ({ A: C.green, B: C.blue, C: C.amber, E: C.purple, P: C.purple, R: C.muted }[band] || C.muted)
  return <div style={{ overflowX: 'auto' }} className="scout-scroll"><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}><thead><tr>{['Liga', 'Mercado', 'Acionáveis', 'Referência', 'Fonte', 'Jogadores', 'Elegíveis', 'Clubes', 'Corte', 'Atualização', 'Status', 'Qualidade'].map(label => <th key={label} style={{ textAlign: ['Liga', 'Mercado'].includes(label) ? 'left' : 'center', padding: '9px 8px', borderBottom: `1px solid ${C.line}`, fontSize: 8.2, color: C.muted, textTransform: 'uppercase' }}>{label}</th>)}</tr></thead><tbody>{items.map(item => { const tone = LEVEL[item.freshness?.level] || LEVEL.warning; const marketColor = marketTone(item.market?.band); return <tr key={item.slug} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: 10 }}><Link href={`/ligas-v2/${item.slug}`} style={{ color: C.green, textDecoration: 'none', fontSize: 10.2, fontWeight: 900 }}>{item.name}</Link></td><td style={{ padding: 10, minWidth: 160 }}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ color: marketColor, background: `${marketColor}12`, borderRadius: 99, padding: '4px 7px', fontSize: 8, fontWeight: 950 }}>{item.market?.band || 'R'}</span><span style={{ color: C.ink, fontSize: 8.8, fontWeight: 850 }}>{item.market?.label || 'Referência'}</span></div></td><td style={{ padding: 10, textAlign: 'center', fontSize: 9.7, color: C.green, fontWeight: 900 }}>{num(item.market?.actionablePlayers || 0)}</td><td style={{ padding: 10, textAlign: 'center', fontSize: 9.7, color: C.muted }}>{num(item.market?.referencePlayers || 0)}</td><td style={{ padding: 10, textAlign: 'center', fontSize: 8.8, color: item.source === 'wyscout' ? C.blue : C.green, fontWeight: 900 }}>{String(item.source).toUpperCase()}</td><td style={{ padding: 10, textAlign: 'center', fontSize: 9.7 }}>{num(item.players)}</td><td style={{ padding: 10, textAlign: 'center', fontSize: 9.7 }}>{num(item.eligible)}</td><td style={{ padding: 10, textAlign: 'center', fontSize: 9.7 }}>{num(item.teams)}</td><td style={{ padding: 10, textAlign: 'center', fontSize: 9.7 }}>{num(item.minimum)} min</td><td style={{ padding: 10, textAlign: 'center', fontSize: 9, color: C.muted }}>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString('pt-BR') : '—'}</td><td style={{ padding: 10, textAlign: 'center' }}><span style={{ color: tone.color, background: `${tone.color}12`, borderRadius: 99, padding: '4px 7px', fontSize: 8.2, fontWeight: 950 }}>{item.freshness?.label}</span></td><td style={{ padding: 10, textAlign: 'center' }}><span style={{ color: item.healthIssues?.length ? C.amber : C.green, fontSize: 8.8, fontWeight: 900 }}>{item.healthIssues?.length ? `${item.healthIssues.length} alerta(s)` : 'Validada'}</span></td></tr> })}</tbody></table></div>
}

function TopMetrics({ items = [] }) {
  if (!items.length) return <EmptyState icon="📦" title="Materiais ainda não calculados" />
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(245px,1fr))', gap: 10 }}>{items.map(metric => <div key={metric.key} style={{ border: `1px solid ${C.line}`, borderRadius: 11, padding: 12, background: '#fff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><h3 style={{ color: C.ink, fontSize: 10.5, fontWeight: 950 }}>{metric.label}</h3><p style={{ color: C.muted, fontSize: 8.2, marginTop: 2 }}>{metric.eligible} elegíveis · {metric.minimum} min</p></div></div>
    <div style={{ display: 'grid', gap: 5, marginTop: 9 }}>{(metric.rows || []).slice(0, 5).map((row, index) => <Link href={row.path} key={`${metric.key}-${row.nome}-${index}`} style={{ textDecoration: 'none' }}><div style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 7, alignItems: 'center', borderTop: index ? `1px solid ${C.line}` : 0, paddingTop: index ? 6 : 0 }}><strong style={{ color: index === 0 ? C.green : C.muted, fontSize: 9 }}>{index + 1}º</strong><div><strong style={{ color: C.ink, fontSize: 9.2 }}>{row.nome}</strong><p style={{ color: C.muted, fontSize: 7.8 }}>{row.equipe} · {row.posicao} · {row.marketBand || '—'}</p></div><div style={{ textAlign: 'right' }}><strong style={{ color: C.green, fontSize: 10.2 }}>{metricValue(row.value, metric.type)}</strong><p style={{ color: C.muted, fontSize: 7.5 }}>P{row.percentile}</p></div></div></Link>)}</div>
  </div>)}</div>
}

function Timeline({ items = [] }) {
  const chart = items.filter(item => Number(item.posicao) > 0).map(item => ({ rodada: `R${item.rodada}`, posicao: Number(item.posicao), adversario: item.adversario, resultado: item.resultado }))
  if (!items.length) return <EmptyState icon="📍" title="Linha do tempo indisponível" text="Importe a planilha coletiva do Confiança." />
  if (!chart.length) return <div style={{ padding: 13, borderRadius: 10, background: '#fff8e8', border: '1px solid #f3d79d', color: '#895b08', fontSize: 9.5 }}>As rodadas já foram associadas automaticamente, mas a posição na tabela não existe na planilha Sportsbase. Preencha a posição na aba Elenco › Posição do clube; os dados de rodada, adversário, resultado e sistema permanecem sincronizados.</div>
  return <div style={{ height: 235 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 12, right: 18, left: 0, bottom: 12 }}><CartesianGrid stroke="#e2ede6" strokeDasharray="4 4"/><XAxis dataKey="rodada" tick={{ fontSize: 8 }}/><YAxis reversed domain={[20, 1]} tick={{ fontSize: 8 }} allowDecimals={false}/><Tooltip/><Line type="monotone" dataKey="posicao" stroke="#0a66b7" strokeWidth={2.5} dot={{ r: 4 }}/></LineChart></ResponsiveContainer></div>
}

function Health({ health }) {
  const tone = health?.score >= 85 ? C.green : health?.score >= 65 ? C.amber : C.red
  return <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14, alignItems: 'center' }} className="scout-two-col"><div style={{ textAlign: 'center', padding: 16, borderRadius: 14, background: `${tone}0d`, border: `1px solid ${tone}35` }}><strong style={{ display: 'block', fontSize: 42, color: tone }}>{health?.score || 0}</strong><span style={{ color: tone, fontSize: 9.5, fontWeight: 950 }}>{health?.status || '—'}</span><p style={{ color: C.muted, fontSize: 7.5, marginTop: 4 }}>score das ligas acionáveis</p></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}><MiniSignal label="Atualizadas" value={health?.updated || 0} tone={C.green}/><MiniSignal label="Atenção" value={health?.warning || 0} tone={C.amber}/><MiniSignal label="Críticas" value={health?.stale || 0} tone={C.red}/><MiniSignal label="Referência atrasada" value={health?.referenceStale || 0} sub="não reduz o score" tone={C.muted}/></div></div>
}

export default function HomePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/dashboard-scouting', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Falha ao consolidar o painel.')
      setData(body)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const highPriority = useMemo(() => (data?.opportunities || []).filter(item => item.opportunityScore >= 75).length, [data])
  if (loading) return <ScoutingPage><LoadingState text="Carregando indicadores, oportunidades, necessidades e processos..." /></ScoutingPage>

  const k = data?.kpis || {}
  const clubData = data?.club || {}
  const clubSummary = clubData.summary || {}
  return <ScoutingPage maxWidth={1580}>
    <PageHeader
      eyebrow="CIC · SCOUTING & DATA"
      title="Decision Room"
      subtitle="Central de decisão para um Confiança no planejamento 2027, com foco no acesso à Série C. Desempenho, encaixe e viabilidade de mercado são avaliados separadamente."
      status={<StatusDot color={error ? C.red : C.green}>{error ? 'DADOS PARCIAIS' : `PROCESSAMENTO ${data?.run?.status === 'success' ? 'ATUALIZADO' : 'CARREGADO'}`}</StatusDot>}
      actions={<StatusDot color={C.green}>PAINEL DE EXIBIÇÃO</StatusDot>}
    />
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: -8, marginBottom: 14, color: C.muted, fontSize: 8.8 }}><span>Último processamento: {dateTime(data?.generatedAt)}</span><span>Execução #{data?.run?.id || data?.snapshotId || '—'}</span><span>Gatilho: {data?.run?.trigger || 'snapshot'}</span><span>Rotina de atualização: diária</span></div>
    {error && <div style={{ padding: 12, borderRadius: 11, color: C.red, background: '#fff3f1', border: '1px solid #f2cbc5', marginBottom: 15, fontSize: 11 }}>⚠ {error}</div>}

    <MarketContextPanel context={data?.marketContext} kpis={k} />

    <Panel title="Panorama de faixas internas" subtitle="Cards de exibição baseados na posição relativa dentro de cada liga e função. A análise detalhada e os filtros ficam na Base." style={{ marginBottom:14 }} action={<Link href="/database" style={{ color:C.green, fontSize:8.8, fontWeight:900, textDecoration:'none' }}>Abrir banco canônico →</Link>}><LevelCards /></Panel>

    <Panel title="Resumo executivo" subtitle="Texto baseado nas evidências exibidas no painel" accent={C.green} style={{ marginBottom: 14 }}><p style={{ color: C.ink, fontSize: 12, lineHeight: 1.65 }}>{data?.executiveSummary || 'Sem resumo disponível.'}</p></Panel>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))', gap: 10, marginBottom: 14 }}>
      <Kpi label="Universo acionável" value={num(k.immediatePlayers || 0)} sub={`${k.actionableLeagues || 0} ligas · ${k.referencePlayers || 0} só referência`} icon="🌐" />
      <Kpi label="Oportunidades realistas" value={highPriority} sub={`${k.u23Opportunities || 0} Sub-23 · ${k.highFit || 0} Fit 80+`} icon="🎯" tone={C.purple} />
      <Kpi label="Necessidades ativas" value={k.activeFoci || 0} sub={`${(data?.needs || []).filter(item => item.priority === 'Alta').length} prioridade(s) alta(s)`} icon="🧩" tone={C.red} />
      <Kpi label="Processo" value={k.pipeline || 0} sub={`${k.monitoring || 0} monitorados · ${k.final || 0} em decisão`} icon="🔄" tone={C.blue} />
      <Kpi label="Saúde dos dados" value={`${data?.health?.score || 0}/100`} sub={`${k.staleLeagues || 0} liga(s) pedindo atenção`} icon="🩺" tone={data?.health?.score >= 85 ? C.green : C.amber} />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(330px,.72fr)', gap: 14, marginBottom: 14 }} className="scout-two-col">
      <Panel title="Oportunidades prioritárias" subtitle="Score técnico: 35% Fit · 25% perfil · 15% idade · 10% amostra · 10% foco · 5% tendência; depois, ajuste de viabilidade do mercado" bodyStyle={{ padding: 0 }} action={<Link href="/recomendacoes" style={{ color: C.green, fontSize: 8.8, fontWeight: 900, textDecoration: 'none' }}>Abrir recomendações →</Link>}><OpportunityTable items={(data?.opportunities || []).slice(0, 12)} /></Panel>
      <Panel title="Necessidades do elenco × mercado" subtitle="Focos ativos, profundidade, dependência e lacunas do modelo" accent={C.red}><Needs items={data?.needs || []} /></Panel>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(330px,.75fr)', gap: 14, marginBottom: 14 }} className="scout-two-col">
      <Panel title="Radar do mercado acionável · Fit × desempenho" subtitle="Somente atletas aprovados pela regra contextual; tamanho do ponto = minutos" bodyStyle={{ padding: 7 }}><OpportunityMap items={data?.opportunities || []} /></Panel>
      <div style={{ display: 'grid', gap: 14 }}><Panel title="Saúde dos dados" subtitle="Somente ligas acionáveis impactam o score; referências ficam visíveis sem gerar falsa urgência"><Health health={data?.health} /></Panel><Panel title="Funil de recrutamento" subtitle="Quantidade, estagnação e ausência de parecer"><Funnel items={data?.funnel || []} /></Panel></div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(330px,.65fr)', gap: 14, marginBottom: 14 }} className="scout-two-col">
      <Panel title="Central de alertas" subtitle="Dados, watchlist, contratos, processo, crescimento e queda"><Alerts items={data?.alerts || []} /></Panel>
      <Panel title="Próximas ações" subtitle="Fila operacional gerada automaticamente"><div style={{ display: 'grid', gap: 7 }}>{(data?.actions || []).map(item => <Link href={item.href} key={item.label} style={{ textDecoration: 'none' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.line}`, padding: '8px 2px' }}><span style={{ color: C.ink, fontSize: 9.8 }}>{item.label}</span><strong style={{ color: item.priority === 'high' && item.value ? C.red : item.value ? C.green : C.muted, fontSize: 13 }}>{item.value}</strong></div></Link>)}</div></Panel>
    </div>

    <Panel title="Top 5 · mercado imediato" subtitle="12 métricas centrais apenas entre mercados acionáveis; volume, eficiência, amostra e viabilidade preservados" style={{ marginBottom: 14 }}><TopMetrics items={data?.topMetrics || []} /></Panel>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(330px,.75fr)', gap: 14, marginBottom: 14 }} className="scout-two-col">
      <Panel title="Confiança · snapshot competitivo" subtitle={`${clubSummary.games || 0} partidas coletivas Sportsbase`} accent={C.green} action={<Link href="/elenco" style={{ color: C.green, fontSize: 8.8, fontWeight: 900, textDecoration: 'none' }}>Abrir dossiê →</Link>}>
        {clubSummary.games ? <><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}><MiniSignal label="Pontos" value={clubSummary.points || 0} sub={`${num(clubSummary.performance, 1)}% aproveitamento`} /><MiniSignal label="Saldo" value={`${Number(clubSummary.goalDifference) > 0 ? '+' : ''}${clubSummary.goalDifference || 0}`} sub={`${clubSummary.goalsFor || 0} GP · ${clubSummary.goalsAgainst || 0} GC`} tone={Number(clubSummary.goalDifference) >= 0 ? C.green : C.red} /><MiniSignal label="Chances/jogo" value={num(clubSummary.averages?.chances, 1)} sub={`${num(clubSummary.averages?.shots, 1)} chutes`} tone={C.blue} /><MiniSignal label="Progressão" value={num(clubSummary.averages?.progressivePasses, 1)} sub="passes progressivos/jogo" tone={C.purple} /></div><div style={{ marginTop: 12, padding: 12, background: C.green2, borderRadius: 10, border: `1px solid ${C.green3}` }}><p style={{ color: C.green, fontSize: 8.5, fontWeight: 950, textTransform: 'uppercase' }}>Identidade atual</p><strong style={{ display: 'block', color: C.ink, fontSize: 12.5, marginTop: 4 }}>{clubData?.model?.identity || 'Modelo em construção'}</strong></div></> : <EmptyState icon="🟢" title="Confiança sem dados" text="Suba as planilhas coletiva e individual na página Elenco." />}
      </Panel>
      <Panel title="Linha do tempo da posição" subtitle="Rodadas sincronizadas automaticamente; posição confirmada pelo analista quando não existe na fonte"><Timeline items={clubData?.timeline || []} /></Panel>
    </div>

    <Panel title="Cobertura, atualização e viabilidade das ligas" subtitle="A base pode monitorar tudo; o Decision Room separa o que é acionável, projeto ou somente referência" bodyStyle={{ padding: 0 }} style={{ marginBottom: 14 }} action={<Link href="/ligas-v2" style={{ color: C.green, fontSize: 8.8, fontWeight: 900, textDecoration: 'none' }}>Ver ligas →</Link>}><Coverage items={data?.coverage || []} /></Panel>

    <Panel title="Histórico recente de importações" subtitle="Fornecedor, arquivo, linhas processadas e validações" bodyStyle={{ padding: 0 }}>
      <div style={{ overflowX: 'auto' }} className="scout-scroll"><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}><thead><tr>{['Data', 'Fonte', 'Tipo', 'Liga', 'Arquivo', 'Processados', 'Elegíveis', 'Clubes', 'Status'].map(label => <th key={label} style={{ padding: 9, textAlign: label === 'Arquivo' ? 'left' : 'center', color: C.muted, fontSize: 8.2, borderBottom: `1px solid ${C.line}`, textTransform: 'uppercase' }}>{label}</th>)}</tr></thead><tbody>{(data?.importLogs || []).map(item => <tr key={item.id} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8 }}>{dateTime(item.created_at)}</td><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8, fontWeight: 900, color: item.provider === 'wyscout' ? C.blue : C.green }}>{String(item.provider).toUpperCase()}</td><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8 }}>{item.source_type}</td><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8 }}>{item.league_slug || 'Confiança'}</td><td style={{ padding: 9, fontSize: 8.8, color: C.ink }}>{item.filename || '—'}</td><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8 }}>{item.rows_processed}</td><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8 }}>{item.rows_eligible}</td><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8 }}>{item.clubs}</td><td style={{ padding: 9, textAlign: 'center', fontSize: 8.8, color: item.status === 'success' ? C.green : C.red, fontWeight: 900 }}>{item.status}</td></tr>)}</tbody></table></div>
    </Panel>
  </ScoutingPage>
}
