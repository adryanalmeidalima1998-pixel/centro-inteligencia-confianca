'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../components/layout/AppShell'

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
  .card-hover { transition: all 0.2s ease; }
  .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -12px rgba(11,124,61,0.25); }
  .pulse-dot { animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
`

const num = v => parseFloat(v) || 0

export default function FisiologiaHome() {
  const router = useRouter()
  const [sessions, setSessions] = useState([])
  const [loadingGps, setLoadingGps] = useState(true)
  const [hoje, setHoje] = useState('')

  useEffect(() => {
    setHoje(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))
    fetch('/api/gps')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoadingGps(false) })
      .catch(() => setLoadingGps(false))
  }, [])

  const lastSession = sessions[0] || null
  const lastRows = lastSession?.rows?.rows || []
  const avgDist = lastRows.length ? lastRows.reduce((s, r) => s + num(r.totalDistance), 0) / lastRows.length : 0
  const avgSprint = lastRows.length ? lastRows.reduce((s, r) => s + num(r.dist25), 0) / lastRows.length : 0
  const maxVel = lastRows.length ? Math.max(...lastRows.map(r => num(r.maxVel))) : 0
  const avgAccel = lastRows.length ? lastRows.reduce((s, r) => s + num(r.accel), 0) / lastRows.length : 0
  const topPlayer = lastRows.length ? [...lastRows].sort((a, b) => num(b.totalDistance) - num(a.totalDistance))[0] : null

  const now = new Date()
  const last7 = sessions.filter(s => {
    if (!s.data_sessao) return false
    return (now - new Date(s.data_sessao + 'T12:00:00')) / 86400000 <= 7
  })

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm min-h-screen bg-gray-50">

        {/* HERO */}
        <div className="px-8 py-10 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0B7C3D 0%, #064d27 100%)' }}>
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10 bg-white" />
          <div className="absolute right-32 bottom-0 w-40 h-40 rounded-full opacity-5 bg-white" />
          <div className="relative max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="pulse-dot w-2 h-2 rounded-full bg-sky-300" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-sky-200">{hoje}</p>
            </div>
            <h1 className="bc text-5xl font-black uppercase text-white leading-none mb-1">FISIOLOGIA</h1>
            <p className="text-sky-200 text-sm">Confiança · Preparação Física · Temporada 2026</p>
            <div className="flex gap-4 mt-6 flex-wrap">
              {[
                { icon: '📊', label: 'Total Sessões GPS', val: sessions.length },
                { icon: '📅', label: 'Últimos 7 dias', val: last7.length },
                { icon: '👥', label: 'Atletas na última sessão', val: lastRows.length },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-[8px] text-sky-200 font-black uppercase tracking-widest">{item.label}</p>
                    <p className="bc text-2xl font-black text-white leading-none">{item.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-8 py-8">
          <p className="bc text-[9px] font-black uppercase tracking-[0.35em] text-gray-400 mb-5">Módulos de Análise</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

            {/* GPS CARD */}
            <div onClick={() => router.push('/fisiologia/gps')}
              className="card-hover cursor-pointer bg-white rounded-3xl overflow-hidden border border-sky-100"
              style={{ boxShadow: '0 4px 20px -4px rgba(11,124,61,0.12)' }}>
              <div className="px-6 py-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0B7C3D 0%, #0a66b7 100%)' }}>
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 bg-white" />
                <div className="flex items-center justify-between relative">
                  <div>
                    <p className="bc text-[9px] font-black uppercase tracking-[0.4em] text-sky-200 mb-0.5">GPS · Catapult</p>
                    <h2 className="bc text-3xl font-black uppercase text-white leading-none">GPS CATAPULT</h2>
                    <p className="text-sky-200 text-[10px] mt-1">Sessões · Metas · Acumulado · Destaques</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">📡</div>
                </div>
              </div>
              <div className="px-6 py-5">
                {loadingGps ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-6 rounded-lg bg-sky-50 animate-pulse" />)}</div>
                ) : lastSession ? (
                  <>
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-3">Última · {lastSession.titulo}</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {[
                        { label: 'Méd. Distância', val: avgDist >= 1000 ? `${(avgDist/1000).toFixed(2)}` : Math.round(avgDist), unit: avgDist >= 1000 ? 'km' : 'm', color: '#0B7C3D' },
                        { label: 'Méd. Sprint', val: avgSprint >= 1000 ? `${(avgSprint/1000).toFixed(2)}` : Math.round(avgSprint), unit: avgSprint >= 1000 ? 'km' : 'm', color: '#0a66b7' },
                        { label: 'Vel. Máxima', val: maxVel.toFixed(1), unit: 'km/h', color: '#f97316' },
                        { label: 'Méd. Acelerações', val: avgAccel.toFixed(1), unit: '', color: '#a855f7' },
                      ].map(s => (
                        <div key={s.label} className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{s.label}</span>
                          <span className="bc text-xl font-black leading-none" style={{ color: s.color }}>
                            {s.val}<span className="text-[10px] ml-0.5 font-bold text-gray-400">{s.unit}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    {topPlayer && (
                      <div className="flex items-center gap-3 bg-sky-50 rounded-xl px-3 py-2.5 border border-sky-100">
                        <span className="text-lg">🏆</span>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-sky-600">Top Distância</p>
                          <p className="text-[11px] font-bold text-sky-900">{topPlayer.playerName} — {num(topPlayer.totalDistance) >= 1000 ? `${(num(topPlayer.totalDistance)/1000).toFixed(2)} km` : `${Math.round(num(topPlayer.totalDistance))} m`}</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
                      {sessions.slice(0, 4).map(s => (
                        <span key={s.id} className="text-[8px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-100">
                          {s.tipo_sessao === 'Jogo' ? '⚽' : '🏃'} {s.data_sessao ? new Date(s.data_sessao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-3xl mb-2">📂</p>
                    <p className="text-[11px] font-bold text-gray-400">Nenhuma sessão importada</p>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-end gap-1.5 text-sky-600">
                  <p className="text-[9px] font-black uppercase tracking-widest">Acessar módulo</p>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </div>

            {/* BEM-ESTAR CARD */}
            <div onClick={() => router.push('/fisiologia/bem-estar')}
              className="card-hover cursor-pointer bg-white rounded-3xl overflow-hidden border border-blue-100"
              style={{ boxShadow: '0 4px 20px -4px rgba(30,58,138,0.12)' }}>
              <div className="px-6 py-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}>
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 bg-white" />
                <div className="flex items-center justify-between relative">
                  <div>
                    <p className="bc text-[9px] font-black uppercase tracking-[0.4em] text-blue-200 mb-0.5">Pré · Pós-Treino</p>
                    <h2 className="bc text-3xl font-black uppercase text-white leading-none">BEM-ESTAR</h2>
                    <p className="text-blue-200 text-[10px] mt-1">Monitoramento diário dos atletas</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">💚</div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-4">Indicadores monitorados</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { icon: '😴', label: 'Qualidade do Sono', cls: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
                    { icon: '⚡', label: 'Nível de Fadiga', cls: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
                    { icon: '🦵', label: 'Dores Musculares', cls: 'bg-red-50 border-red-100 text-red-700' },
                    { icon: '🧠', label: 'Estresse Mental', cls: 'bg-purple-50 border-purple-100 text-purple-700' },
                    { icon: '😊', label: 'Humor / Disposição', cls: 'bg-sky-50 border-sky-100 text-sky-700' },
                    { icon: '🏋️', label: 'PSE Pós-Treino', cls: 'bg-orange-50 border-orange-100 text-orange-700' },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${item.cls}`}>
                      <span className="text-base">{item.icon}</span>
                      <p className="text-[9px] font-bold leading-tight">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-1.5 text-blue-600">
                  <p className="text-[9px] font-black uppercase tracking-widest">Acessar módulo</p>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </div>

            {/* MATURAÇÃO / PVC CARD */}
            <div onClick={() => router.push('/fisiologia/maturacao')}
              className="card-hover cursor-pointer bg-white rounded-3xl overflow-hidden border border-sky-100"
              style={{ boxShadow: '0 4px 20px -4px rgba(11,124,61,0.12)' }}>
              <div className="px-6 py-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0B7C3D 0%, #07579e 100%)' }}>
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 bg-white" />
                <div className="flex items-center justify-between relative">
                  <div>
                    <p className="bc text-[9px] font-black uppercase tracking-[0.4em] text-sky-200 mb-0.5">Base · Ciência do Esporte</p>
                    <h2 className="bc text-3xl font-black uppercase text-white leading-none">MATURAÇÃO / PVC</h2>
                    <p className="text-sky-200 text-[10px] mt-1">Pico de Velocidade de Crescimento · Maturity Offset</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">📈</div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-4">O que o módulo calcula</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { icon: '🎂', label: 'Idade decimal', cls: 'bg-sky-50 border-sky-100 text-sky-700' },
                    { icon: '📏', label: 'Altura sentado real', cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                    { icon: '🦵', label: 'Comprimento das pernas', cls: 'bg-teal-50 border-teal-100 text-teal-700' },
                    { icon: '📊', label: 'DPVC / Maturity Offset', cls: 'bg-lime-50 border-lime-100 text-lime-700' },
                    { icon: '🌱', label: 'Estado maturacional', cls: 'bg-blue-50 border-blue-100 text-blue-700' },
                    { icon: '⏱️', label: 'Timing maturacional', cls: 'bg-violet-50 border-violet-100 text-violet-700' },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${item.cls}`}>
                      <span className="text-base">{item.icon}</span>
                      <p className="text-[9px] font-bold leading-tight">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-100">📄 Relatório individual em PDF</span>
                  <div className="flex items-center gap-1.5 text-sky-600">
                    <p className="text-[9px] font-black uppercase tracking-widest">Acessar módulo</p>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SESSÕES RECENTES */}
          {sessions.length > 0 && (
            <div>
              <p className="bc text-[9px] font-black uppercase tracking-[0.35em] text-gray-400 mb-4">Sessões Recentes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessions.slice(0, 6).map(s => {
                  const rows = s.rows?.rows || []
                  const avgD = rows.length ? rows.reduce((acc, r) => acc + num(r.totalDistance), 0) / rows.length : 0
                  const date = s.data_sessao ? new Date(s.data_sessao + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'
                  return (
                    <div key={s.id} onClick={() => router.push('/fisiologia/gps')}
                      className="cursor-pointer bg-white rounded-2xl border border-gray-100 p-4 hover:border-sky-200 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xl">{s.tipo_sessao === 'Jogo' ? '⚽' : '🏃'}</span>
                        <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">{s.periodo_dia || 'Manhã'}</span>
                      </div>
                      <p className="text-[11px] font-bold text-gray-800 leading-tight mb-1 truncate">{s.titulo}</p>
                      <p className="text-[8px] text-gray-400 mb-3">{date}</p>
                      <div className="flex justify-between">
                        <div>
                          <p className="text-[7px] text-gray-400 uppercase tracking-wider">Atletas</p>
                          <p className="text-[13px] font-black text-gray-700">{rows.length}</p>
                        </div>
                        <div>
                          <p className="text-[7px] text-gray-400 uppercase tracking-wider">Méd. Dist.</p>
                          <p className="text-[13px] font-black" style={{ color: '#0B7C3D' }}>
                            {avgD >= 1000 ? `${(avgD/1000).toFixed(1)}km` : `${Math.round(avgD)}m`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[7px] text-gray-400 uppercase tracking-wider">Tipo</p>
                          <p className="text-[13px] font-black text-gray-700">{s.tipo_sessao || 'Treino'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
