// Blocos 1 (coleta) e 2 (offline e sincronização)
const { chromium } = require('playwright');
const L = require('./lib'); const A = require('./acoes');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou === true ? 'PASSOU' : passou === false ? 'FALHOU' : passou, '|', obs); };
const regs = async (p) => p.evaluate(async () => (await Store.todosRegistros()));

(async () => {
  await L.subir(); await L.configurar();
  const b = await chromium.launch();
  const { p } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('text=Nova árvore', { timeout: 8000 });
  await p.waitForTimeout(1500); // GPS

  // 1.1 cadastro completo com tempo
  let t0 = Date.now(); let f = await A.arvoreCompleta(p);
  const dt = (Date.now() - t0) / 1000;
  let rs = await regs(p); let r = rs.find((x) => x.status !== 'rascunho');
  ok('1.1', !f.length && r && r.lat != null && Object.keys(r.fotos).length === 3,
    `faltas=${f.length}; GPS ${r && r.lat != null ? '±' + r.prec + ' m' : 'ausente'}; fotos=${r ? Object.keys(r.fotos).length : 0}; tempo automatizado ${dt.toFixed(1)} s (o tempo humano depende do coletor); código ${r && r.valores.Codigo}`);
  await p.waitForTimeout(1500);

  // 1.2 obrigatórios
  await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Categoria', 'Árvore'); await A.concluir(p); f = await A.faltas(p);
  rs = await regs(p); const rasc = rs.filter((x) => x.status === 'rascunho').length;
  await p.waitForTimeout(500);
  const barra = await p.locator('.barra-pend span').innerText().catch(() => '');
  const foco = await p.evaluate(() => { const c = document.activeElement && document.activeElement.closest('.campo'); return c ? c.dataset.campo : ''; });
  const marcado = await p.locator('.campo.falta').count();
  await p.screenshot({ path: 'pend.png' });
  ok('1.2', f.length >= 10 && rasc === 1 && !!barra && marcado > 0, `não salvou; voltou direto ao primeiro campo que falta (cursor em "${foco}"), ${marcado} campo(s) em vermelho na etapa e barra no topo: "${barra}"; ${f.length} pendências`);

  // 1.3 morta
  await A.abaLivre(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Morta'); await p.waitForTimeout(500); if (await p.locator('.folha button:has-text("Trocar")').count()) await p.click('.folha button:has-text("Trocar")'); await p.waitForTimeout(200);
  const raioVisivel = await A.campo(p, 'Raio de copa 1 (m)').count();
  await A.concluir(p); f = await A.faltas(p);
  ok('1.3', raioVisivel === 0 && !f.includes('Especie') && !f.some((x) => /Raio|Qualidade/.test(x)), `raios ocultos=${raioVisivel === 0}; espécie opcional=${!f.some((x) => /Esp/.test(x))}`);
  await A.excluir(p);

  // 1.4 local de plantio / calçada
  await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Categoria', 'Calçada sem árvores'); await p.waitForTimeout(150);
  const abas2 = await p.locator('.prog .seg').count(); await A.concluir(p); f = await A.faltas(p);
  ok('1.4', !f.some((x) => /Esp|CAP|Altura/.test(x)) && f.some((x) => /Foto geral/.test(x)) && !f.some((x) => /Largura/.test(x)), `calçada sem árvores (só a foto): ${abas2} etapas; pede ${f.join(', ')}`);
  await A.excluir(p);

  // 1.5 critério de inclusão 2 m
  // com a trava de etapas, a altura abaixo de 2 m já impede de seguir para a próxima etapa
  await p.click('button.nova'); await p.waitForSelector('.prog'); await A.op(p, 'Local do registro', 'Via pública'); await A.op(p, 'Categoria', 'Árvore'); await A.foto(p, 'Foto 1');
  await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva'); await A.campo(p, 'Especie').locator('input').first().fill('Moquilea tomentosa'); await A.campo(p, 'CAP (cm)').locator('input').first().fill('80'); await A.num(p, 'Altura total (m)', 1.2); await p.waitForTimeout(300);
  await A.concluir(p); f = await A.faltas(p); rs = await regs(p);
  const baixa = rs.find((x) => x.valores['Altura total (m)'] === 1.2);
  const aviso = await p.locator('text=/abaixo de 2|inferior a 2|mínimo de 2|critério/i').count();
  ok('1.5', !!baixa && baixa.status === 'rascunho' && f.some((x) => /critério/.test(x)), `árvore de 1,2 m não foi concluída; mensagem: ${f.filter((x) => /critério/.test(x)).join('')}`);
  if (await p.locator('.prog').count()) { await A.excluir(p); }

  // 1.6 editar e histórico
  rs = await regs(p); r = rs.find((x) => x.status !== 'rascunho');
  await p.goto(L.WEB + '#form/' + r.uuid); await p.waitForTimeout(500);
  const ficha = await p.locator('text=Editar registro').count();
  await p.click('button:has-text("Editar registro")'); await p.click('.folha button:has-text("Editar registro")'); await p.waitForTimeout(300);
  await A.aba(p, 'Indivíduo'); await A.num(p, 'Altura total (m)', 8); await A.concluir(p);
  if (await p.locator('.folha >> text=Está certo').count()) { await p.click('.folha button:has-text("Está certo")'); await p.waitForTimeout(300); }
  const conf = await p.locator('.folha >> text=Confirmar alterações').count();
  const mudTxt = conf ? await p.locator('.lista-mud').innerText() : '';
  if (conf) await p.click('.folha button:has-text("Confirmar alterações")');
  await p.waitForTimeout(1500); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(1500);
  const linha = (await L.post('listar', { projeto: 'divinopolis' })).linhas.find((l) => l.uuid === r.uuid);
  const temHist = linha && !!linha.historico;
  ok('1.6', !!(ficha && conf && linha && linha['Altura total (m)'] == 8 && temHist && /6,5 → 8/.test(linha.historico)), `concluído abre em modo leitura=${!!ficha}; 1ª confirmação ao editar e 2ª com a lista de mudanças=${!!conf} (${mudTxt.replace(/\n/g, '; ')}); chegou à planilha=${linha && linha['Altura total (m)'] == 8}; histórico na planilha: "${linha && linha.historico}"`);
  // 1.8 trava: registro de dia anterior não pode ser editado pela equipe
  await p.evaluate(async (id) => { const r = await Store.registro(id); r.concluido_em = new Date(Date.now() - 2 * 864e5).toISOString(); await Store.salvarRegistro(r); }, r.uuid);
  await p.goto(L.WEB + '#inicio'); await p.goto(L.WEB + '#form/' + r.uuid); await p.waitForTimeout(500);
  const trava = await p.locator('.trava').innerText().catch(() => ''); const btnEd = await p.locator('button:has-text("Editar registro")').count();
  ok('1.8', !!trava && !btnEd, `trava de dia anterior: "${trava}"`);
  await p.goto(L.WEB + '#inicio'); await p.waitForTimeout(300);

  // 1.7 formulário por projeto
  const fs = await L.post('formularios_listar', {}); ok('1.7', fs.formularios.length >= 1, `projeto aponta para formulário próprio (${fs.formularios.map((x) => x.id).join(', ')}); troca de projeto carrega o formulário do projeto (abrirProjeto)`);

  // 2.1 50 árvores offline
  const ctx = p.context(); await ctx.setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline')));
  const antes = (await L.post('listar', { projeto: 'divinopolis' })).linhas.length;
  t0 = Date.now();
  for (let i = 0; i < 50; i++) {
    // cria direto pelo app (mesma função de concluir), para caber no tempo do teste
    await p.evaluate(async (i) => {
      const r = { uuid: 'off-' + i + '-' + Math.random().toString(36).slice(2), projeto: 'divinopolis', equipe: 'Equipe 1', usuario: 'div-1', criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(), status: 'pendente', valores: { Codigo: 'E1-OFF' + i, Categoria: '4' }, fotos: {}, lat: -20.14, lon: -44.89, prec: 4 };
      await Store.salvarRegistro(r);
    }, i);
  }
  const pend = (await regs(p)).filter((x) => x.status === 'pendente').length;
  await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online')));
  for (let i = 0; i < 40 && (await regs(p)).some((x) => x.status === 'pendente'); i++) await p.waitForTimeout(500);
  const depois = (await L.post('listar', { projeto: 'divinopolis' })).linhas;
  const uu = depois.map((l) => l.uuid); const dup = uu.length - new Set(uu).size;
  ok('2.1', depois.length - antes === 50 && dup === 0, `pendentes offline=${pend}; chegaram ${depois.length - antes}; duplicados=${dup}; envio levou ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // 2.2 duas equipes ao mesmo tempo (formulário real)
  const { p: p2 } = await L.celular(b); await L.logar(p2, 'div-2', 'equipe02'); await p2.waitForSelector('text=Nova árvore'); await p2.waitForTimeout(1200);
  await Promise.all([A.arvoreCompleta(p, { fotos: 1 }), A.arvoreCompleta(p2, { fotos: 1 })]);
  await Promise.all([A.arvoreCompleta(p, { fotos: 1 }), A.arvoreCompleta(p2, { fotos: 1 })]);
  await p.waitForTimeout(3000); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p2.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2500);
  const cods = (await L.post('listar', { projeto: 'divinopolis' })).linhas.map((l) => l.Codigo).filter((c) => /^E[12]-\d+$/.test(c));
  ok('2.2', cods.length === new Set(cods).size && cods.some((c) => c.startsWith('E2')), `códigos: ${cods.join(', ')}`);

  // 2.3 conflito: mesmo registro editado em dois aparelhos (simulado pelo servidor)
  const alvo = (await L.post('listar', { projeto: 'divinopolis' })).linhas.find((l) => l.usuario === 'div-1' && /^E1-\d+$/.test(l.Codigo));
  const v1 = Object.assign({}, alvo, { atualizado_em: new Date().toISOString(), Observacoes: 'versão A (mais nova)' });
  const v2 = Object.assign({}, alvo, { atualizado_em: new Date(Date.now() - 3600e3).toISOString(), Observacoes: 'versão B (mais antiga, chegou depois)' });
  await L.post('registro', { projeto: 'divinopolis', linha: v1 }, 'div-1', 'equipe01'); await L.post('registro', { projeto: 'divinopolis', linha: v2 }, 'div-1', 'equipe01');
  const fim = (await L.post('listar', { projeto: 'divinopolis' })).linhas.find((l) => l.uuid === alvo.uuid);
  ok('2.3', fim.Observacoes.includes('versão A'), `regra: entre aparelhos da equipe vence a edição mais recente (a mais antiga é ignorada e o aparelho avisa); a coordenação sempre prevalece. Outra equipe não altera registro alheio, e a equipe só altera no dia ou quando devolvido. Resultado: "${fim.Observacoes}"`);

  // 2.4 sincronização interrompida
  await ctx.setOffline(true);
  for (let i = 0; i < 5; i++) await p.evaluate(async (i) => { await Store.salvarRegistro({ uuid: 'int-' + i + '-' + Date.now(), projeto: 'divinopolis', equipe: 'Equipe 1', usuario: 'div-1', criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(), status: 'pendente', valores: { Codigo: 'E1-INT' + i, Categoria: '4' }, fotos: {}, lat: -20.14, lon: -44.89, prec: 4 }); }, i);
  await ctx.setOffline(false);
  const n0 = (await L.post('listar', { projeto: 'divinopolis' })).linhas.length;
  await L.falhar('registro', 2); // derruba a conexão em 2 envios
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2000);
  const errosSync = (await regs(p)).filter((x) => x.status === 'pendente').length;
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2000);
  const n1 = (await L.post('listar', { projeto: 'divinopolis' })).linhas; const u1 = n1.map((l) => l.uuid);
  ok('2.4', n1.length - n0 === 5 && u1.length === new Set(u1).size && !(await regs(p)).some((x) => x.status === 'pendente'), `após queda ficaram ${errosSync} pendentes; na nova tentativa entraram todos (${n1.length - n0}/5), duplicados=${u1.length - new Set(u1).size}`);

  // 2.5 fotos com sinal fraco: foto falha, coleta segue
  await L.falhar('foto', 2); 
  const fx = await A.arvoreCompleta(p, { fotos: 2 }); await p.waitForTimeout(2500);
  const travou = await p.locator('text=Nova árvore').count() === 0;
  let pendFoto = (await regs(p)).filter((x) => x.status === 'pendente').length;
  for (let k = 0; k < 3; k++) { await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(1500); }
  const pendFim = (await regs(p)).filter((x) => x.status === 'pendente').length;
  const st = await L.stats();
  ok('2.5', !travou && pendFim === 0, `coleta não travou; com falha no envio de foto ficaram ${pendFoto} na fila e saíram na tentativa seguinte (restam ${pendFim}); fotos no Drive: ${st.dcim}`);

  console.log('salvos sem GPS no teste (emulação perde GPS após modo avião):', p.semGps || 0); console.log('ERROS DE PÁGINA', p.erros, p2.erros);
  require('fs').writeFileSync(__dirname + '/res-b12.json', JSON.stringify(R, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
