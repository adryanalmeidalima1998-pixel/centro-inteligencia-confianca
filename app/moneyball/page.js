'use client'
import { useState, useEffect, useMemo } from 'react'
import AppShell from '../components/layout/AppShell'
import { calculateSportsbasePercentile, getMetricEligibility, getSportsbaseMetric, getSuggestedMinimumMinutes } from '@/data/sportsbase-map'
import { PLAYER_FOOT_OPTIONS, matchesPlayerFoot } from '@/data/player-foot'

const GFC = '#0a66b7'

const LIGA_LABELS = {
  'paulista-a2':'Paulista A2','paulista-a1':'Paulista A1','paulista-a3':'Paulista A3',
  'brasileirao-serie-a':'Série A','brasileirao-serie-b':'Série B',
  'brasileirao-serie-c':'Série C','brasileirao-serie-d':'Série D',
  'primeira-liga-por':'Liga Portugal','liga-profesional-arg':'Liga Arg',
  'liga-betplay':'Liga COL','ligapro-ecuador':'LigaPro ECU',
}
function getLL(s) {
  return LIGA_LABELS[String(s || '')] || String(s || '').replace(/-/g, ' ') || '—'
}

const LIGAS_PERI = new Set([
  'paulista-a2','paulista-a3','brasileirao-serie-b','brasileirao-serie-c',
  'brasileirao-serie-d','primera-nacional-arg','torneo-betplay',
  'ligapro-ecuador','liga-1-peru','division-paraguaya',
])
const GRANDES = [
  'flamengo','palmeiras','corinthians','são paulo','santos','grêmio',
  'internacional','cruzeiro','atlético mineiro','fluminense','vasco',
  'botafogo','athletico','bragantino','benfica','porto','sporting',
  'barcelona','real madrid','bayern','psg','manchester city','liverpool','arsenal',
]
function isGrande(eq) { const e = String(eq || '').toLowerCase(); return GRANDES.some(g => e.includes(g)) }

const GRUPO_POS = {
  GK: ['GK'], CB: ['CB','LCB','RCB'], LB: ['LB','RB','LWB','RWB'],
  DMF: ['DMF','CMF','LCMF','RCMF','LDMF','RDMF','CDM','LCDM','RCDM','LDM','RDM','LCM','RCM'],
  AMF: ['AMF','LMF','RMF','RAMF','LAMF','CAM','LCAM','RCAM','LM','RM'],
  LWF: ['LWF','RWF','RW','LW','LAM','RAM'], CF: ['CF','LCF','RCF','SS'],
}
const METRICAS = [
  'gols_90','xg_90','assistencias_90','assist_remate_90','passes_prog_90',
  'dribles_pct','duelos_def_pct','intercecoes_90','passes_chave_90',
]

