'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import AppShell from '../../components/layout/AppShell'
import { calculateSportsbasePercentile, formatSportsbaseMetric, getMetricEligibility, getSportsbaseMetric } from '@/data/sportsbase-map'
import Link from 'next/link'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const GFC = '#0a66b7'

// ── Perfis (mesmos da página de recomendações) ──────────────
const PERFIS = {
  GK: [
    { id:'defensor_meta', label:'Defensor da Meta', icon:'🧱', pesos:{ defesas_pct:35, gols_sofridos_90:-30, clean_sheets:25, saidas_90:-10 }},
    { id:'passador',      label:'Passador',          icon:'📮', pesos:{ passes_longos_pct:35, passes_longos_90:25, defesas_pct:20, passes_gk_90:20 }},
    { id:'arrojado',      label:'Arrojado',          icon:'🦅', pesos:{ saidas_90:30, duelos_aereos_90:25, defesas_pct:25, gols_sofridos_90:-20 }},
  ],
  CB: [
    { id:'defensor_area', label:'Defensor da Área',  icon:'🛡️', pesos:{ duelos_aereos_pct:35, desarmes_90:25, duelos_def_pct:25, intercecoes_90:15 }},
    { id:'construtor',    label:'Construtor',        icon:'🏗️', pesos:{ passes_longos_pct:30, passes_prog_90:30, passes_pct:25, duelos_def_pct:15 }},
    { id:'duelador',      label:'Duelador',          icon:'💪', pesos:{ duelos_def_pct:40, duelos_aereos_pct:30, duelos_def_90:20, intercecoes_90:10 }},
  ],
  LB: [
    { id:'defensivo',    label:'Defensivo',    icon:'🔒', pesos:{ duelos_def_pct:35, intercecoes_90:30, desarmes_90:25, duelos_def_90:10 }},
    { id:'ofensivo',     label:'Ofensivo',     icon:'🚀', pesos:{ cruzamentos_90:30, dribles_90:25, conducoes_90:25, entradas_terco_conducao_90:20 }},
    { id:'associativo',  label:'Associativo',  icon:'🔗', pesos:{ passes_prog_90:30, passes_chave_90:25, passes_tercofinal_90:25, dribles_pct:20 }},
  ],
  DMF: [
    { id:'destruidor',      label:'Destruidor',           icon:'🔥', pesos:{ duelos_def_pct:40, intercecoes_90:30, duelos_def_90:20, desarmes_90:10 }},
    { id:'construtor_def',  label:'Construtor-Defensivo', icon:'🏗️', pesos:{ passes_prog_90:30, passes_longos_pct:25, duelos_def_pct:25, passes_pct:20 }},
    { id:'area_a_area',     label:'Área-a-Área',          icon:'🔄', pesos:{ duelos_def_90:25, passes_prog_90:25, entradas_terco_conducao_90:25, assistencias_90:25 }},
  ],
  AMF: [
    { id:'definidor',   label:'Definidor',  icon:'🎯', pesos:{ passes_chave_90:30, xg_90:25, acoes_area_90:25, assistencias_90:20 }},
    { id:'driblador',   label:'Driblador',  icon:'🕹️', pesos:{ dribles_pct:35, dribles_90:30, duelos_of_pct:25, conducoes_90:10 }},
    { id:'criativo',    label:'Criativo',   icon:'✨', pesos:{ passes_chave_90:40, assist_remate_90:30, assistencias_90:20, passes_tercofinal_90:10 }},
  ],
  LWF: [
    { id:'um_um_hab',     label:'1x1 de Habilidade', icon:'🕹️', pesos:{ dribles_pct:40, dribles_90:30, duelos_of_pct:20, conducoes_90:10 }},
    { id:'infiltrador_ext',label:'Infiltrador',       icon:'🔪', pesos:{ gols_90:35, acoes_area_90:25, xg_90:25, entradas_terco_conducao_90:15 }},
    { id:'criativo_ext',  label:'Criativo',           icon:'✨', pesos:{ passes_chave_90:35, assist_remate_90:30, assistencias_90:25, cruzamentos_90:10 }},
  ],
  CF: [
    { id:'finalizador', label:'Finalizador', icon:'⚽', pesos:{ gols_90:35, xg_90:30, acoes_area_90:25, gols_cabeca_90:10 }},
    { id:'referencia',  label:'Referência',  icon:'🗼', pesos:{ duelos_aereos_pct:35, duelos_of_pct:30, acoes_area_90:20, gols_90:15 }},
    { id:'rompedor',    label:'Rompedor',    icon:'🚀', pesos:{ conducoes_90:35, entradas_terco_conducao_90:30, dribles_90:25, duelos_of_90:10 }},
  ],
}

