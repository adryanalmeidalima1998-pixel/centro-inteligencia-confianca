'use client'
import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '../components/layout/AppShell'
import Papa from 'papaparse'
import RelatorioModal from './RelatorioModal'
import SeedBanner from './SeedBanner'

const JogadoresDestacados = lazy(() => import('./JogadoresDestacados'))
const ObservacaoSemanal   = lazy(() => import('./ObservacaoSemanal'))

const SHEETS_CSV_URL = '/api/sheets-proxy?source=observacao'

/* ── Configurações de status ─────────────────────────────────────── */
const STATUS_LIST = ['Pendente', 'Assistido', 'Relatório Enviado']
const STATUS_CFG  = {
  'Pendente':          { bg:'#f1f5f9', color:'#64748b', dot:'#94a3b8' },
  'Assistido':         { bg:'#eff6ff', color:'#1d4ed8', dot:'#3b82f6' },
  'Relatório Enviado': { bg:'#f0fdf4', color:'#0a66b7', dot:'#0a66b7' },
}
const kpiColors = {
  'Pendente':          { bg:'#f8fafc', color:'#64748b', border:'#e2e8f0' },
  'Assistido':         { bg:'#eff6ff', color:'#1d4ed8', border:'#bfdbfe' },
  'Relatório Enviado': { bg:'#f0fdf4', color:'#0a66b7', border:'#bbf7d0' },
}
const BRAND_PRIMARY = '#0a66b7'

