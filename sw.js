// Funcionamento offline: guarda o app no aparelho. Mude a versão a cada atualização.
const CACHE = 'coleta-v2.9.1';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'config.js', 'manifest.webmanifest', 'icons/icone-192.png', 'icons/icone-512.png', 'icons/icone-maskable-192.png', 'icons/icone-maskable-512.png', 'icons/icone-180.png', 'icons/arvorada-horizontal.svg', 'icons/arvorada-horizontal-branca.svg', 'icons/logo-horizontal.png', 'fonts/roboto-latin-300-normal.woff2', 'fonts/roboto-latin-400-normal.woff2', 'fonts/roboto-latin-400-italic.woff2', 'fonts/roboto-latin-500-normal.woff2', 'fonts/roboto-latin-700-normal.woff2', 'fonts/roboto-latin-900-normal.woff2',
  'vendor/sql-wasm.js', 'vendor/sql-wasm.wasm', 'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/images/marker-icon.png', 'vendor/images/marker-icon-2x.png', 'vendor/images/marker-shadow.png',
  'js/expr.js', 'js/qml2form.js', 'js/store.js', 'js/utm.js', 'js/gpkg.js', 'js/indicadores.js', 'js/arquivos.js', 'js/quadras.js', 'js/api.js', 'js/app.js', 'forms/seade-risco.json', 'forms/divinopolis-inventario.json', 'forms/divinopolis-inventario.qml', 'forms/ajuda/fiacao.svg', 'forms/ajuda.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
const MAPA = 'mapa-fundo'; const MAX_MAPA = 2500; let novasMapa = 0; // imagens do mapa por onde a equipe já passou (funciona sem internet)
// apara as mais antigas; roda na ativação e na primeira gravação de cada vez que o service worker acorda (o contador zera quando o Android o encerra)
async function aparar() { try { const c = await caches.open(MAPA); const ks = await c.keys(); for (let i = 0; i < ks.length - MAX_MAPA; i++) await c.delete(ks[i]); } catch (e) { /* segue */ } }
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== MAPA).map((k) => caches.delete(k)))).then(aparar).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method === 'GET' && (u.hostname === 'tile.openstreetmap.org' || u.hostname === 'server.arcgisonline.com')) {
    e.respondWith(caches.open(MAPA).then(async (c) => {
      const guardada = await c.match(e.request);
      if (guardada) return guardada;
      const rede = fetch(e.request).then(async (resp) => {
        // guarda sem segurar a imagem (aparelho sem espaço não pode quebrar o mapa); só resposta legível (as opacas ocupariam muito espaço)
        if (resp.ok && resp.type === 'cors') e.waitUntil(c.put(e.request, resp.clone()).then(() => { if (novasMapa++ % 100 === 0) return aparar(); }).catch(() => {}));
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
