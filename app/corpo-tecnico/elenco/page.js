'use client'
import { useState, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import { usePlayerPhotos } from '../../hooks/usePlayerPhotos'
import { PhotoSelectorModal } from '../../components/photos/PhotoSelectorModal'

const STYLE = `
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }

  @media print {
    @page {
      size: A4 landscape;
      margin: 0.6cm 0.8cm;
    }

    /* Esconde TUDO menos o print-view */
    body > * { display: none !important; }
    #__next { display: block !important; }
    #__next > * { display: none !important; }
    #print-elenco-wrapper { display: block !important; }

    .no-print { display: none !important; }

    /* Layout do print */
    #print-elenco-wrapper {
      font-family: 'DM Sans', 'Barlow Condensed', sans-serif;
      width: 100%;
      color: #0f172a;
    }

    .print-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0a66b7;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }

    .print-header-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0a66b7;
    }

    .print-header-sub {
      font-size: 7px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .print-header-date {
      font-size: 7px;
      color: #64748b;
      text-align: right;
    }

    /* Grid de posições */
    .print-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }

    /* Bloco de cada posição */
    .print-pos-block {
      break-inside: avoid;
    }

    .print-pos-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #0a66b7;
      background: #eaf4fd;
      border-left: 3px solid #0a66b7;
      padding: 2px 5px;
      margin-bottom: 3px;
    }

    /* Linha de cada atleta */
    .print-player-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 3px;
      border-bottom: 1px solid #f1f5f9;
    }

    .print-player-row:last-child { border-bottom: none; }

    .print-player-photo {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      object-fit: cover;
      object-position: top;
      flex-shrink: 0;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .print-player-num {
      font-size: 7px;
      font-weight: 900;
      color: #0a66b7;
      min-width: 12px;
      text-align: center;
      flex-shrink: 0;
    }

    .print-player-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0f172a;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .print-player-meta {
      font-size: 6.5px;
      color: #64748b;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .print-player-pos {
      font-size: 6px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 1px 3px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .print-footer {
      margin-top: 8px;
      border-top: 1px solid #e2e8f0;
      padding-top: 3px;
      display: flex;
      justify-content: space-between;
      font-size: 6px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* Impede quebra dentro do bloco de posição inteiro se couber */
    .print-pos-block { page-break-inside: avoid; }
  }
`

// ─── ENRICH — cache module-level, fetch fora de qualquer render ───────────────
const _eCache = {}   // normKey → data | null
const _eInflight = {}

function eNorm(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').trim()
}

function fetchEnrichBatch(names, onUpdate) {
  names.forEach(name => {
    const k = eNorm(name)
    if (!k || k in _eCache || _eInflight[k]) return
    _eInflight[k] = true
    fetch(`/api/player-enrichment?player=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { _eCache[k] = d.error ? null : d; delete _eInflight[k]; onUpdate(k, _eCache[k]) })
      .catch(() => { _eCache[k] = null; delete _eInflight[k]; onUpdate(k, null) })
  })
}

const POSICOES = ['Goleiro','Zagueiro','Lateral Direito','Lateral Esquerdo','Volante','Meia','Extremo Direito','Extremo Esquerdo','Centroavante','Atacante']
const PES = ['Direito','Esquerdo','Ambidestro']

const POS_COLORS = {
  'GOLEIRO':       { bg:'bg-amber-50',   border:'border-amber-200',   badge:'bg-amber-100 text-amber-700',    icon:'🧤' },
  'ZAGUEIRO':      { bg:'bg-blue-50',    border:'border-blue-200',    badge:'bg-blue-100 text-blue-700',      icon:'🛡️' },
  'LATERAL':       { bg:'bg-sky-50',     border:'border-sky-200',     badge:'bg-sky-100 text-sky-700',        icon:'⬆️' },
  'VOLANTE':       { bg:'bg-violet-50',  border:'border-violet-200',  badge:'bg-violet-100 text-violet-700',  icon:'⚙️' },
  'MEIA':          { bg:'bg-purple-50',  border:'border-purple-200',  badge:'bg-purple-100 text-purple-700',  icon:'🎯' },
  'EXTREMO':       { bg:'bg-orange-50',  border:'border-orange-200',  badge:'bg-orange-100 text-orange-700',  icon:'💨' },
  'CENTROAVANTE':  { bg:'bg-rose-50',    border:'border-rose-200',    badge:'bg-rose-100 text-rose-700',      icon:'🎯' },
  'ATACANTE':      { bg:'bg-red-50',     border:'border-red-200',     badge:'bg-red-100 text-red-700',        icon:'⚡' },
}
const DEFAULT_POS = { bg:'bg-gray-50', border:'border-gray-200', badge:'bg-gray-100 text-gray-700', icon:'⚽' }
const POS_ORDER = ['GOLEIRO','ZAGUEIRO','LATERAL','VOLANTE','MEIA','EXTREMO','CENTROAVANTE','ATACANTE']

// Label display por grupo
const POS_LABELS = {
  'GOLEIRO':      'Goleiros',
  'ZAGUEIRO':     'Zagueiros',
  'LATERAL':      'Laterais',
  'VOLANTE':      'Volantes',
  'MEIA':         'Meias',
  'EXTREMO':      'Extremos',
  'CENTROAVANTE': 'Centroavantes',
  'ATACANTE':     'Atacantes',
  'OUTROS':       'Outros',
}

function posStyle(pos) {
  if (!pos) return DEFAULT_POS
  const u = pos.toUpperCase()
  const match = Object.entries(POS_COLORS).find(([k]) => u.includes(k))
  return match ? match[1] : DEFAULT_POS
}

// Calcula idade a partir de uma string de data (YYYY-MM-DD ou ISO)
function calcAge(dateStr) {
  if (!dateStr) return null
  try {
    const b = new Date(dateStr)
    if (isNaN(b.getTime())) return null
    const t = new Date()
    let a = t.getFullYear() - b.getFullYear()
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--
    return a >= 0 && a < 60 ? a : null
  } catch { return null }
}

function emptyForm() {
  return { nome:'', posicao:'', numero:'', altura:'', peso:'', pe_dominante:'', data_nascimento:'', contrato_inicio:'', contrato_fim:'', ativo: true }
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

// ─── PLAYER CARD ──────────────────────────────────────────────────────────────
function PlayerCard({ player, getPhotoUrl, onPhotoClick, onEdit, onDelete, enrich }) {
  const c = posStyle(player.posicao)
  const initials = (player.nome || '').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0,2).toUpperCase()
  const photoUrl = getPhotoUrl(player.nome)
  const [confirming, setConfirming] = useState(false)

  const contratoFim = player.contrato_fim ? fmtDate(player.contrato_fim) : null
  const contratoExp = player.contrato_fim ? Math.round((new Date(player.contrato_fim) - new Date()) / 86400000) : null

  // Idade: prioriza data_nascimento do DB, fallback no enrichment TM
  const idade = calcAge(player.data_nascimento) ?? (() => {
    if (!enrich?.birthDate) return null
    return calcAge(enrich.birthDate)
  })()

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${c.bg} ${c.border} ${player.ativo === false ? 'opacity-60' : ''}`}>
      <div className="px-3.5 pt-3 pb-2 flex items-center gap-2.5">
        <div className="relative flex-shrink-0 cursor-pointer group" onClick={() => onPhotoClick(player.nome)}>
          <div className="w-11 h-11 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center overflow-hidden relative">
            {photoUrl
              ? <img src={photoUrl} alt={player.nome} className="w-full h-full object-cover object-top" onError={e=>{e.target.style.display='none'}}/>
              : <span className="bc text-sm font-black text-gray-600">{initials}</span>
            }
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center rounded-full">
              <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
          </div>
          {player.numero != null && (
            <div className="absolute -bottom-0.5 -right-1 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <span className="text-[8px] font-black text-gray-700">{player.numero}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            {enrich?.nationalityFlag && <span className="text-[10px] flex-shrink-0">{enrich.nationalityFlag}</span>}
            <p className="bc text-[13px] font-black uppercase text-gray-900 leading-tight truncate">{player.nome}</p>
          </div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {player.posicao && <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${c.badge}`}>{player.posicao}</span>}
            {player.pe_dominante && <span className="text-[7px] text-gray-400">{player.pe_dominante === 'Direito' ? '🦶D' : player.pe_dominante === 'Esquerdo' ? '🦶E' : '🦶A'}</span>}
            {idade !== null && (
              <span className="text-[7px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {idade} anos
                {(player.data_nascimento || enrich?.birthDate) && (
                  <span className="font-normal text-gray-400"> · {fmtDate(player.data_nascimento || enrich?.birthDate)}</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {enrich?.marketValueFmt && (
        <div className="mx-3 mb-1.5 flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/70 border border-gray-100">
          <span className="text-[7px] font-black uppercase tracking-wider text-gray-500">Val. Mercado</span>
          <span className="text-[9px] font-black text-sky-700">{enrich.marketValueFmt}</span>
        </div>
      )}

      {(player.altura || player.peso) && (
        <div className="mx-3 mb-1.5 flex items-center gap-3 px-2.5 py-1.5 rounded-xl bg-white/70 border border-gray-100">
          {player.altura && <div className="text-center"><p className="text-[9px] font-black text-gray-700">{player.altura}m</p><p className="text-[6px] uppercase text-gray-400">Altura</p></div>}
          {player.altura && player.peso && <div className="w-px h-4 bg-gray-200"/>}
          {player.peso   && <div className="text-center"><p className="text-[9px] font-black text-gray-700">{player.peso}kg</p><p className="text-[6px] uppercase text-gray-400">Peso</p></div>}
        </div>
      )}

      {contratoFim && (
        <div className={`mx-3 mb-1.5 flex items-center justify-between px-2.5 py-1 rounded-xl border
          ${contratoExp !== null && contratoExp < 90 ? 'bg-red-50 border-red-100' : contratoExp !== null && contratoExp < 180 ? 'bg-amber-50 border-amber-100' : 'bg-sky-50 border-sky-100'}`}>
          <span className="text-[7px] font-black uppercase tracking-wider text-gray-500">Contrato até</span>
          <span className={`text-[8px] font-bold ${contratoExp !== null && contratoExp < 90 ? 'text-red-700' : contratoExp !== null && contratoExp < 180 ? 'text-amber-700' : 'text-sky-700'}`}>{contratoFim}</span>
        </div>
      )}

      <div className="px-3 pb-2.5 flex gap-1.5">
        <button onClick={() => onEdit(player)}
          className="flex-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-white/80 text-gray-600 hover:bg-white border border-gray-200 transition-colors">
          Editar
        </button>
        {confirming ? (
          <div className="flex gap-1">
            <button onClick={() => { onDelete(player.id); setConfirming(false) }}
              className="px-2 py-1 rounded-lg text-[8px] font-black bg-red-600 text-white hover:bg-red-700">Sim</button>
            <button onClick={() => setConfirming(false)}
              className="px-2 py-1 rounded-lg text-[8px] font-black bg-white/80 text-gray-500 border border-gray-200">Não</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="px-2.5 py-1 rounded-lg text-[8px] font-black bg-white/80 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition-colors">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MODAL FORM ───────────────────────────────────────────────────────────────
function PlayerFormModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [fetchingTM, setFetchingTM] = useState(false)
  const [tmMsg, setTmMsg] = useState('')

  async function fetchFromTM() {
    if (!form.nome.trim()) { setTmMsg('Digite o nome primeiro.'); return }
    setFetchingTM(true); setTmMsg('')
    try {
      const res  = await fetch(`/api/player-enrichment?player=${encodeURIComponent(form.nome.trim())}`)
      const data = await res.json()
      if (data.error || !data.birthDate) { setTmMsg('Não encontrado no Transfermarkt.'); return }
      const bd = String(data.birthDate).substring(0, 10)
      set('data_nascimento', bd)
      const age = calcAge(bd)
      setTmMsg(`✅ ${age ? age + ' anos · ' : ''}${bd} (Transfermarkt)`)
    } catch { setTmMsg('Erro ao buscar.') }
    finally { setFetchingTM(false) }
  }

  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      setForm({
        nome:            initial.nome            || '',
        posicao:         initial.posicao         || '',
        numero:          initial.numero          != null ? String(initial.numero) : '',
        altura:          initial.altura          != null ? String(initial.altura) : '',
        peso:            initial.peso            != null ? String(initial.peso)   : '',
        pe_dominante:    initial.pe_dominante    || '',
        data_nascimento: initial.data_nascimento ? String(initial.data_nascimento).substring(0,10) : '',
        contrato_inicio: initial.contrato_inicio ? String(initial.contrato_inicio).substring(0,10) : '',
        contrato_fim:    initial.contrato_fim    ? String(initial.contrato_fim).substring(0,10)    : '',
        ativo:           initial.ativo !== false,
      })
    } else {
      setForm(emptyForm())
    }
  }, [isOpen, initial])

  if (!isOpen) return null

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="dm bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="bc text-lg font-black uppercase text-gray-900">{initial ? 'Editar Atleta' : 'Novo Atleta'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
              placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Posição</label>
              <select value={form.posicao} onChange={e => set('posicao', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 bg-white">
                <option value="">—</option>
                {POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Nº Camisa</label>
              <input type="number" value={form.numero} onChange={e => set('numero', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                placeholder="Ex: 10" min="1" max="99" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Altura (m)</label>
              <input type="number" step="0.01" value={form.altura} onChange={e => set('altura', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                placeholder="Ex: 1.82" />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Peso (kg)</label>
              <input type="number" step="0.1" value={form.peso} onChange={e => set('peso', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                placeholder="Ex: 78.5" />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Pé Dominante</label>
            <select value={form.pe_dominante} onChange={e => set('pe_dominante', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 bg-white">
              <option value="">—</option>
              {PES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {/* DATA DE NASCIMENTO */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500">Data de Nascimento</label>
              <button
                onClick={fetchFromTM}
                disabled={fetchingTM}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 text-[8px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {fetchingTM
                  ? <><span className="w-2.5 h-2.5 border border-blue-500 border-t-transparent rounded-full animate-spin inline-block"/>Buscando...</>
                  : <>🔍 Buscar via TM</>
                }
              </button>
            </div>
            <input
              type="date"
              value={form.data_nascimento}
              onChange={e => { set('data_nascimento', e.target.value); setTmMsg('') }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
            />
            {form.data_nascimento && calcAge(form.data_nascimento) !== null && (
              <p className="text-[9px] text-gray-400 mt-1 ml-1">
                🎂 {calcAge(form.data_nascimento)} anos
              </p>
            )}
            {tmMsg && (
              <p className={`text-[9px] mt-1 ml-1 ${tmMsg.startsWith('✅') ? 'text-sky-600' : 'text-amber-600'}`}>{tmMsg}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Início Contrato</label>
              <input type="date" value={form.contrato_inicio} onChange={e => set('contrato_inicio', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Fim Contrato</label>
              <input type="date" value={form.contrato_fim} onChange={e => set('contrato_fim', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} className="w-4 h-4 rounded accent-teal-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Atleta Ativo</span>
          </label>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PRINT VIEW (renderiza fora do AppShell, só visível no @media print) ──────
const POS_BADGE_COLORS = {
  'GOLEIRO':      { bg:'#fef3c7', color:'#92400e' },
  'ZAGUEIRO':     { bg:'#dbeafe', color:'#1e40af' },
  'LATERAL':      { bg:'#e0f2fe', color:'#075985' },
  'VOLANTE':      { bg:'#ede9fe', color:'#4c1d95' },
  'MEIA':         { bg:'#f3e8ff', color:'#6b21a8' },
  'EXTREMO':      { bg:'#ffedd5', color:'#9a3412' },
  'CENTROAVANTE': { bg:'#ffe4e6', color:'#9f1239' },
  'ATACANTE':     { bg:'#fee2e2', color:'#991b1b' },
}
const DEFAULT_BADGE = { bg:'#f1f5f9', color:'#475569' }

function posBadge(pos) {
  if (!pos) return DEFAULT_BADGE
  const u = pos.toUpperCase()
  const match = Object.entries(POS_BADGE_COLORS).find(([k]) => u.includes(k))
  return match ? match[1] : DEFAULT_BADGE
}

function PrintView({ posGroups, getPhotoUrl, enrichMap }) {
  const today = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
  const total = posGroups.reduce((s, [, p]) => s + p.length, 0)

  return (
    <div id="print-elenco-wrapper" style={{ display:'none' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');
      `}</style>

      {/* HEADER */}
      <div className="print-header">
        <div>
          <div className="print-header-title">🐛 Confiança — Plantel 2026</div>
          <div className="print-header-sub">Departamento de Preparação · Temporada 2026 · Série C</div>
        </div>
        <div className="print-header-date">
          <div style={{fontWeight:700, fontSize:'8px', color:'#0a66b7'}}>{total} Atletas</div>
          <div>{today}</div>
          <div>Centro de Inteligência · Confiança</div>
        </div>
      </div>

      {/* GRID DE POSIÇÕES */}
      <div className="print-grid">
        {posGroups.map(([pos, posPlayers]) => {
          return (
            <div key={pos} className="print-pos-block">
              <div className="print-pos-title">
                {POS_LABELS[pos] || pos} · {posPlayers.length}
              </div>
              {posPlayers.map(p => {
                const photoUrl = getPhotoUrl(p.nome)
                const enrich   = enrichMap[eNorm(p.nome)] ?? null
                const idade    = calcAge(p.data_nascimento) ?? calcAge(enrich?.birthDate)
                const badge    = posBadge(p.posicao)
                const initials = (p.nome || '').split(' ').filter(Boolean).map(n=>n[0]).join('').substring(0,2).toUpperCase()
                return (
                  <div key={p.id} className="print-player-row">
                    {/* Foto */}
                    {photoUrl
                      ? <img src={photoUrl} className="print-player-photo" alt={p.nome} onError={e=>{e.target.style.display='none'}}/>
                      : <div className="print-player-photo" style={{display:'flex',alignItems:'center',justifyContent:'center',background:'#e2e8f0',fontSize:'6px',fontWeight:900,color:'#64748b'}}>{initials}</div>
                    }
                    {/* Número */}
                    <span className="print-player-num">{p.numero ?? '—'}</span>
                    {/* Nome */}
                    <span className="print-player-name">{p.nome}</span>
                    {/* Meta: idade + altura */}
                    <span className="print-player-meta">
                      {idade ? `${idade}a` : ''}
                      {idade && p.altura ? ' · ' : ''}
                      {p.altura ? `${p.altura}m` : ''}
                    </span>
                    {/* Badge posição abreviada */}
                    {p.posicao && (
                      <span className="print-player-pos" style={{background: badge.bg, color: badge.color}}>
                        {p.posicao.split(' ')[0].substring(0,3).toUpperCase()}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* FOOTER */}
      <div className="print-footer">
        <span>Confiança · Preparação 2026 · Uso Interno</span>
        <span>Sistema Integrado de Desempenho · Centro de Inteligência · Confiança</span>
      </div>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function ElencoPage() {
  const { getPhotoUrl, setPhoto, loaded: photosLoaded } = usePlayerPhotos()
  const [players,      setPlayers]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [filterPos,    setFilterPos]    = useState('Todos')
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editPlayer,   setEditPlayer]   = useState(null)
  const [photoModal,   setPhotoModal]   = useState(null)
  const [enrichMap,    setEnrichMap]    = useState({})

  async function loadPlayers() {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/squad')
      const data = await res.json()
      setPlayers(Array.isArray(data.players) ? data.players : [])
    } catch(e) {
      setError('Erro ao carregar elenco.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPlayers() }, [])

  // Enriquecimento — dispara uma vez quando players carrega, nunca em loop de render
  useEffect(() => {
    if (!players.length) return
    fetchEnrichBatch(players.map(p => p.nome), (k, data) => {
      setEnrichMap(prev => ({ ...prev, [k]: data }))
    })
  }, [players.length])

  async function savePlayer(form) {
    const isEdit = !!editPlayer
    const url    = isEdit ? `/api/squad/${editPlayer.id}` : '/api/squad'
    const method = isEdit ? 'PUT' : 'POST'

    // Sanitiza campos numéricos antes de enviar — evita NaN no Postgres
    const safeInt = (v) => { if (v === '' || v == null) return null; const n = parseInt(String(v)); return isNaN(n) ? null : n }
    const safeFlt = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',','.')); return isNaN(n) ? null : n }

    const payload = {
      ...form,
      numero: safeInt(form.numero),
      altura: safeFlt(form.altura),
      peso:   safeFlt(form.peso),
    }

    const res    = await fetch(url, { method, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
    const data   = await res.json()
    if (data.error) { alert(data.error); return }
    setModalOpen(false); setEditPlayer(null)
    if (isEdit) setPlayers(prev => prev.map(p => p.id === editPlayer.id ? data.player : p))
    else setPlayers(prev => [...prev, data.player])
  }

  async function deletePlayer(id) {
    await fetch(`/api/squad/${id}`, { method: 'DELETE' })
    setPlayers(prev => prev.filter(p => p.id !== id))
  }

  const visible = players.filter(p => showInactive ? true : p.ativo !== false)
  const byPos = {}
  visible.forEach(p => {
    const u = (p.posicao || '').toUpperCase()
    const k = POS_ORDER.find(o => u.includes(o)) || 'OUTROS'
    if (!byPos[k]) byPos[k] = []
    byPos[k].push(p)
  })
  Object.keys(byPos).forEach(k => { byPos[k].sort((a,b) => (a.numero||99) - (b.numero||99) || a.nome.localeCompare(b.nome)) })

  const posGroups = Object.entries(byPos).sort(([a],[b]) => {
    const ia = POS_ORDER.indexOf(a), ib = POS_ORDER.indexOf(b)
    if (ia===-1&&ib===-1) return a.localeCompare(b)
    if (ia===-1) return 1; if (ib===-1) return -1
    return ia - ib
  })
  const allPos   = ['Todos', ...posGroups.map(([p]) => p)]
  const filtered = filterPos === 'Todos' ? posGroups : posGroups.filter(([p]) => p === filterPos)

  if (!photosLoaded) return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    </AppShell>
  )

  return (
    <>
      {/* PRINT-ONLY VIEW — fora do AppShell, invisível na tela */}
      <PrintView posGroups={posGroups} getPhotoUrl={getPhotoUrl} enrichMap={enrichMap} />

      <AppShell>
        <style>{STYLE}</style>
        <div className="dm h-screen overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">

          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-teal-500"/>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-400">Plantel Confiança · 2026</p>
              </div>
              <h1 className="bc text-4xl font-black uppercase text-gray-900 leading-none">Elenco</h1>
              {!loading && <p className="text-sm text-gray-400 mt-1">{visible.length} atleta{visible.length!==1?'s':''}</p>}
            </div>
            <div className="no-print flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5 accent-teal-600"/>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Inativos</span>
              </label>
              <button onClick={loadPlayers}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[9px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                Atualizar
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-sky-700 transition-colors shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Exportar PDF
              </button>
              <button onClick={() => { setEditPlayer(null); setModalOpen(true) }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-teal-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14"/></svg>
                Novo Atleta
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Carregando elenco...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <p className="text-sm text-red-600 font-semibold">{error}</p>
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center gap-4">
              <p className="text-4xl">👥</p>
              <p className="bc text-xl font-black uppercase text-gray-400">Nenhum atleta cadastrado</p>
              <button onClick={() => { setEditPlayer(null); setModalOpen(true) }}
                className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700">
                Cadastrar Primeiro Atleta
              </button>
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <>
              <div className="no-print flex flex-wrap gap-1.5 mb-5">
                {allPos.map(p => (
                  <button key={p} onClick={() => setFilterPos(p)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                      ${filterPos===p?'bg-teal-600 text-white border-teal-600 shadow-sm':'bg-white text-gray-500 border-gray-200 hover:border-teal-300 hover:text-teal-600'}`}>
                    {p} <span className="opacity-50 ml-0.5">({p==='Todos'?visible.length:(byPos[p]?.length||0)})</span>
                  </button>
                ))}
              </div>

              <div className="space-y-7">
                {filtered.map(([pos, posPlayers]) => {
                  const c = posStyle(pos)
                  return (
                    <div key={pos}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-lg">{c.icon}</span>
                        <div>
                          <p className="bc text-xl font-black uppercase text-gray-800">{POS_LABELS[pos] || (pos.charAt(0)+pos.slice(1).toLowerCase())}</p>
                          <p className="text-[8px] text-gray-400">{posPlayers.length} atleta{posPlayers.length!==1?'s':''}</p>
                        </div>
                        <div className="flex-1 h-px bg-gray-200 ml-2"/>
                      </div>
                      <div className="print-card-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {posPlayers.map(p => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            getPhotoUrl={getPhotoUrl}
                            onPhotoClick={name => setPhotoModal(name)}
                            onEdit={player => { setEditPlayer(player); setModalOpen(true) }}
                            onDelete={deletePlayer}
                            enrich={enrichMap[eNorm(p.nome)] ?? null}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <PlayerFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditPlayer(null) }}
        onSave={savePlayer}
        initial={editPlayer}
      />

      <PhotoSelectorModal
        isOpen={!!photoModal}
        playerName={photoModal}
        currentPhoto={photoModal ? getPhotoUrl(photoModal) : null}
        onPhotoSelect={url => { if (photoModal) setPhoto(photoModal, url || null) }}
        onClose={() => setPhotoModal(null)}
      />
    </AppShell>
    </>
  )
}
