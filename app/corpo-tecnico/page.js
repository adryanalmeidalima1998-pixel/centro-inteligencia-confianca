'use client'
import { useState, useEffect } from 'react'
import AppShell from '../components/layout/AppShell'
import Link from 'next/link'

const STYLE = `
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .dm { font-family: 'DM Sans', sans-serif; }
`

const MODULES = [
  {
    href: '/treino',
    label: 'TREINO',
    sub: 'Programação de Campo',
    icon: '⚽',
    color: 'green',
    desc: 'PDF do treino do dia, cargas e metodologia de trabalho.',
  },

  {
    href: '/banco-fisico-tatico',
    label: 'BANCO FÍSICO-TÁTICO',
    sub: 'GPS × Contexto de Jogo',
    icon: '🧠',
    color: 'blue',
    desc: 'Integra dados físicos e táticos por partida para contextualizar a carga e o desempenho.',
  },
  {
    href: '/goleiros',
    label: 'PREP. GOLEIROS',
    sub: 'Treinamento Específico',
    icon: '🧤',
    color: 'blue',
    desc: 'PDF de preparação específica para os goleiros.',
  },
  {
    href: '/fisiologia',
    label: 'FISIOLOGIA',
    sub: 'GPS, Bem-Estar & PSE',
    icon: '📊',
    color: 'purple',
    desc: 'Dados Catapult, bem-estar pré-treino e esforço subjetivo pós-treino.',
  },
  {
    href: '/dm',
    label: 'DEPT. MÉDICO',
    sub: 'Lesões & Tratamentos',
    icon: '🏥',
    color: 'red',
    desc: 'Relatório diário de lesionados, estágio de tratamento e retorno previsto.',
  },
  {
    href: '/programacao',
    label: 'PROGRAMAÇÃO',
    sub: 'Agenda Diária & Semanal',
    icon: '📅',
    color: 'orange',
    desc: 'Calendário semanal e programação detalhada do dia.',
  },
  {
    href: '/corpo-tecnico/elenco',
    label: 'ELENCO',
    sub: 'Plantel 2026',
    icon: '👥',
    color: 'teal',
    desc: 'Cards dos jogadores por posição com dados integrados.',
  },
  {
    href: '/fotos',
    label: 'FOTOS',
    sub: 'Banco de Imagens',
    icon: '📷',
    color: 'blue',
    desc: 'Gerenciamento das fotos utilizadas nos cards, relatórios e páginas individuais.',
  },
  {
    href: '/serie-c',
    label: 'SÉRIE C 2026',
    sub: 'Base Histórica',
    icon: '🏆',
    color: 'blue',
    desc: 'Campanha, partidas, adversários, relatórios coletivos e individuais da temporada 2026.',
  },
]

const COLOR_MAP = {
  green:  { border: 'border-sky-200',  bg: 'hover:bg-sky-50',  badge: 'bg-sky-100 text-sky-700',  dot: 'bg-sky-500',  hover: 'hover:border-sky-300' },
  blue:   { border: 'border-blue-200',   bg: 'hover:bg-blue-50',   badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',   hover: 'hover:border-blue-300' },
  purple: { border: 'border-purple-200', bg: 'hover:bg-purple-50', badge: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500', hover: 'hover:border-purple-300' },
  red:    { border: 'border-red-200',    bg: 'hover:bg-red-50',    badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    hover: 'hover:border-red-300' },
  orange: { border: 'border-orange-200', bg: 'hover:bg-orange-50', badge: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500', hover: 'hover:border-orange-300' },
  teal:   { border: 'border-teal-200',   bg: 'hover:bg-teal-50',   badge: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-500',   hover: 'hover:border-teal-300' },
}

export default function Home() {
  // ✅ FIX: new Date() no render causa hydration mismatch (servidor=UTC, cliente=BR)
  //         Inicializar vazio e preencher só no cliente via useEffect
  const [today, setToday] = useState('')
  useEffect(() => {
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))
  }, [])

  return (
    <AppShell>
      <style>{STYLE}</style>
      <div className="dm p-8 max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-400">{today}</p>
          </div>
          <h1 className="bc text-4xl font-black uppercase text-gray-900 leading-none">
            Corpo Técnico · Confiança
          </h1>
          <p className="text-sm text-gray-400 mt-1">Temporada 2026 — Sistema Integrado de Desempenho</p>
        </div>

        {/* SEASON BADGE */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-2xl p-6 mb-8 shadow-lg shadow-sky-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="bc text-[10px] font-black uppercase tracking-[0.4em] text-sky-200 mb-1">Temporada Ativa</p>
              <p className="bc text-3xl font-black uppercase text-white">CONFIANÇA · 2026</p>
              <p className="text-sm text-sky-200 mt-1">Temporada 2026 · Departamento de Futebol</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
              <img src="/confianca.png" alt="Confiança" className="w-12 h-12 object-contain"
                onError={e => { e.target.style.display = 'none' }} />
            </div>
          </div>
        </div>

        {/* MODULES GRID */}
        <div className="mb-6">
          <p className="bc text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4">Módulos do Sistema</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map(mod => {
              const c = COLOR_MAP[mod.color]
              return (
                <Link key={mod.href} href={mod.href}
                  className={`group bg-white border ${c.border} ${c.hover} ${c.bg} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{mod.icon}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${c.badge}`}>
                      {mod.sub}
                    </span>
                  </div>
                  <p className="bc text-xl font-black uppercase text-gray-900 leading-none mb-1">{mod.label}</p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">{mod.desc}</p>
                  <div className="flex items-center gap-1 mt-4">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Acessar módulo</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 pt-6 flex items-center justify-between">
          <p className="text-[9px] text-gray-300 uppercase tracking-widest">Confiança · Corpo Técnico 2026</p>
          <p className="text-[9px] text-gray-300 uppercase tracking-widest">Sistema Interno · Uso Restrito</p>
        </div>
      </div>
    </AppShell>
  )
}
