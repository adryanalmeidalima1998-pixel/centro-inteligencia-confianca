'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Link2, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import { useSerieCData } from '../_lib/useSerieCData'
import { EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import { useGpsFisico } from '../_lib/useGpsFisico'
import { usePlayerPhotos } from '../../hooks/usePlayerPhotos'
import { PhotoSelectorModal } from '../../components/photos/PhotoSelectorModal'
import VincularGpsModal from '../../components/VincularGpsModal'
import RelatorioAtletaCard from '../../components/serie-c/RelatorioAtletaCard'
import RelatorioColetivo from '../../components/serie-c/RelatorioColetivo'
import RelatorioElenco from '../../components/serie-c/RelatorioElenco'
import {
  squadLeaders, goalkeeperLeaders, playerReport, goalkeeperReport, physicalReport, squadTop3Report,
} from '../../../lib/serieCReport'
import { playerProfile, goalkeeperProfile, valueFromMetricAny, metricDisplayName } from '../../../lib/serieC'

function ScaledCard({ children }) {
  const wrap = useRef(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 794)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={wrap} className="w-full overflow-hidden">
      <div style={{ transform:`scale(${scale})`, transformOrigin:'top left', height:scale < 1 ? `${1123 * scale}px` : 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function buildIdentity(player) {
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

function asGoalkeeper(g) { return { ...g, position:'GK', isGoalkeeper:true } }

export default function RelatoriosPage() {
  const { data, loading, error, reload } = useSerieCData()
  const photos = usePlayerPhotos()
  const gps = useGpsFisico({ matchOnly:true })
  const [aba, setAba] = useState('atletas')
  const [sel, setSel] = useState(null)
  const [photoPlayer, setPhotoPlayer] = useState(null)
  const [golsLado, setGolsLado] = useState(null)
  const [teamReport, setTeamReport] = useState(null)
  const [busyPlayer, setBusyPlayer] = useState(null)
  const [athleteStatus, setAthleteStatus] = useState(null)
  const [gpsLinkOpen, setGpsLinkOpen] = useState(false)

  useEffect(() => {
    fetch('/api/serie-c/gols-lado').then(r => r.json()).then(d => setGolsLado(d?.registro || null)).catch(() => {})
    fetch('/api/serie-c/team-report').then(r => r.json()).then(d => setTeamReport(d?.latest || null)).catch(() => {})
  }, [])

  const players = data?.players || []
  const goalkeepers = useMemo(() => (data?.goalkeepers || []).map(asGoalkeeper), [data?.goalkeepers])
  const teams = data?.teams || []
  const excludedSet = useMemo(() => new Set(data?.reportExcludedPlayers || []), [data?.reportExcludedPlayers])

  const allLineSquad = useMemo(() => players.filter(p => p.is_guarani), [players])
  const allGkSquad = useMemo(() => goalkeepers.filter(p => p.is_guarani), [goalkeepers])
  const allSquad = useMemo(() => [...allLineSquad, ...allGkSquad], [allLineSquad, allGkSquad])
  const lineSquad = useMemo(() => allLineSquad.filter(p => !excludedSet.has(p.player)), [allLineSquad, excludedSet])
  const gkSquad = useMemo(() => allGkSquad.filter(p => !excludedSet.has(p.player)), [allGkSquad, excludedSet])
  const squad = useMemo(() => [...lineSquad, ...gkSquad], [lineSquad, gkSquad])
  const hiddenPlayers = useMemo(() => allSquad.filter(p => excludedSet.has(p.player)).sort((a,b) => a.player.localeCompare(b.player)), [allSquad, excludedSet])

  // Liga = todos os atletas da planilha. O motor deduplica e usa a mesma base (/90 ou %) do elenco.
  const leagueLine = players
  const leagueGk = goalkeepers
  const lineLeaders = useMemo(() => squadLeaders(lineSquad), [lineSquad])
  const gkLeaders = useMemo(() => goalkeeperLeaders(gkSquad), [gkSquad])

  const physical = useMemo(() => physicalReport(gps.aggregateSquad(squad.map(p => p.player))), [squad, gps.sessions, gps.aliases])
  const elencoReport = useMemo(() => squadTop3Report(lineSquad, gkSquad, physical), [lineSquad, gkSquad, physical])

  const ledBy = useMemo(() => {
    const map = {}
    for (const leaders of [lineLeaders, gkLeaders]) {
      for (const key of Object.keys(leaders)) {
        const L = leaders[key]
        ;(map[L.player] = map[L.player] || []).push(L.def.label || metricDisplayName(L.def.col))
      }
    }
    return map
  }, [lineLeaders, gkLeaders])

  const ordered = useMemo(() => [...squad].sort((a,b) => (Number(b.minutes)||0)-(Number(a.minutes)||0)), [squad])
  const selPlayer = sel ? squad.find(p => p.player === sel) || ordered[0] : ordered[0]

  const card = useMemo(() => {
    if (!selPlayer) return null
    const isGK = selPlayer.isGoalkeeper || selPlayer.position === 'GK'
    const report = isGK
      ? goalkeeperReport(selPlayer, { squad:gkSquad, leaguePool:leagueGk, leaders:gkLeaders })
      : playerReport(selPlayer, { squad:lineSquad, leaguePool:leagueLine, leaders:lineLeaders })
    const row = physical.rows.find(r => r.nome === selPlayer.player) || null
    const photoUrl = photos.getPhotoUrl ? photos.getPhotoUrl(selPlayer.player) : photos.photoMap?.[selPlayer.player]
    return { identity:buildIdentity(selPlayer), report, physical:{ ...physical, row }, photoUrl }
  }, [selPlayer, lineSquad, gkSquad, leagueLine, leagueGk, lineLeaders, gkLeaders, physical, photos.photoMap])

  async function setAthleteExcluded(playerName, excluded) {
    const upload = data?.upload
    if (!upload?.season || !playerName) return
    if (excluded && !window.confirm(`Excluir ${playerName} dos relatórios da Série C?\n\nOs dados históricos não serão apagados e você poderá reativá-lo depois.`)) return

    setBusyPlayer(playerName)
    setAthleteStatus(null)
    try {
      const response = await fetch('/api/serie-c/report-athletes', {
        method: excluded ? 'POST' : 'DELETE',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          season: upload.season,
          competition: upload.competition || 'Brasileiro Série C',
          player: playerName,
        }),
      })
      const payload = await response.json()
      if (!response.ok || payload?.error) throw new Error(payload?.error || 'Falha ao atualizar o atleta.')
      if (excluded && sel === playerName) setSel(null)
      setAthleteStatus({ type:'ok', message: excluded ? `${playerName} foi removido dos relatórios.` : `${playerName} voltou aos relatórios.` })
      await reload()
    } catch (err) {
      setAthleteStatus({ type:'error', message:err.message || 'Falha ao atualizar o atleta.' })
    } finally {
      setBusyPlayer(null)
    }
  }

  const gpsLinkedCount = useMemo(() => squad.filter(p => Boolean(gps.resolveGps(p.player))).length, [squad, gps.gpsNames, gps.aliases])
  const gpsPendingCount = Math.max(0, squad.length - gpsLinkedCount)
  const selectedGpsName = selPlayer ? gps.resolveGps(selPlayer.player) : ''

  const hasSourceSquad = allSquad.length > 0

  return (
    <AppShell>
      <style>{`
        @media print {
          body * { visibility:hidden !important; }
          .print-area, .print-area * { visibility:visible !important; }
          .print-area { position:absolute; left:0; top:0; box-shadow:none !important; }
          .no-print { display:none !important; }
          @page { size:A4; margin:8mm; }
        }
      `}</style>
      <SerieCTabs />
      <div className="px-4 md:px-8 py-6">
        {loading && <Loading />}
        {error && <ErrorState message={String(error)} />}
        {!loading && !error && !hasSourceSquad && <EmptyState title="Sem dados" description="Nenhum atleta do Confiança carregado ainda." />}

        {!loading && !error && hasSourceSquad && <>
          <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
              {[{k:'atletas',l:'Cards de atleta'},{k:'elenco',l:'Elenco'},{k:'coletivo',l:'Relatório coletivo'}].map(o => (
                <button key={o.k} onClick={() => setAba(o.k)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${aba===o.k ? 'bg-white text-sky-700 shadow-sm border border-sky-200' : 'text-gray-400 hover:text-gray-600'}`}>{o.l}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setGpsLinkOpen(true)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${gpsPendingCount ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                title="Vincular nomes do GPS aos nomes dos relatórios técnicos"
              >
                <Link2 className="h-3.5 w-3.5" /> Vincular nomes GPS
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[8px]">{gpsLinkedCount}/{squad.length}</span>
              </button>
              {aba === 'atletas'
                ? <Link href="/serie-c/relatorio/lote" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100">Exportar todos (PDF)</Link>
                : aba === 'elenco'
                  ? <Link href="/serie-c/relatorio/elenco" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100">Abrir elenco para imprimir / PDF</Link>
                  : <Link href="/serie-c/relatorio/coletivo" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100">Abrir para imprimir / PDF</Link>}
            </div>
          </div>

          {aba === 'atletas' && <div className="grid lg:grid-cols-[280px_1fr] gap-6">
            <div className="no-print lg:max-h-[80vh] lg:overflow-y-auto pr-1">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Elenco do relatório</p>
                  <p className="text-[9px] text-gray-400">{ordered.length} ativos · {hiddenPlayers.length} excluídos</p>
                </div>
              </div>

              <div className="space-y-1.5">
                {ordered.map(p => {
                  const active = selPlayer?.player === p.player
                  const url = photos.getPhotoUrl ? photos.getPhotoUrl(p.player) : photos.photoMap?.[p.player]
                  const busy = busyPlayer === p.player
                  return <div key={p.player} className={`group flex items-center rounded-xl border transition-colors ${active ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <button onClick={() => setSel(p.player)} className="min-w-0 flex flex-1 items-center gap-3 p-2 text-left">
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-gray-100 overflow-hidden ring-1 ring-gray-200">
                        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-[11px] font-black text-gray-300 bc">{p.player.split(' ').slice(0,2).map(s => s[0]).join('')}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-black text-gray-800 bc leading-tight truncate">{p.player}</div>
                        <div className="text-[9px] text-gray-400 truncate">{p.position} · {p.minutes}′</div>
                        {ledBy[p.player]?.length ? <div className="text-[8px] font-bold text-emerald-600 truncate">★ {ledBy[p.player][0]}</div> : null}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAthleteExcluded(p.player, true)}
                      title="Excluir atleta dos relatórios"
                      className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-300 opacity-70 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-40"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                })}
              </div>

              {!ordered.length ? <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-[10px] text-gray-400">Todos os atletas foram excluídos dos relatórios.</div> : null}

              {hiddenPlayers.length ? <details className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <summary className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-gray-500">Atletas excluídos ({hiddenPlayers.length})</summary>
                <div className="mt-2 space-y-1.5">
                  {hiddenPlayers.map(p => <div key={p.player} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5">
                    <span className="min-w-0 truncate text-[10px] font-bold text-gray-600">{p.player}</span>
                    <button type="button" disabled={busyPlayer === p.player} onClick={() => setAthleteExcluded(p.player, false)} className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wide text-emerald-700 disabled:opacity-40">
                      {busyPlayer === p.player ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Reativar
                    </button>
                  </div>)}
                </div>
              </details> : null}

              <p className="mt-3 px-1 text-[8px] leading-relaxed text-gray-400">Excluir aqui apenas remove o atleta dos cards, rankings internos e PDF em lote. A estatística histórica da planilha continua salva.</p>
              {athleteStatus ? <div className={`mt-2 rounded-lg px-2.5 py-2 text-[9px] font-bold ${athleteStatus.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{athleteStatus.message}</div> : null}
            </div>

            <div>{card ? <>
              <div className="no-print flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-[11px] text-gray-400">Pré-visualização — <b className="text-gray-600">{card.identity.nome}</b></p>
                  <p className={`mt-0.5 text-[9px] font-bold ${selectedGpsName ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedGpsName ? `GPS vinculado: ${selectedGpsName}` : 'GPS sem vínculo — use “Vincular nomes GPS”'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPhotoPlayer(card.identity.nome)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50">Alterar foto</button>
                  <Link href={`/serie-c/relatorio/${encodeURIComponent(card.identity.nome)}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700">Abrir para imprimir / PDF</Link>
                </div>
              </div>
              <div className="print-area rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-white"><ScaledCard><RelatorioAtletaCard identity={card.identity} photoUrl={card.photoUrl} report={card.report} physical={card.physical} meta={{ geradoEm:new Date().toLocaleDateString('pt-BR') }} /></ScaledCard></div>
            </> : <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm font-bold text-gray-400">Reative um atleta para visualizar o relatório individual.</div>}</div>
          </div>}

          {aba === 'elenco' && <RelatorioElenco report={elencoReport} photoFor={photos.getPhotoUrl} />}

          {aba === 'coletivo' && <RelatorioColetivo teams={teams} seasonReport={data?.seasonReport} physical={physical} golsLado={golsLado} teamReport={teamReport} />}
        </>}
      </div>

      <VincularGpsModal
        isOpen={gpsLinkOpen}
        onClose={() => setGpsLinkOpen(false)}
        wellnessNames={squad.map(p => p.player)}
        gpsNames={gps.gpsNames}
        aliases={gps.aliases}
        resolveGps={gps.resolveGps}
        onSaved={gps.reloadAliases}
      />

      <PhotoSelectorModal
        isOpen={Boolean(photoPlayer)}
        playerName={photoPlayer}
        currentPhoto={photoPlayer ? photos.getPhotoUrl(photoPlayer) : null}
        onPhotoSelect={url => photoPlayer && photos.setPhoto(photoPlayer, url)}
        onClose={() => setPhotoPlayer(null)}
      />
    </AppShell>
  )
}
