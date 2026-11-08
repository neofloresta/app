// Estresse: N cadastros (padrão 5.000) divididos entre 5 equipes, cada uma no seu celular, ao mesmo tempo.
// Parte pela tela inteira (como a equipe faz), o resto pelo próprio mecanismo do app (registro guardado no aparelho e enviado
// pela sincronização). Duas equipes trabalham sem internet e mandam tudo de uma vez; quedas no meio do envio; faces de quadra
// marcadas por todas ao mesmo tempo. Confere: nada perdido nem repetido, códigos únicos, fotos, painel e mapa.
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs'); const vm = require('vm');
const N = +process.argv[2] || 5000; const EQ = 5; const UI = +process.env.UI || 6; const FOTOS = 0.2;
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
const t0 = Date.now(); const min = () => ((Date.now() - t0) / 60000).toFixed(1) + ' min';
const ctxq = { TextDecoder, console }; vm.createContext(ctxq); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctxq); const Q = ctxq.Quadras;
(async () => {
  await L.subir(); await L.configurar();
  for (let i = 3; i <= EQ; i++) { await L.post('usuario_salvar', { usuario_dados: { login: 'div-' + i, senha: 'equipe0' + i, nome: 'Equipe ' + i, perfil: 'coletor', projeto: 'divinopolis', equipe: 'Equipe ' + i, codigo: 'E' + i } }); await L.post('aceitar_termo', { versao: 'teste' }, 'div-' + i, 'equipe0' + i); }
  const T = (await P('login', { u: 'admin', s: L.senha() })).token;
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']);
  console.log('camada', (await P('quadras_importar', { t: T, projeto: 'divinopolis', camada: JSON.stringify(cam) })).total);
  const b = await chromium.launch();
  // cada equipe num bairro diferente
  const centros = [[-20.1436, -44.8908], [-20.1300, -44.8800], [-20.1550, -44.9000], [-20.1380, -44.9050], [-20.1500, -44.8750]];
  const eqs = [];
  for (let i = 0; i < EQ; i++) {
    const E = await L.celular(b, { geolocation: { latitude: centros[i][0], longitude: centros[i][1], accuracy: 4 } });
    await L.logar(E.p, 'div-' + (i + 1), 'equipe0' + (i + 1)); await E.p.waitForSelector('button.nova', { timeout: 60000 }); eqs.push(E);
  }
  console.log('5 equipes logadas', min());
  // 1. pela tela inteira, as 5 ao mesmo tempo; equipes 2 e 4 sem internet
  await eqs[1].ctx.setOffline(true); await eqs[3].ctx.setOffline(true);
  const tUI = Date.now();
  const faltasUI = await Promise.all(eqs.map(async (E) => { let f = 0; for (let k = 0; k < UI; k++) { const x = await A.arvoreCompleta(E.p, { fotos: 1 }); f += x.length; await E.p.waitForSelector('button.nova', { timeout: 30000 }); } return f; }));
  ok('S.1', faltasUI.every((f) => f === 0), `${EQ * UI} cadastros pela tela inteira (${UI} por equipe, ao mesmo tempo) em ${((Date.now() - tUI) / 1000).toFixed(0)} s; campos faltando: ${faltasUI.join(', ')}`);
  // 2. o resto do dia: cada equipe gera seus cadastros com o mecanismo do app (código pela faixa reservada, foto em 20%)
  const porEq = Math.floor((N - EQ * UI) / EQ); const tG = Date.now();
  await Promise.all(eqs.map((E, i) => E.p.evaluate(async ([n, c, pf, i]) => {
    const app = window.__app; const S = app.S; const todos = await app.Store.todosRegistros(); const tpl = todos.find((r) => r.status !== 'rascunho' && !r.faceId);
    const cc = S.form.campos.find((x) => x.auto === 'codigo'); const fotoCampo = Object.keys(tpl.fotos)[0];
    for (let k = 0; k < n; k++) {
      const r = JSON.parse(JSON.stringify(tpl)); r.uuid = crypto.randomUUID(); r.status = 'pendente'; delete r.__base; delete r.validacao;
      r.valores[cc.nome] = await app.proximoCodigo(cc.nome);
      const ag = new Date(Date.now() - (n - k) * 20000).toISOString(); r.criado_em = r.atualizado_em = ag;
      r.lat = c[0] + (Math.random() - 0.5) * 0.012; r.lon = c[1] + (Math.random() - 0.5) * 0.012; r.prec = 3 + Math.random() * 6; r.endereco = 'Rua teste ' + k; r.bairro = 'Bairro ' + i;
      if (Math.random() < pf && fotoCampo) r.fotos = { [fotoCampo]: Object.assign({}, tpl.fotos[fotoCampo], { nome: `DCIM/e${i}_${k}_${r.uuid.slice(0, 6)}.jpg`, enviado: false, url: '' }) }; else r.fotos = {};
      await app.Store.salvarRegistro(r);
    }
  }, [porEq, centros[i], FOTOS, i + 1])));
  const resto = N - EQ * UI - porEq * EQ; if (resto) await eqs[0].p.evaluate(async (n) => { const app = window.__app; const tpl = (await app.Store.todosRegistros()).find((r) => r.status === 'pendente'); const cc = app.S.form.campos.find((x) => x.auto === 'codigo'); for (let k = 0; k < n; k++) { const r = JSON.parse(JSON.stringify(tpl)); r.uuid = crypto.randomUUID(); r.valores[cc.nome] = await app.proximoCodigo(cc.nome); r.fotos = {}; await app.Store.salvarRegistro(r); } }, resto);
  const noAparelho = await Promise.all(eqs.map((E) => E.p.evaluate(async () => (await window.__app.Store.todosRegistros()).filter((r) => r.status !== 'rascunho').length)));
  ok('S.2', noAparelho.reduce((a, x) => a + x, 0) === N, `${N} cadastros guardados nos 5 celulares (${noAparelho.join(' + ')}) em ${((Date.now() - tG) / 1000).toFixed(0)} s`);
  // 3. todo mundo manda ao mesmo tempo; as equipes sem internet voltam; 6 quedas no meio do envio
  await eqs[1].ctx.setOffline(false); await eqs[3].ctx.setOffline(false);
  await L.falhar('registro', 6);
  const tS = Date.now(); const pend = (E) => E.p.evaluate(async () => (await window.__app.Store.todosRegistros()).filter((r) => r.status === 'pendente').length);
  let parado = 0, antes = -1;
  while (true) {
    await Promise.all(eqs.map((E) => E.p.evaluate(() => window.__app.sincronizar(true)).catch(() => {})));
    const p = (await Promise.all(eqs.map(pend))).reduce((a, x) => a + x, 0);
    console.log('   faltam enviar', p, min());
    if (!p) break; if (p === antes) { if (++parado > 4) break; } else parado = 0; antes = p;
    if (Date.now() - tS > 45 * 60000) break;
  }
  const tEnvio = (Date.now() - tS) / 1000;
  // conferência no servidor
  const ls = []; let de = 0; while (true) { const j = await P('listar', { t: T, projeto: 'divinopolis', de, n: 2000 }); ls.push(...(j.linhas || j.registros || [])); if (j.proximo == null) break; de = j.proximo; if (ls.length > N * 2) break; }
  const uu = new Set(ls.map((l) => l.uuid)); const cod = ls.map((l) => l['Codigo'] || l.Codigo || ''); const codRep = cod.filter((c, k) => c && cod.indexOf(c) !== k);
  const porE = {}; ls.forEach((l) => { porE[l.equipe] = (porE[l.equipe] || 0) + 1; });
  const pendFim = (await Promise.all(eqs.map(pend))).reduce((a, x) => a + x, 0);
  ok('S.3', ls.length === N && uu.size === N && pendFim === 0, `${ls.length} no servidor, ${uu.size} diferentes, ${pendFim} ainda no celular; envio de tudo em ${(tEnvio / 60).toFixed(1)} min; por equipe: ${Object.entries(porE).map(([e, n]) => e + ' ' + n).join(', ')}`);
  ok('S.4', codRep.length === 0 && cod.every(Boolean), `${cod.filter(Boolean).length} códigos, ${codRep.length} repetidos${codRep.length ? ': ' + codRep.slice(0, 5).join(', ') : ''}`);
  const st = await L.stats(); const nFotos = (st.dcim || []).reduce((a, x) => a + x, 0); const esperado = await Promise.all(eqs.map((E) => E.p.evaluate(async () => (await window.__app.Store.todosRegistros()).filter((r) => r.status !== 'rascunho').reduce((a, r) => a + Object.keys(r.fotos || {}).length, 0))));
  const espTot = esperado.reduce((a, x) => a + x, 0);
  ok('S.5', nFotos === espTot, `${nFotos} fotos no Drive, ${espTot} esperadas`);
  // 4. faces: as 5 equipes marcam 80 faces cada ao mesmo tempo (duas sem internet, mandam depois)
  const idx = Q.indice(cam.quadras); const alvo = centros.map((c) => idx.faces(c[1], c[0], 400).filter((x, k, arr) => arr.findIndex((y) => y.id === x.id) === k).slice(0, 80).map((x) => x.id));
  const ja = new Set(); const minhas = alvo.map((l) => l.filter((id) => !ja.has(id) && ja.add(id)));
  await eqs[2].ctx.setOffline(true); await eqs[4].ctx.setOffline(true);
  const recF = await Promise.all(eqs.map((E, i) => E.p.evaluate(async (ids) => { const rec = []; for (let k = 0; k < ids.length; k += 10) { try { const r = await window.__app.marcarQuadras(ids.slice(k, k + 10).map((id) => ({ tipo: 'face', numero: id, situacao: 'Levantada' }))); rec.push(...(r.recusadas || []).map((x) => x.numero + ': ' + x.motivo)); } catch (e) { rec.push('erro: ' + e.message); } } return rec; }, minhas[i])));
  const recT = recF.flat(); if (recT.length) console.log('   recusadas nas faces:', recT.length, recT.slice(0, 6).join(' | '));
  await eqs[2].ctx.setOffline(false); await eqs[4].ctx.setOffline(false);
  for (let k = 0; k < 30; k++) { // manda a fila de faces de quem estava sem internet
    await Promise.all(eqs.map((E) => E.p.evaluate(() => window.__app.sincronizar(true)).catch(() => {})));
    const f = (await Promise.all(eqs.map((E) => E.p.evaluate(async () => ((await window.__app.Store.get('qdfila')) || []).length)))).reduce((a, x) => a + x, 0);
    if (!f) break; await eqs[0].p.waitForTimeout(2000);
  }
  const sit = await P('quadras_situacao', { t: T, projeto: 'divinopolis', faces: true }); const fl = (sit.faces || []).filter((f) => f.situacao === 'Levantada');
  const certos = minhas.every((ids, i) => ids.every((id) => (sit.faces.find((f) => f.numero === id) || {}).equipe === 'Equipe ' + (i + 1)));
  const totF = minhas.reduce((a, l) => a + l.length, 0);
  ok('S.6', fl.length === totF && certos, `${fl.length} de ${totF} faces levantadas no servidor, cada uma com a equipe certa=${certos}`);
  // 5. coordenação: painel e mapa com tudo
  const { p: pa } = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(pa, 'admin', L.senha()); await pa.waitForTimeout(500);
  let tp = Date.now(); await pa.goto(L.WEB + '#painel'); await pa.waitForSelector('.kpis', { timeout: 120000 }); const tPainel = Date.now() - tp;
  const kReg = await pa.locator('.kpi').first().innerText();
  tp = Date.now(); await pa.goto(L.WEB + '#mapa'); await pa.waitForFunction((n) => (document.querySelector('.mapa-conta') || {}).textContent && document.querySelector('.mapa-conta').textContent.includes(n.toLocaleString('pt-BR') + ' pontos'), N, { timeout: 120000 }); const tMapa = Date.now() - tp;
  await pa.screenshot({ path: 'estresse-mapa.png' });
  ok('S.7', kReg.includes(N.toLocaleString('pt-BR')), `painel em ${(tPainel / 1000).toFixed(1)} s: "${kReg.replace(/\s+/g, ' ')}"; mapa com ${N} pontos em ${(tMapa / 1000).toFixed(1)} s`);
  const erros = [...pa.erros, ...eqs.flatMap((E) => E.p.erros)]; ok('S.8', !erros.length, erros.length ? erros.slice(0, 3).join(' | ') : 'sem erros de JavaScript nos 6 aparelhos');
  const lentos = fs.readFileSync(__dirname + '/mock.log', 'utf8').split('\n').filter((l) => /\[lento\] registro/.test(l)).map((l) => +l.split(' ')[2]);
  console.log(`servidor simulado: ${lentos.length} envios de registro acima de 200 ms (máx ${Math.max(0, ...lentos)} ms); tempo total ${min()}`);
  fs.writeFileSync(__dirname + '/res-bstress.json', JSON.stringify({ N, R, tEnvioMin: tEnvio / 60, tPainel, tMapa, lentos: lentos.length }, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
