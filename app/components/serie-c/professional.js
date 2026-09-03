'use client'

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter,
} from 'recharts'
import { formatMetricValue, formatNumberBR, formatPercentage, metricDisplayName } from '../../../lib/serieC'
import { ClubTag, PercentileBadge, RankingBadge, VariationBadge } from './ui'

const COLORS = {
  green: '#0a66b7',
  red: '#ef4444',
  gray: '#94a3b8',
}

export function SectionHeader({ eyebrow, title, description, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-[9px] font-black uppercase tracking-widest text-gray-300">{eyebrow}</p>}
        <h2 className="text-sm font-black text-gray-800">{title}</h2>
        {description && <p className="text-[11px] text-gray-400 mt-1 max-w-3xl leading-relaxed">{description}</p>}
      </div>
      {right}
    </div>
  )
}

export function InsightCard({ title, value, description, tone = 'neutral', children }) {
  const tones = {
    positive: 'border-sky-100 bg-sky-50/80 text-sky-700',
    warning: 'border-yellow-100 bg-yellow-50/80 text-yellow-700',
    danger: 'border-red-100 bg-red-50/80 text-red-600',
    neutral: 'border-gray-100 bg-white text-gray-700',
  }
  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${tones[tone] || tones.neutral}`}>
      <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{title}</p>
      {value && <p className="bc text-2xl font-black leading-none mt-1">{value}</p>}
      {description && <p className="text-[11px] font-semibold mt-2 leading-relaxed opacity-90">{description}</p>}
      {children}
    </div>
  )
}

export function ProfessionalMetricCard({ metric, value, rank, total, percentile, avg, avgDiff, variationValue, positive, compact = false }) {
  const formatted = formatMetricValue(metric, value)
  const avgText = avgDiff === null || avgDiff === undefined
    ? null
    : `${avgDiff > 0 ? '+' : ''}${formatMetricValue(metric, avgDiff)}`
  const tone = positive === false ? 'text-red-500' : positive === true ? 'text-sky-600' : 'text-gray-500'
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 leading-snug">{metricDisplayName(metric)}</p>
        {variationValue !== undefined ? <VariationBadge value={variationValue} /> : null}
      </div>
      <p className={`bc font-black text-gray-900 leading-none mt-2 ${compact ? 'text-2xl' : 'text-3xl'}`}>{formatted}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {rank ? <RankingBadge rank={rank} total={total} /> : null}
        {percentile !== null && percentile !== undefined ? <PercentileBadge percentile={percentile} /> : null}
      </div>
      {avgText && (
        <p className={`text-[9px] font-bold mt-2 ${tone}`}>
          {positive === false ? 'Abaixo do ideal' : positive === true ? 'Acima da média' : 'Comparativo'}: {avgText}
        </p>
      )}
      {avg !== null && avg !== undefined && (
        <p className="text-[9px] text-gray-300 mt-0.5">Média: {formatMetricValue(metric, avg)}</p>
      )}
    </div>
  )
}

export function RankingListCard({ title, entries, valueMetric, description, max = 5 }) {
  if (!entries?.length) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</p>
          {description && <p className="text-[10px] text-gray-400 mt-1">{description}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        {entries.slice(0, max).map((e, i) => (
          <div key={`${e.name}_${i}`} className={`flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 ${e.isClub ? 'bg-sky-50' : 'hover:bg-gray-50'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 text-center text-[10px] font-black text-gray-300">{i + 1}</span>
              <span className="text-[11px] font-bold text-gray-700 truncate">{e.name}</span>
              {e.isClub && <ClubTag />}
            </div>
            <span className="bc text-base font-black text-sky-600 whitespace-nowrap">{formatMetricValue(valueMetric || title, e.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ComparisonBars({ title, description, items, metricKey = 'value', footer }) {
  if (!items?.length) return null
  const max = Math.max(...items.map(i => Math.abs(Number(i[metricKey]) || 0)), 1)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      {description && <p className="text-[11px] text-gray-400 mt-1 mb-4">{description}</p>}
      <div className="space-y-3">
        {items.map((item) => {
          const v = Number(item[metricKey]) || 0
          const positive = v >= 0
          const width = Math.max(8, Math.abs(v) / max * 100)
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-[11px] mb-1">
                <span className="font-bold text-gray-600 truncate">{metricDisplayName(item.label)}</span>
                <span className={`font-black ${positive ? 'text-sky-600' : 'text-red-500'}`}>{v > 0 ? '+' : ''}{formatNumberBR(v, 1)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${positive ? 'bg-sky-500' : 'bg-red-400'}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      {footer && <p className="text-[10px] text-gray-400 mt-4">{footer}</p>}
    </div>
  )
}

export function SimpleBarChart({ title, description, data, xKey = 'name', dataKey = 'value', metric, layout = 'vertical', height = 260 }) {
  if (!data?.length) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      {description && <p className="text-[11px] text-gray-400 mt-1 mb-3">{description}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 16, left: layout === 'vertical' ? 24 : 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          {layout === 'vertical' ? (
            <>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey={xKey} type="category" width={120} tick={{ fontSize: 10 }} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
            </>
          )}
          <Tooltip formatter={(v) => [formatMetricValue(metric || dataKey, v), metricDisplayName(metric || dataKey)]} />
          <Bar dataKey={dataKey} fill={COLORS.green} radius={[6, 6, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SimpleLineChart({ title, description, data, xKey = 'round', dataKey = 'value', metric, height = 220, reversed = false }) {
  if (!data?.length) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      {description && <p className="text-[11px] text-gray-400 mt-1 mb-3">{description}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
          <YAxis reversed={reversed} allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => [formatMetricValue(metric || dataKey, v), metricDisplayName(metric || dataKey)]} />
          <Line type="monotone" dataKey={dataKey} stroke={COLORS.green} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RadarCard({ title, description, data, dataKey = 'value' }) {
  if (!data?.length) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      {description && <p className="text-[11px] text-gray-400 mt-1 mb-3">{description}</p>}
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="area" tick={{ fontSize: 10, fill: '#64748b' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
          <Radar dataKey={dataKey} stroke={COLORS.green} fill={COLORS.green} fillOpacity={0.18} strokeWidth={2} />
          <Tooltip formatter={(v) => [`P${Math.round(v)}`, 'Percentil']} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ScatterCard({ title, description, data, xKey, yKey, xMetric, yMetric, height = 260 }) {
  if (!data?.length) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      {description && <p className="text-[11px] text-gray-400 mt-1 mb-3">{description}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" dataKey={xKey} name={metricDisplayName(xMetric || xKey)} tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey={yKey} name={metricDisplayName(yMetric || yKey)} tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [formatMetricValue(n === xKey ? xMetric : yMetric, v), metricDisplayName(n === xKey ? xMetric : yMetric)]} />
          <Scatter data={data} fill={COLORS.green} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FilterShell({ children }) {
  return <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-2xl px-3 py-2">{children}</div>
}
