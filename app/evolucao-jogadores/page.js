'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BellRing,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Download,
  FileBarChart,
  Gauge,
  RefreshCw,
  Repeat2,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AppShell from '../components/layout/AppShell'
import { LEAGUES } from '@/data/leagues'

const BRAND_PRIMARY = '#0a66b7'
const POSITION_ORDER = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Extremo', 'Atacante']

const POSITION_META = {
  Goleiro: { short: 'GOL', color: '#b7791f', background: '#fffbeb' },
  Zagueiro: { short: 'ZAG', color: '#1d4ed8', background: '#eff6ff' },
  Lateral: { short: 'LAT', color: '#0369a1', background: '#f0f9ff' },
  Volante: { short: 'VOL', color: '#6d28d9', background: '#f5f3ff' },
  Meia: { short: 'MEI', color: '#047857', background: '#ecfdf5' },
  Extremo: { short: 'EXT', color: '#be185d', background: '#fdf2f8' },
  Atacante: { short: 'ATA', color: '#b91c1c', background: '#fef2f2' },
}

const STATUS_META = {
  improved: { label: 'Em evolução', color: '#15803d', background: '#dcfce7', icon: TrendingUp },
  trendPositive: { label: 'Tendência positiva', color: '#3d8b5e', background: '#ecfdf5', icon: TrendingUp },
  declined: { label: 'Em queda', color: '#b91c1c', background: '#fee2e2', icon: TrendingDown },
  trendNegative: { label: 'Tendência de queda', color: '#c2410c', background: '#fff7ed', icon: TrendingDown },
  stable: { label: 'Estável', color: '#475569', background: '#f1f5f9', icon: Activity },
  new: { label: 'Novo no recorte', color: '#1d4ed8', background: '#dbeafe', icon: Users },
  insufficient: { label: 'Sem comparação', color: '#7c3aed', background: '#ede9fe', icon: Activity },
}

const CONFIDENCE_META = {
  high: { label: 'Alta', color: '#166534', background: '#dcfce7' },
  medium: { label: 'Média', color: '#a16207', background: '#fef9c3' },
  low: { label: 'Baixa', color: '#c2410c', background: '#ffedd5' },
}

const MARKET_META = {
  A: { color: '#166534', background: '#dcfce7' },
  B: { color: '#047857', background: '#ecfdf5' },
  C: { color: '#a16207', background: '#fef9c3' },
  E: { color: '#1d4ed8', background: '#dbeafe' },
  P: { color: '#7c3aed', background: '#ede9fe' },
}

const ALERT_META = {
  growth: { label: 'Crescimento consecutivo', icon: TrendingUp, color: '#15803d', background: '#f0fdf4' },
  decline: { label: 'Queda consecutiva', icon: TrendingDown, color: '#b91c1c', background: '#fef2f2' },
  newU23Top5: { label: 'Sub-23 no Top 5', icon: Trophy, color: '#a16207', background: '#fffbeb' },
  clubChanges: { label: 'Troca de clube', icon: Repeat2, color: '#2563eb', background: '#eff6ff' },
}

const VISIBLE_ALERT_KEYS = Object.freeze(Object.keys(ALERT_META))

function visibleAlerts(alerts = {}) {
  return VISIBLE_ALERT_KEYS.reduce((clean, key) => {
    clean[key] = Array.isArray(alerts?.[key]) ? alerts[key] : []
    return clean
  }, {})
}

function formatDate(value, withYear = true) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', withYear
    ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : { day: '2-digit', month: 'short' }
  ).format(date)
}

function formatDelta(value, decimals = 1) {
  if (!Number.isFinite(Number(value))) return '—'
  const number = Number(value)
  return `${number > 0 ? '+' : ''}${number.toFixed(decimals)}`
}

function formatIntegerDelta(value) {
  if (!Number.isFinite(Number(value))) return '—'
  const number = Math.round(Number(value))
  return `${number > 0 ? '+' : ''}${number}`
}


function getConfidenceKey(confidence) {
  return confidence?.key || confidence?.level || 'low'
}

const REPORT_SCOUTING_NOTE = 'Para este relatório, priorizei atletas que, dentro do recorte selecionado, combinam rendimento atual, trajetória no período, perfil funcional e viabilidade real de mercado para o Confiança. A ordem dos cards representa uma shortlist de acompanhamento e aprofundamento, não uma indicação automática de contratação.'

const REPORT_SCOUTING_COMPLEMENT = 'Mantive atletas estáveis quando o patamar competitivo segue relevante e preservei nomes em queda somente quando o desempenho acumulado ainda justifica nova observação. Casos de baixa confiança devem ser tratados como tendência e validados em vídeo, contexto de função, histórico recente e condições da operação.'

function alertNumericValue(item = {}) {
  const direct = Number(item?.player?.periodDelta)
  if (Number.isFinite(direct)) return direct
  const match = String(item?.message || '').match(/([+-]?\d+(?:[.,]\d+)?)/)
  if (!match) return 0
  return Number(match[1].replace(',', '.')) || 0
}

function selectPriorityAlerts(alerts = {}, limit = 8) {
  const clean = visibleAlerts(alerts)
  const byGrowth = [...clean.growth].sort((a, b) => alertNumericValue(b) - alertNumericValue(a))
  const byDecline = [...clean.decline].sort((a, b) => Math.abs(alertNumericValue(b)) - Math.abs(alertNumericValue(a)))
  const byU23 = [...clean.newU23Top5].sort((a, b) => {
    const rankA = Number(a?.player?.displayRank || a?.player?.rankCurrent || 99)
    const rankB = Number(b?.player?.displayRank || b?.player?.rankCurrent || 99)
    if (rankA !== rankB) return rankA - rankB
    return Number(b?.player?.score || 0) - Number(a?.player?.score || 0)
  })
  const byClub = [...clean.clubChanges]

  const selected = []
  const used = new Set()
  const take = (key, items, amount) => {
    items.slice(0, amount).forEach(item => {
      const identity = `${key}:${item?.id || item?.player?.id || item?.player?.nome}:${item?.league?.slug || item?.league?.nome}`
      if (used.has(identity) || selected.length >= limit) return
      used.add(identity)
      selected.push({ key, meta: ALERT_META[key], item })
    })
  }

  take('growth', byGrowth, 4)
  take('decline', byDecline, 2)
  take('newU23Top5', byU23, 1)
  take('clubChanges', byClub, 1)

  const remaining = [
    ...byGrowth.map(item => ({ key: 'growth', meta: ALERT_META.growth, item, score: 400 + Math.max(0, alertNumericValue(item)) })),
    ...byU23.map(item => ({ key: 'newU23Top5', meta: ALERT_META.newU23Top5, item, score: 300 - Number(item?.player?.displayRank || item?.player?.rankCurrent || 20) })),
    ...byDecline.map(item => ({ key: 'decline', meta: ALERT_META.decline, item, score: 200 + Math.abs(alertNumericValue(item)) })),
    ...byClub.map(item => ({ key: 'clubChanges', meta: ALERT_META.clubChanges, item, score: 100 })),
  ].sort((a, b) => b.score - a.score)

  for (const alert of remaining) {
    if (selected.length >= limit) break
    const identity = `${alert.key}:${alert.item?.id || alert.item?.player?.id || alert.item?.player?.nome}:${alert.item?.league?.slug || alert.item?.league?.nome}`
    if (used.has(identity)) continue
    used.add(identity)
    selected.push(alert)
  }

  return selected.slice(0, limit)
}

function buildPlayerPdfInsight(player = {}) {
  const percentile = Number(player.percentileCurrent || 0)
  const delta = Number(player.periodDelta || 0)
  const minutes = Number(player.participation?.addedMinutes || 0)
  const confidence = getConfidenceKey(player.evolutionConfidence)
  const topContext = Number(player.displayRank || 99) <= 3

  const sample = minutes >= 180
    ? 'amostra recente consistente'
    : minutes >= 90
      ? 'participação recente relevante'
      : minutes > 0
        ? 'amostra recente ainda curta'
        : 'sem nova minutagem relevante'

  if (player.status === 'improved') {
    return {
      action: 'PRIORIDADE DE VÍDEO',
      detail: `${topContext ? 'Entre os primeiros do recorte' : 'Patamar competitivo'}, evolução sustentada e ${sample}.`,
    }
  }

  if (player.status === 'trendPositive') {
    return {
      action: 'APROFUNDAR EM VÍDEO',
      detail: `Sinal de crescimento com pctl ${Math.round(percentile)} e ${confidence === 'low' ? 'necessidade de confirmação' : sample}.`,
    }
  }

  if (player.status === 'declined' || player.status === 'trendNegative') {
    return {
      action: 'REAVALIAR MOMENTO',
      detail: `Nível acumulado ainda relevante, mas queda de ${Math.abs(delta).toFixed(1)} IAP exige validação do contexto.`,
    }
  }

  if (percentile >= 90) {
    return {
      action: 'MANTER NO RADAR',
      detail: `Patamar alto na posição, estabilidade no período e ${sample}.`,
    }
  }

  if (percentile >= 75) {
    return {
      action: 'MONITORAMENTO ATIVO',
      detail: `Rendimento competitivo, sem avanço suficiente para elevar a prioridade no momento.`,
    }
  }

  return {
    action: 'MONITORAR SEM PRIORIDADE',
    detail: `Permanece no recorte contextual, mas ainda distante dos melhores patamares da posição.`,
  }
}

