'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  CircleGauge,
  ExternalLink,
  FileText,
  Goal,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import TeamCrest from '../../components/TeamCrest'
import SerieCTabs from '../_lib/SerieCTabs'
import { DashboardKpiCard } from '../../components/serie-c/competition'
import { SectionHeader } from '../../components/serie-c/professional'
import { formatNumberBR } from '../../../lib/serieC'
import { normalizeSerieCStandingsRows } from '../../../lib/serieCStandingsPdf'
import { SERIE_C_STANDINGS_2026, SERIE_C_STANDINGS_SOURCE } from '../../../lib/serieCStandings2026'
import { normalizeSerieCTeamKey } from '../../../lib/serieCTeamNames'
import { TRANSFERMARKT_SERIE_C_URL } from '../../../lib/transfermarktSerieC'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`
const CURRENT_SEASON = '2026'
const DEFAULT_COMPETITION = 'Brasileiro Série C'
const AUTO_REFRESH_MS = 2 * 60 * 1000
const LIVE_CACHE_KEY = 'guarani-serie-c-transfermarkt-live-v5'
const LIVE_CACHE_MAX_AGE_MS = 60 * 60 * 1000

const MODES = [
  { key: 'real', label: 'Classificação real' },
  { key: 'expected', label: 'Classificação por xPoints' },
  { key: 'attack', label: 'Ataque' },
  { key: 'defense', label: 'Defesa' },
]

const SECOND_PHASE_GROUPS = [
  { key: 'A', positions: [1, 4, 5, 8] },
  { key: 'B', positions: [2, 3, 6, 7] },
]

function zone(position) {
  if (position <= 8) return { label: 'G8', bar: 'bg-emerald-500', row: 'bg-emerald-50/35' }
  if (position >= 17) return { label: 'Z4', bar: 'bg-red-500', row: 'bg-red-50/35' }
  return { label: 'Meio', bar: 'bg-slate-200', row: '' }
}

function signed(value, digits = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${formatNumberBR(n, digits)}`
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value.includes?.('T') ? value : `${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value.includes?.('T') ? value : `${value}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function InsightCard({ icon: Icon, title, value, description, tone = 'slate' }) {
  const tones = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    red: 'border-red-100 bg-red-50 text-red-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    slate: 'border-slate-200 bg-white text-slate-700',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3"><p className="text-[8px] font-black uppercase tracking-[0.15em] opacity-65">{title}</p><Icon className="h-4 w-4 opacity-70" /></div>
      <p className="bc mt-3 text-3xl font-black leading-none">{value}</p>
      <p className="mt-2 text-[10px] font-semibold leading-relaxed opacity-75">{description}</p>
    </div>
  )
}

