'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, LabelList, Cell
} from 'recharts'
import { useRouter } from 'next/navigation'
import AppShell from '../../components/layout/AppShell'
import { usePlayerPhotos } from '../../hooks/usePlayerPhotos'
import { PhotoSelectorModal } from '../../components/photos/PhotoSelectorModal'
import { buildResolver, buildAliasGroups, normName } from '@/lib/nameMatch'
import VincularGpsModal from '../../components/VincularGpsModal'
import { CORPO_TECNICO_DEMO_ENABLED, buildDemoWellnessData, buildDemoGpsSessions } from '@/lib/demoCorpoTecnico'

const STYLE = `
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
`
const G = {
  amarelo: '#FDB913', verde: '#0B7C3D', azul: '#1E3A8A',
  branco: '#FFFFFF', cinza: '#F3F4F6', cinzaMed: '#E5E7EB',
  cinzaEsc: '#9CA3AF', vermelho: '#DC2626', laranja: '#EA580C', verdeClaro: '#16A34A',
}

// ─── URLS ───────────────────────────────────────────────────────────────────
const SHEETS = {
  pre: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmx6gtZGEZXYMSLBxFaASfgQAdfwXWCVBCnnTV56QzrbUwy5zW38GZIhvgGERCTe3MufNkmBfWrRlK/pub?output=csv',
  pos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7gU32319qDw3KLwOeyc8UFElJQwYL-X_rM2k5WGYhE0Wq7vdHE5_OXMI0DdWTRCx-Dj5IY35wjgkF/pub?output=csv',
}

// ─── COLUNAS PRÉ-TREINO ─────────────────────────────────────────────────────
// Carimbo de data/hora | Atletas | Peso (kg)
// Apresenta ou apresentou no dia anterior algum sintoma gastrointestinal?...
// Como foi a qualidade do seu sono? (escala)
// Quantas horas você dormiu na última noite?
// Como você classifica sua recuperação?
// Qual a coloração da sua urina?
// QUal a graduação da sua dor
// Está sentindo alguma dor localizada?
// Local da Dor

// ─── COLUNAS PÓS-TREINO ─────────────────────────────────────────────────────
// Carimbo de data/hora | Atleta | Peso (kg)
// Qual sua percepção de esforço pós-treino
// Está sentindo alguma dor localizada?
// Local da Dor

// ─── PARSING ────────────────────────────────────────────────────────────────
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
    return Object.fromEntries(headers.map((h,i) => [h,(vals[i]||'').trim()]))
  }).filter(r => Object.values(r).some(v => v !== ''))
}

// "12/12/2025 15:26:15" → "2025-12-12"
function extractDate(row) {
  const raw = row['Carimbo de data/hora'] || ''
  if (!raw) return ''
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return ''
  const [,d,m,y] = match
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
const URINA_LABELS = ['—','Cristalina','Pálida','Amarela','Amarela Escura','Castanha Escura','Castanha','Marrom Escuro','Marrom']
function urineColor(v) {
  const c = ['#94a3b8','#1e40af','#3b82f6','#eab308','#f59e0b','#d97706','#92400e','#78350f','#451a03']
  return c[Math.min(Math.round(v||0), 8)]
}

// Wellness: média ponderada dos indicadores pré-treino (0 a 1)
function calcWellness(pre) {
  if (!pre) return null
  const sono  = parseFloat(pre['Como foi a qualidade do seu sono?']) || 0       // 1-10
  const horas = parseFloat(pre['Quantas horas você dormiu na última noite?']) || 0 // 1-12
  const recup = parseFloat(pre['Como você classifica sua recuperação?']) || 0    // 1-10
  const urina = parseFloat(pre['Qual a coloração da sua urina?']) || 0           // 1-8 (menor=melhor)
  const dor   = parseFloat(pre['Está sentindo alguma dor localizada?']) || 0     // após trim() do parseSheetCSV
  const scores = [sono/10, Math.min(horas,9)/9, recup/10, 1-(urina/8), 1-(dor/10)]
  return scores.reduce((a,b)=>a+b,0) / scores.length
}

function getScoreStyle(avg) {
  if (avg === null || avg === undefined) return { label:'Sem dados', color:G.cinzaEsc }
  if (avg >= 0.7)  return { label:'Apto', color:G.verdeClaro }
  if (avg >= 0.45) return { label:'Atenção', color:G.laranja }
  return               { label:'Crítico', color:G.vermelho }
}

// ─── ORDENAÇÃO ──────────────────────────────────────────────────────────────
// Prioridade Pré: 0=crítico, 1=atenção (wellness ou recup<7), 2=apto — depois alfabética
function preAlertPriority(row) {
  const w     = calcWellness(row) ?? 1
  const recup = parseFloat(row['Como você classifica sua recuperação?']) || 0
  if (w < 0.45) return 0
  if (w < 0.7 || (recup > 0 && recup < 7)) return 1
  return 2
}

function sortPre(arr, order) {
  if (order === 'alfa') {
    return [...arr].sort((a, b) =>
      (a['Atletas'] || '').trim().localeCompare((b['Atletas'] || '').trim(), 'pt-BR')
    )
  }
  return [...arr].sort((a, b) => {
    const pa = preAlertPriority(a)
    const pb = preAlertPriority(b)
    if (pa !== pb) return pa - pb
    return (a['Atletas'] || '').trim().localeCompare((b['Atletas'] || '').trim(), 'pt-BR')
  })
}

// Prioridade Pós: dor >= 4 primeiro — depois PSE desc (atenção) ou alfa
function sortPos(arr, order) {
  if (order === 'alfa') {
    return [...arr].sort((a, b) =>
      (a['Atleta'] || '').trim().localeCompare((b['Atleta'] || '').trim(), 'pt-BR')
    )
  }
  return [...arr].sort((a, b) => {
    const da = parseFloat(a['Está sentindo alguma dor localizada?']) || 0
    const db = parseFloat(b['Está sentindo alguma dor localizada?']) || 0
    const pa = da >= 4 ? 0 : 1
    const pb = db >= 4 ? 0 : 1
    if (pa !== pb) return pa - pb
    // dentro do mesmo grupo: PSE decrescente
    const psa = parseFloat(a['Qual sua percepção de esforço pós-treino ?']) || 0
    const psb = parseFloat(b['Qual sua percepção de esforço pós-treino ?']) || 0
    if (psb !== psa) return psb - psa
    return (a['Atleta'] || '').trim().localeCompare((b['Atleta'] || '').trim(), 'pt-BR')
  })
}

// Ordenação para aba Dor (pré e pós misturados por nome)
function sortDor(arr, nameKey, order) {
  if (order === 'alfa') {
    return [...arr].sort((a, b) =>
      (a[nameKey] || '').trim().localeCompare((b[nameKey] || '').trim(), 'pt-BR')
    )
  }
  return [...arr].sort((a, b) => {
    const da = parseFloat(a['Está sentindo alguma dor localizada?']) || 0
    const db = parseFloat(b['Está sentindo alguma dor localizada?']) || 0
    if (db !== da) return db - da
    return (a[nameKey] || '').trim().localeCompare((b[nameKey] || '').trim(), 'pt-BR')
  })
}

function fmtDate(d) {
  if (!d) return ''
  const [y,m,day] = d.split('-')
  return new Date(y, m-1, day).toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' })
}

// ─── COMPONENTES ────────────────────────────────────────────────────────────

function MetricBar({ label, value, max=10, invert=false }) {
  const empty = !value && value !== 0
  const pct = empty ? 0 : invert ? ((max+1-value)/max)*100 : (value/max)*100
  const color = pct >= 70 ? G.verdeClaro : pct >= 40 ? G.laranja : G.vermelho
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <span className="text-[8px] font-black uppercase tracking-widest" style={{color:G.cinzaEsc}}>{label}</span>
      <div className="w-full rounded-full h-1.5" style={{background:G.cinzaMed}}>
        {!empty && <div className="h-1.5 rounded-full transition-all" style={{width:`${pct}%`,background:color}}/>}
      </div>
      <span className="text-[9px] font-black" style={{color:empty?G.cinzaEsc:color}}>{empty?'—':value}</span>
    </div>
  )
}

function PlayerAvatar({ nome, photo, color, onClick }) {
  const initials = (nome||'').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()
  return (
    <div
      className={`w-10 h-10 rounded-full flex-shrink-0 overflow-hidden border-2 ${onClick?'cursor-pointer':''}`}
      style={{borderColor: color||G.cinzaMed}}
      onClick={onClick}
    >
      {photo
        ? <img src={photo} alt={nome} className="w-full h-full object-cover object-top"/>
        : <div className="w-full h-full flex items-center justify-center bc text-xs font-black"
            style={{background:(color||G.cinzaMed)+'33', color:color||G.azul}}>
            {initials}
          </div>
      }
    </div>
  )
}

function DorBadge({ dorGrad, dorLocal, label }) {
  // sem dor
  if (!dorGrad || dorGrad === 0) return null
  const isAlert = dorGrad >= 4
  const bg    = isAlert ? '#FEE2E2' : '#FFF7ED'
  const borderC = isAlert ? G.vermelho : G.laranja
  const textC = isAlert ? G.vermelho : G.laranja
  const darkC = isAlert ? '#991B1B' : '#92400E'
  return (
    <div className="rounded-lg px-2 py-1.5 space-y-0.5 border" style={{background: bg, borderColor: borderC}}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-black flex items-center gap-1" style={{color: textC}}>
          {isAlert ? '🚨' : '🩹'} {label || 'Dor'}
          {isAlert && (
            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full text-white" style={{background: G.vermelho}}>
              ATENÇÃO
            </span>
          )}
        </span>
        <span className="text-[11px] font-black" style={{color: textC}}>{dorGrad}/10</span>
      </div>
      {dorLocal && <p className="text-[8px] font-medium leading-tight" style={{color: darkC}}>{dorLocal}</p>}
    </div>
  )
}

