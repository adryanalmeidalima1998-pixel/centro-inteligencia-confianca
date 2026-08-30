'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  C, ScoutingPage, PageHeader, Panel, Button, Kpi, Tabs, Field, inputStyle,
  EmptyState, LoadingState, StatusDot,
} from '@/app/components/scouting/ScoutingUI'
import {
  Plus, Trash2, Camera, FileText, FileCheck2, FileX2, X, UserRound, Building2,
  Users, ArrowRightLeft, CheckCircle2, AlertTriangle, Download, Image as ImageIcon, Search,
  Radar, ExternalLink, ArrowUpRight, ClipboardCheck, XCircle,
} from 'lucide-react'
import { playerFootLabel } from '@/data/player-foot'
import { usePermissions } from '@/app/lib/permissions'
import { exportCampinhoPNG, exportCampinhoPDF, exportBoardPDF } from '@/app/lib/transferroom/exportPdf'
import ELENCO_2026 from '@/data/elenco-2026'
import RADAR_MERCADO_2026 from '@/data/radar-mercado-2026'
import INDICACOES_CONCLUIDAS from '@/data/indicacoes-concluidas'

/* Meses na ordem cronológica para agrupar o Radar */
const MESES_ORDEM = ['Março/2026', 'Abril/2026', 'Maio/2026', 'Junho/2026', 'Julho/2026', 'Agosto/2026',
  'Setembro/2026', 'Outubro/2026', 'Novembro/2026', 'Dezembro/2026', 'Janeiro/2027', 'Fevereiro/2027']

/* ─────────────────────────────────────────────────────────────────────────────
   Taxonomia de posições — ordem, coordenadas no campo e profundidade ideal.
   'ideal' define a carência: 0 no elenco = sem cobertura; abaixo do ideal =
   pouca profundidade. x = profundidade (esquerda=defesa → direita=ataque),
   y = corredor (topo → base).
   ──────────────────────────────────────────────────────────────────────────── */
const POSICOES = [
  { key: 'Goleiro',           short: 'GOL', x: 8,  y: 50, ideal: 2 },
  { key: 'Lateral Esquerdo',  short: 'LE',  x: 23, y: 10, ideal: 2 },
  { key: 'Zagueiro Esquerdo', short: 'ZE',  x: 20, y: 37, ideal: 2 },
  { key: 'Zagueiro Direito',  short: 'ZD',  x: 20, y: 64, ideal: 2 },
  { key: 'Lateral Direito',   short: 'LD',  x: 23, y: 91, ideal: 2 },
  { key: 'Volante',           short: 'VOL', x: 38, y: 50, ideal: 3 },
  { key: 'Médio',             short: 'MED', x: 53, y: 28, ideal: 2 },
  { key: 'Meia Atacante',     short: 'MA',  x: 65, y: 66, ideal: 2 },
  { key: 'Ponta Esquerda',    short: 'PE',  x: 73, y: 12, ideal: 2 },
  { key: 'Ponta Direita',     short: 'PD',  x: 73, y: 88, ideal: 2 },
  { key: 'Centroavante',      short: 'CA',  x: 90, y: 50, ideal: 2 },
]
const POSICAO_KEYS = POSICOES.map(p => p.key)

/* Normaliza qualquer rótulo de posição (dos relatórios/entrada manual) para uma
   das chaves válidas do campo. Setores que se dividem (Extremo, Zagueiro, Lateral)
   caem num lado por padrão — dá pra mover o card depois. */
const _normPos = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const POSICAO_ALIAS = {
  'goleiro': 'Goleiro', 'gol': 'Goleiro',
  'lateral esquerdo': 'Lateral Esquerdo', 'lateral direito': 'Lateral Direito', 'lateral': 'Lateral Direito',
  'zagueiro esquerdo': 'Zagueiro Esquerdo', 'zagueiro direito': 'Zagueiro Direito', 'zagueiro': 'Zagueiro Esquerdo', 'zaga': 'Zagueiro Esquerdo',
  'volante': 'Volante', 'volante/meia central': 'Volante', 'primeiro volante': 'Volante',
  'medio': 'Médio', 'meia': 'Médio', 'meia central': 'Médio', 'meio-campista': 'Médio', 'meio campista': 'Médio', 'meia-volante': 'Médio',
  'meia atacante': 'Meia Atacante', 'meia ofensivo': 'Meia Atacante', 'segundo atacante': 'Meia Atacante',
  'ponta esquerda': 'Ponta Esquerda', 'ponta direita': 'Ponta Direita', 'ponta': 'Ponta Esquerda',
  'extremo': 'Ponta Esquerda', 'extremo-medio': 'Ponta Esquerda', 'meia-extremo': 'Ponta Esquerda', 'ala': 'Ponta Esquerda',
  'centroavante': 'Centroavante', 'atacante': 'Centroavante', 'centro avante': 'Centroavante',
}
function resolvePos(p) {
  if (!p) return null
  if (POSICAO_KEYS.includes(p)) return p
  return POSICAO_ALIAS[_normPos(p)] || null
}

const FOOT_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'direito', label: 'Direito' },
  { value: 'esquerdo', label: 'Esquerdo' },
  { value: 'ambos', label: 'Ambos' },
]

const ESCUDO = '/confianca.png'

/* Nome curto para as plaquinhas do campinho: "Luiz Carlos Paulino de Carvalho" → "Luiz Carvalho" */
function shortName(nome) {
  const tokens = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (tokens.length <= 2) return nome
  return `${tokens[0]} ${tokens[tokens.length - 1]}`
}

