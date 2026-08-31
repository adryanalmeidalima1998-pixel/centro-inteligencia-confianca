'use client'
import { useTeamCrest } from '../hooks/useTeamCrest'

/**
 * Drop-in team crest component.
 * Fetches the crest URL via API, shows initials while loading or if not found.
 *
 * Usage:
 *   <TeamCrest name="Confiança" size={32} />
 *   <TeamCrest name="Volta Redonda" size={24} className="rounded-full" />
 */
export default function TeamCrest({ name, size = 32, className = '', style = {} }) {
  const { url, loading } = useTeamCrest(name)

  const normalized = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const localConfianca = normalized.includes('CONFIANCA')

  const initials = (name || '').split(' ')
    .map(w => w[0]).join('').substring(0, 2).toUpperCase()

  const baseStyle = {
    width:  size,
    height: size,
    flexShrink: 0,
    ...style,
  }

  if (localConfianca) {
    return <img src="/confianca.png" alt={name || 'Confiança'} className={`object-contain ${className}`} style={baseStyle} />
  }

  if (loading) {
    return (
      <div
        className={`rounded-full bg-gray-100 animate-pulse flex items-center justify-center ${className}`}
        style={baseStyle}
      />
    )
  }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`object-contain ${className}`}
        style={baseStyle}
        onError={e => {
          // On broken URL, show initials fallback
          e.target.replaceWith(Object.assign(document.createElement('div'), {
            className: e.target.className + ' bg-gray-100 flex items-center justify-center rounded-full',
            style:     e.target.style.cssText,
            textContent: initials,
          }))
        }}
      />
    )
  }

  // No URL found — initials fallback
  return (
    <div
      className={`rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-400 ${className}`}
      style={{ ...baseStyle, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}
