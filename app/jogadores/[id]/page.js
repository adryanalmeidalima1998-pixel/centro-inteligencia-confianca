'use client'
import AppShell from '../../components/layout/AppShell'
import { useState, useEffect, useMemo, use, Suspense } from 'react'
import Link from 'next/link'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

const RADAR_KEYS = {
  'Goleiro':          ['Disputas defensivas ganhas, %','Bolas recuperadas','Interceptações','Desarmes','Passes precisos %'],
  'Zagueiro':         ['Interceptações','Disputas defensivas ganhas, %','Desarmes','Disputas aéreas','Bolas recuperadas','Passes progressivos'],
  'Lateral Direito':  ['Disputas defensivas ganhas, %','Interceptações','Cruzamentos','Passes progressivos','Dribles','Assistências'],
  'Lateral Esquerdo': ['Disputas defensivas ganhas, %','Interceptações','Cruzamentos','Passes progressivos','Dribles','Assistências'],
  'Volante':          ['Bolas recuperadas','Interceptações','Desarmes','Passes progressivos','Passes chave','Disputas defensivas ganhas, %'],
  'Meia Central':     ['Passes chave','Chances criadas','xA','Passes progressivos','Assistências','Dribles'],
  'Extremo Direito':  ['Chances criadas','xA','Gols','Dribles','Assistências','Passes progressivos'],
  'Extremo Esquerdo': ['Chances criadas','xA','Gols','Dribles','Assistências','Passes progressivos'],
  'Centroavante':     ['Gols','Xg','Chances de gol','Chutes','Disputas ofensivas ganhas, %','Assistências'],
  'default':          ['Gols','Assistências','Passes progressivos','Dribles','Interceptações','Xg'],
}

const SCORE_WEIGHTS = {
  'Goleiro':          { 'Disputas defensivas ganhas, %':40,'Bolas recuperadas':20,'Interceptações':20,'Desarmes':20 },
  'Zagueiro':         { 'Interceptações':20,'Disputas defensivas ganhas, %':20,'Desarmes':15,'Disputas aéreas':15,'Bolas recuperadas':15,'Passes progressivos':15 },
  'Lateral Direito':  { 'Disputas defensivas ganhas, %':20,'Interceptações':15,'Cruzamentos':15,'Passes progressivos':15,'Bolas recuperadas':15,'Dribles':20 },
  'Lateral Esquerdo': { 'Disputas defensivas ganhas, %':20,'Interceptações':15,'Cruzamentos':15,'Passes progressivos':15,'Bolas recuperadas':15,'Dribles':20 },
  'Volante':          { 'Bolas recuperadas':20,'Interceptações':20,'Disputas defensivas ganhas, %':15,'Desarmes':15,'Passes progressivos':15,'Passes chave':15 },
  'Meia Central':     { 'Passes chave':20,'Chances criadas':20,'xA':15,'Passes progressivos':15,'Assistências':15,'Dribles':15 },
  'Extremo Direito':  { 'Chances criadas':20,'xA':15,'Gols':15,'Dribles':20,'Assistências':15,'Passes progressivos':15 },
  'Extremo Esquerdo': { 'Chances criadas':20,'xA':15,'Gols':15,'Dribles':20,'Assistências':15,'Passes progressivos':15 },
  'Centroavante':     { 'Gols':25,'Xg':20,'Chances de gol':15,'Chutes':15,'Disputas ofensivas ganhas, %':15,'Assistências':10 },
}

const METRIC_GROUPS = [
  { label:'Contribuição Ofensiva', keys:['Gols','Assistências','Xg','xA','Chutes','Chances criadas','Chances de gol'] },
  { label:'Criação e Passes',      keys:['Passes chave','Passes progressivos','Passa para o terço final','Cruzamentos','Passes precisos %'] },
  { label:'Ações Defensivas',      keys:['Interceptações','Bolas recuperadas','Desarmes','Disputas defensivas ganhas, %','Disputas aéreas'] },
  { label:'Dribles e Duelos',      keys:['Dribles','% de dribles com sucesso','Dribles no último terço do campo','Disputas ofensivas ganhas, %'] },
]

