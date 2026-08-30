'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CartesianGrid, Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  RadialBar, RadialBarChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import {
  Button, C, EmptyState, Kpi, LoadingState, PageHeader, Panel,
  PercentileBar, ScoutingPage, StatusDot,
} from '@/app/components/scouting/ScoutingUI'
import { COMPETITIVE_LEVELS, adjustRelativeIndex, competitiveLevelLabel, relativeGradeFromIndex, robustnessFromScore } from '@/data/competitive-levels'
import { playerFootLabel } from '@/data/player-foot'

const num = (value, decimals = 0) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits:decimals, maximumFractionDigits:decimals }) : '—'

function LevelCard({ title, level, tone, description, index }) {
  return <div style={{ padding:15, borderRadius:14, border:`1px solid ${tone}32`, background:`${tone}0d` }}>
    <p style={{ color:C.muted, fontSize:8.5, fontWeight:900, textTransform:'uppercase', letterSpacing:'.6px' }}>{title}</p>
    <strong style={{ display:'block', color:tone, fontSize:22, marginTop:6 }}>{level?.label || '—'}</strong>
    {Number.isFinite(Number(index)) && <span style={{ color:C.muted, fontSize:8.5 }}>Índice relativo {num(index,1)}</span>}
    <p style={{ color:C.muted, fontSize:9, marginTop:5, lineHeight:1.45 }}>{description}</p>
  </div>
}

function RadarPanel({ title, subtitle, data, candidateName, benchmarkName }) {
  if (!data?.length) return <Panel title={title} subtitle={subtitle}><EmptyState icon="◌" title="Radar indisponível" text="A fonte atual não oferece métricas elegíveis suficientes para esta comparação." /></Panel>
  return <Panel title={title} subtitle={subtitle} bodyStyle={{ padding:8 }}>
    <div style={{ height:360 }}><ResponsiveContainer width="100%" height="100%"><RadarChart data={data} outerRadius="70%">
      <PolarGrid stroke="#dbe9df" />
      <PolarAngleAxis dataKey="subject" tick={{ fill:'#526d5d', fontSize:9.5, fontWeight:750 }} />
      <Tooltip formatter={value => [`P${Math.round(Number(value) || 0)}`, '']} />
      <Radar name={candidateName} dataKey="candidate" stroke={C.green} fill={C.green} fillOpacity={0.28} strokeWidth={2.5} />
      <Radar name={benchmarkName} dataKey="benchmark" stroke={C.purple} fill={C.purple} fillOpacity={0.1} strokeWidth={2} />
      <Legend wrapperStyle={{ fontSize:10 }} />
    </RadarChart></ResponsiveContainer></div>
  </Panel>
}

function PizzaPlot({ data = [] }) {
  if (!data.length) return <EmptyState icon="◉" title="Pizza plot indisponível" text="Sem percentis suficientes no perfil atual." />
  return <div style={{ display:'grid', gridTemplateColumns:'minmax(300px,.9fr) minmax(260px,1.1fr)', gap:12, alignItems:'center' }} className="scout-two-col">
    <div style={{ height:340 }}><ResponsiveContainer width="100%" height="100%"><RadialBarChart innerRadius="20%" outerRadius="95%" data={data} startAngle={90} endAngle={-270} barSize={12}>
      <RadialBar dataKey="value" background cornerRadius={8} fill={C.green} />
      <Tooltip formatter={(value, name, item) => [`P${Math.round(Number(value) || 0)}`, item?.payload?.label || 'Percentil']} />
    </RadialBarChart></ResponsiveContainer></div>
    <div style={{ display:'grid', gap:8 }}>{data.map((item, index) => <div key={item.key} style={{ display:'grid', gridTemplateColumns:'22px 1fr auto', gap:8, alignItems:'center', padding:'9px 10px', border:`1px solid ${C.line}`, borderRadius:10, background:'#fbfdfb' }}><span style={{ width:20, height:20, borderRadius:999, display:'grid', placeItems:'center', background:C.green2, color:C.green, fontSize:9, fontWeight:950 }}>{index + 1}</span><span style={{ color:C.ink, fontSize:10.5, fontWeight:800 }}>{item.label}</span><strong style={{ color:C.green, fontSize:11 }}>P{item.value}</strong></div>)}</div>
  </div>
}

