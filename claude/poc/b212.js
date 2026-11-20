// 2.12 (ajustado na 2.16: sem calçada irregular): quadra sem acesso (um cadastro pelas faces, pago por face) e fitossanidade
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis'; const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx); const Q = ctx.Quadras;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR4nGNkYPjPgA0wYRUdtBIAO4MBD0mtvJAAAAAASUVORK5CYII=', 'base64');
const meio = (q, f, dentro = 0) => { const c = Q.faceCoords(q, f); const mx = 111320 * Math.cos(20.14 * Math.PI / 180), my = 110540; const seg = []; let tot = 0; for (let i = 1; i < c.length; i++) { const d = Math.hypot((c[i][0] - c[i - 1][0]) * mx, (c[i][1] - c[i - 1][1]) * my); seg.push(d); tot += d; }
  let alvo = tot / 2; for (let i = 1; i < c.length; i++) { if (alvo <= seg[i - 1]) { const t = alvo / seg[i - 1]; let lon = c[i - 1][0] + t * (c[i][0] - c[i - 1][0]), lat = c[i - 1][1] + t * (c[i][1] - c[i - 1][1]); if (dentro) { const ce = Q.centro(q); const dx = (ce[1] - lon) * mx, dy = (ce[0] - lat) * my, n = Math.hypot(dx, dy); lon += (dx / n) * dentro / mx; lat += (dy / n) * dentro / my; } return [lat, lon]; } alvo -= seg[i - 1]; } return [c[0][1], c[0][0]]; };
