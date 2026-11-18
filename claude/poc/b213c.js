// 2.13: passeio completo como COORDENADOR (admin), caçando erro em cada tela e checando o que ele espera da versão
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const P1 = [-20.1436, -44.8908], P2 = [-20.1446, -44.8908];
const info = (p) => p.evaluate(() => window.__app.mapaInfo());
const tick = async (p) => { await p.evaluate(() => window.__app.tickMapa()); await p.waitForTimeout(500); };
const clicarBalao = async (p, lat, lon) => { const xy = await p.evaluate(([a, b]) => { const m = window.__app.mapa; const pt = m.latLngToContainerPoint([a, b]); const r = m.getContainer().getBoundingClientRect(); return [r.left + pt.x, r.top + pt.y - 18]; }, [lat, lon]); await p.mouse.click(xy[0], xy[1]); await p.waitForSelector('.ficha-com'); return limpo(await p.locator('.ficha-com').innerText()); };
const reg = (n, usr) => ({ uuid: 'cd-' + n, projeto: PJ, equipe: usr === 'div-1' ? 'Equipe 1' : 'Equipe 2', usuario: usr, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(), latitude: -20.1436 + n / 1e4, longitude: -44.8908 + n / 1e4, 'Foto 1': 'x.jpg' });
(async () => {
  await L.subir(); await L.configurar(); await L.semear(300);
  const D1 = ['div-1', 'equipe01'], D2 = ['div-2', 'equipe02'];
  const srv = (acao, dados, [u, s] = D2) => L.post(acao, Object.assign({ projeto: PJ }, dados), u, s);
  await L.post('usuario_salvar', { usuario_dados: { login: 'pref', senha: 'cliente1', nome: 'Prefeitura', perfil: 'cliente', projeto: PJ } });
  await srv('com_salvar', { com: { texto: 'Fiação baixa na rua das Flores', latitude: P1[0], longitude: P1[1] } }, D1);
  await srv('com_salvar', { com: { texto: 'Cachorro bravo no número 80', latitude: P2[0], longitude: P2[1] } }, D2);
  const b = await chromium.launch();
  const E = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const p = E.p;
  const consoleErr = []; const falhaRede = []; p.on('console', (m) => { if (m.type() === 'error' && !/favicon|tile\.openstreetmap|Failed to load resource.*(40[34]|ERR_)/.test(m.text() + '')) consoleErr.push(m.text().slice(0, 160)); });
  p.on('requestfailed', (q) => { if (!/openstreetmap|arcgis|google|nominatim|fonts|unpkg/.test(q.url())) falhaRede.push(q.url().slice(0, 100)); });
  await L.logar(p, 'admin', L.senha()); await p.waitForTimeout(1500);
  // 1. passeio por todas as telas do coordenador
  const rotas = ['#inicio', '#mapa', '#painel', '#hoje', '#relatorio', '#medicao', '#lista', '#ordens', '#preferencias', '#validacao', '#producao', '#auditoria', '#sobre', '#admin/exportar', '#admin/importar', '#admin/projetos', '#admin/times', '#admin/usuarios', '#admin/pessoas', '#admin/setores', '#admin/formularios', '#admin/seguranca', '#admin/revisao'];
  const vazias = [], comErro = [];
  for (const r of rotas) {
    const n0 = p.erros.length; await p.goto(L.WEB + r); await p.waitForTimeout(1800);
    const txt = limpo(await p.locator('body').innerText().catch(() => '')); const erroTela = await p.locator('.aviso.erro, .erro-tela').count();
    if (txt.length < 40) vazias.push(r); if (p.erros.length > n0 || /Erro ao|undefined|NaN|\[object/.test(txt) || erroTela) comErro.push(r + (/undefined|NaN|\[object/.test(txt) ? ' (texto: ' + (txt.match(/.{0,30}(undefined|NaN|\[object).{0,30}/) || [''])[0] + ')' : ''));
    await p.screenshot({ path: 'b213c-' + r.replace(/[#/]/g, '_') + '.png' });
  }
  ok('K.1', !vazias.length && !comErro.length, `${rotas.length} telas visitadas; vazias: ${vazias.join(', ') || 'nenhuma'}; com erro, undefined ou NaN: ${comErro.join(' | ') || 'nenhuma'}`);
  // 2. mapa como coordenador: balões dos dois coletores, legenda, setores, ficha com os botões de coordenação
  await p.goto(L.WEB + '#mapa'); await p.waitForFunction(() => window.__app && window.__app.mapaInfo, null, { timeout: 25000 }); await p.waitForTimeout(2500);
  await p.evaluate(([a, b2]) => { window.__app.mapa.setView([(a[0] + b2[0]) / 2, a[1]], 17, { animate: false }); }, [P1, P2]); await p.waitForTimeout(700);
  const i0 = await info(p); const f1 = await clicarBalao(p, ...P1);
  ok('K.2', i0.com === 2 && i0.set >= 4 && /Fiação baixa/.test(f1) && /Resolver com resposta/.test(f1) && /Editar/.test(f1) && /Apagar/.test(f1), `balões ${i0.com}, polígonos dos setores ${i0.set}; ficha: "${f1.slice(0, 140)}"`);
  // 3. resolver sem escrever resposta, reabrir, resolver com texto cheio de símbolos (nada é tratado como código nem fórmula)
  await p.click('.ficha-com button:has-text("Resolver com resposta")'); await p.waitForSelector('.veu textarea'); await p.click('.veu .folha button:has-text("Resolver")'); await p.waitForTimeout(1500);
  let it = (await srv('com_listar', {}, D1)).itens.find((x) => /Fiação/.test(x.texto)); const semResp = it.situacao; const fSem = await clicarBalao(p, ...P1);
  await p.click('.ficha-com button:has-text("Reabrir")'); await p.waitForTimeout(1200); it = (await srv('com_listar', {}, D1)).itens.find((x) => /Fiação/.test(x.texto)); const reab = it.situacao;
  const estranho = '<img src=x onerror=alert(1)> =SOMA(A1:A2) "aspas" & ação\nlinha 2 😀'; await clicarBalao(p, ...P1); await p.click('.ficha-com button:has-text("Resolver com resposta")'); await p.waitForSelector('.veu textarea'); await p.fill('.veu textarea', estranho); await p.click('.veu .folha button:has-text("Resolver")'); await p.waitForTimeout(1500);
  it = (await srv('com_listar', {}, D1)).itens.find((x) => /Fiação/.test(x.texto)); const fEst = await clicarBalao(p, ...P1); const injetou = await p.locator('.ficha-com img').count();
  ok('K.3', semResp === 'Resolvido' && /Resolvido\./.test(fSem) && reab === 'Aberto' && it.resposta === estranho && injetou === 0 && /<img src=x onerror=alert\(1\)>/.test(fEst) && !p.erros.length, `sem resposta: ${semResp} (ficha mostra "Resolvido."); reabriu: ${reab}; símbolos guardados iguais: ${it.resposta === estranho}; HTML virou texto: ${injetou === 0}`);
  // 4. coordenação cria ponto sem GPS (nasce no centro do mapa), arrasta e salva: a posição salva é a do balão arrastado
  await p.evaluate(() => { window.__app.mapa.setView([-20.15, -44.9], 17, { animate: false }); }); await p.waitForTimeout(500);
  await p.click('button[aria-label="Ponto de comunicação"]'); await p.waitForSelector('.com-novo textarea'); await p.waitForTimeout(1200); const mk = p.locator('.com-pino.novo'); const bx = await mk.boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.down(); await p.mouse.move(bx.x + bx.width / 2 + 120, bx.y + bx.height / 2 - 80, { steps: 8 }); await p.mouse.up();
  await p.fill('.com-novo textarea', 'Ponto criado pela coordenação, ' + 'texto longo '.repeat(35)); const len = (await p.inputValue('.com-novo textarea')).length; await p.click('.com-novo button:has-text("Salvar ponto")'); await p.waitForTimeout(1500);
  const todos = (await srv('com_listar', {}, D2)).itens; const novo = todos.find((x) => /pela coordenação/.test(x.texto));
  ok('K.4', !!novo && novo.login === 'admin' && Math.abs(novo.longitude - -44.9) > 0.0005 && Math.abs(novo.latitude - -20.15) > 0.0003 && len <= 500, `salvo por ${novo && novo.login} em ${novo && novo.latitude}, ${novo && novo.longitude} (centro era -20.15, -44.9; mexeu ao arrastar); texto ${len} caracteres`);
  // 5. sem internet, a coordenação não consegue resolver: aviso claro, nada quebra
  await E.ctx.setOffline(true); await p.waitForTimeout(300); await p.evaluate(([a, b2]) => { window.__app.mapa.setView([a, b2], 18, { animate: false }); }, P2); await p.waitForTimeout(500);
  await clicarBalao(p, ...P2); await p.click('.ficha-com button:has-text("Resolver com resposta")'); await p.waitForSelector('.veu textarea'); await p.fill('.veu textarea', 'x'); await p.click('.veu .folha button:has-text("Resolver")'); await p.waitForTimeout(900);
  const toast = limpo(await p.locator('.toast').allInnerTexts().then((t) => t.join(' ')).catch(() => '')); await E.ctx.setOffline(false);
  const still = (await srv('com_listar', {}, D2)).itens.find((x) => /Cachorro/.test(x.texto)).situacao;
  ok('K.5', /internet/i.test(toast) && still === 'Aberto' && !p.erros.length, `aviso: "${toast.slice(0, 100)}"; servidor segue ${still}`);
  // 6. mapa ao vivo para a coordenação: ponto novo de uma dupla aparece sozinho
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); const a0 = (await info(p)).pts; await srv('registro', { linha: reg(7, 'div-1') }, D1); await tick(p); const a1 = (await info(p)).pts;
  ok('K.6', a1 === a0 + 1, `pontos no mapa da coordenação: ${a0} depois ${a1}`);
  // 7. dados da câmera: o que a exportação entrega
  const adm = (await L.post('listar', { projeto: PJ })).linhas; const temCol = adm.length && Object.keys(adm[0]).includes('sensores_foto');
  const cli = await L.post('listar', { projeto: PJ }, 'pref', 'cliente1').then((x) => x.linhas, (e) => e.message); const cliTem = Array.isArray(cli) && cli.some((l) => 'sensores_foto' in l);
  const mCli = await L.post('mapa', { projeto: PJ, campos: ['uuid', 'sensores_foto'] }, 'pref', 'cliente1').then((x) => x.linhas.some((l) => l[1]), () => false);
  ok('K.7', !cliTem && !mCli, `coluna sensores_foto na planilha da coordenação: ${temCol}; o cliente recebe a coluna na lista: ${cliTem}, no mapa: ${mCli}`);
  // 7b. exportação (CSV): a coluna dos dados da câmera não vai para a entrega ao cliente
  await srv('registro', { linha: Object.assign(reg(9, 'div-1'), { sensores_foto: '{"Foto 1":{"marca":"Apple","modelo":"iPhone 13"}}' }) }, D1);
  const ver = (await L.post('listar', { projeto: PJ })).linhas.find((l) => l.uuid === 'cd-9'); const naPlanilha = !!(ver && ver.sensores_foto);
  const EX = await L.celular(b, { acceptDownloads: true, viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false }); const x = EX.p; await L.logar(x, 'admin', L.senha()); await x.waitForTimeout(1200);
  await x.goto(L.WEB + '#admin/exportar'); await x.waitForSelector('text=Exportar dados'); await x.selectOption('.cartao select >> nth=0', PJ);
  const [dl] = await Promise.all([x.waitForEvent('download', { timeout: 120000 }), x.click('.cartao button:has-text("CSV")')]); await dl.saveAs('saida213.csv'); const csvTxt = fs.readFileSync('saida213.csv', 'utf8');
  ok('K.7b', naPlanilha && !/sensores_foto|iPhone 13/.test(csvTxt) && /uuid|Codigo|latitude/i.test(csvTxt), `planilha do servidor guarda os dados da câmera: ${naPlanilha}; CSV exportado (${csvTxt.length} caracteres) contém "sensores_foto" ou o modelo: ${/sensores_foto|iPhone 13/.test(csvTxt)}`);
  // 8. a tela de formulários mostra a versão do servidor e do formulário (para saber se o servidor 2.15 foi instalado)
  await p.goto(L.WEB + '#sobre'); await p.waitForTimeout(2200); const tf = limpo(await p.locator('body').innerText()); await p.screenshot({ path: 'b213c-sobre.png' });
  ok('K.8', /versão 2\.15\.0 · servidor 2\.15/.test(tf), `tela Sobre: "${tf.slice(0, 260)}"`);
  // 9. o celular do coordenador: mapa em tela pequena sem botão cortado
  const EM = await L.celular(b, {}); const m = EM.p; await L.logar(m, 'admin', L.senha()); await m.goto(L.WEB + '#mapa'); await m.waitForFunction(() => window.__app && window.__app.mapaInfo, null, { timeout: 25000 }); await m.waitForTimeout(2500);
  const bt = await m.locator('button[aria-label="Ponto de comunicação"]').boundingBox(); const vp = m.viewportSize(); await m.screenshot({ path: 'b213c-celular.png' });
  ok('K.9', bt && bt.x >= 0 && bt.x + bt.width <= vp.width && bt.y >= 0 && bt.y + bt.height <= vp.height, `botão do balão no celular: ${JSON.stringify(bt)} (tela ${vp.width}x${vp.height})`);
  const erros = [...p.erros, ...m.erros]; ok('K.10', !erros.length && !consoleErr.length, `erros de JavaScript: ${erros.join(' | ') || 'nenhum'}; erros no console: ${consoleErr.join(' | ') || 'nenhum'}; requisições que falharam: ${falhaRede.join(', ') || 'nenhuma'}`);
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
