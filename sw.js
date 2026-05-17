const CACHE_NAME = 'openwallet-v2'; // Change this to v3, v4, etc., every time you update the app
const ASSETS = [
    './dashboard.html',
    './styles.css',
    './app.js',
    './manifest.json'
    // Optional: Add './logo.png' and './logo2.png' here if you want the icons to load while offline
];

// 1. Cache assets on install
self.addEventListener('install', event => {
    // Force the new service worker to take over immediately
    self.skipWaiting(); 
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Caching App Assets');
            return cache.addAll(ASSETS);
        })
    );
});

// 2. Clean up old caches on activate (This destroys the "Ghost Cache")
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Control the open tabs immediately
    );
});

// 3. Serve cached assets when offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // Return cached file if found, otherwise fetch from the internet
            return response || fetch(event.request);
        })
    );
});
