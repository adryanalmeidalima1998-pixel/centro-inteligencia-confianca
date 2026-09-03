'use client'
import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSerieCData } from '../../_lib/useSerieCData'
import { useGpsFisico } from '../../_lib/useGpsFisico'
import { usePlayerPhotos } from '../../../hooks/usePlayerPhotos'
import RelatorioAtletaCard from '../../../components/serie-c/RelatorioAtletaCard'
import { playerProfile, goalkeeperProfile, valueFromMetricAny } from '../../../../lib/serieC'
import {
  squadLeaders, goalkeeperLeaders, playerReport, goalkeeperReport, physicalReport,
} from '../../../../lib/serieCReport'

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const asGoalkeeper = g => ({ ...g, position:'GK', isGoalkeeper:true })

function identityOf(player) {
  const m = player.metrics || {}
  const isGK = player.isGoalkeeper || player.position === 'GK'
  return {
    nome:player.player,
    posicao:isGK ? 'GK' : player.position,
    idade:player.age,
    minutos:player.minutes,
    altura:valueFromMetricAny(m, ['Altura','Altura, cm']),
    jogos:valueFromMetricAny(m, ['Partidas jogadas','Jogos','Partidas']),
    index:valueFromMetricAny(m, ['Índice','Indice']),
    profile:isGK ? goalkeeperProfile(player) : playerProfile(player),
  }
}

export default function RelatorioAtletaPage() {
  const params = useParams()
  const router = useRouter()
  const nomeAlvo = decodeURIComponent(params?.jogador || '')
  const { data, loading, error } = useSerieCData()
  const photos = usePlayerPhotos()
  const gps = useGpsFisico({ matchOnly:true })

  const players = data?.players || []
  const goalkeepers = (data?.goalkeepers || []).map(asGoalkeeper)
  const excluded = useMemo(() => new Set(data?.reportExcludedPlayers || []), [data?.reportExcludedPlayers])
  const lineSquad = useMemo(() => players.filter(p => p.is_club && !excluded.has(p.player)), [players, excluded])
  const gkSquad = useMemo(() => goalkeepers.filter(p => p.is_club && !excluded.has(p.player)), [goalkeepers, excluded])
  const squad = useMemo(() => [...lineSquad, ...gkSquad], [lineSquad, gkSquad])
  const leagueLine = players
  const leagueGk = goalkeepers

  const player = useMemo(() => squad.find(p => norm(p.player) === norm(nomeAlvo)) || squad.find(p => norm(p.player).includes(norm(nomeAlvo))), [squad, nomeAlvo])

  const built = useMemo(() => {
    if (!player) return null
    const isGK = player.isGoalkeeper || player.position === 'GK'
    const report = isGK
      ? goalkeeperReport(player, { squad:gkSquad, leaguePool:leagueGk, leaders:goalkeeperLeaders(gkSquad) })
      : playerReport(player, { squad:lineSquad, leaguePool:leagueLine, leaders:squadLeaders(lineSquad) })
    const phys = physicalReport(gps.aggregateSquad(squad.map(p => p.player)))
    const physical = { ...phys, row:phys.rows.find(r => r.nome === player.player) || null }
    const photoUrl = photos.getPhotoUrl ? photos.getPhotoUrl(player.player) : photos.photoMap?.[player.player]
    return { identity:identityOf(player), report, physical, photoUrl }
  }, [player, squad, lineSquad, gkSquad, leagueLine, leagueGk, gps.sessions, gps.aliases, photos.photoMap])

  if (loading) return <Msg>Carregando dados da Série C…</Msg>
  if (error) return <Msg>Erro ao carregar: {String(error)}</Msg>
  if (!player) return <Msg>Atleta “{nomeAlvo}” não encontrado no elenco do Confiança.</Msg>

  return (
    <div className="bg-gray-100 min-h-screen">
      <style>{`
        @media print {
          html, body { margin:0 !important; padding:0 !important; background:white !important; }
          body { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          .no-print { display:none !important; }
          .relatorio-card { position:static !important; width:210mm !important; height:290mm !important; min-height:0 !important; box-sizing:border-box !important; margin:0 !important; padding:9mm !important; box-shadow:none !important; overflow:hidden !important; break-inside:avoid-page !important; page-break-inside:avoid !important; }
          .relatorio-card + * { break-before:avoid !important; page-break-before:avoid !important; }
          @page { size:A4 portrait; margin:0; }
        }
    `}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur px-4 py-3 border-b border-gray-200">
        <button onClick={() => router.back()} className="text-xs font-bold text-gray-500 hover:text-gray-800">← Voltar</button>
        <button onClick={() => window.print()} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700">Imprimir / Salvar PDF</button>
      </div>
      <div className="py-6">
        <div className="mx-auto shadow-lg" style={{ width:'210mm' }}>
          {built && <RelatorioAtletaCard identity={built.identity} photoUrl={built.photoUrl} report={built.report} physical={built.physical} meta={{ geradoEm:new Date().toLocaleDateString('pt-BR') }} />}
        </div>
        {built && !built.physical.row && <p className="no-print mx-auto mt-3 text-center text-[11px] text-gray-400" style={{ width:'210mm' }}>Sem GPS de jogo vinculado a este atleta ainda — o card imprime normalmente, mas o bloco físico fica pendente.</p>}
      </div>
    </div>
  )
}

function Msg({ children }) {
  return <div className="grid place-items-center min-h-screen text-sm font-bold text-gray-500 bg-gray-50 p-8 text-center">{children}</div>
}
