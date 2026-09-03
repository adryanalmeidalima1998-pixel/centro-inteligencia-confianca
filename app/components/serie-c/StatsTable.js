// app/components/serie-c/StatsTable.js
'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { ClubTag } from './ui'
import { formatMetricValue } from '../../../lib/serieC'

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

export default function StatsTable({
  columns,
  rows,
  rowKey,
  isClubRow,
  defaultSortKey,
  defaultSortDir = 'desc',
  searchable = true,
  searchPlaceholder = 'Buscar na tabela...',
  pageSize: initialPageSize = 25,
  exportFilename = 'serie-c-estatisticas.csv',
  embedded = false,
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey || columns[0]?.key)
  const [sortDir, setSortDir] = useState(defaultSortDir)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return rows || []
    const query = search.toLowerCase().trim()
    return (rows || []).filter(row => {
      const text = [row.player, row.team, row.position, row.age, row.minutes, row.profile]
        .filter(value => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase()
      return text.includes(query)
    })
  }, [rows, search, searchable])

  const sorted = useMemo(() => {
    const col = columns.find(column => column.key === sortKey)
    if (!col) return filtered
    const getValue = col.sortValue || col.render
    return filtered.map(row => ({ row, value: getValue ? getValue(row) : row[col.key] }))
      .sort((a, b) => {
        const av = a.value
        const bv = b.value
        const an = typeof av === 'number' ? av : Number(av)
        const bn = typeof bv === 'number' ? bv : Number(bv)
        let comparison
        if (Number.isFinite(an) && Number.isFinite(bn)) comparison = an - bn
        else comparison = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR')
        return sortDir === 'asc' ? comparison : -comparison
      })
      .map(item => item.row)
  }, [filtered, columns, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const visibleRows = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize])

  useEffect(() => { setPage(1) }, [search, sortKey, sortDir, pageSize, rows])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(direction => direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function cellRaw(col, row) {
    return col.render ? col.render(row) : row[col.key]
  }

  function renderCell(col, row) {
    const raw = cellRaw(col, row)
    if (raw === null || raw === undefined || raw === '') return '-'
    if (typeof raw === 'number') return formatMetricValue(col.label || col.key, raw, { per90Mode: String(col.key).includes('__p90') })
    return raw
  }

  function exportCsv() {
    const header = columns.map(column => csvCell(column.label)).join(';')
    const lines = sorted.map(row => columns.map(column => {
      const raw = cellRaw(column, row)
      if (typeof raw === 'number') return csvCell(formatMetricValue(column.label || column.key, raw, { per90Mode: String(column.key).includes('__p90') }))
      return csvCell(raw)
    }).join(';'))
    const blob = new Blob([`\ufeff${[header, ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = exportFilename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-xs font-medium text-gray-400">Nenhum dado disponível para os filtros selecionados.</p>
      </div>
    )
  }

  const wrapperClass = embedded ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-3 py-3">
        {searchable ? (
          <div className="relative w-full md:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={searchPlaceholder} className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2 pl-9 pr-3 text-[11px] font-medium text-gray-600 outline-none focus:border-sky-200 focus:bg-white" />
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-gray-300">{sorted.length} registros</span>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:border-sky-200 hover:text-sky-700">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-100 bg-gray-50/95 backdrop-blur">
              {columns.map((column, index) => (
                <th key={column.key} onClick={() => toggleSort(column.key)} className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 ${index === 0 ? 'sticky left-0 z-20 bg-gray-50/95' : ''} ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}>
                  {column.label}{sortKey === column.key ? sortDir === 'asc' ? ' ↑' : ' ↓' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibleRows.map(row => {
              const isCurrentClub = isClubRow ? isClubRow(row) : false
              return (
                <tr key={rowKey(row)} className={isCurrentClub ? 'bg-sky-50/70' : 'hover:bg-gray-50/60'}>
                  {columns.map((column, index) => (
                    <td key={column.key} className={`whitespace-nowrap px-3 py-2 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'} ${index === 0 ? `sticky left-0 z-[1] ${isCurrentClub ? 'bg-sky-50' : 'bg-white'} font-bold text-gray-700` : 'text-gray-600'}`}>
                      <div className={`flex items-center gap-1.5 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                        {index === 0 && isCurrentClub ? <ClubTag /> : null}
                        <span>{renderCell(column, row)}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-3 py-2.5">
        <p className="text-[9px] font-semibold text-gray-400">
          Mostrando {sorted.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, sorted.length)} de {sorted.length}
        </p>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[9px] font-bold text-gray-500">
            {[10, 25, 50, 100].map(value => <option key={value} value={value}>{value} / página</option>)}
          </select>
          <button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-30"><ChevronLeft size={13} /></button>
          <span className="min-w-[52px] text-center text-[9px] font-black text-gray-500">{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-30"><ChevronRight size={13} /></button>
        </div>
      </div>
    </div>
  )
}
