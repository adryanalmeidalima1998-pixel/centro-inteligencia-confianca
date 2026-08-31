'use client'
import { collectiveReport } from '../../../lib/serieCReport'

function fmt(v, d = 0) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits:d, maximumFractionDigits:d })
}

function rankText(rank, total = 20) {
  return rank ? `${rank}º/${total}` : null
}

function RankBar({ rank, total, status }) {
  const pct = total > 1 ? ((total - rank) / (total - 1)) * 100 : 0
  const color = status === 'forca' ? 'bg-emerald-500' : status === 'alerta' ? 'bg-rose-400' : 'bg-amber-400'
  return (
    <div className="flex items-center gap-2 w-28 shrink-0">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width:`${pct}%` }} /></div>
      <span className="text-[9px] font-black tabular-nums text-gray-500 w-9 text-right">{rank}º/{total}</span>
    </div>
  )
}

function MetricRow({ r, showAverage = false }) {
  const delta = Number(r?.vsAveragePct)
  const hasDelta = Number.isFinite(delta)
  const deltaText = hasDelta ? `${delta > 0 ? '+' : ''}${fmt(delta,1)}% vs média` : null
  const deltaClass = delta < 0 ? 'text-rose-500' : 'text-emerald-600'
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] text-gray-700 flex-1 truncate">{r.metric}</span>
      <div className="w-[76px] shrink-0 text-right">
        <div className="text-[10px] font-black text-gray-800 bc tabular-nums">{r.value}</div>
        {showAverage && deltaText ? <div className={`text-[6.5px] font-black tabular-nums ${deltaClass}`}>{deltaText}</div> : null}
      </div>
      <RankBar rank={r.rank} total={r.total} status={r.status} />
    </div>
  )
}

function Bars({ items, tone = 'emerald', showShare = false }) {
  const total = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  const max = Math.max(1, ...items.map(i => Number(i.value) || 0))
  const bar = tone === 'rose' ? 'bg-rose-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="space-y-1.5">
      {items.map((i, k) => {
        const value = Number(i.value) || 0
        const share = total ? Math.round(value / total * 100) : 0
        return <div key={k} className={`grid ${showShare ? 'grid-cols-[105px_1fr_28px_32px]' : 'grid-cols-[105px_1fr_28px]'} items-center gap-2`}>
          <span className="text-[9px] text-gray-600 truncate">{i.label}</span>
          <div className="h-2.5 rounded bg-gray-100 overflow-hidden"><div className={`h-full rounded ${bar}`} style={{ width:`${(value / max) * 100}%` }} /></div>
          <span className="text-[10px] font-black text-gray-800 bc tabular-nums text-right">{fmt(value)}</span>
          {showShare ? <span className="text-[8px] font-bold text-gray-400 text-right">{share}%</span> : null}
        </div>
      })}
    </div>
  )
}

