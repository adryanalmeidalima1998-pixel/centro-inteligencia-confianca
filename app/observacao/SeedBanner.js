'use client'
import { useState, useEffect } from 'react'

export default function SeedBanner() {
  const [status,  setStatus]  = useState(null) // null | { seeded, ligas, times }
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => {
    check()
  }, [])

  async function check() {
    try {
      const res = await fetch('/api/seed-db?check=1').then(r => r.json())
      setStatus(res)
    } catch (_) {}
  }

  async function rodarSeed(force = false) {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/seed-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      }).then(r => r.json())

      if (res.success) {
        setMsg(`✅ ${res.message}`)
        setDone(true)
        await check()
      } else {
        setMsg(`❌ Erro: ${res.error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Já tem dados e não houve interação — não mostrar nada
  if (status?.seeded && !done && !msg) return null

  // Ainda verificando
  if (!status) return null

  // Precisa de seed
  if (!status.seeded) {
    return (
      <div style={{
        background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12,
        padding: '12px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 20 }}>🗄️</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
            Banco de times e ligas vazio
          </p>
          <p style={{ fontSize: 11, color: '#b45309' }}>
            O banco ainda não foi populado com as 35 ligas e 645 times da planilha. Clique para importar.
          </p>
          {msg && <p style={{ fontSize: 11, marginTop: 4, color: msg.startsWith('✅') ? '#166534' : '#dc2626' }}>{msg}</p>}
        </div>
        <button
          onClick={() => rodarSeed(false)}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: '#fff',
            background: loading ? '#d97706' : '#d97706', opacity: loading ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {loading ? '⏳ Importando...' : '📥 Importar Ligas e Times'}
        </button>
      </div>
    )
  }

  // Seed OK — mostrar confirmação breve (só quando o usuário acabou de rodar)
  if (done && msg) {
    return (
      <div style={{
        background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
        padding: '10px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>{msg}</p>
          <p style={{ fontSize: 10, color: '#4ade80', marginTop: 2 }}>
            {status.ligas} ligas · {status.times} times · Autocomplete de times e ligas ativo
          </p>
        </div>
        <button
          onClick={() => rodarSeed(true)}
          disabled={loading}
          style={{
            padding: '5px 12px', borderRadius: 7, border: '1px solid #86efac', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 10, fontWeight: 700, color: '#166534', background: '#fff',
          }}
        >
          {loading ? '⏳' : '🔄 Reimportar'}
        </button>
      </div>
    )
  }

  return null
}
