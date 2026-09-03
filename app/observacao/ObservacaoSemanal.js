'use client'
import { useState, useEffect } from 'react'

const BRAND_PRIMARY = '#0a66b7'

function getWeekKey(dateStr) {
  if (!dateStr) return 'Sem data'
  const d = new Date(dateStr + 'T12:00')
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - diffToMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const startOfYear = new Date(start.getFullYear(), 0, 4)
  const weekNum = Math.ceil(((start - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  const fmt = (dd) => dd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${weekNum}ª Semana · ${fmt(start)} - ${fmt(end)}/${end.getFullYear()}`
}

export default function ObservacaoSemanal() {
  const [partidas,    setPartidas]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [semanaFil,   setSemanaFil]   = useState('Todas')
  // Multi-seleção: array de campeonatos selecionados. Vazio = "Todos"
  const [campsAtivos, setCampsAtivos] = useState([])
  const [exportando,  setExportando]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/export-relatorio?tipo=semanal').then(r => r.json())
      setPartidas(res.partidas || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // Lista de campeonatos únicos (sem "Todos")
  const campeonatos = Array.from(new Set(partidas.map(p => p.competicao).filter(Boolean))).sort()

  function toggleCamp(c) {
    setCampsAtivos(prev => {
      if (prev.includes(c)) {
        return prev.filter(x => x !== c)
      } else {
        return [...prev, c]
      }
    })
    setSemanaFil('Todas')
  }

  function limparFiltros() {
    setCampsAtivos([])
    setSemanaFil('Todas')
  }

  // Filtrar por campeonatos selecionados (vazio = todos)
  const partidasFiltradas = campsAtivos.length === 0
    ? partidas
    : partidas.filter(p => campsAtivos.includes(p.competicao))

  // Agrupar por semana
  const semanas = {}
  for (const p of partidasFiltradas) {
    const sk = getWeekKey(p.data_jogo)
    if (!semanas[sk]) semanas[sk] = []
    semanas[sk].push(p)
  }
  const semanasKeys = Object.keys(semanas).sort().reverse()

  const filtradas = semanaFil === 'Todas' ? semanasKeys : semanasKeys.filter(s => s === semanaFil)

  // Label para o PDF
  const campLabel = campsAtivos.length === 0
    ? 'Todos os Campeonatos'
    : campsAtivos.length === 1
      ? campsAtivos[0]
      : `${campsAtivos.length} Campeonatos`

  async function exportarPDF() {
    setExportando(true)
    try {
      const jspdfMod  = await import('jspdf')
      const jsPDF     = jspdfMod.jsPDF ?? jspdfMod.default
      const atMod     = await import('jspdf-autotable')
      const autoTable = atMod.autoTable ?? atMod.default

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()   // 210
      const H = doc.internal.pageSize.getHeight()  // 297
      const margin = 14
      const contentW = W - margin * 2

      const semanasFil = semanaFil === 'Todas' ? semanasKeys : [semanaFil]

      // ─── Capa ────────────────────────────────────────────────────────────
      doc.setFillColor(10, 102, 183)
      doc.rect(0, 0, W, 40, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text('OBSERVAÇÃO SEMANAL', margin, 18)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('CIC CONFIANÇA  ·  Confidencial', margin, 26)
      doc.setFontSize(9)
      doc.text(campLabel, margin, 33)

      // Data de geração
      doc.setFontSize(8)
      doc.setTextColor(200, 230, 210)
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W - margin, 33, { align: 'right' })

      doc.setTextColor(0, 0, 0)

      let y = 50
      let pageNum = 1

      function addFooter() {
        const total = doc.internal.getNumberOfPages()
        for (let p = 1; p <= total; p++) {
          doc.setPage(p)
          doc.setDrawColor(200, 225, 210)
          doc.line(margin, H - 12, W - margin, H - 12)
          doc.setFontSize(7)
          doc.setTextColor(150)
          doc.text(`CIC Confiança — Observação Semanal — Pág ${p}/${total} — Confidencial`, margin, H - 7)
          doc.text(new Date().toLocaleDateString('pt-BR'), W - margin, H - 7, { align: 'right' })
        }
      }

      function checkPageBreak(neededY) {
        if (neededY > H - 20) {
          doc.addPage()
          pageNum++
          // linha decorativa no topo
          doc.setFillColor(10, 102, 183)
          doc.rect(0, 0, W, 8, 'F')
          return 16
        }
        return neededY
      }

      for (const sk of semanasFil) {
        // ── Header da semana ──────────────────────────────────────────────
        y = checkPageBreak(y + 14)

        doc.setFillColor(10, 102, 183)
        doc.roundedRect(margin, y - 6, contentW, 12, 2, 2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(sk, margin + 4, y + 1)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`${semanas[sk].length} partida${semanas[sk].length > 1 ? 's' : ''}`, W - margin - 2, y + 1, { align: 'right' })
        doc.setTextColor(0, 0, 0)
        y += 10

        for (const p of semanas[sk]) {
          const rel    = p.relatorio || {}
          const allAv  = [...(rel.sumula_mandante_avaliados || []), ...(rel.sumula_visitante_avaliados || [])]
          const temDestaque = allAv.some(a => (a.recomendacao || '').toLowerCase().includes('contratar'))
          const temMonitor  = allAv.some(a => (a.recomendacao || '').toLowerCase().includes('monitorar'))

          // Estimativa de espaço necessário para o bloco de partida
          const estimatedH = 14 + (allAv.length > 0 ? allAv.length * 7 + 14 : 0)
          y = checkPageBreak(y + estimatedH) - estimatedH

          // ── Cabeçalho da partida ────────────────────────────────────────
          doc.setFillColor(240, 250, 244)
          doc.roundedRect(margin, y, contentW, 13, 2, 2, 'F')
          doc.setDrawColor(180, 220, 195)
          doc.roundedRect(margin, y, contentW, 13, 2, 2, 'S')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.setTextColor(0, 80, 40)
          doc.text(`${p.mandante}  ×  ${p.visitante}`, margin + 3, y + 5.5)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(80, 110, 90)
          const metaLine = [
            p.competicao || '',
            p.data_jogo ? new Date(p.data_jogo + 'T12:00').toLocaleDateString('pt-BR') : '',
            `Destaque: ${temDestaque ? 'SIM' : 'NÃO'}`,
            `Monitoramento: ${temMonitor ? 'SIM' : 'NÃO'}`,
          ].filter(Boolean).join('  ·  ')
          doc.text(metaLine, margin + 3, y + 10.5)

          doc.setTextColor(0, 0, 0)
          y += 15

          // ── Tabela de atletas ───────────────────────────────────────────
          if (allAv.length > 0) {
            autoTable(doc, {
              startY: y,
              margin: { left: margin, right: margin },
              tableWidth: contentW,
              headStyles: {
                fillColor: [220, 240, 228],
                textColor: [0, 70, 35],
                fontSize: 7,
                fontStyle: 'bold',
                halign: 'left',
              },
              styles: {
                fontSize: 7.5,
                cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
                textColor: [40, 60, 45],
                lineColor: [220, 240, 228],
                lineWidth: 0.3,
              },
              alternateRowStyles: { fillColor: [248, 253, 250] },
              columnStyles: {
                0: { cellWidth: 42, fontStyle: 'bold', textColor: [0, 60, 30] }, // Atleta
                1: { cellWidth: 32 },  // Clube
                2: { cellWidth: 38 },  // Posição
                3: { cellWidth: 12 },  // Pé
                4: { cellWidth: 14 },  // Altura
                5: { cellWidth: 38 },  // Decisão
                6: { cellWidth: 14, halign: 'center' },  // Nota
              },
              head: [['Atleta', 'Clube', 'Posição', 'Pé', 'Alt.', 'Decisão', 'Nota']],
              body: allAv.map(a => [
                a.nome || '-',
                a.time_nome || '-',
                a.posicao || '-',
                a.pe_preferido || '-',
                a.altura ? String(a.altura) : '-',
                a.recomendacao || '-',
                a.nota_jogo || '-',
              ]),
              theme: 'grid',
              didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                  const val = (data.cell.raw || '').toLowerCase()
                  if (val.includes('contratar')) {
                    data.cell.styles.textColor = [22, 101, 52]
                    data.cell.styles.fontStyle = 'bold'
                  } else if (val.includes('monitorar')) {
                    data.cell.styles.textColor = [30, 64, 175]
                  }
                }
              },
            })
            y = (doc.lastAutoTable?.finalY ?? y + allAv.length * 7) + 6
          } else {
            doc.setFontSize(7.5)
            doc.setTextColor(150, 180, 160)
            doc.text('Nenhum atleta avaliado nesta partida.', margin + 3, y + 4)
            y += 10
          }

          y += 2 // espaço entre partidas
        }

        y += 6 // espaço entre semanas
      }

      addFooter()

      const suffixCamp = campsAtivos.length === 1 ? `_${campsAtivos[0].replace(/[^a-zA-Z0-9]/g, '_')}` : ''
      doc.save(`observacao_semanal${suffixCamp}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`)
    } finally { setExportando(false) }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, color: '#94a3b8', marginBottom: 4 }}>Auto-populado pelos Relatórios</p>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: BRAND_PRIMARY, textTransform: 'uppercase', lineHeight: 1 }}>Observação Semanal</h2>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{partidas.length} partidas nos últimos 14 dias</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #c6def2', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: BRAND_PRIMARY, background: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>🔄 Atualizar</button>
          <button onClick={exportarPDF} disabled={exportando} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: '#fff', background: BRAND_PRIMARY, display: 'flex', alignItems: 'center', gap: 6, opacity: exportando ? 0.7 : 1 }}>
            📄 {exportando ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Filtro por Campeonato — MULTI-SELEÇÃO */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#94a3b8' }}>Campeonato</p>
          {campsAtivos.length > 0 && (
            <button
              onClick={limparFiltros}
              style={{ fontSize: 9, fontWeight: 700, color: '#e05252', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Limpar ({campsAtivos.length})
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Botão "Todos" — limpa seleção */}
          <button
            onClick={limparFiltros}
            style={{
              padding: '5px 11px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 10, fontWeight: 700,
              background: campsAtivos.length === 0 ? BRAND_PRIMARY : '#f7fcf9',
              color: campsAtivos.length === 0 ? '#fff' : '#52677e',
              borderColor: campsAtivos.length === 0 ? BRAND_PRIMARY : '#d6e5f0',
            }}
          >
            Todos os Campeonatos
          </button>

          {campeonatos.map(c => {
            const ativo = campsAtivos.includes(c)
            return (
              <button
                key={c}
                onClick={() => toggleCamp(c)}
                style={{
                  padding: '5px 11px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 10, fontWeight: 700,
                  background: ativo ? BRAND_PRIMARY : '#f7fcf9',
                  color: ativo ? '#fff' : '#52677e',
                  borderColor: ativo ? BRAND_PRIMARY : '#d6e5f0',
                }}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtro de semana */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['Todas', ...semanasKeys].map(s => (
          <button key={s} onClick={() => setSemanaFil(s)} style={{
            padding: '6px 12px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 10, fontWeight: 700,
            background: semanaFil === s ? BRAND_PRIMARY : '#f7fcf9',
            color: semanaFil === s ? '#fff' : '#52677e',
            borderColor: semanaFil === s ? BRAND_PRIMARY : '#d6e5f0',
          }}>
            {s === 'Todas' ? 'Todas as Semanas' : s}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 120, background: '#f7fcf9', borderRadius: 12 }} />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <p style={{ fontSize: 32 }}>📋</p>
          <p style={{ fontSize: 14, fontWeight: 700 }}>Nenhuma observação encontrada</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Os relatórios salvos aparecem aqui automaticamente</p>
        </div>
      ) : filtradas.map(sk => (
        <div key={sk} style={{ marginBottom: 24 }}>
          {/* Header semana */}
          <div style={{ background: BRAND_PRIMARY, borderRadius: '12px 12px 0 0', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed',sans-serif" }}>{sk}</p>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{semanas[sk].length} partida{semanas[sk].length > 1 ? 's' : ''}</span>
          </div>

          <div style={{ border: '1px solid #e5edf5', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            {semanas[sk].map((p, idx) => {
              const rel   = p.relatorio || {}
              const allAv = [...(rel.sumula_mandante_avaliados || []), ...(rel.sumula_visitante_avaliados || [])]
              const temDestaque = allAv.some(a => (a.recomendacao || '').toLowerCase().includes('contratar'))
              const temMonitor  = allAv.some(a => (a.recomendacao || '').toLowerCase().includes('monitorar'))

              return (
                <div key={p.match_key} style={{ borderBottom: idx < semanas[sk].length - 1 ? '1px solid #f4f8fc' : 'none' }}>
                  {/* Linha do jogo */}
                  <div style={{ padding: '12px 16px', background: '#f7fcf9', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#10233b' }}>{p.mandante} <span style={{ color: '#c0d8c4' }}>×</span> {p.visitante}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#e8f4ec', color: '#52677e' }}>{p.competicao}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>📅 {p.data_jogo ? new Date(p.data_jogo + 'T12:00').toLocaleDateString('pt-BR') : '—'}</span>
                    {temDestaque && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#f0fdf4', color: '#166534', border: '1px solid #86efac' }}>🎯 Destaque: SIM</span>}
                    {temMonitor  && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1e40af', border: '1px solid #93c5fd' }}>👁 Monitoramento: SIM</span>}
                    {!temDestaque && !temMonitor && allAv.length > 0 && <span style={{ fontSize: 10, color: '#94a3b8' }}>Sem destaques para contratação</span>}
                    {allAv.length === 0 && <span style={{ fontSize: 10, color: '#94a3b8' }}>Nenhum atleta avaliado</span>}
                  </div>

                  {/* Atletas avaliados — tabela estilo destaques da rodada */}
                  {allAv.length > 0 && (
                    <div style={{ padding: '8px 16px 12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#1e293b' }}>
                            {['Atleta', 'Clube', 'Posição', 'Pé', 'Alt.', 'Decisão', 'Nota'].map(h => (
                              <th key={h} style={{
                                padding: '6px 10px',
                                textAlign: 'left',
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: 'white',
                                borderRight: '1px solid #334155',
                                whiteSpace: 'nowrap',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allAv.map((a, i) => {
                            const rec = (a.recomendacao || '').toLowerCase()
                            const recColor = rec.includes('contratar')
                              ? { color: '#166534', bg: '#dcfce7', border: '#86efac' }
                              : rec.includes('monitorar')
                                ? { color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' }
                                : rec.includes('ver mais') || rec.includes('observar')
                                  ? { color: '#92400e', bg: '#fef3c7', border: '#fde68a' }
                                  : { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' }
                            const nota = a.nota_jogo || '-'
                            return (
                              <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fdf9', borderBottom: '1px solid #e8f4ec' }}>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #f4f8fc', fontWeight: 800, color: '#10233b', whiteSpace: 'nowrap' }}>
                                  {a.nome || '—'}
                                </td>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #f4f8fc', color: '#52677e', whiteSpace: 'nowrap' }}>
                                  {a.time_nome || '—'}
                                </td>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #f4f8fc', color: '#52677e' }}>
                                  {a.posicao || '—'}
                                </td>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #f4f8fc', color: '#52677e', textAlign: 'center' }}>
                                  {a.pe_preferido || '—'}
                                </td>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #f4f8fc', color: '#52677e', textAlign: 'center' }}>
                                  {a.altura || '—'}
                                </td>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #f4f8fc' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 9px',
                                    borderRadius: 6,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: recColor.bg,
                                    color: recColor.color,
                                    border: `1px solid ${recColor.border}`,
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {a.recomendacao || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                  {nota !== '-' && nota !== '—' ? (
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontSize: 10,
                                      fontWeight: 800,
                                      background: '#f0fdf4',
                                      color: BRAND_PRIMARY,
                                      border: '1px solid #86efac',
                                    }}>
                                      {nota}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: 10 }}>—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
