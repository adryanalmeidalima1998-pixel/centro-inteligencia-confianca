'use client'
import { useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import SerieCTabs from './_lib/SerieCTabs'
import RoundSelector from './_lib/RoundSelector'
import { useSerieCData } from './_lib/useSerieCData'
import { MetricModeToggle, EmptyState, ErrorState, Loading } from '../components/serie-c/ui'
import {
  SectionHeader, InsightCard, ProfessionalMetricCard, ComparisonBars,
  SimpleLineChart, SimpleBarChart, RadarCard, FilterShell,
} from '../components/serie-c/professional'
import {
  isIdentityColumn, isNumeric, toNumber, rankByMetric, averageOf, diffFromAverage,
  isBetterThanAverage, higherIsBetter, variation, pctDiffFromAverage, findMetricColumn,
  metricGroup, metricDisplayName, formatMetricValue,
} from '../../lib/serieC'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`

const HEADLINE_METRICS = [
  'Índice', 'Gols', 'Chances de gol', 'Chutes', 'Chutes no alvo, %',
  'Posse de bola, %', 'Passes precisos, %', 'Passes progressivos', 'Passes para a área',
  'Entradas no terço final', 'Entradas na área adversária',
  'Recuperações da bola no campo adversário', 'Pressão do time bem-sucedida, %',
  'Duelos ganhos, %', 'Cartões amarelos', 'Cartões vermelhos',
]

const COMPARISON_METRICS = [
  'Gols', 'Chances de gol', 'Chutes', 'Entradas no terço final', 'Passes progressivos',
  'Posse de bola, %', 'Pressão do time bem-sucedida, %', 'Cartões amarelos',
]

const RADAR_GROUPS = [
  { area: 'Ataque', metrics: ['Gols', 'Chances de gol', 'Chutes', 'Chutes no alvo, %'] },
  { area: 'Construção', metrics: ['Posse de bola, %', 'Passes precisos, %', 'Passes progressivos', 'Entradas no terço final'] },
  { area: 'Pressão', metrics: ['Pressão do time bem-sucedida, %', 'Recuperações da bola no campo adversário'] },
  { area: 'Defesa', metrics: ['Duelos ganhos, %', 'Duelos defensivos ganhos, %'] },
  { area: 'Disciplina', metrics: ['Faltas', 'Cartões amarelos', 'Cartões vermelhos'] },
]

function metricRankInfo(teams, clubRow, metricName) {
  const col = findMetricColumn(clubRow?.metrics, metricName)
  if (!col) return null
  const rows = teams
    .filter(t => t.metrics && isNumeric(t.metrics[col]))
    .map(t => ({ id: t.team, team: t.team, value: toNumber(t.metrics[col]) }))
  if (!rows.length) return null
  const higher = higherIsBetter(col)
  const ranked = rankByMetric(rows, higher)
  const me = ranked.find(r => r.team === clubRow.team)
  const avg = averageOf(rows)
  const value = toNumber(clubRow.metrics[col])
  return {
    key: col,
    label: col,
    value,
    avg,
    rank: me?.rank ?? null,
    total: me?.total ?? ranked.length,
    percentile: me?.percentile ?? null,
    avgDiff: diffFromAverage(value, avg),
    pctDiff: pctDiffFromAverage(value, avg),
    positive: isBetterThanAverage(col, value, avg),
  }
}

export default function SerieCClubPage() {
  const [round, setRound] = useState(null)
  const [mode, setMode] = useState('total')
  const { data, loading, error } = useSerieCData({ round })

  const teams = data?.teams || []
  const timeline = data?.timeline || []
  const clubRow = teams.find(t => t.is_club)
  const prevClubRow = (data?.previousTeams || []).find(t => t.is_club)
  const expected = data?.expectedPerformance || null
  const seasonReport = data?.seasonReport?.club || null
  const reportProfile = seasonReport?.profile || null
  const hasReportProfile = Boolean(reportProfile && Object.keys(reportProfile).length)

  const cards = useMemo(() => {
    if (!clubRow) return []
    return HEADLINE_METRICS
      .map(metricName => {
        const info = metricRankInfo(teams, clubRow, metricName)
        if (!info) return null
        const prevCol = findMetricColumn(prevClubRow?.metrics, info.key)
        const prevValue = prevCol ? toNumber(prevClubRow?.metrics?.[prevCol]) : null
        return { ...info, variationValue: variation(info.value, prevValue), group: metricGroup(info.label) }
      })
      .filter(Boolean)
  }, [clubRow, prevClubRow, teams])

  const { forcas, alertas } = useMemo(() => {
    if (!clubRow) return { forcas: [], alertas: [] }
    const all = []
    for (const col of Object.keys(clubRow.metrics || {})) {
      if (isIdentityColumn(col) || !isNumeric(clubRow.metrics[col])) continue
      const info = metricRankInfo(teams, clubRow, col)
      if (!info || info.total < 4) continue
      all.push(info)
    }
    const forcas = all
      .filter(m => m.rank <= 5 && m.positive !== false)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8)
    const alertas = all
      .filter(m => m.positive === false || m.percentile <= 25)
      .sort((a, b) => (a.percentile ?? 100) - (b.percentile ?? 100))
      .slice(0, 8)
    return { forcas, alertas }
  }, [clubRow, teams])

  const comparison = useMemo(() => {
    if (!clubRow) return []
    return COMPARISON_METRICS
      .map(m => metricRankInfo(teams, clubRow, m))
      .filter(Boolean)
      .map(m => ({ label: m.label, diffPct: m.pctDiff ?? 0 }))
  }, [clubRow, teams])

  const radarData = useMemo(() => {
    if (!clubRow) return []
    return RADAR_GROUPS.map(g => {
      const values = g.metrics
        .map(m => metricRankInfo(teams, clubRow, m)?.percentile)
        .filter(v => v !== null && v !== undefined)
      if (!values.length) return null
      return { area: g.area, value: Math.round(values.reduce((a, b) => a + b, 0) / values.length) }
    }).filter(Boolean)
  }, [clubRow, teams])

  const indexTrend = useMemo(() => {
    return timeline
      .map(t => {
        const col = findMetricColumn(t.metrics, 'Índice')
        return { round: `R${t.round}`, value: col ? toNumber(t.metrics[col]) : null }
      })
      .filter(p => p.value !== null)
  }, [timeline])

  const xgTrend = useMemo(() => (expected?.timeline || []).map(item => ({
    round: `R${item.round}`,
    value: item.xgDiff,
  })), [expected])

  const goalsTimingChart = useMemo(() => (seasonReport?.goalsTiming?.periods || []).map(item => ({
    name: item.label,
    value: item.goals,
  })), [seasonReport])

  const concededTimingChart = useMemo(() => (seasonReport?.concededTiming?.periods || []).map(item => ({
    name: item.label,
    value: item.goals,
  })), [seasonReport])

  const goalsOriginChart = useMemo(() => {
    const row = seasonReport?.goalsByType
    if (!row) return []
    return [
      { name: 'Longa distância', value: row.longRange },
      { name: 'Contra-ataque', value: row.counterAttack },
      { name: 'Jogo organizado', value: row.organizedPlay },
      { name: 'Bola parada', value: row.setPieces },
    ].filter(item => item.value !== null && item.value !== undefined)
  }, [seasonReport])

  const concededOriginChart = useMemo(() => {
    const row = seasonReport?.concededByType
    if (!row) return []
    return [
      { name: 'Longa distância', value: row.longRange },
      { name: 'Contra-ataque', value: row.counterAttack },
      { name: 'Jogo organizado', value: row.organizedPlay },
      { name: 'Bola parada', value: row.setPieces },
    ].filter(item => item.value !== null && item.value !== undefined)
  }, [seasonReport])

  const topRankingChart = useMemo(() => cards
    .filter(c => c.rank && c.rank <= 5)
    .slice(0, 8)
    .map(c => ({ name: metricDisplayName(c.label), value: c.rank })), [cards])

  const groupedCards = useMemo(() => {
    const order = ['Ataque', 'Construção', 'Pressão', 'Defesa', 'Disciplina', 'Geral']
    return order.map(group => ({ group, items: cards.filter(c => c.group === group) })).filter(g => g.items.length)
  }, [cards])

  const executiveText = useMemo(() => {
    const top3 = forcas.filter(f => f.rank <= 3).slice(0, 5).map(f => metricDisplayName(f.label).toLowerCase())
    if (!top3.length) return 'Acompanhe o desempenho coletivo do Confiança com rankings, percentis e comparação com a média da Série C.'
    return `Equipe com destaque competitivo em ${top3.join(', ')}.`
  }, [forcas])

  const currentPosition = data?.upload?.club_position
  const currentIndex = metricRankInfo(teams, clubRow, 'Índice')

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="p-4 md:p-8 space-y-6">
        <SectionHeader
          eyebrow="Desempenho coletivo"
          title="Confiança na Série C"
          description="Números da rodada, rankings da competição, percentis, comparação com média e leitura automática para comissão/scouting."
          right={
            <FilterShell>
              <RoundSelector uploads={data?.uploads} currentRound={data?.upload?.round} onChange={setRound} />
              <MetricModeToggle mode={mode} onChange={setMode} />
            </FilterShell>
          }
        />

        {loading && <Loading />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && !clubRow && (
          <EmptyState
            title="Nenhum upload encontrado ainda"
            description="Envie as 3 planilhas semanais na aba Upload Semanal para começar a acompanhar o Confiança na Série C."
          />
        )}

        {!loading && clubRow && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <InsightCard
                title="Momento do Confiança"
                value={currentPosition ? `${currentPosition}º lugar` : `Rodada ${data?.upload?.round || '-'}`}
                description={`Índice atual: ${formatMetricValue('Índice', currentIndex?.value)}. ${currentIndex?.rank ? `${currentIndex.rank}º de ${currentIndex.total} no ranking geral.` : ''}`}
                tone="positive"
              />
              <InsightCard title="Identidade coletiva" description={executiveText} tone="neutral" />
              <InsightCard title="Pontos fortes" tone="positive">
                <div className="mt-2 space-y-1.5">
                  {forcas.slice(0, 4).map(f => (
                    <div key={f.label} className="flex justify-between gap-2 text-[11px] font-bold">
                      <span className="truncate">{metricDisplayName(f.label)}</span><span>{f.rank}º/{f.total}</span>
                    </div>
                  ))}
                </div>
              </InsightCard>
              <InsightCard title="Alertas" tone={alertas.length ? 'danger' : 'neutral'}>
                <div className="mt-2 space-y-1.5">
                  {alertas.length ? alertas.slice(0, 4).map(a => (
                    <div key={a.label} className="flex justify-between gap-2 text-[11px] font-bold">
                      <span className="truncate">{metricDisplayName(a.label)}</span><span>{a.rank}º/{a.total}</span>
                    </div>
                  )) : <p className="text-[11px] font-semibold opacity-80">Nenhum alerta crítico nos filtros atuais.</p>}
                </div>
              </InsightCard>
            </div>

            {expected && (
              <section className="space-y-3">
                <SectionHeader
                  title="Desempenho esperado (xG)"
                  description={expected.source === 'partidas' ? 'Calculado jogo a jogo pela planilha Team Stats. xGA é o xG produzido pelos adversários.' : 'Fallback do PDF Relatório da Época até que a Team Stats seja importada.'}
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <InsightCard title="xG" value={formatMetricValue('xG', expected.xg)} description={`${formatMetricValue('xG', expected.xgPerMatch)} por jogo`} tone="positive" />
                  <InsightCard title="xGA" value={formatMetricValue('xG', expected.xga)} description={`${formatMetricValue('xG', expected.xgaPerMatch)} por jogo`} tone="neutral" />
                  <InsightCard title="Saldo xG" value={`${expected.xgDiff > 0 ? '+' : ''}${formatMetricValue('xG', expected.xgDiff)}`} description="xG produzido - xG cedido" tone={expected.xgDiff >= 0 ? 'positive' : 'danger'} />
                  <InsightCard title="Gols - xG" value={`${expected.goalsMinusXg > 0 ? '+' : ''}${formatMetricValue('xG', expected.goalsMinusXg)}`} description="Conversão acima/abaixo do esperado" tone={expected.goalsMinusXg >= 0 ? 'positive' : 'warning'} />
                  <InsightCard title="GA - xGA" value={`${expected.goalsAgainstMinusXga > 0 ? '+' : ''}${formatMetricValue('xG', expected.goalsAgainstMinusXga)}`} description="Gols sofridos vs esperado" tone={expected.goalsAgainstMinusXga <= 0 ? 'positive' : 'danger'} />
                  <InsightCard title="xPoints" value={expected.xPoints === null || expected.xPoints === undefined ? '-' : formatMetricValue('xG', expected.xPoints)} description={expected.xPoints === null || expected.xPoints === undefined ? 'Disponível após subir o PDF da rodada' : 'Pontos esperados do PDF'} tone="neutral" />
                </div>
                {xgTrend.length > 1 && <SimpleLineChart title="Saldo de xG por rodada" description="Valor positivo indica que o Confiança produziu mais xG do que concedeu na partida." data={xgTrend} metric="xG" />}
              </section>
            )}

            {hasReportProfile && (
              <section className="space-y-3">
                <SectionHeader
                  title="Identidade de jogo · PDF Wyscout"
                  description="Snapshot acumulado da rodada extraído do Relatório da Época. Complementa as planilhas semanais e permanece versionado por rodada."
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <InsightCard title="Formação mais usada" value={reportProfile.formations?.[0]?.formation || '-'} description={reportProfile.formations?.[0]?.share != null ? `${reportProfile.formations[0].share}% do tempo` : 'Sem dado'} tone="neutral" />
                  <InsightCard title="Posse" value={reportProfile.possession?.pct != null ? `${reportProfile.possession.pct}%` : '-'} description={reportProfile.possession?.rank ? `${reportProfile.possession.rank}º da Série C · posse média ${reportProfile.possession.avgDuration ?? '-'}s` : 'Snapshot do PDF'} tone="positive" />
                  <InsightCard title="Passes / 90" value={reportProfile.organization?.passesPer90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 1 }) || '-'} description={reportProfile.organization?.passAccuracy != null ? `${reportProfile.organization.passAccuracy}% precisos · ${reportProfile.organization.rank}º ranking` : 'Organização'} tone="positive" />
                  <InsightCard title="Intensidade de jogo" value={reportProfile.organization?.gameIntensity?.toLocaleString?.('pt-BR', { maximumFractionDigits: 1 }) || '-'} description={reportProfile.organization?.avgPassLength != null ? `Passe médio: ${reportProfile.organization.avgPassLength.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m` : 'Ritmo de circulação'} tone="neutral" />
                  <InsightCard title="PPDA" value={reportProfile.ppda?.value?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.ppda?.rank ? `${reportProfile.ppda.rank}º na intensidade de pressão` : 'Menor tende a indicar pressão mais intensa'} tone="neutral" />
                  <InsightCard title="Toques na área / 90" value={reportProfile.boxTouches?.per90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.boxTouches?.rank ? `${reportProfile.boxTouches.rank}º da competição` : 'Presença no último terço'} tone="positive" />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <SimpleBarChart title="Quando o Confiança marca" description="Gols por faixa de 15 minutos no snapshot da rodada." data={goalsTimingChart} layout="horizontal" height={230} metric="Gols" />
                  <SimpleBarChart title="Quando o Confiança sofre" description="Gols sofridos por faixa de 15 minutos no snapshot da rodada." data={concededTimingChart} layout="horizontal" height={230} metric="Gols sofridos" />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <SimpleBarChart title="Origem dos gols" description="Tipos de gols marcados segundo o Relatório da Época." data={goalsOriginChart} height={220} metric="Gols" />
                  <SimpleBarChart title="Origem dos gols sofridos" description="Tipos de gols concedidos segundo o Relatório da Época." data={concededOriginChart} height={220} metric="Gols sofridos" />
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                  <InsightCard title="Passe terço final / 90" value={reportProfile.finalThirdPasses?.per90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.finalThirdPasses?.rank ? `${reportProfile.finalThirdPasses.rank}º · ${reportProfile.finalThirdPasses.accuracy}% precisão` : ''} tone="positive" />
                  <InsightCard title="Passes progressivos / 90" value={reportProfile.progressivePasses?.per90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.progressivePasses?.rank ? `${reportProfile.progressivePasses.rank}º · ${reportProfile.progressivePasses.accuracy}% precisão` : ''} tone="positive" />
                  <InsightCard title="Passes profundidade / 90" value={reportProfile.deepPasses?.per90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.deepPasses?.rank ? `${reportProfile.deepPasses.rank}º da Série C` : ''} tone="positive" />
                  <InsightCard title="Dribles / 90" value={reportProfile.dribbles?.per90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.dribbles?.rank ? `${reportProfile.dribbles.rank}º · ${reportProfile.dribbles.success}% sucesso` : ''} tone="positive" />
                  <InsightCard title="Recuperações / 90" value={reportProfile.recoveries?.per90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.recoveries?.finalThird != null ? `${reportProfile.recoveries.finalThird.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} no terço final` : ''} tone="neutral" />
                  <InsightCard title="Interceptações / 90" value={reportProfile.interceptions?.per90?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={reportProfile.interceptions?.rank ? `${reportProfile.interceptions.rank}º da competição` : ''} tone={reportProfile.interceptions?.rank >= 16 ? 'warning' : 'neutral'} />
                  <InsightCard title="Duelos ofensivos" value={reportProfile.offensiveDuels?.success != null ? `${reportProfile.offensiveDuels.success}%` : '-'} description={reportProfile.offensiveDuels?.per90 != null ? `${reportProfile.offensiveDuels.per90.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/90` : ''} tone="neutral" />
                  <InsightCard title="Duelos defensivos" value={reportProfile.defensiveDuels?.success != null ? `${reportProfile.defensiveDuels.success}%` : '-'} description={reportProfile.defensiveDuels?.per90 != null ? `${reportProfile.defensiveDuels.per90.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/90` : ''} tone="neutral" />
                </div>

                {reportProfile.corners?.total && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                    <InsightCard title="Escanteios" value={String(reportProfile.corners.total.total ?? '-')} description={`${reportProfile.corners.total.shots ?? '-'} terminaram em finalização`} tone="neutral" />
                    <InsightCard title="xG em escanteios" value={reportProfile.corners.total.xg?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description="Produção total em cantos" tone="positive" />
                    <InsightCard title="1º poste" value={reportProfile.corners.nearPost?.xg?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={`${reportProfile.corners.nearPost?.shots ?? '-'} finalizações`} tone="neutral" />
                    <InsightCard title="2º poste" value={reportProfile.corners.farPost?.xg?.toLocaleString?.('pt-BR', { maximumFractionDigits: 2 }) || '-'} description={`${reportProfile.corners.farPost?.shots ?? '-'} finalizações`} tone="neutral" />
                    <InsightCard title="Pênaltis" value={reportProfile.penalties ? `${reportProfile.penalties.scored ?? 0}/${reportProfile.penalties.attempts ?? 0}` : '-'} description={reportProfile.penalties?.conversion != null ? `${reportProfile.penalties.conversion}% conversão` : ''} tone="neutral" />
                    <InsightCard title="Faltas diretas" value={reportProfile.directFreeKicks?.total != null ? String(reportProfile.directFreeKicks.total) : '-'} description={reportProfile.directFreeKicks?.rank ? `${reportProfile.directFreeKicks.rank}º em volume` : ''} tone="neutral" />
                  </div>
                )}
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ComparisonBars
                title="Confiança x média da Série C"
                description="Diferença percentual do Confiança em relação ao comportamento médio da competição."
                items={comparison}
                metricKey="diffPct"
                footer="Em cartões e perdas, ficar acima da média pode representar alerta."
              />
              <RadarCard
                title="Radar coletivo por macroárea"
                description="Percentil médio do Confiança nas principais famílias de métricas."
                data={radarData}
              />
            </div>

            {indexTrend.length > 1 && (
              <SimpleLineChart
                title="Evolução do índice por rodada"
                description="Tendência do índice do Confiança nos uploads semanais."
                data={indexTrend}
                metric="Índice"
              />
            )}

            {topRankingChart.length > 0 && (
              <SimpleBarChart
                title="Melhores rankings do Confiança"
                description="Métricas em que o Confiança aparece no Top 5 da Série C. Quanto menor a posição, melhor."
                data={topRankingChart}
                dataKey="value"
                metric="Ranking"
                height={240}
              />
            )}

            <div className="space-y-6">
              {groupedCards.map(section => (
                <div key={section.group} className="space-y-3">
                  <SectionHeader title={section.group} description={`Principais métricas de ${section.group.toLowerCase()} com valor, ranking, percentil e comparação com a média.`} />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {section.items.map(c => (
                      <ProfessionalMetricCard
                        key={c.key}
                        metric={c.label}
                        value={c.value}
                        rank={c.rank}
                        total={c.total}
                        percentile={c.percentile}
                        avg={c.avg}
                        avgDiff={c.avgDiff}
                        positive={c.positive}
                        variationValue={c.variationValue}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
