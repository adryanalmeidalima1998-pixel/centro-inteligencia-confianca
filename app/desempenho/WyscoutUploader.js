'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'

const GFC  = '#0a66b7'
const RED  = '#c62828'
const BLUE = '#1565c0'
const PURP = '#6a1b9a'
const AMB  = '#b45309'
const GFC2 = '#eaf4fd'

/* ── PDF → Images (client-side) ──────────────────────────────── */
async function pdfToImages(file, maxPages = 14, onProgress) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const total = Math.min(pdf.numPages, maxPages)
  const images = []
  for (let i = 1; i <= total; i++) {
    onProgress?.(`Renderizando página ${i} de ${total}...`)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 0.9 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', 0.75).split(',')[1])
  }
  return images
}

/* ── Excel → base64 ──────────────────────────────────────────── */
async function excelToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = () => rej(new Error('Falha ao ler arquivo'))
    r.readAsDataURL(file)
  })
}

/* ── Safe fetch JSON (never throws on non-JSON responses) ─────── */
async function safeJson(res) {
  const text = await res.text()
  try { return JSON.parse(text) } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`)
  }
}

/* ── Helpers ──────────────────────────────────────────────────── */
function n(v, d = 1) { const f = parseFloat(v) || 0; return f % 1 === 0 ? f : f.toFixed(d) }
function avg(arr, k) {
  const vals = arr.map(p => parseFloat(p?.matchData?.guarani?.[k]) || 0)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}
function resultBadge(p) {
  const gfc = p.matchData?.guarani?.goals ?? 0
  const opp = p.matchData?.guarani?.goalsConceded ?? 0
  if (gfc > opp) return { txt: 'V', bg: GFC, color: '#fff' }
  if (gfc < opp) return { txt: 'D', bg: RED, color: '#fff' }
  return { txt: 'E', bg: '#f59e0b', color: '#fff' }
}

/* ── Design tokens ────────────────────────────────────────────── */
const S = {
  card: { background: '#fff', borderRadius: 14, border: '1px solid #e5edf5', boxShadow: '0 1px 6px rgba(10,102,183,0.05)', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #f4f8fc' },
  body: { padding: '16px 18px' },
  btnGreen: { background: GFC, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 },
  btnGhost: { background: '#fff', color: GFC, border: '1.5px solid #c6def2', borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 },
}

function Card({ title, sub, action, children, noPad }) {
  return (
    <div style={S.card}>
      {(title || action) && (
        <div style={S.head}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#10233b' }}>{title}</p>
            {sub && <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={noPad ? undefined : S.body}>{children}</div>
    </div>
  )
}
function Chip({ label, value, sub, color = GFC, small }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5edf5', padding: small ? '10px 14px' : '14px 18px', flex: '1 1 120px', minWidth: 0 }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: small ? 20 : 26, fontWeight: 900, color, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}
function MBar({ data, keys, colors, height = 140 }) {
  if (!data?.length) return <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#c0d8c4' }}>Sem dados</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 2, right: 2, bottom: 4, left: -22 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f8fc" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5edf5' }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.name} fill={colors[i] || GFC} radius={[3,3,0,0]} maxBarSize={26} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}
function MLine({ data, keys, colors, height = 140 }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 4, left: -22 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f8fc" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5edf5' }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {keys.map((k, i) => <Line key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={colors[i] || GFC} strokeWidth={2} dot={{ r: 3 }} />)}
      </LineChart>
    </ResponsiveContainer>
  )
}
function BilatBar({ label, gfc, opp, cGfc = GFC, cOpp = RED }) {
  const total = (parseFloat(gfc)||0) + (parseFloat(opp)||0) || 1
  const pct = Math.round(((parseFloat(gfc)||0) / total) * 100)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: cGfc }}>{typeof gfc==='number' ? (gfc%1===0 ? gfc : gfc.toFixed(2)) : gfc}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: cOpp }}>{typeof opp==='number' ? (opp%1===0 ? opp : opp.toFixed(2)) : opp}</span>
      </div>
      <div style={{ display: 'flex', borderRadius: 99, overflow: 'hidden', height: 7 }}>
        <div style={{ width: `${pct}%`, background: cGfc, transition: 'width 0.4s' }} />
        <div style={{ flex: 1, background: cOpp }} />
      </div>
    </div>
  )
}

/* ── DropZone ─────────────────────────────────────────────────── */
function DropZone({ accept, label, icon, onFile, loading, progress, done, onClear }) {
  const ref = useRef()
  const [drag, setDrag] = useState(false)
  if (done) return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${GFC}`, background: GFC2, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18 }}>✅</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: GFC }}>Arquivo carregado</p>
        <p style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{done}</p>
      </div>
      <button onClick={onClear} style={{ background: 'none', border: '1px solid #bfd8ea', borderRadius: 7, padding: '4px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer' }}>Trocar</button>
    </div>
  )
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
      onClick={() => !loading && ref.current?.click()}
      style={{ borderRadius: 10, border: `1.5px dashed ${drag ? GFC : '#bfd8ea'}`, background: drag ? GFC2 : '#f7fcf9', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.8 : 1, transition: 'all 0.15s' }}>
      <span style={{ fontSize: 24 }}>{loading ? '⏳' : icon}</span>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#2d4a35', textAlign: 'center' }}>{loading ? (progress || 'Processando...') : label}</p>
      <p style={{ fontSize: 10, color: '#94a3b8' }}>{loading ? '' : 'Clique ou arraste o arquivo'}</p>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}

