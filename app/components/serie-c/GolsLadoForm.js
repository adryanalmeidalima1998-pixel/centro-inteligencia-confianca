'use client'
import { useEffect, useMemo, useState } from 'react'
import { FileSearch, Loader2, RefreshCcw, Save, RotateCcw, Trash2, Target, ShieldAlert, ShieldCheck, MapPinned } from 'lucide-react'
import { extractTeamReportSpatial } from '../../../lib/serieCTeamReportSpatial'

const GOAL_TYPES = [
  { value:'jogo_organizado', label:'Jogo organizado' },
  { value:'contra_ataque', label:'Contra-ataque' },
  { value:'escanteio', label:'Escanteio' },
  { value:'falta_lateral', label:'Falta lateral' },
  { value:'falta_direta', label:'Falta direta' },
  { value:'penalti', label:'Pênalti' },
  { value:'outro', label:'Outro' },
]
const GOAL_LABEL = Object.fromEntries([{value:'nao_informado',label:'Não informado'}, ...GOAL_TYPES].map(x => [x.value,x.label]))

function pct(value, total) { return total ? Math.round(Number(value || 0) / total * 100) : 0 }
function total3(a,b,c) { return Number(a||0)+Number(b||0)+Number(c||0) }

function Corridor({ label, value, total, tone='amber' }) {
  const share = pct(value, total)
  const color = tone === 'rose' ? 'bg-rose-400 text-rose-600' : tone === 'emerald' ? 'bg-emerald-500 text-emerald-700' : tone === 'blue' ? 'bg-blue-400 text-blue-600' : 'bg-amber-400 text-amber-600'
  const [barClass, textClass] = color.split(' ')
  return <div className="rounded-xl border border-gray-100 bg-white p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</span>
      <span className={`bc text-lg font-black ${textClass}`}>{value || 0}</span>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${barClass}`} style={{ width:`${share}%` }} /></div>
    <div className="mt-1 text-right text-[8px] font-bold text-gray-400">{share}%</div>
  </div>
}

function CorridorSet({ title, left, center, right, tone='amber', note }) {
  const total = total3(left,center,right)
  if (!total) return null
  return <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-3">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[8px] font-black uppercase tracking-widest text-gray-600">{title}</div>
      <div className="text-[8px] font-black text-gray-400">n={total}</div>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-2">
      <Corridor label="Esquerda" value={left} total={total} tone={tone} />
      <Corridor label="Centro" value={center} total={total} tone={tone} />
      <Corridor label="Direita" value={right} total={total} tone={tone} />
    </div>
    {note ? <div className="mt-2 text-[8px] leading-relaxed text-gray-400">{note}</div> : null}
  </div>
}

function hasNineZone(data) {
  return ['esquerda','centro','direita'].some(row => ['defensivo','medio','ofensivo'].some(col => Number.isFinite(Number(data?.pct?.[row]?.[col]))))
}

function NineZoneGrid({ title, data, tone='emerald', note }) {
  if (!hasNineZone(data)) return null
  const rows = [['esquerda','Esquerda'],['centro','Centro'],['direita','Direita']]
  const cols = [['defensivo','Terço defensivo'],['medio','Terço médio'],['ofensivo','Terço ofensivo']]
  const cells=[]
  rows.forEach(([rk,rl]) => cols.forEach(([ck,cl]) => {
    const value=Number(data?.pct?.[rk]?.[ck])
    if (Number.isFinite(value)) cells.push({rk,ck,rl,cl,value})
  }))
  const max=Math.max(1,...cells.map(c=>c.value))
  const dominant=[...cells].sort((a,b)=>b.value-a.value)[0]
  const bg = tone === 'rose' ? 'bg-rose-50' : tone === 'amber' ? 'bg-amber-50' : 'bg-emerald-50'
  const text = tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-700' : 'text-emerald-700'
  return <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-3">
    <div className="text-[8px] font-black uppercase tracking-widest text-gray-600">{title}</div>
    <div className="mt-2 grid grid-cols-[62px_repeat(3,1fr)] gap-1">
      <div />
      {cols.map(([,label]) => <div key={label} className="px-1 text-center text-[7px] font-black uppercase leading-tight text-gray-400">{label.replace('Terço ','')}</div>)}
      {rows.map(([rk,label]) => <div key={rk} className="contents">
        <div className="flex items-center text-[7px] font-black uppercase text-gray-400">{label}</div>
        {cols.map(([ck]) => {
          const value=Number(data?.pct?.[rk]?.[ck])
          const p90=Number(data?.per90?.[rk]?.[ck])
          const width=Number.isFinite(value) ? Math.max(8, Math.round(value/max*100)) : 0
          return <div key={`${rk}-${ck}`} className={`relative overflow-hidden rounded-lg border border-white/70 ${bg} p-2 text-center`}>
            <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20" style={{width:`${width}%`}} />
            <div className={`bc text-sm font-black ${text}`}>{Number.isFinite(value) ? `${value.toLocaleString('pt-BR',{maximumFractionDigits:1})}%` : '—'}</div>
            <div className="text-[7px] font-bold text-gray-400">{Number.isFinite(p90) ? `${p90.toLocaleString('pt-BR',{maximumFractionDigits:1})}/90` : ''}</div>
          </div>
        })}
      </div>)}
    </div>
    {dominant ? <div className="mt-2 text-[8px] font-bold text-gray-500">Maior concentração: <span className="font-black text-gray-700">{dominant.rl} · {dominant.cl.toLowerCase()}</span> ({dominant.value.toLocaleString('pt-BR',{maximumFractionDigits:1})}%).</div> : null}
    {note ? <div className="mt-1 text-[7px] text-gray-400">{note}</div> : null}
  </div>
}

function classify(points) {
  let esquerda=0, centro=0, direita=0
  for (const p of points || []) {
    if (Number(p.x) < 33.333) esquerda += 1
    else if (Number(p.x) < 66.667) centro += 1
    else direita += 1
  }
  return { esquerda, centro, direita, total:esquerda+centro+direita }
}

function PitchLines() {
  return <svg viewBox="0 0 100 72" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
    <rect x="1" y="1" width="98" height="70" rx="2" fill="#ecfdf5" stroke="#6ee7b7" strokeWidth="1" />
    <line x1="33.33" y1="1" x2="33.33" y2="71" stroke="#d1fae5" strokeDasharray="2 2" />
    <line x1="66.67" y1="1" x2="66.67" y2="71" stroke="#d1fae5" strokeDasharray="2 2" />
    <rect x="28" y="1" width="44" height="20" fill="none" stroke="#a7f3d0" strokeWidth="1" />
    <rect x="39" y="1" width="22" height="8" fill="none" stroke="#a7f3d0" strokeWidth="1" />
    <path d="M41 21 A12 12 0 0 0 59 21" fill="none" stroke="#a7f3d0" strokeWidth="1" />
    <circle cx="50" cy="15" r="1" fill="#6ee7b7" />
    <rect x="43" y="0" width="14" height="2" fill="none" stroke="#34d399" strokeWidth="1" />
  </svg>
}

function GoalTypeSummary({ points }) {
  const counts = useMemo(() => {
    const map={}
    for (const p of points || []) map[p.tipo || 'nao_informado']=(map[p.tipo || 'nao_informado']||0)+1
    return map
  },[points])
  const entries=Object.entries(counts).filter(([,n])=>n>0)
  if (!entries.length) return null
  return <div className="mt-2 flex flex-wrap gap-1">
    {entries.map(([type,n]) => <span key={type} className="rounded-full bg-gray-50 px-2 py-1 text-[7px] font-black uppercase text-gray-500">{GOAL_LABEL[type] || type}: {n}</span>)}
  </div>
}

function GoalPitch({ title, subtitle, points, onChange, tone='rose' }) {
  const counts = useMemo(() => classify(points), [points])
  const [nextType,setNextType] = useState('jogo_organizado')
  const dot = tone === 'emerald' ? 'bg-emerald-600 ring-emerald-200' : 'bg-rose-500 ring-rose-200'
  function addPoint(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    onChange([...(points || []), { id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`, x:Number(x.toFixed(2)), y:Number(y.toFixed(2)), tipo:nextType }])
  }
  function updateType(id,tipo) { onChange((points || []).map(p => (p.id===id ? {...p,tipo} : p))) }
  function removePoint(id) { onChange((points || []).filter(p => p.id!==id)) }
  return <div className="rounded-2xl border border-gray-100 bg-white p-3">
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-[9px] font-black uppercase tracking-widest text-gray-600">{title}</div><div className="mt-0.5 text-[8px] text-gray-400">{subtitle}</div></div>
      <div className="text-[9px] font-black text-gray-500">{counts.total} gol(s)</div>
    </div>

    <div className="mt-3">
      <div className="mb-1 text-[7px] font-black uppercase tracking-wider text-gray-400">Tipo do próximo gol</div>
      <div className="flex flex-wrap gap-1">
        {GOAL_TYPES.map(opt => <button key={opt.value} type="button" onClick={() => setNextType(opt.value)} className={`rounded-full border px-2 py-1 text-[7px] font-black uppercase transition ${nextType===opt.value ? (tone==='emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-600') : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>{opt.label}</button>)}
      </div>
    </div>

    <button type="button" onClick={addPoint} className="relative mt-3 block aspect-[100/72] w-full overflow-hidden rounded-xl text-left cursor-crosshair" title={`Clique no local da finalização · ${GOAL_LABEL[nextType]}`}>
      <PitchLines />
      <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded-b-md bg-white/80 px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-gray-400">Gol ↑</div>
      {(points || []).map((p,i) => <span key={p.id || i} className={`pointer-events-none absolute grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[6px] font-black text-white ring-2 ${dot}`} style={{ left:`${p.x}%`, top:`${p.y}%` }}>{i+1}</span>)}
    </button>
    <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[8px] font-bold text-gray-500"><span>E {counts.esquerda}</span><span>C {counts.centro}</span><span>D {counts.direita}</span></div>
    <GoalTypeSummary points={points} />

    {(points || []).length ? <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-lg bg-gray-50 p-2">
      {(points || []).map((p,i) => <div key={p.id || i} className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[7px] font-black text-gray-400">Gol {i+1}</span>
        <select value={p.tipo || 'nao_informado'} onChange={e => updateType(p.id,e.target.value)} className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[8px] font-bold text-gray-600">
          <option value="nao_informado">Não informado</option>
          {GOAL_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button type="button" onClick={() => removePoint(p.id)} className="rounded-md p-1 text-gray-300 hover:bg-rose-50 hover:text-rose-500" title="Excluir este gol"><Trash2 className="h-3 w-3" /></button>
      </div>)}
    </div> : null}

    <div className="mt-2 flex gap-2">
      <button type="button" onClick={() => onChange((points || []).slice(0,-1))} disabled={!points?.length} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[8px] font-black uppercase text-gray-500 disabled:opacity-30"><RotateCcw className="h-3 w-3" />Desfazer</button>
      <button type="button" onClick={() => onChange([])} disabled={!points?.length} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-100 px-2 py-1.5 text-[8px] font-black uppercase text-rose-500 disabled:opacity-30"><Trash2 className="h-3 w-3" />Limpar</button>
    </div>
  </div>
}

export default function GolsLadoForm({ season, competition }) {
  const [registro, setRegistro] = useState(null)
  const [latest, setLatest] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingGoals, setSavingGoals] = useState(false)
  const [scoredPoints, setScoredPoints] = useState([])
  const [concededPoints, setConcededPoints] = useState([])

  const load = async () => {
    const qs = new URLSearchParams()
    if (season) qs.set('season', season)
    if (competition) qs.set('competition', competition)
    try {
      const [corridorRes, reportRes] = await Promise.all([
        fetch('/api/serie-c/gols-lado'),
        fetch(`/api/serie-c/team-report${qs.toString() ? `?${qs}` : ''}`),
      ])
      const corridor = await corridorRes.json()
      const report = await reportRes.json()
      const reg = corridor?.registro || null
      setRegistro(reg)
      setScoredPoints(Array.isArray(reg?.gols_marcados_pontos) ? reg.gols_marcados_pontos : [])
      setConcededPoints(Array.isArray(reg?.gols_sofridos_pontos) ? reg.gols_sofridos_pontos : [])
      setLatest(report?.latest || null)
    } catch (_) {}
  }

  useEffect(() => {
    load()
    const refresh = () => load()
    window.addEventListener('serie-c-corridor-updated', refresh)
    return () => window.removeEventListener('serie-c-corridor-updated', refresh)
  }, [season, competition])

  async function reprocessar() {
    if (!latest?.sourceUrl || !latest?.round) return setStatus({ type:'error', message:'Não encontrei um PDF de equipe salvo para reprocessar.' })
    setLoading(true); setStatus(null)
    try {
      const response = await fetch(latest.sourceUrl)
      if (!response.ok) throw new Error('Não consegui abrir o PDF salvo.')
      const blob = await response.blob()
      const spatial = await extractTeamReportSpatial(blob)
      const save = await fetch('/api/serie-c/gols-lado', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ rodada:Number(latest.round), ...spatial }) })
      const json = await save.json()
      if (!save.ok || json?.error) throw new Error(json?.error || 'Falha ao salvar a leitura automática.')
      setRegistro(json.registro)
      const parts=[]
      if (spatial.amostra_duelos_def_ganhos) parts.push(`${spatial.amostra_duelos_def_ganhos} duelos defensivos ganhos`)
      if (spatial.amostra_ataques) parts.push(`${spatial.amostra_ataques} exposições defensivas`)
      if (spatial.amostra_duelos_aereos) parts.push(`${spatial.amostra_duelos_aereos} duelos aéreos`)
      if (spatial.recuperacoes_zonas) parts.push('recuperações em 9 zonas')
      if (spatial.perdas_zonas) parts.push('perdas em 9 zonas')
      if (spatial.faltas_zonas) parts.push('faltas em 9 zonas')
      if (spatial.amostra_cruzamentos) parts.push(`${spatial.amostra_cruzamentos} cruzamentos`)
      if (spatial.amostra_dribles) parts.push(`${spatial.amostra_dribles} dribles no último terço`)
      if (spatial.amostra_recuperacoes_altas) parts.push(`${spatial.amostra_recuperacoes_altas} recuperações altas`)
      setStatus({ type:'ok', message:`Leitura espacial refeita: ${parts.join(' · ')}.` })
    } catch (error) { setStatus({ type:'error', message:error.message || 'Falha ao reprocessar o PDF.' }) }
    finally { setLoading(false) }
  }

  async function saveGoalPositions() {
    if (!latest?.round) return setStatus({ type:'error', message:'Envie primeiro o PDF de equipe para vincular as posições à rodada atual.' })
    setSavingGoals(true); setStatus(null)
    try {
      const save = await fetch('/api/serie-c/gols-lado', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ rodada:Number(latest.round), gols_marcados_pontos:scoredPoints, gols_sofridos_pontos:concededPoints }) })
      const json = await save.json()
      if (!save.ok || json?.error) throw new Error(json?.error || 'Falha ao salvar posições dos gols.')
      setRegistro(json.registro)
      setStatus({ type:'ok', message:`Gols salvos: ${scoredPoints.length} marcados e ${concededPoints.length} sofridos, com posição e origem/tipo de cada gol.` })
      window.dispatchEvent(new CustomEvent('serie-c-corridor-updated'))
    } catch (error) { setStatus({ type:'error', message:error.message || 'Falha ao salvar.' }) }
    finally { setSavingGoals(false) }
  }

  const defenseTotal = total3(registro?.ataques_esquerda, registro?.ataques_centro, registro?.ataques_direita)
  const defenseWonTotal = total3(registro?.duelos_def_ganhos_esquerda, registro?.duelos_def_ganhos_centro, registro?.duelos_def_ganhos_direita)
  const aerialTotal = total3(registro?.duelos_aereos_esquerda, registro?.duelos_aereos_centro, registro?.duelos_aereos_direita)
  const crossesTotal = total3(registro?.cruzamentos_esquerda, registro?.cruzamentos_centro, registro?.cruzamentos_direita)
  const dribblesTotal = total3(registro?.dribles_esquerda, registro?.dribles_centro, registro?.dribles_direita)
  const highRecTotal = total3(registro?.recuperacoes_altas_esquerda, registro?.recuperacoes_altas_centro, registro?.recuperacoes_altas_direita)
  const hasTransition = hasNineZone(registro?.recuperacoes_zonas) || hasNineZone(registro?.perdas_zonas) || hasNineZone(registro?.faltas_zonas)

  return <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FileSearch className="h-4 w-4" /></span>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Leitura espacial · automática + gols manuais</p>
          <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-gray-400">O PDF alimenta automaticamente as ações defensivas, transições e ações ofensivas. Você marca manualmente apenas a <b>posição e o tipo/origem dos gols</b>.</p>
        </div>
      </div>
      <button type="button" onClick={reprocessar} disabled={loading || !latest?.sourceUrl} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-amber-700 disabled:opacity-40">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} Reprocessar PDF</button>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-600" /><div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Leitura defensiva automática</div></div>
          <div className="mt-1 text-[8px] font-semibold leading-relaxed text-gray-400"><b>Referência = ataque adversário.</b> Esquerda rival = direita da nossa defesa; direita rival = esquerda da nossa defesa.</div>
        </div>
        {defenseWonTotal || defenseTotal || aerialTotal ? <div className="space-y-2">
          <CorridorSet title="Duelos defensivos ganhos · lado do ataque rival" left={registro.duelos_def_ganhos_esquerda} center={registro.duelos_def_ganhos_centro} right={registro.duelos_def_ganhos_direita} tone="emerald" />
          <CorridorSet title="Exposições · duelos perdidos · lado do ataque rival" left={registro.ataques_esquerda} center={registro.ataques_centro} right={registro.ataques_direita} tone="amber" />
          <CorridorSet title="Duelos aéreos · lado do ataque rival" left={registro.duelos_aereos_esquerda} center={registro.duelos_aereos_centro} right={registro.duelos_aereos_direita} tone="blue" note={`Fonte: página DEFESA${registro?.source_page ? ` · pág. ${registro.source_page}` : ''}. Esquerda rival = direita defensiva do Confiança. No mapa aéreo, vitória/derrota continua sendo tratada pelas métricas da tabela.`} />
        </div> : <div className="rounded-xl border border-dashed border-gray-200 p-4 text-[9px] text-gray-400">Reprocesse o PDF para gerar os três mapas defensivos.</div>}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2"><Target className="h-4 w-4 text-emerald-600" /><div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Leitura ofensiva automática</div></div>
        {crossesTotal || dribblesTotal || highRecTotal ? <div className="space-y-2">
          <CorridorSet title="Cruzamentos" left={registro.cruzamentos_esquerda} center={registro.cruzamentos_centro} right={registro.cruzamentos_direita} tone="emerald" />
          <CorridorSet title="Dribles bem-sucedidos no último terço" left={registro.dribles_esquerda} center={registro.dribles_centro} right={registro.dribles_direita} tone="emerald" />
          <CorridorSet title="Recuperações no último terço" left={registro.recuperacoes_altas_esquerda} center={registro.recuperacoes_altas_centro} right={registro.recuperacoes_altas_direita} tone="amber" note={`Pressão alta/território · fonte: página ATAQUE${registro?.source_page_ofensiva ? ` · pág. ${registro.source_page_ofensiva}` : ''}.`} />
        </div> : <div className="rounded-xl border border-dashed border-gray-200 p-4 text-[9px] text-gray-400">Reprocesse o PDF para gerar os mapas ofensivos por corredor.</div>}
      </div>
    </div>

    <div className="border-t border-gray-100 pt-4">
      <div className="mb-3 flex items-center gap-2"><MapPinned className="h-4 w-4 text-blue-600" /><div><div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Transições e zonas de risco · automático</div><div className="text-[8px] text-gray-400">Matriz 3x3 da página TRANSIÇÕES: lado do campo × terço do campo. Percentual do volume e média /90.</div></div></div>
      {hasTransition ? <div className="grid gap-3 lg:grid-cols-3">
        <NineZoneGrid title="Recuperações da posse" data={registro.recuperacoes_zonas} tone="emerald" />
        <NineZoneGrid title="Perdas da posse" data={registro.perdas_zonas} tone="rose" />
        <NineZoneGrid title="Faltas cometidas" data={registro.faltas_zonas} tone="amber" note={registro?.source_page_transicoes ? `Fonte: pág. ${registro.source_page_transicoes}.` : null} />
      </div> : <div className="rounded-xl border border-dashed border-gray-200 p-4 text-[9px] text-gray-400">Reprocesse o PDF para gerar recuperações, perdas e faltas em 9 zonas.</div>}
    </div>

    <div className="border-t border-gray-100 pt-5">
      <div className="mb-3 flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-gray-500" /><div><div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Posição + origem dos gols · cadastro manual rápido</div><div className="mt-1 text-[9px] text-gray-400">Antes de clicar no campo, selecione o tipo do gol: <b>jogo organizado, contra-ataque, escanteio, falta lateral, falta direta, pênalti ou outro</b>. Depois você ainda pode editar o tipo de qualquer gol na lista.</div></div></div>
      <div className="grid gap-4 md:grid-cols-2">
        <GoalPitch title="Gols marcados" subtitle="Nossa equipe atacando o gol no topo" points={scoredPoints} onChange={setScoredPoints} tone="emerald" />
        <GoalPitch title="Gols sofridos" subtitle="Adversário atacando nossa baliza no topo" points={concededPoints} onChange={setConcededPoints} tone="rose" />
      </div>
      <button type="button" onClick={saveGoalPositions} disabled={savingGoals || !latest?.round} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-[9px] font-black uppercase tracking-widest text-white disabled:opacity-40">{savingGoals ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar posição e tipo dos gols</button>
    </div>

    {status ? <div className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${status.type==='ok' ? 'border-sky-100 bg-sky-50 text-sky-700' : 'border-red-100 bg-red-50 text-red-600'}`}>{status.message}</div> : null}
  </section>
}
