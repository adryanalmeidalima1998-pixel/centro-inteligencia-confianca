'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  Dumbbell,
  MapPin,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import AppShell from '../components/layout/AppShell'

const TYPES = ['Jogo', 'Treino', 'Reunião', 'Viagem', 'Observação', 'Abertura de Janela', 'Outro']
const SCOUTS = ['Adryan Almeida', 'Anthony Emanoel', 'Scout 3', 'Scout 4']
const EMPTY_FORM = {
  tipo: 'Jogo',
  titulo: '',
  descricao: '',
  competicao: 'Brasileirão Série C',
  mandante: '',
  visitante: '',
  data: '',
  hora: '',
  local: '',
  scout: '',
  status: 'agendado',
}

const TYPE_CONFIG = {
  Jogo: { icon: Trophy, label: 'Jogo', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Treino: { icon: Dumbbell, label: 'Treino', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  Reunião: { icon: UsersRound, label: 'Reunião', classes: 'bg-violet-50 text-violet-700 border-violet-200' },
  Viagem: { icon: Plane, label: 'Viagem', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  Observação: { icon: Search, label: 'Observação', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Abertura de Janela': { icon: CalendarDays, label: 'Janela', classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  Outro: { icon: CalendarDays, label: 'Outro', classes: 'bg-slate-50 text-slate-600 border-slate-200' },
}

const RESULT_CONFIG = {
  V: { label: 'Vitória', short: 'V', classes: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' },
  E: { label: 'Empate', short: 'E', classes: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
  D: { label: 'Derrota', short: 'D', classes: 'bg-rose-600 text-white', dot: 'bg-rose-500' },
}

function localDate(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value, options = {}) {
  const date = localDate(value)
  if (!date) return 'Data a confirmar'
  return date.toLocaleDateString('pt-BR', options)
}

function formatUploadDate(value) {
  if (!value) return 'Sem upload coletivo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysUntil(value) {
  const date = localDate(value)
  if (!date) return null
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

function monthKey(value) {
  return String(value || '').slice(0, 7) || 'sem-data'
}

function monthLabel(value) {
  const date = localDate(value)
  if (!date) return 'Sem data'
  const text = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function opponentOf(event) {
  return event.adversario || (String(event.mandante || '').toLowerCase().includes('confianca') ? event.visitante : event.mandante) || 'Adversário a confirmar'
}

function Metric({ label, value, suffix = '', featured = false }) {
  const display = value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`
  return (
    <div className={`rounded-xl border px-3 py-3 ${featured ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50/80'}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-black ${featured ? 'text-[#0a66b7]' : 'text-slate-800'}`}>{display}</p>
    </div>
  )
}

function FormDot({ result }) {
  const config = RESULT_CONFIG[result] || { dot: 'bg-slate-200', short: '—' }
  return (
    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white ${config.dot}`} title={config.label}>
      {config.short}
    </span>
  )
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">{description}</p>
    </div>
  )
}

function EventCard({ event, canEdit, expanded, onToggle, onEdit, onDelete }) {
  const config = TYPE_CONFIG[event.tipo] || TYPE_CONFIG.Outro
  const Icon = config.icon
  const completed = event.status === 'realizado'
  const awaitingData = event.status === 'aguardando_dados'
  const isGame = event.tipo === 'Jogo'
  const result = RESULT_CONFIG[event.resultado]
  const countdown = daysUntil(event.data)
  const metrics = event.metricas || {}

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${completed ? 'border-slate-200' : 'border-emerald-100'}`}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-[86px] items-center gap-3 sm:block sm:text-center">
          <div className="rounded-xl bg-slate-50 px-3 py-2 sm:px-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {formatDate(event.data, { weekday: 'short' }).replace('.', '')}
            </p>
            <p className="text-2xl font-black leading-none text-slate-800">{formatDate(event.data, { day: '2-digit' })}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase text-slate-400">{formatDate(event.data, { month: 'short' }).replace('.', '')}</p>
          </div>
          {event.hora && <p className="mt-1 text-[10px] font-bold text-slate-500 sm:text-center">{event.hora}</p>}
        </div>

        <div className="hidden h-14 w-px bg-slate-100 sm:block" />

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${config.classes}`}>
              <Icon className="h-3 w-3" /> {config.label}
            </span>
            {event.competicao && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {event.competicao}
              </span>
            )}
            {event.rodada ? <span className="text-[10px] font-semibold text-slate-400">Rodada {event.rodada}</span> : null}
            {completed && result ? <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${result.classes}`}>{result.label}</span> : null}
            {awaitingData ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black uppercase text-amber-700">Aguardando dados</span> : null}
          </div>

          {isGame ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-slate-800 sm:text-base">{event.mandante || 'A confirmar'}</p>
              {completed ? (
                <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-white">
                  <span className="text-xl font-black">{event.golsMandante}</span>
                  <span className="text-slate-500">×</span>
                  <span className="text-xl font-black">{event.golsVisitante}</span>
                </div>
              ) : (
                <span className="text-xs font-black uppercase text-slate-300">x</span>
              )}
              <p className="text-sm font-bold text-slate-800 sm:text-base">{event.visitante || 'A confirmar'}</p>
            </div>
          ) : (
            <p className="text-base font-bold text-slate-800">{event.titulo || event.descricao || event.tipo}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
            {event.local ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.local}</span> : null}
            {event.scout ? <span className="inline-flex items-center gap-1 font-semibold text-[#0a66b7]"><UserRound className="h-3 w-3" /> {event.scout}</span> : null}
            {completed && event.sistema ? <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {event.sistema}</span> : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {!completed && !awaitingData && countdown !== null ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">{countdown === 0 ? 'Hoje' : countdown === 1 ? 'Amanhã' : `Em ${countdown} dias`}</p>
              <p className="text-xs font-black text-[#0a66b7]">{event.hora || 'Horário a confirmar'}</p>
            </div>
          ) : null}

          {awaitingData ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Partida já programada</p>
              <p className="text-[10px] font-black text-amber-800">Atualize a planilha coletiva</p>
            </div>
          ) : null}

          {completed ? (
            <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0a66b7]">
              <BarChart3 className="h-3.5 w-3.5" /> Dados {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ) : null}

          {event.editavel && canEdit ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={onEdit} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" title="Editar">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={onDelete} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {completed && expanded ? (
        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0a66b7]">Leitura quantitativa da partida</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Indicadores do Confiança importados da planilha coletiva Sportsbase.</p>
            </div>
            <span className="rounded-lg bg-white px-2.5 py-1 text-[9px] font-bold uppercase text-slate-400 shadow-sm">Fonte coletiva</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Metric label="Índice" value={metrics.indice} featured />
            <Metric label="Posse" value={metrics.posse} suffix="%" />
            <Metric label="Chutes" value={metrics.chutes} />
            <Metric label="No alvo" value={metrics.chutesAlvo} />
            <Metric label="Chances" value={metrics.chances} />
            <Metric label="Entradas na área" value={metrics.entradasArea} />
            <Metric label="Passes certos" value={metrics.passesPct} suffix="%" />
            <Metric label="Passes progressivos" value={metrics.passesProgressivos} />
            <Metric label="Precisão progressiva" value={metrics.passesProgressivosPct} suffix="%" />
            <Metric label="Duelos ganhos" value={metrics.duelosPct} suffix="%" />
            <Metric label="Rec. campo adversário" value={metrics.recuperacoesCampoAdversario} />
            <Metric label="Perdas no próprio campo" value={metrics.perdasCampoProprio} />
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default function AgendaPage() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)
  const [data, setData] = useState({ eventos: [], realizados: [], proximos: [], manuais: [], resumo: {}, fonte: {}, warnings: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('todos')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadAgenda = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/agenda', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a agenda.')
      setData(payload)
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadAgenda() }, [loadAgenda])

  const filteredEvents = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (data.eventos || []).filter(event => {
      if (filter === 'realizados' && event.status !== 'realizado') return false
      if (filter === 'proximos' && (event.status === 'realizado' || daysUntil(event.data) < 0)) return false
      if (filter === 'internos' && event.tipo === 'Jogo') return false
      if (!search) return true
      const haystack = [event.titulo, event.descricao, event.competicao, event.mandante, event.visitante, event.local, event.scout]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }, [data.eventos, filter, query])

  const groups = useMemo(() => {
    const map = new Map()
    for (const event of filteredEvents) {
      const key = monthKey(event.data)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filteredEvents])

  const upcoming = useMemo(() => (data.proximos || []).slice(0, 5), [data.proximos])
  const summary = data.resumo || {}
  const record = summary.record || {}

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(event) {
    setEditingId(event.dbId)
    setForm({
      tipo: event.tipo || 'Outro',
      titulo: event.titulo || '',
      descricao: event.descricao || '',
      competicao: event.competicao || '',
      mandante: event.mandante || '',
      visitante: event.visitante || '',
      data: event.data || '',
      hora: event.hora || '',
      local: event.local || '',
      scout: event.scout || '',
      status: event.status || 'agendado',
    })
    setShowForm(true)
  }

  async function saveEvent() {
    if (!form.data) {
      setError('Informe a data do compromisso.')
      return
    }
    if (form.tipo === 'Jogo' && (!form.mandante || !form.visitante)) {
      setError('Informe mandante e visitante.')
      return
    }
    if (form.tipo !== 'Jogo' && !form.titulo && !form.descricao) {
      setError('Informe o título ou a descrição do compromisso.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/agenda', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar o compromisso.')
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await loadAgenda(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(event) {
    if (!window.confirm(`Excluir "${event.titulo || event.tipo}" da agenda?`)) return
    try {
      const response = await fetch(`/api/agenda?id=${event.dbId}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível excluir o compromisso.')
      await loadAgenda(true)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1480px] p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Calendário esportivo e operacional</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0a66b7] sm:text-4xl">Agenda CIC</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Resultados alimentados pela planilha coletiva do Confiança, próximos jogos e compromissos internos em uma única linha do tempo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => loadAgenda(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-[#0a66b7] disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            {canEdit ? (
              <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-[#0a66b7] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#005328]">
                <Plus className="h-4 w-4" /> Novo compromisso
              </button>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        ) : null}

        {(data.warnings || []).length ? (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {data.warnings.join(' · ')}
          </div>
        ) : null}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-[#0a66b7] to-[#008b4b] p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-100">Próximo jogo</p>
              <Target className="h-4 w-4 text-emerald-100" />
            </div>
            {summary.proximoJogo ? (
              <>
                <p className="mt-4 text-xl font-black">{opponentOf(summary.proximoJogo)}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-100">
                  {summary.proximoJogo.mando === 'casa' ? 'Casa' : 'Fora'} · {formatDate(summary.proximoJogo.data, { day: '2-digit', month: 'short' })} · {summary.proximoJogo.hora || 'A confirmar'}
                </p>
              </>
            ) : <p className="mt-4 text-sm font-semibold text-emerald-100">Nenhum jogo futuro cadastrado.</p>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Último resultado</p>
              <Trophy className="h-4 w-4 text-slate-300" />
            </div>
            {summary.ultimoJogo ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{opponentOf(summary.ultimoJogo)}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatDate(summary.ultimoJogo.data, { day: '2-digit', month: 'short' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900">{summary.ultimoJogo.golsClube}–{summary.ultimoJogo.golsAdversario}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${RESULT_CONFIG[summary.ultimoJogo.resultado]?.classes || 'bg-slate-100 text-slate-500'}`}>
                    {RESULT_CONFIG[summary.ultimoJogo.resultado]?.label || 'Resultado'}
                  </span>
                </div>
              </div>
            ) : <p className="mt-4 text-sm font-semibold text-slate-400">Aguardando planilha coletiva.</p>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Campanha importada</p>
              <Activity className="h-4 w-4 text-slate-300" />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-black text-slate-900">{record.pontos || 0}<span className="ml-1 text-xs font-bold text-slate-400">pts</span></p>
                <p className="mt-1 text-[10px] text-slate-400">{record.vitorias || 0}V · {record.empates || 0}E · {record.derrotas || 0}D</p>
              </div>
              <div className="flex gap-1.5">{(summary.forma || []).map((result, index) => <FormDot key={`${result}-${index}`} result={result} />)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Fonte dos realizados</p>
              <Database className="h-4 w-4 text-slate-300" />
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">{data.fonte?.partidasImportadas || 0}<span className="ml-1 text-xs font-bold text-slate-400">partidas</span></p>
            <p className="mt-1 truncate text-[10px] font-semibold text-[#0a66b7]">{data.fonte?.coletiva?.filename || 'Planilha coletiva não enviada'}</p>
            {summary.pendentesDados ? <p className="mt-1 text-[9px] font-bold text-amber-600">{summary.pendentesDados} jogo(s) aguardando atualização</p> : null}
            <p className="mt-1 text-[9px] text-slate-400">{formatUploadDate(data.fonte?.coletiva?.uploadedAt)}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1">
                {[
                  ['todos', 'Linha do tempo'],
                  ['realizados', 'Realizados'],
                  ['proximos', 'Próximos'],
                  ['internos', 'Compromissos internos'],
                ].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${filter === key ? 'bg-[#0a66b7] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar adversário, evento ou scout" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white" />)}</div>
            ) : groups.length ? (
              <div className="space-y-7">
                {groups.map(([key, events]) => (
                  <div key={key}>
                    <div className="mb-3 flex items-center gap-3">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{monthLabel(events[0]?.data)}</h2>
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">{events.length}</span>
                    </div>
                    <div className="space-y-3">
                      {events.map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          canEdit={canEdit}
                          expanded={expanded === event.id}
                          onToggle={() => setExpanded(current => current === event.id ? null : event.id)}
                          onEdit={() => openEdit(event)}
                          onDelete={() => deleteEvent(event)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum compromisso neste recorte" description="Altere os filtros ou cadastre um novo compromisso operacional." />
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Próximos compromissos</p>
                  <p className="mt-1 text-sm font-black text-slate-800">Agenda curta</p>
                </div>
                <Clock3 className="h-4 w-4 text-slate-300" />
              </div>
              <div className="mt-4 space-y-3">
                {upcoming.length ? upcoming.map(event => {
                  const config = TYPE_CONFIG[event.tipo] || TYPE_CONFIG.Outro
                  const Icon = config.icon
                  return (
                    <div key={event.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-50 text-[#0a66b7]"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-700">{event.tipo === 'Jogo' ? opponentOf(event) : event.titulo || event.descricao || event.tipo}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(event.data, { day: '2-digit', month: 'short' })} · {event.hora || 'A confirmar'}</p>
                      </div>
                    </div>
                  )
                }) : <p className="text-xs leading-5 text-slate-400">Nenhum compromisso futuro cadastrado.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Médias do período</p>
              <p className="mt-1 text-sm font-black text-slate-800">Confiança nos jogos importados</p>
              {summary.medias ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Metric label="Gols/jogo" value={summary.medias.gols} featured />
                  <Metric label="Chutes/jogo" value={summary.medias.chutes} />
                  <Metric label="Posse média" value={summary.medias.posse} suffix="%" />
                  <Metric label="Passes certos" value={summary.medias.passesPct} suffix="%" />
                </div>
              ) : <p className="mt-4 text-xs leading-5 text-slate-400">Envie a planilha coletiva na página de Elenco para alimentar os indicadores.</p>}
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-[#0a66b7]"><ShieldCheck className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.13em]">Fluxo dos dados</p></div>
              <p className="mt-3 text-xs leading-5 text-emerald-900/70">
                Jogos realizados são substituídos pelos dados reais da planilha coletiva. A agenda-base permanece apenas para partidas futuras. Treinos, reuniões, viagens e observações são persistidos separadamente.
              </p>
            </div>
          </aside>
        </div>

        {showForm && canEdit ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setShowForm(false) }}>
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/20 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#0a66b7]">Agenda operacional</p>
                  <h2 className="mt-1 text-xl font-black text-slate-800">{editingId ? 'Editar compromisso' : 'Novo compromisso'}</h2>
                </div>
                <button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Tipo</span>
                  <select value={form.tipo} onChange={event => setForm(current => ({ ...current, tipo: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                    {TYPES.map(type => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Status</span>
                  <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                    <option value="agendado">Agendado</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </label>

                {form.tipo === 'Jogo' ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Mandante</span>
                      <input value={form.mandante} onChange={event => setForm(current => ({ ...current, mandante: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Visitante</span>
                      <input value={form.visitante} onChange={event => setForm(current => ({ ...current, visitante: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Competição</span>
                      <input value={form.competicao} onChange={event => setForm(current => ({ ...current, competicao: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Título</span>
                      <input value={form.titulo} onChange={event => setForm(current => ({ ...current, titulo: event.target.value }))} placeholder="Ex.: Reunião de mercado da semana" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Descrição</span>
                      <textarea rows={3} value={form.descricao} onChange={event => setForm(current => ({ ...current, descricao: event.target.value }))} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                    </label>
                  </>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Data</span>
                  <input type="date" value={form.data} onChange={event => setForm(current => ({ ...current, data: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Horário</span>
                  <input type="time" value={form.hora} onChange={event => setForm(current => ({ ...current, hora: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Local</span>
                  <input value={form.local} onChange={event => setForm(current => ({ ...current, local: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Responsável</span>
                  <select value={form.scout} onChange={event => setForm(current => ({ ...current, scout: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                    <option value="">Sem responsável</option>
                    {SCOUTS.map(scout => <option key={scout}>{scout}</option>)}
                  </select>
                </label>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
                <button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100">Cancelar</button>
                <button type="button" disabled={saving} onClick={saveEvent} className="inline-flex items-center gap-2 rounded-xl bg-[#0a66b7] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#005328] disabled:opacity-60">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {saving ? 'Salvando...' : 'Salvar compromisso'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  )
}