/* ── Exclusive: Timeline charts ───────────────────────────────── */
function TimelineCharts({ exclusive, oppName }) {
  const tl = exclusive?.timeline
  if (!tl) return <p style={{ fontSize: 11, color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>Sem dados de timeline. Faça upload do PDF Exclusivo para esta partida.</p>

  const labels = tl.labels || ['1-15','16-30','31-45+','46-60','61-75','76-90+']
  const g = tl.guarani || {}
  const o = tl.opponent || {}

  function tlData(key) {
    return labels.map((label, i) => ({
      label,
      Confiança: parseFloat(g[key]?.[i]) || 0,
      [oppName]: parseFloat(o[key]?.[i]) || 0,
    }))
  }

  const charts = [
    { key: 'possession',       title: 'Posse %',               unit: '%' },
    { key: 'passAccuracy',     title: 'Precisão de passe %',   unit: '%' },
    { key: 'ppda',             title: 'PPDA (↓ = mais pressão)', unit: '' },
    { key: 'duelsWonPct',      title: 'Duelos ganhos %',       unit: '%' },
    { key: 'attacksPerMin',    title: 'Ataques por minuto',    unit: '' },
    { key: 'recoveriesPerMin', title: 'Recuperações por minuto', unit: '' },
    { key: 'deepPassShare',    title: 'Passes em profundidade %', unit: '%' },
    { key: 'midlineM',         title: 'Linha média (m)',       unit: 'm' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
      {charts.map(c => (
        <Card key={c.key} title={c.title} sub="Por intervalo de 15 min">
          <MLine
            data={tlData(c.key)}
            keys={[{ key: 'Confiança', name: 'Confiança' }, { key: oppName, name: oppName }]}
            colors={[GFC, RED]}
            height={130}
          />
        </Card>
      ))}
    </div>
  )
}

/* ── Exclusive: Shot log ──────────────────────────────────────── */
function ShotLog({ exclusive, oppName }) {
  const shots = exclusive?.shots
  if (!shots?.length) return <p style={{ fontSize: 11, color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>Sem dados de remates. Faça upload do PDF Exclusivo para esta partida.</p>

  const gfcShots = shots.filter(s => s.team === 'confianca')
  const oppShots = shots.filter(s => s.team !== 'confianca')

  function ShotTable({ list, color, title }) {
    const totalXG = list.reduce((s, x) => s + (parseFloat(x.xG) || 0), 0)
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</p>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>xG total: <strong style={{ color }}>{totalXG.toFixed(2)}</strong></span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f7fcf9' }}>
                {['Min', 'Jogador', 'Tipo', 'xG', 'PsxG', 'Gol'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5edf5', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.sort((a,b) => (a.minute||0)-(b.minute||0)).map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f4f8fc', background: s.goal ? '#f0fff4' : i%2 ? '#fafffe' : '#fff' }}>
                  <td style={{ padding: '6px 8px', color: '#94a3b8', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{s.minute}'</td>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#10233b' }}>{s.player}</td>
                  <td style={{ padding: '6px 8px', color: '#64748b', fontSize: 10 }}>{s.shotType}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: parseFloat(s.xG)>=0.2 ? color : '#64748b' }}>{n(s.xG,2)}</td>
                  <td style={{ padding: '6px 8px', color: '#64748b' }}>{s.psxG != null ? n(s.psxG,2) : '-'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{s.goal ? '⚽' : s.onTarget ? '🟡' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <ShotTable list={gfcShots} color={GFC} title="Confiança" />
      <ShotTable list={oppShots} color={RED} title={oppName} />
    </div>
  )
}

/* ── Exclusive: Corridors ─────────────────────────────────────── */
function Corridors({ exclusive, oppName }) {
  const c = exclusive?.corridors
  if (!c) return null
  function CorridorBar({ data, color, label }) {
    if (!data) return null
    return (
      <div style={{ textAlign: 'center', flex: 1 }}>
        <p style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</p>
        <p style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "'Barlow Condensed',sans-serif" }}>{data.attacks}</p>
        <p style={{ fontSize: 9, color: '#94a3b8' }}>ataques</p>
        <p style={{ fontSize: 13, fontWeight: 700, color, marginTop: 4 }}>{n(data.xG,2)} xG</p>
        <div style={{ background: '#f4f8fc', borderRadius: 6, height: 6, marginTop: 4, overflow: 'hidden' }}>
          <div style={{ width: `${data.pct||0}%`, background: color, height: '100%', borderRadius: 6 }} />
        </div>
        <p style={{ fontSize: 9, color, marginTop: 2, fontWeight: 700 }}>{data.pct}%</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
      <Card title="Corredores — Confiança">
        <div style={{ display: 'flex', gap: 12 }}>
          <CorridorBar data={c.guarani?.left}   color={GFC} label="Esq." />
          <CorridorBar data={c.guarani?.center} color={GFC} label="Centro" />
          <CorridorBar data={c.guarani?.right}  color={GFC} label="Dir." />
        </div>
      </Card>
      <Card title={`Corredores — ${oppName}`}>
        <div style={{ display: 'flex', gap: 12 }}>
          <CorridorBar data={c.opponent?.left}   color={RED} label="Esq." />
          <CorridorBar data={c.opponent?.center} color={RED} label="Centro" />
          <CorridorBar data={c.opponent?.right}  color={RED} label="Dir." />
        </div>
      </Card>
    </div>
  )
}

/* ── Match card ───────────────────────────────────────────────── */
function MatchCard({ partida, onDelete }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab]   = useState('stats')
  const g = partida.matchData?.guarani || {}
  const o = partida.matchData?.opponent || {}
  const badge = resultBadge(partida)
  const oppName = partida.homeTeam?.toLowerCase().includes('confianca') ? partida.awayTeam : partida.homeTeam
  const hasExclusive = !!partida.exclusiveData

  const comparisons = [
    { label: 'xG', gfc: g.xG, opp: o.xG },
    { label: 'Finalizações', gfc: g.shots, opp: o.shots },
    { label: 'No alvo', gfc: g.shotsOnTarget, opp: o.shotsOnTarget },
    { label: 'Posse %', gfc: g.possession, opp: o.possession },
    { label: 'Passes', gfc: g.passes, opp: o.passes },
    { label: 'Precisão p. %', gfc: g.passAccuracy, opp: o.passAccuracy },
    { label: 'Passes prog.', gfc: g.progressivePasses, opp: o.progressivePasses },
    { label: 'Recuperações', gfc: g.recoveries, opp: o.recoveries },
    { label: 'Duelos %', gfc: g.duelsPct, opp: o.duelsPct },
    { label: 'Duelos def. %', gfc: g.duelsDefPct, opp: o.duelsDefPct },
    { label: 'Duelos aéreos %', gfc: g.aerialDuelsPct, opp: o.aerialDuelsPct },
    { label: 'Toques área', gfc: g.touchesInBox, opp: o.touchesInBox },
    { label: 'Cruzamentos', gfc: g.crosses, opp: o.crosses },
    { label: 'Cantos', gfc: g.corners, opp: o.corners },
    { label: 'Interceções', gfc: g.interceptions, opp: o.interceptions },
    { label: 'PPDA (↓melhor)', gfc: g.ppda, opp: o.ppda, invert: true },
  ]

  const players    = partida.playersData || []
  const gfcPlayers = players.filter(p => p.team?.toLowerCase().includes('confianca'))
  const oppPlayers = players.filter(p => !p.team?.toLowerCase().includes('confianca'))

  const TABS = [
    ['stats', '📊 Comparação'],
    ['timeline', `📈 Timeline${hasExclusive ? '' : ' ○'}`],
    ['shots', `🎯 Remates${hasExclusive ? '' : ' ○'}`],
    ['players', '👤 Jogadores'],
  ]

  return (
    <div style={{ ...S.card, marginBottom: 12 }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: badge.bg, color: badge.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 }}>
          {badge.txt}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#10233b', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5 }}>
            {partida.homeTeam} <span style={{ color: GFC }}>{partida.score}</span> {partida.awayTeam}
          </p>
          <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            {partida.competition} · {partida.date}
            {hasExclusive && <span style={{ marginLeft: 8, color: GFC, fontSize: 9, fontWeight: 700, background: GFC2, borderRadius: 4, padding: '1px 5px' }}>+ Timeline</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
          {[
            { label: 'xG', val: n(g.xG,2), color: GFC },
            { label: 'xGA', val: n(o.xG,2), color: RED },
            { label: 'Posse', val: `${n(g.possession)}%`, color: BLUE },
            { label: 'PPDA', val: n(g.ppda), color: PURP },
          ].map(kp => (
            <div key={kp.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 900, color: kp.color, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{kp.val}</p>
              <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{kp.label}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onDelete(partida.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '5px 9px', fontSize: 11, color: RED, cursor: 'pointer' }}>🗑</button>
          <button onClick={() => setOpen(!open)} style={{ background: '#f4f8fc', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 10, color: '#52677e', cursor: 'pointer', fontWeight: 700 }}>
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #f4f8fc', padding: 18 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: '7px 14px', fontSize: 11, fontWeight: 700, borderRadius: 8,
                background: tab === k ? GFC : '#f4f8fc', color: tab === k ? '#fff' : '#64748b',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>{l}</button>
            ))}
          </div>

          {tab === 'stats' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: GFC }}>Confiança</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: RED }}>{oppName}</span>
                  </div>
                  {comparisons.map(c => (
                    <BilatBar key={c.label} label={c.label} gfc={c.gfc??0} opp={c.opp??0} cGfc={c.invert?RED:GFC} cOpp={c.invert?GFC:RED} />
                  ))}
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart layout="vertical"
                      data={[
                        { m: 'xG', gfc: g.xG||0, opp: o.xG||0 },
                        { m: 'Remates', gfc: g.shots||0, opp: o.shots||0 },
                        { m: 'Passes prog.', gfc: g.progressivePasses||0, opp: o.progressivePasses||0 },
                        { m: 'Recuperações', gfc: g.recoveries||0, opp: o.recoveries||0 },
                        { m: 'Toques área', gfc: g.touchesInBox||0, opp: o.touchesInBox||0 },
                        { m: 'Cantos', gfc: g.corners||0, opp: o.corners||0 },
                      ]}
                      margin={{ top: 4, right: 20, bottom: 4, left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f8fc" />
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="m" tick={{ fontSize: 10, fill: '#2d4a35' }} width={80} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="gfc" name="Confiança" fill={GFC} radius={[0,3,3,0]} maxBarSize={16} />
                      <Bar dataKey="opp" name={oppName} fill={RED} radius={[0,3,3,0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    {[{ label: 'Confiança', val: g.formation, color: GFC }, { label: oppName, val: o.formation, color: RED }].filter(f=>f.val).map(f => (
                      <div key={f.label} style={{ flex: 1, background: '#f7fcf9', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                        <p style={{ fontSize: 18, fontWeight: 900, color: f.color, fontFamily: "'Barlow Condensed',sans-serif" }}>{f.val}</p>
                        <p style={{ fontSize: 9, color: '#94a3b8' }}>{f.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Corridors inline in stats */}
                  <Corridors exclusive={partida.exclusiveData} oppName={oppName} />
                </div>
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <TimelineCharts exclusive={partida.exclusiveData} oppName={oppName} />
          )}

          {tab === 'shots' && (
            <ShotLog exclusive={partida.exclusiveData} oppName={oppName} />
          )}

          {tab === 'players' && (
            <div>
              {players.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: 12, color: '#c0d8c4', padding: '20px 0' }}>
                  Nenhum dado de jogadores. Faça upload do PDF de Jogadores e vincule a esta partida.
                </p>
              ) : (
                [{ title: 'Confiança', list: gfcPlayers, color: GFC }, { title: oppName, list: oppPlayers, color: RED }].map(team => (
                  <div key={team.title} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: team.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>{team.title}</p>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#f7fcf9' }}>
                            {['Jogador','Pos','Min','G','xG','Ast','Fin','P.%','P.Prog','D.%','Rec'].map(h => (
                              <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5edf5', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {team.list.sort((a,b) => (b.minutes||0)-(a.minutes||0)).map((p, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f4f8fc', background: i%2 ? '#fafffe' : '#fff' }}>
                              <td style={{ padding: '7px 8px', fontWeight: 600, color: '#10233b' }}>{p.name}</td>
                              <td style={{ padding: '7px 8px', color: '#94a3b8', fontSize: 10, fontWeight: 700 }}>{p.position}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.minutes||0}'</td>
                              <td style={{ padding: '7px 8px', fontWeight: p.goals>0?800:400, color: p.goals>0?GFC:'#64748b' }}>{p.goals||0}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{n(p.xG,2)}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.assists||0}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.shots||0}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.passAccuracy||0}%</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.progressivePasses||0}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.duelsPct||0}%</td>
                              <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.recoveries||0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Season Charts ────────────────────────────────────────────── */
function SeasonCharts({ partidas }) {
  const [tab, setTab] = useState('ofensivo')
  const cd = partidas.map(p => {
    const g = p.matchData?.guarani || {}
    const o = p.matchData?.opponent || {}
    const label = (p.homeTeam?.toLowerCase().includes('confianca') ? p.awayTeam : p.homeTeam)?.slice(0,10) || p.score
    return { label, g, o }
  }).reverse()

  const TABS = [
    { key: 'ofensivo', label: 'Ofensivo', color: GFC },
    { key: 'defensivo', label: 'Defensivo', color: RED },
    { key: 'gerais', label: 'Gerais', color: PURP },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 18px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: tab===t.key ? t.color : '#f4f8fc', color: tab===t.key ? '#fff' : '#64748b', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{t.label}</button>
        ))}
      </div>
      {tab === 'ofensivo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <Card title="Gols e xG" sub="Por jogo"><MBar data={cd.map(d=>({ label:d.label, 'Gols':d.g.goals||0, 'xG':d.g.xG||0 }))} keys={[{key:'Gols',name:'Gols'},{key:'xG',name:'xG'}]} colors={[GFC,'#66bb6a']} /></Card>
            <Card title="Finalizações" sub="Total e no alvo"><MBar data={cd.map(d=>({ label:d.label, 'Total':d.g.shots||0, 'No alvo':d.g.shotsOnTarget||0 }))} keys={[{key:'Total',name:'Total'},{key:'No alvo',name:'No alvo'}]} colors={[GFC,'#a5d6a7']} /></Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <Card title="Passes e precisão"><MBar data={cd.map(d=>({ label:d.label, 'Passes':d.g.passes||0, 'Precisão %':d.g.passAccuracy||0 }))} keys={[{key:'Passes',name:'Passes'},{key:'Precisão %',name:'Precisão %'}]} colors={[GFC,'#a5d6a7']} /></Card>
            <Card title="Passes progressivos"><MBar data={cd.map(d=>({ label:d.label, 'Progressivos':d.g.progressivePasses||0 }))} keys={[{key:'Progressivos',name:'Progressivos'}]} colors={[GFC]} /></Card>
          </div>
        </div>
      )}
      {tab === 'defensivo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <Card title="Gols sofridos e xGA"><MBar data={cd.map(d=>({ label:d.label, 'Gols sofridos':d.g.goalsConceded||0, 'xGA':d.o.xG||0 }))} keys={[{key:'Gols sofridos',name:'Gols sofridos'},{key:'xGA',name:'xGA'}]} colors={[RED,'#ef9a9a']} /></Card>
            <Card title="PPDA — pressão" sub="Menor = mais intenso"><MLine data={cd.map(d=>({ label:d.label, 'ADC':d.g.ppda||0, 'Adv':d.o.ppda||0 }))} keys={[{key:'ADC',name:'Confiança'},{key:'Adv',name:'Adversário'}]} colors={[GFC,BLUE]} /></Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <Card title="Recuperações"><MBar data={cd.map(d=>({ label:d.label, 'Recuperações':d.g.recoveries||0 }))} keys={[{key:'Recuperações',name:'Recuperações'}]} colors={[BLUE]} /></Card>
            <Card title="Duelos defensivos %"><MLine data={cd.map(d=>({ label:d.label, '%':d.g.duelsDefPct||0 }))} keys={[{key:'%',name:'Duelos def. %'}]} colors={[BLUE]} /></Card>
          </div>
        </div>
      )}
      {tab === 'gerais' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <Card title="Posse de bola %"><MLine data={cd.map(d=>({ label:d.label, 'Posse %':d.g.possession||0 }))} keys={[{key:'Posse %',name:'Posse %'}]} colors={[PURP]} /></Card>
            <Card title="Duelos totais %"><MLine data={cd.map(d=>({ label:d.label, 'Duelos %':d.g.duelsPct||0 }))} keys={[{key:'Duelos %',name:'Duelos %'}]} colors={[PURP]} /></Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <Card title="Ataques posicionais"><MBar data={cd.map(d=>({ label:d.label, 'Ataques':d.g.positionalAttacks||0 }))} keys={[{key:'Ataques',name:'Ataques pos.'}]} colors={[AMB]} /></Card>
            <Card title="Interceões"><MBar data={cd.map(d=>({ label:d.label, 'Interceões':d.g.interceptions||0 }))} keys={[{key:'Interceões',name:'Interceões'}]} colors={[BLUE]} /></Card>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────────────────── */
export default function WyscoutUploader() {
  const [partidas, setPartidas]     = useState([])
  const [dbLoading, setDbLoading]   = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadTab, setUploadTab]   = useState('excel')

  /* Excel state */
  const [excelFile, setExcelFile]       = useState(null)
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelProgress, setExcelProgress] = useState('')
  const [excelError, setExcelError]     = useState(null)
  const [excelPreview, setExcelPreview] = useState(null) // array of matches found

  /* Exclusive PDF state */
  const [exclFile, setExclFile]         = useState(null)
  const [exclLoading, setExclLoading]   = useState(false)
  const [exclProgress, setExclProgress] = useState('')
  const [exclError, setExclError]       = useState(null)
  const [exclPartida, setExclPartida]   = useState('')

  /* Players PDF state */
  const [playFile, setPlayFile]         = useState(null)
  const [playLoading, setPlayLoading]   = useState(false)
  const [playProgress, setPlayProgress] = useState('')
  const [playError, setPlayError]       = useState(null)
  const [linkPartida, setLinkPartida]   = useState('')

  useEffect(() => {
    fetch('/api/desempenho-wyscout')
      .then(r => r.json())
      .then(d => { setPartidas(d.partidas || []); setDbLoading(false) })
      .catch(() => setDbLoading(false))
  }, [])

  const reload = async () => {
    const fresh = await fetch('/api/desempenho-wyscout').then(r => r.json())
    setPartidas(fresh.partidas || [])
  }

  /* ── Excel upload ──────────────────────────────────────────── */
  const handleExcelFile = useCallback(async (file) => {
    setExcelLoading(true); setExcelError(null); setExcelPreview(null)
    setExcelProgress('Lendo arquivo...')
    try {
      const base64 = await excelToBase64(file)
      setExcelProgress('Processando colunas...')
      const res = await fetch('/api/parse-excel-wyscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setExcelFile(file.name)
      setExcelPreview(json.matches || [])
      setExcelProgress('')
    } catch (err) {
      setExcelError(err.message)
      setExcelProgress('')
    }
    setExcelLoading(false)
  }, [])

  const handleExcelSave = useCallback(async () => {
    if (!excelPreview?.length) return
    setExcelLoading(true); setExcelProgress('Salvando no banco...')
    try {
      const r = await fetch('/api/desempenho-wyscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_excel_batch', matches: excelPreview }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      await reload()
      setExcelFile(null); setExcelPreview(null)
    } catch (err) {
      setExcelError(err.message)
    }
    setExcelLoading(false); setExcelProgress('')
  }, [excelPreview])

  /* ── Exclusive PDF ─────────────────────────────────────────── */
  const handleExclFile = useCallback(async (file) => {
    if (!exclPartida) { setExclError('Selecione a partida antes.'); return }
    setExclLoading(true); setExclError(null); setExclProgress('Lendo PDF...')
    try {
      // Only send specific pages: 4 (dynamics), 5 (stats+corridors), 12-13 (shots)
      const images = await pdfToImages(file, 14, setExclProgress)
      setExclProgress('Enviando para processamento...')
      const res = await fetch('/api/parse-wyscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, type: 'exclusive' }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setExclProgress('Salvando dados exclusivos...')
      const save = await fetch('/api/desempenho-wyscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_exclusive', data: json.data, partida_id: parseInt(exclPartida) }),
      })
      const sj = await save.json()
      if (!save.ok) throw new Error(sj.error)
      await reload()
      setExclFile(file.name)
    } catch (err) {
      setExclError(err.message)
    }
    setExclLoading(false); setExclProgress('')
  }, [exclPartida])

  /* ── Players PDF ───────────────────────────────────────────── */
  const handlePlayersFile = useCallback(async (file) => {
    if (!linkPartida) { setPlayError('Selecione uma partida para vincular.'); return }
    setPlayLoading(true); setPlayError(null); setPlayProgress('Lendo PDF...')
    try {
      const images = await pdfToImages(file, 16, setPlayProgress)
      setPlayProgress('Processando dados...')
      const res = await fetch('/api/parse-wyscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, type: 'players' }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setPlayProgress('Salvando...')
      const r = await fetch('/api/desempenho-wyscout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_players', data: json.data, partida_id: parseInt(linkPartida) }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      await reload()
      setPlayFile(file.name)
    } catch (err) {
      setPlayError(err.message)
    }
    setPlayLoading(false); setPlayProgress('')
  }, [linkPartida])

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Remover esta análise?')) return
    await fetch(`/api/desempenho-wyscout?id=${id}`, { method: 'DELETE' })
    setPartidas(prev => prev.filter(p => p.id !== id))
  }, [])

  const kpis = partidas.length ? {
    jogos: partidas.length,
    vitorias: partidas.filter(p => { const g=p.matchData?.guarani; return (g?.goals||0)>(g?.goalsConceded||0) }).length,
    empates:  partidas.filter(p => { const g=p.matchData?.guarani; return (g?.goals||0)===(g?.goalsConceded||0) }).length,
    gols:    partidas.reduce((s,p) => s+(p.matchData?.guarani?.goals||0), 0),
    golsSof: partidas.reduce((s,p) => s+(p.matchData?.guarani?.goalsConceded||0), 0),
    xgMedio: avg(partidas,'xG').toFixed(2),
    xgaMedio:(partidas.reduce((s,p) => s+(p.matchData?.opponent?.xG||0),0)/partidas.length).toFixed(2),
    ppdaMedio: avg(partidas,'ppda').toFixed(1),
    posseMedio: avg(partidas,'possession').toFixed(1),
    duelosPct: avg(partidas,'duelsPct').toFixed(1),
  } : null

  const selectStyle = { background:'#f7fcf9', border:'1.5px solid #d6e5f0', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#10233b', outline:'none', fontFamily:'inherit', width:'100%' }

  if (dbLoading) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
      {[...Array(8)].map((_,i) => <div key={i} style={{ height:90, background:'#f4f8fc', borderRadius:14 }} />)}
    </div>
  )

  return (
    <div>
      {/* ── Upload panel ──────────────────────────────────────── */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={S.head}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#10233b' }}>📥 Importar dados Wyscout</p>
            <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Excel para stats gerais · PDF Exclusivo para timeline e remates · PDF Jogadores para dados individuais</p>
          </div>
          <button onClick={() => setShowUpload(!showUpload)} style={{ ...S.btnGhost, padding:'7px 14px', fontSize:11 }}>
            {showUpload ? '▲ Fechar' : '▼ Abrir upload'}
          </button>
        </div>

        {showUpload && (
          <div style={S.body}>
            {/* Tabs */}
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              {[
                ['excel',    '📊 Excel (stats)'],
                ['exclusive','🎯 PDF Exclusivo'],
                ['players',  '👤 PDF Jogadores'],
              ].map(([k,l]) => (
                <button key={k} onClick={() => setUploadTab(k)} style={{
                  padding:'7px 16px', fontSize:11, fontWeight:700, borderRadius:8,
                  background: uploadTab===k ? GFC : '#f4f8fc',
                  color: uploadTab===k ? '#fff' : '#64748b',
                  border:'none', cursor:'pointer', fontFamily:'inherit',
                }}>{l}</button>
              ))}
            </div>

            {/* ── Excel tab ─────────────────────────────────── */}
            {uploadTab === 'excel' && (
              <div>
                <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
                  💡 Wyscout → Relatório de Equipa → Exportar Excel (.xlsx) · Importa todos os jogos do arquivo de uma vez
                </p>
                {!excelFile ? (
                  <DropZone accept=".xlsx,.xls" icon="📊"
                    label="Team Stats Wyscout (.xlsx)"
                    onFile={handleExcelFile}
                    loading={excelLoading} progress={excelProgress}
                    done={null} onClear={() => {}} />
                ) : null}
                {excelFile && (
                  <div style={{ borderRadius:10, border:`1.5px solid ${GFC}`, background:GFC2, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>✅</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:12, fontWeight:700, color:GFC }}>Arquivo lido</p>
                      <p style={{ fontSize:10, color:'#64748b', marginTop:1 }}>{excelFile}</p>
                    </div>
                    <button onClick={() => { setExcelFile(null); setExcelPreview(null); setExcelError(null) }}
                      style={{ background:'none', border:'1px solid #bfd8ea', borderRadius:7, padding:'4px 10px', fontSize:11, color:'#64748b', cursor:'pointer' }}>Trocar</button>
                  </div>
                )}
                {excelPreview && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#2d4a35', marginBottom: 8 }}>
                      {excelPreview.length} partida{excelPreview.length!==1?'s':''} encontrada{excelPreview.length!==1?'s':''}:
                    </p>
                    <div style={{ border:'1px solid #e5edf5', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
                      {excelPreview.map((m, i) => (
                        <div key={i} style={{ padding:'8px 14px', borderBottom:'1px solid #f4f8fc', display:'flex', justifyContent:'space-between', alignItems:'center', background: i%2?'#fafffe':'#fff' }}>
                          <span style={{ fontSize:11, fontWeight:600, color:'#10233b' }}>{m.homeTeam} {m.score} {m.awayTeam}</span>
                          <span style={{ fontSize:10, color:'#94a3b8' }}>{m.date} · {m.competition}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleExcelSave} disabled={excelLoading} style={{ ...S.btnGreen }}>
                      💾 Salvar {excelPreview.length} partida{excelPreview.length!==1?'s':''}
                    </button>
                  </div>
                )}
                {excelError && <p style={{ fontSize:11, color:RED, marginTop:8 }}>⚠️ {excelError}</p>}
              </div>
            )}

            {/* ── Exclusive PDF tab ──────────────────────────── */}
            {uploadTab === 'exclusive' && (
              <div>
                <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
                  🎯 Extrai apenas dados exclusivos do PDF: timeline por 15min, remates com xG/PsxG e corredores de ataque · Extração configurada no servidor
                </p>
                {partidas.length === 0 ? (
                  <p style={{ fontSize:11, color:'#94a3b8' }}>Importe primeiro o Excel para depois adicionar dados exclusivos do PDF.</p>
                ) : (
                  <>
                    <div style={{ marginBottom:12 }}>
                      <label style={{ fontSize:10, color:'#64748b', fontWeight:600, display:'block', marginBottom:5 }}>Vincular à partida:</label>
                      <select value={exclPartida} onChange={e => setExclPartida(e.target.value)} style={selectStyle}>
                        <option value="">-- Selecione a partida --</option>
                        {partidas.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.exclusiveData ? '✅ ' : ''}{p.label} · {p.date}
                          </option>
                        ))}
                      </select>
                    </div>
                    <DropZone accept=".pdf" icon="🎯"
                      label="Relatório de Jogo Wyscout (.pdf)"
                      onFile={handleExclFile}
                      loading={exclLoading} progress={exclProgress}
                      done={exclFile} onClear={() => { setExclFile(null); setExclError(null) }} />
                    {exclError && <p style={{ fontSize:11, color:RED, marginTop:8 }}>⚠️ {exclError}</p>}
                  </>
                )}
              </div>
            )}

            {/* ── Players PDF tab ────────────────────────────── */}
            {uploadTab === 'players' && (
              <div>
                {partidas.length === 0 ? (
                  <p style={{ fontSize:11, color:'#94a3b8' }}>Importe primeiro o Excel para depois vincular jogadores.</p>
                ) : (
                  <>
                    <div style={{ marginBottom:12 }}>
                      <label style={{ fontSize:10, color:'#64748b', fontWeight:600, display:'block', marginBottom:5 }}>Vincular à partida:</label>
                      <select value={linkPartida} onChange={e => setLinkPartida(e.target.value)} style={selectStyle}>
                        <option value="">-- Selecione a partida --</option>
                        {partidas.map(p => <option key={p.id} value={p.id}>{p.label} · {p.date}</option>)}
                      </select>
                    </div>
                    <DropZone accept=".pdf" icon="👤"
                      label="Jogadores na partida (.pdf)"
                      onFile={handlePlayersFile}
                      loading={playLoading} progress={playProgress}
                      done={playFile} onClear={() => { setPlayFile(null); setPlayError(null) }} />
                    {playError && <p style={{ fontSize:11, color:RED, marginTop:8 }}>⚠️ {playError}</p>}
                    {!playFile && <p style={{ fontSize:10, color:'#94a3b8', marginTop:8 }}>💡 Wyscout → Relatório de jogo → Jogadores no jogo → Exportar PDF · Extração configurada no servidor</p>}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────── */}
      {partidas.length === 0 && (
        <div style={{ ...S.card, padding:60, textAlign:'center' }}>
          <p style={{ fontSize:40, marginBottom:12 }}>📊</p>
          <p style={{ fontSize:16, fontWeight:700, color:'#52677e', marginBottom:8 }}>Nenhuma análise salva ainda</p>
          <p style={{ fontSize:12, color:'#94a3b8', marginBottom:20 }}>Importe o Excel do Wyscout para começar</p>
          <button onClick={() => { setShowUpload(true); setUploadTab('excel') }} style={S.btnGreen}>📊 Importar Excel</button>
        </div>
      )}

      {/* ── Season KPIs ─────────────────────────────────────── */}
      {kpis && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
          <Chip label="Jogos" value={kpis.jogos} />
          <Chip label="V / E / D" value={`${kpis.vitorias} / ${kpis.empates} / ${kpis.jogos-kpis.vitorias-kpis.empates}`} color="#2d4a35" />
          <Chip label="Gols marcados" value={kpis.gols} color={GFC} />
          <Chip label="Gols sofridos" value={kpis.golsSof} color={RED} />
          <Chip label="xG médio" value={kpis.xgMedio} sub="por jogo" color={GFC} />
          <Chip label="xGA médio" value={kpis.xgaMedio} sub="por jogo" color={RED} />
          <Chip label="Posse média" value={`${kpis.posseMedio}%`} color={PURP} />
          <Chip label="PPDA médio" value={kpis.ppdaMedio} sub="↓ melhor" />
          <Chip label="Duelos % médio" value={`${kpis.duelosPct}%`} color={AMB} />
        </div>
      )}

      {/* ── Season charts ───────────────────────────────────── */}
      {partidas.length >= 2 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'0 0 14px' }}>
            <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', padding:'3px 10px', borderRadius:6, background:GFC2, color:GFC }}>TEMPORADA</span>
            <p style={{ fontSize:13, fontWeight:700, color:'#2d4a35' }}>Evolução estatística</p>
            <div style={{ flex:1, height:1, background:'#e5edf5' }} />
          </div>
          <SeasonCharts partidas={partidas} />
        </div>
      )}

      {/* ── Match list ──────────────────────────────────────── */}
      {partidas.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'0 0 14px' }}>
            <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', padding:'3px 10px', borderRadius:6, background:'#e8f0fe', color:BLUE }}>PARTIDAS</span>
            <p style={{ fontSize:13, fontWeight:700, color:'#2d4a35' }}>Análises salvas — {partidas.length} jogo{partidas.length!==1?'s':''}</p>
            <div style={{ flex:1, height:1, background:'#e5edf5' }} />
          </div>
          {partidas.map(p => <MatchCard key={p.id} partida={p} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  )
}
