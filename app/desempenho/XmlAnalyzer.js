'use client'
import { useState, useCallback, useRef, useEffect } from 'react'

/* ── Constants ────────────────────────────────────────────────── */
const GFC  = '#0a66b7'
const RED  = '#c62828'
const AMB  = '#b45309'
const GFC2 = '#eaf4fd'
const PURP = '#6a1b9a'

const GUARANI_ROSTER = new Set([
  'Rafael Pascoal','Matheus Emiliano','Cadu','João Fernandes',
  'Ludke','Weriton','Enzo Rocha','Marcelo Nunes','Lucas Cunha','Alisson','Renilson','Matheus Julião','Mandovani','Eduardo Moura','Adryan','Valdir',
  'Ícaro','Gustavo Nicola','Guilherme Nunes','Lorran','Madison','Breyner','Paulo Henrique','Fabrício Oya','Patrick Ferreira','Gabriel Souza','Kelvyn','Iago',
  'Pedro Felipe','Luiz Thiago','Renan','João Pedro','Welder','Wendel','Danielzinho','Maikon Aquino','Sassá',
])

const TEAM_CATEGORIES = {
  offensive: ['Fase ofensiva','Oportunidades de golo','Remate','Cruzamento',
    'Cantos ofensivos','Livres a favor','Livres directos a favor','Golos marcados'],
  defensive: ['Fase defensiva','oportunidades de golo contra','Remates sofridos',
    'Cruzamentos sofridos','Cantos concedidos','Distribuição do guarda-redes',
    'Distribuições do adversário','Livres sofridos','Livres directos contra','Golos sofridos'],
}

const CAT_ICONS = {
  'Fase ofensiva':'⚔️','Oportunidades de golo':'🎯','Remate':'👟','Golos marcados':'⚽',
  'Cruzamento':'📐','Cantos ofensivos':'🚩','Fase defensiva':'🛡️','oportunidades de golo contra':'⚠️',
  'Remates sofridos':'🔴','Cruzamentos sofridos':'🔸','Cantos concedidos':'🏴',
  'Golos sofridos':'💥','Distribuição do guarda-redes':'🧤','Distribuições do adversário':'🔵',
  'Cobrança de lateral a favor':'↗️','Cobrança de lateral contra':'↙️',
  'Livres a favor':'🟡','Livres sofridos':'🟠','Livres directos contra':'🔴',
}

/* ── Drawing constants ────────────────────────────────────────── */
const TOOLS = [
  { id:'select',       icon:'↖',  label:'Mover'           },
  { id:'arrow',        icon:'→',  label:'Seta'            },
  { id:'curved-arrow', icon:'↪',  label:'Seta curva'      },
  { id:'dashed',       icon:'╌→', label:'Seta tracejada'  },
  { id:'cone',         icon:'▽',  label:'Destaque jogador' },
  { id:'circle',       icon:'○',  label:'Círculo'         },
  { id:'rect',         icon:'□',  label:'Retângulo'       },
  { id:'spotlight',    icon:'◎',  label:'Spotlight'       },
  { id:'free',         icon:'✏',  label:'Livre'           },
  { id:'text',         icon:'T',  label:'Texto'           },
]
const DRAW_COLORS = ['#ffffff','#ffeb3b','#ef5350','#66bb6a','#42a5f5','#000000']

/* ── Auto-detect XML type ─────────────────────────────────────── */
function detectXmlType(doc) {
  const codes = Array.from(doc.querySelectorAll('code')).map(c => c.textContent.trim())
  return codes.some(c => /^\(\d+\) .+$/.test(c)) ? 'player' : 'team'
}

/* ── XML Parsing ─────────────────────────────────────────────── */
async function readXml(file) {
  const buf  = await file.arrayBuffer()
  const text = new TextDecoder('utf-16le').decode(buf)
  return new DOMParser().parseFromString(text, 'text/xml')
}
function getOffsets(instances) {
  const off = {}
  instances.forEach(inst => {
    const t = inst.querySelector('label text')?.textContent?.trim() || ''
    const s = parseInt(inst.querySelector('start')?.textContent || '0')
    if (t.includes('Início da primeira parte')) off.h1Start = s
    if (t.includes('Início da segunda parte'))  off.h2Start = s
    if (t.includes('Fim da primeira parte'))    off.h1End   = s
    if (t.includes('Fim da segunda parte'))     off.h2End   = s
  })
  return { h1Start:1, h2Start:3074, h1End:3073, h2End:6435, ...off }
}
function toMinute(secs, off) {
  if (secs < off.h2Start) return Math.max(1, Math.round((secs - off.h1Start) / 60) + 1)
  return Math.round((secs - off.h2Start) / 60) + 46
}
function fmtTs(secs) {
  const abs = Math.abs(secs)
  return `${Math.floor(abs/60)}:${String(abs%60).padStart(2,'0')}`
}
function parseTeamXml(doc) {
  const instances = Array.from(doc.querySelectorAll('instance'))
  const off = getOffsets(instances)
  const SKIP = new Set(['Início da primeira parte','Início da segunda parte','Fim da primeira parte','Fim da segunda parte'])
  const events = []
  instances.forEach(inst => {
    const text  = inst.querySelector('label text')?.textContent?.trim() || ''
    const start = parseInt(inst.querySelector('start')?.textContent || '0')
    const end   = parseInt(inst.querySelector('end')?.textContent   || '0')
    if (!text || SKIP.has(text)) return
    events.push({ text, start, end, minute: toMinute(start, off), duration: end-start })
  })
  return { events, off }
}
function parsePlayerXml(doc) {
  const instances = Array.from(doc.querySelectorAll('instance'))
  const off = getOffsets(instances)
  const playerMap = {}
  instances.forEach(inst => {
    const code = inst.querySelector('code')?.textContent?.trim() || ''
    const m = code.match(/^\((\d+)\) (.+)$/)
    if (!m) return
    const [, num, name] = m
    const start  = parseInt(inst.querySelector('start')?.textContent || '0')
    const end    = parseInt(inst.querySelector('end')?.textContent   || '0')
    const minute = toMinute(start, off)
    const labels   = Array.from(inst.querySelectorAll('label'))
    const groupMap = {}
    labels.forEach(lbl => {
      const g = lbl.querySelector('group')?.textContent?.trim() || ''
      const t = lbl.querySelector('text')?.textContent?.trim()  || ''
      if (!groupMap[g]) groupMap[g] = []
      groupMap[g].push(t)
    })
    const attrs  = groupMap['attributes'] || []
    const passes = groupMap['passes']     || []
    const duels  = groupMap['duels']      || []
    if (!playerMap[name]) {
      playerMap[name] = {
        name, number:num, team: GUARANI_ROSTER.has(name)?'Confiança':'Palmeiras',
        touches:0, passes:0, passesLong:0, crosses:0, smartPasses:0,
        duelsOff:0, duelsDef:0, duelsAerial:0,
        plus:0, minus:0, keyPass:0, assist:0, goals:0, underPressure:0,
        timeline:[], clips:[]
      }
    }
    const p = playerMap[name]
    p.touches++
    if (passes.length) { p.passes++; if (passes.includes('Passe longo')) p.passesLong++; if (passes.includes('Cruzamento')) p.crosses++; if (passes.includes('Passe inteligente')) p.smartPasses++ }
    if (duels.some(d=>d.includes('ofensivo')))  p.duelsOff++
    if (duels.some(d=>d.includes('defensivo'))) p.duelsDef++
    if (duels.some(d=>d.includes('aéreo')))     p.duelsAerial++
    if (attrs.includes('Sob pressão'))    p.underPressure++
    if (attrs.includes('Passe decisivo')) p.keyPass++
    if (attrs.includes('Assistência'))    p.assist++
    if (attrs.includes('Golo'))           p.goals++
    if (attrs.includes('Plus')  || attrs.includes('Bom')) p.plus++
    if (attrs.includes('Minus') || attrs.includes('Mau')) p.minus++
    p.timeline.push(minute)
    p.clips.push({ start, end, minute, attrs, name })
  })
  const players = Object.values(playerMap)
  const maxT = Math.max(...players.map(p=>p.touches), 1)
  players.forEach(p => {
    const raw = (p.touches/maxT)*30 + p.plus*3 - p.minus*2 + p.keyPass*4 + p.assist*8 + p.goals*15
    p.rating = Math.max(0, Math.min(10, raw/8)).toFixed(1)
    p.net = p.plus - p.minus
  })
  return { players, off }
}