function CorridorBars({ items, tone = 'amber' }) {
  const total = items.reduce((sum, i) => sum + (Number(i.value) || 0), 0)
  const dominant = [...items].sort((a,b) => (Number(b.value)||0) - (Number(a.value)||0))[0]
  return <div>
    <Bars items={items} tone={tone} showShare />
    {total > 0 && dominant ? <div className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5 text-[8px] font-bold text-gray-500">Maior incidência: <span className="font-black text-gray-700">{dominant.label}</span> · {fmt(((Number(dominant.value)||0) / total) * 100, 0)}%</div> : null}
  </div>
}

function MiniGoalPitch({ points = [], tone = 'rose', label }) {
  if (!Array.isArray(points) || !points.length) return null
  const dot = tone === 'emerald' ? 'bg-emerald-600 ring-emerald-200' : 'bg-rose-500 ring-rose-200'
  return <div>
    {label ? <div className="mb-1 text-[7px] font-black uppercase tracking-wider text-gray-500">{label}</div> : null}
    <div className="relative aspect-[100/58] w-full overflow-hidden rounded-lg bg-emerald-50">
      <svg viewBox="0 0 100 58" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <rect x="1" y="1" width="98" height="56" rx="2" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
        <line x1="33.33" y1="1" x2="33.33" y2="57" stroke="#d1fae5" strokeDasharray="2 2" />
        <line x1="66.67" y1="1" x2="66.67" y2="57" stroke="#d1fae5" strokeDasharray="2 2" />
        <rect x="28" y="1" width="44" height="17" fill="none" stroke="#a7f3d0" strokeWidth="1" />
        <rect x="39" y="1" width="22" height="7" fill="none" stroke="#a7f3d0" strokeWidth="1" />
        <path d="M41 18 A12 12 0 0 0 59 18" fill="none" stroke="#a7f3d0" strokeWidth="1" />
        <rect x="43" y="0" width="14" height="2" fill="none" stroke="#34d399" strokeWidth="1" />
      </svg>
      {points.map((point,i) => <span key={point.id || i} className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ${dot}`} style={{ left:`${point.x}%`, top:`${point.y}%` }} />)}
    </div>
  </div>
}

const GOAL_TYPE_LABELS = {
  nao_informado:'Não informado',
  jogo_organizado:'Jogo organizado',
  contra_ataque:'Contra-ataque',
  escanteio:'Escanteio',
  falta_lateral:'Falta lateral',
  falta_direta:'Falta direta',
  penalti:'Pênalti',
  outro:'Outro',
}

function goalTypeItems(points = []) {
  const counts = {}
  for (const p of points || []) {
    const key = p?.tipo || 'nao_informado'
    counts[key] = (counts[key] || 0) + 1
  }
  return Object.entries(counts).map(([key,value]) => ({ label:GOAL_TYPE_LABELS[key] || key, value, key })).sort((a,b) => b.value-a.value)
}

function setPieceGoalCount(points = []) {
  const setPieceTypes = new Set(['escanteio','falta_lateral','falta_direta','penalti'])
  return (points || []).filter(p => setPieceTypes.has(p?.tipo)).length
}

function GoalTypeBars({ points = [], tone='rose' }) {
  const items = goalTypeItems(points).filter(i => i.key !== 'nao_informado')
  if (!items.length) return null
  return <Bars items={items} tone={tone} showShare />
}

function hasNineZone(data) {
  return ['esquerda','centro','direita'].some(row => ['defensivo','medio','ofensivo'].some(col => Number.isFinite(Number(data?.pct?.[row]?.[col]))))
}

function NineZoneCompact({ title, data, tone='emerald' }) {
  if (!hasNineZone(data)) return null
  const rows=[['esquerda','E'],['centro','C'],['direita','D']]
  const cols=[['defensivo','Def'],['medio','Méd'],['ofensivo','Of']]
  const cells=[]
  rows.forEach(([rk,rl]) => cols.forEach(([ck,cl]) => {
    const value=Number(data?.pct?.[rk]?.[ck])
    if (Number.isFinite(value)) cells.push({rk,ck,rl,cl,value})
  }))
  const max=Math.max(1,...cells.map(c=>c.value))
  const dominant=[...cells].sort((a,b)=>b.value-a.value)[0]
  const base = tone==='rose' ? 'bg-rose-50 text-rose-600' : tone==='amber' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
  return <div className="rounded-2xl border border-gray-100 p-3">
    <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-gray-500">{title}</div>
    <div className="grid grid-cols-[22px_repeat(3,1fr)] gap-1">
      <div />{cols.map(([,label]) => <div key={label} className="text-center text-[6px] font-black uppercase text-gray-400">{label}</div>)}
      {rows.map(([rk,label]) => <div key={rk} className="contents"><div className="flex items-center text-[6px] font-black text-gray-400">{label}</div>{cols.map(([ck]) => {
        const value=Number(data?.pct?.[rk]?.[ck]); const p90=Number(data?.per90?.[rk]?.[ck]); const width=Number.isFinite(value)?Math.max(8,Math.round(value/max*100)):0
        return <div key={`${rk}-${ck}`} className={`relative overflow-hidden rounded-md p-1.5 text-center ${base}`}><div className="absolute bottom-0 left-0 h-0.5 bg-current opacity-25" style={{width:`${width}%`}}/><div className="bc text-[10px] font-black">{Number.isFinite(value)?`${fmt(value,1)}%`:'—'}</div><div className="text-[6px] font-bold text-gray-400">{Number.isFinite(p90)?`${fmt(p90,1)}/90`:''}</div></div>
      })}</div>)}
    </div>
    {dominant ? <div className="mt-1.5 text-[7px] font-bold text-gray-400">Pico: <span className="font-black text-gray-600">{dominant.rl} · {dominant.cl}</span> · {fmt(dominant.value,1)}%</div> : null}
  </div>
}

function Kpi({ label, value, sub, tone = 'emerald' }) {
  const valueColor = tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-emerald-700'
  return <div className="rounded-2xl border border-gray-100 bg-white p-3">
    <div className="text-[7px] font-black uppercase tracking-widest text-gray-400">{label}</div>
    <div className={`text-xl font-black bc leading-none mt-1 ${valueColor}`}>{value}</div>
    {sub ? <div className="text-[8px] text-gray-400 mt-1">{sub}</div> : null}
  </div>
}

function SectionTitle({ children, sub }) {
  return <div className="mb-2">
    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{children}</div>
    {sub ? <div className="mt-0.5 text-[8px] font-bold text-gray-300">{sub}</div> : null}
  </div>
}

function Insight({ title, text, tone = 'emerald' }) {
  const cls = tone === 'rose' ? 'border-rose-100 bg-rose-50/60 text-rose-600' : tone === 'amber' ? 'border-amber-100 bg-amber-50/60 text-amber-700' : 'border-emerald-100 bg-emerald-50/60 text-emerald-700'
  return <div className={`rounded-xl border p-3 ${cls}`}>
    <div className="text-[8px] font-black uppercase tracking-widest">{title}</div>
    <div className="mt-1 text-[10px] font-bold leading-snug text-gray-700">{text}</div>
  </div>
}

function ProfileMetric({ label, value, rank, sub, tone = 'gray' }) {
  const cls = tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-700' : 'text-gray-800'
  return <div className="rounded-xl border border-gray-100 bg-white p-2.5">
    <div className="flex items-start justify-between gap-2">
      <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 leading-tight">{label}</span>
      {rank ? <span className="shrink-0 rounded-full bg-gray-50 px-1.5 py-0.5 text-[7px] font-black text-gray-500">{rankText(rank)}</span> : null}
    </div>
    <div className={`mt-1 text-base font-black bc leading-none ${cls}`}>{value}</div>
    {sub ? <div className="mt-1 text-[8px] font-bold text-gray-400 leading-tight">{sub}</div> : null}
  </div>
}

function ThirdDistribution({ title, data, tone = 'emerald' }) {
  if (!data) return null
  const items = [
    { label:'Terço defensivo', value:data.defensiveThirdPct },
    { label:'Terço médio', value:data.middleThirdPct },
    { label:'Terço final', value:data.finalThirdPct },
  ]
  const bar = tone === 'rose' ? 'bg-rose-400' : 'bg-emerald-500'
  return <div className="rounded-2xl border border-gray-100 p-3">
    <div className="flex items-center justify-between gap-2 mb-2"><span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{title}</span><span className="text-[8px] font-black text-gray-400">{fmt(data.per90, 1)}/90 · {rankText(data.rank)}</span></div>
    <div className="space-y-2">{items.map(item => <div key={item.label}>
      <div className="mb-1 flex justify-between text-[8px] font-bold text-gray-500"><span>{item.label}</span><span>{fmt(item.value, 1)}%</span></div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${bar}`} style={{ width:`${Math.max(0, Math.min(100, Number(item.value)||0))}%` }} /></div>
    </div>)}</div>
  </div>
}

function average(rows, field) {
  const vals = (rows || []).map(r => Number(r?.[field])).filter(Number.isFinite)
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null
}

function normalizeMetricLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function metricByName(col, name) {
  const wanted = normalizeMetricLabel(name)
  return col.todos.find(r => normalizeMetricLabel(r.metric) === wanted) || null
}

function pressureMetricFrom(col) {
  const aliases = [
    'Pressão bem-sucedida',
    'Pressão do time bem-sucedida %',
    'Pressão do time bem-sucedida, %',
  ]
  return aliases.map(name => metricByName(col, name)).find(Boolean) || null
}

function averageGapText(metric) {
  const delta = Number(metric?.vsAveragePct)
  if (!Number.isFinite(delta)) return null
  return `${delta > 0 ? '+' : ''}${fmt(delta,1)}% vs média da Série C`
}

