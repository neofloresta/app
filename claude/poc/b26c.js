// 2.6: turno com trajeto (começar, gravar, enviar, encerrar) e o trajeto no mapa e no "Hoje no campo" da coordenação
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
(async () => {
  await L.subir(); await L.configurar();
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', trajeto: 'sim' } });
  await L.post('usuario_salvar', { usuario_dados: { login: 'rev-1', senha: 'revisor01', nome: 'Coordenação', perfil: 'revisor', projeto: 'divinopolis', equipe: 'Coordenação', codigo: 'RV' } });
  await L.post('aceitar_termo', { versao: 'teste' }, 'rev-1', 'revisor01');
  const b = await chromium.launch(); process.env.COM_DIA = '1'; const E = await L.celular(b); const p = E.p;
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.comecar-dia'); await p.waitForTimeout(1000);
  // equipe sem trajeto liberado não vê o botão
  const E2 = await L.celular(b); delete process.env.COM_DIA; await L.logar(E2.p, 'div-2', 'equipe02'); await E2.p.waitForSelector('button.comecar-dia'); await E2.p.click('button.comecar-dia'); await E2.p.waitForSelector('button.nova'); await E2.p.waitForTimeout(800);
  const semBt = await E2.p.locator('.pill-dia.trajeto').count(); const diaE2 = await E2.p.locator('.pill-dia').count();
  const bt = await p.locator('button.comecar-dia').count();
  ok('J.1', bt === 1 && semBt === 0 && diaE2 === 1, `as duas equipes começam o dia com um toque; equipe sem trajeto liberado fica sem a marca de trajeto (${semBt})`);
  await p.click('button.comecar-dia'); await p.waitForSelector('button.nova'); await p.waitForTimeout(500);
  const selo = await p.locator('.pill-dia.trajeto').innerText().catch(() => '');
  ok('J.2', /Turno aberto/.test(selo), `etiqueta do dia com trajeto ligado: "${selo.replace(/\s+/g, ' ')}"`);
  // anda de carro (~12 m/s) e depois fica parado
  let lat = -20.1436, lon = -44.8908;
  for (let i = 0; i < 12; i++) { lat += 0.0001; await E.ctx.setGeolocation({ latitude: lat, longitude: lon, accuracy: 5 }); await p.waitForTimeout(900); }
  await p.waitForTimeout(4000); // o turno grava no aparelho 3 s depois do último ponto
  const nPts = await p.evaluate(async () => { const st = await window.__app.Store.get('turno:div-1:divinopolis'); return st ? st.pts.length : -1; });
  await p.click('.pill-dia'); await p.click('.folha button:has-text("Encerrar o turno")'); await p.waitForTimeout(2500);
  const tr = await L.post('trajetos', { projeto: 'divinopolis' }, 'rev-1', 'revisor01');
  const t0 = (tr.trechos || [])[0] || {};
  const depois = await p.locator('button.comecar-dia').count();
  ok('J.3', nPts >= 8 && tr.trechos.length >= 1 && t0.equipe === 'Equipe 1' && t0.km_carro > 0.05 && /^[\x3f-\x7e]+$/.test(t0.pontos), `${nPts} pontos gravados; ${tr.trechos.length} trecho(s) no servidor, equipe ${t0.equipe}, ${t0.km_carro} km de carro, ${t0.km_pe} km a pé; dia encerrado volta a mostrar "Começar o turno" (${depois})`);
  // reenvio do mesmo trecho não duplica
  const rep = await L.post('trajeto_salvar', { projeto: 'divinopolis', trecho: { id: t0.id, dia: t0.dia, pontos: t0.pontos } }, 'div-1', 'equipe01');
  const tr2 = await L.post('trajetos', { projeto: 'divinopolis' }, 'rev-1', 'revisor01');
  ok('J.4', rep.repetido && tr2.trechos.length === tr.trechos.length, `reenvio do mesmo trecho ignorado (${tr2.trechos.length} trecho(s))`);
  const negado = await L.post('trajetos', { projeto: 'divinopolis' }, 'div-1', 'equipe01').then(() => 'liberado').catch((e) => e.message);
  ok('J.5', negado !== 'liberado', `equipe de campo não lê o trajeto das outras: "${negado}"`);
  // coordenação: mapa e Hoje no campo
  const C = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const q = C.p;
  await L.logar(q, 'rev-1', 'revisor01'); await q.waitForSelector('button.nova', { timeout: 20000 });
  await q.goto(L.WEB + '#mapa'); await q.waitForSelector('.chip-rapido:has-text("Trajetos")', { timeout: 20000 }); await q.waitForTimeout(800);
  await q.click('.chip-rapido:has-text("Trajetos")'); await q.waitForTimeout(2500);
  const linhas = await q.evaluate(() => { let n = 0; window.__app.mapa.eachLayer((l) => { if (l.options && l.options.color === '#D81B60' && l.getLatLngs) n++; }); return n; });
  await q.screenshot({ path: 'b26c-trajeto.png' });
  ok('J.6', linhas >= 1, `atalho Trajetos desenha ${linhas} linha(s) do dia no mapa`);
  await q.goto(L.WEB + '#hoje'); await q.waitForSelector('.dias-chips', { timeout: 20000 }); await q.waitForTimeout(2500);
  const card = await q.locator('.hoje-eq:has-text("Equipe 1")').innerText().catch(() => '');
  ok('J.7', /Trajeto/.test(card) && /km de carro/.test(card), `Hoje no campo: ${card.replace(/\s+/g, ' ').slice(0, 220)}`);
  await p.goto(L.WEB + '#sobre'); await p.waitForTimeout(500); const sobre = await p.locator('main').innerText();
  ok('J.8', /Encerrar o turno/.test(sobre) && /trajeto/i.test(sobre), 'o termo da equipe explica o trajeto do turno');
  const erros = [...p.erros, ...E2.p.erros, ...q.erros]; ok('J.9', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b26c.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
