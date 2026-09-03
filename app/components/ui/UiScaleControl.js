'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, Monitor } from 'lucide-react'

const MIN_SCALE=75
const MAX_SCALE=100
const STEP=5
const STORAGE_KEY='cic-ui-scale'

function initialScale(){
  if(typeof window==='undefined') return 100
  const saved=Number(localStorage.getItem(STORAGE_KEY))
  if(Number.isFinite(saved) && saved>=MIN_SCALE && saved<=MAX_SCALE) return saved
  if(window.innerWidth<=1280) return 85
  if(window.innerWidth<=1440) return 90
  return 100
}

export default function UiScaleControl(){
  const [scale,setScale]=useState(100)

  useEffect(()=>{
    const value=initialScale()
    setScale(value)
    document.documentElement.style.setProperty('--cic-ui-scale',String(value/100))
  },[])

  const apply=(next)=>{
    const value=Math.max(MIN_SCALE,Math.min(MAX_SCALE,next))
    setScale(value)
    localStorage.setItem(STORAGE_KEY,String(value))
    document.documentElement.style.setProperty('--cic-ui-scale',String(value/100))
  }

  return <div className="cic-scale-control" aria-label="Ajuste de escala da interface">
    <Monitor size={14} aria-hidden="true"/>
    <button type="button" onClick={()=>apply(scale-STEP)} disabled={scale<=MIN_SCALE} aria-label="Diminuir interface"><Minus size={14}/></button>
    <span>{scale}%</span>
    <button type="button" onClick={()=>apply(scale+STEP)} disabled={scale>=MAX_SCALE} aria-label="Aumentar interface"><Plus size={14}/></button>
  </div>
}
