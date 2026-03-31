// Service Worker — Iglesias Daily Tasks
// Cache version: v1 — bump on every deploy
const CACHE_VERSION = 'iglesias-tasks-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`

const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('iglesias-tasks-') && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Network-first strategy for all requests
self.addEventListener('fetch', (event) => {
  // Skip non-GET and non-http requests
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith('http')) return

  // Skip Supabase API calls — always network
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful HTML page responses
        if (response.ok && event.request.headers.get('accept')?.includes('text/html')) {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // If it's a navigation request, show offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html') || new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>You\'re offline</h2><p>Check your connection and try again.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            )
          }
          return new Response('', { status: 408 })
        })
      })
  )
})
