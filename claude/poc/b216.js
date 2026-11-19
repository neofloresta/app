// 2.16: face sem acesso (foto e motivo da lista), agrupamento e sem calçada irregular
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
  const lin = async () => (await L.post('listar', { projeto: PJ })).linhas;
  // 1. face sem acesso: foto e motivo da lista, sem ponto e sem quantidade; só a face é marcada
  await tocar(p, ...meio(auto.q, auto.f)); await p.waitForSelector('.qd-ficha .bt-sem-acesso'); const fichaF = limpo(await p.locator('.qd-ficha').innerText()); const temIrr = /irregular/i.test(fichaF);
  await p.click('.qd-ficha .bt-sem-acesso'); await p.waitForSelector('.folha:has-text("Face sem acesso")'); await p.click('.folha button:has-text("Continuar")');
  await p.waitForSelector('.prog', { timeout: 30000 }); await p.waitForTimeout(600); const titulo = limpo(await p.locator('.topo h1').innerText());
  const campos0 = await p.evaluate(() => [...document.querySelectorAll('main .campo[data-campo]')].map((c) => c.dataset.campo));
  await A.foto(p, 'Foto 1'); await A.op(p, 'Motivo sem acesso', 'Outro'); await p.waitForTimeout(200); const campos1 = await p.evaluate(() => [...document.querySelectorAll('main .campo[data-campo]')].map((c) => c.dataset.campo));
  await A.concluir(p); const pend1 = await A.faltas(p); // "Outro" sem texto: não conclui
  await A.campo(p, 'Motivo sem acesso (outro)').locator('input, textarea').first().fill('encosta íngreme'); await p.waitForTimeout(200); await A.concluir(p); const pend2 = await A.faltas(p);
  await p.waitForSelector('button.nova', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(4000);
  let F = await L.post('quadras_situacao', { projeto: PJ, faces: true }); const fa = F.faces.find((f) => f.numero === auto.q.n + '-' + auto.f.i) || {}; const Qd = (await L.post('quadras_situacao', { projeto: PJ })).quadras.find((q) => q.numero === auto.q.n) || {};
  let ls = await lin(); const sa = ls.find((l) => String(l.Categoria) === '6') || {};
  ok('J.1', /face sem acesso/i.test(titulo) && !temIrr && campos0.includes('Foto 1') && campos0.includes('Motivo sem acesso') && !campos0.some((n) => /qtde|quantidade/i.test(n)) && !campos0.includes('Motivo sem acesso (outro)') && campos1.includes('Motivo sem acesso (outro)') && pend1.length > 0 && pend2.length === 0
    && fa.cond === 'sem_acesso' && fa.situacao === 'Levantada, sem árvores' && fa.cond_motivo === 'Outro: encosta íngreme' && fa.registro === sa.uuid && !Qd.fechada_em && sa['Motivo sem acesso'] === 'Outro' && sa['Motivo sem acesso (outro)'] === 'encosta íngreme',
    `cadastro "${titulo}" com ${campos0.join(', ')}; Outro pede o texto (${campos1.includes('Motivo sem acesso (outro)')}); pendências sem texto: ${pend1.join(', ')}; face ${fa.situacao}/${fa.cond} "${fa.cond_motivo}", quadra fechada: ${!!Qd.fechada_em}`);
  // 2. a lista de motivos
  const form = await L.post('formulario', { id: 'divinopolis-inventario' }).catch(() => null);
  const fj = JSON.parse(fs.readFileSync(L.APP + '/forms/divinopolis-inventario.json', 'utf8')); const mot = fj.campos.find((c) => c.nome === 'Motivo sem acesso');
  ok('J.2', JSON.stringify(mot.opcoes.map((o) => o.t)) === JSON.stringify(['Condomínio ou área particular', 'Relevo', 'Obra ou interdição', 'Outro']) && fj.campos.filter((c) => /^(Risco nivel 1|Nivel da avaliacao)$/.test(c.nome)).every((c) => c.legado) && !JSON.stringify(fj.abas).includes('Risco nivel 1') && !JSON.stringify(fj.regras).includes('Nivel da avaliacao') && fj.versao >= 10, `motivos: ${mot.opcoes.map((o) => o.t).join(' | ')}; risco nível 1 só na base (legado); versão do formulário ${fj.versao}`);
  // 3. agrupamento pelo app: um registro, com a quantidade estimada, CAP e altura médios
  await p.goto(L.WEB + '#'); await p.waitForSelector('button.nova'); await p.waitForTimeout(800);
  await E.ctx.setGeolocation({ latitude: auto.la + 0.00004, longitude: auto.lo + 0.00004, accuracy: 4 }); await p.waitForTimeout(500);
  await p.click('button.nova'); await p.waitForSelector('.prog'); await p.waitForTimeout(400); for (const t of ['Não, é outra', 'É outra árvore', 'Cadastrar mesmo assim']) if (await p.locator(`.folha button:has-text("${t}")`).count()) { await p.click(`.folha button:has-text("${t}")`); await p.waitForTimeout(300); }
  await A.op(p, 'Local do registro', 'Via pública'); const opcs = (await A.campo(p, 'Categoria').locator('.op').allInnerTexts()).map(limpo); await A.op(p, 'Categoria', 'Agrupamento'); await A.foto(p, 'Foto 1'); await A.op(p, 'Fitossanidade', 'Boa');
  await A.abaLivre(p, 'Indivíduo'); await A.sit(p, 'Viva'); const qtdeOk = await A.campo(p, 'Qtde estimada de individuos').count(); const ajudaCap = await A.campo(p, 'CAP (cm)').count();
  await p.click('.prog-topo'); const falta0 = limpo(await p.locator('.folha').innerText()); await p.evaluate(() => document.querySelectorAll('.veu').forEach((v) => v.remove()));
  await p.evaluate(() => { window.__app.S.reg.mexido = true; });
  await p.waitForTimeout(100);
  // preenche o resto como numa árvore e conclui
  await A.campo(p, 'Especie').locator('input').first().fill('Leucaena leucocephala'); await p.waitForTimeout(80); await A.num(p, 'Qtde estimada de individuos', 55);
  await A.campo(p, 'CAP (cm)').locator('input').first().fill('40'); await A.num(p, 'Altura total (m)', 4);
  for (const k of [1, 2, 3, 4]) if (await A.campo(p, `Raio de copa ${k} (m)`).count()) await A.num(p, `Raio de copa ${k} (m)`, 1 + k / 2);
  if (await A.campo(p, 'Area de copa medida (m2)').count()) await A.num(p, 'Area de copa medida (m2)', 30);
  await A.aba(p, 'Meio'); await A.novosMeio(p); await A.op(p, 'Conflitos no raio de 2 m', 'Ausente'); await p.locator('.chip[data-campo="Fiação ausente"]').click(); await A.op(p, 'Marquise ou toldo', 'Ausente'); await p.locator('.chip[data-campo="Tráfego sem interferência"]').click();
  await A.aba(p, 'Copa'); await A.op(p, 'Qualidade da copa', 'Normal'); await A.op(p, 'Galhos secos ou podres', 'Ausente'); for (const n of ['Podas ausente', 'Pragas na copa ausente']) await p.locator(`.chip[data-campo="${n}"]`).click();
  await A.aba(p, 'Tronco'); for (const n of ['Danos ausente', 'Pragas no tronco ausente']) await p.locator(`.chip[data-campo="${n}"]`).click(); await A.op(p, 'Ocos e cavidades', 'Ausente');
  await A.aba(p, 'Raízes'); for (const n of ['Raízes ausente', 'Pragas nas raízes ausente']) await p.locator(`.chip[data-campo="${n}"]`).click();
  await A.aba(p, 'Risco'); await A.novosRisco(p); await A.op(p, 'Probabilidade de falha', 'Improvável'); await A.campo(p, 'Probabilidade de impacto').locator('.op').nth(1).click(); await A.op(p, 'Consequencias', 'Menor');
  await A.aba(p, 'Manejo'); await p.locator('.chip[data-campo="Manejo nenhum"]').click(); await A.aba(p, 'Fotos e observações'); await A.foto(p, 'Foto 2'); await A.foto(p, 'Foto 3');
  await A.concluir(p); for (const t of ['Sim, nenhum', 'Está certo', 'Salvar sem GPS']) if (await p.locator(`.folha >> text=${t}`).count()) { await p.click(`.folha button:has-text("${t}")`); await p.waitForTimeout(300); }
  const pend3 = await A.faltas(p); await p.waitForSelector('button.nova', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(4000);
  ls = await lin(); const ag = ls.find((l) => String(l.Categoria) === '7') || {};
  ok('J.3', opcs.includes('Agrupamento') && qtdeOk === 1 && pend3.length === 0 && Number(ag['Qtde estimada de individuos']) === 55 && ag.Especie === 'Leucaena leucocephala' && Number(ag['Altura total (m)']) === 4 && !!ag.latitude,
    `categorias: ${opcs.join(', ')}; campo de quantidade na tela: ${qtdeOk}; pendências: ${pend3.join(', ') || 'nenhuma'}; servidor: categoria ${ag.Categoria}, qtde ${ag['Qtde estimada de individuos']}, espécie ${ag.Especie}, altura ${ag['Altura total (m)']}`);
  // 4. pagamento: agrupamento vale 1 registro, face sem acesso vale 1 face (depois do auditor)
  const hoje = new Date(); const d = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; const per = { projeto: PJ, de: d(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: d(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)) };
  const P0 = await L.post('producao', per); await L.post('validar', { projeto: PJ, itens: [{ uuid: ag.uuid, estado: 'Validado' }, { uuid: sa.uuid, estado: 'Validado' }] }); const P1 = await L.post('producao', per);
  const esperado = P1.regras.valor * (1 + P1.regras.pesoFace * 1);
  ok('J.4', P0.totais.valor === 0 && Math.abs(P1.totais.valor - esperado) < 0.001, `antes do auditor R$ ${P0.totais.valor}; depois R$ ${P1.totais.valor} = ${P1.regras.valor} x (1 agrupamento + 1 face sem acesso)`);
  // 5. painel: agrupamentos à parte, com a estimativa; sem calçada irregular
  const Ad = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const q = Ad.p; await L.logar(q, 'admin', L.senha()); await q.waitForTimeout(1500);
  await q.goto(L.WEB + '#painel'); await q.waitForSelector('.kpis', { timeout: 20000 }); await q.waitForTimeout(2500); let tp = limpo(await q.locator('main').innerText()); await q.click('.painel-abas button:has-text("Inventário")'); await q.waitForTimeout(600); tp += ' ' + limpo(await q.locator('main').innerText()); await q.screenshot({ path: 'b216-painel.png', fullPage: true });
  ok('J.5', /Agrupamentos\s*1/.test(tp) && /cerca de 55 indivíduos/.test(tp) && /Indivíduos\s*0/.test(tp) && !/Calçada irregular/.test(tp), `painel: agrupamento (${(tp.match(/Agrupamentos\s*\d+/) || [''])[0]}), estimativa (${/cerca de 55 indivíduos/.test(tp)}), indivíduos medidos (${(tp.match(/Indivíduos\s*\d+/) || [''])[0]})`);
  ok('J.6', !p.erros.length && !q.erros.length, [...p.erros, ...q.erros].join(' | ') || 'sem erros de JavaScript');
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
