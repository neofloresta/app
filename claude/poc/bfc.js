// Faces de quadra nas telas: importar, começo automático pelo GPS, marcar no mapa, lado todo da rua,
// calçada sem árvores (foto e largura), sem internet, painel em km e "Ver a cidade"
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
const sync = (p) => p.evaluate(() => window.__app.sincronizar(true));
const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
const ARQ = __dirname + '/fixtures/quadras_divinopolis_faces.geojson';
// ponto no meio da face (pelo comprimento), um pouco para dentro da quadra
const meio = (q, f, dentro = 0) => {
  const c = Q.faceCoords(q, f); const mx = 111320 * Math.cos(20.14 * Math.PI / 180), my = 110540; const seg = [];
  let tot = 0; for (let i = 1; i < c.length; i++) { const d = Math.hypot((c[i][0] - c[i - 1][0]) * mx, (c[i][1] - c[i - 1][1]) * my); seg.push(d); tot += d; }
  let alvo = tot / 2; for (let i = 1; i < c.length; i++) { if (alvo <= seg[i - 1]) { const t = alvo / seg[i - 1]; let lon = c[i - 1][0] + t * (c[i][0] - c[i - 1][0]), lat = c[i - 1][1] + t * (c[i][1] - c[i - 1][1]);
    if (dentro) { const ce = Q.centro(q); const dx = (ce[1] - lon) * mx, dy = (ce[0] - lat) * my, n = Math.hypot(dx, dy); lon += (dx / n) * dentro / mx; lat += (dy / n) * dentro / my; } return [lat, lon]; } alvo -= seg[i - 1]; }
  return [c[0][1], c[0][0]];
};
const tocar = async (p, lat, lon, z = 19) => { const xy = await p.evaluate(([a, b, z]) => { const m = window.__app.mapa; m.closePopup(); m.setView([a, b], z, { animate: false }); const pt = m.latLngToContainerPoint([a, b]); const r = m.getContainer().getBoundingClientRect(); return { x: r.left + pt.x, y: r.top + pt.y }; }, [lat, lon, z]); await p.waitForTimeout(700); await p.mouse.click(xy.x, xy.y); await p.waitForTimeout(600); };
const sitF = async (T) => { const j = await P('quadras_situacao', { t: T, projeto: 'divinopolis', faces: true }); return { q: Object.fromEntries(j.quadras.map((x) => [x.numero, x])), f: Object.fromEntries((j.faces || []).map((x) => [x.numero, x])) }; };
(async () => {
  await L.subir(); await L.configurar();
  const T = (await P('login', { u: 'admin', s: L.senha() })).token;
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(ARQ)); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']); const idx = Q.indice(cam.quadras);
  // face para o começo automático: perto do centro, sem outra face a menos de 8 m
  const centro = [-20.1436, -44.8908]; let auto = null;
  for (const q of cam.quadras.filter((x) => x.f && Math.abs((x.b[1] + x.b[3]) / 2 - centro[0]) < 0.004 && Math.abs((x.b[0] + x.b[2]) / 2 - centro[1]) < 0.004)) {
    for (const f of q.f) { if (f.c < 60) continue; const [la, lo] = meio(q, f, 1.5); const v = idx.faces(lo, la, 30); if (v[0] && v[0].id === q.n + '-' + f.i && v[0].d < 15 && (!v[1] || v[1].d - v[0].d >= 8)) { auto = { q, f, la, lo }; break; } }
    if (auto) break;
  }
  const b = await chromium.launch();
  // 1. importação pela tela, com as faces
  const { p: pa } = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(pa, 'admin', L.senha()); await pa.waitForTimeout(800);
  await pa.goto(L.WEB + '#admin/projetos'); await pa.waitForSelector('text=Projetos');
  await pa.locator('tr:has-text("PMAU Divinópolis") button:has-text("Quadras")').click(); await pa.waitForSelector('.folha input[type=file]');
  await pa.locator('.folha input[type=file]').setInputFiles(ARQ); await pa.waitForSelector('.folha .info:has-text("polígonos")', { timeout: 30000 });
  const infoImp = await pa.locator('.folha .info').innerText();
  await pa.click('.folha button:has-text("Importar")'); const toastImp = await pa.waitForSelector('.toast:has-text("Camada importada")', { timeout: 30000 }).then((e) => e.innerText()).catch(() => '');
  const camS = JSON.parse((await P('quadras_camada', { t: T, projeto: 'divinopolis' })).camada);
  ok('F.1', /com as faces/.test(infoImp) && /22\.042 faces/.test(toastImp) && camS.quadras.filter((q) => q.f).length > 5000, `"${infoImp}" → "${toastImp}"`);
  // 2. começo automático pela posição do GPS ao salvar a árvore
  const E = await L.celular(b, { geolocation: { latitude: auto.la, longitude: auto.lo, accuracy: 4 } }); const pe = E.p;
  await L.logar(pe, 'div-1', 'equipe01'); await pe.waitForSelector('button.nova'); await pe.waitForTimeout(1500);
  await pe.evaluate(() => window.__app.Store && 0); await pe.goto(L.WEB + '#mapa'); await pe.waitForTimeout(2500); await pe.goto(L.WEB + '#inicio'); await pe.waitForSelector('button.nova'); await pe.waitForTimeout(800);
  const cats = await (async () => { await pe.click('button.nova'); await pe.waitForSelector('.prog'); const t = await A.campo(pe, 'Categoria').innerText(); await A.excluir(pe).catch(() => {}); return t; })();
  await pe.goto(L.WEB + '#inicio'); await pe.waitForSelector('button.nova'); await pe.waitForTimeout(500);
  const f = await A.arvoreCompleta(pe); await pe.waitForTimeout(1500); await sync(pe); await pe.waitForTimeout(2000);
  let s = await sitF(T); const idA = auto.q.n + '-' + auto.f.i;
  ok('F.2', f.length === 0 && s.f[idA] && s.f[idA].situacao === 'Em levantamento' && s.f[idA].equipe === 'Equipe 1' && s.q[auto.q.n].situacao === 'Em levantamento' && Object.keys(s.f).length === 1,
    `árvore salva a ~1,5 m da face ${idA} (${auto.f.r}), GPS ±4 m: face "${s.f[idA] && s.f[idA].situacao}", quadra "${s.q[auto.q.n] && s.q[auto.q.n].situacao}"; faces marcadas: ${Object.keys(s.f).join(', ')}`);
  ok('F.3', !/Calçada/i.test(cats) && /Árvore/.test(cats), `categorias no cadastro comum: ${cats.replace(/\s+/g, ' ')}`);
  // 3. marcar no mapa
  const q1 = auto.q; const f1 = q1.f.find((x) => x.i !== auto.f.i && x.c > 30);
  await pe.goto(L.WEB + '#mapa'); await pe.waitForSelector('select:has(option:text("Quadras por situação")):not(.oculto)', { timeout: 20000 }); await pe.waitForTimeout(1500);
  await tocar(pe, ...meio(q1, f1)); const pop = await pe.locator('.qd-ficha').innerText().catch(() => '');
  await pe.screenshot({ path: 'fc-ficha.png' });
  await pe.click('.qd-ficha .chip:text-is("Levantada")'); await pe.waitForTimeout(1500); s = await sitF(T);
  ok('F.4', /Face .* da quadra/.test(pop) && pop.includes(f1.r) && s.f[q1.n + '-' + f1.i] && s.f[q1.n + '-' + f1.i].situacao === 'Levantada', `ficha: "${pop.replace(/\s+/g, ' ').slice(0, 160)}"; servidor: ${s.f[q1.n + '-' + f1.i] && s.f[q1.n + '-' + f1.i].situacao}`);
  // 4. lado todo da rua
  const qL = cam.quadras.find((q) => q.f && q.f.some((x) => x.s && cam.quadras.filter((y) => y.f && y.f.some((z) => z.s === x.s)).length >= 3) && Math.abs(q.b[1] - centro[0]) < 0.006 && q.n !== q1.n);
  const fL = qL.f.find((x) => cam.quadras.filter((y) => y.f && y.f.some((z) => z.s === x.s)).length >= 3);
  const ladoIds = cam.quadras.flatMap((q) => (q.f || []).filter((x) => x.s === fL.s).map((x) => q.n + '-' + x.i));
  await tocar(pe, ...meio(qL, fL)); await pe.click('.qd-ficha button:has-text("lado todo")'); await pe.waitForTimeout(500);
  const barra = await pe.locator('.qd-selecao b').innerText();
  await pe.selectOption('.qd-selecao select', 'Levantada'); await pe.click('.qd-selecao button:has-text("Aplicar")'); await pe.waitForTimeout(2000); s = await sitF(T);
  const feitas = ladoIds.filter((id) => s.f[id] && s.f[id].situacao === 'Levantada').length;
  ok('F.5', new RegExp(ladoIds.length + ' faces escolhidas').test(barra) && feitas === ladoIds.length, `${fL.r}: "${barra}"; ${feitas} de ${ladoIds.length} faces levantadas no servidor`);
  await pe.screenshot({ path: 'fc-lado.png' });
  // 5. calçada sem árvores: foto e largura pelo cadastro de calçada
  const f2 = q1.f.find((x) => x.i !== auto.f.i && x.i !== f1.i) || q1.f[0];
  await tocar(pe, ...meio(q1, f2)); await pe.click('.qd-ficha button:has-text("sem árvores")'); await pe.waitForSelector('.prog'); await pe.waitForTimeout(500);
  const titulo = await pe.locator('header, .topo').first().innerText(); const faixa = await pe.locator('.faixa-face').innerText().catch(() => '');
  const catSel = await A.campo(pe, 'Categoria').locator('.op.sel').innerText().catch(() => '');
  await A.op(pe, 'Local do registro', 'Via pública'); await A.foto(pe, 'Foto 1'); await A.concluir(pe); let falta = await A.faltas(pe);
  const pedeLarg = falta.some((x) => /Largura/.test(x)); try { await A.aba(pe, 'Meio'); } catch (e) { /* segue */ } await A.num(pe, 'Largura da calcada (m)', '2,6'); await A.concluir(pe); falta = await A.faltas(pe);
  if (await pe.locator('.folha >> text=Salvar sem GPS').count()) await pe.click('.folha >> text=Salvar sem GPS');
  await pe.waitForTimeout(1500); await sync(pe); await pe.waitForTimeout(2000); s = await sitF(T); const x2 = s.f[q1.n + '-' + f2.i] || {};
  const regs = await pe.evaluate(async () => (await window.__app.Store.todosRegistros()).filter((r) => r.faceId).map((r) => ({ uuid: r.uuid, st: r.status })));
  ok('F.6', /Calçada sem árvores/.test(titulo) && /Face sem árvores/.test(faixa) && /Calçada/.test(catSel) && pedeLarg && falta.length === 0 && x2.situacao === 'Levantada, sem árvores' && x2.largura === '2.6' && regs.length === 1 && x2.registro === regs[0].uuid,
    `tela "${titulo.split('\n')[0]}", faixa "${faixa.split('\n')[0]}", categoria "${catSel}", largura cobrada=${pedeLarg}; servidor: ${x2.situacao}, largura ${x2.largura}, registro ${x2.registro === (regs[0] || {}).uuid ? 'ligado ao cadastro' : 'não ligado'}`);
  // 6. sem internet
  const f3 = q1.f.find((x) => ![auto.f.i, f1.i, f2.i].includes(x.i));
  let filaN = -1, depois = '';
  if (f3) {
    await pe.goto(L.WEB + '#mapa'); await pe.waitForSelector('select:has(option:text("Quadras por situação")):not(.oculto)', { timeout: 20000 }); await pe.waitForTimeout(1200);
    await E.ctx.setOffline(true); await tocar(pe, ...meio(q1, f3)); await pe.click('.qd-ficha .chip:text-is("Levantada")'); await pe.waitForTimeout(800);
    filaN = await pe.evaluate(async () => ((await window.__app.Store.get('qdfila')) || []).length);
    await E.ctx.setOffline(false); await sync(pe); await pe.waitForTimeout(2000); s = await sitF(T); depois = (s.f[q1.n + '-' + f3.i] || {}).situacao;
  }
  const todasQ1 = q1.f.every((x) => ['Levantada', 'Levantada, sem árvores'].includes((s.f[q1.n + '-' + x.i] || {}).situacao));
  ok('F.7', !f3 || (filaN === 1 && depois === 'Levantada'), f3 ? `sem internet ficou guardado (${filaN}); ao voltar: ${depois}` : 'quadra com 3 faces: sem 4ª face para testar');
  ok('F.8', !todasQ1 || s.q[q1.n].situacao === 'Levantada', `quadra ${q1.n}: ${q1.f.length} faces, todas levantadas=${todasQ1}; quadra "${s.q[q1.n].situacao}"`);
  // 7. outra equipe não mexe na face da Equipe 1
  const E2 = await L.celular(b); await L.logar(E2.p, 'div-2', 'equipe02'); await E2.p.waitForSelector('button.nova'); await E2.p.goto(L.WEB + '#mapa'); await E2.p.waitForSelector('select:has(option:text("Quadras por situação")):not(.oculto)', { timeout: 20000 }); await E2.p.waitForTimeout(1200);
  await tocar(E2.p, ...meio(q1, f1)); const pop2 = await E2.p.locator('.qd-ficha').innerText().catch(() => ''); const chips2 = await E2.p.locator('.qd-ficha .chip').count();
  ok('F.9', /Equipe 1/.test(pop2) && chips2 === 0, `face da Equipe 1 vista pela Equipe 2: só consulta (botões ${chips2})`);
  // 8. painel e "Ver a cidade"
  await pa.goto(L.WEB + '#painel'); await pa.waitForSelector('.kpis'); await pa.waitForSelector('text=Calçada levantada', { timeout: 20000 }).catch(() => null);
  const kp = await pa.locator('.kpi:has-text("Calçada levantada")').innerText().catch(() => ''); const tab = await pa.locator('.painel-os table').first().innerText().catch(() => '');
  await pa.screenshot({ path: 'fc-painel.png', fullPage: true });
  ok('F.10', /km/.test(kp) && /Faces levantadas/i.test(tab) && /Equipe 1/.test(tab), `"${kp.replace(/\s+/g, ' ')}"; tabela por equipe: ${tab.split('\n').slice(0, 2).join(' | ').replace(/\t/g, ' ')}`);
  await pa.goto(L.WEB + '#mapa'); await pa.waitForSelector('select:has(option:text("Quadras por situação")):not(.oculto)', { timeout: 20000 });
  await pa.evaluate(() => { window.__app.mapa.setView([-19.9, -43.9], 15, { animate: false }); }); await pa.click('button:has-text("Ver a cidade")'); await pa.waitForTimeout(800);
  const vista = await pa.evaluate(() => { const m = window.__app.mapa; const c = m.getCenter(); return { z: m.getZoom(), lat: c.lat, lon: c.lng }; });
  ok('F.11', vista.z <= 14 && Math.abs(vista.lat + 20.14) < 0.1 && Math.abs(vista.lon + 44.89) < 0.1, `depois de "Ver a cidade": zoom ${vista.z}, centro ${vista.lat.toFixed(3)}, ${vista.lon.toFixed(3)}`);
  await pa.evaluate(([a, c]) => { window.__app.mapa.setView([a, c], 17, { animate: false }); }, meio(q1, f1)); await pa.waitForTimeout(1200); await pa.screenshot({ path: 'fc-mapa.png' });
  // tela pequena: todos os botões da ficha da face dá para tocar (a legenda não pode ficar por cima)
  const Pq = await L.celular(b, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await L.logar(Pq.p, 'div-2', 'equipe02'); await Pq.p.waitForSelector('button.nova'); await Pq.p.goto(L.WEB + '#mapa'); await Pq.p.waitForSelector('select:has(option:text("Quadras por situação")):not(.oculto)', { timeout: 20000, state: 'attached' });
  const filtrosRecolhidos = await Pq.p.locator('.mapa-sel').evaluate((e) => e.classList.contains('oculto')); const altMapa = await Pq.p.locator('#mapa').evaluate((e) => e.getBoundingClientRect().height); await Pq.p.waitForTimeout(1200);
  const qL2 = cam.quadras.find((q) => q.f && q.n !== q1.n && Math.abs(q.b[1] - centro[0]) < 0.01 && q.f.length >= 3 && +q.n > 2300);
  await tocar(Pq.p, ...meio(qL2, qL2.f[0]));
  const tapados = await Pq.p.evaluate(() => [...document.querySelectorAll('.qd-ficha button')].filter((b) => { b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !el || !(el === b || b.contains(el)); }).map((b) => b.textContent));
  const nBt = await Pq.p.locator('.qd-ficha button').count(); await Pq.p.screenshot({ path: 'fc-tela-pequena.png' });
  ok('F.13', nBt >= 4 && !tapados.length && filtrosRecolhidos && altMapa > 400, `celular 360x640: filtros recolhidos=${filtrosRecolhidos}, mapa com ${Math.round(altMapa)} px de altura; ${nBt} botões na ficha da face, tapados: ${tapados.join(', ') || 'nenhum'}`);
  const erros = [...pa.erros, ...pe.erros, ...E2.p.erros, ...Pq.p.erros]; ok('F.12', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript nas telas');
  fs.writeFileSync(__dirname + '/res-bfc.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
