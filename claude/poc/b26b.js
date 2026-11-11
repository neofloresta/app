// 2.6: termo por perfil, sem rastro de onde os dados ficam, com novo aceite quando muda; ajuda com busca e "?" nas telas
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PROIBIDO = /google|drive|planilha|servidor(es)? fora|controlador|operador|art\. ?\d|artigo|apps script/i;
(async () => {
  await L.subir(); await L.configurar();
  await L.post('usuario_salvar', { usuario_dados: { login: 'cli-1', senha: 'cliente01', nome: 'Prefeitura', perfil: 'cliente', projeto: 'divinopolis' } });
  await L.post('aceitar_termo', { versao: '2026-11' }, 'cli-1', 'cliente01');
  await L.post('aceitar_termo', { versao: '2026-11' }, 'div-1', 'equipe01'); // versão antiga: o app deve pedir o novo aceite
  const b = await chromium.launch(); const { p } = await L.celular(b);
  // 1. ajuda antes de entrar
  await p.goto(L.WEB + '?config=1'); await p.waitForTimeout(400);
  if (await p.locator('text=Configurar servidor').count()) { await p.click('text=Configurar servidor'); await p.fill('.folha input', L.MOCK); await p.click('.folha >> text=Salvar'); await p.waitForTimeout(300); }
  const linkAj = await p.locator('a.link-ajuda').count(); await p.click('a.link-ajuda'); await p.waitForSelector('.ajuda-lista', { timeout: 10000 });
  const passos = await p.locator('.ajuda-passos[open]').innerText().catch(() => '');
  ok('A.1', linkAj === 1 && /Instale o app/.test(passos) && /iPhone/.test(passos), `link "Ajuda" no login (${linkAj}); primeiros passos abertos: ${passos.split('\n').slice(1, 3).join(' / ')}`);
  // busca sem acento
  await p.fill('.busca-ajuda', 'localizacao negada'); await p.waitForTimeout(200); const achou = await p.locator('.ajuda-q').allInnerTexts();
  ok('A.2', achou.length >= 1 && achou.some((t) => /Neguei a localização/.test(t)), `busca "localizacao negada" (sem acento): ${achou.map((t) => t.split('\n')[0]).join(' / ')}`);
  await p.fill('.busca-ajuda', 'xyzw'); await p.waitForTimeout(200); const nada = await p.locator('.ajuda-lista .info').innerText().catch(() => '');
  ok('A.3', /Nada encontrado/.test(nada), `busca sem resultado: "${nada}"`);
  await p.click('.topo .ic[aria-label="Voltar"]'); await p.waitForSelector('input[placeholder=Usuário]', { timeout: 10000 });

  // 2. coletor com termo de versão antiga: pede de novo, texto da equipe, sem rastro de armazenamento
  await p.fill('input[placeholder=Usuário]', 'div-1'); await p.fill('input[placeholder=Senha]', 'equipe01'); await p.click('text=Entrar');
  await p.waitForSelector('button:has-text("Li e aceito")', { timeout: 15000 }); const tTermo = await p.locator('main').innerText(); const sub = await p.locator('.topo small').innerText();
  const completo = await p.evaluate(() => document.querySelector('.termo-completo').textContent);
  ok('A.4', /mudou/.test(sub) && /Encerrar o dia/.test(tTermo) && /Quem vê\?/.test(tTermo) && !PROIBIDO.test(tTermo + completo), `termo antigo pede novo aceite ("${sub}"); fala de trajeto e de quem vê; menção a Google/Drive/planilha/controlador/artigo: ${(tTermo + completo).match(PROIBIDO) || 'nenhuma'}`);
  await p.click('button:has-text("Li e aceito")'); await p.waitForSelector('button.nova', { timeout: 15000 });
  const srv = (await L.post('usuarios_listar', {}).catch(() => ({ usuarios: [] }))).usuarios || [];
  const u1 = srv.find((u) => u.login === 'div-1') || {};
  await p.reload(); await p.waitForTimeout(1500); const deNovo = await p.locator('button:has-text("Li e aceito")').count();
  ok('A.5', deNovo === 0 && u1.termo_versao === require('fs').readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/)[1] && await p.locator('button.nova').count() === 1, `depois de aceitar, reabrir o app não pede de novo (${deNovo}); servidor guardou a versão "${u1.termo_versao}"`);
  // 3. "?" da tela inicial e ajuda do cadastro
  await p.click('.topo .ic[aria-label="Ajuda"]'); await p.waitForSelector('.ajuda-lista'); const abasAj = await p.locator('.subaba').count(); const temas = await p.locator('.ajuda-tema h3').allInnerTexts();
  ok('A.6', abasAj === 0 && temas.includes('GPS') && temas.includes('Faces de quadra') && !temas.includes('Validação'), `"?" da tela inicial abre a ajuda da equipe (abas ${abasAj}): ${temas.join(', ')}`);
  await p.goto(L.WEB + '#inicio'); await p.waitForSelector('button.nova'); await p.click('button.nova'); await p.waitForSelector('.prog', { timeout: 30000 });
  await p.click('.prog-topo'); await p.click('.folha .link-ajuda-form'); await p.waitForSelector('.ajuda-lista'); await p.waitForTimeout(300);
  const visivel = await p.evaluate(() => { const s = [...document.querySelectorAll('.ajuda-tema')].find((x) => /Cadastro/.test(x.querySelector('h3').textContent)); if (!s) return null; const r = s.getBoundingClientRect(); return Math.round(r.top); });
  ok('A.7', visivel != null && visivel < 300, `"Ajuda do cadastro" no menu de etapas leva ao tema Cadastro (topo a ${visivel} px)`);
  await p.goBack(); await p.waitForSelector('.prog', { timeout: 15000 }); const voltou = await p.locator('.prog').count();
  ok('A.8', voltou === 1, 'voltar da ajuda retorna ao cadastro que estava aberto');
  // 4. sobre: termo completo
  await p.goto(L.WEB + '#sobre'); await p.waitForTimeout(600); const sobre = await p.locator('main').innerText();
  ok('A.9', /Mudanças/.test(sobre) && /Aceito em/.test(sobre) && !PROIBIDO.test(sobre.replace(/Google Earth/g, '')), `tela Sobre traz o texto completo e a data do aceite; menção proibida: ${sobre.match(PROIBIDO) || 'nenhuma'}`);

  // 5. cliente: termo próprio
  const c2 = await L.celular(b); const q = c2.p; await q.goto(L.WEB + '?config=1'); await q.waitForTimeout(300);
  if (await q.locator('text=Configurar servidor').count()) { await q.click('text=Configurar servidor'); await q.fill('.folha input', L.MOCK); await q.click('.folha >> text=Salvar'); await q.waitForTimeout(300); }
  await q.fill('input[placeholder=Usuário]', 'cli-1'); await q.fill('input[placeholder=Senha]', 'cliente01'); await q.click('text=Entrar');
  await q.waitForSelector('button:has-text("Li e aceito")', { timeout: 15000 }); const tc = await q.locator('main').innerText();
  ok('A.10', /De quem são os dados do inventário\?/.test(tc) && !/Encerrar o dia|posição do celular/.test(tc) && !PROIBIDO.test(tc), 'termo do cliente fala dos dados do inventário, sem trajeto nem GPS de equipe, sem menção a onde ficam guardados');
  await q.click('button:has-text("Li e aceito")'); await q.waitForSelector('.painel', { timeout: 20000 });
  await q.goto(L.WEB + '#ajuda'); await q.waitForSelector('.ajuda-lista'); const tq = await q.locator('.ajuda-tema h3').allInnerTexts();
  ok('A.11', !tq.includes('GPS') && tq.includes('Pedidos de serviço'), `ajuda do cliente: ${tq.join(', ')}`);
  await q.screenshot({ path: 'b26b-ajuda-cliente.png', fullPage: true });
  const erros = [...p.erros, ...q.erros]; ok('A.12', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b26b.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
