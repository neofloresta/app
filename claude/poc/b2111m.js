// 2.11.1: registro feito no formulário 7 continua legível e editável depois que o servidor passa ao formulário 8
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const F7 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/divinopolis-form7.json', 'utf8')); const F8 = L.FORM;
const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim(); const chipC = (p, n) => p.locator(`.chip[data-campo="${n}"]`).click();
async function ate7(p, { podas, raizes, fito, parar }) {
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(200);
  await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Árvore'); await A.foto(p, 'Foto 1');
  await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva');
  await A.campo(p, 'Especie').locator('input').first().fill('Moquilea tomentosa'); await p.waitForTimeout(80);
  await A.campo(p, 'CAP (cm)').locator('input').first().fill('102'); await A.num(p, 'Altura total (m)', 6.5);
  for (const k of [1, 2, 3, 4]) if (await A.campo(p, `Raio de copa ${k} (m)`).count()) await A.num(p, `Raio de copa ${k} (m)`, 2 + k / 2);
  if (await A.campo(p, 'Area de copa medida (m2)').count()) await A.num(p, 'Area de copa medida (m2)', 18);
  await A.aba(p, 'Meio'); await A.op(p, 'Conflitos no raio de 2 m', 'Ausente'); await chipC(p, 'Fiação ausente'); await A.op(p, 'Marquise ou toldo', 'Ausente'); await chipC(p, 'Tráfego sem interferência');
  await A.aba(p, 'Podas e danos'); for (const n of [...podas, 'Danos ausente', ...raizes]) await chipC(p, n); await A.op(p, 'Ocos e cavidades', 'Ausente');
  await A.aba(p, 'Fitossanidade'); await A.op(p, 'Qualidade da copa', 'Normal'); for (const n of fito) await chipC(p, n);
  if (parar) return;
  await A.aba(p, 'Risco'); await A.op(p, 'Probabilidade de falha', 'Improvável'); await A.campo(p, 'Probabilidade de impacto').locator('.op').nth(1).click(); await A.op(p, 'Consequencias', 'Menor');
  await A.aba(p, 'Manejo'); await chipC(p, 'Manejo nenhum');
  await A.concluir(p);
  for (const t of ['Sim, nenhum', 'Está certo']) if (await p.locator(`.folha >> text=${t}`).count()) { await p.click(`.folha button:has-text("${t}")`); await p.waitForTimeout(300); }
  return A.faltas(p);
}
(async () => {
  await L.subir(); await L.configurar(); await L.post('formulario_salvar', { formulario: F7 });
  const b = await chromium.launch(); const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);
  const v0 = await p.evaluate(() => window.__app.S.form.versao);
  const f = await ate7(p, { podas: ['Poda de raiz', 'Galhos secos, podres ou com risco de queda'], raizes: ['Raízes ausente'], fito: ['Fungo'] });
  await p.waitForSelector('button.nova'); await p.waitForTimeout(2500);
  const ra = (await p.evaluate(async () => (await Store.todosRegistros()).map((r) => ({ uuid: r.uuid, status: r.status })))).find((r) => r.status !== 'rascunho');
  ok('M.1', v0 === 7 && f.length === 0 && !!ra, `app com o formulário ${v0}; registro antigo concluído (pendências: ${f.join(', ') || 'nenhuma'})`);
  await L.post('formulario_salvar', { formulario: F8 });
  for (let k = 0; k < 3 && (await p.evaluate(() => window.__app.S.form.versao)) !== 8; k++) { await p.evaluate(() => { window.__app.S.formsEm = null; }); await p.reload(); await p.waitForSelector('button.nova'); await p.waitForTimeout(3200); }
  const v1 = await p.evaluate(() => window.__app.S.form.versao);
  await p.goto(L.WEB + '#form/' + ra.uuid); await p.waitForSelector('.ficha-sec'); await p.waitForTimeout(400);
  const sec = await p.evaluate(() => [...document.querySelectorAll('.ficha-sec')].map((s) => s.querySelector('h3').textContent + ': ' + [...s.querySelectorAll('.fl')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join(' / ')));
  const ant = sec.find((t) => /^Formulário anterior/.test(t)) || '';
  ok('M.2', v1 === 8 && /Fungo/.test(ant) && /Galhos secos, podres/.test(ant) && sec.some((t) => /^Raízes:.*Poda de raiz/.test(t)), `app com o formulário ${v1}; ficha do registro antigo: ${sec.filter((t) => /^(Raízes|Formulário anterior)/.test(t)).join(' || ')}`);
  await p.click('button:has-text("Editar registro")'); await p.click('.folha button:has-text("Editar registro")'); await p.waitForSelector('.prog'); await p.waitForTimeout(300);
  const v = await p.evaluate(() => { const x = window.__app.S.reg.valores; return { aus: x['Raízes ausente'], poda: x['Poda de raiz'], fungo: x.Fungo }; });
  await A.concluir(p); const pend = await A.faltas(p);
  ok('M.3', v.aus === false && v.poda === true && v.fungo === true && pend.includes('Galhos secos ou podres') && pend.includes('Pragas no tronco'), `ao editar: "Raízes ausente" ${v.aus}, "Poda de raiz" ${v.poda}, fungo antigo guardado ${v.fungo}; o app pede os campos novos: ${pend.join(', ')}`);
  ok('M.4', !p.erros.length, p.erros.length ? p.erros.join(' | ') : 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
