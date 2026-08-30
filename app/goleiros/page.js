'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Goleiros foi integrado na página de Treino (toggle Campo / Goleiros)
export default function GoleirosRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/treino') }, [router])
  return null
}
