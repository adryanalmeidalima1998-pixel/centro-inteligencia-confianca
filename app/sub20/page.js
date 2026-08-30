'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, ChevronDown, ChevronUp, Download, FileSpreadsheet, Search, SlidersHorizontal, UploadCloud, UsersRound } from 'lucide-react'
import {
  Button, C, EmptyState, Field, Kpi, LoadingState, PageHeader, Panel, ScoutingPage, StatusDot, inputStyle,
} from '@/app/components/scouting/ScoutingUI'

const PAGE_SIZE_OPTIONS = [50, 100, 250, 0]

function number(value, decimals = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return parsed.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function formatUpdateDate(value) {
  if (!value) return 'data não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function scoreTone(value) {
  const score = Number(value)
  if (score >= 75) return C.green
  if (score >= 60) return '#0f766e'
  if (score >= 45) return C.amber
  return C.red
}

function ScorePill({ value, label }) {
  const tone = scoreTone(value)
  return <div style={{ minWidth: 58, textAlign: 'center' }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 45, padding: '6px 8px', borderRadius: 9, background: `${tone}12`, border: `1px solid ${tone}28`, color: tone, fontSize: 11, fontWeight: 950 }}>{number(value, 1)}</span>
    {label && <p style={{ marginTop: 3, fontSize: 7.5, color: C.muted, fontWeight: 800, textTransform: 'uppercase' }}>{label}</p>}
  </div>
}

function Confidence({ value }) {
  const score = Number(value) || 0
  const tone = score >= 75 ? C.green : score >= 50 ? C.amber : C.red
  return <div style={{ minWidth: 82 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 8.5, color: C.muted, marginBottom: 4 }}><span>Amostra</span><strong style={{ color: tone }}>{score}%</strong></div>
    <div style={{ height: 5, borderRadius: 99, background: '#edf3ef', overflow: 'hidden' }}><div style={{ width: `${score}%`, height: '100%', background: tone, borderRadius: 99 }} /></div>
  </div>
}

