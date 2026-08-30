'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Crosshair, Goal, Hand, Layers3, Search, ShieldCheck } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import RoundSelector from '../_lib/RoundSelector'
import { useSerieCData } from '../_lib/useSerieCData'
import { TableFormatToggle, MinMinutesSelect, EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import StatsTable from '../../components/serie-c/StatsTable'
import { SectionHeader, FilterShell } from '../../components/serie-c/professional'
import { DashboardKpiCard, EntitySpotlight, LeaderRows, Panel, PercentileRadar, PodiumCard, QuadrantScatter } from '../../components/serie-c/competition'
import {
  averageOf, findMetricColumn, formatMetricValue, formatNumberBR, isIdentityColumn,
  isNumeric, isVolumeMetric, per90, per90Label, rankByMetric, toNumber,
} from '../../../lib/serieC'
import {
  GOALKEEPER_CATEGORY_ORDER, GOALKEEPER_OVERVIEW_METRICS, GOALKEEPER_RADAR_METRICS,
  goalkeeperMetricCategory, metricEligibilityForRanking, metricHigherIsBetter, numericMetricKeys,
} from '../../../lib/serieCMetricRegistry'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`

function metricValue(row, col, mode) {
  const raw = toNumber(row?.metrics?.[col])
  if (raw === null) return null
  return mode === 'per90' && isVolumeMetric(col) ? per90(raw, row.minutes) : raw
}

function eligibleRows(rows, metric, minMinutes) {
  return rows.filter(row => metricEligibilityForRanking(row, metric, { entityType:'goalkeeper', minMinutes }).eligible)
}

function ranking(rows, metricName, { limit = 8, mode = 'total', minMinutes = 300 } = {}) {
  const sample = rows[0]?.metrics
  const col = findMetricColumn(sample, metricName) || metricName
  if (!col) return []
  const higher = metricHigherIsBetter(col, 'goalkeeper')
  return eligibleRows(rows, col, minMinutes)
    .map(row => ({
      name:row.player, team:row.team, isGuarani:row.is_guarani, row,
      value:metricValue(row, col, mode), per90Mode:mode === 'per90' && isVolumeMetric(col),
    }))
    .filter(item => item.value !== null)
    .sort((a,b) => higher ? b.value-a.value : a.value-b.value)
    .slice(0, limit)
}

function rankFor(rows, selected, metric, mode, minMinutes) {
  if (!selected || !metric) return null
  const eligible = eligibleRows(rows, metric, minMinutes)
  if (!eligible.some(row => row.player === selected.player && row.team === selected.team)) return null
  const ranked = rankByMetric(
    eligible.map(row => ({ id:`${row.player}__${row.team}`, value:metricValue(row, metric, mode) })),
    metricHigherIsBetter(metric, 'goalkeeper')
  )
  return ranked.find(item => item.id === `${selected.player}__${selected.team}`) || null
}

function CompleteMetricCard({ metric, goalkeeper, compareGoalkeeper, population, format, minMinutes }) {
  const mode = format === 'per90' ? 'per90' : 'total'
  const value = metricValue(goalkeeper, metric, mode)
  const raw = toNumber(goalkeeper?.metrics?.[metric])
  const p90 = isVolumeMetric(metric) ? per90(raw, goalkeeper?.minutes) : null
  const compare = compareGoalkeeper ? metricValue(compareGoalkeeper, metric, mode) : null
  const eligibility = metricEligibilityForRanking(goalkeeper, metric, { entityType:'goalkeeper', minMinutes })
  const rank = eligibility.eligible ? rankFor(population, goalkeeper, metric, mode, minMinutes) : null
  const higher = metricHigherIsBetter(metric, 'goalkeeper')
  const better = compare !== null && value !== null ? (higher ? value >= compare : value <= compare) : null

  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_7px_22px_rgba(15,23,42,0.035)]">
    <div className="flex min-h-8 items-start justify-between gap-3">
      <p className="text-[8px] font-black uppercase leading-relaxed tracking-[0.13em] text-slate-400">{metric}</p>
      {rank?.percentile !== null && rank?.percentile !== undefined
        ? <span className={`rounded-lg px-2 py-1 text-[8px] font-black ${rank.percentile >= 80 ? 'bg-emerald-100 text-emerald-700' : rank.percentile >= 50 ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-500'}`}>P{rank.percentile}</span>
        : !eligibility.eligible && <span className="rounded-lg bg-amber-50 px-2 py-1 text-[7px] font-black uppercase text-amber-600">{eligibility.reason === 'sample' ? 'Amostra baixa' : eligibility.reason === 'minutes' ? 'Poucos min' : 'Contextual'}</span>}
    </div>
    <div className="mt-3 flex items-end justify-between gap-3">
      <div><p className="bc text-3xl font-black leading-none text-slate-900">{formatMetricValue(metric, value, { per90Mode:mode === 'per90' })}</p><p className="mt-1 text-[8px] font-bold text-slate-400">{mode === 'per90' && isVolumeMetric(metric) ? 'por 90 minutos' : 'total / taxa original'}</p></div>
      {rank?.rank && <div className="text-right"><p className="bc text-xl font-black text-emerald-700">{rank.rank}º</p><p className="text-[7px] font-bold text-slate-300">de {rank.total}</p></div>}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
      <div className="rounded-xl bg-slate-50 px-2.5 py-2"><p className="text-[7px] font-black uppercase tracking-wider text-slate-300">Por 90</p><p className="mt-1 text-[10px] font-black text-slate-600">{p90 === null ? '-' : formatMetricValue(`${metric}/90`, p90, { per90Mode:true })}</p></div>
      <div className={`rounded-xl px-2.5 py-2 ${better === true ? 'bg-emerald-50' : better === false ? 'bg-red-50' : 'bg-slate-50'}`}><p className="text-[7px] font-black uppercase tracking-wider text-slate-300">Comparação</p><p className={`mt-1 text-[10px] font-black ${better === true ? 'text-emerald-700' : better === false ? 'text-red-500' : 'text-slate-600'}`}>{compare === null ? '-' : formatMetricValue(metric, compare, { per90Mode:mode === 'per90' })}</p></div>
    </div>
    {eligibility.reason === 'sample' && <p className="mt-2 text-[7px] font-bold text-amber-600">Ranking suspenso: {formatNumberBR(eligibility.sample, 0)}/{eligibility.rule?.minAttempts} {eligibility.rule?.sampleNoun}.</p>}
  </div>
}

