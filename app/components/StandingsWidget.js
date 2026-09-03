'use client'
import { useState, useEffect } from 'react'
import TeamCrest from './TeamCrest'

export default function StandingsWidget() {
  const [standings, setStandings] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(false)

  useEffect(() => {
    fetch('/api/standings')
      .then(r => r.json())
      .then(d => setStandings(d.standings || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const visible = expanded ? standings : standings.slice(0, 8)

  const clubRow = standings.find(r =>
    (r.team_name || '').toLowerCase().includes('confianca')
  )
  const clubPosition = clubRow?.position || standings.findIndex(r =>
    (r.team_name || '').toLowerCase().includes('confianca')
  ) + 1 || null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Série C 2026</p>
          <p className="text-[10px] font-black text-gray-800">Classificação</p>
        </div>
        {clubPosition && (
          <div className="text-right">
            <p className="text-[8px] text-gray-400 font-medium">Confiança</p>
            <p className="bc text-xl font-black text-sky-600 leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {clubPosition}°
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="px-4 py-6 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : standings.length === 0 ? (
        <div className="px-4 py-4">
          <p className="text-[9px] text-gray-400 text-center">Temporada não iniciada</p>
        </div>
      ) : (
        <>
          {/* TABLE HEADER */}
          <div className="grid px-3 py-1.5 border-b border-gray-50"
            style={{ gridTemplateColumns: '20px 1fr 22px 22px 22px 22px 28px' }}>
            {['#','','PJ','V','E','D','Pts'].map((h,i) => (
              <p key={i} className={`text-[7px] font-black uppercase text-gray-300 ${i > 1 ? 'text-center' : ''}`}>{h}</p>
            ))}
          </div>

          {/* ROWS */}
          <div className="divide-y divide-gray-50">
            {visible.map((row, i) => {
              const isClub = (row.team_name || '').toLowerCase().includes('confianca')
              const pos = row.position || i + 1
              // Zone colors: 1-8 = G1 (acesso), 9-16 = mid, 17-20 = rebaixamento
              const zoneColor = pos <= 8 ? 'bg-sky-400' : pos <= 16 ? 'bg-gray-200' : 'bg-red-400'
              return (
                <div key={row.team_name}
                  className={`grid items-center px-3 py-1.5 transition-colors
                    ${isClub ? 'bg-sky-50 border-l-2 border-sky-500' : 'hover:bg-gray-50/60'}`}
                  style={{ gridTemplateColumns: '20px 1fr 22px 22px 22px 22px 28px' }}>
                  {/* POS */}
                  <div className="flex items-center gap-0.5">
                    <span className={`w-1 h-3 rounded-full ${zoneColor} flex-shrink-0`} />
                    <span className={`text-[9px] font-black ml-0.5 ${isClub ? 'text-sky-700' : 'text-gray-500'}`}>{pos}</span>
                  </div>
                  {/* TEAM */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TeamCrest name={row.team_name} size={16} className="rounded-full flex-shrink-0" />
                    <span className={`text-[9px] font-bold truncate leading-tight
                      ${isClub ? 'text-sky-800 font-black' : 'text-gray-700'}`}>
                      {isClub ? 'Confiança' : (row.team_name || '').split(' ').slice(0,2).join(' ')}
                    </span>
                  </div>
                  <p className={`text-[9px] text-center ${isClub ? 'text-sky-700 font-bold' : 'text-gray-500'}`}>{row.pj ?? '–'}</p>
                  <p className="text-[9px] text-center text-sky-600 font-bold">{row.vit ?? '–'}</p>
                  <p className="text-[9px] text-center text-gray-400">{row.emp ?? '–'}</p>
                  <p className="text-[9px] text-center text-red-400">{row.der ?? '–'}</p>
                  <p className={`text-[9px] text-center font-black ${isClub ? 'text-sky-700' : 'text-gray-800'}`}>{row.pts ?? '–'}</p>
                </div>
              )
            })}
          </div>

          {/* EXPAND / COLLAPSE */}
          {standings.length > 8 && (
            <button onClick={() => setExpanded(!expanded)}
              className="w-full py-2 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors border-t border-gray-50">
              {expanded ? '▲ Ver menos' : `▼ Ver todos (${standings.length})`}
            </button>
          )}

          {/* LEGEND */}
          <div className="px-3 pb-2 pt-1 flex flex-wrap gap-2 border-t border-gray-50">
            {[
              { color: 'bg-sky-400', label: 'Acesso (G8)' },
              { color: 'bg-red-400',   label: 'Rebaixamento' },
            ].map(z => (
              <div key={z.label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${z.color}`} />
                <span className="text-[7px] text-gray-400">{z.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
