// 2.7: cancelar registro, descrição do risco à vista
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const regs = (p) => p.evaluate(async () => Store.todosRegistros());
(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova, .mapa-mais', { timeout: 20000 }); await p.waitForTimeout(800);
  const abrirNova = async () => { await p.click('button.nova, .mapa-mais'); await p.waitForSelector('.prog', { timeout: 40000 }); };
  // 1. cancelar registro novo
  await abrirNova(); await A.op(p, 'Categoria', 'Árvore'); await A.foto(p, 'Foto 1');
  const temBt = await p.locator('.topo .bt-cancelar').count();
  await p.click('.topo .bt-cancelar'); await p.waitForTimeout(200); const txt = await p.locator('.folha').innerText();
  await p.click('.folha button:has-text("Continuar preenchendo")'); await p.waitForTimeout(200); const aindaForm = await p.locator('.prog').count();
  await p.click('.topo .bt-cancelar'); await p.click('.folha button:has-text("Cancelar registro")'); await p.waitForTimeout(800);
  const rs = await regs(p); const fotos = await p.evaluate(async () => (await window.__app.Store.todasFotos ? (await window.__app.Store.todasFotos()).length : -1)).catch(() => -1);
  ok('C.1', temBt === 1 && /serão apagados/.test(txt) && /a foto/.test(txt) && aindaForm === 1 && rs.length === 0, `botão Cancelar no topo (${temBt}); aviso "${txt.replace(/\s+/g, ' ').slice(0, 90)}..."; "Continuar preenchendo" mantém o cadastro; depois de cancelar sobram ${rs.length} registros`);
  // 2. risco com a descrição embaixo de cada opção
  await abrirNova(); await A.op(p, 'Categoria', 'Árvore'); await A.abaLivre(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva'); await p.evaluate(() => { window.__app.S.reg.mexido = false; }); await A.abaLivre(p, 'Risco');
  const desc = await p.evaluate(() => [...document.querySelectorAll('[data-campo="Probabilidade de falha"] .op')].map((b) => ({ t: b.textContent, small: !!b.querySelector('small'), vis: b.querySelector('small') ? getComputedStyle(b.querySelector('small')).display !== 'none' : false })));
  await p.screenshot({ path: 'b27-risco.png', fullPage: true });
  ok('C.2', desc.length >= 4 && desc.every((d) => d.small && d.vis), `Probabilidade de falha: ${desc.length} opções, todas com a descrição visível sem tocar (${desc.map((d) => d.t.slice(0, 30)).join(' | ')})`);
  const erros = p.erros; ok('C.9', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b27.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
