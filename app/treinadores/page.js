'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BriefcaseBusiness, ExternalLink, FileUp, Link2, Plus, RefreshCw, Search, ShieldCheck, Star, Trash2, TrendingUp, Users } from 'lucide-react'
import AppShell from '../components/layout/AppShell'

const REC = {
  'Recomendado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Com Ressalvas': 'bg-amber-50 text-amber-700 border-amber-200',
  'Não Recomendado': 'bg-red-50 text-red-700 border-red-200',
  'Em análise': 'bg-sky-50 text-sky-700 border-sky-200'
}

function Stars({value=0}) { return <div className="flex gap-0.5">{[1,2,3,4,5].map(n=><Star key={n} size={13} className={n<=value?'fill-amber-400 text-amber-400':'text-slate-200'}/>)}</div> }

function CoachCard({coach,onDelete,onOpen}) {
  const metrics = coach.metricas_json || {}
  const report = coach.relatorio_json || {}
  const rec = coach.recomendacao || report.recomendacao || 'Em análise'
  return <article onClick={onOpen} className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
    <div className="h-1.5 bg-gradient-to-r from-[#0a66b7] via-sky-400 to-[#0a66b7]"/>
    <div className="p-5">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shrink-0">
          {coach.foto_url ? <img src={coach.foto_url} alt={coach.nome} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center bg-[#eef6fd] font-black text-[#0a66b7]">{(coach.nome||'?')[0]}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><h3 className="truncate text-base font-black text-[#06172e]">{coach.nome}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{coach.clube_atual || 'Sem clube'} · {coach.nacionalidade || '—'}</p></div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${REC[rec]||REC['Em análise']}`}>{rec}</span>
          </div>
          <div className="mt-2"><Stars value={coach.estrelas||0}/></div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Jogos</p><p className="mt-1 text-lg font-black text-[#06172e]">{metrics.jogos_carreira || metrics.jogos_detalhados || 0}</p></div>
        <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">PPJ</p><p className="mt-1 text-lg font-black text-[#06172e]">{Number(metrics.ppj_carreira||metrics.ppj_detalhado||0).toFixed(2)}</p></div>
        <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Formação</p><p className="mt-1 truncate text-sm font-black text-[#06172e]">{coach.formacao_preferida || '—'}</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[10px] font-bold text-[#0a66b7]">Abrir dossiê completo →</span>
        <div className="flex items-center gap-1">
          {coach.transfermarkt_url && <a onClick={e=>e.stopPropagation()} href={coach.transfermarkt_url} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-[#0a66b7]" title="Transfermarkt"><ExternalLink size={14}/></a>}
          <button onClick={e=>{e.stopPropagation();onDelete(coach.id)}} className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 size={14}/></button>
        </div>
      </div>
    </div>
  </article>
}

function LegacyUpload({onDone}) {
  const ref = useRef(null); const [files,setFiles]=useState([]); const [loading,setLoading]=useState(false); const [msg,setMsg]=useState('')
  const toBase64=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file)})
  async function send(){
    if(!files.length)return;setLoading(true);setMsg('')
    try{
      for(const file of files){
        const base64=await toBase64(file)
        const er=await fetch('/api/ai/extract-treinador',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pdf_base64:base64})});const ej=await er.json();if(!er.ok||!ej.success)throw new Error(ej.error||'Falha ao processar PDF')
        const fd=new FormData();fd.append('file',file);fd.append('extracted_data',JSON.stringify(ej.data));const sr=await fetch('/api/treinadores',{method:'POST',body:fd});const sj=await sr.json();if(!sr.ok)throw new Error(sj.error||'Erro ao salvar')
      }
      setMsg('Relatório legado importado.');setFiles([]);onDone?.()
    }catch(e){setMsg(e.message)}finally{setLoading(false)}
  }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2"><FileUp size={16} className="text-[#0a66b7]"/><div><p className="text-xs font-black text-[#06172e]">Importar relatório legado</p><p className="text-[10px] text-slate-400">Mantém compatibilidade com os PDFs já produzidos.</p></div></div>
    <div className="mt-3 flex gap-2"><button onClick={()=>ref.current?.click()} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Selecionar PDF</button><button onClick={send} disabled={!files.length||loading} className="rounded-xl bg-[#06172e] px-4 py-2 text-xs font-black text-white disabled:opacity-40">{loading?'Processando...':'Importar'}</button></div>
    <input ref={ref} type="file" accept=".pdf" multiple className="hidden" onChange={e=>setFiles([...e.target.files])}/>
    {!!files.length&&<p className="mt-2 text-[10px] text-slate-500">{files.map(f=>f.name).join(' · ')}</p>}{msg&&<p className="mt-2 text-[10px] font-semibold text-slate-600">{msg}</p>}
  </div>
}

export default function TreinadoresPage(){
  const router=useRouter(); const {data:session}=useSession(); const canEdit=!['diretoria','comissao'].includes(session?.user?.role)
  const [coaches,setCoaches]=useState([]); const [loading,setLoading]=useState(true); const [url,setUrl]=useState(''); const [importing,setImporting]=useState(false); const [error,setError]=useState(''); const [query,setQuery]=useState(''); const [filter,setFilter]=useState('Todos')
  const load=async()=>{setLoading(true);try{const r=await fetch('/api/treinadores',{cache:'no-store'});const d=await r.json();setCoaches(d.coaches||[])}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  async function importTM(){
    if(!url.trim())return;setImporting(true);setError('')
    try{const r=await fetch('/api/treinadores/import-transfermarkt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.trim()})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha ao importar');setUrl('');await load();router.push(`/treinadores/${d.id}`)}catch(e){setError(e.message)}finally{setImporting(false)}
  }
  async function remove(id){if(!confirm('Excluir este treinador e o dossiê salvo?'))return;await fetch(`/api/treinadores/${id}`,{method:'DELETE'});load()}
  const filtered=useMemo(()=>coaches.filter(c=>{const text=`${c.nome} ${c.clube_atual} ${c.nacionalidade}`.toLowerCase();const okQ=text.includes(query.toLowerCase());const rec=c.recomendacao||c.relatorio_json?.recomendacao||'Em análise';return okQ&&(filter==='Todos'||filter===rec)}),[coaches,query,filter])
  const counts={all:coaches.length,done:coaches.filter(c=>['Recomendado','Com Ressalvas','Não Recomendado'].includes(c.recomendacao)).length,tm:coaches.filter(c=>c.transfermarkt_url).length}

  return <AppShell><main className="mx-auto max-w-[1320px] p-6 lg:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.22em] text-[#0a66b7]"><BriefcaseBusiness size={14}/> CIC · Scouting de Treinadores</div><h1 className="mt-2 text-3xl font-black tracking-tight text-[#06172e] lg:text-4xl">Treinadores</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Banco técnico para identificação, histórico, análise de modelo de jogo e decisão de contratação.</p></div>
      <div className="flex gap-2"><button onClick={load} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-[#0a66b7]"><RefreshCw size={16}/></button></div>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><Users size={17} className="text-[#0a66b7]"/><span className="text-2xl font-black text-[#06172e]">{counts.all}</span></div><p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Treinadores catalogados</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><Link2 size={17} className="text-[#0a66b7]"/><span className="text-2xl font-black text-[#06172e]">{counts.tm}</span></div><p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Com base Transfermarkt</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><ShieldCheck size={17} className="text-emerald-600"/><span className="text-2xl font-black text-[#06172e]">{counts.done}</span></div><p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Pareceres concluídos</p></div>
    </div>

    {canEdit&&<section className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="relative overflow-hidden rounded-2xl bg-[#06172e] p-5 text-white shadow-sm">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-sky-400/10"/><div className="relative"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-400/15 text-sky-300"><Link2 size={17}/></div><div><p className="text-xs font-black">Importar treinador pelo Transfermarkt</p><p className="text-[10px] text-slate-400">Cole a URL do perfil. Carreira, jogos, PPJ e formações são atualizados automaticamente.</p></div></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&importTM()} placeholder="https://www.transfermarkt.com.br/.../profil/trainer/69206" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60"/><button onClick={importTM} disabled={importing||!url.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-[#0a66b7] px-5 py-3 text-xs font-black text-white hover:bg-[#0b74c9] disabled:opacity-40">{importing?<><RefreshCw size={14} className="animate-spin"/>Lendo dados...</>:<><Plus size={14}/>Criar dossiê</>}</button></div>
          {error&&<div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-200">{error}</div>}
          <p className="mt-3 text-[9px] leading-relaxed text-slate-500">A importação faz uma leitura pontual das páginas públicas informadas. Se o site bloquear a requisição, o dossiê continua podendo ser preenchido manualmente ou importado por relatório legado.</p>
        </div>
      </div>
      <LegacyUpload onDone={load}/>
    </section>}

    <section className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-md flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar treinador, clube ou país..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#0a66b7]"/></div><div className="flex flex-wrap gap-1.5">{['Todos','Em análise','Recomendado','Com Ressalvas','Não Recomendado'].map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded-lg px-3 py-2 text-[10px] font-black ${filter===f?'bg-[#06172e] text-white':'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{f}</button>)}</div></div>
      {loading?<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(x=><div key={x} className="h-56 animate-pulse rounded-2xl bg-white border border-slate-200"/>)}</div>:filtered.length?<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(c=><CoachCard key={c.id} coach={c} onDelete={remove} onOpen={()=>router.push(`/treinadores/${c.id}`)}/>)}</div>:<div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><TrendingUp className="mx-auto text-slate-300"/><p className="mt-3 text-sm font-black text-slate-600">Nenhum treinador neste filtro</p><p className="mt-1 text-xs text-slate-400">Importe um perfil do Transfermarkt ou um relatório já produzido.</p></div>}
    </section>
  </main></AppShell>
}
