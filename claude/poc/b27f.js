// 2.7 e 2.10: produção por pessoa (parceiro por registro, carteira no prêmio da semana), bônus, auditoria por setor e fechamento da medição
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis';
const quadrado = (n, x0, y0, x1, y1) => ({ n, b: [x0, y0, x1, y1], a: [[x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]] });
let ANA, BRUNO;
(async () => {
  await L.subir(); await L.configurar();
  const prj = (await L.post('projetos_listar', {})).projetos.find((x) => x.id === PJ);
  await L.post('projeto_salvar', { projeto_dados: Object.assign({}, prj, { bonus_valor: '0.5', bonus_erro_max: '2', auditoria_pct: '10', auditoria_erro_max: '5' }) });
  const nova = async (pe) => (await L.post('pessoa_salvar', { pessoa: Object.assign({ projeto: PJ }, pe) })).id;
  const idAna = await nova({ nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 1', vinculo: 'CLT', equipe: 'Equipe 1' }); const idJoao = await nova({ nome: 'João Lima', funcao: 'Auxiliar', vinculo: 'Parceiro', equipe: 'Equipe 1' }); const idBruno = await nova({ nome: 'Bruno Alves', funcao: 'Avaliador', registro: 'CREA 2', vinculo: 'Parceiro', equipe: 'Equipe 2' });
  // o celular manda vínculo errado de propósito: o servidor confere com o cadastro
  ANA = { avaliador_id: idAna, avaliador: 'Ana', avaliador_vinculo: 'Parceiro', auxiliar_id: idJoao, auxiliar: 'João Lima', auxiliar_vinculo: 'Parceiro' };
  BRUNO = { avaliador_id: idBruno, avaliador: 'Bruno Alves', avaliador_vinculo: 'Parceiro' };
  // 2.8: a dupla é a do acesso, definida pela coordenação
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', avaliador_id: idAna, auxiliar_id: idJoao } }); await L.post('usuario_salvar', { usuario_dados: { login: 'div-2', avaliador_id: idBruno } });
  await L.post('setores_importar', { projeto: PJ, camada: JSON.stringify({ setores: [quadrado('S1', -44.9, -20.2, -44.8, -20.1), quadrado('S2', -44.8, -20.2, -44.7, -20.1)] }) });
  await L.post('setores_atribuir', { projeto: PJ, itens: [{ numero: 'S1', equipe: 'Equipe 1' }, { numero: 'S2', equipe: 'Equipe 2' }] });
  // registros: Equipe 1 no dia 03/11 (Ana CLT + João parceiro), Equipe 2 no dia 04/11 (Bruno parceiro sozinho)
  const enviar = async (u, s, k, dia, extra, equipe) => { const uuid = `${u}-${dia}-${k}`; const t = `2026-11-${dia}T${String(11 + Math.floor(k / 60)).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}:00.000Z`;
    await L.post('registro', { projeto: PJ, linha: Object.assign({ uuid, projeto: PJ, equipe, criado_em: t, atualizado_em: t, concluido_em: t, latitude: -20.15, longitude: equipe === 'Equipe 2' ? -44.75 : -44.85, 'Altura total (m)': 5, 'Foto 1': 'DCIM/x.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', 'Codigo': 'C' + k }, extra) }, u, s); return uuid; };
  const e1 = []; for (let k = 0; k < 95; k++) e1.push(await enviar('div-1', 'equipe01', k, '03', Object.assign({ setor: 'S1' }, ANA), 'Equipe 1'));
  const baixa = await enviar('div-1', 'equipe01', 95, '03', Object.assign({ setor: 'S1', 'Altura total (m)': 1.5 }, ANA), 'Equipe 1');
  const dev = await enviar('div-1', 'equipe01', 96, '03', Object.assign({ setor: 'S1' }, ANA), 'Equipe 1');
  await enviar('div-1', 'equipe01', 97, '03', Object.assign({ setor: 'S1' }, ANA), 'Equipe 1'); // fica em validação
  const e2 = []; for (let k = 0; k < 10; k++) e2.push(await enviar('div-2', 'equipe02', k, '04', Object.assign({ setor: 'S2' }, BRUNO), 'Equipe 2'));
  await L.post('validar', { projeto: PJ, itens: [...e1, baixa, ...e2].map((uuid) => ({ uuid, estado: 'Validado' })).concat([{ uuid: dev, estado: 'Devolvido', obs: 'Foto sem a árvore' }]) });
  // 1. produção do período
  const P = await L.post('producao', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' });
  const pe = (n) => P.pessoas.find((x) => x.nome === n) || {};
  const ana = pe('Ana Souza'), joao = pe('João Lima'), bruno = pe('Bruno Alves'); const d3 = P.dias.find((x) => x.dia === '2026-11-03') || {};
  ok('F.1', joao.validadas === 95 && joao.valor === 118.75 && ana.valor === 0 && ana.premio === 0 && d3.validadas === 95 && bruno.valor === 25 && ana.naoContam === 1 && ana.devolvidas === 1 && ana.emValidacao === 1,
    `João (parceiro, 50%): ${joao.validadas} validadas = ${joao.valor}; Ana (CLT): por registro ${ana.valor}, prêmio da semana ${ana.premio} (${d3.validadas} no dia, abaixo da meta de 100); Bruno (parceiro sozinho) ${bruno.valor}; altura abaixo de 2 m não conta (${ana.naoContam}); devolvida ${ana.devolvidas}, em validação ${ana.emValidacao}`);
  // 2. painel da dupla: só os dela, parceiro vê o valor, CLT vê o prêmio
  const M = await L.post('producao_minha', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }, 'div-1', 'equipe01');
  const mj = M.pessoas.find((x) => x.nome === 'João Lima') || {}, ma = M.pessoas.find((x) => x.nome === 'Ana Souza') || {};
  const negado = await L.post('producao', { projeto: PJ }, 'div-1', 'equipe01').then(() => 'liberado').catch((e) => e.message);
  ok('F.2', M.pessoas.length === 2 && mj.aReceber === 118.75 && !('aReceber' in ma) && ma.premioApurado === 0 && M.hoje && M.devolvidas.length === 1 && /Foto sem a árvore/.test(M.devolvidas[0].motivo) && negado !== 'liberado',
    `dupla vê ${M.pessoas.length} pessoas (só as dela): João a receber ${mj.aReceber}, Ana prêmio ${ma.premioApurado}; devolvida com motivo "${(M.devolvidas[0] || {}).motivo}"; painel do gestor negado à equipe`);
  // 3. auditoria: S2 sem erro (aprovado, bônus), S1 com erro acima de 5% (setor inteiro volta)
  const a2 = await L.post('auditoria_sortear', { projeto: PJ, setor: 'S2' }); let fim2;
  for (const u of a2.amostra) fim2 = (await L.post('auditoria_conferir', { projeto: PJ, setor: 'S2', uuid: u, resultado: 'ok' })).fim;
  const a1 = await L.post('auditoria_sortear', { projeto: PJ, setor: 'S1' }); let fim1;
  const semMotivo = await L.post('auditoria_conferir', { projeto: PJ, setor: 'S1', uuid: a1.amostra[0], resultado: 'erro' }).then(() => 'aceitou').catch((e) => e.message);
  for (const [i, u] of a1.amostra.entries()) fim1 = (await L.post('auditoria_conferir', { projeto: PJ, setor: 'S1', uuid: u, resultado: i === 0 ? 'erro' : 'ok', motivo: i === 0 ? 'Espécie errada' : '' })).fim;
  ok('F.3', a2.amostra.length === 1 && fim2.situacao === 'Aprovado' && a1.amostra.length === 10 && a1.total === 98 && /erro encontrado/.test(semMotivo) && fim1.erro_pct === 10 && fim1.situacao === 'Devolvido para correção' && fim1.devolvidos === 98,
    `S2: amostra ${a2.amostra.length} de 10, ${fim2.situacao}; S1: amostra ${a1.amostra.length} de ${a1.total}, 1 erro = ${fim1.erro_pct}%, ${fim1.situacao}, ${fim1.devolvidos} registros devolvidos`);
  const P2 = await L.post('producao', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }); const b2 = P2.pessoas.find((x) => x.nome === 'Bruno Alves') || {}; const j2 = P2.pessoas.find((x) => x.nome === 'João Lima') || {};
  ok('F.4', b2.bonus === 5 && b2.total === 30 && j2.validadas === 0 && j2.devolvidas === 98, `depois da auditoria: Bruno ganha bônus de qualidade ${b2.bonus} (total ${b2.total}); João com o setor devolvido: ${j2.validadas} validadas, ${j2.devolvidas} devolvidas`);
  // 4. fechamento da medição
  const f1 = await L.post('medicao_fechar', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' });
  const f2 = await L.post('medicao_fechar', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }).then(() => 'aceitou').catch((e) => e.message);
  const fake = await L.post('auditoria_sortear', { projeto: PJ, setor: '' }).then(() => 'aceitou').catch((e) => e.message);
  const devPaga = await L.post('validar', { projeto: PJ, itens: [{ uuid: e2[0], estado: 'Devolvido', obs: 'teste' }] });
  const P3 = await L.post('producao', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }); const b3 = P3.pessoas.find((x) => x.nome === 'Bruno Alves') || {};
  const M2 = await L.post('producao_minha', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }, 'div-2', 'equipe02');
  const lis = (await L.post('listar', { projeto: PJ })).linhas.filter((l) => l.pagamento);
  ok('F.5', f1.medicao.arvores === 10 && f1.medicao.total === 30 && /Nenhuma árvore validada a pagar/.test(f2) && /setor da camada/.test(fake) && devPaga.pagos === 1 && devPaga.alterados === 0 && b3.pagas === 10 && b3.arvoresPagar === 0 && P3.medicoes.length === 1 && (M2.pessoas[0] || {}).pagos === 10 && lis.length === 10 && /Medição 2026-11-01 a 2026-11-15/.test(lis[0].pagamento),
    `medição fechada com ${f1.medicao.arvores} árvores (${f1.medicao.total}); fechar de novo: "${f2}"; pago não volta como devolvido (${devPaga.pagos}); setor vazio recusado; Bruno com ${b3.pagas} pagas e nada a pagar; a dupla vê ${(M2.pessoas[0] || {}).pagos} pagos; planilha marca "${(lis[0] || {}).pagamento}"`);
  // 4b. validação tardia de um dia já fechado entra na medição seguinte, sem pagar de novo o que já foi pago
  const tard = await enviar('div-2', 'equipe02', 50, '04', Object.assign({ setor: 'S1', fora_do_setor: '' }, BRUNO), 'Equipe 2');
  await L.post('validar', { projeto: PJ, itens: [{ uuid: tard, estado: 'Validado' }] });
  const f3 = await L.post('medicao_fechar', { projeto: PJ, de: '2026-11-16', ate: '2026-11-30' });
  // registro forjado: pessoa que não existe e vínculo trocado
  const fj = await enviar('div-1', 'equipe01', 99, '05', { avaliador_id: 'P_FAKE', avaliador: 'Fantasma', avaliador_vinculo: 'Parceiro', auxiliar_id: ANA.avaliador_id, auxiliar: 'X', auxiliar_vinculo: 'Parceiro', setor: 'S2' }, 'Equipe 1');
  const lf = (await L.post('listar', { projeto: PJ })).linhas.find((l) => l.uuid === fj) || {};
  ok('F.9', f3.medicao.arvores === 1 && f3.medicao.total === 3 && lf.avaliador === 'Ana Souza' && lf.avaliador_vinculo === 'CLT' && lf.auxiliar === 'João Lima', `árvore validada depois do fechamento entra na medição seguinte sozinha (${f3.medicao.arvores} árvore, ${f3.medicao.total}); o celular mandou outra dupla e o servidor gravou a do acesso (${lf.avaliador} ${lf.avaliador_vinculo} + ${lf.auxiliar})`);
  // meta por dupla: duas duplas da mesma equipe no mesmo dia com 50 cada ficam abaixo da meta, cada uma na sua semana
  const idDavi = await nova({ nome: 'Davi Rocha', funcao: 'Avaliador', registro: 'CRBio 3', vinculo: 'CLT', equipe: 'Equipe 1' });
  const d6 = []; for (let k = 0; k < 50; k++) d6.push(await enviar('div-1', 'equipe01', 200 + k, '06', {}, 'Equipe 1'));
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', avaliador_id: idDavi, auxiliar_id: '' } });
  for (let k = 0; k < 50; k++) d6.push(await enviar('div-1', 'equipe01', 300 + k, '06', {}, 'Equipe 1'));
  await L.post('validar', { projeto: PJ, itens: d6.map((uuid) => ({ uuid, estado: 'Validado' })) });
  const P6 = await L.post('producao', { projeto: PJ, de: '2026-11-06', ate: '2026-11-06' });
  ok('F.10', P6.dias.length === 2 && P6.dias.every((x) => x.validadas === 50 && x.acima === 0) && P6.semanas.length === 2 && P6.semanas.every((x) => !x.bateu && x.avaliador.total === 0), `dia 06/11: ${P6.dias.map((x) => `${x.dupla} ${x.validadas} árvores, ${x.acima} acima da meta`).join('; ')}`);
  // 2.9: quem trouxe a dupla (empresa júnior) recebe por árvore validada, sem pagar duas vezes
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-2', indicacao: 'Floresta Jr' } });
  const PI = await L.post('producao', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }); const i0 = PI.indicacoes[0] || {};
  const d7 = []; for (let k = 0; k < 4; k++) d7.push(await enviar('div-2', 'equipe02', 400 + k, '07', {}, 'Equipe 2'));
  await L.post('validar', { projeto: PJ, itens: d7.map((uuid) => ({ uuid, estado: 'Validado' })) });
  const P7 = await L.post('producao', { projeto: PJ, de: '2026-11-07', ate: '2026-11-07' }); const i7 = P7.indicacoes[0] || {};
  const f7 = await L.post('medicao_fechar', { projeto: PJ, de: '2026-11-07', ate: '2026-11-07' }); const P7b = await L.post('producao', { projeto: PJ, de: '2026-11-07', ate: '2026-11-07' }); const m7 = P7b.medicoes[P7b.medicoes.length - 1] || {};
  const visto = await L.post('producao_minha', { projeto: PJ, de: '2026-11-07', ate: '2026-11-07' }, 'div-2', 'equipe02');
  const b7 = P7.pessoas.find((x) => x.nome === 'Bruno Alves') || {};
  ok('F.11', b7.valorPagar === 8 && i0.nome === 'Floresta Jr' && i0.arvores === 11 && i0.valor === 5.5 && i0.arvoresPagar === 0 && i7.arvores === 4 && i7.valorPagar === 2 && P7.totais.indicacaoPagar === 2 && m7.indicacao === 2 && f7.medicao.total === P7.totais.totalPagar && (P7b.indicacoes[0] || {}).valorPagar === 0 && !('indicacoes' in visto),
    `a parte do time sai do valor da árvore: Bruno fica com ${b7.valorPagar} por 4 árvores (2,00 cada); Floresta Jr no período já pago: ${i0.arvores} árvores = ${i0.valor}, a pagar ${i0.valorPagar}; dia 07/11: ${i7.arvores} árvores novas, a pagar ${i7.valorPagar}; medição grava ${m7.indicacao} para quem trouxe e depois nada fica a pagar; a dupla não vê esse valor`);
  // 2.9: acesso do time parceiro: vê só a produção e o valor do próprio time, com o histórico pago
  await L.post('usuario_salvar', { usuario_dados: { login: 'gap', senha: 'biologia', nome: 'Time Gap', perfil: 'time', projeto: PJ, indicacao: 'floresta jr' } });
  const T = await L.post('producao_time', { projeto: PJ }, 'gap', 'biologia');
  const neg = []; for (const ac of ['listar', 'mapa', 'painel', 'producao', 'pessoas_listar', 'usuarios_listar', 'foto_ver', 'os_listar', 'quadras_situacao']) neg.push(await L.post(ac, { projeto: PJ, campos: ['uuid'] }, 'gap', 'biologia').then(() => ac + ' LIBEROU').catch(() => ''));
  const outro = await L.post('producao_time', { projeto: PJ }, 'div-1', 'equipe01').then(() => 'liberado').catch((e) => e.message);
  ok('F.12', T.time === 'floresta jr' && T.duplas.length === 1 && T.duplas[0].equipe === 'Equipe 2' && T.totais.validadas === 15 && T.totais.pagas === 15 && T.totais.valorPagar === 0 && T.historico.length === 1 && T.historico[0].valor === 2 && T.pago === 2 && !neg.filter(Boolean).length && outro !== 'liberado',
    `time vê ${T.duplas.length} dupla (${(T.duplas[0] || {}).equipe}): ${T.totais.validadas} validadas, ${T.totais.pagas} pagas, a receber ${T.totais.valorPagar}; histórico com ${T.historico.length} medição (${(T.historico[0] || {}).valor}); outras consultas negadas (${neg.filter(Boolean).join(', ') || 'todas'}); equipe de campo não abre o painel do time`);
  // 5. telas
  const b = await chromium.launch();
  const C = await L.celular(b, { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }); const q = C.p;
  await L.logar(q, 'admin', L.senha()); await q.waitForTimeout(1200);
  await q.evaluate(() => { window.__app.S.perProd = ['2026-11-01', '2026-11-15']; }); await q.goto(L.WEB + '#producao'); await q.waitForSelector('.kpis', { timeout: 20000 });
  const kp = await q.locator('.kpis').innerText(); const linhasP = await q.locator('.tab tr').count();
  await q.screenshot({ path: 'b27f-producao.png', fullPage: true });
  await q.goto(L.WEB + '#auditoria'); await q.waitForSelector('text=Setores com coleta', { timeout: 20000 }); const aud = await q.locator('main').innerText();
  await q.goto(L.WEB + '#auditoria/S1'); await q.waitForSelector('.aud-item', { timeout: 20000 }); const nAud = await q.locator('.aud-item').count(); const aud1 = await q.locator('.aud-item').first().innerText();
  await q.screenshot({ path: 'b27f-auditoria.png', fullPage: true });
  ok('F.6', /A pagar/.test(kp) && linhasP >= 4 && /Devolvido para correção/.test(aud) && /Aprovado/.test(aud) && nAud === 10 && /C\d+/.test(aud1), `painel do gestor: ${kp.replace(/\s+/g, ' ').slice(0, 160)}; ${linhasP - 1} pessoas; auditoria lista S1 devolvido e S2 aprovado; amostra de S1 com ${nAud} itens ("${aud1.replace(/\s+/g, ' ').slice(0, 60)}")`);
  const E = await L.celular(b); const p = E.p; await L.logar(p, 'div-2', 'equipe02'); await p.waitForSelector('button.nova', { timeout: 20000 });
  await p.evaluate(() => { window.__app.S.perProd = ['2026-11-01', '2026-11-15']; }); await p.goto(L.WEB + '#producao'); await p.waitForSelector('.prod-linha', { timeout: 20000 }); await p.waitForTimeout(500);
  const tp = await p.locator('main').innerText(); await p.screenshot({ path: 'b27f-dupla.png', fullPage: true });
  ok('F.7', /Bruno Alves/.test(tp) && /a receber/.test(tp) && /Mês\s*15 coletados/.test(tp) && !/hora/i.test(tp) && /2 m de altura/.test(tp), `painel da dupla no celular: ${tp.replace(/\s+/g, ' ').slice(0, 200)}`);
  const G = await L.celular(b); const g = G.p; g.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) g.erros.push(m.text()); });
  await L.logar(g, 'gap', 'biologia'); await g.waitForSelector('.kpis', { timeout: 20000 }); await g.waitForTimeout(2500); const tg = await g.locator('main').innerText(); const avisoG = await g.locator('.toast.erro, .aviso').count();
  await g.goto(L.WEB + '#mapa'); await g.waitForTimeout(1200); const aindaTime = await g.locator('text=Duplas do time').count(); await g.screenshot({ path: 'b27f-time.png', fullPage: true });
  ok('F.13', /A receber/.test(tg) && /Equipe 2/.test(tg) && /Histórico de pagamentos/.test(tg) && !avisoG && aindaTime === 1, `tela do time: ${tg.replace(/\s+/g, ' ').slice(0, 170)}; sem erro na tela (${avisoG}); tentar abrir o mapa volta ao painel do time`);
  const erros = [...p.erros, ...q.erros, ...g.erros]; ok('F.8', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b27f.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
