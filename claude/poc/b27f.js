// 2.7: produção por pessoa (parceiro por árvore, CLT no prêmio acima da meta), bônus, auditoria por setor e fechamento da medição
const { chromium } = require('playwright'); const L = require('./lib'); const fs = require('fs');
const R = {}; const ok = (id, passou, obs) => { R[id] = { passou, obs }; console.log(id, passou ? 'PASSOU' : 'FALHOU', '|', obs); };
const PJ = 'divinopolis';
const quadrado = (n, x0, y0, x1, y1) => ({ n, b: [x0, y0, x1, y1], a: [[x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]] });
const ANA = { avaliador_id: 'P-ana', avaliador: 'Ana Souza', avaliador_vinculo: 'CLT', avaliador_registro: 'CRBio 1', auxiliar_id: 'P-joao', auxiliar: 'João Lima', auxiliar_vinculo: 'Parceiro' };
const BRUNO = { avaliador_id: 'P-bruno', avaliador: 'Bruno Alves', avaliador_vinculo: 'Parceiro', avaliador_registro: 'CREA 2' };
(async () => {
  await L.subir(); await L.configurar();
  const prj = (await L.post('projetos_listar', {})).projetos.find((x) => x.id === PJ);
  await L.post('projeto_salvar', { projeto_dados: Object.assign({}, prj, { bonus_valor: '0.5', bonus_erro_max: '2', auditoria_pct: '10', auditoria_erro_max: '5' }) });
  await L.post('setores_importar', { projeto: PJ, camada: JSON.stringify({ setores: [quadrado('S1', -44.9, -20.2, -44.8, -20.1), quadrado('S2', -44.8, -20.2, -44.7, -20.1)] }) });
  await L.post('setores_atribuir', { projeto: PJ, itens: [{ numero: 'S1', equipe: 'Equipe 1' }, { numero: 'S2', equipe: 'Equipe 2' }] });
  // registros: Equipe 1 no dia 03/11 (Ana CLT + João parceiro), Equipe 2 no dia 04/11 (Bruno parceiro sozinho)
  const enviar = async (u, s, k, dia, extra, equipe) => { const uuid = `${u}-${dia}-${k}`; const t = `2026-11-${dia}T${String(11 + Math.floor(k / 60)).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}:00.000Z`;
    await L.post('registro', { projeto: PJ, linha: Object.assign({ uuid, projeto: PJ, equipe, criado_em: t, atualizado_em: t, concluido_em: t, latitude: -20.15, longitude: -44.85, 'Altura total (m)': 5, 'Foto 1': 'DCIM/x.jpg', 'Codigo': 'C' + k }, extra) }, u, s); return uuid; };
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
  ok('F.1', joao.validadas === 95 && joao.valor === 118.75 && ana.valor === 0 && ana.premio === 7.5 && d3.acima === 5 && bruno.valor === 25 && ana.naoContam === 1 && ana.devolvidas === 1 && ana.emValidacao === 1,
    `João (parceiro, 50%): ${joao.validadas} validadas = ${joao.valor}; Ana (CLT): por árvore ${ana.valor}, prêmio ${ana.premio} (${d3.validadas} no dia, ${d3.acima} acima da meta); Bruno (parceiro sozinho) ${bruno.valor}; altura abaixo de 2 m não conta (${ana.naoContam}); devolvida ${ana.devolvidas}, em validação ${ana.emValidacao}`);
  // 2. painel da dupla: só os dela, parceiro vê o valor, CLT vê o prêmio
  const M = await L.post('producao_minha', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }, 'div-1', 'equipe01');
  const mj = M.pessoas.find((x) => x.nome === 'João Lima') || {}, ma = M.pessoas.find((x) => x.nome === 'Ana Souza') || {};
  const negado = await L.post('producao', { projeto: PJ }, 'div-1', 'equipe01').then(() => 'liberado').catch((e) => e.message);
  ok('F.2', M.pessoas.length === 2 && mj.valor === 118.75 && !('valor' in ma) && ma.premio === 7.5 && M.devolvidas.length === 1 && /Foto sem a árvore/.test(M.devolvidas[0].motivo) && negado !== 'liberado',
    `dupla vê ${M.pessoas.length} pessoas (só as dela): João ${mj.valor}, Ana prêmio ${ma.premio}; devolvida com motivo "${(M.devolvidas[0] || {}).motivo}"; painel do gestor negado à equipe`);
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
  const P3 = await L.post('producao', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }); const b3 = P3.pessoas.find((x) => x.nome === 'Bruno Alves') || {};
  const M2 = await L.post('producao_minha', { projeto: PJ, de: '2026-11-01', ate: '2026-11-15' }, 'div-2', 'equipe02');
  const lis = (await L.post('listar', { projeto: PJ })).linhas.filter((l) => l.pagamento);
  ok('F.5', f1.medicao.arvores === 10 && f1.medicao.total === 30 && /já foi fechada/.test(f2) && b3.pagas === 10 && b3.arvoresPagar === 0 && P3.medicoes.length === 1 && M2.totais.pagas === 10 && lis.length === 10 && /Medição 2026-11-01 a 2026-11-15/.test(lis[0].pagamento),
    `medição fechada com ${f1.medicao.arvores} árvores (${f1.medicao.total}); fechar de novo: "${f2}"; Bruno com ${b3.pagas} pagas e nada a pagar; a dupla vê ${M2.totais.pagas} pagas; planilha marca "${(lis[0] || {}).pagamento}"`);
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
  ok('F.6', /Total do período/.test(kp) && linhasP >= 4 && /Devolvido para correção/.test(aud) && /Aprovado/.test(aud) && nAud === 10 && /C\d+/.test(aud1), `painel do gestor: ${kp.replace(/\s+/g, ' ').slice(0, 160)}; ${linhasP - 1} pessoas; auditoria lista S1 devolvido e S2 aprovado; amostra de S1 com ${nAud} itens ("${aud1.replace(/\s+/g, ' ').slice(0, 60)}")`);
  const E = await L.celular(b); const p = E.p; await L.logar(p, 'div-2', 'equipe02'); await p.waitForSelector('.mapa-mais', { timeout: 20000 });
  await p.evaluate(() => { window.__app.S.perProd = ['2026-11-01', '2026-11-15']; }); await p.goto(L.WEB + '#producao'); await p.waitForSelector('.prod-linha', { timeout: 20000 }); await p.waitForTimeout(500);
  const tp = await p.locator('main').innerText(); await p.screenshot({ path: 'b27f-dupla.png', fullPage: true });
  ok('F.7', /Bruno Alves/.test(tp) && /R\$\s?30,00/.test(tp) && /2 m de altura/.test(tp), `painel da dupla no celular: ${tp.replace(/\s+/g, ' ').slice(0, 200)}`);
  const erros = [...p.erros, ...q.erros]; ok('F.8', !erros.length, erros.length ? erros.join(' | ') : 'sem erros de JavaScript');
  fs.writeFileSync(__dirname + '/res-b27f.json', JSON.stringify(R, null, 1));
  const falhas = Object.values(R).filter((x) => !x.passou).length; console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK'); await b.close(); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
