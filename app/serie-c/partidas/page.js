'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronRight, FileSpreadsheet, Goal, Search, ShieldCheck, Swords, Target, UploadCloud } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import TeamCrest from '../../components/TeamCrest'
import SerieCTabs from '../_lib/SerieCTabs'
import { EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import { DashboardKpiCard } from '../../components/serie-c/competition'
import { FilterShell, SectionHeader } from '../../components/serie-c/professional'
import { findMetricColumn, findMetricColumnAny, formatMetricValue, formatNumberBR, toNumber } from '../../../lib/serieC'
import { formatMatchDate, isClubMatch } from '../../../lib/serieCMatch'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`

function metricValue(match, side, metric) {
  const metrics = side === 'home' ? match.home_metrics : match.away_metrics
  const aliases = metric === 'xG'
    ? ['Golos esperados', 'Gols esperados', 'xG', 'Expected goals']
    : metric === 'Chutes'
      ? ['Chutes', 'Remates / à baliza', 'Remates']
      : metric === 'Posse de bola, %'
        ? ['Posse de bola, %', 'Posse, %']
        : metric === 'Gols'
          ? ['Gols', 'Golos']
          : [metric]
  const col = findMetricColumnAny(metrics, aliases) || findMetricColumn(metrics, metric)
  return col ? toNumber(metrics?.[col]) : null
}

function CompactComparison({ label, home, away, metric = label }) {
  const max = Math.max(Math.abs(home || 0), Math.abs(away || 0), 1)
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="bc text-lg font-black text-slate-800">{formatMetricValue(metric, home)}</span>
        <span className="text-center text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">{label}</span>
        <span className="bc text-lg font-black text-slate-800">{formatMetricValue(metric, away)}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex h-1.5 justify-end overflow-hidden rounded-l-full bg-slate-200"><span className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(5, Math.abs(home || 0) / max * 100)}%` }} /></div>
        <div className="h-1.5 overflow-hidden rounded-r-full bg-slate-200"><span className="block h-full rounded-full bg-slate-500" style={{ width: `${Math.max(5, Math.abs(away || 0) / max * 100)}%` }} /></div>
      </div>
    </div>
  )
}

