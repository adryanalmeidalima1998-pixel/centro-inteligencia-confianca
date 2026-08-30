'use client'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts'
import AppShell from '../../components/layout/AppShell'
import SerieCTabs from '../_lib/SerieCTabs'
import { EmptyState, ErrorState, Loading } from '../../components/serie-c/ui'
import { toNumber, variation } from '../../../lib/serieC'

const STYLE = `.bc { font-family: 'Barlow Condensed', sans-serif; }`

const TRACKED_METRICS = [
  'Índice', 'Gols', 'Chances de gol', 'Chutes', 'Passes progressivos',
  'Entradas no terço final', 'Pressão do time bem-sucedida, %',
  'Recuperações da bola no campo adversário',
]

function findColumn(sampleRow, name) {
  if (!sampleRow) return null
  const keys = Object.keys(sampleRow)
  return keys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim()) || null
}

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatShort(value, decimals = 2) {
  const n = toNumber(value)
  if (n === null) return '-'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function scoreParts(score) {
  const match = String(score || '').match(/(\d+)\s*[:xX-]\s*(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2])]
}

function pointsFromMatch(match) {
  const score = scoreParts(match?.score)
  if (!score) return null
  const [homeGoals, awayGoals] = score
  const guaraniGoals = match.mando === 'M' ? homeGoals : awayGoals
  const opponentGoals = match.mando === 'M' ? awayGoals : homeGoals
  if (guaraniGoals > opponentGoals) return 3
  if (guaraniGoals === opponentGoals) return 1
  return 0
}

// ── Linha editável de Rodada / Posição de um jogo ────────────────────────────
function MatchRow({ match, onSave }) {
  const [round, setRound] = useState(match.round ?? '')
  const [position, setPosition] = useState(match.position ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setRound(match.round ?? '') }, [match.round])
  useEffect(() => { setPosition(match.position ?? '') }, [match.position])

  async function save() {
    setSaving(true)
    setSaved(false)
    await onSave(match.id, { round, position })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const indice = toNumber(match.metrics?.['Índice'])
  const xg = toNumber(match.xg)
  const xga = toNumber(match.xga)

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-3 py-2 text-[11px] font-bold text-gray-600 whitespace-nowrap">{formatDate(match.match_date)}</td>
      <td className="px-3 py-2 text-[11px] whitespace-nowrap">
        <span className="text-gray-400 mr-1">{match.mando === 'M' ? 'vs' : '@'}</span>
        <span className="font-bold text-gray-700">{match.opponent}</span>
      </td>
      <td className="px-3 py-2 text-[11px] text-center font-black text-gray-700">{match.score || '-'}</td>
      <td className="px-3 py-2 text-[11px] text-right font-bold text-sky-700">{xg === null ? '-' : formatShort(xg)}</td>
      <td className="px-3 py-2 text-[11px] text-right font-bold text-slate-600">{xga === null ? '-' : formatShort(xga)}</td>
      <td className="px-3 py-2 text-[11px] text-right text-gray-500">{indice ?? '-'}</td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          value={round}
          onChange={e => setRound(e.target.value)}
          onBlur={save}
          placeholder="-"
          className="w-14 text-[11px] font-bold text-center border border-gray-200 rounded-lg px-1.5 py-1"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          value={position}
          onChange={e => setPosition(e.target.value)}
          onBlur={save}
          placeholder="-"
          className="w-14 text-[11px] font-bold text-center border border-gray-200 rounded-lg px-1.5 py-1"
        />
      </td>
      <td className="px-2 py-1.5 text-[9px] w-16">
        {saving && <span className="text-gray-300">salvando…</span>}
        {saved && <span className="text-sky-600 font-bold">salvo ✓</span>}
      </td>
    </tr>
  )
}