/* ─── Análise do elenco cadastrado (campinho + carências) ────────────────────── */
function buildElencoAnalysis(elencoByPos) {
  const zonas = POSICOES.map(pos => {
    const jogadores = elencoByPos[pos.key] || []
    const n = jogadores.length
    let status = 'ok'
    if (n === 0) status = 'critico'
    else if (n < pos.ideal) status = 'alerta'
    return { ...pos, jogadores, n, status }
  })
  return { zonas }
}

const ZONE_TONE = {
  ok:      { bg: C.green,  ring: '#0a4d2a', label: 'Coberta' },
  alerta:  { bg: C.amber,  ring: '#8a5606', label: 'Pouca profundidade' },
  critico: { bg: C.red,    ring: '#7f231c', label: 'Sem cobertura' },
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function TransferRoomPage() {
  const { canEdit } = usePermissions()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('recrutamento')
  const [addModal, setAddModal] = useState(null) // { posicao, tipo }

  async function load() {
    try {
      const r = await fetch('/api/transferroom')
      const d = await r.json()
      setPlayers(Array.isArray(d.players) ? d.players : [])
    } catch (_) { setPlayers([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const { byPosTipo, elencoByPos, radarDb } = useMemo(() => {
    const rec = {}
    for (const key of POSICAO_KEYS) rec[key] = { indicado: [], contratado: [] }
    rec['__sem_posicao__'] = { indicado: [], contratado: [] }
    const elencoMap = Object.fromEntries(POSICAO_KEYS.map(k => [k, []]))
    const radarDb = []
    for (const p of players) {
      if (p.tipo === 'elenco') {
        const g = resolvePos(p.posicao)
        if (g) elencoMap[g].push(p)
        continue
      }
      if (p.tipo === 'radar') { radarDb.push(p); continue }
      const key = resolvePos(p.posicao) || '__sem_posicao__'
      const tipo = p.tipo === 'contratado' ? 'contratado' : 'indicado'
      rec[key][tipo].push(p)
    }
    return { byPosTipo: rec, elencoByPos: elencoMap, radarDb }
  }, [players])

  const kpis = useMemo(() => {
    const indicados = players.filter(p => p.tipo === 'indicado').length
    const contratados = players.filter(p => p.tipo === 'contratado').length
    const noElenco = players.filter(p => p.tipo === 'elenco').length
    const noRadar = RADAR_MERCADO_2026.length + players.filter(p => p.tipo === 'radar').length
    return { indicados, contratados, noElenco, noRadar }
  }, [players])

  const elenco = useMemo(() => buildElencoAnalysis(elencoByPos), [elencoByPos])
  const carencias = elenco.zonas.filter(z => z.status !== 'ok')

  async function handleAdd(form, photoFile) {
    const r = await fetch('/api/transferroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json().catch(() => ({}))
    if (photoFile && d?.id) {
      const fd = new FormData()
      fd.append('id', d.id)
      fd.append('foto', photoFile)
      await fetch('/api/transferroom', { method: 'PATCH', body: fd })
    }
    setAddModal(null)
    await load()
  }

  async function handleDelete(id) {
    if (!confirm('Remover este jogador do TransferRoom?')) return
    await fetch(`/api/transferroom?id=${id}`, { method: 'DELETE' })
    await load()
  }

  async function handleUpload(id, field, file) {
    const fd = new FormData()
    fd.append('id', id)
    fd.append(field, file)
    await fetch('/api/transferroom', { method: 'PATCH', body: fd })
    await load()
  }

  const [importando, setImportando] = useState('')
  const [limpando, setLimpando] = useState(false)
  const orfaos = players.filter(p => !p.nome || !String(p.nome).trim()).length
  async function handleLimparVazios() {
    if (!confirm('Remover os registros vazios criados por importações que falharam?')) return
    setLimpando(true)
    try {
      await fetch('/api/transferroom?purge=vazios', { method: 'DELETE' })
      await load()
    } finally { setLimpando(false) }
  }
  async function bulkInsert(items) {
    await fetch('/api/transferroom', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk: items }),
    })
  }
  async function handleImportElenco() {
    if (!confirm(`Importar ${ELENCO_2026.length} atletas do Elenco 2026 para o campinho?`)) return
    setImportando('elenco')
    try {
      await bulkInsert(ELENCO_2026.map(p => ({ nome: p.nome, posicao: p.posicao, pe_preferido: p.pe_preferido || '', tipo: 'elenco' })))
      await load()
    } finally { setImportando('') }
  }
  async function handleImportIndicacoes() {
    if (!confirm(`Importar ${INDICACOES_CONCLUIDAS.length} indicações concluídas (com relatório)? Você anexa o PDF de cada uma depois.`)) return
    setImportando('indicacoes')
    try {
      await bulkInsert(INDICACOES_CONCLUIDAS.map(p => ({
        nome: p.nome, posicao: p.posicao, clube: p.clube, idade: p.idade || null,
        pe_preferido: p.pe_preferido || '', irc: p.irc || '', decisao: p.decisao || '', tipo: 'indicado',
      })))
      await load()
    } finally { setImportando('') }
  }
  // Promove um nome do radar para indicação concluída (abre o modal já preenchido)
  function handlePromover(nome, clube) {
    setAddModal({ posicao: POSICAO_KEYS[0], tipo: 'indicado', nome, clube })
  }
  async function handleAddRadar(mes) {
    setAddModal({ tipo: 'radar', mes })
  }

  async function handleRemoveAttach(id, field) {
    await fetch('/api/transferroom', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, remove: field }),
    })
    await load()
  }

  return (
    <ScoutingPage>
      <PageHeader
        eyebrow="CIC · RECRUTAMENTO"
        title="TransferRoom"
        subtitle="Confronto entre o que o scouting indicou e o que o clube contratou, posição por posição — e a leitura de carências do elenco atual."
        status={<StatusDot color={C.blue}>{players.length} atletas no board</StatusDot>}
      />

      {orfaos > 0 && canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: '#fff7eb', border: '1px solid #f5e2b8' }}>
          <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>
            ⚠️ {orfaos} registro(s) vazio(s) de importações anteriores. Recomendo limpar antes de reimportar.
          </span>
          <Button variant="secondary" onClick={handleLimparVazios} disabled={limpando} style={{ padding: '6px 11px' }}>
            <Trash2 size={13} /> {limpando ? 'Limpando…' : 'Limpar registros vazios'}
          </Button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 18 }} className="cig-stats-grid">
        <Kpi label="No radar" value={kpis.noRadar} sub="nomes pontuados no grupo" icon="📡" tone={C.amber} />
        <Kpi label="Indicações concluídas" value={kpis.indicados} sub="com relatório CIC" icon="✅" />
        <Kpi label="Contratados" value={kpis.contratados} sub="chegaram ao clube" icon="🤝" tone={C.blue} />
        <Kpi label="Carências no elenco" value={carencias.length} sub="posições a reforçar" icon="⚠️" tone={C.purple} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: 'radar', label: 'Radar de Mercado', icon: <Radar size={13} style={{ verticalAlign: '-2px' }} /> },
            { id: 'recrutamento', label: 'Indicações × Contratados', icon: <ArrowRightLeft size={13} style={{ verticalAlign: '-2px' }} /> },
            { id: 'elenco', label: 'Elenco · Campinho', icon: <Users size={13} style={{ verticalAlign: '-2px' }} /> },
          ]}
        />
      </div>

      {loading ? <LoadingState /> : tab === 'radar' ? (
        <RadarTab
          radarDb={radarDb}
          canEdit={canEdit}
          onAdd={handleAddRadar}
          onDelete={handleDelete}
          onPromover={handlePromover}
        />
      ) : tab === 'recrutamento' ? (
        <RecrutamentoTab
          byPosTipo={byPosTipo}
          canEdit={canEdit}
          onAdd={(posicao, tipo) => setAddModal({ posicao, tipo })}
          onDelete={handleDelete}
          onUpload={handleUpload}
          onRemoveAttach={handleRemoveAttach}
          onImport={handleImportIndicacoes}
          importando={importando}
        />
      ) : (
        <ElencoTab
          elenco={elenco}
          carencias={carencias}
          canEdit={canEdit}
          onAdd={(posicao) => setAddModal({ posicao, tipo: 'elenco' })}
          onDelete={handleDelete}
          onUpload={handleUpload}
          onImport={handleImportElenco}
          importando={importando === 'elenco'}
        />
      )}

      {addModal && (
        <AddModal
          initial={addModal}
          onClose={() => setAddModal(null)}
          onSave={handleAdd}
        />
      )}
    </ScoutingPage>
  )
}

