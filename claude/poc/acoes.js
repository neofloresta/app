// Ações de tela reutilizadas pelos testes
const path = require('path');
const FOTO = process.env.FOTO_ARQ || path.join(__dirname, 'foto.jpg');
const campo = (p, nome) => p.locator(`[data-campo="${nome}"]`);
async function aba(p, nome) { await p.click('.prog-topo'); await p.click(`.folha .menu-it:has-text("${nome}")`); await p.waitForTimeout(120); }
// passear pelas etapas sem a trava (como no treino, antes de preencher): para testes que só olham o que aparece
async function abaLivre(p, nome) { await p.evaluate(() => { if (window.__app.S.reg) window.__app.S.reg.mexido = false; }); await aba(p, nome); }
async function op(p, nomeCampo, texto) { await campo(p, nomeCampo).locator(`.op:has-text("${texto}")`).first().click(); }
// viva ou morta: no formulário 14 a pergunta está na Identificação; nos anteriores, na etapa Indivíduo. Termina na etapa Indivíduo quando ela existe
async function sit(p, v) {
  if (!(await campo(p, 'Situacao').count())) await abaLivre(p, 'Identificação');
  await op(p, 'Situacao', v); await p.waitForTimeout(400);
  if (await p.locator('.folha button:has-text("Trocar")').count()) { await p.click('.folha button:has-text("Trocar")'); await p.waitForTimeout(300); }
  if (!(await campo(p, 'Categoria').count())) return; // formulário antigo: já está na etapa Indivíduo
  await p.evaluate(() => { if (window.__app.S.reg) window.__app.S.reg.mexido = false; }); await p.click('.prog-topo');
  if (await p.locator('.folha .menu-it:has-text("Indivíduo")').count()) await p.click('.folha .menu-it:has-text("Indivíduo")'); else await p.evaluate(() => document.querySelectorAll('.veu').forEach((x) => x.remove()));
  await p.waitForTimeout(120);
}
async function chip(p, rotulo) { await p.locator(`.chip:text-is("${rotulo}")`).first().click(); }
async function num(p, nomeCampo, v) { await campo(p, nomeCampo).locator('input').first().fill(String(v)); }
async function concluir(p) { await p.click('.prog-topo'); await p.click('.folha >> text=Concluir registro'); await p.waitForTimeout(350); }
async function faltas(p) { if (await p.locator('.folha >> text=Está certo').count()) { await p.click('.folha button:has-text("Está certo")'); await p.waitForTimeout(300); } await p.waitForTimeout(150); const t = await p.locator('.barra-pend').getAttribute('data-itens').catch(() => null); return t ? JSON.parse(t) : []; }
async function foto(p, nomeCampo) { await campo(p, nomeCampo).locator('input[capture]').setInputFiles(FOTO); await p.waitForTimeout(250); }
// Árvore completa da categoria 1 com 3 fotos
// formulário 12: campos novos do Meio e do Risco (só marca se o formulário tiver)
async function novosMeio(p) { for (const [n, v] of [['Area livre (m2)', '1 a 2'], ['Posicao da arvore na calcada', 'Até 1 m']]) if (await campo(p, n).count()) await op(p, n, v); }
async function novosRisco(p) { // formulário 13: os campos do alvo ficam na etapa "Alvo", antes da "Risco"
  await p.click('.prog-topo'); const tem = await p.locator('.folha .menu-it:has-text("Alvo")').count(); await p.click(`.folha .menu-it:has-text("${tem ? 'Alvo' : 'Risco'}")`); await p.waitForTimeout(120);
  if (await p.locator('.chip[data-campo="Alvo pessoas"]').count()) await p.locator('.chip[data-campo="Alvo pessoas"]').click();
  for (const [n, v] of [['Principal alvo', 'Pessoas'], ['Zona do alvo', 'Projeção'], ['Taxa de ocupacao', 'Ocasional'], ['Fator de protecao', 'Ausente']]) if (await campo(p, n).count()) await op(p, n, v);
  if (tem) await aba(p, 'Risco');
  for (const [n, v] of [['Principal defeito da arvore', 'Tronco'], ['Carga sobre o defeito', 'Pequena']]) if (await campo(p, n).count()) await op(p, n, v);
}
async function arvoreCompleta(p, { especie = 'Moquilea tomentosa', fotos = 3, altura = 6.5, morta = false, manejoNenhum = true, categoria = 'Árvore', qtde = null, fiacao = null, paralelo = 'Não', semConcluir = false } = {}) {
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(200);
  await op(p, 'Local do registro', 'Via pública'); await op(p, 'Categoria', categoria);
  const sitId = await campo(p, 'Situacao').count(); if (sitId) { await op(p, 'Situacao', morta ? 'Morta' : 'Viva'); await p.waitForTimeout(150); } // formulário 14: situação e fitossanidade na Identificação
  await foto(p, 'Foto 1'); const fitoId = !morta && await campo(p, 'Fitossanidade').count(); if (fitoId) await op(p, 'Fitossanidade', 'Boa');
  if (!(morta && sitId)) await aba(p, 'Indivíduo'); if (!sitId) await op(p, 'Situacao', morta ? 'Morta' : 'Viva');
  if (!morta) {
    await campo(p, 'Especie').locator('input').first().fill(especie); await p.waitForTimeout(80); if (qtde) await num(p, 'Qtde estimada de individuos', qtde);
    await campo(p, 'CAP (cm)').locator('input').first().fill('102'); await num(p, 'Altura total (m)', altura);
    for (const k of [1, 2, 3, 4]) if (await campo(p, `Raio de copa ${k} (m)`).count()) await num(p, `Raio de copa ${k} (m)`, 2 + k / 2);
    if (await campo(p, 'Area de copa medida (m2)').count()) await num(p, 'Area de copa medida (m2)', 18);
    await aba(p, 'Meio'); await novosMeio(p); await op(p, 'Conflitos no raio de 2 m', 'Ausente'); await p.locator(`.chip[data-campo="${fiacao || 'Fiação ausente'}"]`).click(); if (fiacao && await campo(p, 'Tronco paralelo a fiacao eletrica').count()) await op(p, 'Tronco paralelo a fiacao eletrica', paralelo); await op(p, 'Marquise ou toldo', 'Ausente');
    await p.locator('.chip[data-campo="Tráfego sem interferência"]').click();
    await aba(p, 'Copa'); await op(p, 'Qualidade da copa', 'Normal'); await op(p, 'Galhos secos ou podres', 'Ausente');
    for (const n of ['Podas ausente', 'Pragas na copa ausente']) await p.locator(`.chip[data-campo="${n}"]`).click();
    await aba(p, 'Tronco'); for (const n of ['Danos ausente', 'Pragas no tronco ausente']) await p.locator(`.chip[data-campo="${n}"]`).click();
    await op(p, 'Ocos e cavidades', 'Ausente');
    await aba(p, 'Raízes'); for (const n of ['Raízes ausente', 'Pragas nas raízes ausente']) await p.locator(`.chip[data-campo="${n}"]`).click();
    if (!fitoId) await op(p, 'Fitossanidade', 'Boa');
    await aba(p, 'Risco'); await novosRisco(p); await op(p, 'Probabilidade de falha', 'Improvável'); await campo(p, 'Probabilidade de impacto').locator('.op').nth(1).click(); await op(p, 'Consequencias', 'Menor');
    await aba(p, 'Manejo'); if (manejoNenhum) await p.locator('.chip[data-campo="Manejo nenhum"]').click();
    if (fotos > 1) { await aba(p, 'Fotos e observações'); await foto(p, 'Foto 2'); if (fotos > 2) await foto(p, 'Foto 3'); }
  }
  if (semConcluir) return [];
  await concluir(p);
  if (await p.locator('.folha >> text=Sim, nenhum').count()) { await p.click('.folha button:has-text("Sim, nenhum")'); await p.waitForTimeout(300); }
  if (await p.locator('.folha >> text=Está certo').count()) { await p.click('.folha button:has-text("Está certo")'); await p.waitForTimeout(300); }
  if (await p.locator('.folha >> text=Salvar sem GPS').count()) { p.semGps = (p.semGps || 0) + 1; await p.click('.folha >> text=Salvar sem GPS'); await p.waitForTimeout(300); }
  return faltas(p);
}
async function excluir(p) { await p.click('.prog-topo'); await p.click('.folha .link-perigo'); await p.waitForTimeout(200); await p.locator('.folha button.perigo').last().click(); await p.waitForTimeout(400); }
module.exports = { sit, abaLivre, excluir, campo, aba, op, chip, num, concluir, faltas, foto, arvoreCompleta, novosMeio, novosRisco, FOTO };