const GRUPO_PERFIS = {
  GK:'GK', CB:'CB', LCB:'CB', RCB:'CB', LB:'LB', RB:'LB', LWB:'LB', RWB:'LB',
  DMF:'DMF', CMF:'DMF', LCMF:'DMF', RCMF:'DMF', LDMF:'DMF', RDMF:'DMF', CDM:'DMF', LCDM:'DMF', RCDM:'DMF', LDM:'DMF', RDM:'DMF', LCM:'DMF', RCM:'DMF',
  AMF:'AMF', LMF:'AMF', RMF:'AMF', RAMF:'AMF', LAMF:'AMF', CAM:'AMF', LCAM:'AMF', RCAM:'AMF', LM:'AMF', RM:'AMF',
  LWF:'LWF', RWF:'LWF', RW:'LWF', LW:'LWF', LAM:'LWF', RAM:'LWF',
  CF:'CF', LCF:'CF', RCF:'CF', SS:'CF',
}

function getPerfisParaPosicao(posStr) {
  if (!posStr) return []
  const pos = posStr.split(',').map(p => p.trim())
  const grupos = [...new Set(pos.map(p => GRUPO_PERFIS[p]).filter(Boolean))]
  return grupos.flatMap(g => PERFIS[g] || [])
}

function calcPerfilScore(j, perfil, pool = []) {
  let soma = 0, total = 0
  for (const [key, peso] of Object.entries(perfil.pesos)) {
    const abs = Math.abs(peso)
    const metric = getSportsbaseMetric(key)
    const comparisonPool = pool.length ? pool : [j]
    if (metric) {
      if (!getMetricEligibility(j, metric, { players:comparisonPool, selectedMinimum:'auto' }).eligible) continue
      const values = comparisonPool
        .filter(candidate => getMetricEligibility(candidate, metric, { players:comparisonPool, selectedMinimum:'auto' }).eligible)
        .map(candidate => candidate[key])
      const percentile = calculateSportsbasePercentile(j[key], values, peso < 0 ? false : metric.higherIsBetter)
      if (!Number.isFinite(percentile)) continue
      soma += percentile * abs; total += abs
      continue
    }
    const value = Number(j[key])
    const values = comparisonPool.map(candidate => Number(candidate[key])).filter(Number.isFinite)
    if (!Number.isFinite(value) || !values.length) continue
    const percentile = calculateSportsbasePercentile(value, values, peso >= 0)
    soma += percentile * abs; total += abs
  }
  return total > 0 ? Math.round((soma / total) * 10) / 10 : 0
}

function calcPct(val, arr) {
  const v = parseFloat(val); if (isNaN(v)) return 0
  const nums = arr.map(x => parseFloat(x)).filter(x => !isNaN(x))
  return nums.length ? Math.round((nums.filter(x => x < v).length / nums.length) * 100) : 50
}

function calcNativeMetricPct(player, key, pool = []) {
  const metric = getSportsbaseMetric(key)
  const comparisonPool = pool.length ? pool : [player]
  if (!metric) {
    const value = Number(player?.[key])
    const values = comparisonPool.map(candidate => Number(candidate?.[key])).filter(Number.isFinite)
    if (!Number.isFinite(value) || !values.length) return null
    return calculateSportsbasePercentile(value, values, !INVERTED.has(key))
  }

  const eligibility = getMetricEligibility(player, metric, { players:comparisonPool, selectedMinimum:'auto' })
  if (!eligibility.eligible) return null
  const values = comparisonPool
    .filter(candidate => getMetricEligibility(candidate, metric, { players:comparisonPool, selectedMinimum:'auto' }).eligible)
    .map(candidate => candidate[key])
  return calculateSportsbasePercentile(player[key], values, metric.higherIsBetter)
}

