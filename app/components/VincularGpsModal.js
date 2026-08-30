'use client'
import { useState, useMemo } from 'react'
import { normName } from '@/lib/nameMatch'

// Modal pra correlacionar nomes da planilha (bem-estar/PSE) com os nomes do GPS.
// O match automático (fuzzy) já resolve a maioria. Aqui o usuário corrige os
// casos de apelido / nome muito diferente, gravando em player_aliases.
export default function VincularGpsModal({
  isOpen, onClose, wellnessNames = [], gpsNames = [], aliases = [], resolveGps, onSaved,
}) {
  const [busy, setBusy] = useState(null)   // nome em processamento
  const [filter, setFilter] = useState('pendentes') // 'pendentes' | 'todos'

  // alias manual existente por nome de bem-estar (canonical_name == wellness)
  const manualByWellness = useMemo(() => {
    const m = {}
    aliases.forEach(a => {
      if (a.source === 'gps') m[normName(a.canonical_name)] = a // { id, source_name, ... }
    })
    return m
  }, [aliases])

  const linhas = useMemo(() => {
    return wellnessNames.map(w => {
      const manual = manualByWellness[normName(w)] || null
      const gps = resolveGps ? resolveGps(w) : ''
      let status = 'sem'           // sem match
      if (gps && manual) status = 'manual'
      else if (gps) status = 'auto'
      return { wellness: w, gps, manual, status }
    })
  }, [wellnessNames, manualByWellness, resolveGps])

  const visiveis = filter === 'pendentes'
    ? linhas.filter(l => l.status !== 'auto') // mostra sem match + manuais (o que precisa de olho)
    : linhas

  const pendentes = linhas.filter(l => l.status === 'sem').length

  if (!isOpen) return null

  async function vincular(wellness, gpsName) {
    setBusy(wellness)
    try {
      await fetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_name: gpsName, canonical_name: wellness, source: 'gps' }),
      })
      if (onSaved) await onSaved()
    } catch (e) { console.error(e) }
    finally { setBusy(null) }
  }

  async function desvincular(manual, wellness) {
    if (!manual?.id) return
    setBusy(wellness)
    try {
      await fetch(`/api/aliases/${manual.id}`, { method: 'DELETE' })
      if (onSaved) await onSaved()
    } catch (e) { console.error(e) }
    finally { setBusy(null) }
  }

  const G = { verde:'#0B7C3D', amarelo:'#FDB913', azul:'#1E3A8A', vermelho:'#DC2626', cinza:'#9CA3AF' }
  const badge = {
    auto:   { txt:'AUTOMÁTICO', bg:'#DCFCE7', fg:'#166534' },
    manual: { txt:'MANUAL',     bg:'#DBEAFE', fg:'#1E40AF' },
    sem:    { txt:'SEM MATCH',  bg:'#FEE2E2', fg:'#991B1B' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="dm bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background:G.verde }}>
          <div>
            <h3 className="text-white text-lg font-black">🔗 Vincular nomes ao GPS</h3>
            <p className="text-white/80 text-[11px] font-bold">
              {wellnessNames.length} atletas na planilha · {gpsNames.length} nomes no GPS · {pendentes} sem match
            </p>
          </div>
          <button onClick={onClose} className="text-white text-2xl font-black leading-none px-2">×</button>
        </div>

        {/* Filtro */}
        <div className="px-6 py-3 flex items-center gap-2 border-b">
          {['pendentes','todos'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all"
              style={ filter === f
                ? { background:G.verde, color:'#fff' }
                : { background:'#F3F4F6', color:'#6B7280' } }>
              {f === 'pendentes' ? 'Precisam de atenção' : 'Todos'}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-gray-400 font-bold">
            O match automático já cobre acento, abreviação e nome do meio. Ajuste só apelidos.
          </span>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {visiveis.length === 0 && (
            <p className="text-center text-gray-400 font-bold py-8 text-sm">
              Tudo certo por aqui. Nenhum nome pendente. 👌
            </p>
          )}
          {visiveis.map(l => {
            const b = badge[l.status]
            const loading = busy === l.wellness
            return (
              <div key={l.wellness}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 border"
                style={{ borderColor: l.status==='sem' ? '#FCA5A5' : '#E5E7EB', background: l.status==='sem' ? '#FEF2F2' : '#fff' }}>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-800 truncate">{l.wellness}</p>
                  <p className="text-[10px] font-bold" style={{ color: l.gps ? G.verde : G.vermelho }}>
                    {l.gps ? `→ ${l.gps}` : '→ nenhum nome de GPS encontrado'}
                  </p>
                </div>

                <span className="text-[8px] font-black uppercase px-2 py-1 rounded-full shrink-0"
                  style={{ background:b.bg, color:b.fg }}>{b.txt}</span>

                <select
                  disabled={loading}
                  value={l.manual ? l.manual.source_name : ''}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '') { if (l.manual) desvincular(l.manual, l.wellness) }
                    else vincular(l.wellness, v)
                  }}
                  className="border-2 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none shrink-0 max-w-[180px]"
                  style={{ borderColor:G.amarelo, background:'#fff' }}>
                  <option value="">{l.status === 'auto' ? '(automático)' : 'Escolher GPS...'}</option>
                  {[...gpsNames].sort().map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                {loading && <span className="text-[10px] font-black text-gray-400 shrink-0">⟳</span>}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-between">
          <span className="text-[10px] text-gray-400 font-bold">
            Vínculos manuais ficam salvos (player_aliases) e valem em todas as abas.
          </span>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-black text-white"
            style={{ background:G.verde }}>Concluir</button>
        </div>
      </div>
    </div>
  )
}