const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Detecta clube estrangeiro (para o selo) — país entre parênteses ou lista conhecida.
const CLUBES_ESTRANGEIROS = [
  'feirense', 'porto b', 'sporting b', 'pacos de ferreira', 'ud leiria', 'farense', 'academico de viseu',
  'lusitania', 'felgueiras', 'desportivo de chaves', 'portimonense', 'torrense', 'cerro largo', 'delfin',
  'sportivo ameliano', 'olympiakos', 'nicosia', 'tai po', 'hong kong', 'portimonense', 'benfica b',
]
const PAISES = ['portugal', 'uruguai', 'venezuela', 'chipre', 'paraguai', 'equador', 'hong kong', 'argentina', 'colombia', 'bolivia', 'chile', 'espanha', 'italia']
function isEstrangeiro(clube) {
  const n = normalize(clube)
  if (!n) return false
  const par = n.match(/\(([^)]+)\)/)
  if (par && PAISES.some(p => par[1].includes(p))) return true
  return CLUBES_ESTRANGEIROS.some(c => n.includes(c)) || PAISES.some(p => n.includes(p))
}
const ircNum = v => { const m = String(v || '').replace(',', '.').match(/[\d.]+/); return m ? parseFloat(m[0]) : -1 }

/* Selo pequeno de atleta do exterior */
function SeloExterior({ clube }) {
  if (!isEstrangeiro(clube)) return null
  return (
    <span title={`Exterior — ${clube}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 5, background: '#eef4ff', color: C.blue, border: '1px solid #d6e4ff' }}>🌍 Exterior</span>
  )
}

/* Modal de preview do PDF do relatório (sem sair da página) */
function PdfModal({ player, onClose }) {
  const src = `/api/transferroom?pdf=${player.id}`
  return (
    <div onMouseDown={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(10,31,19,.6)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: 'min(920px,100%)', height: 'min(90vh,900px)', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <strong className="cig-truncate" style={{ fontSize: 13, color: C.ink, display: 'block' }}>Relatório CIC · {player.nome}</strong>
            <span style={{ fontSize: 10, color: C.muted }}>{[player.posicao, player.clube].filter(Boolean).join(' · ')}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={src} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, color: C.green, textDecoration: 'none' }}><ExternalLink size={13} /> Nova aba</a>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}><X size={20} /></button>
          </div>
        </div>
        <iframe src={src} title={`Relatório ${player.nome}`} style={{ flex: 1, border: 'none', width: '100%' }} />
      </div>
    </div>
  )
}

/* ─── ABA · Radar de Mercado (nomes pontuados no grupo, por mês) ───────────────── */
function RadarTab({ radarDb, canEdit, onAdd, onDelete, onPromover }) {
  const [q, setQ] = useState('')

  const porMes = useMemo(() => {
    const todos = [
      ...RADAR_MERCADO_2026.map(r => ({ ...r, fonte: 'base' })),
      ...radarDb.map(r => ({ mes: r.mes || 'Sem mês', nome: r.nome, clube: r.clube || '', link: r.link || '', autor: r.observacoes || '', id: r.id, posicao: r.posicao, fonte: 'db' })),
    ]
    const match = r => !q.trim() || normalize(r.nome).includes(normalize(q)) || normalize(r.clube).includes(normalize(q))
    const map = {}
    for (const r of todos.filter(match)) (map[r.mes] ||= []).push(r)
    const ordered = MESES_ORDEM.filter(m => map[m])
    const extras = Object.keys(map).filter(m => !MESES_ORDEM.includes(m))
    return [...ordered, ...extras].map(m => [m, map[m].sort((a, b) => a.nome.localeCompare(b.nome))])
  }, [radarDb, q])

  const total = porMes.reduce((a, [, l]) => a + l.length, 0)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: 10, color: C.muted }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome ou clube no radar…" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>{total} nome(s){q.trim() ? ' encontrados' : ' no radar'}</span>
      </div>

      <p style={{ fontSize: 10.5, color: C.muted, marginTop: -6, lineHeight: 1.5 }}>
        Nomes <strong>pontuados</strong> no grupo — opções e candidatos comentados, ainda sem relatório fechado.
        Quando um vira indicação concluída (com relatório), use <ArrowUpRight size={11} style={{ verticalAlign: '-1px' }} /> para promovê-lo.
      </p>

      {porMes.map(([mes, itens]) => (
        <Panel
          key={mes}
          title={mes}
          subtitle={`${itens.length} nome(s) pontuado(s)`}
          accent={C.amber}
          action={canEdit ? (
            <button onClick={() => onAdd(mes)} title="Adicionar nome" style={{ border: `1px solid ${C.amber}40`, background: `${C.amber}12`, color: C.amber, borderRadius: 8, height: 28, padding: '0 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800 }}>
              <Plus size={13} /> Nome
            </button>
          ) : null}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(215px,1fr))', gap: 9 }}>
            {itens.map((r, i) => (
              <div key={r.id || `${mes}-${i}`} className="scout-hover" style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <strong className="cig-truncate" style={{ fontSize: 11.5, color: C.ink, fontWeight: 900 }}>{r.nome}</strong>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noreferrer" title="Abrir perfil" style={{ color: C.blue }}><ExternalLink size={13} /></a>
                    )}
                    {canEdit && (
                      <button onClick={() => onPromover(r.nome, r.clube)} title="Promover a indicação" style={{ border: 'none', background: 'none', color: C.green, cursor: 'pointer', padding: 0 }}><ArrowUpRight size={14} /></button>
                    )}
                    {canEdit && r.id && (
                      <button onClick={() => onDelete(r.id)} title="Remover" style={{ border: 'none', background: 'none', color: C.red, cursor: 'pointer', padding: 0 }}><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontSize: 9, color: C.muted, alignItems: 'center' }}>
                  {r.clube && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Building2 size={10} />{r.clube}</span>}
                  <SeloExterior clube={r.clube} />
                  {r.posicao && <span>{r.posicao}</span>}
                  {r.autor && <span>· {r.autor}</span>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  )
}

/* ─── ABA · Indicações concluídas × Contratados por posição ───────────────────── */

function RecrutamentoTab({ byPosTipo, canEdit, onAdd, onDelete, onUpload, onRemoveAttach, onImport, importando }) {
  const [q, setQ] = useState('')
  const [exporting, setExporting] = useState(false)
  const semIndicacoes = POSICOES.every(p => (byPosTipo[p.key]?.indicado || []).length === 0)

  const matches = p => {
    if (!q.trim()) return true
    const n = normalize(q)
    return normalize(p.nome).includes(n) || normalize(p.clube).includes(n)
  }

  const filtrar = pos => {
    const g = byPosTipo[pos] || { indicado: [], contratado: [] }
    const porIrc = (a, b) => ircNum(b.irc) - ircNum(a.irc)
    return { indicado: g.indicado.filter(matches).sort(porIrc), contratado: g.contratado.filter(matches) }
  }

  const semPos = filtrar('__sem_posicao__')
  const temSemPos = semPos.indicado.length + semPos.contratado.length > 0
  const totalResultados = POSICOES.reduce((acc, p) => { const g = filtrar(p.key); return acc + g.indicado.length + g.contratado.length }, 0) + semPos.indicado.length + semPos.contratado.length

  async function handleExport() {
    setExporting(true)
    try {
      const rows = POSICOES.map(p => ({ pos: p.key, indicados: byPosTipo[p.key]?.indicado || [], contratados: byPosTipo[p.key]?.contratado || [] }))
      const sp = byPosTipo['__sem_posicao__']
      if (sp && (sp.indicado.length || sp.contratado.length)) rows.push({ pos: 'Sem posição', indicados: sp.indicado, contratados: sp.contratado })
      await exportBoardPDF(rows)
    } finally { setExporting(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: 10, color: C.muted }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou clube…" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && semIndicacoes && (
            <Button onClick={onImport} disabled={importando === 'indicacoes'}>
              <ClipboardCheck size={15} /> {importando === 'indicacoes' ? 'Importando…' : 'Importar indicações concluídas'}
            </Button>
          )}
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Gerando…' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      {q.trim() && (
        <p style={{ fontSize: 10.5, color: C.muted, marginTop: -6 }}>
          {totalResultados} resultado(s) para “{q}”.{totalResultados === 0 ? ' Nenhum jogador encontrado.' : ''}
        </p>
      )}

      {!q.trim() && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {POSICOES.map(pos => {
            const g = byPosTipo[pos.key] || { indicado: [], contratado: [] }
            const ind = g.indicado.length, con = g.contratado.length
            if (!ind && !con) return null
            return (
              <span key={pos.key} title={pos.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, background: '#fff', border: `1px solid ${C.line}`, fontSize: 9.5, fontWeight: 800 }}>
                <span style={{ color: C.muted }}>{pos.short}</span>
                <span style={{ color: C.green }}>{ind} ind.</span>
                <span style={{ color: C.line }}>|</span>
                <span style={{ color: C.blue }}>{con} contr.</span>
              </span>
            )
          })}
        </div>
      )}

      {POSICOES.map(pos => {
        const grupo = filtrar(pos.key)
        if (q.trim() && grupo.indicado.length + grupo.contratado.length === 0) return null
        return (
          <PositionRow
            key={pos.key}
            pos={pos}
            indicados={grupo.indicado}
            contratados={grupo.contratado}
            canEdit={canEdit}
            onAdd={onAdd}
            onDelete={onDelete}
            onUpload={onUpload}
            onRemoveAttach={onRemoveAttach}
          />
        )
      })}

      {temSemPos && (
        <PositionRow
          pos={{ key: 'Sem posição definida', short: '—' }}
          indicados={semPos.indicado}
          contratados={semPos.contratado}
          canEdit={false}
          onAdd={() => {}}
          onDelete={onDelete}
          onUpload={onUpload}
          onRemoveAttach={onRemoveAttach}
        />
      )}
    </div>
  )
}

function PositionRow({ pos, indicados, contratados, canEdit, onAdd, onDelete, onUpload, onRemoveAttach }) {
  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 8.5, fontWeight: 900, padding: '3px 7px', borderRadius: 6, background: C.green, color: '#fff', letterSpacing: '.4px' }}>{pos.short}</span>
        {pos.key}
      </span>}
      subtitle={`${indicados.length} indicado(s) · ${contratados.length} contratado(s)`}
      accent={C.green}
      bodyStyle={{ padding: 16 }}
    >
      <div className="cig-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Column
          titulo="Recomendação do scouting"
          cor={C.green}
          jogadores={indicados}
          vazio="Nenhuma indicação para esta posição"
          canEdit={canEdit}
          onAdd={canEdit && pos.short !== '—' ? () => onAdd(pos.key, 'indicado') : null}
          onDelete={onDelete}
          onUpload={onUpload}
          onRemoveAttach={onRemoveAttach}
        />
        <Column
          titulo="Contratados"
          cor={C.blue}
          jogadores={contratados}
          vazio="Ninguém contratado ainda"
          canEdit={canEdit}
          onAdd={canEdit && pos.short !== '—' ? () => onAdd(pos.key, 'contratado') : null}
          onDelete={onDelete}
          onUpload={onUpload}
          onRemoveAttach={onRemoveAttach}
        />
      </div>
    </Panel>
  )
}

function Column({ titulo, cor, jogadores, vazio, canEdit, onAdd, onDelete, onUpload, onRemoveAttach }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg, overflow: 'hidden' }}>
      <div style={{ padding: '9px 12px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.5px', color: cor }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
          {titulo}
        </span>
        {onAdd && (
          <button onClick={onAdd} title="Adicionar" style={{ border: `1px solid ${cor}40`, background: `${cor}12`, color: cor, borderRadius: 8, width: 26, height: 26, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <Plus size={15} />
          </button>
        )}
      </div>
      <div style={{ padding: 12, display: 'grid', gap: 10 }}>
        {jogadores.length === 0 ? (
          <p style={{ fontSize: 10.5, color: C.muted, textAlign: 'center', padding: '14px 6px' }}>{vazio}</p>
        ) : jogadores.map(p => (
          <PlayerCard
            key={p.id}
            player={p}
            cor={cor}
            canEdit={canEdit}
            onDelete={onDelete}
            onUpload={onUpload}
            onRemoveAttach={onRemoveAttach}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Card do jogador ─────────────────────────────────────────────────────────── */
function PlayerCard({ player, cor, canEdit, onDelete, onUpload, onRemoveAttach }) {
  const fotoRef = useRef(null)
  const pdfRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [showPdf, setShowPdf] = useState(false)
  const temRel = Boolean(player.tem_relatorio)

  async function upload(field, file) {
    if (!file) return
    setBusy(true)
    await onUpload(player.id, field, file)
    setBusy(false)
  }

  return (
    <div className="scout-hover" style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12 }}>
      {/* Foto */}
      <div>
        <button
          onClick={() => canEdit && fotoRef.current?.click()}
          title={canEdit ? 'Anexar foto' : ''}
          style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.line}`, background: C.green2, display: 'grid', placeItems: 'center', cursor: canEdit ? 'pointer' : 'default', padding: 0 }}
        >
          {player.tem_foto
            ? <img src={`/api/transferroom?foto=${player.id}`} alt={player.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ display: 'grid', placeItems: 'center', gap: 2, color: C.green }}><Camera size={16} /><span style={{ fontSize: 7, fontWeight: 800 }}>FOTO</span></span>}
        </button>
        <input ref={fotoRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; upload('foto', f); e.target.value = '' }} />
      </div>

      {/* Dados */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <strong className="cig-truncate" style={{ fontSize: 12.5, color: C.ink, fontWeight: 900 }}>{player.nome}</strong>
          {canEdit && (
            <button onClick={() => onDelete(player.id)} title="Remover" style={{ border: 'none', background: 'none', color: C.red, cursor: 'pointer', padding: 2, flexShrink: 0 }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6, fontSize: 9.5, color: C.muted, alignItems: 'center' }}>
          {player.clube && <Meta icon={<Building2 size={10} />}>{player.clube}</Meta>}
          <SeloExterior clube={player.clube} />
          {player.idade != null && <Meta icon={<UserRound size={10} />}>{player.idade} anos</Meta>}
          {player.pe_preferido && <Meta>Pé {playerFootLabel(player.pe_preferido)}</Meta>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
          {player.posicao && (
            <span style={{ fontSize: 8.5, fontWeight: 850, padding: '3px 7px', borderRadius: 6, background: `${cor}12`, color: cor, border: `1px solid ${cor}25` }}>{player.posicao}</span>
          )}
          {player.irc && (
            <span style={{ fontSize: 8.5, fontWeight: 900, padding: '3px 7px', borderRadius: 6, background: C.bg, color: C.ink, border: `1px solid ${C.line}` }}>IRC {player.irc}</span>
          )}
          {player.decisao && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8.5, fontWeight: 900, padding: '3px 7px', borderRadius: 6,
              background: player.decisao.toLowerCase().includes('não') ? '#fbe6e4' : C.green2,
              color: player.decisao.toLowerCase().includes('não') ? C.red : C.green,
              border: `1px solid ${player.decisao.toLowerCase().includes('não') ? '#f3c9c5' : C.green3}` }}>
              {player.decisao.toLowerCase().includes('não') ? <XCircle size={10} /> : <CheckCircle2 size={10} />}{player.decisao}
            </span>
          )}
        </div>

        {/* Sinalização automática de relatório */}
        <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {temRel ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 900, padding: '4px 8px', borderRadius: 99, background: C.green2, color: C.green, border: `1px solid ${C.green3}` }}>
              <FileCheck2 size={11} /> Relatório de scouting feito
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 900, padding: '4px 8px', borderRadius: 99, background: '#fff7eb', color: C.amber, border: '1px solid #f5e2b8' }}>
              <FileX2 size={11} /> Sem relatório
            </span>
          )}
        </div>

        {/* Ações de anexo */}
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {temRel && (
            <button onClick={() => setShowPdf(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 800, padding: '5px 9px', borderRadius: 8, border: `1px solid ${C.line}`, color: C.green, background: '#fff', cursor: 'pointer' }}>
              <FileText size={11} /> Ver PDF
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => pdfRef.current?.click()} disabled={busy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 800, padding: '5px 9px', borderRadius: 8, border: `1px solid ${C.line}`, color: C.muted, background: '#fff', cursor: 'pointer' }}>
                <FileText size={11} /> {busy ? 'Enviando…' : temRel ? 'Trocar PDF' : 'Anexar relatório'}
              </button>
              {temRel && (
                <button onClick={() => onRemoveAttach(player.id, 'pdf')} title="Remover relatório"
                  style={{ border: `1px solid ${C.line}`, background: '#fff', color: C.red, borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>
                  <X size={11} />
                </button>
              )}
            </>
          )}
          <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; upload('pdf', f); e.target.value = '' }} />
        </div>
      </div>
      {showPdf && <PdfModal player={player} onClose={() => setShowPdf(false)} />}
    </div>
  )
}

