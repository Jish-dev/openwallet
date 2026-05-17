const CACHE_NAME = 'openwallet-v1';
const ASSETS = [
    './dashboard.html',
    './styles.css',
    './app.js',
    './manifest.json'
];

// Cache assets on install
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// Serve cached assets when offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});