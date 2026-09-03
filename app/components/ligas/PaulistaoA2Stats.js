'use client'
import { useState, useEffect } from 'react'

const CONFIANCA_BLUE = '#0a66b7'

/* ── helpers ─────────────────────────────────────────────────────────── */
function fmt(v, d = 2) {
  const f = parseFloat(v)
  return isNaN(f) ? '—' : f % 1 === 0 ? f : f.toFixed(d)
}
function pct(v) {
  const f = parseFloat(v)
  return isNaN(f) ? '—' : `${f.toFixed(1)}%`
}

const POS_COLORS = {
  G: '#0369a1', D: '#7c3aed', M: '#b45309', A: '#dc2626',
}
function PosBadge({ pos }) {
  const key = pos?.charAt(0)?.toUpperCase() || '?'
  const bg = POS_COLORS[key] || '#64748b'
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
      background: bg + '20', color: bg, letterSpacing: '0.5px',
    }}>
      {pos || '—'}
    </span>
  )
}

function TeamBadge({ team }) {
  if (!team?.name) return <span style={{ color: '#94a3b8' }}>—</span>
  const colors = ['#0a66b7', '#0369a1', '#7c3aed', '#b45309', '#dc2626', '#0891b2', '#059669']
  const idx = team.name.charCodeAt(0) % colors.length
  return (
    <span style={{ fontSize: 11, color: colors[idx], fontWeight: 700 }}>
      {team.name}
    </span>
  )
}

