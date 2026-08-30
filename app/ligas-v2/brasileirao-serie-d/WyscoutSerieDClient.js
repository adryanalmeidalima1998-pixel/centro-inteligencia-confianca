'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import {
  Button, C, EmptyState, Field, Kpi, LoadingState, PageHeader, Panel,
  ScoutingPage, StatusDot, Tabs, inputStyle,
} from '@/app/components/scouting/ScoutingUI'
import { playerProfilePath } from '@/data/player-route'
import { WYSCOUT_GROUP_LABELS, WYSCOUT_SERIE_D_METRICS } from '@/data/wyscout-seried'

const SLUG = 'brasileirao-serie-d'
const profileHref = player => player?._canonical_id ? `/database/${player._canonical_id}` : playerProfilePath(SLUG, player)

function num(value, decimals = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function Pos({ value }) {
  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{String(value || '').split(',').slice(0, 2).map(code => <span key={code} style={{ fontSize: 9, fontWeight: 900, color: C.blue, background: '#e8f1ff', borderRadius: 5, padding: '3px 6px' }}>{code.trim()}</span>)}</div>
}

function SourceNotice() {
  return <div style={{ padding: '11px 13px', borderRadius: 11, background: '#eef6ff', border: '1px solid #c9ddf8', color: '#24558a', fontSize: 10.5, lineHeight: 1.5 }}>
    <strong>Fluxo exclusivo Wyscout.</strong> Esta planilha traz cadastro, minutos, jogos, gols e xG. Não são calculados IAP Sportsbase, duelos, passe, condução ou recuperação. A triagem da Série D é deliberadamente separada para não misturar conceitos e unidades.
  </div>
}

function UploadPanel({ onSuccess }) {
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return setMessage({ ok: false, text: 'Selecione o export Wyscout em .xlsx.' })
    setLoading(true); setMessage(null)
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch(`/api/ligas-v2/${SLUG}/wyscout`, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha no upload.')
      setMessage({ ok: true, text: `${data.message} ${data.warnings?.[0] || ''}` })
      fileRef.current.value = ''
      onSuccess?.()
    } catch (error) { setMessage({ ok: false, text: error.message }) }
    finally { setLoading(false) }
  }
  return <Panel title="Atualizar Série D" subtitle="Export Wyscout · Search results" accent={C.blue}>
    <SourceNotice />
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ ...inputStyle, flex: 1, minWidth: 250 }} />
      <Button onClick={upload} disabled={loading}>{loading ? 'Processando...' : '⬆ Importar Wyscout'}</Button>
    </div>
    {message && <p style={{ marginTop: 10, color: message.ok ? C.green : C.red, fontSize: 11, fontWeight: 800 }}>{message.ok ? '✓' : '⚠'} {message.text}</p>}
    <div style={{ marginTop: 17, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 9 }}>
      {['Jogador · Equipa · Posição · Idade', 'Jogos · Minutos · Gols · xG', 'Contrato · Valor · Pé · Altura', 'Goleiros incluídos no universo'].map(item => <div key={item} style={{ padding: 10, background: '#fbfdff', border: '1px solid #dfebf7', borderRadius: 9, color: C.muted, fontSize: 10 }}>✓ {item}</div>)}
    </div>
  </Panel>
}

function PlayersTable({ players, sortKey, setSortKey }) {
  if (!players.length) return <EmptyState icon="🔎" title="Nenhum jogador no recorte" text="Ajuste busca, grupo posicional ou mínimo de minutos." />
  return <div style={{ overflowX: 'auto' }} className="scout-scroll">
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
      <thead><tr>{['#', 'Jogador', 'Equipe', 'Posição', 'Idade', 'Min', 'Jogos', 'Gols', 'Gols/90', 'xG', 'xG/90', 'Gols−xG', 'Mercado'].map(label => <th key={label} style={{ textAlign: label === 'Jogador' || label === 'Equipe' || label === 'Posição' ? 'left' : 'right', padding: '10px 9px', borderBottom: `1px solid ${C.line}`, color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</th>)}</tr></thead>
      <tbody>{players.map((player, index) => <tr key={`${player.nome}-${player.equipa}`} style={{ borderBottom: `1px solid ${C.line}` }}>
        <td style={{ padding: 10, color: C.muted, fontSize: 10 }}>{index + 1}</td>
        <td style={{ padding: 10 }}><Link href={profileHref(player)} style={{ color: C.green, fontSize: 11.5, fontWeight: 900, textDecoration: 'none' }}>{player.nome}</Link><p style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{player.pais || player.naturalidade || '—'}</p></td>
        <td style={{ padding: 10, color: C.ink, fontSize: 10.5 }}>{player.equipa}</td>
        <td style={{ padding: 10 }}><Pos value={player.posicao} /></td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10.5 }}>{player.idade || '—'}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10.5, fontWeight: 800 }}>{num(player.minutos, 0)}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10.5 }}>{num(player.jogos, 0)}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 11, fontWeight: 900, color: C.green }}>{num(player.gols, 0)}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10.5 }}>{num(player.gols_90, 2)}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10.5 }}>{num(player.xg, 2)}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10.5 }}>{num(player.xg_90, 2)}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10.5, color: Number(player.diferenca_gols_xg) >= 0 ? C.green : C.red }}>{Number(player.diferenca_gols_xg) > 0 ? '+' : ''}{num(player.diferenca_gols_xg, 2)}</td>
        <td style={{ padding: 10, textAlign: 'right', fontSize: 10 }}>{formatMoney(player.valor_mercado_num || player.valor_mercado)}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

