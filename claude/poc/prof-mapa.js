// perfil do arrastar e do zoom do mapa (CPU 4x mais lenta), para achar onde o tempo vai
process.chdir('/home/claude/app210/claude/poc');
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
(async () => {
  await L.subir(); await L.configurar(); await L.semear(3000);
  const ctxq = { TextDecoder, console }; vm.createContext(ctxq); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctxq);
  const gj = JSON.parse(fs.readFileSync('fixtures/' + (process.env.CAMADA || 'quadras_divinopolis_faces.geojson'), 'utf8'));
  const lido = await ctxq.Quadras.lerArquivo('q.geojson', fs.readFileSync('fixtures/' + (process.env.CAMADA || 'quadras_divinopolis_faces.geojson'))); const cam = ctxq.Quadras.compactar(lido.feicoes, 'quadra', ['ruas']);
  const TK = (await P('login', { u: 'admin', s: L.senha() })).token; const im = await P('quadras_importar', { t: TK, projeto: 'divinopolis', camada: JSON.stringify(cam) }); console.log('camada', im.total || im.erro);
  const b = await chromium.launch(); const { p } = await L.celular(b); const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova', { timeout: 60000 }); await p.waitForTimeout(2500);
  await p.goto(L.WEB + '#consulta'); await p.waitForFunction(() => document.body.innerText.includes('quadras levantadas'), null, { timeout: 90000 });
  for (const z of (process.env.ZS || '16,18').split(',').map(Number)) {
    await p.evaluate((zz) => new Promise((r) => { const m = window.__app.mapa; m.once('moveend', () => setTimeout(r, 600)); m.setView([-20.1436, -44.8908], zz); }), z); await p.waitForTimeout(800);
    const n = await p.evaluate(() => { let pol = 0, pt = 0; window.__app.mapa.eachLayer((ly) => { if (ly.getRadius) pt++; else if (ly.getLatLngs) pol++; }); return { pol, pt }; });
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
    const m = await p.locator('#mapa, .mapa, .leaflet-container').first().boundingBox(); const t0 = Date.now(); await p.mouse.move(m.x + 200, m.y + 300); await p.mouse.down(); await p.mouse.move(m.x + 100, m.y + 200, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(50); const ms = Date.now() - t0; await p.waitForTimeout(600);
    const { profile } = await cdp.send('Profiler.stop'); const dt = profile.timeDeltas; const self = {}; const byId = {}; profile.nodes.forEach((nd) => { byId[nd.id] = nd; });
    profile.samples.forEach((id, i) => { const nd = byId[id]; const k = (nd.callFrame.functionName || '(anon)') + ' ' + (nd.callFrame.url.split('/').pop() || '') + ':' + nd.callFrame.lineNumber; self[k] = (self[k] || 0) + (dt[i] || 0) / 1000; });
    console.log(`\nzoom ${z}: arrastar ${ms} ms; camadas: ${n.pol} polígonos, ${n.pt} pontos`);
    Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log('  ', String(Math.round(v)).padStart(5), 'ms', k));
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
