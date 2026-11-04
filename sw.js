// Funcionamento offline: guarda o app no aparelho. Mude a versão a cada atualização.
const CACHE = 'coleta-v1.4.0';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'config.js', 'manifest.webmanifest', 'icons/icone-192.png', 'icons/icone-512.png',
  'vendor/sql-wasm.js', 'vendor/sql-wasm.wasm', 'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/images/marker-icon.png', 'vendor/images/marker-icon-2x.png', 'vendor/images/marker-shadow.png',
  'js/expr.js', 'js/qml2form.js', 'js/store.js', 'js/utm.js', 'js/gpkg.js', 'js/api.js', 'js/app.js', 'forms/seade-risco.json', 'forms/divinopolis-inventario.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Google e mapas passam direto
  // Responde do cache (funciona sem rede) e atualiza em segundo plano: novidades aparecem na próxima abertura.
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((r) => {
    const rede = fetch(e.request).then((resp) => { if (resp.ok) c.put(e.request, resp.clone()); return resp; }).catch(() => r);
    return r || rede;
  })));
});
