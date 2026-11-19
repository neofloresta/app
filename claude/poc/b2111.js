// 2.11.1: formulário 8 (etapas por parte da árvore), risco no fim, fotos 2 a 5, "Abrindo o cadastro", apagar a espécie, aviso da trava e zoom da página
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const foco = (p) => p.evaluate(() => { const a = document.activeElement; const c = a && a.closest && a.closest('[data-campo]'); return (c ? c.dataset.campo : a ? a.tagName : '') + '=' + ((a && a.value) || ''); });
(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);
  const form = JSON.parse(fs.readFileSync(L.APP + '/forms/divinopolis-inventario.json', 'utf8'));
  // 1. depois de marcar o ponto aparece "Abrindo o cadastro..." e o formulário abre sem a tela de trás aparecer
  await p.evaluate(() => { window.__vistos = []; new MutationObserver(() => { const v = document.querySelector('.abrindo-cad'); const mp = document.querySelector('.mp-veu'); window.__vistos.push((v ? 'A' : '') + (mp ? 'M' : '') + (document.querySelector('.prog') ? 'F' : '')); }).observe(document.body, { childList: true, subtree: true }); });
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(400);
  const seq = await p.evaluate(() => window.__vistos.filter((x, i, a) => x !== a[i - 1])); const sobrou = await p.locator('.abrindo-cad').count();
  const iM = seq.lastIndexOf('M'), iA = seq.indexOf('A');
  ok('Z.1', iA >= 0 && seq.slice(iM + 1).every((x) => x !== '') && sobrou === 0, `sequência na tela: ${seq.join(' > ')} (M marcando, A abrindo, F formulário); o véu saiu ao abrir`);
  // 2. etapas na ordem combinada; nada de "Podas e danos" nem "Fitossanidade"
  await p.click('.prog-topo'); const etapas = (await p.locator('.folha .menu-it').allInnerTexts()).map((t) => limpo(t)); await p.evaluate(() => document.querySelectorAll('.veu').forEach((v) => v.remove()));
  await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Árvore'); await A.foto(p, 'Foto 1');
  await A.abaLivre(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva'); await p.waitForTimeout(200);
  await p.click('.prog-topo'); const etapasV = (await p.locator('.folha .menu-it').allInnerTexts()).map((t) => limpo(t).replace(/ (Completa|Em andamento|Falta obrigatório)$/, '')); await p.evaluate(() => document.querySelectorAll('.veu').forEach((v) => v.remove()));
  const ESP = ['Identificação', 'Indivíduo', 'Meio', 'Copa', 'Tronco', 'Raízes', 'Alvo', 'Risco', 'Manejo', 'Fotos e observações'];
  ok('Z.2', form.versao >= 8 && JSON.stringify(etapasV) === JSON.stringify(ESP), `formulário ${form.versao}; etapas: ${etapasV.join(', ')} (antes de escolher a categoria: ${etapas.length})`);
  // 3. o que aparece em Copa, Tronco e Raízes
  const naTela = async (et) => { await A.abaLivre(p, et); return p.evaluate(() => [...document.querySelectorAll('main .campo')].map((c) => (c.dataset.grupo ? c.dataset.grupo + ': ' + [...c.querySelectorAll('.chip')].map((x) => x.textContent.trim()).join('/') : (c.querySelector('.rot') || c).textContent.trim().replace(/\?$/, '') + (c.querySelector('.op') ? ': ' + [...c.querySelectorAll('.op')].map((x) => x.textContent.trim()).join('/') : '')))); };
  await A.abaLivre(p, 'Copa'); await p.screenshot({ path: __dirname + '/b2111-copa.png' });
  const copa = await naTela('Copa'), tronco = await naTela('Tronco'), raiz = await naTela('Raízes');
  const tem = (l, re) => l.some((x) => re.test(x));
  ok('Z.3', tem(copa, /^Qualidade da copa/) && tem(copa, /^Galhos secos ou podres.*Ausente\/0-25%\/25-50%\/50-75%\/acima de 75%/) && tem(copa, /^Podas: Ausente\/Danos por podas\/Poda drástica$/) && tem(copa, /^Pragas e doenças na copa: Ausente\/Fungo\/Cupim\/Broca\/Erva-de-passarinho$/)
    && tem(tronco, /^Danos no tronco: Ausente\/Lesões no tronco\/Codominância de troncos$/) && tem(tronco, /^Ocos e cavidades/) && tem(tronco, /^Pragas no tronco: Ausente\/Fungo\/Cupim\/Broca$/)
    && tem(raiz, /^Raízes: Ausente\/Poda de raiz\/Afloramento da raiz no canteiro\/Afloramento da raiz na calçada\/Afloramento da raiz na via\/Colo soterrado$/) && tem(raiz, /^Pragas nas raízes: Ausente\/Fungo\/Cupim$/) && !tem(raiz, /^Fitossanidade/) && copa.length === 4 && tronco.length === 3 && raiz.length === 2,
    `Copa: ${copa.join(' | ')} || Tronco: ${tronco.join(' | ')} || Raízes: ${raiz.join(' | ')}`);
  // 4. risco calculado é o último da etapa e as fotos vão de 2 a 5, sem descrição
  await A.abaLivre(p, 'Risco'); const ordemR = await p.evaluate(() => [...document.querySelectorAll('main .campo[data-campo]')].map((c) => c.dataset.campo)); const antesR = limpo(await A.campo(p, 'Risco').locator('.calc').innerText());
  await A.op(p, 'Probabilidade de falha', 'Iminente'); await A.op(p, 'Probabilidade de impacto', 'Alto'); await A.op(p, 'Consequencias', 'Severa'); await p.waitForTimeout(250); const depoisR = limpo(await A.campo(p, 'Risco').locator('.calc').innerText()); await p.screenshot({ path: __dirname + '/b2111-risco.png' });
  await A.abaLivre(p, 'Fotos e observações'); await p.screenshot({ path: __dirname + '/b2111-fotos.png' }); const rotF = await p.evaluate(() => [...document.querySelectorAll('main .grade-fotos [data-campo^="Foto"]')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
  ok('Z.4', ordemR[ordemR.length - 1] === 'Risco' && /Responda/.test(antesR) && depoisR === 'Severo' && rotF.length === 4 && rotF.every((t, k) => new RegExp('^Foto ' + (k + 2) + '(?![:\\d])').test(t) && !/copa|base|detalhe/i.test(t)), `etapa Risco: ${ordemR.join(', ')}; antes "${antesR}", depois "${depoisR}"; fotos: ${rotF.join(', ')}`);
  // 5. espécie: apagar com o teclado não tira o cursor da caixa (inclusive saindo de "Não identificada"); o "x" apaga tudo
  await A.abaLivre(p, 'Indivíduo'); const inp = () => A.campo(p, 'Especie').locator('input').first();
  await inp().click(); await p.keyboard.type('handro', { delay: 40 }); await p.locator('.esp-lista button').first().click(); await p.waitForTimeout(200); await p.keyboard.press('End'); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); const f1 = await foco(p);
  await p.click('.bt-semid'); await p.waitForTimeout(400); const fotosId = await p.locator('[data-campo^="Foto folha"]').count(); await inp().click(); await p.keyboard.press('End'); await p.keyboard.press('Backspace'); await p.waitForTimeout(250); const f2 = await foco(p); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); const f3 = await foco(p);
  await p.click('.esp-limpar'); await p.waitForTimeout(200); const f4 = await foco(p); const xSome = await p.locator('.esp-limpar.oculto').count();
  ok('Z.5', f1 === 'Especie=Handroanthus chrysotrich' && fotosId === 2 && f2 === 'Especie=Não identificad' && f3 === 'Especie=Não identific' && f4 === 'Especie=' && xSome === 1, `da lista, 2 apagadas: "${f1}"; de "Não identificada" (com ${fotosId} fotos de folha na tela), 1 apagada: "${f2}", mais 2: "${f3}"; no x: "${f4}"`);
  // 6. aviso da trava some quando a pessoa preenche, e a faixa nunca diz "completa" com o aviso de "falta" na tela
  await inp().fill('Handroanthus chrysotrichus'); await A.campo(p, 'CAP (cm)').locator('input').first().fill('80'); await A.num(p, 'Altura total (m)', 5); for (const k of [1, 2, 3, 4]) if (await A.campo(p, `Raio de copa ${k} (m)`).count()) await A.num(p, `Raio de copa ${k} (m)`, 2); if (await A.campo(p, 'Area de copa medida (m2)').count()) await A.num(p, 'Area de copa medida (m2)', 12);
  await p.evaluate(() => { window.__app.S.reg.mexido = true; }); await p.click('.rodape .btn.prox'); await p.waitForTimeout(300);
  await A.novosMeio(p); await p.locator('.chip[data-campo="Fiação ausente"]').click(); await A.op(p, 'Marquise ou toldo', 'Ausente'); await p.locator('.chip[data-campo="Tráfego sem interferência"]').click();
  await p.click('.rodape .btn.prox'); await p.waitForTimeout(250); const aviso = limpo(await p.locator('.toast').innerText().catch(() => '')); const faixa1 = limpo(await p.locator('.barra-pend').innerText());
  await A.op(p, 'Conflitos no raio de 2 m', 'Ausente'); await p.waitForTimeout(150); const avisoDepois = await p.locator('.toast').count(); const faixa2 = limpo(await p.locator('.barra-pend').innerText());
  ok('Z.6', /Complete "Meio".*Conflitos/.test(aviso) && /Faltam 1 nesta etapa/.test(faixa1) && avisoDepois === 0 && /Esta etapa está completa/.test(faixa2), `ao tentar seguir: aviso "${aviso}" e faixa "${faixa1.slice(0, 40)}"; ao preencher: aviso some (${avisoDepois}) e faixa "${faixa2.slice(0, 40)}"`);
  // 7. título inteiro em tela estreita e página sem zoom de pinça
  await p.setViewportSize({ width: 360, height: 740 }); await p.waitForTimeout(200);
  const tit = await p.evaluate(() => { const h1 = document.querySelector('.topo h1'); const r = document.createRange(); r.selectNodeContents(h1.firstChild); return { txt: h1.firstChild.textContent, cabe: r.getBoundingClientRect().width <= h1.getBoundingClientRect().width + 0.5, gps: document.querySelector('.topo .gps').textContent }; });
  const vp = await p.evaluate(() => ({ meta: document.querySelector('meta[name=viewport]').content, ta: getComputedStyle(document.documentElement).touchAction }));
  ok('Z.7', tit.cabe && /user-scalable=no/.test(vp.meta) && /maximum-scale=1/.test(vp.meta) && vp.ta === 'pan-x pan-y', `a 360 px: título "${tit.txt}" cabe: ${tit.cabe} (GPS "${tit.gps}"); viewport "${vp.meta}"; toque na página: ${vp.ta}`);
  
  // 8. cadastro completo no formulário 8: o que foi gravado (registro antigo: ver b2111m.js)
  await p.setViewportSize({ width: 412, height: 915 }); await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova'); await p.waitForTimeout(400);
  const f = await A.arvoreCompleta(p); const rs = await p.evaluate(async () => Store.todosRegistros()); const r = rs.find((x) => x.status !== 'rascunho');
  const v = (r && r.valores) || {};
  ok('Z.8', f.length === 0 && r && v['Galhos secos ou podres'] === 'Ausente' && v['Pragas na copa ausente'] === true && v['Pragas no tronco ausente'] === true && v['Pragas nas raízes ausente'] === true && !v.Fungo && !v['Fitossanidade ausente'] && v.Risco === 'Baixo',
    `cadastro completo sem pendência (${f.join(', ') || 'nenhuma'}); galhos "${v['Galhos secos ou podres']}", pragas ausentes nas três partes, risco ${v.Risco}; campos gerais antigos vazios`);
  ok('Z.9', !p.erros.length, p.erros.length ? p.erros.join(' | ') : 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
