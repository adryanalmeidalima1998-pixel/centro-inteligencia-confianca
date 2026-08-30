'use client'
import { useEffect, useState } from 'react'
import { FileText, Loader2, UploadCloud, Activity, ExternalLink, ScanLine } from 'lucide-react'
import { extractTeamReportSpatial } from '../../../lib/serieCTeamReportSpatial'

function Status({ value }) {
  if (!value) return null
  const ok = value.type === 'ok'
  return <div className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${ok ? 'border-sky-100 bg-sky-50 text-sky-700' : 'border-red-100 bg-red-50 text-red-600'}`}>{value.message}</div>
}

export default function SerieCReportUploads({ season, competition, round }) {
  const [gpsFiles, setGpsFiles] = useState([])
  const [gpsStatus, setGpsStatus] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [teamPdf, setTeamPdf] = useState(null)
  const [pdfStatus, setPdfStatus] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [latest, setLatest] = useState(null)

  const loadLatest = () => {
    if (!season) return
    fetch(`/api/serie-c/team-report?season=${encodeURIComponent(season)}&competition=${encodeURIComponent(competition || 'Brasileiro Série C')}`)
      .then(r => r.json()).then(d => setLatest(d?.latest || null)).catch(() => {})
  }
  useEffect(() => { loadLatest() }, [season, competition])

  async function uploadGps() {
    if (!gpsFiles.length) return setGpsStatus({ type:'error', message:'Selecione um ou mais CSVs de jogo do Catapult.' })
    setGpsLoading(true); setGpsStatus(null)
    let ok = 0
    const errors = []
    for (const file of gpsFiles) {
      try {
        const fd = new FormData()
        fd.set('file', file)
        fd.set('tipo_sessao', 'Jogo')
        fd.set('periodo_dia', 'Tarde')
        fd.set('titulo', file.name.replace(/\.csv$/i, ''))
        const res = await fetch('/api/gps', { method:'POST', body:fd })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || 'Falha no upload')
        ok += 1
      } catch (e) { errors.push(`${file.name}: ${e.message}`) }
    }
    setGpsLoading(false)
    setGpsStatus(errors.length
      ? { type:'error', message:`${ok} arquivo(s) importado(s). Falhas: ${errors.join(' | ')}` }
      : { type:'ok', message:`${ok} relatório(s) GPS de jogo importado(s). Eles já alimentam os cards físicos.` })
    if (!errors.length) setGpsFiles([])
  }

  async function uploadTeamPdf() {
    if (!season || !round) return setPdfStatus({ type:'error', message:'Informe temporada e rodada acima antes de enviar o PDF.' })
    if (!teamPdf) return setPdfStatus({ type:'error', message:'Selecione o PDF do relatório de equipe (últimas 10 partidas).' })
    setPdfLoading(true); setPdfStatus(null)
    try {
      // A leitura espacial acontece no navegador, antes do upload. O PDF.js lê
      // os mapas de DEFESA, ATAQUE e TRANSIÇÕES e distribui automaticamente as leituras espaciais.
      let spatial = null
      try { spatial = await extractTeamReportSpatial(teamPdf) } catch (_) { spatial = null }

      const fd = new FormData()
      fd.set('season', season)
      fd.set('competition', competition || 'Brasileiro Série C')
      fd.set('round', round)
      fd.set('file', teamPdf)
      const res = await fetch('/api/serie-c/team-report', { method:'POST', body:fd })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Falha no upload')

      if (spatial) {
        const corridorRes = await fetch('/api/serie-c/gols-lado', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ rodada:Number(round), ...spatial }),
        })
        const corridorJson = await corridorRes.json()
        if (!corridorRes.ok || corridorJson?.error) throw new Error(corridorJson?.error || 'O PDF foi salvo, mas falhou ao salvar a leitura por corredor.')
        const parts = []
        if (spatial.amostra_duelos_def_ganhos) parts.push(`${spatial.amostra_duelos_def_ganhos} duelos defensivos ganhos`)
        if (spatial.amostra_ataques) parts.push(`${spatial.amostra_ataques} exposições defensivas`)
        if (spatial.amostra_duelos_aereos) parts.push(`${spatial.amostra_duelos_aereos} duelos aéreos`)
        if (spatial.amostra_cruzamentos) parts.push(`${spatial.amostra_cruzamentos} cruzamentos`)
        if (spatial.amostra_dribles) parts.push(`${spatial.amostra_dribles} dribles no último terço`)
        if (spatial.amostra_recuperacoes_altas) parts.push(`${spatial.amostra_recuperacoes_altas} recuperações altas`)
        if (spatial.recuperacoes_zonas) parts.push('recuperações em 9 zonas')
        if (spatial.perdas_zonas) parts.push('perdas em 9 zonas')
        if (spatial.faltas_zonas) parts.push('faltas em 9 zonas')
        setPdfStatus({
          type:'ok',
          message:`PDF salvo e leitura espacial concluída: ${parts.join(' · ')}. Os gols podem ser posicionados e classificados por origem/tipo no quadro espacial abaixo.`,
        })
        window.dispatchEvent(new CustomEvent('serie-c-corridor-updated'))
      } else {
        setPdfStatus({
          type:'ok',
          message:'PDF salvo. Os mapas espaciais não foram reconhecidos automaticamente neste arquivo; use “Reprocessar PDF” no quadro de leitura espacial.',
        })
      }
      setTeamPdf(null)
      loadLatest()
    } catch (e) { setPdfStatus({ type:'error', message:e.message }) }
    finally { setPdfLoading(false) }
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UploadCloud className="h-4 w-4" /></span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-700">Arquivos dos relatórios de desempenho</p>
          <p className="mt-1 text-[10px] leading-relaxed text-gray-400">Envie aqui os CSVs de GPS dos jogos e o PDF de equipe das últimas 10 partidas. O PDF alimenta automaticamente as leituras espaciais de defesa, transições e ataque; apenas a posição e a origem/tipo dos gols são marcadas manualmente.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" /><p className="text-[9px] font-black uppercase tracking-widest text-gray-600">GPS de jogos · Catapult</p></div>
          <input type="file" accept=".csv,text/csv" multiple onChange={e => setGpsFiles(Array.from(e.target.files || []))} className="block w-full text-[10px] text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-[9px] file:font-black file:uppercase file:text-blue-700" />
          <p className="text-[9px] text-gray-400">Pode selecionar vários jogos de uma vez.</p>
          <Status value={gpsStatus} />
          <button type="button" onClick={uploadGps} disabled={gpsLoading} className="w-full rounded-xl bg-blue-600 py-2.5 text-[9px] font-black uppercase tracking-widest text-white disabled:opacity-50">{gpsLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Importando...</span> : `Importar GPS (${gpsFiles.length || 0})`}</button>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-700" /><p className="text-[9px] font-black uppercase tracking-widest text-gray-600">PDF de equipe · últimas 10</p></div>
          <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2.5 py-2 text-[9px] font-semibold leading-relaxed text-emerald-800"><ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Ao salvar, o sistema procura automaticamente as páginas <b>DEFESA</b>, <b>TRANSIÇÕES</b> e <b>ATAQUE</b>: duelos defensivos ganhos/perdidos, duelos aéreos, recuperações, perdas, faltas, cruzamentos, dribles no último terço e recuperações altas são lidos espacialmente.</span></div>
          <input type="file" accept="application/pdf,.pdf" onChange={e => setTeamPdf(e.target.files?.[0] || null)} className="block w-full text-[10px] text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-[9px] file:font-black file:uppercase file:text-emerald-700" />
          {latest?.sourceUrl ? <a href={latest.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">Último PDF: rodada {latest.round} <ExternalLink className="h-3 w-3" /></a> : <p className="text-[9px] text-gray-400">Ainda não há PDF de equipe salvo.</p>}
          <Status value={pdfStatus} />
          <button type="button" onClick={uploadTeamPdf} disabled={pdfLoading} className="w-full rounded-xl bg-emerald-600 py-2.5 text-[9px] font-black uppercase tracking-widest text-white disabled:opacity-50">{pdfLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando...</span> : 'Salvar PDF de equipe'}</button>
        </div>
      </div>
    </section>
  )
}
