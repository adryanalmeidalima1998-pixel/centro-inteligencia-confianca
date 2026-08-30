import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

export async function GET(request){
  const token=await getToken({ req:request, secret:process.env.NEXTAUTH_SECRET || 'centro-inteligencia-confianca-2026-change-in-prod' })
  if(!token) return NextResponse.json({ error:'Sessão não autenticada.' },{ status:401 })
  return NextResponse.json({
    name:token.name || 'Usuário', title:token.role === 'diretoria' ? 'Diretoria' : token.role === 'scouting' ? 'Departamento de Mercado' : token.role === 'corpo_tecnico' ? 'Corpo Técnico' : 'Centro de Inteligência',
    role:token.role, modules:token.modules || [], readOnly:Boolean(token.readOnly), specialProfile:false, canUploadPhoto:false, photoUrl:null,
  })
}
