'use client'
import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [justBack, setJustBack] = useState(false)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => {
      setOffline(false)
      setJustBack(true)
      setTimeout(() => setJustBack(false), 3000)
    }
    setOffline(!navigator.onLine)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline && !justBack) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all ${
      offline
        ? 'bg-amber-500 text-white'
        : 'bg-[#0a66b7] text-white'
    }`}>
      {offline ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}>
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
          </svg>
          Modo offline — dados do elenco e agenda disponíveis em cache
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Conexão restaurada
        </>
      )}
    </div>
  )
}
