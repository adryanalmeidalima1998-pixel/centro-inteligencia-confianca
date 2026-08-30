'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CircleAlert, ShieldCheck, Sparkles } from 'lucide-react'
import {
  Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  Button, C, EmptyState, Kpi, LoadingState, PageHeader, Panel, PercentileBar, ScoutingPage, StatusDot,
} from '@/app/components/scouting/ScoutingUI'

function number(value, decimals = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return parsed.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function radarLabel(value) {
  const label = String(value || '')
    .replace('Ações defensivas com sucesso', 'Ações defensivas')
    .replace('Passes para finalização', 'Passes p/ finalização')
    .replace('Corridas progressivas', 'Corridas prog.')
    .replace('Passes progressivos', 'Passes prog.')
    .replace('Duelos defensivos ganhos', 'Duelos def. ganhos')
    .replace('Duelos aéreos ganhos', 'Duelos aéreos')
    .replace('Precisão dos passes', 'Precisão passes')
  return label.length > 20 ? `${label.slice(0, 19)}…` : label
}

function pizzaLabel(value) {
  return String(value || '')
    .replace('/90', '')
    .replace('Ações defensivas com sucesso', 'Ações defensivas')
    .replace('Passes para finalização', 'Passes p/ finalização')
    .replace('Passes para o terço final', 'Passes terço final')
    .replace('Precisão dos passes progressivos', 'Precisão passes prog.')
    .replace('Precisão dos passes longos', 'Precisão passes longos')
    .replace('Precisão dos passes inteligentes', 'Precisão passes intelig.')
    .replace('Corridas progressivas', 'Corridas progressivas')
    .replace('Duelos defensivos ganhos', 'Duelos defensivos')
    .replace('Duelos ofensivos ganhos', 'Duelos ofensivos')
    .replace('Duelos aéreos ganhos', 'Duelos aéreos')
    .replace('Ações atacantes com sucesso', 'Ações atacantes')
}

function polarPoint(cx, cy, radius, angle) {
  const radians = (angle - 90) * Math.PI / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function wedgePath(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
  const outerStart = polarPoint(cx, cy, outerRadius, startAngle)
  const outerEnd = polarPoint(cx, cy, outerRadius, endAngle)
  const innerEnd = polarPoint(cx, cy, innerRadius, endAngle)
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function PizzaPlot({ metrics, reference, roleLabel }) {
  const data = metrics.map(item => ({
    ...item,
    percentile: reference === 'league' ? item.leaguePercentile : item.globalPercentile,
  })).filter(item => Number.isFinite(item.percentile))

  if (!data.length) return <EmptyState icon="📊" title="Sem percentis disponíveis" text="A amostra não possui métricas elegíveis suficientes para o pizza plot." />

  const size = 720
  const cx = size / 2
  const cy = size / 2
  const innerRadius = 58
  const outerRadius = 236
  const labelRadius = 286
  const slice = 360 / data.length

  return <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Pizza plot percentílico de ${roleLabel}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
      {[25, 50, 75, 100].map(mark => {
        const radius = innerRadius + (outerRadius - innerRadius) * mark / 100
        return <circle key={mark} cx={cx} cy={cy} r={radius} fill="none" stroke="#dfeae3" strokeWidth="1" strokeDasharray={mark === 100 ? '0' : '4 5'} />
      })}
      {data.map((item, index) => {
        const start = index * slice + 1.2
        const end = (index + 1) * slice - 1.2
        const valueRadius = innerRadius + (outerRadius - innerRadius) * Math.max(0, Math.min(100, item.percentile)) / 100
        const middle = (start + end) / 2
        const labelPoint = polarPoint(cx, cy, labelRadius, middle)
        const anchor = labelPoint.x < cx - 10 ? 'end' : labelPoint.x > cx + 10 ? 'start' : 'middle'
        const label = pizzaLabel(item.label)
        const words = label.split(' ')
        const splitAt = Math.ceil(words.length / 2)
        const first = words.slice(0, splitAt).join(' ')
        const second = words.slice(splitAt).join(' ')
        return <g key={item.key}>
          <path d={wedgePath(cx, cy, innerRadius, outerRadius, start, end)} fill="#eef4f0" stroke="#ffffff" strokeWidth="1" />
          <path d={wedgePath(cx, cy, innerRadius, valueRadius, start, end)} fill={item.color || C.green} fillOpacity="0.84" stroke="#ffffff" strokeWidth="1.4" />
          <line x1={polarPoint(cx, cy, outerRadius + 4, middle).x} y1={polarPoint(cx, cy, outerRadius + 4, middle).y} x2={polarPoint(cx, cy, labelRadius - 13, middle).x} y2={polarPoint(cx, cy, labelRadius - 13, middle).y} stroke={item.color || C.green} strokeOpacity="0.45" strokeWidth="1" />
          <text x={labelPoint.x} y={labelPoint.y - (second ? 8 : 1)} textAnchor={anchor} fill={C.ink} fontSize="10.5" fontWeight="750">
            <tspan x={labelPoint.x}>{first}</tspan>
            {second && <tspan x={labelPoint.x} dy="13">{second}</tspan>}
            <tspan x={labelPoint.x} dy="14" fill={item.color || C.green} fontSize="13" fontWeight="950">P{Math.round(item.percentile)}</tspan>
          </text>
        </g>
      })}
      <circle cx={cx} cy={cy} r={innerRadius - 3} fill="#ffffff" stroke={C.green3} strokeWidth="2" />
      <text x={cx} y={cy - 7} textAnchor="middle" fill={C.green} fontSize="12" fontWeight="950">{roleLabel}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill={C.muted} fontSize="9" fontWeight="750">PERCENTIS</text>
    </svg>
  </div>
}

function RadarPanel({ title, subtitle, data, athleteName }) {
  return <Panel title={title} subtitle={subtitle} bodyStyle={{ padding: '8px 10px 14px' }}>
    <div style={{ height: 360 }}><ResponsiveContainer width="100%" height="100%"><RadarChart data={data} outerRadius="70%">
      <PolarGrid stroke="#dfece4" />
      <PolarAngleAxis dataKey="subject" tick={{ fill: C.muted, fontSize: 9, fontWeight: 700 }} />
      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} />
      <Tooltip formatter={value => [`P${Math.round(Number(value) || 0)}`, 'Percentil']} />
      <Legend wrapperStyle={{ fontSize: 10 }} />
      <Radar name={athleteName} dataKey="athlete" stroke={C.green} fill={C.green} fillOpacity={0.28} strokeWidth={2.4} />
      <Radar name="Mediana" dataKey="median" stroke={C.purple} fill={C.purple} fillOpacity={0.07} strokeWidth={1.8} strokeDasharray="4 3" />
    </RadarChart></ResponsiveContainer></div>
  </Panel>
}

function SignalList({ title, items, tone, icon }) {
  return <Panel title={title} action={icon} accent={tone}>
    <div style={{ display: 'grid', gap: 9 }}>{items.map(item => <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '10px 11px', borderRadius: 11, background: `${tone}08`, border: `1px solid ${tone}20` }}>
      <div><strong style={{ fontSize: 10.5, color: C.ink }}>{item.label}</strong><p style={{ fontSize: 8.8, color: C.muted, marginTop: 2 }}>Valor observado: {number(item.value, 2)}</p></div>
      <span style={{ color: tone, fontSize: 14, fontWeight: 950 }}>P{number(item.globalPercentile)}</span>
    </div>)}</div>
  </Panel>
}