function Meta({ icon, children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{icon}{children}</span>
}

/* ─── ABA 2 · Elenco em campinho + carências ─────────────────────────────────── */
function ElencoTab({ elenco, carencias, canEdit, onAdd, onDelete, onUpload, onImport, importando }) {
  const [exporting, setExporting] = useState('')
  const totalElenco = elenco.zonas.reduce((acc, z) => acc + z.n, 0)

  async function exportar(tipo) {
    setExporting(tipo)
    try {
      if (tipo === 'png') await exportCampinhoPNG(elenco.zonas)
      else await exportCampinhoPDF(elenco.zonas)
    } finally { setExporting('') }
  }

  const exportActions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {canEdit && totalElenco === 0 && (
        <Button onClick={onImport} disabled={importando} style={{ padding: '7px 11px' }}>
          <Download size={14} /> {importando ? 'Importando…' : 'Importar elenco 2026'}
        </Button>
      )}
      <Button variant="secondary" onClick={() => exportar('png')} disabled={!!exporting || totalElenco === 0} style={{ padding: '7px 11px' }}>
        <ImageIcon size={14} /> {exporting === 'png' ? 'Gerando…' : 'PNG'}
      </Button>
      <Button variant="secondary" onClick={() => exportar('pdf')} disabled={!!exporting || totalElenco === 0} style={{ padding: '7px 11px' }}>
        <Download size={14} /> {exporting === 'pdf' ? 'Gerando…' : 'PDF'}
      </Button>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Panel
        title="Elenco 2026 · plantel por posição"
        subtitle={canEdit ? 'Cadastre seus atletas por posição — clique no + de cada setor. A foto entra no cadastro ou clicando no avatar da plaquinha.' : 'Atletas do elenco distribuídos no campo, da defesa ao ataque'}
        accent={C.green}
        action={exportActions}
        bodyStyle={{ padding: 14 }}
      >
        {totalElenco === 0 && (
          <div style={{ marginBottom: 12 }}>
            <EmptyState
              icon="👥"
              title="Elenco ainda vazio"
              text={canEdit ? 'Clique em “Importar elenco 2026” para preencher o campinho com o plantel, ou use o + de cada posição para cadastrar manualmente.' : 'Nenhum atleta cadastrado no elenco até o momento.'}
            />
          </div>
        )}
        <div className="scout-scroll" style={{ overflowX: 'auto' }}>
          <Pitch zonas={elenco.zonas} canEdit={canEdit} onAdd={onAdd} onDelete={onDelete} onUpload={onUpload} />
        </div>
      </Panel>

      <div className="cig-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Panel
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={14} color={C.amber} />{carencias.length} carência(s) no elenco</span>}
          subtitle="Posições que precisam de reforço"
        >
          {carencias.length === 0 ? (
            <EmptyState icon="✅" title="Elenco equilibrado" text="Todas as posições têm profundidade adequada segundo o padrão configurado." />
          ) : (
            <div style={{ display: 'grid', gap: 9 }}>
              {carencias.map(z => {
                const tone = ZONE_TONE[z.status]
                return (
                  <div key={z.key} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: `${tone.bg}0d`, border: `1px solid ${tone.bg}2e` }}>
                    <span style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: tone.bg, color: '#fff', fontSize: 10, fontWeight: 900 }}>{z.short}</span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 11.5, color: C.ink }}>{z.key}</strong>
                      <p style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                        {z.n === 0 ? 'Nenhum atleta no elenco para esta função' : `Apenas ${z.n} atleta(s) — ideal ${z.ideal}`}
                      </p>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 900, color: tone.bg, whiteSpace: 'nowrap' }}>{tone.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel title="Distribuição completa" subtitle="Atletas por posição no elenco" bodyStyle={{ padding: 0 }}>
          <div style={{ display: 'grid' }}>
            {elenco.zonas.map((z, i) => {
              const tone = ZONE_TONE[z.status]
              return (
                <div key={z.key} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '10px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: `${tone.bg}18`, color: tone.bg, fontSize: 8.5, fontWeight: 900 }}>{z.short}</span>
                  <span style={{ fontSize: 11, color: C.ink, fontWeight: 700 }}>{z.key}</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: z.status === 'ok' ? C.green : tone.bg }}>{z.n}<span style={{ fontSize: 8.5, color: C.muted, fontWeight: 700 }}> / {z.ideal}</span></span>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* Campinho horizontal estilo "Elenco 2026": cada posição é uma pilha vertical de
   plaquinhas nominais (foto + nome + escudo), cadastradas pelo usuário. Um pontinho
   de status no rótulo do setor sinaliza a carência sem poluir as plaquinhas. */
function Pitch({ zonas, canEdit, onAdd, onDelete, onUpload }) {
  return (
    <div style={{
      position: 'relative', width: '100%', minWidth: 1020, height: 620, borderRadius: 16,
      background: 'linear-gradient(90deg,#0a5c31 0%,#0c6b3a 50%,#0a5c31 100%)', overflow: 'hidden',
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.10)',
    }}>
      {/* Faixas verticais do gramado */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 12.5}%`, width: '12.5%', background: i % 2 ? 'rgba(255,255,255,.04)' : 'transparent' }} />
      ))}
      {/* Linhas do campo (horizontal) */}
      <div style={{ position: 'absolute', inset: 12, border: '2px solid rgba(255,255,255,.26)', borderRadius: 8 }} />
      <div style={{ position: 'absolute', top: 12, bottom: 12, left: '50%', width: 2, background: 'rgba(255,255,255,.26)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 96, height: 96, border: '2px solid rgba(255,255,255,.26)', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
      {/* Áreas (esquerda / direita) */}
      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: '13%', height: '54%', border: '2px solid rgba(255,255,255,.22)', borderLeft: 'none' }} />
      <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: '13%', height: '54%', border: '2px solid rgba(255,255,255,.22)', borderRight: 'none' }} />

      {/* Pilhas de jogadores por posição */}
      {zonas.map(z => {
        const tone = ZONE_TONE[z.status]
        return (
          <div key={z.key} style={{ position: 'absolute', top: `${z.y}%`, left: `${z.x}%`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 160 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 8, fontWeight: 900, letterSpacing: '.6px', color: 'rgba(255,255,255,.82)', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.bg, boxShadow: '0 0 0 1.5px rgba(255,255,255,.5)' }} />
              {z.key.toUpperCase()}
              {canEdit && (
                <button onClick={() => onAdd(z.key)} title={`Adicionar ${z.key}`} style={{ marginLeft: 2, width: 15, height: 15, borderRadius: '50%', border: '1px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, lineHeight: 0 }}>
                  <Plus size={10} />
                </button>
              )}
            </span>
            {z.jogadores.length === 0 ? (
              <button
                onClick={() => canEdit && onAdd(z.key)}
                disabled={!canEdit}
                style={{ padding: '7px 12px', borderRadius: 999, border: '1px dashed rgba(255,255,255,.35)', background: 'transparent', color: 'rgba(255,255,255,.7)', fontSize: 8.5, fontWeight: 800, cursor: canEdit ? 'pointer' : 'default' }}
              >
                {canEdit ? '+ Adicionar' : 'Sem atletas'}
              </button>
            ) : z.jogadores.map(j => (
              <PlayerPill key={j.id} player={j} canEdit={canEdit} onDelete={onDelete} onUpload={onUpload} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function PlayerPill({ player, canEdit, onDelete, onUpload }) {
  const fotoRef = useRef(null)
  const [hover, setHover] = useState(false)

  return (
    <div
      title={player.nome}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'grid', gridTemplateColumns: '26px 1fr 16px', alignItems: 'center', gap: 6, width: '100%',
        padding: '3px 8px 3px 3px', borderRadius: 999,
        background: 'linear-gradient(180deg,#0c6b3a 0%,#064a26 100%)',
        border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 3px 8px rgba(0,0,0,.28)',
      }}
    >
      {/* Avatar / foto (clicável para anexar) */}
      <button
        onClick={() => canEdit && fotoRef.current?.click()}
        title={canEdit ? 'Trocar foto' : ''}
        style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: '#0a3d20', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.22)', cursor: canEdit ? 'pointer' : 'default', padding: 0 }}
      >
        {player.tem_foto
          ? <img src={`/api/transferroom?foto=${player.id}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <UserRound size={13} color="rgba(255,255,255,.85)" />}
      </button>
      <input ref={fotoRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(player.id, 'foto', f); e.target.value = '' }} />

      <span className="cig-truncate" style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', letterSpacing: '.2px', textTransform: 'uppercase' }}>{shortName(player.nome)}</span>
      <img src={ESCUDO} alt="" style={{ width: 16, height: 16, objectFit: 'contain', opacity: .95 }} />

      {/* Botão remover (aparece no hover) */}
      {canEdit && hover && (
        <button
          onClick={() => onDelete(player.id)}
          title="Remover do elenco"
          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: C.red, color: '#fff', border: '2px solid #fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,.3)' }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

/* ─── Modal de adicionar jogador ─────────────────────────────────────────────── */
const DECISAO_OPTIONS = ['', 'Contratação', 'Não contratação', 'Prospecção']

function AddModal({ initial, onClose, onSave }) {
  const isElenco = initial.tipo === 'elenco'
  const isRadar = initial.tipo === 'radar'
  const isIndicado = initial.tipo === 'indicado'
  const [form, setForm] = useState({
    nome: initial.nome || '', clube: initial.clube || '', idade: '', posicao: initial.posicao || POSICAO_KEYS[0],
    pe_preferido: '', tipo: initial.tipo || 'indicado', observacoes: '',
    mes: initial.mes || MESES_ORDEM[0], link: '', irc: '', decisao: '',
  })
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fotoRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function pickPhoto(file) { if (!file) return; setPhoto(file); setPreview(URL.createObjectURL(file)) }

  async function submit() {
    if (!form.nome.trim()) return
    setSaving(true)
    await onSave({ ...form, idade: form.idade ? Number(form.idade) : null }, photo)
    setSaving(false)
  }

  const titulo = isRadar ? 'Adicionar nome ao radar'
    : isElenco ? 'Adicionar ao elenco'
    : form.tipo === 'contratado' ? 'Adicionar contratado' : 'Adicionar indicação'

  return (
    <div onMouseDown={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(10,31,19,.5)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="cig-modal" style={{ width: 'min(460px,100%)', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,.3)' }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>{titulo}</h2>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{isRadar ? form.mes : form.posicao}</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}><X size={20} /></button>
        </div>

        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          {/* Foto — só quando não é radar */}
          {!isRadar && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => fotoRef.current?.click()} title="Selecionar foto"
                style={{ width: 60, height: 60, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}`, background: C.green2, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                {preview
                  ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ display: 'grid', placeItems: 'center', gap: 2, color: C.green }}><Camera size={17} /><span style={{ fontSize: 7, fontWeight: 800 }}>FOTO</span></span>}
              </button>
              <div>
                <Button variant="secondary" onClick={() => fotoRef.current?.click()} style={{ padding: '7px 11px' }}>
                  <Camera size={13} /> {preview ? 'Trocar foto' : 'Anexar foto'}
                </Button>
                <p style={{ fontSize: 9, color: C.muted, marginTop: 5 }}>Opcional — dá pra trocar depois no card.</p>
              </div>
              <input ref={fotoRef} type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          )}

          <Field label="Nome do atleta">
            <input autoFocus value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: João Silva" style={inputStyle} />
          </Field>

          {isRadar ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Clube"><input value={form.clube} onChange={e => set('clube', e.target.value)} placeholder="Clube atual" style={inputStyle} /></Field>
                <Field label="Mês">
                  <select value={form.mes} onChange={e => set('mes', e.target.value)} style={inputStyle}>
                    {MESES_ORDEM.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Posição (opcional)">
                  <select value={form.posicao} onChange={e => set('posicao', e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    {POSICAO_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="Link (opcional)"><input value={form.link} onChange={e => set('link', e.target.value)} placeholder="ogol / transfermarkt" style={inputStyle} /></Field>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
                <Field label="Clube"><input value={form.clube} onChange={e => set('clube', e.target.value)} placeholder="Clube atual" style={inputStyle} /></Field>
                <Field label="Idade"><input type="number" min="14" max="45" value={form.idade} onChange={e => set('idade', e.target.value)} placeholder="—" style={inputStyle} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Posição">
                  <select value={form.posicao} onChange={e => set('posicao', e.target.value)} style={inputStyle}>
                    {POSICAO_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="Pé preferido">
                  <select value={form.pe_preferido} onChange={e => set('pe_preferido', e.target.value)} style={inputStyle}>
                    {FOOT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              {isIndicado && (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
                  <Field label="IRC"><input value={form.irc} onChange={e => set('irc', e.target.value)} placeholder="ex.: 3,6" style={inputStyle} /></Field>
                  <Field label="Decisão">
                    <select value={form.decisao} onChange={e => set('decisao', e.target.value)} style={inputStyle}>
                      {DECISAO_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  </Field>
                </div>
              )}
              {!isElenco && (
                <Field label="Tipo">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: 'indicado', l: 'Indicação (com relatório)' }, { v: 'contratado', l: 'Contratado' }].map(opt => (
                      <button key={opt.v} onClick={() => set('tipo', opt.v)}
                        style={{ flex: 1, padding: '9px 8px', borderRadius: 9, fontSize: 10.5, fontWeight: 850, cursor: 'pointer',
                          border: `1px solid ${form.tipo === opt.v ? C.green : C.line}`,
                          background: form.tipo === opt.v ? C.green2 : '#fff',
                          color: form.tipo === opt.v ? C.green : C.muted }}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
            </>
          )}

          <Field label="Observações (opcional)">
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} placeholder="Notas rápidas…" style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        </div>

        <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !form.nome.trim()}>
            <CheckCircle2 size={14} /> {saving ? 'Salvando…' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