function buildLeagueScoutingInsight(league = {}) {
  const viable = Number(league.contextEligiblePlayers || 0)
  const rising = Number(league.statusCounts?.improved || 0) + Number(league.statusCounts?.trendPositive || 0)
  const declining = Number(league.statusCounts?.declined || 0) + Number(league.statusCounts?.trendNegative || 0)
  const highConfidence = Number(league.confidenceCounts?.high || 0)
  const snapshots = Number(league.snapshotCount || 0)

  const viableLabel = viable === 1 ? '1 atleta considerado viável' : `${viable} atletas considerados viáveis`
  const risingLabel = rising === 1 ? '1 nome em alta' : `${rising} nomes em alta`
  const decliningLabel = declining === 1 ? '1 nome em queda' : `${declining} nomes em queda`
  const snapshotLabel = snapshots === 1 ? '1 coleta' : `${snapshots} coletas`
  const confidenceLabel = highConfidence === 1 ? '1 caso de alta confiança' : `${highConfidence} casos de alta confiança`

  let opening = `Para esta liga, trabalhei com ${viableLabel} e organizei a shortlist pela combinação entre nível atual, evolução, perfil funcional e possibilidade de mercado para o Confiança.`
  if (viable <= 10) opening = `Para esta liga, trabalhei com um recorte restrito de ${viableLabel}, tratando os selecionados como oportunidades específicas de mercado e observação.`

  const movement = rising > 0
    ? `${risingLabel} ${rising === 1 ? 'recebe' : 'recebem'} prioridade de acompanhamento.`
    : 'Sem crescimento consolidado, concentrei a leitura no patamar atual e na estabilidade competitiva.'

  const caution = declining > 0
    ? `${decliningLabel} ${declining === 1 ? 'permanece' : 'permanecem'} somente porque o nível acumulado ainda justifica reavaliação.`
    : 'Não identifiquei queda relevante entre os selecionados.'

  const sample = `A amostra reúne ${snapshotLabel} e ${confidenceLabel}, o que define o grau de cautela da leitura.`

  return `${opening} ${movement} ${caution} ${sample}`
}

function periodOptions(type) {
  if (type === 'bimester') return Array.from({ length: 6 }, (_, index) => ({ value: index + 1, label: `${index + 1}º bimestre` }))
  if (type === 'semester') return Array.from({ length: 2 }, (_, index) => ({ value: index + 1, label: `${index + 1}º semestre` }))
  return [{ value: 1, label: 'Temporada completa' }]
}

function sourceLabel(source) {
  if (source === 'sportsbase') return 'Sportsbase'
  if (source === 'wyscout') return 'Wyscout'
  return 'Fonte automática'
}

