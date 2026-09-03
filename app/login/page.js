'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

function LoginForm(){
 const router=useRouter(); const sp=useSearchParams(); const {data:session,status}=useSession()
 const moduleKey=sp.get('module')==='corpo-tecnico'?'corpo-tecnico':'scouting'
 const callback=sp.get('callbackUrl') || (moduleKey==='corpo-tecnico'?'/corpo-tecnico':'/scouting')
 const title=moduleKey==='corpo-tecnico'?'Corpo Técnico':'Departamento de Mercado'
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
 useEffect(()=>{
   if(status==='authenticated'&&session){
     const mods=session.user?.modules||[]
     router.replace(mods.includes(moduleKey)?callback:'/acesso-negado?module='+moduleKey)
   }
 },[status,session,moduleKey,callback,router])
 async function submit(e){e.preventDefault();setError('');setLoading(true);const r=await signIn('credentials',{email,password,redirect:false});setLoading(false);if(r?.error)setError('E-mail ou senha incorretos.')}
 return <main className="min-h-screen bg-[#071b36] text-white grid lg:grid-cols-[1.15fr_.85fr]">
  <section className="hidden lg:flex relative overflow-hidden p-12 flex-col justify-between border-r border-white/10">
   <img src="/confianca.png" alt="" className="absolute -right-40 top-10 w-[620px] opacity-[0.055]"/>
   <Link href="/" className="relative inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-slate-400 hover:text-white"><ArrowLeft size={15}/> Centro de Inteligência</Link>
   <div className="relative max-w-xl">
    <div className="w-20 h-20 rounded-2xl bg-white p-2 mb-7"><img src="/confianca.png" alt="Confiança"/></div>
    <p className="text-[10px] font-black uppercase tracking-[.35em] text-sky-300">Associação Desportiva Confiança</p>
    <h1 className="text-5xl font-black tracking-[-.04em] leading-[1] mt-3">Centro de<br/>Inteligência</h1>
    <p className="mt-5 text-sm leading-7 text-slate-400">Acesso seguro aos ambientes de performance, futebol, análise e recrutamento.</p>
   </div>
   <p className="relative text-[9px] uppercase tracking-[.2em] text-slate-600">Aracaju · Sergipe · Uso interno</p>
  </section>
  <section className="flex items-center justify-center p-6 md:p-10 bg-[#f5f8fc] text-slate-900">
   <div className="w-full max-w-md">
    <Link href="/" className="lg:hidden mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><ArrowLeft size={15}/> Voltar</Link>
    <div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 rounded-2xl bg-[#0a66b7] text-white grid place-items-center"><LockKeyhole size={22}/></div><div><p className="text-[9px] font-black uppercase tracking-[.25em] text-[#0a66b7]">Acesso ao módulo</p><h2 className="text-2xl font-black mt-1">{title}</h2></div></div>
    <form onSubmit={submit} className="rounded-[26px] bg-white border border-slate-200 shadow-xl shadow-slate-200/50 p-6 md:p-7 space-y-5">
     <div><label className="block text-[9px] font-black uppercase tracking-[.18em] text-slate-500 mb-2">E-mail institucional</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@adconfianca.com.br" required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"/></div>
     <div><label className="block text-[9px] font-black uppercase tracking-[.18em] text-slate-500 mb-2">Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"/></div>
     {error&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">{error}</div>}
     <button disabled={loading} className="w-full rounded-xl bg-[#0a66b7] hover:bg-[#07579e] disabled:opacity-60 text-white py-3.5 text-xs font-black uppercase tracking-[.18em] transition">{loading?'Validando acesso...':'Entrar'}</button>
    </form>
    <div className="flex items-center gap-2 mt-5 text-[10px] text-slate-500"><ShieldCheck size={14} className="text-[#0a66b7]"/> Permissões aplicadas de acordo com o perfil do usuário.</div>
   </div>
  </section>
 </main>
}
export default function LoginPage(){return <Suspense fallback={<div className="min-h-screen bg-[#071b36]"/>}><LoginForm/></Suspense>}
