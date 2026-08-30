'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSerieCData } from '../../../_lib/useSerieCData'
import RelatorioAdversario from '../../../../components/serie-c/RelatorioAdversario'
import { extractOpponentTeamReportFromUrl } from '../../../../../lib/serieCOpponentPdf'

export default function AdversarioPrintPage(){
  const routeParams=useParams()
  const id=routeParams?.id
  const router=useRouter()
  const {data,loading,error}=useSerieCData()
  const [report,setReport]=useState(null)
  const [guaraniLast10,setGuaraniLast10]=useState(null)
  const [reportError,setReportError]=useState(null)

  useEffect(()=>{
    fetch(`/api/serie-c/opponents?id=${encodeURIComponent(id)}`,{cache:'no-store'}).then(r=>r.json()).then(j=>{if(j.error)throw new Error(j.error);setReport(j.report)}).catch(e=>setReportError(e.message))
  },[id])
  useEffect(()=>{
    if(!data?.upload?.season)return
    let cancelled=false
    const season=data.upload.season,competition=data.upload.competition||'Brasileiro Série C'
    ;(async()=>{try{const r=await fetch(`/api/serie-c/team-report?season=${encodeURIComponent(season)}&competition=${encodeURIComponent(competition)}`,{cache:'no-store'});const j=await r.json();if(j?.latest?.sourceUrl){const p=await extractOpponentTeamReportFromUrl(j.latest.sourceUrl);if(!cancelled)setGuaraniLast10(p)}}catch(_){}})()
    return()=>{cancelled=true}
  },[data?.upload?.season,data?.upload?.competition])

  if(loading||!report)return <Msg>{reportError||error||'Carregando relatório do adversário…'}</Msg>
  return <div className="min-h-screen bg-gray-100">
    <style>{`
      @media print {
        html,body{margin:0!important;padding:0!important;background:white!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        .no-print{display:none!important}
        .print-area{width:190mm!important;max-width:190mm!important;margin:0 auto!important;padding:0!important}
        .opponent-report-document{display:block!important;width:190mm!important;max-width:190mm!important;margin:0!important}
        .opponent-report-document> :not([hidden])~:not([hidden]){margin-top:0!important}
        .opponent-report-page{width:190mm!important;min-height:277mm!important;box-sizing:border-box!important;padding:5mm!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;break-inside:avoid-page!important;page-break-inside:avoid!important}
        .opponent-report-page+.opponent-report-page{break-before:page!important;page-break-before:always!important}
        .opponent-report-page:last-child{page-break-after:auto!important}
        @page{size:A4 portrait;margin:10mm}
      }
    `}</style>
    <div className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur"><button onClick={()=>router.back()} className="text-xs font-bold text-gray-500">← Voltar</button><div className="flex items-center gap-3"><span className="text-[10px] font-bold text-gray-400">{report.team} · 7 páginas · A4</span><button onClick={()=>window.print()} className="rounded-xl bg-emerald-600 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white">Imprimir / Salvar PDF</button></div></div>
    <div className="print-area mx-auto w-full max-w-[900px] space-y-5 px-4 py-6"><RelatorioAdversario report={report} data={data} guaraniLast10={guaraniLast10}/></div>
  </div>
}
function Msg({children}){return <div className="grid min-h-screen place-items-center bg-gray-50 p-8 text-center text-sm font-bold text-gray-500">{children}</div>}
