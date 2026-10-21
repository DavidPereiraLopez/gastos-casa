// Guarda la interfaz para que la app abra rápido. Los datos siempre se piden a Supabase, nunca se guardan aquí.
const CACHE = "gastos-v15";
const ARCHIVOS = ["./", "index.html", "styles.css?v=15", "app.js?v=15", "store.js?v=15", "config.js?v=15", "ticket.js?v=15", "tema.js?v=15", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Notificaciones push de las tareas (las envía supabase/functions/avisos-tareas)
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json() } catch (x) { d = { title: "Gastos de Casa", body: e.data ? e.data.text() : "" } }
  e.waitUntil(self.registration.showNotification(d.title || "Gastos de Casa", { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag, data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { const w = ws.find(x => x.url.startsWith(self.registration.scope)); return w ? w.focus() : clients.openWindow(e.notification.data.url) }));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Supabase y fuentes: siempre por red
  // primero la red (para recibir actualizaciones), y si no hay conexión, lo guardado
  // cache "no-cache": pregunta siempre al servidor si hay versión nueva (GitHub Pages deja guardados los archivos 10 minutos)
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r }).catch(() => caches.match(e.request)));
});
