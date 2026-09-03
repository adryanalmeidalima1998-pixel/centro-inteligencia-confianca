'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'
import Link from 'next/link'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot, playerFootLabel } from '@/data/player-foot'

const BRAND_PRIMARY = '#0a66b7'

function ircCfg(v) {
  const n = parseFloat(v||0)
  if (n>=4) return { border:'border-green-200 bg-green-50', text:'text-[#0a66b7]', label:'RISCO BAIXO',   dot:'#0a66b7' }
  if (n>=3) return { border:'border-amber-200 bg-amber-50',  text:'text-amber-700',  label:'RISCO MODERADO', dot:'#d97706' }
  return       { border:'border-red-200 bg-red-50',     text:'text-red-700',    label:'RISCO ALTO',      dot:'#dc2626' }
}

function recCfg(r) {
  const s = (r||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  if (s==='CONTRATACAO')    return { bg:'#0a66b7', text:'#fff' }
  if (s.includes('NAO'))    return { bg:'#dc2626', text:'#fff' }
  if (s.includes('MONITOR'))return { bg:'#d97706', text:'#fff' }
  return                           { bg:'#94a3b8', text:'#fff' }
}

const POSICAO_ORDER = ['Goleiro','Zagueiro','Lateral Direito','Lateral Esquerdo','Volante','Meia','Meia Central','Meia Atacante','Meia Ponta (dir.)','Meia Ponta (esq.)','Meia (Armador)','Atacante','Centroavante','Ponta Direita','Ponta Esquerda']

function normalizePosicao(p) {
  if (!p) return 'Outros'
  const s = p.trim()
  return s || 'Outros'
}

/* ─── MODAL DE EDIÇÃO ─── */
function EditModal({ player, onClose, onSaved }) {
  const [form, setForm]       = useState({ ...player, perfil_tags: (player.perfil_tags||[]).join(', ') })
  const [foto, setFoto]       = useState(null)
  const [fotoPreview, setFotoPreview] = useState(player.tem_foto ? `/api/lista-final?foto=${player.id}` : null)
  const [saving, setSaving]   = useState(false)
  const fotoRef               = useRef(null)

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('id', player.id)
      fd.append('data', JSON.stringify({
        ...form,
        perfil_tags: form.perfil_tags.split(',').map(t=>t.trim()).filter(Boolean),
      }))
      if (foto) fd.append('foto', foto)
      const res = await fetch('/api/lista-final', { method: 'PATCH', body: fd })
      if (!res.ok) throw new Error((await res.json()).error)
      onSaved()
    } catch(e) {
      alert('Erro ao salvar: ' + e.message)
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-[#0a66b7] transition bg-white'
  const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:640, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ background:BRAND_PRIMARY, padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:3, color:'rgba(255,255,255,0.6)', marginBottom:2 }}>Editar Atleta</p>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:'#fff', textTransform:'uppercase' }}>{player.jogador}</h3>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, color:'#fff', fontSize:18, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

          {/* Foto */}
          <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
            <div style={{ flexShrink:0 }}>
              <p className={labelCls}>Foto</p>
              <div onClick={() => fotoRef.current?.click()} style={{ width:80, height:80, borderRadius:12, border:'2px dashed #d6e5f0', cursor:'pointer', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'#f7fcf9', position:'relative' }}>
                {fotoPreview
                  ? <img src={fotoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span style={{ fontSize:24 }}>📷</span>
                }
              </div>
              <input ref={fotoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFoto} />
              <p style={{ fontSize:9, color:'#94a3b8', marginTop:4, textAlign:'center' }}>Clique para trocar</p>
            </div>
            <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className={labelCls}>Nome</label>
                <input className={inputCls} value={form.jogador||''} onChange={e=>upd('jogador',e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Clube</label>
                <input className={inputCls} value={form.clube||''} onChange={e=>upd('clube',e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Posição</label>
                <input className={inputCls} value={form.posicao||''} onChange={e=>upd('posicao',e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Idade</label>
                <input className={inputCls} type="number" value={form.idade||''} onChange={e=>upd('idade',e.target.value)} />
              </div>
            </div>
          </div>

          {/* IRC + Recomendação */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div>
              <label className={labelCls}>IRC Final</label>
              <input className={inputCls} type="number" step="0.1" value={form.irc_final||''} onChange={e=>upd('irc_final',e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Classificação</label>
              <input className={inputCls} value={form.irc_classificacao||''} onChange={e=>upd('irc_classificacao',e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Recomendação</label>
              <select className={inputCls} value={form.recomendacao||''} onChange={e=>upd('recomendacao',e.target.value)}>
                <option value="">—</option>
                <option value="CONTRATAÇÃO">CONTRATAÇÃO</option>
                <option value="MONITORAR">MONITORAR</option>
                <option value="NÃO CONTRATAÇÃO">NÃO CONTRATAÇÃO</option>
              </select>
            </div>
          </div>

          {/* Scores */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[['Histórico Score','historico_score'],['Nível Competição','nivel_competicao'],['Adequação Modelo','adequacao_modelo']].map(([l,k])=>(
              <div key={k}>
                <label className={labelCls}>{l} (1-5)</label>
                <input className={inputCls} type="number" min="1" max="5" value={form[k]||''} onChange={e=>upd(k,e.target.value)} />
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[['Altura','altura'],['Pé','pe_preferido'],['Jogos','jogos'],['Minutos','minutagem']].map(([l,k])=>(
              <div key={k}>
                <label className={labelCls}>{l}</label>
                <input className={inputCls} value={form[k]||''} onChange={e=>upd(k,e.target.value)} />
              </div>
            ))}
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags de Perfil (separadas por vírgula)</label>
            <input className={inputCls} value={form.perfil_tags||''} onChange={e=>upd('perfil_tags',e.target.value)} placeholder="Ofensivo, Versátil, Driblador..." />
          </div>

          {/* Veredicto */}
          <div>
            <label className={labelCls}>Veredicto</label>
            <textarea className={inputCls} rows={3} value={form.veredicto||''} onChange={e=>upd('veredicto',e.target.value)} style={{ resize:'vertical' }} />
          </div>

          {/* Pontos */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[['Pontos Físicos','pontos_fisicos'],['Pontos Técnicos','pontos_tecnicos'],['Pontos Táticos','pontos_taticos']].map(([l,k])=>(
              <div key={k}>
                <label className={labelCls}>{l}</label>
                <textarea className={inputCls} rows={2} value={form[k]||''} onChange={e=>upd(k,e.target.value)} style={{ resize:'none' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid #f1f5f9', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:9, border:'1.5px solid #e2e8f0', background:'#fff', color:'#64748b', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:'9px 20px', borderRadius:9, border:'none', background:BRAND_PRIMARY, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
            {saving ? 'Salvando...' : '✓ Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── CARD ─── */
function PlayerCard({ p, onEdit, onRemove, onFotoSaved, canEdit }) {
  const irc     = parseFloat(p.irc_final||0)
  const cfg     = ircCfg(irc)
  const rc      = recCfg(p.recomendacao)
  const fotoRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [fotoSrc,   setFotoSrc]   = useState(p.tem_foto ? `/api/lista-final?foto=${p.id}&t=${Date.now()}` : null)

  async function handleFotoCard(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Preview local imediato
    const previewSrc = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = ev => resolve(ev.target.result)
      reader.readAsDataURL(file)
    })
    setFotoSrc(previewSrc)

    // 2. Comprime via Canvas antes de subir (evita limite de 4.5MB da Vercel)
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
      fd.append('id', p.id)
      fd.append('data', JSON.stringify({}))
      fd.append('foto', compressed, 'foto.jpg')
      const res  = await fetch('/api/lista-final', { method: 'PATCH', body: fd })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`)

      // Atualiza o estado pai para que tem_foto fique true sem recarregar a lista toda
      onFotoSaved?.()
    } catch(err) {
      console.error('Erro upload foto:', err)
      alert(`Erro ao salvar foto: ${err.message}`)
      // Reverte preview se falhou
      setFotoSrc(p.tem_foto ? `/api/lista-final?foto=${p.id}` : null)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${cfg.border}`} style={{ transition:'box-shadow 0.15s' }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 6px 20px rgba(10,102,183,0.10)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">

          {/* Foto — clicável direto no card */}
          <div
            onClick={() => fotoRef.current?.click()}
            title={fotoSrc ? 'Clique para trocar a foto' : 'Clique para adicionar foto'}
            style={{ width:52, height:52, borderRadius:12, overflow:'hidden', flexShrink:0, background:'#f0fdf4', border:'2px dashed #d6e5f0', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative', transition:'border-color 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#0a66b7'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#d6e5f0'}
          >
            {uploading
              ? <span style={{ fontSize:14 }}>⏳</span>
              : fotoSrc
                ? <>
                    <img src={fotoSrc} alt={p.jogador} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0)', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s', fontSize:16 }}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,0.45)'; e.currentTarget.querySelector('span').style.opacity='1'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)'; e.currentTarget.querySelector('span').style.opacity='0'}}>
                      <span style={{ opacity:0, transition:'opacity 0.15s' }}>✏️</span>
                    </div>
                  </>
                : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                    <span style={{ fontSize:16 }}>📷</span>
                    <span style={{ fontSize:7, color:'#94a3b8', fontWeight:700 }}>+ foto</span>
                  </div>
            }
          </div>
          <input ref={fotoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFotoCard} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{p.jogador}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{p.clube} · {p.posicao}</p>
            {p.idade && <p className="text-[10px] text-slate-400 mt-0.5">{p.idade} anos{p.altura ? ` · ${p.altura}cm` : ''}{p.pe_preferido ? ` · Pé ${playerFootLabel(p.pe_preferido)}` : ''}</p>}
          </div>

          {/* IRC */}
          <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-xl border flex-shrink-0 ${cfg.border}`}>
            <span className={`bc text-2xl font-black ${cfg.text}`}>{irc.toFixed(1)}</span>
            <span className={`text-[7px] font-bold uppercase tracking-widest ${cfg.text}`}>{p.irc_classificacao || cfg.label}</span>
          </div>
        </div>

        {/* Tags */}
        {p.perfil_tags && p.perfil_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {p.perfil_tags.slice(0,5).map(tag=>(
              <span key={tag} className="text-[9px] font-bold bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{tag}</span>
            ))}
          </div>
        )}

        {/* Scores */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          {[['Histórico',p.historico_score],['Nível Comp.',p.nivel_competicao],['Adequação',p.adequacao_modelo]].map(([l,v])=>(
            <div key={l} className="bg-slate-50 rounded-lg p-2">
              <p className="text-[9px] text-slate-400 font-semibold">{l}</p>
              <div className="flex justify-center mt-1 gap-0.5">
                {[1,2,3,4,5].map(n=><div key={n} className={`w-2 h-2 rounded-full ${parseInt(v||0)>=n?'bg-[#0a66b7]':'bg-slate-200'}`}/>)}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            <span style={{ fontSize:10, fontWeight:800, padding:'4px 10px', borderRadius:7, background:rc.bg, color:rc.text }}>{p.recomendacao || '—'}</span>
            {p.origem === 'monitoramento' && (
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:6, background:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe', display:'inline-flex', alignItems:'center', gap:3 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Monitoramento
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {p.jogos && <span className="text-[10px] text-slate-400">{p.jogos} jogos</span>}
            {p.pdf_filename && (
              <a href={`/api/lista-final?pdf=${p.id}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-semibold text-[#0a66b7] hover:text-[#07579e] flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </a>
            )}
            {canEdit && (
              <button onClick={()=>onEdit(p)} className="text-slate-400 hover:text-[#0a66b7] transition-colors" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            {canEdit && (
              <button onClick={()=>onRemove(p.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Remover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── PAGE ─── */
export default function ListaFinalPage() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  const [players,   setPlayers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filterRec, setFilterRec] = useState('Todos')
  const [filterPos, setFilterPos] = useState('Todas')
  const [filterPe,  setFilterPe]  = useState('')
  const [groupBy,   setGroupBy]   = useState('posicao') // 'posicao' | 'none'
  const [editing,   setEditing]   = useState(null)
  const [search,    setSearch]    = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/lista-final').then(r=>r.json()).then(d=>{setPlayers(d.players||[]); setLoading(false)})
  }
  useEffect(()=>{load()},[])

  async function remove(id) {
    if(!confirm('Remover relatório?')) return
    await fetch(`/api/lista-final?id=${id}`,{method:'DELETE'})
    load()
  }

  const allPosicoes = useMemo(() => {
    const set = new Set(players.map(p => normalizePosicao(p.posicao)))
    return ['Todas', ...POSICAO_ORDER.filter(p=>set.has(p)), ...[...set].filter(p=>!POSICAO_ORDER.includes(p)).sort()]
  }, [players])

  const filtered = useMemo(() => players.filter(p => {
    const r = (p.recomendacao||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    if (filterRec === 'CONTRATAÇÃO'    && r !== 'CONTRATACAO') return false
    if (filterRec === 'MONITORAR'      && !r.includes('MONITOR')) return false
    if (filterRec === 'NÃO CONTRATAÇÃO'&& !r.includes('NAO')) return false
    if (filterPos !== 'Todas' && normalizePosicao(p.posicao) !== filterPos) return false
    if (filterPe && !matchesPlayerFoot(p, filterPe)) return false
    if (search && !p.jogador?.toLowerCase().includes(search.toLowerCase()) && !p.clube?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [players, filterRec, filterPos, filterPe, search])

  // Agrupamento por posição
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: null, items: filtered }]
    const map = {}
    for (const p of filtered) {
      const pos = normalizePosicao(p.posicao)
      if (!map[pos]) map[pos] = []
      map[pos].push(p)
    }
    const ordered = POSICAO_ORDER.filter(p=>map[p]).map(p=>({ label:p, items:map[p] }))
    const rest = Object.keys(map).filter(p=>!POSICAO_ORDER.includes(p)).sort().map(p=>({ label:p, items:map[p] }))
    return [...ordered, ...rest]
  }, [filtered, groupBy])

  const counts = {
    Todos: players.length,
    'CONTRATAÇÃO': players.filter(p=>{ const r=(p.recomendacao||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); return r==='CONTRATACAO'}).length,
    'MONITORAR': players.filter(p=>{ const r=(p.recomendacao||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); return r.includes('MONITOR')}).length,
    'NÃO CONTRATAÇÃO': players.filter(p=>{ const r=(p.recomendacao||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); return r.includes('NAO')}).length,
  }

  return (
    <AppShell>
      <div className="p-6 max-w-[1100px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Relatórios</p>
            <h1 className="bc text-4xl font-black uppercase text-[#0a66b7]">Lista Final</h1>
            <p className="text-sm text-slate-400 mt-1">{loading ? '...' : `${players.length} relatórios CIC · ${filtered.length} exibidos`}</p>
          </div>
          <div className="flex gap-2">
            <a href="/api/lista-final-pdf" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white border border-slate-200 hover:border-[#0a66b7] text-slate-700 hover:text-[#0a66b7] px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Exportar PDF
            </a>
            <Link href="/importar" className="flex items-center gap-2 bg-[#0a66b7] hover:bg-[#07579e] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-green-900/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Importar PDF
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-2 items-center">

            {/* Recomendação */}
            <div className="flex gap-1.5 flex-wrap">
              {['Todos','CONTRATAÇÃO','MONITORAR','NÃO CONTRATAÇÃO'].map(f=>(
                <button key={f} onClick={()=>setFilterRec(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${filterRec===f?'bg-[#0a66b7] text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f}{f!=='Todos'?` (${counts[f]||0})`:''}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-slate-200 mx-1"/>

            {/* Posição */}
            <select value={filterPos} onChange={e=>setFilterPos(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:border-[#0a66b7] transition">
              {allPosicoes.map(p=><option key={p} value={p}>{p}</option>)}
            </select>

            <select value={filterPe} onChange={e=>setFilterPe(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer hover:border-[#0a66b7] transition">
              {PLAYER_FOOT_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
            </select>

            {/* Agrupar */}
            <button onClick={()=>setGroupBy(g=>g==='posicao'?'none':'posicao')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${groupBy==='posicao'?'border-[#0a66b7] text-[#0a66b7] bg-green-50':'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Agrupar por posição
            </button>

            {/* Busca */}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar atleta ou clube..."
              className="ml-auto px-3 py-1.5 rounded-lg text-[11px] border border-slate-200 outline-none focus:border-[#0a66b7] transition w-44 bg-white" />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_,i)=><div key={i} className="h-44 bg-white rounded-2xl border border-slate-100 animate-pulse"/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <p className="text-slate-400 font-semibold">Nenhum relatório encontrado</p>
            <p className="text-sm text-slate-300 mt-1">Ajuste os filtros ou importe PDFs</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(({ label, items }) => (
              <div key={label||'all'}>
                {label && (
                  <div className="flex items-center gap-3 mb-3">
                    <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:900, textTransform:'uppercase', color:BRAND_PRIMARY, letterSpacing:1 }}>{label}</h2>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{items.length}</span>
                    <div className="flex-1 h-px bg-slate-100"/>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map(p=>(
                    <PlayerCard key={p.id} p={p} onEdit={setEditing} onRemove={remove} canEdit={canEdit}
                      onFotoSaved={() => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, tem_foto: true } : x))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {editing && (
        <EditModal
          player={editing}
          onClose={()=>setEditing(null)}
          onSaved={()=>{ setEditing(null); load() }}
        />
      )}
    </AppShell>
  )
}
