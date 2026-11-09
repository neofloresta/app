// Testes extras (rodada de 04/11, 2ª conferência): celular parado, mesmo usuário em dois celulares e toque no ponto do mapa
const { chromium } = require('playwright');
const L = require('./lib'); const A = require('./acoes');
const R = {}; const log = (k, ok, obs) => { R[k] = { ok, obs }; console.log(k, ok ? 'PASSOU' : 'FALHOU', '|', obs); };
const pend = (p) => p.evaluate(async () => (await window.__app.Store.todosRegistros()).filter((r) => r.status === 'pendente').length);
async function enviar(p) { for (let i = 0; i < 60; i++) { if (!(await pend(p))) return true; await p.evaluate(() => window.__app.sincronizar(true)); await p.waitForTimeout(500); } return false; }
(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch();
  // 1) celular parado: GPS informa a posição uma vez e depois fica quieto (aparelho no bolso, equipe parada)
  {
    const { p, ctx } = await L.celular(b); await L.logar(p, 'div-1', 'equipe01'); await p.waitForTimeout(1500);
    await p.waitForTimeout(25000); // mais de 20 s sem nova leitura
    await A.arvoreCompleta(p, { fotos: 1 });
    const r = await p.evaluate(async () => (await window.__app.Store.todosRegistros()).map((x) => x.lat));
    log('GPS parado', !p.semGps && r.every((x) => x != null), `árvores salvas sem GPS: ${p.semGps || 0} de ${r.length}`);
    await ctx.close();
  }
  // 2) mesmo usuário em dois celulares, ambos sem internet
  {
    const c1 = await L.celular(b), c2 = await L.celular(b);
    await L.logar(c1.p, 'div-2', 'equipe02'); await L.logar(c2.p, 'div-2', 'equipe02'); await c1.p.waitForTimeout(1500);
    await c1.ctx.setOffline(true); await c2.ctx.setOffline(true);
    for (let i = 0; i < 2; i++) { await A.arvoreCompleta(c1.p, { fotos: 1 }); await A.arvoreCompleta(c2.p, { fotos: 1 }); }
    await c1.ctx.setOffline(false); await c2.ctx.setOffline(false); await enviar(c1.p); await enviar(c2.p);
    const cods = (await L.post('mapa', { projeto: 'divinopolis', campos: ['uuid', 'Codigo'] })).linhas.map((l) => l[1]).filter((c) => /^E2-/.test(c));
    const dup = [...new Set(cods.filter((c, i) => cods.indexOf(c) !== i))];
    log('Mesmo usuário em dois celulares', !dup.length, `códigos: ${cods.join(', ')}; repetidos: ${dup.join(', ') || 'nenhum'}`);
    await c1.ctx.close(); await c2.ctx.close();
  }
  // 3) tocar no ponto da árvore com a "minha posição" ligada
  {
    const { p, ctx } = await L.celular(b); await L.logar(p, 'div-1', 'equipe01'); await p.waitForTimeout(1200);
    await ctx.setGeolocation({ latitude: -20.1436, longitude: -44.8908, accuracy: 4 });
    await A.arvoreCompleta(p, { fotos: 1 }); await enviar(p);
    await ctx.setGeolocation({ latitude: -20.1438, longitude: -44.8912, accuracy: 4 }); // equipe a ~45 m da árvore
    await p.evaluate(() => { location.hash = '#mapa'; }); await p.waitForTimeout(2500);
    // toca no centro de um ponto desenhado (fora dos botões e da legenda)
    const alvo = await p.evaluate(() => { const m = window.__app.mapa; const r = m.getContainer().getBoundingClientRect(); const bts = document.querySelector('.mapa-bts'); const rb = bts ? bts.getBoundingClientRect() : null; const leg = document.querySelector('.mapa-leg'); const rl = leg ? leg.getBoundingClientRect() : null; let a = null;
      m.eachLayer((l) => { if (a || !l.__o) return; const pt = m.latLngToContainerPoint(l.getLatLng()); const x = r.left + pt.x, y = r.top + pt.y; const fora = (q) => !q || x < q.left - 10 || x > q.right + 10 || y < q.top - 10 || y > q.bottom + 10; if (pt.x > 20 && pt.y > 20 && pt.x < r.width - 20 && pt.y < r.height - 20 && fora(rb) && fora(rl)) a = { x, y }; }); return a; });
    if (alvo) { await p.mouse.click(alvo.x, alvo.y); await p.waitForTimeout(700); }
    if (process.env.FOTO_B9) await p.screenshot({ path: process.env.FOTO_B9 });
    const ficha = await p.locator('.leaflet-popup .ficha, .mapa-folha .ficha').count();
    log('Toque no ponto do mapa', !!alvo && ficha > 0, alvo ? (ficha ? 'ficha abriu' : 'tocou no ponto e a ficha não abriu') : 'ponto não encontrado na tela');
    await ctx.close();
  }
  await b.close();
  require('fs').writeFileSync(__dirname + '/res-b9.json', JSON.stringify(R, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
