'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Sidebar from './Sidebar'
import OfflineBanner from '../ui/OfflineBanner'
import { Menu } from 'lucide-react'

const SAFE_METHODS=new Set(['GET','HEAD','OPTIONS'])
export default function AppShell({children}){
 const {data:session}=useSession(); const [open,setOpen]=useState(false); const [blocked,setBlocked]=useState(false); const [collapsed,setCollapsed]=useState(false)
 const readOnly=Boolean(session?.user?.readOnly)
 useEffect(()=>{
  if(!readOnly) return
  const original=window.fetch.bind(window)
  const guarded=async(input,init={})=>{
   const reqMethod=input instanceof Request?input.method:'GET'; const method=String(init.method||reqMethod||'GET').toUpperCase()
   const url=typeof input==='string'?input:input?.url||''; const path=new URL(url,window.location.origin).pathname
   if(!SAFE_METHODS.has(method)&&!path.startsWith('/api/auth')){setBlocked(true);return new Response(JSON.stringify({error:'Este perfil possui acesso somente para visualização.'}),{status:403,headers:{'Content-Type':'application/json'}})}
   return original(input,init)
  }
  window.fetch=guarded; return()=>{if(window.fetch===guarded)window.fetch=original}
 },[readOnly])
 return <div className="min-h-screen bg-[#f4f7fb]">
   <OfflineBanner/>
   {open&&<div className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-40 md:hidden" onClick={()=>setOpen(false)}/>}
   <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ${open?'translate-x-0':'-translate-x-full md:translate-x-0'}`}>
    <Sidebar onClose={()=>setOpen(false)} collapsed={collapsed} onCollapsedChange={setCollapsed}/>
   </div>
   <div className={`min-w-0 transition-[margin] duration-200 ${collapsed?'md:ml-[74px]':'md:ml-[270px]'}`}>
    <header className="md:hidden sticky top-0 z-30 h-14 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center px-4 gap-3"><button onClick={()=>setOpen(true)} className="w-9 h-9 rounded-xl border border-slate-200 grid place-items-center text-slate-600"><Menu size={18}/></button><img src="/confianca.png" alt="Confiança" className="w-8 h-8 object-contain"/><div><p className="text-[8px] font-black uppercase tracking-[.18em] text-[#0a66b7]">Confiança</p><p className="text-[10px] font-black">Centro de Inteligência</p></div></header>
    {readOnly&&<div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[9px] font-black uppercase tracking-widest text-amber-700">Diretoria · Modo de visualização</div>}
    <main className="min-h-screen min-w-0 overflow-x-hidden">{children}</main>
   </div>
   {blocked&&<div className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl"><p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Ação bloqueada</p><p className="text-xs text-slate-600 mt-1">Este perfil possui acesso somente para visualização.</p><button onClick={()=>setBlocked(false)} className="mt-3 text-[9px] font-black text-slate-500">Fechar</button></div>}
 </div>
}
