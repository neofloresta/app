// 2.6: coordenação (equipes em série, formulário que não perde o digitado, desativar, menu agrupado, painel em abas, validação com Desfazer e motivos)
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const P = async (acao, d) => (await fetch(L.MOCK, { method: 'POST', body: JSON.stringify(Object.assign({ acao }, d)) })).json();
(async () => {
  await L.subir(); await L.configurar(); await L.semear(60);
  const b = await chromium.launch(); const C = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const pa = C.p;
  await L.logar(pa, 'admin', L.senha()); await pa.waitForTimeout(1200);
  // 1. menu agrupado
  await pa.goto(L.WEB + '#inicio'); await pa.waitForTimeout(800);
  await pa.click('.topo .ic[aria-label="Menu"]'); await pa.waitForTimeout(300);
  const grupos = await pa.locator('.menu-tit').allInnerTexts(); const temEnviar = await pa.locator('.menu-it:has-text("Enviar agora")').count(); const temServidor = await pa.locator('.menu-it:text-is("Servidor")').count();
  ok('D.1', ['Acompanhar', 'Agir', 'Entregar', 'Configurar projeto', 'Administração', 'Conta'].every((g) => grupos.includes(g)) && !temEnviar && !temServidor, `grupos: ${grupos.join(', ')}; "Enviar agora" para a coordenação=${temEnviar}; "Servidor" solto no menu=${temServidor}`);
  await pa.click('.menu-it:has-text("Segurança")'); await pa.waitForTimeout(800); const servSeg = await pa.locator('button:has-text("Configurar servidor")').count();
  ok('D.2', servSeg === 1, 'servidor fica dentro de Segurança');
  // 2. equipes em série
  await pa.goto(L.WEB + '#admin/usuarios'); await pa.waitForSelector('text=Criar equipes em série', { timeout: 20000 });
  await pa.click('button:has-text("Criar equipes em série")'); await pa.fill('.folha input[type=number] >> nth=0', '3'); await pa.fill('.folha input >> nth=2', 'tst-');
  await pa.click('.folha button:has-text("Criar")'); await pa.waitForSelector('.folha-acessos', { timeout: 30000 });
  const linhas = await pa.locator('.folha-acessos tr').allInnerTexts();
  const l1 = (linhas[1] || '').split('\t'); const login1 = l1[2], senha1 = l1[3];
  await pa.click('.folha button:has-text("Fechar")'); await pa.waitForTimeout(800);
  const lg = await P('login', { u: login1, s: senha1 });
  ok('D.3', linhas.length === 4 && /^Equipe \d+$/.test(l1[0]) && /^E\d+$/.test(l1[1]) && lg.ok, `folha de acessos com ${linhas.length - 1} equipes (${linhas.slice(1).map((x) => x.split('\t').slice(0, 3).join(' ')).join(' / ')}); login da primeira funciona=${!!lg.ok}`);
  // 3. formulário volta com o que foi digitado quando há erro
  await pa.click('button:has-text("+ Novo usuário")'); await pa.waitForTimeout(300);
  await pa.fill('.folha input[placeholder="ex.: div-1"]', 'nova-eq'); await pa.fill('.folha input[placeholder="ex.: Equipe 1"] >> nth=0', 'Equipe Nova'); await pa.fill('.folha input[placeholder="mínimo 8 caracteres"]', 'curta');
  const eqAuto = await pa.locator('.folha input[placeholder="ex.: Equipe 1"] >> nth=1').inputValue(); const codSug = await pa.locator('.folha input[placeholder="ex.: E1"]').inputValue();
  await pa.click('.folha button:has-text("Salvar")'); await pa.waitForTimeout(500);
  const voltou = await pa.locator('.folha input[placeholder="ex.: div-1"]').inputValue().catch(() => ''); const nomeV = await pa.locator('.folha input[placeholder="ex.: Equipe 1"] >> nth=0').inputValue().catch(() => '');
  const toastE = await pa.locator('.toast.erro').innerText().catch(() => '');
  ok('D.4', voltou === 'nova-eq' && nomeV === 'Equipe Nova' && /8 caracteres/.test(toastE) && eqAuto === 'Equipe Nova' && /^E\d+$/.test(codSug), `erro "${toastE}" e o formulário voltou com o digitado (${voltou}, ${nomeV}); equipe acompanhou o nome (${eqAuto}); código sugerido ${codSug}`);
  await pa.click('.folha button:has-text("Cancelar")'); await pa.waitForTimeout(300);
  // 4. desativar direto, excluir escondido
  const card = pa.locator(`.us-card:has-text("${login1}")`); const exclVis = await card.locator('button:has-text("Excluir")').isVisible();
  await card.locator('button:has-text("Desativar")').click(); await pa.waitForTimeout(1500);
  const lg2 = await P('login', { u: login1, s: senha1 }); const tag = await pa.locator(`.us-card:has-text("${login1}") .tag-cinza`).count();
  const ult = await pa.locator('.us-card:has-text("admin") small:has-text("Último acesso")').first().innerText().catch(() => '');
  ok('D.5', !exclVis && /desativado/i.test(lg2.erro || '') && tag === 1 && !/nunca/.test(ult), `Excluir escondido em "···" (visível=${exclVis}); desativado não entra ("${lg2.erro}"); ${ult}`);
  // 5. painel em abas
  await pa.goto(L.WEB + '#painel'); await pa.waitForSelector('.painel-abas', { timeout: 20000 }); await pa.waitForTimeout(500);
  const opVis = await pa.locator('.painel-aba[data-aba="op"]').isVisible(); const invVis = await pa.locator('.painel-aba[data-aba="inv"]').isVisible();
  await pa.click('.painel-abas button:has-text("Inventário")'); await pa.waitForTimeout(200);
  const opVis2 = await pa.locator('.painel-aba[data-aba="op"]').isVisible(); const temEsp = await pa.locator('.painel-aba[data-aba="inv"] h3:has-text("Espécies mais comuns")').isVisible();
  await pa.click('.painel-abas button:has-text("Operação")'); await pa.click('.kpi.clicavel:has-text("A revisar")'); await pa.waitForSelector('.val-lista', { timeout: 20000 });
  ok('D.6', opVis && !invVis && !opVis2 && temEsp && /#validacao/.test(pa.url()), 'painel abre em Operação; Inventário troca de aba; "A revisar" leva à validação');
  // 6. validação: motivos sugeridos e Desfazer
  await pa.waitForTimeout(800); const n0 = await pa.locator('.val-item').count();
  await pa.locator('.val-item input[type=checkbox]').first().check(); await pa.click('.val-acoes button:has-text("Devolver")'); await pa.waitForTimeout(300);
  const nMot = await pa.locator('.folha .motivos .chip').count(); await pa.locator('.folha .motivos .chip').first().click(); const motivo = await pa.locator('.folha textarea').inputValue();
  await pa.click('.folha button:has-text("Devolver")'); await pa.waitForSelector('.toast .toast-acao', { timeout: 10000 }); const n1 = await pa.locator('.val-item').count();
  await pa.click('.toast .toast-acao'); await pa.waitForTimeout(2500); const n2 = await pa.locator('.val-item').count();
  ok('D.7', nMot >= 1 && motivo.length > 5 && n1 === n0 - 1 && n2 === n0, `motivos sugeridos ${nMot} ("${motivo.slice(0, 50)}"); lista ${n0} → ${n1} depois de devolver → ${n2} com Desfazer`);
  const erros = pa.erros; ok('D.8', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b26d.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
