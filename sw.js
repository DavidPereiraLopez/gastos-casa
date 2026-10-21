// Guarda la interfaz para que la app abra rápido. Los datos siempre se piden a Supabase, nunca se guardan aquí.
const CACHE = "gastos-v4";
const ARCHIVOS = ["./", "index.html", "styles.css", "app.js", "store.js", "config.js", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Supabase y fuentes: siempre por red
  // primero la red (para recibir actualizaciones), y si no hay conexión, lo guardado
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r }).catch(() => caches.match(e.request)));
});
