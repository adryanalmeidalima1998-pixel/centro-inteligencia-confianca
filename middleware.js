import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/acesso-negado']
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CRON_PATHS = new Set(['/api/scouting-automation/cron', '/api/notificacoes'])

const CORPO_PAGES = [
  '/corpo-tecnico', '/treino', '/goleiros', '/banco-fisico-tatico', '/fisiologia', '/dm', '/programacao', '/fotos', '/serie-c',
]
const CORPO_APIS = [
  '/api/aliases', '/api/banco-partidas', '/api/banco-treino', '/api/cmj-basal', '/api/dm', '/api/forca-basal', '/api/gps',
  '/api/club-calendar', '/api/maturacao', '/api/pcr-basal', '/api/pdfs', '/api/penaltis', '/api/photo-map', '/api/photos',
  '/api/player-enrichment', '/api/serie-c', '/api/sheets-proxy', '/api/squad',
  '/api/standings', '/api/status-recuperacao', '/api/team-crest', '/api/treino-duracao', '/api/weather-match',
]

function moduleFor(pathname) {
  if (CORPO_PAGES.some(path => pathname === path || pathname.startsWith(`${path}/`))) return 'corpo-tecnico'
  if (CORPO_APIS.some(path => pathname === path || pathname.startsWith(`${path}/`))) return 'corpo-tecnico'
  return 'scouting'
}

function configurationError(pathname) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'NEXTAUTH_SECRET não configurado no ambiente.' }, { status: 503 })
  }
  return new NextResponse('Aplicação sem configuração de autenticação.', { status: 503 })
}

export async function middleware(request) {
  const { pathname } = request.nextUrl
  if (
    PUBLIC_PATHS.includes(pathname) || CRON_PATHS.has(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api/auth') ||
    pathname.startsWith('/favicon') || pathname.startsWith('/manifest') ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|json|woff2?|ttf|css|js)$/.test(pathname)
  ) return NextResponse.next()

  if (!process.env.NEXTAUTH_SECRET) return configurationError(pathname)

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sessão não autenticada.' }, { status: 401 })
    const url = new URL('/login', request.url)
    url.searchParams.set('module', moduleFor(pathname))
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  const required = moduleFor(pathname)
  const modules = Array.isArray(token.modules) ? token.modules : []
  if (!modules.includes(required)) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sem permissão para este módulo.' }, { status: 403 })
    const url = new URL('/acesso-negado', request.url)
    url.searchParams.set('module', required)
    return NextResponse.redirect(url)
  }

  if (token.readOnly && pathname.startsWith('/api/') && !SAFE_METHODS.has(request.method.toUpperCase())) {
    return NextResponse.json({ error: 'Este perfil possui acesso somente para visualização.' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
