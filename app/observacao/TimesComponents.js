'use client'
import { useState, useEffect } from 'react'

const GFC = '#0a66b7'
const S = {
  input: { width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box' },
  select: { width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box', cursor:'pointer' },
}

/* ─── HOOK: carregar ligas ──────────────────────────────────────── */
export function useLigas() {
  const [ligas, setLigas] = useState([])
  useEffect(() => {
    fetch('/api/ligas-times?tipo=ligas')
      .then(r => r.json())
      .then(d => setLigas(d.ligas || []))
      .catch(() => {})
  }, [])
  return ligas
}

/* ─── AUTOCOMPLETE DE TIME COM FILTRO DE LIGA ───────────────────── */
export function TimeAutocomplete({ value, onChange, placeholder, ligaFiltro }) {
  const [q,        setQ]        = useState(value || '')
  const [opts,     setOpts]     = useState([])
  const [open,     setOpen]     = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => { setQ(value || '') }, [value])

  async function buscar(texto) {
    setQ(texto)
    if (texto.length < 2) { setOpts([]); setOpen(false); return }
    const ligaParam = ligaFiltro ? `&liga=${encodeURIComponent(ligaFiltro)}` : ''
    const res = await fetch(`/api/ligas-times?q=${encodeURIComponent(texto)}${ligaParam}`)
      .then(r => r.json())
    setOpts(res.times || [])
    setOpen(true)
  }

  async function criar(nome) {
    setCreating(true)
    const ligas = ligaFiltro ? [ligaFiltro] : []
    const res = await fetch('/api/ligas-times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, ligas }),
    }).then(r => r.json())
    setCreating(false)
    setOpts([])
    setOpen(false)
    const nome_final = res.time?.nome || nome
    onChange(nome_final)
    setQ(nome_final)
  }

  const exact = opts.find(o => o.nome.toLowerCase() === q.toLowerCase())

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q}
        placeholder={placeholder || 'Nome do time...'}
        style={S.input}
        onChange={e => buscar(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #d6e5f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(10,102,183,0.1)', zIndex: 999,
          maxHeight: 180, overflowY: 'auto',
        }}>
          {opts.map(o => (
            <div
              key={o.id}
              onMouseDown={() => { onChange(o.nome); setQ(o.nome); setOpen(false) }}
              style={{ padding: '8px 12px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f4f8fc' }}
              onMouseEnter={e => e.target.style.background = '#f0fdf4'}
              onMouseLeave={e => e.target.style.background = '#fff'}
            >
              <span style={{ fontWeight: 700 }}>{o.nome}</span>
              {o.ligas?.length > 0 && (
                <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 6 }}>
                  {o.ligas.slice(0, 2).join(' · ')}
                </span>
              )}
            </div>
          ))}
          {q.length >= 2 && !exact && (
            <div
              onMouseDown={() => criar(q)}
              style={{ padding: '8px 12px', fontSize: 11, cursor: 'pointer', color: GFC, fontWeight: 700, background: '#f0fdf4' }}
            >
              {creating ? 'Criando...' : `+ Cadastrar "${q}"`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── SELECT DE LIGA ────────────────────────────────────────────── */
export function LigaSelect({ value, onChange, label }) {
  const ligas = useLigas()
  return (
    <div>
      {label && <span style={{ fontSize: 10, fontWeight: 700, color: '#52677e', marginBottom: 4, display: 'block' }}>{label}</span>}
      <select value={value} style={S.select} onChange={e => onChange(e.target.value)}>
        <option value=''>Selecione a liga...</option>
        {ligas.map(l => <option key={l.id} value={l.nome}>{l.nome}</option>)}
      </select>
    </div>
  )
}

/* ─── AUTOCOMPLETE DE JOGADOR ───────────────────────────────────── */
export function JogadorAutocomplete({ value, timeNome, onChange }) {
  const [q,    setQ]    = useState(value || '')
  const [opts, setOpts] = useState([])
  const [open, setOpen] = useState(false)
  const [timeId, setTimeId] = useState(null)

  useEffect(() => { setQ(value || '') }, [value])

  // Resolver ID do time quando timeNome muda
  useEffect(() => {
    if (!timeNome) { setOpts([]); return }
    fetch(`/api/ligas-times?q=${encodeURIComponent(timeNome)}`)
      .then(r => r.json())
      .then(d => {
        const t = (d.times || []).find(t => t.nome.toLowerCase() === timeNome.toLowerCase())
        if (t) {
          setTimeId(t.id)
          return fetch(`/api/ligas-times?time_id=${t.id}`).then(r => r.json())
        }
        return { jogadores: [] }
      })
      .then(d => setOpts(d.jogadores || []))
      .catch(() => {})
  }, [timeNome])

  const filtrado = q.length >= 1
    ? opts.filter(o => o.nome.toLowerCase().includes(q.toLowerCase()))
    : opts

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q}
        placeholder='Nome do jogador...'
        style={S.input}
        onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && filtrado.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #d6e5f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(10,102,183,0.1)', zIndex: 999,
          maxHeight: 160, overflowY: 'auto',
        }}>
          {filtrado.slice(0, 10).map(o => (
            <div
              key={o.id}
              onMouseDown={() => { onChange(o.nome, o); setQ(o.nome); setOpen(false) }}
              style={{ padding: '7px 12px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f4f8fc' }}
              onMouseEnter={e => e.target.style.background = '#f0fdf4'}
              onMouseLeave={e => e.target.style.background = '#fff'}
            >
              <span style={{ fontWeight: 700 }}>{o.nome}</span>
              <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 10 }}>{o.posicao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
