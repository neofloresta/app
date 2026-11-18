// 2.14 (telas): coletor parceiro pede quadra pelo mapa; coordenação aprova/recusa na lista de pedidos
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
const tocar = async (p, lat, lon, z = 17) => { const xy = await p.evaluate(([a, b, z]) => { const m = window.__app.mapa; m.closePopup(); m.setView([a, b], z, { animate: false }); const pt = m.latLngToContainerPoint([a, b]); const r = m.getContainer().getBoundingClientRect(); return { x: r.left + pt.x, y: r.top + pt.y }; }, [lat, lon, z]); await p.waitForTimeout(800); await p.mouse.click(xy.x, xy.y); await p.waitForTimeout(700); };
(async () => {
  await L.subir(); await L.configurar();
  const vTermo = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1];
  await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } }); await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const novo = async (login, senha, ind) => { await L.post('usuario_salvar', { usuario_dados: { login, senha, nome: login, perfil: 'coletor', projeto: PJ, equipe: login.toUpperCase(), codigo: login.slice(0, 3).toUpperCase(), indicacao: ind } }); await L.post('aceitar_termo', { versao: vTermo }, login, senha); };
  await novo('maria', 'maria12345', 'Gap'); await novo('joao', 'joao12345', 'Gap');
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']);
  const centro = [-20.1436, -44.8908]; const viz = cam.quadras.filter((x) => x.f && Math.abs((x.b[1] + x.b[3]) / 2 - centro[0]) < 0.004 && Math.abs((x.b[0] + x.b[2]) / 2 - centro[1]) < 0.004).slice(0, 8);
  await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(Object.assign({}, cam, { total: viz.length, quadras: viz })) });
  const q1 = viz[0], q2 = viz[3]; const cc = (q) => Q.centro(q);
  const srv = (acao, dados, u, s) => L.post(acao, Object.assign({ projeto: PJ }, dados), u, s);
  const sit = async () => { const m = {}; (await L.post('quadras_situacao', { projeto: PJ })).quadras.forEach((q) => { m[q.numero] = q; }); return m; };
  const b = await chromium.launch(); const geo = { geolocation: { latitude: cc(q1)[0], longitude: cc(q1)[1], accuracy: 4 } };
  const EM = await L.celular(b, geo); const m = EM.p; const EJ = await L.celular(b, geo); const j = EJ.p;
  const ER = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, ...geo }); const r = ER.p;
  await L.logar(m, 'maria', 'maria12345'); await L.logar(j, 'joao', 'joao12345'); await L.logar(r, 'admin', L.senha());
  const ir = async (p) => { await p.goto(L.WEB + '#mapa'); await p.waitForFunction(() => window.__app && window.__app.mapaInfo, null, { timeout: 25000 }); await p.waitForTimeout(2500); };
  await ir(m); await ir(j);
  // 1. a Maria toca numa quadra sem reserva e pede
  await tocar(m, ...cc(q1)); const f0 = limpo(await m.locator('.qd-ficha').innerText().catch(() => ''));
  const temPedir = await m.locator('.qd-ficha button:has-text("Pedir esta quadra")').count();
  await m.screenshot({ path: 'b214-ficha.png' });
  if (temPedir) { await m.click('.qd-ficha button:has-text("Pedir esta quadra")'); await m.waitForTimeout(1500); }
  let lm = (await srv('reserva_listar', {}, 'maria', 'maria12345')).pedidos;
  ok('M.1', temPedir === 1 && lm.length === 1 && lm[0].situacao === 'Aguardando' && lm[0].quadra === q1.n, `ficha: "${f0.slice(0, 100)}"; botão ${temPedir}; no servidor ${lm.length} pedido(s) ${lm[0] ? lm[0].situacao + ' q' + lm[0].quadra : ''}`);
  // 2. tocar de novo: agora "Cancelar o pedido"
  await tocar(m, ...cc(q1)); const f1 = limpo(await m.locator('.qd-ficha').innerText().catch(() => '')); const cancela = await m.locator('.qd-ficha button:has-text("Cancelar o pedido")').count(); const pedeDeNovo = await m.locator('.qd-ficha button:has-text("Pedir esta quadra")').count();
  ok('M.2', cancela === 1 && pedeDeNovo === 0 && /Aguarde/.test(f1), `ficha: "${f1.slice(0, 120)}"`);
  await m.evaluate(() => { window.__app.mapa.closePopup(); });
  // 3. coordenação: botão Pedidos com selo 1; abre e vê o pedido
  await ir(r); await r.evaluate(() => window.__app.tickMapa()); await r.waitForTimeout(1200);
  const selo = limpo(await r.locator('.selo-ped').innerText().catch(() => '')); await r.click('button[aria-label="Pedidos de reserva de quadra"]'); await r.waitForSelector('.ped-lista'); const lista = limpo(await r.locator('.ped-lista').innerText());
  await r.screenshot({ path: 'b214-pedidos.png' });
  ok('M.3', selo === '1' && new RegExp('maria pediu a quadra ' + q1.n).test(lista) && (await r.locator('.ped-lin button:has-text("Aprovar")').count()) === 1, `selo "${selo}"; lista: "${lista.slice(0, 140)}"`);
  // 4. aprova: a quadra passa a ser da equipe da Maria e a lista esvazia
  await r.click('.ped-lin button:has-text("Aprovar")'); await r.waitForTimeout(2000); const S1 = await sit(); const lista2 = limpo(await r.locator('.ped-lista').innerText().catch(() => ''));
  ok('M.4', S1[q1.n] && S1[q1.n].equipe === 'MARIA' && /Nenhum pedido/.test(lista2), `equipe da quadra ${q1.n}: "${S1[q1.n] && S1[q1.n].equipe}"; lista: "${lista2}"`);
  await r.click('.veu button:has-text("Fechar")').catch(() => {});
  // 5. a Maria vê "Quadra liberada" na tela inicial
  await m.evaluate(() => window.__app.tickMapa()); await m.waitForTimeout(1500); await m.goto(L.WEB + '#'); await m.waitForSelector('button.nova', { timeout: 20000 }); await m.waitForTimeout(2500);
  await m.click('button[aria-label="Avisos"]'); await m.waitForSelector('.veu #aviso-pedidos'); const av = limpo(await m.locator('.veu #aviso-pedidos').innerText()); await m.screenshot({ path: 'b214-liberada.png' });
  await m.click('.veu #aviso-pedidos button:has-text("Ok")'); await m.waitForTimeout(800); const av2 = limpo(await m.locator('.veu #aviso-pedidos').innerText().catch(() => ''));
  ok('M.5', /Quadra liberada/.test(av) && new RegExp(q1.n).test(av) && av2 === '', `aviso: "${av}"; depois do Ok: "${av2}"`);
  // 6. Maria e João pedem a mesma quadra; a coordenação recusa um com motivo e aprova o outro
  await srv('reserva_pedir', { quadras: [q2.n] }, 'joao', 'joao12345'); await srv('reserva_pedir', { quadras: [q2.n] }, 'maria', 'maria12345');
  await r.evaluate(() => window.__app.tickMapa()); await r.waitForTimeout(1200); await r.click('button[aria-label="Pedidos de reserva de quadra"]'); await r.waitForSelector('.ped-lista'); const l6 = limpo(await r.locator('.ped-lista').innerText());
  const ordem = l6.indexOf('joao pediu') >= 0 && l6.indexOf('joao pediu') < l6.indexOf('maria pediu');
  await r.locator('.ped-lin').nth(0).locator('button:has-text("Recusar")').click(); await r.waitForSelector('.veu input'); await r.locator('.veu input').last().fill('Quadra em validação'); await r.locator('.veu').last().locator('button:has-text("Recusar")').click(); await r.waitForTimeout(2000);
  const ped = (await srv('reserva_listar', {})).pedidos;
  const rj = (await srv('reserva_listar', {}, 'joao', 'joao12345')).pedidos.find((x) => x.quadra === q2.n);
  ok('M.6', /2 pedidos para esta quadra/.test(l6) && ordem && rj.situacao === 'Recusado' && rj.motivo === 'Quadra em validação', `lista: "${l6.slice(0, 200)}"; João: ${rj.situacao} (${rj.motivo}); ordem de chegada ${ordem}`);
  // 7. o João vê o motivo na tela inicial
  await j.goto(L.WEB + '#'); await j.waitForSelector('button.nova', { timeout: 20000 }); await j.waitForTimeout(2500); await j.click('button[aria-label="Avisos"]'); await j.waitForSelector('.veu #aviso-pedidos'); const avj = limpo(await j.locator('.veu #aviso-pedidos').innerText().catch(() => ''));
  ok('M.7', /Pedido recusado/.test(avj) && /Quadra em validação/.test(avj), `aviso do João: "${avj}"`);
  const erros = [...m.erros, ...j.erros, ...r.erros]; ok('M.8', !erros.length, erros.join(' | ') || 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
