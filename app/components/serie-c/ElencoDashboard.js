'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownToLine, BarChart3, ChevronLeft, ChevronRight,
  CircleGauge, Crosshair, Filter, Goal, Layers3, RefreshCcw,
  Search, ShieldCheck, Sparkles, Target, TrendingUp, Users, X,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  findMetricColumn, formatMetricValue, formatNumberBR, isVolumeMetric,
  per90, playerProfile, toNumber,
} from '../../../lib/serieC'
import {
  PLAYER_CATEGORY_ORDER, PLAYER_OVERVIEW_METRICS, PLAYER_RADAR_METRICS,
  metricEligibilityForRanking, metricHigherIsBetter, numericMetricKeys, playerMetricCategory,
} from '../../../lib/serieCMetricRegistry'

const GREEN = '#0a66b7'
const GREEN_DARK = '#07579e'
const GREEN_LIGHT = '#bbf7d0'
const SLATE = '#64748b'

function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return parts.join(' ')
  return `${parts[0]} ${parts[parts.length - 1]}`
}

function Panel({ title, description, icon: Icon, action, children, className = '' }) {
  return (
    <section className={classNames('rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]', className)}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">{title}</h3>
            {description && <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ExecutiveKpiCard({ label, value, support, icon: Icon, accent = false }) {
  return (
    <div className={classNames(
      'relative overflow-hidden rounded-2xl border p-4 shadow-[0_8px_26px_rgba(15,23,42,0.04)]',
      accent ? 'border-emerald-200 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white' : 'border-slate-200/80 bg-white text-slate-900'
    )}>
      <div className="flex items-start justify-between gap-3">
        <p className={classNames('text-[9px] font-black uppercase tracking-[0.17em]', accent ? 'text-emerald-100' : 'text-slate-400')}>{label}</p>
        {Icon && (
          <span className={classNames('flex h-8 w-8 items-center justify-center rounded-xl', accent ? 'bg-white/12 text-white' : 'bg-emerald-50 text-emerald-700')}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="bc mt-3 text-3xl font-black leading-none tracking-tight">{value}</p>
      <p className={classNames('mt-2 min-h-8 text-[10px] font-semibold leading-relaxed', accent ? 'text-emerald-100' : 'text-slate-500')}>{support}</p>
      <div className={classNames('absolute -bottom-8 -right-8 h-24 w-24 rounded-full', accent ? 'bg-white/5' : 'bg-emerald-50/60')} />
    </div>
  )
}

export function ExecutiveInsightStrip({ items }) {
  if (!items?.length) return null
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      {items.map((item, index) => {
        const Icon = item.icon || Sparkles
        return (
          <div key={`${item.title}_${index}`} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_6px_20px_rgba(15,23,42,0.035)]">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{item.title}</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-700">{item.text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardFilters({ children, onReset, activeFilters = 0, updatedLabel }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex h-9 items-center gap-2 text-slate-500">
            <Filter className="h-4 w-4 text-emerald-600" />
            <span className="text-[9px] font-black uppercase tracking-[0.16em]">Filtros</span>
          </div>
          {children}
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[9px] font-black uppercase tracking-wider text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Limpar ({activeFilters})
            </button>
          )}
        </div>
        {updatedLabel && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Base auditada: {updatedLabel}
          </div>
        )}
      </div>
    </div>
  )
}

export function LeaderboardPanel({ data, metric = 'Índice', title = 'Ranking do elenco', description, max = 8 }) {
  const entries = (data || []).slice(0, max)
  const maxValue = Math.max(...entries.map(item => Number(item.value) || 0), 1)

  return (
    <Panel title={title} description={description} icon={TrendingUp} className="h-full">
      <div className="space-y-3 p-5">
        {entries.map((item, index) => (
          <div key={`${item.name}_${index}`} className="group grid grid-cols-[24px_minmax(0,1fr)_52px] items-center gap-3">
            <span className={classNames(
              'flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black',
              index < 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
            )}>
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-[11px] font-bold text-slate-700" title={item.name}>{shortName(item.name)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all group-hover:from-emerald-700" style={{ width: `${Math.max(8, (Number(item.value) || 0) / maxValue * 100)}%` }} />
              </div>
            </div>
            <span className="bc text-right text-lg font-black text-slate-800">{formatMetricValue(metric, item.value)}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
      <p className="text-[10px] font-black text-slate-700">{row.name}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{formatNumberBR(row.value, 0)} ações</p>
    </div>
  )
}

export function GoalContributionPanel({ goals = 0, assists = 0 }) {
  const total = goals + assists
  const data = [
    { name: 'Gols', value: goals, color: GREEN_DARK },
    { name: 'Assistências', value: assists, color: GREEN_LIGHT },
  ].filter(item => item.value > 0)

  return (
    <Panel title="Participação direta" description="Composição de gols e assistências do elenco." icon={Goal} className="h-full">
      <div className="grid min-h-[292px] grid-cols-1 items-center gap-2 p-5 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="relative h-[210px]">
          {data.length ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                    {data.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <RechartsTooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="bc text-4xl font-black text-slate-900">{formatNumberBR(total, 0)}</span>
                <span className="mt-1 text-center text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Participações</span>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-slate-400">Sem ações registradas.</div>
          )}
        </div>
        <div className="space-y-3">
          {[{ label: 'Gols', value: goals, color: GREEN_DARK }, { label: 'Assistências', value: assists, color: GREEN_LIGHT }].map(item => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                </div>
                <span className="bc text-xl font-black text-slate-800">{formatNumberBR(item.value, 0)}</span>
              </div>
              <p className="mt-1 text-right text-[9px] font-semibold text-slate-400">{total ? formatNumberBR((item.value / total) * 100, 0) : 0}% do total</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
      <p className="max-w-48 truncate text-[10px] font-black text-slate-800">{point.name}</p>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <span className="text-slate-400">xG</span><span className="text-right font-bold text-slate-700">{formatMetricValue('xG', point.xg)}</span>
        <span className="text-slate-400">Gols</span><span className="text-right font-bold text-slate-700">{formatMetricValue('Gols', point.gols)}</span>
      </div>
    </div>
  )
}

export function XgScatterPanel({ data }) {
  const valid = (data || []).filter(item => item.xg !== null && item.xg !== undefined)
  const avgXg = valid.length ? valid.reduce((sum, item) => sum + Number(item.xg || 0), 0) / valid.length : 0
  const avgGoals = valid.length ? valid.reduce((sum, item) => sum + Number(item.gols || 0), 0) / valid.length : 0

  return (
    <Panel title="Produção x conversão" description="Relação individual entre gols esperados e gols marcados." icon={Crosshair} className="h-full">
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3 px-1 text-[9px] font-semibold text-slate-400">
          <span><strong className="text-slate-600">Linha vertical:</strong> xG médio</span>
          <span><strong className="text-slate-600">Linha horizontal:</strong> gols médios</span>
        </div>
        <ResponsiveContainer width="100%" height={292}>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="#e2e8f0" vertical={false} />
            <XAxis type="number" dataKey="xg" name="xG" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis type="number" dataKey="gols" name="Gols" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
            <ReferenceLine x={avgXg} stroke="#94a3b8" strokeDasharray="4 4" />
            <ReferenceLine y={avgGoals} stroke="#94a3b8" strokeDasharray="4 4" />
            <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={<ScatterTooltip />} />
            <Scatter data={valid} fill={GREEN} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

export function ConstructionLeadersPanel({ data, max = 6 }) {
  const entries = (data || []).slice(0, max)
  const maxValue = Math.max(...entries.map(item => Number(item.value) || 0), 1)
  return (
    <Panel title="Construção ofensiva" description="Passes progressivos somados aos passes para a área." icon={Layers3} className="h-full">
      <div className="space-y-4 p-5">
        {entries.map((item, index) => (
          <div key={`${item.name}_${index}`}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[9px] font-black text-slate-300">{String(index + 1).padStart(2, '0')}</span>
                <span className="truncate text-[10px] font-bold text-slate-700" title={item.name}>{shortName(item.name)}</span>
              </div>
              <span className="bc text-base font-black text-emerald-700">{formatNumberBR(item.value, 0)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(7, Number(item.value || 0) / maxValue * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function SquadCompositionPanel({ groups, total }) {
  const max = Math.max(...(groups || []).map(group => group.value), 1)
  return (
    <Panel title="Composição do elenco" description="Distribuição dos jogadores por setor no recorte atual." icon={Users} className="h-full">
      <div className="p-5">
        <div className="mb-5 flex items-end justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Jogadores no recorte</p>
            <p className="bc mt-1 text-3xl font-black">{formatNumberBR(total, 0)}</p>
          </div>
          <Activity className="h-7 w-7 text-emerald-400" />
        </div>
        <div className="space-y-4">
          {(groups || []).map(group => (
            <div key={group.label}>
              <div className="mb-1.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-600">{group.label}</span>
                <span className="font-black text-slate-800">{group.value} <span className="font-semibold text-slate-400">· {total ? formatNumberBR(group.value / total * 100, 0) : 0}%</span></span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-400" style={{ width: `${Math.max(7, group.value / max * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function percentile(values, value) {
  const valid = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  if (!valid.length || !Number.isFinite(value)) return 0
  if (valid.length === 1) return 100
  let belowOrEqual = 0
  for (const v of valid) if (v <= value) belowOrEqual += 1
  return Math.round(((belowOrEqual - 1) / (valid.length - 1)) * 100)
}

function ComparisonTooltip({ active, payload, playerA, playerB }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
      <p className="text-[10px] font-black text-slate-800">{row.metric}</p>
      <div className="mt-1.5 space-y-1 text-[10px]">
        <div className="flex justify-between gap-4"><span className="truncate text-emerald-700">{shortName(playerA)}</span><span className="font-bold text-slate-700">{row.aDisplay} · P{row.a}</span></div>
        <div className="flex justify-between gap-4"><span className="truncate text-slate-500">{shortName(playerB)}</span><span className="font-bold text-slate-700">{row.bDisplay} · P{row.b}</span></div>
      </div>
    </div>
  )
}

export function PlayerComparisonPanel({ players }) {
  const ranked = useMemo(() => {
    const sample = players?.[0]?.metrics || {}
    const indexColumn = findMetricColumn(sample, 'Índice')
    return [...(players || [])].sort((a, b) =>
      (indexColumn ? toNumber(b.metrics?.[indexColumn]) || 0 : 0) -
      (indexColumn ? toNumber(a.metrics?.[indexColumn]) || 0 : 0)
    )
  }, [players])
  const [playerAName, setPlayerAName] = useState('')
  const [playerBName, setPlayerBName] = useState('')

  useEffect(() => {
    if (!ranked.length) return
    if (!ranked.some(p => p.player === playerAName)) setPlayerAName(ranked[0]?.player || '')
    if (!ranked.some(p => p.player === playerBName) || playerBName === ranked[0]?.player) setPlayerBName(ranked[1]?.player || ranked[0]?.player || '')
  }, [ranked, playerAName, playerBName])

  const playerA = ranked.find(p => p.player === playerAName) || ranked[0]
  const playerB = ranked.find(p => p.player === playerBName) || ranked[1] || ranked[0]

  const radarData = useMemo(() => {
    if (!playerA || !playerB) return []
    const sample = ranked[0]?.metrics || {}
    return PLAYER_RADAR_METRICS.map(metricName => {
      const col = findMetricColumn(sample, metricName)
      if (!col) return null
      const eligible = ranked.filter(p => metricEligibilityForRanking(p, col, { entityType:'player', minMinutes:0 }).eligible)
      const values = eligible.map(p => toNumber(p.metrics?.[col])).filter(v => v !== null)
      const aRaw = toNumber(playerA.metrics?.[col])
      const bRaw = toNumber(playerB.metrics?.[col])
      const higher = metricHigherIsBetter(col, 'player')
      const pct = raw => {
        const base = percentile(values, raw)
        return base === null ? null : higher ? base : 100 - base
      }
      return {
        metric: metricName.replace(', %','').replace('xG (Gols esperados)','xG').replace('xA (assistências esperadas)','xA').slice(0,18),
        a: metricEligibilityForRanking(playerA,col,{entityType:'player',minMinutes:0}).eligible ? pct(aRaw) : null,
        b: metricEligibilityForRanking(playerB,col,{entityType:'player',minMinutes:0}).eligible ? pct(bRaw) : null,
        aDisplay: formatMetricValue(metricName, aRaw),
        bDisplay: formatMetricValue(metricName, bRaw),
      }
    }).filter(item => item?.a !== null || item?.b !== null)
  }, [ranked, playerA, playerB])

  if (!ranked.length) return null

  return (
    <Panel title="Comparativo individual" description="Percentis internos do elenco para leitura multidimensional." icon={CircleGauge} className="h-full">
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.15em] text-emerald-700">Jogador A</span>
          <select value={playerA?.player || ''} onChange={event => setPlayerAName(event.target.value)} className="h-10 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold text-emerald-800 outline-none focus:border-emerald-400">
            {ranked.map(player => <option key={`a_${player.player}`} value={player.player}>{player.player}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Jogador B</span>
          <select value={playerB?.player || ''} onChange={event => setPlayerBName(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold text-slate-700 outline-none focus:border-slate-400">
            {ranked.map(player => <option key={`b_${player.player}`} value={player.player}>{player.player}</option>)}
          </select>
        </label>
      </div>
      <div className="p-3">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData} outerRadius="69%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#64748b' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name={playerA?.player} dataKey="a" stroke={GREEN} fill={GREEN} fillOpacity={0.18} strokeWidth={2.2} />
            <Radar name={playerB?.player} dataKey="b" stroke={SLATE} fill={SLATE} fillOpacity={0.08} strokeWidth={1.8} />
            <RechartsTooltip content={<ComparisonTooltip playerA={playerA?.player} playerB={playerB?.player} />} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center justify-center gap-5 pb-2 text-[9px] font-bold text-slate-500">
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-emerald-500" />{shortName(playerA?.player)}</span>
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-slate-500" />{shortName(playerB?.player)}</span>
        </div>
      </div>
    </Panel>
  )
}


export function IndividualLeaderCards({ items }) {
  const icons = [Goal, Sparkles, Layers3, TrendingUp, ShieldCheck, Activity]
  const valid = (items || []).filter(item => item?.name)
  if (!valid.length) return null

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">Destaques por fundamento</p>
          <h3 className="bc mt-1 text-2xl font-black text-slate-900">Líderes individuais do elenco</h3>
          <p className="mt-1 text-[10px] text-slate-500">Melhores marcas do recorte atual em produção, criação e ações defensivas.</p>
        </div>
        <span className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Atualização automática pelos filtros</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {valid.map((item, index) => {
          const Icon = icons[index % icons.length]
          return (
            <article key={`${item.label}_${item.name}`} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="rounded-lg bg-slate-900 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">Top 1</span>
              </div>
              <p className="mt-4 text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
              <p className="mt-1 truncate text-[11px] font-black text-slate-800" title={item.name}>{item.name}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="bc text-3xl font-black leading-none text-emerald-700">{formatMetricValue(item.metric || item.label, item.value)}</p>
                <p className="max-w-20 text-right text-[8px] font-semibold leading-relaxed text-slate-400">melhor marca do elenco</p>
              </div>
              <div className="absolute -bottom-8 -right-8 h-20 w-20 rounded-full bg-emerald-50 transition group-hover:scale-125" />
            </article>
          )
        })}
      </div>
    </section>
  )
}

function IndividualMetricCard({ metric }) {
  const value = metric.value === null ? '-' : formatMetricValue(metric.metricName, metric.value)
  const percentileLabel = metric.percentile === null ? 'Sem comparação interna' : `Percentil interno P${metric.percentile}`
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_20px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[8px] font-black uppercase tracking-[0.15em] text-slate-400" title={metric.label}>{metric.label}</p>
          <p className="bc mt-2 text-2xl font-black leading-none text-slate-900">{value}</p>
        </div>
        {metric.percentile !== null && (
          <span className={classNames(
            'rounded-lg px-2 py-1 text-[8px] font-black',
            metric.percentile >= 75 ? 'bg-emerald-100 text-emerald-800' : metric.percentile >= 50 ? 'bg-lime-50 text-lime-700' : 'bg-slate-100 text-slate-500'
          )}>P{metric.percentile}</span>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-400" style={{ width: `${Math.max(4, metric.percentile || 0)}%` }} />
      </div>
      <div className="mt-2 flex min-h-7 items-start justify-between gap-3 text-[8px] font-semibold leading-relaxed text-slate-400">
        <span>{percentileLabel}</span>
        {metric.per90 !== null && <span className="whitespace-nowrap text-slate-600">{formatMetricValue(metric.metricName, metric.per90, { per90Mode: true })}/90</span>}
      </div>
    </div>
  )
}

export function IndividualPerformancePanel({ players }) {
  const sample = players?.[0]?.metrics || {}
  const indexColumn = findMetricColumn(sample, 'Índice')
  const ranked = useMemo(() => [...(players || [])].sort((a, b) =>
    (indexColumn ? toNumber(b.metrics?.[indexColumn]) || 0 : 0) -
    (indexColumn ? toNumber(a.metrics?.[indexColumn]) || 0 : 0)
  ), [players, indexColumn])
  const [selectedName, setSelectedName] = useState('')
  const [metricView, setMetricView] = useState('Visão geral')
  const [metricSearch, setMetricSearch] = useState('')

  useEffect(() => {
    if (!ranked.length) return
    if (!ranked.some(player => player.player === selectedName)) setSelectedName(ranked[0].player)
  }, [ranked, selectedName])

  const selected = ranked.find(player => player.player === selectedName) || ranked[0]

  const availableMetrics = useMemo(() => numericMetricKeys(ranked), [ranked])
  const metricCategories = useMemo(() => ['Visão geral', ...PLAYER_CATEGORY_ORDER.filter(group => availableMetrics.some(metric => playerMetricCategory(metric) === group)), 'Todas'], [availableMetrics])

  const metricCards = useMemo(() => {
    if (!selected) return []
    let metrics = metricView === 'Visão geral'
      ? PLAYER_OVERVIEW_METRICS.map(name => findMetricColumn(sample, name)).filter(Boolean)
      : metricView === 'Todas'
        ? availableMetrics
        : availableMetrics.filter(metric => playerMetricCategory(metric) === metricView)
    const q = metricSearch.toLowerCase().trim()
    if (q) metrics = metrics.filter(metric => metric.toLowerCase().includes(q))
    return [...new Set(metrics)].map(metricName => {
      const column = metricName
      const raw = toNumber(selected.metrics?.[column])
      const eligiblePlayers = ranked.filter(player => metricEligibilityForRanking(player, column, { entityType:'player', minMinutes:0 }).eligible)
      const eligibleSelected = metricEligibilityForRanking(selected, column, { entityType:'player', minMinutes:0 }).eligible
      const values = eligiblePlayers.map(player => toNumber(player.metrics?.[column])).filter(value => value !== null)
      let pct = raw === null || !eligibleSelected ? null : percentile(values, raw)
      if (pct !== null && !metricHigherIsBetter(column, 'player')) pct = 100 - pct
      const p90Value = raw !== null && isVolumeMetric(column) ? per90(raw, selected.minutes) : null
      return { label:column, metricName:column, value:raw, percentile:pct, per90:p90Value }
    }).filter(metric => metric.value !== null)
  }, [selected, ranked, sample, metricView, metricSearch, availableMetrics])

  if (!selected) return null

  const metricValue = metricName => {
    const column = findMetricColumn(sample, metricName)
    return column ? toNumber(selected.metrics?.[column]) : null
  }
  const indexValue = metricValue('Índice')
  const goals = metricValue('Gols') || 0
  const assists = metricValue('Assistências') || 0
  const xg = metricValue('xG (Gols esperados)')
  const progressive = metricValue('Passes progressivos') || 0
  const area = metricValue('Passes para a área') || 0

  return (
    <Panel
      title="Raio-X individual"
      description="Selecione um atleta para abrir o desempenho completo, com valores totais, produção por 90 minutos e percentis internos do elenco."
      icon={CircleGauge}
      action={(
        <label className="block min-w-[220px]">
          <span className="sr-only">Selecionar jogador</span>
          <select value={selected.player} onChange={event => setSelectedName(event.target.value)} className="h-9 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-black text-emerald-800 outline-none focus:border-emerald-400">
            {ranked.map(player => <option key={player.player} value={player.player}>{player.player}</option>)}
          </select>
        </label>
      )}
    >
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-900 p-5 text-white">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-emerald-500 text-xl font-black text-white shadow-lg shadow-emerald-950/20">
              {String(selected.player || '?').trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{selected.player}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-semibold text-slate-300">
                <span className="rounded-lg bg-white/10 px-2 py-1">{playerProfile(selected)}</span>
                <span>{selected.position || 'Posição não informada'}</span>
                <span>•</span>
                <span>{selected.age ?? '-'} anos</span>
                <span>•</span>
                <span>{formatNumberBR(selected.minutes || 0, 0)} minutos</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
            {[
              ['Índice', formatMetricValue('Índice', indexValue)],
              ['G + A', formatNumberBR(goals + assists, 0)],
              ['xG', formatMetricValue('xG', xg)],
              ['Construção', formatNumberBR(progressive + area, 0)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                <p className="bc mt-1 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">{metricCategories.map(value => <button key={value} type="button" onClick={() => setMetricView(value)} className={`flex-shrink-0 rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-wider ${metricView === value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>{value}</button>)}</div>
          <div className="relative w-full xl:max-w-xs"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" /><input value={metricSearch} onChange={event => setMetricSearch(event.target.value)} placeholder="Buscar métrica do atleta..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[10px]" /></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7">
        {metricCards.map(metric => <IndividualMetricCard key={metric.metricName} metric={metric} />)}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-[9px] leading-relaxed text-slate-400">
        O percentil interno usa apenas atletas elegíveis para a métrica. Percentuais de eficiência respeitam amostra mínima; métricas em que menor é melhor têm o percentil invertido automaticamente.
      </div>
    </Panel>
  )
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function ElencoPerformanceTable({ columns, rows, rowKey, defaultSortKey = 'indice', searchPlaceholder = 'Buscar jogador...' }) {
  const [sortKey, setSortKey] = useState(defaultSortKey)
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return rows || []
    return (rows || []).filter(row => [row.player, row.position, row.age, row.minutes]
      .filter(value => value !== null && value !== undefined)
      .join(' ')
      .toLowerCase()
      .includes(query))
  }, [rows, search])

  const sorted = useMemo(() => {
    const col = columns.find(column => column.key === sortKey)
    if (!col) return filtered
    const getValue = col.sortValue || col.render || (row => row[col.key])
    return [...filtered].sort((a, b) => {
      const aValue = getValue(a)
      const bValue = getValue(b)
      const aNumber = Number(aValue)
      const bNumber = Number(bValue)
      const comparison = Number.isFinite(aNumber) && Number.isFinite(bNumber)
        ? aNumber - bNumber
        : String(aValue ?? '').localeCompare(String(bValue ?? ''), 'pt-BR')
      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [filtered, columns, sortKey, sortDir])

  useEffect(() => { setPage(1) }, [search, pageSize, rows])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  function toggleSort(key) {
    if (sortKey === key) setSortDir(direction => direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function cellValue(column, row) {
    const raw = column.render ? column.render(row) : row[column.key]
    if (raw === null || raw === undefined || raw === '') return '-'
    if (typeof raw === 'number') return formatMetricValue(column.label || column.key, raw, { per90Mode: String(column.key).includes('__p90') })
    return raw
  }

  function downloadCsv() {
    const header = columns.map(column => escapeCsv(column.label)).join(';')
    const lines = sorted.map(row => columns.map(column => escapeCsv(cellValue(column, row))).join(';'))
    const blob = new Blob([`\ufeff${[header, ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'elenco-confianca-serie-c.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel
      title="Desempenho individual"
      description="Tabela auditável com ordenação, busca, paginação e exportação do recorte selecionado."
      icon={BarChart3}
      action={(
        <button type="button" onClick={downloadCsv} className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-black uppercase tracking-wider text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
          <ArrowDownToLine className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      )}
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder={searchPlaceholder} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-[11px] font-medium text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-slate-400">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{sorted.length} jogador(es)</span>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
            Por página
            <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="bg-transparent font-black text-slate-700 outline-none">
              {[10, 15, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full min-w-max border-collapse text-[11px]">
          <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur">
            <tr className="border-b border-slate-200">
              {columns.map((column, index) => (
                <th key={column.key} onClick={() => toggleSort(column.key)} className={classNames(
                  'cursor-pointer select-none whitespace-nowrap px-3 py-3 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-slate-700',
                  index === 0 && 'sticky left-0 z-30 bg-slate-50/95',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                )}>
                  {column.label}{sortKey === column.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => (
              <tr key={rowKey(row)} className={classNames('border-b border-slate-100 transition hover:bg-emerald-50/40', rowIndex % 2 ? 'bg-slate-50/35' : 'bg-white')}>
                {columns.map((column, index) => {
                  const value = cellValue(column, row)
                  const isIndex = column.key === 'indice'
                  const isPosition = column.key === 'position'
                  return (
                    <td key={column.key} className={classNames(
                      'whitespace-nowrap px-3 py-2.5 text-slate-600',
                      index === 0 && classNames('sticky left-0 z-10 font-bold text-slate-800', rowIndex % 2 ? 'bg-[#fbfcfd]' : 'bg-white'),
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                    )}>
                      {isIndex ? <span className="inline-flex min-w-10 justify-center rounded-lg bg-emerald-100 px-2 py-1 font-black text-emerald-800">{value}</span>
                        : isPosition ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{value}</span>
                          : value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[9px] font-semibold text-slate-400">
          Exibindo {sorted.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, sorted.length)} de {sorted.length}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={safePage <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-20 text-center text-[9px] font-black uppercase tracking-wider text-slate-500">{safePage} de {totalPages}</span>
          <button type="button" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </Panel>
  )
}

export const dashboardIcons = {
  players: Users,
  minutes: Activity,
  index: CircleGauge,
  goals: Goal,
  xg: Target,
  efficiency: TrendingUp,
  keyPasses: Sparkles,
  progressive: Layers3,
  duels: ShieldCheck,
  recoveries: Activity,
}
