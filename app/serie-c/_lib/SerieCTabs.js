// app/serie-c/_lib/SerieCTabs.js
// Sub-navegação da área "Série C | Estatísticas" (abas dentro da seção),
// no mesmo padrão visual do resto do dashboard.
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/serie-c', label: 'Confiança' },
  { href: '/serie-c/coleta-ao-vivo', label: 'Coleta ao Vivo' },
  { href: '/serie-c/partidas', label: 'Partidas' },
  { href: '/serie-c/classificacao', label: 'Classificação' },
  { href: '/serie-c/elenco', label: 'Elenco Confiança' },
  { href: '/serie-c/relatorios', label: 'Relatórios' },
  { href: '/serie-c/evolucao', label: 'Evolução Interna' },
  { href: '/serie-c/adversarios', label: 'Adversários' },
  { href: '/serie-c/times', label: 'Times Série C' },
  { href: '/serie-c/jogadores', label: 'Jogadores Série C' },
  { href: '/serie-c/goleiros', label: 'Goleiros Série C' },
  { href: '/serie-c/lideres', label: 'Líderes FM' },
  { href: '/serie-c/upload', label: 'Upload Semanal' },
]

export default function SerieCTabs() {
  const pathname = usePathname()
  return (
    <div className="border-b border-gray-100 bg-white sticky top-0 z-20">
      <div className="px-4 md:px-8 pt-4">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300">Série C</p>
        <h1 className="bc text-2xl font-black text-gray-800 leading-none mt-0.5 mb-3">Estatísticas</h1>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 md:px-8 pb-2 no-scrollbar">
        {TABS.map(tab => {
          const active = tab.href === '/serie-c' ? pathname === '/serie-c' : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-shrink-0 px-3 py-1.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors
                ${active ? 'border-sky-500 text-sky-700 bg-sky-50' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
