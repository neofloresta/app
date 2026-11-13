// Demonstração: gera o projeto de teste com mais de 1.000 coletas, confere as telas da coordenação, do cliente e do parceiro, e apaga tudo
const fs = require('fs'); const path = require('path'); const os = require('os');
const tmp = path.join(os.tmpdir(), 'gs-demo-' + process.pid + '.gs');
fs.writeFileSync(tmp, fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../../apps-script/Demonstracao.gs'), 'utf8') +
  "\nconst __doPost = doPost; doPost = function (e) { const d = JSON.parse(e.postData.contents); try { if (d.acao === '__gerar') return json({ ok: true, r: gerarDemonstracao() }); if (d.acao === '__apagar') return json({ ok: true, r: apagarDemonstracao() }); } catch (x) { return json({ ok: false, erro: x.message }); } return __doPost(e); };\n");
process.env.GS = tmp;
const { chromium } = require('playwright'); const L = require('./lib');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const D = 'demonstracao';
(async () => {
  await L.subir(); await L.configurar();
  // camada de quadras de verdade no projeto modelo: a demonstração põe as árvores nas bordas das quadras
  const vm = require('vm'); const ctxq = { TextDecoder, console }; vm.createContext(ctxq); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctxq);
  const gj = JSON.parse(fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis.geojson', 'utf8'));
  const feicoes = gj.features.map((f) => ({ props: Object.fromEntries(Object.entries(f.properties).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])), aneis: f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat() }));
  if (!process.env.SEM_QUADRAS) await L.post('quadras_importar', { projeto: 'divinopolis', camada: JSON.stringify(ctxq.Quadras.compactar(feicoes, 'quadra', ['ruas'])) });
  const antes = (await L.post('listar', { projeto: 'divinopolis' })).linhas.length;
  const t0 = Date.now(); const g = (await L.post('__gerar', {})).r; const ms = Date.now() - t0;
  const de2 = await L.post('__gerar', {}).then(() => 'aceitou').catch((e) => e.message);
  ok('D.1', g.registros > 1000 && g.logins.length === 7 && /já existe/.test(de2) && g.comQuadras === !process.env.SEM_QUADRAS, `${g.registros} registros de ${g.de} a ${g.ate} em ${ms} ms, com quadras: ${g.comQuadras}; medição ${g.medicao}; gerar de novo: "${de2.slice(0, 60)}"`);
  const pr = await L.post('producao', { projeto: D, de: g.de, ate: g.ate }); const T = pr.totais || {};
  const times = (pr.indicacoes || []).map((x) => `${x.nome || x.quem}: ${x.arvores} árv., R$ ${x.valor}`).join('; ');
  ok('D.2', (pr.pessoas || []).length === 9 && T.premio > 0 && T.indicacao > 0 && T.valor > 0, `produção: ${(pr.pessoas || []).length} pessoas, por árvore R$ ${T.valor}, prêmio R$ ${T.premio}, times R$ ${T.indicacao} (${times}), a pagar R$ ${T.totalPagar}`);
  const pn = await L.post('painel', { projeto: D }); 
  ok('D.3', pn.total > 1000 && Object.keys(pn.porEquipe || pn.equipes || {}).length >= 0, `painel: total ${pn.total}, validados ${pn.validados}, chaves ${Object.keys(pn).slice(0, 14).join(',')}`);
  const cli = (await L.post('listar', { projeto: D }, 'demo-cliente', g.senha)).linhas; const vaza = cli.length ? Object.keys(cli[0]).filter((k) => /avaliador|auxiliar|usuario/.test(k)) : ['sem linhas'];
  ok('D.4', cli.length > 300 && cli.length < g.registros && !vaza.length, `cliente vê ${cli.length} registros validados, sem colunas das equipes (${vaza.join(',') || 'nenhuma'})`);
  const tm = await L.post('producao_time', { projeto: D }, 'demo-parceiro', g.senha);
  ok('D.5', JSON.stringify(tm).length > 200, `parceiro: ${JSON.stringify(tm).slice(0, 420)}`);
  const negado = await L.post('mapa', { projeto: 'divinopolis' }, 'demo-eq1', g.senha).then(() => 'liberado').catch((e) => e.message);
  ok('D.6', negado !== 'liberado', `acesso de teste não entra no projeto de verdade ("${negado.slice(0, 60)}")`);
  // telas
  const b = await chromium.launch(); const C = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const q = C.p;
  await L.logar(q, 'admin', L.senha()); await q.waitForTimeout(1500);
  await q.evaluate(async (id) => { const S = window.__app.S; const ps = S.projetos || []; const p = ps.find((x) => x.id === id); if (p && window.__app.trocarProjeto) await window.__app.trocarProjeto(p); }, D).catch(() => {});
  await q.screenshot({ path: 'bdemo-1-coord.png' });
  const E = await L.celular(b); const p = E.p; await L.logar(p, 'demo-eq1', g.senha); await p.waitForSelector('.bt-principal', { timeout: 30000 }); await p.waitForTimeout(4000); await p.screenshot({ path: 'bdemo-2-campo.png' });
  const X = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const c = X.p; await L.logar(c, 'demo-cliente', g.senha); await c.waitForTimeout(5000); await c.screenshot({ path: 'bdemo-3-cliente.png' });
  await c.goto(L.WEB + '#mapa'); await c.waitForTimeout(6000); await c.screenshot({ path: 'bdemo-4-cliente-mapa.png' });
  const Y = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const t = Y.p; await L.logar(t, 'demo-parceiro', g.senha); await t.waitForTimeout(5000); await t.screenshot({ path: 'bdemo-5-parceiro.png' }); const txtT = await t.locator('main').innerText().catch(() => '');
  ok('D.7', /Gap 1/.test(txtT) && /R\$/.test(txtT), `tela do parceiro: ${txtT.replace(/\s+/g, ' ').slice(0, 200)}`);
  const erros = [...q.erros, ...p.erros, ...c.erros, ...t.erros]; ok('D.8', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  if (!process.env.MANTER) {
    const a = (await L.post('__apagar', {})).r; const us = (await L.post('usuarios_listar', {})).usuarios.filter((u) => /^demo-/.test(u.login)).length; const pj = (await L.post('projetos_listar', {})).projetos.some((x) => x.id === D);
    const depois = (await L.post('listar', { projeto: 'divinopolis' })).linhas.length; const pe = (await L.post('pessoas_listar', {})).pessoas.filter((x) => /^Teste /.test(x.nome)).length;
    ok('D.9', a.projeto && a.usuarios === 7 && a.pessoas === 9 && !us && !pj && !pe && depois === antes, `apagar: projeto ${a.projeto}, ${a.usuarios} acessos, ${a.pessoas} pessoas; sobraram ${us} acessos, ${pe} pessoas, projeto ${pj}; o projeto de verdade segue com ${depois} registros (antes ${antes})`);
  }
  fs.writeFileSync(__dirname + '/res-bdemo.json', JSON.stringify(R, null, 1)); try { fs.unlinkSync(tmp); } catch (e) {}
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