const tocar = async (p, lat, lon, z = 19) => { const xy = await p.evaluate(([a, b, z]) => { const m = window.__app.mapa; m.closePopup(); m.setView([a, b], z, { animate: false }); const pt = m.latLngToContainerPoint([a, b]); const r = m.getContainer().getBoundingClientRect(); return { x: r.left + pt.x, y: r.top + pt.y }; }, [lat, lon, z]); await p.waitForTimeout(700); await p.mouse.click(xy.x, xy.y); await p.waitForTimeout(600); };
(async () => {
  await L.subir(); await L.configurar();
  await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } }); await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const nova = async (pe) => (await L.post('pessoa_salvar', { pessoa: Object.assign({ projeto: PJ }, pe) })).id;
  const ana = await nova({ nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 1', vinculo: 'Parceiro', time: 'Neofloresta' }); const bia = await nova({ nome: 'Bia Gap', funcao: 'Avaliador', registro: 'CRBio 2', vinculo: 'Parceiro', time: 'Gap' });
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', perfil: 'coletor', avaliador_id: ana } }); await L.post('usuario_salvar', { usuario_dados: { login: 'div-2', perfil: 'coletor', avaliador_id: bia } });
  const lido = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(lido.feicoes, 'quadra', ['ruas']); const idx = Q.indice(cam.quadras);
  const centro = [-20.1436, -44.8908]; let auto = null;
  for (const q of cam.quadras.filter((x) => x.f && Math.abs((x.b[1] + x.b[3]) / 2 - centro[0]) < 0.004 && Math.abs((x.b[0] + x.b[2]) / 2 - centro[1]) < 0.004)) { for (const f of q.f) { if (f.c < 60) continue; const [la, lo] = meio(q, f, 1.5); const v = idx.faces(lo, la, 30); if (v[0] && v[0].id === q.n + '-' + f.i && v[0].d < 15 && (!v[1] || v[1].d - v[0].d >= 8)) { auto = { q, f, la, lo }; break; } } if (auto) break; }
  const viz = cam.quadras.filter((x) => Math.abs(x.b[0] - auto.q.b[0]) < 0.004 && Math.abs(x.b[1] - auto.q.b[1]) < 0.004); const mini = { campo: cam.campo, total: viz.length, quadras: viz };
  await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(Object.assign({}, cam, mini)) }); const idA = auto.q.n + '-' + auto.f.i;
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-3', senha: 'equipe03', nome: 'Equipe 3', perfil: 'coletor', projeto: PJ, equipe: 'Equipe 3', codigo: 'E3' } });
  await L.post('aceitar_termo', { versao: (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1] }, 'div-3', 'equipe03');
  const b = await chromium.launch(); const A = require('./acoes');
  const faces = async () => { const m = {}; (await L.post('quadras_situacao', { projeto: PJ, faces: true })).faces.forEach((f) => { m[f.numero] = f; }); return m; };
  const quadras = async () => { const m = {}; (await L.post('quadras_situacao', { projeto: PJ })).quadras.forEach((q) => { m[q.numero] = q; }); return m; };
  const E = await L.celular(b, { geolocation: { latitude: auto.la, longitude: auto.lo, accuracy: 4 } }); const p = E.p; await L.logar(p, 'div-1', 'equipe01'); await p.waitForSelector('button.nova', { timeout: 20000 }); await p.waitForTimeout(1500);
  await p.goto(L.WEB + '#mapa'); await p.waitForTimeout(2500); await p.waitForSelector('button.nova'); await p.waitForTimeout(1400);
  let F = await faces(); const lin = async () => (await L.post('listar', { projeto: PJ })).linhas; let ls;
  // 4. quadra sem acesso: um cadastro com a foto e o motivo marca todas as faces e fecha a quadra
  const qs = viz.find((x) => x.f && x.f.length >= 3 && x.n !== auto.q.n); const cq = Q.centro(qs);
  await p.goto(L.WEB + '#mapa'); await p.waitForTimeout(2500); await p.waitForSelector('button.nova'); await p.waitForTimeout(1200);
  for (let k = 0; k < 4 && !(await p.locator('.qd-ficha .bt-sem-acesso').count()); k++) { await tocar(p, cq[0], cq[1], 18); await p.waitForTimeout(600); }
  await p.screenshot({ path: 'b212-quadra.png' }); await p.click('.qd-ficha .bt-sem-acesso'); await p.waitForSelector('.folha:has-text("Quadra sem acesso")'); const avisoQ = limpo(await p.locator('.folha:has-text("Quadra sem acesso")').innerText()); await p.click('.folha button:has-text("Continuar")');
  await p.waitForSelector('.prog', { timeout: 30000 }); await p.waitForTimeout(600); const titulo = limpo(await p.locator('.topo h1').innerText()); const camposQ = await p.evaluate(() => [...document.querySelectorAll('main .campo[data-campo]')].map((c) => c.dataset.campo));
  await p.click('.prog-topo'); const etapasQ = (await p.locator('.folha .menu-it').allInnerTexts()).length; await p.evaluate(() => document.querySelectorAll('.veu').forEach((v) => v.remove())); await p.screenshot({ path: 'b212-semacesso.png' });
  await A.foto(p, 'Foto 1'); await A.op(p, 'Motivo sem acesso', 'Condomínio'); await p.waitForTimeout(200); await A.concluir(p); const pendQ = await A.faltas(p);
  await p.waitForSelector('button.nova', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(4000); await p.evaluate(() => window.__app.sincronizar && window.__app.sincronizar(true)).catch(() => {}); await p.waitForTimeout(3000);
  F = await faces(); const Qd = await quadras(); const fq = qs.f.map((f) => F[qs.n + '-' + f.i] || {}); ls = await lin(); const sa = ls.find((l) => ['6', 'Sem acesso'].includes(String(l.Categoria))) || {};
  ok('I.4', /sem acesso/i.test(titulo) && camposQ.includes('Foto 1') && camposQ.includes('Motivo sem acesso') && !camposQ.includes('Local do registro') && etapasQ === 1 && pendQ.length === 0 && fq.every((f) => f.situacao === 'Levantada, sem árvores' && f.cond === 'sem_acesso' && f.registro === sa.uuid && f.cond_motivo === 'Condomínio ou área particular') && !!(Qd[qs.n] || {}).fechada_em && sa['Motivo sem acesso'] === 'Condomínio ou área particular',
    `aviso "${avisoQ.slice(0, 90)}"; cadastro "${titulo}" com ${camposQ.join(', ')} em ${etapasQ} etapa; quadra ${qs.n}: ${fq.length} faces ${[...new Set(fq.map((f) => f.situacao + '/' + f.cond))].join(' | ')}, fechada: ${!!(Qd[qs.n] || {}).fechada_em}; registro categoria ${sa.Categoria}, motivo "${sa['Motivo sem acesso']}"`);
  // 5. pagamento: a árvore do cadastro rápido vale como as outras; a quadra sem acesso vale uma vez por face, depois do auditor
  const hoje = new Date(); const d = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; const per = { projeto: PJ, de: d(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: d(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)) };
  const P0 = await L.post('producao', per); await L.post('validar', { projeto: PJ, itens: [{ uuid: sa.uuid, estado: 'Validado' }] }); const P1 = await L.post('producao', per);
  const esperado = P1.regras.valor * (P1.regras.pesoFace * fq.length);
  ok('I.5', P0.totais.valor === 0 && Math.abs(P1.totais.valor - esperado) < 0.001 && fq.length >= 3, `antes do auditor: R$ ${P0.totais.valor}; depois: R$ ${P1.totais.valor} = ${P1.regras.valor} x (${fq.length} faces sem acesso)`);
  // 8. fraude pelo servidor: o mesmo cadastro não vale por faces de outra quadra, por faces comuns nem por faces marcadas por outro acesso
  const qo = viz.find((x) => x.f && x.f.length >= 3 && x.n !== auto.q.n && x.n !== qs.n); const fo = qo.f.map((f) => qo.n + '-' + f.i);
  const t1 = await L.post('quadras_marcar', { projeto: PJ, itens: fo.map((n) => ({ tipo: 'face', numero: n, situacao: 'Levantada, sem árvores', registro: sa.uuid, cond: 'sem_acesso' })) }, 'div-1', 'equipe01');
  const t2 = await L.post('quadras_marcar', { projeto: PJ, itens: fo.map((n) => ({ tipo: 'face', numero: n, situacao: 'Levantada, sem árvores', registro: sa.uuid })) }, 'div-1', 'equipe01');
  const t3 = await L.post('quadras_marcar', { projeto: PJ, itens: [{ tipo: 'face', numero: fo[0], situacao: 'Levantada, sem árvores', registro: sa.uuid }] }, 'div-2', 'equipe02');
  const t4 = await L.post('quadras_marcar', { projeto: PJ, itens: [{ tipo: 'face', numero: fo[0], cond: ['sem_acesso'] }] }, 'div-1', 'equipe01');
  const t5 = await L.post('quadras_marcar', { projeto: PJ, itens: [{ tipo: 'face', numero: fo[1], situacao: 'Levantada, sem árvores', registro: sa.uuid }] }, 'div-3', 'equipe03'); // cadastro de outra equipe, ainda sem face ligada
  const P2 = await L.post('producao', per); F = await faces();
  ok('I.8', t1.recusadas.length === fo.length && t2.recusadas.length === fo.length && t3.recusadas.length === 1 && t4.recusadas.length === 1 && t5.recusadas.length === 1 && /outro acesso/.test(t5.recusadas[0].motivo) && Math.abs(P2.totais.valor - esperado) < 0.001 && fo.every((n) => !(F[n] || {}).registro),
    `faces de outra quadra com o mesmo cadastro: ${t1.recusadas.length} de ${fo.length} recusadas ("${(t1.recusadas[0] || {}).motivo}"); como calçada comum: ${t2.recusadas.length} recusadas; por outro acesso: ${t3.recusadas.length} recusada; condição em lista: recusada (${t4.recusadas.length}); face apontando para cadastro de outra equipe: "${(t5.recusadas[0] || {}).motivo}"; valor continua R$ ${P2.totais.valor}`);
  // 6. painel: faces sem acesso, e nada de calçada irregular nem risco nível 1
  const Ad = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const q = Ad.p; await L.logar(q, 'admin', L.senha()); await q.waitForTimeout(1500);
  await q.goto(L.WEB + '#painel'); await q.waitForSelector('.kpis', { timeout: 20000 }); await q.waitForTimeout(2500); let tp = limpo(await q.locator('main').innerText()); await q.click('.painel-abas button:has-text("Inventário")'); await q.waitForTimeout(600); tp += ' ' + limpo(await q.locator('main').innerText()); await q.screenshot({ path: 'b212-painel.png', fullPage: true });
  ok('I.6', /Sem acesso\s*\d+ faces?/.test(tp) && !/Calçada irregular/.test(tp) && !/nível 1/.test(tp), `painel: sem acesso (${(tp.match(/Sem acesso\s*\d+ faces?/) || [''])[0]}), sem calçada irregular (${!/Calçada irregular/.test(tp)}), sem risco nível 1 (${!/nível 1/.test(tp)})`);
  ok('I.7', !p.erros.length && !q.erros.length, [...p.erros, ...q.erros].join(' | ') || 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
