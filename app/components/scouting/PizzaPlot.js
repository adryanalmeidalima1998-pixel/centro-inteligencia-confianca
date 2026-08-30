'use client'

const BANDS = [
  { from:0, to:20, color:'#a11218' },
  { from:20, to:40, color:'#d35a2c' },
  { from:40, to:60, color:'#d6bd86' },
  { from:60, to:80, color:'#72a96a' },
  { from:80, to:100, color:'#0b6b3a' },
]

function polar(cx, cy, r, angle) {
  const a = (angle - 90) * Math.PI / 180
  return { x:cx + r * Math.cos(a), y:cy + r * Math.sin(a) }
}

function sectorPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const p1 = polar(cx, cy, outerR, startAngle)
  const p2 = polar(cx, cy, outerR, endAngle)
  const p3 = polar(cx, cy, innerR, endAngle)
  const p4 = polar(cx, cy, innerR, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y} Z`
}

function labelAnchor(angle) {
  const normalized = ((angle % 360) + 360) % 360
  if (normalized < 8 || normalized > 352 || (normalized > 172 && normalized < 188)) return 'middle'
  return normalized < 180 ? 'start' : 'end'
}

export default function PizzaPlot({ metrics = [], score = null, title = 'PERCENTIS', percentileKey = 'percentileSerieC', emptyText = 'Base insuficiente para formar o pizza plot.' }) {
  const data = metrics.filter(m => m?.[percentileKey] != null).slice(0,10)
  if (data.length < 3) return <div style={{ padding:32, textAlign:'center', color:'#789083', fontSize:11 }}>{emptyText}</div>
  const size = 680
  const cx = size/2
  const cy = size/2
  const innerR = 48
  const maxR = 224
  const labelR = 266
  const step = 360 / data.length
  const gap = Math.min(2.3, step * .08)
  const radiusFor = pct => innerR + (Math.max(0, Math.min(100, pct))/100) * (maxR-innerR)

  return (
    <div style={{ width:'100%', maxWidth:700, margin:'0 auto' }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pizza plot de percentis do atleta" style={{ display:'block', width:'100%', height:'auto' }}>
        <circle cx={cx} cy={cy} r={maxR} fill="#fbfdfb" stroke="#dce9e0" strokeWidth="1" />
        {data.map((metric, index) => {
          const start = index * step + gap/2
          const end = (index + 1) * step - gap/2
          return <path key={`bg-${metric.key}`} d={sectorPath(cx,cy,innerR,maxR,start,end)} fill="#eef3ef" stroke="#fff" strokeWidth="2" />
        })}
        {data.map((metric, index) => {
          const pct = Math.max(0, Math.min(100, Number(metric?.[percentileKey]) || 0))
          const start = index * step + gap/2
          const end = (index + 1) * step - gap/2
          return BANDS.map(band => {
            const clippedTo = Math.min(pct, band.to)
            if (clippedTo <= band.from) return null
            return <path key={`${metric.key}-${band.to}`} d={sectorPath(cx,cy,radiusFor(band.from),radiusFor(clippedTo),start,end)} fill={band.color} stroke="#fff" strokeWidth="1.25" />
          })
        })}
        {[20,40,60,80,100].map(level => <circle key={level} cx={cx} cy={cy} r={radiusFor(level)} fill="none" stroke="rgba(255,255,255,.78)" strokeWidth="1.1" />)}
        <circle cx={cx} cy={cy} r={innerR-1} fill="#fff" stroke="#dce9e0" strokeWidth="1" />
        <text x={cx} y={cy-7} textAnchor="middle" style={{ fontSize:12, fontWeight:800, fill:'#547160', letterSpacing:'1px' }}>{title}</text>
        <text x={cx} y={cy+17} textAnchor="middle" style={{ fontSize:24, fontWeight:950, fill:'#153724' }}>{score != null ? score : '0–100'}</text>

        {data.map((metric, index) => {
          const angle = index * step + step/2
          const point = polar(cx,cy,labelR,angle)
          const anchor = labelAnchor(angle)
          const short = metric.label.length > 25 ? `${metric.label.slice(0,24)}…` : metric.label
          return <g key={`label-${metric.key}`}>
            <text x={point.x} y={point.y-2} textAnchor={anchor} style={{ fontSize:12, fontWeight:800, fill:'#173b27' }}>{short}</text>
            <text x={point.x} y={point.y+14} textAnchor={anchor} style={{ fontSize:11, fontWeight:900, fill:'#668374' }}>P{Math.round(metric?.[percentileKey] || 0)}</text>
          </g>
        })}
      </svg>
      <div style={{ display:'flex', justifyContent:'center', gap:12, flexWrap:'wrap', marginTop:-4 }}>
        {BANDS.map(b => <span key={b.to} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:9, color:'#688174' }}><span style={{ width:8, height:8, borderRadius:2, background:b.color }} />P{b.from}–{b.to}</span>)}
      </div>
    </div>
  )
}
