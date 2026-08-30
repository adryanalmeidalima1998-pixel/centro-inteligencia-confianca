'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Activity, ArrowRight, BarChart3, Database, LockKeyhole, ShieldCheck, Users, Target, Layers3, LineChart } from 'lucide-react'

const modules=[
  {
    key:'corpo-tecnico', title:'Corpo Técnico', eyebrow:'Performance & Futebol',
    description:'Planejamento, treino, GPS, fisiologia, departamento médico, elenco, programação, análise da Série C e banco físico-tático.',
    href:'/corpo-tecnico', login:'/login?module=corpo-tecnico&callbackUrl=/corpo-tecnico',
    icon:Activity,
    stats:[['GPS','Catapult'],['Treino','Campo & GK'],['Saúde','DM'],['Elenco','Integrado']],
  },
  {
    key:'scouting', title:'Departamento de Mercado', eyebrow:'Scouting & Recrutamento',
    description:'Ligas, banco de atletas, Wyscout/Sportsbase, observação, funil, watchlist, comparação, relatórios e inteligência de mercado.',
    href:'/scouting', login:'/login?module=scouting&callbackUrl=/scouting',
    icon:Target,
    stats:[['Ligas','Base viva'],['Scouting','Pipeline'],['Dados','Wyscout'],['Mercado','Decisão']],
  },
]

export default function Home(){
  const {data:session,status}=useSession()
  const allowed=session?.user?.modules || []
  return <main className="min-h-screen bg-[#071b36] text-white overflow-hidden relative">
    <div className="absolute inset-0 opacity-[0.045] bg-[radial-gradient(circle_at_15%_20%,#35b7ff_0,transparent_28%),radial-gradient(circle_at_85%_70%,#35b7ff_0,transparent_30%)]" />
    <img src="/confianca.svg" alt="" className="pointer-events-none absolute -right-32 top-16 w-[650px] opacity-[0.055] rotate-[-8deg]" />
    <div className="relative max-w-7xl mx-auto px-6 py-8 lg:py-12">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-7">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-2xl shadow-sky-900/30"><img src="/confianca.svg" className="w-full h-full object-contain" alt="Escudo do Confiança"/></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-sky-300">Associação Desportiva Confiança</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight">Centro de Inteligência</h1>
            <p className="text-xs text-slate-400 mt-1">Futebol · Performance · Scouting · Dados</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-sky-200">
          <ShieldCheck size={14}/> Ambiente interno
        </div>
      </header>

      <section className="pt-12 pb-8 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-slate-300"><Layers3 size={13}/> Plataforma integrada 2026</div>
        <h2 className="mt-5 text-4xl md:text-6xl font-black leading-[0.98] tracking-[-0.045em]">Informação organizada.<br/><span className="text-sky-400">Decisão mais rápida.</span></h2>
        <p className="mt-5 text-sm md:text-base leading-7 text-slate-400 max-w-2xl">Um único ambiente para conectar o trabalho diário do campo, performance e saúde com o processo de identificação, avaliação e recrutamento de atletas.</p>
      </section>

      <section className="grid lg:grid-cols-2 gap-5 pb-8">
        {modules.map((m,idx)=>{
          const Icon=m.icon
          const isAllowed=allowed.includes(m.key)
          const href=status==='authenticated' ? (isAllowed?m.href:'/acesso-negado?module='+m.key) : m.login
          return <Link key={m.key} href={href} className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] p-6 md:p-8 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-sky-400/40 hover:bg-white/[0.075] hover:shadow-2xl hover:shadow-sky-950/30">
            <div className="absolute right-5 top-5 text-[72px] font-black text-white/[0.025]">0{idx+1}</div>
            <div className="flex items-start justify-between gap-5">
              <div className="w-13 h-13 rounded-2xl bg-sky-500/15 border border-sky-400/20 flex items-center justify-center text-sky-300"><Icon size={26}/></div>
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">{status==='authenticated' ? (isAllowed?<><ShieldCheck size={13}/> Acesso liberado</>:<><LockKeyhole size={13}/> Restrito</>) : <><LockKeyhole size={13}/> Login necessário</>}</div>
            </div>
            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.28em] text-sky-300">{m.eyebrow}</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight">{m.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400 min-h-[72px]">{m.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">{m.stats.map(([a,b])=><div key={a} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2.5"><p className="text-[8px] uppercase font-black tracking-widest text-slate-500">{a}</p><p className="text-[10px] font-bold text-slate-200 mt-1">{b}</p></div>)}</div>
            <div className="mt-7 flex items-center justify-between border-t border-white/8 pt-5"><span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Acessar ambiente</span><span className="w-9 h-9 rounded-full bg-white text-[#071b36] flex items-center justify-center transition group-hover:translate-x-1"><ArrowRight size={17}/></span></div>
          </Link>
        })}
      </section>

      <section className="grid md:grid-cols-3 gap-3 border-t border-white/10 pt-6">
        {[ [Database,'Base única','Dados de performance e mercado organizados por processo.'],[BarChart3,'Análise integrada','Indicadores, rankings, relatórios e comparações em um mesmo ecossistema.'],[Users,'Acesso por função','Cada profissional visualiza apenas os módulos liberados para seu perfil.'] ].map(([Icon,t,d])=><div key={t} className="flex gap-3 p-4 rounded-2xl bg-white/[0.025]"><Icon className="text-sky-400 shrink-0" size={18}/><div><p className="text-xs font-black">{t}</p><p className="text-[10px] text-slate-500 mt-1 leading-4">{d}</p></div></div>)}
      </section>
      <footer className="mt-10 flex flex-wrap justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600"><span>Confiança · Aracaju/SE · 1936</span><span>Centro de Inteligência · Uso interno</span></footer>
    </div>
  </main>
}
