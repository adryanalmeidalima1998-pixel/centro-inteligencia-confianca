'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const GREEN       = '#0a66b7'
const GREEN_LIGHT = '#f0fdf4'
const GREEN_DARK  = '#064b82'

const LOCAIS   = ['Brinco', 'Paulinia', 'Academia', 'Outro']
const TURNOS   = ['Manha', 'Tarde', 'Noite']
const OBJ_LIST = [
  'Fisico Tecnico', 'Velocidade', 'Resistencia', 'Potencia',
  'Comportamento defensivo', 'Comportamento ofensivo', 'Transição',
  'Bola parada', 'Ativação', 'Regenerativo', 'Estratégico jogo',
]

function emptyForm() {
  return {
    data: '', semana: '', local: '', periodo: '',
    objetivo_sessao: '', objetivo_secundario: '',
    atividade_1: '', atividade_2: '', atividade_3: '', atividade_4: '', atividade_5: '',
    complemento: '', pdf_id: '', link_video: '', unid_treino: '',
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtDate(raw) {
  if (!raw) return '—'
  try {
    const d = typeof raw === 'string' && raw.length === 10
      ? new Date(raw + 'T12:00:00') : new Date(raw)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return '—' }
}

function fmtDateLong(raw) {
  if (!raw) return '—'
  try {
    const d = typeof raw === 'string' && raw.length === 10
      ? new Date(raw + 'T12:00:00') : new Date(raw)
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return '—' }
}

function ytEmbed(url) {
  if (!url) return null
  const m =
    url.match(/youtu\.be\/([^?&]+)/) ||
    url.match(/[?&]v=([^?&]+)/) ||
    url.match(/embed\/([^?&]+)/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

function getAtividades(s) {
  return [s.atividade_1, s.atividade_2, s.atividade_3, s.atividade_4, s.atividade_5]
    .filter(Boolean)
}

// ─── BADGE DE TURNO ──────────────────────────────────────────────────────────
function TurnoBadge({ t }) {
  const map = {
    Manha: 'bg-yellow-50 text-yellow-700',
    Tarde: 'bg-orange-50 text-orange-700',
    Noite: 'bg-indigo-50 text-indigo-700',
  }
  return (
    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${map[t] || 'bg-gray-100 text-gray-500'}`}>
      {t || '—'}
    </span>
  )
}

// ─── PAINEL DE DETALHE ───────────────────────────────────────────────────────
function DetailPanel({ sessao, pdfs, onClose, onEdit, onDelete }) {
  const [tab, setTab] = useState('info')
  const atividades = getAtividades(sessao)
  const pdfRec = pdfs.find(p => p.id === sessao.pdf_id || String(p.id) === String(sessao.pdf_id))
  const pdfUrl = pdfRec?.url || null
  const videoEmbed = ytEmbed(sessao.link_video)

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${GREEN_DARK} 0%, ${GREEN} 100%)` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Semana {sessao.semana || '—'} · {sessao.local || '—'}
            </p>
            <p className="text-white font-black text-base leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>
              {sessao.objetivo_sessao || 'Sessão de Treino'}
            </p>
            <p className="text-[9px] mt-1.5 capitalize" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {fmtDateLong(sessao.data)}
            </p>
            {sessao.periodo && <TurnoBadge t={sessao.periodo} />}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={onEdit}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 text-white/70 hover:text-white transition-all"
              title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 text-white/70 hover:text-white transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 mt-3">
          {[
            { key: 'info', label: 'Detalhes' },
            pdfUrl ? { key: 'pdf', label: '📄 PDF' } : null,
            videoEmbed ? { key: 'video', label: '🎬 Vídeo' } : null,
          ].filter(Boolean).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
              style={tab === t.key
                ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                : { color: 'rgba(255,255,255,0.45)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 overflow-hidden">
        {tab === 'info' && (
          <div className="h-full overflow-y-auto p-4 space-y-4">
            {/* Objetivos */}
            <InfoBlock title="Objetivo Principal">
              <p className="text-[11px] text-gray-700 font-semibold">{sessao.objetivo_sessao || '—'}</p>
            </InfoBlock>
            {sessao.objetivo_secundario && (
              <InfoBlock title="Objetivo Secundário">
                <p className="text-[11px] text-gray-600">{sessao.objetivo_secundario}</p>
              </InfoBlock>
            )}

            {/* Atividades */}
            {atividades.length > 0 && (
              <InfoBlock title={`Atividades (${atividades.length})`}>
                <div className="space-y-1.5">
                  {atividades.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] font-black text-white mt-0.5"
                        style={{ background: GREEN }}>{i + 1}</span>
                      <p className="text-[10px] text-gray-700 leading-relaxed">{a}</p>
                    </div>
                  ))}
                </div>
              </InfoBlock>
            )}

            {/* Complemento */}
            {sessao.complemento && (
              <InfoBlock title="Complemento">
                <p className="text-[10px] text-gray-600 leading-relaxed">{sessao.complemento}</p>
              </InfoBlock>
            )}

            {/* Links */}
            <InfoBlock title="Vínculos">
              <div className="space-y-2">
                {pdfRec ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:bg-sky-50"
                    style={{ borderColor: '#bbf7d0' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0" style={{ stroke: GREEN }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="text-[9px] font-bold truncate" style={{ color: GREEN }}>
                      {pdfRec.titulo || pdfRec.nome_arquivo}
                    </span>
                    <span className="ml-auto text-[8px] text-gray-400">↗</span>
                  </a>
                ) : (
                  <p className="text-[9px] text-gray-400 italic">Nenhum PDF vinculado</p>
                )}
                {sessao.link_video ? (
                  <a href={sessao.link_video} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-red-500">
                      <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.3v2.1c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.5 21.7 12 21.7 12 21.7s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.2.9-.8 1.2-2.8 1.2-2.8S23.3 15.5 23.3 13.4v-2.1C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8 3.6-8 3.5z"/>
                    </svg>
                    <span className="text-[9px] font-bold text-red-600 truncate">Ver no YouTube</span>
                    <span className="ml-auto text-[8px] text-gray-400">↗</span>
                  </a>
                ) : (
                  <p className="text-[9px] text-gray-400 italic">Nenhum vídeo vinculado</p>
                )}
              </div>
            </InfoBlock>

            {/* Unid. Treino */}
            {sessao.unid_treino && (
              <InfoBlock title="Unidade de Treino">
                <p className="text-[10px] text-gray-600">{sessao.unid_treino}</p>
              </InfoBlock>
            )}

            <button onClick={() => onDelete(sessao)}
              className="w-full py-2 rounded-xl border border-red-200 text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors mt-2">
              Remover Sessão
            </button>
          </div>
        )}

        {tab === 'pdf' && pdfUrl && (
          <iframe src={pdfUrl} className="w-full h-full border-0" title="PDF do treino" />
        )}

        {tab === 'video' && videoEmbed && (
          <div className="h-full flex flex-col items-center justify-center p-4 bg-gray-900">
            <iframe
              src={videoEmbed}
              className="w-full rounded-xl shadow-xl"
              style={{ height: '60%', maxHeight: 400 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Vídeo do treino"
            />
            <a href={sessao.link_video} target="_blank" rel="noreferrer"
              className="mt-4 text-[9px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">
              Abrir no YouTube ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoBlock({ title, children }) {
  return (
    <div>
      <p className="text-[7px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">{title}</p>
      {children}
    </div>
  )
}

// ─── MODAL DE FORMULÁRIO ─────────────────────────────────────────────────────
function SessaoModal({ form, setForm, pdfs, onSave, onClose, saving, isEdit }) {
  const Field = ({ label, children }) => (
    <div>
      <label className="block text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-xl text-[11px] bg-gray-50 outline-none focus:bg-white focus:border-sky-400 transition-colors"
  const sel = inp + " cursor-pointer"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xl font-black uppercase text-gray-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {isEdit ? 'Editar Sessão' : 'Nova Sessão de Treino'}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5">Banco de dados de treino de campo</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Linha 1: Data, Semana, Local, Turno */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="Data">
              <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={inp} />
            </Field>
            <Field label="Semana">
              <input type="number" value={form.semana} onChange={e => setForm(f => ({ ...f, semana: e.target.value }))} className={inp} placeholder="14" />
            </Field>
            <Field label="Local">
              <select value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} className={sel}>
                <option value="">Selecione</option>
                {LOCAIS.map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Turno">
              <select value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} className={sel}>
                <option value="">Selecione</option>
                {TURNOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {/* Linha 2: Objetivos */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Objetivo da Sessão">
              <input list="obj-list" value={form.objetivo_sessao}
                onChange={e => setForm(f => ({ ...f, objetivo_sessao: e.target.value }))}
                className={inp} placeholder="Fisico Tecnico" />
              <datalist id="obj-list">{OBJ_LIST.map(o => <option key={o} value={o} />)}</datalist>
            </Field>
            <Field label="Objetivo Secundário">
              <input list="obj-sec-list" value={form.objetivo_secundario}
                onChange={e => setForm(f => ({ ...f, objetivo_secundario: e.target.value }))}
                className={inp} placeholder="Potencia" />
              <datalist id="obj-sec-list">{OBJ_LIST.map(o => <option key={o} value={o} />)}</datalist>
            </Field>
          </div>

          {/* Atividades */}
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Atividades (1 a 5)</p>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black text-white" style={{ background: GREEN }}>{n}</span>
                  <input value={form[`atividade_${n}`]}
                    onChange={e => setForm(f => ({ ...f, [`atividade_${n}`]: e.target.value }))}
                    className={inp} placeholder={n === 1 ? 'Ex: Jogo 4x4+4' : `Atividade ${n} (opcional)`} />
                </div>
              ))}
            </div>
          </div>

          {/* Complemento + Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Complemento">
              <input value={form.complemento}
                onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))}
                className={inp} placeholder="Finalização ofensiva..." />
            </Field>
            <Field label="Unidade de Treino">
              <input value={form.unid_treino}
                onChange={e => setForm(f => ({ ...f, unid_treino: e.target.value }))}
                className={inp} placeholder="Ex: UT-14" />
            </Field>
          </div>

          {/* PDF + Vídeo */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vincular PDF de Treino">
              <select value={form.pdf_id}
                onChange={e => setForm(f => ({ ...f, pdf_id: e.target.value }))}
                className={sel}>
                <option value="">Nenhum PDF vinculado</option>
                {pdfs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.titulo || p.nome_arquivo}{p.data_treino ? ` — ${fmtDate(p.data_treino)}` : ''}
                  </option>
                ))}
              </select>
              {pdfs.length === 0 && <p className="text-[8px] text-gray-400 mt-1">Faça upload de PDFs na aba Campo primeiro</p>}
            </Field>
            <Field label="Link do Vídeo (YouTube)">
              <input value={form.link_video}
                onChange={e => setForm(f => ({ ...f, link_video: e.target.value }))}
                className={inp} placeholder="https://youtu.be/..." />
            </Field>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm disabled:opacity-60"
            style={{ background: GREEN }}>
            {saving && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Adicionar Sessão'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── LINHA DA TABELA ─────────────────────────────────────────────────────────
function TreinoRow({ s, isActive, onClick, pdfs }) {
  const atividades = getAtividades(s)
  const hasPdf = pdfs.some(p => String(p.id) === String(s.pdf_id))
  const hasVideo = !!s.link_video && !s.link_video.includes('não filmado') && !s.link_video.includes('não gravado')

  return (
    <tr
      onClick={onClick}
      className={`group cursor-pointer border-b border-gray-50 transition-colors ${isActive ? 'bg-sky-50' : 'hover:bg-gray-50/80'}`}
    >
      {/* DATA */}
      <td className="px-3 py-3 text-[10px] font-black text-gray-800 whitespace-nowrap">
        {fmtDate(s.data)}
      </td>
      {/* SEMANA */}
      <td className="px-3 py-3 text-center">
        {s.semana
          ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">S{s.semana}</span>
          : <span className="text-gray-300">—</span>}
      </td>
      {/* LOCAL */}
      <td className="px-3 py-3 text-[9px] text-gray-600 whitespace-nowrap">{s.local || '—'}</td>
      {/* TURNO */}
      <td className="px-3 py-3"><TurnoBadge t={s.periodo} /></td>
      {/* OBJETIVO */}
      <td className="px-3 py-3 max-w-[140px]">
        <p className="text-[10px] font-bold text-gray-800 truncate">{s.objetivo_sessao || '—'}</p>
        {s.objetivo_secundario && (
          <p className="text-[8px] text-gray-400 truncate mt-0.5">{s.objetivo_secundario}</p>
        )}
      </td>
      {/* ATIVIDADES */}
      <td className="px-3 py-3 max-w-[200px]">
        {atividades.length === 0 ? (
          <span className="text-gray-300 text-[9px]">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {atividades.slice(0, 2).map((a, i) => (
              <span key={i} className="text-[7px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md truncate max-w-[90px]">{a}</span>
            ))}
            {atividades.length > 2 && (
              <span className="text-[7px] font-black px-1.5 py-0.5 rounded-md" style={{ background: GREEN_LIGHT, color: GREEN }}>
                +{atividades.length - 2}
              </span>
            )}
          </div>
        )}
      </td>
      {/* COMPLEMENTO */}
      <td className="px-3 py-3 max-w-[120px]">
        <p className="text-[9px] text-gray-500 truncate">{s.complemento || '—'}</p>
      </td>
      {/* PDF */}
      <td className="px-3 py-3 text-center">
        {hasPdf ? (
          <span className="text-[7px] font-black px-1.5 py-1 rounded-lg" style={{ background: GREEN_LIGHT, color: GREEN }}>
            📄 PDF
          </span>
        ) : (
          <span className="text-gray-200 text-xs">—</span>
        )}
      </td>
      {/* VÍDEO */}
      <td className="px-3 py-3 text-center">
        {hasVideo ? (
          <span className="text-[7px] font-black px-1.5 py-1 rounded-lg bg-red-50 text-red-600">
            🎬
          </span>
        ) : (
          <span className="text-gray-200 text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function BancoDadosTab() {
  const [sessoes,   setSessoes]   = useState([])
  const [pdfs,      setPdfs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form,      setForm]      = useState(emptyForm())
  const [saving,    setSaving]    = useState(false)

  // Filtros
  const [fSemana, setFSemana] = useState('')
  const [fLocal,  setFLocal]  = useState('')
  const [fBusca,  setFBusca]  = useState('')

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchSessoes = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const d = await fetch('/api/banco-treino').then(r => r.json())
      setSessoes(d.sessoes || [])
    } catch { setError('Erro ao carregar banco de treinos.') }
    finally { setLoading(false) }
  }, [])

  const fetchPdfs = useCallback(async () => {
    try {
      const d = await fetch('/api/pdfs?tipo=treino').then(r => r.json())
      setPdfs(d.pdfs || [])
    } catch {}
  }, [])

  useEffect(() => { fetchSessoes(); fetchPdfs() }, [fetchSessoes, fetchPdfs])

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const filtered = sessoes.filter(s => {
    if (fSemana && String(s.semana) !== fSemana) return false
    if (fLocal  && s.local !== fLocal) return false
    if (fBusca) {
      const q = fBusca.toLowerCase()
      const hay = [s.objetivo_sessao, s.objetivo_secundario, s.atividade_1, s.atividade_2, s.atividade_3, s.complemento]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const semanas = [...new Set(sessoes.map(s => s.semana).filter(Boolean))].sort((a, b) => a - b)

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...emptyForm(), data: new Date().toISOString().slice(0, 10) })
    setShowModal(true)
  }

  const openEdit = (s) => {
    setEditTarget(s)
    setForm({
      data:                s.data ? s.data.slice(0, 10) : '',
      semana:              s.semana   || '',
      local:               s.local    || '',
      periodo:             s.periodo  || '',
      objetivo_sessao:     s.objetivo_sessao     || '',
      objetivo_secundario: s.objetivo_secundario || '',
      atividade_1:         s.atividade_1 || '',
      atividade_2:         s.atividade_2 || '',
      atividade_3:         s.atividade_3 || '',
      atividade_4:         s.atividade_4 || '',
      atividade_5:         s.atividade_5 || '',
      complemento:         s.complemento  || '',
      pdf_id:              s.pdf_id       || '',
      link_video:          s.link_video   || '',
      unid_treino:         s.unid_treino  || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        ...form,
        semana: form.semana ? parseInt(form.semana) : null,
        pdf_id: form.pdf_id ? parseInt(form.pdf_id) : null,
      }
      const url    = editTarget ? `/api/banco-treino/${editTarget.id}` : '/api/banco-treino'
      const method = editTarget ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data   = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setShowModal(false)
      await fetchSessoes()
      if (editTarget) setSelected(data.sessao)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (s) => {
    if (!confirm(`Remover sessão de ${fmtDate(s.data)}?`)) return
    await fetch(`/api/banco-treino/${s.id}`, { method: 'DELETE' })
    setSelected(null)
    fetchSessoes()
  }

  // ── STATS ───────────────────────────────────────────────────────────────────
  const totalVideo = sessoes.filter(s => s.link_video && !s.link_video.includes('não')).length
  const totalPdf   = sessoes.filter(s => pdfs.some(p => String(p.id) === String(s.pdf_id))).length
  const maxSemana  = sessoes.length ? Math.max(...sessoes.map(s => parseInt(s.semana) || 0)) : 0

  return (
    <div className="flex flex-col h-full">

      {/* ── HEADER BAR ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400 mb-0.5">Campo · Banco de Dados</p>
            <p className="font-black text-xl uppercase leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: GREEN }}>
              Banco de Treinos
            </p>
          </div>

          {/* KPIs rápidos */}
          <div className="hidden md:flex items-center gap-3">
            {[
              { label: 'Sessões', val: sessoes.length },
              { label: 'Com Vídeo', val: totalVideo },
              { label: 'Com PDF', val: totalPdf },
              { label: 'Semana Atual', val: maxSemana || '—' },
            ].map(k => (
              <div key={k.label} className="text-center px-3 py-1.5 rounded-xl border border-gray-100">
                <p className="text-xs font-black" style={{ color: GREEN }}>{k.val}</p>
                <p className="text-[7px] font-bold uppercase text-gray-400 tracking-wider">{k.label}</p>
              </div>
            ))}
          </div>

          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors hover:opacity-90"
            style={{ background: GREEN }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nova Sessão
          </button>
        </div>

        {/* FILTROS */}
        <div className="flex items-center gap-3 px-5 pb-3">
          <div className="flex items-center gap-1.5 flex-1 max-w-xs px-3 py-2 rounded-xl border border-gray-200 bg-gray-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-gray-400 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={fBusca} onChange={e => setFBusca(e.target.value)}
              className="flex-1 bg-transparent text-[10px] outline-none placeholder-gray-400"
              placeholder="Buscar objetivo, atividade..." />
          </div>
          <select value={fSemana} onChange={e => setFSemana(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-[10px] bg-gray-50 outline-none cursor-pointer">
            <option value="">Todas as semanas</option>
            {semanas.map(s => <option key={s} value={s}>Semana {s}</option>)}
          </select>
          <select value={fLocal} onChange={e => setFLocal(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-[10px] bg-gray-50 outline-none cursor-pointer">
            <option value="">Todos os locais</option>
            {LOCAIS.map(l => <option key={l}>{l}</option>)}
          </select>
          {(fSemana || fLocal || fBusca) && (
            <button onClick={() => { setFSemana(''); setFLocal(''); setFBusca('') }}
              className="text-[9px] font-black uppercase text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
              Limpar ×
            </button>
          )}
        </div>
      </div>

      {/* ── CORPO ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* TABELA */}
        <div className={`flex-1 overflow-auto ${selected ? 'border-r border-gray-100' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-sky-500 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-24 text-red-500 text-sm">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm font-bold">
                {sessoes.length === 0 ? 'Nenhuma sessão cadastrada ainda' : 'Nenhum resultado para este filtro'}
              </p>
              {sessoes.length === 0 && (
                <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest"
                  style={{ background: GREEN }}>
                  Adicionar primeira sessão
                </button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {['Data', 'Semana', 'Local', 'Turno', 'Objetivo', 'Atividades', 'Complemento', 'PDF', 'Vídeo'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[7px] font-black uppercase tracking-[0.25em] text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <TreinoRow
                    key={s.id}
                    s={s}
                    pdfs={pdfs}
                    isActive={selected?.id === s.id}
                    onClick={() => setSelected(sel => sel?.id === s.id ? null : s)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PAINEL DE DETALHE */}
        {selected && (
          <div className="w-96 flex-shrink-0 flex flex-col overflow-hidden bg-white">
            <DetailPanel
              sessao={selected}
              pdfs={pdfs}
              onClose={() => setSelected(null)}
              onEdit={() => openEdit(selected)}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <SessaoModal
          form={form}
          setForm={setForm}
          pdfs={pdfs}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          isEdit={!!editTarget}
        />
      )}
    </div>
  )
}
