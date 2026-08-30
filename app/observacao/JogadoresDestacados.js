'use client'
import { useState, useEffect } from 'react'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot, playerFootLabel } from '@/data/player-foot'

const GFC = '#0a66b7'

const VEREDITO_CFG = {
  'CONTRATAÇÃO':  { bg:'#f0fdf4', color:'#166534', border:'#86efac' },
  'MONITORAR':    { bg:'#eff6ff', color:'#1e40af', border:'#93c5fd' },
  'OBSERVAR MAIS':{ bg:'#fefce8', color:'#854d0e', border:'#fde047' },
  'ARQUIVAR':     { bg:'#fef2f2', color:'#991b1b', border:'#fca5a5' },
}

export default function JogadoresDestacados() {
  const [jogadores, setJogadores] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filtro,      setFiltro]      = useState('Todos')
  const [search,      setSearch]      = useState('')
  const [filtroPe,    setFiltroPe]    = useState('')
  const [filtroPos,   setFiltroPos]   = useState('')
  const [filtroComp,  setFiltroComp]  = useState('')
  const [filtroIdade, setFiltroIdade] = useState('')
  const [exportando,  setExportando]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/jogadores-destacados').then(r=>r.json())
    setJogadores(res.jogadores || [])
    setLoading(false)
  }

  // Posições únicas presentes nos dados
  const posicoesUnicas = [...new Set(jogadores.map(j=>j.posicao).filter(Boolean))].sort()
  const competicoesUnicas = [...new Set(jogadores.map(j=>j.competicao).filter(Boolean))].sort()

  const filtrados = jogadores.filter(j => {
    const matchFiltro = filtro === 'Todos' || j.veredito === filtro
    const matchSearch = !search || j.nome.toLowerCase().includes(search.toLowerCase()) || (j.time_nome||'').toLowerCase().includes(search.toLowerCase())
    const matchPe     = !filtroPe || matchesPlayerFoot(j, filtroPe)
    const matchPos    = !filtroPos  || (j.posicao||'').toLowerCase().includes(filtroPos.toLowerCase())
    const matchComp   = !filtroComp || (j.competicao||'').toLowerCase().includes(filtroComp.toLowerCase())
    const matchIdade  = !filtroIdade || (() => {
      if (!j.idade) return false
      const [min, max] = filtroIdade.split('-').map(Number)
      return max ? (j.idade >= min && j.idade <= max) : j.idade >= min
    })()
    return matchFiltro && matchSearch && matchPe && matchPos && matchComp && matchIdade
  })

  const contagem = {
    Todos: jogadores.length,
    CONTRATAÇÃO: jogadores.filter(j=>j.veredito==='CONTRATAÇÃO').length,
    MONITORAR: jogadores.filter(j=>j.veredito==='MONITORAR').length,
    'OBSERVAR MAIS': jogadores.filter(j=>j.veredito==='OBSERVAR MAIS').length,
    ARQUIVAR: jogadores.filter(j=>j.veredito==='ARQUIVAR').length,
  }

  async function exportarPDF() {
    setExportando(true)
    try {
      const jspdfMod  = await import('jspdf')
      const jsPDF     = jspdfMod.jsPDF ?? jspdfMod.default
      const atMod     = await import('jspdf-autotable')
      const autoTable = atMod.autoTable ?? atMod.default

      const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      const margin = 14

      doc.setFillColor(10,102,183)
      doc.rect(0,0,W,22,'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('JOGADORES DESTACADOS — CIC CONFIANÇA', margin, 10)
      doc.setFontSize(8); doc.setFont('helvetica','normal')
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} · ${filtrados.length} atletas`, margin, 17)
      doc.setTextColor(0,0,0)

      autoTable(doc, {
        startY: 28,
        margin: { left: margin, right: margin },
        headStyles: { fillColor:[10,102,183], textColor:255, fontSize:8 },
        styles: { fontSize:7.5, cellPadding:2 },
        alternateRowStyles: { fillColor:[247,252,249] },
        head: [['Nome','Clube','Posição','Pé','Veredito','Jogos','Arquivar','Monitorar','Contratar','Promovido']],
        body: filtrados.map(j => [
          j.nome, j.time_nome||'-', j.posicao||'-', playerFootLabel(j.pe),
          j.veredito||'-', j.jogos||0, j.n_arquivar||0, j.n_monitorar||0, j.n_contratar||0,
          j.promovido ? 'Sim' : '',
        ]),
        theme: 'grid',
      })

      const totalPages = doc.internal.getNumberOfPages()
      for (let p=1;p<=totalPages;p++) {
        doc.setPage(p)
        doc.setFontSize(6); doc.setTextColor(150)
        doc.text(`CIC Confiança — Jogadores Destacados — Pág ${p}/${totalPages}`, margin, H-5)
      }

      doc.save(`jogadores_destacados_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.pdf`)
    } finally { setExportando(false) }
  }

  const Badge = ({ label, count, active, onClick }) => {
    const cfg = label === 'Todos' ? { bg:'#f7fcf9',color:'#52677e',border:'#d6e5f0' } : (VEREDITO_CFG[label]||VEREDITO_CFG['ARQUIVAR'])
    return (
      <button onClick={onClick} style={{
        padding:'7px 14px', borderRadius:8, border:`1.5px solid ${active ? cfg.border : '#e5edf5'}`,
        cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700,
        background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#64748b',
        display:'flex', alignItems:'center', gap:6,
      }}>
        {label}
        <span style={{ fontSize:10, background: active ? cfg.border : '#e5edf5', color: active ? cfg.color : '#94a3b8', borderRadius:20, padding:'1px 7px' }}>{count}</span>
      </button>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:3, color:'#94a3b8', marginBottom:4 }}>Auto-populado pelos Relatórios</p>
          <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:900, color:GFC, textTransform:'uppercase', lineHeight:1 }}>Jogadores Destacados</h2>
          <p style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{jogadores.length} atletas · {jogadores.filter(j=>j.promovido).length} promovidos ao Monitoramento</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid #c6def2', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700, color:GFC, background:'#fff', display:'flex', alignItems:'center', gap:6 }}>
            🔄 Atualizar
          </button>
          <button onClick={exportarPDF} disabled={exportando} style={{ padding:'8px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700, color:'#fff', background:GFC, display:'flex', alignItems:'center', gap:6, opacity: exportando ? 0.7 : 1 }}>
            📄 {exportando ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[['CONTRATAÇÃO','🎯'],['MONITORAR','👁'],['OBSERVAR MAIS','⏳'],['ARQUIVAR','🗄']].map(([v,e]) => {
          const cfg = VEREDITO_CFG[v]||{}
          const c = contagem[v] || 0
          return (
            <div key={v} style={{ background:cfg.bg, border:`1.5px solid ${cfg.border}`, borderRadius:14, padding:'14px 16px' }}>
              <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:30, fontWeight:900, color:cfg.color, lineHeight:1 }}>{c}</p>
              <p style={{ fontSize:10, fontWeight:700, color:cfg.color, marginTop:4 }}>{e} {v}</p>
            </div>
          )
        })}
      </div>

      {/* Regras de auto-promoção */}
      <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'10px 16px', marginBottom:16, fontSize:11, color:'#166534' }}>
        <strong>Regras de auto-promoção ao Monitoramento:</strong> ≥2 "Contratar" · ou ≥3 "Monitorar" · ou ≥2 "Monitorar" + ≥1 "Contratar"
      </div>

      {/* Filtros de veredito */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
        {['Todos','CONTRATAÇÃO','MONITORAR','OBSERVAR MAIS','ARQUIVAR'].map(f => (
          <Badge key={f} label={f} count={contagem[f]||0} active={filtro===f} onClick={()=>setFiltro(f)} />
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Buscar atleta ou clube...'
          style={{ marginLeft:'auto', padding:'7px 12px', borderRadius:8, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', outline:'none', width:200 }} />
      </div>

      {/* Filtros avançados */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center', background:'#f7fcf9', borderRadius:10, padding:'10px 14px', border:'1px solid #e5edf5' }}>
        <span style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px', marginRight:4 }}>Filtros</span>

        {/* Posição */}
        <select value={filtroPos} onChange={e=>setFiltroPos(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:7, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', outline:'none', color: filtroPos?GFC:'#64748b', background:'#fff', cursor:'pointer' }}>
          <option value=''>⬜ Todas posições</option>
          {posicoesUnicas.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Pé dominante */}
        <select value={filtroPe} onChange={e=>setFiltroPe(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:7, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', outline:'none', color: filtroPe?GFC:'#64748b', background:'#fff', cursor:'pointer' }}>
          {PLAYER_FOOT_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
        </select>

        {/* Competição */}
        <select value={filtroComp} onChange={e=>setFiltroComp(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:7, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', outline:'none', color: filtroComp?GFC:'#64748b', background:'#fff', cursor:'pointer' }}>
          <option value=''>🏆 Todas as competições</option>
          {competicoesUnicas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Idade */}
        <select value={filtroIdade} onChange={e=>setFiltroIdade(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:7, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', outline:'none', color: filtroIdade?GFC:'#64748b', background:'#fff', cursor:'pointer' }}>
          <option value=''>🎂 Todas as idades</option>
          <option value='15-21'>Sub-21 (até 21)</option>
          <option value='22-25'>22 a 25 anos</option>
          <option value='26-29'>26 a 29 anos</option>
          <option value='30-99'>30+ anos</option>
        </select>

        {/* Limpar filtros */}
        {(filtroPos || filtroPe || filtroComp || filtroIdade) && (
          <button onClick={()=>{ setFiltroPos(''); setFiltroPe(''); setFiltroComp(''); setFiltroIdade('') }}
            style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #fca5a5', background:'#fff', color:'#dc2626', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            ✕ Limpar
          </button>
        )}

        <span style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8', fontWeight:600 }}>
          {filtrados.length} atleta{filtrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[...Array(6)].map((_,i) => <div key={i} style={{ height:50, background:'#f7fcf9', borderRadius:10 }} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <p style={{ fontSize:32 }}>⭐</p>
          <p style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Nenhum atleta {filtro !== 'Todos' ? `com veredito "${filtro}"` : 'destacado ainda'}</p>
          <p style={{ fontSize:12 }}>Os jogadores aparecem aqui automaticamente quando são avaliados nos relatórios de partida</p>
        </div>
      ) : (
        <div style={{ border:'1px solid #e5edf5', borderRadius:14, overflow:'hidden' }}>
          {/* Header da tabela */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 110px 60px 130px 50px 70px 70px 80px 60px', gap:0, background:'#f7fcf9', padding:'8px 16px', borderBottom:'1px solid #e5edf5' }}>
            {['Nome','Clube','Posição','Pé','Veredito','Jogos','Arquivar','Monitorar','Contratar','Promo.'].map(h => (
              <span key={h} style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:'#94a3b8', letterSpacing:1 }}>{h}</span>
            ))}
          </div>

          {filtrados.map((j, idx) => {
            const cfg = VEREDITO_CFG[j.veredito] || { bg:'#fff', color:'#64748b', border:'#e2e8f0' }
            return (
              <div key={j.id} style={{ display:'grid', gridTemplateColumns:'1fr 120px 110px 60px 130px 50px 70px 70px 80px 60px', gap:0, padding:'10px 16px', borderBottom: idx<filtrados.length-1 ? '1px solid #f4f8fc' : 'none', alignItems:'center', background: idx%2===0 ? '#fff' : '#fbfffe' }}>
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:'#10233b' }}>{j.nome}</p>
                </div>
                <span style={{ fontSize:11, color:'#52677e' }}>{j.time_nome || '-'}</span>
                <span style={{ fontSize:11, color:'#52677e' }}>{j.posicao || '-'}</span>
                <span style={{ fontSize:11, color:'#52677e' }}>{j.pe || '-'}</span>
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, whiteSpace:'nowrap' }}>
                  {j.veredito || '-'}
                </span>
                <span style={{ fontSize:12, fontWeight:700, color:GFC, textAlign:'center' }}>{j.jogos||0}</span>
                <span style={{ fontSize:11, color:'#991b1b', fontWeight:600, textAlign:'center' }}>{j.n_arquivar||0}</span>
                <span style={{ fontSize:11, color:'#1e40af', fontWeight:600, textAlign:'center' }}>{j.n_monitorar||0}</span>
                <span style={{ fontSize:11, color:'#166534', fontWeight:600, textAlign:'center' }}>{j.n_contratar||0}</span>
                <span style={{ fontSize:14, textAlign:'center' }}>{j.promovido ? '✅' : ''}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
