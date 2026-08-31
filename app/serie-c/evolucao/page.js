'use client'
import { useCallback, useEffect, useState } from 'react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import { Loading, ErrorState } from '../../components/serie-c/ui'
import MatchEvolutionDashboard from '../../components/serie-c/MatchEvolutionDashboard'

export default function EvolucaoInternaPage() {
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true); setError(null)
    try {
      const r=await fetch('/api/serie-c/internal-comparison',{cache:'no-store'})
      const d=await r.json()
      if(!r.ok||d?.error) throw new Error(d?.error||'Falha ao carregar evolução partida por partida.')
      setData(d)
    } catch(e){ setError(e?.message||'Falha ao carregar evolução interna.') }
    finally { setLoading(false) }
  },[])

  useEffect(()=>{ load() },[load])

  return <AppShell>
    <style>{`
      @media print {
        .no-print { display:none !important; }
        aside, nav { display:none !important; }
        main { margin:0 !important; width:100% !important; }
        body { background:white !important; }
        section { break-inside:avoid; page-break-inside:avoid; }
        @page { size:A4 landscape; margin:8mm; }
      }
    `}</style>
    <SerieCTabs/>
    <div className="px-4 py-6 md:px-8">
      {loading?<Loading/>:error?<ErrorState message={error}/>:<MatchEvolutionDashboard data={data}/>} 
    </div>
  </AppShell>
}
