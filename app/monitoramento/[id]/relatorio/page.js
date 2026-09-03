'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams } from 'next/navigation'

const BRAND_PRIMARY  = '#0a66b7'
const BRAND_DARK = '#064b82'
const BLUE = '#1565c0'
const AMB  = '#b45309'
const RED  = '#c62828'
const TEAL = '#00796b'

const safeNum = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n }
const pct     = (a, b) => b > 0 ? Math.round((safeNum(a) / safeNum(b)) * 100) : 0
const p90     = (v, m) => m > 0 ? Math.round((safeNum(v) / safeNum(m)) * 90 * 100) / 100 : 0
const norm    = (v, max) => max > 0 ? Math.min(100, Math.round((safeNum(v) / safeNum(max)) * 100)) : 0
const fmt1    = (v) => safeNum(v).toFixed(1)
const fmt2    = (v) => safeNum(v).toFixed(2)

const calcIdade = (d) => {
  if (!d) return null
  const p = new Date(d.includes('T') ? d : d + 'T12:00:00')
  if (isNaN(p.getTime())) return null
  return Math.floor((Date.now() - p.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}
const fmtNasc = (d) => {
  if (!d) return null
  const p = new Date(d.includes('T') ? d : d + 'T12:00:00')
  if (isNaN(p.getTime())) return null
  return p.toLocaleDateString('pt-BR')
}

const PAIS_FLAG = {'Brasil':'🇧🇷','Argentina':'🇦🇷','Colômbia':'🇨🇴','Uruguai':'🇺🇾','Chile':'🇨🇱','Paraguai':'🇵🇾','Peru':'🇵🇪','Equador':'🇪🇨','Venezuela':'🇻🇪','Portugal':'🇵🇹','Espanha':'🇪🇸','Itália':'🇮🇹','Alemanha':'🇩🇪','França':'🇫🇷','Inglaterra':'🇬🇧'}
const getFlag = (p) => p ? (PAIS_FLAG[p] || '🌐') : ''

function aggregate(metricas) {
  if (!metricas?.length) return null
  const T = { jogos:0,minutos:0,gols:0,assists:0,xg:0,xa:0,remates_totais:0,remates_baliza:0,passes_totais:0,passes_certos:0,passes_longos:0,passes_longos_certos:0,cruzamentos:0,cruzamentos_certos:0,dribbles:0,dribbles_ok:0,duelos:0,duelos_ganhos:0,duelos_aereos:0,duelos_aereos_ganhos:0,duelos_def:0,duelos_def_ganhos:0,duelos_off:0,duelos_off_ganhos:0,carrinhos:0,carrinhos_ok:0,intercepcoes:0,recuperacoes:0,perdas_proprio:0,toques_area:0,faltas_sofridas:0,faltas:0,passes_prof:0,passes_prof_certos:0,passes_terco:0,passes_terco_certos:0,passes_area:0,passes_area_certos:0,assist_remate:0,corridas:0,alivios:0,segundas_assist:0,amarelo2:0,vermelho2:0 }
  metricas.forEach(g => { T.jogos++; Object.keys(T).forEach(k => { if (k !== 'jogos') T[k] += safeNum(g[k]) }) })
  return T
}

function posGroup(pos) {
  const p = (pos || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  if (p.includes('goleiro') || /\bgk\b/.test(p))           return 'GK'
  if (p.includes('zagueiro') || /\bcb\b/.test(p))          return 'CB'
  if (p.includes('lateral') || /\b[lr]b\b/.test(p))        return 'LAT'
  if (p.includes('volante') || /\b(dm|cdm)\b/.test(p))     return 'VOL'
  if (p.includes('meia atacante')||p.includes('meia ofensivo')||/\bcam\b/.test(p)) return 'MAT'
  if (p.includes('meia') || /\bcm\b/.test(p))              return 'MEI'
  if (p.includes('ponta')||p.includes('extremo')||/\b[lr]w\b/.test(p)) return 'PON'
  if (p.includes('centroavante')||p.includes('atacante')||/\b(cf|st)\b/.test(p)) return 'CA'
  return 'MEI'
}
function posGroupWyscout(pos) {
  const p = (pos||'').toUpperCase()
  if (/\bGK\b/.test(p)) return 'GK'
  if (/\b(LCB|RCB|CB)\b/.test(p)) return 'CB'
  if (/\b(LB|RB|LWB|RWB)\b/.test(p)) return 'LAT'
  if (/\b(DMF|LDMF|RDMF)\b/.test(p)) return 'VOL'
  if (/\b(CMF|LCMF|RCMF)\b/.test(p)) return 'MEI'
  if (/\b(AMF|LAMF|RAMF)\b/.test(p)) return 'MAT'
  if (/\b(LW|RW|LWF|RWF)\b/.test(p)) return 'PON'
  if (/\b(CF|SS)\b/.test(p)) return 'CA'
  return 'MEI'
}

function getMetricsByPos(pg, T, m) {
  if (!T) return []
  const defs = {
    CB:  [{l:'Duelos def.%',v:pct(T.duelos_def_ganhos,T.duelos_def)},{l:'Aéreos g.%',v:pct(T.duelos_aereos_ganhos,T.duelos_aereos)},{l:'Intercep/90',v:norm(p90(T.intercepcoes,m),5)},{l:'Carrinhos%',v:pct(T.carrinhos_ok,T.carrinhos)},{l:'Alívios/90',v:norm(p90(T.alivios,m),3)},{l:'P.Frente%',v:pct(T.passes_prof_certos,T.passes_prof)},{l:'P.Longos%',v:pct(T.passes_longos_certos,T.passes_longos)},{l:'Perdas inv%',v:Math.max(0,100-norm(p90(T.perdas_proprio,m),5))}],
    LAT: [{l:'Cruzamentos%',v:pct(T.cruzamentos_certos,T.cruzamentos)},{l:'P.Terço%',v:pct(T.passes_terco_certos,T.passes_terco)},{l:'A.remate/90',v:norm(p90(T.assist_remate,m),2)},{l:'Dribles%',v:pct(T.dribbles_ok,T.dribbles)},{l:'Duelos def.%',v:pct(T.duelos_def_ganhos,T.duelos_def)},{l:'Recuper/90',v:norm(p90(T.recuperacoes,m),6)},{l:'Corridas/90',v:norm(p90(T.corridas,m),8)},{l:'P.Prof%',v:pct(T.passes_prof_certos,T.passes_prof)}],
    VOL: [{l:'Intercep/90',v:norm(p90(T.intercepcoes,m),5)},{l:'Recuper/90',v:norm(p90(T.recuperacoes,m),6)},{l:'Passes%',v:pct(T.passes_certos,T.passes_totais)},{l:'P.Frente%',v:pct(T.passes_prof_certos,T.passes_prof)},{l:'P.Longos%',v:pct(T.passes_longos_certos,T.passes_longos)},{l:'Duelos def.%',v:pct(T.duelos_def_ganhos,T.duelos_def)},{l:'Perdas inv%',v:Math.max(0,100-norm(p90(T.perdas_proprio,m),5))},{l:'A.remate/90',v:norm(p90(T.assist_remate,m),2)}],
    MEI: [{l:'P.Terço/90',v:norm(p90(T.passes_terco,m),8)},{l:'A.remate/90',v:norm(p90(T.assist_remate,m),2)},{l:'xA/90',v:norm(p90(T.xa,m),0.4)},{l:'P.Prof%',v:pct(T.passes_prof_certos,T.passes_prof)},{l:'P.Frente%',v:pct(T.passes_terco_certos,T.passes_terco)},{l:'Dribles%',v:pct(T.dribbles_ok,T.dribbles)},{l:'Passes/90',v:norm(p90(T.passes_totais,m),70)},{l:'2as Assist/90',v:norm(p90(T.segundas_assist,m),1)}],
    MAT: [{l:'xA/90',v:norm(p90(T.xa,m),0.4)},{l:'Assists/90',v:norm(p90(T.assists,m),0.4)},{l:'A.remate/90',v:norm(p90(T.assist_remate,m),2)},{l:'Dribles%',v:pct(T.dribbles_ok,T.dribbles)},{l:'Toques área/90',v:norm(p90(T.toques_area,m),5)},{l:'Remates bal.%',v:pct(T.remates_baliza,T.remates_totais)},{l:'P.Área%',v:pct(T.passes_area_certos,T.passes_area)},{l:'P.Prof%',v:pct(T.passes_prof_certos,T.passes_prof)}],
    PON: [{l:'Dribles%',v:pct(T.dribbles_ok,T.dribbles)},{l:'Gols/90',v:norm(p90(T.gols,m),0.7)},{l:'Assists/90',v:norm(p90(T.assists,m),0.3)},{l:'Toques área/90',v:norm(p90(T.toques_area,m),5)},{l:'Remates bal.%',v:pct(T.remates_baliza,T.remates_totais)},{l:'xG/90',v:norm(p90(T.xg,m),0.5)},{l:'Corridas/90',v:norm(p90(T.corridas,m),8)},{l:'Cruzamentos%',v:pct(T.cruzamentos_certos,T.cruzamentos)}],
    CA:  [{l:'Gols/90',v:norm(p90(T.gols,m),0.7)},{l:'xG/90',v:norm(p90(T.xg,m),0.7)},{l:'Remates bal.%',v:pct(T.remates_baliza,T.remates_totais)},{l:'Toques área/90',v:norm(p90(T.toques_area,m),6)},{l:'Duelos of.%',v:pct(T.duelos_off_ganhos,T.duelos_off)},{l:'Aéreos%',v:pct(T.duelos_aereos_ganhos,T.duelos_aereos)},{l:'Passes rec/90',v:norm(p90(T.passes_prof,m),5)},{l:'Assists/90',v:norm(p90(T.assists,m),0.3)}],
  }
  return (defs[pg]||defs.MEI).map(m2=>({...m2,v:Math.max(0,Math.min(100,m2.v||0))}))
}

function avgMetric(players, key) {
  const vals = players.map(p=>p[key]).filter(v=>v!==null&&!isNaN(v)&&v>0)
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null
}

function calcComparisons(pg, T, m, gP, sP) {
  const gPos = gP.filter(p=>posGroupWyscout(p.posicao)===pg)
  const sPos = sP.filter(p=>posGroupWyscout(p.posicao)===pg)
  const a = (key) => {
    if (!T||!m) return null
    const map = {
      'duelos_def_pct': pct(T.duelos_def_ganhos,T.duelos_def),
      'duelos_aereos_pct': pct(T.duelos_aereos_ganhos,T.duelos_aereos),
      'intercepoes_90': p90(T.intercepcoes,m),
      'carrinhos_pct': pct(T.carrinhos_ok,T.carrinhos),
      'alivios_90': p90(T.alivios,m),
      'passes_prof_pct': pct(T.passes_prof_certos,T.passes_prof),
      'passes_longos_pct': pct(T.passes_longos_certos,T.passes_longos),
      'perdas_inv': Math.max(0,100-Math.min(100,m>0?Math.round((safeNum(T.perdas_proprio)/m)*90/5*100):0)),
      'cruzamentos_pct': pct(T.cruzamentos_certos,T.cruzamentos),
      'passes_terco_pct': pct(T.passes_terco_certos,T.passes_terco),
      'assist_remate_90': p90(T.assist_remate,m),
      'dribles_pct': pct(T.dribbles_ok,T.dribbles),
      'recuperacoes_90': p90(T.recuperacoes,m),
      'corridas_90': p90(T.corridas,m),
      'passes_pct': pct(T.passes_certos,T.passes_totais),
      'xa_90': p90(T.xa,m),
      'passes_area_pct': pct(T.passes_area_certos,T.passes_area),
      'toques_area_90': p90(T.toques_area,m),
      'remates_baliza_pct': pct(T.remates_baliza,T.remates_totais),
      'gols_90': p90(T.gols,m),
      'assists_90': p90(T.assists,m),
      'xg_90': p90(T.xg,m),
      'duelos_off_pct': pct(T.duelos_off_ganhos,T.duelos_off),
      'passes_rec_90': p90(T.passes_prof,m),
      'passes_90': p90(T.passes_totais,m),
      'segundas_90': p90(T.segundas_assist,m),
    }
    return map[key]??null
  }
  const row = (label, key) => ({ label, atletaV: a(key), clubV: gPos.length?avgMetric(gPos,key):null, serieCv: sPos.length?avgMetric(sPos,key):null })
  const byPos = {
    CB:  [row('Duelos def.%','duelos_def_pct'),row('Aéreos g.%','duelos_aereos_pct'),row('Intercep/90','intercepoes_90'),row('Carrinhos%','carrinhos_pct'),row('Alívios/90','alivios_90'),row('P.Frente%','passes_prof_pct'),row('P.Longos%','passes_longos_pct'),row('Perdas inv%','perdas_inv')],
    LAT: [row('Cruzamentos%','cruzamentos_pct'),row('P.Terço%','passes_terco_pct'),row('A.Remate/90','assist_remate_90'),row('Dribles%','dribles_pct'),row('Duelos def.%','duelos_def_pct'),row('Recuper/90','recuperacoes_90'),row('Corridas/90','corridas_90'),row('P.Profund%','passes_prof_pct')],
    VOL: [row('Intercep/90','intercepoes_90'),row('Recuper/90','recuperacoes_90'),row('Passes%','passes_pct'),row('P.Frente%','passes_prof_pct'),row('P.Longos%','passes_longos_pct'),row('Duelos def.%','duelos_def_pct'),row('Perdas inv%','perdas_inv'),row('A.Remate/90','assist_remate_90')],
    MEI: [row('P.Terço%','passes_terco_pct'),row('A.Remate/90','assist_remate_90'),row('xA/90','xa_90'),row('P.Prof%','passes_prof_pct'),row('P.Frente%','passes_terco_pct'),row('Dribles%','dribles_pct'),row('Passes/90','passes_90'),row('2as Assist/90','segundas_90')],
    MAT: [row('xA/90','xa_90'),row('Assists/90','assists_90'),row('A.Remate/90','assist_remate_90'),row('Dribles%','dribles_pct'),row('Toques área/90','toques_area_90'),row('Remates bal.%','remates_baliza_pct'),row('P.Área%','passes_area_pct'),row('P.Prof%','passes_prof_pct')],
    PON: [row('Dribles%','dribles_pct'),row('Gols/90','gols_90'),row('Assists/90','assists_90'),row('Toques área/90','toques_area_90'),row('Remates bal.%','remates_baliza_pct'),row('xG/90','xg_90'),row('Corridas/90','corridas_90'),row('Cruzamentos%','cruzamentos_pct')],
    CA:  [row('Gols/90','gols_90'),row('xG/90','xg_90'),row('Remates bal.%','remates_baliza_pct'),row('Toques área/90','toques_area_90'),row('Duelos of.%','duelos_off_pct'),row('Aéreos%','duelos_aereos_pct'),row('Passes rec/90','passes_rec_90'),row('Assists/90','assists_90')],
  }
  return (byPos[pg]||byPos.MEI)
}

function calcFortesFracos(rows) {
  const valid = rows.filter(r=>r.atletaV!==null&&r.serieCv!==null&&r.serieCv>0)
    .map(r=>({...r,diff:((r.atletaV-r.serieCv)/r.serieCv)*100}))
    .sort((a,b)=>b.diff-a.diff)
  return { fortes: valid.filter(r=>r.diff>0).slice(0,4), fracos: valid.filter(r=>r.diff<0).sort((a,b)=>a.diff-b.diff).slice(0,4) }
}

function PizzaPlot({ title, data, color, size = 170 }) {
  const cx=size/2, cy=size/2, r=size*0.33, n=data.length, sa=(2*Math.PI)/n, bg='#1a2e1a', track='#243c24'
  const slices = data.map((d,i) => {
    const s=i*sa-Math.PI/2, e=s+sa, v=Math.max(0,Math.min(100,d.v||0)), rs=(v/100)*r, g=0.06
    const tx1=cx+r*Math.cos(s+g),ty1=cy+r*Math.sin(s+g),tx2=cx+r*Math.cos(e-g),ty2=cy+r*Math.sin(e-g)
    const vx1=cx+rs*Math.cos(s+g),vy1=cy+rs*Math.sin(s+g),vx2=cx+rs*Math.cos(e-g),vy2=cy+rs*Math.sin(e-g)
    const mid=s+sa/2, lx=cx+(r+16)*Math.cos(mid), ly=cy+(r+16)*Math.sin(mid)
    const anchor=lx<cx-3?'end':lx>cx+3?'start':'middle'
    const pc=v>=80?'#16a34a':v>=60?color:v>=40?'#d97706':'#dc2626'
    return {tx1,ty1,tx2,ty2,vx1,vy1,vx2,vy2,rs,lx,ly,anchor,v,pc,l:d.label||d.l||d.m}
  })
  return (
    <div style={{background:bg,borderRadius:10,padding:'8px 5px'}}>
      <div style={{fontSize:7,fontWeight:800,color:'#86efac',textTransform:'uppercase',letterSpacing:'0.06em',textAlign:'center',marginBottom:3}}>{title}</div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{display:'block'}}>
        {[25,50,75,100].map(p=><circle key={p} cx={cx} cy={cy} r={(p/100)*r} fill="none" stroke={p===100?'#3a5a3a':'#2a4a2a'} strokeWidth={p===100?0.8:0.4} strokeDasharray={p<100?'2 2':undefined}/>)}
        <circle cx={cx} cy={cy} r={2.5} fill={color}/>
        {slices.map((s,i)=>(
          <g key={i}>
            <path d={`M ${cx} ${cy} L ${s.tx1.toFixed(1)} ${s.ty1.toFixed(1)} A ${r} ${r} 0 0 1 ${s.tx2.toFixed(1)} ${s.ty2.toFixed(1)} Z`} fill={track} stroke={bg} strokeWidth={1}/>
            {s.v>0&&<path d={`M ${cx} ${cy} L ${s.vx1.toFixed(1)} ${s.vy1.toFixed(1)} A ${s.rs.toFixed(1)} ${s.rs.toFixed(1)} 0 0 1 ${s.vx2.toFixed(1)} ${s.vy2.toFixed(1)} Z`} fill={s.pc} stroke={bg} strokeWidth={0.8} opacity={0.9}/>}
            <text x={s.lx.toFixed(1)} y={(s.ly-2.5).toFixed(1)} textAnchor={s.anchor} fontSize={4} fill="#86b096" fontFamily="inherit" fontWeight="700">{s.l}</text>
            <text x={s.lx.toFixed(1)} y={(s.ly+4.5).toFixed(1)} textAnchor={s.anchor} fontSize={5.5} fill={s.pc} fontFamily="inherit" fontWeight="900">{s.v}%</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function CompBar({ label, atletaV, clubV, serieCv }) {
  const max=Math.max(atletaV||0,clubV||0,serieCv||0,0.001)
  const fmt=(v)=>v==null?'—':(typeof v==='number'?(v%1===0?v:v.toFixed(1)):v)
  return (
    <div style={{marginBottom:6}}>
      <div style={{fontSize:7,fontWeight:700,color:'#334155',marginBottom:2}}>{label}</div>
      {[{l:'Atleta',val:atletaV,color:BRAND_PRIMARY},{l:'Confiança',val:clubV,color:BLUE},{l:'Série C',val:serieCv,color:AMB}].map(row=>(
        <div key={row.l} style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
          <span style={{fontSize:6,fontWeight:700,color:row.color,width:34,flexShrink:0}}>{row.l}</span>
          <div style={{flex:1,height:5,background:'#f1f5f9',borderRadius:99,overflow:'hidden'}}>
            <div style={{width:`${Math.min(100,Math.round(((row.val||0)/max)*100))}%`,height:'100%',background:row.color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:6.5,fontWeight:800,color:row.color,width:26,textAlign:'right',flexShrink:0}}>{fmt(row.val)}</span>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, color=BRAND_PRIMARY, dark=false }) {
  return (
    <div style={{background:dark?'#1a2e1a':'#f0fdf4',borderRadius:8,padding:'6px 8px',textAlign:'center',border:`1px solid ${dark?'#2a4a2a':'#bbf7d0'}`}}>
      <div style={{fontSize:7,color:dark?'#86efac':'#64748b',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>{label}</div>
      <div style={{fontSize:15,fontWeight:900,color:dark?'#fff':color,lineHeight:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{value??'—'}</div>
    </div>
  )
}
function StatRow({ label, value, pctVal }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 0',borderBottom:'1px solid #f4f8fc'}}>
      <span style={{fontSize:7.5,color:'#64748b',flex:1}}>{label}</span>
      <span style={{fontSize:8.5,fontWeight:800,color:BRAND_PRIMARY,minWidth:36,textAlign:'right'}}>{value??'—'}</span>
      {pctVal!=null&&<div style={{width:40,height:4,background:'#f4f8fc',borderRadius:99,overflow:'hidden',flexShrink:0}}><div style={{width:`${Math.min(100,pctVal)}%`,height:'100%',background:pctVal>=70?BRAND_PRIMARY:pctVal>=50?TEAL:AMB,borderRadius:99}}/></div>}
    </div>
  )
}
function IrcBadge({ irc, label }) {
  if (!irc) return null
  const v=parseFloat(irc), c=v>=4?BRAND_PRIMARY:v>=3?TEAL:v>=2?AMB:RED
  return (
    <div style={{display:'inline-flex',flexDirection:'column',alignItems:'center',background:c+'18',border:`1.5px solid ${c}`,borderRadius:10,padding:'7px 12px',minWidth:56}}>
      <div style={{fontSize:20,fontWeight:900,color:c,lineHeight:1}}>{v.toFixed(1)}</div>
      <div style={{fontSize:7,fontWeight:800,color:c,marginTop:2}}>IRC</div>
      {label&&<div style={{fontSize:6,color:'#64748b',marginTop:2,textAlign:'center'}}>{label}</div>}
    </div>
  )
}
function Shield({ opacity=0.04, size=180 }) {
  return (
    <div style={{position:'absolute',bottom:36,left:'50%',transform:'translateX(-50%)',opacity,pointerEvents:'none',zIndex:0}}>
      <img src="/confianca.png" alt="" style={{width:size,height:'auto',filter:'grayscale(100%)'}}/>
    </div>
  )
}

function PrintContent() {
  const params = useParams()
  const id = params?.id
  const [atleta,setAtleta]=useState(null)
  const [loading,setLoading]=useState(true)
  const [lfRec,setLfRec]=useState(null)
  const [clubData,setClubData]=useState([])
  const [serieCData,setSerieCData]=useState([])

  useEffect(()=>{
    if(!id) return
    Promise.allSettled([
      fetch(`/api/monitoramento?id=${id}`).then(r=>r.json()),
      fetch('/api/lista-final').then(r=>r.json()),
      fetch('/api/wyscout-benchmark?tipo=club').then(r=>r.json()).catch(()=>({players:[]})),
      fetch('/api/wyscout-benchmark?tipo=serie_c').then(r=>r.json()).catch(()=>({players:[]})),
    ]).then(([atl,lf,g,s])=>{
      const a=atl.status==='fulfilled'?atl.value:null
      setAtleta(a)
      setClubData(g.status==='fulfilled'?(g.value.players||[]):[])
      setSerieCData(s.status==='fulfilled'?(s.value.players||[]):[])
      if(lf.status==='fulfilled'&&a){
        const pl=lf.value?.players||[]
        const nome=(a.apelido||a.nome||'').toLowerCase().trim()
        const match=pl.find(p=>{const pn=(p.jogador||'').toLowerCase().trim();return pn===nome||nome.includes(pn.split(' ')[0])||pn.includes(nome.split(' ')[0])})
        setLfRec(match||null)
      }
      setLoading(false)
    })
  },[id])

  const T=useMemo(()=>aggregate(atleta?.metricas_json||[]),[atleta])
  const m=T?.minutos||0
  const pg=posGroup(atleta?.posicao||'')
  const idade=calcIdade(atleta?.data_nascimento)
  const gerado=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})
  const posMetrics=useMemo(()=>getMetricsByPos(pg,T,m),[pg,T,m])
  const compRows=useMemo(()=>calcComparisons(pg,T,m,clubData,serieCData),[pg,T,m,clubData,serieCData])
  const {fortes,fracos}=useMemo(()=>calcFortesFracos(compRows),[compRows])
  const hasComp=clubData.length>0||serieCData.length>0

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'Inter,sans-serif',color:'#94a3b8',fontSize:14,fontWeight:700,textTransform:'uppercase'}}>Preparando relatório...</div>
  if(!atleta||atleta.error) return <div style={{padding:40,fontFamily:'sans-serif',color:RED}}>Atleta não encontrado.</div>

  const stripe={position:'absolute',top:0,left:0,right:0,height:5,background:`linear-gradient(90deg,${BRAND_PRIMARY} 0%,#22c55e 55%,#1e293b 100%)`}
  const page={width:794,background:'white',padding:'24px 28px',position:'relative',fontFamily:"'Inter',sans-serif",color:'#10233b'}
  const NIVEL_C={'Monitorando':BRAND_PRIMARY,'Interesse':BLUE,'Proposta':AMB,'Descartado':RED}
  const nColor=NIVEL_C[atleta.nivel_interesse]||BRAND_PRIMARY

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Inter',sans-serif;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@media print{@page{size:A4 portrait;margin:0;}html,body{width:210mm;}.no-print{display:none!important;}.pg{page-break-before:always;}}@media screen{body{background:#334155;padding-bottom:48px;}.a4{box-shadow:0 8px 40px rgba(0,0,0,.3);margin:32px auto;}}`}</style>
      <div className="no-print" style={{position:'fixed',top:16,right:16,zIndex:9999,display:'flex',gap:8}}>
        <button onClick={()=>window.print()} style={{background:BRAND_PRIMARY,color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontWeight:900,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>🖨️ Salvar PDF</button>
        <button onClick={()=>window.close()} style={{background:'#1e293b',color:'#fff',border:'none',borderRadius:8,padding:'10px 16px',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>✕ Fechar</button>
      </div>

      {/* ════════════ PÁG 1 ════════════════════════════════════════ */}
      <div className="a4" style={{...page,minHeight:1123}}>
        <div style={stripe}/>
        <Shield opacity={0.035} size={190}/>

        {/* Header */}
        <div style={{background:BRAND_DARK,borderRadius:12,padding:'14px 18px',marginBottom:12,display:'flex',alignItems:'center',gap:14,position:'relative',zIndex:1}}>
          {atleta.foto_url&&<img src={atleta.foto_url} style={{width:54,height:54,borderRadius:'50%',objectFit:'cover',border:'2px solid #22c55e',flexShrink:0}}/>}
          <div style={{flex:1}}>
            <div style={{fontSize:7,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)',marginBottom:2}}>Confiança · Central de Inteligência · Monitoramento</div>
            <div style={{fontSize:23,fontWeight:900,color:'white',lineHeight:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{atleta.apelido||atleta.nome}</div>
            {atleta.apelido&&<div style={{fontSize:8.5,color:'rgba(255,255,255,0.4)',marginTop:2}}>{atleta.nome}</div>}
            <div style={{fontSize:10,color:'#86efac',marginTop:3}}>{[atleta.posicao,atleta.time_atual,atleta.liga].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontSize:8.5,color:'rgba(255,255,255,0.5)',marginBottom:5}}>Gerado em {gerado}</div>
            <div style={{display:'inline-flex',alignItems:'center',gap:5,background:`${nColor}22`,border:`1px solid ${nColor}`,borderRadius:8,padding:'3px 9px'}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:nColor}}/><span style={{fontSize:8.5,fontWeight:800,color:nColor}}>{atleta.nivel_interesse}</span>
            </div>
            {lfRec&&<div style={{marginTop:5}}><IrcBadge irc={lfRec.irc_final} label={lfRec.recomendacao}/></div>}
          </div>
        </div>

        {/* Bio + KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'185px 1fr',gap:10,marginBottom:10,position:'relative',zIndex:1}}>
          <div style={{background:'#f7fcf9',borderRadius:10,border:'1px solid #e5edf5',padding:'11px 13px'}}>
            {[['Idade',idade?`${idade} anos`:null],['Nascimento',fmtNasc(atleta.data_nascimento)],['Nacionalidade',atleta.nacionalidade?`${getFlag(atleta.nacionalidade)} ${atleta.nacionalidade}`:null],['Pé',atleta.pe_preferido],['Altura',atleta.altura?`${atleta.altura}m`:null],['Clube',atleta.time_atual],['Liga',atleta.liga],['Contrato até',atleta.data_contrato_fim],['Valor',atleta.valor_mercado]].filter(([,v])=>v).map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'3.5px 0',borderBottom:'1px solid #eaf4fd'}}>
                <span style={{fontSize:7.5,color:'#64748b'}}>{l}</span>
                <span style={{fontSize:7.5,fontWeight:700,color:'#10233b',textAlign:'right',maxWidth:100}}>{v}</span>
              </div>
            ))}
            {lfRec&&<div style={{marginTop:7,paddingTop:7,borderTop:'1px solid #e5edf5'}}><div style={{fontSize:7,fontWeight:800,color:'#64748b',textTransform:'uppercase',marginBottom:3}}>Lista Final CIC</div><IrcBadge irc={lfRec.irc_final} label={lfRec.irc_classificacao}/>{lfRec.recomendacao&&<div style={{fontSize:8,fontWeight:800,color:BRAND_PRIMARY,marginTop:3}}>{lfRec.recomendacao}</div>}</div>}
          </div>
          {T?(
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:5}}>
                {[{l:'Jogos',v:T.jogos,c:'#10233b'},{l:'Minutos',v:T.minutos,c:'#10233b'},{l:'Gols',v:T.gols,c:BRAND_PRIMARY},{l:'Assists',v:T.assists,c:BRAND_PRIMARY},{l:'xG',v:fmt1(T.xg),c:TEAL},{l:'xA',v:fmt1(T.xa),c:TEAL},{l:'🟨',v:T.amarelo2,c:AMB},{l:'🟥',v:T.vermelho2,c:RED}].map(({l,v,c})=><Kpi key={l} label={l} value={v} color={c}/>)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:5}}>
                {[{l:'Gols/90',v:fmt2(p90(T.gols,m))},{l:'Assists/90',v:fmt2(p90(T.assists,m))},{l:'xG/90',v:fmt2(p90(T.xg,m))},{l:'xA/90',v:fmt2(p90(T.xa,m))},{l:'Remates/90',v:fmt1(p90(T.remates_totais,m))},{l:'Dribles/90',v:fmt1(p90(T.dribbles,m))}].map(({l,v})=><Kpi key={l} label={l} value={v} dark/>)}
              </div>
              {atleta.observacoes&&<div style={{background:'#f7fcf9',borderRadius:8,border:'1px solid #e5edf5',padding:'7px 10px'}}><div style={{fontSize:7,fontWeight:800,color:'#64748b',textTransform:'uppercase',marginBottom:2}}>Observações CIC</div><p style={{fontSize:8.5,color:'#10233b',lineHeight:1.5}}>{atleta.observacoes}</p></div>}
            </div>
          ):<div style={{background:'#f7fcf9',borderRadius:10,border:'1px solid #e5edf5',padding:20,textAlign:'center',color:'#94a3b8',fontSize:11}}>Nenhum dado Wyscout carregado</div>}
        </div>

        {/* Pizzas 2 grandes por posição */}
        {T&&(
          <div style={{marginBottom:10,position:'relative',zIndex:1}}>
            <div style={{fontSize:7.5,fontWeight:900,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>
              Percentile Charts — Métricas-chave · {atleta.posicao||'Posição'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              <PizzaPlot title={`${atleta.posicao||'Posição'} — Métricas 1 a 4`} data={posMetrics.slice(0,4)} color={BRAND_PRIMARY}/>
              <PizzaPlot title={`${atleta.posicao||'Posição'} — Métricas 5 a 8`} data={posMetrics.slice(4,8)} color={AMB}/>
            </div>
            <div style={{display:'flex',gap:12,marginTop:5,justifyContent:'center'}}>
              {[['≥80%','#16a34a','Elite'],['60–79%',BRAND_PRIMARY,'Acima da média'],['40–59%','#d97706','Na média'],['<40%','#dc2626','Abaixo']].map(([r,c,l])=>(
                <div key={r} style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{width:7,height:7,borderRadius:2,background:c}}/><span style={{fontSize:6.5,color:'#64748b'}}><strong style={{color:c}}>{r}</strong> {l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comparação barras */}
        {T&&(
          <div style={{background:'#f7fcf9',borderRadius:12,border:'1px solid #e5edf5',padding:'10px 12px',marginBottom:8,position:'relative',zIndex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{fontSize:7.5,fontWeight:900,color:'#10233b',textTransform:'uppercase',letterSpacing:'0.07em'}}>📊 Comparação por posição — Atleta · Confiança · Série C</div>
              <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
                {[['Atleta',BRAND_PRIMARY],['Confiança',BLUE],['Série C',AMB]].map(([l,c])=><div key={l} style={{display:'flex',alignItems:'center',gap:3}}><div style={{width:7,height:7,borderRadius:2,background:c}}/><span style={{fontSize:6.5,color:'#64748b',fontWeight:700}}>{l}</span></div>)}
              </div>
              {!hasComp&&<span style={{fontSize:7.5,color:'#94a3b8',fontStyle:'italic'}}>Carregue os Excel de benchmark para ver comparação</span>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 18px'}}>
              {compRows.map((row,i)=><CompBar key={i} label={row.label} atletaV={row.atletaV} clubV={row.clubV} serieCv={row.serieCv}/>)}
            </div>
          </div>
        )}

        {/* Escudo rodapé */}
        <div style={{display:'flex',justifyContent:'center',marginBottom:3}}><img src="/confianca.png" alt="" style={{height:18,width:'auto',opacity:0.25}}/></div>
        <div style={{paddingTop:4,borderTop:'1px solid #e5edf5',display:'flex',justifyContent:'space-between',position:'relative',zIndex:1}}>
          <span style={{fontSize:7,color:'#94a3b8'}}>CIC · Confiança · {gerado} · Confidencial</span>
          <span style={{fontSize:7,color:'#94a3b8'}}>1 / 2</span>
        </div>
      </div>

      {/* ════════════ PÁG 2 ════════════════════════════════════════ */}
      {T&&(
        <div className="a4 pg" style={{...page,minHeight:1123}}>
          <div style={stripe}/>
          <Shield opacity={0.035} size={190}/>

          {/* Mini header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,paddingBottom:8,borderBottom:'2px solid #e5edf5',position:'relative',zIndex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <img src="/confianca.png" alt="" style={{height:30,width:'auto'}}/>
              <div>
                <div style={{fontSize:7,fontWeight:900,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em'}}>CIC · Monitoramento · Pág. 2</div>
                <div style={{fontSize:15,fontWeight:900,color:'#10233b',fontFamily:"'Barlow Condensed',sans-serif"}}>{atleta.apelido||atleta.nome} — Estatísticas Detalhadas</div>
                <div style={{fontSize:8.5,color:'#64748b'}}>{atleta.posicao} · {atleta.time_atual}</div>
              </div>
            </div>
            <div style={{fontSize:8.5,color:'#94a3b8',textAlign:'right'}}>{T.jogos} jogos · {T.minutos} min</div>
          </div>

          {/* Pontos Fortes e a Melhorar */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10,position:'relative',zIndex:1}}>
            <div style={{background:'#f0fdf4',borderRadius:10,border:'1px solid #bbf7d0',padding:'11px 13px'}}>
              <div style={{fontSize:8,fontWeight:900,color:BRAND_PRIMARY,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>✅ 4 Pontos Fortes vs Série C</div>
              {fortes.length===0?(
                <div style={{fontSize:9,color:'#94a3b8',fontStyle:'italic'}}>{hasComp?'Dados insuficientes':'Carregue os dados de benchmark'}</div>
              ):fortes.map((f,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
                  <div style={{width:20,height:20,borderRadius:'50%',background:BRAND_PRIMARY,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:9,fontWeight:900,color:'white'}}>{i+1}</span></div>
                  <div style={{flex:1}}><div style={{fontSize:9,fontWeight:700,color:'#166534'}}>{f.label}</div><div style={{fontSize:7.5,color:'#52677e'}}>{f.atletaV?.toFixed(1)} vs {f.serieCv?.toFixed(1)} médio <span style={{marginLeft:4,color:BRAND_PRIMARY,fontWeight:800}}>+{Math.round(f.diff)}%</span></div></div>
                </div>
              ))}
            </div>
            <div style={{background:'#fff5f5',borderRadius:10,border:'1px solid #fecaca',padding:'11px 13px'}}>
              <div style={{fontSize:8,fontWeight:900,color:RED,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>🎯 4 Pontos a Melhorar</div>
              {fracos.length===0?(
                <div style={{fontSize:9,color:'#94a3b8',fontStyle:'italic'}}>{hasComp?'Dados insuficientes':'Carregue os dados de benchmark'}</div>
              ):fracos.map((f,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
                  <div style={{width:20,height:20,borderRadius:'50%',background:RED,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:9,fontWeight:900,color:'white'}}>{i+1}</span></div>
                  <div style={{flex:1}}><div style={{fontSize:9,fontWeight:700,color:'#991b1b'}}>{f.label}</div><div style={{fontSize:7.5,color:'#7f1d1d'}}>{f.atletaV?.toFixed(1)} vs {f.serieCv?.toFixed(1)} médio <span style={{marginLeft:4,color:RED,fontWeight:800}}>{Math.round(f.diff)}%</span></div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela stats */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,position:'relative',zIndex:1}}>
            <div style={{background:'#f7fcf9',borderRadius:10,border:'1px solid #e5edf5',padding:'11px 13px'}}>
              <div style={{fontSize:8,fontWeight:900,color:BRAND_PRIMARY,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7}}>⚽ Ataque</div>
              <StatRow label="Gols" value={T.gols}/><StatRow label="xG" value={fmt2(T.xg)}/><StatRow label="Assistências" value={T.assists}/><StatRow label="xA" value={fmt2(T.xa)}/><StatRow label="Remates totais" value={T.remates_totais}/><StatRow label="Remates bal." value={T.remates_baliza} pctVal={pct(T.remates_baliza,T.remates_totais)}/><StatRow label="Dribbles" value={T.dribbles} pctVal={pct(T.dribbles_ok,T.dribbles)}/><StatRow label="Toques área" value={T.toques_area}/><StatRow label="A.remate" value={T.assist_remate}/><StatRow label="Faltas sof." value={T.faltas_sofridas}/>
              <div style={{marginTop:5,paddingTop:4,borderTop:'1px solid #e5edf5'}}><div style={{fontSize:7,fontWeight:800,color:'#64748b',textTransform:'uppercase',marginBottom:3}}>Por 90 min</div><StatRow label="Gols/90" value={fmt2(p90(T.gols,m))}/><StatRow label="xG/90" value={fmt2(p90(T.xg,m))}/><StatRow label="Assists/90" value={fmt2(p90(T.assists,m))}/><StatRow label="Remates/90" value={fmt1(p90(T.remates_totais,m))}/></div>
            </div>
            <div style={{background:'#eff6ff',borderRadius:10,border:'1px solid #bfdbfe',padding:'11px 13px'}}>
              <div style={{fontSize:8,fontWeight:900,color:BLUE,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7}}>🎯 Passes</div>
              <StatRow label="Passes totais" value={T.passes_totais}/><StatRow label="Passes %" value={`${pct(T.passes_certos,T.passes_totais)}%`} pctVal={pct(T.passes_certos,T.passes_totais)}/><StatRow label="P. Longos" value={T.passes_longos}/><StatRow label="P. Longos %" value={`${pct(T.passes_longos_certos,T.passes_longos)}%`} pctVal={pct(T.passes_longos_certos,T.passes_longos)}/><StatRow label="Cruzamentos" value={T.cruzamentos}/><StatRow label="Cruz. %" value={`${pct(T.cruzamentos_certos,T.cruzamentos)}%`} pctVal={pct(T.cruzamentos_certos,T.cruzamentos)}/><StatRow label="P. Progressivos" value={T.passes_prof}/><StatRow label="P. Terço Final" value={T.passes_terco}/><StatRow label="P. Área Penálti" value={T.passes_area}/>
              <div style={{marginTop:5,paddingTop:4,borderTop:'1px solid #bfdbfe'}}><div style={{fontSize:7,fontWeight:800,color:'#64748b',textTransform:'uppercase',marginBottom:3}}>Por 90 min</div><StatRow label="Passes/90" value={fmt1(p90(T.passes_totais,m))}/><StatRow label="P.Prog/90" value={fmt1(p90(T.passes_prof,m))}/><StatRow label="P.Terço/90" value={fmt1(p90(T.passes_terco,m))}/></div>
            </div>
            <div>
              <div style={{background:'#fffbeb',borderRadius:10,border:'1px solid #fde68a',padding:'11px 13px',marginBottom:7}}>
                <div style={{fontSize:8,fontWeight:900,color:AMB,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7}}>⚔️ Duelos</div>
                <StatRow label="Duelos totais" value={T.duelos}/><StatRow label="Duelos %" value={`${pct(T.duelos_ganhos,T.duelos)}%`} pctVal={pct(T.duelos_ganhos,T.duelos)}/><StatRow label="Duelos aéreos" value={T.duelos_aereos}/><StatRow label="Aéreos %" value={`${pct(T.duelos_aereos_ganhos,T.duelos_aereos)}%`} pctVal={pct(T.duelos_aereos_ganhos,T.duelos_aereos)}/><StatRow label="Duelos def." value={T.duelos_def}/><StatRow label="Duelos def. %" value={`${pct(T.duelos_def_ganhos,T.duelos_def)}%`} pctVal={pct(T.duelos_def_ganhos,T.duelos_def)}/>
              </div>
              <div style={{background:'#f0fdf4',borderRadius:10,border:'1px solid #bbf7d0',padding:'11px 13px'}}>
                <div style={{fontSize:8,fontWeight:900,color:TEAL,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7}}>🛡 Defesa</div>
                <StatRow label="Intercepções" value={T.intercepcoes}/><StatRow label="Recuperações" value={T.recuperacoes}/><StatRow label="Alívios" value={T.alivios}/><StatRow label="Carrinhos" value={T.carrinhos} pctVal={pct(T.carrinhos_ok,T.carrinhos)}/><StatRow label="Perdas próprias" value={T.perdas_proprio}/><StatRow label="🟨 Amarelos" value={T.amarelo2}/><StatRow label="🟥 Vermelhos" value={T.vermelho2}/>
              </div>
            </div>
          </div>

          {/* Lista Final CIC */}
          {lfRec&&(
            <div style={{marginTop:8,background:'#f7fcf9',borderRadius:10,border:'1px solid #e5edf5',padding:'10px 12px',position:'relative',zIndex:1}}>
              <div style={{fontSize:8,fontWeight:900,color:BRAND_PRIMARY,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7}}>📋 Relatório Lista Final CIC</div>
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr',gap:10,alignItems:'start'}}>
                <IrcBadge irc={lfRec.irc_final} label={lfRec.irc_classificacao}/>
                {[['Físico',lfRec.pontos_fisicos],['Técnico',lfRec.pontos_tecnicos],['Tático',lfRec.pontos_taticos]].map(([cat,txt])=>txt?(<div key={cat}><div style={{fontSize:7,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',marginBottom:2}}>{cat}</div><p style={{fontSize:8,color:'#10233b',lineHeight:1.5}}>{txt}</p></div>):<div key={cat}/>)}
              </div>
            </div>
          )}

          {/* Escudo rodapé */}
          <div style={{display:'flex',justifyContent:'center',marginTop:8,marginBottom:3}}><img src="/confianca.png" alt="" style={{height:18,width:'auto',opacity:0.25}}/></div>
          <div style={{paddingTop:4,borderTop:'1px solid #e5edf5',display:'flex',justifyContent:'space-between',position:'relative',zIndex:1}}>
            <span style={{fontSize:7,color:'#94a3b8'}}>CIC · Confiança · {gerado} · Confidencial</span>
            <span style={{fontSize:7,color:'#94a3b8'}}>2 / 2</span>
          </div>
        </div>
      )}
    </>
  )
}

export default function RelatorioAtleta() {
  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'Inter,sans-serif',color:'#94a3b8',fontSize:14,fontWeight:700,textTransform:'uppercase'}}>Preparando relatório...</div>}>
      <PrintContent/>
    </Suspense>
  )
}
