'use client'
import Link from 'next/link'
import AppShell from '../components/layout/AppShell'
import { getLeaguesByContinent } from '@/data/leagues'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'

const GFC = '#0a66b7'

// Cache de logos em memória por slug
const LOGO_CACHE = {}

function LeagueCard({ liga }) {
  const sources = Array.isArray(liga.fontes) && liga.fontes.length
    ? liga.fontes
    : [liga.slug === 'brasileirao-serie-d' ? 'wyscout' : 'sportsbase']
  const source = sources.map(value => value === 'wyscout' ? 'Wyscout' : 'Sportsbase').join(' + ')
  const sourceStyle = sources.length > 1
    ? { background:'#ecfeff', color:'#0f766e' }
    : sources[0] === 'wyscout'
      ? { background:'#e8f1ff', color:'#2563eb' }
      : { background:'#edf8f1', color:GFC }
  const [logo,      setLogo]      = useState(LOGO_CACHE[liga.slug] || null)
  const [uploading, setUploading] = useState(false)
  const [loaded,    setLoaded]    = useState(!!LOGO_CACHE[liga.slug])
  const fileRef = useRef()

  // Buscar logo salva no banco ao montar
  useEffect(() => {
    if (loaded) return
    fetch(`/api/ligas-v2/logo?slug=${liga.slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.logo) { LOGO_CACHE[liga.slug] = d.logo; setLogo(d.logo) }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [liga.slug, loaded])

  const handleLogoClick = (e) => { e.preventDefault(); e.stopPropagation(); fileRef.current?.click() }

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/ligas-v2/logo?slug=${liga.slug}`, { method: 'POST', body: fd })
      const d = await res.json()
      if (d.ok) {
        const reader = new FileReader()
        reader.onload = ev => { LOGO_CACHE[liga.slug] = ev.target.result; setLogo(ev.target.result) }
        reader.readAsDataURL(file)
      }
    } catch {}
    setUploading(false)
    e.target.value = ''
  }

  return (
    <div
      style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8f4ec', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(10,102,183,0.12)'; e.currentTarget.style.borderColor = GFC }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e8f4ec' }}
    >
      {/* Logo clicável — NÃO navega */}
      <div
        onClick={handleLogoClick}
        title="Clique para adicionar/trocar a logo da liga"
        style={{
          width: 44, height: 44, borderRadius: 8, flexShrink: 0,
          border: logo ? 'none' : '1.5px dashed #c0d8c8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', background: logo ? 'transparent' : '#f8fdf9',
          overflow: 'hidden', position: 'relative',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { if (!logo) e.currentTarget.style.borderColor = GFC }}
        onMouseLeave={e => { if (!logo) e.currentTarget.style.borderColor = '#c0d8c8' }}
      >
        {logo
          ? <img src={logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt={liga.nome} />
          : uploading
            ? <span style={{ fontSize: 14 }}>⏳</span>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 16 }}>{liga.tipo === 'copa' ? '🏆' : '🏅'}</span>
                <span style={{ fontSize: 7, color: '#94a3b8', fontWeight: 700, lineHeight: 1 }}>+ logo</span>
              </div>
            )
        }
        {/* Overlay de troca */}
        {logo && !uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', borderRadius: 8 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.45)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
            <span style={{ fontSize: 12, opacity: 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0'}>✏️</span>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />

      {/* Texto da liga — navega ao clicar */}
      <Link href={`/ligas-v2/${liga.slug}`} style={{ textDecoration: 'none', minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1a2e1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liga.nome}</p>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, background: liga.tipo === 'copa' ? '#fef3c7' : '#f0fdf4', color: liga.tipo === 'copa' ? '#92400e' : GFC, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
            {liga.tipo === 'copa' ? 'Copa' : 'Liga'}
          </span>
          <span style={{ fontSize: 9, background: sourceStyle.background, color: sourceStyle.color, fontWeight: 800, padding: '2px 6px', borderRadius: 10 }}>{source}</span>
        </div>
      </Link>

      {/* Indicador de logo */}
      {logo && (
        <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>✓ logo</span>
      )}
    </div>
  )
}

export default function LigasV2Page() {
  const { data: session } = useSession()
  const canEdit = !['diretoria', 'comissao'].includes(session?.user?.role)

  const byContinent = getLeaguesByContinent()
  const continentOrder = ['Mercado Internacional', 'América do Sul', 'América do Norte', 'Europa']

  const totalLigas = Object.values(byContinent).reduce((acc, paises) =>
    acc + Object.values(paises).flat().length, 0)

  return (
    <AppShell>
      <div style={{ padding: '32px 32px 48px', maxWidth: 1300 }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Central de Inteligência</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1a2e1a', marginBottom: 8 }}>Base de Ligas</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            {totalLigas} bases monitoradas · Sportsbase e Wyscout disponíveis por liga · Série D mantém fluxo Wyscout dedicado
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>· Clique no ícone de cada liga para adicionar a logo</span>
          </p>
        </div>

        {continentOrder.map(continente => {
          const paises = byContinent[continente]
          if (!paises) return null
          return (
            <div key={continente} style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: '#e8f4ec' }} />
                <p style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{continente}</p>
                <div style={{ flex: 1, height: 1, background: '#e8f4ec' }} />
              </div>

              {Object.entries(paises).map(([pais, ligas]) => {
                const bandeira = ligas[0]?.bandeira
                const ligasArr = ligas.filter(l => l.tipo === 'liga')
                const copasArr = ligas.filter(l => l.tipo === 'copa')
                return (
                  <div key={pais} style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#2d4a35', marginBottom: 10 }}>{bandeira} {pais}</p>
                    {ligasArr.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏅 Campeonatos</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                          {ligasArr.map(l => <LeagueCard key={l.slug} liga={l} />)}
                        </div>
                      </div>
                    )}
                    {copasArr.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏆 Copas</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                          {copasArr.map(l => <LeagueCard key={l.slug} liga={l} />)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