const PERFIL = {
  construtor: ['Passes progressivos','Passes chave','Passa para o terço final','Passes precisos %'],
  ofensivo:   ['Gols','Assistências','Xg','xA','Dribles','Chances criadas'],
  defensivo:  ['Interceptações','Desarmes','Bolas recuperadas','Disputas defensivas ganhas, %'],
}

function calcPct(val, arr) {
  const v = parseFloat(val)
  if (isNaN(v)) return 0
  const nums = arr.map(x => parseFloat(x)).filter(x => !isNaN(x))
  if (!nums.length) return 50
  return Math.round((nums.filter(x => x < v).length / nums.length) * 100)
}

function norm(val, arr) {
  const v = parseFloat(val) || 0
  const nums = [...arr.map(x => parseFloat(x)||0), v]
  const mn = Math.min(...nums), mx = Math.max(...nums)
  if (mx === mn) return 50
  return Math.max(0, Math.min(100, Math.round(((v-mn)/(mx-mn))*100)))
}

function avgArr(arr, key) {
  const vals = arr.map(p => parseFloat(p[key])||0).filter(v => v > 0)
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
}

function getTier(pct) {
  if (pct >= 95) return { tier:'S', cls:'bg-amber-100 text-amber-700 border-amber-200' }
  if (pct >= 80) return { tier:'A', cls:'bg-green-100 text-[#0a66b7] border-green-200' }
  if (pct >= 50) return { tier:'B', cls:'bg-blue-50 text-blue-600 border-blue-100' }
  if (pct >= 20) return { tier:'C', cls:'bg-orange-50 text-orange-600 border-orange-100' }
  return { tier:'D', cls:'bg-slate-100 text-slate-500 border-slate-200' }
}

function sim(a, b, pos) {
  const w = SCORE_WEIGHTS[pos]; if (!w) return 0
  let sum = 0, cnt = 0
  for (const k of Object.keys(w)) {
    const va = parseFloat(a[k]), vb = parseFloat(b[k])
    if (isNaN(va)||isNaN(vb)) continue
    sum += Math.pow(va-vb, 2); cnt++
  }
  return cnt > 0 ? -Math.sqrt(sum/cnt) : -Infinity
}

