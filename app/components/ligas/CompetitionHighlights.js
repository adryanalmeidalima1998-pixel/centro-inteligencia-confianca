'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, GripVertical, Link2, Pencil, Plus, RefreshCcw, Save, Search, Sparkles, X } from 'lucide-react'
import PlayerMaterialLinks from '@/app/components/ligas/PlayerMaterialLinks'

const GFC = '#0a66b7'
const GFC_DARK = '#064b82'
const MAX_HIGHLIGHTS = 8

function sourceLabel(source) {
  if (source === 'wyscout') return 'Wyscout'
  if (source === 'sportsbase') return 'Sportsbase'
  return 'Automático'
}

function selectionPayload(selection) {
  const fields = [
    'key', 'identityKey', 'canonicalId', 'nome', 'equipa', 'posicao', 'pe',
    'idade', 'minutos', 'jogos', 'score', 'performance', 'coverage', 'profile',
    'strongest', 'source', 'videoUrl', 'ogolUrl',
  ]
  return Object.fromEntries(Object.entries(selection || {}).map(([group, players]) => [
    group,
    (players || []).map(player => Object.fromEntries(
      fields.filter(field => player?.[field] !== undefined).map(field => [field, player[field]])
    )),
  ]))
}

function samePlayers(a = [], b = []) {
  return a.length === b.length && a.every((player, index) => player?.key === b[index]?.key)
}

function scoreTone(score) {
  if (score >= 80) return { bg:'#dcfce7', text:'#166534', bar:'#0a66b7' }
  if (score >= 70) return { bg:'#ecfccb', text:'#3f6212', bar:'#65a30d' }
  if (score >= 60) return { bg:'#fef3c7', text:'#92400e', bar:'#d97706' }
  return { bg:'#f1f5f9', text:'#475569', bar:'#64748b' }
}

function footLabel(value) {
  const foot = String(value || '').toLowerCase()
  if (foot.includes('left') || foot.includes('esq')) return 'Canhoto'
  if (foot.includes('both') || foot.includes('amb')) return 'Ambidestro'
  if (foot.includes('right') || foot.includes('dir')) return 'Destro'
  return null
}