/* ── Drawing helpers ─────────────────────────────────────────── */
function arrowHead(ctx, x, y, angle, sz=14) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-sz,-sz*0.5); ctx.lineTo(-sz,sz*0.5); ctx.closePath(); ctx.fill()
  ctx.restore()
}
function renderShape(ctx, s) {
  ctx.strokeStyle = s.color||'#fff'; ctx.fillStyle = s.color||'#fff'
  ctx.lineWidth = s.lw||3; ctx.lineCap='round'; ctx.lineJoin='round'
  switch (s.type) {
    case 'arrow': {
      const [p1,p2] = s.pts
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke()
      arrowHead(ctx, p2.x, p2.y, Math.atan2(p2.y-p1.y,p2.x-p1.x))
      break }
    case 'curved-arrow': {
      const [p1,p2] = s.pts
      const cp = s.cp || { x:(p1.x+p2.x)/2, y:Math.min(p1.y,p2.y)-60 }
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.quadraticCurveTo(cp.x,cp.y,p2.x,p2.y); ctx.stroke()
      arrowHead(ctx, p2.x, p2.y, Math.atan2(p2.y-cp.y, p2.x-cp.x))
      break }
    case 'dashed': {
      const [p1,p2] = s.pts
      ctx.save(); ctx.setLineDash([10,6])
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke()
      ctx.setLineDash([]); arrowHead(ctx, p2.x, p2.y, Math.atan2(p2.y-p1.y, p2.x-p1.x))
      ctx.restore(); break }
    case 'cone': {
      // Funnel/spotlight cone: apex at (x1,y1), base center at (x2,y2)
      if (s.x2 == null) return
      const len = Math.hypot(s.x2-s.x1, s.y2-s.y1) || 1
      const hw  = len * 0.22            // half-width at base
      const ey  = hw * 0.32            // ellipse y-radius (flattened)
      // Perpendicular direction
      const px  = -(s.y2-s.y1)/len, py = (s.x2-s.x1)/len
      const lx = s.x2 + px*hw, ly = s.y2 + py*hw
      const rx = s.x2 - px*hw, ry = s.y2 - py*hw
      ctx.save()
      // Cone body (gradient fill)
      const grad = ctx.createLinearGradient(s.x1,s.y1,s.x2,s.y2)
      grad.addColorStop(0, s.color + '00')
      grad.addColorStop(0.4, s.color + '44')
      grad.addColorStop(1, s.color + '88')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(lx,ly); ctx.lineTo(rx,ry); ctx.closePath(); ctx.fill()
      // Cone edges
      ctx.strokeStyle = s.color; ctx.lineWidth = s.lw||2; ctx.globalAlpha = 0.7
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(lx,ly); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(rx,ry); ctx.stroke()
      ctx.globalAlpha = 1
      // Base ellipse (glowing)
      ctx.fillStyle = s.color + 'cc'
      ctx.shadowColor = s.color; ctx.shadowBlur = 14
      ctx.beginPath(); ctx.ellipse(s.x2,s.y2,hw,ey,0,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.ellipse(s.x2,s.y2,hw,ey,0,0,Math.PI*2); ctx.stroke()
      ctx.shadowBlur = 0; ctx.restore(); break }
    case 'player': {
      if (s.rx == null) return
      ctx.save()
      ctx.fillStyle = s.color + '33'
      ctx.beginPath(); ctx.ellipse(s.cx,s.cy,s.rx,s.ry,0,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle = s.color; ctx.lineWidth = (s.lw||3)*2
      ctx.shadowColor = s.color; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.ellipse(s.cx,s.cy,s.rx,s.ry,0,0,Math.PI*2); ctx.stroke()
      ctx.shadowBlur = 0; ctx.restore(); break }
    case 'circle': {
      ctx.beginPath(); ctx.ellipse(s.cx,s.cy,s.rx,s.ry,0,0,Math.PI*2); ctx.stroke(); break }
    case 'rect': {
      ctx.strokeRect(s.x,s.y,s.w,s.h); break }
    case 'spotlight': {
      ctx.save()
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height)
      ctx.globalCompositeOperation='destination-out'
      ctx.beginPath(); ctx.ellipse(s.cx,s.cy,s.rx,s.ry,0,0,Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation='source-over'
      ctx.strokeStyle='#ffeb3b'; ctx.lineWidth=2
      ctx.beginPath(); ctx.ellipse(s.cx,s.cy,s.rx,s.ry,0,0,Math.PI*2); ctx.stroke()
      ctx.restore(); break }
    case 'free': {
      if (!s.pts||s.pts.length<2) return
      ctx.beginPath(); ctx.moveTo(s.pts[0].x,s.pts[0].y)
      s.pts.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke(); break }
    case 'text': {
      if (!s.text) return
      ctx.font=`bold 20px Arial`
      ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.strokeText(s.text,s.x,s.y)
      ctx.fillStyle=s.color||'#fff'; ctx.fillText(s.text,s.x,s.y); break }
  }
}
function renderAllShapes(ctx, shapes) { shapes.forEach(s => renderShape(ctx, s)) }

/* ── Shape select / move helpers ─────────────────────────────── */
function hitTest(s, pos, thresh=22) {
  switch (s.type) {
    case 'arrow': case 'curved-arrow': case 'dashed': {
      const [p1,p2] = s.pts
      const dx=p2.x-p1.x, dy=p2.y-p1.y, len2=dx*dx+dy*dy
      if (len2===0) return Math.hypot(pos.x-p1.x,pos.y-p1.y)<thresh
      const t=Math.max(0,Math.min(1,((pos.x-p1.x)*dx+(pos.y-p1.y)*dy)/len2))
      return Math.hypot(pos.x-(p1.x+t*dx),pos.y-(p1.y+t*dy))<thresh }
    case 'circle': case 'spotlight': case 'player': {
      const nx=(pos.x-s.cx)/(s.rx||1), ny=(pos.y-s.cy)/(s.ry||1)
      return nx*nx+ny*ny<=1.5 }
    case 'cone': {
      if (Math.hypot(pos.x-s.x1,pos.y-s.y1)<thresh) return true
      if (Math.hypot(pos.x-s.x2,pos.y-s.y2)<thresh*2) return true
      // bounding box
      const len=Math.hypot(s.x2-s.x1,s.y2-s.y1)*0.22
      return pos.x>=Math.min(s.x1,s.x2)-len && pos.x<=Math.max(s.x1,s.x2)+len
          && pos.y>=Math.min(s.y1,s.y2)      && pos.y<=Math.max(s.y1,s.y2) }
    case 'rect':
      return pos.x>=s.x&&pos.x<=s.x+Math.abs(s.w)&&pos.y>=s.y&&pos.y<=s.y+Math.abs(s.h)
    case 'text':
      return Math.hypot(pos.x-s.x,pos.y-s.y)<thresh*2
    case 'free': {
      if (!s.pts||s.pts.length<2) return false
      for (let i=0;i<s.pts.length-1;i++) {
        const p1=s.pts[i],p2=s.pts[i+1]
        const dx=p2.x-p1.x,dy=p2.y-p1.y,len2=dx*dx+dy*dy
        if (len2===0) continue
        const t=Math.max(0,Math.min(1,((pos.x-p1.x)*dx+(pos.y-p1.y)*dy)/len2))
        if (Math.hypot(pos.x-(p1.x+t*dx),pos.y-(p1.y+t*dy))<thresh) return true
      }
      return false }
    default: return false
  }
}
function moveShape(s, dx, dy) {
  const n = { ...s }
  if (s.pts) n.pts = s.pts.map(p=>({ x:p.x+dx, y:p.y+dy }))
  if (s.cx!=null) { n.cx=s.cx+dx; n.cy=s.cy+dy }
  if (s.x1!=null) { n.x1=s.x1+dx; n.y1=s.y1+dy; n.x2=s.x2+dx; n.y2=s.y2+dy }
  if (s.x !=null && s.type!=='cone') { n.x=s.x+dx; n.y=s.y+dy }
  return n
}

/* ── Drawing Canvas Overlay ──────────────────────────────────── */
function DrawingOverlay({ shapes, setShapes, tool, color, lw, videoRef, drawingMode, drawTimestamp }) {
  const canvasRef      = useRef(null)
  const shapesRef      = useRef(shapes)
  const current        = useRef(null)
  const drawing        = useRef(false)
  const rafRef         = useRef(null)
  const canvasSizeRef  = useRef({ w:1280, h:720 })
  const drawTsRef      = useRef(drawTimestamp)
  const drawModeRef    = useRef(drawingMode)   // ref avoids stale closure in RAF
  const selectedIdx    = useRef(-1)
  const dragStart      = useRef(null)
  const dragOffset     = useRef({ dx:0, dy:0 })

  useEffect(() => { shapesRef.current  = shapes       }, [shapes])
  useEffect(() => { drawTsRef.current  = drawTimestamp}, [drawTimestamp])
  useEffect(() => { drawModeRef.current= drawingMode  }, [drawingMode])

  // Show shapes only when: drawing mode active OR video is at/near the freeze timestamp
  // Uses refs so the RAF loop always reads the latest value (no stale closure)
  const shouldShowShapes = () => {
    if (drawModeRef.current) return true
    const ts = drawTsRef.current
    if (ts === null || ts === undefined) return false
    const v = videoRef.current; if (!v) return false
    return Math.abs(v.currentTime - ts) < 1.5
  }

  // RAF loop
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const { w, h } = canvasSizeRef.current
        if (canvas.width!==w || canvas.height!==h) { canvas.width=w; canvas.height=h }
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0,0,w,h)
        if (shouldShowShapes()) {
          shapesRef.current.forEach((s, i) => {
            if (i===selectedIdx.current && dragStart.current) {
              renderShape(ctx, moveShape(s, dragOffset.current.dx, dragOffset.current.dy))
              ctx.save(); ctx.strokeStyle='#ffeb3b'; ctx.lineWidth=2; ctx.setLineDash([6,3])
              renderShapeOutline(ctx, moveShape(s, dragOffset.current.dx, dragOffset.current.dy))
              ctx.setLineDash([]); ctx.restore()
            } else {
              renderShape(ctx, s)
            }
          })
          if (current.current) renderShape(ctx, current.current)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Sync video dimensions
  useEffect(() => {
    const video = videoRef.current; if (!video) return
    const sync = () => { if (video.videoWidth>0) canvasSizeRef.current={ w:video.videoWidth, h:video.videoHeight } }
    video.addEventListener('loadedmetadata', sync); video.addEventListener('resize', sync); sync()
    return () => { video.removeEventListener('loadedmetadata', sync); video.removeEventListener('resize', sync) }
  }, [videoRef])

  const getPos = (e) => {
    const canvas=canvasRef.current; if (!canvas) return { x:0,y:0 }
    const r=canvas.getBoundingClientRect()
    const scaleX=canvasSizeRef.current.w/r.width, scaleY=canvasSizeRef.current.h/r.height
    const clientX=e.touches?e.touches[0].clientX:e.clientX
    const clientY=e.touches?e.touches[0].clientY:e.clientY
    return { x:(clientX-r.left)*scaleX, y:(clientY-r.top)*scaleY }
  }

  const onDown = (e) => {
    if (!drawModeRef.current) return
    e.preventDefault()
    const pos = getPos(e)

    // SELECT mode: find and grab a shape
    if (tool === 'select') {
      const all = shapesRef.current
      // Search in reverse (topmost first)
      let found = -1
      for (let i=all.length-1; i>=0; i--) {
        if (hitTest(all[i], pos)) { found=i; break }
      }
      selectedIdx.current = found
      dragStart.current   = found >= 0 ? pos : null
      dragOffset.current  = { dx:0, dy:0 }
      drawing.current     = found >= 0
      return
    }

    // DRAW mode
    drawing.current = true; selectedIdx.current = -1; dragStart.current = null
    if (tool==='text') {
      const t = prompt('Digite o texto:')
      if (t) setShapes(prev=>[...prev,{ type:'text',x:pos.x,y:pos.y,text:t,color,lw }])
      drawing.current=false; return
    }
    if (['arrow','curved-arrow','dashed'].includes(tool)) {
      current.current = { type:tool, pts:[pos,{ ...pos }], color, lw }
    } else if (['circle','spotlight','player'].includes(tool)) {
      current.current = { type:tool, cx:pos.x,cy:pos.y,rx:1,ry:1, color,lw, _ox:pos.x,_oy:pos.y }
    } else if (tool==='cone') {
      current.current = { type:'cone', x1:pos.x,y1:pos.y,x2:pos.x,y2:pos.y, color,lw }
    } else if (tool==='rect') {
      current.current = { type:'rect', x:pos.x,y:pos.y,w:1,h:1, color,lw, _ox:pos.x,_oy:pos.y }
    } else if (tool==='free') {
      current.current = { type:'free', pts:[{ ...pos }], color, lw }
    }
  }

  const onMove = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const pos = getPos(e)

    // Move selected shape
    if (tool==='select' && dragStart.current && selectedIdx.current>=0) {
      dragOffset.current = { dx:pos.x-dragStart.current.x, dy:pos.y-dragStart.current.y }
      return
    }

    // Draw shape in progress
    const s = current.current; if (!s) return
    if (['arrow','curved-arrow','dashed'].includes(s.type)) {
      s.pts = [s.pts[0],{ ...pos }]
    } else if (['circle','spotlight','player'].includes(s.type)) {
      const dx=pos.x-s._ox, dy=pos.y-s._oy
      s.rx=Math.abs(dx)/2; s.ry=Math.abs(dy)/2; s.cx=s._ox+dx/2; s.cy=s._oy+dy/2
    } else if (s.type==='cone') {
      s.x2=pos.x; s.y2=pos.y
    } else if (s.type==='rect') {
      const dx=pos.x-s._ox, dy=pos.y-s._oy
      s.x=dx<0?pos.x:s._ox; s.w=Math.abs(dx); s.y=dy<0?pos.y:s._oy; s.h=Math.abs(dy)
    } else if (s.type==='free') {
      s.pts=[...s.pts,{ ...pos }]
    }
  }

  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false

    if (tool==='select' && selectedIdx.current>=0 && dragStart.current) {
      // Commit moved position
      const { dx, dy } = dragOffset.current
      if (Math.abs(dx)>1 || Math.abs(dy)>1) {
        const idx = selectedIdx.current
        setShapes(prev => prev.map((s,i) => i===idx ? moveShape(s,dx,dy) : s))
      }
      dragStart.current=null; dragOffset.current={ dx:0,dy:0 }
      selectedIdx.current=-1
      return
    }

    if (current.current) {
      const fin = { ...current.current }
      delete fin._ox; delete fin._oy
      setShapes(prev=>[...prev,fin])
    }
    current.current=null
  }

  return (
    <canvas ref={canvasRef}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      style={{ position:'absolute',top:0,left:0,width:'100%',height:'100%',
        cursor:!drawingMode?'default':tool==='select'?'move':tool==='text'?'text':'crosshair',
        pointerEvents:drawingMode?'all':'none', zIndex:10, touchAction:'none' }}
    />
  )
}

