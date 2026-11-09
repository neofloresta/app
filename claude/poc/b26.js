// 2.6: trava de etapas, espécie por semelhança e "Sem ID", marcação do ponto, fotos só no Wi-Fi, conferência no servidor,
// tela "Hoje no campo" da coordenação, preferências e modo Sol
const { chromium } = require('playwright'); const L = require('./lib'); const A = require('./acoes'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const regs = (p) => p.evaluate(async () => Store.todosRegistros());
const toast = (p) => p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
(async () => {
  await L.subir(); await L.configurar();
  // registros de hoje e de ontem com tempos conhecidos (Equipe 1: 5 hoje, 4 min cada, um a cada 6 min; Equipe 2: 3 ontem)
  const hoje = new Date(); hoje.setHours(9, 0, 0, 0); const ontem = new Date(hoje.getTime() - 864e5);
  const cab = [...L.cabecalho(), 'concluido_em', 'validacao'];
  const base = L.gerar(8); const linhas = base.map((l, i) => {
    const eq1 = i < 5; const t0 = new Date((eq1 ? hoje : ontem).getTime() + (eq1 ? i : i - 5) * 6 * 60000);
    return Object.assign(l, { uuid: 'b26-' + i, equipe: eq1 ? 'Equipe 1' : 'Equipe 2', usuario: eq1 ? 'div-1' : 'div-2', criado_em: t0.toISOString(), concluido_em: new Date(t0.getTime() + 4 * 60000).toISOString(), atualizado_em: t0.toISOString(), precisao_gps_m: 4, validacao: i === 1 ? 'Devolvido' : 'Pendente' });
  });
  await fetch(L.MOCK + '__seed', { method: 'POST', body: JSON.stringify({ projeto: 'divinopolis', cab, linhas }) }).then((r) => r.json());
  await L.post('usuario_salvar', { usuario_dados: { login: 'rev-1', senha: 'revisor01', nome: 'Coordenação', perfil: 'revisor', projeto: 'divinopolis', equipe: 'Coordenação', codigo: 'RV' } });
  await L.post('aceitar_termo', { versao: 'teste' }, 'rev-1', 'revisor01');

  const b = await chromium.launch(); const { p, ctx } = await L.celular(b);
  await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);

  // 1. tela de marcação do ponto: aparece ao tocar em Nova árvore e trava sozinha com erro estável
  const t0 = Date.now(); await p.click('button.nova'); const viuTela = await p.waitForSelector('.mp-veu', { timeout: 5000 }).then(() => true).catch(() => false);
  const orienta = viuTela ? await p.locator('.mp-orienta').innerText() : '';
  await p.waitForSelector('.prog', { timeout: 30000 }); const seg = (Date.now() - t0) / 1000;
  let r = (await regs(p)).find((x) => x.status === 'rascunho');
  ok('T.1', viuTela && /fora da copa/.test(orienta) && r && r.prec === 4 && r.gpsAuto === false && r.leiturasGps >= 3 && seg >= 3, `tela de marcação=${viuTela}; travou sozinha em ${seg.toFixed(1)} s com ±${r && r.prec} m (${r && r.leiturasGps} leituras); orientação "${orienta.slice(0, 50)}..."`);
  // o ponto não acompanha o celular depois de marcado
  await ctx.setGeolocation({ latitude: -20.15, longitude: -44.9, accuracy: 3 }); await p.waitForTimeout(2500);
  r = await p.evaluate(async () => Store.registro(window.__app.S.reg.uuid));
  ok('T.2', Math.abs(r.lat - -20.1436) < 1e-4, `celular andou 700 m depois de marcar; ponto continua em ${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`);
  await ctx.setGeolocation({ latitude: -20.1436, longitude: -44.8908, accuracy: 4 });

  // 2. trava de etapas: sem mexer passa livre (treino); depois de preencher, segura e diz o que falta
  const telaAntes = await p.locator('.prog-topo').innerText();
  await A.aba(p, 'Meio'); const livre = await p.locator('[data-campo="Conflitos no raio de 2 m"]').count();
  await A.aba(p, 'Identificação'); await A.op(p, 'Categoria', 'Árvore'); await p.waitForTimeout(150);
  await A.aba(p, 'Meio'); await p.waitForTimeout(300); const msg = await toast(p); const noMeio = await p.locator('[data-campo="Conflitos no raio de 2 m"]').count();
  ok('T.3', livre === 1 && noMeio === 0 && /Complete .* antes de seguir. Falta:/.test(msg), `sem preencher foi até Meio (${livre}); depois de marcar Categoria ficou travado com "${msg}"`);

  // 3. espécie por semelhança, texto livre e "Sem ID"
  await A.op(p, 'Local do registro', 'Via pública'); await A.foto(p, 'Foto 1'); await A.aba(p, 'Indivíduo'); await A.op(p, 'Situacao', 'Viva');
  const inp = A.campo(p, 'Especie').locator('input').first(); await inp.click(); await inp.pressSequentially('handroantus', { delay: 60 }); await p.waitForTimeout(250);
  const sugs = await p.locator('[data-campo="Especie"] .esp-lista button').allInnerTexts(); const foco = await p.evaluate(() => document.activeElement === document.querySelector('[data-campo="Especie"] input'));
  ok('T.4', sugs.some((s) => /Handroanthus/.test(s)) && foco, `"handroantus" (com erro) sugere: ${sugs.slice(0, 3).join(' / ')}; teclado continua aberto=${foco}`);
  await inp.fill(''); await inp.pressSequentially('Ipê da praça', { delay: 30 }); await p.locator('[data-campo="CAP (cm)"] input').first().click(); await p.waitForTimeout(300);
  const avisoLivre = await A.campo(p, 'Especie').innerText();
  const semId = p.locator('[data-campo="Especie"] .bt-semid'); const temSemId = await semId.count(); if (temSemId) await semId.click(); await p.waitForTimeout(400);
  const vEsp = await inp.inputValue(); const fotosId = await p.locator('[data-campo^="Foto folha"], [data-campo="Foto ramo filotaxia"], [data-campo="Foto tronco detalhe"]').count();
  ok('T.5', /fora da lista|não está na lista|texto livre/i.test(avisoLivre) && temSemId && /Não identificada/.test(vEsp) && fotosId === 4, `texto livre avisado ao sair do campo; botão Sem ID=${temSemId} marcou "${vEsp}" e mostrou ${fotosId} fotos de identificação`);
  await A.excluir(p).catch(() => {}); await p.waitForSelector('button.nova');

  // 4. fotos só no Wi-Fi: no 4G o cadastro vai, a foto espera
  await p.evaluate(() => { Object.defineProperty(navigator, 'connection', { configurable: true, value: { type: 'cellular', effectiveType: '4g', addEventListener() {} } }); });
  let f = await A.arvoreCompleta(p, { fotos: 1 }); await p.waitForSelector('button.nova'); await p.evaluate(() => window.__app.sincronizar(true)); await p.waitForTimeout(2500);
  let rs = (await regs(p)).filter((x) => x.status !== 'rascunho'); let r1 = rs[0];
  const syncTxt = await p.locator('.sync').innerText(); const fotoNoServ = Object.values(r1.fotos || {}).some((x) => x && x.enviado);
  ok('T.6', f.length === 0 && r1.status === 'enviado' && !fotoNoServ && /Wi-Fi/i.test(syncTxt), `no 4G: registro ${r1.status}, foto enviada=${fotoNoServ}, selo "${syncTxt.replace(/\s+/g, ' ')}"`);
  await p.evaluate(() => { Object.defineProperty(navigator, 'connection', { configurable: true, value: { type: 'wifi', addEventListener() {} } }); }); await p.evaluate(() => window.__app.sincronizar(true)); await p.waitForTimeout(3000);
  r1 = await p.evaluate(async (u) => Store.registro(u), r1.uuid); const fotoDepois = Object.values(r1.fotos || {}).filter((x) => x && x.chave).every((x) => x.enviado);
  const blob = await p.evaluate(async (u) => { const r = await Store.registro(u); const k = Object.values(r.fotos).find((x) => x && x.chave).chave; const bl = await Store.foto(k).catch(() => null); return bl ? bl.size || (bl.blob && bl.blob.size) || 1 : 0; }, r1.uuid).catch(() => -1);
  ok('T.7', fotoDepois && blob !== 0, `no Wi-Fi a foto subiu (${fotoDepois}) e continua guardada no celular (${blob} bytes)`);

  // 5. conferência: o servidor diz que não achou o registro, o app manda de novo
  let falsos = 0; await p.route(L.MOCK + '**', async (rt) => { const d = rt.request().postData() || ''; if (/"acao":"conferir"/.test(d) && falsos < 1) { falsos++; return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, achados: {} }) }); } return rt.continue(); });
  await fetch(L.MOCK + '__chamadas'); await p.evaluate(() => { window.__app.S.conferidoEm = 0; return window.__app.conferirEnvio(); }); await p.waitForTimeout(4000);
  const cham = await (await fetch(L.MOCK + '__chamadas')).json(); const reenv = cham.filter((c) => /salvar|enviar|registro/.test(c.acao || c)).length;
  await p.evaluate(() => { window.__app.S.conferidoEm = 0; return window.__app.conferirEnvio(); }); await p.waitForTimeout(1500);
  r1 = await p.evaluate(async (u) => Store.registro(u), r1.uuid);
  ok('T.8', falsos === 1 && reenv >= 1 && r1.status === 'enviado' && r1.conferido === true, `servidor "perdeu" o registro: app reenviou (${reenv} chamada(s)) e na conferência seguinte ficou confirmado=${r1.conferido}`);
  await p.unroute(L.MOCK + '**');

  // 6. preferências no menu e modo Sol
  await p.click('.topo .ic[aria-label="Menu"]'); await p.waitForTimeout(300); const temPref = await p.locator('.menu-it:has-text("Preferências")').count();
  if (temPref) { await p.click('.menu-it:has-text("Preferências")'); await p.waitForTimeout(500); }
  const chSol = p.locator('label:has-text("Modo Sol") input, .chave:has-text("Modo Sol") input').first(); if (await chSol.count()) await chSol.check({ force: true }); await p.waitForTimeout(300);
  const sol = await p.evaluate(() => document.documentElement.classList.contains('sol')); await p.reload(); await p.waitForTimeout(1500); const solDepois = await p.evaluate(() => document.documentElement.classList.contains('sol'));
  await p.screenshot({ path: 'b26-sol.png' });
  ok('T.9', temPref === 1 && sol && solDepois, `menu tem Preferências=${temPref}; modo Sol ligado=${sol} e continua depois de reabrir=${solDepois}`);
  const errosCol = p.erros.slice();

  // 7. tela Hoje no campo (coordenação)
  const c2 = await L.celular(b); const q = c2.p; await L.logar(q, 'rev-1', 'revisor01'); await q.waitForSelector('button.nova, .painel', { timeout: 20000 }); await q.waitForTimeout(800);
  const atalho = await q.locator('.coord-atalhos button:has-text("Hoje no campo")').count();
  await q.goto(L.WEB + '#hoje'); await q.waitForSelector('.dias-chips', { timeout: 20000 }); await q.waitForTimeout(500);
  const chips = await q.locator('.dia-chip').allInnerTexts(); const cardE1 = await q.locator('.hoje-eq:has-text("Equipe 1")').innerText().catch(() => '');
  await q.screenshot({ path: 'b26-hoje.png', fullPage: true });
  ok('T.10', atalho === 1 && /Hoje/.test(chips[0]) && /Ontem/.test(chips.join(' ')) && /\b5\b/.test(cardE1) && /4 min/.test(cardE1) && /6 min/.test(cardE1) && /Devolvidos\s*1/.test(cardE1), `atalho na tela inicial=${atalho}; dias: ${chips.map((c) => c.replace(/\s+/g, ' ')).join(' | ')}; Equipe 1: ${cardE1.replace(/\s+/g, ' ')}`);
  await q.locator('.dia-chip:has-text("Ontem")').click(); await q.waitForTimeout(500); const cardE2 = await q.locator('.hoje-eq:has-text("Equipe 2")').innerText().catch(() => ''); const e1Ontem = await q.locator('.hoje-eq:has-text("Equipe 1")').count();
  ok('T.11', /\b3\b/.test(cardE2) && e1Ontem === 0, `ontem com um toque: Equipe 2 "${cardE2.replace(/\s+/g, ' ').slice(0, 80)}"; Equipe 1 não aparece (${e1Ontem})`);
  await q.locator('.hoje-eq:has-text("Equipe 2") button:has-text("mapa")').click(); await q.waitForTimeout(1500);
  const filt = await q.evaluate(() => [...document.querySelectorAll('.mapa-sel select, .mapa-sel input')].map((e) => e.value));
  const ontemD = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  ok('T.12', filt.includes('Equipe 2') && filt.includes(ontemD), `"Ver os pontos no mapa" abriu filtrado: ${filt.filter(Boolean).join(', ')}`);
  await q.goto(L.WEB + '#painel'); await q.waitForSelector('.kpis', { timeout: 20000 }); await q.waitForTimeout(500); const kTempo = await q.locator('.kpi:has-text("Tempo por amostra")').innerText().catch(() => '');
  ok('T.13', /4 min/.test(kTempo) && /6 min/.test(kTempo), `painel mostra "${kTempo.replace(/\s+/g, ' ')}"`);
  // cliente não recebe dados das equipes
  await L.post('usuario_salvar', { usuario_dados: { login: 'cli-1', senha: 'cliente01', nome: 'Prefeitura', perfil: 'cliente', projeto: 'divinopolis' } });
  const pc = await L.post('painel', { projeto: 'divinopolis' }, 'cli-1', 'cliente01').catch((e) => ({ erro: e.message }));
  ok('T.14', !pc.erro && !pc.diario && !(pc.tempos || {}).porEquipe, `painel do cliente sem dia por equipe (${!pc.diario}) e sem tempo por equipe (${!(pc.tempos || {}).porEquipe})${pc.erro ? ' erro: ' + pc.erro : ''}`);
  const erros = [...errosCol, ...q.erros]; ok('T.15', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b26.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