function MatchCard({ match }) {
  const homeXg = metricValue(match, 'home', 'xG')
  const awayXg = metricValue(match, 'away', 'xG')
  const keyMetrics = [
    ...(homeXg !== null || awayXg !== null ? [{ label: 'xG', metric: 'xG' }] : []),
    { label: 'Chutes', metric: 'Chutes' },
    { label: 'Posse', metric: 'Posse de bola, %' },
    { label: 'Índice', metric: 'Índice' },
  ].slice(0, 3)
  return (
    <Link href={`/serie-c/partidas/${match.id}`} className={`group block overflow-hidden rounded-2xl border bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_36px_rgba(15,23,42,0.08)] ${isClubMatch(match) ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200/80'}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">Rodada {match.round || '-'}</span>
          {isClubMatch(match) && <span className="rounded-lg bg-emerald-600 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">Confiança</span>}
        </div>
        <span className="text-[10px] font-semibold text-slate-400">{formatMatchDate(match.match_date)}</span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamCrest name={match.home_team} size={42} />
            <p className="mt-2 line-clamp-2 text-[11px] font-black leading-tight text-slate-700">{match.home_team}</p>
            <p className="mt-0.5 text-[9px] font-bold text-slate-300">{match.home_code}</p>
          </div>
          <div className="text-center">
            <p className="bc text-4xl font-black tracking-tight text-slate-900">{match.home_score}<span className="mx-1 text-slate-300">:</span>{match.away_score}</p>
            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-slate-300">Final</p>
            {(homeXg !== null || awayXg !== null) && <p className="mt-1.5 whitespace-nowrap text-[9px] font-black text-emerald-700">xG {formatMetricValue('xG', homeXg)} · {formatMetricValue('xG', awayXg)}</p>}
          </div>
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamCrest name={match.away_team} size={42} />
            <p className="mt-2 line-clamp-2 text-[11px] font-black leading-tight text-slate-700">{match.away_team}</p>
            <p className="mt-0.5 text-[9px] font-bold text-slate-300">{match.away_code}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {keyMetrics.map(item => <CompactComparison key={item.metric} label={item.label} metric={item.metric} home={metricValue(match, 'home', item.metric)} away={metricValue(match, 'away', item.metric)} />)}
        </div>
        <div className="mt-4 flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
          Abrir análise completa <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}

export default function SerieCPartidasPage() {
  const [matches, setMatches] = useState([])
  const [rounds, setRounds] = useState([])
  const [teams, setTeams] = useState([])
  const [summary, setSummary] = useState(null)
  const [round, setRound] = useState('')
  const [team, setTeam] = useState('')
  const [search, setSearch] = useState('')
  const [onlyClub, setOnlyClub] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState(null)

  const load = useCallback(async ({ preserveRound = true } = {}) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/serie-c/competition-matches?season=2026', { cache: 'no-store', signal: AbortSignal.timeout(25000) })
      const payload = await response.json()
      if (!response.ok || payload.error) throw new Error(payload.error || 'Falha ao carregar partidas.')
      setMatches(payload.matches || [])
      setRounds(payload.rounds || [])
      setTeams(payload.teams || [])
      setSummary(payload.summary || null)
      if (!preserveRound && payload.rounds?.length) setRound(String(payload.rounds.at(-1)))
      if (!round && payload.rounds?.length) setRound(String(payload.rounds.at(-1)))
    } catch (err) {
      setError(err?.name === 'TimeoutError' ? 'A consulta demorou mais de 25 segundos.' : err.message)
    } finally {
      setLoading(false)
    }
  }, [round])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImport(event) {
    event.preventDefault()
    if (!file) {
      setImportStatus({ type: 'error', message: 'Selecione a planilha .xlsx.' })
      return
    }
    setImporting(true)
    setImportStatus(null)
    try {
      const form = new FormData()
      form.append('season', '2026')
      form.append('competition', 'Brasileiro Série C')
      form.append('file', file)
      const response = await fetch('/api/serie-c/competition-matches', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
      const payload = await response.json()
      if (!response.ok || payload.error) throw new Error(payload.error || 'Falha ao importar.')
      setImportStatus({ type: 'ok', message: `${payload.imported} partidas importadas/atualizadas em ${payload.rounds} rodadas.${payload.xgMatches ? ` ${payload.xgMatches} com xG reconhecido.` : ''}${(payload.clubTimelineMatches ?? payload.clubTimelineMatches) ? ` ${payload.clubTimelineMatches ?? payload.clubTimelineMatches} sincronizadas com a Linha do Tempo do Confiança.` : ''}` })
      await load({ preserveRound: false })
    } catch (err) {
      setImportStatus({ type: 'error', message: err?.name === 'TimeoutError' ? 'A importação excedeu 60 segundos.' : err.message })
    } finally {
      setImporting(false)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return matches.filter(match => {
      if (round && String(match.round) !== String(round)) return false
      if (team && match.home_team !== team && match.away_team !== team) return false
      if (onlyClub && !isClubMatch(match)) return false
      if (query && !`${match.home_team} ${match.away_team} ${match.match_label}`.toLowerCase().includes(query)) return false
      return true
    })
  }, [matches, round, team, onlyClub, search])

  const filteredGoals = filtered.reduce((sum, match) => sum + Number(match.home_score || 0) + Number(match.away_score || 0), 0)
  const latestImported = matches[0]?.imported_at
  const kpis = [
    { label: 'Partidas na base', value: formatNumberBR(matches.length), helper: `${rounds.length} rodadas identificadas`, icon: Swords, tone: 'slate' },
    { label: 'Jogos no filtro', value: formatNumberBR(filtered.length), helper: round ? `Rodada ${round}` : 'Todas as rodadas', icon: CalendarDays, tone: 'blue' },
    { label: 'Gols no filtro', value: formatNumberBR(filteredGoals), helper: filtered.length ? `${formatNumberBR(filteredGoals / filtered.length, 2)} por jogo` : '-', icon: Goal, tone: 'amber' },
    { label: 'Times mapeados', value: formatNumberBR(teams.length || summary?.teams), helper: 'Identidade por partida', icon: ShieldCheck },
    { label: 'Última rodada', value: summary?.latestRound ? `R${summary.latestRound}` : '-', helper: 'Inferida pelas datas da planilha', icon: Target },
    { label: 'Fonte', value: 'Wyscout', helper: latestImported ? `Atualizada em ${new Date(latestImported).toLocaleDateString('pt-BR')}` : 'Aguardando importação', icon: FileSpreadsheet },
  ]

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="space-y-6 p-4 md:p-8">
        <SectionHeader
          eyebrow="Competição jogo a jogo"
          title="Partidas da Série C"
          description="Calendário completo por rodada, placares e acesso à página profissional de cada partida com todas as métricas da planilha Wyscout."
          right={
            <FilterShell>
              <select value={round} onChange={event => setRound(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-bold text-gray-600">
                <option value="">Todas as rodadas</option>
                {rounds.map(value => <option key={value} value={value}>Rodada {value}</option>)}
              </select>
              <select value={team} onChange={event => setTeam(event.target.value)} className="max-w-52 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-bold text-gray-600">
                <option value="">Todos os times</option>
                {teams.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500"><input type="checkbox" checked={onlyClub} onChange={event => setOnlyClub(event.target.checked)} /> Só Confiança</label>
            </FilterShell>
          }
        />

        <form onSubmit={handleImport} className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-emerald-700"><UploadCloud className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-[0.16em]">Alimentação da página</p></div>
              <p className="mt-2 text-[12px] font-bold text-slate-700">Importe “Estatísticas da partida” ou “Team Stats”.</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">O sistema reconhece as duas linhas de cada jogo. Na Team Stats, “Golos esperados” é incorporado como xG sem apagar as métricas já existentes.</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row xl:max-w-2xl">
              <input type="file" accept=".xlsx,.xls" onChange={event => setFile(event.target.files?.[0] || null)} className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[10px] text-slate-500" />
              <button type="submit" disabled={importing} className="rounded-xl bg-emerald-600 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-white transition hover:bg-emerald-700 disabled:opacity-50">{importing ? 'Importando...' : 'Importar planilha'}</button>
            </div>
          </div>
          {importStatus && <p className={`mt-3 rounded-xl border px-3 py-2 text-[10px] font-bold ${importStatus.type === 'ok' ? 'border-emerald-200 bg-white text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>{importStatus.message}</p>}
        </form>

        {loading && <Loading />}
        {!loading && error && <ErrorState message={error} onRetry={() => load()} />}
        {!loading && !error && matches.length === 0 && <EmptyState title="Nenhuma partida importada" description="Use o campo acima para importar a planilha completa da competição." />}

        {!loading && !error && matches.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(item => <DashboardKpiCard key={item.label} {...item} />)}</div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Agenda e resultados</p>
                <p className="mt-1 text-[12px] font-bold text-slate-700">{filtered.length} partida(s) no recorte atual</p>
              </div>
              <div className="relative w-full md:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar confronto..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[11px] outline-none focus:border-emerald-200 focus:bg-white" /></div>
            </div>

            {filtered.length === 0 ? <EmptyState title="Nenhuma partida atende aos filtros" description="Altere rodada, equipe ou busca textual." /> : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">{filtered.map(match => <MatchCard key={match.id} match={match} />)}</div>}
          </>
        )}
      </div>
    </AppShell>
  )
}
