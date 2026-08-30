'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Minus,
  Printer, Save, Search, TrendingDown, TrendingUp, Users,
} from 'lucide-react'
import {
  findMetricColumn, formatMetricValue, formatNumberBR, isIdentityColumn,
  isPercentageMetric, isVolumeMetric, metricDisplayName, per90, toNumber,
} from '../../../lib/serieC'
import {
  GOALKEEPER_CATEGORY_ORDER, GOALKEEPER_OVERVIEW_METRICS,
  PLAYER_CATEGORY_ORDER, PLAYER_OVERVIEW_METRICS,
  isContextMetric, metricCategory, metricHigherIsBetter, metricSampleRule,
} from '../../../lib/serieCMetricRegistry'

function norm(value = '') {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim()
}

function pctScale(value) {
  const n = toNumber(value)
  if (n === null) return null
  return Math.abs(n) <= 1.5 ? n * 100 : n
}
function rateScale(value) {
  const n = toNumber(value)
  if (n === null) return null
  return Math.abs(n) > 1.5 ? n / 100 : n
}
function signed(value, suffix = '') {
  const n = toNumber(value)
  if (n === null) return '—'
  return `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { maximumFractionDigits:2 })}${suffix}`
}
function nextDay(ymd) {
  if (!ymd) return null
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
function groupPos(pos) {
  const p = String(pos || '').toUpperCase()
  if (p.includes('GK')) return 'GK'
  if (/CB|LB|RB|WB/.test(p)) return 'DEF'
  if (/DM|CM|AM|MF|LM|RM/.test(p)) return 'MEI'
  if (/LW|RW|CF|ST|SS|FW/.test(p)) return 'ATA'
  return 'OUT'
}
function metricValue(metrics, metric) {
  if (!metrics) return null
  const key = Object.prototype.hasOwnProperty.call(metrics, metric) ? metric : findMetricColumn(metrics, metric)
  return key ? toNumber(metrics?.[key]) : null
}
function denominatorValue(metrics, aliases = []) {
  for (const alias of aliases || []) {
    const key = findMetricColumn(metrics, alias)
    const value = key ? toNumber(metrics?.[key]) : null
    if (value !== null) return { key, value }
  }
  return { key:null, value:null }
}
function isTotalPeriodMetric(metric) {
  const k = norm(metric)
  return k === 'gols' || k.startsWith('assistencias') || k === 'assistencia'
}

// Reconstrói o que aconteceu DEPOIS da rodada-base a partir dos snapshots acumulados.
// Para percentuais com denominador conhecido, calcula os acertos/tentativas do intervalo.
// Quando a planilha traz apenas uma média/taxa sem numerador e denominador, mostra a
// tendência acumulada e sinaliza que não é uma taxa isolada do período.
function periodMetric(metric, base, curr, entityType = 'player') {
  if (!curr) return null
  const c = metricValue(curr.metrics, metric)
  if (c === null) return null
  const b = base ? metricValue(base.metrics, metric) : null
  const cMin = toNumber(curr.minutes) || 0
  const bMin = base ? (toNumber(base.minutes) || 0) : 0
  const postMinutes = Math.max(0, cMin - bMin)
  const contextOnly = isContextMetric(metric, entityType)
  const sampleRule = metricSampleRule(metric, entityType)

  if (isPercentageMetric(metric)) {
    const cPct = pctScale(c)
    const bPct = pctScale(b)
    if (sampleRule) {
      const cDenInfo = denominatorValue(curr.metrics, sampleRule.sampleAliases)
      const bDenInfo = base ? denominatorValue(base.metrics, sampleRule.sampleAliases) : { value:0 }
      const cDen = cDenInfo.value
      const bDen = bDenInfo.value ?? 0
      if (cDen !== null && cDen >= bDen) {
        const postAttempts = Math.max(0, cDen - bDen)
        let postPct = cPct
        let exactPeriod = !base
        if (base && b !== null && postAttempts > 0) {
          const succC = cDen * rateScale(c)
          const succB = bDen * rateScale(b)
          postPct = ((succC - succB) / postAttempts) * 100
          exactPeriod = Number.isFinite(postPct)
        }
        const eligibleAttempts = postAttempts >= sampleRule.minAttempts
        return {
          metric, entityType, kind:'pct', post:postPct, base:bPct, current:cPct,
          delta:bPct === null ? null : postPct - bPct,
          postMinutes, attempts:postAttempts, sampleRule, exactPeriod,
          rankable:postMinutes >= 90 && eligibleAttempts && !contextOnly,
          contextOnly,
          sampleReason:postMinutes < 90 ? 'minutes' : (!eligibleAttempts ? 'attempts' : null),
        }
      }
    }
    return {
      metric, entityType, kind:'pct', post:cPct, base:bPct, current:cPct,
      delta:bPct === null ? null : cPct - bPct,
      postMinutes, attempts:null, sampleRule, exactPeriod:false, trendOnly:true,
      rankable:postMinutes >= 90 && !sampleRule && !contextOnly,
      contextOnly,
      sampleReason:postMinutes < 90 ? 'minutes' : (sampleRule ? 'attempts_unknown' : null),
    }
  }

  if (isVolumeMetric(metric)) {
    const totalMetric = isTotalPeriodMetric(metric)
    const hasValidBase = b !== null && c >= b
    const postTotal = hasValidBase ? c - b : c
    const minutesForRate = postMinutes > 0 ? postMinutes : cMin
    const post = totalMetric ? postTotal : per90(postTotal, minutesForRate)
    const baseValue = totalMetric ? b : per90(b, bMin)
    return {
      metric, entityType, kind:totalMetric ? 'total' : 'rate', post,
      base:baseValue, current:totalMetric ? c : per90(c, cMin),
      delta:baseValue === null || post === null ? null : post - baseValue,
      postMinutes, total:postTotal, exactPeriod:hasValidBase || !base,
      rankable:postMinutes >= 90 && !contextOnly,
      contextOnly,
      sampleReason:postMinutes < 90 ? 'minutes' : null,
    }
  }

  // Índices, médias, conversões, xG/chute etc. não podem ser subtraídos como volume.
  // Aqui a comparação é entre o valor acumulado atual e a fotografia da rodada-base.
  return {
    metric, entityType, kind:'raw', post:c, base:b, current:c,
    delta:b === null ? null : c - b,
    postMinutes, exactPeriod:false, trendOnly:true,
    rankable:postMinutes >= 90 && !contextOnly,
    contextOnly,
    sampleReason:postMinutes < 90 ? 'minutes' : null,
  }
}

function formatPeriod(row) {
  if (!row || row.post === null || row.post === undefined) return '—'
  if (row.kind === 'pct') return `${Number(row.post).toLocaleString('pt-BR', { maximumFractionDigits:1 })}%`
  if (row.kind === 'rate') return `${Number(row.post).toLocaleString('pt-BR', { maximumFractionDigits:2 })}/90`
  if (row.kind === 'total') return Number(row.post).toLocaleString('pt-BR', { maximumFractionDigits:0 })
  return formatMetricValue(row.metric, row.post)
}
function deltaGood(metric, delta, entityType = 'player') {
  const n = toNumber(delta)
  if (n === null || Math.abs(n) < 1e-9) return null
  return metricHigherIsBetter(metric, entityType) ? n > 0 : n < 0
}
function Delta({ metric, entityType='player', value, suffix='' }) {
  const n = toNumber(value)
  if (n === null || Math.abs(n) < 0.005) {
    return <span className="inline-flex items-center gap-1 text-gray-400"><Minus className="h-3 w-3"/> estável</span>
  }
  const good = deltaGood(metric, n, entityType)
  return <span className={`inline-flex items-center gap-1 font-black ${good ? 'text-emerald-600' : 'text-rose-500'}`}>
    {n > 0 ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
    {signed(n, suffix)}
  </span>
}
function SampleBadge({ minutes, row }) {
  if (row?.sampleReason === 'attempts') {
    const rule = row?.sampleRule
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700" title={`${row.attempts || 0}/${rule?.minAttempts || 0} ${rule?.sampleNoun || 'tentativas'}`}>volume insuficiente</span>
  }
  if (row?.sampleReason === 'attempts_unknown') return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700">amostra não isolável</span>
  if (minutes >= 270) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase text-emerald-700">amostra sólida</span>
  if (minutes >= 90) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700">em formação</span>
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase text-slate-500">amostra inicial</span>
}
function TrendType({ row }) {
  if (!row) return null
  if (row.exactPeriod) return <span className="text-[7px] font-bold text-emerald-600">período isolado</span>
  return <span className="text-[7px] font-bold text-amber-600">tendência acumulada</span>
}
function playerHistory(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const key = `${r.entityType}|${String(r.player || '').trim()}`
    if (!r.player) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(r)
  }
  for (const arr of map.values()) arr.sort((a,b) => Number(a.round) - Number(b.round))
  return map
}
function metricKeys(histories, entityType) {
  const keys = new Map()
  for (const arr of histories.values()) {
    for (const r of arr) {
      if (r.entityType !== entityType) continue
      for (const k of Object.keys(r.metrics || {})) {
        if (isIdentityColumn(k) || metricValue(r.metrics, k) === null) continue
        const nk = norm(k)
        if (!keys.has(nk)) keys.set(nk, k)
      }
    }
  }
  return [...keys.values()].sort((a,b) => {
    const ca = metricCategory(a, entityType)
    const cb = metricCategory(b, entityType)
    const order = entityType === 'goalkeeper' ? GOALKEEPER_CATEGORY_ORDER : PLAYER_CATEGORY_ORDER
    const da = order.indexOf(ca), db = order.indexOf(cb)
    if (da !== db) return da - db
    return metricDisplayName(a).localeCompare(metricDisplayName(b), 'pt-BR')
  })
}
function preferredMetric(keys, entityType) {
  const preferred = entityType === 'goalkeeper' ? GOALKEEPER_OVERVIEW_METRICS : PLAYER_OVERVIEW_METRICS
  for (const p of preferred) {
    const hit = keys.find(k => norm(k) === norm(p))
    if (hit) return hit
  }
  return keys[0] || ''
}
function formatDate(value) {
  if (!value) return '—'
  const d = new Date(`${String(value).slice(0,10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR')
}

const GPS_METRICS = [
  { key:'distancia_total', label:'Distância / jogo', unit:'m' },
  { key:'hsr_m', label:'Alta velocidade >20', unit:'m' },
  { key:'sprint_m', label:'Sprint >25', unit:'m' },
  { key:'n_sprints', label:'Nº sprints', unit:'' },
  { key:'aceleracoes', label:'Acelerações >3', unit:'' },
  { key:'desaceleracoes', label:'Desacelerações <-3', unit:'' },
  { key:'vel_max', label:'Velocidade máxima', unit:'km/h' },
]

export default function InternalComparisonDashboard({ data, gps, onSaveBaseline }) {
  const rows = useMemo(() => [
    ...(data?.players || []).map(r => ({ ...r, entityType:'player' })),
    ...(data?.goalkeepers || []).map(r => ({ ...r, entityType:'goalkeeper', position:'GK' })),
  ], [data])
  const histories = useMemo(() => playerHistory(rows), [rows])
  const [entityType, setEntityType] = useState('player')
  const metrics = useMemo(() => metricKeys(histories, entityType), [histories, entityType])
  const categories = entityType === 'goalkeeper' ? GOALKEEPER_CATEGORY_ORDER : PLAYER_CATEGORY_ORDER
  const [category, setCategory] = useState('TODAS')
  const categoryMetrics = useMemo(() => metrics.filter(m => category === 'TODAS' || metricCategory(m, entityType) === category), [metrics, category, entityType])
  const [metric, setMetric] = useState('')
  const [pos, setPos] = useState('TODOS')
  const [search, setSearch] = useState('')
  const [pairSearch, setPairSearch] = useState('')
  const [baselineDraft, setBaselineDraft] = useState(data?.baseline?.round || '')

  useEffect(() => {
    setCategory('TODAS')
    setPos(entityType === 'goalkeeper' ? 'GK' : 'TODOS')
    setMetric(preferredMetric(metricKeys(histories, entityType), entityType))
  }, [entityType, histories])
  useEffect(() => {
    if (!categoryMetrics.length) { setMetric(''); return }
    if (!categoryMetrics.includes(metric)) setMetric(preferredMetric(categoryMetrics, entityType))
  }, [categoryMetrics, entityType, metric])
  useEffect(() => setBaselineDraft(data?.baseline?.round || ''), [data?.baseline?.round])

  const people = useMemo(() => {
    const out = []
    for (const [key, hist] of histories.entries()) {
      const curr = hist[hist.length - 1]
      if (!curr || curr.entityType !== entityType) continue
      const exactBase = hist.find(r => Number(r.round) === Number(data?.baseline?.round)) || null
      const base = exactBase || { player:curr.player, position:curr.position, entityType, minutes:0, metrics:{} }
      out.push({
        key, name:curr.player, position:curr.position || (entityType === 'goalkeeper' ? 'GK' : ''),
        base, curr, hist, newAfterBaseline:!exactBase,
        postMinutes:Math.max(0, (toNumber(curr.minutes)||0) - (toNumber(base.minutes)||0)),
      })
    }
    return out.sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [histories, entityType, data?.baseline?.round])

  const filteredPeople = useMemo(() => people.filter(p => {
    if (entityType === 'player' && pos !== 'TODOS' && groupPos(p.position) !== pos) return false
    if (search && !norm(p.name).includes(norm(search))) return false
    return true
  }), [people, entityType, pos, search])

  const distribution = useMemo(() => {
    if (!metric) return []
    const all = filteredPeople.map(p => ({ ...p, row:periodMetric(metric, p.base, p.curr, entityType) })).filter(p => p.row?.post !== null && p.postMinutes > 0)
    const higher = metricHigherIsBetter(metric, entityType)
    all.sort((x,y) => higher ? (toNumber(y.row.post)||0)-(toNumber(x.row.post)||0) : (toNumber(x.row.post)||0)-(toNumber(y.row.post)||0))
    let rank = 0
    return all.map(p => ({ ...p, displayRank:p.row.rankable ? ++rank : null }))
  }, [filteredPeople, metric, entityType])

  const eligible = distribution.filter(p => p.row.rankable)
  const improved = eligible.filter(p => deltaGood(metric, p.row.delta, entityType) === true)
  const declined = eligible.filter(p => deltaGood(metric, p.row.delta, entityType) === false)
  const bestDelta = useMemo(() => [...eligible].filter(p => toNumber(p.row.delta) !== null).sort((a,b) => {
    const higher = metricHigherIsBetter(metric, entityType)
    return higher ? Number(b.row.delta)-Number(a.row.delta) : Number(a.row.delta)-Number(b.row.delta)
  }), [eligible, metric, entityType])
  const worstDelta = useMemo(() => [...bestDelta].reverse(), [bestDelta])

  const personNames = people.map(p => p.key)
  const [aKey, setAKey] = useState('')
  const [bKey, setBKey] = useState('')
  useEffect(() => {
    if (!personNames.includes(aKey)) setAKey(personNames[0] || '')
    if (!personNames.includes(bKey)) setBKey(personNames[1] || personNames[0] || '')
  }, [entityType, people]) // eslint-disable-line react-hooks/exhaustive-deps

  const a = people.find(p => p.key === aKey)
  const b = people.find(p => p.key === bKey)
  const pairRows = useMemo(() => {
    if (!a || !b) return []
    const q = norm(pairSearch)
    return metrics.map(m => ({
      metric:m,
      category:metricCategory(m, entityType),
      a:periodMetric(m, a.base, a.curr, entityType),
      b:periodMetric(m, b.base, b.curr, entityType),
    })).filter(r => {
      if (category !== 'TODAS' && r.category !== category) return false
      if (q && !norm(`${metricDisplayName(r.metric)} ${r.category}`).includes(q)) return false
      return r.a || r.b
    })
  }, [a,b,metrics,entityType,category,pairSearch])

  const trend = useMemo(() => {
    if (!a || !metric) return []
    const hist = a.hist
    const baselineRound = Number(data?.baseline?.round)
    const out = []
    for (let i=0; i<hist.length; i++) {
      const curr = hist[i]
      if (Number(curr.round) <= baselineRound) continue
      const prev = hist[i-1] && Number(hist[i-1].round) >= baselineRound
        ? hist[i-1]
        : (hist.find(r => Number(r.round) === baselineRound) || { minutes:0, metrics:{}, entityType })
      const row = periodMetric(metric, prev, curr, entityType)
      if (row && row.post !== null) out.push({ round:Number(curr.round), date:curr.upload_date, row })
    }
    return out
  }, [a,metric,entityType,data?.baseline?.round])

  const baselineDate = data?.baseline?.date || null
  const gpsRows = useMemo(() => {
    if (!gps?.aggregateForRange || !baselineDate) return []
    return people.map(p => ({
      ...p,
      gpsPre:gps.aggregateForRange(p.name, { to:baselineDate }),
      gpsPost:gps.aggregateForRange(p.name, { from:nextDay(baselineDate) }),
    }))
  }, [people,gps,baselineDate])

  const status = Number(data?.current?.round || 0) > Number(data?.baseline?.round || 0) ? 'active' : 'waiting'
  const withMinutes = people.filter(p => p.postMinutes > 0).length
  const solid = people.filter(p => p.postMinutes >= 270).length
  const metricContext = metric ? isContextMetric(metric, entityType) : false

  return <div className="mx-auto max-w-[1540px] space-y-5">
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm print-break">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-600">Série C · Evolução interna</div>
          <h2 className="bc mt-1 text-2xl font-black text-gray-900">Nova comissão · antes × depois</h2>
          <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-gray-500">A rodada-base fecha o trabalho anterior. A partir do upload seguinte, o painel reconstrói o que cada atleta produziu no novo período e compara atleta × atleta sem usar Índice.</p>
        </div>
        <button onClick={() => window.print()} className="no-print inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-emerald-700"><Printer className="h-4 w-4"/> Imprimir / PDF</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-100 p-3"><div className="text-[8px] font-black uppercase tracking-wider text-gray-400">Rodada-base</div><div className="bc mt-1 text-xl font-black text-gray-900">R{data?.baseline?.round || '—'}</div><div className="text-[8px] text-gray-400">{formatDate(data?.baseline?.date)}</div></div>
        <div className="rounded-xl border border-gray-100 p-3"><div className="text-[8px] font-black uppercase tracking-wider text-gray-400">Rodada atual</div><div className="bc mt-1 text-xl font-black text-gray-900">R{data?.current?.round || '—'}</div><div className="text-[8px] text-gray-400">{status === 'active' ? `R${Number(data?.baseline?.round)+1} → R${data?.current?.round}` : 'aguardando próximo upload'}</div></div>
        <div className="rounded-xl border border-gray-100 p-3"><div className="text-[8px] font-black uppercase tracking-wider text-gray-400">Atletas com minutos</div><div className="bc mt-1 text-xl font-black text-gray-900">{withMinutes}</div><div className="text-[8px] text-gray-400">no período pós-base</div></div>
        <div className="rounded-xl border border-gray-100 p-3"><div className="text-[8px] font-black uppercase tracking-wider text-gray-400">Amostra sólida</div><div className="bc mt-1 text-xl font-black text-emerald-600">{solid}</div><div className="text-[8px] text-gray-400">≥270 min pós-base</div></div>
        <div className={`rounded-xl border p-3 ${status === 'active' ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-100 bg-amber-50/60'}`}><div className="text-[8px] font-black uppercase tracking-wider text-gray-400">Status</div><div className={`mt-1 text-sm font-black ${status === 'active' ? 'text-emerald-700' : 'text-amber-700'}`}>{status === 'active' ? 'Comparação ativa' : 'Linha de base salva'}</div><div className="text-[8px] text-gray-500">atualiza a cada upload semanal</div></div>
      </div>

      <div className="no-print mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Início da nova comissão
          <select value={baselineDraft} onChange={e => setBaselineDraft(e.target.value)} className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold text-gray-700">
            {(data?.uploads || []).map(u => <option key={u.id} value={u.round}>Rodada {u.round}{u.upload_date ? ` · ${formatDate(u.upload_date)}` : ''}</option>)}
          </select>
        </label>
        <button onClick={() => onSaveBaseline?.(Number(baselineDraft))} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white"><Save className="h-3 w-3"/> Salvar rodada-base</button>
        <span className="text-[9px] text-gray-400">Escolha a última rodada da comissão anterior. O novo período começa na rodada seguinte.</span>
      </div>
    </div>

    {status === 'waiting' ? <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-center print-break"><AlertTriangle className="mx-auto h-6 w-6 text-amber-500"/><div className="mt-2 text-sm font-black text-amber-800">Tudo pronto para o próximo jogo.</div><div className="mt-1 text-[11px] text-amber-700">Quando você fizer o próximo upload da Série C, a comparação pós-comissão começa automaticamente.</div></div> : null}

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm print-break">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600"/><h3 className="text-sm font-black text-gray-800">Comparação interna por qualquer métrica</h3></div><p className="mt-0.5 text-[9px] text-gray-400">As 139 métricas de linha e 114 de goleiros ficam disponíveis conforme existirem no upload. Percentuais com pouca tentativa não viram falso líder.</p></div>
        <div className="no-print flex flex-wrap gap-2">
          <button onClick={() => setEntityType('player')} className={`rounded-lg px-3 py-1.5 text-[8px] font-black uppercase ${entityType === 'player' ? 'bg-emerald-600 text-white' : 'border border-gray-200 bg-white text-gray-500'}`}>Linha</button>
          <button onClick={() => setEntityType('goalkeeper')} className={`rounded-lg px-3 py-1.5 text-[8px] font-black uppercase ${entityType === 'goalkeeper' ? 'bg-emerald-600 text-white' : 'border border-gray-200 bg-white text-gray-500'}`}>Goleiros</button>
        </div>
      </div>

      <div className="no-print mt-4 grid gap-2 md:grid-cols-[160px_220px_1fr_180px]">
        {entityType === 'player' ? <select value={pos} onChange={e => setPos(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-2 text-[9px] font-bold"><option value="TODOS">Todos os setores</option><option value="DEF">Defensores</option><option value="MEI">Meio-campistas</option><option value="ATA">Atacantes</option></select> : <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[9px] font-bold text-gray-500">Somente goleiros</div>}
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-2 text-[9px] font-bold"><option value="TODAS">Todas as famílias</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
        <select value={metric} onChange={e => setMetric(e.target.value)} className="min-w-0 rounded-lg border border-gray-200 px-2 py-2 text-[9px] font-bold">{categoryMetrics.map(m => <option key={m} value={m}>{metricDisplayName(m)}</option>)}</select>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2"><Search className="h-3 w-3 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar atleta" className="w-full bg-transparent py-2 text-[9px] outline-none"/></label>
      </div>

      {metric ? <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3"><div className="text-[8px] font-black uppercase text-gray-400">Métrica</div><div className="mt-1 text-[11px] font-black text-gray-800">{metricDisplayName(metric)}</div><div className="mt-1 text-[8px] text-gray-400">{metricCategory(metric, entityType)}</div></div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"><div className="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-700"><TrendingUp className="h-3 w-3"/> Evoluindo</div><div className="bc mt-1 text-xl font-black text-emerald-700">{improved.length}</div><div className="text-[8px] text-emerald-600">com amostra elegível</div></div>
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3"><div className="flex items-center gap-1 text-[8px] font-black uppercase text-rose-600"><TrendingDown className="h-3 w-3"/> Caindo</div><div className="bc mt-1 text-xl font-black text-rose-600">{declined.length}</div><div className="text-[8px] text-rose-500">com amostra elegível</div></div>
        <div className="rounded-xl border border-gray-100 p-3"><div className="text-[8px] font-black uppercase text-gray-400">Leitura</div><div className="mt-1 text-[10px] font-black text-gray-700">{metricContext ? 'Contextual' : (isPercentageMetric(metric) ? 'Eficiência' : (isVolumeMetric(metric) ? 'Produção' : 'Tendência'))}</div><div className="mt-1 text-[8px] leading-relaxed text-gray-400">{metricContext ? 'Ordena para comparação, mas não interpreta como “melhor/pior”.' : 'Direção da métrica e amostra são respeitadas automaticamente.'}</div></div>
      </div> : null}

      <div className="mt-4 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-gray-400">{metricContext ? 'Distribuição interna' : 'Ranking interno pós-comissão'}</div>
          <div className="space-y-2">
            {distribution.slice(0,20).map((p,i) => <div key={p.key} className={`grid grid-cols-[34px_1fr_auto_auto] items-center gap-2 rounded-xl border px-3 py-2 ${p.row.rankable ? 'border-gray-100' : 'border-dashed border-gray-200 bg-gray-50/40'}`}>
              <div className={`grid h-7 w-7 place-items-center rounded-lg text-[9px] font-black ${p.displayRank && p.displayRank <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{p.displayRank || '—'}</div>
              <div className="min-w-0"><div className="truncate text-[10px] font-black text-gray-800">{p.name}</div><div className="text-[8px] text-gray-400">{p.position} · {p.postMinutes} min pós-base {p.newAfterBaseline ? '· entrou após a base' : ''}</div></div>
              <SampleBadge minutes={p.postMinutes} row={p.row}/>
              <div className="min-w-[120px] text-right"><div className="bc text-base font-black text-gray-900">{formatPeriod(p.row)}</div><div className="text-[8px]"><Delta metric={metric} entityType={entityType} value={p.row.delta} suffix={p.row.kind === 'pct' ? ' pp' : ''}/></div><TrendType row={p.row}/></div>
            </div>)}
            {!distribution.length ? <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-[10px] text-gray-400">Ainda não há minutos após a rodada-base para esta métrica.</div> : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-emerald-700"><TrendingUp className="h-4 w-4"/> Maiores evoluções · métrica selecionada</div>
            <div className="mt-3 space-y-2">{bestDelta.slice(0,5).map((p,i) => <div key={p.key} className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-2 last:border-0"><div><div className="text-[9px] font-black text-gray-800">{i+1}. {p.name}</div><div className="text-[7px] text-gray-400">{p.postMinutes} min</div></div><div className="text-right"><div className="text-[10px] font-black text-emerald-700">{formatPeriod(p.row)}</div><Delta metric={metric} entityType={entityType} value={p.row.delta} suffix={p.row.kind === 'pct' ? ' pp' : ''}/></div></div>)}{!bestDelta.length ? <div className="text-[9px] text-gray-400">Sem comparação elegível ainda.</div> : null}</div>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-rose-600"><TrendingDown className="h-4 w-4"/> Pontos de atenção · métrica selecionada</div>
            <div className="mt-3 space-y-2">{worstDelta.slice(0,5).map((p,i) => <div key={p.key} className="flex items-center justify-between gap-3 border-b border-rose-100 pb-2 last:border-0"><div><div className="text-[9px] font-black text-gray-800">{i+1}. {p.name}</div><div className="text-[7px] text-gray-400">{p.postMinutes} min</div></div><div className="text-right"><div className="text-[10px] font-black text-rose-600">{formatPeriod(p.row)}</div><Delta metric={metric} entityType={entityType} value={p.row.delta} suffix={p.row.kind === 'pct' ? ' pp' : ''}/></div></div>)}{!worstDelta.length ? <div className="text-[9px] text-gray-400">Sem comparação elegível ainda.</div> : null}</div>
          </div>
          <div className="rounded-xl border border-gray-100 p-4 text-[8px] leading-relaxed text-gray-500"><b>Regra de leitura:</b> produção é reconstruída pelo delta dos totais e minutos. Eficiências só viram ranking quando o número de tentativas do período atinge o mínimo da métrica. Médias sem denominador disponível aparecem como <b>tendência acumulada</b>, sem fingir que são valores isolados da nova comissão.</div>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm print-break">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-sm font-black text-gray-800">Evolução rodada a rodada</h3><p className="text-[9px] text-gray-400">Cada card mostra somente o intervalo daquela rodada para a anterior, quando a estrutura da métrica permite.</p></div>
        <div className="no-print flex gap-2"><select value={aKey} onChange={e => setAKey(e.target.value)} className="max-w-[260px] rounded-lg border border-gray-200 px-2 py-1.5 text-[9px] font-bold">{people.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select></div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {trend.map((t,i) => {
          const prev = i > 0 ? trend[i-1].row.post : null
          const d = prev !== null && Number.isFinite(Number(prev)) ? Number(t.row.post) - Number(prev) : null
          return <div key={t.round} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3"><div className="text-[8px] font-black uppercase tracking-widest text-gray-400">Rodada {t.round}</div><div className="mt-1 bc text-xl font-black text-gray-900">{formatPeriod(t.row)}</div><div className="mt-1 text-[8px]">{i === 0 ? <span className="text-gray-400">1º recorte pós-base</span> : <Delta metric={metric} entityType={entityType} value={d} suffix={t.row.kind === 'pct' ? ' pp' : ''}/>}</div><div className="mt-1 text-[7px] text-gray-400">{t.row.postMinutes} min no intervalo · {formatDate(t.date)}</div><TrendType row={t.row}/></div>
        })}
        {!trend.length ? <div className="col-span-full rounded-xl border border-dashed border-gray-200 p-6 text-center text-[10px] text-gray-400">A série começa no primeiro upload depois da rodada-base.</div> : null}
      </div>
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm print-break">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-sm font-black text-gray-800">Atleta × atleta · todas as métricas</h3><p className="text-[9px] text-gray-400">Comparação direta sem Índice. Você pode filtrar por família ou procurar qualquer uma das métricas do novo SportsBase.</p></div>
        <div className="no-print flex flex-wrap gap-2"><select value={aKey} onChange={e => setAKey(e.target.value)} className="max-w-[240px] rounded-lg border border-gray-200 px-2 py-1.5 text-[9px] font-bold">{people.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select><span className="self-center text-[9px] font-black text-gray-300">×</span><select value={bKey} onChange={e => setBKey(e.target.value)} className="max-w-[240px] rounded-lg border border-gray-200 px-2 py-1.5 text-[9px] font-bold">{people.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select><label className="flex items-center gap-2 rounded-lg border border-gray-200 px-2"><Search className="h-3 w-3 text-gray-400"/><input value={pairSearch} onChange={e => setPairSearch(e.target.value)} placeholder="Buscar métrica" className="w-36 bg-transparent py-1.5 text-[9px] outline-none"/></label></div>
      </div>
      <div className="mt-4 overflow-auto rounded-xl border border-gray-100 print:overflow-visible">
        <table className="w-full min-w-[850px] text-left text-[9px]"><thead className="sticky top-0 bg-gray-50"><tr><th className="px-3 py-2">Família / métrica</th><th className="px-3 py-2 text-right">{a?.name || 'Atleta A'}</th><th className="px-3 py-2 text-right">Δ vs base</th><th className="px-3 py-2 text-right">{b?.name || 'Atleta B'}</th><th className="px-3 py-2 text-right">Δ vs base</th><th className="px-3 py-2">Leitura</th></tr></thead><tbody>{pairRows.map(r => <tr key={r.metric} className="border-t border-gray-50"><td className="px-3 py-2"><div className="font-black text-gray-700">{metricDisplayName(r.metric)}</div><div className="text-[7px] text-gray-400">{r.category}</div></td><td className="px-3 py-2 text-right"><div className="font-black text-gray-800">{formatPeriod(r.a)}</div>{r.a ? <SampleBadge minutes={r.a.postMinutes} row={r.a}/> : null}</td><td className="px-3 py-2 text-right"><Delta metric={r.metric} entityType={entityType} value={r.a?.delta} suffix={r.a?.kind === 'pct' ? ' pp' : ''}/></td><td className="px-3 py-2 text-right"><div className="font-black text-gray-800">{formatPeriod(r.b)}</div>{r.b ? <SampleBadge minutes={r.b.postMinutes} row={r.b}/> : null}</td><td className="px-3 py-2 text-right"><Delta metric={r.metric} entityType={entityType} value={r.b?.delta} suffix={r.b?.kind === 'pct' ? ' pp' : ''}/></td><td className="px-3 py-2"><TrendType row={r.a || r.b}/>{isContextMetric(r.metric, entityType) ? <div className="text-[7px] text-slate-400">contextual</div> : null}</td></tr>)}</tbody></table>
      </div>
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm print-break">
      <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600"/><h3 className="text-sm font-black text-gray-800">Físico · GPS pré × pós-comissão</h3></div>
      <p className="mt-0.5 text-[9px] text-gray-400">Separa os jogos Catapult pela data da rodada-base e compara a média por jogo. Usa os vínculos GPS já cadastrados.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-[8px]"><thead><tr className="border-b border-gray-100 text-gray-400"><th className="py-2">Atleta</th><th>Jogos pré</th><th>Jogos pós</th>{GPS_METRICS.map(g => <th key={g.key} className="text-right">{g.label}</th>)}</tr></thead><tbody>
          {gpsRows.filter(r => r.gpsPost).sort((x,y) => (y.gpsPost?.jogos || 0) - (x.gpsPost?.jogos || 0)).map(r => <tr key={r.key} className="border-b border-gray-50"><td className="py-2 pr-2"><div className="font-black text-gray-700">{r.name}</div><div className="text-gray-400">{r.position}</div></td><td>{r.gpsPre?.jogos || 0}</td><td className="font-black text-gray-600">{r.gpsPost?.jogos || 0}</td>{GPS_METRICS.map(g => { const pre=toNumber(r.gpsPre?.[g.key]), post=toNumber(r.gpsPost?.[g.key]); const d=pre!==null&&post!==null?post-pre:null; return <td key={g.key} className="py-2 text-right"><div className="font-black text-gray-800">{post===null?'—':formatNumberBR(post,g.key==='vel_max'?1:0)}</div><div className="text-[7px]"><Delta metric={g.label} value={d}/></div></td> })}</tr>)}
        </tbody></table>
        {!gpsRows.some(r => r.gpsPost) ? <div className="py-10 text-center text-[10px] text-gray-400">Ainda não há jogos GPS após a rodada-base.</div> : null}
      </div>
    </section>
  </div>
}
