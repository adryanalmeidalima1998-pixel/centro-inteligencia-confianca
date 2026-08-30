'use client'
import AppShell from '../../components/layout/AppShell'
import { useState, useEffect, useMemo, use, Suspense } from 'react'
import Link from 'next/link'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const RADAR_KEYS = {
  Goleiro:  ['Chutes do adv. no gol','Defesas, %','Passes precisos %','Bolas recuperadas','Interceptações'],
  Zagueiro: ['Interceptações','Disputas defensivas ganhas, %','Desarmes','Disputas aéreas','Passes progressivos','Bolas recuperadas'],
  Lateral:  ['Disputas defensivas ganhas, %','Interceptações','Cruzamentos','Passes progressivos','Dribles'],
  Volante:  ['Bolas recuperadas','Interceptações','Desarmes','Passes progressivos','Passes chave'],
  Meia:     ['Passes chave','Chances criadas','Passes progressivos','Assistências','Dribles'],
  Extremo:  ['Chances criadas','Gols','Dribles','Assistências','Passes progressivos'],
  Atacante: ['Gols','Xg','Chances de gol','Chutes','Assistências'],
  default:  ['Gols','Assistências','Passes progressivos','Dribles','Interceptações'],
}

const METRIC_GROUPS = [
  { label:'Contribuição Ofensiva', keys:['Gols','Assistências','Xg','xA','Chutes','Chances criadas'] },
  { label:'Criação e Passes',      keys:['Passes chave','Passes progressivos','Cruzamentos','Passes precisos %'] },
  { label:'Ações Defensivas',      keys:['Interceptações','Bolas recuperadas','Desarmes','Disputas defensivas ganhas, %'] },
  { label:'Dribles e Duelos',      keys:['Dribles','% de dribles com sucesso','Disputas aéreas','Disputas ofensivas ganhas, %'] },
]

function getPosGroup(pos) {
  if (!pos) return 'default'
  const p = String(pos).toUpperCase()
  if (p.includes('GK'))                              return 'Goleiro'
  if (p.includes('CB')||p.includes('RCD')||p.includes('LCD')) return 'Zagueiro'
  if (p.includes('RD')||p.includes('LD'))            return 'Lateral'
  if (p.includes('CDM')||p.includes('RCDM')||p.includes('LCDM')) return 'Volante'
  if (p.includes('CAM')||p.includes('CM'))           return 'Meia'
  if (p.includes('RAM')||p.includes('LAM')||p.includes('RMF')||p.includes('LMF')) return 'Extremo'
  if (p.includes('CF')||p.includes('RCF')||p.includes('LCF')||p.includes('ST'))   return 'Atacante'
  return 'default'
}

function norm(val, arr) {
  const v = parseFloat(val)||0
  const nums = [...arr.map(x=>parseFloat(x)||0), v].filter(x=>!isNaN(x))
  const mn = Math.min(...nums), mx = Math.max(...nums)
  if (mx===mn) return 50
  return Math.max(0, Math.min(100, Math.round(((v-mn)/(mx-mn))*100)))
}

function calcPct(val, arr) {
  const v = parseFloat(val); if(isNaN(v)) return 0
  const nums = arr.map(x=>parseFloat(x)).filter(x=>!isNaN(x))
  return nums.length ? Math.round((nums.filter(x=>x<v).length/nums.length)*100) : 50
}

function avg(arr, key) {
  const vals = arr.map(p=>parseFloat(p[key])||0).filter(v=>v>0)
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
}

// Custom Tooltip para radar com 3 camadas
const RadarTip3 = ({ active, payload, nomeAtleta }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2">{payload[0]?.payload?.metric}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }}/>
            <span className="text-slate-500">{entry.name === 'Atleta' ? nomeAtleta : entry.name}</span>
          </div>
          <span className="font-bold text-slate-800">{entry.value}/100</span>
        </div>
      ))}
    </div>
  )
}

