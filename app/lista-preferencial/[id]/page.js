'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '../../components/layout/AppShell'
import Link from 'next/link'

// ─── Config ───────────────────────────────────────────────────────────────────
const ORIGEM_CFG = {
  'Iniciativa CIC':   { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🔍' },
  'Indicação':        { color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: '👥' },
  'Pedido Diretoria': { color: 'bg-purple-50 text-purple-700 border-purple-200',    icon: '🏛️' },
  'Pedido Executivo': { color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: '💼' },
}
const STATUS_CFG = {
  'Pendente':    { color: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400'   },
  'Em Análise':  { color: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500'    },
  'Aprovado':    { color: 'bg-green-50 text-[#0a66b7] border-green-300',    dot: 'bg-[#0a66b7]'   },
  'Descartado':  { color: 'bg-red-50 text-red-500 border-red-200',          dot: 'bg-red-400'     },
  'Arquivado':   { color: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-400'   },
}
const PRIORIDADE_CFG = {
  'Alta':  { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500'    },
  'Média': { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500'  },
  'Baixa': { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400'  },
}

// ─── Editable Field ───────────────────────────────────────────────────────────
function EditableTextarea({ label, value, placeholder, onSave, rows = 3 }) {
  const [editing, setEditing] = useState(false)
  const [text,    setText]    = useState(value || '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { setText(value || '') }, [value])

  async function handleSave() {
    setSaving(true)
    await onSave(text)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-[9px] text-slate-400 hover:text-[#0a66b7] font-semibold flex items-center gap-1 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={placeholder} rows={rows}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0a66b7] resize-none placeholder:text-slate-300"/>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setEditing(false); setText(value || '') }}
              className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-1.5 rounded-lg bg-[#0a66b7] text-white text-xs font-bold disabled:opacity-60 hover:bg-[#07579e] transition">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className={`min-h-[60px] rounded-xl px-3 py-2.5 text-sm border cursor-pointer hover:border-[#0a66b7]/30 transition-colors ${
          text ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-white border-dashed border-slate-200 text-slate-300'
        }`} onClick={() => setEditing(true)}>
          {text || placeholder}
        </div>
      )}
    </div>
  )
}

// ─── Editable Link ────────────────────────────────────────────────────────────
function EditableLink({ label, value, placeholder, icon, onSave }) {
  const [editing, setEditing] = useState(false)
  const [text,    setText]    = useState(value || '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { setText(value || '') }, [value])

  async function handleSave() {
    setSaving(true)
    await onSave(text)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0a66b7] placeholder:text-slate-300"/>
            <button onClick={handleSave} disabled={saving}
              className="px-2.5 py-1.5 bg-[#0a66b7] text-white text-[10px] font-bold rounded-lg hover:bg-[#07579e] transition">OK</button>
            <button onClick={() => { setEditing(false); setText(value || '') }}
              className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg">×</button>
          </div>
        ) : value ? (
          <div className="flex items-center gap-2">
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#0a66b7] font-semibold hover:underline truncate">
              {label}
            </a>
            <button onClick={() => setEditing(true)}
              className="text-[9px] text-slate-300 hover:text-slate-500 font-semibold flex-shrink-0">editar</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="text-xs text-slate-300 hover:text-[#0a66b7] transition font-medium">
            {placeholder}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Página de Detalhe ────────────────────────────────────────────────────────
export default function AtletaRadarPage() {
  const { id }       = useParams()
  const router       = useRouter()
  const { data: session } = useSession()
  const canEdit = !['diretoria','comissao'].includes(session?.user?.role)

  const [player,  setPlayer]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('perfil')
  const [saving,  setSaving]  = useState(false)
  const [fotoSrc,    setFotoSrc]    = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [editDados,  setEditDados]  = useState(false)
  const [formDados,  setFormDados]  = useState({})
  const fotoInputRef = useRef(null)

  function getUsuario() {
    try { return sessionStorage.getItem('cig_user') || 'sistema' } catch { return 'sistema' }
  }

  const load = () =>
    fetch(`/api/lista-preferencial?id=${id}`).then(r => r.json()).then(d => {
      if (!d.player) router.push('/lista-preferencial')
      setPlayer(d.player)
      setFotoSrc(d.player?.tem_foto ? `/api/lista-preferencial?foto=${d.player.id}&t=${Date.now()}` : null)
      setLoading(false)
    })

  useEffect(() => { load() }, [id])

  async function patch(fields) {
    setSaving(true)
    await fetch('/api/lista-preferencial', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: player.id, ...fields, usuario: getUsuario() }),
    })
    await load()
    setSaving(false)
  }

  function openEditDados() {
    setFormDados({
      jogador:           player.jogador           || '',
      nome_completo:     player.nome_completo      || '',
      clube:             player.clube              || '',
      posicao:           player.posicao            || '',
      posicao_secundaria:player.posicao_secundaria || '',
      data_nascimento:   player.data_nascimento    ? player.data_nascimento.split('T')[0] : '',
      nacionalidade:     player.nacionalidade      || '',
      altura:            player.altura             || '',
      pe_preferido:      player.pe_preferido       || '',
      valor_mercado:     player.valor_mercado      || '',
    })
    setEditDados(true)
  }

  async function saveDados() {
    setSaving(true)
    await fetch('/api/lista-preferencial', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: player.id, ...formDados, usuario: getUsuario() }),
    })
    await load()
    setSaving(false)
    setEditDados(false)
  }

  async function handleFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const previewSrc = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = ev => resolve(ev.target.result)
      reader.readAsDataURL(file)
    })
    setFotoSrc(previewSrc)
    setUploading(true)
    try {
      const compressed = await new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          const MAX = 900
          let w = img.width, h = img.height
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.82)
        }
        img.src = previewSrc
      })
      const fd = new FormData()
      fd.append('id', player.id)
      fd.append('foto', compressed, 'foto.jpg')
      await fetch('/api/lista-preferencial', { method: 'PATCH', body: fd })
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loading) return (
    <AppShell>
      <div className="p-6 max-w-[800px] mx-auto">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse mb-4"/>
        <div className="h-40 bg-white rounded-2xl border border-slate-100 animate-pulse"/>
      </div>
    </AppShell>
  )

  if (!player) return null

  const origCfg   = ORIGEM_CFG[player.origem]        || ORIGEM_CFG['Iniciativa CIC']
  const statusCfg = STATUS_CFG[player.status]         || STATUS_CFG['Pendente']
  const priCfg    = PRIORIDADE_CFG[player.prioridade] || PRIORIDADE_CFG['Média']

  const idadeCalc = player.data_nascimento
    ? Math.floor((Date.now() - new Date(player.data_nascimento)) / (1000*60*60*24*365.25))
    : player.idade

  const hist = (() => {
    try {
      if (Array.isArray(player.historico_clubes)) return player.historico_clubes
      if (typeof player.historico_clubes === 'string') return JSON.parse(player.historico_clubes)
      return []
    } catch { return [] }
  })()

  return (
    <AppShell>
      <div className="p-6 max-w-[800px] mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5 text-xs text-slate-400">
          <Link href="/lista-preferencial" className="hover:text-[#0a66b7] transition font-semibold">Lista Preferencial</Link>
          <span>/</span>
          <span className="text-slate-600 font-semibold">{player.jogador}</span>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
          <div className="bg-gradient-to-r from-[#0a66b7] to-[#0878c8] px-6 py-5 flex items-center gap-4">
            {/* Avatar / Foto */}
          <div className="relative flex-shrink-0 group">
            {fotoSrc
              ? <img src={fotoSrc} alt={player.jogador}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white/30"/>
              : <div className="w-16 h-16 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center text-2xl font-black text-white"
                  style={{fontFamily:"'Barlow Condensed',sans-serif"}}>
                  {(player.jogador||'?')[0].toUpperCase()}
                </div>
            }
            {canEdit && (
              <>
                <button onClick={() => fotoInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Trocar foto">
                  {uploading
                    ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  }
                </button>
                <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFoto}/>
              </>
            )}
          </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">{player.posicao || 'Posição não informada'}</p>
              <h1 className="text-white font-black text-3xl leading-none" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>
                {player.jogador}
              </h1>
              {player.nome_completo && player.nome_completo !== player.jogador && (
                <p className="text-white/60 text-xs mt-0.5">{player.nome_completo}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2.5">
                <span className={`text-[9px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 ${statusCfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}/>{player.status}
                </span>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${priCfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priCfg.dot}`}/>{player.prioridade}
                </span>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 ${origCfg.color}`}>
                  {origCfg.icon} {player.origem}
                  {player.solicitante && ` · ${player.solicitante}`}
                </span>
              </div>
            </div>
          </div>

          {/* Dados rápidos */}
          <div className="grid grid-cols-4 divide-x divide-slate-50 border-t border-slate-50">
            {[
              ['Clube',     player.clube],
              ['Idade',     idadeCalc ? `${idadeCalc} anos` : null],
              ['Altura',    player.altura ? `${player.altura}m` : null],
              ['Pé',        player.pe_preferido],
            ].map(([l, v]) => (
              <div key={l} className="px-4 py-3">
                <p className="text-[8px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">{l}</p>
                <p className="text-sm font-bold text-slate-700">{v || <span className="text-slate-300 text-xs">—</span>}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ações rápidas de status */}
        {canEdit && (
          <div className="flex gap-2 mb-5">
            {['Pendente','Em Análise','Aprovado','Descartado'].map(s => (
              <button key={s} onClick={() => patch({ status: s })} disabled={saving}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all disabled:opacity-50 ${
                  player.status === s ? `${STATUS_CFG[s].color} ring-2 ring-offset-1 ring-[#0a66b7]` : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>{s}</button>
            ))}
            <button onClick={() => patch({ status: 'Arquivado' })}
              disabled={saving || player.status === 'Arquivado'}
              title="Arquivado — consta no banco mas não vai para o Monitoramento"
              className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                player.status === 'Arquivado'
                  ? 'bg-slate-100 text-slate-500 border-slate-200 ring-2 ring-offset-1 ring-slate-400'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'
              }`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              Arquivar
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1">
          {[
            { key:'perfil',   label:'Perfil',   icon:'👤' },
            { key:'scout',    label:'Scout',    icon:'📋' },
            { key:'carreira', label:'Carreira', icon:'📅' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Perfil */}
        {tab === 'perfil' && (
          <div className="space-y-4">
            {/* Dados do atleta */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dados do Atleta</h2>
                {canEdit && !editDados && (
                  <button onClick={openEditDados}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-[#0a66b7] transition">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Editar
                  </button>
                )}
              </div>

              {editDados ? (
                /* ── Modo Edição ── */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Apelido / Nome de Guerra</label>
                      <input value={formDados.jogador} onChange={e => setFormDados(f=>({...f,jogador:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0a66b7]"/>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo</label>
                      <input value={formDados.nome_completo} onChange={e => setFormDados(f=>({...f,nome_completo:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Clube Atual</label>
                      <input value={formDados.clube} onChange={e => setFormDados(f=>({...f,clube:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]"/>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nacionalidade</label>
                      <input value={formDados.nacionalidade} onChange={e => setFormDados(f=>({...f,nacionalidade:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Posição Principal</label>
                      <select value={formDados.posicao} onChange={e => setFormDados(f=>({...f,posicao:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]">
                        <option value="">—</option>
                        {['Goleiro','Lateral Direito','Lateral Esquerdo','Zagueiro','Volante','Meia','Meia Atacante','Ponta Direita','Ponta Esquerda','Centroavante','Atacante'].map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Posição Secundária</label>
                      <select value={formDados.posicao_secundaria} onChange={e => setFormDados(f=>({...f,posicao_secundaria:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]">
                        <option value="">—</option>
                        {['Goleiro','Lateral Direito','Lateral Esquerdo','Zagueiro','Volante','Meia','Meia Atacante','Ponta Direita','Ponta Esquerda','Centroavante','Atacante'].map(p=><option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Nascimento</label>
                      <input type="date" value={formDados.data_nascimento} onChange={e => setFormDados(f=>({...f,data_nascimento:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]"/>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Altura (m)</label>
                      <input value={formDados.altura} onChange={e => setFormDados(f=>({...f,altura:e.target.value}))}
                        placeholder="Ex: 1.82"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]"/>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pé Preferido</label>
                      <select value={formDados.pe_preferido} onChange={e => setFormDados(f=>({...f,pe_preferido:e.target.value}))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]">
                        <option value="">—</option>
                        <option>Direito</option><option>Esquerdo</option><option>Ambos</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Valor de Mercado</label>
                    <input value={formDados.valor_mercado} onChange={e => setFormDados(f=>({...f,valor_mercado:e.target.value}))}
                      placeholder="Ex: € 500 mil"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]"/>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditDados(false)}
                      className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                      Cancelar
                    </button>
                    <button onClick={saveDados} disabled={saving}
                      className="flex-1 py-2 rounded-xl bg-[#0a66b7] hover:bg-[#07579e] text-white text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2">
                      {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '✓'}
                      {saving ? 'Salvando...' : 'Salvar Dados'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Modo Visualização ── */
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    ['Posição',          player.posicao],
                    ['Posição Sec.',      player.posicao_secundaria],
                    ['Clube Atual',       player.clube],
                    ['Nacionalidade',     player.nacionalidade],
                    ['Data Nasc.',        player.data_nascimento ? new Date(player.data_nascimento).toLocaleDateString('pt-BR') : null],
                    ['Altura',            player.altura ? `${player.altura}m` : null],
                    ['Pé Preferido',      player.pe_preferido],
                    ['Valor de Mercado',  player.valor_mercado],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">{l}</p>
                      <p className="text-sm font-semibold text-slate-700">{v || <span className="text-slate-300">—</span>}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Links */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Links</h2>
              <div className="space-y-3">
                <EditableLink label="OGol / Transfermarkt" value={player.link_externo}
                  placeholder="+ Adicionar link de perfil (OGol ou Transfermarkt)"
                  icon="🔗"
                  onSave={v => patch({ link_externo: v })}/>
                <EditableLink label="Vídeo / Highlight" value={player.link_video}
                  placeholder="+ Adicionar link de vídeo (YouTube, Wyscout, Drive...)"
                  icon="🎬"
                  onSave={v => patch({ link_video: v })}/>
              </div>
            </div>

            {/* Observações gerais */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <EditableTextarea
                label="Observações"
                value={player.observacoes}
                placeholder="Contexto do pedido, informações iniciais, fonte da indicação..."
                rows={3}
                onSave={v => patch({ observacoes: v })}/>
            </div>
          </div>
        )}

        {/* Tab: Scout */}
        {tab === 'scout' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <EditableTextarea
                label="Descrição / Perfil do Jogador"
                value={player.descricao}
                placeholder="Descreva o perfil do atleta: estilo de jogo, características principais, como se encaixaria no nosso modelo..."
                rows={5}
                onSave={v => patch({ descricao: v })}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <EditableTextarea
                  label="Pontos Fortes"
                  value={player.pontos_fortes}
                  placeholder="Liste os pontos fortes do atleta..."
                  rows={4}
                  onSave={v => patch({ pontos_fortes: v })}/>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <EditableTextarea
                  label="Pontos a Melhorar"
                  value={player.pontos_melhorar}
                  placeholder="Liste os pontos a desenvolver..."
                  rows={4}
                  onSave={v => patch({ pontos_melhorar: v })}/>
              </div>
            </div>

            {/* Prioridade + Status */}
            {canEdit && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider mb-2">Prioridade</p>
                    <div className="flex gap-1.5">
                      {['Alta','Média','Baixa'].map(p => (
                        <button key={p} onClick={() => patch({ prioridade: p })} disabled={saving}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all disabled:opacity-50 ${
                            player.prioridade === p ? PRIORIDADE_CFG[p].badge + ' border-transparent' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider mb-2">Solicitante</p>
                    <p className="text-sm font-semibold text-slate-700">{player.solicitante || <span className="text-slate-300">Não informado</span>}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Carreira */}
        {tab === 'carreira' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {hist.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-3xl mb-3">📅</div>
                <p className="text-slate-400 font-semibold text-sm">Nenhum histórico disponível</p>
                <p className="text-slate-300 text-xs mt-1">Importe os dados via OGol ou Transfermarkt para preencher automaticamente</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Histórico de Clubes</p>
                  <span className="text-[10px] text-slate-400">{hist.length} temporada{hist.length !== 1 ? 's' : ''}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-50/50">
                      <th className="text-left px-5 py-2.5 font-bold">Temporada</th>
                      <th className="text-left px-3 py-2.5 font-bold">Clube</th>
                      <th className="text-center px-3 py-2.5 font-bold">J</th>
                      <th className="text-center px-3 py-2.5 font-bold">G</th>
                      <th className="text-center px-3 py-2.5 font-bold">A</th>
                      <th className="text-center px-3 py-2.5 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {hist.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-2.5 text-xs font-mono text-slate-500">{h.temporada}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-sm font-semibold text-slate-800">{h.clube}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {h.jogos != null ? <span className="text-xs text-slate-600 font-semibold">{h.jogos}</span> : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {h.gols != null && h.gols > 0
                            ? <span className="text-xs font-bold text-[#0a66b7]">{h.gols}</span>
                            : h.gols != null ? <span className="text-xs text-slate-400">{h.gols}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {h.assists != null && h.assists > 0
                            ? <span className="text-xs font-bold text-blue-600">{h.assists}</span>
                            : h.assists != null ? <span className="text-xs text-slate-400">{h.assists}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {h.emprestimo && (
                            <span className="text-[8px] bg-amber-50 text-amber-600 border border-amber-100 rounded px-1.5 py-0.5 font-bold">Emp</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* Ações finais */}
        <div className="mt-6 flex items-center justify-between">
          <Link href="/lista-preferencial"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition font-semibold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Voltar para Lista
          </Link>
          {canEdit && (
            <div className="flex gap-2">
              {player.link_externo && (
                <a href={player.link_externo} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition">
                  🔗 Ver perfil
                </a>
              )}
              {player.link_video && (
                <a href={player.link_video} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition">
                  🎬 Ver vídeo
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
