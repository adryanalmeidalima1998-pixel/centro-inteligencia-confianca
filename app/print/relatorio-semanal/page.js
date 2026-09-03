'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'

// ─── CORES CIC ─────────────────────────────────────────────────────────────────
const BRAND_PRIMARY  = '#0a66b7'
const BRAND_DARK = '#064b82'

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function safeDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function verdColor(v) {
  if (!v) return { bg: '#f1f5f9', color: '#475569' }
  const u = v.toUpperCase()
  if (u.includes('CONTRATAR') || u.includes('CONTRATAÇÃO')) return { bg: '#dcfce7', color: '#166534' }
  if (u.includes('MONITORAR')) return { bg: '#dbeafe', color: '#1e40af' }
  if (u.includes('OBSERVAR'))  return { bg: '#fef3c7', color: '#92400e' }
  if (u.includes('ARQUIVAR'))  return { bg: '#fee2e2', color: '#991b1b' }
  return { bg: '#f1f5f9', color: '#475569' }
}

function statusColor(s) {
  const m = {
    'Assistido':         { bg: '#dcfce7', color: '#166534' },
    'Relatório Enviado': { bg: '#dbeafe', color: '#1e40af' },
    'Pendente':          { bg: '#fef3c7', color: '#92400e' },
    'Em andamento':      { bg: '#f3e8ff', color: '#6b21a8' },
  }
  return m[s] || { bg: '#f1f5f9', color: '#64748b' }
}

function nivelColor(n) {
  const m = {
    'Monitorando': { bg: '#dbeafe', color: '#1e40af' },
    'Observando':  { bg: '#fef3c7', color: '#92400e' },
    'Negociando':  { bg: '#dcfce7', color: '#166534' },
    'Descartado':  { bg: '#fee2e2', color: '#991b1b' },
  }
  return m[n] || { bg: '#f1f5f9', color: '#64748b' }
}

function ircColor(irc) {
  const v = parseFloat(irc)
  if (isNaN(v)) return { bg: '#f1f5f9', color: '#64748b' }
  if (v >= 7)  return { bg: '#dcfce7', color: '#166534' }
  if (v >= 5)  return { bg: '#dbeafe', color: '#1e40af' }
  if (v >= 3)  return { bg: '#fef3c7', color: '#92400e' }
  return { bg: '#fee2e2', color: '#991b1b' }
}

function prioridadeColor(p) {
  const m = {
    'Alta':   { bg: '#fee2e2', color: '#991b1b' },
    'Média':  { bg: '#fef3c7', color: '#92400e' },
    'Baixa':  { bg: '#f1f5f9', color: '#475569' },
  }
  return m[p] || { bg: '#f1f5f9', color: '#64748b' }
}

function focoStatusColor(s) {
  const m = {
    'Ativo':    { bg: '#dcfce7', color: '#166534' },
    'Pausado':  { bg: '#fef3c7', color: '#92400e' },
    'Concluído':{ bg: '#dbeafe', color: '#1e40af' },
    'Cancelado':{ bg: '#fee2e2', color: '#991b1b' },
  }
  return m[s] || { bg: '#f1f5f9', color: '#64748b' }
}

