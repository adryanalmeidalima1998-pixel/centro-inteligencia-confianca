'use client'
import { useState, useEffect } from 'react'
import AppShell from '../components/layout/AppShell'
import TeamCrest from '../components/TeamCrest'
import { useTeamCrestBatch } from '../hooks/useTeamCrest'
import StandingsWidget from '../components/StandingsWidget'
import WeatherMatchWidget from '../components/WeatherMatchWidget'

// ─── DATE UTILS ────────────────────────────────────────────────────────────
function weekStart(d) {
  const c = new Date(d)
  const day = c.getDay()
  const diff = day === 0 ? -6 : 1 - day
  c.setDate(c.getDate() + diff)
  c.setHours(0, 0, 0, 0)
  return c
}

function addDays(d, n) {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isoDate(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
}

// ─── FORMATTERS ────────────────────────────────────────────────────────────
const MONTH_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const COL_DAYS = [1, 2, 3, 4, 5, 6, 0]

function fmtWeekHeader(mon) {
  const sun = addDays(mon, 6)
  if (mon.getMonth() === sun.getMonth()) {
    return `${mon.getDate()} – ${sun.getDate()} de ${MONTH_PT[mon.getMonth()]} ${mon.getFullYear()}`
  }
  return `${mon.getDate()} ${MONTH_PT[mon.getMonth()].slice(0,3)} – ${sun.getDate()} ${MONTH_PT[sun.getMonth()].slice(0,3)} ${sun.getFullYear()}`
}

// ─── MATCH BADGE ───────────────────────────────────────────────────────────
function MatchBadge({ match }) {
  const isHome = match.mando === 'H'
  const resultColor = !match.played ? '' :
    match.result === 'W' ? 'bg-sky-500' :
    match.result === 'L' ? 'bg-red-500'   : 'bg-gray-400'

  return (
    <div className={`rounded-xl border overflow-hidden ${isHome ? 'bg-sky-50 border-sky-200' : 'bg-blue-50 border-blue-200'}`}>
      <div className={`h-1 w-full ${isHome ? 'bg-sky-400' : 'bg-blue-400'}`} />
      <div className="px-2.5 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[7px] font-black uppercase tracking-wider text-gray-400 leading-none truncate">
            {match.competicao}
          </p>
          {match.live && (
            <span className="flex items-center gap-0.5 text-[7px] font-black text-red-600 uppercase tracking-wider flex-shrink-0 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <TeamCrest name={match.opponent} size={28} className="rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="bc text-[13px] font-black uppercase text-gray-900 leading-tight truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {match.opponent}
            </p>
            <span className={`inline-block text-[7px] font-black px-1.5 py-0.5 rounded-full
              ${isHome ? 'bg-sky-200 text-sky-800' : 'bg-blue-200 text-blue-800'}`}>
              {isHome ? '🏠 Casa' : '✈️ Fora'}
            </span>
          </div>
        </div>

        {match.venue && !match.played && (
          <p className="text-[7px] text-gray-400 truncate mb-1">📍 {match.venue}</p>
        )}

        {match.played ? (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${resultColor}`} />
            <span className={`text-[13px] font-black ${match.live ? 'text-red-600' : 'text-gray-800'}`}
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {match.golsG} – {match.golsAdv}
            </span>
            {!match.live && (
              <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full text-white ${resultColor}`}>
                {match.result}
              </span>
            )}
          </div>
        ) : match.horario ? (
          <div className="flex items-center gap-1 text-gray-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span className="text-[9px] font-bold">{match.horario}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── MINI MONTH ────────────────────────────────────────────────────────────
function MiniMonth({ currentWeekStart, onJump, matchDates }) {
  const [viewDate, setViewDate] = useState(() => new Date(currentWeekStart))
  useEffect(() => { setViewDate(new Date(currentWeekStart)) }, [currentWeekStart])

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  const today = new Date()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">
          {MONTH_PT[month].slice(0,3)} {year}
        </p>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-400 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S','T','Q','Q','S','S','D'].map((d, i) => (
          <p key={i} className="text-center text-[8px] font-black text-gray-300 uppercase">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key      = isoDate(d)
          const hasMatch = matchDates.has(key)
          const isToday  = sameDay(d, today)
          const ws       = weekStart(d)
          const isCurWk  = isoDate(ws) === isoDate(currentWeekStart)
          return (
            <button key={i} onClick={() => onJump(ws)}
              className={`relative w-full aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold transition-all
                ${isToday ? 'bg-sky-600 text-white font-black' :
                  isCurWk ? 'bg-sky-50 text-sky-700 font-black' :
                  'hover:bg-gray-50 text-gray-600'}`}>
              {d.getDate()}
              {hasMatch && !isToday && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-500" />}
              {hasMatch && isToday  && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── SEASON STATS ──────────────────────────────────────────────────────────
function SeasonStats({ matches }) {
  const played = matches.filter(m => m.played)
  const W = played.filter(m => m.result === 'W').length
  const D = played.filter(m => m.result === 'D').length
  const L = played.filter(m => m.result === 'L').length
  const pts   = W * 3 + D
  const total = matches.length
  const now   = new Date()
  const next  = matches.find(m => !m.played && new Date(m.date) >= now)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-3">Temporada 2026</p>

      {next && (
        <div className="mb-3 pb-3 border-b border-gray-100">
          <p className="text-[7px] font-black uppercase tracking-wider text-gray-400 mb-2">Próximo jogo</p>
          <div className="flex items-center gap-2 mb-1.5">
            <TeamCrest name="Confiança" size={28} className="rounded-full flex-shrink-0" />
            <span className="text-[9px] text-gray-300 font-black">VS</span>
            <TeamCrest name={next.opponent} size={28} className="rounded-full flex-shrink-0" />
          </div>
          <p className="bc text-base font-black uppercase text-gray-900 leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {next.mando === 'H' ? 'Confiança' : next.opponent}{' '}
            <span className="text-gray-400">vs</span>{' '}
            {next.mando === 'H' ? next.opponent : 'Confiança'}
          </p>
          <p className="text-[9px] text-gray-400 mt-0.5">
            {new Date(next.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })} · {next.horario}
          </p>
          {next.venue && <p className="text-[8px] text-gray-400 mt-0.5 truncate">📍 {next.venue}</p>}
          <span className={`inline-block mt-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full
            ${next.mando === 'H' ? 'bg-sky-100 text-sky-700' : 'bg-blue-100 text-blue-700'}`}>
            {next.mando === 'H' ? '🏠 Casa' : '✈️ Fora'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-gray-50 p-2 text-center">
          <p className="bc text-2xl font-black text-gray-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{played.length}</p>
          <p className="text-[7px] font-black uppercase tracking-wider text-gray-400">Jogos</p>
        </div>
        <div className="rounded-xl bg-sky-50 p-2 text-center">
          <p className="bc text-2xl font-black text-sky-700" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{pts}</p>
          <p className="text-[7px] font-black uppercase tracking-wider text-sky-500">Pontos</p>
        </div>
      </div>

      {played.length > 0 && (
        <div className="flex gap-1.5">
          <div className="flex-1 rounded-xl bg-sky-50 border border-sky-100 p-2 text-center">
            <p className="bc text-xl font-black text-sky-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{W}</p>
            <p className="text-[7px] font-black text-sky-500">V</p>
          </div>
          <div className="flex-1 rounded-xl bg-gray-50 border border-gray-100 p-2 text-center">
            <p className="bc text-xl font-black text-gray-500" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{D}</p>
            <p className="text-[7px] font-black text-gray-400">E</p>
          </div>
          <div className="flex-1 rounded-xl bg-red-50 border border-red-100 p-2 text-center">
            <p className="bc text-xl font-black text-red-500" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{L}</p>
            <p className="text-[7px] font-black text-red-400">D</p>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[7px] text-gray-400 mb-1">
            <span className="font-black uppercase tracking-wider">{played.length} / {total} jogos</span>
            <span>{Math.round(played.length / total * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full transition-all"
              style={{ width: `${played.length / total * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PÁGINA ────────────────────────────────────────────────────────────────
export default function ProgramacaoPage() {
  const [matches,  setMatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [weekMon,  setWeekMon]  = useState(() => weekStart(new Date()))
  const [lastSync, setLastSync] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/guarani')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Rehydrate dates (JSON não preserva Date objects)
      const fixtures = (data.fixtures || []).map(f => ({
        ...f,
        date: new Date(f.date),
      }))
      setMatches(fixtures)
      setLastSync(new Date())

      // Navega automaticamente para a semana do próximo jogo
      const now = new Date()
      const nextMatch = fixtures.find(f => !f.played && new Date(f.date) >= now)
      if (nextMatch) {
        setWeekMon(weekStart(new Date(nextMatch.date)))
      }
    } catch (err) {
      setError('Não foi possível carregar o calendário. ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allOpponents = matches.map(m => m.opponent)
  useTeamCrestBatch(allOpponents)

  const weekDays = COL_DAYS.map((_, i) => addDays(weekMon, i))

  const matchByDate = {}
  matches.forEach(m => {
    const k = isoDate(m.date)
    if (!matchByDate[k]) matchByDate[k] = []
    matchByDate[k].push(m)
  })

  const matchDates = new Set(matches.map(m => isoDate(m.date)))

  const goToToday = () => setWeekMon(weekStart(new Date()))
  const prevWeek  = () => setWeekMon(d => addDays(d, -7))
  const nextWeek  = () => setWeekMon(d => addDays(d,  7))
  const isCurrentWeek = isoDate(weekMon) === isoDate(weekStart(new Date()))

  const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <AppShell>
      <style>{`
        .bc { font-family: 'Barlow Condensed', sans-serif; }
        .prog { font-family: 'DM Sans', sans-serif; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
        .day-col { min-height: 180px; }
        .scroll-prog::-webkit-scrollbar { width: 3px; }
        .scroll-prog::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
      `}</style>

      <div className="prog h-screen overflow-y-auto scroll-prog bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 py-6">

          {/* ── HEADER ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-400">Programação</p>
              </div>
              <h1 className="bc text-4xl font-black uppercase text-gray-900 leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Calendário 2026
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-sky-700 hover:border-sky-200 hover:bg-sky-50 transition-all shadow-sm"
                title="Atualizar via Sportmonks"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={`w-3.5 h-3.5 flex-shrink-0 ${loading ? 'animate-spin' : ''}`}>
                  <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                <span className="text-[9px] font-black uppercase tracking-widest">Atualizar</span>
                {lastSync && (
                  <span className="text-[8px] text-gray-400">
                    {lastSync.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                  </span>
                )}
              </button>

              <button onClick={prevWeek}
                className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 text-gray-500 transition-colors shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path d="M15 18l-6-6 6-6"/></svg>
              </button>

              <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm text-center min-w-[220px]">
                <p className="text-[11px] font-black text-gray-800">{fmtWeekHeader(weekMon)}</p>
              </div>

              <button onClick={nextWeek}
                className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 text-gray-500 transition-colors shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path d="M9 18l6-6-6-6"/></svg>
              </button>

              {!isCurrentWeek && (
                <button onClick={goToToday}
                  className="px-3 py-2 rounded-xl bg-sky-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-sky-700 transition-colors shadow-sm">
                  Hoje
                </button>
              )}
            </div>
          </div>

          {/* ── LAYOUT ── */}
          <div className="flex gap-4 items-start">

            {/* CALENDÁRIO */}
            <div className="flex-1 min-w-0">

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                  <p className="text-[10px] text-red-600 font-semibold">{error}</p>
                </div>
              )}

              {!loading && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* DAY HEADERS */}
                  <div className="cal-grid border-b border-gray-100">
                    {weekDays.map((d, i) => {
                      const isToday = sameDay(d, new Date())
                      const hasMtch = !!matchByDate[isoDate(d)]
                      return (
                        <div key={i}
                          className={`px-3 py-3 border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-sky-600' : 'bg-gray-50'}`}>
                          <p className={`text-[8px] font-black uppercase tracking-widest ${isToday ? 'text-sky-100' : 'text-gray-400'}`}>
                            {DAY_LABELS[i]}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className={`bc text-2xl font-black leading-none ${isToday ? 'text-white' : 'text-gray-800'}`}
                              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                              {d.getDate()}
                            </p>
                            {hasMtch && (
                              <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full
                                ${isToday ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'}`}>
                                JOGO
                              </span>
                            )}
                          </div>
                          <p className={`text-[8px] mt-0.5 ${isToday ? 'text-sky-200' : 'text-gray-400'}`}>
                            {MONTH_PT[d.getMonth()].slice(0, 3)}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* DAY CELLS */}
                  <div className="cal-grid">
                    {weekDays.map((d, i) => {
                      const key        = isoDate(d)
                      const dayMatches = matchByDate[key] || []
                      const isToday    = sameDay(d, new Date())
                      const isPast     = d < today

                      return (
                        <div key={i}
                          className={`day-col p-2.5 border-r border-gray-100 last:border-r-0 border-t border-gray-100
                            ${isToday ? 'bg-sky-50/30' : isPast ? 'bg-gray-50/60' : 'bg-white'}`}>
                          <div className="space-y-1.5">
                            {dayMatches.map((m, mi) => (
                              <MatchBadge key={mi} match={m} />
                            ))}
                          </div>
                          {dayMatches.length === 0 && isPast && !isToday && (
                            <div className="h-full flex items-start pt-2">
                              <p className="text-[8px] text-gray-300 font-medium">—</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* PRÓXIMOS JOGOS */}
              {!loading && matches.filter(m => !m.played).length > 0 && (
                <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-3">Próximos jogos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {matches
                      .filter(m => !m.played && new Date(m.date) >= new Date())
                      .slice(0, 8)
                      .map((m, i) => (
                        <button key={i}
                          onClick={() => setWeekMon(weekStart(new Date(m.date)))}
                          className="text-left rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/30 p-2.5 transition-all group">
                          <p className="text-[7px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                            {new Date(m.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })} · {m.horario}
                          </p>
                          <div className="flex items-center gap-2">
                            <TeamCrest name={m.opponent} size={24} className="rounded-full flex-shrink-0" />
                            <p className="bc text-[13px] font-black uppercase text-gray-900 leading-tight truncate group-hover:text-sky-700"
                              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                              {m.opponent}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full
                              ${m.mando === 'H' ? 'bg-sky-100 text-sky-700' : 'bg-blue-100 text-blue-700'}`}>
                              {m.mando === 'H' ? '🏠 Casa' : '✈️ Fora'}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* SIDEBAR */}
            <div className="w-52 flex-shrink-0 space-y-3">
              <MiniMonth currentWeekStart={weekMon} onJump={setWeekMon} matchDates={matchDates} />
              {!loading && <SeasonStats matches={matches} />}
              {!loading && (
                <WeatherMatchWidget
                  nextMatch={matches.find(m => !m.played && new Date(m.date) >= new Date())}
                />
              )}
              <StandingsWidget />
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
