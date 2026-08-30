'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, CalendarDays, CheckCircle2, CircleGauge, Layers3, Shield, Sparkles, Target } from 'lucide-react'
import { useParams } from 'next/navigation'
import AppShell from '../../../components/layout/AppShell'
import TeamCrest from '../../../components/TeamCrest'
import SerieCTabs from '../../_lib/SerieCTabs'
import { ErrorState, Loading } from '../../../components/serie-c/ui'
import { findMetricColumnAny, formatMetricValue, formatNumberBR, toNumber } from '../../../../lib/serieC'
import {
  MATCH_CATEGORY_ORDER,
  formatMatchDate,
  matchMetricCategory,
  metricWinner,
  numericMetricKeys,
} from '../../../../lib/serieCMatch'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`

const FEATURED_METRICS = [
  'xG', 'Índice', 'Gols', 'Chances de gol', 'Chutes', 'Chutes no alvo', 'Posse de bola, %',
  'Passes', 'Passes precisos, %', 'Passes-chave', 'Passes progressivos',
  'Entradas no terço final', 'Entradas na área adversária', 'Duelos ganhos, %',
  'Recuperações da bola', 'Recuperações da bola no campo adversário', 'Perdas da bola',
]

function aliasesForMetric(name) {
  if (name === 'xG') return ['Golos esperados', 'Gols esperados', 'xG', 'Expected goals']
  if (name === 'Gols') return ['Gols', 'Golos']
  if (name === 'Chutes') return ['Chutes', 'Remates / à baliza', 'Remates']
  if (name === 'Posse de bola, %') return ['Posse de bola, %', 'Posse, %']
  if (name === 'Tática (inicial)') return ['Tática (inicial)', 'Sistema']
  return [name]
}

function findKey(metrics, name) {
  return findMetricColumnAny(metrics, aliasesForMetric(name))
}

function ComparisonBar({ metric, homeValue, awayValue, homeLabel, awayLabel }) {
  const home = toNumber(homeValue)
  const away = toNumber(awayValue)
  const winner = metricWinner(metric, home, away)
  const total = Math.abs(home || 0) + Math.abs(away || 0)
  const homeWidth = total > 0 ? Math.max(4, Math.abs(home || 0) / total * 100) : 50
  const awayWidth = total > 0 ? Math.max(4, Math.abs(away || 0) / total * 100) : 50

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_5px_18px_rgba(15,23,42,0.025)]">
      <div className="grid grid-cols-[72px_minmax(120px,1fr)_72px] items-center gap-3">
        <div className="text-left">
          <p className={`bc text-xl font-black ${winner === 'home' ? 'text-emerald-700' : 'text-slate-800'}`}>{formatMetricValue(metric, home)}</p>
          <p className="truncate text-[8px] font-bold text-slate-300">{homeLabel}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500" title={metric}>{metric}</p>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <div className="flex h-2 justify-end overflow-hidden rounded-l-full bg-slate-100"><span className={`h-full rounded-full ${winner === 'home' ? 'bg-emerald-600' : 'bg-emerald-300'}`} style={{ width: `${homeWidth}%` }} /></div>
            <div className="h-2 overflow-hidden rounded-r-full bg-slate-100"><span className={`block h-full rounded-full ${winner === 'away' ? 'bg-slate-700' : 'bg-slate-400'}`} style={{ width: `${awayWidth}%` }} /></div>
          </div>
        </div>
        <div className="text-right">
          <p className={`bc text-xl font-black ${winner === 'away' ? 'text-slate-900' : 'text-slate-800'}`}>{formatMetricValue(metric, away)}</p>
          <p className="truncate text-[8px] font-bold text-slate-300">{awayLabel}</p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ metric, homeValue, awayValue, homeLabel, awayLabel }) {
  const winner = metricWinner(metric, homeValue, awayValue)
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <p className="min-h-7 text-[8px] font-black uppercase leading-relaxed tracking-[0.14em] text-slate-400">{metric}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className={`rounded-xl px-3 py-3 ${winner === 'home' ? 'bg-emerald-50 ring-1 ring-emerald-100' : 'bg-slate-50'}`}>
          <p className="bc text-2xl font-black text-slate-900">{formatMetricValue(metric, homeValue)}</p>
          <p className="mt-1 truncate text-[8px] font-bold text-slate-400">{homeLabel}</p>
        </div>
        <div className={`rounded-xl px-3 py-3 text-right ${winner === 'away' ? 'bg-slate-100 ring-1 ring-slate-200' : 'bg-slate-50'}`}>
          <p className="bc text-2xl font-black text-slate-900">{formatMetricValue(metric, awayValue)}</p>
          <p className="mt-1 truncate text-[8px] font-bold text-slate-400">{awayLabel}</p>
        </div>
      </div>
    </div>
  )
}

function buildNarrative(match) {
  if (!match) return []
  const home = match.home_metrics || {}
  const away = match.away_metrics || {}
  const statements = []
  const candidates = [
    ['xG', 'produziu mais gols esperados'],
    ['Posse de bola, %', 'teve mais controle da posse'],
    ['Chutes', 'finalizou mais vezes'],
    ['Chances de gol', 'criou mais chances de gol'],
    ['Passes progressivos', 'produziu mais passes progressivos'],
    ['Recuperações da bola no campo adversário', 'recuperou mais bolas no campo adversário'],
  ]
  for (const [metric, phrase] of candidates) {
    const homeKey = findKey(home, metric)
    const awayKey = findKey(away, metric)
    if (!homeKey && !awayKey) continue
    const hv = toNumber(homeKey ? home[homeKey] : null)
    const av = toNumber(awayKey ? away[awayKey] : null)
    if (hv === null || av === null || hv === av) continue
    const team = hv > av ? match.home_team : match.away_team
    statements.push(`${team} ${phrase} (${formatMetricValue(metric, Math.max(hv, av))} a ${formatMetricValue(metric, Math.min(hv, av))}).`)
  }
  return statements.slice(0, 3)
}

export default function SerieCMatchDetailPage() {
  const params = useParams()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('Visão geral')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/serie-c/competition-matches/${params.id}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json()
        if (!response.ok || payload.error) throw new Error(payload.error || 'Falha ao carregar a partida.')
        setMatch(payload.match)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (params.id) load()
    return () => controller.abort()
  }, [params.id])

  const allMetrics = useMemo(() => match ? numericMetricKeys(match.home_metrics, match.away_metrics) : [], [match])
  const categories = useMemo(() => ['Visão geral', ...MATCH_CATEGORY_ORDER.filter(group => allMetrics.some(metric => matchMetricCategory(metric) === group)), 'Todas'], [allMetrics])
  const featured = useMemo(() => {
    if (!match) return []
    return FEATURED_METRICS.map(name => findKey(match.home_metrics, name) || findKey(match.away_metrics, name)).filter(Boolean)
  }, [match])
  const visibleMetrics = useMemo(() => {
    const query = search.trim().toLowerCase()
    let metrics = category === 'Visão geral' ? featured : category === 'Todas' ? allMetrics : allMetrics.filter(metric => matchMetricCategory(metric) === category)
    if (query) metrics = metrics.filter(metric => metric.toLowerCase().includes(query))
    return Array.from(new Set(metrics))
  }, [category, featured, allMetrics, search])
  const narratives = useMemo(() => buildNarrative(match), [match])

  if (loading) return <AppShell><style>{STYLE}</style><SerieCTabs /><Loading /></AppShell>
  if (error || !match) return <AppShell><style>{STYLE}</style><SerieCTabs /><div className="p-4 md:p-8"><ErrorState message={error || 'Partida não encontrada.'} /></div></AppShell>

  const homeFormationKey = findKey(match.home_metrics, 'Tática (inicial)')
  const awayFormationKey = findKey(match.away_metrics, 'Tática (inicial)')
  const homeFormation = homeFormationKey ? match.home_metrics?.[homeFormationKey] : '-'
  const awayFormation = awayFormationKey ? match.away_metrics?.[awayFormationKey] : '-'
  const homeIndexKey = findKey(match.home_metrics, 'Índice')
  const awayIndexKey = findKey(match.away_metrics, 'Índice')
  const homeIndex = homeIndexKey ? match.home_metrics[homeIndexKey] : null
  const awayIndex = awayIndexKey ? match.away_metrics[awayIndexKey] : null
  const homeXgKey = findKey(match.home_metrics, 'xG')
  const awayXgKey = findKey(match.away_metrics, 'xG')
  const homeXg = homeXgKey ? toNumber(match.home_metrics?.[homeXgKey]) : null
  const awayXg = awayXgKey ? toNumber(match.away_metrics?.[awayXgKey]) : null
  const xgDiff = homeXg !== null && awayXg !== null ? homeXg - awayXg : null

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="space-y-6 p-4 md:p-8">
        <Link href="/serie-c/partidas" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-emerald-700"><ArrowLeft className="h-4 w-4" /> Voltar para partidas</Link>

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 p-5 text-white shadow-[0_20px_55px_rgba(6,78,59,0.22)] md:p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-emerald-400/10" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><span className="rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider">Rodada {match.round || '-'}</span><span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-100"><CalendarDays className="h-3.5 w-3.5" />{formatMatchDate(match.match_date)}</span></div>
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">Brasileiro Série C · 2026</span>
            </div>

            <div className="mx-auto mt-7 grid max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-10">
              <div className="flex min-w-0 flex-col items-center text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm md:h-24 md:w-24"><TeamCrest name={match.home_team} size={68} /></span>
                <h1 className="bc mt-4 text-2xl font-black leading-none md:text-3xl">{match.home_team}</h1>
                <p className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-100">{homeFormation}</p>
              </div>
              <div className="text-center">
                <p className="bc whitespace-nowrap text-6xl font-black tracking-tight md:text-8xl">{match.home_score}<span className="mx-2 text-emerald-300/60">:</span>{match.away_score}</p>
                <p className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200">Placar final</p>
                {(homeXg !== null || awayXg !== null) && <p className="mt-2 whitespace-nowrap rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-black text-emerald-100">xG {formatMetricValue('xG', homeXg)} <span className="mx-1 text-emerald-300/60">:</span> {formatMetricValue('xG', awayXg)}</p>}
              </div>
              <div className="flex min-w-0 flex-col items-center text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm md:h-24 md:w-24"><TeamCrest name={match.away_team} size={68} /></span>
                <h1 className="bc mt-4 text-2xl font-black leading-none md:text-3xl">{match.away_team}</h1>
                <p className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-100">{awayFormation}</p>
              </div>
            </div>

            <div className="mx-auto mt-7 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ...(homeXg !== null || awayXg !== null ? [
                  { label: 'xG mandante', value: formatMetricValue('xG', homeXg), icon: Target },
                  { label: 'xG visitante', value: formatMetricValue('xG', awayXg), icon: Target },
                  { label: 'Saldo xG', value: xgDiff === null ? '-' : `${xgDiff > 0 ? '+' : ''}${formatMetricValue('xG', xgDiff)}`, icon: Sparkles },
                ] : [
                  { label: 'Índice mandante', value: formatMetricValue('Índice', homeIndex), icon: CircleGauge },
                  { label: 'Índice visitante', value: formatMetricValue('Índice', awayIndex), icon: CircleGauge },
                ]),
                { label: 'Métricas disponíveis', value: formatNumberBR(allMetrics.length), icon: Layers3 },
                { label: 'Fonte', value: 'Wyscout', icon: CheckCircle2 },
              ].map(item => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm"><div className="flex items-center justify-between"><p className="text-[8px] font-black uppercase tracking-wider text-emerald-200">{item.label}</p><item.icon className="h-4 w-4 text-emerald-200" /></div><p className="bc mt-2 text-2xl font-black">{item.value}</p></div>)}
            </div>
          </div>
        </section>

        {narratives.length > 0 && (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-700" /><p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">Leitura automática da partida</p></div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">{narratives.map(text => <p key={text} className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-[10px] font-semibold leading-relaxed text-slate-600">{text}</p>)}</div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><Target className="h-4 w-4 text-emerald-700" /><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Comparação principal</p><p className="mt-0.5 text-[10px] text-slate-400">Indicadores centrais do confronto.</p></div></div>
            <div className="mt-4 space-y-2">{featured.slice(0, 8).map(metric => <ComparisonBar key={metric} metric={metric} homeValue={match.home_metrics?.[metric]} awayValue={match.away_metrics?.[metric]} homeLabel={match.home_code || match.home_team} awayLabel={match.away_code || match.away_team} />)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-700" /><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Produção por bloco</p><p className="mt-0.5 text-[10px] text-slate-400">Quantidade de indicadores liderados por cada equipe.</p></div></div>
            <div className="mt-4 space-y-3">{MATCH_CATEGORY_ORDER.filter(group => allMetrics.some(metric => matchMetricCategory(metric) === group)).map(group => {
              const groupMetrics = allMetrics.filter(metric => matchMetricCategory(metric) === group)
              const homeWins = groupMetrics.filter(metric => metricWinner(metric, match.home_metrics?.[metric], match.away_metrics?.[metric]) === 'home').length
              const awayWins = groupMetrics.filter(metric => metricWinner(metric, match.home_metrics?.[metric], match.away_metrics?.[metric]) === 'away').length
              const total = Math.max(homeWins + awayWins, 1)
              return <div key={group} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black text-slate-600">{group}</p><p className="text-[9px] font-bold text-slate-400">{homeWins} x {awayWins}</p></div><div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-200"><span className="bg-emerald-600" style={{ width: `${homeWins / total * 100}%` }} /><span className="bg-slate-600" style={{ width: `${awayWins / total * 100}%` }} /></div></div>
            })}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-700" /><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Todas as estatísticas da partida</p></div><p className="mt-1 text-[10px] text-slate-400">{allMetrics.length} métricas preservadas integralmente da planilha.</p></div>
              <div className="flex flex-wrap gap-2"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar métrica..." className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] outline-none focus:border-emerald-200 focus:bg-white" /></div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{categories.map(value => <button key={value} type="button" onClick={() => setCategory(value)} className={`flex-shrink-0 rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-wider transition ${category === value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}>{value}</button>)}</div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{visibleMetrics.map(metric => <MetricCard key={metric} metric={metric} homeValue={match.home_metrics?.[metric]} awayValue={match.away_metrics?.[metric]} homeLabel={match.home_code || match.home_team} awayLabel={match.away_code || match.away_team} />)}</div>
          {!visibleMetrics.length && <p className="p-8 text-center text-[11px] font-semibold text-slate-400">Nenhuma métrica encontrada nesse filtro.</p>}
        </section>
      </div>
    </AppShell>
  )
}
