'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Activity, BarChart3, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Database, FileBarChart,
  HeartPulse, Home, Images, LayoutDashboard, LogOut, Menu, Radar, Search, ShieldCheck, Target, Upload,
  UserRoundSearch, Users, X, GitBranch, ListChecks, Trophy, Dumbbell, Goal, Stethoscope, Gauge, ArrowLeftRight,
  Layers3, Eye, Star, FileText, BriefcaseBusiness, ChartNoAxesCombined, Crosshair, BellRing
} from 'lucide-react'

const CORPO_NAV=[
 {divider:'Operação'},
 {href:'/corpo-tecnico',label:'Visão Geral',sub:'Corpo Técnico',icon:LayoutDashboard,exact:true},
 {href:'/treino',label:'Treino',sub:'Campo & Goleiros',icon:Dumbbell},
 {href:'/treino/penaltis',label:'Pênaltis',sub:'Treino & jogo',icon:Goal},
 {href:'/banco-fisico-tatico',label:'Banco Físico-Tático',sub:'GPS × jogo',icon:Database},
 {href:'/fisiologia',label:'Fisiologia / GPS',sub:'Carga & performance',icon:Activity},
 {href:'/dm',label:'Departamento Médico',sub:'Saúde & RTP',icon:Stethoscope},
 {href:'/programacao',label:'Programação',sub:'Agenda de futebol',icon:CalendarDays},
 {href:'/corpo-tecnico/elenco',label:'Elenco',sub:'Plantel profissional',icon:Users},
 {href:'/fotos',label:'Fotos',sub:'Galeria do elenco',icon:Images},
 {divider:'Competição'},
 {href:'/serie-c',label:'Série C',sub:'Análise da competição',icon:BarChart3},
]

const SCOUTING_NAV=[
 {divider:'Inteligência de Mercado'},
 {href:'/scouting',label:'Decision Room',sub:'Painel executivo',icon:LayoutDashboard,exact:true},
 {href:'/ligas-v2',label:'Ligas',sub:'Wyscout + Sportsbase',icon:Trophy},
 {href:'/database',label:'Base de Atletas',sub:'Ranking & percentis',icon:Database},
 {href:'/sub20',label:'Sub-20',sub:'Talentos América do Sul',icon:Star},
 {href:'/evolucao-jogadores',label:'Evolução',sub:'Bimestres & semestres',icon:ChartNoAxesCombined},
 {href:'/shadows',label:'Times Shadow',sub:'Cenários de elenco',icon:Layers3},
 {divider:'Recrutamento'},
 {href:'/transferroom',label:'TransferRoom',sub:'Indicados × contratados',icon:ArrowLeftRight},
 {href:'/funil',label:'Funil',sub:'Pipeline de scouting',icon:GitBranch},
 {href:'/centro-recrutamento',label:'Recrutamento',sub:'Gestão de candidatos',icon:Crosshair},
 {href:'/recomendacoes',label:'Recomendações',sub:'Focos de mercado',icon:Target},
 {href:'/lista-preferencial',label:'Watchlist',sub:'Lista preferencial',icon:Star},
 {href:'/lista-final',label:'Lista Final',sub:'Decisão & relatórios',icon:ListChecks},
 {href:'/relatorios-jogadores',label:'Relatórios',sub:'Dossiês por posição',icon:FileText},
 {href:'/comparacao',label:'Comparação',sub:'Análise direta',icon:ArrowLeftRight},
 {href:'/avaliacao-atleta',label:'Avaliação iScout',sub:'Fit & benchmark',icon:Gauge},
 {divider:'Clube & Observação'},
 {href:'/elenco',label:'Elenco / Modelo',sub:'Snapshot competitivo',icon:Users},
 {href:'/agenda',label:'Agenda',sub:'Calendário de jogos',icon:CalendarDays},
 {href:'/observacao',label:'Observação',sub:'Scouts em campo',icon:Eye},
 {href:'/desempenho',label:'Desempenho',sub:'Análise de performance',icon:BarChart3},
 {href:'/monitoramento',label:'Monitoramento',sub:'Atletas monitorados',icon:Radar},
 {href:'/moneyball',label:'Eficiência de Mercado',sub:'Valor × desempenho',icon:ChartNoAxesCombined},
 {href:'/treinadores',label:'Treinadores',sub:'Banco & avaliação',icon:BriefcaseBusiness},
 {href:'/importar',label:'Importar',sub:'Upload de dados',icon:Upload},
]

const CORPO_PREFIXES=['/corpo-tecnico','/treino','/goleiros','/banco-fisico-tatico','/fisiologia','/dm','/programacao','/fotos','/serie-c']

