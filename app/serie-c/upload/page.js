'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  Table2,
  Swords,
  UploadCloud,
} from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import GolsLadoForm from '../../components/serie-c/GolsLadoForm'
import SerieCReportUploads from '../../components/serie-c/SerieCReportUploads'
import { parseWyscoutStandingsTextItems } from '../../../lib/serieCStandingsPdf'
import { parseWyscoutSeasonReportPages } from '../../../lib/serieCSeasonReportPdf'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`
const DEFAULT_COMPETITION = 'Brasileiro Série C'
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

let pdfJsLoadingPromise = null

function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Leitura de PDF disponível apenas no navegador.'))
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
    return Promise.resolve(window.pdfjsLib)
  }
  if (pdfJsLoadingPromise) return pdfJsLoadingPromise

  pdfJsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PDFJS_URL
    script.async = true
    script.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error('A biblioteca de leitura do PDF não foi carregada.'))
        return
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
      resolve(window.pdfjsLib)
    }
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de PDF. Verifique a conexão e tente novamente.'))
    document.head.appendChild(script)
  })
  return pdfJsLoadingPromise
}

async function extractStandingsFromPdf(file) {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  const document = await pdfjs.getDocument({ data }).promise
  const pagesToInspect = Math.min(document.numPages, 18)
  const pages = []
  const attempts = []
  let standings = null

  for (let pageNumber = 1; pageNumber <= pagesToInspect; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
    pages.push({ pageNumber, items: textContent.items })

    // A página POSIÇÕES costuma ser a 2, mas não dependemos disso.
    if (!standings && pageNumber <= 8) {
      const parsed = parseWyscoutStandingsTextItems(textContent.items, viewport.height, viewport.width)
      if (parsed.ok) {
        standings = { rows: parsed.rows, pageNumber, inferredRound: parsed.inferredRound, parser: parsed.parser }
      } else {
        attempts.push({
          pageNumber,
          teams: Math.max(parsed.diagnostics?.coordinateTeams || 0, parsed.diagnostics?.linearTeams || 0, parsed.rows?.length || 0),
          errors: parsed.errors || [],
        })
      }
    }
  }

  if (!standings) {
    const best = attempts.sort((a, b) => b.teams - a.teams)[0]
    const detail = best ? ` Melhor tentativa: página ${best.pageNumber}, ${best.teams}/20 equipes.` : ''
    throw new Error(`Não foi possível reconstruir a página POSIÇÕES.${detail}`)
  }

  const reportData = parseWyscoutSeasonReportPages(pages, standings.rows)
  return { ...standings, reportData }
}

function StatusBox({ status }) {
  if (!status) return null
  const ok = status.type === 'ok'
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${ok ? 'border-sky-100 bg-sky-50 text-sky-700' : 'border-red-100 bg-red-50 text-red-600'}`}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" /> : <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />}
      <span>{status.message}</span>
    </div>
  )
}

