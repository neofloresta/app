// Bloco 3 (mapa) e parte do bloco 6 (tempo de mapa e login por escala)
const { chromium } = require('playwright');
const L = require('./lib');
const N = +(process.argv[2] || 5000);
(async () => {
  await L.subir(); await L.configurar(); await L.semear(N);
  const t0 = Date.now(); const j = await L.post('listar', { projeto: 'divinopolis' });
  const bytes = JSON.stringify(j).length; const tl = Date.now() - t0;
  const b = await chromium.launch(); const { p, ctx } = await L.celular(b);
  // limita a rede como um 4G razoável (aprox. 10 Mbps, 60 ms)
  const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1.25e6, uploadThroughput: 0.5e6 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // celular intermediário
  const t1 = Date.now(); await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova', { timeout: 120000 }); const tLogin = Date.now() - t1;
  await p.waitForTimeout(500);
  const t2 = Date.now(); await p.goto(L.WEB + '#consulta');
  // calçadas sem árvores não viram ponto no mapa (só a linha da face): o total fica um pouco abaixo de N
  await p.waitForFunction((n) => { const t = (document.querySelector('.mapa-conta') || {}).textContent || ''; const m = t.match(/de ([\d.]+) pontos/); return m && +m[1].replace(/\./g, '') >= n * 0.7 && !/Carregando pontos|atualizando/.test(t); }, N, { timeout: 180000 });
  if (await p.locator('.mapa-sel.oculto').count()) await p.click('.bt-filtros'); // no celular os filtros começam recolhidos
  await p.waitForTimeout(100); const tMapa = Date.now() - t2;
  const desenhados = await p.locator('.mapa-conta').innerText();
  // interação: zoom
  const t3 = Date.now(); await p.evaluate(() => { window.__app.mapa.zoomIn(); }); await p.waitForTimeout(400); const tZoom = Date.now() - t3;
  
  // clique num ponto
  let ficha = '';
  // busca por código: deve achar um só e abrir a ficha
  const t4 = Date.now(); await p.fill('.mapa-filtros input', 'E2-0007'); await p.waitForSelector('.leaflet-popup-content, .mapa-folha .ficha', { timeout: 10000 }).catch(() => {}); const tBusca = Date.now() - t4;
  ficha = await p.locator('.leaflet-popup-content, .mapa-folha .ficha').first().innerText().catch(() => 'sem ficha');
  await p.fill('.mapa-filtros input', ''); await p.waitForTimeout(600);
  const t5 = Date.now(); await p.selectOption('select:has(option:text("Todos os riscos"))', 'Alto'); await p.waitForTimeout(50); const filtrado = await p.locator('.mapa-conta').innerText(); const tFiltro = Date.now() - t5;
  await p.selectOption('.mapa-sel select >> nth=0', 'Equipe 2'); const filtrado2 = await p.locator('.mapa-conta').innerText();
  await p.selectOption('select:has(option:text("Todos os bairros"))', 'Sidil'); const filtrado3 = await p.locator('.mapa-conta').innerText();
  await p.screenshot({ path: `mapa-${N}.png` });
  const res = { N, listarMs: tl, listarMB: +(bytes / 1e6).toFixed(1), loginMs: tLogin, mapaMs: tMapa, desenhados, zoomMs: tZoom, tBusca, tFiltro, filtrado, filtrado2, filtrado3, ficha: ficha.replace(/\n/g, ' | '), erros: p.erros };
  console.log(JSON.stringify(res));
  require('fs').writeFileSync(__dirname + `/res-b3-${N}.json`, JSON.stringify(res));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
