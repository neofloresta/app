// Velocidade: servidor lento (LATENCIA ms por chamada) e celular mais fraco (CPU 4x mais lenta)
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs'); const vm = require('vm');
const T = {}; const marca = (k, ms) => { T[k] = ms; console.log(k.padEnd(40), String(Math.round(ms)).padStart(6), 'ms'); };
const chamadas = async () => (await (await fetch(L.MOCK + '__chamadas')).json()).map((c) => c[1]).filter(Boolean);
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
(async () => {
  await L.subir(); await L.configurar(); await L.semear(+process.env.N || 3000);
  const ctxq = { TextDecoder, console }; vm.createContext(ctxq); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctxq);
  const gj = JSON.parse(fs.readFileSync(__dirname + '/fixtures/' + (process.env.CAMADA || 'quadras_divinopolis.geojson'), 'utf8'));
  const feicoes = gj.features.map((f) => ({ props: Object.fromEntries(Object.entries(f.properties).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])), aneis: f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat() }));
  const cam = ctxq.Quadras.compactar(feicoes, 'quadra', ['ruas']);
  if (gj.faces) cam.faces = gj.faces;
  const TK = (await P('login', { u: 'admin', s: L.senha() })).token; const im = await P('quadras_importar', { t: TK, projeto: 'divinopolis', camada: JSON.stringify(cam) }); console.log('camada', im.total || im.erro);
  const b = await chromium.launch(); const { p } = await L.celular(b);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.CPU || 4 });
  const cron = async (k, fn) => { await chamadas(); const t0 = Date.now(); await fn(); marca(k, Date.now() - t0); const c = await chamadas(); if (c.length) console.log('   chamadas:', c.join(', ')); };
  await cron('login coletor até a tela inicial', async () => { await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova', { timeout: 60000 }); });
  await p.waitForTimeout(3000); await chamadas();
  await cron('reabrir o app (já logado)', async () => { await p.reload(); await p.waitForSelector('button.nova', { timeout: 60000 }); });
  await p.waitForTimeout(3000); await chamadas();
  await cron('nova árvore até o formulário', async () => { await p.click('button.nova'); await p.waitForSelector('.prog'); });
  await cron('escolher categoria', async () => { await A.op(p, 'Categoria', 'Árvore'); });
  await cron('trocar de aba', async () => { await A.aba(p, 'Meio'); });
  await p.goto(L.WEB + '#inicio'); await p.waitForSelector('button.nova'); await p.waitForTimeout(2500); await chamadas();
  await cron('cadastro completo (preencher e concluir)', async () => { await A.arvoreCompleta(p, {}); });
  await cron('abrir mapa até quadras desenhadas', async () => { await p.goto(L.WEB + '#mapa'); await p.waitForFunction(() => document.body.innerText.includes('quadras levantadas'), null, { timeout: 90000 }); });
  await p.evaluate(() => new Promise((r) => { const m = window.__app.mapa; m.once('moveend', () => setTimeout(r, 300)); m.setView([-20.1436, -44.8908], 16); }));
  await cron('arrastar o mapa', async () => { const m = await p.locator('#mapa, .mapa, .leaflet-container').first().boundingBox(); await p.mouse.move(m.x + 200, m.y + 300); await p.mouse.down(); await p.mouse.move(m.x + 100, m.y + 200, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(50); });
  await cron('zoom no mapa', async () => { const r = await p.evaluate(() => new Promise((r) => { const m = window.__app.mapa; const z0 = m.getZoom(); m.once('zoomend', () => setTimeout(() => r('ok'), 0)); m.setZoom(z0 >= 18 ? 16 : 18); /* sem mudança de zoom não há zoomend (era isso que travava o teste) */ setTimeout(() => r(`sem zoomend em 20 s (zoom ${z0} -> ${m.getZoom()})`), 20000); })); if (r !== 'ok') console.log('   AVISO', r); await p.evaluate(() => new Promise((r) => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 3000); })); });
  await cron('trocar filtro do mapa', async () => { await p.selectOption('select >> nth=2', { index: 1 }).catch(() => {}); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); });
  // coordenação
  const { p: q } = await L.celular(b, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  const cdp2 = await q.context().newCDPSession(q); await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 2 });
  await cron('login admin', async () => { await L.logar(q, 'admin', L.senha()); await q.waitForSelector('button.nova, .subabas', { timeout: 60000 }); });
  await q.waitForTimeout(3000); await chamadas();
  for (const [k, hsh, sel] of [['painel', '#painel', '.kpis'], ['usuários', '#admin/usuarios', 'text=Novo usuário'], ['projetos', '#admin/projetos', 'text=Novo projeto'], ['usuários de novo', '#admin/usuarios', 'text=Novo usuário'], ['validação', '#validacao', 'main.validacao select']])
    await cron('abrir ' + k, async () => { await q.goto(L.WEB + hsh); await q.waitForSelector(sel, { timeout: 60000 }); });
  // metas com servidor de 1,5 s por consulta e CPU 4x mais lenta
  const metas = [['login coletor até a tela inicial', 4000], ['reabrir o app (já logado)', 1500], ['nova árvore até o formulário', 1500], ['trocar de aba', 1000], ['abrir mapa até quadras desenhadas', 2500], ['arrastar o mapa', 800], ['abrir usuários de novo', 500]];
  for (const [k, max] of metas) console.log(T[k] <= max ? 'PASSOU' : 'FALHOU', k, Math.round(T[k]), 'ms (meta', max, 'ms)');
  fs.writeFileSync(__dirname + '/res-perf-' + (process.env.ROTULO || 'x') + '.json', JSON.stringify(T, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