/* ── Shape outline for selection indicator ───────────────────── */
function renderShapeOutline(ctx, s) {
  switch (s.type) {
    case 'arrow': case 'curved-arrow': case 'dashed': {
      const [p1,p2]=s.pts
      ctx.beginPath(); ctx.moveTo(p1.x-6,p1.y-6); ctx.lineTo(p2.x+6,p2.y+6); ctx.stroke(); break }
    case 'circle': case 'spotlight': case 'player':
      ctx.beginPath(); ctx.ellipse(s.cx,s.cy,s.rx+6,s.ry+6,0,0,Math.PI*2); ctx.stroke(); break
    case 'cone':
      ctx.strokeRect(Math.min(s.x1,s.x2)-10, Math.min(s.y1,s.y2)-10,
        Math.abs(s.x2-s.x1)+20, Math.abs(s.y2-s.y1)+20); break
    case 'rect':
      ctx.strokeRect(s.x-6,s.y-6,s.w+12,s.h+12); break
    case 'text':
      ctx.strokeRect(s.x-4,s.y-22,80,28); break
    default: break
  }
}

/* ── Drawing Toolbar ─────────────────────────────────────────── */
function DrawToolbar({ tool, setTool, color, setColor, lw, setLw, onUndo, onClear }) {
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap',
      background:'rgba(0,0,0,0.85)', borderRadius:10, padding:'8px 12px' }}>
      {/* Tools */}
      <div style={{ display:'flex', gap:3 }}>
        {TOOLS.map(t => (
          <button key={t.id} title={t.label} onClick={() => setTool(t.id)} style={{
            width:30, height:30, borderRadius:6, border:'none', cursor:'pointer',
            background: tool===t.id ? '#fff' : 'rgba(255,255,255,0.15)',
            color: tool===t.id ? '#111' : '#fff',
            fontSize:13, fontWeight:700, fontFamily:'monospace',
          }}>{t.icon}</button>
        ))}
      </div>
      <div style={{ width:1, height:24, background:'rgba(255,255,255,0.2)' }} />
      {/* Colors */}
      <div style={{ display:'flex', gap:4 }}>
        {DRAW_COLORS.map(c => (
          <div key={c} onClick={() => setColor(c)}
            style={{ width:20, height:20, borderRadius:'50%', background:c, cursor:'pointer',
              border: color===c ? '2px solid #fff' : '2px solid rgba(255,255,255,0.3)' }} />
        ))}
      </div>
      <div style={{ width:1, height:24, background:'rgba(255,255,255,0.2)' }} />
      {/* Line width */}
      <div style={{ display:'flex', gap:3 }}>
        {[2,4,7].map(w => (
          <button key={w} onClick={() => setLw(w)} style={{
            width:26, height:26, borderRadius:6, border:'none', cursor:'pointer',
            background: lw===w ? '#fff' : 'rgba(255,255,255,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <div style={{ width:14, height:w, background: lw===w ? '#111' : '#fff', borderRadius:99 }} />
          </button>
        ))}
      </div>
      <div style={{ width:1, height:24, background:'rgba(255,255,255,0.2)' }} />
      {/* Actions */}
      <button onClick={onUndo} title="Desfazer" style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:6, color:'#fff', fontSize:13, cursor:'pointer', padding:'4px 8px' }}>↩</button>
      <button onClick={onClear} title="Limpar tudo" style={{ background:'rgba(239,83,80,0.4)', border:'none', borderRadius:6, color:'#fff', fontSize:10, cursor:'pointer', padding:'4px 8px', fontWeight:700 }}>✕ Limpar</button>
    </div>
  )
}