function MiniBar({ value, max, negative = false }) {
  const pct = Math.max(3, Math.min(100, Math.abs(Number(value) || 0) / Math.max(Math.abs(max) || 1, 1) * 100))
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${negative ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
}

function SecondPhaseGroupCard({ group, teams }) {
  const isGroupA = group.key === 'A'
  const styles = isGroupA
    ? {
        border: 'border-emerald-200',
        header: 'border-emerald-100 bg-emerald-50/80',
        badge: 'bg-emerald-600 text-white',
        position: 'bg-emerald-50 text-emerald-700',
        accent: 'bg-emerald-500',
      }
    : {
        border: 'border-blue-200',
        header: 'border-blue-100 bg-blue-50/80',
        badge: 'bg-blue-600 text-white',
        position: 'bg-blue-50 text-blue-700',
        accent: 'bg-blue-500',
      }

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-[0_10px_34px_rgba(15,23,42,0.045)] ${styles.border}`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-4 ${styles.header}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl bc text-2xl font-black ${styles.badge}`}>{group.key}</span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Grupo {group.key}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Posições {group.positions.map(position => `${position}º`).join(', ')}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1.5 text-[8px] font-black uppercase tracking-wider text-slate-500 shadow-sm">4 equipes</span>
      </div>

      <div className="divide-y divide-slate-100">
        {!teams.length && (
          <div className="px-4 py-8 text-center text-[10px] font-semibold text-slate-400">Aguardando a classificação ao vivo do Transfermarkt.</div>
        )}
        {teams.map(row => {
          const isGuarani = row.team.toLocaleLowerCase('pt-BR').includes('confianca')
          return (
            <div key={row.team} className={`relative flex items-center gap-3 px-4 py-3.5 ${isGuarani ? 'bg-emerald-50/70' : 'bg-white'}`}>
              <span className={`absolute bottom-0 left-0 top-0 w-1 ${isGuarani ? 'bg-emerald-600' : styles.accent}`} />
              <span className={`bc flex h-9 w-9 flex-none items-center justify-center rounded-xl text-lg font-black ${styles.position}`}>{row.position}º</span>
              <TeamCrest name={row.team} size={30} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[11px] font-black ${isGuarani ? 'text-emerald-800' : 'text-slate-700'}`}>{row.team}</p>
                <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300">{row.played} jogos · SG {signed(row.goalDifference, 0)}</p>
              </div>
              <div className="text-right">
                <p className="bc text-2xl font-black leading-none text-slate-900">{row.points}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-slate-300">pontos</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const INITIAL_SOURCE = {
  label: 'Aguardando classificação ao vivo · Transfermarkt',
  file: 'Transfermarkt · Série C 2026',
  page: null,
  updatedAt: null,
  round: null,
  url: TRANSFERMARKT_SERIE_C_URL,
  persisted: false,
  automatic: false,
  metricsLabel: SERIE_C_STANDINGS_SOURCE.label,
  metricsFile: SERIE_C_STANDINGS_SOURCE.file,
  metricsUpdatedAt: SERIE_C_STANDINGS_SOURCE.updatedAt,
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function mergeOfficialStandings(metricsRows, officialRows) {
  const metricsByTeam = new Map(metricsRows.map(row => [normalizeSerieCTeamKey(row.team), row]))

  return officialRows
    .map((official, index) => {
      const metrics = metricsByTeam.get(normalizeSerieCTeamKey(official.team)) || {}
      const points = finiteNumber(official.points)
      const played = finiteNumber(official.played)
      const hasOfficialNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      const won = hasOfficialNumber(official.won) ? Number(official.won) : null
      const drawn = hasOfficialNumber(official.drawn) ? Number(official.drawn) : null
      const lost = hasOfficialNumber(official.lost) ? Number(official.lost) : null
      const goalsFor = finiteNumber(official.goalsFor)
      const goalsAgainst = finiteNumber(official.goalsAgainst)
      const goalDifference = Number.isFinite(Number(official.goalDifference))
        ? Number(official.goalDifference)
        : goalsFor - goalsAgainst
      const xg = finiteNumber(metrics.xg)
      const xga = finiteNumber(metrics.xga)
      const expectedGoalDifference = xg - xga
      const xPoints = finiteNumber(metrics.xPoints)

      return {
        position: finiteNumber(official.position, index + 1),
        team: metrics.team || official.team,
        points,
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference,
        xg,
        xgDelta: xg - goalsFor,
        xga,
        xgaDelta: xga - goalsAgainst,
        expectedGoalDifference,
        expectedGoalDifferenceDelta: expectedGoalDifference - goalDifference,
        xPoints,
        xPointsDelta: xPoints - points,
      }
    })
    .sort((a, b) => a.position - b.position)
}

async function readJson(response, fallbackMessage) {
  const json = await response.json()
  if (!response.ok) throw new Error(json.error || fallbackMessage)
  return json
}

async function fetchTransfermarktLive(forceRefresh = false) {
  const refresh = forceRefresh ? '&refresh=1' : ''
  const response = await fetch(`/api/serie-c/standings/transfermarkt?_=${Date.now()}${refresh}`, { cache: 'no-store' })
  return readJson(response, 'Falha ao consultar a classificação ao vivo do Transfermarkt.')
}

function readCachedLiveStandings() {
  try {
    const cached = JSON.parse(window.localStorage.getItem(LIVE_CACHE_KEY) || 'null')
    if (!cached || cached.source !== 'Transfermarkt' || !Array.isArray(cached.rows) || cached.rows.length !== 20) return null
    const storedAt = Number(cached.storedAt || 0)
    if (!storedAt || Date.now() - storedAt > LIVE_CACHE_MAX_AGE_MS) return null
    return cached
  } catch (_) {
    return null
  }
}

function cacheLiveStandings(payload) {
  if (payload?.source !== 'Transfermarkt' || !Array.isArray(payload.rows) || payload.rows.length !== 20) return
  try {
    window.localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify({
      source: payload.source,
      rows: payload.rows,
      round: payload.round,
      fetchedAt: payload.fetchedAt || new Date().toISOString(),
      storedAt: Date.now(),
    }))
  } catch (_) {}
}

export default function SerieCClassificacaoPage() {
  const [mode, setMode] = useState('real')
  const [standings, setStandings] = useState([])
  const [source, setSource] = useState(INITIAL_SOURCE)
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [loadWarning, setLoadWarning] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ season: CURRENT_SEASON, competition: DEFAULT_COMPETITION })
    let running = false

    const load = async (forceRefresh = false) => {
      if (!active || running) return
      running = true
      setLoadingLatest(true)

      const warnings = []
      let metricsRows = normalizeSerieCStandingsRows(SERIE_C_STANDINGS_2026)
      let metricsSource = INITIAL_SOURCE

      const [metricsResult, officialResult] = await Promise.allSettled([
        fetch(`/api/serie-c/standings?${params.toString()}`, { cache: 'no-store' })
          .then(response => readJson(response, 'Falha ao carregar as métricas do Wyscout.')),
        fetchTransfermarktLive(forceRefresh),
      ])

      if (!active) return

      if (metricsResult.status === 'fulfilled' && metricsResult.value.snapshot) {
        const snapshotRows = normalizeSerieCStandingsRows(metricsResult.value.snapshot.rows)
        if (snapshotRows.length === 20) {
          metricsRows = snapshotRows
          metricsSource = {
            label: 'Upload semanal · PDF Wyscout',
            file: metricsResult.value.snapshot.sourceFilename,
            page: metricsResult.value.snapshot.sourcePage,
            updatedAt: metricsResult.value.snapshot.referenceDate || metricsResult.value.snapshot.uploadedAt,
            round: metricsResult.value.snapshot.round,
            url: metricsResult.value.snapshot.sourceUrl,
            persisted: true,
            automatic: false,
            metricsLabel: 'Upload semanal · PDF Wyscout',
            metricsFile: metricsResult.value.snapshot.sourceFilename,
            metricsUpdatedAt: metricsResult.value.snapshot.referenceDate || metricsResult.value.snapshot.uploadedAt,
          }
        } else {
          warnings.push('O último PDF do Wyscout está incompleto; foram mantidas apenas as métricas incorporadas ao projeto.')
        }
      } else if (metricsResult.status === 'rejected') {
        warnings.push(metricsResult.reason.message)
      }

      if (officialResult.status === 'fulfilled' && officialResult.value.source === 'Transfermarkt' && Array.isArray(officialResult.value.rows) && officialResult.value.rows.length === 20) {
        const live = officialResult.value
        setStandings(mergeOfficialStandings(metricsRows, live.rows))
        setSource({
          label: live.transport === 'reader'
            ? 'Classificação ao vivo · Transfermarkt (leitura protegida)'
            : 'Classificação ao vivo · Transfermarkt',
          file: 'Transfermarkt · Série C 2026',
          page: null,
          updatedAt: live.fetchedAt,
          round: live.round,
          url: live.sourceUrl || TRANSFERMARKT_SERIE_C_URL,
          persisted: Boolean(live.persisted),
          automatic: true,
          transport: live.transport,
          fallback: live.fallback,
          fallbackSources: live.fallbackSources,
          warning: live.warning,
          metricsLabel: metricsSource.metricsLabel || metricsSource.label,
          metricsFile: metricsSource.metricsFile || metricsSource.file,
          metricsUpdatedAt: metricsSource.metricsUpdatedAt || metricsSource.updatedAt,
        })
        cacheLiveStandings(live)
        if (live.warning) warnings.push(live.warning)
      } else {
        const cached = readCachedLiveStandings()
        if (cached) {
          setStandings(mergeOfficialStandings(metricsRows, cached.rows))
          setSource({
            label: 'Última leitura válida · Transfermarkt (cache local)',
            file: 'Transfermarkt · Série C 2026',
            page: null,
            updatedAt: cached.fetchedAt,
            round: cached.round,
            url: TRANSFERMARKT_SERIE_C_URL,
            persisted: true,
            automatic: false,
            metricsLabel: metricsSource.metricsLabel || metricsSource.label,
            metricsFile: metricsSource.metricsFile || metricsSource.file,
            metricsUpdatedAt: metricsSource.metricsUpdatedAt || metricsSource.updatedAt,
          })
          warnings.push('As fontes ao vivo não responderam nesta tentativa; foi exibida a última leitura válida disponível no cache local.')
        } else {
          setStandings([])
          setSource({
            ...INITIAL_SOURCE,
            metricsLabel: metricsSource.metricsLabel || metricsSource.label,
            metricsFile: metricsSource.metricsFile || metricsSource.file,
            metricsUpdatedAt: metricsSource.metricsUpdatedAt || metricsSource.updatedAt,
          })
          warnings.push('Não foi possível ler a classificação do Transfermarkt. A classificação do Wyscout não foi usada como substituta.')
        }
        warnings.push(officialResult.status === 'rejected'
          ? officialResult.reason.message
          : 'A resposta do Transfermarkt não trouxe uma classificação válida com as 20 equipes.')
      }

      setLoadWarning(warnings.filter(Boolean).join(' '))
      setLoadingLatest(false)
      running = false
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    const handleFocus = () => load(false)

    load(refreshKey > 0)
    const timer = window.setInterval(() => load(false), AUTO_REFRESH_MS)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refreshKey])

  const sorted = useMemo(() => {
    const rows = [...standings]
    if (mode === 'expected') return rows.sort((a, b) => b.xPoints - a.xPoints || b.expectedGoalDifference - a.expectedGoalDifference)
    if (mode === 'attack') return rows.sort((a, b) => b.goalsFor - a.goalsFor || b.xg - a.xg)
    if (mode === 'defense') return rows.sort((a, b) => a.goalsAgainst - b.goalsAgainst || a.xga - b.xga)
    return rows.sort((a, b) => a.position - b.position)
  }, [mode, standings])

  const realOrder = useMemo(() => [...standings].sort((a, b) => a.position - b.position), [standings])
  const secondPhaseGroups = useMemo(() => SECOND_PHASE_GROUPS.map(group => ({
    ...group,
    teams: group.positions
      .map(position => realOrder.find(row => Number(row.position) === position))
      .filter(Boolean),
  })), [realOrder])
  const firstPhaseComplete = standings.length === 20 && standings.every(row => Number(row.played) >= 19)
  const guarani = standings.find(row => row.team.toLocaleLowerCase('pt-BR').includes('confianca')) || realOrder[0]
  const leader = realOrder[0]
  const eighth = realOrder[7]
  const seventeenth = realOrder[16]
  const biggestOver = [...standings].sort((a, b) => (a.xPointsDelta || 0) - (b.xPointsDelta || 0))[0]
  const biggestUnder = [...standings].sort((a, b) => (b.xPointsDelta || 0) - (a.xPointsDelta || 0))[0]
  const maxPoints = standings.length ? Math.max(...standings.map(row => row.points), 1) : 1
  const maxXPoints = standings.length ? Math.max(...standings.map(row => row.xPoints), 1) : 1
  const bestAttackGoals = standings.length ? Math.max(...standings.map(row => row.goalsFor), 0) : 0
  const bestAttackTeams = standings.filter(row => row.goalsFor === bestAttackGoals).map(row => row.team)
  const maxPlayed = standings.length ? Math.max(...standings.map(row => row.played), 0) : 0

  const kpis = [
    { label: 'Líder', value: leader?.team || '-', helper: leader ? `${leader.points} pontos em ${leader.played} jogos` : '-', icon: Award, tone: 'amber' },
    { label: 'Confiança', value: guarani ? `${guarani.position}º` : '-', helper: guarani ? `${guarani.points} pontos · SG ${signed(guarani.goalDifference, 0)}` : '-', icon: ShieldCheck },
    { label: 'Corte do G8', value: eighth ? `${eighth.points} pts` : '-', helper: eighth ? `${eighth.team} ocupa a 8ª posição` : '-', icon: Target, tone: 'blue' },
    { label: 'Corte do Z4', value: seventeenth ? `${seventeenth.points} pts` : '-', helper: seventeenth ? `${seventeenth.team} abre a zona` : '-', icon: TrendingDown },
    { label: 'Melhor ataque', value: `${bestAttackGoals} gols`, helper: bestAttackTeams.join(' e ') || '-', icon: Goal },
    { label: 'Rodada atual', value: source.round ? `R${source.round}` : '-', helper: standings.length ? `${standings.length} equipes · até ${maxPlayed} jogos` : 'Aguardando o Transfermarkt', icon: FileText, tone: 'slate' },
  ]

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="space-y-6 p-4 md:p-8">
        <SectionHeader
          eyebrow="Tabela e performance esperada"
          title="Classificação da Série C"
          description="Classificação real lida diretamente do Transfermarkt. O Wyscout é usado somente na camada de xG, xGA, saldo esperado e xPoints."
          right={<div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">{MODES.map(item => <button key={item.key} type="button" onClick={() => setMode(item.key)} className={`flex-shrink-0 rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wider transition ${mode === item.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>{item.label}</button>)}</div>}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(item => <DashboardKpiCard key={item.label} {...item} />)}</div>

        <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">{loadingLatest ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}</span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">Fonte da classificação</p>
                <p className="mt-1 text-[12px] font-bold text-slate-700">{source.label}{source.page ? ` · página ${source.page}` : ''}</p>
                <p className="mt-1 text-[10px] text-slate-500">{loadingLatest ? 'Consultando diretamente o Transfermarkt e carregando somente as métricas avançadas do Wyscout...' : source.automatic ? `Tabela da rodada ${source.round}, consultada em ${formatDateTime(source.updatedAt)} e renovada automaticamente a cada 2 minutos.` : source.round ? `Última leitura do Transfermarkt: rodada ${source.round}, em ${formatDateTime(source.updatedAt)}.` : 'A classificação do Wyscout não será usada como tabela real.'}</p>
                {source.automatic && <p className="mt-1 text-[9px] font-semibold text-slate-400">Somente métricas avançadas: {source.metricsLabel} · {source.metricsFile} · {formatDate(source.metricsUpdatedAt)}.</p>}
                {loadWarning && <p className="mt-1 text-[9px] font-semibold text-amber-600">{loadWarning}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={loadingLatest} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-[9px] font-black uppercase tracking-wider text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loadingLatest ? 'animate-spin' : ''}`} /> Atualizar agora</button>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-left hover:border-emerald-200">
                  <div><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Fonte da tabela</p><p className="mt-1 max-w-[220px] truncate text-[10px] font-bold text-slate-700">{source.file}</p></div><ExternalLink className="h-4 w-4 text-emerald-600" />
                </a>
              ) : (
                <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3 text-right"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Arquivo de referência</p><p className="mt-1 text-[10px] font-bold text-slate-700">{source.file}</p></div>
              )}
              <Link href="/serie-c/upload?tipo=classificacao" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[9px] font-black uppercase tracking-wider text-white shadow-sm hover:bg-emerald-700"><UploadCloud className="h-4 w-4" /> Atualizar métricas Wyscout</Link>
            </div>
          </div>
        </section>

        {!standings.length && !loadingLatest && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 shadow-sm">
            <p className="text-[10px] font-black text-amber-800">Não foi possível carregar a tabela do Transfermarkt.</p>
            <p className="mt-1 text-[10px] font-semibold text-amber-700">Use o botão “Atualizar agora”. A classificação do Wyscout não será usada como substituta.</p>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <InsightCard icon={TrendingUp} title="Acima do xPoints" value={biggestOver?.team || '-'} description={biggestOver ? `${biggestOver.points} pontos reais contra ${formatNumberBR(biggestOver.xPoints, 1)} esperados (${signed(-biggestOver.xPointsDelta)} acima).` : '-'} tone="green" />
          <InsightCard icon={TrendingDown} title="Abaixo do xPoints" value={biggestUnder?.team || '-'} description={biggestUnder ? `${biggestUnder.points} pontos reais contra ${formatNumberBR(biggestUnder.xPoints, 1)} esperados (${signed(biggestUnder.xPointsDelta)} de diferença).` : '-'} tone="red" />
          <InsightCard icon={Sparkles} title="Leitura Confiança" value={guarani ? `${formatNumberBR(guarani.xPoints, 1)} xPts` : '-'} description={guarani ? `A equipe está ${formatNumberBR(Math.abs(guarani.points - guarani.xPoints), 1)} ponto ${guarani.points >= guarani.xPoints ? 'acima' : 'abaixo'} do valor esperado, com saldo real ${signed(guarani.goalDifference, 0)} e saldo esperado ${signed(guarani.expectedGoalDifference)}.` : '-'} tone="amber" />
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">Fase seguinte</p>
              <h2 className="bc mt-1 text-2xl font-black text-slate-900">Grupos da 2ª fase</h2>
              <p className="mt-1 text-[10px] text-slate-400">Composição recalculada automaticamente pela posição real: Grupo A (1º, 4º, 5º e 8º) e Grupo B (2º, 3º, 6º e 7º).</p>
            </div>
            <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-[8px] font-black uppercase tracking-wider ${firstPhaseComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <span className={`h-2 w-2 rounded-full ${firstPhaseComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {firstPhaseComplete ? 'Composição final' : source.round ? `Projeção · rodada ${source.round}` : 'Aguardando Transfermarkt'}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {secondPhaseGroups.map(group => <SecondPhaseGroupCard key={group.key} group={group} teams={group.teams} />)}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_34px_rgba(15,23,42,0.045)]">
          <div className="border-b border-slate-100 px-4 py-4"><div className="flex items-center gap-2"><CircleGauge className="h-4 w-4 text-emerald-700" /><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Tabela completa</p><p className="mt-0.5 text-[10px] text-slate-400">Posição real, produção ofensiva/defensiva e desempenho esperado.</p></div></div></div>
          <div className="overflow-auto">
            <table className="min-w-[1220px] w-full border-collapse text-[10px]">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200">
                  {['#', 'Equipe', 'Pts', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG', 'xG', 'Δ G-xG', 'xGA', 'Δ GC-xGA', 'xSG', 'Δ SG-xSG', 'xPts', 'Δ Pts-xPts'].map((label, index) => <th key={label} className={`whitespace-nowrap px-3 py-3 text-[8px] font-black uppercase tracking-wider text-slate-400 ${index === 1 ? 'sticky left-0 z-20 bg-slate-50 text-left' : index === 0 ? 'text-center' : 'text-right'}`}>{label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!sorted.length && (
                  <tr><td colSpan={18} className="px-6 py-12 text-center text-[11px] font-semibold text-slate-400">Aguardando a classificação ao vivo do Transfermarkt. Nenhuma classificação do Wyscout será exibida neste espaço.</td></tr>
                )}
                {sorted.map((row, index) => {
                  const displayPosition = mode === 'real' ? row.position : index + 1
                  const rowZone = zone(row.position)
                  const isGuarani = row.team.toLocaleLowerCase('pt-BR').includes('confianca')
                  return (
                    <tr key={row.team} className={`${isGuarani ? 'bg-emerald-50/90' : rowZone.row} hover:bg-slate-50`}>
                      <td className="px-3 py-3 text-center"><div className="flex items-center justify-center gap-2"><span className={`h-5 w-1 rounded-full ${rowZone.bar}`} /><span className={`bc text-lg font-black ${isGuarani ? 'text-emerald-700' : 'text-slate-600'}`}>{displayPosition}</span></div></td>
                      <td className={`sticky left-0 z-[1] px-3 py-3 ${isGuarani ? 'bg-emerald-50' : 'bg-white'}`}><div className="flex min-w-[190px] items-center gap-2.5"><TeamCrest name={row.team} size={26} /><div><p className={`text-[10px] font-black ${isGuarani ? 'text-emerald-800' : 'text-slate-700'}`}>{row.team}</p><p className="mt-0.5 text-[8px] font-bold text-slate-300">{rowZone.label}{mode !== 'real' ? ` · posição real ${row.position}º` : ''}</p></div></div></td>
                      <td className="px-3 py-3 text-right"><p className="bc text-xl font-black text-slate-900">{row.points}</p><MiniBar value={row.points} max={maxPoints} /></td>
                      <td className="px-3 py-3 text-right font-bold text-slate-500">{row.played}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600">{row.won ?? '-'}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-400">{row.drawn ?? '-'}</td>
                      <td className="px-3 py-3 text-right font-bold text-red-400">{row.lost ?? '-'}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-700">{row.goalsFor}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-700">{row.goalsAgainst}</td>
                      <td className={`px-3 py-3 text-right font-black ${row.goalDifference >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{signed(row.goalDifference, 0)}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-600">{formatNumberBR(row.xg, 1)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${row.xgDelta <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{signed(row.xgDelta)}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-600">{formatNumberBR(row.xga, 1)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${row.xgaDelta <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{signed(row.xgaDelta)}</td>
                      <td className={`px-3 py-3 text-right font-black ${row.expectedGoalDifference >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{signed(row.expectedGoalDifference)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${row.expectedGoalDifferenceDelta <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{signed(row.expectedGoalDifferenceDelta)}</td>
                      <td className="px-3 py-3 text-right"><p className="font-black text-slate-700">{formatNumberBR(row.xPoints, 1)}</p><MiniBar value={row.xPoints} max={maxXPoints} /></td>
                      <td className={`px-3 py-3 text-right font-black ${row.xPointsDelta <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{signed(row.xPointsDelta)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-3">{[{ label: 'G8', color: 'bg-emerald-500' }, { label: 'Faixa intermediária', color: 'bg-slate-300' }, { label: 'Z4', color: 'bg-red-500' }].map(item => <div key={item.label} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${item.color}`} /><span className="text-[8px] font-bold text-slate-400">{item.label}</span></div>)}</div>
        </section>
      </div>
    </AppShell>
  )
}