function safeFileName(value) {
  return String(value || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function Sparkline({ points = [], status = 'stable' }) {
  if (points.length < 2) {
    return <div style={{ width: 60, height: 28, display: 'grid', placeItems: 'center', fontSize: 9, color: '#94a3b8' }}>1 coleta</div>
  }

  const width = 60
  const height = 28
  const values = points.map(point => Number(point.score)).filter(Number.isFinite)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(6, max - min)
  const color = STATUS_META[status]?.color || '#475569'
  const coords = points.map((point, index) => {
    const x = 2 + (index * (width - 4)) / (points.length - 1)
    const y = height - 3 - ((Number(point.score) - min) / span) * (height - 7)
    return [x, y]
  })
  const path = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Linha de evolução do atleta">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  )
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.stable
  const Icon = meta.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 999, background: meta.background, color: meta.color, fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <Icon size={11} strokeWidth={2.4} />
      {meta.label}
    </span>
  )
}

function ConfidenceBadge({ confidence, full = false }) {
  const meta = CONFIDENCE_META[confidence?.key] || CONFIDENCE_META.low
  return (
    <span title={confidence?.reason || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 999, background: meta.background, color: meta.color, fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <ShieldCheck size={10} /> {full ? `${meta.label} confiança` : meta.label}
    </span>
  )
}

function MarketBadge({ market, full = false }) {
  const meta = MARKET_META[market?.band] || MARKET_META.C
  return (
    <span title={market?.reason || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 999, background: meta.background, color: meta.color, fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <Gauge size={10} /> {full ? `${market?.band || '—'} · ${market?.label || 'Contexto Confiança'}` : `Mercado ${market?.band || '—'}`}
    </span>
  )
}

function SummaryCard({ icon: Icon, label, value, helper, color = BRAND_PRIMARY }) {
  return (
    <div className="cig-card" style={{ background: '#fff', border: '1px solid #e5efe8', borderRadius: 14, padding: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8' }}>{label}</p>
          <p className="bc" style={{ fontSize: 28, lineHeight: 1, fontWeight: 900, color: '#163d25', marginTop: 5 }}>{value}</p>
          <p style={{ fontSize: 9.5, color: '#64748b', marginTop: 5 }}>{helper}</p>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${color}12`, color }}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function LeagueMultiSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = new Set(value)
  const filtered = LEAGUES.filter(league => `${league.nome} ${league.pais}`.toLowerCase().includes(search.toLowerCase()))

  const toggle = slug => {
    const next = new Set(selected)
    if (next.has(slug)) next.delete(slug)
    else next.add(slug)
    onChange([...next])
  }

  const buttonLabel = value.length === 0
    ? 'Todas as ligas com dados'
    : value.length === 1
      ? LEAGUES.find(league => league.slug === value[0])?.nome || '1 liga selecionada'
      : `${value.length} ligas selecionadas`

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(current => !current)} style={{ ...selectStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', textAlign: 'left' }}>
        <span className="cig-truncate">{buttonLabel}</span>
        <ChevronsUpDown size={14} color="#64748b" />
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 80, top: 'calc(100% + 6px)', left: 0, width: 'min(390px, 90vw)', maxHeight: 420, overflow: 'hidden', background: '#fff', border: '1px solid #cfe0d4', borderRadius: 12, boxShadow: '0 18px 50px rgba(18,59,34,.18)' }}>
          <div style={{ padding: 10, borderBottom: '1px solid #e7efe9' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: '#94a3b8' }} />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar liga ou país" style={{ ...selectStyle, paddingLeft: 29 }} />
            </div>
            <button type="button" onClick={() => onChange([])} style={{ width: '100%', marginTop: 7, border: 0, borderRadius: 8, padding: '8px 9px', background: value.length === 0 ? '#ecfdf5' : '#f8fafc', color: value.length === 0 ? BRAND_PRIMARY : '#475569', fontSize: 10, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ display: 'inline-flex', width: 19 }}>{value.length === 0 && <Check size={13} />}</span> Todas as ligas com dados
            </button>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', padding: 6 }}>
            {filtered.map(league => {
              const checked = selected.has(league.slug)
              return (
                <button key={league.slug} type="button" onClick={() => toggle(league.slug)} style={{ width: '100%', border: 0, borderRadius: 8, padding: '8px 9px', background: checked ? '#f0fdf4' : '#fff', color: checked ? BRAND_PRIMARY : '#334155', fontSize: 10, fontWeight: checked ? 800 : 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                  <span style={{ width: 17, height: 17, border: `1px solid ${checked ? BRAND_PRIMARY : '#cbd5e1'}`, borderRadius: 5, display: 'grid', placeItems: 'center', background: checked ? BRAND_PRIMARY : '#fff', color: '#fff', flexShrink: 0 }}>{checked && <Check size={11} />}</span>
                  <span>{league.bandeira}</span>
                  <span>{league.nome}</span>
                </button>
              )
            })}
          </div>
          <div style={{ padding: 9, borderTop: '1px solid #e7efe9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#64748b' }}>{value.length ? `${value.length} selecionada(s)` : 'Sem restrição'}</span>
            <button type="button" onClick={() => setOpen(false)} style={{ border: 0, borderRadius: 7, padding: '6px 10px', background: BRAND_PRIMARY, color: '#fff', fontSize: 9.5, fontWeight: 800, cursor: 'pointer' }}>Concluir</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerRow({ player, onSelect }) {
  const status = STATUS_META[player.status] || STATUS_META.stable
  const participation = player.participation || {}
  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      style={{
        width: '100%', border: 0, borderTop: '1px solid #edf2ee', background: '#fff', cursor: 'pointer',
        padding: '10px 11px', display: 'grid', gridTemplateColumns: '31px minmax(110px,1fr) 62px 60px',
        alignItems: 'center', gap: 8, textAlign: 'left', fontFamily: 'inherit',
      }}
      onMouseEnter={event => { event.currentTarget.style.background = '#f8fcf9' }}
      onMouseLeave={event => { event.currentTarget.style.background = '#fff' }}
    >
      <span style={{ textAlign: 'center' }}>
        <span className="bc" style={{ display: 'block', fontSize: 16, fontWeight: 900, color: player.displayRank <= 3 ? BRAND_PRIMARY : '#64748b' }}>#{player.displayRank}</span>
        <span title="Ranking global da posição na liga" style={{ display: 'block', fontSize: 8, fontWeight: 800, color: '#94a3b8' }}>liga #{player.rankCurrent}</span>
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <strong className="cig-truncate" style={{ fontSize: 11, color: '#173f26' }}>{player.nome}</strong>
          {player.belowMinimum && <span title="Abaixo da minutagem mínima" style={{ color: '#d97706', fontSize: 9 }}>●</span>}
        </span>
        <span className="cig-truncate" style={{ display: 'block', fontSize: 9, color: '#64748b', marginTop: 2 }}>{player.clube || 'Sem clube'} · {player.perfil || 'Sem perfil'}</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
          <StatusBadge status={player.status} />
          <ConfidenceBadge confidence={player.evolutionConfidence} />
          <MarketBadge market={player.market} />
        </span>
        <span style={{ display: 'block', fontSize: 8.5, color: '#64748b', marginTop: 4 }}>
          Pctl {Number(player.percentileCurrent || 0).toFixed(0)} ({formatDelta(player.percentileDelta, 0)}) · {formatIntegerDelta(participation.addedMinutes)} min · {formatIntegerDelta(participation.addedGames)} jogos
        </span>
      </span>
      <span style={{ textAlign: 'right' }}>
        <span className="bc" style={{ display: 'block', fontSize: 22, lineHeight: 1, color: '#173f26', fontWeight: 900 }}>{Number(player.score).toFixed(0)}</span>
        <span style={{ display: 'block', fontSize: 9, fontWeight: 800, color: status.color, marginTop: 3 }}>{formatDelta(player.periodDelta)}</span>
      </span>
      <Sparkline points={player.points} status={player.status} />
    </button>
  )
}

function PositionCard({ position, onSelect }) {
  const meta = POSITION_META[position.grupo] || POSITION_META.Meia
  return (
    <section style={{ background: '#fff', border: '1px solid #e4eee7', borderRadius: 14, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: meta.background, borderBottom: `2px solid ${meta.color}22` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 32, height: 25, borderRadius: 7, display: 'grid', placeItems: 'center', background: meta.color, color: '#fff', fontSize: 9, fontWeight: 900 }}>{meta.short}</span>
          <div>
            <h3 style={{ fontSize: 12, color: '#173f26' }}>{position.label}</h3>
            <p style={{ fontSize: 8.5, color: '#64748b', marginTop: 1 }}>Top {position.players.length} viável para o Confiança</p>
          </div>
        </div>
        <span style={{ fontSize: 9, color: '#64748b' }}>Contexto · IAP · evolução</span>
      </div>
      {position.players.length ? position.players.map(player => (
        <PlayerRow key={player.key} player={player} onSelect={onSelect} />
      )) : (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 10, color: '#94a3b8' }}>Sem atletas elegíveis nesta posição.</div>
      )}
    </section>
  )
}

function LeagueSection({ league, open, onToggle, onSelect }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #dce9e0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 5px 18px rgba(19,61,37,.04)' }}>
      <button type="button" onClick={onToggle} style={{ width: '100%', border: 0, cursor: 'pointer', background: '#fff', padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, textAlign: 'left', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${league.cor}14`, color: league.cor, fontSize: 20 }}>{league.bandeira || '🏆'}</span>
          <div style={{ minWidth: 0 }}>
            <h2 className="cig-truncate" style={{ fontSize: 15, color: '#123b22' }}>{league.nome}</h2>
            <p style={{ fontSize: 9.5, color: '#64748b', marginTop: 3 }}>
              {sourceLabel(league.fonte)} · {league.snapshotCount} coleta(s) · {league.contextEligiblePlayers || 0} viável(is) · {league.contextExcludedPlayers || 0} referência(s) excluída(s)
            </p>
            <p style={{ fontSize: 8.5, color: league.methodology?.hasMixedVersions ? '#b45309' : '#94a3b8', marginTop: 2 }}>
              Motor atual: {league.methodology?.calculationEngineVersion || '—'}{league.methodology?.hasLegacySnapshots ? ' · possui coleta legada' : ''}{league.methodology?.hasMixedVersions ? ' · versões de origem diferentes' : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <span title="Em evolução ou tendência positiva" style={{ padding: '4px 7px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontSize: 9, fontWeight: 800 }}>↑ {(league.statusCounts?.improved || 0) + (league.statusCounts?.trendPositive || 0)}</span>
            <span title="Em queda ou tendência de queda" style={{ padding: '4px 7px', borderRadius: 999, background: '#fee2e2', color: '#b91c1c', fontSize: 9, fontWeight: 800 }}>↓ {(league.statusCounts?.declined || 0) + (league.statusCounts?.trendNegative || 0)}</span>
            <span title="Alta confiança" style={{ padding: '4px 7px', borderRadius: 999, background: '#f0fdf4', color: '#166534', fontSize: 9, fontWeight: 800 }}>C+ {league.confidenceCounts?.high || 0}</span>
          </div>
          {open ? <ChevronDown size={18} color="#64748b" /> : <ChevronRight size={18} color="#64748b" />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 16px 18px', borderTop: '1px solid #edf2ee' }}>
          <div style={{ marginTop: 14, border: '1px solid #dce9e0', borderRadius: 11, padding: '10px 12px', background: '#f8fcf9' }}>
            <p style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#3d8b5e' }}>Leitura da liga</p>
            <p style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.5, marginTop: 4 }}>{buildLeagueScoutingInsight(league)}</p>
          </div>
          <div className="cig-auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', marginTop: 12 }}>
            {POSITION_ORDER.map(group => {
              const position = league.positions.find(item => item.grupo === group) || { grupo: group, label: group, players: [] }
              return <PositionCard key={group} position={position} onSelect={player => onSelect({ ...player, league })} />
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function AlertsPanel({ alerts, onSelect }) {
  const total = countVisibleAlerts(alerts)
  if (!total) return null

  return (
    <section style={{ background: '#fff', border: '1px solid #dce9e0', borderRadius: 16, padding: 15, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#3d8b5e' }}>Alertas automáticos de scouting</p>
          <h2 style={{ fontSize: 15, color: '#173f26', marginTop: 3 }}>Mudanças que merecem nova observação</h2>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 999, background: '#f0fdf4', color: BRAND_PRIMARY, fontSize: 9.5, fontWeight: 900 }}><BellRing size={13} /> {total}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: 9 }}>
        {Object.entries(ALERT_META).map(([key, meta]) => {
          const items = alerts?.[key] || []
          const Icon = meta.icon
          return (
            <div key={key} style={{ border: '1px solid #e6eee8', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '9px 10px', background: meta.background, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9.5, fontWeight: 900 }}><Icon size={13} /> {meta.label}</span>
                <span style={{ fontSize: 9, fontWeight: 900 }}>{items.length}</span>
              </div>
              {items.length ? items.slice(0, 5).map(item => (
                <button key={item.id} type="button" onClick={() => onSelect({ ...item.player, league: item.league })} style={{ width: '100%', border: 0, borderTop: '1px solid #edf2ee', background: '#fff', padding: '8px 10px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <strong className="cig-truncate" style={{ display: 'block', fontSize: 10, color: '#173f26' }}>{item.player.nome}</strong>
                  <span className="cig-truncate" style={{ display: 'block', fontSize: 8.5, color: '#64748b', marginTop: 1 }}>{item.league.bandeira} {item.league.nome}</span>
                  <span style={{ display: 'block', fontSize: 8.5, color: meta.color, marginTop: 3, lineHeight: 1.35 }}>{item.message}</span>
                </button>
              )) : <div style={{ padding: 14, fontSize: 9, color: '#94a3b8' }}>Nenhum alerta neste recorte.</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MetricBox({ label, value, color = '#173f26', helper }) {
  return (
    <div style={{ border: '1px solid #e7efe9', borderRadius: 12, padding: 12, minWidth: 0 }}>
      <p style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '.07em', color: '#94a3b8', fontWeight: 800 }}>{label}</p>
      <p className="bc" style={{ fontSize: 23, lineHeight: 1, color, fontWeight: 900, marginTop: 5 }}>{value}</p>
      {helper && <p style={{ fontSize: 8.5, color: '#64748b', marginTop: 5, lineHeight: 1.35 }}>{helper}</p>}
    </div>
  )
}

function PlayerModal({ selection, onClose }) {
  if (!selection) return null
  const player = selection
  const chartData = (player.points || []).map(point => ({ ...point, labelCompleto: formatDate(point.date, false) }))
  const status = STATUS_META[player.status] || STATUS_META.stable
  const confidence = player.evolutionConfidence || {}
  const participation = player.participation || {}

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(9,30,17,.55)', display: 'grid', placeItems: 'center', padding: 18, backdropFilter: 'blur(3px)' }}>
      <div className="cig-modal" onClick={event => event.stopPropagation()} style={{ width: 'min(920px, 100%)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,.22)' }}>
        <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg,#005329,#0878c8)', color: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', opacity: .75 }}>{selection.league?.nome} · {selection.grupo}</p>
            <h2 className="bc" style={{ fontSize: 29, lineHeight: 1, marginTop: 5 }}>{player.nome}</h2>
            <p style={{ fontSize: 10, opacity: .82, marginTop: 6 }}>{player.clube} · {player.posicao} · {player.perfil || 'Sem perfil dominante'}</p>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,.14)', color: '#fff', width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={17} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <StatusBadge status={player.status} />
            <ConfidenceBadge confidence={confidence} full />
            <MarketBadge market={player.market} full />
            <span style={{ fontSize: 9, color: '#64748b' }}>{confidence.reason}</span>
          </div>

          <div style={{ marginBottom: 12, border: '1px solid #dce9e0', borderRadius: 11, padding: '10px 12px', background: '#f8fcf9' }}>
            <p style={{ fontSize: 8.5, fontWeight: 900, color: '#3d8b5e', textTransform: 'uppercase', letterSpacing: '.08em' }}>Leitura de mercado para o Confiança</p>
            <p style={{ fontSize: 9.5, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>{player.market?.reason || 'Atleta aprovado pela camada contextual do Confiança.'}</p>
          </div>

          <div className="cig-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            <MetricBox label="IAP atual" value={Number(player.score).toFixed(0)} helper={`Base: ${player.periodBaselineScore ?? '—'} · Δ ${formatDelta(player.periodDelta)}`} />
            <MetricBox label="Ranking posicional" value={`#${player.rankCurrent || '—'}`} color={Number(player.rankDelta) >= 0 ? '#15803d' : '#b91c1c'} helper={`Movimento: ${formatIntegerDelta(player.rankDelta)} posição(ões)`} />
            <MetricBox label="Percentil da posição" value={Number(player.percentileCurrent || 0).toFixed(0)} color={Number(player.percentileDelta) >= 0 ? '#15803d' : '#b91c1c'} helper={`Δ percentil: ${formatDelta(player.percentileDelta)}`} />
            <MetricBox label="Participação nova" value={`${Math.round(participation.addedMinutes || 0)} min`} helper={`${formatIntegerDelta(participation.addedGames)} jogos · ${participation.trendLabel || '—'}`} />
          </div>

          <div style={{ marginTop: 16, border: '1px solid #e7efe9', borderRadius: 14, padding: '14px 12px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 12, color: '#173f26' }}>Evolução ao longo da temporada</h3>
                <p style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>IAP, ranking e participação são avaliados separadamente.</p>
              </div>
              <StatusBadge status={player.status} />
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: -15, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7efe9" />
                  <XAxis dataKey="labelCompleto" tick={{ fontSize: 9, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #dce9e0', fontSize: 10 }}
                    formatter={(value, name, item) => [`${Number(value).toFixed(0)} IAP · #${item.payload.rank} · ${Math.round(item.payload.minutos || 0)} min`, 'Rendimento']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatDate(payload[0].payload.date) : ''}
                  />
                  <Line type="monotone" dataKey="score" stroke={status.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#3d8b5e', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Participação competitiva</p>
            <div className="cig-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              <MetricBox label="Minutos por jogo" value={participation.currentMinutesPerGame ?? '—'} helper={`Δ ${formatDelta(participation.minutesPerGameDelta)}`} />
              <MetricBox label="Titularidade" value={participation.currentStarterRate !== null && participation.currentStarterRate !== undefined ? `${participation.currentStarterRate.toFixed(0)}%` : '—'} helper={`Δ ${formatDelta(participation.starterRateDelta)} p.p.`} />
              <MetricBox label="Jogos adicionados" value={Math.round(participation.addedGames || 0)} helper={`Total atual: ${Math.round(participation.currentGames || 0)}`} />
              <MetricBox label="Titularidades novas" value={participation.addedStarts !== null && participation.addedStarts !== undefined ? Math.round(participation.addedStarts) : '—'} helper={`Total atual: ${participation.currentStarts ?? '—'}`} />
            </div>
          </div>

          <div style={{ marginTop: 14, border: '1px solid #e7efe9', borderRadius: 12, padding: 13, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <Gauge size={17} color={BRAND_PRIMARY} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#173f26' }}>Leitura da confiança</p>
              <p style={{ fontSize: 9, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>{confidence.reason || 'Sem informação de confiança.'} O status “tendência” é usado quando a direção do IAP ainda não possui amostra suficiente para ser tratada como evolução confirmada.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

async function getLogoDataUrl() {
  try {
    const response = await fetch('/confianca.png')
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function countVisibleAlerts(alerts = {}) {
  const cleanAlerts = visibleAlerts(alerts)
  return VISIBLE_ALERT_KEYS.reduce((sum, key) => sum + cleanAlerts[key].length, 0)
}

function balancedChunks(items = [], maxPerPage = 1) {
  if (!items.length) return []
  const pageCount = Math.ceil(items.length / maxPerPage)
  const baseSize = Math.floor(items.length / pageCount)
  const remainder = items.length % pageCount
  const chunks = []
  let offset = 0
  for (let index = 0; index < pageCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0)
    chunks.push(items.slice(offset, offset + size))
    offset += size
  }
  return chunks
}

function alertRows(alerts) {
  const rows = []
  const cleanAlerts = visibleAlerts(alerts)
  for (const [key, meta] of Object.entries(ALERT_META)) {
    for (const item of cleanAlerts[key]) {
      rows.push([meta.label, item.player.nome, item.league.nome, item.message])
    }
  }
  return rows
}

export default function EvolucaoJogadoresPage() {
  const currentYear = new Date().getFullYear()
  const [filters, setFilters] = useState({
    year: currentYear,
    periodType: 'bimester',
    periodIndex: Math.min(6, Math.floor(new Date().getMonth() / 2) + 1),
    leagues: [],
    source: 'auto',
    minimumMinutes: 270,
    marketScope: 'immediate',
  })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [openLeagues, setOpenLeagues] = useState(new Set())
  const [selection, setSelection] = useState(null)

  const optionsForPeriod = useMemo(() => periodOptions(filters.periodType), [filters.periodType])
  const yearOptions = useMemo(() => Array.from({ length: 5 }, (_, index) => currentYear - index), [currentYear])

  const updateFilter = (key, value) => {
    setFilters(previous => {
      const next = { ...previous, [key]: value }
      if (key === 'periodType') next.periodIndex = 1
      return next
    })
  }

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({
        year: String(filters.year),
        periodType: filters.periodType,
        periodIndex: String(filters.periodIndex),
        source: filters.source,
        minimumMinutes: String(filters.minimumMinutes),
        marketScope: filters.marketScope,
        limit: '5',
      })
      if (filters.leagues.length) query.set('leagues', filters.leagues.join(','))
      const response = await fetch(`/api/evolucao-jogadores?${query.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar a evolução dos jogadores.')
      setReport(data)
      const openCount = filters.leagues.length > 0 && data.leagues?.length <= 4 ? data.leagues.length : 1
      setOpenLeagues(new Set(data.leagues?.slice(0, openCount).map(league => league.slug) || []))
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível gerar o painel.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadReport() }, [loadReport])

  const toggleLeague = slug => {
    setOpenLeagues(previous => {
      const next = new Set(previous)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const exportPdf = async () => {
    if (!report?.leagues?.length || exporting) return
    setExporting(true)
    setError('')

    try {
      const [{ jsPDF }, logo] = await Promise.all([
        import('jspdf'),
        getLogoDataUrl(),
      ])

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const pageMargin = 9
      const footerHeight = 11

      const COLORS = {
        green: '#0a66b7',
        greenDark: '#0c3b22',
        greenSoft: '#edf8f1',
        page: '#f4f7f5',
        white: '#ffffff',
        text: '#173f26',
        muted: '#64748b',
        faint: '#94a3b8',
        border: '#dce9e0',
        borderSoft: '#e9f0eb',
        positive: '#15803d',
        positiveSoft: '#dcfce7',
        negative: '#b91c1c',
        negativeSoft: '#fee2e2',
        warning: '#c2410c',
        warningSoft: '#ffedd5',
        neutral: '#475569',
        neutralSoft: '#f1f5f9',
        blue: '#1d4ed8',
        blueSoft: '#dbeafe',
        purple: '#7c3aed',
        purpleSoft: '#ede9fe',
        gold: '#a16207',
        goldSoft: '#fef9c3',
      }

      const hexToRgb = hex => {
        const value = String(hex || '#000000').replace('#', '')
        return [
          parseInt(value.slice(0, 2), 16),
          parseInt(value.slice(2, 4), 16),
          parseInt(value.slice(4, 6), 16),
        ]
      }
      const setFill = color => doc.setFillColor(...hexToRgb(color))
      const setDraw = color => doc.setDrawColor(...hexToRgb(color))
      const setText = color => doc.setTextColor(...hexToRgb(color))
      const normalizePdfText = value => String(value ?? '')
        .replace(/Δ/g, 'Var.')
        .replace(/→/g, '>')
        .replace(/↑/g, '+')
        .replace(/↓/g, '-')
        .replace(/—/g, '-')

      const truncateText = (value, maxWidth) => {
        const text = normalizePdfText(value)
        if (doc.getTextWidth(text) <= maxWidth) return text
        let output = text
        while (output.length > 2 && doc.getTextWidth(`${output}...`) > maxWidth) output = output.slice(0, -1)
        return `${output.trim()}...`
      }

      const roundedCard = (x, y, width, height, fill = COLORS.white, stroke = COLORS.border, radius = 3.5) => {
        setFill(fill)
        setDraw(stroke)
        doc.setLineWidth(0.25)
        doc.roundedRect(x, y, width, height, radius, radius, 'FD')
      }

      const drawPill = ({ text, x, y, fill, color, fontSize = 5.2, maxWidth = null, paddingX = 2.2, height = 5.8 }) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(fontSize)
        const safeText = normalizePdfText(text)
        const naturalWidth = doc.getTextWidth(safeText) + (paddingX * 2)
        const width = maxWidth ? Math.min(naturalWidth, maxWidth) : naturalWidth
        setFill(fill)
        doc.roundedRect(x, y, width, height, height / 2, height / 2, 'F')
        setText(color)
        doc.text(truncateText(safeText, width - (paddingX * 2)), x + paddingX, y + (height * 0.68))
        return width
      }

      const drawSparkline = ({ points = [], x, y, width, height, color }) => {
        const values = points.map(point => Number(point.score)).filter(Number.isFinite)
        if (values.length < 2) {
          setDraw('#cbd5e1')
          doc.setLineWidth(0.35)
          doc.line(x, y + height / 2, x + width, y + height / 2)
          return
        }
        const min = Math.min(...values)
        const max = Math.max(...values)
        const span = Math.max(6, max - min)
        const coords = values.map((value, index) => ({
          x: x + ((index * width) / (values.length - 1)),
          y: y + height - (((value - min) / span) * height),
        }))
        setDraw(color)
        doc.setLineWidth(0.55)
        for (let index = 1; index < coords.length; index += 1) {
          doc.line(coords[index - 1].x, coords[index - 1].y, coords[index].x, coords[index].y)
        }
        setFill(color)
        const last = coords[coords.length - 1]
        doc.circle(last.x, last.y, 0.75, 'F')
      }

      const shortStatusLabel = status => ({
        improved: 'Em evolução',
        trendPositive: 'Tendência +',
        declined: 'Em queda',
        trendNegative: 'Tendência -',
        stable: 'Estável',
        new: 'Novo',
        insufficient: 'Sem comparação',
      }[status] || 'Estável')

      const statusPalette = status => {
        if (status === 'improved') return { color: COLORS.positive, fill: COLORS.positiveSoft }
        if (status === 'trendPositive') return { color: '#3d8b5e', fill: '#ecfdf5' }
        if (status === 'declined') return { color: COLORS.negative, fill: COLORS.negativeSoft }
        if (status === 'trendNegative') return { color: COLORS.warning, fill: COLORS.warningSoft }
        if (status === 'new') return { color: COLORS.blue, fill: COLORS.blueSoft }
        if (status === 'insufficient') return { color: COLORS.purple, fill: COLORS.purpleSoft }
        return { color: COLORS.neutral, fill: COLORS.neutralSoft }
      }

      const confidencePalette = level => {
        if (level === 'high') return { color: '#166534', fill: '#dcfce7' }
        if (level === 'medium') return { color: COLORS.gold, fill: COLORS.goldSoft }
        return { color: COLORS.warning, fill: COLORS.warningSoft }
      }

      const addPageBackground = () => {
        setFill(COLORS.page)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
      }

      const addHeader = (title, subtitle = '', eyebrow = 'CIC - INTELIGÊNCIA DE MERCADO') => {
        setFill(COLORS.greenDark)
        doc.rect(0, 0, pageWidth, 23, 'F')
        setFill(COLORS.green)
        doc.rect(0, 20.5, pageWidth, 2.5, 'F')
        if (logo) doc.addImage(logo, 'PNG', 9, 3.2, 16, 16)
        const textX = logo ? 29 : 11
        setText(COLORS.white)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.3)
        doc.text(eyebrow, textX, 7)
        doc.setFontSize(14)
        doc.text(truncateText(title, pageWidth - textX - 12), textX, 13.3)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.8)
        doc.text(truncateText(subtitle, pageWidth - textX - 12), textX, 18.2)
      }

      let firstPdfPage = true
      const startPage = (title, subtitle = '', eyebrow) => {
        if (!firstPdfPage) doc.addPage()
        firstPdfPage = false
        addPageBackground()
        addHeader(title, subtitle, eyebrow)
      }

      const drawSummaryCard = ({ x, y, width, height, label, value, helper, color = COLORS.green }) => {
        roundedCard(x, y, width, height)
        setFill(color)
        doc.roundedRect(x + 3.2, y + 3.2, 2.2, height - 6.4, 1.1, 1.1, 'F')
        setText(COLORS.faint)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5.5)
        doc.text(truncateText(String(label).toUpperCase(), width - 13), x + 8, y + 6.8)
        setText(COLORS.text)
        doc.setFontSize(14.5)
        doc.text(String(value ?? 0), x + 8, y + 15.8)
        setText(COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.4)
        doc.text(truncateText(helper, width - 13), x + 8, y + height - 4.2)
      }

      const drawInfoChip = ({ text, x, y, fill = COLORS.greenSoft, color = COLORS.green }) => (
        drawPill({ text, x, y, fill, color, fontSize: 5.5, paddingX: 2.8, height: 6.5 })
      )

      const selectedNames = report.leagues.map(league => league.nome).join(', ')
      startPage('RELATÓRIO DE EVOLUÇÃO', report.filters.periodLabel, 'CIC - CENTRAL DE INTELIGÊNCIA DO CONFIANÇA')

      setText(COLORS.text)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(23)
      doc.text('PANORAMA EXECUTIVO', 12, 40)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.2)
      setText(COLORS.muted)
      const leagueLines = doc.splitTextToSize(`Ligas selecionadas: ${selectedNames}`, pageWidth - 24)
      doc.text(leagueLines.slice(0, 2), 12, 46)

      let chipX = 12
      const chipY = 54
      chipX += drawInfoChip({ text: sourceLabel(report.filters.source), x: chipX, y: chipY }) + 2
      chipX += drawInfoChip({ text: report.filters.marketScope === 'immediate' ? 'Mercado imediato' : 'Imediato + projetos', x: chipX, y: chipY, fill: COLORS.blueSoft, color: COLORS.blue }) + 2
      chipX += drawInfoChip({ text: `Min. ${report.filters.minimumMinutes} min`, x: chipX, y: chipY, fill: COLORS.goldSoft, color: COLORS.gold }) + 2
      drawInfoChip({ text: `Motor ${report.methodology?.calculationEngineVersion || '-'}`, x: chipX, y: chipY, fill: COLORS.purpleSoft, color: COLORS.purple })

      const summaryCards = [
        { label: 'Ligas', value: report.summary.leagues, helper: 'recorte selecionado', color: COLORS.green },
        { label: 'Selecionados', value: report.summary.rankedPlayers, helper: 'atletas nos cards', color: COLORS.blue },
        { label: 'Viaveis na base', value: report.summary.contextEligiblePlayers, helper: 'após corte de mercado', color: COLORS.positive },
        { label: 'Fora do contexto', value: report.summary.contextExcludedPlayers, helper: 'excluidos do ranking', color: COLORS.neutral },
        { label: 'Alertas', value: countVisibleAlerts(report.alerts), helper: 'sinais para observar', color: COLORS.purple },
        { label: 'Em evolução', value: report.summary.improved, helper: 'sinal sustentado', color: COLORS.positive },
        { label: 'Tendência +', value: report.summary.trendPositive, helper: 'amostra ainda curta', color: '#3d8b5e' },
        { label: 'Estaveis', value: report.summary.stable, helper: 'sem mudanca relevante', color: COLORS.neutral },
        { label: 'Em queda', value: report.summary.declined, helper: 'reavaliar momento', color: COLORS.negative },
        { label: 'Confianca alta', value: report.summary.confidenceHigh, helper: 'amostra mais robusta', color: COLORS.gold },
      ]
      const summaryGap = 3.2
      const summaryCols = 5
      const summaryWidth = (pageWidth - 24 - (summaryGap * (summaryCols - 1))) / summaryCols
      const summaryHeight = 25
      summaryCards.forEach((card, index) => {
        const col = index % summaryCols
        const row = Math.floor(index / summaryCols)
        drawSummaryCard({
          ...card,
          x: 12 + (col * (summaryWidth + summaryGap)),
          y: 66 + (row * (summaryHeight + summaryGap)),
          width: summaryWidth,
          height: summaryHeight,
        })
      })

      roundedCard(12, 122, pageWidth - 24, 66, COLORS.white, COLORS.border)
      setFill(COLORS.greenSoft)
      doc.roundedRect(16, 126, 46, 9, 4.5, 4.5, 'F')
      setText(COLORS.green)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.text('LEITURA DE SCOUTING', 20, 131.7)
      setText(COLORS.text)
      doc.setFontSize(10.5)
      doc.text('Critério de seleção da shortlist.', 16, 143)
      setText(COLORS.muted)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      doc.text(doc.splitTextToSize(REPORT_SCOUTING_NOTE, pageWidth - 34), 16, 150)
      setText(COLORS.text)
      doc.setFontSize(6.4)
      doc.text(doc.splitTextToSize(REPORT_SCOUTING_COMPLEMENT, pageWidth - 34), 16, 166)
      setText(COLORS.faint)
      doc.setFontSize(5.6)
      doc.text(`Política ${report.methodology?.marketPolicyVersion || '-'} · Motor ${report.methodology?.calculationEngineVersion || '-'} · Gerado em ${formatDate(report.generatedAt)}.`, 16, 183.5)

      const totalReportAlerts = countVisibleAlerts(report.alerts)
      const alertCards = selectPriorityAlerts(report.alerts, 8)

      const drawAlertCard = ({ alert, x, y, width, height }) => {
        const { meta, item } = alert
        roundedCard(x, y, width, height)
        setFill(meta.color)
        doc.roundedRect(x, y, 2.8, height, 1.4, 1.4, 'F')
        drawPill({ text: meta.label, x: x + 6, y: y + 4, fill: meta.background, color: meta.color, fontSize: 5.1, maxWidth: width - 12, height: 6 })
        setText(COLORS.text)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.3)
        doc.text(truncateText(item.player.nome, width - 12), x + 6, y + 15)
        setText(COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.6)
        doc.text(truncateText(`${item.league.nome} | ${item.player.clube || 'Sem clube'}`, width - 12), x + 6, y + 20.2)
        setText(meta.color)
        doc.setFontSize(5.8)
        const messageLines = doc.splitTextToSize(normalizePdfText(item.message), width - 12)
        doc.text(messageLines.slice(0, 2), x + 6, y + 26.2)

        const player = item.player || {}
        const footerParts = []
        if (Number.isFinite(Number(player.score))) footerParts.push(`IAP ${Number(player.score).toFixed(0)}`)
        if (Number.isFinite(Number(player.displayRank || player.rankCurrent))) footerParts.push(`#${Number(player.displayRank || player.rankCurrent)} no recorte`)
        if (Number.isFinite(Number(player.percentileCurrent))) footerParts.push(`pctl ${Math.round(Number(player.percentileCurrent))}`)
        if (footerParts.length) {
          setText(COLORS.faint)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(4.8)
          doc.text(truncateText(footerParts.join(' | '), width - 12), x + 6, y + height - 4.5)
        }
      }

      if (alertCards.length) {
        startPage(
          'ALERTAS PRIORITÁRIOS DE SCOUTING',
          `${report.filters.periodLabel} | ${alertCards.length} prioridades de ${totalReportAlerts} sinais identificados`,
        )
        const cols = 2
        const rows = 4
        const gapX = 4
        const gapY = 4
        const cardWidth = (pageWidth - (pageMargin * 2) - gapX) / cols
        const cardHeight = (pageHeight - 34 - footerHeight - (gapY * (rows - 1))) / rows
        alertCards.forEach((alert, index) => {
          const col = index % cols
          const row = Math.floor(index / cols)
          drawAlertCard({
            alert,
            x: pageMargin + (col * (cardWidth + gapX)),
            y: 29 + (row * (cardHeight + gapY)),
            width: cardWidth,
            height: cardHeight,
          })
        })
      }

      const drawPlayerRow = ({ player, x, y, width, height, isLast }) => {
        const palette = statusPalette(player.status)
        const confidence = confidencePalette(getConfidenceKey(player.evolutionConfidence))
        const participation = player.participation || {}
        if (!isLast) {
          setDraw(COLORS.borderSoft)
          doc.setLineWidth(0.2)
          doc.line(x + 2.5, y + height, x + width - 2.5, y + height)
        }

        setText(player.displayRank <= 3 ? COLORS.green : COLORS.muted)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.text(`#${player.displayRank}`, x + 3, y + 8)
        setText(COLORS.faint)
        doc.setFontSize(4.7)
        doc.text(`liga #${player.rankCurrent}`, x + 3, y + 12)

        const contentX = x + 12
        const scoreArea = 18
        const contentWidth = width - 14 - scoreArea
        setText(COLORS.text)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(width < 75 ? 6.5 : 7.1)
        doc.text(truncateText(player.nome, contentWidth), contentX, y + 5.8)
        setText(COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(width < 75 ? 4.5 : 4.9)
        doc.text(truncateText(`${player.clube || 'Sem clube'} | ${player.perfil || 'Sem perfil'}`, contentWidth), contentX, y + 10.2)

        let pillX = contentX
        pillX += drawPill({ text: shortStatusLabel(player.status), x: pillX, y: y + 12.4, fill: palette.fill, color: palette.color, fontSize: 4.1, height: 5, maxWidth: contentWidth * 0.56, paddingX: 1.4 }) + 1
        pillX += drawPill({ text: ({ high: 'Alta', medium: 'Média', low: 'Baixa' }[getConfidenceKey(player.evolutionConfidence)] || 'Baixa'), x: pillX, y: y + 12.4, fill: confidence.fill, color: confidence.color, fontSize: 4.1, height: 5, maxWidth: contentWidth * 0.32, paddingX: 1.4 }) + 1
        if ((pillX - contentX) < contentWidth - 9) {
          drawPill({ text: `M ${player.market?.band || '-'}`, x: pillX, y: y + 12.4, fill: COLORS.greenSoft, color: COLORS.green, fontSize: 4.1, height: 5, maxWidth: 9, paddingX: 1.2 })
        }

        setText(COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(width < 75 ? 4.15 : 4.55)
        const metric = `Pctl ${Number(player.percentileCurrent || 0).toFixed(0)} (${formatDelta(player.percentileDelta, 0)}) | ${formatIntegerDelta(participation.addedMinutes)} min | ${formatIntegerDelta(participation.addedGames)}j`
        doc.text(truncateText(metric, contentWidth), contentX, y + height - 3.1)

        const scoreX = x + width - 3
        setText(COLORS.text)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12.5)
        doc.text(Number(player.score).toFixed(0), scoreX, y + 7.7, { align: 'right' })
        setText(palette.color)
        doc.setFontSize(5.2)
        doc.text(formatDelta(player.periodDelta), scoreX, y + 12.1, { align: 'right' })
        drawSparkline({ points: player.points, x: x + width - 16, y: y + 15.3, width: 12, height: 5.2, color: palette.color })
      }

      const drawPositionCard = ({ position, x, y, width, height }) => {
        const meta = POSITION_META[position.grupo] || POSITION_META.Meia
        roundedCard(x, y, width, height, COLORS.white, COLORS.border, 3.7)
        setFill(meta.background)
        doc.roundedRect(x, y, width, 17, 3.7, 3.7, 'F')
        setFill(meta.color)
        doc.roundedRect(x + 3.2, y + 4.1, 11, 8.5, 2.1, 2.1, 'F')
        setText(COLORS.white)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5.3)
        doc.text(meta.short, x + 8.7, y + 9.7, { align: 'center' })
        setText(COLORS.text)
        doc.setFontSize(7.8)
        doc.text(normalizePdfText(position.label), x + 16.5, y + 7.4)
        setText(COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(4.8)
        doc.text(`Top ${position.players.length} viável para o Confiança`, x + 16.5, y + 12)
        if (width >= 82) {
          setText(meta.color)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(4.5)
          doc.text('CONTEXTO | IAP | EVOLUÇÃO', x + width - 3.2, y + 9.4, { align: 'right' })
        }

        const bodyY = y + 17
        const bodyHeight = height - 17
        if (!position.players.length) {
          setText(COLORS.faint)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6)
          doc.text('Sem atletas elegíveis nesta posição.', x + width / 2, bodyY + bodyHeight / 2, { align: 'center' })
          return
        }

        const rowHeight = bodyHeight / 5
        position.players.slice(0, 5).forEach((player, index) => {
          drawPlayerRow({
            player,
            x,
            y: bodyY + (index * rowHeight),
            width,
            height: rowHeight,
            isLast: index === Math.min(position.players.length, 5) - 1,
          })
        })
      }

      const drawLeaguePlayerCard = ({ entry, x, y, width, height }) => {
        const { player, position } = entry
        const meta = POSITION_META[position.grupo] || POSITION_META.Meia
        const palette = statusPalette(player.status)
        const confidence = confidencePalette(getConfidenceKey(player.evolutionConfidence))
        const participation = player.participation || {}
        const scoutingInsight = buildPlayerPdfInsight(player)
        const compact = height < 58

        roundedCard(x, y, width, height, COLORS.white, COLORS.border, 3.8)

        const headerHeight = 13
        setFill(meta.background)
        doc.roundedRect(x, y, width, headerHeight, 3.8, 3.8, 'F')
        setFill(meta.color)
        doc.roundedRect(x + 3, y + 2.6, 10.5, 7.7, 2, 2, 'F')
        setText(COLORS.white)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5.1)
        doc.text(meta.short, x + 8.25, y + 7.6, { align: 'center' })

        setText(COLORS.text)
        doc.setFontSize(7)
        doc.text(truncateText(position.label, width - 29), x + 16, y + 6.1)
        setText(meta.color)
        doc.setFontSize(5.2)
        doc.text(`#${player.displayRank}`, x + width - 4, y + 6.2, { align: 'right' })
        setText(COLORS.faint)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(4.4)
        doc.text(`liga #${player.rankCurrent}`, x + width - 4, y + 9.6, { align: 'right' })

        const innerX = x + 4
        const innerWidth = width - 8
        const scoreReserve = 23
        const bodyTop = y + 18.5
        const textWidth = innerWidth - scoreReserve

        setText(COLORS.text)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(compact ? 6.7 : 7.6)
        doc.text(truncateText(player.nome, textWidth), innerX, bodyTop)

        setText(COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(compact ? 4.35 : 4.85)
        doc.text(
          truncateText(`${player.clube || 'Sem clube'} | ${player.perfil || 'Sem perfil'}`, textWidth),
          innerX,
          bodyTop + 4.5,
        )

        setText(COLORS.text)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(compact ? 13 : 15.5)
        doc.text(Number(player.score).toFixed(0), x + width - 4, bodyTop + 0.8, { align: 'right' })
        setText(palette.color)
        doc.setFontSize(5)
        doc.text(formatDelta(player.periodDelta), x + width - 4, bodyTop + 5, { align: 'right' })
        drawSparkline({
          points: player.points,
          x: x + width - 26,
          y: bodyTop + 7.4,
          width: 21,
          height: 6.2,
          color: palette.color,
        })

        const pillY = bodyTop + 8.8
        let pillX = innerX
        pillX += drawPill({
          text: shortStatusLabel(player.status),
          x: pillX,
          y: pillY,
          fill: palette.fill,
          color: palette.color,
          fontSize: 4,
          height: 5,
          maxWidth: textWidth * 0.52,
          paddingX: 1.3,
        }) + 1
        if ((pillX - innerX) < textWidth * 0.78) {
          pillX += drawPill({
            text: ({ high: 'Alta', medium: 'Média', low: 'Baixa' }[getConfidenceKey(player.evolutionConfidence)] || 'Baixa'),
            x: pillX,
            y: pillY,
            fill: confidence.fill,
            color: confidence.color,
            fontSize: 4,
            height: 5,
            maxWidth: textWidth * 0.22,
            paddingX: 1.3,
          }) + 1
        }
        if ((pillX - innerX) < textWidth * 0.92) {
          drawPill({
            text: `M ${player.market?.band || '-'}`,
            x: pillX,
            y: pillY,
            fill: COLORS.greenSoft,
            color: COLORS.green,
            fontSize: 4,
            height: 5,
            maxWidth: 10,
            paddingX: 1.2,
          })
        }

        const metric = `Pctl ${Number(player.percentileCurrent || 0).toFixed(0)} | ${formatIntegerDelta(participation.addedMinutes)} min | ${formatIntegerDelta(participation.addedGames)}j`
        const detailLines = doc.splitTextToSize(normalizePdfText(scoutingInsight.detail), innerWidth)
        const actionY = y + height - 11.8
        const detailY = y + height - 7.2
        const metricY = y + height - 3.2

        setText(palette.color)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(compact ? 4.05 : 4.45)
        doc.text(truncateText(scoutingInsight.action, innerWidth), innerX, actionY)

        setText(COLORS.text)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(compact ? 3.7 : 4.05)
        doc.text(detailLines.slice(0, 2), innerX, detailY)

        setText(COLORS.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(compact ? 4 : 4.4)
        doc.text(truncateText(metric, innerWidth), innerX, metricY)
      }

      for (const league of report.leagues) {
        const populatedPositions = POSITION_ORDER.map(group => (
          league.positions.find(item => item.grupo === group) || { grupo: group, label: group, players: [] }
        )).filter(position => position.players.length > 0)

        const leaguePlayers = populatedPositions.flatMap(position => (
          position.players.slice(0, 5).map(player => ({ player, position }))
        ))
        if (!leaguePlayers.length) continue

        // Limite de seis cards por página para ampliar o espaço vertical e evitar qualquer sobreposição de texto.
        const playerPages = balancedChunks(leaguePlayers, 6)
        playerPages.forEach((pagePlayers, pageIndex) => {
          const positionLabel = [...new Set(pagePlayers.map(entry => entry.position.label))].join(' | ')
          startPage(
            league.nome.toUpperCase(),
            `${sourceLabel(league.fonte)} | ${league.snapshotCount} coleta(s) | ${formatDate(league.firstUploadAt)} a ${formatDate(league.latestUploadAt)} | ${positionLabel}`,
          )

          const kpiY = 27
          const kpis = [
            { text: `${league.contextEligiblePlayers || 0} viáveis`, fill: COLORS.greenSoft, color: COLORS.green },
            { text: `${league.contextExcludedPlayers || 0} fora do contexto`, fill: COLORS.neutralSoft, color: COLORS.neutral },
            { text: `${(league.statusCounts?.improved || 0) + (league.statusCounts?.trendPositive || 0)} em alta`, fill: COLORS.positiveSoft, color: COLORS.positive },
            { text: `${(league.statusCounts?.declined || 0) + (league.statusCounts?.trendNegative || 0)} em queda`, fill: COLORS.negativeSoft, color: COLORS.negative },
            { text: `${league.confidenceCounts?.high || 0} confiança alta`, fill: COLORS.goldSoft, color: COLORS.gold },
          ]
          let kpiX = pageMargin
          kpis.forEach(kpi => { kpiX += drawPill({ ...kpi, x: kpiX, y: kpiY, fontSize: 5, height: 6, paddingX: 2.2 }) + 1.5 })

          let gridY
          if (pageIndex === 0) {
            const leagueInsight = buildLeagueScoutingInsight(league)
            roundedCard(pageMargin, 35, pageWidth - (pageMargin * 2), 16, COLORS.white, COLORS.border)
            setText(COLORS.green)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(5)
            doc.text('LEITURA DA LIGA', pageMargin + 3, 39.5)
            setText(COLORS.muted)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(4.8)
            const leagueInsightLines = doc.splitTextToSize(normalizePdfText(leagueInsight), pageWidth - (pageMargin * 2) - 6)
            doc.text(leagueInsightLines.slice(0, 3), pageMargin + 3, 43.8)
            gridY = 53.5
          } else {
            roundedCard(pageMargin, 35, pageWidth - (pageMargin * 2), 8, COLORS.greenSoft, COLORS.border)
            setText(COLORS.green)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(5.2)
            doc.text(`CONTINUAÇÃO DA SHORTLIST | ${pageIndex + 1} DE ${playerPages.length}`, pageMargin + 3, 40.1)
            setText(COLORS.muted)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(4.6)
            doc.text(truncateText(positionLabel, 90), pageWidth - pageMargin - 3, 40.1, { align: 'right' })
            gridY = 45.5
          }
          const gapX = 4
          const gapY = 4
          const cols = pagePlayers.length === 1 ? 1 : 2
          const rows = Math.ceil(pagePlayers.length / cols)
          const cardWidth = (pageWidth - (pageMargin * 2) - (gapX * (cols - 1))) / cols
          const availableGridHeight = pageHeight - gridY - footerHeight - 4
          const cardHeight = (availableGridHeight - (gapY * (rows - 1))) / rows

          pagePlayers.forEach((entry, index) => {
            const col = index % cols
            const row = Math.floor(index / cols)
            drawLeaguePlayerCard({
              entry,
              x: pageMargin + (col * (cardWidth + gapX)),
              y: gridY + (row * (cardHeight + gapY)),
              width: cardWidth,
              height: cardHeight,
            })
          })
        })
      }

      const pages = doc.getNumberOfPages()
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page)
        setDraw('#d7e4db')
        doc.setLineWidth(0.2)
        doc.line(pageMargin, pageHeight - 8.5, pageWidth - pageMargin, pageHeight - 8.5)
        setText(COLORS.muted)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5.2)
        doc.text('CIC - CENTRAL DE INTELIGÊNCIA DO CONFIANÇA', pageMargin, pageHeight - 4.2)
        doc.setFont('helvetica', 'normal')
        doc.text(`${report.filters.periodLabel} | Página ${page} de ${pages}`, pageWidth - pageMargin, pageHeight - 4.2, { align: 'right' })
      }

      const leagueSuffix = report.leagues.length === 1 ? report.leagues[0].slug : `${report.leagues.length}-ligas`
      doc.save(`${safeFileName(`evolucao-${leagueSuffix}-${report.filters.periodLabel}`)}.pdf`)
    } catch (exportError) {
      setError(exportError.message || 'Não foi possível gerar o PDF.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <AppShell>
      <div style={{ padding: '26px 30px 42px', maxWidth: 1720, margin: '0 auto' }}>
        <header className="cig-page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.13em', textTransform: 'uppercase', color: '#3d8b5e' }}>Inteligência de Ligas</p>
            <h1 className="bc" style={{ fontSize: 34, lineHeight: 1, color: '#10391f', marginTop: 5 }}>EVOLUÇÃO DE JOGADORES</h1>
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 7, maxWidth: 820, lineHeight: 1.55 }}>
              Top 5 por grupo posicional após o corte de viabilidade do Confiança, com evolução de IAP, ranking, percentil, participação e confiança da amostra.
            </p>
          </div>
          <div className="cig-header-actions" style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadReport} disabled={loading} style={{ border: '1px solid #bdd9c5', background: '#fff', color: BRAND_PRIMARY, borderRadius: 9, padding: '9px 13px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
            </button>
            <button onClick={exportPdf} disabled={!report?.leagues?.length || exporting} style={{ border: 0, background: !report?.leagues?.length ? '#94a3b8' : BRAND_PRIMARY, color: '#fff', borderRadius: 9, padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, cursor: exporting ? 'wait' : 'pointer' }}>
              <Download size={14} /> {exporting ? 'Gerando PDF...' : 'Gerar PDF das ligas selecionadas'}
            </button>
          </div>
        </header>

        <section className="cig-card" style={{ background: '#fff', border: '1px solid #dce9e0', borderRadius: 15, padding: 15, marginBottom: 16 }}>
          <div className="cig-input-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={filterLabelStyle}>Ano</span>
              <select value={filters.year} onChange={event => updateFilter('year', Number(event.target.value))} style={selectStyle}>
                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={filterLabelStyle}>Recorte</span>
              <select value={filters.periodType} onChange={event => updateFilter('periodType', event.target.value)} style={selectStyle}>
                <option value="bimester">Bimestral</option>
                <option value="semester">Semestral</option>
                <option value="season">Temporada</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={filterLabelStyle}>Período</span>
              <select value={filters.periodIndex} onChange={event => updateFilter('periodIndex', Number(event.target.value))} style={selectStyle}>
                {optionsForPeriod.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={filterLabelStyle}>Ligas para exibir e exportar</span>
              <LeagueMultiSelect value={filters.leagues} onChange={value => updateFilter('leagues', value)} />
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={filterLabelStyle}>Contexto Confiança</span>
              <select value={filters.marketScope} onChange={event => updateFilter('marketScope', event.target.value)} style={selectStyle}>
                <option value="immediate">Somente mercado imediato</option>
                <option value="immediate-and-development">Imediato + projetos</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={filterLabelStyle}>Fonte</span>
              <select value={filters.source} onChange={event => updateFilter('source', event.target.value)} style={selectStyle}>
                <option value="auto">Automática</option>
                <option value="sportsbase">Sportsbase</option>
                <option value="wyscout">Wyscout</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={filterLabelStyle}>Minutos de referência</span>
              <select value={filters.minimumMinutes} onChange={event => updateFilter('minimumMinutes', Number(event.target.value))} style={selectStyle}>
                <option value={0}>Sem mínimo</option>
                <option value={180}>180 minutos</option>
                <option value={270}>270 minutos</option>
                <option value={450}>450 minutos</option>
                <option value={600}>600 minutos</option>
                <option value={900}>900 minutos</option>
              </select>
            </label>
          </div>
          {filters.leagues.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
              {filters.leagues.map(slug => {
                const league = LEAGUES.find(item => item.slug === slug)
                return (
                  <button key={slug} type="button" onClick={() => updateFilter('leagues', filters.leagues.filter(item => item !== slug))} style={{ border: '1px solid #cfe0d4', borderRadius: 999, padding: '4px 7px', background: '#f8fcf9', color: '#315a3e', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 8.5, fontWeight: 800, cursor: 'pointer' }}>
                    {league?.bandeira} {league?.nome || slug} <X size={10} />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {error && <div style={{ marginBottom: 16, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', borderRadius: 11, padding: '11px 13px', fontSize: 10.5, fontWeight: 700 }}>{error}</div>}

        {loading ? (
          <div style={{ minHeight: 360, display: 'grid', placeItems: 'center', background: '#fff', border: '1px solid #e2ece5', borderRadius: 16 }}>
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={28} color={BRAND_PRIMARY} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 11, fontWeight: 800, marginTop: 10 }}>Calculando evolução, confiança, ranking e participação...</p>
            </div>
          </div>
        ) : report?.leagues?.length ? (
          <>
            <div className="cig-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 11, marginBottom: 16 }}>
              <SummaryCard icon={FileBarChart} label="Ligas" value={report.summary.leagues} helper={report.filters.periodLabel} />
              <SummaryCard icon={Users} label="Atletas selecionados" value={report.summary.rankedPlayers} helper="Até 5 por posição e liga" color="#2563eb" />
              <SummaryCard icon={TrendingUp} label="Evolução / tendência +" value={(report.summary.improved || 0) + (report.summary.trendPositive || 0)} helper={`${report.summary.improved || 0} confirmada(s)`} color="#15803d" />
              <SummaryCard icon={ShieldCheck} label="Alta confiança" value={report.summary.confidenceHigh} helper={`${report.summary.confidenceLow || 0} com baixa confiança`} color="#166534" />
              <SummaryCard icon={Gauge} label="Fora do contexto" value={report.summary.contextExcludedPlayers || 0} helper="Referência, elite ou mercado incompatível" color="#b45309" />
              <SummaryCard icon={BellRing} label="Alertas" value={countVisibleAlerts(report.alerts)} helper="Sem mudanças de perfil" color="#7c3aed" />
            </div>

            <section style={{ margin: '4px 0 16px', border: '1px solid #dce9e0', borderRadius: 14, padding: '14px 15px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#ecfdf5', color: BRAND_PRIMARY, flexShrink: 0 }}><CalendarRange size={17} /></div>
                <div>
                  <p style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#3d8b5e' }}>Leitura de scouting do recorte</p>
                  <h2 style={{ fontSize: 14, color: '#173f26', marginTop: 3 }}>Critério de seleção da shortlist</h2>
                  <p style={{ fontSize: 10, color: '#475569', marginTop: 7, lineHeight: 1.55 }}>{REPORT_SCOUTING_NOTE}</p>
                  <p style={{ fontSize: 9.5, color: '#64748b', marginTop: 5, lineHeight: 1.5 }}>{REPORT_SCOUTING_COMPLEMENT}</p>
                  <p style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 7 }}>{report.filters.periodLabel} · Política {report.methodology?.marketPolicyVersion} · Motor {report.methodology?.calculationEngineVersion}</p>
                </div>
              </div>
            </section>

            <AlertsPanel alerts={report.alerts} onSelect={setSelection} />

            <div style={{ display: 'grid', gap: 13 }}>
              {report.leagues.map(league => (
                <LeagueSection key={league.slug} league={league} open={openLeagues.has(league.slug)} onToggle={() => toggleLeague(league.slug)} onSelect={setSelection} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ minHeight: 360, display: 'grid', placeItems: 'center', background: '#fff', border: '1px solid #e2ece5', borderRadius: 16, textAlign: 'center', padding: 28 }}>
            <div>
              <FileBarChart size={34} color="#94a3b8" />
              <h2 style={{ fontSize: 15, color: '#173f26', marginTop: 10 }}>Nenhum atleta contextual encontrado neste recorte</h2>
              <p style={{ fontSize: 10.5, color: '#64748b', marginTop: 6, maxWidth: 520, lineHeight: 1.5 }}>Selecione outro período, outras ligas ou inclua projetos de desenvolvimento. Atletas classificados como somente referência não entram no PDF.</p>
            </div>
          </div>
        )}
      </div>
      <PlayerModal selection={selection} onClose={() => setSelection(null)} />
    </AppShell>
  )
}

const filterLabelStyle = {
  fontSize: 8.5,
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
}

const selectStyle = {
  width: '100%',
  border: '1px solid #cfe0d4',
  borderRadius: 8,
  padding: '8px 9px',
  background: '#fff',
  color: '#173f26',
  fontSize: 10.5,
  fontWeight: 700,
  fontFamily: 'inherit',
  outline: 'none',
  minHeight: 36,
}
