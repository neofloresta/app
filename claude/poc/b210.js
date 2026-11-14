// 2.10 nas telas: lista de projetos da coordenação, times, usuário por perfil, turno do parceiro, parada por chuva, Minha produção, auxiliar, produção e painéis dos outros perfis
process.env.COM_DIA = '1'; process.env.COM_PROJETOS = '1';
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const hoje = new Date(); const seg0 = new Date(hoje); seg0.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7) - 7);
const diaN = (k) => { const d = new Date(seg0); d.setDate(seg0.getDate() + k); return d.toISOString().slice(0, 10); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR4nGNkYPjPgA0wYRUdtBIAO4MBD0mtvJAAAAAASUVORK5CYII=', 'base64');
(async () => {
  await L.subir(); await L.configurar();
  await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } }); await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const nova = async (pe) => (await L.post('pessoa_salvar', { pessoa: Object.assign({ projeto: PJ }, pe) })).id;
  const ana = await nova({ nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 1', vinculo: 'CLT', time: 'Neofloresta' }); const caio = await nova({ nome: 'Caio Reis', funcao: 'Auxiliar', vinculo: 'CLT', time: 'Neofloresta' });
  const bia = await nova({ nome: 'Bia Gap', funcao: 'Avaliador', registro: 'CRBio 2', vinculo: 'Parceiro', time: 'Gap' }); const leo = await nova({ nome: 'Leo Gap', funcao: 'Auxiliar', vinculo: 'Parceiro', time: 'Gap' }); await nova({ nome: 'Zé Outro', funcao: 'Auxiliar', vinculo: 'Parceiro', time: 'Outro' });
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', perfil: 'coletor', avaliador_id: ana, auxiliar_id: caio } }); await L.post('usuario_salvar', { usuario_dados: { login: 'div-2', perfil: 'coletor', avaliador_id: bia } });
  await L.post('usuario_salvar', { usuario_dados: { login: 'pref', senha: 'prefeitura1', nome: 'Prefeitura', perfil: 'cliente', projeto: PJ } });
  await L.post('usuario_salvar', { usuario_dados: { login: 'caio', senha: 'auxiliar01', perfil: 'auxiliar', projeto: PJ, auxiliar_id: caio } });
  const enviar = async (u, s, k, d, extra, equipe) => { const uuid = `${u}-${d}-${k}`; const t = `${d}T${String(11 + Math.floor(k / 30)).padStart(2, '0')}:${String((k % 30) * 2).padStart(2, '0')}:00.000Z`;
    await L.post('registro', { projeto: PJ, linha: Object.assign({ uuid, projeto: PJ, equipe, criado_em: t, atualizado_em: t, concluido_em: t, latitude: -20.15, longitude: -44.85, 'Altura total (m)': 5, 'Foto 1': 'DCIM/x.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', Codigo: 'C' + k }, extra) }, u, s); return uuid; };
  const ids = []; for (const k of [0, 1]) for (let i = 0; i < 104; i++) ids.push(await enviar('div-1', 'equipe01', i, diaN(k), {}, 'Equipe 1'));
  for (let i = 0; i < 5; i++) ids.push(await enviar('div-2', 'equipe02', i, diaN(1), { auxiliar_id: leo }, 'Equipe 2'));
  await L.post('validar', { projeto: PJ, itens: ids.map((uuid) => ({ uuid, estado: 'Validado' })) });
  const b = await chromium.launch(); const pc = { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false };
  const menu = async (p, txt) => { await p.click('button[aria-label="Menu"]'); await p.waitForSelector('.menu-lateral'); await p.click(`.menu-lateral button:has-text("${txt}")`); await p.waitForTimeout(500); };

  // 1. coordenação: entra na lista de projetos e escolhe
  const A = await L.celular(b, pc); const q = A.p; await L.logar(q, 'admin', L.senha()); await q.waitForSelector('.proj-lista', { timeout: 20000 });
  const cards = await q.locator('.proj-card').allInnerTexts(); await q.click('.proj-card:has-text("Carmo do Rio Claro")'); await q.waitForTimeout(900); const t1 = limpo(await q.locator('.topo').innerText());
  await menu(q, 'Trocar de projeto'); await q.waitForSelector('.proj-lista'); await q.click('.proj-card:has-text("PMAU Divinópolis")'); await q.waitForTimeout(900); const t2 = limpo(await q.locator('.topo').innerText());
  ok('T.1', cards.length === 2 && /Carmo/.test(t1) && /Divinópolis/.test(t2), `coordenação entra na lista com ${cards.length} projetos; abre "${t1.slice(0, 30)}", volta à lista pelo menu e abre "${t2.slice(0, 30)}"`);
  // 2. times
  await q.goto(L.WEB + '#admin/times'); await q.waitForSelector('.us-card', { timeout: 20000 }); const tm0 = limpo(await q.locator('main >> nth=-1').innerText());
  await q.click('button:has-text("+ Novo time")'); await q.fill('.folha input[placeholder="ex.: Gap"]', 'Florestal Jr'); await q.click('.folha button:has-text("Salvar")'); await q.waitForSelector('.us-card:has-text("Florestal Jr")', { timeout: 10000 });
  const nT = await q.locator('.us-card').count(); const gapCard = limpo(await q.locator('.us-card:has-text("Gap")').first().innerText());
  ok('T.2', /Neofloresta/.test(tm0) && nT === 3 && /1 avaliador\(es\) e 1 auxiliar\(es\)/.test(gapCard) && /Painel do parceiro/.test(gapCard), `aba Times com ${nT} times depois de criar um pela tela; cartão do Gap: "${gapCard.slice(0, 110)}"`);
  // 3. usuário por perfil
  await q.goto(L.WEB + '#admin/usuarios'); await q.waitForSelector('button:has-text("+ Novo usuário")', { timeout: 20000 }); await q.click('button:has-text("+ Novo usuário")'); await q.waitForSelector('.folha select');
  const visiveis = async () => limpo((await q.locator('.folha label.rot:visible').allInnerTexts()).join(' | '));
  const vCol = await visiveis(); await q.selectOption('.folha select >> nth=0', 'cliente'); const vCli = await visiveis(); await q.selectOption('.folha select >> nth=0', 'time'); const vTime = await visiveis(); const opT = await q.locator('.folha .campo:has-text("Time parceiro deste acesso") select option').allInnerTexts();
  await q.selectOption('.folha select >> nth=0', 'auxiliar'); const vAux = await visiveis();
  await q.fill('.folha input[placeholder="ex.: div-1"]', 'leo'); await q.fill('.folha input[autocomplete="new-password"]', 'auxiliar02'); await q.click('.folha button:has-text("Salvar")'); await q.waitForTimeout(700);
  const semPessoa = limpo(await q.locator('.toast').first().innerText().catch(() => '')); await q.waitForSelector('.folha select');
  await q.selectOption('.folha .campo:has-text("Quem é este auxiliar") select', { label: 'Leo Gap (auxiliar, Parceiro)' }); await q.click('.folha button:has-text("Salvar")'); await q.waitForSelector('.us-card:has-text("leo")', { timeout: 10000 });
  const cLeo = limpo(await q.locator('.us-card:has-text("leo")').first().innerText());
  await q.click('.us-card:has-text("div-2") button:has-text("Editar")'); await q.waitForSelector('.folha select'); const dDupla = limpo(await q.locator('.folha .campo:has-text("Dupla deste acesso")').innerText()); const axVis = await q.locator('.folha .campo:has-text("Dupla deste acesso") small:has-text("Auxiliar"):visible').count(); await q.click('.folha button:has-text("Cancelar")');
  ok('T.3', /Código da equipe/.test(vCol) && /Como mede a copa/.test(vCol) && !/Código|copa|Dupla|Equipe/.test(vCli) && /Nome/.test(vCli) && /Time parceiro/.test(vTime) && !/copa|Dupla/.test(vTime) && opT.includes('Gap') && !opT.includes('Neofloresta') && /Quem é este auxiliar/.test(vAux) && !/Nome|copa|Código/.test(vAux) && /Escolha quem é este auxiliar/.test(semPessoa) && /Auxiliar: Leo Gap/.test(cLeo) && /Time do avaliador: Gap/.test(dDupla) && /começo de turno/.test(dDupla) && axVis === 0,
    `cliente vê: ${vCli}; parceiro escolhe o time (${opT.filter(Boolean).join(', ')}); auxiliar vê: ${vAux}; sem pessoa: "${semPessoa}"; cartão: "${cLeo.slice(0, 60)}"; dupla de time parceiro sem auxiliar fixo`);
  for (const [u, s] of [['caio', 'auxiliar01']]) await L.post('aceitar_termo', { versao: (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1] }, u, s);
  // 4. produção da coordenação
  await q.evaluate(([a, c]) => { window.__app.S.perProd = [a, c]; }, [diaN(0), diaN(6)]); await q.goto(L.WEB + '#producao'); await q.waitForSelector('.kpis', { timeout: 20000 });
  const kp = limpo(await q.locator('.kpis').innerText()); const abas = (await q.locator('.subabas >> nth=-1').locator('button').allInnerTexts()).join(' | ');
  await q.click('.subabas button:has-text("Prêmio por semana")'); const sm = limpo(await q.locator('.tab').first().innerText());
  await q.click('.subabas button:has-text("Gestão da equipe")'); const jr = limpo(await q.locator('main').innerText());
  await q.click('.subabas button:has-text("Dias e chuva")'); await q.selectOption(`select[aria-label^="Situação do dia ${diaN(1).split('-').reverse().join('/')}"]`, 'Parcial'); await q.waitForSelector('.kpis', { timeout: 20000 }); await q.waitForTimeout(800);
  await q.click('.subabas button:has-text("Prêmio por semana")'); const sm2 = limpo(await q.locator('.tab').first().innerText()); await q.screenshot({ path: 'b210-producao.png', fullPage: true });
  // 2 dias com 104: média 104, superação 4 x 2 = 8 registros: avaliador 62,50 + 20 = 82,50; com a terça parcial, 1 dia: 62,50 + 10 = 72,50
  ok('T.4', /A pagar na medição/.test(kp) && /Prêmio com carteira/.test(kp) && !/contrato|75\.604|orçamento/i.test(kp + jr) && /Prêmio por semana/.test(abas) && /Gestão da equipe/.test(abas) && /R\$\s?82,50/.test(sm) && /Apurada/.test(sm) && /só a coordenação vê/.test(jr) && /Horas em campo/i.test(jr) && /R\$\s?72,50/.test(sm2),
    `painel: ${kp.slice(0, 150)}; abas: ${abas}; semana: ${sm.slice(-90)}; depois de marcar a terça como parcial: ${sm2.slice(-60)}`);
  // 5. avaliador de time parceiro: pergunta a cada começo de turno
  const E2 = await L.celular(b); const p2 = E2.p; await L.logar(p2, 'div-2', 'equipe02'); await p2.waitForSelector('button.comecar-dia', { timeout: 20000 });
  await p2.click('button.comecar-dia'); await p2.waitForSelector('.folha:has-text("sozinho ou com auxiliar")'); const perg = limpo(await p2.locator('.folha').innerText());
  await p2.click('.folha button:has-text("Com auxiliar")'); await p2.waitForSelector('.folha select'); const opAx = await p2.locator('.folha select option').allInnerTexts(); await p2.waitForTimeout(450); await p2.click('.folha button:has-text("Começar o turno")');
  await p2.waitForSelector('button.nova', { timeout: 10000 }); await p2.waitForTimeout(500); const pill = limpo(await p2.locator('.pill-dia').innerText()); const d1 = await p2.evaluate(() => window.__app.S.dupla);
  await p2.waitForTimeout(1300); await p2.click('.pill-dia'); await p2.click('.folha button:has-text("Encerrar o turno")'); await p2.waitForSelector('button.comecar-dia', { timeout: 10000 }); await p2.waitForTimeout(1400);
  await p2.click('button.comecar-dia'); await p2.waitForSelector('.folha:has-text("sozinho ou com auxiliar")'); await p2.waitForTimeout(450); await p2.click('.folha button:has-text("Sozinho")'); await p2.waitForSelector('button.nova', { timeout: 10000 }); await p2.waitForTimeout(400);
  const d2 = await p2.evaluate(() => window.__app.S.dupla); await menu(p2, 'Meu dia'); const md2 = limpo(await p2.locator('main').innerText());
  ok('T.5', /sozinho ou com auxiliar/.test(perg) && opAx.length === 1 && opAx[0] === 'Leo Gap' && pill === 'Turno aberto' && d1.ax && d1.ax.nome === 'Leo Gap' && d2.av.nome === 'Bia Gap' && !d2.ax && !/Parada por chuva/.test(md2) && !/\d\d:\d\d/.test(pill),
    `pergunta: "${perg.slice(0, 60)}"; só o auxiliar do time aparece (${opAx.join(', ')}); etiqueta "${pill}" sem horário; turno 1 com ${d1.ax && d1.ax.nome}, turno 2 pergunta de novo e segue sozinha`);
  // 6. equipe com carteira: sem pergunta, parada por chuva e Minha produção
  const E1 = await L.celular(b); const p1 = E1.p; await L.logar(p1, 'div-1', 'equipe01'); await p1.waitForSelector('button.comecar-dia', { timeout: 20000 }); await p1.click('button.comecar-dia'); await p1.waitForSelector('button.nova', { timeout: 10000 }); const semPerg = await p1.locator('.folha').count();
  await menu(p1, 'Meu dia'); await p1.waitForSelector('button:has-text("Parada por chuva")'); await p1.click('button:has-text("Parada por chuva")'); await p1.waitForSelector('.folha:has-text("Parada por chuva")'); await p1.waitForTimeout(450);
  await p1.click('.folha button:has-text("Registrar parada")'); await p1.waitForTimeout(600); const semFoto = limpo(await p1.locator('.toast').first().innerText().catch(() => '')); await p1.waitForSelector('.folha:has-text("Parada por chuva")');
  await p1.setInputFiles('.folha input[type=file]', { name: 'tempo.png', mimeType: 'image/png', buffer: PNG }); await p1.waitForSelector('.folha:has-text("Foto pronta")', { timeout: 10000 }); await p1.fill('.folha textarea', 'Chuva forte na Rua Goiás'); await p1.waitForTimeout(450); await p1.click('.folha button:has-text("Registrar parada")');
  let dias = []; for (let i = 0; i < 30 && !dias.some((x) => x.hora); i++) { await p1.waitForTimeout(400); dias = (await L.post('dias_listar', { projeto: PJ })).dias; } const ch = dias.find((x) => x.hora) || {};
  await p1.goto(L.WEB + '#producao'); await p1.waitForSelector('.prod-linha', { timeout: 20000 }); await p1.waitForTimeout(400); const mp = limpo(await p1.locator('main').innerText()); await p1.screenshot({ path: 'b210-minha.png', fullPage: true });
  ok('T.6', semPerg === 0 && /Tire a foto/.test(semFoto) && ch.equipe === 'Equipe 1' && /Rua Goiás/.test(ch.obs || '') && /^https:\/\/drive\.google\.com\//.test(ch.foto || '') && /Registros Hoje/.test(mp) && /Meta da semana/.test(mp) && /Valor estimado/.test(mp) && /Ana Souza/.test(mp) && /Caio Reis/.test(mp) && /Semanas/.test(mp) && !/hora|R\$\s?2,50 por/i.test(mp),
    `equipe da casa começa sem pergunta; sem foto: "${semFoto}"; parada gravada às ${ch.hora} (${ch.obs}), com foto; Minha produção: ${mp.slice(0, 130)}`);
  // 7. auxiliar: entra só no painel dele
  const X = await L.celular(b); const px = X.p; await L.logar(px, 'caio', 'auxiliar01'); await px.waitForSelector('.prod-linha', { timeout: 20000 }); await px.waitForTimeout(400); const ma = limpo(await px.locator('main').innerText());
  await px.goto(L.WEB + '#mapa'); await px.waitForTimeout(900); const ainda = await px.locator('.prod-linha').count(); await px.goto(L.WEB + '#admin/usuarios'); await px.waitForTimeout(900); const ainda2 = await px.locator('.prod-linha').count();
  await px.click('button[aria-label="Menu"]'); await px.waitForSelector('.menu-lateral'); const mi = (await px.locator('.menu-lateral .menu-it').allInnerTexts()).join(' | '); await px.screenshot({ path: 'b210-auxiliar.png' });
  ok('T.7', /Caio Reis/.test(ma) && !/Ana Souza/.test(ma) && /Meta da semana/.test(ma) && ainda > 0 && ainda2 > 0 && mi === 'Minha produção | Trocar minha senha | Sobre, termo de uso e privacidade | Sair' && !/hora/i.test(ma), `auxiliar vê só o dele: ${ma.slice(0, 110)}; mapa e coordenação voltam ao painel; menu: ${mi}`);
  // 8. coordenação vendo os outros perfis
  await q.goto(L.WEB + '#inicio'); await q.waitForTimeout(800); await menu(q, 'Telas do avaliador'); await q.waitForSelector('.folha .menu-it'); const esc = (await q.locator('.folha .menu-it').allInnerTexts()).map(limpo).join(' | ');
  await q.click('.folha .menu-it:has-text("div-2")'); await q.waitForSelector('#faixa-como', { timeout: 20000 }); await q.waitForSelector('button.comecar-dia', { timeout: 20000 }); const fx = limpo(await q.locator('#faixa-como').innerText());
  await q.click('button.comecar-dia'); await q.waitForSelector('.folha:has-text("sozinho ou com auxiliar")'); await q.waitForTimeout(450); await q.click('.folha button:has-text("Sozinho")'); await q.waitForSelector('button.nova', { timeout: 10000 }); await q.waitForTimeout(1300);
  await q.click('button.nova'); await q.waitForTimeout(700); const tz = limpo(await q.locator('.toast').first().innerText().catch(() => '')); const semForm = !/#form/.test(q.url());
  const guardada = await q.evaluate(() => new Promise((res) => { const r = indexedDB.open('neofloresta-coleta'); r.onsuccess = () => { const db = r.result; const st = [...db.objectStoreNames]; const tx = db.transaction(st, 'readonly'); let achou = ''; let n = st.length; st.forEach((s) => { const c = tx.objectStore(s).openCursor(); c.onsuccess = (e) => { const cu = e.target.result; if (cu) { const v = cu.value; const ss = v && (v.v || v.valor || v); if (String(cu.key).includes('sessao') || (v && v.k === 'sessao')) achou = JSON.stringify(ss).slice(0, 300); cu.continue(); } else if (--n === 0) res(achou); }; }); }; }));
  await q.click('#faixa-como button'); await q.waitForFunction(() => !document.getElementById('faixa-como')); await q.waitForTimeout(800); const volta = await q.evaluate(() => window.__app.S.sessao.u);
  await menu(q, 'Painel do cliente'); await q.waitForSelector('#faixa-como', { timeout: 20000 }); await q.waitForSelector('.kpis, .painel', { timeout: 20000 }); const fxC = limpo(await q.locator('#faixa-como').innerText());
  await q.click('button[aria-label="Menu"]'); await q.waitForSelector('.menu-lateral'); const mC = limpo(await q.locator('.menu-lateral').innerText()); await q.screenshot({ path: 'b210-cliente.png' }); await q.click('.menu-lateral button:has-text("Sair")'); await q.waitForFunction(() => !document.getElementById('faixa-como')); await q.waitForTimeout(600);
  await menu(q, 'Telas do auxiliar'); await q.waitForSelector('.folha .menu-it'); await q.click('.folha .menu-it:has-text("Caio")'); await q.waitForSelector('.prod-linha', { timeout: 20000 }); const fxA = limpo(await q.locator('#faixa-como').innerText()); const mA = limpo(await q.locator('main').innerText()); await q.click('#faixa-como button'); await q.waitForFunction(() => !document.getElementById('faixa-como')); await q.waitForTimeout(600);
  await menu(q, 'Painel do parceiro'); await q.waitForSelector('.folha .menu-it'); await q.click('.folha .menu-it:has-text("Gap")'); await q.waitForSelector('.kpis', { timeout: 20000 }); const tp = limpo(await q.locator('body').innerText()); await q.screenshot({ path: 'b210-parceiro.png', fullPage: true });
  await q.reload(); await q.waitForTimeout(1500); const depois = await q.evaluate(() => window.__app.S.sessao.u);
  ok('T.8', /div-1/.test(esc) && /div-2/.test(esc) && !/outra/.test(esc) && /Só consulta: Equipe 2 \(Equipe de campo\)/.test(fx) && /nada é gravado/.test(tz) && semForm && /"u":"admin"/.test(guardada) && volta === 'admin' && /Prefeitura \(Cliente\)/.test(fxC) && !/Coordenação|Usuários|Validação/.test(mC) && /Caio Reis \(Auxiliar\)/.test(fxA) && /Caio Reis/.test(mA) && /Painel do parceiro/.test(tp) && /Duplas do time/.test(tp) && /Equipe 2/.test(tp) && depois === 'admin',
    `escolha: ${esc.slice(0, 80)}; faixa: "${fx}"; Nova árvore: "${tz}"; a sessão guardada continua a da coordenação; cliente: "${fxC.slice(0, 50)}" com o menu do cliente; auxiliar: "${fxA.slice(0, 45)}"; painel do parceiro Gap aberto`);
  // perfil parceiro: o menu abre (trocar senha e sair)
  await L.post('usuario_salvar', { usuario_dados: { login: 'gap', senha: 'biologia', nome: 'Time Gap', perfil: 'time', projeto: PJ, indicacao: 'Gap' } }); const G = await L.celular(b, { viewport: { width: 360, height: 740 } }); const g = G.p; await L.logar(g, 'gap', 'biologia'); await g.waitForSelector('.kpis', { timeout: 20000 });
  await g.click('button[aria-label="Menu"]'); await g.waitForSelector('.menu-lateral', { timeout: 5000 }); const mg = (await g.locator('.menu-lateral .menu-it').allInnerTexts()).join(' | ');
  ok('T.10', mg === 'Meu time | Trocar minha senha | Sobre, termo de uso e privacidade | Sair' && !g.erros.length, `menu do parceiro: ${mg}`);
  const erros = [...q.erros, ...p1.erros, ...p2.erros, ...px.erros]; ok('T.9', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b210.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
