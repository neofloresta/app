// Quadras nas telas: importar (4 formatos), mapa com números, marcar (com e sem internet), automático ao salvar árvore, escolha de várias, painel
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
const sync = (p) => p.evaluate(() => window.__app.sincronizar(true));
const sit = async (T) => Object.fromEntries((await P('quadras_situacao', { t: T, projeto: 'divinopolis' })).quadras.map((q) => [q.numero, q]));
// clica no centro de uma quadra (lat, lon) no mapa
const tocar = async (p, lat, lon) => { const xy = await p.evaluate(([a, b]) => { const m = window.__app.mapa; m.setView([a, b], 19, { animate: false }); const pt = m.latLngToContainerPoint([a, b]); const r = m.getContainer().getBoundingClientRect(); return { x: r.left + pt.x, y: r.top + pt.y }; }, [lat, lon]); await p.waitForTimeout(500); await p.mouse.click(xy.x, xy.y); await p.waitForTimeout(500); };
(async () => {
  await L.subir(); await L.configurar();
  const T = (await P('login', { u: 'admin', s: L.senha() })).token;
  const b = await chromium.launch();
  // 1. leitura dos 4 formatos e importação pela tela
  const { p: pa } = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(pa, 'admin', L.senha()); await pa.waitForTimeout(1000);
  const fmt = await pa.evaluate(async () => {
    const out = {}; for (const f of ['quadras_shp.zip', 'quadras.gpkg', 'quadras.kml', 'quadras.geojson']) {
      try { const buf = await (await fetch('claude/poc/fixtures/' + f)).arrayBuffer(); const r = await Quadras.lerArquivo(f, buf); const c = Quadras.compactar(r.feicoes, Quadras.campoNumero(r.campos, r.feicoes)); out[f] = { n: c.total, campo: Quadras.campoNumero(r.campos, r.feicoes), q1: c.quadras.find((q) => /^Q?0*1$/.test(q.n)) || c.quadras[0] }; } catch (e) { out[f] = { erro: e.message }; }
    } return out;
  });
  const ref = fmt['quadras.geojson'].q1.b; const dif = (x) => x && x.q1 ? Math.max(...x.q1.b.map((v, i) => Math.abs(v - ref[i]))) : 1;
  ok('Q.1', fmt['quadras_shp.zip'].n === 5184 && fmt['quadras.gpkg'].n === 500 && fmt['quadras.kml'].n === 300 && fmt['quadras.geojson'].n === 5184 && dif(fmt['quadras_shp.zip']) < 2e-6 && dif(fmt['quadras.gpkg']) < 2e-6,
    Object.entries(fmt).map(([k, v]) => `${k}: ${v.erro || v.n + ' quadras, campo do número "' + v.campo + '", diferença máx. ' + dif(v).toExponential(1) + '°'}`).join('; '));
  await pa.goto(L.WEB + '#admin/projetos'); await pa.waitForSelector('text=Projetos');
  await pa.locator('tr:has-text("PMAU Divinópolis") button:has-text("Quadras")').click(); await pa.waitForSelector('.folha input[type=file]');
  await pa.locator('.folha input[type=file]').setInputFiles(__dirname + '/fixtures/quadras_shp.zip'); await pa.waitForSelector('.folha .info:has-text("polígonos")', { timeout: 20000 });
  const campoSug = await pa.locator('.folha select').inputValue();
  await pa.click('.folha button:has-text("Importar")'); await pa.waitForTimeout(3000);
  const cam = await P('quadras_camada', { t: T, projeto: 'divinopolis' });
  ok('Q.2', campoSug === 'QD_NUM' && cam.total === 5184 && JSON.parse(cam.camada).quadras[0].p.BAIRRO, `campo sugerido ${campoSug}; servidor com ${cam.total} quadras; outros campos guardados: ${Object.keys(JSON.parse(cam.camada).quadras[0].p || {}).join(', ')}`);
  // coordenação distribui: Q0001.. ao redor do centro ficam com a Equipe 1
  const camada = JSON.parse(cam.camada); const centro = (q) => [(q.b[1] + q.b[3]) / 2, (q.b[0] + q.b[2]) / 2];
  const perto = camada.quadras.map((q) => ({ q, d: Math.hypot(centro(q)[0] + 20.1436, centro(q)[1] + 44.8908) })).sort((a, b) => a.d - b.d).map((x) => x.q);
  const [q0, q1, q2, q3, q4, q5] = perto;
  await P('quadras_marcar', { t: T, projeto: 'divinopolis', itens: [q0, q1, q2].map((q) => ({ numero: q.n, equipe: 'Equipe 1' })).concat([{ numero: q3.n, equipe: 'Equipe 2' }]) });
  // 2. equipe no mapa
  const E = await L.celular(b); const pe = E.p;
  await L.logar(pe, 'div-1', 'equipe01'); await pe.waitForSelector('button.nova'); await pe.waitForTimeout(1500);
  await pe.goto(L.WEB + '#mapa'); await pe.waitForSelector('select:has(option:text("Quadras por situação"))', { state: 'attached' }); await pe.waitForTimeout(2500);
  await pe.evaluate(([a, b]) => { window.__app.mapa.setView([a, b], 18, { animate: false }); }, centro(q0)); await pe.waitForTimeout(800);
  const rot = await pe.locator('.qd-rot').count(); const temNum = await pe.locator('.qd-rot', { hasText: q0.n }).count();
  await pe.screenshot({ path: 'qd-mapa-equipe.png' });
  ok('Q.3', rot > 10 && temNum === 1 && !(await pe.locator('select:has(option:text("Quadras por situação"))').evaluate((e) => e.classList.contains('oculto'))), `${rot} números de quadra na tela com zoom 18; quadra ${q0.n} visível`);
  await tocar(pe, ...centro(q0)); const pop = await pe.locator('.qd-ficha').innerText().catch(() => '');
  await pe.click('.qd-ficha .chip:has-text("Levantada")'); await pe.waitForTimeout(1200);
  let s = await sit(T);
  ok('Q.4', /Quadra Q/.test(pop) && /Equipe 1/.test(pop) && s[q0.n].situacao === 'Levantada' && s[q0.n].marcada_por === 'div-1', `ficha: "${pop.replace(/\s+/g, ' ').slice(0, 140)}"; servidor: ${s[q0.n].situacao}`);
  await tocar(pe, ...centro(q3)); const pop3 = await pe.locator('.qd-ficha').innerText().catch(() => ''); const chips3 = await pe.locator('.qd-ficha .chip').count();
  ok('Q.5', /Equipe 2/.test(pop3) && chips3 === 0, `quadra da Equipe 2 só para consulta (botões: ${chips3})`);
  await pe.keyboard.press('Escape'); await pe.evaluate(() => { window.__app.mapa.closePopup(); });
  await E.ctx.setOffline(true);
  await tocar(pe, ...centro(q1)); await pe.click('.qd-ficha .chip:has-text("Em levantamento")'); await pe.waitForTimeout(800);
  const fila = await pe.evaluate(async () => ((await window.__app.Store.get('qdfila')) || []).length);
  await E.ctx.setOffline(false); await sync(pe); await pe.waitForTimeout(1200); s = await sit(T);
  ok('Q.6', fila === 1 && s[q1.n].situacao === 'Em levantamento' && (await pe.evaluate(async () => ((await window.__app.Store.get('qdfila')) || []).length)) === 0, `sem internet ficou guardado (${fila}); ao voltar subiu: ${s[q1.n].situacao}`);
  // 3. automático: árvore salva na quadra do GPS (q0 está levantada; o GPS fica em q0? usa a quadra onde o GPS cai)
  const qGps = camada.quadras.find((q) => -44.8908 >= q.b[0] && -44.8908 <= q.b[2] && -20.1436 >= q.b[1] && -20.1436 <= q.b[3]);
  await P('quadras_marcar', { t: T, projeto: 'divinopolis', itens: [{ numero: qGps.n, situacao: 'A levantar', equipe: 'Equipe 1' }] });
  await pe.goto(L.WEB + '#inicio'); await pe.reload(); await pe.waitForSelector('button.nova'); await pe.waitForTimeout(1500);
  await A.arvoreCompleta(pe); await pe.waitForTimeout(800); await sync(pe); await pe.waitForTimeout(1500); s = await sit(T);
  ok('Q.7', s[qGps.n].situacao === 'Em levantamento', `ao salvar a árvore, a quadra ${qGps.n} passou de "A levantar" para "${s[qGps.n].situacao}"`);
  await pe.goto(L.WEB + '#inicio'); await pe.reload(); await pe.waitForSelector('.faixa-qd', { timeout: 10000 }).catch(() => null);
  const faixa = await pe.locator('.faixa-qd').innerText().catch(() => '');
  await pe.screenshot({ path: 'qd-inicio-equipe.png' });
  ok('Q.8', /Quadras da sua equipe: 0 de 3 levantadas/.test(faixa) && /2 em levantamento/.test(faixa), `tela inicial: "${faixa.replace(/\s+/g, ' ')}"`);
  // 4. coordenação escolhe várias e define equipe
  await pa.goto(L.WEB + '#mapa'); await pa.waitForSelector('select:has(option:text("Quadras por situação")):not(.oculto)', { timeout: 20000 }); await pa.waitForFunction(() => !/Carregando/.test(document.querySelector('.mapa-conta').textContent)); await pa.waitForTimeout(1500);
  await tocar(pa, ...centro(q4)); await pa.click('.qd-ficha button:has-text("Escolher várias")'); await pa.waitForTimeout(300);
  await tocar(pa, ...centro(q5)); await tocar(pa, ...centro(perto[6]));
  const barra = await pa.locator('.qd-selecao b').innerText();
  await pa.fill('.qd-selecao input', 'Equipe 2'); await pa.click('.qd-selecao button:has-text("Aplicar")'); await pa.waitForTimeout(1500); s = await sit(T);
  await pa.selectOption('select:has(option:text("Quadras por equipe"))', 'eq'); await pa.waitForTimeout(800);
  await pa.screenshot({ path: 'qd-mapa-equipes.png' });
  ok('Q.9', /3 quadras escolhidas/.test(barra) && [q4, q5, perto[6]].every((q) => s[q.n] && s[q.n].equipe === 'Equipe 2'), `barra: "${barra}"; as 3 ficaram com a Equipe 2`);
  // 5. painel
  await pa.goto(L.WEB + '#painel'); await pa.waitForSelector('text=Andamento por quadras', { timeout: 15000 }).catch(() => null);
  const pn = await pa.locator('.painel-os:has-text("Andamento por quadras")').innerText().catch(() => '');
  ok('Q.10', /Quadras levantadas\s*0\s*de 5\.184/.test(pn) && /Equipe 1/.test(pn) && /Equipe 2/.test(pn), pn.replace(/\s+/g, ' ').slice(0, 260));
  ok('Q.11', !pa.erros.length && !pe.erros.length, 'erros de página: ' + JSON.stringify([pa.erros, pe.erros]));
  fs.writeFileSync('res-bqd.json', JSON.stringify(R, null, 1)); await b.close(); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
