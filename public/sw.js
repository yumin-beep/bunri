// Offline support. App shell is cache-first; kb.json (the rules) is network-first
// so rule updates reach installed copies, with the cached copy as offline fallback.
const C = 'bunri-2026-11-01b';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'matcher.js', 'kb.json', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  if (new URL(e.request.url).pathname.endsWith('kb.json'))
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
  else e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
