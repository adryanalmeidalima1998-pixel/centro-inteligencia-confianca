'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Activity, ArrowRight, LockKeyhole, ShieldCheck, Target } from 'lucide-react'

const modules=[
  {
    key:'corpo-tecnico',
    title:'Corpo Técnico',
    eyebrow:'Performance & Futebol',
    description:'Planejamento e registro das rotinas do futebol profissional: treino, GPS, fisiologia, departamento médico, elenco, programação e análise de competição.',
    href:'/corpo-tecnico',
    login:'/login?module=corpo-tecnico&callbackUrl=/corpo-tecnico',
    icon:Activity,
    stats:[['GPS','Catapult'],['Treino','Campo & GK'],['Saúde','DM'],['Elenco','Integrado']],
  },
  {
    key:'scouting',
    title:'Departamento de Mercado',
    eyebrow:'Scouting & Recrutamento',
    description:'Gestão dos processos de identificação, acompanhamento e avaliação de atletas e treinadores, ligas, relatórios, listas e recrutamento.',
    href:'/scouting',
    login:'/login?module=scouting&callbackUrl=/scouting',
    icon:Target,
    stats:[['Ligas','Base de dados'],['Scouting','Avaliação'],['Relatórios','Dossiês'],['Mercado','Recrutamento']],
  },
]

export default function Home(){
  const {data:session,status}=useSession()
  const allowed=session?.user?.modules || []

  return <main className="min-h-screen bg-[#071b36] text-white overflow-hidden relative">
    <div className="absolute inset-0 opacity-[0.045] bg-[radial-gradient(circle_at_15%_20%,#35b7ff_0,transparent_28%),radial-gradient(circle_at_85%_70%,#35b7ff_0,transparent_30%)]" />
    <img src="/confianca.png" alt="" className="pointer-events-none absolute -right-32 top-16 w-[650px] opacity-[0.055] rotate-[-8deg]" />

    <div className="relative max-w-7xl mx-auto px-6 py-7 lg:py-10">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-2xl shadow-sky-900/30">
            <img src="/confianca.png" className="w-full h-full object-contain" alt="Escudo do Confiança"/>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-sky-300">Associação Desportiva Confiança</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight">Centro de Inteligência</h1>
            <p className="text-xs text-slate-400 mt-1">Departamento de Futebol · Uso Interno</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-sky-200">
          <ShieldCheck size={14}/> Ambiente interno
        </div>
      </header>

      <section className="pt-9 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.30em] text-sky-300">Temporada 2026</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-[-0.035em]">Ambientes de trabalho</h2>
            <p className="mt-2 text-sm text-slate-400">Selecione o módulo correspondente à sua área de atuação.</p>
          </div>
          <div className="hidden lg:block text-right text-[10px] uppercase tracking-[0.16em] text-slate-500 leading-5">
            <p>Associação Desportiva Confiança</p>
            <p>Aracaju · Sergipe</p>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-5 pb-7">
        {modules.map((m,idx)=>{
          const Icon=m.icon
          const isAllowed=allowed.includes(m.key)
          const href=status==='authenticated' ? (isAllowed?m.href:'/acesso-negado?module='+m.key) : m.login
          return <Link key={m.key} href={href} className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.055] p-6 md:p-7 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-white/[0.075] hover:shadow-2xl hover:shadow-sky-950/30">
            <div className="absolute right-5 top-3 text-[68px] font-black text-white/[0.025]">0{idx+1}</div>
            <div className="flex items-start justify-between gap-5">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-400/20 flex items-center justify-center text-sky-300"><Icon size={24}/></div>
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">
                {status==='authenticated' ? (isAllowed?<><ShieldCheck size={13}/> Acesso liberado</>:<><LockKeyhole size={13}/> Restrito</>) : <><LockKeyhole size={13}/> Login necessário</>}
              </div>
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-sky-300">{m.eyebrow}</p>
            <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">{m.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400 min-h-[54px]">{m.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
              {m.stats.map(([a,b])=><div key={a} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2.5"><p className="text-[8px] uppercase font-black tracking-widest text-slate-500">{a}</p><p className="text-[10px] font-bold text-slate-200 mt-1">{b}</p></div>)}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Acessar ambiente</span>
              <span className="w-9 h-9 rounded-full bg-white text-[#071b36] flex items-center justify-center transition group-hover:translate-x-1"><ArrowRight size={17}/></span>
            </div>
          </Link>
        })}
      </section>

      <section className="border-t border-white/10 py-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
        <span>Temporada 2026</span>
        <span>Dados internos do Departamento de Futebol</span>
        <span>Acesso controlado por perfil</span>
      </section>
    </div>
  </main>
}
