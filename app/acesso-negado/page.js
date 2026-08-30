'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { LockKeyhole, ArrowLeft } from 'lucide-react'
export default function AcessoNegado(){
 const sp=useSearchParams(); const mod=sp.get('module')==='scouting'?'Departamento de Mercado':'Corpo Técnico'
 return <main className="min-h-screen bg-[#071b36] text-white grid place-items-center p-6"><div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><img src="/confianca.png" alt="Confiança" className="w-20 h-20 mx-auto mb-6"/><div className="w-12 h-12 mx-auto rounded-2xl bg-sky-400/10 text-sky-300 grid place-items-center"><LockKeyhole/></div><h1 className="text-2xl font-black mt-5">Acesso restrito</h1><p className="text-sm text-slate-400 mt-2 leading-6">Seu perfil não possui permissão para acessar <strong className="text-white">{mod}</strong>.</p><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white text-[#071b36] px-5 py-3 text-xs font-black uppercase tracking-widest"><ArrowLeft size={15}/> Voltar à Home</Link></div></main>
}