function FileField({ label, file, onChange, accept = '.xlsx,.xls', emptyText = 'Selecionar arquivo', helper, icon: Icon = UploadCloud, inputKey }) {
  return (
    <label className="block">
      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</span>
      <div className="relative mt-1.5 cursor-pointer rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-center transition-colors hover:border-sky-300 hover:bg-sky-50/20">
        <input
          key={inputKey}
          type="file"
          accept={accept}
          onChange={event => onChange(event.target.files?.[0] || null)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <Icon className="mx-auto h-5 w-5 text-gray-300" />
        <p className="mt-2 break-all text-xs font-bold text-gray-600">{file ? file.name : emptyText}</p>
        <p className="mt-1 text-[10px] text-gray-300">{helper || 'Clique ou arraste o arquivo'}</p>
      </div>
    </label>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</span>
      {children}
    </label>
  )
}

function ModeButton({ active, icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${active ? 'border-sky-200 bg-sky-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}
    >
      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${active ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-400'}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0">
        <span className={`block text-[10px] font-black uppercase tracking-wider ${active ? 'text-sky-700' : 'text-gray-600'}`}>{title}</span>
        <span className="mt-0.5 block truncate text-[9px] text-gray-400">{description}</span>
      </span>
    </button>
  )
}

function StandingsPreview({ parsed }) {
  if (!parsed) return null
  const guarani = parsed.rows.find(row => row.team.toLowerCase().includes('confianca'))
  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/40">
      <div className="flex flex-col gap-3 border-b border-sky-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><Table2 className="h-4 w-4" /></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-sky-700">Prévia validada</p>
            <p className="text-[10px] text-gray-500">20 equipes · página {parsed.pageNumber} · rodada sugerida {parsed.inferredRound}</p>
          </div>
        </div>
        {guarani && <div className="rounded-lg bg-white px-3 py-2 text-right shadow-sm"><p className="text-[8px] font-black uppercase tracking-wider text-gray-400">Confiança</p><p className="bc text-xl font-black text-gray-800">{guarani.position}º · {guarani.points} pts</p></div>}
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[760px] text-[10px]">
          <thead className="sticky top-0 bg-white/95 text-[8px] font-black uppercase tracking-wider text-gray-400">
            <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Equipe</th><th className="px-3 py-2 text-right">Pts</th><th className="px-3 py-2 text-right">J</th><th className="px-3 py-2 text-right">V</th><th className="px-3 py-2 text-right">E</th><th className="px-3 py-2 text-right">D</th><th className="px-3 py-2 text-right">SG</th><th className="px-3 py-2 text-right">xG</th><th className="px-3 py-2 text-right">xGA</th><th className="px-3 py-2 text-right">xPts</th></tr>
          </thead>
          <tbody>
            {parsed.rows.map(row => (
              <tr key={row.position} className={`border-t border-sky-100/60 ${row.team.toLowerCase().includes('confianca') ? 'bg-sky-100/70' : 'bg-white/40'}`}>
                <td className="px-3 py-2 font-black text-gray-500">{row.position}</td>
                <td className="px-3 py-2 font-bold text-gray-700">{row.team}</td>
                <td className="px-3 py-2 text-right font-black text-gray-800">{row.points}</td>
                <td className="px-3 py-2 text-right text-gray-500">{row.played}</td>
                <td className="px-3 py-2 text-right text-gray-500">{row.won}</td>
                <td className="px-3 py-2 text-right text-gray-500">{row.drawn}</td>
                <td className="px-3 py-2 text-right text-gray-500">{row.lost}</td>
                <td className="px-3 py-2 text-right font-bold text-gray-600">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</td>
                <td className="px-3 py-2 text-right font-bold text-sky-700">{row.xg.toFixed(1).replace('.', ',')}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-600">{row.xga.toFixed(1).replace('.', ',')}</td>
                <td className="px-3 py-2 text-right font-bold text-sky-700">{row.xPoints.toFixed(1).replace('.', ',')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SerieCUploadPage() {
  const [activeMode, setActiveMode] = useState('weekly')
  const [season, setSeason] = useState('')
  const [competition, setCompetition] = useState(DEFAULT_COMPETITION)
  const [round, setRound] = useState('')
  const [uploadDate, setUploadDate] = useState('')
  const [guaraniPosition, setGuaraniPosition] = useState('')

  const [teamsFile, setTeamsFile] = useState(null)
  const [playersFile, setPlayersFile] = useState(null)
  const [goalkeepersFile, setGoalkeepersFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploads, setUploads] = useState([])

  const [matchesFile, setMatchesFile] = useState(null)
  const [matchesStatus, setMatchesStatus] = useState(null)
  const [submittingMatches, setSubmittingMatches] = useState(false)

  const [standingsFile, setStandingsFile] = useState(null)
  const [standingsFileKey, setStandingsFileKey] = useState(0)
  const [standingsRound, setStandingsRound] = useState('')
  const [standingsDate, setStandingsDate] = useState('')
  const [parsedStandings, setParsedStandings] = useState(null)
  const [standingsStatus, setStandingsStatus] = useState(null)
  const [parsingPdf, setParsingPdf] = useState(false)
  const [submittingStandings, setSubmittingStandings] = useState(false)
  const [standingsUploads, setStandingsUploads] = useState([])

  function loadHistories(currentSeason = season || String(new Date().getFullYear())) {
    fetch('/api/serie-c/upload').then(response => response.json()).then(data => setUploads(data.uploads || [])).catch(() => {})
    fetch(`/api/serie-c/standings?season=${encodeURIComponent(currentSeason)}&competition=${encodeURIComponent(competition)}`)
      .then(response => response.json())
      .then(data => setStandingsUploads(data.snapshots || []))
      .catch(() => {})
  }

  useEffect(() => {
    const now = new Date()
    const currentSeason = String(now.getFullYear())
    setSeason(currentSeason)
    setUploadDate(now.toISOString().slice(0, 10))
    setStandingsDate(now.toISOString().slice(0, 10))
    const tipo = new URLSearchParams(window.location.search).get('tipo')
    if (tipo === 'classificacao') setActiveMode('standings')
    if (tipo === 'partidas' || tipo === 'xg') setActiveMode('matches')
    loadHistories(currentSeason)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleWeeklySubmit(event) {
    event.preventDefault()
    if (!season || !round) {
      setStatus({ type: 'error', message: 'Informe temporada e rodada.' })
      return
    }
    if (!teamsFile && !playersFile && !goalkeepersFile) {
      setStatus({ type: 'error', message: 'Envie pelo menos uma das três planilhas.' })
      return
    }
    setSubmitting(true)
    setStatus(null)
    try {
      const form = new FormData()
      form.set('season', season)
      form.set('competition', competition)
      form.set('round', round)
      form.set('uploadDate', uploadDate)
      if (guaraniPosition) form.set('guaraniPosition', guaraniPosition)
      if (teamsFile) form.set('teamsFile', teamsFile)
      if (playersFile) form.set('playersFile', playersFile)
      if (goalkeepersFile) form.set('goalkeepersFile', goalkeepersFile)

      const response = await fetch('/api/serie-c/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(55000) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Falha ao enviar planilhas.')

      const coverage = [
        json.detected?.players?.columns ? `${json.detected.players.columns} colunas na planilha de linha` : null,
        json.detected?.goalkeepers?.columns ? `${json.detected.goalkeepers.columns} colunas na planilha de goleiros` : null,
      ].filter(Boolean).join(' · ')
      setStatus({ type: 'ok', message: `Rodada ${json.round} salva: ${json.counts.teams} times, ${json.counts.players} jogadores de linha e ${json.counts.goalkeepers} goleiros.${coverage ? ` Cobertura detectada: ${coverage}.` : ''}` })
      setTeamsFile(null)
      setPlayersFile(null)
      setGoalkeepersFile(null)
      loadHistories()
    } catch (error) {
      const message = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'O upload demorou demais e foi cancelado. Tente novamente; se persistir, envie as planilhas separadamente.'
        : error.message
      setStatus({ type: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMatchesSubmit(event) {
    event.preventDefault()
    if (!season) {
      setMatchesStatus({ type: 'error', message: 'Informe a temporada.' })
      return
    }
    if (!matchesFile) {
      setMatchesStatus({ type: 'error', message: 'Selecione a planilha Team Stats / Estatísticas da partida.' })
      return
    }
    setSubmittingMatches(true)
    setMatchesStatus(null)
    try {
      const form = new FormData()
      form.set('season', season)
      form.set('competition', competition)
      form.set('file', matchesFile)
      const response = await fetch('/api/serie-c/competition-matches', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
      const json = await response.json()
      if (!response.ok || json.error) throw new Error(json.error || 'Falha ao importar partidas.')
      const xgText = json.xgMatches ? ` ${json.xgMatches} jogo(s) com xG/xGA reconhecidos.` : ' A planilha foi importada, mas não encontrei xG nas colunas.'
      const timelineText = json.guaraniTimelineMatches ? ` ${json.guaraniTimelineMatches} jogo(s) do Confiança sincronizados com a Linha do Tempo.` : ''
      setMatchesStatus({ type: 'ok', message: `${json.imported} partida(s) atualizada(s).${xgText}${timelineText}` })
      setMatchesFile(null)
    } catch (error) {
      setMatchesStatus({ type: 'error', message: error.name === 'TimeoutError' || error.name === 'AbortError' ? 'A importação excedeu 60 segundos. Tente novamente.' : error.message })
    } finally {
      setSubmittingMatches(false)
    }
  }

  async function handleStandingsFile(file) {
    setStandingsFile(file)
    setParsedStandings(null)
    setStandingsStatus(null)
    if (!file) return
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setStandingsStatus({ type: 'error', message: 'Selecione o PDF do relatório da época.' })
      return
    }

    setParsingPdf(true)
    try {
      const parsed = await extractStandingsFromPdf(file)
      setParsedStandings(parsed)
      setStandingsRound(String(parsed.inferredRound || ''))
      setStandingsStatus({ type: 'ok', message: `PDF validado: 20 equipes identificadas na página ${parsed.pageNumber} e snapshot estatístico extraído. Confira a prévia e publique a rodada.` })
    } catch (error) {
      setStandingsStatus({ type: 'error', message: `${error.message} Use o relatório de época Wyscout que contém a página “POSIÇÕES”.` })
    } finally {
      setParsingPdf(false)
    }
  }

  async function handleStandingsSubmit(event) {
    event.preventDefault()
    if (!season || !standingsRound) {
      setStandingsStatus({ type: 'error', message: 'Informe temporada e rodada da classificação.' })
      return
    }
    if (!standingsFile || !parsedStandings) {
      setStandingsStatus({ type: 'error', message: 'Selecione e aguarde a validação do PDF antes de salvar.' })
      return
    }

    setSubmittingStandings(true)
    setStandingsStatus(null)
    try {
      const form = new FormData()
      form.set('season', season)
      form.set('competition', competition)
      form.set('round', standingsRound)
      form.set('referenceDate', standingsDate)
      form.set('sourcePage', String(parsedStandings.pageNumber))
      form.set('standingsJson', JSON.stringify(parsedStandings.rows))
      form.set('reportJson', JSON.stringify(parsedStandings.reportData || {}))
      form.set('file', standingsFile)

      const response = await fetch('/api/serie-c/standings', { method: 'POST', body: form, signal: AbortSignal.timeout(55000) })
      const json = await response.json()
      if (!response.ok) {
        const details = Array.isArray(json.details) && json.details.length ? ` ${json.details.join(' ')}` : ''
        throw new Error(`${json.error || 'Falha ao salvar a classificação.'}${details}`)
      }

      setStandingsStatus({ type: 'ok', message: `Snapshot da rodada ${json.snapshot.round} publicado: classificação + dados complementares do Relatório da Época.` })
      setStandingsFile(null)
      setParsedStandings(null)
      setStandingsFileKey(key => key + 1)
      loadHistories()
    } catch (error) {
      const message = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'O envio demorou demais. Tente novamente com o mesmo PDF.'
        : error.message
      setStandingsStatus({ type: 'error', message })
    } finally {
      setSubmittingStandings(false)
    }
  }

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="max-w-5xl space-y-6 p-4 md:p-8">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-300">Atualização da base</p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-bold text-gray-700">Upload Semanal — Série C</p><p className="mt-1 text-[10px] text-gray-400">Planilhas de desempenho, partidas com xG e PDF oficial da classificação, com histórico por rodada.</p></div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-[8px] font-black uppercase tracking-wider text-sky-700"><Database className="h-3.5 w-3.5" /> Base versionada</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row">
          <ModeButton active={activeMode === 'weekly'} onClick={() => setActiveMode('weekly')} icon={FileSpreadsheet} title="Planilhas semanais" description="Times, jogadores e goleiros" />
          <ModeButton active={activeMode === 'matches'} onClick={() => setActiveMode('matches')} icon={Swords} title="Partidas + xG" description="Team Stats / jogo a jogo" />
          <ModeButton active={activeMode === 'standings'} onClick={() => setActiveMode('standings')} icon={FileText} title="Classificação em PDF" description="Relatório da época Wyscout" />
        </div>

        {activeMode === 'weekly' && (
          <form onSubmit={handleWeeklySubmit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3 border-b border-gray-100 pb-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileSpreadsheet className="h-4 w-4" /></span><div><p className="text-[10px] font-black uppercase tracking-wider text-gray-700">Snapshot estatístico</p><p className="mt-1 text-[10px] text-gray-400">Atualiza as páginas de times, jogadores de linha e goleiros.</p></div></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Temporada"><input value={season} onChange={event => setSeason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" placeholder="2026" /></Field>
              <Field label="Competição" className="col-span-2"><input value={competition} onChange={event => setCompetition(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></Field>
              <Field label="Rodada"><input type="number" min="1" value={round} onChange={event => setRound(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" placeholder="16" /></Field>
              <Field label="Data do upload"><input type="date" value={uploadDate} onChange={event => setUploadDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></Field>
              <Field label="Posição do Confiança"><input type="number" min="1" max="20" value={guaraniPosition} onChange={event => setGuaraniPosition(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" placeholder="Ex.: 2" /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FileField label="Planilha de times" file={teamsFile} onChange={setTeamsFile} />
              <FileField label="Jogadores de linha" file={playersFile} onChange={setPlayersFile} />
              <FileField label="Goleiros" file={goalkeepersFile} onChange={setGoalkeepersFile} />
            </div>
            <StatusBox status={status} />
            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-sky-700 disabled:opacity-50">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? 'Enviando...' : 'Salvar snapshot da rodada'}</button>
          </form>
        )}

        {activeMode === 'matches' && (
          <form onSubmit={handleMatchesSubmit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Swords className="h-4 w-4" /></span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-700">Partidas + xG/xGA</p>
                <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-gray-400">Use a planilha Team Stats do Confiança. O sistema aceita também a exportação tradicional “Estatísticas da partida”, identifica Data + Jogo/Match + Equipa/Time e mescla as métricas sem apagar as que já existiam.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Temporada"><input value={season} onChange={event => setSeason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" placeholder="2026" /></Field>
              <Field label="Competição" className="md:col-span-2"><input value={competition} onChange={event => setCompetition(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></Field>
            </div>
            <FileField label="Team Stats / Estatísticas da partida" file={matchesFile} onChange={setMatchesFile} helper="Para xG, a planilha precisa conter a coluna “Golos esperados”" icon={FileSpreadsheet} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-wider text-gray-400">1. Partidas</p><p className="mt-1 text-[10px] font-semibold text-gray-600">Atualiza placar e métricas jogo a jogo.</p></div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-wider text-gray-400">2. xG</p><p className="mt-1 text-[10px] font-semibold text-gray-600">“Golos esperados” vira xG e o valor rival vira xGA.</p></div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-wider text-gray-400">3. Uso</p><p className="mt-1 text-[10px] font-semibold text-gray-600">Alimenta Partidas, Confiança e Linha do Tempo.</p></div>
            </div>
            <StatusBox status={matchesStatus} />
            <button type="submit" disabled={submittingMatches} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-50">{submittingMatches && <Loader2 className="h-4 w-4 animate-spin" />}{submittingMatches ? 'Importando...' : 'Importar partidas + xG'}</button>
          </form>
        )}

        {activeMode === 'standings' && (
          <form onSubmit={handleStandingsSubmit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><FileText className="h-4 w-4" /></span><div><p className="text-[10px] font-black uppercase tracking-wider text-gray-700">Classificação oficial</p><p className="mt-1 max-w-xl text-[10px] leading-relaxed text-gray-400">Envie o Relatório da Época em PDF. O sistema localiza “POSIÇÕES”, valida os 20 clubes e também grava xG/xGA/xPoints, perfil temporal dos gols, identidade de jogo, progressão, pressão, duelos e bolas paradas como snapshot da rodada.</p></div></div>
              <span className="w-fit rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[8px] font-black uppercase tracking-wider text-gray-400">PDF + dados auditáveis</span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Temporada"><input value={season} onChange={event => setSeason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" placeholder="2026" /></Field>
              <Field label="Competição" className="col-span-2"><input value={competition} onChange={event => setCompetition(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></Field>
              <Field label="Rodada"><input type="number" min="1" value={standingsRound} onChange={event => setStandingsRound(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" placeholder="Detectada pelo PDF" /></Field>
              <Field label="Data de referência"><input type="date" value={standingsDate} onChange={event => setStandingsDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></Field>
            </div>

            <FileField
              inputKey={standingsFileKey}
              label="Relatório da época — PDF Wyscout"
              file={standingsFile}
              onChange={handleStandingsFile}
              accept="application/pdf,.pdf"
              emptyText="Selecionar relatório em PDF"
              helper={parsingPdf ? 'Lendo e validando a página de posições...' : 'O PDF completo será preservado e os dados das páginas 2–18 serão estruturados no snapshot'}
              icon={parsingPdf ? Loader2 : FileText}
            />

            {parsingPdf && <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-600"><Loader2 className="h-4 w-4 animate-spin" /> Extraindo classificação do PDF...</div>}
            <StatusBox status={standingsStatus} />
            <StandingsPreview parsed={parsedStandings} />

            <button type="submit" disabled={submittingStandings || parsingPdf || !parsedStandings} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-sky-700 disabled:opacity-50">{submittingStandings && <Loader2 className="h-4 w-4 animate-spin" />}{submittingStandings ? 'Publicando...' : 'Publicar classificação da rodada'}</button>
          </form>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-blue-500" /><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Snapshots estatísticos</p></div>
            {uploads.length === 0 && <p className="text-xs text-gray-400">Nenhum upload realizado ainda.</p>}
            <div className="space-y-1.5">{uploads.slice(0, 10).map(upload => <div key={upload.id} className="flex items-center justify-between border-b border-gray-50 py-1.5 text-[11px]"><span className="font-bold text-gray-600">{upload.season} · Rodada {upload.round}</span><span className="text-gray-400">{upload.guarani_position ? `${upload.guarani_position}º lugar` : '-'}</span></div>)}</div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-sky-600" /><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Histórico da classificação</p></div>
            {standingsUploads.length === 0 && <p className="text-xs text-gray-400">Nenhum PDF de classificação publicado ainda. A página continua usando a base inicial até o primeiro envio.</p>}
            <div className="space-y-1.5">
              {standingsUploads.slice(0, 10).map(upload => (
                <div key={upload.id} className="flex items-center justify-between gap-3 border-b border-gray-50 py-1.5 text-[11px]">
                  <div className="min-w-0"><p className="font-bold text-gray-600">{upload.season} · Rodada {upload.round}</p><p className="truncate text-[9px] text-gray-400">{upload.sourceFilename} · {upload.teamsCount} equipes</p></div>
                  {upload.sourceUrl && <a href={upload.sourceUrl} target="_blank" rel="noreferrer" className="flex flex-none items-center gap-1 text-[9px] font-black uppercase tracking-wider text-sky-600 hover:text-sky-700">PDF <ExternalLink className="h-3 w-3" /></a>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <SerieCReportUploads season={season} competition={competition} round={round || standingsRound} />

        <GolsLadoForm season={season} competition={competition} />
      </div>
    </AppShell>
  )
}
