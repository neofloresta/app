// Ações de tela reutilizadas pelos testes
const path = require('path');
const FOTO = path.join(__dirname, 'foto.jpg');
const campo = (p, nome) => p.locator(`[data-campo="${nome}"]`);
async function aba(p, nome) { await p.click('.prog-topo'); await p.click(`.folha .menu-it:has-text("${nome}")`); await p.waitForTimeout(120); }
async function op(p, nomeCampo, texto) { await campo(p, nomeCampo).locator(`.op:has-text("${texto}")`).first().click(); }
async function chip(p, rotulo) { await p.locator(`.chip:text-is("${rotulo}")`).first().click(); }
async function num(p, nomeCampo, v) { await campo(p, nomeCampo).locator('input').first().fill(String(v)); }
async function concluir(p) { await p.click('.prog-topo'); await p.click('.folha >> text=Concluir árvore'); await p.waitForTimeout(350); }
async function faltas(p) { if (await p.locator('.folha >> text=Está certo').count()) { await p.click('.folha button:has-text("Está certo")'); await p.waitForTimeout(300); } await p.waitForTimeout(150); const t = await p.locator('.barra-pend').getAttribute('data-itens').catch(() => null); return t ? JSON.parse(t) : []; }
async function foto(p, nomeCampo) { await campo(p, nomeCampo).locator('input[capture]').setInputFiles(FOTO); await p.waitForTimeout(250); }
// Árvore completa da categoria 1 com 3 fotos
async function arvoreCompleta(p, { especie = 'Moquilea tomentosa', fotos = 3, altura = 6.5, morta = false, manejoNenhum = true } = {}) {
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(200);
  await op(p, 'Local do registro', 'Via pública'); await op(p, 'Categoria', 'Árvore');
  await foto(p, 'Foto 1');
  await aba(p, 'Indivíduo'); await op(p, 'Situacao', morta ? 'Morta' : 'Viva');
  if (!morta) {
    await campo(p, 'Especie').locator('input').first().fill(especie); await p.waitForTimeout(80);
    await campo(p, 'CAP (cm)').locator('input').first().fill('102'); await num(p, 'Altura total (m)', altura);
    for (const k of [1, 2, 3, 4]) if (await campo(p, `Raio de copa ${k} (m)`).count()) await num(p, `Raio de copa ${k} (m)`, 2 + k / 2);
    if (await campo(p, 'Area de copa medida (m2)').count()) await num(p, 'Area de copa medida (m2)', 18);
    await aba(p, 'Meio'); await op(p, 'Conflitos no raio de 2 m', 'Ausente'); await p.locator('.chip[data-campo="Fiação ausente"]').click(); await op(p, 'Marquise ou toldo', 'Ausente');
    await p.locator('.chip[data-campo="Tráfego sem interferência"]').click();
    await aba(p, 'Podas e danos');
    for (const n of ['Podas ausente', 'Danos ausente', 'Raízes ausente']) await p.locator(`.chip[data-campo="${n}"]`).click();
    await op(p, 'Ocos e cavidades', 'Ausente');
    await aba(p, 'Fitossanidade e risco');
    await op(p, 'Qualidade da copa', 'Normal'); await p.locator('.chip[data-campo="Fitossanidade ausente"]').click();
    await op(p, 'Probabilidade de falha', 'Improvável'); await op(p, 'Probabilidade de impacto', 'não é provável'); await op(p, 'Consequencias', 'Menor');
    await aba(p, 'Manejo'); if (manejoNenhum) await p.locator('.chip[data-campo="Manejo nenhum"]').click();
    if (fotos > 1) { await aba(p, 'Fotos e observações'); await foto(p, 'Foto 2'); if (fotos > 2) await foto(p, 'Foto 3'); }
  }
  await concluir(p);
  if (await p.locator('.folha >> text=Sim, nenhum').count()) { await p.click('.folha button:has-text("Sim, nenhum")'); await p.waitForTimeout(300); }
  if (await p.locator('.folha >> text=Está certo').count()) { await p.click('.folha button:has-text("Está certo")'); await p.waitForTimeout(300); }
  if (await p.locator('.folha >> text=Salvar sem GPS').count()) { p.semGps = (p.semGps || 0) + 1; await p.click('.folha >> text=Salvar sem GPS'); await p.waitForTimeout(300); }
  return faltas(p);
}
async function excluir(p) { await p.click('.prog-topo'); await p.click('.folha button.perigo'); await p.waitForTimeout(200); await p.locator('.folha button.perigo').last().click(); await p.waitForTimeout(400); }
module.exports = { excluir, campo, aba, op, chip, num, concluir, faltas, foto, arvoreCompleta, FOTO };