/* ── Tabela genérica ─────────────────────────────────────────────────── */
function RankingTable({ players, cols, limit = 20 }) {
  const rows = players.slice(0, limit)
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8f4ec', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr style={{ background: '#f8fdf9' }}>
            {['#', 'Jogador', 'Time', 'Pos', ...cols.map(c => c.label)].map(h => (
              <th key={h} style={{
                padding: '10px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8',
                textAlign: ['Jogador', 'Time'].includes(h) ? 'left' : 'center',
                borderBottom: '1px solid #e8f4ec', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const stat = p.statistics || {}
            const name = p.player?.name || '—'
            const team = p.team
            const pos  = p.player?.position || '—'
            return (
              <tr key={p.player?.id || i} style={{
                borderBottom: '1px solid #f8fdf9',
                background: i % 2 === 0 ? '#fff' : '#fafcfa',
              }}>
                <td style={{ padding: '9px 10px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? CONFIANCA_BLUE : '#94a3b8' }}>{i + 1}</td>
                <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 700, color: '#1a2e1a' }}>{name}</td>
                <td style={{ padding: '9px 10px' }}><TeamBadge team={team} /></td>
                <td style={{ padding: '9px 10px', textAlign: 'center' }}><PosBadge pos={pos} /></td>
                {cols.map(c => {
                  const val = stat[c.key]
                  const pctKey = c.pctKey ? stat[c.pctKey] : null
                  return (
                    <td key={c.key} style={{
                      padding: '9px 10px', textAlign: 'center',
                      fontSize: c.big ? 15 : 13,
                      fontWeight: c.big ? 900 : 600,
                      color: c.big ? (i === 0 ? CONFIANCA_BLUE : '#1a2e1a') : '#475569',
                    }}>
                      {fmt(val, c.decimals ?? 1)}
                      {pctKey != null && (
                        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>
                          ({pct(pctKey)})
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Card líder ─────────────────────────────────────────────────────── */
function LiderCard({ label, icon, players, statKey, cor, decimals = 0 }) {
  if (!players?.length) return null
  const top = players[0]
  const stat = top.statistics || {}
  const val = stat[statKey]
  if (val == null || val === 0) return null
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8f4ec', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div style={{ background: cor, padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 28, fontWeight: 900, color: cor, lineHeight: 1, marginBottom: 4 }}>{fmt(val, decimals)}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#2d4a35' }}>{top.player?.name}</p>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{top.team?.name} · {top.player?.position}</p>
      </div>
    </div>
  )
}

/* ── Tabs ────────────────────────────────────────────────────────────── */
const TABS = [
  { key: 'overview',    label: '📊 Visão Geral' },
  { key: 'ataque',      label: '⚽ Ataque' },
  { key: 'chutes',      label: '🎯 Chutes' },
  { key: 'passes',      label: '🔑 Passes' },
  { key: 'individual',  label: '⚡ Individual' },
  { key: 'goleiros',    label: '🧤 Goleiros' },
  { key: 'disciplina',  label: '🟨 Disciplina' },
]

/* ── Componente principal ────────────────────────────────────────────── */
export default function PaulistaoA2Stats() {
  const [raw, setRaw]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [tab, setTab]       = useState('overview')

  useEffect(() => {
    fetch('/api/sofascore-paulistao')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setRaw(d)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      Buscando dados do SofaScore...
    </div>
  )

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #fecaca' }}>
      <p style={{ fontSize: 20, marginBottom: 8 }}>❌</p>
      <p style={{ fontWeight: 700, color: '#dc2626' }}>Erro ao buscar SofaScore</p>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{error}</p>
    </div>
  )

  /* organiza jogadores por categoria */
  const tp = raw?.topPlayers || {}
  const byKey = (k) => tp[k]?.players || []

  const rating      = byKey('rating')
  const goals       = byKey('goals')
  const assists     = byKey('assists')
  const gaSum       = byKey('goalsAssistsSum')
  const totalShots  = byKey('totalShots')
  const shotsOn     = byKey('shotsOnTarget')
  const accPasses   = byKey('accuratePasses')
  const keyPasses   = byKey('keyPasses')
  const longBalls   = byKey('accurateLongBalls')
  const dribs       = byKey('successfulDribbles')
  const clearances  = byKey('clearances')
  const saves       = byKey('saves')
  const cleanSheet  = byKey('cleanSheet')
  const yellow      = byKey('yellowCards')
  const red         = byKey('redCards')
  const scoring     = byKey('scoringFrequency')

  return (
    <div>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064b82 0%, #0a66b7 100%)',
        borderRadius: 14, padding: '16px 24px', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
            Paulistão A2 2025 · Dados ao vivo
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 2 }}>Top Players SofaScore</h2>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Atualiza automaticamente a cada hora</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>
            {Object.values(tp).reduce((a, c) => a + (c?.players?.length || 0), 0)}
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>entradas de jogadores</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontWeight: 700, fontSize: 11,
            background: tab === t.key ? CONFIANCA_BLUE : '#f8fdf9',
            color: tab === t.key ? '#fff' : '#64748b',
            border: tab === t.key ? 'none' : '1px solid #e8f4ec',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── VISÃO GERAL ── */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
            <LiderCard label="Melhor Nota" icon="⭐" players={rating}     statKey="rating"      cor="#b45309" decimals={2} />
            <LiderCard label="Artilheiro"  icon="⚽" players={goals}      statKey="goals"       cor={CONFIANCA_BLUE}     />
            <LiderCard label="Assistências" icon="🔑" players={assists}   statKey="assists"     cor="#0369a1" />
            <LiderCard label="G+A"          icon="🏆" players={gaSum}    statKey="goalsAssistsSum" cor="#7c3aed" />
            <LiderCard label="Chutes"       icon="🎯" players={totalShots} statKey="totalShots" cor="#0891b2" />
            <LiderCard label="Passes Certos" icon="📐" players={accPasses} statKey="accuratePasses" cor="#059669" />
            <LiderCard label="Dribles"      icon="⚡" players={dribs}    statKey="successfulDribbles" cor="#dc2626" />
            <LiderCard label="Defesas"      icon="🧤" players={saves}    statKey="saves"       cor="#6366f1" />
          </div>

          {/* Mini-ranking top 5 nota */}
          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a2e1a', marginBottom: 12 }}>🏅 Top 10 por Nota Geral</h3>
          <RankingTable
            players={rating}
            limit={10}
            cols={[
              { key: 'rating', label: 'Nota', big: true, decimals: 2 },
              { key: 'goals',  label: 'G' },
              { key: 'assists',label: 'A' },
            ]}
          />
        </div>
      )}

      {/* ── ATAQUE ── */}
      {tab === 'ataque' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: CONFIANCA_BLUE, marginBottom: 12 }}>⚽ Artilheiros</h3>
            <RankingTable players={goals} cols={[
              { key: 'goals', label: 'Gols', big: true },
              { key: 'penaltyGoals', label: 'Pen.' },
              { key: 'goalsAssistsSum', label: 'G+A' },
              { key: 'assists', label: 'Assists' },
            ]} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: CONFIANCA_BLUE, marginBottom: 12 }}>📈 Frequência de Gol</h3>
            <RankingTable players={scoring} cols={[
              { key: 'scoringFrequency', label: 'Min/Gol', big: true },
              { key: 'goals', label: 'Gols' },
            ]} />
          </div>
        </div>
      )}

      {/* ── CHUTES ── */}
      {tab === 'chutes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0891b2', marginBottom: 12 }}>🎯 Total de Chutes</h3>
            <RankingTable players={totalShots} cols={[
              { key: 'totalShots', label: 'Chutes', big: true },
              { key: 'shotsOnTarget', label: 'No Gol' },
              { key: 'goals', label: 'Gols' },
            ]} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0891b2', marginBottom: 12 }}>🎯 Chutes no Gol</h3>
            <RankingTable players={shotsOn} cols={[
              { key: 'shotsOnTarget', label: 'No Gol', big: true },
              { key: 'totalShots', label: 'Chutes' },
              { key: 'goals', label: 'Gols' },
            ]} />
          </div>
        </div>
      )}

      {/* ── PASSES ── */}
      {tab === 'passes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#059669', marginBottom: 12 }}>📐 Passes Certos</h3>
            <RankingTable players={accPasses} cols={[
              { key: 'accuratePasses', label: 'Passes', big: true },
              { key: 'accuratePassesPercentage', label: '%', decimals: 1 },
              { key: 'keyPasses', label: 'Chave' },
            ]} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#059669', marginBottom: 12 }}>🔑 Passes-Chave</h3>
            <RankingTable players={keyPasses} cols={[
              { key: 'keyPasses', label: 'Passes-Chave', big: true },
              { key: 'assists', label: 'Assists' },
            ]} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#059669', marginBottom: 12 }}>📏 Bolas Longas Certas</h3>
            <RankingTable players={longBalls} cols={[
              { key: 'accurateLongBalls', label: 'Long Balls', big: true },
              { key: 'accurateLongBallsPercentage', label: '%', decimals: 1 },
            ]} />
          </div>
        </div>
      )}

      {/* ── INDIVIDUAL ── */}
      {tab === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', marginBottom: 12 }}>⚡ Dribles</h3>
            <RankingTable players={dribs} cols={[
              { key: 'successfulDribbles', label: 'Dribles', big: true },
              { key: 'successfulDribblesPercentage', label: '%', decimals: 1 },
            ]} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed', marginBottom: 12 }}>🛡️ Cortes (Clearances)</h3>
            <RankingTable players={clearances} cols={[
              { key: 'clearances', label: 'Cortes', big: true },
            ]} />
          </div>
        </div>
      )}

      {/* ── GOLEIROS ── */}
      {tab === 'goleiros' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0369a1', marginBottom: 12 }}>🧤 Mais Defesas</h3>
            <RankingTable players={saves} cols={[
              { key: 'saves', label: 'Defesas', big: true },
              { key: 'cleanSheet', label: 'Clean Sheets' },
              { key: 'mostConceded', label: 'Mais Tomou' },
            ]} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0369a1', marginBottom: 12 }}>🧱 Clean Sheets</h3>
            <RankingTable players={cleanSheet} cols={[
              { key: 'cleanSheet', label: 'Clean Sheets', big: true },
              { key: 'saves', label: 'Defesas' },
            ]} />
          </div>
        </div>
      )}

      {/* ── DISCIPLINA ── */}
      {tab === 'disciplina' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#ca8a04', marginBottom: 12 }}>🟨 Cartões Amarelos</h3>
            <RankingTable players={yellow} cols={[
              { key: 'yellowCards', label: 'Amarelos', big: true },
              { key: 'redCards', label: 'Vermelhos' },
            ]} />
          </div>
          {red.length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', marginBottom: 12 }}>🟥 Cartões Vermelhos</h3>
              <RankingTable players={red} cols={[
                { key: 'redCards', label: 'Vermelhos', big: true },
                { key: 'yellowCards', label: 'Amarelos' },
              ]} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