function RankBadge({ rank, reference }) {
  const podium = rank <= 3
  const tone = rank === 1 ? '#b7791f' : rank === 2 ? '#64748b' : rank === 3 ? '#92400e' : C.green
  return <div style={{ width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', background: podium ? `${tone}13` : C.green2, border: `1px solid ${podium ? `${tone}35` : C.green3}` }}>
    <div style={{ textAlign: 'center' }}><strong style={{ display: 'block', fontSize: rank > 999 ? 12 : 15, color: tone, lineHeight: 1 }}>#{rank || '—'}</strong><span style={{ fontSize: 6.8, color: C.muted, fontWeight: 850, textTransform: 'uppercase' }}>{reference === 'league' ? 'liga' : 'geral'}</span></div>
  </div>
}

function SortableHeader({ label, sortKey, activeSort, direction, align = 'center', onSort }) {
  const active = activeSort === sortKey
  const Icon = active ? (direction === 'asc' ? ChevronUp : ChevronDown) : ArrowUpDown
  const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
  return <th style={{ textAlign: align, padding: 0, borderBottom: `1px solid ${active ? C.green : C.line}`, background: active ? C.green2 : '#fbfdfb' }}>
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      title={`Ordenar por ${label}`}
      style={{ width: '100%', minHeight: 39, padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent, gap: 5, border: 0, background: 'transparent', color: active ? C.green : C.muted, fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.55px', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      <span>{label}</span><Icon size={11} strokeWidth={active ? 3 : 2} />
    </button>
  </th>
}

function StaticHeader({ label, align = 'center' }) {
  return <th style={{ textAlign: align, padding: '11px 10px', borderBottom: `1px solid ${C.line}`, background: '#fbfdfb', color: C.muted, fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.55px', whiteSpace: 'nowrap' }}>{label}</th>
}

function downloadCompletePdf(players, meta, setPdfLoading) {
  return async () => {
    setPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
      const width = 297
      const height = 210
      const green = [10, 102, 183]
      const dark = [19, 41, 28]
      const muted = [100, 116, 107]
      const line = [221, 236, 228]
      const light = [244, 249, 245]
      const softGreen = [232, 245, 237]
      const ordered = [...players].sort((a, b) => (a.rankGlobal || 9999) - (b.rankGlobal || 9999))
      const generated = new Date().toLocaleDateString('pt-BR')
      const fitText = (value, maxWidth) => {
        const text = String(value ?? '—')
        if (doc.getTextWidth(text) <= maxWidth) return text
        let reduced = text
        while (reduced.length > 2 && doc.getTextWidth(`${reduced}…`) > maxWidth) reduced = reduced.slice(0, -1)
        return `${reduced}…`
      }

      doc.setFillColor(...green)
      doc.rect(0, 0, width, height, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(27)
      doc.text('RANKING SUB-20', 18, 42)
      doc.setFontSize(15)
      doc.text('América do Sul', 18, 52)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Ranking completo por percentis posicionais, com referência global e por liga.', 18, 63)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(18, 80, 82, 44, 4, 4, 'F')
      doc.roundedRect(108, 80, 82, 44, 4, 4, 'F')
      doc.roundedRect(198, 80, 82, 44, 4, 4, 'F')
      const coverStats = [
        [String(meta.totalPlayers), 'ATLETAS RANQUEADOS'],
        [String(meta.totalLeagues), 'LIGAS DA BASE'],
        [String(meta.totalClubs), 'CLUBES REPRESENTADOS'],
      ]
      coverStats.forEach(([value, label], index) => {
        const x = 18 + index * 90
        doc.setTextColor(...green)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(23)
        doc.text(value, x + 8, 100)
        doc.setTextColor(...muted)
        doc.setFontSize(7.5)
        doc.text(label, x + 8, 112)
      })
      doc.setTextColor(228, 246, 235)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Fonte: ${meta.source || 'SUB20 AMÉRICA DO SUL.xlsx'}`, 18, 183)
      doc.text(`Gerado em ${generated}`, 18, 190)
      doc.text('CIC | Central de Inteligência', 279, 190, { align: 'right' })

      const marginX = 10
      const tableWidth = width - marginX * 2
      const headerY = 21
      const headerHeight = 9
      const rowStartY = 33
      const rowHeight = 9.6
      const rowGap = 1.2
      const perPage = 15
      const totalPages = Math.ceil(ordered.length / perPage)
      const columns = [
        { key: 'rank', label: '#', width: 14, align: 'center' },
        { key: 'athlete', label: 'ATLETA', width: 58, align: 'left' },
        { key: 'club', label: 'CLUBE', width: 42, align: 'left' },
        { key: 'league', label: 'LIGA', width: 28, align: 'left' },
        { key: 'position', label: 'POSIÇÃO', width: 26, align: 'left' },
        { key: 'age', label: 'IDADE', width: 14, align: 'center' },
        { key: 'minutes', label: 'MIN.', width: 17, align: 'center' },
        { key: 'goals', label: 'G', width: 9, align: 'center' },
        { key: 'assists', label: 'A', width: 9, align: 'center' },
        { key: 'global', label: 'ÍND. GLOBAL', width: 20, align: 'center' },
        { key: 'leagueScore', label: 'ÍND. LIGA', width: 20, align: 'center' },
        { key: 'sample', label: 'AMOSTRA', width: 20, align: 'center' },
      ]

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        doc.addPage('a4', 'landscape')
        doc.setFillColor(...light)
        doc.rect(0, 0, width, height, 'F')
        doc.setFillColor(...green)
        doc.rect(0, 0, width, 14, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('RANKING SUB-20 | AMÉRICA DO SUL', 10, 9)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(`Página ${pageIndex + 1} de ${totalPages}`, 287, 9, { align: 'right' })

        doc.setFillColor(...dark)
        doc.roundedRect(marginX, headerY, tableWidth, headerHeight, 2.2, 2.2, 'F')
        let headerX = marginX
        columns.forEach(column => {
          doc.setTextColor(255, 255, 255)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(5.5)
          const textX = column.align === 'center' ? headerX + column.width / 2 : headerX + 2.5
          doc.text(column.label, textX, headerY + 5.8, { align: column.align === 'center' ? 'center' : 'left' })
          headerX += column.width
        })

        const pagePlayers = ordered.slice(pageIndex * perPage, pageIndex * perPage + perPage)
        pagePlayers.forEach((player, index) => {
          const y = rowStartY + index * (rowHeight + rowGap)
          doc.setFillColor(255, 255, 255)
          doc.setDrawColor(...line)
          doc.roundedRect(marginX, y, tableWidth, rowHeight, 2.1, 2.1, 'FD')
          doc.setFillColor(...green)
          doc.roundedRect(marginX, y, 2.3, rowHeight, 2.1, 2.1, 'F')
          doc.rect(marginX + 1.1, y, 1.2, rowHeight, 'F')

          let x = marginX
          columns.forEach(column => {
            const centerX = x + column.width / 2
            if (column.key === 'rank') {
              const rank = Number(player.rankGlobal) || 0
              const podium = rank <= 3
              doc.setFillColor(...(podium ? [251, 244, 225] : softGreen))
              doc.roundedRect(centerX - 5.2, y + 1.6, 10.4, 6.4, 1.6, 1.6, 'F')
              doc.setTextColor(...(podium ? [146, 99, 24] : green))
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(6.4)
              doc.text(`#${rank || '—'}`, centerX, y + 5.8, { align: 'center' })
            } else if (column.key === 'athlete') {
              doc.setTextColor(...dark)
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(6.6)
              doc.text(fitText(player.nome, column.width - 5), x + 2.5, y + 4.1)
              doc.setTextColor(...muted)
              doc.setFont('helvetica', 'normal')
              doc.setFontSize(4.8)
              doc.text(fitText(player.roleLabel || player.roleShort, column.width - 5), x + 2.5, y + 7.3)
            } else if (column.key === 'club') {
              doc.setTextColor(...dark)
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(5.7)
              doc.text(fitText(player.equipa, column.width - 5), x + 2.5, y + 5.7)
            } else if (column.key === 'league') {
              doc.setFillColor(...softGreen)
              doc.roundedRect(x + 2, y + 2, column.width - 4, 5.7, 1.5, 1.5, 'F')
              doc.setTextColor(...green)
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(4.8)
              doc.text(fitText(player.liga, column.width - 7), centerX, y + 5.8, { align: 'center' })
            } else if (column.key === 'position') {
              doc.setTextColor(...dark)
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(5.4)
              doc.text(fitText(player.posicao || player.roleShort, column.width - 5), x + 2.5, y + 4.5)
              doc.setTextColor(...muted)
              doc.setFontSize(4.4)
              doc.text(fitText(player.roleShort, column.width - 5), x + 2.5, y + 7.3)
            } else if (column.key === 'global' || column.key === 'leagueScore') {
              const value = column.key === 'global' ? player.globalScore : player.leagueScore
              const score = Number(value)
              const scoreColor = score >= 75 ? green : score >= 60 ? [15, 118, 110] : score >= 45 ? [183, 121, 31] : [185, 52, 52]
              doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2])
              doc.roundedRect(centerX - 6.1, y + 1.5, 12.2, 6.6, 1.8, 1.8, 'F')
              doc.setTextColor(255, 255, 255)
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(6.2)
              doc.text(number(value, 1), centerX, y + 5.8, { align: 'center' })
            } else if (column.key === 'sample') {
              const confidence = Math.max(0, Math.min(100, Number(player.sampleConfidence) || 0))
              doc.setTextColor(...dark)
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(5.4)
              doc.text(`${confidence}%`, centerX, y + 4, { align: 'center' })
              doc.setFillColor(235, 242, 238)
              doc.roundedRect(x + 3, y + 6, column.width - 6, 1.5, .7, .7, 'F')
              doc.setFillColor(...green)
              doc.roundedRect(x + 3, y + 6, (column.width - 6) * confidence / 100, 1.5, .7, .7, 'F')
            } else {
              const values = {
                age: number(player.idade), minutes: number(player.minutos), goals: number(player.gols), assists: number(player.assistencias),
              }
              doc.setTextColor(...dark)
              doc.setFont('helvetica', column.key === 'minutes' ? 'bold' : 'normal')
              doc.setFontSize(6)
              doc.text(values[column.key] || '—', centerX, y + 5.8, { align: 'center' })
            }
            x += column.width
          })
        })

        doc.setTextColor(...muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.8)
        doc.text('Índice por percentis posicionais, ponderado por amostra e cobertura. Todos os atletas estão incluídos.', 10, 205)
        doc.text('CIC | Central de Inteligência', 287, 205, { align: 'right' })
      }
      doc.save('ranking-sub20-america-do-sul.pdf')
    } finally {
      setPdfLoading(false)
    }
  }
}

