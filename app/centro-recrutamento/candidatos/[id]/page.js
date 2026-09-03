'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '../../../components/layout/AppShell'
import Link from 'next/link'

const BRAND_PRIMARY   = '#0a66b7'
const BRAND_DARK  = '#f0fdf4'
const ETAPAS = ['Identificados', 'Análise em vídeo', 'Observação ao vivo', 'Pré-lista', 'Alvo prioritário', 'Acompanhamento']
const POSICOES = ['Goleiro','Lateral Direito','Lateral Esquerdo','Zagueiro','Volante','Meia','Meia Atacante','Ponta Direita','Ponta Esquerda','Centroavante','Atacante']

function fitColor(s) {
  if (!s && s !== 0) return { bg:'#f8fafc', c:'#94a3b8', label:'—' }
  if (s >= 90) return { bg:'#fef3c7', c:'#92400e', label:'Elite' }
  if (s >= 80) return { bg:BRAND_DARK, c:BRAND_PRIMARY, label:'Forte' }
  if (s >= 70) return { bg:'#eff6ff', c:'#1d4ed8', label:'Viável' }
  return { bg:'#f8fafc', c:'#64748b', label:'Baixo' }
}

// ─── Editable Textarea ────────────────────────────────────────────
function EditableTextarea({ label, value, placeholder, onSave, rows = 3 }) {
  const [editing, setEditing] = useState(false)
  const [text,    setText]    = useState(value || '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { setText(value || '') }, [value])

  async function save() {
    setSaving(true); await onSave(text); setSaving(false); setEditing(false)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <label style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</label>
        {!editing && (
          <button onClick={() => setEditing(true)}
            style={{ fontSize:9, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:11, height:11 }}>
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} rows={rows}
            style={{ width:'100%', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:10, padding:'10px 12px', fontSize:12, fontFamily:'inherit', resize:'vertical', outline:'none', boxSizing:'border-box' }}
            onFocus={e => e.target.style.borderColor = BRAND_PRIMARY}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}/>
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            <button onClick={() => { setEditing(false); setText(value||'') }}
              style={{ flex:1, padding:'6px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:11, color:'#64748b', cursor:'pointer', fontFamily:'inherit' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex:1, padding:'6px', borderRadius:8, border:'none', background: saving ? '#9fc5df' : BRAND_PRIMARY, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div onClick={() => setEditing(true)}
          style={{ minHeight:52, background: text ? '#f8fafc' : '#fff', border:`1px ${text ? 'solid' : 'dashed'} #e2e8f0`, borderRadius:10, padding:'10px 12px', fontSize:12, color: text ? '#334155' : '#cbd5e1', cursor:'text', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
          {text || placeholder}
        </div>
      )}
    </div>
  )
}

// ─── Editable Link ────────────────────────────────────────────────
function EditableLink({ label, value, placeholder, icon, onSave }) {
  const [editing, setEditing] = useState(false)
  const [text,    setText]    = useState(value || '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { setText(value || '') }, [value])

  async function save() { setSaving(true); await onSave(text); setSaving(false); setEditing(false) }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        {editing ? (
          <div style={{ display:'flex', gap:6 }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
              style={{ flex:1, padding:'6px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:11, fontFamily:'inherit', outline:'none' }}/>
            <button onClick={save} disabled={saving}
              style={{ padding:'6px 10px', borderRadius:8, border:'none', background:BRAND_PRIMARY, color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>OK</button>
            <button onClick={() => { setEditing(false); setText(value||'') }}
              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>×</button>
          </div>
        ) : value ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <a href={value} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:12, fontWeight:600, color:BRAND_PRIMARY, textDecoration:'none' }}>
              {label}
            </a>
            <button onClick={() => setEditing(true)}
              style={{ fontSize:9, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>editar</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            style={{ fontSize:12, color:'#cbd5e1', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {placeholder}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Página Individual ────────────────────────────────────────────
export default function CandidatoPage() {
  const { id }    = useParams()
  const router    = useRouter()
  const [c,       setC]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('dados')
  const [saving,  setSaving]  = useState(false)
  const [editDados, setEditDados] = useState(false)
  const [formDados, setFormDados] = useState({})
  const [monitorando, setMonitorando] = useState(false)

  const load = () =>
    fetch(`/api/candidatos-pipeline?id=${id}`).then(r => r.json()).then(d => {
      if (!d.candidato) { router.push('/centro-recrutamento'); return }
      setC(d.candidato); setLoading(false)
    })

  useEffect(() => { load() }, [id])

  async function patch(fields) {
    setSaving(true)
    await fetch('/api/candidatos-pipeline', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    await load()
    setSaving(false)
  }

  function openEdit() {
    setFormDados({
      jogador:           c.jogador           || '',
      clube:             c.clube             || '',
      posicao:           c.posicao           || '',
      pe:                c.pe               || '',
      idade:             c.idade            || '',
      altura:            c.altura           || '',
      nacionalidade:     c.nacionalidade    || '',
      data_fim_contrato: c.data_fim_contrato || '',
    })
    setEditDados(true)
  }

  async function saveDados() {
    setSaving(true)
    await fetch('/api/candidatos-pipeline', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...formDados }),
    })
    await load()
    setSaving(false)
    setEditDados(false)
  }

  async function enviarMonitoramento() {
    if (!confirm(`Enviar ${c.jogador} para o Monitoramento?`)) return
    setMonitorando(true)
    try {
      const res = await fetch('/api/monitoramento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          nome: c.jogador, time_atual: c.clube, posicao: c.posicao,
          nivel_interesse: 'Monitorando', observacoes: c.observacoes || '',
          link_externo: c.link_externo || null,
        }),
      })
      if (res.ok) {
        await patch({ etapa: 'Acompanhamento' })
        alert(`${c.jogador} enviado para o Monitoramento!`)
      } else alert('Erro ao enviar para Monitoramento.')
    } catch (err) { alert('Erro: ' + err.message) }
    finally { setMonitorando(false) }
  }

  if (loading) return (
    <AppShell>
      <div style={{ padding:24, maxWidth:800, margin:'0 auto' }}>
        <div style={{ height:32, width:200, background:'#f1f5f9', borderRadius:8, marginBottom:16 }}/>
        <div style={{ height:160, background:'#fff', borderRadius:16, border:'1px solid #e2e8f0' }}/>
      </div>
    </AppShell>
  )

  const fc = fitColor(c.fit_score)

  const tdLabel = { fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.5px', marginBottom:2 }
  const tdValue = { fontSize:13, fontWeight:600, color:'#1e293b' }
  const inp     = { width:'100%', padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }

  return (
    <AppShell>
      <div style={{ padding:24, maxWidth:800, margin:'0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20, fontSize:12, color:'#94a3b8' }}>
          <Link href="/centro-recrutamento" style={{ color:BRAND_PRIMARY, fontWeight:600, textDecoration:'none' }}>Centro de Recrutamento</Link>
          <span>/</span>
          <span style={{ color:'#475569', fontWeight:600 }}>{c.jogador}</span>
        </div>

        {/* Hero */}
        <div style={{ background:`linear-gradient(135deg, ${BRAND_PRIMARY} 0%, #0878c8 100%)`, borderRadius:20, padding:'20px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:900, color:'#fff', flexShrink:0, fontFamily:"'Barlow Condensed',sans-serif" }}>
            {(c.jogador||'?')[0].toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', fontWeight:700, letterSpacing:1, marginBottom:2 }}>{c.posicao || 'Posição não informada'}</p>
            <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:32, fontWeight:900, color:'#fff', margin:0, lineHeight:1 }}>{c.jogador}</h1>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:4 }}>{[c.clube, c.liga].filter(Boolean).join(' · ')}</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:8, background: fc.bg, color: fc.c }}>
                {c.fit_score ? `${c.fit_score} — ${fc.label}` : 'Fit Score —'}
              </span>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:8, background:'rgba(255,255,255,0.15)', color:'#fff' }}>
                {c.etapa}
              </span>
              {c.risco_nivel && (
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:8, background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.8)' }}>
                  Risco {c.risco_nivel}
                </span>
              )}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
            <button onClick={enviarMonitoramento} disabled={monitorando}
              style={{ padding:'8px 16px', borderRadius:10, background:'#fff', color:BRAND_PRIMARY, border:'none', fontSize:11, fontWeight:700, cursor: monitorando ? 'wait' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
              {monitorando
                ? <span style={{ width:12, height:12, border:'2px solid #9fc5df', borderTopColor:BRAND_PRIMARY, borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }}/>
                : '→'}
              Enviar ao Monitoramento
            </button>
          </div>
        </div>

        {/* Etapas rápidas */}
        <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:2 }}>
          {ETAPAS.map(e => (
            <button key={e} onClick={() => patch({ etapa: e })} disabled={saving}
              style={{ padding:'6px 12px', borderRadius:8, border:`1.5px solid ${c.etapa===e ? BRAND_PRIMARY : '#e2e8f0'}`, background: c.etapa===e ? BRAND_PRIMARY : '#fff', color: c.etapa===e ? '#fff' : '#64748b', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', opacity: saving ? 0.6 : 1 }}>
              {e}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:16, background:'#f1f5f9', borderRadius:12, padding:4 }}>
          {[['dados','👤 Dados'],['scout','📋 Scout'],['links','🔗 Links']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex:1, padding:'8px', borderRadius:9, border:'none', background: tab===k ? '#fff' : 'transparent', color: tab===k ? '#1e293b' : '#64748b', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow: tab===k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition:'all 0.15s' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Tab: Dados */}
        {tab === 'dados' && (
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'#94a3b8' }}>Dados do Atleta</p>
              {!editDados && (
                <button onClick={openEdit}
                  style={{ fontSize:10, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:12, height:12 }}>
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Editar
                </button>
              )}
            </div>

            {editDados ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={tdLabel}>Nome</label>
                    <input value={formDados.jogador} onChange={e => setFormDados(f=>({...f,jogador:e.target.value}))} style={inp}/>
                  </div>
                  <div>
                    <label style={tdLabel}>Clube Atual</label>
                    <input value={formDados.clube} onChange={e => setFormDados(f=>({...f,clube:e.target.value}))} style={inp}/>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={tdLabel}>Posição</label>
                    <select value={formDados.posicao} onChange={e => setFormDados(f=>({...f,posicao:e.target.value}))} style={inp}>
                      <option value="">—</option>
                      {POSICOES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={tdLabel}>Pé Dominante</label>
                    <select value={formDados.pe} onChange={e => setFormDados(f=>({...f,pe:e.target.value}))} style={inp}>
                      <option value="">—</option>
                      <option>Direito</option><option>Esquerdo</option><option>Ambos</option>
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <div>
                    <label style={tdLabel}>Idade</label>
                    <input type="number" value={formDados.idade} onChange={e => setFormDados(f=>({...f,idade:e.target.value}))} style={inp}/>
                  </div>
                  <div>
                    <label style={tdLabel}>Altura (m)</label>
                    <input value={formDados.altura} onChange={e => setFormDados(f=>({...f,altura:e.target.value}))} placeholder="1.82" style={inp}/>
                  </div>
                  <div>
                    <label style={tdLabel}>Fim de Contrato</label>
                    <input value={formDados.data_fim_contrato} onChange={e => setFormDados(f=>({...f,data_fim_contrato:e.target.value}))} placeholder="30/06/2026" style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={tdLabel}>Nacionalidade</label>
                  <input value={formDados.nacionalidade} onChange={e => setFormDados(f=>({...f,nacionalidade:e.target.value}))} style={inp}/>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button onClick={() => setEditDados(false)}
                    style={{ flex:1, padding:'8px', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, color:'#64748b', cursor:'pointer', fontFamily:'inherit' }}>
                    Cancelar
                  </button>
                  <button onClick={saveDados} disabled={saving}
                    style={{ flex:1, padding:'8px', borderRadius:10, border:'none', background: saving ? '#9fc5df' : BRAND_PRIMARY, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {saving ? 'Salvando...' : '✓ Salvar Dados'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {[
                  ['Posição',         c.posicao],
                  ['Clube Atual',     c.clube],
                  ['Idade',           c.idade],
                  ['Nacionalidade',   c.nacionalidade],
                  ['Pé Dominante',    c.pe],
                  ['Altura',          c.altura ? `${c.altura}m` : null],
                  ['Fim de Contrato', c.data_fim_contrato],
                  ['Liga',            c.liga],
                  ['Minutos',         c.minutos ? `${c.minutos} min` : null],
                  ['Fit Score',       c.fit_score ? `${c.fit_score} — ${fc.label}` : null],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p style={tdLabel}>{l}</p>
                    <p style={tdValue}>{v || <span style={{ color:'#cbd5e1' }}>—</span>}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Scout */}
        {tab === 'scout' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:20 }}>
              <EditableTextarea
                label="Observações"
                value={c.observacoes}
                placeholder="Contexto, histórico, informações relevantes sobre o atleta..."
                rows={4}
                onSave={v => patch({ observacoes: v })}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:20 }}>
                <EditableTextarea
                  label="Pontos Fortes"
                  value={c.pontos_fortes}
                  placeholder="Liste os pontos fortes..."
                  rows={5}
                  onSave={v => patch({ pontos_fortes: v })}/>
              </div>
              <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:20 }}>
                <EditableTextarea
                  label="Pontos a Melhorar"
                  value={c.pontos_melhorar}
                  placeholder="Liste os pontos a desenvolver..."
                  rows={5}
                  onSave={v => patch({ pontos_melhorar: v })}/>
              </div>
            </div>
            {c.notas && (
              <div style={{ background:'#f8fafc', borderRadius:16, border:'1px solid #e2e8f0', padding:16 }}>
                <p style={tdLabel}>Notas do Pipeline</p>
                <p style={{ fontSize:12, color:'#475569', lineHeight:1.6 }}>{c.notas}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Links */}
        {tab === 'links' && (
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', padding:20, display:'flex', flexDirection:'column', gap:16 }}>
            <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'#94a3b8', marginBottom:4 }}>Links</p>
            <EditableLink label="Perfil (Transfermarkt / OGol)" value={c.link_externo}
              placeholder="+ Adicionar link de perfil..."
              icon="🔗"
              onSave={v => patch({ link_externo: v })}/>
            <EditableLink label="Vídeo / Highlights" value={c.link_video}
              placeholder="+ Adicionar link de vídeo (YouTube, Wyscout, Drive...)"
              icon="🎬"
              onSave={v => patch({ link_video: v })}/>
          </div>
        )}

        {/* Rodapé */}
        <div style={{ marginTop:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Link href="/centro-recrutamento"
            style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#94a3b8', textDecoration:'none', fontWeight:600 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:14, height:14 }}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Voltar ao Centro de Recrutamento
          </Link>
          <div style={{ display:'flex', gap:8 }}>
            {c.link_externo && (
              <a href={c.link_externo} target="_blank" rel="noopener noreferrer"
                style={{ padding:'7px 14px', borderRadius:9, border:'1px solid #e2e8f0', background:'#fff', fontSize:11, fontWeight:600, color:'#475569', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
                🔗 Ver perfil
              </a>
            )}
            {c.link_video && (
              <a href={c.link_video} target="_blank" rel="noopener noreferrer"
                style={{ padding:'7px 14px', borderRadius:9, border:'1px solid #e2e8f0', background:'#fff', fontSize:11, fontWeight:600, color:'#475569', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
                🎬 Ver vídeo
              </a>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </AppShell>
  )
}