export default function SerieCGoleirosPage() {
  const [round, setRound] = useState(null)
  const [format, setFormat] = useState('total')
  const [minMinutes, setMinMinutes] = useState(450)
  const [team, setTeam] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [compareId, setCompareId] = useState('')
  const [metricView, setMetricView] = useState('Visão geral')
  const [metricSearch, setMetricSearch] = useState('')

  const { data, loading, error, reload } = useSerieCData({ round })
  const allGoalkeepers = data?.goalkeepers || []
  const sample = allGoalkeepers[0]?.metrics
  const teamsList = useMemo(() => [...new Set(allGoalkeepers.map(row => row.team).filter(Boolean))].sort(), [allGoalkeepers])
  const goalkeepers = useMemo(() => allGoalkeepers.filter(row => (!team || row.team === team) && (!minMinutes || toNumber(row.minutes) >= minMinutes)), [allGoalkeepers, team, minMinutes])
  const goalkeeperId = row => `${row.player}__${row.team}`

  const availableMetrics = useMemo(() => numericMetricKeys(allGoalkeepers), [allGoalkeepers])
  const metricCategories = useMemo(() => ['Visão geral', ...GOALKEEPER_CATEGORY_ORDER.filter(group => availableMetrics.some(metric => goalkeeperMetricCategory(metric) === group)), 'Todas'], [availableMetrics])
  const selectedMetricNames = useMemo(() => {
    let list = metricView === 'Visão geral'
      ? GOALKEEPER_OVERVIEW_METRICS.map(name => findMetricColumn(sample, name)).filter(Boolean)
      : metricView === 'Todas' ? availableMetrics : availableMetrics.filter(metric => goalkeeperMetricCategory(metric) === metricView)
    const q = metricSearch.toLowerCase().trim()
    if (q) list = list.filter(metric => metric.toLowerCase().includes(q))
    return [...new Set(list)]
  }, [metricView, metricSearch, sample, availableMetrics])

  const selected = goalkeepers.find(row => goalkeeperId(row) === selectedId) || goalkeepers[0]
  const compareGoalkeeper = goalkeepers.find(row => goalkeeperId(row) === compareId) || goalkeepers.find(row => selected && goalkeeperId(row) !== goalkeeperId(selected))
  useEffect(() => {
    if (!goalkeepers.length) return setSelectedId('')
    if (!goalkeepers.some(row => goalkeeperId(row) === selectedId)) setSelectedId(goalkeeperId(goalkeepers[0]))
  }, [goalkeepers, selectedId])

  const indexCol = findMetricColumn(sample, 'Índice')
  const saveCol = findMetricColumn(sample, 'Chutes defendidos, %')
  const concededCol = findMetricColumn(sample, 'Gols sofridos')
  const shotsOnTargetCol = findMetricColumn(sample, 'Chutes no alvo sofridos')
  const xgFacedCol = findMetricColumn(sample, 'xG dos chutes do adversário')
  const bigSavesCol = findMetricColumn(sample, 'Grandes defesas')
  const crossPctCol = findMetricColumn(sample, 'Tentativas de interceptação de cruzamentos e passes bem-sucedidas, %')
  const longPassCol = findMetricColumn(sample, 'Passes longos precisos, %')

  const columns = useMemo(() => {
    const cols = [
      { key:'player', label:'Goleiro', render:row => row.player },
      { key:'team', label:'Time', render:row => row.team },
      { key:'age', label:'Idade', align:'center', render:row => row.age ?? '-' },
      { key:'minutes', label:'Min', align:'right', render:row => row.minutes ?? '-', sortValue:row => toNumber(row.minutes) },
      { key:'indice', label:'Índice', align:'right', render:row => indexCol ? toNumber(row.metrics?.[indexCol]) ?? '-' : '-', sortValue:row => indexCol ? toNumber(row.metrics?.[indexCol]) : null },
    ]
    for (const col of selectedMetricNames) {
      if (col === indexCol) continue
      const volume = isVolumeMetric(col)
      if (format === 'total' || format === 'both') cols.push({ key:col, label:col, align:'right', render:row => formatMetricValue(col, row.metrics?.[col]), sortValue:row => toNumber(row.metrics?.[col]) })
      if (volume && (format === 'per90' || format === 'both')) cols.push({ key:`${col}__p90`, label:per90Label(col), align:'right', render:row => formatMetricValue(`${col}/90`, per90(row.metrics?.[col], row.minutes), { per90Mode:true }), sortValue:row => per90(row.metrics?.[col], row.minutes) })
    }
    return cols
  }, [selectedMetricNames, indexCol, format])

  const saveEligible = saveCol ? eligibleRows(goalkeepers, saveCol, minMinutes) : []
  const saveAverage = saveCol ? averageOf(saveEligible.map(row => ({ value:row.metrics?.[saveCol] }))) : null
  const leaderIndex = indexCol ? ranking(goalkeepers, indexCol, { limit:1, minMinutes })[0] : null
  const leaderSave = saveCol ? ranking(goalkeepers, saveCol, { limit:1, minMinutes })[0] : null
  const leaderCross = crossPctCol ? ranking(goalkeepers, crossPctCol, { limit:1, minMinutes })[0] : null

  const kpis = [
    { label:'Goleiros elegíveis', value:formatNumberBR(goalkeepers.length), helper:`${allGoalkeepers.length} na base completa`, icon:Hand, tone:'slate' },
    { label:'Métricas disponíveis', value:formatNumberBR(availableMetrics.length), helper:'Cobertura integral da nova planilha', icon:Layers3, tone:'blue' },
    { label:'% defesas média', value:saveAverage !== null ? formatMetricValue(saveCol, saveAverage) : '-', helper:'Apenas amostras elegíveis', icon:ShieldCheck },
    { label:'Líder de índice', value:leaderIndex ? formatMetricValue(indexCol, leaderIndex.value) : '-', helper:leaderIndex?.name || 'Sem dado', icon:Activity },
    { label:'Maior % defesas', value:leaderSave ? formatMetricValue(saveCol, leaderSave.value) : '-', helper:leaderSave?.name || 'Sem amostra', icon:Goal },
    { label:'Cobertura aérea', value:leaderCross ? formatMetricValue(crossPctCol, leaderCross.value) : '-', helper:leaderCross?.name || 'Sem amostra', icon:Crosshair, tone:'amber' },
  ]

  const spotlightMetrics = useMemo(() => !selected ? [] : [
    ['Índice', indexCol], ['% defesas', saveCol], ['xG sofrido', xgFacedCol], ['Grandes defesas', bigSavesCol], ['Interceptação cruzamentos', crossPctCol], ['Passe longo', longPassCol],
  ].filter(([,col]) => col).map(([label,col]) => ({ label, value:formatMetricValue(col, selected.metrics?.[col]), helper:isVolumeMetric(col) ? `${formatMetricValue(`${col}/90`, per90(selected.metrics?.[col], selected.minutes), {per90Mode:true})}/90` : null })), [selected,indexCol,saveCol,xgFacedCol,bigSavesCol,crossPctCol,longPassCol])

  const radarData = useMemo(() => !selected ? [] : GOALKEEPER_RADAR_METRICS.map(name => {
    const col=findMetricColumn(sample,name); if(!col) return null
    const r1=rankFor(goalkeepers,selected,col,'total',minMinutes)
    const r2=compareGoalkeeper ? rankFor(goalkeepers,compareGoalkeeper,col,'total',minMinutes) : null
    return { area:name.replace(', %','').slice(0,24), value:r1?.percentile ?? null, compare:r2?.percentile ?? null }
  }).filter(item => item?.value !== null), [selected,compareGoalkeeper,goalkeepers,sample,minMinutes])

  const volumeEfficiency = useMemo(() => {
    if (!shotsOnTargetCol || !saveCol) return []
    return goalkeepers.map(row => ({ name:row.player, team:row.team, isGuarani:row.is_guarani, shots:toNumber(row.metrics?.[shotsOnTargetCol]), savePct:toNumber(row.metrics?.[saveCol]) })).filter(item => item.shots !== null && item.savePct !== null)
  }, [goalkeepers,shotsOnTargetCol,saveCol])

  const podiums = useMemo(() => [
    { title:'Índice geral', description:'Melhor avaliação no recorte.', metric:indexCol || 'Índice', entries:ranking(goalkeepers,indexCol || 'Índice',{limit:3,minMinutes}) },
    { title:'Defesa de meta', description:'% de defesas com amostra mínima.', metric:saveCol || 'Chutes defendidos, %', entries:ranking(goalkeepers,saveCol || 'Chutes defendidos, %',{limit:3,minMinutes}) },
    { title:'Área e cruzamentos', description:'Interceptação de cruzamentos com amostra mínima.', metric:crossPctCol || 'Tentativas de interceptação de cruzamentos e passes bem-sucedidas, %', entries:ranking(goalkeepers,crossPctCol || '',{limit:3,minMinutes}) },
  ], [goalkeepers,indexCol,saveCol,crossPctCol,minMinutes])

  return <AppShell>
    <style>{STYLE}</style><SerieCTabs />
    <div className="space-y-6 p-4 md:p-8">
      <SectionHeader eyebrow="Análise específica" title="Goleiros Série C" description="Nova planilha integral: defesa de meta, xG sofrido, distância dos chutes, área/cruzamentos, distribuição, tiros de meta, bolas paradas, pênaltis e erros." right={<FilterShell><RoundSelector uploads={data?.uploads} currentRound={data?.upload?.round} onChange={setRound}/><select value={team} onChange={e=>setTeam(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-bold text-gray-600"><option value="">Todos os times</option>{teamsList.map(v=><option key={v}>{v}</option>)}</select><MinMinutesSelect value={minMinutes} onChange={setMinMinutes} options={[0,180,300,450,600,900]}/><TableFormatToggle format={format} onChange={setFormat}/></FilterShell>}/>
      {loading && <Loading/>}{!loading && error && <ErrorState message={error} onRetry={reload}/>} {!loading&&!error&&!allGoalkeepers.length&&<EmptyState title="Nenhum goleiro encontrado" description="Envie a nova planilha de goleiros na aba Upload Semanal."/>}
      {!loading&&!error&&allGoalkeepers.length>0&&<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(item=><DashboardKpiCard key={item.label}{...item}/>)}</div>
        {goalkeepers.length ? <>
          <EntitySpotlight eyebrow="Raio-X do goleiro" title={selected?.player} subtitle={`${selected?.team||'-'} · ${selected?.age??'-'} anos · ${formatNumberBR(selected?.minutes)} min`} isGuarani={selected?.is_guarani} metrics={spotlightMetrics} select={<div className="flex flex-wrap gap-2"><select value={selected?goalkeeperId(selected):''} onChange={e=>setSelectedId(e.target.value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-black text-white"><option className="text-gray-800" value="">Selecionar</option>{goalkeepers.map(row=><option className="text-gray-800" key={goalkeeperId(row)} value={goalkeeperId(row)}>{row.player} · {row.team}</option>)}</select><select value={compareGoalkeeper?goalkeeperId(compareGoalkeeper):''} onChange={e=>setCompareId(e.target.value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-black text-white"><option className="text-gray-800" value="">Comparar com...</option>{goalkeepers.filter(row=>!selected||goalkeeperId(row)!==goalkeeperId(selected)).map(row=><option className="text-gray-800" key={goalkeeperId(row)} value={goalkeeperId(row)}>{row.player} · {row.team}</option>)}</select></div>} footer="Percentis e rankings de eficiência só são exibidos quando a amostra mínima da própria métrica é atingida."/>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{podiums.map(item=><PodiumCard key={item.title}{...item}/>)}</div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><PercentileRadar title={`Perfil do goleiro · ${selected?.player}`} description="Percentis com controle de amostra." data={radarData} secondKey="compare" firstLabel={selected?.player||'Selecionado'} secondLabel={compareGoalkeeper?.player||'Comparação'}/><QuadrantScatter title="Volume sofrido × eficiência" description="Chutes no alvo sofridos contra percentual de defesas." data={volumeEfficiency} xKey="shots" yKey="savePct" xMetric="Chutes no alvo sofridos" yMetric="Chutes defendidos, %"/></div>
          <Panel title="Dossiê estatístico completo do goleiro" description={`${availableMetrics.length} métricas numéricas reconhecidas na planilha e disponíveis para análise.`}>
            <div className="border-b border-slate-100 p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex gap-2 overflow-x-auto pb-1">{metricCategories.map(v=><button key={v} onClick={()=>setMetricView(v)} className={`flex-shrink-0 rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-wider ${metricView===v?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-400'}`}>{v}</button>)}</div><div className="relative w-full xl:max-w-xs"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300"/><input value={metricSearch} onChange={e=>setMetricSearch(e.target.value)} placeholder="Buscar métrica..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[10px]"/></div></div></div>
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{selectedMetricNames.map(metric=><CompleteMetricCard key={metric} metric={metric} goalkeeper={selected} compareGoalkeeper={compareGoalkeeper} population={goalkeepers} format={format} minMinutes={minMinutes}/>)}</div>
          </Panel>
          <Panel title="Base completa de goleiros" description={`Tabela dinâmica com ${selectedMetricNames.length} métricas do bloco escolhido. Use “Todas” para acessar integralmente o novo modelo.`}><StatsTable columns={columns} rows={goalkeepers} rowKey={goalkeeperId} isGuaraniRow={row=>row.is_guarani} defaultSortKey="indice" searchPlaceholder="Buscar goleiro ou time..." embedded exportFilename="goleiros-serie-c-completo.csv"/></Panel>
        </>:<EmptyState title="Nenhum goleiro atende aos filtros" description="Reduza a minutagem mínima ou remova o filtro de time."/>}
      </>}
    </div>
  </AppShell>
}
