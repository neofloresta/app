// 2.18: conferência do ponto no satélite em toda árvore, satélite das quadras da equipe guardado no aparelho, espécie conferida para o coletor
process.env.COM_CONFERENCIA = '1';
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR4nGNkYPjPgA0wYRUdtBIAO4MBD0mtvJAAAAAASUVORK5CYII=', 'base64');
(async () => {
  await L.subir(); await L.configurar(); const vT = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1];
  await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  await L.post('usuario_salvar', { usuario_dados: { login: 'gap1', senha: 'gap112345', nome: 'gap1', perfil: 'coletor', projeto: PJ, equipe: 'GAP1', codigo: 'GAP', indicacao: 'Gap' } }); await L.post('aceitar_termo', { versao: vT }, 'gap1', 'gap112345');
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']);
  const centro = [-20.1436, -44.8908]; const cq = (x) => [(x.b[1] + x.b[3]) / 2, (x.b[0] + x.b[2]) / 2];
  const viz = cam.quadras.filter((x) => x.f && x.f.length >= 2 && Math.abs(cq(x)[0] - centro[0]) < 0.0035 && Math.abs(cq(x)[1] - centro[1]) < 0.0035).sort((a, b) => Math.hypot(cq(a)[0] - centro[0], cq(a)[1] - centro[1]) - Math.hypot(cq(b)[0] - centro[0], cq(b)[1] - centro[1])).slice(0, 8);
  await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(Object.assign({}, cam, { total: viz.length, quadras: viz })) });
  const p0 = (a, d, u, s) => L.post(a, Object.assign({ projeto: PJ }, d), u, s); const adm = (itens) => p0('quadras_marcar', { itens });
  await adm([{ tipo: 'quadra', numero: viz[0].n, equipe: 'GAP1' }, { tipo: 'quadra', numero: viz[1].n, equipe: 'GAP1' }]);
  const b = await chromium.launch(); let pedidos = 0;
  const abrir = async (login, senha, geo, semSW) => { const E = await L.celular(b, Object.assign(geo ? { geolocation: geo } : {}, semSW ? { serviceWorkers: 'block' } : {})); await E.ctx.route('https://server.arcgisonline.com/**', (r) => { pedidos++; return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }); }); await L.logar(E.p, login, senha); await E.p.waitForSelector('button.nova', { timeout: 30000 }); await E.p.waitForTimeout(1500); return E; };
  // 1. toda árvore: depois de o GPS marcar, abre o satélite já em cima do ponto e pergunta se é ali; um toque quando está certo
  const { p } = await abrir('div-1', 'equipe01');
  await p.click('button.nova'); await p.waitForSelector('#mp-confirmar', { timeout: 20000 }); await p.waitForTimeout(700);
  const tela = limpo(await p.locator('.folha.mp-conf').innerText()); const sat = await p.evaluate(() => [...document.querySelectorAll('.mp-mapa img.leaflet-tile')].some((i) => /World_Imagery/.test(i.src))); await p.screenshot({ path: __dirname + '/b2180-conferencia.png' });
  await p.click('#mp-confirmar'); await p.waitForSelector('.prog', { timeout: 15000 }); const r1 = await p.evaluate(() => { const r = window.__app.S.reg; return { lat: r.lat, manual: !!r.posManual, conf: !!r.pontoConferido }; });
  ok('G.1', /É aqui que a árvore está\?/.test(tela) && /Sim, é aqui/.test(tela) && /Marcar de novo/.test(tela) && sat && r1.lat != null && !r1.manual && r1.conf, `tela: "${tela.slice(0, 150)}"; fundo de satélite: ${sat}; confirmou sem mexer: ponto do GPS mantido (ajustado no mapa: ${r1.manual}), conferido: ${r1.conf}`);
  await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova'); await p.waitForTimeout(400);
  // 2. arrastou o mapa na conferência: vale o lugar escolhido, e o registro fica como ajustado no mapa, com a distância
  await p.click('button.nova'); await p.waitForSelector('#mp-confirmar', { timeout: 20000 }); await p.waitForTimeout(700);
  await p.mouse.move(206, 500); const cx = await p.locator('.mp-mapa').boundingBox(); await p.mouse.move(cx.x + cx.width / 2, cx.y + cx.height / 2); await p.mouse.down(); await p.mouse.move(cx.x + cx.width / 2 + 60, cx.y + cx.height / 2 + 40, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
  const aviso = limpo(await p.locator('.mp-dist').innerText()); await p.click('#mp-confirmar'); await p.waitForSelector('.prog', { timeout: 15000 }); const r2 = await p.evaluate(() => { const r = window.__app.S.reg; return { lat: r.lat, lon: r.lon, manual: !!r.posManual, dist: r.posDist }; });
  ok('G.2', /Você levou o alvo/.test(aviso) && r2.manual && r2.dist >= 1 && r2.dist < 60, `aviso: "${aviso}"; ajustado no mapa: ${r2.manual}, a ${r2.dist} m do ponto do GPS`);
  await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova'); await p.waitForTimeout(400);
  // 3. "Marcar de novo" volta para a marcação pelo GPS, sem abrir o cadastro
  await p.click('button.nova'); await p.waitForSelector('#mp-confirmar', { timeout: 20000 }); await p.waitForTimeout(500); await p.click('.folha.mp-conf button:has-text("Marcar de novo")'); await p.waitForTimeout(600);
  const volta = limpo(await p.locator('.folha.mp').first().innerText()); const semForm = !(await p.locator('.prog').count()); await p.waitForSelector('#mp-confirmar', { timeout: 20000 }); await p.click('#mp-confirmar'); await p.waitForSelector('.prog', { timeout: 15000 });
  ok('G.3', /Marcando o ponto/.test(volta) && semForm, `depois de "Marcar de novo": "${volta.slice(0, 80)}"; cadastro aberto antes da hora: ${!semForm}; a conferência voltou e o cadastro abriu ao confirmar`);
  await A.excluir(p).catch(() => {});
  // 4. GPS com erro acima de 4 m: o app não marca sozinho de imediato; ao marcar, a conferência avisa do erro
  const E9 = await abrir('div-2', 'equipe02', { latitude: centro[0], longitude: centro[1], accuracy: 9 }); const p9 = E9.p;
  await p9.click('button.nova'); await p9.waitForSelector('.folha.mp'); await p9.waitForTimeout(5000); const sozinho = await p9.locator('#mp-confirmar').count(); const meta = limpo(await p9.locator('.mp-meta').innerText());
  await p9.click('.folha.mp button:has-text("Marcar agora")'); await p9.waitForSelector('#mp-confirmar', { timeout: 10000 }); await p9.waitForTimeout(400); const av9 = limpo(await p9.locator('.folha.mp-conf .mp-orienta').innerText()); const cls9 = await p9.locator('.folha.mp-conf .mp-orienta.ruim').count();
  ok('G.4', sozinho === 0 && /até 4 m/.test(meta) && /GPS com erro de ±9/.test(av9) && cls9 === 1, `com ±9 m, marcou sozinho em 5 s: ${sozinho === 1}; meta na tela: "${meta}"; aviso na conferência: "${av9.slice(0, 110)}"`);
  await E9.ctx.close();
  // 5. satélite das quadras da equipe: baixado e guardado quando a quadra é da equipe; apagado quando ela sai
  // (neste teste o service worker fica desligado nesta página: o Playwright não intercepta pedidos feitos por ele, e a internet de verdade não existe aqui)
  const G = await abrir('gap1', 'gap112345', { latitude: cq(viz[0])[0], longitude: cq(viz[0])[1], accuracy: 3 }, true); const pg = G.p;
  await pg.goto(L.WEB + '#mapa'); await pg.waitForSelector('.qd-reservas:not(.oculto)', { timeout: 30000 });
  await pg.waitForFunction(() => /Satélite guardado para uso sem internet: 2 de 2/.test((document.querySelector('.qd-reservas') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const chip = limpo(await pg.locator('.qd-reservas').innerText()); const g1 = await pg.evaluate(async () => { const c = await caches.open('mapa-fundo'); const ks = (await c.keys()).map((k) => k.url).filter((u) => /World_Imagery/.test(u)); const est = await window.__app.Store.get('sat:divinopolis:gap1'); return { n: ks.length, z: [...new Set(ks.map((u) => u.split('/tile/')[1].split('/')[0]))].sort().join(','), quadras: Object.keys(est || {}).length, urls: Object.values(est || {}).reduce((a, e) => a + e.urls.length, 0) }; });
  // sem internet, a imagem guardada atende o mapa
  const off = await pg.evaluate(async () => { const c = await caches.open('mapa-fundo'); const k = (await c.keys()).find((x) => /World_Imagery/.test(x.url)); const r = k && await c.match(k.url); return !!(r && r.ok && (await r.blob()).size > 0); }); // é deste mesmo lugar que o service worker serve a imagem quando não há internet
  await adm([{ tipo: 'quadra', numero: viz[1].n, equipe: '' }]); await pg.evaluate(async () => { window.__app.S.qdSitEm = null; await window.__app.carregarSitQd(true); await window.__app.Satelite.sincronizar(); }); await pg.waitForTimeout(500);
  const g2 = await pg.evaluate(async () => { const c = await caches.open('mapa-fundo'); const est = await window.__app.Store.get('sat:divinopolis:gap1'); return { n: (await c.keys()).filter((k) => /World_Imagery/.test(k.url)).length, quadras: Object.keys(est || {}).length, st: window.__app.Satelite.estado }; });
  ok('G.5', /Satélite guardado para uso sem internet: 2 de 2/.test(chip) && g1.quadras === 2 && g1.n >= 4 && g1.n <= 120 && g1.z === '17,18' && off && g2.quadras === 1 && g2.n < g1.n && g2.st.tot === 1 && g2.st.ok === 1, `aviso no mapa: "${chip.slice(-70)}"; guardadas ${g1.n} imagens (zooms ${g1.z}) de ${g1.quadras} quadras; imagem guardada legível, no lugar de onde o app a serve sem internet: ${off}; quadra devolvida: ficaram ${g2.n} imagens de ${g2.quadras} quadra`);
  // 6. espécie conferida pela coordenação aparece na lista do coletor
  await pg.goto(L.WEB + '#lista'); await pg.waitForSelector('button.nova'); await pg.evaluate(() => { new MutationObserver(() => { const bt = document.getElementById('mp-confirmar'); if (!bt || bt.__feito) return; bt.__feito = true; setTimeout(() => bt.click(), 450); }).observe(document, { childList: true, subtree: true }); }); await A.arvoreCompleta(pg).catch((e) => console.log('arvore', e.message)); await pg.waitForSelector('button.nova', { timeout: 20000 }); await pg.waitForTimeout(4000);
  const lin = (await p0('listar', {})).linhas.find((l) => l.usuario === 'gap1'); let conf = '';
  if (lin) { await p0('registro', { linha: Object.assign({}, lin, { Especie: 'Cenostigma pluviosum', atualizado_em: new Date().toISOString() }) }); await p0('validar', { itens: [{ uuid: lin.uuid, estado: 'Validado' }] }); await pg.reload(); await pg.waitForSelector('button.nova', { timeout: 30000 }); await pg.waitForTimeout(1500); await pg.evaluate(async () => { await window.__app.atualizarSituacao(); }); await pg.waitForTimeout(1200); await pg.goto(L.WEB + '#lista'); await pg.waitForTimeout(800); conf = limpo(await pg.locator('.reg .esp-conf').first().innerText().catch(() => '')); }
  ok('G.6', lin && /Espécie conferida: Cenostigma pluviosum/.test(conf), `coletor informou "${lin && lin.Especie}"; depois de a coordenação corrigir e validar, a lista mostra: "${conf}"`);
  ok('G.7', !p.erros.length && !pg.erros.length, p.erros.concat(pg.erros).join(' | ') || 'sem erros de JavaScript');
  const f = Object.values(R).filter((x) => !x.passou).length; console.log(f ? f + ' FALHA(S)' : 'TUDO OK'); await b.close(); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
