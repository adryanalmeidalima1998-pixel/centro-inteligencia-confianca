'use client'
import { useState, useEffect } from 'react'

export default function WeatherMatchWidget({ nextMatch }) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState(null) // 'too-far' | 'past' | 'ok' | 'error'

  useEffect(() => {
    if (!nextMatch?.dateKey) return
    setLoading(true); setWeather(null); setStatus(null)

    const params = new URLSearchParams({
      date:     nextMatch.dateKey,
      opponent: nextMatch.opponent || '',
      mando:    nextMatch.mando    || 'H',
    })
    fetch(`/api/weather-match?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.tooFar) { setStatus('too-far'); return }
        if (d.past)   { setStatus('past');    return }
        if (d.error)  { setStatus('error');   return }
        setWeather(d)
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoading(false))
  }, [nextMatch?.dateKey, nextMatch?.opponent])

  if (!nextMatch) return null

  const matchDate = new Date(nextMatch.dateKey + 'T12:00:00')
  const daysUntil = Math.ceil((matchDate - new Date()) / (1000 * 60 * 60 * 24))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Próximo jogo</p>
          <p className="text-[10px] font-black text-gray-800">Previsão do Tempo</p>
        </div>
        {daysUntil > 0 && (
          <span className="text-[8px] font-black px-2 py-1 rounded-full bg-gray-100 text-gray-500">
            em {daysUntil}d
          </span>
        )}
      </div>

      {/* MATCH INFO */}
      <p className="text-[8px] text-gray-500 mb-2 truncate">
        📍 {nextMatch.mando === 'H' ? 'Aracaju, SE (Casa)' : weather?.location || '—'}
      </p>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {status === 'too-far' && (
        <div className="py-2 text-center">
          <p className="text-2xl mb-1">📅</p>
          <p className="text-[8px] text-gray-400">Previsão disponível<br/>em até 16 dias do jogo</p>
        </div>
      )}

      {status === 'error' && (
        <p className="text-[8px] text-gray-400 text-center py-2">Não foi possível carregar</p>
      )}

      {status === 'ok' && weather && (() => {
        const w = weather.weather
        const matchHour = w.atMatchHour

        return (
          <div className="space-y-2.5">
            {/* MAIN WEATHER */}
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{w.emoji}</span>
              <div>
                <p className="text-[11px] font-black text-gray-800">{w.description}</p>
                <p className="bc text-xl font-black text-gray-900 leading-none"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {matchHour?.temp != null ? `${Math.round(matchHour.temp)}°C` : `${Math.round(w.tempMin)}–${Math.round(w.tempMax)}°C`}
                </p>
              </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* CHUVA */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-2 text-center">
                <p className="text-sm">💧</p>
                <p className="text-[10px] font-black text-blue-700">
                  {matchHour?.rainProb != null ? `${matchHour.rainProb}%` : w.rain != null ? `${w.rain}mm` : '–'}
                </p>
                <p className="text-[7px] text-blue-400 font-medium">Chuva</p>
              </div>
              {/* VENTO */}
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-2 text-center">
                <p className="text-sm">💨</p>
                <p className="text-[10px] font-black text-gray-700">
                  {matchHour?.wind != null ? `${Math.round(matchHour.wind)}` : w.wind != null ? `${Math.round(w.wind)}` : '–'}
                  <span className="text-[7px] font-medium"> km/h</span>
                </p>
                <p className="text-[7px] text-gray-400 font-medium">Vento</p>
              </div>
              {/* UV */}
              <div className={`rounded-xl border p-2 text-center ${
                (w.uv || 0) >= 8 ? 'bg-red-50 border-red-100' :
                (w.uv || 0) >= 5 ? 'bg-amber-50 border-amber-100' : 'bg-yellow-50 border-yellow-100'
              }`}>
                <p className="text-sm">☀️</p>
                <p className={`text-[10px] font-black ${
                  (w.uv || 0) >= 8 ? 'text-red-600' :
                  (w.uv || 0) >= 5 ? 'text-amber-600' : 'text-yellow-600'
                }`}>{w.uv != null ? `${Math.round(w.uv)}` : '–'}</p>
                <p className={`text-[7px] font-medium ${
                  (w.uv || 0) >= 8 ? 'text-red-400' :
                  (w.uv || 0) >= 5 ? 'text-amber-400' : 'text-yellow-500'
                }`}>UV</p>
              </div>
            </div>

            {/* ALERTA CHUVA */}
            {(matchHour?.rainProb ?? w.rainProb ?? 0) >= 60 && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-2.5 py-1.5">
                <span>⚠️</span>
                <p className="text-[8px] text-blue-700 font-bold">Alta probabilidade de chuva no jogo</p>
              </div>
            )}
            {(w.wind || 0) >= 40 && (
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                <span>⚠️</span>
                <p className="text-[8px] text-gray-600 font-bold">Vento forte previsto</p>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