function ElencoAtletaPage({ params }) {
  const resolved = use(params)
  const nome = decodeURIComponent(resolved.id || '')
  const [player,  setPlayer]  = useState(null)
  const [elenco,  setElenco]  = useState([])
  const [mercado, setMercado] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/players?section=elenco').then(r=>r.json()),
      fetch('/api/players?section=mercado&limit=10000').then(r=>r.json()),
    ]).then(([el, mkt]) => {
      const ep = el.players||[], mp = mkt.players||[]
      setElenco(ep); setMercado(mp)
      setPlayer(ep.find(p=>p['Jogador']===nome)||null)
      setLoading(false)
    })
  }, [nome])

  const posGroup      = getPosGroup(player?.['Posição'])
  const radarKeys     = RADAR_KEYS[posGroup] || RADAR_KEYS['default']
  const samePosElenco = useMemo(() => elenco.filter(p=>getPosGroup(p['Posição'])===posGroup && p['Jogador']!==nome), [elenco,posGroup,nome])
  const samePosMkt    = useMemo(() => mercado.filter(p=>(p['_posicao_label']||'')===posGroup && p['Jogador']!==nome),  [mercado,posGroup,nome])

  // ─── RADAR 3 CAMADAS ────────────────────────────────────────────────
  // Todos os valores juntos para normalização consistente
  const radarData3 = useMemo(() => {
    if (!player) return []
    const allVals = [...samePosElenco, ...samePosMkt, player]
    return radarKeys.map(k => {
      const allNums = allVals.map(p=>parseFloat(p[k])||0)
      return {
        metric:       k.length > 14 ? k.slice(0,13)+'…' : k,
        Atleta:       norm(player[k], allNums),
        'Elenco':     norm(avg(samePosElenco, k), allNums),
        'Série C':    norm(avg(samePosMkt, k), allNums),
      }
    })
  }, [player, samePosElenco, samePosMkt, radarKeys])

  // ─── PERCENTIS ──────────────────────────────────────────────────────
  const allRef = useMemo(() => [...samePosElenco, ...samePosMkt], [samePosElenco, samePosMkt])
  const serieAvg = useMemo(() => {
    const res = {}
    for (const k of Object.keys(player||{})) res[k] = avg(samePosMkt, k)
    return res
  }, [player, samePosMkt])

  if (loading) return (
    <AppShell><div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-2 border-slate-100 border-t-[#0a66b7] rounded-full animate-spin"/>
    </div></AppShell>
  )
  if (!player) return (
    <AppShell><div className="p-6">
      <Link href="/elenco" className="text-xs font-semibold text-[#0a66b7] flex items-center gap-1 mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M15 18l-6-6 6-6"/></svg>Elenco
      </Link>
      <p className="text-slate-500">Atleta não encontrado.</p>
    </div></AppShell>
  )

  const index    = parseFloat(player['Index']||0)
  const minutos  = parseInt(player['Minutos jogados']||0)
  const insuf    = minutos < 450

  return (
    <AppShell>
      <div className="p-6 max-w-[1100px] mx-auto">
        <Link href="/elenco" className="text-xs font-semibold text-[#0a66b7] hover:text-[#07579e] flex items-center gap-1 mb-5 w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M15 18l-6-6 6-6"/></svg>
          Voltar ao Elenco
        </Link>

        {/* HEADER */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0a66b7] to-[#1597d4] flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
              {(player['Jogador']||'?')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="bc text-3xl font-black uppercase text-slate-900">{player['Jogador']}</h1>
              <div className="flex items-center gap-3 flex-wrap text-sm text-slate-500 mt-1">
                <span className="font-bold bg-[#0a66b7] text-white text-xs px-2.5 py-0.5 rounded-md">Confiança</span>
                <span className="font-bold text-[#0a66b7] uppercase text-xs">{player['Posição']}</span>
                {player['Idade'] && <span>{player['Idade']} anos</span>}
                {player['Altura'] && <span>{player['Altura']}cm</span>}
                {player['Peso']   && <span>{player['Peso']}kg</span>}
                {player['Nacionalidade'] && <span>🌍 {player['Nacionalidade']}</span>}
              </div>
              {insuf && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-700 w-fit">
                  ⚠ Menos de 450 minutos — métricas podem não ser representativas
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Índice Wyscout</p>
              <p className="bc text-5xl font-black text-[#0a66b7]">{index.toFixed(0)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['Minutos',minutos?minutos.toLocaleString('pt-BR'):'—'],['Partidas',player['Partidas jogadas']||'—'],['Altura',player['Altura']?`${player['Altura']}cm`:'—'],['Peso',player['Peso']?`${player['Peso']}kg`:'—']].map(([l,v])=>(
              <div key={l}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{l}</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── RADAR 3 CAMADAS ─── */}
        {radarData3.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-slate-50">
              <p className="text-sm font-bold text-slate-800">Radar de Desempenho — 3 camadas</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Normalizado vs {samePosElenco.length} do elenco + {samePosMkt.length} atletas da base · posição: {posGroup}
              </p>
              {/* Legenda manual */}
              <div className="flex gap-5 mt-3">
                {[
                  { key:'Atleta',   color:'#0a66b7', dash:false,  label:player['Jogador'] },
                  { key:'Elenco',   color:'#f59e0b', dash:true,   label:'Média Elenco (posição)' },
                  { key:'Série C',  color:'#3b82f6', dash:true,   label:'Média Série C (posição)' },
                ].map(({color,dash,label})=>(
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      <div className="h-0.5 w-3" style={{background:color, opacity: dash?0.7:1}}/>
                      {dash && <><div className="h-0.5 w-1 bg-white"/><div className="h-0.5 w-2" style={{background:color}}/></>}
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full" style={{background:color}}/>
                    <span className="text-[10px] text-slate-500 font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <RadarChart data={radarData3} margin={{top:20,right:30,bottom:20,left:30}}>
                <PolarGrid stroke="#f1f5f9"/>
                <PolarAngleAxis dataKey="metric" tick={{fontSize:10,fill:'#94a3b8',fontWeight:600}}/>
                {/* Camada 1 — Atleta */}
                <Radar name="Atleta"  dataKey="Atleta"
                  stroke="#0a66b7" fill="#0a66b7" fillOpacity={0.20} strokeWidth={2.5}/>
                {/* Camada 2 — Média Elenco */}
                <Radar name="Elenco"  dataKey="Elenco"
                  stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.07} strokeWidth={1.5} strokeDasharray="5 3"/>
                {/* Camada 3 — Média Série C */}
                <Radar name="Série C" dataKey="Série C"
                  stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} strokeWidth={1.5} strokeDasharray="2 3"/>
                <Tooltip content={<RadarTip3 nomeAtleta={player['Jogador']}/>}/>
              </RadarChart>
            </ResponsiveContainer>
            {/* Interpretação rápida */}
            <div className="px-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {radarData3.slice(0,3).map(d => {
                  const acimaElenco  = d['Atleta'] > d['Elenco']
                  const acimaSerieC  = d['Atleta'] > d['Série C']
                  return (
                    <div key={d.metric} className={`rounded-xl p-3 border ${acimaElenco&&acimaSerieC?'bg-green-50 border-green-200':acimaElenco||acimaSerieC?'bg-amber-50 border-amber-200':'bg-slate-50 border-slate-200'}`}>
                      <p className="text-[10px] font-bold text-slate-600 truncate">{d.metric}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className={acimaElenco?'text-[#0a66b7] font-bold':'text-slate-400'}>
                          {acimaElenco?'↑':'↓'} Elenco
                        </span>
                        <span className={acimaSerieC?'text-blue-600 font-bold':'text-slate-400'}>
                          {acimaSerieC?'↑':'↓'} Série C
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── PERCENTIS COM SETAS ↑↓ ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {METRIC_GROUPS.map(group => {
            const available = group.keys.filter(k => {
              const v = parseFloat(player[k]); return !isNaN(v) && v !== 0
            })
            if (!available.length) return null
            return (
              <div key={group.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-50">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{group.label}</p>
                </div>
                <div className="p-4 space-y-2.5">
                  {available.map(k => {
                    const val   = parseFloat(player[k])
                    const pct   = calcPct(val, allRef.map(p=>parseFloat(p[k])))
                    const sAvg  = serieAvg[k] || 0
                    const acima = val > sAvg
                    const hi = pct >= 80, lo = pct < 20
                    return (
                      <div key={k} className="grid grid-cols-[1fr_110px_36px_20px] gap-2 items-center">
                        <span className="text-[11px] text-slate-600 truncate">{k}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${hi?'bg-[#0a66b7]':lo?'bg-red-400':'bg-blue-400'}`} style={{width:`${pct}%`}}/>
                          </div>
                          <span className={`text-[10px] font-bold w-7 text-right ${hi?'text-[#0a66b7]':lo?'text-red-500':'text-slate-500'}`}>{pct}p</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-700 text-right">{val.toFixed(2)}</span>
                        <span className={`text-sm font-black ${acima?'text-[#0a66b7]':'text-red-400'}`} title={`Série C: ${sAvg.toFixed(2)}`}>
                          {acima ? '↑' : '↓'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}

export default function ElencoAtletaWrapper({ params }) {
  return (
    <Suspense fallback={
      <AppShell><div className="flex items-center justify-center h-screen">
        <div className="w-10 h-10 border-2 border-slate-100 border-t-[#0a66b7] rounded-full animate-spin"/>
      </div></AppShell>
    }>
      <ElencoAtletaPage params={params}/>
    </Suspense>
  )
}
