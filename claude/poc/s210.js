// 2.10: times, auxiliar, prêmio por semana, face sem árvore, regras com vigência, chuva e dias, ver telas de outro perfil (teste direto do servidor)
const L = require('./lib'); const fs = require('fs'); const vm = require('vm');
const R = []; const ok = (n, c, o = '') => { R.push([n, c]); console.log(c ? 'OK  ' : 'FALHA', n, '|', o); };
const PJ = 'divinopolis'; const neg = (p) => p.then(() => 'ACEITOU').catch((e) => e.message);
const ctx = { TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(L.APP + '/js/quadras.js', 'utf8') + ';this.Quadras=Quadras;', ctx);
// semana passada inteira (segunda a domingo), em dias corridos antes de hoje
const hoje = new Date(); const seg0 = new Date(hoje); seg0.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7) - 7);
const diaN = (k) => { const d = new Date(seg0); d.setDate(seg0.getDate() + k); return d.toISOString().slice(0, 10); };
(async () => {
  await L.subir(); await L.configurar();
  // times e pessoas
  const tN = (await L.post('time_salvar', { time: { nome: 'Neofloresta', tipo: 'Próprio' } })).id; await L.post('time_salvar', { time: { nome: 'Gap', tipo: 'Parceiro' } });
  const dup = await neg(L.post('time_salvar', { time: { nome: 'gap', tipo: 'Parceiro' } })); const semTipo = await neg(L.post('time_salvar', { time: { nome: 'X', tipo: 'Outro' } }));
  const times = (await L.post('times_listar', {})).times;
  ok('cadastro de times', times.length === 2 && /Já existe/.test(dup) && /tipo do time/.test(semTipo) && /acesso/.test(await neg(L.post('time_salvar', { time: { nome: 'Y', tipo: 'Parceiro' } }, 'div-1', 'equipe01'))), `${times.map((t) => t.nome + ' (' + t.tipo + ')').join(', ')}; repetido: "${dup}"; equipe de campo não cadastra`);
  const nova = async (pe) => (await L.post('pessoa_salvar', { pessoa: Object.assign({ projeto: PJ }, pe) })).id;
  const ana = await nova({ nome: 'Ana Souza', funcao: 'Avaliador', registro: 'CRBio 1', vinculo: 'CLT', time: 'Neofloresta' }); const caio = await nova({ nome: 'Caio Reis', funcao: 'Auxiliar', vinculo: 'CLT', time: 'Neofloresta' });
  const bia = await nova({ nome: 'Bia Gap', funcao: 'Avaliador', registro: 'CRBio 2', vinculo: 'Parceiro', time: 'Gap' }); const leo = await nova({ nome: 'Leo Gap', funcao: 'Auxiliar', vinculo: 'Parceiro', time: 'Gap' }); const ze = await nova({ nome: 'Zé Outro', funcao: 'Auxiliar', vinculo: 'Parceiro', time: 'Outro' });
  await L.post('usuario_salvar', { usuario_dados: { login: 'div-1', perfil: 'coletor', avaliador_id: ana, auxiliar_id: caio } }); await L.post('usuario_salvar', { usuario_dados: { login: 'div-2', perfil: 'coletor', avaliador_id: bia, indicacao: 'qualquer' } });
  const us = (await L.post('usuarios_listar', {})).usuarios; const u1 = us.find((x) => x.login === 'div-1'), u2 = us.find((x) => x.login === 'div-2');
  const s1 = await L.post('sessao', {}, 'div-1', 'equipe01'); const s2 = await L.post('sessao', {}, 'div-2', 'equipe02');
  ok('o acesso herda o time do avaliador', u1.indicacao === 'Neofloresta' && u2.indicacao === 'Gap' && s2.usuario.escolheAuxiliar === true && s1.usuario.escolheAuxiliar === false, `div-1: ${u1.indicacao}; div-2: ${u2.indicacao}; parceiro escolhe o auxiliar no começo do turno: ${s2.usuario.escolheAuxiliar}; equipe própria não: ${s1.usuario.escolheAuxiliar}`);
  // usuário por perfil: cliente e parceiro não guardam equipe de coleta, copa nem dupla; auxiliar precisa da pessoa
  await L.post('usuario_salvar', { usuario_dados: { login: 'pref', senha: 'prefeitura1', nome: 'Prefeitura', perfil: 'cliente', projeto: PJ, codigo: 'E9', modo_copa: 'area', avaliador_id: ana, auxiliar_id: caio, trajeto: 'sim' } });
  const semPe = await neg(L.post('usuario_salvar', { usuario_dados: { login: 'caio', senha: 'auxiliar01', perfil: 'auxiliar', projeto: PJ } }));
  await L.post('usuario_salvar', { usuario_dados: { login: 'caio', senha: 'auxiliar01', perfil: 'auxiliar', projeto: PJ, auxiliar_id: caio } }); await L.post('usuario_salvar', { usuario_dados: { login: 'leo', senha: 'auxiliar02', perfil: 'auxiliar', projeto: PJ, auxiliar_id: leo } });
  await L.post('usuario_salvar', { usuario_dados: { login: 'gap', senha: 'biologia', nome: 'Time Gap', perfil: 'time', projeto: PJ, indicacao: 'Gap' } });
  const us2 = (await L.post('usuarios_listar', {})).usuarios; const cli = us2.find((x) => x.login === 'pref'), uc = us2.find((x) => x.login === 'caio');
  ok('usuário por perfil', !cli.codigo && !cli.avaliador_id && !cli.auxiliar_id && !cli.trajeto && !cli.modo_copa && /pessoas/.test(semPe) && uc.nome === 'Caio Reis' && uc.auxiliar_id === caio, `cliente sem código, copa, dupla e trajeto; auxiliar sem pessoa: "${semPe}"; auxiliar ganha o nome do cadastro (${uc.nome})`);
  const vT = (fs.readFileSync(L.APP + '/js/app.js', 'utf8').match(/TERMO_VERSAO = '([^']+)'/) || [])[1]; for (const [u, s] of [['caio', 'auxiliar01'], ['leo', 'auxiliar02'], ['gap', 'biologia'], ['pref', 'prefeitura1']]) await L.post('aceitar_termo', { versao: vT }, u, s);
  // registros
  const enviar = async (u, s, k, d, extra, equipe) => { const uuid = `${u}-${d}-${k}`; const t = `${d}T${String(11 + Math.floor(k / 30)).padStart(2, '0')}:${String((k % 30) * 2).padStart(2, '0')}:00.000Z`;
    await L.post('registro', { projeto: PJ, linha: Object.assign({ uuid, projeto: PJ, equipe, criado_em: t, atualizado_em: t, concluido_em: t, latitude: -20.15, longitude: -44.85, 'Altura total (m)': 5, 'Foto 1': 'DCIM/x.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', Codigo: 'C' + k }, extra) }, u, s); return uuid; };
  const e1 = []; for (const [k, n] of [[0, 110], [1, 120], [2, 100], [3, 200]]) for (let i = 0; i < n; i++) e1.push(await enviar('div-1', 'equipe01', i, diaN(k), {}, 'Equipe 1'));
  // parceiro: 6 sozinha, 4 com o Leo, 1 tentando um auxiliar de outro time (o servidor grava sozinha)
  const e2 = []; for (let i = 0; i < 6; i++) e2.push(await enviar('div-2', 'equipe02', i, diaN(1), { auxiliar_id: '' }, 'Equipe 2')); for (let i = 6; i < 10; i++) e2.push(await enviar('div-2', 'equipe02', i, diaN(1), { auxiliar_id: leo }, 'Equipe 2'));
  const fz = await enviar('div-2', 'equipe02', 10, diaN(1), { auxiliar_id: ze }, 'Equipe 2'); e2.push(fz);
  const pend = e1.pop(); // um registro da semana fica sem decisão do auditor
  await L.post('validar', { projeto: PJ, itens: [...e1, ...e2].map((uuid) => ({ uuid, estado: 'Validado' })) });
  const lin = (await L.post('listar', { projeto: PJ })).linhas; const lz = lin.find((l) => l.uuid === fz), l8 = lin.find((l) => l.uuid === e2[8]), l0 = lin.find((l) => l.uuid === e2[0]);
  ok('parceiro: sozinho ou com auxiliar a cada turno', l0.avaliador === 'Bia Gap' && !l0.auxiliar_id && l8.auxiliar === 'Leo Gap' && !lz.auxiliar_id, `sozinha: auxiliar "${l0.auxiliar || ''}"; com auxiliar: ${l8.auxiliar}; auxiliar de outro time não entra ("${lz.auxiliar || ''}")`);
  const de = diaN(0), ate = diaN(6);
  let P = await L.post('producao', { projeto: PJ, de, ate }); const pe = (n, X = P) => X.pessoas.find((x) => x.nome === n) || {};
  // Bia: 7 sozinha x 2,00 + 4 x 1,00 = 18; Leo: 4 x 1,00 = 4; Gap: 11 x 0,50 = 5,50
  ok('parceiro: 2,00 para quem coleta e 0,50 para o time; com auxiliar, metade para cada', pe('Bia Gap').valor === 18 && pe('Leo Gap').valor === 4 && P.indicacoes.length === 1 && P.indicacoes[0].nome === 'Gap' && P.indicacoes[0].valor === 5.5 && P.totais.totalPagar === 27.5 && pe('Ana Souza').valor === 0, `Bia ${pe('Bia Gap').valor}, Leo ${pe('Leo Gap').valor}, time ${P.indicacoes.map((i) => i.nome + ' ' + i.valor).join(', ')}; a pagar na medição ${P.totais.totalPagar}; time próprio não tem parte por registro`);
  let S = P.semanas.find((x) => x.semana === de) || {};
  ok('semana com registro esperando o auditor fica aberta', S.situacao === 'Aberta' && S.pendentes === 1 && pe('Ana Souza').premio === 0 && pe('Ana Souza').premioPrevisto > 0, `${S.situacao}, ${S.pendentes} pendente; prêmio apurado ${pe('Ana Souza').premio}, previsto ${pe('Ana Souza').premioPrevisto}`);
  await L.post('validar', { projeto: PJ, itens: [{ uuid: pend, estado: 'Validado' }] });
  P = await L.post('producao', { projeto: PJ, de, ate }); S = P.semanas.find((x) => x.semana === de) || {};
  // 4 dias: 110, 120, 100, 200 = média 132,5; teto 130: (130 - 100) x 4 = 120 registros de superação. Avaliador 120 x 2,50 + 250/4 = 362,50; auxiliar 120 x 1,50 + 150/4 = 217,50
  ok('prêmio da semana: meta e superação com teto', S.situacao === 'Apurada' && S.media === 132.5 && S.diasTrabalhados === 4 && S.bateu && S.avaliador.meta === 62.5 && S.avaliador.superacao === 300 && S.avaliador.total === 362.5 && S.auxiliar.total === 217.5 && pe('Ana Souza').premio === 362.5 && pe('Caio Reis').premio === 217.5 && pe('Ana Souza').totalPagar === 0,
    `${S.situacao}: média ${S.media} em ${S.diasTrabalhados} dias; avaliador meta ${S.avaliador && S.avaliador.meta} + superação ${S.avaliador && S.avaliador.superacao} = ${S.avaliador && S.avaliador.total}; auxiliar ${S.auxiliar && S.auxiliar.total}; prêmio fica fora da medição (a pagar ${pe('Ana Souza').totalPagar})`);
  // dia de chuva: quinta marcada como parcial sai da média: (110+120+100)/3 = 110; superação 10 x 3 = 30: avaliador 75 + 62,50
  const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const ch = await L.post('chuva_registrar', { projeto: PJ, obs: 'Chuva forte =1+1', foto: 'https://drive.google.com/file/d/abc/view', quando: ontem + 'T17:30:00.000Z' }, 'div-1', 'equipe01');
  const semAdm = await neg(L.post('dia_marcar', { projeto: PJ, id: ch.id, situacao: 'Parcial' }, 'div-1', 'equipe01')); await L.post('dia_marcar', { projeto: PJ, id: ch.id, situacao: 'Parcial' }); await L.post('dia_marcar', { projeto: PJ, dia: diaN(3), equipe: 'Equipe 1', situacao: 'Parcial' });
  const dias = (await L.post('dias_listar', { projeto: PJ })).dias; P = await L.post('producao', { projeto: PJ, de, ate }); S = P.semanas.find((x) => x.semana === de) || {};
  ok('parada por chuva e dia parcial fora da média', ch.dia === ontem && ch.hora === '14:30' && dias.length === 2 && dias[0].situacao === 'Parcial' && !/^=/.test(dias[0].obs) && /acesso/.test(semAdm) && S.media === 110 && S.diasTrabalhados === 3 && S.avaliador.total === 137.5 && S.auxiliar.total === 82.5, `chuva ${ch.dia} ${ch.hora}; só a coordenação marca o dia ("${semAdm}"); média ${S.media} em ${S.diasTrabalhados} dias; avaliador ${S.avaliador.total}, auxiliar ${S.auxiliar.total}`);
  await L.post('dia_marcar', { projeto: PJ, dia: diaN(2), equipe: 'Equipe 1', situacao: 'Perdido' }); P = await L.post('producao', { projeto: PJ, de, ate }); S = P.semanas.find((x) => x.semana === de) || {};
  ok('coordenação marca dia perdido sem registro de chuva', S.diasTrabalhados === 2 && S.media === 115, `média ${S.media} em ${S.diasTrabalhados} dias`);
  await L.post('dia_marcar', { projeto: PJ, dia: diaN(2), equipe: 'Equipe 1', situacao: 'Trabalhado' });
  // horas: só no relatório da coordenação
  const j0 = P.jornada.find((x) => x.dia === diaN(0)) || {};
  const M1 = await L.post('producao_minha', { projeto: PJ }, 'div-1', 'equipe01'); const txt1 = JSON.stringify(M1);
  ok('horas só para a coordenação', P.jornada.length === 4 && j0.inicio === '08:00' && j0.coletados === 110 && j0.horas > 3 && !/jornada|horas|porHora|inicio/.test(txt1), `coordenação: ${j0.dia} ${j0.inicio} a ${j0.fim}, ${j0.horas} h, ${j0.coletados} registros; painel da equipe sem horas nem rendimento por hora`);
  // painéis: avaliador, auxiliar com carteira, auxiliar parceiro
  const MC = await L.post('producao_minha', { projeto: PJ }, 'caio', 'auxiliar01'); const ML = await L.post('producao_minha', { projeto: PJ }, 'leo', 'auxiliar02'); const MB = await L.post('producao_minha', { projeto: PJ }, 'div-2', 'equipe02');
  const mesmoMes = diaN(0).slice(0, 7) === hoje.toISOString().slice(0, 7);
  const negAux = []; for (const ac of ['listar', 'mapa', 'painel', 'producao', 'producao_time', 'pessoas_listar', 'usuarios_listar', 'registro', 'foto_ver', 'os_listar', 'quadras_situacao', 'chuva_registrar', 'times_listar']) negAux.push(await L.post(ac, { projeto: PJ, campos: ['uuid'], linha: { uuid: 'x' } }, 'caio', 'auxiliar01').then(() => ac + ' LIBEROU').catch(() => ''));
  ok('painel do auxiliar: só o dele', MC.pessoas.length === 1 && MC.pessoas[0].nome === 'Caio Reis' && MC.comCarteira && MC.semanas.length >= 1 && MC.semanas[0].premios.length === 1 && MC.semanas[0].premios[0].nome === 'Caio Reis' && (!mesmoMes || MC.pessoas[0].premioApurado === 82.5) && ML.pessoas.length === 1 && ML.pessoas[0].aReceber === 4 && !ML.comCarteira && !negAux.filter(Boolean).length && (!mesmoMes || MC.mes.coletados === 530),
    `Caio (carteira): ${MC.pessoas.map((x) => x.nome + ' prêmio ' + x.premioApurado).join()}; semanas ${MC.semanas.length}, só o prêmio dele; Leo (parceiro): a receber ${ML.pessoas[0] && ML.pessoas[0].aReceber}; mês ${MC.mes.coletados} coletados; outras consultas negadas (${negAux.filter(Boolean).join(', ') || 'todas'})`);
  ok('painel de quem coleta', MB.pessoas.length === 2 && (MB.pessoas.find((x) => x.nome === 'Bia Gap') || {}).aReceber === 18 && MB.meta === null && !('indicacoes' in MB) && M1.meta && M1.meta.porDia === 100 && M1.pessoas.every((x) => !('aReceber' in x)), `Bia vê a receber ${(MB.pessoas.find((x) => x.nome === 'Bia Gap') || {}).aReceber} e não vê a parte do time; equipe com carteira vê a meta de ${M1.meta && M1.meta.porDia} por dia`);
  // medição: só parceiros e time; prêmio com carteira fica fora
  const f = await L.post('medicao_fechar', { projeto: PJ, de, ate }); const T = await L.post('producao_time', { projeto: PJ }, 'gap', 'biologia'); const Ta = await L.post('producao_time', { projeto: PJ, time: 'Gap' });
  ok('medição paga parceiros e time; painel do parceiro pela coordenação', f.medicao.total === 27.5 && f.medicao.arvores === 11 && !(await L.post('listar', { projeto: PJ })).linhas.some((l) => l.pagamento && l.avaliador_vinculo === 'CLT') && T.pago === 5.5 && T.totais.pagas === 11 && Ta.time === 'Gap' && Ta.pago === 5.5 && /time definido/.test(await neg(L.post('producao_time', { projeto: PJ }))), `medição ${f.medicao.arvores} registros, ${f.medicao.total}; time recebeu ${T.pago}; coordenação abre o painel do parceiro escolhendo o time (${Ta.time})`);
  // face de quadra sem árvore vale como registro, com peso
  const prj0 = (await L.post('projetos_listar', {})).projetos.find((x) => x.id === PJ); const Q = ctx.Quadras; const r = await Q.lerArquivo('q.geojson', fs.readFileSync(__dirname + '/fixtures/quadras_divinopolis_faces.geojson')); const cam = Q.compactar(r.feicoes, 'quadra', ['ruas']); cam.quadras = cam.quadras.filter((x) => x.n === '2459'); cam.total = 1;
  const imp = await L.post('quadras_importar', { projeto: PJ, camada: JSON.stringify(cam) }); const fid = '2459-' + cam.quadras[0].f[0].i;
  const fv = 'a1b2c3d4-0000-4000-8000-0000000000f1'; await L.post('registro', { projeto: PJ, linha: { uuid: fv, projeto: PJ, equipe: 'Equipe 2', criado_em: diaN(4) + 'T12:00:00.000Z', atualizado_em: diaN(4) + 'T12:00:00.000Z', latitude: -20.15, longitude: -44.85, 'Altura total (m)': '', 'Foto 1': 'DCIM/c.jpg', 'Foto 1 link': 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view', auxiliar_id: '' } }, 'div-2', 'equipe02'); await L.post('validar', { projeto: PJ, itens: [{ uuid: fv, estado: 'Validado' }] });
  const antes = (await L.post('producao', { projeto: PJ, de, ate })).totais.arvoresPagar;
  const mk = await L.post('quadras_marcar', { projeto: PJ, itens: [{ tipo: 'face', numero: fid, situacao: 'Levantada, sem árvores', registro: fv, largura: '2,4' }] }, 'div-2', 'equipe02');
  let PF = await L.post('producao', { projeto: PJ, de, ate }); const b1 = pe('Bia Gap', PF).valorPagar;
  await L.post('projeto_salvar', { projeto_dados: Object.assign({}, prj0, { peso_face: '0.5' }) }); PF = await L.post('producao', { projeto: PJ, de, ate }); const b2 = pe('Bia Gap', PF).valorPagar;
  ok('face sem árvore conta como registro, com peso', imp.total === 1 && !mk.recusadas.length && antes === 0 && PF.totais.arvoresPagar === 1 && b1 === 2 && b2 === 1, `antes de ligar à face o cadastro de calçada não conta (${antes}); ligado conta ${PF.totais.arvoresPagar}: ${b1} com peso 1 e ${b2} com peso 0,5`);
  await L.post('projeto_salvar', { projeto_dados: Object.assign({}, prj0, { peso_face: '' }) });
  // regras com vigência: meta 120 a partir de hoje não muda a semana passada
  const prj = (await L.post('projetos_listar', {})).projetos.find((x) => x.id === PJ); const hj = hoje.toISOString().slice(0, 10);
  await L.post('projeto_salvar', { projeto_dados: Object.assign({}, prj, { meta_dia: '120', teto_dia: '150', regras_de: hj }) });
  P = await L.post('producao', { projeto: PJ, de, ate }); S = P.semanas.find((x) => x.semana === de) || {}; const prj2 = (await L.post('projetos_listar', {})).projetos.find((x) => x.id === PJ);
  ok('regra nova vale da data em diante', S.meta === 100 && S.avaliador.total === 137.5 && P.regras.meta === 100 && (await L.post('producao', { projeto: PJ, de: hj, ate: hj })).regras.meta === 120 && prj2.regras_de === hj && /"ate"/.test(prj2.regras_hist || ''), `semana passada segue com meta ${S.meta} (avaliador ${S.avaliador.total}); de hoje em diante meta ${120}`);
  // reprovado: precisa de motivo, fica guardado e não conta
  const rp = await enviar('div-2', 'equipe02', 60, diaN(4), { auxiliar_id: '' }, 'Equipe 2'); const semMot = await neg(L.post('validar', { projeto: PJ, itens: [{ uuid: rp, estado: 'Reprovado' }] }));
  await L.post('validar', { projeto: PJ, itens: [{ uuid: rp, estado: 'Reprovado', obs: 'Não é árvore de rua' }] }); const lr = (await L.post('listar', { projeto: PJ })).linhas.find((l) => l.uuid === rp) || {};
  ok('reprovado com motivo', /motivo/.test(semMot) && lr.validacao === 'Descartado' && /rua/.test(lr.validacao_obs), `sem motivo: "${semMot}"; gravado como ${lr.validacao} (${lr.validacao_obs})`);
  // coordenação vendo as telas de outro perfil: só consultas
  const c1 = await L.post('sessao', { como: 'div-2' }); const cm = await L.post('producao_minha', { projeto: PJ, como: 'div-2' }); const cc = await L.post('painel', { projeto: PJ, como: 'pref' }).then((x) => 'ok', (e) => e.message); const ct = await L.post('producao_time', { projeto: PJ, como: 'gap' });
  const grava = []; for (const ac of ['registro', 'validar', 'usuario_salvar', 'chuva_registrar', 'medicao_fechar', 'trocar_senha', 'aceitar_termo', 'quadras_marcar', 'foto', 'usuarios_listar', 'producao']) grava.push(await L.post(ac, { projeto: PJ, como: 'div-2', linha: { uuid: 'zz' }, itens: [] }).then(() => ac + ' GRAVOU').catch((e) => (/visualização/.test(e.message) ? '' : ac + ': ' + e.message)));
  const naoAdm = await neg(L.post('sessao', { como: 'admin' }, 'div-1', 'equipe01')); const comoAdm = await neg(L.post('sessao', { como: 'admin' })); const cliLista = await neg(L.post('producao', { projeto: PJ, como: 'pref' }));
  const aud = (await L.post('auditoria_listar', {})).itens || []; const viu = aud.filter((x) => JSON.stringify(x).includes('ver_como')).length;
  ok('ver as telas de outro perfil: só consulta', c1.usuario.login === 'div-2' && c1.usuario.perfil === 'coletor' && cm.pessoas.length === 2 && cc === 'ok' && ct.time === 'Gap' && !grava.filter(Boolean).length && /acesso/.test(naoAdm) && /Escolha/.test(comoAdm) && /visualização/.test(cliLista) && viu >= 1,
    `sessão como ${c1.usuario.login} (${c1.usuario.perfil}); painel do cliente ${cc}; painel do parceiro ${ct.time}; gravações recusadas (${grava.filter(Boolean).join(', ') || 'todas'}); equipe de campo não usa ("${naoAdm}"); fica no registro de auditoria (${viu})`);
  const falhas = R.filter((x) => !x[1]).length; console.log(`\n${falhas} falha(s) de ${R.length}`);
  fs.writeFileSync(__dirname + '/res-s210.json', JSON.stringify(R)); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
