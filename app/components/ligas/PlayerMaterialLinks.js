'use client'

import { useEffect, useMemo, useState } from 'react'
import { playerProfilePath } from '@/data/player-route'

const GFC = '#0a66b7'

function initialLinks(player = {}) {
  return {
    videoUrl:player._video_url || player.video_url || player.videoUrl || '',
    ogolUrl:player._ogol_url || player.ogol_url || player.ogolUrl || '',
  }
}

function LinkButton({ href, children, tone = GFC }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
        minHeight:30, padding:'7px 10px', borderRadius:8,
        border:`1px solid ${tone}30`, background:`${tone}0d`, color:tone,
        textDecoration:'none', fontSize:9.5, fontWeight:900,
      }}
    >
      {children} ↗
    </a>
  )
}

export default function PlayerMaterialLinks({ slug, player, onSaved }) {
  const fallback = useMemo(() => initialLinks(player), [player])
  const [links, setLinks] = useState(fallback)
  const [savedLinks, setSavedLinks] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const apiPath = useMemo(() => `/api${playerProfilePath(slug, player)}`, [slug, player])

  useEffect(() => {
    const controller = new AbortController()
    setLinks(fallback)
    setSavedLinks(fallback)
    setMessage('')
    setLoading(true)

    fetch(apiPath, { signal:controller.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os links.')
        const next = {
          videoUrl:data.links?.videoUrl || '',
          ogolUrl:data.links?.ogolUrl || '',
        }
        setLinks(next)
        setSavedLinks(next)
      })
      .catch(error => {
        if (error.name !== 'AbortError') setMessage(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [apiPath, fallback])

  const dirty = links.videoUrl.trim() !== savedLinks.videoUrl.trim()
    || links.ogolUrl.trim() !== savedLinks.ogolUrl.trim()

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(apiPath, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(links),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar os links.')
      const next = {
        videoUrl:data.links?.videoUrl || '',
        ogolUrl:data.links?.ogolUrl || '',
      }
      setLinks(next)
      setSavedLinks(next)
      setMessage('Links salvos. Eles já serão usados nos cards e no PDF de destaques.')
      onSaved?.(next)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width:'100%', border:'1px solid #dbe7f2', borderRadius:9,
    padding:'9px 10px', background:'#fff', color:'#10233b',
    fontSize:10.5, outline:'none',
  }

  return (
    <div style={{ background:'#fff', border:'1px solid #dbe7f2', borderRadius:14, padding:14, marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:10 }}>
        <div>
          <p style={{ margin:0, fontSize:10.5, fontWeight:950, color:'#10233b' }}>Materiais do atleta</p>
          <p style={{ margin:'3px 0 0', fontSize:8.8, color:'#64748b' }}>Cadastre aqui o vídeo e o perfil do oGol. Os dois links ficam clicáveis no PDF.</p>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <LinkButton href={savedLinks.videoUrl} tone="#2563eb">VÍDEO</LinkButton>
          <LinkButton href={savedLinks.ogolUrl}>OGOL</LinkButton>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <label style={{ display:'grid', gap:5 }}>
          <span style={{ fontSize:8.5, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px' }}>Material de vídeo</span>
          <input
            type="url"
            value={links.videoUrl}
            onChange={event => setLinks(current => ({ ...current, videoUrl:event.target.value }))}
            placeholder="https://youtube.com/... ou pasta de vídeo"
            disabled={loading || saving}
            style={inputStyle}
          />
        </label>
        <label style={{ display:'grid', gap:5 }}>
          <span style={{ fontSize:8.5, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px' }}>Perfil no oGol</span>
          <input
            type="url"
            value={links.ogolUrl}
            onChange={event => setLinks(current => ({ ...current, ogolUrl:event.target.value }))}
            placeholder="https://www.ogol.com.br/jogador/..."
            disabled={loading || saving}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:9 }}>
        <p style={{ margin:0, minHeight:14, fontSize:8.8, color:message.includes('salvos') ? GFC : '#b45309', fontWeight:700 }}>{loading ? 'Carregando links...' : message}</p>
        <button
          type="button"
          onClick={save}
          disabled={loading || saving || !dirty}
          style={{
            border:'none', borderRadius:8, padding:'8px 12px',
            background:dirty && !loading && !saving ? GFC : '#dbe7f2',
            color:dirty && !loading && !saving ? '#fff' : '#94a3b8',
            fontSize:9.5, fontWeight:900,
            cursor:dirty && !loading && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Salvando...' : 'Salvar links'}
        </button>
      </div>
    </div>
  )
}