function RadarCard({ title, subtitle, data, colorA, colorB, labelA, labelB }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1">
      <div className="px-5 py-3 border-b border-slate-50">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:colorA}}/><span className="text-[10px] text-slate-500 font-medium">{labelA}</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:colorB}}/><span className="text-[10px] text-slate-500 font-medium">{labelB}</span></div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data}>
          <PolarGrid stroke="#f1f5f9"/>
          <PolarAngleAxis dataKey="metric" tick={{fontSize:9, fill:'#94a3b8', fontWeight:600}}/>
          <Radar dataKey="A" stroke={colorA} fill={colorA} fillOpacity={0.18} strokeWidth={2}/>
          <Radar dataKey="B" stroke={colorB} fill={colorB} fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 2"/>
          <Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',fontSize:'10px'}}
            formatter={(v, name) => [`${v}/100`, name === 'A' ? labelA : labelB]}/>
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function JogadorPage({ params }) {
  const resolvedParams = use(params)
  const nome = decodeURIComponent(resolvedParams.id || '')
  const [player, setPlayer] = useState(null)
  const [allMkt, setAllMkt] = useState([])
  const [allElenco, setAllElenco] = useState([])
  const [loading, setLoading] = useState(true)
  const [addedList, setAddedList] = useState(false)
  const [prio, setPrio] = useState('Média')

  useEffect(() => {
    Promise.all([
      fetch('/api/players?section=mercado&limit=10000').then(r=>r.json()),
      fetch('/api/players?section=elenco').then(r=>r.json()),
    ]).then(([mkt, elc]) => {
      const mp = mkt.players||[], ep = elc.players||[]
      setAllMkt(mp); setAllElenco(ep)
      const found = [...mp,...ep].find(p => p['Jogador'] === nome)
      setPlayer(found||null)
      setLoading(false)
    })
  }, [nome])

  const pos = player?.['_posicao_label'] || player?.['Posição'] || ''
  const radarKeys = RADAR_KEYS[pos] || RADAR_KEYS['default']
  const sameMkt = useMemo(() => allMkt.filter(p => (p['_posicao_label']||'') === pos && p['Jogador'] !== nome), [allMkt, pos, nome])
  const sameElenco = useMemo(() => allElenco.filter(p => (p['Posição']||'') === pos && p['Jogador'] !== nome), [allElenco, pos, nome])

  const tierInfo = useMemo(() => {
    if (!player) return getTier(50)
    const myI = parseFloat(player['Index']||0)
    const allI = allMkt.map(p=>parseFloat(p['Index']||0))
    return getTier(calcPct(myI, allI))
  }, [player, allMkt])

  const makeRadar = (bench) => radarKeys.map(k => ({
    metric: k.length > 14 ? k.slice(0,14)+'…' : k,
    A: norm(player?.[k], [...bench.map(p=>parseFloat(p[k])||0), parseFloat(player?.[k])||0]),
    B: norm(avgArr(bench, k), [...bench.map(p=>parseFloat(p[k])||0), parseFloat(player?.[k])||0]),
  }))

  const r1 = useMemo(() => player && sameMkt.length ? makeRadar(sameMkt) : [], [player, sameMkt])
  const r2 = useMemo(() => player && sameElenco.length ? makeRadar(sameElenco) : [], [player, sameElenco])
  const r3 = useMemo(() => {
    if (!player) return []
    const all = [...allMkt,...allElenco].filter(p=>(p['_posicao_label']||p['Posição']||'')===pos && p['Jogador']!==nome)
    return all.length ? makeRadar(all) : []
  }, [player, allMkt, allElenco, pos, nome])

  const perfil = useMemo(() => {
    if (!player) return { construtor:0, ofensivo:0, defensivo:0 }
    const all = [...allMkt,...allElenco]
    const calc = (keys) => {
      let s=0, c=0
      for (const k of keys) {
        const v=parseFloat(player[k]); if(isNaN(v)) continue
        s += calcPct(v, all.map(p=>parseFloat(p[k])))
        c++
      }
      return c>0 ? Math.round(s/c) : 0
    }
    return { construtor: calc(PERFIL.construtor), ofensivo: calc(PERFIL.ofensivo), defensivo: calc(PERFIL.defensivo) }
  }, [player, allMkt, allElenco])

  // Média da posição no mercado (benchmark Série C)
  const avgMkt = useMemo(() => {
    const res = {}
    if (!player) return res
    const keys = Object.keys(player).filter(k => !k.startsWith('_'))
    for (const k of keys) {
      const vals = sameMkt.map(p => parseFloat(p[k])||0).filter(v=>v>0)
      res[k] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
    }
    return res
  }, [player, sameMkt])

  const similares = useMemo(() =>
    sameMkt.map(p=>({...p, _s: sim(player||{}, p, pos)})).sort((a,b)=>b._s-a._s).slice(0,5),
  [player, sameMkt, pos])

  async function addToList() {
    if (!player) return
    await fetch('/api/lista-preferencial', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ jogador:player['Jogador'], clube:player['Time'], posicao:pos, prioridade:prio, idade:parseInt(player['Idade']||0)||null }),
    })
    setAddedList(true)
  }

  if (loading) return (
    <AppShell><div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-2 border-slate-100 border-t-[#0a66b7] rounded-full animate-spin"/>
    </div></AppShell>
  )

  if (!player) return (
    <AppShell><div className="p-6"><Link href="/database" className="text-sm font-semibold text-[#0a66b7] hover:text-[#07579e] flex items-center gap-1 mb-4">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M15 18l-6-6 6-6"/></svg>Voltar
    </Link>
    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
      <p className="text-xl font-bold text-slate-400">Atleta não encontrado</p>
    </div></div></AppShell>
  )

  const index = parseFloat(player['Index']||0)
  const minutos = parseInt(player['Minutos jogados']||0)
  const insuffSample = minutos < 450

  return (
    <AppShell>
      <div className="p-6 max-w-[1100px] mx-auto">

        {/* BREADCRUMB */}
        <Link href="/database" className="text-xs font-semibold text-[#0a66b7] hover:text-[#07579e] flex items-center gap-1 mb-5 w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M15 18l-6-6 6-6"/></svg>
          Voltar à Base de Atletas
        </Link>

        {/* HEADER */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
          <div className="p-6">
            <div className="flex items-start gap-5 flex-wrap">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0a66b7] to-[#1597d4] flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
                {(player['Jogador']||'?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h1 className="bc text-3xl font-black uppercase text-slate-900">{player['Jogador']}</h1>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${tierInfo.cls}`}>{tierInfo.tier}</span>
                  {insuffSample && <span className="text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded-lg">Amostra insuficiente (&lt;450min)</span>}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-sm text-slate-500">
                  <span className="font-semibold text-slate-800">{player['Time']||'—'}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-bold text-[#0a66b7] uppercase text-xs">{pos||'—'}</span>
                  {player['Idade'] && <span>{player['Idade']} anos</span>}
                  {player['Altura'] && <span>{player['Altura']}cm</span>}
                  {player['Pé'] && <span>Pé {player['Pé']}</span>}
                  {player['Nacionalidade'] && <span>🌍 {player['Nacionalidade']}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Índice Wyscout</p>
                <p className="bc text-5xl font-black text-[#0a66b7]">{index.toFixed(0)}</p>
              </div>
            </div>

            {/* Stats bar */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                ['Valor', player['Valor de mercado']||'—'],
                ['Contrato', player['Contrato expira em'] ? new Date(player['Contrato expira em']).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}) : '—'],
                ['Partidas', player['Partidas jogadas']||'—'],
                ['Minutos', minutos ? minutos.toLocaleString('pt-BR') : '—'],
                ['Temporada', player['Temporada']||'2026'],
              ].map(([l,v]) => (
                <div key={l}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{l}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3 flex-wrap">
              <select value={prio} onChange={e=>setPrio(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a66b7]">
                <option>Alta</option><option>Média</option><option>Baixa</option>
              </select>
              <button onClick={addToList} disabled={addedList}
                className={`px-5 py-2 text-xs font-bold uppercase rounded-xl transition-all flex items-center gap-2
                  ${addedList ? 'bg-green-100 border border-green-200 text-[#0a66b7]' : 'bg-[#0a66b7] hover:bg-[#07579e] text-white shadow-sm'}`}>
                {addedList ? '✓ Adicionado' : '⭐ Lista Preferencial'}
              </button>
              <Link href={`/comparacao?a=${encodeURIComponent(player['Jogador'])}`}
                className="px-5 py-2 text-xs font-bold uppercase bg-white border border-slate-200 hover:border-[#0a66b7] text-slate-700 rounded-xl transition-all">
                📊 Comparar
              </Link>
            </div>
          </div>
        </div>

        {/* 3 RADARES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {r1.length > 0 && (
            <RadarCard title="vs. Base de Mercado" subtitle={`${sameMkt.length} atletas mesma posição`}
              data={r1} colorA="#0a66b7" colorB="#94a3b8" labelA={player['Jogador']} labelB="Média posição"/>
          )}
          {r2.length > 0 && (
            <RadarCard title="vs. Elenco Confiança" subtitle="Comparado com plantel atual"
              data={r2} colorA="#0a66b7" colorB="#f59e0b" labelA={player['Jogador']} labelB="Média Confiança"/>
          )}
          {r3.length > 0 && (
            <RadarCard title="vs. Base Completa" subtitle="Todos os atletas monitorados"
              data={r3} colorA="#0a66b7" colorB="#3b82f6" labelA={player['Jogador']} labelB="Média geral"/>
          )}
        </div>

        {/* PERFIL TÁTICO */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="text-sm font-bold text-slate-800">Perfil Tático</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Percentil em relação à base de {allMkt.length.toLocaleString('pt-BR')} atletas</p>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label:'Perfil Construtor', value:perfil.construtor, color:'#0a66b7', desc:'Passes, progressão, saída de bola' },
              { label:'Perfil Ofensivo', value:perfil.ofensivo, color:'#f59e0b', desc:'Gols, xG, dribles, criação' },
              { label:'Perfil Defensivo', value:perfil.defensivo, color:'#3b82f6', desc:'Recuperações, desarmes, interceptações' },
            ].map(({label, value, color, desc}) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-40 flex-shrink-0">
                  <p className="text-xs font-semibold text-slate-700">{label}</p>
                  <p className="text-[10px] text-slate-400">{desc}</p>
                </div>
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{width:`${value}%`, background:color}}/>
                </div>
                <span className="text-sm font-black text-slate-800 w-10 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TABELA DE PERCENTIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {METRIC_GROUPS.map(group => {
            const available = group.keys.filter(k => {
              const v = parseFloat(player[k])
              return !isNaN(v) && v !== 0
            })
            if (!available.length) return null
            return (
              <div key={group.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-50">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{group.label}</p>
                </div>
                <div className="p-4 space-y-2.5">
                  {available.map(k => {
                    const val = parseFloat(player[k])
                    const pct = calcPct(val, sameMkt.map(p => parseFloat(p[k])))
                    const hi = pct >= 80, lo = pct < 20
                    return (
                      <div key={k} className="grid grid-cols-[1fr_110px_40px_18px] gap-2 items-center">
                        <span className="text-[11px] text-slate-600 truncate">{k}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${hi ? 'bg-[#0a66b7]' : lo ? 'bg-red-400' : 'bg-blue-400'}`} style={{width:`${pct}%`}}/>
                          </div>
                          <span className={`text-[10px] font-bold w-7 text-right ${hi ? 'text-[#0a66b7]' : lo ? 'text-red-500' : 'text-slate-500'}`}>{pct}p</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-700 text-right">{val.toFixed(2)}</span>
                        <span
                          className={`text-sm font-black leading-none ${val > (avgMkt[k]||0) ? 'text-[#0a66b7]' : 'text-red-400'}`}
                          title={`Média posição: ${(avgMkt[k]||0).toFixed(2)}`}>
                          {val > (avgMkt[k]||0) ? '↑' : '↓'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* SIMILARES */}
        {similares.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <p className="text-sm font-bold text-slate-800">Atletas Similares</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Mesma posição · perfil mais próximo por métricas-chave</p>
            </div>
            <div className="divide-y divide-slate-50">
              {similares.map((s, i) => (
                <Link key={i} href={`/jogadores/${encodeURIComponent(s['Jogador'])}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-[#f0fdf4] transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0a66b7] to-[#1597d4] flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                    {(s['Jogador']||'?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-[#0a66b7] transition-colors truncate">{s['Jogador']}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s['Time']} · {s['Idade'] ? `${s['Idade']} anos` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-black text-[#0a66b7]">{parseFloat(s['Index']||0).toFixed(0)}</p>
                      <p className="text-[9px] text-slate-400">index</p>
                    </div>
                    {s['Valor de mercado'] && s['Valor de mercado'] !== '-' && (
                      <span className="text-[10px] text-slate-400">{s['Valor de mercado']}</span>
                    )}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-300 group-hover:text-[#0a66b7]"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default function JogadorPageWrapper({ params }) {
  return (
    <Suspense fallback={<AppShell><div className="flex items-center justify-center h-screen"><div className="w-10 h-10 border-2 border-slate-100 border-t-[#0a66b7] rounded-full animate-spin"/></div></AppShell>}>
      <JogadorPage params={params}/>
    </Suspense>
  )
}