/* ── Helpers de data ──────────────────────────────────────────────── */
function parseDateBR(str) {
  if (!str) return ''
  const parts = str.trim().split('/')
  if (parts.length !== 3) return str
  const [d, m, y] = parts
  const fullYear = y.length === 2 ? `20${y}` : y
  return `${fullYear}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

function parseJogo(jogo) {
  if (!jogo) return { mandante:'', visitante:'' }
  const sep = jogo.indexOf(' x ')
  if (sep === -1) return { mandante: jogo.trim(), visitante:'' }
  return { mandante: jogo.slice(0, sep).trim(), visitante: jogo.slice(sep + 3).trim() }
}

const makeKey = (mandante, visitante, data) =>
  `${(mandante||'').trim().toLowerCase()}|${(visitante||'').trim().toLowerCase()}|${(data||'').trim()}`

function normalizeRow(row) {
  const jogo = (row['JOGO'] || '').trim()
  if (!jogo) return null
  const { mandante, visitante } = parseJogo(jogo)
  if (!mandante) return null
  const dataISO = parseDateBR((row['DATA'] || '').trim())
  return {
    mandante, visitante,
    data:          dataISO,
    hora:          (row['HORÁRIO'] || row['HORARIO'] || '').trim(),
    comp:          (row['CAMPEONATO'] || '').trim() || 'Série C',
    pais:          (row['PAÍS'] || row['PAIS'] || '').trim(),
    scout:         (row['SCOUT'] || '').trim(),
    match_key:     makeKey(mandante, visitante, dataISO),
    status:        'Pendente',
    pdf_name:      null,
    updated_at:    null,
    tem_relatorio: false,
  }
}

const HOJE = new Date()
function isSameDay(d)   { return d.getFullYear()===HOJE.getFullYear()&&d.getMonth()===HOJE.getMonth()&&d.getDate()===HOJE.getDate() }
function isSameWeek(d)  { const s=new Date(HOJE);s.setDate(HOJE.getDate()-HOJE.getDay());const e=new Date(s);e.setDate(s.getDate()+6);return d>=s&&d<=e }
function isSameMonth(d) { return d.getFullYear()===HOJE.getFullYear()&&d.getMonth()===HOJE.getMonth() }
function fmtDate(str)   { if(!str)return'—';return new Date(str+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}) }
function hoursAgo(iso)  { if(!iso)return null;return Math.floor((Date.now()-new Date(iso).getTime())/3600000) }

const S = {
  btnGreen: { background:BRAND_PRIMARY, color:'#fff', border:'none', borderRadius:9, padding:'9px 18px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:7 },
  card:     { background:'#fff', borderRadius:14, border:'1px solid #e5edf5', boxShadow:'0 1px 6px rgba(10,102,183,0.05)' },
}

export default function ObservacaoPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  // diretoria só visualiza; admin, scout e comissao podem editar aqui
  const canEdit = role !== 'diretoria'

  const [jogos,     setJogos]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [abaMain,   setAbaMain]   = useState('partidas')
  const [abaTempo,  setAbaTempo]  = useState('Tudo')
  const [scoutFil,  setScoutFil]  = useState('Todos')
  const [ligaFil,   setLigaFil]   = useState('Todas')
  const [statusFil, setStatusFil] = useState('Todos')
  const [buscaAtleta, setBuscaAtleta] = useState('')
  const [posFil,    setPosFil]    = useState('')
  const [salvandoErro, setSalvandoErro] = useState('')
  const [modalJogo, setModalJogo] = useState(null)
  const [modalNova,   setModalNova]   = useState(false)
  const [novaForm,    setNovaForm]    = useState({ mandante:"", visitante:"", data:"", hora:"", comp:"Série C", pais:"Brasil", scout:"" })
  const [salvandoNova, setSalvandoNova] = useState(false)

  async function load() {
    setLoading(true)
    try {
      // DB e relatórios são críticos — Sheets é best-effort
      const [dbRes, relRes] = await Promise.all([
        fetch('/api/observacao'),
        fetch('/api/relatorio-partida'),
      ])

      // Sheets pode falhar (CORS, timeout, etc.) sem derrubar o load inteiro
      let sheetsJogos = []
      try {
        const sheetsRes = await fetch(SHEETS_CSV_URL, { cache:'no-store' })
        const csvText   = await sheetsRes.text()
        const { data: rows } = Papa.parse(csvText, { header:true, skipEmptyLines:true })
        sheetsJogos = rows.map(normalizeRow).filter(Boolean)
      } catch (sheetsErr) {
        console.warn('[Observacao] Google Sheets indisponível, mostrando dados do banco:', sheetsErr.message)
      }

      const dbData = await dbRes.json()
      const dbMap  = {}
      for (const row of (dbData.jogos || [])) {
        if (row.match_key) dbMap[row.match_key] = row
      }

      const relData = await relRes.json()
      const relMap  = {}
      for (const r of (relData.relatorios || [])) {
        relMap[r.match_key] = r
      }

      // Partidas do Sheets enriquecidas com dados do banco
      const sheetsMk = new Set(sheetsJogos.map(j => j.match_key))
      const merged = sheetsJogos.map(j => {
        const ov  = dbMap[j.match_key]
        const rel = relMap[j.match_key]
        return {
          ...j,
          id:                  ov?.id          ?? j.id,
          status:              rel ? 'Relatório Enviado' : (ov?.status ?? j.status),
          pdf_name:            ov?.pdf_name    ?? j.pdf_name,
          updated_at:          rel?.updated_at ?? ov?.updated_at ?? j.updated_at,
          tem_relatorio:       !!rel,
          gols_mandante:       rel?.gols_mandante  ?? null,
          gols_visitante:      rel?.gols_visitante ?? null,
          goleadores_mandante: rel?.goleadores_mandante  ?? null,
          goleadores_visitante:rel?.goleadores_visitante ?? null,
          jogadores_avaliados: (rel?.avaliacoes || []).map(a => (a.nome || '').toLowerCase()).filter(Boolean),
          avaliacoes_resumo:   rel?.avaliacoes_resumo || [],
        }
      })

      // Partidas cadastradas manualmente (só no banco, não estão no Sheets)
      const manuais = (dbData.jogos || [])
        .filter(row => row.match_key && !sheetsMk.has(row.match_key))
        .map(row => {
          const rel = relMap[row.match_key]
          return {
            mandante:            row.mandante || '',
            visitante:           row.visitante || '',
            data:                row.data || '',
            hora:                row.hora || '',
            comp:                row.comp || 'Série C',
            pais:                row.pais || '',
            scout:               row.scout || '',
            match_key:           row.match_key,
            id:                  row.id,
            status:              rel ? 'Relatório Enviado' : (row.status || 'Pendente'),
            pdf_name:            row.pdf_name ?? null,
            updated_at:          rel?.updated_at ?? row.updated_at ?? null,
            tem_relatorio:       !!rel,
            gols_mandante:       rel?.gols_mandante  ?? null,
            gols_visitante:      rel?.gols_visitante ?? null,
            goleadores_mandante: rel?.goleadores_mandante  ?? null,
            goleadores_visitante:rel?.goleadores_visitante ?? null,
            jogadores_avaliados: (rel?.avaliacoes || []).map(a => (a.nome || '').toLowerCase()).filter(Boolean),
            avaliacoes_resumo:   rel?.avaliacoes_resumo || [],
            manual:              true,
          }
        })

      setJogos([...merged, ...manuais])
    } catch (err) {
      console.error('[Observacao] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const allScouts = useMemo(() => [...new Set(jogos.map(j => j.scout).filter(Boolean))], [jogos])
  const allLigas  = useMemo(() => [...new Set(jogos.map(j => j.comp).filter(Boolean))].sort(), [jogos])
  const allPosicoes = useMemo(() => {
    const pos = new Set()
    jogos.forEach(j => (j.avaliacoes_resumo||[]).forEach(a => { if(a.posicao) pos.add(a.posicao) }))
    return [...pos].sort()
  }, [jogos])

  const counts = {
    Hoje:          jogos.filter(j => j.data && isSameDay(new Date(j.data+'T12:00'))).length,
    'Esta Semana': jogos.filter(j => j.data && isSameWeek(new Date(j.data+'T12:00'))).length,
    'Este Mês':    jogos.filter(j => j.data && isSameMonth(new Date(j.data+'T12:00'))).length,
    Tudo:          jogos.length,
  }

  const alertas48h = jogos.filter(j => {
    if (j.status !== 'Assistido' || j.pdf_name || j.tem_relatorio) return false
    const h = hoursAgo(j.updated_at)
    return h !== null && h >= 48
  })

  const filtered = useMemo(() => [...jogos]
    .sort((a,b) => {
      const dc = (a.data||'').localeCompare(b.data||'')
      return dc !== 0 ? dc : (a.hora||'').localeCompare(b.hora||'')
    })
    .filter(j => {
      if (scoutFil !== 'Todos' && j.scout !== scoutFil) return false
      if (ligaFil  !== 'Todas' && j.comp  !== ligaFil)  return false
      if (statusFil !== 'Todos' && j.status !== statusFil) return false
      if (posFil && !(j.avaliacoes_resumo||[]).some(a => (a.posicao||'').toLowerCase().includes(posFil.toLowerCase()))) return false
      if (buscaAtleta.trim()) {
        const q = buscaAtleta.trim().toLowerCase()
        const noJogs = (j.jogadores_avaliados || []).some(n => n.includes(q))
        const noJogo = (j.mandante||'').toLowerCase().includes(q) || (j.visitante||'').toLowerCase().includes(q)
        if (!noJogs && !noJogo) return false
      }
      const d = j.data ? new Date(j.data+'T12:00') : null
      if (!d) return abaTempo === 'Tudo'
      if (abaTempo === 'Hoje')        return isSameDay(d)
      if (abaTempo === 'Esta Semana') return isSameWeek(d)
      if (abaTempo === 'Este Mês')    return isSameMonth(d)
      return true
    }), [jogos, abaTempo, scoutFil, ligaFil, statusFil, buscaAtleta])

  async function marcarAssistido(jogo) {
    const fd = new FormData()
    fd.append('data', JSON.stringify({
      match_key: jogo.match_key,
      mandante: jogo.mandante, visitante: jogo.visitante,
      data: jogo.data, comp: jogo.comp, scout: jogo.scout, status:'Assistido',
    }))
    await fetch('/api/observacao', { method:'POST', body:fd })
    load()
  }

  async function salvarNovaPartida(e) {
    e.preventDefault()
    if (!novaForm.mandante || !novaForm.visitante) return
    setSalvandoNova(true)
    try {
      const mk = makeKey(novaForm.mandante, novaForm.visitante, novaForm.data)
      const fd = new FormData()
      fd.append('data', JSON.stringify({
        match_key: mk,
        mandante: novaForm.mandante,
        visitante: novaForm.visitante,
        data: novaForm.data || null,
        hora: novaForm.hora || null,
        comp: novaForm.comp || 'Série C',
        pais: novaForm.pais || '',
        scout: novaForm.scout || null,
        status: 'Pendente',
      }))
      const res = await fetch('/api/observacao', { method:'POST', body:fd })
      const resData = await res.json()
      if (!res.ok) {
        setSalvandoErro(resData.error || 'Erro ao cadastrar partida. Tente novamente.')
        return
      }
      setSalvandoErro('')
      setModalNova(false)
      setNovaForm({ mandante:'', visitante:'', data:'', hora:'', comp:'Série C', pais:'Brasil', scout:'' })
      load()
    } finally {
      setSalvandoNova(false)
    }
  }

  const abaMainStyle = (t) => ({
    padding:'9px 18px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'inherit',
    fontSize:12, fontWeight:700,
    background: abaMain===t ? BRAND_PRIMARY : 'transparent',
    color: abaMain===t ? '#fff' : '#64748b',
    display:'flex', alignItems:'center', gap:6,
  })

  /* ── filtros de status ───────────────────────────────────────── */
  const statusPills = [
    { label:'Todos',            count: jogos.length },
    { label:'Pendente',         count: jogos.filter(j=>j.status==='Pendente').length },
    { label:'Assistido',        count: jogos.filter(j=>j.status==='Assistido').length },
    { label:'Relatório Enviado',count: jogos.filter(j=>j.status==='Relatório Enviado').length },
  ]

  return (
    <AppShell>
      <div style={{ padding:'28px 32px', maxWidth:1100, margin:'0 auto' }}>

        {/* SEED BANNER */}
        <SeedBanner />

        {/* HEADER */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'3px', color:'#94a3b8', marginBottom:6 }}>Scouts em Campo</p>
            <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:36, fontWeight:900, textTransform:'uppercase', color:BRAND_PRIMARY, letterSpacing:1, lineHeight:1 }}>
              Observação de Partidas
            </h1>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:5 }}>
              {loading ? 'Sincronizando...' : `${jogos.length} partidas · ${jogos.filter(j=>j.tem_relatorio).length} com relatório CIC`}
            </p>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {canEdit && (
              <button onClick={() => setModalNova(true)} style={{ ...S.btnGreen }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width:14, height:14 }}><path d="M12 5v14M5 12h14"/></svg>
                Nova Partida
              </button>
            )}
            <button onClick={load} style={{ ...S.btnGreen, background:'#fff', color:BRAND_PRIMARY, border:'1.5px solid #c6def2' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:14, height:14 }}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Sincronizar
            </button>
          </div>
        </div>

        {/* TABS PRINCIPAIS */}
        <div style={{ display:'flex', gap:4, background:'#f7fcf9', border:'1px solid #e5edf5', borderRadius:14, padding:4, marginBottom:24, width:'fit-content' }}>
          <button onClick={() => setAbaMain('partidas')} style={abaMainStyle('partidas')}>
            📋 Partidas
            <span style={{ fontSize:10, fontWeight:800, padding:'1px 7px', borderRadius:20, background: abaMain==='partidas'?'rgba(255,255,255,0.2)':'#e8f4ec', color: abaMain==='partidas'?'#fff':BRAND_PRIMARY }}>{jogos.length}</span>
          </button>
          <button onClick={() => setAbaMain('destaques')} style={abaMainStyle('destaques')}>
            ⭐ Jogadores Destacados
          </button>
          <button onClick={() => setAbaMain('semanal')} style={abaMainStyle('semanal')}>
            📅 Observação Semanal
          </button>
        </div>

        {/* ─── ABA PARTIDAS ──────────────────────────────────────────── */}
        {abaMain === 'partidas' && (
          <>
            {/* ALERTA 48h */}
            {alertas48h.length > 0 && (
              <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:12, padding:'12px 18px', marginBottom:20, display:'flex', gap:12, alignItems:'flex-start' }}>
                <span style={{ fontSize:18 }}>⏰</span>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:'#c2410c', marginBottom:4 }}>
                    {alertas48h.length} partida{alertas48h.length>1?'s':''} assistida{alertas48h.length>1?'s':''} há mais de 48h sem relatório
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {alertas48h.map((j,i) => (
                      <span key={i} style={{ fontSize:11, fontWeight:600, background:'#ffedd5', border:'1px solid #fed7aa', borderRadius:6, padding:'3px 10px', color:'#c2410c' }}>
                        {j.mandante} × {j.visitante} — {j.scout||'scout n/d'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
              {STATUS_LIST.map(s => {
                const cfg   = kpiColors[s]
                const count = jogos.filter(j => j.status===s).length
                return (
                  <div key={s} style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:14, padding:'16px 20px', cursor:'pointer' }}
                    onClick={() => setStatusFil(statusFil === s ? 'Todos' : s)}>
                    <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:34, fontWeight:900, color:cfg.color, lineHeight:1 }}>{count}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:6 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:STATUS_CFG[s].dot, flexShrink:0 }}/>
                      <p style={{ fontSize:11, fontWeight:600, color:cfg.color }}>{s}</p>
                      {statusFil === s && <span style={{ fontSize:9, fontWeight:700, background:cfg.color, color:'#fff', borderRadius:4, padding:'1px 5px', marginLeft:'auto' }}>FILTRADO</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* FILTROS */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:16, alignItems:'center' }}>
              {/* Tempo */}
              <div style={{ display:'flex', gap:4, background:'#f7fcf9', border:'1px solid #e5edf5', borderRadius:12, padding:4 }}>
                {['Hoje','Esta Semana','Este Mês','Tudo'].map(a => (
                  <button key={a} onClick={() => setAbaTempo(a)} style={{
                    padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit',
                    fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6,
                    background: abaTempo===a ? BRAND_PRIMARY : 'transparent', color: abaTempo===a ? '#fff' : '#64748b',
                  }}>
                    {a}
                    <span style={{ fontSize:10, fontWeight:800, padding:'1px 7px', borderRadius:20, background: abaTempo===a?'rgba(255,255,255,0.2)':'#e8f4ec', color: abaTempo===a?'#fff':BRAND_PRIMARY }}>
                      {counts[a]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Busca por atleta */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#94a3b8', pointerEvents:'none' }}>🔍</span>
                <input
                  value={buscaAtleta}
                  onChange={e => setBuscaAtleta(e.target.value)}
                  placeholder="Buscar atleta avaliado..."
                  style={{ paddingLeft:30, paddingRight: buscaAtleta ? 28 : 12, paddingTop:7, paddingBottom:7, borderRadius:8, border:'1px solid #d6e5f0', fontSize:11, fontFamily:'inherit', background:'#fff', outline:'none', color:'#1a2e1a', width:190 }}
                />
                {buscaAtleta && (
                  <button onClick={() => setBuscaAtleta('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                )}
              </div>

              {/* Liga filter */}
              <select value={ligaFil} onChange={e => setLigaFil(e.target.value)} style={{
                padding:'7px 12px', borderRadius:8, border:'1px solid #d6e5f0', fontSize:11,
                fontFamily:'inherit', background:'#fff', cursor:'pointer', outline:'none',
                color: ligaFil !== 'Todas' ? BRAND_PRIMARY : '#52677e', fontWeight: ligaFil !== 'Todas' ? 700 : 400,
              }}>
                <option value='Todas'>🏆 Todas as ligas</option>
                {allLigas.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              {/* Posição dos jogadores avaliados */}
              {allPosicoes.length > 0 && (
                <select value={posFil} onChange={e => setPosFil(e.target.value)} style={{
                  padding:'7px 12px', borderRadius:8, border:'1px solid #d6e5f0', fontSize:11,
                  fontFamily:'inherit', background:'#fff', cursor:'pointer', outline:'none',
                  color: posFil ? BRAND_PRIMARY : '#52677e', fontWeight: posFil ? 700 : 400,
                }}>
                  <option value=''>⬜ Todas posições</option>
                  {allPosicoes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}

              {/* Scout filter */}
              {allScouts.length > 0 && (
                <div style={{ display:'flex', gap:4, background:'#f7fcf9', border:'1px solid #e5edf5', borderRadius:12, padding:4 }}>
                  <button onClick={() => setScoutFil('Todos')} style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700, background: scoutFil==='Todos'?'#10233b':'transparent', color: scoutFil==='Todos'?'#fff':'#64748b' }}>Todos</button>
                  {allScouts.map(s => (
                    <button key={s} onClick={() => setScoutFil(s)} style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:5, background: scoutFil===s?'#10233b':'transparent', color: scoutFil===s?'#fff':'#64748b' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:BRAND_PRIMARY, flexShrink:0 }}/>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Resultado do filtro */}
              {(filtered.length !== jogos.length || buscaAtleta) && (
                <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>
                  {filtered.length} de {jogos.length} partidas
                  <button onClick={() => { setScoutFil('Todos'); setLigaFil('Todas'); setStatusFil('Todos'); setAbaTempo('Tudo'); setBuscaAtleta(''); setPosFil('') }}
                    style={{ marginLeft:8, fontSize:10, fontWeight:700, color:'#ef4444', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    ✕ Limpar
                  </button>
                </span>
              )}
            </div>

            {/* LISTA DE JOGOS */}
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[...Array(5)].map((_,i) => <div key={i} style={{ height:90, background:'#f7fcf9', borderRadius:14 }}/>)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ ...S.card, padding:60, textAlign:'center' }}>
                <p style={{ fontSize:32, marginBottom:10 }}>📋</p>
                <p style={{ fontSize:14, fontWeight:700, color:'#52677e', marginBottom:6 }}>
                  Nenhuma partida encontrada
                </p>
                <p style={{ fontSize:12, color:'#94a3b8' }}>Ajuste os filtros ou sincronize a planilha</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filtered.map((j, idx) => {
                  const isG      = (j.mandante||'').toLowerCase().includes('confianca')||(j.visitante||'').toLowerCase().includes('confianca')
                  const cfg      = STATUS_CFG[j.status] || STATUS_CFG['Pendente']
                  const semScout = !j.scout
                  const aguardando = j.status === 'Assistido' && !j.pdf_name && !j.tem_relatorio
                  const horas    = hoursAgo(j.updated_at)
                  const alerta   = aguardando && horas !== null && horas >= 48

                  return (
                    <div key={j.match_key || idx} style={{
                      ...S.card,
                      border: isG ? '1.5px solid #bbf7d0' : j.tem_relatorio ? '1.5px solid #86efac' : '1px solid #e5edf5',
                      padding:'16px 22px', transition:'box-shadow 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(10,102,183,0.10)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 6px rgba(10,102,183,0.05)'}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          {/* Tags */}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                            {j.pais && <span style={{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:6, background:'#f8fafc', color:'#475569', border:'1px solid #e2e8f0' }}>🌎 {j.pais}</span>}
                            <span style={{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:6, background:'#f4f8fc', color:'#52677e', border:'1px solid #d6e5f0' }}>{j.comp}</span>
                            {j.manual && <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6, background:'#f5f3ff', color:'#6d28d9', border:'1px solid #ddd6fe' }}>✎ Manual</span>}
                            {isG && <span style={{ fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:6, background:BRAND_PRIMARY, color:'#fff' }}>CONFIANÇA</span>}
                            {j.tem_relatorio && <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6, background:'#f0fdf4', color:'#166534', border:'1px solid #86efac' }}>📋 Relatório CIC</span>}
                            {semScout && <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca' }}>⚠ Sem scout</span>}
                            {alerta && <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6, background:'#fff7ed', color:'#c2410c', border:'1px solid #fed7aa' }}>⏰ +48h sem relatório</span>}
                            {aguardando && !alerta && <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe' }}>📋 Aguardando relatório</span>}
                          </div>

                          {/* Times + Placar */}
                          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                            <span style={{ fontSize:16, fontWeight:800, color:'#10233b' }}>{j.mandante}</span>
                            {j.gols_mandante != null && j.gols_visitante != null ? (
                              <span style={{
                                fontSize:15, fontWeight:900, color:'#fff', background:BRAND_PRIMARY,
                                padding:'2px 12px', borderRadius:8, letterSpacing:1,
                              }}>
                                {j.gols_mandante} × {j.gols_visitante}
                              </span>
                            ) : (
                              <span style={{ fontSize:13, fontWeight:700, color:'#c0d8c4' }}>×</span>
                            )}
                            <span style={{ fontSize:16, fontWeight:800, color:'#10233b' }}>{j.visitante}</span>
                          </div>

                          {/* Goleadores */}
                          {(j.goleadores_mandante?.length > 0 || j.goleadores_visitante?.length > 0) && (
                            <div style={{ display:'flex', gap:12, marginBottom:8, flexWrap:'wrap', fontSize:11, color:'#52677e' }}>
                              {j.goleadores_mandante?.length > 0 && (
                                <span>
                                  <span style={{ marginRight:4 }}>⚽</span>
                                  <span style={{ fontWeight:600 }}>{j.mandante}:</span>
                                  {' '}{j.goleadores_mandante.join(', ')}
                                </span>
                              )}
                              {j.goleadores_visitante?.length > 0 && (
                                <span>
                                  <span style={{ marginRight:4 }}>⚽</span>
                                  <span style={{ fontWeight:600 }}>{j.visitante}:</span>
                                  {' '}{j.goleadores_visitante.join(', ')}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Detalhes */}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:16, fontSize:11, color:'#64748b' }}>
                            <span>📅 {fmtDate(j.data)}{j.hora && ` · ${j.hora}`}</span>
                            {j.scout ? <span style={{ color:BRAND_PRIMARY, fontWeight:700 }}>👤 {j.scout}</span>
                                     : <span style={{ color:'#ef4444', fontWeight:700 }}>👤 Sem scout designado</span>}
                          </div>

                          {/* Destaques e lances */}
                          {j.tem_relatorio && j.avaliacoes_resumo?.length === 0 && (
                            <div style={{ marginTop:10, background:'#fafafa', borderRadius:8, padding:'7px 12px', border:'1px solid #e5edf5', display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:9, color:'#94a3b8' }}>—</span>
                              <span style={{ fontSize:9, color:'#94a3b8', fontStyle:'italic' }}>Nenhum jogador destacado nesta partida</span>
                            </div>
                          )}
                          {(j.avaliacoes_resumo?.length > 0) && (
                            <div style={{ marginTop:10, background:'#f0fdf4', borderRadius:10, padding:'10px 14px', border:'1px solid #bbf7d0' }}>
                              <p style={{ fontSize:9, fontWeight:800, color:BRAND_PRIMARY, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                                🏆 {j.avaliacoes_resumo.length} jogador{j.avaliacoes_resumo.length > 1 ? 'es' : ''} avaliado{j.avaliacoes_resumo.length > 1 ? 's' : ''}
                              </p>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {j.avaliacoes_resumo.map((a, ai) => {
                                  const notaNum = parseInt(a.nota_jogo || '0')
                                  const notaColor = notaNum >= 8 ? BRAND_PRIMARY : notaNum >= 6 ? '#b45309' : notaNum > 0 ? '#c62828' : '#94a3b8'
                                  const recBg = { 'Contratar (Titular PRO)':'#dcfce7','Contratar (Elenco PRO)':'#dcfce7','Monitorar (PRO)':'#dbeafe','Contratar (Titular Base)':'#dcfce7','Contratar (Elenco Base)':'#dcfce7','Monitorar (Base)':'#dbeafe','Ver mais (sem opinião)':'#fef3c7','Arquivar':'#fee2e2' }[a.recomendacao] || '#f1f5f9'
                                  const recColor = { 'Contratar (Titular PRO)':'#166534','Contratar (Elenco PRO)':'#166534','Monitorar (PRO)':'#1e40af','Contratar (Titular Base)':'#166534','Contratar (Elenco Base)':'#166534','Monitorar (Base)':'#1e40af','Ver mais (sem opinião)':'#92400e','Arquivar':'#991b1b' }[a.recomendacao] || '#475569'
                                  return (
                                    <div key={ai} style={{ background:'white', border:'1px solid #e5edf5', borderRadius:8, padding:'5px 10px', display:'flex', flexDirection:'column', gap:3, minWidth:140 }}>
                                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                        <span style={{ fontSize:11, fontWeight:800, color:'#10233b' }}>{a.nome}</span>
                                        {notaNum > 0 && <span style={{ fontSize:10, fontWeight:900, color:notaColor, background:`${notaColor}15`, borderRadius:6, padding:'1px 7px', border:`1px solid ${notaColor}33` }}>{notaNum}</span>}
                                      </div>
                                      <span style={{ fontSize:9, color:'#64748b' }}>{a.time_nome} · {a.posicao}</span>
                                      {a.recomendacao && <span style={{ fontSize:9, fontWeight:700, color:recColor, background:recBg, borderRadius:4, padding:'1px 6px', alignSelf:'flex-start' }}>{a.recomendacao}</span>}
                                      {a.link_lances && (
                                        <a href={a.link_lances} target="_blank" rel="noopener noreferrer" style={{ fontSize:9, fontWeight:700, color:'#1d4ed8', display:'flex', alignItems:'center', gap:4, textDecoration:'none', marginTop:1 }}>
                                          🎬 Ver lances
                                        </a>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Ações */}
                          <div style={{ display:'flex', gap:10, marginTop:12, flexWrap:'wrap' }}>
                            <button onClick={() => setModalJogo(j)} style={{
                              display:'inline-flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8,
                              border:`1.5px solid ${j.tem_relatorio ? '#86efac' : BRAND_PRIMARY}`, cursor:'pointer',
                              fontFamily:'inherit', fontSize:11, fontWeight:700,
                              background: j.tem_relatorio ? '#f0fdf4' : BRAND_PRIMARY,
                              color: j.tem_relatorio ? '#166534' : '#fff',
                            }}>
                              {j.tem_relatorio
                                ? (canEdit ? '📋 Ver / Editar Relatório' : '📋 Ver Relatório')
                                : (canEdit ? '📝 Abrir Relatório'        : '📄 Ver Relatório')}
                            </button>
                            {canEdit && j.status === 'Pendente' && (
                              <button onClick={() => marcarAssistido(j)} style={{
                                display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
                                border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700,
                                background:'#eff6ff', color:'#1d4ed8',
                              }}>✅ Marcar Assistido</button>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <div style={{ flexShrink:0 }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:6, fontSize:10, fontWeight:700,
                            padding:'5px 12px', borderRadius:8, background:cfg.bg, color:cfg.color,
                            border:`1px solid ${cfg.color}30`,
                          }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot }}/>
                            {j.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ─── ABA DESTAQUES ─────────────────────────────────────────── */}
        {abaMain === 'destaques' && (
          <Suspense fallback={<p style={{ color:'#94a3b8', textAlign:'center', padding:40 }}>Carregando...</p>}>
            <JogadoresDestacados />
          </Suspense>
        )}

        {/* ─── ABA SEMANAL ───────────────────────────────────────────── */}
        {abaMain === 'semanal' && (
          <Suspense fallback={<p style={{ color:'#94a3b8', textAlign:'center', padding:40 }}>Carregando...</p>}>
            <ObservacaoSemanal />
          </Suspense>
        )}

      </div>

      {/* MODAL DE RELATÓRIO */}
      {modalJogo && (
        <RelatorioModal
          jogo={modalJogo}
          onClose={() => setModalJogo(null)}
          onSaved={() => { setModalJogo(null); load() }}
          canEdit={canEdit}
        />
      )}

      {/* MODAL NOVA PARTIDA MANUAL */}
      {modalNova && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e => { if(e.target===e.currentTarget) setModalNova(false) }}>
          <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,0.25)", overflow:"hidden" }}>
            {/* Header */}
            <div style={{ background:BRAND_PRIMARY, padding:"18px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:3, color:"rgba(255,255,255,0.65)", marginBottom:2 }}>Cadastro Manual</p>
                <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:"#fff", textTransform:"uppercase" }}>Nova Partida</h3>
              </div>
              <button onClick={() => { setModalNova(false); setSalvandoErro('') }} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:8, color:"#fff", fontSize:18, width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>

            {/* Form */}
            <form onSubmit={salvarNovaPartida} style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:14 }}>

              {/* Mandante x Visitante */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:8, alignItems:"end" }}>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#64748b", display:"block", marginBottom:5 }}>Mandante *</label>
                  <input
                    required
                    value={novaForm.mandante}
                    onChange={e => setNovaForm(f => ({...f, mandante:e.target.value}))}
                    placeholder="Ex: Confiança"
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #d6e5f0", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
                <span style={{ fontSize:14, fontWeight:900, color:"#94a3b8", paddingBottom:9 }}>×</span>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#64748b", display:"block", marginBottom:5 }}>Visitante *</label>
                  <input
                    required
                    value={novaForm.visitante}
                    onChange={e => setNovaForm(f => ({...f, visitante:e.target.value}))}
                    placeholder="Ex: Ferroviário"
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #d6e5f0", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              </div>

              {/* Data + Hora */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#64748b", display:"block", marginBottom:5 }}>Data</label>
                  <input
                    type="date"
                    value={novaForm.data}
                    onChange={e => setNovaForm(f => ({...f, data:e.target.value}))}
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #d6e5f0", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#64748b", display:"block", marginBottom:5 }}>Horário</label>
                  <input
                    type="time"
                    value={novaForm.hora}
                    onChange={e => setNovaForm(f => ({...f, hora:e.target.value}))}
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #d6e5f0", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              </div>

              {/* Competição + País */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#64748b", display:"block", marginBottom:5 }}>Competição</label>
                  <input
                    value={novaForm.comp}
                    onChange={e => setNovaForm(f => ({...f, comp:e.target.value}))}
                    placeholder="Série C, Copa do NE..."
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #d6e5f0", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#64748b", display:"block", marginBottom:5 }}>País</label>
                  <input
                    value={novaForm.pais}
                    onChange={e => setNovaForm(f => ({...f, pais:e.target.value}))}
                    placeholder="Brasil, Colômbia..."
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #d6e5f0", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              </div>

              {/* Scout */}
              <div>
                <label style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#64748b", display:"block", marginBottom:5 }}>Scout Responsável</label>
                <select
                  value={novaForm.scout}
                  onChange={e => setNovaForm(f => ({...f, scout:e.target.value}))}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #d6e5f0", fontSize:12, fontFamily:"inherit", outline:"none", background:"#fff", color:novaForm.scout?"#10233b":"#94a3b8" }}
                >
                  <option value="">— Selecionar scout —</option>
                  {allScouts.length > 0
                    ? allScouts.map(s => <option key={s} value={s}>{s}</option>)
                    : ["ADRYAN","ANTHONY"].map(s => <option key={s} value={s}>{s}</option>)
                  }
                </select>
              </div>

              {/* Erro de cadastro */}
              {salvandoErro && (
                <p style={{ fontSize:11, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', fontWeight:600 }}>
                  ⚠️ {salvandoErro}
                </p>
              )}

              {/* Aviso */}
              <p style={{ fontSize:10, color:"#94a3b8", background:"#f7fcf9", border:"1px solid #e5edf5", borderRadius:8, padding:"8px 12px" }}>
                💡 Partidas cadastradas manualmente ficam salvas no banco e aparecem na lista junto com as do Google Sheets.
              </p>

              {/* Botões */}
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
                <button type="button" onClick={() => setModalNova(false)}
                  style={{ padding:"9px 18px", borderRadius:8, border:"1.5px solid #d6e5f0", background:"#fff", color:"#64748b", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoNova || !novaForm.mandante || !novaForm.visitante}
                  style={{ padding:"9px 20px", borderRadius:8, border:"none", background:BRAND_PRIMARY, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:(salvandoNova||!novaForm.mandante||!novaForm.visitante)?0.6:1 }}>
                  {salvandoNova ? "Salvando..." : "✓ Cadastrar Partida"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