function Teams({ players }) {
  const teams = useMemo(() => Object.values(players.reduce((acc, player) => {
    const name = player.equipa || 'Sem equipe'
    if (!acc[name]) acc[name] = { name, players: 0, minutes: 0, goals: 0, xg: 0, u23: 0 }
    acc[name].players += 1; acc[name].minutes += Number(player.minutos) || 0; acc[name].goals += Number(player.gols) || 0; acc[name].xg += Number(player.xg) || 0
    if (Number(player.idade) <= 23) acc[name].u23 += 1
    return acc
  }, {})).sort((a, b) => b.goals - a.goals || b.minutes - a.minutes), [players])
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(235px,1fr))', gap: 11 }}>
    {teams.map((team, index) => <div key={team.name} style={{ padding: 15, borderRadius: 13, border: `1px solid ${C.line}`, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><p style={{ fontSize: 9, color: C.muted, fontWeight: 900 }}>#{index + 1} · PRODUÇÃO DO ELENCO</p><h3 style={{ color: C.ink, fontSize: 13, fontWeight: 950, marginTop: 4 }}>{team.name}</h3></div><strong style={{ color: C.green, fontSize: 22 }}>{team.goals}</strong></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 13 }}>
        {[['Atletas', team.players], ['U23', team.u23], ['xG', num(team.xg, 1)], ['Min', num(team.minutes, 0)]].map(([label, value]) => <div key={label} style={{ background: '#f5f9f6', borderRadius: 8, padding: 8, textAlign: 'center' }}><strong style={{ display: 'block', color: C.ink, fontSize: 12 }}>{value}</strong><span style={{ color: C.muted, fontSize: 8.5 }}>{label}</span></div>)}
      </div>
    </div>)}
  </div>
}

function MarketMap({ players }) {
  const data = players.filter(player => Number.isFinite(Number(player.xg_90)) && Number.isFinite(Number(player.gols_90)) && player.grupo_posicional !== 'GK')
  return <Panel title="Mapa de produção ofensiva" subtitle="xG/90 × Gols/90; tamanho do ponto representa minutos. Use como triagem, não como avaliação final." bodyStyle={{ padding: 8 }}>
    <div style={{ height: 520 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 25, right: 30, bottom: 35, left: 15 }}>
          <CartesianGrid stroke="#e4eee7" strokeDasharray="4 4" />
          <XAxis type="number" dataKey="xg_90" name="xG/90" tick={{ fontSize: 10 }} label={{ value: 'xG/90', position: 'insideBottom', offset: -20, fontSize: 11 }} />
          <YAxis type="number" dataKey="gols_90" name="Gols/90" tick={{ fontSize: 10 }} label={{ value: 'Gols/90', angle: -90, position: 'insideLeft', fontSize: 11 }} />
          <ZAxis type="number" dataKey="minutos" range={[50, 420]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.[0]?.payload ? <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}><strong style={{ color: C.ink, fontSize: 11 }}>{payload[0].payload.nome}</strong><p style={{ color: C.muted, fontSize: 9 }}>{payload[0].payload.equipa} · {payload[0].payload.posicao}</p><p style={{ color: C.green, fontSize: 10, marginTop: 5 }}>Gols/90 {num(payload[0].payload.gols_90, 2)} · xG/90 {num(payload[0].payload.xg_90, 2)}</p></div> : null} />
          <Scatter data={data} fill="#0a66b7" fillOpacity={0.66} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  </Panel>
}

