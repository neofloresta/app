// Bloco 4: ordens de serviço nas telas (coordenação abre, equipe executa sem internet, cliente acompanha e pede)
const { chromium } = require('playwright');
const L = require('./lib'); const A = require('./acoes');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
const sync = (p) => p.evaluate(() => window.__app.sincronizar(true));

(async () => {
  await L.subir(); await L.configurar();
  await L.post('usuario_salvar', { usuario_dados: { login: 'rev', senha: 'revisor1', nome: 'Revisão', perfil: 'revisor', projeto: 'divinopolis', equipe: 'Coordenação' } });
  await L.post('usuario_salvar', { usuario_dados: { login: 'pref', senha: 'cliente1', nome: 'Prefeitura', perfil: 'cliente', projeto: 'divinopolis' } });
  await L.post('projeto_salvar', { projeto_dados: { id: 'divinopolis', cliente_ve: 'todos' } });
  const b = await chromium.launch();

  // equipe cadastra e envia uma árvore
  const E = await L.celular(b); const pe = E.p;
  await L.logar(pe, 'div-1', 'equipe01'); await pe.waitForSelector('button.nova'); await pe.waitForTimeout(1200);
  await A.arvoreCompleta(pe); await pe.waitForTimeout(400); await sync(pe); await pe.waitForTimeout(800);
  const uuidArv = await pe.evaluate(async () => (await Store.todosRegistros()).find((r) => r.status === 'enviado').uuid);

  // 4.1 coordenação abre a ordem pela ficha da árvore
  const C = await L.celular(b); const pc = C.p; const errosC = pc.erros;
  await L.logar(pc, 'rev', 'revisor1'); await pc.waitForTimeout(800);
  await pc.goto(L.WEB + '#ficha/' + encodeURIComponent(uuidArv)); await pc.waitForSelector('text=Abrir ordem de serviço', { timeout: 15000 });
  await pc.click('text=Abrir ordem de serviço'); await pc.waitForSelector('text=Tipo de serviço');
  await pc.click('button:has-text("Abrir ordem")'); await pc.waitForTimeout(300);
  const semTipo = await pc.locator('select.invalido').count();
  await pc.selectOption('select:has(option:text("Poda de limpeza"))', 'Poda de limpeza');
  await pc.click('.chip:has-text("Alta")'); await pc.fill('textarea', 'Galhos secos sobre a calçada');
  await pc.fill('input[list=os-equipes]', 'Equipe 1');
  await pc.click('button:has-text("Abrir ordem")'); await pc.waitForSelector('.os-item', { timeout: 10000 });
  const itemC = await pc.locator('.os-item').first().innerText();
  await pc.screenshot({ path: 'os-lista-coord.png' });
  ok('4.1', semTipo === 1 && /OS 0001/.test(itemC) && /Poda de limpeza/.test(itemC) && /Aberta/.test(itemC) && /E1-0001/.test(itemC), `sem tipo não abre=${semTipo === 1}; lista: "${itemC.replace(/\s+/g, ' ')}"`);

  // 4.2 equipe vê a ordem na tela inicial e executa sem internet, com foto de antes e depois
  await pe.goto(L.WEB + '#inicio'); await pe.reload(); await pe.waitForFunction(() => { const x = document.querySelector('.selo-sino'); return x && !x.classList.contains('oculto'); }, null, { timeout: 15000 }); await pe.click('.bt-sino'); await pe.waitForSelector('.faixa-os', { timeout: 15000 }); // 2.8: a ordem da equipe fica no sino
  const faixa = await pe.locator('.faixa-os').innerText();
  await pe.click('.faixa-os'); await pe.click('.os-item'); await pe.waitForSelector('text=Concluir serviço');
  await E.ctx.setOffline(true);
  await pe.click('button:has-text("Concluir serviço")'); await pe.waitForTimeout(400);
  const marcouAntes = await pe.locator('[data-foto="foto_antes"].falta').count();
  await pe.locator('[data-foto="foto_antes"] input[type=file]').setInputFiles(A.FOTO); await pe.waitForTimeout(400);
  await pe.click('button:has-text("Concluir serviço")'); await pe.waitForTimeout(400);
  const marcouDepois = await pe.locator('[data-foto="foto_depois"].falta').count();
  await pe.locator('[data-foto="foto_depois"] input[type=file]').setInputFiles(A.FOTO); await pe.waitForTimeout(400);
  await pe.fill('textarea', '3 galhos secos removidos');
  await pe.click('button:has-text("Concluir serviço")'); await pe.waitForSelector('.folha'); await pe.click('.folha button:has-text("Concluir")'); await pe.waitForTimeout(800);
  const offTxt = await pe.locator('main').innerText();
  const fila = await pe.evaluate(async () => ((await Store.get('osfila')) || []).length);
  await pe.screenshot({ path: 'os-execucao-offline.png' });
  await E.ctx.setOffline(false); await pe.waitForTimeout(300); await sync(pe); await pe.waitForTimeout(1500);
  const fila2 = await pe.evaluate(async () => ((await Store.get('osfila')) || []).length);
  const TR = (await P('login', { u: 'rev', s: 'revisor1' })).token;
  const srv = (await P('os_listar', { t: TR, projeto: 'divinopolis' })).ordens[0];
  ok('4.2', /1 ordem de serviço/.test(faixa) && marcouAntes === 1 && marcouDepois === 1 && fila === 1 && /a enviar/i.test(offTxt) && fila2 === 0 && srv.status === 'Concluída' && /drive\.google/.test(srv.foto_antes) && /drive\.google/.test(srv.foto_depois) && srv.execucao_obs === '3 galhos removidos'.replace('3 galhos removidos', '3 galhos secos removidos'),
    `faixa "${faixa.replace(/\s+/g, ' ')}"; sem foto levou à foto de antes=${marcouAntes === 1} e depois=${marcouDepois === 1}; sem internet ficou na fila (${fila}) com "a enviar"; ao voltar a internet subiu (fila ${fila2}); no servidor: ${srv.status}, fotos ${!!srv.foto_antes && !!srv.foto_depois}, obs "${srv.execucao_obs}"`);

  // 4.3 situação e histórico; 4.4 histórico de intervenções na ficha da árvore
  await pc.goto(L.WEB + '#ordens'); await pc.reload(); await pc.waitForTimeout(1500);
  await pc.click('.chip:has-text("Concluídas")'); await pc.click('.os-item'); await pc.waitForSelector('text=Histórico');
  const det = await pc.locator('main').innerText();
  await pc.screenshot({ path: 'os-detalhe.png', fullPage: true });
  const fotosCarregadas = await pc.locator('.os-foto-box img').count();
  ok('4.3', /iniciou a execução|concluiu o serviço/.test(det) && /Concluída/.test(det) && /div-1/.test(det) && fotosCarregadas === 2, `responsável e data em cada etapa; fotos de antes e depois na tela=${fotosCarregadas}; histórico: ${det.split('Histórico')[1].replace(/\s+/g, ' ').slice(0, 220)}`);
  await pc.goto(L.WEB + '#ficha/' + encodeURIComponent(uuidArv)); await pc.waitForSelector('.ficha-sec .os-item', { timeout: 10000 });
  const naFicha = await pc.locator('.ficha-sec:has(h3:text("Ordens de serviço"))').innerText();
  ok('4.4', /OS 0001/.test(naFicha) && /Concluída/.test(naFicha), `ficha da árvore lista as intervenções: "${naFicha.replace(/\s+/g, ' ').slice(0, 160)}"`);

  // 4.5 cliente acompanha (com fotos) e pede um serviço num ponto do mapa; coordenação aprova
  const K = await L.celular(b); const pk = K.p;
  await L.logar(pk, 'pref', 'cliente1'); await pk.waitForTimeout(800);
  await pk.goto(L.WEB + '#ordens'); await pk.waitForTimeout(1500); await pk.click('.chip:has-text("Todas")');
  const nCli = await pk.locator('.os-item').count();
  await pk.click('.os-item'); await pk.waitForTimeout(1500); const fotosCli = await pk.locator('.os-foto-box img').count();
  const semBotoes = await pk.locator('button:has-text("Reabrir"), button:has-text("Cancelar ordem")').count();
  await pk.goto(L.WEB + '#os-nova'); await pk.waitForSelector('.mapa-mini'); await pk.waitForTimeout(800);
  await pk.selectOption('select:has(option:text("Plantio"))', 'Plantio'); await pk.fill('textarea', 'Plantar muda na praça');
  await pk.click('button:has-text("Enviar pedido")'); await pk.waitForTimeout(300); const pedeLocal = await pk.locator('.toast').innerText().catch(() => '');
  await pk.locator('.mapa-mini').scrollIntoViewIfNeeded(); const box = await pk.locator('.mapa-mini').boundingBox(); await pk.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await pk.fill('input[placeholder^="Rua"]', 'Praça do Santuário');
  await pk.click('button:has-text("Enviar pedido")'); await pk.waitForSelector('.os-item', { timeout: 10000 }); await pk.waitForTimeout(500);
  await pk.click('.chip:has-text("Em aberto")'); const ped = await pk.locator('.os-item').first().innerText();
  await pc.goto(L.WEB + '#ordens'); await pc.reload(); await pc.waitForTimeout(1500); await pc.click('.chip:has-text("Pedidos")'); await pc.click('.os-item'); await pc.waitForSelector('text=Aprovar pedido');
  await pc.click('text=Aprovar pedido'); await pc.fill('.folha input[list=os-equipes]', 'Equipe 2'); await pc.fill('.folha input[type=date]', '2026-12-10'); await pc.click('.folha button:has-text("Salvar")'); await pc.waitForTimeout(1200);
  const aprov = await pc.locator('.os-cab').innerText();
  ok('4.5', nCli === 1 && fotosCli === 2 && semBotoes === 0 && /mapa/i.test(pedeLocal) && /OS 0002/.test(ped) && /Solicitada/.test(ped) && /Aberta/.test(aprov) && /Equipe 2/.test(aprov), `cliente vê ${nCli} ordem com ${fotosCli} fotos, sem botões de coordenação; sem ponto pede "${pedeLocal}"; pedido "${ped.replace(/\s+/g, ' ')}"; aprovado: ${aprov.replace(/\s+/g, ' ').slice(0, 120)}`);

  // 4.7 iniciar e concluir sem internet, sem voltar para a rede no meio
  const TR2 = (await P('login', { u: 'rev', s: 'revisor1' })).token;
  const o3 = (await P('os_salvar', { t: TR2, projeto: 'divinopolis', os: { registro_uuid: uuidArv, tipo: 'Poda de condução', responsavel: 'Equipe 1' } })).ordem;
  await pe.goto(L.WEB + '#ordens'); await pe.reload(); await pe.waitForTimeout(1500);
  await pe.goto(L.WEB + '#os/' + encodeURIComponent(o3.id)); await pe.waitForSelector('text=Iniciar serviço');
  await E.ctx.setOffline(true);
  await pe.locator('[data-foto="foto_antes"] input[type=file]').setInputFiles(A.FOTO); await pe.waitForTimeout(300);
  await pe.click('button:has-text("Iniciar serviço")'); await pe.waitForTimeout(800);
  const temConcluir = await pe.locator('button:has-text("Concluir serviço")').count();
  const fotoAntesVisivel = await pe.locator('.os-foto').count();
  if (temConcluir) { await pe.locator('[data-foto="foto_depois"] input[type=file]').setInputFiles(A.FOTO); await pe.waitForTimeout(300); await pe.click('button:has-text("Concluir serviço")'); await pe.waitForSelector('.folha'); await pe.click('.folha button:has-text("Concluir")'); await pe.waitForTimeout(800); }
  await E.ctx.setOffline(false); await sync(pe); await pe.waitForTimeout(1500);
  const o3s = (await P('os_listar', { t: TR2, projeto: 'divinopolis' })).ordens.find((x) => x.id === o3.id);
  ok('4.7', temConcluir === 1 && fotoAntesVisivel >= 1 && o3s.status === 'Concluída' && o3s.foto_antes && o3s.foto_depois, `sem internet: iniciou e o botão Concluir continuou disponível (${temConcluir}), foto de antes visível (${fotoAntesVisivel}); no servidor: ${o3s.status}`);

  ok('4.6', !errosC.length && !pe.erros.length && !pk.erros.length, `erros de página: ${JSON.stringify([errosC, pe.erros, pk.erros])}`);
  require('fs').writeFileSync('res-bos.json', JSON.stringify(R, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
