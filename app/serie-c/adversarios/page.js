'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, Trash2, UploadCloud, Printer, ExternalLink } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import { useSerieCData } from '../_lib/useSerieCData'
import { EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import RelatorioAdversario from '../../components/serie-c/RelatorioAdversario'
import { extractOpponentTeamReport, extractOpponentTeamReportFromUrl } from '../../../lib/serieCOpponentPdf'

export default function AdversariosPage(){
  const {data,loading,error,reload}=useSerieCData()
  const [reports,setReports]=useState([])
  const [selectedId,setSelectedId]=useState(null)
  const [file,setFile]=useState(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState(null)
  const [guaraniLast10,setGuaraniLast10]=useState(null)

  const season=String(data?.upload?.season||new Date().getFullYear())
  const competition=data?.upload?.competition||'Brasileiro Série C'

  async function loadReports(){
    try{
      const r=await fetch(`/api/serie-c/opponents?season=${encodeURIComponent(season)}&competition=${encodeURIComponent(competition)}`,{cache:'no-store'})
      const j=await r.json(); if(!r.ok||j.error)throw new Error(j.error||'Falha ao carregar adversários.')
      setReports(j.reports||[])
      setSelectedId(cur=>cur||(j.reports?.[0]?.id||null))
    }catch(e){setStatus({type:'error',message:e.message})}
  }
  useEffect(()=>{if(data?.upload?.season)loadReports()},[data?.upload?.season,data?.upload?.competition])

  useEffect(()=>{
    if(!data?.upload?.season)return
    let cancelled=false
    ;(async()=>{
      try{
        const r=await fetch(`/api/serie-c/team-report?season=${encodeURIComponent(season)}&competition=${encodeURIComponent(competition)}`,{cache:'no-store'})
        const j=await r.json(); if(!j?.latest?.sourceUrl)return
        const parsed=await extractOpponentTeamReportFromUrl(j.latest.sourceUrl)
        if(!cancelled)setGuaraniLast10(parsed)
      }catch(_){ if(!cancelled)setGuaraniLast10(null) }
    })()
    return()=>{cancelled=true}
  },[data?.upload?.season,data?.upload?.competition])

  const selected=useMemo(()=>reports.find(r=>Number(r.id)===Number(selectedId))||reports[0]||null,[reports,selectedId])

  async function upload(){
    if(!file)return setStatus({type:'error',message:'Selecione o PDF Wyscout do adversário.'})
    setBusy(true);setStatus(null)
    try{
      const parsed=await extractOpponentTeamReport(file)
      if(!parsed?.team||parsed.team==='Adversário')throw new Error('Não consegui identificar o nome do adversário no PDF.')
      if((parsed.matches||[]).length<5)throw new Error('O PDF foi lido, mas não encontrei a lista das últimas partidas. Confirme se é o Relatório de Equipa Wyscout.')
      const fd=new FormData()
      fd.set('season',season);fd.set('competition',competition);fd.set('team',parsed.team);fd.set('parsedData',JSON.stringify(parsed));fd.set('file',file)
      const r=await fetch('/api/serie-c/opponents',{method:'POST',body:fd});const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||'Falha ao salvar adversário.')
      setStatus({type:'ok',message:`${parsed.team}: relatório das últimas ${parsed.summary?.played||10} partidas processado e salvo.`})
      setFile(null);await loadReports();setSelectedId(j.report?.id||null)
    }catch(e){setStatus({type:'error',message:e.message||'Falha ao processar o PDF.'})}finally{setBusy(false)}
  }

  async function reprocessSelected(){
    if(!selected?.sourceUrl)return
    setBusy(true);setStatus(null)
    try{
      const parsed=await extractOpponentTeamReportFromUrl(selected.sourceUrl)
      const r=await fetch('/api/serie-c/opponents',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,team:parsed.team||selected.team,parsedData:parsed})})
      const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||'Falha ao reprocessar adversário.')
      setStatus({type:'ok',message:`${selected.team}: PDF reprocessado com a leitura ampliada.`})
      await loadReports();setSelectedId(selected.id)
    }catch(e){setStatus({type:'error',message:e.message||'Falha ao reprocessar o PDF salvo.'})}finally{setBusy(false)}
  }

  async function remove(id,team){
    if(!window.confirm(`Excluir o relatório salvo de ${team}?`))return
    try{
      const r=await fetch('/api/serie-c/opponents',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const j=await r.json();if(!r.ok||j.error)throw new Error(j.error)
      setSelectedId(null);await loadReports()
    }catch(e){setStatus({type:'error',message:e.message||'Falha ao excluir.'})}
  }

  return <AppShell>
    <SerieCTabs/>
    <div className="space-y-5 p-4 md:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.24em] text-emerald-600">Scouting de adversário</p><h2 className="bc mt-1 text-3xl font-black text-gray-900">Adversários</h2><p className="mt-1 max-w-3xl text-xs text-gray-400">Envie o PDF Wyscout de equipe. O sistema organiza automaticamente as últimas 10 partidas, comportamento espacial, pontos fortes/fracos, estrutura, finalização, transições, benchmark contra o Confiança e destaques individuais usando a base de Jogadores Série C.</p></div>{selected?<Link href={`/serie-c/adversarios/relatorio/${selected.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white"><Printer className="h-4 w-4"/>Abrir para imprimir / PDF</Link>:null}</div>

      {loading&&<Loading/>}{!loading&&error&&<ErrorState message={error} onRetry={reload}/>} 
      {!loading&&!error&&<>
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UploadCloud className="h-4 w-4"/></span><div className="flex-1"><div className="text-[9px] font-black uppercase tracking-wider text-gray-700">Novo relatório de adversário</div><div className="mt-1 text-[9px] text-gray-400">Use o Relatório de Equipa Wyscout com as últimas 10 partidas. Não é necessário digitar as ações manualmente.</div></div></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="block w-full rounded-xl border border-gray-100 bg-gray-50 p-2 text-[10px] text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-[9px] file:font-black file:uppercase file:text-emerald-700"/><button onClick={upload} disabled={busy} className="rounded-xl bg-gray-900 px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-white disabled:opacity-50">{busy?<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Lendo PDF...</span>:'Processar adversário'}</button></div>{status?<div className={`mt-3 rounded-xl border px-3 py-2 text-[9px] font-bold ${status.type==='ok'?'border-emerald-100 bg-emerald-50 text-emerald-700':'border-rose-100 bg-rose-50 text-rose-600'}`}>{status.message}</div>:null}</section>

        {reports.length?<div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"><aside className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"><div className="flex items-center justify-between px-1 pb-2"><span className="text-[8px] font-black uppercase tracking-wider text-gray-400">Relatórios salvos</span><button onClick={loadReports} className="text-gray-400"><RefreshCw className="h-3.5 w-3.5"/></button></div>{reports.map(r=><button key={r.id} onClick={()=>setSelectedId(r.id)} className={`w-full rounded-xl border p-3 text-left ${Number(selected?.id)===Number(r.id)?'border-emerald-200 bg-emerald-50':'border-gray-100 bg-white hover:bg-gray-50'}`}><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-black text-gray-800">{r.team}</div><div className="mt-1 text-[7px] font-semibold text-gray-400">{r.parsedData?.summary?.played||10} jogos · leitura v{r.parsedData?.version||1} · {new Date(r.uploadedAt).toLocaleDateString('pt-BR')}</div></div><span onClick={e=>{e.stopPropagation();remove(r.id,r.team)}} className="rounded-lg p-1.5 text-gray-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5"/></span></div></button>)}</aside><main className="min-w-0">{selected?<div><div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2"><span className="text-[8px] font-bold text-gray-400">Pré-visualização · {selected.team}</span><div className="flex items-center gap-2"><button onClick={reprocessSelected} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[7px] font-black uppercase text-amber-700 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${busy?'animate-spin':''}`}/>Reprocessar PDF</button><a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-emerald-700">PDF original <ExternalLink className="h-3 w-3"/></a></div></div><div className="w-full overflow-x-auto pb-4"><div className="mx-auto min-w-[760px] max-w-[980px]"><RelatorioAdversario report={selected} data={data} guaraniLast10={guaraniLast10}/></div></div></div>:null}</main></div>:<EmptyState title="Nenhum adversário processado" description="Envie o primeiro PDF Wyscout acima para gerar o relatório automaticamente."/>}
      </>}
    </div>
  </AppShell>
}
