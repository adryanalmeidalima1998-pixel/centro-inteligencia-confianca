'use client'
import { useState, useEffect } from 'react'
import { usePlayerPhotos } from '../../hooks/usePlayerPhotos'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const ZONES = [
  { id: 1, label: 'Q1' }, { id: 2, label: 'Q2' }, { id: 3, label: 'Q3' },
  { id: 4, label: 'Q4' }, { id: 5, label: 'Q5' }, { id: 6, label: 'Q6' },
  { id: 7, label: 'Q7' }, { id: 8, label: 'Q8' }, { id: 9, label: 'Q9' },
]

// ─── ZONE HEATMAP ─────────────────────────────────────────────────────────────
function ZoneHeatmap({ zones, size = 80 }) {
  const cellH = Math.floor(size / 3)
  return (
    <div
      className="rounded-lg overflow-hidden flex-shrink-0"
      style={{
        border: '2.5px solid rgba(255,255,255,0.7)',
        borderBottom: 'none',
        width: size,
      }}
    >
      <div
        className="grid grid-cols-3"
        style={{
          background:
            'repeating-linear-gradient(0deg,transparent,transparent 9px,rgba(255,255,255,0.07) 9px,rgba(255,255,255,0.07) 10px),' +
            'repeating-linear-gradient(90deg,transparent,transparent 9px,rgba(255,255,255,0.07) 9px,rgba(255,255,255,0.07) 10px)',
          backgroundSize: '10px 10px',
          backgroundColor: '#07579e',
        }}
      >
        {ZONES.map((zone, i) => {
          const z = zones?.[zone.id]
          const g = z?.gols  || 0
          const t = z?.total || 0
          const pct = t === 0 ? null : Math.round((g / t) * 100)

          let fill = 'rgba(255,255,255,0.04)'
          if (pct !== null) {
            if (pct >= 70)      fill = 'rgba(22,163,74,0.75)'
            else if (pct >= 40) fill = 'rgba(234,179,8,0.65)'
            else                fill = 'rgba(220,38,38,0.65)'
          }

          const row = Math.floor(i / 3)
          const col = i % 3
          return (
            <div
              key={zone.id}
              title={`${zone.label}: ${pct === null ? '—' : pct + '%'} (${g}/${t})`}
              style={{
                background: fill,
                height: cellH,
                borderRight: col !== 2 ? '1px solid rgba(255,255,255,0.18)' : 'none',
                borderBottom: row !== 2 ? '1px solid rgba(255,255,255,0.18)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {t > 0 && (
                <span style={{ fontSize: 5, fontWeight: 900, color: 'white', opacity: 0.9, fontFamily: "'Barlow Condensed',sans-serif" }}>
                  {pct}%
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ height: 4, background: '#14532d', borderTop: '2px solid rgba(255,255,255,0.12)' }} />
    </div>
  )
}

// ─── ATHLETE CARD ─────────────────────────────────────────────────────────────
function AthleteCard({ athlete, rank, variant, getPhotoUrl }) {
  const isBest = variant === 'best'
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
  const medal  = medals[rank - 1] || `#${rank}`
  const bg     = isBest
    ? 'linear-gradient(135deg,#14532d 0%,#166534 100%)'
    : 'linear-gradient(135deg,#7f1d1d 0%,#991b1b 100%)'
  const accent = isBest ? '#4ade80' : '#f87171'
  const light  = isBest ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'
  const photoUrl = getPhotoUrl(athlete.atleta_nome)

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden relative"
      style={{ background: bg, minHeight: 190 }}
    >
      {/* Glow orb */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: light, filter: 'blur(20px)', pointerEvents: 'none',
      }} />

      {/* Rank badge top-left */}
      <div className="absolute top-2 left-2 flex flex-col items-center z-10">
        <span style={{ fontSize: 16, lineHeight: 1 }}>{medal}</span>
        <span style={{ fontSize: 7, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontFamily: "'Barlow Condensed',sans-serif" }}>
          #{rank}
        </span>
      </div>

      {/* Player photo */}
      <div className="flex justify-center pt-4 pb-1 relative z-10">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={athlete.atleta_nome}
            className="rounded-full object-cover border-2"
            style={{
              width: 64, height: 64,
              borderColor: accent,
              boxShadow: `0 0 12px ${accent}55`,
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center border-2"
            style={{ width: 64, height: 64, borderColor: accent, background: 'rgba(255,255,255,0.1)' }}
          >
            <span style={{ fontSize: 28 }}>⚽</span>
          </div>
        )}
      </div>

      {/* Name + percentage */}
      <div className="flex flex-col items-center px-2 pb-3 z-10 relative flex-1">
        <p style={{
          fontSize: 10, fontWeight: 900, color: 'white',
          fontFamily: "'Barlow Condensed',sans-serif",
          textTransform: 'uppercase', letterSpacing: '0.04em',
          lineHeight: 1.2, textAlign: 'center', marginBottom: 2,
        }}>
          {athlete.atleta_nome}
        </p>

        <span style={{ fontSize: 26, fontWeight: 900, color: accent, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>
          {athlete.pct}%
        </span>
        <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
          {athlete.total_gols} gols / {athlete.total_kicks} chutes
        </span>

        {/* Zone heatmap centered */}
        <div className="mt-2">
          <ZoneHeatmap zones={athlete.zones} size={78} />
        </div>

        {/* Zone breakdown mini-bar */}
        <div className="flex gap-0.5 mt-1.5 flex-wrap justify-center">
          {ZONES.map(zone => {
            const z = athlete.zones?.[zone.id]
            if (!z || z.total === 0) return null
            const p = Math.round((z.gols / z.total) * 100)
            const c = p >= 70 ? '#4ade80' : p >= 40 ? '#fbbf24' : '#f87171'
            return (
              <span key={zone.id} style={{
                fontSize: 6, fontWeight: 900, color: 'white',
                background: `${c}33`, border: `1px solid ${c}66`,
                borderRadius: 4, padding: '1px 3px',
                fontFamily: "'Barlow Condensed',sans-serif",
              }}>
                {zone.label} {p}%
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── PDF EXPORT ──────────────────────────────────────────────────────────────
async function exportToPDF(tipo, athletes, getPhotoUrl) {
  const printWindow = window.open('', '_blank', 'width=900,height=750')
  if (!printWindow) { alert('Permita pop-ups para exportar PDF.'); return }

  // Fetch photo → base64
  const getB64 = async (url) => {
    if (!url) return null
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      return await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    } catch { return null }
  }

  // Pre-fetch all photos in parallel
  const allNames  = [...new Set(athletes.map(a => a.atleta_nome))]
  const b64Map    = {}
  await Promise.all(allNames.map(async name => {
    const url = getPhotoUrl(name)
    b64Map[name] = url ? await getB64(url) : null
  }))

  const top5    = athletes.slice(0, 5)
  const bottom5 = athletes.length > 5 ? athletes.slice(-5).reverse() : []

  // ── Zone heatmap HTML ──────────────────────────────────────────────────────
  const zoneHeatmapHtml = (zones, isBest, size = 76) => {
    const cellH = Math.floor(size / 3)
    const cells = ZONES.map((zone, i) => {
      const z   = zones?.[zone.id]
      const g   = z?.gols  || 0
      const t   = z?.total || 0
      const pct = t === 0 ? null : Math.round((g / t) * 100)
      let fill  = isBest ? '#1a5c31' : '#5c1a1a'
      if (pct !== null) {
        if (pct >= 70)      fill = 'rgba(22,163,74,0.82)'
        else if (pct >= 40) fill = 'rgba(234,179,8,0.75)'
        else                fill = 'rgba(220,38,38,0.75)'
      }
      const row = Math.floor(i / 3)
      const col = i % 3
      return `<div style="background:${fill};height:${cellH}px;border-right:${col !== 2 ? '1px solid rgba(255,255,255,0.2)' : 'none'};border-bottom:${row !== 2 ? '1px solid rgba(255,255,255,0.2)' : 'none'};display:flex;align-items:center;justify-content:center;">
        ${t > 0 ? `<span style="font-size:5.5px;font-weight:900;color:white;font-family:'Barlow Condensed',sans-serif;">${pct}%</span>` : ''}
      </div>`
    }).join('')

    return `<div style="width:${size}px;border:2px solid rgba(255,255,255,0.7);border-bottom:none;border-radius:6px 6px 0 0;overflow:hidden;margin-top:8px;flex-shrink:0;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);background:#07579e;">${cells}</div>
      <div style="height:4px;background:#14532d;border-top:2px solid rgba(255,255,255,0.12);"></div>
    </div>`
  }

  // ── Zone mini-badges HTML ──────────────────────────────────────────────────
  const zoneBadgesHtml = (zones) => {
    return ZONES.map(zone => {
      const z = zones?.[zone.id]
      if (!z || z.total === 0) return ''
      const p = Math.round((z.gols / z.total) * 100)
      const c = p >= 70 ? '#4ade80' : p >= 40 ? '#fbbf24' : '#f87171'
      return `<span style="font-size:5.5px;font-weight:900;color:white;background:${c}33;border:1px solid ${c}66;border-radius:3px;padding:1px 3px;font-family:'Barlow Condensed',sans-serif;">${zone.label} ${p}%</span>`
    }).join('')
  }

  // ── Athlete card HTML ──────────────────────────────────────────────────────
  const cardHtml = (a, rank, isBest) => {
    const medals  = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
    const medal   = medals[rank - 1] || `#${rank}`
    const bg      = isBest
      ? 'linear-gradient(135deg,#14532d 0%,#166534 100%)'
      : 'linear-gradient(135deg,#7f1d1d 0%,#991b1b 100%)'
    const accent  = isBest ? '#4ade80' : '#f87171'
    const glow    = isBest ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'
    const b64     = b64Map[a.atleta_nome]

    const photoHtml = b64
      ? `<img src="${b64}" style="width:76px;height:76px;border-radius:50%;border:2.5px solid ${accent};object-fit:cover;object-position:50% 12%;box-shadow:0 0 14px ${accent}55;margin-bottom:5px;margin-top:12px;display:block;" />`
      : `<div style="width:76px;height:76px;border-radius:50%;border:2.5px solid ${accent};background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin-bottom:5px;margin-top:12px;font-size:28px;">⚽</div>`

    return `<div style="background:${bg};border-radius:14px;padding:0 8px 10px;display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden;page-break-inside:avoid;min-height:220px;">
      <!-- glow orb -->
      <div style="position:absolute;top:-18px;right:-18px;width:72px;height:72px;border-radius:50%;background:${glow};filter:blur(16px);pointer-events:none;z-index:0;"></div>
      <!-- rank -->
      <div style="position:absolute;top:6px;left:8px;display:flex;flex-direction:column;align-items:center;z-index:2;">
        <span style="font-size:15px;line-height:1;">${medal}</span>
        <span style="font-size:6px;font-weight:900;color:rgba(255,255,255,0.5);letter-spacing:0.1em;font-family:'Barlow Condensed',sans-serif;">#${rank}</span>
      </div>
      <!-- photo -->
      <div style="display:flex;justify-content:center;z-index:1;position:relative;">${photoHtml}</div>
      <!-- name -->
      <p style="font-size:9.5px;font-weight:900;color:white;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:0.04em;line-height:1.2;text-align:center;margin:0 0 3px;z-index:1;position:relative;">${a.atleta_nome}</p>
      <!-- pct -->
      <span style="font-size:26px;font-weight:900;color:${accent};font-family:'Barlow Condensed',sans-serif;line-height:1;z-index:1;position:relative;">${a.pct}%</span>
      <span style="font-size:6.5px;font-weight:700;color:rgba(255,255,255,0.5);margin-top:2px;z-index:1;position:relative;">${a.total_gols}g / ${a.total_kicks}ch</span>
      <!-- heatmap -->
      <div style="z-index:1;position:relative;display:flex;justify-content:center;">${zoneHeatmapHtml(a.zones, isBest, 76)}</div>
      <!-- mini-badges -->
      <div style="display:flex;gap:2px;margin-top:4px;flex-wrap:wrap;justify-content:center;z-index:1;position:relative;">${zoneBadgesHtml(a.zones)}</div>
    </div>`
  }

  // ── Table row HTML ─────────────────────────────────────────────────────────
  const tableRows = athletes.map((a, i) => {
    const rank    = i + 1
    const isBest  = i < 5
    const isWorst = athletes.length > 5 && i >= athletes.length - 5
    const b64     = b64Map[a.atleta_nome]
    const rowBg   = isBest ? '#f0fdf4' : isWorst ? '#fef2f2' : (i % 2 === 0 ? 'white' : '#fafafa')
    const pct     = a.pct
    const pctColor  = pct >= 70 ? '#07579e' : pct >= 40 ? '#92400e' : '#b91c1c'
    const pctBg     = pct >= 70 ? '#f0fdf4' : pct >= 40 ? '#fefce8' : '#fef2f2'
    const pctBorder = pct >= 70 ? '#bbf7d0' : pct >= 40 ? '#fde68a' : '#fecaca'

    const photoCell = b64
      ? `<img src="${b64}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;object-position:top;border:1.5px solid #e2e8f0;flex-shrink:0;" />`
      : `<div style="width:26px;height:26px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">⚽</div>`

    return `<tr style="background:${rowBg};border-bottom:1px solid #f1f5f9;">
      <td style="padding:6px 10px;font-size:9px;color:#cbd5e1;font-weight:900;width:28px;">#${rank}</td>
      <td style="padding:6px 8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          ${photoCell}
          <span style="font-size:10.5px;font-weight:700;color:#334155;">${a.atleta_nome}</span>
        </div>
      </td>
      <td style="padding:6px 10px;font-size:8.5px;color:#94a3b8;text-align:center;">${a.total_kicks} chutes</td>
      <td style="padding:6px 10px;text-align:right;">
        <span style="font-size:11px;font-weight:900;padding:3px 10px;border-radius:20px;background:${pctBg};color:${pctColor};border:1px solid ${pctBorder};font-family:'Barlow Condensed',sans-serif;">${pct}%</span>
      </td>
    </tr>`
  }).join('')

  // ── Assemble sections ──────────────────────────────────────────────────────
  const top5Cards    = top5.map((a, i) => cardHtml(a, i + 1, true)).join('')
  const bottom5Cards = bottom5.length > 0
    ? bottom5.map((a, i) => cardHtml(a, i + 1, false)).join('')
    : ''

  const sectionTitle = (emoji, text, color) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="font-size:14px;">${emoji}</span>
      <p style="font-size:9px;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:0.2em;margin:0;font-family:'DM Sans',sans-serif;">${text}</p>
      <div style="flex:1;height:1px;background:${color}33;margin-left:4px;"></div>
    </div>`

  // ── Full HTML ──────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Ranking Pênaltis · ${tipo === 'treino' ? 'Treino' : 'Jogo'} · Confiança</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;600;700;900&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      @page { size: A4 portrait; margin: 12mm 14mm; }
      body { background: white; }
      .no-print { display: none !important; }
    }
    @media screen {
      body { background: #e2e8f0; padding: 24px; }
      .page { max-width: 794px; margin: 0 auto; background: white; padding: 28px 30px; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
    }
  </style>
</head>
<body>

  <!-- Print button (screen only) -->
  <div class="no-print" style="position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;">
    <button onclick="window.print()" style="background:#0a66b7;color:white;border:none;border-radius:8px;padding:10px 22px;font-weight:900;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;letter-spacing:0.05em;">
      🖨️ Salvar PDF
    </button>
    <button onclick="window.close()" style="background:#1e293b;color:white;border:none;border-radius:8px;padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;">✕</button>
  </div>

  <div class="page">

    <!-- ── HEADER ── -->
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:2.5px solid #e2e8f0;">
      <div>
        <p style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.25em;margin-bottom:4px;font-family:'DM Sans',sans-serif;">Ranking · Aproveitamento de Pênaltis</p>
        <p style="font-size:26px;font-weight:900;color:#1e293b;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;line-height:1;">${tipo === 'treino' ? 'TREINO' : 'JOGO'} · PÊNALTIS</p>
      </div>
      <div style="text-align:right;">
        <p style="font-size:9px;font-weight:700;color:#64748b;">Confiança · Temporada 2026</p>
        <p style="font-size:9px;color:#94a3b8;margin-top:2px;">${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </div>

    <!-- Legenda zonas -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding:8px 14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      <span style="font-size:8px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Mapa de zonas:</span>
      ${[['#0a66b7','≥70% GOL'],['#ca8a04','40–69%'],['#dc2626','<40% FALTA']].map(([c,l]) =>
        `<div style="display:flex;align-items:center;gap:5px;">
          <div style="width:10px;height:10px;border-radius:3px;background:${c};"></div>
          <span style="font-size:7.5px;font-weight:700;color:#6b7280;">${l}</span>
        </div>`
      ).join('')}
    </div>

    <!-- ── MELHORES ── -->
    ${sectionTitle('🏆', 'Melhores Aproveitamentos', '#07579e')}
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px;">
      ${top5Cards}
    </div>

    <!-- ── PIORES ── -->
    ${bottom5.length > 0 ? `
    ${sectionTitle('📉', 'Menores Aproveitamentos', '#b91c1c')}
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px;">
      ${bottom5Cards}
    </div>` : ''}

    <!-- ── TABELA TODOS ── -->
    <div style="margin-bottom:4px;">
      <p style="font-size:9px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:10px;font-family:'DM Sans',sans-serif;">Todos os Atletas · ${tipo === 'treino' ? 'Treino' : 'Jogo'}</p>
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
              <th style="padding:7px 10px;font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;text-align:left;letter-spacing:0.1em;">#</th>
              <th style="padding:7px 10px;font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;text-align:left;letter-spacing:0.1em;">Atleta</th>
              <th style="padding:7px 10px;font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;text-align:center;letter-spacing:0.1em;">Chutes</th>
              <th style="padding:7px 10px;font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;text-align:right;letter-spacing:0.1em;">%</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>

    <!-- rodapé -->
    <div style="margin-top:18px;padding-top:12px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:7px;color:#cbd5e1;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Confiança · Preparação 2026 · Confidencial</span>
      <span style="font-size:7px;color:#cbd5e1;font-weight:600;">CIC · ${new Date().toLocaleDateString('pt-BR')}</span>
    </div>

  </div>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
}

// ─── RANKING TAB ─────────────────────────────────────────────────────────────
export default function RankingTab({ tipo }) {
  const [athletes,  setAthletes] = useState([])
  const [loading,   setLoading]  = useState(true)
  const [error,     setError]    = useState(null)
  const [exporting, setExporting]= useState(false)
  const { getPhotoUrl } = usePlayerPhotos()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/penaltis/ranking?tipo=${tipo}`)
      .then(r => r.json())
      .then(d => { setAthletes(d.athletes || []); setLoading(false) })
      .catch(() => { setError('Erro ao carregar ranking.'); setLoading(false) })
  }, [tipo])

  const handleExportPDF = async () => {
    setExporting(true)
    try { await exportToPDF(tipo, athletes, getPhotoUrl) }
    finally { setExporting(false) }
  }

  // Top 5 e bottom 5 sem sobreposição
  const top5    = athletes.slice(0, 5)
  const bottom5 = athletes.length > 5 ? athletes.slice(-5).reverse() : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-sky-300 border-t-sky-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-red-500 font-semibold">{error}</p>
      </div>
    )
  }

  if (athletes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-sm font-black text-gray-400">Nenhum dado disponível ainda</p>
        <p className="text-[10px] text-gray-300 mt-1">Registre pênaltis na aba {tipo === 'treino' ? 'Treino' : 'Jogo'} para ver o ranking</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 space-y-6 max-w-4xl mx-auto">

      {/* Top bar: legend + PDF button */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 flex-1 flex-wrap">
          <span style={{ fontSize: 8, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Mapa de zonas:
          </span>
          {[
            { color: '#0a66b7', label: '≥70% GOL' },
            { color: '#ca8a04', label: '40–69%'   },
            { color: '#dc2626', label: '<40% FALTA' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
              <span style={{ fontSize: 7, fontWeight: 700, color: '#6b7280' }}>{l.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg,#166534,#07579e)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(22,163,74,0.35)',
          }}
        >
          {exporting ? (
            <div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 18 15 15"/>
            </svg>
          )}
          {exporting ? 'Gerando...' : 'Exportar PDF'}
        </button>
      </div>

      {/* Top 5 Melhores */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🏆</span>
          <p style={{ fontSize: 9, fontWeight: 900, color: '#07579e', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            Melhores Aproveitamentos
          </p>
          <div className="flex-1 h-px bg-sky-100" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {top5.map((a, i) => (
            <AthleteCard
              key={a.atleta_id ?? a.atleta_nome}
              athlete={a}
              rank={i + 1}
              variant="best"
              getPhotoUrl={getPhotoUrl}
            />
          ))}
        </div>
      </div>

      {/* Bottom 5 Piores */}
      {bottom5.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📉</span>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              Menores Aproveitamentos
            </p>
            <div className="flex-1 h-px bg-red-100" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {bottom5.map((a, i) => (
              <AthleteCard
                key={a.atleta_id ?? a.atleta_nome}
                athlete={a}
                rank={i + 1}
                variant="worst"
                getPhotoUrl={getPhotoUrl}
              />
            ))}
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p style={{ fontSize: 9, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            Todos os atletas · {tipo === 'treino' ? 'Treino' : 'Jogo'}
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {athletes.map((a, i) => {
            const isBest  = i < 5
            const isWorst = athletes.length > 5 && i >= athletes.length - 5
            const photoUrl = getPhotoUrl(a.atleta_nome)
            return (
              <div key={a.atleta_id ?? a.atleta_nome} className="flex items-center gap-3 px-4 py-2.5">
                <span style={{ fontSize: 9, fontWeight: 900, color: '#cbd5e1', width: 18 }}>#{i + 1}</span>
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={a.atleta_nome}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 24, height: 24, border: '1px solid #e2e8f0' }}
                  />
                ) : (
                  <div className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: 24, height: 24, background: '#f1f5f9', fontSize: 11 }}>
                    ⚽
                  </div>
                )}
                <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', flex: 1 }}>{a.atleta_nome}</p>
                <span style={{ fontSize: 8, color: '#94a3b8' }}>{a.total_kicks} chutes</span>
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  padding: '2px 8px', borderRadius: 20,
                  fontFamily: "'Barlow Condensed',sans-serif",
                  background: isBest ? '#f0fdf4' : isWorst ? '#fef2f2' : '#f8fafc',
                  color:      isBest ? '#07579e' : isWorst ? '#b91c1c' : '#475569',
                  border: `1px solid ${isBest ? '#bbf7d0' : isWorst ? '#fecaca' : '#e2e8f0'}`,
                }}>
                  {a.pct}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="h-8 sm:hidden" />
    </div>
  )
}
