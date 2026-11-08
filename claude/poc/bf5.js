// Formulário de Divinópolis 5: o que aparece e o que é obrigatório em cada categoria
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const regs = (p) => p.evaluate(async () => Store.todosRegistros());
const etapas = (p) => p.evaluate(() => [...document.querySelectorAll('.prog .aba, .prog [data-aba], .prog button')].map((b) => b.textContent.trim()).filter(Boolean));
const visiveis = async (p) => { const out = []; for (const a of ['Identificação', 'Indivíduo', 'Meio', 'Podas e danos', 'Fitossanidade e risco', 'Manejo', 'Fotos e observações']) { await p.click('.prog-topo'); await p.waitForTimeout(150); const it = p.locator(`.folha .menu-it:has-text("${a}")`); if (!(await it.count())) { await p.evaluate(() => document.querySelectorAll('.veu').forEach((v) => v.remove())); continue; } await it.first().click(); await p.waitForTimeout(150); out.push(...(await p.evaluate(() => [...document.querySelectorAll('main [data-campo], main [data-grupo]')].map((e) => e.dataset.campo || 'grupo:' + e.dataset.grupo)))); } return [...new Set(out)]; };
(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);
  // 1. árvore viva completa (manejo sem marcar: pede confirmação do "Nenhum")
  let f = await A.arvoreCompleta(p, { manejoNenhum: false }); let rs = await regs(p); let r = rs.find((x) => x.status !== 'rascunho');
  ok('F.1', f.length === 0 && r && r.valores['Manejo nenhum'] === true && r.valores.Risco === 'Baixo' && r.valores['Area de copa (m2)'] > 0, `concluiu; manejo vazio virou "Nenhum" depois da confirmação; risco calculado ${r && r.valores.Risco}; área de copa ${r && r.valores['Area de copa (m2)']}`);
  // 2. risco severo pela matriz
  await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Categoria', 'Árvore'); await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva'); await A.aba(p, 'Fitossanidade e risco');
  await A.op(p, 'Probabilidade de falha', 'Iminente'); await A.op(p, 'Probabilidade de impacto', 'Alto'); await A.op(p, 'Consequencias', 'Severa'); await p.waitForTimeout(300);
  const risco = await A.campo(p, 'Risco').innerText();
  ok('F.2', /Severo/.test(risco), `iminente + alto + severa = "${risco.replace(/\s+/g, ' ')}"`);
  // 3. espécie não identificada pede as 4 fotos
  await A.aba(p, 'Indivíduo'); await A.campo(p, 'Especie').locator('input').first().fill('Não identificada'); await p.waitForTimeout(300);
  const fotosId = await p.locator('[data-campo^="Foto folha"], [data-campo="Foto ramo filotaxia"], [data-campo="Foto tronco detalhe"]').count();
  await A.concluir(p); f = await A.faltas(p);
  ok('F.3', fotosId === 4 && ['face de cima', 'face de baixo', 'filotaxia', 'tronco'].every((t) => f.some((x) => x.toLowerCase().includes(t))), `${fotosId} fotos de identificação aparecem e são cobradas: ${f.filter((x) => /Foto/.test(x)).join(', ')}`);
  // 4. morta: só ponto e foto geral
  await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Morta'); await p.waitForTimeout(600); if (await p.locator('.folha button:has-text("Trocar")').count()) await p.click('.folha button:has-text("Trocar")'); await p.waitForTimeout(400);
  const visM = await visiveis(p);
  await A.aba(p, 'Identificação'); await A.op(p, 'Local do registro', 'Via pública'); await A.foto(p, 'Foto 1'); await A.concluir(p); f = await A.faltas(p);
  if (await p.locator('.folha >> text=Salvar sem GPS').count()) await p.click('.folha >> text=Salvar sem GPS');
  ok('F.4', f.length === 0 && !visM.some((x) => /Especie|CAP|Altura|Raio|grupo:Fiação|Risco|Manejo|Observacoes|Foto 2/.test(x)), `morta: campos que aparecem: ${visM.join(', ')}`);
  // 5. calçada sem árvores: largura e foto
  await p.waitForSelector('button.nova'); await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Calçada'); await p.waitForTimeout(600);
  if (await p.locator('.folha button:has-text("Trocar")').count()) await p.click('.folha button:has-text("Trocar")');
  const visC = await visiveis(p); await A.aba(p, 'Identificação'); await A.foto(p, 'Foto 1'); await A.concluir(p); f = await A.faltas(p);
  const pedeLarg = f.some((x) => /Largura/.test(x));
  try { await A.aba(p, 'Meio'); } catch (e) { /* segue */ } await A.num(p, 'Largura da calcada (m)', '2,4'); await A.concluir(p); f = await A.faltas(p);
  if (await p.locator('.folha >> text=Salvar sem GPS').count()) await p.click('.folha >> text=Salvar sem GPS');
  ok('F.5', pedeLarg && f.length === 0 && visC.filter((x) => !['Codigo', 'Data e hora', 'Coletor', 'Local do registro', 'Categoria', 'Foto 1', 'Largura da calcada (m)'].includes(x)).length === 0, `calçada: aparecem ${visC.join(', ')}; largura cobrada=${pedeLarg}`);
  // 6. local de novo plantio não existe mais
  await p.waitForSelector('button.nova'); await p.click('button.nova'); await p.waitForSelector('.prog');
  const cats = await A.campo(p, 'Categoria').innerText();
  ok('F.6', !/novo plantio/i.test(cats), `categorias: ${cats.replace(/\n+/g, ' / ')}`);
  // 7. arbusto com 4 caules pede confirmação
  await A.op(p, 'Categoria', 'Arbusto'); await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva');
  await A.campo(p, 'CAP (cm)').locator('input').first().fill('15'); for (let i = 0; i < 2; i++) { await A.campo(p, 'CAP (cm)').locator('button:has-text("caule")').click(); await A.campo(p, 'CAP (cm)').locator('input').last().fill(String(12 + i)); }
  const botaoVisivel = await A.campo(p, 'CAP (cm)').locator('button:has-text("+ caule"):visible').count(); const nCaules = await A.campo(p, 'CAP (cm)').locator('input').count();
  ok('F.7', nCaules === 3 && botaoVisivel === 0, `${nCaules} caules medidos e o botão "+ caule" sumiu`);
  // 8. ajuda (?) e desenho da fiação
  await A.campo(p, 'CAP (cm)').locator('.ajuda-bt').click(); const ajDap = await A.campo(p, 'CAP (cm)').locator('.ajuda-box').innerText();
  await A.aba(p, 'Meio'); await p.locator('[data-grupo="Fiação aérea"] .ajuda-bt').click(); await p.waitForTimeout(500);
  const img = await p.locator('[data-grupo="Fiação aérea"] .ajuda-img').evaluate((i) => i.naturalWidth).catch(() => 0);
  await p.screenshot({ path: 'f5-ajuda-fiacao.png' });
  ok('F.8', /três mais representativos/.test(ajDap) && img > 0, `ajuda do CAP: "${ajDap.slice(0, 90)}..."; desenho da fiação carregado (${img} px)`);
  // 9. preferência de copa: área direto
  await p.goto(L.WEB + '#preferencias'); await p.waitForSelector('text=Como medir a copa'); await p.click('text=Área de copa direto'); await p.waitForTimeout(400);
  await p.goto(L.WEB + '#inicio'); await p.waitForSelector('button.nova'); await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Categoria', 'Árvore'); await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva');
  const temArea = await A.campo(p, 'Area de copa medida (m2)').count(); const temRaio = await A.campo(p, 'Raio de copa 1 (m)').count();
  ok('F.9', temArea === 1 && temRaio === 0, `com a preferência "área direto": campo de área ${temArea}, raios ${temRaio}`);
  ok('F.10', !p.erros.length, 'erros: ' + JSON.stringify(p.erros));
  fs.writeFileSync('res-bf5.json', JSON.stringify(R, null, 1)); await b.close(); process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