function makeInsights(col, g, prof, golsLado) {
  const out = []
  const best = col.forcas[0]
  const worst = col.alertas[0]
  if (best) out.push({ title:'Principal força', tone:'emerald', text:`${best.metric}: ${best.value}, ${best.rank}º de ${best.total} clubes.` })
  if (worst) out.push({ title:'Maior alerta', tone:'rose', text:`${worst.metric}: ${worst.value}, ${worst.rank}º de ${worst.total} clubes.` })

  const pressure = pressureMetricFrom(col)
  if (pressure && Number(pressure.vsAveragePct) < 0) {
    out.push({
      title:'Eficiência da pressão',
      tone:Number(pressure.vsAveragePct) <= -8 ? 'rose' : 'amber',
      text:`Pressão bem-sucedida: ${pressure.value}, ${pressure.rank}º/${pressure.total} (${averageGapText(pressure)}).`,
    })
  }

  const timing = g?.concededTiming
  const totalGoals = Number(timing?.total?.goals) || 0
  const second = Number(timing?.secondHalf?.goals) || 0
  if (totalGoals > 0) {
    const share = Math.round(second / totalGoals * 100)
    out.push({ title:'Momento crítico', tone:share >= 55 ? 'rose' : 'amber', text:`${second} de ${totalGoals} gols sofridos (${share}%) aconteceram no 2º tempo nas últimas 10 partidas.` })
  }

  if (golsLado) {
    const corridors = [
      { label:'esquerda do ataque rival', value:Number(golsLado.ataques_esquerda)||0 },
      { label:'corredor central', value:Number(golsLado.ataques_centro)||0 },
      { label:'direita do ataque rival', value:Number(golsLado.ataques_direita)||0 },
    ]
    const total = corridors.reduce((s,i) => s+i.value, 0)
    const dom = [...corridors].sort((a,b) => b.value-a.value)[0]
    if (total > 0) out.push({ title:'Corredor mais exposto', tone:'amber', text:`Maior exposição pela ${dom.label}: ${Math.round(dom.value/total*100)}% das ações defensivas de risco cadastradas.` })
  }

  const goals = Number(prof?.goalsOverview?.goals)
  const xg = Number(prof?.goalsOverview?.xg)
  if (Number.isFinite(goals) && Number.isFinite(xg)) {
    const diff = goals - xg
    out.push({ title:'Eficiência ofensiva', tone:diff >= 0 ? 'emerald' : 'amber', text:`${fmt(goals)} gols para ${fmt(xg,1)} xG (${diff >= 0 ? '+' : ''}${fmt(diff,1)} em relação ao esperado).` })
  }
  return out.slice(0, 4)
}

function makePriorities(col, g, golsLado) {
  const priorities = []
  const map = metric => {
    const m = metric.toLowerCase()
    if (m.includes('pressão')) return 'Elevar a eficiência da pressão: melhorar gatilhos, coordenação do bloco, coberturas e reação coletiva para transformar mais pressões em recuperação ou passe forçado.'
    if (m.includes('intercept')) return 'Aumentar antecipação, encurtamento e capacidade de recuperar a bola antes da última linha.'
    if (m.includes('duelos defensivos')) return 'Reforçar proteção ao portador, cobertura e eficiência nos duelos defensivos.'
    if (m.includes('duelos aéreos')) return 'Trabalhar proteção da área, referência de marcação e ataque à primeira bola.'
    if (m.includes('faltas')) return 'Reduzir faltas evitáveis, principalmente em zonas que geram bola parada adversária.'
    if (m.includes('perdas')) return 'Melhorar segurança da posse e reação imediata à perda.'
    if (m.includes('cart')) return 'Controlar disciplina competitiva e ações de risco.'
    return `Elevar ${metric.toLowerCase()} sem perder as forças atuais da equipe.`
  }
  const pressure = pressureMetricFrom(col)
  const priorityAlerts = col.alertas.slice(0, 4)
  if (pressure?.status === 'alerta' && !priorityAlerts.some(r => r.metric === pressure.metric)) {
    if (priorityAlerts.length >= 4) priorityAlerts[priorityAlerts.length - 1] = pressure
    else priorityAlerts.push(pressure)
  }
  priorityAlerts.forEach(r => priorities.push({ title:`${r.rank}º/${r.total} · ${r.metric}`, text:map(r.metric) }))

  const timing = g?.concededTiming
  if ((Number(timing?.secondHalf?.goals)||0) > (Number(timing?.firstHalf?.goals)||0)) {
    priorities.push({ title:'2º tempo', text:'Reforçar controle após o intervalo, gestão das substituições e comportamento defensivo com fadiga.' })
  }
  if (golsLado) {
    const a = [
      { label:'esquerda do ataque rival / nossa direita', value:Number(golsLado.ataques_esquerda)||0 },
      { label:'corredor central', value:Number(golsLado.ataques_centro)||0 },
      { label:'direita do ataque rival / nossa esquerda', value:Number(golsLado.ataques_direita)||0 },
    ].sort((x,y) => y.value-x.value)
    if (a[0].value > 0) priorities.push({ title:'Exposição espacial', text:`Priorizar correções na ${a[0].label}, corredor com maior volume de exposições defensivas.` })
  }
  return priorities.slice(0, 6)
}

function PageHeader({ page, totalPages = 5, subtitle, teamReport }) {
  return <div className="flex items-end justify-between gap-4 border-b-2 border-emerald-600 pb-3">
    <div className="flex items-center gap-3">
      <div className="h-16 w-16 shrink-0 rounded-2xl border border-emerald-100 bg-white grid place-items-center p-2">
        <img src="/confianca.png" alt="Escudo do Confiança" className="max-h-full max-w-full object-contain" />
      </div>
      <div>
        <div className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-600">CIC · Relatório coletivo · Série C</div>
        <div className="text-2xl font-black text-gray-900 bc leading-none">Confiança</div>
        <div className="mt-1 text-[9px] font-bold text-gray-400">{subtitle}</div>
      </div>
    </div>
    <div className="text-right text-[8px] font-bold text-gray-400">
      <div>Página {page}/{totalPages}</div>
      {teamReport?.round ? <div>Relatório de equipe · R{teamReport.round}</div> : null}
    </div>
  </div>
}

