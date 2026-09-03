'use client'

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { ChevronRight, Crown, Medal, ShieldCheck, Sparkles } from 'lucide-react'
import { formatMetricValue, formatNumberBR, metricDisplayName } from '../../../lib/serieC'
import { ClubTag } from './ui'

const GREEN = '#0a66b7'
const GREEN_DARK = '#07579e'
const GREEN_LIGHT = '#86efac'
const SLATE = '#94a3b8'
const AMBER = '#f59e0b'

export function DashboardKpiCard({ label, value, helper, icon: Icon, tone = 'green', badge }) {
  const tones = {
    green: 'bg-sky-50 text-sky-700 border-sky-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
          <p className="bc mt-2 text-3xl font-black leading-none text-gray-900">{value ?? '-'}</p>
          {helper && <p className="mt-2 text-[10px] font-semibold leading-relaxed text-gray-400">{helper}</p>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${tones[tone] || tones.green}`}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
        )}
      </div>
      {badge && <div className="mt-3 inline-flex rounded-full bg-gray-50 px-2 py-1 text-[9px] font-black text-gray-500">{badge}</div>}
    </div>
  )
}

export function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">{title}</h3>
          {description && <p className="mt-1 text-[10px] leading-relaxed text-gray-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PodiumCard({ title, description, entries, metric, emptyText = 'Sem dados para o filtro atual.' }) {
  const top = entries?.slice(0, 3) || []
  return (
    <Panel title={title} description={description}>
      {top.length === 0 ? (
        <p className="py-8 text-center text-[10px] text-gray-400">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {top.map((entry, index) => {
            const Icon = index === 0 ? Crown : Medal
            const tone = index === 0 ? 'border-amber-200 bg-amber-50' : index === 1 ? 'border-slate-200 bg-slate-50' : 'border-orange-100 bg-orange-50'
            return (
              <div key={`${entry.name}_${index}`} className={`rounded-xl border p-3 ${tone}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-gray-600 shadow-sm">
                    <Icon size={14} />
                  </div>
                  <span className="bc text-xl font-black text-gray-800">{formatMetricValue(metric, entry.value)}</span>
                </div>
                <p className="mt-3 truncate text-[11px] font-black text-gray-700">{entry.name}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-gray-400">{index + 1}º lugar</span>
                  {entry.isClub && <ClubTag />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

export function EntitySpotlight({
  eyebrow,
  title,
  subtitle,
  isClub,
  metrics = [],
  select,
  footer,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-green-950 via-green-900 to-sky-700 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.22em] text-sky-200">{eyebrow}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="bc text-3xl font-black leading-none">{title || '-'}</h3>
            {isClub && <span className="rounded-full bg-white/15 px-2 py-1 text-[8px] font-black uppercase tracking-widest">Confiança</span>}
          </div>
          {subtitle && <p className="mt-2 text-[10px] font-semibold text-sky-100/80">{subtitle}</p>}
        </div>
        {select}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        {metrics.map(item => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
            <p className="text-[8px] font-black uppercase tracking-widest text-sky-100/70">{item.label}</p>
            <p className="bc mt-1 text-2xl font-black">{item.value ?? '-'}</p>
            {item.helper && <p className="mt-1 text-[9px] font-medium text-sky-100/70">{item.helper}</p>}
          </div>
        ))}
      </div>
      {footer && <div className="mt-4 border-t border-white/10 pt-3 text-[10px] text-sky-100/80">{footer}</div>}
    </section>
  )
}

export function PercentileRadar({ title, description, data, secondKey, firstLabel = 'Selecionado', secondLabel = 'Comparação', height = 300 }) {
  if (!data?.length) return null
  return (
    <Panel title={title} description={description}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="area" tick={{ fontSize: 9, fill: '#64748b' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: '#cbd5e1' }} axisLine={false} />
          <Radar name={firstLabel} dataKey="value" stroke={GREEN} fill={GREEN} fillOpacity={0.2} strokeWidth={2} />
          {secondKey && <Radar name={secondLabel} dataKey={secondKey} stroke={SLATE} fill={SLATE} fillOpacity={0.08} strokeWidth={2} />}
          {secondKey && <Legend wrapperStyle={{ fontSize: 10 }} />}
          <Tooltip formatter={(value) => [`P${Math.round(value)}`, 'Percentil']} />
        </RadarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function QuadrantScatter({ title, description, data, xKey, yKey, xMetric, yMetric, height = 300 }) {
  if (!data?.length) return null
  const xValues = data.map(d => Number(d[xKey])).filter(Number.isFinite)
  const yValues = data.map(d => Number(d[yKey])).filter(Number.isFinite)
  const xAvg = xValues.length ? xValues.reduce((a, b) => a + b, 0) / xValues.length : 0
  const yAvg = yValues.length ? yValues.reduce((a, b) => a + b, 0) / yValues.length : 0
  const TooltipContent = ({ active, payload }) => {
    if (!active || !payload?.[0]?.payload) return null
    const item = payload[0].payload
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 text-[10px] shadow-xl">
        <div className="flex items-center gap-2">
          <p className="font-black text-gray-700">{item.name}</p>
          {item.isClub && <ClubTag />}
        </div>
        <p className="mt-1 text-gray-500">{metricDisplayName(xMetric)}: <b>{formatMetricValue(xMetric, item[xKey])}</b></p>
        <p className="text-gray-500">{metricDisplayName(yMetric)}: <b>{formatMetricValue(yMetric, item[yKey])}</b></p>
      </div>
    )
  }
  return (
    <Panel title={title} description={description}>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" dataKey={xKey} name={xMetric} tick={{ fontSize: 9 }} />
          <YAxis type="number" dataKey={yKey} name={yMetric} tick={{ fontSize: 9 }} />
          <ReferenceLine x={xAvg} stroke="#cbd5e1" strokeDasharray="5 5" />
          <ReferenceLine y={yAvg} stroke="#cbd5e1" strokeDasharray="5 5" />
          <Tooltip content={<TooltipContent />} />
          <Scatter data={data.filter(d => !d.isClub)} fill={SLATE} fillOpacity={0.7} />
          <Scatter data={data.filter(d => d.isClub)} fill={GREEN_DARK} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-between text-[9px] font-semibold text-gray-400">
        <span>Média {metricDisplayName(xMetric)}: {formatMetricValue(xMetric, xAvg)}</span>
        <span>Média {metricDisplayName(yMetric)}: {formatMetricValue(yMetric, yAvg)}</span>
      </div>
    </Panel>
  )
}

export function DonutBreakdown({ title, description, data, centerValue, centerLabel }) {
  const filtered = (data || []).filter(item => Number(item.value) > 0)
  if (!filtered.length) return null
  const colors = [GREEN_DARK, GREEN, GREEN_LIGHT, SLATE, AMBER, '#38bdf8']
  return (
    <Panel title={title} description={description}>
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[180px_1fr]">
        <div className="relative">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={2}>
                {filtered.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatNumberBR(value, 0)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="bc text-2xl font-black text-gray-800">{centerValue}</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{centerLabel}</span>
          </div>
        </div>
        <div className="space-y-2">
          {filtered.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} />
                <span className="truncate text-[10px] font-bold text-gray-600">{item.name}</span>
              </div>
              <span className="bc text-base font-black text-gray-800">{formatNumberBR(item.value, 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

export function DualBarComparison({ title, description, data, firstLabel, secondLabel, firstKey = 'first', secondKey = 'second', metric, height = 300 }) {
  if (!data?.length) return null
  return (
    <Panel title={title} description={description}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 12, left: 30, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 9 }} />
          <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 9 }} />
          <Tooltip formatter={(value) => formatMetricValue(metric, value)} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey={firstKey} name={firstLabel} fill={GREEN} radius={[0, 6, 6, 0]} />
          <Bar dataKey={secondKey} name={secondLabel} fill={SLATE} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function LeaderRows({ entries, metric, limit = 8, showTeam = true }) {
  if (!entries?.length) return <p className="py-8 text-center text-[10px] text-gray-400">Sem dados disponíveis.</p>
  const max = Math.max(...entries.slice(0, limit).map(item => Math.abs(Number(item.value) || 0)), 1)
  return (
    <div className="space-y-2">
      {entries.slice(0, limit).map((entry, index) => (
        <div key={`${entry.name}_${index}`} className={`rounded-xl border px-3 py-2.5 ${entry.isClub ? 'border-sky-100 bg-sky-50/70' : 'border-gray-100 bg-white'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[9px] font-black ${index < 3 ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{index + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[10px] font-black text-gray-700">{entry.name}</p>
                  {entry.isClub && <ClubTag />}
                </div>
                {showTeam && entry.team && <p className="truncate text-[8px] font-semibold text-gray-400">{entry.team}</p>}
              </div>
            </div>
            <span className="bc text-lg font-black text-sky-700">{formatMetricValue(metric, entry.value, { per90Mode: entry.per90Mode })}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(5, Math.abs(Number(entry.value) || 0) / max * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ExecutiveInsight({ title, text, tone = 'positive' }) {
  const tones = {
    positive: 'border-sky-100 bg-sky-50 text-sky-700',
    warning: 'border-amber-100 bg-amber-50 text-amber-700',
    neutral: 'border-gray-100 bg-gray-50 text-gray-600',
  }
  const Icon = tone === 'positive' ? ShieldCheck : tone === 'warning' ? Sparkles : ChevronRight
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${tones[tone] || tones.neutral}`}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[8px] font-black uppercase tracking-widest opacity-70">{title}</p>
        <p className="mt-1 text-[10px] font-semibold leading-relaxed">{text}</p>
      </div>
    </div>
  )
}