/* ── Export helpers ──────────────────────────────────────────── */
function exportFramePng(videoEl, shapes, label) {
  const canvas = document.createElement('canvas')
  canvas.width  = videoEl.videoWidth  || 1280
  canvas.height = videoEl.videoHeight || 720
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
  renderAllShapes(ctx, shapes)
  const a = document.createElement('a')
  a.download = `frame_${label.replace(/[^a-z0-9]/gi,'_')}.png`
  a.href = canvas.toDataURL('image/png')
  a.click()
}

async function exportClipWithDrawings(videoEl, shapes, clipStart, clipEnd, label, freezeSecs, drawTimestamp, onProgress) {
  const canvas = document.createElement('canvas')
  canvas.width  = videoEl.videoWidth  || 1280
  canvas.height = videoEl.videoHeight || 720
  const ctx = canvas.getContext('2d')

  const stream   = canvas.captureStream(30)
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 })
  const chunks   = []
  recorder.ondataavailable = e => { if (e.data.size>0) chunks.push(e.data) }

  const freezeMs = (freezeSecs || 0) * 1000
  // Clamp freeze point within clip bounds; default to end if no timestamp
  const freezeAt = (drawTimestamp !== null && drawTimestamp !== undefined)
    ? Math.max(clipStart, Math.min(drawTimestamp, clipEnd))
    : clipEnd

  const phase1Ms = Math.max(0, (freezeAt - clipStart) * 1000)  // play before freeze
  const phase3Ms = Math.max(0, (clipEnd - freezeAt) * 1000)    // play after freeze
  const totalMs  = phase1Ms + freezeMs + phase3Ms

  const seekTo = (t) => new Promise(res => { videoEl.currentTime = t; videoEl.onseeked = res })

  recorder.start()

  // ── Phase 1: Play clipStart → freezeAt (no drawings) ─────────
  await seekTo(clipStart)
  videoEl.play()
  await new Promise(res => {
    if (phase1Ms < 100) { res(); return }
    let rafId; const wall = performance.now()
    const loop = () => {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      const el = performance.now() - wall
      onProgress?.(Math.min(99, Math.round((el / totalMs) * 100)))
      if (el < phase1Ms) rafId = requestAnimationFrame(loop)
      else { cancelAnimationFrame(rafId); res() }
    }
    rafId = requestAnimationFrame(loop)
  })
  videoEl.pause()

  // ── Phase 2: Freeze frame WITH drawings for freezeSecs ────────
  await seekTo(freezeAt)
  // Composite: video frame + shapes
  const freezeFrame = document.createElement('canvas')
  freezeFrame.width = canvas.width; freezeFrame.height = canvas.height
  const fCtx = freezeFrame.getContext('2d')
  fCtx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
  renderAllShapes(fCtx, shapes)

  await new Promise(res => {
    if (freezeMs < 100) { res(); return }
    let rafId; const wall = performance.now()
    const loop = () => {
      ctx.drawImage(freezeFrame, 0, 0)
      const el = performance.now() - wall
      onProgress?.(Math.min(99, Math.round(((phase1Ms + el) / totalMs) * 100)))
      if (el < freezeMs) rafId = requestAnimationFrame(loop)
      else { cancelAnimationFrame(rafId); res() }
    }
    rafId = requestAnimationFrame(loop)
  })

  // ── Phase 3: Play freezeAt → clipEnd (no drawings) ────────────
  await seekTo(freezeAt)
  videoEl.play()
  await new Promise(res => {
    if (phase3Ms < 100) { videoEl.pause(); recorder.stop(); res(); return }
    let rafId; const wall = performance.now()
    const loop = () => {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      const el = performance.now() - wall
      onProgress?.(Math.min(100, Math.round(((phase1Ms + freezeMs + el) / totalMs) * 100)))
      if (el < phase3Ms) rafId = requestAnimationFrame(loop)
      else { videoEl.pause(); cancelAnimationFrame(rafId); recorder.stop(); res() }
    }
    rafId = requestAnimationFrame(loop)
  })

  return new Promise(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const a = document.createElement('a')
      a.download = `clip_${label.replace(/[^a-z0-9]/gi,'_')}.webm`
      a.href = URL.createObjectURL(blob)
      a.click()
      URL.revokeObjectURL(a.href)
      resolve()
    }
  })
}