export default function RelatorioColetivo({ teams = [], seasonReport = null, teamMatchStats = null, physical = null, golsLado = null, teamReport = null }) {
  const col = collectiveReport(teams)
  const g = seasonReport?.guarani || {}
  const prof = g.profile || {}
  const matchStats = teamMatchStats || null
  const conceded = g.concededByType
  const timing = g.concededTiming
  const scored = g.goalsByType

  // Gols oficiais do painel: a fonte prioritária é o cadastro manual por ponto,
  // porque ele representa exatamente o gráfico/origem preenchido pelo usuário.
  const concededGoalPoints = Array.isArray(golsLado?.gols_sofridos_pontos) ? golsLado.gols_sofridos_pontos : []
  const scoredGoalPoints = Array.isArray(golsLado?.gols_marcados_pontos) ? golsLado.gols_marcados_pontos : []
  const concededGoalTypes = goalTypeItems(concededGoalPoints).filter(i => i.key !== 'nao_informado')
  const scoredGoalTypes = goalTypeItems(scoredGoalPoints).filter(i => i.key !== 'nao_informado')
  const registeredGoalsScored = scoredGoalPoints.length || Number(metricByName(col,'Gols')?.rawValue || prof.goalsOverview?.goals || matchStats?.goalsFor || 0)
  const registeredGoalsConceded = concededGoalPoints.length || Number(prof.concededOverview?.goalsAgainst || matchStats?.goalsAgainst || 0)
  const scoredSetPieces = setPieceGoalCount(scoredGoalPoints)
  const concededSetPieces = setPieceGoalCount(concededGoalPoints)

  const origem = concededGoalPoints.length
    ? concededGoalTypes.map(i => ({ label:i.label, value:i.value }))
    : conceded ? [
        { label:'Jogo organizado', value:conceded.organizedPlay },
        { label:'Bola parada', value:conceded.setPieces },
        { label:'Contra-ataque', value:conceded.counterAttack },
        { label:'Longa distância', value:conceded.longRange },
      ].sort((a,b) => (b.value||0)-(a.value||0)) : null

  const tempo = timing ? [{ label:'1º tempo', value:timing.firstHalf?.goals }, { label:'2º tempo', value:timing.secondHalf?.goals }] : null
  const faixas = timing?.periods?.map(p => ({ label:p.label, value:p.goals })) || null

  const physLeaders = physical?.leaders || {}
  const physMetrics = physical?.metrics || []
  const physRows = (physical?.rows || []).filter(r => !r.is_gk)
  const insights = makeInsights(col, g, prof, golsLado)
  const priorities = makePriorities(col, g, golsLado)

  const possessionMetric = metricByName(col, 'Posse de bola %')
  const progressiveMetric = metricByName(col, 'Passes progressivos')
  const interceptionMetric = metricByName(col, 'Interceptações')
  const pressureMetric = pressureMetricFrom(col)
  const highRecoveryMetric = metricByName(col, 'Recuperações campo adversário')
  const attentionMetrics = (() => {
    const rows = col.alertas.slice(0, 8)
    if (pressureMetric?.status === 'alerta' && !rows.some(r => r.metric === pressureMetric.metric)) {
      return [...rows.slice(0, 7), pressureMetric]
    }
    return rows
  })()

  const formations = matchStats?.formations?.length ? matchStats.formations : (prof.formations || [])
  const corners = prof.corners || {}
  const exposureTotal = Number(golsLado?.ataques_esquerda || 0) + Number(golsLado?.ataques_centro || 0) + Number(golsLado?.ataques_direita || 0)
  const defenseWonTotal = Number(golsLado?.duelos_def_ganhos_esquerda || 0) + Number(golsLado?.duelos_def_ganhos_centro || 0) + Number(golsLado?.duelos_def_ganhos_direita || 0)
  const aerialSpatialTotal = Number(golsLado?.duelos_aereos_esquerda || 0) + Number(golsLado?.duelos_aereos_centro || 0) + Number(golsLado?.duelos_aereos_direita || 0)
  const goalsCorridorTotal = Number(golsLado?.esquerda || 0) + Number(golsLado?.centro || 0) + Number(golsLado?.direita || 0)
  const scoredGoalsCorridorTotal = Number(golsLado?.marcados_esquerda || 0) + Number(golsLado?.marcados_centro || 0) + Number(golsLado?.marcados_direita || 0)
  const crossesSpatialTotal = Number(golsLado?.cruzamentos_esquerda || 0) + Number(golsLado?.cruzamentos_centro || 0) + Number(golsLado?.cruzamentos_direita || 0)
  const dribblesSpatialTotal = Number(golsLado?.dribles_esquerda || 0) + Number(golsLado?.dribles_centro || 0) + Number(golsLado?.dribles_direita || 0)
  const highRecoveriesSpatialTotal = Number(golsLado?.recuperacoes_altas_esquerda || 0) + Number(golsLado?.recuperacoes_altas_centro || 0) + Number(golsLado?.recuperacoes_altas_direita || 0)
  const hasNineZones = hasNineZone(golsLado?.recuperacoes_zonas) || hasNineZone(golsLado?.perdas_zonas) || hasNineZone(golsLado?.faltas_zonas)

  return <div className="coletivo-document space-y-6">
    {/* PÁGINA 1 - panorama executivo */}
    <section className="coletivo-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={1} totalPages={5} subtitle="Panorama competitivo + últimas 10 partidas" teamReport={teamReport} />

      <div className="mt-4">
        <SectionTitle sub="Posicionamento na Série C + indicadores do relatório de equipe">Identidade coletiva</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <Kpi label="Posse" value={matchStats?.possession != null ? `${fmt(matchStats.possession,1)}%` : (prof.possession?.pct != null ? `${fmt(prof.possession.pct,1)}%` : (possessionMetric?.value || '—'))} sub={matchStats?.possession != null ? `${matchStats.matches} jogos · Wyscout` : rankText(prof.possession?.rank || possessionMetric?.rank, possessionMetric?.total || 20)} />
          <Kpi label="PPDA" value={matchStats?.ppda != null ? fmt(matchStats.ppda,1) : (prof.ppda?.value != null ? fmt(prof.ppda.value,1) : '—')} sub={matchStats?.ppda != null ? `${matchStats.matches} jogos · Wyscout` : rankText(prof.ppda?.rank)} />
          <Kpi label="Gols" value={registeredGoalsScored ? fmt(registeredGoalsScored) : '—'} sub={registeredGoalsScored ? `${rankText(metricByName(col,'Gols')?.rank, metricByName(col,'Gols')?.total) || 'Temporada'} · cadastro de gols` : rankText(metricByName(col,'Gols')?.rank, metricByName(col,'Gols')?.total)} />
          <Kpi label="Chutes/90" value={matchStats?.shots != null ? fmt(matchStats.shots,1) : (prof.shots?.per90 != null ? fmt(prof.shots.per90,1) : '—')} sub={matchStats?.shots != null ? `${matchStats.matches} jogos · por 90` : rankText(prof.shots?.rank)} />
          <Kpi label="Gols sofridos" value={registeredGoalsConceded ? fmt(registeredGoalsConceded) : '—'} sub={registeredGoalsConceded ? 'Cadastro de gols · temporada' : null} tone="rose" />
          <Kpi label="Chutes sofridos/90" value={matchStats?.shotsAgainst != null ? fmt(matchStats.shotsAgainst,1) : (prof.shotsAgainst?.per90 != null ? fmt(prof.shotsAgainst.per90,1) : '—')} sub={matchStats?.shotsAgainst != null ? `${matchStats.matches} jogos · por 90` : rankText(prof.shotsAgainst?.rank)} tone="rose" />
        </div>
      </div>

      {insights.length ? <div className="mt-4">
        <SectionTitle>Leitura executiva</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">{insights.map((item,i) => <Insight key={i} {...item} />)}</div>
      </div> : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Nossas forças na Série C</div>
          <p className="mb-1.5 mt-0.5 text-[8px] text-gray-400">Indicadores no quartil superior da competição.</p>
          {col.forcas.length ? col.forcas.slice(0, 8).map((r,i) => <MetricRow key={i} r={r} />) : <p className="text-[10px] text-gray-400">—</p>}
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-rose-600">Pontos de atenção</div>
          <p className="mb-1.5 mt-0.5 text-[8px] text-gray-400">Quartil inferior + indicadores abaixo da média da Série C. Não mostra só os extremos.</p>
          {attentionMetrics.length ? attentionMetrics.map((r,i) => <MetricRow key={i} r={r} showAverage />) : <p className="text-[10px] text-gray-400">—</p>}
        </div>
      </div>

      <div className="report-footer mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-[7px] font-bold uppercase tracking-widest text-gray-300"><span>Confiança · Centro de Inteligência</span><span>Panorama executivo · 1/5</span></div>
    </section>

    {/* PÁGINA 2 - como estamos sofrendo */}
    <section className="coletivo-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={2} totalPages={5} subtitle="Como estamos sofrendo · origem, volume e espaço" teamReport={teamReport} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 p-3">
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-gray-500">{concededGoalTypes.length || origem ? 'Origem dos gols sofridos' : 'Volume defensivo · últimas partidas'}</div>
          {concededGoalTypes.length ? <><Bars items={concededGoalTypes} tone="rose" showShare /><div className="mt-1 text-[7px] text-gray-400">Origem detalhada cadastrada junto à posição de cada gol.</div></> : (origem ? <Bars items={origem} tone="rose" showShare /> : <div className="grid grid-cols-2 gap-2">
            <ProfileMetric label="Gols sofridos" value={matchStats?.goalsAgainst != null ? fmt(matchStats.goalsAgainst) : fmt(registeredGoalsConceded)} sub={matchStats?.matches ? `Últimos ${matchStats.matches} jogos` : null} tone="rose" />
            <ProfileMetric label="Chutes sofridos/90" value={matchStats?.shotsAgainst != null ? fmt(matchStats.shotsAgainst,1) : '—'} sub={matchStats?.shotsAgainstOnTarget != null ? `${fmt(matchStats.shotsAgainstOnTarget,1)} no alvo/90` : null} tone="rose" />
            <ProfileMetric label="Duelos defensivos/90" value={matchStats?.defensiveDuels != null ? fmt(matchStats.defensiveDuels,1) : '—'} sub={matchStats?.defensiveDuelsSuccess != null ? `${fmt(matchStats.defensiveDuelsSuccess,1)}% ganhos` : null} />
            <ProfileMetric label="xGA médio" value={matchStats?.xga != null ? fmt(matchStats.xga,2) : '—'} sub="Gols esperados contra" tone="rose" />
          </div>)}
        </div>
        <div className="rounded-2xl border border-gray-100 p-3">
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-gray-500">{tempo ? 'Quando sofremos' : 'Estabilidade defensiva · últimas partidas'}</div>
          {tempo ? <><Bars items={tempo} tone="rose" showShare />{faixas?.length ? <div className="mt-3 border-t border-gray-100 pt-3"><Bars items={faixas} tone="rose" /></div> : null}</> : <div className="grid grid-cols-2 gap-2">
            <ProfileMetric label="Jogos sem sofrer" value={matchStats?.cleanSheets != null ? fmt(matchStats.cleanSheets) : '—'} sub={matchStats?.matches ? `de ${matchStats.matches} partidas` : null} />
            <ProfileMetric label="Gols sofridos/jogo" value={matchStats?.goalsAgainstPerGame != null ? fmt(matchStats.goalsAgainstPerGame,2) : '—'} tone="rose" />
            <ProfileMetric label="PPDA" value={matchStats?.ppda != null ? fmt(matchStats.ppda,1) : '—'} sub="Intensidade da pressão" />
            <ProfileMetric label="Recuperações/90" value={matchStats?.recoveries != null ? fmt(matchStats.recoveries,1) : '—'} />
          </div>}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-gray-100 p-3">
        <div className="mb-1 text-[8px] font-black uppercase tracking-widest text-gray-500">Mapa defensivo por corredor</div>
        <div className="mb-3 rounded-lg bg-gray-50 px-2.5 py-2 text-[8px] font-semibold leading-relaxed text-gray-500"><b>Referência = ataque adversário.</b> Esquerda rival = lado direito da nossa defesa. Direita rival = lado esquerdo da nossa defesa.</div>
        {(defenseWonTotal || exposureTotal || aerialSpatialTotal) ? <div className="grid grid-cols-3 gap-3">
          {defenseWonTotal ? <div><div className="mb-1 text-[7px] font-black uppercase tracking-wider text-emerald-600">Duelos defensivos ganhos</div><CorridorBars tone="emerald" items={[{label:'Esq. rival / nossa dir.',value:golsLado.duelos_def_ganhos_esquerda},{label:'Centro',value:golsLado.duelos_def_ganhos_centro},{label:'Dir. rival / nossa esq.',value:golsLado.duelos_def_ganhos_direita}]} /></div> : null}
          {exposureTotal ? <div><div className="mb-1 text-[7px] font-black uppercase tracking-wider text-amber-600">Exposições · duelos perdidos</div><CorridorBars tone="amber" items={[{label:'Esq. rival / nossa dir.',value:golsLado.ataques_esquerda},{label:'Centro',value:golsLado.ataques_centro},{label:'Dir. rival / nossa esq.',value:golsLado.ataques_direita}]} /></div> : null}
          {aerialSpatialTotal ? <div><div className="mb-1 text-[7px] font-black uppercase tracking-wider text-blue-600">Duelos aéreos · localização</div><CorridorBars items={[{label:'Esq. rival / nossa dir.',value:golsLado.duelos_aereos_esquerda},{label:'Centro',value:golsLado.duelos_aereos_centro},{label:'Dir. rival / nossa esq.',value:golsLado.duelos_aereos_direita}]} /></div> : null}
        </div> : <p className="text-[9px] leading-relaxed text-gray-400">Os mapas defensivos serão preenchidos automaticamente ao enviar ou reprocessar o PDF.</p>}
        <div className="mt-2 text-[7px] leading-relaxed text-gray-400">Fonte: DEFESA{golsLado?.source_page ? ` · pág. ${golsLado.source_page}` : ''}.</div>
      </div>

      {goalsCorridorTotal > 0 ? <div className="mt-4 grid grid-cols-[0.9fr_1.1fr] gap-3 rounded-2xl border border-rose-100 bg-rose-50/20 p-3">
        <div>
          <div className="mb-2 text-[8px] font-black uppercase tracking-wider text-rose-500">Gols sofridos · lado do ataque rival</div>
          <CorridorBars tone="rose" items={[{label:'Esq. rival / nossa dir.',value:golsLado.esquerda},{label:'Centro',value:golsLado.centro},{label:'Dir. rival / nossa esq.',value:golsLado.direita}]} />
          {concededGoalTypes.length ? <div className="mt-3 border-t border-rose-100 pt-2"><div className="mb-1 text-[7px] font-black uppercase text-rose-600">Origem detalhada</div><GoalTypeBars points={concededGoalPoints} tone="rose" /></div> : null}
        </div>
        <MiniGoalPitch points={concededGoalPoints} tone="rose" label="Origem dos gols sofridos" />
      </div> : null}

      <div className="report-footer mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-[7px] font-bold uppercase tracking-widest text-gray-300"><span>Confiança · Centro de Inteligência</span><span>Comportamento defensivo · 2/5</span></div>
    </section>

    {/* PÁGINA 3 - fases do jogo e transições */}
    <section className="coletivo-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={3} totalPages={5} subtitle="Diagnóstico por fase do jogo + transições" teamReport={teamReport} />

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3">
          <SectionTitle sub={matchStats?.matches ? `Últimas ${matchStats.matches} partidas · fusão Wyscout + Sportsbase` : null}>Construção e progressão</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <ProfileMetric label="Precisão de passe" value={matchStats?.passAccuracy != null ? `${fmt(matchStats.passAccuracy,1)}%` : (prof.organization?.passAccuracy != null ? `${fmt(prof.organization.passAccuracy,1)}%` : '—')} rank={matchStats?.passAccuracy != null ? null : prof.organization?.rank} />
            <ProfileMetric label="Passes progressivos/90" value={matchStats?.progressivePasses != null ? fmt(matchStats.progressivePasses,1) : (prof.progressivePasses?.per90 != null ? fmt(prof.progressivePasses.per90,1) : (progressiveMetric?.value || '—'))} rank={matchStats?.progressivePasses != null ? null : (prof.progressivePasses?.rank || progressiveMetric?.rank)} sub={matchStats?.progressivePassAccuracy != null ? `${fmt(matchStats.progressivePassAccuracy,1)}% certos` : (prof.progressivePasses?.accuracy != null ? `${fmt(prof.progressivePasses.accuracy,1)}% certos` : null)} tone="emerald" />
            <ProfileMetric label="Terço final/90" value={matchStats?.finalThirdPasses != null ? fmt(matchStats.finalThirdPasses,1) : (prof.finalThirdPasses?.per90 != null ? fmt(prof.finalThirdPasses.per90,1) : '—')} rank={matchStats?.finalThirdPasses != null ? null : prof.finalThirdPasses?.rank} sub={matchStats?.finalThirdPassAccuracy != null ? `${fmt(matchStats.finalThirdPassAccuracy,1)}% certos` : (prof.finalThirdPasses?.accuracy != null ? `${fmt(prof.finalThirdPasses.accuracy,1)}% certos` : null)} />
            <ProfileMetric label="Passes por posse" value={matchStats?.passesPerPossession != null ? fmt(matchStats.passesPerPossession,2) : '—'} sub={matchStats?.passesPerPossession != null ? 'Ritmo da circulação' : null} />
            <ProfileMetric label="Recepções profundas/90" value={matchStats?.deepReceptions != null ? fmt(matchStats.deepReceptions,1) : (prof.deepReceptions?.per90 != null ? fmt(prof.deepReceptions.per90,1) : '—')} rank={matchStats?.deepReceptions != null ? null : prof.deepReceptions?.rank} />
            <ProfileMetric label="Intensidade de jogo" value={matchStats?.intensity != null ? fmt(matchStats.intensity,1) : (prof.organization?.gameIntensity != null ? fmt(prof.organization.gameIntensity,1) : '—')} rank={matchStats?.intensity != null ? null : prof.organization?.rank} sub={matchStats?.intensity != null ? 'Wyscout · média dos jogos' : null} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3">
          <SectionTitle>Pressão e defesa</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <ProfileMetric label="Recuperações/90" value={matchStats?.recoveries != null ? fmt(matchStats.recoveries,1) : (prof.recoveries?.per90 != null ? fmt(prof.recoveries.per90,1) : '—')} rank={matchStats?.recoveries != null ? null : prof.recoveries?.rank} sub={matchStats?.recoveries != null ? 'Últimas partidas · por 90' : null} />
            <ProfileMetric label="Pressão bem-sucedida" value={matchStats?.pressureSuccess != null ? `${fmt(matchStats.pressureSuccess,1)}%` : (pressureMetric?.value || '—')} rank={matchStats?.pressureSuccess != null ? null : pressureMetric?.rank} sub={matchStats?.pressureSuccess != null ? 'Últimas partidas · Sportsbase' : averageGapText(pressureMetric)} tone={matchStats?.pressureSuccess == null && pressureMetric?.status === 'alerta' ? 'rose' : 'gray'} />
            <ProfileMetric label="Recuperações campo adversário/90" value={matchStats?.recoveriesOppHalf != null ? fmt(matchStats.recoveriesOppHalf,1) : (highRecoveryMetric?.value || '—')} rank={matchStats?.recoveriesOppHalf != null ? null : highRecoveryMetric?.rank} sub={matchStats?.recoveriesOppHalf != null ? 'Últimas partidas · por 90' : averageGapText(highRecoveryMetric)} tone={matchStats?.recoveriesOppHalf == null && highRecoveryMetric?.status === 'alerta' ? 'rose' : 'gray'} />
            <ProfileMetric label="Interceptações/90" value={matchStats?.interceptions != null ? fmt(matchStats.interceptions,1) : (prof.interceptions?.per90 != null ? fmt(prof.interceptions.per90,1) : (interceptionMetric?.value || '—'))} rank={matchStats?.interceptions != null ? null : (prof.interceptions?.rank || interceptionMetric?.rank)} />
            <ProfileMetric label="PPDA" value={matchStats?.ppda != null ? fmt(matchStats.ppda,1) : (prof.ppda?.value != null ? fmt(prof.ppda.value,1) : '—')} rank={matchStats?.ppda != null ? null : prof.ppda?.rank} sub={matchStats?.ppda != null ? 'Wyscout · média dos jogos' : null} />
            <ProfileMetric label="Duelos defensivos/90" value={matchStats?.defensiveDuels != null ? fmt(matchStats.defensiveDuels,1) : (prof.defensiveDuels?.per90 != null ? fmt(prof.defensiveDuels.per90,1) : '—')} rank={matchStats?.defensiveDuels != null ? null : prof.defensiveDuels?.rank} sub={matchStats?.defensiveDuelsSuccess != null ? `${fmt(matchStats.defensiveDuelsSuccess,1)}% ganhos` : (prof.defensiveDuels?.success != null ? `${fmt(prof.defensiveDuels.success,1)}% ganhos` : null)} />
            <ProfileMetric label="Duelos aéreos/90" value={matchStats?.aerialDuels != null ? fmt(matchStats.aerialDuels,1) : (prof.aerialDuels?.per90 != null ? fmt(prof.aerialDuels.per90,1) : '—')} rank={matchStats?.aerialDuels != null ? null : prof.aerialDuels?.rank} sub={matchStats?.aerialDuelsSuccess != null ? `${fmt(matchStats.aerialDuelsSuccess,1)}% ganhos` : (prof.aerialDuels?.success != null ? `${fmt(prof.aerialDuels.success,1)}% ganhos` : null)} />
            <ProfileMetric label="Chutes bloqueados/90" value={matchStats?.blockedShots != null ? fmt(matchStats.blockedShots,1) : (prof.blockedShots?.per90 != null ? fmt(prof.blockedShots.per90,1) : '—')} rank={matchStats?.blockedShots != null ? null : prof.blockedShots?.rank} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3">
          <SectionTitle>Ataque e presença</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <ProfileMetric label="Chutes/90" value={matchStats?.shots != null ? fmt(matchStats.shots,1) : (prof.shots?.per90 != null ? fmt(prof.shots.per90,1) : '—')} rank={matchStats?.shots != null ? null : prof.shots?.rank} sub={matchStats?.shotsOnTarget != null ? `${fmt(matchStats.shotsOnTarget,1)} no alvo/90` : (prof.shots?.xgPerShot != null ? `xG/chute ${fmt(prof.shots.xgPerShot,2)}` : null)} />
            <ProfileMetric label="Toques na área/90" value={matchStats?.boxTouches != null ? fmt(matchStats.boxTouches,1) : (prof.boxTouches?.per90 != null ? fmt(prof.boxTouches.per90,1) : '—')} rank={matchStats?.boxTouches != null ? null : prof.boxTouches?.rank} />
            <ProfileMetric label="Dribles/90" value={matchStats?.dribbles != null ? fmt(matchStats.dribbles,1) : (prof.dribbles?.per90 != null ? fmt(prof.dribbles.per90,1) : '—')} rank={matchStats?.dribbles != null ? null : prof.dribbles?.rank} sub={matchStats?.dribblesSuccess != null ? `${fmt(matchStats.dribblesSuccess,1)}% sucesso` : (prof.dribbles?.success != null ? `${fmt(prof.dribbles.success,1)}% sucesso` : null)} />
            <ProfileMetric label="Cruzamentos/90" value={matchStats?.crosses != null ? fmt(matchStats.crosses,1) : (prof.crosses?.per90 != null ? fmt(prof.crosses.per90,1) : '—')} rank={matchStats?.crosses != null ? null : prof.crosses?.rank} sub={matchStats?.crossesAccuracy != null ? `${fmt(matchStats.crossesAccuracy,1)}% certos` : (prof.crosses?.accuracy != null ? `${fmt(prof.crosses.accuracy,1)}% certos` : null)} />
            <ProfileMetric label="Duelos ofensivos/90" value={matchStats?.offensiveDuels != null ? fmt(matchStats.offensiveDuels,1) : (prof.offensiveDuels?.per90 != null ? fmt(prof.offensiveDuels.per90,1) : '—')} rank={matchStats?.offensiveDuels != null ? null : prof.offensiveDuels?.rank} sub={matchStats?.offensiveDuelsSuccess != null ? `${fmt(matchStats.offensiveDuelsSuccess,1)}% ganhos` : (prof.offensiveDuels?.success != null ? `${fmt(prof.offensiveDuels.success,1)}% ganhos` : null)} />
            <ProfileMetric label="Gols marcados" value={registeredGoalsScored ? fmt(registeredGoalsScored) : '—'} rank={metricByName(col,'Gols')?.rank} sub="Total da temporada" />
          </div>
        </div>
      </div>

      {(hasNineZones || prof.recoveries || prof.losses) ? <div className="mt-4">
        <SectionTitle sub={hasNineZones ? `Matriz 3x3 automática do PDF${golsLado?.source_page_transicoes ? ` · pág. ${golsLado.source_page_transicoes}` : ''}` : 'Distribuição territorial das ações'}>Transições e território</SectionTitle>
        {hasNineZones ? <div className="grid grid-cols-3 gap-3">
          <NineZoneCompact title="Recuperações da posse" data={golsLado.recuperacoes_zonas} tone="emerald" />
          <NineZoneCompact title="Perdas da posse" data={golsLado.perdas_zonas} tone="rose" />
          <NineZoneCompact title="Faltas cometidas" data={golsLado.faltas_zonas} tone="amber" />
        </div> : <div className="grid grid-cols-2 gap-3"><ThirdDistribution title="Recuperações da posse" data={prof.recoveries} tone="emerald" /><ThirdDistribution title="Perdas da posse" data={prof.losses} tone="rose" /></div>}
      </div> : null}

      <div className="report-footer mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-[7px] font-bold uppercase tracking-widest text-gray-300"><span>Confiança · Centro de Inteligência</span><span>Fases + transições · 3/5</span></div>
    </section>

    {/* PÁGINA 4 - leitura ofensiva espacial */}
    <section className="coletivo-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={4} totalPages={5} subtitle="Leitura espacial ofensiva + estruturas" teamReport={teamReport} />

      {(crossesSpatialTotal || dribblesSpatialTotal || highRecoveriesSpatialTotal) ? <div className="mt-4">
        <SectionTitle sub="Eventos disponíveis na página ATAQUE do Wyscout">Leitura ofensiva automática</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {crossesSpatialTotal ? <div className="rounded-2xl border border-gray-100 p-3"><div className="mb-2 text-[8px] font-black uppercase tracking-widest text-emerald-600">Cruzamentos</div><CorridorBars tone="emerald" items={[{label:'Esquerda',value:golsLado.cruzamentos_esquerda},{label:'Centro',value:golsLado.cruzamentos_centro},{label:'Direita',value:golsLado.cruzamentos_direita}]} /><div className="mt-1 text-[7px] text-gray-400">n={golsLado.amostra_cruzamentos || crossesSpatialTotal}</div></div> : null}
          {dribblesSpatialTotal ? <div className="rounded-2xl border border-gray-100 p-3"><div className="mb-2 text-[8px] font-black uppercase tracking-widest text-emerald-600">Dribles no último terço</div><CorridorBars tone="emerald" items={[{label:'Esquerda',value:golsLado.dribles_esquerda},{label:'Centro',value:golsLado.dribles_centro},{label:'Direita',value:golsLado.dribles_direita}]} /><div className="mt-1 text-[7px] text-gray-400">n={golsLado.amostra_dribles || dribblesSpatialTotal}</div></div> : null}
          {highRecoveriesSpatialTotal ? <div className="rounded-2xl border border-gray-100 p-3"><div className="mb-2 text-[8px] font-black uppercase tracking-widest text-amber-600">Recuperações no último terço</div><CorridorBars tone="amber" items={[{label:'Esquerda',value:golsLado.recuperacoes_altas_esquerda},{label:'Centro',value:golsLado.recuperacoes_altas_centro},{label:'Direita',value:golsLado.recuperacoes_altas_direita}]} /><div className="mt-1 text-[7px] text-gray-400">Pressão alta · n={golsLado.amostra_recuperacoes_altas || highRecoveriesSpatialTotal}</div></div> : null}
        </div>
      </div> : null}

      {scoredGoalsCorridorTotal ? <div className="mt-4 grid grid-cols-[0.9fr_1.1fr] gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/20 p-3">
        <div>
          <div className="mb-2 text-[8px] font-black uppercase tracking-widest text-emerald-700">Gols marcados · posição + origem</div>
          <CorridorBars tone="emerald" items={[{label:'Esquerda do nosso ataque',value:golsLado.marcados_esquerda},{label:'Centro',value:golsLado.marcados_centro},{label:'Direita do nosso ataque',value:golsLado.marcados_direita}]} />
          {scoredGoalTypes.length ? <div className="mt-3 border-t border-emerald-100 pt-2"><div className="mb-1 text-[7px] font-black uppercase text-emerald-700">Origem dos gols marcados</div><GoalTypeBars points={scoredGoalPoints} tone="emerald" /></div> : null}
        </div>
        <MiniGoalPitch points={scoredGoalPoints} tone="emerald" label="Origem dos gols marcados" />
      </div> : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 p-3">
          <SectionTitle>Estruturas mais utilizadas</SectionTitle>
          {formations.length ? <div className="grid grid-cols-3 gap-2">{formations.slice(0,3).map((f,i) => <div key={i} className="rounded-xl bg-gray-50 p-3 text-center"><div className="text-lg font-black bc text-gray-800">{f.formation || f.sistema}</div><div className="text-[9px] font-black text-emerald-700">{fmt(f.share ?? f.percentual,0)}%</div><div className="mt-0.5 text-[7px] font-bold text-gray-400">{f.matches ?? f.jogos ?? ''}{(f.matches ?? f.jogos) ? ' jogo(s)' : ''}</div></div>)}</div> : null}
        </div>
        <div className="rounded-2xl border border-gray-100 p-3">
          <SectionTitle>Bolas paradas</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <ProfileMetric
              label={(scoredGoalPoints.length || matchStats?.setPieceGoals != null) ? 'Gols em bola parada' : 'Bolas paradas/90'}
              value={scoredGoalPoints.length ? fmt(scoredSetPieces) : (matchStats?.setPieceGoals != null ? fmt(matchStats.setPieceGoals) : (matchStats?.setPieces != null ? fmt(matchStats.setPieces,1) : '—'))}
              sub={scoredGoalPoints.length ? `${Math.round(scoredSetPieces / Math.max(1, registeredGoalsScored) * 100)}% dos ${registeredGoalsScored} gols` : (matchStats?.setPieceGoals != null ? 'Sportsbase · jogos analisados' : 'Wyscout · volume por 90')}
            />
            <ProfileMetric
              label={(concededGoalPoints.length || matchStats?.setPieceGoalsAgainst != null) ? 'Gols sofridos em bola parada' : 'Bolas paradas rivais/90'}
              value={concededGoalPoints.length ? fmt(concededSetPieces) : (matchStats?.setPieceGoalsAgainst != null ? fmt(matchStats.setPieceGoalsAgainst) : (matchStats?.setPiecesAgainst != null ? fmt(matchStats.setPiecesAgainst,1) : '—'))}
              sub={concededGoalPoints.length ? `${Math.round(concededSetPieces / Math.max(1, registeredGoalsConceded) * 100)}% dos ${registeredGoalsConceded} sofridos` : (matchStats?.setPieceGoalsAgainst != null ? 'Sportsbase · jogos analisados' : 'Wyscout · volume rival por 90')}
              tone="rose"
            />
            <ProfileMetric label="Cantos/90" value={matchStats?.corners != null ? fmt(matchStats.corners,1) : (corners.total?.total != null ? fmt(corners.total.total) : '—')} sub={matchStats?.corners != null ? 'Últimas partidas' : (corners.total?.xg != null ? `xG ${fmt(corners.total.xg,2)}` : null)} />
            <ProfileMetric label="Cantos com remate/90" value={matchStats?.cornersShots != null ? fmt(matchStats.cornersShots,1) : (corners.short?.total != null ? fmt(corners.short.total) : '—')} sub={matchStats?.cornersShots != null ? 'Wyscout Team Stats' : (corners.short?.xg != null ? `xG ${fmt(corners.short.xg,2)}` : null)} />
          </div>
        </div>
      </div>

      <div className="mt-2 text-[7px] leading-relaxed text-gray-400">A leitura ofensiva automática separa exatamente os eventos disponíveis no PDF e não mistura esses mapas com o conceito de “todos os ataques”.</div>
      <div className="report-footer mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-[7px] font-bold uppercase tracking-widest text-gray-300"><span>Confiança · Centro de Inteligência</span><span>Leitura ofensiva · 4/5</span></div>
    </section>

    {/* PÁGINA 5 - físico e prioridades */}
    <section className="coletivo-page mx-auto flex w-full max-w-[900px] flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <PageHeader page={5} totalPages={5} subtitle="Motor físico + prioridades para a comissão" teamReport={teamReport} />

      {physical?.rows?.length ? <div className="mt-4">
        <SectionTitle sub="Média por jogo · ranking interno do elenco">Motor físico</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {physMetrics.filter(gm => physLeaders[gm.key]).map(gm => {
            const L = physLeaders[gm.key]
            const avg = average(physRows, gm.field)
            return <div key={gm.key} className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="text-[7px] font-black uppercase tracking-wider text-gray-400 leading-tight">{gm.label}</div>
              <div className="mt-1 truncate text-[12px] font-black bc text-gray-800">{L.nome}</div>
              <div className="text-sm font-black text-emerald-700">{gm.key === 'vel_max' ? fmt(L.value,1) : fmt(Math.round(L.value))}</div>
              {avg != null ? <div className="mt-0.5 text-[8px] font-bold text-gray-400">média elenco {gm.key === 'vel_max' ? fmt(avg,1) : fmt(Math.round(avg))}</div> : null}
            </div>
          })}
        </div>
      </div> : null}

      {(scoredGoalTypes.length || concededGoalTypes.length) ? <div className="mt-4 rounded-2xl border border-gray-100 p-3">
        <SectionTitle>Origem detalhada dos gols</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div><div className="mb-1 text-[7px] font-black uppercase text-emerald-700">Marcados</div><GoalTypeBars points={scoredGoalPoints} tone="emerald" /></div>
          <div><div className="mb-1 text-[7px] font-black uppercase text-rose-600">Sofridos</div><GoalTypeBars points={concededGoalPoints} tone="rose" /></div>
        </div>
      </div> : null}

      {priorities.length ? <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
        <SectionTitle sub="Síntese objetiva para reunião com a comissão">Prioridades sugeridas</SectionTitle>
        <div className="space-y-2">{priorities.map((p,i) => <div key={i} className="flex gap-2"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[8px] font-black text-amber-700">{i+1}</span><div><div className="text-[9px] font-black text-gray-700">{p.title}</div><div className="text-[8px] leading-relaxed text-gray-500">{p.text}</div></div></div>)}</div>
      </div> : null}

      <div className="report-footer mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-[7px] font-bold uppercase tracking-widest text-gray-300"><span>Confiança · Centro de Inteligência</span><span>Síntese operacional · 5/5</span></div>
    </section>
  </div>
}
