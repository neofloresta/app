// 2.8: tela de coleta limpa, começar e encerrar o dia, avisos no sino, Meu dia e dupla fixa escolhida pela coordenação
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis';
(async () => {
  await L.subir(); await L.configurar();
  await L.post('pessoa_salvar', { pessoa: { nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 1', vinculo: 'CLT', projeto: PJ } });
  await L.post('pessoa_salvar', { pessoa: { nome: 'João Lima', funcao: 'Auxiliar', vinculo: 'CLT', projeto: PJ } });
  const b = await chromium.launch();
  // 1. coordenação escolhe a dupla do acesso
  const C = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const q = C.p;
  await L.logar(q, 'admin', L.senha()); await q.waitForTimeout(1000);
  await q.goto(L.WEB + '#admin/usuarios'); await q.waitForSelector('.us-card', { timeout: 20000 });
  const antes = await q.locator('.us-card:has-text("div-1")').innerText();
  await q.locator('.us-card:has-text("div-1") button:has-text("Editar")').click(); await q.waitForSelector('.folha select');
  await q.locator('.folha select:has(option:has-text("Sem avaliador definido"))').selectOption({ label: 'Ana Souza (CRBio 1, CLT)' });
  await q.locator('.folha select:has(option:has-text("Sem auxiliar"))').selectOption({ label: 'João Lima (auxiliar, CLT)' });
  await q.click('.folha button:has-text("Salvar")'); await q.waitForTimeout(1500);
  const depois = await q.locator('.us-card:has-text("div-1")').innerText();
  ok('G.1', /sem avaliador definido/.test(antes) && /Dupla: Ana Souza \+ João Lima/.test(depois), `cartão da equipe antes: "${(antes.match(/sem avaliador[^\n]*/) || [''])[0]}"; depois de escolher: "${(depois.match(/Dupla:[^\n]*/) || [''])[0]}"`);
  // 2. começo do dia: um botão só
  process.env.COM_DIA = '1'; const E = await L.celular(b); const p = E.p; delete process.env.COM_DIA;
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.comecar-dia', { timeout: 20000 }); await p.waitForTimeout(1500);
  const t0 = await p.locator('.bt-principal').innerText(); const pill0 = await p.locator('.pill-dia').count(); const gps = await p.locator('#gps-pill').innerText();
  await p.screenshot({ path: 'b28-1-comecar.png' });
  await p.click('button.comecar-dia'); await p.waitForSelector('button.nova', { timeout: 10000 }); await p.waitForTimeout(400);
  const t1 = await p.locator('.bt-principal').innerText(); const pill1 = await p.locator('.pill-dia').innerText(); const sub = await p.locator('.topo h1 small').innerText();
  ok('G.2', /Começar o dia/.test(t0) && pill0 === 0 && /GPS bom ±4 m/.test(gps) && /Nova árvore/.test(t1) && /Dia desde \d\d:\d\d/.test(pill1) && /Ana \+ João/.test(sub), `antes: "${t0}", GPS "${gps}"; depois de um toque: "${t1.trim()}", etiqueta "${pill1}", topo "${sub}"`);
  await p.reload(); await p.waitForSelector('.bt-principal', { timeout: 20000 }); await p.waitForTimeout(1500); const t2 = await p.locator('.bt-principal').innerText();
  // 3. coleta, devolução e sino
  const f = await A.arvoreCompleta(p, { fotos: 1 }); await p.waitForSelector('.tela-mapa.modo-campo', { timeout: 20000 }); await p.waitForTimeout(3500);
  const l0 = (await L.post('listar', { projeto: PJ })).linhas[0] || {};
  await L.post('validar', { projeto: PJ, itens: [{ uuid: l0.uuid, estado: 'Devolvido', obs: 'Foto sem a árvore inteira' }] });
  await p.evaluate(() => window.__app.sincronizar(true)); await p.waitForTimeout(3000); await p.reload(); await p.waitForSelector('button.nova', { timeout: 20000 }); await p.waitForFunction(() => { const x = document.querySelector('.selo-sino'); return x && !x.classList.contains('oculto'); }, null, { timeout: 20000 }).catch(() => {});
  const selo = await p.locator('.selo-sino').innerText().catch(() => ''); const faixasNoMapa = await p.evaluate(() => [...document.querySelectorAll('.faixa-dev, .faixa-versao, .faixa-turno')].filter((e) => e.offsetParent !== null).length);
  await p.screenshot({ path: 'b28-2-coletando.png' });
  await p.click('.bt-sino'); await p.waitForSelector('.folha:has-text("Avisos")'); const av = await p.locator('.folha').innerText(); await p.screenshot({ path: 'b28-3-avisos.png' });
  await p.click('.folha button:has-text("Fechar")'); await p.waitForTimeout(300);
  ok('G.3', /Nova árvore/.test(t2) && f.length === 0 && l0.avaliador === 'Ana Souza' && +selo >= 1 && faixasNoMapa === 0 && /devolvid/i.test(av), `depois de reabrir o app o dia continua aberto ("${t2.trim()}"); árvore gravada com ${l0.avaliador} + ${l0.auxiliar}; devolução aparece só no sino (${selo}) e nada em cima do mapa (${faixasNoMapa}): "${av.replace(/\s+/g, ' ').slice(0, 90)}"`);
  // 4. Meu dia
  await p.goto(L.WEB + '#meudia'); await p.waitForSelector('.dia-num', { timeout: 10000 }); await p.waitForTimeout(2500); const md = await p.locator('main').innerText(); await p.screenshot({ path: 'b28-4-meudia.png' });
  ok('G.4', /1\s*de 90 árvores/.test(md) && /1\s*devolvidas/.test(md) && /Encerrar o dia/.test(md), `Meu dia: ${md.replace(/\s+/g, ' ').slice(0, 170)}`);
  // 5. encerrar o dia: confirma e volta para "Começar o dia", sem perder nada
  await p.goto(L.WEB + '#mapa'); await p.waitForSelector('.pill-dia', { timeout: 20000 }); await p.click('.pill-dia'); await p.waitForSelector('.folha:has-text("Encerrar o dia")'); const txt = await p.locator('.folha').innerText();
  await p.click('.folha button:has-text("Cancelar")'); await p.waitForTimeout(300); const ainda = await p.locator('button.nova').count();
  await p.click('.pill-dia'); await p.click('.folha button:has-text("Encerrar o dia")'); await p.waitForSelector('button.comecar-dia', { timeout: 10000 }); await p.waitForTimeout(500);
  const nReg = await p.evaluate(async () => (await window.__app.Store.registros('divinopolis')).length); const pill2 = await p.locator('.pill-dia').count();
  ok('G.5', /envia o que falta/.test(txt) && ainda === 1 && pill2 === 0 && nReg === 1, `confirmação: "${txt.replace(/\s+/g, ' ').slice(0, 100)}"; Cancelar mantém o dia; encerrado volta "Começar o dia" e os registros continuam no aparelho (${nReg})`);
  // 6. consultar o mapa completo continua a um toque
  await p.goto(L.WEB + '#consulta'); await p.waitForSelector('.chip-rapido', { timeout: 20000 }); const chips = await p.locator('.chip-rapido').allInnerTexts(); const semBt = await p.locator('.bt-principal').count();
  ok('G.6', chips.includes('Hoje') && semBt === 0, `"Consultar o mapa" traz busca e filtros (${chips.join(', ')}) sem o botão de coleta`);
  const erros = [...p.erros, ...q.erros]; ok('G.7', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b28.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
