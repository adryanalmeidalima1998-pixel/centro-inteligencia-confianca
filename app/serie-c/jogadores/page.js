'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Crosshair, Layers3, Search, Sparkles, Target, UserRound, Users } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import RoundSelector from '../_lib/RoundSelector'
import { useSerieCData } from '../_lib/useSerieCData'
import { TableFormatToggle, MinMinutesSelect, EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import StatsTable from '../../components/serie-c/StatsTable'
import { SectionHeader, FilterShell } from '../../components/serie-c/professional'
import {
  DashboardKpiCard,
  DonutBreakdown,
  EntitySpotlight,
  LeaderRows,
  Panel,
  PercentileRadar,
  PodiumCard,
  QuadrantScatter,
} from '../../components/serie-c/competition'
import {
  averageOf,
  findMetricColumn,
  formatMetricValue,
  formatNumberBR,
  isIdentityColumn,
  isNumeric,
  isVolumeMetric,
  per90,
  per90Label,
  playerProfile,
  rankByMetric,
  toNumber,
} from '../../../lib/serieC'
import {
  PLAYER_CATEGORY_ORDER, PLAYER_OVERVIEW_METRICS, PLAYER_RADAR_METRICS,
  playerMetricCategory, metricEligibilityForRanking, metricHigherIsBetter, numericMetricKeys,
} from '../../../lib/serieCMetricRegistry'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`


function ranking(players, sample, metricName, { limit = 8, mode = 'total' } = {}) {
  const col = findMetricColumn(sample, metricName) || metricName
  if (!col) return []
  const higher = metricHigherIsBetter(col, 'player')
  const volume = isVolumeMetric(col)
  return players
    .filter(player => metricEligibilityForRanking(player, col, { entityType:'player', minMinutes:0 }).eligible)
    .map(player => {
      const raw = toNumber(player.metrics?.[col])
      const value = mode === 'per90' && volume ? per90(raw, player.minutes) : raw
      return { name: player.player, team: player.team, value, isClub: player.is_club, per90Mode: mode === 'per90' && volume, player }
    })
    .filter(item => item.value !== null)
    .sort((a, b) => higher ? b.value - a.value : a.value - b.value)
    .slice(0, limit)
}

function metricValue(player, col, mode) {
  const raw = toNumber(player?.metrics?.[col])
  if (raw === null) return null
  return mode === 'per90' && isVolumeMetric(col) ? per90(raw, player.minutes) : raw
}

function percentileFor(players, selected, col, mode = 'total') {
  if (!selected || !col) return null
  const eligible = players.filter(player => metricEligibilityForRanking(player, col, { entityType:'player', minMinutes:0 }).eligible)
  const ranked = rankByMetric(eligible.map(player => ({ id: `${player.player}__${player.team}`, value: metricValue(player, col, mode) })), metricHigherIsBetter(col, 'player'))
  return ranked.find(item => item.id === `${selected.player}__${selected.team}`)?.percentile ?? null
}

function rankFor(players, selected, col, mode = 'total') {
  if (!selected || !col) return null
  const eligible = players.filter(player => metricEligibilityForRanking(player, col, { entityType:'player', minMinutes:0 }).eligible)
  const ranked = rankByMetric(eligible.map(player => ({ id: `${player.player}__${player.team}`, value: metricValue(player, col, mode) })), metricHigherIsBetter(col, 'player'))
  return ranked.find(item => item.id === `${selected.player}__${selected.team}`) || null
}

function positionGroup(position) {
  const pos = String(position || '').toUpperCase()
  if (/CB|LCB|RCB|ZAG/.test(pos)) return 'Zagueiros'
  if (/LB|RB|LWB|RWB|LAT/.test(pos)) return 'Laterais'
  if (/DM|CM|RCM|LCM|VOL/.test(pos)) return 'Volantes'
  if (/AM|CAM|LAM|RAM|MEI/.test(pos)) return 'Meias ofensivos'
  if (/LW|RW|WF|PON/.test(pos)) return 'Pontas'
  if (/CF|ST|FW|ATA/.test(pos)) return 'Atacantes'
  return 'Outros'
}

function CompleteMetricCard({ metric, player, comparePlayer, population, format }) {
  const mode = format === 'per90' ? 'per90' : 'total'
  const value = metricValue(player, metric, mode)
  const raw = toNumber(player?.metrics?.[metric])
  const p90 = isVolumeMetric(metric) ? per90(raw, player?.minutes) : null
  const compare = comparePlayer ? metricValue(comparePlayer, metric, mode) : null
  const eligibility = metricEligibilityForRanking(player, metric, { entityType:'player', minMinutes:0 })
  const rank = eligibility.eligible ? rankFor(population, player, metric, mode) : null
  const better = compare !== null && value !== null ? (metricHigherIsBetter(metric, 'player') ? value >= compare : value <= compare) : null

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_7px_22px_rgba(15,23,42,0.035)]">
      <div className="flex min-h-8 items-start justify-between gap-3">
        <p className="text-[8px] font-black uppercase leading-relaxed tracking-[0.13em] text-slate-400">{metric}</p>
        {rank?.percentile !== null && rank?.percentile !== undefined
          ? <span className={`rounded-lg px-2 py-1 text-[8px] font-black ${rank.percentile >= 80 ? 'bg-emerald-100 text-emerald-700' : rank.percentile >= 50 ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-500'}`}>P{rank.percentile}</span>
          : eligibility.reason === 'sample' && <span className="rounded-lg bg-amber-50 px-2 py-1 text-[7px] font-black uppercase text-amber-600">Amostra baixa</span>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="bc text-3xl font-black leading-none text-slate-900">{formatMetricValue(metric, value, { per90Mode: mode === 'per90' })}</p>
          <p className="mt-1 text-[8px] font-bold text-slate-400">{mode === 'per90' && isVolumeMetric(metric) ? 'por 90 minutos' : 'total / taxa original'}</p>
        </div>
        {rank?.rank && <div className="text-right"><p className="bc text-xl font-black text-emerald-700">{rank.rank}º</p><p className="text-[7px] font-bold text-slate-300">de {rank.total}</p></div>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        <div className="rounded-xl bg-slate-50 px-2.5 py-2"><p className="text-[7px] font-black uppercase tracking-wider text-slate-300">Por 90</p><p className="mt-1 text-[10px] font-black text-slate-600">{p90 === null ? '-' : formatMetricValue(`${metric}/90`, p90, { per90Mode: true })}</p></div>
        <div className={`rounded-xl px-2.5 py-2 ${better === true ? 'bg-emerald-50' : better === false ? 'bg-red-50' : 'bg-slate-50'}`}><p className="text-[7px] font-black uppercase tracking-wider text-slate-300">Comparação</p><p className={`mt-1 text-[10px] font-black ${better === true ? 'text-emerald-700' : better === false ? 'text-red-500' : 'text-slate-600'}`}>{compare === null ? '-' : formatMetricValue(metric, compare, { per90Mode: mode === 'per90' })}</p></div>
      </div>
      {eligibility.reason === 'sample' && <p className="mt-2 text-[7px] font-bold text-amber-600">Ranking suspenso: {formatNumberBR(eligibility.sample, 0)}/{eligibility.rule?.minAttempts} {eligibility.rule?.sampleNoun}.</p>}
    </div>
  )
}

export default function SerieCJogadoresPage() {
  const [round, setRound] = useState(null)
  const [format, setFormat] = useState('total')
  const [minMinutes, setMinMinutes] = useState(450)
  const [team, setTeam] = useState('')
  const [position, setPosition] = useState('')
  const [onlySub23, setOnlySub23] = useState(false)
  const [onlyClub, setOnlyClub] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [compareId, setCompareId] = useState('')
  const [metricView, setMetricView] = useState('Visão geral')
  const [metricSearch, setMetricSearch] = useState('')

  const { data, loading, error, reload } = useSerieCData({ round })
  const allPlayers = data?.players || []
  const sample = allPlayers[0]?.metrics

  const teamsList = useMemo(() => Array.from(new Set(allPlayers.map(player => player.team).filter(Boolean))).sort(), [allPlayers])
  const positions = useMemo(() => Array.from(new Set(allPlayers.map(player => player.position).filter(Boolean))).sort(), [allPlayers])

  const availableMetrics = useMemo(() => numericMetricKeys(allPlayers), [allPlayers])

  const metricCategories = useMemo(() => ['Visão geral', ...PLAYER_CATEGORY_ORDER.filter(group => availableMetrics.some(metric => playerMetricCategory(metric) === group)), 'Todas'], [availableMetrics])

  const players = useMemo(() => allPlayers.filter(player =>
    (!team || player.team === team) &&
    (!position || player.position === position) &&
    (!minMinutes || toNumber(player.minutes) >= minMinutes) &&
    (!onlySub23 || (toNumber(player.age) !== null && toNumber(player.age) <= 23)) &&
    (!onlyClub || player.is_club)
  ), [allPlayers, team, position, minMinutes, onlySub23, onlyClub])

  const playerId = player => `${player.player}__${player.team}`
  const indexCol = findMetricColumn(sample, 'Índice')
  const goalsCol = findMetricColumn(sample, 'Gols')
  const assistsCol = findMetricColumn(sample, 'Assistências')
  const xgCol = findMetricColumn(sample, 'xG (Gols esperados)')

  const selected = players.find(player => playerId(player) === selectedId) || players[0]
  const comparePlayer = players.find(player => playerId(player) === compareId) || players.find(player => selected && playerId(player) !== playerId(selected))

  useEffect(() => {
    if (players.length === 0) {
      setSelectedId('')
      return
    }
    if (!players.some(player => playerId(player) === selectedId)) setSelectedId(playerId(players[0]))
  }, [players, selectedId])

  const selectedMetricNames = useMemo(() => {
    let metrics = metricView === 'Visão geral'
      ? PLAYER_OVERVIEW_METRICS.map(name => findMetricColumn(sample, name)).filter(Boolean)
      : metricView === 'Todas'
        ? availableMetrics
        : availableMetrics.filter(metric => playerMetricCategory(metric) === metricView)
    const query = metricSearch.trim().toLowerCase()
    if (query) metrics = metrics.filter(metric => metric.toLowerCase().includes(query))
    return Array.from(new Set(metrics))
  }, [metricView, metricSearch, sample, availableMetrics])

  const columns = useMemo(() => {
    const cols = [
      { key: 'player', label: 'Jogador', render: row => row.player },
      { key: 'profile', label: 'Perfil', render: row => playerProfile(row), sortValue: row => playerProfile(row) },
      { key: 'team', label: 'Time', render: row => row.team },
      { key: 'position', label: 'Pos', align: 'center', render: row => row.position || '-' },
      { key: 'age', label: 'Idade', align: 'center', render: row => row.age ?? '-' },
      { key: 'minutes', label: 'Min', align: 'right', render: row => row.minutes ?? '-', sortValue: row => toNumber(row.minutes) },
      { key: 'indice', label: 'Índice', align: 'right', render: row => indexCol ? toNumber(row.metrics?.[indexCol]) ?? '-' : '-', sortValue: row => indexCol ? toNumber(row.metrics?.[indexCol]) : null },
    ]
    for (const col of selectedMetricNames) {
      if (col === indexCol) continue
      const volume = isVolumeMetric(col)
      const showTotal = format === 'total' || format === 'both'
      const showPer90 = volume && (format === 'per90' || format === 'both')
      if (showTotal) cols.push({ key: col, label: col, align: 'right', render: row => isNumeric(row.metrics?.[col]) ? toNumber(row.metrics[col]) : '-', sortValue: row => toNumber(row.metrics?.[col]) })
      if (showPer90) cols.push({ key: `${col}__p90`, label: per90Label(col), align: 'right', render: row => per90(row.metrics?.[col], row.minutes), sortValue: row => per90(row.metrics?.[col], row.minutes) })
    }
    return cols
  }, [selectedMetricNames, format, indexCol])

  const leader = useMemo(() => indexCol ? ranking(players, sample, indexCol, { limit: 1 })[0] : null, [players, sample, indexCol])
  const averageAge = useMemo(() => averageOf(players.map(player => ({ value: player.age }))), [players])
  const sub23Count = players.filter(player => toNumber(player.age) !== null && toNumber(player.age) <= 23).length
  const clubCount = players.filter(player => player.is_club).length
  const directInvolvements = useMemo(() => players.reduce((sum, player) => sum + (goalsCol ? toNumber(player.metrics?.[goalsCol], 0) : 0) + (assistsCol ? toNumber(player.metrics?.[assistsCol], 0) : 0), 0), [players, goalsCol, assistsCol])

  const kpis = [
    { label: 'Jogadores elegíveis', value: formatNumberBR(players.length), helper: `${allPlayers.length} na base completa`, icon: Users, tone: 'slate' },
    { label: 'Métricas disponíveis', value: formatNumberBR(availableMetrics.length), helper: 'Cobertura integral da planilha', icon: Layers3, tone: 'blue' },
    { label: 'Idade média', value: averageAge !== null ? `${formatNumberBR(averageAge, 1)}` : '-', helper: 'Recorte filtrado', icon: UserRound },
    { label: 'Atletas Sub-23', value: formatNumberBR(sub23Count), helper: players.length ? `${formatNumberBR(sub23Count / players.length * 100, 0)}% do recorte` : '-', icon: Sparkles, tone: 'amber' },
    { label: 'Atletas do Confiança', value: formatNumberBR(clubCount), helper: 'Identificados na planilha', icon: Activity },
    { label: 'Líder de índice', value: leader ? formatMetricValue(indexCol, leader.value) : '-', helper: leader?.name || 'Sem dado', icon: Target },
    { label: 'Participações diretas', value: formatNumberBR(directInvolvements), helper: 'Gols + assistências', icon: Crosshair },
  ]

  const spotlightMetrics = useMemo(() => {
    if (!selected) return []
    return [
      { label: 'Índice', col: indexCol },
      { label: 'Gols', col: goalsCol },
      { label: 'Assistências', col: assistsCol },
      { label: 'xG', col: xgCol },
    ].filter(item => item.col).map(item => ({
      label: item.label,
      value: formatMetricValue(item.col, selected.metrics?.[item.col]),
      helper: item.col && isVolumeMetric(item.col) ? `${formatMetricValue(`${item.col}/90`, per90(selected.metrics?.[item.col], selected.minutes), { per90Mode: true })}/90` : null,
    }))
  }, [selected, indexCol, goalsCol, assistsCol, xgCol])

  const comparisonPopulation = useMemo(() => {
    if (!selected) return players
    const group = positionGroup(selected.position)
    const peers = players.filter(player => positionGroup(player.position) === group)
    return peers.length >= 5 ? peers : players
  }, [players, selected])

  const radarData = useMemo(() => {
    if (!selected) return []
    return PLAYER_RADAR_METRICS.map(metric => {
      const col = findMetricColumn(sample, metric)
      if (!col) return null
      return {
        area: metric.replace('xG (Gols esperados)', 'xG').replace(', %', '').replace('Recuperações de bola solta', 'Recuperações'),
        value: percentileFor(comparisonPopulation, selected, col),
        compare: comparePlayer ? percentileFor(comparisonPopulation, comparePlayer, col) : null,
      }
    }).filter(item => item?.value !== null)
  }, [sample, selected, comparePlayer, comparisonPopulation])

  const xgScatter = useMemo(() => {
    if (!xgCol || !goalsCol) return []
    return players.map(player => ({
      name: player.player,
      team: player.team,
      isClub: player.is_club,
      xg: toNumber(player.metrics?.[xgCol]),
      goals: toNumber(player.metrics?.[goalsCol]),
    })).filter(item => item.xg !== null && item.goals !== null)
  }, [players, xgCol, goalsCol])

  const positionDistribution = useMemo(() => {
    const counts = {}
    players.forEach(player => { counts[positionGroup(player.position)] = (counts[positionGroup(player.position)] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [players])

  const sub23Shortlist = useMemo(() => ranking(players.filter(player => toNumber(player.age) !== null && toNumber(player.age) <= 23), sample, indexCol || 'Índice', { limit: 8 }), [players, sample, indexCol])
  const creators = useMemo(() => ranking(players, sample, 'Passes-chave', { limit: 8, mode: format === 'per90' ? 'per90' : 'total' }), [players, sample, format])
  const progressors = useMemo(() => ranking(players, sample, 'Passes progressivos', { limit: 8, mode: format === 'per90' ? 'per90' : 'total' }), [players, sample, format])

  const podiums = useMemo(() => ([
    { title: 'Maior índice', description: 'Melhor avaliação geral no recorte.', metric: indexCol || 'Índice', entries: ranking(players, sample, indexCol || 'Índice', { limit: 3 }) },
    { title: 'Participação ofensiva', description: 'Liderança em gols marcados.', metric: goalsCol || 'Gols', entries: ranking(players, sample, goalsCol || 'Gols', { limit: 3 }) },
    { title: 'Criação', description: 'Liderança em passes-chave.', metric: findMetricColumn(sample, 'Passes-chave') || 'Passes-chave', entries: ranking(players, sample, 'Passes-chave', { limit: 3 }) },
  ]), [players, sample, indexCol, goalsCol])

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="space-y-6 p-4 md:p-8">
        <SectionHeader
          eyebrow="Mercado e scouting"
          title="Jogadores da Série C"
          description="Base completa de jogadores de linha, com todas as métricas da planilha, filtros por bloco, totais, taxas por 90, rankings e percentis posicionais."
          right={
            <FilterShell>
              <RoundSelector uploads={data?.uploads} currentRound={data?.upload?.round} onChange={setRound} />
              <select value={team} onChange={event => setTeam(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-bold text-gray-600"><option value="">Todos os times</option>{teamsList.map(value => <option key={value} value={value}>{value}</option>)}</select>
              <select value={position} onChange={event => setPosition(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-bold text-gray-600"><option value="">Todas as posições</option>{positions.map(value => <option key={value} value={value}>{value}</option>)}</select>
              <MinMinutesSelect value={minMinutes} onChange={setMinMinutes} options={[0, 180, 300, 450, 600, 900]} />
              <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500"><input type="checkbox" checked={onlySub23} onChange={event => setOnlySub23(event.target.checked)} /> Sub-23</label>
              <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500"><input type="checkbox" checked={onlyClub} onChange={event => setOnlyClub(event.target.checked)} /> Confiança</label>
              <TableFormatToggle format={format} onChange={setFormat} />
            </FilterShell>
          }
        />

        {loading && <Loading />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && allPlayers.length === 0 && <EmptyState title="Nenhum jogador encontrado" description="Envie a planilha de jogadores de linha na aba Upload Semanal." />}

        {!loading && !error && allPlayers.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">{kpis.map(item => <DashboardKpiCard key={item.label} {...item} />)}</div>

            {players.length === 0 ? <EmptyState title="Nenhum atleta atende aos filtros" description="Reduza a minutagem mínima ou remova algum filtro." /> : (
              <>
                <EntitySpotlight
                  eyebrow="Raio-X individual"
                  title={selected?.player}
                  subtitle={`${selected?.team || '-'} · ${selected?.position || 'Posição não informada'} · ${selected?.age ?? '-'} anos · ${formatNumberBR(selected?.minutes)} min · ${playerProfile(selected)}`}
                  isClub={selected?.is_club}
                  metrics={spotlightMetrics}
                  select={<div className="flex flex-wrap gap-2"><select value={selected ? playerId(selected) : ''} onChange={event => setSelectedId(event.target.value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-black text-white outline-none backdrop-blur-sm">{players.map(player => <option className="text-gray-800" key={playerId(player)} value={playerId(player)}>{player.player} · {player.team}</option>)}</select><select value={comparePlayer ? playerId(comparePlayer) : ''} onChange={event => setCompareId(event.target.value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-black text-white outline-none backdrop-blur-sm"><option className="text-gray-800" value="">Comparar com...</option>{players.filter(player => !selected || playerId(player) !== playerId(selected)).map(player => <option className="text-gray-800" key={playerId(player)} value={playerId(player)}>{player.player} · {player.team}</option>)}</select></div>}
                  footer={`Percentis calculados contra ${comparisonPopulation.length} atletas do grupo ${positionGroup(selected?.position)} ou do filtro geral quando a amostra posicional é pequena.`}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{podiums.map(item => <PodiumCard key={item.title} {...item} />)}</div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><PercentileRadar title={`Perfil comparativo · ${selected?.player}`} description="Leitura multidimensional em percentis do recorte posicional." data={radarData} secondKey="compare" firstLabel={selected?.player || 'Selecionado'} secondLabel={comparePlayer?.player || 'Comparação'} /><QuadrantScatter title="xG x gols" description="Eficiência de finalização e volume de oportunidades no filtro atual." data={xgScatter} xKey="xg" yKey="goals" xMetric="xG (Gols esperados)" yMetric="Gols" /></div>

                <Panel title="Dossiê estatístico completo do atleta" description={`${availableMetrics.length} métricas disponíveis, organizadas por bloco de desempenho com valor, por 90, ranking e percentil.`}>
                  <div className="border-b border-slate-100 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex gap-2 overflow-x-auto pb-1">{metricCategories.map(value => <button key={value} type="button" onClick={() => setMetricView(value)} className={`flex-shrink-0 rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-wider transition ${metricView === value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}>{value}</button>)}</div>
                      <div className="relative w-full xl:max-w-xs"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" /><input value={metricSearch} onChange={event => setMetricSearch(event.target.value)} placeholder="Buscar estatística..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[10px] outline-none focus:border-emerald-200 focus:bg-white" /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{selectedMetricNames.map(metric => <CompleteMetricCard key={metric} metric={metric} player={selected} comparePlayer={comparePlayer} population={comparisonPopulation} format={format} />)}</div>
                  {!selectedMetricNames.length && <p className="p-8 text-center text-[11px] font-semibold text-slate-400">Nenhuma métrica encontrada nesse bloco.</p>}
                </Panel>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><DonutBreakdown title="Composição por função" description="Distribuição dos atletas elegíveis por grupo posicional." data={positionDistribution} centerValue={players.length} centerLabel="atletas" /><Panel title="Shortlist Sub-23" description="Jovens com maior índice no recorte atual."><LeaderRows entries={sub23Shortlist} metric={indexCol || 'Índice'} /></Panel><Panel title="Criadores" description="Líderes em passes-chave no formato selecionado."><LeaderRows entries={creators} metric="Passes-chave" /></Panel></div>

                <Panel title="Progressão e construção" description="Atletas que mais avançam a posse por meio do passe."><LeaderRows entries={progressors} metric="Passes progressivos" limit={10} /></Panel>

                <Panel title="Base completa de jogadores" description={`Tabela pesquisável com ${selectedMetricNames.length} métricas do bloco selecionado. Use “Todas” para exibir integralmente a planilha.`}>
                  <StatsTable columns={columns} rows={players} rowKey={playerId} isClubRow={row => row.is_club} defaultSortKey="indice" searchPlaceholder="Buscar jogador, time ou posição..." embedded exportFilename="jogadores-serie-c-completo.csv" />
                </Panel>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
