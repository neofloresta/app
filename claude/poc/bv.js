// Bloco V: versão do app e atualização sem perder dados
const { chromium } = require('playwright');
const fs = require('fs');
const L = require('./lib'); const A = require('./acoes');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const regs = async (p) => p.evaluate(async () => (await Store.todosRegistros()));
const VJ = JSON.parse(fs.readFileSync(L.APP + '/version.json', 'utf8'));

(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch();
  const { p } = await L.celular(b);
  const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('text=Nova árvore', { timeout: 8000 });
  await p.waitForTimeout(1200);

  // V.1 versão do aparelho igual à publicada; sem aviso
  const vApp = await p.evaluate(() => (typeof VERSAO_APP !== 'undefined' ? VERSAO_APP : null));
  const avisoAntes = await p.locator('#aviso-versao:not(:empty)').count();
  await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Categoria', 'Árvore');
  await p.goBack(); await p.waitForTimeout(800);
  const rascAntes = (await regs(p)).length;
  // texto da versão na tela Sobre
  await p.goto(L.WEB + '#sobre'); await p.waitForTimeout(800);
  const sobre = await p.locator('body').innerText();
  ok('V.1', sobre.includes(VJ.versao) && avisoAntes === 0, `tela Sobre mostra a versão ${VJ.versao}=${sobre.includes(VJ.versao)}; sem aviso quando está em dia=${avisoAntes === 0}`);

  // V.2 nova versão publicada: aviso aparece na tela inicial
  const nova = { versao: '9.9.9', data: '2026-12-01', notas: ['Teste de aviso'] };
  const ORIG = fs.readFileSync(L.APP + '/version.json', 'utf8');
  const restaurar = () => fs.writeFileSync(L.APP + '/version.json', ORIG);
  process.on('exit', restaurar);
  fs.writeFileSync(L.APP + '/version.json', JSON.stringify(nova));
  await p.goto(L.WEB + '#inicio'); await p.reload(); await p.waitForTimeout(2000);
  const aviso = await p.locator('#aviso-versao').evaluate((e) => e.textContent).catch(() => '');
  await p.screenshot({ path: 'aviso-versao.png' });
  ok('V.2', aviso.includes('9.9.9'), `aviso: "${aviso.replace(/\s+/g, ' ').slice(0, 140)}"`);

  // V.3 botão atualiza, rascunho e fila continuam no aparelho
  restaurar();
  await Promise.all([p.waitForEvent('load', { timeout: 15000 }).catch(() => null), (async () => { if (await p.locator('.bt-sino').count()) await p.click('.bt-sino'); await p.locator('#aviso-versao button').first().click(); })()]);
  await p.waitForTimeout(2500);
  const rascDepois = (await regs(p)).length;
  const logado = await p.locator('text=Nova árvore').count();
  ok('V.3', rascDepois === rascAntes && rascAntes > 0 && logado > 0, `registros no aparelho antes=${rascAntes} depois=${rascDepois}; continua logado=${logado > 0}`);

  ok('V.4', erros.length === 0, `erros de página: ${JSON.stringify(erros)}`);
  fs.writeFileSync('res-bv.json', JSON.stringify(R, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
