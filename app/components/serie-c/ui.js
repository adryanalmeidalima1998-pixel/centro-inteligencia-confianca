// app/components/serie-c/ui.js
// Peças pequenas e reutilizáveis da área Série C | Estatísticas:
// MetricModeToggle, RankingBadge, PercentileBadge, MetricCard, EmptyState,
// ErrorState, GuaraniTag. Tudo no mesmo arquivo pra facilitar import.
'use client'

export function MetricModeToggle({ mode, onChange }) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
      {[
        { key: 'total', label: 'Total' },
        { key: 'per90', label: 'Por 90 min' },
      ].map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
            ${mode === opt.key ? 'bg-white text-sky-700 shadow-sm border border-sky-200' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function TableFormatToggle({ format, onChange }) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
      {[
        { key: 'total', label: 'Apenas total' },
        { key: 'per90', label: 'Apenas por 90' },
        { key: 'both', label: 'Total + Por 90' },
      ].map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
            ${format === opt.key ? 'bg-white text-sky-700 shadow-sm border border-sky-200' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function MinMinutesSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="text-[10px] font-bold text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5"
    >
      {options.map(m => <option key={m} value={m}>≥ {m} min</option>)}
    </select>
  )
}

export function RankingBadge({ rank, total }) {
  if (rank === null || rank === undefined) return <span className="text-[9px] text-gray-300">-</span>
  const isTop1 = rank === 1
  const isTop3 = rank <= 3
  const isTop5 = rank <= 5
  const color = isTop1 ? 'bg-yellow-400 text-yellow-900'
    : isTop3 ? 'bg-sky-100 text-sky-700 border border-sky-300'
    : isTop5 ? 'bg-sky-50 text-sky-600 border border-sky-200'
    : 'bg-gray-50 text-gray-500 border border-gray-200'
  return (
    <span className={`inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded-md text-[9px] font-black ${color}`}>
      {rank}º{total ? <span className="opacity-60 ml-0.5 font-medium">/{total}</span> : null}
    </span>
  )
}

export function PercentileBadge({ percentile }) {
  if (percentile === null || percentile === undefined) return null
  const color = percentile >= 80 ? 'text-sky-600' : percentile >= 50 ? 'text-gray-500' : 'text-red-500'
  return <span className={`text-[9px] font-bold ${color}`}>P{percentile}</span>
}

export function VariationBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-[9px] text-gray-300">-</span>
  const rounded = Math.round(value * 100) / 100
  if (rounded === 0) return <span className="text-[9px] font-bold text-gray-400">=</span>
  const positive = rounded > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-black ${positive ? 'text-sky-600' : 'text-red-500'}`}>
      {positive ? '▲' : '▼'} {Math.abs(rounded)}
    </span>
  )
}

export function GuaraniTag() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-600 text-white text-[8px] font-black uppercase tracking-widest">
      Confiança
    </span>
  )
}

export function MetricCard({ label, value, rank, total, percentile, variationValue, avgDiff, aboveAverage }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="bc text-3xl font-black text-gray-800 leading-none mt-1">{value ?? '-'}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {rank ? <RankingBadge rank={rank} total={total} /> : null}
        {percentile !== null && percentile !== undefined ? <PercentileBadge percentile={percentile} /> : null}
        {variationValue !== undefined ? <VariationBadge value={variationValue} /> : null}
      </div>
      {avgDiff !== undefined && avgDiff !== null && (
        <p className={`text-[9px] font-medium mt-1 ${aboveAverage ? 'text-sky-600' : 'text-red-500'}`}>
          {aboveAverage ? 'Acima' : 'Abaixo'} da média da Série C ({avgDiff > 0 ? '+' : ''}{Math.round(avgDiff * 100) / 100})
        </p>
      )}
    </div>
  )
}

export function EmptyState({ title, description }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <p className="text-sm font-black text-gray-600">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">{description}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-red-50 rounded-2xl border border-red-100 p-6 text-center">
      <p className="text-sm font-black text-red-600">Não foi possível carregar os dados</p>
      <p className="text-xs text-red-400 mt-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-red-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50">
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
