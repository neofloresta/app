// Funcionamento offline: guarda o app no aparelho. Mude a versão a cada atualização.
const CACHE = 'coleta-v2.5.1';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'config.js', 'manifest.webmanifest', 'icons/icone-192.png', 'icons/icone-512.png', 'icons/logo-basica.png', 'icons/logo-horizontal.png', 'icons/padronagem.jpg', 'fonts/roboto-latin-300-normal.woff2', 'fonts/roboto-latin-400-normal.woff2', 'fonts/roboto-latin-400-italic.woff2', 'fonts/roboto-latin-500-normal.woff2', 'fonts/roboto-latin-700-normal.woff2', 'fonts/roboto-latin-900-normal.woff2',
  'vendor/sql-wasm.js', 'vendor/sql-wasm.wasm', 'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/images/marker-icon.png', 'vendor/images/marker-icon-2x.png', 'vendor/images/marker-shadow.png',
  'js/expr.js', 'js/qml2form.js', 'js/store.js', 'js/utm.js', 'js/gpkg.js', 'js/indicadores.js', 'js/arquivos.js', 'js/quadras.js', 'js/api.js', 'js/app.js', 'forms/seade-risco.json', 'forms/divinopolis-inventario.json', 'forms/divinopolis-inventario.qml', 'forms/ajuda/fiacao.svg', 'forms/ajuda.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
const MAPA = 'mapa-fundo'; const MAX_MAPA = 2500; let novasMapa = 0; // imagens do mapa por onde a equipe já passou (funciona sem internet)
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== MAPA).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method === 'GET' && (u.hostname === 'tile.openstreetmap.org' || u.hostname === 'server.arcgisonline.com')) {
    e.respondWith(caches.open(MAPA).then(async (c) => {
      const guardada = await c.match(e.request);
      if (guardada) return guardada;
      const rede = fetch(e.request).then(async (resp) => {
        if (resp.ok && resp.type === 'cors') { await c.put(e.request, resp.clone()); if (++novasMapa % 100 === 0) { const ks = await c.keys(); for (let i = 0; i < ks.length - MAX_MAPA; i++) await c.delete(ks[i]); } } // só guarda resposta legível (as opacas ocupariam muito espaço)
        return resp;
      });
      return rede; // imagem de mapa quase nunca muda: a guardada vale e não gasta internet
    }));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Google e mapas passam direto
  // Com internet: busca a versão mais nova (até 4 s). Sem internet ou lento: usa a cópia guardada no aparelho.
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const guardada = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request, { cache: 'no-cache' }).then((resp) => { if (resp.ok) c.put(e.request, resp.clone()); return resp; });
    if (!guardada) return rede;
    const espera = new Promise((res) => setTimeout(() => res(guardada), 4000));
    return Promise.race([rede.catch(() => guardada), espera]);
  }));
});
