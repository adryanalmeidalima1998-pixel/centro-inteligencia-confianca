'use client'
import { useState, useEffect } from 'react'
import AppShell from '../../../components/layout/AppShell'
import { usePlayerPhotos } from '../../../hooks/usePlayerPhotos'
import { PhotoSelectorModal } from '../../../components/photos/PhotoSelectorModal'

const STYLE = `
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
`

const G = {
  verde: '#0B7C3D', branco: '#FFFFFF', amarelo: '#FDB913', azul: '#1E3A8A',
  cinza: '#F3F4F6', cinzaMed: '#E5E7EB', cinzaEsc: '#9CA3AF',
  vermelho: '#DC2626', laranja: '#EA580C', verdeClaro: '#16A34A', rosa: '#F8D7DA',
  pal: { am: '#FEF3C7', vd: '#DCFCE7', az: '#DBEAFE', verm: '#FEE2E2' }
}

function normalizeValue(val) {
  if (!val) return 0
  return parseFloat(val.toString().replace(',', '.')) || 0
}

export default function GpsDestaquesPage() {
  const { getPhotoUrl } = usePlayerPhotos()
  const [gpsSessions, setGpsSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [gpsData, setGpsData] = useState([])
  const [gpsLoading, setGpsLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('totalDistance')
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  useEffect(() => { loadGpsSessions() }, [])

  async function loadGpsSessions() {
    try {
      const res = await fetch('/api/gps')
      const data = await res.json()
      setGpsSessions(data.sessions || [])
      if (data.sessions?.length > 0) {
        setSelectedSession(data.sessions[0].id)
        loadGpsData(data.sessions[0])
      }
    } catch (e) { console.error(e) } finally { setGpsLoading(false) }
  }

  function parseGPSRows(rowsData) {
    const parsed = typeof rowsData === 'string' ? JSON.parse(rowsData) : rowsData
    return parsed.map(row => ({
      name: row.playerName || '', position: row.positionName || '',
      totalDistance: normalizeValue(row.totalDistance) / 1000,
      dist20: normalizeValue(row.dist20) / 1000,
      dist25: normalizeValue(row.dist25) / 1000,
      sprints: Math.round(normalizeValue(row.sprints)),
      accel: Math.round(normalizeValue(row.accel)),
      decel: Math.round(normalizeValue(row.decel)),
      maxVel: normalizeValue(row.maxVel)
    }))
  }

  async function loadGpsData(session) {
    try {
      setGpsLoading(true)
      setGpsData(parseGPSRows(session.rows))
    } catch (e) { console.error(e) } finally { setGpsLoading(false) }
  }

  const metricas = [
    { key: 'totalDistance', label: 'Distância Total (km)' },
    { key: 'dist20', label: 'Distância > 20 km/h (km)' },
    { key: 'dist25', label: 'Distância em Sprint (km)' },
    { key: 'sprints', label: 'Número de Sprints' },
    { key: 'accel', label: 'Acelerações' },
    { key: 'decel', label: 'Desacelerações' },
    { key: 'maxVel', label: 'Velocidade Máxima (km/h)' }
  ]

  const sortedByMetric = [...gpsData].sort((a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0))
  const topPlayers = sortedByMetric.slice(0, 4)
  const bottomPlayers = sortedByMetric.slice(-4).reverse()

  const PlayerCard = ({ player, rank, isTop }) => {
    const photo = getPhotoUrl(player.name)
    return (
      <div className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: G.branco, border: `3px solid ${isTop ? G.verdeClaro : G.laranja}` }}>
        <div className="relative h-48 overflow-hidden" style={{ background: isTop ? G.pal.vd : G.pal.am }}>
          {photo ? <img src={photo} alt={player.name} className="w-full h-full object-cover object-top" /> : 
            <div className="w-full h-full flex items-center justify-center text-4xl font-black" style={{ color: G.cinzaMed }}>
              {player.name.substring(0, 2).toUpperCase()}
            </div>
          }
          <div className="absolute top-3 right-3 rounded-full w-10 h-10 flex items-center justify-center font-black"
            style={{ background: isTop ? G.verdeClaro : G.laranja, color: G.branco }}>{rank}º</div>
        </div>
        <div className="p-4 space-y-3">
          <p className="bc text-lg font-black" style={{ color: G.verde }}>{player.name}</p>
          <div className="rounded-lg p-2" style={{ background: isTop ? G.pal.vd : G.pal.am }}>
            <p className="text-2xl font-black" style={{ color: isTop ? G.verdeClaro : G.laranja }}>
              {player[selectedMetric].toFixed(2)}
            </p>
          </div>
          <button onClick={() => { setSelectedPlayer(player.name); setPhotoModalOpen(true) }}
            className="w-full py-2 rounded-lg text-[10px] font-black uppercase"
            style={{ background: G.verde, color: G.branco }}>📸 Alterar Foto</button>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm " style={{ background: G.cinza }}>
        <div className="p-6 max-w-full mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap rounded-2xl p-6"
            style={{ background: G.branco, borderLeft: `6px solid ${G.verde}` }}>
            <h2 className="bc text-3xl font-black" style={{ color: G.verde }}>DESTAQUES</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-2 border-2 rounded-lg text-sm w-full" style={{ borderColor: G.verde }}>
              {metricas.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>

          {!gpsLoading && gpsData.length > 0 && (
            <div className="space-y-8">
              <div>
                <h3 className="bc text-2xl font-black mb-4" style={{ color: G.verde }}>🏆 MELHORES</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {topPlayers.map((p, i) => <PlayerCard key={i} player={p} rank={i+1} isTop={true} />)}
                </div>
              </div>
              <div>
                <h3 className="bc text-2xl font-black mb-4" style={{ color: G.verde }}>⚠️ MENORES</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {bottomPlayers.map((p, i) => <PlayerCard key={i} player={p} rank={i+1} isTop={false} />)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {photoModalOpen && <PhotoSelectorModal playerName={selectedPlayer} onClose={() => setPhotoModalOpen(false)} onSelect={() => setPhotoModalOpen(false)} />}
    </AppShell>
  )
}