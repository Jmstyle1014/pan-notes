// Pan Notes offline cache (39715ae14c)
const CACHE='pan-notes-39715ae14c',FILES=["./", "fonts/atkinson-400.woff2", "fonts/atkinson-700.woff2", "fonts/bricolage-600.woff2", "fonts/bricolage-800.woff2", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png", "index.html", "jspdf.umd.min.js", "manifest.webmanifest"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&/^pan\-notes-[0-9a-f]{10}$/.test(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  // the page itself: try for a newer version first, fall back to the saved copy when offline
  // only this app's own page; another version living in a sub-folder looks after itself
  if(e.request.mode==='navigate'){if(new URL(e.request.url).pathname!==new URL('./',location).pathname)return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./',cp));return r}).catch(()=>caches.match('./')));return}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