function formatNativeValue(value, key) {
  const metric = getSportsbaseMetric(key)
  if (metric) return formatSportsbaseMetric(value, metric)
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('pt-BR', { maximumFractionDigits:2 }) : '—'
}

function barColor(pct) {
  if (!Number.isFinite(pct)) return '#94a3b8'
  if (pct >= 80) return '#059669'
  if (pct >= 60) return '#2563eb'
  if (pct >= 40) return '#d97706'
  return '#dc2626'
}

// Mapeamento da métrica da base de ligas para o elenco interno
const LIGA_TO_ELENCO = {
  gols_90:          'gols_90',
  assistencias_90:  'assistencias_90',
  xg_90:            'xg_90',
  assist_remate_90:            'assist_remate_90',
  passes_prog_90:   'passes_prog_90',
  passes_chave_90:  'passes_chave_90',
  dribles_90:       'dribles_90',
  dribles_pct:      'dribles_pct',
  intercecoes_90:   'intercecoes_90',
  duelos_def_pct:   'duelos_def_pct',
  duelos_of_pct:    'duelos_of_pct',
  duelos_aereos_pct:'duelos_aereos_pct',
  desarmes_90:        'desarmes_90',
  duelos_def_90:     'duelos_def_90',
  cruzamentos_90:   'cruzamentos_90',
  entradas_terco_conducao_90: 'entradas_terco_conducao_90',
  conducoes_90:   'conducoes_90',
  acoes_area_90:   'acoes_area_90',
  passes_pct:       'passes_pct',
  defesas_pct:      'defesas_pct',
  gols_sofridos_90: 'gols_sofridos_90',
}

const RADAR_KEYS_BY_GROUP = {
  GK:  ['defesas_pct','gols_sofridos_90','passes_pct','duelos_aereos_pct'],
  CB:  ['duelos_def_pct','duelos_aereos_pct','intercecoes_90','desarmes_90','passes_prog_90'],
  LB:  ['duelos_def_pct','cruzamentos_90','dribles_90','intercecoes_90','entradas_terco_conducao_90'],
  DMF: ['duelos_def_pct','intercecoes_90','passes_prog_90','passes_chave_90','duelos_def_90'],
  AMF: ['passes_chave_90','assist_remate_90','passes_prog_90','dribles_90','assistencias_90'],
  LWF: ['gols_90','dribles_90','dribles_pct','passes_chave_90','conducoes_90'],
  CF:  ['gols_90','xg_90','acoes_area_90','duelos_of_pct','assistencias_90'],
}

const METRIC_LABELS = {
  defesas_pct:'Def%', gols_sofridos_90:'GS/90', passes_pct:'Passes%',
  duelos_aereos_pct:'Aéreos%', duelos_def_pct:'DD%', intercecoes_90:'Int/90',
  desarmes_90:'Desarmes/90', passes_prog_90:'PP/90', entradas_terco_conducao_90:'Corridas',
  cruzamentos_90:'Cruz/90', dribles_90:'Dribles/90', dribles_pct:'D%',
  passes_chave_90:'PK/90', assist_remate_90:'Passes p/ chute/90', assistencias_90:'A/90',
  gols_90:'G/90', xg_90:'xG/90', acoes_area_90:'AÁrea/90',
  duelos_of_pct:'DO%', conducoes_90:'Cond/90', duelos_def_90:'DD/90',
}

const ATTR_GROUPS = [
  { label:'Ataque', keys:['gols_90','xg_90','acoes_area_90','assistencias_90','assist_remate_90'] },
  { label:'Criação', keys:['passes_chave_90','passes_prog_90','entradas_terco_conducao_90','cruzamentos_90'] },
  { label:'1×1', keys:['dribles_90','dribles_pct','duelos_of_pct','conducoes_90'] },
  { label:'Defesa', keys:['duelos_def_pct','intercecoes_90','desarmes_90','duelos_def_90','duelos_aereos_pct'] },
  { label:'Passe', keys:['passes_pct','passes_longos_pct'] },
]

