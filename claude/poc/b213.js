// 2.13 (telas): ponto de comunicação, mapa ao vivo entre duas duplas, setores Norte/Sul/Leste/Oeste, dados da câmera por foto
process.env.FOTO_ARQ = __dirname + '/foto-exif.jpg';
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs'); const A = require('./acoes');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const info = (p) => p.evaluate(() => window.__app.mapaInfo());
const tick = async (p) => { await p.evaluate(() => window.__app.tickMapa()); await p.waitForTimeout(500); };
const baloes = (p, extra = '') => p.locator('.com-pino' + extra + ':not(.novo)').count();
const P1 = [-20.1436, -44.8908], P2 = [-20.1446, -44.8908];
const limpoT = limpo;
const clicarBalao = async (p, lat, lon) => { const xy = await p.evaluate(([a, b]) => { const m = window.__app.mapa; const pt = m.latLngToContainerPoint([a, b]); const r = m.getContainer().getBoundingClientRect(); return [r.left + pt.x, r.top + pt.y - 18]; }, [lat, lon]); await p.mouse.click(xy[0], xy[1]); await p.waitForSelector('.ficha-com'); return limpo(await p.locator('.ficha-com').innerText()); };
const reg = (n) => ({ uuid: 'vivo-' + n, projeto: PJ, equipe: 'Equipe 1', usuario: 'div-1', criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(), latitude: -20.1436 + n / 1e4, longitude: -44.8908, 'Foto 1': 'x.jpg' });
(async () => {
  await L.subir(); await L.configurar();
  const vTermo = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1];
  const novo = async (login, senha, perfil) => { await L.post('usuario_salvar', { usuario_dados: { login, senha, nome: login, perfil, projeto: PJ, equipe: '', codigo: login.slice(0, 3).toUpperCase() } }); await L.post('aceitar_termo', { versao: vTermo }, login, senha); };
  await novo('rev1', 'revisor01', 'revisor'); await novo('cli1', 'cliente01', 'cliente');
  const D1 = ['div-1', 'equipe01'], D2 = ['div-2', 'equipe02'];
  const srv = (acao, dados, [u, s] = D2) => L.post(acao, Object.assign({ projeto: PJ }, dados), u, s);
  await srv('registro', { linha: reg(0) }, D2);
  const b = await chromium.launch(); const cel = { geolocation: { latitude: -20.1436, longitude: -44.8908, accuracy: 4 } };
  const EA = await L.celular(b, cel); const a = EA.p; const EB = await L.celular(b, cel); const bb = EB.p;
  const ER = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const r = ER.p;
  const EC = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const c = EC.p;
  for (const [p, u, s] of [[a, ...D1], [bb, ...D2], [r, 'rev1', 'revisor01'], [c, 'cli1', 'cliente01']]) { await L.logar(p, u, s); }
  for (const p of [a, bb, r]) { await p.goto(L.WEB + '#mapa'); await p.waitForFunction(() => window.__app && window.__app.mapaInfo, null, { timeout: 25000 }); }
  await a.waitForTimeout(2500);
  // 1. mapa ao vivo: o ponto que uma dupla cadastra aparece na outra sem recarregar
  const antes = (await info(bb)).pts; await srv('registro', { linha: reg(1) }, D1); await tick(bb); const depois = (await info(bb)).pts;
  ok('J.1', antes >= 1 && depois === antes + 1, `dupla 2 tinha ${antes} ponto(s); depois de a dupla 1 cadastrar e o mapa atualizar: ${depois}`);
  await srv('registro', { linha: reg(2) }, D1); const t0 = Date.now(); let prox = (await info(bb)).pts; for (let i = 0; i < 45 && prox === depois; i++) { await bb.waitForTimeout(1000); prox = (await info(bb)).pts; }
  ok('J.2', prox === depois + 1, `sozinho, sem tocar em nada: o ponto novo chegou em ${Math.round((Date.now() - t0) / 1000)} s (limite 40 s)`);
  // 2. ponto de comunicação: a dupla 1 cria; limite de 500 caracteres
  await a.click('button[aria-label="Ponto de comunicação"]'); await a.waitForSelector('.com-novo textarea'); await a.fill('.com-novo textarea', 'x'.repeat(600)); const tam = (await a.inputValue('.com-novo textarea')).length;
  await a.fill('.com-novo textarea', 'Poda da prefeitura bloqueando a calçada'); await a.screenshot({ path: 'b213-novo.png' }); await a.click('.com-novo button:has-text("Salvar ponto")'); await a.waitForTimeout(1500);
  let ls = (await srv('com_listar', {}, D2)).itens; const ia = await info(a);
  ok('J.3', tam === 500 && ls.length === 1 && ls[0].login === 'div-1' && ls[0].situacao === 'Aberto' && ia.com === 1 && ia.comPend === 0, `limite do texto ${tam}; no servidor: ${ls.length} ponto de ${ls[0] && ls[0].login} (${ls[0] && ls[0].situacao}); no mapa da dupla 1: ${ia.com}, na fila: ${ia.comPend}`);
  await a.screenshot({ path: 'b213-balao.png' });
  // 3. a outra dupla vê o balão e o texto, sem botões de coordenação; o cliente não vê nada
  await tick(bb); await bb.locator('.com-pino').first().click(); await bb.waitForSelector('.ficha-com'); const fB = limpo(await bb.locator('.ficha-com').innerText());
  ok('J.4', (await baloes(bb)) === 1 && /Poda da prefeitura/.test(fB) && !/Resolver|Editar|Apagar/.test(fB), `dupla 2 vê o balão (${await baloes(bb)}); ficha: "${fB.slice(0, 120)}"`);
  await c.goto(L.WEB + '#mapa'); await c.waitForTimeout(3500); const cb = await c.locator('.com-pino').count(); const cbt = await c.locator('button[aria-label="Ponto de comunicação"]').count(); let cli = ''; try { cli = (await L.post('com_listar', { projeto: PJ }, 'cli1', 'cliente01')).itens.length + ' itens'; } catch (e) { cli = 'recusado: ' + e.message; }
  ok('J.5', cb === 0 && cbt === 0 && /recusado/.test(cli), `cliente: balões ${cb}, botão ${cbt}, servidor: ${cli}`);
  // 4. sem internet: o ponto nasce no mapa, espera na fila e vai quando a rede volta (a dupla andou uns 110 m: balão em outro lugar)
  await EA.ctx.setGeolocation({ latitude: P2[0], longitude: P2[1], accuracy: 4 }); await a.waitForTimeout(1800);
  await EA.ctx.setOffline(true); await a.waitForTimeout(300); await a.click('button[aria-label="Ponto de comunicação"]'); await a.waitForSelector('.com-novo textarea'); await a.fill('.com-novo textarea', 'Escola fechou a calçada para obra'); await a.click('.com-novo button:has-text("Salvar ponto")'); await a.waitForTimeout(800);
  const io = await info(a); const pend = await a.locator('.com-pino.pendente').count(); const noSrv = (await srv('com_listar', {}, D2)).itens.length;
  await EA.ctx.setOffline(false); await a.evaluate(() => window.dispatchEvent(new Event('online'))); await tick(a); await a.waitForTimeout(800); await tick(a);
  const ls2 = (await srv('com_listar', {}, D2)).itens; const ip = await info(a);
  ok('J.6', io.com === 2 && io.comPend === 1 && pend === 1 && noSrv === 1 && ls2.length === 2 && ip.comPend === 0 && (await a.locator('.com-pino.pendente').count()) === 0, `sem internet: ${io.com} balões, ${io.comPend} na fila, ${pend} tracejado, servidor ${noSrv}; com internet: servidor ${ls2.length}, fila ${ip.comPend}`);
  // 5. coordenação resolve com resposta (outra cor, resposta ao tocar), reabre, edita; o dono apaga o próprio
  await tick(r); await r.evaluate(([a, b]) => window.__app.mapa.setView([a, b], 17, { animate: false }), [(P1[0] + P2[0]) / 2, P1[1]]); await r.waitForTimeout(600); const nr = await baloes(r); await r.screenshot({ path: 'b213-coord.png' });
  const alvo = ls2.find((x) => /Poda/.test(x.texto)); const fR = await clicarBalao(r, ...P1);
  await r.click('.ficha-com button:has-text("Resolver com resposta")'); await r.waitForSelector('.veu textarea'); await r.fill('.veu textarea', 'Já avisei a prefeitura, volta amanhã'); await r.click('.veu .folha button:has-text("Resolver")'); await r.waitForTimeout(1500);
  const res = (await srv('com_listar', {}, D2)).itens.find((x) => x.id === alvo.id);
  ok('J.7', nr === 2 && /Poda/.test(fR) && res.situacao === 'Resolvido' && res.resposta === 'Já avisei a prefeitura, volta amanhã' && (await r.locator('.com-pino.resolvido').count()) === 1, `coordenação vê ${nr} balões; resolveu: ${res.situacao}, resposta "${res.resposta}", balão de outra cor: ${await r.locator('.com-pino.resolvido').count()}`);
  await tick(a); await a.evaluate(([x, y]) => window.__app.mapa.setView([x, y], 18, { animate: false }), P1); await a.waitForTimeout(500); const fA = await clicarBalao(a, ...P1); await a.screenshot({ path: 'b213-resolvido.png' });
  ok('J.8', /Comunicação resolvida/.test(fA) && /Resposta da coordenação/.test(fA) && /Já avisei a prefeitura/.test(fA) && !/Editar|Apagar|Resolver com/.test(fA), `a dupla vê a resposta: "${fA.slice(0, 160)}"`);
  const fRR = await clicarBalao(r, ...P1);   await r.click('.ficha-com button:has-text("Reabrir")'); await r.waitForTimeout(1200);
  const re = (await srv('com_listar', {}, D2)).itens.find((x) => x.id === alvo.id);
  await clicarBalao(r, ...P1); await r.click('.ficha-com button:has-text("Editar")'); await r.waitForSelector('.veu textarea'); await r.fill('.veu textarea', 'Poda da prefeitura bloqueando a calçada (rua Minas)'); await r.click('.veu .folha button:has-text("Salvar")'); await r.waitForTimeout(1800);
  const ed = (await srv('com_listar', {}, D2)).itens;
  ok('J.9', re.situacao === 'Aberto' && !re.resposta && ed.some((x) => /rua Minas/.test(x.texto)), `reabriu: ${re.situacao}, resposta "${re.resposta}"; edição da coordenação no servidor: ${ed.map((x) => x.texto.slice(-14)).join(' | ')}`);
  await a.evaluate(([x, y]) => window.__app.mapa.setView([x, y], 18, { animate: false }), P2); await a.waitForTimeout(500); const fA2 = await clicarBalao(a, ...P2); await a.click('.ficha-com button:has-text("Apagar")'); await a.waitForSelector('.veu .folha'); await a.click('.veu .folha button:has-text("Apagar")'); await a.waitForTimeout(1800);
  const ls4 = (await srv('com_listar', {}, D2)).itens; await tick(bb);
  ok('J.10', /Editar/.test(fA2) && /Apagar/.test(fA2) && ls4.length === 1 && (await baloes(bb)) === 1 && (await baloes(a)) === 1, `dono vê Editar/Apagar; depois de apagar: servidor ${ls4.length}, dupla 1 ${await baloes(a)}, dupla 2 ${await baloes(bb)}`);
  // 6. setores Norte, Sul, Leste e Oeste: só visual, com liga/desliga na legenda
  const is = await info(r); await r.evaluate(() => window.__app.mapa.setView([-20.1436, -44.8908], 13, { animate: false })); await r.waitForTimeout(900); const ir = await info(r);
  const legTxt = limpo(await r.locator('.mapa-leg').innerText()); await r.screenshot({ path: 'b213-setores.png' });
  await r.locator('.mapa-leg .leg-chave:has-text("Setores") input').click(); await r.waitForTimeout(300); const off = await info(r); await r.locator('.mapa-leg .leg-chave:has-text("Setores") input').click(); await r.waitForTimeout(300); const on = await info(r);
  const mini = await a.evaluate(() => !!document.querySelector('.mapa-leg')); const iA = await info(a);
  ok('J.11', is.set >= 4 && ir.rot === 4 && off.set === 0 && off.rot === 0 && on.set >= 4 && /Norte/.test(legTxt) && /Sul/.test(legTxt) && /Leste/.test(legTxt) && /Oeste/.test(legTxt) && iA.set >= 4, `polígonos ${is.set}, rótulos no zoom 13: ${ir.rot}, desligado: ${off.set}, ligado de novo: ${on.set}; legenda: "${legTxt.slice(-120)}"; coletor também vê (${iA.set})`);
  // 7. dados da câmera guardados por foto; só a coordenação recebe
  await a.goto(L.WEB + '#'); await a.waitForSelector('button.nova'); await a.waitForTimeout(800);
  await A.arvoreCompleta(a, { fotos: 1 }); await a.waitForSelector('button.nova', { timeout: 20000 }).catch(() => {}); await a.waitForTimeout(3500); await a.evaluate(() => window.__app.sincronizar(true)).catch(() => {}); await a.waitForTimeout(2500);
  const adm = (await L.post('listar', { projeto: PJ })).linhas; const mine = adm.filter((l) => l.usuario === 'div-1' && /^[0-9a-f-]{20,}$/i.test(String(l.uuid)) || (l.usuario === 'div-1' && !String(l.uuid).startsWith('vivo-') && !String(l.uuid).startsWith('seed-')));
  const rec = mine[mine.length - 1] || {}; let sx = {}; try { sx = JSON.parse(rec.sensores_foto || '{}'); } catch (e) { sx = {}; }
  const v1 = Object.values(sx)[0] || {}; const mc = (await srv('mapa', { campos: ['uuid', 'sensores_foto'] }, D1)).linhas; const vazou = mc.some((l) => l[1]);
  const ma = (await L.post('mapa', { projeto: PJ, campos: ['uuid', 'sensores_foto'] })).linhas; const adminVe = ma.some((l) => l[1]);
  ok('J.12', v1.marca === 'Apple' && v1.modelo === 'iPhone 13' && v1.focal_mm === 5.1 && v1.focal_35mm === 26 && v1.abertura === 1.6 && v1.iso === 64 && v1.fonte === 'camera' && !vazou && adminVe, `na planilha: ${JSON.stringify(v1)}; a coordenação recebe a coluna: ${adminVe}; o coletor recebe: ${vazou}`);
  const erros = [...a.erros, ...bb.erros, ...r.erros, ...c.erros];
  ok('J.13', !erros.length, erros.join(' | ') || 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log('ERROS DE PÁGINA', JSON.stringify(erros)); console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
