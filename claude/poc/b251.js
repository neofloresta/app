// 2.5.1: espécie digitada letra por letra, mapa sem internet, ficha do mapa sem toque fantasma, satélite sem "not available"
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
(async () => {
  await L.subir(); await L.configurar(); await L.semear(300);
  const b = await chromium.launch(); const E = await L.celular(b, { viewport: { width: 360, height: 640 } }); const p = E.p;
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(800);
  // 1. espécie letra por letra
  await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Categoria', 'Árvore'); await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva');
  const inp = A.campo(p, 'Especie').locator('input').first(); await inp.click(); await inp.pressSequentially('hand', { delay: 120 });
  const st = await p.evaluate(() => { const i = document.querySelector('[data-campo="Especie"] input'); return { v: i.value, foco: document.activeElement === i, sug: document.querySelectorAll('[data-campo="Especie"] .esp-lista button').length, aberta: !document.querySelector('[data-campo="Especie"] .esp-lista').classList.contains('oculto') }; });
  await p.screenshot({ path: 'b251-especie.png' });
  ok('U.1', st.v === 'hand' && st.foco && st.sug > 0 && st.aberta, `digitando "hand" letra por letra: campo "${st.v}", teclado aberto=${st.foco}, ${st.sug} sugestões na lista`);
  await p.locator('[data-campo="Especie"] .esp-lista button').first().click(); await p.waitForTimeout(200);
  const esc = await inp.inputValue();
  await inp.fill(''); await inp.pressSequentially('Não identificada', { delay: 40 }); await p.waitForTimeout(400);
  const fotosId = await p.locator('[data-campo^="Foto folha"], [data-campo="Foto ramo filotaxia"], [data-campo="Foto tronco detalhe"]').count();
  ok('U.2', /^Handroanthus/.test(esc) && fotosId === 4, `escolheu "${esc}"; "Não identificada" ainda mostra as ${fotosId} fotos de identificação`);
  await A.excluir(p).catch(() => {});
  // 2. mapa sem internet mostra os pontos guardados
  await p.goto(L.WEB + '#mapa'); await p.waitForFunction(() => /\d+ de \d+ pontos/.test((document.querySelector('.mapa-conta') || {}).textContent || '') && !/atualizando|Carregando pontos/.test(document.querySelector('.mapa-conta').textContent), null, { timeout: 30000 });
  const online = await p.locator('.mapa-conta').innerText();
  const opc = await p.evaluate(() => { const m = window.__app.mapa; let nat = []; m.eachLayer((l) => { if (l.options && l.options.maxNativeZoom) nat.push(l._url.includes('World_Imagery') ? 'sat:' + l.options.maxNativeZoom : 'ruas:' + l.options.maxNativeZoom); }); return { fade: m.options.fadeAnimation, nat }; });
  await E.ctx.setOffline(true); await p.evaluate(() => { location.hash = '#inicio'; }); await p.waitForSelector('button.nova'); await p.evaluate(() => { location.hash = '#mapa'; });
  await p.waitForSelector('.faixa-off:not(.oculto)', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800);
  const off = await p.locator('.mapa-conta').innerText(); const faixa = await p.locator('.faixa-off').innerText().catch(() => '');
  await p.screenshot({ path: 'b251-mapa-offline.png' });
  const nOn = +((online.match(/de ([\d.]+) pontos/) || [])[1] || '0').replace('.', ''), nOff = +((off.match(/de ([\d.]+) pontos/) || [])[1] || '0').replace('.', '');
  ok('U.3', nOn >= 300 && nOff === nOn && /Sem internet/.test(faixa), `com internet ${nOn} pontos; sem internet ${nOff} pontos e o aviso "${faixa}"`);
  await E.ctx.setOffline(false);
  ok('U.4', opc.fade === false, `ficha do mapa sem animação de sumir (sem toque fantasma): fadeAnimation=${opc.fade}`);
  const sat = await p.evaluate(() => { const ls = []; document.querySelectorAll('.leaflet-control-layers-base label').forEach((x) => ls.push(x.textContent.trim())); return ls; });
  ok('U.5', sat.length >= 2, `camadas de fundo disponíveis: ${sat.join(', ')}`);
  const fonte = fs.readFileSync(L.APP + '/js/app.js', 'utf8'); const satNat = /World_Imagery[^;]*maxNativeZoom: 18/.test(fonte);
  ok('U.6', satNat, 'satélite com zoom nativo até 18: acima disso amplia a imagem em vez de mostrar "not available"');
  const erros = p.erros; ok('U.7', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b251.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