export default function WyscoutSerieDClient() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('players')
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('')
  const [group, setGroup] = useState('')
  const [minimum, setMinimum] = useState(270)
  const [sort, setSort] = useState('minutos')

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/api/ligas-v2/${SLUG}/wyscout`)
      const data = await response.json()
      setPayload(data)
      if (data.meta?.suggestedMinimum) setMinimum(data.meta.suggestedMinimum)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const all = payload?.jogadores || []
  const teams = useMemo(() => [...new Set(all.map(player => player.equipa).filter(Boolean))].sort(), [all])
  const filtered = useMemo(() => all.filter(player => {
    if (search && !`${player.nome} ${player.equipa}`.toLowerCase().includes(search.toLowerCase())) return false
    if (team && player.equipa !== team) return false
    if (group && player.grupo_posicional !== group) return false
    if (Number(player.minutos) < Number(minimum || 0)) return false
    return true
  }).sort((a, b) => (Number(b[sort]) || 0) - (Number(a[sort]) || 0)), [all, search, team, group, minimum, sort])

  if (loading) return <ScoutingPage><LoadingState text="Carregando fluxo Wyscout da Série D..." /></ScoutingPage>

  return <ScoutingPage maxWidth={1500}>
    <PageHeader eyebrow="BRASIL · MERCADO NACIONAL" title="Brasileirão Série D" subtitle="Fluxo próprio Wyscout para triagem cadastral e produção ofensiva básica, separado metodologicamente das competições Sportsbase." status={<StatusDot color={C.blue}>FONTE WYSCOUT</StatusDot>} actions={<Link href="/ligas-v2"><Button variant="secondary">← Todas as ligas</Button></Link>} />
    <Tabs active={tab} onChange={setTab} items={[{ id: 'players', label: 'Jogadores', icon: '👤' }, { id: 'teams', label: 'Clubes', icon: '🏟️' }, { id: 'map', label: 'Mapa de mercado', icon: '◉' }, { id: 'upload', label: 'Upload', icon: '⬆' }]} />

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 11, margin: '16px 0' }}>
      <Kpi label="Jogadores" value={payload?.meta?.players || 0} sub={`${payload?.meta?.teams || 0} clubes`} icon="👥" tone={C.blue} />
      <Kpi label="Elegíveis" value={filtered.length} sub={`Corte atual: ${minimum || 0} min`} icon="✓" />
      <Kpi label="Maior amostra" value={`${num(payload?.meta?.maxMinutes, 0)} min`} sub="Último export" icon="⏱️" tone={C.purple} />
      <Kpi label="Goleiros" value={payload?.meta?.positions?.GK || 0} sub="Presentes no arquivo" icon="🧤" tone={C.amber} />
    </div>

    {tab !== 'upload' && <SourceNotice />}

    {tab === 'players' && <Panel title="Ranking e busca" subtitle={`${filtered.length} jogadores elegíveis no contexto selecionado`} style={{ marginTop: 14 }} bodyStyle={{ padding: 0 }} action={<select value={sort} onChange={event => setSort(event.target.value)} style={{ ...inputStyle, width: 155 }}>{WYSCOUT_SERIE_D_METRICS.map(metric => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px,1.5fr) repeat(3,minmax(145px,.7fr))', gap: 9, padding: 15, borderBottom: `1px solid ${C.line}` }} className="scout-two-col">
        <Field label="Buscar"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Jogador ou clube" style={inputStyle} /></Field>
        <Field label="Clube"><select value={team} onChange={event => setTeam(event.target.value)} style={inputStyle}><option value="">Todos</option>{teams.map(name => <option key={name}>{name}</option>)}</select></Field>
        <Field label="Grupo"><select value={group} onChange={event => setGroup(event.target.value)} style={inputStyle}><option value="">Todos</option>{Object.entries(WYSCOUT_GROUP_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Mínimo de minutos"><input type="number" min="0" value={minimum} onChange={event => setMinimum(event.target.value)} style={inputStyle} /></Field>
      </div>
      <PlayersTable players={filtered} sortKey={sort} setSortKey={setSort} />
    </Panel>}

    {tab === 'teams' && <div style={{ marginTop: 14 }}><Teams players={all} /></div>}
    {tab === 'map' && <div style={{ marginTop: 14 }}><MarketMap players={filtered} /></div>}
    {tab === 'upload' && <div style={{ marginTop: 14 }}><UploadPanel onSuccess={load} /></div>}
  </ScoutingPage>
}
