const CACHE_NAME = 'cic-confianca-v1'
const CACHE_URLS = [
  '/',
  '/elenco',
  '/agenda',
  '/mercado',
  '/lista-preferencial',
  '/observacao',
  '/moneyball',
  '/comparacao',
  '/lista-final',
  '/treinadores',
  '/confianca.png',
]
const API_CACHE = 'cig-api-v1'
const API_CACHE_URLS = [
  '/api/players?section=elenco',
  '/api/agenda',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(CACHE_URLS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Cache-first para assets estáticos (_next/static, imagens, fontes)
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(request, clone))
        return res
      }))
    )
    return
  }

  // Network-first com fallback para API de elenco e agenda
  if (API_CACHE_URLS.some(u => url.pathname + url.search === u)) {
    e.respondWith(
      fetch(request).then(res => {
        const clone = res.clone()
        caches.open(API_CACHE).then(c => c.put(request, clone))
        return res
      }).catch(() => caches.match(request))
    )
    return
  }

  // Network-first com fallback para páginas de navegação
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(c => c || caches.match('/'))
      )
    )
    return
  }

  // Default: network, sem cache
  e.respondWith(fetch(request).catch(() => caches.match(request)))
})

// Mensagem para forçar update do cache de API
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_API') {
    caches.open(API_CACHE).then(cache => {
      API_CACHE_URLS.forEach(url => {
        fetch(url).then(res => cache.put(url, res)).catch(() => {})
      })
    })
  }
})
