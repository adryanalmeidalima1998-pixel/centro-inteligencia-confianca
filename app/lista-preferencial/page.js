'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'
import Link from 'next/link'
import {
  Archive, ArrowUpDown, CalendarDays, Camera, Check, CheckCircle2, ChevronDown,
  ExternalLink, Eye, FileText, Filter, LayoutGrid, Link2, MoreHorizontal, Plus,
  Search, SlidersHorizontal, Trash2, UserRound, Video, X,
} from 'lucide-react'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot, playerFootLabel } from '@/data/player-foot'

// ─── Config ───────────────────────────────────────────────────────────────────
const ORIGEM_CFG = {
  'Iniciativa CIC':   { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: '🔍' },
  'Indicação':        { color: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-500',    icon: '👥' },
  'Pedido Diretoria': { color: 'bg-purple-50 text-purple-700 border-purple-200',    dot: 'bg-purple-500',  icon: '🏛️' },
  'Pedido Executivo': { color: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500',   icon: '💼' },
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
const POSICOES_LIST = ['Goleiro','Lateral Direito','Lateral Esquerdo','Zagueiro','Volante','Meia','Meia Atacante','Ponta Direita','Ponta Esquerda','Centroavante','Atacante']


function formatRelativeDate(value) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data não informada'
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
  if (diffDays === 0) return 'Cadastrado hoje'
  if (diffDays === 1) return 'Cadastrado há 1 dia'
  if (diffDays < 30) return `Cadastrado há ${diffDays} dias`
  return `Cadastrado em ${date.toLocaleDateString('pt-BR')}`
}

function getProfileLabel(url = '') {
  const normalized = String(url).toLowerCase()
  if (normalized.includes('ogol')) return 'oGol'
  if (normalized.includes('transfermarkt')) return 'Transfermarkt'
  return 'Perfil externo'
}

function getCardCompleteness(player = {}) {
  const items = [
    { key: 'profile', label: 'Perfil', done: Boolean(player.link_externo), icon: Link2 },
    { key: 'photo', label: 'Foto', done: Boolean(player.tem_foto), icon: Camera },
    { key: 'scout', label: 'Scout', done: Boolean(player.observacoes || player.descricao || player.pontos_fortes || player.pontos_melhorar), icon: FileText },
    { key: 'video', label: 'Vídeo', done: Boolean(player.link_video), icon: Video },
  ]
  const completed = items.filter(item => item.done).length
  return { items, completed, percent: Math.round((completed / items.length) * 100) }
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// ─── Modal Adicionar Atleta (Scraping + campos opcionais) ─────────────────────
function AddModal({ onClose, onSave }) {
  const [fonte,       setFonte]       = useState('ogol')
  const [texto,       setTexto]       = useState('')
  const [url,         setUrl]         = useState('')
  const [loading,     setLoading]     = useState(false)
  const [erro,        setErro]        = useState(null)
  const [atleta,      setAtleta]      = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [prio,        setPrio]        = useState('Média')
  const [origem,      setOrigem]      = useState('Iniciativa CIC')
  const [solicitante, setSolicitante] = useState('')
  const [manual,      setManual]      = useState(false)

  // campos para cadastro manual
  const [form, setForm] = useState({ jogador:'', clube:'', posicao:'', idade:'' })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const precisaSolicitante = ['Indicação','Pedido Diretoria','Pedido Executivo'].includes(origem)

  async function processar() {
    if (!texto.trim()) return
    setLoading(true); setErro(null); setAtleta(null)
    try {
      const res  = await fetch('/api/scrape-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim(), url: url.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar dados')
      setAtleta(data.atleta)
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function salvar() {
    setSaving(true)
    try {
      if (manual) {
        if (!form.jogador.trim()) { alert('Nome obrigatório'); setSaving(false); return }
        await onSave({ ...form, idade: form.idade ? parseInt(form.idade) : null, prioridade: prio, origem, solicitante: solicitante || null })
      } else {
        await onSave({
          jogador: atleta.apelido || atleta.nome,
          nome_completo: atleta.nome,
          clube: atleta.time_atual,
          posicao: atleta.posicao,
          posicao_secundaria: atleta.posicao_secundaria,
          data_nascimento: atleta.data_nascimento,
          nacionalidade: atleta.nacionalidade,
          altura: atleta.altura,
          pe_preferido: atleta.pe_preferido,
          valor_mercado: atleta.valor_mercado,
          link_externo: atleta.link_externo || url || null,
          historico_clubes: atleta.historico_clubes || [],
          prioridade: prio,
          origem,
          solicitante: solicitante || null,
        })
      }
      onClose()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
    }
  }

  const idade = atleta?.data_nascimento
    ? Math.floor((Date.now() - new Date(atleta.data_nascimento)) / (1000*60*60*24*365.25))
    : null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[540px] max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-[#0a66b7] px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-300 mb-0.5">Lista Preferencial</p>
            <h3 className="text-xl font-black text-white uppercase" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>
              Adicionar Atleta ao Radar
            </h3>
          </div>
          <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white w-8 h-8 rounded-lg flex items-center justify-center transition text-base">✕</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Origem + Solicitante */}
          <div className="bg-slate-50 rounded-xl p-3.5 space-y-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Como chegou até nós?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(ORIGEM_CFG).map(([key, cfg]) => (
                  <button key={key} onClick={() => setOrigem(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all text-left ${
                      origem === key ? 'bg-[#0a66b7] border-[#0a66b7] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    <span>{cfg.icon}</span>{key}
                  </button>
                ))}
              </div>
            </div>
            {precisaSolicitante && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  {origem === 'Indicação' ? 'Quem indicou?' : 'Quem solicitou?'}
                </label>
                <input value={solicitante} onChange={e => setSolicitante(e.target.value)}
                  placeholder={origem === 'Indicação' ? 'Ex: João Silva (empresário)...' : 'Ex: Marcelo Gomes...'}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7] placeholder:text-slate-300"/>
              </div>
            )}
          </div>

          {/* Toggle scraping / manual */}
          <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setManual(false)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${!manual ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              ✨ OGol / Transfermarkt
            </button>
            <button onClick={() => setManual(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${manual ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              ✏️ Manual
            </button>
          </div>

          {/* ── SCRAPING ── */}
          {!manual && (
            <>
              {/* Selector de fonte */}
              <div className="flex gap-2">
                {[
                  { key:'ogol',          label:'OGol',          sub:'ogol.com.br'         },
                  { key:'transfermarkt', label:'Transfermarkt', sub:'transfermarkt.com.br' },
                ].map(f => (
                  <button key={f.key} onClick={() => { setFonte(f.key); setAtleta(null); setErro(null) }}
                    className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition-all text-left ${
                      fonte === f.key ? 'bg-[#0a66b7] border-[#0a66b7] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {f.label}
                    <span className={`block text-[10px] font-normal mt-0.5 ${fonte === f.key ? 'text-green-200' : 'text-slate-400'}`}>{f.sub}</span>
                  </button>
                ))}
              </div>

              {/* Instruções */}
              <div className="bg-[#f0fdf4] border border-green-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#10233b] mb-1.5">Como usar:</p>
                <ol className="space-y-0.5 pl-4 list-decimal">
                  {['Acesse a página do jogador','Pressione Ctrl+A → Ctrl+C para copiar tudo','Cole no campo abaixo','Clique em Processar dados'].map((t,i) => (
                    <li key={i} className="text-[10px] text-[#52677e]">{t}</li>
                  ))}
                </ol>
              </div>

              {/* Textarea */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Texto copiado da página</label>
                <textarea value={texto} onChange={e => { setTexto(e.target.value); setAtleta(null); setErro(null) }}
                  placeholder={`Cole aqui o texto do ${fonte === 'ogol' ? 'OGol' : 'Transfermarkt'}...`}
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs resize-vertical focus:outline-none focus:ring-2 focus:ring-[#0a66b7] placeholder:text-slate-300"/>
                {texto.trim().length > 0 && <p className="text-[9px] text-slate-400 mt-1">{texto.trim().length} caracteres ✓</p>}
              </div>

              {/* URL */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Link do perfil (opcional)</label>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  placeholder={fonte === 'ogol' ? 'https://www.ogol.com.br/jogador/...' : 'https://www.transfermarkt.com.br/...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0a66b7] placeholder:text-slate-300"/>
              </div>

              {/* Botão processar */}
              {!atleta && (
                <button onClick={processar} disabled={loading || texto.trim().length < 50}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{background: loading || texto.trim().length < 50 ? '#9fc5df' : '#0a66b7'}}>
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Processando dados...</>
                    : '✨ Processar dados'}
                </button>
              )}

              {/* Preview do atleta */}
              {atleta && !loading && (
                <div className="border border-green-200 rounded-2xl overflow-hidden">
                  <div className="bg-[#f0fdf4] p-4 flex gap-3 items-center">
                    <div className="w-12 h-12 rounded-full bg-[#0a66b7]/10 border-2 border-dashed border-[#0a66b7]/25 flex items-center justify-center text-2xl flex-shrink-0">👤</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#10233b] text-base" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>
                        {atleta.apelido || atleta.nome}
                      </p>
                      {atleta.apelido && atleta.nome !== atleta.apelido && <p className="text-[10px] text-slate-500">{atleta.nome}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {atleta.posicao       && <span className="text-[9px] font-bold bg-green-100 text-[#0a66b7] border border-green-200 rounded-md px-2 py-0.5">{atleta.posicao}</span>}
                        {atleta.posicao_secundaria && <span className="text-[9px] font-bold bg-green-50 text-[#52677e] border border-green-100 rounded-md px-2 py-0.5">{atleta.posicao_secundaria}</span>}
                        {idade                && <span className="text-[9px] font-bold bg-slate-100 text-slate-700 rounded-md px-2 py-0.5">{idade} anos</span>}
                        {atleta.pe_preferido  && <span className="text-[9px] font-bold bg-slate-100 text-slate-700 rounded-md px-2 py-0.5">🦶 {atleta.pe_preferido}</span>}
                        {atleta.altura        && <span className="text-[9px] font-bold bg-slate-100 text-slate-700 rounded-md px-2 py-0.5">{atleta.altura}m</span>}
                        {atleta.valor_mercado && <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-md px-2 py-0.5">{atleta.valor_mercado}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-4 py-3 border-t border-green-100 bg-white">
                    {[['Clube', atleta.time_atual],['Liga', atleta.liga],['Nacionalidade', atleta.nacionalidade],['País Liga', atleta.pais_liga]]
                      .filter(([,v]) => v).map(([l,v]) => (
                      <div key={l}>
                        <p className="text-[8px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">{l}</p>
                        <p className="text-[11px] font-bold text-[#10233b]">{v}</p>
                      </div>
                    ))}
                  </div>
                  {atleta.historico_clubes?.length > 0 && (
                    <div className="px-4 py-3 border-t border-green-100 bg-white">
                      <p className="text-[8px] uppercase text-slate-400 font-bold tracking-wider mb-2">Histórico ({atleta.historico_clubes.length} temporadas)</p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {atleta.historico_clubes.slice(0,5).map((h,i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className="text-slate-400 font-mono w-12 flex-shrink-0">{h.temporada}</span>
                            <span className="font-semibold text-slate-700 flex-1 truncate">{h.clube}</span>
                            {h.emprestimo && <span className="text-[8px] bg-amber-50 text-amber-600 border border-amber-100 rounded px-1">Emp</span>}
                            {h.jogos != null && <span className="text-slate-400">{h.jogos}J</span>}
                            {h.gols  != null && <span className="text-green-600 font-bold">{h.gols}G</span>}
                          </div>
                        ))}
                        {atleta.historico_clubes.length > 5 && <p className="text-[9px] text-slate-400">+{atleta.historico_clubes.length - 5} registros</p>}
                      </div>
                    </div>
                  )}
                  <div className="px-4 py-2 border-t border-green-100 bg-[#f7fcf9]">
                    <button onClick={() => { setAtleta(null); setErro(null) }}
                      className="text-[9px] text-slate-400 hover:text-slate-600 underline bg-transparent border-none cursor-pointer">
                      ← Tentar com outro texto
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── MANUAL ── */}
          {manual && (
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Nome do Atleta *</label>
                <input value={form.jogador} onChange={e => setF('jogador', e.target.value)}
                  placeholder="Nome ou apelido"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0a66b7] placeholder:text-slate-300"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Clube</label>
                  <input value={form.clube} onChange={e => setF('clube', e.target.value)}
                    placeholder="Ex: Sport, Ferroviária..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7] placeholder:text-slate-300"/>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Idade</label>
                  <input value={form.idade} onChange={e => setF('idade', e.target.value)} type="number" min="15" max="45"
                    placeholder="Ex: 22"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7] placeholder:text-slate-300"/>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Posição</label>
                <select value={form.posicao} onChange={e => setF('posicao', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66b7]">
                  <option value="">Selecionar...</option>
                  {POSICOES_LIST.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Prioridade — sempre visível */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Prioridade</p>
            <div className="flex gap-1.5">
              {['Alta','Média','Baixa'].map(p => (
                <button key={p} onClick={() => setPrio(p)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                    prio === p ? PRIORIDADE_CFG[p].badge + ' border-transparent' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}>{p}</button>
              ))}
            </div>
          </div>

          {/* Erro */}
          {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">⚠ {erro}</div>}

          {/* Botões finais */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
              Cancelar
            </button>
            {(atleta || manual) && (
              <button onClick={salvar} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#0a66b7] hover:bg-[#07579e] text-white text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : '✓'}
                {saving ? 'Salvando...' : 'Adicionar ao Radar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Card do Atleta ───────────────────────────────────────────────────────────
function AthleteCard({ p, canEdit, onUpdate, onRemove, onPromote, promoting, onFotoSaved, compact = false }) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fotoSrc, setFotoSrc] = useState(p.tem_foto ? `/api/lista-preferencial?foto=${p.id}` : null)
  const inputRef = useRef(null)

  async function handleFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const previewSrc = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = event => resolve(event.target.result)
      reader.readAsDataURL(file)
    })
    setFotoSrc(previewSrc)
    setUploading(true)

    try {
      const compressed = await new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          const MAX = 800
          let width = img.width
          let height = img.height
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d').drawImage(img, 0, 0, width, height)
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.82)
        }
        img.src = previewSrc
      })

      const formData = new FormData()
      formData.append('id', p.id)
      formData.append('foto', compressed, 'foto.jpg')
      const response = await fetch('/api/lista-preferencial', { method: 'PATCH', body: formData })
      if (!response.ok) throw new Error('Erro ao salvar foto')
      onFotoSaved?.()
    } catch (error) {
      console.error(error)
      setFotoSrc(p.tem_foto ? `/api/lista-preferencial?foto=${p.id}` : null)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const origin = ORIGEM_CFG[p.origem] || ORIGEM_CFG['Iniciativa CIC']
  const status = STATUS_CFG[p.status] || STATUS_CFG.Pendente
  const priority = PRIORIDADE_CFG[p.prioridade] || PRIORIDADE_CFG.Média
  const completeness = getCardCompleteness({ ...p, tem_foto: Boolean(fotoSrc || p.tem_foto) })
  const inactive = ['Descartado', 'Arquivado'].includes(p.status)
  const approved = p.status === 'Aprovado'
  const age = p.data_nascimento
    ? Math.floor((Date.now() - new Date(p.data_nascimento)) / (1000 * 60 * 60 * 24 * 365.25))
    : p.idade

  return (
    <article className={`group relative h-full overflow-hidden rounded-[20px] border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
      approved ? 'border-emerald-200 shadow-[0_8px_30px_rgba(10,102,183,0.08)]' : inactive ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 shadow-sm hover:border-emerald-200'
    }`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${status.dot}`}/>
      <div className={compact ? 'p-3 pl-4' : 'p-4 pl-5'}>
        <div className="flex items-start gap-3">
          <div className="group/photo relative flex-shrink-0">
            {fotoSrc ? (
              <img src={fotoSrc} alt={p.jogador} className={`h-12 w-12 rounded-2xl border border-slate-200 bg-slate-100 object-cover ${inactive ? 'grayscale opacity-70' : ''}`}/>
            ) : (
              <div className={`grid h-12 w-12 place-items-center rounded-2xl border text-base font-black text-white ${approved ? 'border-emerald-700 bg-[#0a66b7]' : inactive ? 'border-slate-300 bg-slate-300' : 'border-emerald-700/10 bg-gradient-to-br from-[#0a66b7] to-[#1597d4]'}`}>
                {(p.jogador || '?')[0].toUpperCase()}
              </div>
            )}
            {canEdit && (
              <>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="absolute inset-0 grid place-items-center rounded-2xl bg-slate-950/55 text-white opacity-0 transition-opacity group-hover/photo:opacity-100" title="Trocar foto">
                  {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/> : <Camera size={15}/>} 
                </button>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFoto}/>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/lista-preferencial/${p.id}`} className={`block truncate text-[15px] font-extrabold leading-tight transition-colors hover:text-[#0a66b7] ${inactive ? 'text-slate-500' : 'text-slate-900'}`}>
                  {p.jogador}
                </Link>
                <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
                  {[p.clube, p.posicao, age ? `${age} anos` : null].filter(Boolean).join(' · ') || 'Informações básicas pendentes'}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                  {[p.nacionalidade, p.pe_preferido ? `Pé ${playerFootLabel(p.pe_preferido)}` : null].filter(Boolean).join(' · ') || formatRelativeDate(p.created_at)}
                </p>
              </div>
              <span className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${status.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`}/>{p.status}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-extrabold ${origin.color}`}><span>{origin.icon}</span>{p.origem}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-extrabold ${priority.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`}/>{p.prioridade}</span>
          {p.solicitante && <span className="min-w-0 truncate rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500" title={p.solicitante}>por {p.solicitante}</span>}
        </div>

        {!compact && (
          <div className="mt-3 min-h-[42px] rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="mb-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Observação inicial</p>
            <p className={`line-clamp-2 text-[10px] leading-relaxed ${p.observacoes ? 'text-slate-600' : 'italic text-slate-400'}`}>
              {p.observacoes || 'Ainda não há uma observação registrada para este atleta.'}
            </p>
          </div>
        )}

        <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Completude do cadastro</p>
              <p className="mt-0.5 text-[10px] font-bold text-slate-600">{completeness.completed} de {completeness.items.length} itens</p>
            </div>
            <span className={`text-[11px] font-black ${completeness.percent === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>{completeness.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0a66b7] transition-all" style={{ width: `${completeness.percent}%` }}/></div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {completeness.items.map(item => {
              const Icon = item.icon
              return <div key={item.key} className={`flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[8px] font-bold ${item.done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>{item.done ? <Check size={9}/> : <Icon size={9}/>} {item.label}</div>
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          {canEdit ? (
            <div className="relative">
              <select value={p.status} onChange={event => onUpdate(p.id, { status: event.target.value })} className={`appearance-none rounded-lg border py-2 pl-2.5 pr-7 text-[10px] font-bold outline-none transition focus:ring-2 focus:ring-emerald-200 ${status.color}`}>
                {Object.keys(STATUS_CFG).map(item => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60"/>
            </div>
          ) : <span className="text-[9px] font-semibold text-slate-400">{formatRelativeDate(p.created_at)}</span>}

          <div className="ml-auto flex items-center gap-1.5">
            <Link href={`/lista-preferencial/${p.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[9px] font-extrabold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0a66b7]"><Eye size={12}/> Abrir</Link>
            {p.link_externo && <a href={p.link_externo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[9px] font-extrabold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><ExternalLink size={12}/> {getProfileLabel(p.link_externo)}</a>}
            {approved && canEdit && (
              <button type="button" onClick={() => onPromote(p)} disabled={promoting === p.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a66b7] px-2.5 py-2 text-[9px] font-extrabold text-white transition hover:bg-[#07579e] disabled:opacity-50">
                {promoting === p.id ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"/> : <CheckCircle2 size={12}/>} Monitorar
              </button>
            )}
            {canEdit && <button type="button" onClick={() => setExpanded(value => !value)} className={`grid h-8 w-8 place-items-center rounded-lg border transition ${expanded ? 'border-emerald-200 bg-emerald-50 text-[#0a66b7]' : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`} title="Mais ações"><MoreHorizontal size={15}/></button>}
          </div>
        </div>

        {expanded && canEdit && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Alterar prioridade</p><button type="button" onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-700"><X size={13}/></button></div>
            <div className="mt-2 flex gap-1.5">
              {['Alta', 'Média', 'Baixa'].map(item => <button key={item} type="button" onClick={() => { onUpdate(p.id, { prioridade: item }); setExpanded(false) }} className={`flex-1 rounded-lg py-2 text-[10px] font-extrabold transition ${p.prioridade === item ? PRIORIDADE_CFG[item].badge : 'bg-white text-slate-500 hover:bg-slate-100'}`}>{item}</button>)}
            </div>
            <button type="button" onClick={() => onRemove(p.id)} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50 py-2 text-[10px] font-extrabold text-red-500 transition hover:bg-red-100"><Trash2 size={12}/> Remover da lista</button>
          </div>
        )}
      </div>
    </article>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ListaPreferencialPage() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [promoting, setPromoting] = useState(null)
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [filterOrigem, setFilterOrigem] = useState('Todas')
  const [filterPrio, setFilterPrio] = useState('Todas')
  const [filterPos, setFilterPos] = useState('Todas')
  const [filterIdade, setFilterIdade] = useState('Todas')
  const [filterPe, setFilterPe] = useState('')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('fluxo')
  const [showFilters, setShowFilters] = useState(false)
  const [compact, setCompact] = useState(false)

  function getUsuario() {
    try { return sessionStorage.getItem('cig_user') || 'sistema' } catch { return 'sistema' }
  }

  const load = () => fetch('/api/lista-preferencial').then(response => response.json()).then(data => {
    setPlayers(data.players || [])
    setLoading(false)
  })

  useEffect(() => { load() }, [])

  async function handleAdd(data) {
    await fetch('/api/lista-preferencial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    load()
  }

  async function handleUpdate(id, fields) {
    await fetch('/api/lista-preferencial', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...fields, usuario: getUsuario() }) })
    load()
  }

  async function handleRemove(id) {
    if (!confirm('Remover este atleta do radar?')) return
    await fetch(`/api/lista-preferencial?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function handlePromote(player) {
    setPromoting(player.id)
    try {
      const response = await fetch('/api/monitoramento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', nome: player.jogador, time_atual: player.clube, posicao: player.posicao, nivel_interesse: 'Monitorando' }) })
      if (response.ok) {
        await handleUpdate(player.id, { status: 'Em Análise' })
        alert(`${player.jogador} adicionado ao Monitoramento!`)
      }
    } catch (error) {
      alert('Erro: ' + error.message)
    } finally {
      setPromoting(null)
    }
  }

  const positions = useMemo(() => ['Todas', ...new Set(players.map(player => player.posicao).filter(Boolean))], [players])
  const ageRanges = {
    'Até 23': player => (parseInt(player.idade || 0) || Math.floor((Date.now() - new Date(player.data_nascimento)) / (1000 * 60 * 60 * 24 * 365.25))) <= 23,
    '24–27': player => { const age = parseInt(player.idade || 0) || Math.floor((Date.now() - new Date(player.data_nascimento)) / (1000 * 60 * 60 * 24 * 365.25)); return age >= 24 && age <= 27 },
    '28+': player => (parseInt(player.idade || 0) || Math.floor((Date.now() - new Date(player.data_nascimento)) / (1000 * 60 * 60 * 24 * 365.25))) >= 28,
  }

  const filtered = useMemo(() => {
    const term = normalizeSearch(query)
    const priorityOrder = { Alta: 1, Média: 2, Baixa: 3 }
    const statusOrder = { Pendente: 1, 'Em Análise': 2, Aprovado: 3, Descartado: 4, Arquivado: 5 }

    return players.filter(player => {
      if (filterStatus !== 'Todos' && player.status !== filterStatus) return false
      if (filterOrigem !== 'Todas' && player.origem !== filterOrigem) return false
      if (filterPrio !== 'Todas' && player.prioridade !== filterPrio) return false
      if (filterPos !== 'Todas' && player.posicao !== filterPos) return false
      if (filterIdade !== 'Todas' && ageRanges[filterIdade] && !ageRanges[filterIdade](player)) return false
      if (filterPe && !matchesPlayerFoot(player, filterPe)) return false
      if (term) {
        const searchable = normalizeSearch([player.jogador, player.nome_completo, player.clube, player.posicao, player.origem, player.solicitante].filter(Boolean).join(' '))
        if (!searchable.includes(term)) return false
      }
      return true
    }).sort((a, b) => {
      if (sortBy === 'nome') return String(a.jogador || '').localeCompare(String(b.jogador || ''), 'pt-BR')
      if (sortBy === 'recentes') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      if (sortBy === 'antigos') return new Date(a.created_at || 0) - new Date(b.created_at || 0)
      if (sortBy === 'prioridade') return (priorityOrder[a.prioridade] || 9) - (priorityOrder[b.prioridade] || 9)
      return (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9) || (priorityOrder[a.prioridade] || 9) - (priorityOrder[b.prioridade] || 9) || new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  }, [players, filterStatus, filterOrigem, filterPrio, filterPos, filterIdade, filterPe, query, sortBy])

  const activePlayers = players.filter(player => !['Descartado', 'Arquivado'].includes(player.status))
  const counts = {
    Pendente: players.filter(player => player.status === 'Pendente').length,
    'Em Análise': players.filter(player => player.status === 'Em Análise').length,
    Aprovado: players.filter(player => player.status === 'Aprovado').length,
    Descartado: players.filter(player => player.status === 'Descartado').length,
    Arquivado: players.filter(player => player.status === 'Arquivado').length,
  }
  const originCounts = Object.entries(ORIGEM_CFG).map(([key, cfg]) => ({ key, cfg, count: activePlayers.filter(player => player.origem === key).length }))
  const approvedPlayers = players.filter(player => player.status === 'Aprovado')
  const activeFilterCount = [filterStatus !== 'Todos', filterOrigem !== 'Todas', filterPrio !== 'Todas', filterPos !== 'Todas', filterIdade !== 'Todas', Boolean(filterPe)].filter(Boolean).length

  function clearFilters() {
    setFilterStatus('Todos')
    setFilterOrigem('Todas')
    setFilterPrio('Todas')
    setFilterPos('Todas')
    setFilterIdade('Todas')
    setFilterPe('')
  }

  const statusCards = [
    { label: 'Pendente', icon: CalendarDays, tone: 'border-slate-200 bg-slate-50 text-slate-700', ring: 'ring-slate-400' },
    { label: 'Em Análise', icon: FileText, tone: 'border-blue-200 bg-blue-50 text-blue-700', ring: 'ring-blue-400' },
    { label: 'Aprovado', icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', ring: 'ring-emerald-400' },
    { label: 'Descartado', icon: X, tone: 'border-red-100 bg-red-50 text-red-500', ring: 'ring-red-300' },
    { label: 'Arquivado', icon: Archive, tone: 'border-amber-200 bg-amber-50 text-amber-700', ring: 'ring-amber-300' },
  ]

  return (
    <AppShell>
      <main className="mx-auto max-w-[1380px] px-5 py-6 lg:px-8 lg:py-7">
        <section className="relative mb-5 overflow-hidden rounded-[26px] border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/70 p-5 shadow-sm lg:p-6">
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-emerald-100/50 blur-3xl"/>
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-700"><UserRound size={11}/> Watchlist operacional</span>
              <h1 className="mt-2 text-4xl font-black uppercase leading-none text-[#0a66b7] lg:text-[44px]" style={{ fontFamily: "'Barlow Condensed',sans-serif" }}>Lista Preferencial</h1>
              <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-slate-500">Cadastro manual e triagem interna dos atletas indicados à CIC, com origem, prioridade, status e encaminhamento para Monitoramento.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="rounded-lg bg-[#0a66b7] px-2.5 py-1.5 text-white">{activePlayers.length} ativos</span>
                <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500">{players.length} no histórico</span>
                <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500">{counts.Descartado} descartados</span>
                <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500">{counts.Arquivado} arquivados</span>
              </div>
            </div>
            {canEdit && <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#0a66b7] px-4 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(10,102,183,0.18)] transition hover:-translate-y-0.5 hover:bg-[#07579e] lg:self-center"><Plus size={17}/> Adicionar atleta</button>}
          </div>
        </section>

        {approvedPlayers.length > 0 && (
          <section className="mb-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={20}/></div>
                <div><p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">Aprovados aguardando encaminhamento</p><p className="mt-0.5 text-xs text-slate-500">{approvedPlayers.length} atleta{approvedPlayers.length !== 1 ? 's' : ''} pronto{approvedPlayers.length !== 1 ? 's' : ''} para entrar no Monitoramento.</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {approvedPlayers.map(player => <button key={player.id} type="button" onClick={() => handlePromote(player)} disabled={promoting === player.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a66b7] px-3 py-2 text-[10px] font-extrabold text-white transition hover:bg-[#07579e] disabled:opacity-50">{promoting === player.id ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"/> : <CheckCircle2 size={12}/>} {player.jogador}</button>)}
              </div>
            </div>
          </section>
        )}

        <section className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-5">
          {statusCards.map(card => {
            const Icon = card.icon
            const selected = filterStatus === card.label
            return <button key={card.label} type="button" onClick={() => setFilterStatus(selected ? 'Todos' : card.label)} className={`rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${card.tone} ${selected ? `ring-2 ring-offset-1 ${card.ring}` : ''}`}><div className="flex items-center justify-between gap-2"><Icon size={15} className="opacity-80"/><span className="text-[9px] font-extrabold uppercase tracking-[0.12em] opacity-70">{card.label}</span></div><p className="mt-2 text-2xl font-black leading-none" style={{ fontFamily: "'Barlow Condensed',sans-serif" }}>{counts[card.label]}</p></button>
          })}
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar atleta, clube, posição ou solicitante..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"/>
              {query && <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={15}/></button>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative"><ArrowUpDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><select value={sortBy} onChange={event => setSortBy(event.target.value)} className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-[11px] font-bold text-slate-600 outline-none hover:border-slate-300"><option value="fluxo">Ordem do fluxo</option><option value="prioridade">Maior prioridade</option><option value="recentes">Mais recentes</option><option value="antigos">Mais antigos</option><option value="nome">Nome A–Z</option></select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/></div>
              <button type="button" onClick={() => setShowFilters(value => !value)} className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-extrabold transition ${showFilters || activeFilterCount ? 'border-emerald-200 bg-emerald-50 text-[#0a66b7]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><SlidersHorizontal size={14}/> Filtros {activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#0a66b7] px-1 text-[9px] text-white">{activeFilterCount}</span>}</button>
              <button type="button" onClick={() => setCompact(value => !value)} className={`grid h-11 w-11 place-items-center rounded-xl border transition ${compact ? 'border-emerald-200 bg-emerald-50 text-[#0a66b7]' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`} title={compact ? 'Visualização confortável' : 'Visualização compacta'}><LayoutGrid size={16}/></button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="mr-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Origem</span>
            <button type="button" onClick={() => setFilterOrigem('Todas')} className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-extrabold transition ${filterOrigem === 'Todas' ? 'border-[#0a66b7] bg-[#0a66b7] text-white' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Todas · {activePlayers.length}</button>
            {originCounts.map(({ key, cfg, count }) => <button key={key} type="button" onClick={() => setFilterOrigem(filterOrigem === key ? 'Todas' : key)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-extrabold transition ${filterOrigem === key ? 'ring-2 ring-[#0a66b7] ring-offset-1' : ''} ${cfg.color}`}><span>{cfg.icon}</span>{key} · {count}</button>)}
          </div>

          {showFilters && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Filter size={14} className="text-[#0a66b7]"/><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-600">Filtros avançados</p></div>{activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="text-[9px] font-extrabold text-red-500 hover:text-red-600">Limpar filtros</button>}</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="grid gap-1.5"><span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Status</span><select value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none">{['Todos', 'Pendente', 'Em Análise', 'Aprovado', 'Descartado', 'Arquivado'].map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1.5"><span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Prioridade</span><select value={filterPrio} onChange={event => setFilterPrio(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none">{['Todas', 'Alta', 'Média', 'Baixa'].map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1.5"><span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Posição</span><select value={filterPos} onChange={event => setFilterPos(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none">{positions.map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1.5"><span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Faixa etária</span><select value={filterIdade} onChange={event => setFilterIdade(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none">{['Todas', 'Até 23', '24–27', '28+'].map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="grid gap-1.5"><span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Pé preferido</span><select value={filterPe} onChange={event => setFilterPe(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 outline-none">{PLAYER_FOOT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              </div>
            </div>
          )}
        </section>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-extrabold text-slate-700">{filtered.length} atleta{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p><p className="mt-0.5 text-[10px] text-slate-400">Cards organizados por status, prioridade e data de cadastro.</p></div>
          {(query || activeFilterCount > 0) && <button type="button" onClick={() => { setQuery(''); clearFilters() }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-extrabold text-slate-500 hover:bg-slate-50"><X size={12}/> Limpar busca e filtros</button>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...Array(6)].map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[20px] border border-slate-100 bg-white"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Search size={21}/></div><p className="mt-4 text-sm font-extrabold text-slate-600">Nenhum atleta encontrado</p><p className="mt-1 text-xs text-slate-400">{players.length === 0 ? 'Adicione atletas usando o botão acima.' : 'Ajuste a busca ou remova alguns filtros.'}</p></div>
        ) : (
          <div className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${compact ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            {filtered.map(player => <AthleteCard key={player.id} p={player} compact={compact} canEdit={canEdit} onUpdate={handleUpdate} onRemove={handleRemove} onPromote={handlePromote} promoting={promoting} onFotoSaved={load}/>)}
          </div>
        )}
      </main>
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSave={handleAdd}/>} 
    </AppShell>
  )
}