function calcMB(j, todos) {
  const group = Object.entries(GRUPO_POS).find(([,positions]) => String(j.posicao||'').split(',').some(pos=>positions.includes(pos.trim())))?.[0]
  const comparisonPool = group
    ? todos.filter(candidate => String(candidate.posicao||'').split(',').some(pos=>(GRUPO_POS[group]||[]).includes(pos.trim())))
    : todos

  let soma = 0, cnt = 0
  for (const key of METRICAS) {
    const metric = getSportsbaseMetric(key)
    if (!metric) continue
    if (!getMetricEligibility(j, metric, { players:comparisonPool, selectedMinimum:'auto' }).eligible) continue
    const values = comparisonPool
      .filter(candidate => getMetricEligibility(candidate, metric, { players:comparisonPool, selectedMinimum:'auto' }).eligible)
      .map(candidate => candidate[key])
    const percentile = calculateSportsbasePercentile(j[key], values, metric.higherIsBetter)
    if (!Number.isFinite(percentile)) continue
    soma += percentile / 100
    cnt++
  }
  const perf = cnt > 0 ? soma / cnt : 0
  const b1 = LIGAS_PERI.has(String(j._liga || '')) ? 0.08 : 0
  const b2 = !isGrande(j.equipa) ? 0.06 : 0
  const b3 = (parseFloat(j.idade) || 99) <= 24 ? 0.06 : 0
  return Math.min(1, perf + b1 + b2 + b3)
}
function getTier(s) {
  if (s >= 0.85) return { icon: '💎', color: '#92400e', bg: '#fef3c7', border: '#fde68a' }
  if (s >= 0.70) return { icon: '🟢', color: GFC,       bg: '#f0fdf4', border: '#bbf7d0' }
  if (s >= 0.55) return { icon: '🔵', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' }
  if (s >= 0.40) return { icon: '🟡', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' }
  return               { icon: '⚪', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' }
}
const POS_STYLE = {
  GK:{bg:'#fef3c7',c:'#92400e'}, CB:{bg:'#dbeafe',c:'#1e40af'},
  LB:{bg:'#dbeafe',c:'#1e40af'}, RB:{bg:'#dbeafe',c:'#1e40af'},
  LWB:{bg:'#dbeafe',c:'#1e40af'}, RWB:{bg:'#dbeafe',c:'#1e40af'},
  DMF:{bg:'#ede9fe',c:'#6d28d9'}, CMF:{bg:'#ede9fe',c:'#6d28d9'}, CDM:{bg:'#ede9fe',c:'#6d28d9'},
  LCDM:{bg:'#ede9fe',c:'#6d28d9'}, RCDM:{bg:'#ede9fe',c:'#6d28d9'}, LDM:{bg:'#ede9fe',c:'#6d28d9'}, RDM:{bg:'#ede9fe',c:'#6d28d9'},
  LCM:{bg:'#d1fae5',c:'#065f46'}, RCM:{bg:'#d1fae5',c:'#065f46'}, CAM:{bg:'#d1fae5',c:'#065f46'}, LCAM:{bg:'#d1fae5',c:'#065f46'}, RCAM:{bg:'#d1fae5',c:'#065f46'},
  AMF:{bg:'#d1fae5',c:'#065f46'}, LWF:{bg:'#fce7f3',c:'#9d174d'}, RWF:{bg:'#fce7f3',c:'#9d174d'},
  LM:{bg:'#d1fae5',c:'#065f46'}, RM:{bg:'#d1fae5',c:'#065f46'}, LAM:{bg:'#fce7f3',c:'#9d174d'}, RAM:{bg:'#fce7f3',c:'#9d174d'},
  CF:{bg:'#fee2e2',c:'#991b1b'}, LCF:{bg:'#fee2e2',c:'#991b1b'}, RCF:{bg:'#fee2e2',c:'#991b1b'},
}
function fmt(v) { const n = parseFloat(v); return isFinite(n) ? (n % 1 === 0 ? String(n) : n.toFixed(2)) : '—' }

const CATS   = [{ id:'joias',l:'Joias ≥70',icon:'💎' },{ id:'jovens',l:'≤ 23 anos',icon:'🌱' },{ id:'peri',l:'Periféricas',icon:'🔭' },{ id:'todos',l:'Todos',icon:'🌐' }]
const GRUPOS = ['', 'GK', 'CB', 'LB', 'DMF', 'AMF', 'LWF', 'CF']

export default function Moneyball() {
  // Ligas disponíveis (carregadas sem dados, só metadados)
  const [ligas,    setLigas]    = useState([])
  const [ligasLoaded, setLigasLoaded] = useState(false)

  // Liga selecionada — dados só carregam quando ligaSel != ''
  const [ligaSel,  setLigaSel]  = useState('')
  const [jogs,     setJogs]     = useState([])
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState('')

  const [cat,     setCat]     = useState('joias')
  const [minMin,  setMinMin]  = useState(0)
  const [idMax,   setIdMax]   = useState(28)
  const [busca,   setBusca]   = useState('')
  const [grupo,   setGrupo]   = useState('')
  const [foot,    setFoot]    = useState('')

  // 1. Carregar apenas a lista de ligas disponíveis (sem jogadores)
  useEffect(() => {
    fetch('/api/ligas-v2/jogadores?limit=1')
      .then(r => r.json())
      .then(d => { setLigas(Array.isArray(d.ligas) ? d.ligas : []); setLigasLoaded(true) })
      .catch(() => setLigasLoaded(true))
  }, [])

  // 2. Carregar jogadores APENAS quando uma liga for selecionada
  useEffect(() => {
    if (!ligaSel) { setJogs([]); return }
    setLoading(true)
    setErro('')
    fetch(`/api/ligas-v2/jogadores?limit=0&minMin=0&liga=${ligaSel}`)
      .then(r => r.json())
      .then(d => {
        setJogs(Array.isArray(d.jogadores) ? d.jogadores : [])
        setLoading(false)
      })
      .catch(e => { setErro(String(e.message || 'Erro')); setLoading(false) })
  }, [ligaSel])

  const suggestedMin = useMemo(() => getSuggestedMinimumMinutes(jogs), [jogs])
  const effectiveMin = minMin > 0 ? minMin : suggestedMin

  const ranked = useMemo(() => {
    if (!jogs.length) return []
    try {
      let lista = jogs.filter(j =>
        (parseFloat(j.minutos) || 0) >= effectiveMin &&
        (parseFloat(j.idade) || 99) <= idMax
      )
      if (busca.trim()) {
        const b = busca.toLowerCase()
        lista = lista.filter(j =>
          String(j.nome || '').toLowerCase().includes(b) ||
          String(j.equipa || '').toLowerCase().includes(b)
        )
      }
      if (foot) lista = lista.filter(j => matchesPlayerFoot(j, foot))
      if (grupo) {
        const arr = GRUPO_POS[grupo] || []
        lista = lista.filter(j =>
          String(j.posicao || '').split(',').some(p => arr.includes(p.trim()))
        )
      }
      return lista
        .map(j => ({ ...j, _mb: calcMB(j, lista) }))
        .sort((a, b) => b._mb - a._mb)
    } catch { return [] }
  }, [jogs, effectiveMin, idMax, busca, grupo, foot])

  const filtrados = useMemo(() => {
    if (cat === 'joias')  return ranked.filter(j => j._mb >= 0.70)
    if (cat === 'jovens') return ranked.filter(j => (parseFloat(j.idade) || 99) <= 23)
    if (cat === 'peri')   return ranked.filter(j => LIGAS_PERI.has(String(j._liga || '')))
    return ranked
  }, [ranked, cat])

  const nJoias = useMemo(() => ranked.filter(j => j._mb >= 0.85).length, [ranked])
  const nAlto  = useMemo(() => ranked.filter(j => j._mb >= 0.70).length, [ranked])

  return (
    <AppShell>
      <div style={{ paddingBottom: 60 }}>

        {/* HEADER */}
        <div style={{ background: `linear-gradient(135deg,${GFC},#064b82)`, padding: '24px 28px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Central de Inteligência · Moneyball
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Moneyball Intelligence</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', maxWidth: 560 }}>
            Triagem de oportunidades por percentis posicionais Sportsbase, amostra mínima e contexto de mercado.
          </p>
          {ligaSel && (
            <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
              {[
                { l: 'Joias (S)', v: loading ? '...' : nJoias, i: '💎' },
                { l: 'Alto retorno', v: loading ? '...' : nAlto, i: '🟢' },
                { l: 'Analisados', v: loading ? '...' : ranked.length, i: '📊' },
              ].map(k => (
                <div key={k.l} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 16px' }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{k.v}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{k.i} {k.l}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTROS */}
        <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 28px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Liga — obrigatória antes de carregar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={ligaSel} onChange={e => setLigaSel(e.target.value)}
              style={{ border: `2px solid ${ligaSel ? GFC : '#e2e8f0'}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, background: '#fff', cursor: 'pointer', fontWeight: ligaSel ? 700 : 400 }}>
              <option value="">🎯 Selecione uma liga para analisar</option>
              {ligas.map(l => <option key={l} value={l}>{getLL(l)}</option>)}
            </select>
            {ligaSel && (
              <button onClick={() => setLigaSel('')}
                style={{ fontSize: 11, color: '#dc2626', background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕
              </button>
            )}
          </div>

          {ligaSel && (
            <>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar atleta ou time..."
                style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 12, width: 200, background: '#fff' }} />
              <select value={foot} onChange={e => setFoot(e.target.value)}
                style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 11, background: '#fff', color: foot ? GFC : '#64748b' }}>
                {PLAYER_FOOT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 2, background: '#fff', borderRadius: 8, border: '1.5px solid #e2e8f0', padding: 2 }}>
                {GRUPOS.map(g => (
                  <button key={g || 'all'} onClick={() => setGrupo(g)}
                    style={{ padding: '5px 10px', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: grupo === g ? GFC : 'transparent', color: grupo === g ? '#fff' : '#64748b' }}>
                    {g || 'Todos'}
                  </button>
                ))}
              </div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                Min. min {minMin > 0 ? '' : `(auto ${suggestedMin})`}:
                <input type="number" value={minMin || ''} placeholder={String(suggestedMin || 0)} onChange={e => setMinMin(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: 60, border: '1.5px solid #e2e8f0', borderRadius: 6, padding: '5px 6px', fontSize: 11, background: '#fff', textAlign: 'center' }} />
              </label>
              <label style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                Idade máx:
                <input type="number" value={idMax} onChange={e => setIdMax(Math.max(15, parseInt(e.target.value) || 35))}
                  style={{ width: 50, border: '1.5px solid #e2e8f0', borderRadius: 6, padding: '5px 6px', fontSize: 11, background: '#fff', textAlign: 'center' }} />
              </label>
            </>
          )}
        </div>

        {/* CATEGORIAS */}
        {ligaSel && (
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 28px', display: 'flex', gap: 6 }}>
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                style={{ padding: '6px 16px', border: `1.5px solid ${cat === c.id ? GFC : '#e2e8f0'}`, borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: cat === c.id ? GFC : '#fff', color: cat === c.id ? '#fff' : '#64748b' }}>
                {c.icon} {c.l}
              </button>
            ))}
          </div>
        )}

        {/* CONTEÚDO */}
        <div style={{ padding: '20px 28px' }}>
          {erro && (
            <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 14, color: '#991b1b', fontSize: 12 }}>
              ⚠ {erro}
            </div>
          )}

          {/* Estado inicial: nenhuma liga selecionada */}
          {!ligaSel && ligasLoaded && (
            <div style={{ padding: 60, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>💎</p>
              <p style={{ fontWeight: 900, color: '#1a2e1a', fontSize: 18, marginBottom: 8 }}>Selecione uma liga para começar</p>
              <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 400, margin: '0 auto' }}>
                O Moneyball carrega os dados de uma liga por vez para calcular os índices de eficiência com precisão.
              </p>
              <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {ligas.map(l => (
                  <button key={l} onClick={() => setLigaSel(l)}
                    style={{ padding: '8px 16px', background: GFC, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {getLL(l)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              Calculando índices Moneyball para {getLL(ligaSel)}...
            </div>
          )}

          {!loading && ligaSel && filtrados.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <p style={{ fontWeight: 700, color: '#1a2e1a' }}>Nenhum atleta encontrado</p>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Ajuste os filtros ou mínimo de minutos</p>
            </div>
          )}

          {!loading && filtrados.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{filtrados.length} atletas · Score decrescente · {getLL(ligaSel)}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>Eficiência/90 + bônus liga periférica + jovem + clube não-grande</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['#','','Atleta','Time','Pos','Pé','Idade','Min','G/90','xG/90','A/90','PP/90','D%','Score'].map(h => (
                        <th key={h} style={{ padding: '8px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: ['Atleta','Time'].includes(h) ? 'left' : 'center', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.slice(0, 150).map((j, i) => {
                      const t   = getTier(j._mb)
                      const pos = String(j.posicao || '').split(',')[0]?.trim() || ''
                      const ps  = POS_STYLE[pos]
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafcfd' }}>
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{i + 1}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>{t.icon}</span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: GFC }}>{j.nome || '—'}</span>
                          </td>
                          <td style={{ padding: '8px', fontSize: 11, color: '#475569', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.equipa || '—'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {pos && ps && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: ps.bg, color: ps.c }}>{pos}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: 12 }}>
                            {j.pe ? (j.pe.toLowerCase().includes('esq') ? '🦿' : '🦵') : '—'}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: '#475569' }}>{j.idade || '—'}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>{isFinite(parseFloat(j.minutos)) ? Math.round(parseFloat(j.minutos)) : '—'}</td>
                          {['gols_90','xg_90','assistencias_90','passes_prog_90','dribles_pct'].map(k => (
                            <td key={k} style={{ padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#1a2e1a' }}>{fmt(j[k])}</td>
                          ))}
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: 15, fontWeight: 900, color: t.color }}>{isFinite(j._mb) ? Math.round(j._mb * 100) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filtrados.length > 150 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center', fontSize: 11, color: '#94a3b8', background: '#f8fafc' }}>
                  Mostrando 150 de {filtrados.length} · refine com grupo de posição ou mínimo de minutos
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