// ─── MINI COMPONENTES ─────────────────────────────────────────────────────────
function Badge({ text, bg, color }) {
  if (!text || text === '—') return <span style={{ color: '#94a3b8', fontSize: 7 }}>—</span>
  return (
    <span style={{ background: bg, color, padding: '2px 7px', borderRadius: 5, fontWeight: 800, fontSize: 7, display: 'inline-block', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

function Kpi({ label, value, sub, color = BRAND_PRIMARY, bg = '#f0fdf4', border = '#bbf7d0' }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function SecTitle({ children, accent = BRAND_PRIMARY }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155' }}>{children}</span>
    </div>
  )
}

function Avatar({ name, color = BRAND_PRIMARY }) {
  const initial = (name || '?')[0].toUpperCase()
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: 'white' }}>{initial}</span>
    </div>
  )
}

// ─── CONTEÚDO ─────────────────────────────────────────────────────────────────
function PrintContent() {
  const [loading,     setLoading]     = useState(true)
  const [ligasV2,     setLigasV2]     = useState([])
  const [totalJogs,   setTotalJogs]   = useState(0)
  const [monitorados, setMonitorados] = useState([])
  const [obsPartidas, setObsPartidas] = useState([])
  const [destacados,  setDestacados]  = useState([])
  const [listaFinal,  setListaFinal]  = useState([])
  const [listaPref,   setListaPref]   = useState([])
  const [comparacoes,       setComparacoes]       = useState([])
  const [relatoriosPartida, setRelatoriosPartida] = useState([])
  const [focosRecrutamento, setFocosRecrutamento] = useState([])

  useEffect(() => {
    try { setComparacoes(JSON.parse(localStorage.getItem('cig_comparacoes') || '[]')) } catch {}

    Promise.allSettled([
      fetch('/api/ligas-v2/jogadores?limit=1').then(r => r.json()),
      fetch('/api/monitoramento').then(r => r.json()),
      fetch('/api/observacao').then(r => r.json()),
      fetch('/api/lista-preferencial').then(r => r.json()),
      fetch('/api/jogadores-destacados').then(r => r.json()),
      fetch('/api/lista-final').then(r => r.json()),
      fetch('/api/relatorio-partida').then(r => r.json()).catch(() => ({ relatorios: [] })),
      fetch('/api/focos-recrutamento').then(r => r.json()).catch(() => ({ focos: [] })),
    ]).then(([ligas, mon, obs, pref, dest, lf, rel, focos]) => {
      if (ligas.status === 'fulfilled') {
        setLigasV2(ligas.value.ligas || [])
        setTotalJogs(ligas.value.total || 0)
      }
      if (mon.status  === 'fulfilled') setMonitorados(Array.isArray(mon.value) ? mon.value : [])
      if (obs.status  === 'fulfilled') setObsPartidas(obs.value?.jogos || [])
      if (pref.status === 'fulfilled') setListaPref(pref.value?.players || [])
      if (dest.status === 'fulfilled') setDestacados(dest.value?.jogadores || [])
      if (lf.status   === 'fulfilled') setListaFinal(lf.value?.players || [])
      if (rel.status  === 'fulfilled') setRelatoriosPartida(rel.value?.relatorios || [])
      if (focos.status === 'fulfilled') setFocosRecrutamento(focos.value?.focos || [])
      setLoading(false)
    })
  }, [])

  const now    = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const geradoEm = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const ativos = useMemo(() => monitorados.filter(a => a.nivel_interesse !== 'Descartado'), [monitorados])
  const prefAtivos = useMemo(() => listaPref.filter(p => p.status !== 'Descartado'), [listaPref])
  const focosAtivos = useMemo(() => focosRecrutamento.filter(f => f.status === 'Ativo'), [focosRecrutamento])
  const focosAlta   = useMemo(() => focosAtivos.filter(f => f.prioridade === 'Alta'), [focosAtivos])

  const alertas = useMemo(() => {
    const list = []
    obsPartidas.forEach(j => {
      if (j.status !== 'Assistido' || j.pdf_name) return
      const upd = j.updated_at ? new Date(j.updated_at) : null
      if (!upd) return
      const h = (now - upd) / 36e5
      if (h > 72)  list.push({ tipo: 'critico',  msg: `Relatório atrasado +72h — ${j.mandante} vs ${j.visitante}` })
      else if (h > 48) list.push({ tipo: 'atencao', msg: `Relatório pendente +48h — ${j.mandante} vs ${j.visitante}` })
    })
    ativos.forEach(a => {
      if (!a.data_contrato_fim) return
      try {
        const fim  = new Date(a.data_contrato_fim)
        const dias = (fim - now) / 864e5
        if (dias < 0)       list.push({ tipo: 'critico',  msg: `Contrato encerrado — ${a.apelido || a.nome}` })
        else if (dias <= 60) list.push({ tipo: 'atencao', msg: `Contrato vence em ${Math.round(dias)}d — ${a.apelido || a.nome}` })
      } catch {}
    })
    focosAlta.forEach(f => {
      list.push({ tipo: 'atencao', msg: `Foco de alta prioridade — ${f.nome}${f.posicao ? ` (${f.posicao})` : ''}` })
    })
    obsPartidas.filter(j => j.status === 'Relatório Enviado').slice(0, 3).forEach(j => {
      const upd = j.updated_at ? new Date(j.updated_at) : null
      if (upd && (now - upd) / 36e5 <= 48) {
        list.push({ tipo: 'ok', msg: `Relatório enviado — ${j.mandante} vs ${j.visitante}` })
      }
    })
    const ORD = { critico: 0, atencao: 1, ok: 2 }
    return list.sort((a, b) => (ORD[a.tipo] ?? 9) - (ORD[b.tipo] ?? 9)).slice(0, 8)
  }, [ativos, obsPartidas, focosAlta, loading])

  // ── Merge das duas fontes de observação ──────────────────────────────────────
  const todasPartidas = useMemo(() => {
    const map = new Map()
    obsPartidas.forEach(j => {
      const mk = j.match_key || `${j.mandante}|${j.visitante}|${j.data || ''}`
      map.set(mk, {
        match_key:  mk,
        mandante:   j.mandante,
        visitante:  j.visitante,
        data:       j.data || '',
        scout:      j.scout || '',
        status:     j.status || 'Pendente',
        competicao: j.comp || j.competicao || '',
        updated_at: j.updated_at,
        fonte:      'agenda',
      })
    })
    relatoriosPartida.forEach(r => {
      const mk = r.match_key || `${r.mandante}|${r.visitante}|${r.data_jogo || ''}`
      const ex = map.get(mk) || {}
      map.set(mk, {
        ...ex,
        match_key:        mk,
        mandante:         r.mandante  || ex.mandante,
        visitante:        r.visitante || ex.visitante,
        data:             r.data_jogo || ex.data || '',
        scout:            ex.scout || '',
        status:           'Assistido',
        competicao:       r.competicao || ex.competicao || '',
        updated_at:       r.updated_at || ex.updated_at,
        tem_relatorio_cig: true,
        fonte:            'relatorio',
      })
    })
    return Array.from(map.values())
  }, [obsPartidas, relatoriosPartida])

  const semanaStart = useMemo(() => {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const partidasSemana = useMemo(() =>
    todasPartidas
      .filter(j => {
        const dataRef = j.data
          ? new Date(j.data + 'T12:00:00')
          : (j.updated_at ? new Date(j.updated_at) : null)
        return dataRef && dataRef >= semanaStart
      })
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)),
    [todasPartidas, semanaStart]
  )

  // Mapa match_key -> jogadores avaliados (vem direto de avaliacoes_resumo do relatorio-partida)
  const avaliacoesPorMatch = useMemo(() => {
    const map = {}
    relatoriosPartida.forEach(r => {
      const mk = r.match_key || `${r.mandante}|${r.visitante}|${r.data_jogo || ''}`
      if (!mk) return
      const avs = Array.isArray(r.avaliacoes_resumo) ? r.avaliacoes_resumo : []
      if (avs.length > 0) map[mk] = avs
    })
    return map
  }, [relatoriosPartida])

  const jogadoresPorPartida = useMemo(() => {
    const map = {}
    todasPartidas.forEach(j => {
      if (!j.match_key) return
      // Prioridade 1: avaliacoes_resumo direto do relatorio (mais confiável)
      if (avaliacoesPorMatch[j.match_key]?.length > 0) {
        map[j.match_key] = avaliacoesPorMatch[j.match_key]
        return
      }
      // Fallback: jogadores_destacados.match_keys (legado)
      const fallback = destacados.filter(d => {
        const mks = Array.isArray(d.match_keys) ? d.match_keys : []
        return mks.includes(j.match_key)
      })
      if (fallback.length > 0) map[j.match_key] = fallback
    })
    return map
  }, [todasPartidas, avaliacoesPorMatch, destacados])

  const obsOrd = useMemo(() =>
    [...todasPartidas].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)),
    [todasPartidas]
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter,sans-serif', color: '#94a3b8', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      Preparando relatório CIC...
    </div>
  )

  const stripe = { position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${BRAND_PRIMARY} 0%,#22c55e 55%,#1e293b 100%)` }
  const page   = { width: 794, background: 'white', padding: '28px 32px', position: 'relative', fontFamily: "'Inter',sans-serif" }

  const ALERTA_CFG = {
    critico: { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', tag: 'CRÍTICO',  tagBg: '#fee2e2', tagColor: '#991b1b' },
    atencao: { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', tag: 'ATENÇÃO',  tagBg: '#fef3c7', tagColor: '#92400e' },
    ok:      { bg: '#f0fdf4', border: '#bbf7d0', dot: BRAND_PRIMARY,       tag: 'INFO',     tagBg: '#dcfce7', tagColor: '#166534' },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Inter',sans-serif;background:white;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        @media print{
          @page{size:A4 portrait;margin:0;}
          html,body{width:210mm;}
          .no-print{display:none!important;}
          .pg{page-break-before:always;}
        }
        @media screen{
          body{background:#94a3b8;padding-bottom:48px;}
          .a4{box-shadow:0 8px 40px rgba(0,0,0,.22);margin:32px auto;}
        }
      `}</style>

      {/* Botões tela */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()} style={{ background: BRAND_PRIMARY, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 900, fontSize: 13, cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'Inter,sans-serif' }}>
          🖨️ Salvar PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
          ✕ Fechar
        </button>
      </div>

      {/* ═══════════════════════ PÁG 1 — RESUMO EXECUTIVO */}
      <div className="a4" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        {/* Capa header */}
        <div style={{ background: BRAND_DARK, borderRadius: 12, padding: '20px 24px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/confianca.png" alt="" style={{ height: 52, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Associação Desportiva Confiança · CIC</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: 'white', lineHeight: 1 }}>Central de Inteligência</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#86efac', marginTop: 4 }}>Relatório Semanal</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>{dateStr}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Gerado em {geradoEm}</div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ marginBottom: 14 }}>
          <SecTitle>Resumo Executivo</SecTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            <Kpi label="Ligas Monitoradas" value={ligasV2.length}                        sub="com dados Wyscout"   color={BRAND_PRIMARY}       bg="#f0fdf4"  border="#bbf7d0" />
            <Kpi label="Atletas na Base"    value={totalJogs.toLocaleString('pt-BR')}    sub="base total"          color="#1d4ed8"   bg="#eff6ff"  border="#bfdbfe" />
            <Kpi label="Em Monitoramento"   value={ativos.length}                        sub="atletas ativos"      color={BRAND_PRIMARY}       bg="#f0fdf4"  border="#bbf7d0" />
            <Kpi label="Jogadores Dest."    value={destacados.length}                    sub="avaliados em campo"  color="#92400e"   bg="#fffbeb"  border="#fde68a" />
            <Kpi label="Lista Final CIC"    value={listaFinal.length}                    sub="relatórios finais"   color="#991b1b"   bg="#fef2f2"  border="#fecaca" />
            <Kpi label="Observações"        value={todasPartidas.length}                 sub="jogos registrados"   color="#475569"   bg="#f8fafc"  border="#e2e8f0" />
            <Kpi label="Focos Ativos"       value={focosAtivos.length}                   sub={`${focosAlta.length} alta prioridade`} color="#6b21a8" bg="#faf5ff" border="#e9d5ff" />
          </div>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SecTitle accent="#ef4444">Alertas Ativos — {alertas.length}</SecTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {alertas.map((a, i) => {
                const c = ALERTA_CFG[a.tipo]
                return (
                  <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                    <span style={{ background: c.tagBg, color: c.tagColor, fontSize: 6.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{c.tag}</span>
                    <span style={{ fontSize: 8, fontWeight: 600, color: '#334155' }}>{a.msg}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top Lista Final CIC */}
        {listaFinal.length > 0 && (() => {
          const top = [...listaFinal]
            .sort((a, b) => (parseFloat(b.irc_final) || 0) - (parseFloat(a.irc_final) || 0))
            .slice(0, 9)
          const REC_CFG = {
            'CONTRATAÇÃO': { bg: '#dcfce7', color: '#166534' },
            'MONITORAR':   { bg: '#dbeafe', color: '#1e40af' },
            'OBSERVAR MAIS': { bg: '#fef3c7', color: '#92400e' },
            'ARQUIVAR':    { bg: '#fee2e2', color: '#991b1b' },
            'NÃO CONTRATAÇÃO': { bg: '#fee2e2', color: '#991b1b' },
          }
          const distRec = listaFinal.reduce((acc, p) => {
            const k = p.recomendacao || 'Sem rec.'
            acc[k] = (acc[k] || 0) + 1
            return acc
          }, {})
          return (
            <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SecTitle>Top Lista Final CIC — por IRC</SecTitle>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {Object.entries(distRec).map(([rec, count]) => {
                    const rc = REC_CFG[rec] || { bg: '#f1f5f9', color: '#475569' }
                    return (
                      <div key={rec} style={{ background: rc.bg, color: rc.color, fontSize: 6.5, fontWeight: 800, padding: '2px 7px', borderRadius: 5 }}>
                        {count}× {rec}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                {top.map((p, i) => {
                  const irc = parseFloat(p.irc_final) || 0
                  const ic  = ircColor(p.irc_final)
                  const rc  = REC_CFG[p.recomendacao] || { bg: '#f1f5f9', color: '#475569' }
                  return (
                    <div key={i} style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 9, alignItems: 'center' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: ic.bg, border: `2px solid ${ic.color}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: ic.color, lineHeight: 1 }}>{irc > 0 ? irc.toFixed(1) : '—'}</span>
                        <span style={{ fontSize: 5, fontWeight: 700, color: ic.color, opacity: 0.7 }}>IRC</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 8, fontWeight: 800, color: '#1a2e1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.jogador || '—'}</div>
                        <div style={{ fontSize: 6.5, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.clube || '—'} · {p.posicao || '—'}</div>
                        <div style={{ marginTop: 4 }}><Badge text={p.recomendacao} bg={rc.bg} color={rc.color} /></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Grid inferior: Monitoramento snapshot + Destacados + Observações */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Monitoramento por nível */}
          <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '12px 14px' }}>
            <SecTitle>Monitoramento — Atletas Ativos</SecTitle>
            {ativos.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center', padding: '16px 0' }}>Nenhum atleta em monitoramento</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...ativos]
                  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                  .slice(0, 10)
                  .map((a, i) => {
                    const nc = nivelColor(a.nivel_interesse)
                    const diasContrato = a.data_contrato_fim ? Math.round((new Date(a.data_contrato_fim) - now) / 864e5) : null
                    const contratoAlerta = diasContrato !== null && diasContrato <= 60
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: BRAND_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 9, fontWeight: 900, color: 'white' }}>{(a.apelido || a.nome || '?')[0].toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#1a2e1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.apelido || a.nome || '—'}</div>
                          <div style={{ fontSize: 6.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.posicao || '—'} · {a.time_atual || '—'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                          {contratoAlerta && <span style={{ fontSize: 6.5, fontWeight: 800, color: '#92400e' }}>⚠ {diasContrato}d</span>}
                          <Badge text={a.nivel_interesse} bg={nc.bg} color={nc.color} />
                        </div>
                      </div>
                    )
                  })}
                {ativos.length > 10 && (
                  <div style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center', paddingTop: 4 }}>+ {ativos.length - 10} atletas · ver pág. 4</div>
                )}
              </div>
            )}
          </div>

          {/* Destaques + Observações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '12px 14px', flex: 1 }}>
              <SecTitle accent="#92400e">Jogadores Destacados — Recentes</SecTitle>
              {destacados.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center', padding: '16px 0' }}>Nenhum jogador destacado</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {destacados.slice(0, 6).map((j, i) => {
                    const vc = verdColor(j.veredito)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 9, fontWeight: 900, color: 'white' }}>{(j.nome || '?')[0].toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#1a2e1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.nome || '—'}</div>
                          <div style={{ fontSize: 6.5, color: '#64748b' }}>{j.time_nome || '—'} · {j.posicao || '—'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                          {j.promovido && <Badge text="PROM." bg="#dcfce7" color="#166534" />}
                          {j.veredito && <Badge text={j.veredito} bg={vc.bg} color={vc.color} />}
                        </div>
                      </div>
                    )
                  })}
                  {destacados.length > 6 && <div style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center', paddingTop: 4 }}>+ {destacados.length - 6} · ver pág. 3</div>}
                </div>
              )}
            </div>
            <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '12px 14px' }}>
              <SecTitle>Últimas Observações</SecTitle>
              {obsOrd.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center', padding: '10px 0' }}>Nenhum jogo registrado</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {obsOrd.slice(0, 3).map((j, i) => {
                    const sc = statusColor(j.status)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: '#1a2e1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.mandante} vs {j.visitante}</div>
                          <div style={{ fontSize: 6.5, color: '#64748b' }}>{safeDate(j.data || j.updated_at)}{j.scout ? ` · ${j.scout}` : ''}</div>
                        </div>
                        <Badge text={j.status} bg={sc.bg} color={sc.color} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · {geradoEm} · Confidencial</span>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>1 / 6</span>
        </div>
      </div>

      {/* ═══════════════════════ PÁG 2 — OBSERVAÇÃO */}
      <div className="a4 pg" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/confianca.png" alt="" style={{ height: 30, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>CIC · Relatório Semanal · Pág. 2</div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>Observação de Partidas</div>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>
            {partidasSemana.length} na semana · {todasPartidas.length} total
          </span>
        </div>

        {todasPartidas.length === 0 ? (
          <div style={{ background: '#fafafa', borderRadius: 12, border: '1.5px solid #f1f5f9', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            Nenhum jogo registrado no sistema
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {partidasSemana.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 3, height: 14, background: BRAND_PRIMARY, borderRadius: 2 }} />
                  <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155' }}>
                    Partidas da semana — {partidasSemana.length} jogo{partidasSemana.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {partidasSemana.map((j, i) => {
                    const sc = statusColor(j.status)
                    const jogadores = jogadoresPorPartida[j.match_key] || []
                    return (
                      <div key={i} style={{ background: 'white', border: '1px solid #e8f4ec', borderRadius: 10, overflow: 'hidden', borderLeft: `3px solid ${sc.color}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: jogadores.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#1a2e1a' }}>
                              {j.mandante || '—'} vs {j.visitante || '—'}
                            </div>
                            <div style={{ fontSize: 7, color: '#64748b', marginTop: 2 }}>
                              {j.competicao || '—'} · {j.data ? new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR') : safeDate(j.updated_at)}
                              {j.scout ? ` · Scout: ${j.scout}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            <Badge text={j.status} bg={sc.bg} color={sc.color} />
                            {j.tem_relatorio_cig && <Badge text="✓ CIC" bg="#dcfce7" color="#166534" />}
                          </div>
                        </div>
                        {jogadores.length === 0 ? (
                          <div style={{ padding: '6px 12px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 7, color: '#94a3b8', fontStyle: 'italic' }}>Nenhum destaque nessa partida</span>
                          </div>
                        ) : (
                          <div style={{ padding: '6px 12px', background: '#f8fdf9' }}>
                            <div style={{ fontSize: 6.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                              {jogadores.length} jogador{jogadores.length > 1 ? 'es' : ''} avaliado{jogadores.length > 1 ? 's' : ''}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {jogadores.map((jog, ji) => {
                                const vc = verdColor(jog.veredito)
                                return (
                                  <div key={ji} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e8f4ec', borderRadius: 7, padding: '4px 8px' }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: BRAND_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <span style={{ fontSize: 8, fontWeight: 900, color: 'white' }}>{(jog.nome || '?')[0].toUpperCase()}</span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 7.5, fontWeight: 800, color: '#1a2e1a' }}>{jog.nome || '—'}</div>
                                      <div style={{ fontSize: 6.5, color: '#64748b' }}>{jog.time_nome || '—'} · {jog.posicao || '—'}</div>
                                    </div>
                                    {jog.veredito && <Badge text={jog.veredito} bg={vc.bg} color={vc.color} />}
                                    {jog.promovido && <Badge text="PROM." bg="#dcfce7" color="#166534" />}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · {geradoEm} · Confidencial</span>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>2 / 6</span>
        </div>
      </div>

      {/* ═══════════════════════ PÁG 3 — JOGADORES DESTACADOS */}
      <div className="a4 pg" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/confianca.png" alt="" style={{ height: 30, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>CIC · Relatório Semanal · Pág. 3</div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>Jogadores Destacados</div>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{destacados.length} atletas avaliados</span>
        </div>

        {destacados.length === 0 ? (
          <div style={{ background: '#fafafa', borderRadius: 12, border: '1.5px solid #f1f5f9', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            Nenhum jogador destacado registrado
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {destacados.map((j, i) => {
              const vc = verdColor(j.veredito)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: i % 2 === 0 ? 'white' : '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 9, padding: '8px 12px' }}>
                  <Avatar name={j.nome} color={BRAND_PRIMARY} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#1a2e1a' }}>{j.nome || '—'}</div>
                    <div style={{ fontSize: 7, color: '#64748b', marginTop: 2 }}>{j.time_nome || '—'} · {j.posicao || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {j.veredito && <Badge text={j.veredito} bg={vc.bg} color={vc.color} />}
                    {j.promovido && <Badge text="PROMOVIDO" bg="#dcfce7" color="#166534" />}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 6.5, color: '#94a3b8' }}>{j.jogos || 0} obs.</div>
                      <div style={{ fontSize: 6.5, color: '#166534', fontWeight: 700 }}>{j.n_contratar || 0} contr.</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · {geradoEm} · Confidencial</span>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>3 / 6</span>
        </div>
      </div>

      {/* ═══════════════════════ PÁG 4 — ATLETAS EM MONITORAMENTO */}
      <div className="a4 pg" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/confianca.png" alt="" style={{ height: 30, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>CIC · Relatório Semanal · Pág. 4</div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>Atletas em Monitoramento</div>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{ativos.length} atletas ativos</span>
        </div>

        {(() => {
          const por = (nivel) => ativos.filter(a => a.nivel_interesse === nivel).length
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
              <Kpi label="Negociando"  value={por('Negociando')}  color="#166534" bg="#dcfce7" border="#86efac" />
              <Kpi label="Monitorando" value={por('Monitorando')} color="#1e40af" bg="#dbeafe" border="#93c5fd" />
              <Kpi label="Observando"  value={por('Observando')}  color="#92400e" bg="#fef3c7" border="#fde68a" />
              <Kpi label="Contrato exp. ≤60d"
                value={ativos.filter(a => {
                  if (!a.data_contrato_fim) return false
                  const dias = (new Date(a.data_contrato_fim) - now) / 864e5
                  return dias >= 0 && dias <= 60
                }).length}
                color="#991b1b" bg="#fee2e2" border="#fecaca"
              />
            </div>
          )
        })()}

        {ativos.length === 0 ? (
          <div style={{ background: '#fafafa', borderRadius: 12, border: '1.5px solid #f1f5f9', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            Nenhum atleta em monitoramento
          </div>
        ) : (
          <div style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '12px 14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7.5 }}>
              <thead>
                <tr style={{ background: '#1e293b' }}>
                  {['Atleta', 'Posição', 'Clube / Liga', 'País', 'Nasc.', 'Contrato', 'Valor Merc.', 'Nível'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'white', fontWeight: 800, fontSize: 6.5, letterSpacing: '0.05em', textTransform: 'uppercase', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ativos]
                  .sort((a, b) => {
                    const ord = { Negociando: 0, Monitorando: 1, Observando: 2 }
                    return (ord[a.nivel_interesse] ?? 9) - (ord[b.nivel_interesse] ?? 9)
                  })
                  .map((a, i) => {
                    const nc  = nivelColor(a.nivel_interesse)
                    const idade = a.data_nascimento
                      ? Math.floor((now - new Date(a.data_nascimento)) / (1000 * 60 * 60 * 24 * 365.25))
                      : null
                    const diasContrato = a.data_contrato_fim
                      ? Math.round((new Date(a.data_contrato_fim) - now) / 864e5)
                      : null
                    const contratoAlerta = diasContrato !== null && diasContrato <= 60
                    const contratoEncerrado = diasContrato !== null && diasContrato < 0

                    return (
                      <tr key={i} style={{ background: contratoEncerrado ? '#fef2f2' : contratoAlerta ? '#fffbeb' : i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #f1f5f9', maxWidth: 110 }}>
                          <div style={{ fontWeight: 800, fontSize: 8, color: '#1a2e1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.apelido || a.nome || '—'}
                          </div>
                          {a.apelido && a.nome && a.apelido !== a.nome && (
                            <div style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</div>
                          )}
                        </td>
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 7.5, fontWeight: 700, color: '#334155' }}>{a.posicao || '—'}</div>
                          {a.posicao_secundaria && <div style={{ fontSize: 6, color: '#94a3b8' }}>{a.posicao_secundaria}</div>}
                        </td>
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #f1f5f9', maxWidth: 120 }}>
                          <div style={{ fontSize: 7.5, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.time_atual || '—'}</div>
                          {a.liga && <div style={{ fontSize: 6.5, color: '#64748b', marginTop: 1 }}>{a.liga}</div>}
                        </td>
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #f1f5f9', fontSize: 7.5, color: '#475569', whiteSpace: 'nowrap' }}>
                          {a.pais_liga || a.nacionalidade || '—'}
                        </td>
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                          {idade ? (
                            <span style={{ fontSize: 7.5, fontWeight: 700, color: '#334155' }}>{idade} anos</span>
                          ) : <span style={{ color: '#cbd5e1', fontSize: 7 }}>—</span>}
                        </td>
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                          {a.data_contrato_fim ? (
                            <span style={{
                              fontSize: 7.5, fontWeight: 700,
                              color: contratoEncerrado ? '#991b1b' : contratoAlerta ? '#92400e' : '#334155'
                            }}>
                              {safeDate(a.data_contrato_fim)}
                              {contratoEncerrado && <span style={{ marginLeft: 3, fontSize: 6.5 }}>❌</span>}
                              {!contratoEncerrado && contratoAlerta && <span style={{ marginLeft: 3, fontSize: 6.5 }}>⚠</span>}
                            </span>
                          ) : <span style={{ color: '#cbd5e1', fontSize: 7 }}>—</span>}
                        </td>
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #f1f5f9', fontSize: 7.5, fontWeight: 700, color: BRAND_PRIMARY, whiteSpace: 'nowrap' }}>
                          {a.valor_mercado || '—'}
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          <Badge text={a.nivel_interesse} bg={nc.bg} color={nc.color} />
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#fee2e2', border: '1px solid #fecaca' }} />
                <span style={{ fontSize: 6.5, color: '#64748b', fontWeight: 600 }}>Contrato encerrado</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#fffbeb', border: '1px solid #fde68a' }} />
                <span style={{ fontSize: 6.5, color: '#64748b', fontWeight: 600 }}>Vence em ≤60 dias</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · {geradoEm} · Confidencial</span>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>4 / 6</span>
        </div>
      </div>

      {/* ═══════════════════════ PÁG 5 — LISTA FINAL CIC */}
      <div className="a4 pg" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/confianca.png" alt="" style={{ height: 30, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>CIC · Relatório Semanal · Pág. 5</div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>Lista Final CIC</div>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{listaFinal.length} relatórios importados</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'IRC ≥ 7 · Contratar',    bg: '#dcfce7', color: '#166534' },
            { label: 'IRC 5–7 · Monitorar',    bg: '#dbeafe', color: '#1e40af' },
            { label: 'IRC 3–5 · Observar mais', bg: '#fef3c7', color: '#92400e' },
            { label: 'IRC < 3 · Arquivar',     bg: '#fee2e2', color: '#991b1b' },
          ].map(z => (
            <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: z.bg, border: `1px solid ${z.color}44`, flexShrink: 0 }} />
              <span style={{ fontSize: 7, fontWeight: 700, color: '#64748b' }}>{z.label}</span>
            </div>
          ))}
        </div>

        {listaFinal.length === 0 ? (
          <div style={{ background: '#fafafa', borderRadius: 12, border: '1.5px solid #f1f5f9', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            Nenhum relatório na Lista Final
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {listaFinal.map((p, i) => {
              const irc = parseFloat(p.irc_final) || 0
              const ic  = ircColor(p.irc_final)
              const rc  = verdColor(p.recomendacao)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: i % 2 === 0 ? 'white' : '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 9, padding: '8px 12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: ic.bg, border: `2px solid ${ic.color}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: ic.color, lineHeight: 1 }}>{irc > 0 ? irc.toFixed(1) : '—'}</span>
                    <span style={{ fontSize: 5.5, fontWeight: 700, color: ic.color, opacity: 0.7 }}>IRC</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#1a2e1a' }}>{p.jogador || '—'}</div>
                    <div style={{ fontSize: 7, color: '#64748b', marginTop: 2 }}>
                      {p.clube || '—'} · {p.posicao || '—'} · {p.idade ? `${p.idade} anos` : '—'}
                    </div>
                    {p.irc_classificacao && (
                      <div style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 1 }}>{p.irc_classificacao}</div>
                    )}
                  </div>
                  {p.recomendacao && <Badge text={p.recomendacao} bg={rc.bg} color={rc.color} />}
                </div>
              )
            })}
          </div>
        )}

        {comparacoes.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid #f1f5f9' }}>
            <SecTitle accent="#6366f1">Comparações da Sessão</SecTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {comparacoes.slice(0, 6).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: i % 2 === 0 ? 'white' : '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 9, padding: '7px 12px' }}>
                  <Avatar name={c.nomeA} color={BRAND_PRIMARY} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 8.5, fontWeight: 800, color: '#1a2e1a' }}>{c.nomeA || '—'}</span>
                    <span style={{ fontSize: 7, color: '#94a3b8', margin: '0 6px' }}>vs</span>
                    <span style={{ fontSize: 8.5, fontWeight: 800, color: '#1e40af' }}>{c.nomeB || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 7, color: '#94a3b8' }}>{c.posA || '—'}</span>
                    {c.timestamp && <span style={{ fontSize: 7, color: '#cbd5e1' }}>{safeDate(c.timestamp)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 12, padding: '12px 14px' }}>
          <SecTitle accent="#94a3b8">Observações e Decisões</SecTitle>
          {[1, 2, 3].map(i => <div key={i} style={{ borderBottom: '1px solid #e2e8f0', height: 26, marginBottom: 3 }} />)}
        </div>

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · {geradoEm} · Confidencial</span>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>5 / 6</span>
        </div>
      </div>

      {/* ═══════════════════════ PÁG 6 — FOCOS DE RECRUTAMENTO */}
      <div className="a4 pg" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/confianca.png" alt="" style={{ height: 30, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>CIC · Relatório Semanal · Pág. 6</div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>Focos de Recrutamento</div>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{focosRecrutamento.length} foco{focosRecrutamento.length !== 1 ? 's' : ''} cadastrado{focosRecrutamento.length !== 1 ? 's' : ''} · {focosAtivos.length} ativo{focosAtivos.length !== 1 ? 's' : ''}</span>
        </div>

        {/* KPIs de focos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          <Kpi label="Alta Prioridade"  value={focosRecrutamento.filter(f => f.prioridade === 'Alta').length}   color="#991b1b" bg="#fee2e2" border="#fecaca" />
          <Kpi label="Média Prioridade" value={focosRecrutamento.filter(f => f.prioridade === 'Média').length}  color="#92400e" bg="#fef3c7" border="#fde68a" />
          <Kpi label="Ativos"           value={focosAtivos.length}                                               color="#166534" bg="#dcfce7" border="#86efac" />
          <Kpi label="Pausados / Outros" value={focosRecrutamento.filter(f => f.status !== 'Ativo').length}     color="#475569" bg="#f8fafc" border="#e2e8f0" />
        </div>

        {focosRecrutamento.length === 0 ? (
          <div style={{ background: '#fafafa', borderRadius: 12, border: '1.5px solid #f1f5f9', padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            Nenhum foco de recrutamento cadastrado
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {focosRecrutamento.map((f, i) => {
              const pc = prioridadeColor(f.prioridade)
              const sc = focoStatusColor(f.status)
              const criteriosObrig = Array.isArray(f.criterios_obrigatorios) ? f.criterios_obrigatorios : []
              const criteriosDes   = Array.isArray(f.criterios_desejaveis)   ? f.criterios_desejaveis   : []
              const criteriosExcl  = Array.isArray(f.criterios_exclusao)     ? f.criterios_exclusao     : []
              return (
                <div key={i} style={{
                  background: f.prioridade === 'Alta' ? '#fffbeb' : i % 2 === 0 ? 'white' : '#f8fafc',
                  border: `1.5px solid ${f.prioridade === 'Alta' ? '#fde68a' : '#f1f5f9'}`,
                  borderLeft: `4px solid ${f.prioridade === 'Alta' ? '#f59e0b' : f.prioridade === 'Média' ? '#92400e' : '#94a3b8'}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                }}>
                  {/* Header do foco */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: '#1a2e1a', marginBottom: 2 }}>{f.nome || '—'}</div>
                      {f.descricao && (
                        <div style={{ fontSize: 7.5, color: '#64748b', lineHeight: 1.4 }}>{f.descricao}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, marginLeft: 10 }}>
                      <Badge text={f.prioridade} bg={pc.bg} color={pc.color} />
                      <Badge text={f.status}     bg={sc.bg} color={sc.color} />
                    </div>
                  </div>

                  {/* Atributos principais */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: criteriosObrig.length > 0 || criteriosDes.length > 0 ? 6 : 0 }}>
                    {f.posicao && (
                      <div>
                        <span style={{ fontSize: 6.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Posição </span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#334155' }}>{f.posicao}{f.posicao_secundaria ? ` / ${f.posicao_secundaria}` : ''}</span>
                      </div>
                    )}
                    {(f.idade_min || f.idade_max) && (
                      <div>
                        <span style={{ fontSize: 6.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Idade </span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#334155' }}>{f.idade_min ?? '?'} – {f.idade_max ?? '?'} anos</span>
                      </div>
                    )}
                    {f.janela && (
                      <div>
                        <span style={{ fontSize: 6.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Janela </span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#334155' }}>{f.janela}</span>
                      </div>
                    )}
                    {f.tipo_necessidade && (
                      <div>
                        <span style={{ fontSize: 6.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Necessidade </span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#334155' }}>{f.tipo_necessidade}</span>
                      </div>
                    )}
                    {f.pe && (
                      <div>
                        <span style={{ fontSize: 6.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pé </span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#334155' }}>{f.pe}</span>
                      </div>
                    )}
                    {f.liga && (
                      <div>
                        <span style={{ fontSize: 6.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Liga </span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#334155' }}>{f.liga}</span>
                      </div>
                    )}
                  </div>

                  {/* Critérios */}
                  {(criteriosObrig.length > 0 || criteriosDes.length > 0 || criteriosExcl.length > 0) && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                      {criteriosObrig.length > 0 && (
                        <div>
                          <div style={{ fontSize: 6, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Obrigatório</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {criteriosObrig.slice(0, 6).map((c, ci) => (
                              <span key={ci} style={{ fontSize: 6.5, fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 4 }}>
                                {typeof c === 'string' ? c : c.label || c.metrica || JSON.stringify(c)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {criteriosDes.length > 0 && (
                        <div>
                          <div style={{ fontSize: 6, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Desejável</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {criteriosDes.slice(0, 6).map((c, ci) => (
                              <span key={ci} style={{ fontSize: 6.5, fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: 4 }}>
                                {typeof c === 'string' ? c : c.label || c.metrica || JSON.stringify(c)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {criteriosExcl.length > 0 && (
                        <div>
                          <div style={{ fontSize: 6, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Exclusão</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {criteriosExcl.slice(0, 4).map((c, ci) => (
                              <span key={ci} style={{ fontSize: 6.5, fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: 4 }}>
                                {typeof c === 'string' ? c : c.label || c.metrica || JSON.stringify(c)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>CIC · Confiança · {geradoEm} · Confidencial</span>
          <span style={{ fontSize: 7, color: '#cbd5e1', fontWeight: 600 }}>6 / 6</span>
        </div>
      </div>
    </>
  )
}

export default function RelatorioSemanal() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter,sans-serif', color: '#94a3b8', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Preparando relatório CIC...
      </div>
    }>
      <PrintContent />
    </Suspense>
  )
}
