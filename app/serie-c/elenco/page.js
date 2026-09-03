'use client'

import { useMemo, useState } from 'react'
import { Search, Sparkles, Target, Users } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import { useSerieCData } from '../_lib/useSerieCData'
import { EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import {
  ConstructionLeadersPanel, DashboardFilters, dashboardIcons,
  ElencoPerformanceTable, ExecutiveInsightStrip, ExecutiveKpiCard,
  GoalContributionPanel, IndividualLeaderCards, IndividualPerformancePanel,
  LeaderboardPanel, PlayerComparisonPanel, SquadCompositionPanel, XgScatterPanel,
} from '../../components/serie-c/ElencoDashboard'
import {
  findMetricColumn, formatMetricValue, formatNumberBR, isNumeric,
  isVolumeMetric, per90, per90Label, playerProfile, toNumber,
} from '../../../lib/serieC'
import {
  PLAYER_CATEGORY_ORDER, PLAYER_OVERVIEW_METRICS, numericMetricKeys, playerMetricCategory,
  metricEligibilityForRanking, metricHigherIsBetter,
} from '../../../lib/serieCMetricRegistry'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`


const METRICS = {
  index: 'Índice',
  goals: 'Gols',
  assists: 'Assistências',
  xa: 'xA (assistências esperadas)',
  xg: 'xG (Gols esperados)',
  nxg: 'NxG (xG líquido, diferença entre xGT e xGOPP)',
  progressive: 'Passes progressivos',
  area: 'Passes para a área',
  keyPasses: 'Passes-chave',
  duels: 'Duelos ganhos, %',
  recoveries: 'Recuperações da bola',
  highRecoveries: 'Recuperações da bola no campo adversário',
  interceptions: 'Interceptações',
  actionsBox: 'Ações na área adversária',
  shots: 'Chutes',
  shotsOnTarget: 'Chutes no alvo, %',
  dribbles: 'Dribles bem-sucedidos, %',
  defensiveDuels: 'Duelos defensivos ganhos, %',
  losses: 'Perdas da bola',
}

function sum(values) {
  return values.reduce((total, value) => total + (toNumber(value) || 0), 0)
}

function average(values) {
  const valid = values.map(value => toNumber(value)).filter(value => value !== null)
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null
}

function groupPosition(position) {
  const pos = String(position || '').toUpperCase().replace(/[^A-Z]/g, '')
  if (/(GK)/.test(pos)) return 'Goleiros'
  if (/(CB|LB|RB|LWB|RWB)/.test(pos)) return 'Defensores'
  if (/(DM|CM|AM|LM|RM)/.test(pos)) return 'Meio-campistas'
  if (/(LW|RW|CF|ST|SS|FW)/.test(pos)) return 'Atacantes'
  return 'Outros'
}

function FilterField({ label, children }) {
  return (
    <label className="block min-w-[145px]">
      <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</span>
      {children}
    </label>
  )
}

const SELECT_CLASS = 'h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white'

export default function SerieCElencoPage() {
  const [round, setRound] = useState(null)
  const [format, setFormat] = useState('total')
  const [minMinutes, setMinMinutes] = useState(0)
  const [position, setPosition] = useState('')
  const [metricView, setMetricView] = useState('Visão geral')
  const [metricSearch, setMetricSearch] = useState('')

  const { data, loading, error } = useSerieCData({ round })
  const allPlayers = (data?.players || []).filter(player => player.is_club)

  const positions = useMemo(
    () => Array.from(new Set(allPlayers.map(player => player.position).filter(Boolean))).sort(),
    [allPlayers]
  )

  const players = useMemo(() => allPlayers.filter(player =>
    (!position || player.position === position) &&
    (!minMinutes || toNumber(player.minutes) >= minMinutes)
  ), [allPlayers, position, minMinutes])

  const sampleRow = players[0]?.metrics || allPlayers[0]?.metrics || {}
  const availableMetrics = useMemo(() => numericMetricKeys(allPlayers), [allPlayers])
  const metricCategories = useMemo(() => ['Visão geral', ...PLAYER_CATEGORY_ORDER.filter(group => availableMetrics.some(metric => playerMetricCategory(metric) === group)), 'Todas'], [availableMetrics])
  const selectedMetricNames = useMemo(() => {
    let list = metricView === 'Visão geral'
      ? PLAYER_OVERVIEW_METRICS.map(name => findMetricColumn(sampleRow, name)).filter(Boolean)
      : metricView === 'Todas' ? availableMetrics : availableMetrics.filter(metric => playerMetricCategory(metric) === metricView)
    const q = metricSearch.toLowerCase().trim()
    if (q) list = list.filter(metric => metric.toLowerCase().includes(q))
    return [...new Set(list)]
  }, [metricView, metricSearch, sampleRow, availableMetrics])

  const metricColumns = useMemo(() => Object.fromEntries(
    Object.entries(METRICS).map(([key, metric]) => [key, findMetricColumn(sampleRow, metric)])
  ), [sampleRow])

  const analytics = useMemo(() => {
    const value = (player, key) => metricColumns[key] ? toNumber(player.metrics?.[metricColumns[key]]) : null

    const goals = sum(players.map(player => value(player, 'goals')))
    const assists = sum(players.map(player => value(player, 'assists')))
    const xa = sum(players.map(player => value(player, 'xa')))
    const xg = sum(players.map(player => value(player, 'xg')))
    const nxg = sum(players.map(player => value(player, 'nxg')))
    const minutes = sum(players.map(player => player.minutes))
    const averageIndex = average(players.map(player => value(player, 'index')))
    const regularPlayers = players.filter(player => (toNumber(player.minutes) || 0) >= 450).length
    const keyPasses = sum(players.map(player => value(player, 'keyPasses')))
    const progressivePasses = sum(players.map(player => value(player, 'progressive')))
    const recoveries = sum(players.map(player => value(player, 'recoveries')))
    const highRecoveries = sum(players.map(player => value(player, 'highRecoveries')))
    const interceptions = sum(players.map(player => value(player, 'interceptions')))
    const actionsBox = sum(players.map(player => value(player, 'actionsBox')))
    const averageDuels = average(players.map(player => value(player, 'duels')))

    const indexData = [...players]
      .map(player => ({ name: player.player, value: value(player, 'index') }))
      .filter(item => item.value !== null)
      .sort((a, b) => b.value - a.value)

    const goalContributions = [...players]
      .map(player => ({
        name: player.player,
        value: (value(player, 'goals') || 0) + (value(player, 'assists') || 0),
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)

    const xgGoals = players
      .map(player => ({ name: player.player, xg: value(player, 'xg'), gols: value(player, 'goals') || 0 }))
      .filter(item => item.xg !== null)

    const construction = [...players]
      .map(player => ({
        name: player.player,
        value: (value(player, 'progressive') || 0) + (value(player, 'area') || 0),
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)

    const groupMap = new Map()
    for (const player of players) {
      const group = groupPosition(player.position)
      groupMap.set(group, (groupMap.get(group) || 0) + 1)
    }
    const groupOrder = ['Defensores', 'Meio-campistas', 'Atacantes', 'Goleiros', 'Outros']
    const groups = groupOrder
      .map(label => ({ label, value: groupMap.get(label) || 0 }))
      .filter(group => group.value > 0)

    const totalConstruction = construction.reduce((total, item) => total + item.value, 0)
    const topThreeContributions = goalContributions.slice(0, 3).reduce((total, item) => total + item.value, 0)
    const totalContributions = goalContributions.reduce((total, item) => total + item.value, 0)
    const efficiency = xg > 0 ? goals / xg * 100 : null
    const xgBalance = goals - xg
    const leader = indexData[0]
    const builder = construction[0]
    const metricLeader = (key, label, metric) => {
      const col = metricColumns[key]
      if (!col) return null
      const higher = metricHigherIsBetter(col, 'player')
      const entries = players
        .filter(player => metricEligibilityForRanking(player, col, { entityType:'player', minMinutes:0 }).eligible)
        .map(player => ({ name: player.player, value:value(player,key) }))
        .filter(item => item.value !== null)
        .sort((a,b) => higher ? b.value-a.value : a.value-b.value)
      return entries[0] ? { ...entries[0], label, metric } : null
    }
    const individualLeaders = [
      metricLeader('goals', 'Artilharia', 'Gols'),
      metricLeader('assists', 'Assistências', 'Assistências'),
      metricLeader('keyPasses', 'Passes-chave', 'Passes-chave'),
      metricLeader('progressive', 'Passes progressivos', 'Passes progressivos'),
      metricLeader('duels', 'Duelos ganhos', 'Duelos ganhos, %'),
      metricLeader('recoveries', 'Recuperações', 'Recuperações da bola'),
      metricLeader('xa', 'xA', 'xA (assistências esperadas)'),
      metricLeader('actionsBox', 'Ações na área', 'Ações na área adversária'),
      metricLeader('interceptions', 'Interceptações', 'Interceptações'),
    ].filter(Boolean)

    return {
      goals, assists, xa, xg, nxg, minutes, averageIndex, regularPlayers,
      keyPasses, progressivePasses, recoveries, highRecoveries, interceptions, actionsBox, averageDuels,
      indexData, goalContributions, xgGoals, construction, groups,
      efficiency, xgBalance, leader, builder, totalConstruction, individualLeaders,
      topThreeShare: totalContributions ? topThreeContributions / totalContributions * 100 : null,
    }
  }, [players, metricColumns])

  const columns = useMemo(() => {
    const cols = [
      { key: 'player', label: 'Jogador', render: row => row.player },
      { key: 'profile', label: 'Perfil', render: row => playerProfile(row), sortValue: row => playerProfile(row) },
      { key: 'position', label: 'Pos', align: 'center', render: row => row.position || '-' },
      { key: 'age', label: 'Idade', align: 'center', render: row => row.age ?? '-' },
      { key: 'minutes', label: 'Min', align: 'right', render: row => row.minutes ?? '-', sortValue: row => toNumber(row.minutes) },
      {
        key: 'indice', label: 'Índice', align: 'right',
        render: row => metricColumns.index ? toNumber(row.metrics?.[metricColumns.index]) ?? '-' : '-',
        sortValue: row => metricColumns.index ? toNumber(row.metrics?.[metricColumns.index]) : null,
      },
    ]

    for (const col of selectedMetricNames) {
      if (!col || col === metricColumns.index) continue
      const metricName = col
      const volume = isVolumeMetric(col)
      const showTotal = format === 'total' || format === 'both'
      const showPer90 = volume && (format === 'per90' || format === 'both')

      if (showTotal) cols.push({
        key: col,
        label: metricName,
        align: 'right',
        render: row => isNumeric(row.metrics?.[col]) ? toNumber(row.metrics[col]) : '-',
        sortValue: row => toNumber(row.metrics?.[col]),
      })
      if (showPer90) cols.push({
        key: `${col}__p90`,
        label: per90Label(metricName),
        align: 'right',
        render: row => per90(row.metrics?.[col], row.minutes),
        sortValue: row => per90(row.metrics?.[col], row.minutes),
      })
    }
    return cols
  }, [selectedMetricNames, format, metricColumns])

  const executiveInsights = useMemo(() => {
    const xgText = analytics.xgBalance === null
      ? 'A base atual não possui xG suficiente para calcular o saldo de conversão.'
      : analytics.xgBalance >= 0
        ? `O elenco marca ${formatNumberBR(Math.abs(analytics.xgBalance), 2)} gol(s) acima do xG acumulado.`
        : `O elenco marca ${formatNumberBR(Math.abs(analytics.xgBalance), 2)} gol(s) abaixo do xG acumulado.`

    const concentrationText = analytics.topThreeShare === null
      ? 'Ainda não há participações em gols registradas neste recorte.'
      : `Os três principais contribuidores concentram ${formatNumberBR(analytics.topThreeShare, 0)}% das participações diretas.`

    const builderText = analytics.builder
      ? `${analytics.builder.name} lidera a construção com ${formatNumberBR(analytics.builder.value, 0)} ações progressivas e para a área.`
      : 'Sem volume de construção disponível no recorte selecionado.'

    return [
      { title: 'Conversão das chances', text: xgText, icon: Target },
      { title: 'Concentração ofensiva', text: concentrationText, icon: Users },
      { title: 'Principal construtor', text: builderText, icon: Sparkles },
    ]
  }, [analytics])

  const activeFilters = Number(Boolean(position)) + Number(Boolean(minMinutes)) + Number(format !== 'total')
  const currentRound = data?.upload?.round ?? ''
  const currentSeason = data?.upload?.season ?? ''

  function resetFilters() {
    setPosition('')
    setMinMinutes(0)
    setFormat('total')
  }

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />

      <div className="space-y-5 p-4 md:p-6 xl:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">Inteligência de desempenho</p>
            </div>
            <h2 className="bc text-3xl font-black leading-none text-slate-900">Painel executivo do elenco</h2>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-slate-500">
              Leitura consolidada da produção individual, construção, eficiência ofensiva e distribuição do plantel no recorte selecionado.
            </p>
          </div>
          {!loading && allPlayers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-emerald-700">Rodada {currentRound} · {currentSeason}</span>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500">{players.length} de {allPlayers.length} atletas</span>
            </div>
          )}
        </div>

        <DashboardFilters
          activeFilters={activeFilters}
          onReset={resetFilters}
          updatedLabel={currentRound ? `Rodada ${currentRound} · ${currentSeason}` : null}
        >
          <FilterField label="Rodada">
            <select value={currentRound} onChange={event => setRound(Number(event.target.value))} className={SELECT_CLASS}>
              {(data?.uploads || []).map(upload => (
                <option key={upload.id} value={upload.round}>Rodada {upload.round} · {upload.season}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Posição">
            <select value={position} onChange={event => setPosition(event.target.value)} className={SELECT_CLASS}>
              <option value="">Todas as posições</option>
              {positions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </FilterField>

          <FilterField label="Minutagem mínima">
            <select value={minMinutes} onChange={event => setMinMinutes(Number(event.target.value))} className={SELECT_CLASS}>
              {[0, 180, 300, 450, 600, 900].map(value => <option key={value} value={value}>{value ? `≥ ${value} min` : 'Sem mínimo'}</option>)}
            </select>
          </FilterField>

          <div className="min-w-[310px]">
            <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Formato da tabela</span>
            <div className="flex h-9 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[
                { key: 'total', label: 'Total' },
                { key: 'per90', label: 'Por 90' },
                { key: 'both', label: 'Total + 90' },
              ].map(option => (
                <button key={option.key} type="button" onClick={() => setFormat(option.key)} className={`flex-1 rounded-lg px-3 text-[8px] font-black uppercase tracking-wider transition ${format === option.key ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </DashboardFilters>

        {loading && <Loading />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && allPlayers.length === 0 && (
          <EmptyState title="Nenhum jogador do Confiança encontrado" description="Confira se o upload semanal da planilha de jogadores de linha foi feito para esta rodada." />
        )}

        {!loading && !error && allPlayers.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <ExecutiveKpiCard
                label="Atletas no recorte"
                value={formatNumberBR(players.length, 0)}
                support={`${analytics.regularPlayers} atletas com pelo menos 450 minutos`}
                icon={dashboardIcons.players}
                accent
              />
              <ExecutiveKpiCard
                label="Métricas disponíveis"
                value={formatNumberBR(availableMetrics.length, 0)}
                support="Cobertura integral do novo modelo de jogadores"
                icon={dashboardIcons.index}
              />
              <ExecutiveKpiCard
                label="Minutos acumulados"
                value={formatNumberBR(analytics.minutes, 0)}
                support={`Média de ${players.length ? formatNumberBR(analytics.minutes / players.length, 0) : 0} min por atleta`}
                icon={dashboardIcons.minutes}
              />
              <ExecutiveKpiCard
                label="Índice médio"
                value={formatMetricValue('Índice', analytics.averageIndex)}
                support={analytics.leader ? `Líder: ${analytics.leader.name} (${formatMetricValue('Índice', analytics.leader.value)})` : 'Sem índice disponível'}
                icon={dashboardIcons.index}
              />
              <ExecutiveKpiCard
                label="Gols + assistências"
                value={formatNumberBR(analytics.goals + analytics.assists, 0)}
                support={`${formatNumberBR(analytics.goals, 0)} gols e ${formatNumberBR(analytics.assists, 0)} assistências`}
                icon={dashboardIcons.goals}
              />
              <ExecutiveKpiCard
                label="xG acumulado"
                value={formatMetricValue('xG', analytics.xg)}
                support={`${players.length ? formatNumberBR(analytics.xg / players.length, 2) : 0} xG por atleta no recorte`}
                icon={dashboardIcons.xg}
              />
              <ExecutiveKpiCard
                label="Conversão sobre xG"
                value={analytics.efficiency === null ? '-' : `${formatNumberBR(analytics.efficiency, 0)}%`}
                support={analytics.xgBalance >= 0 ? 'Produção acima do volume esperado' : 'Conversão abaixo do volume esperado'}
                icon={dashboardIcons.efficiency}
              />
              <ExecutiveKpiCard
                label="Passes-chave"
                value={formatNumberBR(analytics.keyPasses, 0)}
                support={`${players.length ? formatNumberBR(analytics.keyPasses / players.length, 1) : 0} por atleta no recorte`}
                icon={dashboardIcons.keyPasses}
              />
              <ExecutiveKpiCard
                label="Passes progressivos"
                value={formatNumberBR(analytics.progressivePasses, 0)}
                support={`${players.length ? formatNumberBR(analytics.progressivePasses / players.length, 1) : 0} por atleta no recorte`}
                icon={dashboardIcons.progressive}
              />
              <ExecutiveKpiCard
                label="Duelos ganhos"
                value={analytics.averageDuels === null ? '-' : `${formatNumberBR(analytics.averageDuels, 1)}%`}
                support="Média individual do elenco filtrado"
                icon={dashboardIcons.duels}
              />
              <ExecutiveKpiCard
                label="Recuperações"
                value={formatNumberBR(analytics.recoveries, 0)}
                support={`${players.length ? formatNumberBR(analytics.recoveries / players.length, 1) : 0} por atleta no recorte`}
                icon={dashboardIcons.recoveries}
              />
            </div>

            <ExecutiveInsightStrip items={executiveInsights} />

            <IndividualLeaderCards items={analytics.individualLeaders} />

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 xl:col-span-4">
                <LeaderboardPanel data={analytics.indexData} metric="Índice" title="Top índice do elenco" description="Ranking geral dos jogadores no recorte selecionado." />
              </div>
              <div className="col-span-12 md:col-span-5 xl:col-span-3">
                <GoalContributionPanel goals={analytics.goals} assists={analytics.assists} />
              </div>
              <div className="col-span-12 md:col-span-7 xl:col-span-5">
                <XgScatterPanel data={analytics.xgGoals} />
              </div>

              <div className="col-span-12 md:col-span-5 xl:col-span-3">
                <SquadCompositionPanel groups={analytics.groups} total={players.length} />
              </div>
              <div className="col-span-12 xl:col-span-6">
                <PlayerComparisonPanel players={players} />
              </div>
              <div className="col-span-12 md:col-span-7 xl:col-span-3">
                <ConstructionLeadersPanel data={analytics.construction} />
              </div>
            </div>

            <IndividualPerformancePanel players={players} />

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1">{metricCategories.map(value => <button key={value} type="button" onClick={() => setMetricView(value)} className={`flex-shrink-0 rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-wider ${metricView === value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>{value}</button>)}</div>
                <div className="relative w-full xl:max-w-xs"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" /><input value={metricSearch} onChange={event => setMetricSearch(event.target.value)} placeholder="Buscar métrica na tabela..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[10px]" /></div>
              </div>
              <p className="mt-2 text-[9px] font-semibold text-slate-400">{selectedMetricNames.length} métricas no bloco atual · use “Todas” para navegar por toda a planilha.</p>
            </div>

            <ElencoPerformanceTable
              columns={columns}
              rows={players}
              rowKey={row => row.player}
              defaultSortKey="indice"
              searchPlaceholder="Buscar jogador ou posição..."
            />
          </>
        )}
      </div>
    </AppShell>
  )
}
