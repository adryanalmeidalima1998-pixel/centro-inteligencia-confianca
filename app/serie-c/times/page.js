'use client'

import { useMemo, useState } from 'react'
import { Activity, BarChart3, Crosshair, Gauge, Shield, Users } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import RoundSelector from '../_lib/RoundSelector'
import { useSerieCData } from '../_lib/useSerieCData'
import { EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import StatsTable from '../../components/serie-c/StatsTable'
import { SectionHeader, FilterShell } from '../../components/serie-c/professional'
import {
  DashboardKpiCard,
  DonutBreakdown,
  DualBarComparison,
  EntitySpotlight,
  ExecutiveInsight,
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
  higherIsBetter,
  isNumeric,
  pctDiffFromAverage,
  rankByMetric,
  toNumber,
} from '../../../lib/serieC'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`

const TABLE_METRICS = [
  'Índice', 'Gols', 'Gols sofridos', 'Chances de gol', 'Chutes', 'Chutes no alvo, %',
  'Posse de bola, %', 'Passes precisos, %', 'Passes progressivos',
  'Entradas no terço final', 'Entradas na área adversária',
  'Cruzamentos precisos, %', 'Duelos ganhos, %', 'Duelos defensivos ganhos, %',
  'Recuperações da bola no campo adversário', 'Pressão do time bem-sucedida, %',
  'Faltas', 'Cartões amarelos', 'Cartões vermelhos',
]

const RADAR_METRICS = [
  'Índice', 'Gols', 'Chances de gol', 'Chutes no alvo, %',
  'Posse de bola, %', 'Passes progressivos', 'Entradas na área adversária',
  'Pressão do time bem-sucedida, %', 'Duelos ganhos, %',
]

function metricColumn(sample, candidates) {
  for (const candidate of candidates) {
    const col = findMetricColumn(sample, candidate)
    if (col) return col
  }
  return null
}

function ranking(teams, sample, metricName, limit = 5) {
  const col = findMetricColumn(sample, metricName)
  if (!col) return []
  const higher = higherIsBetter(col)
  return teams
    .map(team => ({ name: team.team, value: toNumber(team.metrics?.[col]), isGuarani: team.is_guarani }))
    .filter(item => item.value !== null)
    .sort((a, b) => higher ? b.value - a.value : a.value - b.value)
    .slice(0, limit)
}

function percentileFor(rows, row, col) {
  if (!row || !col) return null
  const ranked = rankByMetric(rows.map(item => ({ id: item.team, value: item.metrics?.[col] })), higherIsBetter(col))
  return ranked.find(item => item.id === row.team)?.percentile ?? null
}

export default function SerieCTimesPage() {
  const [round, setRound] = useState(null)
  const [compareTeam, setCompareTeam] = useState('')
  const { data, loading, error, reload } = useSerieCData({ round })
  const teams = data?.teams || []
  const sample = teams[0]?.metrics
  const guarani = teams.find(team => team.is_guarani)
  const selectedTeam = teams.find(team => team.team === compareTeam) || teams.find(team => !team.is_guarani)

  const columns = useMemo(() => {
    const cols = [{ key: 'team', label: 'Time', render: row => row.team }]
    for (const metricName of TABLE_METRICS) {
      const col = findMetricColumn(sample, metricName)
      if (!col) continue
      cols.push({
        key: col,
        label: metricName,
        align: 'right',
        render: row => isNumeric(row.metrics?.[col]) ? toNumber(row.metrics[col]) : '-',
        sortValue: row => toNumber(row.metrics?.[col]),
      })
    }
    return cols
  }, [sample])

  const indexCol = metricColumn(sample, ['Índice'])
  const goalsCol = metricColumn(sample, ['Gols'])
  const concededCol = metricColumn(sample, ['Gols sofridos', 'Chutes sofridos'])
  const possessionCol = metricColumn(sample, ['Posse de bola, %'])
  const progressiveCol = metricColumn(sample, ['Passes progressivos'])
  const pressureCol = metricColumn(sample, ['Pressão do time bem-sucedida, %'])

  const guaraniIndexRank = useMemo(() => {
    if (!guarani || !indexCol) return null
    return rankByMetric(teams.map(team => ({ id: team.team, value: team.metrics?.[indexCol] })), true)
      .find(item => item.id === guarani.team)?.rank ?? null
  }, [teams, guarani, indexCol])

  const topAttack = useMemo(() => goalsCol ? ranking(teams, sample, goalsCol, 1)[0] : null, [teams, sample, goalsCol])
  const bestDefense = useMemo(() => {
    if (!concededCol) return null
    return teams
      .map(team => ({ name: team.team, value: toNumber(team.metrics?.[concededCol]), isGuarani: team.is_guarani }))
      .filter(item => item.value !== null)
      .sort((a, b) => a.value - b.value)[0] || null
  }, [teams, concededCol])

  const kpis = useMemo(() => {
    const possessionAvg = possessionCol ? averageOf(teams.map(team => ({ value: team.metrics?.[possessionCol] }))) : null
    const progressiveAvg = progressiveCol ? averageOf(teams.map(team => ({ value: team.metrics?.[progressiveCol] }))) : null
    return [
      { label: 'Clubes analisados', value: formatNumberBR(teams.length), helper: `Rodada ${data?.upload?.round ?? '-'}`, icon: Users, tone: 'slate' },
      { label: 'Posição do Confiança', value: guaraniIndexRank ? `${guaraniIndexRank}º` : '-', helper: indexCol ? 'Ranking pelo índice coletivo' : 'Índice indisponível', icon: BarChart3 },
      { label: 'Melhor ataque', value: topAttack ? formatMetricValue(goalsCol, topAttack.value) : '-', helper: topAttack?.name || 'Sem dado', icon: Crosshair },
      { label: 'Melhor defesa', value: bestDefense ? formatMetricValue(concededCol, bestDefense.value) : '-', helper: bestDefense?.name || 'Sem dado', icon: Shield, tone: 'blue' },
      { label: 'Posse média da liga', value: possessionAvg !== null ? formatMetricValue(possessionCol, possessionAvg) : '-', helper: 'Referência coletiva da competição', icon: Gauge, tone: 'amber' },
      { label: 'Progressão média', value: progressiveAvg !== null ? formatMetricValue(progressiveCol, progressiveAvg) : '-', helper: 'Passes progressivos por equipe', icon: Activity },
    ]
  }, [teams, data, guaraniIndexRank, indexCol, topAttack, bestDefense, goalsCol, concededCol, possessionCol, progressiveCol])

  const spotlightMetrics = useMemo(() => {
    if (!guarani) return []
    return ['Índice', 'Gols', 'Posse de bola, %', 'Passes progressivos']
      .map(metric => {
        const col = findMetricColumn(guarani.metrics, metric)
        if (!col) return null
        const avg = averageOf(teams.map(team => ({ value: team.metrics?.[col] })))
        const diff = pctDiffFromAverage(guarani.metrics?.[col], avg)
        return {
          label: metric,
          value: formatMetricValue(col, guarani.metrics?.[col]),
          helper: diff === null ? null : `${diff >= 0 ? '+' : ''}${formatNumberBR(diff, 1)}% vs média`,
        }
      })
      .filter(Boolean)
  }, [guarani, teams])

  const radarData = useMemo(() => {
    if (!guarani) return []
    return RADAR_METRICS.map(metric => {
      const col = findMetricColumn(sample, metric)
      if (!col) return null
      return {
        area: metric.replace(', %', '').replace('Pressão do time bem-sucedida', 'Pressão'),
        value: percentileFor(teams, guarani, col),
        rival: selectedTeam ? percentileFor(teams, selectedTeam, col) : null,
      }
    }).filter(item => item?.value !== null)
  }, [teams, guarani, selectedTeam, sample])

  const directComparison = useMemo(() => {
    if (!guarani || !selectedTeam) return []
    return ['Índice', 'Gols', 'Chutes', 'Posse de bola, %', 'Passes progressivos', 'Entradas na área adversária']
      .map(metric => {
        const col = findMetricColumn(sample, metric)
        if (!col) return null
        return {
          name: metric.replace(', %', ''),
          first: toNumber(guarani.metrics?.[col]) || 0,
          second: toNumber(selectedTeam.metrics?.[col]) || 0,
        }
      })
      .filter(Boolean)
  }, [guarani, selectedTeam, sample])

  const quadrantData = useMemo(() => {
    if (!goalsCol || !progressiveCol) return []
    return teams.map(team => ({
      name: team.team,
      isGuarani: team.is_guarani,
      goals: toNumber(team.metrics?.[goalsCol]),
      progressive: toNumber(team.metrics?.[progressiveCol]),
    })).filter(item => item.goals !== null && item.progressive !== null)
  }, [teams, goalsCol, progressiveCol])

  const styleBreakdown = useMemo(() => {
    if (!teams.length) return []
    const avgPossession = possessionCol ? averageOf(teams.map(team => ({ value: team.metrics?.[possessionCol] }))) : null
    const avgProgression = progressiveCol ? averageOf(teams.map(team => ({ value: team.metrics?.[progressiveCol] }))) : null
    const avgPressure = pressureCol ? averageOf(teams.map(team => ({ value: team.metrics?.[pressureCol] }))) : null
    const counts = { Propositivo: 0, Vertical: 0, Pressionante: 0, Equilibrado: 0 }
    teams.forEach(team => {
      const possession = possessionCol ? toNumber(team.metrics?.[possessionCol]) : null
      const progression = progressiveCol ? toNumber(team.metrics?.[progressiveCol]) : null
      const pressure = pressureCol ? toNumber(team.metrics?.[pressureCol]) : null
      if (possession !== null && avgPossession !== null && possession >= avgPossession * 1.05) counts.Propositivo += 1
      else if (progression !== null && avgProgression !== null && progression >= avgProgression * 1.08) counts.Vertical += 1
      else if (pressure !== null && avgPressure !== null && pressure >= avgPressure * 1.05) counts.Pressionante += 1
      else counts.Equilibrado += 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [teams, possessionCol, progressiveCol, pressureCol])

  const insights = useMemo(() => {
    if (!guarani) return []
    const items = []
    for (const metric of ['Gols', 'Passes progressivos', 'Pressão do time bem-sucedida, %']) {
      const col = findMetricColumn(sample, metric)
      if (!col) continue
      const avg = averageOf(teams.map(team => ({ value: team.metrics?.[col] })))
      const diff = pctDiffFromAverage(guarani.metrics?.[col], avg)
      if (diff === null) continue
      items.push({
        title: metric,
        text: `O Confiança está ${Math.abs(diff).toFixed(1).replace('.', ',')}% ${diff >= 0 ? 'acima' : 'abaixo'} da média da Série C neste indicador.`,
        tone: diff >= 0 ? 'positive' : 'warning',
      })
    }
    return items
  }, [guarani, teams, sample])

  const leaderSets = useMemo(() => ([
    { title: 'Produção ofensiva', description: 'Clubes com mais gols.', metric: goalsCol, entries: goalsCol ? ranking(teams, sample, goalsCol, 3) : [] },
    { title: 'Construção', description: 'Líderes em passes progressivos.', metric: progressiveCol, entries: progressiveCol ? ranking(teams, sample, progressiveCol, 3) : [] },
    { title: 'Pressão alta', description: 'Maior eficiência de pressão.', metric: pressureCol, entries: pressureCol ? ranking(teams, sample, pressureCol, 3) : [] },
  ]), [teams, sample, goalsCol, progressiveCol, pressureCol])

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="space-y-6 p-4 md:p-8">
        <SectionHeader
          eyebrow="Benchmark coletivo"
          title="Times da Série C"
          description="Leitura executiva da competição, identidade coletiva dos clubes e comparação do Confiança com os principais benchmarks."
          right={
            <FilterShell>
              <RoundSelector uploads={data?.uploads} currentRound={data?.upload?.round} onChange={setRound} />
              <select value={compareTeam} onChange={event => setCompareTeam(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-bold text-gray-600">
                <option value="">Comparar com...</option>
                {teams.filter(team => !team.is_guarani).map(team => <option key={team.team} value={team.team}>{team.team}</option>)}
              </select>
            </FilterShell>
          }
        />

        {loading && <Loading />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && teams.length === 0 && <EmptyState title="Nenhum dado de times ainda" description="Envie a planilha de times na aba Upload Semanal." />}

        {!loading && !error && teams.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {kpis.map(item => <DashboardKpiCard key={item.label} {...item} />)}
            </div>

            {guarani && (
              <EntitySpotlight
                eyebrow="Raio-X coletivo"
                title={guarani.team}
                subtitle={`Rodada ${data?.upload?.round ?? '-'} · ${data?.upload?.season ?? ''} · ${guaraniIndexRank ? `${guaraniIndexRank}º no índice coletivo` : 'benchmark da competição'}`}
                isGuarani
                metrics={spotlightMetrics}
                select={
                  <select value={compareTeam} onChange={event => setCompareTeam(event.target.value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-black text-white outline-none backdrop-blur-sm">
                    <option value="" className="text-gray-800">Selecionar rival</option>
                    {teams.filter(team => !team.is_guarani).map(team => <option className="text-gray-800" key={team.team} value={team.team}>{team.team}</option>)}
                  </select>
                }
                footer="Os percentuais e rankings são calculados dentro do recorte selecionado, sem criação de métricas externas."
              />
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {leaderSets.map(item => <PodiumCard key={item.title} {...item} />)}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PercentileRadar title={`Perfil competitivo · Confiança x ${selectedTeam?.team || 'rival'}`} description="Percentis internos da Série C para evitar distorção entre métricas de escalas diferentes." data={radarData} secondKey="rival" firstLabel="Confiança" secondLabel={selectedTeam?.team || 'Rival'} />
              <DualBarComparison title="Comparação em valores absolutos" description="Leitura direta entre Confiança e o clube selecionado." data={directComparison} firstLabel="Confiança" secondLabel={selectedTeam?.team || 'Rival'} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <QuadrantScatter title="Produção ofensiva x construção" description="Distribuição dos clubes pela relação entre gols e passes progressivos; linhas pontilhadas representam a média da liga." data={quadrantData} xKey="progressive" yKey="goals" xMetric="Passes progressivos" yMetric="Gols" />
              </div>
              <DonutBreakdown title="Perfis coletivos da liga" description="Classificação relativa com base em posse, progressão e pressão." data={styleBreakdown} centerValue={teams.length} centerLabel="clubes" />
            </div>

            <Panel title="Leitura executiva do Confiança" description="Sinais rápidos gerados a partir do comparativo com a média da competição.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {insights.map(item => <ExecutiveInsight key={item.title} {...item} />)}
              </div>
            </Panel>

            <Panel title="Tabela completa dos clubes" description="Ordene qualquer coluna para aprofundar o benchmark coletivo.">
              <StatsTable columns={columns} rows={teams} rowKey={row => row.team} isGuaraniRow={row => row.is_guarani} defaultSortKey={indexCol || columns[1]?.key} searchPlaceholder="Buscar time..." embedded exportFilename="times-serie-c.csv" />
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  )
}