export default function SerieCLinhaDoTempoPage() {
  const [season, setSeason] = useState(String(new Date().getFullYear()))
  const [competition, setCompetition] = useState('Brasileiro Série C')
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState(null)

  const [matches, setMatches] = useState([])
  const [pdfTimeline, setPdfTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMatches = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ season, competition })
    Promise.all([
      fetch(`/api/serie-c/matches?${params.toString()}`).then(r => r.json()),
      fetch(`/api/serie-c/standings?${params.toString()}`).then(r => r.json()),
    ])
      .then(([matchesData, standingsData]) => {
        if (matchesData.error) setError(matchesData.error)
        setMatches(matchesData.matches || [])
        setPdfTimeline(standingsData.timeline || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [season, competition])

  useEffect(() => { loadMatches() }, [loadMatches])

  async function handleImport(e) {
    e.preventDefault()
    if (!file) { setImportStatus({ type: 'error', message: 'Selecione o arquivo da planilha de partidas.' }); return }
    setImporting(true)
    setImportStatus(null)
    try {
      const form = new FormData()
      form.set('season', season)
      form.set('competition', competition)
      form.set('file', file)
      const res = await fetch('/api/serie-c/matches', { method: 'POST', body: form, signal: AbortSignal.timeout(55000) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao importar jogos.')
      setImportStatus({ type: 'ok', message: `${json.imported} jogo(s) importado(s). Agora cadastre a rodada e a posição de cada um na tabela abaixo.` })
      setFile(null)
      loadMatches()
    } catch (err) {
      const message = err.name === 'TimeoutError' || err.name === 'AbortError'
        ? 'A importação demorou demais e foi cancelada. Tente novamente.'
        : err.message
      setImportStatus({ type: 'error', message })
    } finally {
      setImporting(false)
    }
  }

  async function saveMatch(id, { round, position }) {
    try {
      const res = await fetch(`/api/serie-c/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round, position }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMatches(prev => prev.map(m => m.id === id ? { ...m, round: json.match.round, position: json.match.position } : m))
    } catch (err) {
      setError(err.message)
    }
  }

  // Só entram nos gráficos os jogos com rodada já cadastrada, em ordem de rodada.
  const rounded = useMemo(() => {
    return matches
      .filter(m => m.round !== null && m.round !== undefined)
      .sort((a, b) => a.round - b.round)
  }, [matches])

  const pendingCount = matches.length - rounded.length

  const chartData = useMemo(() => rounded.map(m => ({
    round: `R${m.round}`,
    posicao: m.position ?? null,
  })), [rounded])

  const xgData = useMemo(() => rounded
    .map(m => ({
      round: `R${m.round}`,
      xg: toNumber(m.xg),
      xga: toNumber(m.xga),
      saldo: toNumber(m.xg_diff),
    }))
    .filter(point => point.xg !== null || point.xga !== null), [rounded])

  const pdfExpectedData = useMemo(() => (pdfTimeline || []).map(item => ({
    round: `R${item.round}`,
    xg: toNumber(item.xg),
    xga: toNumber(item.xga),
    xPoints: toNumber(item.xPoints),
    points: toNumber(item.points),
  })).filter(point => point.xg !== null || point.xga !== null || point.xPoints !== null), [pdfTimeline])

  const dashboard = useMemo(() => {
    if (!rounded.length) return null
    const last = rounded[rounded.length - 1]
    const recent = rounded.slice(-5)
    const points = recent.map(pointsFromMatch).filter(v => v !== null)
    const recentPoints = points.reduce((acc, value) => acc + value, 0)
    const recentWithXg = recent.filter(m => toNumber(m.xg) !== null && toNumber(m.xga) !== null)
    const recentXg = recentWithXg.reduce((acc, m) => acc + toNumber(m.xg), 0)
    const recentXga = recentWithXg.reduce((acc, m) => acc + toNumber(m.xga), 0)
    const xgMatches = recentWithXg.length
    return {
      last,
      recentPoints: points.length ? recentPoints : null,
      pointsMatches: points.length,
      recentXgDiff: xgMatches ? recentXg - recentXga : null,
      xgMatches,
      lastXg: toNumber(last.xg),
      lastXga: toNumber(last.xga),
    }
  }, [rounded])

  const summary = useMemo(() => {
    if (rounded.length === 0) return null
    const last = rounded[rounded.length - 1]
    const prev = rounded.length >= 2 ? rounded[rounded.length - 2] : null

    const posDelta = prev && last.position != null && prev.position != null
      ? prev.position - last.position
      : null

    let best = null, worst = null
    if (prev) {
      for (const metricName of TRACKED_METRICS) {
        const col = findColumn(last.metrics, metricName)
        if (!col) continue
        const v = variation(last.metrics[col], prev.metrics ? prev.metrics[col] : null)
        if (v === null) continue
        if (best === null || v > best.v) best = { label: metricName, v }
        if (worst === null || v < worst.v) worst = { label: metricName, v }
      }
    }

    let text = `Na rodada ${last.round} (${last.mando === 'M' ? 'vs' : '@'} ${last.opponent}, ${last.score || 's/ placar'}), `
    if (posDelta === null) text += 'ainda não há rodada anterior com posição cadastrada para comparar. '
    else if (posDelta > 0) text += `o Confiança subiu ${posDelta} posição(ões) na tabela. `
    else if (posDelta < 0) text += `o Confiança caiu ${Math.abs(posDelta)} posição(ões) na tabela. `
    else text += 'o Confiança manteve a posição na tabela. '
    if (best) text += `Melhor evolução: ${best.label} (${best.v > 0 ? '+' : ''}${Math.round(best.v * 100) / 100}). `
    if (worst && worst.label !== best?.label) text += `Maior queda: ${worst.label} (${Math.round(worst.v * 100) / 100}). `
    const lastXg = toNumber(last.xg)
    const lastXga = toNumber(last.xga)
    if (lastXg !== null && lastXga !== null) {
      const diff = lastXg - lastXga
      text += `No xG da partida: ${formatShort(lastXg)} a ${formatShort(lastXga)} (${diff >= 0 ? '+' : ''}${formatShort(diff)} de saldo).`
    }

    return { posDelta, best, worst, text }
  }, [rounded])

  return (
    <AppShell>
      <style>{STYLE}</style>
      <SerieCTabs />
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-300">Evolução rodada a rodada</p>
          <p className="text-sm font-bold text-gray-700">Linha do Tempo do Confiança</p>
        </div>

        {/* Importação da planilha de jogos da temporada */}
        <form onSubmit={handleImport} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Importar jogos da temporada</p>
          <p className="text-[11px] text-gray-400">
            Suba aqui a planilha histórica do Confiança (um jogo por linha) para cadastrar rodada/posição. Para xG e xGA,
            use <strong>Upload semanal → Partidas + xG</strong> com a planilha Team Stats. As duas fontes são combinadas automaticamente pela data e adversário.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Temporada</span>
              <input value={season} onChange={e => setSeason(e.target.value)}
                className="mt-1 w-24 text-xs border border-gray-200 rounded-lg px-2.5 py-2" />
            </label>
            <label className="block">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Competição</span>
              <input value={competition} onChange={e => setCompetition(e.target.value)}
                className="mt-1 w-52 text-xs border border-gray-200 rounded-lg px-2.5 py-2" />
            </label>
            <label className="flex-1 min-w-[220px]">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Arquivo (.xlsx)</span>
              <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)}
                className="mt-1 w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5" />
            </label>
            <button type="submit" disabled={importing}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 disabled:opacity-50">
              {importing ? 'Importando...' : 'Importar jogos'}
            </button>
          </div>
          {importStatus && (
            <div className={`rounded-xl px-3 py-2 text-[11px] font-bold ${importStatus.type === 'ok' ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {importStatus.message}
            </div>
          )}
        </form>

        {loading && <Loading />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && matches.length === 0 && (
          <EmptyState title="Nenhum jogo importado ainda" description="Importe a planilha de jogos acima para começar a cadastrar rodada e posição." />
        )}

        {!loading && matches.length > 0 && (
          <>
            {pendingCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-2xl px-4 py-3">
                <p className="text-[11px] font-bold text-yellow-700">
                  {pendingCount} jogo(s) ainda sem rodada cadastrada — preencha na tabela abaixo pra eles entrarem nos gráficos.
                </p>
              </div>
            )}

            {summary && (
              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-sky-600 mb-1">Resumo automático</p>
                <p className="text-[12px] text-sky-800 leading-relaxed">{summary.text}</p>
              </div>
            )}

            {rounded.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Posição atual</p>
                  <p className="bc text-2xl font-black text-gray-800 mt-1">{dashboard?.last?.position ? `${dashboard.last.position}º` : '-'}</p>
                  <p className={`text-[9px] font-bold mt-1 ${summary?.posDelta > 0 ? 'text-sky-600' : summary?.posDelta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {summary?.posDelta == null ? 'sem comparação' : summary.posDelta > 0 ? `▲ ${summary.posDelta} posição(ões)` : summary.posDelta < 0 ? `▼ ${Math.abs(summary.posDelta)} posição(ões)` : 'posição mantida'}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Pontos últimos jogos</p>
                  <p className="bc text-2xl font-black text-gray-800 mt-1">{dashboard?.recentPoints ?? '-'}</p>
                  <p className="text-[9px] text-gray-400 mt-1">em {dashboard?.pointsMatches || 0} jogo(s), máx. {(dashboard?.pointsMatches || 0) * 3}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">xG da última partida</p>
                  <p className="bc text-2xl font-black text-sky-700 mt-1">{dashboard?.lastXg === null || dashboard?.lastXg === undefined ? '-' : formatShort(dashboard.lastXg)}</p>
                  <p className="text-[9px] text-gray-400 mt-1">xGA {dashboard?.lastXga === null || dashboard?.lastXga === undefined ? '-' : formatShort(dashboard.lastXga)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Saldo xG recente</p>
                  <p className={`bc text-2xl font-black mt-1 ${dashboard?.recentXgDiff > 0 ? 'text-sky-600' : dashboard?.recentXgDiff < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {dashboard?.recentXgDiff == null ? '-' : `${dashboard.recentXgDiff >= 0 ? '+' : ''}${formatShort(dashboard.recentXgDiff)}`}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1">últimos {dashboard?.xgMatches || 0} com xG</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Melhor evolução</p>
                  <p className="text-xs font-bold text-sky-600 mt-2 leading-tight">{summary?.best?.label || '-'}</p>
                  <p className="text-[9px] text-gray-400 mt-1">{summary?.best ? `${summary.best.v > 0 ? '+' : ''}${Math.round(summary.best.v * 100) / 100}` : 'sem rodada anterior'}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Alerta da rodada</p>
                  <p className="text-xs font-bold text-red-500 mt-2 leading-tight">{summary?.worst?.label || '-'}</p>
                  <p className="text-[9px] text-gray-400 mt-1">{summary?.worst ? `${Math.round(summary.worst.v * 100) / 100}` : 'sem queda identificada'}</p>
                </div>
              </div>
            )}

            {chartData.some(c => c.posicao !== null) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Posição do Confiança por rodada</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 22, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                    <YAxis reversed domain={[1, 20]} allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v}º lugar`, 'Posição']} />
                    <Line type="monotone" dataKey="posicao" stroke="#0a66b7" strokeWidth={2} dot={{ r: 4 }} connectNulls>
                      <LabelList dataKey="posicao" position="top" formatter={(v) => v == null ? '' : `${v}º`} style={{ fontSize: 9, fontWeight: 700 }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {xgData.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">xG x xGA por rodada</p>
                    <p className="text-[10px] text-gray-400 mt-1">Qualidade das chances criadas e concedidas em cada partida.</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={xgData} margin={{ top: 24, right: 22, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                    <Tooltip formatter={(v, name) => [formatShort(v), name === 'xg' ? 'xG' : 'xGA']} />
                    <Legend formatter={(value) => value === 'xg' ? 'xG' : 'xGA'} wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="xg" name="xg" stroke="#0a66b7" strokeWidth={2.5} dot={{ r: 4 }} connectNulls>
                      <LabelList dataKey="xg" position="top" formatter={(v) => v == null ? '' : Number(v).toFixed(2)} style={{ fontSize: 8, fontWeight: 700 }} />
                    </Line>
                    <Line type="monotone" dataKey="xga" name="xga" stroke="#64748b" strokeWidth={2} dot={{ r: 4 }} connectNulls>
                      <LabelList dataKey="xga" position="bottom" formatter={(v) => v == null ? '' : Number(v).toFixed(2)} style={{ fontSize: 8, fontWeight: 700 }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {pdfExpectedData.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="mb-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Snapshot esperado por rodada</p>
                  <p className="text-[10px] text-gray-400 mt-1">Curvas acumuladas do PDF semanal: xG, xGA e xPoints. Cada ponto representa o estado do campeonato naquela rodada.</p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={pdfExpectedData} margin={{ top: 24, right: 22, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                    <Tooltip formatter={(v, name) => [formatShort(v, 1), name === 'xg' ? 'xG acumulado' : name === 'xga' ? 'xGA acumulado' : name === 'xPoints' ? 'xPoints' : 'Pontos']} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="xg" name="xG" stroke="#0a66b7" strokeWidth={2.5} dot={{ r: 4 }} connectNulls>
                      <LabelList dataKey="xg" position="top" formatter={(v) => v == null ? '' : Number(v).toFixed(1)} style={{ fontSize: 8, fontWeight: 700 }} />
                    </Line>
                    <Line type="monotone" dataKey="xga" name="xGA" stroke="#64748b" strokeWidth={2} dot={{ r: 4 }} connectNulls>
                      <LabelList dataKey="xga" position="bottom" formatter={(v) => v == null ? '' : Number(v).toFixed(1)} style={{ fontSize: 8, fontWeight: 700 }} />
                    </Line>
                    <Line type="monotone" dataKey="xPoints" name="xPoints" stroke="#0f766e" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {rounded.length > 0 && TRACKED_METRICS.map(metricName => {
              const points = rounded
                .map(m => {
                  const col = findColumn(m.metrics, metricName)
                  const v = col ? toNumber(m.metrics[col]) : null
                  return { round: `R${m.round}`, valor: v }
                })
                .filter(p => p.valor !== null)
              if (points.length === 0) return null
              return (
                <div key={metricName} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">{metricName} por rodada</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={points} margin={{ top: 22, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="valor" stroke="#0a66b7" strokeWidth={2} dot={{ r: 3 }}>
                        <LabelList dataKey="valor" position="top" formatter={(v) => v == null ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} style={{ fontSize: 8, fontWeight: 700 }} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            })}

            {/* Tabela editável: rodada e posição de cada jogo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Cadastro de rodada e posição</p>
              </div>
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70">
                      <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-left">Data</th>
                      <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-left">Adversário</th>
                      <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Placar</th>
                      <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">xG</th>
                      <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">xGA</th>
                      <th className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Índice</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Rodada</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Posição</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches
                      .slice()
                      .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))
                      .map(m => <MatchRow key={m.id} match={m} onSave={saveMatch} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