const INVERTED = new Set(['gols_sofridos_90'])

// Semente de posição para RADAR_KEYS_BY_GROUP
function getGrupoKey(posStr) {
  if (!posStr) return 'DMF'
  const pos = posStr.split(',').map(p=>p.trim())
  const g = pos.map(p => GRUPO_PERFIS[p]).find(Boolean)
  return g || 'DMF'
}

// Estrelas FM-style
function Stars({ value, max = 5 }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {Array.from({length:max}).map((_,i) => (
        <div key={i} style={{ width:10, height:10, borderRadius:2, background: i < value ? '#f59e0b' : '#e2e8f0' }} />
      ))}
    </div>
  )
}

// Badge de confiança do scout
function ScoutBadge({ pct }) {
  const conf = pct >= 80 ? { label:'Recomendado',   color:'#059669', bg:'#d1fae5' }
             : pct >= 60 ? { label:'Interessante',   color:'#2563eb', bg:'#dbeafe' }
             : pct >= 40 ? { label:'Em análise',     color:'#d97706', bg:'#fef3c7' }
             :              { label:'Baixo potencial',color:'#dc2626', bg:'#fee2e2' }
  return (
    <span style={{ fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, background:conf.bg, color:conf.color }}>
      {conf.label}
    </span>
  )
}

