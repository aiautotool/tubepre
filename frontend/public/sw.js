// Premium Service Worker for Background Playback
const CACHE_NAME = 'kvtube-v1';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (e) => {
    // Skip non-GET requests
    if (e.request.method !== 'GET') return;
    
    // Skip API and video requests
    if (e.request.url.includes('/api/') || 
        e.request.url.includes('googlevideo.com') ||
        e.request.url.includes('youtube.com')) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(e.request).then((cachedResponse) => {
                    return cachedResponse || new Response('Offline', { status: 503 });
                });
            })
    );
});

// Background sync for audio playback
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'BACKGROUND_AUDIO') {
        // Notify all clients about background audio state
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'BACKGROUND_AUDIO_STATE',
                    isPlaying: e.data.isPlaying
                });
            });
        });
    }
});

// Handle media session actions for background control
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'MEDIA_SESSION_ACTION') {
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'MEDIA_SESSION_ACTION',
                    action: e.data.action,
                    data: e.data.data
                });
            });
        });
    }
});