function ScatterPanel({ scatter, playerName }) {
  if (!scatter?.points?.length) return <EmptyState icon="◌" title="Dispersão indisponível" text="Não foi encontrado um par volume × eficiência elegível para esta função." />
  return <div style={{ height:390 }}><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top:20, right:20, bottom:35, left:8 }}>
    <CartesianGrid stroke="#e2ede6" strokeDasharray="4 4" />
    <XAxis type="number" dataKey="x" name={scatter.x.label} tick={{ fontSize:9 }} label={{ value:scatter.x.label, position:'insideBottom', offset:-20, fontSize:9.5 }} />
    <YAxis type="number" dataKey="y" name={scatter.y.label} tick={{ fontSize:9 }} label={{ value:scatter.y.label, angle:-90, position:'insideLeft', fontSize:9.5 }} />
    <ZAxis type="number" dataKey="minutos" range={[55,320]} />
    <Tooltip cursor={{ strokeDasharray:'3 3' }} content={({ active, payload }) => active && payload?.[0]?.payload ? <div style={{ background:'#fff', border:`1px solid ${C.line}`, padding:9, borderRadius:9, boxShadow:'0 8px 20px rgba(0,0,0,.12)' }}><strong style={{ color:C.ink, fontSize:10.5 }}>{payload[0].payload.nome}</strong><p style={{ color:C.muted, fontSize:8.5 }}>{payload[0].payload.equipa} · {num(payload[0].payload.minutos)} min</p><p style={{ color:C.green, fontSize:9, marginTop:4 }}>{scatter.x.label}: {num(payload[0].payload.x,2)} · {scatter.y.label}: {num(payload[0].payload.y,1)}</p></div> : null} />
    <Scatter name="Pares da liga" data={scatter.points.filter(item => !item.selected)} fill={C.blue} fillOpacity={0.45} />
    <Scatter name={playerName} data={scatter.points.filter(item => item.selected)} fill={C.green} />
    <Legend wrapperStyle={{ fontSize:10 }} />
  </ScatterChart></ResponsiveContainer></div>
}

