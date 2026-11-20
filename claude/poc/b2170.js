// 2.17, bloco de campo: câmera por dentro do app, galeria só nas fotos da árvore, "Concluir" que responde na hora e copa por árvore no time da casa
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis';
const abrirCam = async (p, campo) => { await A.campo(p, campo).locator('button.tile').click(); await p.waitForTimeout(300); if (await p.locator('.folha button:has-text("Só foto")').count()) { await p.click('.folha button:has-text("Só foto")'); } await p.waitForSelector('.cam-app', { timeout: 8000 }); };
(async () => {
  await L.subir(); await L.configurar();
  await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } }); await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const nova = async (pe) => (await L.post('pessoa_salvar', { pessoa: Object.assign({ projeto: PJ }, pe) })).id;
  const ana = await nova({ nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 1', vinculo: 'CLT', time: 'Neofloresta' }); const bia = await nova({ nome: 'Bia Gap', funcao: 'Avaliador', registro: 'CRBio 2', vinculo: 'Parceiro', time: 'Gap' });
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', perfil: 'coletor', avaliador_id: ana } }); await L.post('usuario_salvar', { usuario_dados: { login: 'div-2', perfil: 'coletor', avaliador_id: bia } });
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const { p } = await L.celular(b, { permissions: ['geolocation', 'camera'] });
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova', { timeout: 20000 }); await p.waitForTimeout(1200);
  // 1. foto geral: a câmera abre dentro do app, com galeria e câmera do celular na mesma tela; a foto entra no cadastro
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(300); await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Árvore');
  await abrirCam(p, 'Foto 1'); const temGal = await p.locator('.cam-app .cam-gal').count(); const temSis = await p.locator('.cam-app button:has-text("Câmera do celular")').count();
  await p.waitForSelector('.cam-app .cam-disparo:not([disabled])', { timeout: 10000 }); await p.screenshot({ path: __dirname + '/b2170-camera.png' }); await p.click('.cam-app .cam-disparo'); await p.waitForSelector('.cam-app', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(600);
  const f1 = await p.evaluate(async () => { const r = window.__app.S.reg; const f = r.fotos['Foto 1']; if (!f) return null; const bl = await window.__app.Store.foto(f.chave); const bmp = await createImageBitmap(bl); return { tipo: bl.type, bytes: bl.size, w: bmp.width, h: bmp.height, fonte: (r.sensores['Foto 1'] || {}).fonte, nome: f.nome }; });
  const semTrilha = await p.evaluate(() => !document.querySelector('.cam-app') && !document.querySelector('video'));
  ok('C.1', temGal === 1 && temSis === 1 && f1 && f1.tipo === 'image/jpeg' && f1.bytes > 1000 && f1.w >= 320 && f1.fonte === 'app' && semTrilha, `galeria na tela: ${temGal}; câmera do celular: ${temSis}; foto ${f1 ? `${f1.w}x${f1.h}, ${f1.bytes} bytes, ${f1.tipo}, fonte "${f1.fonte}"` : 'não entrou'}`);
  // 2. trocar a foto pela galeria continua possível (botão na tela da foto já tirada); o X fecha a câmera sem mexer na foto
  await A.campo(p, 'Foto 1').locator('button.tile').click(); await p.waitForTimeout(300); const opsFoto = (await p.locator('.folha button').allInnerTexts()).map((t) => t.trim()); await p.click('.folha button:has-text("Tirar outra")'); await p.waitForSelector('.cam-app'); await p.click('.cam-app .cam-x'); await p.waitForSelector('.cam-app', { state: 'detached' });
  const mesma = await p.evaluate((n) => window.__app.S.reg.fotos['Foto 1'].nome === n, f1 && f1.nome);
  ok('C.2', opsFoto.includes('Galeria') && mesma, `opções da foto tirada: ${opsFoto.join(', ')}; fechar a câmera manteve a foto: ${mesma}`);
  // 3. sem câmera no navegador (permissão negada): aviso e botão da câmera do celular, sem travar
  await p.evaluate(() => { navigator.mediaDevices.__gum = navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('negado')); });
  await A.sit(p, 'Viva'); await A.abaLivre(p, 'Fotos e observações'); await abrirCam(p, 'Foto 2'); await p.waitForTimeout(400); const msg = (await p.locator('.cam-app .cam-msg').innerText()).trim(); const travado = await p.locator('.cam-app .cam-disparo[disabled]').count();
  // a câmera do celular entra pelo mesmo campo de arquivo de sempre
  await p.click('.cam-app .cam-x'); await A.foto(p, 'Foto 2'); const f2 = await p.evaluate(() => (window.__app.S.reg.sensores['Foto 2'] || {}).fonte);
  await p.evaluate(() => { navigator.mediaDevices.getUserMedia = navigator.mediaDevices.__gum; });
  ok('C.3', /Câmera do celular/.test(msg) && travado === 1 && f2 === 'camera', `aviso: "${msg}"; disparo travado: ${travado}; foto pela câmera do celular: fonte "${f2}"`);
  // 4. copa no time da casa: "2 raios" e "Área" sempre à vista; a escolha vale para a árvore e vira o padrão da próxima
  await A.abaLivre(p, 'Indivíduo'); const modo0 = await p.locator('.copa-modo').getAttribute('data-copa-modo'); const area0 = await A.campo(p, 'Area de copa medida (m2)').count();
  await p.click('.copa-modo .op[data-modo="raios2"]'); await p.waitForTimeout(250); const raios = [1, 2, 3, 4].map((k) => `Raio de copa ${k} (m)`); const vis = []; for (const n of raios) vis.push(await A.campo(p, n).count()); const area1 = await A.campo(p, 'Area de copa medida (m2)').count(); const sel1 = await p.locator('.copa-modo .op.sel').innerText(); await p.locator('.copa-modo').scrollIntoViewIfNeeded(); await p.screenshot({ path: __dirname + '/b2170-copa.png' });
  await p.click('.copa-modo .op[data-modo="area"]'); await p.waitForTimeout(250); const area2 = await A.campo(p, 'Area de copa medida (m2)').count(); await p.click('.copa-modo .op[data-modo="raios2"]'); await p.waitForTimeout(250);
  ok('C.4', modo0 === 'area' && area0 === 1 && vis.join('') === '1100' && area1 === 0 && sel1.trim() === '2 raios' && area2 === 1, `árvore nova no time da casa: ${modo0}; depois de "2 raios": raios ${vis.join('')}, área ${area1}, marcado "${sel1.trim()}"; de volta em "Área": ${area2}`);
  await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova'); await p.waitForTimeout(400);
  // 5. cadastro completo com 2 raios; "Concluir" tocado duas vezes grava uma vez só e mostra "Salvando..."
  await p.evaluate(() => { window.__salv = 0; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('salvando-cad')) window.__salv++; }).observe(document.body, { childList: true }); });
  await A.arvoreCompleta(p, { semConcluir: true }); const modoNovo = await p.evaluate(() => window.__app.S.reg.valores['Modo de copa']);
  // servidor levando 3 s por consulta e a conferência dos setores vencida: o Concluir não pode esperar por ele
  await p.evaluate(() => { window.__app.S.stEm = null; window.__app.S.stSitEm = null; }); await fetch(L.MOCK + '__latencia', { method: 'POST', body: JSON.stringify({ ms: 3000 }) });
  await p.click('.prog-topo'); await p.waitForTimeout(200); const tC = Date.now(); await p.evaluate(() => { const bt = [...document.querySelectorAll('.folha button')].find((x) => /Concluir registro/.test(x.textContent)); bt.click(); bt.click(); bt.click(); });
  await p.waitForTimeout(300); if (await p.locator('.folha >> text=Sim, nenhum').count()) await p.click('.folha button:has-text("Sim, nenhum")');
  if (!(await p.locator('.folha >> text=Sim, nenhum').count())) await p.waitForTimeout(200); await p.waitForSelector('button.nova', { timeout: 15000 }); const msC = Date.now() - tC; await fetch(L.MOCK + '__latencia', { method: 'POST', body: JSON.stringify({ ms: 0 }) }); await p.waitForTimeout(6000);
  const rs = (await p.evaluate(async () => window.__app.Store.todosRegistros())).filter((x) => x.status !== 'rascunho'); const v = (rs[0] || {}).valores || {}; const salv = await p.evaluate(() => window.__salv); const sobra = await p.locator('.salvando-cad').count();
  const noServ = (await L.post('listar', { projeto: PJ })).registros || []; const nServ = Array.isArray(noServ) ? noServ.length : -1;
  ok('C.5', msC < 2000 && modoNovo === 'raios2' && rs.length === 1 && salv === 1 && sobra === 0 && v['Modo de copa'] === 'raios2' && v['Raio de copa 1 (m)'] > 0 && v['Area de copa (m2)'] > 0 && (v['Area de copa medida (m2)'] == null || v['Area de copa medida (m2)'] === ''), `com o servidor a 3 s por consulta, do toque em Concluir até a tela inicial: ${msC} ms; árvore nova veio em "${modoNovo}" (último jeito usado); gravados no aparelho: ${rs.length}; aviso "Salvando..." apareceu ${salv} vez(es) e sumiu (${sobra}); raio 1 ${v['Raio de copa 1 (m)']}, área calculada ${v['Area de copa (m2)']}, área medida "${v['Area de copa medida (m2)']}"; no servidor: ${nServ}`);
  // 6. calçada sem árvores: câmera do app sem galeria
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(300); await A.op(p, 'Local do registro', 'Via pública'); const cats = (await A.campo(p, 'Categoria').locator('.op').allInnerTexts()).map((t) => t.trim());
  const calc = cats.find((t) => /sem árvore/i.test(t)); let galCalc = -1, opsCalc = [];
  if (calc) { await A.campo(p, 'Categoria').locator('.op', { hasText: /sem árvore/i }).click(); await p.waitForTimeout(250); await A.campo(p, 'Foto 1').locator('button.tile').click(); await p.waitForSelector('.cam-app'); galCalc = await p.locator('.cam-app .cam-gal').count(); await p.waitForSelector('.cam-app .cam-disparo:not([disabled])'); await p.click('.cam-app .cam-disparo'); await p.waitForSelector('.cam-app', { state: 'detached' }); await p.waitForTimeout(500); await A.campo(p, 'Foto 1').locator('button.tile').click(); await p.waitForTimeout(300); opsCalc = (await p.locator('.folha button').allInnerTexts()).map((t) => t.trim()); await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.veu').forEach((x) => x.remove())); }
  ok('C.6', calc && galCalc === 0 && !opsCalc.includes('Galeria') && opsCalc.includes('Tirar outra'), `categoria "${calc}"; galeria na câmera: ${galCalc}; opções da foto: ${opsCalc.join(', ')}`);
  await A.excluir(p).catch(() => {});
  // 7. time parceiro: sem escolha de copa (segue com 2 raios)
  const E2 = await L.celular(b, { permissions: ['geolocation', 'camera'] }); const p2 = E2.p; await L.logar(p2, 'div-2', 'equipe02'); await p2.waitForSelector('button.nova', { timeout: 20000 }); await p2.waitForTimeout(1200);
  await p2.click('button.nova'); await p2.waitForSelector('.prog', { timeout: 20000 }).catch(() => {}); let parc = 'cadastro não abriu';
  if (await p2.locator('.prog').count()) { await A.op(p2, 'Local do registro', 'Via pública'); await A.op(p2, 'Categoria', 'Árvore'); await A.sit(p2, 'Viva'); const tem = await p2.locator('.copa-modo').count(); const r1 = await A.campo(p2, 'Raio de copa 1 (m)').count(); const r3 = await A.campo(p2, 'Raio de copa 3 (m)').count(); parc = `escolha na tela: ${tem}; raio 1: ${r1}; raio 3: ${r3}`; ok('C.7', tem === 0 && r1 === 1 && r3 === 0, parc); } else ok('C.7', false, parc);
  ok('C.8', !p.erros.length && !p2.erros.length, p.erros.concat(p2.erros).join(' | ') || 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
