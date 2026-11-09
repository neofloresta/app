// Perfis, validação, portal do cliente, painel, relatório, exportação, importação e segurança (navegador)
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou === true ? 'PASSOU' : passou === false ? 'FALHOU' : passou, '|', obs); };
const N = +(process.argv[2] || 3000);
(async () => {
  await L.subir(); await L.configurar(); await L.semear(N);
  await L.post('usuario_salvar', { usuario_dados: { login: 'rev', senha: 'revisor1', nome: 'Revisão técnica', perfil: 'revisor', projeto: 'divinopolis', equipe: 'Coordenação' } });
  await L.post('usuario_salvar', { usuario_dados: { login: 'pref', senha: 'cliente1', nome: 'Prefeitura de Divinópolis', perfil: 'cliente', projeto: 'divinopolis' } });
  await L.post('projeto_salvar', { projeto_dados: { id: 'divinopolis', nome: 'PMAU Divinópolis', formulario: L.FORM.id, epsg: '', contratante: 'Prefeitura Municipal de Divinópolis', contrato: '580/2026', municipio: 'Divinópolis/MG', meta: '10000', cliente_ve: 'validados' } });
  await L.post('formulario_salvar', { formulario: L.FORM, qml: fs.readFileSync(L.APP + '/forms/divinopolis-inventario.qml', 'utf8') });
  const b = await chromium.launch(); const shots = [];
  const foto = async (p, nome) => { const f = `tela-${nome}.png`; await p.screenshot({ path: f, fullPage: false }); shots.push(f); };

  // --- coletor cria uma árvore
  const { p: pc } = await L.celular(b); await L.logar(pc, 'div-1', 'equipe01'); await pc.waitForSelector('button.nova'); await pc.waitForTimeout(1200);
  await A.arvoreCompleta(pc, { fotos: 1 }); await pc.waitForTimeout(2500);
  const uLocal = await pc.evaluate(async () => (await Store.todosRegistros()).find((r) => r.status !== 'rascunho').uuid);
  const meu = (await L.post('listar', { projeto: 'divinopolis' })).linhas.find((l) => l.uuid === uLocal);

  // --- revisor: tela de validação
  const { p: pr } = await L.celular(b, { viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(pr, 'rev', 'revisor1'); await pr.waitForTimeout(1200);
  let t0 = Date.now(); await pr.goto(L.WEB + '#validacao'); await pr.waitForSelector('.val-item', { timeout: 60000 }); const tVal = Date.now() - t0;
  const nItens = await pr.locator('.val-item').count(); const resumo = await pr.locator('.val-resumo').innerText();
  const comAlerta = await pr.locator('.val-item .al').count();
  await foto(pr, 'validacao');
  ok('V.1', nItens > 0, `lista de validação abriu em ${(tVal / 1000).toFixed(1)} s com ${N + 1} registros; ${resumo.replace(/\n/g, ' ')}; itens com alerta na página: ${comAlerta}`);
  // abre a ficha do registro do coletor e devolve
  await pr.fill('.val-busca input', meu.Codigo); await pr.waitForTimeout(500); await pr.click('.val-item .val-txt'); await pr.waitForSelector('.status-ficha'); await pr.waitForTimeout(400);
  await foto(pr, 'ficha-revisor');
  await pr.click('.val-dec button:has-text("Devolver")'); await pr.fill('.folha textarea', 'Conferir a espécie e refazer a foto 1'); await pr.click('.folha button:has-text("Devolver")'); await pr.waitForTimeout(800);
  // valida em lote os sem alerta
  await pr.goto(L.WEB + '#validacao'); await pr.waitForSelector('.val-lista'); await pr.fill('.val-busca input', ''); await pr.waitForTimeout(700);
  const btnLote = pr.locator('button:has-text("Validar todos sem alerta")'); const txtLote = await btnLote.innerText().catch(() => '');
  if (await btnLote.count()) { await btnLote.click(); await pr.check('.folha input[type=checkbox]'); await pr.click('.folha button:has-text("Validar")'); await pr.waitForTimeout(1500); }
  const linhas = (await L.post('listar', { projeto: 'divinopolis' })).linhas;
  const nVal = linhas.filter((l) => l.validacao === 'Validado').length; const dev = linhas.find((l) => l.uuid === meu.uuid);
  ok('V.2', dev.validacao === 'Devolvido' && nVal > 0, `devolvido com motivo "${dev.validacao_obs}"; "${txtLote}" validou ${nVal}`);

  // --- coletor vê o devolvido, corrige
  await pc.evaluate(() => window.dispatchEvent(new Event('online'))); await pc.waitForTimeout(2500); await pc.goto(L.WEB + '#inicio'); await pc.waitForTimeout(800);
  const faixa = await pc.locator('.faixa-dev').innerText().catch(() => '');
  await foto(pc, 'coletor-devolvido');
  await pc.click('.faixa-dev').catch(() => {}); await pc.waitForTimeout(300); await pc.click('.reg').catch(() => {}); await pc.waitForTimeout(500);
  const motivo = await pc.locator('.status-ficha').innerText().catch(() => '');
  await pc.click('button:has-text("Editar registro")'); await pc.click('.folha button:has-text("Editar registro")'); await pc.waitForTimeout(300);
  await A.aba(pc, 'Indivíduo'); await A.campo(pc, 'Especie').locator('input').first().fill('Cenostigma pluviosum'); await A.concluir(pc);
  if (await pc.locator('.folha >> text=Confirmar alterações').count()) await pc.click('.folha button:has-text("Confirmar alterações")');
  await pc.waitForTimeout(2500);
  const corr = (await L.post('listar', { projeto: 'divinopolis' })).linhas.find((l) => l.uuid === meu.uuid);
  ok('V.3', !!faixa && /Motivo/.test(motivo) && corr.validacao === 'Corrigido' && corr.Especie === 'Cenostigma pluviosum', `coletor viu "${faixa.replace(/\n/g, ' ')}"; corrigiu e voltou como ${corr.validacao}; histórico: ${corr.historico}`);

  // --- painel (revisor) e relatório
  t0 = Date.now(); await pr.goto(L.WEB + '#painel'); await pr.waitForSelector('.kpis', { timeout: 60000 }); const tPainel = Date.now() - t0; await pr.waitForTimeout(300);
  const kpis = await pr.locator('.kpis').innerText(); await foto(pr, 'painel-revisor');
  ok('P.1', true, `painel em ${(tPainel / 1000).toFixed(1)} s: ${kpis.replace(/\n/g, ' | ')}`);
  await pr.goto(L.WEB + '#relatorio'); await pr.waitForSelector('.rel-cab', { timeout: 60000 }); await pr.waitForTimeout(300); await foto(pr, 'relatorio');
  const pdf = await pr.pdf({ format: 'A4', printBackground: true }).catch(() => null); if (pdf) fs.writeFileSync('relatorio.pdf', pdf);
  ok('P.2', !!pdf, `relatório gerado; PDF de ${pdf ? Math.round(pdf.length / 1024) : 0} KB`);

  // --- cliente
  const { p: pp } = await L.celular(b); await L.logar(pp, 'pref', 'cliente1'); await pp.waitForSelector('.kpis', { timeout: 60000 }); await pp.waitForTimeout(400);
  const kc = await pp.locator('.kpis').innerText(); await foto(pp, 'cliente-painel');
  const temValidacao = await pp.locator('text=Situação da validação').count(); const temEquipe = await pp.locator('h3:text-is("Por equipe")').count();
  ok('C.1', !temValidacao && !temEquipe && /Registros/.test(kc), `cliente cai direto no painel só com validados: ${kc.replace(/\n/g, ' | ')}`);
  await pp.goto(L.WEB + '#mapa'); await pp.waitForFunction(() => / de /.test((document.querySelector('.mapa-conta') || {}).textContent || ''), null, { timeout: 60000 }); const contaC = await pp.locator('.mapa-conta').innerText(); await foto(pp, 'cliente-mapa');
  const novaC = await pp.locator('button.nova').count();
  await pp.goto(L.WEB + '#inicio'); await pp.waitForTimeout(500); const naInicio = await pp.locator('button.nova').count();
  ok('C.2', /de/.test(contaC) && !novaC && !naInicio, `mapa do cliente: ${contaC}; sem botão de coleta`);
  const r403 = await fetch(L.MOCK, { method: 'POST', body: JSON.stringify({ acao: 'registro', u: 'pref', s: 'cliente1', projeto: 'divinopolis', linha: { uuid: 'x' } }) }).then((r) => r.json());
  ok('C.3', !r403.ok, 'cliente não grava: ' + r403.erro);

  // --- coordenação: exportações e importação
  const { p: pa, ctx: ca } = await L.celular(b, { acceptDownloads: true, viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await L.logar(pa, 'admin', L.senha()); await pa.waitForTimeout(1500);
  await pa.goto(L.WEB + '#admin/exportar'); await pa.waitForSelector('text=Exportar dados'); await pa.selectOption('.cartao select >> nth=0', 'divinopolis');
  const saidas = {};
  for (const [f, rot] of [['gpkg', 'GeoPackage'], ['xlsx', 'Excel'], ['shp', 'Shapefile'], ['csv', 'CSV'], ['kml', 'Google Earth']]) {
    const t = Date.now(); const [dl] = await Promise.all([pa.waitForEvent('download', { timeout: 120000 }), pa.click(`.cartao button:has-text("${rot}")`)]);
    const arq = `saida.${f === 'shp' ? 'zip' : f}`; await dl.saveAs(arq); saidas[f] = { s: (Date.now() - t) / 1000, kb: Math.round(fs.statSync(arq).size / 1024) };
  }
  await foto(pa, 'exportar');
  ok('E.1', Object.keys(saidas).length === 5, JSON.stringify(saidas));
  // importação de CSV
  const csv = 'Codigo;Especie;Categoria;Altura total (m);latitude;longitude;Bairro\nANT-0001;Tipuana tipu;Árvore;12,5;-20,1401;-44,8821;Centro\nANT-0002;Handroanthus chrysotrichus;Árvore;6;-20,1405;-44,8830;Centro\nANT-0003;;Local de novo plantio;;-20,1410;-44,8840;Sidil\n';
  fs.writeFileSync('importar.csv', csv);
  await pa.goto(L.WEB + '#admin/importar'); await pa.waitForSelector('text=Importar inventário existente'); await pa.setInputFiles('input[type=file]', 'importar.csv'); await pa.click('button:has-text("Ler e conferir")'); await pa.waitForSelector('text=Conferência antes de importar');
  const conf = await pa.locator('.cartao >> nth=1').innerText(); await foto(pa, 'importar');
  await pa.click('button:has-text("Importar 3 registros")'); await pa.click('.folha button:has-text("Importar")'); await pa.waitForSelector('text=Importação concluída', { timeout: 30000 });
  const imp = (await L.post('listar', { projeto: 'divinopolis' })).linhas.filter((l) => /^ANT-/.test(l.Codigo));
  console.log(JSON.stringify(imp.map((l) => [l.Codigo, l.Categoria, l['Altura total (m)'], l.latitude, l.longitude]))); ok('I.1', imp.length === 3 && imp[0].Categoria == '1' && imp[0]['Altura total (m)'] === 12.5 && imp[0].latitude === -20.1401, `importou ${imp.length}; Categoria "Árvore"→${imp[0].Categoria}; altura ${imp[0]['Altura total (m)']}; coluna extra Bairro=${imp[0].Bairro}. Conferência: ${conf.split('\n').slice(1, 4).join(' / ')}`);
  // segurança
  await pa.goto(L.WEB + '#admin/seguranca'); await pa.waitForSelector('text=Registro de auditoria'); await pa.waitForTimeout(800);
  await pa.fill('.cartao input[placeholder^="email"]', 'coordenacao@neofloresta.com.br'); await pa.check('.cartao input[type=checkbox]'); await pa.click('button:has-text("Salvar")'); await pa.waitForTimeout(600);
  await pa.click('button:has-text("Fazer cópia agora")'); await pa.waitForTimeout(800);
  const audN = await pa.locator('.tab tr').count(); await foto(pa, 'seguranca'); const st = await L.stats();
  ok('S.1', audN > 5 && st.gatilhos === 1 && st.mails.length === 1, `auditoria com ${audN - 1} linhas; cópia diária ligada (${st.gatilhos} gatilho); email enviado: ${JSON.stringify(st.mails[0])}`);
  await pa.goto(L.WEB + '#admin/usuarios'); await pa.waitForSelector('text=+ Novo usuário'); await foto(pa, 'usuarios');
  await pa.goto(L.WEB + '#mapa'); await pa.waitForFunction(() => /de/.test((document.querySelector('.mapa-conta') || {}).textContent || ''), null, { timeout: 60000 }); await foto(pa, 'mapa-admin');

  const erros = [pc, pr, pp, pa].flatMap((p) => p.erros);
  console.log('ERROS DE PÁGINA', erros); console.log('TELAS', shots.join(' '));
  fs.writeFileSync('res-b47.json', JSON.stringify({ R, saidas, erros }, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