export default function RecomendacaoAtletaPage() {
  const params = useParams()
  const rawId = params?.id ? decodeURIComponent(params.id) : ''
  const [nome, equipa] = rawId.split('|||')

  const [jogador,    setJogador]    = useState(null)
  const [ligaJogs,   setLigaJogs]   = useState([])  // jogadores da mesma liga
  const [elencoGua,  setElencoGua]  = useState([])  // elenco do Confiança
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState('perfil')

  useEffect(() => {
    if (!nome) return
    setLoading(true)
    Promise.all([
      fetch(`/api/ligas-v2/jogadores?busca=${encodeURIComponent(nome)}&limit=0&minMin=0`).then(r=>r.json()),
      fetch('/api/elenco-guarani').then(r=>r.json()),
    ]).then(([ligaData, elencoData]) => {
      const jogs = ligaData.jogadores || []
      // Achar o jogador exato
      const found = jogs.find(j =>
        j.nome?.toLowerCase() === nome.toLowerCase() &&
        (!equipa || j.equipa?.toLowerCase() === equipa.toLowerCase())
      )
      // Fallback 1: match só pelo nome exato
      || jogs.find(j => j.nome?.toLowerCase() === nome.toLowerCase())
      // Fallback 2: match parcial pelo nome
      || jogs.find(j => j.nome?.toLowerCase().includes(nome.toLowerCase()))
      || jogs[0]
      setJogador(found || null)
      setLigaJogs(jogs)
      setElencoGua(elencoData.jogadores || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [nome, equipa])

  // Perfis detectados
  const { melhorPerfil, todosScores } = useMemo(() => {
    if (!jogador) return { melhorPerfil: null, todosScores: [] }
    const perfis = getPerfisParaPosicao(jogador.posicao)
    const profilePool = ligaJogs.filter(item => getGrupoKey(item.posicao) === getGrupoKey(jogador.posicao))
    const scores = perfis.map(p => ({ ...p, score: calcPerfilScore(jogador, p, profilePool) })).sort((a,b) => b.score-a.score)
    return { melhorPerfil: scores[0] || null, todosScores: scores }
  }, [jogador, ligaJogs])

  // Dados para radar liga
  const grupoKey = jogador ? getGrupoKey(jogador.posicao) : 'DMF'
  const radarKeys = RADAR_KEYS_BY_GROUP[grupoKey] || RADAR_KEYS_BY_GROUP.DMF
  const samePosLiga = useMemo(() =>
    ligaJogs.filter(j => getGrupoKey(j.posicao) === grupoKey),
  [ligaJogs, grupoKey])

  const radarLiga = useMemo(() => {
    if (!jogador) return []
    return radarKeys.map(k => {
      const val = Number(jogador[k])
      const pct = calcNativeMetricPct(jogador, k, samePosLiga)
      return { metric:METRIC_LABELS[k]||k, value:Number.isFinite(pct)?pct:0, percentile:pct, raw:val, formatted:formatNativeValue(val,k) }
    })
  }, [jogador, samePosLiga, radarKeys])

  // Dados para radar Confiança (mapear chaves)
  const samePosGuarani = useMemo(() => {
    if (!elencoGua.length) return []
    const posGrupo = grupoKey
    return elencoGua.filter(p => {
      if (!p.posicao) return false
      const pos = p.posicao.toUpperCase().split(',').map(x=>x.trim())
      const g = pos.map(x=>GRUPO_PERFIS[x]).find(Boolean)
      return g === posGrupo
    })
  }, [elencoGua, grupoKey])

  const radarGuarani = useMemo(() => {
    if (!jogador || !samePosGuarani.length) return []
    return radarKeys.map(k => {
      const elencoKey = LIGA_TO_ELENCO[k] || k
      const arr = samePosGuarani.map(p => parseFloat(p[elencoKey])||0)
      const rawVal = parseFloat(jogador[k])
      const val = isNaN(rawVal) ? 0 : rawVal
      const candidateEligible = calcNativeMetricPct(jogador, k, samePosLiga)
      const metric = getSportsbaseMetric(k)
      const pct = candidateEligible === null ? null : calculateSportsbasePercentile(val, arr, metric ? metric.higherIsBetter : !INVERTED.has(k))
      return { metric:METRIC_LABELS[k]||k, value:Number.isFinite(pct)?pct:0, percentile:pct, raw:val, formatted:formatNativeValue(val,k) }
    })
  }, [jogador, samePosGuarani, samePosLiga, radarKeys])

  const avgIndexLiga = useMemo(() => {
    return jogador ? (calcNativeMetricPct(jogador, 'indice', samePosLiga) ?? 0) : 0
  }, [jogador, samePosLiga])

  if (loading) return (
    <AppShell>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#94a3b8', fontSize:14 }}>
        Carregando perfil do atleta...
      </div>
    </AppShell>
  )

  if (!jogador) return (
    <AppShell>
      <div style={{ padding:60, textAlign:'center' }}>
        <p style={{ fontSize:24, marginBottom:8 }}>🔍</p>
        <p style={{ fontSize:16, fontWeight:700, color:'#1a2e1a', marginBottom:8 }}>Atleta não encontrado</p>
        <Link href="/recomendacoes" style={{ color:GFC, fontSize:13, fontWeight:700 }}>← Voltar</Link>
      </div>
    </AppShell>
  )

  const tabs = ['perfil', 'comparacao', 'atributos']

  return (
    <AppShell>
      <div style={{ background:'#f1f5f9', minHeight:'100vh' }}>

        {/* HEADER ESTILO FM */}
        <div style={{ background:`linear-gradient(135deg, ${GFC} 0%, #052f57 100%)`, padding:'0 0 0 0' }}>
          {/* Breadcrumb */}
          <div style={{ padding:'10px 28px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
            <Link href="/recomendacoes" style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:700, textDecoration:'none' }}>
              ← Recomendações
            </Link>
          </div>

          {/* Player info */}
          <div style={{ padding:'20px 28px 0', display:'flex', gap:20, alignItems:'flex-start' }}>
            {/* Avatar */}
            <div style={{ width:72, height:72, borderRadius:16, background:'rgba(255,255,255,0.15)', border:'2px solid rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, color:'#fff', flexShrink:0 }}>
              {(jogador.nome||'?')[0]}
            </div>

            {/* Nome e info */}
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6, flexWrap:'wrap' }}>
                <h1 style={{ fontSize:26, fontWeight:900, color:'#fff', letterSpacing:0.3, lineHeight:1 }}>{jogador.nome}</h1>
                {melhorPerfil && (
                  <span style={{ fontSize:11, background:'rgba(255,255,255,0.2)', color:'#fff', borderRadius:20, padding:'3px 10px', fontWeight:700 }}>
                    {melhorPerfil.icon} {melhorPerfil.label}
                  </span>
                )}
              </div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                {[
                  { label: jogador.equipa || '—' },
                  { label: jogador.posicao || '—' },
                  jogador.idade && { label: `${jogador.idade} anos` },
                  jogador.minutos && { label: `${parseInt(jogador.minutos)||0} min` },
                  jogador._liga && { label: jogador._liga.replace(/-/g,' ').toUpperCase() },
                ].filter(Boolean).map((item, i) => (
                  <span key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.75)', background:'rgba(255,255,255,0.1)', padding:'3px 10px', borderRadius:20, fontWeight:600 }}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Painel direito — scores FM */}
            <div style={{ display:'flex', gap:12, flexShrink:0 }}>
              <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:12, padding:'12px 18px', textAlign:'center', border:'1px solid rgba(255,255,255,0.15)' }}>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', marginBottom:4, textTransform:'uppercase', letterSpacing:1 }}>Capacidade</div>
                <Stars value={Math.round((avgIndexLiga||0)/25)} max={5} />
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:4 }}>P{avgIndexLiga} no grupo</div>
              </div>
              {melhorPerfil && (
                <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:12, padding:'12px 18px', textAlign:'center', border:'1px solid rgba(255,255,255,0.15)' }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', marginBottom:4, textTransform:'uppercase', letterSpacing:1 }}>Melhor perfil</div>
                  <div style={{ fontSize:22, lineHeight:1 }}>{melhorPerfil.icon}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:4, fontWeight:700 }}>{melhorPerfil.label}</div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:0, marginTop:16, padding:'0 28px' }}>
            {[['perfil','Visão Geral'],['comparacao','Comparação'],['atributos','Métricas']].map(([id,label]) => (
              <button key={id} onClick={()=>setActiveTab(id)} style={{
                padding:'10px 18px', border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
                background: activeTab===id ? '#fff' : 'transparent',
                color: activeTab===id ? GFC : 'rgba(255,255,255,0.65)',
                borderRadius: activeTab===id ? '8px 8px 0 0' : 0,
                transition:'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* CONTEÚDO */}
        <div style={{ padding:'20px 28px', display:'grid', gridTemplateColumns: activeTab==='comparacao' ? '1fr 1fr' : '280px 1fr', gap:20 }}>

          {/* ── TAB: PERFIL ──────────────────────────────── */}
          {activeTab === 'perfil' && (<>
            {/* Sidebar */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Perfis detectados */}
              <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #e2e8f0' }}>
                <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Perfis Detectados</p>
                {todosScores.slice(0,4).map((p,i) => {
                  const allScores = todosScores.map(x=>x.score)
                  const pct = calcPct(p.score, allScores)
                  return (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: i<todosScores.slice(0,4).length-1 ? '1px solid #f8fafc' : 'none' }}>
                      <span style={{ fontSize:18 }}>{p.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:11, fontWeight:700, color: i===0 ? GFC : '#475569' }}>{p.label}</span>
                          {i===0 && <ScoutBadge pct={Math.round(p.score)} />}
                        </div>
                        <div style={{ height:5, background:'#f1f5f9', borderRadius:99 }}>
                          <div style={{ width:`${Math.min(100,p.score)}%`, height:'100%', background: i===0?GFC:'#94a3b8', borderRadius:99 }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Prós do perfil (baseado nos pesos maiores) */}
              {melhorPerfil && (
                <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #e2e8f0' }}>
                  <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Destaques do Perfil</p>
                  {Object.entries(melhorPerfil.pesos).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,peso]) => {
                    const val = parseFloat(jogador[k])
                    const pct = calcNativeMetricPct(jogador, k, samePosLiga)
                    if (isNaN(val)) return null
                    return (
                      <div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <span style={{ fontSize:12, color: Number.isFinite(pct)&&pct>=70?'#059669':'#64748b' }}>{Number.isFinite(pct)&&pct>=70?'✅':'⚪'}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                            <span style={{ fontSize:11, color:'#475569', fontWeight:600 }}>{METRIC_LABELS[k]||k}</span>
                            <span style={{ fontSize:10, color:barColor(pct), fontWeight:800 }}>{Number.isFinite(pct)?`P${pct}`:'Amostra insuficiente'}</span>
                          </div>
                          <div style={{ height:5, background:'#f1f5f9', borderRadius:99 }}>
                            <div style={{ width:`${Number.isFinite(pct)?pct:0}%`, height:'100%', background:barColor(pct), borderRadius:99 }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Info geral */}
              <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #e2e8f0' }}>
                <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Informações</p>
                {[
                  ['Posição', jogador.posicao||'—'],
                  ['Idade', jogador.idade ? `${jogador.idade} anos` : '—'],
                  ['Club', jogador.equipa||'—'],
                  ['Liga', jogador._liga?.replace(/-/g,' ')||'—'],
                  ['Minutos', `${parseInt(jogador.minutos)||0} min`],
                  ['Jogos', jogador.jogos||'—'],
                  ['Amarelos', jogador.amarelos??'—'],
                ].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f8fafc' }}>
                    <span style={{ fontSize:11, color:'#64748b' }}>{l}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'#1e293b' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Main — radar + stats */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Radar vs liga */}
              <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e2e8f0' }}>
                <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>Radar vs Liga</p>
                <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>Percentis comparados com {samePosLiga.length} jogadores do mesmo grupo posicional</p>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarLiga} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} />
                    <Tooltip formatter={(v,n,{payload})=>[`${payload?.formatted??'—'} (${Number.isFinite(payload?.percentile)?`P${payload.percentile}`:'amostra insuficiente'})`,'']} />
                    <Radar dataKey="value" stroke={GFC} fill={GFC} fillOpacity={0.28} strokeWidth={2} dot={{ fill:GFC, r:3 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats table */}
              <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e2e8f0' }}>
                <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Estatísticas de Temporada</p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                  {[
                    { l:'Gols', k:'gols' }, { l:'Assistências', k:'assistencias' },
                    { l:'xG', k:'xg' }, { l:'Chances criadas', k:'chances_criadas' },
                    { l:'Gols/90', k:'gols_90' }, { l:'xG/90', k:'xg_90' },
                    { l:'Passes%', k:'passes_pct' }, { l:'PP/90', k:'passes_prog_90' },
                    { l:'PK/90', k:'passes_chave_90' }, { l:'Dribles/90', k:'dribles_90' },
                    { l:'Duelos Def%', k:'duelos_def_pct' }, { l:'Int/90', k:'intercecoes_90' },
                  ].filter(m => jogador[m.k] !== undefined).map(m => {
                    const val = parseFloat(jogador[m.k])
                    const pct = calcNativeMetricPct(jogador, m.k, samePosLiga)
                    return (
                      <div key={m.k} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                        <div style={{ fontSize:15, fontWeight:900, color:barColor(pct), marginBottom:2 }}>
                          {formatNativeValue(val,m.k)}
                        </div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginBottom:4 }}>{m.l}</div>
                        <div style={{ height:3, background:'#e2e8f0', borderRadius:99 }}>
                          <div style={{ width:`${Number.isFinite(pct)?pct:0}%`, height:'100%', background:barColor(pct), borderRadius:99 }} />
                        </div>
                        <div style={{ fontSize:9, color:barColor(pct), fontWeight:700, marginTop:2 }}>{Number.isFinite(pct)?`P${pct}`:'Amostra insuficiente'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>)}

          {/* ── TAB: COMPARAÇÃO ──────────────────────────── */}
          {activeTab === 'comparacao' && (<>
            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e2e8f0' }}>
              <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>Vs Jogadores da Liga</p>
              <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>{samePosLiga.length} jogadores · mesmo grupo posicional</p>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarLiga} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} />
                  <Tooltip formatter={(v,n,{payload})=>[`${payload?.formatted??'—'} (${Number.isFinite(payload?.percentile)?`P${payload.percentile}`:'amostra insuficiente'})`,'']} />
                  <Radar dataKey="value" name={jogador.nome} stroke={GFC} fill={GFC} fillOpacity={0.3} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
                {radarKeys.map(k => {
                  const val = Number(jogador[k])
                  const pct = calcNativeMetricPct(jogador, k, samePosLiga)
                  return (
                    <div key={k} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ width:80, fontSize:11, color:'#64748b', fontWeight:600 }}>{METRIC_LABELS[k]||k}</span>
                      <div style={{ flex:1, height:6, background:'#f1f5f9', borderRadius:99 }}>
                        <div style={{ width:`${Number.isFinite(pct)?pct:0}%`, height:'100%', background:barColor(pct), borderRadius:99 }} />
                      </div>
                      <span style={{ width:68, fontSize:10, fontWeight:800, color:barColor(pct), textAlign:'right' }}>{Number.isFinite(pct)?`P${pct}`:'Sem amostra'}</span>
                      <span style={{ width:55, fontSize:10, color:'#94a3b8', textAlign:'right' }}>{formatNativeValue(val,k)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e2e8f0' }}>
              <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>Vs Elenco Confiança</p>
              <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>
                {samePosGuarani.length > 0 ? `${samePosGuarani.length} atletas do Confiança · mesmo grupo posicional` : 'Importe o elenco do Confiança para habilitar esta comparação'}
              </p>
              {samePosGuarani.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarGuarani} cx="50%" cy="50%" outerRadius="75%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize:11, fill:'#475569', fontWeight:600 }} />
                      <Tooltip formatter={(v,n,{payload})=>[`${payload?.formatted??'—'} (${Number.isFinite(payload?.percentile)?`P${payload.percentile}`:'amostra insuficiente'})`,'']} />
                      <Radar dataKey="value" name={jogador.nome} stroke="#6d28d9" fill="#6d28d9" fillOpacity={0.28} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
                    {radarGuarani.map(d => (
                      <div key={d.metric} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ width:80, fontSize:11, color:'#64748b', fontWeight:600 }}>{d.metric}</span>
                        <div style={{ flex:1, height:6, background:'#f1f5f9', borderRadius:99 }}>
                          <div style={{ width:`${Number.isFinite(d.percentile)?d.percentile:0}%`, height:'100%', background:barColor(d.percentile), borderRadius:99 }} />
                        </div>
                        <span style={{ width:68, fontSize:10, fontWeight:800, color:barColor(d.percentile), textAlign:'right' }}>{Number.isFinite(d.percentile)?`P${d.percentile}`:'Sem amostra'}</span>
                        <span style={{ width:55, fontSize:10, color:'#94a3b8', textAlign:'right' }}>{d.formatted}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign:'center', padding:40, border:'2px dashed #e2e8f0', borderRadius:10 }}>
                  <p style={{ fontSize:24, marginBottom:8 }}>👥</p>
                  <p style={{ fontSize:13, fontWeight:700, color:'#475569', marginBottom:6 }}>Elenco não importado</p>
                  <Link href="/elenco" style={{ fontSize:12, color:GFC, fontWeight:700 }}>→ Importar Elenco</Link>
                </div>
              )}
            </div>
          </>)}

          {/* ── TAB: ATRIBUTOS ───────────────────────────── */}
          {activeTab === 'atributos' && (<>
            <div />
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {ATTR_GROUPS.map(grp => {
                const metricsWithVal = grp.keys.filter(k => !isNaN(parseFloat(jogador[k])))
                if (!metricsWithVal.length) return null
                return (
                  <div key={grp.label} style={{ background:'#fff', borderRadius:12, padding:18, border:'1px solid #e2e8f0' }}>
                    <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>{grp.label}</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
                      {metricsWithVal.map(k => {
                        const val = Number(jogador[k])
                        const pct = calcNativeMetricPct(jogador, k, samePosLiga)
                        return (
                          <div key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#f8fafc', borderRadius:8 }}>
                            <div style={{ width:32, height:32, borderRadius:8, background:barColor(pct), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:900, flexShrink:0 }}>
                              {Number.isFinite(pct)?pct:'—'}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:10, color:'#64748b', marginBottom:2 }}>{METRIC_LABELS[k]||k}</div>
                              <div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>{formatNativeValue(val,k)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}

        </div>
      </div>
    </AppShell>
  )
}
