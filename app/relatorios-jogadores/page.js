'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'
import {
  Plus, Search, X, Trash2, Pencil, Download, FileText, Link2,
  ChevronUp, ChevronDown, Users, FolderPlus, ExternalLink, Check,
} from 'lucide-react'
import { gerarPdfRelatorioJogadores } from '@/app/lib/relatorios/gerarPdfRelatorioJogadores'

const GFC = '#0a66b7'
const GFC_DARK = '#064b82'

// Grupos por posição — precisam bater com o gerador de PDF.
const GRUPOS = [
  { id: 'GOL', label: 'Goleiros',      short: 'GOL', color: '#ea580c' },
  { id: 'ZAG', label: 'Zagueiros',     short: 'ZAG', color: '#2563eb' },
  { id: 'LAT', label: 'Laterais',      short: 'LAT', color: '#0d9488' },
  { id: 'VOL', label: 'Volantes',      short: 'VOL', color: '#7c3aed' },
  { id: 'MEI', label: 'Meias',         short: 'MEI', color: '#4f46e5' },
  { id: 'EXT', label: 'Extremos',      short: 'EXT', color: '#db2777' },
  { id: 'CA',  label: 'Centroavantes', short: 'CA',  color: '#dc2626' },
]
const GRUPO_MAP = Object.fromEntries(GRUPOS.map(g => [g.id, g]))

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// Detecta o grupo a partir do texto de posição (Wyscout / oGol / manual).
function detectGrupo(posicao) {
  const p = String(posicao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const first = (p.split(/[,/\s]+/)[0] || p)
  if (/gk|gr|gl|goleiro/.test(p)) return 'GOL'
  if (/(^|[^a-z])(rw|lw|wf|w)([^a-z]|$)|ponta|extremo|winger|alero/.test(p)) return 'EXT'
  if (/cf|st|ss|centroavante|atacante|striker|forward/.test(p)) return 'CA'
  if (/dmf|dm|dmc|volante|first ?volante|primeiro ?volante/.test(p)) return 'VOL'
  if (/amf|cam|(^|[^a-z])am([^a-z]|$)|cmf|(^|[^a-z])cm([^a-z]|$)|meia|midfield|trequartista/.test(p)) return 'MEI'
  if (/rb|lb|wb|rwb|lwb|lateral|fullback|wing.?back/.test(first) || /lateral|fullback|wing.?back/.test(p)) return 'LAT'
  if (/cb|zagueiro|central|defender/.test(p)) return 'ZAG'
  return 'MEI'
}

function normalizeUrl(u) {
  const s = String(u || '').trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : 'https://' + s
}

// ─── Modal: adicionar jogador (busca no banco + cadastro manual) ─────────────
function AddModal({ onClose, onAdd }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [form, setForm] = useState({ nome: '', idade: '', posicao: '', clube: '', link: '', grupo: 'MEI' })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const debounceRef = useRef(null)

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/relatorios-jogadores/buscar?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        setResultados(data.jogadores || [])
      } catch (_) { setResultados([]) }
      finally { setBuscando(false) }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [q])

  function selecionar(r) {
    setForm({
      nome: r.nome || '',
      idade: r.idade ? String(r.idade) : '',
      posicao: r.posicao || '',
      clube: r.clube || '',
      link: '',
      grupo: detectGrupo(r.posicao),
    })
    setResultados([])
    setQ('')
  }

  function confirmar() {
    if (!form.nome.trim()) { alert('Informe o nome do jogador.'); return }
    onAdd({
      id: uid(),
      nome: form.nome.trim(),
      idade: form.idade ? parseInt(form.idade, 10) : null,
      posicao: form.posicao.trim(),
      clube: form.clube.trim(),
      link: form.link.trim(),
      grupo: form.grupo,
    })
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef3ef', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', borderRadius: '18px 18px 0 0' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#10233b' }}>Adicionar jogador</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Busca no banco */}
          <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Buscar no banco de dados</label>
          <div style={{ position: 'relative', marginTop: 6 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: '#94a3b8' }} />
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Digite o nome do jogador…"
              style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid #d7e3db', borderRadius: 10, fontSize: 13, outline: 'none' }}
            />
          </div>
          {(buscando || resultados.length > 0) && (
            <div style={{ marginTop: 6, border: '1px solid #eef3ef', borderRadius: 10, maxHeight: 220, overflow: 'auto' }}>
              {buscando && <p style={{ margin: 0, padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>Buscando…</p>}
              {!buscando && resultados.map((r, i) => (
                <button key={i} onClick={() => selecionar(r)} style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: i ? '1px solid #f1f5f9' : 'none', background: '#fff', cursor: 'pointer', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#10233b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}{r.idade ? ` · ${r.idade}a` : ''}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[r.clube, r.posicao].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: GFC, background: '#eaf4fd', borderRadius: 99, padding: '3px 7px', flexShrink: 0 }}>{r.fonte}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ height: 1, background: '#eef3ef', margin: '18px 0' }} />

          {/* Campos (preenchidos pela busca ou manualmente) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
            <Field label="Nome *" value={form.nome} onChange={v => setF('nome', v)} placeholder="Nome do jogador" />
            <Field label="Idade" value={form.idade} onChange={v => setF('idade', v.replace(/\D/g, ''))} placeholder="00" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <Field label="Posição" value={form.posicao} onChange={v => setF('posicao', v)} placeholder="Ex.: Zagueiro" />
            <Field label="Clube" value={form.clube} onChange={v => setF('clube', v)} placeholder="Clube atual" />
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Link (perfil / vídeo)" value={form.link} onChange={v => setF('link', v)} placeholder="Cole o link (oGol, Transfermarkt, YouTube…)" />
          </div>

          {/* Grupo */}
          <p style={{ margin: '16px 0 6px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Grupo (posição no relatório)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GRUPOS.map(g => {
              const active = form.grupo === g.id
              return (
                <button key={g.id} onClick={() => setF('grupo', g.id)} style={{ border: `1.5px solid ${active ? g.color : '#e2e8f0'}`, background: active ? `${g.color}12` : '#fff', color: active ? g.color : '#64748b', borderRadius: 9, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #eef3ef', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: '#fff', borderRadius: '0 0 18px 18px' }}>
          <button onClick={onClose} style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={confirmar} style={{ border: 'none', background: GFC, color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={15} />Adicionar</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', marginTop: 4, padding: '9px 11px', border: '1px solid #d7e3db', borderRadius: 9, fontSize: 13, outline: 'none' }} />
    </label>
  )
}

// ─── Linha de jogador dentro do card ─────────────────────────────────────────
function PlayerRow({ p, rank, color, canEdit, onLink, onRemove, onUp, onDown, isFirst, isLast }) {
  const [editLink, setEditLink] = useState(false)
  const [linkVal, setLinkVal] = useState(p.link || '')
  useEffect(() => setLinkVal(p.link || ''), [p.link])

  const url = normalizeUrl(p.link)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '11px 14px', borderTop: '1px solid #eef3ef', background: rank === 1 ? '#fbfefc' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: rank === 1 ? color : '#f1f5f9', color: rank === 1 ? '#fff' : '#64748b', fontSize: 12, fontWeight: 950 }}>#{rank}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 900, color: '#10233b' }}>{p.nome}</p>
          {p.idade ? <span style={{ fontSize: 8.5, color: '#64748b', background: '#f1f5f9', borderRadius: 99, padding: '2px 5px', flexShrink: 0 }}>{p.idade}a</span> : null}
        </div>
        <p style={{ margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#64748b' }}>
          {[p.clube, p.posicao].filter(Boolean).join(' · ') || '—'}
        </p>
        {editLink ? (
          <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
            <input value={linkVal} onChange={e => setLinkVal(e.target.value)} autoFocus placeholder="Cole o link…"
              style={{ flex: 1, padding: '5px 8px', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 11, outline: 'none' }} />
            <button onClick={() => { onLink(linkVal.trim()); setEditLink(false) }} style={{ border: 'none', background: GFC, color: '#fff', borderRadius: 7, padding: '0 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>OK</button>
          </div>
        ) : (
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
            {url
              ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: 9.5, fontWeight: 900, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}><ExternalLink size={11} />ABRIR LINK</a>
              : <span style={{ color: '#cbd5e1', fontSize: 9.5, fontWeight: 800 }}>sem link</span>}
            {canEdit && <button onClick={() => setEditLink(true)} style={{ border: 'none', background: 'none', color: GFC, fontSize: 9.5, fontWeight: 800, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Link2 size={11} />{url ? 'editar' : 'add link'}</button>}
          </div>
        )}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button onClick={onUp} disabled={isFirst} title="Subir" style={{ border: 'none', background: 'none', cursor: isFirst ? 'default' : 'pointer', color: isFirst ? '#e2e8f0' : '#94a3b8', padding: 0, lineHeight: 0 }}><ChevronUp size={15} /></button>
            <button onClick={onDown} disabled={isLast} title="Descer" style={{ border: 'none', background: 'none', cursor: isLast ? 'default' : 'pointer', color: isLast ? '#e2e8f0' : '#94a3b8', padding: 0, lineHeight: 0 }}><ChevronDown size={15} /></button>
          </div>
          <button onClick={onRemove} title="Remover" style={{ width: 28, height: 28, border: '1px solid #fee2e2', borderRadius: 8, display: 'grid', placeItems: 'center', background: '#fff', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  )
}

// ─── Card de grupo (posição) ─────────────────────────────────────────────────
function GroupCard({ grupo, players, canEdit, onAdd, mutate }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #dbe7f2', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 24px rgba(19,60,38,.06)' }}>
      <div style={{ padding: '13px 15px', background: `linear-gradient(135deg, ${grupo.color}18, #fff 68%)`, borderBottom: `3px solid ${grupo.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ minWidth: 40, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: grupo.color, color: '#fff', fontSize: 10, fontWeight: 950 }}>{grupo.short}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 950, color: '#173d29' }}>{grupo.label}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 8.5, color: '#64748b' }}>{players.length} atleta(s)</p>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => onAdd(grupo.id)} title={`Adicionar em ${grupo.label}`} style={{ height: 25, padding: '0 8px', border: '1px solid #cbdfee', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, background: '#fff', color: GFC, cursor: 'pointer', fontSize: 8.5, fontWeight: 900 }}>
              <Plus size={12} /> Adicionar
            </button>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <div style={{ padding: '18px 15px', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>Sem atletas nesta posição</div>
      ) : (
        players.map((p, i) => (
          <PlayerRow
            key={p.id} p={p} rank={i + 1} color={grupo.color} canEdit={canEdit}
            isFirst={i === 0} isLast={i === players.length - 1}
            onLink={link => mutate('link', p.id, link)}
            onRemove={() => mutate('remove', p.id)}
            onUp={() => mutate('up', p.id)}
            onDown={() => mutate('down', p.id)}
          />
        ))
      )}
    </section>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function RelatoriosJogadoresPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const canEdit = !['scout', 'diretoria', 'comissao'].includes(role)

  const [relatorios, setRelatorios] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null) // { id, nome, jogadores }
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addGroup, setAddGroup] = useState(null) // grupo pré-selecionado ao abrir modal
  const [showAdd, setShowAdd] = useState(false)
  const [exporting, setExporting] = useState(false)

  const carregarLista = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/relatorios-jogadores')
      const data = await res.json()
      setRelatorios(data.relatorios || [])
      if (!activeId && data.relatorios?.length) setActiveId(data.relatorios[0].id)
    } catch (_) {}
    finally { setLoadingList(false) }
  }, [activeId])

  useEffect(() => { carregarLista() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId) { setActive(null); return }
    let cancel = false
    ;(async () => {
      setLoadingDoc(true)
      try {
        const res = await fetch(`/api/relatorios-jogadores?id=${activeId}`)
        const data = await res.json()
        if (!cancel && data.relatorio) {
          setActive({ id: data.relatorio.id, nome: data.relatorio.nome, jogadores: Array.isArray(data.relatorio.jogadores) ? data.relatorio.jogadores : [] })
        }
      } catch (_) {}
      finally { if (!cancel) setLoadingDoc(false) }
    })()
    return () => { cancel = true }
  }, [activeId])

  // Salva a lista de jogadores do relatório ativo
  async function persistJogadores(jogadores) {
    if (!active) return
    setSaving(true)
    try {
      await fetch('/api/relatorios-jogadores', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: active.id, jogadores }),
      })
      setRelatorios(rs => rs.map(r => r.id === active.id ? { ...r, total: jogadores.length, updated_at: new Date().toISOString() } : r))
    } catch (_) {}
    finally { setSaving(false) }
  }

  function mutate(action, playerId, value) {
    setActive(prev => {
      if (!prev) return prev
      let jogadores = [...prev.jogadores]
      if (action === 'remove') {
        jogadores = jogadores.filter(p => p.id !== playerId)
      } else if (action === 'link') {
        jogadores = jogadores.map(p => p.id === playerId ? { ...p, link: value } : p)
      } else if (action === 'up' || action === 'down') {
        const p = jogadores.find(x => x.id === playerId)
        if (p) {
          const sameGroup = jogadores.filter(x => x.grupo === p.grupo)
          const idxInGroup = sameGroup.findIndex(x => x.id === playerId)
          const swapWith = action === 'up' ? sameGroup[idxInGroup - 1] : sameGroup[idxInGroup + 1]
          if (swapWith) {
            const a = jogadores.findIndex(x => x.id === playerId)
            const b = jogadores.findIndex(x => x.id === swapWith.id)
            ;[jogadores[a], jogadores[b]] = [jogadores[b], jogadores[a]]
          }
        }
      }
      const next = { ...prev, jogadores }
      persistJogadores(jogadores)
      return next
    })
  }

  function addJogador(jogador) {
    setActive(prev => {
      if (!prev) return prev
      const jogadores = [...prev.jogadores, jogador]
      persistJogadores(jogadores)
      return { ...prev, jogadores }
    })
  }

  async function novaLista() {
    const nome = prompt('Nome da nova lista:')
    if (!nome || !nome.trim()) return
    const res = await fetch('/api/relatorios-jogadores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.trim() }),
    })
    const data = await res.json()
    if (data.relatorio) {
      await carregarLista()
      setActiveId(data.relatorio.id)
    }
  }

  async function renomear(r) {
    const nome = prompt('Renomear lista:', r.nome)
    if (!nome || !nome.trim() || nome.trim() === r.nome) return
    await fetch('/api/relatorios-jogadores', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, nome: nome.trim() }),
    })
    setRelatorios(rs => rs.map(x => x.id === r.id ? { ...x, nome: nome.trim() } : x))
    if (active?.id === r.id) setActive(a => ({ ...a, nome: nome.trim() }))
  }

  async function excluir(r) {
    if (!confirm(`Excluir a lista "${r.nome}"? Esta ação não pode ser desfeita.`)) return
    await fetch(`/api/relatorios-jogadores?id=${r.id}`, { method: 'DELETE' })
    const restantes = relatorios.filter(x => x.id !== r.id)
    setRelatorios(restantes)
    if (activeId === r.id) setActiveId(restantes[0]?.id || null)
  }

  async function exportarPdf() {
    if (!active) return
    setExporting(true)
    try {
      await gerarPdfRelatorioJogadores({ nome: active.nome, jogadores: active.jogadores, grupos: GRUPOS })
    } catch (e) {
      alert('Erro ao gerar PDF: ' + e.message)
    } finally { setExporting(false) }
  }

  const grouped = useMemo(() => {
    const map = Object.fromEntries(GRUPOS.map(g => [g.id, []]))
    for (const p of (active?.jogadores || [])) {
      if (map[p.grupo]) map[p.grupo].push(p)
      else (map.MEI = map.MEI || []).push(p)
    }
    return map
  }, [active])

  return (
    <AppShell>
      <div style={{ padding: 'clamp(16px,3vw,28px)', maxWidth: 1400, margin: '0 auto' }}>
        {/* Banner */}
        <div style={{ marginBottom: 18, borderRadius: 18, padding: '20px 22px', background: `linear-gradient(135deg,${GFC_DARK},${GFC})`, color: '#fff', boxShadow: '0 12px 32px rgba(10,102,183,.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', opacity: .85 }}>RELATÓRIOS DE JOGADORES</p>
              <h2 style={{ margin: '5px 0 5px', fontSize: 21, fontWeight: 950 }}>Listas por posição</h2>
              <p style={{ margin: 0, fontSize: 11.5, opacity: .9, maxWidth: 560 }}>Monte listas nomeadas com jogadores do banco, organize por posição, adicione o link de cada um e gere um PDF moderno em cards com o escudo do Confiança.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {canEdit && (
                <button onClick={novaLista} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '9px 14px', background: '#fff', color: GFC, fontSize: 11.5, fontWeight: 900, cursor: 'pointer' }}>
                  <FolderPlus size={15} /> Nova lista
                </button>
              )}
              {active && (
                <button onClick={exportarPdf} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid rgba(255,255,255,.34)', borderRadius: 10, padding: '9px 14px', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 11.5, fontWeight: 900, cursor: exporting ? 'wait' : 'pointer' }}>
                  <Download size={15} /> {exporting ? 'Gerando PDF…' : 'Exportar PDF'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,270px) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          {/* Painel de listas */}
          <aside style={{ background: '#fff', border: '1px solid #dbe7f2', borderRadius: 16, padding: 12, position: 'sticky', top: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: '#10233b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Minhas listas</p>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>{relatorios.length}</span>
            </div>
            {loadingList ? (
              <p style={{ padding: 10, fontSize: 12, color: '#94a3b8' }}>Carregando…</p>
            ) : relatorios.length === 0 ? (
              <div style={{ padding: '16px 10px', textAlign: 'center' }}>
                <FileText size={22} style={{ color: '#cbd5e1' }} />
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Nenhuma lista ainda.{canEdit ? ' Crie a primeira.' : ''}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {relatorios.map(r => {
                  const on = r.id === activeId
                  return (
                    <div key={r.id} onClick={() => setActiveId(r.id)} style={{ cursor: 'pointer', border: `1.5px solid ${on ? GFC : '#eef3ef'}`, background: on ? '#f0fdf4' : '#fff', borderRadius: 11, padding: '10px 11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: on ? GFC : '#10233b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</p>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button onClick={e => { e.stopPropagation(); renomear(r) }} title="Renomear" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}><Pencil size={12} /></button>
                            <button onClick={e => { e.stopPropagation(); excluir(r) }} title="Excluir" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} />{r.total || 0} jogador(es)</p>
                    </div>
                  )
                })}
              </div>
            )}
          </aside>

          {/* Editor */}
          <div style={{ minWidth: 0 }}>
            {!active ? (
              <div style={{ background: '#fff', border: '1px dashed #cbdfee', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <FileText size={30} style={{ color: '#cbd5e1' }} />
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#64748b' }}>{relatorios.length ? 'Selecione uma lista à esquerda.' : (canEdit ? 'Crie sua primeira lista para começar.' : 'Nenhuma lista disponível.')}</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 950, color: '#10233b', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {active.nome}
                      {canEdit && <button onClick={() => renomear(active)} title="Renomear" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}><Pencil size={14} /></button>}
                    </h1>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b' }}>
                      {active.jogadores.length} jogador(es){saving ? ' · salvando…' : ''}
                    </p>
                  </div>
                  {canEdit && (
                    <button onClick={() => { setAddGroup(null); setShowAdd(true) }} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '9px 15px', background: GFC, color: '#fff', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                      <Plus size={15} /> Adicionar jogador
                    </button>
                  )}
                </div>

                {loadingDoc ? (
                  <p style={{ padding: 20, fontSize: 13, color: '#94a3b8' }}>Carregando lista…</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, alignItems: 'start' }}>
                    {GRUPOS.map(g => (
                      <GroupCard
                        key={g.id} grupo={g} players={grouped[g.id] || []} canEdit={canEdit}
                        onAdd={gid => { setAddGroup(gid); setShowAdd(true) }}
                        mutate={mutate}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onAdd={j => addJogador(addGroup ? { ...j, grupo: addGroup } : j)}
        />
      )}
    </AppShell>
  )
}
