'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSerieCData } from '../../_lib/useSerieCData'
import { useGpsFisico } from '../../_lib/useGpsFisico'
import { usePlayerPhotos } from '../../../hooks/usePlayerPhotos'
import RelatorioAtletaCard from '../../../components/serie-c/RelatorioAtletaCard'
import {
  squadLeaders, goalkeeperLeaders, playerReport, goalkeeperReport, physicalReport,
} from '../../../../lib/serieCReport'
import { playerProfile, goalkeeperProfile, valueFromMetricAny } from '../../../../lib/serieC'

const asGoalkeeper = g => ({ ...g, position:'GK', isGoalkeeper:true })

function buildIdentity(p) {
  const m = p.metrics || {}
  const isGK = p.isGoalkeeper || p.position === 'GK'
  return {
    nome:p.player,
    posicao:isGK ? 'GK' : p.position,
    idade:p.age,
    minutos:p.minutes,
    altura:valueFromMetricAny(m, ['Altura','Altura, cm']),
    jogos:valueFromMetricAny(m, ['Partidas jogadas','Jogos','Partidas']),
    index:valueFromMetricAny(m, ['Índice','Indice']),
    profile:isGK ? goalkeeperProfile(p) : playerProfile(p),
  }
}

export default function LotePrintPage() {
  const router = useRouter()
  const { data, loading, error } = useSerieCData()
  const photos = usePlayerPhotos()
  const gps = useGpsFisico({ matchOnly:true })
  const [minMin, setMinMin] = useState(0)

  const players = data?.players || []
  const goalkeepers = (data?.goalkeepers || []).map(asGoalkeeper)
  const excluded = useMemo(() => new Set(data?.reportExcludedPlayers || []), [data?.reportExcludedPlayers])
  const lineSquad = useMemo(() => players.filter(p => p.is_club && !excluded.has(p.player)), [players, excluded])
  const gkSquad = useMemo(() => goalkeepers.filter(p => p.is_club && !excluded.has(p.player)), [goalkeepers, excluded])
  const squad = useMemo(() => [...lineSquad, ...gkSquad], [lineSquad, gkSquad])
  const leagueLine = players
  const leagueGk = goalkeepers
  const lineLeaders = useMemo(() => squadLeaders(lineSquad), [lineSquad])
  const gkLeaders = useMemo(() => goalkeeperLeaders(gkSquad), [gkSquad])
  const physical = useMemo(() => physicalReport(gps.aggregateSquad(squad.map(p => p.player))), [squad, gps.sessions, gps.aliases])

  const cards = useMemo(() => [...squad]
    .filter(p => (Number(p.minutes)||0) >= minMin)
    .sort((a,b) => (Number(b.minutes)||0)-(Number(a.minutes)||0))
    .map(p => {
      const isGK = p.isGoalkeeper || p.position === 'GK'
      const report = isGK
        ? goalkeeperReport(p, { squad:gkSquad, leaguePool:leagueGk, leaders:gkLeaders })
        : playerReport(p, { squad:lineSquad, leaguePool:leagueLine, leaders:lineLeaders })
      const row = physical.rows.find(r => r.nome === p.player) || null
      const photoUrl = photos.getPhotoUrl ? photos.getPhotoUrl(p.player) : photos.photoMap?.[p.player]
      return { key:p.player, identity:buildIdentity(p), report, physical:{ ...physical, row }, photoUrl }
    }), [squad, gkSquad, lineSquad, leagueGk, leagueLine, gkLeaders, lineLeaders, physical, photos.photoMap, minMin])

  if (loading) return <Msg>Carregando dados da Série C…</Msg>
  if (error) return <Msg>Erro ao carregar: {String(error)}</Msg>

  return (
    <div className="bg-gray-100 min-h-screen">
      <style>{`
        @media print {
          html, body { margin:0 !important; padding:0 !important; background:white !important; }
          body { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          .no-print { display:none !important; }
          .lote-print { position:static !important; width:210mm !important; margin:0 !important; padding:0 !important; }
          .lote-print > :not([hidden]) ~ :not([hidden]) { margin-top:0 !important; }
          .card-page { width:210mm !important; height:297mm !important; min-height:297mm !important; margin:0 !important; padding:0 !important; box-sizing:border-box !important; overflow:hidden !important; box-shadow:none !important; break-inside:avoid-page !important; page-break-inside:avoid !important; break-after:page !important; page-break-after:always !important; }
          .card-page + .card-page { break-before:page !important; page-break-before:always !important; }
          .card-page .relatorio-card { width:210mm !important; height:290mm !important; min-height:0 !important; box-sizing:border-box !important; margin:0 !important; padding:9mm !important; overflow:hidden !important; }
          @page { size:A4 portrait; margin:0; }
        }
    `}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur px-4 py-3 border-b border-gray-200">
        <button onClick={() => router.back()} className="text-xs font-bold text-gray-500 hover:text-gray-800">← Voltar</button>
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5">Mínimo de minutos
            <select value={minMin} onChange={e => setMinMin(Number(e.target.value))} className="rounded-lg border border-gray-200 px-2 py-1.5 text-[10px] font-bold">
              {[0,200,450,600].map(m => <option key={m} value={m}>≥ {m} min</option>)}
            </select>
          </label>
          <span className="text-[10px] font-bold text-gray-400">{cards.length} atleta(s)</span>
          <button onClick={() => window.print()} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700">Imprimir todos / Salvar PDF</button>
        </div>
      </div>
      <div className="lote-print py-6 space-y-6">
        {cards.map(c => <div key={c.key} className="card-page mx-auto bg-white shadow-lg" style={{ width:'210mm' }}>
          <RelatorioAtletaCard identity={c.identity} photoUrl={c.photoUrl} report={c.report} physical={c.physical} meta={{ geradoEm:new Date().toLocaleDateString('pt-BR') }} />
        </div>)}
      </div>
    </div>
  )
}

function Msg({ children }) {
  return <div className="grid place-items-center min-h-screen text-sm font-bold text-gray-500 bg-gray-50 p-8 text-center">{children}</div>
}
