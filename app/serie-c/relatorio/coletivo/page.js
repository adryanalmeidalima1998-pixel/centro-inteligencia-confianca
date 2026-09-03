'use client'
import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSerieCData } from '../../_lib/useSerieCData'
import { useGpsFisico } from '../../_lib/useGpsFisico'
import RelatorioColetivo from '../../../components/serie-c/RelatorioColetivo'
import { physicalReport } from '../../../../lib/serieCReport'

export default function ColetivoPrintPage() {
  const router = useRouter()
  const { data, loading, error } = useSerieCData()
  const gps = useGpsFisico({ matchOnly:true })
  const [golsLado, setGolsLado] = useState(null)
  const [teamReport, setTeamReport] = useState(null)

  useEffect(() => {
    fetch('/api/serie-c/gols-lado').then(r => r.json()).then(d => setGolsLado(d?.registro || null)).catch(() => {})
    fetch('/api/serie-c/team-report').then(r => r.json()).then(d => setTeamReport(d?.latest || null)).catch(() => {})
  }, [])

  const excluded = useMemo(() => new Set(data?.reportExcludedPlayers || []), [data?.reportExcludedPlayers])
  const teams = data?.teams || []
  const squad = useMemo(() => [
    ...(data?.players || []).filter(p => p.is_club && !excluded.has(p.player)),
    ...(data?.goalkeepers || []).filter(p => p.is_club && !excluded.has(p.player)).map(p => ({ ...p, position:'GK', isGoalkeeper:true })),
  ], [data, excluded])
  const physical = useMemo(() => physicalReport(gps.aggregateSquad(squad.map(p => p.player))), [squad, gps.sessions, gps.aliases])

  if (loading) return <Msg>Carregando dados da Série C…</Msg>
  if (error) return <Msg>Erro ao carregar: {String(error)}</Msg>

  return <div className="bg-gray-100 min-h-screen">
    <style>{`
      @media print {
        html, body { margin:0 !important; padding:0 !important; background:white !important; }
        body { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
        .no-print { display:none !important; }
        .print-area { position:static !important; width:202mm !important; padding:0 !important; margin:0 auto !important; background:white !important; }
        .coletivo-document { display:block !important; width:202mm !important; margin:0 !important; padding:0 !important; }
        .coletivo-document > :not([hidden]) ~ :not([hidden]) { margin-top:0 !important; }
        .coletivo-page {
          width:202mm !important; max-width:202mm !important; height:289mm !important; min-height:289mm !important;
          box-sizing:border-box !important; padding:6mm !important; margin:0 !important;
          border:0 !important; border-radius:0 !important; box-shadow:none !important; overflow:hidden !important;
          break-inside:avoid-page !important; page-break-inside:avoid !important;
        }
        .coletivo-page + .coletivo-page { break-before:page !important; page-break-before:always !important; }
        .coletivo-page .report-footer { margin-top:auto !important; }
        @page { size:A4 portrait; margin:4mm; }
      }
    `}</style>

    <div className="no-print sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur px-4 py-3 border-b border-gray-200">
      <button onClick={() => router.back()} className="text-xs font-bold text-gray-500 hover:text-gray-800">← Voltar</button>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold text-gray-400">Relatório coletivo · 5 páginas · A4 retrato · área segura de impressão</span>
        <button onClick={() => window.print()} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700">Imprimir / Salvar PDF</button>
      </div>
    </div>

    <div className="print-area mx-auto py-6 px-4">
      <RelatorioColetivo teams={teams} seasonReport={data?.seasonReport} teamMatchStats={data?.teamMatchStats} physical={physical} golsLado={golsLado} teamReport={teamReport} />
    </div>
  </div>
}

function Msg({ children }) {
  return <div className="grid place-items-center min-h-screen text-sm font-bold text-gray-500 bg-gray-50 p-8 text-center">{children}</div>
}
