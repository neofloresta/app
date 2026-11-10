// 2.7: pessoas das equipes, dupla do dia, árvore repetida, setores censitários e parceiro sem jornada
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis';
const quadrado = (n, x0, y0, x1, y1) => ({ n, b: [x0, y0, x1, y1], a: [[x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]] });
(async () => {
  await L.subir(); await L.configurar();
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', trajeto: 'sim' } });
  // 1. cadastro de pessoas (servidor)
  const semReg = await L.post('pessoa_salvar', { pessoa: { nome: 'Sem Registro', funcao: 'Avaliador', vinculo: 'CLT', projeto: PJ } }).then(() => 'aceitou').catch((e) => e.message);
  await L.post('pessoa_salvar', { pessoa: { nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 12345/04-D', vinculo: 'CLT', projeto: PJ, equipe: 'Equipe 1' } });
  await L.post('pessoa_salvar', { pessoa: { nome: 'João Lima', funcao: 'Auxiliar', vinculo: 'Parceiro', empresa: 'MEI', projeto: PJ, equipe: 'Equipe 1' } });
  await L.post('pessoa_salvar', { pessoa: { nome: 'Carla Dias', funcao: 'Auxiliar', vinculo: 'CLT', projeto: 'outro-projeto' } });
  const lc = (await L.post('pessoas_listar', {}, 'div-1', 'equipe01')).pessoas;
  ok('E.1', /registro profissional/.test(semReg) && lc.length === 2 && lc.every((x) => !('empresa' in x) && !('ativo' in x)), `avaliador sem registro recusado ("${semReg.slice(0, 70)}"); a equipe recebe só as ${lc.length} pessoas do projeto dela, sem dados internos`);

  const b = await chromium.launch();
  process.env.COM_DUPLICIDADE = '1'; const E = await L.celular(b); const p = E.p; delete process.env.COM_DUPLICIDADE;
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('.mapa-mais', { timeout: 20000 }); await p.waitForTimeout(1000);
  const turnoAntes = await p.locator('button.faixa-turno:has-text("Começar turno")').count();
  // 2. dupla do dia: pedida no primeiro +, sem avaliador não libera
  await p.click('.mapa-mais'); await p.waitForSelector('.folha:has-text("Quem está na dupla hoje?")', { timeout: 15000 });
  const ops = await p.locator('.dupla-op').allInnerTexts();
  await p.click('.folha button:has-text("Confirmar dupla")'); await p.waitForTimeout(400);
  const erroAv = await p.locator('.toast.erro').innerText().catch(() => ''); const reabriu = await p.locator('.folha:has-text("Quem está na dupla hoje?")').count();
  await p.click('.dupla-op:has-text("Ana Souza")'); await p.click('.dupla-op:has-text("João Lima")'); await p.click('.folha button:has-text("Confirmar dupla")');
  await p.waitForSelector('.prog', { timeout: 40000 });
  ok('E.2', ops.some((t) => /Ana Souza/.test(t) && /CRBio/.test(t)) && /avaliador habilitado/i.test(erroAv) && reabriu === 1 && turnoAntes === 1, `escolha da dupla no primeiro +: ${ops.map((t) => t.replace(/\s+/g, ' ')).join(' | ')}; sem avaliador: "${erroAv}"`);
  await p.click('.topo .bt-cancelar'); await p.click('.folha button:has-text("Cancelar registro")'); await p.waitForTimeout(800);
  // árvore completa já com a dupla escolhida (não pergunta de novo no mesmo dia)
  const f = await A.arvoreCompleta(p, { fotos: 1 }); await p.waitForSelector('.tela-mapa.modo-campo', { timeout: 20000 }); await p.waitForTimeout(3500);
  const chip = await p.locator('.chip-dupla').innerText().catch(() => ''); const turnoDepois = await p.locator('.faixa-turno').count();
  const linhas = (await L.post('listar', { projeto: PJ })).linhas; const l0 = linhas[0] || {};
  ok('E.3', f.length === 0 && l0.avaliador === 'Ana Souza' && l0.avaliador_registro === 'CRBio 12345/04-D' && l0.auxiliar === 'João Lima' && l0.auxiliar_vinculo === 'Parceiro' && /Ana \+ João/.test(chip), `registro no servidor com avaliador "${l0.avaliador}" (${l0.avaliador_registro}) e auxiliar "${l0.auxiliar}" (${l0.auxiliar_vinculo}); faixa do mapa mostra "${chip}"`);
  ok('E.4', turnoDepois === 0, `dupla com parceiro: botão de turno/trajeto some (${turnoDepois}); antes da dupla aparecia (${turnoAntes})`);
  // 3. árvore repetida: mesmo ponto
  const n0 = (await p.evaluate(async () => (await window.__app.Store.registros('divinopolis')).length));
  await p.click('.mapa-mais'); await p.waitForSelector('.folha:has-text("Árvore já cadastrada?")', { timeout: 40000 }); const txtRep = await p.locator('.folha').innerText();
  await p.click('.folha button:has-text("Não cadastrar")'); await p.waitForTimeout(800);
  const n1 = (await p.evaluate(async () => (await window.__app.Store.registros('divinopolis')).length)); const semForm = await p.locator('.prog').count();
  ok('E.5', /a 0(,\d)? m deste ponto/.test(txtRep) && n1 === n0 && !semForm, `aviso: "${txtRep.replace(/\s+/g, ' ').slice(0, 110)}"; "Não cadastrar" não deixa rascunho (${n0} → ${n1})`);
  // 4. setores censitários
  const imp = await L.post('setores_importar', { projeto: PJ, camada: JSON.stringify({ campo: 'CD_SETOR', setores: [quadrado('312470105000001', -44.895, -20.148, -44.886, -20.139), quadrado('312470105000002', -44.886, -20.148, -44.877, -20.139)] }) });
  const atr = await L.post('setores_atribuir', { projeto: PJ, itens: [{ numero: '312470105000002', equipe: 'Equipe 1' }, { numero: '999', equipe: 'Equipe 1' }] });
  const negado = await L.post('setores_atribuir', { projeto: PJ, itens: [{ numero: '312470105000001', equipe: 'Equipe 1' }] }, 'div-1', 'equipe01').then(() => 'liberado').catch((e) => e.message);
  ok('E.6', imp.total === 2 && atr.alterados === 1 && atr.recusados.length === 1 && negado !== 'liberado', `camada com ${imp.total} setores; atribuído ${atr.alterados}, recusado o que não existe; equipe de campo não atribui ("${negado.slice(0, 60)}")`);
  await p.reload(); await p.waitForSelector('.mapa-mais', { timeout: 20000 }); await E.ctx.setGeolocation({ latitude: -20.14385, longitude: -44.8908, accuracy: 4 }); await p.waitForTimeout(2500);
  await p.click('.mapa-mais'); await p.waitForSelector('.folha:has-text("Fora dos setores da equipe")', { timeout: 40000 }); const txtSt = await p.locator('.folha').innerText();
  await p.click('.folha button:has-text("Seguir assim mesmo")'); await p.waitForSelector('.prog', { timeout: 20000 });
  const reg = await p.evaluate(() => { const r = window.__app.S.reg; const l = window.__app.Api.achatar(r, window.__app.S.form); return { setor: l.setor, fora: l.fora_do_setor, av: l.avaliador }; });
  ok('E.7', /setor 312470105000001/.test(txtSt) && reg.setor === '312470105000001' && reg.fora === 'sim' && reg.av === 'Ana Souza', `aviso "${txtSt.replace(/\s+/g, ' ').slice(0, 100)}"; o registro leva setor ${reg.setor}, fora_do_setor=${reg.fora}, avaliador ${reg.av}`);
  await p.click('.topo .bt-cancelar'); await p.click('.folha button:has-text("Cancelar registro")'); await p.waitForTimeout(600);
  // 5. cliente não vê quem estava na dupla; jornada do parceiro sem horário
  await L.post('validar', { projeto: PJ, itens: [{ uuid: l0.uuid, estado: 'Validado' }] });
  await L.post('usuario_salvar', { usuario_dados: { login: 'cli-1', senha: 'cliente01', nome: 'Prefeitura', perfil: 'cliente', projeto: PJ } });
  const lcli = (await L.post('listar', { projeto: PJ }, 'cli-1', 'cliente01')).linhas;
  const vaza = lcli.length ? Object.keys(lcli[0]).filter((k) => /avaliador|auxiliar|fora_do_setor/.test(k)) : ['sem linhas'];
  const pn = await L.post('painel', { projeto: PJ }); const dd = Object.values(pn.diario || {})[0] || {}; const de = dd['Equipe 1'] || {};
  ok('E.8', lcli.length === 1 && !vaza.length && de.parceiro === true && !de.ini && !de.fim, `cliente recebe ${lcli.length} registro sem colunas da dupla (${vaza.join(', ') || 'nenhuma'}); Hoje no campo da Equipe 1: parceiro=${de.parceiro}, começo "${de.ini}", fim "${de.fim}", tempo por amostra ${de.dur}`);
  // 6. telas da coordenação
  const C = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const q = C.p;
  await L.logar(q, 'admin', L.senha()); await q.waitForTimeout(1200);
  await q.goto(L.WEB + '#admin/pessoas'); await q.waitForSelector('.us-card', { timeout: 20000 }); const cards = await q.locator('.us-card').allInnerTexts();
  await q.click('button:has-text("+ Nova pessoa")'); await q.fill('.folha input >> nth=0', 'Bruno Alves'); await q.selectOption('.folha select >> nth=0', 'Avaliador'); await q.click('.folha button:has-text("Salvar")'); await q.waitForTimeout(600);
  const errSalvar = await q.locator('.toast.erro').innerText().catch(() => ''); const voltou = await q.locator('.folha input >> nth=0').inputValue().catch(() => '');
  await q.fill('.folha input >> nth=1', 'CREA-MG 123456'); await q.click('.folha button:has-text("Salvar")'); await q.waitForTimeout(1500);
  const cards2 = await q.locator('.us-card').count();
  await q.screenshot({ path: 'b27e-pessoas.png', fullPage: true });
  await q.goto(L.WEB + '#admin/setores'); await q.waitForSelector('text=setores na camada', { timeout: 20000 }); const st = await q.locator('main .cartao').innerText();
  await q.screenshot({ path: 'b27e-setores.png', fullPage: true });
  ok('E.9', cards.length === 3 && /registro profissional/.test(errSalvar) && voltou === 'Bruno Alves' && cards2 === 4 && /2 setores na camada · 1 com equipe/.test(st), `Pessoas: ${cards.length} cartões, nova pessoa sem registro volta com o digitado e depois salva (${cards2}); Setores: "${(st.match(/\d+ setores na camada[^\n]*/) || [''])[0]}"`);
  await p.screenshot({ path: 'b27e-campo.png' });
  const erros = [...p.erros, ...q.erros]; ok('E.10', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b27e.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
