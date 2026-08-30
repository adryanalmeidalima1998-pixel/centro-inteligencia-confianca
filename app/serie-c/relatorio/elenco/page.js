'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSerieCData } from '../../_lib/useSerieCData'
import { useGpsFisico } from '../../_lib/useGpsFisico'
import { usePlayerPhotos } from '../../../hooks/usePlayerPhotos'
import RelatorioElenco from '../../../components/serie-c/RelatorioElenco'
import { physicalReport, squadTop3Report } from '../../../../lib/serieCReport'

const asGoalkeeper = g => ({ ...g, position:'GK', isGoalkeeper:true })

export default function ElencoPrintPage() {
  const router = useRouter()
  const { data, loading, error } = useSerieCData()
  const gps = useGpsFisico({ matchOnly:true })
  const photos = usePlayerPhotos()

  const excluded = useMemo(() => new Set(data?.reportExcludedPlayers || []), [data?.reportExcludedPlayers])
  const lineSquad = useMemo(() => (data?.players || []).filter(p => p.is_guarani && !excluded.has(p.player)), [data?.players, excluded])
  const gkSquad = useMemo(() => (data?.goalkeepers || []).filter(p => p.is_guarani && !excluded.has(p.player)).map(asGoalkeeper), [data?.goalkeepers, excluded])
  const squad = useMemo(() => [...lineSquad, ...gkSquad], [lineSquad, gkSquad])
  const physical = useMemo(() => physicalReport(gps.aggregateSquad(squad.map(p => p.player))), [squad, gps.sessions, gps.aliases])
  const report = useMemo(() => squadTop3Report(lineSquad, gkSquad, physical), [lineSquad, gkSquad, physical])

  if (loading) return <Msg>Carregando dados do elenco…</Msg>
  if (error) return <Msg>Erro ao carregar: {String(error)}</Msg>

  return <div className="min-h-screen bg-gray-100">
    <style>{`
      @media print {
        html, body { margin:0 !important; padding:0 !important; background:white !important; }
        body { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
        .no-print { display:none !important; }
        .print-area { position:static !important; width:202mm !important; padding:0 !important; margin:0 auto !important; background:white !important; }
        .elenco-report-document { display:block !important; width:202mm !important; margin:0 !important; padding:0 !important; }
        .elenco-report-document > :not([hidden]) ~ :not([hidden]) { margin-top:0 !important; }
        .elenco-report-page {
          width:202mm !important; max-width:202mm !important; height:289mm !important; min-height:289mm !important;
          box-sizing:border-box !important; padding:6mm !important; margin:0 !important;
          border:0 !important; border-radius:0 !important; box-shadow:none !important; overflow:hidden !important;
          break-inside:avoid-page !important; page-break-inside:avoid !important;
        }
        .elenco-report-page + .elenco-report-page { break-before:page !important; page-break-before:always !important; }
        .elenco-report-page .metric-card { break-inside:avoid !important; page-break-inside:avoid !important; }
        .elenco-report-page .metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        .elenco-report-page .report-section { margin-top:3mm !important; }
        .elenco-report-page .report-footer { margin-top:auto !important; }
        @page { size:A4 portrait; margin:4mm; }
      }
    `}</style>

    <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur">
      <button onClick={() => router.back()} className="text-xs font-bold text-gray-500 hover:text-gray-800">← Voltar</button>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold text-gray-400">Relatório do elenco · 5 páginas · sem Índice · A4 retrato · sem cards cortados</span>
        <button onClick={() => window.print()} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700">Imprimir / Salvar PDF</button>
      </div>
    </div>

    <div className="print-area mx-auto px-4 py-6">
      <RelatorioElenco report={report} photoFor={photos.getPhotoUrl} />
    </div>
  </div>
}

function Msg({ children }) {
  return <div className="grid min-h-screen place-items-center bg-gray-50 p-8 text-center text-sm font-bold text-gray-500">{children}</div>
}