function PlayerRow({
  player,
  rank,
  color,
  editable,
  onEdit,
  onLinks,
  dragging = false,
  dropTarget = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const tone = scoreTone(player.score)
  const hasLinks = Boolean(player.videoUrl || player.ogolUrl)
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display:'grid',
        gridTemplateColumns:'48px minmax(0,1fr) 58px 86px',
        gap:10,
        alignItems:'center',
        padding:'12px 14px',
        borderTop:`1px solid ${dropTarget ? color : '#eef3ef'}`,
        background:dropTarget ? `${color}0D` : rank === 1 ? '#fbfefc' : '#fff',
        opacity:dragging ? .5 : 1,
        boxShadow:dropTarget ? `inset 0 2px 0 ${color}` : 'none',
        transition:'background .15s ease, opacity .15s ease, box-shadow .15s ease',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:3 }}>
        {editable ? (
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            title="Arraste para mudar a posição no ranking"
            aria-label={`Arrastar ${player.nome} no ranking`}
            style={{ width:13, height:28, display:'grid', placeItems:'center', color:'#94a3b8', cursor:'grab', userSelect:'none' }}
          >
            <GripVertical size={14} />
          </span>
        ) : null}
        <div style={{ position:'relative', width:32, height:32, borderRadius:10, display:'grid', placeItems:'center', background:rank === 1 ? color : '#f1f5f9', color:rank === 1 ? '#fff' : '#64748b', fontSize:12, fontWeight:950 }}>
          #{rank}
        </div>
      </div>
      <div style={{ minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
          <p style={{ margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12, fontWeight:900, color:'#10233b' }}>{player.nome}</p>
          {player.idade ? <span style={{ fontSize:8.5, color:'#64748b', background:'#f1f5f9', borderRadius:99, padding:'2px 5px', flexShrink:0 }}>{player.idade}a</span> : null}
        </div>
        <p style={{ margin:'3px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:9.5, color:'#64748b' }}>
          {player.equipa} · {player.profile}
        </p>
        <div style={{ margin:'4px 0 0', display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
          <p style={{ margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:8.5, color:'#94a3b8', flex:1 }}>
            {[player.strongest, footLabel(player.pe), player.minutos ? `${player.minutos} min` : null].filter(Boolean).join(' · ') || 'Destaque estatístico da função'}
          </p>
          {player.videoUrl ? <a href={player.videoUrl} target="_blank" rel="noopener noreferrer" title="Abrir material de vídeo" style={{ color:'#2563eb', fontSize:8, fontWeight:900, textDecoration:'none', flexShrink:0 }}>VÍDEO ↗</a> : null}
          {player.ogolUrl ? <a href={player.ogolUrl} target="_blank" rel="noopener noreferrer" title="Abrir perfil no oGol" style={{ color:GFC, fontSize:8, fontWeight:900, textDecoration:'none', flexShrink:0 }}>OGOL ↗</a> : null}
        </div>
      </div>
      <div style={{ textAlign:'right' }}>
        <span style={{ display:'inline-block', minWidth:44, borderRadius:9, padding:'5px 7px', background:tone.bg, color:tone.text, fontSize:15, fontWeight:950 }}>{Math.round(player.score)}</span>
        <div style={{ width:48, height:4, margin:'5px 0 0 auto', borderRadius:99, background:'#e2e8f0', overflow:'hidden' }}>
          <div style={{ width:`${Math.max(4, Math.min(100, player.score))}%`, height:'100%', background:tone.bar }} />
        </div>
      </div>
      {editable ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:5 }}>
          <button
            type="button"
            title={hasLinks ? 'Editar links do atleta' : 'Adicionar links do atleta'}
            onClick={onLinks}
            style={{ height:28, minWidth:51, padding:'0 7px', border:`1px solid ${hasLinks ? '#bfdbfe' : '#dbe7f2'}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', gap:4, background:hasLinks ? '#eff6ff' : '#fff', color:hasLinks ? '#2563eb' : GFC, cursor:'pointer', fontSize:8, fontWeight:900 }}
          >
            <Link2 size={12} /> Links
          </button>
          <button type="button" title="Substituir atleta nesta posição" onClick={onEdit} style={{ width:28, height:28, border:'1px solid #dbe7f2', borderRadius:8, display:'grid', placeItems:'center', background:'#fff', color:GFC, cursor:'pointer' }}>
            <Pencil size={13} />
          </button>
        </div>
      ) : <span />}
    </div>
  )
}

function EmptyRow({ rank, color, editable, onEdit, dropTarget = false, onDragOver, onDrop }) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display:'grid',
        gridTemplateColumns:'48px minmax(0,1fr) 58px 86px',
        gap:10,
        alignItems:'center',
        padding:'12px 14px',
        borderTop:`1px solid ${dropTarget ? color : '#eef3ef'}`,
        background:dropTarget ? `${color}0D` : '#fff',
        boxShadow:dropTarget ? `inset 0 2px 0 ${color}` : 'none',
      }}
    >
      <div style={{ width:45, display:'flex', justifyContent:'flex-end' }}>
        <div style={{ width:32, height:32, borderRadius:10, display:'grid', placeItems:'center', background:'#f1f5f9', color:'#94a3b8', fontSize:12, fontWeight:950 }}>#{rank}</div>
      </div>
      <p style={{ margin:0, fontSize:10.5, color:'#94a3b8' }}>Sem atleta elegível nesta posição</p>
      <span />
      {editable ? <div style={{ display:'flex', justifyContent:'flex-end' }}><button type="button" title="Selecionar atleta para esta posição" onClick={onEdit} style={{ width:28, height:28, border:'1px solid #dbe7f2', borderRadius:8, display:'grid', placeItems:'center', background:'#fff', color:GFC, cursor:'pointer' }}><Pencil size={13} /></button></div> : <span />}
    </div>
  )
}

function HighlightCard({
  group,
  players,
  editable,
  onEdit,
  onAdd,
  onLinks,
  onReset,
  dragState,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const manual = !samePlayers(players, group.automatic)
  return (
    <section style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:16, overflow:'hidden', boxShadow:'0 8px 24px rgba(19,60,38,.06)' }}>
      <div style={{ padding:'13px 15px', background:`linear-gradient(135deg, ${group.color}18, #fff 68%)`, borderBottom:`3px solid ${group.color}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ minWidth:40, height:30, borderRadius:9, display:'grid', placeItems:'center', background:group.color, color:'#fff', fontSize:10, fontWeight:950 }}>{group.shortLabel}</span>
            <div>
              <h3 style={{ margin:0, fontSize:14, fontWeight:950, color:'#173d29' }}>{group.label}</h3>
              <p style={{ margin:'2px 0 0', fontSize:8.5, color:'#64748b' }}>Até {MAX_HIGHLIGHTS} destaques da competição</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {editable ? (
              <button
                type="button"
                onClick={onAdd}
                title="Adicionar atleta em qualquer posição do ranking"
                style={{ height:25, padding:'0 8px', border:'1px solid #cbdfee', borderRadius:8, display:'flex', alignItems:'center', gap:4, background:'#fff', color:GFC, cursor:'pointer', fontSize:8.5, fontWeight:900 }}
              >
                <Plus size={12} /> Adicionar
              </button>
            ) : null}
            <span style={{ borderRadius:99, padding:'4px 7px', background:manual ? '#fff7ed' : '#eaf4fd', color:manual ? '#c2410c' : '#07579e', fontSize:8.5, fontWeight:900 }}>{manual ? 'Curadoria' : 'Automático'}</span>
            {editable && manual ? <button type="button" onClick={onReset} title={`Restaurar top ${MAX_HIGHLIGHTS} automático`} style={{ border:'none', background:'transparent', color:'#64748b', cursor:'pointer', padding:3 }}><RefreshCcw size={13} /></button> : null}
          </div>
        </div>
      </div>
      {Array.from({ length:MAX_HIGHLIGHTS }, (_, index) => {
        const player = players?.[index]
        const dragging = dragState?.groupId === group.id && dragState?.fromIndex === index
        const dropTarget = dragState?.groupId === group.id && dragState?.overIndex === index && dragState?.fromIndex !== index
        return player
          ? (
            <PlayerRow
              key={`${player.key}-${index}`}
              player={player}
              rank={index + 1}
              color={group.color}
              editable={editable}
              onEdit={() => onEdit(index)}
              onLinks={() => onLinks(index, player)}
              dragging={dragging}
              dropTarget={dropTarget}
              onDragStart={event => onDragStart(event, group.id, index)}
              onDragOver={event => onDragOver(event, group.id, index)}
              onDrop={event => onDrop(event, group.id, index)}
              onDragEnd={onDragEnd}
            />
          )
          : (
            <EmptyRow
              key={index}
              rank={index + 1}
              color={group.color}
              editable={editable}
              onEdit={() => onEdit(index)}
              dropTarget={dropTarget}
              onDragOver={event => onDragOver(event, group.id, index)}
              onDrop={event => onDrop(event, group.id, index)}
            />
          )
      })}
    </section>
  )
}

function PlayerPicker({ group, allCandidates, slot, mode = 'replace', currentSelection, onChoose, onClose }) {
  const [search, setSearch] = useState('')
  const [targetSlot, setTargetSlot] = useState(() => Math.max(0, Math.min(MAX_HIGHLIGHTS - 1, slot ?? currentSelection?.length ?? 0)))
  const selectedKeys = new Set((currentSelection || []).map(player => player?.key).filter(Boolean))
  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    const pool = allCandidates?.length ? allCandidates : group?.candidates || []
    return pool
      .filter(player => {
        if (mode === 'insert') return !selectedKeys.has(player.key)
        return !selectedKeys.has(player.key) || currentSelection?.[targetSlot]?.key === player.key
      })
      .filter(player => !term || `${player.nome} ${player.equipa} ${player.posicao} ${player.profile}`.toLowerCase().includes(term))
      .slice(0, 80)
  }, [allCandidates, group, currentSelection, mode, search, selectedKeys, targetSlot])

  const inserting = mode === 'insert'

  return (
    <div onMouseDown={event => event.target === event.currentTarget && onClose()} style={{ position:'fixed', inset:0, zIndex:1000, display:'grid', placeItems:'center', padding:18, background:'rgba(3,20,10,.58)', backdropFilter:'blur(3px)' }}>
      <div style={{ width:'100%', maxWidth:620, maxHeight:'86vh', display:'flex', flexDirection:'column', background:'#fff', borderRadius:18, overflow:'hidden', boxShadow:'0 28px 80px rgba(0,0,0,.3)' }}>
        <div style={{ padding:'16px 18px', background:`linear-gradient(135deg,${group.color},${GFC_DARK})`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <p style={{ margin:0, fontSize:9, textTransform:'uppercase', letterSpacing:'.12em', opacity:.72 }}>
              Curadoria manual · {inserting ? `inserir na posição ${targetSlot + 1}` : `substituir posição ${targetSlot + 1}`}
            </p>
            <h3 style={{ margin:'4px 0 0', fontSize:17, fontWeight:950 }}>{inserting ? 'Adicionar atleta em' : 'Selecionar atleta para'} {group.label.toLowerCase()}</h3>
          </div>
          <button type="button" onClick={onClose} style={{ width:32, height:32, border:'1px solid rgba(255,255,255,.28)', borderRadius:9, display:'grid', placeItems:'center', background:'rgba(255,255,255,.1)', color:'#fff', cursor:'pointer' }}><X size={17} /></button>
        </div>

        {inserting ? (
          <div style={{ padding:'12px 14px 4px', borderBottom:'1px solid #edf4ef' }}>
            <p style={{ margin:'0 0 8px', fontSize:9, fontWeight:900, color:'#64748b' }}>POSIÇÃO NO RANKING</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(8,minmax(0,1fr))', gap:6 }}>
              {Array.from({ length:MAX_HIGHLIGHTS }, (_, index) => {
                const active = targetSlot === index
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setTargetSlot(index)}
                    style={{ height:30, border:`1px solid ${active ? group.color : '#dbe7f2'}`, borderRadius:8, background:active ? `${group.color}14` : '#fff', color:active ? group.color : '#64748b', cursor:'pointer', fontSize:10, fontWeight:950 }}
                  >
                    #{index + 1}
                  </button>
                )
              })}
            </div>
            <p style={{ margin:'7px 0 0', fontSize:8.5, color:'#94a3b8' }}>O novo atleta entra na posição escolhida e os demais descem uma colocação. Se o top 8 estiver completo, o último sai da lista.</p>
          </div>
        ) : null}

        <div style={{ padding:14, borderBottom:'1px solid #edf4ef' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid #dbe7f2', borderRadius:10, padding:'9px 11px' }}>
            <Search size={15} color="#64748b" />
            <input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar qualquer atleta, equipe ou posição" style={{ flex:1, border:'none', outline:'none', fontSize:12, color:'#10233b' }} />
          </div>
        </div>
        <div style={{ overflowY:'auto', padding:10 }}>
          {candidates.map(player => {
            const tone = scoreTone(player.score)
            return (
              <button key={player.key} type="button" onClick={() => onChoose(player, targetSlot)} style={{ width:'100%', display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:12, alignItems:'center', textAlign:'left', border:'1px solid #edf4ef', borderRadius:11, padding:'11px 12px', marginBottom:7, background:'#fff', cursor:'pointer' }}>
                <div style={{ minWidth:0 }}>
                  <p style={{ margin:0, fontSize:12, fontWeight:900, color:'#10233b' }}>{player.nome}</p>
                  <p style={{ margin:'3px 0 0', fontSize:9.5, color:'#64748b' }}>{player.equipa} · {player.posicao || player.profile}</p>
                  <p style={{ margin:'3px 0 0', fontSize:8.5, color:'#94a3b8' }}>{player.profile}{player.strongest ? ` · ${player.strongest}` : ''}</p>
                </div>
                <span style={{ minWidth:46, textAlign:'center', borderRadius:9, padding:'6px 8px', background:tone.bg, color:tone.text, fontSize:15, fontWeight:950 }}>{Math.round(player.score)}</span>
              </button>
            )
          })}
          {!candidates.length ? <div style={{ padding:32, textAlign:'center', fontSize:11, color:'#94a3b8' }}>Nenhum atleta encontrado na competição.</div> : null}
        </div>
      </div>
    </div>
  )
}

function PlayerLinksModal({ slug, player, onSaved, onClose }) {
  return (
    <div onMouseDown={event => event.target === event.currentTarget && onClose()} style={{ position:'fixed', inset:0, zIndex:1010, display:'grid', placeItems:'center', padding:18, background:'rgba(3,20,10,.58)', backdropFilter:'blur(3px)' }}>
      <div style={{ width:'100%', maxWidth:680, maxHeight:'88vh', overflowY:'auto', background:'#f5faf6', borderRadius:18, boxShadow:'0 28px 80px rgba(0,0,0,.3)' }}>
        <div style={{ position:'sticky', top:0, zIndex:2, padding:'16px 18px', background:`linear-gradient(135deg,#2563eb,${GFC_DARK})`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ minWidth:0 }}>
            <p style={{ margin:0, fontSize:9, textTransform:'uppercase', letterSpacing:'.12em', opacity:.72 }}>Materiais do atleta</p>
            <h3 style={{ margin:'4px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:17, fontWeight:950 }}>{player.nome}</h3>
            <p style={{ margin:'3px 0 0', fontSize:9.5, opacity:.76 }}>{player.equipa}</p>
          </div>
          <button type="button" onClick={onClose} style={{ width:32, height:32, flexShrink:0, border:'1px solid rgba(255,255,255,.28)', borderRadius:9, display:'grid', placeItems:'center', background:'rgba(255,255,255,.1)', color:'#fff', cursor:'pointer' }}><X size={17} /></button>
        </div>
        <div style={{ padding:16 }}>
          <PlayerMaterialLinks slug={slug} player={player} onSaved={onSaved} />
          <p style={{ margin:'0 2px', fontSize:9, lineHeight:1.5, color:'#64748b' }}>O botão <b>Links</b> serve apenas para cadastrar ou editar o vídeo e o perfil no oGol. O lápis continua exclusivo para substituir o atleta na curadoria.</p>
        </div>
      </div>
    </div>
  )
}

function hexToRgb(hex) {
  const value = String(hex || '#0a66b7').replace('#', '')
  const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

function safeText(value) {
  return String(value || '').replace(/[–—]/g, '-').replace(/×/g, 'x')
}

function exportFilename(value, extension) {
  const base = String(value || 'competicao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'competicao'
  return `destaques-${base}.${extension}`
}

function validHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''))
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

async function exportHighlightsPdf({ leagueName, source, groups, selection, logo }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const pageWidth = 297
  const pageHeight = 210
  const margin = 12
  const gap = 6
  const headerHeight = 27
  const footerHeight = 8
  const columns = 2
  const rowsPerPage = 2
  const cardsPerPage = columns * rowsPerPage
  const cardWidth = (pageWidth - margin * 2 - gap) / columns
  const cardHeight = 74.5
  const contentTop = margin + headerHeight + 6
  const rowHeight = (cardHeight - 13) / MAX_HIGHLIGHTS

  const fitText = (value, maxWidth) => {
    const text = safeText(value)
    if (doc.getTextWidth(text) <= maxWidth) return text
    let shortened = text
    while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) shortened = shortened.slice(0, -1)
    return `${shortened}...`
  }

  const drawHeader = page => {
    const [r, g, b] = hexToRgb(GFC_DARK)
    doc.setFillColor(r, g, b)
    doc.roundedRect(margin, margin, pageWidth - margin * 2, headerHeight, 4, 4, 'F')
    let textX = margin + 9
    if (logo) {
      try {
        const format = String(logo).includes('image/jpeg') ? 'JPEG' : 'PNG'
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(margin + 5, margin + 4, 19, 19, 3, 3, 'F')
        doc.addImage(logo, format, margin + 7, margin + 6, 15, 15, undefined, 'FAST')
        textX = margin + 29
      } catch {}
    }
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('DESTAQUES DA COMPETICAO', textX, margin + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`${safeText(leagueName)} | Fonte: ${sourceLabel(source)}`, textX, margin + 17)
    doc.setFontSize(7.2)
    doc.setTextColor(205, 230, 214)
    doc.text(`Ate ${MAX_HIGHLIGHTS} atletas por posicao | Botoes VID e OGOL sao clicaveis quando cadastrados`, textX, margin + 22)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.text(`Pagina ${page}`, pageWidth - margin - 8, margin + 10, { align:'right' })
    doc.setFontSize(7)
    doc.text(new Date().toLocaleDateString('pt-BR'), pageWidth - margin - 8, margin + 17, { align:'right' })
  }

  const drawLinkPill = (label, url, x, y, width, color) => {
    if (!validHttpUrl(url)) return
    const [r, g, b] = hexToRgb(color)
    doc.setFillColor(r, g, b)
    doc.roundedRect(x, y, width, 4.3, 1.2, 1.2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(4.5)
    doc.text(label, x + width / 2, y + 2.9, { align:'center' })
    doc.link(x, y, width, 4.3, { url })
  }

  const drawCard = (group, players, x, y) => {
    const [r, g, b] = hexToRgb(group.color)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(220, 231, 223)
    doc.roundedRect(x, y, cardWidth, cardHeight, 3.5, 3.5, 'FD')
    doc.setFillColor(r, g, b)
    doc.roundedRect(x, y, cardWidth, 13, 3.5, 3.5, 'F')
    doc.rect(x, y + 9, cardWidth, 4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(safeText(group.label).toUpperCase(), x + 5, y + 8.3)
    doc.setFontSize(7)
    doc.text(`TOP ${MAX_HIGHLIGHTS}`, x + cardWidth - 5, y + 8.3, { align:'right' })

    for (let index = 0; index < MAX_HIGHLIGHTS; index += 1) {
      const player = players?.[index]
      const rowY = y + 13 + index * rowHeight
      if (index % 2 === 0) {
        doc.setFillColor(248, 252, 249)
        doc.rect(x + .4, rowY, cardWidth - .8, rowHeight, 'F')
      }
      doc.setDrawColor(238, 244, 239)
      doc.line(x + 4, rowY + rowHeight, x + cardWidth - 4, rowY + rowHeight)
      doc.setFillColor(index === 0 ? r : 241, index === 0 ? g : 245, index === 0 ? b : 249)
      doc.roundedRect(x + 4, rowY + 1.35, 7.5, 5.2, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(index === 0 ? 255 : 100, index === 0 ? 255 : 116, index === 0 ? 255 : 139)
      doc.text(`#${index + 1}`, x + 7.75, rowY + 4.75, { align:'center' })
      if (!player) {
        doc.setTextColor(148, 163, 184)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.6)
        doc.text('Sem atleta elegivel', x + 14, rowY + 4.6)
        continue
      }

      const scoreX = x + cardWidth - 16
      const nameMaxWidth = cardWidth - 35
      doc.setTextColor(24, 56, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.text(fitText(player.nome, nameMaxWidth), x + 14, rowY + 3.2)

      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(4.8)
      const hasVideo = validHttpUrl(player.videoUrl)
      const hasOgol = validHttpUrl(player.ogolUrl)
      const linkCount = Number(hasVideo) + Number(hasOgol)
      const linkWidth = 9
      const linkGap = 1.2
      const linksWidth = linkCount ? linkCount * linkWidth + (linkCount - 1) * linkGap : 0
      const linksStart = scoreX - 2 - linksWidth
      const subtitleWidth = Math.max(28, linksStart - (x + 14) - 2)
      const subtitle = `${safeText(player.equipa)} | ${safeText(player.profile)}`
      doc.text(fitText(subtitle, subtitleWidth), x + 14, rowY + 6.15)

      let linkX = linksStart
      if (hasVideo) {
        drawLinkPill('VID', player.videoUrl, linkX, rowY + 1.7, linkWidth, '#2563eb')
        linkX += linkWidth + linkGap
      }
      if (hasOgol) drawLinkPill('OGOL', player.ogolUrl, linkX, rowY + 1.7, linkWidth, GFC)

      const tone = scoreTone(player.score)
      const [sr, sg, sb] = hexToRgb(tone.bar)
      doc.setFillColor(sr, sg, sb)
      doc.roundedRect(scoreX, rowY + 1.25, 11.5, 5.5, 1.7, 1.7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.6)
      doc.text(String(Math.round(player.score)), scoreX + 5.75, rowY + 4.8, { align:'center' })
    }
  }

  groups.forEach((group, index) => {
    if (index > 0 && index % cardsPerPage === 0) doc.addPage('a4', 'landscape')
    const pageIndex = Math.floor(index / cardsPerPage) + 1
    if (index % cardsPerPage === 0) drawHeader(pageIndex)
    const localIndex = index % cardsPerPage
    const col = localIndex % columns
    const row = Math.floor(localIndex / columns) % rowsPerPage
    const x = margin + col * (cardWidth + gap)
    const y = contentTop + row * (cardHeight + gap)
    drawCard(group, selection[group.id] || [], x, y)
  })

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Central de Inteligencia do Confiança | Relatorio visual de destaques', margin, pageHeight - footerHeight)
    doc.text(`${page}/${totalPages}`, pageWidth - margin, pageHeight - footerHeight, { align:'right' })
  }

  doc.save(exportFilename(leagueName, 'pdf'))
}

async function exportHighlightsExcel({ leagueName, source, groups, selection }) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const generatedAt = new Date()
  const headers = [
    'Categoria', 'Ranking', 'Jogador', 'Equipe', 'Posição', 'Pé preferido',
    'Idade', 'Minutos', 'Jogos', 'Score', 'Perfil funcional', 'Principal destaque',
    'Material de vídeo', 'Perfil no oGol',
  ]
  const rows = [
    ['DESTAQUES DA COMPETIÇÃO'],
    ['Competição', leagueName],
    ['Fonte', sourceLabel(source)],
    ['Gerado em', generatedAt.toLocaleString('pt-BR')],
    [],
    headers,
  ]
  const linkCells = []
  const summaryRows = [['Categoria', 'Atletas', 'Maior score', 'Média do score']]

  for (const group of groups || []) {
    const players = (selection?.[group.id] || []).slice(0, MAX_HIGHLIGHTS)
    const scores = players.map(player => Number(player.score)).filter(Number.isFinite)
    summaryRows.push([
      group.label,
      players.length,
      scores.length ? Math.max(...scores) : '',
      scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : '',
    ])

    players.forEach((player, index) => {
      const excelRow = rows.length + 1
      rows.push([
        group.label,
        index + 1,
        player.nome || '',
        player.equipa || '',
        player.posicao || '',
        footLabel(player.pe) || 'Não informado',
        Number.isFinite(Number(player.idade)) ? Number(player.idade) : '',
        Number.isFinite(Number(player.minutos)) ? Number(player.minutos) : '',
        Number.isFinite(Number(player.jogos)) ? Number(player.jogos) : '',
        Number.isFinite(Number(player.score)) ? Math.round(Number(player.score)) : '',
        player.profile || '',
        player.strongest || '',
        validHttpUrl(player.videoUrl) ? player.videoUrl : '',
        validHttpUrl(player.ogolUrl) ? player.ogolUrl : '',
      ])
      if (validHttpUrl(player.videoUrl)) linkCells.push({ address:`M${excelRow}`, url:player.videoUrl, label:'Abrir vídeo' })
      if (validHttpUrl(player.ogolUrl)) linkCells.push({ address:`N${excelRow}`, url:player.ogolUrl, label:'Abrir oGol' })
    })
  }

  const highlightsSheet = XLSX.utils.aoa_to_sheet(rows)
  highlightsSheet['!merges'] = [{ s:{ r:0, c:0 }, e:{ r:0, c:13 } }]
  highlightsSheet['!cols'] = [
    { wch:22 }, { wch:9 }, { wch:25 }, { wch:23 }, { wch:18 }, { wch:14 },
    { wch:8 }, { wch:10 }, { wch:8 }, { wch:8 }, { wch:25 }, { wch:25 },
    { wch:34 }, { wch:34 },
  ]
  highlightsSheet['!autofilter'] = { ref:`A6:N${Math.max(6, rows.length)}` }
  linkCells.forEach(({ address, url, label }) => {
    if (!highlightsSheet[address]) highlightsSheet[address] = { t:'s', v:label }
    else highlightsSheet[address].v = label
    highlightsSheet[address].l = { Target:url, Tooltip:label }
  })

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['RESUMO DOS DESTAQUES'],
    ['Competição', leagueName],
    ['Fonte', sourceLabel(source)],
    ['Limite por posição', MAX_HIGHLIGHTS],
    [],
    ...summaryRows,
  ])
  summarySheet['!merges'] = [{ s:{ r:0, c:0 }, e:{ r:0, c:3 } }]
  summarySheet['!cols'] = [{ wch:26 }, { wch:12 }, { wch:14 }, { wch:16 }]
  summarySheet['!autofilter'] = { ref:`A6:D${Math.max(6, summaryRows.length + 5)}` }

  workbook.Props = {
    Title:`Destaques - ${leagueName}`,
    Subject:'Destaques da competição por posição',
    Author:'Central de Inteligência do Confiança',
    CreatedDate:generatedAt,
  }
  XLSX.utils.book_append_sheet(workbook, highlightsSheet, 'Destaques')
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo')
  XLSX.writeFile(workbook, exportFilename(leagueName, 'xlsx'), { compression:true })
}

export default function CompetitionHighlights({ slug, leagueName, logo, sourcePreference = 'auto', onSourceChange, canEdit = false }) {
  const [data, setData] = useState(null)
  const [selection, setSelection] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [message, setMessage] = useState(null)
  const [picker, setPicker] = useState(null)
  const [linkEditor, setLinkEditor] = useState(null)
  const [dragState, setDragState] = useState(null)
  const loadRequestRef = useRef(0)
  const mutationQueueRef = useRef(Promise.resolve())
  const pendingMutationsRef = useRef(0)

  const queueMutation = useCallback(task => {
    pendingMutationsRef.current += 1
    setSaving(true)
    const run = mutationQueueRef.current.catch(() => undefined).then(task)
    mutationQueueRef.current = run
    return run.finally(() => {
      pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1)
      if (pendingMutationsRef.current === 0) setSaving(false)
    })
  }, [])

  const load = useCallback(async (source = sourcePreference) => {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/ligas-v2/${slug}/destaques?source=${source}&_=${Date.now()}`, {
        cache:'no-store',
        headers:{ 'Cache-Control':'no-cache' },
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Falha ao carregar os destaques.')
      if (requestId !== loadRequestRef.current) return
      setData(body)
      setSelection(body.selection || {})
      if (body.source && body.source !== sourcePreference && sourcePreference !== 'auto') onSourceChange?.(body.source)
    } catch (error) {
      if (requestId === loadRequestRef.current) setMessage({ type:'error', text:error.message })
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }, [onSourceChange, slug, sourcePreference])

  useEffect(() => { load(sourcePreference) }, [load, sourcePreference])

  const dirty = useMemo(() => {
    if (!data?.groups) return false
    return data.groups.some(group => !samePlayers(selection[group.id] || [], data.selection?.[group.id] || []))
  }, [data, selection])

  const persistSelection = useCallback(async (nextSelection, { automatic = false } = {}) => {
    const source = data?.source
    if (!source) return
    if (!automatic) setMessage(null)
    try {
      await queueMutation(async () => {
        const response = await fetch(`/api/ligas-v2/${slug}/destaques`, {
          method:'POST',
          cache:'no-store',
          headers:{ 'Content-Type':'application/json', 'Cache-Control':'no-cache' },
          body:JSON.stringify({ source, groups:selectionPayload(nextSelection) }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível salvar a curadoria.')
        setData(current => current ? {
          ...current,
          selection:nextSelection,
          saved:true,
          updated_at:body?.data?.saved_at || new Date().toISOString(),
        } : current)
        setMessage({ type:'success', text:automatic ? 'Curadoria salva automaticamente.' : 'Curadoria dos destaques salva.' })
      })
    } catch (error) {
      setMessage({ type:'error', text:`A curadoria ficou na tela, mas não foi salva: ${error.message}` })
    }
  }, [data?.source, queueMutation, slug])

  const choosePlayer = (player, selectedSlot = picker?.slot ?? 0) => {
    if (!picker) return
    const currentGroup = [...(selection[picker.group.id] || [])].filter(Boolean)
    const targetSlot = Math.max(0, Math.min(MAX_HIGHLIGHTS - 1, selectedSlot))

    let nextGroup
    if (picker.mode === 'insert') {
      nextGroup = currentGroup.filter(current => current?.key !== player?.key)
      nextGroup.splice(Math.min(targetSlot, nextGroup.length), 0, player)
    } else {
      nextGroup = [...currentGroup]
      nextGroup[targetSlot] = player
    }

    const nextSelection = {
      ...selection,
      [picker.group.id]:nextGroup.filter(Boolean).slice(0, MAX_HIGHLIGHTS),
    }
    setSelection(nextSelection)
    setPicker(null)
    void persistSelection(nextSelection, { automatic:true })
  }

  const startDrag = (event, groupId, fromIndex) => {
    if (!canEdit) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `${groupId}:${fromIndex}`)
    setDragState({ groupId, fromIndex, overIndex:fromIndex })
  }

  const dragOver = (event, groupId, overIndex) => {
    if (!dragState || dragState.groupId !== groupId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragState.overIndex !== overIndex) {
      setDragState(current => current ? { ...current, overIndex } : current)
    }
  }

  const dropPlayer = (event, groupId, toIndex) => {
    event.preventDefault()
    if (!dragState || dragState.groupId !== groupId) {
      setDragState(null)
      return
    }

    const currentGroup = [...(selection[groupId] || [])].filter(Boolean)
    const fromIndex = dragState.fromIndex
    const boundedTarget = Math.max(0, Math.min(currentGroup.length - 1, toIndex))
    if (!currentGroup[fromIndex] || fromIndex === boundedTarget) {
      setDragState(null)
      return
    }

    const [moved] = currentGroup.splice(fromIndex, 1)
    currentGroup.splice(boundedTarget, 0, moved)
    const nextSelection = { ...selection, [groupId]:currentGroup.slice(0, MAX_HIGHLIGHTS) }
    setSelection(nextSelection)
    setDragState(null)
    void persistSelection(nextSelection, { automatic:true })
  }

  const endDrag = () => setDragState(null)

  const handleLinksSaved = links => {
    if (!linkEditor?.player?.key) return
    const playerKey = linkEditor.player.key
    const patchPlayer = player => player?.key === playerKey
      ? {
          ...player,
          videoUrl:links.videoUrl || null,
          ogolUrl:links.ogolUrl || null,
          _video_url:links.videoUrl || null,
          _ogol_url:links.ogolUrl || null,
        }
      : player

    setSelection(current => Object.fromEntries(
      Object.entries(current).map(([groupId, players]) => [groupId, (players || []).map(patchPlayer)])
    ))
    setData(current => current ? {
      ...current,
      groups:(current.groups || []).map(group => ({
        ...group,
        automatic:(group.automatic || []).map(patchPlayer),
        candidates:(group.candidates || []).map(patchPlayer),
      })),
      selection:Object.fromEntries(
        Object.entries(current.selection || {}).map(([groupId, players]) => [groupId, (players || []).map(patchPlayer)])
      ),
    } : current)
    setLinkEditor(current => current ? { ...current, player:patchPlayer(current.player) } : current)
  }

  const resetGroup = group => {
    const nextSelection = { ...selection, [group.id]:group.automatic || [] }
    setSelection(nextSelection)
    void persistSelection(nextSelection, { automatic:true })
  }

  const save = async () => {
    await persistSelection(selection)
  }

  const resetAll = async () => {
    if (!data?.groups) return
    const automaticSelection = Object.fromEntries(data.groups.map(group => [group.id, group.automatic || []]))
    setSelection(automaticSelection)
    setMessage(null)
    try {
      await queueMutation(async () => {
        const response = await fetch(`/api/ligas-v2/${slug}/destaques`, {
          method:'DELETE',
          cache:'no-store',
          headers:{ 'Cache-Control':'no-cache' },
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível restaurar o automático.')
        setData(current => current ? { ...current, saved:false, selection:automaticSelection } : current)
        setMessage({ type:'success', text:`Top ${MAX_HIGHLIGHTS} automático restaurado.` })
      })
    } catch (error) {
      setMessage({ type:'error', text:error.message })
    }
  }

  const changeSource = value => {
    onSourceChange?.(value)
    load(value)
  }

  const exportPdf = async () => {
    if (!data?.groups?.length) return
    setExporting(true)
    setMessage(null)
    try {
      await exportHighlightsPdf({ leagueName, source:data.source, groups:data.groups, selection, logo })
    } catch (error) {
      setMessage({ type:'error', text:`Falha ao gerar PDF: ${error.message}` })
    } finally {
      setExporting(false)
    }
  }

  const exportExcel = async () => {
    if (!data?.groups?.length) return
    setExportingExcel(true)
    setMessage(null)
    try {
      await exportHighlightsExcel({ leagueName, source:data.source, groups:data.groups, selection })
    } catch (error) {
      setMessage({ type:'error', text:`Falha ao gerar Excel: ${error.message}` })
    } finally {
      setExportingExcel(false)
    }
  }

  if (loading) return <div style={{ padding:48, border:'1px solid #dbe7f2', borderRadius:16, background:'#fff', textAlign:'center', color:'#64748b', fontSize:12 }}>Montando os destaques da competição...</div>

  if (!data?.source) return (
    <div style={{ padding:42, border:'1px dashed #b9d5c3', borderRadius:16, background:'#f8fdf9', textAlign:'center' }}>
      <Sparkles size={26} color={GFC} />
      <h2 style={{ margin:'10px 0 5px', fontSize:17, color:'#10233b' }}>Sem dados para gerar os destaques</h2>
      <p style={{ margin:0, fontSize:11, color:'#64748b' }}>Importe uma base Sportsbase ou Wyscout nesta liga.</p>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom:18, borderRadius:18, padding:'20px 22px', background:`linear-gradient(135deg,${GFC_DARK},${GFC})`, color:'#fff', boxShadow:'0 12px 32px rgba(10,102,183,.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:18, flexWrap:'wrap' }}>
          <div style={{ maxWidth:670 }}>
            <p style={{ margin:0, fontSize:9.5, textTransform:'uppercase', letterSpacing:'.13em', color:'rgba(255,255,255,.65)', fontWeight:800 }}>Relatório visual</p>
            <h2 style={{ margin:'5px 0 5px', fontSize:21, fontWeight:950 }}>Destaques da competição</h2>
            <p style={{ margin:0, fontSize:11, lineHeight:1.55, color:'rgba(255,255,255,.76)' }}>Cards com até {MAX_HIGHLIGHTS} atletas por posição, gerados pelas métricas do dashboard e ajustáveis pela curadoria do analista.</p>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <button type="button" onClick={exportExcel} disabled={exportingExcel} style={{ display:'flex', alignItems:'center', gap:7, border:'1px solid rgba(255,255,255,.34)', borderRadius:10, padding:'9px 12px', background:'rgba(255,255,255,.1)', color:'#fff', fontSize:10.5, fontWeight:900, cursor:exportingExcel?'wait':'pointer' }}><FileSpreadsheet size={15} />{exportingExcel ? 'Gerando Excel...' : 'Exportar Excel'}</button>
            <button type="button" onClick={exportPdf} disabled={exporting} style={{ display:'flex', alignItems:'center', gap:7, border:'1px solid rgba(255,255,255,.34)', borderRadius:10, padding:'9px 12px', background:'rgba(255,255,255,.1)', color:'#fff', fontSize:10.5, fontWeight:900, cursor:exporting?'wait':'pointer' }}><Download size={15} />{exporting ? 'Gerando PDF...' : 'Exportar PDF'}</button>
            {canEdit ? <button type="button" onClick={save} disabled={saving || !dirty} style={{ display:'flex', alignItems:'center', gap:7, border:'none', borderRadius:10, padding:'9px 12px', background:dirty?'#fff':'rgba(255,255,255,.16)', color:dirty?GFC:'#d5e8dc', fontSize:10.5, fontWeight:900, cursor:dirty&&!saving?'pointer':'default' }}><Save size={15} />{saving ? 'Salvando...' : 'Salvar curadoria'}</button> : null}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:14, padding:'10px 12px', border:'1px solid #dbe7f2', borderRadius:12, background:'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:9, fontWeight:950, color:'#64748b' }}>FONTE</span>
          {[['auto','Automático'],['sportsbase','Sportsbase'],['wyscout','Wyscout']].map(([value, label]) => {
            const unavailable = value !== 'auto' && !data.available_sources?.[value]
            const active = value === 'auto' ? sourcePreference === 'auto' : data.source === value && sourcePreference !== 'auto'
            return <button key={value} type="button" disabled={unavailable} onClick={() => changeSource(value)} style={{ border:`1px solid ${active?GFC:'#dbe7f2'}`, borderRadius:8, padding:'6px 9px', background:active?'#eaf4fd':'#fff', color:unavailable?'#cbd5e1':active?GFC:'#64748b', fontSize:9.5, fontWeight:850, cursor:unavailable?'not-allowed':'pointer' }}>{label}</button>
          })}
          <span style={{ fontSize:9, color:'#94a3b8', marginLeft:4 }}>Exibindo {sourceLabel(data.source)} · {data.total_players} atletas</span>
        </div>
        {canEdit ? <button type="button" onClick={resetAll} disabled={saving} style={{ display:'flex', alignItems:'center', gap:6, border:'none', background:'transparent', color:'#64748b', fontSize:9.5, fontWeight:800, cursor:'pointer' }}><RefreshCcw size={13} />Restaurar todos automáticos</button> : null}
      </div>

      {message ? <div style={{ marginBottom:12, borderRadius:10, padding:'9px 12px', background:message.type==='success'?'#eaf4fd':'#fef2f2', color:message.type==='success'?'#166534':'#b91c1c', fontSize:10.5, fontWeight:750 }}>{message.text}</div> : null}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:14, alignItems:'start' }}>
        {data.groups.map(group => (
          <HighlightCard
            key={group.id}
            group={group}
            players={selection[group.id] || []}
            editable={canEdit}
            onEdit={slot => setPicker({ group, slot, mode:'replace' })}
            onAdd={() => setPicker({ group, slot:Math.min((selection[group.id] || []).length, MAX_HIGHLIGHTS - 1), mode:'insert' })}
            onLinks={(slot, player) => setLinkEditor({ groupId:group.id, slot, player })}
            onReset={() => resetGroup(group)}
            dragState={dragState}
            onDragStart={startDrag}
            onDragOver={dragOver}
            onDrop={dropPlayer}
            onDragEnd={endDrag}
          />
        ))}
      </div>

      <div style={{ marginTop:14, padding:'10px 12px', borderRadius:10, background:'#f8fdf9', border:'1px solid #dbe7f2', fontSize:9.5, color:'#64748b', lineHeight:1.55 }}>
        <b style={{ color:'#325642' }}>Metodologia:</b> {data.methodology} Use a alça ao lado do ranking para arrastar atletas para cima ou para baixo. O botão <b>Adicionar</b> permite buscar qualquer atleta da competição, independentemente da posição identificada na base, e inseri-lo em qualquer colocação.
      </div>

      {picker ? <PlayerPicker group={picker.group} allCandidates={data.all_candidates || []} slot={picker.slot} mode={picker.mode} currentSelection={selection[picker.group.id] || []} onChoose={choosePlayer} onClose={() => setPicker(null)} /> : null}
      {linkEditor ? <PlayerLinksModal slug={slug} player={linkEditor.player} onSaved={handleLinksSaved} onClose={() => setLinkEditor(null)} /> : null}
    </div>
  )
}
