const CACHE_NAME = 'confianca-serie-c-live-v10-global-db-sync'
const OFFLINE_ROUTE = '/serie-c/coleta-ao-vivo'
const CORE = [OFFLINE_ROUTE, '/confianca.png']

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    for (const url of CORE) {
      try {
        const response = await fetch(new Request(url, { credentials: 'same-origin', cache: 'reload' }))
        if (response.ok) await cache.put(url, response.clone())
      } catch (_) {}
    }
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('confianca-serie-c-live-') || key.startsWith('guarani-serie-c-live-') && key !== CACHE_NAME).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_URLS') return
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const urls = Array.from(new Set([...CORE, ...(event.data.urls || [])]))
      .filter(url => typeof url === 'string' && url.startsWith('/'))
      .filter(url => !url.startsWith('/api/'))
    for (const url of urls) {
      try {
        const response = await fetch(new Request(url, { credentials: 'same-origin', cache: 'reload' }))
        if (response.ok) await cache.put(url, response.clone())
      } catch (_) {}
    }
    const offlineReady = Boolean(await cache.match(OFFLINE_ROUTE))
    event.ports?.[0]?.postMessage({ ok: offlineReady, version: CACHE_NAME })
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate' && url.pathname.startsWith('/serie-c/coleta-ao-vivo')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      try {
        const response = await fetch(request, { cache: 'no-store' })
        if (response.ok) await cache.put(OFFLINE_ROUTE, response.clone())
        return response
      } catch (_) {
        return (await cache.match(OFFLINE_ROUTE)) || Response.error()
      }
    })())
    return
  }

  const cacheable = url.pathname.startsWith('/_next/static/') || /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
  if (!cacheable) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    const network = fetch(request).then(async response => {
      if (response.ok) await cache.put(request, response.clone())
      return response
    }).catch(() => null)
    return cached || (await network) || Response.error()
  })())
})