function PreCard({ row, getPhotoUrl, onPhotoClick, gpsYesterday, prevDate }) {
  const nome  = (row['Atletas'] || '').trim()
  const photo = getPhotoUrl(nome)
  const sono  = parseFloat(row['Como foi a qualidade do seu sono?']) || 0
  const horas = parseFloat(row['Quantas horas você dormiu na última noite?']) || 0
  const recup = parseFloat(row['Como você classifica sua recuperação?']) || 0
  const urina = parseFloat(row['Qual a coloração da sua urina?']) || 0
  const dorGrad = parseFloat(row['Está sentindo alguma dor localizada?']) || 0
  const dorLocal = (row['Local da Dor'] || '').trim()
  const gi    = (row['Apresenta ou apresentou no dia anterior algum sintoma gastrointestinal? (Ex: diarreia, refluxo, azia, náusea, vômito ou sangramento retal)'] || '').trim()
  const peso  = row['Peso (kg)'] || ''

  const avg = calcWellness(row)
  const { label: wLabel, color: wColor } = getScoreStyle(avg)

  // Recuperação baixa força o card para "Atenção" mesmo que o wellness global seja OK
  const recupAlert = recup > 0 && recup < 7
  // Carga GPS alta no dia anterior + recup baixa = alerta reforçado
  const gpsHighLoad = gpsYesterday && gpsYesterday.dist > 8000
  const label = recupAlert && wLabel === 'Apto' ? 'Atenção' : wLabel
  const color = recupAlert && wLabel === 'Apto' ? G.laranja : wColor

  // Se tem dor >= 4 ou recup < 7, a borda do card fica vermelha/laranja
  const borderColor = dorGrad >= 4 ? G.vermelho : recupAlert ? G.laranja : color
  const urColor = urineColor(urina)
  const urLabel = URINA_LABELS[Math.min(Math.round(urina), 8)]

  // Formata distância GPS em km
  const fmtDist = (m) => m >= 1000 ? `${(m/1000).toFixed(2)} km` : `${Math.round(m)} m`
  const fmtM    = (m) => `${Math.round(m)} m`

  return (
    <div className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border-2" style={{borderColor: borderColor, background:G.branco}}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{borderColor: borderColor+'33', background: borderColor+'11'}}>
        <PlayerAvatar nome={nome} photo={photo} color={borderColor} onClick={()=>onPhotoClick(nome)}/>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase text-gray-900 truncate">{nome}</p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {peso && <span className="text-[9px] font-medium" style={{color:G.cinzaEsc}}>{peso} kg</span>}
            {gi === 'Sim' && (
              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full" style={{background:'#FEE2E2',color:G.vermelho}}>⚠️ GI</span>
            )}
            {dorGrad >= 4 && (
              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full" style={{background:'#FEE2E2', color:G.vermelho}}>🚨 DOR {dorGrad}/10</span>
            )}
            {recupAlert && dorGrad < 4 && (
              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full" style={{background:'#FFF3CD', color:'#92400E'}}>
                {gpsHighLoad ? '🔥' : '⚡'} RECUP {recup}/10
              </span>
            )}
          </div>
        </div>
        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full whitespace-nowrap" style={{background:color+'22', color}}>{label}</span>
      </div>

      {/* Métricas bem-estar */}
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          <MetricBar label="Sono" value={sono} max={10}/>
          <MetricBar label="Horas" value={horas} max={9}/>
          <MetricBar label="Recup." value={recup} max={10}/>
        </div>

        {/* Urina */}
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black uppercase" style={{color:G.cinzaEsc}}>Hidratação</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-gray-200" style={{background:urColor}}/>
            <span className="text-[9px] font-black" style={{color:urColor}}>{urLabel}</span>
          </div>
        </div>

        {/* Dor */}
        <DorBadge dorGrad={dorGrad} dorLocal={dorLocal} label="Dor (pré)" />

        {/* GPS do dia anterior */}
        {gpsYesterday ? (
          <div className="rounded-lg border pt-2 pb-2 px-2.5 mt-1" style={{background:'#F0F9FF', borderColor:'#BAE6FD'}}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[7px] font-black uppercase tracking-widest" style={{color:'#0369A1'}}>
                📡 GPS {prevDate ? prevDate.slice(5).replace('-','/') : 'Ontem'}
              </span>
              {gpsHighLoad && recupAlert && (
                <span className="text-[6px] font-black uppercase px-1 py-0.5 rounded" style={{background:'#FEF3C7', color:'#92400E'}}>
                  Carga Alta
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div>
                <p className="text-[6px] font-bold uppercase text-gray-400">Distância</p>
                <p className="text-[11px] font-black" style={{color:'#0369A1'}}>{fmtDist(gpsYesterday.dist)}</p>
              </div>
              <div>
                <p className="text-[6px] font-bold uppercase text-gray-400">HSR &gt;20 km/h</p>
                <p className="text-[11px] font-black" style={{color: gpsYesterday.hsr > 600 ? G.laranja : '#0369A1'}}>{fmtM(gpsYesterday.hsr)}</p>
              </div>
              <div>
                <p className="text-[6px] font-bold uppercase text-gray-400">Sprint &gt;25 km/h</p>
                <p className="text-[11px] font-black" style={{color: gpsYesterday.dist25 > 200 ? G.vermelho : '#0369A1'}}>{fmtM(gpsYesterday.dist25)}</p>
              </div>
              <div>
                <p className="text-[6px] font-bold uppercase text-gray-400">Nº Sprints</p>
                <p className="text-[11px] font-black" style={{color:'#0369A1'}}>{gpsYesterday.sprints}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border px-2.5 py-1.5" style={{background:'#F9FAFB', borderColor:'#E5E7EB'}}>
            <span className="text-[7px] font-bold uppercase text-gray-400">📡 Sem GPS do dia anterior</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PosCard({ row, getPhotoUrl }) {
  const nome   = (row['Atleta'] || '').trim()
  const photo  = getPhotoUrl(nome)
  const pse    = parseFloat(row['Qual sua percepção de esforço pós-treino ?']) || 0
  const dorGrad  = parseFloat(row['Está sentindo alguma dor localizada?']) || 0
  const dorLocal = (row['Local da Dor'] || '').trim()
  const peso   = row['Peso (kg)'] || ''

  const pseColor = pse >= 8 ? G.vermelho : pse >= 5 ? G.laranja : G.verdeClaro
  const pseLabel = pse <= 2 ? 'Muito Fraco' : pse <= 4 ? 'Moderado' : pse <= 6 ? 'Forte' : pse <= 8 ? 'Muito Forte' : 'Máximo'
  const cardBorder = dorGrad >= 4 ? G.vermelho : G.cinzaMed
  const cardBg     = dorGrad >= 4 ? '#FFF5F5' : G.cinza

  return (
    <div className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border-2" style={{borderColor: cardBorder, background:G.branco}}>
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{borderColor: cardBorder+'55', background: cardBg}}>
        <PlayerAvatar nome={nome} photo={photo} color={G.cinzaMed}/>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase text-gray-900 truncate">{nome}</p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {peso && <span className="text-[9px] font-medium" style={{color:G.cinzaEsc}}>{peso} kg</span>}
            {dorGrad >= 4 && (
              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full" style={{background:'#FEE2E2', color:G.vermelho}}>🚨 DOR {dorGrad}/10</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* PSE */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase" style={{color:G.cinzaEsc}}>PSE</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black" style={{color:pseColor}}>{pse || '—'}</span>
            {pse > 0 && <span className="text-[9px] font-black" style={{color:G.cinzaEsc}}>{pseLabel}</span>}
          </div>
        </div>
        {pse > 0 && (
          <div className="w-full rounded-full h-2" style={{background:G.cinzaMed}}>
            <div className="h-2 rounded-full transition-all" style={{width:`${(pse/10)*100}%`, background:pseColor}}/>
          </div>
        )}

        {/* Dor pós */}
        <DorBadge dorGrad={dorGrad} dorLocal={dorLocal} label="Dor (pós)" />
      </div>
    </div>
  )
}

// ─── HELPERS COMPARTILHADOS ──────────────────────────────────────────────────
function normalizeName(n) { return normName(n) }
function num(v) { return parseFloat((v||'0').toString().replace(',','.')) || 0 }

// ─── ABA CARGA GPS × PSE ─────────────────────────────────────────────────────
function TabCargaPSE({ posRows, gpsSessions, getPhotoUrl, resolveGps }) {
  const [metricX, setMetricX] = useState('totalDistance')
  const [filterDate, setFilterDate] = useState('all')

  const METRICS_X = [
    { key:'totalDistance', label:'Distância Total (m)' },
    { key:'dist20',        label:'HSR > 20 km/h (m)' },
    { key:'dist25',        label:'Sprint > 25 (m)' },
    { key:'sprints',       label:'Nº Sprints' },
    { key:'accel',         label:'Acelerações' },
    { key:'maxVel',        label:'Vel. Máxima (km/h)' },
  ]

  // Cruza posRows com gpsSessions pelo mesmo dia (data_sessao = data do Sheets)
  const points = useMemo(() => {
    const result = []
    posRows.forEach(pr => {
      const date = extractDate(pr)
      const nomePos = normalizeName(pr['Atleta'])
      const pse = num(pr['Qual sua percepção de esforço pós-treino ?'])
      if (!date || !nomePos || pse === 0) return
      // Procura sessão GPS do mesmo dia — normaliza formato da data do Postgres
      const gpsMatch = gpsSessions.find(s => {
        let gDate = s.data_sessao
        if (!gDate) return false
        // Date object, ISO string com timezone, ou string simples YYYY-MM-DD
        if (typeof gDate === 'object') gDate = gDate.toISOString()
        gDate = String(gDate).slice(0, 10)
        return gDate === date
      })
      if (!gpsMatch) return
      const gpsRows = Array.isArray(gpsMatch.rows) ? gpsMatch.rows : (gpsMatch.rows?.rows || [])
      const alvoGps = resolveGps ? normalizeName(resolveGps(pr['Atleta'])) : nomePos
      const gpsRow = gpsRows.find(r => normalizeName(r.playerName) === alvoGps)
      if (!gpsRow) return
      const xVal = num(gpsRow[metricX])
      if (xVal === 0) return
      result.push({
        nome: pr['Atleta'],
        date,
        pse,
        xVal,
        sessionTipo: gpsMatch.tipo_sessao || 'Treino',
        dist: num(gpsRow.totalDistance),
        hsr: num(gpsRow.dist20),
      })
    })
    return result
  }, [posRows, gpsSessions, metricX, resolveGps])

  // Filtrar por data
  const dates = [...new Set(points.map(p => p.date))].sort().reverse()
  const filtered = filterDate === 'all' ? points : points.filter(p => p.date === filterDate)

  // Correlação simples (Pearson)
  const pearson = useMemo(() => {
    const n = filtered.length
    if (n < 3) return null
    const xs = filtered.map(p => p.xVal)
    const ys = filtered.map(p => p.pse)
    const mx = xs.reduce((a,b)=>a+b,0)/n
    const my = ys.reduce((a,b)=>a+b,0)/n
    const pearsonNum = filtered.reduce((s,p) => s + (p.xVal-mx)*(p.pse-my), 0)
    const den = Math.sqrt(filtered.reduce((s,p)=>s+(p.xVal-mx)**2,0) * filtered.reduce((s,p)=>s+(p.pse-my)**2,0))
    return den === 0 ? 0 : (pearsonNum/den).toFixed(2)
  }, [filtered])

  // Quadrantes: alto GPS × alto PSE, alto GPS × baixo PSE, etc.
  const avgX = filtered.length ? filtered.reduce((s,p)=>s+p.xVal,0)/filtered.length : 0
  const avgY = filtered.length ? filtered.reduce((s,p)=>s+p.pse,0)/filtered.length : 0

  const quadrant = (p) => {
    const hiX = p.xVal >= avgX, hiY = p.pse >= avgY
    if (hiX && hiY)  return { label:'Alta Carga · Alta PSE',  color:'#0B7C3D', q:'HH' }
    if (hiX && !hiY) return { label:'Alta Carga · Baixa PSE', color:'#0ea5e9', q:'HL' }
    if (!hiX && hiY) return { label:'Baixa Carga · Alta PSE', color:'#dc2626', q:'LH' } // alerta
    return                  { label:'Baixa Carga · Baixa PSE',color:'#9ca3af', q:'LL' }
  }

  const alertas = filtered.filter(p => quadrant(p).q === 'LH')

  const fmtDate = d => {
    if (!d) return ''
    const [y,m,day] = d.split('-')
    return new Date(y,m-1,day).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})
  }

  const curLabel = METRICS_X.find(m=>m.key===metricX)?.label || ''

  return (
    <div className="space-y-5 fade-in">

      {/* Controles */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Métrica GPS (Eixo X)</p>
          <select value={metricX} onChange={e=>setMetricX(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] font-semibold text-gray-700 focus:outline-none focus:border-sky-400 bg-gray-50">
            {METRICS_X.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Data</p>
          <select value={filterDate} onChange={e=>setFilterDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-[10px] font-semibold text-gray-700 focus:outline-none focus:border-sky-400 bg-gray-50">
            <option value="all">Todas ({points.length} pontos)</option>
            {dates.map(d=><option key={d} value={d}>{fmtDate(d)}</option>)}
          </select>
        </div>
        {pearson !== null && (
          <div className="ml-auto px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-center">
            <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Correlação (r)</p>
            <p className="bc text-2xl font-black leading-none" style={{color: Math.abs(pearson)>0.6?'#0B7C3D':Math.abs(pearson)>0.3?'#f59e0b':'#9ca3af'}}>{pearson}</p>
            <p className="text-[7px] text-gray-400">{Math.abs(pearson)>0.6?'forte':Math.abs(pearson)>0.3?'moderada':'fraca'}</p>
          </div>
        )}
      </div>

      {/* Alerta quadrante LH */}
      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl">🚨</span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-red-700 mb-1">
              {alertas.length} atleta{alertas.length>1?'s':''} com PSE ALTO mas carga GPS BAIXA — possível fadiga acumulada ou fator extracampo
            </p>
            <div className="flex flex-wrap gap-2">
              {alertas.map((p,i)=>(
                <span key={i} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {p.nome} — PSE {p.pse} · {curLabel.split('(')[0].trim()}: {p.xVal.toFixed(0)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <p className="text-3xl mb-2">📡</p>
          {gpsSessions.length === 0 ? (
            <>
              <p className="bc text-xl font-black uppercase text-gray-300">Sessões GPS não carregadas</p>
              <p className="text-xs text-gray-400 mt-1">Nenhuma sessão GPS encontrada. Faça upload na aba GPS para habilitar o cruzamento.</p>
            </>
          ) : (
            <>
              <p className="bc text-xl font-black uppercase text-gray-300">Sem cruzamento GPS × PSE no período</p>
              <p className="text-xs text-gray-400 mt-1">
                {gpsSessions.length} sessão(ões) GPS · {posRows.length} resposta(s) pós-treino carregadas.
                As datas dos formulários e das sessões GPS precisam coincidir.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Scatter manual (recharts não tem scatter com dots, usamos ScatterChart) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Dispersão — {curLabel} vs PSE</p>
            <p className="text-[7px] text-gray-400 mb-4">Cada ponto = um atleta em uma sessão. Linhas tracejadas = médias do grupo</p>
            <div className="relative" style={{height:320}}>
              {/* Grid de quadrantes */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                {[
                  {label:'Alta Carga\nBaixa PSE',bg:'#eff6ff',text:'#0ea5e9'},
                  {label:'Alta Carga\nAlta PSE',bg:'#f0fdf4',text:'#0B7C3D'},
                  {label:'Baixa Carga\nBaixa PSE',bg:'#f9fafb',text:'#9ca3af'},
                  {label:'⚠️ Baixa Carga\nAlta PSE',bg:'#fef2f2',text:'#dc2626'},
                ].map((q,i)=>(
                  <div key={i} className="flex items-end justify-center pb-1" style={{background:q.bg,opacity:0.5}}>
                    <span className="text-[7px] font-bold text-center whitespace-pre-line" style={{color:q.text}}>{q.label}</span>
                  </div>
                ))}
              </div>
              {/* Pontos */}
              <svg className="absolute inset-0 w-full h-full">
                {filtered.map((p,i) => {
                  const maxX = Math.max(...filtered.map(f=>f.xVal))
                  const px = 32 + ((p.xVal / maxX) * (100-32-8)) + '%'
                  const py = (300 - ((p.pse / 10) * 280)) + 'px'
                  const q = quadrant(p)
                  return (
                    <g key={i}>
                      <circle cx={px} cy={py} r={6} fill={q.color} fillOpacity={0.8} stroke="white" strokeWidth={1.5}>
                        <title>{p.nome} | {fmtDate(p.date)} | {curLabel}: {p.xVal.toFixed(0)} | PSE: {p.pse}</title>
                      </circle>
                      <text x={px} y={py} dy={-9} textAnchor="middle" fontSize={7} fill="#374151" fontWeight="700">
                        {p.nome.split(' ')[0].slice(0,8)}
                      </text>
                    </g>
                  )
                })}
                {/* Eixos labels */}
                <text x="50%" y="315" textAnchor="middle" fontSize={8} fill="#9ca3af" fontWeight="700">{curLabel}</text>
                <text x="8" y="160" textAnchor="middle" fontSize={8} fill="#9ca3af" fontWeight="700" transform="rotate(-90,8,160)">PSE</text>
              </svg>
            </div>
          </div>

          {/* Tabela ordenada por PSE */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Ranking por PSE</p>
            </div>
            <div className="overflow-y-auto" style={{maxHeight:360}}>
              <table className="w-full text-[10px]">
                <thead>
                  <tr style={{background:'#0B7C3D'}}>
                    {['Atleta','Data','PSE',curLabel.split('(')[0].trim(),'Quadrante'].map(h=>(
                      <th key={h} className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-white text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].sort((a,b)=>b.pse-a.pse).map((p,i)=>{
                    const q = quadrant(p)
                    const pseColor = p.pse>=8?'#dc2626':p.pse>=6?'#f59e0b':'#0B7C3D'
                    return (
                      <tr key={i} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                        <td className="px-2 py-2 font-bold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {getPhotoUrl(p.nome)&&<img src={getPhotoUrl(p.nome)} className="w-5 h-5 rounded-full object-cover object-top"/>}
                            {p.nome.split(' ')[0]}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{fmtDate(p.date)}</td>
                        <td className="px-2 py-2 tabular-nums font-black" style={{color:pseColor}}>{p.pse}</td>
                        <td className="px-2 py-2 tabular-nums text-gray-600">{p.xVal.toFixed(0)}</td>
                        <td className="px-2 py-2">
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{background:q.color+'22',color:q.color,border:`1px solid ${q.color}55`}}>
                            {q.q==='LH'?'⚠️ ':''}{q.label.split('·')[1].trim()}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ABA AGUDO × CRÔNICO (ACWR) ──────────────────────────────────────────────
const PSE_COL = 'Qual sua percepção de esforço pós-treino ?'

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function fmtDataBR(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}`
}
function acwrZona(acwr) {
  if (acwr === null) return { label: 'Sem dados', color: '#94A3B8', bg: '#F1F5F9' }
  if (acwr < 0.8)  return { label: 'Destreino',  color: '#1E3A8A', bg: '#DBEAFE' }
  if (acwr <= 1.3) return { label: 'Zona Ideal', color: '#0B7C3D', bg: '#DCFCE7' }
  if (acwr <= 1.5) return { label: 'Atenção',    color: '#EA580C', bg: '#FFEDD5' }
  return               { label: 'Risco Alto', color: '#DC2626', bg: '#FEE2E2' }
}

function TabAgudoCronico({ posRows, duracoes, onSaveDuracao, getPhotoUrl }) {
  const [refDate, setRefDate] = useState('')
  const [editDur, setEditDur] = useState({})
  const [savingDate, setSavingDate] = useState(null)

  // Todas as datas com resposta de PSE (pós-treino), únicas e ordenadas
  const datasComPSE = useMemo(() => {
    const set = new Set()
    posRows.forEach(r => {
      const date = extractDate(r)
      const pse = num(r[PSE_COL])
      if (date && pse > 0) set.add(date)
    })
    return [...set].sort()
  }, [posRows])

  useEffect(() => {
    if (!refDate && datasComPSE.length > 0) setRefDate(datasComPSE[datasComPSE.length - 1])
  }, [datasComPSE, refDate])

  // Carga diária por atleta: pse × duração do dia (se a duração estiver cadastrada)
  const cargaPorAtletaData = useMemo(() => {
    const map = {} // nome -> { data -> carga }
    posRows.forEach(r => {
      const date = extractDate(r)
      const nome = (r['Atleta'] || '').trim()
      const pse = num(r[PSE_COL])
      if (!date || !nome || pse === 0) return
      const dur = duracoes[date]
      if (!dur) return
      if (!map[nome]) map[nome] = {}
      map[nome][date] = pse * dur
    })
    return map
  }, [posRows, duracoes])

  const datasFaltandoDuracao = datasComPSE.filter(d => !duracoes[d])

  // Tabela ACWR por atleta, referenciada na data selecionada
  const tabela = useMemo(() => {
    if (!refDate) return []
    const inicioAgudo   = addDaysStr(refDate, -6)   // últimos 7 dias (incl. refDate)
    const inicioCronico = addDaysStr(refDate, -27)  // últimos 28 dias (incl. refDate)

    return Object.entries(cargaPorAtletaData).map(([nome, cargas]) => {
      let agudo = 0, cronico = 0, diasComCargaCronico = 0
      Object.entries(cargas).forEach(([d, carga]) => {
        if (d > refDate) return
        if (d >= inicioAgudo)   agudo += carga
        if (d >= inicioCronico) { cronico += carga; diasComCargaCronico++ }
      })
      const cronicoSemanal = diasComCargaCronico > 0 ? (cronico / 4) : 0
      const acwr = cronicoSemanal > 0 ? (agudo / cronicoSemanal) : null
      return { nome, agudo, cronicoSemanal, acwr, zona: acwrZona(acwr) }
    }).sort((a, b) => (b.acwr ?? -1) - (a.acwr ?? -1))
  }, [cargaPorAtletaData, refDate])

  async function salvarDuracao(date) {
    const val = parseInt(editDur[date], 10)
    if (!val || val <= 0) return
    setSavingDate(date)
    try {
      await onSaveDuracao(date, val)
    } finally {
      setSavingDate(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* EXPLICAÇÃO RÁPIDA */}
      <div className="rounded-xl p-3 border-2" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <p className="text-[10px] font-medium leading-relaxed" style={{ color: '#1E3A8A' }}>
          <strong>Carga (sRPE)</strong> = PSE × duração do treino (min). <strong>Carga Aguda</strong> = soma dos últimos 7 dias.
          <strong> Carga Crônica</strong> = média semanal dos últimos 28 dias. <strong>ACWR</strong> = Aguda ÷ Crônica.
          Zona ideal entre 0.8 e 1.3 · atenção 1.3–1.5 · risco acima de 1.5.
        </p>
      </div>

      {/* DURAÇÃO DOS TREINOS */}
      <div className="rounded-xl p-4 border-2" style={{ borderColor: G.cinzaMed }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: G.azul }}>Duração dos Treinos</p>
          {datasFaltandoDuracao.length > 0 && (
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg" style={{ background: '#FFEDD5', color: '#EA580C' }}>
              {datasFaltandoDuracao.length} dia(s) sem duração cadastrada
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {datasComPSE.slice().reverse().map(date => (
            <div key={date} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 border"
              style={{ borderColor: duracoes[date] ? G.cinzaMed : '#FDBA74', background: duracoes[date] ? G.branco : '#FFF7ED' }}>
              <span className="text-[10px] font-black" style={{ color: G.azul }}>{fmtDataBR(date)}</span>
              <input
                type="number"
                min="1"
                placeholder="min"
                defaultValue={duracoes[date] || ''}
                onChange={e => setEditDur(prev => ({ ...prev, [date]: e.target.value }))}
                className="w-14 text-[10px] font-bold px-1 py-0.5 rounded border text-center"
                style={{ borderColor: G.cinzaMed }}
              />
              <button
                onClick={() => salvarDuracao(date)}
                disabled={savingDate === date}
                className="text-[9px] font-black uppercase px-2 py-0.5 rounded"
                style={{ background: G.verde, color: G.branco, opacity: savingDate === date ? 0.5 : 1 }}>
                {savingDate === date ? '...' : 'OK'}
              </button>
            </div>
          ))}
          {datasComPSE.length === 0 && (
            <p className="text-[10px]" style={{ color: G.cinzaEsc }}>Nenhuma resposta de PSE encontrada ainda.</p>
          )}
        </div>
      </div>

      {/* DATA DE REFERÊNCIA */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: G.cinzaEsc }}>Calcular ACWR em:</label>
        <select value={refDate} onChange={e => setRefDate(e.target.value)}
          className="text-xs font-bold px-2 py-1.5 rounded-lg border-2" style={{ borderColor: G.amarelo, color: G.azul }}>
          {datasComPSE.slice().reverse().map(d => <option key={d} value={d}>{fmtDataBR(d)}</option>)}
        </select>
      </div>

      {/* TABELA ACWR */}
      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: G.cinzaMed }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: G.azul }}>
              <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-white">Atleta</th>
              <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-white">Carga Aguda (7d)</th>
              <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-white">Carga Crônica (média/sem)</th>
              <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-white">ACWR</th>
              <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-white">Zona</th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((row, i) => (
              <tr key={row.nome} style={{ background: i % 2 === 0 ? G.branco : G.cinza }}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <img src={getPhotoUrl ? getPhotoUrl(row.nome) : undefined} alt=""
                      className="w-6 h-6 rounded-full object-cover" style={{ background: G.cinzaMed }}
                      onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                    <span className="text-[11px] font-black uppercase" style={{ color: G.azul }}>{row.nome}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center text-xs font-bold" style={{ color: G.cinzaEsc }}>{row.agudo.toFixed(0)}</td>
                <td className="px-3 py-2 text-center text-xs font-bold" style={{ color: G.cinzaEsc }}>{row.cronicoSemanal.toFixed(0)}</td>
                <td className="px-3 py-2 text-center text-sm font-black" style={{ color: row.zona.color }}>
                  {row.acwr !== null ? row.acwr.toFixed(2) : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg" style={{ background: row.zona.bg, color: row.zona.color }}>
                    {row.zona.label}
                  </span>
                </td>
              </tr>
            ))}
            {tabela.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-[10px]" style={{ color: G.cinzaEsc }}>
                Cadastre a duração dos treinos acima para calcular o ACWR.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ABA HEATMAP WELLNESS ────────────────────────────────────────────────────
function TabHeatmap({ preRows }) {
  const [nDates, setNDates] = useState(14)

  // Datas únicas mais recentes
  const allDates = useMemo(() =>
    [...new Set(preRows.map(r => extractDate(r)).filter(Boolean))].sort().reverse()
  , [preRows])

  const dates = allDates.slice(0, nDates).reverse() // cronológico

  // Atletas únicos
  const athletes = useMemo(() =>
    [...new Set(preRows.map(r => (r['Atletas']||'').trim()).filter(Boolean))].sort()
  , [preRows])

  // Mapa (atleta, data) → wellness
  const wellnessMap = useMemo(() => {
    const map = {}
    preRows.forEach(r => {
      const nome = (r['Atletas']||'').trim()
      const date = extractDate(r)
      if (!nome || !date) return
      const w = calcWellness(r)
      if (w !== null) map[`${nome}__${date}`] = w
    })
    return map
  }, [preRows])

  const cellColor = (w) => {
    if (w === undefined || w === null) return { bg:'#f3f4f6', text:'#d1d5db' }
    if (w >= 0.7) return { bg:'#dcfce7', text:'#166534' }
    if (w >= 0.45) return { bg:'#fef9c3', text:'#854d0e' }
    return { bg:'#fee2e2', text:'#991b1b' }
  }

  // Média de wellness por data (visão do grupo)
  const dateAvg = dates.map(d => {
    const vals = athletes.map(a => wellnessMap[`${a}__${d}`]).filter(v => v !== undefined)
    return vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null
  })

  const fmtShort = d => {
    if (!d) return ''
    const [y,m,day] = d.split('-')
    return new Date(y,m-1,day).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
  }

  return (
    <div className="space-y-5 fade-in">

      {/* Controles */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Últimos dias:</p>
        <div className="flex gap-1.5">
          {[7,14,21,30].map(n=>(
            <button key={n} onClick={()=>setNDates(n)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all ${nDates===n?'text-white shadow-sm':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              style={nDates===n?{background:'#0B7C3D'}:{}}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          {[{c:'#dcfce7',t:'#166534',l:'Apto ≥70%'},{c:'#fef9c3',t:'#854d0e',l:'Atenção 45–70%'},{c:'#fee2e2',t:'#991b1b',l:'Crítico <45%'},{c:'#f3f4f6',t:'#d1d5db',l:'Sem resposta'}].map((x,i)=>(
            <div key={i} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm border border-gray-200" style={{background:x.c}}/>
              <span className="text-[8px] font-bold" style={{color:x.t}}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4">Wellness por Atleta × Data</p>

        {athletes.length === 0 ? (
          <p className="text-center py-8 text-gray-300 text-sm">Sem dados de pré-treino</p>
        ) : (
          <table className="w-full border-collapse" style={{minWidth: dates.length*52 + 140}}>
            <thead>
              <tr>
                <th className="text-left px-2 py-2 text-[8px] font-black uppercase tracking-widest text-gray-400 w-36">Atleta</th>
                {dates.map((d,i)=>(
                  <th key={d} className="px-1 py-2 text-center min-w-[48px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px] font-black text-gray-600">{fmtShort(d)}</span>
                      {dateAvg[i] !== null && (
                        <div className="w-8 h-1 rounded-full" style={{background: dateAvg[i]>=0.7?'#0B7C3D':dateAvg[i]>=0.45?'#f59e0b':'#dc2626'}}/>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-gray-400 text-center">Média</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((nome, ai) => {
                const vals = dates.map(d => wellnessMap[`${nome}__${d}`])
                const known = vals.filter(v => v !== undefined)
                const avg = known.length ? known.reduce((s,v)=>s+v,0)/known.length : null
                const avgStyle = cellColor(avg)
                return (
                  <tr key={nome} className={ai%2===0?'':'bg-gray-50/30'}>
                    <td className="px-2 py-1 text-[9px] font-bold text-gray-800 truncate max-w-[140px]">{nome.split(' ')[0]} {nome.split(' ').slice(-1)[0]}</td>
                    {vals.map((w, di) => {
                      const s = cellColor(w)
                      return (
                        <td key={di} className="px-1 py-1 text-center">
                          <div className="rounded-lg w-10 h-8 mx-auto flex items-center justify-center text-[9px] font-black border"
                            style={{background:s.bg, color:s.text, borderColor:s.bg==='#f3f4f6'?'#e5e7eb':s.bg}}>
                            {w !== undefined ? (w*10).toFixed(0) : '·'}
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-2 py-1 text-center">
                      <div className="rounded-lg w-10 h-8 mx-auto flex items-center justify-center text-[9px] font-black border"
                        style={{background:avgStyle.bg, color:avgStyle.text, borderColor:avgStyle.bg==='#f3f4f6'?'#e5e7eb':avgStyle.bg}}>
                        {avg !== null ? (avg*10).toFixed(0) : '·'}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {/* Linha média do grupo */}
              <tr className="border-t-2 border-gray-300">
                <td className="px-2 py-1 text-[8px] font-black uppercase tracking-widest text-gray-500">Média Grupo</td>
                {dateAvg.map((avg,di)=>{
                  const s = cellColor(avg)
                  return (
                    <td key={di} className="px-1 py-1 text-center">
                      <div className="rounded-lg w-10 h-8 mx-auto flex items-center justify-center text-[9px] font-black border"
                        style={{background:s.bg, color:s.text, borderColor:s.bg==='#f3f4f6'?'#e5e7eb':s.bg}}>
                        {avg !== null ? (avg*10).toFixed(0) : '·'}
                      </div>
                    </td>
                  )
                })}
                <td/>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── ABA WELLNESS POR POSIÇÃO ────────────────────────────────────────────────
function TabWellnessPosicao({ preRows, posRows, gpsSessions, resolveGps }) {

  // Posição: tenta pegar do GPS pelas linhas do elenco, senão usa campo livre
  const posMap = useMemo(() => {
    const map = {}
    gpsSessions.forEach(s => {
      const rows = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
      rows.forEach(r => {
        if (r.playerName && r.positionName && !map[normalizeName(r.playerName)]) {
          map[normalizeName(r.playerName)] = r.positionName
        }
      })
    })
    return map
  }, [gpsSessions])

  const getPos = (nome) => {
    const gpsNome = resolveGps ? resolveGps(nome) : nome
    return posMap[normalizeName(gpsNome)] || posMap[normalizeName(nome)] || 'Sem posição'
  }

  // Agrupa métricas pré por posição
  const METRICAS_PRE = [
    { key:'sono',  label:'Qualidade Sono', field:'Como foi a qualidade do seu sono?', max:10, color:'#0B7C3D' },
    { key:'recup', label:'Recuperação',    field:'Como você classifica sua recuperação?', max:10, color:'#0ea5e9' },
    { key:'horas', label:'Horas de Sono',  field:'Quantas horas você dormiu na última noite?', max:9, color:'#a855f7' },
  ]

  const posMedPre = useMemo(() => {
    const acc = {}
    preRows.forEach(r => {
      const nome = (r['Atletas']||'').trim()
      const pos = getPos(nome)
      if (!acc[pos]) acc[pos] = { pos, count:0, sono:[], recup:[], horas:[], wellness:[] }
      METRICAS_PRE.forEach(m => {
        const v = num(r[m.field])
        if (v > 0) acc[pos][m.key].push(v)
      })
      const w = calcWellness(r)
      if (w !== null) acc[pos].wellness.push(w)
      acc[pos].count++
    })
    return Object.values(acc).map(p => ({
      pos: p.pos,
      count: p.count,
      sono:    p.sono.length    ? (p.sono.reduce((s,v)=>s+v,0)/p.sono.length).toFixed(1)    : null,
      recup:   p.recup.length   ? (p.recup.reduce((s,v)=>s+v,0)/p.recup.length).toFixed(1)  : null,
      horas:   p.horas.length   ? (p.horas.reduce((s,v)=>s+v,0)/p.horas.length).toFixed(1)  : null,
      wellness:p.wellness.length? (p.wellness.reduce((s,v)=>s+v,0)/p.wellness.length*10).toFixed(1) : null,
    })).sort((a,b)=>b.count-a.count)
  }, [preRows, posMap])

  // PSE médio por posição
  const posMedPse = useMemo(() => {
    const acc = {}
    posRows.forEach(r => {
      const nome = (r['Atleta']||'').trim()
      const pos = getPos(nome)
      const pse = num(r['Qual sua percepção de esforço pós-treino ?'])
      if (pse === 0) return
      if (!acc[pos]) acc[pos] = []
      acc[pos].push(pse)
    })
    return Object.entries(acc).map(([pos, vals]) => ({
      pos,
      pse: (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1),
      count: vals.length,
    })).sort((a,b)=>parseFloat(b.pse)-parseFloat(a.pse))
  }, [posRows, posMap])

  // Dor por posição
  const posDor = useMemo(() => {
    const acc = {}
    preRows.forEach(r => {
      const nome = (r['Atletas']||'').trim()
      const pos = getPos(nome)
      const dor = num(r['QUal a graduação da sua dor'] || r['Está sentindo alguma dor localizada?'])
      if (!acc[pos]) acc[pos] = { total:0, comDor:0 }
      acc[pos].total++
      if (dor > 0) acc[pos].comDor++
    })
    return Object.entries(acc).map(([pos,v])=>({
      pos,
      pct: ((v.comDor/v.total)*100).toFixed(0),
      comDor: v.comDor,
      total: v.total,
    })).sort((a,b)=>parseFloat(b.pct)-parseFloat(a.pct))
  }, [preRows, posMap])

  const posColors = {'Goleiro':'#7c3aed','Zagueiro':'#0B7C3D','Lateral':'#0ea5e9','Volante':'#f59e0b','Meia':'#f97316','Extremo':'#ec4899','Atacante':'#dc2626','Sem posição':'#9ca3af'}
  const getColor = pos => {
    const k = Object.keys(posColors).find(k => pos.toLowerCase().includes(k.toLowerCase()))
    return k ? posColors[k] : '#6366f1'
  }

  return (
    <div className="space-y-5 fade-in">

      {/* Wellness médio por posição */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4">Wellness Médio × Posição</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {posMedPre.map((p, i) => {
            const c = getColor(p.pos)
            const wNum = parseFloat(p.wellness)
            const wColor = wNum >= 7 ? '#0B7C3D' : wNum >= 4.5 ? '#f59e0b' : '#dc2626'
            return (
              <div key={i} className="rounded-xl border border-gray-200 p-3 shadow-sm" style={{borderLeftWidth:4, borderLeftColor:c}}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{color:c}}>{p.pos}</p>
                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.count} resp.</span>
                </div>
                <p className="bc text-3xl font-black leading-none" style={{color:wColor}}>{p.wellness || '—'}</p>
                <p className="text-[7px] text-gray-400 mt-0.5">wellness /10</p>
                <div className="mt-2 space-y-1">
                  {[
                    {label:'Sono',val:p.sono,max:10},
                    {label:'Recup.',val:p.recup,max:10},
                    {label:'Horas',val:p.horas,max:9},
                  ].map(m=>(
                    <div key={m.label} className="flex items-center gap-2">
                      <span className="text-[7px] text-gray-400 w-10">{m.label}</span>
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${m.val?(m.val/m.max)*100:0}%`,background:c}}/>
                      </div>
                      <span className="text-[8px] font-bold text-gray-600 w-6 text-right">{m.val||'—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={posMedPre.filter(p=>p.wellness)} margin={{top:4,right:16,left:-10,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="pos" tick={{fontSize:8,fontWeight:700,fill:'#4b5563'}}/>
            <YAxis domain={[0,10]} tick={{fontSize:8,fill:'#9ca3af'}}/>
            <Tooltip contentStyle={{fontSize:10,borderRadius:8,border:'1px solid #e2e8f0'}}
              formatter={(v,n)=>[v,n]}/>
            <ReferenceLine y={7} stroke="#0B7C3D" strokeDasharray="4 2" strokeWidth={1.5} label={{value:'Apto',fontSize:8,fill:'#0B7C3D',position:'right'}}/>
            <ReferenceLine y={4.5} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} label={{value:'Atenção',fontSize:8,fill:'#f59e0b',position:'right'}}/>
            <Bar dataKey="wellness" name="Wellness" radius={[4,4,0,0]} maxBarSize={48}>
              {posMedPre.filter(p=>p.wellness).map((p,i)=>(
                <Cell key={i} fill={getColor(p.pos)}/>
              ))}
            </Bar>
            <Bar dataKey="sono" name="Sono" radius={[4,4,0,0]} maxBarSize={48} fill="#0B7C3D" fillOpacity={0.3}/>
            <Bar dataKey="recup" name="Recup." radius={[4,4,0,0]} maxBarSize={48} fill="#0ea5e9" fillOpacity={0.3}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* PSE por posição */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4">PSE Médio × Posição</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={posMedPse} layout="vertical" margin={{top:4,right:40,left:4,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" domain={[0,10]} tick={{fontSize:8,fill:'#9ca3af'}}/>
              <YAxis type="category" dataKey="pos" tick={{fontSize:8,fontWeight:700,fill:'#4b5563'}} width={72}/>
              <Tooltip contentStyle={{fontSize:10,borderRadius:8}} formatter={v=>[`${v}/10`,'PSE Médio']}/>
              <ReferenceLine x={6} stroke="#f59e0b" strokeDasharray="3 2"/>
              <Bar dataKey="pse" name="PSE Médio" radius={[0,4,4,0]} maxBarSize={18}>
                {posMedPse.map((p,i)=>(
                  <Cell key={i} fill={parseFloat(p.pse)>=7?'#dc2626':parseFloat(p.pse)>=5?'#f59e0b':'#0B7C3D'}/>
                ))}
                <LabelList dataKey="pse" position="right" style={{fontSize:8,fontWeight:800,fill:'#374151'}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* % com dor por posição */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4">% Respostas com Dor × Posição</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={posDor} layout="vertical" margin={{top:4,right:40,left:4,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis type="number" domain={[0,100]} tick={{fontSize:8,fill:'#9ca3af'}} unit="%"/>
              <YAxis type="category" dataKey="pos" tick={{fontSize:8,fontWeight:700,fill:'#4b5563'}} width={72}/>
              <Tooltip contentStyle={{fontSize:10,borderRadius:8}} formatter={(v,_,p)=>[`${v}% (${p.payload.comDor}/${p.payload.total})`,'Com Dor']}/>
              <ReferenceLine x={30} stroke="#f59e0b" strokeDasharray="3 2"/>
              <Bar dataKey="pct" name="% Com Dor" radius={[0,4,4,0]} maxBarSize={18}>
                {posDor.map((p,i)=>(
                  <Cell key={i} fill={parseFloat(p.pct)>=40?'#dc2626':parseFloat(p.pct)>=20?'#f59e0b':'#0B7C3D'}/>
                ))}
                <LabelList dataKey="pct" position="right" formatter={v=>`${v}%`} style={{fontSize:8,fontWeight:800,fill:'#374151'}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── ABA ATLETA INDIVIDUAL ───────────────────────────────────────────────────
function TabAtleta({ preRows, posRows, gpsSessions, getPhotoUrl, onOpenPhoto, resolveGps }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [section, setSection] = useState('overview') // overview | pre | pos | dor | gps

  // Todos os atletas únicos
  const allPlayers = useMemo(() => {
    const set = new Set([
      ...preRows.map(r => (r['Atletas']||'').trim()),
      ...posRows.map(r => (r['Atleta']||'').trim()),
    ])
    return [...set].filter(Boolean).sort()
  }, [preRows, posRows])

  // Init
  useEffect(() => {
    if (allPlayers.length > 0 && !selectedPlayer) setSelectedPlayer(allPlayers[0])
  }, [allPlayers])

  // Dados do atleta selecionado
  const playerPre = useMemo(() =>
    preRows.filter(r => (r['Atletas']||'').trim() === selectedPlayer)
      .sort((a,b) => extractDate(b).localeCompare(extractDate(a)))
  , [preRows, selectedPlayer])

  const playerPos = useMemo(() =>
    posRows.filter(r => (r['Atleta']||'').trim() === selectedPlayer)
      .sort((a,b) => extractDate(b).localeCompare(extractDate(a)))
  , [posRows, selectedPlayer])

  const playerDorPre = useMemo(() =>
    playerPre.filter(r => num(r['QUal a graduação da sua dor']||r['Está sentindo alguma dor localizada?']) > 0)
  , [playerPre])

  const playerDorPos = useMemo(() =>
    playerPos.filter(r => num(r['Está sentindo alguma dor localizada?']) > 0)
  , [playerPos])

  // GPS do atleta
  const playerGPS = useMemo(() => {
    const result = []
    const alvoGps = normalizeName(resolveGps ? resolveGps(selectedPlayer || '') : (selectedPlayer || ''))
    gpsSessions.forEach(s => {
      const rows = Array.isArray(s.rows) ? s.rows : (s.rows?.rows || [])
      const row = rows.find(r => normalizeName(r.playerName) === alvoGps)
      if (row) result.push({
        date: (() => { let d = s.data_sessao; if (!d) return ''; if (typeof d === 'object') d = d.toISOString(); return String(d).slice(0,10) })(),
        titulo: s.titulo,
        tipo: s.tipo_sessao,
        dist: num(row.totalDistance),
        hsr: num(row.dist20),
        sprints: num(row.sprints),
        maxVel: num(row.maxVel),
        accel: num(row.accel),
        posicao: row.positionName,
      })
    })
    return result.sort((a,b) => b.date.localeCompare(a.date))
  }, [gpsSessions, selectedPlayer, resolveGps])

  // Timeline wellness
  const wellnessTimeline = useMemo(() =>
    playerPre.slice().reverse().map(r => ({
      date: extractDate(r).slice(5),
      fullDate: extractDate(r),
      wellness: calcWellness(r),
      sono: num(r['Como foi a qualidade do seu sono?']),
      recup: num(r['Como você classifica sua recuperação?']),
      horas: num(r['Quantas horas você dormiu na última noite?']),
      pse: null,
    }))
  , [playerPre])

  // Mescla PSE no timeline
  const fullTimeline = useMemo(() => {
    const map = {}
    wellnessTimeline.forEach(p => { map[p.fullDate] = {...p} })
    playerPos.forEach(r => {
      const d = extractDate(r)
      if (map[d]) map[d].pse = num(r['Qual sua percepção de esforço pós-treino ?']) || null
      else map[d] = { date:d.slice(5), fullDate:d, wellness:null, sono:null, recup:null, horas:null, pse:num(r['Qual sua percepção de esforço pós-treino ?'])||null }
    })
    return Object.values(map).sort((a,b)=>a.fullDate.localeCompare(b.fullDate))
  }, [wellnessTimeline, playerPos])

  const fmtDate = d => {
    if (!d) return ''
    const [y,m,day] = d.split('-')
    return new Date(y,m-1,day).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})
  }
  const fmtShort = d => {
    if (!d) return ''
    const [y,m,day] = d.split('-')
    return `${day}/${m}`
  }

  // Stats resumo do atleta
  const stats = useMemo(() => {
    const wVals = playerPre.map(r=>calcWellness(r)).filter(v=>v!==null)
    const pseVals = playerPos.map(r=>num(r['Qual sua percepção de esforço pós-treino ?'])).filter(v=>v>0)
    const dorCount = new Set([...playerDorPre.map(extractDate),...playerDorPos.map(extractDate)]).size
    return {
      totalPre: playerPre.length,
      totalPos: playerPos.length,
      avgWellness: wVals.length ? (wVals.reduce((s,v)=>s+v,0)/wVals.length*10).toFixed(1) : null,
      avgPse: pseVals.length ? (pseVals.reduce((s,v)=>s+v,0)/pseVals.length).toFixed(1) : null,
      diasComDor: dorCount,
      totalGPS: playerGPS.length,
    }
  }, [playerPre, playerPos, playerDorPre, playerDorPos, playerGPS])

  const SECTIONS = [
    {id:'overview',label:'Visão Geral'},
    {id:'pre',label:`Pré-Treino (${playerPre.length})`},
    {id:'pos',label:`Pós-Treino (${playerPos.length})`},
    {id:'dor',label:`Dor (${playerDorPre.length+playerDorPos.length})`},
    {id:'gps',label:`GPS (${playerGPS.length})`},
  ]

  const photo = selectedPlayer ? getPhotoUrl(selectedPlayer) : null
  const wellnessColor = stats.avgWellness ? (parseFloat(stats.avgWellness)>=7?'#0B7C3D':parseFloat(stats.avgWellness)>=4.5?'#f59e0b':'#dc2626') : '#9ca3af'
  const posePos = playerGPS[0]?.posicao || null

  return (
    <div className="space-y-5 fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* Seletor de atleta */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Selecionar Atleta</p>
          </div>
          <div className="overflow-y-auto" style={{maxHeight:560}}>
            {allPlayers.map((nome, i) => {
              const active = nome === selectedPlayer
              const ph = getPhotoUrl(nome)
              const preCount = preRows.filter(r=>(r['Atletas']||'').trim()===nome).length
              const wVals = preRows.filter(r=>(r['Atletas']||'').trim()===nome).map(r=>calcWellness(r)).filter(v=>v!==null)
              const avgW = wVals.length ? wVals.reduce((s,v)=>s+v,0)/wVals.length : null
              const wc = avgW===null?'#9ca3af':avgW>=0.7?'#0B7C3D':avgW>=0.45?'#f59e0b':'#dc2626'
              return (
                <button key={nome} onClick={()=>{setSelectedPlayer(nome);setSection('overview')}}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-50 transition-all
                    ${active?'bg-sky-50 border-l-4':'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                  style={active?{borderLeftColor:'#0B7C3D'}:{}}>
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{background:'#f0fdf4'}}>
                    {ph?<img src={ph} alt={nome} className="w-full h-full object-cover object-top"/>
                      :<div className="w-full h-full flex items-center justify-center bc text-sm font-black" style={{color:'#0B7C3D',opacity:0.4}}>{nome.charAt(0)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[9px] font-black truncate ${active?'text-sky-700':'text-gray-800'}`}>{nome}</p>
                    <p className="text-[7px] text-gray-400">{preCount} resp. pré</p>
                  </div>
                  {avgW !== null && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:wc}}/>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Conteúdo do atleta */}
        <div className="lg:col-span-3 space-y-4">
          {selectedPlayer && (
            <>
              {/* Header do atleta */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 flex-wrap">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer shadow-sm"
                  style={{background:'#f0fdf4'}} onClick={()=>onOpenPhoto&&onOpenPhoto(selectedPlayer)}>
                  {photo?<img src={photo} alt={selectedPlayer} className="w-full h-full object-cover object-top"/>
                    :<div className="w-full h-full flex items-center justify-center bc text-2xl font-black" style={{color:'#0B7C3D',opacity:0.3}}>{selectedPlayer.charAt(0)}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="bc text-3xl font-black uppercase text-gray-900 leading-none">{selectedPlayer}</p>
                  {posePos && <p className="text-[9px] text-gray-400 mt-0.5 font-medium">{posePos}</p>}
                </div>
                {/* Mini stats */}
                <div className="flex gap-3 flex-wrap">
                  {[
                    {label:'Wellness Médio',val:stats.avgWellness?`${stats.avgWellness}/10`:'—',color:wellnessColor},
                    {label:'PSE Médio',val:stats.avgPse?`${stats.avgPse}/10`:'—',color:'#0ea5e9'},
                    {label:'Dias c/ Dor',val:stats.diasComDor,color:stats.diasComDor>0?'#f59e0b':'#0B7C3D'},
                    {label:'Sess. GPS',val:stats.totalGPS,color:'#6366f1'},
                  ].map((s,i)=>(
                    <div key={i} className="text-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 min-w-[72px]">
                      <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">{s.label}</p>
                      <p className="bc text-xl font-black leading-tight mt-0.5" style={{color:s.color}}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
                {SECTIONS.map(s=>(
                  <button key={s.id} onClick={()=>setSection(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${section===s.id?'bg-white shadow-sm text-sky-700':'text-gray-500 hover:text-gray-700'}`}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* OVERVIEW */}
              {section==='overview' && (
                <div className="space-y-4">
                  {/* Timeline wellness + PSE */}
                  {fullTimeline.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-3">Wellness & PSE ao longo do tempo</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={fullTimeline} margin={{top:8,right:16,left:-20,bottom:4}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                          <XAxis dataKey="date" tick={{fontSize:8,fill:'#6b7280'}} interval={Math.floor(fullTimeline.length/6)}/>
                          <YAxis domain={[0,10]} tick={{fontSize:8,fill:'#9ca3af'}}/>
                          <Tooltip contentStyle={{fontSize:10,borderRadius:8,border:'1px solid #e2e8f0'}}
                            formatter={(v,n)=>[v?Number(v).toFixed(1):'—',n]}
                            labelFormatter={l=>`Data: ${l}`}/>
                          <ReferenceLine y={7} stroke="#0B7C3D" strokeDasharray="4 2" strokeWidth={1}/>
                          <ReferenceLine y={4.5} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1}/>
                          <Line dataKey={d=>d.wellness!==null?(d.wellness*10):undefined} name="Wellness (/10)"
                            stroke="#0B7C3D" strokeWidth={2} dot={{r:3}} connectNulls/>
                          <Line dataKey="pse" name="PSE" stroke="#0ea5e9" strokeWidth={2} dot={{r:3}} strokeDasharray="4 2" connectNulls/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* GPS resumo */}
                  {playerGPS.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-3">Distância Total — Últimas sessões GPS</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={playerGPS.slice(0,12).reverse()} margin={{top:4,right:8,left:-20,bottom:4}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                          <XAxis dataKey="date" tick={{fontSize:7,fill:'#6b7280'}} tickFormatter={d=>fmtShort(d)}/>
                          <YAxis tick={{fontSize:8,fill:'#9ca3af'}}/>
                          <Tooltip contentStyle={{fontSize:10,borderRadius:8}} formatter={v=>[`${(v/1000).toFixed(2)} km`,'Dist.']}/>
                          <Bar dataKey="dist" name="Distância" radius={[3,3,0,0]} maxBarSize={32}>
                            {playerGPS.slice(0,12).reverse().map((p,i)=>(
                              <Cell key={i} fill={p.tipo==='Jogo'?'#0ea5e9':'#0B7C3D'}/>
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex gap-2 mt-2 text-[7px] font-bold">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block"/>&nbsp;Jogo</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{background:'#0B7C3D'}}/>&nbsp;Treino</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PÉ-TREINO HISTÓRICO */}
              {section==='pre' && (
                <div className="space-y-2">
                  {playerPre.length===0?<p className="text-center py-8 text-gray-300">Sem respostas pré-treino</p>:
                  playerPre.map((r,i)=>{
                    const date = extractDate(r)
                    const sono = num(r['Como foi a qualidade do seu sono?'])
                    const recup = num(r['Como você classifica sua recuperação?'])
                    const horas = num(r['Quantas horas você dormiu na última noite?'])
                    const urina = num(r['Qual a coloração da sua urina?'])
                    const w = calcWellness(r)
                    const {label,color} = getScoreStyle(w)
                    const gi = (r['Apresenta ou apresentou no dia anterior algum sintoma gastrointestinal? (Ex: diarreia, refluxo, azia, náusea, vômito ou sangramento retal)']||'').trim()
                    const peso = r['Peso (kg)']||''
                    return (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-black text-gray-700">{fmtDate(date)}</p>
                          <div className="flex items-center gap-2">
                            {peso&&<span className="text-[8px] font-bold text-gray-500">{peso} kg</span>}
                            {gi==='Sim'&&<span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">⚠️ GI</span>}
                            <span className="text-[7px] font-black px-2 py-0.5 rounded-full" style={{background:color+'22',color}}>{label}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[{l:'Sono',v:sono,max:10},{l:'Recup.',v:recup,max:10},{l:'Horas',v:horas,max:9},{l:'Urina',v:urina,max:8,invert:true}].map(m=>(
                            <div key={m.l} className="text-center">
                              <p className="text-[7px] text-gray-400 font-bold uppercase">{m.l}</p>
                              <p className="bc text-lg font-black" style={{color:m.invert?(m.v<=2?'#0B7C3D':m.v<=4?'#f59e0b':'#dc2626'):(m.v>=7?'#0B7C3D':m.v>=4?'#f59e0b':'#dc2626')}}>{m.v||'—'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* PÓS-TREINO HISTÓRICO */}
              {section==='pos' && (
                <div className="space-y-2">
                  {playerPos.length===0?<p className="text-center py-8 text-gray-300">Sem respostas pós-treino</p>:
                  playerPos.map((r,i)=>{
                    const date = extractDate(r)
                    const pse = num(r['Qual sua percepção de esforço pós-treino ?'])
                    const dor = num(r['Está sentindo alguma dor localizada?'])
                    const dorLoc = (r['Local da Dor']||'').trim()
                    const peso = r['Peso (kg)']||''
                    const pseColor = pse>=8?'#dc2626':pse>=6?'#f59e0b':'#0B7C3D'
                    return (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                        <div className="text-center min-w-[48px]">
                          <p className="text-[7px] font-black uppercase text-gray-400">PSE</p>
                          <p className="bc text-3xl font-black leading-none" style={{color:pseColor}}>{pse||'—'}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-gray-700">{fmtDate(date)}</p>
                          {peso&&<p className="text-[8px] text-gray-400 mt-0.5">{peso} kg</p>}
                          {dor>0&&<p className="text-[8px] text-amber-700 mt-0.5">🩹 Dor {dor}/10{dorLoc?` · ${dorLoc}`:''}</p>}
                        </div>
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${(pse/10)*100}%`,background:pseColor}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* DOR HISTÓRICO */}
              {section==='dor' && (
                <div className="space-y-3">
                  {playerDorPre.length===0&&playerDorPos.length===0?
                    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-8 text-center">
                      <p className="text-2xl mb-1">✓</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-sky-700">Nenhum histórico de dor registrado</p>
                    </div>:
                    <>
                      {/* Mapa de regiões afetadas */}
                      {(() => {
                        const allLoc = [
                          ...playerDorPre.map(r=>(r['Local da Dor']||'').trim()),
                          ...playerDorPos.map(r=>(r['Local da Dor']||'').trim()),
                        ].filter(Boolean).flatMap(l=>l.split(',').map(s=>s.trim()))
                        const freq = {}
                        allLoc.forEach(l=>{freq[l]=(freq[l]||0)+1})
                        const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1])
                        return sorted.length>0?(
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-[8px] font-black uppercase tracking-widest text-amber-700 mb-2">Regiões mais afetadas</p>
                            <div className="flex flex-wrap gap-1.5">
                              {sorted.map(([k,v])=>(
                                <div key={k} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-amber-200">
                                  <span className="text-[9px] font-bold text-amber-800">{k}</span>
                                  <span className="text-[7px] font-black px-1 rounded-full text-white bg-amber-500">{v}x</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ):null
                      })()}

                      {/* Pré */}
                      {playerDorPre.length>0&&(
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-sky-600">🌅 Pré-Treino</p>
                          {playerDorPre.map((r,i)=>{
                            const date = extractDate(r)
                            const dor = num(r['QUal a graduação da sua dor']||r['Está sentindo alguma dor localizada?'])
                            const dorLoc = (r['Local da Dor']||'').trim()
                            const isAlert = dor>=4
                            return (
                              <div key={i} className="rounded-xl border p-3 flex items-center gap-3"
                                style={{background:isAlert?'#fef2f2':'#fffbeb',borderColor:isAlert?'#fca5a5':'#fde68a'}}>
                                <span className="bc text-2xl font-black" style={{color:isAlert?'#dc2626':'#f59e0b'}}>{dor}</span>
                                <div>
                                  <p className="text-[9px] font-black text-gray-700">{fmtDate(date)}</p>
                                  {dorLoc&&<p className="text-[8px] text-gray-500 mt-0.5">{dorLoc}</p>}
                                </div>
                                {isAlert&&<span className="ml-auto text-[7px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">ATENÇÃO</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Pós */}
                      {playerDorPos.length>0&&(
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-blue-600">🌆 Pós-Treino</p>
                          {playerDorPos.map((r,i)=>{
                            const date = extractDate(r)
                            const dor = num(r['Está sentindo alguma dor localizada?'])
                            const dorLoc = (r['Local da Dor']||'').trim()
                            const isAlert = dor>=4
                            return (
                              <div key={i} className="rounded-xl border p-3 flex items-center gap-3"
                                style={{background:isAlert?'#fef2f2':'#fffbeb',borderColor:isAlert?'#fca5a5':'#fde68a'}}>
                                <span className="bc text-2xl font-black" style={{color:isAlert?'#dc2626':'#f59e0b'}}>{dor}</span>
                                <div>
                                  <p className="text-[9px] font-black text-gray-700">{fmtDate(date)}</p>
                                  {dorLoc&&<p className="text-[8px] text-gray-500 mt-0.5">{dorLoc}</p>}
                                </div>
                                {isAlert&&<span className="ml-auto text-[7px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white">ATENÇÃO</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  }
                </div>
              )}

              {/* GPS HISTÓRICO */}
              {section==='gps' && (
                <div className="space-y-2">
                  {playerGPS.length===0?<p className="text-center py-8 text-gray-300">Sem sessões GPS para este atleta</p>:
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {[
                        {label:'Sessões',val:playerGPS.length},
                        {label:'Dist. Média',val:`${(playerGPS.reduce((s,r)=>s+r.dist,0)/playerGPS.length/1000).toFixed(2)} km`},
                        {label:'HSR Médio',val:`${(playerGPS.reduce((s,r)=>s+r.hsr,0)/playerGPS.length).toFixed(0)} m`},
                        {label:'Vel. Max. Média',val:`${(playerGPS.reduce((s,r)=>s+r.maxVel,0)/playerGPS.length).toFixed(1)} km/h`},
                      ].map((s,i)=>(
                        <div key={i} className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-sm">
                          <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">{s.label}</p>
                          <p className="bc text-lg font-black text-gray-900 leading-tight mt-0.5">{s.val}</p>
                        </div>
                      ))}
                    </div>
                    {playerGPS.map((g,i)=>(
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${g.tipo==='Jogo'?'bg-blue-100 text-blue-700 border border-blue-200':'bg-sky-100 text-sky-700 border border-sky-200'}`}>
                            {g.tipo==='Jogo'?'⚽':'🏃'} {g.tipo}
                          </span>
                          <p className="text-[9px] font-black text-gray-700">{fmtDate(g.date)}</p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          {[
                            {l:'Distância',v:`${(g.dist/1000).toFixed(2)} km`},
                            {l:'HSR',v:`${g.hsr.toFixed(0)} m`},
                            {l:'Sprints',v:g.sprints},
                            {l:'Vel. Max.',v:`${g.maxVel.toFixed(1)} km/h`},
                            {l:'Acels.',v:g.accel},
                          ].map(m=>(
                            <div key={m.l} className="text-center">
                              <p className="text-[7px] text-gray-400 font-bold uppercase">{m.l}</p>
                              <p className="text-[10px] font-black text-gray-800">{m.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ABA PESO CORPORAL ───────────────────────────────────────────────────────
function TabPeso({ preRows, posRows, getPhotoUrl }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const STATUS_STYLE = {
    normal:  { label: 'Normal',     color: '#0B7C3D', bg: '#f0fdf4', border: '#bbf7d0' },
    atencao: { label: 'Atenção',    color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    critico: { label: 'Crítico',    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    sem_par: { label: 'Incompleto', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
  }

  // Histórico completo: (atleta, data) → { pesoPre, pesoPos, varKg, varPct, status }
  const history = useMemo(() => {
    const map = {}
    preRows.forEach(r => {
      const nome = (r['Atletas'] || '').trim()
      const date = extractDate(r)
      const peso = parseFloat((r['Peso (kg)'] || '').replace(',', '.'))
      if (!nome || !date || isNaN(peso) || peso <= 0) return
      const key = `${nome}__${date}`
      if (!map[key]) map[key] = { nome, date, pesoPre: null, pesoPos: null }
      map[key].pesoPre = peso
    })
    posRows.forEach(r => {
      const nome = (r['Atleta'] || '').trim()
      const date = extractDate(r)
      const peso = parseFloat((r['Peso (kg)'] || '').replace(',', '.'))
      if (!nome || !date || isNaN(peso) || peso <= 0) return
      const key = `${nome}__${date}`
      if (!map[key]) map[key] = { nome, date, pesoPre: null, pesoPos: null }
      map[key].pesoPos = peso
    })
    return Object.values(map)
      .filter(r => r.pesoPre !== null || r.pesoPos !== null)
      .map(r => {
        const varKg  = (r.pesoPre && r.pesoPos) ? parseFloat((r.pesoPos - r.pesoPre).toFixed(2)) : null
        const varPct = (r.pesoPre && r.pesoPos) ? parseFloat(((r.pesoPos - r.pesoPre) / r.pesoPre * 100).toFixed(2)) : null
        const status = varPct === null ? 'sem_par'
          : Math.abs(varPct) <= 1 ? 'normal'
          : Math.abs(varPct) <= 2 ? 'atencao' : 'critico'
        return { ...r, varKg, varPct, status }
      })
  }, [preRows, posRows])

  // Lista de atletas únicos com stats resumidas
  const players = useMemo(() => {
    const map = {}
    history.forEach(r => {
      if (!map[r.nome]) map[r.nome] = { nome: r.nome, registros: 0, pares: 0, varPcts: [], lastPre: null, lastDate: null }
      const p = map[r.nome]
      p.registros++
      if (r.varPct !== null) { p.pares++; p.varPcts.push(r.varPct) }
      if (!p.lastDate || r.date > p.lastDate) {
        p.lastDate = r.date
        p.lastPre  = r.pesoPre
      }
    })
    return Object.values(map)
      .map(p => ({
        ...p,
        avgVar: p.varPcts.length ? p.varPcts.reduce((s,v)=>s+v,0)/p.varPcts.length : null,
        worstVar: p.varPcts.length ? Math.min(...p.varPcts) : null,
        status: p.varPcts.length === 0 ? 'sem_par'
          : p.varPcts.some(v => Math.abs(v) > 2) ? 'critico'
          : p.varPcts.some(v => Math.abs(v) > 1) ? 'atencao' : 'normal',
      }))
      .sort((a,b) => a.nome.localeCompare(b.nome))
  }, [history])

  // Init
  useEffect(() => {
    if (players.length > 0 && !selectedPlayer) setSelectedPlayer(players[0].nome)
  }, [players])

  // Histórico do atleta selecionado (cronológico)
  const playerHistory = useMemo(() =>
    history.filter(r => r.nome === selectedPlayer).sort((a,b) => a.date.localeCompare(b.date))
  , [history, selectedPlayer])

  const lineData = playerHistory.map(r => ({
    date: r.date.slice(5),
    fullDate: r.date,
    pesoPre: r.pesoPre,
    pesoPos: r.pesoPos,
    varPct:  r.varPct,
    status:  r.status,
  }))

  const fmtDate = d => {
    if (!d) return ''
    const [y,m,day] = d.split('-')
    return new Date(y,m-1,day).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})
  }

  const selPlayer = players.find(p => p.nome === selectedPlayer)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 fade-in">

      {/* Lista de atletas */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Atletas ({players.length})</p>
        </div>
        <div className="overflow-y-auto" style={{maxHeight: 600}}>
          {players.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-xs">Sem registros de peso</p>
          ) : players.map((p, i) => {
            const active = p.nome === selectedPlayer
            const s = STATUS_STYLE[p.status]
            const photo = getPhotoUrl(p.nome)
            return (
              <button key={p.nome} onClick={() => setSelectedPlayer(p.nome)}
                className={`w-full flex items-center gap-2.5 px-3 py-3 text-left border-b border-gray-50 transition-all
                  ${active ? 'bg-sky-50 border-l-4' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                style={active ? {borderLeftColor: '#0B7C3D'} : {}}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0" style={{background:'#f0fdf4'}}>
                  {photo
                    ? <img src={photo} alt={p.nome} className="w-full h-full object-cover object-top"/>
                    : <div className="w-full h-full flex items-center justify-center bc text-base font-black" style={{color:'#0B7C3D',opacity:0.3}}>{p.nome.charAt(0)}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[9px] font-black truncate ${active ? 'text-sky-700' : 'text-gray-800'}`}>{p.nome}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-[7px] text-gray-400">{p.registros} reg.</p>
                    {p.lastPre && <p className="text-[7px] text-gray-400">· {p.lastPre} kg</p>}
                  </div>
                </div>
                {/* Status dot + avg */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{background: s.color}}/>
                  {p.avgVar !== null && (
                    <span className="text-[7px] font-black" style={{color: s.color}}>{p.avgVar.toFixed(1)}%</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {/* Legenda */}
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 space-y-1">
          {[['#0B7C3D','Normal ≤1%'],['#f59e0b','Atenção 1–2%'],['#dc2626','Crítico >2%'],['#9ca3af','Sem par']].map(([c,l])=>(
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:c}}/>
              <span className="text-[7px] font-medium text-gray-500">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito */}
      <div className="lg:col-span-3 space-y-4">
        {!selectedPlayer || !selPlayer ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
            <p className="text-3xl mb-2">⚖️</p>
            <p className="bc text-xl font-black uppercase text-gray-300">Selecione um atleta</p>
          </div>
        ) : (
          <>
            {/* Header atleta */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap">
              <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm" style={{background:'#f0fdf4'}}>
                {getPhotoUrl(selectedPlayer)
                  ? <img src={getPhotoUrl(selectedPlayer)} alt={selectedPlayer} className="w-full h-full object-cover object-top"/>
                  : <div className="w-full h-full flex items-center justify-center bc text-2xl font-black" style={{color:'#0B7C3D',opacity:0.3}}>{selectedPlayer.charAt(0)}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="bc text-2xl font-black uppercase text-gray-900 leading-none">{selectedPlayer}</p>
                <p className="text-[8px] text-gray-400 mt-0.5">{selPlayer.registros} registro(s) de peso</p>
              </div>
              {/* Mini stats */}
              {(() => {
                const pairs = playerHistory.filter(r=>r.varPct!==null)
                const avgP  = pairs.length ? pairs.reduce((s,r)=>s+r.pesoPre,0)/pairs.length : null
                const avgV  = pairs.length ? pairs.reduce((s,r)=>s+r.varPct,0)/pairs.length : null
                const worst = pairs.length ? pairs.reduce((m,r)=>r.varPct<m.varPct?r:m,pairs[0]) : null
                const last  = playerHistory[playerHistory.length-1]
                const vColor = avgV===null?'#9ca3af':Math.abs(avgV)>2?'#dc2626':Math.abs(avgV)>1?'#f59e0b':'#0B7C3D'
                return (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      {label:'Último Pré', val:last?.pesoPre?`${last.pesoPre} kg`:'—', color:'#0B7C3D'},
                      {label:'Média Pré',  val:avgP?`${avgP.toFixed(1)} kg`:'—',       color:'#1E3A8A'},
                      {label:'Var. Média', val:avgV!==null?`${avgV.toFixed(2)}%`:'—',  color:vColor},
                      {label:'Pior Perda', val:worst?`${worst.varPct.toFixed(2)}%`:'—',color:'#dc2626'},
                    ].map((s,i)=>(
                      <div key={i} className="text-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 min-w-[72px]">
                        <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">{s.label}</p>
                        <p className="bc text-lg font-black leading-tight mt-0.5" style={{color:s.color}}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {playerHistory.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                <p className="text-gray-300 text-sm font-black uppercase">Sem registros de peso para este atleta</p>
              </div>
            ) : (
              <>
                {/* Gráfico Peso Pré × Pós */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-3">Evolução do Peso (kg)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={lineData} margin={{top:8,right:16,left:-20,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="date" tick={{fontSize:8,fill:'#6b7280'}}/>
                      <YAxis tick={{fontSize:8,fill:'#9ca3af'}} domain={['auto','auto']}/>
                      <Tooltip contentStyle={{fontSize:10,borderRadius:8,border:'1px solid #e2e8f0'}}
                        formatter={(v,name)=>[`${v} kg`,name]} labelFormatter={l=>`Data: ${l}`}/>
                      <Line dataKey="pesoPre" name="Peso Pré" stroke="#0B7C3D" strokeWidth={2.5} dot={{r:4,fill:'#0B7C3D',strokeWidth:0}} connectNulls/>
                      <Line dataKey="pesoPos" name="Peso Pós" stroke="#0ea5e9" strokeWidth={2.5} dot={{r:4,fill:'#0ea5e9',strokeWidth:0}} connectNulls strokeDasharray="5 3"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico Variação % */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-3">Variação % por Sessão</p>
                  {lineData.filter(d=>d.varPct!==null).length === 0 ? (
                    <p className="text-center text-gray-300 text-xs py-8">Sem pares pré+pós registrados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={lineData.filter(d=>d.varPct!==null)} margin={{top:8,right:16,left:-20,bottom:4}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                        <XAxis dataKey="date" tick={{fontSize:8,fill:'#6b7280'}}/>
                        <YAxis tick={{fontSize:8,fill:'#9ca3af'}}/>
                        <Tooltip contentStyle={{fontSize:10,borderRadius:8,border:'1px solid #e2e8f0'}}
                          formatter={v=>[`${v.toFixed(2)}%`,'Variação']}/>
                        <ReferenceLine y={-1} stroke="#f59e0b" strokeDasharray="3 2" strokeWidth={1.5}
                          label={{value:'-1%',fontSize:7,fill:'#f59e0b',position:'right'}}/>
                        <ReferenceLine y={-2} stroke="#dc2626" strokeDasharray="3 2" strokeWidth={1.5}
                          label={{value:'-2%',fontSize:7,fill:'#dc2626',position:'right'}}/>
                        <Bar dataKey="varPct" name="Variação %" radius={[3,3,0,0]} maxBarSize={40}>
                          {lineData.filter(d=>d.varPct!==null).map((entry,i)=>(
                            <Cell key={i} fill={STATUS_STYLE[entry.status].color}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Tabela de registros do atleta */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Histórico de Registros</p>
                  </div>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr style={{background:'#0B7C3D'}}>
                        {['Data','Peso Pré','Peso Pós','Δ kg','Δ %','Status'].map(h=>(
                          <th key={h} className="px-3 py-2.5 text-[8px] font-black uppercase tracking-widest text-white text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...playerHistory].reverse().map((r,i)=>{
                        const s = STATUS_STYLE[r.status]
                        return (
                          <tr key={i} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                            <td className="px-3 py-2 font-bold text-gray-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="px-3 py-2 tabular-nums text-gray-600">{r.pesoPre!==null?`${r.pesoPre} kg`:'—'}</td>
                            <td className="px-3 py-2 tabular-nums text-gray-600">{r.pesoPos!==null?`${r.pesoPos} kg`:'—'}</td>
                            <td className="px-3 py-2 tabular-nums font-bold" style={{color:r.varKg!==null?(r.varKg<0?'#dc2626':'#0B7C3D'):'#9ca3af'}}>
                              {r.varKg!==null?`${r.varKg>0?'+':''}${r.varKg} kg`:'—'}
                            </td>
                            <td className="px-3 py-2 tabular-nums font-black" style={{color:s.color}}>
                              {r.varPct!==null?`${r.varPct>0?'+':''}${r.varPct}%`:'—'}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full"
                                style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>
                                {s.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── COMPONENTES TV ──────────────────────────────────────────────────────────

// Timer invisível que avança página automaticamente
function TvAutoAdvance({ totalPages, currentPage, onChangePage }) {
  const INTERVAL_MS = 8000 // 8s por página
  useEffect(() => {
    const t = setInterval(() => {
      onChangePage(p => (p + 1) % totalPages)
    }, INTERVAL_MS)
    return () => clearInterval(t)
  }, [totalPages])
  return null
}

// Header TV — mostra nome do dia, aba, progresso e barra de tempo
function TvHeader({ rows, page, pageSize, date, tab, stats }) {
  const [progress, setProgress] = useState(0)
  const INTERVAL_MS = 8000
  const totalPages = Math.ceil(rows.length / pageSize)
  const from = page * pageSize + 1
  const to   = Math.min((page + 1) * pageSize, rows.length)

  useEffect(() => {
    setProgress(0)
    const tick = 50
    const steps = INTERVAL_MS / tick
    let cur = 0
    const t = setInterval(() => {
      cur++
      setProgress((cur / steps) * 100)
      if (cur >= steps) clearInterval(t)
    }, tick)
    return () => clearInterval(t)
  }, [page])

  const fmtDate = d => {
    if (!d) return ''
    const [y,m,day] = d.split('-')
    return new Date(y,m-1,day).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})
  }

  return (
    <div className="rounded-2xl p-4 mb-2" style={{background:'#1e293b', border:'1px solid #334155'}}>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        {/* Logo + título */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'#0B7C3D'}}>
            <span className="bc text-xl font-black text-white">G</span>
          </div>
          <div>
            <p className="bc text-2xl font-black uppercase text-white leading-none">BEM-ESTAR · {tab}</p>
            <p className="text-[10px] font-medium capitalize" style={{color:'#94a3b8'}}>{fmtDate(date)}</p>
          </div>
        </div>
        {/* Stats rápidos */}
        <div className="flex gap-3 flex-wrap">
          {[
            {l:'Responderam', v:stats.total, c:'#94a3b8'},
            {l:'Alertas',     v:stats.alertas, c:stats.alertas>0?'#f87171':'#4ade80'},
            {l:'Com Dor',     v:stats.comDor,  c:stats.comDor>0?'#fb923c':'#4ade80'},
            {l:'Média PSE',   v:stats.mediaPse!==null?stats.mediaPse.toFixed(1):'—', c:'#60a5fa'},
          ].map((s,i)=>(
            <div key={i} className="text-center px-3 py-1.5 rounded-xl" style={{background:'#0f172a'}}>
              <p className="text-[7px] font-black uppercase tracking-widest" style={{color:'#64748b'}}>{s.l}</p>
              <p className="bc text-xl font-black leading-none" style={{color:s.c}}>{s.v}</p>
            </div>
          ))}
        </div>
        {/* Paginação */}
        <div className="flex items-center gap-2">
          {Array.from({length:totalPages}).map((_,i)=>(
            <div key={i} className="w-2 h-2 rounded-full transition-all"
              style={{background: i===page?'#FDB913':'#334155', transform: i===page?'scale(1.4)':'scale(1)'}}/>
          ))}
          <span className="ml-2 text-[9px] font-black" style={{color:'#64748b'}}>
            {from}–{to} / {rows.length}
          </span>
        </div>
      </div>
      {/* Barra de progresso */}
      <div className="h-0.5 rounded-full overflow-hidden" style={{background:'#1e3a5f'}}>
        <div className="h-full rounded-full transition-none" style={{width:`${progress}%`, background:'#FDB913'}}/>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export function BemEstarContent() {
  const { getPhotoUrl, setPhoto, loaded: photosLoaded } = usePlayerPhotos()

  const [preRows, setPreRows]   = useState([])
  const [posRows, setPosRows]   = useState([])
  const [gpsSessions, setGpsSessions] = useState([])
  const [duracoes, setDuracoes] = useState({})
  const [aliases, setAliases] = useState([])
  const [vincularOpen, setVincularOpen] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const requestInFlight = useRef(false)

  const [selectedDate,   setSelectedDate]   = useState('')
  const [selectedAtleta, setSelectedAtleta] = useState('Todos')
  const [activeTab, setActiveTab] = useState('pre')

  const [photoModalOpen,   setPhotoModalOpen]   = useState(false)
  const [photoModalPlayer, setPhotoModalPlayer] = useState(null)

  const [apenasAlerta, setApenasAlerta] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tvPage, setTvPage] = useState(0)
  const [sortOrder, setSortOrder] = useState('atencao') // 'atencao' | 'alfa'
  const TV_PAGE_SIZE = 8 // atletas por "página" na TV

  // Detectar entrada/saída de fullscreen
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      if (!fs) setTvPage(0) // reset ao sair
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  async function loadData({ silent = false, sheetsOnly = false } = {}) {
    if (CORPO_TECNICO_DEMO_ENABLED) {
      const demo = buildDemoWellnessData()
      setPreRows(demo.preRows)
      setPosRows(demo.posRows)
      setDuracoes(demo.duracoes)
      if (!sheetsOnly) {
        setGpsSessions(buildDemoGpsSessions())
        setAliases([])
      }
      setLastUpdated(new Date())
      setLoading(false)
      return
    }
    // Evita chamadas sobrepostas quando uma atualização demora mais que o intervalo.
    if (requestInFlight.current) return
    requestInFlight.current = true

    if (!silent) setLoading(true)

    try {
      const cacheBust = Date.now()
      const requests = [
        fetch(`/api/sheets-proxy?url=${encodeURIComponent(SHEETS.pre)}&_ts=${cacheBust}`, { cache: 'no-store' }),
        fetch(`/api/sheets-proxy?url=${encodeURIComponent(SHEETS.pos)}&_ts=${cacheBust}`, { cache: 'no-store' }),
      ]

      // GPS, vínculos e duração não precisam ser consultados a cada 10 segundos.
      if (!sheetsOnly) {
        requests.push(
          fetch(`/api/gps?_ts=${cacheBust}`, { cache: 'no-store' }),
          fetch(`/api/aliases?_ts=${cacheBust}`, { cache: 'no-store' }),
          fetch(`/api/treino-duracao?_ts=${cacheBust}`, { cache: 'no-store' }),
        )
      }

      const [r1, r2, r3, r4, r5] = await Promise.all(requests)

      if (!r1.ok || !r2.ok) {
        throw new Error(`Falha ao atualizar planilhas: pré ${r1.status}, pós ${r2.status}`)
      }

      const [t1, t2] = await Promise.all([r1.text(), r2.text()])
      setPreRows(parseSheetCSV(t1))
      setPosRows(parseSheetCSV(t2))

      if (!sheetsOnly) {
        try { const gd = await r3.json(); setGpsSessions(gd.sessions || []) } catch(_) {}
        try { const ad = await r4.json(); setAliases(ad.aliases || []) } catch(_) {}
        try { const dd = await r5.json(); setDuracoes(dd.duracoes || {}) } catch(_) {}
      }

      setLastUpdated(new Date())
    } catch(e) {
      console.error(e)
    } finally {
      requestInFlight.current = false
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function onSaveDuracao(date, minutos) {
    if (CORPO_TECNICO_DEMO_ENABLED) {
      setDuracoes(prev => ({ ...prev, [date]: minutos }))
      return
    }
    try {
      await fetch('/api/treino-duracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: date, duracao_min: minutos }),
      })
      setDuracoes(prev => ({ ...prev, [date]: minutos }))
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (CORPO_TECNICO_DEMO_ENABLED) return undefined
    // Atualização silenciosa a cada 10 segundos, sem piscar o estado de carregamento.
    const refresh = () => loadData({ silent: true, sheetsOnly: true })
    const t = setInterval(refresh, 10000)

    // Ao voltar para a aba, busca imediatamente a resposta mais recente.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Todas as datas únicas (mais recente primeiro)
  const dates = useMemo(() => {
    const all = new Set([
      ...preRows.map(r => extractDate(r)),
      ...posRows.map(r => extractDate(r)),
    ])
    return Array.from(all).filter(Boolean).sort().reverse()
  }, [preRows, posRows])

  const currentDate = selectedDate || dates[0] || ''

  // Todos os nomes de jogador vistos no GPS (união de todas as sessões)
  const gpsAllNames = useMemo(() => {
    const set = new Set()
    gpsSessions.forEach(s => {
      let rowsData = s.rows
      if (typeof rowsData === 'string') { try { rowsData = JSON.parse(rowsData) } catch(_) {} }
      const rows = Array.isArray(rowsData) ? rowsData : (rowsData?.rows || [])
      rows.forEach(r => { if (r.playerName) set.add(r.playerName) })
    })
    return Array.from(set)
  }, [gpsSessions])

  // Grupos de equivalência vindos da tabela player_aliases
  const aliasGroups = useMemo(() => buildAliasGroups(aliases), [aliases])

  // Resolver: nome da planilha (bem-estar/PSE) -> nome cru do GPS
  const resolver = useMemo(
    () => buildResolver(gpsAllNames, aliasGroups),
    [gpsAllNames, aliasGroups]
  )
  const resolveGps = resolver.resolve

  // Data anterior ao dia selecionado (para buscar GPS do dia anterior no card pré-treino)
  const prevDate = useMemo(() => {
    if (!currentDate) return ''
    // Tenta achar a data imediatamente anterior no array de datas GPS
    const gpsDates = gpsSessions
      .map(s => { let d = s.data_sessao; if (!d) return ''; if (typeof d === 'object') d = d.toISOString(); return String(d).slice(0,10) })
      .filter(Boolean)
    const allDates = Array.from(new Set(gpsDates)).sort()
    // Pega a maior data que seja < currentDate
    const prev = allDates.filter(d => d < currentDate).pop()
    if (prev) return prev
    // Fallback: subtrai 1 dia calendário
    const dt = new Date(currentDate + 'T12:00:00Z')
    dt.setUTCDate(dt.getUTCDate() - 1)
    return dt.toISOString().slice(0,10)
  }, [currentDate, gpsSessions])

  // Mapa nome-normalizado → dados GPS do dia anterior (para exibir no card pré-treino)
  const prevDayGpsMap = useMemo(() => {
    const map = {}
    if (!prevDate) return map
    gpsSessions.forEach(s => {
      let d = s.data_sessao
      if (!d) return
      if (typeof d === 'object') d = d.toISOString()
      const sessDate = String(d).slice(0,10)
      if (sessDate !== prevDate) return
      
      // Parse JSON string if needed
      let rowsData = s.rows
      if (typeof rowsData === 'string') {
        try { rowsData = JSON.parse(rowsData) } catch(_) {}
      }
      const rows = Array.isArray(rowsData) ? rowsData : (rowsData?.rows || [])
      
      rows.forEach(r => {
        const key = normalizeName(r.playerName)
        if (!key) return
        if (!map[key]) map[key] = { dist: 0, hsr: 0, dist25: 0, sprints: 0, sessoes: 0 }
        map[key].dist    += num(r.totalDistance)
        map[key].hsr     += num(r.dist20)
        map[key].dist25  += num(r.dist25)
        map[key].sprints += num(r.sprints)
        map[key].sessoes += 1
      })
    })
    return map
  }, [gpsSessions, prevDate])

  // Filtrar por data e atleta
  const filteredPre = useMemo(() =>
    preRows.filter(r =>
      extractDate(r) === currentDate &&
      (selectedAtleta === 'Todos' || (r['Atletas']||'').trim() === selectedAtleta)
    )
  , [preRows, currentDate, selectedAtleta])

  const filteredPos = useMemo(() =>
    posRows.filter(r =>
      extractDate(r) === currentDate &&
      (selectedAtleta === 'Todos' || (r['Atleta']||'').trim() === selectedAtleta)
    )
  , [posRows, currentDate, selectedAtleta])

  // Atletas únicos do dia selecionado (para o filtro)
  const atletasDoDia = useMemo(() => {
    const s = new Set([
      ...filteredPre.map(r => (r['Atletas']||'').trim()),
      ...filteredPos.map(r => (r['Atleta']||'').trim()),
    ])
    return ['Todos', ...Array.from(s).filter(Boolean).sort()]
  }, [filteredPre, filteredPos])

  // Atletas com dor no pré
  const atletasComDorPre = useMemo(() =>
    filteredPre.filter(r => parseFloat(r['Está sentindo alguma dor localizada?']) > 0)
  , [filteredPre])

  // Atletas com dor no pós
  const atletasComDorPos = useMemo(() =>
    filteredPos.filter(r => parseFloat(r['Está sentindo alguma dor localizada?']) > 0)
  , [filteredPos])

  // Total de atletas com dor (pré + pós, sem duplicar)
  const totalComDor = useMemo(() => {
    const nomes = new Set([
      ...atletasComDorPre.map(r => (r['Atletas']||'').trim()),
      ...atletasComDorPos.map(r => (r['Atleta']||'').trim()),
    ])
    return nomes.size
  }, [atletasComDorPre, atletasComDorPos])

  // Contagem para badge da aba
  const dorTabCount = useMemo(() => atletasComDorPre.length + atletasComDorPos.length, [atletasComDorPre, atletasComDorPos])

  // Estatísticas do dia
  const stats = useMemo(() => {
    const scores   = filteredPre.map(r => calcWellness(r)).filter(s => s !== null)
    const alertas  = filteredPre.filter(r => { const s = calcWellness(r); return s !== null && s < 0.45 })
    const comDor   = atletasComDorPre
    const media    = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null
    const pses     = filteredPos.map(r => parseFloat(r['Qual sua percepção de esforço pós-treino ?'])).filter(Boolean)
    const mediaPse = pses.length ? pses.reduce((a,b)=>a+b,0)/pses.length : null
    const total    = new Set([
      ...filteredPre.map(r=>(r['Atletas']||'').trim()),
      ...filteredPos.map(r=>(r['Atleta']||'').trim()),
    ]).size
    return { total, preTotal:filteredPre.length, posTotal:filteredPos.length, alertas:alertas.length, comDor:totalComDor, media, mediaPse }
  }, [filteredPre, filteredPos, atletasComDorPre, totalComDor])

  if (!photosLoaded) return (
    <div className="dm flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{borderColor:G.cinzaMed, borderTopColor:G.amarelo}}/>
    </div>
  )

  return (
    <>
      <style>{STYLE}</style>
      <style>{`
        #bestar-fullscreen-root:fullscreen {
          overflow-y: auto;
          background: #0f172a;
          padding: 24px;
        }
        .tv-card-enter { animation: tvSlideIn 0.4s ease both; }
        @keyframes tvSlideIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
      `}</style>
      {/* Auto-avanço de página quando em fullscreen + aba pré ou pós */}
      {isFullscreen && (activeTab === 'pre' || activeTab === 'pos') && (() => {
        const rows = activeTab === 'pre'
          ? sortPre(filteredPre, sortOrder)
          : sortPos(filteredPos, sortOrder)
        const totalPages = Math.ceil(rows.length / TV_PAGE_SIZE)
        if (totalPages <= 1) return null
        return <TvAutoAdvance totalPages={totalPages} currentPage={tvPage} onChangePage={setTvPage} />
      })()}
      <div id="bestar-fullscreen-root" className="dm space-y-5">

          {/* HEADER */}
          <div className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
            style={{background:G.branco, borderLeft:`6px solid ${G.verde}`}}>
            <div>
              <h1 className="bc text-4xl font-black" style={{color:G.azul}}>BEM-ESTAR & PSE</h1>
              <p className="text-sm mt-1" style={{color:G.cinzaEsc}}>Respostas de pré e pós treino dos atletas</p>
              {CORPO_TECNICO_DEMO_ENABLED && <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-sky-700"><span className="h-2 w-2 rounded-full bg-sky-500"/>Modo demonstração · dados fictícios do Confiança</div>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {lastUpdated && (
                <span className="text-[10px] font-medium" style={{color:G.cinzaEsc}}>
                  Atualizado: {lastUpdated.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                </span>
              )}

              {/* Ordenação */}
              <button
                onClick={() => setSortOrder(o => o === 'atencao' ? 'alfa' : 'atencao')}
                title={sortOrder === 'atencao' ? 'Ordenado por Atenção — clique para Alfabética' : 'Ordenado Alfabeticamente — clique para Atenção primeiro'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all border-2"
                style={{
                  background: sortOrder === 'atencao' ? '#FEF3C7' : G.cinza,
                  borderColor: sortOrder === 'atencao' ? G.amarelo : G.cinzaMed,
                  color: sortOrder === 'atencao' ? '#92400E' : G.azul,
                }}
              >
                {sortOrder === 'atencao'
                  ? <><span>🚨</span> Atenção</>
                  : <><span>🔤</span> A–Z</>
                }
              </button>

              {/* Tela Cheia */}
              <button
                onClick={() => {
                  const el = document.getElementById('bestar-fullscreen-root')
                  if (!document.fullscreenElement) {
                    el?.requestFullscreen().catch(() => {})
                  } else {
                    document.exitFullscreen().catch(() => {})
                  }
                }}
                title="Tela Cheia"
                className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                style={{background:G.cinza, color:G.azul, border:`1px solid ${G.cinzaMed}`}}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"/>
                </svg>
                Tela Cheia
              </button>

              {/* Exportar PDF */}
              <button
                onClick={() => {
                  const el = document.getElementById('bestar-fullscreen-root')
                  if (!el) return
                  // Clona o conteúdo e remove elementos marcados como no-print
                  const clone = el.cloneNode(true)
                  clone.querySelectorAll('#bestar-no-print, [id="bestar-no-print"]').forEach(n => n.remove())
                  // Captura todos os estilos inline do documento atual
                  const allStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                    .map(s => s.outerHTML).join('\n')
                  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Bem-Estar & PSE — Confiança</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  ${allStyles}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #F3F4F6; font-family: 'DM Sans', sans-serif; }
    .bc { font-family: 'Barlow Condensed', sans-serif !important; }
    .dm { font-family: 'DM Sans', sans-serif !important; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      body { background: white; padding: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
  <script>
    // Aguarda fontes e imagens carregarem antes de imprimir
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 800)
    }
  </script>
</body>
</html>`
                  const win = window.open('', '_blank', 'width=1200,height=800')
                  if (!win) { alert('Permita pop-ups para gerar o PDF.'); return }
                  win.document.write(html)
                  win.document.close()
                }}
                title="Exportar PDF"
                className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                style={{background:G.amarelo, color:G.azul}}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="12" x2="12" y2="18"/>
                  <polyline points="9 15 12 18 15 15"/>
                </svg>
                Exportar PDF
              </button>

              <button onClick={() => loadData()} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-black transition-all disabled:opacity-50"
                style={{background:G.verde, color:G.branco}}>
                {loading ? '⟳ Carregando...' : '↻ Atualizar'}
              </button>

              <button onClick={() => setVincularOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-black transition-all"
                style={{background:G.azul, color:G.branco}}
                title="Vincular nomes da planilha aos nomes do GPS">
                🔗 Vincular GPS
              </button>
            </div>
          </div>

          {/* FILTROS */}
          <div id="bestar-no-print" className="flex flex-wrap items-center gap-4 rounded-xl px-4 py-3" style={{background:G.branco}}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{color:G.verde}}>Data:</span>
              <select
                value={currentDate}
                onChange={e => { setSelectedDate(e.target.value); setSelectedAtleta('Todos') }}
                className="border-2 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none"
                style={{borderColor:G.amarelo, background:G.branco}}
              >
                {dates.length === 0 && <option value="">Sem dados</option>}
                {dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{color:G.verde}}>Atleta:</span>
              <select
                value={selectedAtleta}
                onChange={e => setSelectedAtleta(e.target.value)}
                className="border-2 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none"
                style={{borderColor:G.amarelo, background:G.branco}}
              >
                {atletasDoDia.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {currentDate && (
              <span className="text-[10px] font-black uppercase tracking-widest ml-auto" style={{color:G.cinzaEsc}}>
                {stats.preTotal} respostas pré · {stats.posTotal} respostas pós
              </span>
            )}
          </div>

          {/* CARDS RESUMO */}
          {(filteredPre.length > 0 || filteredPos.length > 0) && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label:'Responderam',    val:stats.total,
                  sub:`${stats.preTotal} pré · ${stats.posTotal} pós`,
                  color:G.azul, bg:G.branco, bc:G.cinzaMed },
                { label:'Alertas',        val:stats.alertas,
                  sub:'score crítico',
                  color:stats.alertas>0?G.vermelho:G.verdeClaro,
                  bg:stats.alertas>0?'#FEE2E2':'#DCFCE7',
                  bc:stats.alertas>0?G.vermelho:G.verdeClaro },
                { label:'Média Wellness', val:stats.media!==null?(stats.media*10).toFixed(1):'—',
                  sub:'escala 0–10',
                  color:stats.media===null?G.cinzaEsc:stats.media>=0.7?G.verdeClaro:stats.media>=0.45?G.laranja:G.vermelho,
                  bg:G.branco, bc:G.cinzaMed },
                { label:'Com Dor',        val:stats.comDor,
                  sub:'dor localizada (pré)',
                  color:stats.comDor>0?G.laranja:G.cinzaEsc,
                  bg:stats.comDor>0?'#FFF7ED':G.branco,
                  bc:stats.comDor>0?G.laranja:G.cinzaMed },
                { label:'Média PSE',      val:stats.mediaPse!==null?stats.mediaPse.toFixed(1):'—',
                  sub:'percepção esforço',
                  color:G.azul, bg:G.branco, bc:G.cinzaMed },
              ].map((s,i) => (
                <div key={i} className="rounded-xl p-3 border-2" style={{background:s.bg, borderColor:s.bc}}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{color:G.cinzaEsc}}>{s.label}</p>
                  <p className="text-2xl font-black" style={{color:s.color}}>{s.val}</p>
                  <p className="text-[10px]" style={{color:G.cinzaEsc}}>{s.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* ABAS */}
          <div className="flex gap-1 border-b-2" style={{borderColor:G.cinzaMed}}>
            {[
              { id:'pre', label:`Pré-Treino (${filteredPre.length})` },
              { id:'pos', label:`Pós-Treino / PSE (${filteredPos.length})` },
              { id:'dor', label:`Dor Localizada (${dorTabCount})` },
              { id:'peso',      label:'⚖️ Peso' },
              { id:'pse_gps',   label:'📡 Carga × PSE' },
              { id:'acwr',      label:'📈 Agudo × Crônico' },
              { id:'heatmap',   label:'🌡 Heatmap' },
              { id:'posicao',   label:'📊 Por Posição' },
              { id:'atleta',    label:'👤 Atleta' },
            ].map(tab => (
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-all -mb-0.5"
                style={{
                  borderColor: activeTab===tab.id ? G.amarelo : 'transparent',
                  color:       activeTab===tab.id ? G.azul   : G.cinzaEsc,
                  background: 'transparent',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* LOADING */}
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{borderColor:G.cinzaMed, borderTopColor:G.amarelo}}/>
            </div>
          )}

          {/* ABA PRÉ */}
          {!loading && activeTab==='pre' && (() => {
            const sorted = sortPre(filteredPre, sortOrder)
            const rows = isFullscreen
              ? sorted.slice(tvPage * TV_PAGE_SIZE, (tvPage + 1) * TV_PAGE_SIZE)
              : sorted
            return filteredPre.length === 0
              ? <div className="text-center py-16 font-black uppercase text-sm" style={{color: isFullscreen ? '#fff' : G.cinzaEsc}}>
                  Sem respostas pré-treino {currentDate ? `em ${fmtDate(currentDate)}` : ''}
                </div>
              : <>
                  {isFullscreen && <TvHeader rows={sorted} page={tvPage} pageSize={TV_PAGE_SIZE} date={currentDate} tab="Pré-Treino" stats={stats} />}
                  <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                    {rows.map((row,i) => (
                      <div key={i} className={isFullscreen ? 'tv-card-enter' : ''} style={isFullscreen ? {animationDelay:`${i*40}ms`} : {}}>
                        <PreCard row={row} getPhotoUrl={getPhotoUrl}
                          gpsYesterday={prevDayGpsMap[normalizeName(resolveGps((row['Atletas']||'').trim()) || (row['Atletas']||'').trim())] || null}
                          prevDate={prevDate}
                          onPhotoClick={name => { setPhotoModalPlayer(name); setPhotoModalOpen(true) }}/>
                      </div>
                    ))}
                  </div>
                </>
          })()}

          {/* ABA PÓS */}
          {!loading && activeTab==='pos' && (() => {
            const sorted = sortPos(filteredPos, sortOrder)
            const rows = isFullscreen
              ? sorted.slice(tvPage * TV_PAGE_SIZE, (tvPage + 1) * TV_PAGE_SIZE)
              : sorted
            return filteredPos.length === 0
              ? <div className="text-center py-16 font-black uppercase text-sm" style={{color: isFullscreen ? '#fff' : G.cinzaEsc}}>
                  Sem respostas pós-treino {currentDate ? `em ${fmtDate(currentDate)}` : ''}
                </div>
              : <>
                  {isFullscreen && <TvHeader rows={sorted} page={tvPage} pageSize={TV_PAGE_SIZE} date={currentDate} tab="Pós-Treino / PSE" stats={stats} />}
                  <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                    {rows.map((row,i) => (
                      <div key={i} className={isFullscreen ? 'tv-card-enter' : ''} style={isFullscreen ? {animationDelay:`${i*40}ms`} : {}}>
                        <PosCard row={row} getPhotoUrl={getPhotoUrl}/>
                      </div>
                    ))}
                  </div>
                </>
          })()}

          {/* ABA DOR */}
          {!loading && activeTab==='dor' && (() => {
            const preExibe = apenasAlerta
              ? atletasComDorPre.filter(r => parseFloat(r['Está sentindo alguma dor localizada?']) >= 4)
              : atletasComDorPre
            const posExibe = sortDor(apenasAlerta
              ? atletasComDorPos.filter(r => parseFloat(r['Está sentindo alguma dor localizada?']) >= 4)
              : atletasComDorPos, 'Atleta', sortOrder)
            const preExibeSort = sortDor(preExibe, 'Atletas', sortOrder)

            const semDados = preExibeSort.length === 0 && posExibe.length === 0

            // Agrupa regiões por fonte (pré e pós separados)
            function regioesDe(rows, col) {
              const freq = {}
              rows.forEach(r => {
                const loc = (r['Local da Dor']||'').trim()
                if (loc) loc.split(',').map(s=>s.trim()).filter(Boolean).forEach(l => { freq[l] = (freq[l]||0)+1 })
              })
              return Object.entries(freq).sort((a,b)=>b[1]-a[1])
            }

            return (
              <div className="space-y-4">
                {/* Barra de filtro */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setApenasAlerta(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all border-2"
                    style={{
                      background: apenasAlerta ? G.vermelho : G.branco,
                      borderColor: G.vermelho,
                      color: apenasAlerta ? G.branco : G.vermelho,
                    }}
                  >
                    🚨 Apenas Dor ≥ 4
                  </button>
                  <span className="text-[10px] font-medium" style={{color: G.cinzaEsc}}>
                    {apenasAlerta
                      ? `${preExibeSort.length + posExibe.length} atleta(s) com dor ≥ 4`
                      : `${dorTabCount} ocorrência(s) no total`
                    }
                  </span>
                </div>

                {semDados ? (
                  <div className="text-center py-16 font-black uppercase text-sm" style={{color: G.verdeClaro}}>
                    ✓ Nenhum atleta{apenasAlerta ? ' com dor ≥ 4' : ' com dor'} {currentDate ? `em ${fmtDate(currentDate)}` : ''}
                  </div>
                ) : (
                  <>
                    {/* ── PRÉ-TREINO ── */}
                    {preExibeSort.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{background: G.verde}}/>
                          <p className="text-xs font-black uppercase tracking-widest" style={{color: G.verde}}>
                            Pré-Treino — {preExibeSort.length} atleta{preExibeSort.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {/* Regiões pré */}
                        {regioesDe(preExibe).length > 0 && (
                          <div className="rounded-xl p-3 border" style={{background:'#F0FDF4', borderColor: G.verde+'44'}}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{color: G.verde}}>Regiões afetadas (pré)</p>
                            <div className="flex flex-wrap gap-1.5">
                              {regioesDe(preExibe).map(([k,v]) => (
                                <div key={k} className="flex items-center gap-1 rounded-lg px-2 py-1 border" style={{background: G.branco, borderColor: G.verde+'44'}}>
                                  <span className="text-[10px] font-bold" style={{color: G.verde}}>{k}</span>
                                  <span className="text-[8px] font-black px-1 rounded-full text-white" style={{background: G.verde}}>{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {preExibeSort.map((row, i) => {
                            const nome   = (row['Atletas']||'').trim()
                            const dor    = parseFloat(row['Está sentindo alguma dor localizada?']) || 0
                            const dorLoc = (row['Local da Dor']||'').trim()
                            const photo  = getPhotoUrl(nome)
                            const avg    = calcWellness(row)
                            const { label:wl, color:wc } = getScoreStyle(avg)
                            const isAlert = dor >= 4
                            return (
                              <div key={i} className="rounded-xl p-4 border-2" style={{
                                background: isAlert ? '#FEE2E2' : '#FFF7ED',
                                borderColor: isAlert ? G.vermelho : G.laranja
                              }}>
                                <div className="flex items-center gap-3 mb-2">
                                  <PlayerAvatar nome={nome} photo={photo} color={isAlert ? G.vermelho : G.laranja}/>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black uppercase truncate" style={{color: isAlert ? G.vermelho : G.laranja}}>{nome}</p>
                                    <span className="text-[7px] font-black uppercase" style={{color: G.cinzaEsc}}>Pré-Treino</span>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-sm font-black px-2 py-0.5 rounded-lg" style={{background: isAlert ? G.vermelho : G.laranja, color: G.branco}}>{dor}/10</span>
                                    {isAlert && <span className="text-[7px] font-black uppercase px-1 rounded" style={{background:'#991B1B', color:'white'}}>ATENÇÃO</span>}
                                  </div>
                                </div>
                                {dorLoc && <p className="text-[10px] font-medium mb-2 leading-tight" style={{color:'#991B1B'}}>{dorLoc}</p>}
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-medium" style={{color:G.cinzaEsc}}>Wellness:</span>
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{background:wc+'22', color:wc}}>{wl}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── PÓS-TREINO ── */}
                    {posExibe.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{background: G.azul}}/>
                          <p className="text-xs font-black uppercase tracking-widest" style={{color: G.azul}}>
                            Pós-Treino — {posExibe.length} atleta{posExibe.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {/* Regiões pós */}
                        {regioesDe(posExibe).length > 0 && (
                          <div className="rounded-xl p-3 border" style={{background:'#EFF6FF', borderColor: G.azul+'44'}}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{color: G.azul}}>Regiões afetadas (pós)</p>
                            <div className="flex flex-wrap gap-1.5">
                              {regioesDe(posExibe).map(([k,v]) => (
                                <div key={k} className="flex items-center gap-1 rounded-lg px-2 py-1 border" style={{background: G.branco, borderColor: G.azul+'44'}}>
                                  <span className="text-[10px] font-bold" style={{color: G.azul}}>{k}</span>
                                  <span className="text-[8px] font-black px-1 rounded-full text-white" style={{background: G.azul}}>{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {posExibe.map((row, i) => {
                            const nome   = (row['Atleta']||'').trim()
                            const dor    = parseFloat(row['Está sentindo alguma dor localizada?']) || 0
                            const dorLoc = (row['Local da Dor']||'').trim()
                            const pse    = parseFloat(row['Qual sua percepção de esforço pós-treino ?']) || 0
                            const photo  = getPhotoUrl(nome)
                            const isAlert = dor >= 4
                            return (
                              <div key={i} className="rounded-xl p-4 border-2" style={{
                                background: isAlert ? '#FEE2E2' : '#FFF7ED',
                                borderColor: isAlert ? G.vermelho : G.laranja
                              }}>
                                <div className="flex items-center gap-3 mb-2">
                                  <PlayerAvatar nome={nome} photo={photo} color={isAlert ? G.vermelho : G.laranja}/>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black uppercase truncate" style={{color: isAlert ? G.vermelho : G.laranja}}>{nome}</p>
                                    <span className="text-[7px] font-black uppercase" style={{color: G.cinzaEsc}}>Pós-Treino</span>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-sm font-black px-2 py-0.5 rounded-lg" style={{background: isAlert ? G.vermelho : G.laranja, color: G.branco}}>{dor}/10</span>
                                    {isAlert && <span className="text-[7px] font-black uppercase px-1 rounded" style={{background:'#991B1B', color:'white'}}>ATENÇÃO</span>}
                                  </div>
                                </div>
                                {dorLoc && <p className="text-[10px] font-medium mb-2 leading-tight" style={{color:'#991B1B'}}>{dorLoc}</p>}
                                {pse > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-medium" style={{color:G.cinzaEsc}}>PSE:</span>
                                    <span className="text-[9px] font-black" style={{color: pse >= 8 ? G.vermelho : pse >= 5 ? G.laranja : G.verdeClaro}}>{pse}/10</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          {/* ABA PESO */}
          {!loading && activeTab==='peso' && (
            <TabPeso preRows={preRows} posRows={posRows} getPhotoUrl={getPhotoUrl} />
          )}

          {!loading && activeTab==='pse_gps' && (
            <TabCargaPSE posRows={posRows} gpsSessions={gpsSessions} getPhotoUrl={getPhotoUrl} resolveGps={resolveGps} />
          )}
          {!loading && activeTab==='acwr' && (
            <TabAgudoCronico posRows={posRows} duracoes={duracoes} onSaveDuracao={onSaveDuracao} getPhotoUrl={getPhotoUrl} />
          )}
          {!loading && activeTab==='heatmap' && (
            <TabHeatmap preRows={preRows} />
          )}
          {!loading && activeTab==='posicao' && (
            <TabWellnessPosicao preRows={preRows} posRows={posRows} gpsSessions={gpsSessions} resolveGps={resolveGps} />
          )}
          {!loading && activeTab==='atleta' && (
            <TabAtleta preRows={preRows} posRows={posRows} gpsSessions={gpsSessions} getPhotoUrl={getPhotoUrl} resolveGps={resolveGps} onOpenPhoto={(n)=>{setPhotoModalPlayer(n);setPhotoModalOpen(true)}} />
          )}

          {/* Estado vazio geral */}
          {!loading && dates.length === 0 && (
            <div className="rounded-2xl p-16 text-center" style={{background:G.branco}}>
              <p className="font-black uppercase text-sm" style={{color:G.cinzaEsc}}>Sem dados de bem-estar</p>
              <p className="text-xs mt-1" style={{color:G.cinzaEsc}}>Verifique a conexão com o Google Sheets</p>
            </div>
          )}

      </div>{/* fim bestar-fullscreen-root */}
      <div id="bestar-no-print">
        <PhotoSelectorModal
          isOpen={photoModalOpen}
          playerName={photoModalPlayer}
          currentPhoto={photoModalPlayer ? getPhotoUrl(photoModalPlayer) : null}
          onPhotoSelect={filename => {
            if (photoModalPlayer && filename) setPhoto(photoModalPlayer, filename)
            else if (photoModalPlayer) setPhoto(photoModalPlayer, null)
          }}
          onClose={() => { setPhotoModalOpen(false); setPhotoModalPlayer(null) }}
        />
      </div>

      <VincularGpsModal
        isOpen={vincularOpen}
        onClose={() => setVincularOpen(false)}
        wellnessNames={Array.from(new Set([
          ...preRows.map(r => (r['Atletas']||'').trim()),
          ...posRows.map(r => (r['Atleta']||'').trim()),
        ].filter(Boolean))).sort()}
        gpsNames={gpsAllNames}
        aliases={aliases}
        resolveGps={resolveGps}
        onSaved={loadData}
      />
    </>
  )
}


// Página standalone (rota /fisiologia/bem-estar)
export default function BemEstarPage() {
  const router = useRouter()
  return (
    <AppShell>
      <div className="dm min-" style={{background:'#F3F4F6'}}>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="bc text-4xl font-black" style={{color:'#1E3A8A'}}>BEM-ESTAR & PSE</h1>
              <p className="text-sm" style={{color:'#9CA3AF'}}>Respostas de pré e pós treino dos atletas</p>
              {CORPO_TECNICO_DEMO_ENABLED && <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-sky-600">Modo demonstração · dados fictícios</p>}
            </div>
            <button onClick={()=>router.push('/fisiologia')}
              className="px-4 py-2 rounded-lg text-sm font-black"
              style={{background:'#E5E7EB', color:'#1E3A8A'}}>
              ← Voltar
            </button>
          </div>
          <BemEstarContent />
        </div>
      </div>
    </AppShell>
  )
}