export default function Sidebar({onClose}){
 const pathname=usePathname(); const {data:session}=useSession(); const [collapsed,setCollapsed]=useState(false)
 const isCorpo=CORPO_PREFIXES.some(p=>pathname===p||pathname.startsWith(p+'/'))
 const nav=isCorpo?CORPO_NAV:SCOUTING_NAV
 const modules=session?.user?.modules||[]; const canSwitch=modules.includes('corpo-tecnico')&&modules.includes('scouting')
 const role=session?.user?.role
 const isActive=(item)=>item.exact?pathname===item.href:(pathname===item.href||pathname.startsWith(item.href+'/'))
 return <aside className={`h-screen bg-[#06172e] text-white border-r border-white/8 flex flex-col transition-all duration-200 ${collapsed?'w-[74px]':'w-[270px]'}`}>
  <div className={`h-[76px] flex items-center ${collapsed?'justify-center px-2':'gap-3 px-4'} border-b border-white/8`}>
    <img src="/confianca.svg" alt="Confiança" className="w-11 h-11 object-contain shrink-0"/>
    {!collapsed&&<div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.22em] text-sky-300 truncate">Confiança</p><p className="text-[12px] font-black leading-tight mt-1 truncate">Centro de Inteligência</p></div>}
    {!collapsed&&onClose&&<button onClick={onClose} className="md:hidden ml-auto text-slate-400"><X size={18}/></button>}
  </div>

  {!collapsed&&<div className="px-3 pt-3">
    <Link href="/" className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-[9px] font-black uppercase tracking-[.13em] text-slate-300 hover:bg-white/[0.07]"><Home size={14} className="text-sky-400"/> Centro de Inteligência</Link>
    <div className="mt-2 rounded-xl bg-sky-400/10 border border-sky-400/15 px-3 py-2.5"><p className="text-[8px] font-black uppercase tracking-[.18em] text-sky-300">Ambiente atual</p><p className="text-[11px] font-black mt-1">{isCorpo?'Corpo Técnico':'Departamento de Mercado'}</p></div>
    {canSwitch&&<Link href={isCorpo?'/scouting':'/corpo-tecnico'} className="mt-2 flex items-center gap-2 px-3 py-2 text-[9px] font-bold text-slate-400 hover:text-white"><ArrowLeftRight size={13}/> Alternar para {isCorpo?'Mercado':'Corpo Técnico'}</Link>}
  </div>}

  <nav className="flex-1 overflow-y-auto px-2 py-3 scout-scroll">
   {nav.map((item,i)=>item.divider?(!collapsed&&<p key={'d'+i} className="px-3 pt-4 pb-2 text-[8px] font-black uppercase tracking-[.25em] text-slate-600">{item.divider}</p>):(()=>{const Icon=item.icon;const active=isActive(item);return <Link key={item.href} href={item.href} onClick={onClose} title={collapsed?item.label:undefined} className={`group flex items-center ${collapsed?'justify-center':'gap-3'} rounded-xl px-3 py-2.5 mb-0.5 border transition ${active?'bg-sky-500/13 border-sky-400/20 text-white':'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.045]'}`}><Icon size={17} className={`shrink-0 ${active?'text-sky-300':'text-slate-500 group-hover:text-slate-300'}`}/>{!collapsed&&<div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.12em] truncate">{item.label}</p><p className="text-[8px] text-slate-600 group-hover:text-slate-500 mt-0.5 truncate">{item.sub}</p></div>}</Link>})())}
  </nav>

  <div className="border-t border-white/8 p-2">
   {!collapsed&&session&&<div className="px-3 py-2 mb-1"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-sky-500/15 grid place-items-center text-sky-300"><ShieldCheck size={14}/></div><div className="min-w-0"><p className="text-[9px] font-black truncate">{session.user?.name}</p><p className="text-[7px] uppercase tracking-widest text-slate-600">{role==='admin'?'Administrador':role==='diretoria'?'Diretoria':role==='scouting'?'Mercado':'Corpo Técnico'}</p></div></div></div>}
   <div className="flex gap-1">
    <button onClick={()=>setCollapsed(v=>!v)} className="hidden md:flex flex-1 items-center justify-center rounded-xl py-2.5 text-slate-500 hover:bg-white/5 hover:text-white">{collapsed?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button>
    <button onClick={()=>signOut({callbackUrl:'/'})} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300" title="Sair"><LogOut size={15}/>{!collapsed&&<span className="text-[8px] font-black uppercase tracking-widest">Sair</span>}</button>
   </div>
  </div>
 </aside>
}
