'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '../../../components/layout/AppShell'
import { usePlayerPhotos } from '../../../hooks/usePlayerPhotos'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts'

const STYLE = `
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
  * { scrollbar-width: thin; scrollbar-color: #0B7C3D #F3F4F6; }
  *::-webkit-scrollbar { width: 8px; }
  *::-webkit-scrollbar-track { background: #F3F4F6; }
  *::-webkit-scrollbar-thumb { background: #0B7C3D; border-radius: 4px; }
`

// 🟨 CORES CONFIANÇA - SEM PRETO
const G = {
  amarelo: '#FDB913',
  verde: '#0B7C3D',
  azul: '#1E3A8A',
  branco: '#FFFFFF',
  cinza: '#F3F4F6',
  cinzaMed: '#E5E7EB',
  cinzaEsc: '#9CA3AF',
  vermelho: '#DC2626',
  laranja: '#EA580C',
  verdeClaro: '#16A34A',
  rosa: '#F8D7DA',
  pal: { am: '#FEF3C7', vd: '#DCFCE7', az: '#DBEAFE', verm: '#FEE2E2' }
}

function normalizeValue(val) {
  if (!val) return 0
  return parseFloat(val.toString().replace(',', '.')) || 0
}

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; continue }
    if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; continue }
    cur += line[i]
  }
  result.push(cur); return result
}

function parseSheetCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i]||'').trim()]))
  }).filter(r => Object.values(r).some(v => v !== ''))
}

const SHEETS = {
  pre: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmx6gtZGEZXYMSLBxFaASfgQAdfwXWCVBCnnTV56QzrbUwy5zW38GZIhvgGERCTe3MufNkmBfWrRlK/pub?output=csv',
  pos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7gU32319qDw3KLwOeyc8UFElJQwYL-X_rM2k5WGYhE0Wq7vdHE5_OXMI0DdWTRCx-Dj5IY35wjgkF/pub?output=csv',
}

const DOR_LABELS = {
  '7 - Posterior de Coxa Direito': '7️⃣ Post. Coxa Dir.',
  '8 - Posterior de Coxa Esquerdo': '8️⃣ Post. Coxa Esq.',
  '4 - Adutor da Coxa Esquerdo': '4️⃣ Adutor Esq.',
  'D - Tornozelo Direito': '🦶 Tornozelo Dir.',
  '0 - Sem dor': '✅ Sem dor',
  'F - Lombar': '🔴 Lombar'
}

export default function AtletaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <AtletaPageInner />
    </Suspense>
  )
}

function AtletaPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getPhotoUrl } = usePlayerPhotos()
  
  const playerName = searchParams.get('player')
  const [tab, setTab] = useState(0)
  const [allGpsData, setAllGpsData] = useState([])
  const [playerGpsData, setPlayerGpsData] = useState([])
  const [playerWellness, setPlayerWellness] = useState([])
  const [allPlayers, setAllPlayers] = useState([])
  const [allPositions, setAllPositions] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playerName) {
      router.push('/fisiologia/bem-estar')
      return
    }
    loadAllData()
  }, [playerName])

  async function loadAllData() {
    setLoading(true)
    try {
      // ========== CARREGAR GPS ==========
      const gpsRes = await fetch('/api/gps')
      const gpsDataRaw = await gpsRes.json()
      const sessions = gpsDataRaw.sessions || []
      
      const allGPS = []
      const playerGPS = []
      const playersMap = {}
      const positionsMap = {}
      
      sessions.forEach(session => {
        const rows = typeof session.rows === 'string' ? JSON.parse(session.rows) : session.rows
        rows.forEach(row => {
          if (row['Period Name'] !== 'PRÉ SESSÃO') {
            const gpsRow = {
              sessionDate: session.data_sessao,
              sessionType: session.tipo_sessao,
              playerName: row['Player Name'],
              position: row['Position Name'] || '',
              totalDistance: normalizeValue(row['Total Distance']) / 1000,
              dist20: normalizeValue(row['Distância (> 20 Km/h) (m)']) / 1000,
              dist25: normalizeValue(row['Distância em Sprint (> 25 Km/h) (m)']) / 1000,
              sprints: Math.round(normalizeValue(row['Sprints (nº)'])),
              accel: Math.round(normalizeValue(row['Acc > 3 m/s² (nº)'])),
              decel: Math.round(normalizeValue(row['Decel < - 3 m/s² (nº)'])),
              maxVel: normalizeValue(row['Maximum Velocity']),
            }
            
            allGPS.push(gpsRow)
            if (row['Player Name'] === playerName) playerGPS.push(gpsRow)
            if (!playersMap[row['Player Name']]) playersMap[row['Player Name']] = gpsRow.position
            if (!positionsMap[gpsRow.position]) positionsMap[gpsRow.position] = []
            positionsMap[gpsRow.position].push(gpsRow)
          }
        })
      })
      
      setAllGpsData(allGPS)
      setPlayerGpsData(playerGPS)
      setAllPlayers(Object.keys(playersMap))
      setAllPositions(positionsMap)

      // ========== CARREGAR BEM-ESTAR ==========
      const [preRes, posRes] = await Promise.all([
        fetch(`/api/sheets-proxy?url=${encodeURIComponent(SHEETS.pre)}`),
        fetch(`/api/sheets-proxy?url=${encodeURIComponent(SHEETS.pos)}`),
      ])
      const [preText, posText] = await Promise.all([preRes.text(), posRes.text()])
      const preData = parseSheetCSV(preText)
      const posData = parseSheetCSV(posText)

      const playerWellnessData = []
      
      preData.forEach(row => {
        if ((row['Atletas'] || '').toLowerCase() === playerName.toLowerCase()) {
          playerWellnessData.push({
            date: row['Data'] || '',
            day: getDayOfWeek(row['Data'] || ''),
            type: 'PRÉ',
            sono: normalizeValue(row['Como foi a qualidade do seu sono?']),
            horas: normalizeValue(row['Quantas horas você dormiu na última noite?']),
            recup: normalizeValue(row['Como você classifica sua recuperação?']),
            dor: normalizeValue(row['QUal a graduação da sua dor']),
            dorLocal: row['Local da Dor'] || '',
            urina: normalizeValue(row['Qual a coloração da sua urina?']),
            gi: row['Apresenta ou apresentou no dia anterior algum sintoma gastrointestinal? (Ex: diarreia, refluxo, azia, náusea, vômito ou sangramento retal)'] || '',
            peso: normalizeValue(row['Peso (kg)'])
          })
        }
      })
      
      posData.forEach(row => {
        if ((row['Atleta'] || '').toLowerCase() === playerName.toLowerCase()) {
          playerWellnessData.push({
            date: row['Data'] || '',
            day: getDayOfWeek(row['Data'] || ''),
            type: 'PÓS',
            pse: normalizeValue(row['Qual sua percepção de esforço pós-treino ?']),
            dor: normalizeValue(row['Está sentindo alguma dor localizada?']),
            dorLocal: row['Local da Dor'] || '',
            peso: normalizeValue(row['Peso (kg)'])
          })
        }
      })
      
      setPlayerWellness(playerWellnessData.sort((a, b) => new Date(b.date) - new Date(a.date)))

    } catch (e) {
      console.error('Erro carregando dados:', e)
    } finally {
      setLoading(false)
    }
  }

  function getDayOfWeek(dateStr) {
    if (!dateStr) return ''
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
    try {
      const [d, m, a] = dateStr.split('/')
      const date = new Date(a, m - 1, d)
      return dias[date.getDay()]
    } catch {
      return ''
    }
  }

  // ========== CÁLCULOS ==========
  const playerAvg = {
    totalDistance: playerGpsData.length > 0 ? playerGpsData.reduce((a, b) => a + b.totalDistance, 0) / playerGpsData.length : 0,
    dist20: playerGpsData.length > 0 ? playerGpsData.reduce((a, b) => a + b.dist20, 0) / playerGpsData.length : 0,
    dist25: playerGpsData.length > 0 ? playerGpsData.reduce((a, b) => a + b.dist25, 0) / playerGpsData.length : 0,
    sprints: playerGpsData.length > 0 ? playerGpsData.reduce((a, b) => a + b.sprints, 0) / playerGpsData.length : 0,
    accel: playerGpsData.length > 0 ? playerGpsData.reduce((a, b) => a + b.accel, 0) / playerGpsData.length : 0,
    decel: playerGpsData.length > 0 ? playerGpsData.reduce((a, b) => a + b.decel, 0) / playerGpsData.length : 0,
    maxVel: playerGpsData.length > 0 ? playerGpsData.reduce((a, b) => a + b.maxVel, 0) / playerGpsData.length : 0,
    position: playerGpsData.length > 0 ? playerGpsData[0].position : ''
  }

  const teamAvg = {
    totalDistance: allGpsData.length > 0 ? allGpsData.reduce((a, b) => a + b.totalDistance, 0) / allGpsData.length : 0,
    dist20: allGpsData.length > 0 ? allGpsData.reduce((a, b) => a + b.dist20, 0) / allGpsData.length : 0,
    dist25: allGpsData.length > 0 ? allGpsData.reduce((a, b) => a + b.dist25, 0) / allGpsData.length : 0,
    sprints: allGpsData.length > 0 ? allGpsData.reduce((a, b) => a + b.sprints, 0) / allGpsData.length : 0,
    accel: allGpsData.length > 0 ? allGpsData.reduce((a, b) => a + b.accel, 0) / allGpsData.length : 0,
    decel: allGpsData.length > 0 ? allGpsData.reduce((a, b) => a + b.decel, 0) / allGpsData.length : 0,
    maxVel: allGpsData.length > 0 ? allGpsData.reduce((a, b) => a + b.maxVel, 0) / allGpsData.length : 0,
  }

  const positionData = allPositions[playerAvg.position] || []
  const positionAvg = {
    totalDistance: positionData.length > 0 ? positionData.reduce((a, b) => a + b.totalDistance, 0) / positionData.length : 0,
    dist20: positionData.length > 0 ? positionData.reduce((a, b) => a + b.dist20, 0) / positionData.length : 0,
    dist25: positionData.length > 0 ? positionData.reduce((a, b) => a + b.dist25, 0) / positionData.length : 0,
    sprints: positionData.length > 0 ? positionData.reduce((a, b) => a + b.sprints, 0) / positionData.length : 0,
    accel: positionData.length > 0 ? positionData.reduce((a, b) => a + b.accel, 0) / positionData.length : 0,
    decel: positionData.length > 0 ? positionData.reduce((a, b) => a + b.decel, 0) / positionData.length : 0,
    maxVel: positionData.length > 0 ? positionData.reduce((a, b) => a + b.maxVel, 0) / positionData.length : 0,
  }

  // ========== DADOS PARA GRÁFICOS ==========
  const radarVsEquipe = [
    { metric: 'Distância', jogador: Math.min(playerAvg.totalDistance * 5, 100), equipe: Math.min(teamAvg.totalDistance * 5, 100), fullMark: 100 },
    { metric: '> 20 km/h', jogador: Math.min(playerAvg.dist20 * 10, 100), equipe: Math.min(teamAvg.dist20 * 10, 100), fullMark: 100 },
    { metric: '> 25 km/h', jogador: Math.min(playerAvg.dist25 * 20, 100), equipe: Math.min(teamAvg.dist25 * 20, 100), fullMark: 100 },
    { metric: 'Sprints', jogador: Math.min(playerAvg.sprints * 3, 100), equipe: Math.min(teamAvg.sprints * 3, 100), fullMark: 100 },
    { metric: 'Acel.', jogador: Math.min(playerAvg.accel * 2, 100), equipe: Math.min(teamAvg.accel * 2, 100), fullMark: 100 },
    { metric: 'Decel.', jogador: Math.min(playerAvg.decel * 2, 100), equipe: Math.min(teamAvg.decel * 2, 100), fullMark: 100 },
  ]

  const radarVsPosicao = [
    { metric: 'Distância', jogador: Math.min(playerAvg.totalDistance * 5, 100), posicao: Math.min(positionAvg.totalDistance * 5, 100), fullMark: 100 },
    { metric: '> 20 km/h', jogador: Math.min(playerAvg.dist20 * 10, 100), posicao: Math.min(positionAvg.dist20 * 10, 100), fullMark: 100 },
    { metric: '> 25 km/h', jogador: Math.min(playerAvg.dist25 * 20, 100), posicao: Math.min(positionAvg.dist25 * 20, 100), fullMark: 100 },
    { metric: 'Sprints', jogador: Math.min(playerAvg.sprints * 3, 100), posicao: Math.min(positionAvg.sprints * 3, 100), fullMark: 100 },
    { metric: 'Acel.', jogador: Math.min(playerAvg.accel * 2, 100), posicao: Math.min(positionAvg.accel * 2, 100), fullMark: 100 },
    { metric: 'Decel.', jogador: Math.min(playerAvg.decel * 2, 100), posicao: Math.min(positionAvg.decel * 2, 100), fullMark: 100 },
  ]

  const gpsHistoryData = playerGpsData.map((d, idx) => ({
    session: `${idx + 1}`,
    date: d.sessionDate,
    distancia: parseFloat(d.totalDistance.toFixed(2)),
    vel_max: parseFloat(d.maxVel.toFixed(1))
  }))

  // Frequência de dor
  const painFrequency = {}
  playerWellness.forEach(w => {
    if (w.dor > 0 && w.dorLocal) {
      painFrequency[w.dorLocal] = (painFrequency[w.dorLocal] || 0) + 1
    }
  })
  const painData = Object.entries(painFrequency).map(([local, freq]) => ({ local: DOR_LABELS[local] || local, frequencia: freq, fullLocal: local }))

  // Microciclo semanal
  const wellnessLastWeek = playerWellness.slice(0, 7)
  const microcycleData = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(dia => {
    const dayWellness = wellnessLastWeek.filter(w => w.day === dia)
    const avgScore = dayWellness.length > 0 
      ? dayWellness.reduce((sum, w) => sum + (w.sono || w.pse || 0), 0) / dayWellness.length 
      : 0
    return { dia, score: parseFloat(avgScore.toFixed(1)), count: dayWellness.length }
  })

  const playerPhoto = getPhotoUrl(playerName)
  const initials = (playerName || '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

  if (loading) {
    return (
      <AppShell>
        <style>{STYLE}</style>
        <div className="dm h-screen flex items-center justify-center" style={{ background: G.cinza }}>
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: G.cinzaMed, borderTopColor: G.amarelo }} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm " style={{ background: G.cinza }}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">

          {/* ========== HEADER ========== */}
          <div className="rounded-2xl p-6 flex items-center justify-between gap-6" style={{ background: G.branco, borderLeft: `6px solid ${G.verde}` }}>
            <div className="flex items-center gap-6 flex-1">
              <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border-4" style={{ borderColor: G.amarelo, background: G.pal.am }}>
                {playerPhoto
                  ? <img src={playerPhoto} alt={playerName} className="w-full h-full object-cover object-top" />
                  : <span className="bc text-4xl font-black" style={{ color: G.amarelo }}>{initials}</span>
                }
              </div>
              <div>
                <p className="bc text-4xl font-black" style={{ color: G.azul }}>{playerName}</p>
                <p className="text-base font-bold mt-1" style={{ color: G.verde }}>{playerAvg.position || 'Posição desconhecida'}</p>
                <div className="flex gap-6 mt-3 flex-wrap text-xs">
                  <div><p style={{ color: G.cinzaEsc }} className="font-bold">SESSÕES</p><p className="text-lg font-black" style={{ color: G.amarelo }}>{playerGpsData.length}</p></div>
                  <div><p style={{ color: G.cinzaEsc }} className="font-bold">VEL. MÁX</p><p className="text-lg font-black" style={{ color: G.verde }}>{playerAvg.maxVel.toFixed(1)}</p></div>
                  <div><p style={{ color: G.cinzaEsc }} className="font-bold">DIST. MÉD.</p><p className="text-lg font-black" style={{ color: G.azul }}>{playerAvg.totalDistance.toFixed(1)}</p></div>
                </div>
              </div>
            </div>
            <button onClick={() => router.back()} className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-lg" style={{ background: G.azul, color: G.branco }}>← Voltar</button>
          </div>

          {/* ========== TABS ========== */}
          <div className="flex gap-2 flex-wrap">
            {['VISÃO GERAL', 'GPS & CARGA', 'BEM-ESTAR', 'DOR'].map((t, i) => (
              <button key={i} onClick={() => setTab(i)} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all" style={{
                background: tab === i ? G.amarelo : G.branco,
                color: tab === i ? G.azul : G.verde,
                border: `2px solid ${tab === i ? G.amarelo : G.verde}`
              }}>{t}</button>
            ))}
          </div>

          {/* ========== TAB 0: VISÃO GERAL ========== */}
          {tab === 0 && (
            <div className="space-y-6">
              <div className="rounded-2xl p-6" style={{ background: G.branco, borderLeft: `6px solid ${G.amarelo}` }}>
                <h3 className="bc text-xl font-black mb-4" style={{ color: G.azul }}>⚽ JOGADOR vs MÉDIA DA EQUIPE</h3>
                <ResponsiveContainer width="100%" height={380}>
                  <RadarChart data={radarVsEquipe}>
                    <PolarGrid stroke={G.pal.am} />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: G.azul, fontWeight: 'bold' }} />
                    <PolarRadiusAxis domain={[0, 100]} stroke={G.verde} />
                    <Radar name="Jogador" dataKey="jogador" stroke={G.amarelo} fill={G.amarelo} fillOpacity={0.7} strokeWidth={2} />
                    <Radar name="Equipe" dataKey="equipe" stroke={G.verde} fill={G.verde} fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: G.branco, border: `2px solid ${G.amarelo}`, borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl p-6" style={{ background: G.branco, borderLeft: `6px solid ${G.verde}` }}>
                <h3 className="bc text-xl font-black mb-4" style={{ color: G.azul }}>🎯 JOGADOR vs POSIÇÃO ({playerAvg.position})</h3>
                <ResponsiveContainer width="100%" height={380}>
                  <RadarChart data={radarVsPosicao}>
                    <PolarGrid stroke={G.pal.vd} />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: G.azul, fontWeight: 'bold' }} />
                    <PolarRadiusAxis domain={[0, 100]} stroke={G.amarelo} />
                    <Radar name="Jogador" dataKey="jogador" stroke={G.amarelo} fill={G.amarelo} fillOpacity={0.7} strokeWidth={2} />
                    <Radar name={playerAvg.position} dataKey="posicao" stroke={G.azul} fill={G.azul} fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: G.branco, border: `2px solid ${G.amarelo}`, borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ========== TAB 1: GPS & CARGA ========== */}
          {tab === 1 && (
            <div className="space-y-6">
              <div className="rounded-2xl p-6" style={{ background: G.branco, borderLeft: `6px solid ${G.amarelo}` }}>
                <h3 className="bc text-xl font-black mb-4" style={{ color: G.azul }}>📈 HISTÓRICO GPS - DISTÂNCIA</h3>
                {gpsHistoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={gpsHistoryData}>
                      <CartesianGrid stroke={G.pal.am} />
                      <XAxis dataKey="session" stroke={G.verde} />
                      <YAxis stroke={G.verde} />
                      <Tooltip contentStyle={{ background: G.branco, border: `2px solid ${G.amarelo}` }} />
                      <Legend />
                      <Line type="linear" dataKey="distancia" stroke={G.amarelo} strokeWidth={3} name="Distância (km)" dot={{ fill: G.amarelo, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: G.verde }}>Sem dados</p>}
              </div>

              <div className="rounded-2xl p-6" style={{ background: G.branco, borderLeft: `6px solid ${G.verde}` }}>
                <h3 className="bc text-xl font-black mb-4" style={{ color: G.azul }}>🚀 VELOCIDADE MÁXIMA POR SESSÃO</h3>
                {gpsHistoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={gpsHistoryData}>
                      <CartesianGrid stroke={G.pal.vd} />
                      <XAxis dataKey="session" stroke={G.amarelo} />
                      <YAxis stroke={G.amarelo} />
                      <Tooltip contentStyle={{ background: G.branco, border: `2px solid ${G.amarelo}` }} />
                      <Legend />
                      <Line type="linear" dataKey="vel_max" stroke={G.verde} strokeWidth={3} name="Vel. Máxima (km/h)" dot={{ fill: G.verde, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: G.verde }}>Sem dados</p>}
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ background: G.branco, border: `2px solid ${G.amarelo}` }}>
                <div className="p-6 border-b" style={{ borderColor: G.pal.am }}>
                  <h3 className="bc text-xl font-black" style={{ color: G.azul }}>📋 DETALHES DE TODAS AS SESSÕES</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: G.amarelo }}>
                      <tr>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>DATA</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>TIPO</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>DIST.</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>{'>'}  20</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>{'>'}  25</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>SPRT</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>ACEL</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>DECEL</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.azul }}>VMAX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerGpsData.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${G.pal.am}` }}>
                          <td className="px-4 py-3 font-bold" style={{ color: G.azul }}>{r.sessionDate}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.verde }}>{r.sessionType}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.amarelo }}>{r.totalDistance.toFixed(1)}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.laranja }}>{r.dist20.toFixed(1)}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.vermelho }}>{r.dist25.toFixed(1)}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.verdeClaro }}>{r.sprints}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.amarelo }}>{r.accel}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.verde }}>{r.decel}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: G.azul }}>{r.maxVel.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========== TAB 2: BEM-ESTAR ========== */}
          {tab === 2 && (
            <div className="space-y-6">
              <div className="rounded-2xl p-6" style={{ background: G.branco, borderLeft: `6px solid ${G.azul}` }}>
                <h3 className="bc text-xl font-black mb-4" style={{ color: G.azul }}>📅 MICROCICLO SEMANAL</h3>
                <div className="grid grid-cols-7 gap-2">
                  {microcycleData.map((d, i) => (
                    <div key={i} className="rounded-lg p-4 text-center border-2" style={{ borderColor: G.amarelo, background: d.score > 3 ? G.pal.vd : G.pal.am }}>
                      <p className="bc text-xs font-black" style={{ color: G.azul }}>{d.dia}</p>
                      <p className="bc text-2xl font-black mt-2" style={{ color: d.score > 3 ? G.verde : G.amarelo }}>{d.score.toFixed(1)}</p>
                      <p className="text-[10px]" style={{ color: G.cinzaEsc }}>({d.count} reg.)</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ background: G.branco, border: `2px solid ${G.verde}` }}>
                <div className="p-6 border-b" style={{ borderColor: G.pal.vd }}>
                  <h3 className="bc text-xl font-black" style={{ color: G.azul }}>📋 HISTÓRICO BEM-ESTAR</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead style={{ background: G.verde }}>
                      <tr>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>DATA</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>DIA</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>TIPO</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>SONO</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>HORAS</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>RECUP.</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>PSE</th>
                        <th className="px-4 py-3 text-left font-black" style={{ color: G.branco }}>DOR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerWellness.slice(0, 20).map((w, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${G.pal.vd}` }}>
                          <td className="px-4 py-2 font-bold" style={{ color: G.azul }}>{w.date}</td>
                          <td className="px-4 py-2 font-bold" style={{ color: G.verde }}>{w.day}</td>
                          <td className="px-4 py-2 font-bold" style={{ color: G.amarelo }}>{w.type}</td>
                          <td className="px-4 py-2 font-bold" style={{ color: G.amarelo }}>{w.sono || '-'}</td>
                          <td className="px-4 py-2 font-bold" style={{ color: G.verde }}>{w.horas || '-'}</td>
                          <td className="px-4 py-2 font-bold" style={{ color: G.verdeClaro }}>{w.recup || '-'}</td>
                          <td className="px-4 py-2 font-bold" style={{ color: G.laranja }}>{w.pse || '-'}</td>
                          <td className="px-4 py-2 font-bold" style={{ color: w.dor > 0 ? G.vermelho : G.verde }}>{w.dor || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========== TAB 3: DOR ========== */}
          {tab === 3 && (
            <div className="space-y-6">
              <div className="rounded-2xl p-6" style={{ background: G.branco, borderLeft: `6px solid ${G.vermelho}` }}>
                <h3 className="bc text-xl font-black mb-4" style={{ color: G.azul }}>🔴 FREQUÊNCIA DE DOR</h3>
                {painData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={painData} layout="vertical">
                      <CartesianGrid stroke={G.rosa} />
                      <XAxis type="number" stroke={G.vermelho} />
                      <YAxis dataKey="local" type="category" width={180} stroke={G.vermelho} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: G.branco, border: `2px solid ${G.vermelho}` }} />
                      <Bar dataKey="frequencia" fill={G.vermelho} radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: G.verde }}>✅ Sem dor registrada</p>}
              </div>

              {painData.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: G.rosa }}>
                  <h3 className="bc text-xl font-black mb-4" style={{ color: G.vermelho }}>📍 REGIÕES AFETADAS</h3>
                  <div className="flex flex-wrap gap-2">
                    {painData.sort((a, b) => b.frequencia - a.frequencia).map((p, i) => (
                      <span key={i} className="px-4 py-2 rounded-lg font-bold text-sm" style={{ background: G.vermelho, color: G.branco }}>
                        {p.local} ({p.frequencia}x)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