export default function PlayerMasterPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [levelForm, setLevelForm] = useState({ real:'', potentialReal:'', note:'' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true); setError('')
    fetch(`/api/player-master/${id}`).then(async response => {
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Falha ao carregar a ficha.')
      setData(json)
      setLevelForm({
        real:json.levels.real.score === null ? '' : String(Math.round(json.levels.real.score)),
        potentialReal:json.levels.potentialReal.score === null ? '' : String(Math.round(json.levels.potentialReal.score)),
        note:json.levels.real.note || '',
      })
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }

  useEffect(() => { if (id) load() }, [id])

  const leagueRadar = useMemo(() => (data?.analysis?.radar || []).filter(item => Number.isFinite(Number(item.leaguePercentile))).slice(0,8).map(item => ({ subject:item.label, candidate:item.leaguePercentile, benchmark:50 })), [data])
  const guaraniRadar = useMemo(() => (data?.analysis?.radar || []).filter(item => Number.isFinite(Number(item.playerVsGuarani)) && Number.isFinite(Number(item.guaraniAverage))).slice(0,8).map(item => ({ subject:item.label, candidate:item.playerVsGuarani, benchmark:item.guaraniAverage })), [data])
  const profileBands = useMemo(() => Object.entries(data?.latest?._iap_por_perfil || {}).map(([profile, raw]) => { const adjusted = adjustRelativeIndex(raw, data?.levels?.confidence || 0); return { profile, raw:adjusted.rawIndex, adjusted:adjusted.adjustedIndex, grade:relativeGradeFromIndex(adjusted.adjustedIndex) } }).sort((a,b) => b.adjusted - a.adjusted), [data])

  async function saveLevels() {
    setSaving(true)
    try {
      const response = await fetch(`/api/player-master/${id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(levelForm) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Falha ao salvar')
      setEditing(false); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  if (loading) return <ScoutingPage><LoadingState text="Consolidando ficha-mãe, histórico e comparações..." /></ScoutingPage>
  if (error || !data?.player) return <ScoutingPage><EmptyState icon="⚠️" title="Ficha indisponível" text={error || 'Jogador não encontrado.'} action={<Link href="/database"><Button>Voltar à Base</Button></Link>} /></ScoutingPage>

  const { player, levels, latest, league, analysis, sources } = data
  return <ScoutingPage maxWidth={1550}>
    <PageHeader
      eyebrow="FICHA-MÃE · IDENTIDADE CANÔNICA"
      title={player.nome}
      subtitle={`${player.clube || 'Sem clube'} · ${player.posicao || 'posição não informada'} · ${player.idade || '—'} anos · Pé ${playerFootLabel(player.pe)} · ${league?.nome || 'liga não informada'}`}
      status={<StatusDot color={levels.confidence >= 80 ? C.green : levels.confidence >= 60 ? C.amber : C.red}>{`${levels.robustnessLabel} · ${levels.quadrant?.label || 'faixa em consolidação'}`}</StatusDot>}
      actions={<><Link href="/database"><Button variant="secondary">← Base</Button></Link><Link href={`/comparacao?nome=${encodeURIComponent(player.nome)}&equipa=${encodeURIComponent(player.clube || '')}&liga=${encodeURIComponent(league?.slug || '')}`}><Button>⚖️ Comparar</Button></Link></>}
    />

    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:15 }}>
      <Kpi label="Clube atual" value={player.clube || '—'} sub={league?.nome || 'último contexto registrado'} icon="🏟️" />
      <Kpi label="Posição" value={player.posicao || '—'} sub={analysis?.group || 'grupo funcional'} icon="🧭" tone={C.blue} />
      <Kpi label="Idade" value={player.idade || '—'} sub={player.nacionalidade || 'nacionalidade não informada'} icon="📅" tone={C.purple} />
      <Kpi label="Amostra recente" value={`${num(latest?.minutos)} min`} sub={`${num(latest?.jogos)} partidas · ${latest?._fonte || '—'}`} icon="⏱️" tone={C.amber} />
      <Kpi label="Fit Confiança" value={analysis?.scouting?.finalScore || '—'} sub="camada separada do nivelamento" icon="🟢" tone={C.green} />
    </div>

    <Panel title="Faixa relativa na competição" subtitle="As letras S–E comparam o atleta apenas com jogadores da mesma liga, temporada, posição e perfil. Não representam equivalência com outra divisão." style={{ marginBottom:15 }} action={<Button variant="secondary" onClick={() => setEditing(value => !value)}>{editing ? 'Cancelar' : 'Validar faixa'}</Button>}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10 }} className="scout-filter-grid">
        <LevelCard title="Faixa automática" level={levels.recommended} index={levels.criteria?.adjustedIndex} tone={C.green} description={`Calculada pelo perfil ${levels.criteria?.profile || analysis?.profile || 'funcional'}, com ajuste de amostra.`} />
        <LevelCard title="Faixa validada · scout" level={levels.real} tone={C.blue} description="Parecer técnico após vídeo e contexto. Quando preenchido, prevalece no sistema." />
        <LevelCard title="Faixa efetiva" level={levels.current} index={levels.criteria?.adjustedIndex} tone={levels.current.source === 'analista' ? C.blue : C.green} description={levels.current.source === 'analista' ? 'Usa a validação do scout.' : 'Usa a faixa automática enquanto não houver validação.'} />
        <LevelCard title="Projeção interna" level={levels.potential} index={levels.criteria?.projectionIndex} tone={C.purple} description="Estimativa de evolução dentro de ambiente competitivo semelhante; não indica divisão futura." />
      </div>
      <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(4,minmax(170px,1fr))', gap:8 }} className="scout-filter-grid">
        <div style={{ padding:9, border:`1px solid ${C.line}`, borderRadius:9, color:C.muted, fontSize:9 }}><b style={{ color:C.ink }}>Contexto:</b> {league?.nome || levels.criteria?.leagueSlug || '—'} · {latest?.posicao || player.posicao || '—'} · {levels.criteria?.season || '—'}</div>
        <div style={{ padding:9, border:`1px solid ${C.line}`, borderRadius:9, color:C.muted, fontSize:9 }}><b style={{ color:C.ink }}>Índice bruto:</b> {num(levels.criteria?.rawIndex,1)} · ajustado {num(levels.criteria?.adjustedIndex,1)}</div>
        <div style={{ padding:9, border:`1px solid ${C.line}`, borderRadius:9, color:C.muted, fontSize:9 }}><b style={{ color:C.ink }}>Cobertura:</b> {levels.criteria?.metricCoverage || 0}% · {levels.criteria?.metricCount || 0} métricas · {levels.criteria?.comparisonPool || 0} pares</div>
        <div style={{ padding:9, border:`1px solid ${C.line}`, borderRadius:9, color:C.muted, fontSize:9 }}><b style={{ color:C.ink }}>Robustez:</b> {levels.robustnessLabel} · {levels.confidence}/100</div>
      </div>
      <div style={{ marginTop:10, padding:'9px 11px', borderRadius:9, border:`1px solid ${levels.recommendationType === 'estatístico' ? '#cce9d8' : '#fed7aa'}`, background:levels.recommendationType === 'estatístico' ? '#f3fbf6' : '#fff7ed', color:levels.recommendationType === 'estatístico' ? C.green : '#9a3412', fontSize:9.3, fontWeight:800 }}>
        {levels.recommendationType === 'estatístico' ? 'Resultado estatístico por perfil, ajustado pela robustez.' : 'Resultado provisório aproximado da média do grupo porque a amostra, cobertura ou grupo comparável ainda são limitados.'} Tendência: {levels.criteria?.trend || 'Estável'}.
      </div>
      {editing && <div style={{ marginTop:14, padding:12, background:'#f7faf8', border:`1px solid ${C.line}`, borderRadius:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(170px,1fr))', gap:8 }} className="scout-two-col">
          {[['real','Faixa validada atual'],['potentialReal','Projeção validada']].map(([key,label]) => <label key={key} style={{ fontSize:9, color:C.muted, fontWeight:850 }}>{label}<select value={levelForm[key]} onChange={event => setLevelForm(previous => ({ ...previous, [key]:event.target.value }))} style={{ width:'100%', marginTop:5, border:`1px solid ${C.line}`, borderRadius:8, padding:'8px 9px', background:'#fff' }}><option value="">Não validada</option>{COMPETITIVE_LEVELS.slice().reverse().map(item => <option key={item.score} value={item.score}>{item.label}</option>)}</select></label>)}
        </div>
        <label style={{ display:'block', marginTop:9, fontSize:9, color:C.muted, fontWeight:850 }}>Justificativa obrigatória da alteração<textarea value={levelForm.note} onChange={event => setLevelForm(previous => ({ ...previous, note:event.target.value }))} placeholder="Explique as evidências de vídeo, o contexto coletivo e por que a faixa automática deve ser ajustada." style={{ width:'100%', minHeight:82, marginTop:5, resize:'vertical', border:`1px solid ${C.line}`, borderRadius:8, padding:'9px 10px', background:'#fff', fontFamily:'inherit', fontSize:10 }} /></label>
        <div style={{ marginTop:9, display:'flex', justifyContent:'flex-end' }}><Button onClick={saveLevels} disabled={saving || (levelForm.real && !levelForm.note.trim())}>{saving ? 'Salvando...' : 'Salvar validação'}</Button></div>
      </div>}
    </Panel>

    {!!profileBands.length && <Panel title="Faixas por perfil funcional" subtitle="O mesmo jogador pode ocupar faixas diferentes conforme a função avaliada. A faixa principal é o melhor encaixe estatístico, não uma verdade única." style={{ marginBottom:15 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:9 }}>{profileBands.slice(0,8).map((item,index) => <div key={item.profile} style={{ padding:11, border:`1px solid ${index === 0 ? '#c7e6d3' : C.line}`, borderRadius:10, background:index === 0 ? '#f3fbf6' : '#fff' }}><div style={{ display:'flex', justifyContent:'space-between', gap:8 }}><div><span style={{ color:C.muted, fontSize:7.8, fontWeight:900 }}>{index === 0 ? 'PERFIL PRINCIPAL' : 'PERFIL SECUNDÁRIO'}</span><strong style={{ display:'block', color:C.ink, fontSize:10.5, marginTop:3 }}>{item.profile}</strong></div><strong style={{ color:item.grade.score >= 8 ? C.purple : item.grade.score >= 6 ? C.green : C.muted, fontSize:18 }}>{item.grade.label}</strong></div><p style={{ color:C.muted, fontSize:8.3, marginTop:6 }}>Índice bruto {num(item.raw,1)} · ajustado {num(item.adjusted,1)}</p></div>)}</div>
    </Panel>}

    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:15, marginBottom:15 }} className="scout-two-col">
      <RadarPanel title="Radar · mesma posição na liga" subtitle={`${analysis?.groupSize || 0} jogadores elegíveis; referência roxa = mediana.`} data={leagueRadar} candidateName={player.nome} benchmarkName="Mediana da liga" />
      <RadarPanel title="Radar · mesma posição no Confiança" subtitle={`${analysis?.guaraniGroupSize || data.guarani?.players || 0} referências internas; não altera a faixa relativa da liga.`} data={guaraniRadar} candidateName={player.nome} benchmarkName="Média Confiança" />
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:15, marginBottom:15 }} className="scout-two-col">
      <Panel title="Pizza plot · assinatura estatística" subtitle="As áreas mais fortes do jogador no contexto posicional da liga"><PizzaPlot data={data.pizza || []} /></Panel>
      <Panel title="Dispersão · volume × eficiência" subtitle="Cada ponto é um jogador da mesma função; o tamanho representa minutos"><ScatterPanel scatter={data.scatter} playerName={player.nome} /></Panel>
    </div>

    <Panel title="Leitura detalhada" subtitle="Percentis e valores da fonte mais recente" style={{ marginBottom:15 }}>
      {analysis?.radar?.length ? <div style={{ display:'grid', gap:11 }}>{analysis.radar.slice(0,14).map(item => <PercentileBar key={item.key} label={item.fullLabel || item.label} value={item.leaguePercentile || 0} raw={item.value === null || item.value === undefined ? item.reason || 'Sem dado' : num(item.value, item.type === 'percent' ? 1 : 2)} suffix={item.type === 'percent' ? '%' : ''} color={item.eligible ? C.green : C.muted} />)}</div> : <EmptyState icon="◌" title="Sem métricas avançadas" text="A ficha possui cadastro e nivelamento, mas a fonte atual não oferece uma matriz estatística completa." />}
    </Panel>

    <Panel title="Histórico consolidado" subtitle="Todas as aparições do atleta em ligas, temporadas e fornecedores; nenhuma cria uma nova ficha">
      {!sources?.length ? <EmptyState icon="🧬" title="Sem histórico de fontes" text="O histórico será ampliado nos próximos uploads." /> : <div className="scout-scroll" style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}><thead><tr>{['Temporada','Liga','Fonte','Clube','Posição','Minutos','Índice bruto','Faixa na fonte','Robustez'].map(label => <th key={label} style={{ padding:'9px 10px', borderBottom:`1px solid ${C.line}`, color:C.muted, fontSize:8.5, textTransform:'uppercase', textAlign:['Minutos','Desempenho','Confiança'].includes(label) ? 'center' : 'left' }}>{label}</th>)}</tr></thead><tbody>{sources.map(source => <tr key={source.id} style={{ borderBottom:`1px solid #edf3ef` }}><td style={{ padding:10, fontSize:10 }}>{source.season}</td><td style={{ padding:10, fontSize:10, fontWeight:800 }}>{source.leagueName}</td><td style={{ padding:10, fontSize:9, color:C.muted }}>{source.provider}</td><td style={{ padding:10, fontSize:10 }}>{source.club || '—'}</td><td style={{ padding:10, fontSize:10 }}>{source.position || '—'}</td><td style={{ padding:10, textAlign:'center', fontSize:10 }}>{num(source.minutes)}</td><td style={{ padding:10, textAlign:'center', fontSize:10 }}>{source.performanceScore}</td><td style={{ padding:10, fontSize:9.5, fontWeight:850, color:C.green }}>{competitiveLevelLabel(source.levelCurrent)}</td><td style={{ padding:10, textAlign:'center', fontSize:10 }}>{robustnessFromScore(source.levelConfidence).label} · {source.levelConfidence || 0}</td></tr>)}</tbody></table></div>}
    </Panel>
  </ScoutingPage>
}
