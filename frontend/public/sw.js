/**
 * Service Worker for ResilienceHub PWA - MERGED VERSION
 * 
 * Combines:
 * - Your advanced offline queue + sync logic
 * - Dev mode skipping
 * - Navigation fallback
 * - Required PWA fetch handling
 * - start_url pre-cache
 */

// Detect development mode
const IS_DEV = self.location.hostname === 'localhost' ||
               self.location.hostname === '127.0.0.1' ||
               self.location.port === '5173';

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `resiliencehub-${CACHE_VERSION}`;

const OFFLINE_URL = '/';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

const API_ROUTES = ['/api/'];

// ========================================
// INSTALL EVENT
// ========================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');

  if (IS_DEV) {
    console.log('[SW] Dev mode - skipping cache');
    return self.skipWaiting();
  }

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching essential URLs');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Pre-cache failed:', err))
  );
});

// ========================================
// ACTIVATE EVENT
// ========================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ========================================
// FETCH EVENT (MERGED VERSION)
// ========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  // Critical: Don't touch dev/HMR files
  if (IS_DEV) {
    if (url.protocol === 'ws:' ||
        url.protocol === 'wss:' ||
        url.pathname.includes('/@vite') ||
        url.pathname.includes('/__vite') ||
        url.pathname.includes('/node_modules') ||
        url.searchParams.has('t') ||
        url.pathname.match(/\.(js|jsx|ts|tsx|css|json)$/)) {
      return;
    }
  }

  // Non-GET: handle API mutations (your queue logic)
  if (request.method !== 'GET') {
    if (isApiRequest(url)) {
      event.respondWith(handleApiMutation(request));
    }
    return;
  }

  // API GET requests → network-first
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 🔥 NEW FEATURE: Navigation fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static files → cache-first (your original logic)
  if (!IS_DEV) {
    event.respondWith(cacheFirst(request));
  }
});

// ========================================
// CACHING STRATEGIES
// ========================================
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch {
    return caches.match('/') || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        message: 'You are offline. Data will sync later.'
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ========================================
// API MUTATION QUEUEING (your original logic)
// ========================================
async function handleApiMutation(request) {
  try {
    return await fetch(request);
  } catch {
    console.log('[SW] Queuing request:', request.url);

    let body = null;
    try {
      const clone = request.clone();
      const ct = clone.headers.get('content-type') || '';
      if (ct.includes('application/json')) body = await clone.json();
      else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('text/plain'))
        body = await clone.text();
    } catch {}

    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client =>
      client.postMessage({
        type: 'QUEUE_REQUEST',
        payload: {
          url: request.url,
          method: request.method,
          headers: Array.from(request.headers.entries()),
          body
        }
      })
    );

    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        queued: true
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ========================================
// BACKGROUND SYNC
// ========================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(syncQueuedData());
  }
});

async function syncQueuedData() {
  const clients = await self.clients.matchAll();
  clients.forEach(client =>
    client.postMessage({
      type: 'SYNC_REQUIRED',
      message: 'Online. Syncing...'
    })
  );
}

// ========================================
// MESSAGE HANDLING (merged both versions)
// ========================================
self.addEventListener('message', (event) => {
  const msg = event.data;

  // new message format
  if (msg === 'skipWaiting') {
    return self.skipWaiting();
  }

  const { type, payload } = msg || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
      break;

    case 'CACHE_URLS':
      if (payload?.urls) {
        caches.open(CACHE_NAME).then(cache => cache.addAll(payload.urls));
      }
      break;

    default:
      console.log('[SW] Unknown message:', msg);
  }
});

// ========================================
// HELPERS
// ========================================
function isApiRequest(url) {
  return API_ROUTES.some(route => url.pathname.startsWith(route));
}

console.log('[SW] Service worker loaded. Dev mode:', IS_DEV);
