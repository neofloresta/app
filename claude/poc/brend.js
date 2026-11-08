// Rendimento por equipe no painel e filtro de dia no mapa
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
(async () => {
  await L.subir(); await L.configurar(); await L.semear(300);
  const b = await chromium.launch(); const { p } = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(p, 'admin', L.senha()); await p.waitForTimeout(1000);
  await p.goto(L.WEB + '#painel'); await p.waitForSelector('text=Rendimento por equipe', { timeout: 20000 });
  const tab = await p.locator('.cartao:has-text("Rendimento por equipe") table').innerText();
  await p.screenshot({ path: 'rend-painel.png', fullPage: true });
  await p.locator('.cartao:has-text("Rendimento por equipe") tr:has-text("Equipe 1") button:has-text("Todos")').click();
  await p.waitForFunction(() => document.querySelector('.mapa-conta') && /de \d/.test(document.querySelector('.mapa-conta').textContent) && !/Carregando/.test(document.querySelector('.mapa-conta').textContent), null, { timeout: 20000 }); await p.waitForTimeout(800);
  const conta1 = await p.locator('.mapa-conta').innerText(); const eqSel = await p.locator('.mapa-sel select').first().inputValue();
  await p.selectOption('select:has(option:text("Últimos 7 dias"))', '7'); await p.waitForTimeout(500); const conta7 = await p.locator('.mapa-conta').innerText();
  const n1 = +conta1.split(' de ')[0].replace(/\D/g, ''), tot = +conta1.split(' de ')[1].replace(/\D.*$/, '').replace(/\D/g, ''); const n7 = +conta7.split(' de ')[0].replace(/\D/g, '');
  ok('R.1', /Equipe 1/.test(tab) && /média por dia/i.test(tab) && eqSel === 'Equipe 1' && n1 > 0 && n1 < tot && n7 <= n1, `tabela: ${tab.split('\n').slice(0, 3).join(' | ').slice(0, 200)}; mapa filtrado na Equipe 1: ${conta1}; últimos 7 dias: ${conta7}`);
  ok('R.2', !p.erros.length, 'erros: ' + JSON.stringify(p.erros));
  fs.writeFileSync('res-brend.json', JSON.stringify(R, null, 1)); await b.close(); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