export default function Sub20PlayerPage() {
  const params = useParams()
  const id = params?.id
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pizzaReference, setPizzaReference] = useState('global')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/sub20?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível abrir o perfil.')
        setPayload(body)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const globalRadar = useMemo(() => (payload?.pizzaMetrics || []).filter(item => Number.isFinite(item.globalPercentile)).map(item => ({ subject: radarLabel(item.label), athlete: item.globalPercentile, median: 50 })), [payload])
  const leagueRadar = useMemo(() => (payload?.pizzaMetrics || []).filter(item => Number.isFinite(item.leaguePercentile)).map(item => ({ subject: radarLabel(item.label), athlete: item.leaguePercentile, median: 50 })), [payload])

  if (loading) return <ScoutingPage><LoadingState text="Calculando perfil do atleta..." /></ScoutingPage>
  if (error || !payload) return <ScoutingPage><EmptyState icon="⚠️" title="Perfil indisponível" text={error || 'Atleta não encontrado.'} action={<Link href="/sub20"><Button variant="secondary">Voltar ao ranking</Button></Link>} /></ScoutingPage>

  const { player, comparison, metrics, pizzaMetrics, strengths, watchouts } = payload
  const currentClubNote = player.equipaAtual && player.equipaAtual !== player.equipa ? ` · clube atual: ${player.equipaAtual}` : ''
  return <ScoutingPage maxWidth={1450}>
    <PageHeader
      eyebrow="CIC · PERFIL SUB-20"
      title={player.nome}
      subtitle={`${player.equipa} · ${player.liga} · ${player.posicao} · ${number(player.idade)} anos${currentClubNote}`}
      status={<StatusDot color={C.green}>{player.roleLabel}</StatusDot>}
      actions={<Link href="/sub20"><Button variant="secondary"><ArrowLeft size={14} />Voltar ao ranking</Button></Link>}
    />

    <div className="cig-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 11, marginBottom: 16 }}>
      <Kpi label="Ranking geral" value={`#${player.rankGlobal}`} sub={`#${player.rankRoleGlobal} no grupo · ${comparison.globalGroupSize} referências`} icon="🌎" />
      <Kpi label="Índice global" value={number(player.globalScore, 1)} sub={`Produção percentílica ${number(player.globalPerformance, 1)}`} icon="📈" tone={C.blue} />
      <Kpi label="Ranking na liga" value={`#${player.rankLeague}`} sub={`#${player.rankLeagueRole} no grupo · ${comparison.leagueGroupSize} referências`} icon="🏆" tone={C.purple} />
      <Kpi label="Índice na liga" value={number(player.leagueScore, 1)} sub={`Produção percentílica ${number(player.leaguePerformance, 1)}`} icon="🎯" tone={C.amber} />
      <Kpi label="Minutagem" value={number(player.minutos)} sub={`${number(player.jogos)} jogos · confiança ${player.sampleConfidence}%`} icon="⏱️" tone="#0f766e" />
      <Kpi label="Métricas usadas" value={number(player.globalMetricCount)} sub={`${number(player.globalCoverage)}% de cobertura no índice`} icon="🧩" tone={C.red} />
    </div>

    <Panel
      title="Pizza plot posicional"
      subtitle={`Métricas prioritárias para ${player.roleLabel}, exibidas em percentis contra atletas da mesma função.`}
      action={<div style={{ display: 'flex', gap: 6, padding: 3, borderRadius: 10, background: C.green2, border: `1px solid ${C.green3}` }}>
        {[['global', 'Base completa'], ['league', player.liga]].map(([value, label]) => <button key={value} type="button" onClick={() => setPizzaReference(value)} style={{ border: 0, borderRadius: 7, padding: '7px 10px', background: pizzaReference === value ? C.green : 'transparent', color: pizzaReference === value ? '#fff' : C.green, fontSize: 8.5, fontWeight: 900, cursor: 'pointer' }}>{label}</button>)}
      </div>}
      style={{ marginBottom: 14 }}
      bodyStyle={{ padding: '4px 12px 14px' }}
    >
      <PizzaPlot metrics={pizzaMetrics || []} reference={pizzaReference} roleLabel={player.roleShort} />
    </Panel>

    <div className="scout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
      <RadarPanel title="Radar · mesma liga" subtitle={`Percentil entre ${comparison.leagueGroupSize} atletas Sub-20 do mesmo grupo posicional em ${player.liga}.`} data={leagueRadar} athleteName={player.nome} />
      <RadarPanel title="Radar · base completa" subtitle={`Percentil entre ${comparison.globalGroupSize} atletas Sub-20 do mesmo grupo posicional nas 13 ligas.`} data={globalRadar} athleteName={player.nome} />
    </div>

    <div className="scout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
      <SignalList title="Principais forças relativas" items={strengths} tone={C.green} icon={<Sparkles size={16} color={C.green} />} />
      <SignalList title="Pontos para validação em vídeo" items={watchouts} tone={C.amber} icon={<CircleAlert size={16} color={C.amber} />} />
    </div>

    <Panel title="Todas as métricas do índice posicional" subtitle="O índice utiliza todas as métricas de desempenho elegíveis e normalizadas para a função. Valores sem amostra mínima não entram no cálculo." action={<ShieldCheck size={16} color={C.green} />}>
      <div className="scout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
        {metrics.map(item => <div key={item.key} style={{ padding: '12px 0', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: item.color || C.green }} /><span style={{ color: C.muted, fontSize: 7.8, fontWeight: 850, textTransform: 'uppercase' }}>{item.groupLabel}</span></div>
          <PercentileBar label={`${item.label} · Global`} value={item.globalPercentile} raw={number(item.value, 2)} color={C.green} />
          <div style={{ height: 8 }} />
          <PercentileBar label={`${item.label} · ${player.liga}`} value={item.leaguePercentile} raw={`Peso ${number(item.weight, 1)}%`} color={C.purple} />
        </div>)}
      </div>
    </Panel>
  </ScoutingPage>
}