export default function Sub20RankingPage() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [league, setLeague] = useState('all')
  const [role, setRole] = useState('all')
  const [minimumMinutes, setMinimumMinutes] = useState(0)
  const [reference, setReference] = useState('global')
  const [sort, setSort] = useState('globalScore')
  const [direction, setDirection] = useState('desc')
  const [pageSize, setPageSize] = useState(0)
  const [page, setPage] = useState(1)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const fileInputRef = useRef(null)

  async function loadRanking({ silent = false } = {}) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/sub20', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar a base Sub-20.')
      setPayload(body)
    } catch (err) {
      setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { loadRanking() }, [])

  async function handleSpreadsheetUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/sub20', { method: 'POST', body: formData })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível importar a planilha.')
      setUploadMessage(`Base atualizada: ${number(body.rowCount)} atletas em ${number(body.leagueCount)} ligas.`)
      await loadRanking({ silent: true })
    } catch (err) {
      setUploadMessage(`Erro no upload: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => { setPage(1) }, [search, league, role, minimumMinutes, reference, sort, direction, pageSize])

  const changeSort = sortKey => {
    if (sort === sortKey) {
      setDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSort(sortKey)
    setDirection(sortKey === 'nome' || sortKey === 'idade' ? 'asc' : 'desc')
  }

  const filtered = useMemo(() => {
    if (!payload?.players) return []
    const needle = normalizeSearch(search)
    const rankKey = reference === 'league' ? 'rankLeague' : 'rankGlobal'
    const rows = payload.players.filter(player => {
      if (league !== 'all' && player.liga !== league) return false
      if (role !== 'all' && player.roleKey !== role) return false
      if ((Number(player.minutos) || 0) < Number(minimumMinutes || 0)) return false
      if (needle && !normalizeSearch(`${player.nome} ${player.equipa} ${player.equipaAtual || ''} ${player.liga} ${player.posicao}`).includes(needle)) return false
      return true
    })
    return rows.sort((a, b) => {
      const textSort = sort === 'nome'
      const av = textSort ? String(a[sort] || '').trim() : Number(a[sort])
      const bv = textSort ? String(b[sort] || '').trim() : Number(b[sort])
      const aValid = textSort ? Boolean(av) : Number.isFinite(av)
      const bValid = textSort ? Boolean(bv) : Number.isFinite(bv)
      if (!aValid && !bValid) return (Number(a[rankKey]) || 9999) - (Number(b[rankKey]) || 9999)
      if (!aValid) return 1
      if (!bValid) return -1
      let compare = textSort ? av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' }) : av - bv
      if (direction === 'desc') compare *= -1
      return compare || (Number(a[rankKey]) || 9999) - (Number(b[rankKey]) || 9999)
    })
  }, [payload, search, league, role, minimumMinutes, reference, sort, direction])

  const totalPages = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1
  const visible = pageSize ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered
  const rankKey = reference === 'league' ? 'rankLeague' : 'rankGlobal'
  const meta = payload?.meta

  if (loading) return <ScoutingPage><LoadingState text="Montando ranking percentílico de 13 ligas..." /></ScoutingPage>
  if (error) return <ScoutingPage><EmptyState icon="⚠️" title="Ranking indisponível" text={error} /></ScoutingPage>

  return <ScoutingPage maxWidth={1540}>
    <PageHeader
      eyebrow="CIC · MERCADO SUB-20"
      title="Ranking Sub-20 · América do Sul"
      subtitle="Todos os atletas da planilha são ranqueados com todas as métricas de desempenho elegíveis para a posição, convertidas em percentis e ajustadas pela amostra e pela cobertura. A liga é definida pela aba do Excel e o clube exibido é o clube do período analisado."
      status={<StatusDot color={C.green}>{meta.totalPlayers} atletas ativos</StatusDot>}
      actions={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleSpreadsheetUpload} style={{ display: 'none' }} />
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}><UploadCloud size={15} />{uploading ? 'Importando...' : 'Atualizar Excel'}</Button>
        <Button onClick={downloadCompletePdf(payload.players, { ...meta, source: payload.source }, setPdfLoading)} disabled={pdfLoading}><Download size={15} />{pdfLoading ? 'Gerando PDF...' : `PDF completo · ${meta.totalPlayers}`}</Button>
      </div>}
    />

    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 11, alignItems: 'center', padding: '11px 13px', marginBottom: 14, borderRadius: 13, border: `1px solid ${uploadMessage.startsWith('Erro') ? '#fecaca' : C.green3}`, background: uploadMessage.startsWith('Erro') ? '#fff7f7' : C.green2 }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: '#fff', border: `1px solid ${C.green3}` }}><FileSpreadsheet size={18} color={C.green} /></div>
      <div><strong style={{ color: C.ink, fontSize: 10.5 }}>{payload.source || 'SUB20 AMÉRICA DO SUL.xlsx'}</strong><p style={{ color: C.muted, fontSize: 8.8, marginTop: 2 }}>Última atualização: {formatUpdateDate(payload.uploadedAt || payload.generatedAt)} · {payload.storage === 'database' ? 'upload semanal ativo' : 'base incluída no projeto'}{uploadMessage ? ` · ${uploadMessage}` : ''}</p></div>
    </div>

    <div className="cig-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
      <Kpi label="Atletas ranqueados" value={number(meta.totalPlayers)} sub="Sem corte de top 10 ou top 20" icon="👤" />
      <Kpi label="Ligas" value={number(meta.totalLeagues)} sub="Abas importadas da planilha" icon="🌎" tone={C.blue} />
      <Kpi label="Clubes" value={number(meta.totalClubs)} sub="Clube do período em cada liga" icon="🛡️" tone={C.purple} />
      <Kpi label="Mediana de minutos" value={number(meta.medianMinutes)} sub={`${number(meta.averageMetricCoverage, 1)} métricas usadas por atleta`} icon="⏱️" tone={C.amber} />
    </div>

    <Panel title="Filtros do ranking" subtitle="A lista continua completa; use o seletor ou clique nos títulos da tabela para ordenar." action={<SlidersHorizontal size={16} color={C.green} />} style={{ marginBottom: 16 }}>
      <div className="cig-auto-grid" style={{ gap: 10 }}>
        <Field label="Buscar atleta ou clube"><div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: C.muted }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, clube, liga..." style={{ ...inputStyle, paddingLeft: 31 }} /></div></Field>
        <Field label="Liga"><select value={league} onChange={event => { const value = event.target.value; setLeague(value); setReference(value === 'all' ? 'global' : 'league') }} style={inputStyle}><option value="all">Todas as ligas</option>{meta.leagues.map(item => <option key={item.name} value={item.name}>{item.name} · {item.players}</option>)}</select></Field>
        <Field label="Grupo posicional"><select value={role} onChange={event => setRole(event.target.value)} style={inputStyle}><option value="all">Todas as posições</option>{meta.roles.map(item => <option key={item.key} value={item.key}>{item.label} · {item.players}</option>)}</select></Field>
        <Field label="Minutos mínimos"><select value={minimumMinutes} onChange={event => setMinimumMinutes(Number(event.target.value))} style={inputStyle}>{[0, 90, 180, 270, 450, 900].map(value => <option key={value} value={value}>{value === 0 ? 'Sem corte' : `${value}+ min`}</option>)}</select></Field>
        <Field label="Referência"><select value={reference} onChange={event => setReference(event.target.value)} style={inputStyle}><option value="global">Base completa</option><option value="league">Própria liga</option></select></Field>
        <Field label="Ordenar por"><select value={sort} onChange={event => changeSort(event.target.value)} style={inputStyle}><option value="globalScore">Índice global</option><option value="leagueScore">Índice da liga</option><option value="idade">Idade</option><option value="minutos">Minutagem</option><option value="gols">Gols</option><option value="assistencias">Assistências</option><option value="sampleConfidence">Amostra</option><option value="nome">Nome</option></select></Field>
        <Field label="Direção"><select value={direction} onChange={event => setDirection(event.target.value)} style={inputStyle}><option value="desc">{sort === 'nome' ? 'Z para A' : 'Maior para menor'}</option><option value="asc">{sort === 'nome' ? 'A para Z' : 'Menor para maior'}</option></select></Field>
      </div>
    </Panel>

    <Panel
      title={`Ranking completo · ${number(filtered.length)} atletas no recorte`}
      subtitle={reference === 'league' ? 'Índice com todas as métricas elegíveis, calculado dentro da liga e do grupo posicional.' : 'Índice com todas as métricas elegíveis, calculado contra toda a base e dentro do grupo posicional.'}
      action={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><UsersRound size={15} color={C.green} /><select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} style={{ ...inputStyle, width: 115, padding: '7px 8px' }}>{PAGE_SIZE_OPTIONS.map(value => <option key={value} value={value}>{value ? `${value} por página` : 'Mostrar todos'}</option>)}</select></div>}
      bodyStyle={{ padding: 0 }}
    >
      {!visible.length ? <EmptyState icon="🔎" title="Nenhum atleta no recorte" text="Ajuste liga, posição, minutos mínimos ou termo de busca." /> : <div className="scout-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180, display: 'table' }}>
          <thead><tr>
            <StaticHeader label="Ranking" />
            <SortableHeader label="Atleta" sortKey="nome" activeSort={sort} direction={direction} align="left" onSort={changeSort} />
            <StaticHeader label="Liga" align="left" />
            <StaticHeader label="Posição" align="left" />
            <SortableHeader label="Idade" sortKey="idade" activeSort={sort} direction={direction} onSort={changeSort} />
            <SortableHeader label="Min." sortKey="minutos" activeSort={sort} direction={direction} onSort={changeSort} />
            <SortableHeader label="G" sortKey="gols" activeSort={sort} direction={direction} onSort={changeSort} />
            <SortableHeader label="A" sortKey="assistencias" activeSort={sort} direction={direction} onSort={changeSort} />
            <SortableHeader label="Índice global" sortKey="globalScore" activeSort={sort} direction={direction} onSort={changeSort} />
            <SortableHeader label="Índice liga" sortKey="leagueScore" activeSort={sort} direction={direction} onSort={changeSort} />
            <SortableHeader label="Amostra" sortKey="sampleConfidence" activeSort={sort} direction={direction} align="left" onSort={changeSort} />
          </tr></thead>
          <tbody>{visible.map((player, index) => <tr key={player.id} className="scout-hover" style={{ borderBottom: `1px solid ${C.line}`, background: '#fff' }}>
            <td style={{ padding: '9px 10px', textAlign: 'center' }}><RankBadge rank={player[rankKey]} reference={reference} /></td>
            <td style={{ padding: '9px 10px', minWidth: 250 }}><Link href={`/sub20/${player.id}`} style={{ color: C.green, fontSize: 12, fontWeight: 950 }}>{player.nome}</Link><p style={{ marginTop: 3, color: C.muted, fontSize: 9.2 }}>{player.equipa} · {player.roleLabel}</p>{player.equipaAtual && player.equipaAtual !== player.equipa && <p style={{ marginTop: 2, color: '#94a3b8', fontSize: 7.8 }}>Atual: {player.equipaAtual}</p>}</td>
            <td style={{ padding: '9px 10px' }}><span style={{ padding: '5px 8px', borderRadius: 8, background: C.green2, color: C.green, fontSize: 8.8, fontWeight: 850, whiteSpace: 'nowrap' }}>{player.liga}</span></td>
            <td style={{ padding: '9px 10px', color: C.ink, fontSize: 10, fontWeight: 750 }}>{player.posicao}<p style={{ color: C.muted, fontSize: 8, marginTop: 2 }}>{player.roleShort}</p></td>
            <td style={{ padding: '9px 10px', textAlign: 'center', color: C.ink, fontSize: 10.5 }}>{number(player.idade)}</td>
            <td style={{ padding: '9px 10px', textAlign: 'center', color: C.ink, fontSize: 10.5, fontWeight: 800 }}>{number(player.minutos)}</td>
            <td style={{ padding: '9px 10px', textAlign: 'center', color: C.ink, fontSize: 10.5 }}>{number(player.gols)}</td>
            <td style={{ padding: '9px 10px', textAlign: 'center', color: C.ink, fontSize: 10.5 }}>{number(player.assistencias)}</td>
            <td style={{ padding: '9px 10px', textAlign: 'center' }}><ScorePill value={player.globalScore} label={`#${player.rankGlobal}`} /></td>
            <td style={{ padding: '9px 10px', textAlign: 'center' }}><ScorePill value={player.leagueScore} label={`#${player.rankLeague}`} /></td>
            <td style={{ padding: '9px 10px' }}><Confidence value={player.sampleConfidence} /></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {pageSize && totalPages > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${C.line}`, background: '#fbfdfb' }}>
        <p style={{ fontSize: 9.5, color: C.muted }}>Exibindo {number((page - 1) * pageSize + 1)} a {number(Math.min(page * pageSize, filtered.length))} de {number(filtered.length)} atletas.</p>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</Button><span style={{ fontSize: 9.5, color: C.muted, minWidth: 80, textAlign: 'center' }}>Página {page} de {totalPages}</span><Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Próxima</Button></div>
      </div>}
    </Panel>
  </ScoutingPage>
}