/* ── Video Player with Drawing ───────────────────────────────── */
function VideoPlayerWithDraw({ videoUrl, activeClip, onEnded, onManualClip }) {
  const videoRef    = useRef(null)
  const rafRef      = useRef(null)
  const containerRef= useRef(null)

  // Drawing state
  const [drawingMode,  setDrawingMode]  = useState(false)
  const [shapes,       setShapes]       = useState([])
  const [drawTimestamp,setDrawTimestamp]= useState(null)  // video time when drawing was activated
  const [tool,         setTool]         = useState('arrow')
  const [color,        setColor]        = useState('#ffffff')
  const [lw,           setLw]           = useState(3)
  const [exporting,    setExporting]    = useState(false)
  const [exportProg,   setExportProg]   = useState(0)
  const [freezeSecs,   setFreezeSecs]   = useState(3)
  // Manual clip marking
  const [markStart,    setMarkStart]    = useState(null)

  /* Jump to clip — clear drawings when switching clips */
  useEffect(() => {
    const v = videoRef.current; if (!v || !activeClip) return
    v.currentTime = Math.max(0, activeClip.start - 1)
    v.play().catch(() => {})
    setDrawingMode(false); setShapes([]); setDrawTimestamp(null)

    const check = () => {
      if (!videoRef.current) return
      if (videoRef.current.currentTime >= activeClip.end) {
        videoRef.current.pause(); onEnded?.()
      } else { rafRef.current = requestAnimationFrame(check) }
    }
    rafRef.current = requestAnimationFrame(check)
    return () => cancelAnimationFrame(rafRef.current)
  }, [activeClip])

  const toggleDraw = () => {
    if (!drawingMode) {
      videoRef.current?.pause()
      // Capture exactly where in the video the user paused to draw
      setDrawTimestamp(videoRef.current?.currentTime ?? null)
    }
    setDrawingMode(d => !d)
  }

  const handleExportPng = () => {
    if (!videoRef.current) return
    const label = activeClip ? `${activeClip.minute}min` : 'frame'
    exportFramePng(videoRef.current, shapes, label)
  }

  const handleExportClip = async () => {
    if (!videoRef.current || !activeClip) return
    setExporting(true); setExportProg(0)
    try {
      const label = activeClip.text || activeClip.name || `clip_${activeClip.minute}`
      await exportClipWithDrawings(videoRef.current, shapes, activeClip.start, activeClip.end, label, freezeSecs, drawTimestamp, setExportProg)
    } catch(e) { alert('Erro ao exportar: ' + e.message) }
    setExporting(false)
  }

  const handleMarkStart = () => {
    const v = videoRef.current; if (!v) return
    v.pause()
    setMarkStart(v.currentTime)
  }

  const handleMarkEnd = () => {
    const v = videoRef.current; if (!v || markStart === null) return
    const end = v.currentTime
    if (end > markStart + 1) {
      onManualClip?.({
        start: markStart, end,
        minute: Math.floor(markStart / 60),
        text: `Recorte ${Math.floor(markStart/60)}'–${Math.floor(end/60)}'`,
        duration: end - markStart,
        isManual: true,
      })
      setMarkStart(null)
    }
  }

  if (!videoUrl) return (
    <div style={{ background:'#0a0a0a', borderRadius:12, aspectRatio:'16/9',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10,
      border:'1.5px dashed #333' }}>
      <span style={{ fontSize:32 }}>🎬</span>
      <p style={{ fontSize:11, color:'#555', textAlign:'center' }}>Carregue o vídeo MP4<br/>para assistir os clips</p>
    </div>
  )

  return (
    <div>
      {/* Video + canvas container */}
      <div ref={containerRef} style={{ position:'relative', borderRadius:12, overflow:'hidden', background:'#000', border:`1px solid ${drawingMode?'#f59e0b':'#10233b'}` }}>
        <video ref={videoRef} src={videoUrl} controls={!drawingMode}
          style={{ width:'100%', display:'block', maxHeight:400, userSelect:'none' }} />
        <DrawingOverlay
          shapes={shapes} setShapes={setShapes}
          tool={tool} color={color} lw={lw}
          videoRef={videoRef} drawingMode={drawingMode}
          drawTimestamp={drawTimestamp} />
      </div>

      {/* Controls row */}
      <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        {/* Manual clip marking */}
        {onManualClip && (
          <div style={{ display:'flex', gap:5, alignItems:'center', background:'#f7f3ff', borderRadius:8, padding:'5px 10px', border:'1px solid #d4b8ff' }}>
            <span style={{ fontSize:9, color:PURP, fontWeight:700 }}>✂️ Recorte</span>
            <button onClick={handleMarkStart}
              style={{ background: markStart!==null?'#d4b8ff':PURP, color:'#fff', border:'none', borderRadius:6, padding:'5px 9px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {markStart!==null ? `▶ ${fmtTs(Math.round(markStart))}` : '⏺ Início'}
            </button>
            {markStart!==null && (
              <button onClick={handleMarkEnd}
                style={{ background:GFC, color:'#fff', border:'none', borderRadius:6, padding:'5px 9px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                ⏹ Fim
              </button>
            )}
            {markStart!==null && (
              <button onClick={()=>setMarkStart(null)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#94a3b8' }}>✕</button>
            )}
          </div>
        )}
        {/* Draw toggle */}
        <button onClick={toggleDraw} style={{
          background: drawingMode ? '#f59e0b' : '#10233b', color:'#fff',
          border:'none', borderRadius:8, padding:'7px 14px', fontSize:10,
          fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6
        }}>
          ✏ {drawingMode ? 'Fechar desenho' : 'Adicionar desenho'}
        </button>

        {/* Export buttons — always visible */}
        <button onClick={handleExportPng}
          style={{ background:'#1565c0', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px',
            fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
          🖼 Baixar frame PNG
        </button>
        {activeClip && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {/* Freeze duration picker */}
            <div style={{ display:'flex', alignItems:'center', gap:5, background:'#f4f8fc', borderRadius:8, padding:'5px 10px', border:'1px solid #bfd8ea' }}>
              <span style={{ fontSize:9, color:'#64748b', fontWeight:700, whiteSpace:'nowrap' }}>⏸ Pausa</span>
              <input
                type="range" min={0} max={10} step={1} value={freezeSecs}
                onChange={e => setFreezeSecs(Number(e.target.value))}
                style={{ width:70, accentColor:GFC, cursor:'pointer' }}
              />
              <span style={{ fontSize:11, fontWeight:900, color:GFC, fontFamily:"'Barlow Condensed',sans-serif", minWidth:22, textAlign:'right' }}>{freezeSecs}s</span>
            </div>
            <button onClick={handleExportClip} disabled={exporting}
              style={{ background: exporting ? '#555' : GFC, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px',
                fontSize:10, fontWeight:700, cursor: exporting?'wait':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6,
                opacity: exporting ? 0.8 : 1 }}>
              {exporting
                ? `⏳ Exportando ${exportProg}%`
                : `🎬 Baixar clip${freezeSecs>0?' (freeze '+freezeSecs+'s)':''} (.webm)`}
            </button>
          </div>
        )}

        {/* Clip + draw timestamp info */}
        {activeClip && (
          <span style={{ fontSize:10, color:'#64748b', marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
            <span>{CAT_ICONS[activeClip.text]||'📌'} <strong>{activeClip.minute}'</strong> · {fmtTs(activeClip.start)}→{fmtTs(activeClip.end)} · {activeClip.end-activeClip.start}s</span>
            {drawTimestamp !== null && (
              <span style={{ fontSize:9, color:'#f59e0b', fontWeight:700 }}>
                ⏸ Freeze em {fmtTs(Math.round(drawTimestamp))} ({freezeSecs}s)
              </span>
            )}
          </span>
        )}
      </div>

      {/* Drawing toolbar — shown when drawing mode active */}
      {drawingMode && (
        <div style={{ marginTop:8 }}>
          <DrawToolbar
            tool={tool} setTool={setTool}
            color={color} setColor={setColor}
            lw={lw} setLw={setLw}
            onUndo={() => setShapes(prev => prev.slice(0,-1))}
            onClear={() => setShapes([])}
          />
        </div>
      )}
    </div>
  )
}

/* ── Clip helpers ─────────────────────────────────────────────── */
function catColor(text) {
  if (TEAM_CATEGORIES.offensive.includes(text)) return GFC
  if (TEAM_CATEGORIES.defensive.includes(text)) return RED
  return AMB
}
function ClipCard({ clip, isActive, onClick, showPlayer }) {
  const color    = clip.team ? (clip.team==='Confiança'?GFC:RED) : catColor(clip.text||'')
  const label    = clip.text || clip.name || ''
  const subAttrs = clip.attrs?.filter(a=>['Golo','Assistência','Passe decisivo','Bom','Plus'].includes(a))||[]
  return (
    <div onClick={onClick} style={{ borderRadius:8, border:`1.5px solid ${isActive?color:'#e5edf5'}`,
      background:isActive?`${color}0d`:'#fff', padding:'8px 12px', cursor:'pointer',
      transition:'all 0.15s', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ flexShrink:0, width:36, textAlign:'center' }}>
        <p style={{ fontSize:15, fontWeight:900, color, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{clip.minute}'</p>
        <p style={{ fontSize:9, color:'#94a3b8' }}>{CAT_ICONS[clip.text]||(clip.team==='Confiança'?'🟢':'🔴')}</p>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:10, fontWeight:700, color:'#10233b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</p>
        <p style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>
          {fmtTs(clip.start)} → {fmtTs(clip.end)} &nbsp;·&nbsp; {clip.end-clip.start}s
          {subAttrs.length>0 && <span style={{ color, fontWeight:700, marginLeft:4 }}>{subAttrs.join(', ')}</span>}
        </p>
      </div>
      {showPlayer && (
        <div style={{ flexShrink:0, width:24, height:24, borderRadius:'50%',
          background:isActive?color:'#f4f8fc', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isActive ? <span style={{ fontSize:8, color:'#fff' }}>▐▐</span>
                    : <span style={{ fontSize:8, color:'#94a3b8', marginLeft:1 }}>▶</span>}
        </div>
      )}
    </div>
  )
}

/* ── Phase Dashboard ─────────────────────────────────────────── */
function PhaseDashboard({ teamData }) {
  if (!teamData) return null
  const { events, off } = teamData
  const totalSecs = off.h2End - off.h1Start || 6434
  const offPhases = events.filter(e=>e.text==='Fase ofensiva')
  const defPhases = events.filter(e=>e.text==='Fase defensiva')
  const offSecs   = offPhases.reduce((s,e)=>s+e.duration,0)
  const defSecs   = defPhases.reduce((s,e)=>s+e.duration,0)
  const offPct    = Math.round((offSecs/totalSecs)*100)
  const defPct    = Math.round((defSecs/totalSecs)*100)
  const pairs = [
    [{ l:'Fases ofensivas', v:offPhases.length, c:GFC },{ l:'Fases defensivas', v:defPhases.length, c:RED }],
    [{ l:'Remates', v:events.filter(e=>e.text==='Remate').length, c:GFC },{ l:'Remates sofridos', v:events.filter(e=>e.text==='Remates sofridos').length, c:RED }],
    [{ l:'Oportunidades', v:events.filter(e=>e.text==='Oportunidades de golo').length, c:GFC },{ l:'Oport. cedidas', v:events.filter(e=>e.text==='oportunidades de golo contra').length, c:RED }],
    [{ l:'Cruzamentos', v:events.filter(e=>e.text==='Cruzamento').length, c:GFC },{ l:'Cruz. sofridos', v:events.filter(e=>e.text==='Cruzamentos sofridos').length, c:RED }],
    [{ l:'Cantos ganhos', v:events.filter(e=>e.text==='Cantos ofensivos').length, c:GFC },{ l:'Cantos cedidos', v:events.filter(e=>e.text==='Cantos concedidos').length, c:RED }],
  ]
  return (
    <div style={{ marginTop:14 }}>
      <p style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>📊 Resumo do jogo</p>
      <div style={{ marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, fontWeight:700, marginBottom:4 }}>
          <span style={{ color:GFC }}>⚔️ Ataque {offPct}%</span><span style={{ color:RED }}>🛡️ Defesa {defPct}%</span>
        </div>
        <div style={{ display:'flex', height:7, borderRadius:99, overflow:'hidden' }}>
          <div style={{ width:`${offPct}%`, background:GFC }} />
          <div style={{ flex:1, background:'#e5edf5' }} />
          <div style={{ width:`${defPct}%`, background:RED }} />
        </div>
      </div>
      {pairs.map((pair,i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:5 }}>
          {pair.map(({l,v,c}) => (
            <div key={l} style={{ background:'#fff', borderRadius:7, border:'1px solid #e5edf5', padding:'6px 10px', display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ fontSize:17, fontWeight:900, color:c, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1, minWidth:22 }}>{v}</span>
              <span style={{ fontSize:9, color:'#94a3b8', lineHeight:1.2 }}>{l}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── Player Ratings ──────────────────────────────────────────── */
function RatingsPanel({ playerData, onSelectClip, showPlayer }) {
  const [teamFilter, setTeamFilter] = useState('Confiança')
  const [sort, setSort]             = useState('rating')
  const [expanded, setExpanded]     = useState(null)
  if (!playerData) return <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', padding:24 }}>Faça upload do XML de Jogadores.</p>
  const filtered = playerData.players.filter(p=>p.team===teamFilter)
    .sort((a,b) => sort==='rating' ? parseFloat(b.rating)-parseFloat(a.rating) : sort==='net' ? b.net-a.net : b.touches-a.touches)
  const maxT  = Math.max(...filtered.map(p=>p.touches),1)
  const color = teamFilter==='Confiança' ? GFC : RED
  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        {['Confiança','Palmeiras'].map(t=>(
          <button key={t} onClick={()=>setTeamFilter(t)} style={{ padding:'5px 12px', fontSize:10, fontWeight:700, borderRadius:8, fontFamily:'inherit', background:teamFilter===t?(t==='Confiança'?GFC:RED):'#f4f8fc', color:teamFilter===t?'#fff':'#64748b', border:'none', cursor:'pointer' }}>{t}</button>
        ))}
        <div style={{ display:'flex', gap:3, marginLeft:'auto' }}>
          {[['rating','★'],['net','+/−'],['touches','👟']].map(([k,l])=>(
            <button key={k} onClick={()=>setSort(k)} style={{ padding:'4px 8px', fontSize:9, fontWeight:700, borderRadius:6, fontFamily:'inherit', background:sort===k?GFC:'#f4f8fc', color:sort===k?'#fff':'#64748b', border:'none', cursor:'pointer' }}>{l}</button>
          ))}
        </div>
      </div>
      {filtered.map((p,i)=>{
        const rNum=parseFloat(p.rating); const rCol=rNum>=7?GFC:rNum>=5?AMB:RED; const isExp=expanded===p.name
        const keyClips=p.clips.filter(c=>c.attrs.some(a=>['Plus','Bom','Golo','Assistência','Passe decisivo'].includes(a)))
        return (
          <div key={p.name} style={{ marginBottom:6 }}>
            <div onClick={()=>setExpanded(isExp?null:p.name)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#fff', borderRadius:8, border:`1px solid ${isExp?color:'#e5edf5'}`, cursor:'pointer' }}>
              <span style={{ fontSize:9, color:'#94a3b8', width:14, flexShrink:0 }}>{i+1}</span>
              <span style={{ fontSize:11, fontWeight:700, color:'#10233b', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>#{p.number} {p.name}</span>
              <div style={{ width:50, height:4, background:'#f4f8fc', borderRadius:99, overflow:'hidden', flexShrink:0 }}>
                <div style={{ width:`${(p.touches/maxT)*100}%`, height:'100%', background:color }} />
              </div>
              <span style={{ fontSize:9, color:p.net>=0?GFC:RED, fontWeight:700, flexShrink:0 }}>{p.net>=0?`+${p.net}`:p.net}</span>
              <div style={{ width:30, height:30, borderRadius:'50%', background:`${rCol}18`, border:`2px solid ${rCol}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:900, color:rCol, fontFamily:"'Barlow Condensed',sans-serif" }}>{p.rating}</span>
              </div>
            </div>
            {isExp && (
              <div style={{ background:'#f7fcf9', borderRadius:'0 0 8px 8px', border:`1px solid ${color}`, borderTop:'none', padding:'10px 10px 6px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:8 }}>
                  {[{l:'Toques',v:p.touches},{l:'Passes',v:p.passes},{l:'Duelos off.',v:p.duelsOff},{l:'Duelos def.',v:p.duelsDef},{l:'Aéreos',v:p.duelsAerial},{l:'Cruzamentos',v:p.crosses},{l:'P. decisivos',v:p.keyPass},{l:'Sob pressão',v:p.underPressure}].map(({l,v})=>(
                    <div key={l} style={{ background:'#fff', borderRadius:6, padding:'5px 8px', textAlign:'center', border:'1px solid #e5edf5' }}>
                      <p style={{ fontSize:14, fontWeight:900, color, fontFamily:"'Barlow Condensed',sans-serif" }}>{v}</p>
                      <p style={{ fontSize:7, color:'#94a3b8' }}>{l}</p>
                    </div>
                  ))}
                </div>
                {keyClips.length>0 && <>
                  <p style={{ fontSize:8, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:5 }}>Clips positivos ({keyClips.length})</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {keyClips.slice(0,5).map((c,ci)=>(
                      <ClipCard key={ci} clip={{ ...c, text:c.attrs.filter(a=>a!=='Plus'&&a!=='Bom').join(', ')||'Ação positiva', team:teamFilter }}
                        isActive={false} onClick={()=>showPlayer&&onSelectClip(c)} showPlayer={showPlayer} />
                    ))}
                  </div>
                </>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function XmlAnalyzer() {
  const [teamData,    setTeamData]   = useState(null)
  const [playerData,  setPlayerData] = useState(null)
  const [teamFile,    setTeamFile]   = useState(null)
  const [playerFile,  setPlayerFile] = useState(null)
  const [videoUrl,    setVideoUrl]   = useState(null)
  const [videoFile,   setVideoFile]  = useState(null)
  const [activeClip,  setActiveClip] = useState(null)
  const [rightTab,    setRightTab]   = useState('clips')
  const [catFilter,   setCatFilter]  = useState(null)
  const [teamFilter,  setTeamFilter] = useState('all')
  const [loading,     setLoading]    = useState({ team:false, player:false })
  const [error,       setError]      = useState({ team:null, player:null })
  // Free-mode: manual clips and custom tag categories
  const [manualClips, setManualClips]= useState([])
  const [freeCats,    setFreeCats]   = useState(['Ataque','Defesa','Set piece','Transição','Golo','Falta'])
  const [newCatInput, setNewCatInput]= useState('')

  const videoFileRef  = useRef(null)
  const teamXmlRef    = useRef(null)
  const playerXmlRef  = useRef(null)

  // hasAny kept for backward compat but not used in layout
  const hasAny    = teamData || playerData

  const handleVideoFile = useCallback((file) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file)); setVideoFile(file.name); setActiveClip(null)
  }, [videoUrl])

  const handleTeamXml = useCallback(async (file) => {
    setLoading(p=>({...p,team:true})); setError(p=>({...p,team:null}))
    try {
      const doc  = await readXml(file)
      const type = detectXmlType(doc)
      if (type === 'player') {
        // User loaded player XML in team slot — auto-route
        setPlayerData(parsePlayerXml(doc)); setPlayerFile(file.name)
        setError(p=>({...p,team:'⚠️ Detectado XML de jogadores — carregado automaticamente no slot correto.'}))
      } else {
        setTeamData(parseTeamXml(doc)); setTeamFile(file.name)
      }
    } catch(e) { setError(p=>({...p,team:e.message})) }
    setLoading(p=>({...p,team:false}))
  }, [])

  const handlePlayerXml = useCallback(async (file) => {
    setLoading(p=>({...p,player:true})); setError(p=>({...p,player:null}))
    try {
      const doc  = await readXml(file)
      const type = detectXmlType(doc)
      if (type === 'team') {
        // User loaded team XML in player slot — auto-route
        setTeamData(parseTeamXml(doc)); setTeamFile(file.name)
        setError(p=>({...p,player:'⚠️ Detectado XML de equipe — carregado automaticamente no slot correto.'}))
      } else {
        setPlayerData(parsePlayerXml(doc)); setPlayerFile(file.name)
      }
    } catch(e) { setError(p=>({...p,player:e.message})) }
    setLoading(p=>({...p,player:false}))
  }, [])

  const allTeamClips    = teamData ? teamData.events : []
  const allCategories   = [...new Set(allTeamClips.map(e=>e.text))]
  const playerKeyClips  = playerData
    ? playerData.players.filter(p=>p.team==='Confiança').flatMap(p=>p.clips
        .filter(c=>c.attrs.some(a=>['Plus','Bom','Golo','Assistência','Passe decisivo'].includes(a)))
        .map(c=>({ ...c, text:[c.name,...c.attrs.filter(a=>a!=='Plus'&&a!=='Bom'&&a!=='Sob pressão')].join(' · '), team:'Confiança' }))
      ).sort((a,b)=>a.minute-b.minute)
    : []

  const hasXml   = teamData || playerData
  const hasVideo = !!videoUrl
  const showPlayer= hasVideo

  // In free mode (no XML), displayClips = manual clips
  const displayClips = hasXml
    ? (teamFilter==='player' ? playerKeyClips : allTeamClips.filter(e=>!catFilter||e.text===catFilter)).sort((a,b)=>a.minute-b.minute)
    : manualClips.sort((a,b)=>a.start-b.start)

  const handleManualClip = (clip) => {
    setManualClips(prev => [...prev, { ...clip, id: Date.now() }])
    setActiveClip(clip)
  }

  const deleteManualClip = (id) => {
    setManualClips(prev => prev.filter(c => c.id !== id))
    setActiveClip(a => a?.id === id ? null : a)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* ── Upload bar ── */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={()=>videoFileRef.current?.click()}
            style={{ background:videoFile?'#10233b':GFC, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            🎬 {videoFile?videoFile.slice(0,24)+(videoFile.length>24?'…':''):'Carregar vídeo MP4'}
          </button>
          <input ref={videoFileRef} type="file" accept="video/*" style={{ display:'none' }} onChange={e=>{const f=e.target.files[0];if(f)handleVideoFile(f);e.target.value=''}} />

          <div style={{ width:1, height:24, background:'#e5edf5' }} />

          <button onClick={()=>teamXmlRef.current?.click()}
            style={{ background:teamFile?GFC2:'#f4f8fc', color:teamFile?GFC:'#64748b', border:`1px solid ${teamFile?GFC:'#e5edf5'}`, borderRadius:8, padding:'6px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
            {loading.team?'⏳':teamFile?'✅':'📋'} {teamFile?'Eventos carregados':'XML Eventos de Equipe'}
          </button>
          <input ref={teamXmlRef} type="file" accept=".xml" style={{ display:'none' }} onChange={e=>{const f=e.target.files[0];if(f)handleTeamXml(f);e.target.value=''}} />
          {error.team&&<span style={{ fontSize:9, color:RED }}>⚠️ {error.team}</span>}

          <button onClick={()=>playerXmlRef.current?.click()}
            style={{ background:playerFile?GFC2:'#f4f8fc', color:playerFile?GFC:'#64748b', border:`1px solid ${playerFile?GFC:'#e5edf5'}`, borderRadius:8, padding:'6px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
            {loading.player?'⏳':playerFile?'✅':'👤'} {playerFile?'Jogadores carregados':'XML Jogadores'}
          </button>
          <input ref={playerXmlRef} type="file" accept=".xml" style={{ display:'none' }} onChange={e=>{const f=e.target.files[0];if(f)handlePlayerXml(f);e.target.value=''}} />
          {error.player&&<span style={{ fontSize:9, color:RED }}>⚠️ {error.player}</span>}
        </div>
      </div>

      {/* ── Empty state — no video at all ── */}
      {!hasVideo && !hasXml && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5edf5', padding:60, textAlign:'center' }}>
          <p style={{ fontSize:40, marginBottom:12 }}>🗂</p>
          <p style={{ fontSize:15, fontWeight:700, color:'#52677e', marginBottom:8 }}>Modo LongoMatch</p>
          <p style={{ fontSize:11, color:'#94a3b8', maxWidth:460, margin:'0 auto', lineHeight:1.7 }}>
            <strong>Com XML Wyscout:</strong> carregue o vídeo MP4 + XML Eventos + XML Jogadores para análise completa.<br/>
            <strong>Sem XML:</strong> carregue só o vídeo MP4 e tague os momentos manualmente — recortes, marcações e export direto aqui dentro.
          </p>
        </div>
      )}

      {/* ── Main layout — shows whenever video is loaded ── */}
      {hasVideo && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:14, alignItems:'start' }}>

          {/* LEFT — Player sticky */}
          <div style={{ position:'sticky', top:80 }}>
            <VideoPlayerWithDraw
              videoUrl={videoUrl} activeClip={activeClip}
              onEnded={()=>setActiveClip(null)}
              onManualClip={handleManualClip} />

            {/* Prev/Next */}
            {activeClip && displayClips.length > 1 && (() => {
              const idx = displayClips.findIndex(c => c===activeClip || c.id===activeClip?.id)
              return (
                <div style={{ marginTop:8, display:'flex', gap:6, justifyContent:'flex-end' }}>
                  {idx>0 && <button onClick={()=>setActiveClip(displayClips[idx-1])}
                    style={{ background:'#f4f8fc', border:'none', borderRadius:6, padding:'5px 10px', fontSize:10, cursor:'pointer', fontFamily:'inherit', color:GFC, fontWeight:700 }}>◀ Ant.</button>}
                  {idx<displayClips.length-1 && <button onClick={()=>setActiveClip(displayClips[idx+1])}
                    style={{ background:GFC, border:'none', borderRadius:6, padding:'5px 10px', fontSize:10, cursor:'pointer', fontFamily:'inherit', color:'#fff', fontWeight:700 }}>Próx. ▶</button>}
                </div>
              )
            })()}

            {hasXml && <PhaseDashboard teamData={teamData} />}
          </div>

          {/* RIGHT — Navigator */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5edf5', overflow:'hidden' }}>
            {/* Tabs */}
            <div style={{ borderBottom:'1px solid #f4f8fc', padding:'10px 12px', display:'flex', gap:4, flexWrap:'wrap' }}>
              {hasXml ? (
                <>
                  {[['clips','🎬 Clips',!!teamData],['ratings','⭐ Jogadores',!!playerData]].map(([k,l,enabled])=>(
                    <button key={k} onClick={()=>enabled&&setRightTab(k)} style={{ padding:'5px 12px', fontSize:10, fontWeight:700, borderRadius:8, fontFamily:'inherit', background:rightTab===k?GFC:'#f4f8fc', color:rightTab===k?'#fff':enabled?'#64748b':'#c0d8c4', border:'none', cursor:enabled?'pointer':'not-allowed', opacity:enabled?1:0.5 }}>{l}</button>
                  ))}
                </>
              ) : (
                <span style={{ fontSize:10, fontWeight:700, color:PURP }}>✂️ Tagging livre</span>
              )}
              <span style={{ fontSize:9, color:'#94a3b8', alignSelf:'center', marginLeft:'auto' }}>{displayClips.length} clips</span>
            </div>

            {/* ── FREE MODE: tag buttons + manual clip list ── */}
            {!hasXml && (
              <div>
                {/* Category tag buttons */}
                <div style={{ padding:'10px 12px', borderBottom:'1px solid #f4f8fc' }}>
                  <p style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px', marginBottom:7 }}>
                    Taguear momento atual <span style={{ color:'#c0d8c4' }}>· pausa o vídeo e clica</span>
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                    {freeCats.map(cat => {
                      const colors = {'Ataque':GFC,'Golo':'#2e7d32','Defesa':RED,'Falta':'#b71c1c','Set piece':AMB,'Transição':PURP}
                      const c = colors[cat] || '#455a64'
                      return (
                        <button key={cat} onClick={() => {
                          const v = document.querySelector('video')
                          if (!v) return
                          v.pause()
                          const ts = v.currentTime
                          const clip = {
                            start: Math.max(0, ts - 5),
                            end:   Math.min(v.duration || ts+10, ts + 10),
                            minute: Math.floor(ts/60),
                            text: cat, duration: 15,
                            id: Date.now(), isManual: true,
                          }
                          setManualClips(prev => [...prev, clip])
                          setActiveClip(clip)
                        }} style={{ background:c, color:'#fff', border:'none', borderRadius:7, padding:'6px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                          + {cat}
                        </button>
                      )
                    })}
                    <button onClick={() => {
                      const cat = newCatInput.trim()
                      if (cat && !freeCats.includes(cat)) setFreeCats(prev => [...prev, cat])
                      setNewCatInput('')
                    }} style={{ background:'#f4f8fc', color:'#64748b', border:'1px dashed #bfd8ea', borderRadius:7, padding:'6px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Nova tag</button>
                  </div>
                  <input value={newCatInput} onChange={e=>setNewCatInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&newCatInput.trim()){setFreeCats(p=>[...p,newCatInput.trim()]);setNewCatInput('')}}}
                    placeholder="Nome da nova tag..." style={{ width:'100%', padding:'6px 10px', fontSize:10, borderRadius:7, border:'1px solid #e5edf5', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
                  <p style={{ fontSize:9, color:'#94a3b8', marginTop:5 }}>
                    💡 Use também os botões <strong>⏺ Início</strong> / <strong>⏹ Fim</strong> no player para recortes precisos.
                  </p>
                </div>
                {/* Manual clip list */}
                <div style={{ height:'calc(100vh - 480px)', overflowY:'auto', padding:'8px 12px' }}>
                  {manualClips.length===0
                    ? <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', padding:24 }}>Nenhum clip tagueado ainda.</p>
                    : <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                        {[...manualClips].sort((a,b)=>a.start-b.start).map(clip => (
                          <div key={clip.id} onClick={()=>setActiveClip(clip)}
                            style={{ borderRadius:8, border:`1.5px solid ${activeClip?.id===clip.id?PURP:'#e5edf5'}`,
                              background:activeClip?.id===clip.id?'#f3e8ff':'#fff', padding:'8px 12px', cursor:'pointer',
                              display:'flex', alignItems:'center', gap:10, transition:'all 0.15s' }}>
                            <div style={{ flexShrink:0, width:36, textAlign:'center' }}>
                              <p style={{ fontSize:14, fontWeight:900, color:PURP, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{Math.floor(clip.start/60)}'</p>
                              <p style={{ fontSize:9, color:'#94a3b8' }}>✂️</p>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:10, fontWeight:700, color:'#10233b' }}>{clip.text}</p>
                              <p style={{ fontSize:9, color:'#94a3b8', marginTop:1 }}>{fmtTs(Math.round(clip.start))} → {fmtTs(Math.round(clip.end))} · {Math.round(clip.end-clip.start)}s</p>
                            </div>
                            <button onClick={e=>{e.stopPropagation();deleteManualClip(clip.id)}}
                              style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#d0e0d8', flexShrink:0 }}>✕</button>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>
            )}

            {/* ── XML MODE: category filters + clip list ── */}
            {hasXml && (
              <>
                {rightTab==='clips' && (
                  <div style={{ padding:'8px 12px', borderBottom:'1px solid #f4f8fc', display:'flex', gap:4, flexWrap:'wrap' }}>
                    <div style={{ display:'flex', gap:3, width:'100%', marginBottom:4 }}>
                      {[['all','📋 Equipe',!!teamData],['player','⭐ Destaques ADC',!!playerData]].map(([k,l,enabled])=>(
                        <button key={k} onClick={()=>enabled&&(setTeamFilter(k),setCatFilter(null))} style={{ padding:'4px 10px', fontSize:9, fontWeight:700, borderRadius:6, fontFamily:'inherit', background:teamFilter===k?'#10233b':'#f4f8fc', color:teamFilter===k?'#fff':'#64748b', border:'none', cursor:enabled?'pointer':'not-allowed', opacity:enabled?1:0.5 }}>{l}</button>
                      ))}
                    </div>
                    {teamFilter!=='player' && allCategories.map(cat=>{
                      const c = TEAM_CATEGORIES.offensive.includes(cat)?GFC:TEAM_CATEGORIES.defensive.includes(cat)?RED:AMB
                      return (
                        <button key={cat} onClick={()=>setCatFilter(catFilter===cat?null:cat)} style={{ padding:'3px 8px', fontSize:9, fontWeight:700, borderRadius:6, fontFamily:'inherit', background:catFilter===cat?c:'#f4f8fc', color:catFilter===cat?'#fff':'#64748b', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:3, whiteSpace:'nowrap' }}>
                          {CAT_ICONS[cat]||'•'} {cat} ({allTeamClips.filter(e=>e.text===cat).length})
                        </button>
                      )
                    })}
                    {catFilter&&<button onClick={()=>setCatFilter(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:9, color:'#94a3b8' }}>✕</button>}
                  </div>
                )}
                <div style={{ height:'calc(100vh - 300px)', overflowY:'auto', padding:'8px 12px' }}>
                  {rightTab==='clips' && (
                    displayClips.length===0
                      ? <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', padding:24 }}>Nenhum clip nesta categoria.</p>
                      : <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                          {displayClips.map((clip,i)=>(
                            <ClipCard key={i} clip={clip} isActive={activeClip===clip}
                              onClick={()=>setActiveClip(clip)} showPlayer={showPlayer} />
                          ))}
                        </div>
                  )}
                  {rightTab==='ratings' && (
                    <RatingsPanel playerData={playerData} onSelectClip={setActiveClip} showPlayer={showPlayer} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
